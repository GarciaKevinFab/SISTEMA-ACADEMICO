"""Enrollment.tipo_matricula — el tipo de la nómina oficial, por matrícula.

Pedido de Secretaría: clasificar cada matrícula como Ingresante / Regular /
Subsanación / Reincorporación / Traslado. Es un dato del PERÍODO, no del
alumno: quien se reincorporó en 2025-II vuelve a ser Regular en 2026-I.

El backfill deriva el tipo de las matrículas existentes:
  · la matrícula MÁS RECIENTE del alumno hereda su estado especial vigente
    (Student.estado_academico, acreditado por RD) si lo tiene;
  · la más antigua, sin historial de notas previo, es INGRESANTE;
  · el resto queda REGULAR.
Secretaría puede corregir casos puntuales desde el Padrón.
"""
import re

from django.db import migrations, models


_RE_TERM = re.compile(r"^(\d{4})-(I{1,3})$")
_ORD = {"I": 1, "II": 2, "III": 3}


def _key(period):
    """(año, semestre) para ordenar códigos de período; None si no parsea."""
    m = _RE_TERM.match((period or "").strip().upper())
    if not m:
        return None
    return int(m.group(1)), _ORD.get(m.group(2), 9)


def backfill(apps, schema_editor):
    Enrollment = apps.get_model("academic", "Enrollment")
    Record = apps.get_model("academic", "AcademicGradeRecord")
    Student = apps.get_model("students", "Student")

    ESPECIALES = {"SUBSANACION", "REINCORPORACION", "TRASLADO"}

    # Primer período con nota de cada alumno (historial importado incluido)
    primer_term = {}
    for sid, term in Record.objects.values_list("student_id", "term"):
        k = _key(term)
        if k and (sid not in primer_term or k < primer_term[sid]):
            primer_term[sid] = k

    estado = dict(Student.objects.exclude(estado_academico="")
                  .values_list("id", "estado_academico"))

    enrs = list(Enrollment.objects.filter(status="CONFIRMED")
                .values_list("id", "student_id", "period"))

    primera_enr, ultima_enr = {}, {}
    for eid, sid, period in enrs:
        k = _key(period)
        if k is None:
            continue
        if sid not in primera_enr or k < primera_enr[sid][0]:
            primera_enr[sid] = (k, eid)
        if sid not in ultima_enr or k > ultima_enr[sid][0]:
            ultima_enr[sid] = (k, eid)

    a_guardar = []
    for eid, sid, period in enrs:
        k = _key(period)
        tipo = "REGULAR"
        if k is not None:
            es_primera = primera_enr.get(sid, (None, None))[1] == eid
            sin_notas_previas = sid not in primer_term or primer_term[sid] >= k
            if es_primera and sin_notas_previas:
                tipo = "INGRESANTE"
            est = (estado.get(sid) or "").upper()
            if est in ESPECIALES and ultima_enr.get(sid, (None, None))[1] == eid:
                tipo = est
        a_guardar.append((eid, tipo))

    for eid, tipo in a_guardar:
        Enrollment.objects.filter(id=eid).update(tipo_matricula=tipo)


class Migration(migrations.Migration):

    dependencies = [
        ("academic", "0020_academicperiod_grades_state"),
        ("students", "0004_student_estado_academico"),
    ]

    operations = [
        migrations.AddField(
            model_name="enrollment",
            name="tipo_matricula",
            field=models.CharField(
                blank=True, default="", max_length=16,
                choices=[
                    ("", "—"),
                    ("INGRESANTE", "Ingresante"),
                    ("REGULAR", "Regular"),
                    ("SUBSANACION", "Subsanación"),
                    ("REINCORPORACION", "Reincorporación"),
                    ("TRASLADO", "Traslado"),
                ],
                help_text=("Tipo en la nómina del período; se deriva al "
                           "confirmar y Secretaría puede corregirlo"),
            ),
        ),
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
