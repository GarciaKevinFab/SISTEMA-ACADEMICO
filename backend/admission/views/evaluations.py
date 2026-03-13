"""
Vistas para Evaluación y Scoring

FIXES aplicados:
1. EvaluationScore ahora es ForeignKey + phase (no OneToOne).
   Todos los update_or_create incluyen phase en el lookup.
2. eval_list_for_scoring ahora filtra por call_id y career_id,
   y devuelve la estructura que el frontend espera.
3. eval_save_scores acepta phase opcional (default WRITTEN).
4. eval_import_scores separa fase1 y fase2 en scores separados.
"""
from django.db import transaction
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from admission.models import Application, EvaluationScore, ApplicationPreference
from admission.serializers import ApplicationSerializer
from .utils import _normalize_rubric, _compute_total, compute_phase_totals


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def eval_list_for_scoring(request):
    """
    Lista aplicaciones para evaluar.

    FIX: ahora filtra por call_id y career_id (el FE los envía como query params).
    Devuelve estructura plana con applicant_name, applicant_dni, rubric, etc.
    """
    call_id = request.query_params.get("call_id")
    career_id = request.query_params.get("career_id")

    qs = Application.objects.select_related("applicant").order_by("id")

    if call_id:
        qs = qs.filter(call_id=call_id)

    if career_id:
        qs = qs.filter(preferences__career_id=career_id).distinct()

    results = []
    for app in qs:
        # Obtener scores por fase
        written = EvaluationScore.objects.filter(
            application=app, phase="WRITTEN"
        ).first()
        interview = EvaluationScore.objects.filter(
            application=app, phase="INTERVIEW"
        ).first()

        # Combinar rubrics de ambas fases para mostrar en la tabla
        combined_rubric = {}
        if written:
            combined_rubric.update(written.rubric or {})
        if interview:
            combined_rubric.update(interview.rubric or {})

        p1, p2 = compute_phase_totals(written, interview)

        results.append({
            "id": app.id,
            "application_number": app.id,
            "applicant_name": app.applicant.names if app.applicant else "—",
            "applicant_dni": app.applicant.dni if app.applicant else "—",
            "career_name": app.career_name or "—",
            "status": app.status,
            "rubric": combined_rubric,
            "written_total": p1,
            "interview_total": p2,
            "total": round(p1 + p2, 2),
        })

    return Response({"applications": results})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def eval_save_scores(request, application_id):
    """
    Guardar calificaciones de evaluación.

    FIX: ahora incluye 'phase' en el lookup de update_or_create.
    Acepta phase en el payload (default: WRITTEN).
    """
    data = request.data or {}

    # Extraer phase del payload si viene, si no default WRITTEN
    phase = data.pop("phase", None) or data.pop("_phase", None) or "WRITTEN"
    phase = phase.upper().strip()
    if phase not in ("WRITTEN", "INTERVIEW"):
        phase = "WRITTEN"

    rubric = _normalize_rubric(data)
    total = _compute_total(rubric)

    try:
        app = Application.objects.get(id=application_id)
    except Application.DoesNotExist:
        return Response({"detail": "Postulación no encontrada"}, status=404)

    # FIX: incluir phase en el lookup
    score, created = EvaluationScore.objects.update_or_create(
        application=app,
        phase=phase,
        defaults={"rubric": rubric, "total": total},
    )

    # Actualizar status según fase evaluada
    if app.status not in ("ADMITTED", "NOT_ADMITTED"):
        if phase == "WRITTEN":
            # Fase 1 evaluada: APTO si >= 30/50, NO APTO si < 30
            if total >= 30:
                app.status = "PHASE1_PASSED"
            else:
                app.status = "PHASE1_FAILED"
        elif phase == "INTERVIEW":
            # Fase 2 evaluada: marcar como evaluado completo
            app.status = "PHASE2_SCORED"
        app.save(update_fields=["status"])

    return Response({
        "ok": True,
        "id": score.id,
        "phase": score.phase,
        "rubric": score.rubric,
        "total": float(score.total),
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def eval_bulk_compute(request):
    """Cálculo masivo de evaluaciones"""
    call_id = (request.data or {}).get("call_id")
    if not call_id:
        return Response({"detail": "call_id requerido"}, status=400)

    apps = Application.objects.filter(call_id=call_id).order_by("id")
    computed = 0

    for app in apps:
        written = EvaluationScore.objects.filter(
            application=app, phase="WRITTEN"
        ).first()
        interview = EvaluationScore.objects.filter(
            application=app, phase="INTERVIEW"
        ).first()

        if written or interview:
            w_total = float(written.total) if written else 0
            i_total = float(interview.total) if interview else 0
            final = round(w_total + i_total, 2)

            # Guardar final en data de la application
            app.data = {
                **(app.data or {}),
                "final_score": final,
                "written_total": w_total,
                "interview_total": i_total,
            }
            if app.status not in ("ADMITTED", "NOT_ADMITTED"):
                app.status = "EVALUATED"
            app.save(update_fields=["data", "status"])
            computed += 1

    return Response({"ok": True, "computed": computed})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def eval_import_scores(request):
    """
    Importar calificaciones desde Excel.

    FIX: ahora separa los campos de fase1 y fase2 en EvaluationScores
    separados con phase="WRITTEN" y phase="INTERVIEW" respectivamente.

    Campos fase1 (WRITTEN): comunicacion, resolucion_problemas, convivencia, fase1
    Campos fase2 (INTERVIEW): pensamiento_critico, trabajo_colaborativo, tic, fase2
    """
    payload = request.data or {}
    call_id = payload.get("call_id")
    career_id = payload.get("career_id")
    rows = payload.get("rows") or []

    if not call_id or not career_id:
        return Response(
            {"detail": "call_id y career_id son requeridos"},
            status=400,
        )
    if not isinstance(rows, list) or not rows:
        return Response({"detail": "rows debe ser una lista"}, status=400)

    apps_qs = (
        Application.objects.select_related("applicant")
        .filter(
            call_id=call_id,
            preferences__career_id=career_id,
            preferences__rank=1,
        )
    )

    apps_by_dni = {}
    for a in apps_qs:
        if a.applicant and a.applicant.dni:
            apps_by_dni[str(a.applicant.dni).strip()] = a

    updated = 0
    not_found = []
    invalid = 0

    # Campos que pertenecen a cada fase
    WRITTEN_KEYS = {"comunicacion", "resolucion_problemas", "convivencia", "fase1", "estado_fase_1"}
    INTERVIEW_KEYS = {"pensamiento_critico", "trabajo_colaborativo", "tic", "fase2"}

    with transaction.atomic():
        for r in rows:
            dni = str((r or {}).get("dni") or "").strip()
            rubric_raw = (r or {}).get("rubric") or {}

            if not dni:
                invalid += 1
                continue

            app = apps_by_dni.get(dni)
            if not app:
                not_found.append(dni)
                continue

            full_rubric = _normalize_rubric(rubric_raw)

            # Separar en fase1 (WRITTEN) y fase2 (INTERVIEW)
            written_rubric = {}
            interview_rubric = {}
            other_rubric = {}

            for k, v in full_rubric.items():
                if k in WRITTEN_KEYS:
                    written_rubric[k] = v
                elif k in INTERVIEW_KEYS:
                    interview_rubric[k] = v
                else:
                    # campos como "condicion" van a ambos o a written
                    other_rubric[k] = v

            # Guardar score WRITTEN si hay datos
            if written_rubric:
                wr = {**written_rubric, **other_rubric}
                w_total = _compute_total(wr)
                EvaluationScore.objects.update_or_create(
                    application=app,
                    phase="WRITTEN",
                    defaults={"rubric": wr, "total": w_total},
                )

            # Guardar score INTERVIEW si hay datos
            if interview_rubric:
                i_total = _compute_total(interview_rubric)
                EvaluationScore.objects.update_or_create(
                    application=app,
                    phase="INTERVIEW",
                    defaults={"rubric": interview_rubric, "total": i_total},
                )

            # Si no hay separación clara, guardar todo como WRITTEN
            if not written_rubric and not interview_rubric and full_rubric:
                total = _compute_total(full_rubric)
                EvaluationScore.objects.update_or_create(
                    application=app,
                    phase="WRITTEN",
                    defaults={"rubric": full_rubric, "total": total},
                )

            # Actualizar status
            if app.status not in ("EVALUATED", "ADMITTED", "NOT_ADMITTED"):
                app.status = "EVALUATED"
                app.save(update_fields=["status"])

            updated += 1

    return Response({
        "ok": True,
        "updated": updated,
        "invalid_rows": invalid,
        "not_found_count": len(not_found),
        "not_found_dnies": not_found[:200],
    })