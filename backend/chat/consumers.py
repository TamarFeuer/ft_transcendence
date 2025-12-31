import json
from channels.generic.websocket import AsyncWebsocketConsumer
import logging

logger = logging.getLogger(__name__)

ONLINE_USERS = set()

class ChatConsumer(AsyncWebsocketConsumer):
	
	online_users = set()
	async def connect(self):

		# Called when a client opens a WebSocket connection.
		# Parse user ID from query string passed through channels socket 
		# and joins the global chat group

		# 1. Parse user ID from query string (e.g., ws://.../ws/chat/?userId=u-alice)
		query = self.scope['query_string'].decode()  # e.g., "userId=u-alice"
		self.user_id = "u-guest"
		
		# 2. Look for 'userId' in the query string
		for part in query.split('&'):
			if part.startswith("userId="):
				self.user_id = part.split('=')[1]
				break
		
		# 3. Fallback to 'u-guest' if no user ID provided
		if not self.user_id:
			self.user_id = "u-guest"
		
		# 4. Set group name for broadcasting
		self.group_name = "global_chat"

		# 5. Add this client to the global chat group
		await self.channel_layer.group_add(self.group_name, self.channel_name)
		
		# 6. Accept the WebSocket connection
		await self.accept()

		# 6.5 Add user to online list
		ONLINE_USERS.add(self.user_id)

		# 7. Send the client its own user_id (so client knows who they are)
		await self.send(text_data=json.dumps({
			"type": "self_id",
			"user_id": self.user_id
		}))

		# Notify all clients of updated online users
		# will be looking for the function online_users
		await self.channel_layer.group_send(
			self.group_name,
			{
				"type": "online.users",
				"users": list(ONLINE_USERS)
			}
		)

	async def disconnect(self, close_code):
		logger.info("WebSocket disconnected, code: %s", close_code)

		await self.channel_layer.group_discard(self.group_name, self.channel_name)
		ONLINE_USERS.discard(self.user_id)
		
		# Notify remaining clients
		await self.channel_layer.group_send(
			self.group_name,
			{
				"type": "online.users",
				"users": list(ONLINE_USERS)
			}
		)

	async def receive(self, text_data):
		data = json.loads(text_data)
		msg_type = data.get("type")
		
		if msg_type in ["typing", "stop_typing"]:
			# Handle typing notifications
			await self.channel_layer.group_send(
				self.group_name,
				{
					"type": "typing.notification",
					"action": msg_type,
					"user": self.user_id,
				}
			)

		elif msg_type == "chat":
			# Handle regular chat message (with optional target)
			message = data.get("message", "")
			target = data.get("target")  # optional: user_id or list of user_ids

			if target:
				# 1. If target is a single string, convert to a list
				if isinstance(target, str):
					target = [target] #making the string a list
				
				# 2. Send message to each specific user
				# will need a chat_message function
				for channel in target:
					await self.channel_layer.send(channel, {
						"type": "chat.message",
						"message": message,
						"sender": self.user_id
					})
			else:
				# 3. Broadcast to the whole group
				await self.channel_layer.group_send(self.group_name, {
					"type": "chat.message",
					"message": message,
					"sender": self.user_id
				})

	async def chat_message(self, event):
		# This runs for messages sent to this client
		await self.send(text_data=json.dumps({
			"type": "chat",
			"message": event["message"],
			"sender": event["sender"]
		}))

	async def online_users(self, event):
		# Send updated online users to the client
		await self.send(text_data=json.dumps({
			"type": "online_users",
			"users": event["users"]
		}))

	async def typing_notification(self, event):
		await self.send(text_data=json.dumps({
			"type": event["action"],  # "typing" or "stop_typing"
			"user": event["user"]
		}))