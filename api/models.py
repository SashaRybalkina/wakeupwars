from django.db import models
from django.contrib.auth.models import AbstractUser
from django.db.models import Sum
from django.utils import timezone
from django.conf import settings

# by default, every model's table gets an auto increment integer id as the primary key. Specify a composite key with unique_together

# Extend the default Django User model
class User(AbstractUser):
    name = models.CharField(max_length=255, default='Anonymous')
    bio = models.TextField(blank=True, null=True) # can be null

    class Meta:
        db_table = 'Users'  # Define the table name

    # Provide custom related_name to avoid conflict with the default User model
    groups = models.ManyToManyField(
        'auth.Group',
        related_name='custom_user_set',  # Rename reverse relationship to avoid conflict
        blank=True
    )
    user_permissions = models.ManyToManyField(
        'auth.Permission',
        related_name='custom_user_permissions_set',  # Rename reverse relationship to avoid conflict
        blank=True
    )

    def __str__(self):
        return self.username


# Friendships: representing Many-to-many relationship between users
class Friendship(models.Model):
    uID1 = models.ForeignKey(User, related_name='friendships_initiated', on_delete=models.CASCADE)
    uID2 = models.ForeignKey(User, related_name='friendships_received', on_delete=models.CASCADE)

    class Meta:
        db_table = 'Friendships'
        unique_together = ('uID1', 'uID2')  # Composite primary key

    def __str__(self):
        return f"{self.uID1.username} <-> {self.uID2.username}"


class Group(models.Model):
    name = models.CharField(max_length=255, default='Group')
    bio = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'Groups'
    
    def __str__(self):
        return self.name


# Group_Memberships: representing Many-to-many relationship between users and groups
class GroupMembership(models.Model):
    groupID = models.ForeignKey(Group, on_delete=models.CASCADE)
    uID = models.ForeignKey(User, on_delete=models.CASCADE)

    class Meta:
        db_table = 'GroupMemberships'
        unique_together = ('groupID', 'uID')  # Composite primary key

    def __str__(self):
        return f"{self.uID.username} in {self.groupID.name}"


# Messages: private and group messages
class Message(models.Model):
    message = models.TextField()
    sender = models.ForeignKey(User, related_name='sent_messages', on_delete=models.CASCADE)
    recipient = models.ForeignKey(User, related_name='received_messages', null=True, blank=True, on_delete=models.CASCADE) # null if group message
    groupID = models.ForeignKey(Group, related_name='group_messages', null=True, blank=True, on_delete=models.CASCADE) # null if private message

    class Meta:
        db_table = 'Messages'

    def __str__(self):
        return f"Message from {self.sender.username} to {self.recipient.username if self.recipient else self.groupID.name}"


# Notifications: every time a user sends a message, insert a notification into the table for each recipient. 
# When a recipient opens the screen the message can be read from, remove their row from the table
class Notification(models.Model):
    uID = models.ForeignKey(User, on_delete=models.CASCADE)
    message = models.ForeignKey(Message, on_delete=models.CASCADE)

    class Meta:
        db_table = 'Notifications'

    def __str__(self):
        return f"Notification for {self.uID.username} regarding message {self.message.id}"


# Game Categories: Different categories of games
class GameCategory(models.Model):
    categoryName = models.CharField(max_length=255, unique=True)

    class Meta:
        db_table = 'GameCategories'

    def __str__(self):
        return self.categoryName


# Games: Games available in the system, each belong to a category
class Game(models.Model):
    name = models.CharField(max_length=255)
    category = models.ForeignKey(GameCategory, on_delete=models.CASCADE)
    isMultiplayer = models.BooleanField(null=True) # null if not yet single or multiplayer
    
    # React Native screen to navigate to for this game
    route = models.CharField(max_length=64, null=True, blank=True)

    class Meta:
        db_table = 'Games'
        unique_together = ('name', 'category')

    def __str__(self):
        return self.name


