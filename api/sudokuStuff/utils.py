"""
/**
 * @file sudoku_game_utils.py
 * @description This file creates or reuses Sudoku game states. It generates puzzles
 * and solutions. It assigns the correct game for the user. It records players who
 * join the game. It validates Sudoku moves. It updates accuracy stats. It checks
 * completion and computes final scores.
 */
"""

from api.models import SudokuGameState, Challenge, SudokuGamePlayer, GameSchedule, GameScheduleGameAssociation, User, Game
from sudoku import Sudoku
import time
import random
from django.db import transaction
from django.db import IntegrityError
from asgiref.sync import sync_to_async
from datetime import timedelta
from django.utils import timezone
from django.conf import settings


@transaction.atomic
def get_or_create_game(challenge_id, user, allow_join: bool = True, alarm_datetime=None):
    """
    Create or reuse a SudokuGameState for a given challenge using proper get_or_create.
    Uses alarm_datetime and user fields to prevent race conditions.
    Ensure the user is recorded as a player.
    """
    challenge = Challenge.objects.select_for_update().get(id=challenge_id)
    sched_ids = list(GameSchedule.objects.filter(challenge_id=challenge_id).values_list('id', flat=True))
    
    # Get all Sudoku games scheduled for this challenge, ordered by game_order
    sudoku_assocs = (GameScheduleGameAssociation.objects.filter(game_schedule_id__in=sched_ids)
                     .select_related('game').filter(game__name__icontains='sudoku').order_by('game_order', 'id'))
    
    # Find the first Sudoku game that this user hasn't completed today
    from api.models import GamePerformance
    today = timezone.localdate()
    sudokuGame = None
    
    print(f"[SUDOKU][get_or_create] Found {sudoku_assocs.count()} scheduled Sudoku games")
    print(f"[SUDOKU][get_or_create] Checking for user={user.username} (id={user.id}), challenge={challenge.id}, date={today}")
    for assoc in sudoku_assocs:
        perf_count = GamePerformance.objects.filter(
            challenge=challenge,
            game=assoc.game,
            user=user,
            date=today
        ).count()
        has_completed = perf_count > 0
        print(f"[SUDOKU][get_or_create] Game '{assoc.game.name}' (id={assoc.game.id}): completed={has_completed} (found {perf_count} records)")
        # Check if user has already completed this specific game today
        if not has_completed:
            sudokuGame = assoc.game
            print(f"[SUDOKU][get_or_create] Selected game '{sudokuGame.name}' (id={sudokuGame.id})")
            break
    
    # Fallback: if all scheduled games are completed, use the first one or any Sudoku game
    if not sudokuGame:
        assoc = sudoku_assocs.first()
        sudokuGame = assoc.game if assoc else Game.objects.filter(name__icontains='sudoku').order_by('id').first()
        print(f"[SUDOKU][get_or_create] Fallback: selected '{sudokuGame.name if sudokuGame else 'None'}' (all games completed)")
    is_multiplayer = bool(getattr(sudokuGame, 'isMultiplayer', False))
    print("is multiplayer: ", is_multiplayer)
    print("game name: ", sudokuGame.name)

    # Use alarm_datetime if provided, otherwise use now
    if alarm_datetime is None:
        alarm_datetime = timezone.now()
    # Align to JOIN_WINDOW_SECONDS slot to ensure consistent windowing across processes
    window = int(getattr(settings, "JOIN_WINDOW_SECONDS", 20) or 20)
    try:
        ts = int(alarm_datetime.timestamp())
        slot_ts = ts - (ts % window)
        alarm_datetime = timezone.datetime.fromtimestamp(slot_ts, tz=alarm_datetime.tzinfo)
    except Exception:
        alarm_datetime = alarm_datetime.replace(second=0, microsecond=0)

    # Prepare defaults for creation
    difficulty = 0.1
    sudoku = Sudoku(3, 3, seed=int(time.time() * 1000)).difficulty(difficulty)
    puzzle = sudoku.board
    solution = sudoku.solve().board

    defaults = {
        'puzzle': puzzle,
        'solution': solution,
        'join_deadline_at': alarm_datetime + timedelta(seconds=int(getattr(settings, "JOIN_WINDOW_SECONDS", 20) or 20)),
    }

    # Use get_or_create with proper unique constraint fields
    if is_multiplayer:
        # Multiplayer: user=None, unique per (challenge, game, alarmDateTime)
        try:
            game_state, created = SudokuGameState.objects.get_or_create(
                challenge=challenge,
                game=sudokuGame,
                alarmDateTime=alarm_datetime,
                user=None,
                defaults=defaults
            )
        except IntegrityError:
            created = False
            game_state = SudokuGameState.objects.get(
                challenge=challenge,
                game=sudokuGame,
                alarmDateTime=alarm_datetime,
                user=None,
            )
    else:
        # Singleplayer: user=user, unique per (challenge, game, alarmDateTime, user)
        try:
            game_state, created = SudokuGameState.objects.get_or_create(
                challenge=challenge,
                game=sudokuGame,
                alarmDateTime=alarm_datetime,
                user=user,
                defaults=defaults
            )
        except IntegrityError:
            created = False
            game_state = SudokuGameState.objects.get(
                challenge=challenge,
                game=sudokuGame,
                alarmDateTime=alarm_datetime,
                user=user,
            )

    if created:
        print(f"[SUDOKU][create] chall={challenge.id} gs={game_state.id} multiplayer={is_multiplayer}", flush=True)
    else:
        print(f"[SUDOKU][reuse] chall={challenge.id} gs={game_state.id} multiplayer={is_multiplayer}", flush=True)
        # Derive is_multiplayer from existing game state
        is_multiplayer = bool(getattr(game_state.game, 'isMultiplayer', False))

    # Ensure user is recorded as a player (track accuracy stats)
    if allow_join:
        SudokuGamePlayer.objects.get_or_create(
            gameState=game_state,
            player=user,
            defaults={'accuracyCount': 0, 'inaccuracyCount': 0}
        )

    return {
        "game_state_id": game_state.id,
        "puzzle": game_state.puzzle,
        "solution": game_state.solution ,
        "is_multiplayer": is_multiplayer,
        # expose timings for waiting room
        "created_at": (game_state.created_at.isoformat() if game_state.created_at else None),
        "join_deadline_at": (game_state.join_deadline_at.isoformat() if game_state.join_deadline_at else None),
    }


