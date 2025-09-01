import pytest
from channels.testing import WebsocketCommunicator
from django.conf import settings
from asgiref.sync import sync_to_async
from django.contrib.auth import get_user_model

from api.models import GameCategory, Game, Challenge
from api.patternMem.utils import get_or_create_pattern_game

User = get_user_model()

@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
async def test_ws_connect_only():
    # 用 InMemory channel layer，免 Redis
    settings.CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}
    # 設定好之後再 import application，避免讀到舊設定
    from myserver.asgi import application

    # 建基本資料（注意：同步 ORM 要用 sync_to_async 包起來）
    u = await sync_to_async(User.objects.create_user)(username="ws", password="x")
    cat = await sync_to_async(GameCategory.objects.create)(categoryName="Memory", isMultiplayer=True)
    await sync_to_async(Game.objects.create)(name="Pattern Memorization", category=cat)
    chall = await sync_to_async(Challenge.objects.create)(name="Ch", startDate="2025-01-01", endDate="2025-01-10")

    payload = await sync_to_async(get_or_create_pattern_game)(challenge_id=chall.id, user=u)
    gs_id = payload["game_state_id"]

    comm = WebsocketCommunicator(application, f"/ws/pattern/{gs_id}/")
    comm.scope["user"] = u  # 模擬已登入使用者

    connected, _ = await comm.connect()
    assert connected

    # 接受 1~2 則初始訊息（不強制類型，避免因順序差異出錯）
    for _ in range(2):
        try:
            await comm.receive_json_from(timeout=3.0)
        except Exception:
            break

    await comm.disconnect()

@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
async def test_first_round_submit():
    settings.CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}
    from myserver.asgi import application

    u = await sync_to_async(User.objects.create_user)(username="ws2", password="x")
    cat = await sync_to_async(GameCategory.objects.create)(categoryName="Memory", isMultiplayer=True)
    await sync_to_async(Game.objects.create)(name="Pattern Memorization", category=cat)
    chall = await sync_to_async(Challenge.objects.create)(name="Ch2", startDate="2025-01-01", endDate="2025-01-10")

    payload = await sync_to_async(get_or_create_pattern_game)(challenge_id=chall.id, user=u)
    gs_id = payload["game_state_id"]
    ans1 = payload["pattern_sequence"][0]

    comm = WebsocketCommunicator(application, f"/ws/pattern/{gs_id}/")
    comm.scope["user"] = u
    connected, _ = await comm.connect()
    assert connected

    # 吃掉初始訊息
    for _ in range(3):
        try:
            await comm.receive_json_from(timeout=3.0)
        except Exception:
            break

    # 送第一回合答案
    await comm.send_json_to({"type": "make_move", "round_number": 1, "player_sequence": ans1})

    # 等第一個回覆（現在會是 move_result，或 fallback 的 error）
    msg = await comm.receive_json_from(timeout=3.0)
    assert msg["type"] in {"move_result", "round_cleared", "round_advance", "game_complete"}
    if msg["type"] == "move_result":
        assert msg["is_correct"] is True

    await comm.disconnect()
