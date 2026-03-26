import { loginUser } from "./usermanagement";
import { navigate } from "./main.js" 
import { showError } from "./utils.js";

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
        if(result.username)
            window.location.href = "/";
        else
            showError("Invalid username or password, please try again.");
    })
    const createAccountBtn = document.getElementById("login-create-account");
    
	if(createAccountBtn)
	{
		createAccountBtn.addEventListener("click", () => {
		navigate("/register");
	})
	}
	       

}

