"""
Limpieza de datos de asistencia ya grabados con los bugs corregidos el 2026-08-08:

  1. Sesiones en FIN DE SEMANA (sábado/domingo): basura segura — las creaba
     el viejo "Completar asistencias" / guardado sin validación del servidor.
  2. Sesiones en día de semana FUERA del horario configurado de la sección:
     ⚠️ AMBIGUAS — pueden ser basura del viejo "Completar" (que llenaba L-V)
     o dictado REAL con el horario mal configurado en la sección. Solo se
     listan; se borran únicamente con APLICAR_SEMANA=1 después de revisar
     los horarios de esas secciones.
  3. Marcas de asistencia de alumnos con LICENCIA (no se les registra).

SOLO LECTURA por defecto. Para aplicar:

    # Borra fines de semana + marcas de licencia (seguro):
    PERIODO=2026-I APLICAR=1 python manage.py shell < fix_asistencia_findes_licencia.py

    # Además borra los días de semana fuera de horario (revisar antes):
    PERIODO=2026-I APLICAR=1 APLICAR_SEMANA=1 python manage.py shell < fix_asistencia_findes_licencia.py

Uso normal (simulación):

    python manage.py shell < fix_asistencia_findes_licencia.py
"""
import os
from collections import defaultdict

from django.db import transaction

from academic.models import (Section, SectionScheduleSlot,
                             AttendanceSession, AttendanceRow,
                             EnrollmentItem, Enrollment)
from students.models import Student

PERIODO = os.environ.get("PERIODO", "2026-I")
APLICAR = os.environ.get("APLICAR", "") == "1"
APLICAR_SEMANA = os.environ.get("APLICAR_SEMANA", "") == "1"

print("=" * 78)
print(f"Limpieza de asistencia — período {PERIODO} — "
      f"{'APLICANDO CAMBIOS' if APLICAR else 'SIMULACIÓN (no borra nada)'}"
      + (" + DÍAS DE SEMANA FUERA DE HORARIO" if APLICAR and APLICAR_SEMANA else ""))
print("=" * 78)

secs = list(Section.objects.filter(period=PERIODO)
            .select_related("plan_course", "plan_course__course"))
horario = defaultdict(set)
for sid, wd in (SectionScheduleSlot.objects
                .filter(section__period=PERIODO)
                .values_list("section_id", "weekday")):
    horario[sid].add(wd)          # 1=Lunes … 7=Domingo

DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "SÁB", "DOM"]
NOMBRE_WD = {1: "Lun", 2: "Mar", 3: "Mié", 4: "Jue", 5: "Vie",
             6: "Sáb", 7: "Dom"}


def es_dia_dictado(sec_id, fecha):
    wd = fecha.weekday()          # 0=Lunes … 6=Domingo
    hs = horario.get(sec_id)
    return (wd + 1) in hs if hs else wd < 5


def _nombre_sec(sec):
    curso = sec.plan_course.effective_name if sec.plan_course else "?"
    return f"{curso} [{sec.label}]"


# ── 1) Sesiones en fin de semana (borrado seguro) ────────────────────────
# ── 2) Sesiones en día de semana fuera de horario (ambiguas) ─────────────
finde, semana = [], []
rows_finde = rows_semana = 0
for sec in secs:
    for sess in AttendanceSession.objects.filter(section=sec):
        if not sess.date or es_dia_dictado(sec.id, sess.date):
            continue
        n = AttendanceRow.objects.filter(session=sess).count()
        if sess.date.weekday() >= 5:
            finde.append((sec, sess, n)); rows_finde += n
        else:
            semana.append((sec, sess, n)); rows_semana += n

print(f"\n1) FIN DE SEMANA — basura segura: {len(finde)} sesiones "
      f"({rows_finde} marcas)")
for sec, sess, n in finde[:30]:
    print(f"   · {sess.date} ({DIAS[sess.date.weekday()]}) — {_nombre_sec(sec)}"
          f" — {n} marcas{' — CERRADA' if sess.closed else ''}")
if len(finde) > 30:
    print(f"   … y {len(finde) - 30} más")

print(f"\n2) DÍA DE SEMANA fuera del horario configurado — ⚠️ REVISAR: "
      f"{len(semana)} sesiones ({rows_semana} marcas)")
print("   Puede ser dictado real con el horario mal configurado. Antes de")
print("   borrar, corrige el horario de la sección si corresponde (Académico")
print("   → secciones → horario) y vuelve a correr la simulación.")
por_sec = defaultdict(list)
for sec, sess, n in semana:
    por_sec[sec.id].append((sec, sess, n))
for sec_id, lst in por_sec.items():
    sec = lst[0][0]
    hs = sorted(horario.get(sec_id, set()))
    hs_txt = ", ".join(NOMBRE_WD.get(w, str(w)) for w in hs) or "(sin horario → L-V)"
    dias_afectados = sorted({DIAS[s.date.weekday()] for _x, s, _n in lst})
    total = sum(n for _x, _s, n in lst)
    print(f"   · {_nombre_sec(sec)} — horario configurado: {hs_txt} — "
          f"{len(lst)} sesiones en {'/'.join(dias_afectados)} ({total} marcas)")

# ── 3) Marcas de alumnos con LICENCIA ────────────────────────────────────
lic_sts = list(Student.objects.filter(estado_academico__iexact="LICENCIA"))
print(f"\n3) Alumnos con LICENCIA: {len(lic_sts)}")

rows_lic = []
for st in lic_sts:
    pc_ids = list(
        EnrollmentItem.objects
        .filter(enrollment__student=st, enrollment__period=PERIODO)
        .exclude(enrollment__status=Enrollment.STATUS_CANCELLED)
        .values_list("plan_course_id", flat=True))
    sus_secs = Section.objects.filter(period=PERIODO,
                                      plan_course_id__in=pc_ids)
    claves = [st.id] + ([st.user_id] if st.user_id else [])
    qs = AttendanceRow.objects.filter(
        session__section__in=sus_secs, student_id__in=claves)
    n = qs.count()
    if n:
        rows_lic.append((qs, st, n))
        print(f"   · {st.apellido_paterno} {st.apellido_materno}, "
              f"{st.nombres}: {n} marcas a borrar")
total_lic = sum(n for _q, _s, n in rows_lic)
print(f"   Total marcas de licencia a borrar: {total_lic}")

# ── Aplicar ──────────────────────────────────────────────────────────────
if APLICAR:
    with transaction.atomic():
        for _sec, sess, _n in finde:
            sess.delete()             # borra la sesión y sus filas en cascada
        if APLICAR_SEMANA:
            for _sec, sess, _n in semana:
                sess.delete()
        for qs, _st, _n in rows_lic:
            qs.delete()
    print(f"\n✔ APLICADO: {len(finde)} sesiones de fin de semana ({rows_finde} "
          f"marcas) y {total_lic} marcas de licencia borradas."
          + (f" También {len(semana)} sesiones de día de semana fuera de "
             f"horario ({rows_semana} marcas)." if APLICAR_SEMANA else
             " Los días de semana fuera de horario NO se tocaron."))
else:
    print("\n(Simulación: nada fue borrado. APLICAR=1 borra fines de semana y")
    print(" licencias; añade APLICAR_SEMANA=1 para borrar también los días de")
    print(" semana fuera de horario, solo después de revisar los horarios.)")
