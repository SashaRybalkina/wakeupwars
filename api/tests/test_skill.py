"""
/**
 * @file test_skill.py
 * @description This file tests skill recomputation. It checks averaging, decay,
 * window filtering, and signal-based updates.
 */
"""

from datetime import date, timedelta
import math

from django.test import TestCase
from django.utils import timezone
from freezegun import freeze_time

from api.models import GamePerformance, SkillLevel
from api.services.skill import recompute_skill_for_category
from api.services.skill_config import SKILL_CONFIG

from .utils import current_skill

# Assuming you have fixtures or setup methods for `user`, `category`, `game`, `challenge`
class SkillRecomputeTests(TestCase):

    def setUp(self):
        from api.models import User, Game, Challenge, GameCategory
        self.user = User.objects.create_user(username="u1", password="pass")
        self.category = GameCategory.objects.create(categoryName="Math")
        self.game = Game.objects.create(name="Test Game", category=self.category)
        self.challenge = Challenge.objects.create(name="Test Challenge")

    def test_never_played_returns_zero(self):
        # No GamePerformance rows exist
        skill = recompute_skill_for_category(self.user, self.category)
        sl = SkillLevel.objects.get(user=self.user, category=self.category)
        self.assertEqual(skill, 0.0)
        self.assertEqual(sl.totalEarned, 0.0)
        self.assertEqual(sl.totalPossible, 0.0)

    def test_plain_averaging_no_decay_no_window(self):
        from api.services import skill as skill_mod
        from api.services.skill_config import SkillConfig

        test_cfg = SkillConfig(WINDOW_DAYS=None, HALF_LIFE_DAYS=None)
        skill_mod.SKILL_CONFIG = test_cfg

        today = date(2025, 9, 8)
        GamePerformance.objects.create(challenge=self.challenge, game=self.game, user=self.user, date=today, score=80)
        GamePerformance.objects.create(challenge=self.challenge, game=self.game, user=self.user, date=today + timedelta(days=1), score=60)

        skill = recompute_skill_for_category(self.user, self.category)
        sl = SkillLevel.objects.get(user=self.user, category=self.category)

        self.assertAlmostEqual(sl.totalEarned, 140.0, places=6)
        self.assertAlmostEqual(sl.totalPossible, 200.0, places=6)
        self.assertAlmostEqual(skill, 7.0, places=6)

    def test_half_life_decay_weighted(self):
        from api.services import skill as skill_mod
        from api.services.skill_config import SkillConfig

        # Half-life decay test
        test_cfg = SkillConfig(WINDOW_DAYS=None, HALF_LIFE_DAYS=30.0)
        skill_mod.SKILL_CONFIG = test_cfg

        base_day = date(2025, 9, 8)
        with freeze_time(base_day):
            GamePerformance.objects.create(challenge=self.challenge, game=self.game, user=self.user, date=base_day, score=90)
            old_day = base_day - timedelta(days=30)
            GamePerformance.objects.create(challenge=self.challenge, game=self.game, user=self.user, date=old_day, score=60)

            skill = recompute_skill_for_category(self.user, self.category)
            sl = SkillLevel.objects.get(user=self.user, category=self.category)

            self.assertAlmostEqual(sl.totalEarned, 120.0, places=6)
            self.assertAlmostEqual(sl.totalPossible, 150.0, places=6)
            self.assertAlmostEqual(skill, 8.0, places=6)

    def test_windowed_only_recent_counts(self):
        from api.services import skill as skill_mod
        from api.services.skill_config import SkillConfig

        test_cfg = SkillConfig(WINDOW_DAYS=10.0, HALF_LIFE_DAYS=None)
        skill_mod.SKILL_CONFIG = test_cfg

        today = date(2025, 9, 8)
        recent = today - timedelta(days=5)
        old = today - timedelta(days=20)

        GamePerformance.objects.create(challenge=self.challenge, game=self.game, user=self.user, date=recent, score=50)
        GamePerformance.objects.create(challenge=self.challenge, game=self.game, user=self.user, date=old, score=100)

        with freeze_time(today):
            skill = recompute_skill_for_category(self.user, self.category)
            sl = SkillLevel.objects.get(user=self.user, category=self.category)

        self.assertAlmostEqual(sl.totalEarned, 50.0, places=6)
        self.assertAlmostEqual(sl.totalPossible, 100.0, places=6)
        self.assertAlmostEqual(skill, 5.0, places=6)

    def test_post_save_delete_signals_trigger_recompute(self):
        from api.services import skill as skill_mod
        from api.services.skill_config import SkillConfig

        test_cfg = SkillConfig(WINDOW_DAYS=None, HALF_LIFE_DAYS=None)
        skill_mod.SKILL_CONFIG = test_cfg

        today = date(2025, 9, 8)
        gp = GamePerformance.objects.create(challenge=self.challenge, game=self.game, user=self.user, date=today, score=70)
        sl = SkillLevel.objects.get(user=self.user, category=self.category)
        self.assertAlmostEqual(current_skill(sl), 7.0, places=6)

        # Update score → recompute
        gp.score = 90
        gp.save()
        sl.refresh_from_db()
        self.assertAlmostEqual(current_skill(sl), 9.0, places=6)

        # Delete → recompute
        gp.delete()
        sl.refresh_from_db()
        self.assertEqual(sl.totalEarned, 0.0)
        self.assertEqual(sl.totalPossible, 0.0)
        self.assertEqual(current_skill(sl), 0.0)
