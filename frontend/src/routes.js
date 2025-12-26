import { routes, navigate, joinGame, startTournament, initOfflineGame } from './main.js';
import { Engine, Scene } from "@babylonjs/core";
import { initGameScene } from "./game.js";

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
    await loadTemplate('tournament');
    document.getElementById('backBtn')?.addEventListener('click', () => navigate('/'));
    document.getElementById('startTournamentBtn')?.addEventListener('click', () => {
      const countEl = document.getElementById('tournamentPlayerCount');
      const count = parseInt(countEl.value);
      if (count >= 2) startTournament(count);
      else alert('Need at least 2 players');
    });
  };

  routes['/online'] = async () => {
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
          gameBtn.addEventListener('click', () => joinGame(game.id));
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
}
