"""
Vistas para Docentes, Calificaciones y Actas
─────────────────────────────────────────────
ACTUALIZADO: usa resolvers.py centralizado para resolve_teacher
"""
import base64
from datetime import datetime
from django.db import transaction
from django.http import FileResponse, HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import viewsets, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication

from academic.models import (
    Teacher, Section, SectionGrades, AcademicGradeRecord, PlanCourse
)
from students.models import Student
from students.name_utils import nombre_oficial
from catalogs.models import Teacher as CatalogTeacher
from academic.serializers import smart_title

# ✅ CAMBIO: importar desde resolvers en vez de sections
from .resolvers import resolve_teacher

from .utils import (
    ok, _get_full_name, _to_int, _to_float, _to_str,
    list_teacher_users_qs, list_student_users_qs,
    user_has_any_role, ACTA_LEVELS, LEVEL_TO_NUM, ACTA_REQUIRED_FIELDS
)


# ══════════════════════════════════════════════════════════════
# FUNCIONES DE VALIDACIÓN Y NORMALIZACIÓN DE ACTAS
# ══════════════════════════════════════════════════════════════

def _calc_promedio_final(final_grade):
    if final_grade is None:
        return None
    try:
        return int(round(float(final_grade)))
    except Exception:
        return None


def _calc_escala_0_5(*valores):
    """Promedio de las competencias registradas (1.0–5.0, con decimales) a un
    decimal, redondeo de 0.05 a favor del estudiante (RVM 123-2022, Anexo 5).

    Solo promedia las competencias CON valor: un curso puede tener 1, 2 o 3
    competencias (p. ej. Inglés tiene una sola).
    """
    import math
    vals = []
    for v in valores:
        try:
            f = float(v)
        except (TypeError, ValueError):
            continue
        if 1 <= f <= 5:
            vals.append(f)
    if not vals:
        return None
    avg = sum(vals) / len(vals)
    return math.floor(avg * 10 + 0.5) / 10   # half-up a 1 decimal


# Rangos oficiales por nivel (RVM 123-2022, pág. 27)
NIVEL_RANGO = {
    "PI": (1.0, 1.9),
    "I":  (2.0, 2.9),
    "P":  (3.0, 3.9),
    "L":  (4.0, 4.9),
    "D":  (5.0, 5.0),
}


def _nivel_de_valor(v):
    """Nivel (PI/I/P/L/D) que corresponde a un valor 1.0–5.0."""
    try:
        f = float(v)
    except (TypeError, ValueError):
        return ""
    for nivel, (lo, hi) in NIVEL_RANGO.items():
        if lo - 1e-9 <= f <= hi + 1e-9:
            return nivel
    return ""


# Tabla oficial RVM 123-2022 pág. 28: escala (1-5, 1 decimal) → vigesimal (1-20)
ESCALA_TO_VIGESIMAL = [
    (1.0, 1), (1.2, 2), (1.4, 3), (1.6, 4), (1.8, 5),          # Previo al inicio
    (2.0, 6), (2.2, 7), (2.4, 8), (2.6, 9), (2.8, 10),          # Inicio
    (3.0, 11), (3.3, 12), (3.6, 13), (3.8, 14),                 # En proceso
    (4.0, 15), (4.2, 16), (4.4, 17), (4.6, 18), (4.8, 19),      # Logrado
    (5.0, 20),                                                   # Destacado
]


def _calc_promedio_final_0_20(escala_0_5):
    """Calificación vigesimal para el sistema de educación superior,
    según la tabla oficial de la RVM 123-2022 (pág. 28)."""
    if escala_0_5 is None:
        return None
    e = float(escala_0_5) + 1e-9
    result = 1
    for lower, vig in ESCALA_TO_VIGESIMAL:
        if e >= lower:
            result = vig
        else:
            break
    return result


def _calif_curso(escala_0_5):
    """Calificación del curso/módulo (cualitativa) según el resultado 1-5."""
    if escala_0_5 is None:
        return ""
    e = float(escala_0_5) + 1e-9
    if e >= 5:
        return "Destacado"
    if e >= 4:
        return "Logrado"
    if e >= 3:
        return "En proceso"
    if e >= 2:
        return "Inicio"
    return "Previo al inicio"


def _calc_estado(prom_final, escala_0_5=None):
    """Compat: si se conoce la escala usa la calificación oficial del curso;
    si no, degrada al binario histórico."""
    if escala_0_5 is not None:
        return _calif_curso(escala_0_5)
    if prom_final is None:
        return ""
    return "Logrado" if int(prom_final) >= 11 else "En proceso"


def _validate_acta_student_payload(payload: dict) -> tuple[bool, list[str]]:
    errors = []
    if not isinstance(payload, dict):
        return False, ["El payload del estudiante no es un objeto"]

    for field in ACTA_REQUIRED_FIELDS:
        val = payload.get(field)
        if val is None or _to_str(val) == "":
            errors.append(f"{field} es obligatorio")

    for level_field in ("C1_LEVEL", "C2_LEVEL", "C3_LEVEL"):
        lv = _to_str(payload.get(level_field))
        if lv and lv not in ACTA_LEVELS:
            errors.append(f"{level_field} inválido: '{lv}' (debe ser PI, I, P, L o D)")

    final_val = _to_float(payload.get("FINAL"))
    if final_val is None:
        errors.append("FINAL debe ser un número válido")
    else:
        if final_val < 0 or final_val > 20:
            errors.append(f"FINAL fuera de rango (0–20): {final_val}")

    return (len(errors) == 0), errors


def _normalize_acta_student_payload(payload: dict):
    """
    Normaliza el acta de un alumno.

    Cada competencia acepta un valor DECIMAL 1.0–5.0 (el docente traslada la
    nota de su registro) y/o el nivel PI/I/P/L/D. Reglas:
      · Si viene valor y nivel, el valor debe caer dentro del rango del nivel
        (L = 4.0–4.9, etc.) — si no, se rechaza.
      · Si solo viene valor, el nivel se deduce del rango.
      · Si solo viene nivel, se usa el mínimo de su rango (PI=1, I=2, …, D=5).
      · Se promedian SOLO las competencias registradas: un curso puede tener
        1, 2 o 3 competencias (Inglés tiene una sola).
    """
    if not isinstance(payload, dict):
        return None, ["Payload no es objeto"]

    errors = []
    out = dict(payload)

    for i in (1, 2, 3):
        c_key, lv_key, rec_key = f"C{i}", f"C{i}_LEVEL", f"C{i}_REC"
        out[rec_key] = _to_str(payload.get(rec_key))

        lv = _to_str(payload.get(lv_key)).upper()
        if lv and lv not in ACTA_LEVELS:
            errors.append(f"Competencia {i}: nivel inválido '{lv}' (PI, I, P, L o D)")
            lv = ""

        raw = payload.get(c_key)
        val = None
        if raw not in (None, "", []):
            val = _to_float(raw)
            if val is None:
                errors.append(f"Competencia {i}: '{raw}' no es un número válido")
            elif not (1.0 - 1e-9 <= val <= 5.0 + 1e-9):
                errors.append(f"Competencia {i}: {raw} fuera del rango permitido (1.0 – 5.0)")
                val = None
            else:
                val = round(val, 1)

        if val is not None and lv:
            lo, hi = NIVEL_RANGO[lv]
            if not (lo - 1e-9 <= val <= hi + 1e-9):
                rango = f"{lo:g}" if lo == hi else f"{lo:g} – {hi:g}"
                errors.append(
                    f"Competencia {i}: {val:g} no corresponde al nivel {lv} "
                    f"(rango permitido: {rango})")
                val = None
        elif val is not None and not lv:
            lv = _nivel_de_valor(val)
        elif val is None and lv:
            val = NIVEL_RANGO[lv][0]      # nivel sin valor → mínimo del rango

        out[lv_key] = lv
        out[c_key] = val if val is not None else ""

    if errors:
        return None, errors

    registradas = [out[f"C{i}"] for i in (1, 2, 3) if out[f"C{i}"] != ""]
    if not registradas:
        return None, ["Debe registrar al menos una competencia"]

    escala = _calc_escala_0_5(*registradas)
    prom_final = _calc_promedio_final_0_20(escala)
    estado = _calc_estado(prom_final, escala)

    out["ESCALA_0_5"] = escala
    out["PROMEDIO_FINAL"] = prom_final
    out["ESTADO"] = estado
    out["N_COMPETENCIAS"] = len(registradas)

    return out, []


