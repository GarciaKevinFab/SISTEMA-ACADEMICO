"""
Mantiene `accounts.User.full_name` derivado del Student, sin importar por
dónde se edite (ficha, importadores, admin de Django, shell).

Antes cada flujo escribía su propia copia — y en orden invertido — así que al
corregir un apellido la copia quedaba con el valor viejo y las pantallas que
la muestran seguían mal aunque la base estuviera bien.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Student
from .name_utils import sync_user_full_name


@receiver(post_save, sender=Student, dispatch_uid="students_sync_user_full_name")
def _sync_full_name(sender, instance, raw=False, **kwargs):
    # `raw=True` en loaddata/fixtures: la BD puede estar a medio cargar
    if raw:
        return
    try:
        sync_user_full_name(instance)
    except Exception:          # nunca romper el guardado del Student por esto
        import logging
        logging.getLogger(__name__).exception(
            "No se pudo sincronizar full_name del student %s", instance.pk)
