"""
Mesa de Control Académico — operaciones que Secretaría necesita y el sistema
no permitía hacer desde la web.

Todo lo de acá nació de casos reales: alumnos que no aparecían en su acta o en
su nómina y que solo se podían arreglar por consola. Los motivos encontrados:

  · `EnrollmentItem.section` en NULL   → el alumno no sale en el acta
  · matrícula CONFIRMADA sin cursos    → sale en la nómina y en ningún acta
  · `Student.ciclo` desfasado          → no sale en la nómina de su ciclo
  · ítem de subsanación obsoleto       → ocupa el lugar del curso regular
  · ficha duplicada con el kárdex partido en dos

Y el hueco de fondo: `enrollments/commit` se niega si la matrícula está
confirmada, y la única alternativa (`reset-student`) borra la matrícula, los
ítems y el pago. Por eso no se podía agregar ni quitar un curso.

Este módulo es la implementación que usa la API de la Mesa de Control
(`academic/views/mesa_control.py`).

PENDIENTE: `manage.py auditar_datos` todavía tiene su propia copia de las
operaciones de escritura (agregar/quitar curso, fusionar kárdex). Conviene
hacer que el comando delegue acá para no tener dos implementaciones que puedan
divergir; no se hizo aún porque el comando está en uso activo.
"""
from collections import defaultdict

from django.db import transaction
from django.db.models import Q

from academic.models import (
    AttendanceRow, AttendanceSession, Enrollment, EnrollmentItem, PlanCourse,
    Section, SectionGrades,
)
from students.models import Student
from students.name_utils import nombre_oficial

CONFIRMED = Enrollment.STATUS_CONFIRMED
PASSING_GRADE = 11


# ══════════════════════════════════════════════════════════════
#  LECTURA
# ══════════════════════════════════════════════════════════════

def _claves_alumno(st):
    """Las dos claves con que puede estar guardado un alumno en notas y
    asistencia: el id del usuario (si tiene cuenta) y el pk del Student."""
    return [k for k in (getattr(st, "user_id", None), st.id) if k]


def buscar_alumnos(q, limite=20):
    """Búsqueda por DNI o por nombre, para el buscador de la Mesa de Control."""
    q = (q or "").strip()
    if not q:
        return []
    qs = Student.objects.select_related("plan")
    if q.isdigit():
        qs = qs.filter(num_documento__startswith=q)
    else:
        for p in q.upper().split():
            qs = qs.filter(
                Q(apellido_paterno__icontains=p)
                | Q(apellido_materno__icontains=p)
                | Q(nombres__icontains=p)
            )
    return [{
        "student_id": st.id,
        "dni": st.num_documento,
        "nombre": nombre_oficial(st),
        "ciclo": st.ciclo,
        "programa": st.programa_carrera,
        "estado": st.estado_academico or "",
    } for st in qs.order_by("apellido_paterno", "apellido_materno", "nombres")[:limite]]


def periodos_disponibles():
    """Períodos que existen DE VERDAD, con cuánto hay en cada uno.

    No se listan los de `AcademicPeriod` sin más: puede haber períodos creados
    sin una sola matrícula, y al revés, matrículas en un código que nadie dio
    de alta. Lo que sirve para trabajar es dónde hay datos.

    `sugerido` es el que conviene abrir por defecto: el período vigente por
    fecha si lo hay, si no el que más matrículas tiene.
    """
    from datetime import date

    from academic.models import AcademicPeriod
    from django.db.models import Count

    conteo = defaultdict(lambda: {"matriculas": 0, "secciones": 0})
    for row in (Enrollment.objects.filter(status=CONFIRMED)
                .values("period").annotate(n=Count("id"))):
        if row["period"]:
            conteo[row["period"]]["matriculas"] = row["n"]
    for row in Section.objects.values("period").annotate(n=Count("id")):
        if row["period"]:
            conteo[row["period"]]["secciones"] = row["n"]

    hoy = date.today()
    vigente = (AcademicPeriod.objects
               .filter(start__lte=hoy, end__gte=hoy)
               .values_list("code", flat=True).first())

    codigos = sorted(conteo.keys(), reverse=True)
    if vigente in conteo:
        sugerido = vigente
    elif codigos:
        sugerido = max(codigos, key=lambda c: conteo[c]["matriculas"])
    else:
        sugerido = ""

    return {
        "sugerido": sugerido,
        "vigente": vigente or "",
        "periodos": [{
            "code": c,
            "matriculas": conteo[c]["matriculas"],
            "secciones": conteo[c]["secciones"],
            "vigente": c == vigente,
        } for c in codigos],
    }


