from django.urls import path
from . import views

urlpatterns = [
    path('health', views.health, name='health'),
    path('game/create', views.create_game, name='create_game'),
    path('game/<str:game_id>', views.get_game, name='get_game'),
    path('games', views.list_games, name='list_games'),
    path('auth/register', views.register, name='register'),
    path('auth/login', views.login_view, name='login'),
    path('auth/logout', views.logout_view, name='logout'),
]