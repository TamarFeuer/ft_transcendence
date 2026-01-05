import { routes, navigate, joinOnlineGame, startTournament, initOfflineGame } from './main.js';
import { Engine, Scene } from "@babylonjs/core";
import { initGameScene } from "./game.js";
import bgImage from '../assets/background.jpg';
import { checkAuthRequired, getCurrentUser } from './usermanagement.js';
import * as tournamentAPI from './tournament.js';

// async function loadTemplate(name) {
//   const url = `/routes/${name}.html`;
//   const res = await fetch(url);
//   const html = await res.text();
//   document.body.innerHTML = html;
// }

async function loadTemplate(name) {
  const url = `/routes/${name}.html`;
  const res = await fetch(url);
  const html = await res.text();

  const appRoot = document.getElementById("app-root");
  appRoot.innerHTML = html;
}

export function setupRoutes() {
  routes['/'] = async () => {
    await loadTemplate('home');
    document.getElementById('tttBtn')?.addEventListener('click', () => navigate('/ttt'));
    document.getElementById('mineBtn')?.addEventListener('click', () => navigate('/mine'));
    document.getElementById('pongBtn')?.addEventListener('click', () => navigate('/pong'));
    
  };


  routes['/pong'] = async () => {
    await loadTemplate('pong');
    document.getElementById('localBtn')?.addEventListener('click', () => navigate('/local'));
    document.getElementById('onlineBtn')?.addEventListener('click', () => navigate('/online'));
    document.getElementById('tournamentBtn')?.addEventListener('click', () => navigate('/tournament'));


  };

  routes['/local'] = async () => {
    await loadTemplate('local');
    const canvas = document.getElementById("renderCanvas");
    const engine = new Engine(canvas, true);
    const scene = new Scene(engine);
    const gameObjects = initGameScene(scene, canvas, 2);
    initOfflineGame(scene, gameObjects, false);
    engine.runRenderLoop(() => scene.render());
    window.addEventListener("resize", () => engine.resize());
  };

  routes['/tournament'] = async () => {
    if (await checkAuthRequired() == true) {
      alert('You need to be logged in to access tournaments.');
      navigate('/');
      return;
    }
    
    await loadTemplate('tournament');
    
    // Get current user for checking if they're tournament creator
    const currentUser = await getCurrentUser();
    let currentUsername = currentUser.username || localStorage.getItem('username');
    
    // Load tournaments on page load
    await loadAllTournaments();
    
    // Back button
    document.getElementById('backBtn')?.addEventListener('click', () => navigate('/pong'));
    
    // Create tournament button
    document.getElementById('createTournamentBtn')?.addEventListener('click', async () => {
      const name = document.getElementById('tournamentName').value.trim();
      const description = document.getElementById('tournamentDescription').value.trim();
      const maxPlayers = parseInt(document.getElementById('tournamentMaxPlayers').value);
      
      if (!name) {
        showStatus('createStatus', 'Tournament name is required', 'error');
        return;
      }
      
      showStatus('createStatus', 'Creating tournament...', 'info');
      const result = await tournamentAPI.createTournament(name, description, maxPlayers);
      
      if (result.ok) {
        showStatus('createStatus', 'Tournament created successfully!', 'success');
        // Clear form
        document.getElementById('tournamentName').value = '';
        document.getElementById('tournamentDescription').value = '';
        // Refresh lists
        setTimeout(() => loadAllTournaments(), 500);
      } else {
        showStatus('createStatus', result.data?.error || 'Failed to create tournament', 'error');
      }
    });
    
    // Refresh button
    document.getElementById('refreshTournamentsBtn')?.addEventListener('click', () => {
      loadAllTournaments();
    });
    
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
    
    // Load all tournament lists
    async function loadAllTournaments() {
      await loadRegistrationTournaments();
      await loadOngoingTournaments();
      await loadUpcomingTournaments();
      await loadCompletedTournaments();
    }
    
    // Load tournaments open for registration
    async function loadRegistrationTournaments() {
      const result = await tournamentAPI.listRegistrationTournaments();
      const listEl = document.getElementById('tournamentsList');
      
      if (!result.ok || !result.data || result.data.length === 0) {
        listEl.innerHTML = '<p class="text-gray-400">No tournaments available for registration.</p>';
        return;
      }
      
      listEl.innerHTML = '';
      result.data.forEach(tournament => {
        const tournamentDiv = document.createElement('div');
        tournamentDiv.className = 'bg-gray-800 rounded-lg p-4 border border-gray-700';
        
        const isCreator = tournament.creator_username === currentUsername;
        const isFull = tournament.participant_count >= tournament.max_players;
        
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
              ${!isCreator && !isFull ? `
                <button class="join-btn px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-semibold" data-id="${tournament.id}">
                  Join
                </button>
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
        
        listEl.appendChild(tournamentDiv);
      });
      
      // Add event listeners for join/start/cancel buttons
      listEl.querySelectorAll('.join-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const tournamentId = e.target.dataset.id;
          btn.disabled = true;
          btn.textContent = 'Joining...';
          
          const result = await tournamentAPI.joinTournament(tournamentId);
          if (result.ok) {
            alert('Joined tournament successfully!');
            loadAllTournaments();
          } else {
            alert(result.data?.error || 'Failed to join tournament');
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
          if (result.ok) {
            alert('Tournament started!');
            loadAllTournaments();
          } else {
            alert(result.data?.error || 'Failed to start tournament');
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
            alert('Tournament cancelled');
            loadAllTournaments();
          } else {
            alert(result.data?.error || 'Failed to cancel tournament');
            btn.disabled = false;
            btn.textContent = 'Cancel';
          }
        });
      });
    }
    
    // Load user's ongoing tournaments
    async function loadOngoingTournaments() {
      const result = await tournamentAPI.listOngoingTournaments();
      const listEl = document.getElementById('ongoingTournaments');
      
      if (!result.ok || !result.data || result.data.length === 0) {
        listEl.innerHTML = '<p class="text-gray-400 text-sm">None</p>';
        return;
      }
      
      listEl.innerHTML = '';
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
        listEl.appendChild(div);
      });
      
      // Add event listeners
      listEl.querySelectorAll('.view-games-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const tournamentId = e.target.dataset.tournamentId;
          navigate(`/tournament/${tournamentId}`);
        });
      });
    }
    
    // Load user's upcoming tournaments
    async function loadUpcomingTournaments() {
      const result = await tournamentAPI.listUpcomingTournaments();
      const listEl = document.getElementById('upcomingTournaments');
      
      if (!result.ok || !result.data || result.data.length === 0) {
        listEl.innerHTML = '<p class="text-gray-400 text-sm">None</p>';
        return;
      }
      
      listEl.innerHTML = '';
      result.data.forEach(tournament => {
        const div = document.createElement('div');
        div.className = 'bg-gray-800 rounded p-2 text-sm';
        div.innerHTML = `
          <div class="text-white font-semibold">${tournament.name}</div>
          <div class="text-gray-400 text-xs">👤 ${tournament.participant_count} players</div>
        `;
        listEl.appendChild(div);
      });
    }
    
    // Load user's completed tournaments
    async function loadCompletedTournaments() {
      const result = await tournamentAPI.listCompletedTournaments();
      const listEl = document.getElementById('completedTournaments');
      
      if (!result.ok || !result.data || result.data.length === 0) {
        listEl.innerHTML = '<p class="text-gray-400 text-sm">None</p>';
        return;
      }
      
      listEl.innerHTML = '';
      result.data.forEach(tournament => {
        const div = document.createElement('div');
        div.className = 'bg-gray-800 rounded p-2 text-sm';
        div.innerHTML = `
          <div class="text-white font-semibold">${tournament.name}</div>
          <div class="text-gray-400 text-xs">👤 ${tournament.participant_count} players</div>
        `;
        listEl.appendChild(div);
      });
    }
  };

  routes['/online'] = async () => {
    if (await checkAuthRequired() == true)
      {
      alert('You need to be logged in to access online games.');
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
        alert('Failed to create game. Please try again.');
      }
    });
  };

  routes['/tournament/:tournamentId'] = async (tournamentId) => {
    if (await checkAuthRequired() == true) {
      alert('You need to be logged in to access tournaments.');
      navigate('/tournament');
      return;
    }
    
    await loadTemplate('tournament-games');
    
    // Store tournament ID for use in callbacks
    window.currentTournamentId = tournamentId;
    
    document.getElementById('backBtn')?.addEventListener('click', () => navigate('/tournament'));
    
    // Load tournament games and leaderboard
    await loadTournamentGames();
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

async function loadTournamentGames() {
  const tournamentId = window.currentTournamentId;
  
  // Load leaderboard
  const leaderboardResult = await tournamentAPI.getTournamentLeaderboard(tournamentId);
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
  
  // Load user's ready games
  const readyResult = await tournamentAPI.getTournamentUserReadyGames(tournamentId);
  if (readyResult.ok && readyResult.data && readyResult.data.length > 0) {
    const listEl = document.getElementById('readyGamesList');
    listEl.innerHTML = '';
    readyResult.data.forEach(game => {
      const gameDiv = document.createElement('div');
      gameDiv.className = 'bg-gray-800 rounded-lg p-4 border border-blue-500';
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
      listEl.appendChild(gameDiv);
    });
    
    // Add event listeners for starting games
    listEl.querySelectorAll('.start-game-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const gameId = e.target.dataset.gameId;
        btn.disabled = true;
        btn.textContent = 'Starting...';
        
        const result = await tournamentAPI.startTournamentGame(gameId);
        if (result.ok) {
          alert(`Game started! Game ID: ${result.data.game_id}`);
          // Redirect to the game
          joinOnlineGame(result.data.game_id, true);

          // window.location.href = `/online?gameId=${result.data.game_id}`;
        } else {
          alert(result.data?.error || 'Failed to start game');
          btn.disabled = false;
          btn.textContent = 'Start Game';
        }
      });
    });
  } else {
    document.getElementById('readyGamesList').innerHTML = '<p class="text-gray-400">No ready games for you.</p>';
  }
  
  // Load all games
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
