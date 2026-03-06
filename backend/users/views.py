# backend/users/views.py
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db.models import Q
from django.utils.crypto import get_random_string

from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from acl.models import UserRole, Role
from .serializers import UserSerializer, UserCreateSerializer, UserUpdateSerializer
from django.db import transaction

from django.db.models.deletion import ProtectedError
from django.db import IntegrityError

from academic.models import (
    AcademicGradeRecord,
    AcademicProcess,
    ProcessFile,
    AttendanceRow,
    SectionGrades,
)

from students.models import Student

User = get_user_model()


def _qs_users_by_role_name(role_name: str):
    role_name = (role_name or "").strip()
    if not role_name:
        return User.objects.none()

    role_ids = list(Role.objects.filter(name__iexact=role_name).values_list("id", flat=True))
    if not role_ids:
        return User.objects.none()

    user_ids = (
        UserRole.objects
        .filter(role_id__in=role_ids)
        .values_list("user_id", flat=True)
        .distinct()
    )
    return User.objects.filter(id__in=user_ids)


# ---------- permisos ----------
class IsAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return request.user and request.user.is_authenticated
        return request.user and request.user.is_authenticated and request.user.is_staff


def _has_role(user, role_name: str) -> bool:
    if not user or not user.is_authenticated:
        return False

    if getattr(user, "is_superuser", False) or getattr(user, "is_staff", False):
        return True

    try:
        if hasattr(user, "roles") and user.roles.filter(name__iexact=role_name).exists():
            return True
    except Exception:
        pass

    try:
        return UserRole.objects.filter(user=user, role__name__iexact=role_name).exists()
    except Exception:
        return False


def _require_staff(request):
    # ✅ STAFF o ADMIN_ACADEMIC
    if _has_role(request.user, "ADMIN_ACADEMIC"):
        return None
    return Response({"detail": "No autorizado."}, status=status.HTTP_403_FORBIDDEN)


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


def _ensure_student_for_user(user: User):
    if hasattr(user, "student_profile"):
        return None

    username = getattr(user, "username", "") or ""
    email = getattr(user, "email", "") or ""
    full_name = getattr(user, "full_name", "") or username

    nombres, apellidos = _split_full_name(full_name, fallback=username)
    temp_doc = username[:12] if username else "TMP-" + get_random_string(9).upper()

    ap_parts = apellidos.split() if apellidos else []
    ap_pat = ap_parts[0] if len(ap_parts) >= 1 else ""
    ap_mat = " ".join(ap_parts[1:]) if len(ap_parts) >= 2 else ""

    st = Student.objects.create(
        user=user,
        num_documento=temp_doc,
        nombres=nombres or username,
        apellido_paterno=ap_pat,
        apellido_materno=ap_mat,
        email=email,
    )
    return st


# ===================== PAGINACIÓN SIMPLE =====================
def _int_param(request, key, default):
    raw = request.query_params.get(key, None)
    if raw is None or raw == "":
        return default
    try:
        return int(raw)
    except (TypeError, ValueError):
        return default


def _paginate_queryset(request, qs, default_page_size=10, max_page_size=100):
    page = _int_param(request, "page", 1)
    page_size = _int_param(request, "page_size", default_page_size)

    # saneo
    if page < 1:
        page = 1
    if page_size < 1:
        page_size = default_page_size
    if page_size > max_page_size:
        page_size = max_page_size

    total = qs.count()
    start = (page - 1) * page_size
    end = start + page_size

    items = qs[start:end]

    # next/previous como números (simple para front)
    next_page = page + 1 if end < total else None
    prev_page = page - 1 if page > 1 else None

    return {
        "count": total,
        "page": page,
        "page_size": page_size,
        "next": next_page,
        "previous": prev_page,
        "items": items,
    }


