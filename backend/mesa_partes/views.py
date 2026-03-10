# mesa_partes/views.py
import os
import uuid
import datetime as dt
import io
import csv

from django.conf import settings
from django.db.models import F, Count, Avg, ExpressionWrapper, DurationField
from django.db.models.functions import TruncDate
from django.utils.dateparse import parse_date
from django.utils import timezone
from django.http import HttpResponse

from rest_framework import viewsets, mixins, status
from rest_framework.decorators import action, api_view, permission_classes, parser_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser

# ReportLab
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.colors import HexColor, white
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Table, TableStyle,
    Spacer, HRFlowable, Image,
)
from reportlab.graphics.barcode import qr as qr_module
from reportlab.graphics.shapes import Drawing

from .models import Office, ProcedureType, Procedure, ProcedureEvent, ProcedureFile
from .serializers import (
    OfficeSer, ProcedureTypeSer, ProcedureSer,
    ProcedureEventSer, ProcedureFileSer,
)

# ── Colores institucionales ──────────────────────────────────────────
C_SECTION   = HexColor("#1e40af")
C_TABLE_H   = HexColor("#dbeafe")
C_BORDER    = HexColor("#cbd5e1")
C_ACCENT    = HexColor("#1d4ed8")
C_DARK      = HexColor("#1e293b")
C_MUTED     = HexColor("#64748b")
C_ROW_ALT   = HexColor("#f8fafc")
C_GREEN_BG  = HexColor("#dcfce7")
C_GREEN_TXT = HexColor("#15803d")
C_AMBER_BG  = HexColor("#fef3c7")
C_AMBER_BD  = HexColor("#f59e0b")
C_AMBER_TXT = HexColor("#92400e")


def _track_code():
    return f"MP-{dt.datetime.now():%Y}-{uuid.uuid4().hex[:6].upper()}"


# ── Helpers PDF ──────────────────────────────────────────────────────

def _get_institution_data():
    defaults = {
        "name":      "IESPP \"GUSTAVO ALLENDE LLAVERÍA\"",
        "short_name":"IESPP GAL",
        "address":   "Tarma · Junín · Perú",
        "logo_path": None,
    }
    try:
        from catalogs.models import InstitutionSetting
        obj = InstitutionSetting.objects.filter(pk=1).first()
        if not obj or not obj.data:
            return defaults
        d = obj.data
        name       = d.get("name") or d.get("institution_name") or defaults["name"]
        short_name = d.get("short_name") or defaults["short_name"]
        address    = d.get("address") or d.get("city") or defaults["address"]
        logo_path  = None
        logo_url   = d.get("logo_url") or ""
        if logo_url:
            if "/media/" in logo_url:
                rel = logo_url.split("/media/")[-1]
                candidate = os.path.join(settings.MEDIA_ROOT, rel)
                if os.path.exists(candidate):
                    logo_path = candidate
            elif logo_url.startswith("/"):
                candidate = os.path.join(
                    settings.BASE_DIR if hasattr(settings, "BASE_DIR") else "",
                    logo_url.lstrip("/"),
                )
                if os.path.exists(candidate):
                    logo_path = candidate
        return {"name": name, "short_name": short_name, "address": address, "logo_path": logo_path}
    except Exception:
        return defaults


def _make_qr(url: str, size_cm: float = 3.2) -> Drawing:
    size = size_cm * cm
    qr_widget = qr_module.QrCodeWidget(url)
    qr_widget.barWidth  = size
    qr_widget.barHeight = size
    qr_widget.qrVersion = 1
    d = Drawing(size, size)
    d.add(qr_widget)
    return d


def _tracking_url(tracking_code: str, request=None) -> str:
    path = f"/public/procedures/track/{tracking_code}"
    if request is not None:
        try:
            return request.build_absolute_uri(path)
        except Exception:
            pass
    base = getattr(settings, "SITE_URL", "https://academico.iesppallende.edu.pe")
    return f"{base}{path}"


def _style(name, parent_styles, **kw):
    return ParagraphStyle(name, parent=parent_styles["Normal"], **kw)


def _section_header(label, page_w, s_sec):
    t = Table([[Paragraph(label, s_sec)]], colWidths=[page_w])
    t.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, -1), C_SECTION),
        ("TOPPADDING",   (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 4),
        ("LEFTPADDING",  (0, 0), (-1, -1), 8),
    ]))
    return t


