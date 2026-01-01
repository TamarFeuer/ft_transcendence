import { FAKE_USERS, getNameFromId } from "./fakeUsers.js";

let chatSocket = null;
let myUserId = null;
let myUserName = null;
export let onlineUsers = [];

export function initChat() {
	
	// Create WebSocket
	chatSocket = new WebSocket(
		`${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws/chat/?userId=${CURRENT_USER.id}`
	);
	
	// Store it
	FAKE_USERS[CURRENT_USER.id].socket = chatSocket;
	chatSocket.onopen = () => console.log("Connected to chat");
	
	chatSocket.onclose = () => 
	{
		console.log("Chat disconnected");
		FAKE_USERS[CURRENT_USER.id].socket = null; // reset socket
	}

	chatSocket.onmessage = (ev) => {
		const data = JSON.parse(ev.data);

		if (data.type === "self_id") {
			myUserId = data.user_id; // store full ID for logic
			myUserName = getNameFromId(myUserId); // lookup name from ID, for display
			console.log("User ID:", myUserId);
			console.log("User name:", myUserName);

			const container = document.getElementById("chatContainer");
			if (container) {
				let idDiv = document.getElementById("myUserId");
				if (!idDiv) {
					idDiv = document.createElement("div");
					idDiv.id = "myUserId";
					idDiv.style.fontSize = "10px";
					idDiv.style.color = "lightgray";
					container.prepend(idDiv);
				}
				idDiv.innerHTML = `<span style="color:#00FF00; font-size: 0.9rem; margin-left: 8px;">
					${myUserName}
				</span>`;
			}
		}

		if (data.type === "chat") {
			console.log("Incoming chat message:", data);

			const chatMessages = document.getElementById("chatMessages");
			if (!chatMessages) return;

			const msgDiv = document.createElement("div");

			// Decide sender display
			let sender = getNameFromId(data.sender);
			if (data.sender === myUserId) {
				sender = "Me";
				msgDiv.style.color = "#00FF00";
			}

			msgDiv.textContent = `${sender}: ${data.message}`;
			chatMessages.appendChild(msgDiv);
			chatMessages.scrollTop = chatMessages.scrollHeight;
		}

		if (data.type === "online_users") {
			onlineUsers = data.users; // store current online users
		}
		
		if (data.type === "typing") {
			console.log(`${getNameFromId(data.user)} is typing...`);
			// TODO: show typing indicator in UI
		}

		if (data.type === "stop_typing") {
			console.log(`${getNameFromId(data.user)} stopped typing`);
			// TODO: hide typing indicator in UI
		}
	};
}

export function sendChatMessage(message, target = null) {
	if (!chatSocket || chatSocket.readyState !== WebSocket.OPEN) {
		console.warn("Chat socket not ready");
		return;
	}
	const payload = { type: "chat", message };
	if (target) payload.target = target;
	chatSocket.send(JSON.stringify(payload));
}

// Typing indicator
export function initTyping(chatInput) {
	if (!chatInput) return;
	if (!chatSocket) {
		console.warn("Typing init: chatSocket not ready yet");
		return;
	}

	let typingTimeout;

	// Only attach after socket is open
	chatSocket.addEventListener("open", () => {
		chatInput.addEventListener("input", () => {
			if (!chatSocket || chatSocket.readyState !== WebSocket.OPEN) return;

			// Notify server that user is typing
			chatSocket.send(JSON.stringify({ type: "typing", user: CURRENT_USER.id }));

			// Reset timeout
			clearTimeout(typingTimeout);
			typingTimeout = setTimeout(() => {
				if (chatSocket.readyState === WebSocket.OPEN) {
					chatSocket.send(JSON.stringify({ type: "stop_typing", user: CURRENT_USER.id }));
				}
			}, 1000); // 1 second after last keystroke
		});
	});
}