def _normalize_acta_grades_payload(grades: dict):
    normalized = {}
    errors_by_student = {}

    if not isinstance(grades, dict):
        return {}, {"_global": ["grades debe ser objeto {studentId: {...}}"]}

    for student_id, payload in grades.items():
        sid = str(student_id)
        out, errs = _normalize_acta_student_payload(payload)
        if errs:
            errors_by_student[sid] = errs
        else:
            normalized[sid] = out

    return normalized, errors_by_student


# ══════════════════════════════════════════════════════════════
# VISTAS DE DOCENTES
# ══════════════════════════════════════════════════════════════

class TeachersViewSet(viewsets.ViewSet):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request, *args, **kwargs):
        """
        Retorna docentes combinando:
          1) Users con rol TEACHER/DOCENTE/PROFESOR (fuente principal)
          2) catalogs.Teacher con user asignado (cubre legacy sin rol)
          3) academic.Teacher con user asignado (último fallback)
        Sin duplicados (por user.id).
        """
        seen_ids = set()
        teachers = []

        # Cuentas administrativas NO son docentes: se excluyen SIEMPRE,
        # incluso si alguien les asignó el rol TEACHER por error.
        def _es_cuenta_admin(u):
            if not u:
                return True
            if getattr(u, "is_staff", False) or getattr(u, "is_superuser", False):
                return True
            uname = (getattr(u, "username", "") or "").upper()
            if uname.startswith("ADMIN"):
                return True
            return user_has_any_role(u, ["ADMIN_SYSTEM", "ADMIN_ACADEMIC", "ADMIN_ACADEMICO", "REGISTRAR"])

        # ── 1) Users con rol docente (fuente principal) ──
        for u in list_teacher_users_qs():
            if u.id in seen_ids or _es_cuenta_admin(u):
                continue
            seen_ids.add(u.id)
            teachers.append({
                "id": u.id,
                "full_name": _get_full_name(u),
                "email": getattr(u, "email", "") or "",
                "username": getattr(u, "username", "") or "",
            })

        # ── 2) catalogs.Teacher con user (cubre docentes sin rol asignado) ──
        for ct in CatalogTeacher.objects.select_related("user").filter(user__isnull=False):
            uid = ct.user_id
            if uid in seen_ids or _es_cuenta_admin(ct.user):
                continue
            seen_ids.add(uid)
            teachers.append({
                "id": uid,
                "full_name": _get_full_name(ct.user) if ct.user else ct.full_name or f"Docente #{ct.id}",
                "email": getattr(ct.user, "email", "") if ct.user else ct.email or "",
                "username": getattr(ct.user, "username", "") if ct.user else "",
            })

        # ── 3) academic.Teacher con user (último fallback) ──
        for at in Teacher.objects.select_related("user").filter(user__isnull=False):
            uid = at.user_id
            if uid in seen_ids or _es_cuenta_admin(at.user):
                continue
            seen_ids.add(uid)
            teachers.append({
                "id": uid,
                "full_name": _get_full_name(at.user) if at.user else f"Teacher #{at.id}",
                "email": getattr(at.user, "email", "") if at.user else "",
                "username": getattr(at.user, "username", "") if at.user else "",
            })

        teachers.sort(key=lambda t: t["full_name"].lower())
        return ok(teachers=teachers)


class TeacherSectionsView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, teacher_user_id: int):
        # ✅ CAMBIO: usa resolver centralizado
        teacher = resolve_teacher(teacher_user_id)
        if not teacher:
            return ok(sections=[])

        qs = (
            Section.objects
            .select_related("plan_course__course", "teacher__user", "classroom")
            .prefetch_related("schedule_slots")
            .filter(teacher=teacher)
            .order_by("-id")
        )

        from .utils import INT_TO_DAY

        sections = []
        for s in qs:
            pc = s.plan_course
            crs = pc.course
            sections.append({
                "id": s.id,
                "course_name": smart_title(pc.display_name or crs.name),
                "course_code": pc.display_code or crs.code,
                "section_code": s.label,
                "label": s.label,
                "period": s.period,
                "plan_course_id": s.plan_course_id,
                "semester": pc.semester,
                "room_name": s.classroom.code if s.classroom else "",
                # Horario semanal de la sección (para el dashboard del docente)
                "slots": [
                    {
                        "day": INT_TO_DAY.get(sl.weekday, str(sl.weekday)),
                        "start": sl.start.strftime("%H:%M") if hasattr(sl.start, "strftime") else str(sl.start)[:5],
                        "end": sl.end.strftime("%H:%M") if hasattr(sl.end, "strftime") else str(sl.end)[:5],
                    }
                    for sl in s.schedule_slots.all()
                ],
            })

        return ok(sections=sections)