def _data_table(rows, page_w, s_label, s_value, col1_w=5.5):
    w1 = col1_w * cm
    w2 = page_w - w1
    data = [
        [Paragraph(str(k), s_label), Paragraph(str(v) if v else "—", s_value)]
        for k, v in rows
    ]
    t = Table(data, colWidths=[w1, w2])
    ts = TableStyle([
        ("GRID",         (0, 0), (-1, -1), 0.4, C_BORDER),
        ("TOPPADDING",   (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 5),
        ("LEFTPADDING",  (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN",       (0, 0), (-1, -1), "MIDDLE"),
    ])
    for i in range(len(data)):
        if i % 2 == 1:
            ts.add("BACKGROUND", (0, i), (-1, i), C_ROW_ALT)
    t.setStyle(ts)
    return t


# ════════════════════════════════════════════════════════════════════
#   CARGO DE RECEPCIÓN  (modelo MINEDU)
# ════════════════════════════════════════════════════════════════════

def _build_cargo_pdf(p: Procedure, request=None) -> bytes:
    buf    = io.BytesIO()
    PAGE_W = A4[0] - 3.6 * cm

    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        rightMargin=1.8 * cm, leftMargin=1.8 * cm,
        topMargin=1.8 * cm,   bottomMargin=1.8 * cm,
    )
    styles = getSampleStyleSheet()

    def st(name, **kw):
        return _style(name, styles, **kw)

    s_inst   = st("inst",   fontSize=8,    textColor=C_MUTED,     alignment=TA_CENTER, leading=11)
    s_title  = st("title",  fontSize=16,   textColor=C_DARK,      fontName="Helvetica-Bold", alignment=TA_CENTER)
    s_code   = st("code",   fontSize=9,    textColor=C_MUTED,     alignment=TA_RIGHT)
    s_intro  = st("intro",  fontSize=9,    textColor=C_DARK,      leading=13, spaceAfter=2)
    s_sec    = st("sec",    fontSize=8,    textColor=white,       fontName="Helvetica-Bold", alignment=TA_CENTER)
    s_label  = st("label",  fontSize=8,    textColor=C_MUTED)
    s_value  = st("value",  fontSize=8.5,  textColor=C_DARK,      fontName="Helvetica-Bold")
    s_small  = st("small",  fontSize=7.5,  textColor=C_DARK,      leading=11)
    s_track  = st("track",  fontSize=22,   textColor=C_ACCENT,    fontName="Helvetica-Bold", alignment=TA_CENTER)
    s_status = st("status", fontSize=9,    textColor=C_GREEN_TXT, fontName="Helvetica-Bold", alignment=TA_CENTER)
    s_note   = st("note",   fontSize=7.5,  textColor=C_AMBER_TXT, leading=11)
    s_footer = st("footer", fontSize=7,    textColor=C_MUTED,     alignment=TA_CENTER)

    inst       = _get_institution_data()
    now_str    = (p.created_at or dt.datetime.now(tz=timezone.utc)).strftime("%d/%m/%Y %H:%M:%S")
    type_name  = getattr(p.procedure_type, "name", "—") if p.procedure_type else "—"
    office_nm  = getattr(p.current_office, "name", "MESA DE PARTES") if p.current_office else "MESA DE PARTES"
    asunto     = (p.description or "—").strip() or "—"
    doc_num    = p.applicant_document or "—"
    file_count = p.files.count() if hasattr(p, "files") else 0
    # ── Nuevos campos ──
    num_folios  = getattr(p, "num_folios", None)
    canal_map   = {"VIRTUAL": "Mesa de Partes Virtual", "PRESENCIAL": "Mesa de Partes Presencial",
                   "EMAIL": "Correo Electrónico", "FAXSIMIL": "Fax / Facsímil"}
    canal_lbl   = canal_map.get(getattr(p, "canal_ingreso", ""), "—")
    urgency_map = {"LOW": "Baja", "NORMAL": "Normal", "HIGH": "Alta", "URGENT": "Urgente"}
    urgency_lbl = urgency_map.get(getattr(p, "urgency_level", ""), "Normal")

    status_map = {
        "RECEIVED": "Recibido", "IN_REVIEW": "En Revisión",
        "APPROVED": "Aprobado", "REJECTED": "Rechazado", "COMPLETED": "Completado",
    }
    status_lbl = status_map.get(p.status, p.status or "—")
    track_url  = _tracking_url(p.tracking_code, request)

    story = []

    # 1. CABECERA
    logo_cell = ""
    if inst["logo_path"]:
        try:
            logo_img = Image(inst["logo_path"], width=1.8 * cm, height=1.8 * cm, kind="proportional")
            logo_cell = Table(
                [[logo_img, Paragraph(
                    f'<b>{inst["name"]}</b><br/>'
                    f'<font size="7" color="#64748b">{inst["address"]}</font>',
                    st("inst_name", fontSize=8, textColor=C_DARK, leading=11),
                )]],
                colWidths=[2.0 * cm, PAGE_W * 0.55 - 2.0 * cm],
            )
            logo_cell.setStyle(TableStyle([
                ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING",   (0, 0), (-1, -1), 0),
                ("RIGHTPADDING",  (0, 0), (-1, -1), 4),
                ("TOPPADDING",    (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]))
        except Exception:
            logo_cell = Paragraph(
                f'<b>{inst["name"]}</b><br/><font size="7">{inst["address"]}</font>', s_inst)
    else:
        logo_cell = Paragraph(
            f'<b>{inst["name"]}</b><br/><font size="7">{inst["address"]}</font>', s_inst)

    hdr = Table(
        [[logo_cell, Paragraph(f'Expediente: <b>{p.tracking_code}</b>', s_code)]],
        colWidths=[PAGE_W * 0.65, PAGE_W * 0.35],
    )
    hdr.setStyle(TableStyle([
        ("VALIGN",       (0, 0), (-1, -1), "MIDDLE"),
        ("LINEBELOW",    (0, 0), (-1, -1), 1, C_ACCENT),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 8),
    ]))
    story.append(hdr)
    story.append(Spacer(1, 10))

    # 2. Título
    story.append(Paragraph("Constancia de recepción", s_title))
    story.append(Spacer(1, 4))
    story.append(HRFlowable(width=PAGE_W, thickness=1.5, color=C_ACCENT))
    story.append(Spacer(1, 10))

    # 3. Saludo
    story.append(Paragraph(
        f"Estimado(a) ciudadano(a) <b>{p.applicant_name}</b>,", s_intro))
    story.append(Paragraph(
        f"Le comunicamos que su expediente N° <b>{p.tracking_code}</b> ha sido registrado "
        "satisfactoriamente con los siguientes datos:", s_intro))
    story.append(Spacer(1, 10))

    # 4. DATOS DEL SOLICITANTE
    story.append(_section_header("DATOS DEL SOLICITANTE", PAGE_W, s_sec))
    story.append(_data_table([
        ("Nombres y Apellidos", p.applicant_name),
        ("Número de Documento", doc_num),
        ("Correo Electrónico",  p.applicant_email or "—"),
        ("Celular",             p.applicant_phone or "—"),
    ], PAGE_W, s_label, s_value))
    story.append(Spacer(1, 8))

    # 5. DATOS DEL EXPEDIENTE
    story.append(_section_header("DATOS DEL EXPEDIENTE", PAGE_W, s_sec))
    story.append(_data_table([
        ("N° Expediente",            p.tracking_code),
        ("Fecha y hora de registro", now_str),
        ("Tipo de trámite",          type_name),
        ("Canal de ingreso",         canal_lbl),
        ("N° de folios / archivos",  f"{num_folios or '—'} folios / {file_count} archivo(s) digital(es)"),
        ("Entidad",                  inst["name"]),
        ("Oficina que recibe",       office_nm),
        ("Asunto",                   asunto),
        ("Nivel de urgencia",        urgency_lbl),
        ("Medio de notificación",    "BUZÓN ELECTRÓNICO"),
        ("Estado",                   status_lbl),
    ], PAGE_W, s_label, s_value))
    story.append(Spacer(1, 8))

    # 6. SEGUIMIENTO
    story.append(_section_header("SEGUIMIENTO DEL EXPEDIENTE", PAGE_W, s_sec))
    qr_size  = 3.2 * cm
    left_w   = PAGE_W - qr_size - 0.2 * cm
    seg_left = Paragraph(
        f'Ingresar al siguiente enlace (Opción 1):<br/>'
        f'<font color="#1d4ed8"><u>{track_url}</u></font><br/><br/>'
        f'Consignando el código de seguimiento:<br/><br/>'
        f'<b>Código:</b> {p.tracking_code}',
        s_small,
    )
    seg_right_label = Paragraph(
        "Utilizar este QR<br/>(Opción 2):",
        st("qrlbl", fontSize=7.5, textColor=C_MUTED, alignment=TA_CENTER),
    )
    qr_drawing = _make_qr(track_url, size_cm=3.2)
    qr_cell = Table([[seg_right_label], [qr_drawing]], colWidths=[qr_size])
    qr_cell.setStyle(TableStyle([
        ("ALIGN",        (0, 0), (-1, -1), "CENTER"),
        ("VALIGN",       (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",   (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 2),
    ]))
    seg_table = Table([[seg_left, qr_cell]], colWidths=[left_w, qr_size])
    seg_table.setStyle(TableStyle([
        ("GRID",          (0, 0), (-1, -1), 0.4, C_BORDER),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",    (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING",   (0, 0), (-1, -1), 8),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
    ]))
    story.append(seg_table)
    story.append(Spacer(1, 8))

    # Código grande
    track_t = Table([[Paragraph(p.tracking_code, s_track)]], colWidths=[PAGE_W])
    track_t.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, -1), C_TABLE_H),
        ("TOPPADDING",   (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 12),
    ]))
    story.append(track_t)
    story.append(Spacer(1, 6))

    # Badge de estado
    status_t = Table([[Paragraph(f"Estado actual: {status_lbl}", s_status)]], colWidths=[PAGE_W])
    status_t.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, -1), C_GREEN_BG),
        ("TOPPADDING",   (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 5),
        ("LINEABOVE",    (0, 0), (-1, 0), 0.8, HexColor("#86efac")),
        ("LINEBELOW",    (0,-1), (-1,-1), 0.8, HexColor("#86efac")),
    ]))
    story.append(status_t)
    story.append(Spacer(1, 14))

    # 7. NOTA IMPORTANTE
    note_t = Table([[Paragraph(
        "<b>NOTA IMPORTANTE:</b><br/>"
        "1.- La Mesa de Partes Virtual estará habilitada las veinticuatro (24) horas "
        "del día y los siete (07) días de la semana para la presentación de documentos.<br/>"
        "2.- El expediente presentado se sujeta a la verificación y eventual observación "
        "de los requisitos procedimentales, conforme a lo establecido en los artículos 124 "
        "y 136 del Texto Único Ordenado de la Ley N° 27444, Ley del Procedimiento "
        "Administrativo General.",
        s_note,
    )]], colWidths=[PAGE_W])
    note_t.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, -1), C_AMBER_BG),
        ("LINEABOVE",    (0, 0), (-1,  0), 1, C_AMBER_BD),
        ("LINEBELOW",    (0,-1), (-1, -1), 1, C_AMBER_BD),
        ("LINEBEFORE",   (0, 0), ( 0,-1), 3, C_AMBER_BD),
        ("TOPPADDING",   (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 8),
        ("LEFTPADDING",  (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(note_t)
    story.append(Spacer(1, 18))

    # 8. Firma
    story.append(Paragraph("Atentamente,", s_intro))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        f'<b>{inst["name"]}</b>',
        ParagraphStyle("firma", parent=styles["Normal"], fontSize=9,
                       textColor=C_DARK, fontName="Helvetica-Bold", leading=13),
    ))
    story.append(Spacer(1, 20))
    story.append(HRFlowable(width=PAGE_W, thickness=0.5, color=C_BORDER))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        f"Documento generado automáticamente el "
        f"{dt.datetime.now().strftime('%d/%m/%Y %H:%M:%S')} — "
        f"{inst['name']} · Mesa de Partes Virtual",
        s_footer,
    ))

    doc.build(story)
    buf.seek(0)
    return buf.read()


