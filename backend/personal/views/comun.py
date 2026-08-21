"""Helpers compartidos por las vistas del módulo Personal."""
from django.contrib.auth import get_user_model
from django.utils.crypto import get_random_string

from acl.models import Role, UserRole
from personal.models import JefeLinea, Personal

User = get_user_model()

# Roles que administran el módulo (mismo criterio por ROL que Mesa de
# Control: así el módulo funciona sin tener que re-sembrar el catálogo de
# permisos en el servidor).
ROLES_ADMIN = (
    "ADMIN_SYSTEM", "ACCESS_ADMIN", "ADMIN_ACADEMIC", "ADMIN_ACADEMICO",
    "REGISTRAR", "HR_ADMIN",
)
ROL_ADMINISTRATIVO = "ADMINISTRATIVO"
ROL_LOCADOR = "LOCADOR_107"
ROL_POR_TIPO = {
    Personal.ADMINISTRATIVO: ROL_ADMINISTRATIVO,
    Personal.LOCADOR: ROL_LOCADOR,
}


def tiene_rol(user, nombres) -> bool:
    """¿El usuario tiene alguno de esos roles?

    Los roles viven en DOS tablas según cómo se asignaron (acl.UserRole y la
    M2M directa User.roles); se consultan ambas, igual que el resto del
    sistema.
    """
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "is_superuser", False):
        return True
    nombres = list(nombres)
    try:
        if UserRole.objects.filter(user=user, role__name__in=nombres).exists():
            return True
    except Exception:
        pass
    try:
        return user.roles.filter(name__in=nombres).exists()
    except Exception:
        return False


def es_admin_personal(user) -> bool:
    return (getattr(user, "is_staff", False)
            or getattr(user, "is_superuser", False)
            or tiene_rol(user, ROLES_ADMIN))


def url_de(request, campo):
    """URL absoluta de un FileField/ImageField, o "" si no hay archivo."""
    try:
        if not campo:
            return ""
        url = campo.url
        return request.build_absolute_uri(url) if request else url
    except Exception:
        return ""


def nombre_de_teacher(t):
    if not t:
        return ""
    armado = " ".join(p for p in (t.apellido_paterno, t.apellido_materno,
                                  t.nombres) if p).strip()
    if armado:
        return armado
    u = t.user
    return ((getattr(u, "full_name", "") or "").strip() if u else "") \
        or (t.full_name or "").strip() \
        or (u.username if u else "")


# ══════════════════════════════════════════════════════════════
# Serialización
# ══════════════════════════════════════════════════════════════

def jefe_dict(j, request=None, publico=False):
    """Fila de jefe de línea.

    El portal público muestra (pedido MINEDU): datos generales, plan de
    trabajo, grado académico y foto. La vista admin agrega el estado del
    plan y los datos de contacto para poder gestionar.
    """
    from catalogs.models import Teacher

    t = j.teacher
    out = {
        "id": j.id,
        "cargo": j.cargo,
        "cargo_label": j.cargo_label,
        "letra": j.letra,
        "orden": j.orden,
        "activo": j.activo,
        "resolucion": j.resolucion,
        "designado_desde": (j.designado_desde.isoformat()
                            if j.designado_desde else ""),
        # R.D. Regional (PDF escaneado de la resolución de designación)
        "rd_url": url_de(request, j.resolucion_archivo),
        "rd_nombre": (j.resolucion_archivo.name.rsplit("/", 1)[-1]
                      if j.resolucion_archivo else ""),
        "rd_subida": (j.resolucion_subida.isoformat()
                      if j.resolucion_subida else ""),
        "responsable": None,
        "plan_trabajo_url": url_de(request, j.plan_trabajo),
        "plan_trabajo_nombre": (j.plan_trabajo.name.rsplit("/", 1)[-1]
                                if j.plan_trabajo else ""),
        "plan_trabajo_subido": (j.plan_trabajo_subido.isoformat()
                                if j.plan_trabajo_subido else ""),
    }
    if t:
        resp = {
            "teacher_id": t.id,
            "user_id": t.user_id,
            "nombre": nombre_de_teacher(t),
            "grado_academico": t.grado_academico or "",
            "grado_label": dict(Teacher.GRADOS_ACADEMICOS).get(
                t.grado_academico, ""),
            "especialidad": t.specialization or "",
            "foto_url": url_de(request, t.photo),
        }
        if not publico:
            resp.update({
                "documento": t.document or "",
                "email": t.email or "",
                "celular": t.phone or "",
            })
        out["responsable"] = resp
    return out


