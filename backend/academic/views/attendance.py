"""
Vistas para Asistencia, Sílabos y Configuración de Evaluación
"""
import csv
import mimetypes
from datetime import datetime
from django.db import transaction
from django.http import FileResponse
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes as perm_classes
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.authentication import JWTAuthentication

from academic.models import (
    Section, AttendanceSession, AttendanceRow,
    SectionScheduleSlot, Syllabus, EvaluationConfig
)
from academic.serializers import AttendanceSessionSerializer
from .utils import ok, ALLOWED_ATT


# weekday en BD es 1=Lunes … 7=Domingo (ver DAY_TO_INT en views/utils.py)
DIAS_NOMBRE = {1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves",
               5: "Viernes", 6: "Sábado", 7: "Domingo"}


def _schedule_weekdays(section_id):
    """Días de dictado (1=Lunes … 7=Domingo) configurados a la sección."""
    return sorted(set(
        SectionScheduleSlot.objects
        .filter(section_id=section_id)
        .values_list("weekday", flat=True)
    ))


def _schedule_label(weekdays):
    return ", ".join(DIAS_NOMBRE.get(w, str(w)) for w in weekdays)


def _section_access_denied(request, section_id):
    """
    Un docente solo puede operar sobre SUS propias secciones; los
    administradores pueden operar sobre cualquiera.
    Retorna un Response 403 si el acceso está prohibido, o None si está OK.
    """
    from .utils import _can_admin_enroll
    if _can_admin_enroll(request.user):
        return None
    sec = Section.objects.select_related("teacher").filter(id=section_id).first()
    if sec and sec.teacher and sec.teacher.user_id == request.user.id:
        return None
    return Response(
        {"detail": "Solo puedes operar sobre tus propias secciones."},
        status=403,
    )


# ══════════════════════════════════════════════════════════════
# ASISTENCIA
# ══════════════════════════════════════════════════════════════

class AttendanceSessionsView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, section_id):
        if err := _section_access_denied(request, section_id):
            return err
        qs = AttendanceSession.objects.filter(section_id=section_id).prefetch_related("rows").order_by("-id")
        return ok(sessions=AttendanceSessionSerializer(qs, many=True).data)

    def post(self, request, section_id):
        if err := _section_access_denied(request, section_id):
            return err
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
        if err := _section_access_denied(request, section_id):
            return err
        sess = get_object_or_404(AttendanceSession, id=session_id, section_id=section_id)
        sess.closed = True
        sess.save()
        return ok(success=True)


class AttendanceSessionSetView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def put(self, request, section_id, session_id):
        if err := _section_access_denied(request, section_id):
            return err
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


