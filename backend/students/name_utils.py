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
import unicodedata

_ESPACIOS = re.compile(r"\s+")

CAMPOS_NOMBRE = ("nombres", "apellido_paterno", "apellido_materno")

# La Ñ se ordena justo después de TODAS las N. Se marca con un carácter mayor
# que cualquier letra para que "NUÑEZ" < "ÑAUPARI" < "OLIVA".
_MARCA_ENIE = "\x01"
_DESPUES_DE_N = "N" + chr(0xFFFF)


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


def nombre_archivo(valor) -> str:
    """Nombre del alumno apto para nombres de archivo descargables:
    "APELLIDOS NOMBRES" sin tildes, sin coma y con guiones bajos.

        nombre_archivo(st) → "CAMPOS_APOLINARIO_MARIA_JOSE"

    Acepta un str o un Student (usa `nombre_oficial`). Solo ASCII, así el
    header Content-Disposition no necesita escaparse."""
    texto = valor if isinstance(valor, str) else nombre_oficial(valor)
    texto = unicodedata.normalize("NFD", normalizar(texto))
    texto = "".join(c for c in texto if not unicodedata.combining(c))
    texto = re.sub(r"[^A-Za-z0-9 ]+", "", texto)
    return _ESPACIOS.sub("_", texto.strip())


def clave_orden(valor) -> str:
    """Clave para ordenar alfabéticamente en español.

    `sorted()` y `.sort()` comparan por código Unicode, donde la Ñ (U+00D1)
    cae DESPUÉS de la Z — por eso "ÑAUPARI SINCHI" terminaba al final de la
    nómina en vez de ir entre las N y las O. Esta clave arregla eso:

      · la Ñ va justo después de todas las N:
            NUÑEZ  <  ÑAUPARI  <  OLIVA
      · las tildes y la diéresis no cuentan:
            GARCÍA = GARCIA,  PIÑÓN = PIÑON,  ARGÜELLES = ARGUELLES
        pero la Ñ SÍ cuenta: es letra propia, no una N con tilde, así que
            MUNOZ  <  MUÑOZ

    Acepta un str o un Student (en cuyo caso usa `nombre_oficial`).

    Ojo: es solo para ordenar en Python. Un `.order_by()` de Django ordena en
    PostgreSQL y depende del collation de la base, no de esta función.
    """
    texto = valor if isinstance(valor, str) else nombre_oficial(valor)
    # NFC primero: la Ñ puede venir descompuesta (N + tilde combinante).
    texto = unicodedata.normalize("NFC", normalizar(texto))
    texto = texto.replace("Ñ", _MARCA_ENIE)
    # Quitar tildes/diéresis del resto (la Ñ ya está a salvo en la marca).
    texto = "".join(c for c in unicodedata.normalize("NFD", texto)
                    if not unicodedata.combining(c))
    return texto.replace(_MARCA_ENIE, _DESPUES_DE_N)


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
