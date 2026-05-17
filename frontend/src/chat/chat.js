// Handles WebSocket chat: connection, messaging, typing, online users.
// The chat panel is a persistent overlay in index.html — it is NOT a route.
// It stays alive across SPA navigation because it lives outside #app-root.
import { t, TranslationKey } from '../i18n/index.js';
import { navigate } from '../routes/route_helpers.js';

function formatGameResultMessage(data) {
	const { winner, loser, draw_players, game_type = 'game' } = data;
	const gameNameKeyMap = {
		chess: TranslationKey.GAME_NAME_CHESS,
		pong: TranslationKey.GAME_NAME_PONG,
	};
	const game = gameNameKeyMap[game_type] ? t(gameNameKeyMap[game_type]) : game_type;
	if (winner && loser)
		return t(TranslationKey.CHAT_GAME_RESULT_WIN_LOSS, { winner, loser, game });
	if (winner)
		return t(TranslationKey.CHAT_GAME_RESULT_WIN_ONLY, { winner, game });
	if (draw_players && draw_players[0] && draw_players[1])
		return t(TranslationKey.CHAT_GAME_RESULT_DRAW, { player1: draw_players[0], player2: draw_players[1], game });
	return t(TranslationKey.CHAT_GAME_RESULT_DRAW_UNKNOWN, { game });
}

// ── State ─────────────────────────────────────────────────────────────────────

let chatSocket = null; // Single shared WebSocket connection for all chat
export let verifiedUserId = null; // Set after server sends "self_id" confirmation
let verifiedUserName = null;

// Exported so other modules (e.g. main.js) can read the current online users
// Shape: { user_id: username } e.g. { "42": "tamar", "7": "rik" }
export let onlineUsers = {};
// Set of user IDs the current user has blocked
export let blockedByMeIds = new Set();
// Set of user IDs who have blocked the current user
export let blockedMeIds = new Set();
// Set of user IDs currently in an active game
export let inGameIds = new Set();


let reconnectDelay = 1000;
let reconnectTimer = null;

// ── Connection lifecycle ───────────────────────────────────────────────────────

