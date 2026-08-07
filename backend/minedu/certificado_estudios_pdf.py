"""
certificado_estudios_pdf.py
═══════════════════════════════════════════════════════════════
Certificado de Estudios en PDF — un certificado por estudiante,
todos en un solo archivo (una o más páginas por alumno).

Mismo lenguaje visual que el Certificado de Egresado (diseño SIAA
mejorado): marca de agua institucional, insignia PERÚ/MINEDU, banda
azul de título, recuadro FOTO, tablas de notas por período, promedio
ponderado acumulado, firmas y QR de verificación.

Generado 100% con ReportLab (funciona sin WeasyPrint).
"""

import io
import logging
import os
from datetime import datetime

logger = logging.getLogger("minedu")

MESES_ES = {
    1: "enero", 2: "febrero", 3: "marzo", 4: "abril",
    5: "mayo",  6: "junio",   7: "julio", 8: "agosto",
    9: "septiembre", 10: "octubre", 11: "noviembre", 12: "diciembre",
}


def generate_certificado_estudios_pdf(period_code):
    """
    Genera el Certificado de Estudios en PDF para todos los estudiantes
    matriculados (CONFIRMED) en el período dado.

    Returns:
        tuple: (filename, pdf_bytes, total_records)
    """
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.colors import HexColor, white
    from reportlab.pdfgen import canvas as cv_mod

    try:
        from reportlab.graphics.barcode import qr as qr_module
        from reportlab.graphics.shapes import Drawing
        HAS_RL_QR = True
    except ImportError:
        HAS_RL_QR = False

    from .export_generators import (
        _get_certificado_students,
        _get_certificado_periods,
        _get_student_period_grades,
        _student_fullname,
        _nota_letra,
    )

    # Datos institucionales completos (logo, firmas, D.S., etc.)
    try:
        from academic.views.process_document_gen import _get_institution
        inst = _get_institution()
    except Exception as e:
        logger.warning(f"No se pudo leer InstitutionSetting: {e}")
        inst = {}

    now = datetime.now()
    pw, ph = A4   # 595.27 × 841.89

    # ── Paleta (idéntica al certificado de egresado) ──
    AZUL_BANDA  = HexColor("#1e6bb8")
    AZUL_OSCURO = HexColor("#0d2f5e")
    AZUL_MED    = HexColor("#1565c0")
    AZUL_CLARO  = HexColor("#eef4fb")
    ROJO_PERU   = HexColor("#c8102e")
    GRIS_BADGE  = HexColor("#58595b")
    NEGRO_TXT   = HexColor("#1b1b1b")
    GRIS        = HexColor("#555555")
    GRIS_SUAVE  = HexColor("#8a94a3")
    GRIS_BORDE  = HexColor("#b6bfca")
    GRIS_CLARO  = HexColor("#f5f6f8")
    MARCA_AGUA  = HexColor("#eef1f5")
    VERDE_OK    = HexColor("#1b7a43")
    ROJO_DES    = HexColor("#b3261e")

    i_nombre       = (inst.get("institution_name", '"GUSTAVO ALLENDE LLAVERÍA"') or "").strip()
    i_nombre_plain = i_nombre.strip('"').strip("'")
    city      = inst.get("city", "Tarma")
    ds        = inst.get("ds_creation", "D.S. 059-1984-ED")
    rm        = inst.get("rm_revalidation", "Reinscripción D.S. 017-2002-ED")
    address   = inst.get("address", "")
    email     = inst.get("email", "")
    phone     = inst.get("phone", "") or inst.get("telefono", "")
    short     = inst.get("short_name", "I.E.S.P.P.")
    director_name  = inst.get("director_name", "")
    secretary_name = inst.get("secretary_name", "")

    # El QR debe apuntar al frontend público (academico.*), no al backend (sis.*)
    DEFAULT_PUBLIC_URL = "https://academico.iesppallende.edu.pe"
    try:
        from django.conf import settings as dj_settings
        media_root = str(dj_settings.MEDIA_ROOT)
        base_url   = getattr(dj_settings, "PUBLIC_SITE_URL", None) or \
                     getattr(dj_settings, "SITE_URL", None) or DEFAULT_PUBLIC_URL
    except Exception:
        media_root = ""
        base_url   = DEFAULT_PUBLIC_URL
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

    logo_path = _resolve_img(inst.get("logo_url", ""))

    # ── Estudiantes del período: matrículas confirmadas + kardex ──
    students = _get_certificado_students(period_code)
    total = len(students)

    buf = io.BytesIO()
    c = cv_mod.Canvas(buf, pagesize=A4)
    c.setTitle(f"Certificados de Estudios {period_code}")

    M = 44
    wm_text = (
        f"INSTITUTO DE EDUCACIÓN SUPERIOR PEDAGÓGICO PÚBLICO "
        f"{i_nombre_plain.upper()} · {city.upper()}   "
    )

    def _watermark(y_top, y_bottom):
        """Marca de agua entre dos alturas (coordenadas desde abajo)."""
        c.saveState()
        p = c.beginPath()
        p.rect(M - 4, y_bottom, pw - 2 * M + 8, y_top - y_bottom)
        c.clipPath(p, stroke=0)
        c.setFillColor(MARCA_AGUA)
        c.setFont("Helvetica", 5.5)
        wm_w = c.stringWidth(wm_text, "Helvetica", 5.5)
        y_wm, row = y_bottom + 4, 0
        while y_wm < y_top:
            x_wm = M - 10 - (row % 2) * (wm_w / 3)
            while x_wm < pw - M:
                c.drawString(x_wm, y_wm, wm_text)
                x_wm += wm_w
            y_wm += 15
            row += 1
        c.restoreState()

    def _footer_pagina():
        c.setFillColor(GRIS_SUAVE)
        c.setFont("Helvetica", 6)
        c.drawRightString(
            pw - M, 30,
            f"Documento generado por el Sistema Académico  ·  "
            f"{now.strftime('%d/%m/%Y %H:%M:%S')}",
        )
        contacto = "  ·  ".join(x for x in ("REGISTRO ACADÉMICO", phone, email) if x)
        if phone or email:
            c.setFont("Helvetica-Bold", 6)
            c.drawString(M, 30, contacto)

    def _header_completo(student, career_name, photo_path):
        """Encabezado completo de la 1ª página del estudiante. Retorna cursor y."""
        _watermark(ph - 214, 150)

        # Logo centrado
        if logo_path:
            try:
                c.drawImage(logo_path, pw / 2 - 30, ph - 96, width=60, height=60,
                            preserveAspectRatio=True, mask="auto")
            except Exception:
                pass

        # Insignia PERÚ / MINEDU (logo oficial si está en assets)
        badge_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "common", "assets", "logo_minedu_peru.png",
        )
        if os.path.exists(badge_path):
            bw_, bh_ = 132, 28.6   # proporción 1200×260 del logo oficial
            by = ph - 62
            try:
                c.drawImage(badge_path, pw - M - bw_, by, width=bw_, height=bh_, mask="auto")
            except Exception:
                pass
            y_after_badge = by - 9
        else:
            bx, by, bh_ = pw - M - 128, ph - 50, 17
            c.setFillColor(ROJO_PERU)
            c.rect(bx, by, 34, bh_, fill=True, stroke=False)
            c.setFillColor(white)
            c.setFont("Helvetica-Bold", 6.5)
            c.drawCentredString(bx + 17, by + 5.5, "PERÚ")
            c.setFillColor(GRIS_BADGE)
            c.rect(bx + 34, by, 94, bh_, fill=True, stroke=False)
            c.setFillColor(white)
            c.setFont("Helvetica-Bold", 5.5)
            c.drawCentredString(bx + 34 + 47, by + 9.5, "Ministerio")
            c.drawCentredString(bx + 34 + 47, by + 3.5, "de Educación")
            y_after_badge = by - 8
        c.setFillColor(GRIS_BADGE)
        c.setFont("Helvetica-Bold", 4.8)
        c.drawRightString(pw - M, y_after_badge, "SISTEMA ACADÉMICO INSTITUCIONAL")

        # Nombre institucional
        c.setFillColor(AZUL_OSCURO)
        c.setFont("Helvetica-Bold", 12)
        c.drawCentredString(pw / 2, ph - 114, "INSTITUTO DE EDUCACIÓN SUPERIOR PEDAGÓGICO PÚBLICO")
        c.setFont("Helvetica-Bold", 13)
        c.drawCentredString(pw / 2, ph - 130, f'"{i_nombre_plain.upper()}"')

        # Barra D.S.
        bar_txt = "  ·  ".join(x for x in (ds, rm) if x).upper()
        c.setFillColor(AZUL_OSCURO)
        c.roundRect(M + 60, ph - 152, pw - 2 * M - 120, 13, 2, fill=True, stroke=False)
        c.setFillColor(white)
        c.setFont("Helvetica-Bold", 6.5)
        c.drawCentredString(pw / 2, ph - 148.5, bar_txt)

        meta2 = "   ·   ".join(x for x in (address, email) if x)
        if meta2:
            c.setFillColor(GRIS)
            c.setFont("Helvetica", 6)
            c.drawCentredString(pw / 2, ph - 163, meta2)

        # Banda azul del título + recuadro FOTO
        photo_w, photo_h = 66, 82
        photo_x = pw - M - photo_w
        photo_y = ph - 176 - photo_h

        band_h = 30
        band_y = ph - 176 - band_h
        band_w = photo_x - 12 - M

        c.setFillColor(AZUL_BANDA)
        c.roundRect(M, band_y, band_w, band_h, 3, fill=True, stroke=False)
        c.setFillColor(AZUL_OSCURO)
        c.rect(M + 3, band_y, band_w - 6, 2.2, fill=True, stroke=False)
        c.setFillColor(white)
        c.setFont("Helvetica-Bold", 17)
        c.drawCentredString(M + band_w / 2, band_y + 9, "CERTIFICADO DE ESTUDIOS")

        c.setFillColor(white)
        c.setStrokeColor(GRIS_BORDE)
        c.setLineWidth(0.9)
        c.rect(photo_x, photo_y, photo_w, photo_h, fill=True)
        if photo_path:
            try:
                c.drawImage(photo_path, photo_x + 2, photo_y + 2,
                            width=photo_w - 4, height=photo_h - 4,
                            preserveAspectRatio=True, mask="auto")
            except Exception:
                pass
        else:
            c.setFillColor(GRIS_BORDE)
            c.setFont("Helvetica-Bold", 9)
            c.drawCentredString(photo_x + photo_w / 2, photo_y + photo_h / 2 - 3, "FOTO")

        # Datos del estudiante
        y = band_y - 22
        datos = [
            ("Estudiante:", _student_fullname(student).upper()),
            ("N° Documento:", student.num_documento or ""),
            ("Programa de estudios:", (career_name or "").upper()),
            ("Período académico:", period_code),
        ]
        if getattr(student, "fecha_nac", None):
            datos.insert(2, ("Fecha de nacimiento:", student.fecha_nac.strftime("%d/%m/%Y")))
        for label, val in datos:
            c.setFillColor(GRIS)
            c.setFont("Helvetica-Bold", 8.5)
            c.drawString(M, y, label)
            c.setFillColor(NEGRO_TXT)
            c.setFont("Helvetica-Bold", 9)
            c.drawString(M + 110, y, str(val))
            y -= 15

        return y - 8

    def _header_continuacion(student):
        """Encabezado compacto para páginas de continuación."""
        _watermark(ph - 70, 150)
        c.setFillColor(AZUL_OSCURO)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(M, ph - 46, "CERTIFICADO DE ESTUDIOS  (continuación)")
        c.setFillColor(GRIS)
        c.setFont("Helvetica-Bold", 8)
        c.drawRightString(pw - M, ph - 46, _student_fullname(student).upper())
        c.setStrokeColor(AZUL_BANDA)
        c.setLineWidth(1.2)
        c.line(M, ph - 54, pw - M, ph - 54)
        return ph - 74

    # Columnas de la tabla: N°, Código, Área/Curso, Horas, Créd., Calif., Nivel, Condición
    content_w = pw - 2 * M
    col_w = [
        content_w * 0.05, content_w * 0.13, content_w * 0.40, content_w * 0.07,
        content_w * 0.07, content_w * 0.08, content_w * 0.07, content_w * 0.13,
    ]
    col_x = [M]
    for w in col_w:
        col_x.append(col_x[-1] + w)
    HEADERS = ["N°", "CÓDIGO", "ÁREA / CURSO", "HORAS", "CRÉD.", "CALIF.", "NIVEL", "CONDICIÓN"]

    def _tabla_header(y):
        th = 15
        c.setFillColor(AZUL_OSCURO)
        c.rect(M, y - th, content_w, th, fill=True, stroke=False)
        c.setFillColor(white)
        c.setFont("Helvetica-Bold", 6.5)
        for i, h in enumerate(HEADERS):
            cxx = col_x[i] + col_w[i] / 2
            if i == 2:
                c.drawString(col_x[i] + 5, y - th + 4.5, h)
            else:
                c.drawCentredString(cxx, y - th + 4.5, h)
        return y - th

    for st_idx, student in enumerate(students):
        career = ""
        try:
            plan = getattr(student, "plan", None)
            career = plan.career.name if plan and getattr(plan, "career", None) else ""
        except Exception:
            career = ""

        photo_path = None
        try:
            if getattr(student, "photo", None):
                photo_path = _resolve_img(student.photo.url)
        except Exception:
            pass

        y = _header_completo(student, career, photo_path)
        BOTTOM = 48   # límite inferior de contenido

        def _need(h):
            nonlocal y
            if y - h < BOTTOM:
                _footer_pagina()
                c.showPage()
                y = _header_continuacion(student)

        grand_credits = 0
        grand_puntaje = 0

        for per_code in _get_certificado_periods(student):
            items = _get_student_period_grades(student, per_code)
            if not items:
                continue
            per_credits = sum(i["credits"] for i in items)
            per_puntaje = sum(i["puntaje"] for i in items)
            per_prom    = round(per_puntaje / per_credits, 2) if per_credits > 0 else 0
            grand_credits += per_credits
            grand_puntaje += per_puntaje

            # Chip del período
            _need(46)
            c.setFillColor(AZUL_CLARO)
            c.roundRect(M, y - 15, 110, 15, 2, fill=True, stroke=False)
            c.setFillColor(AZUL_OSCURO)
            c.setFont("Helvetica-Bold", 8)
            c.drawString(M + 8, y - 11, f"PERÍODO  {per_code}")
            y -= 19

            y = _tabla_header(y)

            row_h = 14
            for idx, item in enumerate(items, 1):
                _need(row_h + 4)
                if y == ph - 74:          # nueva página → repetir header de tabla
                    y = _tabla_header(y)
                if idx % 2 == 0:
                    c.setFillColor(GRIS_CLARO)
                    c.rect(M, y - row_h, content_w, row_h, fill=True, stroke=False)
                c.setStrokeColor(GRIS_BORDE)
                c.setLineWidth(0.3)
                c.rect(M, y - row_h, content_w, row_h, fill=False)
                for xx in col_x[1:-1]:
                    c.line(xx, y, xx, y - row_h)

                ty = y - row_h + 4
                c.setFillColor(GRIS)
                c.setFont("Helvetica", 7)
                c.drawCentredString(col_x[0] + col_w[0] / 2, ty, str(idx))
                c.setFillColor(NEGRO_TXT)
                c.drawCentredString(col_x[1] + col_w[1] / 2, ty, str(item["code"] or ""))
                nombre = str(item["name"] or "")
                while c.stringWidth(nombre, "Helvetica", 7) > col_w[2] - 10 and len(nombre) > 4:
                    nombre = nombre[:-1]
                c.drawString(col_x[2] + 5, ty, nombre)
                c.drawCentredString(col_x[3] + col_w[3] / 2, ty, str(item["hours"] or ""))
                c.drawCentredString(col_x[4] + col_w[4] / 2, ty, str(item["credits"] or ""))
                nota = item["nota_int"]
                c.setFont("Helvetica-Bold", 7)
                c.setFillColor(AZUL_OSCURO if nota is None else (VERDE_OK if nota >= 11 else ROJO_DES))
                c.drawCentredString(col_x[5] + col_w[5] / 2, ty, "" if nota is None else str(nota))
                c.setFillColor(NEGRO_TXT)
                c.drawCentredString(col_x[6] + col_w[6] / 2, ty, str(item["nota_letra"] or ""))
                c.setFont("Helvetica", 6.5)
                estado = str(item["estado"] or "")
                c.setFillColor(VERDE_OK if estado == "Aprobado" else (ROJO_DES if estado else NEGRO_TXT))
                c.drawCentredString(col_x[7] + col_w[7] / 2, ty, estado)
                y -= row_h

            # Resumen del período
            _need(18)
            c.setFillColor(GRIS)
            c.setFont("Helvetica-Bold", 7)
            c.drawRightString(pw - M, y - 10, f"Créditos: {per_credits}    ·    Promedio del período: {per_prom}")
            y -= 22

        # ── Promedio ponderado acumulado ──
        grand_prom = round(grand_puntaje / grand_credits, 2) if grand_credits > 0 else 0
        _need(40)
        c.setFillColor(AZUL_OSCURO)
        c.roundRect(M, y - 24, content_w, 24, 3, fill=True, stroke=False)
        c.setFillColor(white)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(M + 12, y - 16, "PROMEDIO PONDERADO ACUMULADO")
        c.setFont("Helvetica-Bold", 11)
        c.drawRightString(pw - M - 12, y - 17, f"{grand_prom}   ({_nota_letra(round(grand_prom)) or '—'})")
        y -= 40

        # ── Firmas ──
        _need(170)
        y_line = y - 58
        firma_w = content_w / 3
        sig_w, sig_h = 95, 44
        firmas = (
            (inst.get("signature_url", ""),           director_name,  "DIRECTOR(A) GENERAL"),
            (inst.get("secretary_signature_url", ""), secretary_name, "SECRETARIO(A) ACADÉMICO(A)"),
            ("",                                      "",             "ESPECIALISTA DRE"),
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
                c.setFont("Helvetica-Bold", 7)
                c.drawCentredString(cx, ty, name.upper())
                ty -= 9
            c.setFillColor(AZUL_OSCURO)
            c.setFont("Helvetica-Bold", 6.5)
            c.drawCentredString(cx, ty, cargo)
            ty -= 8
            c.setFillColor(GRIS_SUAVE)
            c.setFont("Helvetica", 5.5)
            c.drawCentredString(cx, ty, f"{short} {i_nombre_plain}")
        y = y_line - 42

        # ── QR de verificación ──
        dni = student.num_documento or ""
        if HAS_RL_QR and dni:
            _need(80)
            verify_url = f"{base_url}/public/verificador?dni={dni}"
            qr_size = 52
            qr_x, qr_y = M, y - qr_size - 4

            c.setFillColor(GRIS_CLARO)
            c.roundRect(qr_x - 5, qr_y - 5, 280, qr_size + 10, 4, fill=True, stroke=False)
            c.setStrokeColor(GRIS_BORDE)
            c.setLineWidth(0.5)
            c.roundRect(qr_x - 5, qr_y - 5, 280, qr_size + 10, 4, fill=False)
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
            c.setFont("Helvetica-Bold", 6.5)
            c.drawString(tx, qr_y + qr_size - 9, "VERIFICACIÓN DIGITAL")
            c.setFillColor(GRIS)
            c.setFont("Helvetica", 5.5)
            c.drawString(tx, qr_y + qr_size - 19, "Escanee el código QR para verificar la autenticidad")
            c.drawString(tx, qr_y + qr_size - 27, "de este certificado en el sistema académico.")
            c.setFillColor(AZUL_MED)
            c.setFont("Helvetica", 5)
            c.drawString(tx, qr_y + qr_size - 38, verify_url[:92])
            c.setFillColor(GRIS)
            c.setFont("Helvetica-Bold", 5.5)
            c.drawString(tx, qr_y + qr_size - 48, f"DNI {dni}  ·  Período {period_code}")

        _footer_pagina()
        c.showPage()

    if not students:
        c.setFillColor(HexColor("#555555"))
        c.setFont("Helvetica-Bold", 12)
        c.drawCentredString(pw / 2, ph / 2, f"No hay estudiantes matriculados en {period_code}.")
        c.showPage()

    c.save()
    buf.seek(0)

    logger.info(f"Certificado de Estudios PDF {period_code}: {total} estudiantes")
    filename = f"certificado_estudios_{period_code}.pdf"
    return filename, buf.read(), total
