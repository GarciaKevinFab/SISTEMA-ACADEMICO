# Contrato de Payload MINEDU - Especificación Técnica

## Resumen

Definición estricta de esquemas de datos para integración con MINEDU SIA/SIAGIE, incluyendo validaciones, mapeos y contratos de API.

## 1. Esquemas de Datos

### 1.1 Esquema de Matrícula (Enrollment)

#### Payload Local → MINEDU
```json
{
  "tipo": "matricula",
  "estudiante_id": "string(required, max:20)",
  "curso_id": "string(required, max:15)",
  "periodo_id": "string(required, format:YYYY-MM)",
  "fecha_matricula": "string(required, format:ISO8601)",
  "estado": "enum(required, values:[ACTIVE,COMPLETED,CANCELLED])",
  "creditos": "integer(required, min:1, max:8)",
  "tipo_matricula": "enum(optional, values:[PRIMERA_VEZ,REINGRESO,TRASLADO])",
  "modalidad": "enum(optional, values:[PRESENCIAL,VIRTUAL,SEMIPRESENCIAL])",
  "turno": "enum(optional, values:[MAÑANA,TARDE,NOCHE])"
}
```

#### Ejemplo Válido
```json
{
  "tipo": "matricula",
  "estudiante_id": "STU20240001",
  "curso_id": "MAT101",
  "periodo_id": "2024-02",
  "fecha_matricula": "2024-08-15T10:00:00Z",
  "estado": "ACTIVE",
  "creditos": 4,
  "tipo_matricula": "PRIMERA_VEZ",
  "modalidad": "PRESENCIAL",
  "turno": "MAÑANA"
}
```

#### Validaciones Obligatorias
- `estudiante_id`: DNI válido o código único institucional
- `curso_id`: Código de curso registrado en MINEDU
- `periodo_id`: Formato YYYY-MM, debe existir en calendario académico
- `fecha_matricula`: No puede ser futura ni anterior a inicio de período
- `creditos`: Debe coincidir con créditos del curso en plan de estudios

### 1.2 Esquema de Calificación (Grade)

#### Payload Local → MINEDU
```json
{
  "tipo": "calificacion",
  "estudiante_id": "string(required, max:20)",
  "curso_id": "string(required, max:15)",
  "periodo_id": "string(required, format:YYYY-MM)",
  "nota_numerica": "decimal(required, min:0, max:20, precision:1)",
  "nota_literal": "enum(required, values:[AD,A,B,C])",
  "estado": "enum(required, values:[APPROVED,FAILED,PENDING])",
  "fecha_evaluacion": "string(required, format:ISO8601)",
  "tipo_evaluacion": "enum(required, values:[CONTINUA,FINAL,RECUPERACION])",
  "observaciones": "string(optional, max:200)",
  "acta_cerrada": "boolean(required)",
  "fecha_cierre_acta": "string(optional, format:ISO8601)"
}
```

#### Tabla de Conversión Notas
| Rango Numérico | Literal | Estado |
|----------------|---------|---------|
| 18.0 - 20.0 | AD | APPROVED |
| 14.0 - 17.9 | A | APPROVED |
| 11.0 - 13.9 | B | APPROVED |
| 0.0 - 10.9 | C | FAILED |

#### Ejemplo Válido
```json
{
  "tipo": "calificacion",
  "estudiante_id": "STU20240001",
  "curso_id": "MAT101", 
  "periodo_id": "2024-02",
  "nota_numerica": 17.5,
  "nota_literal": "AD",
  "estado": "APPROVED",
  "fecha_evaluacion": "2024-12-15T16:00:00Z",
  "tipo_evaluacion": "FINAL",
  "observaciones": "Excelente desempeño",
  "acta_cerrada": true,
  "fecha_cierre_acta": "2024-12-20T10:00:00Z"
}
```

#### Validaciones Obligatorias
- `nota_numerica` debe coincidir con `nota_literal` según tabla de conversión
- `fecha_evaluacion` no puede ser anterior a fecha de matrícula
- Si `acta_cerrada=true`, `fecha_cierre_acta` es obligatoria
- Solo REGISTRAR/ADMIN_ACADEMIC pueden cerrar actas

### 1.3 Esquema de Certificado (Certificate)

