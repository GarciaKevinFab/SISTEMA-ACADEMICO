# catalogs/models.py
from django.conf import settings
from django.db import models, IntegrityError

class Period(models.Model):
    TERM_CHOICES = (
        ("I", "I"),
        ("II", "II"),
        ("III", "III"),
    )

    code = models.CharField(max_length=40, blank=True, default="")
    year = models.PositiveSmallIntegerField()
    term = models.CharField(max_length=5, choices=TERM_CHOICES, default="I")
    start_date = models.DateField(null=True, blank=True)
    end_date   = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=False)

    label = models.CharField(max_length=80, blank=True, default="")

    def __str__(self):
        nice = self.label or self.code
        return f"{self.code} - {nice}"


class Campus(models.Model):
    code = models.CharField(max_length=40, blank=True, default="", db_index=True)
    name = models.CharField(max_length=120)
    address = models.CharField(max_length=200, blank=True, default="")

    def __str__(self):
        return f"{self.code} - {self.name}"


class Classroom(models.Model):
    campus = models.ForeignKey(Campus, on_delete=models.CASCADE, related_name="classrooms")
    code = models.CharField(max_length=40)
    name = models.CharField(max_length=120, blank=True, default="")
    capacity = models.PositiveIntegerField(default=30)

    class Meta:
        unique_together = ("campus", "code")

    def __str__(self):
        return f"{self.campus.name} - {self.code} ({self.name})"


class Teacher(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="catalog_teachers",
        null=True, blank=True
    )

    document = models.CharField(max_length=30, blank=True, default="")
    full_name = models.CharField(max_length=160, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    phone = models.CharField(max_length=30, blank=True, default="")
    specialization = models.CharField(max_length=120, blank=True, default="")

    # ── Perfil del docente (editable por el propio docente) ──
    GRADOS_ACADEMICOS = [
        ("PROFESOR", "Profesor (a)"),
        ("BACHILLER", "Bachiller (a)"),
        ("LICENCIADO", "Licenciado (a)"),
        ("MAGISTER", "Magister (a)"),
        ("DOCTOR", "Doctor (a)"),
    ]
    fecha_nac = models.DateField(null=True, blank=True)
    grado_academico = models.CharField(
        max_length=20, blank=True, default="", choices=GRADOS_ACADEMICOS)
    photo = models.ImageField(upload_to="teachers/photos/", null=True, blank=True)

    # ── I. Datos personales (Hoja de Vida — perfil de postulante docente) ──
    SEXOS = [("M", "Masculino"), ("F", "Femenino")]
    apellido_paterno = models.CharField(max_length=80, blank=True, default="")
    apellido_materno = models.CharField(max_length=80, blank=True, default="")
    nombres = models.CharField(max_length=120, blank=True, default="")
    sexo = models.CharField(max_length=1, blank=True, default="", choices=SEXOS)
    telefono_fijo = models.CharField(max_length=30, blank=True, default="")
    direccion = models.CharField(max_length=200, blank=True, default="")
    region = models.CharField(max_length=80, blank=True, default="")
    provincia = models.CharField(max_length=80, blank=True, default="")
    distrito = models.CharField(max_length=80, blank=True, default="")

    # ── Vínculo laboral (RD de nombramiento o contrato) ──
    CONDICIONES = [
        ("NOMBRADO", "Nombrado (a)"),
        ("CONTRATADO", "Contratado (a)"),
    ]
    condicion_laboral = models.CharField(
        max_length=20, blank=True, default="", choices=CONDICIONES,
        help_text="Nombrado o contratado")
    rd_nombramiento = models.CharField(
        max_length=120, blank=True, default="",
        help_text="N° de R.D. de nombramiento o contrato")
    rd_fecha = models.DateField(
        null=True, blank=True, help_text="Fecha de la R.D.")

    # ✅ cursos asignados al docente (existentes en academic)
    courses = models.ManyToManyField(
        "academic.Course",
        blank=True,
        related_name="catalog_teachers",
    )

    class Meta:
        constraints = [
            # Una sola ficha por usuario: sin este candado, dos requests
            # simultáneos con get_or_create creaban fichas gemelas y todo
            # acceso posterior tronaba con MultipleObjectsReturned.
            models.UniqueConstraint(
                fields=["user"],
                condition=models.Q(user__isnull=False),
                name="uniq_catalogs_teacher_user",
            ),
        ]

    @classmethod
    def ficha_de(cls, user):
        """Ficha (única) del docente para un usuario autenticado.

        Reemplaza a `get_or_create(user=...)`: si en la BD quedaron fichas
        gemelas, devuelve la más completa (con ítems de CV, luego con
        documento, luego la más antigua) en vez de reventar; y solo crea
        cuando no existe ninguna (tolerando la carrera contra el candado).
        """
        filas = list(cls.objects.filter(user=user))
        if not filas:
            try:
                return cls.objects.create(user=user)
            except IntegrityError:
                return cls.objects.filter(user=user).first()
        if len(filas) == 1:
            return filas[0]
        filas.sort(key=lambda t: (
            -t.cv_items.count(),
            0 if (t.document or t.full_name) else 1,
            t.id,
        ))
        return filas[0]

    def __str__(self):
        if self.user:
            if hasattr(self.user, "full_name") and (self.user.full_name or "").strip():
                return self.user.full_name.strip()
            if hasattr(self.user, "name") and (self.user.name or "").strip():
                return self.user.name.strip()
            if hasattr(self.user, "username") and (self.user.username or "").strip():
                return self.user.username.strip()
            if hasattr(self.user, "email") and (self.user.email or "").strip():
                return self.user.email.strip()
            return "Docente"
        return self.full_name or self.document or f"Teacher {self.pk}"


class Career(models.Model):
    DEGREE_CHOICES = [
        ("BACHELOR", "Bachiller"),
        ("TECHNICAL", "Técnico"),
        ("PROFESSIONAL", "Profesional"),
    ]
    MODALITY_CHOICES = [
        ("PRESENCIAL", "Presencial"),
        ("VIRTUAL", "Virtual"),
        ("SEMIPRESENCIAL", "Semipresencial"),
    ]

    name = models.CharField(max_length=150)
    # ✅ obligatorio y único (import ya lo respeta generando code)
    code = models.CharField(max_length=50, unique=True)

    description = models.TextField(blank=True, default="")
    duration_semesters = models.PositiveIntegerField(default=0)
    vacancies = models.PositiveIntegerField(default=0)

    degree_type = models.CharField(max_length=20, choices=DEGREE_CHOICES, default="BACHELOR")
    modality = models.CharField(max_length=20, choices=MODALITY_CHOICES, default="PRESENCIAL")

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.code} - {self.name}"


