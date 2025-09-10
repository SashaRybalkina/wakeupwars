from datetime import timezone, datetime, date, timedelta
from datetime import date as date_cls, timedelta
from django.db.models import Sum, F
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from rest_framework import generics, permissions
from rest_framework import status
from django.db import transaction
from collections import defaultdict
from datetime import time
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.contrib.auth import authenticate, get_user_model
from .serializers import UserSerializer, RegisterSerializer, GroupSerializer, UserProfileSerializer, MessageSerializer, ChallengeSummarySerializer, CatSerializer, GameSerializer, FriendSerializer, FriendRequestSerializer, CreateGroupSerializer
from .models import Group, User, Message, Challenge, ChallengeMembership, GroupMembership, GameCategory, Game, GameSchedule, AlarmSchedule, ChallengeAlarmSchedule, GameScheduleGameAssociation, Friendship, GroupMembership, FriendRequest, SkillLevel, PendingGroupChallengeAvailability, GroupChallengeInvite
from django.http import JsonResponse
from typing     import Dict, List
from rest_framework.exceptions import ValidationError

#### Sudoku Game Imports ####
from .models import SudokuGameState, Challenge, SudokuGamePlayer, User, Game, GamePerformance
from api.sudokuStuff.utils import validate_sudoku_move, get_or_create_game
from .serializers import ChallengeSummarySerializer
from sudoku import Sudoku
import time
from django.contrib.auth import login
from django.views.decorators.csrf import ensure_csrf_cookie
from django.middleware.csrf import get_token
from asgiref.sync import async_to_sync
import traceback

User = get_user_model()

@ensure_csrf_cookie
def get_csrf_token(request):
    token = get_token(request)
    return JsonResponse({'csrfToken': token})


class SetAvailabilityView(APIView):
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

        return Response({'status': 'availability toggled and invite accepted'})
    

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



class LoginView(APIView):
    def post(self, request):
        print("Request data:", request.data)
        username = request.data.get('username')
        password = request.data.get('password')
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

