# acl/urls.py
from rest_framework.routers import DefaultRouter
from .views import RoleViewSet, PermissionViewSet

router = DefaultRouter()
router.register(r'roles', RoleViewSet, basename='acl-roles')
router.register(r'permissions', PermissionViewSet, basename='acl-permissions')

urlpatterns = router.urls
