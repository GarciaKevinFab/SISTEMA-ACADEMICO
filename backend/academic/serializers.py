# backend/academic/serializers.py
from datetime import datetime
from rest_framework import serializers

from catalogs.models import Career  # ✅ Career único
from .models import (
    Course, Plan, PlanCourse, CoursePrereq,
    Classroom, Teacher, Section, SectionScheduleSlot,
    AcademicPeriod, Syllabus, EvaluationConfig,
    AttendanceSession, AttendanceRow, AcademicProcess, ProcessFile,
    AcademicGradeRecord
)


import re

DAY_TO_INT = {"MON": 1, "TUE": 2, "WED": 3, "THU": 4, "FRI": 5, "SAT": 6, "SUN": 7}
INT_TO_DAY = {v: k for k, v in DAY_TO_INT.items()}

# Palabras que deben permanecer en minúsculas (preposiciones/artículos en español)
_LOWERCASE_WORDS = {
    "de", "del", "la", "las", "los", "el", "en", "y", "e", "o", "u",
    "a", "con", "por", "para", "al", "su", "sus",
}

# Regex para detectar números romanos (I, II, III, IV, V, ... XXX)
_ROMAN_RE = re.compile(
    r'^(XXX|XX[IVX]?|X[IVX]{0,3}|V?I{0,3}|IV|IX|VI{0,3})$',
    re.IGNORECASE,
)


def smart_title(name: str) -> str:
    """
    Capitaliza correctamente un nombre de curso en español.
    - Primera palabra siempre capitalizada
    - Preposiciones/artículos en minúsculas (excepto al inicio)
    - Números romanos en MAYÚSCULAS (II, III, IV, XXI, etc.)
    """
    if not name:
        return name
    words = name.split()
    result = []
    for i, w in enumerate(words):
        upper = w.upper()
        # Números romanos → MAYÚSCULAS
        if _ROMAN_RE.match(w) and len(w) <= 4:
            result.append(upper)
        # Primera palabra siempre capitalizada
        elif i == 0:
            result.append(w.capitalize())
        # Preposiciones en minúsculas
        elif w.lower() in _LOWERCASE_WORDS:
            result.append(w.lower())
        else:
            result.append(w.capitalize())
    return " ".join(result)


# ───────────────────────── Helpers ─────────────────────────
def safe_full_name(user) -> str:
    if not user:
        return ""
    if hasattr(user, "get_full_name"):
        try:
            fn = (user.get_full_name() or "").strip()
            if fn:
                return fn
        except Exception:
            pass
    for attr in ("full_name", "name"):
        if hasattr(user, attr):
            val = (getattr(user, attr) or "").strip()
            if val:
                return val
    first = (getattr(user, "first_name", "") or "").strip()
    last  = (getattr(user, "last_name",  "") or "").strip()
    if first or last:
        return f"{first} {last}".strip()
    return (getattr(user, "username", "") or getattr(user, "email", "") or f"User {getattr(user, 'id', '')}").strip()


def _parse_hhmm(value: str):
    if value is None:
        raise serializers.ValidationError("Hora requerida")
    s = str(value).strip()
    for fmt in ("%H:%M", "%H:%M:%S"):
        try:
            return datetime.strptime(s, fmt).time()
        except Exception:
            pass
    raise serializers.ValidationError("Formato de hora inválido (usa HH:MM)")


# ───────────────────────── Básicos ─────────────────────────
class CareerSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Career
        fields = "__all__"


class CourseSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Course
        fields = "__all__"


# ───────────────────────── Plan ─────────────────────────
class PlanSerializer(serializers.ModelSerializer):
    career_id   = serializers.IntegerField(source="career.id",   read_only=True)
    career_name = serializers.CharField(   source="career.name", read_only=True)

    class Meta:
        model  = Plan
        fields = [
            "id", "name",
            "career", "career_id", "career_name",
            "start_year", "end_year",
            "semesters", "description",
        ]


class PlanCreateSerializer(serializers.ModelSerializer):
    career_id = serializers.IntegerField(write_only=True)

    class Meta:
        model  = Plan
        fields = ["id", "name", "career_id", "start_year", "end_year", "semesters", "description"]

    def _career_from_id(self, cid: int):
        career = Career.objects.filter(id=cid).first()
        if not career:
            raise serializers.ValidationError({"career_id": "Carrera no existe en catálogos."})
        return career

    def validate(self, attrs):
        instance   = getattr(self, "instance", None)
        cid        = attrs.get("career_id",  instance.career_id  if instance else None)
        start_year = attrs.get("start_year", instance.start_year if instance else None)
        end_year   = attrs.get("end_year",   getattr(instance, "end_year", None) if instance else None)
        if cid is None or start_year is None or end_year is None:
            raise serializers.ValidationError({"end_year": "end_year es requerido."})
        qs = Plan.objects.filter(career_id=cid, start_year=start_year, end_year=end_year, is_deleted=False)
        if instance:
            qs = qs.exclude(id=instance.id)
        if qs.exists():
            raise serializers.ValidationError({
                "non_field_errors": [f"Ya existe un plan para esa carrera con el rango {start_year}-{end_year}."]
            })
        return attrs

    def create(self, validated_data):
        cid    = validated_data.pop("career_id")
        career = self._career_from_id(cid)
        return Plan.objects.create(career=career, is_deleted=False, **validated_data)

    def update(self, instance, validated_data):
        cid = validated_data.pop("career_id", None)
        if cid is not None:
            instance.career = self._career_from_id(cid)
        for k, v in validated_data.items():
            setattr(instance, k, v)
        instance.save()
        return instance


