import uuid
import time
from datetime import datetime
from threading import Lock
from django.db import models
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

class GameSession:
    """In-memory game session management"""
    
    _games = {}
    _lock = Lock()
    
    JOIN_TIMEOUT = 10  # Maximum time in seconds to wait for both players to join
    
    def __init__(self, game_id=None):
        self.id = game_id or str(uuid.uuid4())
        self.state = {
            'ball': {'x': 0, 'y': 0, 'vx': 3, 'vy': 1},
            'paddles': {'left': 0, 'right': 0},
            'score': {'p1': 0, 'p2': 0},
            'winningScore': 5
        }
        self.all_players_in_tournament = None
        self.tournament_id = None
        self.isTournamentGame = False
        self.players = {'left': None, 'right': None}
        self.players_ids = {'left': None, 'right': None}
        self.clients = set()
        self.status = 'waiting'  # waiting, active, finished
        self.last_tick = time.time()
        self.created_at = time.time()  # Track when game was created
        self.timeout_handled = False  # Flag to prevent timeout from being handled twice
        
    def get_players(self):
        """Return current players"""
        return {
            'left':  self.players['left'],
            'right': self.players['right']
        }
    @classmethod
    def create_game(cls):
        """Create a new game session"""
        game = cls()
        with cls._lock:
            cls._games[game.id] = game
        return game
    
    @classmethod
    def get_game(cls, game_id):
        """Retrieve a game session by ID"""
        return cls._games.get(game_id)
    
    @classmethod
    def list_games(cls):
        """List all active games"""
        with cls._lock:
            return list(cls._games.values())
    
    @classmethod
    def delete_game(cls, game_id):
        """Remove a game from the registry"""
        with cls._lock:
            if game_id in cls._games:
                del cls._games[game_id]
    
    def add_player(self, name, id, role=None):
        """Add a player or spectator to the game"""
        if not self.players['left']:
            self.players['left'] = name
            self.players_ids['left'] = id
            self.clients.add(name)
            return 'left'
        elif not self.players['right']:
            self.players['right'] = name
            self.players_ids['right'] = id
            self.clients.add(name)
            return 'right'
        else:
            self.clients.add(name)
            return 'spectator'
    
    def remove_player(self, name):
        """Remove a player from the game"""
        self.clients.discard(name)
        
        if self.players['left'] == name:
            self.players['left'] = None
        if self.players['right'] == name:
            self.players['right'] = None
        
        # If game was active and a player left, end the game
        if self.status == 'active' and (not self.players['left'] or not self.players['right']):
            self.status = 'finished'
        
        # Clean up if no clients left
        if len(self.clients) == 0:
            self.cleanup()
    
    def can_start(self):
        """Check if the game can start"""
        return (self.players['left'] and self.players['right'] and 
                self.status == 'waiting')
    
    def get_remaining_time(self):
        """Get remaining time in seconds before timeout"""
        # logger.debug(f"self.created_att={self.created_at}")

        if self.status != 'waiting':
            return 0

        # Support both numeric timestamps and datetime values.
        created_at_ts = self.created_at.timestamp() if isinstance(self.created_at, datetime) else float(self.created_at)
        elapsed = time.time() - created_at_ts
        remaining = self.JOIN_TIMEOUT - elapsed
        return max(0, int(remaining))
    
    def is_timeout_expired(self):
        """Check if the join timeout has expired"""
        return self.get_remaining_time() <= 0 and self.status == 'waiting'
    
    def get_timeout_result(self):
        """Get the game result based on who has joined
        Returns tuple: (winner_role, winner_name, winner_id, is_tie)
        - If no players: (None, "No players joined", None, True)
        - If one player: (role, player_name, player_id, False)
        - Should not be called if both players have joined
        """
        left_player = self.players['left']
        right_player = self.players['right']
        
        if not left_player and not right_player:
            # Both players failed to join - tie
            return (None, "No players joined", None, True)
        elif left_player and not right_player:
            # Only left player joined - they win
            return ('left', getattr(left_player, 'username', 'Player 1'), 
                   self.players_ids['left'], False)
        elif not left_player and right_player:
            # Only right player joined - they win
            return ('right', getattr(right_player, 'username', 'Player 2'), 
                   self.players_ids['right'], False)
        else:
            # Both players joined
            return (None, None, None, False)
    
    def start_game(self):
        """Start the game"""
        if self.can_start():
            self.status = 'active'
            self.last_tick = time.time()
            return True
        return False
    
    def tick(self):
        """Update game state"""
        import random
        
        if self.status != 'active':
            return None
        
        current_time = time.time()
        dt = current_time - self.last_tick
        self.last_tick = current_time
        
        state = self.state
        
        # Integrate ball
        state['ball']['x'] += state['ball']['vx'] * dt
        state['ball']['y'] += state['ball']['vy'] * dt
        
        # Top/bottom bounce
        if state['ball']['y'] > 4 or state['ball']['y'] < -4:
            state['ball']['vy'] *= -1
        
        # Left paddle collision
        if state['ball']['x'] < -3.5:
            if abs(state['ball']['y'] - state['paddles']['left']) < 1.2:
                state['ball']['vx'] = abs(state['ball']['vx'])
                state['ball']['vx'] *= 1.1
        
        # Right paddle collision
        if state['ball']['x'] > 3.5:
            if abs(state['ball']['y'] - state['paddles']['right']) < 1.2:
                state['ball']['vx'] = -abs(state['ball']['vx'])
                state['ball']['vx'] *= 1.1
        
        # Scoring
        winner = None
        if state['ball']['x'] < -6:
            state['score']['p2'] += 1
            self.reset_ball()
        if state['ball']['x'] > 6:
            state['score']['p1'] += 1
            self.reset_ball()
        
        # Check win condition
        if state['score']['p1'] >= state['winningScore']:
            winner = 'left'
            self.status = 'finished'
        elif state['score']['p2'] >= state['winningScore']:
            winner = 'right'
            self.status = 'finished'
        
        return {
            'ball': {'x': state['ball']['x'], 'y': state['ball']['y']},
            'paddles': state['paddles'],
            'score': state['score'],
            'winner': winner,
        }
    
    def reset_ball(self):
        """Reset ball to center with random direction"""
        import random
        self.state['ball']['x'] = 0
        self.state['ball']['y'] = 0
        direction = 1 if random.random() > 0.5 else -1
        self.state['ball']['vx'] = 3 * direction
        self.state['ball']['vy'] = (random.random() - 0.5) * 2.5
    
    def handle_paddle_move(self, role, y):
        """Update paddle position"""
        y_pos = y * 4 if isinstance(y, (int, float)) else 0
        if role in ['left', 'right']:
            self.state['paddles'][role] = y_pos
    
    def cleanup(self):
        """Clean up the game session"""
        GameSession.delete_game(self.id)
        
