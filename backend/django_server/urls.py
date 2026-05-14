from django.urls import path, include

urlpatterns = [
    path('api/auth/', include('users.urls')),
    path('api/tournament/', include('tournament.urls')),
    path('api/friends/', include('friends.urls')),
    path('api/block/', include('block.urls')),
    path('api/chess/', include('chessgame.urls')),
    path('api/', include('game.urls')),

]