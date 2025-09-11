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
