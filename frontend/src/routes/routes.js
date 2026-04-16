import { routes } from '../main.js';
import { initAIGame } from '../pong/ai/ai.js';
import { navigate } from "./route_helpers.js";
import { joinOnlineGame } from '../pong/game/game.js';
import { initOfflineGame } from '../pong/game/local_game.js';
import { startLocalTournament } from '../pong/tournament/local_tournament.js';
import { Engine, Scene } from "@babylonjs/core";
import { initGameScene } from "../pong/game/game.js";
import { checkAuthRequired } from '../users_friends/usermanagement.js';
import { updatePageTranslations } from '../i18n/index.js';
import { verifiedUserId } from '../chat/chat.js';
import { createTournamentBtn, loadAllTournaments, startTournamentAutoRefresh, stopTournamentAutoRefresh, loadCompletedTournaments, loadOngoingTournaments,
  loadUpcomingTournaments
 } from '../pong/tournament/tournament_lobby_utils.js';
import { loadTournamentGames } from '../pong/tournament/tournament:ID_utils.js';
import { showMessage } from "../utils/utils.js";
import { initChessGame } from '../chess/chess.js';
import { initProfilePage } from "../users_friends/profilePage.js"
import { initLoginPage } from "../users_friends/loginPage.js"
import { registerPage } from "../users_friends/register.js"
import { initHome } from "../home/home.js"

// Global engine management to prevent multiple render loops
export let currentEngine = null;
export let resizeListener = null;

