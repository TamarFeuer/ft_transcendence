import "./styles.css";
import { Engine, Scene } from "@babylonjs/core";
import { initGameScene } from "./game.js";
import { createUserManager } from './usermanagement.js';
import { initChat } from './chat.js';
import { getCurrentUser as fetchCurrentUser } from './usermanagement.js';
import { initI18n, t, TranslationKey, updatePageTranslations, setLanguage, getCurrentLanguage, Language } from "./i18n";
import { initChatUI } from './chat-ui.js';
import { updateTournamentGameResult } from "./tournament.js";

// --- Game Variables ---
let ws = null;
let currentGameId = null;

export const routes = {};
import { setupRoutes, handleTournamentRoute } from "./routes.js";

export function navigate(path) {
	window.history.pushState({}, path, window.location.origin + path);
	handleRoute(path);
}

function handleRoute(path) {
	// Check for tournament/:id route
	if (path.match(/^\/tournament\/\d+$/)) {
		handleTournamentRoute(path);
		return;
	}
	
	const handler = routes[path];
	if (handler) {
		handler();
		// Ensure translations are applied after route loads
		setTimeout(() => updatePageTranslations(), 0);
	} else {
		routes['/']?.();
		setTimeout(() => updatePageTranslations(), 0);
	}
}

window.addEventListener('popstate', () => {
	handleRoute(window.location.pathname);
});

export function joinOnlineGame(gameId, IsTournament) {
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
							<div class="text-white font-bold text-lg tracking-wide">${data.P1}</div>
							<div id="scoreP1" class="font-mono font-bold text-6xl text-green-400 drop-shadow-lg" style="text-shadow: 0 0 10px rgba(74, 222, 128, 0.8);">0</div>
						</div>
						<div class="flex flex-col items-end">
							<div class="text-white font-bold text-lg tracking-wide">${data.P2}</div>
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
			}

			if (data.type === "gameOver") {
				gameEnded = true;
				alert(`${data.winner} wins!`);

				// Clean up event listeners and intervals
				clearInterval(keyboardInterval);
				window.removeEventListener("pointermove", pointerHandler);
				window.removeEventListener("keydown", keyDownHandler);
				window.removeEventListener("keyup", keyUpHandler);
				console.log("data:", data);
				console.log("gameId:", gameId);
				console.log("data.winner.id:", data.winner_id);
				if (IsTournament)
					await updateTournamentGameResult(gameId, data.winner_id);
				// Dispose engine and scene
				scene.dispose();
				engine.dispose();

				// Close websocket
				ws?.close();
				ws = null;
				// Navigate back to tournament with tournament id
          		navigate(`/tournament/${window.currentTournamentId}`);
			}

		} catch (e) {
			console.error("Failed to parse message:", e);
		}
	};

	ws.onclose = () => {
		console.log("WS disconnected");
		if (!gameEnded) {
			clearInterval(keyboardInterval);
			window.removeEventListener("pointermove", pointerHandler);
			window.removeEventListener("keydown", keyDownHandler);
			window.removeEventListener("keyup", keyUpHandler);
			scene.dispose();
			engine.dispose();
			alert("Connection lost or opponent disconnected.");
			if (IsTournament) {
				navigate(`/tournament/${window.currentTournamentId}`);
			} else {
				navigate('/online');
			}
		}
	};
}

