from rest_framework import serializers
from .models import *

class OfficeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Office
        fields = ['id','name','acronym','is_active']

class ProcedureTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProcedureType
        fields = ['id','name','code','is_active','meta']

class ProcedureFileSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    class Meta:
        model = ProcedureFile
        fields = ['id','doc_type','description','url','uploaded_at']
    def get_url(self, obj):
        try: return obj.file.url
        except: return None

class ProcedureNoteSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    class Meta:
        model = ProcedureNote
        fields = ['id','note','author','author_name','created_at']
    def get_author_name(self, obj):
        return getattr(obj.author, 'username', None)

class ProcedureRouteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProcedureRoute
        fields = ['id','from_office','to_office','assignee','note','deadline_at','created_at']

class ProcedureSerializer(serializers.ModelSerializer):
    files = ProcedureFileSerializer(many=True, read_only=True)
    class Meta:
        model = Procedure
        fields = ['id','tracking_code','code','type','subject','applicant_name','applicant_doc',
                  'applicant_email','office','assignee','status','created_at','deadline_at','meta','files']
