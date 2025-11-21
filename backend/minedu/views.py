from django.utils import timezone
from django.db.models import Count, Q
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.generics import ListAPIView, ListCreateAPIView, UpdateAPIView

from .models import (
    MineduExportBatch,
    MineduCatalogMapping,
    MineduJob,
    MineduJobRun,
    MineduJobLog,
)
from .serializers import (
    MineduExportBatchSerializer,
    MineduJobSerializer,
    MineduJobRunSerializer,
    MineduJobLogSerializer,
)


# =================================
# Dashboard / Estadísticas MINEDU
# =================================

class DashboardStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = MineduExportBatch.objects.all()
        total = qs.count()
        completed = qs.filter(status="COMPLETED").count()
        failed = qs.filter(status="FAILED").count()
        pending = qs.filter(status__in=["PENDING", "PROCESSING", "RETRYING"]).count()

        # desglose por tipo
        counts_by_type = qs.values("data_type").annotate(c=Count("id"))
        breakdown = {
            "enrollment_exports": 0,
            "grades_exports": 0,
            "students_exports": 0,
        }
        for row in counts_by_type:
            if row["data_type"] == "ENROLLMENT":
                breakdown["enrollment_exports"] = row["c"]
            elif row["data_type"] == "GRADES":
                breakdown["grades_exports"] = row["c"]
            elif row["data_type"] == "STUDENTS":
                breakdown["students_exports"] = row["c"]

        success_rate = 0.0
        if total > 0:
            success_rate = (completed / total) * 100.0

        data = {
            "stats": {
                "pending_exports": pending,
                "completed_exports": completed,
                "failed_exports": failed,
                "success_rate": success_rate,
            },
            "data_breakdown": breakdown,
        }
        return Response(data)


# =============================
# Exportaciones (enqueue)
# =============================

class EnqueueEnrollmentsExportView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        academic_year = int(request.data.get("academic_year", 0))
        academic_period = request.data.get("academic_period", "")

        batch = MineduExportBatch.objects.create(
            data_type="ENROLLMENT",
            academic_year=academic_year,
            academic_period=academic_period,
            status="PENDING",
            total_records=0,
            record_data={
                "academic_year": academic_year,
                "academic_period": academic_period,
            },
        )
        ser = MineduExportBatchSerializer(batch)
        return Response(ser.data, status=status.HTTP_201_CREATED)


class EnqueueGradesExportView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        academic_year = int(request.data.get("academic_year", 0))
        academic_period = request.data.get("academic_period", "")

        batch = MineduExportBatch.objects.create(
            data_type="GRADES",
            academic_year=academic_year,
            academic_period=academic_period,
            status="PENDING",
            total_records=0,
            record_data={
                "academic_year": academic_year,
                "academic_period": academic_period,
            },
        )
        ser = MineduExportBatchSerializer(batch)
        return Response(ser.data, status=status.HTTP_201_CREATED)


class ExportBatchListView(ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = MineduExportBatchSerializer

    def get_queryset(self):
        return MineduExportBatch.objects.all().order_by("-created_at")

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        # frontend usa data?.exports ?? data ?? []
        return Response({"exports": response.data})


class ExportBatchRetryView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            batch = MineduExportBatch.objects.get(pk=pk)
        except MineduExportBatch.DoesNotExist:
            return Response({"detail": "Export batch not found"}, status=404)

        # Simple: lo marcamos como RETRYING
        batch.status = "RETRYING"
        batch.save(update_fields=["status", "updated_at"])
        return Response({"detail": "Retry enqueued"})


# =============================
# Validación de integridad
# =============================

class DataIntegrityValidationView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Stub simple. Ajusta esto para validar realmente tus datos.
        """
        total_exports = MineduExportBatch.objects.count()
        failed_exports = MineduExportBatch.objects.filter(status="FAILED").count()

        valid = failed_exports == 0
        data = {
            "valid": valid,
            "stats": {
                "total_exports": total_exports,
                "failed_exports": failed_exports,
            },
            "errors": [] if valid else ["Existen exportaciones fallidas"],
            "warnings": [],
        }
        return Response(data)


# =============================
# Catálogos (local & remoto)
# =============================

class RemoteCatalogView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        catalog_type = request.query_params.get("type")
        items = []

        # OJO: aquí puedes conectar a un servicio real de MINEDU.
        # Por ahora devolvemos unos ejemplos para que el front funcione.
        if catalog_type == "INSTITUTION":
            items = [
                {"code": "IE12345", "label": "IE 12345 - Nuestra Señora de Guadalupe"},
                {"code": "IE67890", "label": "IE 67890 - San Juan"},
            ]
        elif catalog_type == "CAREER":
            items = [
                {"code": "MINEDU-SIS", "label": "Ing. de Sistemas"},
                {"code": "MINEDU-ADM", "label": "Administración"},
            ]
        elif catalog_type == "STUDY_PLAN":
            items = [
                {"code": "PLAN-2024-A", "label": "Plan 2024 A"},
                {"code": "PLAN-2023-B", "label": "Plan 2023 B"},
            ]
        elif catalog_type == "STUDENT":
            items = [
                {"code": "STU-0001", "label": "Alumno 0001"},
                {"code": "STU-0002", "label": "Alumno 0002"},
            ]

        return Response({"items": items})


class LocalCatalogView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        catalog_type = request.query_params.get("type")
        # TODO: aquí deberías usar tus modelos reales (Career, Student, etc.)
        # De momento devolvemos ejemplos para que no truene el front.

        items = []
        if catalog_type == "CAREER":
            items = [
                {"id": 1, "name": "Ing. de Sistemas", "code": "SIS"},
                {"id": 2, "name": "Administración", "code": "ADM"},
            ]
        elif catalog_type == "INSTITUTION":
            items = [
                {"id": 1, "name": "IE Local 1", "code": "LOC-IE1"},
            ]
        elif catalog_type == "STUDY_PLAN":
            items = [
                {"id": 10, "name": "Plan 2024 Sistemas", "code": "PL-SIS-2024"},
            ]
        elif catalog_type == "STUDENT":
            items = [
                {"id": 100, "name": "Juan Pérez", "ident": "71234567"},
                {"id": 101, "name": "María López", "ident": "71234568"},
            ]

        return Response({"items": items})


# =============================
# Mapeos
# =============================

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

        for item in mappings:
            local_id = int(item.get("local_id"))
            code = item.get("minedu_code") or None
            obj, _ = MineduCatalogMapping.objects.get_or_create(
                type=catalog_type,
                local_id=local_id,
                defaults={"minedu_code": code},
            )
            if not _:
                obj.minedu_code = code
                obj.save(update_fields=["minedu_code", "updated_at"])

        return Response({"saved": len(mappings)})


# =============================
# Jobs
# =============================

class JobListCreateView(ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = MineduJobSerializer
    queryset = MineduJob.objects.all().order_by("id")

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        # frontend usa data?.jobs ?? data ?? []
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
        job_id = self.kwargs["pk"]
        return MineduJobRun.objects.filter(job_id=job_id).order_by("-started_at")

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
        run.meta["retry_at"] = timezone.now().isoformat()
        run.save(update_fields=["status", "meta", "updated_at"])
        return Response({"detail": "Run marcado para reintento"})


class JobRunLogsView(ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = MineduJobLogSerializer

    def get_queryset(self):
        run_id = self.kwargs["run_id"]
        return MineduJobLog.objects.filter(run_id=run_id).order_by("timestamp")

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        # frontend usa data?.logs ?? data ?? []
        return Response({"logs": response.data})
