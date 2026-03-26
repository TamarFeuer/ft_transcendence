from urllib.parse import parse_qs
import jwt
from django.conf import settings
from channels.db import database_sync_to_async
import logging

logger = logging.getLogger(__name__)

@database_sync_to_async
def get_user_from_token(token: str):
    # Do Django imports lazily to avoid importing model classes at module import time
    from django.contrib.auth import get_user_model
    from django.contrib.auth.models import AnonymousUser

    User = get_user_model()
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        logger.warning(f"get_user_from_token: decoding payload token: {payload}")
        
        # Verify it's an access token (not a refresh token)
        token_type = payload.get('type')
        if token_type and token_type != 'access':
            logger.warning(f"Invalid token type: {token_type}, expected 'access'")
            return AnonymousUser()
        
        user_id = payload.get('user_id')
        if not user_id:
            return AnonymousUser()
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return AnonymousUser()
    except jwt.ExpiredSignatureError:
        logger.warning("Token has expired")
        return AnonymousUser()
    except jwt.DecodeError:
        logger.warning("Invalid token")
        return AnonymousUser()
    except Exception as e:
        logger.warning(f"Error decoding token: {e}")
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
        logger.warning(f"TokenAuthMiddleware: scope type: {scope.get('type')}")
        
        token = None
        
        # 1. Try to get token from Cookie header
        headers = dict((k.lower(), v) for k, v in scope.get('headers', []))
        cookie_header = headers.get(b'cookie')
        if cookie_header:
            try:
                cookies_str = cookie_header.decode()
                # Parse cookies (simple parser for access_token)
                for cookie in cookies_str.split(';'):
                    cookie = cookie.strip()
                    if cookie.startswith('access_token='):
                        token = cookie.split('=', 1)[1]
                        break
            except Exception:
                pass
        
        # 2. Try Sec-WebSocket-Protocol header (subprotocol)
        if not token:
            proto_val = headers.get(b'sec-websocket-protocol')
            if proto_val:
                try:
                    # header may contain comma-separated subprotocols; take the first
                    proto_str = proto_val.decode()
                    token_candidate = proto_str.split(',')[0].strip()
                    if token_candidate:
                        token = token_candidate
                except Exception:
                    pass
        
        # 3. Fallback to query string ?token=...
        if not token:
            try:
                query_string = scope.get('query_string', b'').decode()
            except Exception:
                query_string = ''
            qs = parse_qs(query_string)
            token = qs.get('token', [None])[0]
        
        if token:
            # Attempt to resolve token -> user
            logger.warning(f"TokenAuth: received token: {token}")
            user = await get_user_from_token(token)
            logger.warning(f"TokenAuth: decoded user: {user}")

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
