from django.shortcuts import render

# Create your views here.
from django.db.models import Q
from django.http import FileResponse, HttpResponse
from rest_framework import viewsets, mixins, status
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser

from .models import *
from .serializers import *

# ====== Catálogos ======
class CareersViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = Career.objects.all().order_by('name')
    serializer_class = CareerSerializer

# ====== Planes (con nested actions) ======
class PlansViewSet(viewsets.ModelViewSet):
    queryset = Plan.objects.all().order_by('-year','name')
    serializer_class = PlanSerializer

    # GET /academic/plans/{id}/courses
    @action(detail=True, methods=['get'], url_path='courses')
    def list_courses(self, request, pk=None):
        qs = PlanCourse.objects.filter(plan_id=pk).select_related('course')
        return Response(PlanCourseSerializer(qs, many=True).data)

    # POST /academic/plans/{id}/courses
    @action(detail=True, methods=['post'], url_path='courses')
    def add_course(self, request, pk=None):
        data = request.data.copy()
        data['plan'] = pk
        ser = PlanCourseSerializer(data=data)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data, status=201)

    # PUT /academic/plans/{id}/courses/{courseId}
    @action(detail=True, methods=['put'], url_path=r'courses/(?P<course_id>\d+)')
    def update_course(self, request, pk=None, course_id=None):
        pc = PlanCourse.objects.get(plan_id=pk, id=course_id)
        ser = PlanCourseSerializer(pc, data=request.data, partial=True)
        ser.is_valid(raise_exception=True); ser.save()
        return Response(ser.data)

    # DELETE /academic/plans/{id}/courses/{courseId}
    @action(detail=True, methods=['delete'], url_path=r'courses/(?P<course_id>\d+)')
    def remove_course(self, request, pk=None, course_id=None):
        PlanCourse.objects.filter(plan_id=pk, id=course_id).delete()
        return Response(status=204)

    # GET /academic/plans/{id}/courses/{courseId}/prereqs
    @action(detail=True, methods=['get'], url_path=r'courses/(?P<course_id>\d+)/prereqs')
    def list_prereqs(self, request, pk=None, course_id=None):
        qs = CoursePrereq.objects.filter(plan_course_id=course_id)
        return Response([p.prerequisite_id for p in qs])

    # PUT /academic/plans/{id}/courses/{courseId}/prereqs
    @action(detail=True, methods=['put'], url_path=r'courses/(?P<course_id>\d+)/prereqs')
    def set_prereqs(self, request, pk=None, course_id=None):
        ids = request.data.get('prerequisites', [])
        CoursePrereq.objects.filter(plan_course_id=course_id).delete()
        bulk = [CoursePrereq(plan_course_id=course_id, prerequisite_id=i) for i in ids]
        CoursePrereq.objects.bulk_create(bulk, ignore_conflicts=True)
        return Response({"ok": True, "count": len(ids)})

