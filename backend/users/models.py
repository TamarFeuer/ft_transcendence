from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db.models import Q

User = get_user_model()


class Friendship(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
        ('blocked', 'Blocked'),
    ]
    
    # The user who initiated the friend request
    requester = models.ForeignKey(User, on_delete=models.CASCADE, related_name='friend_requests_sent')
    # The user who receives the friend request
    receiver = models.ForeignKey(User, on_delete=models.CASCADE, related_name='friend_requests_received')
    
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['requester', 'receiver']
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['requester', 'status']),
            models.Index(fields=['receiver', 'status']),
        ]
    
    def __str__(self):
        return f"{self.requester.username} -> {self.receiver.username} ({self.status})"
    
    @classmethod
    def are_friends(cls, user1, user2):
        """Check if two users are friends."""
        return cls.objects.filter(
            Q(requester=user1, receiver=user2, status='accepted') |
            Q(requester=user2, receiver=user1, status='accepted')
        ).exists()
    
    @classmethod
    def get_friends(cls, user):
        """Get all accepted friends of a user."""
        return User.objects.filter(
            Q(friend_requests_received__requester=user, friend_requests_received__status='accepted') |
            Q(friend_requests_sent__receiver=user, friend_requests_sent__status='accepted')
        ).distinct()
    
    @classmethod
    def get_pending_requests(cls, user):
        """Get all pending friend requests for a user (received)."""
        return cls.objects.filter(receiver=user, status='pending')
    
    @classmethod
    def get_sent_requests(cls, user):
        """Get all pending friend requests sent by a user."""
        return cls.objects.filter(requester=user, status='pending')


class BlockedUser(models.Model):
    """Model to track blocked users."""
    blocker = models.ForeignKey(User, on_delete=models.CASCADE, related_name='blocking')
    blocked_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='blocked_by')
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['blocker', 'blocked_user']
        indexes = [
            models.Index(fields=['blocker']),
        ]
    
    def __str__(self):
        return f"{self.blocker.username} blocked {self.blocked_user.username}"
    
    @classmethod
    def is_blocked(cls, user1, user2):
        """Check if user1 has blocked user2 or vice versa."""
        return cls.objects.filter(
            Q(blocker=user1, blocked_user=user2) |
            Q(blocker=user2, blocked_user=user1)
        ).exists()
