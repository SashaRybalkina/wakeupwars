 # utils.py – core logic for Pattern Memorization
from math import remainder
from django.db import transaction
from asgiref.sync import sync_to_async
from typing import List, Dict, Any
import random
from django.utils import timezone
from datetime import timedelta

from api.models import (
    PatternMemorizationGameState,
    PatternMemorizationGamePlayer,
    Challenge,
    Game,
    GameSchedule,
    GameScheduleGameAssociation
)

# Allowed elements for the pattern – keep it simple and frontend friendly
ALLOWED_ELEMENTS = ["red", "blue", "green", "yellow"]

def _build_full_pattern(max_rounds: int, start_len: int = 4) -> List[List[str]]:
    """
    Build a list of rounds, each round is a cumulative pattern.
    Example when max_rounds=5 and start_len=4:
    round 1 -> len=4
    round 2 -> len=5
    ...
    round 5 -> len=8
    """
    rounds = []
    current = []
    # seed initial
    for _ in range(start_len):
        current.append(random.choice(ALLOWED_ELEMENTS))
    rounds.append(current.copy())
    # extend for following rounds
    for r in range(2, max_rounds + 1):
        current.append(random.choice(ALLOWED_ELEMENTS))
        rounds.append(current.copy())
    return rounds


@transaction.atomic  # ensure all DB changes are committed together or rolled back (all-or-nothing)
def get_or_create_pattern_game(challenge_id: int, user, allow_join: bool = True) -> Dict[str, Any]:
    """
    Create (or reuse) a PatternMemorizationGameState for a given challenge
    and ensure the current user has a player row.
    """
    challenge = Challenge.objects.get(id=challenge_id)
    game_state = PatternMemorizationGameState.objects.filter(challenge=challenge).first()
    sched_ids = list( GameSchedule.objects.filter(challenge_id=challenge_id).values_list('id', flat=True))
    assoc = (GameScheduleGameAssociation.objects.filter(game_schedule_id__in=sched_ids).select_related('game').order_by('game_order', 'id').first())
    patternMemGame = assoc.game if assoc else Game.objects.filter(name__icontains='pattern').order_by('id').first()
    is_multiplayer = bool(getattr(patternMemGame, 'isMultiplayer', False))
    print("is multiplayer: ", is_multiplayer)
    # is_multiplayer = challenge.groupID is not None # same like sudoku, checking is part of the group or not

    if not game_state:
        # Build full pattern for all rounds (max_rounds is default=5 in model)
        max_rounds = 2
        pattern = _build_full_pattern(max_rounds=max_rounds, start_len=4)

        # Create the game state
        game_state = PatternMemorizationGameState.objects.create(
            game=patternMemGame,
            challenge=challenge,
            max_rounds=max_rounds,
            current_round=1,
            pattern_sequence=pattern,
            is_completed=False
        )

        # set join deadline to 2 minutes after creation
        deadline = timezone.now() + timedelta(minutes=2)
        game_state.join_deadline_at = deadline
        game_state.save(update_fields=["join_deadline_at"])
        
        # let the developer see the pattern in console for testing
        print(f"[PATTERN][create] gamestate={game_state.id} chall={challenge_id} rounds={max_rounds}", flush=True)
        for i, seq in enumerate(pattern, start=1):
            print(f"  - round {i}: {seq}", flush=True)

    # Ensure user is recorded as a player only if allowed
    if allow_join:
        PatternMemorizationGamePlayer.objects.get_or_create(
            game_state=game_state,
            player=user,
            defaults={"rounds_completed": 0, "score": 0, "last_round_success": True}
        )

    result = {
        "game_id": game_state.game.id,
        "game_state_id": game_state.id,
        "pattern_sequence": game_state.pattern_sequence,
        "current_round": game_state.current_round,
        "max_rounds": game_state.max_rounds,
        "is_multiplayer": is_multiplayer,
    }

    
    import logging
    logger = logging.getLogger(__name__)
    logger.warning(f"[PatternCreate] returning {result}")

    return result