class AttendanceMonthView(APIView):
    """
    Registro de Asistencia MENSUAL (grilla tipo SIAGIE).

    GET  /sections/<id>/attendance/mes?month=YYYY-MM
        → días del mes (con letra, fin de semana y si hay clase según el
          horario de la sección), alumnos (A-Z), marcas actuales
          {alumno: {día: P|T|F|J|0}} y días cerrados.
    POST /sections/<id>/attendance/mes
        body: {month: "YYYY-MM", marks: {alumno_id: {"3": "P", ...}}}
        → crea/actualiza las sesiones de cada día con marcas
          (los días con sesión cerrada no se tocan).
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    MARK_OF = {"PRESENT": "P", "LATE": "T", "ABSENT": "F",
               "EXCUSED": "J", "HOLIDAY": "0"}
    STATUS_OF = {"P": "PRESENT", "T": "LATE", "F": "ABSENT",
                 "J": "EXCUSED", "0": "HOLIDAY"}
    LETRAS = ["L", "M", "X", "J", "V", "S", "D"]

    def _month(self, raw):
        from datetime import date as date_cls
        try:
            y, m = str(raw or "").split("-")
            y, m = int(y), int(m)
            if not (1 <= m <= 12):
                return None
            return y, m
        except Exception:
            hoy = date_cls.today()
            return hoy.year, hoy.month

    def get(self, request, section_id):
        from calendar import monthrange
        from datetime import date as date_cls
        from .acta_excel import _roster

        if err := _section_access_denied(request, section_id):
            return err
        sec = get_object_or_404(Section, id=section_id)
        ym = self._month(request.query_params.get("month"))
        if not ym:
            return Response({"detail": "month inválido (YYYY-MM)"}, status=400)
        y, m = ym
        n_days = monthrange(y, m)[1]

        alumnos = _roster(sec)
        # roster id (user_id o pk) + pk → para leer filas guardadas con cualquiera
        key_of = {}
        for st in alumnos:
            key_of[st["id"]] = st["id"]
            if st.get("pk") is not None:
                key_of[st["pk"]] = st["id"]

        # ── Días de dictado según el horario configurado de la sección ──
        # Si la sección no tiene horario cargado se asume L-V (comportamiento
        # anterior) para no bloquear el registro.
        horario_wd = set(_schedule_weekdays(section_id))
        tiene_horario = bool(horario_wd)

        days = []
        for d in range(1, n_days + 1):
            wd = date_cls(y, m, d).weekday()          # 0=Lunes … 6=Domingo
            has_class = (wd + 1) in horario_wd if tiene_horario else wd < 5
            days.append({"day": d, "letra": self.LETRAS[wd],
                         "weekend": wd >= 5, "has_class": has_class})

        sessions = (AttendanceSession.objects
                    .filter(section_id=section_id, date__year=y, date__month=m)
                    .prefetch_related("rows"))
        marks = {}
        closed_days = []
        for sess in sessions:
            d = sess.date.day
            if sess.closed:
                closed_days.append(d)
            for row in sess.rows.all():
                rid = key_of.get(row.student_id)
                if rid is None:
                    continue
                mark = self.MARK_OF.get((row.status or "").upper())
                if mark:
                    marks.setdefault(str(rid), {})[str(d)] = mark

        return ok(
            month=f"{y:04d}-{m:02d}",
            days=days,
            students=[{"id": st["id"], "dni": st["dni"], "nombre": st["nombre"],
                       "estado": st.get("estado", "")} for st in alumnos],
            marks=marks,
            closed_days=sorted(closed_days),
            has_schedule=tiene_horario,
            schedule_weekdays=sorted(horario_wd),
            schedule_label=_schedule_label(sorted(horario_wd)),
        )

    def post(self, request, section_id):
        from calendar import monthrange
        from datetime import date as date_cls

        if err := _section_access_denied(request, section_id):
            return err
        get_object_or_404(Section, id=section_id)
        body = request.data or {}
        ym = self._month(body.get("month"))
        if not ym:
            return Response({"detail": "month inválido (YYYY-MM)"}, status=400)
        y, m = ym
        n_days = monthrange(y, m)[1]
        marks = body.get("marks") or {}
        if not isinstance(marks, dict):
            return Response({"detail": "marks debe ser objeto"}, status=400)

        # días afectados = los que aparecen en alguna marca + los enviados
        # explícitamente en body.days (para borrar días que quedaron vacíos)
        dias = set()
        for por_dia in marks.values():
            if isinstance(por_dia, dict):
                for k in por_dia.keys():
                    try:
                        d = int(k)
                        if 1 <= d <= n_days:
                            dias.add(d)
                    except (TypeError, ValueError):
                        continue
        for k in (body.get("days") or []):
            try:
                d = int(k)
                if 1 <= d <= n_days:
                    dias.add(d)
            except (TypeError, ValueError):
                continue

        guardados, cerrados = 0, []
        with transaction.atomic():
            for d in sorted(dias):
                fecha = date_cls(y, m, d)
                sess, _ = AttendanceSession.objects.get_or_create(
                    section_id=section_id, date=fecha)
                if sess.closed:
                    cerrados.append(d)
                    continue
                AttendanceRow.objects.filter(session=sess).delete()
                nuevos = []
                for sid, por_dia in marks.items():
                    if not isinstance(por_dia, dict):
                        continue
                    mark = str(por_dia.get(str(d)) or "").strip().upper()
                    status = self.STATUS_OF.get(mark)
                    if not status:
                        continue
                    try:
                        nuevos.append(AttendanceRow(
                            session=sess, student_id=int(sid), status=status))
                    except (TypeError, ValueError):
                        continue
                AttendanceRow.objects.bulk_create(nuevos)
                if not nuevos:
                    sess.delete()   # día quedó vacío → quitar la sesión
                else:
                    guardados += 1

        msg = f"Asistencia grabada: {guardados} día(s)"
        if cerrados:
            msg += f" · {len(cerrados)} día(s) cerrados no se modificaron: {', '.join(map(str, cerrados))}"
        return ok(success=True, message=msg, saved_days=guardados, closed_days=cerrados)


# ══════════════════════════════════════════════════════════════
# IMPORTACIÓN MASIVA DE ASISTENCIA
# ══════════════════════════════════════════════════════════════

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


# ══════════════════════════════════════════════════════════════
# SÍLABOS
# ══════════════════════════════════════════════════════════════

class SyllabusView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def _syllabus_data(self, s, request):
        return {
            "filename": s.file.name.split("/")[-1],
            "url": f"/api/academic/sections/{s.section_id}/syllabus/download",
            "size": getattr(s.file, "size", 0),
        }

    def get(self, request, section_id):
        s = Syllabus.objects.filter(section_id=section_id).first()
        if not s:
            return ok(syllabus=None)
        return ok(syllabus=self._syllabus_data(s, request))

    def post(self, request, section_id):
        f = request.FILES.get("file")
        if not f:
            return Response({"detail": "Archivo requerido"}, status=status.HTTP_400_BAD_REQUEST)

        obj, _ = Syllabus.objects.get_or_create(section_id=section_id)
        obj.file = f
        obj.save()
        return ok(syllabus=self._syllabus_data(obj, request))

    def delete(self, request, section_id):
        Syllabus.objects.filter(section_id=section_id).delete()
        return ok(success=True)


@api_view(["GET"])
@perm_classes([AllowAny])
def syllabus_download(request, section_id):
    """Descarga directa del sílabo — AllowAny porque se abre en nueva pestaña."""
    s = get_object_or_404(Syllabus, section_id=section_id)
    filename = s.file.name.split("/")[-1]
    content_type, _ = mimetypes.guess_type(filename)
    resp = FileResponse(s.file.open("rb"), content_type=content_type or "application/pdf")
    resp["Content-Disposition"] = f'inline; filename="{filename}"'
    return resp


# ══════════════════════════════════════════════════════════════
# SÍLABOS DEL ALUMNO (mis cursos matriculados)
# ══════════════════════════════════════════════════════════════

class StudentSyllabusesView(APIView):
    """GET: lista de sílabos de las secciones del alumno matriculado."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from students.models import Student
        from academic.models import Enrollment, EnrollmentItem

        student = Student.objects.filter(user=request.user).first()
        if not student:
            return ok(syllabuses=[])

        # Obtener secciones matriculadas del alumno
        items = (
            EnrollmentItem.objects
            .select_related("section__plan_course__course", "section__teacher__user")
            .filter(
                enrollment__student=student,
                enrollment__status="CONFIRMED",
                section__isnull=False,
            )
            .order_by("-enrollment__period", "section__plan_course__course__name")
        )

        result = []
        for item in items:
            sec = item.section
            if not sec:
                continue
            course_name = ""
            if sec.plan_course and sec.plan_course.course:
                course_name = sec.plan_course.course.name or ""

            teacher_name = ""
            if sec.teacher and sec.teacher.user:
                u = sec.teacher.user
                teacher_name = f"{getattr(u, 'first_name', '')} {getattr(u, 'last_name', '')}".strip()

            syl = Syllabus.objects.filter(section=sec).first()
            syl_data = None
            if syl and syl.file:
                syl_data = {
                    "filename": syl.file.name.split("/")[-1],
                    "url": f"/api/academic/sections/{sec.id}/syllabus/download",
                    "size": getattr(syl.file, "size", 0),
                }

            result.append({
                "section_id": sec.id,
                "course_name": course_name.upper(),
                "section_code": getattr(sec, "label", "") or getattr(sec, "code", ""),
                "period": item.enrollment.period or "",
                "teacher_name": teacher_name,
                "syllabus": syl_data,
            })

        return ok(syllabuses=result)


