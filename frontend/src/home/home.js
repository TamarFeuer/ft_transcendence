import { navigate } from "../routes/route_helpers.js";

export function initHome() {
    const username = localStorage.getItem('username');
    
    document.getElementById('navAvatar').textContent = username.charAt(0).toUpperCase();
    document.getElementById('navUsername').textContent = username;
    const mode = localStorage.getItem('gameMode') || 'pong';

    if(mode === 'chess'){
        const toggleBtn = document.getElementById('toggle-btn');
        
        toggleBtn.style.left = '';
        toggleBtn.style.right = '0.25rem';
        document.getElementById("pong") = "text-zinc-500 font-semibold text-xl";
        document.getElementById("chess") = "text-white font-semibold text-xl";
        }
    
    document.getElementById("toggle-game-mode").addEventListener('click', () => {
        const current = localStorage.getItem('gameMode') || 'pong';
        const pongText = document.getElementById("pong");
        const chessText = document.getElementById("chess")

        let newMode;

        if (current === 'pong')
            newMode = 'chess';
        else
            newMode = 'pong';
        localStorage.setItem('gameMode', newMode);

        const toggleBtn = document.getElementById('toggle-btn');

        if(newMode === 'chess'){
            toggleBtn.style.left = '';
            toggleBtn.style.right = '0.25rem';
            pongText.className = "text-zinc-500 font-semibold text-xl";
            chessText.className = "text-white font-semibold text-xl";
        }
        else{
            toggleBtn.style.left = '0.25rem';
            toggleBtn.style.right = '';
            pongText.className = "text-white font-semibold text-xl";
            chessText.className = "text-zinc-500 font-semibold text-xl";
        }
    })

    document.getElementById('profileNavBtn')?.addEventListener('click', () => navigate('/profile'));

    
    document.getElementById('aiBtn')?.addEventListener('click', () => {
        const mode = localStorage.getItem('gameMode') || 'pong';
        if(mode === 'pong')
            navigate('/ai');
    });

    document.getElementById('onlineBtn')?.addEventListener('click', () => {
        const mode = localStorage.getItem('gameMode') || 'pong';
        
        if (mode === 'pong')
            navigate('/online');
        else
            navigate('/online-chess');
    });

    document.getElementById('localBtn')?.addEventListener('click', () => {
        const mode = localStorage.getItem('gameMode') || 'pong';
        
        if(mode === 'pong')
            navigate('/local')
        else
            navigate('/chess');
    });
}