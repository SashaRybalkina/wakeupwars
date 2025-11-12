# api/games/typing_race_utils.py

from __future__ import annotations
from typing import List, Dict, Any
from pathlib import Path
import random
from datetime import date
import logging, time
import asyncio, contextlib, threading
logger = logging.getLogger(__name__)


from django.db import transaction
from django.utils import timezone
from asgiref.sync import sync_to_async
from django.core.cache import cache
from datetime import timedelta

from api.models import (
    TypingRaceGameState,
    TypingRaceGamePlayer,
    Challenge,
    Game,
    GameSchedule,
    GameScheduleGameAssociation,
)

CACHE_TTL = 300

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

TYPING_PASSAGES: List[str] = _load_passages_from_file()

#TYPING_PASSAGES  = ["Typing games are a fun way to improve your speed and accuracy."]

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
def get_or_create_typing_race_game(challenge_id: int, user, allow_join: bool = True) -> Dict[str, Any]:
    """
    Create or reuse a TypingRaceGameState for this challenge.
    Auto-selects the correct Typing Race Game (single or multi) based on Challenge or GameSchedule.
    """
    # challenge = Challenge.objects.select_for_update().get(id=challenge_id)

    # # Try to get the game from GameSchedule → handles challenge with planned games
    # sched_ids = list(GameSchedule.objects.filter(challenge_id=challenge_id).values_list("id", flat=True))
    # assoc = (
    #     GameScheduleGameAssociation.objects.filter(game_schedule_id__in=sched_ids)
    #     .select_related("game")
    #     .order_by("game_order", "id")
    #     .first()
    # )

    # typing_game = assoc.game if assoc else None

    # # If not found, fallback to single/multi logic based on Challenge group
    # if not typing_game:
    #     is_group = challenge.groupID_id is not None
    #     typing_game = (
    #         Game.objects.filter(name__icontains="typing", isMultiplayer=1 if is_group else 0)
    #         .order_by("id")
    #         .first()
    #     )

    # if typing_game is None:
    #     raise ValueError("No Typing Race game found (single or multiplayer).")

    # # Reuse or create the TypingRaceGameState
    # game_state = TypingRaceGameState.objects.filter(challenge=challenge).first()
    # is_multiplayer = bool(getattr(typing_game, "isMultiplayer", False))
    # #print(f"[TYPING][get_or_create] is_multiplayer={is_multiplayer}")

    # if not game_state:
    #     text = random.choice(TYPING_PASSAGES)
    #     game_state = TypingRaceGameState.objects.create(
    #         game=typing_game,
    #         challenge=challenge,
    #         text=text,
    #         join_deadline_at=timezone.now() + timedelta(seconds=20),
    #     )
    #     #print(f"[TYPING][create] chall={challenge.id} gs={game_state.id}", flush=True)
    # else:
    #     # Use existing state, update join_deadline if missing
    #     if not getattr(game_state, "join_deadline_at", None):
    #         game_state.join_deadline_at = timezone.now() + timedelta(seconds=20)
    #         game_state.save(update_fields=["join_deadline_at"])

    # # Ensure player exists
    # if allow_join:
    #     initial_accuracy = 0.0 if getattr(typing_game, "isMultiplayer", False) else 100.0
    #     TypingRaceGamePlayer.objects.get_or_create(
    #         game_state=game_state,
    #         player=user,
    #         defaults={"progress": 0.0, "accuracy": initial_accuracy, "final_score": 0.0},
    #     )

    # return {
    #     "game_state_id": game_state.id,
    #     "text": game_state.text,
    #     "is_multiplayer": is_multiplayer,
    #     "created_at": game_state.created_at.isoformat() if game_state.created_at else None,
    #     "join_deadline_at": game_state.join_deadline_at.isoformat() if game_state.join_deadline_at else None,
    # }
    
    total_start = time.time()

    # === 1️⃣ Fetch Challenge ===
    t1 = time.time()
    try:
        challenge = Challenge.objects.get(id=challenge_id)
    except Challenge.DoesNotExist:
        raise ValueError(f"Challenge {challenge_id} not found")

    is_group = challenge.groupID_id is not None
    logger.warning(f"[TYPING][STEP1] Fetch Challenge took {(time.time()-t1)*1000:.2f}ms")

    # === 2️⃣ Get or cache Typing Game ===
    t2 = time.time()
    game_cache_key = f"typing_game_cache_{int(is_group)}"
    typing_game = cache.get(game_cache_key)
    cache_hit = typing_game is not None

    if not typing_game:
        # Filter for Typing Race games specifically to avoid mixing with other game types
        assoc = (
            GameScheduleGameAssociation.objects
            .select_related("game", "game_schedule")
            .filter(game_schedule__challenge_id=challenge_id, game__name__icontains="typing")
            .order_by("game_order", "id")
            .first()
        )
        typing_game = assoc.game if assoc else None

        if not typing_game:
            typing_game = (
                Game.objects.filter(name__icontains="typing", isMultiplayer=1 if is_group else 0)
                .order_by("id")
                .first()
            )
        if not typing_game:
            raise ValueError("No Typing Race game found (single or multiplayer).")

        cache.set(game_cache_key, typing_game, timeout=3600)

    logger.warning(f"[TYPING][STEP2] Get TypingGame (cache_hit={cache_hit}) took {(time.time()-t2)*1000:.2f}ms")

    # === 3️⃣ Get_or_create TypingRaceGameState ===
    t3 = time.time()
    ctx = transaction.atomic() if is_group else contextlib.nullcontext()
    with ctx:
        game_state, created = TypingRaceGameState.objects.get_or_create(
            challenge=challenge,
            defaults={
                "game": typing_game,
                "text": random.choice(TYPING_PASSAGES),
                "join_deadline_at": timezone.now() + timedelta(seconds=20),
            },
        )
    logger.warning(f"[TYPING][STEP3] Get_or_create GameState (created={created}) took {(time.time()-t3)*1000:.2f}ms")

    # === 4️⃣ Ensure join_deadline exists ===
    t4 = time.time()
    if not getattr(game_state, "join_deadline_at", None):
        game_state.join_deadline_at = timezone.now() + timedelta(seconds=20)
        game_state.save(update_fields=["join_deadline_at"])
    logger.warning(f"[TYPING][STEP4] Ensure join_deadline took {(time.time()-t4)*1000:.2f}ms")

    # === 5️⃣ Player creation (sync for multi, async for single) ===
    t5 = time.time()
    if allow_join:
        if typing_game.isMultiplayer:
            # 🧱 Multiplayer — must sync for lobby correctness
            TypingRaceGamePlayer.objects.get_or_create(
                game_state=game_state,
                player=user,
                defaults={"progress": 0.0, "accuracy": 0.0, "final_score": 0.0},
            )
            logger.warning("[TYPING][STEP5] Multiplayer player created synchronously")

        else:
            # 🚀 Singleplayer — return response immediately, create player in background
            def _create_player_background():
                TypingRaceGamePlayer.objects.get_or_create(
                    game_state=game_state,
                    player=user,
                    defaults={"progress": 0.0, "accuracy": 100.0, "final_score": 0.0},
                )
                logger.warning("[TYPING][STEP5] Singleplayer player created in background thread")

            threading.Thread(target=_create_player_background, daemon=True).start()
            logger.warning("[TYPING][STEP5] Singleplayer player creation deferred")

    logger.warning(f"[TYPING][STEP5] Player creation scheduling took {(time.time()-t5)*1000:.2f}ms")

    # === ✅ 6️⃣ Return immediately (especially for singleplayer) ===
    total_elapsed = (time.time() - total_start) * 1000
    logger.warning(
        f"[TYPING][PROFILE] chall={challenge_id} "
        f"{'multi' if is_group else 'single'}-player TOTAL took {total_elapsed:.2f}ms"
    )

    return {
        "game_state_id": game_state.id,
        "text": game_state.text,
        "is_multiplayer": bool(typing_game.isMultiplayer),
        "created_at": getattr(game_state.created_at, "isoformat", lambda: None)(),
        "join_deadline_at": getattr(game_state.join_deadline_at, "isoformat", lambda: None)(),
    }

