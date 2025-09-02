# ws_smoke_test.py
import os
import sys
import asyncio
import time

from django.core.cache import cache

def clear_pattern_game_cache(game_state_id):
    """
    清除與 pattern game 相關的所有 Redis key（round, ready, started, lock, scores, answer）
    確保每次測試都是從乾淨的遊戲狀態開始。
    """
    keys = [
        f"pattern:round:{game_state_id}",
        f"pattern:ready:{game_state_id}",
        f"pattern:started:{game_state_id}",
        f"pattern:scores:{game_state_id}",
        f"pattern:lock:{game_state_id}",
        f"pattern:answer:{game_state_id}",
    ]
    for key in keys:
        cache.delete(key)








# --- logging（讓 Channels/consumer 的 log 也印到 console）---
import logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    stream=sys.stdout,
)

# 1) 設定 Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "myserver.settings")
import django
django.setup()

# 2) 用 InMemory channel layer（避免需要 Redis）
from django.conf import settings
settings.CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}

# 3) 匯入需要的 model / utils / application
from django.contrib.auth import get_user_model
from api.models import GameCategory, Game, Challenge, ChallengeMembership, PatternMemorizationGamePlayer, PatternMemorizationGameState
from api.patternMem.utils import get_or_create_pattern_game
from channels.testing import WebsocketCommunicator
from myserver.asgi import application
from asgiref.sync import sync_to_async

# 🧹 Reset 遊戲資料與 cache
async def reset_pattern_game():
    await sync_to_async(PatternMemorizationGameState.objects.all().delete)()
    await sync_to_async(PatternMemorizationGamePlayer.objects.all().delete)()
    await sync_to_async(Game.objects.all().delete)()
    await sync_to_async(Challenge.objects.all().delete)()
    await sync_to_async(ChallengeMembership.objects.all().delete)()
    await sync_to_async(clear_pattern_game_cache)()

User = get_user_model()

async def smoke_full_game_flow():
    print("=== 測試：完整五回合流程 ===")

    #await reset_pattern_game()

    # 建立兩位使用者
    u1, _ = await sync_to_async(User.objects.get_or_create)(username="new_ws_user1", defaults={"password": "x"})
    u2, _ = await sync_to_async(User.objects.get_or_create)(username="new_ws_user2", defaults={"password": "x"})

    # 遊戲與挑戰
    cat, _ = await sync_to_async(GameCategory.objects.get_or_create)(categoryName="Memory", isMultiplayer=True)
    game, _ = await sync_to_async(Game.objects.get_or_create)(name="Pattern Memorization", category=cat)
    chall, _ = await sync_to_async(Challenge.objects.get_or_create)(name="new_Ch-full", defaults={"startDate": "2025-01-01", "endDate": "2025-01-10"})

    # 加入挑戰
    await sync_to_async(ChallengeMembership.objects.get_or_create)(challengeID=chall, uID=u1)
    await sync_to_async(ChallengeMembership.objects.get_or_create)(challengeID=chall, uID=u2)

    # 初始化遊戲狀態
    payload = await sync_to_async(get_or_create_pattern_game)(challenge_id=chall.id, user=u1)
    gs_id = payload["game_state_id"]
    clear_pattern_game_cache(gs_id)

    # WebSocket 連線 for 兩位玩家
    comm1 = WebsocketCommunicator(application, f"/ws/pattern/{gs_id}/")
    comm2 = WebsocketCommunicator(application, f"/ws/pattern/{gs_id}/")
    comm1.scope["user"] = u1
    comm2.scope["user"] = u2
    connected1, _ = await comm1.connect()
    connected2, _ = await comm2.connect()
    print("連線狀態:", connected1, connected2)

    # 等待初始化
    await comm1.receive_json_from()
    await comm2.receive_json_from()

    # 送出 ready
    await comm1.send_json_to({"type": "player_ready"})
    await comm2.send_json_to({"type": "player_ready"})

    current_round = 0
    max_round = 5
    while current_round < max_round:
        print(f"\n--- Round {current_round + 1} ---")

        msg1, _ = await wait_for_types(comm1, {"pattern_sequence"}, total_timeout=100.0)
        sequence = msg1["sequence"]
        round_number = msg1["round_number"]
        print(f"[OK] 回合 {round_number} 序列為: {sequence}")
        current_round = round_number

        # 玩家 1 搶答（正確）
        await comm1.send_json_to({
            "type": "player_answer",
            "round_number": round_number,
            "sequence": sequence
        })

        # 玩家 2 延遲送出
        await asyncio.sleep(1.2)
        await comm2.send_json_to({
            "type": "player_answer",
            "round_number": round_number,
            "sequence": sequence
        })

        # 玩家 1 回應
        ans1, _ = await wait_for_types(comm1, {"answer_result"}, total_timeout=100.0)
        print("玩家 1 回應:", ans1)

        # 玩家 2 回應（成功或錯誤）
        ans2, _ = await wait_for_types(comm2, {"answer_result"}, total_timeout=100.0)
        print("玩家 2 回應:", ans2)

        # 最後一 round 完成就跳出，否則等待下一回合的 pattern
        if ans1["is_complete"]:
            print("✅ 遊戲已完成，進入 game over 階段")
            break

    # 等待最終得分
    final_msg, _ = await wait_for_types(comm1, {"game_over"}, total_timeout=100.0)
    print("🎉 Game Over 回傳:", final_msg)

    await comm1.disconnect()
    await comm2.disconnect()
    print("=== 測試完成 ===\n")


