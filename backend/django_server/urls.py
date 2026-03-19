from django.urls import path, include

urlpatterns = [
    path('api/', include('game.urls')),
    path('api/', include('users.urls')),
    path('api/tournament/', include('tournament.urls')),
    path('api/', include('friends.urls')),
]