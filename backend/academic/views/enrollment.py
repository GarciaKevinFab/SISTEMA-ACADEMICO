"""
Vistas para manejo de Matrículas y Procesos de Inscripción
═══════════════════════════════════════════════════════════
FEATURES:
  ✅ Ventana ORDINARIA  → status 'OPEN'
  ✅ Ventana EXTEMPORÁNEA → status 'EXTEMPORARY' + surcharge
  ✅ Sin ventana configurada → status 'FREE' (sin bloqueo)
  ✅ Fuera de todo → status 'CLOSED' (bloquea validar/commit)
  ✅ AcademicPeriodEnrollmentWindowView  GET + PUT
  ✅ AcademicPeriodsListView             GET (lista períodos)
  ✅ EnrollmentAvailableView devuelve window.status completo
  ✅ Acepta course_ids Y plan_course_ids
  ✅ Resolución por nombre (malla 2020)
  ✅ Créditos máximos dinámicos por plan (no tope fijo de 22)
  ✅ StudentsOverviewView — vista admin de alumnos matriculados/pendientes
  ✅ StudentsOverviewView retorna enrolled_count y pending_count globales
"""
from io import BytesIO
from django.db import transaction
from django.db.models import Q, Subquery, OuterRef, Count, Sum, IntegerField, Max
from django.db.models.functions import Coalesce
from django.http import FileResponse, HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from rest_framework_simplejwt.authentication import JWTAuthentication

from students.models import Student as StudentProfile
from academic.models import (
    AcademicPeriod, Enrollment, EnrollmentItem,
    PlanCourse, Section, SectionScheduleSlot,
    InstitutionSettings, AcademicGradeRecord,
    CoursePrereq,
)
from .utils import (
    ok, PASSING_GRADE, DAY_TO_INT, INT_TO_DAY,
    _get_full_name, _can_admin_enroll, _norm_term, _norm_text,
)
from .kardex_helpers import _resolve_plan_for_student, _build_pc_name_cache


# ══════════════════════════════════════════════════════════════
#  HELPERS DE PERÍODO
# ══════════════════════════════════════════════════════════════

def _period_obj(code: str, auto_create: bool = False):
    p = AcademicPeriod.objects.filter(code=code).first()
    if p or not auto_create:
        return p

    import re
    from datetime import date
    m = re.match(r'^(\d{4})-(I{1,2}|III?)$', (code or '').strip().upper())
    if not m:
        return None

    year = int(m.group(1))
    term = m.group(2)

    if term == 'I':
        start_d = date(year, 3, 1)
        end_d   = date(year, 7, 31)
    elif term == 'II':
        start_d = date(year, 8, 1)
        end_d   = date(year, 12, 31)
    else:
        start_d = date(year, 1, 1)
        end_d   = date(year, 2, 28)

    p, _ = AcademicPeriod.objects.get_or_create(
        code=code.strip().upper(),
        defaults=dict(start=start_d, end=end_d),
    )
    return p


def _guess_default_period_code() -> str:
    try:
        open_p = next(
            (p for p in AcademicPeriod.objects.all() if p.is_enrollment_open()),
            None,
        )
        if open_p:
            return open_p.code
    except Exception:
        pass
    try:
        last = AcademicPeriod.objects.order_by("-code").first()
        if last and (last.code or "").strip():
            return last.code.strip()
    except Exception:
        pass
    from datetime import date
    year = date.today().year
    sem  = "I" if date.today().month <= 6 else "II"
    return f"{year}-{sem}"


def _window_info_for_period(per: AcademicPeriod) -> dict:
    status    = per.enrollment_status()
    surcharge = float(per.extemporary_surcharge or 0)
    return {
        "status":                status,
        "is_open":               status != "CLOSED",
        "start":                 per.enrollment_start.isoformat()    if per.enrollment_start    else None,
        "end":                   per.enrollment_end.isoformat()      if per.enrollment_end      else None,
        "extemporary_start":     per.extemporary_start.isoformat()   if per.extemporary_start   else None,
        "extemporary_end":       per.extemporary_end.isoformat()     if per.extemporary_end     else None,
        "extemporary_surcharge": surcharge,
    }


# ══════════════════════════════════════════════════════════════
#  RESOLUCIÓN DE ESTUDIANTE
# ══════════════════════════════════════════════════════════════

def _resolve_student_from_request(request, dni=None, student_id=None):
    if dni:
        if not _can_admin_enroll(request.user):
            return None, Response({"detail": "No autorizado."}, status=403)
        st = StudentProfile.objects.filter(num_documento=str(dni).strip()).first()
        if not st:
            return None, Response({"detail": "Estudiante no encontrado por DNI."}, status=404)
        return st, None

    if student_id:
        if not _can_admin_enroll(request.user):
            st = StudentProfile.objects.filter(id=int(student_id), user=request.user).first()
            if not st:
                return None, Response({"detail": "No autorizado para este estudiante."}, status=403)
            return st, None
        else:
            st = StudentProfile.objects.filter(id=int(student_id)).first()
            if not st:
                return None, Response({"detail": "Estudiante no encontrado por ID."}, status=404)
            return st, None

    st = getattr(request.user, "student_profile", None)
    if not st:
        return None, Response({"detail": "Tu usuario no tiene estudiante vinculado."}, status=404)
    return st, None


# ══════════════════════════════════════════════════════════════
#  HELPERS DE VALIDACIÓN
# ══════════════════════════════════════════════════════════════

def _approved_info(student: StudentProfile):
    recs = (
        AcademicGradeRecord.objects
        .select_related("course")
        .filter(student=student)
        .values_list("course_id", "final_grade", "course__name")
    )

    best = {}
    for cid, fg, cname in recs:
        try:
            g = None if fg is None else float(fg)
        except Exception:
            g = None
        name_norm = _norm_text(cname or "")
        prev = best.get(cid)
        if prev is None or (g is not None and (prev[0] is None or g > prev[0])):
            best[cid] = (g, name_norm)

    approved_ids   = set()
    approved_names = set()
    for cid, (g, name_norm) in best.items():
        if g is not None and g >= PASSING_GRADE:
            approved_ids.add(cid)
            if name_norm:
                approved_names.add(name_norm)

    return approved_ids, approved_names


def _approved_course_ids(student: StudentProfile) -> set:
    ids, _ = _approved_info(student)
    return ids


def _is_course_approved(pc: PlanCourse, approved_ids: set, approved_names: set) -> bool:
    if pc.course_id in approved_ids:
        return True
    pc_name = _norm_text(
        getattr(pc, "display_name", "") or
        getattr(pc.course, "name", "") or ""
    )
    return bool(pc_name and pc_name in approved_names)


def _attempts_for_course(student: StudentProfile, pc: PlanCourse) -> int:
    count = AcademicGradeRecord.objects.filter(student=student, course_id=pc.course_id).count()
    if count > 0:
        return count

    pc_name = _norm_text(
        getattr(pc, "display_name", "") or
        getattr(pc.course, "name", "") or ""
    )
    if not pc_name:
        return 0

    for rec in AcademicGradeRecord.objects.select_related("course").filter(student=student):
        if _norm_text(getattr(rec.course, "name", "") or "") == pc_name:
            count += 1
    return count


