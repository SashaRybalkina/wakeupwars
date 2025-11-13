import pytz
from rest_framework.permissions import AllowAny
from django.conf import settings
from datetime import timezone, datetime, date, timedelta
from datetime import date as date_cls, timedelta
import random
from unittest import result
from django.db.models import Sum, Count, Q, F, Prefetch, Exists, OuterRef, Subquery
from rest_framework.views import APIView
from rest_framework.response import Response
from django.views import View
from rest_framework import status
from rest_framework.permissions import IsAuthenticatedOrReadOnly, IsAuthenticated, IsAdminUser
from rest_framework import generics, permissions
from rest_framework import generics, permissions, status, viewsets, mixins
from decimal import Decimal
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import action
from django.http import JsonResponse, HttpResponseNotAllowed
from django.db import transaction
from collections import defaultdict
from datetime import time
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.contrib.auth import authenticate, get_user_model
from django.core.cache import cache

from api.chat_consumer import ACTIVE_CHAT_USERS
from api.middleware import get_user_from_token
from api.utils.notifications import send_fcm_notification
from .serializers import (UserSerializer, RegisterSerializer, GroupSerializer, UserProfileSerializer, MessageSerializer, ChallengeSummarySerializer,
                          CatSerializer, GameSerializer, FriendRequestSerializer, CreateGroupSerializer, SkillLevelSerializer,
                          RewardSettingSerializer, ExternalHandleSerializer,ObligationSerializer, CashPaymentCreateSerializer,
                          ExternalPaymentCreateSerializer, PaymentSerializer, PendingPublicChallengeSummarySerializer, PublicChallengeSummarySerializer,
                          ChallengeBetSerializer)
from .models import (FCMDevice, Group, GroupInvite, UserNotification, PersonalChallengeInvite, PushToken, User, Message, Challenge, ChallengeMembership, GroupMembership, GameCategory, Game, GameSchedule,
                     AlarmSchedule, ChallengeAlarmSchedule, GameScheduleGameAssociation, Friendship, GroupMembership, FriendRequest,
                     SkillLevel, PendingGroupChallengeAvailability, GroupChallengeInvite, WordleMove, PublicChallengeConfiguration,
                     UserAvailability, PublicChallengeCategoryAssociation, ChallengeBet, Badge, UserBadge, Memoji, UserMemoji)
from django.http import JsonResponse
from typing     import Dict, List
from rest_framework.exceptions import ValidationError
from django.db.models import Min, Max
from datetime import datetime, time

#### Sudoku Game Imports ####
from .models import (SudokuGameState, WordleGameState, Challenge, SudokuGamePlayer, WordleGamePlayer, User, Game, GamePerformance, RewardSetting,
                     ExternalHandle, Obligation, Payment, PaymentStatus, PaymentMethod, PaymentProvider, ObligationStatus, RewardType, TypingRaceGameState)
from api.sudokuStuff.utils import validate_sudoku_move, get_or_create_game
from api.wordleStuff.utils import validate_wordle_move, get_or_create_game_wordle
from api.typingRaceStuff.utils import get_or_create_typing_race_game, finalize_single_result
from .serializers import ChallengeSummarySerializer
from sudoku import Sudoku
import time
from django.contrib.auth import login
from asgiref.sync import async_to_sync
import traceback
from api.services.skill import recompute_skill_for_user
from api.services.skill_config import SKILL_CONFIG
from api.tasks import open_join_window
from channels.layers import get_channel_layer

### Pattern Memorization###
from api.patternMem.utils import get_or_create_pattern_game, validate_pattern_move
from api.models import PatternMemorizationGameState

from .words_array import words

import logging
logger = logging.getLogger(__name__)

import requests

User = get_user_model()
WORD_LIST = words

#Here
class SetChallAvailabilityView(APIView):
    @transaction.atomic
    def post(self, request, user_id, chall_id):
        availability_data = request.data.get('availability', [])
        challenge = get_object_or_404(Challenge, id=chall_id)
        user = get_object_or_404(User, id=user_id)

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
        
        if (user_id != challenge.initiator_id):
            UserNotification.objects.create(
                    user=challenge.initiator,
                    title="Availability Set",
                    body=f"{user.name or user.username} has set their availability for '{challenge.name}'.",
                    type="availability_set",
                    screen="EditAvailability",
                    groupId=challenge.groupID.id,
                    startDate=challenge.startDate,
                    endDate=challenge.endDate,
                    accepted=1,
                    challengeId=challenge.id,
                    challName=challenge.name,
                    whichChall="Group"
                )
            device = FCMDevice.objects.filter(user=challenge.initiator).first()
            if device:
                title = "Availability Set"
                body = f"{user.name or user.username} has set their availability for '{challenge.name}'."
                recipient_id = challenge.initiator_id
                data={
                    "screen": "Notifications",
                    "type": "availability_set",
                }
                send_fcm_notification(title, body, data, recipient_id)

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
    
class GetNumCoinsView(APIView):
    def get(self, request, user_id):
        user = User.objects.get(id=user_id)
        return Response({"numCoins": user.numCoins}, status=status.HTTP_200_OK)

        

