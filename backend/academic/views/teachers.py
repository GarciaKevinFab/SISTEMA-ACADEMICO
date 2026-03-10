"""
Vistas para Docentes, Calificaciones y Actas
─────────────────────────────────────────────
ACTUALIZADO: usa resolvers.py centralizado para resolve_teacher
"""
import base64
from datetime import datetime
from django.db import transaction
from django.http import FileResponse, HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import viewsets, permissions
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication

from academic.models import (
    Teacher, Section, SectionGrades, AcademicGradeRecord, PlanCourse
)
from students.models import Student
from catalogs.models import Teacher as CatalogTeacher
from academic.serializers import smart_title

# ✅ CAMBIO: importar desde resolvers en vez de sections
from .resolvers import resolve_teacher

from .utils import (
    ok, _get_full_name, _to_int, _to_float, _to_str,
    list_teacher_users_qs, list_student_users_qs,
    user_has_any_role, ACTA_LEVELS, LEVEL_TO_NUM, ACTA_REQUIRED_FIELDS
)


# ══════════════════════════════════════════════════════════════
# FUNCIONES DE VALIDACIÓN Y NORMALIZACIÓN DE ACTAS
# ══════════════════════════════════════════════════════════════

def _calc_promedio_final(final_grade):
    if final_grade is None:
        return None
    try:
        return int(round(float(final_grade)))
    except Exception:
        return None


def _calc_escala_0_5(c1, c2, c3):
    vals = [c1, c2, c3]
    if not all(isinstance(x, int) and 1 <= x <= 5 for x in vals):
        return None
    return round((c1 + c2 + c3) / 3.0, 1)


def _calc_promedio_final_0_20(escala_0_5):
    if escala_0_5 is None:
        return None
    return int(round(((float(escala_0_5) - 1.0) / 4.0) * 20.0))


def _calc_estado(prom_final):
    if prom_final is None:
        return ""
    return "Logrado" if int(prom_final) >= 11 else "En proceso"


def _validate_acta_student_payload(payload: dict) -> tuple[bool, list[str]]:
    errors = []
    if not isinstance(payload, dict):
        return False, ["El payload del estudiante no es un objeto"]

    for field in ACTA_REQUIRED_FIELDS:
        val = payload.get(field)
        if val is None or _to_str(val) == "":
            errors.append(f"{field} es obligatorio")

    for level_field in ("C1_LEVEL", "C2_LEVEL", "C3_LEVEL"):
        lv = _to_str(payload.get(level_field))
        if lv and lv not in ACTA_LEVELS:
            errors.append(f"{level_field} inválido: '{lv}' (debe ser PI, I, P, L o D)")

    final_val = _to_float(payload.get("FINAL"))
    if final_val is None:
        errors.append("FINAL debe ser un número válido")
    else:
        if final_val < 0 or final_val > 20:
            errors.append(f"FINAL fuera de rango (0–20): {final_val}")

    return (len(errors) == 0), errors


def _normalize_acta_student_payload(payload: dict):
    if not isinstance(payload, dict):
        return None, ["Payload no es objeto"]

    errors = []
    out = dict(payload)

    for lf in ("C1_LEVEL", "C2_LEVEL", "C3_LEVEL"):
        lv = _to_str(payload.get(lf)).upper()
        if not lv:
            errors.append(f"{lf} es obligatorio")
        elif lv not in ACTA_LEVELS:
            errors.append(f"{lf} inválido: {lv}")
        out[lf] = lv

    out["C1_REC"] = _to_str(payload.get("C1_REC"))
    out["C2_REC"] = _to_str(payload.get("C2_REC"))
    out["C3_REC"] = _to_str(payload.get("C3_REC"))

    for i in (1, 2, 3):
        c_key = f"C{i}"
        lv_key = f"C{i}_LEVEL"

        c_val = _to_int(payload.get(c_key))
        if c_val is None:
            lv = out.get(lv_key)
            c_val = LEVEL_TO_NUM.get(lv)

        if c_val is None:
            errors.append(f"{c_key} es obligatorio (1-5) o derivable de {lv_key}")
        elif not (1 <= int(c_val) <= 5):
            errors.append(f"{c_key} fuera de rango (1-5): {c_val}")

        out[c_key] = int(c_val) if c_val is not None else ""

    if errors:
        return None, errors

    escala = _calc_escala_0_5(out["C1"], out["C2"], out["C3"])
    prom_final = _calc_promedio_final_0_20(escala)
    estado = _calc_estado(prom_final)

    out["ESCALA_0_5"] = escala
    out["PROMEDIO_FINAL"] = prom_final
    out["ESTADO"] = estado

    return out, []


