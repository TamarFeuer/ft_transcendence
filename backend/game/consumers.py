import json
import asyncio
from channels.generic.websocket import AsyncWebsocketConsumer
from .models import GameSession

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
        
        # Add player to game
        self.role = self.game.add_player(self.channel_name)
        
        # Join game group
        await self.channel_layer.group_add(
            self.game_group_name,
            self.channel_name
        )
        
        await self.accept()
        
        # Send role assignment
        await self.send(text_data=json.dumps({
            'type': 'assign',
            'role': self.role
        }))
        
        # Start game if both players connected
        if self.game.can_start():
            self.game.start_game()
            await self.channel_layer.group_send(
                self.game_group_name,
                {'type': 'game_start'}
            )
            # Start game loop
            asyncio.create_task(self.game_loop())
    
    async def disconnect(self, close_code):
        if hasattr(self, 'game') and self.game:
            self.game.remove_player(self.channel_name)
            
            if self.game.status == 'finished':
                await self.channel_layer.group_send(
                    self.game_group_name,
                    {
                        'type': 'game_over',
                        'winner': 'Player disconnected'
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
            
            if result:
                await self.channel_layer.group_send(
                    self.game_group_name,
                    {
                        'type': 'game_state',
                        'state': result
                    }
                )
                
                if result.get('winner'):
                    await self.channel_layer.group_send(
                        self.game_group_name,
                        {
                            'type': 'game_over',
                            'winner': result['winner']
                        }
                    )
                    break
            
            await asyncio.sleep(1/60)  # 60 FPS
    
    async def game_start(self, event):
        """Handle game start broadcast"""
        await self.send(text_data=json.dumps({
            'type': 'gameStart'
        }))
    
    async def game_state(self, event):
        """Handle game state broadcast"""
        await self.send(text_data=json.dumps({
            'type': 'state',
            **event['state']
        }))
    
    async def game_over(self, event):
        """Handle game over broadcast"""
        await self.send(text_data=json.dumps({
            'type': 'gameOver',
            'winner': event['winner']
        }))