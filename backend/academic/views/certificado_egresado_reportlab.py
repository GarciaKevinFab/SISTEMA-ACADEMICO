"""
certificado_egresado_reportlab.py
═══════════════════════════════════════════════════════════════
Certificado de Egresado — diseño fiel al certificado oficial SIAA
IESPP "Gustavo Allende Llavería", pero mejorado.

Generado 100% con ReportLab canvas (sin dependencia de WeasyPrint),
por lo que funciona igual en desarrollo y en producción.

Layout (A4 vertical):
  • Insignia PERÚ / Ministerio de Educación arriba a la IZQUIERDA
  • Logo institucional arriba a la DERECHA (+ N° de certificado)
  • Nombre institucional centrado + barra D.S. + dirección
  • Banda azul con el título (ancho completo)
  • Recuadro FOTO a la derecha, DEBAJO de la banda (deja libre la
    zona del texto "otorga el presente" para el sello físico)
  • Texto introductorio justificado con sangría
  • Nombre del egresado subrayado
  • PROGRAMA DE ESTUDIO / AÑO DE EGRESO / EMISIÓN (mayúsculas)
  • 3 firmas (línea + nombre + cargo, sin subtítulos)
  • QR de verificación → {SITE_URL}/public/verificador?dni=XXXXXXXX
  • Recuadro SECRETARÍA ACADÉMICA con correo
"""

import io
import logging
import os
from datetime import datetime

logger = logging.getLogger("academic.processes")

MESES_ES = {
    1: "enero", 2: "febrero", 3: "marzo", 4: "abril",
    5: "mayo",  6: "junio",   7: "julio", 8: "agosto",
    9: "septiembre", 10: "octubre", 11: "noviembre", 12: "diciembre",
}

# Frontend público donde vive /public/verificador (NO el dominio del backend)
DEFAULT_PUBLIC_URL = "https://academico.iesppallende.edu.pe"
DEFAULT_SECRETARIA_EMAIL = "secretariaacademica@iesppallende.edu.pe"


