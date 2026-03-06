"""
Vistas para manejo de Secciones y Horarios
─────────────────────────────────────────────
ACTUALIZADO: usa resolvers.py para mapeo catalogs ↔ academic
ACTUALIZADO: verificación de conflictos REAL contra la BD
ACTUALIZADO: valida ventana de matrícula en operaciones de sección
FIXED: bug en create() que retornaba None cuando ventana estaba CLOSED
"""
from rest_framework.response import Response
from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.shortcuts import get_object_or_404

from academic.models import (
    Section, SectionScheduleSlot, PlanCourse,
    Teacher, Classroom, AcademicPeriod,
)
from academic.serializers import (
    SectionOutSerializer, SectionCreateUpdateSerializer,
)
from .utils import (
    ok, DAY_TO_INT, INT_TO_DAY,
    _get_full_name, validate_period_format,
    assert_enrollment_window,
)
from .resolvers import (
    resolve_teacher,
    resolve_classroom,
    check_schedule_conflicts,
)


# ══════════════════════════════════════════════════════════════
#  HELPERS INTERNOS
# ══════════════════════════════════════════════════════════════

def _build_section_qs():
    return Section.objects.select_related(
        "plan_course__course",
        "plan_course__plan__career",   # ← agregar esto
        "teacher__user",
        "classroom",
    ).prefetch_related("schedule_slots")


def _validate_capacity(capacity: int, room):
    """Retorna un Response de error si la capacidad excede la del aula, o None."""
    if room and room.capacity and capacity > room.capacity:
        return Response(
            {"detail": f"Capacidad ({capacity}) excede la del aula {room.code} ({room.capacity})"},
            status=400,
        )
    return None


def _save_slots(section: Section, slots_data: list):
    """Borra los slots existentes y crea los nuevos."""
    SectionScheduleSlot.objects.filter(section=section).delete()
    for sl in slots_data:
        SectionScheduleSlot.objects.create(
            section=section,
            weekday=DAY_TO_INT[sl["day"]],
            start=sl["start"],
            end=sl["end"],
        )


def _check_and_save_slots(section: Section, slots_data: list, exclude_id=None):
    """
    Verifica conflictos de horario y guarda los slots si no hay problemas.
    Devuelve un Response 409 si hay conflictos, o None si todo está bien.
    """
    conflicts = check_schedule_conflicts(
        slots=slots_data,
        teacher=section.teacher,
        classroom=section.classroom,
        period=section.period,
        exclude_section_id=exclude_id,
    )
    if conflicts:
        return Response(
            {"detail": "Conflictos de horario detectados", "conflicts": conflicts},
            status=409,
        )
    _save_slots(section, slots_data)
    return None


# ══════════════════════════════════════════════════════════════
#  VIEWSET PRINCIPAL
# ══════════════════════════════════════════════════════════════