class InstitutionSetting(models.Model):
    data = models.JSONField(default=dict)


class MediaAsset(models.Model):
    # ✅ LOGO | LOGO_ALT | SIGNATURE (views ya lo acepta)
    kind = models.CharField(max_length=40)
    file = models.FileField(upload_to="institution/")
    uploaded_at = models.DateTimeField(auto_now_add=True)


class ImportJob(models.Model):
    # ✅ soporta students|courses|grades|plans (views ya lo usa)
    type = models.CharField(max_length=40)
    # ✅ RUNNING|COMPLETED|COMPLETED_WITH_ERRORS|FAILED
    status = models.CharField(max_length=20, default="QUEUED")
    mapping = models.JSONField(default=dict, blank=True)
    file = models.FileField(upload_to="imports/")
    result = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="import_jobs"
    )  # ✅ Campo agregado para trackear usuario


class BackupExport(models.Model):
    scope = models.CharField(max_length=20, default="FULL")  # FULL|DATA_ONLY|FILES_ONLY|DATASET_*
    file = models.FileField(upload_to="backups/", null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

class TeacherCVItem(models.Model):
    """Ítem de la Hoja de Vida del docente (CV modelo institucional).

    Un solo modelo genérico para todas las secciones del CV; el significado
    de cada campo varía por sección (los rótulos los pone el frontend y el
    PDF). `archivo` es el documento que ACREDITA el ítem: el CV "documentado"
    se emite adjuntando estos archivos después de la parte descriptiva.
    """
    SECCIONES = [
        ("FORMACION",       "II. Formación profesional"),
        ("ESPECIALIZACION", "III. Especialización y actualización"),
        ("EXPERIENCIA",     "IV. Experiencia laboral"),
        ("EVENTO",          "V.a Participación en eventos académicos"),
        ("PUBLICACION",     "V.b Publicaciones"),
        ("MERITO",          "VI. Méritos"),
        ("INVESTIGACION",   "VII. Investigación"),
    ]
    # Subsecciones del modelo oficial (Remisión del Currículum Vitae)
    SUBSECCIONES = [
        ("PREGRADO",   "Estudios de pregrado"),
        ("POSTGRADO",  "Estudios de postgrado"),
        ("SEGUNDA_ESP", "Especialización o segunda especialización"),
        ("DIPLOMADO",  "Diplomado"),
        ("ACTIVIDAD",  "Actividad formativa"),
        ("IDIOMA",     "Idioma extranjero"),
        ("LENGUA",     "Lengua originaria"),
        ("TIC",        "Capacitación en TIC"),
        ("EXP_SUPERIOR", "Docente en educación superior"),
        ("EXP_BASICA",   "Docente en educación básica / ETP"),
        ("EXP_CONTINUA", "Formación docente en servicio / continua"),
        ("",           "—"),
    ]

    teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE,
                                related_name="cv_items")
    seccion = models.CharField(max_length=20, choices=SECCIONES)
    subseccion = models.CharField(max_length=20, blank=True, default="",
                                  choices=SUBSECCIONES)

    # Textos libres: los docentes escriben descripciones extensas — con los
    # topes originales (255/500) el 7mo ítem de Experiencia reventaba en la BD
    # con un 500 sin mensaje. Ahora son TextField/limites holgados y la vista
    # valida con un error claro antes de guardar.
    institucion = models.CharField(  # centro de estudios / institución / entidad / lugar
        max_length=500, blank=True, default="")
    titulo = models.CharField(       # nivel académico / curso / cargo / título / tema
        max_length=500, blank=True, default="")
    detalle = models.TextField(      # especialidad / tema / descripción / participación
        blank=True, default="")
    lugar = models.CharField(max_length=200, blank=True, default="")
    duracion = models.CharField(     # horas / duración / calidad (investigación)
        max_length=120, blank=True, default="")
    fecha_inicio = models.DateField(null=True, blank=True)
    fecha_fin = models.DateField(null=True, blank=True)

    archivo = models.FileField(upload_to="teachers/cv/", null=True, blank=True)

    orden = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["seccion", "subseccion", "orden", "fecha_inicio", "id"]
        indexes = [models.Index(fields=["teacher", "seccion"])]

    def __str__(self):
        return f"CV<{self.teacher_id}:{self.seccion}:{self.titulo[:30]}>"
