import pytz
from rest_framework.permissions import AllowAny
from django.conf import settings
from datetime import timezone, datetime, date, timedelta
from datetime import date as date_cls, timedelta
import random
from unittest import result
from django.db.models import Sum, Count, Q, F, Prefetch
from rest_framework.views import APIView
from rest_framework.response import Response
from django.views import View
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticatedOrReadOnly, IsAuthenticated, IsAdminUser
from rest_framework import generics, permissions
from rest_framework import generics, permissions, status, viewsets, mixins
from decimal import Decimal
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import action
from rest_framework import status
from django.http import JsonResponse, HttpResponseNotAllowed
from django.db import transaction
from collections import defaultdict
from datetime import time
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.contrib.auth import authenticate, get_user_model

from api.chat_consumer import ACTIVE_CHAT_USERS
from .serializers import (UserSerializer, RegisterSerializer, GroupSerializer, UserProfileSerializer, MessageSerializer, ChallengeSummarySerializer,
                          CatSerializer, GameSerializer, FriendSerializer, FriendRequestSerializer, CreateGroupSerializer, SkillLevelSerializer,
                          RewardSettingSerializer, ExternalHandleSerializer,ObligationSerializer, CashPaymentCreateSerializer,
                          ExternalPaymentCreateSerializer, PaymentSerializer, PendingPublicChallengeSummarySerializer, PublicChallengeSummarySerializer)
from .models import (Group, UserNotification, PersonalChallengeInvite, PushToken, User, Message, Challenge, ChallengeMembership, GroupMembership, GameCategory, Game, GameSchedule,
                     AlarmSchedule, ChallengeAlarmSchedule, GameScheduleGameAssociation, Friendship, GroupMembership, FriendRequest,
                     SkillLevel, PendingGroupChallengeAvailability, GroupChallengeInvite, WordleMove, PublicChallengeConfiguration,
                     UserAvailability, PublicChallengeCategoryAssociation)
from django.http import JsonResponse
from typing     import Dict, List
from rest_framework.exceptions import ValidationError
from django.db.models import Min, Max
from datetime import datetime, time

#### Sudoku Game Imports ####
from .models import (SudokuGameState, WordleGameState, Challenge, SudokuGamePlayer, WordleGamePlayer, User, Game, GamePerformance, RewardSetting,
                     ExternalHandle, Obligation, Payment, PaymentStatus, PaymentMethod, PaymentProvider, ObligationStatus, RewardType)
from api.sudokuStuff.utils import validate_sudoku_move, get_or_create_game
from api.wordleStuff.utils import validate_wordle_move, get_or_create_game_wordle
from .serializers import ChallengeSummarySerializer
from sudoku import Sudoku
import time
from django.contrib.auth import login
from asgiref.sync import async_to_sync
import traceback
from api.services.skill import recompute_skill_for_user
from api.tasks import open_join_window

### Pattern Memorization###
from api.patternMem.utils import get_or_create_pattern_game, validate_pattern_move
from api.models import PatternMemorizationGameState

from .words_array import words

import logging
logger = logging.getLogger(__name__)

import requests

User = get_user_model()
WORD_LIST = words


class SetChallAvailabilityView(APIView):
    @transaction.atomic
    def post(self, request, user_id, chall_id):
        availability_data = request.data.get('availability', [])

        for item in availability_data:
            day = item['dayOfWeek']
            time = item['alarmTime']

            # Try to find existing availability
            existing = PendingGroupChallengeAvailability.objects.filter(
                chall_id=chall_id,
                uID_id=user_id,
                dayOfWeek=day,
                alarmTime=time
            ).first()

            if existing:
                # If availability exists, remove it
                existing.delete()
            else:
                # Otherwise, create it
                PendingGroupChallengeAvailability.objects.create(
                    chall_id=chall_id,
                    uID_id=user_id,
                    dayOfWeek=day,
                    alarmTime=time
                )

        # Mark the invite as accepted
        GroupChallengeInvite.objects.filter(
            chall_id=chall_id,
            uID_id=user_id
        ).update(accepted=1)

        # enroll in challenge if haven't already
        ChallengeMembership.objects.get_or_create(
            challengeID_id=chall_id,
            uID_id=user_id,
        )

        return Response({'status': 'availability toggled and invite accepted'})
    


class SetUserAvailabilityView(APIView):
    @transaction.atomic
    def post(self, request, user_id):
        availability_data = request.data.get('alarm_schedule', [])

        for item in availability_data:
            day = item['dayOfWeek']
            time = item['time']

            # Try to find existing availability
            existing = UserAvailability.objects.filter(
                user_id=user_id,
                dayOfWeek=day,
                alarmTime=time
            ).first()

            if existing:
                # If availability exists, remove it
                existing.delete()
            else:
                # Otherwise, create it
                UserAvailability.objects.create(
                    user_id=user_id,
                    dayOfWeek=day,
                    alarmTime=time
                )

        return Response({'status': 'availability toggled'})

    

class GetChallengeInitiatorView(APIView):
    def get(self, request, chall_id):
        challenge = get_object_or_404(Challenge, id=chall_id)
        return Response({"initiator_id": challenge.initiator_id}, status=status.HTTP_200_OK)
        

class GetAvailabilitiesView(APIView):
    def get(self, request, chall_id):
        availabilities = PendingGroupChallengeAvailability.objects.filter(
            chall_id=chall_id
        ).select_related('uID')

        availabilitiesData = [
            {
                "uID": entry.uID.id,
                "name": entry.uID.name,
                "dayOfWeek": entry.dayOfWeek,
                "alarmTime": entry.alarmTime.strftime('%H:%M'),
            }
            for entry in availabilities
        ]

        games_by_day = {}
        games_qs = (
            GameScheduleGameAssociation.objects
            .filter(game_schedule__challenge_id=chall_id)
            .select_related("game_schedule", "game")
            .order_by("game_schedule__dayOfWeek", "game_order")
        )

        for g in games_qs:
            day = g.game_schedule.dayOfWeek
            games_by_day.setdefault(day, []).append({
                "id": g.game.id,
                "name": g.game.name,
                "order": g.game_order,
            })

        schedule = []
        all_days = set(games_by_day.keys())
        for day in sorted(all_days):
            schedule.append({
                "dayOfWeek": day,
                "games": games_by_day.get(day, [])
            })


        challenge = Challenge.objects.get(id=chall_id)
        initiator_id = challenge.initiator_id

        print(schedule)
        print(initiator_id)

        return Response({
            "availabilities": availabilitiesData,
            "gameSchedule": schedule,
            "initiator_id": initiator_id,
            "start_date": challenge.startDate
        }, status=status.HTTP_200_OK)

        
    

class GetUserAvailabilityView(APIView):
    def get(self, request, user_id):
        availabilities = UserAvailability.objects.filter(
            user_id=user_id
        )

        data = [
            {
                "dayOfWeek": entry.dayOfWeek,
                "alarmTime": entry.alarmTime.strftime('%H:%M'),
            }
            for entry in availabilities
        ]

        return Response(data, status=status.HTTP_200_OK)



# # class LoginView(APIView):
# #     def post(self, request):
# #         print("Request data:", request.data)
# #         username = request.data.get('username')
# #         password = request.data.get('password')
class LoginView(APIView):
    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response({'success': True, **serializer.data})

