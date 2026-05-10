from django.urls import path
from . import views
urlpatterns = [
	path('send', views.send_friend_request, name='send_friend_request'),
	path('pending', views.get_pending_requests, name='get_pending_requests'),
	path('accept', views.accept_request, name='accept_request'),
	path('delete', views.delete_request, name='delete_request'),
	path('list', views.get_friends, name='get_friends_list'),
	path('remove', views.remove_friend, name='remove_friend'),
	path('block', views.block_user, name='block_user'),
	path('unblock', views.unblock_user, name='unblock_user'),
]