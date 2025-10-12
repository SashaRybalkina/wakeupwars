from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
import logging
from .models import (
    GamePerformance,
    ChallengeMembership,
    GameSchedule,
    GameScheduleGameAssociation,
    Challenge,
)
from .services.skill import recompute_skill_for_category

# This file wires up skill calculation to run automatically
# whenever a GamePerformance record is created updated or deleted.
def _refresh(instance: GamePerformance):
    try:
        recompute_skill_for_category(instance.user, instance.game.category)
    except Exception:
        import logging
        logging.exception("Skill recompute failed")

@receiver(post_save, sender=GamePerformance)
def _gp_saved(sender, instance, **kwargs):
    _refresh(instance)

@receiver(post_delete, sender=GamePerformance)
def _gp_deleted(sender, instance, **kwargs):
    _refresh(instance)


# When the final expected (game, user) performance for a challenge day is recorded,
# atomically advance daysCompleted and mark isCompleted if the last day is reached.
@receiver(post_save, sender=GamePerformance)
def _gp_maybe_advance_day(sender, instance: GamePerformance, created: bool, **kwargs):
    if not created:
        return  # only evaluate on newly created rows

    try:
        ch = instance.challenge
        play_date = instance.date
        if not ch.startDate:
            return

        # Participants in the challenge
        participant_ids = list(
            ChallengeMembership.objects
            .filter(challengeID=ch)
            .values_list('uID_id', flat=True)
        )
        if not participant_ids:
            return

        # Games scheduled for this weekday
        dow = play_date.weekday() + 1  # Mon=1 .. Sun=7
        sched_ids = (
            GameSchedule.objects
            .filter(challenge=ch, dayOfWeek=dow)
            .values_list('id', flat=True)
        )
        game_ids = list(
            GameScheduleGameAssociation.objects
            .filter(game_schedule_id__in=sched_ids)
            .values_list('game_id', flat=True)
        )
        if not game_ids:
            return

        # Expected vs found performances for the day
        expected = len(participant_ids) * len(game_ids)
        found = (
            GamePerformance.objects
            .filter(
                challenge=ch,
                date=play_date,
                game_id__in=game_ids,
                user_id__in=participant_ids,
            )
            .values('game_id', 'user_id')
            .distinct()
            .count()
        )
        if found < expected:
            return

        # Compute today's index and atomically raise daysCompleted
        day_index = (play_date - ch.startDate).days + 1
        if day_index < 1:
            return
        if ch.totalDays and day_index > ch.totalDays:
            day_index = ch.totalDays

        updated = (
            Challenge.objects
            .filter(pk=ch.id, daysCompleted__lt=day_index)
            .update(daysCompleted=day_index)
        )

        if updated:
            # Optionally complete the challenge if this was the last day
            should_complete = False
            if ch.totalDays and day_index >= ch.totalDays:
                should_complete = True
            elif ch.endDate and play_date >= ch.endDate:
                should_complete = True
            if should_complete and not ch.isCompleted:
                Challenge.objects.filter(pk=ch.id, isCompleted=False).update(isCompleted=True)
    except Exception:
        logging.exception("daily progress rollup (post_save) failed")