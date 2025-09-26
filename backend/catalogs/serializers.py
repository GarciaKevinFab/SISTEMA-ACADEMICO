from rest_framework import serializers
from .models import *

class PeriodSerializer(serializers.ModelSerializer):
    class Meta:
        model = Period
        fields = '__all__'

class CampusSerializer(serializers.ModelSerializer):
    class Meta:
        model = Campus
        fields = '__all__'

class ClassroomSerializer(serializers.ModelSerializer):
    class Meta:
        model = Classroom
        fields = '__all__'

class TeacherSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = Teacher
        fields = ['id', 'user', 'full_name']  # agrega otros que uses

    def get_full_name(self, obj):
        if obj.user:
            return f"{obj.user.last_name or ''} {obj.user.first_name or ''}".strip()
        return ""

class InstitutionSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = InstitutionSetting
        fields = ['id','data']

class MediaAssetSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    class Meta:
        model = MediaAsset
        fields = ['id','kind','file','url','uploaded_at']
    def get_url(self, obj):
        try:
            return obj.file.url
        except Exception:
            return None

class ImportJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImportJob
        fields = ['id','type','status','mapping','file','result','created_at']

class BackupExportSerializer(serializers.ModelSerializer):
    class Meta:
        model = BackupExport
        fields = ['id','scope','file','created_at']
