from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    # whenever a WebSocket connection comes in at /ws/chat/, create a new ChatConsumer instance and handle it
	re_path(r'ws/chat/$', consumers.ChatConsumer.as_asgi()),
]
