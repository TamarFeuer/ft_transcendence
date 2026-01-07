from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
import json
from .models import GameSession
import logging

logger = logging.getLogger(__name__)
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.models import User
from django.views.decorators.csrf import ensure_csrf_cookie
from django.conf import settings
import jwt
from datetime import datetime, timedelta
import uuid

UserModel = get_user_model()

# Token expiration times
ACCESS_TOKEN_LIFETIME = timedelta(minutes=2)  # Short-lived access token
REFRESH_TOKEN_LIFETIME = timedelta(days=7)     # Long-lived refresh token

def generate_tokens(user):
    """Generate access and refresh tokens for a user."""
    access_token_payload = {
        'user_id': user.id,
        'username': user.username,
        'type': 'access',
        'exp': datetime.utcnow() + ACCESS_TOKEN_LIFETIME,
        'iat': datetime.utcnow()
    }
    
    refresh_token_payload = {
        'user_id': user.id,
        'type': 'refresh',
        'jti': str(uuid.uuid4()),  # Unique ID for refresh token
        'exp': datetime.utcnow() + REFRESH_TOKEN_LIFETIME,
        'iat': datetime.utcnow()
    }
    
    access_token = jwt.encode(access_token_payload, settings.SECRET_KEY, algorithm='HS256')
    refresh_token = jwt.encode(refresh_token_payload, settings.SECRET_KEY, algorithm='HS256')
    
    return access_token, refresh_token

@require_http_methods(["GET"])
def health(request):
    return JsonResponse({'status': 'ok'})

@csrf_exempt
@require_http_methods(["POST"])
def create_game(request):
    game = GameSession.create_game()
    game.isTournamentGame = False
    # Use logging so output is captured by gunicorn/daphne/docker logs
    logger.warning(f"Created game with ID: {game.id}")
    return JsonResponse({
        'gameId': game.id,
        'status': 'waiting',
        'message': 'Game created. Waiting for players to join.'
    })

@require_http_methods(["GET"])
def get_game(request, game_id):
    game = GameSession.get_game(game_id)
    
    if not game:
        return JsonResponse({'error': 'Game not found'}, status=404)
    
    return JsonResponse({
        'gameId': game.id,
        'status': game.status,
        'players': {
            'left': 'connected' if game.players['left'] else 'empty',
            'right': 'connected' if game.players['right'] else 'empty'
        },
        'score': game.state['score']
    })

@require_http_methods(["GET"])
def list_games(request):
    games = GameSession.list_games()
    return JsonResponse({
        'games': [
            {
                'id': g.id,
                'status': g.status,
                'playerCount': len(g.clients),
                'isTournamentGame': g.isTournamentGame
            }
            for g in games
        ]
    })