# ───────────────────────── Cursos de un plan ─────────────────────────
class PlanCourseOutSerializer(serializers.ModelSerializer):
    code          = serializers.SerializerMethodField()
    name          = serializers.SerializerMethodField()
    credits       = serializers.IntegerField(read_only=True)
    prerequisites = serializers.SerializerMethodField()

    class Meta:
        model  = PlanCourse
        fields = ["id", "code", "name", "credits", "semester", "weekly_hours", "type", "prerequisites"]

    def get_code(self, obj):
        return (getattr(obj, "display_code", "") or "").strip() or obj.course.code

    def get_name(self, obj):
        return (getattr(obj, "display_name", "") or "").strip() or obj.course.name

    def get_prerequisites(self, obj):
        ids = CoursePrereq.objects.filter(plan_course=obj).values_list("prerequisite_id", flat=True)
        return [{"id": i} for i in ids]


class PlanCourseCreateSerializer(serializers.Serializer):
    code         = serializers.CharField()
    name         = serializers.CharField()
    credits      = serializers.IntegerField(required=False, default=3, min_value=0)
    weekly_hours = serializers.IntegerField(required=False, default=3, min_value=0)
    semester     = serializers.IntegerField(required=False, default=1, min_value=1)
    type         = serializers.ChoiceField(choices=["MANDATORY", "ELECTIVE"], required=False, default="MANDATORY")

    def validate(self, attrs):
        attrs["code"] = (attrs.get("code") or "").strip()
        attrs["name"] = (attrs.get("name") or "").strip()
        if not attrs["code"]:
            raise serializers.ValidationError({"code": "code requerido"})
        if not attrs["name"]:
            raise serializers.ValidationError({"name": "name requerido"})
        return attrs


# ───────────────────────── Teachers / Classrooms ─────────────────────────
class TeacherSerializer(serializers.ModelSerializer):
    full_name    = serializers.SerializerMethodField()
    display_name = serializers.SerializerMethodField()

    class Meta:
        model  = Teacher
        fields = ["id", "user", "full_name", "display_name"]

    def get_full_name(self, obj):
        # Prioriza el campo propio del Teacher (catalogs.Teacher tiene full_name)
        own = (getattr(obj, "full_name", "") or "").strip()
        if own:
            return own
        if not obj.user:
            return f"Teacher #{obj.id}"
        return safe_full_name(obj.user) or f"Teacher #{obj.id}"

    def get_display_name(self, obj):
        return self.get_full_name(obj)


class ClassroomSerializer(serializers.ModelSerializer):
    """
    FIX: se eliminó `name = serializers.CharField(source="code")`.

    Antes ese alias hacía que tanto `name` como `code` tuvieran el mismo
    valor (el código del aula), generando entradas duplicadas en el select:
        "TARM-01-A-101 · TARM-01-A-101 (cap. 30)"

    Ahora se exponen los campos reales del modelo sin aliases.
    El campo `display_label` construye la etiqueta correcta para el frontend:
        "Código · Nombre (cap. N)"  →  cuando code ≠ name
        "Nombre (cap. N)"           →  cuando son iguales o uno está vacío
    """
    display_label = serializers.SerializerMethodField()

    class Meta:
        model  = Classroom
        fields = ["id", "code", "capacity", "display_label"]

    def get_display_label(self, obj):
        code = (obj.code or "").strip()
        cap  = getattr(obj, "capacity", None)
        base = code or f"Aula #{obj.pk}"
        return f"{base} (cap. {cap})" if cap else base


# ───────────────────────── Sections ─────────────────────────
class SlotOutSerializer(serializers.ModelSerializer):
    class Meta:
        model  = SectionScheduleSlot
        fields = ["weekday", "start", "end"]


