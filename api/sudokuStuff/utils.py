from api.models import SudokuGameState, Challenge, SudokuGamePlayer, User, Game
from sudoku import Sudoku
import time
import random
from django.db import transaction
from asgiref.sync import sync_to_async


def get_or_create_game(challenge_id, user):
    challenge = Challenge.objects.get(id=challenge_id)
    is_multiplayer = challenge.groupID is not None # TODO: will need to eventually check if this game is multiplayer, not enough to just check
                                                    # if part of a group challenge
    # difficulty = 0.5 if is_multiplayer else 0.3  # medium for groups, easy for solo
    difficulty = 0.1 if is_multiplayer else 0.1

    # Try to get existing game for this challenge
    game_state = SudokuGameState.objects.filter(challenge=challenge).first()

    if not game_state:
        # Generate a new puzzle and solution
        sudoku = Sudoku(3, 3, seed=int(time.time() * 1000)).difficulty(difficulty)
        puzzle = sudoku.board
        solution = sudoku.solve().board

        # Create game
        print("creating new gamestate")
        # TODO: I'm hardcoding this for now (id 1 is sudoku)
        sudokuGame = Game.objects.get(id=7)
        game_state = SudokuGameState.objects.create(
            game = sudokuGame,
            challenge=challenge,
            puzzle=puzzle,
            solution=solution
        )

    # Ensure user is recorded as a player (track accuracy stats)
    SudokuGamePlayer.objects.get_or_create(
        gameState=game_state,
        player=user,
        defaults={'accuracyCount': 0, 'inaccuracyCount': 0}
    )

    return {
        "game_state_id": game_state.id,
        "puzzle": game_state.puzzle,
        "is_multiplayer": is_multiplayer,
    }


@sync_to_async
def validate_sudoku_move(game_state_id, user, index, value):
    try:
        game_state = SudokuGameState.objects.get(id=game_state_id)
    except SudokuGameState.DoesNotExist:
        return {'error': 'Game not found', 'is_correct': False, 'is_complete': False}

    row, col = divmod(index, 9)
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

