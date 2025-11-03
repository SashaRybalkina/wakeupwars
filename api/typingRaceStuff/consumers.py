# ==========================================
# 🏁 Typing Race WebSocket Consumer
# ==========================================

import asyncio
from datetime import date, timedelta
from time import time
from django.utils import timezone
from django.core.cache import cache
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from asgiref.sync import sync_to_async
from channels.db import database_sync_to_async

from api.models import (
    TypingRaceGameState,
    TypingRaceGamePlayer,
    User,
    GamePerformance,
    ChallengeMembership,
)
from api.typingRaceStuff.utils import (
    apply_progress_update_async,
    _assign_ranks_and_scores_for_finishers,
    _compute_leaderboard_snapshot,
)


# ===== Cache Key Helpers =====
def _conns_key(game_id: int): return f"typing_conns_{game_id}"
def _saved_key(game_id: int): return f"typing_scores_saved_{game_id}"
def _deadline_key(game_id: int): return f"typing_deadline_{game_id}"
def _started_key(game_id: int): return f"typing_started_{game_id}"
def _finalizing_key(game_id: int): return f"typing_finalizing_{game_id}"

# ===== Config =====
CACHE_TTL = 3600
JOIN_TIMEOUT_SEC = 20
DURATION_SEC = 60  # <-- Game duration (change here to modify game length)


