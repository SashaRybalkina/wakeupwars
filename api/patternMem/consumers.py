import json
import asyncio
from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import sync_to_async
from django.core.cache import cache

from api.models import PatternMemorizationGameState, User, ChallengeMembership
from api.patternMem.utils import validate_pattern_move

# --- Cache key ---
def _ready_key(game_state_id: int) -> str:
    return f"pm_ready_{game_state_id}"

def _started_key(game_state_id: int) -> str:
    return f"pm_started_{game_state_id}"


class PatternMemorizationConsumer(AsyncWebsocketConsumer):
    """
      connect → lobby_state → player_ready → counting → game_start → pattern_sequence
      → player_answer → next_round or game_over
    """

    async def connect(self):

        self.game_state_id = int(self.scope['url_route']['kwargs']['game_state_id'])
        self.group_name = f'pattern_{self.game_state_id}'
        self.user: User = self.scope['user']

        #print(f"[DEBUG From Consumers] {self.user.username} is connecting to game_state_id={self.game_state_id}")

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

         # Enable in-memory receive patching for testing
        if hasattr(self.channel_layer, "_receive"):
            self.channel_layer.receive = self.channel_layer._receive

        # lobby state
        started = cache.get(_started_key(self.game_state_id)) or False
        ready_count = len(cache.get(_ready_key(self.game_state_id)) or [])
        expected_count = await self._get_expected_count()

        #print(f"[DEBUG From Consumers] Initial lobby_state → started={started}, ready_count={ready_count}, expected_count={expected_count}")

        await self.send(text_data=json.dumps({
            "type": "lobby_state",
            "started": started,
            "ready_count": ready_count,
            "expected_count": expected_count,
        }))
        

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        """
        Called whenever a WebSocket message is received from client.
        Dispatches based on `type`.
        """
        data = json.loads(text_data)
        msg_type = data.get("type")

        print(f"[DEBUG From Consumers] Received message: {msg_type} from user={self.user.username}")

        if msg_type == "player_ready":
            await self._handle_player_ready()
        elif msg_type == "player_answer":
            await self._handle_player_answer(data)

    # ---------------- HANDLERS ----------------

    async def _handle_player_ready(self):
        """
        When a player sends "player_ready", mark them ready in cache.
        If all expected players are ready, start countdown then broadcast game start.
        """
        ready_set = set(cache.get(_ready_key(self.game_state_id)) or [])
        ready_set.add(self.user.id)
        cache.set(_ready_key(self.game_state_id), list(ready_set), timeout=3600)

        expected = await self._get_expected_count()
        print(f"[DEBUG From Consumers] ready_count={len(ready_set)}, expected={expected}", flush=True)

        if expected > 0 and len(ready_set) >= expected:
            cache.set(_started_key(self.game_state_id), True, timeout=3600)

            # counting
            for t in [3, 2, 1]:
                # print(f"[DEBUG] lobby.countdown → {t}", flush=True)
                await self.channel_layer.group_send(self.group_name, {
                    "type": "lobby.countdown",
                    "seconds": t,
                })
                await asyncio.sleep(1)

            
            # game start
            await self.channel_layer.group_send(self.group_name, {
                "type": "game.start",
            })

            print("[DEBUG From Consumers] group_send → game.start has been sent", flush=True)
            

    async def _handle_player_answer(self, data):
        """
        Handle player's answer submission.
        If correct and first match, push next round or broadcast game_over.
        """
        round_number = data.get("round_number")
        sequence = data.get("sequence")

        print(f"[DEBUG From Consumers] Player {self.user.username} submitted answer for round {round_number}: {sequence}")

        result = await validate_pattern_move(
            game_state_id=self.game_state_id,
            user=self.user,
            round_number=round_number,
            player_sequence=sequence
        )

        print(f"[DEBUG From Consumers] Answer evaluated: is_correct={result['is_correct']}, is_complete={result['is_complete']}")

        # Send back result to the player who submitted
        # await self.send(text_data=json.dumps({
        #     "type": "answer_result",
        #     "is_correct": result["is_correct"],
        #     "round_score": result["round_score"],
        #     "is_complete": result["is_complete"],
        #     "error": result.get("error"),
        # }))

        response_data = {
            "type": "answer_result",
            "is_correct": result["is_correct"],
            "is_complete": result["is_complete"],
            "error": result.get("error"),
        }

        if "round_score" in result:
            response_data["round_score"] = result["round_score"]

        await self.send(text_data=json.dumps(response_data))

        # If this answer triggered a new round (first correct), broadcast new round
        if result["is_correct"] and not result["is_complete"]:
            print(f"[DEBUG From Consumers] Player {self.user.username} triggered a new round", flush=True)
            await self.channel_layer.group_send(self.group_name, {
                "type": "game.start",  # reuse game_start handler
            })

        # If game completed, send final scores to everyone
        if result["is_complete"]:
            
            print(f"[DEBUG From Consumers] Player {self.user.username} completed the game", flush=True)
            
            scores = result.get("scores")
            if scores:
                # Only the first user will have scores and should trigger game over
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
        """
        Broadcast final results to all players once the game ends.
        """
        await self.send(text_data=json.dumps({
            "type": "game_over",
            "scores": event["scores"]
        }))

    # ---------------- HELPERS ----------------

    @sync_to_async
    def _get_expected_count(self):
        """
        Return how many players are expected in this challenge (based on ChallengeMembership).
        """
        try:
            gs = PatternMemorizationGameState.objects.select_related("challenge").get(id=self.game_state_id)
        except PatternMemorizationGameState.DoesNotExist:
            return 0

        return ChallengeMembership.objects.filter(challengeID=gs.challenge).count()
