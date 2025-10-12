from api.models import SudokuGameState, Challenge, SudokuGamePlayer, User, Game
from sudoku import Sudoku
import time
import random
from django.db import transaction
from asgiref.sync import sync_to_async
from datetime import timedelta
from django.utils import timezone


def get_or_create_game(challenge_id, user, allow_join: bool = True):
    challenge = Challenge.objects.get(id=challenge_id)
    # Try to get existing game for this challenge
    game_state = SudokuGameState.objects.filter(challenge=challenge).first()

    if not game_state:
        # Create a new game state
        # Prefer Game(id=10), but fall back to a Sudoku-like game or any game
        sudokuGame = None
        try:
            sudokuGame = Game.objects.get(id=10)
        except Game.DoesNotExist:
            pass
        if sudokuGame is None:
            sudokuGame = Game.objects.filter(name__icontains="sudoku").first()
        if sudokuGame is None:
            sudokuGame = Game.objects.order_by("id").first()

        # Determine multiplayer from game, else from challenge membership, else default False
        is_multiplayer = bool(getattr(sudokuGame, 'isMultiplayer', (challenge.groupID_id is not None)))

        # difficulty can be tuned per mode
        difficulty = 0.1 if is_multiplayer else 0.1

        sudoku = Sudoku(3, 3, seed=int(time.time() * 1000)).difficulty(difficulty)
        puzzle = sudoku.board
        solution = sudoku.solve().board

        game_state = SudokuGameState.objects.create(
            game=sudokuGame,
            challenge=challenge,
            puzzle=puzzle,
            solution=solution,
        )
        # set join deadline to 2 minutes after creation
        game_state.join_deadline_at = timezone.now() + timedelta(minutes=2)
        game_state.save(update_fields=["join_deadline_at"])
    else:
        # Existing state, infer multiplayer from its game safely
        gs_game = getattr(game_state, 'game', None)
        is_multiplayer = bool(getattr(gs_game, 'isMultiplayer', (challenge.groupID_id is not None)))

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
    else:
        player_record.inaccuracyCount += 1

    player_record.save()

    is_complete = game_state.puzzle == game_state.solution

    if is_complete:
        players = SudokuGamePlayer.objects.filter(gameState=game_state)
        player_scores = []

        for player in players:
            correct = player.accuracyCount
            incorrect = player.inaccuracyCount
            total_attempts = correct + incorrect if (correct + incorrect) > 0 else 1

            # Scoring system: scale based on accuracy
            accuracy_score = correct / total_attempts * 100
            player_scores.append({
                'username': player.player.username,
                'accuracy': correct,
                'inaccuracy': incorrect,
                'score': round(accuracy_score, 2)
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

