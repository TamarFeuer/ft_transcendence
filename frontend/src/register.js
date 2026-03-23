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
        

        const result = await registerUser(username, password);

        if(result.username)
            navigate("/home");
    })

    const backLoginBtn = document.getElementById("register-back-login");
    if(!backLoginBtn)
        return;
    backLoginBtn.addEventListener("click", () => {
        navigate("/");
    })

}