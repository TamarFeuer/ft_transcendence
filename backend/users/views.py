from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.models import User
from django.conf import settings
import json
import jwt
import logging
from .models import FriendRequest

logger = logging.getLogger(__name__)

@csrf_exempt
@require_http_methods(["POST"])
def send_friend_request(request):
	try:
		access_token = request.COOKIES.get('access_token')
		if not access_token:
			return JsonResponse({'error': 'User is not logged in'}, status=401)
		payload = jwt.decode(access_token, settings.SECRET_KEY, algorithms=['HS256'])
		#get sender's data that performs the friend request
		user_id = payload.get('user_id')
		from_user = User.objects.get(id=user_id)
		data = json.loads(request.body.decode())
		to_username = data.get('to_username')
		to_user = User.objects.get(username=to_username)
		if from_user == to_user:
			return JsonResponse({'error': 'Cannot make a friend request to yourself'}, status=400)
		existing = FriendRequest.objects.filter(from_user=from_user, to_user=to_user).exists()
		if existing:
			return JsonResponse({'error': 'Friend request pending'}, status=400)
		friend_request = FriendRequest.objects.create(from_user=from_user, to_user=to_user)
		return JsonResponse({
			'success': True,
			'message': f'Friend request sent to {to_username}'
		})
	except jwt.ExpiredSignatureError:
		return JsonResponse({'error': 'token expired'}, status=401)
	except jwt.DecodeError:
		return JsonResponse({'error': 'invalid token'}, status=401)
	except User.DoesNotExist:
		return JsonResponse({'error': 'user does not exist'}, status=404)
	except Exception as e:
		logger.exception('Error sending a friend request')
		return JsonResponse({'error': 'internal error'}, status=500)

