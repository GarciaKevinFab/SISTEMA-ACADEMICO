from enum import Enum

# Cash and Banking Enums
class CashSessionStatus(str, Enum):
    OPEN = "OPEN"                           # Sesión abierta
    CLOSED = "CLOSED"                       # Sesión cerrada (pendiente reconciliación)
    RECONCILED = "RECONCILED"               # Sesión reconciliada

class MovementType(str, Enum):
    INCOME = "INCOME"                       # Ingreso
    EXPENSE = "EXPENSE"                     # Egreso
    TRANSFER = "TRANSFER"                   # Transferencia

class PaymentMethod(str, Enum):
    CASH = "CASH"                          # Efectivo
    BANK_DEPOSIT = "BANK_DEPOSIT"          # Depósito bancario
    BANK_TRANSFER = "BANK_TRANSFER"        # Transferencia bancaria
    CHECK = "CHECK"                        # Cheque
    DEBIT_CARD = "DEBIT_CARD"             # Tarjeta de débito
    CREDIT_CARD = "CREDIT_CARD"           # Tarjeta de crédito

# Receipt Enums
class ReceiptStatus(str, Enum):
    PENDING = "PENDING"                    # Pendiente de pago
    PAID = "PAID"                         # Pagado
    VOID = "VOID"                         # Anulado (después de pagado)
    CANCELLED = "CANCELLED"               # Cancelado (antes de pagar)
    REFUNDED = "REFUNDED"                 # Reembolsado

class ReceiptConcept(str, Enum):
    ENROLLMENT = "ENROLLMENT"              # Matrícula
    TUITION = "TUITION"                   # Pensión
    CERTIFICATE = "CERTIFICATE"           # Constancia/Certificado
    PROCEDURE = "PROCEDURE"               # Trámite
    ACADEMIC_SERVICES = "ACADEMIC_SERVICES" # Servicios académicos
    OTHER = "OTHER"                       # Otro concepto

# General Ledger Enums
class GLConceptType(str, Enum):
    INCOME = "INCOME"                     # Ingreso
    EXPENSE = "EXPENSE"                   # Egreso

# Inventory Enums
class InventoryMovementType(str, Enum):
    ENTRY = "ENTRY"                       # Entrada/Ingreso
    EXIT = "EXIT"                         # Salida
    TRANSFER = "TRANSFER"                 # Transferencia
    ADJUSTMENT = "ADJUSTMENT"             # Ajuste de inventario

class UnitOfMeasure(str, Enum):
    UNIT = "UNIT"                         # Unidad
    DOZEN = "DOZEN"                       # Docena
    KILOGRAM = "KG"                       # Kilogramo
    LITER = "L"                           # Litro
    METER = "M"                           # Metro
    PACKAGE = "PKG"                       # Paquete
    BOX = "BOX"                           # Caja

# HR Enums
class ContractType(str, Enum):
    PERMANENT = "PERMANENT"               # Nombrado/Permanente
    TEMPORARY = "TEMPORARY"               # Contratado
    CAS = "CAS"                          # Contrato Administrativo de Servicios
    LOCACION = "LOCACION"                # Locación de servicios

class EmployeeStatus(str, Enum):
    ACTIVE = "ACTIVE"                     # Activo
    INACTIVE = "INACTIVE"                 # Inactivo
    SUSPENDED = "SUSPENDED"               # Suspendido
    RETIRED = "RETIRED"                   # Cesante/Jubilado
    TERMINATED = "TERMINATED"             # Cesado

# Logistics Enums
class RequirementStatus(str, Enum):
    DRAFT = "DRAFT"                       # Borrador
    SUBMITTED = "SUBMITTED"               # Enviado
    APPROVED = "APPROVED"                 # Aprobado
    REJECTED = "REJECTED"                 # Rechazado
    CONVERTED_TO_PO = "CONVERTED_TO_PO"   # Convertido a OC

class PurchaseOrderStatus(str, Enum):
    DRAFT = "DRAFT"                       # Borrador
    SENT = "SENT"                         # Enviada al proveedor
    CONFIRMED = "CONFIRMED"               # Confirmada por proveedor
    PARTIALLY_RECEIVED = "PARTIALLY_RECEIVED" # Parcialmente recibida
    FULLY_RECEIVED = "FULLY_RECEIVED"     # Totalmente recibida
    CANCELLED = "CANCELLED"               # Cancelada

class SupplierStatus(str, Enum):
    ACTIVE = "ACTIVE"                     # Activo
    INACTIVE = "INACTIVE"                 # Inactivo
    BLACKLISTED = "BLACKLISTED"           # En lista negra

# Reconciliation Enums
class ReconciliationStatus(str, Enum):
    PENDING = "PENDING"                   # Pendiente
    RECONCILED = "RECONCILED"             # Conciliada
    DISCREPANCY = "DISCREPANCY"           # Con diferencias

# Audit Enums
class AuditAction(str, Enum):
    CREATE = "CREATE"                     # Creación
    UPDATE = "UPDATE"                     # Actualización
    DELETE = "DELETE"                     # Eliminación
    VIEW = "VIEW"                         # Consulta
    EXPORT = "EXPORT"                     # Exportación
    PRINT = "PRINT"                       # Impresión