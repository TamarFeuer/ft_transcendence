// Handles all chat UI rendering and interaction.
// The WebSocket connection itself lives in chat.js —
// this file reacts to events dispatched by chat.js and manages the DOM.

import { onlineUsers, blockedByMeIds, blockedMeIds, inGameIds, sendChatMessage, initTyping, verifiedUserId, fetchDMHistory, markRead, hideDm, setActiveConversation, reportBlockedUser, sendGameInvite, cancelGameInvite, acceptGameInvite } from './chat.js';
import { fetchWithRefreshAuth } from '../users_friends/usermanagement.js';
import { navigate, handleRoute } from '../routes/route_helpers.js';
import { showMessage } from '../utils/utils.js';
import { t } from '../i18n/index.js';

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
	// messageHistory stores messages per channel, keyed by "global" or user ID
	const messageHistory = { global: [] };
	// tracks which DM channels have been read by the other person
	const seenBy = {}; // tabName -> true/false
	// tracks who is currently typing per channel: tabName -> Map(userId -> name)
	const typingUsers = {};

	// ── Channel management ────────────────────────────────────────────────────

	function updateDMInputState(tabName) {
		if (tabName === "global") {
			chatInput.disabled = false;
			sendChatBtn.disabled = false;
			blockNotice.style.display = "none";
			blockNotice.textContent = "";
			return;
		}
		const blockedByMe = blockedByMeIds.has(tabName);
		const blockedMe = blockedMeIds.has(tabName);
		if (blockedByMe || blockedMe) {
			chatInput.disabled = true;
			sendChatBtn.disabled = true;
			chatInput.value = "";
			blockNotice.textContent = blockedByMe ? t('CHAT_BLOCKED_BY_YOU') : t('CHAT_BLOCKED_YOU');
			blockNotice.style.display = "block";
		} else {
			chatInput.disabled = false;
			sendChatBtn.disabled = false;
			blockNotice.style.display = "none";
			blockNotice.textContent = "";
		}
	}
	
	// tabName is either "global" (for the Global tab), or a user ID like "42"
	function switchChannel(tabName) {
		activeChannel = tabName;

		// Update tab active state
		document.querySelectorAll(".channel-tab").forEach(tab => {
			tab.classList.remove("active");
		});
		const activeTab = document.querySelector(`[data-id="${tabName}"]`);
		if (activeTab) activeTab.classList.add("active");

		// Update channel title
		const channelTitle = document.getElementById("channelTitle");
		if (tabName === "global") {
			channelTitle.textContent = t('CHAT_GLOBAL_TITLE');
		} else {
			const name = onlineUsers[tabName]
				// activeTab? — optional chaining. If activeTab is null (no tab found), skip everything after and return undefined instead of crashing.
				// tab.append(atSpan, nameSpan, closeSpan);
				//            1st     2nd       3rd
				|| activeTab?.querySelector("span:nth-child(2)")?.textContent;
			channelTitle.textContent = name ? `@ ${name}` : `@ ${t('CHAT_DIRECT_MSG')}`;
			markRead(tabName);
		}
		setActiveConversation(tabName === "global" ? null : tabName);

		// If this is a DM with no history loaded yet, fetch it now
		if (tabName !== "global" && (!messageHistory[tabName] || messageHistory[tabName].length === 0)) {
			fetchDMHistory(tabName);
		}

		renderMessages(tabName);
		renderTypingIndicator();
		updateDMInputState(tabName);
		document.getElementById("chatInput").focus();
	}

	window.addEventListener('languagechange', () => {
		const titleEl = document.getElementById("channelTitle");
		if (!titleEl) return;
		if (activeChannel === "global") {
			titleEl.textContent = t('CHAT_GLOBAL_TITLE');
		} else {
			const name = onlineUsers[activeChannel];
			titleEl.textContent = name ? `@ ${name}` : `@ ${t('CHAT_DIRECT_MSG')}`;
		}
		renderOnlineUsers();
		renderMessages(activeChannel);
	});

	function createDMTabElement(userId, userName) {
		const tab = document.createElement("button");
		tab.className = "channel-tab";
		tab.dataset.id = userId;

		const atSpan = document.createElement("span");
		atSpan.className = "font-bold opacity-80";
		atSpan.textContent = "@";

		const nameSpan = document.createElement("span");
		nameSpan.textContent = userName;

		const closeSpan = document.createElement("span");
		closeSpan.className = "close-tab";
		closeSpan.textContent = "  X";

		tab.append(atSpan, nameSpan, closeSpan);
		return tab;
	}

	function ensureDMTab(userId, userName, switchToChannel = true, fetchHistory = true) {
		// Don't open DM with yourself
		if (userId === verifiedUserId) return;

		// If tab already exists just switch to it
		const existingTab = document.querySelector(`[data-id="${userId}"]`);
		if (existingTab) {
			if (switchToChannel) switchChannel(userId);
			return;
		}

		// Otherwise, create it and wire it in
		if (!messageHistory[userId]) messageHistory[userId] = [];

		const tab = createDMTabElement(userId, userName);
		const globalTab = channelTabs.querySelector('[data-id="global"]');
		channelTabs.insertBefore(tab, globalTab.nextSibling);

		tab.addEventListener("click", (e) => {
			if (e.target.classList.contains("close-tab")) {
				e.stopPropagation();
				closeDMChannel(userId);
			} else {
				switchChannel(userId);
			}
		});

		if (fetchHistory) fetchDMHistory(userId);
		if (switchToChannel) switchChannel(userId);
	}

	function closeDMChannel(userId) {
		const tab = document.querySelector(`[data-id="${userId}"]`);
		if (tab) tab.remove();

		// If we were viewing this channel, fall back to global
		if (activeChannel === userId) switchChannel("global");

		hideDm(userId);
		// Keep message history in memory in case conversation reopens
	}

	// ── Message management ────────────────────────────────────────────────────

	function incrementUnreadBadge(tabName) {
		const tab = document.querySelector(`[data-id="${tabName}"]`);
		if (!tab) return;
		const badge = tab.querySelector(".unread-badge");
		if (badge) {
			badge.textContent = parseInt(badge.textContent) + 1;
		} else {
			const newBadge = document.createElement("span");
			newBadge.className = "unread-badge";
			newBadge.textContent = "1";
			tab.appendChild(newBadge);
		}
	}

	// Only mark as read if this is a DM from someone else AND the chat window is actually visible.
	function markReadIfChatVisible(tabName, message) {
		if (tabName === "global") return;
		if (message.senderId === verifiedUserId) return;
		if (chatContainer?.style.display === "none") return;
		if (document.visibilityState !== "visible") return;
		markRead(tabName);
	}

	function addMessage(tabName, message) {
		if (!messageHistory[tabName]) messageHistory[tabName] = [];
		messageHistory[tabName].push(message);

		if (tabName === activeChannel) {
			// User is already viewing this channel, render immediately
			renderMessages(tabName);
			markReadIfChatVisible(tabName, message);
		} else if (message.senderId !== verifiedUserId) {
			// Only badge for messages from others — own messages echoed to other tabs shouldn't count as unread
			incrementUnreadBadge(tabName);
		}
	}
	
	// ── Invite card actions ─────────────────────────────────────────────────
	// Used by the Accept/Reject buttons on invite cards inside renderMessages.

	function discardInviteCard(msgDiv, tabName, msg) {
		msgDiv.remove();
		const idx = messageHistory[tabName].indexOf(msg);
		if (idx !== -1) messageHistory[tabName].splice(idx, 1);
	}

	function acceptInvite(msgDiv, tabName, msg) {
		discardInviteCard(msgDiv, tabName, msg);
		acceptGameInvite(msg.invite.gameId);
		const route = msg.invite.gameType === "chess" ? "/chess-online" : "/online";
		window.history.pushState({}, '', `${route}?gameId=${msg.invite.gameId}`);
		handleRoute(route);
	}

	function rejectInvite(msgDiv, tabName, msg) {
		discardInviteCard(msgDiv, tabName, msg);
		cancelGameInvite(msg.senderId, msg.invite.gameId);
	}

	function renderInviteCard(msg, tabName, isOwnMessage) {
		const msgDiv = document.createElement("div");
		msgDiv.className = "chat-message text-base leading-relaxed text-gray-200";
		// class="chat-message ... self game-invite" or "... dm-received game-invite"
		msgDiv.classList.add(isOwnMessage ? "self" : "dm-received", "game-invite");

		if (isOwnMessage) {
			const recipientName = msg.recipientName;
			msgDiv.appendChild(document.createTextNode(t('CHAT_INVITE_SENT', { name: recipientName, game: msg.invite.gameType })));
		} else {
			msgDiv.appendChild(document.createTextNode(t('CHAT_INVITE_RECEIVED', { name: msg.senderName, game: msg.invite.gameType })));
			const acceptBtn = document.createElement("button");
			acceptBtn.textContent = t('CHAT_ACCEPT');
			acceptBtn.className = "ml-2 px-2 py-0.5 text-xs bg-pink-500 hover:bg-pink-400 rounded font-semibold";
			acceptBtn.addEventListener("click", () => acceptInvite(msgDiv, tabName, msg));
			msgDiv.appendChild(acceptBtn);
			const rejectBtn = document.createElement("button");
			rejectBtn.textContent = t('CHAT_REJECT');
			rejectBtn.className = "ml-2 px-2 py-0.5 text-xs bg-gray-500 hover:bg-gray-400 rounded font-semibold";
			rejectBtn.addEventListener("click", () => rejectInvite(msgDiv, tabName, msg));
			msgDiv.appendChild(rejectBtn);
		}
		chatMessages.appendChild(msgDiv);
	}

	function renderTextMessage(msg, tabName, isOwnMessage) {
		const msgDiv = document.createElement("div");
		msgDiv.className = "chat-message text-base leading-relaxed text-gray-200";

		if (isOwnMessage) {
			msgDiv.classList.add("self");
		} else if (tabName !== "global") {
			msgDiv.classList.add("dm-received");
		}

		const senderSpan = document.createElement("span");
		senderSpan.className = "sender";
		senderSpan.textContent = isOwnMessage ? t('CHAT_ME') : msg.senderName;

		const messageSpan = document.createElement("span");
		messageSpan.textContent = msg.message;

		msgDiv.appendChild(senderSpan);
		msgDiv.appendChild(document.createTextNode(": "));
		msgDiv.appendChild(messageSpan);
		chatMessages.appendChild(msgDiv);
	}

	function renderSeenIndicator(messages, tabName) {
		// Show "Seen" only if the other person read AND the last message is ours
		const lastMsg = messages[messages.length - 1];
		if (tabName !== "global" && seenBy[tabName] && lastMsg?.senderId === verifiedUserId) {
			const seenDiv = document.createElement("div");
			seenDiv.className = "text-right text-xs text-gray-400 pr-1 mt-1 font-medium";
			seenDiv.textContent = "✓ Seen";
			chatMessages.appendChild(seenDiv);
		}
	}

	function clearUnreadBadgeIfActive(tabName) {
		if (tabName !== activeChannel) return;
		const tab = document.querySelector(`[data-id="${tabName}"]`);
		if (tab) {
			const badge = tab.querySelector(".unread-badge");
			if (badge) badge.remove();
		}
	}

	function renderMessages(tabName) {
		chatMessages.innerHTML = "";

		const messages = messageHistory[tabName] || [];
		messages.forEach(msg => {
			const isOwnMessage = msg.senderId === verifiedUserId;
			if (msg.invite) {
				renderInviteCard(msg, tabName, isOwnMessage);
			} else {
				renderTextMessage(msg, tabName, isOwnMessage);
			}
		});

		renderSeenIndicator(messages, tabName);
		// Scroll to bottom so latest message is always visible
		chatMessages.scrollTop = chatMessages.scrollHeight;
		clearUnreadBadgeIfActive(tabName);
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
		const { userId, name, tabName } = e.detail;
		if (userId === verifiedUserId) return;
		if (!typingUsers[tabName]) typingUsers[tabName] = new Map();
		typingUsers[tabName].set(userId, name);
		if (tabName === activeChannel) renderTypingIndicator();
	});

	window.addEventListener("typingStopped", (e) => {
		const { userId, tabName } = e.detail;
		if (typingUsers[tabName]) typingUsers[tabName].delete(userId);
		if (tabName === activeChannel) renderTypingIndicator();
	});

	// ── Online users ──────────────────────────────────────────────────────────

	function renderOnlineUsers() {
		if (!onlineUsersList) return;

		onlineUsersList.innerHTML = "";

		// Sort alphabetically by username.
		Object.entries(onlineUsers).sort(([, a], [, b]) => a < b ? -1 : 1).forEach(([id, name]) => {
			// Skip yourself — every user past this point is someone else
			if (id === verifiedUserId) return;

			const div = document.createElement("div");
			div.className = "user-item";

			const statusDot = document.createElement("span");
			statusDot.className = "w-2 h-2 rounded-full bg-[#00FF00] flex-shrink-0";

			const nameSpan = document.createElement("span");
			nameSpan.className = "user-name";
			nameSpan.textContent = name;

			div.appendChild(statusDot);
			div.appendChild(nameSpan);

			if (blockedByMeIds.has(id)) {
				// Show unblock button instead of normal click behavior
				const unblockBtn = document.createElement("button");
				unblockBtn.textContent = t('CHAT_UNBLOCK');
				unblockBtn.className = "ml-auto text-xs text-pink-400 hover:text-pink-200";
				unblockBtn.addEventListener("click", (e) => {
					e.stopPropagation();
					fetchWithRefreshAuth('/api/block/unblock', {
						method: 'DELETE',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ user_id: id })
					}).then(() => reportBlockedUser());
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
					ensureDMTab(id, name || id);
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

	// chat.js dispatches this when the WS drops — wipe in-memory state so the next
	// reconnect rebuilds tabs/history fresh from the server (handles DB wipes correctly).
	window.addEventListener("wsDisconnected", () => {
		document.querySelectorAll(".channel-tab").forEach(tab => {
			if (tab.dataset.id !== "global") tab.remove();
		});
		for (const key in messageHistory) {
			if (key !== "global") delete messageHistory[key];
		}
		messageHistory.global = [];
		for (const key in seenBy) delete seenBy[key];
		for (const key in typingUsers) delete typingUsers[key];
		if (activeChannel !== "global") switchChannel("global");
		else renderMessages("global");
	});

	// chat.js dispatches this whenever a message arrives
	window.addEventListener("chatMessageReceived", (e) => {
		const { tabName, senderId, senderName, message } = e.detail;

		// If a DM arrives and the tab doesn't exist yet, create it silently
		if (tabName !== "global") {
			const existingTab = document.querySelector(`[data-id="${tabName}"]`);
			if (!existingTab) {
				// first false means don't switch to it 
				// second false means don't fetch history
				ensureDMTab(tabName, senderName, false, false);
			}
		}

		addMessage(tabName, e.detail);
	});

	// chat.js dispatches this when DM history is fetched from the database
	window.addEventListener("dmHistoryReceived", (e) => {
		const { tabName, messages, seen } = e.detail;
		if (!messageHistory[tabName]) messageHistory[tabName] = [];
		messageHistory[tabName] = messages.map(msg => {
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
		if (seen) seenBy[tabName] = true;
		if (tabName === activeChannel) renderMessages(tabName);
	});
	
	// Restore DM tabs from previous session on page load
	window.addEventListener("openDmsMetadataReceived", (e) => {
		const dms_metadata = e.detail.dms_metadata;
		// entries turn the object into an array of [key, value] pairs
		Object.entries(dms_metadata).forEach(([userId, data]) => {
			// Fetch history when there are unread messages so the cache holds them before
			// any live messages arrive — otherwise switchChannel sees a non-empty cache
			// (just the live ones) and skips the DB fetch, hiding the earlier messages.
			const needsHistory = data.unread_count > 0;
			ensureDMTab(userId, data.user_name, false, needsHistory);
			if (data.unread_count > 0) {
				const tab = document.querySelector(`[data-id="${userId}"]`);
				if (tab) {
					// On WS reconnect the tab already exists — remove stale badge before adding the fresh one.
					tab.querySelector(".unread-badge")?.remove();
					const badge = document.createElement("span");
					badge.className = "unread-badge";
					badge.textContent = data.unread_count;
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
			// Move cursor into the textarea so the user can start typing immediately.
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
			const targetInGame = inGameIds.has(user.id);
			const senderInGame = inGameIds.has(verifiedUserId);
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
	chatUserMenu.addEventListener("click", async (e) => {
		const action = e.target.dataset.action;
		if (!action || !chatMenuUser) return;

		if (action === "profile") {
			navigate(`/profile/${chatMenuUser.name}`);
		} else if (action === "invite") {
			// Show game picker below the context menu — keep chatMenuUser alive for when picker is clicked
			e.stopPropagation();
			const rect = chatUserMenu.getBoundingClientRect(); // returns the element's position/size on screen
			gamePickerMenu.style.left = chatUserMenu.style.left;
			gamePickerMenu.style.top = `${rect.bottom + 4}px`;
			gamePickerMenu.style.display = "block";
			return; // skip hideChatUserMenu() at the bottom
		} else if (action === "chat") {
			ensureDMTab(chatMenuUser.id, chatMenuUser.name);
		} else if (action === "block") {
			const blockedUserId = chatMenuUser.id;
			const r = await fetchWithRefreshAuth('/api/block/', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ user_id: blockedUserId })
			});
			const data = await r.json();
			if (data.success) {
				reportBlockedUser(blockedUserId);
			} else {
				console.warn("Block failed:", data.error);
			}
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

		const inviteeId = chatMenuUser.id;
		const inviteeName = chatMenuUser.name;
		hideChatUserMenu();
		pendingInvite = true;

		if (gameType === "chess") {
			console.log('[invite] POSTing /api/chess/join/ for invitee:', inviteeId);
			const res = await fetchWithRefreshAuth('/api/chess/join/', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ invitee_id: inviteeId })
			});
			console.log('[invite] /api/chess/join/ response — status:', res.status, 'ok:', res.ok);
			if (!res.ok) {
				pendingInvite = false;
				showMessage(t('CHAT_CREATE_GAME_ERROR'), "error");
				return;
			}
			const data = await res.json();
			const gameId = data.gameId;
			console.log('[invite] gameId from response:', gameId);
			sendGameInvite(inviteeId, "chess", gameId);
			ensureDMTab(inviteeId, inviteeName, true, false);
			addMessage(inviteeId, {
				senderId: verifiedUserId,
				senderName: null,
				recipientName: inviteeName,
				invite: { gameType: "chess", gameId }
			});
			// pendingInvite stays true until A leaves /chess-online
			window.history.pushState({}, '', `/chess-online?gameId=${gameId}`);
			handleRoute('/chess-online');
		} else if (gameType === "pong") {
			const res = await fetchWithRefreshAuth('/api/game/create', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ invitee_id: inviteeId })
			});
			if (!res.ok) {
				pendingInvite = false;
				showMessage(t('CHAT_CREATE_GAME_ERROR'), "error");
				return;
			}
			const data = await res.json();
			const gameId = data.gameId;
			sendGameInvite(inviteeId, "pong", gameId);
			ensureDMTab(inviteeId, inviteeName, true, false);
			addMessage(inviteeId, {
				senderId: verifiedUserId,
				senderName: null,
				recipientName: inviteeName,
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
		const tabName = senderId;

		const existingTab = document.querySelector(`[data-id="${tabName}"]`);
		if (!existingTab) {
			ensureDMTab(tabName, senderName, false, false);
		}

		addMessage(tabName, {
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
			showMessage(t('CHAT_USER_IN_GAME'), "error");
		}
	});

	function removeInviteFromHistory(gameId) {
		for (const tabName in messageHistory) {
			const before = messageHistory[tabName].length;
			const removedFromOther = messageHistory[tabName].filter(
				m => m.invite?.gameId === gameId && m.senderId !== verifiedUserId
			).length;
			messageHistory[tabName] = messageHistory[tabName].filter(m => m.invite?.gameId !== gameId);
			if (messageHistory[tabName].length < before) {
				renderMessages(tabName);
				if (tabName !== activeChannel && removedFromOther > 0) {
					const tab = document.querySelector(`[data-id="${tabName}"]`);
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

	window.addEventListener("messagesSeenByDmPartner", (e) => {
		const tabName = e.detail.read_by;
		seenBy[tabName] = true;
		if (activeChannel === tabName) renderMessages(tabName);
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

	// Called once at startup. Sets up the typing indicator by passing the textarea and a function that
	// returns the current DM partner ID (or null for global). initTyping attaches a listener to the
	// textarea so that on every keystroke it knows where to send the typing notification.
	initTyping(chatInput, () => activeChannel === "global" ? null : activeChannel);

	if (sendChatBtn && chatInput) {
		const sendMessage = () => {
			const message = chatInput.value.trim();
			if (!message) return;
			if (message.length > MAX_CHARS) return;

			// null recipient means global chat, otherwise it's a DM to that user ID
			const recipient = activeChannel === "global" ? null : activeChannel;
			// Clear "Seen" when we send a new message — it's no longer valid
			if (recipient) seenBy[recipient] = false;
			sendChatMessage(message, recipient);

			chatInput.value = "";
			// Reset counter after sending
			charCounter.textContent = `0 / ${MAX_CHARS}`;
			charCounter.classList.remove("text-red-500");
			charCounter.classList.add("text-gray-400");
			sendChatBtn.disabled = false;
			// Move cursor back into the textarea after sending so the user can keep typing.
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

	const globalTab = document.querySelector('[data-id="global"]');
	if (globalTab) {
		globalTab.addEventListener("click", () => switchChannel("global"));
	}
}