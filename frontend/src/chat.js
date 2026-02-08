let chatSocket = null;
let myUserId = null;
let myUserName = null;
export let onlineUsers = [];

export function initChat() {
	
	const CURRENT_USER = window.CURRENT_USER;

	if (!CURRENT_USER) {
		console.error("No current user available. Did you fetch it in main.js?");
		return;
	}

	// Create WebSocket connection
	chatSocket = new WebSocket(
		`${location.protocol === "http:" ? "ws:" : "wss:"}//${location.host}/ws/chat/`
	);

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

	chatSocket.onmessage = (ev) => {
		const data = JSON.parse(ev.data);

		// Self identification
		if (data.type === "self_id") {
			myUserId = data.user_id;
			myUserName = data.name || "Guest";
			console.log("User ID:", CURRENT_USER.user_id);
			console.log("User name:", CURRENT_USER.username);
		}

		// Chat message (global or private)
		if (data.type === "chat") {
			console.log("Incoming chat message:", data);
			console.log("My user ID:", myUserId);
			console.log("Message sender:", data.sender);
			console.log("Message target:", data.target);
			console.log("Is private?", data.private);

			// Determine which channel this belongs to
			let channelId;
			
			if (data.private) {
				// Private message: determine the OTHER person's ID
				if (String(data.sender) === String(myUserId)) {
					// I sent this message - use the target's ID for the channel
					channelId = data.target;
					console.log("I sent this - channelId set to target:", channelId);
				} else {
					// Someone sent me a message - use their ID for the channel
					channelId = data.sender;
					console.log("Someone sent to me - channelId set to sender:", channelId);
				}
			} else {
				// Global message
				channelId = "global";
				console.log("Global message - channelId set to:", channelId);
			}

			// Dispatch event so main.js can handle it
			window.dispatchEvent(new CustomEvent("chatMessageReceived", {
				detail: {
					channelId: channelId,
					message: {
						senderId: String(data.sender),
						senderName: data.name || data.sender,
						message: data.message
					}
				}
			}));
		}

		// Online users update
		if (data.type === "online_users") {
			console.log("Received online_users message:", data.users);
			onlineUsers = data.users;
			window.dispatchEvent(new CustomEvent("onlineUsersUpdated"));
		}

		// Typing notifications
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

// Send chat message (global or private)
export function sendChatMessage(message, target = null) {
	if (!chatSocket || chatSocket.readyState !== WebSocket.OPEN) {
		console.warn("Chat socket not ready");
		return;
	}

	const payload = { 
		type: "chat", 
		message 
	};
	
	// If target is specified, send as private message
	if (target) {
		payload.target = target;
	}

	chatSocket.send(JSON.stringify(payload));
}

// Typing indicator setup
export function initTyping(chatInput) {
	if (!chatInput) return;
	if (!chatSocket) {
		console.warn("Typing init: chatSocket not ready yet");
		return;
	}

	let typingTimeout;

	chatSocket.addEventListener("open", () => {
		chatInput.addEventListener("input", () => {
			if (!chatSocket || chatSocket.readyState !== WebSocket.OPEN) return;

			chatSocket.send(JSON.stringify({
				type: "typing",
				user: myUserId,
				name: myUserName
			}));

			clearTimeout(typingTimeout);
			typingTimeout = setTimeout(() => {
				if (chatSocket.readyState === WebSocket.OPEN) {
					chatSocket.send(JSON.stringify({
						type: "stop_typing",
						user: myUserId,
						name: myUserName
					}));
				}
			}, 1000);
		});
	});
}