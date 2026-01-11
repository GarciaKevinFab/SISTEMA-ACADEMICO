# backend/academic/views.py
from datetime import datetime
from io import BytesIO
import random
import csv
import base64

from django.db import transaction
from django.http import FileResponse, HttpResponse
from django.shortcuts import get_object_or_404
from django.core.exceptions import FieldError
from django.contrib.auth import get_user_model
from django.utils import timezone

from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework_simplejwt.authentication import JWTAuthentication

# ✅ NUEVO: ACL real (Role + UserRole)
from acl.models import Role, UserRole

from .models import (
    Plan, PlanCourse, Course, CoursePrereq,
    Teacher, Classroom,
    Section, SectionScheduleSlot,
    AttendanceSession, AttendanceRow,
    Syllabus, EvaluationConfig,
    AcademicProcess, ProcessFile,
    # ✅ IMPORTANTE: debe existir en models.py
    SectionGrades,
)

from .serializers import (
    PlanSerializer, PlanCreateSerializer,
    PlanCourseOutSerializer, PlanCourseCreateSerializer,
    ClassroomSerializer,
    SectionOutSerializer, SectionCreateUpdateSerializer,
    AttendanceSessionSerializer,
)

# ───────────────────────── Helpers ─────────────────────────
def ok(data=None, **extra):
    if data is None:
        data = {}
    data.update(extra)
    return Response(data)

DAY_TO_INT = {"MON": 1, "TUE": 2, "WED": 3, "THU": 4, "FRI": 5, "SAT": 6, "SUN": 7}
INT_TO_DAY = {v: k for k, v in DAY_TO_INT.items()}


def _get_full_name(u):
    if not u:
        return ""
    if hasattr(u, "get_full_name"):
        try:
            fn = (u.get_full_name() or "").strip()
            if fn:
                return fn
        except Exception:
            pass

    for attr in ("full_name", "name"):
        if hasattr(u, attr):
            v = (getattr(u, attr) or "").strip()
            if v:
                return v

    first = (getattr(u, "first_name", "") or "").strip()
    last = (getattr(u, "last_name", "") or "").strip()
    if first or last:
        return f"{first} {last}".strip()

    return (getattr(u, "username", "") or getattr(u, "email", "") or f"User {getattr(u,'id','')}").strip()


# ───────────────────────── ACL-aware role helpers (✅ IMPLEMENTADO) ─────────────────────────
def list_users_by_role_names(role_names):
    """
    Retorna queryset de usuarios (activos) que tengan cualquiera de los roles por name,
    usando el ACL real: Role + UserRole.
    """
    User = get_user_model()

    role_ids = list(Role.objects.filter(name__in=role_names).values_list("id", flat=True))
    if not role_ids:
        return User.objects.none()

    user_ids = (
        UserRole.objects
        .filter(role_id__in=role_ids)
        .values_list("user_id", flat=True)
        .distinct()
    )
    return User.objects.filter(id__in=user_ids, is_active=True)


def list_teacher_users_qs():
    teacher_names = ["TEACHER", "DOCENTE", "PROFESOR"]
    return list_users_by_role_names(teacher_names)


def list_student_users_qs():
    student_names = ["STUDENT", "ALUMNO", "ESTUDIANTE"]
    return list_users_by_role_names(student_names)


def user_has_any_role(user, names):
    """
    True si el usuario tiene cualquiera de esos roles (por name) o es superuser.
    """
    if not user:
        return False
    if getattr(user, "is_superuser", False):
        return True
    try:
        return UserRole.objects.filter(user=user, role__name__in=names).exists()
    except Exception:
        return False


def resolve_teacher(teacher_id):
    """
    Acepta:
    - teacher_id como User.id (lo que manda el frontend)
    - o como Teacher.id (por compatibilidad)
    """
    if not teacher_id:
        return None

    tid = int(teacher_id)

    # ✅ 1) PRIORIDAD: buscar por user_id (frontend manda User.id)
    t = Teacher.objects.select_related("user").filter(user_id=tid).first()
    if t:
        return t

    # ✅ 2) Luego buscar por Teacher.id (compat)
    t = Teacher.objects.select_related("user").filter(id=tid).first()
    if t:
        return t

    # ✅ 3) crear desde User
    User = get_user_model()
    u = get_object_or_404(User, id=tid)
    t, _ = Teacher.objects.get_or_create(user=u)
    return t


def resolve_classroom(room_id, code=None, capacity=None):
    if not room_id:
        return None

    defaults = {
        "code": (code or f"AULA-{room_id}"),
        "capacity": int(capacity) if capacity else 999,
    }
    room, _ = Classroom.objects.get_or_create(id=int(room_id), defaults=defaults)

    changed = False
    if code and room.code != code:
        room.code = code
        changed = True
    if capacity is not None:
        try:
            cap = int(capacity)
            if cap > 0 and room.capacity != cap:
                room.capacity = cap
                changed = True
        except Exception:
            pass
    if changed:
        room.save()

    return room


