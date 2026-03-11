"""
Vistas para Resultados y Publicación
"""
import logging
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from admission.models import (
    AdmissionCall,
    Application,
    ApplicationPreference,
    Applicant,
    EvaluationScore,
    ResultPublication,
)
from admission.serializers import ApplicationSerializer
from .utils import _ensure_media_tmp, _write_stub_pdf

logger = logging.getLogger(__name__)


@api_view(["GET"])
@permission_classes([AllowAny])
def results_list(request):
    """
    Lista resultados de convocatorias.
    FIX: ahora soporta filtro por career_id (el FE lo envía desde ResultsPublication).
    """
    call_id = request.query_params.get("call_id")
    career_id = request.query_params.get("career_id")

    qs = Application.objects.all().order_by("id")

    if call_id:
        qs = qs.filter(call_id=call_id)

    # FIX: filtrar por carrera a través de preferencias
    if career_id:
        qs = qs.filter(preferences__career_id=career_id).distinct()

    # Construir respuesta con scores
    results = []
    for app in qs.select_related("applicant"):
        # FIX: EvaluationScore ahora tiene campo 'phase' y es ForeignKey
        written = EvaluationScore.objects.filter(
            application=app, phase="WRITTEN"
        ).first()
        interview = EvaluationScore.objects.filter(
            application=app, phase="INTERVIEW"
        ).first()

        phase1_total = float(written.total) if written else 0
        phase2_total = float(interview.total) if interview else 0
        final_score = phase1_total + phase2_total

        results.append({
            "application_id": app.id,
            "application_number": app.id,
            "applicant_name": app.applicant.names if app.applicant else "—",
            "career_name": app.career_name or "—",
            "phase1_total": phase1_total,
            "phase2_total": phase2_total,
            "final_score": final_score,
            "status": app.status,
        })

    # Ordenar por puntaje final descendente
    results.sort(key=lambda r: r["final_score"], reverse=True)

    # Check si ya fue publicado
    published = False
    if call_id:
        pub = ResultPublication.objects.filter(call_id=call_id).first()
        published = pub.published if pub else False

    return Response({
        "results": results,
        "published": published,
    })


