# backend/students/views.py
from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.db.models import Q
from django.utils.crypto import get_random_string

from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response

from acl.models import Role
from .models import Student
from .serializers import StudentSerializer, StudentUpdateSerializer, StudentMeUpdateSerializer
from .upload import validate_photo_upload
from students.models import Student
from acl.models import UserRole
User = get_user_model()

_user_fields = None

def _get_user_fields():
    global _user_fields
    if _user_fields is None:
        _user_fields = {f.name for f in User._meta.get_fields()}
    return _user_fields


def _create_user_for_student(st):
    """
    Crea un User + asigna rol STUDENT para un estudiante recién creado.
    Retorna (user, temp_password) o (None, None) si ya tenía usuario.
    """
    if getattr(st, "user_id", None):
        # Ya tiene usuario, solo asegurar rol
        student_role = Role.objects.filter(name__iexact="STUDENT").first()
        if student_role:
            UserRole.objects.get_or_create(user_id=st.user_id, role_id=student_role.id)
        return st.user, None

    user_fields = _get_user_fields()
    student_role = Role.objects.filter(name__iexact="STUDENT").first()

    # Username = num_documento
    username = (st.num_documento or "").strip() or f"tmp-{st.id}"
    uname = username
    k = 1
    while User.objects.filter(username=uname).exists():
        k += 1
        uname = f"{username}-{k}"

    full_name = f"{st.nombres or ''} {st.apellido_paterno or ''} {st.apellido_materno or ''}".strip()
    email_raw = (st.email or "").strip().lower()

    # Verificar email único
    email = ""
    if email_raw and "email" in user_fields:
        if not User.objects.filter(email__iexact=email_raw).exists():
            email = email_raw
        else:
            email = f"{uname}@no-email.local"
    elif "email" in user_fields:
        # Campo email existe pero no se proporcionó
        try:
            email_field = User._meta.get_field("email")
            if not getattr(email_field, "blank", True):
                email = f"{uname}@no-email.local"
        except Exception:
            pass

    user = User(username=uname, is_active=True, is_staff=False)

    if "email" in user_fields:
        user.email = email
    if "full_name" in user_fields:
        user.full_name = full_name
    elif "name" in user_fields:
        user.name = full_name

    temp_password = get_random_string(10) + "!"
    user.set_password(temp_password)

    try:
        user.save()
    except IntegrityError:
        # Reintento con email sintético
        if "email" in user_fields:
            user.email = f"{uname}@no-email.local"
            user.save()
        else:
            raise

    # Asignar rol STUDENT
    if student_role:
        UserRole.objects.get_or_create(user_id=user.id, role_id=student_role.id)

    # Enlazar usuario al estudiante
    st.user = user
    st.save(update_fields=["user"])

    return user, temp_password


def _require_staff(request):
    u = getattr(request, "user", None)

    if not (u and u.is_authenticated):
        return Response({"detail": "No autorizado."}, status=status.HTTP_403_FORBIDDEN)

    # ✅ staff pasa
    if getattr(u, "is_staff", False) or getattr(u, "is_superuser", False):
        return None

    # ✅ permitir roles
    allowed = {"ADMIN_ACADEMIC", "ADMIN_ACADEMICO", "ADMIN_SYSTEM", "REGISTRAR"}

    try:
        # si tu User tiene ManyToMany roles
        if hasattr(u, "roles") and u.roles.filter(name__in=list(allowed)).exists():
            return None
    except Exception:
        pass

    try:
        # si manejas roles por tabla acl_userrole
        if UserRole.objects.filter(user=u, role__name__in=list(allowed)).exists():
            return None
    except Exception:
        pass

    return Response({"detail": "No autorizado."}, status=status.HTTP_403_FORBIDDEN)


def _get_my_student(request):
    return getattr(request.user, "student_profile", None)


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
        nombres = " ".join(parts[:-2])
        apellidos = " ".join(parts[-2:])
        return nombres, apellidos
    return parts[0], parts[1]


# ✅ ADMIN: /students
@api_view(["GET", "POST"])
@permission_classes([permissions.IsAuthenticated])
def students_collection(request):
    not_ok = _require_staff(request)
    if not_ok:
        return not_ok

    if request.method == "GET":
        q = (request.query_params.get("q") or "").strip()
        qs = Student.objects.select_related("plan").order_by("id")
        if q:
            terms = [t for t in q.split() if t]
            for term in terms:
                qs = qs.filter(
                Q(num_documento__icontains=term) |
                Q(nombres__icontains=term) |
                Q(apellido_paterno__icontains=term) |
                Q(apellido_materno__icontains=term) |
                Q(email__icontains=term)
            )

        data = StudentSerializer(qs, many=True, context={"request": request}).data
        return Response({"students": data})

    ser = StudentUpdateSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    st = ser.save()

    # Auto-crear usuario con contraseña temporal
    user, temp_password = _create_user_for_student(st)

    data = StudentSerializer(st, context={"request": request}).data
    if temp_password and user:
        data["_credentials"] = {
            "username": user.username,
            "tempPassword": temp_password,
        }

    return Response(data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "PUT", "DELETE"])
