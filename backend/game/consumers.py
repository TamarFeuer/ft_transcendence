import json
import asyncio
from channels.generic.websocket import AsyncWebsocketConsumer
from .models import GameSession
import logging

logger = logging.getLogger(__name__)

class GameConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.game_id = self.scope['url_route']['kwargs']['game_id']
        self.game_group_name = f'game_{self.game_id}'
        self.role = None
        
        # Get or reject game
        self.game = GameSession.get_game(self.game_id)
        if not self.game:
            await self.close(code=4004)
            return

        # Check cookies from headers
        headers = dict(self.scope.get('headers', []))
        cookies = self.scope.get('cookies', {})
        
        print("Headers:", headers)
        print("Cookies:", cookies)
        print("Authorization:", headers.get(b'authorization'))

        # Check for duplicate connections
        logger.warning(f"Scope: {self.scope}")
        logger.warning(f"Connecting to game: {self.game_id} with channel: {self.channel_name} and player {self.scope['user']}")
        logger.warning(f"Current players: {self.game.get_players()}")

        # Check for duplicate connections - reject if user is ALREADY in the game
        players = self.game.get_players()
        if players['left'] == self.scope['user'] or players['right'] == self.scope['user']:
            logger.warning(f"Duplicate connection attempt by {self.scope['user']}")
            await self.close(code=4005)
            return

        logger.warning(f"user obj={self.scope.get('user')}, id={getattr(self.scope.get('user'), 'id', None)}, type={type(self.scope.get('user'))}")
        # Add player to game
        # self.role = self.game.add_player(self.scope['user'], self.scope['id'])
        self.role = self.game.add_player(self.scope['user'], getattr(self.scope.get('user'), 'id', None))
        logger.warning(f"Assigned role: {self.role} to: {self.scope['user']}")
        # Join game group
        await self.channel_layer.group_add(
            self.game_group_name,
            self.channel_name
        )
        
        # Accept WebSocket connection with subprotocol if provided
        headers = dict(self.scope.get('headers', []))
        subprotocol = headers.get(b'sec-websocket-protocol')
        if subprotocol:
            # Echo back the first subprotocol (JWT token)
            protocol_str = subprotocol.decode().split(',')[0].strip()
            await self.accept(subprotocol=protocol_str)
        else:
            await self.accept()
    
        logger.warning(f"Send assign: {self.role} to: {self.scope['user']}")
        # Send role assignment
        user_id = None
        try:
            user_id = self.scope['user'].id
        except Exception:
            user_id = None

        await self.send(text_data=json.dumps({
            'type': 'assign',
            'role': self.role,
            'user_id': user_id
        }))
        logger.warning(f"Start game?: {self.game.can_start()}")

        # Start game if both players connected
        if self.game.can_start():
            self.game.start_game()
            # Refresh players after start
            players = self.game.get_players()
            p1 = players.get('left')
            p2 = players.get('right')
            await self.channel_layer.group_send(
                self.game_group_name,
                {
                    'type': 'game_start',
                    'P1': getattr(p1, 'username', 'Player 1'),
                    'P2': getattr(p2, 'username', 'Player 2'),
                    'p1_id': getattr(p1, 'id', None),
                    'p2_id': getattr(p2, 'id', None)
                }
            )
            # Start game loop
            asyncio.create_task(self.game_loop())

    async def disconnect(self, close_code):
        logger.warning(f"Disconnecting from game: {self.game_id} with channel: {self.channel_name} and player {self.scope['user']}")
        if hasattr(self, 'game') and self.game:
            # self.game.remove_player(self.scope['user'])
            
            if self.game.status == 'finished':
                await self.channel_layer.group_send(
                    self.game_group_name,
                    {
                        'type': 'game_over',
                        'winner': 'Player disconnected',
                        'winner_id': None
                    }
                )
        
        if hasattr(self, 'game_group_name'):
            await self.channel_layer.group_discard(
                self.game_group_name,
                self.channel_name
            )
    
    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            
            if data.get('type') == 'paddleMove' and self.game:
                self.game.handle_paddle_move(self.role, data.get('y', 0))
        except json.JSONDecodeError:
            pass
    
    async def game_loop(self):
        """Main game loop running at 60 FPS"""
        while self.game and self.game.status == 'active':
            result = self.game.tick()
            logger.debug(f"Game tick result: {result}")
            if result:
                await self.channel_layer.group_send(
                    self.game_group_name,
                    {
                        'type': 'game_state',
                        'state': result
                    }
                )
                players = self.game.get_players()
                winner_id = None
                winner_name = None

                if result.get('winner') == 'left':
                    winner_user = players['left']
                    winner_id = getattr(winner_user, 'id', None)
                    winner_name = getattr(winner_user, 'username', 'Player 1')
                elif result.get('winner') == 'right':
                    winner_user = players['right']
                    winner_id = getattr(winner_user, 'id', None)
                    winner_name = getattr(winner_user, 'username', 'Player 2')
                
                if result.get('winner'):
                    await self.channel_layer.group_send(
                        self.game_group_name,
                        {
                            'type': 'game_over',
                            'winner': winner_name,
                            'winner_id': winner_id
                        }
                    )
                    break
            
            await asyncio.sleep(1/60)  # 60 FPS
    
    async def game_start(self, event):
        """Handle game start broadcast"""
        await self.send(text_data=json.dumps({
            'type': 'gameStart',
            'P1': event.get('P1'),
            'P2': event.get('P2'),
            'p1_id': event.get('p1_id'),
            'p2_id': event.get('p2_id')
        }))
    
    async def game_state(self, event):
        """Handle game state broadcast"""
        await self.send(text_data=json.dumps({
            'type': 'state',
            **event['state']
        }))
    
    async def game_over(self, event):
        """Handle game over broadcast"""
        logger.warning(f"Game over event received: {event}")
        await self.send(text_data=json.dumps({
            'type': 'gameOver',
            'winner': event['winner'],
            'winner_id': event['winner_id']
        }))