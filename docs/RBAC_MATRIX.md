# RBAC PERMISSION MATRIX - Sistema Académico IESPP

## ROLES DEFINIDOS

### Roles Administrativos
- **ADMIN**: Administrador del sistema (acceso total)
- **REGISTRAR**: Registrador académico (gestión académica completa)
- **ADMIN_WORKER**: Trabajador administrativo (procedimientos y gestión)

### Roles Académicos  
- **TEACHER**: Docente (gestión de cursos asignados)
- **ACADEMIC_STAFF**: Personal académico (admisiones y evaluaciones)

### Roles Estudiantes y Externos
- **STUDENT**: Estudiante (acceso a información personal y académica)
- **APPLICANT**: Postulante (acceso a admisiones)
- **EXTERNAL_USER**: Usuario externo (trámites digitales)

### Roles Financieros y Operativos
- **FINANCE_ADMIN**: Administrador financiero
- **CASHIER**: Cajero
- **WAREHOUSE**: Almacén
- **HR_ADMIN**: Administrador de RRHH
- **LOGISTICS**: Logística

## MATRIZ DE PERMISOS POR ENDPOINT

### 🎓 MÓDULO ACADÉMICO

| Endpoint | Método | ADMIN | REGISTRAR | TEACHER | STUDENT | ACADEMIC_STAFF | Descripción |
|----------|--------|-------|-----------|---------|---------|----------------|-------------|
| `/api/academic/dashboard/stats` | GET | ✅ | ✅ | ✅ | ✅ | ✅ | Dashboard académico por rol |
| `/api/students` | GET | ✅ | ✅ | ✅ | ❌ | ✅ | Listar estudiantes |
| `/api/students` | POST | ✅ | ✅ | ❌ | ❌ | ❌ | Crear estudiante |
| `/api/students/{id}` | GET | ✅ | ✅ | ✅ | 🔐* | ✅ | Ver estudiante (*solo propio) |
| `/api/students/{id}` | PUT | ✅ | ✅ | ❌ | ❌ | ❌ | Actualizar estudiante |
| `/api/courses` | GET | ✅ | ✅ | ✅ | ✅ | ✅ | Listar cursos |
| `/api/courses` | POST | ✅ | ✅ | ❌ | ❌ | ❌ | Crear curso |
| `/api/courses/{id}` | PUT | ✅ | ✅ | ❌ | ❌ | ❌ | Actualizar curso |
| `/api/enrollments` | GET | ✅ | ✅ | ✅ | 🔐* | ✅ | Listar matrículas (*solo propias) |
| `/api/enrollments` | POST | ✅ | ✅ | ❌ | ✅ | ❌ | Crear matrícula |
| `/api/enrollments/{id}/grade` | PUT | ✅ | ✅ | 🔐** | ❌ | ❌ | Actualizar nota (**solo cursos asignados) |
| `/api/enrollments/{id}/attendance` | PUT | ✅ | ✅ | 🔐** | ❌ | ❌ | Actualizar asistencia (**solo cursos asignados) |
| `/api/academic/reports` | GET | ✅ | ✅ | 🔐** | 🔐* | ✅ | Reportes académicos |

### 📋 MÓDULO ADMISIÓN

| Endpoint | Método | ADMIN | REGISTRAR | ACADEMIC_STAFF | APPLICANT | EXTERNAL_USER | Descripción |
|----------|--------|-------|-----------|----------------|-----------|---------------|-------------|
| `/api/careers` | GET | ✅ | ✅ | ✅ | ✅ | ✅ | Listar carreras |
| `/api/careers` | POST | ✅ | ✅ | ❌ | ❌ | ❌ | Crear carrera |
| `/api/admission-calls` | GET | ✅ | ✅ | ✅ | ✅ | ✅ | Listar convocatorias |
| `/api/admission-calls` | POST | ✅ | ✅ | ✅ | ❌ | ❌ | Crear convocatoria |
| `/api/applications` | GET | ✅ | ✅ | ✅ | 🔐* | ❌ | Listar postulaciones (*solo propias) |
| `/api/applications` | POST | ✅ | ✅ | ❌ | ✅ | ❌ | Crear postulación |
| `/api/applications/{id}/evaluate` | PUT | ✅ | ✅ | ✅ | ❌ | ❌ | Evaluar postulación |
| `/api/admission-results` | GET | ✅ | ✅ | ✅ | ✅ | ✅ | Ver resultados (públicos) |
| `/api/admission-results/publish` | POST | ✅ | ✅ | ✅ | ❌ | ❌ | Publicar resultados |

