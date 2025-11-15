import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from api.models import Challenge, WordleGameState, WordleMove, WordleGamePlayer
import api.views as views   # <-- so we can mock validate_wordle_move
from api.wordleStuff.utils import get_or_create_game_wordle
import asyncio

User = get_user_model()


# # ---------------- REST API Tests (with mock for validate_wordle_move) ---------------- #

# @pytest.mark.django_db
# def test_create_wordle_game_success():
#     """Should create a new Wordle game successfully"""
#     client = APIClient()
#     user = User.objects.create_user(username="tester_view1", password="pw")
#     client.force_authenticate(user=user)

#     challenge = Challenge.objects.create(name="View Challenge 1")

#     response = client.post("/api/wordle/create/", {"challenge_id": challenge.id}, format="json")

#     assert response.status_code == 200
#     data = response.json()
#     assert "game_state_id" in data
#     assert "puzzle" in data
#     assert data["is_multiplayer"] is False


# @pytest.mark.django_db
# def test_create_wordle_game_missing_challenge_id():
#     """Should fail if challenge_id is missing"""
#     client = APIClient()
#     user = User.objects.create_user(username="tester_view2", password="pw")
#     client.force_authenticate(user=user)

#     response = client.post("/api/wordle/create/", {}, format="json")
#     assert response.status_code == 400


# @pytest.mark.django_db
# def test_create_wordle_game_invalid_challenge():
#     """Should return 404 if challenge_id does not exist"""
#     client = APIClient()
#     user = User.objects.create_user(username="tester_view3", password="pw")
#     client.force_authenticate(user=user)

#     response = client.post("/api/wordle/create/", {"challenge_id": 9999}, format="json")
#     assert response.status_code == 404


# @pytest.mark.django_db
# def test_validate_wordle_move_missing_params():
#     """Should fail if parameters are missing"""
#     client = APIClient()
#     user = User.objects.create_user(username="tester_view6", password="pw")
#     client.force_authenticate(user=user)

#     response = client.post("/api/wordle/validate/", {}, format="json")
#     assert response.status_code == 400


# @pytest.mark.django_db
# def test_validate_wordle_move_invalid_game():
#     """Should return 404 if game_state_id does not exist"""
#     client = APIClient()
#     user = User.objects.create_user(username="tester_view7", password="pw")
#     client.force_authenticate(user=user)

#     response = client.post("/api/wordle/validate/", {
#         "game_state_id": 9999,
#         "row": 0,
#         "guess": "ABCDE",
#     }, format="json")

#     assert response.status_code == 404

# @pytest.mark.django_db
# def test_validate_wordle_move_correct_guess(monkeypatch):
#     """測試正確猜測時，view 是否能回傳正確結果"""
#     client = APIClient()
#     user = User.objects.create_user(username="tester_view4", password="pw")
#     client.force_authenticate(user=user)
#     challenge = Challenge.objects.create(name="View Challenge 2")

#     game_data = get_or_create_game_wordle(challenge.id, user)
#     gs_id = game_data["game_state_id"]

#     # ✅ mock 一個同步的 validate_wordle_move
#     def fake_validate_wordle_move(game_id, user, guess, row):
#         return {
#             "is_correct": True,
#             "is_complete": True,
#             "score_awarded": 50,
#             "scores": [],
#             "feedback": []
#         }

#     monkeypatch.setattr(views, "validate_wordle_move", fake_validate_wordle_move)

#     response = client.post("/api/wordle/validate/", {
#         "game_state_id": gs_id,
#         "row": 0,
#         "guess": "RIGHT",
#     }, format="json")

#     assert response.status_code == 200
#     data = response.json()
#     assert data["is_correct"] is True
#     assert data["is_complete"] is True
#     assert data["score_awarded"] == 50


# @pytest.mark.django_db
# def test_validate_wordle_move_wrong_guess(monkeypatch):
#     """測試錯誤猜測時，view 是否能回傳正確結果"""
#     client = APIClient()
#     user = User.objects.create_user(username="tester_view5", password="pw")
#     client.force_authenticate(user=user)
#     challenge = Challenge.objects.create(name="View Challenge 3")

#     game_data = get_or_create_game_wordle(challenge.id, user)
#     gs_id = game_data["game_state_id"]

