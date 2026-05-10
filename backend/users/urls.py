from django.urls import path
from . import views

urlpatterns = [
    path('register', views.register, name='register'),
    path('login', views.login_view, name='login'),
    path('refresh', views.refresh_token_view, name='refresh_token'),
    path('logout', views.logout_view, name='logout'),
    path('me', views.current_user_view, name='current_user'),
]