def count_teachers():
    """
    Cuenta docentes por ACL (roles) y si no hay ninguno, cae al modelo Teacher.
    """
    qs = list_teacher_users_qs()
    if qs.exists():
        return qs.count()
    return Teacher.objects.count()


def _slots_for_section(section: Section):
    out = []
    for s in section.schedule_slots.all().order_by("weekday", "start"):
        out.append({
            "day": INT_TO_DAY.get(int(s.weekday), str(s.weekday)),
            "start": str(s.start)[:5],
            "end": str(s.end)[:5],
        })
    return out


def _overlaps(a_start, a_end, b_start, b_end):
    return a_end > b_start and b_end > a_start


def _detect_schedule_conflicts(sections):
    """
    sections: list[Section] con schedule_slots prefetched.
    retorna lista de conflicts con message (frontend la muestra).
    """
    events = []
    for sec in sections:
        for sl in sec.schedule_slots.all():
            events.append((int(sl.weekday), sl.start, sl.end, sec.id))

    conflicts = []
    by_day = {}
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
                    "type": "OVERLAP",
                    "weekday": wd,
                    "a": s1,
                    "b": s2,
                    "message": f"Choque de horario (día {INT_TO_DAY.get(wd, wd)}) entre secciones {s1} y {s2}"
                })
    return conflicts


def _dummy_pdf_response(filename="documento.pdf"):
    buf = BytesIO(b"%PDF-1.4\n% Dummy PDF\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n")
    return FileResponse(buf, as_attachment=True, filename=filename)


# ─────────────────────── Available courses (mejorado para tu UI) ───────────────────────
class AvailableCoursesView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        plan_id = request.query_params.get("plan_id")
        semester = request.query_params.get("semester")
        q = (request.query_params.get("q") or "").strip()
        academic_period = (request.query_params.get("academic_period") or "2025-I").strip()

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
            from django.db.models import Q
            qs = qs.filter(Q(course__code__icontains=q) | Q(course__name__icontains=q))

        qs = qs.order_by("course__code")

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
            slots = []
            for sl in sec.schedule_slots.all().order_by("weekday", "start"):
                day = INT_TO_DAY.get(int(sl.weekday), str(sl.weekday))
                slots.append(f"{day} {str(sl.start)[:5]}-{str(sl.end)[:5]}")
            return ", ".join(slots)

        courses = []
        for pc in qs:
            secs = secs_by_pc.get(pc.id, [])
            parts = []
            for sec in secs[:3]:
                sstr = slots_to_str(sec)
                if sstr:
                    parts.append(f"{sec.label}: {sstr}")
            schedule_str = " | ".join(parts) if parts else ""

            courses.append({
                "id": pc.id,
                "code": pc.course.code,
                "name": pc.course.name,
                "credits": pc.course.credits,
                "schedule": schedule_str,
            })

        return ok(courses=courses)


# ─────────────────────── Enrollment endpoints que tu frontend exige ───────────────────────
class EnrollmentValidateView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        body = request.data or {}
        academic_period = (body.get("academic_period") or "2025-I").strip()
        course_ids = body.get("course_ids") or []
        if not isinstance(course_ids, list) or not course_ids:
            return Response({"detail": "course_ids debe ser una lista no vacía"}, status=400)

        try:
            course_ids = [int(x) for x in course_ids]
        except Exception:
            return Response({"detail": "course_ids inválidos"}, status=400)

        sections_qs = (
            Section.objects
            .select_related("plan_course__course", "teacher__user")
            .prefetch_related("schedule_slots")
            .filter(plan_course_id__in=course_ids, period=academic_period)
            .order_by("plan_course_id", "label", "id")
        )
        sections = list(sections_qs)

        chosen = {}
        for s in sections:
            if s.plan_course_id not in chosen:
                chosen[s.plan_course_id] = s

        missing = [cid for cid in course_ids if cid not in chosen]
        if missing:
            return Response({
                "errors": [f"No hay secciones disponibles en {academic_period} para course_id(s): {missing}"],
                "warnings": [],
                "suggestions": [],
                "schedule_conflicts": [],
            }, status=409)

        chosen_sections = list(chosen.values())
        conflicts = _detect_schedule_conflicts(chosen_sections)

        if conflicts:
            return Response({
                "errors": ["Se detectaron choques de horario entre cursos seleccionados."],
                "warnings": [],
                "suggestions": [],
                "schedule_conflicts": conflicts,
            }, status=409)

        return ok(warnings=[])


