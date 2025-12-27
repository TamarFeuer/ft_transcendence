import uuid
import time
from threading import Lock

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