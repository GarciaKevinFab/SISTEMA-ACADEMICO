# backend/academic/serializers.py
from datetime import datetime
from rest_framework import serializers

from .models import (
    Career, Course, Plan, PlanCourse, CoursePrereq,
    Classroom, Teacher, Section, SectionScheduleSlot,
    AcademicPeriod, Syllabus, EvaluationConfig,
    AttendanceSession, AttendanceRow, AcademicProcess, ProcessFile
)

DAY_TO_INT = {"MON": 1, "TUE": 2, "WED": 3, "THU": 4, "FRI": 5, "SAT": 6, "SUN": 7}
INT_TO_DAY = {v: k for k, v in DAY_TO_INT.items()}


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
    last = (getattr(user, "last_name", "") or "").strip()
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
        model = Career
        fields = "__all__"


class CourseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Course
        fields = "__all__"


# ───────────────────────── Plan ─────────────────────────
class PlanSerializer(serializers.ModelSerializer):
    career_id = serializers.IntegerField(source="career.id", read_only=True)
    career_name = serializers.CharField(source="career.name", read_only=True)

    class Meta:
        model = Plan
        fields = ["id", "name", "career", "career_id", "career_name", "start_year", "semesters", "description"]


class PlanCreateSerializer(serializers.ModelSerializer):
    career_id = serializers.IntegerField(write_only=True)
    career_name = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Plan
        fields = ["id", "name", "career_id", "career_name", "start_year", "semesters", "description"]

    def create(self, validated_data):
        cid = validated_data.pop("career_id")
        cname = (validated_data.pop("career_name", "") or "").strip()

        career, _ = Career.objects.get_or_create(
            id=cid,
            defaults={"name": cname or f"Carrera {cid}"}
        )
        if cname and career.name != cname:
            career.name = cname
            career.save(update_fields=["name"])

        return Plan.objects.create(career=career, **validated_data)

    def update(self, instance, validated_data):
        cid = validated_data.pop("career_id", None)
        cname = (validated_data.pop("career_name", "") or "").strip()

        if cid is not None:
            career, _ = Career.objects.get_or_create(
                id=cid,
                defaults={"name": cname or f"Carrera {cid}"}
            )
            if cname and career.name != cname:
                career.name = cname
                career.save(update_fields=["name"])
            instance.career = career

        for k, v in validated_data.items():
            setattr(instance, k, v)
        instance.save()
        return instance


# ───────────────────────── Cursos de un plan ─────────────────────────
class PlanCourseOutSerializer(serializers.ModelSerializer):
    code = serializers.CharField(source="course.code", read_only=True)
    name = serializers.CharField(source="course.name", read_only=True)
    credits = serializers.IntegerField(source="course.credits", read_only=True)
    prerequisites = serializers.SerializerMethodField()

    class Meta:
        model = PlanCourse
        fields = ["id", "code", "name", "credits", "weekly_hours", "semester", "type", "prerequisites"]

    def get_prerequisites(self, obj):
        ids = obj.prereqs.values_list("prerequisite_id", flat=True)
        return [{"id": i} for i in ids]


class PlanCourseCreateSerializer(serializers.Serializer):
    code = serializers.CharField()
    name = serializers.CharField()
    credits = serializers.IntegerField(required=False, default=3)
    weekly_hours = serializers.IntegerField(required=False, default=3)
    semester = serializers.IntegerField(required=False, default=1)
    type = serializers.ChoiceField(choices=["MANDATORY", "ELECTIVE"], required=False, default="MANDATORY")


# ───────────────────────── Teachers / Classrooms ─────────────────────────
class TeacherSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = Teacher
        fields = ["id", "user", "full_name"]

    def get_full_name(self, obj):
        if not obj.user:
            return f"Teacher #{obj.id}"
        return safe_full_name(obj.user) or f"Teacher #{obj.id}"


class ClassroomSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="code", read_only=True)

    class Meta:
        model = Classroom
        fields = ["id", "name", "code", "capacity"]


