import json
from channels.generic.websocket import AsyncWebsocketConsumer
import logging
import jwt
from django.conf import settings
from jwt import InvalidTokenError
from django.utils import timezone
from game.token_auth import get_user_from_token

logger = logging.getLogger(__name__)

# In-memory storage - these are module-level dictionaries shared across all
# consumer instances. They survive as long as Daphne is running but are wiped
# on restart. When PostgreSQL is added, messages should move to the database,
# but ONLINE_USERS can stay in memory since online status is naturally ephemeral.
ONLINE_USERS = {}  # user_id -> {id, username, avatar, created_at}
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
		
		# Every user joins the global group so they receive global messages
		# DMs are handled separately via CONNECTED_USERS, not through groups
		self.group_name = "global_chat"

		# Auth: read JWT from HTTP-only cookie set at login.
		# If the token is missing or invalid, reject the connection immediately
		token = self.scope["cookies"].get("access_token")
		user = await get_user_from_token(token) # from game/token_auth, await because it hits the database

		if not user or not user.is_authenticated:
			await self.close()
			return
	
		# get_user_from_token returns Django's proper User model object,
		# which has .id and .username as standard Django fields
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
		ONLINE_USERS[self.user_id] = {
			"id": self.user_id,
			"name": self.username,
			"avatar": "👤"
		}

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
		# Leave the global group
		if hasattr(self, "group_name"):
			await self.channel_layer.group_discard(self.group_name, self.channel_name)

		user_id = getattr(self, "user_id", None)
		if user_id and user_id in CONNECTED_USERS:
			# Remove this specific channel (tab) from the user's set
			CONNECTED_USERS[self.user_id].discard(self.channel_name)
			
			# Only remove from ONLINE_USERS if this was their last tab -
			# if they still have other tabs open, they're still online
			if not CONNECTED_USERS[self.user_id]:
				del CONNECTED_USERS[self.user_id]
				ONLINE_USERS.pop(self.user_id, None)
		
		# Broadcast updated online users list to reflect the disconnection
		await self.broadcast_online_users()

	async def receive(self, text_data):
		# Called whenever the client sends a message through the WebSocket
		data = json.loads(text_data)
		msg_type = data.get("type")
	
		if msg_type in ["typing", "stop_typing"]:
			# Broadcast typing indicator to everyone in the global group.
			# "typing.notification" -> Django Channels calls typing_notification()
			# on each consumer in the group (dot replaced by underscore)
			await self.channel_layer.group_send(
				self.group_name,
				{
					"type": "typing.notification",
					"action": msg_type,
					"user": self.user_id,
					"name": self.username,
				}
			)

		elif msg_type == "chat":
			message = data.get("message", "")

			# Reject messages over 300 characters — frontend should catch this too
			if len(message) > 300:
				return

			target = data.get("target")  # Target user ID for private message or None for global

			payload = {
				"type": "chat.message", # calls chat_message() on receiving consumers
				"message": message,
				"sender": self.user_id,
				"name": self.username,
			}

			if target:
				# Private message: send only to target user
				payload["private"] = True
				payload["target"] = target
				
				# DMs use channel_layer.send() (single channel) instead of
				# group_send() (broadcast) - we send directly to each of the
				# target user's channel names (one per open tab)
				if target in CONNECTED_USERS:
					for channel_name in CONNECTED_USERS[target]:
						await self.channel_layer.send(channel_name, payload)
				
				# Also send back to the sender so they see their own DM —
				# necessary because we're not using group_send here
				if self.user_id in CONNECTED_USERS:
					for channel_name in CONNECTED_USERS[self.user_id]:
						await self.channel_layer.send(channel_name, payload)
				
			else:
				# Global message: broadcast to everyone in the global group
				payload["private"] = False
				await self.channel_layer.group_send(self.group_name, payload)

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
	 	# Send the current online users list to everyone in the global group.
		# "online.users" -> calls online_users() on each consumer in the group
		await self.channel_layer.group_send(
			self.group_name,
			{
				"type": "online.users",
				"users": list(ONLINE_USERS.values())
			}
		)