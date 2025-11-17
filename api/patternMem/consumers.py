import json
import asyncio
from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import sync_to_async
from django.core.cache import cache
from datetime import date, timedelta

from api.models import PatternMemorizationGameState, PatternMemorizationGamePlayer, User, ChallengeMembership, GamePerformance
from api.patternMem.utils import validate_pattern_move
from api.tasks import close_join_window

# ---- Cache keys ----
def _ready_key(game_state_id: int) -> str:
    return f"pm_ready_{game_state_id}"

def _started_key(game_state_id: int) -> str:
    return f"pm_started_{game_state_id}"

def _conns_key(game_state_id: int) -> str:
    return f"pm_conns_{game_state_id}"

# NEW: global freeze key for 3-second countdown after a correct answer
def _freeze_key(game_state_id: int) -> str:
    return f"pm_freeze_{game_state_id}"

def _saved_key(game_state_id: int) -> str:
    return f"pm_scores_saved_{game_state_id}"


class PatternMemorizationConsumer(AsyncWebsocketConsumer):
    """
    Flow:
      connect → lobby_state → player_ready → (everyone ready) lobby countdown → game_start(pattern_sequence)
      → player_answer → (if correct and not final) FREEZE ALL for 3 seconds → game_start next round
      → (if final) game_over
    """

    async def connect(self):
        self.game_state_id = int(self.scope["url_route"]["kwargs"]["game_state_id"])
        self.group_name = f"pattern_{self.game_state_id}"
        self.user: User = self.scope["user"]

        # ─── join-window gating ──────────────────────────────────
        from django.utils import timezone
        now = timezone.now()

        gs: PatternMemorizationGameState = await sync_to_async(
            PatternMemorizationGameState.objects.select_related("challenge", "game").get
        )(id=self.game_state_id)

        if not gs.join_deadline_at or gs.join_deadline_at <= now:
            gs.join_deadline_at = now + timedelta(seconds=20)
            await sync_to_async(gs.save)(update_fields=["join_deadline_at"])
            cache.delete(f"pm_deadline_scheduled_{self.game_state_id}")
        if cache.add(f"pm_deadline_scheduled_{self.game_state_id}", True, timeout=3600):
            close_join_window.apply_async(args=['PatternMemorizationGameState', self.game_state_id], eta=gs.join_deadline_at)

        # closed?
        if gs.joins_closed or now > gs.join_deadline_at:
            await self.close(code=4001)  # JOINS_CLOSED
            return

        # scores already posted today?
        ended = await sync_to_async(
            GamePerformance.objects.filter(
                challenge=gs.challenge, game=gs.game, date=timezone.localdate()
            ).exists
        )()
        if ended:
            gs.joins_closed = True
            await sync_to_async(gs.save)(update_fields=["joins_closed"])
            await self.close(code=4002)  # GAME_ENDED
            return
        # ─────────────────────────────────────────────────────────

        # normal Channels handshake
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # lobby bookkeeping (same as before)
        conns = set(cache.get(_conns_key(self.game_state_id)) or [])
        conns.add(self.user.id)
        cache.set(_conns_key(self.game_state_id), list(conns), timeout=3600)

        started = bool(cache.get(_started_key(self.game_state_id)) or False)
        ready_ids = set(cache.get(_ready_key(self.game_state_id)) or [])
        expected_count = await self._get_expected_count()
        effective_ready = ready_ids & conns

        await self.send(
            text_data=json.dumps(
                {
                    "type": "lobby_state",
                    "started": started,
                    "ready_count": len(effective_ready),
                    "expected_count": expected_count,
                    "created_at": (gs.created_at.isoformat() if getattr(gs, "created_at", None) else None),
                    "join_deadline_at": (gs.join_deadline_at.isoformat() if getattr(gs, "join_deadline_at", None) else None),
                    "server_now": timezone.now().isoformat(),
                    "online_ids": list(conns),
                }
            )
        )
        await self.channel_layer.group_send(self.group_name, {
            "type": "lobby.state",
            "started": started,
            "ready_count": len(effective_ready),
            "expected_count": expected_count,
            "created_at": (gs.created_at.isoformat() if getattr(gs, "created_at", None) else None),
            "join_deadline_at": (gs.join_deadline_at.isoformat() if getattr(gs, "join_deadline_at", None) else None),
            "server_now": timezone.now().isoformat(),
            "online_ids": list(conns),
        })

    async def disconnect(self, close_code):
        # remove from online users
        conns = set(cache.get(_conns_key(self.game_state_id)) or [])
        ready = set(cache.get(_ready_key(self.game_state_id)) or [])

        if self.user.id in conns:
            conns.remove(self.user.id)
        if self.user.id in ready:
            ready.remove(self.user.id)

        cache.set(_conns_key(self.game_state_id), list(conns), timeout=3600)
        cache.set(_ready_key(self.game_state_id), list(ready), timeout=3600)

        # if no one is online, reset state (including freeze)
        if not conns:
            cache.delete(_started_key(self.game_state_id))
            cache.delete(_ready_key(self.game_state_id))
            cache.delete(_conns_key(self.game_state_id))
            cache.delete(_freeze_key(self.game_state_id))

        started = bool(cache.get(_started_key(self.game_state_id)) or False)
        expected_count = await self._get_expected_count()
        effective_ready = ready & conns
        gs = await sync_to_async(PatternMemorizationGameState.objects.only("created_at", "join_deadline_at").get)(id=self.game_state_id)
        from django.utils import timezone
        await self.channel_layer.group_send(self.group_name, {
            "type": "lobby.state",
            "started": started,
            "ready_count": len(effective_ready),
            "expected_count": expected_count,
            "created_at": (gs.created_at.isoformat() if getattr(gs, "created_at", None) else None),
            "join_deadline_at": (gs.join_deadline_at.isoformat() if getattr(gs, "join_deadline_at", None) else None),
            "server_now": timezone.now().isoformat(),
            "online_ids": list(conns),
        })

        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        msg_type = data.get("type")
        print(f"[DEBUG From Consumers] Received message: {msg_type} from user={getattr(self.user, 'username', 'anon')}")
        if msg_type == "player_ready":
            await self._handle_player_ready()
        elif msg_type == "player_answer":
            await self._handle_player_answer(data)

    # ---------------- HANDLERS ----------------

    async def _handle_player_ready(self):
        # mark user as ready
        ready_ids = set(cache.get(_ready_key(self.game_state_id)) or [])
        ready_ids.add(self.user.id)
        cache.set(_ready_key(self.game_state_id), list(ready_ids), timeout=3600)

        # count online and ready users
        conns = set(cache.get(_conns_key(self.game_state_id)) or [])
        effective_ready = ready_ids & conns

        expected = await self._get_expected_count()
        print(f"[DEBUG From Consumers] ready_count={len(ready_ids)}, effective={len(effective_ready)}, expected={expected}", flush=True)

        gs = await sync_to_async(PatternMemorizationGameState.objects.only("created_at", "join_deadline_at").get)(id=self.game_state_id)
        from django.utils import timezone
        await self.channel_layer.group_send(self.group_name, {
            "type": "lobby.state",
            "started": bool(cache.get(_started_key(self.game_state_id)) or False),
            "ready_count": len(effective_ready),
            "expected_count": expected,
            "created_at": (gs.created_at.isoformat() if getattr(gs, "created_at", None) else None),
            "join_deadline_at": (gs.join_deadline_at.isoformat() if getattr(gs, "join_deadline_at", None) else None),
            "server_now": timezone.now().isoformat(),
            "online_ids": list(conns),
        })

        # Only the first process that flips started can continue
        if expected > 0 and len(effective_ready) >= expected:
            if cache.add(_started_key(self.game_state_id), True, timeout=3600):
                # clear ready for next lobby use
                cache.set(_ready_key(self.game_state_id), [], timeout=3600)

                # lobby countdown (broadcast)
                for t in [3, 2, 1]:
                    await self.channel_layer.group_send(self.group_name, {
                        "type": "lobby.countdown",
                        "seconds": t,
                    })
                    await asyncio.sleep(1)

                # start
                await self.channel_layer.group_send(self.group_name, {
                    "type": "game.start",
                })
                print("[DEBUG From Consumers] group_send → game.start has been sent", flush=True)
                # Do NOT close join window immediately here; rely on eta-scheduled task set at open/connect

    async def _handle_player_answer(self, data):
        # NEW: reject any answers during the freeze window (3-second global pause)
        if cache.get(_freeze_key(self.game_state_id)):
            await self.send(text_data=json.dumps({
                "type": "answer_result",
                "is_correct": False,
                "is_complete": False,
                "error": "Round frozen"
            }))
            return

        round_number = data.get("round_number")
        sequence = data.get("sequence")
        print(f"[DEBUG From Consumers] Player {getattr(self.user, 'username', 'anon')} submitted answer for round {round_number}: {sequence}")

        result = await validate_pattern_move(
            game_state_id=self.game_state_id,
            user=self.user,
            round_number=round_number,
            player_sequence=sequence
        )

        # reply to the submitter immediately
        resp = {
            "type": "answer_result",
            "is_correct": result.get("is_correct", False),
            "is_complete": result.get("is_complete", False),
            "error": result.get("error"),
        }
        if "round_score" in result:
            resp["round_score"] = result["round_score"]
        await self.send(text_data=json.dumps(resp))

        # If final scores available, broadcast game over
        if result.get("is_complete"):
            scores = result.get("scores") or []
            
            print(f"[DEBUG consumer] Final scores ready to persist: {scores}")
            await self._persist_scores_once(scores)

            print(f"[DEBUG consumer] Scores persisted to GamePerformance (challenge={self.game_state_id})", flush=True)
            await self.channel_layer.group_send(self.group_name, {
                "type": "game.over",
                "scores": scores
            })
            return

        # If correct & not complete: freeze all players, do a 3-2-1 countdown, then start next round
        if result.get("is_correct") and not result.get("is_complete"):
            print(f"[DEBUG From Consumers] Player {getattr(self.user, 'username', 'anon')} triggered countdown for next round", flush=True)

            # NEW: Only the first correct submission should trigger the countdown
            is_first = cache.add(_freeze_key(self.game_state_id), True, timeout=3)
            if is_first:
                # Broadcast in-game countdown
                for t in [3, 2, 1]:
                    await self.channel_layer.group_send(self.group_name, {
                        "type": "round.countdown",  # handled by round_countdown()
                        "seconds": t,
                    })
                    await asyncio.sleep(1)

                # Clear freeze flag (TTL also clears, this is defensive)
                cache.delete(_freeze_key(self.game_state_id))

                # Start next round (utils.validate_pattern_move already advanced current_round)
                await self.channel_layer.group_send(self.group_name, {
                    "type": "game.start",
                })
            else:
                # Another player already triggered; do nothing here.
                pass

    # --------------- Group message handlers ---------------

    async def lobby_countdown(self, event):
        await self.send(text_data=json.dumps({
            "type": "lobby_countdown",
            "seconds": event["seconds"],
        }))

    async def lobby_state(self, event):
        await self.send(text_data=json.dumps({
            "type": "lobby_state",
            "started": event.get("started", False),
            "ready_count": event.get("ready_count", 0),
            "expected_count": event.get("expected_count", 0),
            "created_at": event.get("created_at"),
            "join_deadline_at": event.get("join_deadline_at"),
            "server_now": event.get("server_now"),
            "online_ids": event.get("online_ids"),
        }))

    async def join_window_closed(self, event):
        await self.send(text_data=json.dumps({
            "type": "join_window_closed",
            "server_now": event.get("server_now"),
        }))

    async def round_countdown(self, event):
        # NEW: in-game freeze countdown handler
        await self.send(text_data=json.dumps({
            "type": "round_countdown",
            "seconds": event["seconds"],
        }))

    async def game_start(self, event):
        # read current round and its sequence from DB
        print("[DEBUG] >>> enter game_start handler", flush=True)
        game_state = await sync_to_async(PatternMemorizationGameState.objects.get)(id=self.game_state_id)
        current_round = game_state.current_round
        sequence = game_state.pattern_sequence[current_round - 1]
        print(f"[DEBUG] send pattern_sequence round={current_round}, seq={sequence}", flush=True)
        await self.send(text_data=json.dumps({
            "type": "pattern_sequence",
            "round_number": current_round,
            "sequence": sequence,
        }))

    async def game_over(self, event):
        await self.send(text_data=json.dumps({
            "type": "game_over",
            "scores": event["scores"]
        }))

    async def player_timeout(self, event):
        if event.get('user_id') == getattr(self.user, 'id', None):
            await self.send(text_data=json.dumps({"type": "timeout"}))
            await self.close(code=4003)

    async def timer_expired(self, event):
        await self.send(text_data=json.dumps({
            'type': 'timer_expired',
            'leaderboard': event.get('leaderboard', []),
            'server_now': event.get('server_now'),
            'auto_completed': event.get('auto_completed', True),
        }))
        try:
            await self.close(code=4004)
        except Exception:
            pass

    async def leaderboard_update(self, event):
        # Forward leaderboard updates triggered by Celery
        await self.send(text_data=json.dumps({
            "type": "leaderboard_update",
            "leaderboard": event.get("leaderboard", []),
            "server_now": event.get("server_now"),
        }))

    # ---------------- HELPERS ----------------

    @sync_to_async
    def _get_expected_count(self):
        """
        multiplayer → number of ChallengeMembership
        singleplayer → 1
        """
        try:
            gs = PatternMemorizationGameState.objects.select_related("challenge").get(id=self.game_state_id)
        except PatternMemorizationGameState.DoesNotExist:
            return 1

        if gs.challenge.groupID_id is not None:
            n = ChallengeMembership.objects.filter(challengeID=gs.challenge).count()
            return max(1, n)
        return 1
    
    async def _persist_scores_once(self, scores: list[dict]):
        if not cache.add(_saved_key(self.game_state_id), True, timeout=3600):
            return
        await sync_to_async(self._save_scores_and_zero_missing)(scores)
    
    def _save_scores_and_zero_missing(self, scores):
        gs = PatternMemorizationGameState.objects.select_related("challenge", "game").get(id=self.game_state_id)
        play_date = date.today()

        # save provided scores
        submitted_ids = set()
        for row in scores:
            try:
                u = User.objects.get(username=row.get("username"))
            except User.DoesNotExist:
                continue
            GamePerformance.objects.update_or_create(
                challenge=gs.challenge, game=gs.game, user=u, date=play_date,
                defaults={"score": int(row.get("score", 0))}
            )
            submitted_ids.add(u.id)

        # auto-zero missing participants of THIS session only (players who joined this game_state)
        session_player_ids = set(
            PatternMemorizationGamePlayer.objects.filter(game_state=gs).values_list("player_id", flat=True)
        )
        for uid in session_player_ids - submitted_ids:
            GamePerformance.objects.update_or_create(
                challenge=gs.challenge, game=gs.game, user_id=uid, date=play_date,
                defaults={"score": 0, "auto_generated": True}
            )

        # lock further joins
        gs.joins_closed = True
        gs.save(update_fields=["joins_closed"])

    def _save_scores(self, scores: list[dict]):
        gs = PatternMemorizationGameState.objects.select_related("challenge", "game").get(id=self.game_state_id)
        play_date = date.today()

        for row in scores:
            username = row.get("username")
            sc = int(row.get("score", 0))
            if not username:
                continue
            try:
                user = User.objects.get(username=username)
            except User.DoesNotExist:
                continue

            GamePerformance.objects.update_or_create(
                challenge=gs.challenge,
                game=gs.game,
                user=user,
                date=play_date,
                defaults={"score": sc},
            )

