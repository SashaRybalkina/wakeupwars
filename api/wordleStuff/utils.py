"""
/**
 * @file utils.py
 * @description Handles Wordle game creation, puzzle generation, player
 * registration, guess validation, and leaderboard scoring.
 */
"""

from api.models import GameCategory, WordleGameState, Challenge, WordleGamePlayer, User, Game, WordleMove, GameSchedule, GameScheduleGameAssociation
import random
from django.db import transaction
from django.db import IntegrityError
from asgiref.sync import sync_to_async
from api.words_array import words
from django.utils import timezone
from datetime import timedelta

MAX_ATTEMPTS = 5  # frontend also defines 5 rows

def compute_multiplayer_score(rank: int, total_players: int) -> int:
    """
    Compute score based on rank (1st, 2nd, ...) in multiplayer Wordle.
    - First place = 100
    - Last place > 0 (unless did not finish)
    - Formula: score = 100 * (total_players - (rank - 1)) / total_players
    """
    if rank < 1 or rank > total_players:
        return 0
    return int(100 * (total_players - (rank - 1)) / total_players)


@transaction.atomic
def get_or_create_game_wordle(challenge_id, user, allow_join: bool = True, alarm_datetime=None):
    """
    Create or reuse a WordleGameState for a given challenge using proper get_or_create.
    Uses unique constraints to prevent race conditions.
    Ensure the user is recorded as a player.
    """
    challenge = Challenge.objects.select_for_update().get(id=challenge_id)
    sched_ids = list(GameSchedule.objects.filter(challenge_id=challenge_id).values_list('id', flat=True))
    # Filter for Wordle games specifically to avoid mixing with other game types
    assoc = (GameScheduleGameAssociation.objects.filter(game_schedule_id__in=sched_ids).select_related('game').filter(game__name__icontains='wordle').order_by('game_order', 'id').first())
    wordleGame = assoc.game if assoc else Game.objects.filter(name__icontains='wordle').order_by('id').first()
    is_multiplayer = bool(getattr(wordleGame, 'isMultiplayer', False))
    print("is multiplayer: ", is_multiplayer)
    
    # Use alarm_datetime if provided, otherwise use now
    if alarm_datetime is None:
        alarm_datetime = timezone.now()
    # Normalize to minute precision so concurrent calls share the same key
    alarm_datetime = alarm_datetime.replace(second=0, microsecond=0)
    
    # Prepare defaults for creation
    target_word = random.choice(words).upper()
    puzzle = ["_"] * len(target_word)
    solution = list(target_word)
    
    defaults = {
        'puzzle': puzzle,
        'solution': solution,
        'answer': target_word,
        'join_deadline_at': timezone.now() + timedelta(seconds=20),
    }
    
    # Use get_or_create with proper unique constraint fields
    if is_multiplayer:
        # Multiplayer: user=None, unique per (challenge, game, alarmDateTime)
        try:
            game_state, created = WordleGameState.objects.get_or_create(
                challenge=challenge,
                game=wordleGame,
                alarmDateTime=alarm_datetime,
                user=None,
                defaults=defaults
            )
        except IntegrityError:
            created = False
            game_state = WordleGameState.objects.get(
                challenge=challenge,
                game=wordleGame,
                alarmDateTime=alarm_datetime,
                user=None,
            )
    else:
        # Singleplayer: user=user, unique per (challenge, game, alarmDateTime, user)
        try:
            game_state, created = WordleGameState.objects.get_or_create(
                challenge=challenge,
                game=wordleGame,
                alarmDateTime=alarm_datetime,
                user=user,
                defaults=defaults
            )
        except IntegrityError:
            created = False
            game_state = WordleGameState.objects.get(
                challenge=challenge,
                game=wordleGame,
                alarmDateTime=alarm_datetime,
                user=user,
            )
    
    if created:
        print(f"[WORDLE][create] chall={challenge.id} gs={game_state.id} answer={target_word} multiplayer={is_multiplayer}", flush=True)
    else:
        print(f"[WORDLE][reuse] chall={challenge.id} gs={game_state.id} multiplayer={is_multiplayer}", flush=True)
        # Derive is_multiplayer from existing game state
        is_multiplayer = bool(getattr(game_state.game, 'isMultiplayer', False))

    # Ensure user is recorded as a player
    if allow_join:
        WordleGamePlayer.objects.get_or_create(
            gameState=game_state,
            player=user,
            defaults={'accuracyCount': 0, 'inaccuracyCount': 0, 'color': None}
        )

    return {
        "game_state_id": game_state.id,
        "puzzle": game_state.puzzle,
        "is_multiplayer": is_multiplayer,
        # expose timings for waiting room like Sudoku
        "created_at": (game_state.created_at.isoformat() if game_state.created_at else None),
        "join_deadline_at": (game_state.join_deadline_at.isoformat() if game_state.join_deadline_at else None),
        "answer": game_state.answer,  # ⚠️ for debugging only
    }


