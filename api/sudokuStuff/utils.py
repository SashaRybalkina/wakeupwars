from api.models import SudokuGameState, Challenge, SudokuGamePlayer, GameSchedule, GameScheduleGameAssociation, User, Game
from sudoku import Sudoku
import time
import random
from django.db import transaction
from asgiref.sync import sync_to_async
from datetime import timedelta
from django.utils import timezone


def get_or_create_game(challenge_id, user, allow_join: bool = True):
    challenge = Challenge.objects.get(id=challenge_id)
    # TODO: Right now it only returns one game for the challenge, but it should return all games for the challenge.
    # There could be more than one scheduled in one alarm, so beware of this and make changes
    # Try to get existing game for this challenge
    game_state = SudokuGameState.objects.filter(challenge=challenge).first()
    sched_ids = list( GameSchedule.objects.filter(challenge_id=challenge_id).values_list('id', flat=True))
    assoc = (GameScheduleGameAssociation.objects.filter(game_schedule_id__in=sched_ids).select_related('game').order_by('game_order', 'id').first())
    sudokuGame = assoc.game if assoc else Game.objects.filter(name__icontains='sudoku').order_by('id').first()
    is_multiplayer = bool(getattr(sudokuGame, 'isMultiplayer', False))
    print("is multiplayer: ", is_multiplayer)

    game_name = sudokuGame.name
    print("game name: ", game_name)
    
    difficulty = 0.1

    if not game_state:
        
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
        game_state.join_deadline_at = timezone.now() + timedelta(seconds=20)
        game_state.save(update_fields=["join_deadline_at"])
    else:
        # Existing state, infer multiplayer from its game safely
        gs_game = getattr(game_state, 'game', None)
        is_multiplayer = bool(getattr(gs_game, 'isMultiplayer', False))

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

