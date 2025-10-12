import pytest
from django.contrib.auth import get_user_model
from api.models import Challenge, WordleGameState, WordleGamePlayer
from api.wordleStuff.utils import get_or_create_game_wordle, validate_wordle_move, MAX_ATTEMPTS

User = get_user_model()


@pytest.mark.django_db
def test_get_or_create_game_wordle_creates_new_game():
    """Ensure get_or_create_game_wordle creates a new game state if none exists."""
    user = User.objects.create_user(username="tester1", password="pw")
    challenge = Challenge.objects.create(name="Test Challenge")

    game_data = get_or_create_game_wordle(challenge.id, user)

    gs = WordleGameState.objects.get(id=game_data["game_state_id"])
    assert gs.answer is not None
    assert game_data["puzzle"] == ["_"] * len(gs.answer)
    assert WordleGamePlayer.objects.filter(gameState=gs, player=user).exists()


@pytest.mark.django_db
def test_get_or_create_game_wordle_reuses_existing_game():
    """Ensure it reuses the same game state if already exists."""
    user = User.objects.create_user(username="tester2", password="pw")
    challenge = Challenge.objects.create(name="Test Challenge 2")

    game_data1 = get_or_create_game_wordle(challenge.id, user)
    game_data2 = get_or_create_game_wordle(challenge.id, user)

    assert game_data1["game_state_id"] == game_data2["game_state_id"]


@pytest.mark.django_db
def test_validate_wordle_move_correct_guess():
    """Submitting the correct guess should end the game and award score."""
    user = User.objects.create_user(username="tester3", password="pw")
    challenge = Challenge.objects.create(name="Test Challenge 3")

    game_data = get_or_create_game_wordle(challenge.id, user)
    gs = WordleGameState.objects.get(id=game_data["game_state_id"])

    guess = "".join(gs.solution)
    result = validate_wordle_move(gs.id, user, guess, 0)

    assert result["is_correct"] is True
    assert result["is_complete"] is True
    assert result["score_awarded"] > 0
    assert any(p["username"] == user.username for p in result["scores"])


@pytest.mark.django_db
def test_validate_wordle_move_wrong_guess():
    """Submitting a wrong guess should not complete the game and no score is awarded."""
    user = User.objects.create_user(username="tester4", password="pw")
    challenge = Challenge.objects.create(name="Test Challenge 4")

    game_data = get_or_create_game_wordle(challenge.id, user)
    gs = WordleGameState.objects.get(id=game_data["game_state_id"])

    result = validate_wordle_move(gs.id, user, "XXXXX", 0)

    assert result["is_correct"] is False
    assert result["is_complete"] is False
    assert result["score_awarded"] == 0


@pytest.mark.django_db
def test_validate_wordle_move_game_over_after_max_attempts():
    """Game should be marked complete after the last allowed attempt."""
    user = User.objects.create_user(username="tester5", password="pw")
    challenge = Challenge.objects.create(name="Test Challenge 5")

    game_data = get_or_create_game_wordle(challenge.id, user)
    gs = WordleGameState.objects.get(id=game_data["game_state_id"])

    last_row = MAX_ATTEMPTS - 1
    result = validate_wordle_move(gs.id, user, "YYYYY", last_row)

    assert result["is_complete"] is True
