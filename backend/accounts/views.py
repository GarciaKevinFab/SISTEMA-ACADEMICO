from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework import viewsets, permissions, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status

from acl.models import Role
from .serializers import UserSerializer, UserCreateSerializer, UserUpdateSerializer

User = get_user_model()

class IsAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return request.user and request.user.is_authenticated
        return request.user and request.user.is_staff

class UsersViewSet(viewsets.GenericViewSet,
                   mixins.ListModelMixin,
                   mixins.RetrieveModelMixin,
                   mixins.CreateModelMixin,
                   mixins.UpdateModelMixin,
                   mixins.DestroyModelMixin):
    queryset = User.objects.all().order_by("id")
    permission_classes = [IsAdminOrReadOnly]

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        if self.action in ("update", "partial_update"):
            return UserUpdateSerializer
        return UserSerializer

    def list(self, request, *args, **kwargs):
        q = request.query_params.get("q", "").strip()
        qs = self.get_queryset()
        if q:
            qs = qs.filter(
                Q(username__icontains=q) |
                Q(email__icontains=q) |
                Q(full_name__icontains=q)
            )
        data = UserSerializer(qs, many=True).data
        return Response({"users": data})

    # POST /users/:id/deactivate
    @action(detail=True, methods=["post"], url_path="deactivate")
    def deactivate(self, request, pk=None):
        user = self.get_object()
        user.is_active = False
        user.save(update_fields=["is_active"])
        return Response({"status": "deactivated"})

    # POST /users/:id/activate
    @action(detail=True, methods=["post"], url_path="activate")
    def activate(self, request, pk=None):
        user = self.get_object()
        user.is_active = True
        user.save(update_fields=["is_active"])
        return Response({"status": "activated"})

    # POST /users/:id/reset-password
    @action(detail=True, methods=["post"], url_path="reset-password")
    def reset_password(self, request, pk=None):
        user = self.get_object()
        tmp = "Temp12345!"  # puedes randomizar luego
        user.set_password(tmp)
        user.save(update_fields=["password"])
        return Response({"status": "password_reset", "temporary_password": tmp})

    # POST /users/:id/roles  { "roles": ["ADMIN","STUDENT"] }
    @action(detail=True, methods=["post"], url_path="roles")
    def assign_roles(self, request, pk=None):
        roles = request.data.get("roles", [])
        if not isinstance(roles, list):
            return Response({"detail": "roles must be a list"}, status=400)

        user = self.get_object()
        role_objs = []
        for name in roles:
            r, _ = Role.objects.get_or_create(name=str(name).strip())
            role_objs.append(r)

        user.roles.set(role_objs)
        return Response({"status": "roles_assigned", "roles": [r.name for r in user.roles.all()]})

    # DELETE /users/:id  (hard delete)
    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        if request.user.id == user.id:
            return Response({"detail": "No puedes eliminar tu propio usuario."}, status=400)
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