class GameListView(APIView):
    def get(self, request, cat_id, sing_or_mult):
        isMult = True
        if sing_or_mult == "Singleplayer":
            isMult = False
        games = Game.objects.filter(category_id=cat_id, isMultiplayer=isMult)
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
      
        
class ChallengeListView(APIView):
    def get(self, request, user_id, which_chall):
        # TODO: consider only fetching non-pending challenges
        if which_chall == 'Group':
            group_ids = GroupMembership.objects.filter(uID=user_id).values_list('groupID', flat=True)
            challenges = Challenge.objects.filter(groupID__in=group_ids)
        elif which_chall == 'Personal':
            challenges = Challenge.objects.filter(
                id__in=ChallengeMembership.objects.filter(uID=user_id).values_list('challengeID', flat=True),
                groupID=None,
                isPublic=False
            )
        elif which_chall == 'Public':
            challenges = Challenge.objects.filter(
                id__in=ChallengeMembership.objects.filter(uID=user_id).values_list('challengeID', flat=True),
                isPublic=True
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
            serialized['totalDays'] = (challenge.endDate - challenge.startDate).days + 1

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

        return Response({
            **serializer.data,
            'members': members,
            'totalDays': (challenge.endDate - challenge.startDate).days + 1,
            'daysOfWeek': days_of_week
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

        return Response({
            "id": challenge.id,
            "name": challenge.name,
            "startDate": challenge.startDate,
            "endDate": challenge.endDate,
            "totalDays": (challenge.endDate - challenge.startDate).days + 1,
            "members": members,
            "schedule": schedule
        }, status=status.HTTP_200_OK)




class AddGameToScheduleView(APIView):
    @transaction.atomic
    def post(self, request):
        data = request.data
        try:
            # Get the schedule for this challenge/day
            game_schedule = get_object_or_404(
                GameSchedule,
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
        

class CreatePublichallengeView(APIView):
    @transaction.atomic
    def post(self, request):
        data = request.data
        try:
            # if No conflicts, continue to create challenge
            challenge = Challenge.objects.create(
                name=data['name'],
                groupID_id=None,
                initiator_id=data['initiator_id'],
                startDate=data['start_date'],
                endDate=data['end_date'],
                isPublic=True,
                isPending=True
            )

            # Add membershio
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

# """"
# This view creates a new sudoku game for a challenge.

# Takes challenge_id and game_id from frontend.

# Generates puzzle + solution using sudoku library.

# Saves puzzle/solution in DB with the given challenge.

# Sends back puzzle and game_id so frontend can render it.
# """
# class CreateSudokuGameView(APIView):
#     def post(self, request):
#         challenge_id = request.data.get('challenge_id')  
#         difficulty_level = request.data.get('difficulty', 'easy')  # default
#         mode = request.data.get('mode', 'single')  # 'single' or 'multi'

#         if not challenge_id :
#             return Response({'error': 'Missing challenge_id or game_id'}, status=status.HTTP_400_BAD_REQUEST)

#         try:
#             challenge = Challenge.objects.get(id=challenge_id)
#         except Challenge.DoesNotExist:
#             return Response({'error': 'Challenge not found'}, status=status.HTTP_404_NOT_FOUND)
        
#         try:
#             game = Game.objects.get(name="Sudoku")
#         except Game.DoesNotExist:
#             return Response({'error': 'Game "Sudoku" not found'}, status=500)

#         # Difficulty setting based on mode
#         if mode == 'multi':
#             difficulty_level = 'medium'
#             difficulty = 0.6  # fixed difficulty for multiplayer
#             existing_game = SudokuGameState.objects.filter(challenge=challenge, game=game).first()
#             if existing_game:
#                 return Response({
#                     'game_id': existing_game.id,
#                     'puzzle': existing_game.puzzle,
#                     'player_color' : "green",
#                     'is_multiplayer': true,
#                     'difficulty': difficulty_level,
#                     'mode': mode,}, status=status.HTTP_200_OK)                
#         else:
#             difficulty_map = {
#                 'easy': 0.05,
#                 'medium': 0.6,
#                 'hard': 0.75,
#             }
#             difficulty = difficulty_map.get(difficulty_level, 0.4)

#         # Generate Sudoku puzzle and solution
#         sudoku = Sudoku(3, 3, seed=int(time.time() * 1000)).difficulty(difficulty)
#         puzzle = sudoku.board
#         solution = sudoku.solve().board

#         # Save game state
#         game_state = SudokuGameState.objects.create(
#             game=game,
#             challenge=challenge,
#             puzzle=puzzle,
#             solution=solution
#         )

#         return Response({
#             'game_id': game_state.id,
#             'puzzle': puzzle,
#             'difficulty': difficulty_level,
#             'mode': mode,
#         }, status=status.HTTP_201_CREATED)



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

    

# class ValidateSudokuMoveView(APIView):
#     """
#     ONly for single player mode.

#         Frontend sends:
#       - game_id: the id of the Sudoku game
#       - index: a number from 0 to 80 representing the cell position
#       - value: the number the user wants to input (as integer)

#         Backend checks:
#       - Looks up the correct solution from the database
#       - If value matches the solution at that index:
#           - Updates the puzzle (marks cell with value)
#           - Returns "correct" and the new puzzle
#       - If value is wrong:
#           - Returns "incorrect" and does not change puzzle
#     """
#     def post(self, request):
#         game_id = request.data.get('game_id')
#         index = request.data.get('index')
#         value = request.data.get('value')

#         if game_id is None or index is None or value is None:
#             return Response({'error': 'Missing parameters'}, status=status.HTTP_400_BAD_REQUEST)

#         try:
#             game_state = SudokuGameState.objects.get(id=game_id)
#         except SudokuGameState.DoesNotExist:
#             return Response({'error': 'Game not found'}, status=status.HTTP_404_NOT_FOUND)

#         row, col = divmod(index, 9)

#         correct_value = game_state.solution[row][col]

#         print(f"[Backend] Checking cell ({row}, {col})")
#         print(f"[Backend] Correct value: {correct_value}")
#         print(f"[Backend] User input: {value}")

#         # --- user answer correct or not ---
#         is_correct = (correct_value == value)

#         # --- update the answer status ---
#         if request.user and request.user.is_authenticated:
#             player_record, _ = SudokuGamePlayer.objects.get_or_create(
#                 gameState=game_state,
#                 player=request.user,
#                 defaults={'accuracyCount': 0, 'inaccuracyCount': 0}
#             )

#             if is_correct:
#                 player_record.accuracyCount += 1
#             else:
#                 player_record.inaccuracyCount += 1

#             player_record.save()

#         if is_correct:
#             game_state.puzzle[row][col] = value
#             game_state.save()

#             is_complete = game_state.puzzle == game_state.solution
#             # TODO: if is_complete, send scores and remove the SudokuGameState from SudokuGameStates (as well as remove the players 
#             # from SudokuGamePlayers)

#             return Response({
#                 'success': True,
#                 'result': 'correct',
#                 'puzzle': game_state.puzzle,
#                 'completed': is_complete  
#             }, status=status.HTTP_200_OK)
#         else:
#             return Response({'success': False, 'result': 'incorrect', 'puzzle': game_state.puzzle}, status=status.HTTP_200_OK)


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



# class CompleteSudokuGameView(APIView):
#     permission_classes = [IsAuthenticated]

#     def post(self, request):
#         game_id = request.data.get('game_id')

#         if not game_id:
#             return Response({'error': 'Missing game_id'}, status=status.HTTP_400_BAD_REQUEST)

#         try:
#             game_state = SudokuGameState.objects.get(id=game_id)
#         except SudokuGameState.DoesNotExist:
#             return Response({'error': 'Game not found'}, status=status.HTTP_404_NOT_FOUND)

#         try:
#             player_record = SudokuGamePlayer.objects.get(gameState=game_state, player=request.user)
#         except SudokuGamePlayer.DoesNotExist:
#             return Response({'error': 'Player not found for this game'}, status=status.HTTP_404_NOT_FOUND)

#         if player_record.completed:
#             return Response({'success': True, 'message': 'Already completed'})

#         player_record.completed = True
#         player_record.completed_at = timezone.now()
#         player_record.save()

#         return Response({'success': True})

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

# AI was used to help generate this class


class ChallengeLeaderboardView(APIView):
    """
    GET /challenge-leaderboard/<chall_id>/
        -> overall leaderboard (unchanged)

    GET /challenge-leaderboard/<chall_id>/?history=7
        -> overall + "history" dict for the last 7 days
    """
    def get(self, request, chall_id):
        challenge = get_object_or_404(Challenge, id=chall_id)

        # -------------------- overall window --------------------
        default_since = challenge.startDate
        default_until = min(challenge.endDate, date.today())

        rows = (GamePerformance.objects
                .filter(challenge_id=chall_id,
                        date__gte=default_since,
                        date__lte=default_until)
                .values("user_id", "user__name")
                .annotate(points=Sum("score"))
                .order_by("-points", "user__name"))
        
        print(rows)

        overall, last_pts, rank = [], None, 0
        for r in rows:
            if r["points"] != last_pts:
                rank += 1
                last_pts = r["points"]
            overall.append({
                "name":  r["user__name"] or "Anonymous",
                "points": int(r["points"] or 0),
                "rank":  rank,
            })

        payload = {
            "since": str(default_since),
            "until": str(default_until),
            "leaderboard": overall,
        }

        # -------------------- optional daily history --------------------
        try:
            n_days = int(request.GET.get("history", 0))
        except ValueError:
            n_days = 0

        if n_days > 0:
            end_day   = default_until
            start_day = max(default_since, end_day - timedelta(days=n_days-1))

            # fetch all rows for that window once
            daily_qs = (GamePerformance.objects
                        .filter(challenge_id=chall_id,
                                date__gte=start_day,
                                date__lte=end_day)
                        .values("date", "user__name")
                        .annotate(points=Sum("score"))
                        .order_by("date", "-points", "user__name"))

            # group by day -> list
            grouped: dict[date, list[dict]] = defaultdict(list)
            for r in daily_qs:
                grouped[r["date"]].append(r)

            # rank inside each day
            history: dict[str, list[dict]] = {}
            for d in (start_day + timedelta(i) for i in range(n_days)):
                rows = grouped.get(d, [])
                out, last_pts, rank = [], None, 0
                for r in rows:
                    if r["points"] != last_pts:
                        rank += 1
                        last_pts = r["points"]
                    out.append({
                        "name":   r["user__name"] or "Anonymous",
                        "points": int(r["points"] or 0),
                        "rank":   rank,
                    })
                history[str(d)] = out        # even if empty → easier for UI

            payload["history"] = history

        return Response(payload, status=status.HTTP_200_OK)

# AI generated
class SubmitGameScoresView(APIView):
    """
    POST /submit-game-scores/
    Body: { challenge_id, game_name|game_id, date?, scores: [{username|user_id, score, ...}] }
    """
    def post(self, request):
        data = request.data
        challenge_id = data.get("challenge_id")
        game_id = data.get("game_id")
        game_name = data.get("game_name")
        scores = data.get("scores", [])
        date_str = data.get("date")  # 'YYYY-MM-DD' or null

        if not challenge_id or not scores or not (game_id or game_name):
            return Response({"detail": "Missing required fields."}, status=status.HTTP_400_BAD_REQUEST)

        challenge = get_object_or_404(Challenge, id=challenge_id)

        if game_id:
            game = get_object_or_404(Game, id=game_id)
        else:
            qs = Game.objects.filter(name=game_name).order_by('id')
            if not qs.exists():
                return Response({"detail": "Unknown game_name"}, status=400)
            # pick the earliest (or latest) created row deterministically
            game = qs.first()

        play_date = date_cls.fromisoformat(date_str) if date_str else date_cls.today()

        created_or_updated = 0
        with transaction.atomic():
            for row in scores:
                user = None
                if "user_id" in row:
                    user = get_object_or_404(User, id=row["user_id"])
                elif "username" in row:
                    user = get_object_or_404(User, username=row["username"])
                else:
                    return Response({"detail": "Each score needs username or user_id."}, status=400)

                sc = int(row.get("score", 0))

                # Idempotent upsert: one row per (challenge, game, user, date)
                obj, created = GamePerformance.objects.update_or_create(
                    challenge=challenge, game=game, user=user, date=play_date,
                    defaults={"score": sc}
                )
                # If prefer to accumulate multiple plays in one day:
                # if created: obj.score = sc
                # else: obj.score = F('score') + sc; obj.save(update_fields=['score'])
                created_or_updated += 1

        return Response({"ok": True, "count": created_or_updated}, status=status.HTTP_200_OK)

class ChallengeUpdateView(generics.UpdateAPIView):
    queryset = Challenge.objects.all()
    serializer_class = ChallengeSummarySerializer      # use the one you have
    permission_classes = [permissions.IsAdminUser]

class ChallengeDailyHistoryView(APIView):
    """
    GET /api/challenge-leaderboard/<chall_id>/history/
        → full daily history (challenge start ⟶ min(challenge_end, today))

    GET …/history/?start=YYYY-MM-DD&end=YYYY-MM-DD
        → history for that inclusive window
        • both params optional
        • if only one provided we treat it as *both* (single day)
    """

    def get(self, request, chall_id):
        challenge = get_object_or_404(Challenge, id=chall_id)

        # ---------- 1. parse & validate date params ----------
        def parse(d: str) -> date:
            try:
                return datetime.strptime(d, "%Y-%m-%d").date()
            except ValueError:
                raise ValidationError(f"Bad date: {d!r} (YYYY-MM-DD expected)")

        start_str = request.GET.get("start")
        end_str   = request.GET.get("end")

        if start_str and not end_str:
            end_str = start_str
        if end_str and not start_str:
            start_str = end_str

        if start_str:
            start = parse(start_str)
            end   = parse(end_str)
        else:
            start = challenge.startDate
            end   = min(challenge.endDate, date.today())

        if start < challenge.startDate or end > challenge.endDate or start > end:
            raise ValidationError("Date range outside the challenge window.")

        n_days = (end - start).days + 1

        # ---------- 2. one query for the whole window ----------
        qs = (
            GamePerformance.objects
            .filter(challenge_id=chall_id, date__gte=start, date__lte=end)
            .values("date", "user__name")
            .annotate(points=Sum("score"))
            .order_by("date", "-points", "user__name")
        )

        # ---------- 3. group + rank per day ----------
        grouped: Dict[date, List[dict]] = defaultdict(list)
        for r in qs:
            grouped[r["date"]].append(r)

        history: Dict[str, List[dict]] = {}
        for d in (start + timedelta(i) for i in range(n_days)):
            daily = grouped.get(d, [])
            out: List[dict] = []
            rank, last_pts = 0, None
            for r in daily:
                if r["points"] != last_pts:
                    rank += 1
                    last_pts = r["points"]
                out.append(
                    {
                        "name":   r["user__name"] or "Anonymous",
                        "points": int(r["points"] or 0),
                        "rank":   rank,
                    }
                )
            if out:                            # only send non-empty days
                history[str(d)] = out

        payload = {
            "since": str(start),
            "until": str(end),
            "history": history,
        }
        return Response(payload, status=status.HTTP_200_OK)