def _aprobados_por_plan(st):
    """({course_id aprobados en SU plan}, {aprobados en un plan anterior}).

    La distinción importa: quien se trasladó de programa tiene aprobados cursos
    homónimos del plan viejo que no convalidan solos, y darlos por buenos
    taparía un curso que de verdad le falta.
    """
    propios, otros = set(), set()
    for cid, pc_plan in st.grade_records.filter(
            final_grade__gte=PASSING_GRADE).values_list("course_id", "plan_course__plan_id"):
        if pc_plan is None or pc_plan == st.plan_id:
            propios.add(cid)
        else:
            otros.add(cid)
    return propios, otros


def radiografia(dni):
    """Todo lo que hace falta para entender por qué un alumno no aparece
    donde debería: ficha, datos vinculados, kárdex, matrícula y faltantes."""
    st = (Student.objects.select_related("user", "plan")
          .filter(num_documento=str(dni).strip()).first())
    if not st:
        return None

    vinculados = []
    for rel in st._meta.related_objects:
        try:
            obj = getattr(st, rel.get_accessor_name(), None)
            n = obj.count() if hasattr(obj, "count") else (1 if obj else 0)
        except Exception:
            continue
        if n:
            vinculados.append({"modelo": rel.related_model._meta.verbose_name.title(),
                               "clave": rel.related_model._meta.label, "n": n})

    kardex = defaultdict(list)
    for rec in st.grade_records.select_related("course").order_by("term", "course__name"):
        kardex[rec.term or "—"].append({
            "curso": rec.course.name or "",
            "nota": float(rec.final_grade) if rec.final_grade is not None else None,
        })

    propios, de_otro_plan = _aprobados_por_plan(st)

    matriculas = []
    for enr in Enrollment.objects.filter(student=st).order_by("-period"):
        items = list(enr.items.select_related(
            "plan_course", "plan_course__course", "section").order_by("id"))
        cursos = []
        for it in items:
            # Para los que están sin sección se adjuntan las disponibles, así
            # se puede asignar desde la misma pantalla: un ítem sin sección no
            # aparece en ningún acta por más que la matrícula esté bien.
            disponibles = []
            if not it.section_id:
                disponibles = [
                    {"section_id": s.id, "label": s.label}
                    for s in Section.objects.filter(
                        plan_course_id=it.plan_course_id, period=enr.period)
                ]
            cursos.append({
                "item_id": it.id,
                "plan_course_id": it.plan_course_id,
                "curso": getattr(it.plan_course, "effective_name", ""),
                "ciclo": it.plan_course.semester,
                "creditos": it.plan_course.credits,
                "section_id": it.section_id,
                "seccion": it.section.label if it.section_id else None,
                "secciones_disponibles": disponibles,
            })
        matriculas.append({
            "enrollment_id": enr.id,
            "periodo": enr.period,
            "estado": enr.status,
            "creditos": enr.total_credits,
            "cursos": cursos,
            "faltantes": faltantes_de(st, enr) if enr.status == CONFIRMED else [],
        })

    return {
        "student_id": st.id,
        "dni": st.num_documento,
        "nombre": nombre_oficial(st),
        "apellido_paterno": st.apellido_paterno,
        "apellido_materno": st.apellido_materno,
        "nombres": st.nombres,
        "ciclo": st.ciclo,
        "plan_id": st.plan_id,
        "plan": getattr(st.plan, "name", ""),
        "programa": st.programa_carrera,
        "periodo_ficha": st.periodo,
        "estado_academico": st.estado_academico or "",
        "estado_rd": st.estado_rd or "",
        "cuenta": getattr(st.user, "username", "") if st.user_id else "",
        "full_name_cuenta": getattr(st.user, "full_name", "") if st.user_id else "",
        "vinculados": vinculados,
        "kardex": [{"periodo": k, "notas": v} for k, v in kardex.items()],
        "matriculas": matriculas,
        "aprobados_otro_plan": sorted(de_otro_plan),
    }


