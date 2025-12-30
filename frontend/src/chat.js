import { getNameFromId } from "./fakeUsers.js"; 

let chatSocket = null;
let myUserId = null;
let myUserName = null;
export let onlineUsers = [];
let typingTimeout = null;
let typingUsers = new Set();

export function initChat() {
	console.log("initChat() called");

	chatSocket = new WebSocket(
		`${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws/chat/?userId=${CURRENT_USER.id}`
	);

	chatSocket.onopen = () => console.log("Connected to chat");
	chatSocket.onclose = () => console.log("Chat disconnected");

	chatSocket.onmessage = (ev) => {
		const data = JSON.parse(ev.data);

		if (data.type === "self_id") {
			myUserId = data.user_id; // store full ID for logic
			myUserName = getNameFromId(myUserId); // lookup name from ID, for display
			
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
			console.log("My user ID:", myUserId);
			
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
		console.log("Online users updated:", onlineUsers);
		}
		
		if (data.type === "typing_indicator") {
			handleTypingIndicator(data.user_id, data.typing);
		}
	};
}

export function sendChatMessage(message, target = null) {
	if (!chatSocket || chatSocket.readyState !== WebSocket.OPEN) {
		console.warn("Chat socket not ready");
		return;
	}
	const payload = { message };
	if (target) payload.target = target;
	chatSocket.send(JSON.stringify(payload));
}

export function sendTypingIndicator(isTyping) {
	if (!chatSocket || chatSocket.readyState !== WebSocket.OPEN) {
		return;
	}
	chatSocket.send(JSON.stringify({
		type: "typing",
		typing: isTyping
	}));
}

function handleTypingIndicator(userId, isTyping) {
	// Don't show typing indicator for self
	if (userId === myUserId) {
		return;
	}
	
	if (isTyping) {
		typingUsers.add(userId);
	} else {
		typingUsers.delete(userId);
	}
	
	updateTypingIndicatorUI();
}

function updateTypingIndicatorUI() {
	const chatMessages = document.getElementById("chatMessages");
	if (!chatMessages) return;
	
	let typingDiv = document.getElementById("typingIndicator");
	
	if (typingUsers.size === 0) {
		// Hide typing indicator
		if (typingDiv) {
			typingDiv.remove();
		}
		return;
	}
	
	// Show typing indicator
	if (!typingDiv) {
		typingDiv = document.createElement("div");
		typingDiv.id = "typingIndicator";
		typingDiv.style.color = "#888";
		typingDiv.style.fontStyle = "italic";
		typingDiv.style.fontSize = "0.85rem";
		typingDiv.style.padding = "4px 0";
		chatMessages.appendChild(typingDiv);
	}
	
	const userNames = Array.from(typingUsers).map(id => getNameFromId(id));
	const text = userNames.length === 1 
		? `${userNames[0]} is typing...`
		: `${userNames.join(", ")} are typing...`;
	
	typingDiv.textContent = text;
	chatMessages.scrollTop = chatMessages.scrollHeight;
}
