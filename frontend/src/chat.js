let chatSocket = null;
let myChannelId = null;

export function initChat() {
	console.log("initChat() called");

	chatSocket = new WebSocket(
		`${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws/chat/`
	);

	chatSocket.onopen = () => console.log("Connected to chat");
	chatSocket.onclose = () => console.log("Chat disconnected");

	chatSocket.onmessage = (ev) => {
		const data = JSON.parse(ev.data);

		if (data.type === "self_id") {
			myChannelId = data.channel_name; // store full ID for logic
			
			// Strip the "specific..inmemory!" prefix for display
			const displayId = data.channel_name.replace(/^specific\.\.inmemory!/, "");
			
			const container = document.getElementById("chatContainer");
			if (container) {
				let idDiv = document.getElementById("myChannelId");
				if (!idDiv) {
					idDiv = document.createElement("div");
					idDiv.id = "myChannelId";
					idDiv.style.fontSize = "10px";
					idDiv.style.color = "lightgray";
					container.prepend(idDiv);
				}
				idDiv.innerHTML = `<span style="color:#00FF00"> ID: ${displayId}</span>`;
			}
		}

		if (data.type === "chat") {
			console.log("Incoming chat message:", data);
   			console.log("My channel ID:", myChannelId);
			
			const chatMessages = document.getElementById("chatMessages");
			if (!chatMessages) return;
			
			const msgDiv = document.createElement("div");
			
			// Decide sender display
			let sender = data.sender.replace(/^specific\.\.inmemory!/, "");
			if (data.sender === myChannelId) {
				sender = "Me";
				msgDiv.style.color = "#00FF00";;
			}
			
			msgDiv.textContent = `${sender}: ${data.message}`;
			chatMessages.appendChild(msgDiv);
			chatMessages.scrollTop = chatMessages.scrollHeight;
		}
	};
}

export function sendChatMessage(message, target = null) {
	if (!chatSocket || chatSocket.readyState !== WebSocket.OPEN) {
		console.warn("Chat socket not ready");
		return;
	}
	const payload = { message };
	if (target) payload.target = target;  // optional
	chatSocket.send(JSON.stringify(payload));
}
