from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
import json
from .models import GameSession, Player
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings
from django.contrib.auth import get_user_model
import jwt
import logging

logger = logging.getLogger(__name__)
UserModel = get_user_model()


def resolve_cookie_user(request):
    """Resolve current user from JWT access token cookie for HTTP views."""
    token = request.COOKIES.get('access_token')
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
        if payload.get('type') != 'access':
            return None
        user_id = payload.get('user_id')
        if not user_id:
            return None
        return UserModel.objects.filter(id=user_id).first()
    except Exception:
        return None

@csrf_exempt
@require_http_methods(["POST"])
def create_game(request):
    # Safely extract optional invitee_id from JSON body (or fallback to query param)
    invitee_id = None
    try:
        if request.body:
            payload = json.loads(request.body.decode('utf-8'))
            invitee_id = payload.get('invitee_id')
    except Exception:
        invitee_id = None

    game = GameSession.create_game()
    game.isTournamentGame = False
    authenticated_user = None
    if getattr(request, 'user', None) and getattr(request.user, 'is_authenticated', False):
        authenticated_user = request.user
    else:
        authenticated_user = resolve_cookie_user(request)

    if authenticated_user:
        game.inviter_id = authenticated_user.id

    if invitee_id is not None:
        # Attach invitee_id for testing; preserve type if conversion fails
        try:
            game.invitee_id = int(invitee_id)
        except Exception:
            game.invitee_id = invitee_id

    if game.invitee_id is not None:
        channel_layer = get_channel_layer()
        if channel_layer and authenticated_user:
            invite_payload = {
                'type': 'game.invite.created',
                'game_id': game.id,
                'inviter_id': authenticated_user.id,
                'inviter_name': authenticated_user.username,
                'invitee_id': game.invitee_id,
            }
            async_to_sync(channel_layer.group_send)(f"user_{game.invitee_id}", invite_payload)
            async_to_sync(channel_layer.group_send)(f"user_{authenticated_user.id}", invite_payload)

    # Use logging so output is captured by gunicorn/daphne/docker logs
    logger.info(
        f"Created game with ID: {game.id}, invitee_id={invitee_id}, inviter_id={game.inviter_id}"
    )
    return JsonResponse({
        'gameId': game.id,
        'status': 'waiting',
        'invitee_id': invitee_id,
        'inviter_id': game.inviter_id,
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

# a plain HTTP GET endpoint to return the current leaderboard
@require_http_methods(["GET"])
def get_leaderboard(request):
    leaderboard = Player.get_leaderboard()
    return JsonResponse({
        'leaderboard': [
            {
                'username': player.user.username,
                'elo_rating': player.elo_rating,
                'total_wins': player.total_wins,
                'current_win_streak': player.current_win_streak
            }
            for player in leaderboard
        ]
    })
