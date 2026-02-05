from rest_framework import serializers
from .models import Tournament, TournamentParticipant, TournamentGame

class TournamentParticipantSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    
    class Meta:
        model = TournamentParticipant
        fields = ['id', 'user', 'username', 'joined_at', 'score', 'rank']
        read_only_fields = ['user', 'joined_at', 'score', 'rank']

class TournamentSerializer(serializers.ModelSerializer):
    creator_username = serializers.CharField(source='creator.username', read_only=True)
    participant_count = serializers.SerializerMethodField()
    participants = TournamentParticipantSerializer(many=True, read_only=True)
    
    class Meta:
        model = Tournament
        fields = ['id', 'name', 'description', 'creator', 'creator_username', 
                  'max_players', 'status', 'created_at', 'start_time', 'end_time', 
                  'participant_count', 'participants']
        read_only_fields = ['creator', 'status', 'created_at', 'start_time', 'end_time']
    
    def get_participant_count(self, obj):
        return obj.participants.count()



class TournamentGameSerializer(serializers.ModelSerializer):
    player1_username = serializers.CharField(source='player1.username', read_only=True)
    player2_username = serializers.CharField(source='player2.username', read_only=True)
    winner_username = serializers.CharField(source='winner.username', read_only=True)
    
    class Meta:
        model = TournamentGame
        fields = ['id', 'tournament', 'round', 'player1', 'player1_username', 
                  'player2', 'player2_username', 'winner', 'winner_username', 
                  'status', 'game_id', 'started_at', 'completed_at']
        read_only_fields = ['tournament', 'round', 'player1', 'player2', 'winner', 
                           'status', 'game_id', 'started_at', 'completed_at']
