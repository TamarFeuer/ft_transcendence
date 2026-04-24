import { createGameCanvas } from "../../routes/routes.js";
import { fetchWithRefreshAuth } from "../../users_friends/usermanagement.js";

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

import { updateTournamentGameResult } from "../tournament/tournament_api.js";
import "../../styles.css";
import { Engine, Scene } from "@babylonjs/core";
import { showMessage } from "../../utils/utils.js"
import { handleRoute, navigate } from "../../routes/route_helpers.js";

function showAchievements(achievements) {
    if (!achievements || achievements.length === 0) return;
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#222;color:#fff;padding:16px 20px;border-radius:10px;z-index:9999;max-width:320px;box-shadow:0 4px 16px rgba(0,0,0,0.5);';
    const title = achievements.length === 1 ? '🏆 Achievement Unlocked!' : `🏆 ${achievements.length} Achievements Unlocked!`;
    overlay.innerHTML = `<div style="font-weight:bold;margin-bottom:8px;">${title}</div><ul style="margin:0;padding-left:20px;">` +
        achievements.map(a => `<li style="margin-bottom:4px;"><b>${a.name}</b>: ${a.description}</li>`).join('') +
        '</ul>';
    document.body.appendChild(overlay);
    setTimeout(() => overlay.remove(), 6000);
}

function showPongResultModal({ winnerId, winnerName, currentUserId }) {
  const didWin = winnerId != null && Number(winnerId) === currentUserId;
  const title = didWin ? 'You Won!' : 'You Lost';
  const accent = didWin ? 'border-green-400 text-green-300' : 'border-red-400 text-red-300';
  const glow = didWin
    ? 'shadow-[0_0_30px_rgba(74,222,128,0.35)]'
    : 'shadow-[0_0_30px_rgba(248,113,113,0.35)]';
  const overlay = document.createElement('div');
  overlay.id = 'pongResultModal';
  overlay.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm';
  overlay.innerHTML = `
    <div class="w-[92%] max-w-md rounded-2xl border ${accent} bg-zinc-900/95 p-6 ${glow}">
      <h2 class="text-3xl font-extrabold tracking-wide ${didWin ? 'text-green-300' : 'text-red-300'}">
        ${title}
      </h2>
      <div class="mt-5 rounded-lg bg-zinc-800/70 p-3">
        <p class="text-sm text-zinc-400">Result</p>
        <p class="text-base text-white">
          ${winnerName ? `${winnerName} wins` : (didWin ? 'Victory' : 'Defeat')}
        </p>
      </div>
      <div class="mt-6 flex justify-end gap-2">
        <button id="pongResultOkBtn"
          class="rounded-lg bg-violet-600 px-4 py-2 text-white hover:bg-violet-500">
          Continue
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  document.getElementById('pongResultOkBtn')?.addEventListener('click', close, { once: true });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
}

// --- Game Variables ---
let ws = null;
let currentGameId = null;
export let isGameActive = false;

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
  const currentUsername = localStorage.getItem('username') || window.CURRENT_USER?.username || 'Player';
  let assignedUserId = null;
  const canvas = createGameCanvas();

  const engine = new Engine(canvas, true);
  const scene = new Scene(engine);
  let pointerHandler = null;
  let keyboardInterval = null;
  let keyDownHandler = null;
  let keyUpHandler = null;
  let resizeHandler = null;
  let gameEnded = false;
  
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  ws = new WebSocket(`${proto}//${location.host}/ws/${gameId}`);

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
      <div id="waitingModal" class="absolute inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50 pointer-events-auto">
        <div class="bg-gray-900 border-2 border-green-400 rounded-lg p-8 text-center">
          <h2 class="text-white text-2xl font-bold mb-4">Waiting for opponent...</h2>
          <p class="text-gray-300 mb-2">Game will start soon</p>
          <button id="leaveWaitingBtn" class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded">
            Leave Game
          </button>
        </div>
      </div>
    </div>
    `;

    document.getElementById('leaveWaitingBtn')?.addEventListener('click', () => {
        gameEnded = true;
        ws?.close();
        ws = null;
        isGameActive = false;
        sessionStorage.removeItem('activeGameId');
        sessionStorage.removeItem('activeTournamentId');
        window.dispatchEvent(new CustomEvent("pongGameLeft"));
        navigate('/');
    })
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

        resizeHandler = () => engine.resize();
        window.addEventListener("resize", resizeHandler);

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
        const parsedAssignedId = Number(data.user_id);
        if (Number.isFinite(parsedAssignedId)) {
          assignedUserId = parsedAssignedId;
          localStorage.setItem('user_id', String(parsedAssignedId));
        }

        

        // Update the player name display for the current user's role
        const playerNameElem = document.getElementById(`playerName${data.role}`);
        if (playerNameElem) {
          playerNameElem.textContent = currentUsername;
        }
      }

      if (data.type === "gameOver") {
        gameEnded = true;
        
        // Remove waiting modal if it still exists
        const waitingModal = document.getElementById("waitingModal");
        if (waitingModal) {
          waitingModal.remove();
        }

        const localUserId = Number(localStorage.getItem('user_id'));
        const currentUserId = Number.isFinite(assignedUserId) ? assignedUserId : localUserId;
        showPongResultModal({
          winnerId: data.winner_id,
          winnerName: data.winner,
          currentUserId,
        });
        const userId = String(Number.isFinite(currentUserId) ? currentUserId : '');
        const myAchievements = (data.new_achievements || {})[userId] || [];
        showAchievements(myAchievements);
        // Clean up event listeners and intervals
        clearInterval(keyboardInterval);
        window.removeEventListener("pointermove", pointerHandler);
        window.removeEventListener("keydown", keyDownHandler);
        window.removeEventListener("keyup", keyUpHandler);
        window.removeEventListener("resize", resizeHandler);

        if (window.gameObjects) {
          scene.dispose();
          engine.dispose();
        }

        // Close websocket
        ws?.close();
        ws = null;
        isGameActive = false;
        // Clear session storage
        sessionStorage.removeItem('activeGameId');
        sessionStorage.removeItem('activeTournamentId');
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
      window.removeEventListener("resize", resizeHandler);
      scene.dispose();
      engine.dispose();
      // Clear session storage
      sessionStorage.removeItem('activeGameId');
      sessionStorage.removeItem('activeTournamentId');

    }
    canvas.remove();
    if (IsTournament) {
      navigate(`/tournament/${window.currentTournamentId}`);
    } else {
      window.dispatchEvent(new CustomEvent("pongGameLeft"));
      navigate('/');
    }
  };
}


export async function joinMatchmaking(){
  const res = await fetchWithRefreshAuth('/api/game/join', {
    method: 'POST',
  });

  if (!res.ok){
    const text = await res.text();
    throw new Error(`join failed ${res.status}: ${text}`);
  }
  const { gameId } = await res.json();
  joinOnlineGame(gameId, false);
}