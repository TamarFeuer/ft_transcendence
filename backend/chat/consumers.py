import json
from channels.generic.websocket import AsyncWebsocketConsumer

class ChatConsumer(AsyncWebsocketConsumer):
	async def connect(self):
		self.group_name = "global_chat"
		await self.channel_layer.group_add(self.group_name, self.channel_name)
		await self.accept()

		# Tell the client its own channel_name
		await self.send(text_data=json.dumps({
			"type": "self_id",
			"channel_name": self.channel_name
		}))

	async def disconnect(self, close_code):
		await self.channel_layer.group_discard(self.group_name, self.channel_name)

	async def receive(self, text_data):
		data = json.loads(text_data)
		message = data.get("message", "")
		target = data.get("target")  # optional: channel_name or list of channel_names

		if target:
			# Send to specific client(s)
			if isinstance(target, str):
				target = [target]

			for channel in target:
				await self.channel_layer.send(channel, {
					"type": "chat.message",
					"message": message,
					"sender": self.channel_name
				})
		else:
			# Broadcast to everyone (including self)
			await self.channel_layer.group_send(self.group_name, {
				"type": "chat.message",
				"message": message,
				"sender": self.channel_name
			})

	async def chat_message(self, event):
		# This runs for messages sent to this client
		await self.send(text_data=json.dumps({
			"type": "chat",
			"message": event["message"],
			"sender": event["sender"]
		}))