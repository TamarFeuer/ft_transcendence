from django.db import models
from django.contrib.auth.models import User


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
