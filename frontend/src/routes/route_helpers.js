
import { routes } from "../main.js";
import { updatePageTranslations } from '../i18n/index.js';
import { handleTournamentRoute, handleProfileRoute } from './routes.js';
import { closeChessConnection } from "../chess/chess-online.js";
import { isGameActive } from "../pong/game/game.js";
import { closeGameConnection } from "../pong/game/game.js";

export function navigate(path) {
    const currentPath = window.location.pathname;
    //close chess socket when leaving chess online path
    if (currentPath === '/chess-online' && path !== '/chess-online'){
        closeChessConnection();
    }

    //close pong socket when user navgates away from the game
    if (isGameActive && currentPath !== path){
        closeGameConnection();
        sessionStorage.removeItem('activeGameId');
        sessionStorage.removeItem('activeTournamentId');
    }
    window.history.pushState({}, path, window.location.origin + path);
    handleRoute(path);
}

export function handleRoute(path) {
    // Check for tournament/:id route
    
    document.getElementById("back-btn")?.remove();
    
    if (path.match(/^\/tournament\/\d+$/)) {
        handleTournamentRoute(path);
        return;
    }

    // Check for profile/:username route
    if (path.match(/^\/profile\/[^\/]+$/)) {
        handleProfileRoute(path);
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
        window.history.replaceState({}, '/', window.location.origin + '/');
    }
}

