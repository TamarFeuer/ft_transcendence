from django.urls import path
from . import views
urlpatterns = [
	path('friends/send', views.send_friend_request, name='send_friend_request'),
]