"""
/**
 * @file test_schedule_meshing.py
 * @description This file tests the logic that assigns multiplayer or
 * singleplayer games when finalizing collaborative group challenge schedules.
 */
"""

from django.utils.timezone import now, timedelta
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework.test import APIClient

from api.models import (
    AlarmSchedule,
    Challenge,
    ChallengeAlarmSchedule,
    Game,
    GameCategory,
    GameSchedule,
    GameScheduleGameAssociation,
    Group,
    PendingGroupChallengeAvailability,
    PublicChallengeCategoryAssociation,
    PublicChallengeConfiguration,
    SkillLevel,
    User,
    UserAvailability,
)


class CollabChallSetupTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="u1", password="pass")
        self.user2 = User.objects.create_user(username="u2", password="pass2")
        self.user3 = User.objects.create_user(username="u3", password="pass3")

        self.group = Group.objects.create(name="g1", bio=None)

        # default_to_multiplayer = {43: 10, 44: 12, 45: 30}
        # default_to_singleplayer = {43: 9, 44: 11, 45: 32}

        self.cat1 = GameCategory.objects.create(categoryName="Word")
        self.cat2 = GameCategory.objects.create(categoryName="Math")
        self.cat3 = GameCategory.objects.create(categoryName="Pattern")

        self.game1default = Game.objects.create(id=43, category=self.cat1, isMultiplayer=None)
        self.game2default = Game.objects.create(id=44, category=self.cat2, isMultiplayer=None)
        self.game3default = Game.objects.create(id=45, category=self.cat3, isMultiplayer=None)

        self.game1sing = Game.objects.create(id=9, category=self.cat1, isMultiplayer=False)
        self.game2sing = Game.objects.create(id=11, category=self.cat2, isMultiplayer=False)
        self.game3sing = Game.objects.create(id=32, category=self.cat3, isMultiplayer=False)

        self.game1mult = Game.objects.create(id=10, category=self.cat1, isMultiplayer=True)
        self.game2mult = Game.objects.create(id=12, category=self.cat2, isMultiplayer=True)
        self.game3mult = Game.objects.create(id=30, category=self.cat3, isMultiplayer=True)
        
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)


    def test_category_matching(self):
        c1 = Challenge.objects.create(
            groupID     = self.group,
            initiator   = self.user2,
            isPublic    = False,
            isPending   = True,
            startDate   = None,
            endDate     = None,
            totalDays   = 30,
            name        = 'Chall 1',
            isCompleted = False,
            daysCompleted = 0
        )
        gs1 = GameSchedule.objects.create(
            challenge=c1,
            dayOfWeek=1
        )
        gsga1 = GameScheduleGameAssociation.objects.create(
            game_schedule=gs1,
            game=self.game1default,
            game_order=1
        )
        gsga2 = GameScheduleGameAssociation.objects.create(
            game_schedule=gs1,
            game=self.game2default,
            game_order=2
        )
        gsga3 = GameScheduleGameAssociation.objects.create(
            game_schedule=gs1,
            game=self.game3default,
            game_order=3
        )
        gs11 = GameSchedule.objects.create(
            challenge=c1,
            dayOfWeek=2
        )
        gsga11 = GameScheduleGameAssociation.objects.create(
            game_schedule=gs11,
            game=self.game1default,
            game_order=1
        )
        gsga22 = GameScheduleGameAssociation.objects.create(
            game_schedule=gs11,
            game=self.game2default,
            game_order=2
        )
        gsga33 = GameScheduleGameAssociation.objects.create(
            game_schedule=gs11,
            game=self.game3default,
            game_order=3
        )


        a1 = PendingGroupChallengeAvailability.objects.create(
            chall=c1,
            uID=self.user,
            dayOfWeek=1,
            alarmTime="09:30:00"
        )
        a2 = PendingGroupChallengeAvailability.objects.create(
            chall=c1,
            uID=self.user2,
            dayOfWeek=1,
            alarmTime="09:30:00"
        )
        a3 = PendingGroupChallengeAvailability.objects.create(
            chall=c1,
            uID=self.user3,
            dayOfWeek=1,
            alarmTime="09:30:00"
        )

        a11 = PendingGroupChallengeAvailability.objects.create(
            chall=c1,
            uID=self.user,
            dayOfWeek=2,
            alarmTime="09:30:00"
        )
        a22 = PendingGroupChallengeAvailability.objects.create(
            chall=c1,
            uID=self.user2,
            dayOfWeek=2,
            alarmTime="09:30:00"
        )
        a33 = PendingGroupChallengeAvailability.objects.create(
            chall=c1,
            uID=self.user3,
            dayOfWeek=2,
            alarmTime="09:45:00"
        )

        # so on day 1, all games map to multiplayer, but on day 2, all games map to singleplayer

        url = f"/api/finalize-collaborative-group-challenge-schedule/{c1.id}/"
        response = self.client.post(url)

        gsga1.refresh_from_db()
        gsga2.refresh_from_db()
        gsga3.refresh_from_db()
        gsga11.refresh_from_db()
        gsga22.refresh_from_db()
        gsga33.refresh_from_db()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()

        self.assertEqual(gsga1.game, self.game1mult)
        self.assertEqual(gsga2.game, self.game2mult)
        self.assertEqual(gsga3.game, self.game3mult)

        self.assertEqual(gsga11.game, self.game1sing)
        self.assertEqual(gsga22.game, self.game2sing)
        self.assertEqual(gsga33.game, self.game3sing) 