def _is_third_attempt(student: StudentProfile, pc: PlanCourse) -> bool:
    return _attempts_for_course(student, pc) >= 2


def _max_credits_from_plan(plan_id: int) -> int:
    from django.db.models import Sum

    if not plan_id:
        return 0

    result = (
        PlanCourse.objects
        .filter(plan_id=plan_id, semester__gt=0)
        .values("semester")
        .annotate(total_credits=Sum("credits"))
        .order_by("-total_credits")
        .first()
    )

    return int(result["total_credits"] or 0) if result else 0


def _prereqs_met(plan_course_id: int, approved_ids: set, approved_names: set = None) -> bool:
    prereq_pc_ids = list(
        CoursePrereq.objects.filter(plan_course_id=plan_course_id)
        .values_list("prerequisite_id", flat=True)
    )
    if not prereq_pc_ids:
        return True

    if approved_names is None:
        approved_names = set()

    for pc in PlanCourse.objects.select_related("course").filter(id__in=prereq_pc_ids):
        if pc.course_id in approved_ids:
            continue
        pc_name = _norm_text(
            getattr(pc, "display_name", "") or
            getattr(pc.course, "name", "") or ""
        )
        if pc_name and pc_name in approved_names:
            continue
        return False

    return True


def _current_semester(student: StudentProfile) -> int:
    ciclo_val = 0
    if getattr(student, "ciclo", None):
        try:
            ciclo_val = max(1, int(student.ciclo))
        except Exception:
            ciclo_val = 0

    if not student.plan_id:
        pid = _resolve_plan_for_student(student)
        if not pid:
            return max(1, ciclo_val)

    approved_ids, approved_names = _approved_info(student)
    if not approved_ids and not approved_names:
        return max(1, ciclo_val)

    max_sem = 0
    for pc in PlanCourse.objects.select_related("course").filter(plan_id=student.plan_id):
        sem = int(pc.semester or 0)
        if sem <= 0:
            continue
        if _is_course_approved(pc, approved_ids, approved_names):
            max_sem = max(max_sem, sem)

    computed = max(1, max_sem + 1)
    return max(computed, ciclo_val)


def _overlaps(a_start, a_end, b_start, b_end):
    return a_end > b_start and b_end > a_start


def _detect_schedule_conflicts(sections):
    events = []
    for sec in sections:
        for sl in sec.schedule_slots.all():
            events.append((int(sl.weekday), sl.start, sl.end, sec.id))

    conflicts = []
    by_day    = {}
    for wd, st, en, sid in events:
        by_day.setdefault(wd, []).append((st, en, sid))

    for wd, items in by_day.items():
        items.sort(key=lambda x: x[0])
        for i in range(len(items) - 1):
            st1, en1, s1 = items[i]
            st2, en2, s2 = items[i + 1]
            if s1 == s2:
                continue
            if _overlaps(st1, en1, st2, en2):
                conflicts.append({
                    "type":    "OVERLAP",
                    "weekday": wd,
                    "a":       s1,
                    "b":       s2,
                    "message": (
                        f"Choque de horario (día {INT_TO_DAY.get(wd, wd)}) "
                        f"entre secciones {s1} y {s2}"
                    ),
                })
    return conflicts


def _pick_sections_for_pcs(plan_course_ids, academic_period: str, sections_map: dict):
    if not isinstance(sections_map, dict):
        sections_map = {}

    sections = list(
        Section.objects
        .prefetch_related("schedule_slots")
        .filter(plan_course_id__in=plan_course_ids, period=academic_period)
        .order_by("plan_course_id", "label", "id")
    )

    secs_by_pc = {}
    for s in sections:
        secs_by_pc.setdefault(s.plan_course_id, []).append(s)

    chosen = {}
    for pcid in plan_course_ids:
        raw_sec_id = sections_map.get(str(pcid)) or sections_map.get(pcid)
        sec_id = None
        if raw_sec_id is not None and str(raw_sec_id).strip():
            try:
                sec_id = int(raw_sec_id)
            except Exception:
                sec_id = None

        picked = None
        if sec_id:
            picked = next((x for x in secs_by_pc.get(pcid, []) if x.id == sec_id), None)
        if not picked:
            arr = secs_by_pc.get(pcid, [])
            picked = arr[0] if arr else None
        if picked:
            chosen[pcid] = picked

    return chosen


def _assert_enrollment_window(period_code: str):
    p = _period_obj(period_code, auto_create=True)
    if not p:
        return False, "PERIODO_INVALIDO"
    status = p.enrollment_status()
    if status == "CLOSED":
        return False, "MATRICULA_FUERA_DE_FECHA"
    return True, status


def _validate_enrollment_payload(request, st, academic_period, plan_course_ids, sections_map):
    ok_win, win_code = _assert_enrollment_window(academic_period)
    if not ok_win:
        return Response(
            {"errors": [win_code], "warnings": [], "schedule_conflicts": []},
            status=409,
        )

    if not st.plan_id:
        pid = _resolve_plan_for_student(st)
        if not pid:
            return Response(
                {"errors": ["SIN_PLAN"], "warnings": [], "schedule_conflicts": []},
                status=409,
            )

    pcs = list(
        PlanCourse.objects.select_related("course")
        .filter(id__in=plan_course_ids, plan_id=st.plan_id)
    )
    found   = {pc.id for pc in pcs}
    missing = [x for x in plan_course_ids if x not in found]
    if missing:
        return Response(
            {"errors": [f"PLAN_COURSE_INVALIDO:{missing}"], "warnings": [], "schedule_conflicts": []},
            status=409,
        )

    approved_ids, approved_names = _approved_info(st)

    inst       = InstitutionSettings.objects.filter(id=1).first()
    max_normal = int(getattr(inst, "max_credits_normal",       22) or 22)
    min_normal = int(getattr(inst, "min_credits_normal",       12) or 12)
    max_third  = int(getattr(inst, "max_credits_third_attempt", 11) or 11)

    plan_max = _max_credits_from_plan(st.plan_id)
    if plan_max > max_normal:
        max_normal = plan_max

    total_credits = sum(int(pc.credits or 0) for pc in pcs)
    has_third     = any(_is_third_attempt(st, pc) for pc in pcs)
    max_credits   = max_third if has_third else max_normal

    errors, warnings = [], []

    if total_credits > max_credits:
        errors.append(f"EXCESO_CREDITOS:{total_credits}>{max_credits}")
    if total_credits < min_normal:
        warnings.append(f"MINIMO_CREDITOS:{total_credits}<{min_normal}")

    for pc in pcs:
        if _is_course_approved(pc, approved_ids, approved_names):
            errors.append(f"YA_APROBADO:{pc.display_code or pc.course.code}")
        if not _prereqs_met(pc.id, approved_ids, approved_names):
            errors.append(f"FALTA_PRERREQUISITOS:{pc.display_code or pc.course.code}")

    chosen      = _pick_sections_for_pcs(plan_course_ids, academic_period, sections_map)
    missing_sec = [pcid for pcid in plan_course_ids if pcid not in chosen]
    if missing_sec:
        errors.append(f"SIN_SECCIONES:{missing_sec}")

    conflicts = _detect_schedule_conflicts(list(chosen.values()))
    if conflicts:
        errors.append("CHOQUE_HORARIO")

    if errors:
        return Response(
            {
                "errors":            errors,
                "warnings":          warnings,
                "schedule_conflicts": conflicts,
                "max_credits":       max_credits,
            },
            status=409,
        )
    return None


