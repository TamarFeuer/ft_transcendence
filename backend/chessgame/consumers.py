import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import sync_to_async
from .models import ChessPlayer, ChessMatch
from .models import ChessSession

logger = logging.getLogger(__name__)

class ChessConsumer(AsyncWebsocketConsumer):
	async def connect(self):
		self.game_id = self.scope['url_route']['kwargs']['game_id']
		self.game_group_name = f'chess_{self.game_id}'
		self.color = None

		#see if this table id is still open
		self.game = ChessSession.get_game(self.game_id)
		if not self.game:
			await self.close(code=4004)
			return
		
		#try to seat this connection as white or black
		self.color = self.game.add_player(self.scope['user'])
		if not self.color:
			await self.close(code=4003)
			return
		
		#subscribe to broadcasts for this table
		await self.channel_layer.group_add(self.game_group_name, self.channel_name)

		#same subprotocol accept as pong
		headers     = dict(self.scope.get('headers', []))
		subprotocol = headers.get(b'sec-websocket-protocol')
		if subprotocol:
			protocol_str = subprotocol.decode().split(',')[0].strip()
			await self.accept(subprotocol=protocol_str)
		else:
			await self.accept()
		
		await self.send(text_data=json.dumps({
			'type': 'assign',
			'color': self.color
		}))

		if self.game.can_start():
			self.game.start()
			await self.channel_layer.group_send(self.game_group_name, {
				'type': 'game_start',
				'fen': self.game.board.fen(),
				'white': getattr(self.game.players['white'], 'username', 'Player 1'),
				'black': getattr(self.game.players['black'], 'username', 'Player 2'),
			})
	

	async def disconnect(self, _close_code):
		if self.color and hasattr(self, 'game') and self.game:
			if self.game.status == 'active':
				winner = 'black' if self.color == 'white' else 'white'
				self.game.status = 'finished'
				await self.channel_layer.group_send(self.game_group_name, {
					'type': 'game_over',
					'winner': winner,
					'result': 'abandonment'
				})

				#announce result to global chat
				winner_name = getattr(self.game.players[winner], 'username', winner)
				await self.channel_layer.group_send('global_chat', {
					'type': 'game.result',
					'winner': winner_name,
					'game_type': 'chess',
					'is_tournament': False
				})

				#save result in db
				await self.save_chess_result(self.game, winner, 'abandonment')
			
			elif self.game.status == 'waiting' and self.game.invitee_id is not None:
				await self.channel_layer.group_send(
					f'user_{self.game.invitee_id}',
					{'type': 'game.invite.expired', 'game_id': self.game_id}
				)

			ChessSession.delete_game(self.game_id)

		if hasattr(self, 'game_group_name'):
			await self.channel_layer.group_discard(self.game_group_name, self.channel_name)


	async def receive(self, text_data):
		data = json.loads(text_data)
		if data.get('type') != 'move' or not self.game or self.game.status != 'active':
			return
		
		current_turn = 'white' if self.game.board.turn else 'black'
		if self.color != current_turn:
			return 
		
		uci = data.get('from', '') + data.get('to', '') + data.get('promotion', '')
		ok, fen, over = self.game.apply_move(uci)

		if not ok:
			await self.send(text_data=json.dumps({'type': 'illegal_move'}))
			return
		
		await self.channel_layer.group_send(self.game_group_name, {
			'type': 'game_state',
			'fen': fen,
			'turn': 'white' if self.game.board.turn else 'black'
		})

		if over:
			#save result in db
			await self.save_chess_result(self.game, over['winner'], over['result'])
			ChessSession.delete_game(self.game_id)
			
			await self.channel_layer.group_send(self.game_group_name, {
				'type': 'game_over',
				'winner': over['winner'],
				'result': over['result']
			})

			#announce result to global chat
			winner_color = over['winner']
			if winner_color:
				winner_name = getattr(self.game.players[winner_color], 'username', winner_color)
			else:
				winner_name = None
			await self.channel_layer.group_send('global_chat', {
				'type': 'game.result',
				'winner': winner_name,
				'game_type': 'chess',
				'is_tournament': False
			})
	
	async def game_start(self, event):
		await self.send(text_data=json.dumps({
			'type': 'gameStart',
			'fen': event['fen'],
			'white': event['white'],
			'black': event['black'],
		}))
	
	async def game_state(self, event):
		await self.send(text_data=json.dumps({
			 'type': 'gameState',
		'fen':  event['fen'],
		'turn': event['turn'],
		}))
	
	async def game_over(self, event):
		await self.send(text_data=json.dumps({
		'type':   'gameOver',
		'winner': event['winner'],
		'result': event['result'],
		}))

	async def save_chess_result(self, game, winner, result_str):
		white_user = game.players['white']
		black_user = game.players['black']
		if not white_user or not black_user:
			return

		@sync_to_async
		def _save():
			white_cp, _ = ChessPlayer.objects.get_or_create(user=white_user)
			black_cp, _ = ChessPlayer.objects.get_or_create(user=black_user)

			white_elo_before = white_cp.elo_rating
			black_elo_before = black_cp.elo_rating

			if winner == 'white':
				white_result, black_result = 1, 0
			elif winner == 'black':
				white_result, black_result = 0, 1
			else:
				white_result, black_result = 0.5, 0.5
			
			#update players' elo
			white_cp.update_elo(black_elo_before, white_result)
			black_cp.update_elo(white_elo_before, black_result)

			ChessMatch.objects.create(
				white=white_cp,
				black=black_cp,
				result=result_str,
				white_elo_before=white_elo_before,
				black_elo_before=black_elo_before,
			)

		await _save()