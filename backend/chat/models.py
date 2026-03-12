from django.db import models
from django.contrib.auth.models import User

class Message(models.Model):
	#null=True: a database concept. It tells the database that the column is allowed to store NULL. This is about what gets saved to PostgreSQL
	#blank=True: a Django concept. It tells Django's validation that the field is allowed to be empty

	#recipient starts out empty for global messages, so we need blank=True to tell Django "it's fine to create a Message without filling this in"
 	# and null=True to tell PostgreSQL "store NULL here"
	#sender is always provided when the message is created, so Django validation never sees it as blank,but it can later become NULL in the database if the user is deleted,
 	# so we only need null=True
	sender = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='sent_messages')
	recipient = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='received_messages')
	content = models.TextField()
	created_at = models.DateTimeField(auto_now_add=True)
	
	# defines how the object looks when printed or displayed as a string 
	# Without it, printing a UserProfile object would show something unhelpful
	def __str__(self):
		sender_name = self.sender.username if self.sender else "deleted_user"
		recipient_name = self.recipient.username if self.recipient else "global" 
		return f"{sender_name} -> {recipient_name}: {self.content[:30]}"
	
	# A special inner class that tells Django extra information about the model that isn't a field
	class Meta:
		db_table = 'chat_message' # appname_modelname
		ordering = ['created_at'] # queries return messages oldest-first by default