def _slots_for_section(section: Section):
    out = []
    for s in section.schedule_slots.all().order_by("weekday", "start"):
        out.append({
            "day":   INT_TO_DAY.get(int(s.weekday), str(s.weekday)),
            "start": str(s.start)[:5],
            "end":   str(s.end)[:5],
        })
    return out


def _dummy_pdf_response(filename="documento.pdf"):
    buf = BytesIO(b"%PDF-1.4\n% Dummy PDF\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n")
    return FileResponse(buf, as_attachment=True, filename=filename)


def _extract_ids_from_body(body: dict) -> list:
    raw = body.get("plan_course_ids") or body.get("course_ids") or []
    if not isinstance(raw, list) or not raw:
        return []
    try:
        return [int(x) for x in raw]
    except Exception:
        return []


def _extract_student_params(body: dict):
    dni        = (body.get("dni") or "").strip() or None
    student_id = None
    raw_sid    = body.get("student_id")
    if raw_sid is not None and str(raw_sid).strip():
        try:
            student_id = int(raw_sid)
        except (ValueError, TypeError):
            student_id = None
    return dni, student_id


# ══════════════════════════════════════════════════════════════
#  VISTA: STUDENTS OVERVIEW
#  GET /academic/enrollments/students-overview
# ══════════════════════════════════════════════════════════════

class StudentsOverviewView(APIView):
    """
    GET /academic/enrollments/students-overview

    Devuelve TODOS los estudiantes con su estado de matrícula
    en el período solicitado.

    Query params:
        academic_period  str  (requerido)   ej: "2026-I"
        search           str  (opcional)    filtra por nombre o DNI
        career_id        int  (opcional)    filtra por carrera (a través del plan)
        page             int  (opcional, default 1)
        page_size        int  (opcional, default 200, max 500)

    Response incluye:
        total           int  — total de alumnos (con filtros aplicados)
        enrolled_count  int  — alumnos con matrícula activa en el período
        pending_count   int  — alumnos sin matrícula en el período
        students        list — página de alumnos
    """
    authentication_classes = [JWTAuthentication]
    permission_classes     = [permissions.IsAuthenticated]

    def get(self, request):
        if not _can_admin_enroll(request.user):
            return Response({"detail": "No autorizado."}, status=403)

        academic_period = (
            request.query_params.get("academic_period") or _guess_default_period_code()
        ).strip()

        search    = (request.query_params.get("search") or "").strip()
        career_id = request.query_params.get("career_id")

        try:
            page      = max(1, int(request.query_params.get("page", 1)))
            page_size = min(500, max(1, int(request.query_params.get("page_size", 200))))
        except (ValueError, TypeError):
            page, page_size = 1, 200

        # ── 1. Base queryset ──────────────────────────────────
        qs = StudentProfile.objects.select_related("plan", "plan__career")

        if hasattr(StudentProfile, "is_active"):
            qs = qs.filter(is_active=True)

        if career_id:
            try:
                qs = qs.filter(plan__career_id=int(career_id))
            except (ValueError, TypeError):
                pass

        if search:
            qs = qs.filter(
                Q(num_documento__icontains=search)
                | Q(apellido_paterno__icontains=search)
                | Q(apellido_materno__icontains=search)
                | Q(nombres__icontains=search)
            )

        # ── 2. Subqueries de matrícula en el período ──────────
        enrollment_id_subq = (
            Enrollment.objects
            .filter(
                student_id=OuterRef("pk"),
                period=academic_period,
            )
            .exclude(status=Enrollment.STATUS_CANCELLED)
            .values("id")[:1]
        )

        enrolled_courses_subq = (
            EnrollmentItem.objects
            .filter(
                enrollment__student_id=OuterRef("pk"),
                enrollment__period=academic_period,
            )
            .exclude(enrollment__status=Enrollment.STATUS_CANCELLED)
            .values("enrollment__student_id")
            .annotate(cnt=Count("id"))
            .values("cnt")[:1]
        )

        enrolled_credits_subq = (
            EnrollmentItem.objects
            .filter(
                enrollment__student_id=OuterRef("pk"),
                enrollment__period=academic_period,
            )
            .exclude(enrollment__status=Enrollment.STATUS_CANCELLED)
            .values("enrollment__student_id")
            .annotate(total=Coalesce(Sum("credits"), 0, output_field=IntegerField()))
            .values("total")[:1]
        )

        # Semestre máximo de los cursos matriculados en el período
        enrolled_semester_subq = (
            EnrollmentItem.objects
            .filter(
                enrollment__student_id=OuterRef("pk"),
                enrollment__period=academic_period,
            )
            .exclude(enrollment__status=Enrollment.STATUS_CANCELLED)
            .values("enrollment__student_id")
            .annotate(max_sem=Max("plan_course__semester"))
            .values("max_sem")[:1]
        )

        qs = qs.annotate(
            _enrollment_id=Subquery(enrollment_id_subq),
            _enrolled_courses=Coalesce(
                Subquery(enrolled_courses_subq, output_field=IntegerField()), 0
            ),
            _enrolled_credits=Coalesce(
                Subquery(enrolled_credits_subq, output_field=IntegerField()), 0
            ),
            _enrolled_semester=Subquery(enrolled_semester_subq, output_field=IntegerField()),
        )

        # ── 3. Totales antes de paginar ───────────────────────
        # Estos counts reflejan los filtros (search, career_id) pero NO la paginación,
        # por eso el frontend puede mostrar los totales correctos en todos los casos.
        total          = qs.count()
        enrolled_count = qs.filter(_enrollment_id__isnull=False).count()
        pending_count  = qs.filter(_enrollment_id__isnull=True).count()

        # ── 3b. Filtro de tab (enrolled=true/false) ───────────
        # Se aplica DESPUÉS de computar los totales para que las tarjetas
        # sigan mostrando el total real y no el subconjunto filtrado.
        enrolled_filter = request.query_params.get("enrolled")
        if enrolled_filter == "true":
            qs = qs.filter(_enrollment_id__isnull=False)
            total = enrolled_count  # para la paginación del tab
        elif enrolled_filter == "false":
            qs = qs.filter(_enrollment_id__isnull=True)
            total = pending_count

        # ── 4. Paginación ─────────────────────────────────────
        offset = (page - 1) * page_size
        students_page = qs.order_by(
            "apellido_paterno", "apellido_materno", "nombres"
        )[offset: offset + page_size]

        # ── 5. Serializar ─────────────────────────────────────
        result = []
        for st in students_page:
            full_name = " ".join(filter(None, [
                getattr(st, "apellido_paterno", "") or "",
                getattr(st, "apellido_materno", "") or "",
                getattr(st, "nombres", "") or "",
            ])).strip()

            career_name   = ""
            career_id_val = None
            if st.plan_id and st.plan:
                try:
                    career_name   = st.plan.career.name if st.plan.career else ""
                    career_id_val = st.plan.career_id
                except Exception:
                    career_name = ""

            # Ciclo: si está matriculado en el período, usar el semestre máximo
            # de sus cursos matriculados; si no, usar st.ciclo como referencia.
            enrolled_sem = getattr(st, "_enrolled_semester", None)
            if enrolled_sem is not None:
                semester = int(enrolled_sem)
            else:
                try:
                    semester = max(1, int(st.ciclo or 1))
                except Exception:
                    semester = None

            result.append({
                "id":                     st.id,
                "full_name":              full_name,
                "dni":                    st.num_documento or "",
                "num_documento":          st.num_documento or "",
                "career_name":            career_name,
                "career_id":              career_id_val,
                "plan_name":              st.plan.name if st.plan_id and st.plan else "",
                "plan_id":                st.plan_id,
                "semester":               semester,
                "is_enrolled":            st._enrollment_id is not None,
                "enrollment_id":          st._enrollment_id,
                "enrolled_courses_count": st._enrolled_courses,
                "enrolled_credits":       st._enrolled_credits,
            })

        return ok(
            academic_period=academic_period,
            total=total,
            enrolled_count=enrolled_count,   # ← NUEVO: total matriculados con filtros
            pending_count=pending_count,     # ← NUEVO: total pendientes con filtros
            page=page,
            page_size=page_size,
            students=result,
        )


