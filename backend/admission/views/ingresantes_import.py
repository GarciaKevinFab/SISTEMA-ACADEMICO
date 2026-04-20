"""
admission/views/ingresantes_import.py

Importador de ingresantes desde Excel oficial del proceso de admisión.

Flujo:
  1. Lee un Excel con columnas: Carrera, DNI, Ap.Paterno, Ap.Materno, Nombres,
     Promedio Final, Condición, Fecha Registro, Discapacidad
  2. Para cada fila con "ALCANZÓ VACANTE":
     - Busca/crea Applicant (admission) por DNI
     - Busca/crea Application (admission) asociada a la convocatoria (call_id)
       y marca status=ADMITTED
     - Crea/actualiza Student (students) con los datos
     - Crea un User con rol STUDENT y contraseña = DNI (el usuario la cambia
       al entrar por primera vez)
  3. Retorna reporte con creados / actualizados / errores + credenciales
"""
import io
import logging
from datetime import datetime

from django.db import transaction
from openpyxl import load_workbook
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from admission.models import AdmissionCall, Applicant, Application, ApplicationPreference
from students.models import Student
from students.views import _create_user_for_student
from catalogs.models import Career

try:
    from catalogs.helpers import match_career_robust, career_base_name
except ImportError:
    def match_career_robust(name):
        return Career.objects.filter(name__iexact=(name or "").strip()).first()
    def career_base_name(full_name):
        import re
        s = (full_name or "").strip().upper()
        s = re.sub(r"\s*\([^)]*\)\s*", "", s).strip()
        return s


logger = logging.getLogger("admission.ingresantes")

# ── Columnas esperadas del Excel (índices 0-based) ──
COL_CARRERA = 0
COL_DNI = 1
COL_AP_PAT = 2
COL_AP_MAT = 3
COL_NOMBRES = 4
COL_PROMEDIO = 5
COL_CONDICION = 6
COL_FECHA = 7
COL_DISCAPACIDAD = 8


def _is_admitted(condicion: str) -> bool:
    """True si la fila indica que alcanzó vacante."""
    s = (str(condicion) if condicion is not None else "").upper()
    import unicodedata
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    return ("ALCANZO" in s and "VACANTE" in s) or "INGRESANTE" in s or "ADMITIDO" in s


def _clean_str(v, default="") -> str:
    if v is None:
        return default
    s = str(v).strip()
    return s if s else default


def _get_or_create_applicant(dni, nombres, ap_pat, ap_mat, email=""):
    """Busca Applicant por DNI, crea si no existe."""
    full_name = " ".join(x for x in [nombres, ap_pat, ap_mat] if x).strip()
    app, created = Applicant.objects.get_or_create(
        dni=dni,
        defaults={
            "names": full_name[:120],
            "email": email or "",
            "phone": "",
        },
    )
    if not created:
        # Actualizar nombre si cambió
        if full_name and app.names != full_name:
            app.names = full_name[:120]
            app.save(update_fields=["names"])
    return app, created


def _get_or_create_application(applicant, call, career, career_name_raw, modalidad="ORDINARIO"):
    """Busca Application por (applicant, call), crea si no existe. Setea ADMITTED."""
    app = Application.objects.filter(applicant=applicant, call=call).first()
    created = False
    if not app:
        app = Application.objects.create(
            applicant=applicant,
            call=call,
            career_name=(career.name if career else career_name_raw) or "",
            status="ADMITTED",
            data={
                "profile": {
                    "nombres": applicant.names.split(" ")[0] if applicant.names else "",
                    "dni": applicant.dni,
                    "modalidad_admision": modalidad,
                },
                "source": "IMPORT_INGRESANTES",
            },
        )
        created = True
    else:
        app.status = "ADMITTED"
        if career and not app.career_name:
            app.career_name = career.name
        app.save(update_fields=["status", "career_name"])

    # Asegurar preferencia con la carrera
    if career:
        ApplicationPreference.objects.get_or_create(
            application=app, career=career, defaults={"rank": 1}
        )
    return app, created


