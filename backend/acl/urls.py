from django.urls import path, re_path
from rest_framework.routers import DefaultRouter
from .views import RoleViewSet, PermissionViewSet

router = DefaultRouter()
router.register(r"permissions", PermissionViewSet, basename="acl-permissions")

# Para permitir {idOrName} (numérico o string) en roles:
role_list = RoleViewSet.as_view({"get": "list", "post": "create"})
role_detail = RoleViewSet.as_view({"get": "retrieve", "put": "update", "delete": "destroy"})
role_perms = RoleViewSet.as_view({"get": "permissions", "post": "permissions"})

urlpatterns = [
    path("roles", role_list, name="acl-roles-list"),
    re_path(r"^roles/(?P<id_or_name>[^/]+)$", role_detail, name="acl-roles-detail"),
    re_path(r"^roles/(?P<id_or_name>[^/]+)/permissions$", role_perms, name="acl-roles-permissions"),
]

urlpatterns += router.urls
