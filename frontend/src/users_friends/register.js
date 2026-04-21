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
        const legalAccepted = document.getElementById("register-legal-accept")?.checked;

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

        if (!legalAccepted) {
            showError("You must accept the Terms of Service and Privacy Policy.");
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

    const termsLink = document.getElementById("register-terms-link");
    if (termsLink) {
        termsLink.addEventListener("click", (event) => {
            event.preventDefault();
            navigate("/terms-of-service");
        });
    }

    const privacyLink = document.getElementById("register-privacy-link");
    if (privacyLink) {
        privacyLink.addEventListener("click", (event) => {
            event.preventDefault();
            navigate("/privacy-policy");
        });
    }

}
