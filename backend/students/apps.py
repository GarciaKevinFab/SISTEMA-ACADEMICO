from django.apps import AppConfig


class StudentsConfig(AppConfig):
    name = 'students'

    def ready(self):
        # Registra la sincronización de User.full_name (ver students/signals.py)
        from . import signals  # noqa: F401
