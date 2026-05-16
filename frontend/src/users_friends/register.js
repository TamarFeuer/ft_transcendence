import { registerUser } from "./usermanagement"
import { navigate } from "../routes/route_helpers"
import { showError } from "../utils/utils";
import { t } from "../i18n/index.js";

export function registerPage(){
    const form = document.getElementById("register-form");
    
    if(!form)
        return;
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("register-email").value.trim();
        const username = document.getElementById("register-username").value.trim();
        const password = document.getElementById("register-password").value.trim();
        const legalAccepted = document.getElementById("register-legal-accept")?.checked;
            console.log("Hi0");

        if(!email|| !username || !password)
            return;

        const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const validUser = /^[a-zA-Z0-9_]+$/;
            console.log("Hi1");

        if(!validEmail.test(email)){
            showError(t('REG_INVALID_EMAIL'));
            console.log("Hi2");
            return;
        }

        if(!validUser.test(username)){
            showError(t('REG_INVALID_CHARS'));
            return;
        }

        if(username.length < 3 || username.length > 20)
        {
            showError(t('REG_USERNAME_LENGTH'));
            return;
        }

        if(password.length < 3 || password.length > 72)
        {
            showError(t('REG_PASSWORD_LENGTH'));
            return;
        }

        if (!legalAccepted) {
            showError(t('REG_ACCEPT_TERMS'));
            return;
        }
            console.log("Hi3");

        const result = await registerUser(email, username, password);

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
