# backend/catalogs/serializers.py
from django.contrib.auth import get_user_model
from django.db import transaction, IntegrityError
from rest_framework import serializers

from .models import (
    Period, Campus, Classroom, Teacher,
    InstitutionSetting, MediaAsset, ImportJob, BackupExport
)

User = get_user_model()


# ------------------ Catálogos base ------------------
class PeriodSerializer(serializers.ModelSerializer):
    class Meta:
        model = Period
        fields = "__all__"


class CampusSerializer(serializers.ModelSerializer):
    class Meta:
        model = Campus
        fields = "__all__"


class ClassroomSerializer(serializers.ModelSerializer):
    """
    ✅ FIX 400:
    Frontend manda campus_id, el modelo tiene FK "campus".
    """
    campus_id = serializers.PrimaryKeyRelatedField(
        source="campus",
        queryset=Campus.objects.all(),
        write_only=True,
        required=True
    )

    class Meta:
        model = Classroom
        fields = ["id", "campus_id", "campus", "code", "name", "capacity"]
        read_only_fields = ["id", "campus"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["campus_id"] = instance.campus_id
        return data


# ------------------ Teacher ------------------
class TeacherSerializer(serializers.ModelSerializer):
    """
    Frontend envía:
    { document, full_name, email, phone, specialization }

    ✅ Arreglos:
    - full_name ahora ES el campo del modelo (se guarda en Teacher.full_name).
    - NO usamos first_name/last_name (tu User no los tiene).
    - display_name: Teacher.full_name > User.full_name/name > username/email.
    """
    display_name = serializers.SerializerMethodField(read_only=True)

    document = serializers.CharField(required=False, allow_blank=True)
    full_name = serializers.CharField(required=False, allow_blank=True)   # ✅ YA NO write_only
    email = serializers.EmailField(required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True)
    specialization = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Teacher
        fields = [
            "id",
            "user",
            "document",
            "full_name",
            "display_name",
            "email",
            "phone",
            "specialization",
        ]
        read_only_fields = ["id", "user", "display_name"]

    # ---------- helpers ----------
    def _user_field_names(self):
        return {f.name for f in User._meta.fields}

    def _username_field(self):
        return getattr(User, "USERNAME_FIELD", "username")

    def _build_user_kwargs(self, username_value: str, email: str, full_name: str):
        fields = self._user_field_names()
        uname_field = self._username_field()

        kwargs = {}

        # username/login field real
        if uname_field in fields:
            kwargs[uname_field] = username_value
        elif "username" in fields:
            kwargs["username"] = username_value

        if "email" in fields:
            kwargs["email"] = (email or "").strip().lower()

        # nombre (según tu User custom)
        if "full_name" in fields:
            kwargs["full_name"] = (full_name or "").strip()
        elif "name" in fields:
            kwargs["name"] = (full_name or "").strip()

        return kwargs

    def _get_or_create_user(self, username_value: str, email: str, full_name: str):
        uname_field = self._username_field()
        lookup = {uname_field: username_value}

        try:
            return User.objects.get(**lookup)
        except User.DoesNotExist:
            pass

        kwargs = self._build_user_kwargs(username_value, email, full_name)

        try:
            if hasattr(User.objects, "create_user"):
                # algunos managers exigen password -> intentamos ambas firmas
                try:
                    user = User.objects.create_user(**kwargs)
                except TypeError:
                    user = User.objects.create_user(**kwargs, password=None)
            else:
                user = User.objects.create(**kwargs)

            # por si tu create_user no lo hace
            user.set_unusable_password()
            user.save(update_fields=["password"])
            return user

        except IntegrityError:
            return User.objects.get(**lookup)

    # ---------- display ----------
    def get_display_name(self, obj):
        # primero lo que el frontend guarda en Teacher
        if (obj.full_name or "").strip():
            return obj.full_name.strip()

        # luego user si existe
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

        # fallback final
        return (obj.document or "").strip() or "Docente"

    # ---------- create / update ----------
    @transaction.atomic
    def create(self, validated_data):
        full_name = (validated_data.get("full_name", "") or "").strip()
        email = (validated_data.get("email", "") or "").strip().lower()
        document = (validated_data.get("document", "") or "").strip()

        # crea Teacher primero (porque tu modelo ya guarda full_name)
        teacher = Teacher.objects.create(**validated_data)

        # si quieres user automático, lo hacemos SOLO si hay email o documento
        username_value = email or document
        if username_value and teacher.user is None:
            user = self._get_or_create_user(username_value, email, full_name)
            teacher.user = user
            teacher.save(update_fields=["user"])

        return teacher

    @transaction.atomic
    def update(self, instance, validated_data):
        # actualiza Teacher
        for k, v in validated_data.items():
            setattr(instance, k, v)
        instance.save()

        # si tiene user, actualiza email/full_name si el user tiene esos campos
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
        model = InstitutionSetting
        fields = ["id", "data"]


# ------------------ MediaAsset ------------------
class MediaAssetSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = MediaAsset
        fields = ["id", "kind", "file", "url", "uploaded_at"]

    def get_url(self, obj):
        try:
            return obj.file.url
        except Exception:
            return None


# ------------------ ImportJob ------------------
class ImportJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImportJob
        fields = ["id", "type", "status", "mapping", "file", "result", "created_at"]


# ------------------ BackupExport ------------------
class BackupExportSerializer(serializers.ModelSerializer):
    size = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = BackupExport
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
