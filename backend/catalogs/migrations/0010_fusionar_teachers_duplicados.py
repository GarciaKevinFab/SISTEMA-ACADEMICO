# Fichas de docente duplicadas (mismo user): dos requests simultáneos con
# get_or_create podían crear gemelas porque Teacher.user no tenía unicidad;
# desde entonces todo get_or_create tronaba con MultipleObjectsReturned
# ("No se pudo cargar tu perfil / la hoja de vida"). Esta migración fusiona
# las gemelas en la ficha más completa y agrega el candado de unicidad.
from django.db import migrations, models
from django.db.models import Count

# Campos copiables de una ficha gemela a la que se conserva (si está vacía)
CAMPOS_FUSION = [
    "document", "full_name", "email", "phone", "specialization",
    "fecha_nac", "grado_academico", "photo", "condicion_laboral",
    "rd_nombramiento", "rd_fecha",
    "apellido_paterno", "apellido_materno", "nombres", "sexo",
    "telefono_fijo", "direccion", "region", "provincia", "distrito",
]


def fusionar_duplicados(apps, schema_editor):
    Teacher = apps.get_model("catalogs", "Teacher")
    TeacherCVItem = apps.get_model("catalogs", "TeacherCVItem")

    duplicados = (
        Teacher.objects.filter(user__isnull=False)
        .values("user").annotate(n=Count("id")).filter(n__gt=1)
    )
    for d in duplicados:
        filas = list(Teacher.objects.filter(user=d["user"]))
        filas.sort(key=lambda t: (
            -TeacherCVItem.objects.filter(teacher=t).count(),
            0 if (t.document or t.full_name) else 1,
            t.id,
        ))
        titular, gemelas = filas[0], filas[1:]
        for g in gemelas:
            TeacherCVItem.objects.filter(teacher=g).update(teacher=titular)
            for campo in CAMPOS_FUSION:
                if not getattr(titular, campo) and getattr(g, campo):
                    setattr(titular, campo, getattr(g, campo))
            cursos = list(g.courses.all())
            if cursos:
                titular.courses.add(*cursos)
            g.delete()
        titular.save()


class Migration(migrations.Migration):

    dependencies = [
        ("catalogs", "0009_teacher_datos_personales"),
    ]

    # El candado de unicidad va en la 0011: si se crea el índice en la misma
    # transacción que los DELETE de la fusión, Postgres falla con
    # "cannot CREATE INDEX because it has pending trigger events".
    operations = [
        migrations.RunPython(fusionar_duplicados, migrations.RunPython.noop),
    ]
