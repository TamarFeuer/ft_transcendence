import "./styles.css";
import { Engine, Scene } from "@babylonjs/core";
import { initGameScene } from "./game";

let ws: WebSocket | null = null;
let currentGameId: string | null = null;

// Simple client-side router
type RouteHandler = () => void;
const routes: Record<string, RouteHandler> = {};

function navigate(path: string) {
  window.history.pushState({}, path, window.location.origin + path);
  handleRoute(path);
}

function handleRoute(path: string) {
  const handler = routes[path];
  if (handler) {
    handler();
  } else {
    routes['/']?.(); // fallback to home
  }
}

window.addEventListener('popstate', () => {
  handleRoute(window.location.pathname);
});

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

// Route: Online Game
routes['/online'] = () => {
  document.body.innerHTML = `
    <div id="menuOverlay" class="menu-overlay">
      <h1>Online Game</h1>
      <div id="lobbyStatus">
        <p>Waiting for game...</p>
        <button id="createGameBtn" class="menu-btn">Create Game</button>
        <button id="backBtn" class="menu-btn">Back</button>
        # list of available games to join could go here
        <div id="availableGames"></div>
        <div id="refreshGamesContainer">
          <button id="refreshGamesBtn" class="menu-btn">Refresh Games</button>
        </div>
      </div>
      <div id="gameContainer" style="display: none;">
        <canvas id="renderCanvas"></canvas>
        <div id="scoreHud" class="score-hud">
          <div>Player 1: <span id="scoreP1">0</span></div>
          <div>Player 2: <span id="scoreP2">0</span></div>
        </div>
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
      currentGameId = data.gameId;
      
      document.getElementById('lobbyStatus')!.innerHTML = `
        <p>Game ID: ${data.gameId}</p>
        <p>Waiting for opponent...</p>
        <button id="joinGameBtn" class="menu-btn">Join as Player 2</button>
        <button id="backBtn" class="menu-btn">Cancel</button>
      `;

      document.getElementById('joinGameBtn')!.addEventListener('click', () => {
        joinGame(currentGameId!);
      });

      document.getElementById('backBtn')!.addEventListener('click', () => {
        navigate('/');
      });

      // Auto-join as player 1
      // joinGame(currentGameId);
    } catch (error) {
      console.error('Failed to create game:', error);
      alert('Failed to create game. Please try again.');
    }
  });
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

// WebSocket connection for online games
function joinGame(gameId: string) {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  ws = new WebSocket(`${proto}//${location.host}/ws?gameId=${gameId}`);

  ws.onopen = () => {
    console.log("WS connected to game:", gameId);
  };

  ws.onerror = (e) => console.error("WS error", e);

  ws.onmessage = (ev) => {
    try {
      const data = JSON.parse(ev.data);
      console.log("WS message", data);

      if (data.type === "gameStart") {
        // Game is starting, show canvas
        document.getElementById('menuOverlay')!.style.display = 'none';
        document.getElementById('gameContainer')!.style.display = 'block';

        const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
        const engine = new Engine(canvas, true);
        const scene = new Scene(engine);
        const gameObjects = initGameScene(scene, canvas, 2);

        engine.runRenderLoop(() => scene.render());
        window.addEventListener("resize", () => engine.resize());

        // Set up input
        window.addEventListener("pointermove", (e) => {
          const normalized = 1 - (e.clientY / window.innerHeight);
          const mapped = (normalized - 0.5) * 2;
          ws?.send(JSON.stringify({ type: "paddleMove", y: mapped }));
        });

        const keys: Record<string, boolean> = {};
        window.addEventListener("keydown", (e) => keys[e.key] = true);
        window.addEventListener("keyup", (e) => keys[e.key] = false);
        setInterval(() => {
          if (keys['w'] || keys['s']) {
            let y = 0;
            if (keys['w']) y = 1;
            if (keys['s']) y = -1;
            ws?.send(JSON.stringify({ type: "paddleMove", y }));
          }
        }, 1000 / 15);
      }

      if (data.type === "state") {
        const { ball, paddles, score } = data;
        const gameObjects = (window as any).gameObjects;
        if (gameObjects) {
          gameObjects.ball.position.x = ball.x;
          gameObjects.ball.position.y = ball.y;
          gameObjects.paddleLeft.position.y = paddles.left;
          gameObjects.paddleRight.position.y = paddles.right;
        }
        const scoreP1 = document.getElementById("scoreP1");
        const scoreP2 = document.getElementById("scoreP2");
        if (scoreP1) scoreP1.textContent = String(score.p1);
        if (scoreP2) scoreP2.textContent = String(score.p2);
      }

      if (data.type === "assign") {
        console.log("Assigned role:", data.role);
      }

      if (data.type === "gameOver") {
        alert(`${data.winner} wins!`);
        navigate('/');
      }
    } catch (e) {
      console.error("Failed to parse message:", e);
    }
  };

  ws.onclose = () => {
    console.log("WS disconnected");
  };
}

