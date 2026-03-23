from django.urls import path
from . import views

urlpatterns = [
    path('health', views.health, name='health'),
    path('auth/register', views.register, name='register'),
    path('auth/login', views.login_view, name='login'),
    path('auth/refresh', views.refresh_token_view, name='refresh_token'),
    path('auth/logout', views.logout_view, name='logout'),
    path('auth/me', views.current_user_view, name='current_user'),
]