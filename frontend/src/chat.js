export let chatSocket = null;      // The WebSocket connection
let chatInitialized = false;
let myUserId = null;        // ID of the current user
let myUserName = null;      // Name of the current user
export let onlineUsers = []; // List of online users from backend

export function initChat() {
	
	if (chatInitialized) return;
    chatInitialized = true;
	
	 // Read current user from window (set in main.js)
	const CURRENT_USER = window.CURRENT_USER;

	if (!CURRENT_USER) {
		console.error("No current user available. Did you fetch it in main.js?");
		return;
	}
	
	// Create WebSocket connection
	chatSocket = new WebSocket(
		`${location.protocol === "http:" ? "ws:" : "wss:"}//${location.host}/ws/chat/`
	);

	// Log connection status
	chatSocket.onopen = () => {
		console.log("Connected to chat");
		chatSocket.send(JSON.stringify({
		type: "identify",
		userId: CURRENT_USER.user_id,
		name: CURRENT_USER.username,
		token: CURRENT_USER.access_token
		}));
	}
		
	chatSocket.onclose = () => console.log("Chat disconnected");

	// Handle incoming messages from backend
	chatSocket.onmessage = (ev) => {
		const data = JSON.parse(ev.data);

		// --- Step 1: Receive self ID and optional user info ---
		if (data.type === "self_id") {
			myUserId = data.user_id;
			myUserName = data.name || "Guest"; // backend can send name

			console.log("User ID:", CURRENT_USER.user_id);
			console.log("User name:", CURRENT_USER.username);

			// Display current user in UI
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
					${CURRENT_USER.username}
				</span>`;
			}
		}

		// --- Step 2: Global or private chat message ---
		if (data.type === "chat") {
			console.log("Incoming chat message:", data);

			const chatMessages = document.getElementById("chatMessages");
			if (!chatMessages) return;

			const msgDiv = document.createElement("div");

			// Use sender name from backend if provided
			let senderName = data.name || data.sender; // fallback to ID if no name
			if (data.sender === myUserId) {
				senderName = "Me";          // show "Me" for own messages
				msgDiv.style.color = "#00FF00"; // optional styling
			}

			msgDiv.textContent = `${senderName}: ${data.message}`;
			chatMessages.appendChild(msgDiv);

			// Scroll to bottom
			chatMessages.scrollTop = chatMessages.scrollHeight;
		}

		// --- Step 3: Online users update ---
		if (data.type === "online_users") {
			  console.log("Received online_users message:", data.users);
			onlineUsers = data.users; // array of {id, name, avatar, createdAt} from backend
		}

		// --- Step 4: Typing notifications ---
		if (data.type === "typing") {
			console.log(`${data.name || data.user} is typing...`);
			// TODO: show typing indicator in UI
		}

		if (data.type === "stop_typing") {
			console.log(`${data.name || data.user} stopped typing`);
			// TODO: hide typing indicator in UI
		}
	};
}

// --- Send a chat message (global or private) ---
export function sendChatMessage(message, target = null) {
	if (!chatSocket || chatSocket.readyState !== WebSocket.OPEN) {
		console.warn("Chat socket not ready");
		return;
	}

	const payload = { type: "chat", message };
	if (target) payload.target = target; // target user(s) if private message

	chatSocket.send(JSON.stringify(payload));
}

// --- Typing indicator setup ---
let typingListenerAttached = false;

export function initTyping(chatInput) {
	if (!chatInput) return;
	if (typingListenerAttached) return;

	typingListenerAttached = true;

	let typingTimeout;

	chatInput.addEventListener("input", () => {
		if (!chatSocket || chatSocket.readyState !== WebSocket.OPEN) return;

		chatSocket.send(JSON.stringify({
			type: "typing",
			user: myUserId,
			name: myUserName
		}));

		clearTimeout(typingTimeout);
		typingTimeout = setTimeout(() => {
			if (chatSocket?.readyState === WebSocket.OPEN) {
				chatSocket.send(JSON.stringify({
					type: "stop_typing",
					user: myUserId,
					name: myUserName
				}));
			}
		}, 1000);
	});
}

export function stopChat() {
	chatInitialized = false;
	typingListenerAttached = false;
    if (chatSocket) {

		chatSocket.close();
		chatSocket = null;
    }

	myUserId = null;
	myUserName = null;

	// Clear chat messages
	const chatMessages = document.getElementById("chatMessages");
	if (chatMessages) chatMessages.innerHTML = "";

}