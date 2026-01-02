


// --- Auth helpers (JWT) ---
export async function registerUser(username, password) {
    const res = await fetch(`/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    return await res.json();
}

export async function loginUser(username, password) {
    const res = await fetch(`/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (res.ok && data.token) {
        localStorage.setItem('jwt', data.token);
        localStorage.setItem('username', data.username || username);
    }
    return data;
}

export function logoutUser() {
    localStorage.removeItem('jwt');
    localStorage.removeItem('username');
}

// --- User manager UI (minimisable tab) ---
export function createUserManager() {
    if (document.getElementById('userManager')) return;

    const container = document.createElement('div');
    container.id = 'userManager';

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'manager-btn';
    toggleBtn.textContent = 'User';
    toggleBtn.title = 'Open user manager';

    const panel = document.createElement('div');
    panel.className = 'manager-panel';
    panel.style.display = 'none';

    function renderPanel() {
        const token = localStorage.getItem('jwt');
        const username = localStorage.getItem('username') || '';
        panel.innerHTML = '';
        if (token) {
            const info = document.createElement('div');
            info.innerHTML = `<div><strong>${username || 'User'}</strong></div><div class="small">Logged in</div>`;
            const logoutBtn = document.createElement('button');
            logoutBtn.className = 'manager-btn';
            logoutBtn.textContent = 'Logout';
            logoutBtn.addEventListener('click', async () => {
                await fetch('/api/auth/logout', { method: 'POST' });
                logoutUser();
                renderPanel();
            });
            panel.appendChild(info);
            panel.appendChild(logoutBtn);
            return;
        }

        // Tabs: Login / Register
        const loginForm = document.createElement('div');
        loginForm.innerHTML = `
            <div style="font-weight:700;margin-bottom:6px">Login</div>
            <input id="um_login_user" type="text" placeholder="username" />
            <input id="um_login_pass" type="password" placeholder="password" />
            <button id="um_login_btn" class="manager-btn">Login</button>
        `;
        const regForm = document.createElement('div');
        regForm.style.marginTop = '8px';
        regForm.innerHTML = `
            <div style="font-weight:700;margin-bottom:6px">Register</div>
            <input id="um_reg_user" type="text" placeholder="username" />
            <input id="um_reg_pass" type="password" placeholder="password" />
            <button id="um_reg_btn" class="manager-btn">Register</button>
        `;

        panel.appendChild(loginForm);
        panel.appendChild(regForm);

        panel.querySelector('#um_login_btn').addEventListener('click', async () => {
            const u = panel.querySelector('#um_login_user').value;
            const p = panel.querySelector('#um_login_pass').value;
            const res = await loginUser(u, p);
            if (res && res.token) {
                alert('Login successful');
                renderPanel();
            } else {
                alert(res.error || 'Login failed');
            }
        });

        panel.querySelector('#um_reg_btn').addEventListener('click', async () => {
            const u = panel.querySelector('#um_reg_user').value;
            const p = panel.querySelector('#um_reg_pass').value;
            const res = await registerUser(u, p);
            if (res && res.token) {
                localStorage.setItem('jwt', res.token);
                localStorage.setItem('username', res.username || u);
                alert('Registration successful');
                renderPanel();
            } else {
                alert(res.error || 'Registration failed');
            }
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
