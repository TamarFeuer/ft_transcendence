import json
from channels.generic.websocket import AsyncWebsocketConsumer
import logging
from users.token_auth import get_user_from_token
from channels.db import database_sync_to_async
import redis.asyncio as aioredis

# create a Redis client object that knows how to connect to your Redis server
redis_client = aioredis.from_url("redis://redis:6379", decode_responses=True)

logger = logging.getLogger(__name__)

# In-memory storage - these are module-level dictionaries shared across all
# consumer instances. They survive as long as Daphne is running but are wiped
# on restart. When PostgreSQL is added, messages should move to the database,
# but ONLINE_USERS can stay in memory since online status is naturally ephemeral.
ONLINE_USERS = {}  # user_id -> username
CONNECTED_USERS = {}  # user_id -> set of channel_names

# self is an instance of ChatConsumer, and ChatConsumer inherits from AsyncWebsocketConsumer​, 
# so it has all the attributes that AsyncWebsocketConsumer provides by default:
# self.channel_name - unique name Django Channels assigns to this specific connection,
# self.channel_layer - the Redis channel layer, 
# self.scope - info about the connection (cookies, headers, url route etc.)
# And then we add our own attributes on top in connect():
# self.user_id - the authenticated user's ID,
# self.username - the authenticated user's username,
# self.group_name - the global chat group name ("global_chat")

#self.user_id - the ID of the logged in user, like "42". This is the same across all their tabs
#self.channel_name - a unique ID that Django Channels assigns to this specific WebSocket connection, like "specific.abc123". Each tab gets a different one

