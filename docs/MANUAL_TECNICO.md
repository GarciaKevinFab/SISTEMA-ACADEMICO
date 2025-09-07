# MANUAL TÉCNICO - MÓDULO TESORERÍA Y ADMINISTRACIÓN
## Sistema Integral Académico IESPP "Gustavo Allende Llavería"

### VERSIÓN: 1.0 - PRODUCCIÓN
### FECHA: Septiembre 2024

---

## 1. ARQUITECTURA DEL SISTEMA

### 1.1 Arquitectura General
- **Frontend**: React 18 con TypeScript
- **Backend**: FastAPI (Python 3.11)
- **Base de Datos**: MongoDB 6.0
- **Autenticación**: JWT con roles
- **Deployment**: Kubernetes + Docker

### 1.2 Estructura de Directorios
```
/app/
├── backend/
│   ├── server.py                 # Servidor principal FastAPI
│   ├── models.py                # Modelos Pydantic generales
│   ├── finance_models.py        # Modelos específicos del módulo finanzas
│   ├── finance_enums.py         # Enumeraciones del módulo finanzas
│   ├── finance_utils.py         # Utilidades (QR, PDF, FIFO, auditoría)
│   ├── auth_utils.py            # Utilidades de autenticación
│   ├── crud.py                  # Operaciones CRUD generales
│   ├── seed_data.py             # Script de datos iniciales
│   └── requirements.txt         # Dependencias Python
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── FinanceModule.jsx         # Módulo principal de finanzas
│   │   │   ├── finance/
│   │   │   │   ├── CashBanksDashboard.jsx    # Dashboard Caja y Bancos
│   │   │   │   ├── ReceiptsDashboard.jsx     # Dashboard Boletas
│   │   │   │   ├── InventoryDashboard.jsx    # Dashboard Inventario
│   │   │   │   ├── LogisticsDashboard.jsx    # Dashboard Logística
│   │   │   │   └── HRDashboard.jsx           # Dashboard RRHH
│   │   │   └── ui/                       # Componentes UI (Shadcn)
│   │   └── App.js                        # Aplicación principal
└── scripts/
    └── finance_reports.py        # Generador de reportes
```

---

## 2. BASE DE DATOS

### 2.1 Colecciones MongoDB

#### Colecciones Principales
- **bank_accounts**: Cuentas bancarias de la institución
- **cash_sessions**: Sesiones de caja (apertura/cierre)
- **cash_movements**: Movimientos de caja (ingresos/egresos)
- **receipts**: Boletas internas no tributarias
- **receipt_payments**: Registros de pagos de boletas (idempotencia)
- **gl_concepts**: Conceptos contables (ingresos/egresos)
- **cost_centers**: Centros de costo
- **income_expenses**: Asientos de ingresos y egresos
- **inventory_items**: Items de inventario
- **inventory_movements**: Movimientos de inventario (FIFO)
- **suppliers**: Proveedores con validación RUC
- **requirements**: Requerimientos de compra
- **requirement_items**: Items de requerimientos
- **purchase_orders**: Órdenes de compra
- **purchase_order_items**: Items de órdenes de compra
- **receptions**: Recepciones de mercadería
- **employees**: Personal de la institución
- **attendance**: Registro de asistencia
- **audit_logs**: Logs de auditoría completos

#### Índices Críticos
```javascript
// Bank Accounts
db.bank_accounts.createIndex({"account_number": 1}, {unique: true})
db.bank_accounts.createIndex({"is_active": 1})

// Receipts
db.receipts.createIndex({"receipt_number": 1}, {unique: true})
db.receipts.createIndex([{"status": 1, "issued_at": -1}])
db.receipts.createIndex({"customer_document": 1})

// Inventory
db.inventory_items.createIndex({"code": 1}, {unique: true})
db.inventory_items.createIndex([{"category": 1, "is_active": 1}])
db.inventory_movements.createIndex([{"item_id": 1, "created_at": 1}])

// Suppliers
db.suppliers.createIndex({"ruc": 1}, {unique: true})
db.suppliers.createIndex({"supplier_code": 1}, {unique: true})

// Employees
db.employees.createIndex({"document_number": 1}, {unique: true})
db.employees.createIndex({"employee_code": 1}, {unique: true})

// Audit Logs
db.audit_logs.createIndex([{"table_name": 1, "timestamp": -1}])
db.audit_logs.createIndex({"user_id": 1})
```

### 2.2 Esquemas de Datos Críticos

