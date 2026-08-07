# backend/students/views.py
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils.crypto import get_random_string

from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response

from acl.models import Role
from .models import Student
from .name_utils import nombre_oficial, partir_nombre_completo
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
            # M2M directa (User.roles) — es la que lee /auth/me
            st.user.roles.add(student_role)
            # Y también el through explícito de acl por compatibilidad
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

    # Formato oficial "APELLIDOS, NOMBRES" (ver students/name_utils.py)
    full_name = nombre_oficial(st)
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
        # M2M directa (User.roles) — es la que lee /auth/me
        user.roles.add(student_role)
        # Y también el through explícito de acl por compatibilidad
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
    """Compat: delega en students.name_utils.partir_nombre_completo.

    ⚠ Solo para usuarios SIN ficha de estudiante (no hay campos reales de donde
    leer). Nunca usar para sobreescribir apellidos ya cargados: adivina.
    """
    return partir_nombre_completo(full_name, fallback)


# ✅ ADMIN: /students
@api_view(["GET", "POST"])
@permission_classes([permissions.IsAuthenticated])
def students_collection(request):
    not_ok = _require_staff(request)
    if not_ok:
        return not_ok

    if request.method == "GET":
        q = (request.query_params.get("q") or "").strip()
        qs = Student.objects.select_related("plan", "plan__career").order_by("id")

        # Filtrar solo estudiantes con rol STUDENT (excluir admins, secretarias, etc.)
        only_students = request.query_params.get("only_students", "").lower()
        if only_students in ("1", "true", "yes"):
            qs = qs.filter(user__user_roles__role__name="STUDENT")

        # ── Filtros nuevos: carrera, ciclo, periodo ──
        career_id = request.query_params.get("career_id")
        if career_id:
            try:
                qs = qs.filter(plan__career_id=int(career_id))
            except (TypeError, ValueError):
                pass

        ciclo = request.query_params.get("ciclo")
        if ciclo:
            try:
                qs = qs.filter(ciclo=int(ciclo))
            except (TypeError, ValueError):
                pass

        periodo = (request.query_params.get("periodo") or "").strip()
        if periodo:
            qs = qs.filter(periodo=periodo)

        # ── Filtro "incompletos": alumnos sin fecha_nac, sin sexo, sin email ──
        # útil para auditar quién necesita completar datos
        incomplete = (request.query_params.get("incomplete") or "").lower() in ("1", "true", "yes")
        if incomplete:
            qs = qs.filter(
                Q(fecha_nac__isnull=True)
                | Q(sexo__isnull=True) | Q(sexo="")
                | Q(nombres__isnull=True) | Q(nombres="")
                | Q(apellido_paterno__isnull=True) | Q(apellido_paterno="")
            )

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
        # Anotar cuáles tienen datos incompletos (para badges en UI)
        for st_data, st_obj in zip(data, qs):
            missing = []
            if not getattr(st_obj, "fecha_nac", None):
                missing.append("fecha_nac")
            if not (getattr(st_obj, "sexo", "") or "").strip():
                missing.append("sexo")
            if not (getattr(st_obj, "nombres", "") or "").strip():
                missing.append("nombres")
            if not (getattr(st_obj, "apellido_paterno", "") or "").strip():
                missing.append("apellido_paterno")
            st_data["data_incomplete"] = bool(missing)
            st_data["missing_fields"] = missing

        return Response({"students": data, "total": len(data)})

    ser = StudentUpdateSerializer(data=request.data)
    ser.is_valid(raise_exception=True)

    # Validación adicional: nombres y apellido paterno requeridos en creación
    if not (request.data.get("nombres") or "").strip():
        return Response(
            {"nombres": ["Los nombres son obligatorios."]},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if not (request.data.get("apellidoPaterno") or "").strip():
        return Response(
            {"apellidoPaterno": ["El apellido paterno es obligatorio."]},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if not (request.data.get("numDocumento") or "").strip():
        return Response(
            {"numDocumento": ["El DNI es obligatorio."]},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        with transaction.atomic():
            st = ser.save()
            # Auto-crear usuario con contraseña temporal
            user, temp_password = _create_user_for_student(st)
    except IntegrityError as e:
        msg = str(e).lower()
        if "num_documento" in msg or "students_student.num_documento" in msg:
            return Response(
                {
                    "numDocumento": [
                        "Ya existe un estudiante con ese DNI. "
                        "Búscalo por DNI en la lista para asignarle notas."
                    ],
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            {"detail": f"Error de integridad al crear estudiante: {e}"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    except Exception as e:
        return Response(
            {"detail": f"Error creando estudiante: {e}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    data = StudentSerializer(st, context={"request": request}).data
    if temp_password and user:
        data["_credentials"] = {
            "username": user.username,
            "tempPassword": temp_password,
        }

    return Response(data, status=status.HTTP_201_CREATED)


# ════════════════════════════════════════════════════════════════════
#  /students/matrix — matriz carrera × ciclo con conteo de matriculados
# ════════════════════════════════════════════════════════════════════
@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def students_matrix(request):
    """
    GET /api/students/matrix?periodo=2026-I
    Devuelve una matriz carrera × ciclo con cantidad de alumnos.
    Query opcional:
      - periodo: filtra Student.periodo
      - only_students=1: solo cuentas con rol STUDENT
      - only_enrolled=1: solo los que tienen Enrollment CONFIRMED en el periodo
    Respuesta:
      {
        "periodo": "2026-I",
        "careers": [
          {"id": 5, "name": "EDUCACIÓN INICIAL",
           "cycles": {"1": 23, "2": 18, ..., "10": 8},
           "total": 145},
          ...
        ],
        "totals_by_cycle": {"1": 64, "2": 52, ...},
        "grand_total": 1305
      }
    """
    not_ok = _require_staff(request)
    if not_ok:
        return not_ok

    from collections import defaultdict
    from django.db.models import Count

    periodo = (request.query_params.get("periodo") or "").strip()
    only_students = (request.query_params.get("only_students") or "").lower() in ("1","true","yes")
    only_enrolled = (request.query_params.get("only_enrolled") or "").lower() in ("1","true","yes")

    qs = Student.objects.select_related("plan", "plan__career")
    if only_students:
        qs = qs.filter(user__user_roles__role__name="STUDENT")

    if only_enrolled and periodo:
        # Requiere matrícula CONFIRMED en ese periodo
        try:
            from academic.models import Enrollment
            qs = qs.filter(
                enrollments__period=periodo,
                enrollments__status=Enrollment.STATUS_CONFIRMED,
            ).distinct()
        except Exception:
            pass
    elif periodo:
        qs = qs.filter(periodo=periodo)

    # Agregar por (career_id, career_name, ciclo)
    rows = (
        qs.values("plan__career_id", "plan__career__name", "ciclo")
          .annotate(n=Count("id", distinct=True))
    )

    careers_by_id = {}
    totals_by_cycle = defaultdict(int)
    grand_total = 0
    for r in rows:
        cid = r["plan__career_id"] or 0
        cname = r["plan__career__name"] or "(sin carrera)"
        cyc = int(r["ciclo"] or 0)
        n = int(r["n"] or 0)
        if cid not in careers_by_id:
            careers_by_id[cid] = {"id": cid, "name": cname, "cycles": {}, "total": 0}
        careers_by_id[cid]["cycles"][str(cyc)] = n
        careers_by_id[cid]["total"] += n
        totals_by_cycle[str(cyc)] += n
        grand_total += n

    # Ordenar
    careers = sorted(careers_by_id.values(), key=lambda c: c["name"] or "")
    return Response({
        "periodo": periodo,
        "careers": careers,
        "totals_by_cycle": dict(totals_by_cycle),
        "grand_total": grand_total,
    })


# ════════════════════════════════════════════════════════════════════
#  /students/missing-data — resumen rápido de alumnos con datos faltantes
# ════════════════════════════════════════════════════════════════════
@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def students_missing_data(request):
    """
    GET /api/students/missing-data
    Devuelve un resumen y la lista de alumnos sin fecha_nac, sin sexo
    o con nombres/apellidos vacíos — para que el admin sepa a quién
    completar primero. Acepta filtros career_id, ciclo, periodo.
    """
    not_ok = _require_staff(request)
    if not_ok:
        return not_ok

    qs = Student.objects.select_related("plan", "plan__career")

    career_id = request.query_params.get("career_id")
    if career_id:
        try: qs = qs.filter(plan__career_id=int(career_id))
        except (TypeError, ValueError): pass
    ciclo = request.query_params.get("ciclo")
    if ciclo:
        try: qs = qs.filter(ciclo=int(ciclo))
        except (TypeError, ValueError): pass
    periodo = (request.query_params.get("periodo") or "").strip()
    if periodo:
        qs = qs.filter(periodo=periodo)

    incomplete = qs.filter(
        Q(fecha_nac__isnull=True)
        | Q(sexo__isnull=True) | Q(sexo="")
        | Q(nombres__isnull=True) | Q(nombres="")
        | Q(apellido_paterno__isnull=True) | Q(apellido_paterno="")
    ).order_by("plan__career__name", "ciclo", "apellido_paterno")

    out = []
    for st in incomplete:
        missing = []
        if not st.fecha_nac: missing.append("fecha_nac")
        if not (st.sexo or "").strip(): missing.append("sexo")
        if not (st.nombres or "").strip(): missing.append("nombres")
        if not (st.apellido_paterno or "").strip(): missing.append("apellido_paterno")
        out.append({
            "id": st.id,
            "dni": st.num_documento,
            "nombres": st.nombres or "",
            "apellido_paterno": st.apellido_paterno or "",
            "apellido_materno": st.apellido_materno or "",
            "carrera": (st.plan.career.name if st.plan and st.plan.career else ""),
            "ciclo": st.ciclo,
            "missing": missing,
        })

    return Response({
        "total_incompletos": len(out),
        "students": out,
    })


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

    # Sincronizar datos del Student → User
    # El nombre lo sincroniza la señal post_save del Student
    # (students/signals.py) con el formato oficial "APELLIDOS, NOMBRES";
    # aquí solo quedan email y username.
    if st.user:
        user_dirty = False
        dirty_fields = []

        # ── Email (respetando unique del User) ──
        if st.email and st.user.email != st.email:
            if not User.objects.filter(email__iexact=st.email).exclude(pk=st.user.pk).exists():
                st.user.email = st.email
                user_dirty = True
                dirty_fields.append("email")

        # ── Username = DNI (respetando unique) ──
        new_doc = st.num_documento or ""
        if new_doc and st.user.username != new_doc:
            old_username = st.user.username
            if old_username.isdigit() or old_username.startswith("TMP-"):
                if not User.objects.filter(username=new_doc).exclude(pk=st.user.pk).exists():
                    st.user.username = new_doc
                    user_dirty = True
                    dirty_fields.append("username")

        if user_dirty and dirty_fields:
            try:
                st.user.save(update_fields=dirty_fields)
            except Exception:
                # No romper el PATCH si la sincronización User falla
                pass

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

    # Sincronizar datos del Student → User para mantener consistencia.
    # FIX: antes escribía `st.user.first_name`, campo que este User
    # (AbstractBaseUser) NO tiene → AttributeError y 500 en cada guardado,
    # después de que el Student ya se había grabado. El nombre lo sincroniza
    # ahora la señal post_save del Student (students/signals.py).
    if st.user:
        user_dirty = False
        update_fields = []
        # Email
        if st.email and st.user.email != st.email:
            st.user.email = st.email
            update_fields.append("email")
            user_dirty = True
        # Username = DNI (solo si username actual es numérico o TMP-)
        new_doc = st.num_documento or ""
        if new_doc and st.user.username != new_doc:
            old_username = st.user.username
            if old_username.isdigit() or old_username.startswith("TMP-"):
                if not User.objects.filter(username=new_doc).exclude(pk=st.user.pk).exists():
                    st.user.username = new_doc
                    update_fields.append("username")
                    user_dirty = True
        if user_dirty and update_fields:
            try:
                st.user.save(update_fields=update_fields)
            except Exception:
                pass   # no romper el PATCH del alumno por la sincronización

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
