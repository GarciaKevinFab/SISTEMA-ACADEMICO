#!/usr/bin/env python3
"""
Finance Reports Generator
Generates PDF and CSV reports for the Finance module
"""

import asyncio
import os
from datetime import datetime, date, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from reportlab.lib.pagesizes import A4, letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
import csv
from typing import Dict, List, Any, Optional
import argparse

# Load environment variables
load_dotenv()

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017/iespp_system')

class FinanceReportsGenerator:
    """Generate various finance reports"""
    
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
        
    async def connect_db(self):
        """Connect to MongoDB"""
        self.client = AsyncIOMotorClient(MONGO_URL)
        self.db = self.client.get_default_database()
    
    async def close_db(self):
        """Close MongoDB connection"""
        self.client.close()
    
    def format_currency(self, amount: float, currency: str = "PEN") -> str:
        """Format currency amount"""
        symbol = "S/." if currency == "PEN" else "$"
        return f"{symbol} {amount:,.2f}"
    
    async def generate_cash_flow_report(self, start_date: date, end_date: date, output_path: str):
        """Generate cash flow report"""
        
        print(f"📊 Generating Cash Flow Report ({start_date} to {end_date})")
        
        # Get cash movements in date range
        movements = await self.db.cash_movements.find({
            "created_at": {
                "$gte": start_date.isoformat(),
                "$lte": end_date.isoformat()
            }
        }).sort("created_at", 1).to_list(1000)
        
        # Get receipts in date range
        receipts = await self.db.receipts.find({
            "issued_at": {
                "$gte": start_date.isoformat(),
                "$lte": end_date.isoformat()
            },
            "status": "PAID"
        }).to_list(1000)
        
        # Create PDF
        doc = SimpleDocTemplate(output_path, pagesize=A4)
        story = []
        
        # Header
        header = Paragraph(
            "INSTITUTO DE EDUCACIÓN SUPERIOR PEDAGÓGICO PÚBLICO<br/>"
            "\"GUSTAVO ALLENDE LLAVERÍA\"<br/>"
            f"REPORTE DE FLUJO DE CAJA<br/>"
            f"Del {start_date.strftime('%d/%m/%Y')} al {end_date.strftime('%d/%m/%Y')}",
            self.header_style
        )
        story.append(header)
        story.append(Spacer(1, 30))
        
        # Cash movements summary
        total_income = sum(m.get('amount', 0) for m in movements if m.get('movement_type') == 'INCOME')
        total_expense = sum(m.get('amount', 0) for m in movements if m.get('movement_type') == 'EXPENSE')
        receipts_income = sum(r.get('amount', 0) for r in receipts)
        
        summary_data = [
            ['CONCEPTO', 'MONTO'],
            ['Ingresos por Caja', self.format_currency(total_income)],
            ['Ingresos por Boletas', self.format_currency(receipts_income)],
            ['Total Ingresos', self.format_currency(total_income + receipts_income)],
            ['Egresos por Caja', self.format_currency(total_expense)],
            ['Flujo Neto', self.format_currency(total_income + receipts_income - total_expense)]
        ]
        
        summary_table = Table(summary_data, colWidths=[4*inch, 2*inch])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 12),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(summary_table)
        story.append(Spacer(1, 30))
        
        # Movements detail
        if movements:
            story.append(Paragraph("DETALLE DE MOVIMIENTOS DE CAJA", self.styles['Heading2']))
            story.append(Spacer(1, 12))
            
            movements_data = [['FECHA', 'TIPO', 'CONCEPTO', 'MONTO']]
            for movement in movements:
                movement_date = datetime.fromisoformat(movement['created_at']).strftime('%d/%m/%Y')
                movement_type = 'Ingreso' if movement['movement_type'] == 'INCOME' else 'Egreso'
                movements_data.append([
                    movement_date,
                    movement_type,
                    movement.get('concept', ''),
                    self.format_currency(movement.get('amount', 0))
                ])
            
            movements_table = Table(movements_data, colWidths=[1.5*inch, 1.5*inch, 2.5*inch, 1.5*inch])
            movements_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            story.append(movements_table)
        
        doc.build(story)
        print(f"✅ Cash Flow Report saved to: {output_path}")
    
    async def generate_receipts_report(self, start_date: date, end_date: date, output_path: str):
        """Generate receipts report"""
        
        print(f"🧾 Generating Receipts Report ({start_date} to {end_date})")
        
        # Get receipts in date range
        receipts = await self.db.receipts.find({
            "issued_at": {
                "$gte": start_date.isoformat(),
                "$lte": end_date.isoformat()
            }
        }).sort("issued_at", -1).to_list(1000)
        
        # Create PDF
        doc = SimpleDocTemplate(output_path, pagesize=A4)
        story = []
        
        # Header
        header = Paragraph(
            "INSTITUTO DE EDUCACIÓN SUPERIOR PEDAGÓGICO PÚBLICO<br/>"
            "\"GUSTAVO ALLENDE LLAVERÍA\"<br/>"
            f"REPORTE DE BOLETAS INTERNAS<br/>"
            f"Del {start_date.strftime('%d/%m/%Y')} al {end_date.strftime('%d/%m/%Y')}",
            self.header_style
        )
        story.append(header)
        story.append(Spacer(1, 30))
        
        # Summary by status
        status_summary = {}
        concept_summary = {}
        total_amount = 0
        
        for receipt in receipts:
            status = receipt.get('status', 'UNKNOWN')
            concept = receipt.get('concept', 'UNKNOWN')
            amount = receipt.get('amount', 0)
            
            status_summary[status] = status_summary.get(status, 0) + 1
            concept_summary[concept] = concept_summary.get(concept, 0) + amount
            
            if status == 'PAID':
                total_amount += amount
        
        # Status summary table
        status_data = [['ESTADO', 'CANTIDAD']]
        for status, count in status_summary.items():
            status_label = {
                'PENDING': 'Pendiente',
                'PAID': 'Pagado', 
                'CANCELLED': 'Anulado',
                'REFUNDED': 'Reembolsado'
            }.get(status, status)
            status_data.append([status_label, str(count)])
        
        status_table = Table(status_data, colWidths=[3*inch, 2*inch])
        status_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 11),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(status_table)
        story.append(Spacer(1, 20))
        
        # Concept summary table
        story.append(Paragraph("INGRESOS POR CONCEPTO", self.styles['Heading3']))
        concept_data = [['CONCEPTO', 'MONTO TOTAL']]
        for concept, amount in concept_summary.items():
            concept_label = {
                'ENROLLMENT': 'Matrícula',
                'TUITION': 'Pensión',
                'CERTIFICATE': 'Certificado',
                'PROCEDURE': 'Trámite',
                'ACADEMIC_SERVICES': 'Servicios Académicos',
                'OTHER': 'Otros'
            }.get(concept, concept)
            concept_data.append([concept_label, self.format_currency(amount)])
        
        concept_table = Table(concept_data, colWidths=[3*inch, 2*inch])
        concept_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 11),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(concept_table)
        story.append(Spacer(1, 20))
        
        # Total
        story.append(Paragraph(f"TOTAL RECAUDADO: {self.format_currency(total_amount)}", 
                              self.styles['Heading2']))
        
        doc.build(story)
        print(f"✅ Receipts Report saved to: {output_path}")
    
    async def generate_inventory_valuation_report(self, output_path: str):
        """Generate inventory valuation report"""
        
        print("📦 Generating Inventory Valuation Report")
        
        # Get all active inventory items
        items = await self.db.inventory_items.find({
            "is_active": True
        }).sort("category", 1).to_list(1000)
        
        # Create PDF
        doc = SimpleDocTemplate(output_path, pagesize=A4)
        story = []
        
        # Header
        header = Paragraph(
            "INSTITUTO DE EDUCACIÓN SUPERIOR PEDAGÓGICO PÚBLICO<br/>"
            "\"GUSTAVO ALLENDE LLAVERÍA\"<br/>"
            f"REPORTE DE VALORIZACIÓN DE INVENTARIO<br/>"
            f"Fecha: {datetime.now().strftime('%d/%m/%Y')}",
            self.header_style
        )
        story.append(header)
        story.append(Spacer(1, 30))
        
        # Group by category
        categories = {}
        for item in items:
            category = item.get('category', 'Sin Categoría')
            if category not in categories:
                categories[category] = []
            categories[category].append(item)
        
        total_value = 0
        
        for category, category_items in categories.items():
            story.append(Paragraph(f"CATEGORÍA: {category.upper()}", self.styles['Heading3']))
            story.append(Spacer(1, 12))
            
            items_data = [['CÓDIGO', 'DESCRIPCIÓN', 'STOCK', 'COSTO UNIT.', 'VALOR TOTAL']]
            category_value = 0
            
            for item in category_items:
                stock = item.get('current_stock', 0)
                unit_cost = item.get('unit_cost', 0)
                item_value = stock * unit_cost
                category_value += item_value
                
                items_data.append([
                    item.get('code', ''),
                    item.get('name', ''),
                    str(stock),
                    self.format_currency(unit_cost),
                    self.format_currency(item_value)
                ])
            
            # Add category total
            items_data.append(['', '', '', 'SUBTOTAL:', self.format_currency(category_value)])
            
            items_table = Table(items_data, colWidths=[1*inch, 3*inch, 1*inch, 1.5*inch, 1.5*inch])
            items_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('BACKGROUND', (-2, -1), (-1, -1), colors.lightgrey),
                ('FONTNAME', (-2, -1), (-1, -1), 'Helvetica-Bold'),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            story.append(items_table)
            story.append(Spacer(1, 20))
            
            total_value += category_value
        
        # Grand total
        story.append(Paragraph(f"VALOR TOTAL DEL INVENTARIO: {self.format_currency(total_value)}", 
                              self.styles['Heading2']))
        
        doc.build(story)
        print(f"✅ Inventory Valuation Report saved to: {output_path}")
    
    async def export_data_to_csv(self, table_name: str, output_path: str, filters: Dict = None):
        """Export data to CSV"""
        
        print(f"📄 Exporting {table_name} to CSV")
        
        # Get collection
        collection = getattr(self.db, table_name)
        
        # Apply filters if provided
        query = filters or {}
        
        # Get data
        data = await collection.find(query).to_list(10000)
        
        if not data:
            print(f"⚠️ No data found for {table_name}")
            return
        
        # Write CSV
        with open(output_path, 'w', newline='', encoding='utf-8') as csvfile:
            if data:
                fieldnames = data[0].keys()
                writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                writer.writeheader()
                
                for row in data:
                    # Convert datetime objects to strings
                    clean_row = {}
                    for key, value in row.items():
                        if isinstance(value, datetime):
                            clean_row[key] = value.isoformat()
                        else:
                            clean_row[key] = value
                    writer.writerow(clean_row)
        
        print(f"✅ CSV export saved to: {output_path}")

