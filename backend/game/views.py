from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from django.contrib.auth import get_user_model
import json
import jwt
from .models import GameSession, Player, Match, PlayerAchievement
from chessgame.models import ChessPlayer
from .services import get_match_history
import logging
import random

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

def get_authenticated_user(request):
    access_token = request.COOKIES.get('access_token')
    if not access_token:
        return None, JsonResponse({'error': 'Authentication required'}, status=401)
    try:
        payload = jwt.decode(access_token, settings.SECRET_KEY, algorithms=['HS256'])
        if payload.get('type') != 'access':
            return None, JsonResponse({'error': 'Invalid token type'}, status=401)
        user_id = payload.get('user_id')
        if not user_id:
            return None, JsonResponse({'error': 'Invalid token payload'}, status=401)
        User = get_user_model()
        user = User.objects.get(pk=user_id)
        return user, None
    except (jwt.ExpiredSignatureError, jwt.DecodeError, User.DoesNotExist):
        return None, JsonResponse({'error': 'Invalid or expired token'}, status=401)

@csrf_exempt
@require_http_methods(["POST"])
def join_pong(request):
    user,error = get_authenticated_user(request)
    if error:
        return error
    with GameSession._lock:
        for game in GameSession._games.values():
            if game.status == 'waiting' and not game.isTournamentGame:
                left_id = getattr(game.players['left'], 'id', None)
                right_id = getattr(game.players['right'], 'id', None)
                #if exactly one slot is filled
                if (left_id is None) != (right_id is None):
                    if (user.id not in (left_id, right_id)):
                        if game.players['left'] is None:
                            game.players['left'] = user
                        else:
                            game.players['right'] = user
                    return JsonResponse({'gameId': game.id})
    
    #if no game with empty slot exists, create a new one and allocate a random left or right position to the player
    game = GameSession.create_game()
    game.isTournamentGame = False
    side = random.choice(['left', 'right'])
    game.players[side] = user
    return JsonResponse({'gameId': game.id})    



# Cross-Site Request Forgery token is exempted because
# Auth is handled via JWT in cookies, not Django's session system
# The frontend sends JSON (Content-Type: application/json), not a form, so there's no easy place to attach a CSRF token
@csrf_exempt
@require_http_methods(["POST"])
def record_local_match(request):
    real_user, err = get_authenticated_user(request)
    if err:
        return err
    game_player = Player.objects.get(user=real_user)

    # Use a dedicated inactive system user as the local-game placeholder opponent
    User = get_user_model()
    opponent_user, _ = User.objects.get_or_create(
        username='Local opponent',
        defaults={'is_active': False}
    )
    opponent_player, _ = Player.objects.get_or_create(user=opponent_user)

    data = json.loads(request.body.decode())
    player_score = data.get('player_score')
    opponent_score = data.get('opponent_score')

    if player_score > opponent_score:
        w, l = game_player, opponent_player
        winner_score, loser_score = player_score, opponent_score
    else:
        w, l = opponent_player, game_player
        winner_score, loser_score = opponent_score, player_score

    Match.objects.create(
        player1=game_player,
        player2=opponent_player,
        player1_score=player_score,
        player2_score=opponent_score,
        winner=w,
        loser=l,
    )

    w.player_wins(win_point=winner_score, opponent_elo=l.elo_rating)
    l.player_loses(loss_point=loser_score, opponent_elo=w.elo_rating)

    newly_earned = game_player.check_new_achievements()

    return JsonResponse({
        'status': 'recorded',
        'new_achievements': [
            {'name': a.name, 'description': a.description}
            for a in newly_earned
        ]
    })

@require_http_methods(["GET"])
def match_history(request):
    user, err = get_authenticated_user(request)
    if err:
        return err
    try:
        player = Player.objects.get(user=user)
    except Player.DoesNotExist:
        return JsonResponse({'error': 'Player profile not found'}, status=404)

    matches = get_match_history(player)
    return JsonResponse({
        'matches': [
            {
                'timestamp': m.timestamp.isoformat(),
                'player1': m.player1.user.username,
                'player2': m.player2.user.username,
                'player1_score': m.player1_score,
                'player2_score': m.player2_score,
                'winner': m.winner.user.username if m.winner else None,
            }
            for m in matches
        ]
    })
    
@require_http_methods(["GET"])
def player_achievements(request, username):
    try:
        player = Player.objects.get(user__username=username)
    except Player.DoesNotExist:
        return JsonResponse({'error': 'Player not found'}, status=404)

    achievements = PlayerAchievement.objects.filter(player=player).select_related('achievement').order_by('-timestamp')
    return JsonResponse({
        'player': player.user.username,
        'achievements': [
            {
                'name': pa.achievement.name,
                'description': pa.achievement.description,
                'requirement_type': pa.achievement.requirement_type,
                'requirement_value': pa.achievement.requirement_value,
                'timestamp': pa.timestamp.isoformat()
            }
            for pa in achievements
        ]
    })
    
@require_http_methods(["GET"])
def all_achievements(request):
    achievements = PlayerAchievement.objects.select_related('player__user', 'achievement').order_by('-timestamp')[:10]
    return JsonResponse({
        'achievements': [
            {
                'player_name': pa.player.user.username,
                'achievement_name': pa.achievement.name,
                'requirement_type': pa.achievement.requirement_type,
                'requirement_value': pa.achievement.requirement_value,
                'timestamp': pa.timestamp.isoformat()
            }
            for pa in achievements
        ]
    })

@require_http_methods(["GET"])
def my_stats(request):
    user, err = get_authenticated_user(request)
    if err:
        return err
    try:
        player = Player.objects.get(user=user)
    except Player.DoesNotExist:
        return JsonResponse({'error': 'Player profile not found'}, status=404)
    return JsonResponse({
        'username': user.username,
        'total_wins': player.total_wins,
        'total_losses': player.total_losses,
        'total_games': player.total_games,
        'elo_rating': player.elo_rating,
        'current_win_streak': player.current_win_streak,
    })

@require_http_methods(["GET"])
def player_profile(request, username):
    User = get_user_model()
    try:
        user = User.objects.get(username=username)
    except User.DoesNotExist:
        return JsonResponse({'error': 'User not found'}, status=404)

    try:
        pong = Player.objects.get(user=user)
        pong_data = {
            'wins': pong.total_wins,
            'losses': pong.total_losses,
            'elo': pong.elo_rating,
            'total_games': pong.total_games,
        }
    except Player.DoesNotExist:
        pong_data = {'wins': 0, 'losses': 0, 'elo': 0, 'total_games': 0}

    try:
        chess = ChessPlayer.objects.get(user=user)
        chess_data = {
            'wins': chess.total_wins,
            'losses': chess.total_losses,
            'elo': chess.elo_rating,
            'total_games': chess.total_games,
        }
    except ChessPlayer.DoesNotExist:
        chess_data = {'wins': 0, 'losses': 0, 'elo': 0, 'total_games': 0}

    return JsonResponse({
        'username': user.username,
        'pong': pong_data,
        'chess': chess_data,
    })
