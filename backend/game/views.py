from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
import json
from .models import GameSession, Player
import logging

logger = logging.getLogger(__name__)

@csrf_exempt
@require_http_methods(["POST"])
def create_game(request):
    game = GameSession.create_game()
    game.isTournamentGame = False

    # Use logging so output is captured by gunicorn/daphne/docker logs
    logger.info(f"Created game with ID: {game.id}")
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
