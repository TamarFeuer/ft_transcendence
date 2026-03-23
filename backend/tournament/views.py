from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.utils import timezone
import jwt
from django.conf import settings
from .models import Tournament, TournamentParticipant, TournamentGame
from .serializers import TournamentSerializer, TournamentParticipantSerializer, TournamentGameSerializer
import logging
import random

logger = logging.getLogger(__name__)
User = get_user_model()


def get_user_from_cookie(request):
    """Extract user from access token cookie."""
    access_token = request.COOKIES.get('access_token')
    if not access_token:
        return None
    
    try:
        payload = jwt.decode(access_token, settings.SECRET_KEY, algorithms=['HS256'])
        if payload.get('type') != 'access':
            return None
        user_id = payload.get('user_id')
        return User.objects.get(pk=user_id)
    except (jwt.ExpiredSignatureError, jwt.DecodeError, User.DoesNotExist):
        return None


class TournamentCreateView(APIView):
    """Create a new tournament."""
    
    def post(self, request):
        user = get_user_from_cookie(request)
        if not user:
            return Response({'error': 'authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        serializer = TournamentSerializer(data=request.data)
        if serializer.is_valid():
            tournament = serializer.save(creator=user)
            # Automatically join the creator as first participant
            TournamentParticipant.objects.create(tournament=tournament, user=user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class TournamentJoinView(APIView):
    """Join an existing tournament."""
    
    def post(self, request):
        user = get_user_from_cookie(request)
        if not user:
            return Response({'error': 'authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        tournament_id = request.data.get('tournament_id')
        if not tournament_id:
            return Response({'error': 'tournament_id required'}, status=status.HTTP_400_BAD_REQUEST)
        
        tournament = get_object_or_404(Tournament, id=tournament_id)
        
        if tournament.status != 'registration':
            return Response({'error': 'tournament registration closed'}, status=status.HTTP_400_BAD_REQUEST)
        
        if tournament.participants.count() >= tournament.max_players:
            return Response({'error': 'tournament is full'}, status=status.HTTP_400_BAD_REQUEST)
        
        participant, created = TournamentParticipant.objects.get_or_create(
            tournament=tournament, user=user
        )
        
        if not created:
            return Response({'error': 'already joined'}, status=status.HTTP_400_BAD_REQUEST)
        
        return Response({'message': 'joined successfully'}, status=status.HTTP_201_CREATED)

class TournamentStartView(APIView):
    """Start a tournament (creator only)."""
    
    def post(self, request):
        user = get_user_from_cookie(request)
        if not user:
            return Response({'error': 'authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        tournament_id = request.data.get('tournament_id')
        tournament = get_object_or_404(Tournament, id=tournament_id)
        
        if tournament.creator != user:
            return Response({'error': 'only creator can start tournament'}, status=status.HTTP_403_FORBIDDEN)
        
        if tournament.status != 'registration':
            return Response({'error': 'tournament already started or completed'}, status=status.HTTP_400_BAD_REQUEST)
        
        participant_count = tournament.participants.count()
        if participant_count < 2:
            return Response({'error': 'need at least 2 participants'}, status=status.HTTP_400_BAD_REQUEST)
        
        tournament.status = 'ongoing'
        tournament.start_time = timezone.now()
        tournament.save()
        
        # Create round-robin games (each player plays every other player once)
        participants = list(tournament.participants.all())
        # participants = {"bob", "alice", "eve", "mallory", "trent", "peggy", "kim", "lee", "suk", "wang"}
        random.shuffle(participants)  # Shuffle to randomize pairings
        logger.debug(f"Starting tournament with participants: {[p.user.username for p in participants]}")
        # logger.debug(f"Starting tournament with participants: {participants}")

        all_pairings = []
        round_num = 1
        if participant_count % 2 == 1:
            participants.append(None)  # Add a dummy participant for bye weeks
            participant_count += 1
        num_rounds = participant_count - 1
        half_size = participant_count // 2
        for round_index in range(num_rounds):
            logger.debug(f"Creating pairings for round {round_index + 1}")
            round_pairings = []
            for i in range(half_size):
                p1 = participants[i]
                p2 = participants[participant_count - 1 - i]
                if p1 is not None and p2 is not None:
                    round_pairings.append((p1, p2))
                    TournamentGame.objects.create(
                        tournament=tournament,
                        round=round_index + 1,
                        player1=p1.user,
                        player2=p2.user,
                        status='ready'
                    )
                    logger.debug(f"Paired {p1.user.username} vs {p2.user.username} in round {round_index + 1}")
            all_pairings.extend(round_pairings)
            # Rotate participants for next round
            participants = [participants[0]] + [participants[-1]] + participants[1:-1]
            round_num += 1

        # round_num = 1
        # all_pairings = []
        # games_per_round = participant_count // 2
        # for i in range(len(participants) - 2):
        #     j = i
        #     for j in range(len(participants) - 2):
        #         p1 = participants[j]
        #         p2 = participants[j + 1]
        #         all_pairings.append((p1, p2))
        #         j += 1
        #     i += 1
        #     round_num += 1
        # logger.debug(f"All pairings: {all_pairings}")


        logger.debug(f"Created {len(all_pairings)} games across {round_num - 1} rounds")
        return Response({'message': 'tournament started'}, status=status.HTTP_200_OK)


class TournamentCancelView(APIView):
    """Cancel a tournament (creator only)."""
    
    def post(self, request):
        user = get_user_from_cookie(request)
        if not user:
            return Response({'error': 'authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        tournament_id = request.data.get('tournament_id')
        tournament = get_object_or_404(Tournament, id=tournament_id)
        
        if tournament.creator != user:
            return Response({'error': 'only creator can cancel tournament'}, status=status.HTTP_403_FORBIDDEN)
        
        if tournament.status == 'completed':
            return Response({'error': 'cannot cancel completed tournament'}, status=status.HTTP_400_BAD_REQUEST)
        
        tournament.status = 'cancelled'
        tournament.save()
        
        return Response({'message': 'tournament cancelled'}, status=status.HTTP_200_OK)


class RegistrationTournamentListView(APIView):
    """List all tournaments open for registration."""
    
    def get(self, request):
        tournaments = Tournament.objects.filter(status='registration')
        serializer = TournamentSerializer(tournaments, many=True)
        return Response(serializer.data)


class UpcomingTournamentListView(APIView):
    """List upcoming tournaments for the authenticated user."""
    
    def get(self, request):
        user = get_user_from_cookie(request)
        if not user:
            return Response({'error': 'authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        tournaments = Tournament.objects.filter(
            participants__user=user,
            status='upcoming'
        )
        serializer = TournamentSerializer(tournaments, many=True)
        return Response(serializer.data)


class OngoingTournamentListView(APIView):
    """List ongoing tournaments for the authenticated user."""
    
    def get(self, request):
        user = get_user_from_cookie(request)
        if not user:
            return Response({'error': 'authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        tournaments = Tournament.objects.filter(
            participants__user=user,
            status='ongoing'
        )
        serializer = TournamentSerializer(tournaments, many=True)
        return Response(serializer.data)


class CompletedTournamentListView(APIView):
    """List completed tournaments for the authenticated user."""
    
    def get(self, request):
        user = get_user_from_cookie(request)
        if not user:
            return Response({'error': 'authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        tournaments = Tournament.objects.filter(
            participants__user=user,
            status='completed'
        )
        serializer = TournamentSerializer(tournaments, many=True)
        return Response(serializer.data)


class TournamentGamesListView(APIView):
    """List all games in a tournament."""
    
    def get(self, request):
        tournament_id = request.GET.get('tournament_id')
        if not tournament_id:
            return Response({'error': 'tournament_id required'}, status=status.HTTP_400_BAD_REQUEST)
        
        games = TournamentGame.objects.filter(tournament_id=tournament_id)
        serializer = TournamentGameSerializer(games, many=True)
        return Response(serializer.data)


class TournamentUserReadyGamesListView(APIView):
    """List ready games for the authenticated user in a tournament."""
    
    def get(self, request):
        user = get_user_from_cookie(request)
        if not user:
            return Response({'error': 'authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        tournament_id = request.GET.get('tournament_id')
        if not tournament_id:
            return Response({'error': 'tournament_id required'}, status=status.HTTP_400_BAD_REQUEST)
        
        from django.db.models import Q
        games = TournamentGame.objects.filter(
            tournament_id=tournament_id,
            status__in=['ready', '1/2 players ready']
        ).filter(Q(player1=user) | Q(player2=user))
    
        serializer = TournamentGameSerializer(games, many=True)
        return Response(serializer.data)


class TournamentLeaderboardView(APIView):
    """Get leaderboard for a tournament."""
    
    def get(self, request):
        tournament_id = request.GET.get('tournament_id')
        if not tournament_id:
            return Response({'error': 'tournament_id required'}, status=status.HTTP_400_BAD_REQUEST)
        
        logger.debug(f"Fetching leaderboard for tournament_id={tournament_id}")
        logger.debug(f"Tournament exists: {Tournament.objects.filter(id=tournament_id)}")

        participants = TournamentParticipant.objects.filter(
            tournament_id=tournament_id
        ).order_by('-score', 'joined_at')
        
        serializer = TournamentParticipantSerializer(participants, many=True)
        return Response(serializer.data)


class StartTournamentGameView(APIView):
    """Start a tournament game (create GameSession and return game ID)."""
    
    def post(self, request):
        user = get_user_from_cookie(request)
        if not user:
            return Response({'error': 'authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        game_id = request.data.get('game_id')
        if not game_id:
            return Response({'error': 'game_id required'}, status=status.HTTP_400_BAD_REQUEST)
        
        game = get_object_or_404(TournamentGame, id=game_id)
        
        # Verify user is one of the players
        if user not in [game.player1, game.player2]:
            return Response({'error': 'you are not in this game'}, status=status.HTTP_403_FORBIDDEN)
        
        # If game is already ongoing, return the existing game_id so second player can join
        if game.status == '1/2 players ready':
            if not game.game_id:
                return Response({'error': 'game session not found'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            game.status = 'ongoing'
            game.save()
            return Response({
                'message': 'game already started',
                'game_id': game.game_id,
                'tournament_game_id': game.id,
                'player1': game.player1.username,
                'player2': game.player2.username
            }, status=status.HTTP_200_OK)
        
        if game.status != 'ready' and game.status != '1/2 players ready':
            return Response({'error': 'game is not ready'}, status=status.HTTP_400_BAD_REQUEST)

        # Create GameSession from game app
        from game.models import GameSession
        game_session = GameSession.create_game()
        game_session.isTournamentGame = True
        
        # Link tournament game to game session
        game.game_id = game_session.id
        # game.status = 'ongoing'
        game.status = '1/2 players ready'
        game.started_at = timezone.now()
        game.save()
        
        return Response({
            'message': 'game started',
            'game_id': game_session.id,
            'tournament_game_id': game.id,
            'player1': game.player1.username,
            'player2': game.player2.username
        }, status=status.HTTP_200_OK)


class UpdateTournamentGameResultView(APIView):
    """Update tournament game result (call after game is completed)."""
    
    def post(self, request):
        user = get_user_from_cookie(request)
        if not user:
            return Response({'error': 'authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        game_id = request.data.get('game_id')
        winner_id = request.data.get('winner_id')
        logger.debug(f"UpdateTournamentGameResultView called with game_id={game_id}, winner_id={winner_id}")
        if not game_id or not winner_id:
            return Response({'error': 'game_id and winner_id required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Look up by game_id (GameSession UUID), not id (TournamentGame integer id)
        game = get_object_or_404(TournamentGame, game_id=game_id)
        tournament = game.tournament
        
        # Verify winner is one of the players
        if winner_id not in [game.player1.id, game.player2.id]:
            return Response({'error': 'invalid winner'}, status=status.HTTP_400_BAD_REQUEST)
        
        winner = User.objects.get(id=winner_id)
        
        # Update game result
        game.winner = winner
        game.status = 'completed'
        game.completed_at = timezone.now()
        game.save()
        
        # Update tournament participant score
        participant = TournamentParticipant.objects.get(tournament=tournament, user=winner)
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

        return Response({
            'message': 'game result updated',
            'next_round': next_round_response
        }, status=status.HTTP_200_OK)
