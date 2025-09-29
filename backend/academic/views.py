# backend/academic/views.py
from datetime import datetime
from io import BytesIO
from django.http import FileResponse, HttpResponse
from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework_simplejwt.authentication import JWTAuthentication

# ───────────────────────── Helpers ─────────────────────────
def ok(data=None, **extra):
    if data is None: data = {}
    data.update(extra)
    return Response(data)

def parse_int(val, default=None):
    try:
        return int(val)
    except Exception:
        return default

# ─────────────────────── Catálogos base ───────────────────────
class TeachersViewSet(viewsets.ReadOnlyModelViewSet):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    queryset = []  # stub
    def list(self, request):
        return ok(teachers=[
            {"id": 1, "full_name": "Ana Docente"},
            {"id": 2, "full_name": "Luis Profesor"},
        ])

class ClassroomsViewSet(viewsets.ReadOnlyModelViewSet):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    queryset = []
    def list(self, request):
        return ok(classrooms=[
            {"id": 10, "name": "A-101", "capacity": 40},
            {"id": 11, "name": "B-202", "capacity": 30},
        ])

# ───────────────────────── Plans / Mallas ─────────────────────────
class PlansViewSet(viewsets.ViewSet):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    # almacenamiento en memoria para stub
    PLANS = []
    COURSES = {}        # {plan_id: [ {id, code, name, credits, weekly_hours, semester, type, prerequisites: [{id}]} ] }
    _pid = 1
    _cid = 1

    def list(self, request):
        return ok(plans=self.PLANS)

    def create(self, request):
        body = request.data or {}
        plan = {
            "id": self._pid,
            "name": body.get("name"),
            "career_id": body.get("career_id"),
            "career_name": "Carrera X",  # opcional
            "start_year": body.get("start_year", datetime.now().year),
            "semesters": body.get("semesters", 10),
            "description": body.get("description", ""),
        }
        self.PLANS.append(plan)
        self.COURSES[plan["id"]] = []
        self.__class__._pid += 1
        return ok(plan=plan)

    @action(detail=True, methods=["get"], url_path="courses")
    def list_courses(self, request, pk=None):
        pid = parse_int(pk)
        return ok(courses=self.COURSES.get(pid, []))

    @action(detail=True, methods=["post"], url_path="courses")
    def add_course(self, request, pk=None):
        pid = parse_int(pk)
        c = request.data or {}
        course = {
            "id": self._cid,
            "code": c.get("code"),
            "name": c.get("name"),
            "credits": c.get("credits", 3),
            "weekly_hours": c.get("weekly_hours", 3),
            "semester": c.get("semester", 1),
            "type": c.get("type", "MANDATORY"),
            "prerequisites": [],
        }
        self.COURSES.setdefault(pid, []).append(course)
        self.__class__._cid += 1
        return ok(course=course)

    @action(detail=True, methods=["put"], url_path=r"courses/(?P<course_id>\d+)/prereqs")
    def set_prereqs(self, request, pk=None, course_id=None):
        pid = parse_int(pk)
        cid = parse_int(course_id)
        ids = request.data.get("prerequisites", [])
        rows = self.COURSES.get(pid, [])
        for c in rows:
            if c["id"] == cid:
                c["prerequisites"] = [{"id": i} for i in ids]
                break
        return ok(success=True)

# ─────────────────────── Secciones / Horarios ───────────────────────
class SectionsViewSet(viewsets.ViewSet):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    SECTIONS = []
    _sid = 1

    def list(self, request):
        period = request.query_params.get("period")
        data = self.SECTIONS
        if period:
            data = [s for s in data if s.get("period") == period]
        return ok(sections=data)

    def create(self, request):
        body = request.data or {}
        s = {
            "id": self._sid,
            "course_code": body.get("course_code"),
            "course_name": body.get("course_name"),
            "teacher_id": body.get("teacher_id"),
            "teacher_name": "Docente #" + str(body.get("teacher_id") or ""),
            "room_id": body.get("room_id"),
            "room_name": "Aula #" + str(body.get("room_id") or ""),
            "capacity": body.get("capacity", 30),
            "period": body.get("period", "2025-I"),
            "slots": body.get("slots", []),  # [{day,start,end}]
        }
        self.SECTIONS.append(s)
        self.__class__._sid += 1
        return ok(section=s)

# Conflictos de horario/aforo
class SectionsScheduleConflictsView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        payload = request.data or {}
        slots = payload.get("slots", [])
        conflicts = []
        # stub: si hay dos slots con el mismo día & misma franja → conflicto
        seen = set()
        for sl in slots:
            key = (sl.get("day"), sl.get("start"), sl.get("end"))
            if key in seen:
                conflicts.append({"message": f"Conflicto en {key[0]} {key[1]}-{key[2]}"})
            seen.add(key)
        return ok(conflicts=conflicts)