#     # ✅ mock 一個同步的 validate_wordle_move
#     def fake_validate_wordle_move(game_id, user, guess, row):
#         return {
#             "is_correct": False,
#             "is_complete": False,
#             "score_awarded": 0,
#             "scores": [],
#             "feedback": [
#                 {"letter": "W", "result": "absent"},
#                 {"letter": "R", "result": "present"},
#                 {"letter": "O", "result": "absent"},
#                 {"letter": "N", "result": "absent"},
#                 {"letter": "G", "result": "absent"},
#             ]
#         }

#     monkeypatch.setattr(views, "validate_wordle_move", fake_validate_wordle_move)

#     response = client.post("/api/wordle/validate/", {
#         "game_state_id": gs_id,
#         "row": 0,
#         "guess": "WRONG",
#     }, format="json")

#     assert response.status_code == 200
#     data = response.json()
#     assert data["is_correct"] is False
#     assert data["is_complete"] is False
#     assert data["score_awarded"] == 0
#     assert isinstance(data["feedback"], list)


# # @pytest.mark.django_db
# # def test_wordle_end_to_end_correct_guess():
# #     """E2E: Should create a game and solve it correctly"""
# #     client = APIClient()
# #     user = User.objects.create_user(username="e2e_user1", password="pw")
# #     client.force_authenticate(user=user)

# #     # Step 1: Create challenge & game
# #     challenge = Challenge.objects.create(name="E2E Challenge 1")
# #     response = client.post("/api/wordle/create/", {"challenge_id": challenge.id}, format="json")
# #     assert response.status_code == 200
# #     data = response.json()
# #     gs_id = data["game_state_id"]

# #     # Fetch solution from DB
# #     gs = WordleGameState.objects.get(id=gs_id)
# #     solution = "".join(gs.solution)

# #     # Step 2: Make a correct guess
# #     response = client.post("/api/wordle/validate/", {
# #         "game_state_id": gs.id,
# #         "row": 0,
# #         "guess": solution,
# #     }, format="json")

# #     assert response.status_code == 200
# #     data = response.json()
# #     assert data["is_correct"] is True
# #     assert data["is_complete"] is True
# #     assert data["score_awarded"] > 0

# #     # Verify DB updated
# #     move = WordleMove.objects.get(gameState=gs, player=user)
# #     assert move.guess == solution
# #     player_record = WordleGamePlayer.objects.get(gameState=gs, player=user)
# #     assert player_record.accuracyCount == 1


# # @pytest.mark.django_db
# # def test_wordle_end_to_end_wrong_then_correct():
# #     """E2E: Should allow multiple guesses until solved"""
# #     client = APIClient()
# #     user = User.objects.create_user(username="e2e_user2", password="pw")
# #     client.force_authenticate(user=user)

# #     challenge = Challenge.objects.create(name="E2E Challenge 2")
# #     response = client.post("/api/wordle/create/", {"challenge_id": challenge.id}, format="json")
# #     gs_id = response.json()["game_state_id"]
# #     gs = WordleGameState.objects.get(id=gs_id)
# #     solution = "".join(gs.solution)

# #     # Step 1: Wrong guess
# #     response = client.post("/api/wordle/validate/", {
# #         "game_state_id": gs.id,
# #         "row": 0,
# #         "guess": "XXXXX",
# #     }, format="json")
# #     assert response.status_code == 200
# #     assert response.json()["is_correct"] is False

# #     # Step 2: Correct guess
# #     response = client.post("/api/wordle/validate/", {
# #         "game_state_id": gs.id,
# #         "row": 1,
# #         "guess": solution,
# #     }, format="json")
# #     assert response.status_code == 200
# #     data = response.json()
# #     assert data["is_correct"] is True
# #     assert data["is_complete"] is True


# # ---------------- WebSocket Tests (commented out for now) ---------------- #
# # If you later test WebSocket, you can also mock validate_wordle_move in the same way.
# #
# # @pytest.mark.asyncio
# # async def test_wordle_websocket_game_flow(mocker):
# #     mocker.patch.object(
# #         views,
# #         "validate_wordle_move",
# #         return_value={"is_correct": False, "is_complete": False, "score_awarded": 0, "scores": [], "feedback": []},
# #     )
# #     communicator = WebsocketCommunicator(application, "/ws/wordle/1/")
# #     connected, subprotocol = await communicator.connect()
# #     assert connected
# #     await communicator.send_json_to({"action": "guess", "game_state_id": 1, "row": 0, "guess": "HELLO"})
# #     response = await communicator.receive_json_from()
# #     assert "feedback" in response
# #     await communicator.disconnect()
