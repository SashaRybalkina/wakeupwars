from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import (Group, User, SkillLevel, GameCategory, Challenge, GamePerformance, GameSchedule, Message, ChallengeMembership, Game,
                     FriendRequest,RewardSetting, ExternalHandle, Obligation, Payment, PaymentProvider, PaymentMethod, RewardType, PublicChallengeCategoryAssociation,
                     PublicChallengeConfiguration, )
from django.contrib.auth.hashers import make_password
import calendar
from django.utils import timezone

User = get_user_model()


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
        fields = ['id', 'name', 'category', 'isMultiplayer', 'route']

class SkillLevelSerializer(serializers.ModelSerializer):
    category = CatSerializer()

    class Meta:
        model = SkillLevel
        fields = ['category', 'totalEarned', 'totalPossible']

class ChallengeSummarySerializer(serializers.ModelSerializer):
    isGroupChallenge = serializers.SerializerMethodField()
    daysOfWeek = serializers.SerializerMethodField()
    isCompleted = serializers.SerializerMethodField()  # ← add this

    class Meta:
        model = Challenge
        fields = [
            'id', 'name', 'startDate', 'endDate', 'totalDays',
            'isGroupChallenge', 'daysOfWeek', 'daysCompleted',
            'isCompleted',
        ]

    def get_isGroupChallenge(self, obj):
        return obj.groupID is not None

    # def get_daysOfWeek(self, obj):
    #     day_numbers = obj.gameschedule_set.values_list('dayOfWeek', flat=True)
    #     return [calendar.day_name[day][0] for day in day_numbers]

    def get_daysOfWeek(self, obj):
        # Pull dayOfWeek values through ChallengeAlarmSchedule → AlarmSchedule
        day_numbers = (
            obj.challengealarmschedule_set
            .values_list("alarm_schedule__dayOfWeek", flat=True)
            .distinct()
        )

        print(list(day_numbers))

        numeric_to_label = {1: "M", 2: "T", 3: "W", 4: "TH", 5: "F", 6: "S", 7: "SU"}

        day_labels = [numeric_to_label[d] for d in sorted(day_numbers)]
        return list(day_labels)
    

    def get_isCompleted(self, obj):
        # Prefer a real model flag if you have one
        if hasattr(obj, 'isCompleted') and obj.isCompleted is not None:
            return bool(obj.isCompleted)
        # Or infer from status / ended_at / endDate
        if getattr(obj, 'status', None) == 'COMPLETED':
            return True
        if getattr(obj, 'ended_at', None):
            return True
        if obj.endDate:
            return obj.endDate < timezone.now().date()
        return False
    

class PendingPublicChallengeSummarySerializer(serializers.ModelSerializer):
    daysOfWeek = serializers.SerializerMethodField()
    numParticipants = serializers.SerializerMethodField()
    # participants = serializers.SerializerMethodField()
    categories = serializers.SerializerMethodField()
    averageSkillLevel = serializers.SerializerMethodField()

    class Meta:
        model = Challenge
        fields = [
            'id',
            'name', 
            'totalDays',
            'daysOfWeek',
            'numParticipants',
            'categories',
            'averageSkillLevel'  
        ]

    def get_daysOfWeek(self, obj):
        # Pull dayOfWeek values through ChallengeAlarmSchedule → AlarmSchedule
        day_numbers = (
            obj.challengealarmschedule_set
            .values_list("alarm_schedule__dayOfWeek", flat=True)
            .distinct()
        )

        print(list(day_numbers))

        numeric_to_label = {1: "M", 2: "T", 3: "W", 4: "TH", 5: "F", 6: "S", 7: "SU"}

        day_labels = [numeric_to_label[d] for d in sorted(day_numbers)]
        return list(day_labels)

    def get_numParticipants(self, obj):
        # Count how many ChallengeMemberships exist for this challenge
        return obj.challengemembership_set.count()
    
    def get_categories(self, obj):
        # Grab all associated category names
        categories = (
            PublicChallengeCategoryAssociation.objects
            .filter(challenge=obj)
            .select_related("category")
        )
        # Return a list of category names
        return [c.category.categoryName for c in categories if c.category]

    def get_averageSkillLevel(self, obj):
        # There should be only one PublicChallengeConfiguration per challenge
        config = PublicChallengeConfiguration.objects.filter(challenge=obj).first()
        return float(config.averageSkillLevel) if config else None
    