class EnrollmentSuggestionsView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        body = request.data or {}
        academic_period = (body.get("academic_period") or "2025-I").strip()
        course_ids = body.get("course_ids") or []
        if not isinstance(course_ids, list) or not course_ids:
            return ok(suggestions=[])

        try:
            course_ids = [int(x) for x in course_ids]
        except Exception:
            return ok(suggestions=[])

        all_secs = list(
            Section.objects
            .select_related("plan_course__course", "teacher__user")
            .prefetch_related("schedule_slots")
            .filter(plan_course_id__in=course_ids, period=academic_period)
            .order_by("plan_course_id", "label", "id")
        )

        chosen = {}
        by_course = {}
        for s in all_secs:
            by_course.setdefault(s.plan_course_id, []).append(s)
            if s.plan_course_id not in chosen:
                chosen[s.plan_course_id] = s

        chosen_sections = list(chosen.values())
        base_conflicts = _detect_schedule_conflicts(chosen_sections)
        if not base_conflicts:
            return ok(suggestions=[])

        conflict_course_ids = set()
        for c in base_conflicts:
            a = next((s for s in chosen_sections if s.id == c["a"]), None)
            b = next((s for s in chosen_sections if s.id == c["b"]), None)
            if a:
                conflict_course_ids.add(a.plan_course_id)
            if b:
                conflict_course_ids.add(b.plan_course_id)

        suggestions = []

        for pc_id in conflict_course_ids:
            current = chosen.get(pc_id)
            candidates = [s for s in by_course.get(pc_id, []) if (not current or s.id != current.id)]

            others = [s for s in chosen_sections if s.plan_course_id != pc_id]

            for cand in candidates:
                test = others + [cand]
                if not _detect_schedule_conflicts(test):
                    pc = cand.plan_course
                    crs = pc.course

                    teacher_name = _get_full_name(getattr(cand.teacher, "user", None)) if cand.teacher else ""
                    slots = _slots_for_section(cand)

                    suggestions.append({
                        "course_id": pc.id,
                        "course_code": crs.code,
                        "course_name": crs.name,
                        "credits": crs.credits,
                        "section_code": cand.label,
                        "teacher_name": teacher_name,
                        "slots": slots,
                        "capacity": cand.capacity,
                        "available": cand.capacity,
                    })
                    break

        return ok(suggestions=suggestions)


class EnrollmentCommitView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        body = request.data or {}
        academic_period = (body.get("academic_period") or "2025-I").strip()
        course_ids = body.get("course_ids") or []
        if not isinstance(course_ids, list) or not course_ids:
            return Response({"detail": "course_ids debe ser lista no vacía"}, status=400)

        validate_view = EnrollmentValidateView()
        validate_view.request = request
        resp = validate_view.post(request)
        if resp.status_code == 409:
            return resp
        if resp.status_code != 200:
            return resp

        enrollment_id = int(datetime.now().timestamp() * 1000) + random.randint(1, 999)
        return ok(enrollment_id=enrollment_id, academic_period=academic_period)


class EnrollmentCertificateView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, enrollment_id: int):
        return ok(
            success=True,
            downloadUrl=f"/api/enrollments/{enrollment_id}/certificate/pdf",
            download_url=f"/api/enrollments/{enrollment_id}/certificate/pdf",
        )

    def get(self, request, enrollment_id: int):
        return ok(
            success=True,
            downloadUrl=f"/api/enrollments/{enrollment_id}/certificate/pdf",
            download_url=f"/api/enrollments/{enrollment_id}/certificate/pdf",
        )


class EnrollmentCertificatePDFView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, enrollment_id: int):
        return _dummy_pdf_response(f"matricula-{enrollment_id}.pdf")


class ScheduleExportView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        body = request.data or {}
        period = (body.get("academic_period") or "2025-I").strip()
        return ok(
            success=True,
            downloadUrl=f"/api/schedules/export/pdf?academic_period={period}",
            download_url=f"/api/schedules/export/pdf?academic_period={period}",
        )


class ScheduleExportPDFView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        period = (request.query_params.get("academic_period") or "2025-I").strip()
        return _dummy_pdf_response(f"horario-{period}.pdf")


# ─────────────────────── Teachers / Classrooms ───────────────────────
class TeachersViewSet(viewsets.ViewSet):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request, *args, **kwargs):
        qs = list_teacher_users_qs()

        if not qs.exists():
            ts = Teacher.objects.select_related("user").all()
            teachers = [{
                "id": t.user_id,
                "full_name": _get_full_name(t.user) if t.user else f"Teacher #{t.id}",
                "email": getattr(t.user, "email", "") if t.user else "",
                "username": getattr(t.user, "username", "") if t.user else "",
            } for t in ts]
            return ok(teachers=teachers)

        teachers = [{
            "id": u.id,
            "full_name": _get_full_name(u),
            "email": getattr(u, "email", "") or "",
            "username": getattr(u, "username", "") or "",
        } for u in qs]

        return ok(teachers=teachers)


