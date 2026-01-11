from rest_framework import serializers
from .models import Student


def _is_digits(s: str) -> bool:
    return s.isdigit() if isinstance(s, str) else False


class StudentSerializer(serializers.ModelSerializer):
    codigoEstudiante = serializers.CharField(source="codigo_estudiante")
    fechaNacimiento = serializers.DateField(source="fecha_nacimiento", allow_null=True, required=False)
    programaId = serializers.CharField(source="programa_id", allow_blank=True, required=False)
    cicloActual = serializers.IntegerField(source="ciclo_actual", allow_null=True, required=False)
    periodoIngreso = serializers.CharField(source="periodo_ingreso", allow_blank=True, required=False)

    apoderadoNombre = serializers.CharField(source="apoderado_nombre", allow_blank=True, required=False)
    apoderadoDni = serializers.CharField(source="apoderado_dni", allow_blank=True, required=False)
    apoderadoTelefono = serializers.CharField(source="apoderado_telefono", allow_blank=True, required=False)

    photoUrl = serializers.SerializerMethodField()
    userId = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = [
            "id",
            "codigoEstudiante", "dni",
            "nombres", "apellidos", "sexo", "fechaNacimiento",
            "email", "celular",
            "direccion", "departamento", "provincia", "distrito",
            "programaId", "cicloActual", "turno", "seccion", "periodoIngreso", "estado",
            "apoderadoNombre", "apoderadoDni", "apoderadoTelefono",
            "photoUrl",
            "userId",
        ]

    def get_photoUrl(self, obj):
        request = self.context.get("request")
        if not obj.photo:
            return ""
        # En prod, esto funciona si MEDIA_URL apunta a CDN/Nginx (o S3)
        return request.build_absolute_uri(obj.photo.url) if request else obj.photo.url

    def get_userId(self, obj):
        return obj.user_id or ""


class StudentUpdateSerializer(serializers.ModelSerializer):
    codigoEstudiante = serializers.CharField(source="codigo_estudiante", required=False)
    fechaNacimiento = serializers.DateField(source="fecha_nacimiento", allow_null=True, required=False)

    programaId = serializers.CharField(source="programa_id", allow_blank=True, required=False)
    cicloActual = serializers.IntegerField(source="ciclo_actual", allow_null=True, required=False)
    periodoIngreso = serializers.CharField(source="periodo_ingreso", allow_blank=True, required=False)

    apoderadoNombre = serializers.CharField(source="apoderado_nombre", allow_blank=True, required=False)
    apoderadoDni = serializers.CharField(source="apoderado_dni", allow_blank=True, required=False)
    apoderadoTelefono = serializers.CharField(source="apoderado_telefono", allow_blank=True, required=False)

    # opcional: admin puede setear el userId en PATCH
    userId = serializers.IntegerField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = Student
        fields = [
            "codigoEstudiante", "dni",
            "nombres", "apellidos", "sexo", "fechaNacimiento",
            "email", "celular",
            "direccion", "departamento", "provincia", "distrito",
            "programaId", "cicloActual", "turno", "seccion", "periodoIngreso", "estado",
            "apoderadoNombre", "apoderadoDni", "apoderadoTelefono",
            "userId",
        ]

    def validate_dni(self, v):
        if v and (not _is_digits(v) or len(v) not in (8, 9, 10, 11, 12)):
            raise serializers.ValidationError("DNI inválido.")
        return v

    def validate(self, attrs):
        ciclo = attrs.get("ciclo_actual")
        if ciclo is not None and ciclo < 0:
            raise serializers.ValidationError({"cicloActual": "No puede ser negativo."})
        return attrs

    def update(self, instance, validated_data):
        user_id = validated_data.pop("userId", None)
        for k, v in validated_data.items():
            setattr(instance, k, v)
        if user_id is not None:
            instance.user_id = user_id
        instance.save()
        return instance


class StudentMeUpdateSerializer(serializers.ModelSerializer):
    apoderadoNombre = serializers.CharField(source="apoderado_nombre", allow_blank=True, required=False)
    apoderadoDni = serializers.CharField(source="apoderado_dni", allow_blank=True, required=False)
    apoderadoTelefono = serializers.CharField(source="apoderado_telefono", allow_blank=True, required=False)

    class Meta:
        model = Student
        fields = [
            "email", "celular",
            "direccion", "departamento", "provincia", "distrito",
            "apoderadoNombre", "apoderadoDni", "apoderadoTelefono",
        ]
