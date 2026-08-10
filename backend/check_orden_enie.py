"""
Verifica el orden alfabético de la Ñ en las nóminas.

Dos mecanismos ordenan alumnos en el sistema, y hay que revisar los dos:

  1. Python — `_roster()` y compañía. Antes usaban `sort()` a secas, que
     compara por código Unicode: la Ñ (U+00D1) cae DESPUÉS de la Z, así que
     "ÑAUPARI SINCHI" terminaba al final de la lista. Ya está arreglado con
     `students.name_utils.clave_orden`.

  2. PostgreSQL — los `.order_by("apellido_paterno", ...)` de Django. Ahí
     manda el collation de la base de datos, no el código. Este script lo
     reporta: si el collation es `C` o `POSIX`, la Ñ también sale al final
     y hay que arreglarlo aparte.

Uso:
    python manage.py shell < check_orden_enie.py
"""
from django.db import connection

from students.models import Student
from students.name_utils import clave_orden, nombre_oficial

print("=" * 78)
print("1) COLLATION DE LA BASE DE DATOS")
print("=" * 78)
with connection.cursor() as cur:
    cur.execute("SELECT current_database(), datcollate, datctype "
                "FROM pg_database WHERE datname = current_database()")
    db, collate, ctype = cur.fetchone()
    print(f"   base={db}  collate={collate}  ctype={ctype}")

    # Prueba real: ¿cómo ordena Postgres una muestra con Ñ?
    cur.execute("""
        SELECT palabra FROM (VALUES ('NAVARRO'), ('NUÑEZ'), ('ÑAUPARI'),
                                    ('OLIVA'), ('TIMOTEO')) AS t(palabra)
        ORDER BY palabra
    """)
    orden_pg = [r[0] for r in cur.fetchall()]
print(f"   Postgres ordena: {' < '.join(orden_pg)}")

pos_pg = orden_pg.index("ÑAUPARI")
if pos_pg == 2:
    print("   ✓ OK — la Ñ queda entre NUÑEZ y OLIVA. Los `.order_by()` "
          "de Django ordenan bien.")
else:
    print(f"   ✗ MAL — 'ÑAUPARI' sale en la posición {pos_pg + 1} de 5.")
    print("     El collation de la base manda la Ñ al final, así que las")
    print("     listas que ordenan con `.order_by()` también salen mal.")
    print("     Avisar para arreglarlo (requiere ordenar con COLLATE en las")
    print("     consultas, o reindexar la base con un collation español).")

print()
print("=" * 78)
print("2) ALUMNOS CON Ñ AL INICIO DEL APELLIDO")
print("=" * 78)
con_enie = list(Student.objects.filter(apellido_paterno__istartswith="Ñ")
                .order_by("apellido_paterno", "apellido_materno", "nombres"))
if not con_enie:
    print("   (ninguno)")
for st in con_enie:
    print(f"   id={st.id}  DNI={st.num_documento}  {nombre_oficial(st)}")
    print(f"      {st.programa_carrera}  ciclo={st.ciclo}  periodo={st.periodo}"
          f"  seccion={st.seccion}")

print()
print("=" * 78)
print("3) CÓMO QUEDA EL ROSTER DE SUS SECCIONES (lo que ve el docente)")
print("=" * 78)
from academic.models import EnrollmentItem            # noqa: E402
from academic.views.acta_excel import _roster         # noqa: E402

secciones = {}
for st in con_enie:
    for it in (EnrollmentItem.objects
               .select_related("section", "section__plan_course")
               .filter(enrollment__student=st,
                       enrollment__status="CONFIRMED",
                       section__isnull=False)):
        secciones.setdefault(it.section_id, it.section)

if not secciones:
    print("   (sin secciones con matrícula confirmada)")

for sec in secciones.values():
    filas = _roster(sec)
    print(f"\n   Sección {sec.id} — {getattr(sec, 'period', '?')} "
          f"{getattr(getattr(sec, 'plan_course', None), 'effective_name', '')}"
          f"  ({len(filas)} alumnos)")
    # Solo se imprime el entorno de la Ñ, para no volcar la nómina entera
    idx_enie = next((j for j, x in enumerate(filas)
                     if x["nombre"].lstrip().upper().startswith("Ñ")), None)
    for i, r in enumerate(filas, 1):
        if idx_enie is None or abs(i - 1 - idx_enie) > 3:
            continue
        marca = "  ← Ñ" if (i - 1) == idx_enie else ""
        print(f"      {i:>3}. {r['nombre']}{marca}")

    # Comprobación dura: el roster debe coincidir con el orden esperado
    esperado = sorted(filas, key=lambda x: clave_orden(x["nombre"]))
    if [f["pk"] for f in filas] == [f["pk"] for f in esperado]:
        print("      ✓ El roster ya sale en orden alfabético español.")
    else:
        print("      ✗ El roster NO está en orden — revisar `_roster()`.")

print()
print("=" * 78)
print("Recordá reiniciar gunicorn para que el cambio de código tome efecto.")
print("=" * 78)