#### Payload Local → MINEDU
```json
{
  "tipo": "certificado",
  "estudiante_id": "string(required, max:20)",
  "tipo_certificado": "enum(required, values:[NOTAS,ESTUDIOS,EGRESADO,TITULO])",
  "periodo_id": "string(required, format:YYYY-MM)",
  "fecha_emision": "string(required, format:ISO8601)",
  "numero_certificado": "string(required, unique, max:30)",
  "estado": "enum(required, values:[ISSUED,CANCELLED,EXPIRED])",
  "solicitante": "string(required, max:100)",
  "documento_solicitante": "string(required, max:15)",
  "motivo_solicitud": "string(optional, max:200)",
  "url_verificacion": "string(optional, format:URL)",
  "qr_code": "string(optional, base64)",
  "vigencia_dias": "integer(optional, min:1, max:365)"
}
```

#### Ejemplo Válido
```json
{
  "tipo": "certificado",
  "estudiante_id": "STU20240001",
  "tipo_certificado": "NOTAS",
  "periodo_id": "2024-02",
  "fecha_emision": "2024-12-20T14:00:00Z",
  "numero_certificado": "CERT-2024-001234",
  "estado": "ISSUED",
  "solicitante": "Juan Pérez García",
  "documento_solicitante": "12345678",
  "motivo_solicitud": "Postulación a universidad",
  "url_verificacion": "https://universidad.edu/verificar/CERT-2024-001234",
  "vigencia_dias": 90
}
```

## 2. Validaciones Pre-Envío

### 2.1 Validador de Matrícula
```python
def validate_enrollment_payload(payload: dict) -> tuple[bool, list[str]]:
    errors = []
    
    # Validar estudiante existe
    if not student_exists(payload.get('estudiante_id')):
        errors.append("Estudiante no encontrado")
    
    # Validar curso existe y está activo
    if not course_active(payload.get('curso_id')):
        errors.append("Curso no existe o inactivo")
    
    # Validar período académico
    if not period_valid(payload.get('periodo_id')):
        errors.append("Período académico inválido")
    
    # Validar créditos coinciden
    if not credits_match(payload.get('curso_id'), payload.get('creditos')):
        errors.append("Créditos no coinciden con plan de estudios")
    
    return len(errors) == 0, errors
```

### 2.2 Validador de Calificación
```python
def validate_grade_payload(payload: dict) -> tuple[bool, list[str]]:
    errors = []
    
    # Validar conversión nota numérica → literal
    if not grade_conversion_valid(
        payload.get('nota_numerica'), 
        payload.get('nota_literal')
    ):
        errors.append("Conversión de nota inválida")
    
    # Validar matrícula previa existe
    if not enrollment_exists(
        payload.get('estudiante_id'), 
        payload.get('curso_id'),
        payload.get('periodo_id')
    ):
        errors.append("Matrícula previa requerida")
    
    # Validar fecha evaluación en rango válido
    if not evaluation_date_valid(payload.get('fecha_evaluacion')):
        errors.append("Fecha de evaluación fuera de rango permitido")
    
    return len(errors) == 0, errors
```

### 2.3 Validador de Certificado
```python
def validate_certificate_payload(payload: dict) -> tuple[bool, list[str]]:
    errors = []
    
    # Validar número único
    if certificate_number_exists(payload.get('numero_certificado')):
        errors.append("Número de certificado ya existe")
    
    # Validar estudiante con requisitos cumplidos
    if not student_meets_requirements(
        payload.get('estudiante_id'),
        payload.get('tipo_certificado')
    ):
        errors.append("Estudiante no cumple requisitos para certificado")
    
    # Validar DNI solicitante
    if not dni_valid(payload.get('documento_solicitante')):
        errors.append("DNI de solicitante inválido")
    
    return len(errors) == 0, errors
```

## 3. Mapeo de Campos

### 3.1 Matrícula: Local → MINEDU
| Campo Local | Campo MINEDU | Transformación |
|-------------|--------------|----------------|
| `student_id` | `estudiante_id` | Directo |
| `course_id` | `curso_id` | Directo |
| `enrollment_date` | `fecha_matricula` | ISO8601 |
| `status` | `estado` | Mapeo enum |
| `credits` | `creditos` | Integer |

### 3.2 Calificación: Local → MINEDU
| Campo Local | Campo MINEDU | Transformación |
|-------------|--------------|----------------|
| `numerical_grade` | `nota_numerica` | Decimal(2,1) |
| `literal_grade` | `nota_literal` | Enum [AD,A,B,C] |
| `grade_status` | `estado` | Mapeo enum |
| `evaluation_date` | `fecha_evaluacion` | ISO8601 |