# Challenges: Challenges, either personal or group challenges. might have to enforce that a user can’t have 2 challenges 
# scheduled on the same day through code instead of the db, it gets weird with the personal and group challenge cases
class Challenge(models.Model):
    # ──────── existing columns ───────────────────────────────────────────────
    groupID     = models.ForeignKey(Group, null=True, blank=True, on_delete=models.CASCADE)
    initiator   = models.ForeignKey(User, null=True, on_delete=models.CASCADE)
    isPublic    = models.BooleanField(default=False)
    isPending   = models.BooleanField(default=False)  # waiting for invites / availability
    startDate   = models.DateField(null=True)
    endDate     = models.DateField(null=True)
    totalDays   = models.IntegerField(null=True)
    name        = models.CharField(max_length=255, default='Challenge')
    isCompleted = models.BooleanField(default=False)
    daysCompleted = models.IntegerField(default=0)

    # ──────── NEW convenience helpers ────────────────────────────────────────
    members = models.ManyToManyField(
        User,
        through='ChallengeMembership',
        through_fields=('challengeID', 'uID'),
        related_name='challenges'
    )

    winner = models.ForeignKey(               # optional denormalised reference
        User,
        null=True, blank=True,
        related_name='challenges_won',
        on_delete=models.SET_NULL
    )

    rewards_finalized = models.BooleanField(  # guard so we don’t double-create obligations
        default=False
    )

    class Meta:
        db_table = 'Challenges'
        unique_together = ('groupID', 'name')

    def __str__(self):
        return self.name

    # ─────────────────────────────────────────────────────────────────────────
    # Determine the winner (simple “highest total points” example).
    # ─────────────────────────────────────────────────────────────────────────
    def get_winner_user(self):
        """
        Return User who has the most total points in this challenge.
        Fallback to None if no participants.
        """

        qs = (
            GamePerformance.objects
            .filter(challenge=self)
            .values('user')
            .annotate(total=Sum('score'))
            .order_by('-total')
        )
        top = qs.first()
        if not top:
            return None
        return User.objects.get(id=top['user'])

    # ─────────────────────────────────────────────────────────────────────────
    # Convenience wrapper the API view can call instead of duplicating logic.
    # Creates RewardSetting/Obligations ONLY once.
    # ─────────────────────────────────────────────────────────────────────────
    def finalize_and_create_obligations(self):
        """
        Mark the challenge complete, compute winner, create RewardSetting
        (if it doesn’t exist) + Obligations for every non-winner.
        """
        from django.db import transaction
        from decimal import Decimal

        if self.rewards_finalized:
            return  # already done

        winner = self.winner or self.get_winner_user()
        if not winner:
            raise ValueError("No winner could be determined")

        self.winner = winner
        self.isCompleted = True
        self.save(update_fields=['winner', 'isCompleted'])

        rs, _ = RewardSetting.objects.get_or_create(
            challenge=self,
            defaults=dict(type=RewardType.MONEY, amount=Decimal('5'))
        )

        # Determine amount owed per payer depending on reward type
        if rs.type == RewardType.MONEY:
            reward_amount = rs.amount or Decimal('0')
            currency_code = 'USD'
        elif rs.type == RewardType.POINTS:
            reward_amount = rs.amount or Decimal('0')
            currency_code = 'PTS'  # imaginary points currency label
        else:  # custom reward – use zero-amount and let UI handle narrative
            reward_amount = Decimal('0')
            currency_code = 'CST'  # custom symbolic code

        due_at = timezone.now() + timezone.timedelta(days=7)

        with transaction.atomic():
            for payer in self.members.exclude(id=winner.id):
                Obligation.objects.get_or_create(
                    challenge=self,
                    payer=payer,
                    payee=winner,
                    defaults=dict(
                        currency=currency_code,
                        amount=reward_amount,
                        due_at=due_at,
                        points_penalty_per_day=5  # tune in settings
                    )
                )

            self.rewards_finalized = True
            self.save(update_fields=['rewards_finalized'])


    

