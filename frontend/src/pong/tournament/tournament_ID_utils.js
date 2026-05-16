import { fetchWithRefreshAuth } from '../../users_friends/usermanagement.js';
import * as tournamentAPI from './tournament_api.js';
import { showMessage } from "../../utils/utils.js"
import { checkAuthRequired } from '../../users_friends/usermanagement.js';
import { stopTournamentAutoRefresh } from './tournament_lobby_utils.js';
import { t, TranslationKey } from '../../i18n/index.js';
import { joinOnlineGame } from '../game/game.js';

const activeGameTimers = new Map();
const ACTIVE_ROUND_TIMEOUT_SECONDS = 25;

export async function loadTournamentGames() {
  
    loadLeaderBoard();

    loadReadyGames();

    loadAllGamesStatus();
}

export async function handleTournamentSocketEvent(data) {
    if (!data || typeof data !== 'object') return;

    if (data.type === 'timeUpdate') {
        console.log('data handleTournamentSocketEvent: ', data);
        updateTournamentTimer(data.game_id, data.remaining_time, data.player_left, data.player_right);
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

function updateTournamentTimer(gameId, remainingTime, _left_player, _right_player) {
    const section = document.getElementById('tournamentTimerSection');
    if (!section) return;

    const safeGameId = String(gameId || 'unknown');
    const safeRemaining = Number.isFinite(Number(remainingTime)) ? Number(remainingTime) : 0;

    const existingEntry = Array.from(activeGameTimers.entries()).find(([id, data]) => {
        const a = data.left_player;
        const b = data.right_player;
        return (a === _left_player && b === _right_player) || (a === _right_player && b === _left_player);
    });

    if (safeRemaining <= 0) {
        activeGameTimers.delete(safeGameId);
    } else if (existingEntry){
        console.log("existing Entry; ", existingEntry);
        const [existingId] = existingEntry;
        activeGameTimers.delete(existingId);
        activeGameTimers.set(safeGameId, {
            remaining: safeRemaining,
            right_player: _right_player,
            left_player: _left_player,
        });
    } else {
        activeGameTimers.set(safeGameId, {
            remaining: safeRemaining,
            right_player: _right_player,
            left_player: _left_player,
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
            <div class="bg-zinc-700 rounded px-3 py-2 text-zinc-200 text-sm">
                Game: ${timerData.left_player} vs ${timerData.right_player}: <span class="font-bold text-white">${timerData.remaining}s</span> left to join
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
        const fragment = document.createDocumentFragment();
        leaderboardResult.data.forEach((participant, index) => {
        const row = document.createElement('tr');
        row.className = 'border-b border-zinc-700 hover:bg-zinc-700';
        row.innerHTML = `
            <td class="py-2">${participant.rank || index + 1}</td>
            <td class="py-2">${participant.username}</td>
            <td class="text-right py-2">${participant.score}</td>
        `;
        fragment.appendChild(row);
        });
        tbody.replaceChildren(fragment);
    }

}

async function loadReadyGames() {
    // Load user's ready games
    const tournamentId = window.currentTournamentId;
    const readyResult = await tournamentAPI.getTournamentUserReadyGames(tournamentId);
    if (readyResult.ok && readyResult.data && readyResult.data.length > 0) {
        const listEl = document.getElementById('readyGamesList');
        const fragment = document.createDocumentFragment();
        let cnt = 0;
        readyResult.data.forEach(game => {
        console.log("Ready game:", game);
        const gameDiv = document.createElement('div');
        gameDiv.className = 'bg-zinc-700 rounded-lg p-4';
        if (cnt == 0)
        {
            gameDiv.innerHTML = `
            <div class="flex justify-between items-center">
            <div class="text-white">
            <div class="font-bold text-lg">${game.player1_username} vs ${game.player2_username}</div>
                <div class="text-zinc-400 text-sm">Round ${game.round}</div>
                </div>
                <button class="start-game-btn bg-violet-600 hover:bg-violet-500 rounded-xl px-6 h-10 lg:h-12 flex items-center justify-center font-semibold text-white text-sm lg:text-base transition-colors duration-200 shadow-lg shadow-violet-500/20" data-game-id="${game.id}">
                Start Game
                </button>
                </div>
                `;

            const startBtn = gameDiv.querySelector('.start-game-btn');
            startBtn.addEventListener('click', async () => {
                if (await checkAuthRequired()) {
                    showMessage(t('TOURN_LOGIN_REQUIRED'), 'error');
                    return;
                }
                startBtn.disabled = true;
                startBtn.textContent = 'Starting...';

                const result = await tournamentAPI.startTournamentGame(game.id);
                if (result.ok) {
                    showMessage(t('TOURN_GAME_STARTED'), 'success');
                    stopTournamentAutoRefresh();
                    joinOnlineGame(result.data.game_id, true);
                    return;
                }
                showMessage(result.data?.error || t('TOURN_GAME_START_FAILED'), 'error');
                startBtn.disabled = false;
                startBtn.textContent = 'Start Game';
            });
        }
        else
        {
            gameDiv.innerHTML = `
            <div class="flex justify-between items-center">
            <div class="text-white">
            <div class="font-bold text-lg">${game.player1_username} vs ${game.player2_username}</div>
                <div class="text-zinc-400 text-sm">Round ${game.round}</div>
                </div>

                </div>
                `;
        }
        fragment.appendChild(gameDiv);
        cnt += 1;
        });
        listEl.replaceChildren(fragment);
    } else {
        document.getElementById('readyGamesList').innerHTML = '<p class="text-zinc-400">No ready games for you.</p>';
    }
}

async function loadAllGamesStatus() {
    // Load all games
    const tournamentId = window.currentTournamentId;
    const allGamesResult = await tournamentAPI.getTournamentGames(tournamentId);

    console.log("All tournament games:", allGamesResult);

    if (allGamesResult.ok && allGamesResult.data) {
        const ongoingList = document.getElementById('ongoingGamesList');
        const futureList = document.getElementById('futureGamesList');
        const completedList = document.getElementById('completedGamesList');

        const ongoingGames = allGamesResult.data.filter(g => g.status === 'ongoing');
        const futureGames = allGamesResult.data.filter(g => g.status === 'ready' || g.status === 'pending');
        const completedGames = allGamesResult.data.filter(g => g.status === 'completed');

        if (ongoingGames.length === 0) {
            ongoingList.innerHTML = `<p class="text-zinc-400" data-i18n="TOURNAMENT_NO_ONGOING_GAMES">${t('TOURNAMENT_NO_ONGOING_GAMES')}</p>`;
        } else {
            const fragment = document.createDocumentFragment();
            ongoingGames.forEach(game => {
                const gameDiv = document.createElement('div');
                gameDiv.className = 'bg-zinc-700 rounded-lg p-4';
                gameDiv.innerHTML = `
                <div class="text-white">
                    <div class="font-bold">${game.player1_username} vs ${game.player2_username}</div>
                    <div class="text-yellow-400 text-sm">${t('TOURNAMENT_ROUND')} ${game.round} - ${t('TOURNAMENT_ONGOING')}</div>
                </div>
                `;
                fragment.appendChild(gameDiv);
            });
            ongoingList.replaceChildren(fragment);
        }

        if (futureGames.length === 0) {
            futureList.innerHTML = '<p class="text-zinc-400">No future round games</p>';
        } else {
            const fragment = document.createDocumentFragment();
            futureGames
                .sort((a, b) => Number(a.round || 0) - Number(b.round || 0))
                .forEach(game => {
                const gameDiv = document.createElement('div');
                gameDiv.className = 'bg-zinc-700 rounded-lg p-4';
                gameDiv.innerHTML = `
                <div class="text-white">
                    <div class="font-bold">${game.player1_username} vs ${game.player2_username}</div>
                    <div class="text-zinc-400 text-sm">Round ${game.round} - ${game.status === 'ready' ? 'Scheduled' : 'Pending'}</div>
                </div>
                `;
                fragment.appendChild(gameDiv);
            });
            futureList.replaceChildren(fragment);
        }

        if (completedGames.length === 0) {
            completedList.innerHTML = `<p class="text-zinc-400" data-i18n="TOURNAMENT_NO_COMPLETED_GAMES">${t('TOURNAMENT_NO_COMPLETED_GAMES')}</p>`;
        } else {
            const fragment = document.createDocumentFragment();
            completedGames.forEach(game => {
                const gameDiv = document.createElement('div');
                gameDiv.className = 'bg-zinc-700 rounded-lg p-4';
                gameDiv.innerHTML = `
                <div class="text-white">
                    <div class="font-bold">${game.player1_username} vs ${game.player2_username}</div>
                    <div class="text-green-400 text-sm">${t('TOURNAMENT_WINNER')}: ${game.winner_username ? game.winner_username : t('TOURNAMENT_NO_WINNER')}</div>
                    <div class="text-zinc-400 text-sm">${t('TOURNAMENT_ROUND')} ${game.round}</div>
                </div>
                `;
                fragment.appendChild(gameDiv);
            });
            completedList.replaceChildren(fragment);
        }
    }
}