class TeacherSectionsMeView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # Buscar academic.Teacher directamente por user (más fiable que resolver)
        teacher = Teacher.objects.filter(user=request.user).first()
        if not teacher:
            # Intentar crear desde catálogo
            cat = CatalogTeacher.objects.filter(user=request.user).first()
            if cat:
                teacher, _ = Teacher.objects.get_or_create(user=request.user)
            else:
                return ok(sections=[])

        # Mostrar TODAS las secciones asignadas al profesor
        qs = (
            Section.objects
            .select_related("plan_course__course", "teacher__user", "classroom")
            .prefetch_related("schedule_slots")
            .filter(teacher=teacher)
            .order_by("-id")
        )

        from .utils import INT_TO_DAY

        sections = []
        for s in qs:
            pc = s.plan_course
            crs = pc.course
            sections.append({
                "id": s.id,
                "course_name": smart_title(pc.display_name or crs.name),
                "course_code": pc.display_code or crs.code,
                "section_code": s.label,
                "label": s.label,
                "period": s.period,
                "plan_course_id": s.plan_course_id,
                "semester": pc.semester,
                "room_name": s.classroom.code if s.classroom else "",
                # Horario semanal de la sección (para el dashboard del docente)
                "slots": [
                    {
                        "day": INT_TO_DAY.get(sl.weekday, str(sl.weekday)),
                        "start": sl.start.strftime("%H:%M") if hasattr(sl.start, "strftime") else str(sl.start)[:5],
                        "end": sl.end.strftime("%H:%M") if hasattr(sl.end, "strftime") else str(sl.end)[:5],
                    }
                    for sl in s.schedule_slots.all()
                ],
            })

        return ok(sections=sections)


class SectionStudentsView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, section_id: int):
        """
        Solo devuelve estudiantes MATRICULADOS (Enrollment CONFIRMED) en la sección.
        Si no hay matrículas, retorna lista vacía.

        Un docente solo puede consultar el roster de SUS propias secciones
        (los administradores pueden consultar cualquiera).
        """
        from .acta_excel import _roster, roster_sin_seccion
        from .utils import _can_admin_enroll

        sec = get_object_or_404(Section, id=section_id)

        if not _can_admin_enroll(request.user):
            es_su_seccion = bool(
                sec.teacher and sec.teacher.user_id == request.user.id
            )
            if not es_su_seccion:
                return Response(
                    {"detail": "Solo puedes ver los alumnos de tus propias secciones."},
                    status=403,
                )

        # Una sola fuente para el roster: `_roster` (la misma que usan el acta,
        # el registro de asistencia y los PDFs). Antes esta vista repetía la
        # consulta y podía divergir del acta.
        students = [
            {
                "id": r["id"],
                "student_id": r["pk"],
                "first_name": r["nombres"],
                "last_name": r["apellidos"],
                "num_documento": r["dni"],
                "estado_academico": r["estado"],
                "estado_rd": r["estado_rd"],
            }
            for r in _roster(sec)
        ]

        # Matriculados que no se pueden ubicar en ninguna sección (section NULL
        # con varias secciones del curso): se avisan para que Secretaría los
        # asigne, en vez de desaparecer en silencio.
        sin_seccion = [
            {"student_id": st.id,
             "num_documento": getattr(st, "num_documento", "") or "",
             "nombre": nombre_oficial(st)}
            for st in roster_sin_seccion(sec)
        ]

        return ok(students=students, unassigned=sin_seccion)


# ══════════════════════════════════════════════════════════════
# PERFIL DEL DOCENTE (editable por el propio docente)
# ══════════════════════════════════════════════════════════════

class TeacherSelfProfileView(APIView):
    """
    GET /api/academic/teachers/me/profile
    PUT /api/academic/teachers/me/profile   (multipart o JSON)
        campos: fecha_nac (YYYY-MM-DD), grado_academico (PROFESOR|BACHILLER|
        LICENCIADO|MAGISTER|DOCTOR), celular, email_institucional, photo (file)
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    GRADOS = {"", "PROFESOR", "BACHILLER", "LICENCIADO", "MAGISTER", "DOCTOR"}
    CONDICIONES = {"", "NOMBRADO", "CONTRATADO"}
    SEXOS = {"", "M", "F"}
    # I. Datos personales (Hoja de Vida): texto libre, campo → largo máximo
    DATOS_PERSONALES = {
        "apellido_paterno": 80, "apellido_materno": 80, "nombres": 120,
        "telefono_fijo": 30, "direccion": 200,
        "region": 80, "provincia": 80, "distrito": 80,
    }

    def _get_teacher(self, request):
        return CatalogTeacher.ficha_de(request.user)

    def _payload(self, request, ct):
        photo_url = ""
        try:
            if ct.photo:
                photo_url = request.build_absolute_uri(ct.photo.url)
        except Exception:
            pass
        return {
            "full_name": getattr(request.user, "full_name", "") or ct.full_name,
            "document": ct.document or getattr(request.user, "username", ""),
            "fecha_nac": ct.fecha_nac.isoformat() if ct.fecha_nac else "",
            "grado_academico": ct.grado_academico or "",
            "grado_academico_label": dict(CatalogTeacher.GRADOS_ACADEMICOS).get(
                ct.grado_academico, ""),
            "celular": ct.phone or "",
            "email_institucional": ct.email or "",
            "specialization": ct.specialization or "",
            "photo_url": photo_url,
            "condicion_laboral": ct.condicion_laboral or "",
            "condicion_laboral_label": dict(CatalogTeacher.CONDICIONES).get(
                ct.condicion_laboral, ""),
            "rd_nombramiento": ct.rd_nombramiento or "",
            "rd_fecha": ct.rd_fecha.isoformat() if ct.rd_fecha else "",
            "apellido_paterno": ct.apellido_paterno or "",
            "apellido_materno": ct.apellido_materno or "",
            "nombres": ct.nombres or "",
            "sexo": ct.sexo or "",
            "sexo_label": dict(CatalogTeacher.SEXOS).get(ct.sexo, ""),
            "telefono_fijo": ct.telefono_fijo or "",
            "direccion": ct.direccion or "",
            "region": ct.region or "",
            "provincia": ct.provincia or "",
            "distrito": ct.distrito or "",
        }

    def get(self, request):
        return Response(self._payload(request, self._get_teacher(request)))

    def put(self, request):
        ct = self._get_teacher(request)
        data = request.data or {}

        if "fecha_nac" in data:
            v = (data.get("fecha_nac") or "").strip()
            if v:
                from django.utils.dateparse import parse_date
                d = parse_date(v)
                if not d:
                    return Response({"detail": "fecha_nac inválida (YYYY-MM-DD)"}, status=400)
                ct.fecha_nac = d
            else:
                ct.fecha_nac = None

        if "grado_academico" in data:
            g = (data.get("grado_academico") or "").strip().upper()
            if g not in self.GRADOS:
                return Response({"detail": f"grado_academico inválido: {g!r}"}, status=400)
            ct.grado_academico = g

        if "condicion_laboral" in data:
            c = (data.get("condicion_laboral") or "").strip().upper()
            if c not in self.CONDICIONES:
                return Response({"detail": f"condicion_laboral inválida: {c!r}"}, status=400)
            ct.condicion_laboral = c

        if "rd_nombramiento" in data:
            ct.rd_nombramiento = (data.get("rd_nombramiento") or "").strip()[:120]

        if "rd_fecha" in data:
            v = (data.get("rd_fecha") or "").strip()
            if v:
                from django.utils.dateparse import parse_date
                d = parse_date(v)
                if not d:
                    return Response({"detail": "rd_fecha inválida (YYYY-MM-DD)"}, status=400)
                ct.rd_fecha = d
            else:
                ct.rd_fecha = None

        if "sexo" in data:
            s = (data.get("sexo") or "").strip().upper()
            if s not in self.SEXOS:
                return Response({"detail": f"sexo inválido: {s!r}"}, status=400)
            ct.sexo = s

        for campo, largo in self.DATOS_PERSONALES.items():
            if campo in data:
                setattr(ct, campo, (data.get(campo) or "").strip()[:largo])

        if "celular" in data:
            ct.phone = (data.get("celular") or "").strip()[:30]
        if "email_institucional" in data:
            ct.email = (data.get("email_institucional") or "").strip()[:254]
        if "specialization" in data:
            ct.specialization = (data.get("specialization") or "").strip()[:120]

        photo = request.FILES.get("photo")
        if photo:
            if photo.size > 5 * 1024 * 1024:
                return Response({"detail": "La foto no debe superar 5 MB"}, status=400)
            ct.photo = photo

        if not ct.full_name:
            ct.full_name = getattr(request.user, "full_name", "") or ""
        if not ct.document:
            ct.document = getattr(request.user, "username", "") or ""
        ct.save()
        return Response({"success": True, "message": "Perfil actualizado",
                         **self._payload(request, ct)})


class SectionGradesWindowView(APIView):
    """
    GET /api/academic/sections/<id>/grades-window
    Estado del registro de calificaciones para la sección (lo consulta el
    docente antes de editar): abierto / aún no abre / vencido / cerrado,
    con el mensaje listo para mostrar y si el usuario puede editar.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, section_id: int):
        from academic.models import AcademicPeriod

        sec = get_object_or_404(Section, id=section_id)
        if err := _grades_section_access_denied(request, sec):
            return err

        es_admin = _is_grades_admin(request.user)
        per = AcademicPeriod.objects.filter(code=sec.period).first()
        if not per:
            # Sin período configurado → sin restricción
            return Response({
                "period": sec.period, "window_state": "OPEN", "is_open": True,
                "has_window": False, "can_edit": True, "is_admin": es_admin,
                "message": "Registro de calificaciones habilitado (sin restricción de fechas).",
                "grades_start": None, "grades_end": None,
                "acta_submitted": SectionGrades.objects.filter(
                    section=sec, submitted=True).exists(),
            })

        info = per.grades_window_info()
        submitted = SectionGrades.objects.filter(section=sec, submitted=True).exists()
        return Response({
            "period": sec.period,
            **info,
            "can_edit": bool(info["is_open"] or es_admin),
            "is_admin": es_admin,
            "acta_submitted": submitted,
            "admin_override": bool(es_admin and not info["is_open"]),
        })


