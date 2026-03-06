from rest_framework import serializers
from .models import Graduate, GradoTituloType


class GradoTituloTypeSerializer(serializers.ModelSerializer):
    """CRUD serializer para el catálogo de tipos de grado/título."""

    class Meta:
        model = GradoTituloType
        fields = [
            "id", "code", "name", "template", "diploma_label",
            "is_default", "is_active", "order",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class GraduatePublicSerializer(serializers.ModelSerializer):
    """Serializer público para resultados de búsqueda de egresados."""

    grado_titulo = serializers.SerializerMethodField()
    diploma_label = serializers.SerializerMethodField()
    fecha_sustentacion = serializers.SerializerMethodField()

    class Meta:
        model = Graduate
        fields = [
            "id",
            "dni",
            "apellidos_nombres",
            "grado_titulo",
            "diploma_label",
            "especialidad",
            "nivel",
            "anio_ingreso",
            "anio_egreso",
            "fecha_sustentacion",
            "resolucion_acta",
            "codigo_diploma",
            "registro_pedagogico",
        ]

    def get_grado_titulo(self, obj):
        return obj.grado_titulo_display

    def get_diploma_label(self, obj):
        return obj.diploma_label

    def get_fecha_sustentacion(self, obj):
        if obj.fecha_sustentacion:
            return obj.fecha_sustentacion.strftime("%d/%m/%Y")
        return None


class GraduateAdminSerializer(serializers.ModelSerializer):
    """Serializer admin con todos los campos."""

    grado_titulo_display = serializers.CharField(read_only=True)
    grado_titulo_type_name = serializers.SerializerMethodField()

    class Meta:
        model = Graduate
        fields = "__all__"

    def get_grado_titulo_type_name(self, obj):
        if obj.grado_titulo_type_id:
            return obj.grado_titulo_type.name
        return None