import os
import logging
from pathlib import Path
from dotenv import load_dotenv
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR.parent / '.env')
SECRET_KEY = 'your-secret-key-change-in-production'
DEBUG = True
ALLOWED_HOSTS = ['*']
DEFAULT_AUTO_FIELD = 'django.db.models.AutoField'

# Make cookies accessible to JavaScript
SESSION_COOKIE_HTTPONLY = False
CSRF_COOKIE_HTTPONLY = False

# For cross-port localhost cookie sharing
SESSION_COOKIE_SAMESITE = 'None'
SESSION_COOKIE_SECURE = False  # Allow HTTP (localhost)

CSRF_COOKIE_SAMESITE = 'None'
CSRF_COOKIE_SECURE = False

# For cross-port on localhost
CSRF_TRUSTED_ORIGINS = ['http://localhost:5173', 'http://localhost:3000']

INSTALLED_APPS = [
    'daphne',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.staticfiles',
    'rest_framework',
    'channels',
    'game',
    'chat',
    'tournament',
    'users',
    'friends',
    'chessgame',
    'profiles',
    'axes'
]

print("Based dir:", BASE_DIR)

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'axes.middleware.AxesMiddleware',
]

# Axes configuration
AXES_FAILURE_LIMIT = 5          # lock after 5 failed attempts
AXES_COOLOFF_TIME = timedelta(minutes=3)          # unlock after 3 minutes
AXES_LOCKOUT_PARAMETERS = ["username", "user_agent"]
AXES_RESET_ON_SUCCESS = True    # reset counter on successful login

AUTHENTICATION_BACKENDS = [
    'axes.backends.AxesStandaloneBackend',
    'django.contrib.auth.backends.ModelBackend',
]

ROOT_URLCONF = 'django_server.urls'
WSGI_APPLICATION = 'django_server.wsgi.application'
ASGI_APPLICATION = 'django_server.asgi.application'

# Channels configuration
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    },
}

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('DB_NAME'),
        'USER': os.getenv('DB_USER'),
        'PASSWORD': os.getenv('DB_PASSWORD'),
        'HOST': os.getenv('DB_HOST'),
        'PORT': os.getenv('DB_PORT', '5432'),
    }
}

STATIC_URL = 'static/'

# Colored logging configuration
class ColoredFormatter(logging.Formatter):
    """Custom formatter with ANSI color codes"""
    COLORS = {
        'DEBUG': '\033[36m',      # Cyan
        'INFO': '\033[32m',       # Green
        'WARNING': '\033[33m',    # Yellow
        'ERROR': '\033[31m',      # Red
        'CRITICAL': '\033[35m',   # Magenta
    }
    RESET = '\033[0m'
    
    def format(self, record):
        log_color = self.COLORS.get(record.levelname, self.RESET)
        record.levelname = f"{log_color}{record.levelname}{self.RESET}"
        return super().format(record)

# Configure logging with colors
logging.basicConfig(
    format='%(asctime)s %(levelname)s %(name)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    level=logging.DEBUG
)

# Apply colored formatter to all handlers
for handler in logging.root.handlers:
    handler.setFormatter(ColoredFormatter(
        fmt='%(asctime)s %(levelname)s %(name)s: %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    ))

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'colored': {
            '()': ColoredFormatter,
            'format': '%(asctime)s %(levelname)s %(name)s: %(message)s',
            'datefmt': '%Y-%m-%d %H:%M:%S'
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'colored',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'DEBUG',
    },
    # Suppress noisy Daphne websocket debug logs by raising its logger level
    'loggers': {
        'daphne.ws_protocol': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}
