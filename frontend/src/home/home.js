// hover:-translate-y-2
// hover:border-violet-500
// hover:shadow-lg
// hover:shadow-violet-500/40
// transition-all
// duration-200
import { navigate } from "../routes/route_helpers.js";

export function initHome() {
    const username = localStorage.getItem('username');

    document.getElementById('navAvatar').textContent = username.charAt(0).toUpperCase();
    document.getElementById('navUsername').textContent = username;


    //change depending on which mode you are. chess or pong.
    document.getElementById('profileNavBtn')?.addEventListener('click', () => navigate('/profile'));
    document.getElementById('aiBtn')?.addEventListener('click', () => navigate('/ai'));
    document.getElementById('onlineBtn')?.addEventListener('click', () => navigate('/online'));
    document.getElementById('localBtn')?.addEventListener('click', () => navigate('/local'));
}