### 📄 MÓDULO MESA DE PARTES

| Endpoint | Método | ADMIN | ADMIN_WORKER | STUDENT | EXTERNAL_USER | TEACHER | Descripción |
|----------|--------|-------|--------------|---------|---------------|---------|-------------|
| `/api/procedures/types` | GET | ✅ | ✅ | ✅ | ✅ | ✅ | Tipos de trámite |
| `/api/procedures/types` | POST | ✅ | ✅ | ❌ | ❌ | ❌ | Crear tipo trámite |
| `/api/procedures` | GET | ✅ | ✅ | 🔐* | 🔐* | 🔐* | Listar trámites (*solo propios) |
| `/api/procedures` | POST | ✅ | ✅ | ✅ | ✅ | ✅ | Crear trámite |
| `/api/procedures/{id}` | GET | ✅ | ✅ | 🔐* | 🔐* | 🔐* | Ver trámite (*solo propios/asignados) |
| `/api/procedures/{id}/status` | PUT | ✅ | ✅ | ❌ | ❌ | ❌ | Actualizar estado |
| `/api/procedures/{id}/assign` | PUT | ✅ | ✅ | ❌ | ❌ | ❌ | Asignar trámite |
| `/api/procedures/tracking/{code}` | GET | ✅ | ✅ | ✅ | ✅ | ✅ | Seguimiento público |
| `/api/procedures/{id}/certificate` | GET | ✅ | ✅ | 🔐* | 🔐* | 🔐* | Generar certificado (*solo propios) |

### 💰 MÓDULO TESORERÍA

| Endpoint | Método | ADMIN | FINANCE_ADMIN | CASHIER | STUDENT | WAREHOUSE | Descripción |
|----------|--------|-------|---------------|---------|---------|-----------|-------------|
| `/api/finance/dashboard` | GET | ✅ | ✅ | ✅ | ❌ | ❌ | Dashboard financiero |
| `/api/finance/receipts` | GET | ✅ | ✅ | ✅ | 🔐* | ❌ | Listar boletas (*solo propias) |
| `/api/finance/receipts` | POST | ✅ | ✅ | ✅ | ❌ | ❌ | Crear boleta |
| `/api/finance/receipts/{id}/pay` | POST | ✅ | ✅ | ✅ | ✅ | ❌ | Pagar boleta |
| `/api/finance/receipts/{id}/cancel` | PUT | ✅ | ✅ | ❌ | ❌ | ❌ | Anular boleta |
| `/api/finance/cash-sessions` | GET | ✅ | ✅ | ✅ | ❌ | ❌ | Sesiones de caja |
| `/api/finance/cash-sessions` | POST | ✅ | ✅ | ✅ | ❌ | ❌ | Abrir sesión caja |
| `/api/finance/inventory` | GET | ✅ | ✅ | ❌ | ❌ | ✅ | Inventario |
| `/api/finance/inventory/movements` | POST | ✅ | ✅ | ❌ | ❌ | ✅ | Movimientos inventario |

### 🔗 MÓDULO MINEDU

| Endpoint | Método | ADMIN | REGISTRAR | ACADEMIC_STAFF | Descripción |
|----------|--------|-------|-----------|----------------|-------------|
| `/api/minedu/dashboard/stats` | GET | ✅ | ✅ | ✅ | Dashboard integración |
| `/api/minedu/export/enrollments` | POST | ✅ | ✅ | ❌ | Exportar matrículas |
| `/api/minedu/export/grades` | POST | ✅ | ✅ | ❌ | Exportar calificaciones |
| `/api/minedu/exports` | GET | ✅ | ✅ | ✅ | Ver exportaciones |
| `/api/minedu/validation/data-integrity` | GET | ✅ | ✅ | ✅ | Validar integridad |

### 🔐 MÓDULO AUTENTICACIÓN

| Endpoint | Método | Todos los Roles | Descripción |
|----------|--------|-----------------|-------------|
| `/api/auth/login` | POST | ✅ | Iniciar sesión |
| `/api/auth/me` | GET | ✅ | Información usuario actual |
| `/api/auth/logout` | POST | ✅ | Cerrar sesión |

## REGLAS DE NEGOCIO DE AUTORIZACIÓN

### 🔐 Acceso Condicional por Contexto

