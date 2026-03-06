import os
from pathlib import Path
from dotenv import load_dotenv
from corsheaders.defaults import default_headers

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.getenv("SECRET_KEY", "change-me")
DEBUG = os.getenv("DEBUG", "0") == "1"

# -----------------------
# HOSTS / PROXY HTTPS (Cloudflare -> Nginx -> Gunicorn)
# -----------------------
if DEBUG:
    ALLOWED_HOSTS = ["*"]
else:
    ALLOWED_HOSTS = [
        "localhost",
        "127.0.0.1",
        "sis.iesppallende.edu.pe",
        "academico.iesppallende.edu.pe",
        "repositorio.iesppallende.edu.pe",
        "iesppallende.edu.pe",
    ]

# Cloudflare termina TLS y pasa a nginx, nginx a gunicorn
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# Cookies seguras en HTTPS (Cloudflare)
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_SECURE = True

# (opcional pero útil) evita enviar cookie CSRF a subdominios si no quieres
# CSRF_COOKIE_DOMAIN = "iesppallende.edu.pe"
# SESSION_COOKIE_DOMAIN = "iesppallende.edu.pe"

# -----------------------
# CORS + CSRF (desde .env)
# -----------------------
# En .env: CORS_ORIGINS=https://academico...,https://sis...
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "").strip()
CORS_ALLOWED_ORIGINS = [o.strip() for o in CORS_ORIGINS.split(",") if o.strip()]

# Para POST de formularios/admin detrás de proxy, Django valida el Origin
CSRF_TRUSTED_ORIGINS = [o.strip() for o in CORS_ORIGINS.split(",") if o.strip()]

# Si por algún motivo en DEV usas http local, puedes incluirlos en el .env:
# CORS_ORIGINS=https://academico...,https://sis...,http://localhost:3000,http://127.0.0.1:3000

# Si tu frontend usa Authorization Bearer (JWT), no necesitas cookies.
# Pero no hace daño tener esto activado si algún día usas cookies/sesión.
CORS_ALLOW_CREDENTIALS = True

# Headers que permitirá CORS
CORS_ALLOW_HEADERS = list(default_headers) + [
    "authorization",
    "content-type",
    "idempotency-key",
]

# -----------------------
# OTRAS OPCIONES
# -----------------------
# OJO: si usas routers sin slash final, esto debe quedar False (como lo tienes)
APPEND_SLASH = False

INSTALLED_APPS = [
    # Django
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # Terceros
    "rest_framework",
    "corsheaders",

    # Apps del proyecto
    "accounts.apps.AccountsConfig",
    "users",
    "acl",
    "catalogs",
    "graduates",
    "students",
    "academic",
    "admission",
    "mesa_partes",
    "finance",
    "minedu",
    "notifications",
    "portal",
    "reports",
    "research",
    "security_mfa",
    "audit",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",

    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",

    # ✅ request_id + client_ip
    "audit.middleware.RequestIdMiddleware",

    # ✅ ESTE ES EL QUE TE FALTA (GRABA EN audit_logs)
    "audit.middleware.AuditLogMiddleware",

    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]


ROOT_URLCONF = "sistema_academico.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    }
]

WSGI_APPLICATION = "sistema_academico.wsgi.application"
ASGI_APPLICATION = "sistema_academico.asgi.application"

# -----------------------
# DATABASE
# -----------------------
DB_ENGINE = os.getenv("DB_ENGINE", "sqlite").lower()

if DB_ENGINE == "postgres":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.getenv("DB_NAME", "sistema_academico"),
            "USER": os.getenv("DB_USER", "postgres"),
            "PASSWORD": os.getenv("DB_PASSWORD", ""),
            "HOST": os.getenv("DB_HOST", "127.0.0.1"),
            "PORT": os.getenv("DB_PORT", "5432"),
            "CONN_MAX_AGE": 60,
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
            "OPTIONS": {"timeout": 30},
        }
    }

# -----------------------
# AUTH
# -----------------------
AUTH_USER_MODEL = "accounts.User"

# -----------------------
# DRF + JWT
# -----------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
}

# -----------------------
# STATIC / MEDIA
# -----------------------
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

STATIC_DIR = BASE_DIR / "static"
STATICFILES_DIRS = [STATIC_DIR] if STATIC_DIR.exists() else []

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# -----------------------
# I18N / TZ
# -----------------------
LANGUAGE_CODE = "es"
TIME_ZONE = "America/Lima"
USE_I18N = True
USE_TZ = True

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
