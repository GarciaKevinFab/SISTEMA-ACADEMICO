"""Alcance de los coordinadores de área académica.

Un coordinador es un DOCENTE designado en una jefatura de línea que tiene
programas a cargo (`JefeLinea.careers`). Su alcance es exactamente esos
programas: ve a los docentes y estudiantes de ellos y de ningún otro.

El caso que obliga a que sea una lista y no un solo programa: el
coordinador de Educación Física tiene a su cargo Educación Física Y
Comunicación.

Vive aquí, fuera de `views/`, para que `academic` lo pueda importar sin
arrastrar las vistas del módulo.
"""
from catalogs.models import Teacher

from .models import JefeLinea


def carreras_coordinadas(user):
    """IDs de los programas que coordina el usuario.

    Devuelve una lista vacía si no coordina ninguno (no es coordinador, o lo
    es pero todavía no le asignaron programas).
    """
    if not user or not getattr(user, "is_authenticated", False):
        return []
    fichas = list(Teacher.objects.filter(user=user).values_list("id", flat=True))
    if not fichas:
        return []
    return list(
        JefeLinea.objects
        .filter(teacher_id__in=fichas, activo=True)
        .values_list("careers__id", flat=True)
        .exclude(careers__id=None)
        .distinct()
    )


def es_coordinador(user) -> bool:
    return bool(carreras_coordinadas(user))


def docentes_de(career_ids, period=None):
    """IDs de docentes con sección en esos programas.

    Es la fuente de "los docentes de mi programa": sale del horario tal
    como está cargado (Section -> PlanCourse -> Plan -> Career), sin tabla
    de asignación aparte.
    """
    from academic.models import Section
    if not career_ids:
        return []
    qs = Section.objects.filter(plan_course__plan__career_id__in=career_ids)
    if period:
        qs = qs.filter(period=period)
    return list(qs.exclude(teacher_id=None)
                  .values_list("teacher_id", flat=True).distinct())


def puede_ver_docente(user, teacher_id, period=None) -> bool:
    """¿El usuario coordina algún programa donde ese docente dicta?"""
    propias = carreras_coordinadas(user)
    if not propias:
        return False
    try:
        teacher_id = int(teacher_id)
    except (TypeError, ValueError):
        return False
    # Sin período: basta con que dicte en el programa en cualquier momento,
    # para que se pueda consultar un horario de un período pasado.
    return teacher_id in docentes_de(propias, period)
