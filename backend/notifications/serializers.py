from rest_framework import serializers
from .models import *

class NotificationTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationTemplate
        fields = ['id','name','channel','email_subject','email_html','sms_text','in_app_text','is_active','meta','created_at','updated_at']

class EventBindingSerializer(serializers.ModelSerializer):
    template = NotificationTemplateSerializer(read_only=True)
    template_id = serializers.PrimaryKeyRelatedField(
        source='template', queryset=NotificationTemplate.objects.all(), write_only=True
    )
    class Meta:
        model = EventBinding
        fields = ['id','event_key','channel','template','template_id']

class NotificationLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationLog
        fields = ['id','event_key','channel','to','subject','payload','rendered','status','error','created_at']
