from datetime import date, timedelta
import asyncio
from django.utils import timezone
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from asgiref.sync import sync_to_async
from django.core.cache import cache

from api.models import (
    TypingRaceGameState,
    TypingRaceGamePlayer,
    User,
    GamePerformance,
    ChallengeMembership
)
from api.typingRaceStuff.utils import apply_progress_update_async


# ===== Cache Key Helpers =====
def _conns_key(game_id: int):
    return f"typing_conns_{game_id}"

def _saved_key(game_id: int):
    return f"typing_scores_saved_{game_id}"

def _deadline_key(game_id: int):
    return f"typing_deadline_{game_id}"

def _started_key(game_id: int):
    return f"typing_started_{game_id}"


CACHE_TTL = 3600
JOIN_TIMEOUT_SEC = 20




# ==========================================
# 🏁 Typing Race WebSocket Consumer
# ==========================================
class TypingRaceConsumer(AsyncJsonWebsocketConsumer):
    """
    WebSocket consumer handling multiplayer typing race interactions.
    Manages connections, game states, progress updates, and score broadcasting.
    """

    # ======================
    # 🔌 Connection Handling
    # ======================
    async def connect(self):
        """Handle new client connection and add to the game room."""
        self.game_id = int(self.scope["url_route"]["kwargs"]["game_id"])
        self.room_group_name = f"typing_{self.game_id}"
        self.user: User = self.scope["user"]

        print(f"[Typing][CONNECT] user={self.user}, authenticated={self.user.is_authenticated}")

        # Reject unauthenticated users
        if not self.user.is_authenticated:
            print("[Typing][DENIED] Unauthenticated user attempted to connect.")
            await self.close()
            return

        # Join the channel group
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()
        print(f"[Typing][JOIN] {self.user.username} joined room {self.room_group_name}")

        # Update cache with connected user IDs
        conns = set(cache.get(_conns_key(self.game_id)) or [])
        conns.add(self.user.id)
        cache.set(_conns_key(self.game_id), list(conns), timeout=CACHE_TTL)
        print(f"[Typing][CACHE] Current connections in game {self.game_id}: {list(conns)}")

        # Register player in DB
        await self._add_player()
        print(f"[Typing][DB] Player {self.user.username} added to TypingRaceGameState {self.game_id}")

        # Broadcast lobby (waiting room) state to all players
        await self._broadcast_lobby_state()

        # Notify current client of successful connection
        await self.send_json({
            "type": "connection_success",
            "message": f"Connected as {self.user.username}",
        })
        print(f"[Typing][SEND] connection_success sent to {self.user.username}")

    async def disconnect(self, close_code):
        """Handle client disconnection and cleanup."""
        username = self.user.username
        print(f"[Typing][DISCONNECT] user={username}, close_code={close_code}")

        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

        # Update connection cache
        conns = set(cache.get(_conns_key(self.game_id)) or [])
        if self.user.id in conns:
            conns.remove(self.user.id)
        cache.set(_conns_key(self.game_id), list(conns), timeout=CACHE_TTL)
        print(f"[Typing][CACHE] Remaining connections: {list(conns)}")

        # Auto-save zero score for disconnected users
        await self._save_zero_score_if_needed()

        # Notify others of updated lobby state
        await self._broadcast_lobby_state()

        # Cleanup cache if no active players remain
        if not conns:
            cache.delete(_conns_key(self.game_id))
            cache.delete(_saved_key(self.game_id))
            cache.delete(_deadline_key(self.game_id))
            print(f"[Typing][CLEANUP] Cache cleared for empty game_id={self.game_id}")

    # =========================
    # 💬 Handling Incoming Data
    # =========================
    async def receive_json(self, data):
        """Process messages received from the client."""
        msg_type = data.get("type")
        print(f"[Typing][RECEIVE] {self.user.username} -> {msg_type} | data={data}")

        if msg_type == "start_game":
            await self._handle_start_game()
        elif msg_type == "progress_update":
            await self._handle_progress_update(
                data.get("total_typed", 0), data.get("total_errors", 0)
            )
        elif msg_type == "game_finished":
            await self._handle_game_finished()
        else:
            print(f"[Typing][WARN] Unknown message type={msg_type}")

    # =========================
    # 🚀 Game Event Handlers
    # =========================
    async def _handle_start_game(self):
        """Triggered when a player starts the game. Broadcast start signal."""
        print(f"[Typing][START] Game start triggered by {self.user.username}")
        
        started_key = _started_key(self.game_id)
        if cache.get(started_key):
            print(f"[Typing][START] Ignored duplicate start signal for game {self.game_id}")
            return
        cache.set(started_key, True, timeout=CACHE_TTL)

        cache.delete(_deadline_key(self.game_id))
        await self.channel_layer.group_send(
            self.room_group_name,
            {"type": "join_window_closed"}
        )

    async def _handle_progress_update(self, total_typed, total_errors):
        """Handle player's progress update event."""
        print(f"[Typing][PROGRESS] {self.user.username}: typed={total_typed}, errors={total_errors}")

        # Apply progress update and get updated leaderboard
        result = await apply_progress_update_async(self.game_id, self.user, total_typed, total_errors)
        leaderboard = result.get("scores", [])
        print(f"[Typing][LEADERBOARD] Updated leaderboard: {leaderboard}")

        # Broadcast updated leaderboard to all players
        await self.channel_layer.group_send(
            self.room_group_name,
            {"type": "leaderboard_update", "leaderboard": leaderboard},
        )

    async def _handle_game_finished(self):
        """Handle game completion logic and broadcast final results."""
        print(f"[Typing][FINISH] {self.user.username} finished game {self.game_id}")
        try:
            gs = await sync_to_async(TypingRaceGameState.objects.get)(id=self.game_id)
            all_players = await sync_to_async(list)(
                TypingRaceGamePlayer.objects.filter(game_state=gs)
            )
            leaderboard = [
                {
                    "username": p.player.username,
                    "score": round(p.final_score, 2),
                    "progress": round(p.progress, 2),
                    "accuracy": round(p.accuracy, 2),
                    "is_completed": p.is_completed,
                }
                for p in all_players
            ]

            print(f"[Typing][LEADERBOARD] Current standings={leaderboard}")
            all_done = all(p.is_completed for p in all_players)

            if all_done and leaderboard:
                sorted_lb = sorted(leaderboard, key=lambda x: x["score"], reverse=True)
                winner = sorted_lb[0]["username"]
                print(f"[Typing][COMPLETE] All players finished. Winner={winner}")
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        "type": "game_complete",
                        "leaderboard": sorted_lb,
                        "winner": winner,
                        "is_complete": True,
                    },
                )
            else:
                print(f"[Typing][WAIT] Waiting for remaining players to finish...")
        except Exception as e:
            print(f"[Typing][ERROR] Exception in game_finished: {e}")
            await self.send_json({
                "type": "error",
                "message": f"Game finish failed: {str(e)}"
            })

    # =========================
    # 📡 Group Event Handlers
    # =========================
    async def leaderboard_update(self, event):
        """Send leaderboard updates to the client."""
        print(f"[Typing][SEND] leaderboard_update -> {self.user.username}")
        await self.send_json({
            "type": "leaderboard_update",
            "leaderboard": event.get("leaderboard", []),
            "winner": event.get("winner"),
        })

    async def game_complete(self, event):
        """Send final game completion message to clients."""
        print(f"[Typing][SEND] game_complete -> {self.user.username}")
        await self.send_json({
            "type": "game_complete",
            "leaderboard": event.get("leaderboard", []),
            "winner": event.get("winner"),
            "is_complete": event.get("is_complete", True),
        })

    async def join_window_closed(self, event):
        """Notify clients that the join window (waiting room) has closed."""
        print(f"[Typing][SEND] join_window_closed -> {self.user.username}")
        await self.send_json({"type": "join_window_closed"})

    async def lobby_state(self, event):
        """Forward updated lobby state to each client."""
        print(f"[Typing][SEND] lobby_state -> {self.user.username}")
        await self.send_json(event)

    # =========================
    # 💾 Helper Methods (DB/Cache)
    # =========================
    async def _add_player(self):
        """Add or confirm player record in the database."""
        gs = await sync_to_async(TypingRaceGameState.objects.get)(id=self.game_id)
        await sync_to_async(TypingRaceGamePlayer.objects.get_or_create)(
            game_state=gs, player=self.user,
        )

    async def _broadcast_lobby_state(self):
        """Broadcast current waiting room state to all connected clients."""
        conns = set(cache.get(_conns_key(self.game_id)) or [])
        ready_count = len(conns)
        try:
            gs = await sync_to_async(TypingRaceGameState.objects.get)(id=self.game_id)
            expected_count = await sync_to_async(
                ChallengeMembership.objects.filter(challengeID=gs.challenge).count
            )()
             # 🧍 Fetch all members in this challenge for the front-end display
            members_qs = await sync_to_async(
                list
            )(ChallengeMembership.objects.filter(challengeID=gs.challenge).select_related("user"))
            members = [
                {"id": m.user.id, "name": m.user.username}
                for m in members_qs
            ]
        except Exception as e:
            print(f"[Typing][WARN] Could not fetch members: {e}")
            expected_count = ready_count
            members = []

        started_key = _started_key(self.game_id)
        join_deadline_at = cache.get(_deadline_key(self.game_id))

        # ⏳ If game not started, set join deadline once
        if not cache.get(started_key) and not join_deadline_at:
            join_deadline_at = (timezone.now() + timedelta(seconds=JOIN_TIMEOUT_SEC)).isoformat()
            cache.set(_deadline_key(self.game_id), join_deadline_at, timeout=CACHE_TTL)

            async def delayed_close():
                await asyncio.sleep(JOIN_TIMEOUT_SEC)
                if not cache.get(started_key):  # double-check not already started
                    print(f"[Typing][AUTO-CLOSE] Deadline reached for game {self.game_id}")
                    cache.set(started_key, True, timeout=CACHE_TTL)
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {"type": "join_window_closed", "server_now": timezone.now().isoformat()},
                    )

            
            asyncio.create_task(delayed_close())

        message = {
            "type": "lobby_state",
            "created_at": timezone.now().isoformat(),
            "join_deadline_at": join_deadline_at,
            "server_now": timezone.now().isoformat(),
            "ready_count": ready_count,
            "expected_count": expected_count,
            "online_ids": list(conns),
            "can_start_now": ready_count == expected_count,
            "members": members,
        }

        print(f"[Typing][BROADCAST] lobby_state -> {message}")
        await self.channel_layer.group_send(self.room_group_name, message)
    
    @sync_to_async
    def _save_zero_score_if_needed(self):
        """Auto-save a zero score for disconnected users with no record."""
        gs = TypingRaceGameState.objects.select_related("challenge", "game").get(id=self.game_id)
        today = date.today()
        exists = GamePerformance.objects.filter(
            challenge=gs.challenge,
            game=gs.game,
            user=self.user,
            date=today,
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


        
