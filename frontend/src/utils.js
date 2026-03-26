export function showError(message){
    const errorPopup = document.getElementById("error-message");
    errorPopup.textContent = message;
    errorPopup.classList.remove("hidden");
    setTimeout(() =>{
        errorPopup.classList.add("hidden")
    }, 4000);
}