# ====== Secciones ======
class SectionsViewSet(viewsets.ModelViewSet):
    queryset = Section.objects.all().order_by('id')
    serializer_class = SectionSerializer

    # GET /sections?something=...
    def list(self, request, *args, **kwargs):
        qs = self.queryset
        plan = request.query_params.get('plan')
        if plan: qs = qs.filter(plan_course__plan_id=plan)
        return Response(self.serializer_class(qs, many=True).data)

    # GET /sections/{id}/schedule
    @action(detail=True, methods=['get'], url_path='schedule')
    def list_schedule(self, request, pk=None):
        qs = SectionScheduleSlot.objects.filter(section_id=pk)
        return Response(ScheduleSlotSerializer(qs, many=True).data)

    # PUT /sections/{id}/schedule  {slots:[{weekday,start,end},...]}
    @action(detail=True, methods=['put'], url_path='schedule')
    def set_schedule(self, request, pk=None):
        slots = request.data.get('slots', [])
        SectionScheduleSlot.objects.filter(section_id=pk).delete()
        bulk = [SectionScheduleSlot(section_id=pk, **s) for s in slots]
        SectionScheduleSlot.objects.bulk_create(bulk)
        return Response({"ok": True, "count": len(slots)})

    # POST /sections/schedule/conflicts
    @action(detail=False, methods=['post'], url_path='schedule/conflicts')
    def check_conflicts(self, request):
        # TODO: implementar reglas reales; por ahora siempre "sin conflictos"
        return Response({"conflicts": []})

    # GET /sections/{id}/syllabus
    @action(detail=True, methods=['get'], url_path='syllabus')
    def get_syllabus(self, request, pk=None):
        try:
            return Response(SyllabusSerializer(Syllabus.objects.get(section_id=pk)).data)
        except Syllabus.DoesNotExist:
            return Response(None)

    # POST /sections/{id}/syllabus  (file)
    @action(detail=True, methods=['post'], url_path='syllabus', parser_classes=[MultiPartParser, FormParser])
    def upload_syllabus(self, request, pk=None):
        file = request.data.get('file')
        if not file: return Response({"detail":"file requerido"}, status=400)
        obj, _ = Syllabus.objects.update_or_create(section_id=pk, defaults={'file': file})
        return Response(SyllabusSerializer(obj).data, status=201)

    # DELETE /sections/{id}/syllabus
    @action(detail=True, methods=['delete'], url_path='syllabus')
    def delete_syllabus(self, request, pk=None):
        Syllabus.objects.filter(section_id=pk).delete()
        return Response(status=204)

    # GET /sections/{id}/evaluation
    @action(detail=True, methods=['get'], url_path='evaluation')
    def get_eval(self, request, pk=None):
        obj, _ = EvaluationConfig.objects.get_or_create(section_id=pk, defaults={'config': []})
        return Response(EvaluationConfigSerializer(obj).data)

    # PUT /sections/{id}/evaluation
    @action(detail=True, methods=['put'], url_path='evaluation')
    def set_eval(self, request, pk=None):
        config = request.data
        obj, _ = EvaluationConfig.objects.get_or_create(section_id=pk)
        obj.config = config; obj.save(update_fields=['config'])
        return Response(EvaluationConfigSerializer(obj).data)

    # ===== Asistencia =====
    # POST /sections/{id}/attendance/sessions
    @action(detail=True, methods=['post'], url_path='attendance/sessions')
    def create_session(self, request, pk=None):
        s = AttendanceSession.objects.create(section_id=pk)
        return Response(AttendanceSessionSerializer(s).data, status=201)

    # GET /sections/{id}/attendance/sessions
    @action(detail=True, methods=['get'], url_path='attendance/sessions')
    def list_sessions(self, request, pk=None):
        qs = AttendanceSession.objects.filter(section_id=pk).order_by('-id')
        return Response(AttendanceSessionSerializer(qs, many=True).data)

    # POST /sections/{id}/attendance/sessions/{sid}/close
    @action(detail=True, methods=['post'], url_path=r'attendance/sessions/(?P<sid>\d+)/close')
    def close_session(self, request, pk=None, sid=None):
        AttendanceSession.objects.filter(section_id=pk, id=sid).update(closed=True)
        return Response({"ok": True})

    # PUT /sections/{id}/attendance/sessions/{sid}   {rows:[{student_id,status},...]}
    @action(detail=True, methods=['put'], url_path=r'attendance/sessions/(?P<sid>\d+)')
    def set_attendance(self, request, pk=None, sid=None):
        rows = request.data.get('rows', [])
        AttendanceRow.objects.filter(session_id=sid).delete()
        bulk = [AttendanceRow(session_id=sid, **r) for r in rows]
        AttendanceRow.objects.bulk_create(bulk)
        return Response({"ok": True, "count": len(rows)})

# ===== Rooms & Teachers (para combos) =====
class ClassroomsViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = Classroom.objects.all().order_by('code')
    serializer_class = ClassroomSerializer

class TeachersViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = Teacher.objects.select_related('user').all().order_by('user__first_name')
    serializer_class = TeacherSerializer

# ===== Periodos =====
class PeriodsViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = AcademicPeriod.objects.all().order_by('-start')
    serializer_class = AcademicPeriodSerializer

