import { fetchWithRefreshAuth } from '../../users_friends/usermanagement.js';
import * as tournamentAPI from './tournament_api.js';
import { showMessage } from "../../utils/utils.js"
import { checkAuthRequired } from '../../users_friends/usermanagement.js';
import { stopTournamentAutoRefresh } from './tournament_lobby_utils.js';
import { joinOnlineGame } from '../game/game.js';

const activeGameTimers = new Map();

export async function loadTournamentGames() {
  
    loadLeaderBoard();

    loadReadyGames();

    loadAllGamesStatus();
}

export async function handleTournamentSocketEvent(data) {
    if (!data || typeof data !== 'object') return;

    if (data.type === 'timeUpdate') {
        var other_player;
        console.log('data handleTournamentSocketEvent: ', data);

        if (data.player_left != null)
            other_player = data.player_left;
        else
            other_player = data.player_right;
        updateTournamentTimer(data.game_id, data.remaining_time, other_player);

        return;
    }

    if (data.type === 'gameOver' || data.type === 'gameStart' || data.type === 'tournamentEvent') {
        if (data.game_id) {
            activeGameTimers.delete(String(data.game_id));
            renderTournamentTimers();
        }
        await loadTournamentGames();
    }
}

function updateTournamentTimer(gameId, remainingTime, safeOtherPlayer) {
    const section = document.getElementById('tournamentTimerSection');
    if (!section) return;

    const safeGameId = String(gameId || 'unknown');
    const safeRemaining = Number.isFinite(Number(remainingTime)) ? Number(remainingTime) : 0;

    if (safeRemaining <= 0) {
        activeGameTimers.delete(safeGameId);
    } else {
        activeGameTimers.set(safeGameId, {
            remaining: safeRemaining,
            otherPlayer: safeOtherPlayer,
        });
    }

    renderTournamentTimers();
}

function renderTournamentTimers() {
    const section = document.getElementById('tournamentTimerSection');
    const list = document.getElementById('tournamentTimerList');
    if (!section || !list) return;

    if (activeGameTimers.size === 0) {
        section.classList.add('hidden');
        list.innerHTML = '';
        return;
    }

    section.classList.remove('hidden');
    const entries = Array.from(activeGameTimers.entries())
        .sort((a, b) => a[1] - b[1])
        .map(([id, timerData]) => `
            <div class="bg-blue-950/50 border border-blue-700 rounded px-3 py-2 text-blue-100 text-sm">
                Game ${id}: <span class="font-bold text-white">${timerData.remaining}s</span> left to join
                Player ${timerData.otherPlayer}
            </div>
        `)
        .join('');

    list.innerHTML = entries;
}

export function resetTournamentTimers() {
    activeGameTimers.clear();
    renderTournamentTimers();
}

// Tournament Util functions
async function loadLeaderBoard() {
    // Load leaderboard
    const tournamentId = window.currentTournamentId;
    const leaderboardResult = await tournamentAPI.getTournamentLeaderboard(tournamentId);
    console.log("Tournament leaderboard:", leaderboardResult);
    if (leaderboardResult.ok && leaderboardResult.data) {
        const tbody = document.getElementById('leaderboardBody');
        tbody.innerHTML = '';
        leaderboardResult.data.forEach((participant, index) => {
        const row = document.createElement('tr');
        row.className = 'border-b border-gray-700 hover:bg-gray-800';
        row.innerHTML = `
            <td class="py-2">${participant.rank || index + 1}</td>
            <td class="py-2">${participant.username}</td>
            <td class="text-right py-2">${participant.score}</td>
        `;
        tbody.appendChild(row);
        });
    }

}