#### CashSession (Sesión de Caja)
```json
{
  "id": "uuid",
  "session_number": "SES-2024-001",
  "initial_amount": 1000.0,
  "final_amount": 1350.0,
  "expected_final_amount": 1350.0,
  "difference": 0.0,
  "status": "CLOSED", // OPEN | CLOSED | RECONCILED
  "opened_by": "user_id",
  "opened_at": "2024-09-01T08:00:00Z",
  "closed_by": "user_id",
  "closed_at": "2024-09-01T18:00:00Z",
  "total_income": 500.0,
  "total_expense": 150.0,
  "cashier_notes": "Sesión normal",
  "closing_notes": "Arqueo correcto"
}
```

#### Receipt (Boleta Interna)
```json
{
  "id": "uuid",
  "receipt_number": "001-000123",
  "series": "001",
  "correlative": 123,
  "concept": "TUITION", // ENROLLMENT | TUITION | CERTIFICATE | PROCEDURE
  "description": "Pago de pensión marzo 2024",
  "amount": 350.0,
  "customer_name": "Juan Pérez López",
  "customer_document": "12345678",
  "customer_email": "juan.perez@example.com",
  "status": "PAID", // PENDING | PAID | CANCELLED | REFUNDED
  "issued_at": "2024-09-01T10:00:00Z",
  "paid_at": "2024-09-01T10:15:00Z",
  "payment_method": "CASH",
  "qr_code": "data:image/png;base64,iVBOR...",
  "pdf_path": "/tmp/receipt_uuid.pdf"
}
```

#### InventoryMovement (Movimiento FIFO)
```json
{
  "id": "uuid",
  "movement_number": "MOV-2024-001",
  "item_id": "item_uuid",
  "movement_type": "ENTRY", // ENTRY | EXIT | TRANSFER | ADJUSTMENT
  "quantity": 50,
  "unit_cost": 12.50,
  "total_cost": 625.0,
  "stock_before": 100,
  "stock_after": 150,
  "reason": "Compra de papel",
  "batch_number": "LT001",
  "expiry_date": "2025-12-31"
}
```

---

## 3. APIs REST

### 3.1 Endpoints Principales

#### Autenticación y Autorización
```
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

#### Caja y Bancos
```
GET    /api/finance/bank-accounts
POST   /api/finance/bank-accounts
PUT    /api/finance/bank-accounts/{id}

GET    /api/finance/cash-sessions/current
POST   /api/finance/cash-sessions
POST   /api/finance/cash-sessions/{id}/close

GET    /api/finance/cash-movements
POST   /api/finance/cash-movements

POST   /api/finance/bank-reconciliation/upload
```

#### Boletas Internas
```
GET    /api/finance/receipts
POST   /api/finance/receipts
POST   /api/finance/receipts/{id}/pay
POST   /api/finance/receipts/{id}/cancel
GET    /api/finance/receipts/{id}/pdf

GET    /api/verificar/{receipt_id}  # Endpoint público
```

#### Inventario
```
GET    /api/inventory/items
POST   /api/inventory/items
PUT    /api/inventory/items/{id}

GET    /api/inventory/movements
POST   /api/inventory/movements
GET    /api/inventory/items/{id}/kardex

GET    /api/inventory/alerts
```

#### Logística
```
GET    /api/logistics/suppliers
POST   /api/logistics/suppliers

GET    /api/logistics/requirements
POST   /api/logistics/requirements
```

#### Recursos Humanos
```
GET    /api/hr/employees
POST   /api/hr/employees
PUT    /api/hr/employees/{id}