def faltantes_de(st, enr):
    """Cursos del ciclo que NO están en la matrícula.

    El ciclo se toma de la MATRÍCULA (semestre más alto de sus cursos), no de
    `Student.ciclo`, que puede estar desfasado. Y no se cuentan los que el
    alumno ya aprobó en su plan: los de subsanación se rematriculan solo en lo
    que desaprobaron y su matrícula está bien.
    """
    if not st.plan_id:
        return []
    items = list(enr.items.select_related("plan_course").all())
    sems = [int(i.plan_course.semester) for i in items
            if getattr(i.plan_course, "semester", None)]
    ciclo = max(sems) if sems else st.ciclo
    if not ciclo:
        return []
    tiene = {i.plan_course_id for i in items}
    propios, de_otro_plan = _aprobados_por_plan(st)

    out = []
    for pc in PlanCourse.objects.select_related("course").filter(
            plan_id=st.plan_id, semester=ciclo):
        if pc.id in tiene or pc.course_id in propios:
            continue
        secs = list(Section.objects.filter(plan_course=pc, period=enr.period))
        out.append({
            "plan_course_id": pc.id,
            "curso": getattr(pc, "effective_name", ""),
            "tipo": pc.type,
            "creditos": pc.credits,
            "secciones": [{"section_id": s.id, "label": s.label} for s in secs],
            "aprobado_en_otro_plan": pc.course_id in de_otro_plan,
        })
    return out


def roster_seccion(section_id):
    """El acta de una sección tal como la calcula el sistema, más la nómina del
    ciclo al lado. Sirve para zanjar un "no aparece el alumno X"."""
    from academic.views.acta_excel import _items_de_seccion, _roster

    sec = (Section.objects.select_related(
        "plan_course", "plan_course__course", "plan_course__plan",
        "plan_course__plan__career", "teacher__user").filter(id=section_id).first())
    if not sec:
        return None

    pc = sec.plan_course
    roster = _roster(sec)
    _base, ambiguos = _items_de_seccion(sec)
    en_acta = {r["dni"] for r in roster}

    nomina = []
    if pc and pc.plan and pc.plan.career_id and pc.semester:
        for st in (Student.objects
                   .filter(plan__career_id=pc.plan.career_id, ciclo=pc.semester,
                           enrollments__period=sec.period,
                           enrollments__status=CONFIRMED)
                   .distinct()
                   .order_by("apellido_paterno", "apellido_materno", "nombres")):
            nomina.append({
                "dni": st.num_documento,
                "nombre": nombre_oficial(st),
                "estado": st.estado_academico or "",
                "en_acta": st.num_documento in en_acta,
            })

    docente = ""
    if sec.teacher and sec.teacher.user:
        docente = sec.teacher.user.full_name or sec.teacher.user.username

    return {
        "section_id": sec.id,
        "curso": getattr(pc, "effective_name", "") if pc else "",
        "label": sec.label,
        "periodo": sec.period,
        "ciclo": pc.semester if pc else None,
        "programa": (pc.plan.career.name if pc and pc.plan and pc.plan.career else ""),
        "docente": docente,
        "otras_secciones": [
            {"section_id": s.id, "label": s.label}
            for s in Section.objects.filter(
                plan_course_id=sec.plan_course_id, period=sec.period).exclude(id=sec.id)
        ],
        "acta": [{"dni": r["dni"], "nombre": r["nombre"], "estado": r["estado"]}
                 for r in roster],
        "sin_ubicar": [{"dni": it.enrollment.student.num_documento,
                        "nombre": nombre_oficial(it.enrollment.student)}
                       for it in ambiguos],
        "nomina": nomina,
    }


# ══════════════════════════════════════════════════════════════
#  ESCRITURA
# ══════════════════════════════════════════════════════════════

def _recalcular(enr, st):
    """Créditos de la matrícula y ciclo de la ficha, con la misma regla que el
    endpoint de matrícula (academic/views/enrollment.py)."""
    items = list(enr.items.select_related("plan_course").all())
    enr.total_credits = sum(int(i.credits or 0) for i in items)
    enr.save(update_fields=["total_credits"])
    sems = [int(i.plan_course.semester) for i in items
            if getattr(i.plan_course, "semester", None)]
    if sems and (st.ciclo or 0) != max(sems):
        st.ciclo = max(sems)
        st.save(update_fields=["ciclo", "updated_at"])
    return len(items), enr.total_credits


