import { routes } from '../main.js';
import { initAIGame } from '../pong/ai/ai.js';
import { navigate } from "./route_helpers.js";
import { joinOnlineGame } from '../pong/game/game.js';
import { initOfflineGame } from '../pong/game/local_game.js';
import { startLocalTournament } from '../pong/tournament/local_tournament.js';
import { Engine, Scene } from "@babylonjs/core";
import { initGameScene } from "../pong/game/game.js";
import { checkAuthRequired, fetchWithRefreshAuth } from '../users_friends/usermanagement.js';
import { updatePageTranslations, t } from '../i18n/index.js';
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
    if (await redirectIfNotLoggedIn())
			return;
    const params = new URLSearchParams(window.location.search);
    const gameId = params.get('gameId');
    if (gameId){
      window.history.replaceState({}, '', '/online');
      joinOnlineGame(gameId, false);
      return;
    }
    navigate('/');
  };

  routes['/profile'] = async () => {
    stopTournamentAutoRefresh();
    if(await redirectIfNotLoggedIn())
      return;
    await loadTemplate('profile');
    await initProfilePage();

  };

  routes['/profile/:username'] = async (username) => {
    stopTournamentAutoRefresh();
    if(await redirectIfNotLoggedIn())
      return;
    await loadTemplate('profile');
    await initProfilePage(username);
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
          tbody.innerHTML = `<tr><td colspan="5" class="text-zinc-500 pt-2">${t('STATS_NO_DATA')}</td></tr>`;
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
        if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="text-zinc-500">${t('STATS_COULD_NOT_LOAD')}</td></tr>`;
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
              tbody.innerHTML = `<tr><td colspan="4" class="text-zinc-500 pt-2">${t('STATS_NO_GAMES')}</td></tr>`;
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
            if (tbody) tbody.innerHTML = `<tr><td colspan="4" class="text-zinc-500">${t('STATS_COULD_NOT_LOAD')}</td></tr>`;
          });

        fetchWithRefreshAuth(`/api/player/${me.username}/achievements`)
          .then(r => r.json())
          .then(data => {
            const list = document.getElementById('stats-achievements-list');
            if (!list) return;
            if (!data.achievements || data.achievements.length === 0) {
              list.innerHTML = `<li class="text-zinc-500">${t('STATS_NO_ACHIEVEMENTS')}</li>`;
              return;
            }
            list.innerHTML = data.achievements
              .map(a => `<li><b>${a.name}</b>: ${a.description}</li>`)
              .join('');
          })
          .catch(() => {
            const list = document.getElementById('stats-achievements-list');
            if (list) list.innerHTML = `<li class="text-zinc-500">${t('STATS_COULD_NOT_LOAD')}</li>`;
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

export function handleProfileRoute(path) {
  const match = path.match(/^\/profile\/([^\/]+)$/);
  if (match) {
    const username = match[1];
    const handler = routes['/profile/:username'];
    if (handler) {
      handler(username);
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
