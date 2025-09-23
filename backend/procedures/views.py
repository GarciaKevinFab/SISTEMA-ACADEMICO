from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone

from .models import Procedure
from .serializers import ProcedureSerializer

class ProcedureViewSet(viewsets.ModelViewSet):
    queryset = Procedure.objects.select_related("student").all()
    serializer_class = ProcedureSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "tracking_code",
        "student__dni", "student__first_name", "student__last_name",
        "procedure_type", "status", "description",
    ]
    ordering_fields = ["submitted_at", "resolved_at", "status", "procedure_type", "created_at"]
    ordering = ["-created_at"]

    @action(detail=True, methods=["post"])
    def set_status(self, request, pk=None):
        """Cambia el estado del trámite; si es final, setea resolved_at."""
        proc = self.get_object()
        new_status = request.data.get("status")
        valid = [c[0] for c in Procedure.Status.choices]
        if new_status not in valid:
            return Response({"detail": f"status inválido. Use uno de {valid}"}, status=status.HTTP_400_BAD_REQUEST)

        proc.status = new_status
        if new_status in [Procedure.Status.APPROVED, Procedure.Status.REJECTED, Procedure.Status.DELIVERED]:
            proc.resolved_at = proc.resolved_at or timezone.now()
        else:
            proc.resolved_at = None
        proc.save(update_fields=["status", "resolved_at"])
        return Response(self.get_serializer(proc).data)

    @action(detail=False, methods=["get"])
    def my_open(self, request):
        """Lista trámites abiertos (no resueltos)."""
        qs = self.get_queryset().filter(resolved_at__isnull=True)
        page = self.paginate_queryset(qs)
        if page is not None:
            ser = self.get_serializer(page, many=True)
            return self.get_paginated_response(ser.data)
        ser = self.get_serializer(qs, many=True)
        return Response(ser.data)
