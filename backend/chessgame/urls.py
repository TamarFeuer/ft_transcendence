from django.urls import path
from . import views

urlpatterns = [
	path('chess/join/', views.join_chess, name='chess_join'),
]