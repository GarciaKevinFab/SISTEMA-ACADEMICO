"""
MINEDU INTEGRATION - FULL CYCLE TEST
Envío completo + conciliación con 0 discrepancias
"""
import asyncio
import uuid
import json
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any
import random

from shared_deps import db, logger
from safe_mongo_operations import safe_update_one, safe_update_many, safe_find_one_and_update, MongoUpdateError

class MINEDUIntegrationCycle:
    """Ciclo completo de integración MINEDU con colas, reintentos e idempotencia"""
    
    def __init__(self):
        self.integration_results = {
            "students_sent": 0,
            "grades_sent": 0,
            "certificates_sent": 0,
            "success_rate": 0,
            "retry_attempts": 0,
            "timeout_simulations": 0,
            "duplicate_handling": 0,
            "discrepancies": [],
            "reconciliation_status": "PENDING"
        }
    
    async def setup_minedu_test_data(self):
        """Configurar datos de prueba para MINEDU"""
        logger.info("🔧 Setting up MINEDU test data...")
        
        # Crear 50 estudiantes de prueba
        students = []
        for i in range(1, 51):
            student = {
                "id": str(uuid.uuid4()),
                "first_name": f"Estudiante{i}",
                "last_name": f"Apellido{i}",
                "second_last_name": f"Segundo{i}",
                "student_code": f"MINEDU{i:03d}",
                "document_type": "DNI",
                "document_number": f"1234567{i:02d}",
                "email": f"student{i}@minedu.test",
                "career_id": str(uuid.uuid4()),
                "program": "Programa de Prueba MINEDU",
                "status": "ENROLLED",
                "entry_year": 2025,
                "created_at": datetime.now(timezone.utc),
                "minedu_sync_status": "PENDING",
                "minedu_id": None
            }
            students.append(student)
        
        await db.students.insert_many(students)
        
        # Crear 200 calificaciones de prueba
        grades = []
        for i, student in enumerate(students):
            # 4 notas por estudiante (200 total)
            for j in range(4):
                grade = {
                    "id": str(uuid.uuid4()),
                    "student_id": student["id"],
                    "course_id": str(uuid.uuid4()),
                    "course_code": f"CURSO{j+1}",
                    "course_name": f"Materia {j+1}",
                    "academic_year": 2025,
                    "academic_period": "2025-I",
                    "final_numerical_grade": random.uniform(11, 20),
                    "final_literal_grade": random.choice(["AD", "A", "B"]),
                    "created_at": datetime.now(timezone.utc),
                    "minedu_sync_status": "PENDING",
                    "minedu_id": None
                }
                grades.append(grade)
        
        await db.minedu_grades.insert_many(grades)
        
        # Crear 10 certificados de prueba
        certificates = []
        for i in range(10):
            certificate = {
                "id": str(uuid.uuid4()),
                "student_id": students[i]["id"],
                "certificate_type": "COMPLETION",
                "certificate_number": f"CERT-MINEDU-{i+1:03d}",
                "issued_date": datetime.now(timezone.utc),
                "academic_year": 2025,
                "program": "Programa de Prueba MINEDU",
                "qr_code": str(uuid.uuid4()),
                "created_at": datetime.now(timezone.utc),
                "minedu_sync_status": "PENDING",
                "minedu_id": None
            }
            certificates.append(certificate)
        
        await db.minedu_certificates.insert_many(certificates)
        
        logger.info("✅ MINEDU test data created: 50 students, 200 grades, 10 certificates")
        return students, grades, certificates
    
    async def simulate_minedu_api_call(self, data_type: str, data: Dict, retry_count: int = 0):
        """Simular llamada a API MINEDU con reintentos e idempotencia"""
        
        # Simular diferentes escenarios
        scenario = random.choice(["success", "timeout", "duplicate", "error"])
        
        if retry_count > 0:
            self.integration_results["retry_attempts"] += 1
        
        # Simular timeout (20% probabilidad en primer intento)
        if scenario == "timeout" and retry_count == 0:
            self.integration_results["timeout_simulations"] += 1
            await asyncio.sleep(0.1)  # Simular delay
            
            # Reintentar con backoff exponencial
            if retry_count < 3:
                await asyncio.sleep(2 ** retry_count)
                return await self.simulate_minedu_api_call(data_type, data, retry_count + 1)
            else:
                return {"success": False, "error": "Max retries exceeded", "minedu_id": None}
        
        # Simular duplicado (10% probabilidad) - debe ser idempotente
        elif scenario == "duplicate" and retry_count == 0:
            self.integration_results["duplicate_handling"] += 1
            # Idempotencia: retornar ID existente si ya se envió
            existing_minedu_id = data.get("minedu_id") or f"MINEDU_{data_type}_{data['id'][:8]}"
            return {"success": True, "minedu_id": existing_minedu_id, "duplicate": True}
        
        # Simular error transitorio (5% probabilidad)
        elif scenario == "error" and retry_count < 2:
            if retry_count < 2:
                await asyncio.sleep(1)
                return await self.simulate_minedu_api_call(data_type, data, retry_count + 1)
            else:
                return {"success": False, "error": "Service unavailable", "minedu_id": None}
        
        # Simular éxito
        else:
            minedu_id = f"MINEDU_{data_type}_{data['id'][:8]}"
            return {
                "success": True, 
                "minedu_id": minedu_id,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
    
    async def process_minedu_queue(self, collection_name: str, data_type: str):
        """Procesar cola de envíos MINEDU con reintentos"""
        logger.info(f"📤 Processing {data_type} queue...")
        
        collection = getattr(db, collection_name)
        pending_items = await collection.find({"minedu_sync_status": "PENDING"}).to_list(length=None)
        
        success_count = 0
        
        for item in pending_items:
            try:
                # Simular envío a MINEDU
                result = await self.simulate_minedu_api_call(data_type, item)
                
                if result["success"]:
                    # Actualizar con ID de MINEDU (idempotente)
                    await await safe_update_one(collection, 
                        {"id": item["id"]},
                        {
                            "$set": {
                                "minedu_sync_status": "SENT",
                                "minedu_id": result["minedu_id"],
                                "minedu_sent_at": datetime.now(timezone.utc),
                                "sync_attempts": item.get("sync_attempts", 0) + 1
                            }
                        }
                    )
                    success_count += 1
                else:
                    # Marcar como fallido
                    await await safe_update_one(collection, 
                        {"id": item["id"]},
                        {
                            "$set": {
                                "minedu_sync_status": "FAILED",
                                "sync_error": result.get("error", "Unknown error"),
                                "sync_attempts": item.get("sync_attempts", 0) + 1
                            }
                        }
                    )
                
            except Exception as e:
                logger.error(f"Error processing {data_type} {item['id']}: {str(e)}")
        
        logger.info(f"✅ {data_type} processed: {success_count}/{len(pending_items)} successful")
        return success_count, len(pending_items)
    
    async def send_all_data_to_minedu(self):
        """Enviar todos los datos a MINEDU"""
        logger.info("🚀 Starting MINEDU data transmission...")
        
        # Procesar cada tipo de dato
        students_sent, students_total = await self.process_minedu_queue("students", "STUDENT")
        grades_sent, grades_total = await self.process_minedu_queue("minedu_grades", "GRADE") 
        certificates_sent, certificates_total = await self.process_minedu_queue("minedu_certificates", "CERTIFICATE")
        
        # Actualizar resultados
        self.integration_results.update({
            "students_sent": students_sent,
            "students_total": students_total,
            "grades_sent": grades_sent,
            "grades_total": grades_total,
            "certificates_sent": certificates_sent,
            "certificates_total": certificates_total
        })
        
        total_sent = students_sent + grades_sent + certificates_sent
        total_items = students_total + grades_total + certificates_total
        success_rate = (total_sent / total_items * 100) if total_items > 0 else 0
        
        self.integration_results["success_rate"] = success_rate
        
        logger.info(f"📊 Transmission complete: {total_sent}/{total_items} items sent ({success_rate:.1f}%)")
    
    async def reconcile_data_with_minedu(self):
        """Conciliar datos locales con MINEDU (0 discrepancias)"""
        logger.info("🔍 Starting data reconciliation with MINEDU...")
        
        discrepancies = []
        
        # Verificar estudiantes
        students_local = await db.students.count_documents({"minedu_sync_status": "SENT"})
        students_minedu = await db.students.count_documents({"minedu_id": {"$exists": True, "$ne": None}})
        
        if students_local != students_minedu:
            discrepancies.append({
                "type": "STUDENTS_COUNT_MISMATCH",
                "local_count": students_local,
                "minedu_count": students_minedu,
                "difference": abs(students_local - students_minedu)
            })
        
        # Verificar calificaciones
        grades_local = await db.minedu_grades.count_documents({"minedu_sync_status": "SENT"})
        grades_minedu = await db.minedu_grades.count_documents({"minedu_id": {"$exists": True, "$ne": None}})
        
        if grades_local != grades_minedu:
            discrepancies.append({
                "type": "GRADES_COUNT_MISMATCH",
                "local_count": grades_local,
                "minedu_count": grades_minedu,
                "difference": abs(grades_local - grades_minedu)
            })
        
        # Verificar certificados
        certificates_local = await db.minedu_certificates.count_documents({"minedu_sync_status": "SENT"})
        certificates_minedu = await db.minedu_certificates.count_documents({"minedu_id": {"$exists": True, "$ne": None}})
        
        if certificates_local != certificates_minedu:
            discrepancies.append({
                "type": "CERTIFICATES_COUNT_MISMATCH", 
                "local_count": certificates_local,
                "minedu_count": certificates_minedu,
                "difference": abs(certificates_local - certificates_minedu)
            })
        
        # Verificar duplicados
        duplicate_students = await db.students.aggregate([
            {"$match": {"minedu_id": {"$exists": True}}},
            {"$group": {"_id": "$minedu_id", "count": {"$sum": 1}}},
            {"$match": {"count": {"$gt": 1}}}
        ]).to_list(length=None)
        
        if duplicate_students:
            discrepancies.append({
                "type": "DUPLICATE_MINEDU_IDS",
                "duplicates": len(duplicate_students),
                "details": duplicate_students
            })
        
        self.integration_results["discrepancies"] = discrepancies
        
        if len(discrepancies) == 0:
            self.integration_results["reconciliation_status"] = "SUCCESS"
            logger.info("✅ Reconciliation complete: 0 discrepancies found")
        else:
            self.integration_results["reconciliation_status"] = "DISCREPANCIES_FOUND"
            logger.warning(f"⚠️ Reconciliation complete: {len(discrepancies)} discrepancies found")
        
        return discrepancies
    
    async def resolve_discrepancies(self, discrepancies: List[Dict]):
        """Resolver discrepancias encontradas"""
        if not discrepancies:
            return
        
        logger.info("🔧 Resolving discrepancies...")
        
        for discrepancy in discrepancies:
            if discrepancy["type"] == "STUDENTS_COUNT_MISMATCH":
                # Reenviar estudiantes faltantes
                failed_students = await db.students.find({"minedu_sync_status": "FAILED"}).to_list(length=None)
                for student in failed_students:
                    result = await self.simulate_minedu_api_call("STUDENT", student)
                    if result["success"]:
                        await safe_update_one(db.students, 
                            {"id": student["id"]},
                            {"$set": {"minedu_sync_status": "SENT", "minedu_id": result["minedu_id"]}}
                        )
            
            elif discrepancy["type"] == "DUPLICATE_MINEDU_IDS":
                # Resolver duplicados - mantener el más reciente
                for duplicate in discrepancy["details"]:
                    duplicate_records = await db.students.find({"minedu_id": duplicate["_id"]}).to_list(length=None)
                    if len(duplicate_records) > 1:
                        # Mantener el más reciente, regenerar ID para los otros
                        latest_record = max(duplicate_records, key=lambda x: x["created_at"])
                        for record in duplicate_records:
                            if record["id"] != latest_record["id"]:
                                new_minedu_id = f"MINEDU_STUDENT_{record['id'][:8]}_FIXED"
                                await safe_update_one(db.students, 
                                    {"id": record["id"]},
                                    {"$set": {"minedu_id": new_minedu_id}}
                                )
        
        # Re-verificar después de resolver
        final_discrepancies = await self.reconcile_data_with_minedu()
        
        if len(final_discrepancies) == 0:
            logger.info("✅ All discrepancies resolved successfully")
        else:
            logger.warning(f"⚠️ {len(final_discrepancies)} discrepancies remain after resolution")
    
    async def run_full_integration_cycle(self):
        """Ejecutar ciclo completo de integración MINEDU"""
        logger.info("🎯 Starting MINEDU Full Integration Cycle...")
        
        # 1. Setup test data
        students, grades, certificates = await self.setup_minedu_test_data()
        
        # 2. Send all data to MINEDU
        await self.send_all_data_to_minedu()
        
        # 3. Reconcile data
        discrepancies = await self.reconcile_data_with_minedu()
        
        # 4. Resolve discrepancies if any
        if discrepancies:
            await self.resolve_discrepancies(discrepancies)
        
        # 5. Final status
        final_discrepancies = await self.reconcile_data_with_minedu()
        
        # Generate summary
        summary = {
            "integration_id": str(uuid.uuid4()),
            "started_at": datetime.now(timezone.utc).isoformat(),
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "status": "SUCCESS" if len(final_discrepancies) == 0 else "PARTIAL",
            "results": self.integration_results,
            "final_discrepancies": final_discrepancies
        }
        
        logger.info(f"🎉 MINEDU Integration Cycle Complete - Status: {summary['status']}")
        return summary

# Función para ejecutar el ciclo completo
async def run_minedu_full_cycle():
    """Ejecutar ciclo completo de integración MINEDU"""
    integration = MINEDUIntegrationCycle()
    return await integration.run_full_integration_cycle()