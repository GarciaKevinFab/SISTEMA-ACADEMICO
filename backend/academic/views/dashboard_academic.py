# academic/views/dashboard_academic.py
"""
Dashboard del administrador académico — 3 endpoints.
Usa modelos reales:
  academic.Career, academic.Section (capacity, label, period),
  academic.Enrollment/EnrollmentItem, academic.AcademicGradeRecord,
  academic.SectionScheduleSlot (weekday, start, end),
  academic.SectionGrades, catalogs.Period
"""

from django.db.models import Sum
from django.db.models.functions import Coalesce
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from catalogs.models import Period
from academic.models import (
    Career, Section, Enrollment, EnrollmentItem,
    AcademicGradeRecord, PlanCourse, SectionScheduleSlot, SectionGrades,
)

def _get_full_name(u):
    if not u:
        return ""
    first = (getattr(u, "first_name", "") or "").strip()
    last = (getattr(u, "last_name", "") or "").strip()
    if first or last:
        return f"{first} {last}".strip()
    return getattr(u, "username", "") or ""


# ─────────────────────────────────────────────
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def enrollment_stats(request):
    """GET /api/academic/enrollment/stats"""
    period = Period.objects.filter(is_active=True).first()

    enroll_qs = Enrollment.objects.all()
    sections_qs = Section.objects.all()
    if period:
        enroll_qs = enroll_qs.filter(period=period)
        sections_qs = sections_qs.filter(period=period)

    total_enrolled = enroll_qs.values("student").distinct().count()

    # Capacidad total (Section.capacity)
    capacity = sections_qs.aggregate(total=Coalesce(Sum("capacity"), 0))["total"]
    rate = round((total_enrolled / capacity) * 100, 1) if capacity > 0 else 0

    # Tasa de aprobación global
    total_grades = AcademicGradeRecord.objects.count()
    approved_grades = AcademicGradeRecord.objects.filter(final_grade__gte=PASSING_GRADE).count()
    approval_rate = round((approved_grades / total_grades) * 100, 1) if total_grades > 0 else 0

    # Por carrera
    by_career = []
    for career in Career.objects.filter(is_active=True):
        # Estudiantes matriculados cuyo plan pertenece a esta carrera
        c_enrolled = (
            EnrollmentItem.objects
            .filter(
                section__plan_course__plan__career=career,
                enrollment__in=enroll_qs,
            )
            .values("enrollment__student")
            .distinct()
            .count()
        )
        c_capacity = sections_qs.filter(
            plan_course__plan__career=career
        ).aggregate(total=Coalesce(Sum("capacity"), 0))["total"]

        if c_enrolled > 0 or c_capacity > 0:
            by_career.append({
                "name": career.name,
                "enrolled": c_enrolled,
                "capacity": c_capacity,
            })

    return Response({
        "enrolled": total_enrolled,
        "capacity": capacity,
        "rate": rate,
        "approval_rate": approval_rate,
        "by_career": by_career,
    })


# ─────────────────────────────────────────────
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def acts_pending(request):
    """GET /api/academic/acts/pending"""
    period = Period.objects.filter(is_active=True).first()

    sections_qs = Section.objects.all()
    if period:
        sections_qs = sections_qs.filter(period=period)

    all_ids = set(sections_qs.values_list("id", flat=True))

    # Secciones CON acta cerrada = las que tienen SectionGrades
    closed_ids = set(
        SectionGrades.objects.filter(section_id__in=all_ids).values_list("section_id", flat=True)
    )
    pending_ids = all_ids - closed_ids

    closed_count = len(closed_ids)
    pending_count = len(pending_ids)

    # Detalle de pendientes (max 20)
    pending_sections = Section.objects.filter(
        id__in=list(pending_ids)[:20]
    ).select_related("teacher", "teacher__user", "plan_course", "plan_course__course")

    items = []
    for sec in pending_sections:
        pc = getattr(sec, "plan_course", None)
        course = getattr(pc, "course", None) if pc else None
        teacher = getattr(sec, "teacher", None)
        teacher_name = _get_full_name(getattr(teacher, "user", None)) if teacher else ""
        students_count = EnrollmentItem.objects.filter(section=sec).count()

        name = ""
        if course:
            name = getattr(course, "name", "") or getattr(course, "nombre", "")
        if not name and pc:
            name = getattr(pc, "name", "") or getattr(pc, "nombre", "")

        items.append({
            "name": name or getattr(sec, "label", ""),
            "code": getattr(sec, "label", str(sec.id)),
            "teacher": teacher_name,
            "students": students_count,
            "period": str(getattr(sec, "period", "")),
        })

    return Response({
        "pending": pending_count,
        "closed": closed_count,
        "items": items,
    })


# ─────────────────────────────────────────────
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def sections_conflicts_get(request):
    """GET /api/academic/sections/conflicts"""
    period = Period.objects.filter(is_active=True).first()

    slots = SectionScheduleSlot.objects.all()
    if period:
        slots = slots.filter(section__period=period)
    slots = slots.select_related("section", "section__classroom").order_by("weekday", "start")

    conflicts = []
    by_day_room = {}

    for slot in slots:
        cr = getattr(slot.section, "classroom", None)
        room_id = cr.id if cr else None
        room_name = (getattr(cr, "name", None) or getattr(cr, "nombre", "") or str(cr)) if cr else ""
        if not room_id:
            continue
        key = (getattr(slot, "weekday", None), room_id)
        by_day_room.setdefault(key, []).append((slot, room_name))

    for (weekday, room_id), room_slots in by_day_room.items():
        for i, (s1, rn) in enumerate(room_slots):
            for s2, _ in room_slots[i + 1:]:
                if s1.start < s2.end and s2.start < s1.end:
                    conflicts.append({
                        "section1": getattr(s1.section, "label", str(s1.section_id)),
                        "section2": getattr(s2.section, "label", str(s2.section_id)),
                        "day": weekday,
                        "room": rn,
                        "conflict_type": "room_overlap",
                    })

    return Response({"total": len(conflicts), "items": conflicts[:20]})