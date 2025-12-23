from datetime import datetime
from io import BytesIO

from django.db import transaction
from django.http import FileResponse, HttpResponse
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
from django.db.models import Q

from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework_simplejwt.authentication import JWTAuthentication

from .models import (
    Plan, PlanCourse, Course, CoursePrereq,
    Teacher, Classroom,
    Section, SectionScheduleSlot,
    AttendanceSession, AttendanceRow,
    Syllabus, EvaluationConfig,
    AcademicProcess, ProcessFile
)
from .serializers import (
    PlanSerializer, PlanCreateSerializer,
    PlanCourseOutSerializer, PlanCourseCreateSerializer,
    TeacherSerializer, ClassroomSerializer,
    SectionOutSerializer,
    AttendanceSessionSerializer,
    EvaluationConfigSerializer
)

# ───────────────────────── Helpers ─────────────────────────
def ok(data=None, **extra):
    if data is None:
        data = {}
    data.update(extra)
    return Response(data)


DAY_TO_INT = {"MON": 1, "TUE": 2, "WED": 3, "THU": 4, "FRI": 5, "SAT": 6, "SUN": 7}


def _get_full_name(u):
    # Compatible con User custom / Django default / campos alternos
    if hasattr(u, "get_full_name"):
        fn = (u.get_full_name() or "").strip()
        if fn:
            return fn
    for attr in ("full_name", "name"):
        if hasattr(u, attr):
            v = (getattr(u, attr) or "").strip()
            if v:
                return v
    # fallback duro
    return (getattr(u, "username", "") or getattr(u, "email", "") or f"User {u.id}").strip()


from django.core.exceptions import FieldError
from django.db.models import Q
from django.contrib.auth import get_user_model

def list_teacher_users_qs():
    User = get_user_model()
    qs = User.objects.filter(is_active=True)

    # ✅ Caso real: roles es ManyToMany (lo confirmaste con user.roles.set)
    # Usa iexact para evitar problemas de mayúsculas/minúsculas ("teacher" vs "TEACHER")
    teacher_names = ["TEACHER", "DOCENTE", "PROFESOR"]

    base = qs.filter(roles__name__in=teacher_names).distinct()
    if base.exists():
        return base

    # ✅ Si tu Role llegara a tener code (opcional), lo intentamos sin romper
    try:
        alt = qs.filter(roles__code__in=teacher_names).distinct()
        if alt.exists():
            return alt
    except FieldError:
        pass

    return qs.none()



def resolve_teacher(teacher_id):
    """
    Acepta teacher_id como:
    - Teacher.id (modo viejo)
    - User.id (modo nuevo del frontend) ✅
    """
    if not teacher_id:
        return None

    # 1) intentar como Teacher.id
    t = Teacher.objects.select_related("user").filter(id=int(teacher_id)).first()
    if t:
        return t

    # 2) tratar como User.id
    User = get_user_model()
    u = get_object_or_404(User, id=int(teacher_id))

    # crea Teacher si no existe (requiere que Teacher tenga user y no más campos obligatorios)
    t, _ = Teacher.objects.get_or_create(user=u)
    return t


def count_teachers():
    qs = list_teacher_users_qs()
    if qs.exists():
        return qs.count()
    return Teacher.objects.count()



