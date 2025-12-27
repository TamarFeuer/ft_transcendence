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

UserModel = get_user_model()

@require_http_methods(["GET"])
def health(request):
    return JsonResponse({'status': 'ok'})

@csrf_exempt
@require_http_methods(["POST"])
def create_game(request):
    game = GameSession.create_game()
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
                'playerCount': len(g.clients)
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
        token = jwt.encode({'user_id': user.id, 'exp': datetime.utcnow() + timedelta(days=7)}, settings.SECRET_KEY, algorithm='HS256')
        return JsonResponse({'token': token, 'username': user.username})
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
        token = jwt.encode({'user_id': user.id, 'exp': datetime.utcnow() + timedelta(days=7)}, settings.SECRET_KEY, algorithm='HS256')
        return JsonResponse({'token': token, 'username': user.username})
    except Exception:
        logger.exception('Error in login')
        return JsonResponse({'error': 'internal error'}, status=500)


@require_http_methods(["POST"])
def logout_view(request):
    # For stateless JWTs there's no server-side logout unless you implement a blacklist.
    # Client should remove token locally. We return success for convenience.
    return JsonResponse({'status': 'ok'})