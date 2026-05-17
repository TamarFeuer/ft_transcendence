import * as tournamentAPI from './tournament_api.js';
import { showMessage } from "../../utils/utils.js";
import { getCurrentUser } from '../../users_friends/usermanagement.js';
import { navigate } from '../../routes/route_helpers.js';
import { t } from '../../i18n/index.js';
import { stopTournamentUpdatesSocket } from './tournament_ws.js';

let tournamentAutoRefreshInterval = null;

function stopOnlyTournamentAutoRefreshInterval(){
    if (tournamentAutoRefreshInterval){
        clearInterval(tournamentAutoRefreshInterval);
        tournamentAutoRefreshInterval = null;
    }
}

export function stopTournamentAutoRefresh(){
    stopTournamentUpdatesSocket();
    stopOnlyTournamentAutoRefreshInterval();
}

export function startTournamentAutoRefresh(callback, intervalMs = 500){
    stopOnlyTournamentAutoRefreshInterval();
    tournamentAutoRefreshInterval = setInterval(callback, intervalMs);
}

export async function loadAllTournaments(){
    await Promise.all([
        loadRegistrationTournaments(),
        loadOngoingTournaments(),
        loadUpcomingTournaments(),
        loadCompletedTournaments()
    ]);
}

export async function loadOngoingTournaments(){
    const result = await tournamentAPI.listOngoingTournaments();
    renderMyTournaments(result, "ongoingTournaments", true);
}

export async function loadUpcomingTournaments(){
    const result = await tournamentAPI.listUpcomingTournaments();
    renderMyTournaments(result, "upcomingTournaments", false);
}

export async function loadCompletedTournaments(){
    const result = await tournamentAPI.listCompletedTournaments();
    renderMyTournaments(result, "completedTournaments", true);
}

function renderMyTournaments(result, containerId, withViewButton){
    const container = document.getElementById(containerId);
    const template = document.getElementById("my-tournament-card-template");
    if (!container) return;

    if (!result.ok || !result.data || result.data.length === 0){
        container.innerHTML = `<p class="text-zinc-400 text-sm" data-i18n="TOURNAMENT_NONE">${t('TOURNAMENT_NONE')}</p>`;
        return;
    }

    const fragment = document.createDocumentFragment();
    result.data.forEach(tournament => {
        const wrapDiv = document.createElement("div");
        wrapDiv.innerHTML = template.innerHTML;
        const card = wrapDiv.firstElementChild;

        card.querySelector(".my-tournament-name").textContent = tournament.name;
        card.querySelector(".my-tournament-info").textContent = `${tournament.participant_count} ${t('TOURNAMENT_PLAYERS_PLACEHOLDER')}`;

        const viewBtn = card.querySelector(".view-games-btn");
        if (withViewButton)
            viewBtn.addEventListener("click", () => navigate(`/tournament/${tournament.id}`));
        else
            viewBtn.remove();

        fragment.appendChild(card);
    });
    container.replaceChildren(fragment);
}

async function loadRegistrationTournaments(){
    const result = await tournamentAPI.listRegistrationTournaments();
    const container = document.getElementById("tournamentsList");
    const template = document.getElementById("tournament-card-template");
    if (!container) return;

    if (!result.ok || !result.data || result.data.length === 0){
        container.innerHTML = `<p class="text-zinc-400" data-i18n="TOURNAMENT_NO_REGISTRATION">${t('TOURNAMENT_NO_REGISTRATION')}</p>`;
        return;
    }

    const currentUser = await getCurrentUser();
    const currentUsername = currentUser?.username || localStorage.getItem('username');

    const fragment = document.createDocumentFragment();
    result.data.forEach(tournament => {
        const wrapDiv = document.createElement("div");
        wrapDiv.innerHTML = template.innerHTML;
        const card = wrapDiv.firstElementChild;

        const isCreator = tournament.creator_username === currentUsername;
        const isFull = tournament.participant_count >= tournament.max_players;
        const isRegistered = (tournament.participants || []).some(p => p.username === currentUsername);

        fillTournamentCard(card, tournament);
        wireTournamentCardButtons(card, tournament, isCreator, isFull, isRegistered);

        fragment.appendChild(card);
    });
    container.replaceChildren(fragment);
}

