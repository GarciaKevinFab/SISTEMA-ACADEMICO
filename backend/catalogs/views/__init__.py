"""
Catalogs views module - Estructura modular

Importa todas las vistas para mantener compatibilidad con urls.py
"""

# ViewSets
from .periods import PeriodsViewSet
from .campuses import CampusesViewSet
from .classrooms import ClassroomsViewSet
from .teachers import TeachersViewSet

# UBIGEO
from .ubigeo import (
    ubigeo_departments,
    ubigeo_provinces,
    ubigeo_districts,
    ubigeo_search,
)

# Institution
from .institution import (
    institution_settings,
    institution_media,
    institution_media_delete,
)

# Templates
from .templates import imports_template

# Imports
from .imports import (
    imports_start,
    imports_status,
)

# Backups
from .backups import (
    backups_collection,
    backup_download,
    backup_delete,
    backups_cleanup,
    export_dataset,
)

# Egresados (admin)
from .egresados import (
    egresados_list,
    egresados_stats,
    egresados_update,
    egresados_export,
)

__all__ = [
    # ViewSets
    'PeriodsViewSet',
    'CampusesViewSet',
    'ClassroomsViewSet',
    'TeachersViewSet',
    # UBIGEO
    'ubigeo_departments',
    'ubigeo_provinces',
    'ubigeo_districts',
    'ubigeo_search',
    # Institution
    'institution_settings',
    'institution_media',
    'institution_media_delete',
    # Templates
    'imports_template',
    # Imports
    'imports_start',
    'imports_status',
    # Backups
    'backups_collection',
    'backup_download',
    'backup_delete',
    'backups_cleanup',
    'export_dataset',
    # Egresados
    'egresados_list',
    'egresados_stats',
    'egresados_update',
    'egresados_export',
]