class SectionsViewSet(viewsets.ModelViewSet):
    authentication_classes = [JWTAuthentication]
    permission_classes     = [permissions.IsAuthenticated]
    queryset               = Section.objects.all()

    def get_queryset(self):
        qs     = _build_section_qs()
        period = self.request.query_params.get("period")
        if period:
            qs = qs.filter(period=period)
        return qs

    # ── LIST / RETRIEVE ────────────────────────────────────────

    def list(self, request, *args, **kwargs):
        return ok(sections=SectionOutSerializer(self.get_queryset(), many=True).data)

    def retrieve(self, request, pk=None, *args, **kwargs):
        sec = get_object_or_404(self.get_queryset(), id=int(pk))
        return ok(section=SectionOutSerializer(sec).data)

    # ── CREATE ─────────────────────────────────────────────────

    def create(self, request, *args, **kwargs):
        ser = SectionCreateUpdateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        period = (data.get("period") or "").strip()
        if not period:
            return Response({"detail": "period es requerido (ej: 2026-I)"}, status=400)
        if not validate_period_format(period):
            return Response({"detail": f"Formato de período inválido: {period!r}"}, status=400)

        pc       = get_object_or_404(PlanCourse, id=int(data["course_id"]))
        teacher  = resolve_teacher(data.get("teacher_id"))
        room     = resolve_classroom(data.get("room_id"))
        capacity = int(data.get("capacity") or 30)

        if err := _validate_capacity(capacity, room):
            return err

        # ── Verificar ventana de matrícula (informativo) ───────
        # La creación de secciones es tarea de admin, no se bloquea.
        # Solo se envía un warning si la ventana está cerrada.
        win_status = AcademicPeriod.get_status_for_period(period)
        window_warning = None
        if win_status == AcademicPeriod.STATUS_CLOSED:
            window_warning = (
                "La ventana de matrícula para este período está cerrada. "
                "La sección se creó correctamente, pero no se permitirá "
                "la matrícula de estudiantes hasta que se abra la ventana."
            )

        slots_data = data.get("slots", [])
        conflicts  = check_schedule_conflicts(
            slots=slots_data,
            teacher=teacher,
            classroom=room,
            period=period,
            exclude_section_id=None,
        )
        if conflicts:
            return Response(
                {"detail": "Conflictos de horario detectados", "conflicts": conflicts},
                status=409,
            )

        sec = Section.objects.create(
            plan_course=pc,
            teacher=teacher,
            classroom=room,
            capacity=capacity,
            period=period,
            label=(data.get("label") or "A"),
        )
        _save_slots(sec, slots_data)

        sec = self.get_queryset().get(id=sec.id)
        response_data = {"section": SectionOutSerializer(sec).data}

        # Incluir warning si la ventana estaba cerrada
        if window_warning:
            response_data["warning"] = True
            response_data["window_warning"] = window_warning
            response_data["window_status"] = win_status

        return ok(**response_data)

    # ── UPDATE (PUT) ───────────────────────────────────────────

    def update(self, request, pk=None, *args, **kwargs):
        sec  = get_object_or_404(Section, id=int(pk))
        ser  = SectionCreateUpdateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        if "teacher_id" in data:
            sec.teacher = resolve_teacher(data.get("teacher_id"))
        if "room_id" in data:
            sec.classroom = resolve_classroom(data.get("room_id"))
        if "capacity" in data:
            sec.capacity = int(data.get("capacity") or sec.capacity)
        if "period" in data:
            new_period = (data.get("period") or sec.period).strip()
            if not validate_period_format(new_period):
                return Response({"detail": f"Formato de período inválido: {new_period!r}"}, status=400)
            sec.period = new_period
        if "label" in data:
            sec.label = data.get("label") or sec.label

        if err := _validate_capacity(sec.capacity, sec.classroom):
            return err

        sec.save()

        if "slots" in data:
            if err := _check_and_save_slots(sec, data.get("slots", []), exclude_id=sec.id):
                return err

        sec = self.get_queryset().get(id=sec.id)
        return ok(section=SectionOutSerializer(sec).data)

    # ── PARTIAL UPDATE (PATCH) ─────────────────────────────────

    def partial_update(self, request, pk=None, *args, **kwargs):
        sec  = get_object_or_404(Section, id=int(pk))
        body = request.data or {}

        if "teacher_id" in body:
            sec.teacher = resolve_teacher(body.get("teacher_id"))
        if "room_id" in body:
            sec.classroom = resolve_classroom(body.get("room_id"))
        if "capacity" in body:
            sec.capacity = int(body.get("capacity") or sec.capacity)
        if "period" in body:
            new_period = (body.get("period") or sec.period).strip()
            if not validate_period_format(new_period):
                return Response({"detail": f"Formato de período inválido: {new_period!r}"}, status=400)
            sec.period = new_period
        if "label" in body:
            sec.label = body.get("label") or sec.label

        if err := _validate_capacity(sec.capacity, sec.classroom):
            return err

        sec.save()

        if "slots" in body and isinstance(body["slots"], list):
            tmp = SectionCreateUpdateSerializer(
                data={"course_id": sec.plan_course_id, "slots": body["slots"]}
            )
            tmp.is_valid(raise_exception=True)
            new_slots = tmp.validated_data.get("slots", [])
            if err := _check_and_save_slots(sec, new_slots, exclude_id=sec.id):
                return err

        sec = self.get_queryset().get(id=sec.id)
        return ok(section=SectionOutSerializer(sec).data)

    # ── DESTROY ────────────────────────────────────────────────

    def destroy(self, request, pk=None, *args, **kwargs):
        sec = get_object_or_404(Section, id=int(pk))
        sec.delete()
        return ok(success=True)

    # ── ACTION: schedule ───────────────────────────────────────

    @action(detail=True, methods=["get", "put"], url_path="schedule")
    def schedule(self, request, pk=None):
        sec = get_object_or_404(Section, id=int(pk))

        if request.method.lower() == "get":
            sec = Section.objects.prefetch_related("schedule_slots").get(id=sec.id)
            return ok(slots=SectionOutSerializer(sec).data["slots"])

        slots = (request.data or {}).get("slots", [])
        if not isinstance(slots, list):
            return Response({"detail": "slots debe ser lista"}, status=400)

        tmp = SectionCreateUpdateSerializer(
            data={"course_id": sec.plan_course_id, "slots": slots}
        )
        tmp.is_valid(raise_exception=True)
        new_slots = tmp.validated_data.get("slots", [])

        if err := _check_and_save_slots(sec, new_slots, exclude_id=sec.id):
            return err

        sec = Section.objects.prefetch_related("schedule_slots").get(id=sec.id)
        return ok(success=True, slots=SectionOutSerializer(sec).data["slots"])

    # ── ACTION: window_status ──────────────────────────────────

    @action(detail=True, methods=["get"], url_path="window-status")
    def window_status(self, request, pk=None):
        """
        Retorna el estado actual de la ventana de matrícula para el período
        de esta sección. Útil para que el frontend muestre advertencias.
        """
        sec  = get_object_or_404(Section, id=int(pk))
        info = AcademicPeriod.get_or_none(sec.period)
        if info is None:
            from academic.models import AcademicPeriod as AP
            window = {
                "status":  AP.STATUS_FREE,
                "is_open": True,
                "extemporary_surcharge": 0.0,
            }
        else:
            window = info.window_info()
        return ok(period=sec.period, window=window)