GET    /api/hr/attendance
POST   /api/hr/attendance
```

### 3.2 Códigos de Respuesta HTTP
- **200**: Operación exitosa
- **201**: Recurso creado
- **400**: Error en datos de entrada
- **401**: No autenticado
- **403**: Sin permisos
- **404**: Recurso no encontrado
- **422**: Error de validación
- **500**: Error interno del servidor

### 3.3 Formato de Respuestas
```json
{
  "status": "success|error",
  "message": "Descripción de la operación",
  "data": {...},
  "errors": [...] // Solo en caso de error
}
```

---

## 4. ROLES Y PERMISOS

### 4.1 Roles del Sistema
- **ADMIN**: Acceso completo al sistema
- **FINANCE_ADMIN**: Administrador del módulo financiero
- **CASHIER**: Cajero (sesiones, boletas, movimientos)
- **WAREHOUSE**: Encargado de almacén (inventario)
- **HR_ADMIN**: Administrador de recursos humanos
- **LOGISTICS**: Encargado de logística (proveedores, compras)

### 4.2 Matriz de Permisos

| Funcionalidad | ADMIN | FINANCE_ADMIN | CASHIER | WAREHOUSE | HR_ADMIN | LOGISTICS |
|---------------|-------|---------------|---------|-----------|----------|-----------|
| Cuentas Bancarias | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Sesiones de Caja | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Boletas Internas | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Anular Boletas | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Inventario | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Proveedores | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| Requerimientos | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| Empleados | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Asistencia | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |

---

## 5. AUDITORÍA Y SEGURIDAD

### 5.1 Sistema de Auditoría
Todas las operaciones críticas son registradas en la colección `audit_logs`:

```json
{
  "id": "uuid",
  "table_name": "receipts",
  "record_id": "receipt_uuid",
  "action": "CREATE|UPDATE|DELETE|VIEW|EXPORT|PRINT",
  "old_values": {...}, // Valores anteriores
  "new_values": {...}, // Valores nuevos
  "user_id": "user_uuid",
  "ip_address": "192.168.1.100",
  "timestamp": "2024-09-01T10:00:00Z"
}
```

### 5.2 Funciones de Auditoría
```python
async def log_audit_trail(
    db, table_name: str, record_id: str, action: str, 
    old_values: Optional[Dict] = None, 
    new_values: Optional[Dict] = None,
    user_id: str = None, 
    ip_address: str = None
):
    """Registra trail de auditoría para cualquier cambio"""
    audit_log = {
        "id": str(uuid.uuid4()),
        "table_name": table_name,
        "record_id": record_id,
        "action": action,
        "old_values": old_values,
        "new_values": new_values,
        "user_id": user_id,
        "ip_address": ip_address,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.audit_logs.insert_one(audit_log)
```

### 5.3 Seguridad de Datos
- **Cifrado**: Datos sensibles (cuentas bancarias) cifrados en reposo
- **Mascarado**: Números de cuenta y documentos personales mascarados en logs
- **JWT**: Tokens con expiración de 24 horas
- **HTTPS**: Todas las comunicaciones sobre SSL/TLS
- **Validación**: Validación estricta de datos de entrada (RUC, DNI, emails)

---

## 6. FUNCIONALIDADES ESPECÍFICAS

### 6.1 Sistema FIFO (First In, First Out)
El sistema implementa cálculo automático de costos FIFO para inventarios:

```python
def calculate_inventory_fifo(
    current_stock: int,
    inventory_movements: List[Dict[str, Any]],
    exit_quantity: int
) -> tuple[float, List[Dict[str, Any]]]:
    """
    Calcula costo FIFO para salida de inventario
    Retorna: (costo_total, desglose_costos)
    """
    entries = [m for m in inventory_movements if m['movement_type'] == 'ENTRY']
    entries.sort(key=lambda x: x['created_at'])  # FIFO por fecha
    
    remaining_to_exit = exit_quantity
    total_cost = 0.0
    cost_breakdown = []
    
    for entry in entries:
        if remaining_to_exit <= 0:
            break
            
        available_quantity = entry.get('remaining_quantity', entry['quantity'])
        if available_quantity <= 0:
            continue
            
        exit_from_this_entry = min(remaining_to_exit, available_quantity)
        unit_cost = entry.get('unit_cost', 0)
        entry_cost = exit_from_this_entry * unit_cost
        
        total_cost += entry_cost
        cost_breakdown.append({
            'entry_id': entry['id'],
            'entry_date': entry['created_at'],
            'quantity': exit_from_this_entry,
            'unit_cost': unit_cost,
            'total_cost': entry_cost
        })
        
        remaining_to_exit -= exit_from_this_entry
    
    return total_cost, cost_breakdown
```

### 6.2 Generación de QR y PDFs
El sistema genera automáticamente códigos QR para verificación de boletas:

```python
def generate_qr_code(data: str, size: int = 10) -> str:
    """Genera código QR como string base64"""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=size,
        border=4,
    )
    qr.add_data(data)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    
    img_data = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/png;base64,{img_data}"
```

### 6.3 Validación RUC
Implementa algoritmo oficial de validación de RUC peruano:

```python
def validate_ruc(ruc: str) -> bool:
    """Valida RUC peruano"""
    if not ruc or len(ruc) != 11 or not ruc.isdigit():
        return False
    
    factors = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
    check_digit = int(ruc[10])
    
    total = sum(int(ruc[i]) * factors[i] for i in range(10))
    remainder = total % 11
    calculated_check_digit = 11 - remainder if remainder >= 2 else remainder
    
    return check_digit == calculated_check_digit
```

### 6.4 Idempotencia en Pagos
Sistema de idempotencia para evitar pagos duplicados:

```python
# En el endpoint de pago
if idempotency_key:
    existing_payment = await db.receipt_payments.find_one({
        "receipt_id": receipt_id,
        "idempotency_key": idempotency_key
    })
    if existing_payment:
        return {"status": "success", "message": "Payment already processed"}
