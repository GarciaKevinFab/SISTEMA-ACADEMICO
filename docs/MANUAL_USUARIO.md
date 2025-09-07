# Manual de Usuario - Sistema Académico Integral IESPP "Gustavo Allende Llavería"

## Tabla de Contenidos

1. [Introducción](#introducción)
2. [Acceso al Sistema](#acceso-al-sistema)
3. [Roles de Usuario](#roles-de-usuario)
4. [Módulos del Sistema](#módulos-del-sistema)
5. [Guías por Rol](#guías-por-rol)
6. [Procedimientos Comunes](#procedimientos-comunes)
7. [Resolución de Problemas](#resolución-de-problemas)
8. [Soporte Técnico](#soporte-técnico)

## Introducción

El Sistema Académico Integral es una plataforma web diseñada para gestionar todos los procesos académicos y administrativos del IESPP "Gustavo Allende Llavería". El sistema integra módulos de admisión, académico, tesorería, trámites digitales, portal web e integración con MINEDU.

### Características Principales
- ✅ **Gestión completa de estudiantes** - Desde postulación hasta egreso
- ✅ **Sistema académico robusto** - Matrículas, calificaciones, asistencia
- ✅ **Tesorería integrada** - Pagos, boletas, inventario, logística
- ✅ **Trámites digitales** - Mesa de partes con seguimiento QR
- ✅ **Integración MINEDU** - Envío automático a SIA/SIAGIE
- ✅ **Reportes avanzados** - Analytics y exportación PDF/Excel

## Acceso al Sistema

### URL del Sistema
```
https://universidad.emergent.do
```

### Requisitos del Navegador
- Google Chrome (recomendado)
- Firefox
- Microsoft Edge
- Safari (macOS/iOS)

### Credenciales por Defecto
El administrador del sistema proporcionará las credenciales de acceso según tu rol.

### Proceso de Login
1. Ingresa a la URL del sistema
2. Introduce tu **email** y **contraseña**
3. Haz clic en **"Iniciar Sesión"**
4. Serás redirigido al dashboard principal

## Roles de Usuario

### 1. **ADMIN** - Administrador del Sistema
- **Permisos**: Acceso completo a todos los módulos
- **Responsabilidades**: Configuración, usuarios, respaldos, auditoría

### 2. **STUDENT** - Estudiante
- **Permisos**: Ver sus datos académicos, realizar trámites
- **Limitaciones**: Solo acceso a información propia

### 3. **TEACHER** - Docente
- **Permisos**: Gestión de calificaciones y asistencia de sus cursos
- **Limitaciones**: Solo cursos asignados

### 4. **ADMIN_ACADEMIC** - Administrador Académico
- **Permisos**: Gestión completa del módulo académico
- **Responsabilidades**: Matrículas, secciones, horarios, actas

### 5. **REGISTRAR** - Registrador
- **Permisos**: Gestión de calificaciones, actas, certificados
- **Responsabilidades**: Procesos de registro oficial

### 6. **FINANCE_ADMIN** - Administrador de Finanzas
- **Permisos**: Gestión completa del módulo de tesorería
- **Responsabilidades**: Cuentas, presupuestos, reportes financieros

### 7. **CASHIER** - Cajero
- **Permisos**: Manejo de caja, emisión de boletas
- **Limitaciones**: Solo operaciones de caja

### 8. **APPLICANT** - Postulante
- **Permisos**: Proceso de admisión, seguimiento de postulación
- **Limitaciones**: Solo proceso admisión

## Módulos del Sistema

### 🎓 **Módulo Académico**
Gestión completa del proceso académico:
- **Estudiantes**: CRUD, historiales, estadísticas
- **Cursos**: Catalogación, prerequisitos, créditos
- **Matrículas**: Proceso con validaciones y reglas
- **Calificaciones**: Sistema 0-20 con conversión AD/A/B/C
- **Asistencia**: Registro por sesión con porcentajes
- **Reportes**: Historiales, actas, certificados

### 💰 **Módulo de Tesorería**
Sistema financiero integral:
- **Caja y Bancos**: Sesiones de caja, conciliación
- **Boletas**: Emisión con QR, verificación pública
- **Inventario**: FIFO, kardex, alertas de stock
- **Logística**: Proveedores, órdenes de compra
- **RRHH**: Personal, asistencia, nómina

### 📋 **Mesa de Partes Digital**
Trámites digitales con seguimiento:
- **Procedimientos**: Constancias, certificados, traslados
- **Seguimiento**: Código de tracking con QR
- **Estados**: Pendiente, En proceso, Listo, Entregado
- **Notificaciones**: Alertas por email/SMS

### 🌐 **Portal Web Institucional**
Presencia web oficial:
- **Landing page**: Información institucional
- **Noticias**: Comunicados y eventos
- **SSO**: Inicio de sesión único
- **Recursos**: Documentos públicos

### 🔗 **Integración MINEDU**
Conectividad con sistemas oficiales:
- **SIA**: Sistema de Información Académica
- **SIAGIE**: Sistema de apoyo a la gestión
- **Envío automático**: Matrículas, calificaciones, certificados
- **Conciliación**: Verificación de discrepancias

## Guías por Rol

### 👨‍🎓 **Guía para Estudiantes**

#### Dashboard del Estudiante
Al iniciar sesión verás:
- **Mis Datos**: Información personal y académica
- **Mis Cursos**: Cursos matriculados en período actual
- **Calificaciones**: Notas por curso y período
- **Asistencia**: Porcentaje de asistencia por curso
- **Trámites**: Solicitudes pendientes y completadas

#### Consultar Calificaciones
1. Ve a **"Académico"** → **"Calificaciones"**
2. Selecciona el **período académico**
3. Visualiza notas numéricas (0-20) y literales (AD/A/B/C)
4. Descarga **certificado de notas** si es necesario

#### Solicitar Trámites
1. Ve a **"Mesa de Partes"** → **"Nuevo Trámite"**
2. Selecciona el **tipo de procedimiento**:
   - Constancia de estudios
   - Certificado de notas
   - Constancia de egresado
3. Completa los **datos requeridos**
4. Adjunta **documentos** si es necesario
5. **Paga** la tasa correspondiente
6. Recibirás un **código de seguimiento**

#### Seguimiento de Trámites
1. Ve a **"Mesa de Partes"** → **"Seguimiento"**
2. Ingresa tu **código de tracking**
3. Verifica el **estado actual**:
   - 🟡 **Pendiente**: En cola de procesamiento
   - 🔵 **En proceso**: Siendo revisado
   - 🟢 **Listo**: Disponible para entrega
   - ✅ **Entregado**: Proceso completado

### 👨‍🏫 **Guía para Docentes**

#### Dashboard del Docente
Información disponible:
- **Mis Cursos**: Cursos asignados en período actual
- **Estudiantes**: Lista de matriculados por curso
- **Calificaciones Pendientes**: Actas por cerrar
- **Horarios**: Cronograma de clases

#### Registrar Calificaciones
1. Ve a **"Académico"** → **"Calificaciones"**
2. Selecciona tu **curso** y **sección**
3. Para cada estudiante:
   - Ingresa **nota numérica** (0-20)
   - El sistema calcula automáticamente la **nota literal**
   - Verifica el **estado** (APROBADO/DESAPROBADO)
4. **Guarda** los cambios
5. **Cierra el acta** cuando esté completa

#### Registrar Asistencia
1. Ve a **"Académico"** → **"Asistencia"**
2. Selecciona **curso**, **sección** y **fecha**
3. Para cada estudiante marca:
   - ✅ **Presente**
   - ❌ **Ausente**
   - 🕐 **Tardanza**
   - 📋 **Justificado**
4. **Guarda** la asistencia
5. El sistema calcula automáticamente los **porcentajes**

#### Importar Asistencia (CSV)
1. Descarga la **plantilla Excel**
2. Completa los datos:
   ```
   DNI,Apellidos,Nombres,Status
   12345678,García López,Juan Carlos,PRESENT
   87654321,Mendoza Silva,María Elena,ABSENT
   ```
3. **Sube el archivo** CSV
4. **Revisa** la previsualización
5. **Confirma** la importación

### 👨‍💼 **Guía para Administrador Académico**

#### Gestión de Matrículas

##### Proceso de Matrícula Individual
1. Ve a **"Académico"** → **"Matrículas"**
2. Clic en **"Nueva Matrícula"**
3. Selecciona el **estudiante**
4. Elige **cursos disponibles**
5. El sistema valida automáticamente:
   - ✅ **Prerequisitos** cumplidos
   - ✅ **Conflictos de horario**
   - ✅ **Límite de créditos** (12-24)
   - ✅ **Capacidad de sección**
   - ✅ **Estado de pagos**
6. **Confirma** la matrícula

##### Matrícula Masiva
1. Ve a **"Académico"** → **"Matrícula Masiva"**
2. Descarga **plantilla Excel**
3. Completa datos:
   ```
   StudentID,CourseID,SectionID,Period
   STU001,MAT101,SEC001,2024-02
   STU002,FIS201,SEC002,2024-02
   ```
4. **Sube el archivo**
5. **Revisa errores** de validación
6. **Procesa** matrículas válidas

#### Gestión de Secciones y Horarios
1. Ve a **"Académico"** → **"Secciones"**
2. **Crear nueva sección**:
   - Curso asociado
   - Docente asignado
   - Capacidad máxima
   - Horario de clases
3. **Verificar conflictos**:
   - Horarios de docente
   - Disponibilidad de aula
   - Solapamientos
4. **Generar horarios** en PDF

#### Cierre de Período Académico
1. **Verificar** que todas las actas estén cerradas
2. **Ejecutar** verificación de consistencia
3. **Resolver** anomalías encontradas
4. **Generar** reportes finales del período
5. **Enviar datos** a MINEDU
6. **Marcar período** como cerrado

### 👨‍💻 **Guía para Registrador**

#### Gestión de Actas
1. Ve a **"Académico"** → **"Actas"**
2. **Revisar actas pendientes**:
   - Verificar completitud de notas
   - Validar cálculos
   - Confirmar asistencias mínimas
3. **Cerrar actas**:
   - Solo REGISTRAR puede cerrar definitivamente
   - Acta cerrada se vuelve **inmutable**
   - Se genera **PDF oficial** con QR
4. **Reabrir actas** (excepcional):
   - Requiere justificación
   - Genera log de auditoría
   - Notifica a involucrados

#### Generación de Certificados
1. Ve a **"Mesa de Partes"** → **"Certificados"**
2. **Procesar solicitudes**:
   - Verificar requisitos del estudiante
   - Validar pagos realizados
   - Generar certificado con QR
3. **Tipos de certificados**:
   - Constancia de estudios
   - Certificado de notas
   - Constancia de egresado
   - Certificado de título

#### Verificación Pública
Los certificados incluyen **código QR** para verificación:
```
https://universidad.edu/verificar/CERT-2024-001234
```

La página pública muestra **solo datos seguros**:
- Número de certificado
- Fecha de emisión
- Tipo de documento
- Estado de validez
- **NO muestra** datos personales (DNI, teléfono, dirección)

### 💰 **Guía para Personal de Finanzas**

#### Manejo de Caja (Cajero)

##### Apertura de Sesión
1. Ve a **"Finanzas"** → **"Caja"**
2. **Abrir sesión** de caja:
   - Monto inicial de fondo fijo
   - Denominaciones de billetes/monedas
   - Verificar arqueo inicial
3. **Estado**: Sesión ABIERTA

##### Registro de Movimientos
Para cada transacción:
1. **Ingresos**:
   - Pagos de pensiones
   - Tasas administrativas
   - Otros ingresos
2. **Egresos**:
   - Gastos menores
   - Reembolsos
   - Otros egresos
3. **Emitir boleta** con QR automáticamente

##### Cierre de Sesión
1. **Arqueo de caja**:
   - Contar efectivo físico
   - Comparar con sistema
   - Reportar diferencias
2. **Cerrar sesión**:
   - Monto final calculado
   - Diferencias justificadas
   - Generar reporte de caja

#### Emisión de Boletas (con QR)
1. **Crear nueva boleta**:
   - Cliente/estudiante
   - Concepto de pago
   - Monto e IGV
2. **Generar QR** automáticamente
3. **Imprimir** boleta
4. **URL verificación**:
   ```
   https://universidad.edu/verificar/boleta/B001-00001234
   ```

#### Gestión de Inventario

##### Ingreso de Mercancía (FIFO)
1. Ve a **"Finanzas"** → **"Inventario"**
2. **Registrar entrada**:
   - Artículo y cantidad
   - Precio unitario
   - Proveedor
   - Fecha de vencimiento
3. El sistema aplica **método FIFO** automáticamente

##### Salida de Mercancía
1. **Registrar salida**:
   - Artículo y cantidad
   - Motivo (venta, consumo, merma)
   - Centro de costo
2. **Cálculo automático**:
   - Costo FIFO (primero en entrar, primero en salir)
   - Actualización de stock
   - Generación de kardex

##### Alertas de Stock
El sistema genera **alertas automáticas**:
- 🔴 **Stock mínimo** alcanzado
- 🟡 **Próximo a vencer** (30 días)
- 📋 **Reporte** de artículos críticos

## Procedimientos Comunes

### 🔍 Verificación de Documentos QR

Todos los documentos oficiales incluyen **código QR** para verificación pública:

#### Documentos con QR:
- ✅ Boletas de pago
- ✅ Certificados académicos
- ✅ Constancias oficiales
- ✅ Actas de notas

#### Verificar documento:
1. **Escanea el código QR** con cualquier aplicación
2. **Abre el enlace** generado
3. **Verifica información**:
   - Validez del documento
   - Fecha de emisión
   - Estado actual
   - **Datos seguros** (sin información personal sensible)

### 📊 Generación de Reportes

#### Tipos de Reportes Disponibles:

##### Reportes Académicos:
- **Historial del estudiante** (PDF/Excel)
- **Resultados por curso** (distribución de notas)
- **Reporte de asistencia** por período
- **Verificación de consistencia** (anomalías)

##### Reportes Financieros:
- **Flujo de caja** diario/mensual
- **Inventario valorizado** (método FIFO)
- **Conciliación bancaria**
- **Estados financieros**

#### Generar Reporte:
1. Ve al **módulo correspondiente**
2. Selecciona **"Reportes"**
3. Elige **tipo de reporte**
4. Configura **filtros**:
   - Período
   - Estudiante/curso específico
   - Formato (PDF/Excel)
5. **Generar** y **descargar**

### 🔄 Integración MINEDU

#### Envío Automático
El sistema envía automáticamente a MINEDU:
- ✅ **Matrículas** (al confirmar)
- ✅ **Calificaciones** (al cerrar acta)
- ✅ **Certificados** (al emitir)

#### Monitoreo de Integración
1. Ve a **"MINEDU"** → **"Monitor"**
2. **Estados posibles**:
   - 🟡 **PENDIENTE**: En cola de envío
   - 🔵 **ENVIANDO**: En proceso
   - ✅ **ENVIADO**: Recibido por MINEDU
   - 🟢 **CONFIRMADO**: Procesado exitosamente
   - 🔄 **REINTENTO**: Error temporal, reintentando
   - ❌ **FALLIDO**: Error permanente

#### Conciliación Periódica
**Proceso automático mensual**:
1. **Comparar** datos locales vs. MINEDU
2. **Identificar discrepancias**
3. **Generar reporte** CSV con diferencias
4. **Reprocesar** eventos faltantes
5. **Objetivo**: 0 discrepancias

## Resolución de Problemas

### ❌ **Problemas de Login**

#### No puedo iniciar sesión
**Posibles causas**:
- Credenciales incorrectas
- Usuario desactivado
- Problemas de conectividad

**Soluciones**:
1. Verificar **email** y **contraseña**
2. Usar **"Recuperar contraseña"** si es necesario
3. Contactar **administrador** si persiste
4. Verificar **conexión a internet**

#### La página no carga
**Soluciones**:
1. **Refrescar** la página (Ctrl+F5)
2. **Limpiar caché** del navegador
3. **Probar** en navegador diferente
4. **Verificar** URL correcta

### 📝 **Problemas Académicos**

#### No puedo matricular un estudiante
**Validaciones del sistema**:
- ❌ **Prerequisitos** no cumplidos
- ❌ **Conflicto de horarios**
- ❌ **Excede límite** de créditos (24)
- ❌ **Sección llena**
- ❌ **Deudas pendientes**

**Solución**: Resolver cada validación mostrada

#### Error al registrar calificaciones
**Verificar**:
- ✅ Nota en rango **0-20**
- ✅ Acta **no cerrada**
- ✅ **Permisos** de docente para el curso
- ✅ **Estudiante matriculado**

#### MINEDU no recibe datos
1. **Verificar estado** en monitor MINEDU
2. **Reenviar manualmente** si es necesario
3. **Contactar soporte** si hay errores persistentes
4. **Verificar conectividad** con MINEDU API

### 💰 **Problemas Financieros**

#### Error en cálculo FIFO
**Verificar**:
- ✅ **Ingresos registrados** correctamente
- ✅ **Fechas de entrada** válidas
- ✅ **Precios unitarios** correctos
- ✅ **Stock disponible** para salida

#### Boleta sin código QR
**Posibles causas**:
- Error en generación PDF
- Problema de conectividad
- Configuración QR incorrecta

**Solución**:
1. **Regenerar** la boleta
2. **Verificar** configuración QR
3. **Contactar soporte** técnico

### 📱 **Problemas con QR**

#### QR no se puede escanear
**Verificar**:
- ✅ **Calidad** de impresión
- ✅ **Iluminación** adecuada
- ✅ **Aplicación QR** funcionando
- ✅ **Conectividad** a internet

#### Página de verificación no carga
**Posibles causas**:
- Documento **no válido**
- Problema de **conectividad**
- **URL malformada**

**Solución**:
1. **Verificar** URL completa
2. **Probar** desde navegador web
3. **Contactar** emisor del documento

## Soporte Técnico

### 📞 **Canales de Soporte**

#### Soporte Nivel 1 - Usuario Final
- **Email**: soporte@universidad.edu
- **Teléfono**: +51-XXX-XXXXXX
- **Horario**: Lunes a Viernes 8:00-18:00
- **Tiempo respuesta**: 2 horas

#### Soporte Nivel 2 - Técnico
- **Email**: tecnico@universidad.edu
- **Disponibilidad**: 24/7 para problemas críticos
- **Tiempo respuesta**: 30 minutos

#### Soporte Nivel 3 - Desarrollo
- **Para**: Errores del sistema, nuevas funcionalidades
- **Canal**: A través de Nivel 2
- **SLA**: 4 horas para críticos

### 🆘 **Escalamiento de Problemas**

#### Severidad CRÍTICA (P1)
- **Definición**: Sistema no disponible
- **Respuesta**: Inmediata (< 15 min)
- **Escalamiento**: Automático a Nivel 3

#### Severidad ALTA (P2)
- **Definición**: Funcionalidad crítica no disponible
- **Respuesta**: 1 hora
- **Escalamiento**: Manual si no se resuelve en 2h

#### Severidad MEDIA (P3)
- **Definición**: Problemas menores de funcionalidad
- **Respuesta**: 4 horas
- **Escalamiento**: Siguiendo día hábil

#### Severidad BAJA (P4)
- **Definición**: Consultas, mejoras, capacitación
- **Respuesta**: 24 horas
- **Escalamiento**: No aplica

### 📚 **Recursos Adicionales**

#### Documentación Técnica
- **Manual Técnico**: `/docs/MANUAL_TECNICO.md`
- **Guía de Procesos**: `/docs/GUIA_PROCESOS.md`
- **API Documentation**: `/docs/api`

#### Videos Tutoriales
- **YouTube**: Canal Institucional Universidad
- **Playlist**: "Sistema Académico - Tutoriales"
- **Duración**: 5-10 minutos por video

#### Base de Conocimiento
- **FAQ**: Preguntas frecuentes
- **Troubleshooting**: Problemas comunes
- **Updates**: Notas de versión

### 📝 **Reportar Problemas**

Al contactar soporte, incluir:
1. **Usuario** y **rol**
2. **Navegador** y versión
3. **Pasos** para reproducir el problema
4. **Mensaje de error** (captura de pantalla)
5. **Urgencia** del problema

### 🔄 **Actualizaciones del Sistema**

#### Notificaciones
- **Email**: Avisos de mantenimiento
- **Banner**: Notificaciones en el sistema
- **Tiempo**: 48h de anticipación mínimo

#### Mantenimiento Programado
- **Horario**: Domingos 2:00-6:00 AM
- **Duración**: Máximo 4 horas
- **Backup**: Automático antes de actualizar

---

**© 2024 IESPP "Gustavo Allende Llavería". Todos los derechos reservados.**

**Versión del Manual**: 1.0  
**Última actualización**: Septiembre 2024  
**Sistema versión**: 2.0.0