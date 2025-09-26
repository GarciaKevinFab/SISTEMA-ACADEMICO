from .models import RolePermission

def user_effective_perm_codes(user) -> set[str]:
    if not user or not user.is_authenticated:
        return set()
    role_ids = list(user.roles.values_list("id", flat=True))
    if not role_ids:
        return set()
    qs = RolePermission.objects.filter(role_id__in=role_ids).select_related("permission")
    return {rp.permission.code for rp in qs}