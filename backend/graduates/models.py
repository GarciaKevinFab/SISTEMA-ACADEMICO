from django.db import models


class GradoTituloType(models.Model):
    """
    Catálogo de tipos de grado/título que otorga la institución.
    Permite configurar dinámicamente los conceptos disponibles.

    Ejemplos actuales:
      - TÍTULO DE PROFESOR(A) → template: "PROFESOR(A) EN {especialidad}"

    Ejemplos futuros (cuando se obtenga la licencia):
      - BACHILLER → template: "BACHILLER EN {especialidad}"
      - LICENCIATURA → template: "LICENCIADO(A) EN {especialidad}"
    """

    code = models.CharField(
        "Código",
        max_length=50,
        unique=True,
        help_text='Identificador único. Ej: TITULO_PROFESOR, BACHILLER, LICENCIATURA',
    )
    name = models.CharField(
        "Nombre",
        max_length=200,
        help_text='Nombre para mostrar. Ej: "TÍTULO DE PROFESOR(A)"',
    )
    template = models.CharField(
        "Plantilla de denominación",
        max_length=300,
        help_text=(
            'Usa {especialidad} como placeholder. '
            'Ej: "PROFESOR(A) EN {especialidad}" → "PROFESOR(A) EN EDUCACIÓN INICIAL". '
            'Si no incluye {especialidad}, se usa el texto tal cual.'
        ),
    )
    diploma_label = models.CharField(
        "Etiqueta en diploma",
        max_length=100,
        default="TÍTULO",
        help_text='Texto que aparece como tipo en la constancia. Ej: "TÍTULO", "GRADO DE BACHILLER"',
    )
    is_default = models.BooleanField(
        "Por defecto",
        default=False,
        help_text="Si es True, se usa automáticamente al importar egresados sin tipo asignado.",
    )
    is_active = models.BooleanField("Activo", default=True)
    order = models.PositiveIntegerField("Orden", default=0)
    created_at = models.DateTimeField("Creado", auto_now_add=True)
    updated_at = models.DateTimeField("Actualizado", auto_now=True)

    class Meta:
        verbose_name = "Tipo de Grado/Título"
        verbose_name_plural = "Tipos de Grado/Título"
        ordering = ["order", "name"]

    def __str__(self):
        return self.name

    def render(self, especialidad: str = "") -> str:
        """Aplica la plantilla con la especialidad dada."""
        esp = (especialidad or "").strip()
        if "{especialidad}" in self.template:
            return self.template.replace("{especialidad}", esp) if esp else self.template.replace("{especialidad}", "EDUCACIÓN")
        return self.template

    def save(self, *args, **kwargs):
        # Solo 1 default a la vez
        if self.is_default:
            GradoTituloType.objects.filter(is_default=True).exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)


