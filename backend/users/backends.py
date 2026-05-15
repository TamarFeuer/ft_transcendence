from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend

UserModel = get_user_model()


class EmailOrUsernameBackend(ModelBackend):
    """
    Custom authentication backend that supports login by either email or username.
    """

    def authenticate(self, request, username=None, password=None, **kwargs):
        """
        Authenticate using email or username.
        
        Args:
            request: HTTP request
            username: username or email identifier
            password: user password
            **kwargs: additional arguments (including 'email' for compatibility)
        
        Returns:
            User object if authentication succeeds, None otherwise
        """
        # Support both 'username' and 'email' parameters for flexibility
        identifier = (kwargs.get("email") or username or "").strip().lower()
        
        if not identifier or not password:
            return None

        try:
            # Try email lookup if identifier contains @
            if "@" in identifier:
                user = UserModel.objects.get(email__iexact=identifier)
            else:
                # Try username lookup
                user = UserModel.objects.get(username=identifier)
        except UserModel.DoesNotExist:
            return None
        except UserModel.MultipleObjectsReturned:
            # Should not happen if email/username are unique, but handle gracefully
            return None

        # Verify password and check if user is active
        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        
        return None
