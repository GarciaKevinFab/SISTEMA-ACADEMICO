from django.urls import path
from .views import (
    token_obtain_pair, token_refresh,
    users_collection, user_detail, user_activate, user_deactivate,
    user_reset_password, users_search, user_roles,
    auth_me,  # <-- nuevo
)

urlpatterns = [
    path('auth/token/', token_obtain_pair, name='token_obtain_pair'),
    path('auth/token/refresh/', token_refresh, name='token_refresh'),
    path('auth/me', auth_me),  # <-- nuevo

    path('users', users_collection),
    path('users/search', users_search),
    path('users/<int:id>', user_detail),
    path('users/<int:id>/activate', user_activate),
    path('users/<int:id>/deactivate', user_deactivate),
    path('users/<int:id>/reset-password', user_reset_password),
    path('users/<int:id>/roles', user_roles),
]