import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from game.routing import websocket_urlpatterns as game_ws
from chat.routing import websocket_urlpatterns as chat_ws

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_server.settings')

# Initialize Django ASGI application first so app registry is ready before importing
# modules that access Django models (token_auth imports auth models).
django_asgi_app = get_asgi_application()

from game.token_auth import TokenAuthMiddleware

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    # Use AuthMiddlewareStack for session auth; TokenAuthMiddleware can populate scope['user'] from JWT query.
    "websocket": AuthMiddlewareStack(
        TokenAuthMiddleware(
            URLRouter(game_ws + chat_ws)
        )
    ),
    
    "websocket": AuthMiddlewareStack(
    URLRouter(game_ws + chat_ws)
)
})