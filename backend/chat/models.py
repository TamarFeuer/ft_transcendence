from django.db import models
from django.contrib.auth.models import User

class Conversation(models.Model):
	# A conversation is a container for messages between two users.
	# The relationship between users lives here, not on individual messages.
	# This way "are these two people in a conversation?" is a single lookup.

	# The user who started the conversation. SET_NULL means the conversation
	# survives even if this user deletes their account.
	created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_conversations')
	created_at = models.DateTimeField(auto_now_add=True)

	# Updated every time a new message is sent, so conversations can be
	# sorted by most recent activity without aggregating all messages.
	last_message_at = models.DateTimeField(null=True, blank=True)

	def __str__(self):
		# Build a readable label showing who is in this conversation.
		# Used in Django admin and when printing a Conversation object.
		# p.user.username: for each participant p, get their linked user, then their username
		participants = self.participants.all()
		names = ', '.join(p.user.username for p in participants)
		# f-string: embeds the variable names directly into the string.
		# if names = "Alice, Bob", this produces: "Conversation(Alice, Bob)"
		return f"Conversation({names})"

	class Meta:
		db_table = 'chat_conversation'


class ConversationParticipant(models.Model):
	# Junction table between Conversation and User.
	# Represents "this user is part of this conversation".
	# Stores per-user state: how many unread messages they have,
	# and whether they have closed the conversation tab.

	conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='participants')
	user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='conversations')

	# Incremented when the other participant sends a message.
	# Reset to 0 when this user opens the conversation (mark_read).
	unread_count = models.IntegerField(default=0)

	# True when the user has explicitly closed this conversation tab.
	# Set back to False when a new message arrives.
	is_closed = models.BooleanField(default=False)

	def __str__(self):
		return f"{self.user.username} in conversation {self.conversation_id}"

	class Meta:
		db_table = 'chat_conversation_participant'
		# A user can only appear once per conversation
		unique_together = [('conversation', 'user')]


class Message(models.Model):
	# A message belongs to a Conversation. The sender is tracked per message
	# so we know who wrote what. If the sender deletes their account, the
	# message stays but sender becomes null (SET_NULL).

	# CASCADE: if the conversation is deleted, all its messages go with it
	conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')

	# null=True only to handle account deletion — a message always has a
	# sender when created
	sender = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='sent_messages')

	content = models.TextField()
	created_at = models.DateTimeField(auto_now_add=True)

	def __str__(self):
		sender_name = self.sender.username if self.sender else "deleted user"
		return f"{sender_name}: {self.content[:30]}"

	class Meta:
		db_table = 'chat_message'
		ordering = ['created_at']  # oldest first by default
