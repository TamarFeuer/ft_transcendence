from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()


class Tournament(models.Model):
    STATUS_CHOICES = [
        ('registration', 'Registration Open'),
        ('upcoming', 'Upcoming'),
        ('ongoing', 'Ongoing'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]
    
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    creator = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_tournaments')
    max_players = models.IntegerField(default=8)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='registration')
    created_at = models.DateTimeField(auto_now_add=True)
    start_time = models.DateTimeField(null=True, blank=True)
    end_time = models.DateTimeField(null=True, blank=True)
    
    def __str__(self):
        return f"{self.name} ({self.status})"
    
    class Meta:
        ordering = ['-created_at']


class TournamentParticipant(models.Model):
    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name='participants')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='tournament_participations')
    joined_at = models.DateTimeField(auto_now_add=True)
    score = models.IntegerField(default=0)
    rank = models.IntegerField(null=True, blank=True)
    
    class Meta:
        unique_together = ['tournament', 'user']
        ordering = ['-score', 'joined_at']
    
    def __str__(self):
        return f"{self.user.username} in {self.tournament.name}"


class TournamentGame(models.Model):
    GAME_STATUS = [
        ('pending', 'Pending'),
        ('ready', 'Ready'),
        ('0/2 players ready', '0/2 Players Ready'),
        ('1/2 players ready', '1/2 Players Ready'),
        ('ongoing', 'Ongoing'),
         ('completed', 'Completed'),
    ]
    
    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name='games')
    round = models.IntegerField(default=1)
    player1 = models.ForeignKey(User, on_delete=models.CASCADE, related_name='tournament_games_as_player1')
    player2 = models.ForeignKey(User, on_delete=models.CASCADE, related_name='tournament_games_as_player2')
    winner = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='tournament_wins')
    status = models.CharField(max_length=20, choices=GAME_STATUS, default='pending')
    game_id = models.CharField(max_length=100, null=True, blank=True)  # Reference to GameSession
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    def __str__(self):
        return f"Round {self.round}: {self.player1.username} vs {self.player2.username}"
    
    class Meta:
        ordering = ['round', 'id']