class TeacherSelfPeriodsView(APIView):
    """
    GET /api/academic/teachers/me/periodos
    Períodos en los que el docente tuvo carga académica (para filtrar y
    descargar horarios de períodos pasados), con su n° de secciones.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        teacher = Teacher.objects.filter(user=request.user).first()
        if not teacher:
            return ok(periods=[], current="")

        from django.db.models import Count
        rows = (Section.objects.filter(teacher=teacher)
                .values("period")
                .annotate(n=Count("id"))
                .order_by("-period"))
        current = ""
        try:
            from catalogs.models import Period as CatalogPeriod
            per = CatalogPeriod.objects.filter(is_active=True).first()
            current = (per.code or "").strip() if per else ""
        except Exception:
            pass
        return ok(
            periods=[{"code": r["period"], "sections": r["n"]}
                     for r in rows if (r["period"] or "").strip()],
            current=current,
        )


# ══════════════════════════════════════════════════════════════
# ADMIN: VENTANA DE CARGA DE NOTAS POR PERIODO
# ══════════════════════════════════════════════════════════════

class AdminGradesWindowView(APIView):
    """
    GET  /api/academic/periods/<code>/grades-window
    PUT  /api/academic/periods/<code>/grades-window
      body: { "grades_start": "2026-06-01T00:00", "grades_end": "2026-07-15T23:59" }
    Si grades_start/end son null se elimina la restricción (cualquier momento).
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def _get_period(self, code):
        from academic.models import AcademicPeriod
        return AcademicPeriod.objects.filter(code=code).first()

    def get(self, request, code: str):
        try:
            per = self._get_period(code)
            if not per:
                return Response({"detail": f"Periodo {code} no existe"}, status=404)
            return Response({"code": per.code, **per.grades_window_info()})
        except Exception as exc:
            import traceback
            return Response({
                "detail": f"Error en grades-window GET: {type(exc).__name__}: {exc}",
                "traceback": traceback.format_exc().splitlines()[-10:],
            }, status=500)

    def put(self, request, code: str):
        # Solo admins pueden configurar la ventana
        u = request.user
        is_admin = (
            getattr(u, "is_staff", False)
            or getattr(u, "is_superuser", False)
            or user_has_any_role(u, ("ADMIN_SYSTEM", "ADMIN_ACADEMIC",
                                     "ADMIN_ACADEMICO", "REGISTRAR"))
        )
        if not is_admin:
            return Response({"detail": "No autorizado."}, status=403)

        per = self._get_period(code)
        if not per:
            return Response({"detail": f"Periodo {code} no existe"}, status=404)

        from django.utils.dateparse import parse_datetime
        data = request.data or {}

        def _p(key):
            v = data.get(key)
            if v in (None, ""):
                return None
            dt = parse_datetime(str(v))
            if dt and timezone.is_naive(dt):
                dt = timezone.make_aware(dt)
            return dt

        start = _p("grades_start")
        end   = _p("grades_end")
        if start and end and end < start:
            return Response({"detail": "grades_end no puede ser anterior a grades_start"}, status=400)

        per.grades_start = start
        per.grades_end   = end
        per.save(update_fields=["grades_start", "grades_end"])
        return Response({"code": per.code, **per.grades_window_info(), "success": True})


# ══════════════════════════════════════════════════════════════
# ADMIN: MONITOREO GLOBAL DE NOTAS POR PERIODO
# ══════════════════════════════════════════════════════════════