# ══════════════════════════════════════════════════════════════
#  VISTA: LISTA DE PERÍODOS ACADÉMICOS
# ══════════════════════════════════════════════════════════════

class AcademicPeriodsListView(APIView):
    """
    GET /academic/periods
    Lista todos los períodos académicos con su estado de ventana actual.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes     = [permissions.IsAuthenticated]

    def get(self, request):
        periods = AcademicPeriod.objects.all().order_by("-code")
        data = []
        for p in periods:
            data.append({
                "code":                  p.code,
                "start":                 str(p.start),
                "end":                   str(p.end),
                "enrollment_status":     p.enrollment_status(),
                "is_enrollment_open":    p.is_enrollment_open(),
                "enrollment_start":      p.enrollment_start.isoformat()    if p.enrollment_start    else None,
                "enrollment_end":        p.enrollment_end.isoformat()      if p.enrollment_end      else None,
                "extemporary_start":     p.extemporary_start.isoformat()   if p.extemporary_start   else None,
                "extemporary_end":       p.extemporary_end.isoformat()     if p.extemporary_end     else None,
                "extemporary_surcharge": float(p.extemporary_surcharge or 0),
            })
        return ok(periods=data)

    def post(self, request):
        if not _can_admin_enroll(request.user):
            return Response({"detail": "No autorizado."}, status=403)

        data = request.data or {}
        code  = (data.get("code") or "").strip().upper()
        start = data.get("start")
        end   = data.get("end")

        if not code:
            return Response({"detail": "El campo 'code' es requerido (ej: 2026-I)"}, status=400)
        if not start or not end:
            return Response({"detail": "Los campos 'start' y 'end' son requeridos"}, status=400)
        if AcademicPeriod.objects.filter(code=code).exists():
            return Response({"detail": f"Ya existe un período con código {code!r}"}, status=400)

        try:
            from datetime import date
            from django.utils.dateparse import parse_date
            start_date = parse_date(str(start))
            end_date   = parse_date(str(end))
            if not start_date or not end_date:
                raise ValueError("Fechas inválidas")
            if end_date < start_date:
                return Response({"detail": "La fecha de fin no puede ser anterior a la de inicio"}, status=400)
        except Exception as e:
            return Response({"detail": f"Fechas inválidas: {e}"}, status=400)

        p = AcademicPeriod.objects.create(code=code, start=start_date, end=end_date)
        return Response({
            "code":  p.code,
            "start": str(p.start),
            "end":   str(p.end),
            "enrollment_status": p.enrollment_status(),
        }, status=201)


# ══════════════════════════════════════════════════════════════
#  VISTA: VENTANA DE MATRÍCULA (GET + PUT)
# ══════════════════════════════════════════════════════════════

class AcademicPeriodEnrollmentWindowView(APIView):
    """
    GET  /academic/periods/{code}/enrollment-window
    PUT  /academic/periods/{code}/enrollment-window
    """
    authentication_classes = [JWTAuthentication]
    permission_classes     = [permissions.IsAuthenticated]

    def get(self, request, code: str):
        p = _period_obj(code, auto_create=True)
        if not p:
            return Response({"detail": f"Código de período inválido: '{code}'"}, status=400)
        return ok(code=p.code, **_window_info_for_period(p))

    def put(self, request, code: str):
        if not _can_admin_enroll(request.user):
            return Response({"detail": "No autorizado."}, status=403)

        p = _period_obj(code, auto_create=True)
        if not p:
            return Response({"detail": f"Código de período inválido: '{code}'"}, status=400)

        data = request.data or {}

        def _parse_dt(key):
            val = data.get(key)
            if not val:
                return None
            dt = parse_datetime(str(val))
            if dt and timezone.is_naive(dt):
                dt = timezone.make_aware(dt)
            return dt

        dt_start     = _parse_dt("enrollment_start")
        dt_end       = _parse_dt("enrollment_end")
        dt_ext_start = _parse_dt("extemporary_start")
        dt_ext_end   = _parse_dt("extemporary_end")

        if dt_start and dt_end and dt_end < dt_start:
            return Response({"detail": "enrollment_end no puede ser anterior a enrollment_start"}, status=400)
        if dt_ext_start and dt_ext_end and dt_ext_end < dt_ext_start:
            return Response({"detail": "extemporary_end no puede ser anterior a extemporary_start"}, status=400)
        if dt_start and dt_end and dt_ext_start and dt_ext_start < dt_end:
            return Response({"detail": "La ventana extemporánea debe iniciar después de que termine la ordinaria"}, status=400)

        surcharge     = 0
        raw_surcharge = data.get("extemporary_surcharge")
        if raw_surcharge is not None:
            try:
                surcharge = float(raw_surcharge)
                if surcharge < 0:
                    return Response({"detail": "extemporary_surcharge no puede ser negativo"}, status=400)
            except (ValueError, TypeError):
                return Response({"detail": "extemporary_surcharge debe ser un número"}, status=400)

        p.enrollment_start        = dt_start
        p.enrollment_end          = dt_end
        p.extemporary_start       = dt_ext_start
        p.extemporary_end         = dt_ext_end
        p.extemporary_surcharge   = surcharge
        p.save()

        return ok(success=True, code=p.code, **_window_info_for_period(p))


# ══════════════════════════════════════════════════════════════
#  CURSOS DISPONIBLES
# ══════════════════════════════════════════════════════════════

class AvailableCoursesView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes     = [permissions.IsAuthenticated]

    def get(self, request):
        plan_id         = request.query_params.get("plan_id")
        semester        = request.query_params.get("semester")
        q               = (request.query_params.get("q") or "").strip()
        academic_period = (
            request.query_params.get("academic_period") or _guess_default_period_code()
        ).strip()

        qs = PlanCourse.objects.select_related("plan", "course").all()
        if plan_id:
            try:
                qs = qs.filter(plan_id=int(plan_id))
            except Exception:
                return ok(courses=[])
        if semester:
            try:
                qs = qs.filter(semester=int(semester))
            except Exception:
                return ok(courses=[])
        if q:
            qs = qs.filter(
                Q(display_code__icontains=q) | Q(display_name__icontains=q) |
                Q(course__code__icontains=q) | Q(course__name__icontains=q)
            )

        qs              = qs.order_by("course__code")
        plan_course_ids = list(qs.values_list("id", flat=True))

        sections = (
            Section.objects
            .select_related("plan_course__course")
            .prefetch_related("schedule_slots")
            .filter(plan_course_id__in=plan_course_ids, period=academic_period)
            .order_by("plan_course_id", "label", "id")
        )

        secs_by_pc = {}
        for s in sections:
            secs_by_pc.setdefault(s.plan_course_id, []).append(s)

        def slots_to_str(sec):
            parts = []
            for sl in sec.schedule_slots.all().order_by("weekday", "start"):
                day = INT_TO_DAY.get(int(sl.weekday), str(sl.weekday))
                parts.append(f"{day} {str(sl.start)[:5]}-{str(sl.end)[:5]}")
            return ", ".join(parts)

        courses = []
        for pc in qs:
            secs  = secs_by_pc.get(pc.id, [])
            parts = [f"{s.label}: {slots_to_str(s)}" for s in secs[:3] if slots_to_str(s)]
            courses.append({
                "id":       pc.id,
                "code":     pc.display_code or pc.course.code,
                "name":     pc.display_name or pc.course.name,
                "credits":  int(pc.credits or 0),
                "schedule": " | ".join(parts),
            })
        return ok(courses=courses)


# ══════════════════════════════════════════════════════════════
#  MATRÍCULA: AVAILABLE
# ══════════════════════════════════════════════════════════════

class EnrollmentAvailableView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes     = [permissions.IsAuthenticated]

    def get(self, request):
        academic_period = (
            request.query_params.get("academic_period") or _guess_default_period_code()
        ).strip()
        dni = (request.query_params.get("dni") or "").strip() or None

        st, err = _resolve_student_from_request(request, dni=dni)
        if err:
            return err

        if not st.plan_id:
            pid = _resolve_plan_for_student(st)
            if not pid:
                return Response({"detail": "El estudiante no tiene plan asignado."}, status=409)

        per = _period_obj(academic_period, auto_create=True)
        if not per:
            return Response({"detail": f"Código de período inválido: '{academic_period}'"}, status=400)

        approved_ids, approved_names = _approved_info(st)
        current_sem = _current_semester(st)

        pcs = list(
            PlanCourse.objects.select_related("course")
            .filter(plan_id=st.plan_id)
            .order_by("semester", "course__code")
        )
        pc_ids = [pc.id for pc in pcs]

        sections = list(
            Section.objects
            .select_related("plan_course__course", "teacher__user")
            .prefetch_related("schedule_slots")
            .filter(plan_course_id__in=pc_ids, period=academic_period)
            .order_by("plan_course_id", "label", "id")
        )
        secs_by_pc = {}
        for s in sections:
            secs_by_pc.setdefault(s.plan_course_id, []).append(s)

        existing = (
            Enrollment.objects
            .filter(student=st, period=academic_period)
            .exclude(status="CANCELLED")
            .first()
        )
        enrolled_pc_ids = (
            set(existing.items.values_list("plan_course_id", flat=True))
            if existing else set()
        )

        def slots(sec):
            return [
                {
                    "day":   INT_TO_DAY.get(int(sl.weekday), str(sl.weekday)),
                    "start": str(sl.start)[:5],
                    "end":   str(sl.end)[:5],
                }
                for sl in sec.schedule_slots.all().order_by("weekday", "start")
            ]

        out_courses = []
        for pc in pcs:
            sem = int(pc.semester or 0)
            if sem <= 0:
                continue

            if _is_course_approved(pc, approved_ids, approved_names):
                continue

            if sem > current_sem:
                continue

            enabled = True
            reason  = ""

            if pc.id in enrolled_pc_ids:
                enabled, reason = False, "YA_MATRICULADO_EN_PERIODO"
            elif not _prereqs_met(pc.id, approved_ids, approved_names):
                enabled, reason = False, "FALTA_PRERREQUISITOS"
            elif pc.id not in secs_by_pc:
                enabled, reason = False, "SIN_SECCIONES_EN_PERIODO"

            attempts  = _attempts_for_course(st, pc)
            is_failed = attempts > 0

            out_courses.append({
                "id":             pc.id,
                "plan_course_id": pc.id,
                "course_id":      pc.course.id,
                "code":           pc.display_code or pc.course.code,
                "name":           pc.display_name or pc.course.name,
                "semester":       sem,
                "is_backlog":     sem < current_sem,
                "is_current":     sem == current_sem,
                "is_failed":      is_failed,
                "attempts":       attempts,
                "is_third_attempt": attempts >= 2,
                "credits":        int(pc.credits or 0),
                "weekly_hours":   int(pc.weekly_hours or 0),
                "enabled":        enabled,
                "blocked_reason": reason,
                "sections": [
                    {
                        "id":           s.id,
                        "label":        s.label,
                        "teacher_name": (
                            _get_full_name(getattr(s.teacher, "user", None))
                            if s.teacher else ""
                        ),
                        "capacity": s.capacity,
                        "slots":    slots(s),
                    }
                    for s in secs_by_pc.get(pc.id, [])
                ],
            })

        student_name = " ".join(filter(None, [
            getattr(st, "apellido_paterno", ""),
            getattr(st, "apellido_materno", ""),
            getattr(st, "nombres", ""),
        ])).strip()

        return ok(
            student={
                "id":            st.id,
                "student_id":    st.id,
                "dni":           st.num_documento,
                "full_name":     student_name,
                "name":          student_name,
                "num_documento": st.num_documento,
                "plan_id":       st.plan_id,
                "plan_name":     st.plan.name if st.plan else "",
            },
            academic_period=academic_period,
            enrollment_window=_window_info_for_period(per),
            current_semester=current_sem,
            courses=out_courses,
        )


# ══════════════════════════════════════════════════════════════
#  MATRÍCULA: VALIDATE
# ══════════════════════════════════════════════════════════════

class EnrollmentValidateView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes     = [permissions.IsAuthenticated]

    def post(self, request):
        body            = request.data or {}
        academic_period = (body.get("academic_period") or "").strip() or _guess_default_period_code()
        plan_course_ids = _extract_ids_from_body(body)
        if not plan_course_ids:
            return Response(
                {"detail": "Envía plan_course_ids o course_ids (lista no vacía)"},
                status=400,
            )

        dni, student_id = _extract_student_params(body)
        sections_map    = body.get("sections") or {}
        if not isinstance(sections_map, dict):
            sections_map = {}

        st, err = _resolve_student_from_request(request, dni=dni, student_id=student_id)
        if err:
            return err

        validate_resp = _validate_enrollment_payload(
            request=request,
            st=st,
            academic_period=academic_period,
            plan_course_ids=plan_course_ids,
            sections_map=sections_map,
        )
        if validate_resp is not None:
            return validate_resp

        pcs           = list(PlanCourse.objects.filter(id__in=plan_course_ids, plan_id=st.plan_id))
        total_credits = sum(int(pc.credits or 0) for pc in pcs)
        inst          = InstitutionSettings.objects.filter(id=1).first()
        max_normal    = int(getattr(inst, "max_credits_normal",       22) or 22)
        max_third     = int(getattr(inst, "max_credits_third_attempt", 11) or 11)

        plan_max = _max_credits_from_plan(st.plan_id)
        if plan_max > max_normal:
            max_normal = plan_max

        has_third   = any(_is_third_attempt(st, pc) for pc in pcs)
        max_credits = max_third if has_third else max_normal

        return ok(warnings=[], total_credits=total_credits, max_credits=max_credits)


# ══════════════════════════════════════════════════════════════
#  MATRÍCULA: SUGGESTIONS
# ══════════════════════════════════════════════════════════════

class EnrollmentSuggestionsView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes     = [permissions.IsAuthenticated]

    def post(self, request):
        body            = request.data or {}
        academic_period = (body.get("academic_period") or "").strip() or _guess_default_period_code()
        plan_course_ids = _extract_ids_from_body(body)
        if not plan_course_ids:
            return ok(suggestions=[])

        all_secs = list(
            Section.objects
            .select_related("plan_course__course", "teacher__user")
            .prefetch_related("schedule_slots")
            .filter(plan_course_id__in=plan_course_ids, period=academic_period)
            .order_by("plan_course_id", "label", "id")
        )

        chosen = {}
        by_pc  = {}
        for s in all_secs:
            by_pc.setdefault(s.plan_course_id, []).append(s)
            if s.plan_course_id not in chosen:
                chosen[s.plan_course_id] = s

        chosen_sections = list(chosen.values())
        base_conflicts  = _detect_schedule_conflicts(chosen_sections)
        if not base_conflicts:
            return ok(suggestions=[])

        conflict_pc_ids = set()
        for c in base_conflicts:
            a = next((s for s in chosen_sections if s.id == c["a"]), None)
            b = next((s for s in chosen_sections if s.id == c["b"]), None)
            if a:
                conflict_pc_ids.add(a.plan_course_id)
            if b:
                conflict_pc_ids.add(b.plan_course_id)

        suggestions = []
        for pc_id in conflict_pc_ids:
            current    = chosen.get(pc_id)
            candidates = [s for s in by_pc.get(pc_id, []) if (not current or s.id != current.id)]
            others     = [s for s in chosen_sections if s.plan_course_id != pc_id]

            for cand in candidates:
                if _detect_schedule_conflicts(others + [cand]):
                    continue
                pc           = cand.plan_course
                crs          = pc.course
                teacher_name = (
                    _get_full_name(getattr(cand.teacher, "user", None))
                    if cand.teacher else ""
                )
                suggestions.append({
                    "plan_course_id": pc.id,
                    "course_id":      pc.id,
                    "course_code":    pc.display_code or crs.code,
                    "course_name":    pc.display_name or crs.name,
                    "credits":        int(pc.credits or 0),
                    "section_id":     cand.id,
                    "section_code":   cand.label,
                    "teacher_name":   teacher_name,
                    "slots":          _slots_for_section(cand),
                    "capacity":       cand.capacity,
                    "available":      cand.capacity,
                })
                break

        return ok(suggestions=suggestions)


# ══════════════════════════════════════════════════════════════
#  MATRÍCULA: COMMIT
# ══════════════════════════════════════════════════════════════

class EnrollmentCommitView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes     = [permissions.IsAuthenticated]

    def post(self, request):
        body            = request.data or {}
        academic_period = (body.get("academic_period") or "").strip() or _guess_default_period_code()
        plan_course_ids = _extract_ids_from_body(body)
        if not plan_course_ids:
            return Response(
                {"detail": "Envía plan_course_ids o course_ids (lista no vacía)"},
                status=400,
            )

        dni, student_id = _extract_student_params(body)
        sections_map    = body.get("sections") or {}
        if not isinstance(sections_map, dict):
            sections_map = {}

        st, err = _resolve_student_from_request(request, dni=dni, student_id=student_id)
        if err:
            return err

        validate_resp = _validate_enrollment_payload(
            request=request,
            st=st,
            academic_period=academic_period,
            plan_course_ids=plan_course_ids,
            sections_map=sections_map,
        )
        if validate_resp is not None:
            return validate_resp

        pcs     = list(
            PlanCourse.objects.select_related("course")
            .filter(id__in=plan_course_ids, plan_id=st.plan_id)
        )
        chosen  = _pick_sections_for_pcs(plan_course_ids, academic_period, sections_map)
        missing = [pcid for pcid in plan_course_ids if pcid not in chosen]
        if missing:
            return Response(
                {"detail": "Hay cursos sin secciones en este período", "missing": missing},
                status=409,
            )

        conflicts = _detect_schedule_conflicts(list(chosen.values()))
        if conflicts:
            return Response(
                {"detail": "Choque de horario", "schedule_conflicts": conflicts},
                status=409,
            )

        with transaction.atomic():
            enrollment, _ = Enrollment.objects.get_or_create(student=st, period=academic_period)
            if enrollment.status == Enrollment.STATUS_CONFIRMED:
                return Response(
                    {"detail": "Ya existe una matrícula confirmada en este período."},
                    status=409,
                )

            EnrollmentItem.objects.filter(enrollment=enrollment).delete()

            total_credits = 0
            for pc in pcs:
                cr = int(pc.credits or 0)
                total_credits += cr
                EnrollmentItem.objects.create(
                    enrollment=enrollment,
                    plan_course=pc,
                    section=chosen.get(pc.id),
                    credits=cr,
                )

            enrollment.confirm()
            enrollment.total_credits = total_credits
            enrollment.save(update_fields=["total_credits"])

        return ok(
            success=True,
            enrollment_id=enrollment.id,
            academic_period=academic_period,
            total_credits=total_credits,
        )


# ══════════════════════════════════════════════════════════════
#  CERTIFICADO / HORARIO (STUBS PDF)
# ══════════════════════════════════════════════════════════════

class EnrollmentCertificateView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes     = [permissions.IsAuthenticated]

    def get(self, request, enrollment_id: int):
        return ok(
            success=True,
            downloadUrl=f"/api/academic/enrollments/{enrollment_id}/certificate/pdf",
            download_url=f"/api/academic/enrollments/{enrollment_id}/certificate/pdf",
        )

    def post(self, request, enrollment_id: int):
        return self.get(request, enrollment_id)


class EnrollmentCertificatePDFView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes     = [permissions.IsAuthenticated]

    def get(self, request, enrollment_id: int):
        return _dummy_pdf_response(f"matricula-{enrollment_id}.pdf")


class ScheduleExportView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes     = [permissions.IsAuthenticated]

    def post(self, request):
        data   = request.data or {}
        period = (data.get("academic_period") or _guess_default_period_code()).strip()

        params = f"academic_period={period}"
        if data.get("student_id"):
            params += f"&student_id={data['student_id']}"
        if data.get("dni"):
            params += f"&dni={data['dni']}"

        url = f"/api/academic/schedules/export/pdf?{params}"
        return ok(
            success=True,
            downloadUrl=url,
            download_url=url,
        )


class ScheduleExportPDFView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes     = [permissions.IsAuthenticated]

    def get(self, request):
        from io import BytesIO
        import os
        import urllib.request
        from django.http import HttpResponse
        from django.conf import settings as dj_settings
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.units import cm
        from reportlab.platypus import (
            SimpleDocTemplate, Table, TableStyle, Paragraph,
            Spacer, HRFlowable, Image,
        )
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

        period     = (request.query_params.get("academic_period") or _guess_default_period_code()).strip()
        dni        = (request.query_params.get("dni") or "").strip() or None
        student_id = request.query_params.get("student_id") or None

        st, err = _resolve_student_from_request(request, dni=dni, student_id=student_id)
        if err:
            return err

        student_name = " ".join(filter(None, [
            getattr(st, "apellido_paterno", "") or "",
            getattr(st, "apellido_materno", "") or "",
            getattr(st, "nombres", "") or "",
        ])).strip()
        student_doc = st.num_documento or ""
        plan_name   = st.plan.name if st.plan_id and st.plan else ""
        # ciclo_val se calcula después de cargar el enrollment (ver abajo)
        inst_name = 'I.E.S.P.P "GUSTAVO ALLENDE LLAVERIA"'
        inst_abbr = ""
        logo_url  = ""
        try:
            from catalogs.models import InstitutionSetting as CIS
            inst = CIS.objects.filter(pk=1).first()
            if inst:
                d = inst.data or {}
                inst_name = d.get("name", "") or inst_name
                inst_abbr = d.get("abbreviation", "") or d.get("abbr", "") or ""
                logo_url  = (d.get("logo_url", "") or d.get("logo", "")
                             or getattr(inst, "logo_url", "") or "")
        except Exception:
            pass

        enrollment = (
            Enrollment.objects
            .prefetch_related("items__plan_course__course", "items__section__schedule_slots")
            .filter(student=st, period=period)
            .exclude(status=Enrollment.STATUS_CANCELLED)
            .first()
        )

        schedule_rows = []
        if enrollment:
            for item in enrollment.items.select_related(
                "plan_course__course", "plan_course",
                "section__teacher__user", "section__classroom",
            ).prefetch_related("section__schedule_slots").all():
                pc  = item.plan_course
                sec = item.section
                course_name   = (getattr(pc, "display_name", "") or getattr(pc.course, "name", "") or "") if pc else ""
                course_code   = (getattr(pc, "display_code", "") or getattr(pc.course, "code", "") or "") if pc else ""
                credits       = int(getattr(pc, "credits", 0) or 0) if pc else 0
                semester      = int(getattr(pc, "semester", 0) or 0) if pc else 0
                section_label = sec.label if sec else "—"
                teacher_name  = (
                    _get_full_name(getattr(sec.teacher, "user", None))
                    if sec and sec.teacher else "—"
                )
                room_name = "—"
                if sec and sec.classroom:
                    room_name = sec.classroom.code or sec.classroom.name or "—"

                slots = []
                if sec:
                    for sl in sec.schedule_slots.all().order_by("weekday", "start"):
                        day_name = {
                            1: "Lunes", 2: "Martes", 3: "Miércoles",
                            4: "Jueves", 5: "Viernes", 6: "Sábado", 7: "Domingo",
                        }.get(int(sl.weekday), str(sl.weekday))
                        t_start = str(sl.start)[:5]
                        t_end   = str(sl.end)[:5]
                        try:
                            h = int(t_start.split(":")[0])
                            ampm = "AM" if h < 12 else "PM"
                        except Exception:
                            ampm = ""
                        slots.append(f"{day_name} {t_start}–{t_end} {ampm}".strip())

                schedule_rows.append({
                    "course_name":  course_name.upper(),
                    "course_code":  course_code,
                    "credits":      credits,
                    "semester":     semester,
                    "section":      section_label,
                    "teacher":      teacher_name,
                    "room":         room_name,
                    "horario":      "\n".join(slots) if slots else "Sin horario",
                })

        schedule_rows.sort(key=lambda r: (r["semester"] or 99, r["course_name"]))

        # Ciclo: usar el semestre máximo de los cursos matriculados;
        # si no hay matrícula, caer en st.ciclo como referencia.
        try:
            if schedule_rows:
                ciclo_val = str(max(r["semester"] for r in schedule_rows if r["semester"]))
            elif enrollment:
                max_sem = enrollment.items.select_related("plan_course") \
                    .aggregate(m=Max("plan_course__semester"))["m"]
                ciclo_val = str(int(max_sem)) if max_sem else ""
            else:
                ciclo_val = str(int(getattr(st, "ciclo", None) or 0)) if getattr(st, "ciclo", None) else ""
        except Exception:
            ciclo_val = str(getattr(st, "ciclo", "") or "")

        buf = BytesIO()
        PAGE_W, PAGE_H = A4
        L_MAR = R_MAR = 1.5 * cm
        T_MAR = 1.5 * cm
        B_MAR = 2.0 * cm
        W = PAGE_W - L_MAR - R_MAR

        doc = SimpleDocTemplate(
            buf, pagesize=A4,
            leftMargin=L_MAR, rightMargin=R_MAR,
            topMargin=T_MAR,  bottomMargin=B_MAR,
        )

        styles = getSampleStyleSheet()
        BLACK  = colors.black
        NAVY   = colors.HexColor("#1e3a5f")
        LGRAY  = colors.HexColor("#f0f4fb")
        BDBLUE = colors.HexColor("#bfcfe8")

        def sty(name, **kw):
            base = kw.pop("parent", styles["Normal"])
            return ParagraphStyle(name, parent=base, **kw)

        inst_sty  = sty("IS",  fontSize=13, fontName="Helvetica-Bold",
                         textColor=NAVY, alignment=TA_CENTER, spaceAfter=1, leading=16)
        hcls_sty  = sty("HC",  fontSize=11, fontName="Helvetica-Bold",
                         textColor=NAVY, alignment=TA_CENTER, spaceBefore=4, spaceAfter=1)
        per_sty   = sty("PR",  fontSize=9,  fontName="Helvetica-Bold",
                         textColor=NAVY, alignment=TA_CENTER, spaceBefore=2)
        info_sty  = sty("INF", fontSize=8.5, textColor=BLACK, leading=12)
        th_sty    = sty("TH",  fontSize=8,  fontName="Helvetica-Bold",
                         textColor=colors.white, alignment=TA_CENTER, leading=10)
        td_sty    = sty("TD",  fontSize=8,  textColor=BLACK, leading=11, wordWrap="CJK")
        ts_sty    = sty("TS",  fontSize=7.5, textColor=BLACK, leading=10, wordWrap="CJK")
        tc_sty    = sty("TC",  fontSize=8,  textColor=BLACK, leading=11,
                         alignment=TA_CENTER, wordWrap="CJK")
        ft_sty    = sty("FT",  fontSize=7,  textColor=colors.HexColor("#888888"),
                         alignment=TA_CENTER)
        tot_sty   = sty("TOT", fontSize=9,  fontName="Helvetica-Bold",
                         textColor=NAVY)
        tot_r_sty = sty("TOR", fontSize=9,  textColor=colors.HexColor("#444444"),
                         alignment=TA_RIGHT)

        story = []

        logo_img = None
        if logo_url:
            try:
                img_data = BytesIO()
                if logo_url.startswith("http://") or logo_url.startswith("https://"):
                    with urllib.request.urlopen(logo_url, timeout=5) as resp:
                        img_data.write(resp.read())
                else:
                    media_url = getattr(dj_settings, "MEDIA_URL", "/media/")
                    rel = logo_url
                    if rel.startswith(media_url):
                        rel = rel[len(media_url):]
                    rel = rel.lstrip("/")
                    abs_path = os.path.join(dj_settings.MEDIA_ROOT, rel)
                    if os.path.exists(abs_path):
                        with open(abs_path, "rb") as f:
                            img_data.write(f.read())
                img_data.seek(0)
                if img_data.getbuffer().nbytes > 200:
                    logo_img = Image(img_data, width=2.4*cm, height=2.4*cm, kind="proportional")
            except Exception:
                logo_img = None

        header_text = [
            Paragraph(inst_name, inst_sty),
            Paragraph("HORARIO DE CLASES", hcls_sty),
            Paragraph(f"Período Académico: {period}", per_sty),
        ]

        if logo_img:
            hdr_tbl = Table(
                [[logo_img, header_text, ""]],
                colWidths=[2.7*cm, W - 2.9*cm, 0.2*cm],
            )
            hdr_tbl.setStyle(TableStyle([
                ("VALIGN",       (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING",  (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING",   (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING",(0, 0), (-1, -1), 0),
            ]))
            story.append(hdr_tbl)
        else:
            for p in header_text:
                story.append(p)

        story.append(Spacer(1, 0.3*cm))
        story.append(HRFlowable(width="100%", thickness=2, color=NAVY, spaceAfter=8))

        estado_txt = "Matriculado" if enrollment else "Sin matrícula"
        ciclo_txt  = f"Ciclo: <b>{ciclo_val}°</b>" if ciclo_val else "Ciclo: —"

        def ic(label, value):
            return Paragraph(f"<b>{label}:</b> {value}", info_sty)

        info_rows = [
            [ic("Alumno",   student_name),     ic("DNI",    student_doc)],
            [ic("Programa", plan_name),         Paragraph(f"<b>Estado:</b> {estado_txt}  ·  {ciclo_txt}", info_sty)],
        ]
        info_t = Table(info_rows, colWidths=[W*0.62, W*0.38])
        info_t.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, -1), LGRAY),
            ("BOX",           (0, 0), (-1, -1), 1.0, NAVY),
            ("LINEBELOW",     (0, 0), (-1, 0),  0.4, BDBLUE),
            ("TOPPADDING",    (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING",   (0, 0), (-1, -1), 8),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
        ]))
        story.append(info_t)
        story.append(Spacer(1, 0.45*cm))

        if not schedule_rows:
            story.append(Paragraph(
                "No se encontraron cursos matriculados para este período.",
                sty("W", fontSize=9, textColor=colors.HexColor("#c0392b"), alignment=TA_CENTER),
            ))
        else:
            col_w = [0.75*cm, 4.2*cm, 2.0*cm, 0.75*cm, 0.75*cm, 2.85*cm, 2.5*cm, 3.7*cm]

            thead = [
                Paragraph("N°",      th_sty),
                Paragraph("Curso",   th_sty),
                Paragraph("Código",  th_sty),
                Paragraph("Cr.",     th_sty),
                Paragraph("Sec",     th_sty),
                Paragraph("Docente", th_sty),
                Paragraph("Aula",    th_sty),
                Paragraph("Horario", th_sty),
            ]
            table_data = [thead]

            for i, row in enumerate(schedule_rows, start=1):
                table_data.append([
                    Paragraph(str(i),              tc_sty),
                    Paragraph(row["course_name"],   td_sty),
                    Paragraph(row["course_code"],   ts_sty),
                    Paragraph(str(row["credits"]),  tc_sty),
                    Paragraph(row["section"],       tc_sty),
                    Paragraph(row["teacher"],       ts_sty),
                    Paragraph(row["room"],          ts_sty),
                    Paragraph(row["horario"],       ts_sty),
                ])

            sched_tbl = Table(table_data, colWidths=col_w, repeatRows=1)
            n_rows    = len(table_data)

            ts = TableStyle([
                ("BACKGROUND",    (0, 0), (-1, 0),  NAVY),
                ("TEXTCOLOR",     (0, 0), (-1, 0),  colors.white),
                ("FONTNAME",      (0, 0), (-1, 0),  "Helvetica-Bold"),
                ("FONTSIZE",      (0, 0), (-1, 0),  8),
                ("ALIGN",         (0, 0), (-1, 0),  "CENTER"),
                ("VALIGN",        (0, 0), (-1, 0),  "MIDDLE"),
                ("TOPPADDING",    (0, 0), (-1, 0),  7),
                ("BOTTOMPADDING", (0, 0), (-1, 0),  7),
                ("LEFTPADDING",   (0, 0), (-1, 0),  2),
                ("RIGHTPADDING",  (0, 0), (-1, 0),  2),
                ("LINEBELOW",     (0, 0), (-1, 0),  1.5, NAVY),
                ("FONTSIZE",      (0, 1), (-1, -1), 8),
                ("TOPPADDING",    (0, 1), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 1), (-1, -1), 5),
                ("LEFTPADDING",   (0, 1), (-1, -1), 4),
                ("RIGHTPADDING",  (0, 1), (-1, -1), 4),
                ("VALIGN",        (0, 1), (-1, -1), "MIDDLE"),
                ("TEXTCOLOR",     (0, 1), (-1, -1), BLACK),
                ("GRID",          (0, 0), (-1, -1), 0.4, BDBLUE),
                ("BOX",           (0, 0), (-1, -1), 1.0, NAVY),
            ])
            for r in range(1, n_rows):
                bg = LGRAY if r % 2 == 0 else colors.white
                ts.add("BACKGROUND", (0, r), (-1, r), bg)

            sched_tbl.setStyle(ts)
            story.append(sched_tbl)

            total_cr = sum(r["credits"] for r in schedule_rows)
            story.append(Spacer(1, 0.3*cm))
            tot_row = Table(
                [[Paragraph(f"Total de créditos matriculados: {total_cr}", tot_sty),
                  Paragraph(f"{len(schedule_rows)} curso{'s' if len(schedule_rows) != 1 else ''} matriculado{'s' if len(schedule_rows) != 1 else ''}", tot_r_sty)]],
                colWidths=[W*0.55, W*0.45],
            )
            tot_row.setStyle(TableStyle([
                ("LEFTPADDING",  (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING",   (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING",(0, 0), (-1, -1), 0),
            ]))
            story.append(tot_row)

        story.append(Spacer(1, 1.5*cm))
        story.append(HRFlowable(width="100%", thickness=0.5,
                                color=colors.HexColor("#cccccc"), spaceAfter=5))
        from django.utils import timezone as tz
        fecha = tz.now().strftime("%d/%m/%Y %H:%M")
        footer_inst = inst_abbr or inst_name
        story.append(Paragraph(
            f"Documento generado el {fecha}  ·  {footer_inst}  ·  Sistema Académico",
            ft_sty,
        ))

        doc.build(story)
        buf.seek(0)
        filename = f"horario-{student_doc}-{period}.pdf"
        return HttpResponse(
            buf.getvalue(),
            content_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )