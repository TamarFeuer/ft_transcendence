import { registerUser } from "./usermanagement"
import { navigate } from "./main"

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
            alert("invalid username!");
            return;
        }

        if(username.length < 3 || username.length > 20)
        {
            alert("Username must be between 3 and 20 characters.");
            return;
        }

        if(password.length < 3 || password.length > 72)
        {
            alert("Password must be between 3 and 72 characters.");
            return;
        }

        const result = await registerUser(username, password);

        if (result.error) {
            alert(result.error);
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