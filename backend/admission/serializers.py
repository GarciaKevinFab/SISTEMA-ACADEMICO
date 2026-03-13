from rest_framework import serializers

from catalogs.models import Career

from .models import (
    AdmissionCall,
    AdmissionScheduleItem,
    Applicant,
    Application,
    ApplicationPreference,
    ApplicationDocument,
    Payment,
    EvaluationScore,
    AdmissionParam,
)


class CareerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Career
        fields = "__all__"


class AdmissionCallSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdmissionCall
        fields = "__all__"


class AdmissionScheduleItemSerializer(serializers.ModelSerializer):
    # El frontend usa "type" y "title"; el modelo usa "kind" y "label".
    type = serializers.CharField(source="kind", required=False, default="")
    title = serializers.CharField(source="label")

    class Meta:
        model = AdmissionScheduleItem
        fields = ["id", "call", "type", "title", "start", "end", "notes"]


class ApplicantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Applicant
        fields = "__all__"

    def validate_dni(self, value):
        v = (value or "").strip()
        if not v.isdigit() or len(v) != 8:
            raise serializers.ValidationError(
                "El DNI debe contener exactamente 8 dígitos numéricos"
            )
        return v


class ApplicationPreferenceSerializer(serializers.ModelSerializer):
    career_id = serializers.IntegerField(source="career.id", read_only=True)
    career_name = serializers.CharField(source="career.name", read_only=True)

    class Meta:
        model = ApplicationPreference
        fields = ["id", "career_id", "career_name", "rank"]


class ApplicationSerializer(serializers.ModelSerializer):
    # input: [1,2,3]
    career_preferences = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
    )

    # output: [{career_id, career_name, rank}, ...]
    preferences = ApplicationPreferenceSerializer(many=True, read_only=True)

    # ══════════════════════════════════════════════════════
    # FIX: Campos expandidos para que el frontend pueda
    # mostrar DNI, nombres, email sin depender solo de data.profile
    # ══════════════════════════════════════════════════════
    applicant_detail = serializers.SerializerMethodField()
    applicant_name = serializers.SerializerMethodField()
    applicant_dni = serializers.SerializerMethodField()
    call_id = serializers.IntegerField(source="call.id", read_only=True)
    call_name = serializers.SerializerMethodField()
    created_at = serializers.SerializerMethodField()

    class Meta:
        model = Application
        fields = [
            "id",
            "call",
            "call_id",
            "call_name",
            "applicant",
            "applicant_detail",
            "applicant_name",
            "applicant_dni",
            "career_name",
            "status",
            "data",
            "career_preferences",
            "preferences",
            "created_at",
        ]

    # ── Metodos de campos expandidos ──

    def get_applicant_detail(self, obj):
        """Devuelve los datos del applicant como objeto expandido."""
        if not obj.applicant:
            return None
        return {
            "id": obj.applicant.id,
            "dni": obj.applicant.dni or "",
            "names": obj.applicant.names or "",
            "email": obj.applicant.email or "",
            "phone": obj.applicant.phone or "",
        }

    def get_applicant_name(self, obj):
        """
        Nombre completo del postulante.
        Busca en data.profile (datos MINEDU) y luego en Applicant.
        """
        if not obj.applicant:
            return ""

        data = obj.data if isinstance(obj.data, dict) else {}
        profile = data.get("profile") or {}

        # Campos en espanol (ApplicationWizard interno)
        nombres = profile.get("nombres") or ""
        ap_pat = profile.get("apellido_paterno") or ""
        ap_mat = profile.get("apellido_materno") or ""

        # Campos en ingles (PublicApplicationWizard)
        if not nombres:
            nombres = profile.get("first_names") or ""
        if not ap_pat:
            ap_pat = profile.get("last_name_father") or ""
        if not ap_mat:
            ap_mat = profile.get("last_name_mother") or ""

        if ap_pat or ap_mat or nombres:
            apellidos = " ".join(filter(None, [ap_pat, ap_mat]))
            if apellidos and nombres:
                return f"{apellidos}, {nombres}"
            return apellidos or nombres

        # Fallback al modelo Applicant
        return obj.applicant.names or ""

    def get_applicant_dni(self, obj):
        """DNI del postulante desde data.profile o Applicant."""
        if not obj.applicant:
            return ""

        data = obj.data if isinstance(obj.data, dict) else {}
        profile = data.get("profile") or {}

        dni = (
            profile.get("document_number")
            or profile.get("dni")
            or profile.get("numero_documento_identidad")
            or ""
        )
        if dni:
            return str(dni)

        return obj.applicant.dni or ""

    def get_call_name(self, obj):
        """Nombre de la convocatoria."""
        if obj.call:
            return getattr(obj.call, "title", "") or getattr(obj.call, "name", "") or ""
        return ""

    def get_created_at(self, obj):
        """Fecha de creacion (si existe el campo)."""
        if hasattr(obj, "created_at") and obj.created_at:
            return obj.created_at.isoformat()
        return None

    # ── Validacion y creacion (sin cambios respecto a tu original) ──

    def validate(self, attrs):
        prefs = attrs.get("career_preferences") or []
        career_name = (attrs.get("career_name") or "").strip()

        if not career_name and not prefs:
            raise serializers.ValidationError(
                {"career_name": "Se requiere career_name o career_preferences."}
            )

        if prefs:
            existing = set(
                Career.objects.filter(id__in=prefs).values_list("id", flat=True)
            )
            missing = [cid for cid in prefs if cid not in existing]
            if missing:
                raise serializers.ValidationError(
                    {"career_preferences": f"Carreras no existen en catalogos: {missing}"}
                )

        return attrs

    def create(self, validated_data):
        prefs = validated_data.pop("career_preferences", []) or []

        if prefs and not (validated_data.get("career_name") or "").strip():
            first = Career.objects.filter(id=prefs[0]).first()
            validated_data["career_name"] = first.name if first else "Sin carrera"

        app = Application.objects.create(**validated_data)

        if prefs:
            careers = {c.id: c for c in Career.objects.filter(id__in=prefs)}
            rows = []
            for rank, cid in enumerate(prefs, start=1):
                c = careers.get(cid)
                if not c:
                    continue
                rows.append(
                    ApplicationPreference(application=app, career=c, rank=rank)
                )
            ApplicationPreference.objects.bulk_create(rows)

        app.data = {**(app.data or {}), "career_preferences": prefs}
        app.save(update_fields=["data"])

        return app


class ApplicationDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ApplicationDocument
        fields = "__all__"


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = "__all__"


class EvaluationScoreSerializer(serializers.ModelSerializer):
    """
    FIX: ahora incluye 'phase' en los campos.
    El modelo cambio de OneToOneField a ForeignKey + phase.
    """

    class Meta:
        model = EvaluationScore
        fields = "__all__"


class AdmissionParamSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdmissionParam
        fields = "__all__"