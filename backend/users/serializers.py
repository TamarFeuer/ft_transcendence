from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Friendship, BlockedUser

User = get_user_model()


class UserBasicSerializer(serializers.ModelSerializer):
    """Serializer for basic user information."""
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email']
        read_only_fields = ['id']


class FriendshipSerializer(serializers.ModelSerializer):
    """Serializer for friendship requests."""
    requester_username = serializers.CharField(source='requester.username', read_only=True)
    receiver_username = serializers.CharField(source='receiver.username', read_only=True)
    requester_detail = UserBasicSerializer(source='requester', read_only=True)
    receiver_detail = UserBasicSerializer(source='receiver', read_only=True)
    
    class Meta:
        model = Friendship
        fields = ['id', 'requester', 'requester_username', 'requester_detail',
                  'receiver', 'receiver_username', 'receiver_detail',
                  'status', 'created_at', 'updated_at']
        read_only_fields = ['requester', 'receiver', 'created_at', 'updated_at']


class FriendshipCreateSerializer(serializers.Serializer):
    """Serializer for creating friendship requests."""
    friend_id = serializers.IntegerField()
    
    def validate_friend_id(self, value):
        try:
            User.objects.get(pk=value)
        except User.DoesNotExist:
            raise serializers.ValidationError("User does not exist.")
        return value


class FriendsListSerializer(serializers.ModelSerializer):
    """Serializer for listing friends."""
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email']


class BlockedUserSerializer(serializers.ModelSerializer):
    """Serializer for blocked users."""
    blocker_username = serializers.CharField(source='blocker.username', read_only=True)
    blocked_user_username = serializers.CharField(source='blocked_user.username', read_only=True)
    
    class Meta:
        model = BlockedUser
        fields = ['id', 'blocker', 'blocker_username', 'blocked_user', 
                  'blocked_user_username', 'created_at']
        read_only_fields = ['blocker', 'blocked_user', 'created_at']
