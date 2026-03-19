import {
  ArcRotateCamera,
  HemisphericLight,
  StandardMaterial,
  Color3,
  MeshBuilder,
  Vector3,
  Texture,
  DynamicTexture
} from "@babylonjs/core";

import { updateTournamentGameResult } from "./tournament.js";
import "./styles.css";
import { Engine, Scene } from "@babylonjs/core";

// Close WebSocket before navigation
export function closeGameConnection() {
	if (ws) {
		console.log('Closing WebSocket connection');
		isGameActive = false;
		ws.close();
		ws = null;
	}
}

export function initGameScene(scene, canvas, playerCount) {
  const camera = new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.4, 12, new Vector3(0, 0, 0), scene);
  camera.attachControl(canvas, true);
  camera.inputs.clear();
  console.log("Player count:", playerCount);
  new HemisphericLight("light", new Vector3(0, 1, 0), scene);

  const paddleMat = new StandardMaterial("paddleMat", scene);
  paddleMat.diffuseColor = new Color3(0.3, 0.6, 1);

  // Create striped ball texture for visible spin
  const ballMat = new StandardMaterial("ballMat", scene);
  const dynamicTexture = new DynamicTexture("ballTexture", 512, scene);
  const ctx = dynamicTexture.getContext();
  
  // Draw orange base
  ctx.fillStyle = "#FF6633";
  ctx.fillRect(0, 0, 512, 512);
  
  // Draw black vertical stripes
  ctx.fillStyle = "#000000";
  for (let i = 0; i < 512; i += 64) {
    ctx.fillRect(i, 0, 32, 512);
  }
  
  dynamicTexture.update();
  ballMat.diffuseTexture = dynamicTexture;

  const paddleLeft = MeshBuilder.CreateBox("paddleLeft", { height: 1.5, width: 0.25, depth: 0.2 }, scene);
  paddleLeft.material = paddleMat;
  paddleLeft.position = new Vector3(-4, 0, 0);

  const paddleRight = MeshBuilder.CreateBox("paddleRight", { height: 1.5, width: 0.25, depth: 0.2 }, scene);
  paddleRight.material = paddleMat;
  paddleRight.position = new Vector3(4, 0, 0);

  const ball = MeshBuilder.CreateSphere("ball", { diameter: 0.3 }, scene);
  ball.material = ballMat;
  ball.position = new Vector3(0, 0, 0);

  const temperature = 5.0; // Initial temperature for AI paddle

  return { paddleLeft, paddleRight, ball, temperature };
}

