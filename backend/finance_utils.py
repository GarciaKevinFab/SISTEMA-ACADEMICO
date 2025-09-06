import qrcode
import io
import base64
from datetime import datetime
from typing import Optional, Dict, Any
import uuid

def generate_qr_code(data: str) -> str:
    """Generate QR code and return as base64 string"""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(data)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    
    return base64.b64encode(buffer.getvalue()).decode()

def generate_receipt_number(series: str = "001") -> tuple[str, int]:
    """Generate receipt number with series and correlative"""
    # In a real implementation, this would get the next correlative from database
    correlative = int(datetime.now().strftime('%m%d%H%M%S'))
    receipt_number = f"REC-{series}-{correlative:08d}"
    return receipt_number, correlative

def calculate_weighted_average_cost(current_stock: int, current_cost: float, 
                                  new_quantity: int, new_cost: float) -> float:
    """Calculate weighted average cost for inventory"""
    if current_stock + new_quantity == 0:
        return 0.0
    
    total_value = (current_stock * current_cost) + (new_quantity * new_cost)
    total_quantity = current_stock + new_quantity
    
    return round(total_value / total_quantity, 4)

def validate_cash_session(session_data: Dict) -> tuple[bool, str]:
    """Validate cash session data"""
    if session_data.get('status') != 'OPEN':
        return False, "Cash session is not open"
    
    return True, "Valid"

def calculate_fifo_cost(movements: list, quantity_needed: int) -> tuple[float, list]:
    """Calculate FIFO cost for inventory exit"""
    remaining_quantity = quantity_needed
    total_cost = 0.0
    used_movements = []
    
    for movement in movements:
        if remaining_quantity <= 0:
            break
            
        available_qty = movement.get('available_quantity', 0)
        if available_qty <= 0:
            continue
            
        use_qty = min(remaining_quantity, available_qty)
        cost = movement.get('unit_cost', 0) * use_qty
        
        total_cost += cost
        remaining_quantity -= use_qty
        
        used_movements.append({
            'movement_id': movement.get('id'),
            'quantity_used': use_qty,
            'unit_cost': movement.get('unit_cost', 0)
        })
    
    if remaining_quantity > 0:
        return 0.0, []  # Not enough stock
    
    return total_cost, used_movements

async def log_audit_trail(db, table_name: str, record_id: str, action: str, 
                         old_values: Optional[Dict] = None, new_values: Optional[Dict] = None,
                         user_id: str = None, ip_address: str = None):
    """Log audit trail for any database change"""
    audit_log = {
        "id": str(uuid.uuid4()),
        "table_name": table_name,
        "record_id": record_id,
        "action": action,
        "old_values": old_values,
        "new_values": new_values,
        "user_id": user_id,
        "ip_address": ip_address,
        "timestamp": datetime.utcnow()
    }
    
    await db.audit_logs.insert_one(audit_log)

def format_currency(amount: float, currency: str = "PEN") -> str:
    """Format currency for display"""
    if currency == "PEN":
        return f"S/. {amount:,.2f}"
    elif currency == "USD":
        return f"$ {amount:,.2f}"
    else:
        return f"{amount:,.2f}"

def validate_receipt_data(receipt_data: Dict) -> tuple[bool, str]:
    """Validate receipt data before creation"""
    required_fields = ['concept', 'description', 'amount', 'customer_name', 'customer_document']
    
    for field in required_fields:
        if not receipt_data.get(field):
            return False, f"Field {field} is required"
    
    if receipt_data.get('amount', 0) <= 0:
        return False, "Amount must be greater than 0"
    
    if len(receipt_data.get('customer_document', '')) not in [8, 11]:
        return False, "Document must be 8 (DNI) or 11 (RUC) digits"
    
    return True, "Valid"

def get_next_correlative(db_collection, series: str = "001") -> int:
    """Get next correlative number for a series"""
    # This would be implemented with proper database queries
    # For now, using timestamp-based approach
    return int(datetime.now().strftime('%H%M%S'))