```

---

## 7. CONFIGURACIÓN Y DEPLOYMENT

### 7.1 Variables de Entorno
```bash
# Backend
MONGO_URL=mongodb://localhost:27017/iespp_system
JWT_SECRET_KEY=your-secret-key
JWT_ALGORITHM=HS256
JWT_EXPIRE_HOURS=24

# Frontend
REACT_APP_BACKEND_URL=https://api.iesppgal.edu.pe
```

### 7.2 Comandos de Deployment
```bash
# Inicializar datos
cd /app/backend
python seed_data.py

# Generar reportes
cd /app/scripts
python finance_reports.py --report cash-flow --start-date 2024-09-01 --end-date 2024-09-30

# Reiniciar servicios
sudo supervisorctl restart all
```

### 7.3 Backup y Restore
```bash
# Backup MongoDB
mongodump --uri="mongodb://localhost:27017/iespp_system" --out=/backup/$(date +%Y%m%d)

# Restore MongoDB
mongorestore --uri="mongodb://localhost:27017/iespp_system" /backup/20240901/iespp_system/
```

---

## 8. MONITOREO Y LOGS

### 8.1 Logs del Sistema
- **Backend**: `/var/log/supervisor/backend.*.log`
- **Frontend**: `/var/log/supervisor/frontend.*.log`
- **Auditoría**: Colección `audit_logs` en MongoDB

### 8.2 Métricas de Performance
- **Response Time**: < 1.5s (p95)
- **Throughput**: 200 req/min en endpoints críticos
- **Error Rate**: < 1% en operaciones financieras
- **Uptime**: > 99.9%

### 8.3 Alertas Críticas
- Stock bajo en inventario
- Diferencias en arqueo de caja > S/10
- Fallos en validación RUC
- Errores 5xx en APIs críticas
- Intentos de acceso no autorizado

---

## 9. MANTENIMIENTO

### 9.1 Tareas Diarias
- Verificar estado de servicios
- Revisar logs de error
- Validar backups automáticos
- Monitorear alertas de inventario

### 9.2 Tareas Semanales
- Limpieza de logs antiguos
- Revisión de performance de queries
- Actualización de índices si es necesario
- Revisión de auditoría de seguridad

### 9.3 Tareas Mensuales
- Cierre contable mensual
- Conciliación bancaria completa
- Arqueo físico de inventario
- Reporte de gestión financiera
- Backup completo del sistema

---

## 10. TROUBLESHOOTING

### 10.1 Problemas Comunes

#### Error: "No se puede abrir sesión de caja"
**Causa**: Usuario ya tiene sesión abierta
**Solución**: 
```sql
db.cash_sessions.updateOne(
  {"opened_by": "user_id", "status": "OPEN"},
  {"$set": {"status": "CLOSED", "closed_at": new Date()}}
)
```

#### Error: "RUC inválido"
**Causa**: RUC no pasa validación de dígito verificador
**Solución**: Verificar que el RUC tenga 11 dígitos y sea válido según SUNAT

#### Error: "Stock insuficiente"
**Causa**: Intento de salida mayor al stock disponible
**Solución**: Verificar stock actual en inventario y ajustar cantidad

### 10.2 Comandos de Diagnóstico
```bash
# Verificar estado de servicios
sudo supervisorctl status

# Ver logs en tiempo real
tail -f /var/log/supervisor/backend.out.log

# Verificar conexión MongoDB
mongo mongodb://localhost:27017/iespp_system --eval "db.stats()"

# Test de conectividad API
curl -X GET "https://api.iesppgal.edu.pe/api/health"
```

---

## 11. CHANGELOG

### Versión 1.0 (Septiembre 2024)
- ✅ Implementación completa del módulo Tesorería y Administración
- ✅ Sistema de caja con apertura/cierre y arqueo
- ✅ Boletas internas con QR y verificación pública
- ✅ Inventario con cálculo FIFO automático
- ✅ Gestión de proveedores con validación RUC
- ✅ Módulo de RRHH con control de asistencia
- ✅ Sistema de auditoría completo
- ✅ Dashboards interactivos por rol
- ✅ Generación de reportes PDF y CSV
- ✅ Testing automatizado frontend y backend
- ✅ Documentación técnica y de usuario

---

**DOCUMENTO TÉCNICO OFICIAL**  
**Módulo Tesorería y Administración**  
**Sistema Integral Académico IESPP "Gustavo Allende Llavería"**  
**Versión 1.0 - Producción Ready**