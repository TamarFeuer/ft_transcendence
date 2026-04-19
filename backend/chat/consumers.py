import json
from channels.generic.websocket import AsyncWebsocketConsumer
import logging
from users.token_auth import get_user_from_token
from channels.db import database_sync_to_async

logger = logging.getLogger(__name__)

# In-memory storage - these are module-level dictionaries shared across all
# consumer instances. They survive as long as Daphne is running but are wiped
# on restart. Online status is naturally ephemeral so in-memory is the right
# place for it — there's no point persisting "was online before the server restarted".
ONLINE_USERS = {}          # user_id -> username
CONNECTED_USERS = {}       # user_id -> set of channel_names
ACTIVE_CONVERSATION = {}   # user_id -> other_user_id they currently have open
# unread_count and is_closed are stored in ConversationParticipant in the database.
# ACTIVE_CONVERSATION stays in-memory: it reflects the live UI state and resets
# naturally when the user reconnects.

# self is an instance of ChatConsumer, and ChatConsumer inherits from AsyncWebsocketConsumer,
# so it has all the attributes that AsyncWebsocketConsumer provides by default:
# self.channel_name - unique name Django Channels assigns to this specific connection
# self.channel_layer - the in-memory channel layer
# self.scope - info about the connection (cookies, headers, url route etc.)
# And then we add our own attributes on top in connect():
# self.user    - the full Django User object
# self.user_id - the authenticated user's ID as a string, like "42". Same across all their tabs
# self.username - the authenticated user's username
# self.group_name - the global chat group name ("global_chat")

# self.channel_name - a unique ID that Django Channels assigns to this specific WebSocket
# connection, like "specific.abc123". Each browser tab gets a different one.

