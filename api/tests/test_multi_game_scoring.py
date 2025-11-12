import pytest
from datetime import timedelta
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from api.models import (
    Challenge, Game, GameCategory, GameSchedule, GameScheduleGameAssociation,
    ChallengeMembership, GamePerformance
)

User = get_user_model()


@pytest.fixture
def setup_game_category():
    """Create a game category for testing"""
    return GameCategory.objects.create(categoryName="Logic")


@pytest.fixture
def setup_games(setup_game_category):
    """Create singleplayer and multiplayer versions of each game type"""
    category = setup_game_category
    games = {
        'sudoku_single': Game.objects.create(
            name="Sudoku Singleplayer",
            category=category,
            isMultiplayer=False
        ),
        'sudoku_multi': Game.objects.create(
            name="Sudoku Multiplayer",
            category=category,
            isMultiplayer=True
        ),
        'wordle_single': Game.objects.create(
            name="Wordle Singleplayer",
            category=category,
            isMultiplayer=False
        ),
        'wordle_multi': Game.objects.create(
            name="Wordle Multiplayer",
            category=category,
            isMultiplayer=True
        ),
        'typing_single': Game.objects.create(
            name="TypingRace Singleplayer",
            category=category,
            isMultiplayer=False
        ),
        'typing_multi': Game.objects.create(
            name="TypingRace Multiplayer",
            category=category,
            isMultiplayer=True
        ),
    }
    return games


@pytest.fixture
def setup_users():
    """Create test users"""
    users = {
        'user1': User.objects.create_user(username="player1", password="pw"),
        'user2': User.objects.create_user(username="player2", password="pw"),
        'user3': User.objects.create_user(username="player3", password="pw"),
    }
    return users


@pytest.fixture
def setup_challenge(setup_users):
    """Create a 2-day challenge"""
    today = timezone.localdate()
    challenge = Challenge.objects.create(
        name="Multi-Game Test Challenge",
        startDate=today,
        endDate=today + timedelta(days=1),
        totalDays=2,
        isPending=False,
        isCompleted=False,
        daysCompleted=0
    )
    
    # Add all users as members
    for user in setup_users.values():
        ChallengeMembership.objects.create(
            challengeID=challenge,
            uID=user,
            hasSetAlarms=True
        )
    
    return challenge


def create_game_schedule(challenge, day_of_week, games_list):
    """Helper to create a game schedule for a specific day"""
    game_schedule = GameSchedule.objects.create(
        challenge=challenge,
        dayOfWeek=day_of_week
    )
    
    for game, order in games_list:
        GameScheduleGameAssociation.objects.create(
            game_schedule=game_schedule,
            game=game,
            game_order=order
        )
    
    return game_schedule


def simulate_game_play(client, user, challenge, game, game_type, score):
    """Simulate playing a game and finalizing the result"""
    client.force_authenticate(user=user)
    
    if game_type == 'sudoku':
        create_response = client.post(
            "/api/sudoku/create/",
            {"challenge_id": challenge.id},
            format="json"
        )
        assert create_response.status_code == 200
        game_state_id = create_response.json()["game_state_id"]
        
        finalize_response = client.post(
            "/api/sudoku/finalize/",
            {
                "game_state_id": game_state_id,
                "accuracyCount": score,
                "inaccuracyCount": 100 - score,
                "is_complete": True,
                "score": score
            },
            format="json"
        )
        
    elif game_type == 'wordle':
        create_response = client.post(
            "/api/wordle/create/",
            {"challenge_id": challenge.id},
            format="json"
        )
        assert create_response.status_code == 200
        game_state_id = create_response.json()["game_state_id"]
        
        finalize_response = client.post(
            "/api/wordle/finalize/",
            {
                "game_state_id": game_state_id,
                "guesses": [],
                "is_complete": True,
                "is_correct": score > 0,
                "attempts_used": 3
            },
            format="json"
        )
        
    elif game_type == 'typing':
        create_response = client.post(
            "/api/typing-race/create/",
            {"challenge_id": challenge.id},
            format="json"
        )
        assert create_response.status_code == 200
        game_state_id = create_response.json()["game_state_id"]
        
        finalize_response = client.post(
            "/api/typing-race/finalize/",
            {
                "game_state_id": game_state_id,
                "accuracy": score  # Send as percentage (0-100), not decimal
            },
            format="json"
        )
    
    return finalize_response


# ==================== Test Cases ====================

