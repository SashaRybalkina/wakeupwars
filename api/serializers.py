from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import (Group, User, SkillLevel, GameCategory, Challenge, GamePerformance, GameSchedule, Message, ChallengeMembership, Game,
                     FriendRequest,RewardSetting, ExternalHandle, Obligation, Payment, PaymentProvider, PaymentMethod, RewardType, PublicChallengeCategoryAssociation,
                     PublicChallengeConfiguration, ChallengeBet,)
from django.contrib.auth.hashers import make_password
import calendar
from django.utils import timezone
from django.db.models import Sum

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    avatar = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'name', 'email', 'avatar']

    def get_avatar(self, obj):
        if obj.currentMemoji:
            return {
                "id": obj.currentMemoji.id,
                "imageUrl": obj.currentMemoji.imageUrl,
                "backgroundColor": obj.memojiBgColor or "#ffffff"
            }
        return None
    
# class FriendSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = User
#         fields = ['id', 'name', 'username']

class RegisterSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['username', 'password', 'name', 'email']
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        validated_data['password'] = User.objects.make_random_password() if not validated_data['password'] else validated_data['password']
        validated_data['password'] = make_password(validated_data['password'])
        return super().create(validated_data)


class ChallengeBetSerializer(serializers.ModelSerializer):
    initiator_name = serializers.CharField(source='initiator.username', read_only=True)
    recipient_name = serializers.CharField(source='recipient.username', read_only=True)
    initiatorId = serializers.IntegerField(source='initiator.id', read_only=True)
    recipientId = serializers.IntegerField(source='recipient.id', read_only=True)
    winnerId = serializers.SerializerMethodField()
    initiator_points = serializers.SerializerMethodField()
    recipient_points = serializers.SerializerMethodField()

    class Meta:
        model = ChallengeBet
        fields = [
            'id', 'initiatorId', 'recipientId', 'winnerId',
            'initiator_name', 'recipient_name',
            'initiator_points', 'recipient_points',
            'betAmount', 'isPending', 'isCompleted', 'isCollected',
            'initiatorRefunded', 'recipientRefunded',
        ]

    def get_initiator_points(self, obj):
        challenge = obj.challenge
        total = GamePerformance.objects.filter(challenge=challenge, user=obj.initiator).aggregate(
            total_points=Sum("score")
        )["total_points"] or 0
        return total

    def get_recipient_points(self, obj):
        challenge = obj.challenge
        total = GamePerformance.objects.filter(challenge=challenge, user=obj.recipient).aggregate(
            total_points=Sum("score")
        )["total_points"] or 0
        return total

    def get_winnerId(self, obj):
        return obj.winner.id if obj.winner else None


class GroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = Group
        fields = ['id', 'name']


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
        fields = ['id', 'message', 'sender', 'recipient', 'groupID', 'is_read']

    def to_representation(self, instance):
        """
        Hide 'is_read' from the sender (since they’ve already seen their own messages).
        Show it only to the recipient.
        """
        data = super().to_representation(instance)
        request = self.context.get('request')

        if not request or not hasattr(request, 'user'):
            data.pop('is_read', None)
            return data

        if instance.recipient_id != request.user.id:
            data.pop('is_read', None)

        return data
        
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