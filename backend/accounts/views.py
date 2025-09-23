# backend/accounts/views.py
from django.contrib.auth import get_user_model, authenticate, login, logout
from django.contrib.auth.models import Group
from django.db.models import Q

from rest_framework import viewsets, permissions
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from .serializers import UserSerializer

User = get_user_model()


class UserViewSet(viewsets.ModelViewSet):
    """
    CRUD de usuarios + acciones: activar/desactivar, reset password, asignar roles, search.
    """
    queryset = User.objects.all().order_by("id")
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAdminUser]  # ajusta si quieres abrir más

    def get_queryset(self):
        qs = super().get_queryset()
        q = self.request.query_params.get("q")
        if q:
            qs = qs.filter(
                Q(username__icontains=q) |
                Q(email__icontains=q) |
                Q(first_name__icontains=q) |
                Q(last_name__icontains=q)
            )
        return qs

    @action(detail=False, methods=["get"], url_path="search")
    def search(self, request):
        data = self.get_serializer(self.get_queryset(), many=True).data
        return Response(data)

    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        u = self.get_object()
        u.is_active = False
        u.save()
        return Response({"status": "deactivated"})

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        u = self.get_object()
        u.is_active = True
        u.save()
        return Response({"status": "activated"})

    @action(detail=True, methods=["post"], url_path="reset-password")
    def reset_password(self, request, pk=None):
        import secrets
        u = self.get_object()
        tmp = secrets.token_urlsafe(8)
        u.set_password(tmp)
        u.save()
        return Response({"temporary_password": tmp})

    @action(detail=True, methods=["post"], url_path="roles")
    def set_roles(self, request, pk=None):
        """
        Asigna roles (Django Groups) por nombre.
        Body: { "roles": ["ADMIN_ACADEMIC", "TEACHER"] }
        """
        u = self.get_object()
        roles = request.data.get("roles", [])
        if not isinstance(roles, list):
            return Response({"detail": "roles must be a list of group names"}, status=400)
        groups = Group.objects.filter(name__in=roles)
        u.groups.set(groups)
        u.save()
        return Response({"roles": [g.name for g in u.groups.all()]})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    """
    Devuelve el perfil del usuario autenticado (útil para /api/accounts/auth/me).
    """
    return Response(UserSerializer(request.user).data)


# (Opcional) Login/logout basados en sesión — si no los usas, puedes quitarlos de urls.py
@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    username = request.data.get("username")
    password = request.data.get("password")
    user = authenticate(request, username=username, password=password)
    if not user:
        return Response({"detail": "Credenciales inválidas"}, status=400)
    if not user.is_active:
        return Response({"detail": "Usuario inactivo"}, status=400)
    login(request, user)
    return Response({"status": "ok", "user": UserSerializer(user).data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request):
    logout(request)
    return Response({"status": "ok"})
