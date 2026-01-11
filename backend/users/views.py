# backend/users/views.py
from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils.crypto import get_random_string

from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from acl.models import Role
from .serializers import UserSerializer, UserCreateSerializer, UserUpdateSerializer

# ✅ NUEVO: Students
from students.models import Student

User = get_user_model()


# ---------- permisos ----------
class IsAdminOrReadOnly(permissions.BasePermission):
    """
    GET/HEAD/OPTIONS: cualquier usuario autenticado
    Mutaciones: solo staff
    """
    def has_permission(self, request, view):
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return request.user and request.user.is_authenticated
        return request.user and request.user.is_authenticated and request.user.is_staff


def _require_staff(request):
    if not request.user.is_staff:
        return Response({"detail": "No autorizado."}, status=status.HTTP_403_FORBIDDEN)
    return None


def _split_full_name(full_name: str, fallback: str = ""):
    full = (full_name or "").strip()
    if not full:
        full = (fallback or "").strip()

    if not full:
        return "", ""

    parts = [p for p in full.split() if p]
    if len(parts) == 1:
        return parts[0], ""
    if len(parts) >= 3:
        # últimos 2 = apellidos (común)
        nombres = " ".join(parts[:-2])
        apellidos = " ".join(parts[-2:])
        return nombres, apellidos
    return parts[0], parts[1]


def _ensure_student_for_user(user: User):
    """
    Si el usuario tiene rol STUDENT, asegurar Student enlazado.
    Crea Student con DNI/COD temporales para cumplir unique.
    """
    # ya tiene
    if hasattr(user, "student_profile"):
        return None

    full_name = getattr(user, "full_name", "") or ""
    username = getattr(user, "username", "") or ""
    email = getattr(user, "email", "") or ""

    nombres, apellidos = _split_full_name(full_name, fallback=username)

    # DNI/Código temporales (luego se corrigen en el módulo Estudiante)
    temp_dni = "99" + get_random_string(6, allowed_chars="0123456789")   # 8 dígitos
    temp_cod = "TMP-" + get_random_string(8).upper()

    st = Student.objects.create(
        user=user,
        codigo_estudiante=temp_cod,
        dni=temp_dni,
        nombres=nombres or username,
        apellidos=apellidos,
        email=email,
        estado="activo",
    )
    return st


# ---------- AUTH ----------
@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def auth_me(request):
    u = request.user

    roles = []
    if hasattr(u, "roles"):
        roles = list(u.roles.values_list("name", flat=True))

    perm_codes = []
    if hasattr(u, "roles"):
        perm_codes = list(
            u.roles.values_list("permissions__code", flat=True).distinct()
        )

    # ✅ NUEVO: student_id si está enlazado
    student_id = None
    if hasattr(u, "student_profile"):
        student_id = u.student_profile.id

    return Response({
        "id": u.id,
        "username": u.username,
        "email": getattr(u, "email", ""),
        "full_name": getattr(u, "full_name", ""),
        "is_active": u.is_active,
        "is_staff": u.is_staff,
        "is_superuser": u.is_superuser,
        "roles": roles,
        "permissions": perm_codes,
        "student_id": student_id,
    })


# ✅ ---------- USERS (COLLECTION) ----------
@api_view(["GET", "POST"])
@permission_classes([permissions.IsAuthenticated])
def users_collection(request):
    """
    GET  /api/users?q=...
    POST /api/users      (solo staff)
    """
    # ----- GET -----
    if request.method == "GET":
        q = (request.query_params.get("q") or "").strip()
        qs = User.objects.all().order_by("id")
        if q:
            qs = qs.filter(
                Q(username__icontains=q) |
                Q(email__icontains=q) |
                Q(full_name__icontains=q)
            )
        ser = UserSerializer(qs, many=True)
        return Response({"users": ser.data})

    # ----- POST -----
    not_ok = _require_staff(request)
    if not_ok:
        return not_ok

    roles = request.data.get("roles", [])
    ser = UserCreateSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    user = ser.save(is_active=True)

    # roles opcionales
    if isinstance(roles, list) and hasattr(user, "roles"):
        role_objs = []
        for name in roles:
            r, _ = Role.objects.get_or_create(name=str(name).strip())
            role_objs.append(r)
        user.roles.set(role_objs)

        # ✅ si lo creas como STUDENT desde aquí, también crea su Student
        role_names = [r.name.upper() for r in role_objs]
        if "STUDENT" in role_names:
            _ensure_student_for_user(user)

    return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


