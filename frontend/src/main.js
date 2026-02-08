import "./styles.css";
import { Engine, Scene } from "@babylonjs/core";
import { initGameScene } from "./game.js";
import { createUserManager } from './usermanagement.js';
import { initChat, sendChatMessage, onlineUsers, initTyping } from './chat.js';
import { getCurrentUser as fetchCurrentUser } from './usermanagement.js';
import { initI18n, t, TranslationKey, updatePageTranslations, setLanguage, getCurrentLanguage, Language } from "./i18n";

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

export function joinOnlineGame(gameId) {
	const canvas = document.getElementById("renderCanvas");
	const engine = new Engine(canvas, true);
	const scene = new Scene(engine);
	let pointerHandler = null;
	let keyboardInterval = null;
	let keyDownHandler = null;
	let keyUpHandler = null;

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

window.addEventListener("DOMContentLoaded", async () => {

	// Fetch current user from backend
	const CURRENT_USER = await fetchCurrentUser();
	CURRENT_USER.user_id = String(CURRENT_USER.user_id);
	window.CURRENT_USER = CURRENT_USER;

	console.log("Current user:", CURRENT_USER);
	initChat();

	// DOM elements
	const chatContainer = document.getElementById("chatContainer");
	const openSocialsBtn = document.getElementById("openSocialsBtn");
	const closeSocialsBtn = document.getElementById("closeSocialsBtn");
	const chatBtn = document.getElementById("chatBtn");
	const chatInput = document.getElementById("chatInput");
	const onlineUsersList = document.getElementById("onlineUsersList");
	const channelTabs = document.getElementById("channelTabs");
	const chatMessages = document.getElementById("chatMessages");
	const channelTitle = document.getElementById("channelTitle");

	// State management
	let activeChannel = "global"; // Current active channel (global or user ID)
	const messageHistory = {
		global: [] // Each channel stores its messages
	};

	// Initialize i18n (if you have it)
	// initI18n();
	// setLanguage(Language.EN);
	// updatePageTranslations();

	// Create user manager UI
	createUserManager();

	// Initial route handling
	handleRoute(window.location.pathname);

	// ============================================
	// CHANNEL MANAGEMENT
	// ============================================

	function switchChannel(channelId) {
		activeChannel = channelId;

		// Update tab active state
		document.querySelectorAll(".channel-tab").forEach(tab => {
			tab.classList.remove("active");
		});
		const activeTab = document.querySelector(`[data-channel="${channelId}"]`);
		if (activeTab) {
			activeTab.classList.add("active");
		}

		// Update channel title
		if (channelId === "global") {
			channelTitle.textContent = "# Global Chat";
		} else {
			const user = onlineUsers.find(u => u.id === channelId);
			channelTitle.textContent = user ? `@ ${user.name}` : "@ Direct Message";
		}

		// Display messages for this channel
		renderMessages(channelId);
		
		// Focus input
		chatInput.focus();
	}

	function openDMChannel(userId, userName) {
		// Don't open DM with yourself
		if (userId === CURRENT_USER.user_id) return;

		// Check if tab already exists
		const existingTab = document.querySelector(`[data-channel="${userId}"]`);
		if (existingTab) {
			switchChannel(userId);
			return;
		}

		// Create message history for this channel if it doesn't exist
		if (!messageHistory[userId]) {
			messageHistory[userId] = [];
		}

		// Create new tab
		const tab = document.createElement("button");
		tab.className = "channel-tab";
		tab.dataset.channel = userId;

		tab.innerHTML = `
			<span class="channel-icon">@</span>
			<span>${userName}</span>
			<span class="close-tab" data-close="${userId}">  X</span>
		`;

		// Insert before close button
		channelTabs.appendChild(tab);

		// Add click handlers
		tab.addEventListener("click", (e) => {
			if (e.target.classList.contains("close-tab")) {
				// Close tab
				e.stopPropagation();
				closeDMChannel(userId);
			} else {
				// Switch to this channel
				switchChannel(userId);
			}
		});

		// Switch to the new channel
		switchChannel(userId);
	}
	
	function createDMTab(userId, userName) {
		// Don't open DM with yourself
		if (userId === CURRENT_USER.user_id) return;

		// Create message history for this channel if it doesn't exist
		if (!messageHistory[userId]) {
			messageHistory[userId] = [];
		}

		// Create new tab
		const tab = document.createElement("button");
		tab.className = "channel-tab";
		tab.dataset.channel = userId;

		tab.innerHTML = `
			<span class="channel-icon">@</span>
			<span>${userName}</span>
			<span class="close-tab" data-close="${userId}">  X</span>
		`;

		// Insert tab
		channelTabs.appendChild(tab);

		// Add click handlers
		tab.addEventListener("click", (e) => {
			if (e.target.classList.contains("close-tab")) {
				// Close tab
				e.stopPropagation();
				closeDMChannel(userId);
			} else {
				// Switch to this channel
				switchChannel(userId);
			}
		});

		// not calling switchChannel here - just creating the tab
	}
	
	function closeDMChannel(userId) {
		// Remove tab
		const tab = document.querySelector(`[data-channel="${userId}"]`);
		if (tab) tab.remove();

		// If this was the active channel, switch to global
		if (activeChannel === userId) {
			switchChannel("global");
		}

		// Optionally: keep message history in case they reopen
		// Or delete it: delete messageHistory[userId];
	}

	// ============================================
	// MESSAGE MANAGEMENT
	// ============================================

	function addMessage(channelId, message) {
		// Initialize channel history if needed
		if (!messageHistory[channelId]) {
			messageHistory[channelId] = [];
		}

		// Add message to history
		messageHistory[channelId].push(message);

		// If this is the active channel, render it immediately
		if (channelId === activeChannel) {
			renderMessages(channelId);
		} else {
			// Show unread badge on tab
			const tab = document.querySelector(`[data-channel="${channelId}"]`);
			if (tab && !tab.querySelector(".unread-badge")) {
				const badge = document.createElement("span");
				badge.className = "unread-badge";
				badge.textContent = "1";
				tab.appendChild(badge);
			} else if (tab) {
				const badge = tab.querySelector(".unread-badge");
				badge.textContent = parseInt(badge.textContent) + 1;
			}
		}
	}

	function renderMessages(channelId) {
		chatMessages.innerHTML = "";

		const messages = messageHistory[channelId] || [];
		messages.forEach(msg => {
			const msgDiv = document.createElement("div");
			msgDiv.className = "chat-message";

			const isOwnMessage = msg.senderId === CURRENT_USER.user_id;
			if (isOwnMessage) {
				msgDiv.classList.add("self");
			} else if (channelId !== "global") {
				msgDiv.classList.add("dm-received");
			}

			const senderSpan = document.createElement("span");
			senderSpan.className = "sender";
			senderSpan.textContent = isOwnMessage ? "Me" : msg.senderName;

			const messageSpan = document.createElement("span");
			messageSpan.textContent = msg.message;

			msgDiv.appendChild(senderSpan);
			msgDiv.appendChild(document.createTextNode(": "));
			msgDiv.appendChild(messageSpan);

			chatMessages.appendChild(msgDiv);
		});

		// Scroll to bottom
		chatMessages.scrollTop = chatMessages.scrollHeight;

		// Clear unread badge if switching to this channel
		const tab = document.querySelector(`[data-channel="${channelId}"]`);
		if (tab) {
			const badge = tab.querySelector(".unread-badge");
			if (badge) badge.remove();
		}
	}

	// ============================================
	// USER LIST
	// ============================================

	function renderOnlineUsers() {
		if (!onlineUsersList) return;
		
		onlineUsersList.innerHTML = "";

		if (!onlineUsers || onlineUsers.length === 0) {
			onlineUsersList.innerHTML = '<div class="text-xs text-gray-500 px-2">No users online</div>';
			return;
		}

		onlineUsers.forEach(user => {
			// Skip yourself - don't render your own user in the list
			if (user.id === CURRENT_USER.user_id) {
				return; // ← Add this check
			}
			const div = document.createElement("div");
			div.className = "user-item";
			
			// Highlight current user
			if (user.id === CURRENT_USER.user_id) {
				div.classList.add("self");
			}

			// Status indicator
			const statusDot = document.createElement("span");
			statusDot.className = "user-status";

			// Username
			const nameSpan = document.createElement("span");
			nameSpan.textContent = user.name || user.id;
			if (user.id === CURRENT_USER.user_id) {
				nameSpan.textContent = "You";
			}

			div.appendChild(statusDot);
			div.appendChild(nameSpan);

			// Click to open DM (but not for yourself)
			if (user.id !== CURRENT_USER.user_id) {
				div.addEventListener("click", () => {
					openDMChannel(user.id, user.name || user.id);
				});
			}

			onlineUsersList.appendChild(div);
		});
	}

	// Listen for online users updates
	window.addEventListener("onlineUsersUpdated", renderOnlineUsers);

	// Listen for incoming messages (from chat.js)
	window.addEventListener("chatMessageReceived", (e) => {
		const { channelId, message } = e.detail;
		
		console.log("chatMessageReceived event fired!");
		console.log("channelId:", channelId);
		console.log("message:", message);
		console.log("activeChannel:", activeChannel);
		
		// If this is a DM channel and the tab doesn't exist, create it
		if (channelId !== "global") {
			const existingTab = document.querySelector(`[data-channel="${channelId}"]`);
			if (!existingTab) {
				// Create DM tab but DON'T switch to it
				createDMTab(channelId, message.senderName);
			}
		}
		// Just add the message - don't auto-switch channels
		addMessage(channelId, message);
	});

	// ============================================
	// CHAT OPEN/CLOSE
	// ============================================

	if (openSocialsBtn && chatContainer) {
		openSocialsBtn.style.display = "block";
		openSocialsBtn.addEventListener("click", () => {
			chatContainer.style.display = "flex";
			openSocialsBtn.style.display = "none";
			chatInput.focus();
			renderOnlineUsers();
		});
	}

	if (closeSocialsBtn && chatContainer && openSocialsBtn) {
		closeSocialsBtn.addEventListener("click", () => {
			chatContainer.style.display = "none";
			openSocialsBtn.style.display = "block";
		});
	}

	// ============================================
	// SEND MESSAGE
	// ============================================

	initTyping(chatInput);

	if (chatBtn && chatInput) {
		const sendMessage = () => {
			const message = chatInput.value.trim();
			if (!message) return;

			// Determine target
			const target = activeChannel === "global" ? null : activeChannel;

			// Send via WebSocket
			sendChatMessage(message, target);

			chatInput.value = "";
			chatInput.focus();
		};

		chatBtn.addEventListener("click", sendMessage);
		
		chatInput.addEventListener("keypress", e => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				sendMessage();
			}
		});
	}

	// ============================================
	// GLOBAL CHANNEL TAB CLICK
	// ============================================
	
	console.log("Looking for global tab...");
	const globalTab = document.querySelector('[data-channel="global"]');
	console.log("Global tab element found:", globalTab)
	
	const allTabs = document.querySelectorAll('.channel-tab');
	console.log("All channel tabs:", allTabs);
	allTabs.forEach(tab => {
		console.log("Tab data-channel:", tab.dataset.channel);
	});
	
	if (globalTab) {
		globalTab.addEventListener("click", () => {
			console.log("Global tab clicked!");
			switchChannel("global");
		});
	}

});