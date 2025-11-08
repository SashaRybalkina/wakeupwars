from django.utils import timezone
from datetime import date
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
import logging
from django.contrib.auth import get_user_model
from celery import shared_task, uuid
from django.db.models import F
from api.sudokuStuff.utils import get_or_create_game as sudoku_init
from api.wordleStuff.utils import get_or_create_game_wordle as wordle_init
from api.patternMem.utils import get_or_create_pattern_game as pattern_init
from .models import (
    ChallengeMembership,
    SudokuGameState,
    WordleGameState,
    PatternMemorizationGameState,
    SudokuGamePlayer,
    Challenge,
    GamePerformance,
    Game,
    GameSchedule,
    GameScheduleGameAssociation,
)

# ---------- helper ----------
def _game_state_model(game_code):
    return {
        "sudoku": SudokuGameState,
        "wordle": WordleGameState,
        "pattern": PatternMemorizationGameState,
    }[game_code]

User = get_user_model()
logger = logging.getLogger(__name__)

# A. fire at alarm-time
@shared_task
def open_join_window(challenge_id, game_id, game_code, user_id=None):
    """
    Opens the join window for a game at alarm time.
    Helpers now use proper get_or_create with unique constraints to prevent race conditions.
    """
    Model = _game_state_model(game_code)
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
    if game_code == "sudoku":
        gs_dict = sudoku_init(ch.id, user, allow_join=False, alarm_datetime=alarm_datetime)
        gs = SudokuGameState.objects.get(pk=gs_dict["game_state_id"])
    elif game_code == "wordle":
        gs_dict = wordle_init(ch.id, user, allow_join=False, alarm_datetime=alarm_datetime)
        gs = WordleGameState.objects.get(pk=gs_dict["game_state_id"])
    elif game_code == "pattern":
        gs_dict = pattern_init(ch.id, user, allow_join=False, alarm_datetime=alarm_datetime)
        gs = PatternMemorizationGameState.objects.get(pk=gs_dict["game_state_id"])
    else:
        return  # unknown game type
    
    # Schedule close_join_window task
    if not gs.join_deadline_at:
        gs.join_deadline_at = timezone.now() + timezone.timedelta(seconds=20)
        gs.save(update_fields=["join_deadline_at"])
    
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
    if gs.joins_closed:
        return  # already handled by safety-net

    today = timezone.localdate()
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
    gs.joins_closed = True
    gs.save(update_fields=["joins_closed"])

    # Notify connected clients via Channels to auto-start
    # Broadcast join window closed (best-effort)
    try:
        prefix = {
            'SudokuGameState': 'sudoku',
            'WordleGameState': 'wordle',
            'PatternMemorizationGameState': 'pattern',
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

    # Schedule leaderboard regardless of broadcast success
    try:
        logger.info("i'm passing too so it should work.")
        async_result = broadcast_leaderboard.apply_async(
            args=[Model.__name__, gs.id],
            kwargs={"for_date_iso": today.isoformat()},
            eta=timezone.now() + timezone.timedelta(minutes=2),
            taREDACTEDid=f"leaderboard-{Model.__name__}-{gs.id}-{uuid()}",
        )
        logger.info(
            "Scheduled broadcast_leaderboard for %s %s (taREDACTEDid=%s) in %s seconds",
            model_name, gs_id, getattr(async_result, 'id', None), 120,
        )
    except Exception:
        logger.exception("Failed to schedule broadcast_leaderboard for %s %s", model_name, gs_id)

@shared_task
def broadcast_leaderboard(model_name: str, gs_id: int, for_date_iso: str | None = None):
    """
    Compute and broadcast today's leaderboard for a specific game state.
    This is invoked some time after joins are closed to finalize scores, and
    ensures clients receive a definitive leaderboard even if games were abandoned.
    """
    try:
        Model = globals()[model_name]
    except KeyError:
        return

    gs = Model.objects.select_related("challenge", "game").get(pk=gs_id)
    try:
        play_date = date.fromisoformat(for_date_iso) if for_date_iso else timezone.localdate()
    except Exception:
        play_date = timezone.localdate()

    # Reconcile/finalize Sudoku scores if not already present
    if model_name == 'SudokuGameState':
        try:
            # Respect existing GamePerformance (e.g., set by the completer at finish)
            players = (
                SudokuGamePlayer.objects
                .select_related('player')
                .filter(gameState_id=gs_id)
            )
            existing_ids = set(
                GamePerformance.objects
                .filter(challenge=gs.challenge, game=gs.game, date=play_date)
                .values_list('user_id', flat=True)
            )
            participant_ids = set(
                ChallengeMembership.objects
                .filter(challengeID=gs.challenge)
                .values_list('uID_id', flat=True)
            )

            # For any player without a row yet, assign 0
            for p in players:
                if p.player_id not in existing_ids:
                    GamePerformance.objects.update_or_create(
                        challenge=gs.challenge,
                        game=gs.game,
                        user=p.player,
                        date=play_date,
                        defaults={"score": 0, "auto_generated": True},
                    )
                    existing_ids.add(p.player_id)

            # Zero-fill remaining participants for the day
            for uid in participant_ids - existing_ids:
                GamePerformance.objects.update_or_create(
                    challenge=gs.challenge,
                    game=gs.game,
                    user_id=uid,
                    date=play_date,
                    defaults={"score": 0, "auto_generated": True},
                )
        except Exception:
            logger.exception("Failed to reconcile Sudoku scores before broadcasting for %s %s", model_name, gs_id)

    leaderboard = list(
        GamePerformance.objects
        .filter(challenge=gs.challenge, game=gs.game, date=play_date)
        .select_related("user")
        .values("user_id", "score")
    )

    try:
        prefix = {
            'SudokuGameState': 'sudoku',
            'WordleGameState': 'wordle',
            'PatternMemorizationGameState': 'pattern',
        }[model_name]
        group = f"{prefix}_{gs.id}"
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            group,
            {
                'type': 'leaderboard.update',
                'leaderboard': leaderboard,
                'server_now': timezone.now().isoformat(),
            }
        )
    except Exception:
        logger.exception("Failed to broadcast leaderboard for %s %s", model_name, gs_id)