async def smoke_race_to_next_round():
    print("=== 測試：兩位玩家搶答 → 是否會全體進入下一 round ===")

    # 建立兩位使用者
    u1, _ = await sync_to_async(User.objects.get_or_create)(username="ws_user1", defaults={"password": "x"})
    u2, _ = await sync_to_async(User.objects.get_or_create)(username="ws_user2", defaults={"password": "x"})

    # 遊戲與挑戰
    cat, _ = await sync_to_async(GameCategory.objects.get_or_create)(categoryName="Memory", isMultiplayer=True)
    game, _ = await sync_to_async(Game.objects.get_or_create)(name="Pattern Memorization", category=cat)
    chall, _ = await sync_to_async(Challenge.objects.get_or_create)(name="Ch-race",
        defaults={"startDate": "2025-01-01", "endDate": "2025-01-10"}
    )

    # 加入挑戰
    await sync_to_async(ChallengeMembership.objects.get_or_create)(challengeID=chall, uID=u1)
    await sync_to_async(ChallengeMembership.objects.get_or_create)(challengeID=chall, uID=u2)

    # 初始化遊戲
    payload = await sync_to_async(get_or_create_pattern_game)(challenge_id=chall.id, user=u1)
    gs_id = payload["game_state_id"]

    # ⭐ 清除舊的 Redis 快取（讓這次測試從乾淨狀態開始）
    clear_pattern_game_cache(gs_id)

    # WebSocket 連線 for 兩位玩家
    comm1 = WebsocketCommunicator(application, f"/ws/pattern/{gs_id}/")
    comm2 = WebsocketCommunicator(application, f"/ws/pattern/{gs_id}/")
    comm1.scope["user"] = u1
    comm2.scope["user"] = u2

    connected1, _ = await comm1.connect()
    connected2, _ = await comm2.connect()
    print("連線狀態:", connected1, connected2)
    assert connected1 and connected2

    # 等待 lobby_state
    await comm1.receive_json_from()
    await comm2.receive_json_from()

    # 兩人都送出 ready → 倒數 3 → 2 → 1 → game_start → pattern_sequence
    await comm1.send_json_to({"type": "player_ready"})
    await comm2.send_json_to({"type": "player_ready"})

    msg1, _ = await wait_for_types(comm1, {"pattern_sequence"}, total_timeout=20.0)
    msg2, _ = await wait_for_types(comm2, {"pattern_sequence"}, total_timeout=20.0)

    sequence = msg1["sequence"]
    round_number = msg1["round_number"]
    print(f"[OK] 回合 {round_number} 序列為:", sequence)

    # 玩家 1 立即搶答（送出正確序列）
    await comm1.send_json_to({
        "type": "player_answer",
        "round_number": round_number,
        "sequence": sequence
    })

    # 玩家 2 隨後送出（看是否被接受，或錯過回合）
    await asyncio.sleep(1.5)
    await comm2.send_json_to({
        "type": "player_answer",
        "round_number": round_number,
        "sequence": sequence
    })

    # 玩家 1 期待收到回覆
    ans1, _ = await wait_for_types(comm1, {"answer_result"}, total_timeout=100.0)
    print("玩家 1 回應:", ans1)

    # 玩家 2 的回覆（可能是成功也可能是「round closed」）
    ans2, _ = await wait_for_types(comm2, {"answer_result"}, total_timeout=100.0)
    print("玩家 2 回應:", ans2)

    # 新 round 出現 → current_round+1 的 pattern_sequence
    next_msg1, _ = await wait_for_types(comm1, {"pattern_sequence"}, total_timeout=200.0)
    print("玩家 1 新 round:", next_msg1)

    next_msg2, _ = await wait_for_types(comm2, {"pattern_sequence"}, total_timeout=200.0)
    print("玩家 2 新 round:", next_msg2)

    await comm1.disconnect()
    await comm2.disconnect()
    print("=== 測試完成 ===\n")


