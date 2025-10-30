# api/games/typing_race_utils.py

from __future__ import annotations
from typing import List, Dict, Any
from pathlib import Path
import random
from datetime import date

from django.db import transaction
from django.utils import timezone
from asgiref.sync import sync_to_async
from django.core.cache import cache

from api.models import (
    TypingRaceGameState,
    TypingRaceGamePlayer,
    Challenge,
    Game,
    GamePerformance,
    User,
    ChallengeMembership
)

# ===============================
# Content loading
# ===============================

def _load_passages_from_file() -> List[str]:
    """
    Load typing passages from QuestionText.txt
    """
    file_path = Path(__file__).resolve().parent / "QuestionText.txt"
    if not file_path.exists():
        return [
            "The quick brown fox jumps over the lazy dog. Typing race should be smooth, accurate, and fun.",
            "Typing games are a fun way to improve your speed and accuracy.",
            "Backend logic is crucial to make real-time typing games work.",
            "Practice a little each day and your typing speed will steadily improve.",
            "Small errors add up: focus on accuracy first, and speed will follow naturally."
        ]
    with open(file_path, "r", encoding="utf-8") as f:
        return [line.strip() for line in f if line.strip()]

#TYPING_PASSAGES: List[str] = _load_passages_from_file()

TYPING_PASSAGES  = ["Typing games are a fun way to improve your speed and accuracy."]

# ===============================
# Helpers
# ===============================

def compute_multiplayer_score(rank: int, total_players: int) -> int:
    if rank < 1 or rank > total_players:
        return 0
    return int(100 * (total_players - (rank - 1)) / total_players)

def compute_single_score_from_accuracy(accuracy: float) -> float:
    accuracy = max(0.0, min(100.0, accuracy))
    return round(accuracy, 2)

# ===============================
# Core game logic
# ===============================

@transaction.atomic
def get_or_create_typing_race_game(challenge_id: int, user) -> Dict[str, Any]:
    """
    Create or reuse a TypingRaceGameState for this challenge.
    """
    challenge = Challenge.objects.select_for_update().get(id=challenge_id)
    typing_game = Game.objects.filter(name__icontains="typing").order_by("id").first()
    if typing_game is None:
        raise ValueError("No 'Typing' Game found.")

    game_state = (
        TypingRaceGameState.objects.select_for_update()
        .filter(challenge=challenge)
        .first()
    )
    if not game_state:
        text = random.choice(TYPING_PASSAGES)
        game_state = TypingRaceGameState.objects.create(
            game=typing_game,
            challenge=challenge,
            text=text,
        )

    TypingRaceGamePlayer.objects.get_or_create(
        game_state=game_state,
        player=user,
        defaults={"progress": 0.0, "accuracy": 100.0, "final_score": 0.0}
    )

    is_multiplayer = bool(getattr(game_state.game, "isMultiplayer", False))

    return {
        "game_state_id": game_state.id,
        "text": game_state.text,
        "is_multiplayer": is_multiplayer,
        "created_at": game_state.created_at.isoformat() if game_state.created_at else None,
        "join_deadline_at": game_state.join_deadline_at.isoformat() if game_state.join_deadline_at else None,
    }

@transaction.atomic
def apply_progress_update(game_state_id: int, user, total_typed: int, total_errors: int) -> Dict[str, Any]:
    """
    Multiplayer only — calculate progress and accuracy in real time.
    """
    state = TypingRaceGameState.objects.select_for_update().get(id=game_state_id)
    player, _ = TypingRaceGamePlayer.objects.select_for_update().get_or_create(
        game_state=state, player=user
    )

    text_len = len(state.text)
    progress = min((total_typed / text_len) * 100, 100.0) if text_len > 0 else 0.0
    accuracy = ((total_typed - total_errors) / total_typed) * 100.0 if total_typed > 0 else 100.0

    just_finished = False
    if progress >= 100.0 and not player.is_completed:
        player.is_completed = True
        player.finished_at = timezone.now()
        just_finished = True

    player.progress = progress
    player.accuracy = accuracy
    player.save()

    is_multiplayer = bool(getattr(state.game, "isMultiplayer", False))
    scores = _compute_leaderboard_snapshot(state, is_multiplayer)

    if is_multiplayer and just_finished:
        _assign_ranks_and_scores_for_finishers(state)
        scores = _compute_leaderboard_snapshot(state, is_multiplayer)

    return {
        "progress": round(progress, 2),
        "accuracy": round(accuracy, 2),
        "is_completed": player.is_completed,
        "final_score": round(player.final_score, 2),
        "scores": scores,
    }

@transaction.atomic
def finalize_single_result(game_state_id: int, user, accuracy: float):
    """
    Single-player: only called once after finishing typing.
    """
    state = TypingRaceGameState.objects.select_for_update().get(id=game_state_id)
    player, _ = TypingRaceGamePlayer.objects.select_for_update().get_or_create(
        game_state=state, player=user
    )

    player.progress = 100.0
    player.accuracy = accuracy
    player.is_completed = True
    player.finished_at = timezone.now()
    player.final_score = compute_single_score_from_accuracy(accuracy)
    player.save()

    # should be doing it in the frontend with submitGameView
    # # Write to GamePerformance for leaderboard
    # GamePerformance.objects.update_or_create(
    #     challenge=state.challenge,
    #     game=state.game,
    #     user=user,
    #     date=date.today(),
    #     defaults={"score": int(player.final_score)}
    # )

    return {
        "progress": player.progress,
        "accuracy": player.accuracy,
        "is_completed": True,
        "final_score": player.final_score,
        "scores": _compute_leaderboard_snapshot(state, False),
    }

# ===============================
# Leaderboard helpers
# ===============================

def _compute_leaderboard_snapshot(state: TypingRaceGameState, is_multiplayer: bool):
    """
    multiplayer: rank by final_score (0 if not completed)
    singleplayer: rank by accuracy
    """
    players = TypingRaceGamePlayer.objects.filter(game_state=state)
    if not is_multiplayer:
        return sorted(
            [{"username": p.player.username, "score": round(p.accuracy, 2)} for p in players],
            key=lambda x: x["score"], reverse=True
        )

    items = []
    for p in players:
        score = p.final_score if p.is_completed else 0
        items.append({
            "username": p.player.username,
            "score": round(score, 2),
            "progress": round(p.progress, 2),
            "accuracy": round(p.accuracy, 2),
            "rank": p.rank if p.rank else None,
            "is_completed": p.is_completed,
        })
    return sorted(items, key=lambda x: x["score"], reverse=True)

def _assign_ranks_and_scores_for_finishers(state: TypingRaceGameState):
    """
    assign ranks and final scores based on finish order
    """
    all_players = TypingRaceGamePlayer.objects.filter(game_state=state)
    finishers = list(all_players.filter(is_completed=True).exclude(finished_at=None).order_by("finished_at"))
    total = all_players.count()

    for idx, p in enumerate(finishers, start=1):
        p.rank = idx
        p.final_score = compute_multiplayer_score(idx, total)
        p.save(update_fields=["rank", "final_score"])

# ===============================
# Async wrappers (for WebSocket)
# ===============================

get_or_create_typing_race_game_async = sync_to_async(get_or_create_typing_race_game, thread_sensitive=True)
apply_progress_update_async = sync_to_async(apply_progress_update, thread_sensitive=True)
finalize_single_result_async = sync_to_async(finalize_single_result, thread_sensitive=True)
