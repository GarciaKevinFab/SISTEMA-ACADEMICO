"""
Corrige dos fichas mal cargadas (misma especialidad / semestre):

  1) "ANITA ROMERO, ANITA PATRICIA"   →  "ROMERO PAUCAR, ANITA PATRICIA"
     (los apellidos estaban mal: el paterno decía ANITA y el materno ROMERO)

  2) "ROMERO ESTEBAN, FRINET"         →  "ROMERO ESTEBAN, SEYDY FRINET"
     (le faltaba el primer nombre)

Al guardar el Student, la señal `students.signals` recalcula solo
`accounts.User.full_name`, así que no hay que tocar nada más.

Uso (en el servidor, dentro de backend/ y con el venv activo):

    # 1. Ver qué encontró y qué cambiaría (NO escribe nada):
    python manage.py shell < fix_nombres_romero.py

    # 2. Aplicar de verdad:
    APLICAR=1 python manage.py shell < fix_nombres_romero.py
"""
import os

from students.models import Student
from students.name_utils import nombre_oficial, normalizar

APLICAR = os.environ.get("APLICAR", "").strip() in ("1", "true", "TRUE", "si", "SI")

# (etiqueta, filtro para ubicar la ficha, campos a corregir)
CORRECCIONES = [
    (
        "ANITA ROMERO, ANITA PATRICIA  →  ROMERO PAUCAR, ANITA PATRICIA",
        dict(apellido_paterno__iexact="ANITA",
             apellido_materno__iexact="ROMERO",
             nombres__icontains="ANITA PATRICIA"),
        dict(apellido_paterno="ROMERO",
             apellido_materno="PAUCAR",
             nombres="ANITA PATRICIA"),
    ),
    (
        "ROMERO ESTEBAN, FRINET  →  ROMERO ESTEBAN, SEYDY FRINET",
        dict(apellido_paterno__iexact="ROMERO",
             apellido_materno__iexact="ESTEBAN",
             nombres__icontains="FRINET"),
        dict(nombres="SEYDY FRINET"),
    ),
]


def mostrar(st):
    print(f"      id={st.id}  DNI={st.num_documento}  "
          f"{nombre_oficial(st)}")
    print(f"      carrera={st.programa_carrera!r}  ciclo={st.ciclo}  "
          f"periodo={st.periodo!r}  seccion={st.seccion!r}")


print("=" * 78)
print("MODO:", "APLICAR CAMBIOS" if APLICAR else "SOLO VISTA PREVIA (no escribe)")
print("=" * 78)

for etiqueta, filtro, nuevos in CORRECCIONES:
    print(f"\n▸ {etiqueta}")
    qs = list(Student.objects.filter(**filtro))

    if not qs:
        print("   [ERROR] No se encontró ninguna ficha con ese filtro:")
        print(f"           {filtro}")
        print("           Revisa manualmente y corrige el filtro antes de aplicar.")
        continue

    if len(qs) > 1:
        print(f"   [ERROR] {len(qs)} fichas coinciden — NO se toca nada "
              f"para no corregir a la persona equivocada:")
        for st in qs:
            mostrar(st)
        continue

    st = qs[0]
    print("   Ficha encontrada:")
    mostrar(st)

    cambios = {c: normalizar(v) for c, v in nuevos.items()
               if (getattr(st, c) or "") != normalizar(v)}
    if not cambios:
        print("   [OK] Ya está correcta, no hay nada que cambiar.")
        continue

    for campo, valor in cambios.items():
        print(f"   · {campo}: {getattr(st, campo)!r}  →  {valor!r}")

    if not APLICAR:
        print("   (vista previa — no se guardó)")
        continue

    for campo, valor in cambios.items():
        setattr(st, campo, valor)
    st.save(update_fields=list(cambios.keys()) + ["updated_at"])
    st.refresh_from_db()
    print(f"   ✓ Guardado. Ahora: {nombre_oficial(st)}")
    if st.user_id:
        st.user.refresh_from_db()
        print(f"   ✓ Cuenta de usuario ({st.user_id}) full_name = "
              f"{st.user.full_name!r}")

print("\n" + "=" * 78)
if not APLICAR:
    print("Nada se guardó. Para aplicar:")
    print("    APLICAR=1 python manage.py shell < fix_nombres_romero.py")
print("=" * 78)