# ─────────────────────── Teachers / Classrooms ───────────────────────
class TeachersViewSet(viewsets.ViewSet):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request, *args, **kwargs):
        qs = list_teacher_users_qs()

        # ✅ fallback: si el filtro por roles no encuentra nada,
        # devolvemos los Teacher existentes
        if not qs.exists():
            ts = Teacher.objects.select_related("user").all()
            teachers = [{
                "id": t.user_id,  # ✅ User.id (lo que tu frontend manda)
                "full_name": _get_full_name(t.user),
                "email": getattr(t.user, "email", "") or "",
                "username": getattr(t.user, "username", "") or "",
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
        # frontend espera ok(classrooms=[...])
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
        plans = self.get_queryset()
        return ok(plans=PlanSerializer(plans, many=True).data)

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

    # ✅ /academic/plans/<id>/courses (GET/POST)
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

    # ✅ /academic/plans/<id>/courses/<course_id> (PUT/DELETE)
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

    # ✅ /academic/plans/<id>/courses/<course_id>/prereqs (GET/PUT)
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
class SectionsViewSet(viewsets.ViewSet):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        period = request.query_params.get("period")
        qs = Section.objects.select_related(
            "plan_course__course", "teacher__user", "classroom"
        ).prefetch_related("schedule_slots")
        if period:
            qs = qs.filter(period=period)
        return ok(sections=SectionOutSerializer(qs, many=True).data)

    def create(self, request):
        body = request.data or {}

        course_id = body.get("course_id")
        if not course_id:
            return Response({"detail": "course_id requerido"}, status=400)

        pc = get_object_or_404(PlanCourse, id=int(course_id))

        # ✅ FIX: teacher_id viene como User.id desde el frontend
        teacher = resolve_teacher(body.get("teacher_id"))

        room = None
        if body.get("room_id"):
            room = get_object_or_404(Classroom, id=int(body["room_id"]))

        sec = Section.objects.create(
            plan_course=pc,
            teacher=teacher,
            classroom=room,
            capacity=int(body.get("capacity") or 30),
            period=body.get("period") or "2025-I",
            label=body.get("label") or "A",
        )

        slots = body.get("slots", [])
        if isinstance(slots, list):
            for sl in slots:
                day = sl.get("day") or sl.get("weekday")
                wd = DAY_TO_INT.get(day, None)
                if wd is None:
                    try:
                        wd = int(day)
                    except Exception:
                        continue
                SectionScheduleSlot.objects.create(
                    section=sec,
                    weekday=wd,
                    start=sl.get("start"),
                    end=sl.get("end"),
                )

        sec = Section.objects.select_related(
            "plan_course__course", "teacher__user", "classroom"
        ).prefetch_related("schedule_slots").get(id=sec.id)

        return ok(section=SectionOutSerializer(sec).data)

    def retrieve(self, request, pk=None):
        sec = get_object_or_404(
            Section.objects.select_related(
                "plan_course__course", "teacher__user", "classroom"
            ).prefetch_related("schedule_slots"),
            id=int(pk)
        )
        return ok(section=SectionOutSerializer(sec).data)

    def update(self, request, pk=None):
        sec = get_object_or_404(Section, id=int(pk))
        body = request.data or {}

        # ✅ FIX: teacher_id viene como User.id desde el frontend
        if "teacher_id" in body:
            sec.teacher = resolve_teacher(body["teacher_id"]) if body["teacher_id"] else None

        if "room_id" in body:
            sec.classroom = Classroom.objects.filter(id=int(body["room_id"])).first() if body["room_id"] else None
        if "capacity" in body:
            sec.capacity = int(body["capacity"])
        if "period" in body:
            sec.period = body["period"]
        if "label" in body:
            sec.label = body["label"]
        sec.save()

        if "slots" in body and isinstance(body["slots"], list):
            SectionScheduleSlot.objects.filter(section=sec).delete()
            for sl in body["slots"]:
                day = sl.get("day") or sl.get("weekday")
                wd = DAY_TO_INT.get(day, None)
                if wd is None:
                    try:
                        wd = int(day)
                    except Exception:
                        continue
                SectionScheduleSlot.objects.create(
                    section=sec,
                    weekday=wd,
                    start=sl.get("start"),
                    end=sl.get("end")
                )

        sec = Section.objects.select_related(
            "plan_course__course", "teacher__user", "classroom"
        ).prefetch_related("schedule_slots").get(id=sec.id)

        return ok(section=SectionOutSerializer(sec).data)

    def destroy(self, request, pk=None):
        sec = get_object_or_404(Section, id=int(pk))
        sec.delete()
        return ok(success=True)

    # ✅ /sections/<id>/schedule (GET/PUT)
    @action(detail=True, methods=["get", "put"], url_path="schedule")
    def schedule(self, request, pk=None):
        sec = get_object_or_404(Section, id=int(pk))

        if request.method.lower() == "get":
            sec = Section.objects.prefetch_related("schedule_slots").get(id=sec.id)
            return ok(slots=SectionOutSerializer(sec).data["slots"])

        slots = (request.data or {}).get("slots", [])
        if not isinstance(slots, list):
            return Response({"detail": "slots debe ser lista"}, status=400)

        SectionScheduleSlot.objects.filter(section=sec).delete()
        for sl in slots:
            day = sl.get("day") or sl.get("weekday")
            wd = DAY_TO_INT.get(day, None)
            if wd is None:
                try:
                    wd = int(day)
                except Exception:
                    continue
            SectionScheduleSlot.objects.create(
                section=sec,
                weekday=wd,
                start=sl.get("start"),
                end=sl.get("end")
            )

        sec = Section.objects.prefetch_related("schedule_slots").get(id=sec.id)
        return ok(success=True, slots=SectionOutSerializer(sec).data["slots"])


# Conflictos de horario/aforo (mínimo: duplicados)
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
                conflicts.append({"message": f"Conflicto en {key[0]} {key[1]}-{key[2]}"})
            seen.add(key)
        return ok(conflicts=conflicts)


# ─────────────────────── Attendance (BD) ───────────────────────
class AttendanceSessionsView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, section_id):
        qs = AttendanceSession.objects.filter(section_id=section_id).prefetch_related("rows").order_by("-id")
        return ok(sessions=AttendanceSessionSerializer(qs, many=True).data)

    def post(self, request, section_id):
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

    def put(self, request, section_id, session_id):
        sess = get_object_or_404(AttendanceSession, id=session_id, section_id=section_id)
        rows = (request.data or {}).get("rows", [])
        if not isinstance(rows, list):
            return Response({"detail": "rows debe ser lista"}, status=400)

        with transaction.atomic():
            AttendanceRow.objects.filter(session=sess).delete()
            for r in rows:
                AttendanceRow.objects.create(session=sess, student_id=r.get("student_id"), status=r.get("status"))

        return ok(success=True)


# ─────────────────────── Syllabus (BD) ───────────────────────
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


# ─────────────────────── Evaluación config (BD) ───────────────────────
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


def _dummy_pdf_response(filename="documento.pdf"):
    buf = BytesIO(b"%PDF-1.4\n% Dummy PDF\n")
    return FileResponse(buf, as_attachment=True, filename=filename)


class KardexBoletaPDFView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, student_id):
        return _dummy_pdf_response(f"boleta-{student_id}.pdf")


class KardexConstanciaPDFView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, student_id):
        return _dummy_pdf_response(f"constancia-{student_id}.pdf")


# ───────────────────── Procesos académicos (BD) ─────────────────────
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


class ProcessFilesListView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pid):
        qs = ProcessFile.objects.filter(process_id=pid).order_by("-id")
        files = [{"id": f.id, "name": f.file.name, "size": getattr(f.file, "size", 0)} for f in qs]
        return ok(files=files)


class ProcessFileUploadView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

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


# ───────────────────── Reportes académicos (dummy) ─────────────────────
class AcademicReportsSummaryView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return ok(summary={
            "students": 1200,
            "sections": Section.objects.count(),
            "teachers": count_teachers(),  # ✅ FIX: cuenta usuarios TEACHER
            "occupancy": 0.76,
            "avg_gpa": 13.4
        })


def _xlsx_response(filename="reporte.xlsx"):
    content = b"Dummy,Excel\n1,2\n"
    resp = HttpResponse(content, content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
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