@transaction.atomic
def apply_progress_update(game_state_id: int, user, correct_typed: int, total_errors: int) -> Dict[str, Any]:
    """
    Multiplayer — update ONLY THIS player's progress and accuracy.
    
    ⚡ Optimization note:
    Instead of writing to the database every time the user types a character,
    this version stores progress data in Django's cache (e.g. Redis or in-memory)
    to reduce database I/O frequency and improve real-time responsiveness.

    When the player's progress reaches 100%, it performs one final DB write.
    """

    # === ⏱ Start timing this update call (for performance monitoring) ===
    start_time = time.time()
    cache_key = f"typing_progress_{game_state_id}_{user.id}"  # Unique cache key per player per game
    leaderboard_key = f"typing_leaderboard_{game_state_id}"

    # === 🧠 Calculate player's progress and accuracy ===
    try:
        # 🚀 Try to get cached text length first (avoid DB hit)
        text_len_key = f"typing_text_len_{game_state_id}"
        text_len = cache.get(text_len_key)
        if text_len is None:
            state = TypingRaceGameState.objects.only("text").get(id=game_state_id)
            text_len = len(state.text)
            cache.set(text_len_key, text_len, timeout=360)
    except TypingRaceGameState.DoesNotExist:
        logger.warning(f"[TYPING][ERROR] GameState {game_state_id} not found.")
        return {}

    
    progress = min((correct_typed / text_len) * 100.0, 100.0) if text_len > 0 else 0.0

    # accuracy based on correct vs incorrect characters typed
    typed_total = correct_typed + total_errors  # total characters attempted
    accuracy = ((correct_typed) / typed_total) * 100.0 if typed_total > 0 else 100.0

    # === 💾 Store intermediate progress data in cache ===
    # This cached data is lightweight and temporary; no DB writes yet.
    cached_data = {
        "user_id": user.id,
        "username": user.username,
        "progress": round(progress, 2),
        "accuracy": round(accuracy, 2),
        "is_completed": progress >= 100.0,
        "finished_at": timezone.now().timestamp() if progress >= 100.0 else None,
        "updated_at": time.time(),
    }
    cache.set(cache_key, cached_data, timeout=CACHE_TTL)

    # === 🏁 Update leaderboard in cache ===
    if progress >= 100.0:
        _update_leaderboard_cache(leaderboard_key, cached_data)
        logger.warning(f"[CACHE][LEADERBOARD] {user.username} finished; leaderboard updated")

        # (Optional) Kick off background save (async task)
        # _schedule_background_save_to_db(game_state_id)

    elapsed = (time.time() - start_time) * 1000
    if int(progress) % 10 == 0 or progress >= 100.0:
        logger.warning(
            f"[CACHE][END] user={user.username} progress={progress:.2f}% acc={accuracy:.2f}% took={elapsed:.2f}ms"
        )

    # === 📤 Return snapshot for broadcast ===
    return {
        "progress": cached_data["progress"],
        "accuracy": cached_data["accuracy"],
        "is_completed": cached_data["is_completed"],
        "final_score": 0.0,
        "scores": cache.get(leaderboard_key, []),
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

def _update_leaderboard_cache(leaderboard_key: str, player_data: Dict[str, Any]):
    """
    Maintain an in-memory leaderboard stored in cache.
    Called every time a player finishes typing (progress=100%).
    """
    leaderboard = cache.get(leaderboard_key, [])

    # Prevent duplicates
    leaderboard = [p for p in leaderboard if p.get("user_id") != player_data["user_id"]]
    leaderboard.append(player_data)

    # Sort by finished_at (ascending) to determine rank
    leaderboard.sort(key=lambda x: x.get("finished_at") or float("inf"))

    # Assign ranks and compute scores
    total = len(leaderboard)
    for idx, p in enumerate(leaderboard, start=1):
        p["rank"] = idx
        p["score"] = compute_multiplayer_score(idx, total)

    cache.set(leaderboard_key, leaderboard, timeout=CACHE_TTL)
    logger.warning(f"[CACHE][LEADERBOARD][SET] {leaderboard}")

from datetime import datetime, timezone as py_tz
from django.utils.timezone import make_aware, get_current_timezone

def _save_leaderboard_cache_to_db(game_state_or_id):
    """
    🔁 Sync all cached progress (both finished and unfinished players) to MySQL.

    - Called when a multiplayer game ends (either by timeout or all finished).
    - Writes all players' latest progress, accuracy, rank, and score into DB.
    - Finished players get their rank and score.
    - Unfinished players still get recorded (progress + accuracy), but score=0 and rank=None.
    - ✅ Safe against multiple timeout triggers and will not overwrite completed players.
    """
    from datetime import datetime, timezone as py_tz
    from django.utils import timezone

    # ---- Determine game state ----
    game_state_id = (
        game_state_or_id.id if hasattr(game_state_or_id, "id") else game_state_or_id
    )
    leaderboard_key = f"typing_leaderboard_{game_state_id}"
    leaderboard = cache.get(leaderboard_key, [])

    try:
        state = (
            game_state_or_id
            if hasattr(game_state_or_id, "id")
            else TypingRaceGameState.objects.get(id=game_state_id)
        )
    except TypingRaceGameState.DoesNotExist:
        logger.error(f"[DB][SYNC] GameState {game_state_id} not found in DB.")
        return

    logger.warning(f"[DB][SYNC] Writing {len(leaderboard)} cached entries → DB (game_state={game_state_id})")

    # === ✅ Step 1: Save FINISHED players (from leaderboard cache) ===
    finished_ids = set()
    for entry in leaderboard:
        user_id = entry.get("user_id")
        if not user_id:
            logger.warning(f"[DB][SYNC] Skipped cache entry without user_id: {entry}")
            continue

        finished_ids.add(user_id)

        finished_ts = entry.get("finished_at")
        finished_at = (
            datetime.fromtimestamp(finished_ts, tz=py_tz.utc)
            if finished_ts else timezone.now()
        )

        try:
            TypingRaceGamePlayer.objects.update_or_create(
                game_state=state,
                player_id=user_id,
                defaults={
                    "progress": 100.0,
                    "accuracy": round(entry.get("accuracy", 0.0), 2),
                    "final_score": round(entry.get("score", 0.0), 2),
                    "rank": entry.get("rank"),
                    "is_completed": True,
                    "finished_at": finished_at,
                },
            )
            logger.warning(f"[DB][SYNC] ✅ Finished player {user_id} saved (rank={entry.get('rank')})")
        except Exception as e:
            logger.error(f"[DB][SYNC][ERROR] Failed to save finished player_id={user_id}: {e}")

    # === ✅ Step 2: Save UNFINISHED players (not in leaderboard) ===
    all_players = TypingRaceGamePlayer.objects.filter(game_state=state)
    unfinished_players = [
        p for p in all_players
        if p.player_id not in finished_ids and not p.is_completed and p.progress < 100
    ]

    for p in unfinished_players:
        progress_key = f"typing_progress_{game_state_id}_{p.player_id}"
        cached = cache.get(progress_key)

        progress = cached.get("progress", p.progress or 0.0) if cached else (p.progress or 0.0)
        accuracy = cached.get("accuracy", p.accuracy or 0.0) if cached else (p.accuracy or 0.0)

        try:
            p.progress = round(progress, 2)
            p.accuracy = round(accuracy, 2)
            p.is_completed = False
            p.final_score = 0.0
            p.rank = None
            p.finished_at = p.finished_at or timezone.now()
            p.save(update_fields=["progress", "accuracy", "is_completed", "final_score", "rank", "finished_at"])
            logger.warning(f"[DB][SYNC] 🕒 Unfinished player {p.player.username} saved progress={progress:.2f}% acc={accuracy:.2f}%")
        except Exception as e:
            logger.error(f"[DB][SYNC][ERROR] Failed to save unfinished player_id={p.player_id}: {e}")

    # === ✅ Cleanup cache after full sync ===
    cache.delete_many([
        leaderboard_key,
        f"typing_text_len_{game_state_id}",
    ])
    logger.warning(f"[DB][SYNC] ✅ Leaderboard + unfinished progress persisted for game {game_state_id}")


# def _assign_ranks_and_scores_for_finishers(state: TypingRaceGameState):
#     """
#     assign ranks and final scores based on finish order
#     """
#     all_players = TypingRaceGamePlayer.objects.filter(game_state=state)
#     finishers = list(all_players.filter(is_completed=True).exclude(finished_at=None).order_by("finished_at"))
#     total = all_players.count()

#     for idx, p in enumerate(finishers, start=1):
#         p.rank = idx
#         p.final_score = compute_multiplayer_score(idx, total)
#         p.save(update_fields=["rank", "final_score"])

# ===============================
# Async wrappers (for WebSocket)
# ===============================

get_or_create_typing_race_game_async = sync_to_async(get_or_create_typing_race_game, thread_sensitive=True)
apply_progress_update_async = sync_to_async(apply_progress_update, thread_sensitive=True)
finalize_single_result_async = sync_to_async(finalize_single_result, thread_sensitive=True)
