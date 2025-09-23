from rest_framework import serializers
from .models import *

class CareerSerializer(serializers.ModelSerializer):
    class Meta: model = Career; fields = '__all__'

class CourseSerializer(serializers.ModelSerializer):
    class Meta: model = Course; fields = '__all__'

class PlanCourseSerializer(serializers.ModelSerializer):
    course = CourseSerializer(read_only=True)
    course_id = serializers.PrimaryKeyRelatedField(
        source='course', queryset=Course.objects.all(), write_only=True
    )
    class Meta:
        model = PlanCourse
        fields = ['id','plan','course','course_id','semester']

class PlanSerializer(serializers.ModelSerializer):
    class Meta: model = Plan; fields = '__all__'

class ClassroomSerializer(serializers.ModelSerializer):
    class Meta: model = Classroom; fields = '__all__'

class TeacherSerializer(serializers.ModelSerializer):
    class Meta: model = Teacher; fields = ['id','user','acronym']

class SectionSerializer(serializers.ModelSerializer):
    class Meta: model = Section; fields = '__all__'

class ScheduleSlotSerializer(serializers.ModelSerializer):
    class Meta: model = SectionScheduleSlot; fields = '__all__'

class AcademicPeriodSerializer(serializers.ModelSerializer):
    class Meta: model = AcademicPeriod; fields = '__all__'

class SyllabusSerializer(serializers.ModelSerializer):
    class Meta: model = Syllabus; fields = ['id','section','file']

class EvaluationConfigSerializer(serializers.ModelSerializer):
    class Meta: model = EvaluationConfig; fields = ['id','section','config']

class AttendanceRowSerializer(serializers.ModelSerializer):
    class Meta: model = AttendanceRow; fields = ['student_id','status']

class AttendanceSessionSerializer(serializers.ModelSerializer):
    rows = AttendanceRowSerializer(many=True, required=False)
    class Meta: model = AttendanceSession; fields = ['id','section','date','closed','rows']
