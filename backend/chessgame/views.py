from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth import get_user_model
import jwt
from django.conf import settings
import logging
import json
from .models import ChessSession

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
			if game.status == 'waiting' and game.players['black'] is None:
				white_id = getattr(game.players['white'], 'id', None)
				if white_id != user.id:
					game.players['black'] = user
					logger.info(f"Player {user} joining game {game.id} as black")
					return JsonResponse({'gameId': game.id})

		game = ChessSession()
		game.players['white'] = user
		body = json.loads(request.body or '{}')
		invitee_id = body.get('invitee_id')
		if invitee_id:
			game.invitee_id = str(invitee_id)
		ChessSession._games[game.id] = game

	logger.info(f"Player {user} created game {game.id} as white")
	return JsonResponse({'gameId': game.id})
