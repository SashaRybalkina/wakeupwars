from django.db import models
from django.contrib.auth.models import AbstractUser

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
    isMultiplayer = models.BooleanField(default=False)

    class Meta:
        db_table = 'GameCategories'
        unique_together = ('categoryName', 'isMultiplayer')

    def __str__(self):
        return self.categoryName


# Games: Games available in the system, each belong to a category
class Game(models.Model):
    name = models.CharField(max_length=255, unique=True)
    category = models.ForeignKey(GameCategory, on_delete=models.CASCADE)

    class Meta:
        db_table = 'Games'

    def __str__(self):
        return self.name


# Challenges: Challenges, either personal or group challenges. might have to enforce that a user can’t have 2 challenges 
# scheduled on the same day through code instead of the db, it gets weird with the personal and group challenge cases
class Challenge(models.Model):
    groupID = models.ForeignKey(Group, null=True, blank=True, on_delete=models.CASCADE) # null if personal challenge
    startDate = models.DateField()
    endDate = models.DateField()
    name = models.CharField(max_length=255, default='Challenge')
    isCompleted = models.BooleanField(default=False)
    daysCompleted = models.IntegerField(default=0)
    # will be able to calculate total days from the start and end dates

    class Meta:
        db_table = 'Challenges'
        unique_together = ('groupID', 'name')

    def __str__(self):
        return self.name


# representing Many-to-many relationship between users and challenges
class ChallengeMembership(models.Model):
    challengeID = models.ForeignKey(Challenge, on_delete=models.CASCADE)
    uID = models.ForeignKey(User, on_delete=models.CASCADE)

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
        unique_together = ('uID', 'dayOfWeek')  # Ensure one alarm per day per user

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

    def __str__(self):
        return f"Performance by {self.user.username} in {self.game.name} on {self.date}"


# Skill Levels: Users' skill levels in the game categories
class SkillLevel(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    category = models.ForeignKey(GameCategory, on_delete=models.CASCADE)
    totalEarned = models.IntegerField()
    totalPossible = models.IntegerField()

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

