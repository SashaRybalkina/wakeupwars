from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from rest_framework import status
from django.db import transaction
from datetime import time
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.contrib.auth import authenticate, get_user_model
from .serializers import UserSerializer, RegisterSerializer, GroupSerializer, UserProfileSerializer, MessageSerializer, ChallengeSummarySerializer, CatSerializer, GameSerializer, FriendSerializer
from .models import Group, User, Message, Challenge, ChallengeMembership, GroupMembership, GameCategory, Game, GameSchedule, AlarmSchedule, ChallengeAlarmSchedule, GameScheduleGameAssociation, Friendship, GroupMembership

User = get_user_model()

class LoginView(APIView):
    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
class LoginView(APIView):
    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response({'success': False, 'error': 'Username does not exist'}, status=status.HTTP_404_NOT_FOUND)
            return Response({'success': False, 'error': 'Username does not exist'}, status=status.HTTP_404_NOT_FOUND)

        if not user.check_password(password):
            return Response({'success': False, 'error': 'Incorrect password'}, status=status.HTTP_401_UNAUTHORIZED)
            return Response({'success': False, 'error': 'Incorrect password'}, status=status.HTTP_401_UNAUTHORIZED)

        if not user.is_active:
            return Response({'success': False, 'error': 'Account is inactive'}, status=status.HTTP_403_FORBIDDEN)

        serializer = UserSerializer(user)
        return Response({'success': True, **serializer.data})


class RegisterView(APIView):
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save(is_active=True)
            return Response({'success': True, **UserSerializer(user).data}, status=status.HTTP_201_CREATED)
        return Response({'success': False, 'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


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
    def get(self, request, sing_or_mult):
        is_multiplayer = sing_or_mult == 'Multiplayer'
        cats = GameCategory.objects.filter(isMultiplayer=is_multiplayer)
        serializer = CatSerializer(cats, many=True)
        return Response(serializer.data)

class GameListView(APIView):
    def get(self, request, cat_id):
        games = Game.objects.filter(category=cat_id)
        serializer = GameSerializer(games, many=True)
        return Response(serializer.data)


class GroupDetailsView(APIView):
    def get(self, request, group_id):
        try:
            group = Group.objects.get(id=group_id)
        except Group.DoesNotExist:
            return Response({'error': 'Group not found'}, status=status.HTTP_404_NOT_FOUND)

        # Get all challenges for the group
        challenges = Challenge.objects.filter(groupID=group)

        # Use ChallengeSummarySerializer to include `daysCompleted` etc.
        serializer = ChallengeSummarySerializer(challenges, many=True, context={'user': request.user})

        memberships = GroupMembership.objects.filter(groupID=group)
        members = [{'id': m.uID.id, 'name': m.uID.name} for m in memberships] # add icons eventually

        return Response({
            'id': group.id,
            'name': group.name,
            'challenges': serializer.data,
            'members': members
        }, status=status.HTTP_200_OK)


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
        is_group = which_chall == 'Group'
        if is_group:
            group_ids = GroupMembership.objects.filter(uID=user_id).values_list('groupID', flat=True)
            challenges = Challenge.objects.filter(groupID__in=group_ids)
        else:
            challenges = Challenge.objects.filter(
                id__in=ChallengeMembership.objects.filter(uID=user_id).values_list('challengeID', flat=True),
                groupID=None
            )
        serializer = ChallengeSummarySerializer(challenges, many=True, context={'user': request.user})
        return Response(serializer.data)


class ChallengeDetailView(APIView):
    def get(self, request, chall_id):
        try:
            challenge = Challenge.objects.get(id=chall_id)
        except Challenge.DoesNotExist:
            return Response({'error': 'Challenge not found'}, status=status.HTTP_404_NOT_FOUND)

        memberships = ChallengeMembership.objects.filter(challengeID=challenge)
        members = [{'id': m.uID.id, 'name': m.uID.name} for m in memberships]

        serializer = ChallengeSummarySerializer(challenge, context={'user': request.user})
        return Response({
            **serializer.data,
            'members': members,
            'totalDays': (challenge.endDate - challenge.startDate).days + 1,
        })
        
        
class ChallengeGameScheduleView(APIView):
    def get(self, request, chall_id):
        schedules = GameSchedule.objects.filter(challenge_id=chall_id).order_by('dayOfWeek')

        challenge_alarm_schedules = ChallengeAlarmSchedule.objects.filter(challenge_id=chall_id)
        alarm_times = {
            sched.alarm_schedule.dayOfWeek: sched.alarm_schedule.alarmTime.strftime("%H:%M")
            for sched in challenge_alarm_schedules
        }

        result = []
        for schedule in schedules:
            games = GameScheduleGameAssociation.objects.filter(game_schedule=schedule).order_by('game_order')
            result.append({
                'dayOfWeek': schedule.dayOfWeek,
                'alarmTime': alarm_times.get(schedule.dayOfWeek),
                'games': [{
                    'name': g.game.name,
                    'order': g.game_order
                } for g in games]
            })

        return Response(result, status=status.HTTP_200_OK)


class CreateGroupChallengeView(APIView):
    @transaction.atomic
    def post(self, request):
        data = request.data
        try:
            # 🔍 STEP 1: Check for alarm conflicts
            conflicting = []
            for user_id in data['members']:
                for sched in data['alarm_schedule']:
                    day = sched['dayOfWeek']
                    if AlarmSchedule.objects.filter(uID_id=user_id, dayOfWeek=day).exists():
                        user = User.objects.get(id=user_id)
                        conflicting.append((user.username, day))

            if conflicting:
                return Response({
                    'error': 'Alarm conflict detected for group members.',
                    'conflicts': conflicting  # Return which users and days are in conflict
                }, status=status.HTTP_400_BAD_REQUEST)

            # if No conflicts, continue to create challenge
            challenge = Challenge.objects.create(
                name=data['name'],
                groupID_id=data['group_id'],
                startDate=data['start_date'],
                endDate=data['end_date']
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
    
    
    