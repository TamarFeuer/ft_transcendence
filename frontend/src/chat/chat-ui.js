// Handles all chat UI rendering and interaction.
// The WebSocket connection itself lives in chat.js —
// this file reacts to events dispatched by chat.js and manages the DOM.

import { onlineUsers, blockedMeIds, sendChatMessage, initTyping, verifiedUserId, fetchDMHistory, markRead, closeConversation, openConversation, notifyBlocked, sendGameInvite, sendGameInviteExpired, sendDeleteInvite } from './chat.js';
import { fetchWithRefreshAuth } from '../users_friends/usermanagement.js';
import { navigate, handleRoute } from '../routes/route_helpers.js';
import { showMessage } from '../utils/utils.js';

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
	const typingIndicator = document.getElementById("typingIndicator");

	// ── State ─────────────────────────────────────────────────────────────────
	// activeChannel is either "global" or a user ID for DMs
	let activeChannel = "global";
	// messageHistory stores messages per channel — keyed by "global" or user ID
	const messageHistory = { global: [] };
	// tracks which DM channels have been read by the other person
	const seenBy = {}; // channelId -> true/false
	// tracks who is currently typing per channel: channelId -> Map(userId -> name)
	const typingUsers = {};

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
			const name = onlineUsers[channelId]?.name
				|| activeTab?.querySelector("span:nth-child(2)")?.textContent;
			channelTitle.textContent = name ? `@ ${name}` : "@ Direct Message";
			markRead(channelId);
		}
		openConversation(channelId === "global" ? null : channelId);

		// If this is a DM with no history loaded yet, fetch it now
		if (channelId !== "global" && (!messageHistory[channelId] || messageHistory[channelId].length === 0)) {
			fetchDMHistory(channelId);
		}

		renderMessages(channelId);
		renderTypingIndicator();
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
			// If it's a DM from someone else, mark it read — but only if the chat window is actually visible
			if (channelId !== "global" && message.senderId !== verifiedUserId
					&& chatContainer?.style.display !== "none"
					&& document.visibilityState === "visible") {
				markRead(channelId);
			}
		} else if (message.senderId !== verifiedUserId) {
			// Only badge for messages from others — own messages echoed to other tabs shouldn't count as unread
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

			// Game invite — render as a card with an Accept button
			if (msg.invite) {
				msgDiv.classList.add(isOwnMessage ? "self" : "dm-received", "game-invite");
				if (isOwnMessage) {
					const recipientName = msg.recipientName || "them";
					msgDiv.appendChild(document.createTextNode(`You invited ${recipientName} to a game of ${msg.invite.gameType}`));
				} else {
					msgDiv.appendChild(document.createTextNode(`${msg.senderName} invited you to a game of ${msg.invite.gameType}`));
					const acceptBtn = document.createElement("button");
					acceptBtn.textContent = "Accept";
					acceptBtn.className = "ml-2 px-2 py-0.5 text-xs bg-pink-500 hover:bg-pink-400 rounded font-semibold";
					acceptBtn.addEventListener("click", () => {
						msgDiv.remove();
						const idx = messageHistory[channelId].indexOf(msg);
						if (idx !== -1) messageHistory[channelId].splice(idx, 1);
						sendDeleteInvite(msg.invite.gameId);
						if (msg.invite.gameType === "chess") {
							window.history.pushState({}, '', `/chess-online?gameId=${msg.invite.gameId}`);
							handleRoute('/chess-online');
						} else {
							window.history.pushState({}, '', `/online?gameId=${msg.invite.gameId}`);
							handleRoute('/online');
						}
					});
					msgDiv.appendChild(acceptBtn);
				}
				chatMessages.appendChild(msgDiv);
				return;
			}

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

		// Show "Seen" only if the other person read AND the last message is ours
		const lastMsg = messages[messages.length - 1];
		if (channelId !== "global" && seenBy[channelId] && lastMsg?.senderId === verifiedUserId) {
			const seenDiv = document.createElement("div");
			seenDiv.className = "text-right text-xs text-gray-400 pr-1 mt-1 font-medium";
			seenDiv.textContent = "✓ Seen";
			chatMessages.appendChild(seenDiv);
		}

		// Scroll to bottom so latest message is always visible
		chatMessages.scrollTop = chatMessages.scrollHeight;

		// Clear unread badge only when the user is actively viewing this channel
		if (channelId === activeChannel) {
			const tab = document.querySelector(`[data-channel="${channelId}"]`);
			if (tab) {
				const badge = tab.querySelector(".unread-badge");
				if (badge) badge.remove();
			}
		}
	}

	// ── Typing indicator ─────────────────────────────────────────────────────

	function renderTypingIndicator() {
		if (!typingIndicator) return;
		const typers = typingUsers[activeChannel];
		if (!typers || typers.size === 0) {
			typingIndicator.textContent = "";
			return;
		}
		if (typers.size === 1) {
			const name = [...typers.values()][0];
			typingIndicator.textContent = `${name} is typing...`;
		} else {
			typingIndicator.textContent = `${typers.size} people are typing...`;
		}
	}

	window.addEventListener("typingStarted", (e) => {
		const { userId, name, channelId } = e.detail;
		if (userId === verifiedUserId) return;
		if (!typingUsers[channelId]) typingUsers[channelId] = new Map();
		typingUsers[channelId].set(userId, name);
		if (channelId === activeChannel) renderTypingIndicator();
	});

	window.addEventListener("typingStopped", (e) => {
		const { userId, channelId } = e.detail;
		if (typingUsers[channelId]) typingUsers[channelId].delete(userId);
		if (channelId === activeChannel) renderTypingIndicator();
	});

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
				div.addEventListener("dblclick", (e) => {
					e.stopPropagation();
					hideChatUserMenu();
					openDMChannel(id, name || id);
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
		const { channelId, messages, seen } = e.detail;
		if (!messageHistory[channelId]) messageHistory[channelId] = [];
		messageHistory[channelId] = messages.map(msg => {
			const entry = {
				senderId: String(msg.sender_id),
				senderName: msg.sender_name,
				message: msg.message,
			};
			if (msg.invite) {
				entry.invite = msg.invite;
				entry.recipientName = msg.recipient_name;
			}
			return entry;
		});
		if (seen) seenBy[channelId] = true;
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
			if (data.seen) seenBy[userId] = true;
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
			if (activeChannel !== "global") markRead(activeChannel);
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

		const inviteBtn = chatUserMenu.querySelector('[data-action="invite"]');
		if (inviteBtn) {
			const targetInGame = onlineUsers[user.id]?.in_game;
			const senderInGame = onlineUsers[verifiedUserId]?.in_game;
			inviteBtn.style.display = (targetInGame || senderInGame || pendingInvite) ? "none" : "";
		}

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
			navigate(`/profile/${chatMenuUser.name}`);
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
					notifyBlocked(targetId);
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

	// ── Game picker ───────────────────────────────────────────────────────────

	let pendingInvite = false;

	gamePickerMenu.addEventListener("click", async (e) => {
		e.stopPropagation();
		const gameType = e.target.dataset.game;
		if (!gameType || !chatMenuUser) return;
		gamePickerMenu.style.display = "none";

		if (pendingInvite) {
			hideChatUserMenu();
			return;
		}

		const targetId = chatMenuUser.id;
		const targetName = chatMenuUser.name;
		hideChatUserMenu();
		pendingInvite = true;

		if (gameType === "chess") {
			console.log('[invite] POSTing /api/chess/join/ for target:', targetId);
			const res = await fetchWithRefreshAuth('/api/chess/join/', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ invitee_id: targetId })
			});
			console.log('[invite] /api/chess/join/ response — status:', res.status, 'ok:', res.ok);
			if (!res.ok) {
				pendingInvite = false;
				showMessage("Could not create game. Please try again.", "error");
				return;
			}
			const data = await res.json();
			const gameId = data.gameId;
			console.log('[invite] gameId from response:', gameId);
			sendGameInvite(targetId, "chess", gameId);
			openDMChannel(targetId, targetName, true, false);
			addMessage(targetId, {
				senderId: verifiedUserId,
				senderName: null,
				recipientName: targetName,
				invite: { gameType: "chess", gameId }
			});
			// pendingInvite stays true until A leaves /chess-online
			window.history.pushState({}, '', `/chess-online?gameId=${gameId}`);
			handleRoute('/chess-online');
		} else if (gameType === "pong") {
			const res = await fetchWithRefreshAuth('/api/game/create', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ invitee_id: targetId })
			});
			if (!res.ok) {
				pendingInvite = false;
				showMessage("Could not create game. Please try again.", "error");
				return;
			}
			const data = await res.json();
			const gameId = data.gameId;
			sendGameInvite(targetId, "pong", gameId);
			openDMChannel(targetId, targetName, true, false);
			addMessage(targetId, {
				senderId: verifiedUserId,
				senderName: null,
				recipientName: targetName,
				invite: { gameType: "pong", gameId }
			});
			// pendingInvite stays true until pong game ends
			window.history.pushState({}, '', `/online?gameId=${gameId}`);
			handleRoute('/online');
		}
	});

	// ── Incoming game invite ──────────────────────────────────────────────────

	window.addEventListener("gameInviteReceived", (e) => {
		const { senderId, senderName, gameType, gameId } = e.detail;
		const channelId = senderId;

		const existingTab = document.querySelector(`[data-channel="${channelId}"]`);
		if (!existingTab) {
			openDMChannel(channelId, senderName, false, false);
		}

		addMessage(channelId, {
			senderId,
			senderName,
			invite: { gameType, gameId }
		});
	});

	window.addEventListener("chessGameLeft", () => {
		pendingInvite = false;
	});

	window.addEventListener("pongGameLeft", () => {
		pendingInvite = false;
	});

	window.addEventListener("gameInviteRejected", (e) => {
		pendingInvite = false;
		// Navigate back since the chess game was created but nobody will join it
		window.history.back();
		// Show feedback to the invitor
		if (e.detail.reason === "in_game") {
			showMessage("That user is currently in a game.", "error");
		}
	});

	function removeInviteFromHistory(gameId) {
		for (const channelId in messageHistory) {
			const before = messageHistory[channelId].length;
			const removedFromOther = messageHistory[channelId].filter(
				m => m.invite?.gameId === gameId && m.senderId !== verifiedUserId
			).length;
			messageHistory[channelId] = messageHistory[channelId].filter(m => m.invite?.gameId !== gameId);
			if (messageHistory[channelId].length < before) {
				renderMessages(channelId);
				if (channelId !== activeChannel && removedFromOther > 0) {
					const tab = document.querySelector(`[data-channel="${channelId}"]`);
					if (tab) {
						const badge = tab.querySelector(".unread-badge");
						if (badge) {
							const newCount = parseInt(badge.textContent) - removedFromOther;
							if (newCount <= 0) badge.remove();
							else badge.textContent = newCount;
						}
					}
				}
			}
		}
	}

	window.addEventListener("messagesRead", (e) => {
		const channelId = e.detail.by;
		seenBy[channelId] = true;
		if (activeChannel === channelId) renderMessages(channelId);
	});

	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "visible"
				&& activeChannel !== "global"
				&& chatContainer?.style.display !== "none") {
			markRead(activeChannel);
		}
	});

	window.addEventListener("gameInviteAccepted", (e) => removeInviteFromHistory(e.detail.gameId));
	window.addEventListener("gameInviteExpired", (e) => {
		removeInviteFromHistory(e.detail.gameId);
		if (pendingInvite) {
			pendingInvite = false;
			window.history.back();
		}
	});
	window.addEventListener("gameInviteBlocked", (e) => {
		removeInviteFromHistory(e.detail.gameId);
		if (pendingInvite) {
			pendingInvite = false;
			window.history.back();
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
	// Pass a getTarget callback so typing events include the active DM channel
	initTyping(chatInput, () => activeChannel === "global" ? null : activeChannel);

	if (sendChatBtn && chatInput) {
		const sendMessage = () => {
			const message = chatInput.value.trim();
			if (!message) return;
			if (message.length > MAX_CHARS) return;

			// null target means global chat, otherwise it's a DM to that user ID
			const target = activeChannel === "global" ? null : activeChannel;
			// Clear "Seen" when we send a new message — it's no longer valid
			if (target) seenBy[target] = false;
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