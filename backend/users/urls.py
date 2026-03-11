# backend/users/urls.py
from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import (
    auth_me,
    users_collection,
    users_detail,
    users_activate,
    users_deactivate,
    users_reset_password,
    users_search,
    users_assign_roles,
    change_password,
    users_set_password,
    users_purge,
    users_bulk_credentials,
)

urlpatterns = [
    # ---------- AUTH (JWT) ----------
    path("auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/me", auth_me, name="auth_me"),
    path("auth/change-password", change_password, name="change_password"),

    # ---------- USERS ----------
    path("users", users_collection, name="users_collection"),
    path("users/<int:pk>", users_detail, name="users_detail"),

    # acciones
    path("users/<int:pk>/activate", users_activate, name="users_activate"),
    path("users/<int:pk>/deactivate", users_deactivate, name="users_deactivate"),
    path("users/<int:pk>/reset-password", users_reset_password, name="users_reset_password"),
    path("users/<int:pk>/set-password", users_set_password, name="users_set_password"),

    # roles
    path("users/<int:pk>/roles", users_assign_roles, name="users_assign_roles"),

    # búsqueda
    path("users/search", users_search, name="users_search"),

    # purge masivo
    path("users/purge", users_purge, name="users_purge"),

    # descarga masiva de credenciales
    path("users/bulk-credentials", users_bulk_credentials, name="users_bulk_credentials"),
]
