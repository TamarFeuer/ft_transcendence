from django.urls import path
from . import views

urlpatterns = [
	path('chess/join/', views.join_chess, name='chess_join'),
	path('chess/stats/', views.chess_stats, name='chess_stats'),
	path('chess/leaderboard/', views.chess_leaderboard, name='chess_leaderboard'),
	path('chess/match-history/', views.chess_match_history, name='chess_match_history'),
]