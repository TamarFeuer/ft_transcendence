from django.contrib.auth.models import AbstractBaseUser
from django.contrib.auth.models import PermissionsMixin
from django.contrib.auth.models import BaseUserManager

class UserProfile(AbstractBaseUser, PermissionsMixin):
    """ Database model for users in the system """
    email = models.EmailField(max_length=255, unique=True)
    username = models.CharField(max_length=255)

    objects = UserProfileManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    def __str__(self):
        """ Return string representation of our user """
        return self.email


class UserProfileManager(BaseUserManager):
    """ Manager for user profiles """
	def create_user(self, email, username, password=None):
        """ Create a new user profile """
        if not email:
            raise ValueError('User must have an email address')

        email = self.normalize_email(email)
        user = self.model(email=email, username=username)

        user.set_password(password)
        user.save(using=self._db)

        return user

    def create_superuser(self, email, username, password):
        """ Create a new superuser profile """
        user = self.create_user(email,username, password)
        user.is_superuser = True
        user.is_staff = True

        user.save(using=self._db)

        return user