class ChatConsumer(AsyncWebsocketConsumer):
	async def connect(self):
		
		# Auth: read JWT from HTTP-only cookie set at login.
		# If the token is missing or invalid, reject the connection immediately
		token = self.scope["cookies"].get("access_token")
		user = await get_user_from_token(token) # from game/token_auth, await because it hits the database

		if not user or not user.is_authenticated:
			await self.close()
			return

		# Every user joins the global group so they receive global messages
		# DMs are handled separately via CONNECTED_USERS, not through groups
		self.group_name = "global_chat"
	
		# get_user_from_token returns Django's proper User model object,
		# which has .id and .username as standard Django fields
		self.user = user
		self.user_id = str(user.id)
		self.username = user.username

		# Join the global group via the channel layer (Redis).
		await self.channel_layer.group_add(self.group_name, self.channel_name)
		await self.accept()

		# Track channel for private messaging
		# We use a set because the same user can have multiple tabs open,
		# each with its own channel_name. DMs need to reach all of them.
		CONNECTED_USERS.setdefault(self.user_id, set()).add(self.channel_name)

		# Register user as online
		ONLINE_USERS[self.user_id] = self.username

		# Tell the client their own user_id and username so the frontend
		# knows who it is (used in chat.js to determine message ownership)
		await self.send(text_data=json.dumps({
			"type": "self_id",
			"user_id": self.user_id,
			"name": self.username
		}))

		# Broadcast updated online users list to everyone
		await self.broadcast_online_users()

	async def disconnect(self, close_code):
		# Only leave the global group if we successfully joined it in connect()
		#If connect() failed early (e.g. invalid token), group_name was never set
		if hasattr(self, "group_name"):
			await self.channel_layer.group_discard(self.group_name, self.channel_name)

		# Only clean up user data if we successfully authenticated in connect()
		# getattr with default None avoids AttributeError if user_id was never set
		user_id = getattr(self, "user_id", None)
		if user_id and user_id in CONNECTED_USERS:
			# Remove this specific channel (tab) from the user's set
			CONNECTED_USERS[self.user_id].discard(self.channel_name)
			
			# Only remove from ONLINE_USERS if this was their last tab -
			# if they still have other tabs open, they're still online
			if not CONNECTED_USERS[self.user_id]:
				del CONNECTED_USERS[self.user_id]
				ONLINE_USERS.pop(self.user_id, None)
		
		# Only broadcast if group_name exists; if connect() failed early, it was never set
		if hasattr(self, "group_name"):
			# Broadcast updated online users list to reflect the disconnection
			await self.broadcast_online_users()

	async def receive(self, text_data):
		from chat.models import Message
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
				payload["private"] = True
				payload["target"] = target
				if target in CONNECTED_USERS:
					for channel_name in CONNECTED_USERS[target]:
						await self.channel_layer.send(channel_name, payload)
				if self.user_id in CONNECTED_USERS:
					for channel_name in CONNECTED_USERS[self.user_id]:
						await self.channel_layer.send(channel_name, payload)
				# Save only DMs to database
				await Message.objects.acreate(
					sender=self.user,
					recipient_id=target,
					content=message
				)
				# Increment unread counter for recipient
				await redis_client.incr(f"unread:{target}:from:{self.user_id}")
			else:
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

		elif msg_type == "mark_read":
			other_id = data.get("target")
			if not other_id:
				return
			# Delete the unread counter for this conversation
			await redis_client.delete(f"unread:{self.user_id}:from:{other_id}")

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
	# replaced by underscores - e.g. "chat.message" -> chat_message()
	
	async def chat_message(self, event):
		# Deliver a chat message (global or DM) to this consumer's client
		await self.send(text_data=json.dumps({
			"type": "chat",
			"message": event["message"],
			"sender": event["sender"],
			"name": event.get("name"),
			"private": event.get("private", False), # True for DMs, False for global
			"target": event.get("target") # user_id of DM recipient, or None for global
		}))

	async def typing_notification(self, event):
		# Deliver a typing indicator to this consumer's client
		await self.send(text_data=json.dumps({
			"type": event["action"], # "typing" or "stop_typing"
			"user": event["user"],
			"name": event.get("name")
		}))

	async def online_users(self, event):
		# Deliver the updated online users list to this consumer's client
		await self.send(text_data=json.dumps({
			"type": "online_users",
			"users": event["users"]
		}))

	async def broadcast_online_users(self):
		logger.warning(f"broadcast_online_users called by {self.username}, ONLINE_USERS: {ONLINE_USERS}")
		# Send the current online users list to everyone in the global group.
		# "online.users" -> calls online_users() on each consumer in the group
		await self.channel_layer.group_send(
			self.group_name,
			{
				"type": "online.users",
				"users": ONLINE_USERS
			}
		)

	@database_sync_to_async
	def get_dm_history(self, user_id, other_id):
		from chat.models import Message
		from django.db.models import Q
		messages = Message.objects.filter(
			Q(sender_id=user_id, recipient_id=other_id) |
			Q(sender_id=other_id, recipient_id=user_id)
		).order_by('-created_at')[:50]
		
		return [
			{
				"sender_id": msg.sender_id,
				"sender_name": msg.sender.username if msg.sender else "deleted user",
				"message": msg.content,
				"created_at": msg.created_at.isoformat()
			}
			for msg in reversed(list(messages))
		]

	async def get_conversations(self, user_id):
		# First fetch all conversations from the database
		conversations = await self._get_conversations_from_db(user_id)
		# Then enrich each conversation with the unread count from Redis.
		# Redis key: "unread:{user_id}:from:{other_id}" — incremented on each
		# incoming DM, deleted when the user opens the tab (mark_read)
		for other_id in conversations:
			count = await redis_client.get(f"unread:{user_id}:from:{other_id}")
			conversations[other_id] = {
				"name": conversations[other_id],
				"unread": int(count) if count else 0
			}
		return conversations

	@database_sync_to_async
	def _get_conversations_from_db(self, user_id):
		from chat.models import Message
		from django.db.models import Q
		# Find all users this person has exchanged DMs with,
		# either as sender or recipient
		messages = Message.objects.filter(
			Q(sender_id=user_id) | Q(recipient_id=user_id)
		).values('sender_id', 'sender__username', 'recipient_id', 'recipient__username').distinct()
		
		conversations = {}
		for msg in messages:
			if str(msg['sender_id']) != user_id:
				conversations[str(msg['sender_id'])] = msg['sender__username']
			if str(msg['recipient_id']) != user_id:
				conversations[str(msg['recipient_id'])] = msg['recipient__username']
		
		return conversations