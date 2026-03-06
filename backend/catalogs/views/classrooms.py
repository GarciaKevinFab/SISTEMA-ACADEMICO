"""
ViewSet para Aulas/Salones
"""
from rest_framework import viewsets, permissions

from catalogs.models import Classroom
from catalogs.serializers import ClassroomSerializer
from .utils import list_items


class ClassroomsViewSet(viewsets.ModelViewSet):
    queryset = Classroom.objects.select_related("campus").all()
    serializer_class = ClassroomSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "post", "patch", "delete"]
    
    def get_queryset(self):
        qs = super().get_queryset()
        campus_id = self.request.query_params.get("campus_id")
        if campus_id:
            qs = qs.filter(campus_id=campus_id)
        if hasattr(Classroom, "code"):
            return qs.order_by("campus__name", "code")
        return qs.order_by("campus__name", "id")
    
    def list(self, request, *args, **kwargs):
        return list_items(self.serializer_class, self.get_queryset())