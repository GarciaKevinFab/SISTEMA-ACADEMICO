from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import uuid

# Import from dependencies to avoid circular imports
from dependencies import get_current_user, db, logger

portal_router = APIRouter(prefix="/api/portal", tags=["Institutional Portal"])

# News and Announcements Management
@portal_router.get("/news")
async def get_news(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=50),
    category: Optional[str] = Query(None)
):
    """Get institutional news and announcements (public endpoint)"""
    try:
        # Build query
        query = {"is_published": True}
        
        if category and category != 'ALL':
            query["category"] = category
        
        # Get news
        news_cursor = db.news.find(query).sort("published_date", -1).skip(skip).limit(limit)
        news = await news_cursor.to_list(length=limit)
        
        total = await db.news.count_documents(query)
        
        return {
            "news": news,
            "total": total,
            "skip": skip,
            "limit": limit
        }
        
    except Exception as e:
        logger.error(f"Error fetching news: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al obtener noticias")

@portal_router.post("/news")
async def create_news(news_data: dict, current_user = Depends(get_current_user)):
    """Create news article (admin only)"""
    try:
        # Check permissions
        if current_user['role'] not in ['ADMIN']:
            raise HTTPException(status_code=403, detail="No autorizado para crear noticias")
        
        # Create news article
        news = {
            "id": str(uuid.uuid4()),
            "title": news_data['title'],
            "content": news_data['content'],
            "excerpt": news_data.get('excerpt', news_data['content'][:200] + "..."),
            "category": news_data.get('category', 'GENERAL'),
            "author": current_user['full_name'],
            "author_id": current_user['id'],
            "featured_image": news_data.get('featured_image'),
            "is_published": news_data.get('is_published', False),
            "published_date": datetime.now(timezone.utc).isoformat() if news_data.get('is_published') else None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "tags": news_data.get('tags', []),
            "views": 0
        }
        
        await db.news.insert_one(news)
        
        logger.info(f"News article created: {news['title']} by {current_user['username']}")
        return news
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating news: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al crear noticia")

# Public Admission Calls
@portal_router.get("/public/admission-calls")
async def get_public_admission_calls():
    """Get public admission calls with basic information"""
    try:
        # Get active admission calls
        calls = await db.admission_calls.find({
            "is_active": True,
            "registration_end": {"$gte": datetime.now(timezone.utc).isoformat()}
        }).sort("registration_start", 1).to_list(length=None)
        
        # Prepare public information (remove sensitive data)
        public_calls = []
        for call in calls:
            public_call = {
                "id": call['id'],
                "name": call['name'],
                "description": call['description'],
                "academic_year": call['academic_year'],
                "academic_period": call['academic_period'],
                "registration_start": call['registration_start'],
                "registration_end": call['registration_end'],
                "exam_date": call.get('exam_date'),
                "results_date": call.get('results_date'),
                "application_fee": call.get('application_fee', 0),
                "available_careers": call.get('available_careers', []),
                "career_vacancies": call.get('career_vacancies', {}),
                "minimum_age": call.get('minimum_age', 16),
                "maximum_age": call.get('maximum_age', 35),
                "required_documents": call.get('required_documents', [])
            }
            public_calls.append(public_call)
        
        # Get careers information
        career_ids = []
        for call in public_calls:
            career_ids.extend(call.get('available_careers', []))
        
        if career_ids:
            careers = await db.careers.find({"id": {"$in": career_ids}}).to_list(length=None)
            careers_dict = {c['id']: c for c in careers}
            
            # Enrich calls with career information
            for call in public_calls:
                call['careers'] = [careers_dict.get(cid) for cid in call.get('available_careers', []) if cid in careers_dict]
        
        return {
            "admission_calls": public_calls,
            "total": len(public_calls)
        }
        
    except Exception as e:
        logger.error(f"Error fetching public admission calls: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al obtener convocatorias públicas")

