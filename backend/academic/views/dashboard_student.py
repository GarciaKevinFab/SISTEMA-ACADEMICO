# academic/views/dashboard_student.py
"""
Dashboard del estudiante — 3 endpoints.
Usa modelos reales:
  students.Student, catalogs.Period, academic.AcademicGradeRecord,
  academic.Enrollment/EnrollmentItem, academic.AttendanceSession/AttendanceRow,
  academic.SectionScheduleSlot, academic.Section
"""

from collections import defaultdict
from datetime import date
from django.db.models import Avg, Sum, FloatField
from django.db.models.functions import Coalesce
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from students.models import Student
from catalogs.models import Period
from academic.models import (
    PlanCourse, Section, Enrollment, EnrollmentItem,
    AcademicGradeRecord, AttendanceSession, AttendanceRow,
    SectionScheduleSlot,
)
from .kardex import _detect_active_stint_periods
from .utils import _term_sort_key

PASSING_GRADE = 11
WEEKDAY_NAMES = {1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes", 6: "Sábado", 7: "Domingo"}


def _current_period():
    return Period.objects.filter(is_active=True).first()


def _student_of(user):
    try:
        return Student.objects.select_related("plan").get(user=user)
    except Student.DoesNotExist:
        return None


def _section_name(section):
    pc = getattr(section, "plan_course", None)
    if pc:
        course = getattr(pc, "course", None)
        if course:
            for attr in ("name", "nombre"):
                v = getattr(course, attr, None)
                if v:
                    return v
        for attr in ("name", "nombre"):
            v = getattr(pc, attr, None)
            if v:
                return v
    return getattr(section, "label", "") or f"Sección {section.id}"


def _classroom_name(section):
    cr = getattr(section, "classroom", None)
    if cr:
        return getattr(cr, "name", None) or getattr(cr, "nombre", "") or str(cr)
    return ""


def _enrolled_section_ids(student, period=None):
    """IDs de sección de la matrícula del alumno (opcionalmente de un período).

    `period` acepta el código ("2026-I") o el objeto `catalogs.Period`. Antes
    se filtraba el CharField `Enrollment.period` con el OBJETO directamente,
    que Django convierte con str() → "2026-I - 2026-I" (código + label): no
    coincidía nunca, la lista salía vacía y el alumno veía "Horario no
    disponible" aunque estuviera matriculado.
    """
    qs = Enrollment.objects.filter(student=student)
    if period is not None:
        code = period if isinstance(period, str) else (
            getattr(period, "code", "") or f"{period.year}-{period.term}")
        qs = qs.filter(period=code)
    enroll_ids = list(qs.values_list("id", flat=True))
    items = list(EnrollmentItem.objects
                 .filter(enrollment_id__in=enroll_ids)
                 .values_list("section_id", "plan_course_id"))

    out = {sid for sid, _pc in items if sid}

    # Ítems con section NULL (típico: matriculados antes de crear secciones).
    # Si el curso tiene UNA sola sección en el período, es esa sin ambigüedad
    # — mismo criterio que el acta (`acta_excel._items_de_seccion`).
    sueltos = {pc for sid, pc in items if not sid and pc}
    if sueltos:
        secs_qs = Section.objects.filter(plan_course_id__in=sueltos)
        if period is not None:
            secs_qs = secs_qs.filter(period=code)
        por_curso = defaultdict(list)
        for sid, pc in secs_qs.values_list("id", "plan_course_id"):
            por_curso[pc].append(sid)
        for pc, sids in por_curso.items():
            if len(sids) == 1:
                out.add(sids[0])
    return list(out)


# ─────────────────────────────────────────────
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def student_dashboard(request):
    """GET /api/academic/student/dashboard"""
    student = _student_of(request.user)
    if not student:
        return Response({"detail": "No se encontró perfil de estudiante."}, status=404)

    period = _current_period()

    # ── Detección de stint activo (reingreso) ──
    all_terms = set(
        AcademicGradeRecord.objects.filter(student=student)
        .values_list("term", flat=True).distinct()
    )
    active_periods = _detect_active_stint_periods(all_terms)
    has_prior_enrollment = len(all_terms - active_periods) > 0
    active_sorted = sorted(active_periods, key=_term_sort_key) if active_periods else []
    active_since = active_sorted[0] if active_sorted else None

    # ── Registros académicos del stint activo ──
    all_records = AcademicGradeRecord.objects.filter(
        student=student
    ).select_related("plan_course")

    # Filtrar solo períodos del stint activo
    active_records = all_records.filter(term__in=active_periods) if active_periods else all_records

    # Créditos aprobados (solo stint activo)
    credits_approved = sum(
        getattr(gr.plan_course, "credits", 0) or 0
        for gr in active_records.filter(final_grade__gte=PASSING_GRADE)
        if gr.plan_course
    )

    # Créditos totales del plan
    plan = getattr(student, "plan", None)
    credits_total = PlanCourse.objects.filter(plan=plan).aggregate(
        total=Coalesce(Sum("credits"), 0)
    )["total"] if plan else 0

    # ── PPA ponderado (solo stint activo) ──
    # PPA = sum(nota * créditos) / sum(créditos)
    sum_w = 0.0
    sum_c = 0
    for gr in active_records:
        g = gr.final_grade
        cr = int(getattr(gr.plan_course, "credits", 0) or 0) if gr.plan_course else 0
        if g is not None and cr > 0:
            sum_w += float(g) * cr
            sum_c += cr
    avg = round(sum_w / sum_c, 2) if sum_c > 0 else 0.0

    # Cursos matriculados
    section_ids = _enrolled_section_ids(student, period)
    enrolled_courses = len(section_ids)

    # Asistencia
    attendance_rate = 0
    if section_ids:
        sess_ids = AttendanceSession.objects.filter(
            section_id__in=section_ids
        ).values_list("id", flat=True)
        total_att = AttendanceRow.objects.filter(session_id__in=sess_ids, student_id=student.id).count()
        present_att = AttendanceRow.objects.filter(
            session_id__in=sess_ids, student_id=student.id, status__in=["PRESENT", "P", "A"]
        ).count()
        if total_att > 0:
            attendance_rate = round((present_att / total_att) * 100, 1)

    # ── Mérito por programa (PPA ponderado con stint, bulk) ──
    programa = getattr(student, "programa_carrera", "") or ""
    merit = None
    total_in_career = 0
    if programa:
        career_students = list(
            Student.objects.filter(programa_carrera=programa).values_list("id", flat=True)
        )
        total_in_career = len(career_students)

        # Traer TODOS los registros de la carrera en una sola query
        career_records = (
            AcademicGradeRecord.objects
            .filter(student_id__in=career_students)
            .select_related("plan_course")
            .values_list("student_id", "term", "final_grade", "plan_course__credits")
        )

        # Agrupar por estudiante: {student_id: {terms: set, records: [(grade, credits)]}}
        by_student = defaultdict(lambda: {"terms": set(), "recs": []})
        for sid, term, grade, credits in career_records:
            by_student[sid]["terms"].add(term)
            by_student[sid]["recs"].append((term, grade, int(credits or 0)))

        # Calcular PPA ponderado con stint para cada estudiante
        better_count = 0
        for sid in career_students:
            if sid == student.id:
                continue
            info = by_student.get(sid)
            if not info or not info["terms"]:
                continue
            peer_active = _detect_active_stint_periods(info["terms"])
            pw, pc_ = 0.0, 0
            for term, g, cr in info["recs"]:
                if term in peer_active and g is not None and cr > 0:
                    pw += float(g) * cr
                    pc_ += cr
            peer_avg = round(pw / pc_, 2) if pc_ > 0 else 0.0
            if peer_avg > avg:
                better_count += 1
        merit = better_count + 1

    return Response({
        "avg_grade": avg,
        "credits_approved": credits_approved,
        "credits_total": credits_total,
        "current_semester": getattr(student, "ciclo", None),
        "career": programa,
        "career_name": programa,
        "enrolled_courses": enrolled_courses,
        "attendance_rate": attendance_rate,
        "merit": merit,
        "total_in_career": total_in_career,
        # ── Reingreso ──
        "has_prior_enrollment": has_prior_enrollment,
        "active_since": active_since,
    })


# ─────────────────────────────────────────────
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def student_grades_summary(request):
    """GET /api/academic/student/grades/summary"""
    student = _student_of(request.user)
    if not student:
        return Response({"detail": "No se encontró perfil de estudiante."}, status=404)

    period = _current_period()
    grades_qs = AcademicGradeRecord.objects.filter(
        student=student
    ).select_related("plan_course", "plan_course__course", "course")

    if period:
        code = getattr(period, "code", None) or str(period)
        if code:
            grades_qs = grades_qs.filter(term=code)

    courses = []
    for gr in grades_qs:
        pc = getattr(gr, "plan_course", None)
        course_obj = getattr(pc, "course", None) if pc else getattr(gr, "course", None)
        name = ""
        if course_obj:
            name = getattr(course_obj, "name", "") or getattr(course_obj, "nombre", "")
        if not name and pc:
            name = getattr(pc, "name", "") or getattr(pc, "nombre", "")
        grade_val = float(gr.final_grade) if gr.final_grade is not None else 0
        courses.append({
            "name": name or f"Curso {gr.id}",
            "grade": grade_val,
            "credits": (getattr(pc, "credits", 0) or 0) if pc else 0,
            "status": "aprobado" if grade_val >= PASSING_GRADE else "desaprobado",
        })

    vals = [c["grade"] for c in courses if c["grade"] > 0]
    avg = round(sum(vals) / len(vals), 2) if vals else 0
    credits_approved = sum(c["credits"] for c in courses if c["status"] == "aprobado")
    plan = getattr(student, "plan", None)
    credits_total = PlanCourse.objects.filter(plan=plan).aggregate(
        total=Coalesce(Sum("credits"), 0)
    )["total"] if plan else 0

    return Response({
        "avg": avg,
        "credits_approved": credits_approved,
        "credits_total": credits_total,
        "courses": courses,
    })


# ─────────────────────────────────────────────
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def student_courses_detail(request):
    """
    GET /api/academic/student/me/cursos[?period=2026-I]
    Notas (acta en vivo + kárdex) y asistencia del alumno POR CURSO, más su
    promedio ponderado del período. Para la boleta del alumno y su dashboard.
    """
    from academic.models import (
        EnrollmentItem, Enrollment, Section, SectionGrades,
        AttendanceSession, AttendanceRow,
    )

    student = _student_of(request.user)
    if not student:
        return Response({"detail": "No se encontró perfil de estudiante."}, status=404)

    period_q = (request.query_params.get("period") or "").strip().upper()
    if not period_q:
        per = _current_period()
        period_q = (getattr(per, "code", None) or "").strip() or ""
    if not period_q:
        return Response({"detail": "No hay período activo"}, status=400)

    keys = [k for k in (student.user_id, student.id) if k is not None]

    items = (EnrollmentItem.objects
             .filter(enrollment__student=student, enrollment__period=period_q)
             .exclude(enrollment__status=Enrollment.STATUS_CANCELLED)
             .select_related("plan_course__course", "section"))

    cursos = []
    ptos, creds = 0.0, 0
    for item in items:
        pc = item.plan_course
        if not pc:
            continue
        sec = item.section or (Section.objects
                               .filter(plan_course=pc, period=period_q)
                               .order_by("label", "id").first())
        teacher_name = ""
        entry = {}
        sesiones = faltas = tardanzas = 0
        if sec:
            if sec.teacher and sec.teacher.user:
                teacher_name = (getattr(sec.teacher.user, "full_name", "")
                                or sec.teacher.user.username or "")
            bundle = SectionGrades.objects.filter(section=sec).first()
            grades = (bundle.grades or {}) if bundle else {}
            for k in keys:
                e = grades.get(str(k))
                if isinstance(e, dict):
                    entry = e
                    break
            # Con LICENCIA no se computa asistencia (ni faltas ni % ni riesgo)
            if (getattr(student, "estado_academico", "") or "").upper() != "LICENCIA":
                sess_ids = list(AttendanceSession.objects
                                .filter(section=sec).values_list("id", flat=True))
                sesiones = len(sess_ids)
                if sess_ids:
                    rows = AttendanceRow.objects.filter(
                        session_id__in=sess_ids, student_id__in=keys)
                    for r in rows.values_list("status", flat=True):
                        s = (r or "").upper()
                        if s == "ABSENT":
                            faltas += 1
                        elif s == "LATE":
                            tardanzas += 1

        # nota: acta en vivo → si ya fue procesada, kárdex manda
        kardex = AcademicGradeRecord.objects.filter(
            student=student, course=pc.course, term=period_q).first()
        promedio = None
        if kardex is not None and kardex.final_grade is not None:
            promedio = round(float(kardex.final_grade))
        else:
            for k in ("final_grade", "PROMEDIO_FINAL"):
                try:
                    v = float(entry.get(k))
                    if 0 <= v <= 20:
                        promedio = round(v)
                        break
                except (TypeError, ValueError):
                    continue

        credits = int(getattr(pc, "credits", 0) or 0)
        if promedio is not None:
            ptos += promedio * (credits or 1)
            creds += (credits or 1)

        pct = round(faltas / sesiones * 100) if sesiones else 0
        calif = ""
        if (entry.get("status") or "").upper() == "DPI":
            calif = "DPI"
        elif promedio is not None:
            calif = ("Destacado" if promedio >= 20 else
                     "Logrado" if promedio >= 15 else
                     "En proceso" if promedio >= 11 else
                     "Inicio" if promedio >= 6 else "Previo al inicio")

        cursos.append({
            "section_id": sec.id if sec else None,
            "code": pc.effective_code,
            "name": pc.effective_name,
            "teacher": teacher_name,
            "seccion": sec.label if sec else "",
            "credits": credits,
            "c1": entry.get("C1"), "c2": entry.get("C2"), "c3": entry.get("C3"),
            "c1_level": entry.get("C1_LEVEL", ""),
            "c2_level": entry.get("C2_LEVEL", ""),
            "c3_level": entry.get("C3_LEVEL", ""),
            "promedio": promedio,
            "calificacion": calif,
            "procesado": kardex is not None,
            "sesiones": sesiones,
            "faltas": faltas,
            "tardanzas": tardanzas,
            "pct_faltas": pct,
            "en_riesgo": sesiones > 0 and (faltas / sesiones) > 0.30,
        })

    cursos.sort(key=lambda c: c["name"])
    pga = round(ptos / creds, 2) if creds else None
    return Response({"period": period_q, "pga": pga, "cursos": cursos})


# ─────────────────────────────────────────────
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def student_course_detail(request, section_id: int):
    """
    GET /api/academic/student/me/curso/<section_id>/detalle
    Detalle de UN curso para el alumno: asistencia sesión por sesión,
    su acta completa (niveles + recomendaciones) e historial del curso.
    """
    from academic.models import (
        EnrollmentItem, Enrollment, Section, SectionGrades,
        AttendanceSession, AttendanceRow,
    )

    student = _student_of(request.user)
    if not student:
        return Response({"detail": "No se encontró perfil de estudiante."}, status=404)

    sec = Section.objects.select_related(
        "plan_course__course", "teacher__user", "classroom").filter(id=section_id).first()
    if not sec:
        return Response({"detail": "Sección no encontrada"}, status=404)

    # Debe estar matriculado en esa sección (o en el curso del período)
    enrolled = (EnrollmentItem.objects
                .filter(enrollment__student=student,
                        enrollment__period=sec.period)
                .exclude(enrollment__status=Enrollment.STATUS_CANCELLED)
                .filter(models_q_section_or_pc(sec))
                .exists())
    if not enrolled:
        return Response({"detail": "No estás matriculado en este curso."}, status=403)

    keys = [k for k in (student.user_id, student.id) if k is not None]

    # ── Asistencia por sesión ──
    MARK = {"PRESENT": "P", "LATE": "T", "ABSENT": "F", "EXCUSED": "J", "HOLIDAY": "0"}
    sesiones = []
    for sess in (AttendanceSession.objects.filter(section=sec)
                 .prefetch_related("rows").order_by("date")):
        mark = ""
        for row in sess.rows.all():
            if row.student_id in keys:
                mark = MARK.get((row.status or "").upper(), "")
                break
        sesiones.append({"date": sess.date.isoformat(), "mark": mark,
                         "closed": bool(sess.closed)})

    # ── Acta completa del alumno ──
    bundle = SectionGrades.objects.filter(section=sec).first()
    grades = (bundle.grades or {}) if bundle else {}
    entry = {}
    for k in keys:
        e = grades.get(str(k))
        if isinstance(e, dict):
            entry = e
            break
    acta = {
        "c1_level": entry.get("C1_LEVEL", ""), "c1_rec": entry.get("C1_REC", ""),
        "c2_level": entry.get("C2_LEVEL", ""), "c2_rec": entry.get("C2_REC", ""),
        "c3_level": entry.get("C3_LEVEL", ""), "c3_rec": entry.get("C3_REC", ""),
        "c1": entry.get("C1"), "c2": entry.get("C2"), "c3": entry.get("C3"),
        "promedio": entry.get("PROMEDIO_FINAL"),
        "estado": entry.get("ESTADO", ""),
        "dpi": (entry.get("status") or "").upper() == "DPI",
        "acta_cerrada": bool(bundle and bundle.submitted),
    }

    # ── Historial del curso en todos los períodos ──
    historial = []
    if sec.plan_course and sec.plan_course.course_id:
        for rec in (AcademicGradeRecord.objects
                    .filter(student=student, course_id=sec.plan_course.course_id)
                    .order_by("term")):
            try:
                g = round(float(rec.final_grade))
            except (TypeError, ValueError):
                g = None
            historial.append({"term": rec.term, "final": g,
                              "aprobado": g is not None and g >= PASSING_GRADE})

    teacher_name = ""
    if sec.teacher and sec.teacher.user:
        teacher_name = (getattr(sec.teacher.user, "full_name", "")
                        or sec.teacher.user.username or "")
    return Response({
        "section_id": sec.id,
        "period": sec.period,
        "code": sec.plan_course.effective_code if sec.plan_course else "",
        "name": sec.plan_course.effective_name if sec.plan_course else "",
        "teacher": teacher_name,
        "room": sec.classroom.code if sec.classroom else "",
        "sesiones": sesiones,
        "acta": acta,
        "historial": historial,
    })


def models_q_section_or_pc(sec):
    from django.db.models import Q
    return Q(section=sec) | Q(plan_course=sec.plan_course, section__isnull=True) | Q(plan_course=sec.plan_course)


# ─────────────────────────────────────────────
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def student_schedule(request):
    """GET /api/academic/student/schedule"""
    student = _student_of(request.user)
    if not student:
        return Response({"detail": "No se encontró perfil de estudiante."}, status=404)

    period = _current_period()
    section_ids = _enrolled_section_ids(student, period)

    slots = SectionScheduleSlot.objects.filter(
        section_id__in=section_ids
    ).select_related("section", "section__plan_course", "section__plan_course__course", "section__classroom")

    schedule = []
    for slot in slots:
        sec = slot.section
        wd = getattr(slot, "weekday", None)
        day = WEEKDAY_NAMES.get(wd, str(wd)) if isinstance(wd, int) else str(wd or "")

        schedule.append({
            "day": day,
            "name": _section_name(sec),
            "time": str(getattr(slot, "start", "")),
            "end": str(getattr(slot, "end", "")),
            "room": _classroom_name(sec),
            "course": _section_name(sec),
        })

    return Response({"schedule": schedule})