def _normalize_acta_grades_payload(grades: dict):
    normalized = {}
    errors_by_student = {}

    if not isinstance(grades, dict):
        return {}, {"_global": ["grades debe ser objeto {studentId: {...}}"]}

    for student_id, payload in grades.items():
        sid = str(student_id)
        out, errs = _normalize_acta_student_payload(payload)
        if errs:
            errors_by_student[sid] = errs
        else:
            normalized[sid] = out

    return normalized, errors_by_student


# ══════════════════════════════════════════════════════════════
# VISTAS DE DOCENTES
# ══════════════════════════════════════════════════════════════

class TeachersViewSet(viewsets.ViewSet):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request, *args, **kwargs):
        """
        Retorna docentes combinando:
          1) Users con rol TEACHER/DOCENTE/PROFESOR (fuente principal)
          2) catalogs.Teacher con user asignado (cubre legacy sin rol)
          3) academic.Teacher con user asignado (último fallback)
        Sin duplicados (por user.id).
        """
        seen_ids = set()
        teachers = []

        # ── 1) Users con rol docente (fuente principal) ──
        for u in list_teacher_users_qs():
            if u.id in seen_ids:
                continue
            seen_ids.add(u.id)
            teachers.append({
                "id": u.id,
                "full_name": _get_full_name(u),
                "email": getattr(u, "email", "") or "",
                "username": getattr(u, "username", "") or "",
            })

        # ── 2) catalogs.Teacher con user (cubre docentes sin rol asignado) ──
        for ct in CatalogTeacher.objects.select_related("user").filter(user__isnull=False):
            uid = ct.user_id
            if uid in seen_ids:
                continue
            seen_ids.add(uid)
            teachers.append({
                "id": uid,
                "full_name": _get_full_name(ct.user) if ct.user else ct.full_name or f"Docente #{ct.id}",
                "email": getattr(ct.user, "email", "") if ct.user else ct.email or "",
                "username": getattr(ct.user, "username", "") if ct.user else "",
            })

        # ── 3) academic.Teacher con user (último fallback) ──
        for at in Teacher.objects.select_related("user").filter(user__isnull=False):
            uid = at.user_id
            if uid in seen_ids:
                continue
            seen_ids.add(uid)
            teachers.append({
                "id": uid,
                "full_name": _get_full_name(at.user) if at.user else f"Teacher #{at.id}",
                "email": getattr(at.user, "email", "") if at.user else "",
                "username": getattr(at.user, "username", "") if at.user else "",
            })

        teachers.sort(key=lambda t: t["full_name"].lower())
        return ok(teachers=teachers)


class TeacherSectionsView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, teacher_user_id: int):
        # ✅ CAMBIO: usa resolver centralizado
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
            pc = s.plan_course
            crs = pc.course
            sections.append({
                "id": s.id,
                "course_name": smart_title(pc.display_name or crs.name),
                "course_code": pc.display_code or crs.code,
                "section_code": s.label,
                "label": s.label,
                "period": s.period,
                "plan_course_id": s.plan_course_id,
                "room_name": s.classroom.code if s.classroom else "",
            })

        return ok(sections=sections)


