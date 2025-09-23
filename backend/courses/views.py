# backend/courses/views.py
from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from django.shortcuts import get_object_or_404

from django.contrib.auth import get_user_model
User = get_user_model()

from .models import (
    Career, Course, AcademicPlan, PlanCourse,
    Section, SectionScheduleSlot,
)
from .serializers import (
    CareerSerializer, CourseSerializer, AcademicPlanSerializer, PlanCourseSerializer,
    SectionSerializer, SectionScheduleSlotSerializer,
)

# Intenta importar modelos de asistencia
try:
    from .models import SectionAttendanceSession, AttendanceRow
    from .serializers import SectionAttendanceSessionSerializer, AttendanceRowSerializer
    HAS_ATTENDANCE = True
except Exception:
    HAS_ATTENDANCE = False

# ====== Careers ======
class CareerViewSet(viewsets.ModelViewSet):
    queryset = Career.objects.all().order_by("name")
    serializer_class = CareerSerializer
    permission_classes = [permissions.IsAuthenticated]


# ====== Courses ======
class CourseViewSet(viewsets.ModelViewSet):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["code", "name", "semester"]
    ordering_fields = ["name", "code", "credits", "weekly_hours", "created_at"]
    ordering = ["name"]


# ====== Academic Plans ======
class AcademicPlanViewSet(viewsets.ModelViewSet):
    queryset = AcademicPlan.objects.select_related("career").all()
    serializer_class = AcademicPlanSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "code", "career__name", "career__code"]
    ordering_fields = ["name", "code", "year", "created_at"]
    ordering = ["career__name", "name"]

    # /academic/plans/{id}/courses (GET/POST)
    @action(detail=True, methods=["get", "post"], url_path="courses")
    def plan_courses(self, request, pk=None):
        plan = self.get_object()
        if request.method == "GET":
            pcs = PlanCourse.objects.filter(plan=plan).select_related("course")
            data = PlanCourseSerializer(pcs, many=True).data
            return Response(data)

        course_id = request.data.get("course")
        if not course_id:
            return Response({"detail": "course is required"}, status=400)
        term = request.data.get("term")
        pc, created = PlanCourse.objects.get_or_create(plan=plan, course_id=course_id, defaults={"term": term})
        if not created:
            pc.term = term
            pc.save()
        return Response(PlanCourseSerializer(pc).data, status=201 if created else 200)

    # /academic/plans/{id}/courses/{courseId} (PUT/DELETE)
    @action(detail=True, methods=["put", "delete"], url_path=r"courses/(?P<course_id>[^/.]+)")
    def plan_course_detail(self, request, pk=None, course_id=None):
        plan = self.get_object()
        pc = get_object_or_404(PlanCourse, plan=plan, course_id=course_id)
        if request.method == "DELETE":
            pc.delete()
            return Response(status=204)
        pc.term = request.data.get("term") or pc.term
        pc.save()
        return Response(PlanCourseSerializer(pc).data)

    # /academic/plans/{id}/courses/{courseId}/prereqs (GET/PUT)
    @action(detail=True, methods=["get", "put"], url_path=r"courses/(?P<course_id>[^/.]+)/prereqs")
    def course_prereqs(self, request, pk=None, course_id=None):
        from .models import CoursePrerequisite, Course as C
        course = get_object_or_404(C, pk=course_id)
        if request.method == "GET":
            ids = list(course.prerequisites.values_list("prerequisite_id", flat=True))
            return Response({"course": course.id, "prerequisites": ids})
        prereq_ids = request.data.get("prerequisites", [])
        if not isinstance(prereq_ids, list):
            return Response({"detail": "prerequisites must be a list of course IDs"}, status=400)
        CoursePrerequisite.objects.filter(course=course).delete()
        bulk = [CoursePrerequisite(course=course, prerequisite_id=cid) for cid in prereq_ids if str(cid) != str(course.id)]
        CoursePrerequisite.objects.bulk_create(bulk, ignore_conflicts=True)
        return Response({"course": course.id, "prerequisites": [b.prerequisite_id for b in bulk]})


