
from json.encoder import JSONEncoder
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.models import User
from django.conf import settings
from django.db.models import Q
import json
import jwt
import logging
from .models import FriendRequest

logger = logging.getLogger(__name__)

def get_authenticated_user(request):
	try:
		access_token = request.COOKIES.get('access_token')
		if not access_token:
			return (None, JsonResponse({'error': 'User is not found'}, status = 401))
		payload = jwt.decode(access_token, settings.SECRET_KEY, algorithms=['HS256'])
		user_id = payload.get('user_id')
		user = User.objects.get(id=user_id)
	except jwt.ExpiredSignatureError:
		return (None, JsonResponse({'error': 'token expired'}, status=401))
	except jwt.DecodeError:
		return (None, JsonResponse({'error': 'invalid token'}, status=401))
	except User.DoesNotExist:
		return (None, JsonResponse({'error': 'user does not exist'}, status=404))
	return (user, None)

@csrf_exempt
@require_http_methods(["POST"])
def send_friend_request(request):
	try:
		from_user, error = get_authenticated_user(request)
		if error:
			return error
		data = json.loads(request.body.decode())
		to_username = data.get('to_username')
		to_user = User.objects.get(username=to_username)
		if from_user == to_user:
			return JsonResponse({'error': 'Cannot make a friend request to yourself'}, status=400)
		existing = FriendRequest.objects.filter(from_user=from_user, to_user=to_user).exclude(status='declined').exists()
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

@csrf_exempt
@require_http_methods(["GET"])
def get_pending_requests(request):
	try:
		user, error = get_authenticated_user(request)
		if error:
			return error
		pending_requests = FriendRequest.objects.filter(to_user=user, status='pending')
		print(pending_requests)

		return JsonResponse({'requests': list(pending_requests.values('id', 'from_user__username', 'status'))})

	except Exception as e:
			logger.exception('Error sending a friend request')
			return JsonResponse({'error': 'internal error'}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def accept_request(request):
	try:
		user, error = get_authenticated_user(request)
		if error:
			return error
		data = json.loads(request.body.decode())
		request_id = data.get('request_id')
		if not request_id:
			return JsonResponse({'error': 'request_id is required'}, status=400)
		friend_request = FriendRequest.objects.get(id=request_id)
		if friend_request.to_user != user:
			return JsonResponse({'error': 'Not your friend request'}, status=403)
		if friend_request.status != 'pending':
			return JsonResponse({'error': 'Friend request is already processed'}, status=400)
		friend_request.status = 'accepted'
		friend_request.save()
		return JsonResponse({'success': True}, status=200)
	except FriendRequest.DoesNotExist:
			return JsonResponse({'error': 'Friend Request does not exist'}, status=404)
	except Exception as e:
		return JsonResponse({'error': "Error accepting friend request"}, status=500)


	

@csrf_exempt
@require_http_methods(["POST"])
def delete_request(request):
	try:
		user, error = get_authenticated_user(request)
		if error:
			return error
		data = json.loads(request.body.decode())
		request_id = data.get('request_id')
		if not request_id:
			return JsonResponse({'error': 'request does not exist'})
		friend_request = FriendRequest.objects.get(id=request_id)
		if friend_request.to_user != user:
				return JsonResponse({'error': 'Not your friend request'}, status=403)
		if friend_request.status != 'pending':
			return JsonResponse({'error': 'Friend request is already processed'}, status=400)
		friend_request.status = 'declined'
		friend_request.save()
		return JsonResponse({'success': True}, status=200)
	except FriendRequest.DoesNotExist:
			return JsonResponse({'error': 'Friend Request does not exist'}, status=404)
	except Exception as e:
		return JsonResponse({'error': "Error declining friend request"}, status=500)

@csrf_exempt
@require_http_methods(["GET"])
def get_friends(request):
	try:
			
		user, error = get_authenticated_user(request)
		if error:
			return error
		accepted = FriendRequest.objects.filter(status='accepted').filter(Q(from_user=user) | Q(to_user=user))
		friends = []
		for fr in accepted:
			if fr.from_user == user:
				other = fr.to_user
			else:
				other = fr.from_user
			friends.append({
				'id': other.id,
				'username': other.username,
			})
		return JsonResponse({'friends': friends}, status = 200)
	except Exception as e:
		logger.exception('Error getting friends list')
		return JsonResponse({'error': 'internal error'}, status=500)