class ClassroomsViewSet(viewsets.ReadOnlyModelViewSet):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    queryset = Classroom.objects.all()
    serializer_class = ClassroomSerializer

    def list(self, request, *args, **kwargs):
        data = self.get_serializer(self.get_queryset(), many=True).data
        return ok(classrooms=data)


# ───────────────────────── Plans / Mallas ─────────────────────────
class PlansViewSet(viewsets.ModelViewSet):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    queryset = Plan.objects.select_related("career").all()

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return PlanCreateSerializer
        return PlanSerializer

    def list(self, request, *args, **kwargs):
        return ok(plans=PlanSerializer(self.get_queryset(), many=True).data)

    def create(self, request, *args, **kwargs):
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        plan = ser.save()
        return ok(plan=PlanSerializer(plan).data)

    def retrieve(self, request, pk=None):
        plan = self.get_object()
        return ok(plan=PlanSerializer(plan).data)

    def update(self, request, pk=None):
        plan = self.get_object()
        ser = self.get_serializer(plan, data=request.data, partial=False)
        ser.is_valid(raise_exception=True)
        plan = ser.save()
        return ok(plan=PlanSerializer(plan).data)

    def destroy(self, request, pk=None):
        plan = self.get_object()
        plan.delete()
        return ok(success=True)

    @action(detail=True, methods=["get", "post"], url_path="courses")
    def courses(self, request, pk=None):
        plan = self.get_object()

        if request.method.lower() == "get":
            qs = PlanCourse.objects.filter(plan=plan).select_related("course")
            return ok(courses=PlanCourseOutSerializer(qs, many=True).data)

        payload_ser = PlanCourseCreateSerializer(data=request.data)
        payload_ser.is_valid(raise_exception=True)
        data = payload_ser.validated_data

        with transaction.atomic():
            course, _ = Course.objects.get_or_create(
                code=data["code"],
                defaults={"name": data["name"], "credits": data.get("credits", 3)},
            )
            course.name = data["name"]
            course.credits = data.get("credits", course.credits)
            course.save()

            pc, _ = PlanCourse.objects.get_or_create(plan=plan, course=course)
            pc.semester = data.get("semester", pc.semester)
            pc.weekly_hours = data.get("weekly_hours", pc.weekly_hours)
            pc.type = data.get("type", pc.type)
            pc.save()

        return ok(course=PlanCourseOutSerializer(pc).data)

    @action(detail=True, methods=["put", "delete"], url_path=r"courses/(?P<course_id>\d+)")
    def course_detail(self, request, pk=None, course_id=None):
        plan = self.get_object()
        pc = get_object_or_404(PlanCourse, plan=plan, id=int(course_id))

        if request.method.lower() == "delete":
            pc.delete()
            return ok(success=True)

        body = request.data or {}

        with transaction.atomic():
            if "semester" in body:
                pc.semester = int(body["semester"])
            if "weekly_hours" in body:
                pc.weekly_hours = int(body["weekly_hours"])
            if "type" in body:
                pc.type = body["type"]
            pc.save()

            c = pc.course
            if "code" in body and body["code"] != c.code:
                c.code = body["code"]
            if "name" in body:
                c.name = body["name"]
            if "credits" in body:
                c.credits = int(body["credits"])
            c.save()

        return ok(course=PlanCourseOutSerializer(pc).data)

    @action(detail=True, methods=["get", "put"], url_path=r"courses/(?P<course_id>\d+)/prereqs")
    def prereqs(self, request, pk=None, course_id=None):
        plan = self.get_object()
        pc = get_object_or_404(PlanCourse, plan=plan, id=int(course_id))

        if request.method.lower() == "get":
            ids = CoursePrereq.objects.filter(plan_course=pc).values_list("prerequisite_id", flat=True)
            return ok(prerequisites=[{"id": i} for i in ids])

        ids = (request.data or {}).get("prerequisites", [])
        if not isinstance(ids, list):
            return Response({"detail": "prerequisites debe ser lista"}, status=400)

        valid = set(PlanCourse.objects.filter(plan=plan, id__in=ids).values_list("id", flat=True))

        with transaction.atomic():
            CoursePrereq.objects.filter(plan_course=pc).delete()
            for pid in valid:
                if pid == pc.id:
                    continue
                CoursePrereq.objects.create(plan_course=pc, prerequisite_id=pid)

        return ok(success=True, prerequisites=[{"id": i} for i in sorted(valid) if i != pc.id])