# ══════════════════════════════════════════════════════════════
# CONFIGURACIÓN DE EVALUACIÓN
# ══════════════════════════════════════════════════════════════

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
        return ok(success=True)


# ══════════════════════════════════════════════════════════════
# ADMIN: MONITOREO DE ASISTENCIAS POR SECCIÓN / PERIODO
# ══════════════════════════════════════════════════════════════

# Umbral oficial de inasistencias para desaprobar (RVM 277-2019-MINEDU):
# 30% de las sesiones lectivas. Configurable por sección a futuro.
DPI_THRESHOLD = 0.30


class AdminAttendanceOverviewView(APIView):
    """
    GET /api/academic/admin/attendance/overview?period=2026-I&career_id=5
    Vista global para el admin: por cada Section del periodo, cuántas
    sesiones de asistencia se han registrado y cuántos alumnos están
    en riesgo de desaprobar por inasistencia (>30% de faltas).
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from django.db.models import Count, Q as DQ
        from academic.models import Section, EnrollmentItem, Enrollment

        period = (request.query_params.get("period") or "").strip()
        career_id = request.query_params.get("career_id")

        sec_qs = Section.objects.select_related(
            "plan_course", "plan_course__course", "plan_course__plan",
            "plan_course__plan__career", "teacher", "teacher__user",
        )
        if period:
            sec_qs = sec_qs.filter(period=period)
        if career_id:
            try:
                sec_qs = sec_qs.filter(plan_course__plan__career_id=int(career_id))
            except (TypeError, ValueError):
                pass

        out = []
        for sec in sec_qs:
            sessions = AttendanceSession.objects.filter(section=sec).order_by("date")
            n_sessions = sessions.count()
            n_closed = sessions.filter(closed=True).count()

            # Alumnos en la sección (vía Enrollment+EnrollmentItem confirmados)
            students_in_section = set(
                EnrollmentItem.objects
                .filter(plan_course=sec.plan_course,
                        enrollment__period=sec.period,
                        enrollment__status=Enrollment.STATUS_CONFIRMED)
                .values_list("enrollment__student_id", flat=True)
            )
            n_students = len(students_in_section)

            # % de inasistencia por alumno
            absences_by_student = {}
            presents_by_student = {}
            if n_sessions and students_in_section:
                rows = AttendanceRow.objects.filter(
                    session__in=sessions,
                    student_id__in=students_in_section,
                ).values("student_id", "status")
                for r in rows:
                    sid = r["student_id"]
                    s = (r["status"] or "").upper()
                    if s == "ABSENT":
                        absences_by_student[sid] = absences_by_student.get(sid, 0) + 1
                    elif s == "PRESENT" or s == "LATE":
                        presents_by_student[sid] = presents_by_student.get(sid, 0) + 1

            at_risk = []  # alumnos con > DPI_THRESHOLD de faltas
            for sid in students_in_section:
                a = absences_by_student.get(sid, 0)
                if n_sessions:
                    pct = a / n_sessions
                    if pct > DPI_THRESHOLD:
                        at_risk.append({"student_id": sid, "absences": a,
                                        "sessions": n_sessions, "pct": round(pct*100, 1)})

            teacher_name = ""
            if sec.teacher and sec.teacher.user:
                teacher_name = (getattr(sec.teacher.user, "full_name", "")
                                or sec.teacher.user.username or "")

            out.append({
                "section_id": sec.id,
                "period": sec.period,
                "label": sec.label,
                "course_code": sec.plan_course.effective_code if sec.plan_course else "",
                "course_name": sec.plan_course.effective_name if sec.plan_course else "",
                "career_name": (sec.plan_course.plan.career.name
                                if sec.plan_course and sec.plan_course.plan
                                and sec.plan_course.plan.career else ""),
                "semester": sec.plan_course.semester if sec.plan_course else None,
                "teacher_name": teacher_name,
                "n_students": n_students,
                "n_sessions": n_sessions,
                "n_sessions_closed": n_closed,
                "n_at_risk": len(at_risk),
                "has_no_attendance": n_sessions == 0,
            })

        # Ordenar: primero las que no tienen asistencia + las que más alumnos en riesgo
        out.sort(key=lambda s: (not s["has_no_attendance"], -s["n_at_risk"],
                                s["career_name"], s["semester"] or 0,
                                s["course_name"]))
        return Response({
            "period": period,
            "threshold_pct": int(DPI_THRESHOLD * 100),
            "sections": out,
        })


class AdminAttendanceSectionDetailView(APIView):
    """
    GET /api/academic/admin/attendance/section/<section_id>
    Detalle por sección: lista de alumnos con su conteo de
    asistencias / faltas / % y flag at_risk si supera el 30%.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, section_id):
        from academic.models import Section, EnrollmentItem, Enrollment
        from students.models import Student

        sec = get_object_or_404(Section, id=section_id)
        sessions = AttendanceSession.objects.filter(section=sec).order_by("date")
        n_sessions = sessions.count()

        # Alumnos de la sección
        st_ids = list(
            EnrollmentItem.objects
            .filter(plan_course=sec.plan_course,
                    enrollment__period=sec.period,
                    enrollment__status=Enrollment.STATUS_CONFIRMED)
            .values_list("enrollment__student_id", flat=True)
            .distinct()
        )
        students = Student.objects.filter(id__in=st_ids).order_by(
            "apellido_paterno", "apellido_materno", "nombres"
        )

        # Contar por alumno
        rows = AttendanceRow.objects.filter(
            session__in=sessions, student_id__in=st_ids,
        ).values("student_id", "status")
        counts = {}
        for r in rows:
            sid = r["student_id"]
            s = (r["status"] or "").upper()
            d = counts.setdefault(sid, {"PRESENT":0, "ABSENT":0, "LATE":0, "EXCUSED":0})
            if s in d:
                d[s] += 1

        out = []
        for st in students:
            c = counts.get(st.id, {"PRESENT":0,"ABSENT":0,"LATE":0,"EXCUSED":0})
            abs_n = c["ABSENT"]
            pct = (abs_n / n_sessions) if n_sessions else 0
            out.append({
                "student_id": st.id,
                "dni": st.num_documento,
                "full_name": f"{st.apellido_paterno or ''} {st.apellido_materno or ''} {st.nombres or ''}".strip(),
                "present": c["PRESENT"],
                "absent":  c["ABSENT"],
                "late":    c["LATE"],
                "excused": c["EXCUSED"],
                "sessions": n_sessions,
                "absent_pct": round(pct * 100, 1),
                "at_risk": pct > DPI_THRESHOLD,
                "would_fail_by_attendance": pct > DPI_THRESHOLD,
            })

        horario_wd = _schedule_weekdays(sec.id)
        return Response({
            "section_id": sec.id,
            "period": sec.period,
            "course": sec.plan_course.effective_name if sec.plan_course else "",
            "has_schedule": bool(horario_wd),
            "schedule_weekdays": horario_wd,
            "schedule_label": _schedule_label(horario_wd),
            "threshold_pct": int(DPI_THRESHOLD * 100),
            "n_sessions": n_sessions,
            "n_students": len(out),
            "n_at_risk": sum(1 for s in out if s["at_risk"]),
            "students": out,
        })


