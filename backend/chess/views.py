from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
import logging
from .models import ChessSession

logger = logging.getLogger(__name__)

@csrf_exempt
@require_http_methods(["POST"])
def join_chess(request):
	# search for a game that needs a second player
	for game in ChessSession._games.values():
		if game.status == 'waiting' and game.players['black'] is None:
			if game.players['white'] != request.user:
				logger.info(f"Player {request.user} is joining a game {game.id}")
				return JsonResponse({'gameId': game.id})
	# If we don't find a pending game, we create a new one
	game = ChessSession.create_game()
	logger.info(f"Player {request.user} created a new game {game.id}")
	return JsonResponse({'gameId': game.id})

