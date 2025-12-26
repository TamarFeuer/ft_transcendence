let chatSocket = null;

export function initChat() {
  console.log("initChat() called");

  chatSocket = new WebSocket(
    `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws/chat/`
  );

  chatSocket.onopen = () => console.log("Connected to chat");
  chatSocket.onclose = () => console.log("Chat disconnected");

  chatSocket.onmessage = (ev) => {
    const data = JSON.parse(ev.data);
    if (data.type === "chat") {
      console.log("Chat message:", data.message);
    }
  };
}

export function sendChatMessage(message) {
  if (!chatSocket || chatSocket.readyState !== WebSocket.OPEN) {
    console.warn("Chat socket not ready");
    return;
  }
  chatSocket.send(JSON.stringify({ message }));
}