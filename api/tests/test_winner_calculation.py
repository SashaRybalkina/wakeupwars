"""
/**
 * @file test_winner_calculation.py
 * @description This file tests how a challenge determines its winner using
 * daily scores. It covers wins and different tie cases.
 */
"""

from django.test import TestCase
from django.utils import timezone
from django.utils import timezone
from django.utils.timezone import now, timedelta
import pytz
from rest_framework.test import APIClient

from api.models import Challenge, Game, GameCategory, GamePerformance, User

class TestWinnerCalc(TestCase):
    def setUp(self):
        # Create users
        self.user12 = User.objects.create_user(username="u12", password="pass")
        self.user13 = User.objects.create_user(username="u13", password="pass")
        self.user14 = User.objects.create_user(username="u14", password="pass")

        self.cat1 = GameCategory.objects.create(categoryName="Word")

        mountain_tz = pytz.timezone("US/Mountain")
        today_mt = timezone.now().astimezone(mountain_tz)
        tomorrow_date = (today_mt + timedelta(days=1)).date()
        # Create challenge and game
        self.challenge = Challenge.objects.create(
            groupID     = None,
            initiator   = self.user12,
            isPublic    = True,
            isPending   = False,
            startDate   = None,
            endDate     = None,
            totalDays   = 30,
            name        = 'Chall 1',
            isCompleted = True,
            daysCompleted = 1
        )
        self.game = Game.objects.create(name="Test Game", category=self.cat1, isMultiplayer=False, route='Wordle')

    def test_winner_for_sample_data_straightforward(self):
        date = timezone.now().date()

        GamePerformance.objects.create(
            challenge=self.challenge, game=self.game,
            user=self.user12, date=date, score=60
        )
        GamePerformance.objects.create(
            challenge=self.challenge, game=self.game,
            user=self.user13, date=date, score=0
        )
        GamePerformance.objects.create(
            challenge=self.challenge, game=self.game,
            user=self.user14, date=date, score=80
        )

        winner = self.challenge.get_winner_user()

        print("\nWinner returned:", winner.id if winner else None)

        # Assert the correct winner
        self.assertEqual(winner.id, self.user14.id)
        

    def test_winner_for_sample_data_tie(self):
        date = timezone.now().date()

        GamePerformance.objects.create(
            challenge=self.challenge, game=self.game,
            user=self.user12, date=date, score=60
        )
        GamePerformance.objects.create(
            challenge=self.challenge, game=self.game,
            user=self.user13, date=date, score=60
        )
        GamePerformance.objects.create(
            challenge=self.challenge, game=self.game,
            user=self.user14, date=date, score=60
        )

        winner = self.challenge.get_winner_user()

        print("\nWinner returned:", winner.id if winner else None)

        # Assert the correct winner
        self.assertIn(winner.id, [self.user12.id, self.user13.id, self.user14.id])


    def test_winner_for_sample_data_tie_for_last(self):
        date = timezone.now().date()

        GamePerformance.objects.create(
            challenge=self.challenge, game=self.game,
            user=self.user12, date=date, score=60
        )
        GamePerformance.objects.create(
            challenge=self.challenge, game=self.game,
            user=self.user13, date=date, score=60
        )
        GamePerformance.objects.create(
            challenge=self.challenge, game=self.game,
            user=self.user14, date=date, score=70
        )

        winner = self.challenge.get_winner_user()

        print("\nWinner returned:", winner.id if winner else None)

        # Assert the correct winner
        self.assertEqual(winner.id, self.user14.id)



    def test_winner_for_sample_data_partial_tie(self):
        date = timezone.now().date()

        GamePerformance.objects.create(
            challenge=self.challenge, game=self.game,
            user=self.user12, date=date, score=80
        )
        GamePerformance.objects.create(
            challenge=self.challenge, game=self.game,
            user=self.user13, date=date, score=80
        )
        GamePerformance.objects.create(
            challenge=self.challenge, game=self.game,
            user=self.user14, date=date, score=60
        )

        winner = self.challenge.get_winner_user()

        print("\nWinner returned:", winner.id if winner else None)

        # Assert the correct winner
        self.assertIn(winner.id, [self.user12.id, self.user13.id])
