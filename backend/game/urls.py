from django.urls import path
from . import views

urlpatterns = [
    path('health', views.health, name='health'),
    path('game/create', views.create_game, name='create_game'),
    path('game/<str:game_id>', views.get_game, name='get_game'),
    path('games', views.list_games, name='list_games'),
]