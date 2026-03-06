# backend/catalogs/serializers.py
from django.contrib.auth import get_user_model
from django.db import transaction, IntegrityError
from rest_framework import serializers
from catalogs.models import Campus, Classroom
from academic.models import Course
from .models import (
    Period, Campus, Classroom, Teacher,
    InstitutionSetting, MediaAsset, ImportJob, BackupExport
)

User = get_user_model()


# ------------------ Catálogos base ------------------
class PeriodSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Period
        fields = "__all__"


class CampusSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Campus
        fields = "__all__"


class ClassroomSerializer(serializers.ModelSerializer):
    """
    Serializer para crear/editar aulas desde el panel de catálogos.
    Expone code y name como campos separados (sin aliases).
    """
    campus_id = serializers.PrimaryKeyRelatedField(
        source="campus",
        queryset=Campus.objects.all(),
        write_only=True,
        required=True,
    )
    campus = CampusSerializer(read_only=True)

    class Meta:
        model        = Classroom
        fields       = ["id", "campus_id", "campus", "code", "name", "capacity"]
        read_only_fields = ["id", "campus"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["campus_id"] = instance.campus_id
        return data


# ------------------ Teacher ------------------
class TeacherSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField(read_only=True)

    courses = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Course.objects.all(),
        required=False,
    )

    class Meta:
        model  = Teacher
        fields = [
            "id",
            "user",
            "document",
            "full_name",
            "display_name",
            "email",
            "phone",
            "specialization",
            "courses",
        ]
        read_only_fields = ["id", "user", "display_name"]

    # ── helpers ────────────────────────────────────────────────────────────────

    def _user_field_names(self):
        return {f.name for f in User._meta.fields}

    def _username_field(self):
        return getattr(User, "USERNAME_FIELD", "username")

    def _build_user_kwargs(self, username_value: str, email: str, full_name: str):
        fields      = self._user_field_names()
        uname_field = self._username_field()
        kwargs      = {}

        if uname_field in fields:
            kwargs[uname_field] = username_value
        elif "username" in fields:
            kwargs["username"] = username_value

        if "email" in fields:
            kwargs["email"] = (email or "").strip().lower()

        if "full_name" in fields:
            kwargs["full_name"] = (full_name or "").strip()
        elif "name" in fields:
            kwargs["name"] = (full_name or "").strip()

        return kwargs

    def _get_or_create_user(self, username_value: str, email: str, full_name: str):
        uname_field = self._username_field()
        lookup      = {uname_field: username_value}

        try:
            return User.objects.get(**lookup)
        except User.DoesNotExist:
            pass

        kwargs = self._build_user_kwargs(username_value, email, full_name)

        try:
            if hasattr(User.objects, "create_user"):
                try:
                    user = User.objects.create_user(**kwargs)
                except TypeError:
                    user = User.objects.create_user(**kwargs, password=None)
            else:
                user = User.objects.create(**kwargs)

            user.set_unusable_password()
            user.save(update_fields=["password"])
            return user

        except IntegrityError:
            return User.objects.get(**lookup)

    # ── display ────────────────────────────────────────────────────────────────

    def get_display_name(self, obj):
        if (obj.full_name or "").strip():
            return obj.full_name.strip()

        u = getattr(obj, "user", None)
        if u:
            if hasattr(u, "full_name") and (u.full_name or "").strip():
                return u.full_name.strip()
            if hasattr(u, "name") and (u.name or "").strip():
                return u.name.strip()
            if hasattr(u, "username") and (u.username or "").strip():
                return u.username.strip()
            if hasattr(u, "email") and (u.email or "").strip():
                return u.email.strip()

        return (obj.document or "").strip() or "Docente"

    # ── create / update ────────────────────────────────────────────────────────
    # FIX: estos métodos estaban a nivel de módulo (indentación incorrecta),
    # por eso Django usaba el create() base de ModelSerializer y nunca
    # ejecutaba la lógica de creación de usuario ni de M2M.
    # Al moverlos dentro de la clase queda todo operativo.

    @transaction.atomic
    def create(self, validated_data):
        # Sacar M2M antes del create
        courses = validated_data.pop("courses", [])

        full_name = (validated_data.get("full_name", "") or "").strip()
        email     = (validated_data.get("email",     "") or "").strip().lower()
        document  = (validated_data.get("document",  "") or "").strip()

        # Crear Teacher sin relaciones M2M
        teacher = Teacher.objects.create(**validated_data)

        # Asignar cursos si el campo existe
        if hasattr(teacher, "courses"):
            teacher.courses.set(courses or [])

        # Crear/adjuntar User si corresponde
        username_value = email or document
        if username_value and teacher.user is None:
            user         = self._get_or_create_user(username_value, email, full_name)
            teacher.user = user
            teacher.save(update_fields=["user"])

        return teacher

    @transaction.atomic
    def update(self, instance, validated_data):
        # Manejar M2M aparte
        courses = validated_data.pop("courses", None)

        # Actualizar campos normales
        for k, v in validated_data.items():
            setattr(instance, k, v)
        instance.save()

        # Actualizar M2M si vino en el payload
        if courses is not None and hasattr(instance, "courses"):
            instance.courses.set(courses or [])

        # Si tiene user, sincronizar email/full_name
        u = getattr(instance, "user", None)
        if u:
            fields = self._user_field_names()

            if "email" in validated_data and "email" in fields:
                u.email = (validated_data.get("email") or "").strip().lower()

            if "full_name" in validated_data:
                fn = (validated_data.get("full_name") or "").strip()
                if "full_name" in fields:
                    u.full_name = fn
                elif "name" in fields:
                    u.name = fn

            u.save()

        return instance


# ------------------ InstitutionSetting ------------------
class InstitutionSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model  = InstitutionSetting
        fields = ["id", "data"]


# ------------------ MediaAsset ------------------
class MediaAssetSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model  = MediaAsset
        fields = ["id", "kind", "file", "url", "uploaded_at"]

    def get_url(self, obj):
        try:
            return obj.file.url
        except Exception:
            return None


# ------------------ ImportJob ------------------
class ImportJobSerializer(serializers.ModelSerializer):
    class Meta:
        model  = ImportJob
        fields = ["id", "type", "status", "mapping", "file", "result", "created_at"]


# ------------------ BackupExport ------------------
class BackupExportSerializer(serializers.ModelSerializer):
    size     = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()

    class Meta:
        model  = BackupExport
        fields = ["id", "scope", "file_url", "created_at", "size"]

    def get_size(self, obj):
        try:
            return obj.file.size if obj.file else None
        except Exception:
            return None

    def get_file_url(self, obj):
        try:
            return obj.file.url if obj.file else None
        except Exception:
            return None