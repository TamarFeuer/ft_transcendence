import { fetchWithRefreshAuth } from '../../users_friends/usermanagement.js';
import * as tournamentAPI from './tournament_api.js';
import { showMessage } from "../../utils/utils.js"
import { getCurrentUser } from '../../users_friends/usermanagement.js';
import { navigate } from '../../routes/route_helpers.js';
import { t } from '../../i18n/index.js';

let tournamentAutoRefreshInterval = null;

export function stopTournamentAutoRefresh() {
  if (tournamentAutoRefreshInterval) {
    clearInterval(tournamentAutoRefreshInterval);
    tournamentAutoRefreshInterval = null;
  }
}

export function startTournamentAutoRefresh(callback, intervalMs = 5000) {
  stopTournamentAutoRefresh();
  tournamentAutoRefreshInterval = setInterval(callback, intervalMs);
}

// Load all tournament lists
export async function loadAllTournaments() {
    await Promise.all([
        loadRegistrationTournaments(),
        loadOngoingTournaments(),
        loadUpcomingTournaments(),
        loadCompletedTournaments()
    ]);
}

// Load user's completed tournaments
export async function loadCompletedTournaments() {
    const result = await tournamentAPI.listCompletedTournaments();
    const listEl = document.getElementById('completedTournaments');
    if (!listEl) return;
    
    if (!result.ok || !result.data || result.data.length === 0) {
    listEl.innerHTML = '<p class="text-gray-400 text-sm">None</p>';
    return;
    }
    
    const fragment = document.createDocumentFragment();
    result.data.forEach(tournament => {
    const div = document.createElement('div');
    div.className = 'bg-gray-800 rounded p-2 text-sm';
    div.innerHTML = `
        <div class="text-white font-semibold">${tournament.name}</div>
        <div class="text-gray-400 text-xs">👤 ${tournament.participant_count} players</div>
        <button class="view-games-btn mt-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold w-full" data-tournament-id="${tournament.id}">
        View Games
        </button>
    `;
    fragment.appendChild(div);
    });
    listEl.replaceChildren(fragment);
    // Add event listeners
    listEl.querySelectorAll('.view-games-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
        const tournamentId = e.target.dataset.tournamentId;
        console.log("Viewing tournament ID:", tournamentId);
        navigate(`/tournament/${tournamentId}`);
    });
    });
}

// Load user's upcoming tournaments
export async function loadUpcomingTournaments() {
    const result = await tournamentAPI.listUpcomingTournaments();
    const listEl = document.getElementById('upcomingTournaments');
    if (!listEl) return;
    
    if (!result.ok || !result.data || result.data.length === 0) {
    listEl.innerHTML = '<p class="text-gray-400 text-sm">None</p>';
    return;
    }
    
    const fragment = document.createDocumentFragment();
    result.data.forEach(tournament => {
    const div = document.createElement('div');
    div.className = 'bg-gray-800 rounded p-2 text-sm';
    div.innerHTML = `
        <div class="text-white font-semibold">${tournament.name}</div>
        <div class="text-gray-400 text-xs">👤 ${tournament.participant_count} players</div>
    `;
    fragment.appendChild(div);
    });
    listEl.replaceChildren(fragment);
}

// Load user's ongoing tournaments
export async function loadOngoingTournaments() {
    const result = await tournamentAPI.listOngoingTournaments();
    const listEl = document.getElementById('ongoingTournaments');
    if (!listEl) return;
    
    if (!result.ok || !result.data || result.data.length === 0) {
    listEl.innerHTML = '<p class="text-gray-400 text-sm">None</p>';
    return;
    }
    
    const fragment = document.createDocumentFragment();
    result.data.forEach(tournament => {
    const div = document.createElement('div');
    div.className = 'bg-gray-800 rounded p-2 text-sm';
    div.innerHTML = `
        <div class="text-white font-semibold">${tournament.name}</div>
        <div class="text-gray-400 text-xs">👤 ${tournament.participant_count} players</div>
        <button class="view-games-btn mt-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold w-full" data-tournament-id="${tournament.id}">
        View Games
        </button>
    `;
    fragment.appendChild(div);
    });
    listEl.replaceChildren(fragment);
    
    // Add event listeners
    listEl.querySelectorAll('.view-games-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
        const tournamentId = e.target.dataset.tournamentId;
        console.log("Viewing tournament ID:", tournamentId);
        navigate(`/tournament/${tournamentId}`);
        });
    });
}
    
