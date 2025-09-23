# backend/rbac/views_acl.py
from django.contrib.auth.models import Group
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework import status

from .models import AppPermission, RolePermission
from .serializers import RoleSerializer, AppPermissionSerializer
from .utils import get_role_by_identifier
from .services import expand_aliases

# ---------- ROLES ----------

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])  # GET: cualquier autenticado. Cambia si quieres.
def roles_collection(request):
    if request.method == "GET":
        qs = Group.objects.all().order_by("name")
        data = [{"id": r.id, "name": r.name} for r in qs]
        return Response(data)

    # POST crea rol (sólo admin)
    if not request.user.is_staff:
        return Response({"detail": "Forbidden"}, status=403)

    serializer = RoleSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    role = serializer.save()
    return Response({"id": role.id, "name": role.name}, status=status.HTTP_201_CREATED)


@api_view(["PUT", "DELETE"])
@permission_classes([IsAuthenticated, IsAdminUser])
def role_item(request, idOrName: str):
    role = get_role_by_identifier(idOrName)

    if request.method == "PUT":
        serializer = RoleSerializer(role, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"id": role.id, "name": role.name})

    # DELETE
    role.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# ---------- PERMISOS ----------

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def permissions_collection(request):
    qs = AppPermission.objects.all().order_by("code")
    return Response(AppPermissionSerializer(qs, many=True).data)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def role_permissions(request, idOrName: str):
    role = get_role_by_identifier(idOrName)

    if request.method == "GET":
        codes = set(RolePermission.objects.filter(role=role)
                    .values_list("permission__code", flat=True))
        # expandimos alias para que el front reciba permisos efectivos
        return Response(sorted(expand_aliases(codes)))

    # POST: setear permisos del rol (sólo admin)
    if not request.user.is_staff:
        return Response({"detail": "Forbidden"}, status=403)

    codes = request.data.get("permissions", [])
    if not isinstance(codes, list):
        return Response({"detail": "permissions must be a list"}, status=400)

    RolePermission.objects.filter(role=role).delete()
    perms = list(AppPermission.objects.filter(code__in=codes))
    RolePermission.objects.bulk_create(
        [RolePermission(role=role, permission=p) for p in perms],
        ignore_conflicts=True,
    )
    return Response({"role": role.name, "count": len(perms)})
