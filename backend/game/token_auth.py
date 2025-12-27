from urllib.parse import parse_qs
import jwt
from django.conf import settings
from channels.db import database_sync_to_async


@database_sync_to_async
def get_user_from_token(token: str):
    # Do Django imports lazily to avoid importing model classes at module import time
    from django.contrib.auth import get_user_model
    from django.contrib.auth.models import AnonymousUser

    User = get_user_model()
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get('user_id')
        if not user_id:
            return AnonymousUser()
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return AnonymousUser()
    except Exception:
        return AnonymousUser()


class TokenAuthMiddleware:
    """ASGI middleware that reads a JWT token from the WS query string and sets scope['user'].

    This middleware is an ASGI app: it implements __call__(scope, receive, send).
    Example ws URL: wss://host/ws/<game_id>?token=<jwt>
    """
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        # Only operate on websocket connections (safe-guard)
        try:
            query_string = scope.get('query_string', b'').decode()
        except Exception:
            query_string = ''
        # Prefer token passed as Sec-WebSocket-Protocol header (subprotocol)
        token = None
        headers = dict((k.lower(), v) for k, v in scope.get('headers', []))
        proto_val = headers.get(b'sec-websocket-protocol')
        if proto_val:
            try:
                # header may contain comma-separated subprotocols; take the first
                proto_str = proto_val.decode()
                token_candidate = proto_str.split(',')[0].strip()
                if token_candidate:
                    token = token_candidate
            except Exception:
                token = None

        # fallback to query string ?token=...
        if not token:
            qs = parse_qs(query_string)
            token = qs.get('token', [None])[0]
        if token:
            # Attempt to resolve token -> user
            user = await get_user_from_token(token)
            # copy scope to avoid mutating shared dicts
            scope = dict(scope)
            scope['user'] = user
            # Log minimal info for debugging (do NOT log token value in production)
            try:
                import logging
                logging.getLogger(__name__).debug(f"TokenAuth: resolved user={getattr(user, 'id', None)} authenticated={getattr(user, 'is_authenticated', False)}")
            except Exception:
                pass
        return await self.app(scope, receive, send)
