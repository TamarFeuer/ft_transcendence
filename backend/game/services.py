# services file for business logic

from .models import Match, Player, Achievement, PlayerAchievement

def match_ends(game_session, p1, p2):
    
    # game_session.state 
    # 'ball': {'x': 0, 'y': 0, 'vx': 3, 'vy': 1},
    # 'paddles': {'left': 0, 'right': 0},
    # 'score': {'p1': 0, 'p2': 0},
    # 'winningScore': 5
    
    p1_score = game_session.state['score']['p1']
    p2_score = game_session.state['score']['p2']

    if p1_score > p2_score:
        w, l = p1, p2
        winner_score, loser_score = p1_score, p2_score
    else:
        w, l = p2, p1
        winner_score, loser_score = p2_score, p1_score

    match = Match.objects.create(
        player1 = p1,
        player2 = p2,
        player1_score = p1_score,
        player2_score = p2_score,
        winner = w,
        loser = l,
    )

    w.player_wins(win_point = winner_score, opponent_elo = l.elo_rating)
    l.player_loses(loss_point = loser_score, opponent_elo = w.elo_rating)

    # correct player achievements

    return match


def award_achievements(player: Player) -> list:
    """
    Check all achievements and grant any the player now qualifies for
    but hasn't received yet. Returns the list of newly awarded achievements.
    """
    stat_map = {
        'total_wins':  player.total_wins,
        'total_games': player.total_games,
        'win_streak':  player.best_win_streak,
        'elo_rating':  player.elo_rating,
    }

    already_earned = set(
        player.achievements.values_list('achievement_id', flat=True)
    )

    newly_awarded = []
    for achievement in Achievement.objects.all():
        if achievement.id in already_earned:
            continue
        player_stat = stat_map.get(achievement.requirement_type, 0)
        if player_stat >= achievement.requirement_value:
            PlayerAchievement.objects.create(player=player, achievement=achievement)
            newly_awarded.append(achievement)

    return newly_awarded


def get_match_history(player: Player, limit: int = 10) -> list:
    """Return the most recent matches for a player."""
    return Match.objects.filter(
        player1=player
    ).union(
        Match.objects.filter(player2=player)
    ).order_by('-timestamp')[:limit]


def get_leaderboard(top_n: int = 10) -> list:
    """Return the top N players ordered by ELO rating."""
    return Player.objects.all()[:top_n]  # Meta already orders by -elo_rating
