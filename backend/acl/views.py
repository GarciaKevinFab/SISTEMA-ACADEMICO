# acl/views.py
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import viewsets, permissions
from rest_framework_simplejwt.authentication import JWTAuthentication
from .models import Role, Permission
from .serializers import RoleSerializer, PermissionSerializer

# Si prefieres controlar por permiso lógico, puedes reactivar esto:
# class HasAccessManage(permissions.BasePermission):
#     def has_permission(self, request, view):
#         return request.user.is_superuser or getattr(request.user, "has_perm_code", lambda x: False)("admin.access.manage")

@method_decorator(csrf_exempt, name='dispatch')
class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.all().order_by("name")
    serializer_class = RoleSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]  # cambia a [permissions.IsAuthenticated, HasAccessManage] si ya tienes esa lógica

@method_decorator(csrf_exempt, name='dispatch')
class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Permission.objects.all().order_by("code")
    serializer_class = PermissionSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]
