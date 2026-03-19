import "./styles.css";
import { Engine, Scene } from "@babylonjs/core";
import { initGameScene } from "./game.js";
import { createUserManager } from './usermanagement.js';
import { initChat } from './chat.js';
import { getCurrentUser as fetchCurrentUser } from './usermanagement.js';
import { renderFriendsPanel } from "./friends.js";
import { initI18n, t, TranslationKey, updatePageTranslations, setLanguage, getCurrentLanguage, Language } from "./i18n";
import { initChatUI } from './chat-ui.js';
import { showMessage } from "./routes.js"
import { initOfflineGame } from './local_game.js';
import { closeGameConnection } from "./game.js";
import { handleRoute, navigate } from "./route_helpers.js";

// --- Game Variables ---
let ws = null;
let currentGameId = null;
let isGameActive = false;

export const routes = {};
import { setupRoutes, handleTournamentRoute } from "./routes.js";

window.addEventListener('popstate', () => {
	console.log('User navigated: back or forward');
	console.log('Current pathname:', window.location.pathname);
	// Close game connection before handling new route
	if (isGameActive) {
		closeGameConnection();
		sessionStorage.removeItem('activeGameId');
	}
	handleRoute(window.location.pathname);
});

// Auto-reconnect to game if page was refreshed
/*
window.addEventListener('load', async () => {
	const activeGameId = sessionStorage.getItem('activeGameId');
	const isTournament = sessionStorage.getItem('activeTournamentId') ? true : false;
	if (activeGameId && window.location.pathname.includes('/online')) {
		console.log('Reconnecting to game:', activeGameId);
		await new Promise(r => setTimeout(r, 500)); // Wait for page to be ready
		joinOnlineGame(activeGameId, isTournament);
	}
});
*/

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
					showMessage(scoreP1int >= 10 ? "AI wins!" : "You win!");
					navigate('/');
				}

				resolve();
			}
		});
	});
}

setupRoutes();

window.addEventListener("DOMContentLoaded", async () => {

	initChat();

	// Create user manager UI
	createUserManager();

	// Initial route handling
	handleRoute(window.location.pathname);

	initChatUI();
});