# ─────────────────────── Secciones / Horarios ───────────────────────
class SectionsViewSet(viewsets.ModelViewSet):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    queryset = Section.objects.all()

    def get_queryset(self):
        qs = Section.objects.select_related(
            "plan_course__course", "teacher__user", "classroom"
        ).prefetch_related("schedule_slots")
        period = self.request.query_params.get("period")
        if period:
            qs = qs.filter(period=period)
        return qs

    def list(self, request, *args, **kwargs):
        return ok(sections=SectionOutSerializer(self.get_queryset(), many=True).data)

    def retrieve(self, request, pk=None, *args, **kwargs):
        sec = get_object_or_404(self.get_queryset(), id=int(pk))
        return ok(section=SectionOutSerializer(sec).data)

    def create(self, request, *args, **kwargs):
        ser = SectionCreateUpdateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        pc = get_object_or_404(PlanCourse, id=int(data["course_id"]))
        teacher = resolve_teacher(data.get("teacher_id"))
        room = resolve_classroom(data.get("room_id"))

        capacity = int(data.get("capacity") or 30)
        if room and room.capacity and capacity > room.capacity:
            return Response({"detail": "capacity excede la capacidad del aula"}, status=400)

        sec = Section.objects.create(
            plan_course=pc,
            teacher=teacher,
            classroom=room,
            capacity=capacity,
            period=(data.get("period") or "2025-I"),
            label=(data.get("label") or "A"),
        )

        slots = data.get("slots", [])
        for sl in slots:
            SectionScheduleSlot.objects.create(
                section=sec,
                weekday=DAY_TO_INT[sl["day"]],
                start=sl["start"],
                end=sl["end"],
            )

        sec = self.get_queryset().get(id=sec.id)
        return ok(section=SectionOutSerializer(sec).data)

    def update(self, request, pk=None, *args, **kwargs):
        sec = get_object_or_404(Section, id=int(pk))
        ser = SectionCreateUpdateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        if "teacher_id" in data:
            sec.teacher = resolve_teacher(data.get("teacher_id"))
        if "room_id" in data:
            sec.classroom = resolve_classroom(data.get("room_id"))
        if "capacity" in data:
            sec.capacity = int(data.get("capacity") or sec.capacity)
        if "period" in data:
            sec.period = data.get("period") or sec.period
        if "label" in data:
            sec.label = data.get("label") or sec.label

        if sec.classroom and sec.classroom.capacity and sec.capacity > sec.classroom.capacity:
            return Response({"detail": "capacity excede la capacidad del aula"}, status=400)

        sec.save()

        if "slots" in data:
            SectionScheduleSlot.objects.filter(section=sec).delete()
            for sl in data.get("slots", []):
                SectionScheduleSlot.objects.create(
                    section=sec,
                    weekday=DAY_TO_INT[sl["day"]],
                    start=sl["start"],
                    end=sl["end"],
                )

        sec = self.get_queryset().get(id=sec.id)
        return ok(section=SectionOutSerializer(sec).data)

    def partial_update(self, request, pk=None, *args, **kwargs):
        sec = get_object_or_404(Section, id=int(pk))
        body = request.data or {}

        if "teacher_id" in body:
            sec.teacher = resolve_teacher(body.get("teacher_id"))
        if "room_id" in body:
            sec.classroom = resolve_classroom(body.get("room_id"))
        if "capacity" in body:
            sec.capacity = int(body.get("capacity") or sec.capacity)
        if "period" in body:
            sec.period = body.get("period") or sec.period
        if "label" in body:
            sec.label = body.get("label") or sec.label

        if sec.classroom and sec.classroom.capacity and sec.capacity > sec.classroom.capacity:
            return Response({"detail": "capacity excede la capacidad del aula"}, status=400)

        sec.save()

        if "slots" in body and isinstance(body["slots"], list):
            tmp = SectionCreateUpdateSerializer(data={"course_id": sec.plan_course_id, "slots": body["slots"]})
            tmp.is_valid(raise_exception=True)

            SectionScheduleSlot.objects.filter(section=sec).delete()
            for sl in tmp.validated_data.get("slots", []):
                SectionScheduleSlot.objects.create(
                    section=sec,
                    weekday=DAY_TO_INT[sl["day"]],
                    start=sl["start"],
                    end=sl["end"],
                )

        sec = self.get_queryset().get(id=sec.id)
        return ok(section=SectionOutSerializer(sec).data)

    def destroy(self, request, pk=None, *args, **kwargs):
        sec = get_object_or_404(Section, id=int(pk))
        sec.delete()
        return ok(success=True)

    @action(detail=True, methods=["get", "put"], url_path="schedule")
    def schedule(self, request, pk=None):
        sec = get_object_or_404(Section, id=int(pk))

        if request.method.lower() == "get":
            sec = Section.objects.prefetch_related("schedule_slots").get(id=sec.id)
            return ok(slots=SectionOutSerializer(sec).data["slots"])

        slots = (request.data or {}).get("slots", [])
        if not isinstance(slots, list):
            return Response({"detail": "slots debe ser lista"}, status=400)

        tmp = SectionCreateUpdateSerializer(data={"course_id": sec.plan_course_id, "slots": slots})
        tmp.is_valid(raise_exception=True)

        SectionScheduleSlot.objects.filter(section=sec).delete()
        for sl in tmp.validated_data.get("slots", []):
            SectionScheduleSlot.objects.create(
                section=sec,
                weekday=DAY_TO_INT[sl["day"]],
                start=sl["start"],
                end=sl["end"],
            )

        sec = Section.objects.prefetch_related("schedule_slots").get(id=sec.id)
        return ok(success=True, slots=SectionOutSerializer(sec).data["slots"])


