"""
academic/views/resolvers.py
────────────────────────────
Mapeo robusto entre catalogs.Teacher / catalogs.Classroom
y academic.Teacher / academic.Classroom.

UBICACIÓN: backend/academic/views/resolvers.py
"""
from django.contrib.auth import get_user_model

from academic.models import (
    Teacher as AcademicTeacher,
    Classroom as AcademicClassroom,
    Section, SectionScheduleSlot,
)
from catalogs.models import (
    Teacher as CatalogTeacher,
    Classroom as CatalogClassroom,
)

User = get_user_model()


# ══════════════════════════════════════════════════════════════
# TEACHER
# ══════════════════════════════════════════════════════════════

def resolve_teacher(teacher_id):
    """
    Recibe un ID que puede ser:
      1. catalogs.Teacher.id           (lo que envía el frontend)
      2. academic.Teacher.user_id      (legacy)
      3. academic.Teacher.id           (legacy)
      4. User.id                       (fallback)

    Devuelve: academic.Teacher (creado si no existía) o None.
    """
    if not teacher_id:
        return None

    tid = int(teacher_id)

    # ─── 1) ¿Es un catalogs.Teacher? ───
    cat_teacher = (
        CatalogTeacher.objects
        .select_related("user")
        .filter(id=tid)
        .first()
    )

    if cat_teacher and cat_teacher.user_id:
        acad, _ = AcademicTeacher.objects.get_or_create(
            user_id=cat_teacher.user_id
        )
        return acad

    # ─── 2) ¿Es un academic.Teacher.user_id? ───
    acad = AcademicTeacher.objects.select_related("user").filter(user_id=tid).first()
    if acad:
        return acad

    # ─── 3) ¿Es un academic.Teacher.id? ───
    acad = AcademicTeacher.objects.select_related("user").filter(id=tid).first()
    if acad:
        return acad

    # ─── 4) Fallback: buscar User y crear academic.Teacher ───
    user = User.objects.filter(id=tid, is_active=True).first()
    if not user:
        return None

    acad, _ = AcademicTeacher.objects.get_or_create(user=user)
    return acad


def resolve_teacher_or_404(teacher_id):
    t = resolve_teacher(teacher_id)
    if t is None:
        from rest_framework.exceptions import NotFound
        raise NotFound(f"Docente con ID {teacher_id} no encontrado")
    return t


# ══════════════════════════════════════════════════════════════
# CLASSROOM
# ══════════════════════════════════════════════════════════════

def resolve_classroom(room_id, code=None, capacity=None):
    """
    Recibe un ID que puede ser:
      1. catalogs.Classroom.id          (lo que envía el frontend)
      2. academic.Classroom.id          (legacy)

    Nunca crea aulas fantasma "AULA-N": siempre usa el code real.
    """
    if not room_id:
        return None

    rid = int(room_id)

    # ─── 1) ¿Es un catalogs.Classroom? ───
    cat_room = (
        CatalogClassroom.objects
        .select_related("campus")
        .filter(id=rid)
        .first()
    )

    if cat_room:
        campus_prefix = ""
        if cat_room.campus and getattr(cat_room.campus, "code", ""):
            campus_prefix = f"{cat_room.campus.code}-"

        real_code = f"{campus_prefix}{cat_room.code}"
        real_capacity = int(capacity or cat_room.capacity or 30)

        acad = AcademicClassroom.objects.filter(code=real_code).first()

        if acad:
            if real_capacity > 0 and acad.capacity != real_capacity:
                acad.capacity = real_capacity
                acad.save(update_fields=["capacity"])
            return acad

        acad = AcademicClassroom.objects.create(
            code=real_code,
            capacity=real_capacity,
        )
        return acad

    # ─── 2) ¿Es un academic.Classroom.id? ───
    acad = AcademicClassroom.objects.filter(id=rid).first()
    if acad:
        changed = False
        if capacity is not None:
            try:
                cap = int(capacity)
                if cap > 0 and acad.capacity != cap:
                    acad.capacity = cap
                    changed = True
            except (ValueError, TypeError):
                pass
        if code and acad.code != code:
            if not AcademicClassroom.objects.filter(code=code).exclude(id=acad.id).exists():
                acad.code = code
                changed = True
        if changed:
            acad.save()
        return acad

    return None


def resolve_classroom_or_404(room_id, code=None, capacity=None):
    r = resolve_classroom(room_id, code, capacity)
    if r is None:
        from rest_framework.exceptions import NotFound
        raise NotFound(f"Aula con ID {room_id} no encontrada")
    return r


# ══════════════════════════════════════════════════════════════
# VALIDACIÓN DE CONFLICTOS REALES
# ══════════════════════════════════════════════════════════════

DAY_TO_INT = {"MON": 1, "TUE": 2, "WED": 3, "THU": 4, "FRI": 5, "SAT": 6, "SUN": 7}


def check_schedule_conflicts(
    slots: list,
    teacher: AcademicTeacher = None,
    classroom: AcademicClassroom = None,
    period: str = "",
    exclude_section_id: int = None,
) -> list:
    """
    Verifica conflictos REALES contra la BD:
      - Mismo docente, misma hora, mismo día, mismo período
      - Misma aula, misma hora, mismo día, mismo período
    """
    from datetime import datetime as _dt

    if not period or not slots:
        return []

    conflicts = []

    existing_qs = (
        SectionScheduleSlot.objects
        .select_related("section__teacher", "section__classroom")
        .filter(section__period=period)
    )
    if exclude_section_id:
        existing_qs = existing_qs.exclude(section_id=exclude_section_id)

    for new_slot in slots:
        day_str = new_slot.get("day", "")
        day_int = DAY_TO_INT.get(day_str, new_slot.get("weekday"))
        if day_int is None:
            continue

        try:
            new_start = _dt.strptime(str(new_slot["start"]).strip()[:5], "%H:%M").time()
            new_end = _dt.strptime(str(new_slot["end"]).strip()[:5], "%H:%M").time()
        except (ValueError, KeyError):
            continue

        day_slots = existing_qs.filter(weekday=day_int)

        for existing in day_slots:
            if existing.start < new_end and new_start < existing.end:
                sec = existing.section

                if teacher and sec.teacher_id and sec.teacher_id == teacher.id:
                    pc = getattr(sec, "plan_course", None)
                    course_name = ""
                    if pc:
                        course_name = (
                            getattr(pc, "display_name", "") or
                            (getattr(pc.course, "name", "") if pc.course else "")
                        )
                    conflicts.append({
                        "type": "teacher",
                        "message": (
                            f"Docente ya asignado en {day_str} "
                            f"{existing.start:%H:%M}-{existing.end:%H:%M} "
                            f"(sección {sec.label} - {course_name})"
                        ),
                        "section_id": sec.id,
                    })

                if classroom and sec.classroom_id and sec.classroom_id == classroom.id:
                    conflicts.append({
                        "type": "classroom",
                        "message": (
                            f"Aula {classroom.code} ocupada en {day_str} "
                            f"{existing.start:%H:%M}-{existing.end:%H:%M} "
                            f"(sección {sec.label})"
                        ),
                        "section_id": sec.id,
                    })

    return conflicts