class Player(models.Model):
    # If user is deleted, all child records (matches, achievements) will be deleted as well.
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='player')
    
    total_games = models.IntegerField(default=0)
    total_wins = models.IntegerField(default=0)
    total_losses = models.IntegerField(default=0)
    
    elo_rating = models.IntegerField(default=1000)
    
    total_win_points = models.IntegerField(default=0)
    total_loss_points = models.IntegerField(default=0)
    
    current_win_streak = models.IntegerField(default=0)
    current_loss_streak = models.IntegerField(default=0)
    best_win_streak = models.IntegerField(default=0)
    
    def __str__(self):
        return f"{self.user.username} (ELO: {self.elo_rating})"
    
    # property lets us to access win_percentage as player.win_percentage instead of player.win_percentage()
    @property
    def win_percentage(self):
        if self.total_games == 0:
            return 0
        return self.total_wins * 100 / self.total_games
    
    @property
    def point_percentage(self):
        if self.total_win_points + self.total_loss_points == 0:
            return 0
        return self.total_win_points * 100 / (self.total_win_points + self.total_loss_points)
    
    def player_wins(self, win_point, opponent_elo):
        self.total_games += 1
        self.total_wins += 1
        
        k = 10 #k factor can be changed
        self.elo_rating += 10 * (1 - 1 / (1 + 10 ** ((opponent_elo - self.elo_rating) / 400)))
        
        self.total_win_points += win_point
        
        self.current_win_streak += 1
        self.current_loss_streak = 0
        
        if self.current_win_streak > self.best_win_streak:
            self.best_win_streak = self.current_win_streak
        
        self.save()
    
    def player_loses(self, loss_point, opponent_elo):
        self.total_games += 1
        self.total_losses += 1
        
        k = 10
        self.elo_rating += k * (0 - 1 / (1 + 10 ** ((opponent_elo - self.elo_rating) / 400)))
        
        self.total_loss_points += loss_point
        
        self.current_loss_streak += 1
        self.current_win_streak = 0
        
        self.save()

    def check_new_achievements(self):
        """Check if the player has unlocked any new achievements after a match.
        
        Returns a list of newly earned Achievement objects.
        """
        stat_map = {
            'total_games': self.total_games,
            'total_wins': self.total_wins,
            'win_streak': self.best_win_streak,
            'best_win_streak': self.best_win_streak,
            'elo_rating': self.elo_rating,
        }

        already_earned = set(
            self.achievements.values_list('achievement_id', flat=True)
        )

        newly_earned = []
        for achievement in Achievement.objects.exclude(pk__in=already_earned):
            stat_value = stat_map.get(achievement.requirement_type)
            if stat_value is not None and stat_value >= achievement.requirement_value:
                PlayerAchievement.objects.create(player=self, achievement=achievement)
                newly_earned.append(achievement)

        return newly_earned

    # The method receives the class (cls) as its first argument, not an instance (self). 
    # This allows us to call it on the class itself (Player.get_leaderboard()) rather than on an instance of the class.
    # With select_related: All user data is fetched together with the players in one query.
    @classmethod
    def get_leaderboard(cls):
        return cls.objects.select_related('user').all()[:10]

    class Meta:
        ordering = ['-elo_rating', '-total_wins']  # highest ELO first, then most wins (- for descending order)
        db_table = 'stats_players' # custom name for the database table (instead of default 'appname_modelname')

