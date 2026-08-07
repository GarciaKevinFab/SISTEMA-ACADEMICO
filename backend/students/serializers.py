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
    planId = serializers.SerializerMethodField()
    semestreLabel = serializers.SerializerMethodField()

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
            "photoUrl", "userId", "planId", "semestreLabel",
        ]

    def get_photoUrl(self, obj):
        request = self.context.get("request")
        if not obj.photo:
            return ""
        return request.build_absolute_uri(obj.photo.url) if request else obj.photo.url

    def get_userId(self, obj):
        return obj.user_id or ""

    def get_planId(self, obj):
        return obj.plan_id or ""

    def get_semestreLabel(self, obj):
        ciclo = obj.ciclo
        if not obj.plan_id:
            return f"Semestre {ciclo}" if ciclo else "—"

        total_semesters = obj.plan.semesters
        # Usar valor pre-calculado si existe (annotated desde la vista)
        all_approved = getattr(obj, '_all_plan_courses_approved', None)
        if all_approved is None:
            all_approved = self._check_all_approved(obj)
        if all_approved:
            return "Egresado"
        if ciclo:
            return f"Semestre {ciclo}"
        return "—"

    @staticmethod
    def _check_all_approved(student):
        """Verifica si el alumno aprobó TODOS los cursos de su plan."""
        from academic.models import PlanCourse, AcademicGradeRecord
        PASSING_GRADE = 11

        plan_courses = PlanCourse.objects.select_related("course").filter(plan_id=student.plan_id)
        if not plan_courses.exists():
            return False

        # Obtener mejores notas por curso
        recs = (
            AcademicGradeRecord.objects
            .filter(student=student)
            .values_list("course_id", "final_grade", "course__name")
        )
        best = {}
        for cid, fg, cname in recs:
            try:
                g = float(fg) if fg is not None else None
            except Exception:
                g = None
            prev = best.get(cid)
            if prev is None or (g is not None and (prev[0] is None or g > prev[0])):
                norm = (cname or "").strip().upper()
                best[cid] = (g, norm)

        approved_ids = set()
        approved_names = set()
        for cid, (g, nm) in best.items():
            if g is not None and g >= PASSING_GRADE:
                approved_ids.add(cid)
                if nm:
                    approved_names.add(nm)

        # Verificar que CADA curso del plan esté aprobado
        for pc in plan_courses:
            if pc.course_id in approved_ids:
                continue
            pc_name = (getattr(pc, "display_name", "") or getattr(pc.course, "name", "") or "").strip().upper()
            if pc_name and pc_name in approved_names:
                continue
            return False  # Al menos un curso NO aprobado
        return True



