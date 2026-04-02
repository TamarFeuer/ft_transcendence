import { navigate } from "./main";
import { getCurrentUser, logoutUser } from "./usermanagement";
import { sendFriendRequest } from "./friends";


export async function initProfilePage(){
    const user = await getCurrentUser();
    
    document.getElementById("profile-avatar").textContent = user.username.charAt(0).toUpperCase();
    document.getElementById("profile-username").textContent = user.username;

    const logoutBtn = document.getElementById("profile-logout");

    logoutBtn.addEventListener("click", async () =>{
        await logoutUser();
        navigate("/login");
    })

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
