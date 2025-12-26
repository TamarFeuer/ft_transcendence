import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from game.routing import websocket_urlpatterns as game_ws
from chat.routing import websocket_urlpatterns as chat_ws


os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_server.settings')

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": AuthMiddlewareStack(
        URLRouter(game_ws + chat_ws)
    ),})