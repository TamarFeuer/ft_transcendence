import { navigate } from "../routes/route_helpers.js";
import { setChessOnlineIntended } from "../routes/routes.js";

export function initHome() {
    const username = localStorage.getItem('username');
    
    document.getElementById('navAvatar').textContent = username.charAt(0).toUpperCase();
    document.getElementById('navUsername').textContent = username;
    const mode = localStorage.getItem('gameMode') || 'pong';
    updateAiBtnForMode(mode);

    if(mode === 'chess'){
        const toggleBtn = document.getElementById('toggle-btn');
        
        toggleBtn.style.left = '';
        toggleBtn.style.right = '0.25rem';
        document.getElementById("pong").className = "text-zinc-500 font-semibold text-xl";
        document.getElementById("chess").className = "text-white font-semibold text-xl";
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
        updateAiBtnForMode(newMode);

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
            openOnlinePanel();
        else{
            setChessOnlineIntended();
            navigate('/chess-online');
        }
    });

    document.getElementById('online-close-btn')?.addEventListener('click', () => closeOnlinePanel());
    document.getElementById('online-backdrop')?.addEventListener('click', () => closeOnlinePanel());

    document.getElementById('play-ranked-btn')?.addEventListener('click', () => navigate('/online'));
    document.getElementById('play-tournament-btn')?.addEventListener('click', () => navigate('/tournament'));

    document.getElementById('localBtn')?.addEventListener('click', () => {
        const mode = localStorage.getItem('gameMode') || 'pong';

        if(mode === 'pong')
            navigate('/local')
        else
            navigate('/chess');
    });

    document.addEventListener('keydown', (e) => {
        if(e.key === 'Escape')
            closeOnlinePanel();
    })
}

function updateAiBtnForMode(mode){
    const aiBtn = document.getElementById('aiBtn');

    if(mode === 'chess')
        aiBtn.classList.add('opacity-40', 'pointer-events-none');
    else
        aiBtn.classList.remove('opacity-40', 'pointer-events-none');
}

function openOnlinePanel(){
    document.getElementById('online-backdrop').classList.remove('opacity-0', 'pointer-events-none');
    document.getElementById('online-panel').classList.remove('translate-x-full');
}

function closeOnlinePanel(){
    document.getElementById('online-backdrop').classList.add('opacity-0', 'pointer-events-none');
    document.getElementById('online-panel').classList.add('translate-x-full');
}