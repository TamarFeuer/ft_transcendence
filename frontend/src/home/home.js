import { navigate } from "../routes/route_helpers.js";

export function initHome() {
    const username = localStorage.getItem('username');
    const mode = localStorage.getItem('gameMode') || 'pong';

    document.getElementById('navAvatar').textContent = username.charAt(0).toUpperCase();
    document.getElementById('navUsername').textContent = username;


    //change depending on which mode you are. chess or pong.
    document.getElementById('profileNavBtn')?.addEventListener('click', () => navigate('/profile'));
    document.getElementById('aiBtn')?.addEventListener('click', () => navigate('/ai'));
    document.getElementById('onlineBtn')?.addEventListener('click', () => navigate('/online'));
    document.getElementById('localBtn')?.addEventListener('click', () => navigate('/local'));
}