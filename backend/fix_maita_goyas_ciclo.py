"""
Corrige el ciclo de MAITA GOYAS MARCIA (DNI 60317830).
Debe estar en ciclo II (2), no III.

Uso:
    python manage.py shell < fix_maita_goyas_ciclo.py
    # o
    python fix_maita_goyas_ciclo.py  (con entorno Django configurado)
"""
import os
import sys
import django

# Setup Django si se ejecuta standalone
if not django.apps.apps.ready:
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    django.setup()

from students.models import Student

DNI = "60317830"
CICLO_CORRECTO = 2

st = Student.objects.filter(num_documento=DNI).first()
if not st:
    print(f"[ERROR] No existe estudiante con DNI {DNI}")
    sys.exit(1)

print(f"Estudiante: {st.apellido_paterno} {st.apellido_materno} {st.nombres}")
print(f"  DNI:              {st.num_documento}")
print(f"  Carrera:          {st.programa_carrera}")
print(f"  Ciclo actual:     {st.ciclo}")
print(f"  Periodo:          {st.periodo}")
print(f"  Plan:             {st.plan_id}")

if st.ciclo == CICLO_CORRECTO:
    print(f"\n[OK] Ya está en ciclo {CICLO_CORRECTO}, no hay nada que corregir.")
    sys.exit(0)

print(f"\n  → Cambiando ciclo de {st.ciclo} a {CICLO_CORRECTO}...")
st.ciclo = CICLO_CORRECTO
st.save(update_fields=["ciclo"])
print("  ✓ Guardado.")

# Refrescar y confirmar
st.refresh_from_db()
print(f"\nEstado final:")
print(f"  Ciclo:    {st.ciclo}")
print(f"  Periodo:  {st.periodo}")