class PublicChallengeConfiguration(models.Model):
    challenge  = models.ForeignKey(Challenge, on_delete=models.CASCADE)
    # this skill level will correspond to the specific category the challenge
    # is associated with (for misc, it will correspond to the average of all challenge
    # members skill levels in all categories)
    averageSkillLevel = models.DecimalField(max_digits=4, decimal_places=2)
    isMultiplayer = models.BooleanField()

    class Meta:
        db_table = 'PublicChallengeConfigurations'


class PublicChallengeCategoryAssociation(models.Model):
    challenge = models.ForeignKey(Challenge, on_delete=models.CASCADE) # will be a public challenge
    category = models.ForeignKey(GameCategory, on_delete=models.CASCADE, null=True)

    class Meta:
        db_table = 'PublicChallengeCategoryAssociations'
    

class UserAvailability(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    dayOfWeek = models.IntegerField()  # Integer field to store day of the week (1-7)
    alarmTime = models.TimeField()

    class Meta:
        db_table = 'UserAvailabilities'


# representing Many-to-many relationship between users and challenges
class ChallengeMembership(models.Model):
    challengeID = models.ForeignKey(Challenge, on_delete=models.CASCADE)
    uID = models.ForeignKey(User, on_delete=models.CASCADE)
    hasSetAlarms = models.BooleanField(default=False, null=True)

    class Meta:
        db_table = 'ChallengeMemberships'
        unique_together = ('challengeID', 'uID')  # Composite primary key

    def __str__(self):
        return f"{self.uID.username} in {self.challengeID.name}"


# Alarm Schedules: Alarm days/times set by users
class AlarmSchedule(models.Model):
    uID = models.ForeignKey(User, on_delete=models.CASCADE)
    dayOfWeek = models.IntegerField()  # Integer field to store day of the week (1-7)
    alarmTime = models.TimeField()

    class Meta:
        db_table = 'AlarmSchedules'
        #unique_together = ('uID', 'dayOfWeek')  # Ensure one alarm per day per user

    def __str__(self):
        return f"Alarm for {self.uID.username} on {self.dayOfWeek} at {self.alarmTime}"


# Challenge-AlarmSchedule Associations: representing m-m relationship between challenges and alarm schedules
class ChallengeAlarmSchedule(models.Model):
    challenge = models.ForeignKey(Challenge, on_delete=models.CASCADE)
    alarm_schedule = models.ForeignKey(AlarmSchedule, on_delete=models.CASCADE)

    class Meta:
        db_table = 'ChallengeAlarmSchedules'
        unique_together = ('challenge', 'alarm_schedule')

    def __str__(self):
        return f"Alarm schedule {self.alarm_schedule.id} for challenge {self.challenge.name}"
    

class PendingGroupChallengeAvailability(models.Model):
    chall = models.ForeignKey(Challenge, on_delete=models.CASCADE)
    uID = models.ForeignKey(User, on_delete=models.CASCADE)
    dayOfWeek = models.IntegerField()  # Integer field to store day of the week (1-7)
    alarmTime = models.TimeField()

    class Meta:
        db_table = 'PendingGroupChallengeAvailabilities'


class GroupChallengeInvite(models.Model):
    groupID = models.ForeignKey(Group, on_delete=models.CASCADE)
    chall = models.ForeignKey(Challenge, on_delete=models.CASCADE)
    uID = models.ForeignKey(User, on_delete=models.CASCADE)
    accepted = models.IntegerField() # 0 means declined, 1 means accepted, 2 means neither (pending)
        
    class Meta:
        db_table = 'GroupChallengeInvites'



# Game Schedules: the days of the week games are scheduled for challenges
class GameSchedule(models.Model):
    challenge = models.ForeignKey(Challenge, on_delete=models.CASCADE)
    dayOfWeek = models.IntegerField()  # Integer field for the day of the week

    class Meta:
        db_table = 'GameSchedules'
        unique_together = ('challenge', 'dayOfWeek')

    def __str__(self):
        return f"Game schedule for {self.challenge.name} on day {self.dayOfWeek}"


# GamesSchedules_Games_Associations: representing m-m relationship between games and game schedules
class GameScheduleGameAssociation(models.Model):
    game_schedule = models.ForeignKey(GameSchedule, on_delete=models.CASCADE)
    game = models.ForeignKey(Game, on_delete=models.CASCADE)
    game_order = models.IntegerField()  # Integer field to represent the order this game is supposed to be played (1st, 2nd, etc)

    class Meta:
        db_table = 'GameScheduleGameAssociations'
        unique_together = ('game_schedule', 'game_order')

    def __str__(self):
        return f"Game {self.game.name} in schedule {self.game_schedule.id} played {self.game_order}"









# Game Performances: Users' performances in every game they play
class GamePerformance(models.Model):
    challenge = models.ForeignKey(Challenge, on_delete=models.CASCADE)
    game = models.ForeignKey(Game, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    date = models.DateField()
    score = models.IntegerField()

    class Meta:
        db_table = 'GamePerformances'
        unique_together = ('challenge', 'game', 'user', 'date')

    def __str__(self):
        return f"Performance by {self.user.username} in {self.game.name} on {self.date}"


# Skill Levels: Users' skill levels in the game categories
class SkillLevel(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    category = models.ForeignKey(GameCategory, on_delete=models.CASCADE)
    totalEarned = models.IntegerField(null=True)
    totalPossible = models.IntegerField(null=True)
    # the skill level is just (totalEarned / totalPossible) x 10 to get numbers from 1-10

    class Meta:
        db_table = 'SkillLevels'
        unique_together = ('user', 'category')

    def __str__(self):
        return f"Skill level of {self.user.username} in {self.category.categoryName}"


# stores the states of currently running sudoku games (what the puzzle currently looks like, the solution, who's playing)
class SudokuGameState(models.Model):
      game = models.ForeignKey(Game, on_delete=models.CASCADE)
      challenge = models.ForeignKey(Challenge, on_delete=models.CASCADE, related_name='games')
      puzzle = models.JSONField()
      solution = models.JSONField()
      game_code = models.CharField(max_length=16, default="sudoku", editable=False)

      class Meta:
        db_table = 'SudokuGameStates'

# representing m-m relationship between SudokuGameStates and Users. Can use to keep track of player inaccuracies/accuracies
class SudokuGamePlayer(models.Model):
      gameState = models.ForeignKey(SudokuGameState, on_delete=models.CASCADE)
      player = models.ForeignKey(User, on_delete=models.CASCADE)
      accuracyCount = models.IntegerField()
      inaccuracyCount = models.IntegerField()
      color = models.CharField(max_length=30, blank=True, null=True)

    #   completed = models.BooleanField(default=False)
    #   completed_at = models.DateTimeField(null=True, blank=True)
    
      class Meta:
          db_table = 'SudokuGamePlayers'
          unique_together = ('gameState', 'player')
          
# Friend Requests: representing the friend request system
class FriendRequest(models.Model):
    sender = models.ForeignKey(User, related_name='sent_requests', on_delete=models.CASCADE)
    recipient = models.ForeignKey(User, related_name='received_requests', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'FriendRequests'
        unique_together = ('sender', 'recipient')

    def __str__(self):
        return f"{self.sender.username} → {self.recipient.username}"
    


# Pattern Memorization Game: stores the state of currently running Pattern Memorization games
class PatternMemorizationGameState(models.Model):
    game = models.ForeignKey('Game', on_delete=models.CASCADE)  # link to the general Game model
    challenge = models.ForeignKey('Challenge', on_delete=models.CASCADE, related_name='pattern_games')  # optional, for challenges
    max_rounds = models.IntegerField(default=5)  # total number of rounds in this Pattern Memorization game
    current_round = models.IntegerField(default=1)  # tracks current round
    pattern_sequence = models.JSONField(default=list)  # stores the sequence of elements/colors for the game
    is_completed = models.BooleanField(default=False)  # whether the game has ended

    class Meta:
        db_table = 'PatternMemorizationGameStates'

    def __str__(self):
        return f"PatternMemorizationGameState for challenge {self.challenge.name} (Round {self.current_round}/{self.max_rounds})"


# Pattern Memorization Game Player: representing many-to-many relationship between players and Pattern Memorization games
class PatternMemorizationGamePlayer(models.Model):
    game_state = models.ForeignKey('PatternMemorizationGameState', on_delete=models.CASCADE)  # link to PatternMemorizationGameState
    player = models.ForeignKey('User', on_delete=models.CASCADE)  # player in the game
    rounds_completed = models.IntegerField(default=0)  # how many rounds the player has completed
    score = models.IntegerField(default=0)  # total score of the player
    last_round_success = models.BooleanField(default=True)  # whether the player completed the last round successfully
    color = models.CharField(max_length=30, blank=True, null=True)

    class Meta:
        db_table = 'PatternMemorizationPlayers'
        unique_together = ('game_state', 'player')  # ensures each player has only one entry per game

    def __str__(self):
        return f"{self.player.username} in PatternMemorizationGame {self.game_state.id} (Score: {self.score})"

## Below is generated by AI ##
# Enum for allowed reward types for a challenge.
class RewardType(models.TextChoices):
    MONEY = 'money', 'Money'
    POINTS = 'points', 'Points'
    CUSTOM = 'custom', 'Custom'

# Enum for lifecycle states of an obligation to pay the winner.
class ObligationStatus(models.TextChoices):
    UNPAID = 'unpaid', 'Unpaid'
    PENDING = 'pending', 'PendingConfirm'
    PAID = 'paid', 'Paid'

# Enum for how a payment was made (cash vs external app).
class PaymentMethod(models.TextChoices):
    CASH = 'cash', 'Cash'
    EXTERNAL = 'external', 'External'
    CUSTOM = 'custom', 'Custom'

# Enum for external providers we link out to (e.g., Venmo/PayPal).
class PaymentProvider(models.TextChoices):
    VENMO = 'venmo', 'Venmo'
    PAYPAL = 'paypal', 'PayPal'
    OTHER = 'other', 'Other'

# Enum for lifecycle states of a payment record.
class PaymentStatus(models.TextChoices):
    PENDING = 'pending', 'PendingConfirm'
    CONFIRMED = 'confirmed', 'Confirmed'
    REJECTED = 'rejected', 'Rejected'

# Per-challenge configuration for reward type/amount/note.
class RewardSetting(models.Model):
    challenge = models.OneToOneField('api.Challenge', on_delete=models.CASCADE, related_name='reward_setting')
    type = models.CharField(max_length=16, choices=RewardType.choices, default=RewardType.MONEY)
    amount = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    note = models.CharField(max_length=140, blank=True)

    def __str__(self):
        return f"{self.challenge_id} - {self.type} {self.amount or ''}".strip()

# User’s saved handle for external payment apps (Venmo/PayPal).
class ExternalHandle(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='external_handles')
    provider = models.CharField(max_length=16, choices=PaymentProvider.choices)
    handle = models.CharField(max_length=128)  # venmo username, paypal.me slug, or email
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('user', 'provider')]

    def __str__(self):
        return f"{self.user} {self.provider}:{self.handle}"

# An amount a payer owes the winner for a finished challenge.
class Obligation(models.Model):
    challenge = models.ForeignKey('api.Challenge', on_delete=models.CASCADE, related_name='obligations')
    payer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reward_obligations_to_pay')
    payee = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reward_obligations_to_receive')
    currency = models.CharField(max_length=8, default='USD')
    amount = models.DecimalField(max_digits=8, decimal_places=2)
    status = models.CharField(max_length=16, choices=ObligationStatus.choices, default=ObligationStatus.UNPAID)
    due_at = models.DateTimeField()
    points_penalty_per_day = models.IntegerField(default=0)
    last_penalty_at = models.DateTimeField(null=True, blank=True)
    agreement_accepted = models.BooleanField(default=False)  # payer accepted agreement?
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('challenge', 'payer', 'payee')]

    @property
    def amount_paid(self):
        agg = self.payments.filter(status=PaymentStatus.CONFIRMED).aggregate(models.Sum('amount'))['amount__sum']
        return agg or 0

    @property
    def remaining(self):
        return max(self.amount - self.amount_paid, 0)

    def recompute_status(self, save=True):
        new_status = (ObligationStatus.PAID if self.remaining == 0
                      else (ObligationStatus.PENDING if self.payments.filter(status=PaymentStatus.PENDING).exists()
                            else ObligationStatus.UNPAID))
        self.status = new_status
        if save:
            self.save(update_fields=['status'])
        return self.status

# A single payment record (cash or external) toward an obligation.
class Payment(models.Model):
    obligation = models.ForeignKey(Obligation, on_delete=models.CASCADE, related_name='payments')
    method = models.CharField(max_length=16, choices=PaymentMethod.choices)
    provider = models.CharField(max_length=16, choices=PaymentProvider.choices, blank=True)
    amount = models.DecimalField(max_digits=8, decimal_places=2)
    note = models.CharField(max_length=140, blank=True)
    payer_marked_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=16, choices=PaymentStatus.choices, default=PaymentStatus.PENDING)
    winner_confirmed_at = models.DateTimeField(null=True, blank=True)
    evidence_photo = models.ImageField(upload_to='reward_evidence/', null=True, blank=True)

    def confirm(self):
        self.status = PaymentStatus.CONFIRMED
        self.winner_confirmed_at = timezone.now()
        self.save(update_fields=['status', 'winner_confirmed_at'])
        self.obligation.recompute_status()

    def reject(self):
        self.status = PaymentStatus.REJECTED
        self.save(update_fields=['status'])
        self.obligation.recompute_status()



# stores the states of currently running wordle games (what the puzzle currently looks like, the solution, who's playing)
class WordleGameState(models.Model):
      game = models.ForeignKey(Game, on_delete=models.CASCADE)
      challenge = models.ForeignKey(Challenge, on_delete=models.CASCADE, related_name='wordle_games')
      puzzle = models.JSONField()
      solution = models.JSONField()
      game_code = models.CharField(max_length=50, default="wordle")
      answer = models.CharField(max_length=10, blank=True, null=True)  # the chosen word
      created_at = models.DateTimeField(auto_now_add=True)

      class Meta:
        db_table = 'WordleGameStates'

# representing m-m relationship between WordleGameStates and Users. Can use to keep track of player inaccuracies/accuracies
class WordleGamePlayer(models.Model):
      gameState = models.ForeignKey(WordleGameState, on_delete=models.CASCADE)
      player = models.ForeignKey(User, on_delete=models.CASCADE)
      accuracyCount = models.IntegerField()
      inaccuracyCount = models.IntegerField()
      color = models.CharField(max_length=30, blank=True, null=True)
    
      class Meta:
          db_table = 'WordleGamePlayers'
          unique_together = ('gameState', 'player')

# keeps track of wordle moves
class WordleMove(models.Model):
    gameState = models.ForeignKey("WordleGameState", on_delete=models.CASCADE, related_name="moves")
    player = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="wordle_moves")
    row = models.IntegerField()     # attempt number (0–5)
    guess = models.CharField(max_length=10)  # guessed word (usually 5 letters)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("gameState", "player", "row")

    def __str__(self):
        return f"{self.player.username} guessed {self.guess} in game {self.gameState.id} (row {self.row})"

class PersonalChallengeInvite(models.Model):
    chall = models.ForeignKey(Challenge, on_delete=models.CASCADE, related_name='personal_invite')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_personal_chall_invites')
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_personal_chall_invites')
    # 2: pending, 1: accepted, 0: declined
    status = models.IntegerField(default=2)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'PersonalChallengeInvites'
        unique_together = ('chall', 'recipient')