class AdminGradesOverviewView(APIView):
    """
    GET /api/academic/admin/grades/overview?period=2026-I[&career_id=5]
    Devuelve por cada Section: cuántos alumnos hay, cuántas notas
    cargadas (cualquier valor distinto de vacío), si el acta está cerrada,
    y cuántos alumnos con nota < 11 (desaprobados) o DPI.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            return self._do_get(request)
        except Exception as exc:
            import traceback
            return Response({
                "detail": f"Error en grades/overview: {type(exc).__name__}: {exc}",
                "traceback": traceback.format_exc().splitlines()[-15:],
            }, status=500)

    def _do_get(self, request):
        from academic.models import EnrollmentItem, Enrollment

        period = (request.query_params.get("period") or "").strip()
        career_id = request.query_params.get("career_id")

        sec_qs = Section.objects.select_related(
            "plan_course", "plan_course__course", "plan_course__plan",
            "plan_course__plan__career", "teacher", "teacher__user",
        )
        if period:
            sec_qs = sec_qs.filter(period=period)
        if career_id:
            try:
                sec_qs = sec_qs.filter(plan_course__plan__career_id=int(career_id))
            except (TypeError, ValueError):
                pass

        out = []
        for sec in sec_qs:
            bundle, _ = SectionGrades.objects.get_or_create(section=sec)
            grades = bundle.grades or {}

            # (student_id, user_id): el acta del docente usa user_id como clave,
            # las vistas admin históricamente usaban student_id — se aceptan ambas.
            students_in_section = set(
                EnrollmentItem.objects
                .filter(plan_course=sec.plan_course,
                        enrollment__period=sec.period,
                        enrollment__status=Enrollment.STATUS_CONFIRMED)
                # LICENCIA no puede ser calificado → no cuenta como esperado
                .exclude(enrollment__student__estado_academico__iexact="LICENCIA")
                .values_list("enrollment__student_id", "enrollment__student__user_id")
            )
            n_students = len(students_in_section)

            # Cantidad con nota cargada
            n_loaded = 0
            n_failed = 0
            n_dpi = 0
            for sid, uid in students_in_section:
                entry = None
                for key in (uid, sid):
                    if key is not None and isinstance(grades.get(str(key)), dict):
                        entry = grades[str(key)]
                        break
                if entry is None:
                    continue
                fg = entry.get("final_grade")
                if fg is None:
                    fg = entry.get("PROMEDIO_FINAL")
                st = (entry.get("status") or "").upper()
                if st == "DPI":
                    n_dpi += 1
                    n_loaded += 1
                    n_failed += 1
                    continue
                try:
                    fgn = float(fg)
                    n_loaded += 1
                    if fgn < 11:
                        n_failed += 1
                except (TypeError, ValueError):
                    pass

            teacher_name = ""
            if sec.teacher and sec.teacher.user:
                teacher_name = (getattr(sec.teacher.user, "full_name", "")
                                or sec.teacher.user.username or "")

            pct = (n_loaded / n_students * 100) if n_students else 0

            out.append({
                "section_id": sec.id,
                "period": sec.period,
                "label": sec.label,
                "course_code": sec.plan_course.effective_code if sec.plan_course else "",
                "course_name": sec.plan_course.effective_name if sec.plan_course else "",
                "career_name": (sec.plan_course.plan.career.name
                                if sec.plan_course and sec.plan_course.plan
                                and sec.plan_course.plan.career else ""),
                "semester": sec.plan_course.semester if sec.plan_course else None,
                "teacher_name": teacher_name,
                "n_students": n_students,
                "n_loaded": n_loaded,
                "n_pending": max(n_students - n_loaded, 0),
                "n_failed": n_failed,
                "n_dpi": n_dpi,
                "loaded_pct": round(pct, 1),
                "submitted": bool(bundle.submitted),
                "submitted_at": bundle.submitted_at.isoformat() if bundle.submitted_at else None,
            })

        # Orden: actas no cargadas primero, luego más alumnos sin nota
        out.sort(key=lambda s: (s["submitted"], -s["n_pending"],
                                s["career_name"], s["semester"] or 0,
                                s["course_name"]))
        return Response({"period": period, "sections": out})


class AdminGradesSectionDetailView(APIView):
    """
    GET /api/academic/admin/grades/section/<section_id>
    Detalle: lista de alumnos con su nota, estado (DPI / desaprobado / aprobado / pendiente).
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, section_id):
        from academic.models import EnrollmentItem, Enrollment
        from students.models import Student

        sec = get_object_or_404(Section, id=section_id)
        bundle, _ = SectionGrades.objects.get_or_create(section=sec)
        grades = bundle.grades or {}

        st_ids = list(
            EnrollmentItem.objects
            .filter(plan_course=sec.plan_course,
                    enrollment__period=sec.period,
                    enrollment__status=Enrollment.STATUS_CONFIRMED)
            # LICENCIA no se califica: fuera del detalle y del conteo,
            # igual que en el overview (si no, figura PENDIENTE eterno).
            .exclude(enrollment__student__estado_academico__iexact="LICENCIA")
            .values_list("enrollment__student_id", flat=True)
            .distinct()
        )
        students = Student.objects.filter(id__in=st_ids).order_by(
            "apellido_paterno", "apellido_materno", "nombres"
        )

        teacher_name = ""
        if sec.teacher and sec.teacher.user:
            teacher_name = (getattr(sec.teacher.user, "full_name", "")
                            or sec.teacher.user.username or "")

        out = []
        for st in students:
            entry = {}
            for key in (getattr(st, "user_id", None), st.id):
                if key is not None and isinstance(grades.get(str(key)), dict):
                    entry = grades[str(key)]
                    break
            fg = entry.get("final_grade") if entry else None
            if fg is None and entry:
                fg = entry.get("PROMEDIO_FINAL")
            status_val = (entry.get("status") or "").upper() if entry else ""
            estado = "PENDIENTE"
            try:
                fgn = float(fg)
                if status_val == "DPI":
                    estado = "DPI"
                elif fgn < 11:
                    estado = "DESAPROBADO"
                else:
                    estado = "APROBADO"
            except (TypeError, ValueError):
                if status_val == "DPI":
                    estado = "DPI"
                    fg = 0
            out.append({
                "student_id": st.id,
                "dni": st.num_documento,
                "full_name": f"{st.apellido_paterno or ''} {st.apellido_materno or ''} {st.nombres or ''}".strip(),
                "final_grade": fg,
                "status": status_val or estado,
                "estado": estado,
                "dpi_pct": entry.get("dpi_pct") if entry else None,
            })

        return Response({
            "section_id": sec.id,
            "period": sec.period,
            "course": sec.plan_course.effective_name if sec.plan_course else "",
            "label": sec.label,
            "teacher_name": teacher_name,
            "n_students": len(out),
            "submitted": bool(bundle.submitted),
            "students": out,
        })


# ══════════════════════════════════════════════════════════════
# VISTAS DE CALIFICACIONES Y ACTAS
# ══════════════════════════════════════════════════════════════

def _grades_section_access_denied(request, sec):
    """
    Un docente solo puede leer/escribir notas de SUS propias secciones;
    los administradores de notas pueden operar sobre cualquiera.
    Retorna Response 403 si está prohibido, o None si está OK.
    """
    if _is_grades_admin(request.user):
        return None
    if sec.teacher and sec.teacher.user_id == request.user.id:
        return None
    return Response(
        {"detail": "Solo puedes operar sobre las notas de tus propias secciones."},
        status=403,
    )


class SectionGradesView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, section_id: int):
        sec = get_object_or_404(Section, id=section_id)
        if err := _grades_section_access_denied(request, sec):
            return err
        bundle, _ = SectionGrades.objects.get_or_create(section=sec)
        return ok(
            grades=(bundle.grades or {}),
            submitted=bool(bundle.submitted)
        )


# ── Helpers compartidos por GradesSave/GradesSubmit ──────────────────
DPI_GRADES_THRESHOLD = 0.30   # 30% de inasistencias = DPI (RVM 277-2019)