def _build_public_result(call_id, dni):
    """
    Lógica compartida para consulta pública de resultados.
    Retorna (response_data, status_code).
    """
    if not call_id or not dni:
        return {"detail": "call_id y dni requeridos"}, 400

    applicant = Applicant.objects.select_related("user").filter(dni=dni).first()
    if not applicant:
        return {"detail": "No encontrado"}, 404

    app = Application.objects.filter(
        call_id=call_id, applicant=applicant
    ).first()
    if not app:
        return {"detail": "No encontrado"}, 404

    # FIX: usar phase field en vez de asumir OneToOne
    written = EvaluationScore.objects.filter(
        application=app, phase="WRITTEN"
    ).first()
    interview = EvaluationScore.objects.filter(
        application=app, phase="INTERVIEW"
    ).first()

    prefs = (
        ApplicationPreference.objects.filter(application=app)
        .select_related("career")
        .order_by("rank")
    )
    pref_names = [{"rank": p.rank, "career": p.career.name} for p in prefs]

    phase1_total = float(written.total) if written else None
    phase2_total = float(interview.total) if interview else None
    final_total = None
    if phase1_total is not None and phase2_total is not None:
        final_total = phase1_total + phase2_total

    # Datos del pago (si existe)
    payment_data = {"required": False, "amount": 0, "status": None}
    payment_obj = None
    try:
        payment_obj = app.payment
    except Exception:
        pass

    if payment_obj:
        payment_data = {
            "required": True,
            "amount": float(payment_obj.amount),
            "status": payment_obj.status,
        }

    # Credenciales de acceso (solo si pago verificado y tiene usuario)
    credentials_data = None
    if app.status == "ADMITTED" and applicant.user:
        # Buscar password en meta del payment (se guardó al confirmar)
        stored_password = None
        if payment_obj and payment_obj.meta:
            stored_password = payment_obj.meta.get("generated_password")

        credentials_data = {
            "username": applicant.user.username,
            "password": stored_password or "(Consulte con la institución)",
            "message": "Use estas credenciales para ingresar al sistema académico.",
        }

    return {
        "call_id": int(call_id),
        "application_id": app.id,
        "dni": dni,
        "names": applicant.names,
        "status": app.status,
        "career_name": app.career_name or (pref_names[0]["career"] if pref_names else "—"),
        "career_preferences": pref_names,
        "applicant": {
            "names": applicant.names,
            "dni": applicant.dni,
            "email": applicant.email,
        },
        "score": {
            "phase1_total": phase1_total,
            "phase2_total": phase2_total,
            "final_total": final_total,
        } if (phase1_total is not None or phase2_total is not None) else None,
        "written": {
            "total": phase1_total,
            "rubric": written.rubric if written else None,
        },
        "interview": {
            "total": phase2_total,
            "rubric": interview.rubric if interview else None,
        },
        "final": {"admitted": app.status == "ADMITTED"},
        "payment": payment_data,
        "credentials": credentials_data,
    }, 200


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def public_results(request):
    """
    Consulta de resultado individual (público) por query params.
    GET /admission/public/results?call_id=X&dni=Y
    """
    call_id = request.query_params.get("call_id")
    dni = (request.query_params.get("dni") or "").strip()
    data, status = _build_public_result(call_id, dni)
    return Response(data, status=status)


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def public_results_by_path(request, call_id: int, dni: str):
    """
    FIX: Consulta de resultado individual (público) por path params.
    GET /admission/public/results/<call_id>/<dni>
    GET /public/results/<call_id>/<dni>

    El frontend (PublicAdmissionCalls.jsx) usa este formato:
        api.get(`/public/results/${admissionCallId}/${documentNumber}`)
    """
    data, status = _build_public_result(call_id, dni.strip())
    return Response(data, status=status)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def results_publish(request):
    """
    Publicar resultados de convocatoria.
    FIX: acepta career_id opcional (el FE lo envía pero antes se ignoraba).
    """
    payload = request.data or {}
    call_id = payload.get("call_id")
    career_id = payload.get("career_id")  # Ahora lo aceptamos

    if not call_id:
        return Response({"detail": "call_id requerido"}, status=400)

    try:
        call = AdmissionCall.objects.get(pk=call_id)
    except AdmissionCall.DoesNotExist:
        return Response({"detail": "call not found"}, status=404)

    call.published = True
    call.save(update_fields=["published"])

    pub_payload = {"published_at": timezone.now().isoformat()}
    if career_id:
        pub_payload["career_id"] = career_id

    ResultPublication.objects.update_or_create(
        call=call,
        defaults={
            "published": True,
            "payload": pub_payload,
        },
    )

    return Response({"ok": True, "published": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def results_close(request):
    """Cerrar convocatoria"""
    payload = request.data or {}
    call_id = payload.get("call_id")
    career_id = payload.get("career_id")

    if not call_id:
        return Response({"detail": "call_id requerido"}, status=400)

    try:
        call = AdmissionCall.objects.get(pk=call_id)
    except AdmissionCall.DoesNotExist:
        return Response({"detail": "call not found"}, status=404)

    meta = call.meta or {}
    meta["closed"] = True
    if career_id:
        closed_careers = meta.get("closed_careers", [])
        if career_id not in closed_careers:
            closed_careers.append(career_id)
        meta["closed_careers"] = closed_careers

    call.meta = meta
    call.save(update_fields=["meta"])

    return Response({"ok": True, "closed": True})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def results_acta_pdf(request):
    """Generar acta de resultados en PDF con formato institucional."""
    call_id = request.query_params.get("call_id")
    career_id = request.query_params.get("career_id") or ""

    if not call_id:
        return Response({"detail": "call_id requerido"}, status=400)

    try:
        call = AdmissionCall.objects.get(pk=call_id)
    except AdmissionCall.DoesNotExist:
        return Response({"detail": "Convocatoria no encontrada"}, status=404)

    # Obtener aplicaciones
    qs = Application.objects.filter(call_id=call_id).select_related("applicant")
    if career_id:
        qs = qs.filter(preferences__career_id=career_id).distinct()

    # Construir resultados con scores
    results = []
    for app in qs:
        written = EvaluationScore.objects.filter(
            application=app, phase="WRITTEN"
        ).first()
        interview = EvaluationScore.objects.filter(
            application=app, phase="INTERVIEW"
        ).first()

        p1 = float(written.total) if written else 0
        p2 = float(interview.total) if interview else 0

        results.append({
            "applicant_name": app.applicant.names if app.applicant else "—",
            "dni": app.applicant.dni if app.applicant else "—",
            "phase1_total": p1,
            "phase2_total": p2,
            "final_score": p1 + p2,
            "status": app.status,
        })

    results.sort(key=lambda r: r["final_score"], reverse=True)

    # Datos de la convocatoria
    meta = call.meta or {}
    career_name = ""
    if career_id:
        from catalogs.models import Career
        c = Career.objects.filter(pk=career_id).first()
        career_name = c.name if c else ""

    call_data = {
        "call_name": call.title,
        "career_name": career_name,
        "academic_year": meta.get("academic_year", ""),
        "academic_period": meta.get("academic_period", ""),
    }

    # Datos institucionales
    try:
        from .certificates import _build_inst_dict
        from .admission_certificates_generator import _img_b64, _get_media_root
        inst = _build_inst_dict()
        mr = _get_media_root()
        inst["logo_b64"] = _img_b64(inst.get("logo_path", ""), mr)
        inst["firma_b64"] = _img_b64(inst.get("firma_director_path", ""), mr)
        inst["sello_b64"] = _img_b64(inst.get("sello_path", ""), mr)
    except Exception as e:
        logger.warning(f"Error cargando datos institucionales: {e}")
        inst = {"institution_name": "GUSTAVO ALLENDE LLAVERÍA", "city": "Tarma"}

    # Generar PDF
    try:
        from .admission_acta_generator import generate_acta_pdf, HAS_WEASYPRINT
        if HAS_WEASYPRINT:
            pdf_bytes = generate_acta_pdf(results, call_data, inst)
        else:
            raise ImportError("WeasyPrint no disponible")
    except ImportError:
        # Fallback: usar reportlab
        try:
            from .admission_acta_reportlab import generate_acta_pdf_reportlab
            pdf_bytes = generate_acta_pdf_reportlab(results, call_data, inst)
        except Exception as e2:
            logger.error(f"Error generando acta con reportlab: {e2}")
            # Último fallback: stub PDF
            tmpdir = _ensure_media_tmp()
            fname = f"acta-call-{call_id}.pdf"
            abs_path = tmpdir + "/" + fname
            _write_stub_pdf(
                abs_path,
                title="Acta de Resultados",
                subtitle=f"Convocatoria: {call.title}" + (f" | Carrera: {career_name}" if career_name else ""),
            )
            with open(abs_path, "rb") as f:
                pdf_bytes = f.read()

    filename = f"acta_{call_id}"
    if career_id:
        filename += f"_{career_id}"
    filename += ".pdf"

    resp = HttpResponse(pdf_bytes, content_type="application/pdf")
    resp["Content-Disposition"] = f'attachment; filename="{filename}"'
    return resp