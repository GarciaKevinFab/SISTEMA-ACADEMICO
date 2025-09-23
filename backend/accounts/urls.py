# backend/accounts/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UserViewSet, me, login_view, logout_view

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')

urlpatterns = [
    path("", include(router.urls)),

    # Perfil del usuario autenticado
    path("auth/me", me, name="auth_me"),

    # Sesión (opcional si usarás únicamente JWT)
    path("login/", login_view, name="login"),
    path("logout/", logout_view, name="logout"),
]

# JWT opcional (si tienes instalado simplejwt)
try:
    from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
    urlpatterns += [
        path("auth/login", TokenObtainPairView.as_view(), name="token_obtain_pair"),
        path("auth/refresh", TokenRefreshView.as_view(), name="token_refresh"),
    ]
except Exception:
    pass