# ===== Enrollment suggestions =====
@api_view(['POST'])
def enrollment_suggestions(request):
    # TODO: lógica real; devolver estructura que espera el front
    payload = request.data
    return Response({"suggestions": [], "input": payload})

# ===== Kardex =====
@api_view(['GET'])
def kardex_of_student(request, student_id: int):
    # TODO: devolver cursos/notas reales
    return Response({"student_id": student_id, "records": []})

@api_view(['POST'])
def kardex_boleta_pdf(request, student_id: int):
    # Devuelve PDF placeholder (content-type correcto)
    return HttpResponse(b"%PDF-1.4\n%...\n", content_type="application/pdf")

@api_view(['POST'])
def kardex_constancia_pdf(request, student_id: int):
    return HttpResponse(b"%PDF-1.4\n%...\n", content_type="application/pdf")

# ===== Procesos académicos =====
@api_view(['POST'])
def process_withdraw(request):       return Response({"ok": True, "kind":"withdraw", "payload": request.data})
@api_view(['POST'])
def process_reservation(request):    return Response({"ok": True, "kind":"reservation", "payload": request.data})
@api_view(['POST'])
def process_validation(request):     return Response({"ok": True, "kind":"validation", "payload": request.data})
@api_view(['POST'])
def process_transfer(request):       return Response({"ok": True, "kind":"transfer", "payload": request.data})
@api_view(['POST'])
def process_rejoin(request):         return Response({"ok": True, "kind":"rejoin", "payload": request.data})

# ===== Archivos de proceso =====
class ProcessFilesViewSet(viewsets.ViewSet):
    parser_classes = [MultiPartParser, FormParser]

    # GET /processes/{id}/files
    def list(self, request, process_pk=None):
        qs = ProcessFile.objects.filter(process_id=process_pk)
        return Response([{"id": f.id, "note": f.note, "file": f.file.url if f.file else None} for f in qs])

    # POST /processes/{id}/files
    def create(self, request, process_pk=None):
        file = request.data.get('file'); note = request.data.get('note', '')
        if not file: return Response({"detail":"file requerido"}, status=400)
        obj = ProcessFile.objects.create(process_id=process_pk, file=file, note=note)
        return Response({"id": obj.id, "note": obj.note, "file": obj.file.url}, status=201)

    # DELETE /processes/{id}/files/{fileId}
    def destroy(self, request, pk=None, process_pk=None):
        ProcessFile.objects.filter(process_id=process_pk, id=pk).delete()
        return Response(status=204)

# ===== Bandeja de procesos =====
class ProcessesInboxViewSet(viewsets.ViewSet):
    # GET /processes/my
    @action(detail=False, methods=['get'], url_path='my')
    def my_requests(self, request):
        # TODO: filtrar por request.user
        return Response({"items": [], "total": 0})

    # GET /processes
    def list(self, request):
        return Response({"items": [], "total": 0})

    # GET /processes/{id}
    def retrieve(self, request, pk=None):
        return Response({"id": pk, "status": "PENDIENTE"})

    # POST /processes/{id}/status
    @action(detail=True, methods=['post'], url_path='status')
    def set_status(self, request, pk=None):
        return Response({"id": pk, "status": request.data.get("status"), "note": request.data.get("note","")})

    # POST /processes/{id}/notify
    @action(detail=True, methods=['post'], url_path='notify')
    def notify(self, request, pk=None):
        return Response({"id": pk, "notified": True, "payload": request.data})

# ===== Reportes académicos =====
@api_view(['GET'])
def academic_reports_summary(request):
    return Response({"summary": {}})

@api_view(['GET'])
def academic_reports_performance(request):
    # content-type Excel (placeholder vacío)
    resp = HttpResponse(b'', content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    resp['Content-Disposition'] = 'attachment; filename="performance.xlsx"'
    return resp

@api_view(['GET'])
def academic_reports_occupancy(request):
    resp = HttpResponse(b'', content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    resp['Content-Disposition'] = 'attachment; filename="occupancy.xlsx"'
    return resp

