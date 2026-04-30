from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth import get_user_model
import jwt
from django.conf import settings
import logging
import random
import json
from .models import ChessSession, ChessPlayer, ChessMatch

logger = logging.getLogger(__name__)
User = get_user_model()


def get_user_from_access_cookie(request):
	#jwt from access_token cookie like tournament helpers, not django session login
	access_token = request.COOKIES.get('access_token')
	if not access_token:
		return None
	try:
		payload = jwt.decode(access_token, settings.SECRET_KEY, algorithms=['HS256'])
		if payload.get('type') != 'access':
			return None
		uid = payload.get('user_id')
		if not uid:
			return None
		return User.objects.get(pk=uid)
	except (jwt.ExpiredSignatureError, jwt.DecodeError, User.DoesNotExist):
		return None


@csrf_exempt
@require_http_methods(["POST"])
def join_chess(request):
	user = get_user_from_access_cookie(request)
	if not user:
		return JsonResponse({'error': 'Authentication required'}, status=401)

	#search and create are atomic so two players never both see an empty lobby
	#colors are pre-assigned here so WS connect order does not cause a race
	with ChessSession._lock:
		for game in ChessSession._games.values():
			if game.status == 'waiting':
				white_id = getattr(game.players['white'], 'id', None)
				black_id = getattr(game.players['black'], 'id', None)
				#if only one slot is filled
				if (white_id is None) != (black_id is None):
					#if the slot is not filled by this user
					if user.id not in (white_id, black_id):
						if game.players['white'] is None:
							game.players['white'] = user
						else:
							game.players['black'] = user

					return JsonResponse({'gameId': game.id})

		game = ChessSession()
		color = random.choice(['white', 'black'])
		game.players[color] = user
		body = json.loads(request.body or '{}')
		invitee_id = body.get('invitee_id')
		if invitee_id:
			game.invitee_id = str(invitee_id)
		ChessSession._games[game.id] = game

	logger.info(f"Player {user} created game {game.id} as {color}")
	return JsonResponse({'gameId': game.id})


@require_http_methods(["GET"])
def chess_stats(request):
	user = get_user_from_access_cookie(request)
	if not user:
		return JsonResponse({'error': 'Authentication required'}, status=401)
	try:
		player = ChessPlayer.objects.get(user=user)
	except ChessPlayer.DoesNotExist:
		return JsonResponse({'total_games': 0, 'total_wins': 0, 'total_losses': 0, 'elo_rating': 1200})
	return JsonResponse({
		'total_games': player.total_games,
		'total_wins': player.total_wins,
		'total_losses': player.total_losses,
		'elo_rating': player.elo_rating,
	})


@require_http_methods(["GET"])
def chess_leaderboard(request):
	players = ChessPlayer.get_leaderboard()
	leaderboard = [
		{
			'username': p.user.username,
			'elo_rating': p.elo_rating,
			'total_wins': p.total_wins,
			'total_games': p.total_games,
		}
		for p in players
	]
	return JsonResponse({'leaderboard': leaderboard})


@require_http_methods(["GET"])
def chess_match_history(request):
	user = get_user_from_access_cookie(request)
	if not user:
		return JsonResponse({'error': 'Authentication required'}, status=401)
	try:
		player = ChessPlayer.objects.get(user=user)
	except ChessPlayer.DoesNotExist:
		return JsonResponse({'matches': []})
	matches_qs = ChessMatch.objects.filter(
		white=player
	).union(
		ChessMatch.objects.filter(black=player)
	).order_by('-timestamp')[:20]
	matches = []
	for m in matches_qs:
		white_user = m.white.user.username if m.white and m.white.user else '?'
		black_user = m.black.user.username if m.black and m.black.user else '?'
		is_white = m.white_id == player.id
		opponent = black_user if is_white else white_user
		if m.result == '1-0':
			winner = white_user
		elif m.result == '0-1':
			winner = black_user
		else:
			winner = None
		matches.append({
			'white': white_user,
			'black': black_user,
			'opponent': opponent,
			'result': m.result,
			'winner': winner,
			'timestamp': m.timestamp.isoformat(),
		})
	return JsonResponse({'matches': matches})

