import uuid
import time
from threading import Lock
from django.conf import settings
from django.db import models

class GameSession:
    """In-memory game session management"""
    
    _games = {}
    _lock = Lock()
    
    def __init__(self, game_id=None):
        self.id = game_id or str(uuid.uuid4())
        self.state = {
            'ball': {'x': 0, 'y': 0, 'vx': 3, 'vy': 1},
            'paddles': {'left': 0, 'right': 0},
            'score': {'p1': 0, 'p2': 0},
            'winningScore': 5
        }
        self.players = {'left': None, 'right': None}
        self.clients = set()
        self.status = 'waiting'  # waiting, active, finished
        self.last_tick = time.time()
        
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
    
    def add_player(self, channel_name, role=None):
        """Add a player or spectator to the game"""
        if not self.players['left']:
            self.players['left'] = channel_name
            self.clients.add(channel_name)
            return 'left'
        elif not self.players['right']:
            self.players['right'] = channel_name
            self.clients.add(channel_name)
            return 'right'
        else:
            self.clients.add(channel_name)
            return 'spectator'
    
    def remove_player(self, channel_name):
        """Remove a player from the game"""
        self.clients.discard(channel_name)
        
        if self.players['left'] == channel_name:
            self.players['left'] = None
        if self.players['right'] == channel_name:
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
            winner = 'Player 1'
            self.status = 'finished'
        elif state['score']['p2'] >= state['winningScore']:
            winner = 'Player 2'
            self.status = 'finished'
        
        return {
            'ball': {'x': state['ball']['x'], 'y': state['ball']['y']},
            'paddles': state['paddles'],
            'score': state['score'],
            'winner': winner
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
    # Related name 'profile' allows us to access Player from User via user.profile
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='profile')
    
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
        ordering = ['requirement_value', 'requirement_type', 'name']  # order by requirement value, then type, then name
        db_table = 'stats_achievements'
        
# The rule of thumb:

# If a player can have one achievement → put it in the player table.
# If a player can have many achievements → use a separate table.

# Since a player can unlock multiple achievements, the separate PlayerAchievement table is the correct design.
class PlayerAchievement(models.Model):
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='achievements')
    achievement = models.ForeignKey(Achievement, on_delete=models.CASCADE, related_name='players')
    timestamp = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.player.user.username} earned {self.achievement.name}"
    
    class Meta:
        unique_together = ('player', 'achievement')  # prevent duplicate achievements for the same player
        ordering = ['-timestamp']  # most recent achievements first
        db_table = 'stats_player_achievements'