from django.contrib.auth.models import Group, Permission
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, mixins, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .serializers import RoleSerializer, PermissionSerializer

def _get_group_by_id_or_name(id_or_name: str) -> Group:
    # acepta id numérico o nombre
    if str(id_or_name).isdigit():
        return get_object_or_404(Group, id=int(id_or_name))
    return get_object_or_404(Group, name=id_or_name)

class RoleViewSet(viewsets.ModelViewSet):
    """
    /api/acl/roles                GET|POST
    /api/acl/roles/{idOrName}     GET|PUT|DELETE
    /api/acl/roles/{idOrName}/permissions  GET|POST
    """
    queryset = Group.objects.all().order_by("name")
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = "id_or_name"   # ficticio, lo resolvemos en get_object

    def get_object(self):
        return _get_group_by_id_or_name(self.kwargs.get("id_or_name"))

    @action(detail=True, methods=["get", "post"], url_path="permissions")
    def permissions(self, request, id_or_name=None):
        group = self.get_object()
        if request.method.lower() == "get":
            perms = group.permissions.values("id", "codename", "name")
            return Response(perms)

        # POST: { "permissions": ["academic.plans.view", ...] } (codenames)
        codenames = request.data.get("permissions", [])
        qs = Permission.objects.filter(codename__in=codenames)
        group.permissions.set(qs)
        return Response({"ok": True, "permissions": list(qs.values_list("codename", flat=True))})

class PermissionViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """
    /api/acl/permissions          GET
    """
    queryset = Permission.objects.all().order_by("codename")
    serializer_class = PermissionSerializer
    permission_classes = [IsAuthenticated]
