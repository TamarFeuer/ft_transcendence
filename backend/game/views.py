from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
import json
from .models import GameSession, Player
import logging
from users.token_auth import get_user_from_token
import jwt
from django.conf import settings

logger = logging.getLogger(__name__)

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

    creator_id = request.user.id
    token = request.COOKIES.get('access_token')
    user = await get_user_from_token(token)

    if user.id == None:
        return JsonResponse({
        'gameId': None,
        'status': None,
        'invitee_id': None,
        'creator_id': None,
        'message': 'error with token'
        })
    game = GameSession.create_game(creator_id=user.id)
    game.isTournamentGame = False

    if invitee_id is not None:
        # Attach invitee_id for testing; preserve type if conversion fails
        try:
            game.invitee_id = int(invitee_id)
        except Exception:
            game.invitee_id = invitee_id

    # Use logging so output is captured by gunicorn/daphne/docker logs
    logger.info(f"Created game with ID: {game.id}, invitee_id={invitee_id}, creator_id={game.creator_id}")
    return JsonResponse({
        'gameId': game.id,
        'status': 'waiting',
        'invitee_id': invitee_id,
        'creator_id': game.creator_id,
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
