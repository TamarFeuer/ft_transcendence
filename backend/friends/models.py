from django.db import models
from django.contrib.auth.models import User

class FriendRequest(models.Model):
	"""Stores friend requests between users"""
	from_user = models.ForeignKey(User,
	related_name='sent_friend_requests',
	on_delete=models.CASCADE
	)
	to_user = models.ForeignKey(User,
	related_name='received_friend_requests',
	on_delete = models.CASCADE
	)
	status = models.CharField(
		max_length = 10,
		choices=[
			('pending', 'Pending'), ('accepted', 'Accepted'), ('declined', 'Declined')
		],
		default='pending'
	)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)
	class Meta:
		ordering = ['-created_at']
	def __str__(self):
		return f"{self.from_user.username} -> {self.to_user.username} ({self.status})"


class Block(models.Model):
	# blocker has blocked blocked_user.
	# The relationship is one-directional: A blocking B does not mean B blocked A.
	blocker = models.ForeignKey(User, on_delete=models.CASCADE, related_name='blocking')
	blocked_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='blocked_by')
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		unique_together = [('blocker', 'blocked_user')]

	def __str__(self):
		return f"{self.blocker.username} blocked {self.blocked_user.username}"


def is_blocked(user1_id, user2_id):
	# Returns True if either user has blocked the other.
	return Block.objects.filter(
		blocker_id=user1_id, blocked_user_id=user2_id
	).exists() or Block.objects.filter(
		blocker_id=user2_id, blocked_user_id=user1_id
	).exists()
