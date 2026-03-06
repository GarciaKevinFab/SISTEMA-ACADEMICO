import traceback
from django.core.files.base import ContentFile
from django.utils import timezone
from django.db.models import Count, Q
from django.http import FileResponse
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.generics import ListAPIView, ListCreateAPIView, UpdateAPIView

from .models import (
    MineduCode,
    MineduExportBatch,
    MineduCatalogMapping,
    MineduJob,
    MineduJobRun,
    MineduJobLog,
)
from .serializers import (
    MineduCodeSerializer,
    MineduExportBatchSerializer,
    MineduJobSerializer,
    MineduJobRunSerializer,
    MineduJobLogSerializer,
)
from .export_generators import generate_export

# ── Modelos reales ──
from catalogs.models import Career
from academic.models import (
    Plan,
    Enrollment,
    AcademicGradeRecord,
    InstitutionSettings,
)
from students.models import Student


# ─────────────────────────────────────────────────────────
# Agrupación de data_type para el dashboard
# ─────────────────────────────────────────────────────────
# Cada tipo se agrupa en una de 3 categorías de breakdown
_BREAKDOWN_MAP = {
    "ENROLLMENT":    "enrollment_exports",
    "FICHA":         "enrollment_exports",
    "BOLETA":        "grades_exports",
    "ACTA":          "grades_exports",
    "REPORTE":       "students_exports",
    "REGISTRO_AUX":  "grades_exports",
    "CERTIFICADO":   "students_exports",
    # Legacy (por si aún hay datos viejos sin migrar)
    "FICHA_MATRICULA": "enrollment_exports",
    "GRADES":          "grades_exports",
    "STUDENTS":        "students_exports",
}


# =================================================================
# Dashboard
# =================================================================

class DashboardStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            qs = MineduExportBatch.objects.all()
            total = qs.count()
            completed = qs.filter(status="COMPLETED").count()
            failed = qs.filter(status="FAILED").count()
            pending = qs.filter(
                status__in=["PENDING", "PROCESSING", "RETRYING"]
            ).count()

            # Breakdown por tipo
            breakdown = {
                "enrollment_exports": 0,
                "grades_exports": 0,
                "students_exports": 0,
            }
            for row in qs.values("data_type").annotate(c=Count("id")):
                key = _BREAKDOWN_MAP.get(row["data_type"])
                if key:
                    breakdown[key] += row["c"]

            success_rate = (completed / total * 100.0) if total > 0 else 0.0
        except Exception:
            completed = failed = pending = 0
            success_rate = 0.0
            breakdown = {
                "enrollment_exports": 0,
                "grades_exports": 0,
                "students_exports": 0,
            }

        return Response({
            "stats": {
                "pending_exports": pending,
                "completed_exports": completed,
                "failed_exports": failed,
                "success_rate": round(success_rate, 1),
            },
            "data_breakdown": breakdown,
        })


# =================================================================
# Exportaciones — genera archivos reales
# =================================================================

