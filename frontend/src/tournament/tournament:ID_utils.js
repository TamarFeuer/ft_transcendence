import { fetchWithRefreshAuth } from '../users_friends/usermanagement.js';
import * as tournamentAPI from './tournament_api.js';
import { showMessage } from "../utils/utils.js"
import { checkAuthRequired } from '../users_friends/usermanagement.js';
import { stopTournamentAutoRefresh } from '../tournament/tournament_lobby_utils.js';
import { joinOnlineGame } from '../game/game.js';

export async function loadTournamentGames() {
  
    loadLeaderBoard();

    loadReadyGames();

    loadAllGamesStatus();
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
                <div class="text-green-400 text-sm">🏆 Winner: ${game.winner_username}</div>
                <div class="text-gray-400 text-sm">Round ${game.round}</div>
            </div>
            `;
            completedList.appendChild(gameDiv);
        });
        }
    }
}
