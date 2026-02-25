import os
import logging
from pathlib import Path
# from corsheaders.defaults import default_headers

BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = 'your-secret-key-change-in-production'
DEBUG = True
ALLOWED_HOSTS = ['*']

# Make cookies accessible to JavaScript
SESSION_COOKIE_HTTPONLY = False
CSRF_COOKIE_HTTPONLY = False

# Allow cookies across ports on localhost
# SESSION_COOKIE_SAMESITE = 'Lax'
# CSRF_COOKIE_SAMESITE = 'Lax'

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
    # 'corsheaders',
]

print("Based dir:", BASE_DIR)

MIDDLEWARE = [
    # 'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.middleware.common.CommonMiddleware',
 
]

ROOT_URLCONF = 'django_server.urls'
WSGI_APPLICATION = 'django_server.wsgi.application'
ASGI_APPLICATION = 'django_server.asgi.application'

# REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")

# Channels configuration
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [("redis", 6379)],  # "redis" is the docker service name
        },
    },
}

# DATABASES = {
#     'default': {
#         'ENGINE': 'django.db.backends.sqlite3',
#         'NAME': BASE_DIR / 'db.sqlite3',
#     }
# }

# Database
# https://docs.djangoproject.com/en/5.1/ref/settings/#databases

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
}

# # if using cookies for auth
# CORS_ALLOW_CREDENTIALS = True

# # allow frontend origin
# CORS_ALLOWED_ORIGINS = [
#     "http://localhost:5173",
# ]

# CORS_ALLOW_HEADERS = list(default_headers) + [
#     'Authorization',
# ]