# ══════════════════════════════════════════════════════════════
#  VISTA DE CONFLICTOS DE HORARIO
# ══════════════════════════════════════════════════════════════

class SectionsScheduleConflictsView(APIView):
    """
    Verifica conflictos de horario REALES contra la BD.
    Recibe: { teacher_id, room_id, period, slots: [...], exclude_section_id? }
    """
    authentication_classes = [JWTAuthentication]
    permission_classes     = [permissions.IsAuthenticated]

    def post(self, request):
        payload    = request.data or {}
        slots      = payload.get("slots", [])
        period     = (payload.get("period") or "").strip()
        teacher    = resolve_teacher(payload.get("teacher_id"))
        classroom  = resolve_classroom(payload.get("room_id"))
        exclude_id = payload.get("exclude_section_id")

        # ─── Conflictos intra-request (franjas duplicadas en el envío) ───
        intra_conflicts = []
        seen = set()
        for sl in slots:
            key = (sl.get("day") or sl.get("weekday"), sl.get("start"), sl.get("end"))
            if key in seen:
                intra_conflicts.append({
                    "type":    "duplicate",
                    "message": f"Franja duplicada: {key[0]} {key[1]}-{key[2]}",
                })
            seen.add(key)

        # ─── Conflictos contra la BD ──────────────────────────────────
        db_conflicts = []
        if period and slots:
            db_conflicts = check_schedule_conflicts(
                slots=slots,
                teacher=teacher,
                classroom=classroom,
                period=period,
                exclude_section_id=exclude_id,
            )

        # ─── Estado de ventana de matrícula para el período ──────────
        window_info = {}
        if period:
            obj = AcademicPeriod.get_or_none(period)
            window_info = obj.window_info() if obj else {
                "status": AcademicPeriod.STATUS_FREE,
                "is_open": True,
            }

        return ok(
            conflicts=intra_conflicts + db_conflicts,
            window=window_info,
        )