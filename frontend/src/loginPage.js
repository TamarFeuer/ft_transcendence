import { loginUser } from "./usermanagement";
import { navigate } from "./main.js"
import { initChat } from "./chat.js";

export function initLoginPage(){
    const form = document.getElementById("login-form");
    if (!form)
        return;
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const username = document.getElementById("login-username").value.trim();
        const password = document.getElementById("login-password").value.trim();
        
        if(!username || !password)
            return;
        
        const result = await loginUser(username, password);
        if(result.username){
            navigate("/");
            initChat();
            window.dispatchEvent(new Event("userLoggedIn"));
        }
        //if not logged in correct show message accordingly.
    })
    const createAccountBtn = document.getElementById("login-create-account");
    
	if(createAccountBtn)
	{
		createAccountBtn.addEventListener("click", () => {
		navigate("/register");
	})
	}
	       

}

