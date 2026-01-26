from django.urls import path
from . import views

urlpatterns = [
    # Friend requests
    path('friend-requests/', views.FriendRequestListCreateView.as_view(), name='friend-requests-list-create'),
    path('friend-requests/<int:request_id>/accept/', views.FriendRequestAcceptView.as_view(), name='accept-friend-request'),
    path('friend-requests/<int:request_id>/reject/', views.FriendRequestRejectView.as_view(), name='reject-friend-request'),
    path('friend-requests/<int:request_id>/cancel/', views.FriendRequestCancelView.as_view(), name='cancel-friend-request'),
    path('sent-requests/', views.SentRequestsListView.as_view(), name='sent-requests'),
    
    # Friends
    path('friends/', views.FriendsListView.as_view(), name='friends-list'),
    path('friends/<int:friend_id>/remove/', views.RemoveFriendView.as_view(), name='remove-friend'),
    
    # Blocked users
    path('blocked/', views.BlockedUsersListView.as_view(), name='blocked-users-list'),
    path('block/', views.BlockUserView.as_view(), name='block-user'),
    path('unblock/<int:blocked_id>/', views.UnblockUserView.as_view(), name='unblock-user'),
]
