from datetime import timezone, datetime, date, timedelta
from datetime import date as date_cls, timedelta
import random
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
from .serializers import (UserSerializer, RegisterSerializer, GroupSerializer, UserProfileSerializer, MessageSerializer, ChallengeSummarySerializer,
                          CatSerializer, GameSerializer, FriendSerializer, FriendRequestSerializer, CreateGroupSerializer, SkillLevelSerializer,
                          RewardSettingSerializer, ExternalHandleSerializer,ObligationSerializer, CashPaymentCreateSerializer,
                          ExternalPaymentCreateSerializer, PaymentSerializer, PendingPublicChallengeSummarySerializer, PublicChallengeSummarySerializer)
from .models import (Group, PersonalChallengeInvite, User, Message, Challenge, ChallengeMembership, GroupMembership, GameCategory, Game, GameSchedule,
                     AlarmSchedule, ChallengeAlarmSchedule, GameScheduleGameAssociation, Friendship, GroupMembership, FriendRequest,
                     SkillLevel, PendingGroupChallengeAvailability, GroupChallengeInvite, WordleMove, PublicChallengeConfiguration,
                     UserAvailability, PublicChallengeCategoryAssociation)
from django.http import JsonResponse
from typing     import Dict, List
from rest_framework.exceptions import ValidationError
from django.db.models import Min, Max

#### Sudoku Game Imports ####
from .models import (SudokuGameState, WordleGameState, Challenge, SudokuGamePlayer, WordleGamePlayer, User, Game, GamePerformance, RewardSetting,
                     ExternalHandle, Obligation, Payment, PaymentStatus, PaymentMethod, PaymentProvider, ObligationStatus, RewardType)
from api.sudokuStuff.utils import validate_sudoku_move, get_or_create_game
from api.wordleStuff.utils import validate_wordle_move, get_or_create_game_wordle
from .serializers import ChallengeSummarySerializer
from sudoku import Sudoku
import time
from django.contrib.auth import login
from django.views.decorators.csrf import ensure_csrf_cookie
from django.middleware.csrf import get_token
from asgiref.sync import async_to_sync
import traceback
from api.services.skill import recompute_skill_for_user

### Pattern Memorization###
from api.patternMem.utils import get_or_create_pattern_game, validate_pattern_move
from api.models import PatternMemorizationGameState

from .words_array import words

import logging
logger = logging.getLogger(__name__)

User = get_user_model()
WORD_LIST = words


@ensure_csrf_cookie
def get_csrf_token(request):
    token = get_token(request)
    return JsonResponse({'csrfToken': token})


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

        data = [
            {
                "uID": entry.uID.id,
                "name": entry.uID.name,
                "dayOfWeek": entry.dayOfWeek,
                "alarmTime": entry.alarmTime.strftime('%H:%M'),
            }
            for entry in availabilities
        ]

        return Response(data, status=status.HTTP_200_OK)
    

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



# class LoginView(APIView):
#     def post(self, request):
#         print("Request data:", request.data)
#         username = request.data.get('username')
#         password = request.data.get('password')
class LoginView(APIView):
    def post(self, request):
        print("Request data:", request.data)
        username = request.data.get('username')
        password = request.data.get('password')

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response({'success': False, 'error': 'Username does not exist'}, status=status.HTTP_404_NOT_FOUND)

        if not user.check_password(password):
            return Response({'success': False, 'error': 'Incorrect password'}, status=status.HTTP_401_UNAUTHORIZED)

        if not user.is_active:
            return Response({'success': False, 'error': 'Account is inactive'}, status=status.HTTP_403_FORBIDDEN)

        # This sets the session cookie
        login(request, user)

        serializer = UserSerializer(user)
        return Response({'success': True, **serializer.data})