// Load tournaments open for registration
async function loadRegistrationTournaments() {
    const result = await tournamentAPI.listRegistrationTournaments();
    const listEl = document.getElementById('tournamentsList');
    if (!listEl) return;
    
    if (!result.ok || !result.data || result.data.length === 0) {
    listEl.innerHTML = '<p class="text-gray-400">No tournaments available for registration.</p>';
    return;
    }
    console.log("Registration tournaments:", result.data);
    const currentUser = await getCurrentUser();
    const currentUsername = currentUser?.username || localStorage.getItem('username');
    const fragment = document.createDocumentFragment();

    result.data.forEach((tournament) => {
    const tournamentDiv = document.createElement('div');
    tournamentDiv.className = 'bg-gray-800 rounded-lg p-4 border border-gray-700';

    const isCreator = tournament.creator_username === currentUsername;
    const isFull = tournament.participant_count >= tournament.max_players;
    const isRegistered = (tournament.participants || []).some((p) => p.username === currentUsername);
    console.log("isRegistered:", isRegistered);

    tournamentDiv.innerHTML = `
        <div class="flex justify-between items-start">
        <div class="flex-1">
            <h3 class="text-white font-bold text-lg">${tournament.name}</h3>
            ${tournament.description ? `<p class="text-gray-400 text-sm mt-1">${tournament.description}</p>` : ''}
            <div class="flex gap-4 mt-2 text-sm">
            <span class="text-gray-300">👤 ${tournament.participant_count}/${tournament.max_players}</span>
            <span class="text-gray-300">👑 ${tournament.creator_username}</span>
            <span class="text-yellow-400">⏳ ${tournament.status}</span>
            </div>
        </div>
        <div class="flex gap-2">
            ${!isCreator && !isFull && !isRegistered ? `
            <button class="join-btn px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-semibold" data-id="${tournament.id}">
                Join
            </button>
            ` : ''}
            ${isRegistered && !isCreator ? `
            <div class="px-4 py-2 bg-blue-500 text-white rounded text-sm font-semibold" data-id="${tournament.id}">
                Joined
            </div>
            ` : ''}
            ${isCreator ? `
            <button class="start-btn px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-semibold" data-id="${tournament.id}">
                Start
            </button>
            <button class="cancel-btn px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-semibold" data-id="${tournament.id}">
                Cancel
            </button>
            ` : ''}
            ${isFull && !isCreator ? `
            <span class="px-4 py-2 bg-gray-600 text-gray-300 rounded text-sm">Full</span>
            ` : ''}
        </div>
        </div>
    `;
    
    fragment.appendChild(tournamentDiv);
    });
    listEl.replaceChildren(fragment);
    
    // Add event listeners for join/start/cancel buttons
    listEl.querySelectorAll('.join-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
        const tournamentId = e.target.dataset.id;
        btn.disabled = true;
        btn.textContent = 'Joining...';
        
        const result = await tournamentAPI.joinTournament(tournamentId);
        if (result.ok) {
        showMessage(t('TOURN_JOINED'), 'success');
        await loadAllTournaments();
        } else {
        showMessage(result.data?.error || t('TOURN_JOIN_FAILED'), 'error');
        btn.disabled = false;
        btn.textContent = 'Join';
        }
    });
    });
    
    listEl.querySelectorAll('.start-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
        const tournamentId = e.target.dataset.id;
        if (!confirm('Start this tournament? All registered players will begin competing.')) return;
        
        btn.disabled = true;
        btn.textContent = 'Starting...';
        
        const result = await tournamentAPI.startTournament(tournamentId);
        // result.ok = false; // TEMPORARY DISABLE STARTING TO PREVENT ISSUES WHILE TESTING
        if (result.ok) {
        showMessage(t('TOURN_STARTED'), 'success');
        await loadAllTournaments();
        } else {
        showMessage(result.data?.error || t('TOURN_START_FAILED'), 'error');
        btn.disabled = false;
        btn.textContent = 'Start';
        }
    });
    });
    
    listEl.querySelectorAll('.cancel-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
        const tournamentId = e.target.dataset.id;
        if (!confirm('Cancel this tournament? This cannot be undone.')) return;
        
        btn.disabled = true;
        btn.textContent = 'Cancelling...';
        
        const result = await tournamentAPI.cancelTournament(tournamentId);
        if (result.ok) {
        showMessage(t('TOURN_CANCELLED'), 'success');
        await loadAllTournaments();
        } else {
        showMessage(result.data?.error || t('TOURN_CANCEL_FAILED'), 'error');
        btn.disabled = false;
        btn.textContent = 'Cancel';
        }
    });
    });
}

export async function createTournamentBtn()
{
    const name = document.getElementById('tournamentName').value.trim();
    const description = document.getElementById('tournamentDescription').value.trim();
    const maxPlayers = parseInt(document.getElementById('tournamentMaxPlayers').value);
    
    if (!name) {
        showStatus('createStatus', t('TOURN_NAME_REQUIRED'), 'error');
        return;
    }
    
    showStatus('createStatus', t('TOURN_CREATING'), 'info');
    const result = await tournamentAPI.createTournament(name, description, maxPlayers);
    
    if (result.ok) {
        showStatus('createStatus', t('TOURN_CREATED'), 'success');
        // Clear form
        document.getElementById('tournamentName').value = '';
        document.getElementById('tournamentDescription').value = '';
        // Refresh lists
        setTimeout(() => loadAllTournaments(), 500);
    } else {
        showStatus('createStatus', result.data?.error || t('TOURN_CREATE_FAILED'), 'error');
    }
}

// Helper function to show status messages
function showStatus(elementId, message, type) {
    const statusEl = document.getElementById(elementId);
    if (!statusEl) return;
    
    const colors = {
    success: 'text-green-400',
    error: 'text-red-400',
    info: 'text-blue-400'
    };
    
    statusEl.innerHTML = `<p class="${colors[type] || 'text-white'}">${message}</p>`;
}