def generate_certificado_egresado_pdf(process, student: dict, extra: dict, inst: dict) -> tuple:
    """
    Genera el Certificado de Egresado en PDF (diseño oficial SIAA mejorado + QR).

    Returns (BytesIO, filename).
    """
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.colors import HexColor, white
    from reportlab.lib.enums import TA_JUSTIFY
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.platypus import Paragraph
    from reportlab.pdfgen import canvas as cv_mod

    try:
        from reportlab.graphics.barcode import qr as qr_module
        from reportlab.graphics.shapes import Drawing
        HAS_RL_QR = True
    except ImportError:
        HAS_RL_QR = False

    # Cálculo automático de créditos / promoción (helpers ya existentes)
    from .certificado_egresado_generator import _calculate_certificado_data
    cert = _calculate_certificado_data(student, extra)

    now = datetime.now()
    buf = io.BytesIO()
    pw, ph = A4   # 595.27 × 841.89 pts

    # ── Paleta ──
    AZUL_BANDA  = HexColor("#1e6bb8")
    AZUL_OSCURO = HexColor("#0d2f5e")
    AZUL_MED    = HexColor("#1565c0")
    ROJO_PERU   = HexColor("#c8102e")
    GRIS_BADGE  = HexColor("#58595b")
    ROJO_NUM    = HexColor("#b3261e")
    NEGRO_TXT   = HexColor("#1b1b1b")
    GRIS        = HexColor("#555555")
    GRIS_SUAVE  = HexColor("#8a94a3")
    GRIS_BORDE  = HexColor("#b6bfca")
    GRIS_CLARO  = HexColor("#f5f6f8")
    MARCA_AGUA  = HexColor("#eef1f5")

    # ── Datos del estudiante ──
    nombres   = student.get("nombres", "")
    apellidos = student.get("apellidos", "")
    if apellidos and nombres:
        nombre_doc = f"{apellidos.upper()}, {nombres.upper()}"
    else:
        nombre_doc = (student.get("nombre_completo", "") or "").upper()
    carrera = (student.get("carrera", "") or extra.get("career", "")).upper()
    dni     = student.get("dni", "") or student.get("codigo", "")

    # ── Institución ──
    i_nombre  = (inst.get("institution_name", '"GUSTAVO ALLENDE LLAVERÍA"') or "").strip()
    i_nombre_plain = i_nombre.strip('"').strip("'")
    city      = inst.get("city", "Tarma")
    ds        = inst.get("ds_creation", "D.S. 059-1984-ED")
    rm        = inst.get("rm_revalidation", "Reinscripción D.S. 017-2002-ED")
    address   = inst.get("address", "")
    email     = inst.get("email", "")
    secretaria_email = (
        inst.get("secretary_email", "")
        or inst.get("secretaria_email", "")
        or DEFAULT_SECRETARIA_EMAIL
    )
    director_name  = inst.get("director_name", "")
    secretary_name = inst.get("secretary_name", "")
    acad_head_name = inst.get("academic_head_name", "")

    num_cert      = f"{process.id:06d}"
    total_credits = cert["total_credits"]
    promo_str     = (cert["promo_str"] or "").replace("-", " - ")
    fecha_emision = f"{now.day:02d} DE {MESES_ES[now.month].upper()} DEL {now.year}"

    try:
        from django.conf import settings as dj_settings
        media_root = str(dj_settings.MEDIA_ROOT)
        base_url   = getattr(dj_settings, "PUBLIC_SITE_URL", None) or \
                     getattr(dj_settings, "SITE_URL", None) or DEFAULT_PUBLIC_URL
    except Exception:
        media_root = ""
        base_url   = DEFAULT_PUBLIC_URL
    # El QR debe apuntar al frontend público (academico.*), nunca al backend (sis.*)
    if "sis.iesppallende" in base_url:
        base_url = DEFAULT_PUBLIC_URL

    def _resolve_img(path_str):
        p = str(path_str or "")
        if not p:
            return None
        if "/media/" in p:
            p = os.path.join(media_root, p.split("/media/")[-1])
        elif not os.path.isabs(p):
            p = os.path.join(media_root, p.lstrip("/"))
        return p if os.path.exists(p) else None

    c = cv_mod.Canvas(buf, pagesize=A4)
    c.setTitle(f"Certificado de Egresado N° {num_cert}")

    M = 44  # margen

    # ═══════════════════════════════════════════════════════════
    # MARCA DE AGUA — texto institucional repetido
    # ═══════════════════════════════════════════════════════════
    wm_text = (
        f"INSTITUTO DE EDUCACIÓN SUPERIOR PEDAGÓGICO PÚBLICO "
        f"{i_nombre_plain.upper()} · {city.upper()}   "
    )
    c.saveState()
    p = c.beginPath()
    p.rect(M - 4, 120, pw - 2 * M + 8, ph - 310)
    c.clipPath(p, stroke=0)
    c.setFillColor(MARCA_AGUA)
    c.setFont("Helvetica", 5.5)
    row = 0
    wm_w = c.stringWidth(wm_text, "Helvetica", 5.5)
    y_wm = 124
    while y_wm < ph - 188:
        x_wm = M - 10 - (row % 2) * (wm_w / 3)
        while x_wm < pw - M:
            c.drawString(x_wm, y_wm, wm_text)
            x_wm += wm_w
        y_wm += 15
        row += 1
    c.restoreState()

    # ═══════════════════════════════════════════════════════════
    # MEMBRETE
    # ═══════════════════════════════════════════════════════════
    # Insignia PERÚ / Ministerio de Educación — IZQUIERDA
    badge_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        "common", "assets", "logo_minedu_peru.png",
    )
    if os.path.exists(badge_path):
        bw_, bh_ = 140, 30.3   # proporción 1200×260 del logo oficial
        try:
            c.drawImage(badge_path, M, ph - 66, width=bw_, height=bh_, mask="auto")
        except Exception:
            pass
    else:
        bx, by = M, ph - 53
        c.setFillColor(ROJO_PERU)
        c.rect(bx, by, 34, 17, fill=True, stroke=False)
        c.setFillColor(white)
        c.setFont("Helvetica-Bold", 6.5)
        c.drawCentredString(bx + 17, by + 5.5, "PERÚ")
        c.setFillColor(GRIS_BADGE)
        c.rect(bx + 34, by, 94, 17, fill=True, stroke=False)
        c.setFillColor(white)
        c.setFont("Helvetica-Bold", 5.5)
        c.drawCentredString(bx + 34 + 47, by + 9.5, "Ministerio")
        c.drawCentredString(bx + 34 + 47, by + 3.5, "de Educación")

    # Logo del Sistema TARMA — DERECHA (+ N° de certificado)
    # Usa common/assets/logo_sistema.png (el /logo.png del frontend);
    # si no existe, cae al logo institucional configurado.
    sistema_logo = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        "common", "assets", "logo_sistema.png",
    )
    logo_path = sistema_logo if os.path.exists(sistema_logo) else _resolve_img(inst.get("logo_url", ""))
    if logo_path:
        try:
            c.drawImage(logo_path, pw - M - 66, ph - 102, width=66, height=66,
                        preserveAspectRatio=True, mask="auto")
        except Exception:
            pass
    c.setFillColor(GRIS_BADGE)
    c.setFont("Helvetica-Bold", 4.8)
    c.drawRightString(pw - M, ph - 106, "SISTEMA ACADÉMICO INSTITUCIONAL")
    c.setFillColor(GRIS_SUAVE)
    c.setFont("Helvetica", 6)
    c.drawRightString(pw - M, ph - 120, "CERTIFICADO N°")
    c.setFillColor(ROJO_NUM)
    c.setFont("Helvetica-Bold", 12)
    c.drawRightString(pw - M, ph - 134, num_cert)

    # Nombre institucional centrado (más arriba, ya no hay logo al centro)
    c.setFillColor(AZUL_OSCURO)
    c.setFont("Helvetica-Bold", 13)
    c.drawCentredString(pw / 2, ph - 64, "INSTITUTO DE EDUCACIÓN")
    c.drawCentredString(pw / 2, ph - 80, "SUPERIOR PEDAGÓGICO PÚBLICO")
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(pw / 2, ph - 98, f'"{i_nombre_plain.upper()}"')

    # Barra D.S. creación / reinscripción
    bar_txt = "  ·  ".join(x for x in (ds, rm) if x).upper()
    c.setFillColor(AZUL_OSCURO)
    c.roundRect(M + 90, ph - 126, pw - 2 * M - 180, 14, 2, fill=True, stroke=False)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 7)
    c.drawCentredString(pw / 2, ph - 122, bar_txt)

    # Dirección / email
    meta2 = "   ·   ".join(x for x in (address, email) if x)
    if meta2:
        c.setFillColor(GRIS)
        c.setFont("Helvetica", 6.5)
        c.drawCentredString(pw / 2, ph - 137, meta2)

    # ═══════════════════════════════════════════════════════════
    # BANDA AZUL DEL TÍTULO (ancho completo)
    # ═══════════════════════════════════════════════════════════
    band_h = 36
    band_y = ph - 150 - band_h
    band_w = pw - 2 * M

    c.setFillColor(AZUL_BANDA)
    c.roundRect(M, band_y, band_w, band_h, 3, fill=True, stroke=False)
    c.setFillColor(AZUL_OSCURO)
    c.rect(M + 3, band_y, band_w - 6, 2.5, fill=True, stroke=False)

    title = "CERTIFICADO DE EGRESADO"
    t_size = 22
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", t_size)
    c.drawCentredString(pw / 2, band_y + (band_h - t_size) / 2 + 4, title)

    # ═══════════════════════════════════════════════════════════
    # RECUADRO FOTO — a la derecha, DEBAJO de la banda
    # (deja libre la zona derecha del texto introductorio → SELLO)
    # ═══════════════════════════════════════════════════════════
    photo_w, photo_h = 78, 96
    photo_x = pw - M - photo_w
    photo_y = band_y - 78 - photo_h   # 78 pts debajo de la banda

    c.setFillColor(white)
    c.setStrokeColor(GRIS_BORDE)
    c.setLineWidth(0.9)
    c.rect(photo_x, photo_y, photo_w, photo_h, fill=True)
    photo_path = _resolve_img(student.get("photo_url", ""))
    if photo_path:
        try:
            c.drawImage(photo_path, photo_x + 2, photo_y + 2,
                        width=photo_w - 4, height=photo_h - 4,
                        preserveAspectRatio=True, mask="auto")
        except Exception as exc:
            logger.warning(f"Error dibujando foto estudiante: {exc}")
    else:
        c.setFillColor(GRIS_BORDE)
        c.setFont("Helvetica-Bold", 10)
        c.drawCentredString(photo_x + photo_w / 2, photo_y + photo_h / 2 - 4, "FOTO")

    # ═══════════════════════════════════════════════════════════
    # TEXTO INTRODUCTORIO (justificado; no invade la columna del sello/foto)
    # ═══════════════════════════════════════════════════════════
    intro_style = ParagraphStyle(
        "CertIntro", fontName="Helvetica", fontSize=11, leading=17,
        alignment=TA_JUSTIFY, textColor=NEGRO_TXT, firstLineIndent=28,
    )
    intro = Paragraph(
        f"El(La) Director(a) General del Instituto de Educación Superior "
        f"Pedagógico Público <b>{i_nombre}</b> de <b>{city.upper()}</b> "
        f"que al final suscribe, otorga el presente a:",
        intro_style,
    )
    intro_w = pw - 2 * M - photo_w - 16
    iw, ih = intro.wrap(intro_w, 120)
    intro.drawOn(c, M, band_y - 16 - ih)

    # ═══════════════════════════════════════════════════════════
    # NOMBRE DEL EGRESADO (no invade la columna de la foto)
    # ═══════════════════════════════════════════════════════════
    y_name = band_y - 16 - ih - 52
    name_max_w = pw - 2 * (M + photo_w + 12)
    n_size = 19
    while c.stringWidth(nombre_doc, "Helvetica-Bold", n_size) > name_max_w and n_size > 11:
        n_size -= 1
    name_cx = (M + (photo_x - 12)) / 2   # centrado en la zona libre (sin foto)
    c.setFillColor(NEGRO_TXT)
    c.setFont("Helvetica-Bold", n_size)
    c.drawCentredString(name_cx, y_name, nombre_doc)
    n_w = c.stringWidth(nombre_doc, "Helvetica-Bold", n_size)
    c.setStrokeColor(NEGRO_TXT)
    c.setLineWidth(1.1)
    c.line(name_cx - n_w / 2 - 4, y_name - 5, name_cx + n_w / 2 + 4, y_name - 5)

    # ═══════════════════════════════════════════════════════════
    # CUERPO — créditos + programa + año de egreso + emisión
    # ═══════════════════════════════════════════════════════════
    body_style = ParagraphStyle(
        "CertBody", fontName="Helvetica", fontSize=11.5, leading=17,
        alignment=TA_JUSTIFY, textColor=NEGRO_TXT,
    )
    body = Paragraph(
        f"Por haber concluido y aprobado los <b>{total_credits}</b> créditos "
        f"del Plan de Estudios de su Formación Inicial Docente:",
        body_style,
    )
    # Mismo ancho que el intro: no invade la columna del recuadro FOTO
    bw, bh = body.wrap(intro_w, 80)
    y_body = y_name - 36
    body.drawOn(c, M, y_body - bh)

    def _linea_dato(y, label, value):
        c.setFillColor(NEGRO_TXT)
        c.setFont("Helvetica-Bold", 11.5)
        c.drawString(M, y, label)
        lw = c.stringWidth(label, "Helvetica-Bold", 11.5)
        c.drawString(M + lw + 6, y, value)

    y_dato = y_body - bh - 28
    _linea_dato(y_dato, "PROGRAMA DE ESTUDIO:", carrera)
    y_dato -= 26
    if promo_str:
        _linea_dato(y_dato, "AÑO DE EGRESO:", promo_str)
        y_dato -= 26
    _linea_dato(y_dato, "EMISIÓN:", fecha_emision)

    # ═══════════════════════════════════════════════════════════
    # FIRMAS (3 columnas: línea + nombre + cargo)
    # ═══════════════════════════════════════════════════════════
    y_line  = y_dato - 85
    firma_w = (pw - 2 * M) / 3
    sig_w, sig_h = 100, 52

    # La firma de la Dirección General NO se imprime: el certificado se
    # firma y sella físicamente (solo línea + nombre + cargo).
    firmas = (
        ("",                                          director_name,  "DIRECTOR(A) GENERAL"),
        (inst.get("secretary_signature_url", ""),     secretary_name, "SECRETARIO(A) ACADÉMICO"),
        (inst.get("academic_head_signature_url", ""), acad_head_name, "JEFE DE UNIDAD ACADÉMICA"),
    )

    for idx, (sig_url, name, cargo) in enumerate(firmas):
        x0 = M + idx * firma_w
        cx = x0 + firma_w / 2

        sig_path = _resolve_img(sig_url)
        if sig_path:
            try:
                c.drawImage(sig_path, cx - sig_w / 2, y_line + 2,
                            width=sig_w, height=sig_h,
                            preserveAspectRatio=True, mask="auto")
            except Exception:
                pass

        c.setStrokeColor(NEGRO_TXT)
        c.setLineWidth(0.9)
        c.line(x0 + 16, y_line, x0 + firma_w - 16, y_line)

        ty = y_line - 11
        if name:
            c.setFillColor(NEGRO_TXT)
            c.setFont("Helvetica-Bold", 7.5)
            c.drawCentredString(cx, ty, name.upper())
            ty -= 10
        c.setFillColor(AZUL_OSCURO)
        c.setFont("Helvetica-Bold", 7)
        c.drawCentredString(cx, ty, cargo)

    # ═══════════════════════════════════════════════════════════
    # QR DE VERIFICACIÓN
    # ═══════════════════════════════════════════════════════════
    if HAS_RL_QR and dni:
        verify_url = f"{base_url}/public/verificador?dni={dni}"
        qr_size = 64
        qr_x = M
        qr_y = y_line - 128   # bloque QR justo debajo de las firmas

        c.setFillColor(GRIS_CLARO)
        c.roundRect(qr_x - 5, qr_y - 5, 300, qr_size + 10, 4, fill=True, stroke=False)
        c.setStrokeColor(GRIS_BORDE)
        c.setLineWidth(0.5)
        c.roundRect(qr_x - 5, qr_y - 5, 300, qr_size + 10, 4, fill=False)

        try:
            qr_widget = qr_module.QrCodeWidget(verify_url)
            qr_widget.barWidth  = qr_size
            qr_widget.barHeight = qr_size
            d = Drawing(qr_size, qr_size)
            d.add(qr_widget)
            d.drawOn(c, qr_x, qr_y)
        except Exception as exc:
            logger.warning(f"Error generando QR: {exc}")

        tx = qr_x + qr_size + 10
        c.setFillColor(AZUL_OSCURO)
        c.setFont("Helvetica-Bold", 7)
        c.drawString(tx, qr_y + qr_size - 10, "VERIFICACIÓN DIGITAL")
        c.setFillColor(GRIS)
        c.setFont("Helvetica", 6)
        c.drawString(tx, qr_y + qr_size - 21, "Escanee el código QR para verificar la autenticidad")
        c.drawString(tx, qr_y + qr_size - 30, "de este certificado en el sistema académico.")
        c.setFillColor(AZUL_MED)
        c.setFont("Helvetica", 5.5)
        url_short = verify_url[:88] + ("…" if len(verify_url) > 88 else "")
        c.drawString(tx, qr_y + qr_size - 42, url_short)
        c.setFillColor(GRIS)
        c.setFont("Helvetica-Bold", 6)
        c.drawString(tx, qr_y + qr_size - 53, f"Certificado N° {num_cert}  ·  DNI {dni}")

    # ═══════════════════════════════════════════════════════════
    # RECUADRO SECRETARÍA ACADÉMICA + PIE
    # ═══════════════════════════════════════════════════════════
    box_w = max(
        190,
        c.stringWidth(secretaria_email, "Helvetica-Bold", 8) + 24,
    )
    c.setFillColor(white)
    c.setStrokeColor(NEGRO_TXT)
    c.setLineWidth(0.9)
    c.roundRect(M, 40, box_w, 26, 2, fill=True)
    c.setFillColor(NEGRO_TXT)
    c.setFont("Helvetica-Bold", 7.5)
    c.drawCentredString(M + box_w / 2, 56, "SECRETARÍA ACADÉMICA")
    c.setFont("Helvetica-Bold", 8)
    c.drawCentredString(M + box_w / 2, 45, secretaria_email)

    c.setFillColor(GRIS_SUAVE)
    c.setFont("Helvetica", 6)
    c.drawRightString(
        pw - M, 40,
        f"Documento generado por el Sistema Académico  ·  "
        f"Proceso #{process.id:05d}  ·  {now.strftime('%d/%m/%Y %H:%M:%S')}",
    )

    c.showPage()
    c.save()
    buf.seek(0)

    logger.info(
        f"Proceso {process.id}: CERTIFICADO_EGRESADO (diseño SIAA v3) — "
        f"alumno {student.get('id')} créditos={total_credits} egreso={cert['promo_str']}"
    )

    # Nombre único por regeneración (incluye hora): así la URL cambia cada vez
    # y Cloudflare/navegador nunca sirven una versión cacheada antigua.
    filename = f"CERTIFICADO-EGRESADO_{process.id:05d}_{now.strftime('%Y%m%d-%H%M%S')}.pdf"
    return buf, filename