### 3.3 Certificado: Local → MINEDU
| Campo Local | Campo MINEDU | Transformación |
|-------------|--------------|----------------|
| `certificate_number` | `numero_certificado` | String único |
| `issued_date` | `fecha_emision` | ISO8601 |
| `certificate_type` | `tipo_certificado` | Enum |
| `status` | `estado` | Mapeo enum |

## 4. Contratos de Respuesta MINEDU

### 4.1 Respuesta Exitosa (200 OK)
```json
{
  "success": true,
  "message": "Datos recibidos correctamente",
  "transaction_id": "TXN-20240915-001234",
  "timestamp": "2024-09-15T10:30:00Z",
  "data": {
    "id_minedu": "MIN-202409-987654",
    "estado": "PROCESADO"
  }
}
```

### 4.2 Error de Validación (400 Bad Request)
```json
{
  "success": false,
  "error_code": "VALIDATION_ERROR",
  "message": "Errores de validación encontrados",
  "errors": [
    {
      "field": "nota_numerica",
      "message": "Valor debe estar entre 0 y 20"
    },
    {
      "field": "periodo_id", 
      "message": "Formato debe ser YYYY-MM"
    }
  ]
}
```

### 4.3 Error de Sistema (500 Internal Server Error)
```json
{
  "success": false,
  "error_code": "INTERNAL_ERROR",
  "message": "Error interno del servidor",
  "transaction_id": "TXN-20240915-001234",
  "retry_after": 300
}
```

## 5. Rechazos Locales

### 5.1 Campos Obligatorios Faltantes
```json
{
  "rejected": true,
  "reason": "MISSING_REQUIRED_FIELDS",
  "missing_fields": ["estudiante_id", "nota_numerica"],
  "message": "Los siguientes campos son obligatorios"
}
```

### 5.2 Mapeo Inválido
```json
{
  "rejected": true,
  "reason": "INVALID_MAPPING",
  "field": "nota_literal",
  "provided": "X",
  "expected": "AD, A, B, C",
  "message": "Valor de campo no válido según mapeo"
}
```

### 5.3 Validación de Negocio Fallida
```json
{
  "rejected": true,
  "reason": "BUSINESS_RULE_VIOLATION",
  "rule": "ENROLLMENT_REQUIRED",
  "message": "Estudiante debe estar matriculado para registrar calificación"
}
```

## 6. Configuración de Validadores

### 6.1 Parámetros de Validación
```python
VALIDATION_CONFIG = {
    "enrollment": {
        "required_fields": ["estudiante_id", "curso_id", "periodo_id", "fecha_matricula"],
        "max_credits": 8,
        "min_credits": 1,
        "valid_periods": ["2024-01", "2024-02", "2025-01", "2025-02"]
    },
    "grade": {
        "required_fields": ["estudiante_id", "curso_id", "nota_numerica", "nota_literal"],
        "grade_precision": 1,
        "max_grade": 20.0,
        "min_grade": 0.0
    },
    "certificate": {
        "required_fields": ["estudiante_id", "tipo_certificado", "numero_certificado"],
        "number_format": "CERT-YYYY-NNNNNN",
        "max_validity_days": 365
    }
}
```

### 6.2 Habilitación/Deshabilitación
```python
VALIDATION_ENABLED = {
    "pre_send_validation": True,
    "business_rules": True,
    "data_consistency": True,
    "strict_mode": False  # Rechaza warnings como errores
}
```

## 7. Logs de Validación

### 7.1 Log de Rechazo
```json
{
  "timestamp": "2024-09-15T10:30:00Z",
  "level": "WARNING",
  "event": "PAYLOAD_REJECTED",
  "entity_type": "grade",
  "entity_id": "STU001:MAT101",
  "reason": "INVALID_MAPPING",
  "details": {
    "field": "nota_literal",
    "provided": "X", 
    "expected": ["AD", "A", "B", "C"]
  }
}
```

### 7.2 Log de Validación Exitosa
```json
{
  "timestamp": "2024-09-15T10:30:00Z",
  "level": "INFO",
  "event": "PAYLOAD_VALIDATED",
  "entity_type": "enrollment",
  "entity_id": "STU001:MAT101",
  "validation_time_ms": 15
}
```

## Conclusión

Contrato de payload estricto que garantiza:
- ✅ **Validación pre-envío** con rechazos locales
- ✅ **Mapeos consistentes** entre sistemas
- ✅ **Esquemas documentados** para cada entidad
- ✅ **Contratos de respuesta** bien definidos
- ✅ **Configuración flexible** de validadores