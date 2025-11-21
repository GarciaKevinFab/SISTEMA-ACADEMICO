from rest_framework import serializers

from .models import (
    MineduExportBatch,
    MineduCatalogMapping,
    MineduJob,
    MineduJobRun,
    MineduJobLog,
)


class MineduExportBatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = MineduExportBatch
        fields = [
            "id",
            "data_type",
            "academic_year",
            "academic_period",
            "status",
            "total_records",
            "record_data",
            "created_at",
            "updated_at",
        ]


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