class RegisterView(APIView):
    permission_classes = [AllowAny]
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({'success': False, 'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
        
        user = serializer.save(is_active=True)
        # Create initial SkillLevel entries
        categories = GameCategory.objects.all()
        skill_levels = [
            SkillLevel(user=user, category=category, totalEarned=0, totalPossible=0)
            for category in categories
        ]
        SkillLevel.objects.bulk_create(skill_levels)
        return Response({'success': True, **UserSerializer(user).data}, status=status.HTTP_201_CREATED)


class HelloWorldView(APIView):
    def get(self, request):
        return Response({'message': 'Hello from Django REST Framework!'})

class UserProfileView(APIView):
    def get(self, request, user_id):
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = UserProfileSerializer(user)
        return Response(serializer.data)
    

class UserMessagesView(APIView):
    def get(self, request, user_id):
        messages = Message.objects.filter(recipient_id=user_id) | Message.objects.filter(sender_id=user_id)
        messages = messages.order_by('-id')
        serializer = MessageSerializer(messages, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


# class GroupListView(APIView):
#     def get(self, request, user_id):
#         groups = Group.objects.filter()
#         serializer = GroupSerializer(groups, many=True)
#         return Response(serializer.data)

class GroupListView(APIView):
    def get(self, request, user_id):
        memberships = GroupMembership.objects.filter(uID=user_id)
        group_ids = memberships.values_list('groupID', flat=True)
        groups = Group.objects.filter(id__in=group_ids)
        serializer = GroupSerializer(groups, many=True)
        return Response(serializer.data)

class FriendListView(APIView):
    def get(self, request, user_id):
        user = get_object_or_404(User, id=user_id)  # Retrieve the User object by ID
        friendships = Friendship.objects.filter(Q(uID1=user) | Q(uID2=user))
        friend_ids = []
        for friendship in friendships:
            if friendship.uID1 == user:
                friend_ids.append(friendship.uID2.id)
            else:
                friend_ids.append(friendship.uID1.id)

        friends = User.objects.filter(id__in=friend_ids)
        serializer = FriendSerializer(friends, many=True)
        return Response(serializer.data)

class CatListView(APIView):
    def get(self, request):
        cats = GameCategory.objects.all()
        serializer = CatSerializer(cats, many=True)
        return Response(serializer.data)
    

class SomeCatsListView(APIView):
    def get(self, request):
        ids_param = request.GET.get("ids")  # e.g., "1,2,3"
        if ids_param:
            try:
                ids_list = [int(i) for i in ids_param.split(",")]
                cats = GameCategory.objects.filter(id__in=ids_list)
            except ValueError:
                return Response({"error": "Invalid ids"}, status=400)
        else:
            cats = GameCategory.objects.all()
        
        serializer = CatSerializer(cats, many=True)
        return Response(serializer.data)
    

class GameListView(APIView):
    def get(self, request, cat_id, sing_or_mult):
        print(sing_or_mult)
        isMult = True
        if sing_or_mult == "Singleplayer":
            isMult = False
        elif sing_or_mult == 'Neither':
            isMult = None
        print(isMult)
        games = Game.objects.filter(category_id=cat_id, isMultiplayer=isMult)
        serializer = GameSerializer(games, many=True)
        return Response(serializer.data)
    

class SingOrMultGameListView(APIView):
    def get(self, request, sing_or_mult):
        isMult = True
        if sing_or_mult == "Singleplayer":
            isMult = False
        games = Game.objects.filter(isMultiplayer=isMult)
        serializer = GameSerializer(games, many=True)
        return Response(serializer.data)


class GroupDetailsView(APIView):
    def get(self, request, group_id):
        try:
            group = Group.objects.get(id=group_id)
        except Group.DoesNotExist:
            return Response({'error': 'Group not found'}, status=status.HTTP_404_NOT_FOUND)

        challenges = Challenge.objects.filter(groupID=group, isPending=False)
        serializer = ChallengeSummarySerializer(challenges, many=True, context={'user': request.user})

        numeric_to_label = {1: "M", 2: "T", 3: "W", 4: "TH", 5: "F", 6: "S", 7: "SU"}
        
        enriched_challenges = []
        for chall in challenges:
            alarm_schedules = AlarmSchedule.objects.filter(
                challengealarmschedule__challenge=chall
            ).values_list("dayOfWeek", flat=True).distinct()

            days_of_week = sorted([numeric_to_label[day] for day in alarm_schedules if day in numeric_to_label])

            summary_data = next((item for item in serializer.data if item["id"] == chall.id), {})
            summary_data["daysOfWeek"] = days_of_week
            enriched_challenges.append(summary_data)

        memberships = GroupMembership.objects.filter(groupID=group)
        members = [{'id': m.uID.id, 'name': m.uID.name} for m in memberships]

        return Response({
            'id': group.id,
            'name': group.name,
            'challenges': enriched_challenges,
            'members': members
        }, status=status.HTTP_200_OK)
    


    

class GetChallengeInvitesView(APIView):
    def get(self, request, user_id, group_id):
        invites = GroupChallengeInvite.objects.filter(
            groupID_id=group_id,
            uID_id=user_id,
            accepted__in=[1, 2]
        ).select_related('chall')

        data = [
            {
                "id": invite.chall.id,
                "name": invite.chall.name,
                "startDate": invite.chall.startDate,
                "endDate": invite.chall.endDate,
                "accepted": invite.accepted
            }
            for invite in invites
        ]

        return Response({"invited_challenges": data}, status=status.HTTP_200_OK)
    

class DeclineChallengeInviteView(APIView):
    def post(self, request, user_id, chall_id):
        try:
            invite = GroupChallengeInvite.objects.get(
                uID_id=user_id,
                chall_id=chall_id
            )
            invite.accepted = 0
            invite.save()
            return Response({"message": "Invite declined successfully."}, status=status.HTTP_200_OK)

        except GroupChallengeInvite.DoesNotExist:
            return Response({"error": "Invite not found."}, status=status.HTTP_404_NOT_FOUND)
        


class JoinPublicChallengeView(APIView):
    def post(self, request, user_id):
        try:
            challenge_id = request.data.get("challenge_id")
            user_avg_skill = Decimal(request.data.get("user_average_skill_level"))

            if not challenge_id:
                return Response({"error": "challenge_id required"}, status=status.HTTP_400_BAD_REQUEST)

            # --- get challenge ---
            try:
                challenge = Challenge.objects.get(id=challenge_id)
            except Challenge.DoesNotExist:
                return Response({"error": "Challenge not found"}, status=status.HTTP_404_NOT_FOUND)

            user = User.objects.get(id=user_id)

            # --- replicate challenge alarm schedule for this user ---
            challenge_alarms = ChallengeAlarmSchedule.objects.filter(challenge=challenge)

            for cas in challenge_alarms:
                # create/find alarm schedule for this user with same day/time
                alarm, created = AlarmSchedule.objects.get_or_create(
                    uID=user,
                    dayOfWeek=cas.alarm_schedule.dayOfWeek,
                    alarmTime=cas.alarm_schedule.alarmTime,
                )

                # link user’s alarm to challenge
                ChallengeAlarmSchedule.objects.get_or_create(
                    challenge=challenge,
                    alarm_schedule=alarm
                )

            # --- add membership ---
            ChallengeMembership.objects.get_or_create(
                challengeID=challenge,
                uID=user,
                hasSetAlarms=True # TODO: change this later
            )

            challenge.isPending = False
            challenge.save()

            # --- update challenge average skill ---
            cfg = PublicChallengeConfiguration.objects.get(challenge=challenge)
            old_avg = cfg.averageSkillLevel
            print(old_avg)
            print("to")
            new_avg = (old_avg + user_avg_skill) / 2
            print(new_avg)
            cfg.averageSkillLevel = new_avg
            cfg.save()
            
                    # Build (time, game_id) pairs from schedule
            slot_tasks = set()
            for cas in ChallengeAlarmSchedule.objects.filter(challenge=challenge)\
                                                    .select_related("alarm_schedule"):
                day = cas.alarm_schedule.dayOfWeek
                t_obj = cas.alarm_schedule.alarmTime
                logger.info("Day: %s, Time: %s", day, t_obj)
                game_ids = (
                    GameScheduleGameAssociation.objects
                    .filter(game_schedule__challenge=challenge,
                            game_schedule__dayOfWeek=day)
                    .values_list("game_id", flat=True)
                )
                logger.info("Game IDs: %s", list(game_ids))
                for gid in game_ids:
                    slot_tasks.add((t_obj, gid))

            logger.info("Total slot_tasks=%d", len(slot_tasks))
            if not slot_tasks:
                return Response(
                    {"error": "No schedule found to queue tasks."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            def build_alarm_dt(ch_start, t_obj):
                # ch_start may be date or datetime
                from datetime import date as _date, datetime as _dt
                if isinstance(ch_start, _dt):
                    base_date = ch_start.date()
                else:
                    base_date = ch_start  # assume date
                dt = _dt.combine(base_date, t_obj)
                # Make aware if naive
                if timezone.is_naive(dt):
                    dt = timezone.make_aware(dt, timezone.get_current_timezone())
                return dt

            queued = 0
            for t_obj, game_id in slot_tasks:
                try:
                    alarm_dt = build_alarm_dt(challenge.startDate, t_obj)
                    logger.info("Computed alarm_dt=%s (tz=%s) for game_id=%s",
                                alarm_dt, alarm_dt.tzinfo, game_id)

                    g = Game.objects.get(id=game_id)
                    g_name = (g.name or "").lower()
                    if "sudoku" in g_name:
                        code = "sudoku"
                    elif "wordle" in g_name:
                        code = "wordle"
                    elif "pattern" in g_name:
                        code = "pattern"
                    else:
                        logger.warning("Unknown game name=%r id=%s; skipping", g.name, g.id)
                        continue

                    initiator_id = (challenge.initiator_id or user.id)
                    logger.info("Queueing open_join_window: chall=%s game_id=%s code=%s eta=%s initiator=%s",
                                challenge.id, game_id, code, alarm_dt, initiator_id)

                    open_join_window.apply_async(
                        args=[challenge.id, game_id, code, initiator_id],
                        eta=alarm_dt,
                        # Optional: dedupe
                        # taREDACTEDid=f"open-{challenge.id}-{game_id}-{t_obj.strftime('%H%M')}",
                    )
                    queued += 1
                except Exception as e:
                    logger.exception("Failed to queue slot (t=%s, game_id=%s): %s", t_obj, game_id, e)
                    raise

            return Response({
                "message": "User joined challenge successfully and marked alarm set in backend and bg task queued",
                "newAverageSkillLevel": float(new_avg)
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        

# should no longer be called
class FinalizePublicChallengeView(APIView):
    def post(self, request):
        try:
            challenge_id = request.data.get("challenge_id")

            if not challenge_id:
                return Response({"error": "challenge_id required"}, status=status.HTTP_400_BAD_REQUEST)

            challenge = Challenge.objects.get(id=challenge_id)

            # Get the alarm schedules tied to this challenge
            alarm_schedules = AlarmSchedule.objects.filter(
                challengealarmschedule__challenge=challenge
            ).order_by("dayOfWeek", "alarmTime")

            if not alarm_schedules.exists():
                return Response(
                    {"error": "No alarm schedules found for challenge"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # dayOfWeek is 1–7 (Mon–Sun)
            # --- choose earliest schedule day ≥ today that still has a future alarm ---
            from collections import defaultdict
            day_to_times: Dict[int, List[time]] = defaultdict(list)
            for a in alarm_schedules:
                day_to_times[a.dayOfWeek].append(a.alarmTime)

            scheduled_days = sorted(day_to_times.keys())

            today = timezone.localdate()
            now   = timezone.localtime().time()

            start_date: date | None = None
            for offset in range(7):                       # look one week ahead max
                cand_date = today + timedelta(days=offset)
                cand_dow  = cand_date.isoweekday()        # 1-7

                if cand_dow not in scheduled_days:
                    continue

                times_for_day = day_to_times[cand_dow]
                # If checking today, ensure at least one alarm is still in the future (now counts as valid)
                if offset == 0 and all(t < now for t in times_for_day):
                    continue

                start_date = cand_date
                break

            if start_date is None:        # fallback (shouldn’t happen)
                start_date = today

            # End date = start_date + totalDays - 1
            end_date = start_date + timedelta(days=challenge.totalDays - 1)

            # Update challenge
            challenge.isPending = False
            challenge.startDate = start_date
            challenge.endDate = end_date
            challenge.save()
            
            # TODO

            return Response(
                {
                    "message": "Challenge finalized",
                    "startDate": str(start_date),
                    "endDate": str(end_date),
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)




class AddGroupMemberView(APIView):
    @transaction.atomic
    def post(self, request, group_id):
        data = request.data
        sender_id = request.data.get("sender_id")
        recipient_id = request.data.get("recipient_id")
        try:
            friend_id = data.get("friend_id")
            if not friend_id:
                return Response({"error": "friend_id is required."}, status=status.HTTP_400_BAD_REQUEST)

            group = get_object_or_404(Group, id=group_id)
            user = get_object_or_404(User, id=friend_id)

            # Check if the membership already exists
            existing_membership = GroupMembership.objects.filter(groupID=group, uID=user).exists()
            if existing_membership:
                return Response({"message": "User is already a member of the group."}, status=status.HTTP_200_OK)

            # Create the new membership
            GroupMembership.objects.create(groupID=group, uID=user)
            
            UserNotification.objects.create(
                user=user,
                title="Added to Group",
                body=f"You have been added to the group '{group.name}'.",
                type="group_add",
                screen="Groups",
            )
            
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                f"notifications_{friend_id}",
                {
                    "type": "notification_event",
                    "title": "Group Invite",
                    "body": f"You have been invited to group {group.name}!",
                    "sender_id": sender_id,
                    "screen": "Groups",
                    "notification_type": "group_invite"
                }
            )

            return Response({"message": "User added to group successfully."}, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        

class GetHasSetAlarmsView(APIView):
    def get(self, request, chall_id, user_id):
        membership = ChallengeMembership.objects.filter(
            challengeID_id=chall_id,
            uID_id=user_id
        ).first()  # returns None if not found

        has_set_alarms = membership.hasSetAlarms if membership else False

        return Response({"hasSetAlarms": has_set_alarms}, status=status.HTTP_200_OK)



class SetUserHasSetAlarmsView(APIView):
    def post(self, request, chall_id, user_id):
        membership = get_object_or_404(
            ChallengeMembership,
            challengeID_id=chall_id,
            uID_id=user_id
        )
        membership.hasSetAlarms = True
        membership.save()
        
        challenge = get_object_or_404(Challenge, id=chall_id)
        initiator_id = (
            challenge.initiator_id
            or ChallengeMembership.objects.filter(challengeID=challenge)
                .values_list("uID_id", flat=True).first()
        )
        logger.info("Initiator ID: %s", initiator_id)
        # challenge diagnostics
        logger.info("Challenge(%s) pending=%s startDate=%r type=%s",
                    challenge.id, challenge.isPending, challenge.startDate, type(challenge.startDate).__name__)

        # Build (time, game_id) pairs from schedule
        slot_tasks = set()
        for cas in ChallengeAlarmSchedule.objects.filter(challenge=challenge)\
                                                .select_related("alarm_schedule"):
            day = cas.alarm_schedule.dayOfWeek
            t_obj = cas.alarm_schedule.alarmTime
            logger.info("Day: %s, Time: %s", day, t_obj)
            game_ids = (
                GameScheduleGameAssociation.objects
                .filter(game_schedule__challenge=challenge,
                        game_schedule__dayOfWeek=day)
                .values_list("game_id", flat=True)
            )
            logger.info("Game IDs: %s", list(game_ids))
            for gid in game_ids:
                slot_tasks.add((t_obj, gid))

        logger.info("Total slot_tasks=%d", len(slot_tasks))
        if not slot_tasks:
            return Response(
                {"error": "No schedule found to queue tasks."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        def build_alarm_dt(ch_start, t_obj):
            # ch_start may be date or datetime
            from datetime import date as _date, datetime as _dt
            if isinstance(ch_start, _dt):
                base_date = ch_start.date()
            else:
                base_date = ch_start  # assume date
            dt = _dt.combine(base_date, t_obj)
            # Make aware if naive
            if timezone.is_naive(dt):
                dt = timezone.make_aware(dt, timezone.get_current_timezone())
            return dt

        queued = 0
        for t_obj, game_id in slot_tasks:
            try:
                alarm_dt = build_alarm_dt(challenge.startDate, t_obj)
                logger.info("Computed alarm_dt=%s (tz=%s) for game_id=%s",
                            alarm_dt, alarm_dt.tzinfo, game_id)

                g = Game.objects.get(id=game_id)
                g_name = (g.name or "").lower()
                if "sudoku" in g_name:
                    code = "sudoku"
                elif "wordle" in g_name:
                    code = "wordle"
                elif "pattern" in g_name:
                    code = "pattern"
                else:
                    logger.warning("Unknown game name=%r id=%s; skipping", g.name, g.id)
                    continue

                logger.info("Queueing open_join_window: chall=%s game_id=%s code=%s eta=%s initiator=%s",
                            challenge.id, game_id, code, alarm_dt, initiator_id)

                open_join_window.apply_async(
                    args=[challenge.id, game_id, code, initiator_id],
                    eta=alarm_dt,
                    # Optional: dedupe
                    # taREDACTEDid=f"open-{challenge.id}-{game_id}-{t_obj.strftime('%H%M')}",
                )
                queued += 1
            except Exception as e:
                logger.exception("Failed to queue slot (t=%s, game_id=%s): %s", t_obj, game_id, e)
                raise

        return Response(
            {"message": "Marked alarm set in backend & background tasks queued.",
            "queued": True, "count": queued},
            status=status.HTTP_200_OK,
        )

class GetPendingPublicChallengesView(APIView):
    def get(self, request, user_id):
        challenges = Challenge.objects.filter(
            id__in=ChallengeMembership.objects.filter(uID=user_id).values_list('challengeID', flat=True),
            isPublic=True,
            isPending=True
        )

        response_data = []
        for challenge in challenges:
            serialized = PendingPublicChallengeSummarySerializer(challenge, context={'user': request.user}).data
            serialized["initiator_id"] = challenge.initiator_id
            # serialized['daysOfWeek'] = day_labels
            # serialized['totalDays'] = (challenge.endDate - challenge.startDate).days + 1

            response_data.append(serialized)

        return Response(response_data)
    


class GetPublicChallengesView(APIView):
    def get(self, request, user_id):
        challenges = Challenge.objects.filter(
            id__in=ChallengeMembership.objects.filter(uID=user_id).values_list('challengeID', flat=True),
            isPublic=True,
            isPending=False
        )

        response_data = []
        for challenge in challenges:
            serialized = PublicChallengeSummarySerializer(challenge, context={'user': request.user}).data

            response_data.append(serialized)

        return Response(response_data)



class GetMatchingChallengesView(APIView):
    def get(self, request, user_id, category_ids, sing_or_mult):
        data = request.data

        # --- validate input ---
        if sing_or_mult not in ("Singleplayer", "Multiplayer"):
            return Response({"error": "sing_or_mult must be 'Singleplayer' or 'Multiplayer'."},
                            status=status.HTTP_400_BAD_REQUEST)
        
        category_ids = [int(cid) for cid in category_ids.split(',')]

        user_availabilities = UserAvailability.objects.filter(user_id=user_id)
        print(user_availabilities)
        user_avail_by_day = {}
        for ua in user_availabilities:
            user_avail_by_day.setdefault(ua.dayOfWeek, set()).add(ua.alarmTime.strftime("%H:%M"))
            # user_avail_by_day.setdefault(ua.dayOfWeek, set()).add(ua.alarmTime)
        print(user_avail_by_day)


        # --- query candidate public pending challenges that match category & isMultiplayer ---
        is_multiplayer_flag = True if sing_or_mult == "Multiplayer" else False

        q = PublicChallengeConfiguration.objects.filter(
            isMultiplayer=is_multiplayer_flag,
            challenge__isPublic=True,
            challenge__isPending=True
        ).select_related("challenge").annotate(
            num_total_categories=Count('challenge__publicchallengecategoryassociation', distinct=True),
            num_matching_categories=Count(
                'challenge__publicchallengecategoryassociation',
                filter=Q(challenge__publicchallengecategoryassociation__category_id__in=category_ids),
                distinct=True
            )
        ).filter(
            num_total_categories=F('num_matching_categories')  # only include if all categories match
        )

        # Exclude challenges where the user is already a member
        q = q.exclude(
            challenge__challengemembership__uID_id=user_id
        )

        # Prefetch ChallengeAlarmSchedule with related AlarmSchedule and user
        q = q.prefetch_related(
            Prefetch(
                "challenge__challengealarmschedule_set",
                queryset=ChallengeAlarmSchedule.objects.select_related("alarm_schedule__uID")
                .order_by("alarm_schedule__dayOfWeek", "alarm_schedule__alarmTime"),
                to_attr="prefetched_cas"
            )
        )

        candidates = list(q)

        # for c in candidates:
        #     alarms = []
        #     if hasattr(c.challenge, "prefetched_cas"):
        #         alarms = [
        #             {
        #                 "user": cas.alarm_schedule.uID.username,
        #                 "day": cas.alarm_schedule.dayOfWeek,
        #                 "time": cas.alarm_schedule.alarmTime.strftime("%H:%M"),
        #             }
        #             for cas in c.challenge.prefetched_cas
        #         ]
            
        #     categories = GameCategory.objects.filter(
        #         publicchallengecategoryassociation__challenge=c.challenge
        #     )

        #     print({
        #         "challenge_id": c.challenge.id,
        #         "challenge_name": c.challenge.name,
        #         "categories": [cat.categoryName for cat in categories],
        #         "isMultiplayer": c.isMultiplayer,
        #         "averageSkillLevel": str(c.averageSkillLevel),
        #         "alarms": alarms,
        #     })


        # totals = SkillLevel.objects.filter(user_id=user_id, category_id__in=category_ids).aggregate(
        #     total_earned=Sum('totalEarned'),
        #     total_possible=Sum('totalPossible')
        # )
        # total_earned = Decimal(totals['total_earned'] or 0)
        # total_possible = Decimal(totals['total_possible'] or 0)
        # user_skill_value = (total_earned / total_possible * Decimal(10)) if total_possible else Decimal('0.0')

        def time_in_user_window(challenge_time, user_times):
            """
            challenge_time: datetime.time
            user_times: set of strings "HH:MM" representing the starts of 15-min slots
            """
            for ut in user_times:
                base = datetime.strptime(ut, "%H:%M").time()
                # convert to datetime for math
                base_dt = datetime.strptime(ut, "%H:%M")
                challenge_dt = datetime.strptime(challenge_time, "%H:%M")

                # user available from base_dt to base_dt + 15min
                end_dt = base_dt + timedelta(minutes=15)

                if base_dt <= challenge_dt < end_dt:
                    return True
            return False


        # Build results list
        results = []
        for cfg in candidates:
            challenge = cfg.challenge

            # collect alarm times per day for this challenge from prefetched CAS (set by prefetch)
            # note: we used to_attr='prefetched_cas' on challenge
            cas_list = getattr(challenge, "prefetched_cas", None)
            if cas_list is None:
                # fallback: query the DB (rare)
                cas_qs = ChallengeAlarmSchedule.objects.filter(challenge=challenge).select_related("alarm_schedule__uID")
            else:
                cas_qs = cas_list

            # Build map day -> set of times strings "HH:MM"
            challenge_alarms_by_day = {}
            for cas in cas_qs:
                alarm = cas.alarm_schedule
                day = alarm.dayOfWeek
                # normalize time string to HH:MM
                time_str = alarm.alarmTime.strftime("%H:%M")
                challenge_alarms_by_day.setdefault(day, set()).add(time_str)


            # require that for every day in challenge_alarms_by_day the user has at least one time matching
            matched_days = []
            required_days = sorted(challenge_alarms_by_day.keys())

            # if is_multiplayer_flag:

            # For each required day, check intersection with user_avail_by_day[day]
            all_days_match = True
            for day in required_days:
                challenge_times = challenge_alarms_by_day.get(day, set())
                user_times = user_avail_by_day.get(day, set())

                if not user_times:
                    all_days_match = False
                    break

                # Instead of strict set intersection:
                has_overlap = any(
                    time_in_user_window(ct, user_times) for ct in challenge_times
                )

                if has_overlap:
                    matched_days.append(day)
                else:
                    all_days_match = False
                    break

            if not all_days_match:
                # skip this candidate
                continue

            cat_ids = list(
                GameCategory.objects.filter(
                    publicchallengecategoryassociation__challenge=challenge
                ).values_list("id", flat=True)
            )

            totals = SkillLevel.objects.filter(user_id=user_id, category_id__in=cat_ids).aggregate(
            total_earned=Sum('totalEarned'),
            total_possible=Sum('totalPossible')
            )
            total_earned = Decimal(totals['total_earned'] or 0)
            total_possible = Decimal(totals['total_possible'] or 0)
            user_skill_value = (total_earned / total_possible * Decimal(10)) if total_possible else Decimal('0.0')

            try:
                challenge_skill = Decimal(cfg.averageSkillLevel)
            except Exception:
                challenge_skill = Decimal("0.0")

            distance = abs(user_skill_value - challenge_skill)

            # serialize challenge summary (use serializer)
            serialized = PendingPublicChallengeSummarySerializer(challenge, context={"user": request.user}).data

            results.append({
                # "id": challenge.id,
                # "name": challenge.name,        
                # "totalDays": challenge.totalDays,    # already included in serialized
                "summary": serialized,
                "userAverageSkillLevel": user_skill_value,
                "distance": float(distance),  # convert Decimal -> float for JSON
                # "averageSkillLevel": float(challenge_skill),
            })

        # sort by distance ascending (closest skill match first)
        results.sort(key=lambda r: r["distance"])

        return Response({"matches": results}, status=status.HTTP_200_OK)


        
class ChallengeListView(APIView):
    def get(self, request, user_id, which_chall):
        # print("heeere")
        # TODO: consider only fetching non-pending challenges
        if which_chall == 'Group':
            group_ids = GroupMembership.objects.filter(uID=user_id).values_list('groupID', flat=True)
            challenges = Challenge.objects.filter(groupID__in=group_ids, isPending=False)
        elif which_chall == 'Personal':
            challenges = Challenge.objects.filter(
                id__in=ChallengeMembership.objects.filter(uID=user_id).values_list('challengeID', flat=True),
                groupID=None,
                isPublic=False,
                isPending=False
            )


        # numeric_to_label = {1: "M", 2: "T", 3: "W", 4: "TH", 5: "F", 6: "S", 7: "SU"}

        response_data = []
        for challenge in challenges:
            # game_days = (
            #     GameSchedule.objects.filter(challenge=challenge)
            #     .values_list('dayOfWeek', flat=True)
            #     .distinct()
            # )
            # day_labels = [numeric_to_label[d] for d in sorted(game_days)]

            serialized = ChallengeSummarySerializer(challenge, context={'user': request.user}).data
            # serialized['daysOfWeek'] = day_labels
            # TODO: fix this
            # if challenge.startDate is not None and challenge.endDate is not None:
            #     serialized["totalDays"] = (challenge.endDate - challenge.startDate).days + 1
            # # elif challenge.startDate is None and challenge.endDate is None: # public pending
            # #     serialized["totalDays"] = challenge.totalDays
            # else:
            #     serialized["totalDays"] = None # just end date is pending collab, update later


            response_data.append(serialized)

        return Response(response_data)


class ChallengeDetailView(APIView):
    def get(self, request, chall_id):
        try:
            challenge = Challenge.objects.get(id=chall_id)
        except Challenge.DoesNotExist:
            return Response({'error': 'Challenge not found'}, status=status.HTTP_404_NOT_FOUND)

        memberships = ChallengeMembership.objects.filter(challengeID=challenge)
        members = [{'id': m.uID.id, 'name': m.uID.name} for m in memberships]

        serializer = ChallengeSummarySerializer(challenge, context={'user': request.user})
        
        # game_schedules = GameSchedule.objects.filter(challenge=challenge).values_list('dayOfWeek', flat=True).distinct()
        numeric_to_label = {1: "M", 2: "T", 3: "W", 4: "TH", 5: "F", 6: "S", 7: "SU"}
        # days_of_week = [numeric_to_label[d] for d in sorted(game_schedules)]
        alarm_schedules = AlarmSchedule.objects.filter(
            challengealarmschedule__challenge=challenge
        ).values_list("dayOfWeek", flat=True).distinct()

        days_of_week = sorted([numeric_to_label[day] for day in alarm_schedules if day in numeric_to_label])
        
        initiator_id = challenge.initiator_id

        return Response({
            **serializer.data,
            'members': members,
            # 'totalDays': (challenge.endDate - challenge.startDate).days + 1,
            'totalDays': challenge.totalDays,
            'daysOfWeek': days_of_week,
            'initiator_id': initiator_id,
            'reward_setting': RewardSettingSerializer(getattr(challenge,'reward_setting',None)).data if hasattr(challenge,'reward_setting') else None
        })
        
        
class ChallengeGameScheduleView(APIView):
    def get(self, request, chall_id):
        # Get all ChallengeAlarmSchedules linked to this challenge
        challenge_alarm_schedules = (
            ChallengeAlarmSchedule.objects
            .filter(challenge_id=chall_id)
            .select_related("alarm_schedule")
            .order_by("alarm_schedule__dayOfWeek")
        )

        result = []
        for cas in challenge_alarm_schedules:
            alarm_schedule = cas.alarm_schedule

            # Get games for this challenge & day if you still need them
            games = (
                GameScheduleGameAssociation.objects
                .filter(game_schedule__challenge_id=chall_id,
                        game_schedule__dayOfWeek=alarm_schedule.dayOfWeek)
                .order_by("game_order")
            )

            result.append({
                "dayOfWeek": alarm_schedule.dayOfWeek,
                "alarmTime": alarm_schedule.alarmTime.strftime("%H:%M"),
                "games": [
                    {
                        "name": g.game.name,
                        "order": g.game_order,
                        "screen": g.game.route or g.game.name  # fallback
                    }
                    for g in games
                ]
            })

        return Response(result, status=status.HTTP_200_OK)
    



class GetChallengeScheduleView(APIView):
    def get(self, request, chall_id):
        # Get the challenge
        try:
            challenge = Challenge.objects.get(id=chall_id)
        except Challenge.DoesNotExist:
            return Response({'error': 'Challenge not found'}, status=status.HTTP_404_NOT_FOUND)

        # Members
        memberships = ChallengeMembership.objects.filter(challengeID=challenge)
        members = [{'id': m.uID.id, 'name': m.uID.name} for m in memberships]

        # Preload ChallengeAlarmSchedules, including the user
        challenge_alarm_schedules = (
            ChallengeAlarmSchedule.objects
            .filter(challenge_id=chall_id)
            .select_related("alarm_schedule__uID")
            .order_by("alarm_schedule__dayOfWeek", "alarm_schedule__alarmTime")
        )

        # Collect games for the challenge, grouped by day
        games_by_day = {}
        games_qs = (
            GameScheduleGameAssociation.objects
            .filter(game_schedule__challenge_id=chall_id)
            .select_related("game_schedule", "game")
            .order_by("game_schedule__dayOfWeek", "game_order")
        )
        for g in games_qs:
            day = g.game_schedule.dayOfWeek
            # Prefer DB-provided route; fallback to name-based mapping
            screen = (g.game.route or '').strip()
            if not screen:
                n = (g.game.name or '').lower()
                if 'sudoku' in n:
                    screen = 'Sudoku'
                elif 'wordle' in n:
                    screen = 'Wordle'
                elif 'pattern' in n:
                    screen = 'PatternGame'
                else:
                    screen = 'ChallDetails'

            games_by_day.setdefault(day, []).append({
                "id": g.game.id,
                "name": g.game.name,
                "order": g.game_order,
                "screen": screen,
            })

        # Group alarms by day
        alarms_by_day = {}
        for cas in challenge_alarm_schedules:
            sched = cas.alarm_schedule
            day = sched.dayOfWeek
            alarms_by_day.setdefault(day, []).append({
                "userName": sched.uID.name,
                "alarmTime": sched.alarmTime.strftime("%H:%M")
            })

        # Merge games + alarms into result
        schedule = []
        all_days = set(alarms_by_day.keys()) | set(games_by_day.keys())
        for day in sorted(all_days):
            schedule.append({
                "dayOfWeek": day,
                "alarms": alarms_by_day.get(day, []),
                "games": [
                    {
                        **gm,
                        "screen": gm.get("screen") or next((Game.objects.filter(name=gm.get("name")).values_list("route", flat=True).first()), gm.get("name"))
                    } for gm in games_by_day.get(day, [])
            ]
            })

        # # TODO: fix this once update db
        # if (challenge.startDate and challenge.endDate):
        #     totDays = (challenge.endDate - challenge.startDate).days + 1
        # else:
        #     totDays = challenge.totalDays
        return Response({
            "id": challenge.id,
            "name": challenge.name,
            "groupId": challenge.groupID_id,
            "isPublic": challenge.isPublic,
            "startDate": challenge.startDate,
            "endDate": challenge.endDate,
            "totalDays": challenge.totalDays,
            "isPending": challenge.isPending,
            "members": members,
            "schedule": schedule
        }, status=status.HTTP_200_OK)
    

class GetChallengeUserScheduleView(APIView):
    def get(self, request, chall_id, user_id):
        # print("DEBUG GetChallengeUserScheduleView:", chall_id, user_id)
        # Get the challenge
        try:
            challenge = Challenge.objects.get(id=chall_id)
        except Challenge.DoesNotExist:
            return Response({'error': 'Challenge not found'}, status=status.HTTP_404_NOT_FOUND)


        alarm_schedules = (
            AlarmSchedule.objects
            .filter(
                uID_id=user_id,
                challengealarmschedule__challenge_id=chall_id
            )
            .order_by("dayOfWeek", "alarmTime")
            .values("dayOfWeek", "alarmTime")
        )

        days_list = sorted({s["dayOfWeek"] for s in alarm_schedules})

        # alarm_schedules → [{"dayOfWeek": 1, "alarmTime": "07:30:00"}, ...]
        # days_list → [1, 3, 5]


        # Collect games for the challenge, grouped by day
        games_by_day = {}
        games_qs = (
            GameScheduleGameAssociation.objects
            .filter(game_schedule__challenge_id=chall_id)
            .select_related("game_schedule", "game")
            .order_by("game_schedule__dayOfWeek", "game_order")
        )
        for g in games_qs:
            day = g.game_schedule.dayOfWeek
            # Prefer DB-provided route; fallback to name-based mapping
            screen = (g.game.route or '').strip()
            if not screen:
                n = (g.game.name or '').lower()
                if 'sudoku' in n:
                    screen = 'Sudoku'
                elif 'wordle' in n:
                    screen = 'Wordle'
                elif 'pattern' in n:
                    screen = 'PatternGame'
                else:
                    screen = 'ChallDetails'

            games_by_day.setdefault(day, []).append({
                "id": g.game.id,
                "name": g.game.name,
                "order": g.game_order,
                "screen": screen,
            })

        # Merge games + alarms into result
        schedule = []
        # all_days = set(alarms_by_day.keys()) | set(games_by_day.keys())
        for s in alarm_schedules:
            schedule.append({
                "dayOfWeek": s["dayOfWeek"],
                "alarmTime": s["alarmTime"],
                "games": games_by_day.get(s["dayOfWeek"], [])
            })


        return Response({
            "id": challenge.id,
            "name": challenge.name,
            "startDate": challenge.startDate,
            "endDate": challenge.endDate,
            "totalDays": challenge.totalDays,
            "schedule": schedule
        }, status=status.HTTP_200_OK)




class AddGameToScheduleView(APIView):
    @transaction.atomic
    def post(self, request):
        data = request.data
        try:
            # Get the schedule for this challenge/day
            game_schedule, created = GameSchedule.objects.get_or_create(
                challenge_id=data['challengeId'],
                dayOfWeek=data['dayOfWeek']
            )

            # Get the game
            game = get_object_or_404(Game, id=data['gameId'])

            # Create the association
            association = GameScheduleGameAssociation.objects.create(
                game_schedule=game_schedule,
                game=game,
                game_order=data['gameOrder']  # order passed from frontend
            )

            return Response({
                'id': association.id,
                'gameName': game.name,
                'dayOfWeek': game_schedule.dayOfWeek,
                'gameOrder': association.game_order
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)





class CreateManualGroupChallengeView(APIView):
    @transaction.atomic
    def post(self, request):
        data = request.data
        try:
            # Check for alarm conflicts
            # conflicting = []
            # for user_id in data['members']:
            #     for sched in data['alarm_schedule']:
            #         day = sched['dayOfWeek']
            #         if AlarmSchedule.objects.filter(uID_id=user_id, dayOfWeek=day).exists():
            #             user = User.objects.get(id=user_id)
            #             conflicting.append((user.username, day))

            # if conflicting:
            #     return Response({
            #         'error': 'Alarm conflict detected for group members.',
            #         'conflicts': conflicting  # Return which users and days are in conflict
            #     }, status=status.HTTP_400_BAD_REQUEST)

            # if No conflicts, continue to create challenge
            challenge = Challenge.objects.create(
                name=data['name'],
                groupID_id=data['group_id'],
                initiator_id=None,
                startDate=data['start_date'],
                endDate=data['end_date'],
                totalDays=data['total_days'],
                isPublic=False,
                isPending=False
            )

            # ─── Reward config ──────────────────────────────
            reward_data = data.get('reward')
            if reward_data:
                serializer_rs = RewardSettingSerializer(data=reward_data)
                serializer_rs.is_valid(raise_exception=True)
                RewardSetting.objects.create(
                    challenge=challenge,
                    **serializer_rs.validated_data,
                )

            # Add members
            for user_id in data['members']:
                ChallengeMembership.objects.create(
                    challengeID=challenge,
                    uID_id=user_id
                )

            # Create alarms
            for sched in data['alarm_schedule']:
                for user_id in data['members']:
                    alarm = AlarmSchedule.objects.create(
                        uID_id=user_id,
                        dayOfWeek=sched['dayOfWeek'],
                        alarmTime=sched['time']
                    )
                    ChallengeAlarmSchedule.objects.create(
                        challenge=challenge,
                        alarm_schedule=alarm
                    )

            # Game schedules
            for g_sched in data['game_schedules']:
                game_schedule = GameSchedule.objects.create(
                    challenge=challenge,
                    dayOfWeek=g_sched['dayOfWeek']
                )
                for game in g_sched['games']:
                    GameScheduleGameAssociation.objects.create(
                        game_schedule=game_schedule,
                        game_id=game['id'],
                        game_order=game['order']
                    )
                    
            # 1. build slot_tasks from DB (no duplicates)
            slot_tasks: set[tuple[datetime.time, int]] = set()

            alarms = (
                AlarmSchedule.objects
                .filter(challengealarmschedule__challenge=challenge)
                .values("dayOfWeek", "alarmTime")
            )

            for a in alarms:
                # all games scheduled for that day
                game_ids = (
                    GameScheduleGameAssociation.objects
                    .filter(game_schedule__challenge=challenge,
                            game_schedule__dayOfWeek=a["dayOfWeek"])
                    .values_list("game_id", flat=True)
                )
                for gid in game_ids:
                    slot_tasks.add((a["alarmTime"], gid))

            # 2. parse start_date once
            raw_start = data["start_date"]
            start_date = (
                datetime.strptime(raw_start, "%Y-%m-%d").date()
                if isinstance(raw_start, str) else raw_start
            )

            # 3. queue tasks
            for t_obj, game_id in slot_tasks:
                alarm_dt = timezone.make_aware(datetime.combine(start_date, t_obj))
                g_name = Game.objects.get(id=game_id).name.lower()

                if "sudoku" in g_name:
                    code = "sudoku"
                elif "wordle" in g_name:
                    code = "wordle"
                elif "pattern" in g_name:
                    code = "pattern"
                else:
                    logger.warning("unknown game %s, skipping", g_name)
                    continue

                open_join_window.apply_async(
                    args=[challenge.id, game_id, code],   # pass game_id too
                    eta=alarm_dt,
                )

            return Response({'message': 'Challenge created successfully', 'challenge_id': challenge.id}, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.exception("[ManualGroupChallenge] failed")
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)        

class CreatePublicChallengeView(APIView):
    @transaction.atomic
    def post(self, request):
        data = request.data
        print(data)
        try:
            # if No conflicts, continue to create challenge
            challenge = Challenge.objects.create(
                name=data['name'],
                groupID_id=None,
                initiator_id=data['initiator_id'],
                startDate=data['start_date'],
                endDate=data['end_date'],
                totalDays=data['total_days'],
                isPublic=True,
                isPending=True
            )

            # # ─── Reward config ──────────────────────────────
            # reward_data = data.get('reward')
            # if reward_data:
            #     serializer_rs = RewardSettingSerializer(data=reward_data)
            #     serializer_rs.is_valid(raise_exception=True)
            #     RewardSetting.objects.create(
            #         challenge=challenge,
            #         **serializer_rs.validated_data,
            #     )

            # Add membership
            ChallengeMembership.objects.create(
                challengeID=challenge,
                uID_id=data['initiator_id']
            )
            
            # Create alarms
            for sched in data['alarm_schedule']:
                alarm = AlarmSchedule.objects.create(
                    uID_id=data['initiator_id'],
                    dayOfWeek=sched['dayOfWeek'],
                    alarmTime=sched['time']
                )
                ChallengeAlarmSchedule.objects.create(
                    challenge=challenge,
                    alarm_schedule=alarm
                )

            # Game schedules
            for g_sched in data['game_schedules']:
                game_schedule = GameSchedule.objects.create(
                    challenge=challenge,
                    dayOfWeek=g_sched['dayOfWeek']
                )
                for game in g_sched['games']:
                    GameScheduleGameAssociation.objects.create(
                        game_schedule=game_schedule,
                        game_id=game['id'],
                        game_order=game['order']
                    )

            # create the public challenge configuration
            user_id = data['initiator_id']
            category_ids = data.get('category_ids', [])  # ensure it's a list

            # Aggregate sums across all selected categories for the user
            totals = SkillLevel.objects.filter(
                user_id=user_id,
                category_id__in=category_ids
            ).aggregate(
                total_earned=Sum('totalEarned'),
                total_possible=Sum('totalPossible')
            )

            total_earned = Decimal(totals['total_earned'] or 0)
            total_possible = Decimal(totals['total_possible'] or 0)

            if total_possible == 0:
                skill_level = Decimal("0.0")
            else:
                skill_level = (total_earned / total_possible) * Decimal(10)


            # --- Create PublicChallengeConfiguration ---
            PublicChallengeConfiguration.objects.create(
                challenge=challenge,
                isMultiplayer=(data['sing_or_mult'] == 'Multiplayer'),
                averageSkillLevel=skill_level
            )

            for category_id in category_ids:
                PublicChallengeCategoryAssociation.objects.create(
                    challenge=challenge,
                    category_id=category_id
                )

            return Response({'message': 'Challenge created successfully', 'challenge_id': challenge.id}, status=status.HTTP_201_CREATED)

        except Exception as e:
            print("Exception creating public challenge:")
            traceback.print_exc()
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        


class CreatePendingCollaborativeGroupChallengeView(APIView):
    @transaction.atomic
    def post(self, request):
        data = request.data
        try:
            # Check for alarm conflicts
            # conflicting = []
            # for user_id in data['members']:
            #     for sched in data['alarm_schedule']:
            #         day = sched['dayOfWeek']
            #         if AlarmSchedule.objects.filter(uID_id=user_id, dayOfWeek=day).exists():
            #             user = User.objects.get(id=user_id)
            #             conflicting.append((user.username, day))

            # if conflicting:
            #     return Response({
            #         'error': 'Alarm conflict detected for group members.',
            #         'conflicts': conflicting  # Return which users and days are in conflict
            #     }, status=status.HTTP_400_BAD_REQUEST)

            # if No conflicts, continue to create challenge

            try:
                challenge = Challenge.objects.create(
                    name=data['name'],
                    groupID_id=data['group_id'],
                    initiator_id=data['initiator_id'],
                    startDate=data['start_date'],
                    endDate=data['end_date'],
                    totalDays=data['total_days'],
                    isPublic=False,
                    isPending=True,
                )
            except Exception as e:
                print("Failed to create Challenge:", e)
                raise


            # # ─── Reward config ──────────────────────────────
            # reward_data = data.get('reward')
            # if reward_data:
            #     serializer_rs = RewardSettingSerializer(data=reward_data)
            #     serializer_rs.is_valid(raise_exception=True)
            #     RewardSetting.objects.create(
            #         challenge=challenge,
            #         **serializer_rs.validated_data,
            #     )


            # Add inititor membership
            ChallengeMembership.objects.create(
                challengeID=challenge,
                uID_id=data['initiator_id']
            )



            # Add availability entries for the initiator
            alarm_schedule = data.get('alarm_schedule', [])
            print(data.get('alarm_schedule', []))
            availability_entries = [
                PendingGroupChallengeAvailability(
                    chall=challenge,
                    uID_id=data['initiator_id'],
                    dayOfWeek=entry['dayOfWeek'],
                    alarmTime=datetime.strptime(entry['time'], "%H:%M").time()
                )
                for entry in alarm_schedule
            ]
            PendingGroupChallengeAvailability.objects.bulk_create(availability_entries)
            print("here2")


            # Game schedules
            for g_sched in data['game_schedules']:
                game_schedule = GameSchedule.objects.create(
                    challenge=challenge,
                    dayOfWeek=g_sched['dayOfWeek']
                )
                for game in g_sched['games']:
                    GameScheduleGameAssociation.objects.create(
                        game_schedule=game_schedule,
                        game_id=game['id'],
                        game_order=game['order']
                    )

            # create invites for everyone (accepted = 2 means neither accepted nor declined, 1 
            # means accepted, 0 means declined)
            group_members = GroupMembership.objects.filter(groupID_id=data['group_id'])

            invites = [
                GroupChallengeInvite(
                    groupID_id=data['group_id'],
                    chall=challenge,
                    uID=member.uID,
                    accepted=1 if member.uID_id == data['initiator_id'] else 2
                ) for member in group_members
            ]
            GroupChallengeInvite.objects.bulk_create(invites)
            print("here3")

            return Response({"success": True, "challenge_id": challenge.id}, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        

class FinalizeCollaborativeGroupChallengeScheduleView(APIView):
    def post(self, request, chall_id):
        # Get the Challenge object or 404
        challenge = get_object_or_404(Challenge, id=chall_id)

        # Fetch all availability for this challenge
        availabilities = PendingGroupChallengeAvailability.objects.filter(
            chall=challenge
        ).select_related("uID")

        if not availabilities.exists():
            return Response(
                {"error": "No availabilities found for this challenge."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get unique users involved
        users_in_challenge = set(avail.uID for avail in availabilities)
        num_users = len(users_in_challenge)

        # Organize availability by day
        by_day = defaultdict(list)  # {day: [(User, time), ...]}
        for avail in availabilities:
            by_day[avail.dayOfWeek].append((avail.uID, avail.alarmTime))

        # Keep only days where every user has availability
        # valid_days = {
        #     day: times for day, times in by_day.items() if len(times) == num_users
        # }
        valid_days = {
            day: times
            for day, times in by_day.items()
            if len({user for user, _ in times}) == num_users
        }


        def time_to_minutes(t):
            return t.hour * 60 + t.minute

        def minutes_to_time(m):
            return (datetime.min + timedelta(minutes=m)).time()

        def heuristic_assignment(user_times):
            """
            If users don't all share a common time, assign each user
            the available time closest to the global median.
            """
            all_times = sorted(t for times in user_times.values() for t in times)
            median_time = all_times[len(all_times) // 2]

            assignment = {}
            for user, times in user_times.items():
                assignment[user] = min(times, key=lambda t: abs(t - median_time))
            print(assignment)
            return assignment

        final_schedule = defaultdict(list)  # {day: [(User, minutes), ...]}
        day_game_type_mapping = defaultdict(list)  # {day: multiplayer/singleplayer, ...}

        for day, entries in valid_days.items():
            # group times per user
            user_times = defaultdict(set)
            for user, t in entries:
                user_times[user].add(time_to_minutes(t))

            # check if there is at least one common available time
            common_times = set.intersection(*user_times.values())

            if common_times:
                day_game_type_mapping[day] = 0 # 0 for multiplayer, 1 for singleplayer
                # pick the earliest shared time
                chosen_time = min(common_times)
                for user in users_in_challenge:
                    final_schedule[day].append((user, chosen_time))
            else:
                day_game_type_mapping[day] = 1
                # assign each user the time closest to the group’s median
                user_assignments = heuristic_assignment(user_times)
                for user, minutes in user_assignments.items():
                    final_schedule[day].append((user, minutes))
        
        print(final_schedule)

        default_to_multiplayer = {43: 10, 44: 12, 45: 30}
        default_to_singleplayer = {43: 9, 44: 11, 45: 32}

        # Persist everything atomically
        try:
            with transaction.atomic():
                # create the game schedule
                # on days where everyone is waking up at same time, choose multiplayer version of the
                # chosen game, otherwise singleplayer
                for day, singOrMult in day_game_type_mapping.items():
                    gsgas = GameScheduleGameAssociation.objects.filter(
                        game_schedule__challenge_id=chall_id,
                        game_schedule__dayOfWeek=day
                    )
                    for gsga in gsgas:
                        if singOrMult == 0: # if multiplayer
                            newGame = get_object_or_404(Game, id=default_to_multiplayer[gsga.game.id])
                        else:
                            newGame = get_object_or_404(Game, id=default_to_singleplayer[gsga.game.id])
                        gsga.game = newGame
                        gsga.save(update_fields=["game"])


                created_schedules = []
                for day, user_time_pairs in final_schedule.items():
                    for user, minutes in user_time_pairs:
                        alarm_time = minutes_to_time(minutes)
                        alarm, _ = AlarmSchedule.objects.get_or_create(
                            uID=user,
                            dayOfWeek=day,
                            alarmTime=alarm_time,
                        )
                        ChallengeAlarmSchedule.objects.get_or_create(
                            challenge=challenge, alarm_schedule=alarm
                        )
                        created_schedules.append(
                            {
                                "user": user.username,
                                "day": day,
                                "time": alarm_time.strftime("%H:%M"),
                            }
                        )


                challenge.isPending = False
                challenge.save(update_fields=["isPending"]) 
                # delete all invites
                GroupChallengeInvite.objects.filter(chall=challenge).delete()


            return Response(
                {"message": "Challenge schedule finalized.", "schedule": created_schedules},
                status=status.HTTP_201_CREATED,
            )

        except Exception as e:
            return Response(
                {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
     

class SendNotificationView(APIView):
    def post(self, request):
        user_id = request.data.get("user_id")
        title = request.data.get("title", "New Notification")
        body = request.data.get("body", "")
        ttype = request.data.get("type", "")
        screen = request.data.get("screen", "Messages")
        challengeId = request.data.get("challengeId")
        challName = request.data.get("challName")
        whichChall = request.data.get("whichChall")

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        # Save to DB
        notification = UserNotification.objects.create(
            user=user,
            title=title,
            body=body,
            type=ttype,
            screen=screen,
            challengeId=challengeId,
            challName=challName,
            whichChall=whichChall,
        )

        # Send push notification
        send_expo_push_notification(
            user,
            title=title,
            body=body,
            data={"notification_id": notification.id}
        )

        return Response(
            {"success": True, "notification_id": notification.id},
            status=status.HTTP_201_CREATED
        )
        

from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

class SendFriendRequestView(APIView):
    def post(self, request):
        sender_id = request.data.get("sender_id")
        recipient_id = request.data.get("recipient_id")

        if sender_id == recipient_id:
            return Response({'error': 'You cannot send a friend request to yourself'}, status=status.HTTP_400_BAD_REQUEST)

        if FriendRequest.objects.filter(sender_id=sender_id, recipient_id=recipient_id).exists():
            return Response({'error': 'Friend request already sent'}, status=status.HTTP_400_BAD_REQUEST)

        FriendRequest.objects.create(sender_id=sender_id, recipient_id=recipient_id)
        sender = User.objects.get(id=sender_id)
        recipient = User.objects.get(id=recipient_id)

        # Save notification to DB
        UserNotification.objects.create(
            user=recipient,
            title="Friend Request",
            body=f"{sender.name or sender.username} sent you a friend request.",
            type="friend_request",
            screen="FriendsRequests",
        )

        # Send notification via WebSocket
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"notifications_{recipient_id}",
            {
                "type": "notification_event",
                "title": "Friend Request",
                "body": f"{sender.name or sender.username} sent you a friend request!",
                "sender_id": sender_id,
                "screen": "FriendsRequests",
                "notification_type": "friend_request"
            }
        )

        return Response({'message': 'Friend request sent successfully'}, status=status.HTTP_201_CREATED)


class FriendRequestListView(APIView):
    def get(self, request, user_id):
        requests = FriendRequest.objects.filter(recipient_id=user_id).select_related('sender')
        serializer = FriendRequestSerializer(requests, many=True)
        return Response(serializer.data)


class SentFriendRequestListView(APIView):
    def get(self, request, user_id):
        requests = FriendRequest.objects.filter(sender_id=user_id)
        serializer = FriendRequestSerializer(requests, many=True)
        return Response(serializer.data)


class RespondToFriendRequestView(APIView):
    def post(self, request, request_id):
        accept = request.data.get("accept")
        try:
            fr = FriendRequest.objects.get(id=request_id)
        except FriendRequest.DoesNotExist:
            return Response({'error': 'Friend request not found'}, status=status.HTTP_404_NOT_FOUND)

        if accept:
            # Add friendship both ways
            Friendship.objects.create(uID1=fr.sender, uID2=fr.recipient)
        fr.delete()
        return Response({'message': 'Friend request processed'}, status=status.HTTP_200_OK)


class AllUsersView(APIView):
    def get(self, request):
        users = User.objects.all()
        serializer = UserSerializer(users, many=True)
        return Response(serializer.data)


class CancelFriendRequestView(APIView):
    def delete(self, request, request_id):
        try:
            fr = FriendRequest.objects.get(id=request_id)
        except FriendRequest.DoesNotExist:
            return Response({'error': 'Friend request not found'}, status=status.HTTP_404_NOT_FOUND)

        fr.delete()
        return Response({'message': 'Friend request cancelled'}, status=status.HTTP_200_OK)


class CreateGroupView(APIView):
    def post(self, request):
        serializer = CreateGroupSerializer(data=request.data)
        if serializer.is_valid():
            name = serializer.validated_data['name']
            raw_ids = serializer.validated_data['members']

            member_ids = {mid for mid in raw_ids if mid is not None}

            if request.user and request.user.id:
                member_ids.add(request.user.id)

            group = Group.objects.create(name=name)

            # Only get users that actually exist
            users = User.objects.filter(id__in=member_ids)

            for user in users:
                GroupMembership.objects.create(groupID=group, uID=user)

            return Response({'message': 'Group created successfully', 'group_id': group.id}, status=201)

        else:
            return Response(serializer.errors, status=400)

    
################### Sudoku Game ###################

class CreateSudokuGameView(APIView):
    """
    Called when a player wants to start or join a Sudoku game for a challenge.
    
    Request:
      - challenge_id: ID of the challenge (int)

    Response:
      - game_state_id: ID of the SudokuGameState
      - puzzle: current puzzle grid (2D list)
      - is_multiplayer: true if it's a multiplayer game
    """

    def post(self, request):
        challenge_id = request.data.get('challenge_id')
        user = request.user

        if not challenge_id:
            return Response({'error': 'Missing challenge_id'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            Challenge.objects.get(id=challenge_id)
        except Challenge.DoesNotExist:
            return Response({'error': 'Challenge not found'}, status=status.HTTP_404_NOT_FOUND)

        game_data = get_or_create_game(challenge_id, user)

        # Add game id so that inside the db, they are unique (Right now they're all just 'sudoku')
        try:
            state_id = game_data.get("game_state_id")
            if state_id:
                state = SudokuGameState.objects.get(id=state_id)
                game_data["game_id"] = state.game_id  # make game_id explicit
        except SudokuGameState.DoesNotExist:
            pass

        return Response(game_data, status=status.HTTP_200_OK)


class ValidateSudokuMoveView(APIView):
    def post(self, request):
        game_id = request.data.get('game_state_id')
        index = request.data.get('index')
        value = request.data.get('value')
        user = request.user

        if game_id is None or index is None or value is None:
            return Response({'error': 'Missing parameters'}, status=400)

        try:
            game_state = SudokuGameState.objects.get(id=game_id)
        except SudokuGameState.DoesNotExist:
            return Response({'error': 'Game not found'}, status=404)

        # result = validate_sudoku_move(game_state, user, index, value)
        result = async_to_sync(validate_sudoku_move)(game_state.id, user, index, value)

        if result['is_correct']:
            return Response({
                'success': True,
                'result': 'correct',
                'puzzle': game_state.puzzle,
                'completed': result.get('is_complete', False)
            }, status=200)
        else:
            return Response({
                'success': False,
                'result': 'incorrect',
                'puzzle': game_state.puzzle
            }, status=200)


class CreatePersonalChallengeView(APIView):
    @transaction.atomic
    def post(self, request):
        data = request.data
        try:
            user_id = data.get("userId")
            name = data.get("name")
            start_date = data.get("start_date")
            end_date = data.get("end_date")
            total_days = data.get("total_days")
            alarm_schedule = data.get("alarm_schedule")
            game_schedules = data.get("game_schedules")

            if not user_id or not name or not end_date or not start_date or not total_days or not alarm_schedule or not game_schedules:
                return Response({'error': 'Missing required fields.'}, status=status.HTTP_400_BAD_REQUEST)
            
            # def get_next_alarm_date(alarm_schedule):
            #     if not alarm_schedule:
            #         return None

            #     today = date.today()

            #     # convert all days to integers
            #     alarm_days = [sched['dayOfWeek'] for sched in alarm_schedule]

            #     for offset in range(0, 7):
            #         candidate = today + timedelta(days=offset)
            #         candidate_day = candidate.isoweekday()
            #         if candidate_day in alarm_days:
            #             return candidate

            #     return None 

            # start_date = get_next_alarm_date(alarm_schedule)
            # end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
            # total_days = (end_date - start_date).days + 1
            challenge = Challenge.objects.create(
                name=name,
                groupID=None,
                isPublic=False,
                isPending=False,
                startDate=start_date,
                endDate=end_date,
                totalDays=total_days
            )

            ChallengeMembership.objects.create(challengeID=challenge, uID_id=user_id, hasSetAlarms=True)

            # Create alarms
            for sched in data['alarm_schedule']:
                alarm = AlarmSchedule.objects.create(
                    uID_id=user_id,
                    dayOfWeek=sched['dayOfWeek'],
                    alarmTime=sched['time']
                )
                ChallengeAlarmSchedule.objects.create(
                    challenge=challenge,
                    alarm_schedule=alarm
                )

            # Game schedules
            for g_sched in data['game_schedules']:
                game_schedule = GameSchedule.objects.create(
                    challenge=challenge,
                    dayOfWeek=g_sched['dayOfWeek']
                )
                for game in g_sched['games']:
                    GameScheduleGameAssociation.objects.create(
                        game_schedule=game_schedule,
                        game_id=game['id'],
                        game_order=game['order']
                    )

            # print(challenge.isCompleted)
            return Response({'message': 'Personal challenge created successfully', 'challenge_id': challenge.id}, status=status.HTTP_201_CREATED)

        except Exception as e:
            traceback.print_exc()
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


### Pattern Memorization ###
class CreatePatternGameView(APIView):
    def post(self, request):
        """
        Create (or reuse) a pattern game for a challenge, and ensure the user joins it.
        Request:  { "challenge_id": <int> }
        Response: { success, game_state_id, current_round, max_rounds, is_multiplayer, pattern_sequence? }
        """
        challenge_id = request.data.get('challenge_id')
        user = request.user

        if not challenge_id:
            return Response({'success': False, 'error': 'Missing challenge_id'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            Challenge.objects.get(id=challenge_id)
        except Challenge.DoesNotExist:
            return Response({'success': False, 'error': 'Challenge not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            payload = get_or_create_pattern_game(int(challenge_id), user)
            # utils returns: game_state_id, pattern_sequence, current_round, max_rounds, is_multiplayer
            return Response({
                "success": True,
                "game_state_id": payload.get("game_state_id"),
                "current_round": payload.get("current_round", 1),
                "max_rounds": payload.get("max_rounds", 5),
                "is_multiplayer": payload.get("is_multiplayer", True),
                # expose for debug;
                "pattern_sequence": payload.get("pattern_sequence", []),
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'success': False, 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ValidatePatternMoveView(APIView):
    ## AI was used to help generate this class
    def post(self, request):
        """
        Validate a player's move. Strict global sync policy.
        Request:  { "game_state_id": <int>, "round_number": <int>, "player_sequence": <list[str]> }
        Response (correct):
        { success: true,  result: "correct",   round_score, is_complete, scores?, current_round }
        Response (incorrect):
        { success: false, result: "incorrect", round_score, is_complete, current_round }
        """
        game_state_id = request.data.get('game_state_id')
        round_number  = request.data.get('round_number')
        player_seq    = request.data.get('player_sequence') or []
        user = request.user

        if game_state_id is None or round_number is None:
            return Response({'success': False, 'error': 'Missing parameters'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            game_state_id = int(game_state_id)
            round_number = int(round_number)
        except ValueError:
            return Response({'success': False, 'error': 'Invalid ID or round number format'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Run core validation (atomic inside utils)
            result = async_to_sync(validate_pattern_move)(game_state_id, user, round_number, player_seq)
        except Exception as e:
            return Response({'success': False, 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Map known error cases from utils
        if result.get("error"):
            return Response({'success': False, 'error': result["error"]}, status=status.HTTP_400_BAD_REQUEST)

        # Fetch latest current_round after the move (utils may advance it)
        try:
            gs = PatternMemorizationGameState.objects.get(id=game_state_id)
            current_round = gs.current_round
        except PatternMemorizationGameState.DoesNotExist:
            current_round = None

        # Build unified payload consistent with utils keys
        payload = {
            "round_score": result.get("round_score", 0),
            "is_complete": result.get("is_complete", False),
            "current_round": current_round,   # helpful for frontend flow
        }
        if "scores" in result and result["scores"] is not None:
            payload["scores"] = result["scores"]

        if result.get("is_correct"):
            return Response({"success": True, "result": "correct", **payload}, status=status.HTTP_200_OK)
        else:
            return Response({"success": False, "result": "incorrect", **payload}, status=status.HTTP_200_OK)


############ Wordle Game ##############

class CreateWordleGameView(APIView):
    """
    Called when a player wants to start or join a Wordle game for a challenge.

    Request:
      - challenge_id: ID of the challenge (int)

    Response:
      - game_state_id: ID of the WordleGameState
      - puzzle: initial puzzle (underscores for hidden letters)
      - is_multiplayer: true if it's a multiplayer game
      - answer: only for debugging (⚠️ must not be returned in production multiplayer)
    """

    def post(self, request):
        challenge_id = request.data.get("challenge_id")
        user = request.user

        if not challenge_id:
            return Response({"error": "Missing challenge_id"}, status=status.HTTP_400_BAD_REQUEST)

        # Ensure the challenge exists
        try:
            Challenge.objects.get(id=challenge_id)
        except Challenge.DoesNotExist:
            return Response({"error": "Challenge not found"}, status=status.HTTP_404_NOT_FOUND)

        # Use utils to create or get a Wordle game state
        game_data = get_or_create_game_wordle(challenge_id, user)

        return Response(game_data, status=status.HTTP_200_OK)

class ValidateWordleMoveView(APIView):
    """
    Called whenever a player submits a guess.

    Request:
      - game_state_id: ID of the WordleGameState
      - row: which row attempt (0–MAX_ATTEMPTS-1)
      - guess: guessed word

    Response:
      - feedback: list of {letter, result} (result can be 'correct', 'present', 'absent')
      - is_correct: True if the guess exactly matches the solution
      - is_complete: True if the game ended (win or attempts exhausted)
      - score_awarded: integer score for this move
      - scores: leaderboard list for all players in the game
    """

    def post(self, request):
        game_id = request.data.get("game_state_id")
        row = request.data.get("row")
        guess = request.data.get("guess")
        user = request.user

        if game_id is None or row is None or guess is None:
            return Response({"error": "Missing parameters"}, status=status.HTTP_400_BAD_REQUEST)

        # Ensure the game state exists
        try:
            WordleGameState.objects.get(id=game_id)
        except WordleGameState.DoesNotExist:
            return Response({"error": "Game not found"}, status=status.HTTP_404_NOT_FOUND)

        # Call utils to validate the move and update state
        # result = async_to_sync(validate_wordle_move)(game_id, user, guess, row)
        result = validate_wordle_move(game_id, user, guess, row)

        return Response(result, status=status.HTTP_200_OK)

class ValidateSudokuMoveView(APIView):
    def post(self, request):
        game_id = request.data.get('game_state_id')
        index = request.data.get('index')
        value = request.data.get('value')
        user = request.user

        if game_id is None or index is None or value is None:
            return Response({'error': 'Missing parameters'}, status=400)

        try:
            game_state = SudokuGameState.objects.get(id=game_id)
        except SudokuGameState.DoesNotExist:
            return Response({'error': 'Game not found'}, status=404)

        # result = validate_sudoku_move(game_state, user, index, value)
        result = async_to_sync(validate_sudoku_move)(game_state.id, user, index, value)

        if result['is_correct']:
            return Response({
                'success': True,
                'result': 'correct',
                'puzzle': game_state.puzzle,
                'completed': result.get('is_complete', False)
            }, status=200)
        else:
            return Response({
                'success': False,
                'result': 'incorrect',
                'puzzle': game_state.puzzle
            }, status=200)





# AI was used to help generate this class


class ChallengeLeaderboardView(APIView):
    """
    GET /challenge-leaderboard/<chall_id>/
      -> overall leaderboard for start..min(endDate,today)
    GET /challenge-leaderboard/<chall_id>/?history=7
      -> adds daily history for last N days in same window
    """
    def get(self, request, chall_id):
        challenge = get_object_or_404(Challenge, id=chall_id)

        # Window: challenge start .. min(challenge end, LOCAL today)
        since = challenge.startDate or timezone.localdate()
        until = min(challenge.endDate, timezone.localdate())

        bounds = (GamePerformance.objects
                  .filter(challenge=challenge)
                  .aggregate(min_d=Min('date'), max_d=Max('date')))

        if bounds['min_d'] and bounds['min_d'] < since:
            since = bounds['min_d']
        if bounds['max_d'] and bounds['max_d'] > until:
            until = bounds['max_d']

        rows = (GamePerformance.objects
                .filter(challenge=challenge, date__gte=since, date__lte=until)
                .values("user__username")
                .annotate(points=Sum("score"))
                .order_by("-points", "user__username"))

        overall, last_pts, rank = [], None, 0
        for r in rows:
            if r["points"] != last_pts:
                rank += 1
                last_pts = r["points"]
            overall.append({
                "name":   r["user__username"] or "Anonymous",
                "points": int(r["points"] or 0),
                "rank":   rank,
            })

        payload = {
            "since": str(since),
            "until": str(until),
            "leaderboard": overall,
        }

        # -------- optional daily history --------
        try:
            n_days = int(request.GET.get("history", 0))
        except ValueError:
            n_days = 0

        if n_days > 0:
            end_day   = until
            start_day = max(since, end_day - timedelta(days=n_days-1))
            daily_qs = (
                GamePerformance.objects
                .filter(challenge=challenge, date__gte=start_day, date__lte=end_day)
                .values("date", "user__username")
                .annotate(points=Sum("score"))
                .order_by("date", "-points", "user__username")
            )

            grouped = defaultdict(list)
            for r in daily_qs:
                grouped[r["date"]].append(r)

            history = {}
            for i in range(n_days):
                d = start_day + timedelta(days=i)
                rows_d, last_pts, rank = grouped.get(d, []), None, 0
                out = []
                for r in rows_d:
                    if r["points"] != last_pts:
                        rank += 1
                        last_pts = r["points"]
                    out.append({
                        "name":   r["user__username"] or "Anonymous",
                        "points": int(r["points"] or 0),
                        "rank":   rank,
                    })
                history[str(d)] = out

            payload["history"] = history

        return Response(payload, status=status.HTTP_200_OK)
    

class GetPerformancesView(APIView):
    def get(self, request, chall_id):
        performances = (
            GamePerformance.objects
            .filter(challenge_id=chall_id)
            .annotate(game_name=F('game__name'))   # ✅ give it a unique alias
            .values('date', 'game_name', 'score')  # ✅ now use that alias in .values()
            .order_by('-date')[:5]
        )

        print(list(performances))
        return Response(list(performances))
    

# AI generated
class SubmitGameScoresView(APIView):
    """
    POST /submit-game-scores/
    Body: { challenge_id, game_name|game_id, date?, scores: [{username|user_id, score}] }
    """
    def post(self, request):
        data = request.data
        logger.debug(f"[SubmitGameScores] incoming data={data}")

        challenge_id = data.get("challenge_id")
        game_id = data.get("game_id")
        game_name = data.get("game_name")
        scores = data.get("scores", [])
        date_str = data.get("date")  # 'YYYY-MM-DD' or null

        if not challenge_id or not scores or not (game_id or game_name):
            return Response({"detail": "Missing required fields."}, status=status.HTTP_400_BAD_REQUEST)

        challenge = get_object_or_404(Challenge, id=challenge_id)

        if getattr(challenge, "isPending", False):
            return Response({"detail": "Challenge not active yet."}, status=status.HTTP_400_BAD_REQUEST)

        game = get_object_or_404(Game, id=game_id) if game_id else (
            Game.objects.filter(name=game_name).order_by('id').first()
        )
        if not game:
            return Response({"detail": "Unknown game_name"}, status=400)

        # Use local date to avoid UTC “today” mismatch
        play_date = date_cls.fromisoformat(date_str) if date_str else timezone.localdate()

        created_or_updated = 0
        submitted_ids: set[int] = set()

        with transaction.atomic():
            # 1) upsert submitted scores
            for row in scores:
                if "user_id" in row:
                    user = get_object_or_404(User, id=row["user_id"])
                elif "username" in row:
                    user = get_object_or_404(User, username=row["username"])
                else:
                    return Response({"detail": "Each score needs username or user_id."}, status=400)

                sc = int(row.get("score", 0))
                obj, created = GamePerformance.objects.update_or_create(
                    challenge=challenge, game=game, user=user, date=play_date,
                    defaults={"score": sc}
                )
                submitted_ids.add(user.id)
                created_or_updated += 1

            # 2) zero-fill for missing members
            participant_ids = set(
                ChallengeMembership.objects
                .filter(challengeID=challenge)
                .values_list('uID_id', flat=True)
            )
            missing_ids = participant_ids - submitted_ids

            for uid in missing_ids:
                u = User.objects.get(id=uid)
                _, created = GamePerformance.objects.update_or_create(
                    challenge=challenge, game=game, user=u, date=play_date,
                    defaults={"score": 0, "auto_generated": True}
                )
                if created:
                    created_or_updated += 1
        return Response({"ok": True, "count": created_or_updated}, status=200)

class ChallengeUpdateView(generics.UpdateAPIView):
    queryset = Challenge.objects.all()

    serializer_class = ChallengeSummarySerializer      # use the one you have
    permission_classes = [permissions.IsAdminUser]

class ChallengeDailyHistoryView(APIView):
    def get(self, request, chall_id):
        challenge = get_object_or_404(Challenge, id=chall_id)

        def parse(d: str) -> date:
            try:
                return datetime.strptime(d, "%Y-%m-%d").date()
            except ValueError:
                raise ValidationError(f"Bad date: {d!r} (YYYY-MM-DD expected)")

        # --- requested range (allow single-param) ---
        start_str = request.GET.get("start")
        end_str   = request.GET.get("end")
        if start_str and not end_str:
            end_str = start_str
        if end_str and not start_str:
            start_str = end_str

        if start_str:
            req_start = parse(start_str)
            req_end   = parse(end_str)
        else:
            req_start = challenge.startDate or timezone.localdate()
            req_end   = min(challenge.endDate, timezone.localdate())

        # --- base window = challenge window vs. "today" ---
        base_start = challenge.startDate or timezone.localdate()
        base_end   = min(challenge.endDate, timezone.localdate())

        # (optional) widen to actual score dates so accidental early/late rows still show
        bounds = (GamePerformance.objects
                  .filter(challenge=challenge)
                  .aggregate(min_d=Min('date'), max_d=Max('date')))
        if bounds['min_d'] and bounds['min_d'] < base_start:
            base_start = bounds['min_d']
        if bounds['max_d'] and bounds['max_d'] > base_end:
            base_end = bounds['max_d']

        # --- clamp requested range into the valid window instead of 400 ---
        start = max(req_start, base_start)
        end   = min(req_end,   base_end)

        # if still inverted, return empty history with 200
        if start > end:
            return Response({
                "since": str(start),
                "until": str(end),
                "history": {},
            }, status=status.HTTP_200_OK)

        # ---------- query & build ----------
        qs = (GamePerformance.objects
              .filter(challenge=challenge, date__gte=start, date__lte=end)
              .values("date", "user__username")
              .annotate(points=Sum("score"))
              .order_by("date", "-points", "user__username"))

        grouped = defaultdict(list)
        for r in qs:
            grouped[r["date"]].append(r)

        n_days = (end - start).days + 1
        history = {}
        for d in (start + timedelta(i) for i in range(n_days)):
            daily = grouped.get(d, [])
            out, last_pts, rank = [], None, 0
            for r in daily:
                if r["points"] != last_pts:
                    rank += 1
                    last_pts = r["points"]
                out.append({
                    "name":   r["user__username"] or "Anonymous",
                    "points": int(r["points"] or 0),
                    "rank":   rank,
                })
            if out:
                history[str(d)] = out

        return Response({
            "since": str(start),
            "until": str(end),
            "history": history,
        }, status=status.HTTP_200_OK)

class RecomputeUserSkills(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, user_id: int):
        user = get_object_or_404(User, pk=user_id)
        skills = recompute_skill_for_user(user)
        return Response({"success": True, "skills": skills})

class RewardSettingView(APIView):
    """Allow participants of a collaborative challenge to set the reward settings once."""
    permission_classes = [permissions.IsAuthenticated]

    def put(self, request, chall_id: int):
        # fetch chall
        chall = get_object_or_404(Challenge, id=chall_id)
        # only collaborative (group) challenges editable
        if chall.groupID is None:
            return Response({'detail': 'Reward cannot be changed for manual challenges.'}, status=403)
        # participant check
        if not chall.members.filter(id=request.user.id).exists() and not request.user.is_staff:
            return Response({'detail': 'Only participants can edit reward.'}, status=403)

        # once reward has note or amount set, lock
        if getattr(chall, 'reward_setting', None):
            return Response({'detail': 'Reward already configured.'}, status=400)

        serializer = RewardSettingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(challenge=chall)
        return Response(serializer.data, status=200)


class SkillLevelsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = SkillLevel.objects.filter(user=request.user).select_related("category")
        data = SkillLevelSerializer(qs, many=True).data
        return Response(data)

## Generated by AI ##
class IsParticipant(permissions.BasePermission):
    """Allow only challenge participants (or admins)."""
    def has_object_permission(self, request, view, obj):
        ch = getattr(obj, 'challenge', None) or obj
        u = request.user
        if request.user.is_staff:
            return True
        # expects Challenge has members or participants M2M
        return hasattr(ch, 'members') and ch.members.filter(id=u.id).exists()

# user can list / add / update their Venmo or PayPal handles
class ExternalHandleViewSet(mixins.CreateModelMixin,
                            mixins.ListModelMixin,
                            mixins.UpdateModelMixin,
                            viewsets.GenericViewSet):
    serializer_class = ExternalHandleSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ExternalHandle.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

# List obligations (?challenge=id or ?mine=to_pay), plus three custom actions:
# 1) accept_agreement - payer taps "I agree to pay"
# 2) pay_cash - creates a Payment(method=cash) (photo optional).
# 3) pay_external - creates a Payment(method=external) and returns a deep-link (e.g., venmo://pay?...)
class ObligationViewSet(mixins.ListModelMixin,
                        mixins.RetrieveModelMixin,
                        viewsets.GenericViewSet):
    """List obligations for a challenge or user."""
    serializer_class = ObligationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Obligation.objects.select_related('challenge', 'challenge__reward_setting', 'payer', 'payee').prefetch_related('payments')
        challenge_id = self.request.query_params.get('challenge')
        mine = self.request.query_params.get('mine')
        if challenge_id:
            qs = qs.filter(challenge_id=challenge_id)
        if mine == 'to_pay':
            qs = qs.filter(payer=self.request.user)
        if mine == 'to_receive':
            qs = qs.filter(payee=self.request.user)
        return qs

    @action(detail=False, methods=['get'], url_path='me')
    def me(self, request):
        """
        Return obligations relevant to the current user, grouped as
        things they need to pay and things they should receive.
        """
        base = (Obligation.objects
                .select_related('challenge', 'challenge__reward_setting', 'payer', 'payee')
                .prefetch_related('payments'))
        to_pay = base.filter(payer=request.user)
        to_receive = base.filter(payee=request.user)

        return Response({
            "to_pay": ObligationSerializer(to_pay, many=True).data,
            "to_receive": ObligationSerializer(to_receive, many=True).data,
        })

    @action(detail=True, methods=['post'])
    def accept_agreement(self, request, pk=None):
        ob = self.get_object()
        if ob.payer != request.user:
            return Response({'detail':'Only payer can accept.'}, status=403)
        ob.agreement_accepted = True
        ob.save(update_fields=['agreement_accepted'])
        return Response({'ok': True})

    @action(detail=True, methods=['post'])
    def pay_cash(self, request, pk=None):
        ob = self.get_object()
        if ob.payer != request.user:
            return Response({'detail':'Only payer can mark payment.'}, status=403)
        s = CashPaymentCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        with transaction.atomic():
            p = Payment.objects.create(
                obligation=ob,
                method=PaymentMethod.CASH,
                provider=PaymentProvider.OTHER,
                amount=s.validated_data['amount'],
                note=s.validated_data.get('note', ''),
                status=PaymentStatus.PENDING,
            )
            if 'evidence_photo' in s.validated_data:
                p.evidence_photo = s.validated_data['evidence_photo']
                p.save()
            ob.recompute_status()
        return Response(PaymentSerializer(p).data, status=201)

    @action(detail=True, methods=['post'], url_path='pay_custom')
    def pay_custom(self, request, pk=None):
        ob = self.get_object()
        if ob.payer != request.user:
            return Response({'detail':'Only payer can mark payment.'}, status=403)
        note = request.data.get('note', '')
        with transaction.atomic():
            p = Payment.objects.create(
                obligation=ob,
                method=PaymentMethod.CUSTOM,
                provider=PaymentProvider.OTHER,
                amount=0,
                note=note,
                status=PaymentStatus.PENDING,
            )
            ob.recompute_status()
        return Response(PaymentSerializer(p).data, status=201)

    @action(detail=True, methods=['post'], url_path='pay_external')
    def pay_external(self, request, pk=None):
        ob = self.get_object()
        if ob.payer != request.user:
            return Response({'detail':'Only payer can mark payment.'}, status=403)
        s = ExternalPaymentCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        with transaction.atomic():
            p = Payment.objects.create(
                obligation=ob,
                method=PaymentMethod.EXTERNAL,
                provider=s.validated_data['provider'],
                amount=s.validated_data['amount'],
                note=s.validated_data.get('note',''),
                status=PaymentStatus.PENDING,
            )
            ob.recompute_status()

        # Build deep link for client convenience
        deeplink = None
        if p.provider == PaymentProvider.VENMO:
            handle = ExternalHandle.objects.filter(user=ob.payee, provider=PaymentProvider.VENMO).first()
            if handle:
                deeplink = f"venmo://pay?recipients={handle.handle}&amount={p.amount}&note={ob.challenge_id}%20reward"
        elif p.provider == PaymentProvider.PAYPAL:
            handle = ExternalHandle.objects.filter(user=ob.payee, provider=PaymentProvider.PAYPAL).first()
            if handle and handle.handle and '/' not in handle.handle and '@' not in handle.handle:
                deeplink = f"https://paypal.me/{handle.handle}/{p.amount}"

        data = PaymentSerializer(p).data
        data['deeplink'] = deeplink
        return Response(data, status=201)

# winner can confirm or reject a specific payment
class PaymentViewSet(mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = Payment.objects.select_related('obligation', 'obligation__challenge', 'obligation__challenge__reward_setting', 'obligation__payee', 'obligation__payer')
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=True, methods=['post'], url_path='confirm')
    def confirm(self, request, pk=None):
        p = self.get_object()
        if p.obligation.payee != request.user and not request.user.is_staff:
            return Response({'detail':'Only winner can confirm.'}, status=403)
        p.confirm()
        return Response(PaymentSerializer(p).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        p = self.get_object()
        if p.obligation.payee != request.user and not request.user.is_staff:
            return Response({'detail':'Only winner can reject.'}, status=403)
        p.reject()
        return Response(PaymentSerializer(p).data)

# Challenge finalize (creates obligations)
# POST /api/challenges/<id>/finalize/ is called right when the challenge ends.
# It figures out the winner, looks at RewardSetting, and creates an Obligation row for every non-winner (due in 7 days, with a points-penalty value)
@method_decorator(csrf_exempt, name="dispatch")   # remove CSRF for POST
class FinalizeChallengeView(View):
    """
    POST /api/challenges/<id>/finalize/
    Finalises a challenge, creates obligations, returns them.
    """

    def post(self, request, challenge_id, *args, **kwargs):
        try:
            chall = Challenge.objects.get(id=challenge_id)
        except Challenge.DoesNotExist:
            return JsonResponse({"detail": "Challenge not found"}, status=404)

        # very simple auth for tests
        if not chall.members.filter(id=request.user.id).exists() and not request.user.is_staff:
            return JsonResponse({"detail": "Forbidden"}, status=403)

        # run helper (added earlier)
        try:
            chall.finalize_and_create_obligations()
        except ValueError as exc:                 # e.g. no winner determined
            return JsonResponse({"detail": str(exc)}, status=400)

        data = ObligationSerializer(chall.obligations.all(), many=True).data
        return JsonResponse(data, safe=False, status=201)

    # any verb other than POST → 405
    def http_method_not_allowed(self, request, *args, **kwargs):
        return HttpResponseNotAllowed(["POST"])
    
# AI was used to help generate this class
class ShareChallengeView(APIView):
    @transaction.atomic
    def post(self, request, chall_id=None):
        print(f"[BACKEND] Incoming share request for challenge {chall_id}")
        print(f"[BACKEND] Request data: {request.data}")
        print(f"[BACKEND] User: {request.user}")

        try:
            start_date = request.data.get("startDate")
            end_date = request.data.get("endDate")
            friend_ids = request.data.get("members", [])
            challenge_name = request.data.get("name")
            schedule = request.data.get("schedule", [])

            if not friend_ids:
                return Response({"error": "No member provided"}, status=400)

            results = []

            for friend_id in friend_ids:
                friend = get_object_or_404(User, id=friend_id)

                # === Case 1: copy old challenge ===
                if chall_id:
                    original = get_object_or_404(Challenge, id=chall_id)
                    new_challenge = Challenge.objects.create(
                        name=original.name,
                        groupID=original.groupID,
                        initiator=friend,
                        startDate=start_date,
                        endDate=end_date,
                        isPublic=original.isPublic,
                        isPending=True
                    )

                    # copy membership
                    ChallengeMembership.objects.create(challengeID=new_challenge, uID=friend)

                    # copy alarm schedules
                    for cas in ChallengeAlarmSchedule.objects.filter(challenge=original):
                        alarm = cas.alarm_schedule
                        new_alarm = AlarmSchedule.objects.create(
                            uID=friend,
                            dayOfWeek=alarm.dayOfWeek,
                            alarmTime=alarm.alarmTime
                        )
                        ChallengeAlarmSchedule.objects.create(challenge=new_challenge, alarm_schedule=new_alarm)

                    # copy game schedules
                    for gs in GameSchedule.objects.filter(challenge=original):
                        new_gs = GameSchedule.objects.create(challenge=new_challenge, dayOfWeek=gs.dayOfWeek)
                        for assoc in GameScheduleGameAssociation.objects.filter(game_schedule=gs):
                            GameScheduleGameAssociation.objects.create(
                                game_schedule=new_gs,
                                game=assoc.game,
                                game_order=assoc.game_order
                            )

                # === Case 2: new challenge create ===
                else:
                    if not challenge_name:
                        return Response({"error": "Challenge name required"}, status=400)
                    
                    start_date_obj = datetime.strptime(start_date, "%Y-%m-%d").date() if start_date else None
                    end_date_obj = datetime.strptime(end_date, "%Y-%m-%d").date() if end_date else None

                    new_challenge = Challenge.objects.create(
                        name=challenge_name,
                        initiator=friend,
                        startDate=start_date_obj,
                        endDate=end_date_obj,
                        isPublic=False,
                        isPending=True
                    )

                    # membership
                    ChallengeMembership.objects.create(challengeID=new_challenge, uID=friend)

                    # schedule from payload
                    for s in schedule:
                        alarm_time_obj = datetime.strptime(s["time"], "%I:%M %p").time()
                        alarm = AlarmSchedule.objects.create(
                            uID=friend,
                            dayOfWeek=s["dayOfWeek"],
                            alarmTime=alarm_time_obj
                        )
                        ChallengeAlarmSchedule.objects.create(challenge=new_challenge, alarm_schedule=alarm)

                        gs = GameSchedule.objects.create(
                            challenge=new_challenge,
                            dayOfWeek=s["dayOfWeek"]
                        )
                        for g in s.get("games", []):
                            GameScheduleGameAssociation.objects.create(
                                game_schedule=gs,
                                game_id=g["id"],
                                game_order=0
                            )

                # create invite
                PersonalChallengeInvite.objects.create(
                    chall=new_challenge, sender=request.user, recipient=friend, status=2
                )

                results.append({"friend": friend.id, "challenge": new_challenge.id})

            return Response({"message": "Challenge shared successfully", "results": results}, status=201)

        except Exception as e:
            return Response({"error": str(e)}, status=400)

        

class GetPersonalChallengeInvites(APIView):
    def get(self, request, user_id):
       
        invites = (PersonalChallengeInvite.objects
                   .filter(recipient_id=user_id, status=2)
                   .select_related('chall'))
        data = [
            {
                "id": inv.chall.id,
                "name": inv.chall.name,
                "endDate": inv.chall.endDate,
                "inviteId": inv.id,
                "status": inv.status,  # 2
            }
            for inv in invites
        ]
        return Response(data, status=200)


class AcceptPersonalChallenge(APIView):
    @transaction.atomic
    def post(self, request, user_id, chall_id):
        inv = get_object_or_404(PersonalChallengeInvite,
                                recipient_id=user_id,
                                chall_id=chall_id,
                                status=2)
        chall = inv.chall
        chall.isPending = False
        chall.save(update_fields=['isPending'])

        inv.status = 1  # accepted
        inv.save(update_fields=['status'])
        return Response({"ok": True}, status=200)


# only one challenge per invite, so deleting the challenge is fine
class DeclinePersonalChallenge(APIView):
    @transaction.atomic
    def post(self, request, user_id, chall_id):
        inv = get_object_or_404(PersonalChallengeInvite,
                                recipient_id=user_id,
                                chall_id=chall_id,
                                status=2)
       
        inv.status = 0  # declined
        inv.save(update_fields=['status'])

        inv.chall.delete()
        return Response({"ok": True}, status=200)

class SendMessageView(APIView):
    def post(self, request, user_id):
        sender = request.user
        recipient = get_object_or_404(User, id=user_id)
        message_text = request.data.get("message", "").strip()

        if not message_text:
            return Response({"success": False, "error": "Message cannot be empty"}, status=400)

        message = Message.objects.create(
            sender=sender,
            recipient=recipient,
            message=message_text,
            timestamp=timezone.now()
        )

        # Broadcast message + notification
        channel_layer = get_channel_layer()
        ids = sorted([sender.id, recipient.id])
        room_name = f"chat_user_{ids[0]}_{ids[1]}"

        # Send message event to chat room
        async_to_sync(channel_layer.group_send)(
            room_name,
            {
                "type": "chat_message",
                "message": message.message,
                "sender": {
                    "id": sender.id,
                    "name": sender.name,
                    "username": sender.username,
                },
                "recipient_id": recipient.id,
                "group_id": None,
                "timestamp": message.timestamp.isoformat(),
            },
        )
        
        recipient_active = (
            room_name in ACTIVE_CHAT_USERS
            and recipient.id in ACTIVE_CHAT_USERS[room_name]
        )

        if not recipient_active:
            async_to_sync(channel_layer.group_send)(
                f"notifications_{recipient.id}",
                {
                    "type": "notify",
                    "event": "new_message",
                    "sender": sender.username,
                    "sender_id": sender.id,
                    "message": message.message,
                    "timestamp": message.timestamp.isoformat(),
                },
            )

        return Response({"success": True, "id": message.id})
    
class ConversationView(APIView):
    def get(self, request, user_id, recipient_id):
        messages = Message.objects.filter(
            Q(sender_id=user_id, recipient_id=recipient_id) | Q(sender_id=recipient_id, recipient_id=user_id)
        ).order_by('id')
        serializer = MessageSerializer(messages, many=True)
        return Response(serializer.data)
    
class SendMessageGroupView(APIView):
    def post(self, request, group_id):
        sender = request.user
        group = get_object_or_404(Group, id=group_id)
        message_text = request.data.get("message", "").strip()

        if not message_text:
            return Response({"success": False, "error": "Message cannot be empty"}, status=400)

        message = Message.objects.create(
            sender=sender,
            groupID=group,
            message=message_text,
            timestamp=timezone.now()
        )

        channel_layer = get_channel_layer()
        room_name = f"chat_group_{group.id}"

        # Broadcast group message
        async_to_sync(channel_layer.group_send)(
            room_name,
            {
                "type": "chat_message",
                "message": message.message,
                "sender": {
                    "id": sender.id,
                    "name": sender.name,
                    "username": sender.username,
                },
                "recipient_id": None,
                "group_id": group.id,
                "timestamp": message.timestamp.isoformat(),
            },
        )

        # Notify other group members
        member_ids = GroupMembership.objects.filter(groupID=group).values_list("uID_id", flat=True)
        for uid in member_ids:
            if uid == sender.id:
                continue
            async_to_sync(channel_layer.group_send)(
                f"notifications_{uid}",
                {
                    "type": "notify",
                    "event": "new_group_message",
                    "group_id": group.id,
                    "group_name": group.name,
                    "sender": sender.username,
                    "sender_id": sender.id,
                    "message": message.message,
                    "timestamp": message.timestamp.isoformat(),
                },
            )

        return Response({"success": True, "id": message.id})

class GroupConversationView(APIView):
    def get(self, request, group_id):
        # Ensure the group exists
        group = get_object_or_404(Group, id=group_id)

        # Fetch all messages for this group
        messages = Message.objects.filter(groupID=group).order_by('id')

        serializer = MessageSerializer(messages, many=True)
        return Response(serializer.data)

class UserGroupConversationsView(APIView):
    def get(self, request, user_id):
        memberships = GroupMembership.objects.filter(uID=user_id)
        group_ids = memberships.values_list('groupID', flat=True)
        groups = Group.objects.filter(id__in=group_ids)
        data = []
        for group in groups:
            last_message = Message.objects.filter(groupID=group).order_by('-id').first()
            data.append({
                'group_id': group.id,
                'group_name': group.name,
                'last_message': MessageSerializer(last_message).data if last_message else None,
            })
        return Response(data)

def send_expo_push_notification(user, title, body, data=None):
    try:
        token_obj = PushToken.objects.filter(user=user).first()
        if not token_obj:
            return False
        expo_token = token_obj.token
        payload = {
            "to": expo_token,
            "title": title,
            "body": body,
            "data": data or {},
        }
        response = requests.post("https://exp.host/--/api/v2/push/send", json=payload)
        return response.status_code == 200
    except Exception as e:
        print(f"Expo push notification error: {e}")
        return False


class SendNotificationView(APIView):
    def post(self, request):
        """
        Send a notification to a specific user:
        - Saves it to DB
        - Sends Expo push notification
        """
        timezone.activate(pytz.timezone("America/Denver"))
        user_id = request.data.get("user_id")
        title = request.data.get("title", "New Notification")
        body = request.data.get("body", "")
        ttype = request.data.get("type", "")
        screen = request.data.get("screen", "")
        challengeId = request.data.get("challengeId", "")
        challName = request.data.get("challName", "")
        whichChall = request.data.get("whichChall", "")

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        # Save to DB
        notification = UserNotification.objects.create(
            user=user,
            title=title,
            body=body,
            type=ttype,
            screen=screen,
            challengeId=challengeId,
            challName=challName,
            whichChall=whichChall,
        )

        return Response(
            {"success": True, "notification_id": notification.id},
            status=status.HTTP_201_CREATED
        )

    def get(self, request):
        """
        Get all notifications for a given user.
        Expects ?user_id=<id> in query params.
        """
        user_id = request.query_params.get("user_id")
        if not user_id:
            return Response({"error": "Missing user_id"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        notifications = user.notifications.order_by("-created_at").values(
            "id", "title", "body", "created_at", "read"
        )

        return Response({"notifications": list(notifications)}, status=status.HTTP_200_OK)

class SavePushTokenView(APIView):
    def post(self, request):
        user_id = request.data.get("user_id")
        token = request.data.get("token")

        if not user_id or not token:
            return Response({"error": "Missing user_id or token"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        push_token, created = PushToken.objects.update_or_create(
            user=user, defaults={"token": token}
        )

        return Response({"success": True, "token": push_token.token})


class UserNotificationsView(APIView):
    def get(self, request, user_id):
        notifications = UserNotification.objects.filter(user_id=user_id).order_by('-timestamp')
        data = [
            {
                "id": n.id,
                "type": n.type,
                "title": n.title,
                "timestamp": n.timestamp,
                "body": n.body,
                "screen": n.screen,
                "challengeId": n.challengeId,
                "challName": n.challName,
                "whichChall": n.whichChall,
            }
            for n in notifications
        ]
        return Response(data, status=status.HTTP_200_OK)


class DeleteNotificationView(APIView):
    def delete(self, request, notification_id):
        try:
            notification = UserNotification.objects.get(id=notification_id)
            notification.delete()
            return Response({"success": True})
        except UserNotification.DoesNotExist:
            return Response({"error": "Not found"}, status=404)