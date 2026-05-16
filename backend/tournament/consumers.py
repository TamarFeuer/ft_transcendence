import json
import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

from .models import TournamentParticipant

logger = logging.getLogger(__name__)


class TournamentConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.tournament_id = self.scope['url_route']['kwargs']['tournament_id']
        self.group_name = f"tournament_{self.tournament_id}"
        user = self.scope.get('user')

        if not user or not user.is_authenticated:
            await self.close(code=4401)
            return

        is_member = await self._is_participant(user.id, self.tournament_id)
        if not is_member:
            await self.close(code=4403)
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        # Optional ping/pong support for frontend keepalive.
        try:
            payload = json.loads(text_data)
        except json.JSONDecodeError:
            return

        if payload.get('type') == 'ping':
            await self.send(text_data=json.dumps({'type': 'pong'}))

    async def time_update(self, event):
        player_left = event.get('player_left')
        player_right = event.get('player_right')
        await self.send(text_data=json.dumps({
            'type': 'timeUpdate',
            'remaining_time': event.get('remaining_time'),
            'game_id': event.get('game_id'),
            'player_left': getattr(player_left, 'username', player_left),
            'player_right': getattr(player_right, 'username', player_right),
            'player_left_id': event.get('player_left_id') or getattr(player_left, 'id', None),
            'player_right_id': event.get('player_right_id') or getattr(player_right, 'id', None)
        }))

    async def tournament_event(self, event):
        await self.send(text_data=json.dumps({
            'type': event.get('event_name', 'tournamentEvent'),
            'game_id': event.get('game_id'),
            'winner': event.get('winner'),
            'winner_id': event.get('winner_id'),
            'p1_id': event.get('p1_id'),
            'p2_id': event.get('p2_id')
        }))

    @database_sync_to_async
    def _is_participant(self, user_id, tournament_id):
        return TournamentParticipant.objects.filter(
            tournament_id=tournament_id,
            user_id=user_id,
        ).exists()
