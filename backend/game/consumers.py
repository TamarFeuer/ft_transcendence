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

logger = logging.getLogger(__name__)

# Helper functions for database operations (synchronous)
def update_game_to_ready(game_id):
    """Update tournament game status to waiting_active_round"""
    from tournament.models import TournamentGame
    try:
        tournament_game = TournamentGame.objects.get(game_id=game_id)
        tournament_game.status = 'waiting_active_round'
        tournament_game.save()
        logger.info(f"Tournament game {game_id} status updated to waiting_active_round")
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
    """Reset tournament game status to waiting_active_round after all players disconnect"""
    from tournament.models import TournamentGame
    try:
        tournament_game = TournamentGame.objects.get(game_id=game_id)
        tournament_game.status = 'waiting_active_round'
        tournament_game.save()
        logger.info(f"Tournament game {game_id} reset to waiting_active_round after all players disconnected")
        return True
    except TournamentGame.DoesNotExist:
        logger.debug(f"No tournament game found for game_id {game_id}")
        return False

def can_start_timeout_for_game(game_id):
    """Timeout is only enabled for games in the currently active round."""
    from tournament.models import TournamentGame
    try:
        tournament_game = TournamentGame.objects.get(game_id=game_id)
        return tournament_game.status in ('waiting_active_round', '1/2 players ready')
    except TournamentGame.DoesNotExist:
        logger.debug(f"No tournament game found for game_id {game_id} when checking timeout eligibility")
        return False