async function loadLeaderboard() {
  const tbody = document.getElementById('leaderboardTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="3" class="py-2 px-2 text-center text-zinc-500">Loading...</td></tr>';
  try {
    const response = await fetch('/api/leaderboard');
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();
    const leaderboard = data.leaderboard;
    if (!Array.isArray(leaderboard) || leaderboard.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="py-2 px-2 text-center text-zinc-500">No results</td></tr>';
      return;
    }
    tbody.innerHTML = '';
    leaderboard.forEach((entry, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td class="py-1 px-2 border-b">${idx + 1}</td><td class="py-1 px-2 border-b">${entry.username ?? '-'}</td><td class="py-1 px-2 border-b">${entry.elo_rating ?? '-'}</td>`;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="3" class="py-2 px-2 text-center text-red-500">Error loading leaderboard</td></tr>';
  }
}

export function disposeCurrentEngine() {
  if (currentEngine) {
    currentEngine.stopRenderLoop();
    if (resizeListener) {
      window.removeEventListener("resize", resizeListener);
      resizeListener = null;
    }
    currentEngine.dispose();
    currentEngine = null;
  }
}

export async function redirectIfNotLoggedIn() {
  const noAuth = await checkAuthRequired();
  if (noAuth) {
    navigate('/login');
    return true;
  }
  return false;
}


async function loadTemplate(name) {
  disposeCurrentEngine();
  document.getElementById('renderCanvas')?.remove();
	const url = `/routes/${name}.html`;
	const res = await fetch(url);
	const html = await res.text();
	const appRoot = document.getElementById("app-root");
	appRoot.innerHTML = html;
	
	// Sync translations with current app language
	updatePageTranslations();
}

//only allow chess-online when the user navigated here intentionally from the hub
let chessOnlineIntended = false;

export function setupRoutes() {
  routes['/'] = async () => {
    stopTournamentAutoRefresh();
    if(await redirectIfNotLoggedIn())
        return;
    await loadTemplate('home');
    initHome();
  };
  routes['/login'] = async () => {
    stopTournamentAutoRefresh();
    await loadTemplate('login');
    initLoginPage();
  };
  routes['/register'] = async () =>{
    stopTournamentAutoRefresh();
    await loadTemplate('register');
    registerPage();
  }
  routes['/chess-hub'] = async () => {
    stopTournamentAutoRefresh();
    if(await redirectIfNotLoggedIn())
      return;
    await loadTemplate('chess-hub');
    const practiceBtn = document.getElementById('chessPracticeBtn');
    const onlineBtn   = document.getElementById('chessOnlineBtn');
    const backBtn     = document.getElementById('chessBackBtn');
    if (practiceBtn) practiceBtn.addEventListener('click', () => navigate('/chess'));
    if (onlineBtn) onlineBtn.addEventListener('click', () => {
      chessOnlineIntended = true;
      navigate('/chess-online');
    });
    if (backBtn) backBtn.addEventListener('click', () => navigate('/'));
  }

  routes['/chess-online'] = async () => {
    stopTournamentAutoRefresh();
    if(await redirectIfNotLoggedIn())
      return;
    const params = new URLSearchParams(window.location.search);
    const inviteGameId = params.get('gameId') || null;
    //redirect to hub on refresh or direct URL access; only run the game when the
    //user explicitly clicked Online Game from the hub, or followed an invite link
    if (!chessOnlineIntended && !inviteGameId) {
      navigate('/chess-hub');
      return;
    }
    chessOnlineIntended = false;
    await loadTemplate('chess-online');
    const { initOnlineChessGame } = await import('../chess/chess-online.js');
    initOnlineChessGame(inviteGameId);
  }


  let chessIntended = false;
  export function setChessOnlineIntended(){
      chessOnlineIntended = true;
  }

  routes['/chess'] = async () => {
    stopTournamentAutoRefresh();
    if(await redirectIfNotLoggedIn())
			return;
    await loadTemplate('chess');

    initChessGame();
  }

  routes['/pong'] = async () => {
    stopTournamentAutoRefresh();
    if(await redirectIfNotLoggedIn())
			return;

    await loadTemplate('pong');
    document.getElementById('localBtn')?.addEventListener('click', () => navigate('/local'));
    document.getElementById('AIBtn')?.addEventListener('click', () => navigate('/ai'));
    document.getElementById('onlineBtn')?.addEventListener('click', () => navigate('/online'));
    document.getElementById('tournamentBtn')?.addEventListener('click', () => navigate('/tournament'));
  };

  routes['/local'] = async () => {
    stopTournamentAutoRefresh();
    if(await redirectIfNotLoggedIn())
			return;

    await loadTemplate('local');
    const canvas = createGameCanvas();
    currentEngine = new Engine(canvas, true);
    const scene = new Scene(currentEngine);
    const gameObjects = initGameScene(scene, canvas, 2);
    initOfflineGame(scene, gameObjects, false);
    currentEngine.runRenderLoop(() => scene.render());
    resizeListener = () => currentEngine.resize();
    window.addEventListener("resize", resizeListener);
  };

  routes['/ai'] = async () => {
    stopTournamentAutoRefresh();
    if(await redirectIfNotLoggedIn())
			return;
    // disposeCurrentEngine();
    await loadTemplate('ai');
    const canvas = createGameCanvas();
    currentEngine = new Engine(canvas, true);
    const scene = new Scene(currentEngine);
    const gameObjects = initGameScene(scene, canvas, 2);
    initAIGame(scene, gameObjects, false);
    currentEngine.runRenderLoop(() => scene.render());
    resizeListener = () => currentEngine.resize();
    window.addEventListener("resize", resizeListener);
  };

  routes['/tournament'] = async () => {
    stopTournamentAutoRefresh();
    if(await redirectIfNotLoggedIn())
			return;

    await loadTemplate('tournament');
    
    // Get current user for checking if they're tournament creato
    console.log("All cookies:", document.cookie);
    
    // Load tournaments on page load
    await loadAllTournaments();
    
    // Back button
    document.getElementById('backBtn')?.addEventListener('click', () => navigate('/pong'));
    
    // Create tournament button
    document.getElementById('createTournamentBtn')?.addEventListener('click', async () => createTournamentBtn());

    // Submit on Enter from tournament name input
    document.getElementById('tournamentName')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('createTournamentBtn')?.click();
      }
    });
    
    // Refresh button
    document.getElementById('refreshTournamentsBtn')?.addEventListener('click', () => {
      loadAllTournaments();
    });


    let isRefreshingTournamentList = false;
    startTournamentAutoRefresh(async () => {
      if (window.location.pathname !== '/tournament' || isRefreshingTournamentList) {
        return;
      }
      isRefreshingTournamentList = true;
      try {
        await loadAllTournaments();
      } finally {
        isRefreshingTournamentList = false;
      }
    }, 4000);
  };

  routes['/online'] = async () => {
    stopTournamentAutoRefresh();
    if(await redirectIfNotLoggedIn())
			return;
    // disposeCurrentEngine();
    if (await checkAuthRequired() == true)
      {
      showMessage('You need to be logged in to access online games.', 'error');
      return;
    }

    // If we landed here with a gameId query param (e.g. from a tournament start), join the game right away
    const params = new URLSearchParams(window.location.search);
    const gameId = params.get('gameId');
    if (gameId) {
      joinOnlineGame(gameId, false);

      // Drop the query param so popstate/back does not re-join repeatedly
      params.delete('gameId');
      const newUrl = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`;
      window.history.replaceState({}, '', newUrl);
    }

    await loadTemplate('online');

    document.getElementById('backBtn')?.addEventListener('click', () => navigate('/'));

    document.getElementById('refreshGamesBtn')?.addEventListener('click', async () => {
      const response = await fetch('/api/games', { method: 'GET' });
      const data = await response.json();
      const availableGamesDiv = document.getElementById('availableGames');
      availableGamesDiv.innerHTML = '<h3 class="text-white">Available Games:</h3>';
      if (!data.games || data.games.length === 0) {
        availableGamesDiv.innerHTML += '<p class="text-gray-300">No available games.</p>';
      } else {
        data.games.forEach((game) => {
          console.log("Processing game:", game);
          if (game.isTournamentGame == true)
          {
            // Skip tournament games
            return;
          }
          const gameBtn = document.createElement('button');
          gameBtn.textContent = `Join Game ${game.id}`;
          gameBtn.className = 'px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded m-1';
          console.log("Adding join button for game ID:", game.id);
          gameBtn.addEventListener('click', () => joinOnlineGame(game.id));
          const gameStatusDiv = document.createElement('div');
          gameStatusDiv.className = 'text-white';
          gameStatusDiv.innerHTML = `<p>Status: ${game.status}</p>`;
          availableGamesDiv.appendChild(gameBtn);
          availableGamesDiv.appendChild(gameStatusDiv);
        });
      }
    });

    document.getElementById('createGameBtn')?.addEventListener('click', async () => {
      try {
        const response = await fetch('/api/game/create', { method: 'POST' });
        const data = await response.json();
        document.getElementById('lobbyStatus').innerHTML = `<p class="text-green-400">Game created with ID: ${data.gameId}.</p>`;
      } catch (error) {
        console.error('Failed to create game:', error);
        document.getElementById('lobbyStatus').innerHTML = `<p class="text-red-400">Failed to create game. Please try again.</p>`;
        showMessage('Failed to create game. Please try again.', 'error');
      }
    });
  };
  routes['/profile'] = async () => {
    stopTournamentAutoRefresh();
    if(await redirectIfNotLoggedIn())
      return;
    await loadTemplate('profile');
    await initProfilePage();

  };

  routes['/tournament/:tournamentId'] = async (tournamentId) => {
    stopTournamentAutoRefresh();
    if(await redirectIfNotLoggedIn())
			return;
    
    await loadTemplate('tournament-games');
    
    // Store tournament ID for use in callbacks
    window.currentTournamentId = tournamentId;
    
    document.getElementById('backBtn')?.addEventListener('click', () => navigate('/tournament'));
    
    // Load tournament games and leaderboard
    await loadTournamentGames();

    let isRefreshingTournamentGames = false;
    startTournamentAutoRefresh(async () => {
      if (!window.location.pathname.match(/^\/tournament\/\d+$/) || isRefreshingTournamentGames) {
        return;
      }
      isRefreshingTournamentGames = true;
      try {
        await loadTournamentGames();
      } finally {
        isRefreshingTournamentGames = false;
      }
    }, 3000);
  };
}

// Handler for tournament game route with parameter
export function handleTournamentRoute(path) {
  const match = path.match(/^\/tournament\/(\d+)$/);
  if (match) {
    const tournamentId = match[1];
    const handler = routes['/tournament/:tournamentId'];
    if (handler) {
      handler(tournamentId);
    }
  }
}

export function createGameCanvas() {
    const canvas = document.createElement('canvas');
    canvas.id = 'renderCanvas';
    canvas.className = 'absolute inset-0 w-full h-full pointer-events-none';
    document.body.appendChild(canvas);
    return canvas;
}
