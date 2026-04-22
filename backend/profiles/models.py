from django.db import models
from django.contrib.auth.models import User

class UserProfile(models.Model):
	# This creates a link between UserProfile and User — one profile per user, one user per profile
	# OnetoOneField means one profile per user; if user is deleted, profile is deleted too
	# CASCADE means "delete this too"
	# related_name='profile' adds a shortcut going the other direction, we can now write some_user.profile
	user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
	avatar = models.URLField(blank=True)  # URL to profile picture, empty by default
	bio = models.TextField(blank=True)    # free text bio, empty by default
	
	# defines how the object looks when printed or displayed as a string 
	# Without it, printing a UserProfile object would show something unhelpful
	def __str__(self):
		# self: the current UserProfile instance
		# self.user: the linked User object, accessed via the OneToOneField we defined
		return f"{self.user.username}'s profile" # i.e. "tamar's profile"
	
	# A special inner class that tells Django extra information about the model that isn't a field
	class Meta:
		db_table = 'profiles_userprofile' # appname_modelname