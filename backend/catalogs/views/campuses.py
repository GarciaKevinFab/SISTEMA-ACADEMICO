"""
ViewSet para Sedes/Campus
"""
from rest_framework import viewsets, permissions

from catalogs.models import Campus
from catalogs.serializers import CampusSerializer
from .utils import list_items


class CampusesViewSet(viewsets.ModelViewSet):
    queryset = Campus.objects.all().order_by("name")
    serializer_class = CampusSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "post", "patch", "delete"]
    
    def list(self, request, *args, **kwargs):
        return list_items(self.serializer_class, self.get_queryset())