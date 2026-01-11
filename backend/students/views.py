# backend/students/views.py
from django.contrib.auth import get_user_model
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

User = get_user_model()


def _require_staff(request):
    if not (request.user and request.user.is_authenticated and request.user.is_staff):
        return Response({"detail": "No autorizado."}, status=status.HTTP_403_FORBIDDEN)
    return None


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
        qs = Student.objects.all().order_by("id")

        # ✅ MEJORA: búsqueda por tokens (nombre completo funciona)
        if q:
            terms = [t for t in q.split() if t]
            for term in terms:
                qs = qs.filter(
                    Q(dni__icontains=term)
                    | Q(codigo_estudiante__icontains=term)
                    | Q(nombres__icontains=term)
                    | Q(apellidos__icontains=term)
                )

        data = StudentSerializer(qs, many=True, context={"request": request}).data
        return Response({"students": data})

    ser = StudentUpdateSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    st = ser.save()
    return Response(StudentSerializer(st, context={"request": request}).data, status=status.HTTP_201_CREATED)


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
        return Response({"detail": "Tu usuario no tiene estudiante vinculado."}, status=404)

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