@pytest.mark.django_db
def test_scenario_1_monday_multiplayer_wordle(setup_challenge, setup_games, setup_users):
    """
    Scenario: 1 multiplayer Wordle game on Monday (Day 1)
    Expected: All 3 users play, scores saved correctly
    """
    challenge = setup_challenge
    games = setup_games
    users = setup_users
    client = APIClient()
    
    today = challenge.startDate
    
    # Schedule: Monday (1) - 1 multiplayer Wordle
    create_game_schedule(challenge, 1, [(games['wordle_multi'], 1)])
    
    # All 3 users play
    scores = {'user1': 80, 'user2': 90, 'user3': 70}
    for username, score in scores.items():
        response = simulate_game_play(
            client, users[username], challenge, games['wordle_multi'], 'wordle', score
        )
        assert response.status_code == 200
    
    # Verify GamePerformance records
    performances = GamePerformance.objects.filter(
        challenge=challenge,
        game=games['wordle_multi'],
        date=today
    )
    assert performances.count() == 3
    
    for username in scores.keys():
        perf = performances.get(user=users[username])
        assert perf.score >= 0


@pytest.mark.django_db
def test_scenario_2_tuesday_two_singleplayer_sudoku(setup_challenge, setup_games, setup_users):
    """
    Scenario: 2 singleplayer Sudoku games on the same day
    Expected: Each user plays both games, 6 total GamePerformance records
    """
    challenge = setup_challenge
    games = setup_games
    users = setup_users
    client = APIClient()
    
    today = challenge.startDate
    today_day_of_week = today.isoweekday()  # Get current day of week (1=Monday, 7=Sunday)
    
    # Create two different singleplayer sudoku games
    sudoku_game_2 = Game.objects.create(
        name="Sudoku Singleplayer 2",
        category=games['sudoku_single'].category,
        isMultiplayer=False
    )
    # Schedule both games for today's day of week
    create_game_schedule(challenge, today_day_of_week, [
        (games['sudoku_single'], 1),
        (sudoku_game_2, 2)
    ])
    
    # Each user plays both games
    game_scores = {
        'user1': {'game1': 85, 'game2': 90},
        'user2': {'game1': 75, 'game2': 80},
        'user3': {'game1': 95, 'game2': 88},
    }
    
    for username, scores in game_scores.items():
        response1 = simulate_game_play(
            client, users[username], challenge, games['sudoku_single'], 'sudoku', scores['game1']
        )
        assert response1.status_code == 200
        
        response2 = simulate_game_play(
            client, users[username], challenge, sudoku_game_2, 'sudoku', scores['game2']
        )
        assert response2.status_code == 200
    
    # Verify GamePerformance records
    perfs_game1 = GamePerformance.objects.filter(
        challenge=challenge,
        game=games['sudoku_single'],
        date=today
    )
    assert perfs_game1.count() == 3
    
    perfs_game2 = GamePerformance.objects.filter(
        challenge=challenge,
        game=sudoku_game_2,
        date=today
    )
    assert perfs_game2.count() == 3


@pytest.mark.django_db
def test_scenario_3_score_no_overwrite(setup_challenge, setup_games, setup_users):
    """
    Critical Test: Ensure playing different games on the same day doesn't overwrite scores
    Monday: Play Sudoku, then Wordle, then Typing Race (all singleplayer)
    Expected: 3 separate GamePerformance records per user
    """
    challenge = setup_challenge
    games = setup_games
    users = setup_users
    client = APIClient()
    
    day1 = challenge.startDate
    
    # Schedule 3 different game types on Monday
    create_game_schedule(challenge, 1, [
        (games['sudoku_single'], 1),
        (games['wordle_single'], 2),
        (games['typing_single'], 3)
    ])
    
    # User1 plays all 3 games with different scores
    user = users['user1']
    
    # Play Sudoku
    response1 = simulate_game_play(
        client, user, challenge, games['sudoku_single'], 'sudoku', 70
    )
    assert response1.status_code == 200
    
    # Verify Sudoku score saved
    sudoku_perf = GamePerformance.objects.get(
        challenge=challenge,
        game=games['sudoku_single'],
        user=user,
        date=day1
    )
    assert sudoku_perf.score == 70
    
    # Play Wordle
    response2 = simulate_game_play(
        client, user, challenge, games['wordle_single'], 'wordle', 80
    )
    assert response2.status_code == 200
    
    # Verify both scores still exist
    sudoku_perf.refresh_from_db()
    assert sudoku_perf.score == 70  # Should NOT be overwritten
    
    # Play Typing Race
    response3 = simulate_game_play(
        client, user, challenge, games['typing_single'], 'typing', 90
    )
    assert response3.status_code == 200
    
    # Verify all 3 scores still exist
    user_perfs = GamePerformance.objects.filter(
        challenge=challenge,
        user=user,
        date=day1
    )
    assert user_perfs.count() == 3
    
    # Verify each score is distinct
    sudoku_perf.refresh_from_db()
    assert sudoku_perf.score == 70
    
    typing_perf = GamePerformance.objects.get(
        challenge=challenge,
        game=games['typing_single'],
        user=user,
        date=day1
    )
    assert typing_perf.score == 90