def matricula_activa(st, periodo=None):
    qs = Enrollment.objects.filter(student=st, status=CONFIRMED)
    if periodo:
        qs = qs.filter(period=periodo)
    return qs.order_by("-period").first()


def agregar_curso(dni, section_id, periodo=None):
    """Agrega un curso a una matrícula CONFIRMADA sin borrar nada.

    Devuelve (ok, mensaje, detalle). No usa `enrollments/commit` porque ese
    endpoint rechaza las matrículas ya confirmadas.
    """
    st = Student.objects.filter(num_documento=str(dni).strip()).first()
    if not st:
        return False, f"No existe ficha con DNI {dni}", {}
    enr = matricula_activa(st, periodo)
    if not enr:
        return False, f"{nombre_oficial(st)} no tiene matrícula confirmada", {}
    sec = Section.objects.select_related("plan_course").filter(id=section_id).first()
    if not sec:
        return False, f"No existe la sección #{section_id}", {}

    pc = sec.plan_course
    if sec.period != enr.period:
        return False, (f"La sección es del período {sec.period} y la matrícula de "
                       f"{enr.period}"), {}
    if st.plan_id and pc.plan_id != st.plan_id:
        return False, (f"El curso es del plan {pc.plan_id} y el alumno del "
                       f"{st.plan_id}"), {}
    if enr.items.filter(plan_course_id=pc.id).exists():
        return False, "Ya tiene ese curso en la matrícula", {}

    propios, de_otro_plan = _aprobados_por_plan(st)
    aviso = ""
    if pc.course_id in propios:
        aviso = ("Ya tiene ese curso APROBADO en este mismo plan; "
                 "verificá que corresponda volver a matricularlo.")
    elif pc.course_id in de_otro_plan:
        aviso = ("Lo tiene aprobado en un plan anterior (traslado): no convalida "
                 "por sí solo, así que corresponde llevarlo.")

    with transaction.atomic():
        EnrollmentItem.objects.create(
            enrollment=enr, plan_course=pc, section=sec,
            credits=int(pc.credits or 0))
        n_cursos, creditos = _recalcular(enr, st)

    return True, (f"Curso agregado: {getattr(pc, 'effective_name', '')}. "
                  f"La matrícula queda con {n_cursos} curso(s) y {creditos} créditos."), {
        "cursos": n_cursos, "creditos": creditos, "aviso": aviso,
        "section_id": sec.id,
    }


def avisos_quitar(st, item):
    """Notas o asistencia que quedarían sin referencia al quitar el curso."""
    avisos = []
    if not item.section_id:
        return avisos
    claves = _claves_alumno(st)
    bundle = SectionGrades.objects.filter(section_id=item.section_id).first()
    if bundle and isinstance(bundle.grades, dict):
        if {str(k) for k in claves} & set(bundle.grades.keys()):
            avisos.append("Tiene NOTAS registradas en el acta de esa sección")
    n = AttendanceRow.objects.filter(
        session__in=AttendanceSession.objects.filter(section_id=item.section_id),
        student_id__in=claves).count()
    if n:
        avisos.append(f"Tiene {n} marca(s) de asistencia en esa sección")
    return avisos


def quitar_curso(dni, item_id, forzar=False, periodo=None):
    """Quita un curso de una matrícula CONFIRMADA.

    Caso típico: llevaba un curso de subsanación, lo aprobó en el
    extraordinario, y el ítem quedó ocupando el lugar del curso regular.
    Si hay notas o asistencia se exige `forzar` para no perderlas sin querer.
    """
    st = Student.objects.filter(num_documento=str(dni).strip()).first()
    if not st:
        return False, f"No existe ficha con DNI {dni}", {}
    enr = matricula_activa(st, periodo)
    if not enr:
        return False, f"{nombre_oficial(st)} no tiene matrícula confirmada", {}
    item = (enr.items.select_related("plan_course", "section")
            .filter(id=item_id).first())
    if not item:
        return False, f"El curso #{item_id} no pertenece a esa matrícula", {}

    avisos = avisos_quitar(st, item)
    if avisos and not forzar:
        return False, "Requiere confirmación", {"avisos": avisos, "requiere_forzar": True}

    curso = getattr(item.plan_course, "effective_name", "")
    with transaction.atomic():
        item.delete()
        n_cursos, creditos = _recalcular(enr, st)

    return True, (f"Curso quitado: {curso}. La matrícula queda con {n_cursos} "
                  f"curso(s) y {creditos} créditos."), {
        "cursos": n_cursos, "creditos": creditos, "avisos": avisos,
    }


