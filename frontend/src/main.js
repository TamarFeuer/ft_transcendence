import "./styles.css";
import { Engine, Scene } from "@babylonjs/core";
import { initGameScene } from "./game.js";
import { createUserManager } from './usermanagement.js';
import { initChat, sendChatMessage, onlineUsers, initTyping } from './chat.js';
import { FAKE_USERS, getNameFromId } from "./fakeUsers.js";

function getUserFromURL() {
	const params = new URLSearchParams(window.location.search);
	const key = params.get("user"); // e.g., "alice"
	const userKey = key ? `u-${key}` : null; // "u-alice

	if (userKey && FAKE_USERS[userKey]) {
		return FAKE_USERS[userKey];
	}

	return FAKE_USERS["u-guest"];
}

export const CURRENT_USER = getUserFromURL();
window.CURRENT_USER = CURRENT_USER; // <--- attach to global
console.log("Current user:", CURRENT_USER);


// --- Game Variables ---
let ws = null;
let currentGameId = null;

export const routes = {};
import { setupRoutes } from "./routes.js";

export function navigate(path) {
	window.history.pushState({}, path, window.location.origin + path);
	handleRoute(path);
}

function handleRoute(path) {
	const handler = routes[path];
	if (handler) {
		handler();
	} else {
		routes['/']?.();
	}
}

window.addEventListener('popstate', () => {
	handleRoute(window.location.pathname);
});

