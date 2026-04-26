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
USER_CONNECTION_COUNT = {}  # user_id -> number of open tabs; reaches 0 when last tab closes
ACTIVE_CONVERSATION = {}   # user_id -> other_user_id they currently have open
IN_GAME_USERS = set()      # user_ids currently in an active game (any game type)
PENDING_GAME_RESULTS = {}  # user_id -> game result message to deliver on next reconnect
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
		# DMs and invites are delivered via the personal user_{id} group joined below.
		self.group_name = "global_chat"

		# get_user_from_token returns Django's proper User model object,
		# which has .id and .username as standard Django fields.
		self.user = user
		self.user_id = str(user.id)
		self.username = user.username

		# Join the global group via the channel layer.
		await self.channel_layer.group_add(self.group_name, self.channel_name)
		# Join personal group so other consumers (e.g. chess) can send signals to this user.
		await self.channel_layer.group_add(f"user_{self.user_id}", self.channel_name)
		await self.accept()

		# Count open connections so we know when the user goes fully offline.
		USER_CONNECTION_COUNT[self.user_id] = USER_CONNECTION_COUNT.get(self.user_id, 0) + 1

		# Register user as online.
		ONLINE_USERS[self.user_id] = self.username

		# Tell the client their own user_id and username so the frontend
		# knows who it is (used in chat.js to determine message ownership).
		await self.send(text_data=json.dumps({
			"type": "self_id",
			"user_id": self.user_id,
			"name": self.username
		}))

		# Deliver any game result the user missed while their chat WS was down.
		pending = PENDING_GAME_RESULTS.pop(self.user_id, None)
		if pending:
			await self.send(text_data=json.dumps(pending))

		# Broadcast updated online users list to everyone.
		await self.broadcast_online_users()

	async def disconnect(self, close_code):
		# Only leave the global group if we successfully joined it in connect().
		# If connect() failed early (e.g. invalid token), group_name was never set.
		if hasattr(self, "group_name"):
			await self.channel_layer.group_discard(self.group_name, self.channel_name)
			await self.channel_layer.group_discard(f"user_{self.user_id}", self.channel_name)

		# Only clean up user data if we successfully authenticated in connect().
		# getattr with default None avoids AttributeError if user_id was never set.
		user_id = getattr(self, "user_id", None)
		if user_id:
			count = USER_CONNECTION_COUNT.get(user_id, 1) - 1
			if count <= 0:
				# Last tab closed — user is fully offline.
				USER_CONNECTION_COUNT.pop(user_id, None)
				ONLINE_USERS.pop(user_id, None)
				ACTIVE_CONVERSATION.pop(user_id, None)
			else:
				USER_CONNECTION_COUNT[user_id] = count

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
				# group_send reaches every connection in the group automatically.
				payload["private"] = True
				payload["target"] = target
				await self.channel_layer.group_send(f"user_{target}", payload)
				await self.channel_layer.group_send(f"user_{self.user_id}", payload)
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
			messages, seen = await self.get_dm_history(self.user_id, other_id)
			await self.send(text_data=json.dumps({
				"type": "dm_history",
				"target": other_id,
				"messages": messages,
				"seen": seen,
			}))

		elif msg_type == "get_conversations":
			conversations = await self.get_conversations(self.user_id)
			logger.info(f"[get_conversations] user={self.username}({self.user_id}) → {conversations}")
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
			else:
				# null target means the user switched away (e.g. to global) — clear so
				# save_dm doesn't keep skipping the unread increment for their old DM.
				ACTIVE_CONVERSATION.pop(self.user_id, None)

		elif msg_type == "mark_read":
			other_id = data.get("target")
			if not other_id:
				return
			logger.info(f"[mark_read] user={self.username}({self.user_id}) read conversation with {other_id}")
			# Reset the unread counter for this conversation in the database.
			await self.mark_read(self.user_id, other_id)
			# Notify the other user that their messages were read.
			await self.channel_layer.group_send(
				f"user_{other_id}",
				{"type": "messages.read", "by": self.user_id}
			)

		elif msg_type == "close_conversation":
			other_id = data.get("target")
			if not other_id:
				return
			# Mark this conversation as closed in the database.
			await self.close_conversation(self.user_id, other_id)

		elif msg_type == "game_invite":
			target = data.get("target")
			game_type = data.get("game_type")
			game_id = data.get("game_id")
			logger.debug(f"[invite] game_invite from {self.user_id} → target={target} game_id={game_id}")
			if not target or not game_type or not game_id:
				logger.warning(f"[invite] missing fields — target={target} game_type={game_type} game_id={game_id}")
				return
			if target in IN_GAME_USERS or self.user_id in IN_GAME_USERS:
				await self.send(text_data=json.dumps({
					"type": "game_invite_rejected",
					"reason": "in_game",
				}))
				return
			payload = {
				"type": "game.invite",
				"sender": self.user_id,
				"name": self.username,
				"game_type": game_type,
				"game_id": game_id,
			}
			# If the target has no open tabs the group_send is a no-op; the invite is still saved to DB.
			await self.channel_layer.group_send(f"user_{target}", payload)
			await self.save_invite(target, game_type, game_id)

		elif msg_type == "game_invite_expired":
			target = data.get("target")
			game_id = data.get("game_id")
			if not target or not game_id:
				return
			payload = {
				"type": "game.invite.expired",
				"game_id": game_id,
			}
			await self.channel_layer.group_send(f"user_{target}", payload)

		elif msg_type == "delete_invite":
			game_id = data.get("game_id")
			if game_id:
				sender_id = await self.delete_invite(game_id)
				if sender_id:
					await self.channel_layer.group_send(f"user_{sender_id}", {
						"type": "game.invite.accepted",
						"game_id": game_id,
					})

		elif msg_type == "user_blocked":
			target = data.get("target")
			if target:
				invite_ids = await self.get_invite_ids_with(target)
				for gid in invite_ids:
					await self.channel_layer.group_send(
						f'user_{self.user_id}',
						{'type': 'game.invite.blocked', 'game_id': gid}
					)
					await self.channel_layer.group_send(
						f'user_{target}',
						{'type': 'game.invite.expired', 'game_id': gid}
					)
			await self.broadcast_online_users()

		elif msg_type in ["typing", "stop_typing"]:
			target = data.get("target")
			group = f"user_{target}" if target else self.group_name
			await self.channel_layer.group_send(
				group,
				{
					"type": "typing.notification",
					"action": msg_type,
					"user": self.user_id,
					"name": self.username,
					"target": target,
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

	async def messages_read(self, event):
		await self.send(text_data=json.dumps({
			"type": "messages_read",
			"by": event["by"],
		}))

	async def game_invite(self, event):
		await self.send(text_data=json.dumps({
			"type": "game_invite",
			"sender": event["sender"],
			"name": event["name"],
			"game_type": event["game_type"],
			"game_id": event["game_id"],
		}))

	async def game_result(self, event):
		winner = event.get("winner")
		loser = event.get("loser")
		draw_players = event.get("draw_players")
		game_type = event.get("game_type", "game")
		if winner and loser:
			msg = f"{winner} beat {loser} in a game of {game_type}!"
		elif winner:
			msg = f"{winner} won a game of {game_type}!"
		elif draw_players and all(draw_players):
			msg = f"{draw_players[0]} and {draw_players[1]} drew in a game of {game_type}!"
		else:
			msg = f"A game of {game_type} ended in a draw."
		await self.send(text_data=json.dumps({
			"type": "game_result",
			"message": msg,
		}))

	async def trigger_online_users_broadcast(self, event):
		logger.debug(f"[broadcast] IN_GAME_USERS at broadcast time: {IN_GAME_USERS}")
		await self.broadcast_online_users()

	async def game_invite_accepted(self, event):
		await self.send(text_data=json.dumps({
			"type": "game_invite_accepted",
			"game_id": event["game_id"],
		}))

	async def game_invite_blocked(self, event):
		game_id = event["game_id"]
		await self.delete_invite(game_id)
		await self.send(text_data=json.dumps({
			"type": "game_invite_blocked",
			"game_id": game_id,
		}))

	async def game_invite_expired(self, event):
		game_id = event["game_id"]
		await self.delete_invite(game_id)
		await self.send(text_data=json.dumps({
			"type": "game_invite_expired",
			"game_id": game_id,
		}))

	async def typing_notification(self, event):
		# Deliver a typing indicator to this consumer's client.
		await self.send(text_data=json.dumps({
			"type": event["action"],  # "typing" or "stop_typing"
			"user": event["user"],
			"name": event.get("name"),
			"target": event.get("target"),
		}))

	async def online_users(self, event):
		# Deliver the updated online users list to this consumer's client.
		await self.send(text_data=json.dumps({
			"type": "online_users",
			"users": event["users"],
			"blocked_me_ids": event.get("blocked_me_ids", [])
		}))

	async def broadcast_online_users(self):
		# Send each online user a personalized online users list.
		# Each user sees a different list: users who blocked them are hidden,
		# and users they blocked appear with blocked_by_me: True for the unblock button.
		# group_send to user_{id} reaches all their open tabs at once.
		for user_id in list(ONLINE_USERS.keys()):
			blocked_by_me, blocked_me = await self.get_block_info_for(user_id)
			users = {}
			for uid, name in list(ONLINE_USERS.items()):
				if uid in blocked_me:
					continue
				users[uid] = {
					"name": name,
					"blocked_by_me": uid in blocked_by_me,
					"in_game": uid in IN_GAME_USERS,
				}
			await self.channel_layer.group_send(f"user_{user_id}", {
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
		from chat.models import ConversationParticipant, Message
		from django.db.models import F

		conversation = self._get_or_create_conversation(recipient_id)
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
		logger.info(f"[save_dm] sender={self.user_id} → recipient={recipient_id} | ACTIVE_CONVERSATION={dict(ACTIVE_CONVERSATION)} | recipient_is_viewing={recipient_is_viewing}")
		if not recipient_is_viewing:
			ConversationParticipant.objects.filter(
				conversation=conversation,
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

	def _get_or_create_conversation(self, recipient_id):
		from chat.models import Conversation, ConversationParticipant
		sender_conv_ids = ConversationParticipant.objects.filter(
			user_id=self.user_id
		).values_list('conversation_id', flat=True)
		existing = ConversationParticipant.objects.filter(
			conversation_id__in=sender_conv_ids,
			user_id=recipient_id
		).select_related('conversation').first()
		if existing:
			return existing.conversation
		conversation = Conversation.objects.create()
		ConversationParticipant.objects.create(conversation=conversation, user=self.user)
		ConversationParticipant.objects.create(conversation=conversation, user_id=recipient_id)
		return conversation

	@database_sync_to_async
	def save_invite(self, recipient_id, game_type, game_id):
		from chat.models import GameInvite
		from django.db.models import F

		conversation = self._get_or_create_conversation(recipient_id)
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
		recipient_is_viewing = ACTIVE_CONVERSATION.get(str(recipient_id)) == self.user_id
		if not recipient_is_viewing:
			from chat.models import ConversationParticipant
			ConversationParticipant.objects.filter(
				conversation=conversation,
				user_id=recipient_id
			).update(unread_count=F('unread_count') + 1, is_closed=False)

	@database_sync_to_async
	def get_invite_ids_with(self, other_id):
		from chat.models import GameInvite, ConversationParticipant
		my_conv_ids = ConversationParticipant.objects.filter(
			user_id=self.user_id
		).values_list('conversation_id', flat=True)
		shared_conv_id = ConversationParticipant.objects.filter(
			conversation_id__in=my_conv_ids,
			user_id=other_id
		).values_list('conversation_id', flat=True).first()
		if not shared_conv_id:
			return []
		return list(GameInvite.objects.filter(
			conversation_id=shared_conv_id
		).values_list('game_id', flat=True))

	@database_sync_to_async
	def delete_invite(self, game_id):
		from chat.models import GameInvite
		sender_id = GameInvite.objects.filter(game_id=game_id).values_list('sender_id', flat=True).first()
		GameInvite.objects.filter(game_id=game_id).delete()
		return str(sender_id) if sender_id else None

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
					"name": other_part.user.username,
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
			).update(unread_count=0, last_read_at=timezone.now())

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
