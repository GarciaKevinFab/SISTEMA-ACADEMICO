"""
Nombre del estudiante: UNA sola fuente de verdad y UN solo formato.

Los campos reales son los de `students.Student`:
    apellido_paterno · apellido_materno · nombres
(los mismos del Excel de la Nómina de Matrícula).

`accounts.User.full_name` NO es un dato: es una COPIA derivada de esos campos.
Nunca se escribe a mano — se recalcula con `sync_user_full_name()`. Antes se
armaba en siete lugares distintos y en orden invertido ("Nombres Apellidos"),
por lo que quedaba desactualizada en cuanto se corregía un apellido.

Formato oficial (Nómina de Matrícula / actas MINEDU):  "APELLIDOS, NOMBRES"
"""
import re

_ESPACIOS = re.compile(r"\s+")

CAMPOS_NOMBRE = ("nombres", "apellido_paterno", "apellido_materno")


def normalizar(texto) -> str:
    """MAYÚSCULAS, sin espacios repetidos ni en los bordes."""
    return _ESPACIOS.sub(" ", str(texto or "").strip()).upper()


def apellidos_de(student) -> str:
    return normalizar(
        f"{getattr(student, 'apellido_paterno', '') or ''} "
        f"{getattr(student, 'apellido_materno', '') or ''}"
    )


def nombres_de(student) -> str:
    return normalizar(getattr(student, "nombres", ""))


def nombre_oficial(student) -> str:
    """'APELLIDO_PAT APELLIDO_MAT, NOMBRES' — el formato de la nómina.

    Es el único formato que deben usar actas, nóminas, registros, PDFs y
    cualquier listado de estudiantes.
    """
    ap, no = apellidos_de(student), nombres_de(student)
    if ap and no:
        return f"{ap}, {no}"
    return ap or no


def sync_user_full_name(student, save: bool = True) -> bool:
    """Recalcula `user.full_name` desde los campos reales del Student.

    Devuelve True si el valor cambió. No falla si el alumno no tiene cuenta.
    """
    user = getattr(student, "user", None)
    if user is None:
        return False
    nuevo = nombre_oficial(student)[:200]
    if not nuevo or (user.full_name or "") == nuevo:
        return False
    user.full_name = nuevo
    if save:
        user.save(update_fields=["full_name"])
    return True


def normalizar_campos_student(student, save: bool = True) -> dict:
    """Deja los tres campos en MAYÚSCULAS y sin espacios sobrantes.

    Devuelve {campo: valor_nuevo} con lo que cambió (vacío si ya estaba bien).
    """
    cambios = {}
    for campo in CAMPOS_NOMBRE:
        actual = getattr(student, campo, "") or ""
        limpio = normalizar(actual)
        if limpio != actual:
            cambios[campo] = limpio
            setattr(student, campo, limpio)
    if cambios and save:
        campos = list(cambios.keys())
        if any(f.name == "updated_at" for f in student._meta.get_fields()
               if hasattr(f, "name")):
            campos.append("updated_at")
        student.save(update_fields=campos)
    return cambios


def partir_nombre_completo(full_name: str, fallback: str = ""):
    """Último recurso: separar un nombre completo en (nombres, apellidos).

    ⚠ ADIVINA: asume que los dos últimos tokens son los apellidos, lo que se
    equivoca con nombres compuestos ("MERCEDES DEL PILAR HURTADO ROMERO").
    Usar SOLO cuando no existe la ficha del estudiante con los campos reales
    (p. ej. al crear un Student a partir de una cuenta de usuario suelta).
    Nunca para sobreescribir campos que ya están cargados.
    """
    full = normalizar(full_name) or normalizar(fallback)
    if not full:
        return "", ""
    partes = full.split()
    if len(partes) == 1:
        return partes[0], ""
    if len(partes) >= 3:
        return " ".join(partes[:-2]), " ".join(partes[-2:])
    return partes[0], partes[1]
