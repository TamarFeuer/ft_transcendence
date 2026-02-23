// Handles all chat UI rendering and interaction.
// The WebSocket connection itself lives in chat.js —
// this file reacts to events dispatched by chat.js and manages the DOM.

import { onlineUsers, sendChatMessage, initTyping } from './chat.js';

export function initChatUI(CURRENT_USER) {

	// ── DOM elements ──────────────────────────────────────────────────────────
	const chatContainer = document.getElementById("chatContainer");
	const openChatBtn = document.getElementById("openChatBtn");
	const closeChatBtn = document.getElementById("closeChatBtn");
	const sendChatBtn = document.getElementById("sendChatBtn");
	const chatInput = document.getElementById("chatInput");
	const onlineUsersList = document.getElementById("onlineUsersList");
	const channelTabs = document.getElementById("channelTabs");
	const chatMessages = document.getElementById("chatMessages");
	const channelTitle = document.getElementById("channelTitle");

	// ── State ─────────────────────────────────────────────────────────────────
	// activeChannel is either "global" or a user ID for DMs
	let activeChannel = "global";
	// messageHistory stores messages per channel — keyed by "global" or user ID
	// Messages are lost on refresh since there's no database yet
	const messageHistory = { global: [] };

	// ── Channel management ────────────────────────────────────────────────────

	function switchChannel(channelId) {
		activeChannel = channelId;

		// Update tab active state
		document.querySelectorAll(".channel-tab").forEach(tab => {
			tab.classList.remove("active");
		});
		const activeTab = document.querySelector(`[data-channel="${channelId}"]`);
		if (activeTab) activeTab.classList.add("active");

		// Update channel title
		if (channelId === "global") {
			channelTitle.textContent = "# Global Chat";
		} else {
			const user = onlineUsers.find(u => u.id === channelId);
			channelTitle.textContent = user ? `@ ${user.name}` : "@ Direct Message";
		}

		renderMessages(channelId);
		chatInput.focus();
	}

	// Opens a DM channel tab.
	// switchToChannel=true (default) — switches to the tab immediately.
	// switchToChannel=false — creates the tab silently (used when a DM arrives
	// while the user is in a different channel, so we don't interrupt them).
	function openDMChannel(userId, userName, switchToChannel = true) {
		// Don't open DM with yourself
		if (userId === CURRENT_USER.user_id) return;

		// If tab already exists just switch to it
		const existingTab = document.querySelector(`[data-channel="${userId}"]`);
		if (existingTab) {
			if (switchToChannel) switchChannel(userId);
			return;
		}

		if (!messageHistory[userId]) messageHistory[userId] = [];

		const tab = document.createElement("button");
		tab.className = "channel-tab";
		tab.dataset.channel = userId;
		tab.innerHTML = `
			<span class="font-bold opacity-80">@</span>
			<span>${userName}</span>
			<span class="close-tab" data-close="${userId}">  X</span>
		`;

		channelTabs.appendChild(tab);

		tab.addEventListener("click", (e) => {
			if (e.target.classList.contains("close-tab")) {
				e.stopPropagation();
				closeDMChannel(userId);
			} else {
				switchChannel(userId);
			}
		});

		if (switchToChannel) switchChannel(userId);
	}

	function closeDMChannel(userId) {
		const tab = document.querySelector(`[data-channel="${userId}"]`);
		if (tab) tab.remove();

		// If we were viewing this channel, fall back to global
		if (activeChannel === userId) switchChannel("global");

		// Message history is kept in case the user reopens the DM
		// To clear it instead: delete messageHistory[userId];
	}

	// ── Message management ────────────────────────────────────────────────────

	function addMessage(channelId, message) {
		if (!messageHistory[channelId]) messageHistory[channelId] = [];
		messageHistory[channelId].push(message);

		if (channelId === activeChannel) {
			// User is already viewing this channel — render immediately
			renderMessages(channelId);
		} else {
			// User is elsewhere — increment unread badge on the tab
			const tab = document.querySelector(`[data-channel="${channelId}"]`);
			if (tab && !tab.querySelector(".unread-badge")) {
				const badge = document.createElement("span");
				badge.className = "unread-badge";
				badge.textContent = "1";
				tab.appendChild(badge);
			} else if (tab) {
				const badge = tab.querySelector(".unread-badge");
				badge.textContent = parseInt(badge.textContent) + 1;
			}
		}
	}

	function renderMessages(channelId) {
		chatMessages.innerHTML = "";

		const messages = messageHistory[channelId] || [];
		messages.forEach(msg => {
			const msgDiv = document.createElement("div");
			msgDiv.className = "chat-message text-base leading-relaxed text-gray-200";

			const isOwnMessage = msg.senderId === CURRENT_USER.user_id;
			if (isOwnMessage) {
				msgDiv.classList.add("self");
			} else if (channelId !== "global") {
				msgDiv.classList.add("dm-received");
			}

			const senderSpan = document.createElement("span");
			senderSpan.className = "sender";
			senderSpan.textContent = isOwnMessage ? "Me" : msg.senderName;

			const messageSpan = document.createElement("span");
			messageSpan.textContent = msg.message;

			msgDiv.appendChild(senderSpan);
			msgDiv.appendChild(document.createTextNode(": "));
			msgDiv.appendChild(messageSpan);
			chatMessages.appendChild(msgDiv);
		});

		// Scroll to bottom so latest message is always visible
		chatMessages.scrollTop = chatMessages.scrollHeight;

		// Clear unread badge when switching to this channel
		const tab = document.querySelector(`[data-channel="${channelId}"]`);
		if (tab) {
			const badge = tab.querySelector(".unread-badge");
			if (badge) badge.remove();
		}
	}

	// ── Online users ──────────────────────────────────────────────────────────

	function renderOnlineUsers() {
		if (!onlineUsersList) return;

		onlineUsersList.innerHTML = "";

		if (!onlineUsers || onlineUsers.length === 0) {
			onlineUsersList.innerHTML = '<div class="text-xs text-gray-500 px-2">No users online</div>';
			return;
		}

		onlineUsers.forEach(user => {
			// Skip yourself — every user past this point is someone else
			if (user.id === CURRENT_USER.user_id) return;

			const div = document.createElement("div");
			div.className = "user-item";

			const statusDot = document.createElement("span");
			statusDot.className = "w-2 h-2 rounded-full bg-[#00FF00] flex-shrink-0";

			const nameSpan = document.createElement("span");
			nameSpan.textContent = user.name || user.id;

			div.appendChild(statusDot);
			div.appendChild(nameSpan);

			// Click to open DM with this user
			div.addEventListener("click", () => {
				openDMChannel(user.id, user.name || user.id);
			});

			onlineUsersList.appendChild(div);
		});
	}

	// ── Event listeners ───────────────────────────────────────────────────────

	// chat.js dispatches this whenever the online users list changes
	window.addEventListener("onlineUsersUpdated", renderOnlineUsers);

	// chat.js dispatches this whenever a message arrives
	window.addEventListener("chatMessageReceived", (e) => {
		const { channelId, message } = e.detail;

		// If a DM arrives and the tab doesn't exist yet, create it silently
		if (channelId !== "global") {
			const existingTab = document.querySelector(`[data-channel="${channelId}"]`);
			if (!existingTab) {
				openDMChannel(channelId, message.senderName, false);
			}
		}

		addMessage(channelId, message);
	});

	// ── Chat open/close ───────────────────────────────────────────────────────

	if (openChatBtn && chatContainer) {
		openChatBtn.style.display = "block";
		openChatBtn.addEventListener("click", () => {
			chatContainer.style.display = "flex";
			openChatBtn.style.display = "none";
			chatInput.focus();
			renderOnlineUsers();
		});
	}

	if (closeChatBtn && chatContainer && openChatBtn) {
		closeChatBtn.addEventListener("click", () => {
			chatContainer.style.display = "none";
			openChatBtn.style.display = "block";
		});
	}

	// ── Send message ──────────────────────────────────────────────────────────
	
	// Maximum message length, enforced here and also in consumers.py
	const MAX_CHARS = 300;

	// Add character counter below the textarea
	const charCounter = document.getElementById("charCounter");

	// Update counter on every keystroke
	chatInput.addEventListener("input", () => {
		const len = chatInput.value.length;
		charCounter.textContent = `${len} / ${MAX_CHARS}`;
		if (len > MAX_CHARS) {
			charCounter.classList.add("text-red-500");
			charCounter.classList.remove("text-gray-400");
			sendChatBtn.disabled = true;
		} else {
			charCounter.classList.remove("text-red-500");
			charCounter.classList.add("text-gray-400");
			sendChatBtn.disabled = false;
		}
	});

	// initTyping attaches the typing indicator to the textarea (chat.js)
	initTyping(chatInput);

	if (sendChatBtn && chatInput) {
		const sendMessage = () => {
			const message = chatInput.value.trim();
			if (!message) return;
			if (message.length > MAX_CHARS) return;

			// null target means global chat, otherwise it's a DM to that user ID
			const target = activeChannel === "global" ? null : activeChannel;
			sendChatMessage(message, target);

			chatInput.value = "";
			// Reset counter after sending
			charCounter.textContent = `0 / ${MAX_CHARS}`;
			charCounter.classList.remove("text-red-500");
			charCounter.classList.add("text-gray-400");
			sendChatBtn.disabled = false;
			chatInput.focus();
		};

		sendChatBtn.addEventListener("click", sendMessage);

		// Send on Enter, allow Shift+Enter for newlines
		chatInput.addEventListener("keypress", e => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				// Block Enter if over limit
				if (chatInput.value.length > MAX_CHARS) return;
				sendMessage();
			}
		});
	}

	// ── Global tab click ──────────────────────────────────────────────────────

	const globalTab = document.querySelector('[data-channel="global"]');
	if (globalTab) {
		globalTab.addEventListener("click", () => switchChannel("global"));
	}
}