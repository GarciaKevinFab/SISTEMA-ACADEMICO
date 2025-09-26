from rest_framework import serializers
from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = (
        'timestamp','actor_id','actor_name','action','entity','entity_id',
        'summary','detail','ip','request_id'
        )