class RegisterView(APIView):
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
        isMult = True
        if sing_or_mult == "Singleplayer":
            isMult = False
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
                uID=user
            )

            # --- update challenge average skill ---
            cfg = PublicChallengeConfiguration.objects.get(challenge=challenge)
            old_avg = cfg.averageSkillLevel
            print(old_avg)
            print("to")
            new_avg = (old_avg + user_avg_skill) / 2
            print(new_avg)
            cfg.averageSkillLevel = new_avg
            cfg.save()

            return Response({
                "message": "User joined challenge successfully",
                "newAverageSkillLevel": float(new_avg)
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        


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
            first_alarm = alarm_schedules.first()

            today = timezone.now().date()
            weekday_today = today.isoweekday()  # 1–7
            offset_days = (first_alarm.dayOfWeek - weekday_today) % 7
            start_date = today + timedelta(days=offset_days)

            # End date = start_date + totalDays - 1
            end_date = start_date + timedelta(days=challenge.totalDays - 1)

            # Update challenge
            challenge.isPending = False
            challenge.startDate = start_date
            challenge.endDate = end_date
            challenge.save()

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

            return Response({"message": "User added to group successfully."}, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        


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
        print("heeere")
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


        numeric_to_label = {1: "M", 2: "T", 3: "W", 4: "TH", 5: "F", 6: "S", 7: "SU"}

        response_data = []
        for challenge in challenges:
            game_days = (
                GameSchedule.objects.filter(challenge=challenge)
                .values_list('dayOfWeek', flat=True)
                .distinct()
            )
            day_labels = [numeric_to_label[d] for d in sorted(game_days)]

            serialized = ChallengeSummarySerializer(challenge, context={'user': request.user}).data
            serialized['daysOfWeek'] = day_labels
            # TODO: fix this
            if challenge.startDate is not None and challenge.endDate is not None:
                serialized["totalDays"] = (challenge.endDate - challenge.startDate).days + 1
            # elif challenge.startDate is None and challenge.endDate is None: # public pending
            #     serialized["totalDays"] = challenge.totalDays
            else:
                serialized["totalDays"] = None # just end date is pending collab, update later


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
            'totalDays': (challenge.endDate - challenge.startDate).days + 1,
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
                        "order": g.game_order
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
            games_by_day.setdefault(day, []).append({
                "name": g.game.name,
                "order": g.game_order
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
                "games": games_by_day.get(day, [])
            })

        # TODO: fix this once update db
        if (challenge.startDate and challenge.endDate):
            totDays = (challenge.endDate - challenge.startDate).days + 1
        else:
            totDays = challenge.totalDays
        return Response({
            "id": challenge.id,
            "name": challenge.name,
            "startDate": challenge.startDate,
            "endDate": challenge.endDate,
            "totalDays": totDays,
            "members": members,
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

            return Response({'message': 'Challenge created successfully', 'challenge_id': challenge.id}, status=status.HTTP_201_CREATED)

        except Exception as e:
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
                startDate=None,
                endDate=None,
                totalDays=data['total_days'],
                isPublic=True,
                isPending=True
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

            # ─── Reward config ──────────────────────────────
            reward_data = data.get('reward')
            if reward_data:
                serializer_rs = RewardSettingSerializer(data=reward_data)
                serializer_rs.is_valid(raise_exception=True)
                RewardSetting.objects.create(
                    challenge=challenge,
                    **serializer_rs.validated_data,
                )

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
            print(data['name'])
            print(data['group_id'])
            print(data['initiator_id'])
            print(data['end_date'])
            try:
                challenge = Challenge.objects.create(
                    name=data['name'],
                    groupID_id=data['group_id'],
                    initiator_id=data['initiator_id'],
                    startDate=None,
                    endDate=data['end_date'],
                    isPublic=False,
                    isPending=True
                )
            except Exception as e:
                print("Failed to create Challenge:", e)
                raise


            # ─── Reward config ──────────────────────────────
            reward_data = data.get('reward')
            if reward_data:
                serializer_rs = RewardSettingSerializer(data=reward_data)
                serializer_rs.is_valid(raise_exception=True)
                RewardSetting.objects.create(
                    challenge=challenge,
                    **serializer_rs.validated_data,
                )

            print("here1")
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

        for day, entries in valid_days.items():
            # group times per user
            user_times = defaultdict(set)
            for user, t in entries:
                user_times[user].add(time_to_minutes(t))

            # check if there is at least one common available time
            common_times = set.intersection(*user_times.values())

            if common_times:
                # pick the earliest shared time
                chosen_time = min(common_times)
                for user in users_in_challenge:
                    final_schedule[day].append((user, chosen_time))
            else:
                # assign each user the time closest to the group’s median
                user_assignments = heuristic_assignment(user_times)
                for user, minutes in user_assignments.items():
                    final_schedule[day].append((user, minutes))
        
        print(final_schedule)

        # Persist everything atomically
        try:
            with transaction.atomic():
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

                # make the challenge no longer pending
                scheduled_days = sorted(final_schedule.keys())  # e.g., [1, 2, 4]

                today = date.today()
                for i in range(7):
                    candidate_date = today + timedelta(days=i)
                    # Map Python weekday() 0-6 -> dayOfWeek 1-7
                    candidate_day_of_week = candidate_date.weekday() + 1
                    if candidate_day_of_week in scheduled_days:
                        challenge.startDate = candidate_date
                        break

                challenge.isPending = False
                challenge.save(update_fields=["isPending", "startDate"])

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
     

    
    
class SendFriendRequestView(APIView):
    def post(self, request):
        sender_id = request.data.get("sender_id")
        recipient_id = request.data.get("recipient_id")

        if sender_id == recipient_id:
            return Response({'error': 'You cannot send a friend request to yourself'}, status=status.HTTP_400_BAD_REQUEST)

        if FriendRequest.objects.filter(sender_id=sender_id, recipient_id=recipient_id).exists():
            return Response({'error': 'Friend request already sent'}, status=status.HTTP_400_BAD_REQUEST)

        FriendRequest.objects.create(sender_id=sender_id, recipient_id=recipient_id)
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
            end_date = data.get("endDate")
            schedule = data.get("schedule") 

            if not user_id or not name or not end_date or not schedule:
                return Response({'error': 'Missing required fields.'}, status=status.HTTP_400_BAD_REQUEST)

            challenge = Challenge.objects.create(
                name=name,
                groupID=None,
                isPublic=False,
                isPending=False,
                startDate=datetime.now().date(),
                endDate=end_date
            )

            ChallengeMembership.objects.create(challengeID=challenge, uID_id=user_id)

            for entry in schedule:
                time_str = entry['time']
                games = entry['games']
                alarm = AlarmSchedule.objects.create(
                    uID_id=user_id,
                    dayOfWeek=entry['dayOfWeek'],
                    alarmTime=datetime.strptime(time_str, "%I:%M %p").time()
                )
                ChallengeAlarmSchedule.objects.create(
                    challenge=challenge,
                    alarm_schedule=alarm
                )

                game_schedule = GameSchedule.objects.create(
                    challenge=challenge,
                    dayOfWeek=entry['dayOfWeek']
                )

                for i, game in enumerate(games):
                    GameScheduleGameAssociation.objects.create(
                        game_schedule=game_schedule,
                        game_id=game['id'],
                        game_order=i
                    )

            return Response({'message': 'Personal challenge created successfully'}, status=status.HTTP_201_CREATED)

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
      - answer: chosen word (only sent to the creator; in multiplayer you may want to hide it)
      - is_multiplayer: true if it's a multiplayer game
    """

    def post(self, request):
        challenge_id = request.data.get("challenge_id")
        user = request.user

        if not challenge_id:
            return Response({"error": "Missing challenge_id"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            Challenge.objects.get(id=challenge_id)
        except Challenge.DoesNotExist:
            return Response({"error": "Challenge not found"}, status=status.HTTP_404_NOT_FOUND)

        # get_or_create_game should work for Wordle as well (if you extend it to handle WordleGameState)
        game_data = get_or_create_game_wordle(challenge_id, user)

        try:
            state_id = game_data.get("game_state_id")
            if state_id:
                state = WordleGameState.objects.get(id=state_id)

                state.answer = random.choice(WORD_LIST).upper()
                state.save()

                # Add info to response
                game_data["game_id"] = state.game_id
                game_data["answer"] = state.answer  # ⚠️ careful: in real multiplayer you may NOT want to send this to everyone
        except WordleGameState.DoesNotExist:
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


class ValidateWordleMoveView(APIView):
    def post(self, request):
        game_id = request.data.get('game_state_id')
        row = request.data.get('row')   # attempt row
        guess = request.data.get('guess')   # guessed word
        user = request.user

        if game_id is None or row is None or guess is None:
            return Response({'error': 'Missing parameters'}, status=400)

        try:
            game_state = WordleGameState.objects.get(id=game_id)
        except WordleGameState.DoesNotExist:
            return Response({'error': 'Game not found'}, status=404)

        # Store the move if you want multiplayer history / stats
        WordleGamePlayer.objects.get_or_create(
            gameState=game_state,
            player=user,
            defaults={'accuracyCount': 0, 'inaccuracyCount': 0}
        )
        
        move, created = WordleMove.objects.update_or_create(
            gameState=game_state,
            player=user,
            row=row,
            defaults={"guess": guess}
        )

        result = validate_wordle_move(game_id, user, guess, row)

        return Response(result, status=200)


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
                    defaults={"score": 0}
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