function fillTournamentCard(card, tournament){
    card.querySelector(".tournament-name").textContent = tournament.name;

    const desc = card.querySelector(".tournament-description");
    if (tournament.description)
        desc.textContent = tournament.description;
    else
        desc.remove();

    card.querySelector(".tournament-players").textContent = `${tournament.participant_count}/${tournament.max_players} ${t('TOURNAMENT_PLAYERS_PLACEHOLDER')}`;
    card.querySelector(".tournament-creator").textContent = `by ${tournament.creator_username}`;
    card.querySelector(".tournament-status").textContent = t('TOURNAMENT_STATUS_' + tournament.status.toUpperCase());
}

function wireTournamentCardButtons(card, tournament, isCreator, isFull, isRegistered){
    const joinBtn = card.querySelector(".join-btn");
    const joinedBadge = card.querySelector(".joined-badge");
    const startBtn = card.querySelector(".start-btn");
    const cancelBtn = card.querySelector(".cancel-btn");
    const fullBadge = card.querySelector(".full-badge");

    if (isCreator){
        joinBtn.remove();
        joinedBadge.remove();
        fullBadge.remove();
        startBtn.addEventListener("click", () => handleStart(tournament.id, startBtn));
        cancelBtn.addEventListener("click", () => handleCancel(tournament.id, cancelBtn));
        return;
    }

    startBtn.remove();
    cancelBtn.remove();

    if (isRegistered){
        joinBtn.remove();
        fullBadge.remove();
        return;
    }

    joinedBadge.remove();

    if (isFull){
        joinBtn.remove();
        return;
    }

    fullBadge.remove();
    joinBtn.addEventListener("click", () => handleJoin(tournament.id, joinBtn));
}

async function handleJoin(tournamentId, btn){
    btn.disabled = true;
    btn.textContent = t('TOURNAMENT_JOINING');

    const result = await tournamentAPI.joinTournament(tournamentId);
    if (result.ok){
        showMessage(t('TOURN_JOINED'), 'success');
        await loadAllTournaments();
        return;
    }
    showMessage(result.data?.error || t('TOURN_JOIN_FAILED'), 'error');
    btn.disabled = false;
    btn.textContent = t('TOURNAMENT_JOIN');
}

async function handleStart(tournamentId, btn){
    if (!confirm(t('TOURNAMENT_CONFIRM_START')))
        return;

    btn.disabled = true;
    btn.textContent = t('TOURNAMENT_STARTING');

    const result = await tournamentAPI.startTournament(tournamentId);
    if (result.ok){
        showMessage(t('TOURN_STARTED'), 'success');
        await loadAllTournaments();
        return;
    }
    showMessage(result.data?.error || t('TOURN_START_FAILED'), 'error');
    btn.disabled = false;
    btn.textContent = t('TOURNAMENT_START');
}

async function handleCancel(tournamentId, btn){
    if (!confirm(t('TOURNAMENT_CONFIRM_CANCEL')))
        return;

    btn.disabled = true;
    btn.textContent = t('TOURNAMENT_CANCELLING');

    const result = await tournamentAPI.cancelTournament(tournamentId);
    if (result.ok){
        showMessage(t('TOURN_CANCELLED'), 'success');
        await loadAllTournaments();
        return;
    }
    showMessage(result.data?.error || t('TOURN_CANCEL_FAILED'), 'error');
    btn.disabled = false;
    btn.textContent = t('TOURNAMENT_CANCEL');
}

export async function createTournamentBtn(){
    const name = document.getElementById('tournamentName').value.trim();
    const description = document.getElementById('tournamentDescription').value.trim();
    const maxPlayers = parseInt(document.getElementById('tournamentMaxPlayers').value);

    if (!name){
        showStatus('createStatus', t('TOURN_NAME_REQUIRED'), 'error');
        return;
    }

    showStatus('createStatus', t('TOURN_CREATING'), 'info');
    const result = await tournamentAPI.createTournament(name, description, maxPlayers);

    if (result.ok){
        showStatus('createStatus', t('TOURN_CREATED'), 'success');
        document.getElementById('tournamentName').value = '';
        document.getElementById('tournamentDescription').value = '';
        setTimeout(() => loadAllTournaments(), 500);
        return;
    }
    showStatus('createStatus', result.data?.error || t('TOURN_CREATE_FAILED'), 'error');
}

function showStatus(elementId, message, type){
    const statusEl = document.getElementById(elementId);
    if (!statusEl) return;

    const colors = {
        success: 'text-green-400',
        error: 'text-red-400',
        info: 'text-violet-400'
    };

    statusEl.innerHTML = `<p class="${colors[type] || 'text-white'}">${message}</p>`;
}