export function joinOnlineGame(gameId) {
	const canvas = document.getElementById("renderCanvas");
	const engine = new Engine(canvas, true);
	const scene = new Scene(engine);
	let pointerHandler = null;
	let keyboardInterval = null;
	let keyDownHandler = null;
	let keyUpHandler = null;

	const proto = location.protocol === "https:" ? "wss:" : "ws:";
	// include JWT token using WebSocket subprotocol (safer than query string)
	const token = localStorage.getItem('jwt');
	// Connect to backend on port 3000 (not vite dev server on 5173)
	const wsHost = import.meta.env.DEV ? 'localhost:3000' : location.host;
	const url = `${proto}//${wsHost}/ws/${gameId}`;
	ws = token ? new WebSocket(url, token) : new WebSocket(url);

	ws.onopen = () => {
		console.log("WS connected to game:", gameId);
	};

	ws.onerror = (e) => console.error("WS error", e);

	ws.onmessage = (ev) => {
		try {
			const data = JSON.parse(ev.data);
			console.log("WS message", data);

			if (data.type === "gameStart") {
				const appRoot = document.getElementById("app-root");

				appRoot.innerHTML = `
				<div id="gameContainer">
					<canvas id="renderCanvas"></canvas>
					<div id="scoreHud" class="score-hud" style="display: block; position: absolute; top: 10px; left: 10px; color: white; font-size: 20px; z-index: 100;">
						<div>Player 1: <span id="scoreP1">0</span></div>
						<div>Player 2: <span id="scoreP2">0</span></div>
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
				alert(`${data.winner} wins!`);

				// Clean up event listeners and intervals
				clearInterval(keyboardInterval);
				window.removeEventListener("pointermove", pointerHandler);
				window.removeEventListener("keydown", keyDownHandler);
				window.removeEventListener("keyup", keyUpHandler);

				// Dispose engine and scene
				scene.dispose();
				engine.dispose();

				// Close websocket
				ws?.close();
				ws = null;
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

export function initOfflineGame(scene, gameObjects, tournament) {
	return new Promise((resolve) => {
		let ballVX = 0.07;
		let ballVY = 0.07;
		let scoreP1int = 0;
		let scoreP2int = 0;

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

		// Player 1 controls (W/S)
		const keyboardIntervalP1 = setInterval(() => {
			let y = 0;
			if (keys['w']) y = 0.8;
			if (keys['s']) y = -0.8;
			gameObjects.paddleLeft.position.y += y;

			// Keep paddle within bounds
			if (gameObjects.paddleLeft.position.y > 4.5) {
				gameObjects.paddleLeft.position.y = 4.5;
			}
			if (gameObjects.paddleLeft.position.y < -4.5) {
				gameObjects.paddleLeft.position.y = -4.5;
			}			
		}, 1000 / 15);

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
		}, 1000 / 15);

		const renderObserver = scene.onBeforeRenderObservable.add(() => {
			gameObjects.ball.position.x += ballVX;
			gameObjects.ball.position.y += ballVY;
			ballVX *= 1.00005;
			ballVY *= 1.00005;

			// Ball collision logic
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

			// Check winner
			if (scoreP1int >= 10 || scoreP2int >= 10) {
				// Cleanup
				clearInterval(keyboardIntervalP1);
				clearInterval(keyboardIntervalP2);
				window.removeEventListener("keydown", keyDownHandler);
				window.removeEventListener("keyup", keyUpHandler);
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
	
window.addEventListener("DOMContentLoaded", () => {
	
	initChat();

	// Constants / DOM elements
	const chatContainer = document.getElementById("chatContainer");
	const openSocialsBtn = document.getElementById("openSocialsBtn");
	const closeSocialsBtn = document.getElementById("closeSocialsBtn");
	const chatBtn = document.getElementById("chatBtn");
	const chatInputWrapper = document.getElementById("chatInputWrapper");
	const chatInput = document.getElementById("chatInput");
	const panels = document.querySelectorAll(".panel");
	const tabButtons = document.querySelectorAll(".tab-btn");
	const usersBtn = document.querySelector('button[data-panel="users"]');
	const usersList = document.getElementById("usersList");
	const userDetails = document.getElementById("userDetails");

	// create user manager UI
	createUserManager();

    // Show chat container
    // const container = document.getElementById("chatContainer");
    // if (container) container.style.display = "flex";

	// Helpers
	function showPanel(name) {
		// Hide all panels
		panels.forEach(p => (p.style.display = "none"));

		// Show selected panel
		const panelToShow = document.getElementById(`panel-${name}`);
		if (panelToShow) panelToShow.style.display = "block";

		// Update tab active state
		tabButtons.forEach(b => b.classList.remove("active"));
		document.querySelector(`[data-panel="${name}"]`)?.classList.add("active");

		// Show/hide chat input & send button
		if (chatBtn && chatInputWrapper) {
			if (name === "chat") {
				chatBtn.classList.remove("hidden");
				chatInputWrapper.classList.remove("hidden");
			} else {
				chatBtn.classList.add("hidden");
				chatInputWrapper.classList.add("hidden");
			}
		}

		// Render panel-specific content
		if (name === "friends") renderFriendsPanel(CURRENT_USER.id);
		else if (name === "users") renderUsersPanel();
		else if (name === "chat") renderChatPanel();
	}

	// Panel renderers
	function renderChatPanel() {
		// For now, chat panel doesn't need extra rendering
		// Any initialization logic for chat can go here if needed
	}

	function renderUsersPanel() {
		usersList.innerHTML = "";
		userDetails.style.display = "none";
		userDetails.innerHTML = "";

		if (!onlineUsers || onlineUsers.length === 0) {
			usersList.textContent = "No users online";
			return;
		}

		onlineUsers.forEach(userId => {
			const user = FAKE_USERS[userId];
			if (!user.loggedIn) return;

			const div = document.createElement("div");
			div.className = "py-1 px-2";

			const span = document.createElement("span");
			span.textContent = getNameFromId(userId);
			span.className =
				"cursor-pointer hover:text-pink-500 transition-colors text-lg";

			span.addEventListener("click", () => {
				userDetails.innerHTML = `
				<h3 class="text-lg font-bold">${user.name} ${user.avatar}</h3>
				<p>ID: ${user.id}</p>
				<p>Joined: ${new Date(user.createdAt).toLocaleString()}</p>
				<button id="closeDetails"
					class="mt-2 px-3 py-1 rounded border-2 border-red-500
					text-red-500 font-semibold
					hover:bg-red-500 hover:text-white
					transition-colors duration-200 shadow-sm">
				Close
				</button>
				`;
				userDetails.style.display = "block";

				document
					.getElementById("closeDetails")
					.addEventListener("click", () => {
						userDetails.style.display = "none";
						userDetails.innerHTML = "";
					});
			});

			div.appendChild(span);
			usersList.appendChild(div);
		});
	}

	function renderFriendsPanel(currentUserId) {
		const friendsPanel = document.getElementById("panel-friends");
		friendsPanel.innerHTML = "";

		const me = FAKE_USERS[currentUserId];
		if (!me || !me.friends || me.friends.length === 0) {
			friendsPanel.textContent = "No friends yet";
			return;
		}

		me.friends.forEach(friendId => {
			const friend = FAKE_USERS[friendId];
			if (!friend) return;

			const div = document.createElement("div");
			div.className = "py-1 px-2 flex items-center gap-2";

			const isOnline = onlineUsers.includes(friendId);

			div.innerHTML = `
				<span class="font-semibold">${friend.name}</span>
				<span>${friend.avatar}</span>
				<span class="text-sm ${
					isOnline ? "text-green-400" : "text-gray-400"
				}">
					${isOnline ? "online" : "offline"}
				</span>
			`;

			friendsPanel.appendChild(div);
		});
	}

	// Socials open/close
	if (openSocialsBtn && chatContainer) {
		openSocialsBtn.style.display = "block";
		openSocialsBtn.addEventListener("click", () => {
			chatContainer.style.display = "flex";
			openSocialsBtn.style.display = "none";
			showPanel("chat");
		});
	}

	if (closeSocialsBtn && chatContainer && openSocialsBtn) {
		closeSocialsBtn.addEventListener("click", () => {
			chatContainer.style.display = "none";
			openSocialsBtn.style.display = "block";
		});
	}

	// Tab click events
	tabButtons.forEach(btn => {
		btn.addEventListener("click", () => showPanel(btn.dataset.panel));
	});

	// Chat send functionality
	initTyping(chatInput);

	if (chatBtn && chatInput) {
		const sendMessage = () => {
			const message = chatInput.value.trim();
			if (message) {
				sendChatMessage(message);
				chatInput.value = "";
			}
		};

		chatBtn.addEventListener("click", sendMessage);
		chatInput.addEventListener("keypress", e => {
			if (e.key === "Enter") {
				e.preventDefault();
				sendMessage();
			}
		});
	}

	// Initial route handling
	handleRoute(window.location.pathname);
});