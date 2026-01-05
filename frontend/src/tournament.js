// Tournament API functions

export async function createTournament(name, description, maxPlayers) {
    try {
        const res = await fetch('/api/tournament/create/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                name,
                description,
                max_players: maxPlayers
            })
        });
        const data = await res.json();
        return { ok: res.ok, data };
    } catch (error) {
        console.error('Error creating tournament:', error);
        return { ok: false, error: 'Network error' };
    }
}

export async function joinTournament(tournamentId) {
    try {
        const res = await fetch('/api/tournament/join/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ tournament_id: tournamentId })
        });
        const data = await res.json();
        return { ok: res.ok, data };
    } catch (error) {
        console.error('Error joining tournament:', error);
        return { ok: false, error: 'Network error' };
    }
}

export async function startTournament(tournamentId) {
    try {
        const res = await fetch('/api/tournament/start/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ tournament_id: tournamentId })
        });
        const data = await res.json();
        return { ok: res.ok, data };
    } catch (error) {
        console.error('Error starting tournament:', error);
        return { ok: false, error: 'Network error' };
    }
}

export async function cancelTournament(tournamentId) {
    try {
        const res = await fetch('/api/tournament/cancel/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ tournament_id: tournamentId })
        });
        const data = await res.json();
        return { ok: res.ok, data };
    } catch (error) {
        console.error('Error cancelling tournament:', error);
        return { ok: false, error: 'Network error' };
    }
}

export async function listRegistrationTournaments() {
    try {
        const res = await fetch('/api/tournament/show/registration/', {
            method: 'GET',
            credentials: 'include'
        });
        const data = await res.json();
        return { ok: res.ok, data };
    } catch (error) {
        console.error('Error fetching tournaments:', error);
        return { ok: false, data: [] };
    }
}

export async function listOngoingTournaments() {
    try {
        const res = await fetch('/api/tournament/show/ongoing/', {
            method: 'GET',
            credentials: 'include'
        });
        const data = await res.json();
        return { ok: res.ok, data };
    } catch (error) {
        console.error('Error fetching ongoing tournaments:', error);
        return { ok: false, data: [] };
    }
}

export async function listUpcomingTournaments() {
    try {
        const res = await fetch('/api/tournament/show/upcoming/', {
            method: 'GET',
            credentials: 'include'
        });
        const data = await res.json();
        return { ok: res.ok, data };
    } catch (error) {
        console.error('Error fetching upcoming tournaments:', error);
        return { ok: false, data: [] };
    }
}

export async function listCompletedTournaments() {
    try {
        const res = await fetch('/api/tournament/show/completed/', {
            method: 'GET',
            credentials: 'include'
        });
        const data = await res.json();
        return { ok: res.ok, data };
    } catch (error) {
        console.error('Error fetching completed tournaments:', error);
        return { ok: false, data: [] };
    }
}

export async function getTournamentGames(tournamentId) {
    try {
        const res = await fetch(`/api/tournament/show/games/?tournament_id=${tournamentId}`, {
            method: 'GET',
            credentials: 'include'
        });
        const data = await res.json();
        return { ok: res.ok, data };
    } catch (error) {
        console.error('Error fetching tournament games:', error);
        return { ok: false, data: [] };
    }
}

export async function getTournamentLeaderboard(tournamentId) {
    try {
        const res = await fetch(`/api/tournament/leaderboard/?tournament_id=${tournamentId}`, {
            method: 'GET',
            credentials: 'include'
        });
        const data = await res.json();
        return { ok: res.ok, data };
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        return { ok: false, data: [] };
    }
}

export async function getTournamentUserReadyGames(tournamentId) {
    try {
        const res = await fetch(`/api/tournament/show/ready/games/?tournament_id=${tournamentId}`, {
            method: 'GET',
            credentials: 'include'
        });
        const data = await res.json();
        return { ok: res.ok, data };
    } catch (error) {
        console.error('Error fetching ready games:', error);
        return { ok: false, data: [] };
    }
}

export async function startTournamentGame(gameId) {
    try {
        const res = await fetch('/api/tournament/game/start/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ game_id: gameId })
        });
        const data = await res.json();
        return { ok: res.ok, data };
    } catch (error) {
        console.error('Error starting tournament game:', error);
        return { ok: false, error: 'Network error' };
    }
}

export async function updateTournamentGameResult(gameId, winnerId) {
    try {
        const res = await fetch('/api/tournament/game/result/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ game_id: gameId, winner_id: winnerId })
        });
        const data = await res.json();
        return { ok: res.ok, data };
    } catch (error) {
        console.error('Error updating game result:', error);
        return { ok: false, error: 'Network error' };
    }
}