// Offline game logic
function initOfflineGame(scene: Scene, gameObjects: any, tournament: boolean): Promise<void> {
  return new Promise((resolve) => {
    let ballVX = 0.07;
    let ballVY = 0.07;
    let scoreP1int = 0;
    let scoreP2int = 0;

    const scoreP1 = document.getElementById("scoreP1")!;
    const scoreP2 = document.getElementById("scoreP2")!;
    scoreP1.textContent = "0";
    scoreP2.textContent = "0";

    const keys: Record<string, boolean> = {};
    window.addEventListener("keydown", (e) => keys[e.key] = true);
    window.addEventListener("keyup", (e) => keys[e.key] = false);

    setInterval(() => {
      if (keys['w'] || keys['s']) {
        let y = 0;
        if (keys['w']) y = 0.8;
        if (keys['s']) y = -0.8;
        gameObjects.paddleLeft.position.y += y;
      }
      if (keys['ArrowUp'] || keys['ArrowDown']) {
        let y = 0;
        if (keys['ArrowUp']) y = 0.8;
        if (keys['ArrowDown']) y = -0.8;
        gameObjects.paddleRight.position.y += y;
      }
    }, 1000 / 15);

    const renderObserver = scene.onBeforeRenderObservable.add(() => {
      gameObjects.ball.position.x += ballVX;
      gameObjects.ball.position.y += ballVY;
      ballVX *= 1.00005;
      ballVY *= 1.00005;

      if (gameObjects.ball.position.y > 5 || gameObjects.ball.position.y < -5) {
        ballVY = -ballVY;
      }

      if (gameObjects.ball.position.x < gameObjects.paddleLeft.position.x + 0.25 &&
          gameObjects.ball.position.x > gameObjects.paddleLeft.position.x &&
          Math.abs(gameObjects.ball.position.y - gameObjects.paddleLeft.position.y) < 0.75) {
        ballVX = -ballVX;
      }
      if (gameObjects.ball.position.x > gameObjects.paddleRight.position.x - 0.25 &&
          gameObjects.ball.position.x < gameObjects.paddleRight.position.x &&
          Math.abs(gameObjects.ball.position.y - gameObjects.paddleRight.position.y) < 0.75) {
        ballVX = -ballVX;
      }

      if (gameObjects.ball.position.x < -6) {
        scoreP2int++;
        scoreP2.textContent = scoreP2int.toString();
        gameObjects.ball.position.x = 0;
        gameObjects.ball.position.y = 0;
      } else if (gameObjects.ball.position.x > 6) {
        scoreP1int++;
        scoreP1.textContent = scoreP1int.toString();
        gameObjects.ball.position.x = 0;
        gameObjects.ball.position.y = 0;
      }

      if (scoreP1int >= 10) {
        scene.onBeforeRenderObservable.remove(renderObserver);
        if (!tournament) {
          alert("Player 1 wins!");
          navigate('/');
        }
        resolve();
      } else if (scoreP2int >= 10) {
        scene.onBeforeRenderObservable.remove(renderObserver);
        if (!tournament) {
          alert("Player 2 wins!");
          navigate('/');
        }
        resolve();
      }
    });
  });
}

async function startTournament(playerCount: number) {
  const players: string[] = [];
  for (let i = 0; i < playerCount; i++) {
    const name = prompt(`Enter name for Player ${i + 1}:`) || `Player ${i + 1}`;
    players.push(name);
  }

  const schedule: [number, number][] = [];
  for (let i = 0; i < playerCount; i++) {
    for (let j = i + 1; j < playerCount; j++) {
      schedule.push([i, j]);
    }
  }

  const scores = new Array(playerCount).fill(0);

  for (const [i, j] of schedule) {
    alert(`Match: ${players[i]} vs ${players[j]}`);
    
    document.body.innerHTML = `
      <div id="gameContainer">
        <canvas id="renderCanvas"></canvas>
        <div id="scoreHud" class="score-hud">
          <div>${players[i]}: <span id="scoreP1">0</span></div>
          <div>${players[j]}: <span id="scoreP2">0</span></div>
        </div>
      </div>
    `;

    const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
    const engine = new Engine(canvas, true);
    const scene = new Scene(engine);
    const gameObjects = initGameScene(scene, canvas, 2);

    engine.runRenderLoop(() => scene.render());
    
    await initOfflineGame(scene, gameObjects, true);
    
    const p1Score = parseInt(document.getElementById("scoreP1")!.textContent || "0");
    const p2Score = parseInt(document.getElementById("scoreP2")!.textContent || "0");
    
    if (p1Score > p2Score) scores[i]++;
    else scores[j]++;

    engine.dispose();
  }

  let winner = 0;
  for (let i = 1; i < playerCount; i++) {
    if (scores[i] > scores[winner]) winner = i;
  }

  alert(`Tournament Winner: ${players[winner]} with ${scores[winner]} wins!`);
  navigate('/');
}

// Initialize on load
window.addEventListener("DOMContentLoaded", () => {
  handleRoute(window.location.pathname);
});