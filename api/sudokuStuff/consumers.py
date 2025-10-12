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

# Global cell lock state: { game_id: { cell_index: username } }
CELL_LOCKS = {}

class SudokuConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        """
        Enforce 2-minute join window and block after game end.
        Close codes:
        4001 – JOINS_CLOSED
        4002 – GAME_ENDED
        """
        self.game_state_id = int(self.scope["url_route"]["kwargs"]["game_state_id"])
        self.group_name = f"sudoku_{self.game_state_id}"
        self.user: User = self.scope["user"]

        if not self.user.is_authenticated:
            await self.close()
            return

        # ─── Join-window gating ─────────────────────────────
        gs: SudokuGameState = await sync_to_async(
            SudokuGameState.objects.select_related("challenge", "game").get
        )(id=self.game_state_id)

        now = timezone.now()
        if not gs.join_deadline_at:
            gs.join_deadline_at = (gs.created_at or now) + timezone.timedelta(minutes=2)
            await sync_to_async(gs.save)(update_fields=["join_deadline_at"])

        if gs.joins_closed or now > gs.join_deadline_at:
            await self.close(code=4001)
            return

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

        # Assign color and notify other players
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

        game_id = self.game_state_id
        username = self.user.username

        # 🧹 Release all locks held by this player
        if game_id in CELL_LOCKS:
            locked_cells = [cell for cell, player in CELL_LOCKS[game_id].items() if player == username]
            for cell in locked_cells:
                CELL_LOCKS[game_id].pop(cell, None)
                # 📢 Broadcast to others that this cell is now unlocked
                await self.channel_layer.group_send(
                    self.group_name,
                    {
                        'type': 'cell_unlocked',
                        'cell': cell
                    }
                )

            print(f"[DISCONNECT] {username} left, unlocked cells: {locked_cells}")
            print(f"[CURRENT CELL_LOCKS] {json.dumps(CELL_LOCKS, indent=2)}")

    async def receive(self, text_data):
        data = json.loads(text_data)

        # ─── Lock cell ─────────────────────────────
        if data['type'] == 'lock_cell':
            index = data['index']
            game_id = self.game_state_id
            username = self.user.username

            if game_id not in CELL_LOCKS:
                CELL_LOCKS[game_id] = {}

            # ⚠️ Already locked by someone else
            if index in CELL_LOCKS[game_id] and CELL_LOCKS[game_id][index] != username:
                await self.send(text_data=json.dumps({
                    'type': 'lock_failed',
                    'cell': index
                }))
                return

            # 🔐 Lock this cell
            CELL_LOCKS[game_id][index] = username

            # 📢 Broadcast lock to everyone
            await self.channel_layer.group_send(
                self.group_name,
                {
                    'type': 'cell_locked',
                    'cell': index,
                    'player': username
                }
            )

        # ─── Unlock cell ─────────────────────────────
        if data['type'] == 'unlock_cell':
            index = data['index']
            game_id = self.game_state_id
            username = self.user.username

            if (game_id in CELL_LOCKS and 
                CELL_LOCKS[game_id].get(index) == username):
                CELL_LOCKS[game_id].pop(index, None)

                # 📢 Broadcast unlock to everyone
                await self.channel_layer.group_send(
                    self.group_name,
                    {
                        'type': 'cell_unlocked',
                        'cell': index
                    }
                )

        # ─── Handle Sudoku move ─────────────────────────────
        if data['type'] == 'make_move':
            index = data['index']
            value = data['value']

            game_id = self.game_state_id
            username = self.user.username

            # If the cell is locked by someone else → deny move
            if (game_id in CELL_LOCKS and
                CELL_LOCKS[game_id].get(index) not in (None, username)):
                await self.send(text_data=json.dumps({
                    'type': 'lock_failed',
                    'cell': index
                }))
                return

            result = await validate_sudoku_move(self.game_state_id, self.user, index, value)
            print("🧪 [DEBUG] validate_sudoku_move result =", result)
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
                # ✅ Correct move
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

                # If the game is complete, broadcast completion
                if result.get('is_complete'):
                    await self.channel_layer.group_send(
                        self.group_name,
                        {
                            'type': 'game_complete',
                            'scores': result['scores'],
                        }
                    )
            else:
                # ❌ Incorrect move → only broadcast to myself
                await self.send(text_data=json.dumps({
                    'type': 'broadcast_move',
                    'cell': index,
                    'value': value,
                    'color': self.color,
                    'valid': result.get('is_correct', False),
                }))
            
            # 🧹 Always unlock cell after answering (correct or wrong)
            if game_id in CELL_LOCKS and CELL_LOCKS[game_id].get(index) == username:
                CELL_LOCKS[game_id].pop(index, None)
                await self.channel_layer.group_send(
                    self.group_name,
                    {
                        'type': 'cell_unlocked',
                        'cell': index
                    }
                )
                print(f"[AUTO UNLOCK] after move by {username} on cell {index}")
                print(f"[CURRENT CELL_LOCKS] {json.dumps(CELL_LOCKS, indent=2)}")

    # ─── Broadcast handlers ─────────────────────────────
    async def broadcast_move(self, event):
        await self.send(text_data=json.dumps({
            'type': 'broadcast_move',
            'cell': event['cell'],
            'value': event['value'],
            'color': event['color'],
            'valid': event['valid'],
        }))

    async def player_joined(self, event):
        await self.send(text_data=json.dumps({
            'type': 'player_joined',
            'player': event['player'],
            'color': event['color'],
        }))

    async def game_complete(self, event):
        await self.send(text_data=json.dumps({
            'type': 'game_complete',
            'scores': event['scores'],
        }))

    # ─── Player color assignment ─────────────────────────────
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
    
    # ─── Lock / unlock event handlers ─────────────────────────────
    async def cell_locked(self, event):
        await self.send(text_data=json.dumps({
            'type': 'cell_locked',
            'cell': event['cell'],
            'player': event['player']
        }))

    async def cell_unlocked(self, event):
        await self.send(text_data=json.dumps({
            'type': 'cell_unlocked',
            'cell': event['cell']
        }))
