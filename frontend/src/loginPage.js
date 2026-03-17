import { loginUser } from "./usermanagement";

export function initLoginPage(){
    const form = document.getElementById("login-form");
    if (!form)
        return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById("login-username").value.trim;
        const password = document.getElementById("login-password").value.trim;
        
        if(!username || !password)
            return;
        
        const result = await loginUser(username, password);
    })
}

