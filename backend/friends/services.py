from django.db.models import Q
from .models import FriendRequest
	
def remove_friend_from_db(sender, recipient):
	##get accepted friend requests from each side, since we don't know who made the initial one
	accepted_friend_request = FriendRequest.objects.filter(status='accepted').filter(Q(from_user=sender, to_user=recipient) | Q(from_user=recipient, to_user=sender))
	
	##remove that friend request
	accepted_friend_request.delete()