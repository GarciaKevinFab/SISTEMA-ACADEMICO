/* src/modules/admin/aclTranslations.js */

const DICCIONARIO = {
  // --- ROLES (Extraídos de tus imágenes) ---
  'ADMIN_SYSTEM': 'Administrador del Sistema',
  'ACCESS_ADMIN': 'Administrador de Accesos',
  'SECURITY_ADMIN': 'Administrador de Seguridad',
  'ADMIN_ACADEMIC': 'Administrador Académico',
  'REGISTRAR': 'Registro / Secretaría',
  'TEACHER': 'Docente',
  'STUDENT': 'Estudiante',
  'ADMISSION_OFFICER': 'Oficial de Admisión',
  'MPV_OFFICER': 'Oficial de Mesa de Partes',
  'MPV_MANAGER': 'Gestor de Mesa de Partes',
  'CASHIER': 'Cajero',
  'ACCOUNTANT': 'Contador',
  'FINANCE_ADMIN': 'Admin. Financiero',
  'WAREHOUSE': 'Almacén',
  'LOGISTICS': 'Logística',
  'HR_ADMIN': 'Recursos Humanos',
  'MINEDU_INTEGRATION': 'Integración MINEDU',
  'PORTAL_ADMIN': 'Administrador del Portal',
  'RESEARCH_COORDINATOR': 'Coordinador de Investigación',
  'TEACHER_RESEARCHER': 'Docente Investigador',
  'CALLS_COMMITTEE': 'Comité de Convocatorias',

  // --- PERMISOS (Extraídos de tus imágenes) ---
  // Administración
  'admin.access.manage': 'Gestionar Accesos',
  'admin.audit.view': 'Ver Auditoría',
  'admin.audit.export': 'Exportar Auditoría',
  
  // Seguridad
  'security.policies.manage': 'Gestionar Políticas de Seg.',
  'security.sessions.inspect': 'Inspeccionar Sesiones',
  
  // Académico - Planes y Secciones
  'academic.plans.view': 'Ver Planes de Estudio',
  'academic.plans.edit': 'Editar Planes de Estudio',
  'academic.plans.manage': 'Gestionar Planes',
  'academic.sections.view': 'Ver Secciones',
  'academic.sections.create': 'Crear Secciones',
  'academic.sections.conflicts': 'Gestionar Conflictos de Horario',
  
  // Académico - Matrícula
  'academic.enrollment.view': 'Ver Matrículas',
  'academic.enrollment.commit': 'Procesar Matrículas',
  
  // Académico - Notas
  'academic.grades.edit': 'Editar Notas',
  'academic.grades.submit': 'Enviar Notas Finales',
  'academic.grades.reopen': 'Reabrir Registro de Notas',
  
  // Académico - Varios
  'academic.syllabus.upload': 'Subir Sílabo',
  'academic.syllabus.delete': 'Eliminar Sílabo',
  'academic.evaluation.config': 'Configurar Evaluaciones',
  'academic.kardex.view': 'Ver Kardex',
  'academic.reports.view': 'Ver Reportes Académicos',
  'academic.attendance.view': 'Ver Asistencia',
  'academic.attendance.edit': 'Editar Asistencia',
  'academic.acts.view': 'Ver Actas',
  'academic.acts.close': 'Cerrar Actas',
  'academic.acts.export': 'Exportar Actas',
  'academic.view': 'Vista Académica General'
};

// Función auxiliar
export const t = (key) => {
  if (!key) return "";
  if (DICCIONARIO[key]) return DICCIONARIO[key];
  
  // Fallback inteligente: Si aparece un código nuevo no registrado (ej: NEW_ROLE)
  // lo formatea bonito (New Role) en lugar de romper la app.
  return key.toString()
    .replace(/\./g, ' ')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, l => l.toUpperCase());
};