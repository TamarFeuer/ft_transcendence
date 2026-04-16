// Handles all chat UI rendering and interaction.
// The WebSocket connection itself lives in chat.js —
// this file reacts to events dispatched by chat.js and manages the DOM.

import { onlineUsers, blockedMeIds, sendChatMessage, initTyping, verifiedUserId, fetchDMHistory, markRead, closeConversation, openConversation, notifyBlocked } from './chat.js';
import { fetchWithRefreshAuth } from '../users_friends/usermanagement.js';

export function initChatUI() {

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
	const blockNotice = document.getElementById("blockNotice");

	// ── State ─────────────────────────────────────────────────────────────────
	// activeChannel is either "global" or a user ID for DMs
	let activeChannel = "global";
	// messageHistory stores messages per channel — keyed by "global" or user ID
	// Messages are lost on refresh since there's no database yet
	const messageHistory = { global: [] };

	// ── Channel management ────────────────────────────────────────────────────

	function updateDMInputState(channelId) {
		if (channelId === "global") {
			chatInput.disabled = false;
			sendChatBtn.disabled = false;
			blockNotice.style.display = "none";
			blockNotice.textContent = "";
			return;
		}
		const blockedByMe = onlineUsers[channelId]?.blocked_by_me;
		const blockedMe = blockedMeIds.has(channelId);
		if (blockedByMe || blockedMe) {
			chatInput.disabled = true;
			sendChatBtn.disabled = true;
			chatInput.value = "";
			blockNotice.textContent = blockedByMe ? "You have blocked this user." : "You have been blocked.";
			blockNotice.style.display = "block";
		} else {
			chatInput.disabled = false;
			sendChatBtn.disabled = false;
			blockNotice.style.display = "none";
			blockNotice.textContent = "";
		}
	}

	function switchChannel(channelId) {
		activeChannel = channelId;

		// Update tab active state
		document.querySelectorAll(".channel-tab").forEach(tab => {
			tab.classList.remove("active");
		});
		const activeTab = document.querySelector(`[data-channel="${channelId}"]`);
		if (activeTab) activeTab.classList.add("active");

		// Update channel title
		const channelTitle = document.getElementById("channelTitle");
		if (channelId === "global") {
			channelTitle.textContent = "# Global Chat";
		} else {
			const name = onlineUsers[channelId]?.name;
			channelTitle.textContent = name ? `@ ${name}` : "@ Direct Message";
			markRead(channelId);
			openConversation(channelId);
		}

		// If this is a DM with no history loaded yet, fetch it now
		if (channelId !== "global" && (!messageHistory[channelId] || messageHistory[channelId].length === 0)) {
			fetchDMHistory(channelId);
		}

		renderMessages(channelId);
		updateDMInputState(channelId);
		document.getElementById("chatInput").focus();
	}

	// Opens a DM channel tab.
	// switchToChannel=true (default) — switches to the tab immediately.
	// switchToChannel=false — creates the tab silently (used when a DM arrives
	// while the user is in a different channel, so we don't interrupt them).
	function openDMChannel(userId, userName, switchToChannel = true, fetchHistory = true) {
		// Don't open DM with yourself
		if (userId === verifiedUserId) return;

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

		const globalTab = channelTabs.querySelector('[data-channel="global"]');
		channelTabs.insertBefore(tab, globalTab.nextSibling);
		if(fetchHistory) fetchDMHistory(userId);

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

		closeConversation(userId);
		// Keep message history in memory in case conversation reopens
	}

	// ── Message management ────────────────────────────────────────────────────

	function addMessage(channelId, message) {
		if (!messageHistory[channelId]) messageHistory[channelId] = [];
		messageHistory[channelId].push(message);

		if (channelId === activeChannel) {
			// User is already viewing this channel, render immediately
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

			const isOwnMessage = msg.senderId === verifiedUserId;
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

		Object.entries(onlineUsers).forEach(([id, data]) => {
			// Skip yourself — every user past this point is someone else
			if (id === verifiedUserId) return;

			const { name, blocked_by_me } = data;

			const div = document.createElement("div");
			div.className = "user-item";

			const statusDot = document.createElement("span");
			statusDot.className = "w-2 h-2 rounded-full bg-[#00FF00] flex-shrink-0";

			const nameSpan = document.createElement("span");
			nameSpan.className = "user-name";
			nameSpan.textContent = name;

			div.appendChild(statusDot);
			div.appendChild(nameSpan);

			if (blocked_by_me) {
				// Show unblock button instead of normal click behavior
				const unblockBtn = document.createElement("button");
				unblockBtn.textContent = "Unblock";
				unblockBtn.className = "ml-auto text-xs text-pink-400 hover:text-pink-200";
				unblockBtn.addEventListener("click", (e) => {
					e.stopPropagation();
					fetchWithRefreshAuth('/api/friends/unblock', {
						method: 'DELETE',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ user_id: id })
					}).then(() => notifyBlocked());
				});
				div.appendChild(unblockBtn);
			} else {
				// Click to open context menu
				div.addEventListener("click", (e) => {
					e.stopPropagation();
					showChatUserMenu({ id, name }, e.clientX, e.clientY);
				});
			}

			onlineUsersList.appendChild(div);
		});
	}

	// ── Event listeners ───────────────────────────────────────────────────────

	// chat.js dispatches this whenever the online users list changes
	window.addEventListener("onlineUsersUpdated", () => {
		renderOnlineUsers();
		updateDMInputState(activeChannel);
	});

	// chat.js dispatches this whenever a message arrives
	window.addEventListener("chatMessageReceived", (e) => {
		const { channelId, message } = e.detail;

		// If a DM arrives and the tab doesn't exist yet, create it silently
		if (channelId !== "global") {
			const existingTab = document.querySelector(`[data-channel="${channelId}"]`);
			if (!existingTab) {
				// second false means don't fetch history
				openDMChannel(channelId, message.senderName, false, false);
			}
		}

		addMessage(channelId, message);
	});

	// chat.js dispatches this when DM history is fetched from the database
	window.addEventListener("dmHistoryReceived", (e) => {
		const { channelId, messages } = e.detail;
		if (!messageHistory[channelId]) messageHistory[channelId] = [];
		// Prepend history — database messages come first, then live messages on top
		messageHistory[channelId] = [...messages.map(msg => ({
			senderId: String(msg.sender_id), //sender_id comes back from the database as an integer
			senderName: msg.sender_name,
			message: msg.message
		})), ...messageHistory[channelId]];
		if (channelId === activeChannel) renderMessages(channelId);
	});
	
	// Restore DM tabs from previous conversations on page load
	window.addEventListener("conversationsReceived", (e) => {
		const { conversations } = e.detail;
		Object.entries(conversations).forEach(([userId, data]) => {
			openDMChannel(userId, data.name, false, false);
			if (data.unread > 0) {
				const tab = document.querySelector(`[data-channel="${userId}"]`);
				if (tab) {
					const badge = document.createElement("span");
					badge.className = "unread-badge";
					badge.textContent = data.unread;
					tab.appendChild(badge);
				}
			}
		});
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
	
	// ── Online user menu ─────────────────────────────────────────────────────

	const chatUserMenu = document.getElementById("chatUserMenu");
	const chatUserMenuName = document.getElementById("chatUserMenuName");
	const gamePickerMenu = document.getElementById("gamePickerMenu");
	let chatMenuUser = null; // the user the menu is currently open for

	function showChatUserMenu(user, mouseX, mouseY) {
		chatMenuUser = user;
		chatUserMenuName.textContent = user.name || user.id;

		// Position at cursor - nudge left/up if too close to screen edge
		const menuWidth = 160;
		const menuHeight = 160;
		const x = mouseX + menuWidth > window.innerWidth ? mouseX - menuWidth : mouseX;
		const y = mouseY + menuHeight > window.innerHeight ? mouseY - menuHeight : mouseY;

		chatUserMenu.style.left = `${x}px`;
		chatUserMenu.style.top = `${y}px`;
		chatUserMenu.style.display = "block";
	}

	function hideChatUserMenu() {
		chatUserMenu.style.display = "none";
		chatMenuUser = null;
	}

	// Handle menu option clicks
	chatUserMenu.addEventListener("click", (e) => {
		const action = e.target.dataset.action;
		if (!action || !chatMenuUser) return;

		if (action === "profile") {
			// TODO: show user profile
			console.log("View profile:", chatMenuUser);
		} else if (action === "invite") {
			// Show game picker below the context menu — keep chatMenuUser alive for when picker is clicked
			e.stopPropagation();
			const rect = chatUserMenu.getBoundingClientRect();
			gamePickerMenu.style.left = chatUserMenu.style.left;
			gamePickerMenu.style.top = `${rect.bottom + 4}px`;
			gamePickerMenu.style.display = "block";
			return; // skip hideChatUserMenu() at the bottom
		} else if (action === "chat") {
			openDMChannel(chatMenuUser.id, chatMenuUser.name || chatMenuUser.id);
		} else if (action === "block") {
			const targetId = chatMenuUser.id;
			fetchWithRefreshAuth('/api/friends/block', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ user_id: targetId })
			}).then(r => r.json()).then(data => {
				if (data.success) {
					notifyBlocked();
				} else {
					console.warn("Block failed:", data.error);
				}
			});
		}

		hideChatUserMenu();
	});

	// Close menus when clicking anywhere outside them
	document.addEventListener("click", (e) => {
		if (!chatUserMenu.contains(e.target)) {
			hideChatUserMenu();
		}
		if (!gamePickerMenu.contains(e.target)) {
			gamePickerMenu.style.display = "none";
		}
	});

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