class StudentUpdateSerializer(serializers.ModelSerializer):
    numDocumento = serializers.CharField(source="num_documento", required=False, allow_blank=True)
    nombres = serializers.CharField(required=False, allow_blank=True)
    apellidoPaterno = serializers.CharField(source="apellido_paterno", required=False, allow_blank=True)
    apellidoMaterno = serializers.CharField(source="apellido_materno", required=False, allow_blank=True)
    fechaNac = serializers.DateField(source="fecha_nac", required=False, allow_null=True)
    sexo = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def validate_sexo(self, value):
        # Modelo tiene sexo=CharField(blank=True, default="") sin null → normalizar None → ""
        return (value or "").strip().upper()

    codigoModular = serializers.CharField(source="codigo_modular", required=False, allow_blank=True)
    nombreInstitucion = serializers.CharField(source="nombre_institucion", required=False, allow_blank=True)
    programaCarrera = serializers.CharField(source="programa_carrera", required=False, allow_blank=True)
    tipoDiscapacidad = serializers.CharField(source="tipo_discapacidad", required=False, allow_blank=True)

    region = serializers.CharField(required=False, allow_blank=True)
    provincia = serializers.CharField(required=False, allow_blank=True)
    distrito = serializers.CharField(required=False, allow_blank=True)
    gestion = serializers.CharField(required=False, allow_blank=True)
    tipo = serializers.CharField(required=False, allow_blank=True)
    turno = serializers.CharField(required=False, allow_blank=True)
    seccion = serializers.CharField(required=False, allow_blank=True)
    periodo = serializers.CharField(required=False, allow_blank=True)
    lengua = serializers.CharField(required=False, allow_blank=True)
    discapacidad = serializers.CharField(required=False, allow_blank=True)
    email = serializers.CharField(required=False, allow_blank=True)
    celular = serializers.CharField(required=False, allow_blank=True)

    userId = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    planId = serializers.IntegerField(source="plan_id", required=False, allow_null=True)

    # Estado académico especial (Licencia/Reincorporación/Traslado/Subsanación + RD)
    estadoAcademico = serializers.CharField(source="estado_academico", required=False, allow_blank=True)
    estadoRd = serializers.CharField(source="estado_rd", required=False, allow_blank=True)

    class Meta:
        model = Student
        fields = [
            "numDocumento", "nombres", "apellidoPaterno", "apellidoMaterno", "sexo", "fechaNac",
            "region", "provincia", "distrito",
            "codigoModular", "nombreInstitucion", "gestion", "tipo",
            "programaCarrera", "ciclo", "turno", "seccion", "periodo", "lengua",
            "discapacidad", "tipoDiscapacidad",
            "email", "celular",
            "userId", "planId",
            "estadoAcademico", "estadoRd",
        ]

    def validate_estado_academico(self, v):
        v = (v or "").strip().upper()
        validos = {"", "LICENCIA", "REINCORPORACION", "TRASLADO", "SUBSANACION"}
        if v not in validos:
            raise serializers.ValidationError(
                f"Estado inválido: {v!r}. Válidos: LICENCIA, REINCORPORACION, TRASLADO, SUBSANACION o vacío (normal).")
        return v

    def validate_num_documento(self, v):
        v = (v or "").strip()
        if v and len(v) > 12:
            raise serializers.ValidationError("Documento demasiado largo (máx 12).")
        # Verificar unicidad — funciona tanto en CREATE como en UPDATE
        if v:
            qs = Student.objects.filter(num_documento=v)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            dup = qs.first()
            if dup:
                full_name = (
                    f"{dup.apellido_paterno or ''} {dup.apellido_materno or ''} "
                    f"{dup.nombres or ''}"
                ).strip()
                raise serializers.ValidationError(
                    f"Ya existe un estudiante con DNI {v}: {full_name}. "
                    f"Búscalo en la lista para asignarle notas."
                )
        return v

    def validate(self, attrs):
        ciclo = attrs.get("ciclo")
        if ciclo is not None and ciclo < 0:
            raise serializers.ValidationError({"ciclo": "No puede ser negativo."})

        # Estado académico especial → RD obligatoria; volver a normal limpia la RD
        estado = attrs.get("estado_academico")
        if estado:
            rd = (attrs.get("estado_rd")
                  or (self.instance.estado_rd if self.instance else "")).strip()
            if not rd:
                raise serializers.ValidationError(
                    {"estadoRd": "La Resolución Directoral (RD) es obligatoria para este estado."})
        elif "estado_academico" in attrs:
            attrs["estado_rd"] = ""
        return attrs

    def create(self, validated_data):
        # Quitar campos write-only que no van al modelo
        user_id = validated_data.pop("userId", None)
        instance = Student.objects.create(**validated_data)
        if user_id is not None:
            instance.user_id = user_id
            instance.save(update_fields=["user"])
        return instance

    def update(self, instance, validated_data):
        user_id = validated_data.pop("userId", None)
        for k, v in validated_data.items():
            setattr(instance, k, v)
        if user_id is not None:
            instance.user_id = user_id
        instance.save()
        return instance



class StudentMeUpdateSerializer(serializers.ModelSerializer):
    """
    Autoedición del ALUMNO: SOLO datos de contacto (email y celular).

    Los datos personales (nombres, apellidos, documento, fecha de nacimiento,
    sexo, etc.) y académicos (ciclo, período, plan, sección…) están BLOQUEADOS:
    los gestiona la institución. El ciclo se actualiza automáticamente al
    confirmar la matrícula de cada período (no se edita a mano).
    Cualquier otro campo enviado en el PATCH se ignora.
    """
    email = serializers.CharField(required=False, allow_blank=True)
    celular = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Student
        fields = ["email", "celular"]

    def validate_celular(self, v):
        v = (v or "").strip()
        if len(v) > 30:
            raise serializers.ValidationError("Celular demasiado largo (máx 30).")
        return v

