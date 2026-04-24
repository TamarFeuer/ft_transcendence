import json
import asyncio
from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import sync_to_async
from .models import GameSession
from django.utils import timezone
from channels.db import database_sync_to_async
from .models import GameSession, Player
from .services import match_ends
import logging
from chat.consumers import IN_GAME_USERS

logger = logging.getLogger(__name__)

# Helper functions for database operations (synchronous)
def update_game_to_ready(game_id):
    """Update tournament game status to ready"""
    from tournament.models import TournamentGame
    try:
        tournament_game = TournamentGame.objects.get(game_id=game_id)
        tournament_game.status = 'ready'
        tournament_game.save()
        logger.info(f"Tournament game {game_id} status updated to ready")
        return True
    except TournamentGame.DoesNotExist:
        logger.debug(f"No tournament game found for game_id {game_id}")
        return False

def update_game_to_ongoing(game_id):
    """Update tournament game status to ongoing"""
    from tournament.models import TournamentGame
    try:
        tournament_game = TournamentGame.objects.get(game_id=game_id)
        tournament_game.status = 'ongoing'
        tournament_game.started_at = timezone.now()
        tournament_game.save()
        logger.info(f"Tournament game {game_id} status updated to ongoing")
        return True
    except TournamentGame.DoesNotExist:
        logger.debug(f"No tournament game found for game_id {game_id}")
        return False

def reset_game_to_ready(game_id):
    """Reset tournament game status to ready after all players disconnect"""
    from tournament.models import TournamentGame
    try:
        tournament_game = TournamentGame.objects.get(game_id=game_id)
        tournament_game.status = 'ready'
        tournament_game.save()
        logger.info(f"Tournament game {game_id} reset to ready after all players disconnected")
        return True
    except TournamentGame.DoesNotExist:
        logger.debug(f"No tournament game found for game_id {game_id}")
        return False

def update_game_completed(game_id, winner_id, winner_name):
    """Update tournament game with winner and completion status"""
    from tournament.models import TournamentGame
    from tournament.models import TournamentParticipant
    from django.contrib.auth.models import User

    try:
        # Look up by game_id (GameSession UUID), not id (TournamentGame integer id)
        game = TournamentGame.objects.get(game_id=game_id)
        tournament = game.tournament
        
        # Verify winner is one of the players
        if winner_id not in [game.player1.id, game.player2.id]:
            logger.debug(f"winner_id not in [game.player1.id, game.player2.id]")
            return False
        
        # Update game result
        game.winner = User.objects.get(id=winner_id)
        game.winner_id = winner_id

        game.status = 'completed'
        game.completed_at = timezone.now()
        game.save()
        
        # Update tournament participant score
        participant = TournamentParticipant.objects.get(tournament=tournament, user=game.winner)
        participant.score += 10  # Award points for winning
        participant.save()
        logger.debug(f"Updated participant {participant.user.username} score to {participant.score}")

        # Check if all games in this round are completed
        current_round = game.round
        round_games = TournamentGame.objects.filter(tournament=tournament, round=current_round)
        completed_games = round_games.filter(status='completed').count()
        next_round_response = None

        if completed_games == round_games.count():
            # Determine next round number
            next_round = current_round + 1

            # If next-round games are already scheduled (e.g., round-robin), don't auto-generate
            if TournamentGame.objects.filter(tournament=tournament, round=next_round).exists():
                logger.debug(f"Next round {next_round} already scheduled; skipping auto-generation.")
                next_round_response = next_round

        # If all tournament games are completed (round-robin case), mark tournament completed
        if not TournamentGame.objects.filter(tournament=tournament).exclude(status='completed').exists():
            tournament.status = 'completed'
            tournament.end_time = timezone.now()
            tournament.save()
            logger.debug(f"Tournament {tournament.id} completed; all scheduled games finished.")

        logger.info(f"Tournament game {game_id} completed. Winner: {winner_name}")
        return True
    except TournamentGame.DoesNotExist:
        logger.debug(f"No tournament game found for game_id {game_id}")
        return False

