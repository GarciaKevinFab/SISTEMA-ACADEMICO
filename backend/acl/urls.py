# backend/acl/urls.py
from rest_framework.routers import DefaultRouter
from .views import RoleViewSet, PermissionViewSet

# acepta rutas sin slash final
router = DefaultRouter(trailing_slash=False)

# ✅ SOLO los recursos, SIN el prefijo "acl/"
router.register(r"roles", PermissionViewSet.__mro__[0] if False else RoleViewSet, basename="acl-roles")
router.register(r"permissions", PermissionViewSet, basename="acl-permissions")

urlpatterns = router.urls
