from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth import get_user_model
import jwt
from django.conf import settings
import logging
from .models import ChessSession

logger = logging.getLogger(__name__)
User = get_user_model()


def get_user_from_access_cookie(request):
	"""Same auth as tournament / current_user: JWT in access_token cookie (no Django session)."""
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

	# search for a game that needs a second player
	for game in ChessSession._games.values():
		if game.status == 'waiting' and game.players['black'] is None:
			white = game.players['white']
			white_id = getattr(white, 'id', None)
			if white_id != user.id:
				logger.info(f"Player {user} is joining game {game.id}")
				return JsonResponse({'gameId': game.id})

	game = ChessSession.create_game()
	logger.info(f"Player {user} created game {game.id}")
	return JsonResponse({'gameId': game.id})
