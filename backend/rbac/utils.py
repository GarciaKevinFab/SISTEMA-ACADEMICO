# backend/rbac/utils.py
from django.contrib.auth.models import Group
from django.core.exceptions import ObjectDoesNotExist

def get_role_by_identifier(identifier: str) -> Group:
    """identifier puede ser '12' (id) o 'ADMIN_SYSTEM' (name)."""
    try:
        return Group.objects.get(id=int(identifier))
    except (ValueError, ObjectDoesNotExist):
        return Group.objects.get(name=identifier)
