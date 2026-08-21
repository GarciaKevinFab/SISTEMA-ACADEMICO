"""
Personal NO docente del instituto — observación MINEDU (Ley N° 30512).

Tres colectivos, un solo módulo:

  1) JEFES DE LÍNEA  → los cargos del art. de la p.31 del Reglamento de la
     Ley N° 30512. Son DOCENTES que además ocupan un cargo: NO se les crea
     usuario nuevo, entran con su misma contraseña de docente. Aquí solo se
     asigna quién ocupa el cargo (jalando del módulo Académico) y el docente
     sube su PLAN DE TRABAJO desde su propio panel.

  2) ADMINISTRATIVOS → personal con cargo según el Reglamento Institucional.
     Se les crea usuario y acceso desde este módulo; al entrar completan su
     HOJA DE VIDA con los mismos ítems que los docentes.

  3) LOCADORES 107 – MINEDU (incluye vigilancia) → además de la hoja de vida
     suben ORDEN DE SERVICIO vigente, PROTOCOLO y PLAN DE TRABAJO.

Los campos de `Personal` replican deliberadamente, uno a uno, los de
`catalogs.Teacher`, y `PersonalCVItem` los de `catalogs.TeacherCVItem`: así
el generador de PDF de la hoja de vida del docente (que es duck-typed sobre
la ficha y sus `cv_items`) se reutiliza tal cual, sin duplicar 250 líneas de
maquetación ni arriesgar que los dos CV se desincronicen.
"""
from django.conf import settings
from django.db import models

from catalogs.models import TeacherCVItem


# ══════════════════════════════════════════════════════════════
# 1) Jefes de línea — cargos de la Ley N° 30512
# ══════════════════════════════════════════════════════════════

class JefeLinea(models.Model):
    """Un cargo de la Ley N° 30512 y el docente que lo ocupa.

    Las filas se siembran en migración: son los cargos que exige la norma,
    no los crea el usuario. Lo editable es el RESPONSABLE (un docente del
    módulo Académico) y su PLAN DE TRABAJO.
    """

    # (código, rótulo, letra del reglamento) — el orden de la lista ES el
    # orden de presentación en el panel y en el portal público.
    CARGOS = [
        ("DIRECTOR_GENERAL",           "Director (a) General, en el caso de las EESP", "a"),
        ("JEFE_UNIDAD_ACADEMICA",      "Jefe (a) de Unidad Académica", "b"),
        ("JEFE_AREA_ADMINISTRACION",   "Jefe (a) del Área de Administración", "b"),
        ("COORD_AREA_INICIAL",         "Coordinador (a) de Área Académica (Inicial)", "c"),
        ("COORD_AREA_PRIMARIA",        "Coordinador (a) de Área Académica (Primaria)", "c"),
        ("COORD_AREA_EDUC_FISICA",     "Coordinador (a) de Área Académica (Educación Física)", "c"),
        ("COORD_PRACTICA_INVESTIGACION",
         "Coordinador (a) de Área de Práctica Pre-Profesional e Investigación, "
         "en el caso de las EESP", "d"),
        ("SECRETARIO_ACADEMICO",       "Secretario (a) Académico", "e"),
        ("JEFE_INVESTIGACION",         "Jefe (a) de Unidad de Investigación e Innovación", "f"),
        ("JEFE_FORMACION_CONTINUA",    "Jefe (a) de Unidad de Formación Continua", "g"),
        ("JEFE_BIENESTAR",             "Jefe (a) de Unidad de Bienestar y Empleabilidad", "h"),
        ("COORD_AREA_CALIDAD",         "Coordinador (a) de Área de Calidad", "i"),
        ("JEFE_UNIDAD_POSGRADO",
         "Jefe (a) de la Unidad de Posgrado, para el caso de las EES, "
         "según corresponda", "j"),
    ]
    CARGO_CHOICES = [(c, r) for c, r, _ in CARGOS]
    CARGO_LABEL = {c: r for c, r, _ in CARGOS}
    CARGO_LETRA = {c: l for c, _, l in CARGOS}

    cargo = models.CharField(max_length=40, unique=True, choices=CARGO_CHOICES)
    letra = models.CharField(max_length=2, blank=True, default="")
    orden = models.PositiveSmallIntegerField(default=0)

    # RESPONSABLE: se jala del módulo Académico (directorio de docentes).
    # SET_NULL para que borrar una ficha docente no se lleve el cargo.
    teacher = models.ForeignKey(
        "catalogs.Teacher", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="jefaturas")
    resolucion = models.CharField(
        max_length=160, blank=True, default="",
        help_text="R.D. de designación en el cargo")
    designado_desde = models.DateField(null=True, blank=True)

    # R.D. REGIONAL — el PDF de la resolución que acredita la designación.
    # El número va en `resolucion`; esto es el documento escaneado.
    resolucion_archivo = models.FileField(
        upload_to="personal/rd/", null=True, blank=True)
    resolucion_subida = models.DateTimeField(null=True, blank=True)

    # PLAN DE TRABAJO — lo sube el propio jefe de línea desde su panel
    plan_trabajo = models.FileField(
        upload_to="personal/planes/", null=True, blank=True)
    plan_trabajo_subido = models.DateTimeField(null=True, blank=True)

    activo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["orden", "id"]
        verbose_name = "Jefe de línea"
        verbose_name_plural = "Jefes de línea"

    def __str__(self):
        return f"{self.cargo_label} — {self.teacher_id or 'sin responsable'}"

    @property
    def cargo_label(self):
        return self.CARGO_LABEL.get(self.cargo, self.cargo)