# ════════════════════════════════════════════════════════════════════
#   CARÁTULA (uso interno)
# ════════════════════════════════════════════════════════════════════

def _build_cover_pdf(p: Procedure, request=None) -> bytes:
    buf    = io.BytesIO()
    PAGE_W = A4[0] - 4 * cm

    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        rightMargin=2 * cm, leftMargin=2 * cm,
        topMargin=2 * cm,   bottomMargin=2 * cm,
    )
    styles = getSampleStyleSheet()

    def st(name, **kw):
        return _style(name, styles, **kw)

    s_title  = st("t",  fontSize=14, fontName="Helvetica-Bold", textColor=HexColor("#1e293b"), alignment=TA_CENTER)
    s_label  = st("l",  fontSize=8,  textColor=C_MUTED)
    s_value  = st("v",  fontSize=9,  fontName="Helvetica-Bold", textColor=C_DARK)
    s_sec    = st("s",  fontSize=8,  fontName="Helvetica-Bold", textColor=white, alignment=TA_CENTER)
    s_footer = st("f",  fontSize=7,  textColor=C_MUTED, alignment=TA_CENTER)
    s_code_r = st("cr", fontSize=9,  fontName="Helvetica-Bold", alignment=TA_RIGHT)

    inst       = _get_institution_data()
    now_str    = (p.created_at or dt.datetime.now(tz=timezone.utc)).strftime("%d/%m/%Y %H:%M")
    type_name  = getattr(p.procedure_type, "name", "—") if p.procedure_type else "—"
    office_nm  = getattr(p.current_office, "name", "MESA DE PARTES") if p.current_office else "MESA DE PARTES"
    assignee   = (
        getattr(p.assignee, "get_full_name", lambda: None)() or
        getattr(p.assignee, "username", "—")
    ) if p.assignee else "—"
    status_map = {
        "RECEIVED": "Recibido", "IN_REVIEW": "En Revisión",
        "APPROVED": "Aprobado", "REJECTED": "Rechazado", "COMPLETED": "Completado",
    }
    status_lbl  = status_map.get(p.status, p.status or "—")
    canal_map   = {"VIRTUAL": "Mesa de Partes Virtual", "PRESENCIAL": "Mesa de Partes Presencial",
                   "EMAIL": "Correo Electrónico", "FAXSIMIL": "Fax / Facsímil"}
    canal_lbl   = canal_map.get(getattr(p, "canal_ingreso", ""), "—")
    urgency_map = {"LOW": "Baja", "NORMAL": "Normal", "HIGH": "Alta", "URGENT": "Urgente"}
    urgency_lbl = urgency_map.get(getattr(p, "urgency_level", ""), "Normal")
    num_folios  = getattr(p, "num_folios", None)

    story = []

    hdr = Table(
        [[
            Paragraph(f'<b>{inst["name"]}</b><br/><font size="7">{inst["address"]}</font>', s_label),
            Paragraph(f'Código: <b>{p.tracking_code}</b>', s_code_r),
        ]],
        colWidths=[PAGE_W * 0.6, PAGE_W * 0.4],
    )
    hdr.setStyle(TableStyle([
        ("VALIGN",       (0, 0), (-1, -1), "MIDDLE"),
        ("LINEBELOW",    (0, 0), (-1, -1), 1.5, C_ACCENT),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 8),
    ]))
    story.append(hdr)
    story.append(Spacer(1, 12))
    story.append(Paragraph("CARÁTULA DE EXPEDIENTE", s_title))
    story.append(Spacer(1, 4))
    story.append(HRFlowable(width=PAGE_W, thickness=2, color=C_ACCENT))
    story.append(Spacer(1, 12))

    def sec(label):
        t = Table([[Paragraph(label, s_sec)]], colWidths=[PAGE_W])
        t.setStyle(TableStyle([
            ("BACKGROUND",   (0, 0), (-1, -1), C_SECTION),
            ("TOPPADDING",   (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING",(0, 0), (-1, -1), 4),
        ]))
        return t

    story.append(sec("DATOS DEL EXPEDIENTE"))
    story.append(_data_table([
        ("N° Expediente",     p.tracking_code),
        ("Tipo de trámite",   type_name),
        ("Canal de ingreso",  canal_lbl),
        ("N° de folios",      str(num_folios) if num_folios else "—"),
        ("Urgencia",          urgency_lbl),
        ("Estado",            status_lbl),
        ("Fecha de registro", now_str),
        ("Oficina actual",    office_nm),
        ("Responsable",       assignee),
        ("Descripción",       (p.description or "—")[:200]),
    ], PAGE_W, s_label, s_value))
    story.append(Spacer(1, 10))

    story.append(sec("DATOS DEL SOLICITANTE"))
    story.append(_data_table([
        ("Nombres y Apellidos", p.applicant_name),
        ("N° Documento",        p.applicant_document or "—"),
        ("Correo",              p.applicant_email or "—"),
        ("Celular",             p.applicant_phone or "—"),
    ], PAGE_W, s_label, s_value))
    story.append(Spacer(1, 30))
    story.append(HRFlowable(width=PAGE_W, thickness=0.5, color=C_BORDER))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        f"Generado el {dt.datetime.now().strftime('%d/%m/%Y %H:%M:%S')} — "
        f"{inst['name']} · Mesa de Partes Virtual",
        s_footer,
    ))

    doc.build(story)
    buf.seek(0)
    return buf.read()


