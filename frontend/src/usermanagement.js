import { t, updatePageTranslations } from './i18n/index.js';
import { TranslationKey } from './i18n/keys.js';
import { closeChat } from './chat.js';

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
    const data = await res.json();
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

// --- User manager UI (minimisable tab) ---
export function createUserManager() {
    if (document.getElementById('userManager')) return;

    const container = document.createElement('div');
    container.id = 'userManager';

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'manager-btn';
    // toggleBtn.textContent = t(TranslationKey.UM_USER);
    toggleBtn.textContent = '👤'; // I could not make the translation here, can we change this like this ??? :)))))
    toggleBtn.title = 'Open user manager';
    
    // // Update button text when language changes
    // document.addEventListener('languagechange', () => {
    //     toggleBtn.textContent = t(TranslationKey.UM_USER);
    //     updatePageTranslations();
    // });

    const panel = document.createElement('div');
    panel.className = 'manager-panel';
    panel.style.display = 'none';

    function renderPanel() {
        getCurrentUser().then(user => {
            const username = localStorage.getItem('username') || '';
            const openChatBtn = document.getElementById('openChatBtn');
            panel.innerHTML = '';
            if (user.authenticated) {
                // User is logged in - show chat button
            if (openChatBtn) {
                openChatBtn.style.display = 'block';
            }
                
                const info = document.createElement('div');
                info.innerHTML = `<div><strong>${username || toggleBtn.textContent}</strong></div><div class="small" data-i18n="${TranslationKey.UM_LOGGED_IN}">Logged in</div>`;
                const logoutBtn = document.createElement('button');
                logoutBtn.className = 'manager-btn';
                logoutBtn.textContent = 'Logout';
                logoutBtn.addEventListener('click', async () => {
                    await logoutUser();
                    //refresh page to update UI based on auth state
                    location.reload();
                    renderPanel();
                });
                panel.appendChild(info);
                panel.appendChild(logoutBtn);
                updatePageTranslations();
                return;
            }
            
            // User is NOT logged in - hide chat button
            if (openChatBtn) {
                openChatBtn.style.display = 'none';
            }

            // Tabs: Login / Register
            const loginForm = document.createElement('div');
            loginForm.innerHTML = `
                <div style="font-weight:700;margin-bottom:6px" data-i18n="${TranslationKey.UM_LOGIN_TITLE}">Login</div>
                <input id="um_login_user" type="text" data-i18n-placeholder="${TranslationKey.UM_USERNAME_PLACEHOLDER}" />
                <input id="um_login_pass" type="password" data-i18n-placeholder="${TranslationKey.UM_PASSWORD_PLACEHOLDER}" />
                <button id="um_login_btn" class="manager-btn" data-i18n="${TranslationKey.UM_LOGIN_BTN}">Login</button>
            `;
            const regForm = document.createElement('div');
            regForm.style.marginTop = '8px';
            regForm.innerHTML = `
                <div style="font-weight:700;margin-bottom:6px" data-i18n="${TranslationKey.UM_REGISTER_TITLE}">Register</div>
                <input id="um_reg_user" type="text" data-i18n-placeholder="${TranslationKey.UM_USERNAME_PLACEHOLDER}" />
                <input id="um_reg_pass" type="password" data-i18n-placeholder="${TranslationKey.UM_PASSWORD_PLACEHOLDER}" />
                <button id="um_reg_btn" class="manager-btn" data-i18n="${TranslationKey.UM_REGISTER_BTN}">Register</button>
            `;

            updatePageTranslations();

            panel.appendChild(loginForm);
            panel.appendChild(regForm);

            panel.querySelector('#um_login_btn').addEventListener('click', async () => {
                const u = panel.querySelector('#um_login_user').value;
                const p = panel.querySelector('#um_login_pass').value;
                const res = await loginUser(u, p);
                if (res && res.success) {
                    alert('Login successful');
                    location.reload();
                    renderPanel();
                    // window.location.reload();
                } else {
                    alert(res.error || 'Login failed');
                }
            });

            panel.querySelector('#um_reg_btn').addEventListener('click', async () => {
                const u = panel.querySelector('#um_reg_user').value;
                const p = panel.querySelector('#um_reg_pass').value;
                const res = await registerUser(u, p);
                if (res && res.success) {
                    alert('Registration successful');
                    window.location.reload();
                } else {
                    alert(res.error || 'Registration failed');
                }
            });
        });
    }

    toggleBtn.addEventListener('click', () => {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });

    container.appendChild(toggleBtn);
    container.appendChild(panel);
    document.body.appendChild(container);
    renderPanel();
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