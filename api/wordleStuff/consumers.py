import json
from datetime import date
from django.utils import timezone
from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import sync_to_async
from django.core.cache import cache
from api.tasks import broadcast_leaderboard

from api.wordleStuff.utils import validate_wordle_move_async
from api.models import (
    WordleGameState,
    WordleGamePlayer,
    User,
    GamePerformance,
    ChallengeMembership
)

# ===== Feature switches =====
ENABLE_JOIN_DEADLINE = False
ENABLE_ENDED_CHECK = False

# ===== Cache key helpers =====
def _conns_key(game_id: int):
    return f"wordle_conns_{game_id}"

def _saved_key(game_id: int):
    return f"wordle_scores_saved_{game_id}"


class WordleConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.game_state_id = int(self.scope['url_route']['kwargs']['game_state_id'])
        self.group_name = f'wordle_{self.game_state_id}'
        self.user: User = self.scope['user']

        print(f"[DEBUG][CONNECT] self.user={self.user}, is_authenticated={self.user.is_authenticated}")

        if not self.user.is_authenticated:
            print("[DEBUG][CONNECT] Authentication failed, closing connection")
            await self.close()
            return

        gs = await sync_to_async(WordleGameState.objects.select_related("challenge", "game").get)(id=self.game_state_id)

        # Join deadline logic
        if ENABLE_JOIN_DEADLINE:
            if not await self._check_join_deadline(gs):
                print("[DEBUG][CONNECT] join_deadline check failed")
                return

        # Ended game logic
        if ENABLE_ENDED_CHECK:
            if not await self._check_game_not_ended(gs):
                print("[DEBUG][CONNECT] ended check failed")
                return

        print(f"[WebSocket][CONNECT] user={self.user.username} joining game_state={self.game_state_id}")
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # Add to cache
        conns = set(cache.get(_conns_key(self.game_state_id)) or [])
        conns.add(self.user.id)
        cache.set(_conns_key(self.game_state_id), list(conns), timeout=3600)

        # Add player to DB
        await self.add_player()
        print(f"[WebSocket][PLAYER] Added {self.user.username} into game_state={self.game_state_id}")

        # Send current players
        all_players = await self.get_all_players()
        await self.send(text_data=json.dumps({
            'type': 'player_list',
            'players': all_players,
        }))
        print(f"[WebSocket][PLAYER LIST] sent to {self.user.username}: {all_players}")

        # Broadcast join event
        await self.channel_layer.group_send(
            self.group_name,
            {
                'type': 'player.joined',
                'player': self.user.username,
            }
        )
        await self.channel_layer.group_send(
            self.group_name,
            {
                'type': 'player.list.update',
                'players': all_players,
            }
        )
        print(f"[WebSocket][BROADCAST] {self.user.username} joined game_state={self.game_state_id}")

        # Send initial lobby state for waiting room UI
        try:
            expected_count = await sync_to_async(ChallengeMembership.objects.filter(challengeID=gs.challenge).count)()
        except Exception:
            expected_count = len(all_players)

        try:
            created_at = gs.created_at.isoformat() if getattr(gs, 'created_at', None) else None
            join_deadline_at = gs.join_deadline_at.isoformat() if getattr(gs, 'join_deadline_at', None) else None
        except Exception:
            created_at = None
            join_deadline_at = None

        await self.send(text_data=json.dumps({
            'type': 'lobby_state',
            'created_at': created_at,
            'join_deadline_at': join_deadline_at,
            'server_now': timezone.now().isoformat(),
            'ready_count': len(conns),
            'expected_count': expected_count,
            'online_ids': list(conns),
        }))

        # Also broadcast lobby state so other clients update their waiting room UI
        await self.channel_layer.group_send(
            self.group_name,
            {
                'type': 'lobby.state',
                'created_at': created_at,
                'join_deadline_at': join_deadline_at,
                'server_now': timezone.now().isoformat(),
                'ready_count': len(conns),
                'expected_count': expected_count,
                'online_ids': list(conns),
            }
        )


    async def disconnect(self, close_code):
        username = self.user.username
        print(f"[WebSocket][DISCONNECT] user={username} left game_state={self.game_state_id} (code={close_code})")
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

        # --- Save zero score if player disconnects before game ends ---
        await self.save_zero_score_if_needed()

        # --- Update cache for online players ---
        conns = set(cache.get(_conns_key(self.game_state_id)) or [])
        if self.user.id in conns:
            conns.remove(self.user.id)
        cache.set(_conns_key(self.game_state_id), list(conns), timeout=3600)

        if not conns:
            print(f"[WebSocket][CLEANUP] All players left. Cleaning up cache for game_state={self.game_state_id}")
            cache.delete(_conns_key(self.game_state_id))
            cache.delete(_saved_key(self.game_state_id))
            # ❌ No need to remove WordleGamePlayer — scores already saved

        # --- Notify other players ---
        await self.channel_layer.group_send(
            self.group_name,
            {
                'type': 'player.left',
                'player': username,
            }
        )

        remaining_players = await self.get_all_players()
        print(f"[DEBUG][DISCONNECT] Remaining players after {username} left: {remaining_players}")

        await self.channel_layer.group_send(
            self.group_name,
            {
                'type': 'player.list.update',
                'players': remaining_players,
            }
        )

        # Broadcast updated lobby state to all clients so their online indicators update
        # Preserve the join deadline and creation timestamps if available
        try:
            gs = await sync_to_async(WordleGameState.objects.get)(id=self.game_state_id)
            created_iso = gs.created_at.isoformat() if getattr(gs, 'created_at', None) else None
            deadline_iso = gs.join_deadline_at.isoformat() if getattr(gs, 'join_deadline_at', None) else None
            try:
                expected_count = await sync_to_async(ChallengeMembership.objects.filter(challengeID=gs.challenge).count)()
            except Exception:
                expected_count = max(1, len(remaining_players))
        except WordleGameState.DoesNotExist:
            created_iso = None
            deadline_iso = None
            expected_count = len(conns)

        await self.channel_layer.group_send(
            self.group_name,
            {
                'type': 'lobby.state',
                'created_at': created_iso,
                'join_deadline_at': deadline_iso,
                'server_now': timezone.now().isoformat(),
                'ready_count': len(conns),
                'expected_count': expected_count,
                'online_ids': list(conns),
            }
        )



    async def receive(self, text_data):
        data = json.loads(text_data)
        print(f"[WebSocket][RECEIVE] from {self.user.username}: {data}")

        if data['type'] == 'make_move':
            row = data.get('row')
            guess = data.get('guess')
            print(f"[WebSocket][MOVE] {self.user.username} guessed '{guess}' at row={row} in game_state={self.game_state_id}")

            # Validate the move
            result = await validate_wordle_move_async(self.game_state_id, self.user, guess, row)
            print(f"[WebSocket][RESULT] {self.user.username} -> correct={result['is_correct']} complete={result['is_complete']} scores={result['scores']}")

            # Send result to this player
            await self.send(text_data=json.dumps({
                'type': 'move_result',
                'row': row,
                'guess': guess,
                'feedback': result['feedback'],
                'is_correct': result['is_correct'],
                'is_complete': result['is_complete'],
                'scores': result['scores'],
            }))
            print(f"[WebSocket][SEND] move_result sent to {self.user.username}")

            # Broadcast to other players
            await self.channel_layer.group_send(
                self.group_name,
                {
                    'type': 'broadcast.move',
                    'player': self.user.username,
                    'row': row,
                    'guess': guess,
                    'evaluation': result['feedback'],
                    'attempt': row + 1,
                }
            )
            print(f"[WebSocket][BROADCAST] move from {self.user.username} -> others in game_state={self.game_state_id}")

            # If the game is complete, broadcast the leaderboard
            if result['is_complete']:
                await self.channel_layer.group_send(
                    self.group_name,
                    {
                        'type': 'game.complete',
                        'scores': result['scores'],
                    }
                )
                print(f"[WebSocket][GAME COMPLETE] game_state={self.game_state_id}, scores={result['scores']}")
                await self._persist_scores_once(result['scores'])
                # Immediately compute + broadcast finalized leaderboard for this game
                try:
                    broadcast_leaderboard.delay('WordleGameState', self.game_state_id)
                except Exception:
                    pass

        elif data.get('type') == 'start_game':
            # Close join window and notify all clients to dismiss lobby
            try:
                gs = await sync_to_async(WordleGameState.objects.get)(id=self.game_state_id)
                gs.joins_closed = True
                await sync_to_async(gs.save)(update_fields=["joins_closed"])
            except Exception:
                pass
            await self.channel_layer.group_send(
                self.group_name,
                {
                    'type': 'join_window_closed'
                }
            )
            await self.send(text_data=json.dumps({
                'type': 'join_window_closed',
            }))


    # ===== Group event handlers =====
    async def player_left(self, event):
        if event['player'] != self.user.username:
            print(f"[WebSocket][PLAYER LEFT] {self.user.username} sees {event['player']} left.")
            await self.send(text_data=json.dumps({
                'type': 'player_left',
                'player': event['player'],
            }))

    async def broadcast_move(self, event):
        if event['player'] != self.user.username:
            print(f"[WebSocket][RECEIVE BROADCAST] {self.user.username} got move from {event['player']}: {event}")
            await self.send(text_data=json.dumps({
                'type': 'broadcast_move',
                'player': event['player'],
                'row': event['row'],
                'guess': event['guess'],
                'evaluation': event['evaluation'],
                'attempt': event['attempt'],
            }))

    async def player_joined(self, event):
        if event['player'] != self.user.username:
            print(f"[WebSocket][PLAYER JOINED] {self.user.username} notified about {event['player']} joining")
            await self.send(text_data=json.dumps({
                'type': 'player_joined',
                'player': event['player'],
            }))

    async def player_list_update(self, event):
        print(f"[WebSocket][PLAYER LIST UPDATE] sending new list to {self.user.username}: {event['players']}")
        await self.send(text_data=json.dumps({
            'type': 'player_list',
            'players': event['players'],
        }))

    async def lobby_state(self, event):
        # Forward group lobby state updates to this client
        await self.send(text_data=json.dumps({
            'type': 'lobby_state',
            'created_at': event.get('created_at'),
            'join_deadline_at': event.get('join_deadline_at'),
            'server_now': event.get('server_now'),
            'ready_count': event.get('ready_count'),
            'expected_count': event.get('expected_count'),
            'online_ids': event.get('online_ids'),
        }))

    async def game_complete(self, event):
        print(f"[WebSocket][GAME COMPLETE EVENT] {self.user.username} received scores: {event['scores']}")
        await self.send(text_data=json.dumps({
            'type': 'game_complete',
            'scores': event['scores'],
        }))

    async def join_window_closed(self, event):
        # Group event -> notify this client to close lobby
        await self.send(text_data=json.dumps({
            'type': 'join_window_closed'
        }))

    async def leaderboard_update(self, event):
        # Forward leaderboard updates broadcast by Celery task
        await self.send(text_data=json.dumps({
            'type': 'leaderboard_update',
            'leaderboard': event.get('leaderboard', []),
            'server_now': event.get('server_now'),
        }))


    # ===== Helper: join deadline check =====
    async def _check_join_deadline(self, gs):
        now = timezone.now()
        if not gs.join_deadline_at:
            gs.join_deadline_at = (gs.created_at or now) + timezone.timedelta(minutes=2)
            await sync_to_async(gs.save)(update_fields=["join_deadline_at"])

        if gs.joins_closed or now > gs.join_deadline_at:
            print(f"[DEBUG][JOIN DEADLINE] User {self.user.username} denied join for game_state={self.game_state_id}")
            await self.close(code=4001)
            return False
        return True

    # ===== Helper: ended game check =====
    async def _check_game_not_ended(self, gs):
        ended = await sync_to_async(
            GamePerformance.objects.filter(
                challenge=gs.challenge, game=gs.game, date=timezone.localdate()
            ).exists
        )()
        if ended:
            gs.joins_closed = True
            await sync_to_async(gs.save)(update_fields=["joins_closed"])
            print(f"[DEBUG][ENDED CHECK] User {self.user.username} denied join because game ended")
            await self.close(code=4002)
            return False
        return True


    # ===== Database helpers =====
    @sync_to_async
    def add_player(self):
        game_state = WordleGameState.objects.get(id=self.game_state_id)
        player, created = WordleGamePlayer.objects.get_or_create(
            gameState=game_state,
            player=self.user,
            defaults={'accuracyCount': 0, 'inaccuracyCount': 0}
        )
        if created:
            print(f"[Wordle][DB] New player {self.user.username} added to game_state={self.game_state_id}")
        else:
            print(f"[Wordle][DB] Player {self.user.username} already exists in game_state={self.game_state_id}")

    @sync_to_async
    def get_all_players(self):
        conns = set(cache.get(_conns_key(self.game_state_id)) or [])
        players = (
            WordleGamePlayer.objects
            .filter(gameState__id=self.game_state_id, player_id__in=conns)
            .select_related('player')
        )
        return [p.player.username for p in players]

    
    
    @sync_to_async
    def _persist_scores_once(self, scores):
        # Prevent duplicate writes
        if not cache.add(_saved_key(self.game_state_id), True, timeout=3600):
            print(f"[Wordle][SCORES] Skipping duplicate save for game_state={self.game_state_id}")
            return

        gs = WordleGameState.objects.select_related("challenge", "game").get(id=self.game_state_id)
        play_date = date.today()

        submitted_ids = set()
        for row in scores:
            try:
                u = User.objects.get(username=row["username"])
            except User.DoesNotExist:
                print(f"[Wordle][SCORES] User {row['username']} not found in DB")
                continue
            GamePerformance.objects.update_or_create(
                challenge=gs.challenge,
                game=gs.game,
                user=u,
                date=play_date,
                defaults={"score": int(row.get("score", 0))}
            )
            submitted_ids.add(u.id)
            print(f"[Wordle][SCORES] Saved score for {u.username}: {row}")

        # Fill zero score for missing players
        participant_ids = set(
            ChallengeMembership.objects.filter(challengeID=gs.challenge).values_list("uID_id", flat=True)
        )
        for uid in participant_ids - submitted_ids:
            GamePerformance.objects.update_or_create(
                challenge=gs.challenge,
                game=gs.game,
                user_id=uid,
                date=play_date,
                defaults={"score": 0, "auto_generated": True}
            )
            print(f"[Wordle][SCORES] Auto-generated 0 score for user_id={uid}")

        gs.joins_closed = True
        gs.save(update_fields=["joins_closed"])
        print(f"[Wordle][SCORES] Final scores persisted for game_state={self.game_state_id}")

    @sync_to_async
    def save_zero_score_if_needed(self):
        gs = WordleGameState.objects.select_related("challenge", "game").get(id=self.game_state_id)
        today = date.today()

        # Check if the player already has a GamePerformance record
        exists = GamePerformance.objects.filter(
            challenge=gs.challenge,
            game=gs.game,
            user=self.user,
            date=today
        ).exists()

        if not exists:
            GamePerformance.objects.update_or_create(
                challenge=gs.challenge,
                game=gs.game,
                user=self.user,
                date=today,
                defaults={"score": 0, "auto_generated": True}
            )
            print(f"[Wordle][SCORES] Auto-saved 0 score for disconnected player {self.user.username}")