@permission_classes([permissions.IsAuthenticated])
def students_detail(request, pk: int):
    not_ok = _require_staff(request)
    if not_ok:
        return not_ok

    try:
        st = Student.objects.get(pk=pk)
    except Student.DoesNotExist:
        return Response({"detail": "No existe."}, status=404)

    if request.method == "GET":
        return Response(StudentSerializer(st, context={"request": request}).data)

    if request.method == "DELETE":
        st.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    partial = request.method == "PATCH"
    ser = StudentUpdateSerializer(st, data=request.data, partial=partial)
    ser.is_valid(raise_exception=True)
    st = ser.save()
    return Response(StudentSerializer(st, context={"request": request}).data)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def students_photo(request, pk: int):
    not_ok = _require_staff(request)
    if not_ok:
        return not_ok

    try:
        st = Student.objects.get(pk=pk)
    except Student.DoesNotExist:
        return Response({"detail": "No existe."}, status=404)

    f, err = validate_photo_upload(request)
    if err:
        return err

    st.photo = f
    st.save(update_fields=["photo", "updated_at"])
    return Response(StudentSerializer(st, context={"request": request}).data)


@api_view(["DELETE"])
@permission_classes([permissions.IsAuthenticated])
def students_delete_photo(request, pk: int):
    """Elimina la foto de perfil de un estudiante (admin)."""
    not_ok = _require_staff(request)
    if not_ok:
        return not_ok

    try:
        st = Student.objects.get(pk=pk)
    except Student.DoesNotExist:
        return Response({"detail": "No existe."}, status=404)

    if st.photo:
        try:
            st.photo.delete(save=False)
        except Exception:
            pass
        st.photo = None
        st.save(update_fields=["photo", "updated_at"])

    return Response(StudentSerializer(st, context={"request": request}).data)


@api_view(["DELETE"])
@permission_classes([permissions.IsAuthenticated])
def students_me_delete_photo(request):
    """Elimina la foto de perfil del estudiante logueado."""
    st = _get_my_student(request)
    if not st:
        return Response({"detail": "Tu usuario no tiene estudiante vinculado."}, status=404)

    if st.photo:
        try:
            st.photo.delete(save=False)
        except Exception:
            pass
        st.photo = None
        st.save(update_fields=["photo", "updated_at"])

    return Response(StudentSerializer(st, context={"request": request}).data)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def students_link_user(request, pk: int):
    not_ok = _require_staff(request)
    if not_ok:
        return not_ok

    user_id = request.data.get("user_id")
    if not user_id:
        return Response({"detail": "Falta user_id."}, status=400)

    try:
        st = Student.objects.get(pk=pk)
    except Student.DoesNotExist:
        return Response({"detail": "No existe."}, status=404)

    try:
        u = User.objects.get(pk=int(user_id))
    except Exception:
        return Response({"detail": "Usuario inválido."}, status=400)

    if Student.objects.filter(user=u).exclude(pk=st.pk).exists():
        return Response({"detail": "Este usuario ya está enlazado a otro estudiante."}, status=400)

    st.user = u
    st.save(update_fields=["user", "updated_at"])
    return Response({"status": "linked", "student_id": st.id, "user_id": u.id})


@api_view(["GET", "PATCH"])
@permission_classes([permissions.IsAuthenticated])
def students_me(request):
    st = _get_my_student(request)

    if not st:
        full = getattr(request.user, "full_name", "") or getattr(request.user, "username", "")
        nombres, apellidos = _split_full_name(full, fallback=getattr(request.user, "username", ""))

        ap_parts = apellidos.split() if apellidos else []
        ap_pat = ap_parts[0] if len(ap_parts) >= 1 else ""
        ap_mat = " ".join(ap_parts[1:]) if len(ap_parts) >= 2 else ""

        # lo mejor: si username es su documento, úsalo
        username = getattr(request.user, "username", "")
        temp_doc = username[:12] if username else "TMP-" + get_random_string(9).upper()

        st = Student.objects.create(
            user=request.user,
            num_documento=temp_doc,
            nombres=nombres or username,
            apellido_paterno=ap_pat,
            apellido_materno=ap_mat,
            email=getattr(request.user, "email", "") or "",
        )

    if request.method == "GET":
        return Response(StudentSerializer(st, context={"request": request}).data)

    ser = StudentMeUpdateSerializer(st, data=request.data, partial=True)
    ser.is_valid(raise_exception=True)
    st = ser.save()
    return Response(StudentSerializer(st, context={"request": request}).data)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def students_me_photo(request):
    st = _get_my_student(request)
    if not st:
        return Response({"detail": "Tu usuario no tiene estudiante vinculado."}, status=404)

    f, err = validate_photo_upload(request)
    if err:
        return err

    st.photo = f
    st.save(update_fields=["photo", "updated_at"])
    return Response(StudentSerializer(st, context={"request": request}).data)


# ✅ NUEVO: SYNC para poblar Student desde Users con rol STUDENT
@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def students_sync_from_users(request):
    not_ok = _require_staff(request)
    if not_ok:
        return not_ok

    role = Role.objects.filter(name__iexact="STUDENT").first()
    if not role:
        return Response({"detail": "No existe el rol STUDENT."}, status=400)

    qs = User.objects.filter(roles=role).distinct()

    created = 0
    skipped = 0

    items = []
    for u in qs:
        if hasattr(u, "student_profile"):
            skipped += 1
            continue

        nombres, apellidos = _split_full_name(getattr(u, "full_name", ""), fallback=getattr(u, "username", ""))

        temp_dni = "99" + get_random_string(6, allowed_chars="0123456789")
        temp_cod = "TMP-" + get_random_string(8).upper()

        st = Student.objects.create(
            user=u,
            codigo_estudiante=temp_cod,
            dni=temp_dni,
            nombres=nombres or getattr(u, "username", ""),
            apellidos=apellidos,
            email=getattr(u, "email", "") or "",
            estado="activo",
        )
        created += 1
        items.append({"user_id": u.id, "student_id": st.id, "dni": temp_dni, "codigoEstudiante": temp_cod})

    return Response({"status": "ok", "created": created, "skipped": skipped, "items": items[:50]})
