from rest_framework import serializers
from .models import Office, ProcedureType, Procedure, ProcedureEvent, ProcedureFile


class OfficeSer(serializers.ModelSerializer):
    head_name = serializers.SerializerMethodField()

    class Meta:
        model  = Office
        fields = ["id", "name", "description", "is_active", "head", "head_name"]

    def get_head_name(self, obj):
        u = obj.head
        if not u:
            return None
        return getattr(u, "get_full_name", lambda: None)() or getattr(u, "username", None)


class ProcedureTypeSer(serializers.ModelSerializer):
    class Meta:
        model  = ProcedureType
        fields = [
            "id", "name", "description", "required_documents",
            "processing_days", "cost", "is_active",
        ]


class ProcedureFileSer(serializers.ModelSerializer):
    url      = serializers.SerializerMethodField()
    filename = serializers.SerializerMethodField()

    class Meta:
        model  = ProcedureFile
        fields = ["id", "url", "filename", "original_name", "doc_type", "size"]

    def get_url(self, obj):
        request = self.context.get("request")
        if not obj.file:
            return None
        try:
            return request.build_absolute_uri(obj.file.url) if request else obj.file.url
        except Exception:
            return obj.file.url

    def get_filename(self, obj):
        return obj.original_name or obj.file.name.split("/")[-1]


class ProcedureEventSer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model  = ProcedureEvent
        fields = ["at", "type", "description", "actor_name"]

    def get_actor_name(self, obj):
        u = obj.actor
        if not u:
            return None
        return getattr(u, "get_full_name", lambda: None)() or getattr(u, "username", None)


class ProcedureSer(serializers.ModelSerializer):
    # Read-only computed fields
    procedure_type_name = serializers.CharField(source="procedure_type.name", read_only=True)
    current_office_name = serializers.CharField(source="current_office.name",  read_only=True)
    assignee_name       = serializers.SerializerMethodField()
    files_count         = serializers.SerializerMethodField()   # ← FIX #3

    class Meta:
        model  = Procedure
        fields = [
            "id", "tracking_code",
            "procedure_type", "procedure_type_name",
            "applicant_name", "applicant_document",
            "applicant_email", "applicant_phone",
            "description",
            "status", "urgency_level", "canal_ingreso",          # ← FIX #3: urgency_level
            "current_office", "current_office_name",
            "assignee", "assignee_name",
            "deadline_at", "files_count",                        # ← FIX #3: files_count
            "created_at", "updated_at",
        ]

    def get_assignee_name(self, obj):
        u = obj.assignee
        if not u:
            return None
        return getattr(u, "get_full_name", lambda: None)() or getattr(u, "username", None)

    def get_files_count(self, obj):
        """
        Usa el caché del prefetch_related cuando está disponible (evita N+1).
        Si el prefetch está activo, _prefetched_objects_cache contiene 'files'.
        """
        cache = getattr(obj, "_prefetched_objects_cache", {})
        if "files" in cache:
            return len(cache["files"])
        return obj.files.count()