def asignar_seccion(dni, item_id, section_id):
    """Asigna (o cambia) la sección de un curso ya matriculado.

    Un ítem sin sección no aparece en ningún acta aunque la matrícula esté
    perfecta: es el caso más común de "el alumno no figura".
    """
    st = Student.objects.filter(num_documento=str(dni).strip()).first()
    if not st:
        return False, f"No existe ficha con DNI {dni}", {}
    enr = matricula_activa(st)
    if not enr:
        return False, "No tiene matrícula confirmada", {}
    item = enr.items.select_related("plan_course").filter(id=item_id).first()
    if not item:
        return False, f"El curso #{item_id} no pertenece a esa matrícula", {}
    sec = Section.objects.filter(id=section_id).first()
    if not sec:
        return False, f"No existe la sección #{section_id}", {}
    if sec.plan_course_id != item.plan_course_id:
        return False, "Esa sección es de otro curso", {}
    if sec.period != enr.period:
        return False, f"La sección es del período {sec.period}", {}

    item.section = sec
    item.save(update_fields=["section"])
    return True, f"Sección '{sec.label}' asignada. Ya aparece en el acta.", {
        "section_id": sec.id}


def fusionar_kardex(dni_origen, dni_destino, aplicar=False):
    """Pasa el kárdex de una ficha duplicada a la ficha buena.

    Las fichas duplicadas por un DNI mal tipeado suelen tener el kárdex PARTIDO
    (los ciclos viejos en una y los nuevos en la otra), así que borrar la que
    "no tiene matrícula" perdería media historia académica.

    `AcademicGradeRecord` no tiene restricción de unicidad: mover a ciegas
    duplicaría las notas que estén en las dos. Se mueve solo lo que no choca y
    los choques se devuelven para que una persona decida. Nunca borra nada.
    """
    origen = Student.objects.filter(num_documento=str(dni_origen).strip()).first()
    destino = Student.objects.filter(num_documento=str(dni_destino).strip()).first()
    if not origen or not destino:
        return False, "No se encontró alguna de las dos fichas", {}
    if origen.pk == destino.pk:
        return False, "Origen y destino son la misma ficha", {}
    if nombre_oficial(origen) != nombre_oficial(destino):
        return False, ("Los nombres no coinciden exactamente. Revisá que sean la "
                       "misma persona antes de fusionar."), {}
    if origen.enrollments.exists():
        return False, ("La ficha de origen tiene matrículas. Esta operación solo "
                       "mueve kárdex."), {}

    ya = {(r.course_id, r.term): r
          for r in destino.grade_records.select_related("course")}
    mover, choques = [], []
    for rec in origen.grade_records.select_related("course").order_by("term"):
        gemela = ya.get((rec.course_id, rec.term))
        (choques if gemela else mover).append(
            {"term": rec.term, "curso": rec.course.name,
             "nota": float(rec.final_grade),
             "nota_destino": float(gemela.final_grade) if gemela else None,
             "id": rec.id})

    detalle = {
        "origen": {"dni": origen.num_documento, "id": origen.id,
                   "ciclo": origen.ciclo, "notas": origen.grade_records.count()},
        "destino": {"dni": destino.num_documento, "id": destino.id,
                    "ciclo": destino.ciclo, "notas": destino.grade_records.count()},
        "mover": mover, "choques": choques, "aplicado": False,
    }
    if not aplicar:
        return True, f"Simulación: {len(mover)} nota(s) a mover, {len(choques)} choque(s)", detalle
    if not mover:
        return True, "No hay nada que mover", detalle

    with transaction.atomic():
        origen.grade_records.filter(id__in=[m["id"] for m in mover]).update(
            student=destino)
    detalle["aplicado"] = True
    detalle["origen"]["notas"] = origen.grade_records.count()
    return True, (f"{len(mover)} nota(s) movida(s) a {destino.num_documento}. "
                  f"La ficha de origen queda con {detalle['origen']['notas']} nota(s)."), detalle


