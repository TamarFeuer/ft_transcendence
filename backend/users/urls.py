from django.urls import path
from . import views

urlpatterns = [
    # Friend requests
    path('friend-requests/', views.FriendRequestListCreateView.as_view(), name='friend-requests-list-create'),
    path('friend-requests/<int:request_id>/accept/', views.FriendRequestAcceptView.as_view(), name='accept-friend-request'),
    path('sent-requests/', views.SentRequestsListView.as_view(), name='sent-requests'),
    # send friend request
    # friend-request/send
    # friend-request/cancel/<int:request_id>/
    # friend-request/reject/<int:request_id>/

    # Friends
    path('friends/', views.FriendsListView.as_view(), name='friends-list'),
    #remove friend

    # Blocked users
    path('block/', views.BlockUserView.as_view(), name='block-user'),
    #list blocked users
    #unblock user; unblock/<int:block_id>/
]
