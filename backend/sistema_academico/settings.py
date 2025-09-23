# backend/sistema_academico/settings.py
from pathlib import Path
import os
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv("SECRET_KEY", "django-insecure-secret")
DEBUG = True
ALLOWED_HOSTS = ["*"]

# =======================
# APPS
# =======================
INSTALLED_APPS = [
    # Django apps
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # 3rd party apps
    "rest_framework",
    "corsheaders",

    # Project apps
    "accounts",
    "students",
    "courses",
    "enrollment",
    "grades",
    "procedures",
    "common",
    "acl",  # <--- ACL
]

# =======================
# MIDDLEWARE
# =======================
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",   # siempre primero
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    # OJO: tu clase se llama LogingMiddleware (una sola 'g')
    "sistema_academico.middleware.login_middleware.LogingMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# =======================
# URLS / WSGI
# =======================
ROOT_URLCONF = "sistema_academico.urls"
WSGI_APPLICATION = "sistema_academico.wsgi.application"

# =======================
# TEMPLATES (requerido por admin)
# =======================
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],  # opcional
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# =======================
# BASE DE DATOS
# =======================
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",   # desarrollo
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

# =======================
# AUTH
# =======================
AUTH_USER_MODEL = "accounts.User"

# DRF + JWT (con fallback si no tienes simplejwt instalado aún)
try:
    import rest_framework_simplejwt  # noqa: F401
    DEFAULT_AUTH = [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ]
except Exception:
    DEFAULT_AUTH = [
        "rest_framework.authentication.SessionAuthentication",
        "rest_framework.authentication.BasicAuthentication",
    ]

REST_FRAMEWORK = {
    "DEFAULT_PERMISSION_CLASSES": [
        # Cambia a AllowAny si quieres probar sin token:
        # "rest_framework.permissions.AllowAny",
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_AUTHENTICATION_CLASSES": DEFAULT_AUTH,
}

# Opcional: tiempos de JWT (si usas simplejwt)
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
}

# =======================
# CORS / CSRF
# =======================
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

# Para desarrollo con React en :3000 (útil si usas cookies/csrf)
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

# =======================
# STATIC / MEDIA / TIMEZONE
# =======================
STATIC_URL = "static/"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

TIME_ZONE = "America/Lima"
USE_TZ = True

# =======================
# PK por defecto
# =======================
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
