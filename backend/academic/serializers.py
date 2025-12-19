from rest_framework import serializers
from .models import (
    Career, Course, Plan, PlanCourse, CoursePrereq,
    Classroom, Teacher, Section, SectionScheduleSlot,
    AcademicPeriod, Syllabus, EvaluationConfig,
    AttendanceSession, AttendanceRow, AcademicProcess, ProcessFile
)


class CareerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Career
        fields = "__all__"


class CourseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Course
        fields = "__all__"


# ---------- Plan (formato frontend) ----------
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

        # 🔥 si no existe en academic, lo creamos con ESE MISMO ID
        career, created = Career.objects.get_or_create(
            id=cid,
            defaults={"name": cname or f"Carrera {cid}"}
        )
        # si existe pero cambió el nombre, lo sincronizamos
        if cname and career.name != cname:
            career.name = cname
            career.save(update_fields=["name"])

        return Plan.objects.create(career=career, **validated_data)

    def update(self, instance, validated_data):
        # por si actualizas plan con career_id también
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


# ---------- Cursos de un plan (lo que tu UI lista y usa como id) ----------
class PlanCourseOutSerializer(serializers.ModelSerializer):
    # 👇 tu frontend quiere {id, code, name, credits, weekly_hours, semester, type, prerequisites:[{id}]}
    code = serializers.CharField(source="course.code", read_only=True)
    name = serializers.CharField(source="course.name", read_only=True)
    credits = serializers.IntegerField(source="course.credits", read_only=True)
    prerequisites = serializers.SerializerMethodField()

    class Meta:
        model = PlanCourse
        fields = ["id", "code", "name", "credits", "weekly_hours", "semester", "type", "prerequisites"]

    def get_prerequisites(self, obj):
        # prereqs se guardan como PlanCourse IDs (perfecto para tu checkbox)
        ids = obj.prereqs.values_list("prerequisite_id", flat=True)
        return [{"id": i} for i in ids]


class PlanCourseCreateSerializer(serializers.Serializer):
    code = serializers.CharField()
    name = serializers.CharField()
    credits = serializers.IntegerField(required=False, default=3)
    weekly_hours = serializers.IntegerField(required=False, default=3)
    semester = serializers.IntegerField(required=False, default=1)
    type = serializers.ChoiceField(choices=["MANDATORY", "ELECTIVE"], required=False, default="MANDATORY")


# ---------- Teachers / Classrooms ----------
class TeacherSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = Teacher
        fields = ["id", "user", "full_name"]

    def get_full_name(self, obj):
        if not obj.user:
            return f"Teacher #{obj.id}"
        full = (obj.user.get_full_name() or "").strip()
        return full or obj.user.username


class ClassroomSerializer(serializers.ModelSerializer):
    # frontend muestra room_name -> le daremos name como alias de code
    name = serializers.CharField(source="code", read_only=True)

    class Meta:
        model = Classroom
        fields = ["id", "name", "code", "capacity"]


# ---------- Sections ----------
class SlotOutSerializer(serializers.ModelSerializer):
    class Meta:
        model = SectionScheduleSlot
        fields = ["weekday", "start", "end"]


class SectionOutSerializer(serializers.ModelSerializer):
    course_code = serializers.CharField(source="plan_course.course.code", read_only=True)
    course_name = serializers.CharField(source="plan_course.course.name", read_only=True)

    teacher_id = serializers.IntegerField(source="teacher.id", read_only=True)
    teacher_name = serializers.SerializerMethodField()

    room_id = serializers.IntegerField(source="classroom.id", read_only=True)
    room_name = serializers.CharField(source="classroom.code", read_only=True)

    slots = serializers.SerializerMethodField()

    class Meta:
        model = Section
        fields = [
            "id",
            "course_code", "course_name",
            "teacher_id", "teacher_name",
            "room_id", "room_name",
            "capacity", "period",
            "label",
            "slots",
        ]

    def get_teacher_name(self, obj):
        if not obj.teacher:
            return ""
        if obj.teacher.user:
            full = (obj.teacher.user.get_full_name() or "").strip()
            return full or obj.teacher.user.username
        return f"Teacher #{obj.teacher.id}"

    def get_slots(self, obj):
        # devolvemos como {day:"MON", start:"08:00", end:"10:00"} para tu UI
        inv = {1:"MON", 2:"TUE", 3:"WED", 4:"THU", 5:"FRI", 6:"SAT", 7:"SUN"}
        out = []
        for s in obj.schedule_slots.all().order_by("weekday", "start"):
            out.append({"day": inv.get(s.weekday, str(s.weekday)), "start": str(s.start)[:5], "end": str(s.end)[:5]})
        return out


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

    class Meta:
        model = AttendanceSession
        fields = ["id", "section", "date", "closed", "rows"]


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
