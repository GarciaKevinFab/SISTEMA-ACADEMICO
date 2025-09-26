"""
ASGI config for sistema_academico project.

Expone la aplicación ASGI como variable de nivel módulo llamada ``application``.
"""

import os
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sistema_academico.settings')

application = get_asgi_application()
