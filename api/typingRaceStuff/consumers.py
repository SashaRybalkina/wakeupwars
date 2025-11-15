from datetime import date, timedelta
import asyncio
from django.utils import timezone
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from asgiref.sync import sync_to_async
from django.core.cache import cache
from channels.db import database_sync_to_async
from time import time
import logging
logger = logging.getLogger(__name__)



from api.models import (
    TypingRaceGameState,
    TypingRaceGamePlayer,
    User,
    GamePerformance,
    ChallengeMembership
)
from api.typingRaceStuff.utils import apply_progress_update_async, _save_leaderboard_cache_to_db


# ===== Cache Key Helpers =====
def _conns_key(game_id: int):
    return f"typing_conns_{game_id}"

def _saved_key(game_id: int):
    return f"typing_scores_saved_{game_id}"

def _deadline_key(game_id: int):
    return f"typing_deadline_{game_id}"

def _started_key(game_id: int):
    return f"typing_started_{game_id}"


CACHE_TTL = 360
JOIN_TIMEOUT_SEC = 30

# ===== Feature switches =====
ENABLE_JOIN_DEADLINE = True
ENABLE_ENDED_CHECK = True




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

        #print(f"[Typing][CONNECT] user={self.user}, authenticated={self.user.is_authenticated}")

        # Reject unauthenticated users
        if not self.user.is_authenticated:
            #print("[Typing][DENIED] Unauthenticated user attempted to connect.")
            await self.close()
            return
        
        # === Check join deadline & game end ===
        gs = await sync_to_async(TypingRaceGameState.objects.select_related("challenge", "game").get)(id=self.game_id)

        if ENABLE_JOIN_DEADLINE:
            if not await self._check_join_deadline(gs):
                await self.accept()  # ✅ need to accept before sending
                await self.send_json({
                    "type": "error",
                    "message": "Join window has closed for this game."
                })
                await self.close(code=4001)
                logger.warning(f"[Typing][JOIN BLOCK] {self.user.username} denied by join deadline (game_id={self.game_id})")
                return

        if ENABLE_ENDED_CHECK:
            if not await self._check_game_not_ended(gs):
                await self.accept()  # ✅ need to accept before sending
                await self.send_json({
                    "type": "error",
                    "message": "This challenge has already been completed today."
                })
                await self.close(code=4002)
                logger.warning(f"[Typing][JOIN BLOCK] {self.user.username} denied because game ended (game_id={self.game_id})")
                return

        # Join the channel group
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()
        #print(f"[Typing][JOIN] {self.user.username} joined room {self.room_group_name}")

        # Update cache with connected user IDs
        conns = set(cache.get(_conns_key(self.game_id)) or [])
        conns.add(self.user.id)
        cache.set(_conns_key(self.game_id), list(conns), timeout=CACHE_TTL)
        #print(f"[Typing][CACHE] Current connections in game {self.game_id}: {list(conns)}")

        # Register player in DB
        await self._add_player()
        #print(f"[Typing][DB] Player {self.user.username} added to TypingRaceGameState {self.game_id}")

        # ✅ Get current connected users
        conns = set(cache.get(_conns_key(self.game_id)) or [])

        def get_connected_users_sync():
            users = User.objects.filter(id__in=list(conns))
            return [{"id": u.id, "name": u.username} for u in users]
        
        members = await sync_to_async(get_connected_users_sync)()

        # ✅ Send current online players to self
        await self.send_json({
            "type": "player_list",
            "players": members
        })
        #print(f"[Typing][PLAYER LIST] sent to {self.user.username}: {members}")

        # ✅ Broadcast updated online player list to others
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "player_list_update",
                "players": members,
            }
        )

        # Broadcast lobby (waiting room) state to all players
        await self._broadcast_lobby_state()

        # Notify current client of successful connection
        await self.send_json({
            "type": "connection_success",
            "message": f"Connected as {self.user.username}",
        })
        #print(f"[Typing][SEND] connection_success sent to {self.user.username}")

    async def disconnect(self, close_code):
        """Handle client disconnection and cleanup."""
        username = self.user.username
        #print(f"[Typing][DISCONNECT] user={username}, close_code={close_code}")

        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

        # Update connection cache
        conns = set(cache.get(_conns_key(self.game_id)) or [])
        if self.user.id in conns:
            conns.remove(self.user.id)
        cache.set(_conns_key(self.game_id), list(conns), timeout=CACHE_TTL)
        #print(f"[Typing][CACHE] Remaining connections: {list(conns)}")

        # Auto-save zero score for disconnected users
        await self._save_zero_score_if_needed()

        # Notify others of updated lobby state
        await self._broadcast_lobby_state()

        # Cleanup cache if no active players remain
        if not conns:
            # cache.delete(_conns_key(self.game_id))
            # cache.delete(_saved_key(self.game_id))
            # cache.delete(_deadline_key(self.game_id))
            # #print(f"[Typing][CLEANUP] Cache cleared for empty game_id={self.game_id}")
            asyncio.create_task(self._delayed_cleanup())

    # =========================
    # 💬 Handling Incoming Data
    # =========================
    async def receive_json(self, data):
        """Process messages received from the client."""
        msg_type = data.get("type")
        #print(f"[Typing][RECEIVE] {self.user.username} -> {msg_type} | data={data}")
        # recv_ts = int(time() * 1000)
        # logger.debug(f"[TIMING][RECV] user={self.user.username} type={msg_type} recv_at={recv_ts}")


        if msg_type == "start_game":
            await self._handle_start_game()
        elif msg_type == "progress_update":
            await self._handle_progress_update(
                data.get("total_typed", 0), data.get("total_errors", 0)
            )
        elif msg_type == "game_finished":
            await self._handle_game_finished()
        elif msg_type == "game_timeout":
            await self._handle_game_timeout()

        else:
            print(f"[Typing][WARN] Unknown message type={msg_type}")

    # =========================
    # 🚀 Game Event Handlers
    # =========================
    async def _handle_start_game(self):
        """Triggered when a player starts the game. Broadcast start signal."""
        #print(f"[Typing][START] Game start triggered by {self.user.username}")
        
        started_key = _started_key(self.game_id)
        if cache.get(started_key):
            #print(f"[Typing][START] Ignored duplicate start signal for game {self.game_id}")
            return
        cache.set(started_key, True, timeout=CACHE_TTL)

        # Mark joins_closed in DB
        await sync_to_async(
            TypingRaceGameState.objects.filter(id=self.game_id).update
        )(joins_closed=True)

        # Auto-assign zero scores to absent players
        await self._auto_save_zero_for_absent_players()

        #cache.delete(_deadline_key(self.game_id))
        await self.channel_layer.group_send(
            self.room_group_name,
            {"type": "join_window_closed"}
        )

    async def _handle_progress_update(self, total_typed, total_errors):
        """Handle player's progress update event."""
        # Apply progress update and get player's updated data (cache-only until finish)
        result = await apply_progress_update_async(self.game_id, self.user, total_typed, total_errors)

        # Throttle server broadcasts by time and progress delta
        throttle_key = f"typing_last_send_{self.game_id}_{self.user.id}"
        last_prog_key = f"typing_last_progress_sent_{self.game_id}_{self.user.id}"

        now_ts = time()
        last_ts = cache.get(throttle_key) or 0
        last_prog = cache.get(last_prog_key) or 0.0

        progress = float(result.get("progress", 0.0) or 0.0)
        is_completed = bool(result.get("is_completed", False))

        time_ok = (now_ts - last_ts) >= 0.1  # at most ~10 fps per user
        delta_ok = abs(progress - float(last_prog)) >= 0.5  # only if changed by >= 0.5%

        should_broadcast = is_completed or (time_ok and delta_ok)
        if not should_broadcast:
            return

        # Update throttle markers
        cache.set(throttle_key, now_ts, timeout=2)
        cache.set(last_prog_key, progress, timeout=60)

        player_snapshot = {
            "username": self.user.username,
            "progress": round(progress, 2),
            "accuracy": result.get("accuracy", 100.0),
            "is_completed": is_completed,
        }

        # Broadcast to all connected clients
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "player_progress_update",
                "player": player_snapshot,
            },
        )

        # Only run ended-check when a player completes
        if is_completed:
            await self._check_if_everyone_finished()

        #logger.warning(f"[PROGRESS][SENT] {self.user.username} broadcast progress={progress:.2f}%")

    async def _check_if_everyone_finished(self):
        """
        Trigger early game end if all *online* players have finished.
        Offline/absent players will receive 0 score automatically at the end.
        """

        # Prevent double triggers
        timeout_key = f"typing_timeout_done_{self.game_id}"
        if cache.get(timeout_key):
            return

        # Get connected online IDs
        conns = set(cache.get(_conns_key(self.game_id)) or [])

        if not conns:
            return  # no online players = do nothing

        all_done = True
        for uid in conns:
            progress_key = f"typing_progress_{self.game_id}_{uid}"
            cached = cache.get(progress_key)

            if not cached or not cached.get("is_completed"):
                all_done = False
                break

        if not all_done:
            return

        # Mark timeout as completed so no double-end
        cache.set(timeout_key, True, timeout=60)
        logger.warning(f"[Typing][EARLY END] All ONLINE players finished game_id={self.game_id}")

        # Step 1 — Persist leaderboard cache to DB
        await sync_to_async(_save_leaderboard_cache_to_db)(self.game_id)

        # Step 2 — Compute final leaderboard
        leaderboard, _ = await self._get_game_leaderboard()
        sorted_lb = sorted(leaderboard, key=lambda x: (x.get("rank") or 9999, -x["score"]))
        winner = sorted_lb[0]["username"] if sorted_lb else None

        # Step 3 — Broadcast result
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "game_complete",
                "leaderboard": sorted_lb,
                "winner": winner,
                "is_complete": True,
            },
        )

        # Step 4 — Save GamePerformance records for all players
        await asyncio.gather(
            self._save_game_performance_from_typing_results()
        )

        logger.warning(f"[Typing][EARLY END] Fully synced and broadcasted (game_id={self.game_id})")



    @database_sync_to_async
    def _get_game_leaderboard(self):
        """Run ORM safely in a synchronous thread."""

        game_state = TypingRaceGameState.objects.get(id=self.game_id)
        players = TypingRaceGamePlayer.objects.filter(game_state=game_state)

        leaderboard = []
        for p in players:
            leaderboard.append({
                "username": p.player.username,
                "score": round(p.final_score or 0, 2),
                "accuracy": round(p.accuracy or 0, 2),
                "progress": round(p.progress or 0, 2),
                "is_completed": p.is_completed,
            })

        all_done = all(p.is_completed for p in players)
        return leaderboard, all_done


    async def _handle_game_finished(self):
        """Handle player finishing the game and broadcast leaderboard if all done."""
        try:
            #print(f"[Typing][FINISH] {self.user.username} finished game {self.game_id}")
            logger.warning(f"[Typing][FINISH] {self.user.username} triggered game_finished for {self.game_id}")

            leaderboard_key = f"typing_leaderboard_{self.game_id}"
            cached_leaderboard = cache.get(leaderboard_key, [])

            # If cache has leaderboard (indicating cache-based mode)
            if cached_leaderboard:
                # make sure the leaderboard is sorted by rank
                sorted_lb = sorted(cached_leaderboard, key=lambda x: x.get("rank", 999))
                winner = sorted_lb[0]["username"] if sorted_lb else None

                # Broadcast final results to frontend
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        "type": "leaderboard_update",
                        "leaderboard": sorted_lb,
                        "winner": winner,
                    },
                )

                
                # await sync_to_async(_save_leaderboard_cache_to_db)(self.game_id)
                # logger.warning(f"[Typing][FINISH] Cached leaderboard persisted to DB for game {self.game_id}")

                # ✅ (Lazy save) Mark this player's finish in cache only — no DB yet

            else:
                
                leaderboard, all_done = await self._get_game_leaderboard()
                sorted_lb = sorted(leaderboard, key=lambda x: x["score"], reverse=True)
                winner = sorted_lb[0]["username"] if sorted_lb else None

                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        "type": "leaderboard_update",
                        "leaderboard": sorted_lb,
                        "winner": winner,
                    },
                )
                logger.warning(f"[Typing][FINISH] Fallback leaderboard broadcasted (no cache)")

        except Exception as e:
            logger.error(f"[Typing][ERROR] game_finished failed: {e}")
            await self.send_json({
                "type": "error",
                "message": f"Game finish failed: {e}"
            })

    async def _handle_game_timeout(self):
        """
        Called when game time runs out (from frontend).
        Syncs all players’ progress to DB, even if unfinished.
        """
        # ✅ prevent duplicate timeout handling
        timeout_key = f"typing_timeout_done_{self.game_id}"
        if cache.get(timeout_key):
            logger.warning(f"[Typing][TIMEOUT] Ignored duplicate timeout for game {self.game_id}")
            return
        cache.set(timeout_key, True, timeout=60)

        logger.warning(f"[Typing][TIMEOUT] Game {self.game_id} reached time limit — syncing all results")

        # ✅ Force-save all players' current progress to DB
        await sync_to_async(_save_leaderboard_cache_to_db)(self.game_id)

        # ✅ take the final leaderboard snapshot
        leaderboard, _ = await self._get_game_leaderboard()
        sorted_lb = sorted(leaderboard, key=lambda x: (x.get("rank") or 9999, -x["score"]))
        winner = sorted_lb[0]["username"] if sorted_lb else None

        # ✅ broadcast to all clients
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "game_complete",
                "leaderboard": sorted_lb,
                "winner": winner,
                "is_complete": True,
            },
        )

        # ✅ Persist both TypingRaceGamePlayer + GamePerformance (parallel for speed)
        await asyncio.gather(
            #sync_to_async(_save_leaderboard_cache_to_db)(self.game_id),
            self._save_game_performance_from_typing_results(),
        )
        logger.warning(f"[Typing][TIMEOUT] Game {self.game_id} fully synced to DB")


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
    
    async def player_progress_update(self, event):
        """Send a single player's progress update to all clients."""
        #print(f"[Typing][SEND] player_progress_update -> {self.user.username}")
        await self.send_json({
            "type": "player_progress_update",
            "player": event["player"],
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
        #print(f"[Typing][SEND] join_window_closed -> {self.user.username}")
        await self.send_json({"type": "join_window_closed"})

    async def lobby_state(self, event):
        """Forward updated lobby state to each client."""
        #print(f"[Typing][SEND] lobby_state -> {self.user.username}")
        await self.send_json(event)

    # =========================
    # 💾 Helper Methods (DB/Cache)
    # =========================
    async def _delayed_cleanup(self):
        """Wait for a short time before clearing cache ."""
        await asyncio.sleep(10)  # delay 10 seconds before cleanup
        conns = set(cache.get(_conns_key(self.game_id)) or [])
        if not conns:  # no active connections
            cache.delete_many([
                _conns_key(self.game_id),
                _saved_key(self.game_id),
                _deadline_key(self.game_id),
                _started_key(self.game_id),
                f"typing_leaderboard_{self.game_id}",
                f"typing_text_len_{self.game_id}",
            ])
            logger.warning(f"[Typing][CLEANUP] Cache fully cleared for inactive game_id={self.game_id}")

    async def _add_player(self):
        """Add or confirm player record in the database."""
        gs = await sync_to_async(TypingRaceGameState.objects.get)(id=self.game_id)
        await sync_to_async(TypingRaceGamePlayer.objects.get_or_create)(
            game_state=gs, player=self.user,
        )
    
    async def player_list_update(self, event):
        await self.send_json({
            "type": "player_list",
            "players": event["players"],
        })

    @sync_to_async
    def _get_lobby_state_data(self):
        """Run ORM queries in sync context to avoid async errors"""
        try:
            gs = TypingRaceGameState.objects.select_related("challenge").get(id=self.game_id)
        except TypingRaceGameState.DoesNotExist:
            return None, 0, []

        # Expected members in this challenge
        expected_count = ChallengeMembership.objects.filter(
            challengeID=gs.challenge
        ).count()

        # All challenge members
        members_qs = ChallengeMembership.objects.filter(
            challengeID=gs.challenge
        ).select_related("uID")
        members = [{"id": m.uID.id, "name": m.uID.username} for m in members_qs]

        return gs, expected_count, members

    async def _broadcast_lobby_state(self):
        """Broadcast current waiting room state to all connected clients."""
        conns = set(cache.get(_conns_key(self.game_id)) or [])
        ready_count = len(conns)
        logger.warning(f"[Typing][DEBUG] _broadcast_lobby_state() triggered | conns={conns}, ready_count={ready_count}")

        try:
            gs, expected_count, members = await self._get_lobby_state_data()

            if not gs:
                #print(f"[Typing][WARN] GameState {self.game_id} not found.")
                expected_count = ready_count
                members = []

            if not members:
                #print("[Typing][DEBUG] Members empty, fallback to connected users")
                def get_online_users_sync():
                    users = User.objects.filter(id__in=list(conns))
                    return [{"id": u.id, "name": u.username} for u in users]
                members = await sync_to_async(get_online_users_sync)()

        except Exception as e:
            print(f"[Typing][WARN] Could not fetch members safely: {e}")
            expected_count = ready_count
            members = []

        join_deadline_at = cache.get(_deadline_key(self.game_id))
        started_key = _started_key(self.game_id)

        join_deadline_at = cache.get(_deadline_key(self.game_id))
        if not join_deadline_at:
            join_deadline_at = (timezone.now() + timedelta(seconds=JOIN_TIMEOUT_SEC)).isoformat()
            cache.set(_deadline_key(self.game_id), join_deadline_at, timeout=CACHE_TTL)


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

        logger.warning(f"[Typing][BROADCAST] lobby_state -> {message}")
        await self.channel_layer.group_send(self.room_group_name, message)

    
    @sync_to_async
    def _save_zero_score_if_needed(self):
        """Auto-save a zero score for disconnected users with no record,
        but skip if player already completed or has cached progress."""
        try:
            gs = TypingRaceGameState.objects.select_related("challenge", "game").get(id=self.game_id)
            today = date.today()

            # check completed in DB or not
            player = TypingRaceGamePlayer.objects.filter(
                game_state=gs, player=self.user
            ).first()
            if player and player.is_completed:
                logger.warning(f"[Typing][SCORE] {self.user.username} already completed — skip zero score")
                return

            # ✅ check cache for completed status
            leaderboard_key = f"typing_leaderboard_{self.game_id}"
            lb_cache = cache.get(leaderboard_key)
            if lb_cache:
                for entry in lb_cache:
                    if entry.get("user_id") == self.user.id and entry.get("is_completed"):
                        logger.warning(f"[Typing][SCORE] {self.user.username} marked complete in cache — skip zero score")
                        return

            # ✅ check if a formal record already exists (non auto_generated)
            exists = GamePerformance.objects.filter(
                challenge=gs.challenge,
                game=gs.game,
                user=self.user,
                date=today,
                auto_generated=False,
            ).exists()
            if exists:
                logger.warning(f"[Typing][SCORE] {self.user.username} already has a score — skip zero score")
                return

            # 🧩 If none of the above conditions are met, safely create a 0 score
            GamePerformance.objects.update_or_create(
                challenge=gs.challenge,
                game=gs.game,
                user=self.user,
                date=today,
                defaults={"score": 0, "auto_generated": True},
            )
            logger.warning(f"[Typing][SCORE] Auto-saved 0 score for disconnected {self.user.username}")

        except Exception as e:
            logger.error(f"[Typing][SCORE][ERROR] Failed zero score save: {e}")


    
    @database_sync_to_async
    def _save_game_performance_from_typing_results(self):
        """
        Sync TypingRaceGamePlayer results into GamePerformance for leaderboard use.
        Called only once at the end of the match.
        """

        # --- Handle absent players before syncing performances ---
        absent_ids = cache.get(f"absent_players_{self.game_id}") or []
        try:
            state = TypingRaceGameState.objects.select_related("challenge", "game").get(id=self.game_id)
            today = date.today()

            if absent_ids and bool(getattr(state.game, 'isMultiplayer', False)):
                users = list(User.objects.filter(id__in=absent_ids))
                for user in users:
                    TypingRaceGamePlayer.objects.get_or_create(
                        game_state=state,
                        player=user,
                        defaults={
                            "final_score": 0,
                            "progress": 0,
                            "accuracy": 0,
                            "is_completed": False,
                        },
                    )
                    GamePerformance.objects.update_or_create(
                        challenge=state.challenge,
                        game=state.game,
                        user=user,
                        date=today,
                        defaults={"score": 0, "auto_generated": True},
                    )
                cache.delete(f"absent_players_{self.game_id}")
                logger.warning(
                    f"[Typing][AUTOZERO][TIMEOUT] Persisted {len(users)} absent players with 0 score"
                )

            # --- Now sync all players to GamePerformance ---
            players = TypingRaceGamePlayer.objects.filter(game_state=state)
            for p in players:
                GamePerformance.objects.update_or_create(
                    challenge=state.challenge,
                    game=state.game,
                    user=p.player,
                    date=today,
                    defaults={
                        "score": int(p.final_score or 0),
                        "auto_generated": False,
                    },
                )
            logger.warning(f"[Typing][SYNC] GamePerformance synced for game_state={self.game_id}")

        except Exception as e:
            logger.error(f"[Typing][SYNC][ERROR] Failed syncing GamePerformance: {e}")

    
    # ===== Helper: join deadline check =====
    async def _check_join_deadline(self, gs):
        now = timezone.now()
        if not getattr(gs, "join_deadline_at", None):
            gs.join_deadline_at = (gs.created_at or now) + timezone.timedelta(seconds=20)
            await sync_to_async(gs.save)(update_fields=["join_deadline_at"])

        # if joins_closed or deadline passed, block the join
        if getattr(gs, "joins_closed", False) or now > gs.join_deadline_at:
            logger.warning(f"[Typing][JOIN DEADLINE] {self.user.username} denied join for game_state={self.game_id}")
            return False  
        return True
        


    # ===== Helper: ended game check =====
    async def _check_game_not_ended(self, gs):
        try:
            is_multiplayer = bool(getattr(gs.game, "isMultiplayer", False))
        except Exception:
            is_multiplayer = False

        q = GamePerformance.objects.filter(
            challenge=gs.challenge,
            game=gs.game,
            date=timezone.localdate()
        )
        if not is_multiplayer:
            owner_id = getattr(gs, "user_id", None)
            if owner_id:
                q = q.filter(user_id=owner_id)

        ended = await sync_to_async(q.exists)()
        if ended:
            gs.joins_closed = True
            await sync_to_async(gs.save)(update_fields=["joins_closed"])
            logger.warning(f"[Typing][ENDED CHECK] {self.user.username} denied join because game already ended")
            return False
        return True
    
    async def _auto_save_zero_for_absent_players(self):
        """Just record absent players to cache; no DB writes yet."""
        gs = await sync_to_async(
            TypingRaceGameState.objects.select_related("challenge", "game").get
        )(id=self.game_id)

        if not bool(getattr(gs.game, "isMultiplayer", False)):
            return

        all_members = await sync_to_async(list)(
            ChallengeMembership.objects.filter(
                challengeID=gs.challenge
            ).select_related("uID")
        )

        connected_ids = set(cache.get(_conns_key(self.game_id)) or [])
        absent_ids = [m.uID.id for m in all_members if m.uID.id not in connected_ids]

        cache.set(f"absent_players_{self.game_id}", absent_ids, timeout=3600)
        logger.warning(f"[Typing][AUTOZERO][CACHE] Marked {len(absent_ids)} absent players for game_id={self.game_id}")






        
