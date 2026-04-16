import { navigate } from "../routes/route_helpers.js";

export function initHome() {
    const username = localStorage.getItem('username');
    
    document.getElementById('navAvatar').textContent = username.charAt(0).toUpperCase();
    document.getElementById('navUsername').textContent = username;
    
    
    document.getElementById("toggle-game-mode").addEventListener('click', () => {
        const current = localStorage.getItem('gameMode') || 'pong';
        let newMode;
        if (current === 'pong')
            newMode = 'chess';
        else
            newMode = 'pong';

        const toggleBtn = document.getElementById('toggle=btn');
    })

    //change depending on which mode you are. chess or pong.
    document.getElementById('profileNavBtn')?.addEventListener('click', () => navigate('/profile'));
    document.getElementById('aiBtn')?.addEventListener('click', () => navigate('/ai'));
    document.getElementById('onlineBtn')?.addEventListener('click', () => navigate('/online'));
    document.getElementById('localBtn')?.addEventListener('click', () => navigate('/local'));
}