# backend/enrollment/views.py
from rest_framework import viewsets, filters, status, permissions
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response

from .models import Enrollment
from .serializers import EnrollmentSerializer
from courses.models import Course


class EnrollmentViewSet(viewsets.ModelViewSet):
    queryset = Enrollment.objects.select_related("student", "course").all()
    serializer_class = EnrollmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "period", "status", "section",
        "student__dni", "student__first_name", "student__last_name",
        "course__code", "course__name",
    ]
    ordering_fields = ["created_at", "period", "status", "section"]
    ordering = ["-created_at"]

    @action(detail=True, methods=["post"])
    def set_status(self, request, pk=None):
        enrollment = self.get_object()
        status_value = request.data.get("status")
        valid = [c[0] for c in Enrollment.Status.choices]
        if status_value not in valid:
            return Response(
                {"detail": f"status inválido. Use uno de {valid}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        enrollment.status = status_value
        enrollment.save(update_fields=["status"])
        return Response(self.get_serializer(enrollment).data)


# ===== Alias global esperado por el front: /api/enrollments/suggestions =====
@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def enrollment_suggestions(request):
    """
    Body sugerido:
      {
        "student_id": 12,
        "period": "2025-I",
        "max": 6    # opcional
      }
    Respuesta simple:
      { "suggestions": [ {course_id, code, name}, ... ] }
    Lógica:
      - Excluye cursos ya inscritos por el alumno en ese periodo.
      - Sugiere cursos activos (primeros N por nombre).
    """
    student_id = request.data.get("student_id")
    period = request.data.get("period")
    maxn = int(request.data.get("max") or 6)

    if not student_id or not period:
        return Response({"detail": "student_id y period son requeridos"}, status=400)

    # IDs de cursos ya matriculados por el alumno en el periodo dado
    enrolled_cids = set(
        Enrollment.objects.filter(student_id=student_id, period=period)
        .values_list("course_id", flat=True)
    )

    # Sugerimos cursos activos que NO estén ya matriculados
    qs = Course.objects.filter(is_active=True).exclude(id__in=enrolled_cids).order_by("name")[:maxn]
    data = [{"course_id": c.id, "code": c.code, "name": c.name} for c in qs]
    return Response({"suggestions": data})
