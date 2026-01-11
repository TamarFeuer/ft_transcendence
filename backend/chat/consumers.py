import json
from channels.generic.websocket import AsyncWebsocketConsumer
import logging
import jwt
from django.conf import settings
from jwt import InvalidTokenError
from django.utils import timezone

logger = logging.getLogger(__name__)

# Currently in-memory storage
# simple in-memory for now; later replace with DB queries
ONLINE_USERS = {}  # maps user_id -> {id, username, avatar, created_at}
CONNECTED_USERS = {}  # user_id -> set of channel_names

def decode_jwt_token(token):
	if not token:
		return None
	try:
		payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
		# Return a simple object with is_authenticated
		class User:
			def __init__(self, payload):
				self.id = payload.get("user_id")
				self.username = payload.get("username")
				self.is_authenticated = True if self.id else False
		return User(payload)
	except InvalidTokenError:
		return None


class ChatConsumer(AsyncWebsocketConsumer):
	async def connect(self):

		self.group_name = "global_chat"
		token = self.scope["cookies"].get("access_token")
		user = decode_jwt_token(token)  # existing JWT decoder

		if not user or not user.is_authenticated:
			await self.close()
			return

		self.user_id = str(user.id)
		self.username = user.username


		# Add client to global group
		await self.channel_layer.group_add(self.group_name, self.channel_name)
		await self.accept()

		# Track channel for private messaging
		CONNECTED_USERS.setdefault(self.user_id, set()).add(self.channel_name)

		# Register online user (DB-backed shape)
		ONLINE_USERS[self.user_id] = {
				"id": self.user_id,
				"name": self.username,
				"avatar": "👤",
				"createdAt": timezone.now().isoformat() # timezone aware
		}
		# Send self info
		await self.send(text_data=json.dumps({
			"type": "self_id",
			"user_id": self.user_id,
			"name": self.username
		}))

		# Broadcast updated online users
		await self.broadcast_online_users()

	async def disconnect(self, close_code):
		if hasattr(self, "group_name"):
			await self.channel_layer.group_discard(self.group_name, self.channel_name)

		user_id = getattr(self, "user_id", None)
		if user_id and user_id in CONNECTED_USERS:
			CONNECTED_USERS[self.user_id].discard(self.channel_name)
			if not CONNECTED_USERS[self.user_id]:
				del CONNECTED_USERS[self.user_id]
				ONLINE_USERS.pop(self.user_id, None)

		await self.broadcast_online_users()

	async def receive(self, text_data):
		data = json.loads(text_data)
		msg_type = data.get("type")
	
		if msg_type in ["typing", "stop_typing"]:
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
			target = data.get("target")
			
			payload = {
				"type": "chat.message",
				"message": message,
				"sender": self.user_id,
				"name": self.username,
			}

			if target:
				if isinstance(target, str):
					target = [target]
				for user_id in target:
					for channel_name in CONNECTED_USERS.get(user_id, []):
						await self.channel_layer.send(channel_name, payload)
			else:
				await self.channel_layer.group_send(self.group_name, payload)


	# --- Event handlers ---
	async def chat_message(self, event):
		await self.send(text_data=json.dumps({
			"type": "chat",
			"message": event["message"],
			"sender": event["sender"],
			"name": event.get("name")
		}))

	async def typing_notification(self, event):
		await self.send(text_data=json.dumps({
			"type": event["action"],
			"user": event["user"],
			"name": event.get("name")  # include the name for frontend
		}))

	async def online_users(self, event):
		# event["users"] is already a list of user objects
		await self.send(text_data=json.dumps({
			"type": "online_users",
			"users": event["users"]
		}))

	async def broadcast_online_users(self):
		"""
		Sends the full list of online user objects to all clients.
		Later, this can pull user info from Redis or DB instead of ONLINE_USERS.
		"""
		await self.channel_layer.group_send(
			self.group_name,
			{
				"type": "online.users",
				"users": list(ONLINE_USERS.values())  # send full objects
			}
		)