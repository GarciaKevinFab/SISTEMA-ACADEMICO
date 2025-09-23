from django.shortcuts import render

# Create your views here.
# backend/accounts/views.py
from django.contrib.auth.models import User, Group
from django.db.models import Q
from django.utils.crypto import get_random_string
from rest_framework import viewsets, status, permissions, mixins
from rest_framework.decorators import action
from rest_framework.response import Response

from .serializers import UserSerializer, UserCreateSerializer, UserUpdateSerializer

class IsAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return request.user and request.user.is_authenticated
        return request.user and request.user.is_staff  # mutaciones solo admin

class UsersViewSet(viewsets.GenericViewSet,
                   mixins.ListModelMixin,
                   mixins.RetrieveModelMixin,
                   mixins.CreateModelMixin,
                   mixins.UpdateModelMixin):
    queryset = User.objects.all().order_by("id")
    permission_classes = [IsAdminOrReadOnly]

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        if self.action in ("update", "partial_update"):
            return UserUpdateSerializer
        return UserSerializer

    # /users/search?q=...
    @action(detail=False, methods=["get"], url_path="search")
    def search(self, request):
        q = request.query_params.get("q", "").strip()
        qs = self.get_queryset()
        if q:
            qs = qs.filter(
                Q(username__icontains=q) |
                Q(email__icontains=q) |
                Q(first_name__icontains=q) |
                Q(last_name__icontains=q)
            )
        page = self.paginate_queryset(qs)
        ser = UserSerializer(page or qs, many=True)
        return self.get_paginated_response(ser.data) if page is not None else Response(ser.data)

    # POST /users/:id/deactivate
    @action(detail=True, methods=["post"], url_path="deactivate")
    def deactivate(self, request, pk=None):
        user = self.get_object()
        user.is_active = False
        user.save(update_fields=["is_active"])
        return Response({"status": "deactivated"})

    # POST /users/:id/activate
    @action(detail=True, methods=["post"], url_path="activate")
    def activate(self, request, pk=None):
        user = self.get_object()
        user.is_active = True
        user.save(update_fields=["is_active"])
        return Response({"status": "activated"})

    # POST /users/:id/reset-password
    @action(detail=True, methods=["post"], url_path="reset-password")
    def reset_password(self, request, pk=None):
        user = self.get_object()
        tmp = get_random_string(10)
        user.set_password(tmp)
        user.save(update_fields=["password"])
        # Aquí podrías enviar email/SMS. Por ahora devolvemos el temporal para pruebas.
        return Response({"status": "password_reset", "temporary_password": tmp})

    # POST /users/:id/roles { "roles": ["Admin","Editor"] }
    @action(detail=True, methods=["post"], url_path="roles")
    def assign_roles(self, request, pk=None):
        roles = request.data.get("roles", [])
        if not isinstance(roles, list):
            return Response({"detail": "roles must be a list"}, status=400)
        user = self.get_object()
        groups = []
        for name in roles:
            grp, _ = Group.objects.get_or_create(name=str(name))
            groups.append(grp)
        user.groups.set(groups)
        user.save()
        return Response({"status": "roles_assigned", "roles": [g.name for g in user.groups.all()]})
