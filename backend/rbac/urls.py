from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PermissionViewSet, RoleViewSet, UserPermissionsViewSet

router = DefaultRouter()
router.register(r'permissions', PermissionViewSet, basename='permissions')
router.register(r'roles', RoleViewSet, basename='roles')
router.register(r'users', UserPermissionsViewSet, basename='users-perms')

urlpatterns = [
    path('', include(router.urls)),
]
# backend/rbac/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter

# (opcional: si mantienes los viewsets previos)
from .views import PermissionViewSet, RoleViewSet, UserPermissionsViewSet

from .views_acl import (
    roles_collection, role_item, permissions_collection, role_permissions
)

router = DefaultRouter()
# Mantén si te sirven:
router.register(r'permissions', PermissionViewSet, basename='permissions-viewset')
router.register(r'roles', RoleViewSet, basename='roles-viewset')
router.register(r'users', UserPermissionsViewSet, basename='users-perms')

urlpatterns = [
    # Rutas "compat" con tu frontend:
    path('acl/roles', roles_collection),                          # GET, POST
    path('acl/roles/<str:idOrName>', role_item),                  # PUT, DELETE
    path('acl/permissions', permissions_collection),              # GET
    path('acl/roles/<str:idOrName>/permissions', role_permissions),  # GET, POST

    # (opcional) APIs via ViewSet que ya teníamos
    path('', include(router.urls)),
]