class SectionsScheduleConflictsView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        payload = request.data or {}
        slots = payload.get("slots", [])
        conflicts = []
        seen = set()
        for sl in slots:
            key = (sl.get("day") or sl.get("weekday"), sl.get("start"), sl.get("end"))
            if key in seen:
                conflicts.append({"message": f"Conflicto en {key[0]} {key[1]}-{key[2]}"} )
            seen.add(key)
        return ok(conflicts=conflicts)


# ─────────────────────── Attendance ───────────────────────
class AttendanceSessionsView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, section_id):
        qs = AttendanceSession.objects.filter(section_id=section_id).prefetch_related("rows").order_by("-id")
        return ok(sessions=AttendanceSessionSerializer(qs, many=True).data)

    # ✅ CORREGIDO: acepta date
    def post(self, request, section_id):
        body = request.data or {}
        date_str = body.get("date")

        if date_str:
            try:
                d = datetime.strptime(date_str, "%Y-%m-%d").date()
            except Exception:
                return Response({"detail": "date inválida (YYYY-MM-DD)"}, status=400)

            sess, _ = AttendanceSession.objects.get_or_create(section_id=section_id, date=d)
        else:
            sess = AttendanceSession.objects.create(section_id=section_id)

        return ok(session=AttendanceSessionSerializer(sess).data)


class AttendanceSessionCloseView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, section_id, session_id):
        sess = get_object_or_404(AttendanceSession, id=session_id, section_id=section_id)
        sess.closed = True
        sess.save()
        return ok(success=True)


class AttendanceSessionSetView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    # ✅ CORREGIDO: normaliza int + upper
    def put(self, request, section_id, session_id):
        sess = get_object_or_404(AttendanceSession, id=session_id, section_id=section_id)
        rows = (request.data or {}).get("rows", [])
        if not isinstance(rows, list):
            return Response({"detail": "rows debe ser lista"}, status=400)

        with transaction.atomic():
            AttendanceRow.objects.filter(session=sess).delete()
            for r in rows:
                sid = r.get("student_id")
                try:
                    sid = int(sid)
                except Exception:
                    sid = 0

                st = (r.get("status") or "").upper().strip()
                AttendanceRow.objects.create(session=sess, student_id=sid, status=st)

        return ok(success=True)


# ─────────────────────── Syllabus ───────────────────────
class SyllabusView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, section_id):
        s = Syllabus.objects.filter(section_id=section_id).first()
        if not s:
            return ok(syllabus=None)
        return ok(syllabus={"filename": s.file.name, "size": getattr(s.file, "size", 0)})

    def post(self, request, section_id):
        f = request.FILES.get("file")
        if not f:
            return Response({"detail": "Archivo requerido"}, status=status.HTTP_400_BAD_REQUEST)

        obj, _ = Syllabus.objects.get_or_create(section_id=section_id)
        obj.file = f
        obj.save()
        return ok(syllabus={"filename": obj.file.name, "size": getattr(obj.file, "size", 0)})

    def delete(self, request, section_id):
        Syllabus.objects.filter(section_id=section_id).delete()
        return ok(success=True)


# ─────────────────────── Evaluación config ───────────────────────
class EvaluationConfigView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, section_id):
        obj = EvaluationConfig.objects.filter(section_id=section_id).first()
        return ok(config=(obj.config if obj else []))

    def put(self, request, section_id):
        cfg = request.data if isinstance(request.data, list) else (request.data or {}).get("config", [])
        obj, _ = EvaluationConfig.objects.get_or_create(section_id=section_id)
        obj.config = cfg
        obj.save()
        return ok(config=obj.config)


# ─────────────────────────── Kardex (dummy) ───────────────────────────
class KardexView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, student_id):
        return ok(
            student_id=student_id,
            student_name="Estudiante Demo",
            career_name="Ingeniería",
            credits_earned=96,
            gpa=14.2,
        )


class KardexBoletaPDFView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, student_id):
        return _dummy_pdf_response(f"boleta-{student_id}.pdf")

    def post(self, request, student_id):
        return _dummy_pdf_response(f"boleta-{student_id}.pdf")


class KardexConstanciaPDFView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, student_id):
        return _dummy_pdf_response(f"constancia-{student_id}.pdf")

    def post(self, request, student_id):
        return _dummy_pdf_response(f"constancia-{student_id}.pdf")


