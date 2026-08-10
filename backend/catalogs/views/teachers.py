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
        """
        Directorio de docentes: registros del catálogo (Teacher) + usuarios
        con rol TEACHER que aún no tienen ficha en el directorio (así todos
        los docentes del sistema aparecen aquí, sin duplicados).
        Las cuentas administrativas nunca se muestran.
        """
        resp = list_items(self.serializer_class, self.get_queryset())
        try:
            items = resp.data.get("items") if isinstance(resp.data, dict) else None
            if items is None:
                return resp

            # ── Usuarios con rol docente ──
            # Los roles viven en DOS tablas según cómo se asignaron:
            #   · acl.UserRole (tabla acl_userrole)
            #   · User.roles   (M2M directa, tabla accounts_user_roles —
            #     es la que usa Administración → Usuarios)
            # Se consultan ambas.
            TEACHER_NAMES = ["TEACHER", "DOCENTE", "PROFESOR"]
            ADMIN_NAMES = ["ADMIN_SYSTEM", "ADMIN_ACADEMIC", "ADMIN_ACADEMICO", "REGISTRAR"]

            teacher_user_ids = set(
                UserRole.objects
                .filter(role__name__in=TEACHER_NAMES)
                .values_list("user_id", flat=True)
            ) | set(
                User.objects
                .filter(roles__name__in=TEACHER_NAMES)
                .values_list("id", flat=True)
            )
            admin_role_user_ids = set(
                UserRole.objects
                .filter(role__name__in=ADMIN_NAMES)
                .values_list("user_id", flat=True)
            ) | set(
                User.objects
                .filter(roles__name__in=ADMIN_NAMES)
                .values_list("id", flat=True)
            )

            def _es_cuenta_admin(u):
                if getattr(u, "is_staff", False) or getattr(u, "is_superuser", False):
                    return True
                if ((getattr(u, "username", "") or "").upper()).startswith("ADMIN"):
                    return True
                return u.id in admin_role_user_ids

            def _nombre(u):
                for attr in ("full_name", "get_full_name"):
                    v = getattr(u, attr, None)
                    if callable(v):
                        v = v()
                    if v and str(v).strip():
                        return str(v).strip()
                fn = f"{getattr(u, 'first_name', '')} {getattr(u, 'last_name', '')}".strip()
                return fn or (getattr(u, "username", "") or f"Usuario {u.id}")

            linked_users = {t.get("user") for t in items if t.get("user")}
            emails = {(t.get("email") or "").strip().lower() for t in items if t.get("email")}
            docs = {(t.get("document") or "").strip() for t in items if t.get("document")}

            q = (request.query_params.get("q") or "").strip().lower()
            extra = []
            for u in User.objects.filter(id__in=teacher_user_ids, is_active=True):
                if u.id in linked_users or _es_cuenta_admin(u):
                    continue
                mail = (getattr(u, "email", "") or "").strip().lower()
                uname = (getattr(u, "username", "") or "").strip()
                # Dedup: si ya existe ficha con el mismo correo o documento
                if (mail and mail in emails) or (uname and uname in docs):
                    continue
                full = _nombre(u)
                if q and q not in full.lower() and q not in mail and q not in uname.lower():
                    continue
                extra.append({
                    "id": f"user-{u.id}",
                    "user": u.id,
                    "document": uname,
                    "full_name": full,
                    "display_name": full,
                    "email": mail,
                    "phone": "",
                    "specialization": "",
                    "courses": [],
                    "source": "user",   # cuenta de usuario sin ficha del directorio
                })

            if extra:
                items.extend(extra)
                # `clave_orden`: alfabético español (la Ñ entre la N y la O)
                from students.name_utils import clave_orden
                items.sort(key=lambda t: clave_orden(t.get("full_name") or ""))
                resp.data["items"] = items
        except Exception as exc:
            # El merge nunca debe romper el listado base, pero sí dejar rastro
            import logging
            logging.getLogger("catalogs").warning(
                f"Directorio docentes: fallo al combinar usuarios TEACHER: {exc}",
                exc_info=True,
            )
        return resp
    
    def create(self, request, *args, **kwargs):
        """Crea Teacher + User + rol TEACHER (o reutiliza User existente)."""
        from django.db import IntegrityError
        teacher_role, _ = Role.objects.get_or_create(name="TEACHER")

        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        document = (data.get("document", "") or "").strip()
        full_name = (data.get("full_name", "") or "").strip()
        req_email = (data.get("email", "") or "").strip().lower()

        # ── 1) Si YA existe un User con ese email o con username=document,
        #        lo reutilizamos y solo creamos/actualizamos el Teacher.
        existing = None
        if req_email:
            existing = User.objects.filter(email__iexact=req_email).first()
        if not existing and document:
            existing = User.objects.filter(username=document).first()

        temp_password = None
        if existing:
            user = existing
            # Si ese User ya tiene un Teacher, actualizamos en vez de duplicar
            existing_teacher = Teacher.objects.filter(user=user).first()
            if existing_teacher:
                return Response(
                    {"detail": f"Este usuario ({user.username}) ya tiene una ficha docente. "
                               f"Edítala desde la lista en vez de crear una nueva.",
                     "existing_teacher_id": existing_teacher.id},
                    status=409,
                )
            # Asegurar rol TEACHER
            try:
                user.roles.add(teacher_role)
            except Exception:
                UserRole.objects.get_or_create(user=user, role=teacher_role)
        else:
            # ── 2) Crear un User nuevo (username único garantizado) ──
            username_base = document or (
                full_name.split()[0] if full_name else "teacher"
            )
            username = username_base
            k = 1
            while User.objects.filter(username=username).exists():
                k += 1
                username = f"{username_base}-{k}"

            temp_password = get_random_string(12)
            email = req_email or f"{username}@no-email.local"

            # Email único a nivel de User; si choca, generar sintético
            if User.objects.filter(email__iexact=email).exists():
                email = f"{username}@no-email.local"

            try:
                user = User.objects.create_user(
                    username=username,
                    password=temp_password,
                    email=email,
                    full_name=full_name,
                )
            except IntegrityError as e:
                return Response(
                    {"detail": f"No se pudo crear el usuario del docente: {e}"},
                    status=400,
                )

            if hasattr(user, "must_change_password"):
                user.must_change_password = True
                user.save(update_fields=["must_change_password"])

            try:
                user.roles.add(teacher_role)
            except Exception:
                UserRole.objects.get_or_create(user=user, role=teacher_role)

        # ── 3) Crear Teacher (o error si ya existe con mismo user) ──
        try:
            teacher = ser.save(user=user)
        except IntegrityError as e:
            return Response(
                {"detail": f"Ya existe un docente vinculado a ese usuario: {e}"},
                status=409,
            )

        # ── 4) Cursos M2M ──
        courses = data.get("courses", [])
        if courses is not None and hasattr(teacher, "courses"):
            teacher.courses.set(courses or [])

        out = self.get_serializer(teacher).data
        out["username"] = user.username
        if temp_password:
            out["temporary_password"] = temp_password
            out["must_change_password"] = True
        return Response(out, status=201)