# 小工具：等到指定 type 的訊息；一路把收到的訊息都列印出來，方便 debug
async def wait_for_types(comm, wanted_types, total_timeout=100.0, per_msg_timeout=50.0, max_msgs=300):
    start = time.monotonic()
    seen = []
    while time.monotonic() - start < total_timeout and len(seen) < max_msgs:
        try:
            msg = await comm.receive_json_from(timeout=per_msg_timeout)
            print("[DEBUG From test] 收到：", msg)
            seen.append(msg)
            if msg.get("type") in wanted_types:
                return msg, seen
        except asyncio.TimeoutError:
            # 短暫沒訊息就繼續等，直到 total_timeout
            pass
    print("⚠️ wait_for_types 超時，期間內所收集的訊息：")
    for i, m in enumerate(seen, 1):
        print(f"  #{i}: {m}")
    raise asyncio.TimeoutError(f"Did not receive any of {wanted_types} within {total_timeout}s")


async def smoke_min_flow():
    print("=== 測試：最小流程（ready → 倒數 → game_start → pattern_sequence） ===")

    # 使用/建立一個測試使用者
    try:
        u = await sync_to_async(User.objects.get)(username="ws_user_min")
    except User.DoesNotExist:
        u = await sync_to_async(User.objects.create_user)(username="ws_user_min", password="x")

    # 準備類別與遊戲（get_or_create 避免重複）
    cat, _ = await sync_to_async(GameCategory.objects.get_or_create)(
        categoryName="Memory", isMultiplayer=True
    )
    game, _ = await sync_to_async(Game.objects.get_or_create)(
        name="Pattern Memorization", category=cat
    )
    # 準備挑戰（get_or_create，避免多筆同名引發 MultipleObjectsReturned）
    chall, _ = await sync_to_async(Challenge.objects.get_or_create)(
        name="Ch-min",
        defaults={"startDate": "2025-01-01", "endDate": "2025-01-10"}
    )

    # ⭐ 確保這個使用者在這個挑戰裡（關鍵，讓 expected_count > 0）
    await sync_to_async(ChallengeMembership.objects.get_or_create)(
        challengeID=chall,
        uID=u
    )

    # 取得或建立此挑戰對應的 pattern 遊戲狀態
    payload = await sync_to_async(get_or_create_pattern_game)(
        challenge_id=chall.id,
        user=u
    )
    gs_id = payload["game_state_id"]

    # 建立 WebSocket 連線 & 模擬已登入使用者
    comm = WebsocketCommunicator(application, f"/ws/pattern/{gs_id}/")
    comm.scope["user"] = u

    connected, _ = await comm.connect()
    print("連線結果 connected =", connected)
    assert connected

    # 先收初始化訊息（應會有 lobby_state）
    try:
        init1 = await comm.receive_json_from(timeout=2.0)
        print("[init] 收到：", init1)
    except Exception:
        print("⚠️ 沒有在 2 秒內收到初始化訊息（lobby_state），請檢查 consumer.connect()")
        await comm.disconnect()
        return

    # 送出 ready → 期待收到 3..2..1 的 lobby_countdown，之後 game_start 會觸發 pattern_sequence
    await comm.send_json_to({"type": "player_ready"})

    # 你可以先看到一串 lobby_countdown（非必要），直接等 pattern_sequence 即可
    msg, seen = await wait_for_types(
        comm,
        wanted_types={"pattern_sequence"},
        total_timeout=12.0,   # 給足夠時間跑 3 秒倒數 + 處理
        per_msg_timeout=5.0
    )

    # 成功拿到當前 round 的序列
    sequence = msg["sequence"]
    round_number = msg["round_number"]
    print(f"[OK] 收到第 {round_number} 回合序列：", sequence)

    await comm.disconnect()
    print("=== 測試完成 ===\n")


async def main():
   # await smoke_min_flow()
   await smoke_full_game_flow()
   #await smoke_race_to_next_round()

if __name__ == "__main__":
    asyncio.run(main())
