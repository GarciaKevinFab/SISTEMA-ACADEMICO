import qrcode
import io
import base64
from datetime import datetime, date, timezone
from typing import Dict, Any, Optional, List
from reportlab.lib.pagesizes import A4, letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
import uuid

def generate_qr_code(data: str, size: int = 10) -> str:
    """Generate QR code as base64 string"""
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
    
    # Convert to base64
    img_data = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/png;base64,{img_data}"

def format_currency(amount: float, currency: str = "PEN") -> str:
    """Format currency amount"""
    symbol = "S/." if currency == "PEN" else "$"
    return f"{symbol} {amount:,.2f}"

def calculate_tax(subtotal: float, tax_rate: float = 0.18) -> float:
    """Calculate tax amount (IGV)"""
    return round(subtotal * tax_rate, 2)

def calculate_receipt_correlative(series: str, year: int) -> int:
    """Calculate next receipt correlative number"""
    # This would typically query the database for the last correlative
    # For now, return a UUID-based number
    return int(str(uuid.uuid4().int)[:8]) % 100000

def generate_receipt_number(series: str = "001", year: int = None) -> tuple[str, int]:
    """Generate receipt number and correlative"""
    if year is None:
        year = datetime.now().year
    
    correlative = calculate_receipt_correlative(series, year)
    receipt_number = f"{series}-{correlative:06d}"
    
    return receipt_number, correlative

def prepare_for_mongo(data: dict) -> dict:
    """Prepare data for MongoDB storage"""
    prepared = data.copy()
    
    # Convert date objects to ISO strings
    for key, value in prepared.items():
        if isinstance(value, date) and not isinstance(value, datetime):
            prepared[key] = value.isoformat()
        elif isinstance(value, datetime):
            prepared[key] = value.isoformat()
    
    return prepared

def parse_from_mongo(data: dict) -> dict:
    """Parse data from MongoDB"""
    parsed = data.copy()
    
    # This would contain logic to parse dates back from strings
    # Implementation depends on specific needs
    
    return parsed

def calculate_inventory_fifo(
    current_stock: int,
    inventory_movements: List[Dict[str, Any]],
    exit_quantity: int
) -> tuple[float, List[Dict[str, Any]]]:
    """
    Calculate FIFO cost for inventory exit
    Returns: (total_cost, cost_breakdown)
    """
    # Sort entries by date (FIFO - oldest first)
    entries = [m for m in inventory_movements if m.get('movement_type') == 'ENTRY']
    entries.sort(key=lambda x: x.get('created_at', ''))
    
    # Calculate remaining quantities for each entry by processing all previous exits
    exits = [m for m in inventory_movements if m.get('movement_type') == 'EXIT']
    exits.sort(key=lambda x: x.get('created_at', ''))
    
    # Track how much has been consumed from each entry
    entry_consumption = {}
    for entry in entries:
        entry_consumption[entry['id']] = 0
    
    # Process all previous exits to determine remaining quantities
    for exit_mov in exits:
        exit_qty = exit_mov.get('quantity', 0)
        temp_remaining = exit_qty
        
        for entry in entries:
            if temp_remaining <= 0:
                break
            
            entry_id = entry['id']
            entry_qty = entry.get('quantity', 0)
            already_consumed = entry_consumption.get(entry_id, 0)
            available_from_entry = entry_qty - already_consumed
            
            if available_from_entry <= 0:
                continue
                
            consume_from_entry = min(temp_remaining, available_from_entry)
            entry_consumption[entry_id] += consume_from_entry
            temp_remaining -= consume_from_entry
    
    # Now calculate cost for current exit
    remaining_to_exit = exit_quantity
    total_cost = 0.0
    cost_breakdown = []
    
    for entry in entries:
        if remaining_to_exit <= 0:
            break
            
        entry_id = entry['id']
        entry_qty = entry.get('quantity', 0)
        consumed = entry_consumption.get(entry_id, 0)
        available_quantity = entry_qty - consumed
        
        if available_quantity <= 0:
            continue
            
        exit_from_this_entry = min(remaining_to_exit, available_quantity)
        unit_cost = entry.get('unit_cost', 0)
        entry_cost = exit_from_this_entry * unit_cost
        
        total_cost += entry_cost
        cost_breakdown.append({
            'entry_id': entry_id,
            'entry_date': entry.get('created_at'),
            'quantity': exit_from_this_entry,
            'unit_cost': unit_cost,
            'total_cost': entry_cost
        })
        
        remaining_to_exit -= exit_from_this_entry
    
    return total_cost, cost_breakdown

def validate_ruc(ruc: str) -> bool:
    """Validate Peruvian RUC"""
    if not ruc or len(ruc) != 11 or not ruc.isdigit():
        return False
    
    # RUC validation algorithm (MOD 11)
    factors = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
    check_digit = int(ruc[10])
    
    total = sum(int(ruc[i]) * factors[i] for i in range(10))
    remainder = total % 11
    
    # Calculate check digit based on remainder
    if remainder < 2:
        calculated_check_digit = remainder
    else:
        calculated_check_digit = 11 - remainder
    
    return check_digit == calculated_check_digit