def _upsert_student(dni, nombres, ap_pat, ap_mat, career_name, discapacidad_si):
    """Crea o actualiza Student. Retorna (student, created)."""
    st = Student.objects.filter(num_documento=dni).first()
    created = False
    discap = "SI" if discapacidad_si else "NO"

    if not st:
        st = Student.objects.create(
            num_documento=dni,
            nombres=nombres,
            apellido_paterno=ap_pat,
            apellido_materno=ap_mat,
            programa_carrera=career_name,
            discapacidad=discap,
        )
        created = True
    else:
        dirty = []
        if nombres and st.nombres != nombres:
            st.nombres = nombres
            dirty.append("nombres")
        if ap_pat and st.apellido_paterno != ap_pat:
            st.apellido_paterno = ap_pat
            dirty.append("apellido_paterno")
        if ap_mat and st.apellido_materno != ap_mat:
            st.apellido_materno = ap_mat
            dirty.append("apellido_materno")
        if career_name and st.programa_carrera != career_name:
            st.programa_carrera = career_name
            dirty.append("programa_carrera")
        if st.discapacidad != discap:
            st.discapacidad = discap
            dirty.append("discapacidad")
        if dirty:
            st.save(update_fields=dirty)
    return st, created


def _generate_temp_password(length=10):
    """Contraseña temporal: 8 alfanuméricos + 1 dígito + '!'."""
    from django.utils.crypto import get_random_string
    import string
    body = get_random_string(length - 2, allowed_chars=string.ascii_letters + string.digits)
    tail = get_random_string(1, allowed_chars=string.digits) + "!"
    return body + tail