export function initOfflineGame(scene, gameObjects, tournament) {
	return new Promise((resolve) => {
		// Speed configuration: tweak these to make the game slower/faster
		const SPEED_INITIAL = 0.04;       // starting speed (lower = slower)
		const SPEED_ACCEL_BASE = 1.000001; // per-frame accel base (1.0 = no growth)
		const SPEED_MAX = 0.18;           // cap max resultant speed

		let ballVX = SPEED_INITIAL;
		let ballVY = SPEED_INITIAL;
		let ballSpin = 0; // Angular velocity (positive = topspin, negative = backspin)
		let scoreP1int = 0;
		let scoreP2int = 0;
		
		// Track paddle positions for velocity calculation
		let paddleLeftPrevY = gameObjects.paddleLeft.position.y;
		let paddleRightPrevY = gameObjects.paddleRight.position.y;
		let lastFrameTime = Date.now();

		const scoreP1 = document.getElementById("scoreP1");
		const scoreP2 = document.getElementById("scoreP2");
		scoreP1.textContent = "0";
		scoreP2.textContent = "0";

		const keys = {};
		let mouseControlledPaddleY = null; // Track mouse position for right paddle

		// Handlers
		const keyDownHandler = (e) => keys[e.key] = true;
		const keyUpHandler = (e) => keys[e.key] = false;
		
		// Mouse control for right paddle
		const pointerMoveHandler = (e) => {
			// Normalize mouse Y position to game coordinates (-4 to 4)
			const normalized = 1 - (e.clientY / window.innerHeight); // 0 to 1
			mouseControlledPaddleY = (normalized - 0.5) * 8; // -4 to 4
		};

		window.addEventListener("keydown", keyDownHandler);
		window.addEventListener("keyup", keyUpHandler);
		window.addEventListener("pointermove", pointerMoveHandler);

		// Smoother keyboard controls with higher frequency and smaller steps
		const keyboardInterval = setInterval(() => {
			// Left paddle - W/S keys
			if (keys['w'] || keys['s']) {
				let y = 0;
				if (keys['w']) y = 0.35; // Reduced from 0.8 for smoother movement
				if (keys['s']) y = -0.35;
				gameObjects.paddleLeft.position.y += y;
				
				// Keep within bounds
				gameObjects.paddleLeft.position.y = Math.max(-4.5, Math.min(4.5, gameObjects.paddleLeft.position.y));
			}
			
			// Right paddle - Arrow keys OR mouse (mouse takes priority)
			if (mouseControlledPaddleY !== null) {
				// Smooth interpolation to mouse position
				const targetY = Math.max(-4.5, Math.min(4.5, mouseControlledPaddleY));
				const diff = targetY - gameObjects.paddleRight.position.y;
				gameObjects.paddleRight.position.y += diff * 0.15; // Smooth follow
			} else if (keys['ArrowUp'] || keys['ArrowDown']) {
				let y = 0;
				if (keys['ArrowUp']) y = 0.35; // Reduced from 0.8 for smoother movement
				if (keys['ArrowDown']) y = -0.35;
				gameObjects.paddleRight.position.y += y;
				
				// Keep within bounds
				gameObjects.paddleRight.position.y = Math.max(-4.5, Math.min(4.5, gameObjects.paddleRight.position.y));
			}
		}, 1000 / 60); // Increased from 15 to 60 fps for smoother movement

		const renderObserver = scene.onBeforeRenderObservable.add(() => {
			// Calculate delta time for frame-independent physics
			const currentTime = Date.now();
			const dt = (currentTime - lastFrameTime) / 16.67; // Normalize to 60fps
			lastFrameTime = currentTime;
			
			// Magnus effect: spin creates perpendicular force
			// In real ping pong, topspin makes ball curve downward, backspin upward
			const magnusCoefficient = 0.0008;
			const extra_factor = 40
			const spinForce = -ballSpin * magnusCoefficient  * extra_factor * dt;
			ballVY += spinForce;
			
			// Air resistance causes spin to decay
			const spinDecay = 0.992;
			ballSpin *= Math.pow(spinDecay, dt);
			
			// Visual rotation based on spin (rotate around Z axis)
			gameObjects.ball.rotation.z += ballSpin * magnusCoefficient * extra_factor * 100 * dt;
			
			// Update ball position
			gameObjects.ball.position.x += ballVX * dt;
			gameObjects.ball.position.y += ballVY * dt;
			
			// Gradual speed increase (uses config)
			const speedIncrease = Math.pow(SPEED_ACCEL_BASE, dt);
			ballVX *= speedIncrease;
			ballVY *= speedIncrease;

			// Clamp maximum speed (resultant velocity)
			const currentSpeed = Math.hypot(ballVX, ballVY);
			// if (currentSpeed > SPEED_MAX) {
			// 	const scale = SPEED_MAX / currentSpeed;
			// 	ballVX *= scale;
			// 	ballVY *= scale;
			// }

			// Ball collision with top/bottom walls
			if (gameObjects.ball.position.y > 5 || gameObjects.ball.position.y < -5) {
				ballVY = -ballVY;
				// Wall bounce reduces spin by 30%
				ballSpin *= 0.7;
			}

			// Calculate paddle velocities (in units per frame)
			const paddleLeftVel = (gameObjects.paddleLeft.position.y - paddleLeftPrevY) / dt;
			const paddleRightVel = (gameObjects.paddleRight.position.y - paddleRightPrevY) / dt;
			paddleLeftPrevY = gameObjects.paddleLeft.position.y;
			paddleRightPrevY = gameObjects.paddleRight.position.y;
			
			// Left paddle collision
			if (gameObjects.ball.position.x < gameObjects.paddleLeft.position.x + 0.25 &&
				gameObjects.ball.position.x > gameObjects.paddleLeft.position.x &&
				Math.abs(gameObjects.ball.position.y - gameObjects.paddleLeft.position.y) < 0.75) {
				
				// Simple bounce (no angle effect)
				ballVX = -ballVX;
				
				// SPIN PHYSICS: Fast perpendicular paddle movement creates spin
				// Upward paddle movement = topspin (positive)
				// Downward paddle movement = backspin (negative)
				const spinTransferCoefficient = 1.5;
				ballSpin = paddleLeftVel * spinTransferCoefficient;
				
				// Paddle movement also slightly affects ball's vertical velocity
				const velocityTransfer = 0.11;
				ballVY += paddleLeftVel * velocityTransfer;
			}
			
			// Right paddle collision
			if (gameObjects.ball.position.x > gameObjects.paddleRight.position.x - 0.25 &&
				gameObjects.ball.position.x < gameObjects.paddleRight.position.x &&
				Math.abs(gameObjects.ball.position.y - gameObjects.paddleRight.position.y) < 0.75) {
				
				// Simple bounce (no angle effect)
				ballVX = -ballVX;
				
				// SPIN PHYSICS: Transfer spin from paddle velocity
				const spinTransferCoefficient = 1.5;
				ballSpin = paddleRightVel * spinTransferCoefficient;
				
				// Paddle movement affects ball's vertical velocity
				const velocityTransfer = 0.11;
				ballVY += paddleRightVel * velocityTransfer;
			}

			if (gameObjects.ball.position.x < -6) {
				scoreP2int++;
				scoreP2.textContent = scoreP2int.toString();
				gameObjects.ball.position.x = 0;
				gameObjects.ball.position.y = 0;
				ballSpin = 0; // Reset spin
				ballVX = SPEED_INITIAL;
				ballVY = SPEED_INITIAL;
			} else if (gameObjects.ball.position.x > 6) {
				scoreP1int++;
				scoreP1.textContent = scoreP1int.toString();
				gameObjects.ball.position.x = 0;
				gameObjects.ball.position.y = 0;
				ballSpin = 0; // Reset spin
				ballVX = -SPEED_INITIAL;
				ballVY = SPEED_INITIAL;
			}

			// Check winner
			if (scoreP1int >= 10 || scoreP2int >= 10) {
				// Cleanup
				clearInterval(keyboardIntervalP1);
				clearInterval(keyboardIntervalP2);
				window.removeEventListener("keydown", keyDownHandler);
				window.removeEventListener("keyup", keyUpHandler);
				window.removeEventListener("pointermove", pointerMoveHandler);
				scene.onBeforeRenderObservable.remove(renderObserver);

				if (!tournament) {
					alert(scoreP1int >= 10 ? "Player 1 wins!" : "Player 2 wins!");
					navigate('/');
				}

				resolve();
			}
		});
	});
}

