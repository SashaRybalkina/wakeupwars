from django.utils import timezone
from celery import shared_task
from .models import Obligation, Payment, PaymentStatus, ObligationStatus

@shared_task
def apply_overdue_penalties():
    today = timezone.now().date()
    qs = Obligation.objects.filter(status__in=[ObligationStatus.UNPAID, ObligationStatus.PENDING], due_at__lt=timezone.now())
    for ob in qs:
        if ob.last_penalty_at and ob.last_penalty_at.date() >= today:
            continue
        # TODO: subtract points from payer’s challenge points (hook into challenge scoring)
        ob.last_penalty_at = timezone.now()
        ob.save(update_fields=['last_penalty_at'])
        # TODO: push notification

@shared_task
def auto_confirm_old_payments(hours=48):
    threshold = timezone.now() - timezone.timedelta(hours=hours)
    for p in Payment.objects.filter(status=PaymentStatus.PENDING, payer_marked_at__lt=threshold):
        # auto-confirm if winner didn’t dispute
        p.confirm()
