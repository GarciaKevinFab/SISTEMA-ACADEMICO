from rest_framework import serializers
from .models import Office, ProcedureType, Procedure, ProcedureEvent, ProcedureFile

class OfficeSer(serializers.ModelSerializer):
    class Meta:
        model = Office
        fields = ["id", "name"]

class ProcedureTypeSer(serializers.ModelSerializer):
    class Meta:
        model = ProcedureType
        fields = ["id","name","description","required_documents","processing_days","cost","is_active"]

class ProcedureFileSer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    filename = serializers.SerializerMethodField()

    class Meta:
        model = ProcedureFile
        fields = ["id","url","filename","original_name","doc_type","size"]

    def get_url(self, obj): return obj.file.url
    def get_filename(self, obj): return obj.original_name or obj.file.name.split("/")[-1]

class ProcedureEventSer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = ProcedureEvent
        fields = ["at","type","description","actor_name"]

    def get_actor_name(self, obj):
        u = obj.actor
        if not u: return None
        return getattr(u, "get_full_name", lambda: None)() or getattr(u, "username", None)

class ProcedureSer(serializers.ModelSerializer):
    procedure_type_name = serializers.CharField(source="procedure_type.name", read_only=True)
    current_office_name = serializers.CharField(source="current_office.name", read_only=True)
    assignee_name = serializers.SerializerMethodField()

    class Meta:
        model = Procedure
        fields = [
            "id","tracking_code","procedure_type","procedure_type_name",
            "applicant_name","applicant_document","applicant_email","applicant_phone",
            "description","status","current_office","current_office_name",
            "assignee","assignee_name","deadline_at","created_at","updated_at"
        ]

    def get_assignee_name(self, obj):
        u = obj.assignee
        if not u: return None
        return getattr(u, "get_full_name", lambda: None)() or getattr(u, "username", None)
