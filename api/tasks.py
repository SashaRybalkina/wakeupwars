from django.utils import timezone
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
    Challenge,
    ChallengeMembership,
    GamePerformance,
    Game,
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
    Model = _game_state_model(game_code)

    ch   = Challenge.objects.get(pk=challenge_id)
    game = Game.objects.get(pk=game_id)

    # choose a user (some helpers require a user)
    user = None
    if user_id is not None:
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            user = None
    if user is None:
        user = getattr(ch, "initiator", None)
    if user is None:
        first_uid = (
            ChallengeMembership.objects
            .filter(challengeID=ch)
            .values_list("uID_id", flat=True)
            .first()
        )
        if first_uid:
            user = User.objects.filter(pk=first_uid).first()

    # try to reuse an existing state
    try:
        gs = Model.objects.get(challenge=ch, game=game)
    except Model.DoesNotExist:
        # otherwise create one
        if game_code == "sudoku":
            # sudoku init requires a user; fall back to any available user
            if user is None:
                user = User.objects.order_by("id").first()
            gs_dict = sudoku_init(ch.id, user, allow_join=False)
            gs = SudokuGameState.objects.get(pk=gs_dict["game_state_id"])

        elif game_code == "wordle":
            blank = "_____"
            gs, _ = WordleGameState.objects.get_or_create(
                challenge=ch,
                game=game,
                defaults={"puzzle": blank, "solution": blank,
                          "created_at": timezone.now()},
            )

        elif game_code == "pattern":
            gs, _ = PatternMemorizationGameState.objects.get_or_create(
                challenge=ch,
                game=game,
                defaults={"pattern_sequence": [],
                          "created_at": timezone.now()},
            )
        else:
            return  # unknown game type

    # continue with join-window timing
    if not gs.join_deadline_at:
        gs.join_deadline_at = timezone.now() + timezone.timedelta(minutes=2)
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