def _is_grades_admin(user):
    return (
        getattr(user, "is_staff", False)
        or getattr(user, "is_superuser", False)
        or user_has_any_role(user, ("ADMIN_SYSTEM", "ADMIN_ACADEMIC",
                                    "ADMIN_ACADEMICO", "REGISTRAR"))
    )


def _check_grades_window(section, user):
    """Devuelve (ok, error_dict). Si la ventana de notas está cerrada,
    los no-admin reciben 423 (Locked) con el rango configurado."""
    try:
        from academic.models import AcademicPeriod
        per = AcademicPeriod.objects.filter(code=section.period).first()
    except Exception:
        per = None
    if not per:
        return True, None
    if per.grades_window_open():
        return True, None
    if _is_grades_admin(user):
        return True, None
    return False, {
        "detail": per.grades_window_message(),
        **per.grades_window_info(),
    }


def _licencia_students(section):
    """Alumnos de la sección con estado LICENCIA.
    Retorna dict {clave_del_acta: nombre} (claves user_id y pk)."""
    from academic.models import EnrollmentItem, Enrollment
    out = {}
    items = (
        EnrollmentItem.objects
        .select_related("enrollment__student")
        .filter(plan_course=section.plan_course,
                enrollment__period=section.period,
                enrollment__status=Enrollment.STATUS_CONFIRMED)
    )
    for item in items:
        st = item.enrollment.student
        if (getattr(st, "estado_academico", "") or "").upper() == "LICENCIA":
            nombre = f"{st.apellido_paterno or ''} {st.nombres or ''}".strip()
            for key in (st.user_id, st.id):
                if key is not None:
                    out[str(key)] = nombre
    return out


def _strip_licencia(section, grades_payload):
    """Quita del payload las notas de alumnos con LICENCIA (bloqueados).
    Retorna (payload_filtrado, nombres_bloqueados)."""
    lic = _licencia_students(section)
    if not lic or not isinstance(grades_payload, dict):
        return grades_payload, []
    bloqueados = []
    out = {}
    for key, val in grades_payload.items():
        if str(key) in lic:
            if lic[str(key)] not in bloqueados:
                bloqueados.append(lic[str(key)])
            continue
        out[key] = val
    return out, bloqueados


def _apply_dpi_override(section, normalized):
    """Para cada alumno con >30% inasistencias en esta sección, fuerza
    final_grade=0 y status='DPI', sin importar lo que envió el docente.

    Devuelve (normalized_modificado, dpi_students_info[])
    """
    try:
        from academic.models import AttendanceSession, AttendanceRow, EnrollmentItem, Enrollment
    except Exception:
        return normalized, []

    sessions = AttendanceSession.objects.filter(section=section)
    n_sessions = sessions.count()
    if n_sessions == 0:
        return normalized, []   # sin sesiones, no se puede evaluar DPI

    # Alumnos de la sección — LICENCIA fuera: no puede ser calificado, así
    # que tampoco puede ser desaprobado por inasistencia (sería contradictorio
    # con _strip_licencia, que le borra cualquier nota del acta).
    st_ids = set(
        EnrollmentItem.objects
        .filter(plan_course=section.plan_course,
                enrollment__period=section.period,
                enrollment__status=Enrollment.STATUS_CONFIRMED)
        .exclude(enrollment__student__estado_academico__iexact="LICENCIA")
        .values_list("enrollment__student_id", flat=True)
    )
    # Faltas por alumno
    absences = {}
    for r in AttendanceRow.objects.filter(
        session__in=sessions, student_id__in=st_ids,
    ).values("student_id", "status"):
        if (r["status"] or "").upper() == "ABSENT":
            sid = r["student_id"]
            absences[sid] = absences.get(sid, 0) + 1

    dpi_info = []
    out = dict(normalized) if isinstance(normalized, dict) else {}
    for sid in st_ids:
        a = absences.get(sid, 0)
        pct = a / n_sessions
        if pct > DPI_GRADES_THRESHOLD:
            existing = out.get(str(sid)) if isinstance(out.get(str(sid)), dict) else {}
            out[str(sid)] = {
                **(existing or {}),
                "final_grade": 0,
                "status": "DPI",
                "dpi_pct": round(pct * 100, 1),
                "dpi_absences": a,
                "dpi_sessions": n_sessions,
            }
            dpi_info.append({
                "student_id": sid,
                "absences": a,
                "sessions": n_sessions,
                "pct": round(pct * 100, 1),
            })
    return out, dpi_info


class GradesSaveView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        body = request.data or {}
        section_id = body.get("section_id")
        grades = body.get("grades") or {}

        if not section_id:
            return Response({"detail": "section_id es requerido"}, status=400)

        sec = get_object_or_404(Section, id=int(section_id))
        if err := _grades_section_access_denied(request, sec):
            return err
        bundle, _ = SectionGrades.objects.get_or_create(section=sec)

        # ── Ventana de notas (admin bypass) ──
        ok_win, err = _check_grades_window(sec, request.user)
        if not ok_win:
            return Response(err, status=423)  # Locked

        if bundle.submitted:
            # Acta cerrada → solo administradores pueden modificar
            if not _is_grades_admin(request.user):
                return Response(
                    {"detail": "El acta ya está cerrada. Solo administradores pueden modificarla."},
                    status=409,
                )

        # ── Alumnos con LICENCIA: bloqueados, no se les puede calificar ──
        grades, bloqueados = _strip_licencia(sec, grades)

        normalized, errors_by_student = _normalize_acta_grades_payload(grades)

        if errors_by_student:
            return Response(
                {"detail": "Errores de validación en el acta", "errors": errors_by_student},
                status=400
            )

        # ── Auto-DPI: alumnos con >30% inasistencias forzados a 0/DPI ──
        normalized, dpi_info = _apply_dpi_override(sec, normalized)

        bundle.grades = normalized
        bundle.save()
        msg = (
            "Acta modificada por administrador (acta permanece cerrada)"
            if bundle.submitted else
            "Acta guardada correctamente (borrador)"
        )
        if dpi_info:
            msg += f" · {len(dpi_info)} alumno(s) marcado(s) DPI por inasistencia (>30%)"
        if bloqueados:
            msg += f" · {len(bloqueados)} alumno(s) con LICENCIA no calificable(s): {', '.join(bloqueados)}"
        return ok(success=True, message=msg, dpi_applied=dpi_info,
                  licencia_bloqueados=bloqueados)