class SectionOutSerializer(serializers.ModelSerializer):
    course_code  = serializers.SerializerMethodField()
    course_name  = serializers.SerializerMethodField()
    plan_id      = serializers.IntegerField(source="plan_course.plan.id",         read_only=True)
    plan_name    = serializers.CharField(   source="plan_course.plan.name",        read_only=True)
    career_name  = serializers.CharField(   source="plan_course.plan.career.name", read_only=True)
    section_code = serializers.CharField(   source="label",                        read_only=True)

    teacher_id   = serializers.SerializerMethodField()
    teacher_name = serializers.SerializerMethodField()

    room_id   = serializers.IntegerField(source="classroom.id", read_only=True)
    # FIX: antes era source="classroom.code" → solo mostraba el código en la tabla
    room_name = serializers.SerializerMethodField()

    slots = serializers.SerializerMethodField()

    class Meta:
        model  = Section
        fields = [
            "id",
            "course_code", "course_name",
            "plan_id", "plan_name", "career_name",
            "section_code",
            "teacher_id", "teacher_name",
            "room_id", "room_name",
            "capacity", "period",
            "label",
            "slots",
        ]

    def get_course_code(self, obj):
        pc = getattr(obj, "plan_course", None)
        if not pc:
            return ""
        return pc.display_code or (pc.course.code if pc.course_id else "")

    def get_course_name(self, obj):
        pc = getattr(obj, "plan_course", None)
        if not pc:
            return ""
        raw = pc.display_name or (pc.course.name if pc.course_id else "")
        return smart_title(raw)

    def get_teacher_id(self, obj):
        if not obj.teacher or not obj.teacher.user:
            return None
        return obj.teacher.user.id

    def get_teacher_name(self, obj):
        if not obj.teacher:
            return ""
        # Prioriza campo propio del Teacher
        own = (getattr(obj.teacher, "full_name", "") or "").strip()
        if own:
            return own
        return safe_full_name(getattr(obj.teacher, "user", None)) or f"Teacher #{obj.teacher.id}"

    def get_room_name(self, obj):
        """El modelo academic.Classroom solo tiene 'code', no 'name'."""
        if not obj.classroom:
            return ""
        return (obj.classroom.code or "").strip() or f"Aula #{obj.classroom.pk}"

    def get_slots(self, obj):
        out = []
        for s in obj.schedule_slots.all().order_by("weekday", "start"):
            out.append({
                "day":   INT_TO_DAY.get(s.weekday, str(s.weekday)),
                "start": str(s.start)[:5],
                "end":   str(s.end)[:5],
            })
        return out


class SlotInSerializer(serializers.Serializer):
    day   = serializers.ChoiceField(choices=list(DAY_TO_INT.keys()))
    start = serializers.CharField()
    end   = serializers.CharField()

    def validate(self, attrs):
        st = _parse_hhmm(attrs.get("start"))
        en = _parse_hhmm(attrs.get("end"))
        if st >= en:
            raise serializers.ValidationError("start debe ser menor que end")
        attrs["_start_time"] = st
        attrs["_end_time"]   = en
        return attrs


class SectionCreateUpdateSerializer(serializers.Serializer):
    course_id  = serializers.IntegerField()
    teacher_id = serializers.IntegerField(required=False, allow_null=True)
    room_id    = serializers.IntegerField(required=False, allow_null=True)
    capacity   = serializers.IntegerField(required=False, min_value=1)
    period     = serializers.CharField(required=False, allow_blank=True)
    label      = serializers.CharField(required=False, allow_blank=True)
    slots      = SlotInSerializer(many=True, required=False)

    def validate_slots(self, slots):
        by_day = {}
        for s in slots:
            d = s["day"]
            by_day.setdefault(d, []).append(s)
        for d, items in by_day.items():
            seen = set()
            for it in items:
                key = (d, it["_start_time"], it["_end_time"])
                if key in seen:
                    raise serializers.ValidationError(f"Horario duplicado en {d}")
                seen.add(key)
            items_sorted = sorted(items, key=lambda x: x["_start_time"])
            for i in range(len(items_sorted) - 1):
                cur = items_sorted[i]
                nxt = items_sorted[i + 1]
                if cur["_end_time"] > nxt["_start_time"]:
                    raise serializers.ValidationError(f"Solapamiento de horarios en {d}")
        return slots


# ───────────────────────── Otros ─────────────────────────
class AcademicPeriodSerializer(serializers.ModelSerializer):
    class Meta:
        model  = AcademicPeriod
        fields = "__all__"


class SyllabusSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Syllabus
        fields = ["id", "section", "file"]


class EvaluationConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model  = EvaluationConfig
        fields = ["id", "section", "config"]


class AttendanceRowSerializer(serializers.ModelSerializer):
    class Meta:
        model  = AttendanceRow
        fields = ["student_id", "status"]


class AttendanceSessionSerializer(serializers.ModelSerializer):
    rows      = AttendanceRowSerializer(many=True, required=False)
    is_closed = serializers.BooleanField(source="closed", read_only=True)

    class Meta:
        model  = AttendanceSession
        fields = ["id", "section", "date", "closed", "is_closed", "rows"]


class AcademicProcessSerializer(serializers.ModelSerializer):
    class Meta:
        model  = AcademicProcess
        fields = "__all__"


class AcademicGradeRecordOutSerializer(serializers.ModelSerializer):
    course_name = serializers.CharField(source="course.name", read_only=True)
    credits     = serializers.SerializerMethodField()

    class Meta:
        model  = AcademicGradeRecord
        fields = ["id", "term", "final_grade", "course", "course_name", "credits"]

    def get_credits(self, obj):
        if obj.plan_course_id:
            return int(obj.plan_course.credits or 0)
        return int(obj.course.credits or 0)


class ProcessFileSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="file.name", read_only=True)
    size = serializers.SerializerMethodField()

    class Meta:
        model  = ProcessFile
        fields = ["id", "name", "size", "note", "file"]

    def get_size(self, obj):
        try:
            return obj.file.size
        except Exception:
            return 0