def update_game_completed_tie(game_id):
    """Update tournament game as a tie with no winner"""
    from tournament.models import TournamentGame
    from tournament.models import TournamentParticipant
    from django.contrib.auth.models import User

    try:
                # Look up by game_id (GameSession UUID), not id (TournamentGame integer id)
        game = TournamentGame.objects.get(game_id=game_id)
        tournament = game.tournament
        
        # Update game result
        game.winner_id = None  # No winner in a tie
        game.winner = None
        game.status = 'completed'
        game.completed_at = timezone.now()
        game.save()
        
        # Check if all games in this round are completed
        current_round = game.round
        round_games = TournamentGame.objects.filter(tournament=tournament, round=current_round)
        completed_games = round_games.filter(status='completed').count()
        next_round_response = None

        if completed_games == round_games.count():
            # Determine next round number
            next_round = current_round + 1

            # If next-round games are already scheduled (e.g., round-robin), don't auto-generate
            if TournamentGame.objects.filter(tournament=tournament, round=next_round).exists():
                logger.debug(f"Next round {next_round} already scheduled; skipping auto-generation.")
                next_round_response = next_round

        # If all tournament games are completed (round-robin case), mark tournament completed
        if not TournamentGame.objects.filter(tournament=tournament).exclude(status='completed').exists():
            tournament.status = 'completed'
            tournament.end_time = timezone.now()
            tournament.save()
            logger.debug(f"Tournament {tournament.id} completed; all scheduled games finished.")

        logger.info(f"Tournament game {game_id} completed as a tie (no players joined)")
        return True
    except TournamentGame.DoesNotExist:
        logger.debug(f"No tournament game found for game_id {game_id}")
        return False

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
        
        logger.debug(f"Cookies: {cookies}")
        logger.debug(f"Headers: {headers}")
        logger.debug(f"Authorization: {headers.get(b'authorization')}")

        # Check for duplicate connections
        logger.debug(f"Scope: {self.scope}")
        logger.debug(f"Connecting to game: {self.game_id} with channel: {self.channel_name} and player {self.scope['user']}")
        logger.debug(f"Current players: {self.game.get_players()}")

        if self.scope['user'] in self.game.clients:
            logger.warning(f"Duplicate connection attempt by {self.scope['user']}")
            self.game.status = 'ready'
            # Update tournament game status in database
            await sync_to_async(update_game_to_ready)(self.game_id)
            await self.close(code=4005)
            return

        logger.debug(f"user obj={self.scope.get('user')}, id={getattr(self.scope.get('user'), 'id', None)}, type={type(self.scope.get('user'))}")
        # Add player to game
        self.role = self.game.add_player(self.scope['user'], getattr(self.scope.get('user'), 'id', None))
        logger.debug(f"Assigned role: {self.role} to: {self.scope['user']}")
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
            logger.debug(f"protocolstr = {protocol_str}")
            await self.accept(subprotocol=protocol_str)
        else:
            await self.accept()
    
        logger.debug(f"Send assign: {self.role} to: {self.scope['user']}")
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
        logger.debug(f"Start game?: {self.game.can_start()}")

        # Mark this player unavailable for invites as soon as they enter any pong session.
        IN_GAME_USERS.add(str(user_id))

        # Start game if both players connected
        if self.game.can_start():
            self.game.start_game()
            # Update tournament game status to ongoing
            await sync_to_async(update_game_to_ongoing)(self.game_id)

            player_ids = [str(pid) for pid in self.game.players_ids.values() if pid]
            for pid in player_ids:
                IN_GAME_USERS.add(pid)
            await self.channel_layer.group_send('global_chat', {'type': 'trigger.online.users.broadcast'})

            # Expire any pending invites between these two players
            if len(player_ids) == 2:
                invite_ids = await self.get_invite_ids_between(player_ids[0], player_ids[1])
                for gid in invite_ids:
                    for uid in player_ids:
                        await self.channel_layer.group_send(
                            f'user_{uid}',
                            {'type': 'game.invite.expired', 'game_id': gid}
                        )

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
        else:
            await self.channel_layer.group_send('global_chat', {'type': 'trigger.online.users.broadcast'})
            if self.game.isTournamentGame:
                # Start timeout checker if this is a tournament game in waiting state
                asyncio.create_task(self.check_join_timeout())

    async def disconnect(self, close_code):
        logger.debug(f"Disconnecting from game: {self.game_id} with channel: {self.channel_name} and player {self.scope['user']}")
        if hasattr(self, 'game') and self.game:
            players_before = self.game.get_players()
            departing_user = self.scope.get('user')
            departing_role = None
            if players_before.get('left') == departing_user:
                departing_role = 'left'
            elif players_before.get('right') == departing_user:
                departing_role = 'right'

            status_before = self.game.status
            self.game.remove_player(self.scope['user'])

            # If a participant disconnects during an active game, finish the game
            # and award win to the remaining player to avoid freeze on opponent side.
            if departing_role in ('left', 'right') and status_before == 'active':
                players_after = self.game.get_players()
                winner_user = players_after.get('right') if departing_role == 'left' else players_after.get('left')
                winner_id = getattr(winner_user, 'id', None)
                winner_name = getattr(winner_user, 'username', 'Player disconnected')

                self.game.status = 'completed'
                await sync_to_async(update_game_completed)(self.game_id, winner_id, winner_name)

                # Force winner's score so match_ends can determine winner correctly
                if departing_role == 'left':
                    self.game.state['score']['p1'] = 0
                    self.game.state['score']['p2'] = 1
                else:
                    self.game.state['score']['p1'] = 1
                    self.game.state['score']['p2'] = 0
                result_data = await database_sync_to_async(match_ends)(
                    self.game,
                    players_before['left'],
                    players_before['right'],
                )
                new_achievements = result_data.get('new_achievements', {})

                await self.channel_layer.group_send(
                    self.game_group_name,
                    {
                        'type': 'game_over',
                        'winner': winner_name,
                        'winner_id': winner_id,
                        'new_achievements': new_achievements,
                    }
                )
                loser_name = getattr(departing_user, 'username', None)
                await self.channel_layer.group_send(
                    "global_chat",
                    {
                        "type": "game_result",
                        "winner": winner_name,
                        "loser": loser_name,
                        "game_type": "pong",
                        "is_tournament": self.game.isTournamentGame
                    }
                )

            elif status_before == 'waiting' and getattr(self.game, 'invitee_id', None) is not None:
                invitor_id = str(getattr(departing_user, 'id', None))
                for uid in [self.game.invitee_id, invitor_id]:
                    await self.channel_layer.group_send(
                        f'user_{uid}',
                        {'type': 'game.invite.expired', 'game_id': self.game_id}
                    )

            # If all players are gone, reset game to waiting state
            players = self.game.get_players()
            if players['left'] is None and players['right'] is None and self.game.status != "completed":
                logger.info(f"All players disconnected from game {self.game_id}, resetting to waiting state")
                self.game.status = 'waiting'
                # Update tournament game status in database
                await sync_to_async(reset_game_to_ready)(self.game_id)

            if self.game.status == 'completed' and status_before != 'active':
                await self.channel_layer.group_send(
                    self.game_group_name,
                    {
                        'type': 'game_over',
                        'winner': 'Player disconnected',
                        'winner_id': None
                    }
                )
                await self.channel_layer.group_send(
                    "global_chat",
                    {
                        "type": "game_result",
                        "winner": None,
                        "game_type": "pong",
                        "is_tournament": self.game.isTournamentGame
                    }
                )

            # Remove all players from in-game tracking
            for player_id in self.game.players_ids.values():
                if player_id:
                    IN_GAME_USERS.discard(str(player_id))
            await self.channel_layer.group_send('global_chat', {'type': 'trigger.online.users.broadcast'})

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
            # logger.debug(f"Game tick result: {result}")
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
                    # Update tournament game with winner and completion status
                    logger.info("FINISH")
                    self.game.status = "completed"
                    await sync_to_async(update_game_completed)(self.game_id, winner_id, winner_name)

                    loser_user = players['right'] if result.get('winner') == 'left' else players['left']
                    loser_name = getattr(loser_user, 'username', None)

                    # Run DB work in sync thread; pass users and resolve profiles in service.
                    result_data = await database_sync_to_async(match_ends)(
                        self.game,
                        self.game.players['left'],
                        self.game.players['right'],
                    )
                    new_achievements = result_data.get('new_achievements', {})

                    await self.channel_layer.group_send(
                        self.game_group_name,
                        {
                            'type': 'game_over',
                            'winner': winner_name,
                            'winner_id': winner_id,
                            'new_achievements': new_achievements,
                        }
                    )
                    await self.channel_layer.group_send(
                        'global_chat',
                        {
                            'type': 'game_result',
                            'winner': winner_name,
                            'loser': loser_name,
                            'game_type': 'pong',
                            'is_tournament': self.game.isTournamentGame,
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
        logger.info(f"Game over event received: {event}")
        await self.send(text_data=json.dumps({
            'type': 'gameOver',
            'winner': event['winner'],
            'winner_id': event['winner_id'],
            'new_achievements': event.get('new_achievements', {}),
        }))

    async def check_join_timeout(self):
        if not self.game or not self.game.isTournamentGame:
            return
        """Check for join timeout and handle results if expired"""
        while self.game and self.game.status == 'waiting' and not self.game.timeout_handled:
            # Send remaining time update every second
            remaining_time = self.game.get_remaining_time()
            await self.channel_layer.group_send(
                self.game_group_name,
                {
                    'type': 'time_update',
                    'remaining_time': remaining_time
                }
            )
            logger.debug(f"check_join_timeout")

            # Check if timeout has expired
            if self.game.is_timeout_expired() and not self.game.timeout_handled:
                self.game.timeout_handled = True
                winner_role, winner_name, winner_id, is_tie = self.game.get_timeout_result()
                
                self.game.status = 'completed'
                logger.debug(f"self.game.is_timeout_expired() and not self.game.timeout_handled: {is_tie}")

                if is_tie:
                    # No players joined - it's a tie
                    await sync_to_async(update_game_completed_tie)(self.game_id)
                    await self.channel_layer.group_send(
                        self.game_group_name,
                        {
                            'type': 'game_over',
                            'winner': 'Tie - No players joined',
                            'winner_id': None
                        }
                    )
                else:
                    # One player joined - they win by default
                    await sync_to_async(update_game_completed)(self.game_id, winner_id, winner_name)
                    await self.channel_layer.group_send(
                        self.game_group_name,
                        {
                            'type': 'game_over',
                            'winner': winner_name,
                            'winner_id': winner_id
                        }
                    )
                # Close all client connections
                await self.channel_layer.group_send(
                    self.game_group_name,
                    {
                        'type': 'close_connection'
                    }
                )
                break
            
            await asyncio.sleep(1)  # Check every second
    
    async def time_update(self, event):
        """Send remaining time to client"""
        await self.send(text_data=json.dumps({
            'type': 'timeUpdate',
            'remaining_time': event['remaining_time']
        }))
    
    async def close_connection(self, event):
        """Close the websocket connection"""
        await self.close(code=1008)

    @sync_to_async
    def get_invite_ids_between(self, user1_id, user2_id):
        from chat.models import GameInvite, ConversationParticipant
        conv_ids = ConversationParticipant.objects.filter(
            user_id=user1_id
        ).values_list('conversation_id', flat=True)
        shared_conv_id = ConversationParticipant.objects.filter(
            conversation_id__in=conv_ids,
            user_id=user2_id
        ).values_list('conversation_id', flat=True).first()
        if not shared_conv_id:
            return []
        return list(GameInvite.objects.filter(
            conversation_id=shared_conv_id
        ).values_list('game_id', flat=True))