class ExportGenerateView(APIView):
    """
    POST /minedu/export/generate
    Body: { data_type, export_format, academic_year, academic_period }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        data_type = request.data.get("data_type", "")
        export_format = request.data.get("export_format", "XLSX").upper()
        academic_year = request.data.get("academic_year")
        academic_period = request.data.get("academic_period", "")

        if not data_type or not academic_year or not academic_period:
            return Response(
                {"detail": "data_type, academic_year y academic_period son requeridos"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        academic_year = int(academic_year)
        period_code = f"{academic_year}-{academic_period}"

        if export_format not in ("XLSX", "CSV"):
            export_format = "XLSX"

        batch = MineduExportBatch.objects.create(
            data_type=data_type,
            export_format=export_format,
            academic_year=academic_year,
            academic_period=academic_period,
            status="PROCESSING",
            total_records=0,
        )

        try:
            filename, content, total = generate_export(
                data_type, export_format, period_code
            )

            batch.file.save(filename, ContentFile(content), save=False)
            batch.total_records = total
            batch.status = "COMPLETED"
            batch.record_data = {
                "academic_year": academic_year,
                "academic_period": academic_period,
                "period_code": period_code,
                "total_records": total,
                "filename": filename,
            }
            batch.save()

        except Exception as exc:
            batch.status = "FAILED"
            batch.error_message = f"{exc}\n{traceback.format_exc()}"
            batch.save()
            return Response(
                {"detail": f"Error generando exportación: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        ser = MineduExportBatchSerializer(batch, context={"request": request})
        return Response(ser.data, status=status.HTTP_201_CREATED)


class ExportBatchListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            qs = MineduExportBatch.objects.all().order_by("-created_at")
            ser = MineduExportBatchSerializer(
                qs, many=True, context={"request": request}
            )
            return Response({"exports": ser.data})
        except Exception as exc:
            return Response({"exports": [], "error": str(exc)})


class ExportBatchRetryView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            batch = MineduExportBatch.objects.get(pk=pk)
        except MineduExportBatch.DoesNotExist:
            return Response({"detail": "Export batch not found"}, status=404)

        period_code = f"{batch.academic_year}-{batch.academic_period}"
        batch.status = "PROCESSING"
        batch.error_message = ""
        batch.save(update_fields=["status", "error_message", "updated_at"])

        try:
            filename, content, total = generate_export(
                batch.data_type, batch.export_format, period_code
            )
            batch.file.save(filename, ContentFile(content), save=False)
            batch.total_records = total
            batch.status = "COMPLETED"
            batch.record_data = {
                "academic_year": batch.academic_year,
                "academic_period": batch.academic_period,
                "period_code": period_code,
                "total_records": total,
                "filename": filename,
            }
            batch.save()
        except Exception as exc:
            batch.status = "FAILED"
            batch.error_message = str(exc)
            batch.save()
            return Response({"detail": f"Reintento fallido: {exc}"}, status=500)

        ser = MineduExportBatchSerializer(batch, context={"request": request})
        return Response(ser.data)


class ExportBatchDownloadView(APIView):
    """GET /minedu/exports/<id>/download — descarga directa."""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            batch = MineduExportBatch.objects.get(pk=pk)
        except MineduExportBatch.DoesNotExist:
            return Response({"detail": "No encontrado"}, status=404)

        if not batch.file:
            return Response({"detail": "No hay archivo generado"}, status=404)

        ext = (batch.export_format or "xlsx").lower()
        content_types = {
            "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "csv": "text/csv",
        }
        ct = content_types.get(ext, "application/octet-stream")
        filename = (batch.record_data or {}).get(
            "filename", f"export_{batch.id}.{ext}"
        )

        return FileResponse(
            batch.file.open("rb"),
            content_type=ct,
            as_attachment=True,
            filename=filename,
        )


# =================================================================
# Validación de integridad — datos reales
# =================================================================

class DataIntegrityValidationView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        errors = []
        warnings = []
        stats = {}

        # 1. Estudiantes sin documento
        total_students = Student.objects.count()
        no_doc = Student.objects.filter(
            Q(num_documento="") | Q(num_documento__isnull=True)
        ).count()
        stats["total_estudiantes"] = total_students
        if no_doc > 0:
            errors.append(f"{no_doc} estudiante(s) sin número de documento")

        # 2. Carreras activas sin mapeo MINEDU
        active_careers = Career.objects.filter(is_active=True)
        total_careers = active_careers.count()
        mapped_career_ids = set(
            MineduCatalogMapping.objects.filter(type="CAREER")
            .exclude(Q(minedu_code="") | Q(minedu_code__isnull=True))
            .values_list("local_id", flat=True)
        )
        unmapped_careers = active_careers.exclude(id__in=mapped_career_ids).count()
        stats["carreras_activas"] = total_careers
        stats["carreras_sin_mapeo"] = unmapped_careers
        if unmapped_careers > 0:
            errors.append(f"{unmapped_careers} carrera(s) activa(s) sin código MINEDU")

        # 3. Planes sin mapeo
        active_plans = Plan.objects.filter(is_deleted=False)
        total_plans = active_plans.count()
        mapped_plan_ids = set(
            MineduCatalogMapping.objects.filter(type="STUDY_PLAN")
            .exclude(Q(minedu_code="") | Q(minedu_code__isnull=True))
            .values_list("local_id", flat=True)
        )
        unmapped_plans = active_plans.exclude(id__in=mapped_plan_ids).count()
        stats["planes_activos"] = total_plans
        if unmapped_plans > 0:
            warnings.append(f"{unmapped_plans} plan(es) de estudio sin código MINEDU")

        # 4. Estudiantes matriculados sin mapeo
        enrolled_ids = set(
            Enrollment.objects.filter(status="CONFIRMED")
            .values_list("student_id", flat=True)
        )
        mapped_student_ids = set(
            MineduCatalogMapping.objects.filter(type="STUDENT")
            .exclude(Q(minedu_code="") | Q(minedu_code__isnull=True))
            .values_list("local_id", flat=True)
        )
        unmapped_enrolled = len(enrolled_ids - mapped_student_ids)
        stats["matriculados_confirmados"] = len(enrolled_ids)
        if unmapped_enrolled > 0:
            warnings.append(
                f"{unmapped_enrolled} estudiante(s) matriculado(s) sin código MINEDU"
            )

        # 5. Estudiantes con datos incompletos (requeridos por SIA/SIAGIE)
        incomplete = Student.objects.filter(
            Q(nombres="") | Q(apellido_paterno="")
            | Q(fecha_nac__isnull=True) | Q(sexo="")
        ).count()
        if incomplete > 0:
            warnings.append(
                f"{incomplete} estudiante(s) con datos incompletos "
                f"(nombre, apellido, fecha nac. o sexo)"
            )

        # 6. Notas fuera de rango vigesimal
        try:
            bad_grades = AcademicGradeRecord.objects.filter(
                Q(final_grade__lt=0) | Q(final_grade__gt=20)
            ).exclude(final_grade__isnull=True).count()
            if bad_grades > 0:
                errors.append(
                    f"{bad_grades} nota(s) fuera del rango vigesimal (0-20)"
                )
        except Exception:
            pass

        # 7. Exportaciones fallidas
        failed = MineduExportBatch.objects.filter(status="FAILED").count()
        stats["exportaciones_fallidas"] = failed
        if failed > 0:
            errors.append(f"{failed} exportación(es) fallida(s) sin resolver")

        # 8. Datos de institución
        try:
            inst = InstitutionSettings.objects.first()
            if not inst or not inst.name:
                warnings.append("Datos de institución no configurados")
        except Exception:
            warnings.append("No se pudo verificar configuración de institución")

        # 9. Códigos MINEDU registrados
        total_codes = MineduCode.objects.count()
        stats["codigos_minedu_registrados"] = total_codes
        if total_codes == 0:
            warnings.append(
                "No hay códigos MINEDU registrados. "
                "Vaya a Mapeos → sección Códigos MINEDU para agregarlos."
            )

        # 10. Cursos sin código en plan
        try:
            from academic.models import PlanCourse
            no_code_courses = PlanCourse.objects.filter(
                Q(course__code="") | Q(course__code__isnull=True)
            ).count()
            if no_code_courses > 0:
                warnings.append(
                    f"{no_code_courses} curso(s) en plan sin código asignado"
                )
        except Exception:
            pass

        valid = len(errors) == 0

        return Response({
            "valid": valid,
            "stats": stats,
            "errors": errors,
            "warnings": warnings,
        })


# =================================================================
# Códigos MINEDU (CRUD)
# =================================================================

class MineduCodeListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        catalog_type = request.query_params.get("type")
        qs = MineduCode.objects.all()
        if catalog_type:
            qs = qs.filter(type=catalog_type)
        ser = MineduCodeSerializer(qs, many=True)
        return Response({"items": ser.data})

    def post(self, request):
        ser = MineduCodeSerializer(data=request.data)
        if ser.is_valid():
            ser.save()
            return Response(ser.data, status=status.HTTP_201_CREATED)
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)


class MineduCodeDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            obj = MineduCode.objects.get(pk=pk)
        except MineduCode.DoesNotExist:
            return Response({"detail": "No encontrado"}, status=404)
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# =================================================================
# Catálogos locales (datos reales)
# =================================================================

class LocalCatalogView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        catalog_type = request.query_params.get("type")
        items = []

        try:
            if catalog_type == "CAREER":
                for c in Career.objects.filter(is_active=True).order_by("name"):
                    items.append({"id": c.id, "name": c.name, "code": c.code})

            elif catalog_type == "STUDY_PLAN":
                for p in (
                    Plan.objects.filter(is_deleted=False)
                    .select_related("career")
                    .order_by("name")
                ):
                    label = (
                        f"{p.name} ({p.career.name})" if p.career else p.name
                    )
                    code = (
                        f"{p.career.code}-{p.start_year}"
                        if p.career
                        else str(p.start_year)
                    )
                    items.append({"id": p.id, "name": label, "code": code})

            elif catalog_type == "STUDENT":
                for s in (
                    Student.objects.all()
                    .order_by("apellido_paterno", "apellido_materno", "nombres")[
                        :500
                    ]
                ):
                    full = (
                        f"{s.apellido_paterno} {s.apellido_materno} {s.nombres}"
                        .strip()
                    )
                    items.append(
                        {"id": s.id, "name": full, "ident": s.num_documento}
                    )

            elif catalog_type == "INSTITUTION":
                try:
                    inst = InstitutionSettings.objects.first()
                    if inst and inst.name:
                        items.append({
                            "id": inst.id,
                            "name": inst.name,
                            "code": inst.ruc or f"INST-{inst.id}",
                        })
                except Exception:
                    pass
        except Exception as exc:
            return Response({"items": [], "error": str(exc)})

        return Response({"items": items})


class RemoteCatalogView(APIView):
    """
    Códigos MINEDU registrados (lee de MineduCode).
    GET /minedu/catalogs/remote?type=CAREER
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        catalog_type = request.query_params.get("type")
        qs = MineduCode.objects.all()
        if catalog_type:
            qs = qs.filter(type=catalog_type)
        items = [
            {"id": c.id, "code": c.code, "label": c.label or c.code}
            for c in qs
        ]
        return Response({"items": items})


