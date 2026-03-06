"""
Vistas para manejo de Aulas (Classrooms)
"""
from rest_framework import viewsets, permissions
from rest_framework_simplejwt.authentication import JWTAuthentication

from academic.models import Classroom
from academic.serializers import ClassroomSerializer
from .utils import ok


class ClassroomsViewSet(viewsets.ReadOnlyModelViewSet):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    queryset = Classroom.objects.all()
    serializer_class = ClassroomSerializer
    
    def list(self, request, *args, **kwargs):
        data = self.get_serializer(self.get_queryset(), many=True).data
        return ok(classrooms=data)