# ==========================================
# 🧠 TypingRaceConsumer
# ==========================================
class TypingRaceConsumer(AsyncJsonWebsocketConsumer):
    """Main WebSocket consumer handling multiplayer typing race."""

    # ======================
    # 🔌 Connection Handling
    # ======================
    async def connect(self):
        """Handle new player connection to the game room."""
        self.game_id = int(self.scope["url_route"]["kwargs"]["game_id"])
        self.room_group_name = f"typing_{self.game_id}"
        self.user: User = self.scope["user"]

        # Reject unauthenticated users
        if not self.user.is_authenticated:
            await self.close()
            return

        # Join channel group and accept connection
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

        # Store connection in cache
        conns = set(cache.get(_conns_key(self.game_id)) or [])
        conns.add(self.user.id)
        cache.set(_conns_key(self.game_id), list(conns), timeout=CACHE_TTL)

        # Ensure player exists in DB
        await self._add_player()

        # Broadcast current players and lobby state
        await self._broadcast_player_list()
        await self._broadcast_lobby_state()

        # Notify user that connection succeeded
        await self.send_json({
            "type": "connection_success",
            "message": f"Connected as {self.user.username}",
        })

    async def disconnect(self, close_code):
        """Handle player disconnection and clean up."""
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

        # Update cache by removing disconnected player
        conns = set(cache.get(_conns_key(self.game_id)) or [])
        if self.user.id in conns:
            conns.remove(self.user.id)
        cache.set(_conns_key(self.game_id), list(conns), timeout=CACHE_TTL)

        # Save zero score for disconnected player
        await self._save_zero_score_if_needed()

        # Broadcast updated lobby state
        await self._broadcast_lobby_state()

        # If no players remain, clear cache for this game
        if not conns:
            for k in [_conns_key, _saved_key, _deadline_key, _started_key]:
                cache.delete(k(self.game_id))

    # ======================
    # 💬 Message Handling
    # ======================
    async def receive_json(self, data):
        """Process messages received from clients."""
        msg_type = data.get("type")

        if msg_type == "start_game":
            await self._handle_start_game()
        elif msg_type == "progress_update":
            await self._handle_progress_update(
                data.get("total_typed", 0),
                data.get("total_errors", 0)
            )
        elif msg_type == "game_finished":
            await self._handle_game_finished()
        else:
            print(f"[Typing][WARN] Unknown message type={msg_type}")

    # ======================
    # 🚀 Game Start
    # ======================
    async def _handle_start_game(self):
        """Triggered when host/player starts the game."""
        started_key = _started_key(self.game_id)
        if cache.get(started_key):
            return  # Avoid duplicate start signals
        cache.set(started_key, True, timeout=CACHE_TTL)

        # Create synchronized start and end times
        start_time = timezone.now()
        end_time = start_time + timedelta(seconds=DURATION_SEC)

        # Broadcast start signal with timing info
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "join_window_closed",
                "duration": DURATION_SEC,
                "server_start_at": start_time.isoformat(),
                "server_end_at": end_time.isoformat(),
            },
        )

        # Launch backend countdown timer
        asyncio.create_task(self._auto_end_after_duration(DURATION_SEC))

    # ======================
    # 🚗 Progress Updates
    # ======================
    async def _handle_progress_update(self, total_typed, total_errors):
        """Handle player progress and broadcast updates."""
        throttle_key = f"typing_last_update_{self.game_id}_{self.user.id}"
        now = time()
        last_time = cache.get(throttle_key, 0)

        # Throttle updates (max every 0.2s)
        if now - last_time < 0.2:
            return
        cache.set(throttle_key, now, timeout=2)

        # Update player's progress and accuracy in DB
        result = await apply_progress_update_async(self.game_id, self.user, total_typed, total_errors)
        player_snapshot = {
            "username": self.user.username,
            "progress": result.get("progress", 0.0),
            "accuracy": result.get("accuracy", 100.0),
            "is_completed": result.get("is_completed", False),
        }

        # Broadcast player's progress to all clients
        await self.channel_layer.group_send(
            self.room_group_name,
            {"type": "player_progress_update", "player": player_snapshot},
        )

    # ======================
    # 🏁 Individual Finish
    # ======================
    async def _handle_game_finished(self):
        """Called when a player finishes typing."""
        try:
            leaderboard, all_done = await self._get_game_leaderboard()
            if all_done:
                await self._try_finalize_game()
        except Exception as e:
            await self.send_json({"type": "error", "message": f"Game finish failed: {e}"})

    # ======================
    # ⏱ Unified Timer Control
    # ======================
    async def _auto_end_after_duration(self, duration: int):
        """Automatically finalize game after duration seconds."""
        await asyncio.sleep(duration)
        print(f"[Typing][AUTO END] Game {self.game_id} timed out — finalizing...")
        await self._try_finalize_game()

    async def _try_finalize_game(self):
        """Finalize game, assign ranks, and broadcast leaderboard."""
        lock_key = _finalizing_key(self.game_id)
        if cache.get(lock_key):
            print(f"[Typing][FINALIZE] Skip duplicate finalize for game {self.game_id}")
            return
        cache.set(lock_key, True, timeout=30)

        # Compute final scores and ranks
        gs = await sync_to_async(TypingRaceGameState.objects.get)(id=self.game_id)
        await sync_to_async(_assign_ranks_and_scores_for_finishers)(gs)
        leaderboard = await sync_to_async(_compute_leaderboard_snapshot)(gs, True)
        winner = leaderboard[0]["username"] if leaderboard else None

        print(f"[Typing][FINALIZE] Broadcasting final leaderboard for game {self.game_id}")
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "game_complete",
                "leaderboard": leaderboard,
                "winner": winner,
                "is_complete": True,
            },
        )

    # ======================
    # 📡 Group Event Handlers
    # ======================
    async def join_window_closed(self, event):
        """Notify clients that the game has started."""
        await self.send_json(event)

    async def player_progress_update(self, event):
        """Send player's progress updates to all clients."""
        await self.send_json({"type": "player_progress_update", "player": event["player"]})

    async def leaderboard_update(self, event):
        """Send real-time leaderboard updates."""
        await self.send_json({
            "type": "leaderboard_update",
            "leaderboard": event.get("leaderboard", []),
            "winner": event.get("winner"),
        })

    async def game_complete(self, event):
        """Send final game results to all clients."""
        print(f"[Typing][SEND] game_complete -> {self.user.username}")
        await self.send_json({
            "type": "game_complete",
            "leaderboard": event.get("leaderboard", []),
            "winner": event.get("winner"),
            "is_complete": True,
        })

    # ======================
    # 💾 Helper Methods
    # ======================
    async def _add_player(self):
        """Create player record if not exists."""
        gs = await sync_to_async(TypingRaceGameState.objects.get)(id=self.game_id)
        await sync_to_async(TypingRaceGamePlayer.objects.get_or_create)(
            game_state=gs, player=self.user
        )

    async def _broadcast_player_list(self):
        """Broadcast the current connected players list."""
        conns = set(cache.get(_conns_key(self.game_id)) or [])

        def _get_users():
            users = User.objects.filter(id__in=list(conns))
            return [{"id": u.id, "name": u.username} for u in users]

        members = await sync_to_async(_get_users)()
        await self.channel_layer.group_send(
            self.room_group_name,
            {"type": "player_list_update", "players": members},
        )

    async def player_list_update(self, event):
        """Send updated player list to clients."""
        await self.send_json({"type": "player_list", "players": event["players"]})

    @sync_to_async
    def _get_game_leaderboard(self):
        """Get current leaderboard and completion state."""
        game_state = TypingRaceGameState.objects.get(id=self.game_id)
        players = TypingRaceGamePlayer.objects.filter(game_state=game_state)
        leaderboard = [{
            "username": p.player.username,
            "score": round(p.final_score or 0, 2),
            "accuracy": round(p.accuracy or 0, 2),
            "progress": round(p.progress or 0, 2),
            "is_completed": p.is_completed,
        } for p in players]
        all_done = all(p.is_completed for p in players)
        return leaderboard, all_done

    @sync_to_async
    def _get_lobby_state_data(self):
        """Get lobby members and challenge info."""
        gs = TypingRaceGameState.objects.select_related("challenge").get(id=self.game_id)
        expected_count = ChallengeMembership.objects.filter(challengeID=gs.challenge).count()
        members_qs = ChallengeMembership.objects.filter(challengeID=gs.challenge).select_related("uID")
        members = [{"id": m.uID.id, "name": m.uID.username} for m in members_qs]
        return gs, expected_count, members

    async def _broadcast_lobby_state(self):
        """Broadcast the current lobby (waiting room) state."""
        conns = set(cache.get(_conns_key(self.game_id)) or [])
        ready_count = len(conns)

        try:
            gs, expected_count, members = await self._get_lobby_state_data()
        except Exception:
            expected_count, members = ready_count, []

        join_deadline_at = cache.get(_deadline_key(self.game_id))
        if not join_deadline_at:
            join_deadline_at = (timezone.now() + timedelta(seconds=JOIN_TIMEOUT_SEC)).isoformat()
            cache.set(_deadline_key(self.game_id), join_deadline_at, timeout=CACHE_TTL)

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "lobby_state",
                "created_at": timezone.now().isoformat(),
                "join_deadline_at": join_deadline_at,
                "server_now": timezone.now().isoformat(),
                "ready_count": ready_count,
                "expected_count": expected_count,
                "online_ids": list(conns),
                "can_start_now": ready_count == expected_count,
                "members": members,
            },
        )

    @sync_to_async
    def _save_zero_score_if_needed(self):
        """Save 0 score for disconnected players without a record."""
        gs = TypingRaceGameState.objects.select_related("challenge", "game").get(id=self.game_id)
        today = date.today()
        exists = GamePerformance.objects.filter(
            challenge=gs.challenge, game=gs.game, user=self.user, date=today
        ).exists()
        if not exists:
            GamePerformance.objects.update_or_create(
                challenge=gs.challenge,
                game=gs.game,
                user=self.user,
                date=today,
                defaults={"score": 0, "auto_generated": True},
            )
            print(f"[Typing][SCORE] Auto-saved 0 score for {self.user.username}")