def personal_dict(p, request=None, publico=False):
    """Ficha de administrativo / locador.

    Público administrativo: datos generales, foto y cargo.
    Público locador: además, sus documentos (orden de servicio, protocolo,
    plan de trabajo) y la hoja de vida.
    """
    out = {
        "id": p.id,
        "tipo": p.tipo,
        "tipo_label": p.get_tipo_display(),
        "cargo": p.cargo,
        "area": p.area,
        "nombre": p.nombre_completo,
        "grado_academico": p.grado_academico or "",
        "grado_label": dict(Personal.GRADOS_ACADEMICOS).get(
            p.grado_academico, ""),
        "foto_url": url_de(request, p.photo),
        "activo": p.activo,
        "orden": p.orden,
        "cv_items": p.cv_items.count(),
    }
    if p.tipo == Personal.LOCADOR or not publico:
        out.update({
            "orden_servicio_url": url_de(request, p.orden_servicio),
            "orden_servicio_numero": p.orden_servicio_numero,
            "orden_servicio_desde": (p.orden_servicio_desde.isoformat()
                                     if p.orden_servicio_desde else ""),
            "orden_servicio_hasta": (p.orden_servicio_hasta.isoformat()
                                     if p.orden_servicio_hasta else ""),
            "orden_servicio_vigente": p.orden_servicio_vigente,
            "protocolo_url": url_de(request, p.protocolo),
            "plan_trabajo_url": url_de(request, p.plan_trabajo),
        })
    if not publico:
        u = p.user
        out.update({
            "documento": p.document or "",
            "email": p.email or "",
            "celular": p.phone or "",
            "condicion_laboral": p.condicion_laboral or "",
            "user_id": p.user_id,
            "username": (u.username if u else ""),
            "user_activo": bool(u.is_active) if u else False,
        })
    return out


# ══════════════════════════════════════════════════════════════
# Alta de usuario para una ficha de personal
# ══════════════════════════════════════════════════════════════

def asegurar_rol(user, nombre):
    rol, _ = Role.objects.get_or_create(name=nombre)
    try:
        user.roles.add(rol)
    except Exception:
        UserRole.objects.get_or_create(user=user, role=rol)
    return rol


def provisionar_usuario(p, documento="", nombre="", email=""):
    """Crea (o reutiliza) el usuario de acceso de una ficha de personal.

    Devuelve (user, password_temporal|None, error|None). Mismo criterio que
    el alta de docentes: si ya hay un User con ese DNI o correo se reutiliza
    en vez de duplicar cuentas.
    """
    documento = (documento or "").strip()
    nombre = (nombre or "").strip()
    email = (email or "").strip().lower()

    existente = None
    if email:
        existente = User.objects.filter(email__iexact=email).first()
    if not existente and documento:
        existente = User.objects.filter(username=documento).first()

    if existente:
        otras = Personal.objects.filter(user=existente)
        if p.pk:
            otras = otras.exclude(pk=p.pk)
        otra = otras.first()
        if otra:
            return None, None, (
                f"El usuario «{existente.username}» ya está vinculado a la "
                f"ficha de {otra.nombre_completo}.")
        asegurar_rol(existente, ROL_POR_TIPO.get(p.tipo, ROL_ADMINISTRATIVO))
        return existente, None, None

    base = documento or (nombre.split()[0] if nombre else "personal")
    username, k = base, 1
    while User.objects.filter(username=username).exists():
        k += 1
        username = f"{base}-{k}"

    temporal = get_random_string(12)
    correo = email or f"{username}@no-email.local"
    if User.objects.filter(email__iexact=correo).exists():
        correo = f"{username}@no-email.local"

    try:
        user = User.objects.create_user(
            username=username, password=temporal, email=correo,
            full_name=nombre or username)
    except Exception as exc:
        return None, None, f"No se pudo crear el usuario: {exc}"

    if hasattr(user, "must_change_password"):
        user.must_change_password = True
        user.save(update_fields=["must_change_password"])

    asegurar_rol(user, ROL_POR_TIPO.get(p.tipo, ROL_ADMINISTRATIVO))
    return user, temporal, None


def sembrar_cargos():
    """Garantiza que existan las filas de los cargos de la Ley N° 30512.

    La migración de datos las siembra; esto cubre el caso de que mañana la
    norma agregue un cargo (basta con listarlo en el modelo). Cuando ya están
    todos —el caso normal— cuesta una sola consulta.
    """
    existentes = set(JefeLinea.objects.values_list("cargo", flat=True))
    faltan = [(i, codigo, letra)
              for i, (codigo, _rotulo, letra) in enumerate(JefeLinea.CARGOS)
              if codigo not in existentes]
    if not faltan:
        return
    JefeLinea.objects.bulk_create(
        [JefeLinea(cargo=codigo, letra=letra, orden=i)
         for i, codigo, letra in faltan],
        ignore_conflicts=True)
