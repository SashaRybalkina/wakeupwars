"""
/**
 * @file skill.py
 * @description This file recalculates skill levels for users based on their game
 * performances. It applies recency decay to older results. It computes weighted
 * totals for each game category. It updates SkillLevel records. It returns a
 * 1-to-10 skill score for each category.
 */
"""

from datetime import datetime, timedelta, timezone
from itertools import chain
from typing import Iterable

from django.db import transaction

from .skill_config import SKILL_CONFIG
from ..models import (User, GameCategory, SkillLevel, GamePerformance)

def _recency_decay(when, half_life_days: float | None) -> float:
    if half_life_days is None or when is None:
        return 1.0
    now = datetime.now(timezone.utc)

    # calculate how many days ago the game was played
    # when is a DateField in GamePerformance; convert to aware datetime at midnight
    age_days = max(0.0, (now - datetime.combine(when, datetime.min.time(), tzinfo=timezone.utc)).total_seconds() / 86400.0)

    # after half_life_days days, the result counts half as much so after 2x, one quarter, etc.
    return 0.5 ** (age_days / half_life_days)

def _results_iter(user: User, category: GameCategory, window_days: int | None):
    qs = GamePerformance.objects.filter(user=user, game__category=category)

    # if window_days is set, only include recent results (date >= cutoff)
    if window_days is not None:
        cutoff = datetime.now(timezone.utc).date() - timedelta(days=window_days)
        qs = qs.filter(date__gte=cutoff)
    return qs.values('score', 'date').iterator()

@transaction.atomic
def recompute_skill_for_category(user: User, category: GameCategory) -> float:
    """Recompute and persist SkillLevel (totals) for a user-category.
       Returns the 1..10 display skill.
    """
    results = _results_iter(user, category, SKILL_CONFIG.WINDOW_DAYS)

    weights_earned = 0.0
    weighted_possible = 0.0
    count = 0

    # For every result, clamp score to [0, 100], compute a decay weight on how old it is, and add to totals
    # w = 1.0 -> game counts fully (recent)
    # w = 0.5 -> game counts half as much (older)
    # w = 0.25 -> game counts only a quarter as much (very old).
    for r in results:
        count += 1
        score = float(max(0, min(100, r['score'])))
        w = _recency_decay(r['date'], SKILL_CONFIG.HALF_LIFE_DAYS)
        weights_earned += score * w     # ex.) if they scored 80 on a game and w = 0.5, then only count 40
        weighted_possible += 100 * w    # ex.) with w = 0.5, the total possible points is 50 instead of 100

    sl, _ = SkillLevel.objects.select_for_update().get_or_create(user=user, category=category)

    # no games played
    if count == 0:
        sl.totalEarned = 0.0
        sl.totalPossible = 0.0
        sl.save(update_fields=['totalEarned', 'totalPossible'])
        return 0.0

    # save the new weighted totals; skill = 10 * (earned / possible)
    sl.totalEarned = weights_earned
    sl.totalPossible = max(weighted_possible, 1e-9)
    sl.save(update_fields=['totalEarned', 'totalPossible'])

    # clamp the result between 0.0 and 10.0
    skill = 10.0 * sl.totalEarned / sl.totalPossible
    skill = min(10.0, skill)
    return skill

def recompute_skill_for_user(user: User) -> dict[str, float]:
    """Recompute all categories for a user. Returns mapping {categoryName: skill(1..10)}."""
    out = {}
    for cat in GameCategory.objects.all():
        out[cat.categoryName] = recompute_skill_for_category(user, cat)
    return out