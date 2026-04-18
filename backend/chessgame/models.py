import uuid
from threading import Lock
import chess
from django.db import models
from django.conf import settings

class ChessSession:
	_games = {}
	_lock = Lock()

	def __init__(self, game_id=None):
		self.id = game_id or str(uuid.uuid4())
		self.board = chess.Board()
		self.players = {'white': None, 'black': None}
		self.status = 'waiting'
		self.invitee_id = None

	@classmethod
	def create_game(cls):
		game = cls()
		with cls._lock:
			cls._games[game.id] = game
		return game

	def add_player(self, user):
		#colors are pre-assigned in join_chess, just confirm the connecting user matches
		white_id = getattr(self.players['white'], 'id', None)
		black_id = getattr(self.players['black'], 'id', None)
		if white_id == user.id:
			return 'white'
		elif black_id == user.id:
			return 'black'
		elif white_id is None and black_id is not None and black_id != user.id:
			# invite flow: invitor is black, invitee takes white
			self.players['white'] = user
			return 'white'
		elif black_id is None and white_id is not None and white_id != user.id:
			# invite flow: invitor is white, invitee takes black
			self.players['black'] = user
			return 'black'
		return None

	#returns whether the uci worked, the fen string, and None or a small dict when the game ends
	def apply_move(self, uci_move: str):
		try:
			move = chess.Move.from_uci(uci_move)
		except ValueError:
			return False, None, None
		
		if move not in self.board.legal_moves:
			return False, None, None
		
		self.board.push(move)

		#game might have just ended
		outcome = self.board.outcome()
		if outcome:
			self.status = 'finished'
			if outcome.winner == chess.WHITE:
				winner = 'white'
			elif outcome.winner == chess.BLACK:
				winner = 'black'
			else:
				winner = None

			return True, self.board.fen(), {'result': outcome.result(), 'winner': winner}
		
		return True, self.board.fen(), None
	

	@classmethod
	def delete_game(cls, game_id):
		with cls._lock:
			cls._games.pop(game_id, None)
	
	@classmethod
	def get_game(cls, game_id):
		return cls._games.get(game_id)

	def can_start(self):
		return self.players['white'] and self.players['black'] and self.status == 'waiting'
	
	def start(self):
		if self.can_start():
			self.status = 'active'
	
class ChessPlayer(models.Model):
	user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name = 'chess_player')
	elo_rating = models.IntegerField(default=1200)
	total_games = models.IntegerField(default = 0)
	total_wins = models.IntegerField(default = 0)
	total_losses = models.IntegerField(default = 0)

	def update_elo(self, opponent_elo, result):
		#result is 1 for win, .5 for draw and 0 for loss
		k = 40
		expected = 1 / (1 + 10 ** ((opponent_elo - self.elo_rating) / 400))
		self.elo_rating = round(self.elo_rating + k * (result - expected))
		self.total_games += 1
		#we currently don't track draws since we don't do it for stats either
		if result == 1:
			self.total_wins += 1
		elif result == 0:
			self.total_losses += 1
		self.save()

class ChessMatch(models.Model):
	white = models.ForeignKey(ChessPlayer, on_delete=models.SET_NULL, null = True, related_name='games_as_white')
	black = models.ForeignKey(ChessPlayer, on_delete=models.SET_NULL, null = True, related_name='games_as_black')
	result = models.CharField(max_length=10) # standard chess notation is 1-0 for white winning, 0-1 for black and 1/2-1/2 for draw
	white_elo_before = models.IntegerField()
	black_elo_before = models.IntegerField()
	timestamp = models.DateTimeField(auto_now_add=True)