# ====== Sections ======
class SectionViewSet(viewsets.ModelViewSet):
    queryset = Section.objects.select_related("course", "career", "teacher").all()
    serializer_class = SectionSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["course__name", "course__code", "period", "code"]
    ordering_fields = ["period", "course__name", "code", "capacity", "created_at"]
    ordering = ["course__name", "code"]

    def get_queryset(self):
        qs = super().get_queryset()
        period = self.request.query_params.get("period")
        career = self.request.query_params.get("career")
        course = self.request.query_params.get("course")
        if period:
            qs = qs.filter(period=period)
        if career:
            qs = qs.filter(career_id=career)
        if course:
            qs = qs.filter(course_id=course)
        return qs

    # /sections/{id}/schedule (GET/PUT)
    @action(detail=True, methods=["get", "put"], url_path="schedule")
    def schedule(self, request, pk=None):
        sec = self.get_object()
        if request.method == "GET":
            data = SectionScheduleSlotSerializer(sec.schedule.all(), many=True).data
            return Response({"section": sec.id, "slots": data})
        slots = request.data.get("slots", [])
        if not isinstance(slots, list):
            return Response({"detail": "slots must be a list"}, status=400)
        sec.schedule.all().delete()
        objs = []
        for s in slots:
            try:
                objs.append(SectionScheduleSlot(
                    section=sec,
                    day_of_week=int(s["day_of_week"]),
                    start_time=s["start_time"],
                    end_time=s["end_time"],
                    classroom=s.get("classroom") or None,
                ))
            except Exception:
                return Response({"detail": "invalid slot structure"}, status=400)
        SectionScheduleSlot.objects.bulk_create(objs)
        return Response({"section": sec.id, "slots": SectionScheduleSlotSerializer(sec.schedule.all(), many=True).data})

    # /sections/{id}/evaluation (GET/PUT)
    @action(detail=True, methods=["get", "put"], url_path="evaluation")
    def evaluation_config(self, request, pk=None):
        sec = self.get_object()
        if request.method == "GET":
            return Response({"config": sec.evaluation_config or []})
        cfg = request.data if isinstance(request.data, list) else request.data.get("config", [])
        sec.evaluation_config = cfg or []
        sec.save()
        return Response({"config": sec.evaluation_config})

    # /sections/{id}/syllabus (GET/POST/DELETE)
    @action(detail=True, methods=["get", "post", "delete"], url_path="syllabus")
    def syllabus(self, request, pk=None):
        sec = self.get_object()
        if request.method == "GET":
            if not sec.syllabus:
                return Response({"detail": "no file"}, status=404)
            return Response({"url": sec.syllabus.url})
        if request.method == "DELETE":
            if sec.syllabus:
                sec.syllabus.delete(save=True)
            return Response(status=204)
        file = request.FILES.get("file")
        if not file:
            return Response({"detail": "file is required"}, status=400)
        sec.syllabus = file
        sec.save()
        return Response({"url": sec.syllabus.url}, status=201)


# ========== Horarios: Conflictos (ya lo usas desde UI) ==========
@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def sections_schedule_conflicts(request):
    """
    Recibe {slots:[{day_of_week,start_time,end_time,classroom}]}
    y devuelve conflictos por aula y horario (solape simple).
    """
    slots = request.data.get("slots", [])
    if not isinstance(slots, list):
        return Response({"detail": "slots must be a list"}, status=400)

    def to_tuple(s):
        return (
            int(s["day_of_week"]),
            s["start_time"],
            s["end_time"],
            (s.get("classroom") or "").strip().upper()
        )

    new = [to_tuple(s) for s in slots if {"day_of_week","start_time","end_time"} <= set(s.keys())]
    conflicts = []
    for dw, st, et, room in new:
        if not room:
            continue
        overlap = SectionScheduleSlot.objects.filter(
            day_of_week=dw, classroom__iexact=room,
            start_time__lt=et, end_time__gt=st
        ).select_related("section", "section__course")
        for x in overlap:
            conflicts.append({
                "with_section": x.section_id,
                "with_section_label": f"{x.section.course.code}-{x.section.code} {x.section.period}",
                "day_of_week": dw,
                "start_time": str(st),
                "end_time": str(et),
                "classroom": room,
            })
    return Response({"conflicts": conflicts})


# ========== Asistencia por sección ==========
if HAS_ATTENDANCE:
    from students.models import Student

    @api_view(["POST"])
    @permission_classes([permissions.IsAuthenticated])
    def attendance_create_session(request, section_id):
        """
        Crea sesión de asistencia. Body: {date:"YYYY-MM-DD", topic:"..."}
        """
        section = get_object_or_404(Section, pk=section_id)
        date = request.data.get("date")
        topic = request.data.get("topic", "")
        if not date:
            return Response({"detail": "date es requerido"}, status=400)
        sess = SectionAttendanceSession.objects.create(section=section, date=date, topic=topic or "")
        return Response(SectionAttendanceSessionSerializer(sess).data, status=201)

    @api_view(["GET"])
    @permission_classes([permissions.IsAuthenticated])
    def attendance_list_sessions(request, section_id):
        section = get_object_or_404(Section, pk=section_id)
        qs = SectionAttendanceSession.objects.filter(section=section).order_by("-date", "-id")
        return Response(SectionAttendanceSessionSerializer(qs, many=True).data)

    @api_view(["POST"])
    @permission_classes([permissions.IsAuthenticated])
    def attendance_close_session(request, section_id, session_id):
        section = get_object_or_404(Section, pk=section_id)
        sess = get_object_or_404(SectionAttendanceSession, pk=session_id, section=section)
        sess.is_closed = True
        sess.save(update_fields=["is_closed"])
        return Response({"status": "closed"})

    @api_view(["PUT"])
    @permission_classes([permissions.IsAuthenticated])
    def attendance_set_rows(request, section_id, session_id):
        """
        Body: { rows: [{student: <id>, status: "PRESENT|LATE|ABSENT", note:"..."}] }
        """
        section = get_object_or_404(Section, pk=section_id)
        sess = get_object_or_404(SectionAttendanceSession, pk=session_id, section=section)
        if sess.is_closed:
            return Response({"detail": "Sesión cerrada"}, status=409)

        rows = request.data.get("rows", [])
        if not isinstance(rows, list):
            return Response({"detail": "rows debe ser lista"}, status=400)

        AttendanceRow.objects.filter(session=sess).delete()
        bulk = []
        valid = {"PRESENT", "LATE", "ABSENT"}
        for r in rows:
            sid = r.get("student")
            st = (r.get("status") or "").upper()
            if not sid or st not in valid:
                continue
            bulk.append(AttendanceRow(session=sess, student_id=sid, status=st, note=r.get("note") or ""))
        AttendanceRow.objects.bulk_create(bulk)

        data = AttendanceRowSerializer(AttendanceRow.objects.filter(session=sess), many=True).data
        return Response({"session": sess.id, "rows": data})
    # --- Wrapper para GET/POST en la misma ruta ---
    @api_view(["GET", "POST"])
    @permission_classes([permissions.IsAuthenticated])
    def attendance_sessions(request, section_id):
        if request.method == "GET":
            return attendance_list_sessions(request, section_id)
        return attendance_create_session(request, section_id)