# ───────────────────────── Sections ─────────────────────────
class SlotOutSerializer(serializers.ModelSerializer):
    class Meta:
        model = SectionScheduleSlot
        fields = ["weekday", "start", "end"]


class SectionOutSerializer(serializers.ModelSerializer):
    course_code = serializers.CharField(source="plan_course.course.code", read_only=True)
    course_name = serializers.CharField(source="plan_course.course.name", read_only=True)

    # ✅ compat frontend: section_code
    section_code = serializers.CharField(source="label", read_only=True)

    teacher_id = serializers.SerializerMethodField()
    teacher_name = serializers.SerializerMethodField()

    room_id = serializers.IntegerField(source="classroom.id", read_only=True)
    room_name = serializers.CharField(source="classroom.code", read_only=True)

    slots = serializers.SerializerMethodField()

    class Meta:
        model = Section
        fields = [
            "id",
            "course_code", "course_name",
            "section_code",
            "teacher_id", "teacher_name",
            "room_id", "room_name",
            "capacity", "period",
            "label",
            "slots",
        ]

    def get_teacher_id(self, obj):
        if not obj.teacher or not obj.teacher.user:
            return None
        return obj.teacher.user.id

    def get_teacher_name(self, obj):
        if not obj.teacher:
            return ""
        return safe_full_name(getattr(obj.teacher, "user", None)) or f"Teacher #{obj.teacher.id}"

    def get_slots(self, obj):
        out = []
        for s in obj.schedule_slots.all().order_by("weekday", "start"):
            out.append({
                "day": INT_TO_DAY.get(s.weekday, str(s.weekday)),
                "start": str(s.start)[:5],
                "end": str(s.end)[:5],
            })
        return out


class SlotInSerializer(serializers.Serializer):
    day = serializers.ChoiceField(choices=list(DAY_TO_INT.keys()))
    start = serializers.CharField()
    end = serializers.CharField()

    def validate(self, attrs):
        st = _parse_hhmm(attrs.get("start"))
        en = _parse_hhmm(attrs.get("end"))

        if st >= en:
            raise serializers.ValidationError("start debe ser menor que end")

        attrs["_start_time"] = st
        attrs["_end_time"] = en
        return attrs


class SectionCreateUpdateSerializer(serializers.Serializer):
    course_id = serializers.IntegerField()
    teacher_id = serializers.IntegerField(required=False, allow_null=True)
    room_id = serializers.IntegerField(required=False, allow_null=True)
    capacity = serializers.IntegerField(required=False, min_value=1)
    period = serializers.CharField(required=False, allow_blank=True)
    label = serializers.CharField(required=False, allow_blank=True)
    slots = SlotInSerializer(many=True, required=False)

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
        model = AcademicPeriod
        fields = "__all__"


class SyllabusSerializer(serializers.ModelSerializer):
    class Meta:
        model = Syllabus
        fields = ["id", "section", "file"]


class EvaluationConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = EvaluationConfig
        fields = ["id", "section", "config"]


class AttendanceRowSerializer(serializers.ModelSerializer):
    class Meta:
        model = AttendanceRow
        fields = ["student_id", "status"]


class AttendanceSessionSerializer(serializers.ModelSerializer):
    rows = AttendanceRowSerializer(many=True, required=False)

    # ✅ tu frontend usa is_closed
    is_closed = serializers.BooleanField(source="closed", read_only=True)

    class Meta:
        model = AttendanceSession
        fields = ["id", "section", "date", "closed", "is_closed", "rows"]


class AcademicProcessSerializer(serializers.ModelSerializer):
    class Meta:
        model = AcademicProcess
        fields = "__all__"


class ProcessFileSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="file.name", read_only=True)
    size = serializers.SerializerMethodField()

    class Meta:
        model = ProcessFile
        fields = ["id", "name", "size", "note", "file"]

    def get_size(self, obj):
        try:
            return obj.file.size
        except Exception:
            return 0
