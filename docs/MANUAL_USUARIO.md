# MANUAL DE USUARIO - MÓDULO TESORERÍA Y ADMINISTRACIÓN
## Sistema Integral Académico IESPP "Gustavo Allende Llavería"

### VERSIÓN: 1.0 - GUÍA COMPLETA DEL USUARIO
### FECHA: Septiembre 2024

---

## ÍNDICE
1. [Introducción](#1-introducción)
2. [Acceso al Sistema](#2-acceso-al-sistema)
3. [Dashboard Principal](#3-dashboard-principal)
4. [Caja y Bancos](#4-caja-y-bancos)
5. [Boletas Internas](#5-boletas-internas)
6. [Inventario](#6-inventario)
7. [Logística](#7-logística)
8. [Recursos Humanos](#8-recursos-humanos)
9. [Reportes](#9-reportes)
10. [Preguntas Frecuentes](#10-preguntas-frecuentes)

---

## 1. INTRODUCCIÓN

### 1.1 ¿Qué es el Módulo de Tesorería y Administración?
El Módulo de Tesorería y Administración es una herramienta integral que permite gestionar todas las operaciones financieras y administrativas del Instituto de Educación Superior Pedagógico Público "Gustavo Allende Llavería".

### 1.2 Funcionalidades Principales
- **Gestión de Caja**: Control de ingresos y egresos diarios
- **Boletas Internas**: Emisión de comprobantes no tributarios con QR
- **Control de Inventario**: Seguimiento de materiales con sistema FIFO
- **Gestión de Proveedores**: Registro y control de proveedores
- **Recursos Humanos**: Control de personal y asistencia
- **Reportes**: Generación de informes financieros y administrativos

### 1.3 Roles de Usuario
- **Administrador Financiero**: Acceso completo al módulo
- **Cajero/a**: Manejo de caja y emisión de boletas
- **Almacenero/a**: Control de inventarios
- **Logística**: Gestión de compras y proveedores
- **RRHH**: Administración de personal

---

## 2. ACCESO AL SISTEMA

### 2.1 Ingreso al Sistema
1. Abrir el navegador web (Chrome, Firefox, Edge)
2. Ingresar a la dirección: `https://sistema.iesppgal.edu.pe`
3. Introducir usuario y contraseña
4. Hacer clic en "Iniciar Sesión"

### 2.2 Navegación al Módulo
1. Una vez dentro del sistema, localizar el menú lateral
2. Hacer clic en "Tesorería y Administración" (ícono de calculadora)
3. El sistema cargará el dashboard principal del módulo

### 2.3 Permisos por Rol
El sistema mostrará únicamente las opciones disponibles según su rol asignado.

---

## 3. DASHBOARD PRINCIPAL

### 3.1 Vista General
Al ingresar al módulo, verá el dashboard principal con:

#### Cards de Resumen (varía según rol)
- **Caja del Día**: Monto actual en caja (solo Cajeros)
- **Ingresos del Mes**: Total de ingresos mensuales
- **Alertas de Stock**: Items con stock bajo (solo Almacén)
- **Personal Activo**: Empleados registrados (solo RRHH)

#### Acciones Rápidas
Botones de acceso directo a funciones principales:
- **Caja y Bancos**: Gestión de dinero en efectivo y cuentas bancarias
- **Boletas**: Emisión de comprobantes internos
- **Inventario**: Control de materiales y suministros
- **Logística**: Compras y proveedores
- **Recursos Humanos**: Personal y asistencia

#### Actividades Recientes
Lista de las últimas operaciones realizadas en el sistema.

#### Próximas Tareas
Recordatorios de tareas pendientes como arqueos de caja o conciliaciones.

---

## 4. CAJA Y BANCOS

### 4.1 Gestión de Sesiones de Caja

#### Abrir Sesión de Caja
1. En el dashboard, hacer clic en "Caja y Bancos"
2. Si no hay sesión abierta, aparecerá el botón "Abrir Caja"
3. Hacer clic en "Abrir Caja"
4. Ingresar el monto inicial (dinero físico en caja)
5. Confirmar la apertura

**💡 Importante**: Solo puede haber una sesión abierta por cajero.

#### Registrar Movimientos
Con la sesión abierta, puede registrar ingresos y egresos:

1. Hacer clic en "Nuevo Movimiento"
2. Seleccionar tipo: **Ingreso** o **Egreso**
3. Completar los campos:
   - **Monto**: Cantidad en soles
   - **Concepto**: Motivo del movimiento
   - **Descripción**: Detalle adicional
   - **Centro de Costo**: Si aplica
4. Hacer clic en "Registrar Movimiento"

#### Cerrar Sesión de Caja
1. Hacer clic en "Cerrar Caja"
2. Contar físicamente el dinero en caja
3. Ingresar el **Monto Físico Contado**
4. El sistema calculará automáticamente la diferencia
5. Agregar observaciones si hay diferencias
6. Confirmar el cierre

**⚠️ Atención**: Las diferencias deben ser justificadas.

### 4.2 Cuentas Bancarias

#### Registrar Nueva Cuenta
1. Ir a la pestaña "Cuentas Bancarias"
2. Hacer clic en "Nueva Cuenta"
3. Completar información:
   - **Nombre de Cuenta**: Ej. "Cuenta Corriente Principal"
   - **Banco**: Nombre del banco
   - **Número de Cuenta**: Número completo
   - **Tipo**: Corriente, Ahorros, CTS
   - **Moneda**: Soles o Dólares
4. Guardar la información

#### Conciliación Bancaria
1. Ir a la pestaña "Conciliación"
2. Hacer clic en "Seleccionar Archivo"
3. Subir archivo CSV o Excel del banco
4. El sistema procesará automáticamente los movimientos

**📋 Formato requerido del archivo**:
- Columnas: Date, Description, Amount, Type
- Formato de fecha: DD/MM/AAAA
- Tipo: DEBIT o CREDIT

---

## 5. BOLETAS INTERNAS

### 5.1 Crear Nueva Boleta

#### Paso a Paso
1. En el módulo principal, hacer clic en "Boletas"
2. Hacer clic en "Nueva Boleta"
3. Completar el formulario:

**Información del Servicio**:
- **Concepto**: Matrícula, Pensión, Certificado, Trámite, etc.
- **Descripción**: Detalle del servicio
- **Monto**: Cantidad a cobrar

**Información del Cliente**:
- **Nombre**: Nombre completo del cliente
- **Documento**: DNI o RUC (8 u 11 dígitos)
- **Email**: Correo electrónico (opcional)

**Información Adicional**:
- **Fecha de Vencimiento**: Si el pago tiene plazo

4. Hacer clic en "Crear Boleta"

El sistema generará automáticamente:
- **Número de boleta** correlativo
- **Código QR** para verificación
- **PDF** descargable

### 5.2 Procesar Pagos

#### Registrar Pago de Boleta
1. Localizar la boleta en estado "Pendiente"
2. Hacer clic en el ícono de tarjeta (💳)
3. Seleccionar método de pago:
   - Efectivo
   - Depósito Bancario
   - Transferencia Bancaria
   - Cheque
   - Tarjeta de Débito/Crédito
4. Ingresar referencia del pago (opcional)
5. Confirmar el pago

**✅ Idempotencia**: El sistema evita pagos duplicados automáticamente.

### 5.3 Verificación de Boletas

#### Verificación Pública (Sin Login)
1. Escanear el código QR de la boleta
2. O ingresar a: `sistema.iesppgal.edu.pe/verificar/[ID_BOLETA]`
3. El sistema mostrará:
   - Número de boleta
   - Fecha de emisión
   - Concepto y descripción
   - Monto
   - Estado (válida/anulada)
   - Cliente (datos no sensibles)

### 5.4 Anular Boletas (Solo Administradores)
1. Localizar la boleta a anular
2. Hacer clic en el ícono X (❌)
3. Ingresar motivo de anulación
4. Confirmar la anulación

**⚠️ Nota**: Si la boleta estaba pagada, se generará automáticamente un egreso de caja por reembolso.

### 5.5 Descargar PDFs
1. Hacer clic en el ícono de descarga (📥) en cualquier boleta
2. El sistema generará y descargará el PDF automáticamente
3. El PDF incluye código QR para verificación

---

## 6. INVENTARIO

### 6.1 Gestión de Items

#### Registrar Nuevo Item
1. Ir a "Inventario" → pestaña "Items"
2. Hacer clic en "Nuevo Item"
3. Completar información:
   - **Código**: Código único del item
   - **Nombre**: Nombre descriptivo
   - **Descripción**: Detalle del producto
   - **Categoría**: Clasificación (Oficina, Educativo, Tecnología, etc.)
   - **Unidad de Medida**: Unidad, Docena, Kilogramo, etc.
   - **Stock Mínimo/Máximo**: Para alertas automáticas
   - **Costo Unitario**: Precio de referencia
4. Guardar el item

### 6.2 Movimientos de Inventario (Sistema FIFO)

#### Registrar Entrada (Compra)
1. Ir a pestaña "Movimientos"
2. Hacer clic en "Nuevo Movimiento"
3. Configurar:
   - **Item**: Seleccionar del catálogo
   - **Tipo**: "Entrada"
   - **Cantidad**: Unidades recibidas
   - **Costo Unitario**: Precio de compra
   - **Motivo**: "Compra", "Donación", etc.
   - **Número de Lote**: Si aplica
   - **Fecha de Vencimiento**: Para productos perecederos

#### Registrar Salida (Consumo)
1. Seguir los mismos pasos pero seleccionar "Salida"
2. **No ingresar costo unitario** (se calcula automáticamente con FIFO)
3. El sistema:
   - Verificará stock disponible
   - Calculará costo usando el método FIFO
   - Actualizará el stock automáticamente

#### Transferencias entre Almacenes
1. Seleccionar tipo "Transferencia"
2. Especificar almacén origen y destino
3. El sistema manejará los movimientos en ambos almacenes

### 6.3 Consultar Kardex
1. En la lista de items, hacer clic en el ícono de ojo (👁️)
2. El sistema mostrará:
   - Historial completo de movimientos
   - Stock acumulado por fecha
   - Valor total del inventario
   - Costo promedio unitario
3. Opción de exportar a Excel

### 6.4 Alertas de Stock
El sistema genera alertas automáticas cuando:
- **Stock bajo**: Cantidad menor al mínimo establecido
- **Stock agotado**: Cantidad igual a cero
- **Productos vencidos**: Items con fecha de vencimiento pasada

Las alertas aparecen en:
- Dashboard principal
- Sección "Alertas" del módulo inventario
- Notificaciones del sistema

---

## 7. LOGÍSTICA

### 7.1 Gestión de Proveedores

#### Registrar Nuevo Proveedor
1. Ir a "Logística" → pestaña "Proveedores"
2. Hacer clic en "Nuevo Proveedor"
3. Completar datos obligatorios:
   - **RUC**: 11 dígitos (validación automática)
   - **Razón Social**: Nombre legal de la empresa
   - **Nombre Comercial**: Si difiere de la razón social
4. Información de contacto:
   - **Persona de Contacto**
   - **Email y Teléfono**
   - **Dirección**
5. Datos bancarios (opcional):
   - **Banco y Número de Cuenta**

**✅ Validación RUC**: El sistema valida automáticamente que el RUC sea correcto según SUNAT.

### 7.2 Gestión de Requerimientos

#### Crear Requerimiento de Compra
1. Ir a pestaña "Requerimientos"
2. Hacer clic en "Nuevo Requerimiento"
3. Información general:
   - **Título**: Nombre del requerimiento
   - **Descripción**: Detalle de la necesidad
   - **Justificación**: Motivo de la compra
   - **Fecha Requerida**: Cuándo se necesita

#### Agregar Items al Requerimiento
1. En la sección "Items":
   - **Descripción**: Qué se necesita comprar
   - **Cantidad**: Cuántas unidades
   - **Unidad de Medida**: Unidad, Caja, Kilogramo, etc.
   - **Precio Estimado**: Precio aproximado por unidad
   - **Especificaciones Técnicas**: Detalles técnicos si aplica
2. Hacer clic en "Agregar Item"
3. Repetir para todos los items necesarios
4. El sistema calculará automáticamente el **Total Estimado**

#### Enviar Requerimiento
1. Revisar todos los items agregados
2. Hacer clic en "Crear Requerimiento"
3. El sistema asignará un número correlativo
4. El requerimiento queda en estado "Borrador"

### 7.3 Flujo de Aprobación
Los requerimientos siguen este flujo:
1. **Borrador**: Recién creado
2. **Enviado**: Sometido a aprobación
3. **Aprobado**: Listo para convertir en orden de compra
4. **Rechazado**: No aprobado
5. **Convertido a OC**: Ya tiene orden de compra asociada

---

## 8. RECURSOS HUMANOS

### 8.1 Gestión de Personal

#### Registrar Nuevo Empleado
1. Ir a "RRHH" → pestaña "Empleados"
2. Hacer clic en "Nuevo Empleado"
3. **Datos Personales**:
   - **Nombres y Apellidos**
   - **DNI**: 8 dígitos (validación automática)
   - **Fecha de Nacimiento**
   - **Email y Teléfono**
   - **Dirección**

4. **Información Laboral**:
   - **Cargo**: Posición en la institución
   - **Departamento**: Educación Inicial, Primaria, Administración, etc.
   - **Fecha de Ingreso**
   - **Tipo de Contrato**: Nombrado, Contratado, CAS, Locación
   - **Salario**: Remuneración mensual

5. **Contacto de Emergencia**:
   - **Nombre y Teléfono** de familiar o contacto

6. Guardar la información

### 8.2 Control de Asistencia

#### Registrar Asistencia Manual
1. Ir a pestaña "Asistencia"
2. Hacer clic en "Registrar Asistencia"
3. Seleccionar:
   - **Empleado**: De la lista de personal activo
   - **Fecha**: Día de la asistencia
   - **Hora de Entrada**: Formato 24 horas
   - **Hora de Salida**: Si ya salió
   - **Minutos de Descanso**: Por defecto 60 minutos
   - **Horas Extra**: Si trabajó tiempo adicional

4. Agregar **Observaciones** si es necesario
5. Confirmar el registro

#### Cálculos Automáticos
El sistema calcula automáticamente:
- **Horas Trabajadas**: Tiempo total menos descanso
- **Tardanzas**: Si ingresó después de las 8:00 AM
- **Ausencias**: Si no registró entrada

### 8.3 Consultar Información de Personal
1. En la lista de empleados, hacer clic en el ícono de ojo (👁️)
2. Ver información completa:
   - Datos personales y laborales
   - Historial de contratos
   - Registro de asistencia
   - Contactos de emergencia

---

## 9. REPORTES

### 9.1 Tipos de Reportes Disponibles

#### Reportes de Caja
- **Flujo de Caja Diario**: Ingresos y egresos del día
- **Arqueo de Caja**: Resumen de cierre de sesión
- **Flujo por Período**: Movimientos entre fechas específicas

#### Reportes de Boletas
- **Boletas Emitidas**: Por período y estado
- **Ingresos por Concepto**: Matrícula, pensiones, certificados
- **Boletas Pendientes**: Sin pagar

#### Reportes de Inventario
- **Valorización**: Valor total del inventario
- **Movimientos**: Entradas y salidas por período
- **Stock Actual**: Items disponibles con alertas
- **Kardex por Item**: Historial detallado FIFO

#### Reportes de RRHH
- **Asistencia Mensual**: Por empleado o general
- **Personal Activo**: Lista de empleados
- **Planilla**: Para cálculo de sueldos

### 9.2 Generar Reportes

#### Proceso General
1. Ir a la pestaña "Reportes" del módulo correspondiente
2. Seleccionar el tipo de reporte deseado
3. Configurar filtros (si aplica):
   - **Fechas**: Desde y hasta
   - **Conceptos**: Tipo de operación
   - **Estados**: Pendiente, pagado, etc.
   - **Centros de Costo**: Si aplica
4. Elegir formato:
   - **PDF**: Para impresión y archivo
   - **CSV**: Para análisis en Excel
5. Hacer clic en "Generar Reporte" o "Descargar"

### 9.3 Filtros Avanzados
Todos los reportes permiten filtrar por:
- **Rango de Fechas**: Período específico
- **Usuario**: Quién realizó la operación
- **Estado**: Activo, inactivo, pendiente, etc.
- **Categoría**: Tipo de item o concepto
- **Centro de Costo**: Departamento o área

---

## 10. PREGUNTAS FRECUENTES

### 10.1 Caja y Bancos

**P: ¿Qué hago si hay diferencia en el arqueo de caja?**
R: Verificar físicamente el dinero, revisar todos los movimientos del día, y documentar la diferencia con observaciones detalladas. Diferencias mayores a S/10 deben ser reportadas al supervisor.

**P: ¿Puedo abrir una nueva sesión si olvidé cerrar la anterior?**
R: No. Solo puede haber una sesión abierta por cajero. Contacte al administrador para que cierre la sesión anterior.

**P: ¿Cómo subo el extracto bancario?**
R: En "Conciliación", suba archivo CSV o Excel con columnas: Date, Description, Amount, Type. El formato de fecha debe ser DD/MM/AAAA.

### 10.2 Boletas Internas

**P: ¿Puedo modificar una boleta ya emitida?**
R: No. Las boletas son inmutables por seguridad. Si hay error, debe anularse (solo administradores) y crear una nueva.

**P: ¿Cómo funciona el código QR?**
R: El QR contiene un enlace de verificación pública. Cualquier persona puede escanearlo para verificar la autenticidad de la boleta sin acceder al sistema.

**P: ¿Qué pasa si pago una boleta dos veces?**
R: El sistema tiene protección de idempotencia. Si usa la misma referencia, no se procesará el pago duplicado.

### 10.3 Inventario

**P: ¿Cómo funciona el sistema FIFO?**
R: FIFO (First In, First Out) significa que las salidas usan el costo de los items más antiguos primero. El sistema calcula automáticamente el costo correcto para cada salida.

**P: ¿Puedo corregir un movimiento de inventario?**
R: No se pueden modificar movimientos. Para corregir, haga un movimiento de "Ajuste" con la cantidad correcta.

**P: ¿Cuándo aparecen las alertas de stock?**
R: Cuando el stock actual es menor o igual al stock mínimo configurado para cada item.

### 10.4 Logística

**P: ¿Por qué me rechaza el RUC del proveedor?**
R: El sistema valida el RUC según el algoritmo oficial de SUNAT. Verifique que tenga 11 dígitos y que el dígito verificador sea correcto.

**P: ¿Puedo modificar un requerimiento ya enviado?**
R: Los requerimientos enviados no se pueden modificar. Si necesita cambios, debe crear uno nuevo.

### 10.5 Recursos Humanos

**P: ¿Cómo registro ausencias?**
R: No registre entrada ni salida para ese empleado en esa fecha. El sistema lo marcará automáticamente como ausente.

**P: ¿El sistema calcula horas extra automáticamente?**
R: Debe registrar manualmente las horas extra en el campo correspondiente. El sistema las sumará al total de horas trabajadas.

### 10.6 General

**P: ¿Por qué no veo todas las opciones del menú?**
R: El sistema muestra solo las funciones disponibles para su rol. Contacte al administrador si necesita permisos adicionales.

**P: ¿Cómo recupero mi contraseña?**
R: Contacte al administrador del sistema. No hay opción de recuperación automática por seguridad.

**P: ¿El sistema guarda un historial de cambios?**
R: Sí. Todas las operaciones quedan registradas en el sistema de auditoría con fecha, hora, usuario e IP.

---

## CONTACTO Y SOPORTE

**Mesa de Ayuda**: soporte@iesppgal.edu.pe  
**Teléfono**: (01) 123-4567  
**Horario de Atención**: Lunes a Viernes, 8:00 AM - 5:00 PM

**Para Emergencias Fuera de Horario**:  
Contactar al Administrador del Sistema: admin@iesppgal.edu.pe

---

**MANUAL DE USUARIO OFICIAL**  
**Módulo Tesorería y Administración**  
**Sistema Integral Académico IESPP "Gustavo Allende Llavería"**  
**Versión 1.0 - Septiembre 2024**