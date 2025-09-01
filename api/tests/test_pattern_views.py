# tests/test_pattern_views.py
import pytest
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from api.models import Challenge

User = get_user_model()

@pytest.mark.django_db
def test_create_pattern_game_view():
    client = APIClient()

    # 建立一個使用者並登入
    user = User.objects.create_user(username="alice", password="pw")
    client.force_authenticate(user=user)

    # 建立一個 challenge
    challenge = Challenge.objects.create(name="Ch", startDate="2025-01-01", endDate="2025-01-10")

    # 呼叫 API
    resp = client.post("/api/pattern/create/", {"challenge_id": challenge.id}, format="json")

    # 驗證
    assert resp.status_code == 200
    body = resp.json()
    assert "game_state_id" in body
    assert "pattern_sequence" in body

@pytest.mark.django_db
def test_validate_pattern_move_view():
    client = APIClient()
    user = User.objects.create_user(username="bob", password="pw")
    client.force_authenticate(user=user)

    # 建立挑戰 + 遊戲
    challenge = Challenge.objects.create(name="Ch2", startDate="2025-01-01", endDate="2025-01-10")
    from api.patternMem.utils import get_or_create_pattern_game
    payload = get_or_create_pattern_game(challenge.id, user)
    gs_id = payload["game_state_id"]
    ans1 = payload["pattern_sequence"][0]

    # 呼叫 validate
    resp = client.post("/api/pattern/validate/", {
        "game_state_id": gs_id,
        "round_number": 1,
        "player_sequence": ans1
    }, format="json")

    assert resp.status_code == 200
    data = resp.json()
    assert "is_correct" in data
    assert data["is_correct"] is True

# pytest -s -vv api/tests/test_pattern_views.py