# ─────────────────────── Attendance ───────────────────────
_ATT_SESSIONS = {}  # {section_id: [ {id, date, closed:bool, rows:[{student_id,status}], ...} ]}
_asid = 1

class AttendanceSessionsView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, section_id):
        return ok(sessions=_ATT_SESSIONS.get(section_id, []))

    def post(self, request, section_id):
        global _asid
        sess = {"id": _asid, "date": datetime.now().isoformat(), "closed": False, "rows": []}
        _ATT_SESSIONS.setdefault(section_id, []).append(sess)
        _asid += 1
        return ok(session=sess)

class AttendanceSessionCloseView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, section_id, session_id):
        rows = _ATT_SESSIONS.get(section_id, [])
        for s in rows:
            if s["id"] == int(session_id):
                s["closed"] = True
        return ok(success=True)

class AttendanceSessionSetView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def put(self, request, section_id, session_id):
        body = request.data or {}
        rows = _ATT_SESSIONS.get(section_id, [])
        for s in rows:
            if s["id"] == int(session_id):
                s["rows"] = body.get("rows", [])
        return ok(success=True)

# ─────────────────────── Syllabus & Evaluación ───────────────────────
_SYLLABUS = {}     # {section_id: {"filename": "..."}}
_EVALCFG = {}      # {section_id: [{code,label,weight}]}

class SyllabusView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, section_id):
        return ok(syllabus=_SYLLABUS.get(section_id))

    def post(self, request, section_id):
        # archivo en request.FILES['file']
        f = request.FILES.get("file")
        if not f:
            return Response({"detail": "Archivo requerido"}, status=status.HTTP_400_BAD_REQUEST)
        _SYLLABUS[section_id] = {"filename": f.name, "size": f.size}
        return ok(syllabus=_SYLLABUS[section_id])

    def delete(self, request, section_id):
        _SYLLABUS.pop(section_id, None)
        return ok(success=True)

class EvaluationConfigView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, section_id):
        return ok(config=_EVALCFG.get(section_id, []))

    def put(self, request, section_id):
        cfg = request.data if isinstance(request.data, list) else request.data.get("config", [])
        _EVALCFG[section_id] = cfg
        return ok(config=cfg)

# ─────────────────────────── Kardex ───────────────────────────
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
        # El FE puede usar polling: devuelve 200 y un ID; para el stub devolvemos el PDF directo
        return _dummy_pdf_response(f"boleta-{student_id}.pdf")

class KardexConstanciaPDFView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, student_id):
        return _dummy_pdf_response(f"constancia-{student_id}.pdf")

# ───────────────────── Procesos académicos ─────────────────────
_PROCESSES = []    # [{id,type,status,student_id,period,reason,created_at}]
_pid = 1
_PFILES = {}       # {pid: [{id, name, size}]}
_pfid = 1

class ProcessesCreateView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, ptype=None):
        global _pid
        body = request.data or {}
        row = {
            "id": _pid,
            "type": ptype,
            "status": "PENDIENTE",
            "student_id": body.get("student_id"),
            "period": body.get("period"),
            "reason": body.get("reason", ""),
            "extra": body.get("extra", ""),
            "created_at": datetime.now().isoformat(),
        }
        _PROCESSES.append(row)
        _pid += 1
        return ok(process=row)

class ProcessesListView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        return ok(processes=_PROCESSES)

class ProcessesMineView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        # stub: todos son "míos"
        return ok(processes=_PROCESSES)

class ProcessDetailView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request, pid):
        row = next((p for p in _PROCESSES if p["id"] == int(pid)), None)
        if not row:
            return Response({"detail": "No encontrado"}, status=404)
        return ok(process=row)

class ProcessStatusView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request, pid):
        body = request.data or {}
        status_ = body.get("status")
        note = body.get("note")
        for p in _PROCESSES:
            if p["id"] == int(pid):
                p["status"] = status_
                p["note"] = note
        return ok(success=True)

class ProcessNotifyView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request, pid):
        # channels, subject, message
        return ok(sent=True)

class ProcessFilesListView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request, pid):
        return ok(files=_PFILES.get(pid, []))

class ProcessFileUploadView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request, pid):
        global _pfid
        f = request.FILES.get("file")
        if not f:
            return Response({"detail": "Archivo requerido"}, status=400)
        row = {"id": _pfid, "name": f.name, "size": f.size}
        _PFILES.setdefault(pid, []).append(row)
        _pfid += 1
        return ok(file=row)

class ProcessFileDeleteView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    def delete(self, request, pid, file_id):
        files = _PFILES.get(pid, [])
        _PFILES[pid] = [x for x in files if x["id"] != int(file_id)]
        return ok(success=True)

# ───────────────────── Reportes académicos ─────────────────────
class AcademicReportsSummaryView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        return ok(summary={
            "students": 1200, "sections": 80, "teachers": 110,
            "occupancy": 0.76, "avg_gpa": 13.4
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
