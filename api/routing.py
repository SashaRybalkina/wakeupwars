from django.urls import re_path
from api.sudokuStuff import consumers

websocket_urlpatterns = [
    re_path(r'ws/sudoku/(?P<game_state_id>\d+)/$', consumers.SudokuConsumer.as_asgi()),
]