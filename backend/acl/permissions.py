from rest_framework.permissions import BasePermission
from .utils import user_effective_perm_codes

class RequirePerm(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        required = getattr(view, 'required_perm', None) or getattr(request, 'required_perm', None)
        if not required:
            return True
        from .utils import user_effective_perm_codes
        return required in user_effective_perm_codes(request.user)