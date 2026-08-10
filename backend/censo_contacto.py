"""
CENSO DE DATOS DE CONTACTO — solo lectura, no escribe absolutamente nada.

El diseño de "olvidé mi contraseña" depende de un dato que hoy no conocemos:
¿a cuántos alumnos y docentes podemos realmente contactar?

Cuando se importó la nómina, `students/views.py::_create_user_for_student`
le puso a cada cuenta sin correo un email sintético `<dni>@no-email.local`
(el campo `User.email` es unique y obligatorio, así que había que inventar
algo). Esas cuentas NO pueden recibir un enlace de recuperación.

Uso:
    python manage.py shell < censo_contacto.py
"""
import re

from django.contrib.auth import get_user_model
from django.db.models import Q

from students.models import Student
from catalogs.models import Teacher

User = get_user_model()

FALSOS = ["@no-email.local", "@example.com", "@test.com", "@sin-correo"]
_RE_MAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[a-z]{2,}$", re.I)


def es_real(mail: str) -> bool:
    mail = (mail or "").strip().lower()
    if not mail or not _RE_MAIL.match(mail):
        return False
    return not any(mail.endswith(f) for f in FALSOS)


def barra(n, total, ancho=40):
    if not total:
        return ""
    llenos = round(ancho * n / total)
    return "█" * llenos + "·" * (ancho - llenos)


def porc(n, total):
    return f"{(100.0 * n / total):5.1f}%" if total else "  n/a"


def bloque(titulo, filas):
    """filas: lista de (etiqueta, cantidad). La primera es el total."""
    print("\n" + "=" * 78)
    print(titulo)
    print("=" * 78)
    total = filas[0][1]
    for etiqueta, n in filas:
        print(f"  {etiqueta:<34} {n:>6}  {porc(n, total)}  {barra(n, total)}")
    return total


# ── 1. Cuentas de usuario ────────────────────────────────────────────────
usuarios = list(User.objects.all().only("id", "email", "is_active", "username"))
con_real = [u for u in usuarios if es_real(u.email)]
bloque("1) CUENTAS DE USUARIO (accounts.User)", [
    ("Total de cuentas", len(usuarios)),
    ("Con email REAL (contactables)", len(con_real)),
    ("Con email sintético/inválido", len(usuarios) - len(con_real)),
    ("Activas", sum(1 for u in usuarios if u.is_active)),
])

# ── 2. Alumnos ───────────────────────────────────────────────────────────
sts = list(Student.objects.all().only(
    "id", "email", "celular", "fecha_nac", "num_documento", "user_id"))
mail_user = {u.id: u.email for u in usuarios}
st_contactable = [s for s in sts
                  if es_real(s.email) or es_real(mail_user.get(s.user_id, ""))]
total_st = bloque("2) ALUMNOS (students.Student)", [
    ("Total de alumnos", len(sts)),
    ("Con cuenta de usuario", sum(1 for s in sts if s.user_id)),
    ("Contactables por email", len(st_contactable)),
    ("Con celular cargado", sum(1 for s in sts if (s.celular or "").strip())),
    ("Con fecha de nacimiento", sum(1 for s in sts if s.fecha_nac)),
    ("Con DNI válido (8 dígitos)", sum(
        1 for s in sts if re.fullmatch(r"\d{8}", (s.num_documento or "").strip()))),
])

# ── 3. Docentes ──────────────────────────────────────────────────────────
tchs = list(Teacher.objects.all().only(
    "id", "email", "phone", "fecha_nac", "document", "user_id"))
tc_contactable = [t for t in tchs
                  if es_real(t.email) or es_real(mail_user.get(t.user_id, ""))]
bloque("3) DOCENTES (catalogs.Teacher)", [
    ("Total de docentes", len(tchs)),
    ("Con cuenta de usuario", sum(1 for t in tchs if t.user_id)),
    ("Contactables por email", len(tc_contactable)),
    ("Con teléfono cargado", sum(1 for t in tchs if (t.phone or "").strip())),
    ("Con fecha de nacimiento", sum(1 for t in tchs if t.fecha_nac)),
])

# ── 4. 2FA realmente activado ────────────────────────────────────────────
try:
    from security_mfa.models import UserMFA
    mfas = list(UserMFA.objects.all().only("id", "enabled", "secret", "user_id"))
    activos = [m for m in mfas if m.enabled and m.secret]
    bloque("4) SEGUNDO FACTOR (security_mfa.UserMFA)", [
        ("Total de cuentas", len(usuarios)),
        ("Con registro de MFA", len(mfas)),
        ("Con TOTP REALMENTE activo", len(activos)),
        ("Con códigos de respaldo generados",
         sum(1 for m in mfas if m.backup_codes)),
    ])
except Exception as exc:
    print(f"\n[!] No se pudo leer security_mfa: {exc}")
    activos = []

# ── 5. Dominios de correo más usados ─────────────────────────────────────
print("\n" + "=" * 78)
print("5) DOMINIOS DE CORREO (top 12) — para ver qué tan confiable es el dato")
print("=" * 78)
dominios = {}
for u in usuarios:
    d = (u.email or "").strip().lower().rsplit("@", 1)
    if len(d) == 2:
        dominios[d[1]] = dominios.get(d[1], 0) + 1
for dom, n in sorted(dominios.items(), key=lambda x: -x[1])[:12]:
    marca = "  ← SINTÉTICO" if any(dom.endswith(f.lstrip("@")) for f in FALSOS) else ""
    print(f"  {dom:<34} {n:>6}  {porc(n, len(usuarios))}{marca}")

# ── Veredicto ────────────────────────────────────────────────────────────
print("\n" + "=" * 78)
print("VEREDICTO")
print("=" * 78)
cobertura = (100.0 * len(st_contactable) / len(sts)) if sts else 0
print(f"  Alumnos alcanzables por correo: {len(st_contactable)}/{len(sts)}"
      f"  ({cobertura:.1f}%)")
print(f"  Cuentas con 2FA activo:         {len(activos)}/{len(usuarios)}")
print()
if cobertura >= 80:
    print("  → El flujo por correo cubre a la mayoría. Sirve como vía principal,")
    print("    con la vía asistida solo para el resto.")
elif cobertura >= 30:
    print("  → Cobertura parcial. Hace falta correo + vía asistida en paralelo,")
    print("    y una campaña para que registren su correo al entrar.")
else:
    print("  → La vía por correo NO alcanza. El flujo principal tiene que ser")
    print("    asistido (Secretaría verifica identidad), y en paralelo hay que")
    print("    capturar correos reales al iniciar sesión.")
print("=" * 78)
