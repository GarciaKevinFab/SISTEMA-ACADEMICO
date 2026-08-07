from rest_framework import serializers
from .models import (
    MineduCode,
    MineduExportBatch,
    MineduCatalogMapping,
    MineduJob,
    MineduJobRun,
    MineduJobLog,
)


class MineduCodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = MineduCode
        fields = ["id", "type", "code", "label", "created_at", "updated_at"]


class MineduExportBatchSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = MineduExportBatch
        fields = [
            "id",
            "data_type",
            "export_format",
            "academic_year",
            "academic_period",
            "status",
            "total_records",
            "record_data",
            "file_url",
            "error_message",
            "created_at",
            "updated_at",
        ]

    def get_file_url(self, obj):
        if not obj.file:
            return None
        request = self.context.get("request")
        url = request.build_absolute_uri(obj.file.url) if request else obj.file.url
        # Detrás de Cloudflare/Nginx el esquema puede llegar como http si el
        # proxy no envía X-Forwarded-Proto; forzar https (salvo desarrollo
        # local) para evitar Mixed Content al descargar el archivo.
        if url.startswith("http://") and "localhost" not in url and "127.0.0.1" not in url:
            url = "https://" + url[len("http://"):]
        return url


class MineduCatalogMappingSerializer(serializers.ModelSerializer):
    class Meta:
        model = MineduCatalogMapping
        fields = ["id", "type", "local_id", "minedu_code", "created_at", "updated_at"]


class MineduJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = MineduJob
        fields = ["id", "type", "cron", "enabled", "last_run_at", "created_at", "updated_at"]


class MineduJobRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = MineduJobRun
        fields = ["id", "job", "started_at", "finished_at", "status", "meta", "created_at", "updated_at"]


class MineduJobLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = MineduJobLog
        fields = ["id", "run", "timestamp", "level", "message", "meta", "created_at", "updated_at"]