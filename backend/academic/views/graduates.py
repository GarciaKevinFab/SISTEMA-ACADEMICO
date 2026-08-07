"""
Egresados / Certificado de Egresado — endpoints admin.

Responsabilidades:
  1. Listar alumnos ELEGIBLES para certificado (ciclo X + créditos aprobados >= plan)
  2. Emitir certificados masivamente creando AcademicProcess type=CERTIFICADO_EGRESADO
  3. Helper `maybe_auto_emit_certificate(student)` que se llama al cerrar un acta
     para disparar la emisión automática del certificado del alumno que ya cumple.
"""
from decimal import Decimal
from django.db.models import Sum, Q
from django.shortcuts import get_object_or_404
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication

from academic.models import (
    AcademicProcess, AcademicGradeRecord, Plan, PlanCourse, SectionGrades, Section,
)
from students.models import Student
from .utils import user_has_any_role


APPROVAL_MIN_GRADE = Decimal("11")
CERT_KIND = "CERTIFICADO_EGRESADO"


def _is_admin_grades(user):
    return (
        getattr(user, "is_staff", False)
        or getattr(user, "is_superuser", False)
        or user_has_any_role(user, ("ADMIN_SYSTEM", "ADMIN_ACADEMIC",
                                    "ADMIN_ACADEMICO", "REGISTRAR"))
    )


def _plan_total_credits(plan):
    """Créditos totales requeridos del plan (suma de PlanCourse.credits)."""
    if not plan:
        return 0
    total = PlanCourse.objects.filter(plan=plan).aggregate(t=Sum("credits"))["t"]
    return int(total or 0)


def _student_earned_credits(student):
    """Créditos aprobados por el alumno vía AcademicGradeRecord (>= 11)."""
    if not student:
        return 0, []
    # Créditos aprobados: cursos con nota >= 11 (del plan del alumno preferentemente).
    # Sumamos por PlanCourse.credits si está enlazado; sino Course.credits.
    total = 0
    approved_ids = []
    qs = (
        AcademicGradeRecord.objects
        .filter(student=student, final_grade__gte=APPROVAL_MIN_GRADE)
        .select_related("plan_course", "course")
    )
    for r in qs:
        credits = 0
        if r.plan_course_id and r.plan_course:
            credits = int(r.plan_course.credits or 0)
        elif r.course_id and hasattr(r.course, "credits"):
            credits = int(getattr(r.course, "credits", 0) or 0)
        total += credits
        approved_ids.append(r.course_id)
    return total, approved_ids


def compute_graduation_status(student):
    """
    Devuelve dict con: earned, required, pct, eligible, missing_courses.
    eligible = True si earned >= required (y required > 0).
    """
    plan = student.plan
    required = _plan_total_credits(plan)
    earned, approved_ids = _student_earned_credits(student)

    # Cursos del plan que el alumno NO ha aprobado
    missing = []
    if plan:
        for pc in PlanCourse.objects.filter(plan=plan).select_related("course"):
            if pc.course_id not in approved_ids:
                missing.append({
                    "code": pc.display_code or (pc.course.code if pc.course else ""),
                    "name": pc.display_name or (pc.course.name if pc.course else ""),
                    "credits": int(pc.credits or 0),
                    "semester": pc.semester,
                })

    eligible = required > 0 and earned >= required
    pct = round((earned / required * 100), 1) if required else 0
    return {
        "earned": earned,
        "required": required,
        "pct": pct,
        "eligible": eligible,
        "missing_courses": missing,
    }


def maybe_auto_emit_certificate(student):
    """Si el alumno cumple créditos, crea AcademicProcess de CERTIFICADO_EGRESADO
    si aún no existe uno. Devuelve el proceso creado o None."""
    if not student:
        return None
    status = compute_graduation_status(student)
    if not status["eligible"]:
        return None
    # Evitar duplicados
    exists = AcademicProcess.objects.filter(
        student_id=student.id, kind=CERT_KIND
    ).exists()
    if exists:
        return None
    proc = AcademicProcess.objects.create(
        student_id=student.id,
        kind=CERT_KIND,
        status="PENDIENTE",
        note=f"Auto-emitido al cumplir {status['earned']}/{status['required']} créditos.",
    )
    return proc


