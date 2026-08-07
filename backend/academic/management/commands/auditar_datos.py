"""
Auditoría completa de datos académicos.

    python manage.py auditar_datos                     # revisa TODO, no toca nada
    python manage.py auditar_datos --period 2026-I     # solo un período
    python manage.py auditar_datos --detalle           # lista cada caso
    python manage.py auditar_datos --csv ./informe     # un CSV por hallazgo
    python manage.py auditar_datos --arreglar          # aplica las correcciones seguras

Sin `--arreglar` es de SOLO LECTURA.

Revisa:
  A) Nombres        · campos con espacios/minúsculas sin normalizar
                    · `User.full_name` desactualizado respecto de la ficha
                    · apellidos o nombres vacíos
                    · posibles duplicados de persona (mismo nombre, DNI distinto)
  B) Matrícula      · cursos del ciclo que faltan en la matrícula (descontando
                      los que el alumno ya aprobó, para no marcar mal a los de
                      subsanación, que se rematriculan solo en lo desaprobado)
                    · ítems sin sección teniendo sección creada  ← el caso Meneses
                    · ítems apuntando a una sección de otro curso o período
                    · matriculados que no aparecen en NINGÚN acta
                    · alumnos con plan distinto al del curso que llevan
                    · variantes del código de período ("2026-I" vs "2026-1")
  C) Cobertura      · por sección: matriculados vs. los que ve el acta
  D) Asistencia     · secciones sin horario configurado
                    · secciones con sesiones pero sin marcas

Correcciones que aplica `--arreglar` (todas reversibles con los datos de origen):
  1. Normaliza nombres/apellidos a MAYÚSCULAS sin espacios sobrantes.
  2. Recalcula `User.full_name` = "APELLIDOS, NOMBRES" desde la ficha.
  3. Asigna la sección a los ítems en NULL cuando el curso tiene UNA sola
     sección en el período (si hay varias no toca nada: lo decide Secretaría).
"""
import csv
import os
from collections import defaultdict

from django.core.management.base import BaseCommand
from django.db import transaction

from academic.models import (
    AttendanceRow, AttendanceSession, EnrollmentItem, Section,
    SectionScheduleSlot,
)
from students.models import Student
from students.name_utils import (
    apellidos_de, nombre_oficial, nombres_de, normalizar,
    normalizar_campos_student, sync_user_full_name,
)

CONFIRMED = "CONFIRMED"


def _periodo_limpio(valor) -> str:
    """'2026- I' → '2026-I'. Los códigos de período no llevan espacios."""
    import re
    return re.sub(r"\s+", "", str(valor or "")).upper()


def _sin_tildes(texto: str) -> str:
    import unicodedata
    return "".join(c for c in unicodedata.normalize("NFD", texto)
                   if not unicodedata.combining(c))


def _clave_nombre(texto: str) -> str:
    """Nombre comparable: sin comas ni espacios repetidos, en mayúsculas.

    La coma se ignora porque en el Excel oficial a veces falta ("ALCA PATRICIO
    NORMA ESTHER") y eso no es un error del sistema.
    """
    return normalizar(str(texto or "").replace(",", " "))


def _clasificar_nombre(nom_oficial: str, nom_sistema: str) -> str:
    """Por qué difieren, para poder triar 30 filas sin abrirlas una por una."""
    a, b = _clave_nombre(nom_oficial), _clave_nombre(nom_sistema)
    sa, sb = _sin_tildes(a), _sin_tildes(b)
    if sa == sb:
        return "solo tildes"
    ta, tb = sa.split(), sb.split()
    if set(tb) < set(ta):
        return "al sistema le faltan nombres"
    if set(ta) < set(tb):
        return "el sistema tiene datos de más"
    if sorted(ta) == sorted(tb):
        return "mismas palabras, otro orden"
    return "difieren — revisar"


def _dnis_equivalentes(dni: str):
    """El Excel guarda el DNI como número y le come el cero inicial
    (04041859 → 4041859). Se comparan las dos formas."""
    d = str(dni or "").strip()
    return {d, d.zfill(8), d.lstrip("0")}


def _diagnostico_periodo(limpio, validos) -> str:
    """Si al limpiar queda un período real, se puede normalizar solo.

    Si no, hace falta criterio humano: '2026-L' (L minúscula) y '2026-1'
    (dígito uno) parecen normalizados pero no son el período '2026-I'.
    Se sugiere el código real más parecido.
    """
    if limpio in validos:
        return "se puede normalizar"
    import difflib
    cerca = difflib.get_close_matches(limpio, sorted(validos), n=1, cutoff=0.6)
    return f"revisar a mano — ¿quiso decir {cerca[0]}?" if cerca else "revisar a mano"


