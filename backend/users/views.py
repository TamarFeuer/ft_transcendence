from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.db.models import Q
import jwt
from django.conf import settings

from .models import Friendship, BlockedUser
from .serializers import (
    FriendshipSerializer, FriendshipCreateSerializer, 
    FriendsListSerializer, BlockedUserSerializer
)

User = get_user_model()


def get_user_from_cookie(request):
    """Extract user from access token cookie."""
    access_token = request.COOKIES.get('access_token')
    if not access_token:
        return None
    
    try:
        payload = jwt.decode(access_token, settings.SECRET_KEY, algorithms=['HS256'])
        if payload.get('type') != 'access':
            return None
        user_id = payload.get('user_id')
        return User.objects.get(pk=user_id)
    except (jwt.ExpiredSignatureError, jwt.DecodeError, User.DoesNotExist):
        return None


class FriendRequestListCreateView(APIView):
    """
    GET: List pending friend requests for the current user (received)
    POST: Send a friend request to another user
    """
    
    def get(self, request):
        user = get_user_from_cookie(request)
        if not user:
            return Response({'error': 'authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        # Get pending requests received by the current user
        pending_requests = Friendship.get_pending_requests(user)
        serializer = FriendshipSerializer(pending_requests, many=True)
        return Response(serializer.data)
    
    def post(self, request):
        user = get_user_from_cookie(request)
        if not user:
            return Response({'error': 'authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        serializer = FriendshipCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        friend_id = serializer.validated_data['friend_id']
        friend = get_object_or_404(User, pk=friend_id)
        
        # Check if user is trying to friend themselves
        if user == friend:
            return Response(
                {'error': 'You cannot send a friend request to yourself'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if already friends or request exists
        existing = Friendship.objects.filter(
            Q(requester=user, receiver=friend) | Q(requester=friend, receiver=user)
        ).first()
        
        if existing:
            if existing.status == 'accepted':
                return Response(
                    {'error': 'You are already friends with this user'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            elif existing.status == 'pending':
                return Response(
                    {'error': 'Friend request already sent'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Create the friendship request
        friendship = Friendship.objects.create(requester=user, receiver=friend)
        serializer = FriendshipSerializer(friendship)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class FriendRequestAcceptView(APIView):
    """Accept a pending friend request."""
    
    def post(self, request, request_id):
        user = get_user_from_cookie(request)
        if not user:
            return Response({'error': 'authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        friendship = get_object_or_404(Friendship, pk=request_id, receiver=user, status='pending')
        friendship.status = 'accepted'
        friendship.save()
        
        serializer = FriendshipSerializer(friendship)
        return Response(serializer.data)


class FriendRequestRejectView(APIView):
    """Reject a pending friend request."""
    
    def post(self, request, request_id):
        user = get_user_from_cookie(request)
        if not user:
            return Response({'error': 'authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        friendship = get_object_or_404(Friendship, pk=request_id, receiver=user, status='pending')
        friendship.status = 'rejected'
        friendship.save()
        
        serializer = FriendshipSerializer(friendship)
        return Response(serializer.data)


class FriendRequestCancelView(APIView):
    """Cancel a sent friend request."""
    
    def post(self, request, request_id):
        user = get_user_from_cookie(request)
        if not user:
            return Response({'error': 'authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        friendship = get_object_or_404(Friendship, pk=request_id, requester=user, status='pending')
        friendship.delete()
        
        return Response({'message': 'Friend request cancelled'}, status=status.HTTP_204_NO_CONTENT)


class FriendsListView(APIView):
    """Get list of all friends for the current user."""
    
    def get(self, request):
        user = get_user_from_cookie(request)
        if not user:
            return Response({'error': 'authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        friends = Friendship.get_friends(user)
        serializer = FriendsListSerializer(friends, many=True)
        return Response(serializer.data)


class RemoveFriendView(APIView):
    """Remove a friend."""
    
    def post(self, request, friend_id):
        user = get_user_from_cookie(request)
        if not user:
            return Response({'error': 'authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        friend = get_object_or_404(User, pk=friend_id)
        
        # Find and delete the friendship
        friendship = Friendship.objects.filter(
            Q(requester=user, receiver=friend) | Q(requester=friend, receiver=user),
            status='accepted'
        ).first()
        
        if not friendship:
            return Response(
                {'error': 'You are not friends with this user'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        friendship.delete()
        return Response({'message': 'Friend removed'}, status=status.HTTP_204_NO_CONTENT)


class SentRequestsListView(APIView):
    """Get list of pending friend requests sent by the current user."""
    
    def get(self, request):
        user = get_user_from_cookie(request)
        if not user:
            return Response({'error': 'authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        sent_requests = Friendship.get_sent_requests(user)
        serializer = FriendshipSerializer(sent_requests, many=True)
        return Response(serializer.data)


class BlockUserView(APIView):
    """Block a user."""
    
    def post(self, request):
        user = get_user_from_cookie(request)
        if not user:
            return Response({'error': 'authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        serializer = FriendshipCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        blocked_id = serializer.validated_data['friend_id']
        blocked_user = get_object_or_404(User, pk=blocked_id)
        
        if user == blocked_user:
            return Response(
                {'error': 'You cannot block yourself'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create or get the block
        block, created = BlockedUser.objects.get_or_create(
            blocker=user, 
            blocked_user=blocked_user
        )
        
        if not created:
            return Response(
                {'error': 'User is already blocked'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Remove friendship if exists
        Friendship.objects.filter(
            Q(requester=user, receiver=blocked_user) | Q(requester=blocked_user, receiver=user)
        ).delete()
        
        serializer = BlockedUserSerializer(block)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class UnblockUserView(APIView):
    """Unblock a user."""
    
    def post(self, request, blocked_id):
        user = get_user_from_cookie(request)
        if not user:
            return Response({'error': 'authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        block = get_object_or_404(BlockedUser, blocker=user, blocked_user_id=blocked_id)
        block.delete()
        
        return Response({'message': 'User unblocked'}, status=status.HTTP_204_NO_CONTENT)


class BlockedUsersListView(APIView):
    """Get list of users blocked by the current user."""
    
    def get(self, request):
        user = get_user_from_cookie(request)
        if not user:
            return Response({'error': 'authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        blocked_users = BlockedUser.objects.filter(blocker=user)
        serializer = BlockedUserSerializer(blocked_users, many=True)
        return Response(serializer.data)
