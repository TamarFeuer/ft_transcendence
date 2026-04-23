import { navigate } from "../routes/route_helpers.js";
import { logoutUser, fetchWithRefreshAuth } from "./usermanagement.js";
import { fetchFriendsList, removeFriend, sendFriendRequest } from "./friends.js";
import { fetchPendingRequests, handleAccept, handleDelete } from "./friends.js";


export async function initProfilePage(username){
    let isSelf = false;

    if (!username)
    {
        username = localStorage.getItem('username');
        isSelf = true;
    }

    const profile = await fetchProfile(username);
    if (!profile) return;

    renderUser(profile);
    renderStats(profile);

    if (isSelf) setupOwnProfile();
    else hideOwnProfileSections();
}

async function fetchProfile(username){
    const res = await fetchWithRefreshAuth(`/api/player/${username}/profile`);
    if (res.status === 404){
        navigate('/');
        return;
    }
    return res.json();
}

function renderUser(profile){
    document.getElementById("profile-avatar").textContent = profile.username.charAt(0).toUpperCase();
    document.getElementById("profile-username").textContent = profile.username;
}

function renderStats(profile){
    document.getElementById('pong-wins').textContent = profile.pong.wins;
    document.getElementById('pong-losses').textContent = profile.pong.losses;
    document.getElementById('pong-elo').textContent = profile.pong.elo;

    document.getElementById('chess-wins').textContent = profile.chess.wins;
    document.getElementById('chess-losses').textContent = profile.chess.losses;
    document.getElementById('chess-elo').textContent = profile.chess.elo;
}

function setupOwnProfile(){
    setupLogoutButton();
    setupStatsNavButton();
    setupAddFriend();
    renderPendingRequests();
    renderFriendList();
}

function hideOwnProfileSections(){
    document.getElementById('own-profile-sections')?.remove();
}

function setupLogoutButton(){
    const logoutBtn = document.getElementById("profile-logout");
    logoutBtn.addEventListener("click", async () => {
        await logoutUser();
        navigate("/login");
    });
}

function setupStatsNavButton(){
    document.getElementById("profile-stats")?.addEventListener("click", () => navigate("/stats"));
}

function setupAddFriend(){
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
    });
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
