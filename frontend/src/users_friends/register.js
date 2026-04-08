import { registerUser } from "./usermanagement"
import { navigate } from "../routes/route_helpers"
import { showError } from "../utils/utils";

export function registerPage(){
    const form = document.getElementById("register-form");
    
    if(!form)
        return;
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const username = document.getElementById("register-username").value.trim();
        const password = document.getElementById("register-password").value.trim();

        if(!username || !password)
            return;

        const validUser = /^[a-zA-Z0-9_]+$/;
        if(!validUser.test(username)){
            showError("Username may only contain letters, numbers, and underscores.");
            return;
        }

        if(username.length < 3 || username.length > 20)
        {
            showError("Username must be between 3 and 20 characters.");
            return;
        }

        if(password.length < 3 || password.length > 72)
        {
            showError("Password must be between 3 and 72 characters.");
            return;
        }

        const result = await registerUser(username, password);

        if (result.error) {
            showError(result.error);
            return;
        }
        if(result.username)
            window.location.href = "/";
    })

    const backLoginBtn = document.getElementById("register-back-login");
    if(!backLoginBtn)
        return;
    backLoginBtn.addEventListener("click", () => {
        navigate("/login");
    })

}