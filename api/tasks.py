from django.utils import timezone
from datetime import date, timedelta
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
import logging
from django.contrib.auth import get_user_model
from celery import shared_task, uuid
from django.db.models import F
from api.sudokuStuff.utils import get_or_create_game as sudoku_init
from api.wordleStuff.utils import get_or_create_game_wordle as wordle_init
from api.patternMem.utils import get_or_create_pattern_game as pattern_init
from api.typingRaceStuff.utils import get_or_create_typing_race_game as typing_init
from .models import (
    ChallengeMembership,
    SudokuGameState,
    WordleGameState,
    PatternMemorizationGameState,
    TypingRaceGameState,
    SudokuGamePlayer,
    Challenge,
    GamePerformance,
    Game,
    GameSchedule,
    GameScheduleGameAssociation,
)

# ---------- helper ----------
def _normalize_game_code(game_code: str) -> str:
    code = (game_code or "").strip().lower().replace(" ", "").replace("-", "").replace("_", "")
    alias = {
        "sudoku": "sudoku",
        "wordle": "wordle",
        "pattern": "pattern",
        "patternmemorization": "pattern",
        "typing": "typing",
        "typingrace": "typing",
    }
    return alias.get(code, code)


def _game_state_model(game_code):
    code = _normalize_game_code(game_code)
    return {
        "sudoku": SudokuGameState,
        "wordle": WordleGameState,
        "pattern": PatternMemorizationGameState,
        "typing": TypingRaceGameState,
    }[code]

User = get_user_model()
logger = logging.getLogger(__name__)

# A. fire at alarm-time
@shared_task
def open_join_window(challenge_id, game_id, game_code, user_id=None):
    """
    Opens the join window for a game at alarm time.
    Helpers now use proper get_or_create with unique constraints to prevent race conditions.
    """
    code = _normalize_game_code(game_code)
    Model = _game_state_model(code)
    ch = Challenge.objects.get(pk=challenge_id)
    
    # Get user (assume user_id is passed in from collaborative setup)
    user = None
    if user_id is not None:
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            user = None
    
    # Fallback to initiator or first member if no user_id
    if user is None:
        user = getattr(ch, "initiator", None)
    if user is None:
        first_uid = ChallengeMembership.objects.filter(challengeID=ch).values_list("uID_id", flat=True).first()
        if first_uid:
            user = User.objects.filter(pk=first_uid).first()
    if user is None:
        user = User.objects.order_by("id").first()
    
    # Use current time as alarm_datetime
    alarm_datetime = timezone.now()
    
    # Call helper functions which now use proper get_or_create
    if code == "sudoku":
        gs_dict = sudoku_init(ch.id, user, allow_join=False, alarm_datetime=alarm_datetime)
        gs = SudokuGameState.objects.get(pk=gs_dict["game_state_id"])
    elif code == "wordle":
        gs_dict = wordle_init(ch.id, user, allow_join=False, alarm_datetime=alarm_datetime)
        gs = WordleGameState.objects.get(pk=gs_dict["game_state_id"])
    elif code == "pattern":
        gs_dict = pattern_init(ch.id, user, allow_join=False, alarm_datetime=alarm_datetime)
        gs = PatternMemorizationGameState.objects.get(pk=gs_dict["game_state_id"])
    elif code == "typing":
        gs_dict = typing_init(ch.id, user, allow_join=False)
        gs = TypingRaceGameState.objects.get(pk=gs_dict["game_state_id"])
    else:
        return  # unknown game type
    
    # Schedule close_join_window task (refresh stale or missing deadline)
    now = timezone.now()
    if not gs.join_deadline_at or gs.join_deadline_at <= now:
        gs.join_deadline_at = now + timedelta(seconds=20)
        gs.save(update_fields=["join_deadline_at"])
    
    logger.info(
        "[join-window] scheduling close for %s id=%s at %s (now=%s)",
        Model.__name__, gs.id, gs.join_deadline_at, now
    )
    close_join_window.apply_async(
        args=[Model.__name__, gs.id],
        eta=gs.join_deadline_at,
        taREDACTEDid=f"close-{Model.__name__}-{gs.id}-{uuid()}",
    )

# B. fire 2 minutes later
@shared_task
def close_join_window(model_name, gs_id):
    Model = globals()[model_name]
    gs = Model.objects.select_related("challenge", "game").get(pk=gs_id)
    logger.info(
        "[join-window] executing close for %s id=%s at %s (deadline=%s)",
        model_name, gs_id, timezone.now(), getattr(gs, "join_deadline_at", None)
    )
    if gs.joins_closed:
        return  # already handled by safety-net

    today = timezone.localdate()
    try:
        is_multiplayer = bool(getattr(gs.game, 'isMultiplayer', False))
    except Exception:
        is_multiplayer = False

    if is_multiplayer:
        participant_ids = set(
            ChallengeMembership.objects.filter(challengeID=gs.challenge)
                                       .values_list("uID_id", flat=True)
        )
        existing_ids = set(
            GamePerformance.objects.filter(challenge=gs.challenge,
                                           game=gs.game,
                                           date=today)
                                   .values_list("user_id", flat=True)
        )
        for uid in participant_ids - existing_ids:
            GamePerformance.objects.get_or_create(
                challenge=gs.challenge, game=gs.game,
                user_id=uid, date=today,
                defaults={"score": 0, "auto_generated": True},
            )
    else:
        owner_id = getattr(gs, 'user_id', None)
        if owner_id and not GamePerformance.objects.filter(
            challenge=gs.challenge, game=gs.game, date=today, user_id=owner_id
        ).exists():
            GamePerformance.objects.update_or_create(
                challenge=gs.challenge,
                game=gs.game,
                user_id=owner_id,
                date=today,
                defaults={"score": 0, "auto_generated": True},
            )

    gs.joins_closed = True
    gs.save(update_fields=["joins_closed"])

    # Notify connected clients via Channels to auto-start
    # Broadcast join window closed (best-effort)
    try:
        prefix = {
            'SudokuGameState': 'sudoku',
            'WordleGameState': 'wordle',
            'PatternMemorizationGameState': 'pattern',
            'TypingRaceGameState': 'typing',
        }[model_name]
        group = f"{prefix}_{gs.id}"
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            group,
            {
                'type': 'join_window_closed',
                'server_now': timezone.now().isoformat(),
            }
        )
        logger.info("Passing......")
    except Exception:
        logger.exception("Failed to broadcast join_window_closed for %s %s", model_name, gs_id)