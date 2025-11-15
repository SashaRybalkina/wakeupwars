import threading
from django.utils import timezone
import pytest
from django.contrib.auth import get_user_model
from api.models import Challenge, Game, GameCategory, SudokuGameState, WordleGameState
from api.sudokuStuff.utils import get_or_create_game as sudoku_get_or_create
from api.wordleStuff.utils import get_or_create_game_wordle as wordle_get_or_create

User = get_user_model()

# @pytest.mark.django_db(transaction=True)
# def test_sudoku_concurrent_creates_single_row():
#     # Arrange
#     u1 = User.objects.create_user(username="u1", password="pw")
#     u2 = User.objects.create_user(username="u2", password="pw")
#     chall = Challenge.objects.create(name="C1")
#     cat = GameCategory.objects.create(categoryName="Math")
#     Game.objects.create(name="Group Sudoku", category=cat, isMultiplayer=True)

#     # Fixed, normalized alarm time
#     alarm_dt = timezone.now().replace(second=0, microsecond=0)

#     barrier = threading.Barrier(2)
#     results = []

#     def worker(user):
#         barrier.wait()
#         data = sudoku_get_or_create(chall.id, user, allow_join=False, alarm_datetime=alarm_dt)
#         results.append(data["game_state_id"])

#     t1 = threading.Thread(target=worker, args=(u1,))
#     t2 = threading.Thread(target=worker, args=(u2,))
#     t1.start(); t2.start(); t1.join(); t2.join()

#     assert len(results) == 2
#     assert results[0] == results[1]

#     # Only one DB row
#     cnt = SudokuGameState.objects.filter(
#         challenge=chall, game__name__icontains="sudoku",
#         alarmDateTime=alarm_dt, user__isnull=True
#     ).count()
#     assert cnt == 1

# @pytest.mark.django_db(transaction=True)
# def test_wordle_concurrent_creates_single_row():
#     u1 = User.objects.create_user(username="wu1", password="pw")
#     u2 = User.objects.create_user(username="wu2", password="pw")
#     chall = Challenge.objects.create(name="C2")
#     cat = GameCategory.objects.create(categoryName="Word")
#     Game.objects.create(name="Wordle", category=cat, isMultiplayer=True)

#     alarm_dt = timezone.now().replace(second=0, microsecond=0)

#     barrier = threading.Barrier(2)
#     results = []

#     def worker(user):
#         barrier.wait()
#         data = wordle_get_or_create(chall.id, user, allow_join=False, alarm_datetime=alarm_dt)
#         results.append(data["game_state_id"])

#     t1 = threading.Thread(target=worker, args=(u1,))
#     t2 = threading.Thread(target=worker, args=(u2,))
#     t1.start(); t2.start(); t1.join(); t2.join()

#     assert results[0] == results[1]
#     cnt = WordleGameState.objects.filter(
#         challenge=chall, game__name__icontains="wordle",
#         alarmDateTime=alarm_dt, user__isnull=True
#     ).count()
#     assert cnt == 1