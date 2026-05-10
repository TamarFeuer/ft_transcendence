from django.urls import path
from . import views

urlpatterns = [
	path('join/', views.join_chess, name='chess_join'),
	path('stats/', views.chess_stats, name='chess_stats'),
	path('leaderboard/', views.chess_leaderboard, name='chess_leaderboard'),
	path('match-history/', views.chess_match_history, name='chess_match_history'),
]