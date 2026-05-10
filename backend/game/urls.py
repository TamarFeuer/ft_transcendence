from django.urls import path
from . import views

urlpatterns = [
    path('game/create', views.create_game, name='create_game'),
    path('game/join', views.join_pong, name='join_pong'),
    path('leaderboard', views.get_leaderboard, name='get_leaderboard'),
    path('match-history', views.match_history, name='match_history'),
    path('match-history/<str:username>', views.player_match_history, name='player_match_history'),
    path('player/me/stats', views.my_stats, name='my_stats'),
    path('player/<str:username>/profile', views.player_profile, name='player_profile'),
    path('player/<str:username>/achievements', views.player_achievements, name='get_player_achievements'),
]