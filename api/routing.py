from django.urls import re_path
from api.sudokuStuff import consumers
from api.wordleStuff import consumers as wc
from api.patternMem.consumers import PatternMemorizationConsumer
from api.chat_consumer import ChatConsumer
from api.notification_consumer import UserNotificationConsumer

websocket_urlpatterns = [
    re_path(r'ws/sudoku/(?P<game_state_id>\d+)/$', consumers.SudokuConsumer.as_asgi()),
    re_path(r'ws/wordle/(?P<game_state_id>\d+)/$', wc.WordleConsumer.as_asgi()),
    re_path(r'ws/pattern/(?P<game_state_id>\d+)/$', PatternMemorizationConsumer.as_asgi()),
    re_path(r'ws/chat/(?P<user_id>\d+)/(?P<other_user_id>\d+)/$', ChatConsumer.as_asgi()),
    re_path(r'ws/chat/group/(?P<group_id>\d+)/$', ChatConsumer.as_asgi()),
    re_path(r'ws/chat/groups/(?P<user_id>\d+)/$', ChatConsumer.as_asgi()),  # NEW: all group chats for user
    re_path(r'ws/chat/users/(?P<user_id>\d+)/$', ChatConsumer.as_asgi()),   # NEW: all 1-1 chats for user
    re_path(r'ws/user/notifications/(?P<user_id>\d+)/$', UserNotificationConsumer.as_asgi()),
]