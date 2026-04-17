import "./styles.css";
import { initChat } from './chat/chat.js';
import { getCurrentUser as fetchCurrentUser } from './users_friends/usermanagement.js';
import { initChatUI } from './chat/chat-ui.js';
import { closeGameConnection } from './pong/game/game.js';
import { handleRoute } from './routes/route_helpers.js';
import { isGameActive } from './pong/game/game.js'
import { closeChessConnection } from "./chess/chess-online.js";

// --- Game Variables ---
let ws = null;
let currentGameId = null;

export const routes = {};
import { setupRoutes } from "./routes/routes.js";

window.addEventListener('popstate', () => {
	console.log('User navigated: back or forward');
	console.log('Current pathname:', window.location.pathname);
	// Close game connection before handling new route
	if (isGameActive) {
		closeGameConnection();
		sessionStorage.removeItem('activeGameId');
	}
	closeChessConnection();
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

setupRoutes();

window.addEventListener("load", async () => {
	const langBtn = document.getElementById("langBtn");
	const currentUser = await fetchCurrentUser(); // wait for token refresh, ignore the result
	if (currentUser.authenticated) {
		langBtn.style.display = "block";
		initChat();
		initChatUI();
	}

	// Initial route handling
	handleRoute(window.location.pathname);
	
});