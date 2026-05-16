from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth import get_user_model
from django.conf import settings
from django.db.models import Q
import json
import jwt
import logging
from .models import Block
from friends.models import FriendRequest

logger = logging.getLogger(__name__)


User = get_user_model()


def get_authenticated_user(request):
    try:
        access_token = request.COOKIES.get('access_token')
        if not access_token:
            return (None, JsonResponse({'error': 'User is not found'}, status=401))
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
def block_user(request):
    try:
        user, error = get_authenticated_user(request)
        if error:
            return error
        data = json.loads(request.body.decode())
        target_id = data.get('user_id')
        if not target_id:
            return JsonResponse({'error': 'user_id is required'}, status=400)
        if str(user.id) == str(target_id):
            return JsonResponse({'error': 'Cannot block yourself'}, status=400)
        target = User.objects.get(id=target_id)
        Block.objects.get_or_create(blocker=user, blocked_user=target)
        FriendRequest.objects.filter(
            Q(from_user=user, to_user=target) | Q(from_user=target, to_user=user),
            status='accepted'
        ).delete()
        return JsonResponse({'success': True, 'message': f'You have blocked {target.username}'})
    except User.DoesNotExist:
        return JsonResponse({'error': 'User does not exist'}, status=404)
    except Exception as e:
        logger.exception('Error blocking user')
        return JsonResponse({'error': 'internal error'}, status=500)


@csrf_exempt
@require_http_methods(["DELETE"])
def unblock_user(request):
    try:
        user, error = get_authenticated_user(request)
        if error:
            return error
        data = json.loads(request.body.decode())
        target_id = data.get('user_id')
        if not target_id:
            return JsonResponse({'error': 'user_id is required'}, status=400)
        Block.objects.filter(blocker=user, blocked_user_id=target_id).delete()
        return JsonResponse({'success': True})
    except Exception as e:
        logger.exception('Error unblocking user')
        return JsonResponse({'error': 'internal error'}, status=500)
