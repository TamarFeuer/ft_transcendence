import { navigate } from "../routes/route_helpers.js";

export function showMessage(message, type = 'info', duration = 2500) {
  const containerId = 'Message-container';
  let container = document.getElementById(containerId);

  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    container.className = 'fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none';

    document.body.appendChild(container);
  }

  const typeClass = {
    success: 'bg-green-600 border-green-400',
    error: 'bg-red-600 border-red-400',
    info: 'bg-blue-600 border-blue-400'
  };

  const Message = document.createElement('div');
  Message.className = `pointer-events-auto text-white px-4 py-2 rounded-md border shadow-lg ${typeClass[type] || typeClass.info}`;
  Message.textContent = message;
  container.appendChild(Message);

  setTimeout(() => {
    Message.remove();
    if (container && container.childElementCount === 0) {
      container.remove();
    }
  }, duration);
}

export function showError(message){
    const errorPopup = document.getElementById("error-message");
    errorPopup.textContent = message;
    errorPopup.classList.remove("hidden");
    setTimeout(() =>{
        errorPopup.classList.add("hidden")
    }, 4000);
}

export function arrowHomeButton(){
  document.getElementById("back-btn")?.remove();
  
  const btn = document.createElement("button");
  btn.id = "back-btn";
  btn.innerHTML = "&larr;";
  btn.className = "fixed top-6 left-6 z-50 text-3xl font-black text-violet-400 hover:text-white transition duration-200 hover:scale-110";
  btn.style.webkitTextStroke = "2px currentColor";
  btn.addEventListener("click", () => {
    navigate("/");
  })

  document.body.appendChild(btn);
} 