@transaction.atomic
def validate_wordle_move(game_state_id, user, guess, row):
    """
    Validate a Wordle guess and return feedback, correctness, completion, and scores.
    """
    game_state = WordleGameState.objects.get(id=game_state_id)
    is_multiplayer = bool(getattr(game_state.game, 'isMultiplayer', False))
    print("is multiplayer: ", is_multiplayer)

    solution = game_state.solution
    if isinstance(solution, str):
        solution = list(solution)

    guess = guess.upper()

    feedback = []
    solution_chars = solution.copy()

    # Step 1: mark exact matches
    for i, char in enumerate(guess):
        if i < len(solution) and char == solution[i]:
            feedback.append({"letter": char, "result": "correct"})
            solution_chars[i] = None
        else:
            feedback.append({"letter": char, "result": "absent"})

    # Step 2: mark misplaced letters (present but wrong position)
    for i, f in enumerate(feedback):
        if f["result"] == "absent" and f["letter"] in solution_chars:
            feedback[i]["result"] = "present"
            solution_chars[solution_chars.index(f["letter"])] = None

    # Save the move
    WordleMove.objects.update_or_create(
        gameState=game_state,
        player=user,
        row=row,
        defaults={"guess": guess}
    )

    # Update player stats
    player_record, _ = WordleGamePlayer.objects.get_or_create(
        gameState=game_state,
        player=user,
        defaults={'accuracyCount': 0, 'inaccuracyCount': 0}
    )

    is_correct = guess == "".join(solution)

    if is_correct:
        player_record.accuracyCount += 1
    else:
        player_record.inaccuracyCount += 1
    player_record.save()

    # Check if game is complete
    is_complete = is_correct or (row >= MAX_ATTEMPTS - 1)

    # ---- Scoring ----
    score_awarded = 0
    if not is_multiplayer:
        # Single-player: scoring based on the row (earlier guesses score higher)
        if is_correct:
            base_score = 100 // MAX_ATTEMPTS
            score_awarded = 100 - (row * base_score)
    else:
        # Multiplayer: competitive mode, scores are calculated in leaderboard
        # No immediate score_awarded (score is finalized after ranking)
        score_awarded = 0

    # Debug log
    print(
        f"[WORDLE][validate] gs={game_state_id} user={user.username} row={row} "
        f"guess={guess} solution={''.join(solution)} correct={is_correct} complete={is_complete} "
        f"score_awarded={score_awarded} is_multiplayer={is_multiplayer}",
        flush=True
    )

    # ---- Leaderboard ----
    scores = []
    players = WordleGamePlayer.objects.filter(gameState=game_state)

    if not is_multiplayer:
        # Single-player leaderboard (original logic)
        for p in players:
            last_move = WordleMove.objects.filter(gameState=game_state, player=p.player).order_by("-row").first()
            if p.accuracyCount > 0 and last_move:
                base_score = 100 // MAX_ATTEMPTS
                score = 100 - last_move.row * base_score
            else:
                score = 0
            scores.append({
                "username": p.player.username,
                "score": score,
            })
    else:
        # Multiplayer leaderboard: rank players by completion order → assign scores
        finishers = []
        for p in players:
            # Check if player has a correct guess
            last_correct = WordleMove.objects.filter(
                gameState=game_state,
                player=p.player,
                guess="".join(solution)
            ).order_by("row").first()
            if last_correct:
                finishers.append((p.player.username, last_correct.row))

        # Sort by row (earlier correct guesses rank higher)
        finishers = sorted(finishers, key=lambda x: x[1])
        total_players = players.count()

        for rank, (username, _) in enumerate(finishers, start=1):
            scores.append({
                "username": username,
                "score": compute_multiplayer_score(rank, total_players),
            })

        # Unfinished players = 0 points
        unfinished = set(p.player.username for p in players) - set(u for u, _ in finishers)
        for username in unfinished:
            scores.append({"username": username, "score": 0})

    # Sort leaderboard by score descending
    scores = sorted(scores, key=lambda x: x["score"], reverse=True)

    return {
        "feedback": feedback,
        "is_correct": is_correct,
        "is_complete": is_complete,
        "score_awarded": score_awarded,
        "scores": scores,
    }


# Async wrappers for WebSocket usage
get_or_create_game_wordle_async = sync_to_async(get_or_create_game_wordle, thread_sensitive=True)
validate_wordle_move_async = sync_to_async(validate_wordle_move, thread_sensitive=True)

