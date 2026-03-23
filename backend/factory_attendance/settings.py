import os
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')

SECRET_KEY = os.getenv('SECRET_KEY', 'django-insecure-dev-key')
DEBUG      = os.getenv('DEBUG', 'True') == 'True'
ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'channels',
    'django_filters',
    'django_celery_beat',
    'attendance',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF      = 'factory_attendance.urls'
ASGI_APPLICATION  = 'factory_attendance.asgi.application'

TEMPLATES = [{
    'BACKEND': 'django.template.backends.django.DjangoTemplates',
    'DIRS': [], 'APP_DIRS': True,
    'OPTIONS': {'context_processors': [
        'django.template.context_processors.debug',
        'django.template.context_processors.request',
        'django.contrib.auth.context_processors.auth',
        'django.contrib.messages.context_processors.messages',
    ]},
}]

def _database_from_url(url: str | None):
    if not url:
        return None
    parsed = urlparse(url)
    if parsed.scheme not in {"postgres", "postgresql"}:
        return None
    query = parse_qs(parsed.query)
    options = {}
    for key in ("sslmode", "channel_binding"):
        if key in query:
            options[key] = query[key][0]
    return {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': parsed.path.lstrip('/'),
        'USER': parsed.username or '',
        'PASSWORD': parsed.password or '',
        'HOST': parsed.hostname or '',
        'PORT': str(parsed.port or ''),
        'OPTIONS': options,
        'CONN_MAX_AGE': 60,
    }


_db_from_url = _database_from_url(os.getenv('DATABASE_URL'))
if _db_from_url:
    DATABASES = {'default': _db_from_url}
else:
    DATABASES = {
        'default': {
            'ENGINE':   'django.db.backends.postgresql',
            'NAME':     os.getenv('DB_NAME', 'factory_attendance'),
            'USER':     os.getenv('DB_USER', 'postgres'),
            'PASSWORD': os.getenv('DB_PASSWORD', 'postgres'),
            'HOST':     os.getenv('DB_HOST', 'localhost'),
            'PORT':     os.getenv('DB_PORT', '5432'),
            'CONN_MAX_AGE': 60,
        }
    }

REDIS_URL = os.getenv('REDIS_URL')
if not REDIS_URL:
    _redis_host = os.getenv('REDIS_HOST', '127.0.0.1')
    _redis_port = os.getenv('REDIS_PORT', '6379')
    _redis_password = os.getenv('REDIS_PASSWORD', '')
    if _redis_password:
        REDIS_URL = f"redis://:{_redis_password}@{_redis_host}:{_redis_port}"
    else:
        REDIS_URL = f"redis://{_redis_host}:{_redis_port}"

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG":  {"hosts": [REDIS_URL]},
    }
}

CELERY_BROKER_URL         = REDIS_URL
CELERY_RESULT_BACKEND     = REDIS_URL
CELERY_TIMEZONE           = 'Asia/Phnom_Penh'
CELERY_BEAT_SCHEDULER     = 'django_celery_beat.schedulers:DatabaseScheduler'

STATIC_URL  = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL   = '/media/'
MEDIA_ROOT  = BASE_DIR / 'media'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

_cors_allowed = [o.strip() for o in os.getenv('CORS_ALLOWED_ORIGINS', '').split(',') if o.strip()]
if _cors_allowed:
    CORS_ALLOWED_ORIGINS = _cors_allowed
    CORS_ALLOW_ALL_ORIGINS = False
else:
    CORS_ALLOW_ALL_ORIGINS = True

_csrf_trusted = [o.strip() for o in os.getenv('CSRF_TRUSTED_ORIGINS', '').split(',') if o.strip()]
if _csrf_trusted:
    CSRF_TRUSTED_ORIGINS = _csrf_trusted

REST_FRAMEWORK = {
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,
    'DEFAULT_FILTER_BACKENDS': ['django_filters.rest_framework.DjangoFilterBackend'],
}

# ── Face Recognition ──────────────────────────────────────────
FACE_THRESHOLD            = float(os.getenv('FACE_THRESHOLD', '0.38'))
FACE_DET_SIZE             = int(os.getenv('FACE_DET_SIZE', '640'))
CHECKIN_COOLDOWN_SECONDS  = int(os.getenv('CHECKIN_COOLDOWN', '300'))
MAX_EMBEDDINGS_PER_PERSON = int(os.getenv('MAX_EMBEDDINGS_PER_PERSON', '5'))

# ── Telegram ──────────────────────────────────────────────────
TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '')
TELEGRAM_CHAT_ID   = os.getenv('TELEGRAM_CHAT_ID', '')

# ── Email ─────────────────────────────────────────────────────
EMAIL_BACKEND       = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST          = os.getenv('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT          = int(os.getenv('EMAIL_PORT', '587'))
EMAIL_USE_TLS       = True
EMAIL_HOST_USER     = os.getenv('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')
ALERT_EMAIL_RECIPIENTS = [e for e in os.getenv('ALERT_EMAILS','').split(',') if e]

LANGUAGE_CODE = 'en-us'
TIME_ZONE     = 'Asia/Phnom_Penh'
USE_I18N = True
USE_TZ   = True