class PublicChallengeSummarySerializer(serializers.ModelSerializer):
    daysOfWeek = serializers.SerializerMethodField()
    categories = serializers.SerializerMethodField()
    averageSkillLevel = serializers.SerializerMethodField()

    class Meta:
        model = Challenge
        fields = [
            'id',
            'name', 
            'startDate',
            'endDate',
            'daysCompleted',
            'totalDays',
            'daysOfWeek',
            'isCompleted',
            'categories',
            'averageSkillLevel'  
        ]

    def get_daysOfWeek(self, obj):
        # Pull dayOfWeek values through ChallengeAlarmSchedule → AlarmSchedule
        day_numbers = (
            obj.challengealarmschedule_set
            .values_list("alarm_schedule__dayOfWeek", flat=True)
            .distinct()
        )

        print(list(day_numbers))

        numeric_to_label = {1: "M", 2: "T", 3: "W", 4: "TH", 5: "F", 6: "S", 7: "SU"}

        day_labels = [numeric_to_label[d] for d in sorted(day_numbers)]
        return list(day_labels)

    def get_numParticipants(self, obj):
        # Count how many ChallengeMemberships exist for this challenge
        return obj.challengemembership_set.count()
    
    def get_categories(self, obj):
        # Grab all associated category names
        categories = (
            PublicChallengeCategoryAssociation.objects
            .filter(challenge=obj)
            .select_related("category")
        )
        # Return a list of category names
        return [c.category.categoryName for c in categories if c.category]

    def get_averageSkillLevel(self, obj):
        # There should be only one PublicChallengeConfiguration per challenge
        config = PublicChallengeConfiguration.objects.filter(challenge=obj).first()
        return float(config.averageSkillLevel) if config else None


    

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
        child=serializers.IntegerField(),
        required=False,
        default=list,
        allow_empty=True
    )

class GroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = Group
        fields = '__all__'

## Generated by AI ##

# lets a user save/edit their Venmo or PayPal handle
class ExternalHandleSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExternalHandle
        fields = ['id', 'provider', 'handle']

# exposes the reward config for a challenge
class RewardSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = RewardSetting
        fields = ['type', 'amount', 'note']

    # Ensure amount is supplied when required and normalise data
    def validate(self, attrs):
        # When updating, include original instance values as fall-back
        reward_type = attrs.get('type') or (self.instance.type if self.instance else None)
        amount = attrs.get('amount')

        # For money or points rewards we REQUIRE an amount
        if reward_type in [RewardType.MONEY, RewardType.POINTS]:
            if amount is None:
                raise serializers.ValidationError({
                    'amount': 'Amount is required when reward type is money or points.'
                })
        else:
            # Custom rewards ignore amount
            attrs['amount'] = None
        return attrs

# shows one payment (cash or external)
class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ['id', 'method', 'provider', 'amount', 'note', 'status', 'payer_marked_at', 'winner_confirmed_at']

# shows what each payer owes the winner, embeds all payments, adds computed amount_paid & remaining
class ObligationSerializer(serializers.ModelSerializer):
    reward_type = serializers.CharField(source='challenge.reward_setting.type', read_only=True)
    reward_note = serializers.CharField(source='challenge.reward_setting.note', read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    amount_paid = serializers.DecimalField(max_digits=8, decimal_places=2, read_only=True)
    remaining = serializers.DecimalField(max_digits=8, decimal_places=2, read_only=True)

    payer_name = serializers.SerializerMethodField()
    payee_name = serializers.SerializerMethodField()

    class Meta:
        model = Obligation
        fields = [
            'id', 'challenge', 'payer', 'payer_name', 'payee', 'payee_name',
            'currency', 'amount', 'amount_paid', 'remaining', 'status',
            'due_at', 'points_penalty_per_day', 'agreement_accepted', 'payments', 'reward_type', 'reward_note'
        ]

    def _display_name(self, u):
        # customize order to your model fields
        return (getattr(u, 'name', '') or u.get_full_name() or u.username)

    def get_payer_name(self, obj):
        return self._display_name(obj.payer)

    def get_payee_name(self, obj):
        return self._display_name(obj.payee)

# small “input-only” serializers used when a payer records a new payment
class CashPaymentCreateSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=8, decimal_places=2)
    note = serializers.CharField(max_length=140, required=False, allow_blank=True)
    evidence_photo = serializers.ImageField(required=False)

class ExternalPaymentCreateSerializer(serializers.Serializer):
    provider = serializers.ChoiceField(choices=PaymentProvider.choices)
    amount = serializers.DecimalField(max_digits=8, decimal_places=2)
    note = serializers.CharField(max_length=140, required=False, allow_blank=True)