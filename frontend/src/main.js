import "./styles.css";
import { Engine, Scene } from "@babylonjs/core";
import { initGameScene } from "./pong/game/game.js";
import { createUserManager } from './users_friends/usermanagement.js';
import { initChat } from './chat/chat.js';
import { getCurrentUser as fetchCurrentUser } from './users_friends/usermanagement.js';
import { renderFriendsPanel } from "./users_friends/friends.js";
import { initI18n, t, TranslationKey, updatePageTranslations, setLanguage, getCurrentLanguage, Language } from "./i18n/index.js";
import { initChatUI } from './chat/chat-ui.js';
import { showMessage } from "./utils/utils.js"
import { initOfflineGame } from './pong/game/local_game.js';
import { closeGameConnection } from './pong/game/game.js';
import { handleRoute } from './routes/route_helpers.js';
import { isGameActive } from './pong/game/game.js'

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

window.addEventListener("DOMContentLoaded", async () => {
	
	const currentUser = await fetchCurrentUser(); // wait for token refresh, ignore the result
	if (currentUser.authenticated) {
		initChat();
		initChatUI();
	}

	// Create user manager UI
	createUserManager();
	// Initial route handling
	handleRoute(window.location.pathname);
	
});