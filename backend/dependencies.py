from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorClient
from jose import JWTError, jwt
from dotenv import load_dotenv
from pathlib import Path
import os
import logging
import uuid
from datetime import datetime, timezone, timedelta

# Configuration and setup
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Database connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security setup
SECRET_KEY = os.environ.get("SECRET_KEY", "your-secret-key-here")
ALGORITHM = "HS256"
security = HTTPBearer()

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Authentication dependency
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"username": username})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        logger.error(f"Error getting current user: {str(e)}")
        raise HTTPException(status_code=401, detail="Authentication failed")

# Utility functions
def generate_tracking_code() -> str:
    """Generate unique tracking code for procedures"""
    timestamp = datetime.now().strftime('%Y%m%d')
    random_part = str(uuid.uuid4())[:8].upper()
    return f"IESPP-{timestamp}-{random_part}"

def calculate_deadline(processing_days: int) -> datetime:
    """Calculate deadline based on processing days (excluding weekends)"""
    current_date = datetime.now()
    days_added = 0
    while days_added < processing_days:
        current_date += timedelta(days=1)
        # Skip weekends (Saturday=5, Sunday=6)
        if current_date.weekday() < 5:
            days_added += 1
    return current_date

async def log_procedure_action(
    procedure_id: str, 
    action: str, 
    performed_by: str, 
    previous_status: str = None, 
    new_status: str = None, 
    comment: str = None,
    ip_address: str = None
):
    """Log procedure actions for audit trail"""
    from server import ProcedureLog  # Lazy import to avoid circular dependency
    
    log_entry = ProcedureLog(
        procedure_id=procedure_id,
        action=action,
        previous_status=previous_status,
        new_status=new_status,
        comment=comment,
        performed_by=performed_by,
        ip_address=ip_address
    )
    
    log_doc = log_entry.dict()
    await db.procedure_logs.insert_one(log_doc)
    return log_entry

async def send_procedure_notification(
    procedure_id: str,
    recipient_email: str,
    notification_type: str,
    subject: str,
    content: str
):
    """Send email notification and log it"""
    from server import NotificationLog  # Lazy import to avoid circular dependency
from safe_mongo_operations import safe_update_one, safe_update_many, safe_find_one_and_update, MongoUpdateError
    
    # En un entorno real, aquí se integraría con un servicio de email como SendGrid
    # Por ahora, solo registramos la notificación
    notification = NotificationLog(
        procedure_id=procedure_id,
        recipient_email=recipient_email,
        notification_type=notification_type,
        subject=subject,
        content=content,
        delivery_status="SENT"  # Simulamos envío exitoso
    )
    
    notification_doc = notification.dict()
    await db.notification_logs.insert_one(notification_doc)
    
    # Actualizar contador de notificaciones en el trámite
    await safe_update_one(db.procedures, 
        {"id": procedure_id},
        {
            "$inc": {"email_notifications_sent": 1},
            "$set": {"last_notification_sent": datetime.now(timezone.utc)}
        }
    )
    
    logger.info(f"Notification sent to {recipient_email} for procedure {procedure_id}")
    return notification