@csrf_exempt
@require_http_methods(["POST"])
def register(request):
    try:
        data = json.loads(request.body.decode())
        username = data.get('username')
        password = data.get('password')
        if not username or not password:
            return JsonResponse({'error': 'username and password required'}, status=400)
        if UserModel.objects.filter(username=username).exists():
            return JsonResponse({'error': 'username taken'}, status=400)
        user = UserModel.objects.create_user(username=username, password=password)
        access_token, refresh_token = generate_tokens(user)
        
        response = JsonResponse({
            'success': True,
            'username': user.username,
            'user_id': user.id
        })
        
        # Set HTTP-only cookies
        response.set_cookie(
            'access_token',
            access_token,
            max_age=int(ACCESS_TOKEN_LIFETIME.total_seconds()),
            httponly=True,
            secure=not settings.DEBUG,  # HTTPS in production
            samesite='Lax'
        )
        response.set_cookie(
            'refresh_token',
            refresh_token,
            max_age=int(REFRESH_TOKEN_LIFETIME.total_seconds()),
            httponly=True,
            secure=not settings.DEBUG,
            samesite='Lax'
        )
        
        return response
    except Exception as e:
        logger.exception('Error in register')
        return JsonResponse({'error': 'internal error'}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def login_view(request):
    try:
        data = json.loads(request.body.decode())
        username = data.get('username')
        password = data.get('password')
        user = authenticate(username=username, password=password)
        if user is None:
            return JsonResponse({'error': 'invalid credentials'}, status=401)
        access_token, refresh_token = generate_tokens(user)
        
        response = JsonResponse({
            'success': True,
            'username': user.username,
            'user_id': user.id
        })
        
        # Set HTTP-only cookies
        response.set_cookie(
            'access_token',
            access_token,
            max_age=int(ACCESS_TOKEN_LIFETIME.total_seconds()),
            httponly=True,
            secure=not settings.DEBUG,
            samesite='Lax'
        )
        response.set_cookie(
            'refresh_token',
            refresh_token,
            max_age=int(REFRESH_TOKEN_LIFETIME.total_seconds()),
            httponly=True,
            secure=not settings.DEBUG,
            samesite='Lax'
        )
        
        return response
    except Exception:
        logger.exception('Error in login')
        return JsonResponse({'error': 'internal error'}, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def refresh_token_view(request):
    """Exchange a valid refresh token for a new access token."""
    try:
        # Get refresh token from cookie
        refresh_token = request.COOKIES.get('refresh_token')
        
        if not refresh_token:
            return JsonResponse({'error': 'refresh_token required'}, status=400)
        
        try:
            # Decode and verify refresh token
            payload = jwt.decode(refresh_token, settings.SECRET_KEY, algorithms=['HS256'])
            
            # Verify it's a refresh token
            if payload.get('type') != 'refresh':
                return JsonResponse({'error': 'invalid token type'}, status=401)
            
            user_id = payload.get('user_id')
            user = UserModel.objects.get(id=user_id)
            
            # Generate new tokens
            access_token, new_refresh_token = generate_tokens(user)
            
            response = JsonResponse({
                'success': True,
                'username': user.username,
                'user_id': user.id
            })
            
            # Set new cookies
            response.set_cookie(
                'access_token',
                access_token,
                max_age=int(ACCESS_TOKEN_LIFETIME.total_seconds()),
                httponly=True,
                secure=not settings.DEBUG,
                samesite='Lax'
            )
            response.set_cookie(
                'refresh_token',
                new_refresh_token,
                max_age=int(REFRESH_TOKEN_LIFETIME.total_seconds()),
                httponly=True,
                secure=not settings.DEBUG,
                samesite='Lax'
            )
            
            return response
            
        except jwt.ExpiredSignatureError:
            return JsonResponse({'error': 'refresh token expired'}, status=401)
        except jwt.DecodeError:
            return JsonResponse({'error': 'invalid refresh token'}, status=401)
        except UserModel.DoesNotExist:
            return JsonResponse({'error': 'user not found'}, status=401)
            
    except Exception:
        logger.exception('Error in refresh_token')
        return JsonResponse({'error': 'internal error'}, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def logout_view(request):
    response = JsonResponse({'success': True})
    # Clear cookies
    response.delete_cookie('access_token')
    response.delete_cookie('refresh_token')
    return response

@require_http_methods(["GET"])
def current_user_view(request):
    # Check cookies from headers
    headers = dict(request.headers)
    cookies = request.COOKIES
    
    print("Headers:", headers)
    print("Cookies:", cookies)
    print("Authorization:", headers.get('Authorization'))

    """Get current user from access token cookie."""
    access_token = request.COOKIES.get('access_token')
    logger.warning(f"current_user_view: access_token: {access_token}")
    if not access_token:
        return JsonResponse({'authenticated': False}, status=401)
    
    try:
        payload = jwt.decode(access_token, settings.SECRET_KEY, algorithms=['HS256'])
        logger.warning(f"current_user_view: decoded payload: {payload}")
        if payload.get('type') != 'access':
            return JsonResponse({'authenticated': False}, status=401)
        
        user_id = payload.get('user_id')
        username = payload.get('username')
        
        return JsonResponse({
            'authenticated': True,
            'username': username,
            'user_id': user_id
        })
        
    except jwt.ExpiredSignatureError:
        return JsonResponse({'authenticated': False, 'error': 'token_expired'}, status=401)
    except jwt.DecodeError:
        return JsonResponse({'authenticated': False}, status=401)