class GraduatesEligibleView(APIView):
    """
    GET /api/academic/graduates/eligible
      ?career_id=5              filtra por carrera
      ?min_ciclo=10             (default 10) solo alumnos con ciclo >= X
      ?only_ready=1             solo los que cumplen requisitos (eligible)
    Devuelve lista de alumnos con sus créditos aprobados / requeridos + estado.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not _is_admin_grades(request.user):
            return Response({"detail": "No autorizado."}, status=403)

        career_id = request.query_params.get("career_id")
        try:
            min_ciclo = int(request.query_params.get("min_ciclo") or 10)
        except (TypeError, ValueError):
            min_ciclo = 10
        only_ready = str(request.query_params.get("only_ready") or "").lower() in ("1", "true", "yes")

        qs = Student.objects.select_related("plan", "plan__career").filter(
            ciclo__gte=min_ciclo
        )
        if career_id:
            try:
                qs = qs.filter(plan__career_id=int(career_id))
            except (TypeError, ValueError):
                pass

        # Mapa student_id → process_id del último certificado emitido
        emitted_map = {}
        for p in AcademicProcess.objects.filter(kind=CERT_KIND).order_by("-id"):
            if p.student_id not in emitted_map:
                emitted_map[p.student_id] = p.id
        emitted_ids = set(emitted_map.keys())

        out = []
        for st in qs.order_by("plan__career__name", "apellido_paterno", "apellido_materno", "nombres"):
            status_data = compute_graduation_status(st)
            if only_ready and not status_data["eligible"]:
                continue
            out.append({
                "id": st.id,
                "dni": st.num_documento,
                "full_name": f"{st.apellido_paterno or ''} {st.apellido_materno or ''} {st.nombres or ''}".strip(),
                "career_id": st.plan.career_id if st.plan and st.plan.career_id else None,
                "career_name": st.plan.career.name if (st.plan and st.plan.career) else "",
                "plan_name": st.plan.name if st.plan else "",
                "ciclo": st.ciclo,
                "earned_credits": status_data["earned"],
                "required_credits": status_data["required"],
                "pct": status_data["pct"],
                "eligible": status_data["eligible"],
                "missing_count": len(status_data["missing_courses"]),
                "certificate_emitted": st.id in emitted_ids,
                "certificate_process_id": emitted_map.get(st.id),
            })

        return Response({
            "min_ciclo": min_ciclo,
            "total": len(out),
            "eligible_count": sum(1 for r in out if r["eligible"]),
            "already_emitted": sum(1 for r in out if r["certificate_emitted"]),
            "students": out,
        })


class GraduatesBulkEmitView(APIView):
    """
    POST /api/academic/graduates/bulk-emit
      body: { "student_ids": [1, 2, 3], "force": false }
    Crea AcademicProcess de CERTIFICADO_EGRESADO para cada alumno.
    Si `force=false` (default): omite alumnos que NO son elegibles o que ya
    tienen un certificado emitido.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not _is_admin_grades(request.user):
            return Response({"detail": "No autorizado."}, status=403)

        body = request.data or {}
        ids = body.get("student_ids") or []
        force = bool(body.get("force"))

        if not isinstance(ids, list) or not ids:
            return Response({"detail": "student_ids requerido (lista no vacía)"}, status=400)
        try:
            ids = [int(x) for x in ids]
        except (TypeError, ValueError):
            return Response({"detail": "student_ids inválidos"}, status=400)

        created = []
        skipped = []
        emitted_ids = set(
            AcademicProcess.objects.filter(kind=CERT_KIND, student_id__in=ids)
            .values_list("student_id", flat=True)
        )

        for st in Student.objects.filter(id__in=ids):
            if st.id in emitted_ids:
                skipped.append({"student_id": st.id, "reason": "ya_emitido"})
                continue
            status_data = compute_graduation_status(st)
            if not force and not status_data["eligible"]:
                skipped.append({
                    "student_id": st.id,
                    "reason": "no_elegible",
                    "earned": status_data["earned"],
                    "required": status_data["required"],
                })
                continue
            proc = AcademicProcess.objects.create(
                student_id=st.id,
                kind=CERT_KIND,
                status="PENDIENTE",
                note=(
                    f"Emitido manualmente (bulk) — "
                    f"{status_data['earned']}/{status_data['required']} créditos"
                    + (" [FORZADO]" if force and not status_data["eligible"] else "")
                ),
            )
            created.append({"student_id": st.id, "process_id": proc.id})

        return Response({
            "created_count": len(created),
            "skipped_count": len(skipped),
            "created": created,
            "skipped": skipped,
        })
