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
        localStorage.setItem('gameMode', newMode);

        const toggleBtn = document.getElementById('toggle-btn');

        if(newMode === 'chess'){
            toggleBtn.style.left = '';
            toggleBtn.style.right = '0.25rem';
        }
        else{
            toggleBtn.style.left = '0.25rem';
            toggleBtn.style.right = '';
        }
    })

    document.getElementById('profileNavBtn')?.addEventListener('click', () => navigate('/profile'));

    
    document.getElementById('aiBtn')?.addEventListener('click', () => {
        const mode = localStorage('gameMode');
        if(mode === 'pong')
            navigate('ai');
    });

    document.getElementById('onlineBtn')?.addEventListener('click', () => {
        const mode = localStorage('gameMode');
        
        if (mode === 'pong')
            navigate('/online');
        else
            navigate('online-chess');
    });


    nagivate('chess')
    document.getElementById('localBtn')?.addEventListener('click', () => {
        const mode = localStorage('gameMode');
        
        if(mode === 'pong')
            navigate('/local')
        else
            navigate('chess');
    });
}