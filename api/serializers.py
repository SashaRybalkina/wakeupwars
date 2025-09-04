from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Group, User, SkillLevel, GameCategory, Challenge, GamePerformance, GameSchedule, Message, ChallengeMembership, Game, FriendRequest, PendingGroupChallenge
from django.contrib.auth.hashers import make_password
import calendar

User = get_user_model()

class PendingGroupChallengeSerializer(serializers.ModelSerializer):
    class Meta:
        model = PendingGroupChallenge
        fields = ['id', 'name', 'endDate', 'groupID']

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'name', 'email']

class RegisterSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['username', 'password', 'name', 'email']
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        validated_data['password'] = User.objects.make_random_password() if not validated_data['password'] else validated_data['password']
        validated_data['password'] = make_password(validated_data['password'])
        return super().create(validated_data)

class GroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = Group
        fields = ['id', 'name']

class FriendSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'name', 'username']

class CatSerializer(serializers.ModelSerializer):
    class Meta:
        model = GameCategory
        fields = ['id', 'categoryName']

class GameSerializer(serializers.ModelSerializer):
    class Meta:
        model = Game
        fields = ['id', 'name', 'category', 'isMultiplayer']

class SkillLevelSerializer(serializers.ModelSerializer):
    category = CatSerializer()

    class Meta:
        model = SkillLevel
        fields = ['category', 'totalEarned', 'totalPossible']


class ChallengeSummarySerializer(serializers.ModelSerializer):
    isGroupChallenge = serializers.SerializerMethodField()
    daysOfWeek = serializers.SerializerMethodField()

    class Meta:
        model = Challenge
        fields = [
            'id',
            'name',
            'startDate',
            'endDate',
            'isGroupChallenge',
            'daysOfWeek',
            'daysCompleted'
        ]

    def get_isGroupChallenge(self, obj):
        return obj.groupID is not None

    def get_daysOfWeek(self, obj):
        # Converts integers 0-6 to "Monday", etc.
        day_numbers = obj.gameschedule_set.values_list('dayOfWeek', flat=True)
        return [calendar.day_name[day][0] for day in day_numbers]


class UserProfileSerializer(serializers.ModelSerializer):
    skill_levels = SkillLevelSerializer(source='skilllevel_set', many=True)
    personal_challenges = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'name', 'skill_levels', 'personal_challenges']

    def get_personal_challenges(self, obj):
        challenges = Challenge.objects.filter(
            id__in=ChallengeMembership.objects.filter(uID=obj).values_list('challengeID', flat=True),
            groupID=None
        )
        return ChallengeSummarySerializer(challenges, many=True, context={'user': obj}).data
    
class MessageSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)
    recipient = UserSerializer(read_only=True)

    class Meta:
        model = Message
        fields = ['id', 'message', 'sender', 'recipient', 'groupID']
        
class FriendRequestSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)
    recipient = UserSerializer(read_only=True) 

    class Meta:
        model = FriendRequest
        fields = ['id', 'sender', 'recipient', 'created_at']

class CreateGroupSerializer(serializers.Serializer):
    name = serializers.CharField()
    members = serializers.ListField(
        child=serializers.IntegerField()
    )

class GroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = Group
        fields = '__all__'