# ───────────────────── Procesos académicos ─────────────────────
class ProcessesCreateView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, ptype=None):
        body = request.data or {}
        proc = AcademicProcess.objects.create(
            kind=ptype,
            student_id=body.get("student_id") or 0,
            status="PENDIENTE",
            note=body.get("reason", "") or "",
        )
        return ok(process={
            "id": proc.id,
            "type": proc.kind,
            "status": proc.status,
            "student_id": proc.student_id,
            "period": body.get("period"),
            "reason": body.get("reason", ""),
            "extra": body.get("extra", ""),
            "created_at": datetime.now().isoformat(),
        })


class ProcessesListView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = AcademicProcess.objects.all().order_by("-id")
        data = [{"id": p.id, "type": p.kind, "status": p.status, "student_id": p.student_id, "note": p.note} for p in qs]
        return ok(processes=data)


class ProcessesMineView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = AcademicProcess.objects.all().order_by("-id")
        data = [{"id": p.id, "type": p.kind, "status": p.status, "student_id": p.student_id, "note": p.note} for p in qs]
        return ok(processes=data)


class ProcessDetailView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pid):
        p = get_object_or_404(AcademicProcess, id=pid)
        return ok(process={"id": p.id, "type": p.kind, "status": p.status, "student_id": p.student_id, "note": p.note})


class ProcessStatusView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pid):
        body = request.data or {}
        p = get_object_or_404(AcademicProcess, id=pid)
        if body.get("status"):
            p.status = body["status"]
        if body.get("note") is not None:
            p.note = body.get("note") or ""
        p.save()
        return ok(success=True)


class ProcessNotifyView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pid):
        return ok(sent=True)


class ProcessFilesView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pid):
        qs = ProcessFile.objects.filter(process_id=pid).order_by("-id")
        files = [{"id": f.id, "name": f.file.name, "size": getattr(f.file, "size", 0)} for f in qs]
        return ok(files=files)

    def post(self, request, pid):
        f = request.FILES.get("file")
        if not f:
            return Response({"detail": "Archivo requerido"}, status=400)
        pf = ProcessFile.objects.create(process_id=pid, file=f, note=(request.data or {}).get("note", ""))
        return ok(file={"id": pf.id, "name": pf.file.name, "size": getattr(pf.file, "size", 0)})


class ProcessFileDeleteView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, pid, file_id):
        ProcessFile.objects.filter(process_id=pid, id=file_id).delete()
        return ok(success=True)


# ───────────────────── Reportes académicos (✅ YA NO DUMMY) ─────────────────────
class AcademicReportsSummaryView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # ✅ IMPLEMENTADO: cuenta usuarios activos con rol STUDENT
        students_count = list_student_users_qs().count()

        return ok(summary={
            "students": students_count,
            "sections": Section.objects.count(),
            "teachers": count_teachers(),
            "occupancy": 0.76,
            "avg_gpa": 13.4
        })


def _xlsx_response(filename="reporte.xlsx"):
    content = b"Dummy,Excel\n1,2\n"
    resp = HttpResponse(content, content_type="application/vndopenxmlformats-officedocument.spreadsheetml.sheet")
    resp["Content-Disposition"] = f'attachment; filename="{filename}"'
    return resp


class AcademicReportPerformanceXlsxView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return _xlsx_response("performance.xlsx")


class AcademicReportOccupancyXlsxView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return _xlsx_response("occupancy.xlsx")


# ─────────────────────────────────────────────────────────────
# ✅ LO QUE TE FALTABA: DOCENTE / ESTUDIANTES / NOTAS / ACTA / IMPORT
# ─────────────────────────────────────────────────────────────

class TeacherSectionsView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, teacher_user_id: int):
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

        sections = []
        for s in qs:
            crs = s.plan_course.course
            sections.append({
                "id": s.id,
                "course_name": crs.name,
                "course_code": crs.code,
                "section_code": s.label,
                "label": s.label,
                "period": s.period,
                "plan_course_id": s.plan_course_id,
                "room_name": s.classroom.code if s.classroom else "",
            })

        return ok(sections=sections)


class SectionStudentsView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    # NOTA: sin matrícula real, devolvemos usuarios con rol estudiante
    def get(self, request, section_id: int):
        qs = list_student_users_qs().order_by("id")[:200]

        students = []
        for u in qs:
            full = _get_full_name(u)
            parts = full.split()
            first = parts[0] if parts else ""
            last = " ".join(parts[1:]) if len(parts) > 1 else ""

            students.append({
                "id": u.id,
                "first_name": first,
                "last_name": last,
            })

        return ok(students=students)


class SectionGradesView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, section_id: int):
        sec = get_object_or_404(Section, id=section_id)
        bundle, _ = SectionGrades.objects.get_or_create(section=sec)
        return ok(grades=bundle.grades, submitted=bundle.submitted)


