from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
import logging
from django.db import transaction
from django.db.models import Q, Count, F, Value, Sum
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404

from api.utils.notifications import send_fcm_notification
from .models import (
    FCMDevice,
    Game,
    GamePerformance,
    ChallengeMembership,
    GameSchedule,
    GameScheduleGameAssociation,
    Challenge,
    ChallengeBet,
    Badge,
    UserBadge,
    User,
    UserNotification,
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
    # Run skill recompute after the surrounding transaction commits
    transaction.on_commit(lambda: _refresh(instance))

@receiver(post_delete, sender=GamePerformance)
def _gp_deleted(sender, instance, **kwargs):
    _refresh(instance)


# When the final expected (game, user) performance for a challenge day is recorded,
# atomically advance daysCompleted and mark isCompleted if the last day is reached.
@receiver(post_save, sender=GamePerformance)
def _gp_maybe_advance_day(sender, instance: GamePerformance, created: bool, **kwargs):
    def _after_commit():
        try:
            ch = instance.challenge
            play_date = instance.date
            if not ch.startDate:
                return

            # --- Participants and scheduled games ---
            participant_ids = list(
                ChallengeMembership.objects
                .filter(challengeID=ch)
                .values_list('uID_id', flat=True)
            )
            if not participant_ids:
                return

            dow = play_date.weekday() + 1  # Mon=1 .. Sun=7
            sched_ids = GameSchedule.objects.filter(challenge=ch, dayOfWeek=dow).values_list('id', flat=True)
            game_ids = list(
                GameScheduleGameAssociation.objects
                .filter(game_schedule_id__in=sched_ids)
                .values_list('game_id', flat=True)
            )
            played_game_ids_qs = (
                GamePerformance.objects
                .filter(challenge=ch, date=play_date)
                .values_list('game_id', flat=True)
                .distinct()
            )
            played_game_ids = [gid for gid in played_game_ids_qs if not game_ids or gid in set(game_ids)]
            if not played_game_ids:
                return

            # --- Check if all performances for the day are in ---
            expected = len(participant_ids) * len(played_game_ids)
            found = (
                GamePerformance.objects
                .filter(
                    challenge=ch,
                    date=play_date,
                    game_id__in=played_game_ids,
                    user_id__in=participant_ids,
                )
                .values('game_id', 'user_id')
                .distinct()
                .count()
            )
            if found < expected:
                return

            # --- Advance challenge progress ---
            day_index = (play_date - ch.startDate).days + 1
            if day_index < 1:
                return
            if ch.totalDays and day_index > ch.totalDays:
                day_index = ch.totalDays

            updated = Challenge.objects.filter(pk=ch.id, daysCompleted__lt=day_index).update(daysCompleted=day_index)
            if not updated:
                return

            # --- Challenge completion ---
            should_complete = (
                (ch.totalDays and day_index >= ch.totalDays)
                or (ch.endDate and play_date >= ch.endDate)
            )
            if not should_complete or ch.isCompleted:
                return

            Challenge.objects.filter(pk=ch.id, isCompleted=False).update(isCompleted=True)
            
            # --- Notifications for early finishers and non-participants (with multiplayer/singleplayer logic) ---

            # --- 1️⃣ Early Finishers ---
            # Find the last performance date overall for this challenge
            last_perf_date = (
                GamePerformance.objects
                .filter(challenge=ch)
                .aggregate(latest=Max("date"))
                ["latest"]
            )

            early_finishers = set()
            if last_perf_date:
                # Each user's last recorded performance date
                user_last_dates = (
                    GamePerformance.objects
                    .filter(challenge=ch)
                    .values("user_id")
                    .annotate(last_date=Max("date"))
                )

                for record in user_last_dates:
                    if record["last_date"] < last_perf_date:
                        early_finishers.add(record["user_id"])

            # Notify early finishers
            for user_id in early_finishers:
                user = User.objects.get(id=user_id)
                UserNotification.objects.create(
                    user=user,
                    title="Finished Early!",
                    body=f"You completed the challenge '{ch.name}' before others — great job!",
                    type="challenge_progress",
                    screen="Challenges",
                    challengeId=ch.id,
                    challName=ch.name,
                    isCompleted=True,
                    challengeMembers=ch.members,
                )
                device = FCMDevice.objects.filter(user_id=user_id).first()
                if device:
                    send_fcm_notification(
                        title="Finished Early!",
                        body=f"You completed the challenge '{ch.name}' before others — great job!",
                        data={
                            "screen": "Notifications",
                            "type": "challenge_progress",
                            "challengeId": ch.id,
                        },
                        recipient_id=user_id
                    )

            # --- 2️⃣ Identify who didn't participate in the final scheduled day ---

            # All challenge members
            all_member_ids = set(ch.members.values_list("id", flat=True))

            # Games scheduled for this weekday (same logic as above)
            dow = play_date.weekday() + 1  # Monday = 1 .. Sunday = 7
            sched_ids = GameSchedule.objects.filter(challenge=ch, dayOfWeek=dow).values_list("id", flat=True)
            scheduled_game_ids = list(
                GameScheduleGameAssociation.objects
                .filter(game_schedule_id__in=sched_ids)
                .values_list("game_id", flat=True)
            )

            # Determine if any of these scheduled games are multiplayer
            multiplayer_games = Game.objects.filter(id__in=scheduled_game_ids, isMultiplayer=True)
            is_multiplayer_day = multiplayer_games.exists()

            # Users who played (submitted performances) on final day
            participants_final_day_ids = set(
                GamePerformance.objects
                .filter(challenge=ch, date=play_date)
                .values_list("user_id", flat=True)
            )

            # --- Multiplayer logic ---
            if is_multiplayer_day:
                # Notify members who didn't join multiplayer game(s)
                non_participants_ids = all_member_ids - participants_final_day_ids

            # --- Singleplayer logic ---
            else:
                # Even if all games are singleplayer, still notify those who missed the day
                non_participants_ids = all_member_ids - participants_final_day_ids

            # Notify non-participants if any
            for user_id in non_participants_ids:
                user = User.objects.get(id=user_id)
                UserNotification.objects.create(
                    user=user,
                    title="Challenge Completed!",
                    body=(
                        f"The challenge '{ch.name}' has ended — you missed the final "
                        f"{'multiplayer' if is_multiplayer_day else 'singleplayer'} game!"
                    ),
                    type="challenge_completed",
                    screen="Challenges",
                    challengeId=ch.id,
                    challName=ch.name,
                    isCompleted=True,
                    challengeMembers=ch.members,
                )

                device = FCMDevice.objects.filter(user_id=user_id).first()
                if device:
                    send_fcm_notification(
                        title="Challenge Completed!",
                        body=(
                            f"The challenge '{ch.name}' has ended — you missed the final "
                            f"{'multiplayer' if is_multiplayer_day else 'singleplayer'} game!"
                        ),
                        data={
                            "screen": "Notifications",
                            "type": "challenge_completed",
                            "challengeId": ch.id,
                        },
                        recipient_id=user_id
                    )


            # --- Begin reward + badge logic ---
            users_with_new_badges = set()  # collect all users who earn a badge

            winner_user = ch.get_winner_user()
            if winner_user:
                Challenge.objects.filter(pk=ch.id).update(winner=winner_user)

            # --- PERSONAL CHALLENGE (solo) ---
            if ch.groupID is None and not ch.isPublic:
                lone_wolf_badge = Badge.objects.get(name="Lone Wolf")
                _, created = UserBadge.objects.get_or_create(user=winner_user, badge=lone_wolf_badge)
                if created:
                    users_with_new_badges.add(winner_user.id)

            # --- PUBLIC OR GROUP CHALLENGE ---
            else:
                reward_amount = ch.participationFee * ch.members.count()
                winner_user.numCoins += reward_amount
                winner_user.save(update_fields=["numCoins"])

                members = list(ch.members.all())

                # PUBLIC challenge
                if ch.isPublic:
                    public_champion_badge = Badge.objects.get(name="Public Champion")
                    community_member_badge = Badge.objects.get(name="Community Member")

                    _, created = UserBadge.objects.get_or_create(user=winner_user, badge=public_champion_badge)
                    if created:
                        users_with_new_badges.add(winner_user.id)

                    for member in members:
                        _, created = UserBadge.objects.get_or_create(user=member, badge=community_member_badge)
                        if created:
                            users_with_new_badges.add(member.id)

                    # Handle bets
                    bets = ChallengeBet.objects.filter(challenge=ch, isPending=False)
                    for bet in bets:
                        bet.isCompleted = True
                        initiator_points = (
                            GamePerformance.objects
                            .filter(challenge=ch, user=bet.initiator)
                            .aggregate(total_points=Sum("score"))["total_points"] or 0
                        )
                        recipient_points = (
                            GamePerformance.objects
                            .filter(challenge=ch, user=bet.recipient)
                            .aggregate(total_points=Sum("score"))["total_points"] or 0
                        )

                        loser = None
                        if initiator_points > recipient_points:
                            bet.winner = bet.initiator
                            loser = bet.recipient
                        elif recipient_points > initiator_points:
                            bet.winner = bet.recipient
                            loser = bet.initiator
                        else:
                            bet.winner = None
                        bet.save()

                        # Notify bet participants
                        if bet.winner:
                            UserNotification.objects.create(
                                user=bet.winner,
                                title="Bet Won!",
                                body=f"You won {bet.betAmount} from {loser.name or loser.username}.",
                                type="bet_result",
                                screen="Bets",
                                challengeId=bet.challenge.id,
                                challName=bet.challenge.name,
                                isCompleted=bet.challenge.isCompleted,
                                challengeMembers=bet.challenge.members,
                            )
                            device = FCMDevice.objects.filter(user=bet.winner.id).first()
                            if device:
                                send_fcm_notification(
                                    title="Bet Won!",
                                    body=f"You won {bet.betAmount} from {loser.name or loser.username}.",
                                    data={"screen": "Notifications", "type": "bet_result"},
                                    recipient_id=bet.winner.id
                                )

                            UserNotification.objects.create(
                                user=loser,
                                title="Bet Lost.",
                                body=f"You lost {bet.betAmount} to {bet.winner.name or bet.winner.username}.",
                                type="bet_result",
                                screen="Bets",
                                challengeId=bet.challenge.id,
                                challName=bet.challenge.name,
                                isCompleted=bet.challenge.isCompleted,
                                challengeMembers=bet.challenge.members,
                            )
                            device = FCMDevice.objects.filter(user=loser.id).first()
                            if device:
                                send_fcm_notification(
                                    title="Bet Lost.",
                                    body=f"You lost {bet.betAmount} to {bet.winner.name or bet.winner.username}.",
                                    data={"screen": "Notifications", "type": "bet_result"},
                                    recipient_id=loser.id
                                )
                        else:
                            for u in [bet.initiator, bet.recipient]:
                                other = bet.recipient if u == bet.initiator else bet.initiator
                                UserNotification.objects.create(
                                    user=u,
                                    title="Bet Tie",
                                    body=f"You tied with {other.name or other.username}.",
                                    type="bet_result",
                                    screen="Bets",
                                    challengeId=bet.challenge.id,
                                    challName=bet.challenge.name,
                                    isCompleted=bet.challenge.isCompleted,
                                    challengeMembers=bet.challenge.members,
                                )
                                device = FCMDevice.objects.filter(user=u.id).first()
                                if device:
                                    send_fcm_notification(
                                        title="Bet Tie",
                                        body=f"You tied with {other.name or other.username}.",
                                        data={"screen": "Notifications", "type": "bet_result"},
                                        recipient_id=u.id
                                    )

                    # First Blood badge for all bet winners
                    first_blood_badge = Badge.objects.get(name="First Blood")
                    winners = bets.filter(winner__isnull=False).values_list('winner', flat=True)
                    for user_id in winners:
                        _, created = UserBadge.objects.get_or_create(user_id=user_id, badge=first_blood_badge)
                        if created:
                            users_with_new_badges.add(user_id)

                # GROUP challenge (non-public)
                else:
                    squad_leader_badge = Badge.objects.get(name="Squad Leader")
                    team_player_badge = Badge.objects.get(name="Team Player")

                    _, created = UserBadge.objects.get_or_create(user=winner_user, badge=squad_leader_badge)
                    if created:
                        users_with_new_badges.add(winner_user.id)

                    for member in members:
                        _, created = UserBadge.objects.get_or_create(user=member, badge=team_player_badge)
                        if created:
                            users_with_new_badges.add(member.id)

                    # Bet winners
                    bets = ChallengeBet.objects.filter(challenge=ch, isPending=False)
                    for bet in bets:
                        bet.isCompleted = True
                        initiator_points = (
                            GamePerformance.objects
                            .filter(challenge=ch, user=bet.initiator)
                            .aggregate(total_points=Sum("score"))["total_points"] or 0
                        )
                        recipient_points = (
                            GamePerformance.objects
                            .filter(challenge=ch, user=bet.recipient)
                            .aggregate(total_points=Sum("score"))["total_points"] or 0
                        )
                        if initiator_points > recipient_points:
                            bet.winner = bet.initiator
                        elif recipient_points > initiator_points:
                            bet.winner = bet.recipient
                        else:
                            bet.winner = None
                        bet.save()

                    first_blood_badge = Badge.objects.get(name="First Blood")
                    winners = bets.filter(winner__isnull=False).values_list('winner', flat=True)
                    for user_id in winners:
                        _, created = UserBadge.objects.get_or_create(user_id=user_id, badge=first_blood_badge)
                        if created:
                            users_with_new_badges.add(user_id)

            # --- Send badge notifications (once per user) ---
            for user_id in users_with_new_badges:
                user = User.objects.get(id=user_id)
                UserNotification.objects.create(
                    user=user,
                    title="New Badge!",
                    body="You unlocked a new badge. Check your Badges page!",
                    type="badge_unlocked",
                    screen="Profile",
                )
                device = FCMDevice.objects.filter(user_id=user_id).first()
                if device:
                    send_fcm_notification(
                        title="New Badge!",
                        body="You unlocked a new badge. Check your Badges page!",
                        data={"screen": "Notifications", "type": "badge_unlocked"},
                        recipient_id=user_id
                    )

        except Exception:
            logging.exception("daily progress rollup (post_save) failed")

    # Run after DB commit
    transaction.on_commit(_after_commit)