async function loadReadyGames() {
    // Load user's ready games
    const tournamentId = window.currentTournamentId;
    const readyResult = await tournamentAPI.getTournamentUserReadyGames(tournamentId);
    if (readyResult.ok && readyResult.data && readyResult.data.length > 0) {
        const listEl = document.getElementById('readyGamesList');
        listEl.innerHTML = '';
        let cnt = 0;
        readyResult.data.forEach(game => {
        console.log("Ready game:", game);
        const gameDiv = document.createElement('div');
        gameDiv.className = 'bg-gray-800 rounded-lg p-4 border border-blue-500';
        if (cnt == 0)
        {
            gameDiv.innerHTML = `
            <div class="flex justify-between items-center">
            <div class="text-white">
            <div class="font-bold text-lg">${game.player1_username} vs ${game.player2_username}</div>
                <div class="text-gray-400 text-sm">Round ${game.round}</div>
                </div>
                <button class="start-game-btn px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold" data-game-id="${game.id}">
                Start Game
                </button>
                </div>
                `;
        }
        else
        {
            gameDiv.innerHTML = `
            <div class="flex justify-between items-center">
            <div class="text-white">
            <div class="font-bold text-lg">${game.player1_username} vs ${game.player2_username}</div>
                <div class="text-gray-400 text-sm">Round ${game.round}</div>
                </div>

                </div>
                `;
        }
        listEl.appendChild(gameDiv);
        cnt += 1;
        });
        
        // Add event listeners for starting games
        listEl.querySelectorAll('.start-game-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (await checkAuthRequired()) {
            showMessage('You need to be logged in to start games.', 'error');
            return;
            }

            const gameId = e.target.dataset.gameId;
            btn.disabled = true;
            btn.textContent = 'Starting...';

            const result = await tournamentAPI.startTournamentGame(gameId);
            if (result.ok) {
            showMessage('Game started!', 'success');
            // Redirect to the game
            stopTournamentAutoRefresh();
            joinOnlineGame(result.data.game_id, true);
            } else {
            showMessage(result.data?.error || 'Failed to start game', 'error');
            btn.disabled = false;
            btn.textContent = 'Start Game';
            }
        });
        });
    } else {
        document.getElementById('readyGamesList').innerHTML = '<p class="text-gray-400">No ready games for you.</p>';
    }
}

async function loadAllGamesStatus() {
    // Load all games
    const tournamentId = window.currentTournamentId;
    const allGamesResult = await tournamentAPI.getTournamentGames(tournamentId);

    console.log("All tournament games:", allGamesResult);

    if (allGamesResult.ok && allGamesResult.data) {
        const ongoingList = document.getElementById('ongoingGamesList');
        const completedList = document.getElementById('completedGamesList');
        ongoingList.innerHTML = '';
        completedList.innerHTML = '';
        
        const ongoingGames = allGamesResult.data.filter(g => g.status === 'ongoing');
        const completedGames = allGamesResult.data.filter(g => g.status === 'completed');
        
        if (ongoingGames.length === 0) {
        ongoingList.innerHTML = '<p class="text-gray-400">No ongoing games</p>';
        } else {
        ongoingGames.forEach(game => {
            const gameDiv = document.createElement('div');
            gameDiv.className = 'bg-gray-800 rounded-lg p-4 border border-yellow-500';
            gameDiv.innerHTML = `
            <div class="text-white">
                <div class="font-bold">${game.player1_username} vs ${game.player2_username}</div>
                <div class="text-gray-400 text-sm">Round ${game.round} - Ongoing</div>
            </div>
            `;
            ongoingList.appendChild(gameDiv);
        });
        }
        
        if (completedGames.length === 0) {
        completedList.innerHTML = '<p class="text-gray-400">No completed games</p>';
        } else {
        completedGames.forEach(game => {
            const gameDiv = document.createElement('div');
            gameDiv.className = 'bg-gray-800 rounded-lg p-4 border border-green-500';
            gameDiv.innerHTML = `
            <div class="text-white">
                <div class="font-bold">${game.player1_username} vs ${game.player2_username}</div>
                <div class="text-green-400 text-sm">🏆 Winner: ${game.winner_username ? game.winner_username : "no winner"}</div>
                <div class="text-gray-400 text-sm">Round ${game.round}</div>
            </div>
            `;
            completedList.appendChild(gameDiv);
        });
        }
    }
}