class GetAvailabilitiesView(APIView):
    def get(self, request, chall_id, user_id):
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

        declined_invites = GroupChallengeInvite.objects.filter(
            chall_id=chall_id, 
            accepted=0
        ).select_related('uID')  # optional, avoids extra queries for users

        # get the list of usernames (or any other field)
        declined_list = [invite.uID.name for invite in declined_invites]

        user = User.objects.get(id=user_id)

        return Response({
            "availabilities": availabilitiesData,
            "gameSchedule": schedule,
            "initiator_id": initiator_id,
            # "start_date": challenge.startDate
            "declined_list": declined_list,
            "participation_fee": challenge.participationFee,
            "num_user_coins": user.numCoins,
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


class MarkMessagesReadView(APIView):
    def post(self, request, *args, **kwargs):
        user = request.user
        other_user_id = request.data.get('other_user_id')
        group_id = request.data.get('group_id')

        if not user.is_authenticated:
            return Response({"error": "Authentication required"}, status=401)

        if not other_user_id and not group_id:
            return Response({"error": "Missing other_user_id or group_id"}, status=400)

        if other_user_id:
            updated = Message.objects.filter(
                sender_id=other_user_id,
                recipient_id=user.id,
                is_read=False,
                groupID__isnull=True
            ).update(is_read=True)
        else:
            updated = Message.objects.filter(
                groupID_id=group_id,
                is_read=False
            ).exclude(sender_id=user.id).update(is_read=True)

        return Response({"marked_as_read": updated})


class UserRecentMessagesView(APIView):
    def get(self, request, user_id):
        # 1️⃣ Direct (friend) messages
        # We find the latest message id per friend conversation (user <-> other user)
        # Step 1: Get all friends involved in any conversation with this user
        friend_ids = Message.objects.filter(
            Q(sender_id=user_id) | Q(recipient_id=user_id),
            groupID__isnull=True
        ).values_list('sender_id', 'recipient_id')

        # Step 2: Build a set of unique friend IDs
        unique_friends = set()
        for s, r in friend_ids:
            if s == user_id:
                unique_friends.add(r)
            elif r == user_id:
                unique_friends.add(s)

        # Step 3: For each friend, get their latest message (efficient per subquery)
        friend_messages = []
        for fid in unique_friends:
            latest_msg_subq = (
                Message.objects.filter(
                    Q(sender_id=user_id, recipient_id=fid)
                    | Q(sender_id=fid, recipient_id=user_id),
                    groupID__isnull=True
                )
                .order_by('-id')[:1]
            )
            friend_message = Message.objects.filter(id=Subquery(latest_msg_subq.values('id')[:1])).first()
            if friend_message:
                friend_messages.append(friend_message)

        messages_sorted = sorted(friend_messages, key=lambda m: m.timestamp, reverse=True)

        serializer = MessageSerializer(messages_sorted, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class UserRecentGroupMessagesView(APIView):
    def get(self, request, user_id):
        # 1️⃣ Get all groups the user belongs to
        memberships = GroupMembership.objects.filter(uID_id=user_id)
        group_ids = memberships.values_list('groupID_id', flat=True)

        groups = Group.objects.filter(id__in=group_ids)

        # 2️⃣ Fetch the latest message per group efficiently
        latest_messages = (
            Message.objects.filter(groupID_id__in=group_ids)
            .values('groupID_id')
            .annotate(latest_id=Max('id'))
        )
        latest_message_ids = [item['latest_id'] for item in latest_messages]
        messages_dict = {m.groupID_id: m for m in Message.objects.filter(id__in=latest_message_ids)}

        # 3️⃣ Prepare the response
        data = []
        for group in groups:
            last_message = messages_dict.get(group.id)
            data.append({
                'group_id': group.id,
                'group_name': group.name,
                'last_message': MessageSerializer(last_message).data if last_message else None,
            })

        return Response(data, status=status.HTTP_200_OK)
    

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
        serializer = UserSerializer(friends, many=True)
        return Response(serializer.data)

class CatListView(APIView):
    def get(self, request):
        cats = GameCategory.objects.all()
        serializer = CatSerializer(cats, many=True)
        return Response(serializer.data)
    

# class SomeCatsListView(APIView):
#     def get(self, request):
#         ids_param = request.GET.get("ids")  # e.g., "1,2,3"
#         if ids_param:
#             try:
#                 ids_list = [int(i) for i in ids_param.split(",")]
#                 cats = GameCategory.objects.filter(id__in=ids_list)
#             except ValueError:
#                 return Response({"error": "Invalid ids"}, status=400)
#         else:
#             cats = GameCategory.objects.all()
        
#         serializer = CatSerializer(cats, many=True)
#         return Response(serializer.data)


class SomeCatsListView(APIView):
    def get(self, request):
        ids_param = request.GET.get("ids")  # e.g. "1,2,3"
        sing_or_mult = request.GET.get("sing_or_mult")  # "Singleplayer", "Multiplayer", or "Neither"

        # Validate
        if sing_or_mult not in ["Singleplayer", "Multiplayer", "Neither"]:
            return Response({"error": "Invalid sing_or_mult value"}, status=400)

        # Determine isMultiplayer flag
        if sing_or_mult == "Singleplayer":
            isMult = False
        elif sing_or_mult == "Multiplayer":
            isMult = True
        else:
            isMult = None

        # Get categories
        if ids_param:
            try:
                ids_list = [int(i) for i in ids_param.split(",") if i.strip()]
                cats = GameCategory.objects.filter(id__in=ids_list) if ids_list else GameCategory.objects.all()
            except ValueError:
                return Response({"error": "Invalid ids"}, status=400)
        else:
            cats = GameCategory.objects.all()

        # Build data
        data = []
        for cat in cats:
            games = Game.objects.filter(category=cat, isMultiplayer=isMult)
            data.append({
                "id": cat.id,
                "categoryName": cat.categoryName,
                "games": GameSerializer(games, many=True).data
            })

        return Response(data)

    

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
            
            if chall.startDate and chall.endDate:
                summary_data["totalDays"] = (chall.endDate - chall.startDate).days + 1
            else:
                summary_data["totalDays"] = 0
            
            summary_data["daysCompleted"] = chall.daysCompleted
            summary_data["isCompleted"] = chall.isCompleted
            summary_data["isGroupChallenge"] = bool(chall.isCompleted)
            enriched_challenges.append(summary_data)
    
        memberships = GroupMembership.objects.filter(groupID=group)
        members = []

        for m in memberships:
            user = m.uID
            memoji = user.currentMemoji
            members.append({
                'id': user.id,
                'name': user.name,
                'avatar': {
                    'id': memoji.id if memoji else None,
                    'imageUrl': memoji.imageUrl if memoji else None,
                    'backgroundColor': user.memojiBgColor,
                }
            })

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

            other_members = ChallengeMembership.objects.filter(challengeID=challenge).exclude(uID=user)
            for m in other_members:
                UserNotification.objects.create(
                    user=m.uID,
                    title="New Member Joined",
                    body=f"{user.name or user.username} joined the public challenge '{challenge.name}'.",
                    type="public_challenge_join",
                    screen="ChallDetails",
                    challengeId=challenge.id,
                    challName=challenge.name,
                    whichChall="Public"
                )
                device = FCMDevice.objects.filter(user=m.uID).first()
                if device:
                    title = "New Member Joined"
                    body = f"{user.name or user.username} joined the public challenge '{challenge.name}'."
                    recipient_id = m.uID
                    data={
                        "screen": "Notifications",
                        "type": "public_challenge_join",
                    }
                    send_fcm_notification(title, body, data, recipient_id)
                    

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

            # take away coins from joiner
            user.numCoins -= challenge.participationFee
            user.save(update_fields=["numCoins"])
            # also take away coins from the initiator if this is the first person joining
            if ChallengeMembership.objects.filter(challengeID=challenge).count() == 2:
                challenge.initiator.numCoins -= challenge.participationFee
                challenge.initiator.save(update_fields=["numCoins"])
                
            
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
        

class SendBetView(APIView):
    def post(self, request):
        # const payload = {
        #     chall_id
        #     initiator_id
        #     recipient_id
        #     bet_amount
        # };
        data = request.data
        challengeId = data['chall_id']
        initiatorId = data['initiator_id']
        recipientId = data['recipient_id']
        betAmount = data['bet_amount']
        
        initiator = get_object_or_404(User, id=initiatorId)
        challenge = get_object_or_404(Challenge, id=challengeId)
        recipient = get_object_or_404(User, id=recipientId)


        try:
            with transaction.atomic():
                ChallengeBet.objects.create(
                    challenge_id=challengeId,
                    initiator_id=initiatorId,
                    recipient_id=recipientId,
                    betAmount=betAmount,
                    isPending=True,
                )
                
                UserNotification.objects.create(
                    user=recipient,
                    title="Invited to Bet",
                    body=f"{initiator.name or initiator.username} has made a bet of {betAmount}.",
                    type="send_bet",
                    screen="Bets",
                    challengeId=challengeId,
                    challName=challenge.name,
                    isCompleted=challenge.isCompleted,
                )
            
                device = FCMDevice.objects.filter(user_id=recipientId).first()
                recipient_id = recipientId
                if device:
                    title = "Invited to Bet"
                    body = f"{initiator.name or initiator.username} has made a bet of {betAmount}."
                    data={
                        "screen": "Notifications",
                        "type": "send_bet",
                    }
                    send_fcm_notification(title, body, data, recipient_id)
                
                return Response(
                    {"message": "Bet sent successfully"},
                    status=status.HTTP_201_CREATED,
                )
            
        except Exception as e:
            return Response(
                {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        

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
            
            device = FCMDevice.objects.filter(user_id=user.id).first()
            recipient_id = user.id
            if device:
                title = "Added to Group"
                body = f"You have been added to the group '{group.name}'."
                data={
                    "screen": "Notifications",
                    "type": "group_add",
                }
                send_fcm_notification(title, body, data, recipient_id)

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
    

class GetPersonalChallengesView(APIView):
    def get(self, request, user_id):
        challenges = Challenge.objects.filter(
            id__in=ChallengeMembership.objects.filter(uID=user_id).values_list('challengeID', flat=True),
            groupID=None,
            isPublic=False,
            isPending=False,
        )

        response_data = []
        for challenge in challenges:
            serialized = ChallengeSummarySerializer(challenge, context={'user': request.user}).data

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
        
        user = User.objects.get(id=user_id)

        mountain_tz = pytz.timezone("America/Denver")
        today = timezone.now().astimezone(mountain_tz)

        base_q = PublicChallengeConfiguration.objects.filter(
            isMultiplayer=is_multiplayer_flag,
            challenge__isPublic=True
        ).select_related("challenge")

        if not is_multiplayer_flag:
            # Exclude singleplayer challenges that already started
            q = base_q.filter(challenge__startDate__gte=today)

        # q = base_q
        
        if is_multiplayer_flag:
            # Annotate with member count for filtering
            q = base_q.annotate(member_count=Count('challenge__challengemembership', distinct=True)).filter(
                challenge__startDate__gte=today,
                member_count__lt=5  # fewer than 5 members enrolled
            )
        
        q = q.annotate(
            num_total_categories=Count('challenge__publicchallengecategoryassociation', distinct=True),
            num_matching_categories=Count(
                'challenge__publicchallengecategoryassociation',
                filter=Q(challenge__publicchallengecategoryassociation__category_id__in=category_ids),
                distinct=True
            )
        ).filter(
            num_total_categories=F('num_matching_categories')
        )

        # Exclude challenges where the user is already a member
        q = q.exclude(
            challenge__challengemembership__uID_id=user_id
        )
        # only include challenges the user can afford to join
        q = q.filter(challenge__participationFee__lte=user.numCoins)



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
        mountain_tz = pytz.timezone("America/Denver")
        now_mt = timezone.now().astimezone(mountain_tz)
        print("now mt: ", now_mt)

        for cfg in candidates:
            challenge = cfg.challenge

            # --- Step 1: find start datetime (with alarm time) ---
            start_date = challenge.startDate
            print("startDate: ", start_date)
            if not start_date:
                continue  # skip malformed challenge

            cas_list = getattr(challenge, "prefetched_cas", None)
            if cas_list is None:
                cas_qs = ChallengeAlarmSchedule.objects.filter(challenge=challenge).select_related("alarm_schedule")
            else:
                cas_qs = cas_list

            # get the day of week of the challenge's start date (1 = Monday ... 7 = Sunday)
            start_day_of_week = start_date.isoweekday()
            print("start day of week: ", start_day_of_week)

            # find the alarm time for that day (since all users share same schedule, any works)
            alarm_time = None
            for cas in cas_qs:
                if cas.alarm_schedule.dayOfWeek == start_day_of_week:
                    alarm_time = cas.alarm_schedule.alarmTime
                    break

            if not alarm_time:
                continue  # skip if somehow no alarm found for that day

            # --- Step 2: create timezone-aware start datetime ---
            start_naive = datetime.combine(start_date, alarm_time)
            print("start naive ", start_naive)
            start_mt = mountain_tz.localize(start_naive)
            print("start mt ", start_mt)

            # --- Step 3: compare with current datetime ---
            if now_mt >= start_mt:
                # Challenge already started -> skip
                continue

            # --- rest of your availability and skill logic follows ---
            challenge_alarms_by_day = {}
            for cas in cas_qs:
                alarm = cas.alarm_schedule
                day = alarm.dayOfWeek
                time_str = alarm.alarmTime.strftime("%H:%M")
                challenge_alarms_by_day.setdefault(day, set()).add(time_str)

            matched_days = []
            required_days = sorted(challenge_alarms_by_day.keys())

            all_days_match = True
            for day in required_days:
                challenge_times = challenge_alarms_by_day.get(day, set())
                user_times = user_avail_by_day.get(day, set())

                if not user_times:
                    all_days_match = False
                    break

                has_overlap = any(
                    time_in_user_window(ct, user_times) for ct in challenge_times
                )
                if has_overlap:
                    matched_days.append(day)
                else:
                    all_days_match = False
                    break

            if not all_days_match:
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

            serialized = PendingPublicChallengeSummarySerializer(challenge, context={"user": request.user}).data

            results.append({
                "summary": serialized,
                "userAverageSkillLevel": user_skill_value,
                "distance": float(distance),
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
    

class CurrentChallengesView(APIView):
    def get(self, request, user_id, which_chall):
        if which_chall == 'Group':
            # TODO: only fetch group challeges you're a part of
            group_ids = GroupMembership.objects.filter(uID=user_id).values_list('groupID', flat=True)
            challenges = Challenge.objects.filter(
                id__in=ChallengeMembership.objects.filter(uID=user_id).values_list('challengeID', flat=True),
                groupID__in=group_ids, 
                isPending=False, 
                isCompleted=False,
            )
        elif which_chall == 'Personal':
            challenges = Challenge.objects.filter(
                id__in=ChallengeMembership.objects.filter(uID=user_id).values_list('challengeID', flat=True),
                groupID=None,
                isPublic=False,
                isPending=False,
                isCompleted=False,
            )
        elif which_chall == 'Public':
            challenges = Challenge.objects.filter(
                id__in=ChallengeMembership.objects.filter(uID=user_id).values_list('challengeID', flat=True),
                isPublic=True,
                isPending=False,
                isCompleted=False,
            )

        response_data = []
        for challenge in challenges:
            serialized = ChallengeSummarySerializer(challenge, context={'user': request.user}).data
            response_data.append(serialized)

        print(response_data)
        return Response(response_data)


class ChallengeDetailView(APIView):
    def get(self, request, chall_id):
        try:
            challenge = Challenge.objects.get(id=chall_id)
        except Challenge.DoesNotExist:
            return Response({'error': 'Challenge not found'}, status=status.HTTP_404_NOT_FOUND)

        memberships = ChallengeMembership.objects.filter(challengeID=challenge)
        # members = [{'id': m.uID.id, 'name': m.uID.name, 'username': m.uID.username, 'numCoins': m.uID.numCoins} for m in memberships]
        members = []

        for m in memberships:
            user = m.uID
            memoji = user.currentMemoji
            members.append({
                'id': user.id,
                'name': user.name,
                'username': user.username,
                'numCoins': user.numCoins,
                'avatar': {
                    'id': memoji.id if memoji else None,
                    'imageUrl': memoji.imageUrl if memoji else None,
                    'backgroundColor': user.memojiBgColor,
                }
            })

        serializer = ChallengeSummarySerializer(challenge, context={'user': request.user})
        
        # game_schedules = GameSchedule.objects.filter(challenge=challenge).values_list('dayOfWeek', flat=True).distinct()
        numeric_to_label = {1: "M", 2: "T", 3: "W", 4: "TH", 5: "F", 6: "S", 7: "SU"}
        # days_of_week = [numeric_to_label[d] for d in sorted(game_schedules)]
        alarm_schedules = AlarmSchedule.objects.filter(
            challengealarmschedule__challenge=challenge
        ).values_list("dayOfWeek", flat=True).distinct()

        days_of_week = sorted([numeric_to_label[day] for day in alarm_schedules if day in numeric_to_label])
        # if challenge.startDate and challenge.endDate:
        #     totalDays = (challenge.endDate - challenge.startDate).days + 1
        # else:
        #     totalDays = 0
        initiator_id = challenge.initiator_id
        return Response({
            **serializer.data,
            'members': members,
            # 'totalDays': (challenge.endDate - challenge.startDate).days + 1,
            'totalDays': challenge.totalDays,
            'daysOfWeek': days_of_week,
            'initiator_id': initiator_id,
            'winner': (
                {"username": challenge.winner.username, "id": challenge.winner.id}
                if challenge.winner
                else None
            ),
            'unlockedCoins': challenge.unlockedCoins,
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
        # members = [{'id': m.uID.id, 'name': m.uID.name} for m in memberships]
        members = []

        for m in memberships:
            user = m.uID
            memoji = user.currentMemoji
            members.append({
                'id': user.id,
                'name': user.name,
                'username': user.username,
                'avatar': {
                    'id': memoji.id if memoji else None,
                    'imageUrl': memoji.imageUrl if memoji else None,
                    'backgroundColor': user.memojiBgColor,
                }
            })

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
                "alarmTime": sched.alarmTime.strftime("%I:%M %p")
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
    

class GetChallengeBetsView(APIView):
    def get(self, request, chall_id, user_id):
        try:
            challenge = Challenge.objects.get(id=chall_id)
        except Challenge.DoesNotExist:
            return Response({'error': 'Challenge not found'}, status=404)

        bets = ChallengeBet.objects.filter(challenge=challenge).exclude(
            Q(isPending=True) & ~Q(initiator_id=user_id) & ~Q(recipient_id=user_id)
        )

        serializer = ChallengeBetSerializer(bets, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)



        
    

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
    

    
class RespondToBetInviteView(APIView):
    @transaction.atomic
    def post(self, request):
        data = request.data
        bet = get_object_or_404(ChallengeBet, id=data['bet_id'])
        response = "Accepted"

        if not data.get('accept'):
            response = "Declined"
            bet.delete()
            return Response({"message": "Bet declined and deleted."}, status=status.HTTP_200_OK)

        bet.isPending = False
        bet.save()

        bet.initiator.numCoins -= bet.betAmount
        bet.recipient.numCoins -= bet.betAmount
        bet.initiator.save()
        bet.recipient.save()

        # Check badges for both users
        self.check_bet_badges(bet.initiator)
        self.check_bet_badges(bet.recipient)
        
        UserNotification.objects.create(
            user=bet.initiator,
            title=f"Bet {response}",
            body=f"{bet.recipient.name or bet.recipient.username} has {response.lower()} the bet invite.",
            type="bet_response",
            screen="Bets",
            challengeId=bet.challenge.id,
            challName=bet.challenge.name,
            isCompleted=bet.challenge.isCompleted,
        )
            
        device = FCMDevice.objects.filter(user_id=bet.initiator.id).first()
        recipient_id = bet.initiator.id
        if device:
            title=f"Bet {response}"
            body=f"{bet.recipient.name or bet.recipient.username} has {response.lower()} the bet invite."
            data={
                "screen": "Notifications",
                "type": "bet_invite_response",
            }
            send_fcm_notification(title, body, data, recipient_id)

        return Response({"message": "Bet accepted successfully."}, status=status.HTTP_200_OK)

    # ────────────────────────────────────────────────────────────────
    # Check and award Risk Taker / Social Butterfly badges
    # ────────────────────────────────────────────────────────────────
    def check_bet_badges(self, user):
        # First Wager badge
        first_wager_badge = Badge.objects.get(name="First Wager")
        # UserBadge.objects.get_or_create(user=user, badge=first_wager_badge)
        user_badge, created = UserBadge.objects.get_or_create(user=user, badge=first_wager_badge, defaults={'collected': False})
        
        if created:
            UserNotification.objects.create(
                user=user,
                title="First Wager Badge Unlocked!",
                body="You unlocked the First Wager badge. Check your Badges page!",
                type="badge_unlocked",
                screen="Profile",
            )
                    
            device = FCMDevice.objects.filter(user_id=user.id).first()
            recipient_id = user.id
            if device:
                title="First Wager Badge Unlocked!"
                body="You unlocked the First Wager badge. Check your Badges page!"
                data={
                    "screen": "Notifications",
                    "type": "badge_unlocked",
                }
                send_fcm_notification(title, body, data, recipient_id)

        # Only consider accepted (non-pending) bets for this user
        # total bets (count each bet once where user is initiator OR recipient)
        total_bets_count = ChallengeBet.objects.filter(
            isPending=False
        ).filter(
            Q(initiator=user) | Q(recipient=user)
        ).count()

        # unique partners: combine partners from both roles and count distinct in Python
        partners_as_initiator = ChallengeBet.objects.filter(isPending=False, initiator=user).values_list('recipient_id', flat=True)
        partners_as_recipient = ChallengeBet.objects.filter(isPending=False, recipient=user).values_list('initiator_id', flat=True)

        unique_partners = set(partners_as_initiator) | set(partners_as_recipient)
        unique_partners_count = len(unique_partners)

        print(unique_partners_count)
        print(total_bets_count)

        if unique_partners_count >= 2:
            social_butterfly_badge = Badge.objects.get(name="Social Butterfly")
            user_badge, created = UserBadge.objects.get_or_create(user=user, badge=social_butterfly_badge, defaults={'collected': False})
                
            if created:
                UserNotification.objects.create(
                    user=user,
                    title="Social Butterfly Badge Unlocked!",
                    body="You unlocked the Social Butterfly badge. Check your Badges page!",
                    type="badge_unlocked",
                    screen="Profile",
                )
                    
                device = FCMDevice.objects.filter(user_id=user.id).first()
                recipient_id = user.id
                if device:
                    title="Social Butterfly Badge Unlocked!"
                    body="You unlocked the Social Butterfly badge. Check your Badges page!"
                    data={
                        "screen": "Notifications",
                        "type": "badge_unlocked",
                    }
                    send_fcm_notification(title, body, data, recipient_id)
                

        if total_bets_count >= 2:
            riREDACTEDtaker_badge = Badge.objects.get(name="Risk Taker")
            user_badge, created = UserBadge.objects.get_or_create(user=user, badge=riREDACTEDtaker_badge, defaults={'collected': False})
            
            if created:
                UserNotification.objects.create(
                    user=user,
                    title="Risk Taker Badge Unlocked!",
                    body="You unlocked the Risk Taker badge. Check your Badges page!",
                    type="badge_unlocked",
                    screen="Profile",
                )
                    
                device = FCMDevice.objects.filter(user_id=user.id).first()
                recipient_id = user.id
                if device:
                    title="Risk Taker Badge Unlocked!"
                    body="You unlocked the Risk Taker badge. Check your Badges page!"
                    data={
                        "screen": "Notifications",
                        "type": "badge_unlocked",
                    }
                    send_fcm_notification(title, body, data, recipient_id)




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
                isPending=True,
                participationFee=data['participation_fee'],
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
                # Normalize inputs: dates may arrive as strings, and total_days may be string/omitted
                start_date_raw = data.get('start_date')
                end_date_raw = data.get('end_date')
                total_days_raw = data.get('total_days')

                # Parse YYYY-MM-DD strings into date objects if needed
                if isinstance(start_date_raw, str):
                    start_date = datetime.strptime(start_date_raw, '%Y-%m-%d').date()
                else:
                    start_date = start_date_raw

                if isinstance(end_date_raw, str):
                    end_date = datetime.strptime(end_date_raw, '%Y-%m-%d').date()
                else:
                    end_date = end_date_raw

                # Coerce/compute total_days
                if total_days_raw in (None, ''):
                    if start_date and end_date:
                        total_days = (end_date - start_date).days + 1
                    else:
                        total_days = 1
                else:
                    try:
                        total_days = int(total_days_raw)
                    except (TypeError, ValueError):
                        total_days = 1

                # Create the challenge with normalized fields
                challenge = Challenge.objects.create(
                    name=data['name'],
                    groupID_id=data['group_id'],
                    initiator_id=data['initiator_id'],
                    startDate=start_date,
                    endDate=end_date,
                    totalDays=total_days,
                    isPublic=False,
                    isPending=True,
                    participationFee=data['participation_fee'],
                )
            except Exception as e:
                print("Failed to create Challenge:", e)
                raise



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
            groupId = data['group_id']

            invites = [
                GroupChallengeInvite(
                    groupID_id=data['group_id'],
                    chall=challenge,
                    uID=member.uID,
                    accepted=1 if member.uID_id == data['initiator_id'] else 2
                ) for member in group_members
            ]
            GroupChallengeInvite.objects.bulk_create(invites)

            for invite in invites:
                if invite.uID_id != data['initiator_id']:
                    UserNotification.objects.create(
                        user=invite.uID,
                        title="New Group Challenge",
                        body=f"A new group challenge '{challenge.name}' needs your availability.",
                        type="group_challenge_invite",
                        screen="GroupDetails",
                        groupId=groupId,
                    )
                    device = FCMDevice.objects.filter(user=invite.uID).first()
                    if device:
                        send_fcm_notification(
                            "New Group Challenge",
                            f"A new group challenge '{challenge.name + ""}' needs your availability.",
                            {"screen": "Notifications", "type": "group_challenge_invite", "challengeId": str(challenge.id)},
                            invite.uID
                        )

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

        default_to_multiplayer = {43: 10, 44: 12, 45: 30, 48: 47,}
        default_to_singleplayer = {43: 9, 44: 11, 45: 32, 48: 46,}

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

                members = ChallengeMembership.objects.filter(challengeID=challenge)

                for m in members:
                    if m.uID_id != request.user.id:
                        UserNotification.objects.create(
                            user=m.uID,
                            title="Group Challenge Finalized",
                            body=f"The group challenge '{challenge.name}' has been finalized. Set your alarms!",
                            type="group_challenge_finalized",
                            screen="ChallSchedule",
                            challengeId=challenge.id,
                            challName=challenge.name,
                            whichChall="Group"
                        )
                        device = FCMDevice.objects.filter(user=m.uID).first()
                        if device:
                            send_fcm_notification(
                                "Group Challenge Finalized",
                                f"The group challenge '{challenge.name}' has been finalized. Set your alarms!",
                                {"screen": "Notifications", "type": "group_challenge_finalized", "challengeId": str(challenge.id)},
                                m.uID
                            )

                # delete all invites
                GroupChallengeInvite.objects.filter(chall=challenge).delete()

                # deduct all participation fees
                for user in users_in_challenge:
                    user.numCoins -= challenge.participationFee
                    user.save(update_fields=["numCoins"])
                # Queue background jobs for all participants at finalized schedule times
                try:
                    initiator_id = (
                        challenge.initiator_id
                        or ChallengeMembership.objects.filter(challengeID=challenge)
                            .values_list("uID_id", flat=True).first()
                    )

                    # Build unique set of (time, game_id) pairs based on the finalized challenge schedule
                    slot_tasks = set()
                    for cas in ChallengeAlarmSchedule.objects.filter(challenge=challenge).select_related("alarm_schedule"):
                        day = cas.alarm_schedule.dayOfWeek
                        t_obj = cas.alarm_schedule.alarmTime
                        game_ids = (
                            GameScheduleGameAssociation.objects
                            .filter(
                                game_schedule__challenge=challenge,
                                game_schedule__dayOfWeek=day,
                            )
                            .values_list("game_id", flat=True)
                        )
                        for gid in game_ids:
                            slot_tasks.add((t_obj, gid))

                    def build_alarm_dt(ch_start, t_obj):
                        from datetime import date as _date, datetime as _dt
                        if isinstance(ch_start, _dt):
                            base_date = ch_start.date()
                        else:
                            base_date = ch_start
                        dt = _dt.combine(base_date, t_obj)
                        if timezone.is_naive(dt):
                            dt = timezone.make_aware(dt, timezone.get_current_timezone())
                        return dt

                    queued = 0
                    for t_obj, game_id in slot_tasks:
                        try:
                            alarm_dt = build_alarm_dt(challenge.startDate, t_obj)

                            g = Game.objects.get(id=game_id)
                            g_name = (g.name or "").lower()
                            if "sudoku" in g_name:
                                code = "sudoku"
                            elif "wordle" in g_name:
                                code = "wordle"
                            elif "pattern" in g_name:
                                code = "pattern"
                            elif "typing" in g_name: 
                                code = "typingrace"
                            else:
                                logger.warning("Unknown game name=%r id=%s; skipping", g.name, g.id)
                                continue

                            logger.info(
                                "[FinalizeCollab] Queue open_join_window chall=%s game_id=%s code=%s eta=%s initiator=%s",
                                challenge.id, game_id, code, alarm_dt, initiator_id
                            )
                            open_join_window.apply_async(
                                args=[challenge.id, game_id, code, initiator_id],
                                eta=alarm_dt,
                            )
                            queued += 1
                        except Exception:
                            logger.exception("Failed to queue slot (t=%s, game_id=%s)", t_obj, game_id)
                            raise
                    logger.info("[FinalizeCollab] queued %d open_join_window tasks", queued)
                except Exception:
                    logger.exception("Failed scheduling background jobs after finalizing collaborative schedule")


            return Response(
                {"message": "Challenge schedule finalized.", "schedule": created_schedules},
                status=status.HTTP_201_CREATED,
            )

        except Exception as e:
            return Response(
                {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
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
        
        try:
            device = FCMDevice.objects.filter(user_id=recipient_id).first()
            if device:
                title = "Friend Request"
                body = sender.name + " (" + sender.username + ") sent you a friend request!"
                data={
                    "screen": "Notifications",
                    "type": "notification_type",
                    "notification_type": "friend_request",
                }
                send_fcm_notification(title, body, data, recipient_id)
        except Exception as e:
            print("Error sending FCM:", e)

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

        sender = fr.sender
        recipient = fr.recipient

        if accept:
            # Add friendship both ways
            Friendship.objects.create(uID1=fr.sender, uID2=fr.recipient)
            status_str = "accepted"
        else:
            status_str = "declined"
        fr.delete()

        # Send notification to sender
        UserNotification.objects.create(
            user=sender,
            title="Friend Request " + status_str.capitalize(),
            body=f"{recipient.name or recipient.username} has {status_str} your friend request.",
            type="friend_request_response",
            screen="FriendsRequests",
        )
        device = FCMDevice.objects.filter(user=sender).first()
        if device:
            send_fcm_notification(
                "Friend Request " + status_str.capitalize(),
                f"{recipient.name or recipient.username} has {status_str} your friend request.",
                {"screen": "Notifications", "type": "friend_request_response"},
                sender.id
            )

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
    @transaction.atomic
    def post(self, request):
        serializer = CreateGroupSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        name = serializer.validated_data['name']
        raw_ids = serializer.validated_data.get('members', [])
        member_ids = {mid for mid in raw_ids if mid is not None}

        # Create the group
        group = Group.objects.create(name=name)

        # Add creator as the only confirmed member
        if request.user and request.user.id:
            GroupMembership.objects.create(groupID=group, uID=request.user)

        # Send invites to provided member IDs (if any)
        if member_ids:
            users_to_invite = User.objects.filter(id__in=member_ids).exclude(id=request.user.id)

            for recipient in users_to_invite:
                GroupInvite.objects.create(group=group, sender=request.user, recipient=recipient)
                
                UserNotification.objects.create(
                    user=recipient,
                    title="Group Invite",
                    body=f"{request.user.name or request.user.username} invited you to join group '{group.name}'.",
                    type="group_invite",
                    screen="Groups",
                )

                device = FCMDevice.objects.filter(user=recipient).first()
                if device:
                    send_fcm_notification(
                        "Group Invite",
                        f"{request.user.name or request.user.username} invited you to join group '{group.name}'.",
                        {"screen": "Notifications", "type": "group_invite"},
                        recipient.id,
                    )

        return Response(
            {
                "message": "Group created successfully",
                "group_id": group.id,
                "invites_sent": len(member_ids),
            },
            status=status.HTTP_201_CREATED,
        )
    
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

        # Gate if the join window is closed or the game already ended
        try:
            gs = SudokuGameState.objects.filter(challenge_id=challenge_id).order_by('-id').first()
            today = timezone.localdate()
            if gs and getattr(gs.game, 'isMultiplayer', False):
                # Multiplayer: gate if the game has ended for today or joins window closed
                if GamePerformance.objects.filter(challenge_id=challenge_id, game_id=gs.game_id, date=today).exists():
                    return Response(
                        {'code': 'GAME_ENDED', 'detail': 'This game has already finished for today.'},
                        status=status.HTTP_403_FORBIDDEN,
                    )
                now = timezone.now()
                if gs.joins_closed or (gs.join_deadline_at and now > gs.join_deadline_at):
                    return Response(
                        {'code': 'JOINS_CLOSED', 'detail': 'The join window has closed. Please join next time.'},
                        status=status.HTTP_403_FORBIDDEN,
                    )
            else:
                # Singleplayer: allow creating another Sudoku game as long as the user hasn't
                # completed ALL scheduled Sudoku games for today in this challenge.
                sched_ids = list(GameSchedule.objects.filter(challenge_id=challenge_id).values_list('id', flat=True))
                sudoku_game_ids = list(
                    GameScheduleGameAssociation.objects.filter(
                        game_schedule_id__in=sched_ids,
                        game__name__icontains='sudoku'
                    ).values_list('game_id', flat=True)
                )
                if sudoku_game_ids:
                    completed_distinct = (GamePerformance.objects
                        .filter(
                            challenge_id=challenge_id,
                            user=user,
                            date=today,
                            game_id__in=sudoku_game_ids,
                        )
                        .values('game_id')
                        .distinct()
                        .count())
                    if completed_distinct >= len(set(sudoku_game_ids)):
                        return Response(
                            {'code': 'GAME_ENDED', 'detail': 'You have already completed all Sudoku games today.'},
                            status=status.HTTP_403_FORBIDDEN,
                        )
        except Exception:
            # best-effort gating; proceed if checks fail
            pass

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
        
        try:
            gs = SudokuGameState.objects.filter(challenge_id=challenge_id).order_by('-id').first()
            today = timezone.localdate()
            if gs and getattr(gs.game, 'isMultiplayer', False):
                # Multiplayer: gate if game finished for today or joins window closed
                if GamePerformance.objects.filter(challenge_id=challenge_id, game_id=gs.game_id, date=today).exists():
                    return Response(
                        {'code': 'GAME_ENDED', 'detail': 'This game has already finished for today.'},
                        status=status.HTTP_403_FORBIDDEN,
                    )
                now = timezone.now()
                if gs.joins_closed or (gs.join_deadline_at and now > gs.join_deadline_at):
                    return Response(
                        {'code': 'JOINS_CLOSED', 'detail': 'The join window has closed. Please join next time.'},
                        status=status.HTTP_403_FORBIDDEN,
                    )
            else:
                # Singleplayer: allow creating as long as the user hasn't completed ALL scheduled Sudoku games today
                sched_ids = list(GameSchedule.objects.filter(challenge_id=challenge_id).values_list('id', flat=True))
                sudoku_game_ids = list(
                    GameScheduleGameAssociation.objects.filter(
                        game_schedule_id__in=sched_ids,
                        game__name__icontains='sudoku'
                    ).values_list('game_id', flat=True)
                )
                if sudoku_game_ids:
                    completed_distinct = (GamePerformance.objects
                        .filter(
                            challenge_id=challenge_id,
                            user=user,
                            date=today,
                            game_id__in=sudoku_game_ids,
                        )
                        .values('game_id')
                        .distinct()
                        .count())
                    if completed_distinct >= len(set(sudoku_game_ids)):
                        return Response(
                            {'code': 'GAME_ENDED', 'detail': 'You have already completed all Sudoku games today.'},
                            status=status.HTTP_403_FORBIDDEN,
                        )
        except Exception:
            # best-effort gating; proceed if checks fail
            pass

        # result = validate_sudoku_move(game_state, user, index, value)
        result = async_to_sync(validate_sudoku_move)(game_state.id, user, index, value)

        # Handle ignored moves (cell already correctly filled)
        if result.get('type') == 'ignored':
            return Response({
                'success': True,
                'result': 'ignored',
                'puzzle': game_state.puzzle,
                'completed': False
            }, status=200)

        if result.get('is_correct'):
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
        
class FinalizeSudokuResultView(APIView):
    """
    Client-side Sudoku finalization endpoint.
    Frontend submits final accuracy data after local validation.

    Request:
      - game_state_id: ID of the SudokuGameState
      - accuracyCount: number of correct inputs
      - inaccuracyCount: number of incorrect inputs
      - is_complete: boolean
      - (optional) score: precomputed accuracy percentage (0-100)

    Response:
      - scores: leaderboard for all players
    """

    def post(self, request):
        game_state_id = request.data.get('game_state_id')
        accuracy = request.data.get('accuracyCount', 0)
        inaccuracy = request.data.get('inaccuracyCount', 0)
        is_complete = request.data.get('is_complete', False)
        score = request.data.get('score', None)
        user = request.user

        if not game_state_id:
            return Response({'error': 'Missing game_state_id'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            gs = SudokuGameState.objects.select_related('challenge', 'game').get(id=game_state_id)
        except SudokuGameState.DoesNotExist:
            return Response({'error': 'Game not found'}, status=status.HTTP_404_NOT_FOUND)

        is_multiplayer = bool(getattr(gs.game, 'isMultiplayer', False))
        play_date = timezone.localdate()

        # 🧮 Compute score if not provided
        if score is None:
            total = max(accuracy + inaccuracy, 1)
            score = round((accuracy / total) * 100, 2)

        # Save or update SudokuGamePlayer record
        SudokuGamePlayer.objects.update_or_create(
            gameState=gs,
            player=user,
            defaults={
                'accuracyCount': accuracy,
                'inaccuracyCount': inaccuracy,
            }
        )

        # Save or update GamePerformance record for leaderboard
        GamePerformance.objects.update_or_create(
            challenge=gs.challenge,
            game=gs.game,
            user=user,
            date=play_date,
            defaults={'score': score, 'auto_generated': False}
        )

        print(f'[Sudoku][Finalize] user={user.username} gs={game_state_id} score={score} acc={accuracy} inacc={inaccuracy}')

        # Determine participants for THIS scheduled game instance
        local_dt = timezone.localtime(gs.alarmDateTime) if gs.alarmDateTime else timezone.localtime()
        target_day = local_dt.isoweekday()
        target_time = local_dt.time().replace(second=0, microsecond=0)

        # Ensure this game is scheduled for that weekday
        has_game_today = GameScheduleGameAssociation.objects.filter(
            game_schedule__challenge=gs.challenge,
            game_schedule__dayOfWeek=target_day,
            game=gs.game,
        ).exists()

        # Primary: exact match for this minute
        scheduled_qs = ChallengeAlarmSchedule.objects.filter(
            challenge=gs.challenge,
            alarm_schedule__dayOfWeek=target_day,
        ).select_related('alarm_schedule')
        scheduled_user_ids = set(
            scheduled_qs.filter(
                alarm_schedule__alarmTime=target_time,
            ).values_list('alarm_schedule__uID_id', flat=True).distinct()
        )

        # Users who actually joined this session
        joined_user_ids = set(
            SudokuGamePlayer.objects.filter(gameState=gs).values_list('player_id', flat=True)
        )

        # Use scheduled users if the game is on today's schedule; always include any joiners
        session_player_ids = (scheduled_user_ids if has_game_today else set()) | joined_user_ids
        print(f'[Sudoku][Finalize] scheduled_user_ids={scheduled_user_ids}, joined_user_ids={joined_user_ids}, session_player_ids={session_player_ids}')

        # 🏆 Build leaderboard
        scores = []
        performances = GamePerformance.objects.filter(
            challenge=gs.challenge,
            game=gs.game,
            date=play_date,
            user_id__in=session_player_ids,
        ).select_related('user')

        for perf in performances:
            scores.append({
                'username': perf.user.username,
                'score': perf.score,
            })

        scores = sorted(scores, key=lambda x: x['score'], reverse=True)

        return Response({'scores': scores}, status=status.HTTP_200_OK)


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

            from datetime import datetime as _dt

            # Parse start_date/end_date if they come as strings
            if isinstance(start_date, str):
                # expecting 'YYYY-MM-DD'
                start_date = _dt.strptime(start_date, "%Y-%m-%d").date()
            if isinstance(end_date, str):
                end_date = _dt.strptime(end_date, "%Y-%m-%d").date()

            # Coerce total_days if sent as string
            if isinstance(total_days, str):
                try:
                    total_days = int(total_days)
                except ValueError:
                    total_days = 1
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
            # Queue background tasks for personal challenges (mirror SetUserHasSetAlarmsView)
            initiator_id = (
                challenge.initiator_id
                or ChallengeMembership.objects.filter(challengeID=challenge)
                    .values_list("uID_id", flat=True).first()
            )

            # Build (time, game_id) pairs from schedules
            slot_tasks = set()
            for cas in ChallengeAlarmSchedule.objects.filter(challenge=challenge).select_related("alarm_schedule"):
                day = cas.alarm_schedule.dayOfWeek
                t_obj = cas.alarm_schedule.alarmTime
                game_ids = (
                    GameScheduleGameAssociation.objects
                    .filter(game_schedule__challenge=challenge, game_schedule__dayOfWeek=day)
                    .values_list("game_id", flat=True)
                )
                for gid in game_ids:
                    slot_tasks.add((t_obj, gid))

            def build_alarm_dt(ch_start, t_obj):
                from datetime import datetime as _dt, date as _date
                # ch_start may be str/date/datetime
                if isinstance(ch_start, str):
                    try:
                        base_date = _dt.strptime(ch_start, "%Y-%m-%d").date()
                    except ValueError:
                        base_date = timezone.localdate()
                elif isinstance(ch_start, _dt):
                    base_date = ch_start.date()
                elif isinstance(ch_start, _date):
                    base_date = ch_start
                else:
                    base_date = timezone.localdate()

                dt = _dt.combine(base_date, t_obj)
                if timezone.is_naive(dt):
                    dt = timezone.make_aware(dt, timezone.get_current_timezone())
                return dt

            queued = 0
            for t_obj, game_id in slot_tasks:
                try:
                    alarm_dt = build_alarm_dt(challenge.startDate, t_obj)
                    g = Game.objects.get(id=game_id)
                    g_name = (g.name or "").lower()
                    if "sudoku" in g_name:
                        code = "sudoku"
                    elif "wordle" in g_name:
                        code = "wordle"
                    elif "pattern" in g_name:
                        code = "pattern"
                    else:
                        logger.warning("[Personal] Unknown game name=%r id=%s; skipping", g.name, g.id)
                        continue

                    logger.info(
                        "[Personal] Queue open_join_window chall=%s game_id=%s code=%s eta=%s initiator=%s",
                        challenge.id, game_id, code, alarm_dt, initiator_id
                    )
                    open_join_window.apply_async(
                        args=[challenge.id, game_id, code, initiator_id],
                        eta=alarm_dt,
                    )
                    queued += 1
                except Exception as e:
                    logger.exception("[Personal] Failed to queue slot (t=%s, game_id=%s): %s", t_obj, game_id, e)

            return Response({
                'message': 'Personal challenge created successfully',
                'challenge_id': challenge.id,
                'queued': True,
                'count': queued,
            }, status=status.HTTP_201_CREATED)

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
            gs = PatternMemorizationGameState.objects.filter(challenge_id=challenge_id).order_by('-id').first()
            if gs:
                today = timezone.localdate()
                # If any GamePerformance exists for today for this challenge+game, consider it ended
                if GamePerformance.objects.filter(challenge_id=challenge_id, game_id=gs.game_id, date=today).exists():
                    return Response(
                        {'code': 'GAME_ENDED', 'detail': 'This pattern memorization game has already finished for today.'},
                        status=status.HTTP_403_FORBIDDEN,
                    )
                now = timezone.now()
                if gs.joins_closed or (gs.join_deadline_at and now > gs.join_deadline_at):
                    return Response(
                        {'code': 'JOINS_CLOSED', 'detail': 'The join window has closed. Please join next time.'},
                        status=status.HTTP_403_FORBIDDEN,
                    )
        except Exception:
            # best-effort gating; proceed if checks fail
            pass
        
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

        try:
            gs = PatternMemorizationGameState.objects.filter(challenge_id=challenge_id).order_by('-id').first()
            if gs:
                today = timezone.localdate()
                # If any GamePerformance exists for today for this challenge+game, consider it ended
                if GamePerformance.objects.filter(challenge_id=challenge_id, game_id=gs.game_id, date=today).exists():
                    return Response(
                        {'code': 'GAME_ENDED', 'detail': 'This game has already finished for today.'},
                        status=status.HTTP_403_FORBIDDEN,
                    )
                now = timezone.now()
                if gs.joins_closed or (gs.join_deadline_at and now > gs.join_deadline_at):
                    return Response(
                        {'code': 'JOINS_CLOSED', 'detail': 'The join window has closed. Please join next time.'},
                        status=status.HTTP_403_FORBIDDEN,
                    )
        except Exception:
            # best-effort gating; proceed if checks fail
            pass
        
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

        if result.get('is_correct'):
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
        
        # --- Gating: deny join if today's scores already submitted or state closed ---
        from datetime import date as _date
        today = timezone.localdate()
        existing_gs = (WordleGameState.objects
                       .filter(challenge_id=challenge_id, created_at__date=today)
                       .order_by('-id')
                       .first())
        if existing_gs and (existing_gs.joins_closed or
                             GamePerformance.objects.filter(challenge_id=challenge_id,
                                                            game=existing_gs.game,
                                                            date=today).exists()):
            return Response({'code': 'JOINS_CLOSED', 'detail': 'This game can no longer be joined.'},
                            status=status.HTTP_403_FORBIDDEN)
        # -------------------------------------------
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
        game_state_id = request.data.get("game_state_id")
        row = request.data.get("row")
        guess = request.data.get("guess")
        user = request.user

        if game_state_id is None or row is None or guess is None:
            return Response({"error": "Missing parameters"}, status=status.HTTP_400_BAD_REQUEST)

        # Ensure the game state exists and load relations for gating/persistence
        try:
            gs = WordleGameState.objects.select_related("challenge", "game").get(id=game_state_id)
        except WordleGameState.DoesNotExist:
            return Response({"error": "Game not found"}, status=status.HTTP_404_NOT_FOUND)

        # Best-effort gating tied to this game state (avoid undefined challenge_id)
        try:
            today = timezone.localdate()
            if GamePerformance.objects.filter(challenge=gs.challenge, game=gs.game, date=today).exists():
                return Response(
                    {'code': 'GAME_ENDED', 'detail': 'This game has already finished for today.'},
                    status=status.HTTP_403_FORBIDDEN,
                )
            now = timezone.now()
            if gs.joins_closed or (gs.join_deadline_at and now > gs.join_deadline_at):
                return Response(
                    {'code': 'JOINS_CLOSED', 'detail': 'The join window has closed. Please join next time.'},
                    status=status.HTTP_403_FORBIDDEN,
                )
        except Exception:
            # best-effort gating; proceed if checks fail
            pass

        # Validate move and compute leaderboard
        result = validate_wordle_move(game_state_id, user, guess, row)

        # Persist immediately for single-player so ChallDetails can show Recent Performances right away
        try:
            is_multiplayer = bool(getattr(gs.game, 'isMultiplayer', False))
        except Exception:
            is_multiplayer = False

        if result.get('is_complete') and not is_multiplayer:
            # Try to extract this user's final score from the returned scores list
            score_list = result.get('scores') or []
            my_score = 0
            for s in score_list:
                if s.get('username') == user.username:
                    try:
                        my_score = int(s.get('score', 0))
                    except Exception:
                        my_score = 0
                    break
            # Fallback to score_awarded if correct on this move
            if my_score == 0 and result.get('is_correct'):
                try:
                    my_score = int(result.get('score_awarded') or 0)
                except Exception:
                    my_score = 0

            GamePerformance.objects.update_or_create(
                challenge=gs.challenge,
                game=gs.game,
                user=user,
                date=timezone.localdate(),
                defaults={"score": my_score, "auto_generated": False},
            )

        return Response(result, status=status.HTTP_200_OK)

class FinalizeWordleResultView(APIView):
    """
    Client-side validation finalization endpoint.
    Frontend submits final results after local validation.
    
    Request:
      - game_state_id: ID of the WordleGameState
      - guesses: array of {row, guess, evaluation}
      - is_complete: boolean
      - is_correct: boolean (did user win)
      - attempts_used: number of attempts used
    
    Response:
      - scores: leaderboard for all players
    """
    def post(self, request):
        game_state_id = request.data.get('game_state_id')
        guesses = request.data.get('guesses', [])
        is_complete = request.data.get('is_complete', False)
        is_correct = request.data.get('is_correct', False)
        attempts_used = request.data.get('attempts_used', 0)
        user = request.user

        if not game_state_id:
            return Response({'error': 'Missing game_state_id'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            gs = WordleGameState.objects.select_related('challenge', 'game').get(id=game_state_id)
        except WordleGameState.DoesNotExist:
            return Response({'error': 'Game not found'}, status=status.HTTP_404_NOT_FOUND)

        is_multiplayer = bool(getattr(gs.game, 'isMultiplayer', False))
        play_date = timezone.localdate()

        # Compute score based on game mode
        score = 0
        if is_complete and is_correct:
            if not is_multiplayer:
                # Single-player: score based on attempts (fewer attempts = higher score)
                max_attempts = 5
                base_score = 100 // max_attempts
                score = max(0, 100 - ((attempts_used - 1) * base_score))
            else:
                # Multiplayer: simple attempts-based score for now
                max_attempts = 5
                base_score = 100 // max_attempts
                score = max(0, 100 - ((attempts_used - 1) * base_score))

        # Save or update GamePerformance without downgrading existing scores
        existing = GamePerformance.objects.filter(
            challenge=gs.challenge,
            game=gs.game,
            user=user,
            date=play_date,
        ).first()

        if existing:
            # Only update if the new score is higher; never downgrade to 0
            if score is not None and int(score) > int(existing.score or 0):
                existing.score = int(score)
                existing.auto_generated = False
                existing.save(update_fields=['score', 'auto_generated'])
        else:
            # Create only if there's a positive score; otherwise let zero-fill handle missing
            if score and int(score) > 0:
                GamePerformance.objects.update_or_create(
                    challenge=gs.challenge,
                    game=gs.game,
                    user=user,
                    date=play_date,
                    defaults={'score': int(score), 'auto_generated': False}
                )

        print(f'[Wordle][Finalize] user={user.username} gs={game_state_id} complete={is_complete} correct={is_correct} score={score}')

        # Determine participants for THIS scheduled game instance
        # - primary: users scheduled at gs.alarmDateTime for this challenge and game
        # - union: any users who actually joined
        local_dt = timezone.localtime(gs.alarmDateTime) if gs.alarmDateTime else timezone.localtime()
        target_day = local_dt.isoweekday()
        target_time = local_dt.time().replace(second=0, microsecond=0)

        # Ensure this game is scheduled for that weekday
        has_game_today = GameScheduleGameAssociation.objects.filter(
            game_schedule__challenge=gs.challenge,
            game_schedule__dayOfWeek=target_day,
            game=gs.game,
        ).exists()

        # Primary: exact match for this minute
        scheduled_qs = ChallengeAlarmSchedule.objects.filter(
            challenge=gs.challenge,
            alarm_schedule__dayOfWeek=target_day,
        ).select_related('alarm_schedule')
        scheduled_user_ids = set(
            scheduled_qs.filter(
                alarm_schedule__alarmTime=target_time,
            ).values_list('alarm_schedule__uID_id', flat=True).distinct()
        )
        # Fallback: nearest scheduled alarm time within 15 minutes on this day
        if not scheduled_user_ids:
            times = list(scheduled_qs.values_list('alarm_schedule__alarmTime', flat=True).distinct())
            if times:
                today_date = timezone.localdate()
                target_dt = datetime.combine(today_date, target_time)
                def _abs_secs(t):
                    return abs((datetime.combine(today_date, t) - target_dt).total_seconds())
                times_sorted = sorted(times, key=_abs_secs)
                nearest_time = times_sorted[0]
                nearest_diff = _abs_secs(nearest_time)
                if nearest_diff <= 15 * 60:  # within 15 minutes
                    scheduled_user_ids = set(
                        scheduled_qs.filter(alarm_schedule__alarmTime=nearest_time)
                        .values_list('alarm_schedule__uID_id', flat=True)
                        .distinct()
                    )
                    print(f"[Wordle][Finalize] fallback matched nearest_time={nearest_time} (diff={nearest_diff}s)")

        # Users who actually joined this session
        joined_user_ids = set(
            WordleGamePlayer.objects.filter(gameState=gs).values_list('player_id', flat=True)
        )

        # Use scheduled users if the game is on today's schedule; always include any joiners
        session_player_ids = (scheduled_user_ids if has_game_today else set()) | joined_user_ids

        # Ensure zero-fill includes ALL participants of the challenge
        # Even if they weren't scheduled for this exact alarm, we still want
        # to mark their score as 0 if they didn't join.
        all_participant_ids = set(
            ChallengeMembership.objects.filter(challengeID=gs.challenge_id).values_list('uID_id', flat=True)
        )
        session_player_ids |= all_participant_ids

        print(f'[Wordle][Finalize] scheduled_user_ids={scheduled_user_ids}, joined_user_ids={joined_user_ids}, all_participants={all_participant_ids}, session_player_ids={session_player_ids}')

        submitted_ids = set(
            GamePerformance.objects.filter(
                challenge=gs.challenge,
                game=gs.game,
                date=play_date,
                user_id__in=session_player_ids,
            ).values_list('user_id', flat=True)
        )
        print(f'[Wordle][Finalize] submitted_ids={submitted_ids}')
        for uid in (session_player_ids - submitted_ids):
            GamePerformance.objects.update_or_create(
                challenge=gs.challenge,
                game=gs.game,
                user_id=uid,
                date=play_date,
                defaults={'score': 0, 'auto_generated': True}
            )

        # Lock further joins for this game state
        try:
            gs.joins_closed = True
            gs.save(update_fields=['joins_closed'])
        except Exception:
            pass

        # Build leaderboard
        scores = []
        performances = GamePerformance.objects.filter(
            challenge=gs.challenge,
            game=gs.game,
            date=play_date,
            user_id__in=session_player_ids,
        ).select_related('user')

        for perf in performances:
            scores.append({
                'username': perf.user.username,
                'score': int(perf.score or 0),
            })
        logger.warning(f'[Wordle][Finalize] scores={scores}')

        scores = sorted(scores, key=lambda x: x['score'], reverse=True)

        # Broadcast to all connected clients so they can dismiss the game screen
        try:
            channel_layer = get_channel_layer()
            # async_to_sync(channel_layer.group_send)(
            #     f'wordle_{game_state_id}',
            #     {
            #         'type': 'game.complete',  # handled by WordleConsumer.game_complete
            #         'scores': scores,
            #     },
            # )
            # Save computed scores into cache for later broadcasting
            cache_key = f"wordle_final_scores_{game_state_id}"
            cache.set(cache_key, scores, timeout=3600)
            logger.warning(f"[Wordle][Finalize] Scores in cache for game_state={game_state_id}: {scores}")
        except Exception:
            logger.exception('[Wordle][Finalize] Failed to broadcast game_complete')

        return Response({'scores': scores}, status=status.HTTP_200_OK)


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

        # Handle ignored moves (cell already correctly filled)
        if result.get('type') == 'ignored':
            return Response({
                'success': True,
                'result': 'ignored',
                'puzzle': game_state.puzzle,
                'completed': False
            }, status=200)

        if result.get('is_correct'):
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
            .annotate(game_name=F('game__name'))   # 
            .values('date', 'game_name', 'score')  # 
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
                GamePerformance.objects.update_or_create(
                    challenge=challenge,
                    game=game,
                    user=user,
                    date=play_date,
                    defaults={"score": sc, "auto_generated": False},
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
                try:
                    GamePerformance.objects.create(
                        challenge=challenge, game=game, user=u, date=play_date,
                        score=0, auto_generated=True
                    )
                    created_or_updated += 1
                except IntegrityError:
                    # Row already created (or a real score exists); leave as-is
                    pass
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

class GroupLeaderboardView(APIView):
    """
    GET /group-leaderboard/<group_id>/
      -> overall leaderboard across ALL challenges in the group
    """
    def get(self, request, group_id: int):
        group = get_object_or_404(Group, id=group_id)

        bounds = (
            GamePerformance.objects
            .filter(challenge__groupID=group)
            .aggregate(min_d=Min('date'), max_d=Max('date'))
        )
        since = bounds['min_d'] or timezone.localdate()
        until = bounds['max_d'] or timezone.localdate()

        rows = (
            GamePerformance.objects
            .filter(challenge__groupID=group)
            .values('user__username')
            .annotate(points=Sum('score'))
            .order_by('-points', 'user__username')
        )

        overall, last_pts, rank = [], None, 0
        for r in rows:
            if r['points'] != last_pts:
                rank += 1
                last_pts = r['points']
            overall.append({
                'name':   r['user__username'] or 'Anonymous',
                'points': int(r['points'] or 0),
                'rank':   rank,
            })

        return Response({
            'since': str(since),
            'until': str(until),
            'leaderboard': overall,
        }, status=status.HTTP_200_OK)


class GroupDailyHistoryView(APIView):
    """
    GET /group-leaderboard/<group_id>/history/?start=YYYY-MM-DD&end=YYYY-MM-DD
      -> daily leaderboard history across all group challenges in range
    """
    def get(self, request, group_id: int):
        group = get_object_or_404(Group, id=group_id)

        def parse(d: str) -> date:
            try:
                return datetime.strptime(d, '%Y-%m-%d').date()
            except ValueError:
                raise ValidationError(f"Bad date: {d!r} (YYYY-MM-DD expected)")

        start_str = request.GET.get('start')
        end_str   = request.GET.get('end')
        if start_str and not end_str:
            end_str = start_str
        if end_str and not start_str:
            start_str = end_str

        bounds = (
            GamePerformance.objects
            .filter(challenge__groupID=group)
            .aggregate(min_d=Min('date'), max_d=Max('date'))
        )
        base_start = bounds['min_d'] or timezone.localdate()
        base_end   = bounds['max_d'] or timezone.localdate()

        if start_str:
            req_start = parse(start_str)
            req_end   = parse(end_str)
        else:
            req_start = base_start
            req_end   = base_end

        start = max(req_start, base_start)
        end   = min(req_end,   base_end)
        if start > end:
            return Response({'since': str(start), 'until': str(end), 'history': {}}, status=status.HTTP_200_OK)

        qs = (
            GamePerformance.objects
            .filter(challenge__groupID=group, date__gte=start, date__lte=end)
            .values('date', 'user__username')
            .annotate(points=Sum('score'))
            .order_by('date', '-points', 'user__username')
        )

        grouped = defaultdict(list)
        for r in qs:
            grouped[r['date']].append(r)

        n_days = (end - start).days + 1
        history = {}
        for d in (start + timedelta(i) for i in range(n_days)):
            rows_d, last_pts, rank = grouped.get(d, []), None, 0
            out = []
            for r in rows_d:
                if r['points'] != last_pts:
                    rank += 1
                    last_pts = r['points']
                out.append({
                    'name':   r['user__username'] or 'Anonymous',
                    'points': int(r['points'] or 0),
                    'rank':   rank,
                })
            if out:
                history[str(d)] = out

        return Response({'since': str(start), 'until': str(end), 'history': history}, status=status.HTTP_200_OK)

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
    def get(self, request, user_id):
        user = get_object_or_404(User, id=user_id)
        qs = SkillLevel.objects.filter(user_id=user_id).select_related("category")

        window_days = SKILL_CONFIG.WINDOW_DAYS
        half_life_days = SKILL_CONFIG.HALF_LIFE_DAYS

        def recency_weight(when):
            if half_life_days is None or when is None:
                return 1.0
            base = datetime.combine(when, datetime.min.time())
            aware = timezone.make_aware(base, timezone.get_current_timezone())
            age_days = max(0.0, (timezone.now() - aware).total_seconds() / 86400.0)
            return 0.5 ** (age_days / half_life_days)

        out = []
        for sl in qs:
            cat = sl.category
            gp_qs = GamePerformance.objects.filter(user=user, game__category=cat)
            if window_days is not None:
                cutoff = timezone.now().date() - timedelta(days=window_days)
                gp_qs = gp_qs.filter(date__gte=cutoff)
            total_earned = 0.0
            total_possible = 0.0
            for gp in gp_qs.only("score", "date"):
                score = max(0, min(100, int(gp.score)))
                w = recency_weight(gp.date)
                total_earned += score * w
                total_possible += 100.0 * w
            skill = 0.0 if total_possible <= 0 else min(10.0, 10.0 * (total_earned / total_possible))
            out.append({
                "category": {"id": cat.id, "categoryName": cat.categoryName},
                "totalEarned": sl.totalEarned,
                "totalPossible": sl.totalPossible,
                "skill": round(skill, 2),
            })

        return Response({
            "skillLevels": out,
            "numCoins": user.numCoins,
        }, status=status.HTTP_200_OK)


class SkillLevelDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, category_id: int):
        try:
            category = GameCategory.objects.get(pk=category_id)
        except GameCategory.DoesNotExist:
            return Response({"detail": "Category not found"}, status=404)

        # Pull performances in window
        window_days = SKILL_CONFIG.WINDOW_DAYS
        half_life_days = SKILL_CONFIG.HALF_LIFE_DAYS

        qs = GamePerformance.objects.filter(user=request.user, game__category=category)
        if window_days is not None:
            cutoff = timezone.now().date() - timedelta(days=window_days)
            qs = qs.filter(date__gte=cutoff)

        def recency_weight(when):
            if half_life_days is None or when is None:
                return 1.0
            # convert date to aware midnight
            base = datetime.combine(when, datetime.min.time())
            aware = timezone.make_aware(base, timezone.get_current_timezone())
            age_days = max(0.0, (timezone.now() - aware).total_seconds() / 86400.0)
            return 0.5 ** (age_days / half_life_days)

        total_earned = 0.0
        total_possible = 0.0
        count = 0
        last_played = None
        for gp in qs.only("score", "date"):
            count += 1
            score = max(0, min(100, int(gp.score)))
            w = recency_weight(gp.date)
            total_earned += score * w
            total_possible += 100.0 * w
            if last_played is None or gp.date > last_played:
                last_played = gp.date

        if total_possible <= 0:
            skill = 0.0
        else:
            skill = min(10.0, 10.0 * (total_earned / total_possible))

        # Include stored SkillLevel totals if present
        sl = SkillLevel.objects.filter(user=request.user, category=category).first()

        return Response({
            "category": {"id": category.id, "name": category.categoryName},
            "totals": {
                "computed": {"earned": round(total_earned, 2), "possible": round(total_possible, 2)},
                "stored": (
                    {"earned": float(sl.totalEarned or 0), "possible": float(sl.totalPossible or 0)} if sl else None
                ),
            },
            "skill": round(skill, 2),
            "config": {"window_days": window_days, "half_life_days": half_life_days},
            "counts": {"games_considered": count, "last_played": str(last_played) if last_played else None},
        })
class SkillLevelHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, category_id: int):
        try:
            category = GameCategory.objects.get(pk=category_id)
        except GameCategory.DoesNotExist:
            return Response({"detail": "Category not found"}, status=404)

        limit_param = request.query_params.get("limit")
        try:
            limit = int(limit_param) if limit_param else 200
        except Exception:
            limit = 200

        window_days = SKILL_CONFIG.WINDOW_DAYS
        half_life_days = SKILL_CONFIG.HALF_LIFE_DAYS

        qs = GamePerformance.objects.filter(user=request.user, game__category=category).select_related("game")

        if window_days is not None:
            cutoff = timezone.now().date() - timedelta(days=window_days)
            qs = qs.filter(date__gte=cutoff)

        def recency_weight(when):
            if half_life_days is None or when is None:
                return 1.0
            base = datetime.combine(when, datetime.min.time())
            aware = timezone.make_aware(base, timezone.get_current_timezone())
            age_days = max(0.0, (timezone.now() - aware).total_seconds() / 86400.0)
            return 0.5 ** (age_days / half_life_days)

        items = []
        cum_earned = 0.0
        cum_possible = 0.0
        for gp in qs[:limit]:
            score = max(0, min(100, int(gp.score)))
            w = recency_weight(gp.date)
            earned = score * w
            possible = 100.0 * w
            cum_earned += earned
            cum_possible += possible
            skill_now = 0.0 if cum_possible <= 0 else min(10.0, 10.0 * (cum_earned / cum_possible))
            items.append({
                "date": str(gp.date),
                "raw_score": score,
                "weight": round(w, 4),
                "earned": round(earned, 2),
                "possible": round(possible, 2),
                "cumulative_skill": round(skill_now, 2),
                "game_id": gp.game_id,
                "game_name": gp.game.name,
            })

        return Response({
            "category": {"id": category.id, "name": category.categoryName},
            "config": {"window_days": window_days, "half_life_days": half_life_days},
            "items": items,
        })


class UserDataView(APIView):
    def get(self, request, user_id):
        qs = SkillLevel.objects.filter(user_id=user_id).select_related("category")
        data = SkillLevelSerializer(qs, many=True).data
        user = User.objects.get(id=user_id)

        memoji = user.currentMemoji

        return Response({
            "name": user.name,
            "skillLevels": data,
            "numCoins": user.numCoins,
            "currentMemoji": (
                {"id": memoji.id, "imageUrl": memoji.imageUrl}
                if memoji is not None else None
            ),
            "backgroundColor": getattr(user, "memojiBgColor", "#ffffff"),
        }, status=status.HTTP_200_OK)



class BadgesView(APIView):
    def get(self, request, user_id):
        badges = Badge.objects.all()
        user_badges = UserBadge.objects.filter(user_id=user_id)
        earned_map = {ub.badge_id: ub.collected for ub in user_badges}

        # Compute progress info for badges that need it
        user = get_object_or_404(User, id=user_id)

        # All bets (non-pending)
        bets = ChallengeBet.objects.filter(isPending=False).filter(
            Q(initiator=user) | Q(recipient=user)
        )

        total_bets_count = bets.count()

        partners_as_initiator = ChallengeBet.objects.filter(isPending=False, initiator=user).values_list('recipient_id', flat=True)
        partners_as_recipient = ChallengeBet.objects.filter(isPending=False, recipient=user).values_list('initiator_id', flat=True)
        unique_partners_count = len(set(partners_as_initiator) | set(partners_as_recipient))

        # progress goals
        social_butterfly_goal = 5
        riREDACTEDtaker_goal = 5

        data = []
        for badge in badges:
            badge_data = {
                "id": badge.id,
                "name": badge.name,
                "description": badge.description,
                "imageUrl": badge.imageUrl,
                "earned": badge.id in earned_map,
                "collected": earned_map.get(badge.id, False),
            }

            # Add custom progress fields for certain badges
            if badge.name == "Social Butterfly":
                badge_data["progress"] = {
                    "current": unique_partners_count,
                    "goal": social_butterfly_goal,
                    "percentage": min(unique_partners_count / social_butterfly_goal, 1.0)
                }

            elif badge.name == "Risk Taker":
                badge_data["progress"] = {
                    "current": total_bets_count,
                    "goal": riREDACTEDtaker_goal,
                    "percentage": min(total_bets_count / riREDACTEDtaker_goal, 1.0)
                }

            data.append(badge_data)

        return Response(data, status=status.HTTP_200_OK)

    


class ExtraMemojiesView(APIView):
    def get(self, request, user_id, base_id):
        user = get_object_or_404(User, id=user_id)
        curr = get_object_or_404(Memoji, id=base_id)

        # Determine base memoji
        base = curr.base or curr

        # Get all variants (including base itself)
        all_memojies = Memoji.objects.filter(Q(id=base.id) | Q(base=base))

        # Which memojies this user has unlocked
        unlocked = UserMemoji.objects.filter(user_id=user_id, memoji=OuterRef('pk'))
        memojies = all_memojies.annotate(unlocked=Exists(unlocked))

        # Serialize them for the frontend
        data = [
            {
                "id": m.id,
                "imageUrl": m.imageUrl,
                "purchased": m.unlocked or m.id == base.id,  # base memoji is always unlocked
                "price": getattr(m, "price", 0),
            }
            for m in memojies
        ]

        return Response({
            "avatars": data,
            "numCoins": user.numCoins,
        }, status=status.HTTP_200_OK)
    

class BaseMemojiesView(APIView):
    def get(self, request):
        base_memojies = Memoji.objects.filter(base=None)

        # Serialize them for the frontend
        data = [
            {
                "id": m.id,
                "imageUrl": m.imageUrl,
            }
            for m in base_memojies
        ]

        return Response(data, status=status.HTTP_200_OK)
    

class SetCurrentMemojiView(APIView):
    @transaction.atomic
    def post(self, request, user_id):
        user = get_object_or_404(User, id=user_id)
        memoji_id = request.data.get("memojiId")
        color = request.data.get("backgroundColor", "#ffffff")
        
        memoji = get_object_or_404(Memoji, id=memoji_id)
        user.currentMemoji = memoji
        user.memojiBgColor = color
        user.save()

        return Response({"message": "Avatar updated!"})


class PurchaseMemojiView(APIView):
    @transaction.atomic
    def post(self, request, user_id, memoji_id):
        user = get_object_or_404(User, id=user_id)
        memoji = get_object_or_404(Memoji, id=memoji_id)

        # make sure user can afford it
        if user.numCoins < memoji.price:
            return Response(
                {"error": "Not enough coins to purchase this memoji."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Deduct coins and record purchase
        user.numCoins -= memoji.price
        user.save()

        UserMemoji.objects.get_or_create(user=user, memoji=memoji)

        return Response(
            {
                "message": "Avatar purchased successfully!",
                "remainingCoins": user.numCoins,
                "purchasedMemoji": {
                    "id": memoji.id,
                    "imageUrl": memoji.imageUrl,
                    "price": memoji.price,
                },
            },
            status=status.HTTP_200_OK
        )



class CollectBadgeView(APIView):
    @transaction.atomic
    def post(self, request):
        data = request.data
        user_id = data['user_id']
        badge_id = data['badge_id']

        user_badge = get_object_or_404(UserBadge, user_id=user_id, badge_id=badge_id)
        if user_badge.collected:
            return Response({"message": "Already collected."}, status=status.HTTP_200_OK)
        user_badge.collected = True
        user_badge.save()
        # maybe reward coins or points here
        return Response({"message": "Badge collected!"}, status=status.HTTP_200_OK)
    

class CollectBetCoinsView(APIView):
    @transaction.atomic
    def post(self, request):
        data = request.data
        user_id = data['user_id']
        bet_id = data['bet_id']
        amount = data['amount']

        user = get_object_or_404(User, id=user_id)
        bet = get_object_or_404(ChallengeBet, id=bet_id)

        user.numCoins += amount
        user.save()

        bet.isCollected = True
        bet.save()

        return Response({"message": "Coins Collected!"}, status=status.HTTP_200_OK)
    


class CollectChallengeCoinsView(APIView):
    @transaction.atomic
    def post(self, request):
        data = request.data
        user_id = data['user_id']
        chall_id = data['chall_id']
        amount = data['amount']

        user = get_object_or_404(User, id=user_id)
        challenge = get_object_or_404(Challenge, id=chall_id)

        user.numCoins += amount
        user.save()

        challenge.unlockedCoins = 0
        challenge.save()

        return Response({"message": "Coins Collected!"}, status=status.HTTP_200_OK)
    


class CollectBetRefundView(APIView):
    @transaction.atomic
    def post(self, request):
        data = request.data
        user_id = data['user_id']
        bet_id = data['bet_id']
        amount = data['amount']
        who = data['who'] # will be 'Initiator' or 'Recipient'

        user = get_object_or_404(User, id=user_id)
        bet = get_object_or_404(ChallengeBet, id=bet_id)

        user.numCoins += amount
        user.save()

        if who == 'Initiator':
            bet.initiatorRefunded = True
            bet.save()

        elif who == 'Recipient':
            bet.recipientRefunded = True
            bet.save()

        return Response({"message": "Coins Collected!"}, status=status.HTTP_200_OK)



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
            total_days = request.data.get("totalDays")
            friend_ids = request.data.get("members", [])
            challenge_name = request.data.get("name")
            schedule = request.data.get("schedule", [])
            print(total_days)

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
                        totalDays=total_days,
                        isPublic=original.isPublic,
                        isPending=True
                    )

                    # # copy membership
                    # ChallengeMembership.objects.create(challengeID=new_challenge, uID=friend)

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
                    
                    # start_date_obj = datetime.strptime(start_date, "%Y-%m-%d").date() if start_date else None
                    # end_date_obj = datetime.strptime(end_date, "%Y-%m-%d").date() if end_date else None

                    # TODO: fix with new dates/total days
                    print("here")
                    new_challenge = Challenge.objects.create(
                        name=challenge_name,
                        groupID=None,
                        initiator=friend,
                        startDate=start_date,
                        endDate=end_date,
                        totalDays=total_days,
                        isPublic=False,
                        isPending=True
                    )

                    # # membership
                    # ChallengeMembership.objects.create(challengeID=new_challenge, uID=friend)

                    # schedule from payload
                    for s in schedule:
                        # alarm_time_obj = datetime.strptime(s["time"], "%I:%M %p").time()
                        alarm_time_obj = datetime.strptime(s["time"], "%H:%M").time()
                        print(alarm_time_obj)
                        alarm = AlarmSchedule.objects.create(
                            uID=friend,
                            dayOfWeek=s["dayOfWeek"],
                            alarmTime=alarm_time_obj
                        )
                        print(alarm)
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

                UserNotification.objects.create(
                    user=friend,
                    title="Personal Challenge Invite",
                    body=f"{request.user.name or request.user.username} shared a challenge '{challenge_name}' with you.",
                    type="personal_challenge_invite",
                    screen="PersChall1",
                )
                device = FCMDevice.objects.filter(user=friend).first()
                if device:
                    send_fcm_notification(
                        "Personal Challenge Invite",
                        f"{request.user.name or request.user.username} shared a challenge '{challenge_name}' with you.",
                        {"screen": "Notifications", "type": "personal_challenge_invite"},
                        friend.id
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
        print(chall_id)

        inv = get_object_or_404(PersonalChallengeInvite,
                                recipient_id=user_id,
                                chall_id=chall_id,
                                status=2)
        chall = inv.chall
        chall.isPending = False
        chall.save(update_fields=['isPending'])
        
        ChallengeMembership.objects.create(
            challengeID_id=chall_id,
            uID_id=user_id,
            hasSetAlarms=True,
        )
        # membership = get_object_or_404(
        #     ChallengeMembership,
        #     challengeID_id=chall_id,
        #     uID_id=user_id
        # )
        # membership.hasSetAlarms = True
        # membership.save()

        inv.status = 1  # accepted
        inv.save(update_fields=['status'])

        sender = inv.sender
        status_str = "accepted" if isinstance(self, AcceptPersonalChallenge) else "declined"
        UserNotification.objects.create(
            user=sender,
            title="Personal Challenge Response",
            body=f"{inv.recipient.name or inv.recipient.username} has {status_str} your challenge invite.",
            type="personal_challenge_response",
            screen="PersChall1",
        )
        device = FCMDevice.objects.filter(user=sender).first()
        if device:
            send_fcm_notification(
                "Personal Challenge Response",
                f"{inv.recipient.name or inv.recipient.username} has {status_str} your challenge invite.",
                {"screen": "Notifications", "type": "personal_challenge_response"},
                sender.id
            )

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

        # Delete the challenge (and cascades)
        # NOTE THAT AlarmSchedules for the user will still persist, should probably delete these
        inv.chall.delete()

        sender = inv.sender
        status_str = "accepted" if isinstance(self, AcceptPersonalChallenge) else "declined"
        UserNotification.objects.create(
            user=sender,
            title="Personal Challenge Response",
            body=f"{inv.recipient.name or inv.recipient.username} has {status_str} your challenge invite.",
            type="personal_challenge_response",
            screen="PersChall1",
        )
        device = FCMDevice.objects.filter(user=sender).first()
        if device:
            send_fcm_notification(
                "Personal Challenge Response",
                f"{inv.recipient.name or inv.recipient.username} has {status_str} your challenge invite.",
                {"screen": "Notifications", "type": "personal_challenge_response"},
                sender.id
            )

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
            timestamp=timezone.now(),
            is_read=0
        )
        
        device = FCMDevice.objects.filter(user=recipient).first()
        if device:
            send_fcm_notification(
                token=device.token,
                data={
                    "screen": "Messages",
                    "sender_id": sender.id,
                    "recipient_id": recipient.id,
                    "message_id": message.id,
                    "title": sender.name,
                    "body": f"{message_text}",
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
            timestamp=timezone.now(),
            is_read=0
        )

        # channel_layer = get_channel_layer()
        # room_name = f"chat_group_{group.id}"

        # # Broadcast group message
        # async_to_sync(channel_layer.group_send)(
        #     room_name,
        #     {
        #         "type": "chat_message",
        #         "message": message.message,
        #         "sender": {
        #             "id": sender.id,
        #             "name": sender.name,
        #             "username": sender.username,
        #         },
        #         "recipient_id": None,
        #         "group_id": group.id,
        #         "timestamp": message.timestamp.isoformat(),
        #     },
        # )
        
        member_ids = GroupMembership.objects.filter(groupID=group).values_list("uID_id", flat=True)
        recipients = User.objects.filter(id__in=member_ids).exclude(id=sender.id)

        for recipient in recipients:
            device = FCMDevice.objects.filter(user=recipient).first()
            if device:
                send_fcm_notification(
                    title=f"{sender.name or sender.username}, {group.name}",
                    body=f"{sender.name or sender.username}: {message_text}",
                    data={
                        "screen": "Messages",
                        "type": "group_message",
                        "group_id": group.id,
                        "sender_id": sender.id,
                        "message_id": message.id,
                    },
                    user_id=recipient.id,
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
                "groupId": n.groupId,
                "accepted": str(n.accepted),
                "startDate": str(n.startDate),
                "endDate": str(n.endDate),
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


class SaveFCMTokenView(APIView):
    def post(self, request):
        user_id = request.data.get("user_id")
        token = request.data.get("token")
        platform = request.data.get("platform")

        print("FCM token request data:", request.data)

        if not user_id or not token or not platform:
            return Response({"error": "Missing fields"}, status=400)

        user = get_object_or_404(User, id=user_id)

        try:
            obj, created = FCMDevice.objects.update_or_create(
                token=token,
                defaults={'user': user, 'platform': platform}
            )
            print("FCM device saved:", obj, "created:", created)
        except Exception as e:
            print("Error saving FCM device:", e)
            return Response({"error": str(e)}, status=500)

        return Response({"success": True})


class SendGroupInviteView(APIView):
    @transaction.atomic
    def post(self, request):
        group_id = request.data.get("group_id")
        recipient_id = request.data.get("recipient_id")
        group = get_object_or_404(Group, id=group_id)
        recipient = get_object_or_404(User, id=recipient_id)
        sender = request.user

        invite = GroupInvite.objects.create(group=group, sender=sender, recipient=recipient)
        UserNotification.objects.create(
            user=recipient,
            title="Group Invite",
            body=f"{sender.name or sender.username} invited you to join group '{group.name}'.",
            type="group_invite",
            screen="GroupInvites",
        )
        device = FCMDevice.objects.filter(user=recipient).first()
        if device:
            send_fcm_notification(
                "Group Invite",
                f"{sender.name or sender.username} invited you to join group '{group.name}'.",
                {"screen": "Notifications", "type": "group_invite"},
                recipient.id
            )

        return Response({"message": "Invite sent."}, status=201)


class RespondGroupInviteView(APIView):
    @transaction.atomic
    def post(self, request, invite_id):
        accept = request.data.get("accept")
        invite = get_object_or_404(GroupInvite, id=invite_id)
        group = invite.group
        recipient = invite.recipient
        sender = invite.sender

        if accept:
            GroupMembership.objects.create(groupID=group, uID=recipient)
            invite.status = 1
        else:
            invite.status = 0
        invite.save()

        # Notify all group members
        member_ids = GroupMembership.objects.filter(groupID=group).values_list("uID_id", flat=True)
        for uid in member_ids:
            if uid == recipient.id:
                continue
            user = User.objects.get(id=uid)
            UserNotification.objects.create(
                user=user,
                title="Group Invite Response",
                body=f"{recipient.name or recipient.username} has {'accepted' if accept else 'declined'} the invite to '{group.name}'.",
                type="group_invite_response",
                screen="Groups",
            )
            device = FCMDevice.objects.filter(user=user).first()
            if device:
                send_fcm_notification(
                    "Group Invite Response",
                    f"{recipient.name or recipient.username} has {'accepted' if accept else 'declined'} the invite to '{group.name}'.",
                    {"screen": "Notifications", "type": "group_invite_response"},
                    user.id
                )
        return Response({"message": "Response recorded."}, status=200)


class GroupInviteListView(APIView):
    def get(self, request, user_id):
        invites = GroupInvite.objects.filter(recipient_id=user_id, status=2).select_related('group', 'sender')
        data = [
            {
                "id": invite.id,
                "group": {
                    "id": invite.group.id,
                    "name": invite.group.name,
                },
                "sender": {
                    "id": invite.sender.id,
                    "name": invite.sender.name or invite.sender.username,
                    "username": invite.sender.username,
                },
                "created_at": invite.created_at,
            }
            for invite in invites
        ]
        return Response(data, status=200)
        
class CreateTypingRaceGameView(APIView):
    """
    [Single / Multiplayer] Create or join a Typing Race game.

    Request:
      - challenge_id: int

    Response:
      - game_state_id: int (Game session ID)
      - text: str (Passage to type)
      - is_multiplayer: bool
      - created_at: str (ISO format)
      - join_deadline_at: str (ISO format or None)
    """

    def post(self, request):
        
        challenge_id = request.data.get("challenge_id")
        user = request.user

        if not challenge_id:
            return Response({"error": "Missing challenge_id"}, status=status.HTTP_400_BAD_REQUEST)

        # Ensure challenge exists
        try:
            Challenge.objects.get(id=challenge_id)
        except Challenge.DoesNotExist:
            return Response({"error": "Challenge not found"}, status=status.HTTP_404_NOT_FOUND)

        # Check if the user has already played this challenge today
        # gs = TypingRaceGameState.objects.filter(challenge_id=challenge_id).order_by('-id').first()
        # if gs:
        #     today = timezone.localdate()
        #     if GamePerformance.objects.filter(challenge_id=challenge_id, game_id=gs.game_id, date=today, user=user).exists():
        #         return Response(
        #             {"code": "GAME_ENDED", "detail": "You have already completed this game today."},
        #             status=status.HTTP_403_FORBIDDEN,
        #         )

        game_data = get_or_create_typing_race_game(challenge_id, user)
        return Response(game_data, status=status.HTTP_200_OK)


class FinalizeTypingRaceResultView(APIView):
    """
    [Single-player only] Submit the final accuracy after finishing the game.

    Request:
      - game_state_id: int
      - accuracy: float (calculated on frontend)

    Response:
      - progress
      - accuracy
      - final_score
      - scores (snapshot leaderboard for this game)
    """

    def post(self, request):
        game_id = request.data.get("game_state_id")
        accuracy = request.data.get("accuracy")
        user = request.user

        if game_id is None or accuracy is None:
            return Response({"error": "Missing parameters"}, status=status.HTTP_400_BAD_REQUEST)

        # Ensure the game exists
        try:
            game_state = TypingRaceGameState.objects.get(id=game_id)
        except TypingRaceGameState.DoesNotExist:
            return Response({"error": "Game not found"}, status=status.HTTP_404_NOT_FOUND)

        # Convert accuracy to float
        try:
            accuracy_val = float(accuracy)
        except ValueError:
            return Response({"error": "Invalid accuracy value"}, status=status.HTTP_400_BAD_REQUEST)

        # Calculate final result (update TypingRaceGamePlayer)
        result = finalize_single_result(game_id, user, accuracy_val)

        # Save result to GamePerformance for leaderboard
        GamePerformance.objects.update_or_create(
            challenge=game_state.challenge,
            game=game_state.game,
            user=user,
            date=timezone.localdate(),
            defaults={"score": int(result["final_score"])}
        )

        return Response(result, status=status.HTTP_200_OK)


class GameTimerExpiredView(APIView):
    """
    Frontend-driven finalization: when the 5-minute UI timer ends,
    the client POSTs here to finalize the game state.

    Body:
      - model: one of 'SudokuGameState' | 'WordleGameState' | 'PatternMemorizationGameState'
      - game_state_id: int
    Effects:
      - For Sudoku: reconcile scores from SudokuGamePlayer, then zero-fill missing participants
      - For others: zero-fill missing participants
      - Mark joins_closed = True, broadcast 'timer.expired' and current leaderboard
    """
    def post(self, request):
        model_name = request.data.get('model')
        gs_id = request.data.get('game_state_id')
        if not model_name or not gs_id:
            return Response({'error': 'Missing model or game_state_id'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            Model = globals()[model_name]
        except KeyError:
            return Response({'error': 'Unknown model'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            gs = Model.objects.select_related('challenge', 'game').get(pk=gs_id)
        except Model.DoesNotExist:
            return Response({'error': 'Game state not found'}, status=status.HTTP_404_NOT_FOUND)

        play_date = timezone.localdate()
        # Reconcile Sudoku scores first (mirror tasks.broadcast_leaderboard)
        if model_name == 'SudokuGameState':
            try:
                players = (
                    SudokuGamePlayer.objects
                    .select_related('player')
                    .filter(gameState_id=gs_id)
                )
                # Denominator: correct + incorrect + empties_remaining (penalize mistakes)
                total_correct = sum(int(getattr(p, 'accuracyCount', 0) or 0) for p in players)
                total_incorrect = sum(int(getattr(p, 'inaccuracyCount', 0) or 0) for p in players)
                try:
                    empties_remaining = sum(
                        1 for row in (gs.puzzle or []) for v in (row or []) if v in (0, None)
                    )
                except Exception:
                    empties_remaining = 0
                denom = max(1, total_correct + total_incorrect + empties_remaining)

                submitted_ids = set()
                for p in players:
                    correct = int(getattr(p, 'accuracyCount', 0) or 0)
                    score = round((correct / denom) * 100, 2)
                    GamePerformance.objects.update_or_create(
                        challenge=gs.challenge,
                        game=gs.game,
                        user=p.player,
                        date=play_date,
                        defaults={"score": score},
                    )
                    submitted_ids.add(p.player_id)
            except Exception:
                pass

        # Zero-fill remaining participants only for multiplayer games
        try:
            is_multiplayer = bool(getattr(gs.game, 'isMultiplayer', False))
        except Exception:
            is_multiplayer = False
        if is_multiplayer:
            participant_ids = set(
                ChallengeMembership.objects
                .filter(challengeID=gs.challenge)
                .values_list('uID_id', flat=True)
            )
            existing_ids = set(
                GamePerformance.objects
                .filter(challenge=gs.challenge, game=gs.game, date=play_date)
                .values_list('user_id', flat=True)
            )
            for uid in participant_ids - existing_ids:
                GamePerformance.objects.update_or_create(
                    challenge=gs.challenge,
                    game=gs.game,
                    user_id=uid,
                    date=play_date,
                    defaults={"score": 0, "auto_generated": True},
                )

        # Lock further joins
        try:
            if not getattr(gs, 'joins_closed', False):
                gs.joins_closed = True
                gs.save(update_fields=['joins_closed'])
        except Exception:
            pass

        # Broadcast timer.expired and current leaderboard
        leaderboard = list(
            GamePerformance.objects
            .filter(challenge=gs.challenge, game=gs.game, date=play_date)
            .select_related('user')
            .values('user__username', 'score')
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
                    'type': 'timer.expired',
                    'leaderboard': leaderboard,
                    'auto_completed': True,
                    'server_now': timezone.now().isoformat(),
                }
            )
        except Exception:
            pass

        return Response({'success': True, 'finalized': True, 'auto_completed': True, 'leaderboard': leaderboard}, status=status.HTTP_200_OK)