# ---------- AUTH ----------
@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def change_password(request):
    """
    Cambia la contraseña del usuario logueado (self-service).
    POST /api/auth/change-password
    body: { current_password, new_password }
    """
    u = request.user
    current_password = (request.data.get("current_password") or "").strip()
    new_password = (request.data.get("new_password") or "").strip()

    if not current_password or not new_password:
        return Response({"detail": "Faltan campos."}, status=status.HTTP_400_BAD_REQUEST)

    if not u.check_password(current_password):
        return Response({"detail": "Contraseña actual incorrecta."}, status=status.HTTP_400_BAD_REQUEST)

    # política Django (si tienes AUTH_PASSWORD_VALIDATORS)
    try:
        validate_password(new_password, user=u)
    except ValidationError as e:
        return Response({"detail": " ".join(e.messages)}, status=status.HTTP_400_BAD_REQUEST)

    u.set_password(new_password)
    if hasattr(u, "must_change_password"):
        u.must_change_password = False
        u.save(update_fields=["password", "must_change_password"])
    else:
        u.save(update_fields=["password"])

    return Response({"status": "password_changed"})


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def auth_me(request):
    u = request.user

    # roles seguros
    try:
        roles = list(u.roles.values_list("name", flat=True))
    except Exception:
        roles = []

    # permissions seguros (NO rompe auth/me)
    perm_codes = []
    try:
        perm_codes = list(u.roles.values_list("permissions__code", flat=True).distinct())
    except Exception:
        perm_codes = []

    # student_profile seguro
    student_id = None
    try:
        student_id = u.student_profile.id
    except Exception:
        student_id = None

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
        "must_change_password": getattr(u, "must_change_password", False),
    })