def get_tournament_game_players(game_id):
    """Return scheduled tournament players for this game_id as JSON-safe fields."""
    from tournament.models import TournamentGame
    try:
        game = TournamentGame.objects.select_related('player1', 'player2').get(game_id=game_id)
        return {
            'player_left': getattr(game.player1, 'username', None),
            'player_right': getattr(game.player2, 'username', None),
            'player_left_id': getattr(game.player1, 'id', None),
            'player_right_id': getattr(game.player2, 'id', None),
        }
    except TournamentGame.DoesNotExist:
        logger.debug(f"No tournament game found for game_id {game_id} when fetching players")
        return None

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

            # Promote next round to active waiting state once current round is fully completed.
            next_round_games = TournamentGame.objects.filter(tournament=tournament, round=next_round)
            if next_round_games.exists():
                next_round_games.filter(status='ready').update(status='waiting_active_round')
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

            # Promote next round to active waiting state once current round is fully completed.
            next_round_games = TournamentGame.objects.filter(tournament=tournament, round=next_round)
            if next_round_games.exists():
                next_round_games.filter(status='ready').update(status='waiting_active_round')
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
        self.tournament_group_name = f'tournament_{self.game.tournament_id}'
        self.tournament_id = self.game.tournament_id
        self.all_players_in_tournament = self.game.all_players_in_tournament



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

        players = self.game.get_players()
        if players['left'] == self.scope['user'] or players['right'] == self.scope['user']:
            logger.warning(f"Duplicate connection attempt by {self.scope['user']}")
            self.game.status = 'waiting'
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

        # Start game if both players connected
        if self.game.can_start():
            self.game.start_game()
            # Update tournament game status to ongoing
            await sync_to_async(update_game_to_ongoing)(self.game_id)
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
            await self.channel_layer.group_send(
                self.tournament_group_name,
                {
                    'type': 'tournament_event',
                    'event_name': 'gameStart',
                    'game_id': self.game_id,
                    'p1_id': getattr(p1, 'id', None),
                    'p2_id': getattr(p2, 'id', None)
                }
            )
            # Start game loop
            asyncio.create_task(self.game_loop())
        else:
            # Start timeout checker only for active-round tournament games.
            can_start_timeout = await sync_to_async(can_start_timeout_for_game)(self.game_id)
            if can_start_timeout and not getattr(self.game, 'timeout_task_started', False):
                self.game.timeout_task_started = True
                asyncio.create_task(self.check_join_timeout())

    async def disconnect(self, close_code):
        logger.info(f"DISCONNECT: Player {self.scope['user']} disconnecting from game {self.game_id}, close_code={close_code}")
        if hasattr(self, 'game') and self.game:
            players_before = self.game.get_players()
            departing_user = self.scope.get('user')
            departing_role = None
            if players_before.get('left') == departing_user:
                departing_role = 'left'
            elif players_before.get('right') == departing_user:
                departing_role = 'right'

            status_before = self.game.status
            logger.info(f"DISCONNECT: status_before={status_before}, departing_role={departing_role}, players_before={players_before}")
            self.game.remove_player(self.scope['user'])

            # If a participant disconnects during an active game, finish the game
            # and award win to the remaining player to avoid freeze on opponent side.
            players_after = self.game.get_players()
            logger.info(f"DISCONNECT: players_after={players_after}, checking if status={status_before} is active and has remaining players")
            if status_before == 'active' and (players_after.get('left') or players_after.get('right')):
                # Determine winner: whoever is still connected
                winner_user = players_after.get('left') or players_after.get('right')
                winner_id = getattr(winner_user, 'id', None)
                winner_name = getattr(winner_user, 'username', 'Player')

                self.game.status = 'completed'
                logger.info(f"DISCONNECT: Sending game_over for game {self.game_id}, winner={winner_name}")
                try:
                    await sync_to_async(update_game_completed)(self.game_id, winner_id, winner_name)
                except Exception as e:
                    logger.exception(f"DISCONNECT: update_game_completed failed for game {self.game_id}: {e}")

                # Force winner's score so match_ends can determine winner correctly
                if players_after.get('left'):
                    self.game.state['score']['p1'] = 1
                    self.game.state['score']['p2'] = 0
                else:
                    self.game.state['score']['p1'] = 0
                    self.game.state['score']['p2'] = 1
                new_achievements = {}
                left_player = self.game.players.get('left')
                right_player = self.game.players.get('right')
                # One side is disconnected here; protect stats update so game_over is always sent.
                if left_player is not None and right_player is not None:
                    try:
                        result_data = await database_sync_to_async(match_ends)(
                            self.game,
                            left_player,
                            right_player,
                        )
                        new_achievements = result_data.get('new_achievements', {})
                    except Exception as e:
                        logger.exception(f"DISCONNECT: match_ends failed for game {self.game_id}: {e}")
                else:
                    logger.info(
                        f"DISCONNECT: skipping match_ends for game {self.game_id} because a player is missing "
                        f"(left={left_player is not None}, right={right_player is not None})"
                    )

                logger.info(f"Player {departing_user} disconnected during active game {self.game_id}. Winner: {winner_name}")
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
                    self.tournament_group_name,
                    {
                        'type': 'tournament_event',
                        'event_name': 'gameOver',
                        'game_id': self.game_id,
                        'winner': winner_name,
                        'winner_id': winner_id
                    }
                )
                # Force all in-room clients back to lobby even if UI misses gameOver.
                await self.channel_layer.group_send(
                    self.game_group_name,
                    {
                        'type': 'close_connection'
                    }
                )
            else:
                logger.info(f"DISCONNECT: Condition not met - status was {status_before}, players_after={players_after}")
            
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
                    # Update tournament game with winner and completion status
                    logger.info("FINISH")
                    self.game.status = "completed"
                    await sync_to_async(update_game_completed)(self.game_id, winner_id, winner_name)

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
                        self.tournament_group_name,
                        {
                            'type': 'tournament_event',
                            'event_name': 'gameOver',
                            'game_id': self.game_id,
                            'winner': winner_name,
                            'winner_id': winner_id
                        }
                    )
                    # Run DB work in sync thread; pass users and resolve profiles in service.
                    await database_sync_to_async(match_ends)(
                        self.game,
                        self.game.players['left'],
                        self.game.players['right'],
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
        """Check for join timeout and handle results if expired"""
        try:
            scheduled_players = await sync_to_async(get_tournament_game_players)(self.game_id)
            while self.game and self.game.status == 'waiting' and not self.game.timeout_handled:
                # Send remaining time update every second.
                remaining_time = self.game.get_remaining_time()
                if scheduled_players:
                    player_left = scheduled_players.get('player_left')
                    player_right = scheduled_players.get('player_right')
                    player_left_id = scheduled_players.get('player_left_id')
                    player_right_id = scheduled_players.get('player_right_id')
                else:
                    left_player = self.game.players.get('left')
                    right_player = self.game.players.get('right')
                    player_left = getattr(left_player, 'username', None)
                    player_right = getattr(right_player, 'username', None)
                    player_left_id = getattr(left_player, 'id', None)
                    player_right_id = getattr(right_player, 'id', None)

                timer_event = {
                    'type': 'time_update',
                    'remaining_time': remaining_time,
                    'game_id': self.game_id,
                    # Tournament-scheduled players (fallback: currently connected WS users).
                    'player_left': player_left,
                    'player_right': player_right,
                    'player_left_id': player_left_id,
                    'player_right_id': player_right_id,
                }
                await self.channel_layer.group_send(self.game_group_name, timer_event)
                await self.channel_layer.group_send(self.tournament_group_name, timer_event)
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
                        await self.channel_layer.group_send(
                            self.tournament_group_name,
                            {
                                'type': 'tournament_event',
                                'event_name': 'gameOver',
                                'game_id': self.game_id,
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
                        await self.channel_layer.group_send(
                            self.tournament_group_name,
                            {
                                'type': 'tournament_event',
                                'event_name': 'gameOver',
                                'game_id': self.game_id,
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
        finally:
            if self.game:
                self.game.timeout_task_started = False
    
    async def time_update(self, event):
        """Send remaining time to client"""
        await self.send(text_data=json.dumps({
            'type': 'timeUpdate',
            'remaining_time': event['remaining_time'],
            'game_id': event.get('game_id'),
            'player_left': event.get('player_left'),
            'player_right': event.get('player_right'),
            'player_left_id': event.get('player_left_id'),
            'player_right_id': event.get('player_right_id')
        }))

    async def tournament_event(self, event):
        """Ignore tournament-only broadcasts in per-game consumer."""
        return
    
    async def close_connection(self, event):
        """Close the websocket connection"""
        await self.close(code=1008)