class TeacherSectionsMeView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # Buscar academic.Teacher directamente por user (más fiable que resolver)
        teacher = Teacher.objects.filter(user=request.user).first()
        if not teacher:
            # Intentar crear desde catálogo
            cat = CatalogTeacher.objects.filter(user=request.user).first()
            if cat:
                teacher, _ = Teacher.objects.get_or_create(user=request.user)
            else:
                return ok(sections=[])

        # Mostrar TODAS las secciones asignadas al profesor
        qs = (
            Section.objects
            .select_related("plan_course__course", "teacher__user", "classroom")
            .prefetch_related("schedule_slots")
            .filter(teacher=teacher)
            .order_by("-id")
        )

        sections = []
        for s in qs:
            pc = s.plan_course
            crs = pc.course
            sections.append({
                "id": s.id,
                "course_name": smart_title(pc.display_name or crs.name),
                "course_code": pc.display_code or crs.code,
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

    def get(self, request, section_id: int):
        """
        Solo devuelve estudiantes MATRICULADOS (Enrollment CONFIRMED) en la sección.
        Si no hay matrículas, retorna lista vacía.
        """
        from academic.models import Enrollment, EnrollmentItem

        sec = get_object_or_404(Section, id=section_id)

        # Intentar obtener estudiantes matriculados en esta sección
        enrolled_items = (
            EnrollmentItem.objects
            .select_related("enrollment__student")
            .filter(
                section_id=section_id,
                enrollment__status="CONFIRMED",
                enrollment__period=sec.period,
            )
        )

        if enrolled_items.exists():
            students = []
            seen_ids = set()
            for item in enrolled_items:
                st = item.enrollment.student
                if st.id in seen_ids:
                    continue
                seen_ids.add(st.id)

                full = f"{getattr(st, 'nombres', '')} {getattr(st, 'apellido_paterno', '')} {getattr(st, 'apellido_materno', '')}".strip()
                parts = full.split()
                first = parts[0] if parts else ""
                last = " ".join(parts[1:]) if len(parts) > 1 else ""

                students.append({
                    "id": st.user_id if getattr(st, "user_id", None) else st.id,
                    "student_id": st.id,
                    "first_name": first,
                    "last_name": last,
                    "num_documento": getattr(st, "num_documento", ""),
                })

            students.sort(key=lambda x: (x.get("last_name", ""), x.get("first_name", "")))
            return ok(students=students)

        # Fallback: también buscar por plan_course (sin sección específica)
        enrolled_by_pc = (
            EnrollmentItem.objects
            .select_related("enrollment__student")
            .filter(
                plan_course_id=sec.plan_course_id,
                enrollment__status="CONFIRMED",
                enrollment__period=sec.period,
            )
        )

        if enrolled_by_pc.exists():
            students = []
            seen_ids = set()
            for item in enrolled_by_pc:
                st = item.enrollment.student
                if st.id in seen_ids:
                    continue
                seen_ids.add(st.id)

                full = f"{getattr(st, 'nombres', '')} {getattr(st, 'apellido_paterno', '')} {getattr(st, 'apellido_materno', '')}".strip()
                parts = full.split()
                first = parts[0] if parts else ""
                last = " ".join(parts[1:]) if len(parts) > 1 else ""

                students.append({
                    "id": st.user_id if getattr(st, "user_id", None) else st.id,
                    "student_id": st.id,
                    "first_name": first,
                    "last_name": last,
                    "num_documento": getattr(st, "num_documento", ""),
                })

            students.sort(key=lambda x: (x.get("last_name", ""), x.get("first_name", "")))
            return ok(students=students)

        # Sin matrículas registradas → lista vacía
        return ok(students=[])


# ══════════════════════════════════════════════════════════════
# VISTAS DE CALIFICACIONES Y ACTAS
# ══════════════════════════════════════════════════════════════

class SectionGradesView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, section_id: int):
        sec = get_object_or_404(Section, id=section_id)
        bundle, _ = SectionGrades.objects.get_or_create(section=sec)
        return ok(
            grades=(bundle.grades or {}),
            submitted=bool(bundle.submitted)
        )


class GradesSaveView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        body = request.data or {}
        section_id = body.get("section_id")
        grades = body.get("grades") or {}

        if not section_id:
            return Response({"detail": "section_id es requerido"}, status=400)

        sec = get_object_or_404(Section, id=int(section_id))
        bundle, _ = SectionGrades.objects.get_or_create(section=sec)

        if bundle.submitted:
            return Response({"detail": "El acta ya está cerrada. No se puede modificar."}, status=409)

        normalized, errors_by_student = _normalize_acta_grades_payload(grades)

        if errors_by_student:
            return Response(
                {"detail": "Errores de validación en el acta", "errors": errors_by_student},
                status=400
            )

        bundle.grades = normalized
        bundle.save()
        return ok(success=True, message="Acta guardada correctamente (borrador)")


class GradesSubmitView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        body = request.data or {}
        section_id = body.get("section_id")
        grades = body.get("grades") or {}

        if not section_id:
            return Response({"detail": "section_id es requerido"}, status=400)

        sec = get_object_or_404(Section, id=int(section_id))
        bundle, _ = SectionGrades.objects.get_or_create(section=sec)

        normalized, errors_by_student = _normalize_acta_grades_payload(grades)

        if errors_by_student:
            return Response(
                {"detail": "No se puede cerrar el acta: hay errores", "errors": errors_by_student},
                status=400
            )

        bundle.grades = normalized
        bundle.submitted = True
        bundle.submitted_at = timezone.now()
        bundle.save()

        return ok(success=True, submitted=True, message="Acta enviada y cerrada correctamente")


class GradesReopenView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not user_has_any_role(request.user, ["REGISTRAR", "ADMIN_ACADEMIC"]):
            return Response({"detail": "No autorizado para reabrir actas"}, status=403)

        body = request.data or {}
        section_id = body.get("section_id")

        if not section_id:
            return Response({"detail": "section_id requerido"}, status=400)

        sec = get_object_or_404(Section, id=int(section_id))
        bundle, _ = SectionGrades.objects.get_or_create(section=sec)

        bundle.submitted = False
        bundle.submitted_at = None
        bundle.save()

        return ok(success=True, submitted=False, message="Acta reabierta")


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
        from io import BytesIO
        from django.http import FileResponse
        buf = BytesIO(b"%PDF-1.4\n% Dummy PDF\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n")
        return FileResponse(buf, as_attachment=True, filename=f"acta-section-{section_id}.pdf")


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
        png_1x1 = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6X1fQAAAABJRU5ErkJggg=="
        )
        return HttpResponse(png_1x1, content_type="image/png")


