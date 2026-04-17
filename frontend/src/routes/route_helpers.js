
import { routes } from "../main.js";
import { updatePageTranslations } from '../i18n/index.js';
import { handleTournamentRoute } from './routes.js';
import { closeChessConnection } from "../chess/chess-online.js";

export function navigate(path) {
    if (window.location.pathname === '/chess-online' && path !== '/chess-online'){
        closeChessConnection();
    }
    window.history.pushState({}, path, window.location.origin + path);
    handleRoute(path);
}

export function handleRoute(path) {
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
        window.history.replaceState({}, '/', window.location.origin + '/');
    }
}