@sync_to_async
def validate_sudoku_move(game_state_id, user, index, value):
    try:
        game_state = SudokuGameState.objects.get(id=game_state_id)
    except SudokuGameState.DoesNotExist:
        return {'error': 'Game not found', 'is_correct': False, 'is_complete': False}

    row, col = divmod(index, 9)
    # if the cell is already correctly filled, reject the move
    if game_state.puzzle[row][col] == game_state.solution[row][col]:
        return {
            'type': 'ignored'
        }
    correct_value = game_state.solution[row][col]
    is_correct = (correct_value == value)

    player_record, _ = SudokuGamePlayer.objects.get_or_create(
        gameState=game_state,
        player=user,
        defaults={'accuracyCount': 0, 'inaccuracyCount': 0}
    )

    if is_correct:
        player_record.accuracyCount += 1
        game_state.puzzle[row][col] = value
        game_state.save()
        
        print("correct: ", player_record.accuracyCount)
    else:
        player_record.inaccuracyCount += 1
        print("incorrect: ", player_record.inaccuracyCount)
    player_record.save()

    is_complete = game_state.puzzle == game_state.solution

    if is_complete:
        print("i'm getting passed yay~")
        players = SudokuGamePlayer.objects.filter(gameState=game_state)
        total_correct = sum(int(getattr(p, 'accuracyCount', 0) or 0) for p in players) or 1
        player_scores = []

        for player in players:
            correct = int(getattr(player, 'accuracyCount', 0) or 0)
            incorrect = int(getattr(player, 'inaccuracyCount', 0) or 0)
            print("correct: ", correct)
            print("incorrect: ", incorrect)
            print("total correct: ", total_correct)
            print("player: ", player.player.username)

            # Progress-based score: share of cells filled correctly by this player
            progress_score = (correct / total_correct) * 100
            player_scores.append({
                'username': player.player.username,
                'accuracy': correct,
                'inaccuracy': incorrect,
                'score': round(progress_score, 2)
            })

        return {
            'is_correct': True,
            'is_complete': True,
            'scores': player_scores
        }

    return {
        'is_correct': is_correct,
        'is_complete': False
    }