@sync_to_async
@transaction.atomic
def validate_pattern_move(game_state_id: int, user, round_number: int, player_sequence: List[str]) -> Dict[str, Any]:
    """
    Strict global-sync + first-full-match scoring.
    - Only the current global round is accepted.
    - Score is awarded ONLY when the player fully matches the round for the FIRST time.
    - Partial matches score 0. Re-submissions of the same round do not add score again.
    - When the last round is fully matched, the game is completed and final scores are returned.
    """
    # Lock the game state row to prevent race conditions in concurrent submissions.
    try:
        game_state = PatternMemorizationGameState.objects.select_for_update().get(id=game_state_id)
    except PatternMemorizationGameState.DoesNotExist:
        return {"error": "Game not found", "is_correct": False, "is_complete": False}

    # If the game already ended, reject further scoring.
    if game_state.is_completed:
        return {"error": "Game already completed", "is_correct": False, "is_complete": True}

    # Enforce strict global sync: only accept answers for the current global round.
    if round_number != game_state.current_round:
        return {"error": "Round closed", "is_correct": False, "is_complete": game_state.is_completed}

    # Validate round bounds.
    if round_number < 1 or round_number > game_state.max_rounds:
        return {"error": "Invalid round number", "is_correct": False, "is_complete": False}

    # Fetch the expected pattern and normalize both sides.
    expected = game_state.pattern_sequence[round_number - 1]
    norm_expected = [e.strip().lower() for e in expected]
    norm_player = [e.strip().lower() for e in player_sequence]

    # For debugging, having correct answer and player input
    print(
        f"[PATTERN][validate] gs={game_state_id} user={getattr(user, 'username', user)} "
        f"round={round_number} expected={norm_expected} got={norm_player}",
        flush=True
    )

    # Full match check (strict policy: only full match scores).
    is_full_match = (norm_player == norm_expected)
    round_full_score = int(100 / game_state.max_rounds)  # full-match score equals round length

    # Load or create the player record.
    player_rec, _ = PatternMemorizationGamePlayer.objects.get_or_create(
        game_state=game_state,
        player=user,
        defaults={"rounds_completed": 0, "score": 0, "last_round_success": True}
    )

    # Scoring: only the FIRST time a player fully matches this round will award points.
    #    Partial matches always yield 0 and do not change rounds_completed.
    if is_full_match and player_rec.rounds_completed < round_number:
        base_score = 100 // game_state.max_rounds
        round_full_score = base_score
        if round_number == game_state.max_rounds:
            remainder = 100 % game_state.max_rounds
            round_full_score = base_score + remainder

        print(
            f"[DEBUG scoring] before save | user={player_rec.player.username} "
            f"round={round_number}, awarded_so_far={player_rec.score}, "
            f"base={base_score}, final_award={round_full_score}"
        )
        
        player_rec.score += round_full_score
        player_rec.rounds_completed = round_number
        player_rec.last_round_success = True
    else:
        # Either partial/incorrect, or a duplicate full submission for the same round.
        # In both cases, no score is added. We still record success/failure for UI feedback.
        round_full_score = 0
        player_rec.last_round_success = bool(is_full_match)

    player_rec.save()
    print(f"[DEBUG scoring] after save | total={player_rec.score}")

    # If someone fully matches the current round and it's not the last round, advance the global round.
    if is_full_match and game_state.current_round == round_number and round_number < game_state.max_rounds:
        game_state.current_round = round_number + 1
        game_state.save()

    # If this was the final round and it was fully matched, mark the game completed and compile final scores.
    game_completed_now = False
    game_scores = None
    if is_full_match and round_number == game_state.max_rounds:
        game_state.is_completed = True
        game_state.save()
        game_completed_now = True

        all_players = PatternMemorizationGamePlayer.objects.filter(game_state=game_state)
        game_scores = [
            {"username": p.player.username, "rounds_completed": p.rounds_completed, "score": p.score}
            for p in all_players
        ]

    # Return result payload. For transparency, include round_score: full length on success, else 0.
    return {
        "is_correct": is_full_match,
        "round_score": round_full_score if is_full_match else 0,
        "is_complete": game_completed_now,
        "scores": game_scores,
    }
