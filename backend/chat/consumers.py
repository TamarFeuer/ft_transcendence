import json
from channels.generic.websocket import AsyncWebsocketConsumer

class ChatConsumer(AsyncWebsocketConsumer):
	async def connect(self):
		self.room_group_name = "global_chat"
		await self.channel_layer.group_add(self.room_group_name, self.channel_name)
		await self.accept()
		await self.send(json.dumps({"type": "chat", "message": "Welcome to chat!"}))

	async def broadcast_chat(self, message):
		await self.channel_layer.group_send(
			self.room_group_name,
			{
				"type": "chat_message",
				"message": message,
			}
		)
		
	async def receive(self, text_data):
		data = json.loads(text_data)
		message = data.get("message", "")
		await self.broadcast_chat(message)

	async def disconnect(self, close_code):
		await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

	async def chat_message(self, event):
		await self.send(text_data=json.dumps({"type": "chat", "message": event["message"]}))