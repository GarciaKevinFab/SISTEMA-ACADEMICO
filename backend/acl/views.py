# backend/acl/views.py
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Role, Permission
from .serializers import RoleSerializer, PermissionSerializer
from .permissions import RequirePerm


class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.all().prefetch_related("permissions")
    serializer_class = RoleSerializer
    permission_classes = [RequirePerm]
    required_perm = "admin.access.manage"  # si molesta, comenta esto mientras pruebas

    @action(detail=True, methods=["get"], url_path="permissions")
    def permissions(self, request, pk=None):
        role = self.get_object()
        codes = list(role.permissions.values_list("code", flat=True))
        return Response({"permissions": codes})

    @permissions.mapping.put
    def set_permissions(self, request, pk=None):
        role = self.get_object()
        codes = request.data.get("permissions", [])

        if not isinstance(codes, list):
            return Response(
                {"detail": "El campo 'permissions' debe ser una lista de strings."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        perms = Permission.objects.filter(code__in=codes)
        role.permissions.set(perms)

        serializer = self.get_serializer(role)
        return Response(serializer.data, status=status.HTTP_200_OK)


class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Permission.objects.all()
    serializer_class = PermissionSerializer
    permission_classes = [RequirePerm]
    required_perm = "admin.access.manage"
