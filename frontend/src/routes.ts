import { routes, navigate } from './main';
import { joinGame, startTournament, initOfflineGame } from './main';
import { Engine, Scene } from "@babylonjs/core";
import { initGameScene } from "./game";

// Route: Home/Menu
routes['/'] = () => {
  document.body.innerHTML = `
    <div id="menuOverlay" class="menu-overlay">
      <h1>Pong Game</h1>
      <div class="menu-buttons">
        <button id="tttBtn" class="menu-btn">Tic-Tac-Toe</button>
        <button id="mineBtn" class="menu-btn">Minesweeper</button>
        <button id="pongBtn" class="menu-btn">Pong</button>
      </div>
    </div>
  `;

  document.getElementById('tttBtn')!.addEventListener('click', () => {
    navigate('/ttt');
  });

  document.getElementById('mineBtn')!.addEventListener('click', () => {
    navigate('/mine');
  });

  document.getElementById('pongBtn')!.addEventListener('click', () => {
    navigate('/pong');
  });
};

// Route: Home/Menu
routes['/pong'] = () => {
  document.body.innerHTML = `
    <div id="menuOverlay" class="menu-overlay">
      <h1>Pong Game</h1>
      <div class="menu-buttons">
        <button id="localBtn" class="menu-btn">Local Game</button>
        <button id="onlineBtn" class="menu-btn">Online Game</button>
        <button id="tournamentBtn" class="menu-btn">Local Tournament</button>
      </div>
    </div>
  `;

  document.getElementById('localBtn')!.addEventListener('click', () => {
    navigate('/local');
  });

  document.getElementById('onlineBtn')!.addEventListener('click', () => {
    navigate('/online');
  });

  document.getElementById('tournamentBtn')!.addEventListener('click', () => {
    navigate('/tournament');
  });
};

// Route: Local Game
routes['/local'] = () => {
  document.body.innerHTML = `
    <div id="gameContainer">
      <canvas id="renderCanvas"></canvas>
      <div id="scoreHud" class="score-hud">
        <div>Player 1: <span id="scoreP1">0</span></div>
        <div>Player 2: <span id="scoreP2">0</span></div>
      </div>
    </div>
  `;

  const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
  const engine = new Engine(canvas, true);
  const scene = new Scene(engine);
  const gameObjects = initGameScene(scene, canvas, 2);

  initOfflineGame(scene, gameObjects, false);

  engine.runRenderLoop(() => scene.render());
  window.addEventListener("resize", () => engine.resize());
};

// Route: Tournament
routes['/tournament'] = () => {
  document.body.innerHTML = `
    <div id="menuOverlay" class="menu-overlay">
      <h1>Tournament</h1>
      <div class="menu-buttons">
        <input type="number" id="tournamentPlayerCount" min="2" value="4" placeholder="Number of players">
        <button id="startTournamentBtn" class="menu-btn">Start Tournament</button>
        <button id="backBtn" class="menu-btn">Back</button>
      </div>
      <div id="tournamentStatus" style="margin-top: 20px;"></div>
    </div>
  `;

  document.getElementById('backBtn')!.addEventListener('click', () => {
    navigate('/');
  });

  document.getElementById('startTournamentBtn')!.addEventListener('click', () => {
    const count = parseInt((document.getElementById('tournamentPlayerCount') as HTMLInputElement).value);
    if (count >= 2) {
      startTournament(count);
    } else {
      alert('Need at least 2 players');
    }
  });
};

// Route: Online Game
routes['/online'] = () => {
  document.body.innerHTML = `
    <div id="menuOverlay" class="menu-overlay">
      <h1>Online Game</h1>
      <div id="lobbyStatus"></div>
        <p>Waiting for game...</p>
        <button id="createGameBtn" class="menu-btn">Create Game</button>
        <button id="backBtn" class="menu-btn">Back</button>
        # list of available games to join could go here
        <div id="availableGames"></div>
        <div id="refreshGamesContainer">
          <button id="refreshGamesBtn" class="menu-btn">Refresh Games</button>
        </div>
    </div>
  `;

  document.getElementById('backBtn')!.addEventListener('click', () => {
    navigate('/');
  });

  document.getElementById('refreshGamesBtn')!.addEventListener('click', async () => {
      const response = await fetch('/api/games', {
        method: 'GET',
      });
      const data = await response.json();
      const availableGamesDiv = document.getElementById('availableGames')!;
      availableGamesDiv.innerHTML = '<h3>Available Games:</h3>';
      if (data.games.length === 0) {
        availableGamesDiv.innerHTML += '<p>No available games.</p>';
      } else {
        data.games.forEach((game: any) => {
          const gameBtn = document.createElement('button');
          gameBtn.textContent = `Join Game ${game.id}`;
          gameBtn.className = 'menu-btn';
          gameBtn.addEventListener('click', () => {
            joinGame(game.id);
          });
          const gameStatusDiv = document.createElement('gameStatus')!;
          gameStatusDiv.innerHTML = `<p>Status: ${game.status}</p>`;
          availableGamesDiv.appendChild(gameBtn);
          availableGamesDiv.appendChild(gameStatusDiv);
        });
      }
  });

  document.getElementById('createGameBtn')!.addEventListener('click', async () => {
    try {
      const response = await fetch('/api/game/create', {
        method: 'POST',
        // headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      
      document.getElementById('lobbyStatus')!.innerHTML = `
        <p>Game ID: ${data.gameId}</p>
        <p>Game created...</p>
      `;

    } catch (error) {
      console.error('Failed to create game:', error);
      document.getElementById('lobbyStatus')!.innerHTML = `<p style="color: red;">Failed to create game. Please try again.</p>`;
      alert('Failed to create game. Please try again.');
    }
  });
};