async def log_audit_trail(db, table_name: str, record_id: str, action: str, 
                         old_values: Optional[Dict] = None, new_values: Optional[Dict] = None,
                         user_id: str = None, ip_address: str = None, correlation_id: str = None):
    """Log immutable audit trail for any database change with data masking"""
    
    # Generate correlation ID if not provided
    if not correlation_id:
        correlation_id = str(uuid.uuid4())
    
    # Mask sensitive fields in old and new values
    sensitive_fields = [
        'password', 'token', 'secret', 'customer_document', 'document_number',
        'phone', 'email', 'address', 'bank_account', 'ruc'
    ]
    
    def mask_sensitive_data(data: Dict) -> Dict:
        if not data:
            return data
        
        masked_data = data.copy()
        for key, value in masked_data.items():
            if any(sensitive_field in key.lower() for sensitive_field in sensitive_fields):
                if isinstance(value, str) and len(value) > 4:
                    masked_data[key] = value[:2] + "*" * (len(value) - 4) + value[-2:]
                else:
                    masked_data[key] = "****"
        return masked_data
    
    # Create immutable audit log entry
    audit_log = {
        "id": str(uuid.uuid4()),
        "correlation_id": correlation_id,
        "table_name": table_name,
        "record_id": record_id,
        "action": action.upper(),
        "old_values": mask_sensitive_data(old_values) if old_values else None,
        "new_values": mask_sensitive_data(new_values) if new_values else None,
        "user_id": user_id,
        "ip_address": ip_address,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "is_immutable": True,  # Mark as immutable (append-only)
        "hash": None  # For integrity verification
    }
    
    # Generate hash for integrity verification
    import hashlib
    import json
    
    hashable_data = {
        "table_name": table_name,
        "record_id": record_id,
        "action": action,
        "user_id": user_id,
        "timestamp": audit_log["timestamp"]
    }
    
    hash_string = json.dumps(hashable_data, sort_keys=True)
    audit_log["hash"] = hashlib.sha256(hash_string.encode()).hexdigest()
    
    # Insert to audit logs (append-only, never update or delete)
    await db.audit_logs.insert_one(audit_log)
    
    return correlation_id

class PDFGenerator:
    """PDF generation utilities for financial documents"""
    
    def __init__(self):
        self.styles = getSampleStyleSheet()
        self.header_style = ParagraphStyle(
            'CustomHeader',
            parent=self.styles['Heading1'],
            fontSize=16,
            alignment=TA_CENTER,
            spaceAfter=30
        )
        self.normal_style = self.styles['Normal']
        self.bold_style = ParagraphStyle(
            'Bold',
            parent=self.styles['Normal'],
            fontName='Helvetica-Bold'
        )
    
    def create_receipt_pdf(
        self, 
        receipt_data: Dict[str, Any], 
        qr_code_data: str,
        output_path: str
    ) -> str:
        """Generate receipt PDF with QR code"""
        
        doc = SimpleDocTemplate(output_path, pagesize=A4)
        story = []
        
        # Header
        header = Paragraph(
            "INSTITUTO DE EDUCACIÓN SUPERIOR PEDAGÓGICO PÚBLICO<br/>"
            "\"GUSTAVO ALLENDE LLAVERÍA\"<br/>"
            "BOLETA INTERNA DE COBRO",
            self.header_style
        )
        story.append(header)
        story.append(Spacer(1, 20))
        
        # Receipt information
        info_data = [
            ['Número:', receipt_data.get('receipt_number', '')],
            ['Serie:', receipt_data.get('series', '')],
            ['Fecha:', receipt_data.get('issued_at', datetime.now()).strftime('%d/%m/%Y')],
            ['Cliente:', receipt_data.get('customer_name', '')],
            ['Documento:', receipt_data.get('customer_document', '')],
        ]
        
        info_table = Table(info_data, colWidths=[2*inch, 4*inch])
        info_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(info_table)
        story.append(Spacer(1, 20))
        
        # Details
        details_data = [
            ['CONCEPTO', 'DESCRIPCIÓN', 'IMPORTE'],
            [
                receipt_data.get('concept', ''),
                receipt_data.get('description', ''),
                format_currency(receipt_data.get('amount', 0))
            ]
        ]
        
        details_table = Table(details_data, colWidths=[2*inch, 3*inch, 1.5*inch])
        details_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(details_table)
        story.append(Spacer(1, 30))
        
        # Total
        total_data = [
            ['TOTAL A PAGAR:', format_currency(receipt_data.get('amount', 0))]
        ]
        total_table = Table(total_data, colWidths=[4.5*inch, 1.5*inch])
        total_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 12),
            ('BACKGROUND', (0, 0), (-1, -1), colors.lightgrey),
            ('BOX', (0, 0), (-1, -1), 2, colors.black),
        ]))
        story.append(total_table)
        story.append(Spacer(1, 30))
        
        # QR Code
        if qr_code_data:
            qr_img = Image(io.BytesIO(base64.b64decode(qr_code_data.split(',')[1])), 
                          width=1.5*inch, height=1.5*inch)
            qr_table = Table([[qr_img, 'Escanee para verificar']], colWidths=[2*inch, 4*inch])
            qr_table.setStyle(TableStyle([
                ('ALIGN', (0, 0), (0, 0), 'CENTER'),
                ('ALIGN', (1, 0), (1, 0), 'LEFT'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ]))
            story.append(qr_table)
        
        # Footer
        story.append(Spacer(1, 50))
        footer = Paragraph(
            "Este documento es válido como comprobante de pago interno.<br/>"
            "Para consultas: tesoreria@iesppgal.edu.pe",
            self.normal_style
        )
        story.append(footer)
        
        doc.build(story)
        return output_path

# Constants for financial operations
RECEIPT_SERIES_MAPPING = {
    "ENROLLMENT": "001",
    "TUITION": "002", 
    "CERTIFICATE": "003",
    "PROCEDURE": "004",
    "OTHER": "999"
}

TAX_RATES = {
    "IGV": 0.18,
    "RETENTION": 0.08,
    "PERCEPTION": 0.04
}

COST_CENTERS = {
    "ACADEMIC": "CC001",
    "ADMINISTRATIVE": "CC002", 
    "INFRASTRUCTURE": "CC003",
    "TECHNOLOGY": "CC004"
}