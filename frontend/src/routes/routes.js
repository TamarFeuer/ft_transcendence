import { routes } from '../main.js';
import { initAIGame } from '../pong/ai/ai.js';
import { navigate } from "./route_helpers.js";
import { joinOnlineGame } from '../pong/game/game.js';
import { initOfflineGame } from '../pong/game/local_game.js';
import { startLocalTournament } from '../pong/tournament/local_tournament.js';
import { Engine, Scene } from "@babylonjs/core";
import { initGameScene } from "../pong/game/game.js";
import { checkAuthRequired, fetchWithRefreshAuth } from '../users_friends/usermanagement.js';
import { updatePageTranslations } from '../i18n/index.js';
import { verifiedUserId } from '../chat/chat.js';
import { createTournamentBtn, loadAllTournaments, startTournamentAutoRefresh, stopTournamentAutoRefresh, loadCompletedTournaments, loadOngoingTournaments,
  loadUpcomingTournaments
 } from '../pong/tournament/tournament_lobby_utils.js';
import { loadTournamentGames, handleTournamentSocketEvent, resetTournamentTimers } from '../pong/tournament/tournament:ID_utils.js';
import { startTournamentUpdatesSocket } from '../pong/tournament/tournament_ws.js';
import { showMessage } from "../utils/utils.js";
import { initChessGame } from '../chess/chess.js';
import { initProfilePage } from "../users_friends/profilePage.js"
import { initLoginPage } from "../users_friends/loginPage.js"
import { registerPage } from "../users_friends/register.js"
import { initHome } from "../home/home.js"
import { initLegalPage } from "../legal/legal.js";

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

  export function setChessOnlineIntended(){
      chessOnlineIntended = true;
  }

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
  routes['/terms-of-service'] = async () => {
    stopTournamentAutoRefresh();
    await loadTemplate('terms-of-service');
    initLegalPage();
  };
  routes['/privacy-policy'] = async () => {
    stopTournamentAutoRefresh();
    await loadTemplate('privacy-policy');
    initLegalPage();
  };

  routes['/chess-online'] = async () => {
    stopTournamentAutoRefresh();
    if(await redirectIfNotLoggedIn())
      return;
    const params = new URLSearchParams(window.location.search);
    const inviteGameId = params.get('gameId') || null;
    //redirect to hub on refresh or direct URL access; only run the game when the
    //user explicitly clicked Online Game from the hub, or followed an invite link
    if (!chessOnlineIntended && !inviteGameId) {
      window.history.back();
      return;
    }
    chessOnlineIntended = false;
    // Strip gameId from URL so a refresh doesn't reconnect to the same game
    if (inviteGameId) {
      window.history.replaceState({}, '', '/chess-online');
    }
    await loadTemplate('chess-online');
    const { initOnlineChessGame } = await import('../chess/chess-online.js');
    initOnlineChessGame(inviteGameId);
  }

  routes['/chess'] = async () => {
    stopTournamentAutoRefresh();
    if(await redirectIfNotLoggedIn())
			return;
    await loadTemplate('chess');

    initChessGame();
  }


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

    // Load current user's match history and achievements
    fetchWithRefreshAuth('/api/auth/me')
      .then(r => r.json())
      .then(me => {
        fetchWithRefreshAuth('/api/match-history')
          .then(r => r.json())
          .then(data => {
            const tbody = document.getElementById('pong-history-table');
            if (!tbody) return;
            if (!data.matches || data.matches.length === 0) {
              tbody.innerHTML = '<tr><td colspan="4" class="text-gray-400 pt-1">No games yet.</td></tr>';
              return;
            }
            tbody.innerHTML = data.matches.slice(0, 10)
              .map(m => {
                const opponent = m.player1 === me.username ? m.player2 : m.player1;
                const myScore = m.player1 === me.username ? m.player1_score : m.player2_score;
                const oppScore = m.player1 === me.username ? m.player2_score : m.player1_score;
                const won = m.winner === me.username;
                const result = m.winner
                  ? (won ? '<span class="text-green-400">Win</span>' : '<span class="text-red-400">Loss</span>')
                  : '<span class="text-gray-400">-</span>';
                const date = new Date(m.timestamp).toLocaleDateString();
                return `<tr class="border-t border-white/10">
                  <td class="py-1 pr-2">${opponent}</td>
                  <td class="py-1 pr-2 font-semibold">${myScore}–${oppScore}</td>
                  <td class="py-1 pr-2">${result}</td>
                  <td class="py-1 text-gray-400">${date}</td>
                </tr>`;
              })
              .join('');
          })
          .catch(() => {
            const tbody = document.getElementById('pong-history-table');
            if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="text-gray-400">Could not load.</td></tr>';
          });

        return fetchWithRefreshAuth(`/api/player/${me.username}/achievements`);
      })
      .then(r => r.json())
      .then(data => {
        const list = document.getElementById('pong-achievements-list');
        if (!list) return;
        if (!data.achievements || data.achievements.length === 0) {
          list.innerHTML = '<li class="text-gray-400">No achievements yet.</li>';
          return;
        }
        list.innerHTML = data.achievements
          .map(a => `<li><b>${a.name}</b>: ${a.description}</li>`)
          .join('');
      })
      .catch(() => {
        const list = document.getElementById('pong-achievements-list');
        if (list) list.innerHTML = '<li class="text-gray-400">Could not load.</li>';
      });

    // Bottom table: latest 10 achievements across all players
    fetchWithRefreshAuth('/api/achievements')
      .then(r => r.json())
      .then(data => {
        const tbody = document.getElementById('pong-results-table');
        if (!tbody) return;
        if (!data.achievements || data.achievements.length === 0) {
          tbody.innerHTML = '<tr><td colspan="3" class="text-gray-400 pt-1">No achievements yet.</td></tr>';
          return;
        }
        tbody.innerHTML = data.achievements
          .map(a => {
            const date = new Date(a.timestamp).toLocaleDateString();
            return `<tr class="border-t border-white/10">
              <td class="py-1 pr-3 font-semibold">${a.player_name}</td>
              <td class="py-1 pr-3 text-orange-300">${a.achievement_name}</td>
              <td class="py-1 text-gray-400">${date}</td>
            </tr>`;
          })
          .join('');
      })
      .catch(() => {
        const tbody = document.getElementById('pong-results-table');
        if (tbody) tbody.innerHTML = '<tr><td colspan="3" class="text-gray-400">Could not load.</td></tr>';
      });

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

  routes['/stats'] = async () => {
    stopTournamentAutoRefresh();
    if (await redirectIfNotLoggedIn())
      return;

    await loadTemplate('stats');

    document.getElementById('stats-back-btn')?.addEventListener('click', () => navigate('/profile'));

    fetchWithRefreshAuth('/api/player/me/stats')
      .then(r => r.json())
      .then(data => {
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val ?? '-'; };
        set('stats-total-games', data.total_games);
        set('stats-wins', data.total_wins);
        set('stats-losses', data.total_losses);
        set('stats-elo', data.elo_rating);
      })
      .catch(() => {});

    fetchWithRefreshAuth('/api/leaderboard')
      .then(r => r.json())
      .then(data => {
        const tbody = document.getElementById('stats-leaderboard-table');
        if (!tbody) return;
        if (!data.leaderboard || data.leaderboard.length === 0) {
          tbody.innerHTML = '<tr><td colspan="5" class="text-zinc-500 pt-2">No data yet.</td></tr>';
          return;
        }
        tbody.innerHTML = data.leaderboard
          .map((p, i) => {
            const medal = i === 0 ? '#1' : i === 1 ? '#2' : i === 2 ? '#3' : `#${i + 1}`;
            return `<tr class="border-t border-zinc-700">
              <td class="py-1 pr-3">${medal}</td>
              <td class="py-1 pr-3 font-semibold">${p.username}</td>
              <td class="py-1 pr-3 text-violet-400">${p.elo_rating}</td>
              <td class="py-1 pr-3 text-green-400">${p.total_wins}</td>
              <td class="py-1 text-yellow-400">${p.current_win_streak}</td>
            </tr>`;
          })
          .join('');
      })
      .catch(() => {
        const tbody = document.getElementById('stats-leaderboard-table');
        if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-zinc-500">Could not load.</td></tr>';
      });

    fetchWithRefreshAuth('/api/auth/me')
      .then(r => r.json())
      .then(me => {
        fetchWithRefreshAuth('/api/match-history')
          .then(r => r.json())
          .then(data => {
            const tbody = document.getElementById('stats-history-table');
            if (!tbody) return;
            if (!data.matches || data.matches.length === 0) {
              tbody.innerHTML = '<tr><td colspan="4" class="text-zinc-500 pt-2">No games yet.</td></tr>';
              return;
            }
            tbody.innerHTML = data.matches.slice(0, 20)
              .map(m => {
                const opponent = m.player1 === me.username ? m.player2 : m.player1;
                const myScore = m.player1 === me.username ? m.player1_score : m.player2_score;
                const oppScore = m.player1 === me.username ? m.player2_score : m.player1_score;
                const won = m.winner === me.username;
                const result = m.winner
                  ? (won ? '<span class="text-green-400">Win</span>' : '<span class="text-red-400">Loss</span>')
                  : '<span class="text-zinc-400">-</span>';
                const date = new Date(m.timestamp).toLocaleDateString();
                return `<tr class="border-t border-zinc-700">
                  <td class="py-1 pr-3">${opponent}</td>
                  <td class="py-1 pr-3 font-semibold">${myScore}-${oppScore}</td>
                  <td class="py-1 pr-3">${result}</td>
                  <td class="py-1 text-zinc-400">${date}</td>
                </tr>`;
              })
              .join('');
          })
          .catch(() => {
            const tbody = document.getElementById('stats-history-table');
            if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="text-zinc-500">Could not load.</td></tr>';
          });

        fetchWithRefreshAuth(`/api/player/${me.username}/achievements`)
          .then(r => r.json())
          .then(data => {
            const list = document.getElementById('stats-achievements-list');
            if (!list) return;
            if (!data.achievements || data.achievements.length === 0) {
              list.innerHTML = '<li class="text-zinc-500">No achievements yet.</li>';
              return;
            }
            list.innerHTML = data.achievements
              .map(a => `<li><b>${a.name}</b>: ${a.description}</li>`)
              .join('');
          })
          .catch(() => {
            const list = document.getElementById('stats-achievements-list');
            if (list) list.innerHTML = '<li class="text-zinc-500">Could not load.</li>';
          });
      })
      .catch(() => {});
  };

  routes['/tournament/:tournamentId'] = async (tournamentId) => {
    stopTournamentAutoRefresh();
    if(await redirectIfNotLoggedIn())
			return;
    
    await loadTemplate('tournament-games');
    
    // Store tournament ID for use in callbacks
    window.currentTournamentId = tournamentId;
    resetTournamentTimers();
    
    document.getElementById('backBtn')?.addEventListener('click', () => navigate('/tournament'));
    
    // Load tournament games and leaderboard
    await loadTournamentGames();

    startTournamentUpdatesSocket(tournamentId, async (data) => {
      if (!window.location.pathname.match(/^\/tournament\/\d+$/)) {
        return;
      }
      await handleTournamentSocketEvent(data);
    });

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
    }, 10000);
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