# ══════════════════════════════════════════════════════════════
#  INCIDENCIAS (panel accionable)
# ══════════════════════════════════════════════════════════════

def incidencias(period):
    """Los hallazgos que Secretaría puede resolver, con lo necesario para
    actuar desde la pantalla. Es un subconjunto accionable de lo que revisa
    `manage.py auditar_datos`."""
    period = (period or "").strip()

    enr_qs = Enrollment.objects.select_related("student").filter(status=CONFIRMED)
    if period:
        enr_qs = enr_qs.filter(period=period)
    matriculas = list(enr_qs)

    items = list(EnrollmentItem.objects
                 .select_related("enrollment", "enrollment__student",
                                 "plan_course", "plan_course__course", "section")
                 .filter(enrollment__in=matriculas))

    secs = defaultdict(list)
    sqs = Section.objects.all()
    if period:
        sqs = sqs.filter(period=period)
    for s in sqs:
        secs[(s.plan_course_id, s.period)].append(s)

    por_matricula = defaultdict(list)
    for it in items:
        por_matricula[it.enrollment_id].append(it)

    # Todo lo que hace falta se precarga en 2 consultas: si se llamara a
    # `faltantes_de` por alumno serían ~1500 y el panel tardaría segundos.
    pcs_por_plan_ciclo = defaultdict(list)
    for pc in PlanCourse.objects.select_related("course").all():
        pcs_por_plan_ciclo[(pc.plan_id, pc.semester)].append(pc)

    ids = [en.student_id for en in matriculas]
    plan_de = {en.student_id: en.student.plan_id for en in matriculas}
    aprob_propios = defaultdict(set)
    aprob_otro_plan = defaultdict(set)
    from academic.models import AcademicGradeRecord
    for sid, cid, pc_plan in (AcademicGradeRecord.objects
                              .filter(student_id__in=ids, final_grade__gte=PASSING_GRADE)
                              .values_list("student_id", "course_id",
                                           "plan_course__plan_id")):
        if pc_plan is None or pc_plan == plan_de.get(sid):
            aprob_propios[sid].add(cid)
        else:
            aprob_otro_plan[sid].add(cid)

    sin_seccion, vacias, desfasadas, faltantes = [], [], [], []

    for enr in matriculas:
        st = enr.student
        propios = por_matricula.get(enr.id, [])
        base = {"dni": st.num_documento, "nombre": nombre_oficial(st),
                "student_id": st.id, "periodo": enr.period}

        if not propios:
            vacias.append({**base, "ciclo": st.ciclo,
                           "creditos_registrados": enr.total_credits})
            continue

        sems = [int(i.plan_course.semester) for i in propios
                if getattr(i.plan_course, "semester", None)]
        ciclo_ok = max(sems) if sems else None
        if ciclo_ok and ((st.ciclo or 0) != ciclo_ok or (st.periodo or "") != enr.period):
            desfasadas.append({
                **base,
                "ciclo_ficha": st.ciclo, "ciclo_correcto": ciclo_ok,
                "periodo_ficha": st.periodo, "periodo_correcto": enr.period,
                "afecta_nomina": (st.ciclo or 0) != ciclo_ok,
            })

        for it in propios:
            if it.section_id:
                continue
            disponibles = secs.get((it.plan_course_id, enr.period), [])
            sin_seccion.append({
                **base,
                "item_id": it.id,
                "curso": getattr(it.plan_course, "effective_name", ""),
                "ciclo": it.plan_course.semester,
                "secciones": [{"section_id": s.id, "label": s.label} for s in disponibles],
            })

        # Cursos del ciclo que faltan, con los datos ya precargados.
        # El ciclo sale de la MATRÍCULA (no de Student.ciclo, que puede estar
        # desfasado) y no se cuentan los que ya aprobó en su plan: los de
        # subsanación se rematriculan solo en lo que desaprobaron.
        if ciclo_ok and st.plan_id:
            tiene = {i.plan_course_id for i in propios}
            for pc in pcs_por_plan_ciclo.get((st.plan_id, ciclo_ok), []):
                if pc.id in tiene or pc.course_id in aprob_propios[st.id]:
                    continue
                disponibles = secs.get((pc.id, enr.period), [])
                if not disponibles:
                    continue      # el curso no se dicta este período
                faltantes.append({
                    **base,
                    "plan_course_id": pc.id,
                    "curso": getattr(pc, "effective_name", ""),
                    "tipo": pc.type,
                    "creditos": pc.credits,
                    "ciclo": ciclo_ok,
                    "secciones": [{"section_id": s.id, "label": s.label}
                                  for s in disponibles],
                    "aprobado_en_otro_plan": pc.course_id in aprob_otro_plan[st.id],
                })

    return {
        "period": period,
        "resumen": {
            "sin_seccion": len(sin_seccion),
            "matriculas_vacias": len(vacias),
            "fichas_desfasadas": len(desfasadas),
            "cursos_faltantes": len(faltantes),
        },
        "sin_seccion": sin_seccion,
        "matriculas_vacias": vacias,
        "fichas_desfasadas": desfasadas,
        "cursos_faltantes": faltantes,
    }


