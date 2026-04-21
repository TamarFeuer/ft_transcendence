from django.urls import path
from . import views

urlpatterns = [
    path('game/create', views.create_game, name='create_game'),
    path('game/record-local-match/', views.record_local_match, name='record_local_match'),
    path('game/join', views.join_pong, name='join_pong'),
    path('game/<str:game_id>', views.get_game, name='get_game'),
    path('games', views.list_games, name='list_games'),
    path('leaderboard', views.get_leaderboard, name='get_leaderboard'),
    path('match-history', views.match_history, name='match_history'),
    path('player/me/stats', views.my_stats, name='my_stats'),
    path('player/<str:username>/achievements', views.player_achievements, name='get_player_achievements'),
    path('achievements', views.all_achievements, name='get_all_achievements'),
]