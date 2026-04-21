import { t, updatePageTranslations } from '../i18n/index.js';
import { TranslationKey } from '../i18n/keys.js';
import { closeChat } from '../chat/chat.js';
import { showMessage } from "../utils/utils.js"

// --- Token refresh helper ---
let refreshPromise = null;

async function refreshAccessToken() {
    // Prevent multiple simultaneous refresh requests
    if (refreshPromise) {
        return refreshPromise;
    }
    
    refreshPromise = (async () => {
        try {
            const res = await fetch('/api/auth/refresh', {
                method: 'POST',
                credentials: 'include' // Send cookies
            });
            
            if (res.ok) {
                const data = await res.json();
                if (data.username) {
                    localStorage.setItem('username', data.username);
                    localStorage.setItem('user_id', data.id);
                }
                return true;
            }
            return false;
        } catch (error) {
            console.error('Token refresh failed:', error);
            return false;
        } finally {
            refreshPromise = null;
        }
    })();
    
    return refreshPromise;
}

// --- API helper with automatic token refresh ---
// If a request returns 401 due to token expiration, try to refresh the token and retry once.
// returns 200 or 401 response if refresh fails.
export async function fetchWithRefreshAuth(url, options = {}) {
    options.credentials = 'include'; // Always include cookies
    let res = await fetch(url, options);
    
    // If unauthorized and error is token_expired, try to refresh
    if (res.status === 401) {
        const data = await res.json();
        console.log('Fetch unauthorized:', data);
        if (data.error === 'token_expired') {
            const refreshed = await refreshAccessToken();
            if (refreshed) {
                // Retry original request
                res = await fetch(url, options);
            }
        }
        else if (localStorage.getItem('username'))
        {
            const refreshed = await refreshAccessToken();
            if (refreshed) {
                // Retry original request
                res = await fetch(url, options);
            }
        }
    }
    return res;
}

// --- Auth helpers (Cookie-based JWT) ---
export async function registerUser(username, password) {
    const res = await fetch(`/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (res.ok && data.username) {
        localStorage.setItem('username', data.username);
        localStorage.setItem('user_id', data.id);
    }
    return data;
}

export async function loginUser(username, password) {
    const res = await fetch(`/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password })
    });
    const text = await res.text();
    if (!text) return { error: 'empty response from server' };
    const data = JSON.parse(text);
    if (res.ok && data.username) {
        localStorage.setItem('username', data.username);
        localStorage.setItem('user_id', data.id);
    }
    return data;
}

export async function logoutUser() {
    closeChat(); // close WebSocket — triggers disconnect() on backend
    await fetch('/api/auth/logout', { 
        method: 'POST',
        credentials: 'include'
    });
    localStorage.removeItem('username');
}

export async function getCurrentUser() {
    try {
        const res = await fetchWithRefreshAuth('/api/auth/me');
        if (res.ok) {
            const data = await res.json();
            if (data.authenticated && data.username) {
                localStorage.setItem('username', data.username);
                localStorage.setItem('user_id', data.id);
                return data;
            }
        }
    } catch (error) {
        console.error('Failed to get current user:', error);
    }
    return { authenticated: false };
}

// if the user is not authenticated, return true, else false
export async function checkAuthRequired() {
    const res = await fetchWithRefreshAuth('/api/auth/me', { method: 'GET', credentials: 'include' });
    if (res.ok) {
        const data = await res.json();
        console.log('Auth check:', data);
        if (data.authenticated) {
            localStorage.setItem('username', data.username);
            return false;
        }
    }
    return true;
}