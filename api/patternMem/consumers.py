import json
import asyncio
import random
from typing import List, Dict

from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import sync_to_async
from django.core.cache import cache
from django.core.exceptions import ObjectDoesNotExist

# Import Pattern Memorization models (parallel to your Sudoku ones)
from api.models import (
    PatternMemorizationGameState,
    PatternMemorizationGamePlayer,
    User,
    ChallengeMembership,  # used to compute expected players for the lobby
)

# Import core game logic (mirrors Sudoku's utils usage)
from api.patternMem.utils import validate_pattern_move

# A fixed palette used to assign per-player colors in the room (UI-only)
ALL_COLORS = [
    'hotpink', 'coral', 'orange', 'lawngreen', 'aqua',
    'deepskyblue', 'mediumorchid', 'mediumvioletred',
    'magenta', 'thistle', 'powderblue',
]


# --------- Cache key helpers for lobby/ready state (no DB schema change needed) ---------
def _ready_key(game_state_id: int) -> str:
    """Cache key that stores the set(list) of ready user_ids for a given game_state."""
    return f"pm_ready_{game_state_id}"

def _started_key(game_state_id: int) -> str:
    """Cache key that stores whether the lobby has started/locked for a given game_state."""
    return f"pm_started_{game_state_id}"


class PatternMemorizationConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for Pattern Memorization multiplayer.
    Event types mirror your Sudoku consumer for easier maintenance.
    """

    async def connect(self):
        # Parse parameters from URL router (e.g., ws://.../ws/pattern/<game_state_id>/)
        self.game_state_id = int(self.scope['url_route']['kwargs']['game_state_id'])
        # Group name used by channel layer to fan out messages to the room
        self.group_name = f'pattern_{self.game_state_id}'
        # Authenticated user object (Django auth middleware stack)
        self.user: User = self.scope['user']

        # Join the channel layer group and accept the socket
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # Assign (or reuse) a color for this user in this game_state (thread-safe DB op)
        self.color = await self.assign_color()

        # Send back existing players (to only this client), so UI can render who's already here
        existing_players = await self.get_existing_players()
        for player in existing_players:
            await self.send(text_data=json.dumps({
                'type': 'player_joined',
                'player': player['username'],
                'color': player['color'],
            }))

        # Broadcast to room that this player joined (everyone, including self)
        await self.channel_layer.group_send(
            self.group_name,
            {
                'type': 'player.joined',
                'player': self.user.username,
                'color': self.color,
            }
        )

        # Inform this client about current lobby state (started flag + ready counts)
        started = await self._get_started_flag()
        await self.send(text_data=json.dumps({
            'type': 'lobby_state',
            'started': started,
            'ready_count': await self._get_ready_count(),
            'expected_count': await self._get_expected_count(),
        }))

    async def disconnect(self, close_code):
        # On disconnect, simply leave the group (we keep lobby state in cache; no DB writes here)
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        import traceback
        try:
            data = json.loads(text_data)
            msg_type = data.get('type')

            # --- LOBBY / READY ---
            if msg_type == 'player_ready':
                if await self._get_started_flag():
                    await self.send(text_data=json.dumps({
                        'type': 'lobby_locked',
                        'message': 'Game already started',
                    }))
                    return
                new_count = await self._add_ready(self.user.id)
                expected = await self._get_expected_count()
                await self.channel_layer.group_send(self.group_name, {
                    'type': 'lobby.update',
                    'ready_count': new_count,
                    'expected_count': expected,
                    'who': self.user.username,
                })
                if expected > 0 and new_count >= expected:
                    await self._set_started_flag(True)
                    for t in [3, 2, 1]:
                        await self.channel_layer.group_send(self.group_name, {
                            'type': 'lobby.countdown',
                            'seconds': t,
                        })
                        await asyncio.sleep(1)
                    await self.channel_layer.group_send(self.group_name, {
                        'type': 'game.start',
                    })
                return

            # --- GAMEPLAY ---
            if msg_type == 'make_move':
                rn_raw = data.get('round_number')
                try:
                    rn = int(rn_raw)
                except (TypeError, ValueError):
                    await self.send(text_data=json.dumps({
                        'type': 'error',
                        'message': 'round_number invalid',
                    }))
                    return
                
                player_sequence = data.get('player_sequence') or []

                result = await validate_pattern_move(
                    game_state_id=self.game_state_id,
                    user=self.user,
                    round_number=rn,
                    player_sequence=player_sequence,
                )

                await self.send(text_data=json.dumps({
                    'type': 'move_result',
                    'round_number': rn,
                    'is_correct': bool(result.get('is_correct')),
                    'round_score': result.get('round_score', 0),
                    'error': result.get('error'),
                    'is_complete': result.get('is_complete', False),
                }))

                if result.get('error'):
                    return

                if result.get('is_correct'):
                    
                    await self.send(text_data=json.dumps({
                        'type': 'move_result',
                        'is_correct': True,
                        'round_number': rn,
                        'round_score': result.get('round_score', 0),
                    }))

                    
                    await self.channel_layer.group_send(self.group_name, {
                        'type': 'round.cleared',
                        'player': self.user.username,
                        'round_number': rn,
                        'round_score': result.get('round_score', 0),
                    })
                    current_round = await self._get_current_round()
                    await self.channel_layer.group_send(self.group_name, {
                        'type': 'round.advance',
                        'current_round': current_round,
                    })
                    if result.get('is_complete'):
                        await self.channel_layer.group_send(self.group_name, {
                            'type': 'game.complete',
                            'scores': result.get('scores', []),
                        })
                else:
                    pass
                return

            # unknown type: do nothing

        except Exception as e:         
            traceback.print_exc()
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': f'{type(e).__name__}: {str(e)}',
            }))
    

    # ---------------------- GROUP HANDLERS (names map from dots to underscores) ----------------------

    async def player_joined(self, event):
        try:
            """Broadcast: someone joined the room (used to render the player list with color)."""
            await self.send(text_data=json.dumps({
                'type': 'player_joined',
                'player': event['player'],
                'color': event['color'],
            }))
        except Exception as e:
            import traceback; traceback.print_exc()
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': f'game_complete failed: {type(e).__name__}: {str(e)}',
            }))

    async def lobby_update(self, event):
        try:
            """Broadcast: ready/expected counts updated."""
            await self.send(text_data=json.dumps({
                'type': 'lobby_update',
                'ready_count': event['ready_count'],
                'expected_count': event['expected_count'],
                'who': event['who'],
            }))
        except Exception as e:
            import traceback; traceback.print_exc()
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': f'round_advance failed: {type(e).__name__}: {str(e)}',
            }))

    async def lobby_countdown(self, event):
        try:
            """Broadcast: countdown seconds before the game starts."""
            await self.send(text_data=json.dumps({
                'type': 'lobby_countdown',
                'seconds': event['seconds'],
            }))
        except Exception as e:
            import traceback; traceback.print_exc()
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': f'lobby_countdown failed: {type(e).__name__}: {str(e)}',
            }))

    async def game_start(self, event):
        try:
            """Broadcast: lobby finished, switch UI to the first round."""
            await self.send(text_data=json.dumps({
                'type': 'game_start'
            }))
        except Exception as e:
            import traceback; traceback.print_exc()
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': f'game_start failed: {type(e).__name__}: {str(e)}',
            }))

    async def round_cleared(self, event):
        try:
            await self.send(text_data=json.dumps({
                'type': 'round_cleared',
                'player': event['player'],
                'round_number': event['round_number'],
                'round_score': event['round_score'],
            }))
        except Exception as e:
            import traceback; traceback.print_exc()
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': f'round_cleared failed: {type(e).__name__}: {str(e)}',
            }))

    async def round_advance(self, event):
        try:
            await self.send(text_data=json.dumps({
                'type': 'round_advance',
                'current_round': event['current_round'],
            }))
        except Exception as e:
            import traceback; traceback.print_exc()
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': f'round_advance failed: {type(e).__name__}: {str(e)}',
            }))

    async def game_complete(self, event):
        try:
            await self.send(text_data=json.dumps({
                'type': 'game_complete',
                'scores': event.get('scores', []),
            }))
        except Exception as e:
            import traceback; traceback.print_exc()
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': f'game_complete failed: {type(e).__name__}: {str(e)}',
            }))

    # ---------------------- COLOR ASSIGNMENT & EXISTING PLAYERS ----------------------

    @sync_to_async
    def assign_color(self) -> str:
        """
        Thread-safe color assignment stored on the player's row.
        Reuses existing color if present; otherwise picks a free one from ALL_COLORS.
        """
        try:
            game_state = PatternMemorizationGameState.objects.get(id=self.game_state_id)

            player_record, _ = PatternMemorizationGamePlayer.objects.get_or_create(
                game_state=game_state,
                player=self.user,
                defaults={'rounds_completed': 0, 'score': 0, 'last_round_success': True}
            )

            if player_record.color:
                return player_record.color

            taken_colors = (
                PatternMemorizationGamePlayer.objects
                .filter(game_state=game_state)
                .exclude(player=self.user)
                .values_list('color', flat=True)
            )

            available = [c for c in ALL_COLORS if c not in taken_colors]
            assigned = random.choice(available) if available else 'black'
            player_record.color = assigned
            player_record.save()
            return assigned

        except ObjectDoesNotExist:
            return 'black'

    @sync_to_async
    def get_existing_players(self) -> List[Dict[str, str]]:
        """
        Fetch existing players (other than current user) and return username+color pairs.
        Used on connect to pre-populate the player list on the client.
        """
        players = (
            PatternMemorizationGamePlayer.objects
            .filter(game_state__id=self.game_state_id)
            .exclude(player=self.user)
            .select_related('player')
        )

        return [{'username': p.player.username, 'color': p.color} for p in players if p.color]

    # ---------------------- LOBBY / READY HELPERS (cache-based, no schema change) ----------------------

    @sync_to_async
    def _get_expected_player_ids(self):
        """
        Return the set of user IDs expected to play in this challenge,
        derived from ChallengeMembership of the GameState's challenge.
        """
        try:
            gs = PatternMemorizationGameState.objects.select_related('challenge').get(id=self.game_state_id)
        except PatternMemorizationGameState.DoesNotExist:
            return set()

        return set(
            ChallengeMembership.objects
            .filter(challengeID=gs.challenge)
            .values_list('uID_id', flat=True)
        )

    async def _get_expected_count(self) -> int:
        ids = await self._get_expected_player_ids()
        return len(ids)

    async def _get_started_flag(self) -> bool:
        key = _started_key(self.game_state_id)
        started = cache.get(key)
        return bool(started)

    async def _set_started_flag(self, value: bool) -> None:
        key = _started_key(self.game_state_id)
        # TTL avoids stale cache keys living forever (1 hour is fine for a match)
        cache.set(key, bool(value), timeout=3600)

    async def _get_ready_set(self) -> set:
        key = _ready_key(self.game_state_id)
        data = cache.get(key) or []
        return set(data)

    async def _save_ready_set(self, ready_set: set) -> None:
        key = _ready_key(self.game_state_id)
        cache.set(key, list(ready_set), timeout=3600)

    async def _get_ready_count(self) -> int:
        s = await self._get_ready_set()
        return len(s)

    async def _add_ready(self, user_id: int) -> int:
        """
        Add a user to the ready-set and return the new ready count.
        """
        s = await self._get_ready_set()
        s.add(int(user_id))
        await self._save_ready_set(s)
        return len(s)

    @sync_to_async
    def _get_current_round(self) -> int:
        """
        Read the most recent current_round from DB (after validate_pattern_move may have advanced it).
        """
        try:
            gs = PatternMemorizationGameState.objects.only('current_round').get(id=self.game_state_id)
            return gs.current_round
        except PatternMemorizationGameState.DoesNotExist:
            return 1