# ✅ ---------- USERS (DETAIL) ----------
@api_view(["PUT", "PATCH", "DELETE"])
@permission_classes([permissions.IsAuthenticated])
def users_detail(request, pk: int):
    """
    PUT/PATCH/DELETE /api/users/<id>   (solo staff)
    """
    not_ok = _require_staff(request)
    if not_ok:
        return not_ok

    try:
        user = User.objects.get(pk=pk)
    except User.DoesNotExist:
        return Response({"detail": "No existe."}, status=404)

    # DELETE
    if request.method == "DELETE":
        if request.user.id == pk:
            return Response({"detail": "No puedes eliminarte a ti mismo."}, status=400)
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # PUT/PATCH
    partial = (request.method == "PATCH")
    ser = UserUpdateSerializer(user, data=request.data, partial=partial)
    ser.is_valid(raise_exception=True)
    user = ser.save()
    return Response(UserSerializer(user).data)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def users_search(request):
    """
    GET /api/users/search?q=...
    Alias de listado
    """
    q = (request.query_params.get("q") or "").strip()
    qs = User.objects.all().order_by("id")
    if q:
        qs = qs.filter(
            Q(username__icontains=q) |
            Q(email__icontains=q) |
            Q(full_name__icontains=q)
        )
    return Response({"users": UserSerializer(qs, many=True).data})


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def users_deactivate(request, pk: int):
    not_ok = _require_staff(request)
    if not_ok:
        return not_ok

    try:
        user = User.objects.get(pk=pk)
    except User.DoesNotExist:
        return Response({"detail": "No existe."}, status=404)

    user.is_active = False
    user.save(update_fields=["is_active"])
    return Response({"status": "deactivated"})


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def users_activate(request, pk: int):
    not_ok = _require_staff(request)
    if not_ok:
        return not_ok

    try:
        user = User.objects.get(pk=pk)
    except User.DoesNotExist:
        return Response({"detail": "No existe."}, status=404)

    user.is_active = True
    user.save(update_fields=["is_active"])
    return Response({"status": "activated"})


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def users_reset_password(request, pk: int):
    not_ok = _require_staff(request)
    if not_ok:
        return not_ok

    try:
        user = User.objects.get(pk=pk)
    except User.DoesNotExist:
        return Response({"detail": "No existe."}, status=404)

    tmp = get_random_string(10)
    user.set_password(tmp)
    user.save(update_fields=["password"])
    return Response({"status": "password_reset", "temporary_password": tmp})


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def users_assign_roles(request, pk: int):
    """
    POST /api/users/<id>/roles
    body: { roles: ["ADMIN", "STUDENT"] }
    """
    not_ok = _require_staff(request)
    if not_ok:
        return not_ok

    roles = request.data.get("roles", [])
    if not isinstance(roles, list):
        return Response({"detail": "roles must be a list"}, status=400)

    try:
        user = User.objects.get(pk=pk)
    except User.DoesNotExist:
        return Response({"detail": "No existe."}, status=404)

    if not hasattr(user, "roles"):
        return Response({"detail": "Este modelo User no tiene roles."}, status=400)

    role_objs = []
    for name in roles:
        r, _ = Role.objects.get_or_create(name=str(name).strip())
        role_objs.append(r)

    user.roles.set(role_objs)

    # ✅ MEJORA: si se asigna STUDENT, crear Student automáticamente
    role_names = [r.name.upper() for r in role_objs]
    if "STUDENT" in role_names:
        _ensure_student_for_user(user)

    return Response({"status": "roles_assigned", "roles": [r.name for r in role_objs]})
