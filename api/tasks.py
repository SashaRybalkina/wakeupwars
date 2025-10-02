from django.utils import timezone
from celery import shared_task
from django.db.models import F
from .models import Obligation, Payment, PaymentStatus, ObligationStatus, ChallengeMembership

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

@shared_task
def close_joins_and_zero_no_shows():
    from django.utils import timezone
    from api.models import (SudokuGameState, PatternMemorizationGameState,
                            WordleGameState, ChallengeMembership, GamePerformance)
    from datetime import date

    now = timezone.now()
    today = timezone.localdate()

    for GS in (SudokuGameState, PatternMemorizationGameState, WordleGameState):
        for gs in GS.objects.filter(join_deadline_at__lte=now, joins_closed=False):
            participant_ids = set(
                ChallengeMembership.objects.filter(challengeID=gs.challenge).values_list("uID_id", flat=True)
            )
            existing_ids = set(
                GamePerformance.objects.filter(challenge=gs.challenge, game=gs.game, date=today).values_list("user_id", flat=True)
            )
            for uid in participant_ids - existing_ids:
                GamePerformance.objects.get_or_create(
                    challenge=gs.challenge, game=gs.game, user_id=uid, date=today,
                    defaults={"score": 0, "auto_generated": True}
                )
            gs.joins_closed = True
            gs.save(update_fields=["joins_closed"])