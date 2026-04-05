from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/chess/(?P<game_id>[^/]+)$', consumers.ChessConsumer.as_asgi()),
]