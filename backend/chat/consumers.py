import json
from channels.generic.websocket import AsyncWebsocketConsumer
import logging
from users.token_auth import get_user_from_token
from channels.db import database_sync_to_async

logger = logging.getLogger(__name__)

GLOBAL_CHAT_GROUP = "global_chat"  # arbitrary name for the Django Channels broadcast group
ONLINE_USERS = {}          # user_id -> username
USER_CONNECTION_COUNT = {}  # user_id -> number of open tabs; reaches 0 when last tab closes
ACTIVE_CONVERSATION = {}   # user_id -> other_user_id they currently have open
IN_GAME_USERS = set()      # user_ids currently in an active game (any game type)
PENDING_GAME_RESULTS = {}  # user_id -> game result message to deliver on next reconnect
# ACTIVE_CONVERSATION stays in-memory: it reflects the live UI state and resets
# naturally when the user reconnects.

class ChatConsumer(AsyncWebsocketConsumer):
	async def connect(self):

		# Reject unauthenticated connections — 
		# TokenAuthMiddleware already resolved the user from the JWT cookie.
		user = self.scope['user']

		if not user or not user.is_authenticated:
			await self.close()
			return

		# get_user_from_token returns Django's proper User model object,
		# which has .id and .username as standard Django fields.
		self.user = user
		self.user_id = str(user.id)
		self.username = user.username

		# Every user joins the global group so they receive global messages.
		# DMs and invites are delivered via the personal user_{id} group joined below.
		await self.channel_layer.group_add(GLOBAL_CHAT_GROUP, self.channel_name)
		await self.channel_layer.group_add(f"user_{self.user_id}", self.channel_name)
		await self.accept()

		# Count open connections so we know when the user goes fully offline.
		USER_CONNECTION_COUNT[self.user_id] = USER_CONNECTION_COUNT.get(self.user_id, 0) + 1

		# Register user as online.
		ONLINE_USERS[self.user_id] = self.username

		# Tell the client their own user_id and username so the frontend
		# knows who it is (used in chat.js to determine message ownership).
		await self.send(text_data=json.dumps({
			"type": "selfId",
			"user_id": self.user_id,
			"user_name": self.username
		}))

		# Delete stale game invites from before this connection — any invite that
		# survived a server restart is invalid since the game session no longer exists.
		await self.cleanup_stale_invites()

		# Deliver any game result the user missed while their chat WS was down.
		pending = PENDING_GAME_RESULTS.pop(self.user_id, None)
		if pending:
			await self.send(text_data=json.dumps({
				"type": "gameResult",
				"winner": pending.get("winner"),
				"loser": pending.get("loser"),
				"draw_players": pending.get("draw_players"),
				"game_type": pending.get("game_type", "game"),
			}))

		# Broadcast updated online users list to everyone.
		await self.broadcast_online_users()

	async def disconnect(self, close_code):
		# Only run cleanup if connect() completed successfully — user_id is set only after auth.
		user_id = getattr(self, "user_id", None)
		if not user_id:
			return

		# Leave the channel groups — remove this connection from GLOBAL_CHAT_GROUP and user_{id}.
		await self.channel_layer.group_discard(GLOBAL_CHAT_GROUP, self.channel_name)
		await self.channel_layer.group_discard(f"user_{self.user_id}", self.channel_name)

		# Clean up in-memory data — decrement the connection count, remove from ONLINE_USERS if last tab.
		count = USER_CONNECTION_COUNT.get(user_id, 1) - 1
		if count <= 0:
			USER_CONNECTION_COUNT.pop(user_id, None)
			ONLINE_USERS.pop(user_id, None)
			ACTIVE_CONVERSATION.pop(user_id, None)
		else:
			USER_CONNECTION_COUNT[user_id] = count

		# Broadcast — tell everyone else this user went offline.
		await self.broadcast_online_users()

	async def receive(self, text_data):
		try:
			data = json.loads(text_data)
		except json.JSONDecodeError:
			logger.warning(f"Received invalid JSON from {self.username}: {text_data}")
			return

		msg_type = data.get("type")

		logger.debug(f"[receive] type={msg_type} user={self.username}({self.user_id})")

		if msg_type == "send_message":
			message = data.get("message", "")
			if len(message) > 300:
				return

			recipient_id = data.get("recipient_id")
			event = {
				"type": "chat.message",
				"message": message,
				"sender_id": self.user_id,
				"sender_name": self.username,
			}

			if recipient_id:
				# Block check: silently drop the message if either user has blocked the other.
				from block.models import is_blocked
				if await database_sync_to_async(is_blocked)(self.user_id, recipient_id):
					return

				# Private message: deliver to all of the recipient's open tabs,
				# and echo back to all of the sender's own tabs (so other tabs stay in sync).
				# group_send reaches every connection in the group automatically.
				event["private"] = True
				event["recipient_id"] = recipient_id
				await self.channel_layer.group_send(f"user_{recipient_id}", event)
				await self.channel_layer.group_send(f"user_{self.user_id}", event)
				# Persist the message and update conversation state in the database.
				await self.save_dm(recipient_id, message)
			else:
				# Global message: broadcast to everyone in the global group.
				# Global messages are not saved to the database.
				event["private"] = False
				await self.channel_layer.group_send(GLOBAL_CHAT_GROUP, event)

		elif msg_type == "fetch_history":
			dm_partner_id = data.get("dm_partner_id")
			if not dm_partner_id:
				return
			logger.debug(f"[fetch_history] user={self.username}({self.user_id}) → dm_partner_id={dm_partner_id}")
			messages, seen = await self.get_dm_history(self.user_id, dm_partner_id)
			await self.send(text_data=json.dumps({
				"type": "dmHistory",
				"dm_partner_id": dm_partner_id,
				"messages": messages,
				"seen": seen,
			}))

		elif msg_type == "get_open_dms":
			dms = await self.get_open_dms(self.user_id)
			logger.info(f"[get_open_dms] user={self.username}({self.user_id}) → {dms}")
			await self.send(text_data=json.dumps({
				"type": "openDms",
				"dms": dms
			}))

		elif msg_type == "set_active_conversation":
			partner_id = data.get("partner_id")
			logger.debug(f"[set_active_conversation] user={self.username}({self.user_id}) → partner_id={partner_id}")
			if partner_id:
				# Track that this user is now actively viewing this DM tab.
				# Used in save_dm to skip the unread increment for active viewers.
				ACTIVE_CONVERSATION[self.user_id] = partner_id
			else:
				# null partner_id means the user switched away (e.g. to global) — clear so
				# save_dm doesn't keep skipping the unread increment for their old DM.
				ACTIVE_CONVERSATION.pop(self.user_id, None)

		elif msg_type == "mark_read":
			dm_partner_id = data.get("dm_partner_id")
			if not dm_partner_id:
				return
			logger.info(f"[mark_read] user={self.username}({self.user_id}) read conversation with {dm_partner_id}")
			# Reset the unread counter for this conversation in the database.
			await self.mark_read(self.user_id, dm_partner_id)
			# Notify the other user that their messages were read.
			await self.channel_layer.group_send(
				f"user_{dm_partner_id}",
				{"type": "messages.read", "by": self.user_id}
			)

		elif msg_type == "hide_dm":
			dm_partner_id = data.get("dm_partner_id")
			if not dm_partner_id:
				return
			logger.debug(f"[hide_dm] user={self.username}({self.user_id}) → dm_partner_id={dm_partner_id}")
			# Mark this conversation as hidden in the database.
			await self.hide_dm(self.user_id, dm_partner_id)

		elif msg_type == "send_game_invite":
			invitee_id = data.get("invitee_id")
			game_type = data.get("game_type")
			game_id = data.get("game_id")
			logger.debug(f"[invite] send_game_invite from {self.user_id} → invitee_id={invitee_id} game_id={game_id}")
			if not invitee_id or not game_type or not game_id:
				logger.warning(f"[invite] missing fields — invitee_id={invitee_id} game_type={game_type} game_id={game_id}")
				return
			if invitee_id in IN_GAME_USERS or self.user_id in IN_GAME_USERS:
				await self.send(text_data=json.dumps({
					"type": "gameInviteRejected",
					"reason": "in_game",
				}))
				return
			payload = {
				"type": "game.invite",
				"sender_id": self.user_id,
				"sender_name": self.username,
				"game_type": game_type,
				"game_id": game_id,
			}
			# If the invitee has no open tabs the group_send is a no-op; the invite is still saved to DB.
			await self.channel_layer.group_send(f"user_{invitee_id}", payload)
			await self.save_invite(invitee_id, game_type, game_id)

		elif msg_type == "cancel_game_invite":
			invitee_id = data.get("invitee_id")
			game_id = data.get("game_id")
			if not invitee_id or not game_id:
				return
			logger.debug(f"[cancel_game_invite] user={self.username}({self.user_id}) → invitee_id={invitee_id} game_id={game_id}")
			await self.delete_invite(game_id)
			payload = {
				"type": "game.invite.expired",
				"game_id": game_id,
			}
			await self.channel_layer.group_send(f"user_{invitee_id}", payload)

		elif msg_type == "accept_game_invite":
			game_id = data.get("game_id")
			logger.debug(f"[accept_game_invite] user={self.username}({self.user_id}) game_id={game_id}")
			if game_id:
				sender_id = await self.delete_invite(game_id)
				if sender_id:
					await self.channel_layer.group_send(f"user_{sender_id}", {
						"type": "game.invite.accepted",
						"game_id": game_id,
					})
					await self.channel_layer.group_send(f"user_{self.user_id}", {
						"type": "game.invite.accepted",
						"game_id": game_id,
					})

		elif msg_type == "report_blocked_user":
			blocked_user_id = data.get("blocked_user_id")
			logger.debug(f"[report_blocked_user] user={self.username}({self.user_id}) → blocked_user_id={blocked_user_id}")
			if blocked_user_id:
				game_id = await self.get_invite_id_with(blocked_user_id)
				if game_id:
					await self.channel_layer.group_send(
						f'user_{self.user_id}',
						{'type': 'game.invite.blocked', 'game_id': game_id}
					)
					await self.channel_layer.group_send(
						f'user_{blocked_user_id}',
						{'type': 'game.invite.expired', 'game_id': game_id}
					)
				await self.channel_layer.group_send(
					f'user_{self.user_id}',
					{'type': 'friend.list.changed'}
				)
				await self.channel_layer.group_send(
					f'user_{blocked_user_id}',
					{'type': 'friend.list.changed'}
				)
			await self.broadcast_online_users()

		elif msg_type in ["notify_typing", "notify_stop_typing"]:
			typing_recipient_id = data.get("typing_recipient_id")
			action = "stop_typing" if msg_type == "notify_stop_typing" else "typing"
			logger.debug(f"[{msg_type}] user={self.username}({self.user_id}) → typing_recipient_id={typing_recipient_id}")
			# DM: notify only the typing recipient; global: broadcast to the global chat group
			group = f"user_{typing_recipient_id}" if typing_recipient_id else GLOBAL_CHAT_GROUP
			await self.channel_layer.group_send(
				group,
				{
					"type": "typing.notification",
					"action": action,
					"typer_id": self.user_id,
					"typer_name": self.username,
					"private": bool(typing_recipient_id),
				}
			)

	# ─── Event handlers ───────────────────────────────────────────────────────
	# These are called by the channel layer when a message arrives for this consumer.
	# The method name must match the "type" field in the payload, with dots
	# replaced by underscores — e.g. "chat.message" -> chat_message()

	async def chat_message(self, event):
		# Deliver a chat message (global or DM) to this consumer's client.
		await self.send(text_data=json.dumps({
			"type": "chatMessage",
			"message": event["message"],
			"sender_id": event["sender_id"],
			"sender_name": event.get("sender_name"),
			"private": event.get("private", False),  # True for DMs, False for global
			"recipient_id": event.get("recipient_id")  # user_id of DM recipient, or None for global
		}))

	async def messages_read(self, event):
		await self.send(text_data=json.dumps({
			"type": "messagesSeenByDmPartner",
			"by": event["by"],
		}))

	async def game_invite(self, event):
		await self.send(text_data=json.dumps({
			"type": "gameInvite",
			"sender_id": event["sender_id"],
			"sender_name": event["sender_name"],
			"game_type": event["game_type"],
			"game_id": event["game_id"],
		}))

	def format_game_result_message(self, event):
		winner = event.get("winner")
		loser = event.get("loser")
		draw_players = event.get("draw_players")
		game_type = event.get("game_type", "game")
		if winner and loser:
			return f"{winner} beat {loser} in a game of {game_type}!"
		elif winner:
			return f"{winner} won a game of {game_type}!"
		elif draw_players and all(draw_players):
			return f"{draw_players[0]} and {draw_players[1]} drew in a game of {game_type}!"
		else:
			return f"A game of {game_type} ended in a draw."

	async def game_result(self, event):
		await self.send(text_data=json.dumps({
			"type": "gameResult",
			"winner": event.get("winner"),
			"loser": event.get("loser"),
			"draw_players": event.get("draw_players"),
			"game_type": event.get("game_type", "game"),
		}))

	async def trigger_online_users_broadcast(self, event):
		logger.debug(f"[broadcast] IN_GAME_USERS at broadcast time: {IN_GAME_USERS}")
		await self.broadcast_online_users()

	async def game_invite_accepted(self, event):
		await self.send(text_data=json.dumps({
			"type": "gameInviteAccepted",
			"game_id": event["game_id"],
		}))

	async def game_invite_blocked(self, event):
		game_id = event["game_id"]
		await self.delete_invite(game_id)
		await self.send(text_data=json.dumps({
			"type": "gameInviteBlocked",
			"game_id": game_id,
		}))

	async def game_invite_expired(self, event):
		game_id = event["game_id"]
		await self.delete_invite(game_id)
		await self.send(text_data=json.dumps({
			"type": "gameInviteExpired",
			"game_id": game_id,
		}))

	async def friend_list_changed(self, _event):
		await self.send(text_data=json.dumps({'type': 'friendListChanged'}))

	async def typing_notification(self, event):
		# Deliver a typing indicator to this consumer's client.
		action = "otherStoppedTyping" if event["action"] == "stop_typing" else "otherTyping"
		await self.send(text_data=json.dumps({
			"type": action,
			"typer_id": event["typer_id"],
			"typer_name": event.get("typer_name"),
			"private": event.get("private"),
		}))

	async def online_users(self, event):
		# Deliver the updated online users list to this consumer's client.
		await self.send(text_data=json.dumps({
			"type": "onlineUsers",
			"users": event["users"],
			"blocked_by_me_ids": event.get("blocked_by_me_ids", []),
			"blocked_me_ids": event.get("blocked_me_ids", []),
			"in_game_ids": event.get("in_game_ids", []),
		}))

	# ─── Internal helpers ────────────────────────────────────────────────────

	async def broadcast_online_users(self):
		# Send each online user a personalized online users list.
		# Each user sees a different list: users who blocked them are hidden.
		# group_send to user_{id} reaches all their open tabs at once.
		for user_id in list(ONLINE_USERS.keys()):
			blocked_by_me, blocked_me = await self.get_block_info_for(user_id)
			users = {
				uid: name
				for uid, name in list(ONLINE_USERS.items())
				if uid not in blocked_me
			}
			await self.channel_layer.group_send(f"user_{user_id}", {
				"type": "online.users",
				"users": users,
				"blocked_by_me_ids": list(blocked_by_me),
				"blocked_me_ids": list(blocked_me),
				"in_game_ids": list(IN_GAME_USERS),
			})

	# ─── Database helpers ─────────────────────────────────────────────────────
	# All database access must be wrapped in database_sync_to_async because
	# Django's ORM is synchronous but the consumer runs in an async context.
	# database_sync_to_async runs the wrapped function in a thread pool executor.

	# The sender's consumer saves the message — it's the one that received the send_message event from the browser.
	@database_sync_to_async
	def save_dm(self, recipient_id, content):
		from chat.models import ConversationParticipant, Message
		# F references a DB column directly so the increment happens in a single atomic DB operation,
		# avoiding race conditions if two messages arrive at the same time.
		from django.db.models import F

		conversation = self.get_or_create_conversation(recipient_id)
		Message.objects.create(
			conversation=conversation,
			sender_id=self.user_id,
			content=content
		)

		# Only increment unread if the recipient doesn't currently have this conversation open.
		# ACTIVE_CONVERSATION[recipient_id] == sender_id means they are looking at our DM right now.
		# F('unread_count') + 1 is a database-level increment — avoids race conditions
		# if two messages arrive at the same time.
		sender_id = self.user_id
		# ACTIVE_CONVERSATION.get(recipient_id) asks: "which conversation does the recipient currently have open?"
		recipient_is_viewing = ACTIVE_CONVERSATION.get(recipient_id) == sender_id
		logger.info(f"[save_dm] sender={sender_id} → recipient={recipient_id} | ACTIVE_CONVERSATION={dict(ACTIVE_CONVERSATION)} | recipient_is_viewing={recipient_is_viewing}")
		if not recipient_is_viewing:
			ConversationParticipant.objects.filter(
				conversation_id=conversation.id,
				user_id=recipient_id
			).update(unread_count=F('unread_count') + 1, is_closed=False)

	@database_sync_to_async
	def get_dm_history(self, user_id, other_id):
		from chat.models import ConversationParticipant, Message, GameInvite

		# Find the conversation shared by these two users.
		my_conv_ids = ConversationParticipant.objects.filter(
			user_id=user_id
		).values_list('conversation_id', flat=True)

		shared_conv_id = ConversationParticipant.objects.filter(
			conversation_id__in=my_conv_ids,
			user_id=other_id
		).values_list('conversation_id', flat=True).first()

		if not shared_conv_id:
			return [], False

		# Fetch the 50 most recent messages, then reverse so they're oldest-first.
		messages = Message.objects.filter(
			conversation_id=shared_conv_id
		).select_related('sender').order_by('-created_at')[:50]

		result = [
			{
				"sender_id": msg.sender_id,
				"sender_name": msg.sender.username if msg.sender else "deleted user",
				"message": msg.content,
				"created_at": msg.created_at.isoformat()
			}
			for msg in reversed(list(messages))
		]

		inv = GameInvite.objects.filter(
			conversation_id=shared_conv_id
		).select_related('sender', 'recipient').first()
		if inv:
			result.append({
				"sender_id": inv.sender_id,
				"sender_name": inv.sender.username if inv.sender else "deleted user",
				"recipient_name": inv.recipient.username if inv.recipient else "them",
				"message": "",
				"invite": {
					"gameType": inv.game_type,
					"gameId": inv.game_id,
				},
				"created_at": inv.created_at.isoformat()
			})

		# "Seen" = the other participant has read at or after the last message's timestamp.
		seen = False
		last_msg_ts = None
		if result:
			for item in reversed(result):
				if item.get("sender_id") == user_id:
					last_msg_ts = item.get("created_at")
					break
		if last_msg_ts:
			other_part = ConversationParticipant.objects.filter(
				conversation_id=shared_conv_id,
				user_id=other_id
			).values_list('last_read_at', flat=True).first()
			from django.utils.dateparse import parse_datetime
			ts = parse_datetime(last_msg_ts)
			if other_part and ts and other_part >= ts:
				seen = True

		return result, seen

	def get_or_create_conversation(self, other_id):
		from chat.models import Conversation, ConversationParticipant
		# Find all conversation IDs the current user is part of
		my_conv_ids = ConversationParticipant.objects.filter(
			user_id=self.user_id
		).values_list('conversation_id', flat=True)
		# Find a conversation that both the current user and the other user are part of
		existing = ConversationParticipant.objects.filter(
			conversation_id__in=my_conv_ids,  # SQL: WHERE conversation_id IN (...)
			user_id=other_id
		# select_related fetches the Conversation object in the same query (JOIN) so existing.conversation is available without an extra DB hit
		).select_related('conversation').first()
		if existing:
			return existing.conversation
		conversation = Conversation.objects.create()
		ConversationParticipant.objects.create(conversation_id=conversation.id, user_id=self.user_id)
		ConversationParticipant.objects.create(conversation_id=conversation.id, user_id=other_id)
		return conversation

	@database_sync_to_async
	def save_invite(self, recipient_id, game_type, game_id):
		from chat.models import GameInvite
		from django.db.models import F

		conversation = self.get_or_create_conversation(recipient_id)
		# get_or_create prevents IntegrityError when two players mutually invite each
		# other before either accepts — both use the same gameId (same chess session).
		_, created = GameInvite.objects.get_or_create(
			game_id=game_id,
			defaults={
				'conversation': conversation,
				'sender': self.user,
				'recipient_id': recipient_id,
				'game_type': game_type,
			}
		)
		if not created:
			return
		sender_id = self.user_id
		recipient_is_viewing = ACTIVE_CONVERSATION.get(str(recipient_id)) == sender_id
		if not recipient_is_viewing:
			from chat.models import ConversationParticipant
			ConversationParticipant.objects.filter(
				conversation=conversation,
				user_id=recipient_id
			).update(unread_count=F('unread_count') + 1, is_closed=False)

	@database_sync_to_async
	def get_invite_id_with(self, other_id):
		# .first() returns the GameInvite object or None if no invite exists between these two users
		from chat.models import GameInvite
		from django.db.models import Q
		invite = GameInvite.objects.filter(
			Q(sender_id=self.user_id, recipient_id=other_id) |
			Q(sender_id=other_id, recipient_id=self.user_id)
		).first()
		return invite.game_id if invite else None

	@database_sync_to_async
	def delete_invite(self, game_id):
		from chat.models import GameInvite
		sender_id = GameInvite.objects.filter(game_id=game_id).values_list('sender_id', flat=True).first()
		GameInvite.objects.filter(game_id=game_id).delete()
		return str(sender_id) if sender_id else None

	@database_sync_to_async
	def cleanup_stale_invites(self):
		from chat.models import GameInvite
		from django.db.models import Q
		GameInvite.objects.filter(
			Q(sender_id=self.user_id) | Q(recipient_id=self.user_id)
		).delete()

	@database_sync_to_async
	def get_open_dms(self, user_id):
		from chat.models import ConversationParticipant

		# Get all conversations this user is part of.
		my_participations = ConversationParticipant.objects.filter(
			user_id=user_id
		).select_related('conversation')

		result = {}
		for my_part in my_participations:
			# Skip conversations the user explicitly closed, unless there are unread messages —
			# a new message should reopen the tab even if the user closed it.
			if my_part.is_closed and my_part.unread_count == 0:
				continue

			# Find the other participant to get their username and user_id.
			other_part = ConversationParticipant.objects.filter(
				conversation=my_part.conversation
			).exclude(user_id=user_id).select_related('user').first()

			if other_part:
				# "Seen" = the other participant has read at or after our last sent message.
				# We need the last message sent by user_id in this conversation.
				from chat.models import Message
				last_sent = Message.objects.filter(
					conversation=my_part.conversation,
					sender_id=user_id
				).order_by('-created_at').values_list('created_at', flat=True).first()
				seen = False
				if last_sent and other_part.last_read_at and other_part.last_read_at >= last_sent:
					seen = True
				result[str(other_part.user_id)] = {
					"user_name": other_part.user.username,  # the other participant's username, used to label the DM tab
					"unread": my_part.unread_count,
					"seen": seen,
				}

		return result

	@database_sync_to_async
	def mark_read(self, user_id, other_id):
		from chat.models import ConversationParticipant

		# Find the shared conversation and reset the unread counter.
		my_conv_ids = ConversationParticipant.objects.filter(
			user_id=user_id
		).values_list('conversation_id', flat=True)

		shared_conv_id = ConversationParticipant.objects.filter(
			conversation_id__in=my_conv_ids,
			user_id=other_id
		).values_list('conversation_id', flat=True).first()

		if shared_conv_id:
			from django.utils import timezone
			ConversationParticipant.objects.filter(
				conversation_id=shared_conv_id,
				user_id=user_id
			).update(unread_count=0, last_read_at=timezone.now(), is_closed=False)

	@database_sync_to_async
	def hide_dm(self, user_id, other_id):
		from chat.models import ConversationParticipant

		# Find the shared conversation and mark it as closed for this user.
		my_conv_ids = ConversationParticipant.objects.filter(
			user_id=user_id
		).values_list('conversation_id', flat=True)

		shared_conv_id = ConversationParticipant.objects.filter(
			conversation_id__in=my_conv_ids,
			user_id=other_id
		).values_list('conversation_id', flat=True).first()

		if shared_conv_id:
			ConversationParticipant.objects.filter(
				conversation_id=shared_conv_id,
				user_id=user_id
			).update(is_closed=True)

	@database_sync_to_async
	def get_block_info_for(self, user_id):
		from block.models import Block

		# Returns two sets: users this user has blocked, and users who have blocked this user.
		blocked_by_me = set(
			str(uid) for uid in Block.objects.filter(
				blocker_id=user_id
			).values_list('blocked_user_id', flat=True)
		)
		blocked_me = set(
			str(uid) for uid in Block.objects.filter(
				blocked_user_id=user_id
			).values_list('blocker_id', flat=True)
		)
		return blocked_by_me, blocked_me
