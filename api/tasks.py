from django.utils import timezone
from django.contrib.auth import get_user_model
from celery import shared_task, uuid
from django.db.models import F
from api.sudokuStuff.utils import get_or_create_game as sudoku_init
from api.wordleStuff.utils import get_or_create_game_wordle as wordle_init
from api.patternMem.utils import get_or_create_pattern_game as pattern_init
from .models import (Obligation, Payment, PaymentStatus, ObligationStatus, ChallengeMembership, 
SudokuGameState, WordleGameState, PatternMemorizationGameState, Challenge, 
ChallengeMembership, GamePerformance, Game)

# ---------- helper ----------
def _game_state_model(game_code):
    return {
        "sudoku": SudokuGameState,
        "wordle": WordleGameState,
        "pattern": PatternMemorizationGameState,
    }[game_code]

User = get_user_model()   

# A. fire at alarm-time
@shared_task
def open_join_window(challenge_id, game_id, game_code):
    Model = _game_state_model(game_code)

    ch   = Challenge.objects.get(pk=challenge_id)
    game = Game.objects.get(pk=game_id)

    # try to reuse an existing state
    try:
        gs = Model.objects.get(challenge=ch, game=game)
    except Model.DoesNotExist:
        # otherwise create one
        if game_code == "sudoku":
            system_user = User.objects.get(username="gshin")
            gs_dict = sudoku_init(ch.id, system_user, allow_join=False)   # ← use ch.id
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

@shared_task
def apply_overdue_penalties():
    today = timezone.now().date()
    qs = Obligation.objects.filter(status__in=[ObligationStatus.UNPAID, ObligationStatus.PENDING], due_at__lt=timezone.now())
    for ob in qs:
        if ob.last_penalty_at and ob.last_penalty_at.date() >= today:
            continue
        penalised = ChallengeMembership.objects.filter(
            challengeID=ob.challenge,
            uID=ob.payer
        ).update(points=F('points') - ob.points_penalty_per_day)

        ob.last_penalty_at = timezone.now()
        ob.save(update_fields=['last_penalty_at'])

        # TODO: push notification

@shared_task
def auto_confirm_old_payments(hours=48):
    threshold = timezone.now() - timezone.timedelta(hours=hours)
    for p in Payment.objects.filter(status=PaymentStatus.PENDING,
                                    payer_marked_at__lt=threshold):
        p.confirm()