from django.urls import path
from . import views

urlpatterns = [
    path('create/', views.TournamentCreateView.as_view(), name='create_tournament'),
    path('join/', views.TournamentJoinView.as_view(), name='join_tournament'),
    path('start/', views.TournamentStartView.as_view(), name='start_tournament'),
    path('cancel/', views.TournamentCancelView.as_view(), name='cancel_tournament'),
    path('show/registration/', views.RegistrationTournamentListView.as_view(), name='registraion_tournament'),
    path('show/upcoming/', views.UpcomingTournamentListView.as_view(), name='user_upcoming_tournament'),
    path('show/ongoing/', views.OngoingTournamentListView.as_view(), name='user_ongoing_tournament'),
    path('show/completed/', views.CompletedTournamentListView.as_view(), name='user_completed_tournament'),
    path('show/games/', views.TournamentGamesListView.as_view(), name='games_in_tournament'),
    path('show/ready/games/', views.TournamentUserReadyGamesListView.as_view(), name='ready_games_in_tournament'),
    path('game/start/', views.StartTournamentGameView.as_view(), name='start_tournament_game'),
    path('game/result/', views.UpdateTournamentGameResultView.as_view(), name='update_tournament_game_result'),
    path('leaderboard/', views.TournamentLeaderboardView.as_view(), name='tournament_leaderboard'),
]
