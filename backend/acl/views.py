from django.db.models import Q
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication

from .models import Role, Permission
from .serializers import RoleSerializer, PermissionSerializer
from .permissions import RequirePerm
from .permissions_catalog import PERMS


class RoleViewSet(viewsets.ModelViewSet):
    """
    /api/acl/roles              -> list, create
    /api/acl/roles/{id|name}    -> retrieve, update, delete
    /api/acl/roles/{id|name}/permissions (GET/POST)
    """
    queryset = Role.objects.all().order_by("name")
    serializer_class = RoleSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated, RequirePerm]
    required_perm = "admin.access.manage"

    def get_object(self):
        lookup = self.kwargs.get(self.lookup_field or "pk")
        qs = self.get_queryset()
        obj = qs.filter(Q(pk__iexact=lookup) | Q(name__iexact=lookup)).first()
        if not obj:
            from rest_framework.exceptions import NotFound
            raise NotFound("Rol no encontrado")
        self.check_object_permissions(self.request, obj)
        return obj

    # ⚠️ Renombrada para no chocar con DRF.get_permissions()
    @action(detail=True, methods=["get"], url_path="permissions")
    def permissions_list(self, request, pk=None):
        role = self.get_object()
        codes = list(role.permissions.values_list("code", flat=True))
        return Response({"permissions": codes})

    @action(detail=True, methods=["post"], url_path="permissions")
    def set_permissions(self, request, pk=None):
        role = self.get_object()
        submitted = request.data.get("permissions", [])
        valid = set(PERMS.keys())
        bad = [p for p in submitted if p not in valid]
        if bad:
            return Response(
                {"detail": f"Permisos inválidos: {', '.join(bad)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        perms = list(Permission.objects.filter(code__in=submitted))
        role.permissions.set(perms)
        return Response(RoleSerializer(role).data)


class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    /api/acl/permissions -> lista de códigos
    """
    queryset = Permission.objects.all().order_by("code")
    serializer_class = PermissionSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request, *args, **kwargs):
        codes = list(PERMS.keys())
        return Response({"permissions": codes})