# ══════════════════════════════════════════════════════════════
# 2) y 3) Administrativos y locadores 107
# ══════════════════════════════════════════════════════════════

class Personal(models.Model):
    """Ficha del personal administrativo / locador 107 – MINEDU."""

    ADMINISTRATIVO = "ADMINISTRATIVO"
    LOCADOR = "LOCADOR"
    TIPOS = [
        (ADMINISTRATIVO, "Administrativo"),
        (LOCADOR, "Locador 107 – MINEDU"),
    ]

    # Mismos vocabularios que catalogs.Teacher: el PDF de la hoja de vida
    # los resuelve por Teacher.X, así que los rótulos deben coincidir.
    SEXOS = [("M", "Masculino"), ("F", "Femenino")]
    # De menor a mayor. El personal administrativo y los locadores 107 no
    # siempre tienen grado universitario, de ahi los dos primeros: sin ellos
    # quedaban obligados a declarar un grado que no tienen.
    GRADOS_ACADEMICOS = [
        ("SECUNDARIA", "Secundaria completa"),
        ("TECNICO", "Técnico (a)"),
        ("PROFESOR", "Profesor (a)"),
        ("BACHILLER", "Bachiller (a)"),
        ("LICENCIADO", "Licenciado (a)"),
        ("MAGISTER", "Magister (a)"),
        ("DOCTOR", "Doctor (a)"),
    ]
    CONDICIONES = [
        ("NOMBRADO", "Nombrado (a)"),
        ("CONTRATADO", "Contratado (a)"),
        ("LOCADOR", "Locador (a) de servicios"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="fichas_personal")

    tipo = models.CharField(max_length=20, choices=TIPOS, default=ADMINISTRATIVO)
    cargo = models.CharField(
        max_length=160, blank=True, default="",
        help_text="Cargo según el Reglamento Institucional")
    area = models.CharField(max_length=120, blank=True, default="")

    # ── Identificación ──
    document = models.CharField(max_length=30, blank=True, default="")
    full_name = models.CharField(max_length=160, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    phone = models.CharField(max_length=30, blank=True, default="")
    specialization = models.CharField(max_length=120, blank=True, default="")

    # ── Perfil ──
    fecha_nac = models.DateField(null=True, blank=True)
    grado_academico = models.CharField(
        max_length=20, blank=True, default="", choices=GRADOS_ACADEMICOS)
    photo = models.ImageField(
        upload_to="personal/photos/", null=True, blank=True)

    # ── I. Datos personales (hoja de vida) ──
    apellido_paterno = models.CharField(max_length=80, blank=True, default="")
    apellido_materno = models.CharField(max_length=80, blank=True, default="")
    nombres = models.CharField(max_length=120, blank=True, default="")
    sexo = models.CharField(max_length=1, blank=True, default="", choices=SEXOS)
    telefono_fijo = models.CharField(max_length=30, blank=True, default="")
    direccion = models.CharField(max_length=200, blank=True, default="")
    region = models.CharField(max_length=80, blank=True, default="")
    provincia = models.CharField(max_length=80, blank=True, default="")
    distrito = models.CharField(max_length=80, blank=True, default="")

    # ── Vínculo laboral ──
    condicion_laboral = models.CharField(
        max_length=20, blank=True, default="", choices=CONDICIONES)
    rd_nombramiento = models.CharField(max_length=120, blank=True, default="")
    rd_fecha = models.DateField(null=True, blank=True)

    # ── Documentos del locador 107 ──
    orden_servicio = models.FileField(
        upload_to="personal/orden_servicio/", null=True, blank=True)
    orden_servicio_numero = models.CharField(
        max_length=120, blank=True, default="")
    orden_servicio_desde = models.DateField(null=True, blank=True)
    orden_servicio_hasta = models.DateField(null=True, blank=True)
    protocolo = models.FileField(
        upload_to="personal/protocolo/", null=True, blank=True)
    plan_trabajo = models.FileField(
        upload_to="personal/planes/", null=True, blank=True)

    activo = models.BooleanField(default=True)
    orden = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["tipo", "orden", "apellido_paterno", "full_name", "id"]
        verbose_name = "Personal"
        verbose_name_plural = "Personal"
        constraints = [
            # Mismo candado que catalogs.Teacher: una sola ficha por usuario.
            models.UniqueConstraint(
                fields=["user"],
                condition=models.Q(user__isnull=False),
                name="uniq_personal_user",
            ),
        ]
        indexes = [
            models.Index(fields=["tipo", "activo"]),
            models.Index(fields=["document"]),
        ]

    def __str__(self):
        return f"{self.nombre_completo} ({self.get_tipo_display()})"

    @property
    def nombre_completo(self):
        armado = " ".join(
            p for p in (self.apellido_paterno, self.apellido_materno,
                        self.nombres) if p).strip()
        if armado:
            return armado
        if self.full_name:
            return self.full_name
        u = self.user
        return (getattr(u, "full_name", "") or getattr(u, "username", "")
                if u else "")

    @property
    def orden_servicio_vigente(self):
        """True si hoy cae dentro de la vigencia declarada de la orden."""
        from django.utils import timezone
        if not self.orden_servicio:
            return False
        hoy = timezone.localdate()
        if self.orden_servicio_desde and hoy < self.orden_servicio_desde:
            return False
        if self.orden_servicio_hasta and hoy > self.orden_servicio_hasta:
            return False
        return True


class PersonalCVItem(models.Model):
    """Ítem de la hoja de vida del personal — espejo de TeacherCVItem.

    Reusa las MISMAS secciones/subsecciones que el CV docente para que el
    formulario, el ordenamiento y el PDF sean exactamente los mismos.
    """
    SECCIONES = TeacherCVItem.SECCIONES
    SUBSECCIONES = TeacherCVItem.SUBSECCIONES

    personal = models.ForeignKey(
        Personal, on_delete=models.CASCADE, related_name="cv_items")
    seccion = models.CharField(max_length=20, choices=SECCIONES)
    subseccion = models.CharField(
        max_length=20, blank=True, default="", choices=SUBSECCIONES)

    institucion = models.CharField(max_length=500, blank=True, default="")
    titulo = models.CharField(max_length=500, blank=True, default="")
    detalle = models.TextField(blank=True, default="")
    lugar = models.CharField(max_length=200, blank=True, default="")
    duracion = models.CharField(max_length=120, blank=True, default="")
    fecha_inicio = models.DateField(null=True, blank=True)
    fecha_fin = models.DateField(null=True, blank=True)

    archivo = models.FileField(upload_to="personal/cv/", null=True, blank=True)

    orden = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["seccion", "subseccion", "orden", "fecha_inicio", "id"]
        indexes = [models.Index(fields=["personal", "seccion"])]

    def __str__(self):
        return f"CV<{self.personal_id}:{self.seccion}:{self.titulo[:30]}>"