# ════════════════════════════════════════════════════════════════════
#   CATÁLOGOS
# ════════════════════════════════════════════════════════════════════

class OfficeView(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAuthenticated]
    queryset           = Office.objects.all().order_by("name")
    serializer_class   = OfficeSer

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.query_params.get("active_only") == "1":
            qs = qs.filter(is_active=True)
        return qs


class UsersCatalogView(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        qs    = request.user.__class__.objects.filter(is_staff=True)
        users = [{"id": u.id, "full_name": (u.get_full_name() or u.username)} for u in qs]
        return Response({"users": users})


# ════════════════════════════════════════════════════════════════════
#   TIPOS DE TRÁMITE
# ════════════════════════════════════════════════════════════════════

class ProcedureTypeViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset           = ProcedureType.objects.all().order_by("name")
    serializer_class   = ProcedureTypeSer


# ════════════════════════════════════════════════════════════════════
#   TRÁMITES (PRIVADO)
# ════════════════════════════════════════════════════════════════════

class ProcedureViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = (
        Procedure.objects
        .select_related("procedure_type", "current_office", "assignee")
        .prefetch_related("files")
        .order_by("-created_at")
    )
    serializer_class = ProcedureSer

    def get_queryset(self):
        qs = super().get_queryset()
        p  = self.request.query_params
        # Filtros opcionales desde la URL
        status_f  = p.get("status")
        urgency_f = p.get("urgency_level")
        canal_f   = p.get("canal_ingreso")
        date_from = parse_date(p.get("date_from") or "")
        date_to   = parse_date(p.get("date_to") or "")
        overdue   = p.get("overdue")   # "1" → solo vencidos
        if status_f:   qs = qs.filter(status=status_f)
        if urgency_f:  qs = qs.filter(urgency_level=urgency_f)
        if canal_f:    qs = qs.filter(canal_ingreso=canal_f)
        if date_from:  qs = qs.filter(created_at__date__gte=date_from)
        if date_to:    qs = qs.filter(created_at__date__lte=date_to)
        if overdue == "1":
            qs = qs.filter(
                deadline_at__isnull=False,
                deadline_at__lt=timezone.now(),
            ).exclude(status__in=["COMPLETED", "REJECTED"])
        return qs

    def list(self, request, *args, **kwargs):
        qs   = self.get_queryset().prefetch_related("files")
        data = self.get_serializer(qs, many=True, context={"request": request}).data
        return Response({"procedures": data})

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        data["tracking_code"] = _track_code()
        ser = self.get_serializer(data=data)
        ser.is_valid(raise_exception=True)
        obj = ser.save()
        ProcedureEvent.objects.create(
            procedure=obj, type="CREATED",
            description="Trámite creado", actor=request.user
        )
        return Response({"procedure": self.get_serializer(obj).data}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"])
    def code(self, request):
        code = request.query_params.get("code")
        if not code:
            return Response({"detail": "code requerido"}, status=400)
        try:
            p = Procedure.objects.get(tracking_code=code)
        except Procedure.DoesNotExist:
            return Response(status=404)
        return Response({"procedure": self.get_serializer(p).data})

    @action(detail=True, methods=["get"])
    def timeline(self, request, pk=None):
        p   = self.get_object()
        evs = p.events.order_by("-at")
        return Response({"timeline": ProcedureEventSer(evs, many=True).data})

    @action(detail=True, methods=["post"])
    def route(self, request, pk=None):
        p = self.get_object()
        to_office_id = request.data.get("to_office_id")
        assignee_id  = request.data.get("assignee_id")
        note         = request.data.get("note", "")
        deadline     = request.data.get("deadline_at") or None
        if to_office_id:
            p.current_office_id = int(to_office_id)
        p.assignee_id = int(assignee_id) if assignee_id else None
        p.deadline_at = deadline
        p.save()
        ProcedureEvent.objects.create(
            procedure=p, type="ROUTED",
            description=note or "Derivado", actor=request.user
        )
        return Response({"ok": True})

    @action(detail=True, methods=["post"])
    def status(self, request, pk=None):
        p          = self.get_object()
        new_status = request.data.get("status")
        note       = request.data.get("note", "")
        if new_status:
            p.status = new_status
            p.save()
            ProcedureEvent.objects.create(
                procedure=p, type="STATUS_CHANGED",
                description=f"{new_status}. {note}", actor=request.user
            )
        return Response({"ok": True})

    @action(detail=True, methods=["post"], url_path="notes")
    def notes(self, request, pk=None):
        p    = self.get_object()
        note = request.data.get("note", "")
        if not note:
            return Response({"detail": "note requerido"}, status=400)
        ProcedureEvent.objects.create(
            procedure=p, type="NOTE", description=note, actor=request.user
        )
        return Response({"ok": True})

    @action(detail=True, methods=["post"], url_path="notify")
    def notify(self, request, pk=None):
        from django.core.mail import send_mail as django_send_mail

        p        = self.get_object()
        channels = request.data.get("channels", ["EMAIL"])
        subject  = (request.data.get("subject") or "").strip()
        message  = (request.data.get("message") or "").strip()

        if not subject:
            subject = f"Notificación sobre su trámite {p.tracking_code}"
        if not message:
            message = (
                f"Estimado(a) {p.applicant_name},\n\n"
                f"Le informamos sobre el estado de su trámite {p.tracking_code}."
            )

        results = {}

        # ── EMAIL ──
        if "EMAIL" in channels:
            to_email = (p.applicant_email or "").strip()
            if not to_email:
                results["email"] = "sin_correo"
            else:
                try:
                    django_send_mail(
                        subject=subject,
                        message=message,
                        from_email=settings.DEFAULT_FROM_EMAIL,
                        recipient_list=[to_email],
                        fail_silently=False,
                    )
                    results["email"] = "sent"
                except Exception as exc:
                    results["email"] = f"error: {exc}"
            # Log
            try:
                from notifications.models import NotificationLog
                NotificationLog.objects.create(
                    event_key="MP.NOTIFY", channel="EMAIL",
                    to=to_email,
                    subject=subject,
                    payload={"tracking_code": p.tracking_code, "message": message},
                    rendered={"subject": subject, "html": message},
                    status="SENT" if results.get("email") == "sent" else "ERROR",
                    error="" if results.get("email") == "sent" else str(results.get("email", "")),
                )
            except Exception:
                pass

        # ── SMS (requiere proveedor externo) ──
        if "SMS" in channels:
            results["sms"] = "no_provider"

        ProcedureEvent.objects.create(
            procedure=p, type="NOTIFIED",
            description=f"Canales: {', '.join(channels)}. Asunto: {subject}",
            actor=request.user,
        )
        return Response({"ok": True, "results": results})

    # ── Archivos ────────────────────────────────────────────────────
    @action(detail=True, methods=["get", "post"], url_path="files")
    def files(self, request, pk=None):
        p = self.get_object()
        if request.method == "GET":
            return Response({"files": ProcedureFileSer(
                p.files.all(), many=True, context={"request": request}
            ).data})
        f = request.FILES.get("file")
        if not f:
            return Response({"detail": "file requerido"}, status=400)
        pf = ProcedureFile.objects.create(
            procedure=p, file=f,
            original_name=getattr(f, "name", ""), size=f.size,
            doc_type=request.POST.get("doc_type", ""),
        )
        ProcedureEvent.objects.create(
            procedure=p, type="FILE_UPLOADED",
            description=pf.original_name, actor=request.user
        )
        return Response(ProcedureFileSer(pf).data, status=201)

    @action(detail=True, methods=["delete"], url_path=r"files/(?P<file_id>\d+)")
    def delete_file(self, request, pk=None, file_id=None):
        p = self.get_object()
        try:
            pf = p.files.get(id=file_id)
        except ProcedureFile.DoesNotExist:
            return Response(status=404)
        name = pf.original_name
        pf.file.delete(save=False)
        pf.delete()
        ProcedureEvent.objects.create(
            procedure=p, type="FILE_DELETED",
            description=name, actor=request.user
        )
        return Response(status=204)

    # ── PDFs ────────────────────────────────────────────────────────
    @action(detail=True, methods=["get", "post"], url_path="cover",
            permission_classes=[IsAuthenticated])
    def cover(self, request, pk=None):
        p = self.get_object()
        try:
            pdf_bytes = _build_cover_pdf(p, request=request)
        except Exception as e:
            return Response({"detail": f"Error generando PDF: {e}"}, status=500)
        resp = HttpResponse(pdf_bytes, content_type="application/pdf")
        resp["Content-Disposition"] = f'attachment; filename="caratula-{p.tracking_code}.pdf"'
        resp["Content-Length"]      = len(pdf_bytes)
        return resp

    @action(detail=True, methods=["get", "post"], url_path="cargo",
            permission_classes=[AllowAny])
    def cargo(self, request, pk=None):
        p = self.get_object()
        try:
            pdf_bytes = _build_cargo_pdf(p, request=request)
        except Exception as e:
            return Response({"detail": f"Error generando PDF: {e}"}, status=500)
        resp = HttpResponse(pdf_bytes, content_type="application/pdf")
        resp["Content-Disposition"] = f'attachment; filename="cargo-{p.tracking_code}.pdf"'
        resp["Content-Length"]      = len(pdf_bytes)
        return resp


# ════════════════════════════════════════════════════════════════════
#   DASHBOARD
# ════════════════════════════════════════════════════════════════════

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    now     = timezone.now()
    soon    = now + dt.timedelta(days=2)
    pending = Procedure.objects.exclude(status__in=["COMPLETED", "REJECTED"])

    # avg_processing_time real (segundos → días)
    completed = Procedure.objects.filter(status="COMPLETED")
    avg_days  = 0
    if completed.exists():
        total_secs = sum(
            (p.updated_at - p.created_at).total_seconds()
            for p in completed.values_list("created_at", "updated_at", named=True)
        )
        avg_days = round(total_secs / completed.count() / 86400, 1)

    overdue      = pending.filter(deadline_at__isnull=False, deadline_at__lt=now).count()
    near_deadline = pending.filter(
        deadline_at__isnull=False,
        deadline_at__gte=now,
        deadline_at__lte=soon,
    ).count()

    completed_today = Procedure.objects.filter(
        status="COMPLETED", updated_at__date=dt.date.today()
    ).count()

    return Response({"stats": {
        "pending_procedures":  pending.count(),
        "completed_today":     completed_today,
        "avg_processing_time": avg_days,
        "procedure_types":     ProcedureType.objects.count(),
        "overdue":             overdue,
        "near_deadline":       near_deadline,
    }})


# ════════════════════════════════════════════════════════════════════
#   PÚBLICO
# ════════════════════════════════════════════════════════════════════

@api_view(["GET"])
@permission_classes([AllowAny])
def public_procedure_types(request):
    qs = ProcedureType.objects.filter(is_active=True).order_by("name")
    return Response({"procedure_types": ProcedureTypeSer(qs, many=True).data})


@api_view(["POST"])
@permission_classes([AllowAny])
def public_create(request):
    data                  = request.data.copy()
    data["tracking_code"] = _track_code()
    ser = ProcedureSer(data=data)
    ser.is_valid(raise_exception=True)
    p = ser.save()
    ProcedureEvent.objects.create(
        procedure=p, type="CREATED_PUBLIC",
        description=f"Ingreso por {data.get('canal_ingreso', 'VIRTUAL')}"
    )
    return Response({"procedure": ProcedureSer(p).data}, status=201)


@api_view(["POST"])
@permission_classes([AllowAny])
@parser_classes([MultiPartParser, FormParser])
def public_upload_file(request, code):
    try:
        p = Procedure.objects.get(tracking_code=code)
    except Procedure.DoesNotExist:
        return Response(status=404)
    f = request.FILES.get("file")
    if not f:
        return Response({"detail": "file requerido"}, status=400)
    pf = ProcedureFile.objects.create(
        procedure=p, file=f,
        original_name=getattr(f, "name", ""), size=f.size,
        doc_type=request.POST.get("doc_type", ""),
    )
    ProcedureEvent.objects.create(
        procedure=p, type="FILE_UPLOADED_PUBLIC",
        description=pf.original_name
    )
    return Response(ProcedureFileSer(pf).data, status=201)


@api_view(["GET"])
@permission_classes([AllowAny])
def public_track(request):
    code = (request.GET.get("code") or "").strip()
    if not code:
        return Response({"detail": "code requerido"}, status=400)
    try:
        p = Procedure.objects.select_related(
            "procedure_type", "current_office", "assignee"
        ).get(tracking_code=code)
    except Procedure.DoesNotExist:
        return Response(status=404)
    data             = ProcedureSer(p).data
    data["timeline"] = ProcedureEventSer(p.events.order_by("-at"), many=True).data
    # Incluir archivos para que el tracking los muestre
    data["files"]    = ProcedureFileSer(p.files.all(), many=True, context={"request": request}).data
    return Response({"procedure": data})


# ════════════════════════════════════════════════════════════════════
#   REPORTES
# ════════════════════════════════════════════════════════════════════

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def procedures_summary(request):
    qs           = Procedure.objects.all()
    q            = request.query_params
    d_from       = parse_date(q.get("from") or "")
    d_to         = parse_date(q.get("to") or "")
    status_param = q.get("status")

    if d_from:        qs = qs.filter(created_at__date__gte=d_from)
    if d_to:          qs = qs.filter(created_at__date__lte=d_to)
    if status_param:  qs = qs.filter(status=status_param)

    total = qs.count()
    if total > 0:
        rows     = list(qs.values_list("created_at", "updated_at"))
        avg_days = round(sum((u - c).total_seconds() for c, u in rows) / total / 86400, 2)
    else:
        avg_days = None

    now          = timezone.now()
    overdue      = qs.filter(deadline_at__isnull=False, deadline_at__lt=F("updated_at")).exclude(status="COMPLETED").count()
    in_review    = qs.filter(status="IN_REVIEW").count()
    open_count   = qs.exclude(status__in=["COMPLETED", "REJECTED"]).count()
    sla_breached = qs.filter(deadline_at__isnull=False, deadline_at__lt=now).exclude(status__in=["COMPLETED", "REJECTED"]).count()

    # Desglose por estado
    by_status = [
        {"name": r["status"], "value": r["count"]}
        for r in qs.values("status").annotate(count=Count("id")).order_by("-count")
    ]
    # Desglose por tipo de trámite
    by_type = [
        {"name": r["procedure_type__name"] or "Sin tipo", "value": r["count"]}
        for r in qs.values("procedure_type__name").annotate(count=Count("id")).order_by("-count")[:10]
    ]
    # Desglose por canal de ingreso
    by_canal = [
        {"name": r["canal_ingreso"] or "—", "value": r["count"]}
        for r in qs.values("canal_ingreso").annotate(count=Count("id")).order_by("-count")
    ] if hasattr(Procedure, "canal_ingreso") else []

    since = now.date() - dt.timedelta(days=29)
    trend = [
        {"date": str(r["d"]), "value": r["count"]}
        for r in qs.filter(created_at__date__gte=since)
            .annotate(d=TruncDate("created_at"))
            .values("d").annotate(count=Count("id")).order_by("d")
    ]

    return Response({
        "summary":   {
            "total": total, "avg_days": avg_days, "overdue": overdue,
            "in_review": in_review, "open": open_count, "sla_breached": sla_breached,
        },
        "dashboard": {
            "total": total, "open": open_count, "sla_breached": sla_breached,
            "by_status": by_status, "by_type": by_type, "by_canal": by_canal, "trend": trend,
        },
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def procedures_report_sla(request):
    """Exporta datos SLA en CSV real."""
    buf = io.StringIO()
    w   = csv.writer(buf)
    w.writerow(["procedure_id", "tracking_code", "tipo", "estado", "fecha_registro",
                "fecha_actualizacion", "dias_transcurridos", "plazo", "vencido"])
    now = timezone.now()
    for p in Procedure.objects.select_related("procedure_type").all()[:2000]:
        dias = round((p.updated_at - p.created_at).total_seconds() / 86400, 1)
        vencido = "Sí" if (p.deadline_at and p.deadline_at < now
                           and p.status not in ["COMPLETED", "REJECTED"]) else "No"
        w.writerow([
            p.id, p.tracking_code,
            getattr(p.procedure_type, "name", "—") if p.procedure_type else "—",
            p.status, p.created_at.strftime("%d/%m/%Y %H:%M") if p.created_at else "—",
            p.updated_at.strftime("%d/%m/%Y %H:%M") if p.updated_at else "—",
            dias,
            p.deadline_at.strftime("%d/%m/%Y") if p.deadline_at else "—",
            vencido,
        ])
    out = buf.getvalue().encode("utf-8-sig")   # UTF-8 con BOM para Excel
    res = HttpResponse(out, content_type="text/csv; charset=utf-8-sig")
    res["Content-Disposition"] = 'attachment; filename="sla.csv"'
    return res


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def procedures_report_volume(request):
    """Exporta volumen diario en CSV real."""
    buf = io.StringIO()
    w   = csv.writer(buf)
    w.writerow(["fecha", "tipo_tramite", "canal_ingreso", "cantidad"])
    rows = (
        Procedure.objects
        .select_related("procedure_type")
        .annotate(d=TruncDate("created_at"))
        .values("d", "procedure_type__name", "canal_ingreso")
        .annotate(count=Count("id"))
        .order_by("-d")[:2000]
    )
    for r in rows:
        w.writerow([
            str(r["d"]) if r["d"] else "—",
            r["procedure_type__name"] or "Sin tipo",
            r["canal_ingreso"] or "—",
            r["count"],
        ])
    out = buf.getvalue().encode("utf-8-sig")
    res = HttpResponse(out, content_type="text/csv; charset=utf-8-sig")
    res["Content-Disposition"] = 'attachment; filename="volumen.csv"'
    return res


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_procedures(request):
    qs = Procedure.objects.select_related("procedure_type").order_by("-created_at")
    if hasattr(Procedure, "created_by"):
        qs = qs.filter(created_by=request.user)
    else:
        qs = qs.filter(applicant_email=request.user.email)
    return Response([{
        "type":    str(p.procedure_type) if p.procedure_type else "Trámite",
        "code":    p.tracking_code or str(p.id),
        "status":  p.status or "",
        "date":    str(p.created_at.date()) if p.created_at else "",
        "subject": getattr(p, "subject", getattr(p, "applicant_name", "")),
    } for p in qs[:10]])