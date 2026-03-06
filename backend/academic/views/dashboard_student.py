# academic/views/dashboard_student.py
"""
Dashboard del estudiante — 3 endpoints.
Usa modelos reales:
  students.Student, catalogs.Period, academic.AcademicGradeRecord,
  academic.Enrollment/EnrollmentItem, academic.AttendanceSession/AttendanceRow,
  academic.SectionScheduleSlot, academic.Section
"""

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
    qs = Enrollment.objects.filter(student=student)
    if period:
        qs = qs.filter(period=period)
    enroll_ids = qs.values_list("id", flat=True)
    return list(EnrollmentItem.objects.filter(enrollment_id__in=enroll_ids).values_list("section_id", flat=True))


# ─────────────────────────────────────────────
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def student_dashboard(request):
    """GET /api/academic/student/dashboard"""
    student = _student_of(request.user)
    if not student:
        return Response({"detail": "No se encontró perfil de estudiante."}, status=404)

    period = _current_period()

    # Créditos aprobados
    approved = AcademicGradeRecord.objects.filter(
        student=student, final_grade__gte=PASSING_GRADE
    ).select_related("plan_course")
    credits_approved = sum(getattr(gr.plan_course, "credits", 0) or 0 for gr in approved if gr.plan_course)

    # Créditos totales del plan
    plan = getattr(student, "plan", None)
    credits_total = PlanCourse.objects.filter(plan=plan).aggregate(
        total=Coalesce(Sum("credits"), 0)
    )["total"] if plan else 0

    # Promedio
    avg = AcademicGradeRecord.objects.filter(student=student).aggregate(
        avg=Coalesce(Avg("final_grade"), 0.0, output_field=FloatField())
    )["avg"]

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

    # Mérito por programa
    programa = getattr(student, "programa_carrera", "") or ""
    merit = None
    total_in_career = 0
    if programa:
        total_in_career = Student.objects.filter(programa_carrera=programa).count()
        better = (
            AcademicGradeRecord.objects.filter(student__programa_carrera=programa)
            .values("student").annotate(a=Avg("final_grade")).filter(a__gt=avg).count()
        )
        merit = better + 1

    return Response({
        "avg_grade": round(avg, 2),
        "credits_approved": credits_approved,
        "credits_total": credits_total,
        "current_semester": getattr(student, "ciclo", None),
        "career": programa,
        "career_name": programa,
        "enrolled_courses": enrolled_courses,
        "attendance_rate": attendance_rate,
        "merit": merit,
        "total_in_career": total_in_career,
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