export async function initChat() {
	// The WS handshake authenticates via the access_token cookie. That token expires
	// every 2 min and WebSockets have no equivalent of fetchWithRefreshAuth, so we
	// refresh it ourselves before each connect (including every reconnect attempt).
	try {
		const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
		// 401 = refresh token expired; 400 = refresh cookie missing (e.g. user wiped by `down -v`).
		// Either way the session is dead: clear cookies on the server and send the user to /login.
		if (res.status === 401 || res.status === 400) {
			await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
			closeChat();
			navigate('/login');
			return;
		}
	} catch (err) {
		// Server unreachable — fall through and let the WS attempt + reconnect loop handle it.
	}

	const wsProtocol = location.protocol === "https:" ? "wss:" : "ws:";
	chatSocket = new WebSocket(`${wsProtocol}//${location.host}/ws/chat/`);

	chatSocket.onopen = () => {
		console.log("Chat WebSocket connected");
		reconnectDelay = 1000;
	};

	chatSocket.onclose = () => {
		console.log(`Chat WebSocket disconnected — reconnecting in ${reconnectDelay / 1000}s`);
		// Clear cached state so the UI doesn't show stale online users while disconnected.
		onlineUsers = {};
		blockedByMeIds = new Set();
		blockedMeIds = new Set();
		inGameIds = new Set();
		window.dispatchEvent(new CustomEvent("onlineUsersUpdated"));
		// Tell chat-ui to wipe DM tabs / message history — we'll repopulate from the server on reconnect.
		window.dispatchEvent(new CustomEvent("wsDisconnected"));
		reconnectTimer = setTimeout(() => {
			reconnectDelay = Math.min(reconnectDelay * 2, 30000);
			initChat();
		}, reconnectDelay);
	};

	// Fires whenever the backend sends a message over the WebSocket.
	chatSocket.onmessage = (ev) => {
		// All messages from the server are JSON
		const data = JSON.parse(ev.data);
		
		switch (data.type) {

			// Server confirms our identity after connect
			case "selfId":
					verifiedUserId = data.user_id;
					verifiedUserName = data.user_name;
					console.log(`Chat identified as: ${verifiedUserName} (id: ${verifiedUserId})`);
					// Fetch previous DM conversations to restore tabs
					fetchOpenDmsMetadata();
					break;
			
			case "openDmsMetadata":
				console.log("openDmsMetadata received:", data.dms_metadata);
				window.dispatchEvent(new CustomEvent("openDmsMetadataReceived", {
					detail: { dms_metadata: data.dms_metadata }
				}));
				break;

			// Incoming chat message — either global or private DM
			case "chatMessage": {
					// For private messages, the "channel" in the UI is the OTHER person.
					// If I sent it: channel = target. If I received it: channel = sender.
					// For global messages, channel is always "global";
				let tabName;
				
				if (data.private) {
					if (data.sender_id === verifiedUserId) {
						// I sent this message - use the recipient's ID for the channel
						tabName = data.recipient_id;
						console.log("I sent this - tabName set to:", tabName);
					} else {
						// Someone sent me a message - use their ID for the channel
						tabName = data.sender_id;
						console.log("Someone sent to me - tabName set to sender:", tabName);
					}
				} else {
					// Global message
					tabName = "global";
					console.log("Global message - tabName set to:", tabName);
				}

				// Dispatch to main.js which owns the UI rendering
				window.dispatchEvent(new CustomEvent("chatMessageReceived", {
					detail: {
						tabName,
						senderId: data.sender_id,
						senderName: data.sender_name || "unknown",
						message: data.message
					}
				}));
				break;
			}

			// Server sends the full list of online users whenever someone joins/leaves
			case "onlineUsers":
				onlineUsers = data.users;
				blockedByMeIds = new Set(data.blocked_by_me_ids || []);
				blockedMeIds = new Set(data.blocked_me_ids || []);
				inGameIds = new Set(data.in_game_ids || []);
				window.dispatchEvent(new CustomEvent("onlineUsersUpdated"));
				break;

			case "dmHistory":
				window.dispatchEvent(new CustomEvent("dmHistoryReceived", {
					detail: {
						tabName: data.dm_partner_id,
						messages: data.messages,
						seen: data.seen,
					}
				}));
				break;

			case "messagesSeenByDmPartner":
				window.dispatchEvent(new CustomEvent("messagesSeenByDmPartner", {
					detail: { read_by: data.read_by }
				}));
				break;

			case "gameInvite":
				window.dispatchEvent(new CustomEvent("gameInviteReceived", {
					detail: {
						senderId: data.sender_id,
						senderName: data.sender_name,
						gameType: data.game_type,
						gameId: data.game_id,
					}
				}));
				break;

			case "gameInviteExpired":
				window.dispatchEvent(new CustomEvent("gameInviteExpired", {
					detail: { gameId: data.game_id }
				}));
				break;

			case "gameInviteBlocked":
				window.dispatchEvent(new CustomEvent("gameInviteBlocked", {
					detail: { gameId: data.game_id }
				}));
				break;

			case "gameInviteRejected":
				window.dispatchEvent(new CustomEvent("gameInviteRejected", {
					detail: { reason: data.reason }
				}));
				break;

			case "gameInviteAccepted":
				window.dispatchEvent(new CustomEvent("gameInviteAccepted", {
					detail: { gameId: data.game_id }
				}));
				break;

			case "friendListChanged":
				window.dispatchEvent(new CustomEvent("friendListChanged"));
				break;

			case "gameResult":
				window.dispatchEvent(new CustomEvent("chatMessageReceived", {
					detail: {
						tabName: "global",
						senderId: null,
						senderName: t('CHAT_GAME_RESULT_TITLE'),
						message: formatGameResultMessage(data)
					}
				}));
				break;

			case "otherTyping": {
				const tabName = data.private ? data.typer_id : "global";
				window.dispatchEvent(new CustomEvent("typingStarted", {
					detail: { userId: data.typer_id, name: data.typer_name, tabName }
				}));
				break;
			}
			case "otherStoppedTyping": {
				const tabName = data.private ? data.typer_id : "global";
				window.dispatchEvent(new CustomEvent("typingStopped", {
					detail: { userId: data.typer_id, tabName }
				}));
				break;
			}

		}
	};
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

// ── Messaging ─────────────────────────────────────────────────────────────────

function fetchOpenDmsMetadata() {
	if (!chatSocket || chatSocket.readyState !== WebSocket.OPEN) return;
	chatSocket.send(JSON.stringify({ type: "get_open_dms_metadata" }));
}

export function fetchDMHistory(dmPartnerId) {
	if (!chatSocket || chatSocket.readyState !== WebSocket.OPEN) return;
	chatSocket.send(JSON.stringify({
		type: "fetch_history",
		dm_partner_id: dmPartnerId
	}));
}

export function setActiveConversation(partnerId) {
	if (!chatSocket || chatSocket.readyState !== WebSocket.OPEN) return;
	chatSocket.send(JSON.stringify({
		type: "set_active_conversation",
		partner_id: partnerId
	}));
}

export function markRead(dmPartnerId) {
	if (!chatSocket || chatSocket.readyState !== WebSocket.OPEN) return;
	chatSocket.send(JSON.stringify({
		type: "mark_read",
		dm_partner_id: dmPartnerId
	}));
}

/**
 * Send a chat message via the WebSocket, global or DM
 * @param {string} message - The text content to send
 * @param {string|null} recipientId - User ID to send a private DM, or null for global chat
 */
export function sendChatMessage(message, recipientId = null) {
	if (!chatSocket || chatSocket.readyState !== WebSocket.OPEN) return;

	const payload = {
		type: "send_message",
		message
	};

	// Only add recipient_id if it's a private message — omitting it means global
	if (recipientId) {
		payload.recipient_id = recipientId;
	}

	chatSocket.send(JSON.stringify(payload));
}

export function hideDm(dmPartnerId) {
	if (!chatSocket || chatSocket.readyState !== WebSocket.OPEN) return;
	chatSocket.send(JSON.stringify({
		type: "hide_dm",
		dm_partner_id: dmPartnerId
	}));
}

// The HTTP block API only writes to the database — it has no connection to the WebSocket consumer.
// This notifies the consumer separately so it can clean up pending game invites,
// broadcast an updated online users list, and send friendListChanged to both users.
export function reportBlockedUser(blockedUserId = null) {
	if (!chatSocket || chatSocket.readyState !== WebSocket.OPEN) return;
	chatSocket.send(JSON.stringify({ type: "report_blocked_user", blocked_user_id: blockedUserId }));
}

// ── Typing ────────────────────────────────────────────────────────────────────

/**
 * Attach typing indicator events to the chat textarea.
 * Sends "typing" on input, then "stop_typing" after 1s of inactivity.
 * @param {HTMLTextAreaElement} chatInput - The textarea element.
 * @param {Function} getActiveChannel - Returns the current DM partner user ID, or null for global.
 */
export function initTyping(chatInput, getActiveChannel = () => null) {
	if (!chatInput || !chatSocket) return;

	// Stores the ID of the current countdown timer.
	// Declared outside the event listener so it persists between keystrokes —
	// if it were inside the listener, it would reset to undefined on every keystroke
	// and clearTimeout() would never be able to cancel the previous timer.
	let typingTimeout;

	// We wrap the listener setup in a function because we need to attach it
	// in two different places below — either now if the socket is already open,
	// or later when it opens.
	const attachTyping = () => {
		// The browser fires the input event once per keystroke (also on delete/paste).
		chatInput.addEventListener("input", () => {
			if (chatSocket.readyState !== WebSocket.OPEN) return;

			// Tell the server this user is typing
			const typingRecipientId = getActiveChannel();
			const typingPayload = { type: "notify_typing" };
			if (typingRecipientId) typingPayload.typing_recipient_id = typingRecipientId;
			chatSocket.send(JSON.stringify(typingPayload));

			// Debounce: cancel the previous countdown and start a fresh one
			// "notify_stop_typing" only fires if the user stops typing for a full second
			clearTimeout(typingTimeout);
			typingTimeout = setTimeout(() => {
				if (chatSocket.readyState === WebSocket.OPEN) {
					const stopPayload = { type: "notify_stop_typing" };
					if (typingRecipientId) stopPayload.typing_recipient_id = typingRecipientId;
					chatSocket.send(JSON.stringify(stopPayload));
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

// ── Game invites ───────────────────────────────────────────────────────────────

export function sendGameInvite(inviteeId, gameType, gameId) {
	if (!chatSocket || chatSocket.readyState !== WebSocket.OPEN) return;
	chatSocket.send(JSON.stringify({
		type: "send_game_invite",
		invitee_id: inviteeId,
		game_type: gameType,
		game_id: gameId,
	}));
}

export function cancelGameInvite(inviteeId, gameId) {
	if (!chatSocket || chatSocket.readyState !== WebSocket.OPEN) return;
	chatSocket.send(JSON.stringify({
		type: "cancel_game_invite",
		invitee_id: inviteeId,
		game_id: gameId,
	}));
}

export function acceptGameInvite(gameId) {
	if (!chatSocket || chatSocket.readyState !== WebSocket.OPEN) return;
	chatSocket.send(JSON.stringify({
		type: "accept_game_invite",
		game_id: gameId,
	}));
}