# ══════════════════════════════════════════════════════════════
# NOTAS HISTÓRICAS (CRUD para admin)
# ══════════════════════════════════════════════════════════════

try:
    from catalogs.helpers import match_plan_course_for_grade
except ImportError:
    def match_plan_course_for_grade(student, course, plan_id=None):
        pid = plan_id or getattr(student, "plan_id", None)
        if not pid:
            return None
        return PlanCourse.objects.filter(plan_id=pid, course=course).first()

try:
    from catalogs.models import Course
except ImportError:
    Course = None


def _require_admin(request):
    """Verifica que el usuario sea staff/admin."""
    u = getattr(request, "user", None)
    if not (u and u.is_authenticated):
        return {"detail": "No autorizado."}, 403
    if getattr(u, "is_staff", False) or getattr(u, "is_superuser", False):
        return None, None
    if user_has_any_role(u, ("ADMIN_ACADEMIC", "ADMIN_ACADEMICO", "ADMIN_SYSTEM", "REGISTRAR")):
        return None, None
    return {"detail": "No autorizado."}, 403


def _build_components(raw_components: dict) -> dict:
    """
    Normaliza y auto-calcula componentes de notas.
    Acepta C1_LEVEL/C2_LEVEL/C3_LEVEL y/o C1/C2/C3.
    Auto-calcula ESCALA_0_5, PROMEDIO_FINAL, ESTADO.
    """
    if not raw_components or not isinstance(raw_components, dict):
        return {}

    out = dict(raw_components)

    # Auto-derivar C1/C2/C3 desde niveles si no están presentes
    for i in (1, 2, 3):
        c_key = f"C{i}"
        lv_key = f"C{i}_LEVEL"

        lv = _to_str(out.get(lv_key, "")).upper()
        if lv and lv in ACTA_LEVELS:
            out[lv_key] = lv
            if out.get(c_key) is None or out.get(c_key) == "":
                out[c_key] = LEVEL_TO_NUM.get(lv)
        else:
            c_val = _to_int(out.get(c_key))
            if c_val is not None and 1 <= c_val <= 5:
                out[c_key] = c_val
                # Auto-derivar nivel desde valor numérico
                num_to_level = {v: k for k, v in LEVEL_TO_NUM.items()}
                if c_val in num_to_level and not lv:
                    out[lv_key] = num_to_level[c_val]

    # Auto-calcular escala y promedio
    c1 = _to_int(out.get("C1"))
    c2 = _to_int(out.get("C2"))
    c3 = _to_int(out.get("C3"))

    if c1 is not None and c2 is not None and c3 is not None:
        if all(1 <= x <= 5 for x in (c1, c2, c3)):
            escala = _calc_escala_0_5(c1, c2, c3)
            prom = _calc_promedio_final_0_20(escala)
            estado = _calc_estado(prom)
            out["ESCALA_0_5"] = escala
            out["PROMEDIO_FINAL"] = prom
            out["ESTADO"] = estado

    return out