# Contact Messages
@portal_router.post("/contact")
async def submit_contact_message(contact_data: dict):
    """Submit contact form message (public endpoint)"""
    try:
        # Validate required fields
        required_fields = ['name', 'email', 'subject', 'message']
        for field in required_fields:
            if not contact_data.get(field):
                raise HTTPException(status_code=400, detail=f"El campo {field} es requerido")
        
        # Create contact message
        contact = {
            "id": str(uuid.uuid4()),
            "name": contact_data['name'],
            "surname": contact_data.get('surname', ''),
            "email": contact_data['email'],
            "phone": contact_data.get('phone'),
            "subject": contact_data['subject'],
            "message": contact_data['message'],
            "status": "NEW",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "response": None,
            "responded_at": None,
            "responded_by": None
        }
        
        await db.contact_messages.insert_one(contact)
        
        logger.info(f"Contact message submitted: {contact['subject']} from {contact['email']}")
        
        return {
            "message": "Mensaje enviado exitosamente. Nos pondremos en contacto pronto.",
            "contact_id": contact['id']
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting contact message: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al enviar mensaje")

@portal_router.get("/contact/messages")
async def get_contact_messages(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status: Optional[str] = Query(None),
    current_user = Depends(get_current_user)
):
    """Get contact messages (admin only)"""
    try:
        # Check permissions
        if current_user['role'] not in ['ADMIN']:
            raise HTTPException(status_code=403, detail="No autorizado para ver mensajes")
        
        # Build query
        query = {}
        if status and status != 'ALL':
            query["status"] = status
        
        # Get messages
        messages_cursor = db.contact_messages.find(query).sort("created_at", -1).skip(skip).limit(limit)
        messages = await messages_cursor.to_list(length=limit)
        
        total = await db.contact_messages.count_documents(query)
        
        return {
            "messages": messages,
            "total": total,
            "skip": skip,
            "limit": limit
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching contact messages: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al obtener mensajes")

# Institutional Information
@portal_router.get("/info/programs")
async def get_programs_info():
    """Get public programs information"""
    try:
        # Get active careers
        careers = await db.careers.find({"is_active": True}).sort("name", 1).to_list(length=None)
        
        # Prepare public information
        programs = []
        for career in careers:
            program = {
                "id": career['id'],
                "code": career['code'],
                "name": career['name'],
                "description": career['description'],
                "duration_years": career['duration_years'],
                "modality": career.get('modality', 'Presencial'),
                "degree_type": career.get('degree_type', 'Pedagógico'),
                "requirements": career.get('requirements', []),
                "career_profile": career.get('career_profile', ''),
                "job_opportunities": career.get('job_opportunities', [])
            }
            programs.append(program)
        
        return {
            "programs": programs,
            "total": len(programs)
        }
        
    except Exception as e:
        logger.error(f"Error fetching programs info: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al obtener información de programas")

@portal_router.get("/info/statistics")
async def get_institutional_statistics():
    """Get public institutional statistics"""
    try:
        # Calculate basic statistics
        total_students = await db.students.count_documents({"status": "ENROLLED"})
        total_teachers = await db.users.count_documents({"role": "TEACHER", "is_active": True})
        total_graduates = await db.students.count_documents({"status": "GRADUATED"})
        total_programs = await db.careers.count_documents({"is_active": True})
        
        # Calculate years of experience (since 1985)
        current_year = datetime.now().year
        years_experience = current_year - 1985
        
        # Mock employment rate (in real scenario, this would come from surveys)
        employment_rate = 98
        
        stats = {
            "years_experience": years_experience,
            "total_students": total_students,
            "total_teachers": total_teachers,
            "total_graduates": total_graduates,
            "total_programs": total_programs,
            "employment_rate": employment_rate,
            "accredited_programs": total_programs  # Assuming all are accredited
        }
        
        return {"statistics": stats}
        
    except Exception as e:
        logger.error(f"Error fetching institutional statistics: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al obtener estadísticas institucionales")

# Document Verification
@portal_router.get("/verify/{document_id}")
async def verify_document(document_id: str):
    """Public document verification endpoint"""
    try:
        # Try to find document in different collections
        
        # Check receipts
        receipt = await db.receipts.find_one({"id": document_id})
        if receipt:
            return {
                "valid": True,
                "document_type": "RECEIPT",
                "document_id": document_id,
                "details": {
                    "number": receipt['receipt_number'],
                    "date": receipt['created_at'],
                    "amount": receipt['total_amount'],
                    "status": receipt['status']
                }
            }
        
        # Check certificates from Mesa de Partes
        certificate = await db.procedure_certificates.find_one({"document_id": document_id})
        if certificate:
            return {
                "valid": True,
                "document_type": "CERTIFICATE",
                "document_id": document_id,
                "details": {
                    "procedure_code": certificate['procedure_code'],
                    "issued_date": certificate['issued_date'],
                    "status": certificate['status']
                }
            }
        
        # Check academic transcripts
        transcript = await db.academic_transcripts.find_one({"document_id": document_id})
        if transcript:
            return {
                "valid": True,
                "document_type": "TRANSCRIPT",
                "document_id": document_id,
                "details": {
                    "student_name": transcript['student_name'],
                    "issued_date": transcript['issued_date'],
                    "status": transcript['status']
                }
            }
        
        return {
            "valid": False,
            "document_type": None,
            "document_id": document_id,
            "details": None
        }
        
    except Exception as e:
        logger.error(f"Error verifying document {document_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al verificar documento")

# Portal Configuration
@portal_router.get("/config")
async def get_portal_config():
    """Get portal configuration (public settings)"""
    try:
        config = {
            "institution": {
                "name": "Instituto de Educación Superior Pedagógico Público",
                "short_name": "IESPP",
                "full_name": "Gustavo Allende Llavería",
                "logo": "/api/placeholder/200/100",
                "established_year": 1985
            },
            "contact": {
                "address": "Jr. Ancash 123, Cercado de Lima, Lima 15001, Perú",
                "phones": ["(01) 426-2573", "(01) 426-2574"],
                "emails": ["informes@iesppgal.edu.pe", "admision@iesppgal.edu.pe"],
                "website": "https://www.iesppgal.edu.pe",
                "business_hours": {
                    "weekdays": "8:00 AM - 6:00 PM",
                    "saturdays": "8:00 AM - 1:00 PM",
                    "sundays": "Cerrado"
                }
            },
            "social_media": {
                "facebook": "https://facebook.com/iesppgal",
                "instagram": "https://instagram.com/iesppgal",
                "linkedin": "https://linkedin.com/school/iesppgal",
                "youtube": "https://youtube.com/c/iesppgal"
            },
            "features": {
                "online_admissions": True,
                "virtual_procedures": True,
                "digital_library": True,
                "student_portal": True,
                "document_verification": True
            }
        }
        
        return {"config": config}
        
    except Exception as e:
        logger.error(f"Error fetching portal config: {str(e)}")
        raise HTTPException(status_code=500, detail="Error al obtener configuración del portal")