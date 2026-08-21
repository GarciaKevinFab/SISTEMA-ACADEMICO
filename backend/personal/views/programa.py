"""
Panel del COORDINADOR DE ÁREA ACADÉMICA.

  GET /api/personal/me/programa?period=&career_id=

Devuelve, para un programa a su cargo y un período:

  · sus DOCENTES, sacados del horario (Section -> PlanCourse -> Plan ->
    Career), con los cursos que dictan y si ya subieron sílabo;
  · sus ESTUDIANTES agrupados por CICLO, con el consolidado de notas
    (matriculados, aprobados, desaprobados, promedio).

No hay tabla de asignación docente-programa: lo que manda es el horario
cargado, que es justo lo que el coordinador ya conoce.
"""
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication

from personal.coordinacion import carreras_coordinadas


class MiProgramaView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from academic.views.evaluation import _sections_for, _is_grades_admin
        from catalogs.models import Career

        propias = carreras_coordinadas(request.user)
        admin = _is_grades_admin(request.user)
        if not propias and not admin:
            return Response(
                {"detail": "No figuras como coordinador (a) de área."},
                status=403)

        period = (request.query_params.get("period") or "").strip().upper()
        crudo = (request.query_params.get("career_id") or "").strip()

        # Programas entre los que puede elegir
        if admin and not propias:
            opciones = list(Career.objects.all().values("id", "name"))
        else:
            opciones = list(Career.objects.filter(id__in=propias)
                            .values("id", "name"))
        if not opciones:
            return Response({"detail": "Todavía no tienes programas asignados. "
                                       "Pídelo a Secretaría Académica."},
                            status=409)

        career_id = int(crudo) if crudo.isdigit() else opciones[0]["id"]
        if not admin and career_id not in propias:
            return Response({"detail": "Ese programa no está a tu cargo."},
                            status=403)

        if not period:
            return Response({"careers": opciones, "career_id": career_id,
                             "period": "", "docentes": [], "ciclos": []})

        secciones = list(_sections_for(period, career_id=career_id))
        salida = {
            "careers": opciones,
            "career_id": career_id,
            "period": period,
            "docentes": _docentes(secciones),
            "ciclos": _ciclos(secciones),
        }
        # Con ?semester= devuelve además los alumnos de ese ciclo, para poder
        # bajar sus horarios. Se pide aparte porque un programa completo son
        # cientos de alumnos y no tiene sentido mandarlos siempre.
        ciclo = (request.query_params.get("semester") or "").strip()
        if ciclo.isdigit():
            del_ciclo = [x for x in secciones
                         if str(getattr(x.plan_course, "semester", "")) == ciclo]
            salida["semester"] = int(ciclo)
            salida["estudiantes"] = _estudiantes(del_ciclo)
        return Response(salida)


def _nombre_docente(t):
    if not t:
        return "(sin docente asignado)"
    u = getattr(t, "user", None)
    return ((getattr(u, "full_name", "") or "").strip() if u else "") \
        or (getattr(t, "full_name", "") or "").strip() \
        or (getattr(u, "username", "") if u else "") or f"Docente {t.id}"


def _con_silabo(ids):
    """IDs de secciones que ya tienen sílabo subido."""
    from academic.models import Syllabus
    return set(Syllabus.objects.filter(section_id__in=ids)
               .values_list("section_id", flat=True))


def _matriculados(ids):
    """{section_id: {student_id, …}} de matrículas no anuladas.

    La sección cuelga de EnrollmentItem, NO de Enrollment: consultar
    Enrollment.section_id revienta con FieldError.
    """
    from academic.models import Enrollment, EnrollmentItem
    por = {}
    filas = (EnrollmentItem.objects
             .filter(section_id__in=ids)
             .exclude(enrollment__status=Enrollment.STATUS_CANCELLED)
             .values("section_id", "enrollment__student_id"))
    for f in filas:
        por.setdefault(f["section_id"], set()).add(f["enrollment__student_id"])
    return por


def _docentes(secciones):
    """Un renglón por docente, con los cursos que dicta en el programa."""
    con_silabo = _con_silabo([s.id for s in secciones])
    por = {}
    for sec in secciones:
        t = sec.teacher
        clave = t.id if t else 0
        fila = por.setdefault(clave, {
            "teacher_id": t.id if t else None,
            "nombre": _nombre_docente(t),
            "cursos": [], "secciones": 0, "con_silabo": 0,
        })
        fila["secciones"] += 1
        curso = sec.plan_course.course.name
        if curso not in fila["cursos"]:
            fila["cursos"].append(curso)
        if sec.id in con_silabo:
            fila["con_silabo"] += 1
    filas = sorted(por.values(), key=lambda f: f["nombre"])
    return filas


def _ciclos(secciones):
    """Consolidado de notas por ciclo, para ver el rendimiento de un vistazo."""
    from academic.models import SectionGrades

    ids = [s.id for s in secciones]
    bundles = {b.section_id: (b.grades or {})
               for b in SectionGrades.objects.filter(section_id__in=ids)}
    matriculas = _matriculados(ids)

    por = {}
    for sec in secciones:
        ciclo = getattr(sec.plan_course, "semester", None) or 0
        d = por.setdefault(ciclo, {
            "ciclo": ciclo, "secciones": 0, "matriculados": 0,
            "con_nota": 0, "aprobados": 0, "desaprobados": 0, "_suma": 0.0,
        })
        d["secciones"] += 1
        d["matriculados"] += len(matriculas.get(sec.id, ()))
        for valor in (bundles.get(sec.id) or {}).values():
            nota = _nota(valor)
            if nota is None:
                continue
            d["con_nota"] += 1
            d["_suma"] += nota
            if nota >= 11:
                d["aprobados"] += 1
            else:
                d["desaprobados"] += 1

    salida = []
    for d in sorted(por.values(), key=lambda x: x["ciclo"]):
        n = d.pop("_suma")
        d["promedio"] = round(n / d["con_nota"], 2) if d["con_nota"] else None
        salida.append(d)
    return salida


def _nota(valor):
    """La nota final de un alumno dentro del bundle de la sección."""
    if isinstance(valor, dict):
        for k in ("final", "promedio", "nota", "prom"):
            if k in valor:
                valor = valor[k]
                break
        else:
            return None
    try:
        return float(valor)
    except (TypeError, ValueError):
        return None


def _estudiantes(secciones):
    """Alumnos matriculados en esas secciones, sin repetir."""
    from students.models import Student

    ids = [s.id for s in secciones]
    alumnos = set()
    for conjunto in _matriculados(ids).values():
        alumnos |= conjunto
    if not alumnos:
        return []

    filas = [{
        "student_id": st.id,
        "nombre": " ".join(p for p in (st.apellido_paterno, st.apellido_materno,
                                       st.nombres) if p).strip() or st.nombres,
        "documento": st.num_documento or "",
    } for st in Student.objects.filter(id__in=alumnos)]
    try:
        from students.name_utils import clave_orden
        filas.sort(key=lambda f: clave_orden(f["nombre"]))
    except Exception:
        filas.sort(key=lambda f: f["nombre"])
    return filas