class GradesSubmitView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        body = request.data or {}
        section_id = body.get("section_id")
        grades = body.get("grades") or {}

        if not section_id:
            return Response({"detail": "section_id es requerido"}, status=400)

        sec = get_object_or_404(Section, id=int(section_id))
        if err := _grades_section_access_denied(request, sec):
            return err
        bundle, _ = SectionGrades.objects.get_or_create(section=sec)

        # Ventana
        ok_win, err = _check_grades_window(sec, request.user)
        if not ok_win:
            return Response(err, status=423)

        # Alumnos con LICENCIA no se califican (bloqueados)
        grades, bloqueados = _strip_licencia(sec, grades)

        normalized, errors_by_student = _normalize_acta_grades_payload(grades)

        if errors_by_student:
            return Response(
                {"detail": "No se puede cerrar el acta: hay errores", "errors": errors_by_student},
                status=400
            )

        # Auto-DPI antes de cerrar
        normalized, dpi_info = _apply_dpi_override(sec, normalized)

        bundle.grades = normalized
        bundle.submitted = True
        bundle.submitted_at = timezone.now()
        bundle.save()

        msg = "Acta enviada y cerrada correctamente"
        if dpi_info:
            msg += f" · {len(dpi_info)} alumno(s) DPI aplicados automáticamente"
        if bloqueados:
            msg += f" · {len(bloqueados)} alumno(s) con LICENCIA no calificable(s)"

        # ── Auto-emisión de CERTIFICADO_EGRESADO ──
        # Al cerrar el acta, revisamos si algún alumno alcanza los créditos
        # totales del plan y si aún no tiene certificado, lo emitimos.
        auto_emitted = []
        try:
            from students.models import Student as _Student
            from academic.models import EnrollmentItem, Enrollment as _E
            from .graduates import maybe_auto_emit_certificate
            st_ids = list(
                EnrollmentItem.objects
                .filter(plan_course=sec.plan_course,
                        enrollment__period=sec.period,
                        enrollment__status=_E.STATUS_CONFIRMED)
                .values_list("enrollment__student_id", flat=True)
                .distinct()
            )
            for stu in _Student.objects.filter(id__in=st_ids).select_related("plan"):
                proc = maybe_auto_emit_certificate(stu)
                if proc:
                    auto_emitted.append({
                        "student_id": stu.id,
                        "process_id": proc.id,
                        "dni": stu.num_documento,
                    })
            if auto_emitted:
                msg += f" · {len(auto_emitted)} certificado(s) de egresado auto-emitido(s)"
        except Exception:
            # No romper el submit si la auto-emisión falla
            pass

        return ok(success=True, submitted=True, message=msg,
                  dpi_applied=dpi_info, certificates_emitted=auto_emitted)


class GradesReopenView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        u = request.user
        is_admin = (
            getattr(u, "is_staff", False)
            or getattr(u, "is_superuser", False)
            or user_has_any_role(u, ["REGISTRAR", "ADMIN_ACADEMIC",
                                     "ADMIN_ACADEMICO", "ADMIN_SYSTEM"])
        )
        if not is_admin:
            return Response({"detail": "No autorizado para reabrir actas"}, status=403)

        body = request.data or {}
        section_id = body.get("section_id")

        if not section_id:
            return Response({"detail": "section_id requerido"}, status=400)

        sec = get_object_or_404(Section, id=int(section_id))
        bundle, _ = SectionGrades.objects.get_or_create(section=sec)

        bundle.submitted = False
        bundle.submitted_at = None
        bundle.save()

        return ok(success=True, submitted=False, message="Acta reabierta")


class SectionActaView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, section_id: int):
        return ok(
            success=True,
            downloadUrl=f"/api/sections/{section_id}/acta/pdf",
            download_url=f"/api/sections/{section_id}/acta/pdf",
        )


class SectionActaPDFView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, section_id: int):
        from io import BytesIO
        from django.http import FileResponse
        buf = BytesIO(b"%PDF-1.4\n% Dummy PDF\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n")
        return FileResponse(buf, as_attachment=True, filename=f"acta-section-{section_id}.pdf")


class SectionActaQRView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, section_id: int):
        return ok(
            success=True,
            qrUrl=f"/api/sections/{section_id}/acta/qr/png",
            qr_url=f"/api/sections/{section_id}/acta/qr/png",
        )


class SectionActaQRPngView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, section_id: int):
        png_1x1 = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6X1fQAAAABJRU5ErkJggg=="
        )
        return HttpResponse(png_1x1, content_type="image/png")


# ══════════════════════════════════════════════════════════════
# NOTAS HISTÓRICAS (CRUD para admin)
# ══════════════════════════════════════════════════════════════

try:
    from catalogs.helpers import match_plan_course_for_grade
except ImportError:
    def match_plan_course_for_grade(student, course, plan_id=None):
        pid = plan_id or getattr(student, "plan_id", None)
        if not pid:
            return None
        return PlanCourse.objects.filter(plan_id=pid, course=course).first()

try:
    from academic.models import Course
except ImportError:
    try:
        # Fallback por si en algún despliegue se renombró el módulo
        from catalogs.models import Course  # type: ignore
    except ImportError:
        Course = None


def _require_admin(request):
    """Verifica que el usuario sea staff/admin."""
    u = getattr(request, "user", None)
    if not (u and u.is_authenticated):
        return {"detail": "No autorizado."}, 403
    if getattr(u, "is_staff", False) or getattr(u, "is_superuser", False):
        return None, None
    if user_has_any_role(u, ("ADMIN_ACADEMIC", "ADMIN_ACADEMICO", "ADMIN_SYSTEM", "REGISTRAR")):
        return None, None
    return {"detail": "No autorizado."}, 403


def _build_components(raw_components: dict) -> dict:
    """
    Normaliza y auto-calcula componentes de notas.
    Acepta C1_LEVEL/C2_LEVEL/C3_LEVEL y/o C1/C2/C3.
    Auto-calcula ESCALA_0_5, PROMEDIO_FINAL, ESTADO.
    """
    if not raw_components or not isinstance(raw_components, dict):
        return {}

    out = dict(raw_components)

    # Auto-derivar C1/C2/C3 desde niveles si no están presentes
    for i in (1, 2, 3):
        c_key = f"C{i}"
        lv_key = f"C{i}_LEVEL"

        lv = _to_str(out.get(lv_key, "")).upper()
        if lv and lv in ACTA_LEVELS:
            out[lv_key] = lv
            if out.get(c_key) is None or out.get(c_key) == "":
                out[c_key] = LEVEL_TO_NUM.get(lv)
        else:
            c_val = _to_int(out.get(c_key))
            if c_val is not None and 1 <= c_val <= 5:
                out[c_key] = c_val
                # Auto-derivar nivel desde valor numérico
                num_to_level = {v: k for k, v in LEVEL_TO_NUM.items()}
                if c_val in num_to_level and not lv:
                    out[lv_key] = num_to_level[c_val]

    # Auto-calcular escala y promedio con las competencias registradas
    registradas = [_to_float(out.get(f"C{i}")) for i in (1, 2, 3)]
    registradas = [v for v in registradas if v is not None and 1 <= v <= 5]
    if registradas:
        escala = _calc_escala_0_5(*registradas)
        prom = _calc_promedio_final_0_20(escala)
        estado = _calc_estado(prom, escala)
        out["ESCALA_0_5"] = escala
        out["PROMEDIO_FINAL"] = prom
        out["ESTADO"] = estado

    return out


