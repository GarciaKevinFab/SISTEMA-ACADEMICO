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


def _students_in_section(section_id):
    return EnrollmentItem.objects.filter(section_id=section_id).count()


# ─────────────────────────────────────────────
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def teacher_dashboard(request):
    """GET /api/academic/teacher/dashboard"""
    teacher = _teacher_of(request.user)
    if not teacher:
        return Response({"detail": "No se encontró perfil de docente."}, status=404)

    period = Period.objects.filter(is_active=True).first()
    today = date.today()

    sections_qs = Section.objects.filter(teacher=teacher)
    if period:
        sections_qs = sections_qs.filter(period=period)

    section_ids = list(sections_qs.values_list("id", flat=True))
    total_sections = len(section_ids)

    # Total alumnos (via EnrollmentItem)
    total_students = EnrollmentItem.objects.filter(section_id__in=section_ids).count()

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

    # Notas pendientes — secciones SIN SectionGrades
    sections_with_grades = set(
        SectionGrades.objects.filter(section_id__in=section_ids).values_list("section_id", flat=True)
    )
    grades_pending = total_sections - len(sections_with_grades)

    # Sílabos subidos
    sections_with_syllabus = set(
        Syllabus.objects.filter(section_id__in=section_ids).values_list("section_id", flat=True)
    )
    syllabus_uploaded = len(sections_with_syllabus)

    # Promedio notas
    avg_grade = AcademicGradeRecord.objects.filter(
        plan_course__section__in=section_ids
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
        "total_sections": total_sections,
        "total_students": total_students,
        "attendance_today": attendance_today,
        "grades_pending": max(0, grades_pending),
        "syllabus_uploaded": syllabus_uploaded,
        "syllabus_total": total_sections,
        "acts_pending": max(0, grades_pending),  # Actas ≈ notas pendientes
        "avg_grade": round(avg_grade, 2),
        "attendance_trend": attendance_trend,
    })


# ─────────────────────────────────────────────
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def teacher_schedule_today(request):
    """GET /api/academic/teacher/schedule/today"""
    teacher = _teacher_of(request.user)
    if not teacher:
        return Response({"detail": "No se encontró perfil de docente."}, status=404)

    period = Period.objects.filter(is_active=True).first()
    today = date.today()
    today_db_weekday = PYTHON_TO_DB.get(today.weekday(), today.weekday() + 1)

    sections_qs = Section.objects.filter(teacher=teacher)
    if period:
        sections_qs = sections_qs.filter(period=period)

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
            "students": _students_in_section(sec.id),
            "section": getattr(sec, "label", str(sec.id)),
            "code": getattr(sec, "label", ""),
        })

    return Response(classes)