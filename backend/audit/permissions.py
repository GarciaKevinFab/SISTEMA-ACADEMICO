from rest_framework.permissions import BasePermission
from acl.permissions import RequirePerm # reutiliza el guard de ACL


# Alias directo para usar en views: IsAuthenticated + RequirePerm('admin.audit.view')