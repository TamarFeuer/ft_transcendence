// Handles WebSocket chat: connection, messaging, typing, online users.
// The chat panel is a persistent overlay in index.html — it is NOT a route.
// It stays alive across SPA navigation because it lives outside #app-root.

//chatSocket.readyState is a number. The WebSocket API defines four possible values:
// javascriptWebSocket.CONNECTING  // 0 - still connecting
// WebSocket.OPEN        // 1 - ready to use
// WebSocket.CLOSING     // 2 - closing
// WebSocket.CLOSED      // 3 - closed

let chatSocket = null; // Single shared WebSocket connection for all chat
let myUserId = null; // Set after server sends "self_id" confirmation
let myUserName = null;

// Exported so other modules (e.g. main.js) can read the current online users list
export let onlineUsers = [];

export function initChat() {
	
	// CURRENT_USER must be set on window before initChat() is called.
	// In main.js, fetch /api/auth/me first, then call initChat().
	const CURRENT_USER = window.CURRENT_USER;

	if (!CURRENT_USER) {
		console.error("initChat: window.CURRENT_USER is not set. Call /api/auth/me first");
		return;
	}

	// Use wss:// in production (https), ws:// in development (http)
	const wsProtocol = location.protocol === "https:" ? "wss:" : "ws:";
	chatSocket = new WebSocket(`${wsProtocol}//${location.host}/ws/chat/`);

	chatSocket.onopen = () => {
		console.log("Chat WebSocket connected");
		
		// The backend reads the JWT from the cookie on connect (see consumers.py).
		// We still send an "identify" message as a fallback / for extra context.
		chatSocket.send(JSON.stringify({
			type: "identify",
			userId: CURRENT_USER.user_id,
			name: CURRENT_USER.username,
		}));
	}
		
	chatSocket.onclose = () => {
		console.log("Chat WebSocket disconnected");
		// TODO: implement reconnect with exponential backoff if needed
	};
	
	chatSocket.onerror = (err) => {
		console.error("Chat WebSocket error:", err);
	};

	chatSocket.onmessage = (ev) => {
		// All messages from the server are JSON
		const data = JSON.parse(ev.data);
		
		switch (data.type) {

			// Server confirms our identity after connect
			case "self_id":
					myUserId = data.user_id;
					myUserName = data.name || "Guest";
					console.log(`Chat identified as: ${myUserName} (id: ${myUserId})`);
					break;

			// Incoming chat message — either global or private DM
			case "chat": {
					// For private messages, the "channel" in the UI is the OTHER person.
					// If I sent it: channel = target. If I received it: channel = sender.
					// For global messages, channel is always "global";
				let channelId;
				
				if (data.private) {
					// String comparison because IDs may come as strings or numbers
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

				// Dispatch to main.js which owns the UI rendering
				window.dispatchEvent(new CustomEvent("chatMessageReceived", {
					detail: {
						channelId: channelId,
						message: {
							senderId: String(data.sender),
							senderName: data.name || String(data.sender),
							message: data.message
						}
					}
				}));
				break;
			}

			// Server sends the full list of online users whenever someone joins/leaves
			case "online_users":
				console.log("Received online_users message:", data.users);
				onlineUsers = data.users;
				window.dispatchEvent(new CustomEvent("onlineUsersUpdated"));
				break;

			/// Another user started typing — show indicator (TODO in UI)
			case "typing":
				console.log(`${data.name || data.user} is typing...`);
				// TODO: dispatch "typingStarted" event and show indicator in UI
				break;

			// Another user stopped typing
			case "stop_typing":
				console.log(`${data.name || data.user} stopped typing`);
				// TODO: dispatch "typingStopped" event and hide indicator in UI
				break;

			default:
				console.warn("Unknown chat message type:", data.type);
		}
	};
}

/**
 * Send a chat message via the WebSocket, global or DM
 * @param {string} message - The text content to send
 * @param {string|null} target - User ID to send a private DM, or null for global chat
 */
export function sendChatMessage(message, target = null) {
	if (!chatSocket || chatSocket.readyState !== WebSocket.OPEN) {
		console.warn("sendChatMessage: WebSocket not ready (state:", chatSocket?.readyState, ")");
		return;
	}

	const payload = {
		type: "chat",
		message 
	};
	
	// Only add target if it's a private message — omitting it means global
	if (target) {
		payload.target = target;
	}

	chatSocket.send(JSON.stringify(payload));
}

/**
 * Attach typing indicator events to the chat textarea.
 * Sends "typing" on input, then "stop_typing" after 1s of inactivity.
 * @param {HTMLTextAreaElement} chatInput - The textarea element.
 */
export function initTyping(chatInput) {
	if (!chatInput) {
		console.warn("initTyping: no chatInput element provided");
		return;
	}
	if (!chatSocket) {
		console.warn("Typing init: chatSocket not ready yet");
		return;
	}

	// Stores the ID of the current countdown timer.
	// Declared outside the event listener so it persists between keystrokes —
	// if it were inside the listener, it would reset to undefined on every keystroke
	// and clearTimeout() would never be able to cancel the previous timer.
	let typingTimeout;
	
	// We wrap the listener setup in a function because we need to attach it
	// in two different places below — either now if the socket is already open,
	// or later when it opens.
	 const attachTyping = () => {
		chatInput.addEventListener("input", () => {
			if (chatSocket.readyState !== WebSocket.OPEN) return;

			// Tell the server this user is typing
			chatSocket.send(JSON.stringify({
				type: "typing",
				user: myUserId,
				name: myUserName,
			}));
			
			// Debounce: cancel the previous countdown and start a fresh one
			// "stop_typing" only fires if the user stops typing for a full second
			clearTimeout(typingTimeout);
			// We don't care about the actual value of typingTimeout
			// we only store it so we can pass it to clearTimeout on the next keystroke
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
	};
	
	   if (chatSocket.readyState === WebSocket.OPEN) {
		// Socket is already open, attach the listener now
		attachTyping();
	} else {
		// Socket exists but is still connecting (readyState === 0).
		// we are handing it to the browser to call later when the socket opens
		// and the browswer "fires" the open event.
		chatSocket.addEventListener("open", attachTyping, { once: true });
	}
}

export function closeChat() {
    if (chatSocket) {
        chatSocket.close();
        chatSocket = null;
    }
	// Hide chat UI on logout
    const chatContainer = document.getElementById("chatContainer");
    const openChatBtn = document.getElementById("openChatBtn");
    if (chatContainer) chatContainer.style.display = "none";
    if (openChatBtn) openChatBtn.style.display = "none";
}