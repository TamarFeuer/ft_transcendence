import { routes } from '../main.js';
import { initAIGame } from '../pong/ai/ai.js';
import { handleRoute, navigate } from "./route_helpers.js";
import { joinOnlineGame } from '../pong/game/game.js';
import { initOfflineGame } from '../pong/game/local_game.js';
import { startLocalTournament } from '../pong/tournament/local_tournament.js';
import { renderFriendsPanel } from '../users_friends/friends.js';
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


// async function loadTemplate(name) {
//   const url = `/routes/${name}.html`;
//   const res = await fetch(url);
//   const html = await res.text();
//   document.body.innerHTML = html;
// }

export async function redirectIfNotLoggedIn() {
  const noAuth = await checkAuthRequired();
  if (noAuth) {
    navigate('/login');
    return true;
  }
  return false;
}


async function loadTemplate(name) {
	const url = `/routes/${name}.html`;
	const res = await fetch(url);
	const html = await res.text();

	const appRoot = document.getElementById("app-root");
	appRoot.innerHTML = html;
	
	// Sync translations with current app language
	updatePageTranslations();
}

export function setupRoutes() {
  routes['/'] = async () => {
    stopTournamentAutoRefresh();
    await loadTemplate('home');
    document.getElementById('tttBtn')?.addEventListener('click', () => navigate('/ttt'));
    document.getElementById('mineBtn')?.addEventListener('click', () => navigate('/mine'));
    document.getElementById('pongBtn')?.addEventListener('click', () => navigate('/pong'));
    
  };

  routes['/chess'] = async () => {
    await loadTemplate('chess');
    document.getElementById('renderCanvas').style.display = 'none';
    initChessGame();
  }

  routes['/pong'] = async () => {
    stopTournamentAutoRefresh();
    await loadTemplate('pong');
    document.getElementById('localBtn')?.addEventListener('click', () => navigate('/local'));
    document.getElementById('AIBtn')?.addEventListener('click', () => navigate('/ai'));
    document.getElementById('onlineBtn')?.addEventListener('click', () => navigate('/online'));
    document.getElementById('tournamentBtn')?.addEventListener('click', () => navigate('/tournament'));


  };

  routes['/local'] = async () => {
    stopTournamentAutoRefresh();
    await loadTemplate('local');
    const canvas = document.getElementById("renderCanvas");
    const engine = new Engine(canvas, true);
    const scene = new Scene(engine);
    const gameObjects = initGameScene(scene, canvas, 2);
    initOfflineGame(scene, gameObjects, false);
    engine.runRenderLoop(() => scene.render());
    window.addEventListener("resize", () => engine.resize());
  };

  routes['/ai'] = async () => {
    stopTournamentAutoRefresh();
    await loadTemplate('ai');
    const canvas = document.getElementById("renderCanvas");
    const engine = new Engine(canvas, true);
    const scene = new Scene(engine);
    const gameObjects = initGameScene(scene, canvas, 2);
    initAIGame(scene, gameObjects, false);
    engine.runRenderLoop(() => scene.render());
    window.addEventListener("resize", () => engine.resize());
  };

  routes['/tournament'] = async () => {
    stopTournamentAutoRefresh();
    if (await checkAuthRequired() == true) {
      showMessage('You need to be logged in to access tournaments.', 'error');
      navigate('/');
      return;
    }
    
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
    await loadTemplate('profile');

    if (verifiedUserId) {
      renderFriendsPanel('friends-management-container');
    } else {
      window.addEventListener('userIdentified', () => {
        renderFriendsPanel('friends-management-container');
      }, { once: true });
    }
  };

  routes['/tournament/:tournamentId'] = async (tournamentId) => {
    stopTournamentAutoRefresh();
    if (await checkAuthRequired() == true) {
      showMessage('You need to be logged in to access tournaments.', 'error');
      navigate('/tournament');
      return;
    }
    
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