export function joinOnlineGame(gameId, IsTournament) {
  // Store game context in session storage for refresh recovery
  sessionStorage.setItem('activeGameId', gameId);
  if (IsTournament) {
    sessionStorage.setItem('activeTournamentId', window.currentTournamentId);
  }
  const currentUserId = String(window.CURRENT_USER?.user_id ?? '');
  const currentUsername = window.CURRENT_USER?.username || 'Player';
  const canvas = document.getElementById("renderCanvas");
  const engine = new Engine(canvas, true);
  const scene = new Scene(engine);
  let pointerHandler = null;
  let keyboardInterval = null;
  let keyDownHandler = null;
  let keyUpHandler = null;
  let gameEnded = false;

  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  // Cookies are automatically sent with WebSocket connections
  // Connect to backend on port 3000 (not vite dev server on 5173)
  const wsHost = import.meta.env.DEV ? 'localhost:3000' : location.host;

  console.log("DEV import:", import.meta.env.DEV);
  console.log("WS Host:", wsHost);
  console.log("location.host:", location.host);

  const url = `${proto}//${location.host}/ws/${gameId}`;
  ws = new WebSocket(url);

  ws.onopen = () => {
    console.log("WS connected to game:", gameId);
    isGameActive = true;
    currentGameId = gameId;

    const appRoot = document.getElementById("app-root");
  

    appRoot.innerHTML = `
    <div id="gameContainer">
      <canvas id="renderCanvas"></canvas>
      <div class="absolute inset-0 flex justify-between items-start pt-32 px-8 z-20 pointer-events-none">
        <div class="flex flex-col items-start">
          <div id="playerNameleft" class="text-white font-bold text-lg tracking-wide">~</div>
          <div id="scoreP1" class="font-mono font-bold text-6xl text-green-400 drop-shadow-lg" style="text-shadow: 0 0 10px rgba(74, 222, 128, 0.8);">0</div>
        </div>
        <div class="flex flex-col items-end">
          <div id="playerNameright" class="text-white font-bold text-lg tracking-wide">~</div>
          <div id="scoreP2" class="font-mono font-bold text-6xl text-green-400 drop-shadow-lg" style="text-shadow: 0 0 10px rgba(74, 222, 128, 0.8);">0</div>
        </div>
      </div>
    </div>
    `;

    // window.gameObjects = initGameScene(scene, canvas, 2);

    // engine.runRenderLoop(() => scene.render());

  };

  ws.onerror = (e) => console.error("WS error", e);

  ws.onmessage = async (ev) => {
    try {
      const data = JSON.parse(ev.data);
      console.log("WS message", data);

      if (data.type === "gameStart") {
        const appRoot = document.getElementById("app-root");

        appRoot.innerHTML = `
        <div id="gameContainer">
          <canvas id="renderCanvas"></canvas>
          <div class="absolute inset-0 flex justify-between items-start pt-32 px-8 z-20 pointer-events-none">
            <div class="flex flex-col items-start">
              <div id="playerNameleft" class="text-white font-bold text-lg tracking-wide">${data.P1}</div>
              <div id="scoreP1" class="font-mono font-bold text-6xl text-green-400 drop-shadow-lg" style="text-shadow: 0 0 10px rgba(74, 222, 128, 0.8);">0</div>
            </div>
            <div class="flex flex-col items-end">
              <div id="playerNameright" class="text-white font-bold text-lg tracking-wide">${data.P2}</div>
              <div id="scoreP2" class="font-mono font-bold text-6xl text-green-400 drop-shadow-lg" style="text-shadow: 0 0 10px rgba(74, 222, 128, 0.8);">0</div>
            </div>
          </div>
        </div>
        `;

        window.gameObjects = initGameScene(scene, canvas, 2);

        engine.runRenderLoop(() => scene.render());
        window.addEventListener("resize", () => engine.resize());

        // Paddle movement with mouse
        pointerHandler = (e) => {
          const normalized = 1 - (e.clientY / window.innerHeight);
          const mapped = (normalized - 0.5) * 2;
          ws?.send(JSON.stringify({ type: "paddleMove", y: mapped }));
        };
        window.addEventListener("pointermove", pointerHandler);

        // Paddle movement with keyboard
        const keys = {};

        keyDownHandler = (e) => keys[e.key] = true;
        keyUpHandler = (e) => keys[e.key] = false;
        window.addEventListener("keydown", keyDownHandler);
        window.addEventListener("keyup", keyUpHandler);

        keyboardInterval = setInterval(() => {
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
        if (window.gameObjects) {
          window.gameObjects.ball.position.x = ball.x;
          window.gameObjects.ball.position.y = ball.y;
          window.gameObjects.paddleLeft.position.y = paddles.left;
          window.gameObjects.paddleRight.position.y = paddles.right;
        }
        const scoreP1 = document.getElementById("scoreP1");
        const scoreP2 = document.getElementById("scoreP2");
        if (scoreP1) scoreP1.textContent = String(score.p1);
        if (scoreP2) scoreP2.textContent = String(score.p2);
      }

      if (data.type === "assign") {
        console.log("Assigned role:", data.role);
        // Update the player name display for the current user's role
        const playerNameElem = document.getElementById(`playerName${data.role}`);
        if (playerNameElem) {
          playerNameElem.textContent = currentUsername;
        }
      }

      if (data.type === "gameOver") {
        gameEnded = true;

        showMessage(`${data.winner} wins!`)
        console.log("after yes");
        // Clean up event listeners and intervals
        clearInterval(keyboardInterval);
        window.removeEventListener("pointermove", pointerHandler);
        window.removeEventListener("keydown", keyDownHandler);
        window.removeEventListener("keyup", keyUpHandler);
        console.log("data:", data);
        console.log("gameId:", gameId);
        console.log("data.winner.id:", data.winner_id);
        console.log("window.CURRENT_USER?.user_id:", String(window.CURRENT_USER?.user_id));

        const didCurrentUserWin = Boolean(currentUserId) && String(data.winner_id) === currentUserId;
        if (IsTournament && didCurrentUserWin)
          await updateTournamentGameResult(gameId, data.winner_id);
        // Dispose engine and scene
        scene.dispose();
        engine.dispose();

        // Close websocket
        ws?.close();
        ws = null;
        isGameActive = false;
        // Clear session storage
        sessionStorage.removeItem('activeGameId');
        sessionStorage.removeItem('activeTournamentId');
        // Navigate back to tournament with tournament id
              navigate(`/tournament/${window.currentTournamentId}`);
      }

    } catch (e) {
      console.error("Failed to parse message:", e);
    }
  };

  ws.onclose = () => {
    console.log("WS disconnected");
    isGameActive = false;
    if (!gameEnded) {
      clearInterval(keyboardInterval);
      window.removeEventListener("pointermove", pointerHandler);
      window.removeEventListener("keydown", keyDownHandler);
      window.removeEventListener("keyup", keyUpHandler);
      scene.dispose();
      engine.dispose();
      // Clear session storage
      sessionStorage.removeItem('activeGameId');
      sessionStorage.removeItem('activeTournamentId');

      if (IsTournament) {
        navigate(`/tournament/${window.currentTournamentId}`);
      } else {
        navigate('/online');
      }
    }
  };
}