class Graduate(models.Model):
    """
    Registro de egresado con grado/título para el verificador público.
    Datos importados desde los Excel de EGRESO y la PLANTILLA_VERIFICADOR.
    """

    # ── Datos personales ──────────────────────────────────────────────────
    dni = models.CharField(
        "DNI",
        max_length=8,
        blank=True,
        default="",
        db_index=True,
        help_text="Documento Nacional de Identidad (8 dígitos). Puede estar vacío para registros antiguos.",
    )
    apellidos_nombres = models.CharField(
        "Apellidos y Nombres",
        max_length=250,
        db_index=True,
        help_text='Formato: "APELLIDO PATERNO MATERNO, NOMBRES"',
    )

    # ── Datos académicos ──────────────────────────────────────────────────
    grado_titulo_type = models.ForeignKey(
        GradoTituloType,
        verbose_name="Tipo de Grado/Título",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Tipo de grado/título del catálogo. Si está vacío, se deriva de la especialidad.",
    )
    grado_titulo = models.CharField(
        "Grado / Título (texto libre)",
        max_length=200,
        blank=True,
        default="",
        help_text="Denominación completa. Se genera automáticamente desde el tipo + especialidad si está vacío.",
    )
    especialidad = models.CharField(
        "Especialidad",
        max_length=150,
    )
    nivel = models.CharField(
        "Nivel",
        max_length=80,
        blank=True,
        default="",
        help_text="Ej: INICIAL, PRIMARIA, SECUNDARIA, PRIMARIA - SECUNDARIA",
    )
    anio_ingreso = models.CharField(
        "Año de Ingreso",
        max_length=20,
        help_text="Ej: 2019, 2019-I, 2019-II",
    )
    anio_egreso = models.CharField(
        "Año de Egreso",
        max_length=20,
        help_text="Ej: 2023, 2023-I, 2023-II",
    )
    fecha_sustentacion = models.DateField(
        "Fecha de Sustentación",
        blank=True,
        null=True,
    )

    # ── Datos del diploma (se llenan desde PLANTILLA_VERIFICADOR) ─────────
    resolucion_acta = models.CharField(
        "Resolución / Acta",
        max_length=150,
        blank=True,
        default="",
    )
    codigo_diploma = models.CharField(
        "Código de Diploma",
        max_length=100,
        blank=True,
        default="",
    )
    registro_pedagogico = models.CharField(
        "Registro Pedagógico",
        max_length=100,
        blank=True,
        default="",
        help_text="Ej: R.P.N° 020280 -P-DREJ-H",
    )

    # ── Datos institucionales (para la constancia PDF) ────────────────────
    director_general = models.CharField(
        "Director General",
        max_length=200,
        blank=True,
        default="",
    )
    secretario_academico = models.CharField(
        "Secretario Académico",
        max_length=200,
        blank=True,
        default="",
    )

    # ── Control ───────────────────────────────────────────────────────────
    is_active = models.BooleanField("Activo", default=True)
    created_at = models.DateTimeField("Creado", auto_now_add=True)
    updated_at = models.DateTimeField("Actualizado", auto_now=True)

    class Meta:
        verbose_name = "Egresado"
        verbose_name_plural = "Egresados"
        ordering = ["apellidos_nombres"]
        indexes = [
            models.Index(fields=["dni"], name="grad_dni_idx"),
            models.Index(fields=["apellidos_nombres"], name="grad_nombre_idx"),
            models.Index(fields=["especialidad"], name="grad_esp_idx"),
            models.Index(fields=["anio_egreso"], name="grad_egreso_idx"),
        ]

    def __str__(self):
        dni_str = f" (DNI {self.dni})" if self.dni else ""
        return f"{self.apellidos_nombres}{dni_str} — {self.especialidad} [{self.anio_egreso}]"

    @property
    def tiene_constancia(self):
        """True si tiene resolución o código de diploma para generar constancia."""
        return bool(self.resolucion_acta or self.codigo_diploma)

    @property
    def full_name(self):
        """Alias para compatibilidad con el frontend."""
        return self.apellidos_nombres

    @property
    def grado_titulo_display(self):
        """
        Denominación completa del grado/título.
        Prioridad: grado_titulo_type.render() > grado_titulo > derivación por especialidad.
        """
        # 1. Si tiene tipo de catálogo, usar plantilla
        if self.grado_titulo_type_id:
            return self.grado_titulo_type.render(self.especialidad)

        # 2. Si tiene texto libre válido (no BACHILLER legacy)
        gt = (self.grado_titulo or "").strip()
        if gt and "BACHILLER" not in gt.upper():
            return gt

        # 3. Derivar de especialidad (fallback)
        return self._derive_from_especialidad()

    @property
    def diploma_label(self):
        """Etiqueta de tipo para la constancia (ej: TÍTULO, GRADO DE BACHILLER)."""
        if self.grado_titulo_type_id:
            return self.grado_titulo_type.diploma_label
        return "TÍTULO"

    def _derive_from_especialidad(self):
        """Derivación legacy por especialidad cuando no hay catálogo configurado."""
        esp = (self.especialidad or "").strip().upper()
        if not esp:
            return "PROFESOR(A) EN EDUCACIÓN"

        import unicodedata
        esp_norm = unicodedata.normalize("NFKD", esp).encode("ascii", "ignore").decode("ascii")

        if "COMUNICACION" in esp_norm:
            return "PROFESOR(A) EN EDUCACIÓN SECUNDARIA, ESPECIALIDAD: COMUNICACIÓN"
        if "COMPUTACION" in esp_norm or "INFORMATICA" in esp_norm:
            return "PROFESOR(A) EN COMPUTACIÓN E INFORMÁTICA"

        return f"PROFESOR(A) EN {esp}"