class AdminAttendanceApplyDpiView(APIView):
    """
    POST /api/academic/admin/attendance/section/<section_id>/apply-dpi
    Marca como DPI (Desaprobado Por Inasistencia) en el acta de notas
    a los alumnos con > umbral de faltas. Setea `final_grade` a 0 y
    `status` = "DPI" dentro de SectionGrades.grades[student_id].
    NO cierra el acta; deja al admin/registrar revisar antes.

    Body opcional:
      { "threshold_pct": 30, "dry_run": false }
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, section_id):
        from academic.models import Section, SectionGrades, EnrollmentItem, Enrollment

        sec = get_object_or_404(Section, id=section_id)
        body = request.data or {}
        try:
            thr = float(body.get("threshold_pct") or (DPI_THRESHOLD * 100)) / 100.0
        except (TypeError, ValueError):
            thr = DPI_THRESHOLD
        dry_run = bool(body.get("dry_run"))

        sessions = AttendanceSession.objects.filter(section=sec)
        n_sessions = sessions.count()
        if n_sessions == 0:
            return Response(
                {"detail": "Esta sección no tiene sesiones de asistencia registradas."},
                status=400,
            )

        # Alumnos confirmados de la sección
        st_ids = list(
            EnrollmentItem.objects
            .filter(plan_course=sec.plan_course,
                    enrollment__period=sec.period,
                    enrollment__status=Enrollment.STATUS_CONFIRMED)
            .values_list("enrollment__student_id", flat=True)
            .distinct()
        )

        # Contar faltas por alumno
        absences = {}
        for r in AttendanceRow.objects.filter(
                session__in=sessions, student_id__in=st_ids,
        ).values("student_id", "status"):
            if (r["status"] or "").upper() == "ABSENT":
                sid = r["student_id"]
                absences[sid] = absences.get(sid, 0) + 1

        at_risk = []
        for sid in st_ids:
            a = absences.get(sid, 0)
            pct = a / n_sessions
            if pct > thr:
                at_risk.append({"student_id": sid, "absences": a, "pct": round(pct*100, 1)})

        bundle, _ = SectionGrades.objects.get_or_create(section=sec)
        applied = []
        if not dry_run and at_risk:
            grades = dict(bundle.grades or {})
            for r in at_risk:
                sid = str(r["student_id"])
                existing = grades.get(sid) if isinstance(grades.get(sid), dict) else {}
                grades[sid] = {
                    **(existing or {}),
                    "final_grade": 0,
                    "status": "DPI",
                    "dpi_pct": r["pct"],
                    "dpi_absences": r["absences"],
                    "dpi_sessions": n_sessions,
                    "dpi_applied_by": getattr(request.user, "username", "admin"),
                }
                applied.append(r["student_id"])
            bundle.grades = grades
            bundle.save()

        return Response({
            "section_id": sec.id,
            "n_sessions": n_sessions,
            "threshold_pct": int(thr * 100),
            "dpi_count": len(at_risk),
            "applied": applied if not dry_run else [],
            "dry_run": dry_run,
            "at_risk": at_risk,
        })