# for leaderboard:
# Live leaderboard — always up to date
# PlayerProfile.objects.all()  # already ordered by -elo_rating, -wins

# Top 10
# PlayerProfile.objects.all()[:10]
class Match(models.Model):
    player1 = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='matches_as_player1')
    player2 = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='matches_as_player2')
    
    player1_score = models.IntegerField()
    player2_score = models.IntegerField()
    
    # If player is deleted, match record stays, but player becomes NULL.
    winner = models.ForeignKey(Player, on_delete=models.SET_NULL, null=True, blank=True, related_name='matches_won')
    loser = models.ForeignKey(Player, on_delete=models.SET_NULL, null=True, blank=True, related_name='matches_lost')
    
    # auto_now_add=True automatically sets the field to the current date/time when the object is first created, and never updates it after that.
    timestamp = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Match: {self.player1.user.username} vs {self.player2.user.username} - Winner: {self.winner.user.username if self.winner else 'TBD'}"
    
    class Meta:
        db_table = 'stats_matches'
class Achievement(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField()
    
    REQUIREMENT_TYPES = [
        ('total_wins', 'Total Wins'),
        ('total_games', 'Total Games'),
        ('win_streak', 'Win Streak'),
        ('elo_rating', 'ELO Rating'),
    ]
    requirement_type = models.CharField(max_length=20, choices=REQUIREMENT_TYPES)
    requirement_value = models.IntegerField()
    
    def __str__(self):
        return self.name
    
    class Meta:
        ordering = ['requirement_type', 'requirement_value', 'name', 'description']  # order by requirement type, then value, then name
        db_table = 'stats_achievements'
        
# The rule of thumb:

# If a player can have one achievement → put it in the player table.
# If a player can have many achievements → use a separate table.

# Since a player can unlock multiple achievements, the separate PlayerAchievement table is the correct design.
class PlayerAchievement(models.Model):
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='achievements')
    @property
    def player_name(self):
        return self.player.user.username
    #  achievement.players.all() to get all PlayerAchievement records for a given achievement (i.e. everyone who earned it)
    achievement = models.ForeignKey(Achievement, on_delete=models.CASCADE, related_name='players')
    @property
    def achievement_name(self):
        return self.achievement.name
    @property
    def achievement_description(self):
        return self.achievement.description
    # on_delete=models.SET_NULL: if the referenced Match is deleted, don't delete this PlayerAchievement; just set match to NULL instead. Preserves the achievement record even if the match is gone.
    # match.earned_achievements.all() to get all achievements earned during that match
    match = models.ForeignKey(Match, on_delete=models.SET_NULL, null=True, blank=True, related_name='earned_achievements')
    timestamp = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.player.user.username} earned {self.achievement.name}"
    
    class Meta:
        unique_together = ('player', 'achievement')  # prevent duplicate achievements for the same player
        ordering = ['-timestamp']  # most recent achievements first
        db_table = 'stats_player_achievements'

# added a post_save signal to auto-create a Player row whenever a new user is created
@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_player_profile(sender, instance, created, **kwargs):
    if created:
        Player.objects.create(user=instance)