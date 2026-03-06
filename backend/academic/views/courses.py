"""
Vistas para manejo de Cursos globales
"""
from django.db.models import Q
from rest_framework.views import APIView
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication

from academic.models import Course


class CoursesListView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        q = (request.query_params.get("q") or "").strip()
        qs = Course.objects.all().order_by("code", "name")
        if q:
            qs = qs.filter(Q(code__icontains=q) | Q(name__icontains=q))

        items = list(qs.values("id", "code", "name", "credits")[:1000])
        return Response({"items": items})