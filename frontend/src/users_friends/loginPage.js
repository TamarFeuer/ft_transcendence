import { loginUser } from "./usermanagement";
import { navigate } from "../routes/route_helpers.js"
import { showError } from "../utils/utils.js";
import { t } from "../i18n/index.js";

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
        else if (result.error === 'Too many failed attempts. Try again in 3 minutes')
            showError(t('LOGIN_TOO_MANY'));
        else if (result.error === 'invalid credentials')
            showError(t('LOGIN_INVALID'));
        else if (result.error)
            showError(result.error);
        else
            showError(t('LOGIN_INVALID'));
    })
    const createAccountBtn = document.getElementById("login-create-account");
    
	if(createAccountBtn)
	{
		createAccountBtn.addEventListener("click", () => {
		navigate("/register");
	})
	}

    const termsLink = document.getElementById("login-terms-link");
    if (termsLink) {
        termsLink.addEventListener("click", (event) => {
            event.preventDefault();
            navigate("/terms-of-service");
        });
    }

    const privacyLink = document.getElementById("login-privacy-link");
    if (privacyLink) {
        privacyLink.addEventListener("click", (event) => {
            event.preventDefault();
            navigate("/privacy-policy");
        });
    }
}
