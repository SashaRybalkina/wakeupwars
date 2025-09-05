import json
import asyncio
from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import sync_to_async
from django.core.cache import cache

from api.models import PatternMemorizationGameState, User, ChallengeMembership
from api.patternMem.utils import validate_pattern_move

# ---- Cache keys ----
def _ready_key(game_state_id: int) -> str:
    return f"pm_ready_{game_state_id}"

def _started_key(game_state_id: int) -> str:
    return f"pm_started_{game_state_id}"

def _conns_key(game_state_id: int) -> str:
    return f"pm_conns_{game_state_id}"  


class PatternMemorizationConsumer(AsyncWebsocketConsumer):
    """
    process:
      connect → lobby_state → player_ready → (everyone ready) countdown → game_start(pattern_sequence)
      → player_answer → next_round or game_over
    """

    async def connect(self):
        self.game_state_id = int(self.scope['url_route']['kwargs']['game_state_id'])
        self.group_name = f'pattern_{self.game_state_id}'
        self.user: User = self.scope['user']

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # record online users
        conns = set(cache.get(_conns_key(self.game_state_id)) or [])
        conns.add(self.user.id)
        cache.set(_conns_key(self.game_state_id), list(conns), timeout=3600)

        # initial lobby state
        started = bool(cache.get(_started_key(self.game_state_id)) or False)
        ready_ids = set(cache.get(_ready_key(self.game_state_id)) or [])
        expected_count = await self._get_expected_count()

        effective_ready = ready_ids & conns
        await self.send(text_data=json.dumps({
            "type": "lobby_state",
            "started": started,
            "ready_count": len(effective_ready),
            "expected_count": expected_count,
        }))

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

        # if no one is online, reset started
        if not conns:
            cache.delete(_started_key(self.game_state_id))
            cache.delete(_ready_key(self.game_state_id))
            cache.delete(_conns_key(self.game_state_id))

        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        msg_type = data.get("type")
        print(f"[DEBUG From Consumers] Received message: {msg_type} from user={self.user.username}")
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
        print(f"[DEBUG From Consumers] ready_count={len(ready_ids)}, expected={expected}", flush=True)
        # Ensure that only the first process to reach the standard triggers subsequent actions
        if expected > 0 and len(effective_ready) >= expected:
            # try to set started=True (only the first one will succeed)
            if cache.add(_started_key(self.game_state_id), True, timeout=3600):
                # clear ready (to avoid misjudgment by old values in the next round)
                cache.set(_ready_key(self.game_state_id), [], timeout=3600)

                # countdown (broadcast)
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
        
    async def _handle_player_answer(self, data):
        round_number = data.get("round_number")
        sequence = data.get("sequence")
        print(f"[DEBUG From Consumers] Player {self.user.username} submitted answer for round {round_number}: {sequence}")

        result = await validate_pattern_move(
            game_state_id=self.game_state_id,
            user=self.user,
            round_number=round_number,
            player_sequence=sequence
        )

        # send it back to the submitter
        resp = {
            "type": "answer_result",
            "is_correct": result.get("is_correct", False),
            "is_complete": result.get("is_complete", False),
            "error": result.get("error"),
        }
        if "round_score" in result:
            resp["round_score"] = result["round_score"]
        await self.send(text_data=json.dumps(resp))

        if result.get("is_correct") and not result.get("is_complete"):
            print(f"[DEBUG From Consumers] Player {self.user.username} triggered a new round", flush=True)
            await self.channel_layer.group_send(self.group_name, {
                "type": "game.start",
            })

        # final scores
        if result.get("is_complete"):
            scores = result.get("scores")
            if scores:
                await self.channel_layer.group_send(self.group_name, {
                    "type": "game.over",
                    "scores": scores
                })

    async def lobby_countdown(self, event):
        await self.send(text_data=json.dumps({
            "type": "lobby_countdown",
            "seconds": event["seconds"],
        }))

    async def game_start(self, event):
        # read current round and its answer from DB
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

    # ---------------- HELPERS ----------------

    @sync_to_async
    def _get_expected_count(self):
        """
        multiplayer challengeMembership numbers
        singleplayer always 1
        """
        try:
            gs = PatternMemorizationGameState.objects.select_related("challenge").get(id=self.game_state_id)
        except PatternMemorizationGameState.DoesNotExist:
            return 1

        if gs.challenge.groupID_id is not None:
            n = ChallengeMembership.objects.filter(challengeID=gs.challenge).count()
            return max(1, n)
        return 1