export function initAIGame(scene, gameObjects, tournament) {
	return new Promise((resolve) => {
		let ballVX = 0.07;
		let ballVY = 0.07;
		let scoreP1int = 0;
		let scoreP2int = 0;
		let standartSpeed = 1000 / 15;

		const scoreP1 = document.getElementById("scoreP1");
		const scoreP2 = document.getElementById("scoreP2");
		scoreP1.textContent = "0";
		scoreP2.textContent = "0";

		const keys = {};

		// Handlers
		const keyDownHandler = (e) => keys[e.key] = true;
		const keyUpHandler = (e) => keys[e.key] = false;

		window.addEventListener("keydown", keyDownHandler);
		window.addEventListener("keyup", keyUpHandler);

		// AI controls (W/S)

		// Simulated Annealing
		const keyboardIntervalP1 = setInterval(() => {
			const paddleY = gameObjects.paddleLeft.position.y;
			const ballY = gameObjects.ball.position.y;

			// AI tries to move paddle towards ball
			const difference = ballY - paddleY;

			if (gameObjects.ball.position.x < 0 && Math.abs(difference) > 0.5) {
				// Current energy (distance from ball)
				const currentEnergy = Math.abs(difference);

				// Propose a random move
				const proposedMove = Math.random() < 0.5 ? 0.8 : -0.8;
				const newY = paddleY + proposedMove;
				const newEnergy = Math.abs(ballY - newY);

				// Energy difference (negative = improvement)
				const deltaE = newEnergy - currentEnergy;

				// Acceptance probability: always accept improvements,
				// sometimes accept worse moves based on temperature
				const acceptProbability = deltaE < 0 ? 1.0 : Math.exp(-deltaE / gameObjects.temperature);

				// Accept or reject the move
				if (Math.random() < acceptProbability) {
					gameObjects.paddleLeft.position.y = newY;
				}

				// Cool down
				gameObjects.temperature *= 0.99;
				if (gameObjects.temperature < 0.5) {
					gameObjects.temperature = 0.5;
				}
			}

			// Keep paddle within bounds
			if (gameObjects.paddleRight.position.y > 4.5) {
				gameObjects.paddleRight.position.y = 4.5;
			}
			if (gameObjects.paddleRight.position.y < -4.5) {
				gameObjects.paddleRight.position.y = -4.5;

			}
		}, standartSpeed);

		// Player 2 controls (Arrow keys)
		const keyboardIntervalP2 = setInterval(() => {
			let y = 0;
			if (keys['ArrowUp']) y = 0.8;
			if (keys['ArrowDown']) y = -0.8;
			gameObjects.paddleRight.position.y += y;

			// Keep paddle within bounds
			if (gameObjects.paddleRight.position.y > 4.5) {
				gameObjects.paddleRight.position.y = 4.5;
			}
			if (gameObjects.paddleRight.position.y < -4.5) {
				gameObjects.paddleRight.position.y = -4.5;
			}
		}, standartSpeed);

		const renderObserver = scene.onBeforeRenderObservable.add(() => {
			gameObjects.ball.position.x += ballVX;
			gameObjects.ball.position.y += ballVY;
			ballVX *= 1.00005; // Gradually speeds up
			ballVY *= 1.00005;

			// Ball collision logic
			if (gameObjects.ball.position.y > 5 || gameObjects.ball.position.y < -5) {
				ballVY = -ballVY;
			}

			// Ball and paddle collision
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

			// Paddle misses the ball
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

			// Check winner
			if (scoreP1int >= 10 || scoreP2int >= 10) {
				// Cleanup
				clearInterval(keyboardIntervalP1);
				clearInterval(keyboardIntervalP2);
				window.removeEventListener("keydown", keyDownHandler);
				window.removeEventListener("keyup", keyUpHandler);
				scene.onBeforeRenderObservable.remove(renderObserver);

				if (!tournament) {
					alert(scoreP1int >= 10 ? "AI wins!" : "You win!");
					navigate('/');
				}

				resolve();
			}
		});
	});
}