async def main():
    """Main function to generate reports"""
    
    parser = argparse.ArgumentParser(description='Generate Finance Reports')
    parser.add_argument('--report', choices=['cash-flow', 'receipts', 'inventory', 'export'], 
                       required=True, help='Type of report to generate')
    parser.add_argument('--start-date', type=str, help='Start date (YYYY-MM-DD)')
    parser.add_argument('--end-date', type=str, help='End date (YYYY-MM-DD)')
    parser.add_argument('--output', type=str, help='Output file path')
    parser.add_argument('--table', type=str, help='Table name for export')
    
    args = parser.parse_args()
    
    # Initialize generator
    generator = FinanceReportsGenerator()
    await generator.connect_db()
    
    try:
        if args.report == 'cash-flow':
            start_date = date.fromisoformat(args.start_date) if args.start_date else date.today() - timedelta(days=30)
            end_date = date.fromisoformat(args.end_date) if args.end_date else date.today()
            output_path = args.output or f"/tmp/cash_flow_report_{datetime.now().strftime('%Y%m%d')}.pdf"
            
            await generator.generate_cash_flow_report(start_date, end_date, output_path)
            
        elif args.report == 'receipts':
            start_date = date.fromisoformat(args.start_date) if args.start_date else date.today() - timedelta(days=30)
            end_date = date.fromisoformat(args.end_date) if args.end_date else date.today()
            output_path = args.output or f"/tmp/receipts_report_{datetime.now().strftime('%Y%m%d')}.pdf"
            
            await generator.generate_receipts_report(start_date, end_date, output_path)
            
        elif args.report == 'inventory':
            output_path = args.output or f"/tmp/inventory_valuation_{datetime.now().strftime('%Y%m%d')}.pdf"
            await generator.generate_inventory_valuation_report(output_path)
            
        elif args.report == 'export':
            if not args.table:
                print("❌ Table name is required for export")
                return
                
            output_path = args.output or f"/tmp/{args.table}_export_{datetime.now().strftime('%Y%m%d')}.csv"
            await generator.export_data_to_csv(args.table, output_path)
        
    finally:
        await generator.close_db()

if __name__ == "__main__":
    asyncio.run(main())