class Command(BaseCommand):
    help = "Audita la base académica (nombres, matrícula, actas) y repara lo seguro."

    def add_arguments(self, parser):
        parser.add_argument("--period", default="", help="Código de período (ej. 2026-I)")
        parser.add_argument("--detalle", action="store_true", help="Listar cada caso")
        parser.add_argument("--csv", default="", help="Carpeta donde escribir los CSV")
        parser.add_argument("--arreglar", action="store_true",
                            help="Aplicar las correcciones seguras (por defecto NO)")
        parser.add_argument("--restaurar-matriculas", action="store_true",
                            dest="restaurar",
                            help="Devolver los cursos a las matrículas confirmadas que "
                                 "quedaron con 0 cursos, SOLO si los créditos cuadran "
                                 "exactamente con los obligatorios de su ciclo")
        parser.add_argument("--limite", type=int, default=25,
                            help="Casos a mostrar por hallazgo con --detalle (0 = todos)")
        parser.add_argument("--dni", default="",
                            help="Radiografía de UN alumno: ficha, matrículas, ítems, "
                                 "secciones y cursos de su ciclo que le faltan")
        parser.add_argument("--fusionar", default="",
                            help="ORIGEN,DESTINO (DNIs): pasa el kárdex de la ficha "
                                 "duplicada a la buena. Simula sin escribir; agrega "
                                 "--confirmar para aplicarlo. Nunca borra la ficha "
                                 "de origen ni pisa notas del destino.")
        parser.add_argument("--confirmar", action="store_true",
                            help="Aplicar la fusión de --fusionar (sin esto solo simula)")
        parser.add_argument("--agregar-curso", default="", dest="agregar",
                            help="DNI  → lista los cursos que le faltan con el id de "
                                 "sección y el comando exacto. DNI,SECCION_ID → agrega "
                                 "ese curso a su matrícula confirmada (simula; usa "
                                 "--confirmar para aplicar)")
        parser.add_argument("--quitar-curso", default="", dest="quitar",
                            help="DNI → lista los cursos de su matrícula con el id de "
                                 "ítem. DNI,ITEM_ID → quita ese curso (simula; usa "
                                 "--confirmar). Avisa si ya tiene notas o asistencia.")
        parser.add_argument("--seccion", default="", dest="seccion",
                            help="ID de sección: muestra el acta tal como la calcula "
                                 "el sistema (quién aparece, quién no y por qué) y la "
                                 "nómina del ciclo, para comparar con el documento")
        parser.add_argument("--cruzar-nomina", default="", dest="nomina",
                            help="CSV de la nómina oficial (hoja;dni;apellidos_nombres) "
                                 "para cruzarlo contra la base: quién falta, quién sobra "
                                 "y qué nombres no coinciden")

    # ────────────────────────────────────────────────────────────
    def handle(self, *args, **o):
        self.period = (o["period"] or "").strip()
        self.detalle = o["detalle"]
        self.limite = o["limite"]
        self.arreglar = o["arreglar"]
        self.restaurar = o["restaurar"]
        self.csv_dir = o["csv"]
        self.hallazgos = {}
        self.restaurables = []
        self.fichas_a_sincronizar = []

        if self.csv_dir:
            os.makedirs(self.csv_dir, exist_ok=True)

        if o["agregar"]:
            return self.agregar_curso(o["agregar"], o["confirmar"])

        if o["quitar"]:
            return self.quitar_curso(o["quitar"], o["confirmar"])

        if o["seccion"]:
            return self.ver_seccion(o["seccion"])

        if o["nomina"]:
            return self.cruzar_nomina(o["nomina"])

        if o["fusionar"]:
            return self.fusionar(o["fusionar"], o["confirmar"])

        if o["dni"]:
            return self.radiografia(o["dni"].strip())

        self._t("AUDITORÍA DE DATOS ACADÉMICOS"
                + (f" — período {self.period}" if self.period else " — todos los períodos"))
        if not (self.arreglar or self.restaurar):
            self.stdout.write(self.style.WARNING(
                "Modo SOLO LECTURA. Agrega --arreglar para aplicar las correcciones "
                "seguras, o --restaurar-matriculas para devolver los cursos borrados.\n"))

        self.bloque_nombres()
        self.bloque_matricula()
        self.bloque_cobertura()
        self.bloque_asistencia()
        self.resumen()

    # ────────────────────────────────────────── utilidades de salida
    def _t(self, txt):
        self.stdout.write("")
        self.stdout.write(self.style.MIGRATE_HEADING("═" * 78))
        self.stdout.write(self.style.MIGRATE_HEADING(txt))
        self.stdout.write(self.style.MIGRATE_HEADING("═" * 78))

    def _h(self, clave, titulo, filas, cabecera, grave=True):
        """Registra un hallazgo: `filas` es una lista de tuplas."""
        self.hallazgos[clave] = len(filas)
        estilo = self.style.ERROR if (grave and filas) else (
            self.style.WARNING if filas else self.style.SUCCESS)
        self.stdout.write(estilo(f"  [{len(filas):>5}]  {titulo}"))

        if filas and self.detalle:
            n = len(filas) if self.limite == 0 else self.limite
            for f in filas[:n]:
                self.stdout.write("           · " + " | ".join(str(x) for x in f))
            if len(filas) > n:
                self.stdout.write(f"           … y {len(filas) - n} más")

        if filas and self.csv_dir:
            ruta = os.path.join(self.csv_dir, f"{clave}.csv")
            with open(ruta, "w", newline="", encoding="utf-8-sig") as fh:
                w = csv.writer(fh, delimiter=";")
                w.writerow(cabecera)
                w.writerows(filas)
            self.stdout.write(f"           → {ruta}")

    # ══════════════════ AGREGAR UN CURSO A UNA MATRÍCULA CONFIRMADA
    def agregar_curso(self, arg, confirmar):
        """Agrega un curso a una matrícula ya CONFIRMADA.

        El sistema no tiene forma de hacer esto: `enrollments/commit` se niega
        si la matrícula está confirmada, y la única alternativa que existe
        (`reset-student`) borra la matrícula completa, los ítems Y el pago. Por
        eso los casos de "al alumno le falta un curso" no se podían resolver.

        Con solo el DNI lista lo que le falta y el comando exacto a ejecutar.
        """
        from academic.models import Enrollment, EnrollmentItem, PlanCourse

        partes = [p.strip() for p in str(arg).replace(" ", ",").split(",") if p.strip()]
        st = Student.objects.filter(num_documento=partes[0]).first()
        if not st:
            self.stdout.write(self.style.ERROR(f"No existe ficha con DNI {partes[0]}"))
            return

        enr = (Enrollment.objects
               .filter(student=st, status=CONFIRMED)
               .order_by("-period").first())
        if not enr:
            self.stdout.write(self.style.ERROR(
                f"{nombre_oficial(st)} no tiene matrícula confirmada."))
            return

        tiene = {it.plan_course_id for it in enr.items.all()}
        # Aprobados EN SU PLAN vs. aprobados en un plan anterior (traslado):
        # los segundos no convalidan solos, así que se avisan distinto.
        aprobados, de_otro_plan = set(), set()
        for cid, pc_plan in st.grade_records.filter(
                final_grade__gte=11).values_list("course_id", "plan_course__plan_id"):
            if pc_plan is None or pc_plan == st.plan_id:
                aprobados.add(cid)
            else:
                de_otro_plan.add(cid)

        # ── Solo DNI: listar lo que le falta con el comando listo ──
        if len(partes) == 1:
            self._t(f"CURSOS QUE LE FALTAN — {nombre_oficial(st)} (DNI {st.num_documento})")
            self.stdout.write(f"  Matrícula {enr.period} · ciclo {st.ciclo} · "
                              f"{len(tiene)} curso(s) · {enr.total_credits} créditos\n")
            faltan = 0
            for pc in PlanCourse.objects.select_related("course").filter(
                    plan_id=st.plan_id, semester=st.ciclo):
                if pc.id in tiene:
                    continue
                nota = (" (ya aprobado en su plan)" if pc.course_id in aprobados
                        else " (aprobado en un plan anterior: NO convalida solo)"
                        if pc.course_id in de_otro_plan else "")
                secs = list(Section.objects.filter(plan_course=pc, period=enr.period))
                nombre = getattr(pc, "effective_name", "")
                if not secs:
                    self.stdout.write(f"  · {nombre[:52]:<52} sin sección creada{nota}")
                    continue
                for s in secs:
                    self.stdout.write(f"  · {nombre[:52]:<52} sección #{s.id} '{s.label}'{nota}")
                    self.stdout.write(self.style.WARNING(
                        f"      python manage.py auditar_datos "
                        f"--agregar-curso {st.num_documento},{s.id} --confirmar"))
                faltan += 1
            if not faltan:
                self.stdout.write(self.style.SUCCESS(
                    f"  No le falta ningún curso del ciclo {st.ciclo}."))
            return

        # ── DNI + sección: agregar ──
        try:
            sec = Section.objects.select_related(
                "plan_course", "plan_course__course").get(id=int(partes[1]))
        except (ValueError, Section.DoesNotExist):
            self.stdout.write(self.style.ERROR(f"No existe la sección #{partes[1]}"))
            return

        pc = sec.plan_course
        curso = getattr(pc, "effective_name", "")
        self._t(f"AGREGAR CURSO — {nombre_oficial(st)}")
        self.stdout.write(f"  Matrícula : {enr.period} [{enr.status}] · "
                          f"{len(tiene)} curso(s) · {enr.total_credits} créditos")
        self.stdout.write(f"  Curso     : {curso} (ciclo {pc.semester}, "
                          f"{pc.credits} créditos)")
        self.stdout.write(f"  Sección   : #{sec.id} '{sec.label}' · {sec.period}")

        if sec.period != enr.period:
            self.stdout.write(self.style.ERROR(
                f"  ⛔ La sección es del período {sec.period} y la matrícula de "
                f"{enr.period}. Se cancela."))
            return
        if st.plan_id and pc.plan_id != st.plan_id:
            self.stdout.write(self.style.ERROR(
                f"  ⛔ El curso es del plan {pc.plan_id} y el alumno del "
                f"{st.plan_id}. Se cancela."))
            return
        if pc.id in tiene:
            self.stdout.write(self.style.WARNING(
                "  Ya tiene ese curso en la matrícula. Nada que hacer."))
            return
        if pc.course_id in aprobados:
            self.stdout.write(self.style.WARNING(
                "  ⚠ OJO: ya tiene ese curso APROBADO en este mismo plan. "
                "Verificá que corresponda volver a matricularlo."))
        elif pc.course_id in de_otro_plan:
            self.stdout.write(
                "  Nota: lo tiene aprobado en un plan anterior (traslado). "
                "No convalida por sí solo, así que corresponde llevarlo.")

        if not confirmar:
            self.stdout.write(self.style.WARNING(
                "\n  SIMULACIÓN. Agrega --confirmar para aplicarlo."))
            return

        with transaction.atomic():
            EnrollmentItem.objects.create(
                enrollment=enr, plan_course=pc, section=sec,
                credits=int(pc.credits or 0))
            # créditos y ciclo se recalculan igual que en el endpoint de matrícula
            items = list(enr.items.select_related("plan_course").all())
            enr.total_credits = sum(int(i.credits or 0) for i in items)
            enr.save(update_fields=["total_credits"])
            sems = [int(i.plan_course.semester) for i in items
                    if getattr(i.plan_course, "semester", None)]
            if sems and (st.ciclo or 0) != max(sems):
                st.ciclo = max(sems)
                st.save(update_fields=["ciclo", "updated_at"])
        self.stdout.write(self.style.SUCCESS(
            f"\n  ✔ Curso agregado. La matrícula queda con {len(items)} curso(s) "
            f"y {enr.total_credits} créditos. Ya aparece en el acta de la sección "
            f"#{sec.id}."))

    # ══════════════════ QUITAR UN CURSO DE UNA MATRÍCULA CONFIRMADA
    def quitar_curso(self, arg, confirmar):
        """Quita un curso de una matrícula ya CONFIRMADA.

        Caso típico: el alumno llevaba un curso de SUBSANACIÓN, lo aprobó en el
        extraordinario, y el ítem quedó en la matrícula del período regular. El
        sistema no tiene forma de sacarlo sin borrar la matrícula completa.

        Antes de quitar avisa si ya hay notas o asistencia registradas para ese
        alumno en esa sección, porque ahí perdería la referencia en el acta.
        """
        from academic.models import (AttendanceRow, AttendanceSession,
                                     Enrollment, SectionGrades)

        partes = [p.strip() for p in str(arg).replace(" ", ",").split(",") if p.strip()]
        st = Student.objects.filter(num_documento=partes[0]).first()
        if not st:
            self.stdout.write(self.style.ERROR(f"No existe ficha con DNI {partes[0]}"))
            return
        enr = (Enrollment.objects.filter(student=st, status=CONFIRMED)
               .order_by("-period").first())
        if not enr:
            self.stdout.write(self.style.ERROR(
                f"{nombre_oficial(st)} no tiene matrícula confirmada."))
            return

        items = list(enr.items.select_related("plan_course", "plan_course__course",
                                              "section").order_by("id"))

        if len(partes) == 1:
            self._t(f"CURSOS DE LA MATRÍCULA — {nombre_oficial(st)} (DNI {st.num_documento})")
            self.stdout.write(f"  Matrícula {enr.period} · ciclo {st.ciclo} · "
                              f"{len(items)} curso(s) · {enr.total_credits} créditos\n")
            for it in items:
                pc = it.plan_course
                sec = f"sección #{it.section_id} '{it.section.label}'" if it.section_id \
                    else "SIN SECCIÓN"
                self.stdout.write(
                    f"  · [ítem {it.id}] {getattr(pc, 'effective_name', '')[:44]:<44} "
                    f"ciclo {pc.semester} · {pc.credits} cr · {sec}")
                self.stdout.write(self.style.WARNING(
                    f"      python manage.py auditar_datos "
                    f"--quitar-curso {st.num_documento},{it.id} --confirmar"))
            return

        it = next((x for x in items if str(x.id) == partes[1]), None)
        if not it:
            self.stdout.write(self.style.ERROR(
                f"El ítem {partes[1]} no pertenece a la matrícula de {nombre_oficial(st)}"))
            return

        pc = it.plan_course
        self._t(f"QUITAR CURSO — {nombre_oficial(st)}")
        self.stdout.write(f"  Matrícula : {enr.period} · {len(items)} curso(s) · "
                          f"{enr.total_credits} créditos")
        self.stdout.write(f"  Curso     : {getattr(pc, 'effective_name', '')} "
                          f"(ciclo {pc.semester}, {pc.credits} créditos)")
        self.stdout.write(f"  Sección   : "
                          + (f"#{it.section_id} '{it.section.label}'" if it.section_id
                             else "sin sección asignada"))

        # ¿Hay notas o asistencia que se quedarían huérfanas?
        avisos = []
        if it.section_id:
            bundle = SectionGrades.objects.filter(section_id=it.section_id).first()
            if bundle and isinstance(bundle.grades, dict):
                claves = {str(st.id), str(st.user_id or "")}
                if claves & set(bundle.grades.keys()):
                    avisos.append("tiene NOTAS registradas en el acta de esa sección")
            sesiones = AttendanceSession.objects.filter(section_id=it.section_id)
            n_marcas = AttendanceRow.objects.filter(
                session__in=sesiones,
                student_id__in=[x for x in (st.user_id, st.id) if x]).count()
            if n_marcas:
                avisos.append(f"tiene {n_marcas} marca(s) de asistencia en esa sección")
        for a in avisos:
            self.stdout.write(self.style.ERROR(f"  ⚠ {a}"))
        if avisos:
            self.stdout.write(
                "    Quitar el curso lo saca del acta; esos registros quedan sin "
                "referencia. Confirmá con Secretaría antes de aplicarlo.")

        if not confirmar:
            self.stdout.write(self.style.WARNING(
                "\n  SIMULACIÓN. Agrega --confirmar para aplicarlo."))
            return

        with transaction.atomic():
            it.delete()
            restantes = list(enr.items.select_related("plan_course").all())
            enr.total_credits = sum(int(i.credits or 0) for i in restantes)
            enr.save(update_fields=["total_credits"])
            sems = [int(i.plan_course.semester) for i in restantes
                    if getattr(i.plan_course, "semester", None)]
            if sems and (st.ciclo or 0) != max(sems):
                st.ciclo = max(sems)
                st.save(update_fields=["ciclo", "updated_at"])
        self.stdout.write(self.style.SUCCESS(
            f"\n  ✔ Curso quitado. La matrícula queda con {len(restantes)} curso(s) "
            f"y {enr.total_credits} créditos."))

    # ═══════════════════════════════════ ACTA DE UNA SECCIÓN
    def ver_seccion(self, raw_id):
        """Muestra el acta de una sección exactamente como la calcula el sistema.

        Sirve para zanjar un reclamo de "no aparece el alumno X": si acá figura,
        el backend está bien y hay que mirar el navegador (caché, build viejo) o
        si el docente está entrando a otra sección.
        """
        from academic.views.acta_excel import _items_de_seccion, _roster

        try:
            sec = (Section.objects
                   .select_related("plan_course", "plan_course__course",
                                   "plan_course__plan", "plan_course__plan__career",
                                   "teacher__user")
                   .get(id=int(raw_id)))
        except (ValueError, Section.DoesNotExist):
            self.stdout.write(self.style.ERROR(f"No existe la sección #{raw_id}"))
            return

        pc = sec.plan_course
        curso = getattr(pc, "effective_name", "") if pc else ""
        carrera = (pc.plan.career.name if pc and pc.plan and pc.plan.career else "")
        docente = ""
        if sec.teacher and sec.teacher.user:
            docente = sec.teacher.user.full_name or sec.teacher.user.username

        self._t(f"ACTA DE LA SECCIÓN #{sec.id} — {curso} '{sec.label}'")
        self.stdout.write(f"  Programa : {carrera}")
        self.stdout.write(f"  Ciclo    : {pc.semester if pc else '?'}"
                          f"   Período: {sec.period}   Plan: {pc.plan_id if pc else '?'}")
        self.stdout.write(f"  Docente  : {docente or '(sin asignar)'}")

        hermanas = (Section.objects
                    .filter(plan_course_id=sec.plan_course_id, period=sec.period)
                    .exclude(id=sec.id))
        if hermanas.exists():
            self.stdout.write("  Otras secciones del mismo curso: "
                              + ", ".join(f"#{s.id} '{s.label}'" for s in hermanas))

        roster = _roster(sec)
        _base, ambiguos = _items_de_seccion(sec)

        self.stdout.write(f"\n  EN EL ACTA ({len(roster)} alumno(s)):")
        for i, r in enumerate(roster, 1):
            marca = f"  [{r['estado']}]" if r["estado"] else ""
            self.stdout.write(f"    {i:>3}  {r['dni']:<10} {r['nombre']}{marca}")

        if ambiguos:
            self.stdout.write(self.style.WARNING(
                f"\n  SIN UBICAR ({len(ambiguos)}): matriculados en el curso sin "
                f"sección asignada, con varias secciones en juego"))
            for it in ambiguos:
                st = it.enrollment.student
                self.stdout.write(f"      · {st.num_documento:<10} {nombre_oficial(st)}")

        # Nómina del ciclo: lo que vería el documento (mismo criterio que
        # academic/views/nominas.py — carrera + Student.ciclo + matrícula)
        if pc and pc.plan and pc.plan.career_id and pc.semester:
            nomina = (Student.objects
                      .filter(plan__career_id=pc.plan.career_id,
                              ciclo=pc.semester,
                              enrollments__period=sec.period,
                              enrollments__status=CONFIRMED)
                      .distinct().order_by("apellido_paterno", "apellido_materno", "nombres"))
            en_acta = {r["dni"] for r in roster}
            self.stdout.write(f"\n  EN LA NÓMINA DEL CICLO ({nomina.count()} alumno(s)):")
            for st in nomina:
                falta = "  ← NO está en el acta" if st.num_documento not in en_acta else ""
                extra = f"  [{st.estado_academico}]" if st.estado_academico else ""
                self.stdout.write(
                    f"      · {st.num_documento:<10} {nombre_oficial(st)}{extra}{falta}")
            solo_acta = [r for r in roster
                         if r["dni"] not in {s.num_documento for s in nomina}]
            if solo_acta:
                self.stdout.write(
                    "\n  En el acta pero NO en la nómina del ciclo "
                    "(subsanación, licencia o ciclo desfasado):")
                for r in solo_acta:
                    self.stdout.write(f"      · {r['dni']:<10} {r['nombre']}")

    # ═══════════════════════════════ CRUCE CON LA NÓMINA OFICIAL
    def cruzar_nomina(self, ruta):
        """Compara la nómina oficial (el Excel que se envía a la DRE) con la base.

        Es la única verificación que no depende del sistema: la nómina es el
        documento firmado. Responde tres preguntas de golpe:
          · quién está en la nómina y NO en el sistema (o sin matrícula)
          · qué nombres no coinciden con el documento oficial
          · quién está matriculado en el sistema y NO en la nómina
        """
        from academic.models import Enrollment

        if not os.path.exists(ruta):
            self.stdout.write(self.style.ERROR(f"No existe el archivo {ruta}"))
            return

        oficial = {}
        with open(ruta, newline="", encoding="utf-8-sig") as fh:
            for fila in csv.DictReader(fh, delimiter=";"):
                dni = (fila.get("dni") or "").strip()
                if not dni or not dni.isdigit():
                    continue
                oficial[dni] = ((fila.get("apellidos_nombres") or "").strip(),
                                (fila.get("hoja") or "").strip())

        self._t(f"CRUCE CON LA NÓMINA OFICIAL — {len(oficial)} alumno(s) en el documento"
                + (f" · período {self.period}" if self.period else ""))
        if not oficial:
            self.stdout.write(self.style.ERROR(
                "El CSV no tiene filas válidas. Se esperan columnas hoja;dni;apellidos_nombres"))
            return

        # Se buscan las fichas por todas las variantes del DNI (con y sin cero
        # inicial), porque el Excel lo guarda como número
        variantes = set()
        for dni in oficial:
            variantes |= _dnis_equivalentes(dni)
        fichas = {}
        for st in Student.objects.select_related("user").filter(
                num_documento__in=sorted(variantes)):
            for v in _dnis_equivalentes(st.num_documento):
                fichas[v] = st

        matriculados = set()
        enr = Enrollment.objects.filter(status=CONFIRMED)
        if self.period:
            enr = enr.filter(period=self.period)
        for dni in enr.values_list("student__num_documento", flat=True):
            if dni:
                matriculados |= _dnis_equivalentes(dni)

        sin_ficha, sin_matricula, nombre_distinto = [], [], []
        for dni, (nombre_of, hoja) in sorted(oficial.items()):
            st = fichas.get(dni)
            if not st:
                sin_ficha.append((hoja, dni, nombre_of))
                continue
            if dni not in matriculados:
                sin_matricula.append((hoja, dni, nombre_of, st.ciclo, st.id))
            en_base = nombre_oficial(st)
            if _clave_nombre(nombre_of) != _clave_nombre(en_base):
                nombre_distinto.append((hoja, dni, nombre_of, en_base,
                                        _clasificar_nombre(nombre_of, en_base)))

        en_nomina = set()
        for dni in oficial:
            en_nomina |= _dnis_equivalentes(dni)

        # En la Nómina de Matrícula figuran solo los REGULARES: quien está
        # matriculado con un estado especial (subsanación sobre todo) tiene que
        # estar fuera del documento y lleva sus actas aparte. Por eso se separa
        # lo esperado de lo que hay que revisar.
        sobrantes = sorted(
            {st.num_documento: (
                st.num_documento, nombre_oficial(st), st.ciclo,
                st.estado_academico or "regular",
                "correcto: no va en la nómina" if st.estado_academico
                else "REVISAR: regular fuera del documento",
            )
             for st in Student.objects.filter(num_documento__in=sorted(matriculados))
             if st.num_documento not in en_nomina}.values())

        self._h("N1_en_nomina_sin_ficha",
                "Están en la nómina oficial y NO tienen ficha en el sistema",
                sin_ficha, ["hoja", "dni", "nombre_oficial"])
        self._h("N2_en_nomina_sin_matricula",
                "Están en la nómina oficial y NO tienen matrícula confirmada",
                sin_matricula, ["hoja", "dni", "nombre_oficial", "ciclo_sistema", "student_id"])
        self._h("N3_nombre_distinto_a_la_nomina",
                "El nombre del sistema no coincide con el de la nómina oficial",
                nombre_distinto,
                ["hoja", "dni", "en_la_nomina", "en_el_sistema", "tipo"])
        self._h("N4_matriculados_fuera_de_nomina",
                "Matriculados en el sistema que NO están en la nómina oficial "
                "(los de estado especial es correcto que no figuren)",
                sobrantes, ["dni", "nombre_sistema", "ciclo", "estado", "diagnostico"],
                grave=False)

    # ═══════════════════════════════════ FUSIÓN DE FICHAS DUPLICADAS
    def fusionar(self, arg, confirmar):
        """Pasa el kárdex de una ficha duplicada a la ficha buena.

        Las fichas duplicadas por un DNI mal tipeado suelen tener el kárdex
        PARTIDO: los ciclos viejos en una y los nuevos en la otra. Borrar la
        que "no tiene matrícula" perdería esa historia, así que primero hay
        que mover las notas.

        `AcademicGradeRecord` no tiene restricción de unicidad, de modo que
        mover a ciegas duplicaría las notas que estén en las dos fichas. Aquí
        se mueve solo lo que NO choca; los choques se listan con las dos notas
        para que una persona decida. No se borra nada, nunca.
        """
        partes = [p.strip() for p in str(arg).replace(" ", ",").split(",") if p.strip()]
        if len(partes) != 2:
            self.stdout.write(self.style.ERROR(
                "Usa --fusionar DNI_ORIGEN,DNI_DESTINO (el destino es la ficha que se queda)"))
            return

        origen = Student.objects.filter(num_documento=partes[0]).first()
        destino = Student.objects.filter(num_documento=partes[1]).first()
        if not origen or not destino:
            self.stdout.write(self.style.ERROR(
                f"No se encontró {'origen ' + partes[0] if not origen else ''}"
                f"{' y ' if not origen and not destino else ''}"
                f"{'destino ' + partes[1] if not destino else ''}"))
            return
        if origen.pk == destino.pk:
            self.stdout.write(self.style.ERROR("Origen y destino son la misma ficha"))
            return

        self._t(f"FUSIÓN — {nombre_oficial(origen)}")
        self.stdout.write(f"  ORIGEN  : DNI {origen.num_documento} (id {origen.pk}) "
                          f"ciclo {origen.ciclo} · {origen.grade_records.count()} nota(s) · "
                          f"{origen.enrollments.count()} matrícula(s)")
        self.stdout.write(f"  DESTINO : DNI {destino.num_documento} (id {destino.pk}) "
                          f"ciclo {destino.ciclo} · {destino.grade_records.count()} nota(s) · "
                          f"{destino.enrollments.count()} matrícula(s)")

        if nombre_oficial(origen) != nombre_oficial(destino):
            self.stdout.write(self.style.ERROR(
                f"  ⛔ Los nombres NO coinciden ('{nombre_oficial(destino)}'). "
                f"Se cancela: revisa que sean la misma persona."))
            return
        if origen.enrollments.exists():
            self.stdout.write(self.style.ERROR(
                "  ⛔ La ficha de origen tiene matrículas. Esta herramienta solo "
                "mueve kárdex; una matrícula hay que reasignarla a mano."))
            return

        ya_tiene = {(r.course_id, r.term): r
                    for r in destino.grade_records.select_related("course")}
        mover, choques = [], []
        for rec in origen.grade_records.select_related("course").order_by("term"):
            gemela = ya_tiene.get((rec.course_id, rec.term))
            if gemela:
                choques.append((rec, gemela))
            else:
                mover.append(rec)

        self.stdout.write(f"\n  Notas a mover: {len(mover)}")
        for rec in mover:
            self.stdout.write(f"    → {rec.term or '(sin período)':<10} "
                              f"{(rec.course.name or '')[:46]:<46} {rec.final_grade}")
        if choques:
            self.stdout.write(self.style.WARNING(
                f"\n  Choques (ya existen en el destino): {len(choques)} — NO se tocan"))
            for rec, gemela in choques:
                self.stdout.write(
                    f"    · {rec.term or '?':<10} {(rec.course.name or '')[:40]:<40} "
                    f"origen={rec.final_grade} destino={gemela.final_grade}")

        if not confirmar:
            self.stdout.write(self.style.WARNING(
                "\n  SIMULACIÓN. Agrega --confirmar para aplicarlo."))
            return
        if not mover:
            self.stdout.write("\n  Nada que mover.")
            return

        with transaction.atomic():
            for rec in mover:
                rec.student = destino
                rec.save(update_fields=["student"])
        self.stdout.write(self.style.SUCCESS(
            f"\n  ✔ {len(mover)} nota(s) movida(s) a la ficha {destino.num_documento}."))
        self.stdout.write(
            f"  La ficha de origen (id {origen.pk}) queda con "
            f"{origen.grade_records.count()} nota(s). Revísala y, si quedó vacía, "
            f"elimínala desde Estudiantes.")

    def _periodos_validos(self):
        """Códigos de período que existen realmente en el sistema."""
        from academic.models import AcademicPeriod, Enrollment
        codigos = set()
        for qs, campo in ((Enrollment.objects, "period"),
                          (Section.objects, "period"),
                          (AcademicPeriod.objects, "code")):
            try:
                codigos |= {p for p in qs.values_list(campo, flat=True).distinct() if p}
            except Exception:
                pass
        return codigos

    # ═══════════════════════════════════ RADIOGRAFÍA DE UN ALUMNO
    def radiografia(self, dni):
        from academic.models import Enrollment, PlanCourse

        st = Student.objects.select_related("user", "plan").filter(
            num_documento=dni).first()
        if not st:
            self.stdout.write(self.style.ERROR(f"No existe ficha con DNI {dni}"))
            return

        self._t(f"RADIOGRAFÍA — {nombre_oficial(st)}  (DNI {dni})")
        self.stdout.write(f"  Student id  : {st.id}")
        self.stdout.write(f"  Ficha       : ap='{st.apellido_paterno}' "
                          f"am='{st.apellido_materno}' nom='{st.nombres}'")
        self.stdout.write(f"  Cuenta      : {st.user.username if st.user_id else '(sin cuenta)'}"
                          + (f"  full_name='{st.user.full_name}'" if st.user_id else ""))
        self.stdout.write(f"  Ciclo       : {st.ciclo}   Plan: {st.plan_id} "
                          f"({getattr(st.plan, 'name', '—')})")
        self.stdout.write(f"  Período     : {st.periodo}   Estado: "
                          f"{st.estado_academico or 'normal'} {st.estado_rd}")
        self.stdout.write(f"  Programa    : {st.programa_carrera}")

        # ── Todo lo que cuelga de esta ficha ──
        # Imprescindible antes de borrar un duplicado: si tiene notas o pagos,
        # borrarla pierde historial. Se recorren las relaciones inversas reales
        # del modelo, así que no se omite nada aunque se agreguen tablas nuevas.
        self.stdout.write("\n  Datos vinculados a esta ficha:")
        vinculados = 0
        for rel in st._meta.related_objects:
            try:
                acc = rel.get_accessor_name()
                obj = getattr(st, acc, None)
                n = obj.count() if hasattr(obj, "count") else (1 if obj else 0)
            except Exception:
                continue
            if n:
                vinculados += n
                self.stdout.write(f"    · {rel.related_model._meta.label}: {n}")
        if not vinculados:
            self.stdout.write(self.style.WARNING(
                "    (ninguno — la ficha está vacía, se puede eliminar sin perder nada)"))

        # ── Kárdex: imprescindible para decidir una fusión de fichas ──
        notas = list(st.grade_records.select_related("course").order_by("term", "course__name"))
        if notas:
            self.stdout.write(f"\n  Kárdex ({len(notas)} nota(s)):")
            term_actual = None
            for rec in notas:
                if rec.term != term_actual:
                    term_actual = rec.term
                    self.stdout.write(f"    {term_actual or '(sin período)'}:")
                self.stdout.write(
                    f"      · {(rec.course.name or '')[:52]:<52} {rec.final_grade}")

        matriculas = list(Enrollment.objects.filter(student=st).order_by("period"))
        if not matriculas:
            self.stdout.write(self.style.ERROR(
                "\n  ⛔ NO TIENE NINGUNA MATRÍCULA. Por eso no aparece en nóminas "
                "ni en actas: hay que matricularlo."))
            return

        for e in matriculas:
            items = list(e.items.select_related(
                "plan_course", "plan_course__course", "section").all())
            estilo = self.style.SUCCESS if e.status == CONFIRMED else self.style.WARNING
            self.stdout.write(estilo(
                f"\n  Matrícula {e.period} [{e.status}] — {len(items)} curso(s), "
                f"{e.total_credits} créditos"))
            for it in sorted(items, key=lambda i: getattr(i.plan_course, "effective_name", "")):
                pc = it.plan_course
                secs = Section.objects.filter(plan_course=pc, period=e.period)
                marca = "sin sección" if it.section_id is None else (
                    f"sección '{it.section.label}' (#{it.section_id})")
                aviso = ""
                if it.section_id is None and secs.count() > 1:
                    aviso = "  ⚠ AMBIGUO: el curso tiene varias secciones"
                self.stdout.write(
                    f"    · {getattr(pc, 'effective_name', '')[:52]:<52} "
                    f"ciclo {pc.semester} | {marca}{aviso}")

            # cursos obligatorios del ciclo del alumno que NO están en la matrícula
            if st.plan_id and st.ciclo and e.status == CONFIRMED:
                esperados = PlanCourse.objects.filter(
                    plan_id=st.plan_id, semester=st.ciclo)
                tiene = {it.plan_course_id for it in items}
                faltan = [pc for pc in esperados if pc.id not in tiene]
                if faltan:
                    self.stdout.write(self.style.ERROR(
                        f"    ⛔ Le faltan {len(faltan)} curso(s) del ciclo {st.ciclo} "
                        f"en esta matrícula:"))
                    for pc in faltan:
                        n = Section.objects.filter(plan_course=pc, period=e.period).count()
                        self.stdout.write(
                            f"       – {getattr(pc, 'effective_name', '')[:52]:<52} "
                            f"({pc.type}, {n} sección(es) creada(s))")
                else:
                    self.stdout.write(self.style.SUCCESS(
                        f"    ✔ Tiene todos los cursos del ciclo {st.ciclo}"))

    # ══════════════════════════════════════════════════════ A) NOMBRES
    def bloque_nombres(self):
        self._t("A) NOMBRES DE ESTUDIANTES")
        alumnos = list(Student.objects.select_related("user").all())
        self.stdout.write(f"  Fichas de estudiante: {len(alumnos)}\n")

        # Códigos de período que existen de verdad (para decidir qué se puede
        # normalizar solo y qué necesita criterio humano)
        periodos_validos = self._periodos_validos()

        sin_normalizar, full_name_viejo, incompletos = [], [], []
        periodo_raro = []
        por_nombre = defaultdict(list)

        for st in alumnos:
            oficial = nombre_oficial(st)

            crudos = [(c, getattr(st, c, "") or "") for c in
                      ("apellido_paterno", "apellido_materno", "nombres")]
            if any(v != normalizar(v) for _c, v in crudos):
                sin_normalizar.append((st.num_documento, oficial,
                                       " / ".join(f"{c}={v!r}" for c, v in crudos)))

            if st.user_id:
                actual = st.user.full_name or ""
                if oficial and actual != oficial:
                    full_name_viejo.append((st.num_documento, actual, oficial))

            if not apellidos_de(st) or not nombres_de(st):
                incompletos.append((st.num_documento, oficial or "(vacío)",
                                    f"ap='{apellidos_de(st)}' nom='{nombres_de(st)}'"))

            # Student.periodo: la nómina en modo "admitidos" lo compara como
            # texto exacto, así que "2026- I" (con espacio) deja al alumno fuera.
            # OJO: este campo es el período de INGRESO del alumno, no el actual:
            # "2018-II" es un valor perfectamente válido. Solo se marca lo que
            # está mal escrito (espacios de más, minúsculas), no lo que sea viejo.
            crudo = st.periodo or ""
            limpio = _periodo_limpio(crudo)
            if crudo and crudo != limpio:
                periodo_raro.append((st.num_documento, oficial, repr(crudo), limpio,
                                     _diagnostico_periodo(limpio, periodos_validos)))

            if oficial:
                por_nombre[oficial].append(st)

        duplicados = []
        for nombre, sts in por_nombre.items():
            if len(sts) > 1:
                duplicados.append((nombre, ", ".join(s.num_documento or "?" for s in sts),
                                   ", ".join(str(s.id) for s in sts)))

        self._h("A1_nombres_sin_normalizar",
                "Fichas con nombres en minúsculas o con espacios sobrantes",
                sin_normalizar, ["dni", "nombre_oficial", "valores_crudos"], grave=False)
        self._h("A2_full_name_desactualizado",
                "Cuentas con el nombre desactualizado (User.full_name ≠ ficha)",
                full_name_viejo, ["dni", "full_name_actual", "deberia_ser"])
        self._h("A3_nombres_incompletos",
                "Fichas sin apellidos o sin nombres",
                incompletos, ["dni", "nombre_oficial", "campos"])
        self._h("A4_posibles_duplicados",
                "Mismo nombre con DNI distinto (revisar si es la misma persona)",
                duplicados, ["nombre", "dnis", "ids"], grave=False)
        self._h("A5_periodo_mal_escrito",
                "Fichas con el período de ingreso mal escrito, ej. '2026- I' "
                "(la nómina lo compara como texto exacto)",
                periodo_raro, ["dni", "alumno", "valor_actual", "normalizado", "diagnostico"])

        if self.arreglar:
            n1 = n2 = n3 = 0
            with transaction.atomic():
                # período de la ficha: se normaliza SOLO si el resultado es un
                # código que existe de verdad. '2026-l' (L minúscula) o
                # '2026- 1' (dígito uno) quedarían en '2026-L' / '2026-1', que
                # siguen estando mal: esos los decide una persona.
                for st in alumnos:
                    limpio = _periodo_limpio(st.periodo or "")
                    if (st.periodo and limpio != st.periodo
                            and limpio in periodos_validos):
                        st.periodo = limpio
                        st.save(update_fields=["periodo", "updated_at"])
                        n3 += 1
                for st in alumnos:
                    # se anota antes: al guardar la ficha, la señal post_save ya
                    # sincroniza el nombre de la cuenta (students/signals.py)
                    esperado = nombre_oficial(st)
                    desfasado = bool(st.user_id and esperado
                                     and (st.user.full_name or "") != esperado)
                    if normalizar_campos_student(st):     # guarda si cambió
                        n1 += 1
                    if sync_user_full_name(st) or desfasado:
                        n2 += 1
            self.stdout.write(self.style.SUCCESS(
                f"  ✔ ARREGLADO: {n1} ficha(s) normalizada(s), "
                f"{n2} nombre(s) de cuenta recalculado(s), "
                f"{n3} período(s) corregido(s)"))

    # ═════════════════════════════════════════════════════ B) MATRÍCULA
    def _items(self):
        qs = (EnrollmentItem.objects
              .select_related("enrollment", "enrollment__student",
                              "plan_course", "plan_course__course", "section")
              .filter(enrollment__status=CONFIRMED))
        if self.period:
            qs = qs.filter(enrollment__period=self.period)
        return qs

    def bloque_matricula(self):
        self._t("B) MATRÍCULA Y SECCIONES")
        items = list(self._items())
        self.stdout.write(f"  Ítems de matrícula confirmados: {len(items)}\n")

        # secciones por (plan_course, período)
        secs = defaultdict(list)
        sqs = Section.objects.all()
        if self.period:
            sqs = sqs.filter(period=self.period)
        for s in sqs:
            secs[(s.plan_course_id, s.period)].append(s)

        sin_sec_con_sec, sin_sec_sin_curso = [], []
        seccion_incoherente, plan_distinto = [], []
        por_alumno = defaultdict(lambda: [0, 0])   # dni → [items, con_sección]

        for it in items:
            en = it.enrollment
            st = en.student
            pc = it.plan_course
            curso = getattr(pc, "effective_name", "") or ""
            fila_base = (st.num_documento, nombre_oficial(st), curso, en.period)
            disponibles = secs.get((it.plan_course_id, en.period), [])

            k = st.num_documento or f"id{st.id}"
            por_alumno[k][0] += 1
            if it.section_id:
                por_alumno[k][1] += 1

            if it.section_id is None:
                if disponibles:
                    sin_sec_con_sec.append(fila_base + (
                        len(disponibles),
                        ", ".join(s.label for s in disponibles),
                        "SE PUEDE ARREGLAR" if len(disponibles) == 1 else "AMBIGUO: asignar a mano",
                    ))
                else:
                    sin_sec_sin_curso.append(fila_base + ("sin sección creada",))
            else:
                sec = it.section
                if sec and (sec.plan_course_id != it.plan_course_id
                            or sec.period != en.period):
                    seccion_incoherente.append(fila_base + (
                        f"sección #{sec.id} '{sec.label}'",
                        f"curso_sección={sec.plan_course_id} vs ítem={it.plan_course_id}",
                        f"periodo_sección={sec.period}",
                    ))

            if st.plan_id and pc.plan_id and st.plan_id != pc.plan_id:
                plan_distinto.append(fila_base + (st.plan_id, pc.plan_id))

        sin_ninguna = [(dni, n[0]) for dni, n in sorted(por_alumno.items()) if n[1] == 0]

        self._h("B1_items_sin_seccion_arreglables",
                "Matriculados sin sección PERO con sección creada  ← no salen en el acta",
                sin_sec_con_sec,
                ["dni", "alumno", "curso", "periodo", "n_secciones", "secciones", "accion"])
        self._h("B2_items_sin_seccion_sin_curso",
                "Matriculados sin sección porque el curso no tiene sección creada",
                sin_sec_sin_curso, ["dni", "alumno", "curso", "periodo", "nota"], grave=False)
        self._h("B3_seccion_incoherente",
                "Ítems apuntando a una sección de otro curso o de otro período",
                seccion_incoherente,
                ["dni", "alumno", "curso", "periodo", "seccion", "curso_cmp", "periodo_cmp"])
        self._h("B4_plan_distinto",
                "Alumnos llevando un curso de un plan distinto al suyo (reingreso)",
                plan_distinto, ["dni", "alumno", "curso", "periodo",
                                "plan_alumno", "plan_curso"], grave=False)
        self._h("B5_sin_ninguna_seccion",
                "Matriculados que no aparecen en NINGÚN acta (ni un ítem con sección)",
                sin_ninguna, ["dni", "items"])

        # ── B7 / B8: cursos que faltan en la matrícula ──
        # Se recorren las MATRÍCULAS (no los ítems): una matrícula con 0 cursos
        # no aparecería si se partiera de los ítems, y es justo el caso grave.
        #
        # Causa conocida: al eliminar una sección se borraban los ítems de
        # matrícula de sus alumnos (academic/views/sections.py, ya corregido).
        # El alumno quedaba CONFIRMADO y con sus créditos, pero sin cursos:
        # seguía en la nómina y desaparecía de todas las actas.
        from academic.models import Enrollment, PlanCourse

        enr_qs = Enrollment.objects.select_related("student").filter(status=CONFIRMED)
        if self.period:
            enr_qs = enr_qs.filter(period=self.period)
        matriculas = list(enr_qs)

        cursos_por_matricula = defaultdict(set)
        sem_por_matricula = defaultdict(list)
        for it in items:
            cursos_por_matricula[it.enrollment_id].add(it.plan_course_id)
            sem = getattr(it.plan_course, "semester", None)
            if sem:
                sem_por_matricula[it.enrollment_id].append(int(sem))

        # ── B9: la ficha no refleja su propia matrícula ──
        # `Student.ciclo` y `Student.periodo` se derivan de la matrícula
        # (academic/views/enrollment.py: ciclo = semestre más alto de los cursos
        # confirmados). Cuando quedan desfasados, el alumno DESAPARECE DE SU
        # NÓMINA, porque nominas.py filtra por Student.ciclo — aunque su acta
        # esté perfecta. Es el síntoma inverso al de una matrícula sin cursos.
        ultima = {}
        for en in matriculas:
            prev = ultima.get(en.student_id)
            if prev is None or (en.period or "") > (prev.period or ""):
                ultima[en.student_id] = en

        desfasadas = []
        self.fichas_a_sincronizar = []
        for en in ultima.values():
            st = en.student
            sems = sem_por_matricula.get(en.id, [])
            if not sems:
                continue
            ciclo_ok = max(sems)
            malo_ciclo = (st.ciclo or 0) != ciclo_ok
            malo_periodo = (st.periodo or "") != (en.period or "")
            if malo_ciclo or malo_periodo:
                desfasadas.append((
                    st.num_documento, nombre_oficial(st),
                    st.ciclo, ciclo_ok if malo_ciclo else "ok",
                    st.periodo, en.period if malo_periodo else "ok",
                    "NO SALE EN SU NÓMINA" if malo_ciclo else "solo el período",
                ))
                self.fichas_a_sincronizar.append((st, ciclo_ok, en.period))

        self._h("B9_ficha_desfasada_de_su_matricula",
                "Ficha con ciclo/período que no coinciden con su matrícula "
                "← con el ciclo mal, el alumno no aparece en su nómina",
                desfasadas, ["dni", "alumno", "ciclo_ficha", "ciclo_correcto",
                             "periodo_ficha", "periodo_correcto", "efecto"])

        pcs_por_plan_ciclo = defaultdict(list)
        for pc in PlanCourse.objects.select_related("course").all():
            pcs_por_plan_ciclo[(pc.plan_id, pc.semester)].append(pc)

        # Cursos YA APROBADOS por cada alumno: un curso aprobado no puede estar
        # "faltando" en su matrícula. Es lo que pasa con los de SUBSANACIÓN, que
        # se rematriculan solo en lo que desaprobaron — su matrícula está bien.
        #
        # Solo cuenta si lo aprobó EN SU PLAN ACTUAL: quien se trasladó de
        # programa (p. ej. Inicial → Educación Física) tiene aprobados cursos
        # homónimos del plan anterior que no convalidan, y si los diéramos por
        # buenos taparíamos un curso que de verdad le falta.
        from academic.models import AcademicGradeRecord
        from academic.views.utils import PASSING_GRADE
        plan_de = {en.student_id: en.student.plan_id for en in matriculas}
        aprobados = set()
        for sid, cid, pc_plan in (
                AcademicGradeRecord.objects
                .filter(student_id__in=list(plan_de.keys()),
                        final_grade__gte=PASSING_GRADE)
                .values_list("student_id", "course_id", "plan_course__plan_id")):
            # plan_course nulo = registro viejo sin plan: se acepta
            if pc_plan is None or pc_plan == plan_de.get(sid):
                aprobados.add((sid, cid))

        faltantes, vacias = [], []
        self.restaurables = []
        for en in matriculas:
            st = en.student
            tiene = cursos_por_matricula.get(en.id, set())
            # Se compara contra el ciclo que se deduce de la MATRÍCULA, no
            # contra Student.ciclo: si ese campo está desfasado (ver B9) se
            # listarían como "faltantes" cursos que el alumno ya aprobó.
            sems = sem_por_matricula.get(en.id, [])
            ciclo_ref = max(sems) if sems else st.ciclo
            esperados = pcs_por_plan_ciclo.get((st.plan_id, ciclo_ref), []) \
                if (st.plan_id and ciclo_ref) else []
            obligatorios = [pc for pc in esperados if pc.type == "MANDATORY"]
            creditos_esperados = sum(int(pc.credits or 0) for pc in obligatorios)

            if not tiene:
                cuadra = (creditos_esperados == int(en.total_credits or 0)
                          and creditos_esperados > 0)
                vacias.append((
                    st.num_documento, nombre_oficial(st), en.period, st.ciclo,
                    en.total_credits, len(obligatorios), creditos_esperados,
                    "RESTAURABLE (los créditos cuadran)" if cuadra else "revisar a mano",
                ))
                if cuadra:
                    self.restaurables.append((en, obligatorios))
                continue

            for pc in esperados:
                if pc.id in tiene:
                    continue
                if (st.id, pc.course_id) in aprobados:
                    continue          # ya lo aprobó: no le falta
                n_sec = len(secs.get((pc.id, en.period), []))
                faltantes.append((
                    st.num_documento, nombre_oficial(st), ciclo_ref,
                    getattr(pc, "effective_name", ""), pc.type, en.period, n_sec,
                ))

        self._h("B8_matriculas_sin_cursos",
                "Matrículas CONFIRMADAS con 0 cursos  ← en la nómina pero en ninguna acta",
                vacias, ["dni", "alumno", "periodo", "ciclo", "creditos_registrados",
                         "cursos_del_ciclo", "creditos_del_ciclo", "diagnostico"])
        self._h("B7_cursos_faltantes_en_matricula",
                "Cursos del ciclo que faltan en matrículas que sí tienen otros cursos",
                faltantes, ["dni", "alumno", "ciclo", "curso_faltante", "tipo",
                            "periodo", "secciones_del_curso"])

        if self.arreglar and self.fichas_a_sincronizar:
            n = 0
            with transaction.atomic():
                for st, ciclo_ok, periodo_ok in self.fichas_a_sincronizar:
                    st.ciclo, st.periodo = ciclo_ok, periodo_ok
                    st.save(update_fields=["ciclo", "periodo", "updated_at"])
                    n += 1
            self.stdout.write(self.style.SUCCESS(
                f"  ✔ ARREGLADO: {n} ficha(s) sincronizada(s) con su matrícula "
                f"(ciclo y período) — ya aparecen en su nómina"))

        if self.restaurar and self.restaurables:
            creados = 0
            with transaction.atomic():
                for en, obligatorios in self.restaurables:
                    for pc in obligatorios:
                        lista = secs.get((pc.id, en.period), [])
                        EnrollmentItem.objects.get_or_create(
                            enrollment=en, plan_course=pc,
                            defaults={"credits": int(pc.credits or 0),
                                      "section": lista[0] if len(lista) == 1 else None},
                        )
                        creados += 1
            self.stdout.write(self.style.SUCCESS(
                f"  ✔ RESTAURADO: {creados} curso(s) devuelto(s) a "
                f"{len(self.restaurables)} matrícula(s) vacía(s)"))
        elif self.restaurables:
            self.stdout.write(self.style.WARNING(
                f"  → {len(self.restaurables)} matrícula(s) se pueden restaurar "
                f"(los créditos cuadran exactamente): usa --restaurar-matriculas"))

        # variantes de período
        per_e = sorted({p for p in EnrollmentItem.objects
                        .values_list("enrollment__period", flat=True).distinct() if p})
        per_s = sorted({p for p in Section.objects
                        .values_list("period", flat=True).distinct() if p})
        huerfanos = [(p, "solo en matrículas") for p in per_e if p not in per_s]
        huerfanos += [(p, "solo en secciones") for p in per_s if p not in per_e]
        self.stdout.write(f"\n  Períodos en matrículas: {', '.join(per_e) or '—'}")
        self.stdout.write(f"  Períodos en secciones : {', '.join(per_s) or '—'}")
        self._h("B6_periodos_huerfanos",
                "Códigos de período que no coinciden entre matrículas y secciones",
                huerfanos, ["periodo", "donde"], grave=False)

        if self.arreglar:
            arreglados = 0
            with transaction.atomic():
                for (pc_id, periodo), lista in secs.items():
                    if len(lista) != 1:
                        continue
                    arreglados += (EnrollmentItem.objects
                                   .filter(plan_course_id=pc_id,
                                           section__isnull=True,
                                           enrollment__status=CONFIRMED,
                                           enrollment__period=periodo)
                                   .update(section=lista[0]))
            self.stdout.write(self.style.SUCCESS(
                f"  ✔ ARREGLADO: {arreglados} ítem(s) asignado(s) a su única sección"))
            ambiguos = sum(1 for f in sin_sec_con_sec if f[-1].startswith("AMBIGUO"))
            if ambiguos:
                self.stdout.write(self.style.WARNING(
                    f"  ⚠ Quedan {ambiguos} caso(s) ambiguo(s) (el curso tiene varias "
                    f"secciones): hay que asignarlos a mano en Matrícula."))

    # ═══════════════════════════════════════════════════ C) COBERTURA
    def bloque_cobertura(self):
        self._t("C) COBERTURA DE ACTAS (matriculados vs. los que ve el acta)")
        from academic.views.acta_excel import _items_de_seccion

        sqs = (Section.objects
               .select_related("plan_course", "plan_course__course", "teacher__user"))
        if self.period:
            sqs = sqs.filter(period=self.period)

        filas = []
        for sec in sqs:
            total = (EnrollmentItem.objects
                     .filter(plan_course_id=sec.plan_course_id,
                             enrollment__status=CONFIRMED,
                             enrollment__period=sec.period)
                     .count())
            base, ambiguos = _items_de_seccion(sec)
            asignados_otras = total - len(base) - len(ambiguos)
            if ambiguos:
                filas.append((
                    sec.id,
                    getattr(sec.plan_course, "effective_name", ""),
                    sec.label, sec.period, total, len(base),
                    len(ambiguos), asignados_otras,
                ))
        self._h("C1_actas_incompletas",
                "Secciones con matriculados que el acta no puede ubicar",
                filas, ["section_id", "curso", "seccion", "periodo",
                        "matriculados_curso", "en_acta", "sin_ubicar", "en_otra_seccion"])

    # ══════════════════════════════════════════════════ D) ASISTENCIA
    def bloque_asistencia(self):
        self._t("D) ASISTENCIA")
        sqs = Section.objects.select_related("plan_course", "plan_course__course")
        if self.period:
            sqs = sqs.filter(period=self.period)
        secciones = list(sqs)

        con_horario = set(SectionScheduleSlot.objects
                          .values_list("section_id", flat=True).distinct())
        sesiones_por_sec = defaultdict(int)
        for sid in AttendanceSession.objects.values_list("section_id", flat=True):
            sesiones_por_sec[sid] += 1
        con_marcas = set(AttendanceRow.objects
                         .values_list("session__section_id", flat=True).distinct())

        sin_horario, sesiones_vacias = [], []
        for sec in secciones:
            nombre = getattr(sec.plan_course, "effective_name", "")
            if sec.id not in con_horario:
                sin_horario.append((sec.id, nombre, sec.label, sec.period))
            if sesiones_por_sec.get(sec.id) and sec.id not in con_marcas:
                sesiones_vacias.append((sec.id, nombre, sec.label, sec.period,
                                        sesiones_por_sec[sec.id]))

        self._h("D1_secciones_sin_horario",
                "Secciones sin horario configurado (la asistencia se habilita L-V)",
                sin_horario, ["section_id", "curso", "seccion", "periodo"], grave=False)
        self._h("D2_sesiones_sin_marcas",
                "Secciones con sesiones de asistencia creadas pero sin ninguna marca",
                sesiones_vacias, ["section_id", "curso", "seccion", "periodo", "sesiones"],
                grave=False)

    # ═══════════════════════════════════════════════════════ RESUMEN
    def resumen(self):
        self._t("RESUMEN")
        criticos = ("A2_full_name_desactualizado", "A3_nombres_incompletos",
                    "A5_periodo_mal_escrito",
                    "B1_items_sin_seccion_arreglables", "B3_seccion_incoherente",
                    "B5_sin_ninguna_seccion", "B7_cursos_faltantes_en_matricula",
                    "B8_matriculas_sin_cursos", "B9_ficha_desfasada_de_su_matricula",
                    "C1_actas_incompletas", "N1_en_nomina_sin_ficha",
                    "N2_en_nomina_sin_matricula", "N3_nombre_distinto_a_la_nomina")
        total_crit = sum(self.hallazgos.get(k, 0) for k in criticos)
        for clave, n in self.hallazgos.items():
            if n:
                marca = "!!" if clave in criticos else " ·"
                self.stdout.write(f"  {marca} {clave}: {n}")
        if not total_crit:
            self.stdout.write(self.style.SUCCESS("  Sin hallazgos críticos."))
        else:
            self.stdout.write(self.style.ERROR(f"\n  {total_crit} caso(s) crítico(s)."))
            if not self.arreglar:
                self.stdout.write(
                    "  Corre con --detalle para verlos, --csv ./informe para exportarlos "
                    "y --arreglar para aplicar las correcciones seguras.")
