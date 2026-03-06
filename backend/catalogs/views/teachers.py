"""
ViewSet para Docentes
"""
from django.db.models import Q
from django.utils.crypto import get_random_string
from django.contrib.auth import get_user_model
from rest_framework import viewsets, permissions
from rest_framework.response import Response

from catalogs.models import Teacher
from catalogs.serializers import TeacherSerializer
from acl.models import Role, UserRole
from .utils import list_items

User = get_user_model()


class TeachersViewSet(viewsets.ModelViewSet):
    queryset = Teacher.objects.select_related("user").all()
    serializer_class = TeacherSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "post", "patch", "delete"]
    
    def get_queryset(self):
        qs = super().get_queryset()
        q = (self.request.query_params.get("q") or "").strip()
        if q:
            cond = Q()
            if hasattr(Teacher, "document"):
                cond |= Q(document__icontains=q)
            if hasattr(Teacher, "email"):
                cond |= Q(email__icontains=q)
            if hasattr(Teacher, "phone"):
                cond |= Q(phone__icontains=q)
            if hasattr(Teacher, "specialization"):
                cond |= Q(specialization__icontains=q)
            cond |= (
                Q(user__full_name__icontains=q) | 
                Q(user__username__icontains=q) | 
                Q(user__email__icontains=q)
            )
            qs = qs.filter(cond)
        return qs.order_by("user__full_name", "user__username", "id")
    
    def list(self, request, *args, **kwargs):
        return list_items(self.serializer_class, self.get_queryset())
    
    def create(self, request, *args, **kwargs):
        """Crea Teacher + User + rol TEACHER"""
        teacher_role, _ = Role.objects.get_or_create(name="TEACHER")
        
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        
        # Username base
        username_base = (data.get("document", "") or "").strip() or (
            data.get("full_name", "").split()[0] 
            if (data.get("full_name") or "").strip() 
            else "teacher"
        )
        username = username_base
        k = 1
        while User.objects.filter(username=username).exists():
            k += 1
            username = f"{username_base}-{k}"
        
        # Password temporal
        temp_password = get_random_string(12)
        
        # Email fallback
        email = (data.get("email", "") or "").strip().lower()
        if not email:
            email = f"{username}@no-email.local"
        
        # Crear user
        user = User.objects.create_user(
            username=username,
            password=temp_password,
            email=email,
            full_name=data.get("full_name", "") or "",
        )
        
        # Flag must_change_password
        if hasattr(user, "must_change_password"):
            user.must_change_password = True
            user.save(update_fields=["must_change_password"])
        
        # Asignar rol TEACHER
        try:
            user.roles.add(teacher_role)
        except Exception:
            UserRole.objects.get_or_create(user=user, role=teacher_role)
        
        # Crear Teacher
        teacher = ser.save(user=user)
        
        # Asignar cursos (ManyToMany)
        courses = data.get("courses", [])
        if courses is not None and hasattr(teacher, "courses"):
            teacher.courses.set(courses or [])
        
        out = self.get_serializer(teacher).data
        out["username"] = user.username
        out["temporary_password"] = temp_password
        out["must_change_password"] = True
        
        return Response(out, status=201)