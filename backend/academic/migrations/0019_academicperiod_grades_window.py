# Generated manually for AcademicPeriod.grades_start / grades_end
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('academic', '0018_enrollmentpayment_receipt_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='academicperiod',
            name='grades_start',
            field=models.DateTimeField(
                blank=True,
                null=True,
                help_text='Inicio de la ventana de carga de notas para docentes',
            ),
        ),
        migrations.AddField(
            model_name='academicperiod',
            name='grades_end',
            field=models.DateTimeField(
                blank=True,
                null=True,
                help_text='Fin de la ventana de carga de notas para docentes',
            ),
        ),
    ]
