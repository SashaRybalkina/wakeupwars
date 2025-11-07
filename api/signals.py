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
            played_game_ids_qs = (
                GamePerformance.objects
                .filter(challenge=ch, date=play_date)
                .values_list('game_id', flat=True)
                .distinct()
            )
            if game_ids:
                played_game_ids = [gid for gid in played_game_ids_qs if gid in set(game_ids)]
            else:
                played_game_ids = list(played_game_ids_qs)
            if not played_game_ids:
                return

            # Expected vs found performances for the day (only games that actually have performances)
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
                    # mark challenge winner/bet winners/check for badges here

                    # mark the challenge winner (if personal, will be the single member)
                    winner_user = ch.get_winner_user()
                    print(winner_user.id)
                    if winner_user:
                        Challenge.objects.filter(pk=ch.id).update(winner=winner_user)

                    # if a personal challenge, just check the one badge
                    if ch.groupID == None and ch.isPublic == False:
                        lone_wolf_badge = Badge.objects.get(name="Lone Wolf")
                        UserBadge.objects.get_or_create(user=winner_user, badge=lone_wolf_badge)
                        
                        UserNotification.objects.create(
                            user_id=winner_user.id,
                            title="Lone Wolf Badge Unlocked!",
                            body="You unlocked the Lone Wolf badge. Check your Badges page!",
                            type="badge_unlocked",
                            screen="Profile",
                        )
                                                
                        device = FCMDevice.objects.filter(user_id=winner_user.id).first()
                        recipient_id = winner_user.id
                        if device:
                            title="Lone Wolf Badge Unlocked!",
                            body="You unlocked the Lone Wolf badge. Check your Badges page!",
                            data={
                                "screen": "Notifications",
                                "type": "badge_unlocked",
                            }
                            send_fcm_notification(title, body, data, recipient_id)

                    else:
                        # for now just give reward here
                        reward_amount = ch.participationFee * ch.members.count()
                        winner_user.numCoins += reward_amount
                        winner_user.save(update_fields=["numCoins"])

                        # check for first public challenge completion/win
                        if ch.isPublic:
                            public_champion_badge = Badge.objects.get(name="Public Champion")
                            UserBadge.objects.get_or_create(user=winner_user, badge=public_champion_badge)
                            
                            UserNotification.objects.create(
                                user_id=winner_user.id,
                                title="Public Champion Badge Unlocked!",
                                body="You unlocked the Public Champion badge. Check your Badges page!",
                                type="badge_unlocked",
                                screen="Profile",
                            )
                                                
                            device = FCMDevice.objects.filter(user_id=winner_user.id).first()
                            recipient_id = winner_user.id
                            if device:
                                title="Public Champion Badge Unlocked!",
                                body="You unlocked the Public Champion badge. Check your Badges page!",
                                data={
                                    "screen": "Notifications",
                                    "type": "badge_unlocked",
                                }
                                send_fcm_notification(title, body, data, recipient_id)

                            community_member_badge = Badge.objects.get(name="Community Member")
                            members = ch.members.all()
                            for member in members:
                                print(member)
                                UserBadge.objects.get_or_create(user=member, badge=community_member_badge)
                                
                                UserNotification.objects.create(
                                    user_id=member.id,
                                    title="Community Member Badge Unlocked!",
                                    body="You unlocked the Community Member badge. Check your Badges page!",
                                    type="badge_unlocked",
                                    screen="Profile",
                                )
                                                    
                                device = FCMDevice.objects.filter(user_id=member.id).first()
                                recipient_id = member.id
                                if device:
                                    title="Community Member Badge Unlocked!",
                                    body="You unlocked the Community Member badge. Check your Badges page!",
                                    data={
                                        "screen": "Notifications",
                                        "type": "badge_unlocked",
                                    }
                                    send_fcm_notification(title, body, data, recipient_id)

                            bets = ChallengeBet.objects.filter(challenge=ch, isPending=False)
                            for bet in bets:
                                print(bet.id)
                                bet.isCompleted = True

                                initiator_points = GamePerformance.objects.filter(
                                    challenge=ch,
                                    user=bet.initiator
                                ).aggregate(total_points=Sum("score"))["total_points"] or 0
                                print(initiator_points)

                                recipient_points = GamePerformance.objects.filter(
                                    challenge=ch,
                                    user=bet.recipient
                                ).aggregate(total_points=Sum("score"))["total_points"] or 0
                                print(recipient_points)

                                loser = None
                                    
                                if initiator_points > recipient_points:
                                    bet.winner = bet.initiator
                                    loser = bet.recipient
                                    # User.objects.filter(pk=bet.initiator.pk).update(numCoins=F('numCoins') + (2 * bet.betAmount))
                                elif recipient_points > initiator_points:
                                    bet.winner = bet.recipient
                                    loser = bet.initiator
                                    # User.objects.filter(pk=bet.recipient.pk).update(numCoins=F('numCoins') + (2 * bet.betAmount))
                                else:
                                    bet.winner = None  # tie
                                    # give the coins back to each
                                    # User.objects.filter(pk=bet.initiator.pk).update(numCoins=F('numCoins') + bet.betAmount)
                                    # User.objects.filter(pk=bet.recipient.pk).update(numCoins=F('numCoins') + bet.betAmount)
                                bet.save()
                                print(bet.winner)
                                
                                if (bet.winner):
                                    UserNotification.objects.create(
                                        user=bet.winner,
                                        title=f"Bet Won!",
                                        body=f"You won {bet.betAmount} from {loser.name or loser.username}.",
                                        type="bet_result",
                                        screen="Bets",
                                        challengeId=bet.challenge.id,
                                        challName=bet.challenge.name,
                                        isCompleted=bet.challenge.isCompleted,
                                        challengeMembers=bet.challenge.members,
                                    )
                                        
                                    device = FCMDevice.objects.filter(user=bet.winner.id).first()
                                    recipient_id = bet.winner.id
                                    if device:
                                        title=f"Bet Won!",
                                        body=f"You won {bet.betAmount} from {loser.name or loser.username}.",
                                        data={
                                            "screen": "Notifications",
                                            "type": "bet_result",
                                        }
                                        send_fcm_notification(title, body, data, recipient_id)

                                    UserNotification.objects.create(
                                        user=loser,
                                        title=f"Bet Lost.",
                                        body=f"You lost {bet.betAmount} to {bet.winner.name or bet.winner.username}.",
                                        type="bet_result",
                                        screen="Bets",
                                        challengeId=bet.challenge.id,
                                        challName=bet.challenge.name,
                                        isCompleted=bet.challenge.isCompleted,
                                        challengeMembers=bet.challenge.members,
                                    )
                                        
                                    device = FCMDevice.objects.filter(user=loser.id).first()
                                    recipient_id = loser.id
                                    if device:
                                        title=f"Bet Lost.",
                                        body=f"You lost {bet.betAmount} to {bet.winner.name or bet.winner.username}.",
                                        data={
                                            "screen": "Notifications",
                                            "type": "bet_result",
                                        }
                                        send_fcm_notification(title, body, data, recipient_id)
                            
                                else:
                                    for u in [bet.initiator, bet.recipient]:
                                        other = bet.initiator
                                        if u == bet.initiator: 
                                            other = bet.recipient
                                        UserNotification.objects.create(
                                            user=u,
                                            title=f"Bet Tie",
                                            body=f"You tied with {other.name or other.username}.",
                                            type="bet_result",
                                            screen="Bets",
                                            challengeId=bet.challenge.id,
                                            challName=bet.challenge.name,
                                            isCompleted=bet.challenge.isCompleted,
                                            challengeMembers=bet.challenge.members,
                                        )
                                            
                                        device = FCMDevice.objects.filter(user=u.id).first()
                                        recipient_id = u.id
                                        if device:
                                            title=f"Bet Tie",
                                            body=f"You tied with {other.name or other.username}.",
                                            data={
                                                "screen": "Notifications",
                                                "type": "bet_result",
                                            }
                                            send_fcm_notification(title, body, data, recipient_id)


                            # mark first blood winners
                            first_blood_badge = Badge.objects.get(name="First Blood")
                            winners = bets.filter(winner__isnull=False).values_list('winner', flat=True)
                            for user_id in winners:
                                print(user_id)
                                UserBadge.objects.get_or_create(user_id=user_id, badge=first_blood_badge)
                                
                                UserNotification.objects.create(
                                    user_id=user_id,
                                    title="First Blood Badge Unlocked!",
                                    body="You unlocked the First Blood badge. Check your Badges page!",
                                    type="badge_unlocked",
                                    screen="Profile",
                                )
                                                
                                device = FCMDevice.objects.filter(user_id=user_id).first()
                                recipient_id = user_id
                                if device:
                                    title="First Blood Badge Unlocked!",
                                    body="You unlocked the First Blood badge. Check your Badges page!",
                                    data={
                                        "screen": "Notifications",
                                        "type": "badge_unlocked",
                                    }
                                    send_fcm_notification(title, body, data, recipient_id)


                        # check for first group challenge win, and all betting badges since betting is only
                        # in group challenges
                        else:
                            squad_leader_badge = Badge.objects.get(name="Squad Leader")
                            UserBadge.objects.get_or_create(user=winner_user, badge=squad_leader_badge)
                            
                            UserNotification.objects.create(
                                user_id=winner_user.id,
                                title="Squad Leader Badge Unlocked!",
                                body="You unlocked the Squad Leader badge. Check your Badges page!",
                                type="badge_unlocked",
                                screen="Profile",
                            )
                                            
                            device = FCMDevice.objects.filter(user_id=winner_user.id).first()
                            recipient_id = winner_user.id
                            if device:
                                title="Squad Leader Badge Unlocked!",
                                body="You unlocked the Squad Leader badge. Check your Badges page!",
                                data={
                                    "screen": "Notifications",
                                    "type": "badge_unlocked",
                                }
                                send_fcm_notification(title, body, data, recipient_id)

                            team_player_badge = Badge.objects.get(name="Team Player")
                            members = ch.members.all()
                            for member in members:
                                print(member)
                                UserBadge.objects.get_or_create(user=member, badge=team_player_badge)
                                
                                UserNotification.objects.create(
                                    user_id=member.id,
                                    title="Team Player Badge Unlocked!",
                                    body="You unlocked the Team Player badge. Check your Badges page!",
                                    type="badge_unlocked",
                                    screen="Profile",
                                )
                                            
                                device = FCMDevice.objects.filter(user_id=member.id).first()
                                recipient_id = member.id
                                if device:
                                    title="Team Player Badge Unlocked!",
                                    body="You unlocked the Team Player badge. Check your Badges page!",
                                    data={
                                        "screen": "Notifications",
                                        "type": "badge_unlocked",
                                    }
                                    send_fcm_notification(title, body, data, recipient_id)

                            # mark bet winners
                            bets = ChallengeBet.objects.filter(challenge=ch, isPending=False)
                            for bet in bets:
                                print(bet.id)
                                bet.isCompleted = True

                                initiator_points = GamePerformance.objects.filter(
                                    challenge=ch,
                                    user=bet.initiator
                                ).aggregate(total_points=Sum("score"))["total_points"] or 0
                                print(initiator_points)

                                recipient_points = GamePerformance.objects.filter(
                                    challenge=ch,
                                    user=bet.recipient
                                ).aggregate(total_points=Sum("score"))["total_points"] or 0
                                print(recipient_points)

                                if initiator_points > recipient_points:
                                    bet.winner = bet.initiator
                                    # User.objects.filter(pk=bet.initiator.pk).update(numCoins=F('numCoins') + (2 * bet.betAmount))
                                elif recipient_points > initiator_points:
                                    bet.winner = bet.recipient
                                    # User.objects.filter(pk=bet.recipient.pk).update(numCoins=F('numCoins') + (2 * bet.betAmount))
                                else:
                                    bet.winner = None  # tie
                                    # give the coins back to each
                                    # User.objects.filter(pk=bet.initiator.pk).update(numCoins=F('numCoins') + bet.betAmount)
                                    # User.objects.filter(pk=bet.recipient.pk).update(numCoins=F('numCoins') + bet.betAmount)
                                bet.save()
                                print(bet.winner)

                            # mark first blood winners
                            first_blood_badge = Badge.objects.get(name="First Blood")
                            winners = bets.filter(winner__isnull=False).values_list('winner', flat=True)
                            for user_id in winners:
                                print(user_id)
                                UserBadge.objects.get_or_create(user_id=user_id, badge=first_blood_badge)
                                
                                UserNotification.objects.create(
                                    user_id=user_id,
                                    title="First Blood Badge Unlocked!",
                                    body="You unlocked the First Blood badge. Check your Badges page!",
                                    type="badge_unlocked",
                                    screen="Profile",
                                )
                                            
                                device = FCMDevice.objects.filter(user_id=user_id).first()
                                recipient_id = user_id
                                if device:
                                    title="First Blood Badge Unlocked!",
                                    body="You unlocked the First Blood badge. Check your Badges page!",
                                    data={
                                        "screen": "Notifications",
                                        "type": "badge_unlocked",
                                    }
                                    send_fcm_notification(title, body, data, recipient_id)

        except Exception:
            logging.exception("daily progress rollup (post_save) failed")

    # Defer the daily progress rollup until after commit to reduce lock scope
    transaction.on_commit(_after_commit)
