"""
Vistas para manejo de Planes académicos (mallas curriculares)
"""
from django.db import transaction
from django.db.models import Q, Count
from rest_framework.response import Response 
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework_simplejwt.authentication import JWTAuthentication

from students.models import Student as StudentProfile
from academic.models import (
    Plan, PlanCourse, Course, CoursePrereq,
    AcademicGradeRecord
)
from academic.serializers import (
    PlanSerializer, PlanCreateSerializer,
    PlanCourseOutSerializer, PlanCourseCreateSerializer,
)
from .utils import _can_delete_plans, ok


class PlansViewSet(viewsets.ModelViewSet):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    # ✅ base sin filtro de borrados (para que get_queryset decida)
    base_queryset = Plan.objects.select_related("career")

    def get_queryset(self):
        qs = self.base_queryset.order_by("-id")

        # opcional: permitir ver eliminados con ?show_deleted=1
        show_deleted = str(self.request.query_params.get("show_deleted", "")).lower() in ("1", "true", "yes")
        if show_deleted:
            return qs

        return qs.filter(is_deleted=False)

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

    def retrieve(self, request, pk=None, *args, **kwargs):
        plan = self.get_object()
        return ok(plan=PlanSerializer(plan).data)

    # ✅ FIX REAL: soporta PUT y PATCH sin reventar
    def update(self, request, *args, **kwargs):
        plan = self.get_object()

        # DRF mete partial=True cuando viene de PATCH (partial_update)
        partial = bool(kwargs.pop("partial", False))

        ser = self.get_serializer(plan, data=request.data, partial=partial)
        ser.is_valid(raise_exception=True)
        plan = ser.save()

        return ok(plan=PlanSerializer(plan).data)

    # ✅ Opcional pero recomendado: deja explícito el PATCH
    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    def destroy(self, request, pk=None, *args, **kwargs):
        """
        Borra FÍSICAMENTE el plan + PlanCourse + opcionalmente la carrera si queda vacía
        """
        if not _can_delete_plans(request.user):
            return Response({"detail": "No autorizado."}, status=403)

        plan = self.get_object()
        
        # 1. Verificar si hay estudiantes asignados
        students_count = StudentProfile.objects.filter(plan_id=plan.id).count()
        
        if students_count > 0:
            return Response({
                "detail": f"No se puede eliminar: hay {students_count} estudiantes asignados a este plan.",
                "students_count": students_count,
            }, status=409)
        
        # 2. Verificar si hay notas relacionadas (via PlanCourse)
        grades_count = AcademicGradeRecord.objects.filter(plan_course__plan_id=plan.id).count()
        
        if grades_count > 0:
            return Response({
                "detail": f"No se puede eliminar: hay {grades_count} registros de notas asociados a cursos de este plan.",
                "grades_count": grades_count,
            }, status=409)
        
        plan_name = plan.name
        career = plan.career  # guardamos referencia antes de borrar
        career_name = career.name if career else None
        
        # 3. Borra físicamente el plan (PlanCourse se borra en cascada por FK)
        plan.delete()
        
        # 4. ✅ Si la carrera quedó sin planes, bórrala también
        career_deleted = False
        if career:
            remaining_plans = Plan.objects.filter(career=career).count()
            if remaining_plans == 0:
                career.delete()
                career_deleted = True
        
        return Response({
            "success": True,
            "deleted_plan": plan_name,
            "career_deleted": career_deleted,
            "deleted_career": career_name if career_deleted else None,
        })

    @action(detail=True, methods=["get", "post"], url_path="courses")
    def courses(self, request, pk=None):
        plan = self.get_object()

        if request.method.lower() == "get":
            semester = request.query_params.get("semester")
            q = (request.query_params.get("q") or "").strip()
            all_flag = str(request.query_params.get("all", "")).lower() in ("1", "true", "yes")

            base = PlanCourse.objects.filter(plan=plan).select_related("course")

            if q:
                base = base.filter(
                    Q(display_code__icontains=q)
                    | Q(display_name__icontains=q)
                    | Q(course__code__icontains=q)
                    | Q(course__name__icontains=q)
                )

            if all_flag:
                qs = base.order_by("semester", "display_code", "course__code", "id")
                return ok(total=qs.count(), courses=PlanCourseOutSerializer(qs, many=True).data)

            if not semester:
                sems = base.values("semester").order_by("semester").annotate(total=Count("id"))
                semesters = []
                for row in sems:
                    try:
                        sem = int(row.get("semester") or 0)
                    except Exception:
                        sem = 0
                    if sem <= 0:
                        continue
                    semesters.append({"semester": sem, "total": int(row.get("total") or 0)})
                return ok(semesters=semesters)

            try:
                sem = int(semester)
            except Exception:
                return Response({"detail": "semester inválido"}, status=400)

            qs = base.filter(semester=sem).order_by("display_code", "course__code", "id")
            return ok(
                semester=sem,
                total=qs.count(),
                courses=PlanCourseOutSerializer(qs, many=True).data,
            )

        # POST
        payload_ser = PlanCourseCreateSerializer(data=request.data)
        payload_ser.is_valid(raise_exception=True)
        data = payload_ser.validated_data

        code = (data.get("code") or "").strip()
        name = (data.get("name") or "").strip()
        credits = int(data.get("credits", 3) or 3)

        if not code:
            return Response({"detail": "code no puede estar vacío"}, status=400)
        if not name:
            return Response({"detail": "name no puede estar vacío"}, status=400)

        if PlanCourse.objects.filter(plan=plan, display_code__iexact=code).exists():
            return Response({"detail": f"Ya existe un curso con code '{code}' en este plan"}, status=409)

        with transaction.atomic():
            course, _ = Course.objects.get_or_create(
                code=code,
                defaults={"name": name, "credits": 3},
            )

            pc = PlanCourse.objects.create(
                plan=plan,
                course=course,
                semester=data.get("semester", 1),
                weekly_hours=data.get("weekly_hours", 3),
                type=data.get("type", "MANDATORY"),
                display_code=code,
                display_name=name,
                credits=credits,
            )

        return ok(course=PlanCourseOutSerializer(pc).data)

    @action(detail=True, methods=["put", "delete"], url_path=r"courses/(?P<course_id>\d+)")
    def course_detail(self, request, pk=None, course_id=None):
        plan = self.get_object()
        pc = get_object_or_404(PlanCourse, plan=plan, id=int(course_id))

        if request.method.lower() == "delete":
            pc.delete()
            return ok(success=True)

        body = request.data or {}
        new_code = (body.get("code") or "").strip()
        new_name = (body.get("name") or "").strip()

        with transaction.atomic():
            # ✅ PlanCourse fields
            if "semester" in body:
                pc.semester = int(body["semester"])

            if "weekly_hours" in body:
                pc.weekly_hours = int(body["weekly_hours"])

            if "type" in body:
                pc.type = body["type"]

            # ✅ Nombre por malla (PlanCourse)
            if "name" in body:
                if not new_name:
                    return Response({"detail": "name no puede estar vacío"}, status=400)
                pc.display_name = new_name

            # ✅ Código por malla (PlanCourse) + validar duplicado dentro del mismo plan
            if "code" in body:
                if not new_code:
                    return Response({"detail": "code no puede estar vacío"}, status=400)

                exists = (
                    PlanCourse.objects.filter(plan=plan, display_code__iexact=new_code)
                    .exclude(id=pc.id)
                    .exists()
                )
                if exists:
                    return Response(
                        {"detail": f"Ya existe un curso con code '{new_code}' en este plan"},
                        status=409,
                    )

                pc.display_code = new_code

            if "credits" in body:
                pc.credits = int(body["credits"])

            pc.save()

        return ok(course=PlanCourseOutSerializer(pc).data)

    @action(detail=True, methods=["get", "put"], url_path=r"courses/(?P<course_id>\d+)/prereqs")
    def prereqs(self, request, pk=None, course_id=None):
        plan = self.get_object()
        pc = get_object_or_404(PlanCourse, plan=plan, id=int(course_id))

        if request.method.lower() == "get":
            ids = CoursePrereq.objects.filter(plan_course=pc).values_list(
                "prerequisite_id", flat=True
            )
            return ok(prerequisites=[{"id": i} for i in ids])

        ids = (request.data or {}).get("prerequisites", [])
        if not isinstance(ids, list):
            return Response({"detail": "prerequisites debe ser lista"}, status=400)

        valid = set(
            PlanCourse.objects.filter(plan=plan, id__in=ids).values_list("id", flat=True)
        )

        with transaction.atomic():
            CoursePrereq.objects.filter(plan_course=pc).delete()
            for pid in valid:
                if pid == pc.id:
                    continue
                CoursePrereq.objects.create(plan_course=pc, prerequisite_id=pid)

        return ok(
            success=True,
            prerequisites=[{"id": i} for i in sorted(valid) if i != pc.id],
        )


def ok(data=None, **extra):
    from rest_framework.response import Response
    if data is None:
        data = {}
    data.update(extra)
    return Response(data)