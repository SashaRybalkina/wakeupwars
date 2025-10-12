import json
import random
from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import sync_to_async
from api.sudokuStuff.utils import validate_sudoku_move
from api.models import SudokuGameState, SudokuGamePlayer, User
from django.core.exceptions import ObjectDoesNotExist
from django.utils import timezone
from api.models import GamePerformance

ALL_COLORS = [
    'hotpink', 'coral', 'orange', 'lawngreen', 'aqua',
    'deepskyblue', 'mediumorchid', 'mediumvioletred',
    'magenta', 'thistle', 'powderblue',
]

class SudokuConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        """
        Enforce 2-minute join window and block after game end.
        Close codes:
        4001 – JOINS_CLOSED   4002 – GAME_ENDED
        """
        self.game_state_id = int(self.scope["url_route"]["kwargs"]["game_state_id"])
        self.group_name = f"sudoku_{self.game_state_id}"
        self.user: User = self.scope["user"]

        if not self.user.is_authenticated:
            await self.close()
            return

        # ─── join-window gating ─────────────────────────────
        gs: SudokuGameState = await sync_to_async(
            SudokuGameState.objects.select_related("challenge", "game").get
        )(id=self.game_state_id)

        now = timezone.now()
        if not gs.join_deadline_at:
            gs.join_deadline_at = (gs.created_at or now) + timezone.timedelta(minutes=2)
            await sync_to_async(gs.save)(update_fields=["join_deadline_at"])

        # if gs.joins_closed or now > gs.join_deadline_at:
        #     await self.close(code=4001)
        #     return

        ended = await sync_to_async(
            GamePerformance.objects.filter(
                challenge=gs.challenge, game=gs.game, date=timezone.localdate()
            ).exists
        )()
        if ended:
            gs.joins_closed = True
            await sync_to_async(gs.save)(update_fields=["joins_closed"])
            await self.close(code=4002)
            return
        # ────────────────────────────────────────────────────

        await self.accept()
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        # await self.channel_layer.group_add(self.group_name, self.channel_name)
        # await self.accept()

        # Assign a color and notify others
        self.color = await self.assign_color()
        
        existing_players = await self.get_existing_players()

        for player in existing_players:
            await self.send(text_data=json.dumps({
                'type': 'player_joined',
                'player': player['username'],
                'color': player['color'],
            }))

        await self.channel_layer.group_send(
            self.group_name,
            {
                'type': 'player_joined',
                'player': self.user.username,
                'color': self.color,
            }
        )

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)

        if data['type'] == 'make_move':
            index = data['index']
            value = data['value']

            result = await validate_sudoku_move(self.game_state_id, self.user, index, value)
            print("🧪 [DEBUG] validate_sudoku_move result =", result)  # debug log
            row, col = divmod(index, 9)


            if result is None:
                print("🧪 [DEBUG] result is None!!")
                return

            if result.get('type') == 'ignored':
                await self.send(text_data=json.dumps({
                    'type': 'ignored'
                }))
                return

            if result.get('is_correct'):
                # Broadcast move
                await self.channel_layer.group_send(
                    self.group_name,
                    {
                        'type': 'broadcast_move',  
                        'cell': index,
                        'value': value,
                        'color': self.color,
                        'valid': result['is_correct'],
                    }
                )

                # If the game is now complete, broadcast that too
                if result.get('is_complete'):
                    await self.channel_layer.group_send(
                        self.group_name,
                        {
                            'type': 'game_complete',
                            # 'completed_by': self.user.username,
                            'scores': result['scores'],
                        }
                    )

            # only broadcast incorrect move to myself
            else:
                await self.send(text_data=json.dumps({
                    'type': 'broadcast_move',
                    'cell': index,
                    'value': value,
                    'color': self.color,
                    'valid': result.get('is_correct', False),
                }))

    # Handlers for broadcasting
    async def broadcast_move(self, event):
        await self.send(text_data=json.dumps({
            'type': 'broadcast_move',
            'cell': event['cell'],
            'value': event['value'],
            'color': event['color'],
            'valid': event['valid'],
        }))

    # async def player_joined(self, event):
    #     if event['player'] != self.user.username:
    #         await self.send(text_data=json.dumps({
    #             'type': 'player_joined',
    #             'player': event['player'],
    #             'color': event['color'],
    #         }))

    async def player_joined(self, event):
        await self.send(text_data=json.dumps({
            'type': 'player_joined',
            'player': event['player'],
            'color': event['color'],
        }))

    async def game_complete(self, event):
        await self.send(text_data=json.dumps({
            'type': 'game_complete',
            # 'completedBy': event['completed_by'],
            'scores': event['scores'],
        }))

    # Color assignment (thread-safe)
    @sync_to_async
    def assign_color(self):
        try:
            game_state = SudokuGameState.objects.get(id=self.game_state_id)

            player_record, created = SudokuGamePlayer.objects.get_or_create(
                gameState=game_state,
                player=self.user,
                defaults={'accuracyCount': 0, 'inaccuracyCount': 0}
            )

            if player_record.color:
                return player_record.color

            taken_colors = (
                SudokuGamePlayer.objects
                .filter(gameState=game_state)
                .exclude(player=self.user)
                .values_list('color', flat=True)
            )

            available_colors = [c for c in ALL_COLORS if c not in taken_colors]
            assigned_color = random.choice(available_colors) if available_colors else 'black'
            player_record.color = assigned_color
            player_record.save()
            return assigned_color

        except ObjectDoesNotExist:
            return 'black'

    @sync_to_async
    def get_existing_players(self):
        players = (
            SudokuGamePlayer.objects
            .filter(gameState__id=self.game_state_id)
            .exclude(player=self.user)
            .select_related('player')
        )

        return [{'username': p.player.username, 'color': p.color} for p in players if p.color]
