from django.shortcuts import render

# Create your views here.
from django.contrib.auth.models import Group, User
from rest_framework import viewsets, mixins, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import AppPermission, RolePermission
from .serializers import AppPermissionSerializer, RoleSerializer
from .services import expand_aliases

class IsStaff(permissions.BasePermission):
    def has_permission(self, request, view):
        # GET permitido a autenticados; mutaciones sólo staff
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return request.user and request.user.is_authenticated
        return request.user and request.user.is_staff

class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AppPermission.objects.all().order_by("code")
    serializer_class = AppPermissionSerializer
    permission_classes = [IsStaff]

class RoleViewSet(viewsets.ModelViewSet):
    queryset = Group.objects.all().order_by("name")
    serializer_class = RoleSerializer
    permission_classes = [IsStaff]

    # GET /api/roles/{id}/permissions (efectivos con alias)
    @action(detail=True, methods=["get"], url_path="permissions")
    def role_permissions(self, request, pk=None):
        role = self.get_object()
        codes = set(RolePermission.objects.filter(role=role).values_list("permission__code", flat=True))
        return Response(sorted(expand_aliases(codes)))

# /api/users/{id}/permissions (efectivos por TODAS sus roles)
class UserPermissionsViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=["get"], url_path=r'(?P<user_id>\d+)/permissions')
    def list_for_user(self, request, user_id=None):
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response({"detail": "User not found"}, status=404)
        role_ids = list(user.groups.values_list("id", flat=True))
        codes = set(
            RolePermission.objects.filter(role_id__in=role_ids).values_list("permission__code", flat=True)
        )
        return Response(sorted(expand_aliases(codes)))