class HistoricalGradesView(APIView):
    """
    CRUD de notas históricas para admin.
    GET    /api/academic/grades/historical?student_id=123
    POST   /api/academic/grades/historical
    DELETE /api/academic/grades/historical/<record_id>
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, record_id=None):
        err, code = _require_admin(request)
        if err:
            return ok(error=err["detail"]) if code == 403 else ok()

        student_id = request.query_params.get("student_id")
        if not student_id:
            return ok(error="student_id es requerido", records=[])

        records = (
            AcademicGradeRecord.objects
            .select_related("course", "plan_course", "plan_course__course")
            .filter(student_id=int(student_id))
            .order_by("-term", "course__name")
        )

        result = []
        for rec in records:
            pc_name = ""
            if rec.plan_course:
                pc_name = getattr(rec.plan_course, "display_name", "") or ""
                if not pc_name and rec.plan_course.course:
                    pc_name = rec.plan_course.course.name

            result.append({
                "id": rec.id,
                "course_id": rec.course_id,
                "course_name": pc_name or (rec.course.name if rec.course else ""),
                "course_code": rec.course.code if rec.course else "",
                "term": rec.term,
                "final_grade": float(rec.final_grade) if rec.final_grade is not None else None,
                "components": rec.components or {},
                "plan_course_id": rec.plan_course_id,
                "created_at": rec.created_at.isoformat() if rec.created_at else None,
            })

        return ok(records=result)

    def post(self, request, record_id=None):
        err, code = _require_admin(request)
        if err:
            return ok(error=err["detail"])

        student_id = request.data.get("student_id")
        records_data = request.data.get("records", [])

        if not student_id:
            return ok(error="student_id es requerido")

        try:
            student = Student.objects.get(pk=int(student_id))
        except Student.DoesNotExist:
            return ok(error=f"Estudiante {student_id} no existe")

        if not records_data:
            return ok(error="records es requerido (lista de notas)")

        created_count = 0
        updated_count = 0
        errors = []

        for idx, rec_data in enumerate(records_data):
            course_id = rec_data.get("course_id")
            term = (rec_data.get("term") or "").strip()
            final_grade = rec_data.get("final_grade")
            raw_components = rec_data.get("components", {})

            if not course_id:
                errors.append(f"Registro {idx + 1}: course_id es requerido")
                continue
            if not term:
                errors.append(f"Registro {idx + 1}: term es requerido")
                continue
            if final_grade is None:
                errors.append(f"Registro {idx + 1}: final_grade es requerido")
                continue

            try:
                fg = float(final_grade)
                if fg < 0 or fg > 20:
                    errors.append(f"Registro {idx + 1}: final_grade debe ser 0-20")
                    continue
            except (ValueError, TypeError):
                errors.append(f"Registro {idx + 1}: final_grade inválido")
                continue

            if Course is None:
                errors.append(f"Registro {idx + 1}: modelo Course no disponible")
                continue

            try:
                course = Course.objects.get(pk=int(course_id))
            except Course.DoesNotExist:
                errors.append(f"Registro {idx + 1}: curso {course_id} no existe")
                continue

            # Auto-resolver plan_course
            pc = match_plan_course_for_grade(student, course)

            # Normalizar componentes
            components = _build_components(raw_components)

            rec, created = AcademicGradeRecord.objects.update_or_create(
                student=student,
                course=course,
                term=term,
                defaults={
                    "final_grade": fg,
                    "components": components,
                    "plan_course": pc,
                },
            )

            if created:
                created_count += 1
            else:
                updated_count += 1

        return ok(
            created=created_count,
            updated=updated_count,
            errors=errors,
        )

    def delete(self, request, record_id=None):
        err, code = _require_admin(request)
        if err:
            return ok(error=err["detail"])

        if not record_id:
            return ok(error="record_id es requerido en la URL")

        try:
            rec = AcademicGradeRecord.objects.get(pk=int(record_id))
        except AcademicGradeRecord.DoesNotExist:
            return ok(error=f"Registro {record_id} no existe")

        rec.delete()
        return ok(deleted=True)