# =================================================================
# Mapeos
# =================================================================

class CatalogMappingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        catalog_type = request.query_params.get("type")
        qs = MineduCatalogMapping.objects.all()
        if catalog_type:
            qs = qs.filter(type=catalog_type)
        mappings = [
            {"local_id": m.local_id, "minedu_code": m.minedu_code or ""}
            for m in qs
        ]
        return Response({"mappings": mappings})


class CatalogMappingsBulkSaveView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        catalog_type = request.data.get("type")
        mappings = request.data.get("mappings", [])

        if not catalog_type:
            return Response({"detail": "type requerido"}, status=400)

        saved = 0
        for item in mappings:
            local_id = int(item.get("local_id", 0))
            code = item.get("minedu_code") or None
            if not local_id:
                continue

            obj, created = MineduCatalogMapping.objects.get_or_create(
                type=catalog_type,
                local_id=local_id,
                defaults={"minedu_code": code},
            )
            if not created:
                obj.minedu_code = code
                obj.save(update_fields=["minedu_code", "updated_at"])
            saved += 1

        return Response({"saved": saved})


# =================================================================
# Jobs
# =================================================================

class JobListCreateView(ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = MineduJobSerializer
    queryset = MineduJob.objects.all().order_by("id")

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        return Response({"jobs": response.data})


class JobUpdateView(UpdateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = MineduJobSerializer
    queryset = MineduJob.objects.all()
    http_method_names = ["patch"]


class JobRunNowView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            job = MineduJob.objects.get(pk=pk)
        except MineduJob.DoesNotExist:
            return Response({"detail": "Job no encontrado"}, status=404)

        run = MineduJobRun.objects.create(
            job=job,
            status="PENDING",
            meta={"trigger": "run_now", "user_id": request.user.id},
        )
        job.last_run_at = timezone.now()
        job.save(update_fields=["last_run_at", "updated_at"])

        ser = MineduJobRunSerializer(run)
        return Response(ser.data, status=201)


class JobPauseView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            job = MineduJob.objects.get(pk=pk)
        except MineduJob.DoesNotExist:
            return Response({"detail": "Job no encontrado"}, status=404)
        job.enabled = False
        job.save(update_fields=["enabled", "updated_at"])
        return Response({"detail": "Job pausado"})


class JobResumeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            job = MineduJob.objects.get(pk=pk)
        except MineduJob.DoesNotExist:
            return Response({"detail": "Job no encontrado"}, status=404)
        job.enabled = True
        job.save(update_fields=["enabled", "updated_at"])
        return Response({"detail": "Job reanudado"})


class JobRunsListView(ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = MineduJobRunSerializer

    def get_queryset(self):
        return MineduJobRun.objects.filter(
            job_id=self.kwargs["pk"]
        ).order_by("-started_at")

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        return Response({"runs": response.data})


class JobRunRetryView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, run_id):
        try:
            run = MineduJobRun.objects.get(pk=run_id)
        except MineduJobRun.DoesNotExist:
            return Response({"detail": "Run no encontrado"}, status=404)
        run.status = "PENDING"
        run.meta = run.meta or {}
        run.meta["retry_at"] = timezone.now().isoformat()
        run.save(update_fields=["status", "meta", "updated_at"])
        return Response({"detail": "Run marcado para reintento"})


class JobRunLogsView(ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = MineduJobLogSerializer

    def get_queryset(self):
        return MineduJobLog.objects.filter(
            run_id=self.kwargs["run_id"]
        ).order_by("timestamp")

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        return Response({"logs": response.data})