# =========================
#  KÁRDEX (histórico del estudiante)
# =========================
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def academic_kardex(request, student_id):
    """
    Devuelve un kárdex básico a partir de Enrollment.
    Estructura:
    {
      "student_id": 1,
      "records": [
        { "period":"2025-I", "course_code":"MAT101","course_name":"Álgebra","final": 14, "status":"COMPLETED" },
        ...
      ]
    }
    """
    from enrollment.models import Enrollment  # usamos tu modelo actual
    from courses.models import Course

    # Traemos todas las matriculas del estudiante
    enrolls = (Enrollment.objects
               .filter(student_id=student_id)
               .select_related("course")
               .order_by("period", "course__name"))

    # Intentamos obtener notas finales si tu app grades las tiene
    final_by_enrollment = {}
    try:
        # Ajusta a tus modelos reales si es necesario (te ayudo cuando me pases `grades.models`)
        from grades.models import GradeItem  # Ejemplo: GradeItem(section?, student, course, code, score)
        # Si tu modelo es otro, este bloque no romperá nada gracias al try/except
        # (puedes ignorar; sólo se mostrarán "final": None)
        pass
    except Exception:
        # No tenemos integración directa, devolvemos final=None
        final_by_enrollment = {}

    records = []
    for e in enrolls:
        records.append({
            "period": e.period,
            "course_code": e.course.code if e.course_id else None,
            "course_name": e.course.name if e.course_id else None,
            "final": final_by_enrollment.get(e.id),  # por ahora None (stub)
            "status": e.status,
        })

    return Response({"student_id": student_id, "records": records})


# =========================
#  PROCESOS ACADÉMICOS (stubs útiles para el front)
# =========================
from uuid import uuid4

def _ticket(prefix="PRC"):
    return f"{prefix}-{uuid4().hex[:8].upper()}"

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def proc_withdraw(request):
    """
    Retiro de curso(s).
    Body sugerido: { student_id, period, items:[{course_id, reason}] }
    """
    payload = request.data or {}
    return Response({
        "status": "received",
        "ticket": _ticket("WDR"),
        "echo": payload
    }, status=201)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def proc_reservation(request):
    """
    Reserva de matrícula (pausa temporal del estudiante).
    Body: { student_id, period_from, period_to, reason }
    """
    payload = request.data or {}
    return Response({
        "status": "received",
        "ticket": _ticket("RSV"),
        "echo": payload
    }, status=201)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def proc_validation(request):
    """
    Validación/Convalidación de cursos externos.
    Body: { student_id, origin, items:[{course_code, syllabus_url?, credits}] }
    """
    payload = request.data or {}
    return Response({
        "status": "received",
        "ticket": _ticket("VAL"),
        "echo": payload
    }, status=201)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def proc_transfer(request):
    """
    Traslado de carrera/sección.
    Body: { student_id, from_career_id, to_career_id, reason }
    """
    payload = request.data or {}
    return Response({
        "status": "received",
        "ticket": _ticket("TRF"),
        "echo": payload
    }, status=201)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def proc_rejoin(request):
    """
    Reingreso después de tiempo fuera.
    Body: { student_id, last_period, reason }
    """
    payload = request.data or {}
    return Response({
        "status": "received",
        "ticket": _ticket("REJ"),
        "echo": payload
    }, status=201)


# =========================
#  REPORTES ACADÉMICOS (JSON simples para dashboard/listados)
# =========================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def academic_reports_summary(request):
    """
    Retorna un resumen simple útil para dashboard:
    {
      "students": 123,
      "active_sections": 8,
      "enrollments": 456
    }
    """
    from students.models import Student
    from enrollment.models import Enrollment
    active_sections = Section.objects.filter(is_active=True).count()
    return Response({
        "students": Student.objects.count(),
        "active_sections": active_sections,
        "enrollments": Enrollment.objects.count(),
    })