def sincronizar_fichas(period, aplicar=False):
    """Pone `Student.ciclo` y `Student.periodo` de acuerdo con la matrícula.

    Con el ciclo desfasado el alumno NO aparece en la nómina de su ciclo,
    aunque su acta esté perfecta.
    """
    data = incidencias(period)
    objetivo = data["fichas_desfasadas"]
    if not aplicar:
        return len(objetivo), objetivo
    n = 0
    with transaction.atomic():
        for f in objetivo:
            st = Student.objects.filter(id=f["student_id"]).first()
            if not st:
                continue
            st.ciclo = f["ciclo_correcto"]
            st.periodo = f["periodo_correcto"]
            st.save(update_fields=["ciclo", "periodo", "updated_at"])
            n += 1
    return n, objetivo


def asignar_secciones_unicas(period, aplicar=False):
    """Asigna la sección a los ítems en NULL cuando el curso tiene UNA sola
    sección en el período. Si hay varias no toca nada: lo decide Secretaría."""
    data = incidencias(period)
    candidatos = [x for x in data["sin_seccion"] if len(x["secciones"]) == 1]
    if not aplicar:
        return len(candidatos), candidatos
    n = 0
    with transaction.atomic():
        for c in candidatos:
            n += EnrollmentItem.objects.filter(id=c["item_id"]).update(
                section_id=c["secciones"][0]["section_id"])
    return n, candidatos


def restaurar_matriculas_vacias(period, aplicar=False):
    """Devuelve los cursos a las matrículas confirmadas que quedaron sin
    ninguno, SOLO si los créditos obligatorios del ciclo coinciden exactamente
    con el `total_credits` que quedó guardado.

    Ese número es la huella de lo que la matrícula tenía antes de que el borrado
    de una sección eliminara sus ítems, así que la reconstrucción es exacta y
    no adivinada. Si no cuadra, no se toca.
    """
    data = incidencias(period)
    plan_de = {}
    restaurables, dudosas = [], []
    for v in data["matriculas_vacias"]:
        st = Student.objects.select_related("plan").filter(id=v["student_id"]).first()
        if not st or not (st.plan_id and st.ciclo):
            dudosas.append({**v, "motivo": "sin plan o sin ciclo en la ficha"})
            continue
        obligatorios = list(PlanCourse.objects.select_related("course").filter(
            plan_id=st.plan_id, semester=st.ciclo, type="MANDATORY"))
        creditos = sum(int(pc.credits or 0) for pc in obligatorios)
        item = {**v, "cursos": len(obligatorios), "creditos_esperados": creditos}
        if creditos and creditos == int(v["creditos_registrados"] or 0):
            restaurables.append(item)
            plan_de[st.id] = (st, obligatorios)
        else:
            dudosas.append({**item, "motivo": "los créditos no cuadran: revisar a mano"})

    if not aplicar:
        return len(restaurables), {"restaurables": restaurables, "dudosas": dudosas}

    creados = 0
    with transaction.atomic():
        for r in restaurables:
            st, obligatorios = plan_de[r["student_id"]]
            enr = matricula_activa(st, r["periodo"])
            if not enr:
                continue
            for pc in obligatorios:
                lista = list(Section.objects.filter(plan_course=pc, period=enr.period))
                EnrollmentItem.objects.get_or_create(
                    enrollment=enr, plan_course=pc,
                    defaults={"credits": int(pc.credits or 0),
                              "section": lista[0] if len(lista) == 1 else None})
                creados += 1
    return creados, {"restaurables": restaurables, "dudosas": dudosas}
