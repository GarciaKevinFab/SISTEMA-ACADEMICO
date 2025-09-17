from pydantic import BaseModel
from datetime import datetime

# Modelo base para procedimientos
class ProcedureBase(BaseModel):
    student_id: str
    procedure_type: str
    procedure_date: datetime = datetime.utcnow()
    status: str = "in_progress"  # Estado del procedimiento (e.g., in_progress, completed, pending)
    
# Modelo para la creación de un procedimiento
class ProcedureCreate(ProcedureBase):
    pass

# Modelo para la actualización de un procedimiento
class ProcedureUpdate(ProcedureBase):
    status: Optional[str] = None
    procedure_date: Optional[datetime] = None
# Modelo para representar la respuesta de un procedimiento
class ProcedureResponse(ProcedureBase):
    id: str

    class Config:
        orm_mode = True