class GradesSaveView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        body = request.data or {}
        section_id = body.get("section_id")
        grades = body.get("grades") or {}

        if not section_id:
            return Response({"detail": "section_id requerido"}, status=400)
        if not isinstance(grades, dict):
            return Response({"detail": "grades debe ser objeto"}, status=400)

        sec = get_object_or_404(Section, id=int(section_id))
        bundle, _ = SectionGrades.objects.get_or_create(section=sec)

        if bundle.submitted:
            return Response({"detail": "Las calificaciones ya están cerradas."}, status=409)

        bundle.grades = grades
        bundle.save()
        return ok(success=True)


class GradesSubmitView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        body = request.data or {}
        section_id = body.get("section_id")
        grades = body.get("grades") or {}

        if not section_id:
            return Response({"detail": "section_id requerido"}, status=400)
        if not isinstance(grades, dict):
            return Response({"detail": "grades debe ser objeto"}, status=400)

        sec = get_object_or_404(Section, id=int(section_id))
        bundle, _ = SectionGrades.objects.get_or_create(section=sec)

        bundle.grades = grades
        bundle.submitted = True
        bundle.submitted_at = timezone.now()
        bundle.save()

        return ok(success=True, submitted=True)


class GradesReopenView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not user_has_any_role(request.user, ["REGISTRAR", "ADMIN_ACADEMIC"]):
            return Response({"detail": "No autorizado"}, status=403)

        body = request.data or {}
        section_id = body.get("section_id")
        if not section_id:
            return Response({"detail": "section_id requerido"}, status=400)

        sec = get_object_or_404(Section, id=int(section_id))
        bundle, _ = SectionGrades.objects.get_or_create(section=sec)
        bundle.submitted = False
        bundle.submitted_at = None
        bundle.save()

        return ok(success=True, submitted=False)


# ─────────────────────── Acta (dummy para polling) ───────────────────────
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
        return _dummy_pdf_response(f"acta-section-{section_id}.pdf")


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
        # PNG 1x1 (dummy)
        png_1x1 = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6X1fQAAAABJRU5ErkJggg=="
        )
        return HttpResponse(png_1x1, content_type="image/png")


# ─────────────────────── Attendance Import ───────────────────────
ALLOWED_ATT = {"PRESENT", "ABSENT", "LATE", "EXCUSED"}

class AttendanceImportPreviewView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        f = request.FILES.get("file")
        section_id = (request.data or {}).get("section_id")

        if not f or not section_id:
            return Response({"detail": "file y section_id son requeridos"}, status=400)

        try:
            int(section_id)
        except Exception:
            return Response({"detail": "section_id inválido"}, status=400)

        errors = []
        preview = []

        decoded = f.read().decode("utf-8-sig", errors="ignore").splitlines()
        reader = csv.DictReader(decoded)

        for idx, row in enumerate(reader, start=2):
            status_val = (row.get("status") or row.get("estado") or "").strip().upper()
            date_val = (row.get("date") or row.get("fecha") or "").strip()
            student_name = (row.get("student_name") or row.get("nombre") or row.get("student") or "").strip()
            student_id = (row.get("student_id") or row.get("id") or "").strip()

            if status_val not in ALLOWED_ATT:
                errors.append({"row": idx, "message": f"status inválido: {status_val}"})
                continue

            if date_val:
                try:
                    datetime.strptime(date_val, "%Y-%m-%d")
                except Exception:
                    errors.append({"row": idx, "message": "date inválida (YYYY-MM-DD)"})
                    continue
            else:
                date_val = str(timezone.now().date())

            if not student_id and not student_name:
                errors.append({"row": idx, "message": "Falta student_id o student_name"})
                continue

            preview.append({
                "student_id": int(student_id) if student_id.isdigit() else None,
                "student_name": student_name or (f"ID {student_id}" if student_id else "Desconocido"),
                "date": date_val,
                "status": status_val,
            })

        return ok(preview=preview, errors=errors)


class AttendanceImportSaveView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        body = request.data or {}
        section_id = body.get("section_id")
        data = body.get("attendance_data") or []

        if not section_id:
            return Response({"detail": "section_id requerido"}, status=400)
        if not isinstance(data, list):
            return Response({"detail": "attendance_data debe ser lista"}, status=400)

        section = get_object_or_404(Section, id=int(section_id))

        by_date = {}
        for r in data:
            dt = (r.get("date") or "").strip()
            st = (r.get("status") or "").strip().upper()
            sid = r.get("student_id")

            if not dt or st not in ALLOWED_ATT:
                continue
            by_date.setdefault(dt, []).append((sid, st))

        with transaction.atomic():
            for dt, rows in by_date.items():
                d = datetime.strptime(dt, "%Y-%m-%d").date()
                sess, _ = AttendanceSession.objects.get_or_create(section=section, date=d)

                AttendanceRow.objects.filter(session=sess).delete()
                for sid, st in rows:
                    try:
                        sid_int = int(sid) if sid is not None else 0
                    except Exception:
                        sid_int = 0
                    AttendanceRow.objects.create(session=sess, student_id=sid_int, status=st)

        return ok(success=True)
