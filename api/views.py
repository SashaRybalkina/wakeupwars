from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import authenticate, get_user_model
from .serializers import UserSerializer, RegisterSerializer, GroupSerializer, UserProfileSerializer, MessageSerializer, ChallengeSummarySerializer
from .models import Group, User, Message, Challenge, ChallengeMembership, GroupMembership

User = get_user_model()

class LoginView(APIView):
    def post(self, request):
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


class GroupListView(APIView):
    def get(self, request):
        groups = Group.objects.all()
        serializer = GroupSerializer(groups, many=True)
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
        members = [{'id': m.uID.id, 'name': m.uID.name} for m in memberships]

        return Response({
            'id': group.id,
            'name': group.name,
            'challenges': serializer.data,
            'members': members
        }, status=status.HTTP_200_OK)