export async function startTournament(playerCount) {
	const players = [];
	for (let i = 0; i < playerCount; i++) {
		const name = prompt(`Enter name for Player ${i + 1}:`) || `Player ${i + 1}`;
		players.push(name);
	}

	const schedule = [];
	for (let i = 0; i < playerCount; i++) {
		for (let j = i + 1; j < playerCount; j++) {
			schedule.push([i, j]);
		}
	}

	const scores = new Array(playerCount).fill(0);

	for (const [i, j] of schedule) {
		alert(`Match: ${players[i]} vs ${players[j]}`);

		const appRoot = document.getElementById("app-root");
		appRoot.innerHTML = `
			<div id="gameContainer">
				<canvas id="renderCanvas"></canvas>
				<div id="scoreHud" class="score-hud">
					<div>${players[i]}: <span id="scoreP1">0</span></div>
					<div>${players[j]}: <span id="scoreP2">0</span></div>
				</div>
			</div>
		`;

		const canvas = document.getElementById("renderCanvas");
		const engine = new Engine(canvas, true);
		const scene = new Scene(engine);
		const gameObjects = initGameScene(scene, canvas, 2);

		engine.runRenderLoop(() => scene.render());

		await initOfflineGame(scene, gameObjects, true);

		const p1Score = parseInt(document.getElementById("scoreP1").textContent || "0");
		const p2Score = parseInt(document.getElementById("scoreP2").textContent || "0");

		if (p1Score > p2Score) scores[i]++;
		else scores[j]++;

		scene.dispose();
		engine.dispose();
	}

	let winner = 0;
	for (let i = 1; i < playerCount; i++) {
		if (scores[i] > scores[winner]) winner = i;
	}

	alert(`Tournament Winner: ${players[winner]} with ${scores[winner]} wins!`);
	navigate('/');
}

setupRoutes();

window.addEventListener("DOMContentLoaded", async () => {

	// Fetch current user from backend
	const CURRENT_USER = await fetchCurrentUser();
	CURRENT_USER.user_id = String(CURRENT_USER.user_id);
	window.CURRENT_USER = CURRENT_USER;

	console.log("Current user:", CURRENT_USER);
	initChat();

	// Create user manager UI
	createUserManager();

	// Initial route handling
	handleRoute(window.location.pathname);

	initChatUI(CURRENT_USER);
});