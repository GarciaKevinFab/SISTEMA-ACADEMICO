from app.models.procedure import ProcedureCreate, ProcedureUpdate, ProcedureResponse
from app.db import db
from typing import List, Optional

class ProcedureService:
    
    @staticmethod
    async def create_procedure(procedure: ProcedureCreate) -> ProcedureResponse:
        procedure_dict = procedure.dict()
        new_procedure = await db.procedures.insert_one(procedure_dict)
        return ProcedureResponse(id=str(new_procedure.inserted_id), **procedure_dict)

    @staticmethod
    async def get_procedure(procedure_id: str) -> Optional[ProcedureResponse]:
        procedure = await db.procedures.find_one({"_id": procedure_id})
        if procedure:
            return ProcedureResponse(id=str(procedure["_id"]), **procedure)
        return None

    @staticmethod
    async def update_procedure(procedure_id: str, procedure: ProcedureUpdate) -> Optional[ProcedureResponse]:
        updated_procedure = await db.procedures.find_one_and_update(
            {"_id": procedure_id},
            {"$set": procedure.dict(exclude_unset=True)},
            return_document=True
        )
        if updated_procedure:
            return ProcedureResponse(id=str(updated_procedure["_id"]), **updated_procedure)
        return None

    @staticmethod
    async def delete_procedure(procedure_id: str) -> bool:
        result = await db.procedures.delete_one({"_id": procedure_id})
        return result.deleted_count > 0

    @staticmethod
    async def get_all_procedures(skip: int = 0, limit: int = 10) -> List[ProcedureResponse]:
        procedures = []
        async for procedure in db.procedures.find().skip(skip).limit(limit):
            procedures.append(ProcedureResponse(id=str(procedure["_id"]), **procedure))
        return procedures
# Additional functions to help in procedure related operations can go here.
# You can add more complex business logic or helpers to deal with procedures.
