from rest_framework import serializers
from .models import *

class MineduExportSerializer(serializers.ModelSerializer):
    class Meta:
        model = MineduExport
        fields = ['id','type','payload','status','tries','result','created_at','updated_at']

class MappingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Mapping
        fields = ['id','type','local_code','remote_code','label']

class IntegrationJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = IntegrationJob
        fields = ['id','type','cron','enabled','created_at']

class JobRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobRun
        fields = ['id','job','status','started_at','ended_at','meta']

class RunLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = RunLog
        fields = ['id','timestamp','level','message','meta']