# ✅ ---------- USERS (COLLECTION) ----------
@api_view(["GET", "POST"])
@permission_classes([permissions.IsAuthenticated])
def users_collection(request):
    """
    GET  /api/users?q=...&page=1&page_size=10
    POST /api/users      (solo staff)
    """
    # ----- GET (PAGINADO) -----
    if request.method == "GET":
        q = (request.query_params.get("q") or "").strip()

        qs = User.objects.all().order_by("id")
        if q:
            qs = qs.filter(
                Q(username__icontains=q) |
                Q(email__icontains=q) |
                Q(full_name__icontains=q)
            )

        pag = _paginate_queryset(request, qs, default_page_size=10, max_page_size=100)
        ser = UserSerializer(pag["items"], many=True)

        return Response({
            "count": pag["count"],
            "page": pag["page"],
            "page_size": pag["page_size"],
            "next": pag["next"],
            "previous": pag["previous"],
            "results": ser.data,
        })

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
    DELETE = eliminación REAL del usuario (si DB lo permite). NO purge.
    """
    not_ok = _require_staff(request)
    if not_ok:
        return not_ok

    try:
        user = User.objects.get(pk=pk)
    except User.DoesNotExist:
        return Response({"detail": "No existe."}, status=status.HTTP_404_NOT_FOUND)

    # ✅ DELETE (eliminación real, con manejo de errores para no dar 500)
    if request.method == "DELETE":
        if request.user.id == pk:
            return Response({"detail": "No puedes eliminarte a ti mismo."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                # Desvincular Teacher records antes de eliminar (evita ProtectedError)
                try:
                    from catalogs.models import Teacher as CatalogTeacher
                    CatalogTeacher.objects.filter(user_id=pk).update(user=None)
                except Exception:
                    pass
                try:
                    from academic.models import Teacher as AcademicTeacher
                    AcademicTeacher.objects.filter(user_id=pk).update(user=None)
                except Exception:
                    pass

                user.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        except ProtectedError as e:
            sample = [str(x) for x in list(e.protected_objects)[:10]]
            return Response({
                "detail": "No se puede eliminar este usuario porque tiene registros relacionados protegidos. "
                          "Si es un estudiante y quieres borrar también su data académica, usa el botón 'Purge estudiantes'.",
                "protected_sample": sample,
            }, status=status.HTTP_409_CONFLICT)

        except IntegrityError:
            return Response({
                "detail": "No se puede eliminar este usuario por integridad referencial en la base de datos. "
                          "Usa el botón 'Purge estudiantes' si corresponde."
            }, status=status.HTTP_409_CONFLICT)

        except Exception as ex:
            return Response({
                "detail": "Error inesperado al eliminar el usuario.",
                "error": str(ex)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # PUT/PATCH
    partial = (request.method == "PATCH")
    ser = UserUpdateSerializer(user, data=request.data, partial=partial)
    ser.is_valid(raise_exception=True)
    user = ser.save()
    return Response(UserSerializer(user).data)


# ✅ ---------- BÚSQUEDA (ALIAS PAGINADO) ----------
@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def users_search(request):
    """
    GET /api/users/search?q=...&page=1&page_size=10
    Alias paginado del listado.
    """
    q = (request.query_params.get("q") or "").strip()

    qs = User.objects.all().order_by("id")
    if q:
        qs = qs.filter(
            Q(username__icontains=q) |
            Q(email__icontains=q) |
            Q(full_name__icontains=q)
        )

    pag = _paginate_queryset(request, qs, default_page_size=10, max_page_size=100)
    ser = UserSerializer(pag["items"], many=True)

    return Response({
        "count": pag["count"],
        "page": pag["page"],
        "page_size": pag["page_size"],
        "next": pag["next"],
        "previous": pag["previous"],
        "results": ser.data,
    })


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def users_deactivate(request, pk: int):
    not_ok = _require_staff(request)
    if not_ok:
        return not_ok

    try:
        user = User.objects.get(pk=pk)
    except User.DoesNotExist:
        return Response({"detail": "No existe."}, status=status.HTTP_404_NOT_FOUND)

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
        return Response({"detail": "No existe."}, status=status.HTTP_404_NOT_FOUND)

    user.is_active = True
    user.save(update_fields=["is_active"])
    return Response({"status": "activated"})


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def users_reset_password(request, pk: int):
    """
    Admin reset: genera temporal + must_change_password=True
    """
    not_ok = _require_staff(request)
    if not_ok:
        return not_ok

    try:
        user = User.objects.get(pk=pk)
    except User.DoesNotExist:
        return Response({"detail": "No existe."}, status=status.HTTP_404_NOT_FOUND)

    tmp = get_random_string(10)
    user.set_password(tmp)
    if hasattr(user, "must_change_password"):
        user.must_change_password = True
        user.save(update_fields=["password", "must_change_password"])
    else:
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
        return Response({"detail": "roles must be a list"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = User.objects.get(pk=pk)
    except User.DoesNotExist:
        return Response({"detail": "No existe."}, status=status.HTTP_404_NOT_FOUND)

    if not hasattr(user, "roles"):
        return Response({"detail": "Este modelo User no tiene roles."}, status=status.HTTP_400_BAD_REQUEST)

    role_objs = []
    for name in roles:
        r, _ = Role.objects.get_or_create(name=str(name).strip())
        role_objs.append(r)

    user.roles.set(role_objs)

    # ✅ si se asigna STUDENT, crear Student automáticamente
    role_names = [r.name.upper() for r in role_objs]
    if "STUDENT" in role_names:
        _ensure_student_for_user(user)

    return Response({"status": "roles_assigned", "roles": [r.name for r in role_objs]})


# ✅ ---------- ADMIN SET PASSWORD (OPCIÓN B) ----------
@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def users_set_password(request, pk: int):
    """
    Admin set password (NO requiere actual).
    POST /api/users/<id>/set-password
    body: { new_password, confirm_password }
    - must_change_password=True
    """
    not_ok = _require_staff(request)
    if not_ok:
        return not_ok

    try:
        user = User.objects.get(pk=pk)
    except User.DoesNotExist:
        return Response({"detail": "No existe."}, status=status.HTTP_404_NOT_FOUND)

    new_password = (request.data.get("new_password") or "").strip()
    confirm_password = (request.data.get("confirm_password") or "").strip()

    errors = {}
    if not new_password:
        errors["new_password"] = "La nueva contraseña es obligatoria."
    if not confirm_password:
        errors["confirm_password"] = "Confirma la nueva contraseña."
    if errors:
        return Response({"errors": errors}, status=status.HTTP_400_BAD_REQUEST)

    if new_password != confirm_password:
        return Response({"errors": {"confirm_password": "La confirmación no coincide."}}, status=status.HTTP_400_BAD_REQUEST)

    try:
        validate_password(new_password, user=user)
    except ValidationError as e:
        return Response({"errors": {"new_password": list(e.messages)}}, status=status.HTTP_400_BAD_REQUEST)

    user.set_password(new_password)

    if hasattr(user, "must_change_password"):
        user.must_change_password = True
        user.save(update_fields=["password", "must_change_password"])
    else:
        user.save(update_fields=["password"])

    return Response({"status": "password_set", "must_change_password": getattr(user, "must_change_password", False)})


def _purge_one_student(user_obj: User):
    """
    Borra todo lo de un estudiante (eliminación total):
    - AcademicGradeRecord por student_profile
    - Enrollment + EnrollmentItem + EnrollmentPayment (por student)
    - AcademicProcess + ProcessFile (por student_id = Student.id)
    - AttendanceRow (por student_id = user.id)
    - SectionGrades.grades: elimina llave str(user.id)
    - Student profile
    - Teacher records (catalogs + academic) si existen
    - UserRole
    - User
    Retorna conteos.
    """
    counts = {
        "grade_records": 0,
        "enrollments": 0,
        "enrollment_payments": 0,
        "processes": 0,
        "process_files": 0,
        "attendance_rows": 0,
        "section_grades_touched": 0,
        "student_profiles": 0,
        "teachers_unlinked": 0,
        "user_roles": 0,
        "users": 0,
    }

    uid = int(user_obj.id)

    st = None
    try:
        st = user_obj.student_profile
    except Exception:
        st = None

    # ── 1. Grade records ──
    if st:
        counts["grade_records"] = AcademicGradeRecord.objects.filter(student=st).delete()[0]

    # ── 2. Enrollments (y sus items / payments) ──
    if st:
        try:
            from academic.models import Enrollment, EnrollmentPayment
            counts["enrollment_payments"] = EnrollmentPayment.objects.filter(student=st).delete()[0]
            counts["enrollments"] = Enrollment.objects.filter(student=st).delete()[0]
        except Exception:
            pass

    # ── 3. Processes + files ──
    if st:
        proc_ids = list(AcademicProcess.objects.filter(student_id=st.id).values_list("id", flat=True))
        if proc_ids:
            counts["process_files"] = ProcessFile.objects.filter(process_id__in=proc_ids).delete()[0]
        counts["processes"] = AcademicProcess.objects.filter(student_id=st.id).delete()[0]

    # ── 4. Attendance rows ──
    counts["attendance_rows"] = AttendanceRow.objects.filter(student_id=uid).delete()[0]

    # ── 5. Section grades (JSON key) ──
    key = str(uid)
    touched = 0
    try:
        bundles = SectionGrades.objects.filter(grades__has_key=key)  # noqa
    except Exception:
        bundles = SectionGrades.objects.all()

    for b in bundles:
        g = b.grades or {}
        if key in g:
            g.pop(key, None)
            b.grades = g
            b.save(update_fields=["grades", "updated_at"])
            touched += 1

    counts["section_grades_touched"] = touched

    # ── 6. Student profile ──
    if st:
        counts["student_profiles"] = Student.objects.filter(id=st.id).delete()[0]

    # ── 7. Desvincular Teacher records (PROTECT → SET_NULL ya aplicado,
    #        pero por seguridad desvinculamos explícitamente) ──
    try:
        from catalogs.models import Teacher as CatalogTeacher
        n = CatalogTeacher.objects.filter(user_id=uid).update(user=None)
        counts["teachers_unlinked"] += n
    except Exception:
        pass
    try:
        from academic.models import Teacher as AcademicTeacher
        n = AcademicTeacher.objects.filter(user_id=uid).update(user=None)
        counts["teachers_unlinked"] += n
    except Exception:
        pass

    # ── 8. Desvincular Applicant (admission) ──
    try:
        from admission.models import Applicant
        Applicant.objects.filter(user_id=uid).update(user=None)
    except Exception:
        pass

    # ── 9. UserRole ──
    counts["user_roles"] = UserRole.objects.filter(user_id=uid).delete()[0]

    # ── 10. User (final) ──
    counts["users"] = User.objects.filter(id=uid).delete()[0]

    return counts


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def users_purge(request):
    """
    POST /api/users/purge

    body:
    {
      "mode": "role" | "ids",
      "role": "STUDENT",          # si mode=role
      "user_ids": [1,2,3],        # si mode=ids
      "dry_run": true|false
    }

    - Solo STAFF o ADMIN_ACADEMIC
    - Por seguridad: NO permite borrarte a ti mismo
    """
    not_ok = _require_staff(request)
    if not_ok:
        return not_ok

    body = request.data or {}
    mode = (body.get("mode") or "").strip().lower()
    dry_run = bool(body.get("dry_run", False))

    if mode not in ("role", "ids"):
        return Response({"detail": "mode inválido. Usa 'role' o 'ids'."}, status=status.HTTP_400_BAD_REQUEST)

    if mode == "role":
        role = (body.get("role") or "").strip()
        if not role:
            return Response({"detail": "role es requerido cuando mode=role"}, status=status.HTTP_400_BAD_REQUEST)
        qs = _qs_users_by_role_name(role)
    else:
        user_ids = body.get("user_ids") or []
        if not isinstance(user_ids, list) or not user_ids:
            return Response({"detail": "user_ids debe ser lista no vacía cuando mode=ids"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            user_ids = [int(x) for x in user_ids]
        except Exception:
            return Response({"detail": "user_ids inválidos"}, status=status.HTTP_400_BAD_REQUEST)
        qs = User.objects.filter(id__in=user_ids)

    qs = qs.exclude(id=request.user.id)

    safe_targets = list(qs)

    if not safe_targets:
        return Response({
            "dry_run": dry_run,
            "targets": 0,
            "message": "No hay usuarios para purgar (o intentaste borrar tu propio usuario)."
        })

    if dry_run:
        preview = []
        for u in safe_targets[:200]:
            preview.append({
                "id": u.id,
                "username": getattr(u, "username", ""),
                "email": getattr(u, "email", ""),
                "full_name": getattr(u, "full_name", ""),
            })
        return Response({
            "dry_run": True,
            "targets": len(safe_targets),
            "sample": preview,
            "message": "Vista previa. Enviar dry_run=false para ejecutar."
        })

    totals = {
        "grade_records": 0,
        "enrollments": 0,
        "enrollment_payments": 0,
        "processes": 0,
        "process_files": 0,
        "attendance_rows": 0,
        "section_grades_touched": 0,
        "student_profiles": 0,
        "teachers_unlinked": 0,
        "user_roles": 0,
        "users": 0,
    }

    errors = []

    with transaction.atomic():
        for u in safe_targets:
            try:
                c = _purge_one_student(u)
                for k in totals:
                    totals[k] += int(c.get(k, 0) or 0)
            except Exception as ex:
                errors.append({
                    "user_id": u.id,
                    "username": getattr(u, "username", ""),
                    "error": str(ex),
                })

    if errors and totals["users"] == 0:
        return Response({
            "dry_run": False,
            "targets": len(safe_targets),
            "deleted": totals,
            "errors": errors,
            "message": f"Purge falló para {len(errors)} usuario(s). Revisa los errores."
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    return Response({
        "dry_run": False,
        "targets": len(safe_targets),
        "deleted": totals,
        "errors": errors if errors else None,
        "message": f"Purge ejecutado. {totals['users']} usuario(s) eliminado(s)."
    })
