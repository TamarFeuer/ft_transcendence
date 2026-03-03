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