class HistoricalGradesView(APIView):
    """
    CRUD de notas históricas para admin.
    GET    /api/academic/grades/historical?student_id=123
    POST   /api/academic/grades/historical
    DELETE /api/academic/grades/historical/<record_id>
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, record_id=None):
        err, code = _require_admin(request)
        if err:
            return ok(error=err["detail"]) if code == 403 else ok()

        student_id = request.query_params.get("student_id")
        if not student_id:
            return ok(error="student_id es requerido", records=[])

        records = (
            AcademicGradeRecord.objects
            .select_related("course", "plan_course", "plan_course__course")
            .filter(student_id=int(student_id))
            .order_by("-term", "course__name")
        )

        # Cache para créditos y semestre
        try:
            student = Student.objects.select_related("plan").get(pk=int(student_id))
        except Student.DoesNotExist:
            student = None

        from .kardex_helpers import (
            _credits_for_student_course,
            _build_pc_name_cache,
        )
        pc_cache = _build_pc_name_cache(getattr(student, "plan_id", None)) if student else {}

        # Mapa de PlanCourse → semester (para incluir el ciclo)
        _ROMAN = {1:"I",2:"II",3:"III",4:"IV",5:"V",6:"VI",7:"VII",8:"VIII",9:"IX",10:"X"}

        def _ciclo_for(rec):
            if rec.plan_course and rec.plan_course.semester:
                return int(rec.plan_course.semester)
            if student and student.plan_id:
                try:
                    sem = (
                        PlanCourse.objects
                        .filter(plan_id=student.plan_id, course_id=rec.course_id)
                        .values_list("semester", flat=True).first()
                    )
                    if sem:
                        return int(sem)
                except Exception:
                    pass
            return 0

        result = []
        for rec in records:
            pc_name = ""
            if rec.plan_course:
                pc_name = getattr(rec.plan_course, "display_name", "") or ""
                if not pc_name and rec.plan_course.course:
                    pc_name = rec.plan_course.course.name

            credits = 0
            if student and rec.course:
                try:
                    credits = _credits_for_student_course(student, rec.course, _pc_name_cache=pc_cache) or 0
                except Exception:
                    credits = int(getattr(rec.course, "credits", 0) or 0)
            elif rec.course:
                credits = int(getattr(rec.course, "credits", 0) or 0)

            sem = _ciclo_for(rec)

            result.append({
                "id": rec.id,
                "course_id": rec.course_id,
                "course_name": pc_name or (rec.course.name if rec.course else ""),
                "course_code": rec.course.code if rec.course else "",
                "term": rec.term,
                "final_grade": float(rec.final_grade) if rec.final_grade is not None else None,
                "credits": credits,
                "ciclo": sem,
                "ciclo_roman": _ROMAN.get(sem, "") if sem > 0 else "",
                "components": rec.components or {},
                "plan_course_id": rec.plan_course_id,
                "created_at": rec.created_at.isoformat() if rec.created_at else None,
            })

        return ok(records=result)

    def post(self, request, record_id=None):
        err, code = _require_admin(request)
        if err:
            return ok(error=err["detail"])

        student_id = request.data.get("student_id")
        records_data = request.data.get("records", [])

        if not student_id:
            return ok(error="student_id es requerido")

        try:
            student = Student.objects.get(pk=int(student_id))
        except Student.DoesNotExist:
            return ok(error=f"Estudiante {student_id} no existe")

        if not records_data:
            return ok(error="records es requerido (lista de notas)")

        created_count = 0
        updated_count = 0
        errors = []

        for idx, rec_data in enumerate(records_data):
            course_id = rec_data.get("course_id")
            term = (rec_data.get("term") or "").strip()
            final_grade = rec_data.get("final_grade")
            raw_components = rec_data.get("components", {})

            if not course_id:
                errors.append(f"Registro {idx + 1}: course_id es requerido")
                continue
            if not term:
                errors.append(f"Registro {idx + 1}: term es requerido")
                continue
            if final_grade is None:
                errors.append(f"Registro {idx + 1}: final_grade es requerido")
                continue

            try:
                fg = float(final_grade)
                if fg < 0 or fg > 20:
                    errors.append(f"Registro {idx + 1}: final_grade debe ser 0-20")
                    continue
            except (ValueError, TypeError):
                errors.append(f"Registro {idx + 1}: final_grade inválido")
                continue

            if Course is None:
                errors.append(f"Registro {idx + 1}: modelo Course no disponible")
                continue

            try:
                course = Course.objects.get(pk=int(course_id))
            except Course.DoesNotExist:
                errors.append(f"Registro {idx + 1}: curso {course_id} no existe")
                continue

            # Auto-resolver plan_course
            pc = match_plan_course_for_grade(student, course)

            # Normalizar componentes
            components = _build_components(raw_components)

            rec, created = AcademicGradeRecord.objects.update_or_create(
                student=student,
                course=course,
                term=term,
                defaults={
                    "final_grade": fg,
                    "components": components,
                    "plan_course": pc,
                },
            )

            if created:
                created_count += 1
            else:
                updated_count += 1

        return ok(
            created=created_count,
            updated=updated_count,
            errors=errors,
        )

    def delete(self, request, record_id=None):
        err, code = _require_admin(request)
        if err:
            return ok(error=err["detail"])

        if not record_id:
            return ok(error="record_id es requerido en la URL")

        try:
            rec = AcademicGradeRecord.objects.get(pk=int(record_id))
        except AcademicGradeRecord.DoesNotExist:
            return ok(error=f"Registro {record_id} no existe")

        rec.delete()
        return ok(deleted=True)


class HistoricalGradesBulkDeleteView(APIView):
    """
    POST /api/academic/grades/historical/bulk-delete
    Body: { student_id: X, terms: ["2023-I", "2023-II", "2024-EXTRAORDINARIO"] }

    Elimina TODOS los registros del alumno para los periodos indicados.
    Útil cuando un alumno reingresa como cachimbo y se debe limpiar su
    historial anterior. Solo accesible por admin.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        err, code = _require_admin(request)
        if err:
            return ok(error=err["detail"])

        student_id = request.data.get("student_id")
        terms = request.data.get("terms") or []

        if not student_id:
            return ok(error="student_id es requerido")
        if not isinstance(terms, list) or not terms:
            return ok(error="terms es requerido (lista de periodos, ej. ['2023-I', '2023-II'])")

        # Normalizar y filtrar
        terms_clean = [str(t).strip() for t in terms if str(t).strip()]
        if not terms_clean:
            return ok(error="No se recibieron periodos válidos")

        try:
            student_id = int(student_id)
        except (TypeError, ValueError):
            return ok(error="student_id inválido")

        if not Student.objects.filter(pk=student_id).exists():
            return ok(error=f"Estudiante {student_id} no existe")

        qs = AcademicGradeRecord.objects.filter(
            student_id=student_id,
            term__in=terms_clean,
        )
        count_before = qs.count()
        if count_before == 0:
            return ok(deleted=0, terms=terms_clean,
                      message="No se encontraron registros en esos periodos")

        # Eliminar
        deleted, _per_model = qs.delete()

        return ok(
            deleted=count_before,
            terms=terms_clean,
            student_id=student_id,
        )