# academic/views/enrollment_verify.py
"""
Página HTML pública para verificar Ficha de Matrícula (accesible vía QR).
No depende del frontend React — renderiza HTML completo desde Django.
GET /public/academic/enrollment?dni=XXXX&period=YYYY
"""
from django.http import HttpResponse


def _get_inst_info():
    """Info institucional mínima."""
    defaults = {
        "name": 'GUSTAVO ALLENDE LLAVERÍA',
        "short_name": "IESPP GAL",
        "province": "1207",
        "region": "Junín",
    }
    try:
        from catalogs.models import InstitutionSetting
        obj = InstitutionSetting.objects.filter(pk=1).first()
        if obj and obj.data:
            d = obj.data
            defaults["name"] = d.get("name", "") or d.get("institution_name", "") or defaults["name"]
            defaults["short_name"] = d.get("short_name", "") or defaults["short_name"]
            defaults["province"] = d.get("province", "") or defaults["province"]
            defaults["region"] = d.get("region", "") or defaults["region"]
    except Exception:
        pass
    return defaults


def verify_enrollment_page(request):
    """
    Página HTML pública para verificar matrícula (QR de ficha).
    GET /public/academic/enrollment?dni=XXXX&period=YYYY
    """
    dni = request.GET.get("dni", "").strip()
    period = request.GET.get("period", "").strip()

    enrollment_data = None
    courses_data = []
    error_msg = None

    if dni:
        try:
            from academic.models import Enrollment, EnrollmentItem
            from students.models import Student

            student = Student.objects.filter(num_documento=dni).first()
            if not student:
                error_msg = f"No se encontró ningún estudiante con DNI {dni}."
            else:
                filters = {"student": student}
                if period:
                    filters["period"] = period

                enrollment = (
                    Enrollment.objects
                    .filter(**filters)
                    .order_by("-created_at")
                    .first()
                )

                if not enrollment:
                    error_msg = f"No se encontró matrícula para el estudiante con DNI {dni}"
                    if period:
                        error_msg += f" en el período {period}"
                    error_msg += "."
                else:
                    status_map = {
                        "DRAFT": ("Borrador", "#d97706", "#fef3c7"),
                        "CONFIRMED": ("Confirmada", "#059669", "#d1fae5"),
                        "CANCELLED": ("Anulada", "#dc2626", "#fee2e2"),
                    }
                    st = status_map.get(enrollment.status, (enrollment.status, "#6b7280", "#f3f4f6"))

                    full_name = f"{student.apellido_paterno} {student.apellido_materno} {student.nombres}".strip()
                    programa = student.programa_carrera or "—"
                    ciclo_sec = ""
                    if student.ciclo:
                        ciclo_sec = f"{student.ciclo}"
                    if student.seccion:
                        ciclo_sec += f' - "{student.seccion}"'

                    enrollment_data = {
                        "student_name": full_name,
                        "dni": student.num_documento,
                        "programa": programa,
                        "ciclo_seccion": ciclo_sec or "—",
                        "period": enrollment.period,
                        "status": enrollment.status,
                        "status_label": st[0],
                        "status_color": st[1],
                        "status_bg": st[2],
                        "total_credits": enrollment.total_credits,
                        "created_at": enrollment.created_at.strftime("%d/%m/%Y %H:%M") if enrollment.created_at else "—",
                        "confirmed_at": enrollment.confirmed_at.strftime("%d/%m/%Y %H:%M") if enrollment.confirmed_at else "—",
                    }

                    # Cursos matriculados
                    items = (
                        EnrollmentItem.objects
                        .filter(enrollment=enrollment)
                        .select_related("plan_course", "plan_course__course", "section")
                        .order_by("plan_course__course__name")
                    )
                    total_hours = 0
                    for item in items:
                        pc = item.plan_course
                        course = pc.course if pc else None
                        name = course.name if course else "—"
                        hours = getattr(pc, "hours", 0) or 0
                        total_hours += hours
                        courses_data.append({
                            "name": name,
                            "hours": hours,
                            "credits": item.credits,
                        })
                    enrollment_data["total_hours"] = total_hours

        except Exception as e:
            error_msg = "Error al consultar la matrícula. Intente nuevamente."

    elif request.GET.get("dni"):
        error_msg = "DNI no válido."

    inst = _get_inst_info()

    # ── SVG Icons ──
    IC = {
        "grad":   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1.657 2.686 3 6 3s6-1.343 6-3v-5"/></svg>',
        "search": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
        "check":  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>',
        "alert":  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
        "user":   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
        "id":     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>',
        "book":   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>',
        "cal":    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
        "clock":  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
        "star":   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    }

    d = enrollment_data

    # ── Build detail fields ──
    def _field(icon_svg, label, val, full_width=False):
        if not val or val == "—":
            return ""
        w = "grid-column:1/-1;" if full_width else ""
        return f'''<div class="fd" style="{w}">
            <div class="fd-icon">{icon_svg}</div>
            <div class="fd-txt"><span class="fd-lbl">{label}</span><span class="fd-val">{val}</span></div>
        </div>'''

    # ── Status badge ──
    badge_html = ""
    if d:
        badge_html = f'<span class="badge" style="--bc:{d["status_color"]};--bg:{d["status_bg"]};">{d["status_label"]}</span>'

    # ── Found banner ──
    found_html = ""
    if d:
        found_html = f'''
        <div class="verified-card fade-in">
            <div class="verified-icon">{IC["check"]}</div>
            <div class="verified-txt">
                <strong>Matrícula Verificada</strong>
                <span>El estudiante <b>{d["student_name"]}</b> se encuentra matriculado en el período <b>{d["period"]}</b>.</span>
            </div>
            {badge_html}
        </div>'''

    # ── Detail card ──
    detail_html = ""
    if d:
        fields = ""
        fields += _field(IC["user"],  "Estudiante", d["student_name"], True)
        fields += _field(IC["id"],    "DNI", d["dni"])
        fields += _field(IC["cal"],   "Período Académico", d["period"])
        fields += _field(IC["book"],  "Programa de Estudios", d["programa"], True)
        fields += _field(IC["grad"],  "Ciclo - Sección", d["ciclo_seccion"])
        fields += _field(IC["star"],  "Total Créditos", str(d["total_credits"]))
        fields += _field(IC["clock"], "Fecha de Matrícula", d["created_at"])
        fields += _field(IC["check"], "Fecha de Confirmación", d["confirmed_at"])

        detail_html = f'''
        <div class="card fade-in" style="animation-delay:.1s;">
            <div class="card-head">
                <div>
                    <p class="card-title">Datos de Matrícula</p>
                    <p class="card-sub">Período {d["period"]}</p>
                </div>
                {badge_html}
            </div>
            <div class="card-body">
                <div class="fields-grid">
                    {fields}
                </div>
            </div>
        </div>'''

    # ── Courses table ──
    courses_html = ""
    if courses_data:
        rows = ""
        for i, c in enumerate(courses_data):
            bg = "#f8fafc" if i % 2 == 0 else "#fff"
            rows += f'''<tr style="background:{bg};">
                <td style="padding:10px 14px;font-size:13px;color:#334155;border-bottom:1px solid #f1f5f9;">{i + 1}</td>
                <td style="padding:10px 14px;font-size:13px;font-weight:500;color:#1e293b;border-bottom:1px solid #f1f5f9;">{c["name"]}</td>
                <td style="padding:10px 14px;font-size:13px;color:#334155;text-align:center;border-bottom:1px solid #f1f5f9;">{c["hours"]}</td>
                <td style="padding:10px 14px;font-size:13px;font-weight:600;color:#0d1b3e;text-align:center;border-bottom:1px solid #f1f5f9;">{c["credits"]}</td>
            </tr>'''

        total_h = d["total_hours"] if d else 0
        total_c = d["total_credits"] if d else 0

        courses_html = f'''
        <div class="card fade-in" style="animation-delay:.2s;">
            <div class="card-head">
                <div>
                    <p class="card-title">Asignaturas Matriculadas</p>
                    <p class="card-sub">{len(courses_data)} asignaturas &middot; {total_c} créditos</p>
                </div>
            </div>
            <div style="overflow-x:auto;">
                <table style="width:100%;border-collapse:collapse;">
                    <thead>
                        <tr style="background:#0d1b3e;">
                            <th style="padding:10px 14px;font-size:11px;font-weight:700;color:#c5a44e;text-align:left;text-transform:uppercase;letter-spacing:.05em;">N°</th>
                            <th style="padding:10px 14px;font-size:11px;font-weight:700;color:#c5a44e;text-align:left;text-transform:uppercase;letter-spacing:.05em;">Asignatura</th>
                            <th style="padding:10px 14px;font-size:11px;font-weight:700;color:#c5a44e;text-align:center;text-transform:uppercase;letter-spacing:.05em;">Horas</th>
                            <th style="padding:10px 14px;font-size:11px;font-weight:700;color:#c5a44e;text-align:center;text-transform:uppercase;letter-spacing:.05em;">Créditos</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows}
                        <tr style="background:#0d1b3e;">
                            <td colspan="2" style="padding:10px 14px;font-size:13px;font-weight:800;color:#fff;text-align:right;text-transform:uppercase;">Total</td>
                            <td style="padding:10px 14px;font-size:13px;font-weight:800;color:#c5a44e;text-align:center;">{total_h}</td>
                            <td style="padding:10px 14px;font-size:13px;font-weight:800;color:#c5a44e;text-align:center;">{total_c}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>'''

    # ── Error ──
    error_html = ""
    if error_msg:
        error_html = f'''
        <div class="alert-card alert-warn fade-in">
            <div class="alert-icon">{IC["alert"]}</div>
            <div>
                <strong>Matrícula no encontrada</strong>
                <p>{error_msg}</p>
            </div>
        </div>'''

    # ── Empty state ──
    empty_html = ""
    if not d and not error_msg:
        empty_html = f'''
        <div class="empty-state">
            <div class="empty-icon">{IC["grad"]}</div>
            <strong>Verificación de Matrícula</strong>
            <p>Ingrese el N° de documento del estudiante para verificar su matrícula académica.</p>
        </div>'''

    html = f'''<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Verificación de Matrícula — IESPP "{inst["name"]}"</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{font-family:'Inter',system-ui,-apple-system,sans-serif;background:#f0f2f5;min-height:100vh;color:#1a1a2e}}

/* Header — dark blue + gold */
.hdr{{background:linear-gradient(135deg,#0d1b3e 0%,#162755 50%,#0d1b3e 100%);color:#fff;position:relative;overflow:hidden}}
.hdr::before{{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 30% 0%,rgba(197,164,78,.15) 0%,transparent 60%),radial-gradient(ellipse at 80% 100%,rgba(197,164,78,.08) 0%,transparent 50%)}}
.hdr-inner{{max-width:720px;margin:0 auto;padding:28px 20px 36px;position:relative;z-index:1}}
.hdr-top{{display:flex;align-items:center;gap:14px}}
.hdr-logo{{width:48px;height:48px;border-radius:14px;background:rgba(197,164,78,.15);border:1px solid rgba(197,164,78,.25);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px)}}
.hdr-logo svg{{width:24px;height:24px;color:#c5a44e}}
.hdr h1{{font-size:20px;font-weight:800;letter-spacing:-.03em}}
.hdr p{{font-size:12px;color:#94a3b8;margin-top:2px}}
.hdr-badge{{display:inline-flex;align-items:center;gap:6px;margin-top:14px;padding:6px 14px;border-radius:20px;background:rgba(197,164,78,.15);border:1px solid rgba(197,164,78,.25);font-size:11px;font-weight:700;color:#c5a44e;letter-spacing:.03em;text-transform:uppercase}}
.hdr-badge svg{{width:14px;height:14px}}
.gold-line{{height:3px;background:linear-gradient(90deg,transparent,#c5a44e,transparent)}}
.back-btn{{position:absolute;top:28px;right:20px;color:rgba(255,255,255,.4);text-decoration:none;font-size:13px;font-weight:600;display:flex;align-items:center;gap:4px;transition:color .15s}}
.back-btn:hover{{color:#c5a44e}}

/* Container */
.container{{max-width:720px;margin:-20px auto 0;padding:0 16px 48px;position:relative;z-index:2}}

/* Search */
.search-card{{background:#fff;border-radius:16px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,.08),0 8px 24px rgba(0,0,0,.04);border:1px solid #e5e7eb}}
.search-label{{font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px}}
.search-form{{display:flex;gap:10px}}
.search-input-wrap{{flex:1;position:relative}}
.search-input-wrap svg{{position:absolute;left:14px;top:50%;transform:translateY(-50%);width:18px;height:18px;color:#9ca3af}}
.search-input{{width:100%;height:48px;padding:0 14px 0 42px;border-radius:12px;border:2px solid #e5e7eb;background:#fafafa;font-size:15px;font-weight:500;color:#1a1a2e;transition:all .2s;font-family:inherit}}
.search-input:focus{{outline:none;border-color:#c5a44e;background:#fff;box-shadow:0 0 0 4px rgba(197,164,78,.12)}}
.search-input::placeholder{{color:#9ca3af;font-weight:400}}
.search-period{{width:120px;height:48px;padding:0 12px;border-radius:12px;border:2px solid #e5e7eb;background:#fafafa;font-size:14px;font-weight:500;color:#1a1a2e;font-family:inherit;transition:all .2s}}
.search-period:focus{{outline:none;border-color:#c5a44e;background:#fff;box-shadow:0 0 0 4px rgba(197,164,78,.12)}}
.search-btn{{height:48px;padding:0 24px;border-radius:12px;background:linear-gradient(135deg,#0d1b3e,#1a3068);color:#c5a44e;font-size:15px;font-weight:700;border:none;cursor:pointer;display:flex;align-items:center;gap:8px;transition:all .2s;font-family:inherit;box-shadow:0 2px 8px rgba(13,27,62,.3)}}
.search-btn:hover{{background:linear-gradient(135deg,#162755,#1e3a7a);transform:translateY(-1px);box-shadow:0 4px 12px rgba(13,27,62,.4)}}
.search-btn:active{{transform:translateY(0)}}
.search-btn svg{{width:16px;height:16px}}

/* Verified banner */
.verified-card{{background:linear-gradient(135deg,#ecfdf5,#d1fae5);border:1px solid #86efac;border-radius:14px;padding:18px 20px;display:flex;align-items:center;gap:14px;margin-top:20px}}
.verified-icon{{width:44px;height:44px;border-radius:12px;background:#fff;border:1px solid #86efac;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 2px 6px rgba(16,185,129,.15)}}
.verified-icon svg{{width:22px;height:22px;color:#059669}}
.verified-txt{{flex:1}}
.verified-txt strong{{font-size:14px;color:#065f46;display:block}}
.verified-txt span{{font-size:12px;color:#047857;margin-top:2px;display:block;line-height:1.4}}

/* Badge */
.badge{{padding:5px 14px;border-radius:20px;font-size:11px;font-weight:800;color:var(--bc);background:var(--bg);border:1.5px solid var(--bc);letter-spacing:.02em;white-space:nowrap;flex-shrink:0}}

/* Card */
.card{{background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08),0 8px 24px rgba(0,0,0,.04);border:1px solid #e5e7eb;margin-top:16px}}
.card-head{{background:linear-gradient(135deg,#0d1b3e,#162755);padding:20px 24px;display:flex;align-items:center;justify-content:space-between;gap:12px}}
.card-title{{color:#c5a44e;font-size:18px;font-weight:800;letter-spacing:-.02em}}
.card-sub{{color:#94a3b8;font-size:12px;margin-top:3px}}
.card-body{{padding:24px;display:flex;gap:24px;flex-wrap:wrap}}

/* Fields grid */
.fields-grid{{flex:1;min-width:280px;display:grid;grid-template-columns:1fr 1fr;gap:0}}
.fd{{display:flex;align-items:flex-start;gap:10px;padding:12px 8px;border-bottom:1px solid #f1f5f9;transition:background .15s}}
.fd:hover{{background:#fafbff}}
.fd-icon{{width:28px;height:28px;border-radius:8px;background:rgba(13,27,62,.06);display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}}
.fd-icon svg{{width:14px;height:14px;color:#0d1b3e}}
.fd-txt{{min-width:0}}
.fd-lbl{{display:block;font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em}}
.fd-val{{display:block;font-size:13px;font-weight:600;color:#1e293b;margin-top:1px;word-break:break-word}}

/* Alert */
.alert-card{{border-radius:14px;padding:18px 20px;display:flex;align-items:flex-start;gap:12px;margin-top:20px}}
.alert-warn{{background:#fffbeb;border:1px solid #fcd34d}}
.alert-icon{{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0}}
.alert-warn .alert-icon{{background:#fef3c7}}
.alert-warn .alert-icon svg{{width:18px;height:18px;color:#d97706}}
.alert-card strong{{font-size:14px;color:#92400e;display:block}}
.alert-card p{{font-size:12px;color:#a16207;margin-top:3px;line-height:1.4}}

/* Empty state */
.empty-state{{text-align:center;padding:64px 24px;margin-top:20px;background:#fff;border-radius:16px;border:2px dashed #e5e7eb}}
.empty-icon{{width:64px;height:64px;border-radius:18px;background:linear-gradient(135deg,#0d1b3e,#162755);display:flex;align-items:center;justify-content:center;margin:0 auto 18px}}
.empty-icon svg{{width:28px;height:28px;color:#c5a44e}}
.empty-state strong{{display:block;font-size:16px;color:#64748b}}
.empty-state p{{font-size:13px;color:#94a3b8;margin-top:6px;max-width:360px;margin-left:auto;margin-right:auto;line-height:1.5}}

/* Footer */
.footer{{text-align:center;padding:24px 16px;margin-top:8px}}
.footer p{{font-size:11px;color:#94a3b8}}
.footer a{{color:#c5a44e;text-decoration:none;font-weight:600}}
.footer a:hover{{text-decoration:underline}}

/* Animation */
@keyframes fadeUp{{from{{opacity:0;transform:translateY(12px)}}to{{opacity:1;transform:none}}}}
.fade-in{{animation:fadeUp .4s ease both}}

/* Mobile */
@media(max-width:640px){{
    .hdr-inner{{padding:20px 16px 28px}}
    .hdr h1{{font-size:17px}}
    .search-form{{flex-direction:column}}
    .search-period{{width:100%}}
    .search-btn{{width:100%;justify-content:center}}
    .fields-grid{{grid-template-columns:1fr}}
    .card-head{{flex-direction:column;align-items:flex-start;gap:8px}}
    .verified-card{{flex-direction:column;text-align:center;gap:10px}}
    .badge{{align-self:center}}
    .back-btn{{display:none}}
}}
</style>
</head>
<body>

<div class="hdr">
    <div class="hdr-inner">
        <a href="https://academico.iesppallende.edu.pe" class="back-btn">&#8592; Volver al inicio</a>
        <div class="hdr-top">
            <div class="hdr-logo">{IC["grad"]}</div>
            <div>
                <h1>Verificación de Matrícula</h1>
                <p>IESPP "{inst["name"]}" — Sistema Académico</p>
            </div>
        </div>
        <div class="hdr-badge">{IC["check"]} Consulta pública</div>
    </div>
</div>
<div class="gold-line"></div>

<div class="container">
    <div class="search-card fade-in">
        <div class="search-label">Buscar matrícula por N° de documento</div>
        <form method="get" action="/public/academic/enrollment" class="search-form">
            <div class="search-input-wrap">
                {IC["search"]}
                <input type="text" name="dni" value="{dni}" placeholder="Ingrese DNI del estudiante"
                       class="search-input" autocomplete="off">
            </div>
            <input type="text" name="period" value="{period}" placeholder="Período"
                   class="search-period" autocomplete="off">
            <button type="submit" class="search-btn">{IC["search"]} Verificar</button>
        </form>
    </div>

    {found_html}
    {detail_html}
    {courses_html}
    {error_html}
    {empty_html}

    <div class="footer">
        <p>IESPP "{inst["name"]}" &mdash; Sistema Académico<br>
        <a href="https://academico.iesppallende.edu.pe">Volver al portal principal</a></p>
    </div>
</div>

</body>
</html>'''

    return HttpResponse(html, content_type="text/html; charset=utf-8")
