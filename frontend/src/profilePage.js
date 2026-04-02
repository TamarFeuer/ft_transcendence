import { navigate } from "./main";
import { getCurrentUser, logoutUser } from "./usermanagement";


export async function initProfilePage(){
    const user = await getCurrentUser();
    
    document.getElementById("profile-avatar").textContent = user.username.charAt(0).toUpperCase();
    document.getElementById("profile-username").textContent = user.username;

    const logoutBtn = document.getElementById("profile-logout");

    logoutBtn.addEventListener("click", async () =>{
        await logoutUser();
        navigate("/login");
    })
}

