# MANUAL COMPLETO DE USUARIO
## Sistema Académico Integral IESPP "Gustavo Allende Llavería"

### Versión 1.0 - Diciembre 2024

---

## ÍNDICE

1. [Introducción](#introducción)
2. [Acceso al Sistema](#acceso-al-sistema)
3. [Módulo Académico](#módulo-académico)
4. [Módulo de Admisión](#módulo-de-admisión)
5. [Mesa de Partes Virtual](#mesa-de-partes-virtual)
6. [Módulo de Tesorería y Administración](#módulo-de-tesorería-y-administración)
7. [Roles y Permisos](#roles-y-permisos)
8. [Solución de Problemas](#solución-de-problemas)

---

## INTRODUCCIÓN

El Sistema Académico Integral es una plataforma completa diseñada para gestionar todos los procesos académicos y administrativos del Instituto de Educación Superior Pedagógico Público "Gustavo Allende Llavería".

### Características Principales

- **Gestión Académica Completa**: Estudiantes, cursos, matrículas, calificaciones
- **Proceso de Admisión**: Convocatorias, postulaciones, evaluaciones
- **Mesa de Partes Virtual**: Trámites digitales con seguimiento
- **Tesorería y Administración**: Finanzas, inventario, recursos humanos
- **Integración MINEDU**: Sincronización con sistemas gubernamentales

### Requisitos del Sistema

- **Navegador Web**: Chrome, Firefox, Safari, Edge (versiones actuales)
- **Conexión a Internet**: Estable para óptimo rendimiento
- **Resolución**: Mínimo 1024x768 (recomendado 1920x1080)

---

## ACCESO AL SISTEMA

### Página Principal

1. **Acceder**: Ingrese a la URL del sistema
2. **Navegación**: Explore información institucional
3. **Login**: Clic en "Acceso al Sistema" o "Iniciar Sesión"

### Proceso de Login

1. **Credenciales**: Ingrese usuario y contraseña
2. **Validación**: El sistema verifica automáticamente
3. **Dashboard**: Acceso según su rol asignado

### Credenciales de Demostración

```
Administrador: admin@universidad.edu / password123
Docente: teacher@universidad.edu / password123
Estudiante: student@universidad.edu / password123
Postulante: applicant@universidad.edu / password123
Finanzas: finance@universidad.edu / password123
```

### Recuperación de Contraseña

1. Clic en "¿Olvidaste tu contraseña?"
2. Ingrese su correo electrónico
3. Revise su bandeja de entrada
4. Siga las instrucciones del correo

---

## MÓDULO ACADÉMICO

### Dashboard Académico

**Funcionalidades por Rol:**

#### Administrador/Registrador
- Gestión completa de estudiantes
- Administración de cursos y carreras
- Control de matrículas y períodos académicos
- Generación de reportes académicos

#### Docentes
- Gestión de cursos asignados
- Registro de asistencia por sesiones
- Calificación de estudiantes
- Generación de actas de notas

#### Estudiantes
- Visualización de plan de estudios
- Consulta de notas y asistencia
- Matrícula en línea
- Solicitud de constancias

### Gestión de Estudiantes

#### Registro de Nuevo Estudiante

1. **Acceso**: Dashboard → Estudiantes → "Nuevo Estudiante"
2. **Datos Personales**:
   - Nombres y apellidos completos
   - Fecha de nacimiento
   - Género (M/F)
3. **Documentos de Identidad**:
   - Tipo: DNI, Carné de Extranjería, Pasaporte, Carné CONADIS
   - Número de documento (8 dígitos para DNI)
4. **Contacto**:
   - Correo electrónico (opcional)
   - Teléfono
   - Dirección completa (distrito, provincia, departamento)
5. **Información Académica**:
   - Programa de estudios
   - Año de ingreso
6. **Necesidades Especiales**:
   - Indicar si tiene discapacidad
   - Descripción detallada
   - Apoyos requeridos

#### Búsqueda y Filtros

- **Búsqueda rápida**: Por nombre, DNI o código de estudiante
- **Filtros**:
  - Programa de estudios
  - Estado (Matriculado, Transferido, Retirado, etc.)
  - Año de ingreso
  - Con/sin discapacidad

### Gestión de Cursos

#### Creación de Cursos

1. **Información Básica**:
   - Código único del curso
   - Nombre descriptivo
   - Número de créditos (1-10)
   - Semestre académico
2. **Configuración Académica**:
   - Programa al que pertenece
   - Descripción del curso
   - Prerrequisitos (si aplica)

#### Asignación de Docentes

1. **Selección**: Elegir docente calificado
2. **Horarios**: Configurar días y horas de clase
3. **Aula**: Asignar salón específico
4. **Capacidad**: Definir número máximo de estudiantes

### Sistema de Matrículas

#### Proceso de Matrícula

1. **Validación de Prerrequisitos**:
   - Verificación automática de cursos aprobados
   - Alertas por cursos pendientes
2. **Selección de Cursos**:
   - Cursos disponibles según plan de estudios
   - Verificación de horarios (sin conflictos)
   - Control de créditos máximos por semestre
3. **Confirmación**:
   - Revisión final de selección
   - Generación automática de horario personal
   - Emisión de constancia de matrícula

#### Restricciones del Sistema

- **Máximo 24 créditos** por semestre regular
- **Prerrequisitos obligatorios** (configurable por curso)
- **Horarios sin conflicto** (validación automática)
- **Cupos disponibles** en cada curso

### Registro de Calificaciones

#### Sistema de Notas Peruano

**Escala Numérica (0-20)**:
- 18-20: AD (Logro Destacado)
- 14-17: A (Logro Esperado)
- 11-13: B (En Proceso)
- 0-10: C (En Inicio)

#### Proceso de Calificación

1. **Componentes de Evaluación**:
   - Exámenes parciales
   - Trabajos prácticos
   - Participación en clase
   - Examen final
2. **Ponderación**:
   - Cada componente tiene peso específico
   - Cálculo automático de promedio final
3. **Validación**:
   - Notas entre 0 y 20
   - Conversión automática a escala literal
   - Estado: Aprobado (≥11) / Desaprobado (<11)

### Registro de Asistencia

#### Sesiones de Clase

1. **Creación de Sesión**:
   - Fecha y tema de la clase
   - Lista automática de estudiantes matriculados
2. **Marcado de Asistencia**:
   - Presente
   - Ausente
   - Tardanza (con hora de llegada)
   - Falta justificada
3. **Estadísticas**:
   - Cálculo automático de porcentaje de asistencia
   - Alertas por bajo nivel de asistencia (<75%)

### Reportes Académicos

#### Tipos de Reportes

1. **Actas de Notas**:
   - Por curso y período académico
   - Firmadas digitalmente
   - Exportación a PDF
2. **Transcripts Oficiales**:
   - Historial académico completo
   - Cálculo de GPA (promedio ponderado)
   - Estado académico (Excelente, Bueno, Regular, etc.)
3. **Reportes Estadísticos**:
   - Rendimiento por carrera
   - Índices de aprobación/desaprobación
   - Asistencia promedio

---

## MÓDULO DE ADMISIÓN

### Panel de Postulantes

Para usuarios con rol **APPLICANT**:

#### Mi Postulación

1. **Estado Actual**:
   - Número de postulación único
   - Estado del proceso
   - Fecha de registro
2. **Carreras Seleccionadas**:
   - Primera opción
   - Segunda opción (si aplica)
   - Tercera opción (si aplica)
3. **Cronograma Personal**:
   - Fechas importantes específicas
   - Recordatorios automáticos

#### Carga de Documentos

**Documentos Requeridos**:
- Partida de nacimiento
- Certificado de estudios
- Fotografía reciente
- Copia de DNI
- Carné CONADIS (si aplica)

**Proceso de Carga**:
1. Seleccionar tipo de documento
2. Examinar y subir archivo (PDF, JPG, PNG)
3. Verificación automática de formato
4. Confirmación de carga exitosa

#### Seguimiento del Proceso

**Estados de Postulación**:
- **Registrado**: Postulación inicial completada
- **Documentos Pendientes**: Faltan documentos por cargar
- **Documentos Completos**: Expediente completo
- **Evaluado**: Proceso de evaluación completado
- **Admitido**: Resultado favorable
- **No Admitido**: No alcanzó el puntaje mínimo
- **Lista de Espera**: En espera de cupos disponibles

### Panel Administrativo (Admin/Academic Staff)

#### Gestión de Convocatorias

1. **Crear Nueva Convocatoria**:
   - Nombre descriptivo
   - Año y período académico
   - Fechas del proceso (inscripción, examen, resultados)
   - Configuración de costos y requisitos
2. **Configuración de Vacantes**:
   - Vacantes por carrera
   - Criterios de admisión
   - Pesos de evaluación (examen 80%, entrevista 20%)

#### Evaluación de Postulantes

1. **Revisión de Documentos**:
   - Verificación de completitud
   - Validación de autenticidad
   - Aprobación o solicitud de correcciones
2. **Registro de Calificaciones**:
   - Puntaje de examen (0-20)
   - Puntaje de entrevista (0-20)
   - Cálculo automático de nota final
3. **Generación de Rankings**:
   - Ordenamiento por puntaje final
   - Aplicación de criterios de desempate
   - Determinación de admitidos por carrera

#### Publicación de Resultados

1. **Revisión Final**:
   - Verificación de cálculos
   - Validación de cupos y vacantes
2. **Publicación**:
   - Resultados públicos por número de postulación
   - Notificaciones automáticas por correo
   - Generación de constancias

---

## MESA DE PARTES VIRTUAL

### Tipos de Trámites

#### Constancias Académicas

1. **Constancia de Matrícula**:
   - Acredita matriculación vigente
   - Tiempo de procesamiento: 3 días hábiles
   - Documentos requeridos: DNI, fotografía

2. **Constancia de Notas**:
   - Certificado oficial de calificaciones
   - Tiempo de procesamiento: 5 días hábiles
   - Documentos requeridos: DNI, recibo de pago

3. **Constancia de Egresado**:
   - Certificado de culminación de estudios
   - Tiempo de procesamiento: 7 días hábiles
   - Documentos requeridos: DNI, fotografía, recibo de pago

#### Trámites Administrativos

1. **Traslado Externo**:
   - Solicitud para estudiar en otra institución
   - Tiempo de procesamiento: 10 días hábiles
   - Documentos: DNI, carta de motivos, constancia de notas

2. **Rectificación de Datos**:
   - Corrección de información personal
   - Tiempo de procesamiento: 15 días hábiles
   - Documentos: DNI, partida de nacimiento, declaración jurada

### Proceso de Solicitud

#### Paso 1: Crear Solicitud

1. **Acceso**: Mesa de Partes → "Nuevo Trámite"
2. **Selección**: Elegir tipo de trámite
3. **Información Personal**:
   - Datos del solicitante
   - Información de contacto
4. **Detalles del Trámite**:
   - Asunto específico
   - Descripción detallada
   - Prioridad (Normal, Alta, Urgente)

#### Paso 2: Adjuntar Documentos

1. **Documentos Requeridos**: Lista automática según tipo de trámite
2. **Carga de Archivos**: Formato PDF, máximo 5MB por archivo
3. **Validación**: Verificación automática de formatos

#### Paso 3: Confirmación

1. **Revisión Final**: Verificar datos y documentos
2. **Envío**: Confirmar solicitud
3. **Código de Seguimiento**: Número único generado automáticamente

### Seguimiento de Trámites

#### Estados de Trámite

- **Recibido**: Solicitud ingresada al sistema
- **En Proceso**: Siendo revisada por personal administrativo
- **Pendiente de Información**: Requiere documentos adicionales
- **Finalizado**: Trámite completado exitosamente
- **Rechazado**: No cumple con los requisitos

#### Consulta Pública

1. **Acceso**: Sin necesidad de login
2. **Código de Seguimiento**: Ingresar número único
3. **Estado Actual**: Información actualizada en tiempo real
4. **Notificaciones**: Alertas automáticas por correo electrónico

---

## MÓDULO DE TESORERÍA Y ADMINISTRACIÓN

### Dashboard Financiero

#### Indicadores Principales
- Ingresos del día/mes
- Saldo de caja actual
- Alertas de inventario
- Empleados activos

### Caja y Bancos

#### Sesiones de Caja

1. **Apertura de Caja**:
   - Monto inicial en efectivo
   - Validación de billetes y monedas
   - Registro de fondo fijo
2. **Operaciones Durante el Día**:
   - Ingresos por pagos de estudiantes
   - Egresos por gastos operativos
   - Transferencias entre cuentas
3. **Cierre de Caja**:
   - Conteo físico obligatorio
   - Comparación con saldo teórico
   - Justificación de diferencias
   - Generación de arqueo automático

#### Conciliación Bancaria

1. **Importación de Movimientos**:
   - Carga de archivos CSV/Excel del banco
   - Validación automática de formato
   - Detección de duplicados
2. **Conciliación Automática**:
   - Coincidencia por monto y fecha
   - Tolerancia de ±2 centavos
   - Marcado de movimientos conciliados
3. **Diferencias**:
   - Identificación de partidas no conciliadas
   - Investigación de discrepancias
   - Ajustes contables

### Boletas Internas

#### Generación de Boletas

1. **Información del Cliente**:
   - Datos del estudiante o tercero
   - Documento de identidad
2. **Conceptos**:
   - Matrícula, pensiones, constancias
   - Centro de costos asignado
   - Monto por concepto
3. **Procesamiento**:
   - Numeración automática por serie
   - Generación de código QR
   - Emisión de PDF

#### Estados de Boletas

- **Pendiente**: Emitida, esperando pago
- **Pagada**: Pago registrado y confirmado
- **Anulada**: Cancelada antes del pago
- **Devuelta**: Reembolso procesado

#### Verificación Pública de QR

1. **Acceso Sin Login**: Cualquier persona puede verificar
2. **Datos Mostrados**:
   - Número de boleta y serie
   - Fecha de emisión
   - Monto total
   - Estado actual
3. **Datos Protegidos**: Información personal del cliente enmascarada

### Inventario y Kardex

#### Gestión de Items

1. **Registro de Productos**:
   - Código único del item
   - Descripción y categoría
   - Unidad de medida
   - Stock mínimo y máximo
2. **Tipos de Movimiento**:
   - **Entrada**: Compras, donaciones, devoluciones
   - **Salida**: Consumo, ventas, mermas
   - **Transferencia**: Entre almacenes
   - **Ajuste**: Correcciones de inventario

#### Sistema FIFO

1. **Costeo Automático**:
   - Primero en entrar, primero en salir
   - Cálculo preciso de costos
   - Valorización automática de salidas
2. **Prevención de Stock Negativo**:
   - Configurable por item
   - Bloqueo de salidas sin stock
   - Alertas de stock bajo

### Logística

#### Gestión de Proveedores

1. **Registro de Proveedores**:
   - RUC con validación MOD 11
   - Razón social y contacto
   - Clasificación y categoría
2. **Evaluación de Proveedores**:
   - Historial de entregas
   - Calidad de productos
   - Cumplimiento de plazos

#### Órdenes de Compra

1. **Flujo Completo**:
   - Requerimiento → Orden de Compra → Recepción → Inventario
2. **Estados**:
   - Borrador → Emitida → Recepción Parcial → Recepción Total
3. **Recepciones Parciales**:
   - Control de cantidades pendientes
   - Bloqueo de sobre-recepciones
   - Actualización automática de inventario

### Recursos Humanos

#### Gestión de Personal

1. **Registro de Empleados**:
   - Datos personales completos
   - Información contractual
   - Documentos digitalizados
2. **Tipos de Contrato**:
   - Nombrado (permanente)
   - Contratado (temporal)
   - CAS (contrato administrativo)
   - Locación de servicios

#### Control de Asistencia

1. **Registro Manual**:
   - Hora de ingreso y salida
   - Tiempo de refrigerio
   - Horas trabajadas calculadas automáticamente
2. **Importación Masiva**:
   - Carga de archivos CSV
   - Validación de datos
   - Detección de duplicados y errores
3. **Reportes de Asistencia**:
   - Resumen mensual por empleado
   - Horas extras y tardanzas
   - Faltas justificadas e injustificadas

### Auditoría y Seguridad

#### Logs de Auditoría

1. **Registro Inmutable**:
   - Todas las operaciones quedan registradas
   - Imposible modificar o eliminar logs
   - Hash de integridad para cada registro
2. **Información Capturada**:
   - Usuario que realizó la acción
   - Fecha y hora exacta
   - Valores anteriores y nuevos
   - IP de origen
   - ID de correlación

#### Enmascaramiento de Datos

- **Datos Sensibles Protegidos**:
  - Números de documento: "12****78"
  - Correos electrónicos: "us***@domain.com"
  - Teléfonos: "987***456"
  - Direcciones: Primera y última palabra visible

---

## ROLES Y PERMISOS

### Matriz de Permisos

#### ADMIN (Administrador del Sistema)
**Acceso Universal**: Todos los módulos y funciones
- Gestión completa de usuarios
- Configuración del sistema
- Acceso a todos los reportes
- Funciones de auditoría y seguridad

#### REGISTRAR (Registrador Académico)
**Módulos**: Académico, Admisión, Mesa de Partes
- Gestión de estudiantes y cursos
- Administración de matrículas
- Procesamiento de trámites académicos
- Generación de reportes académicos

#### TEACHER (Docente)
**Módulos**: Académico (limitado)
- Gestión de cursos asignados
- Registro de asistencia y calificaciones
- Consulta de información de estudiantes
- Generación de actas de notas

#### STUDENT (Estudiante)
**Módulos**: Académico (consulta), Mesa de Partes, Admisión (si aplica)
- Consulta de notas y asistencia
- Matrícula en línea (períodos habilitados)
- Solicitud de trámites
- Descarga de constancias

#### APPLICANT (Postulante)
**Módulos**: Admisión, Mesa de Partes
- Gestión de postulación
- Carga de documentos
- Consulta de resultados
- Solicitud de constancias de postulación

#### FINANCE_ADMIN (Administrador Financiero)
**Módulos**: Tesorería completa, Mesa de Partes
- Gestión financiera completa
- Configuración de conceptos y centros de costo
- Supervisión de operaciones de caja
- Reportes financieros y contables

#### CASHIER (Cajero/a)
**Módulos**: Tesorería (operaciones de caja), Mesa de Partes
- Operaciones de caja diarias
- Generación y cobro de boletas
- Registro de pagos
- Arqueos de caja

#### WAREHOUSE (Almacenero)
**Módulos**: Inventario y Logística
- Gestión de inventario
- Recepción de mercadería
- Movimientos de almacén
- Reportes de stock

#### HR_ADMIN (Administrador de RRHH)
**Módulos**: Recursos Humanos, Mesa de Partes
- Gestión de personal
- Control de asistencia
- Administración de contratos
- Reportes de RRHH

#### LOGISTICS (Logística)
**Módulos**: Logística, Inventario
- Gestión de proveedores
- Órdenes de compra
- Coordinación de recepciones
- Reportes logísticos

### Seguridad de Acceso

#### Autenticación
- **JWT Tokens**: Sesiones seguras con expiración automática
- **Validación de Roles**: Verificación en cada solicitud
- **Logs de Acceso**: Registro de todos los intentos de login

#### Protección de Datos
- **Encriptación**: Contraseñas hasheadas con bcrypt
- **HTTPS**: Comunicación segura obligatoria
- **Enmascaramiento**: Datos sensibles protegidos en logs

---

## SOLUCIÓN DE PROBLEMAS

### Problemas de Acceso

#### No Puedo Iniciar Sesión

**Posibles Causas**:
1. **Credenciales Incorrectas**:
   - Verificar usuario y contraseña
   - Considerar mayúsculas/minúsculas
2. **Cuenta Desactivada**:
   - Contactar al administrador del sistema
3. **Problemas de Conexión**:
   - Verificar conexión a internet
   - Intentar desde otro navegador

**Soluciones**:
1. Usar función "¿Olvidaste tu contraseña?"
2. Verificar que el navegador tenga cookies habilitadas
3. Limpiar caché y cookies del navegador
4. Contactar al administrador: admin@universidad.edu

#### Sesión Expirada Constantemente

**Causas**:
- Inactividad prolongada (más de 30 minutos)
- Problemas de conectividad intermitente

**Soluciones**:
- Mantener actividad regular en el sistema
- Verificar estabilidad de conexión a internet
- Cerrar sesión correctamente al terminar

### Problemas de Rendimiento

#### Sistema Lento

**Optimizaciones**:
1. **Navegador**:
   - Usar Chrome, Firefox, Safari o Edge actualizados
   - Cerrar pestañas innecesarias
   - Limpiar caché regularmente
2. **Conexión**:
   - Verificar velocidad de internet
   - Evitar descargas simultáneas pesadas
3. **Sistema**:
   - Cerrar aplicaciones innecesarias
   - Verificar memoria RAM disponible

#### Errores de Carga

**Problemas Comunes**:
1. **Error 404**: Página no encontrada
   - Verificar URL correcta
   - Reportar enlace roto al administrador
2. **Error 500**: Error del servidor
   - Intentar más tarde
   - Reportar al administrador si persiste
3. **Tiempo de Espera Agotado**:
   - Verificar conexión a internet
   - Intentar recargar la página

### Problemas Específicos por Módulo

#### Módulo Académico

**No Puedo Matricularme**:
1. Verificar que el período de matrícula esté abierto
2. Confirmar prerrequisitos cumplidos
3. Revisar cupos disponibles en cursos
4. Verificar límite de créditos no excedido

**Notas No Aparecen**:
1. Confirmar que el docente haya subido las calificaciones
2. Verificar que esté matriculado en el curso
3. Esperar procesamiento (hasta 24 horas)

#### Módulo de Admisión

**No Puedo Subir Documentos**:
1. Verificar formato de archivo (PDF, JPG, PNG)
2. Confirmar tamaño menor a 5MB
3. Verificar que el período de carga esté activo
4. Intentar desde otro navegador

**No Veo Mis Resultados**:
1. Confirmar que los resultados hayan sido publicados
2. Verificar número de postulación correcto
3. Revisar correo electrónico para notificaciones

#### Mesa de Partes

**Mi Trámite No Avanza**:
1. Verificar que todos los documentos estén completos
2. Consultar el tiempo de procesamiento estimado
3. Contactar al área responsable si excede el plazo

#### Tesorería

**Mi Pago No Se Refleja**:
1. Verificar que el pago haya sido procesado por el banco
2. Confirmar número de boleta correcto  
3. Esperar hasta 48 horas para procesamiento
4. Contactar al área de caja con comprobante

### Contacto y Soporte

#### Mesa de Ayuda

**Horarios de Atención**:
- Lunes a Viernes: 8:00 AM - 6:00 PM
- Sábados: 8:00 AM - 12:00 PM

**Canales de Soporte**:
- **Email**: soporte@iesppgal.edu.pe
- **Teléfono**: +51 1 234-5678 (Ext. 100)
- **Presencial**: Oficina de Sistemas - Planta Baja

#### Información de Contacto por Área

**Área Académica**:
- Email: academico@iesppgal.edu.pe
- Ext. 101

**Área de Admisión**:
- Email: admision@iesppgal.edu.pe
- Ext. 102

**Mesa de Partes**:
- Email: mesadepartes@iesppgal.edu.pe
- Ext. 103

**Tesorería**:
- Email: tesoreria@iesppgal.edu.pe
- Ext. 104

### Capacitación y Tutoriales

#### Videos Tutoriales
Disponibles en el portal web institucional:
- Introducción al Sistema
- Matrícula Paso a Paso
- Cómo Solicitar Trámites
- Gestión Financiera Básica

#### Capacitaciones Presenciales
Programadas mensualmente para:
- Nuevos usuarios
- Personal administrativo
- Docentes
- Estudiantes de nuevo ingreso

---

## ANEXOS

### Anexo A: Códigos de Carrera
- **EDI**: Educación Inicial
- **EDP**: Educación Primaria
- **EDF**: Educación Física
- **EDM**: Educación Matemática
- **EDA**: Educación Artística

### Anexo B: Tipos de Documento
- **DNI**: Documento Nacional de Identidad (8 dígitos)
- **FOREIGN_CARD**: Carné de Extranjería
- **PASSPORT**: Pasaporte
- **CONADIS_CARD**: Carné de Discapacidad CONADIS

### Anexo C: Estados del Sistema

#### Estados de Estudiante
- **ENROLLED**: Matriculado
- **TRANSFERRED**: Transferido
- **WITHDRAWN**: Retirado
- **GRADUATED**: Egresado
- **SUSPENDED**: Suspendido

#### Estados de Postulación
- **REGISTERED**: Registrado
- **DOCUMENTS_PENDING**: Documentos Pendientes
- **DOCUMENTS_COMPLETE**: Documentos Completos
- **EVALUATED**: Evaluado
- **ADMITTED**: Admitido
- **NOT_ADMITTED**: No Admitido
- **WAITING_LIST**: Lista de Espera

#### Estados de Trámite
- **RECEIVED**: Recibido
- **IN_PROCESS**: En Proceso
- **COMPLETED**: Finalizado
- **REJECTED**: Rechazado
- **PENDING_INFO**: Pendiente de Información

---

**Manual de Usuario v1.0**  
**IESPP "Gustavo Allende Llavería"**  
**Diciembre 2024**

Para soporte técnico: soporte@iesppgal.edu.pe