def _ensure_user_with_temp_password(student):
    """Crea un User con username=DNI y contraseña temporal aleatoria
    (si aún no tiene). Retorna (user, temp_password or None, was_created)."""
    if student.user_id:
        # Ya tiene usuario: aseguramos rol STUDENT sin resetear password
        user, _ = _create_user_for_student(student)
        return user, None, False

    from django.contrib.auth import get_user_model
    from acl.models import Role, UserRole
    User = get_user_model()

    username = student.num_documento
    k = 1
    uname = username
    while User.objects.filter(username=uname).exists():
        k += 1
        uname = f"{username}-{k}"

    full_name = " ".join(x for x in [student.nombres, student.apellido_paterno, student.apellido_materno] if x).strip()
    user = User(username=uname, is_active=True, is_staff=False)

    # Email sintético si no hay
    try:
        User._meta.get_field("email")
        user.email = (student.email or "").strip().lower() or f"{uname}@no-email.local"
    except Exception:
        pass

    if hasattr(user, "full_name"):
        user.full_name = full_name
    elif hasattr(user, "first_name"):
        user.first_name = full_name[:150]

    # Contraseña temporal aleatoria
    temp_password = _generate_temp_password()
    user.set_password(temp_password)
    user.save()

    # Asignar rol STUDENT
    student_role = Role.objects.filter(name__iexact="STUDENT").first()
    if student_role:
        UserRole.objects.get_or_create(user_id=user.id, role_id=student_role.id)

    # Vincular al estudiante
    student.user = user
    student.save(update_fields=["user"])

    return user, temp_password, True


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def ingresantes_import(request):
    """
    POST /admission/ingresantes/import
    Body (multipart):
      - file: archivo .xlsx
      - call_id: id de la convocatoria (opcional — si no viene, se usa la
                 más reciente; si no hay ninguna, se crea una automática)
      - modalidad: modalidad de admisión (opcional, default ORDINARIO)
      - dry_run: "1" para simular sin guardar (opcional)

    Respuesta:
      {
        "summary": {"total_rows": N, "admitted": X, "created_students": Y,
                    "updated_students": Z, "created_users": W, "errors": E},
        "credentials": [{"dni": "...", "username": "...", "password": "..."}],
        "errors": [{"row": N, "dni": "...", "reason": "..."}]
      }
    """
    file = request.FILES.get("file")
    if not file:
        return Response({"detail": "Falta archivo 'file'"}, status=400)

    call_id = request.data.get("call_id")
    call = None
    if call_id:
        try:
            call = AdmissionCall.objects.get(pk=call_id)
        except AdmissionCall.DoesNotExist:
            return Response({"detail": "Convocatoria no encontrada"}, status=404)
    else:
        # Usar la más reciente; si no existe, crear una automática
        call = AdmissionCall.objects.order_by("-id").first()
        if not call:
            call = AdmissionCall.objects.create(
                title="Proceso de Admisión (auto)",
                period="",
                published=False,
                meta={"source": "auto-ingresantes-import"},
            )

    modalidad = _clean_str(request.data.get("modalidad"), "ORDINARIO")
    dry_run = str(request.data.get("dry_run", "")).lower() in ("1", "true", "yes")

    # Leer workbook
    try:
        wb = load_workbook(io.BytesIO(file.read()), data_only=True)
        ws = wb.active
    except Exception as exc:
        return Response({"detail": f"No se pudo leer el Excel: {exc}"}, status=400)

    # Recolectar filas (con forward-fill de la carrera)
    rows = []
    current_career_name = None
    header_seen = False
    for row_idx, row in enumerate(ws.iter_rows(values_only=True), start=1):
        # Detectar encabezado "Carrera / Especialidad"
        if not header_seen:
            if row and any("CARRERA" in str(c).upper() for c in row if c):
                header_seen = True
                continue
            if row and any(c for c in row):
                # Puede ser primera fila ya con datos, pero típicamente es vacía
                continue
            continue

        if not row or all(c is None or str(c).strip() == "" for c in row):
            continue

        carrera_raw = row[COL_CARRERA] if len(row) > COL_CARRERA else None
        if carrera_raw and str(carrera_raw).strip():
            current_career_name = str(carrera_raw).strip()

        dni_raw = row[COL_DNI] if len(row) > COL_DNI else None
        if not dni_raw:
            continue
        dni = str(dni_raw).strip().replace(".0", "")
        if not dni.isdigit():
            continue

        rows.append({
            "row_idx": row_idx,
            "carrera_raw": current_career_name,
            "dni": dni,
            "ap_pat": _clean_str(row[COL_AP_PAT] if len(row) > COL_AP_PAT else ""),
            "ap_mat": _clean_str(row[COL_AP_MAT] if len(row) > COL_AP_MAT else ""),
            "nombres": _clean_str(row[COL_NOMBRES] if len(row) > COL_NOMBRES else ""),
            "promedio": row[COL_PROMEDIO] if len(row) > COL_PROMEDIO else None,
            "condicion": _clean_str(row[COL_CONDICION] if len(row) > COL_CONDICION else ""),
            "discapacidad_si": _clean_str(row[COL_DISCAPACIDAD] if len(row) > COL_DISCAPACIDAD else "").upper() == "SI",
        })

    # Procesar filas admitidas
    credentials = []
    errors = []
    counts = {
        "total_rows": len(rows),
        "admitted": 0,
        "created_students": 0,
        "updated_students": 0,
        "created_users": 0,
        "created_applications": 0,
        "updated_applications": 0,
        "skipped_not_admitted": 0,
        "errors": 0,
    }

    # Cache de carreras por nombre crudo
    career_cache = {}
    for r in rows:
        if not _is_admitted(r["condicion"]):
            counts["skipped_not_admitted"] += 1
            continue
        counts["admitted"] += 1

        try:
            # Match de carrera
            carrera_raw = r["carrera_raw"] or ""
            if carrera_raw not in career_cache:
                career_cache[carrera_raw] = match_career_robust(carrera_raw)
            career = career_cache[carrera_raw]
            career_display = (career.name if career else career_base_name(carrera_raw)) or carrera_raw

            if dry_run:
                continue

            with transaction.atomic():
                # 1. Applicant
                applicant, _ = _get_or_create_applicant(
                    dni=r["dni"],
                    nombres=r["nombres"],
                    ap_pat=r["ap_pat"],
                    ap_mat=r["ap_mat"],
                )

                # 2. Application → ADMITTED
                app, app_created = _get_or_create_application(
                    applicant=applicant,
                    call=call,
                    career=career,
                    career_name_raw=career_display,
                    modalidad=modalidad,
                )
                if app_created:
                    counts["created_applications"] += 1
                else:
                    counts["updated_applications"] += 1

                # 3. Student
                student, st_created = _upsert_student(
                    dni=r["dni"],
                    nombres=r["nombres"],
                    ap_pat=r["ap_pat"],
                    ap_mat=r["ap_mat"],
                    career_name=career_display,
                    discapacidad_si=r["discapacidad_si"],
                )
                if st_created:
                    counts["created_students"] += 1
                else:
                    counts["updated_students"] += 1

                # 4. User
                user, password, user_created = _ensure_user_with_temp_password(student)
                if user_created:
                    counts["created_users"] += 1
                    credentials.append({
                        "dni": r["dni"],
                        "nombres": f"{r['ap_pat']} {r['ap_mat']} {r['nombres']}".strip(),
                        "carrera": career_display,
                        "username": user.username,
                        "password": password,
                    })
        except Exception as exc:
            logger.exception("Error importando ingresante fila %s: %s", r["row_idx"], exc)
            counts["errors"] += 1
            errors.append({
                "row": r["row_idx"],
                "dni": r["dni"],
                "reason": str(exc),
            })

    return Response({
        "summary": counts,
        "credentials": credentials,
        "errors": errors,
        "dry_run": dry_run,
    })
