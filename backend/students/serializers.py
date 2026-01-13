from rest_framework import serializers
from .models import Student

def _is_digits(s: str) -> bool:
    return s.isdigit() if isinstance(s, str) else False


class StudentSerializer(serializers.ModelSerializer):
    numDocumento = serializers.CharField(source="num_documento")
    apellidoPaterno = serializers.CharField(source="apellido_paterno")
    apellidoMaterno = serializers.CharField(source="apellido_materno")
    fechaNac = serializers.DateField(source="fecha_nac", allow_null=True, required=False)

    codigoModular = serializers.CharField(source="codigo_modular")
    nombreInstitucion = serializers.CharField(source="nombre_institucion")
    programaCarrera = serializers.CharField(source="programa_carrera")
    tipoDiscapacidad = serializers.CharField(source="tipo_discapacidad")

    photoUrl = serializers.SerializerMethodField()
    userId = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = [
            "id",
            "numDocumento", "nombres", "apellidoPaterno", "apellidoMaterno", "sexo", "fechaNac",
            "region", "provincia", "distrito",
            "codigoModular", "nombreInstitucion", "gestion", "tipo",
            "programaCarrera", "ciclo", "turno", "seccion", "periodo", "lengua",
            "discapacidad", "tipoDiscapacidad",
            "email", "celular",
            "photoUrl", "userId",
        ]

    def get_photoUrl(self, obj):
        request = self.context.get("request")
        if not obj.photo:
            return ""
        return request.build_absolute_uri(obj.photo.url) if request else obj.photo.url

    def get_userId(self, obj):
        return obj.user_id or ""



class StudentUpdateSerializer(serializers.ModelSerializer):
    numDocumento = serializers.CharField(source="num_documento", required=False)
    apellidoPaterno = serializers.CharField(source="apellido_paterno", required=False, allow_blank=True)
    apellidoMaterno = serializers.CharField(source="apellido_materno", required=False, allow_blank=True)
    fechaNac = serializers.DateField(source="fecha_nac", required=False, allow_null=True)

    codigoModular = serializers.CharField(source="codigo_modular", required=False, allow_blank=True)
    nombreInstitucion = serializers.CharField(source="nombre_institucion", required=False, allow_blank=True)
    programaCarrera = serializers.CharField(source="programa_carrera", required=False, allow_blank=True)
    tipoDiscapacidad = serializers.CharField(source="tipo_discapacidad", required=False, allow_blank=True)

    userId = serializers.IntegerField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = Student
        fields = [
            "numDocumento", "nombres", "apellidoPaterno", "apellidoMaterno", "sexo", "fechaNac",
            "region", "provincia", "distrito",
            "codigoModular", "nombreInstitucion", "gestion", "tipo",
            "programaCarrera", "ciclo", "turno", "seccion", "periodo", "lengua",
            "discapacidad", "tipoDiscapacidad",
            "email", "celular",
            "userId",
        ]

    def validate_num_documento(self, v):
        # Si quieres: validar que tenga dígitos (pero ojo: CE puede tener letras)
        if v and isinstance(v, str) and len(v) > 12:
            raise serializers.ValidationError("Num Documento demasiado largo.")
        return v

    def validate(self, attrs):
        ciclo = attrs.get("ciclo")
        if ciclo is not None and ciclo < 0:
            raise serializers.ValidationError({"ciclo": "No puede ser negativo."})
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
    class Meta:
        model = Student
        fields = ["email", "celular"]

