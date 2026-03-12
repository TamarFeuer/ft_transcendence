from django.urls import path, include

urlpatterns = [
    path('api/', include('game.urls')),
    path('api/', include('friends.urls')),
]