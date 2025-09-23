from rest_framework import serializers
from .models import ReportJob

class ReportJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReportJob
        fields = ['id','type','payload','status','file_path','error','created_at','updated_at']
