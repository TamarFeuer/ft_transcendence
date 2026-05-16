// Handles WebSocket chat: connection, messaging, typing, online users.
// The chat panel is a persistent overlay in index.html — it is NOT a route.
// It stays alive across SPA navigation because it lives outside #app-root.
import { t, TranslationKey } from '../i18n/index.js';

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

export function initChat() {
	const wsProtocol = location.protocol === "https:" ? "wss:" : "ws:";
	chatSocket = new WebSocket(`${wsProtocol}//${location.host}/ws/chat/`);

	chatSocket.onopen = () => {
		console.log("Chat WebSocket connected");
		reconnectDelay = 1000;
	};

	chatSocket.onclose = () => {
		console.log(`Chat WebSocket disconnected — reconnecting in ${reconnectDelay / 1000}s`);
		reconnectTimer = setTimeout(() => {
			reconnectDelay = Math.min(reconnectDelay * 2, 30000);
			initChat();
		}, reconnectDelay);
	};

	chatSocket.onerror = (err) => {
		console.error("Chat WebSocket error:", err);
	};

	// Fires whenever the backend sends a message over the WebSocket.
	chatSocket.onmessage = (ev) => {
		// All messages from the server are JSON
		const data = JSON.parse(ev.data);
		
		switch (data.type) {

			// Server confirms our identity after connect
			case "selfId":
					verifiedUserId = data.user_id;
					verifiedUserName = data.user_name || "Guest";
					console.log(`Chat identified as: ${verifiedUserName} (id: ${verifiedUserId})`);
					window.dispatchEvent(new CustomEvent("userIdentified", {
						detail: { userId: verifiedUserId }
					}));
					// Fetch previous DM conversations to restore tabs
					fetchOpenDms();
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
				console.log("Received onlineUsers message:", data.users);
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
				
			case "openDms":
				console.log("openDms received:", data.dms);
				window.dispatchEvent(new CustomEvent("openDmsReceived", {
					detail: { dms: data.dms }
				}));
				break;

			case "messagesSeenByDmPartner":
				window.dispatchEvent(new CustomEvent("messagesSeenByDmPartner", {
					detail: { by: data.by }
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

			default:
				console.warn("Unknown chat message type:", data.type);
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

function fetchOpenDms() {
	if (!chatSocket || chatSocket.readyState !== WebSocket.OPEN) return;
	chatSocket.send(JSON.stringify({ type: "get_open_dms" }));
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
	if (!chatSocket || chatSocket.readyState !== WebSocket.OPEN) {
		console.warn("sendChatMessage: WebSocket not ready (state:", chatSocket?.readyState, ")");
		return;
	}

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
	console.log('[invite] sendGameInvite — WS state:', chatSocket?.readyState, '(1=OPEN), gameId:', gameId, 'invitee:', inviteeId);
	if (!chatSocket || chatSocket.readyState !== WebSocket.OPEN) {
		console.warn('[invite] DROPPED — WS not open');
		return;
	}
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