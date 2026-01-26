from django.urls import path, include

urlpatterns = [
    path('api/', include('game.urls')),
    path('api/tournament/', include('tournament.urls')),
    path('api/users/', include('users.urls')),
]