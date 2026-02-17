from django.urls import path
from . import views
urlpatterns = [
	path('friends/send', views.send_friend_request, name='send_friend_request'),
	path('friends/pending', views.get_pending_requests, name='get_pending_requests'),
	path('friends/accept', views.accept_request, name='accept_request'),
	path('friends/delete', views.delete_request, name='delete_request'),
]