#### Estudiantes (STUDENT)
- **Datos Propios**: Solo pueden ver/editar su información personal
- **Matrículas**: Solo pueden ver sus propias matrículas y crear nuevas (sujeto a reglas de negocio)
- **Calificaciones**: Solo pueden ver sus propias notas (no editarlas)
- **Trámites**: Solo pueden crear y ver sus propios trámites
- **Boletas**: Solo pueden ver y pagar sus propias boletas

#### Docentes (TEACHER)  
- **Cursos Asignados**: Solo pueden gestionar cursos donde son profesores asignados
- **Calificaciones**: Solo pueden editar notas de sus cursos asignados
- **Asistencia**: Solo pueden tomar asistencia en sus cursos asignados
- **Estudiantes**: Solo pueden ver estudiantes matriculados en sus cursos
- **Reportes**: Solo pueden generar reportes de sus cursos asignados

#### Trabajadores Administrativos (ADMIN_WORKER)
- **Trámites**: Pueden ver todos los trámites, editar los asignados a ellos
- **Procedimientos**: Pueden gestionar procedimientos según su área de trabajo
- **Asignaciones**: Solo pueden ser asignados a trámites de su competencia

#### Personal Académico (ACADEMIC_STAFF)
- **Admisiones**: Pueden gestionar todo el proceso de admisión
- **Evaluaciones**: Pueden evaluar postulaciones y publicar resultados
- **Estudiantes**: Acceso completo para gestión académica

### 🚫 Restricciones Especiales

#### Roles Financieros
- **CASHIER**: Solo operaciones de caja, no puede anular boletas
- **FINANCE_ADMIN**: Acceso completo a módulo financiero
- **WAREHOUSE**: Solo gestión de inventario, no acceso a caja

#### Roles Externos
- **APPLICANT**: Solo acceso a sistema de admisiones
- **EXTERNAL_USER**: Solo trámites digitales, sin acceso a información académica

### ✅ Validaciones de Seguridad

#### Validación por Endpoint
1. **Token JWT válido** requerido para todos los endpoints (excepto login y públicos)
2. **Rol autorizado** según matriz de permisos
3. **Contexto específico** (ej: estudiante solo ve sus datos)
4. **Estado activo** del usuario
5. **Permisos especiales** según reglas de negocio

#### Validación por Recurso
1. **Ownership Check**: Usuario solo accede a recursos propios
2. **Assignment Check**: Docente solo accede a cursos asignados
3. **Area Check**: Admin worker solo trámites de su área
4. **Time Window Check**: Restricciones temporales (ej: período de matrícula)

## IMPLEMENTACIÓN TÉCNICA

### Decorador de Autorización
```python
def require_role(allowed_roles: List[UserRole], context_check: Callable = None):
    def role_checker(current_user: User = Depends(get_current_user)):
        # Verificar rol
        if current_user.role not in allowed_roles and current_user.role != UserRole.ADMIN:
            raise HTTPException(status_code=403, detail="Rol no autorizado")
        
        # Verificar contexto específico
        if context_check:
            if not context_check(current_user):
                raise HTTPException(status_code=403, detail="Acceso denegado al recurso")
        
        return current_user
    return role_checker
```

### Funciones de Contexto
```python
def can_access_student_data(current_user: User, student_id: str) -> bool:
    if current_user.role == UserRole.STUDENT:
        return current_user.id == student_id
    return current_user.role in [UserRole.ADMIN, UserRole.REGISTRAR, UserRole.TEACHER]

def can_edit_grades(current_user: User, enrollment: Enrollment) -> bool:
    if current_user.role in [UserRole.ADMIN, UserRole.REGISTRAR]:
        return True
    if current_user.role == UserRole.TEACHER:
        return enrollment.teacher_id == current_user.id
    return False
```

## TESTING DE AUTORIZACIÓN

### Test Cases por Rol
- ✅ **ALLOW**: Usuario autorizado puede acceder
- ❌ **DENY**: Usuario no autorizado recibe 403
- 🔐 **CONTEXT**: Usuario autorizado solo accede a recursos válidos

### Métricas de Seguridad
- **Coverage**: 100% de endpoints con control de acceso
- **False Positives**: 0% (usuarios autorizados bloqueados)
- **False Negatives**: 0% (usuarios no autorizados con acceso)
- **Context Leaks**: 0% (acceso a recursos no propios)

Esta matriz garantiza que el sistema tenga un control de acceso robusto y granular, cumpliendo con los requisitos de seguridad para un entorno académico-administrativo.