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
    numDocumento = serializers.CharField(source="num_documento", required=False)
    apellidoPaterno = serializers.CharField(source="apellido_paterno", required=False, allow_blank=True)
    apellidoMaterno = serializers.CharField(source="apellido_materno", required=False, allow_blank=True)
    fechaNac = serializers.DateField(source="fecha_nac", required=False, allow_null=True)

    codigoModular = serializers.CharField(source="codigo_modular", required=False, allow_blank=True)
    nombreInstitucion = serializers.CharField(source="nombre_institucion", required=False, allow_blank=True)
    programaCarrera = serializers.CharField(source="programa_carrera", required=False, allow_blank=True)
    tipoDiscapacidad = serializers.CharField(source="tipo_discapacidad", required=False, allow_blank=True)

    userId = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    planId = serializers.IntegerField(source="plan_id", required=False, allow_null=True)

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

