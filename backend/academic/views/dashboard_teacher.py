# academic/views/dashboard_teacher.py
"""
Dashboard del docente — 2 endpoints.
Usa modelos reales:
  academic.Teacher (id, user), catalogs.Period,
  academic.Section (plan_course, teacher, classroom, label, period, capacity),
  academic.EnrollmentItem (enrollment→section),
  academic.AttendanceSession/AttendanceRow,
  academic.SectionScheduleSlot (weekday, start, end),
  academic.SectionGrades (reverse: section.grades_bundle)
"""

from datetime import date, timedelta
from django.db.models import Avg, Q, FloatField
from django.db.models.functions import Coalesce
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from catalogs.models import Period
from academic.models import (
    Teacher, Section, EnrollmentItem,
    AcademicGradeRecord, AttendanceSession, AttendanceRow,
    SectionScheduleSlot, SectionGrades, Syllabus,
)

WEEKDAY_NAMES = {1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes", 6: "Sábado", 7: "Domingo"}
PYTHON_TO_DB = {0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7}


def _teacher_of(user):
    try:
        return Teacher.objects.get(user=user)
    except Teacher.DoesNotExist:
        return None


def _section_name(section):
    pc = getattr(section, "plan_course", None)
    if pc:
        course = getattr(pc, "course", None)
        if course:
            for a in ("name", "nombre"):
                v = getattr(course, a, None)
                if v:
                    return v
        for a in ("name", "nombre"):
            v = getattr(pc, a, None)
            if v:
                return v
    return getattr(section, "label", "") or f"Sección {section.id}"


def _classroom_name(section):
    cr = getattr(section, "classroom", None)
    if cr:
        return getattr(cr, "name", None) or getattr(cr, "nombre", "") or str(cr)
    return ""


def _active_period_code():
    """Código del período vigente ('2026-I') o None."""
    per = Period.objects.filter(is_active=True).first()
    return (per.code or "").strip() if per else None


def _students_in_section(section):
    """Alumnos matriculados reales: por sección, con fallback por
    plan_course + período (los items de matrícula suelen venir sin sección)."""
    if isinstance(section, int):
        section = Section.objects.select_related("plan_course").filter(id=section).first()
        if not section:
            return 0
    # Los alumnos con LICENCIA no se califican, así que no cuentan como
    # "esperados" (si no, el docente ve 24/25 · 96% sin poder completarlo).
    n = (EnrollmentItem.objects
         .filter(section_id=section.id,
                 enrollment__status="CONFIRMED",
                 enrollment__period=section.period)
         .exclude(enrollment__student__estado_academico__iexact="LICENCIA")
         .values("enrollment__student_id").distinct().count())
    if n:
        return n
    return (EnrollmentItem.objects
            .filter(plan_course_id=section.plan_course_id,
                    enrollment__status="CONFIRMED",
                    enrollment__period=section.period)
            .exclude(enrollment__student__estado_academico__iexact="LICENCIA")
            .values("enrollment__student_id").distinct().count())


# ─────────────────────────────────────────────
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def teacher_dashboard(request):
    """GET /api/academic/teacher/dashboard"""
    teacher = _teacher_of(request.user)
    if not teacher:
        return Response({"detail": "No se encontró perfil de docente."}, status=404)

    period_code = _active_period_code()
    today = date.today()

    sections_qs = Section.objects.filter(teacher=teacher).select_related(
        "plan_course__course", "plan_course__plan__career", "classroom",
    )
    if period_code:
        sections_qs = sections_qs.filter(period=period_code)
    sections = list(sections_qs)
    section_ids = [s.id for s in sections]
    total_sections = len(sections)

    bundles = {b.section_id: b for b in SectionGrades.objects.filter(section_id__in=section_ids)}
    with_syllabus = set(
        Syllabus.objects.filter(section_id__in=section_ids).values_list("section_id", flat=True))
    n_sessions = {}
    for row in AttendanceSession.objects.filter(section_id__in=section_ids).values("section_id"):
        n_sessions[row["section_id"]] = n_sessions.get(row["section_id"], 0) + 1

    # ── Detalle por sección (para las tarjetas "Mis cursos") ──
    total_students = 0
    grades_pending = 0     # secciones sin ninguna nota cargada
    acts_pending = 0       # actas sin cerrar
    secciones_out = []
    for sec in sections:
        n_students = _students_in_section(sec)
        total_students += n_students
        b = bundles.get(sec.id)
        entries = b.grades if (b and isinstance(b.grades, dict)) else {}
        n_loaded = sum(1 for v in entries.values() if isinstance(v, dict) and v)
        submitted = bool(b and b.submitted)
        if n_loaded == 0:
            grades_pending += 1
        if not submitted:
            acts_pending += 1
        pc = sec.plan_course
        secciones_out.append({
            "id": sec.id,
            "course_name": _section_name(sec),
            "career_name": (pc.plan.career.name
                            if pc and pc.plan and pc.plan.career else ""),
            "semester": pc.semester if pc else None,
            "label": sec.label or "A",
            "room": _classroom_name(sec),
            "students": n_students,
            "grades_loaded": min(n_loaded, n_students) if n_students else n_loaded,
            "grades_pct": round(min(n_loaded, n_students) / n_students * 100) if n_students else 0,
            "submitted": submitted,
            "syllabus": sec.id in with_syllabus,
            "sessions": n_sessions.get(sec.id, 0),
        })

    # Asistencia hoy
    attendance_today = 0
    today_sessions = AttendanceSession.objects.filter(section_id__in=section_ids, date=today)
    if today_sessions.exists():
        sess_ids = today_sessions.values_list("id", flat=True)
        total_t = AttendanceRow.objects.filter(session_id__in=sess_ids).count()
        present_t = AttendanceRow.objects.filter(
            session_id__in=sess_ids, status__in=["PRESENT", "P", "A"]
        ).count()
        if total_t > 0:
            attendance_today = round((present_t / total_t) * 100, 1)

    syllabus_uploaded = len(with_syllabus)

    # Promedio de notas del período (registros de kárdex de sus cursos)
    avg_grade = AcademicGradeRecord.objects.filter(
        plan_course__in=[s.plan_course_id for s in sections if s.plan_course_id],
        term=period_code or "",
    ).aggregate(
        avg=Coalesce(Avg("final_grade"), 0.0, output_field=FloatField())
    )["avg"]

    # Tendencia asistencia 7 días
    attendance_trend = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        sess_d = AttendanceSession.objects.filter(section_id__in=section_ids, date=d)
        rate = 0
        if sess_d.exists():
            sids = sess_d.values_list("id", flat=True)
            tot = AttendanceRow.objects.filter(session_id__in=sids).count()
            pres = AttendanceRow.objects.filter(session_id__in=sids, status__in=["PRESENT", "P", "A"]).count()
            if tot > 0:
                rate = round((pres / tot) * 100, 1)
        attendance_trend.append({"date": d.strftime("%d/%m"), "value": rate})

    return Response({
        "period": period_code or "",
        "total_sections": total_sections,
        "total_students": total_students,
        "attendance_today": attendance_today,
        "grades_pending": max(0, grades_pending),
        "syllabus_uploaded": syllabus_uploaded,
        "syllabus_total": total_sections,
        "acts_pending": max(0, acts_pending),
        "avg_grade": round(avg_grade, 2),
        "attendance_trend": attendance_trend,
        "sections": secciones_out,
    })


# ─────────────────────────────────────────────
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def teacher_schedule_today(request):
    """GET /api/academic/teacher/schedule/today"""
    teacher = _teacher_of(request.user)
    if not teacher:
        return Response({"detail": "No se encontró perfil de docente."}, status=404)

    period_code = _active_period_code()
    today = date.today()
    today_db_weekday = PYTHON_TO_DB.get(today.weekday(), today.weekday() + 1)

    sections_qs = Section.objects.filter(teacher=teacher)
    if period_code:
        sections_qs = sections_qs.filter(period=period_code)

    slots = SectionScheduleSlot.objects.filter(
        section__in=sections_qs, weekday=today_db_weekday,
    ).select_related(
        "section", "section__plan_course", "section__plan_course__course", "section__classroom"
    ).order_by("start")

    classes = []
    for slot in slots:
        sec = slot.section
        classes.append({
            "name": _section_name(sec),
            "time": str(getattr(slot, "start", "")),
            "end": str(getattr(slot, "end", "")),
            "room": _classroom_name(sec),
            "students": _students_in_section(sec),
            "section": getattr(sec, "label", str(sec.id)),
            "code": getattr(sec, "label", ""),
        })

    return Response(classes)