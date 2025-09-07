from enum import Enum

class StudentStatus(str, Enum):
    ENROLLED = "ENROLLED"
    TRANSFERRED = "TRANSFERRED" 
    WITHDRAWN = "WITHDRAWN"
    GRADUATED = "GRADUATED"
    SUSPENDED = "SUSPENDED"

class GradeStatus(str, Enum):
    APPROVED = "APPROVED"
    FAILED = "FAILED"
    INCOMPLETE = "INCOMPLETE"
    WITHDRAWN = "WITHDRAWN"

class EnrollmentStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    COMPLETED = "COMPLETED"
    WITHDRAWN = "WITHDRAWN"

class DocumentType(str, Enum):
    DNI = "DNI"
    FOREIGN_CARD = "FOREIGN_CARD"
    PASSPORT = "PASSPORT"
    CONADIS_CARD = "CONADIS_CARD"

class AcademicPeriodType(str, Enum):
    SEMESTER = "SEMESTER"
    YEAR = "YEAR"
    TRIMESTER = "TRIMESTER"

class AcademicPeriodStatus(str, Enum):
    PLANNING = "PLANNING"
    ENROLLMENT_OPEN = "ENROLLMENT_OPEN"
    ENROLLMENT_CLOSED = "ENROLLMENT_CLOSED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

class AttendanceStatus(str, Enum):
    PRESENT = "PRESENT"
    ABSENT = "ABSENT"
    LATE = "LATE"
    JUSTIFIED = "JUSTIFIED"

class ClassType(str, Enum):
    THEORY = "THEORY"
    PRACTICE = "PRACTICE"
    LABORATORY = "LABORATORY"
    SEMINAR = "SEMINAR"
    WORKSHOP = "WORKSHOP"

class EvaluationType(str, Enum):
    EXAM = "EXAM"
    ASSIGNMENT = "ASSIGNMENT"
    PROJECT = "PROJECT"
    PARTICIPATION = "PARTICIPATION"
    PRACTICAL = "PRACTICAL"

class DayOfWeek(str, Enum):
    MONDAY = "MONDAY"
    TUESDAY = "TUESDAY"
    WEDNESDAY = "WEDNESDAY"
    THURSDAY = "THURSDAY"
    FRIDAY = "FRIDAY"
    SATURDAY = "SATURDAY"
    SUNDAY = "SUNDAY"

class PrerequisiteType(str, Enum):
    STRICT = "STRICT"           # Prerequisito obligatorio
    RECOMMENDED = "RECOMMENDED" # Prerequisito recomendado
    COREQUISITE = "COREQUISITE" # Debe cursarse junto con

class CourseStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    SUSPENDED = "SUSPENDED"
    CANCELLED = "CANCELLED"

class TeacherStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    ON_LEAVE = "ON_LEAVE"
    RETIRED = "RETIRED"

class AcademicDegree(str, Enum):
    BACHELOR = "BACHELOR"       # Bachiller
    MASTER = "MASTER"          # Maestría
    DOCTORATE = "DOCTORATE"    # Doctorado
    TECHNICIAN = "TECHNICIAN"  # Técnico

class ContractType(str, Enum):
    PERMANENT = "PERMANENT"    # Nombrado
    TEMPORARY = "TEMPORARY"    # Contratado
    PART_TIME = "PART_TIME"   # Tiempo parcial
    HOURLY = "HOURLY"         # Por horas