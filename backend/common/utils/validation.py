from django.core.exceptions import ValidationError

def validate_positive(value):
    if value < 0:
        raise ValidationError("El valor no puede ser negativo")
    return value

def validate_not_empty(value: str):
    if not value or not value.strip():
        raise ValidationError("El campo no puede estar vacío")
    return value
