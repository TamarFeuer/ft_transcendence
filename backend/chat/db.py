import logging
from channels.db import database_sync_to_async

logger = logging.getLogger(__name__)

# All database access must be wrapped in database_sync_to_async because
# Django's ORM is synchronous but the consumer runs in an async context.
# database_sync_to_async runs the wrapped function in a thread pool executor
# so that the synchronous ORM call doesn't block the async event loop —
# otherwise it would freeze the consumer while waiting for the database,
# preventing it from handling any other messages during that time.


def _get_or_create_conversation(user_id, other_id):
	"""Sync helper — must be called from within a database_sync_to_async context."""
	from chat.models import Conversation, ConversationParticipant
	# Find all conversation IDs the current user is part of.
	my_conv_ids = ConversationParticipant.objects.filter(
		user_id=user_id
	).values_list('conversation_id', flat=True)
	# Find a conversation that both the current user and the other user are part of.
	# select_related fetches the Conversation object in the same query (JOIN)
	# so existing.conversation is available without an extra DB hit.
	existing = ConversationParticipant.objects.filter(
		conversation_id__in=my_conv_ids,  # SQL: WHERE conversation_id IN (...)
		user_id=other_id
	).select_related('conversation').first()
	if existing:
		return existing.conversation
	conversation = Conversation.objects.create()
	ConversationParticipant.objects.create(conversation_id=conversation.id, user_id=user_id)
	ConversationParticipant.objects.create(conversation_id=conversation.id, user_id=other_id)
	return conversation


# The sender's consumer saves the message — it's the one that received the
# send_message event from the browser.
@database_sync_to_async
def save_dm(user_id, recipient_id, content, recipient_is_viewing):
	from chat.models import ConversationParticipant, Message
	# F references a DB column directly so the increment happens in a single atomic
	# DB operation, avoiding race conditions if two messages arrive at the same time.
	from django.db.models import F

	conversation = _get_or_create_conversation(user_id, recipient_id)
	Message.objects.create(
		conversation=conversation,
		sender_id=user_id,
		content=content
	)

	logger.info(f"[save_dm] sender={user_id} → recipient={recipient_id} | recipient_is_viewing={recipient_is_viewing}")
	# Only increment unread if the recipient doesn't currently have this conversation open.
	if not recipient_is_viewing:
		ConversationParticipant.objects.filter(
			conversation_id=conversation.id,
			user_id=recipient_id
		).update(unread_count=F('unread_count') + 1, is_closed=False)


@database_sync_to_async
def get_dm_history(user_id, other_id):
	from chat.models import ConversationParticipant, Message, GameInvite

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
	# select_related fetches the sender's User object in the same query (JOIN) — without it,
	# accessing msg.sender.username would trigger a separate DB query per message.
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
		# The most recent message that the current user sent.
		# Loops backwards (newest-first) and stops at the first message where sender_id
		# matches the current user, then checks whether the recipient has read up to that point.
		for item in reversed(result):
			if item.get("sender_id") == user_id:
				last_msg_ts = item.get("created_at")
				break
	if last_msg_ts:
		# Fetch the other user's last_read_at timestamp to check if they've read our last message.
		other_part = ConversationParticipant.objects.filter(
			conversation_id=shared_conv_id,
			user_id=other_id
		).values_list('last_read_at', flat=True).first()
		from django.utils.dateparse import parse_datetime
		ts = parse_datetime(last_msg_ts)
		if other_part and ts and other_part >= ts:
			seen = True

	return result, seen


@database_sync_to_async
def save_invite(user_id, recipient_id, game_type, game_id, recipient_is_viewing):
	from chat.models import GameInvite, ConversationParticipant
	from django.db.models import F

	conversation = _get_or_create_conversation(user_id, recipient_id)
	# get_or_create prevents IntegrityError when two players mutually invite each
	# other before either accepts — both use the same gameId (same chess session).
	_, created = GameInvite.objects.get_or_create(
		game_id=game_id,
		defaults={
			'conversation': conversation,
			'sender_id': user_id,
			'recipient_id': recipient_id,
			'game_type': game_type,
		}
	)
	if not created:
		return
	if not recipient_is_viewing:
		ConversationParticipant.objects.filter(
			conversation=conversation,
			user_id=recipient_id
		).update(unread_count=F('unread_count') + 1, is_closed=False)


@database_sync_to_async
def get_invite_id_with(user_id, other_id):
	from chat.models import GameInvite
	from django.db.models import Q
	# .first() returns the GameInvite object or None if no invite exists between these two users.
	invite = GameInvite.objects.filter(
		Q(sender_id=user_id, recipient_id=other_id) |
		Q(sender_id=other_id, recipient_id=user_id)
	).first()
	return invite.game_id if invite else None


@database_sync_to_async
def delete_invite(game_id):
	from chat.models import GameInvite
	sender_id = GameInvite.objects.filter(game_id=game_id).values_list('sender_id', flat=True).first()
	GameInvite.objects.filter(game_id=game_id).delete()
	return str(sender_id) if sender_id else None


@database_sync_to_async
def cleanup_stale_invites(user_id):
	from chat.models import GameInvite
	from django.db.models import Q
	GameInvite.objects.filter(
		Q(sender_id=user_id) | Q(recipient_id=user_id)
	).delete()


@database_sync_to_async
def get_open_dms(user_id):
	from chat.models import ConversationParticipant, Message

	my_participations = ConversationParticipant.objects.filter(
		user_id=user_id
	)

	result = {}
	for my_participation in my_participations:
		# Skip conversations the user explicitly closed, unless there are unread messages —
		# a new message should reopen the tab even if the user closed it.
		if my_participation.is_closed and my_participation.unread_count == 0:
			continue

		# Find the other participant to get their participation and their username and user_id.
		# Django will JOIN the UserProfile table upfront
		other_participation = ConversationParticipant.objects.filter(
			conversation_id=my_participation.conversation_id
		).exclude(user_id=user_id).select_related('user').first()

		if other_participation:
			# most recent timestamp of my message
			last_sent_by_me = Message.objects.filter(
				conversation_id=my_participation.conversation_id,
				sender_id=user_id
			).order_by('-created_at').values_list('created_at', flat=True).first()
			seen = False
			if last_sent_by_me and other_participation.last_read_at and other_participation.last_read_at >= last_sent_by_me:
				seen = True
			result[str(other_participation.user_id)] = {
				"user_name": other_participation.user.username,
				"unread_count": my_participation.unread_count,
				"seen": seen,
			}

	return result


@database_sync_to_async
def mark_read(user_id, other_id):
	from chat.models import ConversationParticipant

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
def hide_dm(user_id, other_id):
	from chat.models import ConversationParticipant

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
def get_block_info_for(user_id):
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
