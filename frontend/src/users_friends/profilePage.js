import { navigate } from "../routes/route_helpers.js";
import { getCurrentUser, logoutUser, fetchWithRefreshAuth } from "./usermanagement.js";
import { fetchFriendsList, removeFriend, sendFriendRequest } from "./friends.js";
import { fetchPendingRequests, handleAccept, handleDelete } from "./friends.js";


export async function initProfilePage(){
    const user = await getCurrentUser();
    
    document.getElementById("profile-avatar").textContent = user.username.charAt(0).toUpperCase();
    document.getElementById("profile-username").textContent = user.username;

    const logoutBtn = document.getElementById("profile-logout");

    logoutBtn.addEventListener("click", async () =>{
        await logoutUser();
        navigate("/login");
    })

    document.getElementById("profile-stats")?.addEventListener("click", () => navigate("/stats"));
    addFriend();
    renderPendingRequests();
    renderFriendList();
    loadStats();

    // setInterval(() => {
    // renderPendingRequests();
    // }, 3000);
}

function loadStats() {
    fetchWithRefreshAuth('/api/player/me/stats')
        .then(r => r.json())
        .then(data => {
            const wins = document.getElementById('profile-wins');
            const losses = document.getElementById('profile-losses');
            const elo = document.getElementById('profile-elo');
            if (wins) wins.textContent = data.total_wins ?? 0;
            if (losses) losses.textContent = data.total_losses ?? 0;
            if (elo) elo.textContent = data.elo_rating ?? 0;
        })
        .catch(() => {});
}

function addFriend(){

    const addFriendBtn = document.getElementById("friend-add-btn");

    addFriendBtn.addEventListener("click", () => {

        const friendInput = document.getElementById("friend-input");
        if (!friendInput)
        {
            console.log("friendInput not loaded");
            return;
        }
        const friendInputStr = friendInput.value;
        const status = document.getElementById("friend-status");
    
        sendFriendRequest(friendInputStr, status);
    })
}

async function renderPendingRequests(){
    const requests = await fetchPendingRequests();
    const container = document.getElementById("pending-list")
    const template = document.getElementById("pending-request-template");

    container.innerHTML = "";
    if (requests.length === 0)
        return;

    requests.forEach(req => {
        const wrapDiv = document.createElement("div");
        wrapDiv.innerHTML = template.innerHTML;
        const row = wrapDiv.firstElementChild;

        row.querySelector(".pending-username").textContent = req.from_user__username;
        row.querySelector(".pending-avatar").textContent = req.from_user__username.charAt(0).toUpperCase();

        row.querySelector(".accept-btn").addEventListener("click", async () => {
            await handleAccept(req.id);
            renderPendingRequests();
            renderFriendList();
        })

        row.querySelector(".decline-btn").addEventListener("click", async () => {
            await handleDelete(req.id);
            renderPendingRequests();
        })

        container.appendChild(row);
    })
}

async function renderFriendList(){
    const container = document.getElementById("friends-list");
    const {offlineFriends, onlineFriends} = await fetchFriendsList();
    const allFriends = [...onlineFriends, ...offlineFriends];
    const template = document.getElementById("friend-template");
    
    container.innerHTML = "";

    if(allFriends.length === 0)
        return;

    allFriends.forEach(friend => {
        const wrapDiv = document.createElement("div");
        wrapDiv.innerHTML = template.innerHTML;
        const row = wrapDiv.firstElementChild;

        row.querySelector(".friend-username").textContent = friend.username;
        row.querySelector(".friend-avatar").textContent = friend.username.charAt(0).toUpperCase();

        row.querySelector(".remove-btn").addEventListener("click", async () => {
            await removeFriend(friend.id);
            renderFriendList();
        })

        container.appendChild(row);
    })

}