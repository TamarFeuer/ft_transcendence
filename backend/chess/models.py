import uuid
from threading import Lock
import chess

class ChessSession:
	_games = {}
	_lock = Lock()

	def __init__(self, game_id=None):
		self.id = game_id or str(uuid.uuid4())
		self.board = chess.Board()
		self.players = {'white': None, 'black': None}
		self.status = 'waiting'

	@classmethod
	def create_game(cls):
		game = cls()
		with cls._lock:
			cls._games[game.id] = game
		return game

	def add_player(self, user):
		if not self.players['white']:
			self.players['white'] = user
			return 'white'
		elif not self.players['black']:
			self.players['black'] = user
			return 'black'
		return None

	# Returns in order Sucess of move, the updated board
	# and either None if game is not finished, else a dictionary with game metadata
	def apply_move(self, uci_move: str):
		try:
			move = chess.Move.from_uci(uci_move)
		except ValueError:
			return False, None, None
		
		if move not in self.board.legal_moves:
			return False, None, None
		
		self.board.push(move)

		# if game is finished we find the winner
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
	