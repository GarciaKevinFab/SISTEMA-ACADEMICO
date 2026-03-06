"""
Migration: Create GradoTituloType catalog + add FK to Graduate + seed default type

Run: python manage.py migrate graduates

This migration:
1. Creates the GradoTituloType table
2. Adds grado_titulo_type FK to Graduate
3. Seeds the default "TÍTULO DE PROFESOR(A)" type
4. Updates existing BACHILLER records to use the new type
"""
from django.db import migrations, models
import django.db.models.deletion


def seed_default_types(apps, schema_editor):
    """Create default grado/titulo types and update existing graduates."""
    GradoTituloType = apps.get_model("graduates", "GradoTituloType")
    Graduate = apps.get_model("graduates", "Graduate")

    # ── Crear tipo por defecto: TÍTULO DE PROFESOR(A) ──
    titulo_profesor, _ = GradoTituloType.objects.get_or_create(
        code="TITULO_PROFESOR",
        defaults={
            "name": "TÍTULO DE PROFESOR(A)",
            "template": "PROFESOR(A) EN {especialidad}",
            "diploma_label": "TÍTULO",
            "is_default": True,
            "is_active": True,
            "order": 1,
        },
    )

    # ── Actualizar egresados existentes con BACHILLER legacy ──
    import unicodedata

    graduates_to_update = Graduate.objects.filter(
        models.Q(grado_titulo__icontains="BACHILLER") |
        models.Q(grado_titulo="") |
        models.Q(grado_titulo__isnull=True)
    )

    for grad in graduates_to_update.iterator():
        grad.grado_titulo_type_id = titulo_profesor.id

        # Derivar texto desde especialidad
        esp = (grad.especialidad or "").strip().upper()
        if esp:
            esp_norm = unicodedata.normalize("NFKD", esp).encode("ascii", "ignore").decode("ascii")
            if "COMUNICACION" in esp_norm:
                grad.grado_titulo = "PROFESOR(A) EN EDUCACIÓN SECUNDARIA, ESPECIALIDAD: COMUNICACIÓN"
            elif "COMPUTACION" in esp_norm or "INFORMATICA" in esp_norm:
                grad.grado_titulo = "PROFESOR(A) EN COMPUTACIÓN E INFORMÁTICA"
            else:
                grad.grado_titulo = f"PROFESOR(A) EN {esp}"
        else:
            grad.grado_titulo = "PROFESOR(A) EN EDUCACIÓN"

        grad.save(update_fields=["grado_titulo_type_id", "grado_titulo"])


def reverse_seed(apps, schema_editor):
    """Reverse: just remove the FK references."""
    Graduate = apps.get_model("graduates", "Graduate")
    Graduate.objects.all().update(grado_titulo_type_id=None)


class Migration(migrations.Migration):

    dependencies = [
        # Ajustar al nombre de la última migración existente en graduates
        ("graduates", "0001_initial"),  # ← CAMBIAR si tu última migración es otra
    ]

    operations = [
        # 1. Crear tabla GradoTituloType
        migrations.CreateModel(
            name="GradoTituloType",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.CharField(help_text="Identificador único. Ej: TITULO_PROFESOR, BACHILLER, LICENCIATURA", max_length=50, unique=True, verbose_name="Código")),
                ("name", models.CharField(help_text='Nombre para mostrar. Ej: "TÍTULO DE PROFESOR(A)"', max_length=200, verbose_name="Nombre")),
                ("template", models.CharField(help_text='Usa {especialidad} como placeholder. Ej: "PROFESOR(A) EN {especialidad}"', max_length=300, verbose_name="Plantilla de denominación")),
                ("diploma_label", models.CharField(default="TÍTULO", help_text='Texto que aparece como tipo en la constancia.', max_length=100, verbose_name="Etiqueta en diploma")),
                ("is_default", models.BooleanField(default=False, help_text="Si es True, se usa automáticamente al importar egresados sin tipo asignado.", verbose_name="Por defecto")),
                ("is_active", models.BooleanField(default=True, verbose_name="Activo")),
                ("order", models.PositiveIntegerField(default=0, verbose_name="Orden")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Creado")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Actualizado")),
            ],
            options={
                "verbose_name": "Tipo de Grado/Título",
                "verbose_name_plural": "Tipos de Grado/Título",
                "ordering": ["order", "name"],
            },
        ),

        # 2. Agregar FK grado_titulo_type a Graduate
        migrations.AddField(
            model_name="graduate",
            name="grado_titulo_type",
            field=models.ForeignKey(
                blank=True,
                help_text="Tipo de grado/título del catálogo.",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                to="graduates.gradotitulotype",
                verbose_name="Tipo de Grado/Título",
            ),
        ),

        # 3. Cambiar default de grado_titulo a ""
        migrations.AlterField(
            model_name="graduate",
            name="grado_titulo",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Denominación completa. Se genera automáticamente desde el tipo + especialidad.",
                max_length=200,
                verbose_name="Grado / Título (texto libre)",
            ),
        ),

        # 4. Seed datos
        migrations.RunPython(seed_default_types, reverse_seed),
    ]