class ChatConsumer(AsyncWebsocketConsumer):
	async def connect(self):

		# Auth: read JWT from HTTP-only cookie set at login.
		# If the token is missing or invalid, reject the connection immediately.
		token = self.scope["cookies"].get("access_token")
		user = await get_user_from_token(token)

		if not user or not user.is_authenticated:
			await self.close()
			return

		# Every user joins the global group so they receive global messages.
		# DMs are handled separately via CONNECTED_USERS, not through groups.
		self.group_name = "global_chat"

		# get_user_from_token returns Django's proper User model object,
		# which has .id and .username as standard Django fields.
		self.user = user
		self.user_id = str(user.id)
		self.username = user.username

		# Join the global group via the channel layer.
		await self.channel_layer.group_add(self.group_name, self.channel_name)
		await self.accept()

		# Track channel for private messaging.
		# We use a set because the same user can have multiple tabs open,
		# each with its own channel_name. DMs need to reach all of them.
		CONNECTED_USERS.setdefault(self.user_id, set()).add(self.channel_name)

		# Register user as online.
		ONLINE_USERS[self.user_id] = self.username

		# Tell the client their own user_id and username so the frontend
		# knows who it is (used in chat.js to determine message ownership).
		await self.send(text_data=json.dumps({
			"type": "self_id",
			"user_id": self.user_id,
			"name": self.username
		}))

		# Broadcast updated online users list to everyone.
		await self.broadcast_online_users()

	async def disconnect(self, close_code):
		# Only leave the global group if we successfully joined it in connect().
		# If connect() failed early (e.g. invalid token), group_name was never set.
		if hasattr(self, "group_name"):
			await self.channel_layer.group_discard(self.group_name, self.channel_name)

		# Only clean up user data if we successfully authenticated in connect().
		# getattr with default None avoids AttributeError if user_id was never set.
		user_id = getattr(self, "user_id", None)
		if user_id and user_id in CONNECTED_USERS:
			# Remove this specific channel (tab) from the user's set.
			CONNECTED_USERS[self.user_id].discard(self.channel_name)

			# Only remove from ONLINE_USERS if this was their last tab —
			# if they still have other tabs open, they're still online.
			if not CONNECTED_USERS[self.user_id]:
				del CONNECTED_USERS[self.user_id]
				ONLINE_USERS.pop(self.user_id, None)
				# Remove active conversation — user is no longer viewing anything
				ACTIVE_CONVERSATION.pop(self.user_id, None)

		# Only broadcast if group_name exists; if connect() failed early, it was never set.
		if hasattr(self, "group_name"):
			await self.broadcast_online_users()

	async def receive(self, text_data):
		try:
			data = json.loads(text_data)
		except json.JSONDecodeError:
			logger.warning(f"Received invalid JSON from {self.username}: {text_data}")
			return

		msg_type = data.get("type")

		if msg_type == "chat":
			message = data.get("message", "")
			if len(message) > 300:
				return

			target = data.get("target")
			payload = {
				"type": "chat.message",
				"message": message,
				"sender": self.user_id,
				"name": self.username,
			}

			if target:
				# Block check: silently drop the message if either user has blocked the other.
				from friends.models import is_blocked
				if await database_sync_to_async(is_blocked)(self.user_id, target):
					return

				# Private message: deliver to all of the recipient's open tabs,
				# and echo back to all of the sender's own tabs (so other tabs stay in sync).
				payload["private"] = True
				payload["target"] = target
				if target in CONNECTED_USERS:
					for channel_name in CONNECTED_USERS[target]:
						await self.channel_layer.send(channel_name, payload)
				if self.user_id in CONNECTED_USERS:
					for channel_name in CONNECTED_USERS[self.user_id]:
						await self.channel_layer.send(channel_name, payload)
				# Persist the message and update conversation state in the database.
				await self.save_dm(target, message)
			else:
				# Global message: broadcast to everyone in the global group.
				# Global messages are not saved to the database.
				payload["private"] = False
				await self.channel_layer.group_send(self.group_name, payload)

		elif msg_type == "fetch_history":
			other_id = data.get("target")
			if not other_id:
				return
			messages = await self.get_dm_history(self.user_id, other_id)
			await self.send(text_data=json.dumps({
				"type": "dm_history",
				"target": other_id,
				"messages": messages
			}))

		elif msg_type == "get_conversations":
			conversations = await self.get_conversations(self.user_id)
			await self.send(text_data=json.dumps({
				"type": "conversations",
				"conversations": conversations
			}))

		elif msg_type == "open_conversation":
			other_id = data.get("target")
			if other_id:
				# Track that this user is now actively viewing this DM tab.
				# Used in save_dm to skip the unread increment for active viewers.
				ACTIVE_CONVERSATION[self.user_id] = other_id

		elif msg_type == "mark_read":
			other_id = data.get("target")
			if not other_id:
				return
			# Reset the unread counter for this conversation in the database.
			await self.mark_read(self.user_id, other_id)

		elif msg_type == "close_conversation":
			other_id = data.get("target")
			if not other_id:
				return
			# Mark this conversation as closed in the database.
			await self.close_conversation(self.user_id, other_id)

		elif msg_type == "user_blocked":
			# Re-broadcast online users so blocked users disappear from each other's list immediately.
			await self.broadcast_online_users()

		elif msg_type in ["typing", "stop_typing"]:
			await self.channel_layer.group_send(
				self.group_name,
				{
					"type": "typing.notification",
					"action": msg_type,
					"user": self.user_id,
					"name": self.username,
				}
			)

	# ─── Event handlers ───────────────────────────────────────────────────────
	# These are called by the channel layer when a message arrives for this consumer.
	# The method name must match the "type" field in the payload, with dots
	# replaced by underscores — e.g. "chat.message" -> chat_message()

	async def chat_message(self, event):
		# Deliver a chat message (global or DM) to this consumer's client.
		await self.send(text_data=json.dumps({
			"type": "chat",
			"message": event["message"],
			"sender": event["sender"],
			"name": event.get("name"),
			"private": event.get("private", False),  # True for DMs, False for global
			"target": event.get("target")             # user_id of DM recipient, or None for global
		}))

	async def typing_notification(self, event):
		# Deliver a typing indicator to this consumer's client.
		await self.send(text_data=json.dumps({
			"type": event["action"],  # "typing" or "stop_typing"
			"user": event["user"],
			"name": event.get("name")
		}))

	async def online_users(self, event):
		# Deliver the updated online users list to this consumer's client.
		await self.send(text_data=json.dumps({
			"type": "online_users",
			"users": event["users"],
			"blocked_me_ids": event.get("blocked_me_ids", [])
		}))

	async def broadcast_online_users(self):
		# Send each connected user a personalized online users list.
		# Users who blocked this user are hidden entirely.
		# Users this user has blocked appear with blocked_by_me: True so the frontend can show an unblock button.
		for user_id, channels in CONNECTED_USERS.items():
			blocked_by_me, blocked_me = await self.get_block_info_for(user_id)
			users = {}
			for uid, name in ONLINE_USERS.items():
				if uid in blocked_me:
					# This user blocked me — hide them entirely
					continue
				users[uid] = {
					"name": name,
					"blocked_by_me": uid in blocked_by_me
				}
			for channel_name in channels:
				await self.channel_layer.send(channel_name, {
					"type": "online.users",
					"users": users,
					"blocked_me_ids": list(blocked_me)
				})

	# ─── Database helpers ─────────────────────────────────────────────────────
	# All database access must be wrapped in database_sync_to_async because
	# Django's ORM is synchronous but the consumer runs in an async context.
	# database_sync_to_async runs the wrapped function in a thread pool executor.

	@database_sync_to_async
	def save_dm(self, recipient_id, content):
		from chat.models import Conversation, ConversationParticipant, Message
		from django.db.models import F

		# Find the existing conversation between sender and recipient, if any.
		# Step 1: get all conversation IDs the sender is part of.
		# Step 2: check if the recipient is also in one of those conversations.
		sender_conv_ids = ConversationParticipant.objects.filter(
			user_id=self.user_id
		).values_list('conversation_id', flat=True)

		existing = ConversationParticipant.objects.filter(
			conversation_id__in=sender_conv_ids,
			user_id=recipient_id
		).select_related('conversation').first()

		if existing:
			conversation = existing.conversation
		else:
			# First message between these two users — create a new conversation
			# and add both as participants.
			conversation = Conversation.objects.create()
			ConversationParticipant.objects.create(conversation=conversation, user=self.user)
			ConversationParticipant.objects.create(conversation=conversation, user_id=recipient_id)

		# Save the message.
		msg = Message.objects.create(
			conversation=conversation,
			sender=self.user,
			content=content
		)

		# Only increment unread if the recipient doesn't currently have this conversation open.
		# ACTIVE_CONVERSATION[recipient_id] == self.user_id means they are looking at our DM right now.
		# F('unread_count') + 1 is a database-level increment — avoids race conditions
		# if two messages arrive at the same time.
		recipient_is_viewing = ACTIVE_CONVERSATION.get(recipient_id) == self.user_id
		if not recipient_is_viewing:
			ConversationParticipant.objects.filter(
				conversation=conversation,
				user_id=recipient_id
			).update(unread_count=F('unread_count') + 1, is_closed=False)

	@database_sync_to_async
	def get_dm_history(self, user_id, other_id):
		from chat.models import ConversationParticipant, Message

		# Find the conversation shared by these two users.
		my_conv_ids = ConversationParticipant.objects.filter(
			user_id=user_id
		).values_list('conversation_id', flat=True)

		shared_conv_id = ConversationParticipant.objects.filter(
			conversation_id__in=my_conv_ids,
			user_id=other_id
		).values_list('conversation_id', flat=True).first()

		if not shared_conv_id:
			return []

		# Fetch the 50 most recent messages, then reverse so they're oldest-first.
		# select_related('sender') fetches the sender's user data in the same query.
		messages = Message.objects.filter(
			conversation_id=shared_conv_id
		).select_related('sender').order_by('-created_at')[:50]

		return [
			{
				"sender_id": msg.sender_id,
				"sender_name": msg.sender.username if msg.sender else "deleted user",
				"message": msg.content,
				"created_at": msg.created_at.isoformat()
			}
			for msg in reversed(list(messages))
		]

	@database_sync_to_async
	def get_conversations(self, user_id):
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
				result[str(other_part.user_id)] = {
					"name": other_part.user.username,
					"unread": my_part.unread_count
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
			ConversationParticipant.objects.filter(
				conversation_id=shared_conv_id,
				user_id=user_id
			).update(unread_count=0)

	@database_sync_to_async
	def close_conversation(self, user_id, other_id):
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
		from friends.models import Block

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
