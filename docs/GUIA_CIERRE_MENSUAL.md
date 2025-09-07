# GUÍA DE CIERRE MENSUAL - TESORERÍA
## Instituto de Educación Superior Pedagógico Público "Gustavo Allende Llavería"

### VERSIÓN: 1.0 - PROCEDIMIENTOS OFICIALES
### FECHA: Septiembre 2024

---

## ÍNDICE
1. [Cronograma de Cierre](#1-cronograma-de-cierre)
2. [Caja y Efectivo](#2-caja-y-efectivo)
3. [Conciliación Bancaria](#3-conciliación-bancaria)
4. [Boletas e Ingresos](#4-boletas-e-ingresos)
5. [Inventario](#5-inventario)
6. [Cuentas por Pagar](#6-cuentas-por-pagar)
7. [Recursos Humanos](#7-recursos-humanos)
8. [Reportes Obligatorios](#8-reportes-obligatorios)
9. [Archivo de Documentos](#9-archivo-de-documentos)
10. [Checklist Final](#10-checklist-final)

---

## 1. CRONOGRAMA DE CIERRE

### 1.1 Calendario Mensual

| Día | Actividad | Responsable | Sistema |
|-----|-----------|-------------|---------|
| **Día 28-30** | Inicio de pre-cierre | Tesorero | Manual |
| **Día 1** | Corte de operaciones del mes anterior | Cajeros | Sistema |
| **Día 2** | Conciliación bancaria | Administrador Financiero | Sistema |
| **Día 3** | Verificación de boletas | Cajeros | Sistema |
| **Día 4** | Conteo físico de inventario | Almacenero | Sistema + Físico |
| **Día 5** | Revisión de RRHH y planilla | RRHH | Sistema |
| **Días 6-7** | Generación de reportes | Tesorero | Sistema |
| **Día 8** | Revisión y aprobación | Director | Manual |
| **Día 10** | Presentación a Dirección | Administrador | Manual |

### 1.2 Fechas Críticas
- **Último día del mes**: Corte operacional a las 6:00 PM
- **1er día hábil**: Inicio del proceso de cierre
- **10mo día hábil**: Cierre definitivo y reportes finales

---

## 2. CAJA Y EFECTIVO

### 2.1 Arqueo Final de Caja

#### Procedimiento Diario (Último día del mes)
1. **Cerrar todas las sesiones de caja activas**:
   ```
   Sistema → Caja y Bancos → Cerrar Sesión
   ```
   - Contar físicamente el efectivo
   - Registrar el monto exacto
   - Documentar cualquier diferencia

2. **Verificar movimientos del día**:
   - Revisar todos los ingresos registrados
   - Confirmar todos los egresos
   - Validar comprobantes físicos

3. **Consolidación mensual**:
   ```
   Sistema → Reportes → Flujo de Caja Mensual
   ```

#### Documentos Requeridos
- ✅ Arqueos diarios de todas las sesiones
- ✅ Comprobantes de ingresos
- ✅ Vouchers de egresos
- ✅ Conciliación de diferencias (si las hay)

### 2.2 Control de Fondos Fijos
1. **Verificar saldo de caja chica**: S/ 500.00
2. **Revisar gastos menores**: Máximo S/ 50.00 por comprobante
3. **Reposición si es necesaria**

### 2.3 Reportes de Caja
Generar desde el sistema:
- **Libro de Caja mensual**
- **Resumen de ingresos por concepto**
- **Resumen de egresos por centro de costo**
- **Diferencias y ajustes**

---

## 3. CONCILIACIÓN BANCARIA

### 3.1 Obtención de Extractos Bancarios

#### Por cada cuenta bancaria:
1. **Banco de la Nación - Cuenta Corriente**:
   - Descargar extracto en formato Excel
   - Período: 1 al último día del mes
   - Validar saldo final

2. **BCP - Cuenta de Ahorros**:
   - Obtener extracto digital
   - Verificar movimientos automáticos
   - Confirmar intereses ganados

### 3.2 Proceso de Conciliación

#### En el Sistema
1. **Subir extractos bancarios**:
   ```
   Sistema → Caja y Bancos → Conciliación → Subir Archivo
   ```
   - Archivo en formato CSV o Excel
   - Columnas: Date, Description, Amount, Type

2. **Identificar diferencias**:
   - Cheques no cobrados
   - Depósitos en tránsito
   - Débitos bancarios
   - Comisiones y gastos

3. **Registrar ajustes**:
   ```
   Sistema → Movimientos de Caja → Ajuste Bancario
   ```

#### Documentación
- ✅ Extractos bancarios oficiales
- ✅ Planilla de conciliación
- ✅ Comprobantes de ajustes
- ✅ Nota explicativa de diferencias

### 3.3 Validaciones Críticas
- **Saldo en libros** = **Saldo bancario** ± **Ajustes**
- **Diferencias** < 0.1% del movimiento mensual
- **Partidas pendientes** documentadas y explicadas

---

## 4. BOLETAS E INGRESOS

### 4.1 Corte de Boletas

#### Procedimiento de Cierre
1. **Último día del mes a las 6:00 PM**:
   - No emitir más boletas del mes actual
   - Cambiar numeración al mes siguiente

2. **Verificación de series**:
   ```
   Sistema → Boletas → Reportes → Por Serie
   ```
   - Serie 001 (Matrículas): Verificar correlativos
   - Serie 002 (Pensiones): Confirmar secuencia
   - Serie 003 (Certificados): Validar continuidad

### 4.2 Control de Ingresos

#### Validación por Concepto
1. **Ingresos por Matrícula**:
   ```
   Sistema → Boletas → Filtros → Concepto: ENROLLMENT
   ```
   - Total de estudiantes matriculados
   - Monto promedio por matrícula
   - Becas y exoneraciones

2. **Ingresos por Pensiones**:
   ```
   Sistema → Boletas → Filtros → Concepto: TUITION
   ```
   - Pensiones cobradas vs. estudiantes activos
   - Morosidad por programa
   - Fraccionamientos autorizados

3. **Otros Ingresos**:
   - Certificados y constancias
   - Trámites administrativos
   - Servicios adicionales

### 4.3 Estados de Boletas

#### Revisión Obligatoria
1. **Boletas Pendientes**:
   ```
   Sistema → Boletas → Filtros → Estado: PENDING
   ```
   - Identificar morosidad por más de 30 días
   - Gestión de cobranza pendiente

2. **Boletas Anuladas**:
   ```
   Sistema → Boletas → Filtros → Estado: CANCELLED
   ```
   - Verificar autorización de anulación
   - Documentar motivos
   - Confirmar devoluciones realizadas

### 4.4 Reportes de Ingresos
- **📊 Reporte Mensual de Ingresos**
- **📈 Comparativo con mes anterior**
- **💰 Análisis de morosidad**
- **📋 Detalle por centro de costo**

---

## 5. INVENTARIO

### 5.1 Conteo Físico Mensual

#### Preparación (Día 3 del mes siguiente)
1. **Programar inventario**:
   - Coordinar con áreas usuarias
   - Suspender movimientos temporalmente
   - Preparar formatos de conteo

2. **Equipos de conteo**:
   - **Equipo A**: Materiales de oficina
   - **Equipo B**: Suministros educativos
   - **Equipo C**: Equipos tecnológicos
   - **Equipo D**: Mobiliario y activos

#### Ejecución del Conteo
1. **Por cada área de almacén**:
   - Contar físicamente todos los items
   - Registrar en formato impreso
   - **Doble verificación** para items de alto valor

2. **Ingreso al sistema**:
   ```
   Sistema → Inventario → Ajustes → Conteo Físico
   ```
   - Comparar stock sistema vs. físico
   - Registrar diferencias
   - Generar movimientos de ajuste

### 5.2 Valorización FIFO

#### Cálculo Automático
El sistema calcula automáticamente:
- **Costo promedio** por item
- **Valor total** del inventario
- **Rotación** de materiales
- **Items obsoletos** (sin movimiento > 6 meses)

#### Revisión Manual
1. **Items de alta rotación**:
   - Papel, útiles de escritorio
   - Material educativo básico
   - Productos de limpieza

2. **Items de baja rotación**:
   - Equipos tecnológicos
   - Mobiliario especializado
   - Material didáctico específico

### 5.3 Reportes de Inventario
```
Sistema → Inventario → Reportes
```
- **📦 Valorización Total** (por categoría)
- **📊 Movimientos del Mes** (entradas/salidas)
- **⚠️ Alertas de Stock** (mínimos y máximos)
- **📈 Análisis de Rotación** (por item)

### 5.4 Acciones Correctivas
- **Stock faltante**: Investigar y documentar
- **Stock sobrante**: Verificar ingresos no registrados
- **Items dañados**: Evaluar y dar de baja si procede
- **Items obsoletos**: Proponer reasignación o baja

---

## 6. CUENTAS POR PAGAR

### 6.1 Revisión de Proveedores

#### Control de Facturas Pendientes
1. **Por cada proveedor activo**:
   ```
   Sistema → Logística → Proveedores → Estado de Cuenta
   ```
   - Facturas recibidas no pagadas
   - Fechas de vencimiento
   - Descuentos por pronto pago

2. **Cronograma de pagos**:
   - **Proveedores críticos**: Servicios básicos
   - **Proveedores regulares**: Suministros
   - **Proveedores eventuales**: Servicios especiales

### 6.2 Órdenes de Compra

#### Estado de Órdenes
```
Sistema → Logística → Órdenes de Compra → Reporte Mensual
```
- **Órdenes emitidas**: Pendientes de entrega
- **Órdenes recibidas**: Pendientes de pago
- **Órdenes canceladas**: Con justificación

### 6.3 Provisiones Contables

#### Gastos Devengados No Pagados
- **Servicios públicos** (agua, luz, teléfono)
- **Servicios profesionales** (contabilidad, legal)
- **Mantenimiento** (equipos, infraestructura)
- **Seguros** (pólizas institucionales)

---

## 7. RECURSOS HUMANOS

### 7.1 Control de Planilla

#### Verificación de Asistencia
```
Sistema → RRHH → Asistencia → Reporte Mensual
```
1. **Por cada empleado**:
   - Días laborados efectivos
   - Tardanzas y faltas
   - Horas extra autorizadas
   - Permisos y licencias

2. **Consolidación por departamento**:
   - **Administración**: Personal administrativo
   - **Académico**: Docentes y coordinadores
   - **Servicios**: Limpieza y mantenimiento

### 7.2 Cálculo de Haberes

#### Conceptos de Pago
1. **Haberes Fijos**:
   - Remuneración básica
   - Asignaciones permanentes
   - Bonificaciones familiares

2. **Haberes Variables**:
   - Horas extra
   - Incentivos por desempeño
   - Movilidad y refrigerio

### 7.3 Descuentos y Contribuciones

#### Descuentos Legales
- **SNP/SPP**: Según afiliación
- **Impuesto a la Renta**: 5ta categoría
- **EsSalud**: 9% empleador

#### Otros Descuentos
- **Préstamos**: Cuotas autorizadas
- **Faltas**: Descuento por inasistencias
- **Adelantos**: Regularización

### 7.4 Reportes de RRHH
- **👥 Planilla Mensual** detallada
- **📊 Resumen por Conceptos** de pago
- **⏰ Control de Asistencia** consolidado
- **💼 Variaciones de Personal** (altas/bajas)

---

## 8. REPORTES OBLIGATORIOS

### 8.1 Reportes Financieros Principales

#### 1. Estado de Situación Financiera
**Contenido obligatorio**:
- **Activo Corriente**:
  - Caja y bancos
  - Cuentas por cobrar (estudiantes)
  - Inventarios valorizado

- **Activo No Corriente**:
  - Equipos y mobiliario
  - Infraestructura
  - Depreciación acumulada

- **Pasivo Corriente**:
  - Cuentas por pagar proveedores
  - Tributos por pagar
  - Remuneraciones por pagar

- **Patrimonio**:
  - Patrimonio institucional
  - Resultados acumulados
  - Resultado del ejercicio

#### 2. Estado de Gestión (Ingresos y Gastos)
**Estructura requerida**:
```
INGRESOS OPERACIONALES:
├── Ingresos por Matrículas
├── Ingresos por Pensiones  
├── Ingresos por Certificados
└── Otros Ingresos Educativos

GASTOS OPERACIONALES:
├── Gastos de Personal
├── Bienes y Servicios
├── Depreciación
└── Otros Gastos Operativos

RESULTADO OPERATIVO
├── Ingresos Financieros
├── Gastos Financieros
└── RESULTADO NETO
```

#### 3. Flujo de Efectivo
**Métodos de presentación**:
- **Actividades Operativas**: Ingresos y gastos del giro
- **Actividades de Inversión**: Compra de activos
- **Actividades de Financiamiento**: Préstamos y aportes

### 8.2 Reportes Gerenciales

#### Dashboard Ejecutivo
```
Sistema → Dashboard → Reportes Gerenciales
```
**Indicadores clave (KPIs)**:
- **💰 Liquidez**: Caja/Gastos Mensuales
- **📈 Crecimiento**: Ingresos vs. Mes Anterior
- **👥 Eficiencia**: Gasto Personal/Total Gastos
- **🎓 Productividad**: Ingreso/Alumno Matriculado

#### Análisis Comparativo
- **Presupuesto vs. Ejecutado**
- **Año Actual vs. Año Anterior**
- **Tendencias trimestrales**
- **Proyecciones del trimestre**

### 8.3 Reportes Regulatorios

#### Para MINEDU
- **Reporte de Ingresos** por fuente de financiamiento
- **Estado de Ejecución Presupuestal**
- **Indicadores de Gestión Educativa**

#### Para SUNAT (si aplica)
- **Registro de Ventas** (boletas internas)
- **Registro de Compras** (facturas de proveedores)
- **Libros Contables** electrónicos

#### Para Contraloría
- **Estado de Situación Financiera**
- **Ejecución Presupuestal**
- **Control de Activos Fijos**

---

## 9. ARCHIVO DE DOCUMENTOS

### 9.1 Organización Física

#### Estructura de Archivos
```
ARCHIVO MENSUAL [MES-AÑO]/
├── 01-CAJA-Y-BANCOS/
│   ├── Arqueos diarios
│   ├── Conciliaciones bancarias
│   └── Comprobantes de ingresos/egresos
├── 02-BOLETAS-E-INGRESOS/
│   ├── Copias de boletas emitidas
│   ├── Comprobantes de pago
│   └── Reportes de morosidad
├── 03-INVENTARIOS/
│   ├── Conteos físicos
│   ├── Valorizaciones FIFO
│   └── Ajustes de inventario
├── 04-CUENTAS-POR-PAGAR/
│   ├── Facturas de proveedores
│   ├── Órdenes de compra
│   └── Comprobantes de pago
├── 05-RECURSOS-HUMANOS/
│   ├── Planillas mensuales
│   ├── Control de asistencia
│   └── Liquidaciones y descuentos
└── 06-REPORTES-OFICIALES/
    ├── Estados financieros
    ├── Reportes gerenciales
    └── Informes regulatorios
```

### 9.2 Archivo Digital

#### Respaldo en Sistema
```
Sistema → Administración → Respaldos → Crear Backup Mensual
```
- **Base de datos** completa
- **Documentos PDF** generados
- **Logs de auditoría** del período

#### Almacenamiento en Nube
- **Google Drive Institucional**: Reportes principales
- **OneDrive**: Documentos de trabajo
- **Servidor Local**: Backup completo cifrado

### 9.3 Retención Documental

#### Períodos de Conservación
- **Documentos tributarios**: 5 años
- **Estados financieros**: 10 años
- **Planillas de sueldos**: 30 años
- **Documentos de estudiantes**: Permanente
- **Inventarios y activos**: 10 años

#### Protocolo de Eliminación
1. **Revisión anual** de documentos vencidos
2. **Autorización escrita** de Dirección
3. **Acta de eliminación** con testigos
4. **Triturado seguro** de documentos físicos

---

## 10. CHECKLIST FINAL

### 10.1 Verificación Pre-Cierre (Día 30 del mes)

#### Caja y Bancos ✅
- [ ] Todas las sesiones de caja están cerradas
- [ ] Arqueos diarios completados
- [ ] Comprobantes físicos archivados
- [ ] Diferencias documentadas y explicadas

#### Boletas e Ingresos ✅
- [ ] Última boleta del mes registrada
- [ ] Series correlativas verificadas
- [ ] Estados de boletas revisados
- [ ] Morosidad identificada y gestionada

#### Inventarios ✅
- [ ] Movimientos del mes registrados
- [ ] Valorización FIFO actualizada
- [ ] Alertas de stock revisadas
- [ ] Items dañados u obsoletos identificados

### 10.2 Verificación de Cierre (Día 5 del mes siguiente)

#### Conciliaciones ✅
- [ ] Extractos bancarios obtenidos
- [ ] Conciliaciones bancarias completadas
- [ ] Diferencias menores al 0.1%
- [ ] Ajustes contables registrados

#### Inventario Físico ✅
- [ ] Conteo físico realizado
- [ ] Diferencias entre sistema y físico < 2%
- [ ] Ajustes de inventario procesados
- [ ] Valorización final confirmada

#### Recursos Humanos ✅
- [ ] Asistencia mensual consolidada
- [ ] Planilla calculada y revisada
- [ ] Descuentos y aportes verificados
- [ ] Variaciones de personal documentadas

### 10.3 Verificación Final (Día 8 del mes siguiente)

#### Reportes Generados ✅
- [ ] Estado de Situación Financiera
- [ ] Estado de Gestión (Ingresos/Gastos)
- [ ] Flujo de Efectivo
- [ ] Dashboard Gerencial
- [ ] Reportes regulatorios

#### Documentación ✅
- [ ] Archivo físico organizado
- [ ] Respaldo digital realizado
- [ ] Documentos subidos a la nube
- [ ] Logs de auditoría exportados

#### Aprobaciones ✅
- [ ] Revisión del Tesorero
- [ ] Visto Bueno del Administrador
- [ ] Aprobación de la Dirección
- [ ] Firma de responsables

### 10.4 Entrega y Comunicación ✅

#### Entregables Finales
- [ ] **Informe Ejecutivo** de cierre mensual
- [ ] **Estados Financieros** oficiales
- [ ] **Dashboard Gerencial** con KPIs
- [ ] **Reporte de Excepciones** y observaciones
- [ ] **Plan de Acción** para el siguiente mes

#### Comunicación Institucional
- [ ] **Email a Dirección** con resumen ejecutivo
- [ ] **Presentación** a Consejo Directivo (si aplica)
- [ ] **Comunicado** a coordinadores de área
- [ ] **Archivo** en sistema institucional

---

## RESPONSABILIDADES POR ROL

### 👨‍💼 Administrador Financiero
- **Supervisión general** del proceso de cierre
- **Revisión** de conciliaciones bancarias
- **Aprobación** de ajustes contables
- **Presentación** de resultados a Dirección

### 👩‍💰 Tesorero/a
- **Ejecución** del cronograma de cierre
- **Generación** de reportes financieros
- **Coordinación** con áreas involucradas
- **Documentación** de procedimientos

### 👨‍💻 Cajero/a
- **Cierre** de sesiones de caja
- **Arqueos** diarios y mensuales
- **Verificación** de boletas emitidas
- **Control** de ingresos por concepto

### 👩‍🏭 Almacenero/a
- **Conteo físico** de inventarios
- **Registro** de diferencias encontradas
- **Valorización** con sistema FIFO
- **Control** de stock mínimos y máximos

### 👨‍💼 Encargado RRHH
- **Consolidación** de asistencia mensual
- **Cálculo** de planilla de sueldos
- **Verificación** de descuentos y aportes
- **Reporte** de variaciones de personal

---

## CONTACTOS DE EMERGENCIA

**Para consultas técnicas del sistema**:
- **Soporte Técnico**: soporte@iesppgal.edu.pe
- **Teléfono**: (01) 123-4567 Ext. 101

**Para autorizaciones especiales**:
- **Director General**: director@iesppgal.edu.pe
- **Administrador**: admin@iesppgal.edu.pe

**Para asesoría contable**:
- **Contador Externo**: contador@consultora.com
- **Teléfono**: (01) 987-6543

---

**GUÍA OFICIAL DE CIERRE MENSUAL**  
**Módulo Tesorería y Administración**  
**Sistema Integral Académico IESPP "Gustavo Allende Llavería"**  
**Versión 1.0 - Septiembre 2024**

*Documento de cumplimiento obligatorio para todo el personal del área financiera y administrativa.*