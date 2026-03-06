// src/modules/admission/ApplicationWizard.jsx
//
// Flujo completo de postulación pública (sin login):
//   1. Seleccionar convocatoria (ver detalles, vacantes, fechas)
//   2. Datos personales (formato MINEDU)
//   3. Elegir carreras en orden de preferencia
//   4. **Adjuntar documentos** (foto, DNI, certificados, etc.)
//   5. Revisar y enviar → POST /admission/public/apply
//   6. Confirmación (N° postulación, instrucciones de pago si aplica)

import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  AdmissionCalls,
  AdmissionPublic,
} from "../../services/admission.service";

import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Badge } from "../../components/ui/badge";
import { toast } from "sonner";
import {
  CheckCircle2,
  Circle,
  CreditCard,
  FileText,
  Calendar,
  GraduationCap,
  User,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Clock,
  Users,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  Printer,
  Upload,
  Camera,
  Paperclip,
  X,
  Image,
  Shield,
  Eye,
} from "lucide-react";

// ═══════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════

const STEPS = [
  { id: 1, key: "CALL", label: "Convocatoria", icon: Calendar },
  { id: 2, key: "DATA", label: "Datos Personales", icon: User },
  { id: 3, key: "CAREERS", label: "Carreras", icon: GraduationCap },
  { id: 4, key: "DOCUMENTS", label: "Documentos", icon: Paperclip },
  { id: 5, key: "REVIEW", label: "Confirmar", icon: CheckCircle2 },
];

const SEX_OPTIONS = [
  { value: "MASCULINO", label: "Masculino" },
  { value: "FEMENINO", label: "Femenino" },
];

const DOC_TYPES = [
  { value: "DNI", label: "DNI" },
  { value: "CE", label: "Carné de Extranjería" },
];

const CIVIL_STATUS = [
  { value: "SOLTERO", label: "Soltero(a)" },
  { value: "CASADO", label: "Casado(a)" },
  { value: "CONVIVIENTE", label: "Conviviente" },
  { value: "DIVORCIADO", label: "Divorciado(a)" },
  { value: "VIUDO", label: "Viudo(a)" },
];

const MODALIDAD_ADMISION = [
  { value: "INGRESO ORDINARIO", label: "Ingreso Ordinario" },
  {
    value: "INGRESO POR PROGRAMAS DE PREPARACION",
    label: "Ingreso por Programas de Preparación (Solo EESP)",
  },
  { value: "INGRESO POR EXCELENCIA", label: "Ingreso por Excelencia" },
];

const EMPTY_FORM = {
  doc_type: "DNI",
  dni: "",
  names: "",
  apellido_paterno: "",
  apellido_materno: "",
  sexo: "",
  fecha_nacimiento: "",
  email: "",
  phone: "",
  nacionalidad: "PERUANO",
  direccion: "",
  estado_civil: "SOLTERO",
  lengua_materna: "CASTELLANO",
  discapacidad: "NO",
  modalidad_admision: "INGRESO ORDINARIO",
  colegio_procedencia: "",
  anio_egreso: "",
};

// Documentos requeridos por defecto
const DEFAULT_REQUIRED_DOCS = [
  {
    type: "FOTO_CARNET",
    label: "Fotografía tamaño carné",
    description: "Foto actual, fondo blanco, con terno/blusa formal",
    accept: "image/jpeg,image/png,image/webp",
    icon: Camera,
    isPhoto: true,
    required: true,
  },
  {
    type: "COPIA_DNI",
    label: "Copia de DNI",
    description: "Ambas caras del documento de identidad vigente",
    accept: "image/jpeg,image/png,application/pdf",
    icon: FileText,
    required: true,
  },
  {
    type: "PARTIDA_NACIMIENTO",
    label: "Partida de Nacimiento",
    description: "Original o copia legalizada",
    accept: "image/jpeg,image/png,application/pdf",
    icon: FileText,
    required: true,
  },
  {
    type: "CERTIFICADO_ESTUDIOS",
    label: "Certificado de Estudios",
    description: "Certificado de estudios secundarios completos",
    accept: "image/jpeg,image/png,application/pdf",
    icon: FileText,
    required: true,
  },
  {
    type: "CARNET_CONADIS",
    label: "Carné CONADIS (si aplica)",
    description: "Solo si tiene alguna discapacidad registrada",
    accept: "image/jpeg,image/png,application/pdf",
    icon: Shield,
    required: false,
  },
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

const fmtDate = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
};

const fmtFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// ═══════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════

export default function ApplicationWizard() {
  const [step, setStep] = useState(1);
  const [loadingCalls, setLoadingCalls] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Step 1
  const [calls, setCalls] = useState([]);
  const [selectedCall, setSelectedCall] = useState(null);

  // Step 2
  const [form, setForm] = useState({ ...EMPTY_FORM });

  // Step 3
  const [preferences, setPreferences] = useState([]);

  // Step 4 - Documentos
  // { FOTO_CARNET: { file: File, preview: string|null }, COPIA_DNI: { file: File }, ... }
  const [attachments, setAttachments] = useState({});

  // Step 6 (resultado)
  const [result, setResult] = useState(null);

  // ── Carga inicial ──
  useEffect(() => {
    (async () => {
      try {
        setLoadingCalls(true);
        const data = await AdmissionCalls.listPublic();
        const list = Array.isArray(data) ? data : data?.calls || data || [];
        setCalls(list);
      } catch {
        toast.error("No se pudieron cargar las convocatorias");
      } finally {
        setLoadingCalls(false);
      }
    })();
  }, []);

  // ── Helpers de form ──
  const setField = (key, val) => setForm((p) => ({ ...p, [key]: val }));

  const fullName = useMemo(
    () =>
      [form.names, form.apellido_paterno, form.apellido_materno]
        .filter(Boolean)
        .join(" ")
        .trim(),
    [form.names, form.apellido_paterno, form.apellido_materno]
  );

  const careers = useMemo(
    () => (selectedCall?.careers || []).filter((c) => (c.vacancies ?? 0) > 0),
    [selectedCall]
  );

  const totalVacancies = useMemo(
    () => careers.reduce((s, c) => s + (c.vacancies || 0), 0),
    [careers]
  );

  // Documentos requeridos (de la convocatoria o por defecto)
  const requiredDocs = useMemo(() => {
    const callDocs = selectedCall?.required_documents;
    if (callDocs && Array.isArray(callDocs) && callDocs.length > 0) {
      return callDocs.map((cd) => {
        // Soportar tanto strings ("FOTO_CARNET") como objetos ({type:"FOTO_CARNET",...})
        const docType = typeof cd === "string" ? cd : cd.type;
        const def = DEFAULT_REQUIRED_DOCS.find((d) => d.type === docType);
        return {
          type: docType,
          label: (typeof cd === "object" && cd.label) || def?.label || docType,
          description: (typeof cd === "object" && cd.description) || def?.description || "",
          accept: (typeof cd === "object" && cd.accept) || def?.accept || "image/jpeg,image/png,application/pdf",
          icon: def?.icon || FileText,
          isPhoto: def?.isPhoto || docType === "FOTO_CARNET",
          required: (typeof cd === "object" ? cd.required : undefined) ?? def?.required ?? true,
        };
      });
    }
    return [...DEFAULT_REQUIRED_DOCS];
  }, [selectedCall]);

  // Conteo de documentos obligatorios subidos
  const docsRequired = requiredDocs.filter((d) => d.required);
  const docsUploaded = docsRequired.filter((d) => attachments[d.type]?.file);

  // ── Validaciones por paso ──
  const canNext = useMemo(() => {
    if (step === 1) return !!selectedCall;
    if (step === 2) {
      return (
        form.dni.trim().length >= 8 &&
        form.names.trim().length >= 2 &&
        form.apellido_paterno.trim().length >= 2 &&
        form.email.trim().includes("@") &&
        form.sexo &&
        form.fecha_nacimiento
      );
    }
    if (step === 3) return preferences.length > 0;
    if (step === 4) {
      // Todos los obligatorios deben tener archivo
      return docsRequired.every((d) => attachments[d.type]?.file);
    }
    return true;
  }, [step, selectedCall, form, preferences, attachments, docsRequired]);

  // ── Navegar ──
  const goNext = () => {
    if (step < 5 && canNext) setStep((s) => s + 1);
  };
  const goBack = () => {
    if (step > 1) setStep((s) => s - 1);
  };

  // ── Preferencias (reordenar) ──
  const toggleCareer = (careerId) => {
    setPreferences((prev) =>
      prev.includes(careerId)
        ? prev.filter((id) => id !== careerId)
        : [...prev, careerId]
    );
  };

  const moveUp = (idx) => {
    if (idx === 0) return;
    setPreferences((prev) => {
      const arr = [...prev];
      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
      return arr;
    });
  };

  const moveDown = (idx) => {
    setPreferences((prev) => {
      if (idx >= prev.length - 1) return prev;
      const arr = [...prev];
      [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
      return arr;
    });
  };

  // ── Adjuntar archivo ──
  const handleAttach = (docType, file, isPhoto) => {
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`El archivo excede el límite de 5 MB`);
      return;
    }

    const entry = { file, preview: null };

    if (isPhoto && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        entry.preview = ev.target.result;
        setAttachments((prev) => ({ ...prev, [docType]: { ...entry } }));
      };
      reader.readAsDataURL(file);
    } else {
      setAttachments((prev) => ({ ...prev, [docType]: entry }));
    }
  };

  const removeAttachment = (docType) => {
    setAttachments((prev) => {
      const copy = { ...prev };
      delete copy[docType];
      return copy;
    });
  };

  // ── SUBMIT → public_apply con archivos ──
  const handleSubmit = async () => {
    if (!selectedCall || preferences.length === 0) return;

    setSubmitting(true);
    try {
      // Construir FormData con datos + archivos
      const formData = new FormData();

      // Datos JSON
      const payload = {
        call_id: selectedCall.id,
        career_preferences: preferences,
        applicant: {
          dni: form.dni.trim(),
          names: fullName,
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim(),
        },
        profile: {
          doc_type: form.doc_type,
          nombres: form.names.trim(),
          apellido_paterno: form.apellido_paterno.trim(),
          apellido_materno: form.apellido_materno.trim(),
          sexo: form.sexo,
          fecha_nacimiento: form.fecha_nacimiento,
          nacionalidad: form.nacionalidad,
          direccion: form.direccion,
          estado_civil: form.estado_civil,
          lengua_materna: form.lengua_materna,
          discapacidad: form.discapacidad,
          modalidad_admision: form.modalidad_admision,
        },
        school: {
          colegio_procedencia: form.colegio_procedencia,
          anio_egreso: form.anio_egreso,
        },
      };

      formData.append("data", JSON.stringify(payload));

      // Adjuntar archivos
      Object.entries(attachments).forEach(([docType, { file }]) => {
        if (file) {
          formData.append(`doc_${docType}`, file, file.name);
        }
      });

      const resp = await AdmissionPublic.apply(formData);

      setResult({
        application_id: resp.application_id,
        application_number: resp.application_number,
        status: resp.status,
        call: selectedCall,
      });
      setStep(6);
      toast.success("¡Postulación registrada exitosamente!");
    } catch (e) {
      const detail =
        e?.response?.data?.detail ||
        e?.message ||
        "Error al registrar postulación";
      toast.error(detail);
    } finally {
      setSubmitting(false);
    }
  };

  // ═══════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 sm:pb-12">
      {/* HEADER */}
      <div className="pb-4">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
          Postulación al Proceso de Admisión
        </h2>
        <p className="text-gray-500 mt-1 text-sm">
          Complete los siguientes pasos para registrar su postulación.
        </p>
      </div>

      {/* STEPPER */}
      {step <= 5 && (
        <div className="grid grid-cols-5 bg-white border rounded-xl overflow-hidden shadow-sm">
          {STEPS.map((s) => {
            const Icon = s.icon;
            const active = step === s.id;
            const done = step > s.id;
            return (
              <div
                key={s.id}
                className={`flex flex-col items-center py-3 px-1 gap-1 border-b-2 transition-all ${active
                    ? "border-blue-600 bg-blue-50/60 text-blue-700"
                    : done
                      ? "border-green-500 text-green-600"
                      : "border-transparent text-gray-400"
                  }`}
              >
                {done ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider hidden sm:block">
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <Card className="border shadow-lg rounded-2xl overflow-hidden bg-white">
        <CardContent className="p-6 sm:p-10">
          {/* ════════════════════════════════════════ */}
          {/* STEP 1: SELECCIONAR CONVOCATORIA        */}
          {/* ════════════════════════════════════════ */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div>
                <Label className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                  Seleccione el Proceso de Admisión
                </Label>
                <p className="text-xs text-gray-500 mt-1">
                  Solo se muestran convocatorias con inscripciones abiertas.
                </p>
              </div>

              <Select
                disabled={loadingCalls}
                value={selectedCall ? String(selectedCall.id) : undefined}
                onValueChange={(val) => {
                  const found = calls.find(
                    (x) => String(x.id) === String(val)
                  );
                  setSelectedCall(found || null);
                  setPreferences([]);
                }}
              >
                <SelectTrigger className="h-12 text-base border-gray-300 rounded-xl">
                  <SelectValue
                    placeholder={
                      loadingCalls
                        ? "Cargando..."
                        : calls.length === 0
                          ? "No hay convocatorias abiertas"
                          : "Seleccionar convocatoria..."
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {calls.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)} className="py-3">
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedCall && (
                <div className="space-y-4 border rounded-xl p-5 bg-gray-50/50 animate-in fade-in duration-500">
                  <h3 className="font-bold text-gray-900 text-lg">
                    {selectedCall.name}
                  </h3>
                  {selectedCall.description && (
                    <p className="text-sm text-gray-600">{selectedCall.description}</p>
                  )}
                  <div className="grid sm:grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Clock className="h-4 w-4 text-blue-500 shrink-0" />
                      <span>
                        Inscripciones:{" "}
                        <strong>
                          {fmtDate(selectedCall.registration_start)} —{" "}
                          {fmtDate(selectedCall.registration_end)}
                        </strong>
                      </span>
                    </div>
                    {selectedCall.exam_date && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <FileText className="h-4 w-4 text-orange-500 shrink-0" />
                        <span>
                          Examen: <strong>{fmtDate(selectedCall.exam_date)}</strong>
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-gray-600">
                      <Users className="h-4 w-4 text-green-500 shrink-0" />
                      <span>
                        Vacantes totales: <strong>{totalVacancies}</strong>
                      </span>
                    </div>
                    {(selectedCall.application_fee ?? 0) > 0 && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <CreditCard className="h-4 w-4 text-purple-500 shrink-0" />
                        <span>
                          Derecho de inscripción:{" "}
                          <strong>S/. {selectedCall.application_fee}</strong>
                        </span>
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                      Programas de Estudios Disponibles
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {(selectedCall.careers || []).map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between px-3 py-2 bg-white rounded-lg border text-sm"
                        >
                          <span className="font-medium text-gray-700">{c.name}</span>
                          <Badge
                            variant={(c.vacancies || 0) > 0 ? "default" : "destructive"}
                            className="text-[10px]"
                          >
                            {c.vacancies || 0} vacantes
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════ */}
          {/* STEP 2: DATOS PERSONALES                */}
          {/* ════════════════════════════════════════ */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div>
                <Label className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                  Datos del Postulante
                </Label>
                <p className="text-xs text-gray-500 mt-1">
                  Complete sus datos tal como aparecen en su documento de identidad.
                </p>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <FormSelect label="Tipo documento *" value={form.doc_type} onChange={(v) => setField("doc_type", v)} options={DOC_TYPES} />
                <FormInput label="N° documento *" value={form.dni} onChange={(v) => setField("dni", v)} placeholder="Ej: 70123456" maxLength={12} />
                <FormSelect label="Nacionalidad" value={form.nacionalidad} onChange={(v) => setField("nacionalidad", v)} options={[{ value: "PERUANO", label: "Peruano(a)" }, { value: "EXTRANJERO", label: "Extranjero(a)" }]} />
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <FormInput label="Nombres *" value={form.names} onChange={(v) => setField("names", v)} placeholder="Nombres completos" />
                <FormInput label="Apellido paterno *" value={form.apellido_paterno} onChange={(v) => setField("apellido_paterno", v)} placeholder="Apellido paterno" />
                <FormInput label="Apellido materno" value={form.apellido_materno} onChange={(v) => setField("apellido_materno", v)} placeholder="Apellido materno" />
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <FormSelect label="Sexo *" value={form.sexo} onChange={(v) => setField("sexo", v)} options={SEX_OPTIONS} placeholder="Seleccionar" />
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha de nacimiento *</Label>
                  <Input type="date" value={form.fecha_nacimiento} onChange={(e) => setField("fecha_nacimiento", e.target.value)} className="h-11 border-gray-300 rounded-xl" />
                </div>
                <FormSelect label="Estado civil" value={form.estado_civil} onChange={(v) => setField("estado_civil", v)} options={CIVIL_STATUS} />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <FormInput label="Correo electrónico *" value={form.email} onChange={(v) => setField("email", v)} placeholder="correo@ejemplo.com" type="email" />
                <FormInput label="Teléfono celular" value={form.phone} onChange={(v) => setField("phone", v)} placeholder="900 000 000" type="tel" />
              </div>

              <FormInput label="Dirección de domicilio" value={form.direccion} onChange={(v) => setField("direccion", v)} placeholder="Jr. / Av. / Calle..." />

              <div className="border-t pt-4 space-y-4">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Datos Académicos</div>
                <div className="grid sm:grid-cols-3 gap-4">
                  <FormInput label="Colegio de procedencia" value={form.colegio_procedencia} onChange={(v) => setField("colegio_procedencia", v)} placeholder="Nombre del colegio" />
                  <FormInput label="Año de egreso" value={form.anio_egreso} onChange={(v) => setField("anio_egreso", v)} placeholder="Ej: 2024" maxLength={4} />
                  <FormSelect label="Modalidad de admisión" value={form.modalidad_admision} onChange={(v) => setField("modalidad_admision", v)} options={MODALIDAD_ADMISION} />
                </div>
                <div className="grid sm:grid-cols-3 gap-4">
                  <FormSelect label="Lengua materna" value={form.lengua_materna} onChange={(v) => setField("lengua_materna", v)} options={[{ value: "CASTELLANO", label: "Castellano" }, { value: "QUECHUA", label: "Quechua" }, { value: "AIMARA", label: "Aimara" }, { value: "ASHANINKA", label: "Asháninka" }, { value: "OTRO", label: "Otro" }]} />
                  <FormSelect label="¿Tiene discapacidad?" value={form.discapacidad} onChange={(v) => setField("discapacidad", v)} options={[{ value: "NO", label: "No" }, { value: "SI", label: "Sí" }]} />
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════ */}
          {/* STEP 3: ELEGIR CARRERAS                 */}
          {/* ════════════════════════════════════════ */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div>
                <Label className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                  Seleccione Programa(s) de Estudios
                </Label>
                <p className="text-xs text-gray-500 mt-1">
                  Seleccione por orden de preferencia. La primera opción será su carrera principal.
                </p>
              </div>

              <div className="space-y-2">
                {careers.map((c) => {
                  const isSelected = preferences.includes(c.id);
                  const order = preferences.indexOf(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCareer(c.id)}
                      className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left ${isSelected
                          ? "border-blue-600 bg-blue-50/60 shadow-sm"
                          : "border-gray-200 hover:border-gray-300 bg-white"
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        {isSelected ? (
                          <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                            {order + 1}
                          </div>
                        ) : (
                          <Circle className="h-7 w-7 text-gray-300" />
                        )}
                        <div>
                          <div className={`font-semibold ${isSelected ? "text-blue-700" : "text-gray-700"}`}>
                            {c.name}
                          </div>
                          <div className="text-xs text-gray-500">{c.vacancies} vacantes disponibles</div>
                        </div>
                      </div>
                      {isSelected ? (
                        <CheckCircle2 className="h-5 w-5 text-blue-600 shrink-0" />
                      ) : (
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {c.vacancies} vac.
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>

              {preferences.length > 1 && (
                <div className="border rounded-xl p-4 space-y-2 bg-gray-50/50">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Orden de preferencia
                  </div>
                  {preferences.map((cid, idx) => {
                    const c = (selectedCall?.careers || []).find((x) => x.id === cid);
                    if (!c) return null;
                    return (
                      <div key={cid} className="flex items-center justify-between bg-white border rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">{idx + 1}</span>
                          <span className="text-sm font-medium">{c.name}</span>
                        </div>
                        <div className="flex gap-1">
                          <button type="button" onClick={(e) => { e.stopPropagation(); moveUp(idx); }} disabled={idx === 0} className="p-1 hover:bg-gray-100 rounded disabled:opacity-30">
                            <ChevronUp className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={(e) => { e.stopPropagation(); moveDown(idx); }} disabled={idx === preferences.length - 1} className="p-1 hover:bg-gray-100 rounded disabled:opacity-30">
                            <ChevronDown className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════ */}
          {/* STEP 4: ADJUNTAR DOCUMENTOS             */}
          {/* ════════════════════════════════════════ */}
          {step === 4 && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div>
                <Label className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                  Documentos Requeridos
                </Label>
                <p className="text-xs text-gray-500 mt-1">
                  Adjunte los documentos solicitados. Los archivos deben ser JPG, PNG o PDF (máx. 5 MB).
                </p>
              </div>

              {/* Barra de progreso */}
              <div className="flex items-center gap-3 p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-blue-700">Progreso de documentos</span>
                    <span className="font-bold text-blue-800">{docsUploaded.length}/{docsRequired.length} obligatorios</span>
                  </div>
                  <div className="w-full h-2 bg-blue-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-500"
                      style={{
                        width: `${docsRequired.length > 0 ? (docsUploaded.length / docsRequired.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Lista de documentos */}
              <div className="space-y-3">
                {requiredDocs.map((docCfg) => (
                  <FileUploadCard
                    key={docCfg.type}
                    config={docCfg}
                    attachment={attachments[docCfg.type] || null}
                    onAttach={(file) => handleAttach(docCfg.type, file, docCfg.isPhoto)}
                    onRemove={() => removeAttachment(docCfg.type)}
                  />
                ))}
              </div>

              {/* Nota */}
              <div className="flex gap-3 p-4 bg-amber-50/70 rounded-xl border border-amber-200">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-700 space-y-1">
                  <p className="font-semibold text-amber-800">Indicaciones:</p>
                  <p>• La fotografía debe ser reciente, fondo blanco, con vestimenta formal.</p>
                  <p>• Los documentos serán verificados por la comisión de admisión.</p>
                  <p>• Si algún documento es observado, se le notificará para corregirlo.</p>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════ */}
          {/* STEP 5: REVISIÓN Y ENVÍO                */}
          {/* ════════════════════════════════════════ */}
          {step === 5 && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-4">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p className="text-sm font-medium">
                  Revise que todos los datos sean correctos antes de confirmar.
                  Una vez enviada, no podrá modificar su postulación.
                </p>
              </div>

              <div className="space-y-4">
                <SummarySection title="Convocatoria">
                  <SummaryRow label="Proceso" value={selectedCall?.name} />
                  <SummaryRow label="Período" value={`${selectedCall?.academic_year || ""}-${selectedCall?.academic_period || ""}`} />
                </SummarySection>

                <SummarySection title="Datos Personales">
                  <SummaryRow label="Documento" value={`${form.doc_type}: ${form.dni}`} />
                  <SummaryRow label="Nombre completo" value={fullName} />
                  <SummaryRow label="Sexo" value={form.sexo} />
                  <SummaryRow label="Fecha de nacimiento" value={form.fecha_nacimiento} />
                  <SummaryRow label="Email" value={form.email} />
                  <SummaryRow label="Teléfono" value={form.phone || "—"} />
                  <SummaryRow label="Modalidad" value={form.modalidad_admision} />
                </SummarySection>

                <SummarySection title="Programas de Estudios (orden de preferencia)">
                  {preferences.map((cid, idx) => {
                    const c = (selectedCall?.careers || []).find((x) => x.id === cid);
                    return <SummaryRow key={cid} label={`${idx + 1}ª opción`} value={c?.name || `ID ${cid}`} />;
                  })}
                </SummarySection>

                <SummarySection title="Documentos Adjuntos">
                  {requiredDocs.map((docCfg) => {
                    const att = attachments[docCfg.type];
                    return (
                      <SummaryRow
                        key={docCfg.type}
                        label={docCfg.label}
                        value={
                          att?.file ? (
                            <span className="flex items-center gap-1.5 text-green-700">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {att.file.name}
                              <span className="text-gray-400 text-[10px]">({fmtFileSize(att.file.size)})</span>
                            </span>
                          ) : (
                            <span className="text-gray-400 italic">
                              {docCfg.required ? "No adjuntado" : "No aplica"}
                            </span>
                          )
                        }
                      />
                    );
                  })}
                </SummarySection>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════ */}
          {/* STEP 6: CONFIRMACIÓN (post-submit)      */}
          {/* ════════════════════════════════════════ */}
          {step === 6 && result && (
            <div className="space-y-8 animate-in fade-in duration-300 text-center">
              <div className="py-8 space-y-4">
                <div className="bg-green-100 text-green-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 size={40} />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">¡Postulación Registrada!</h3>
                <p className="text-gray-600 max-w-md mx-auto">
                  Su postulación ha sido registrada exitosamente. Guarde su número de postulación.
                </p>
              </div>

              <div className="bg-gray-50 p-6 rounded-2xl border max-w-md mx-auto space-y-3 text-left">
                <SummaryRow
                  label="N° Postulación"
                  value={<span className="text-blue-600 font-bold text-lg">#{result.application_number || result.application_id}</span>}
                />
                <SummaryRow label="Estado" value={<Badge className="bg-green-500">{result.status}</Badge>} />
                <SummaryRow label="Postulante" value={fullName} />
                <SummaryRow label="DNI" value={form.dni} />
                <SummaryRow label="Convocatoria" value={selectedCall?.name} />
              </div>

              {(selectedCall?.application_fee ?? 0) > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 max-w-md mx-auto text-left space-y-2">
                  <div className="flex items-center gap-2 text-blue-800 font-bold">
                    <CreditCard className="h-5 w-5" />
                    Pago pendiente: S/. {selectedCall.application_fee}
                  </div>
                  <p className="text-sm text-blue-700">
                    Acérquese a la caja de la institución con su N° de postulación y su DNI
                    para realizar el pago del derecho de inscripción.
                  </p>
                </div>
              )}

              <div className="pt-4 flex flex-col sm:flex-row justify-center gap-3">
                <Button variant="outline" onClick={() => window.print()} className="h-12 rounded-xl px-8">
                  <Printer className="mr-2 h-4 w-4" /> Imprimir
                </Button>
                <Button
                  onClick={() => {
                    setStep(1);
                    setSelectedCall(null);
                    setForm({ ...EMPTY_FORM });
                    setPreferences([]);
                    setAttachments({});
                    setResult(null);
                  }}
                  className="h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-8"
                >
                  Nueva Postulación
                </Button>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════ */}
          {/* NAVEGACIÓN (pasos 1-5)                  */}
          {/* ════════════════════════════════════════ */}
          {step <= 5 && (
            <div className="flex justify-between pt-8 border-t mt-8">
              <Button variant="outline" onClick={goBack} disabled={step === 1} className="h-12 rounded-xl px-6">
                <ArrowLeft className="mr-2 h-4 w-4" /> Anterior
              </Button>

              {step < 5 ? (
                <Button
                  onClick={goNext}
                  disabled={!canNext}
                  className="h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-8 font-bold shadow-lg shadow-blue-900/10"
                >
                  Siguiente <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !canNext}
                  className="h-12 rounded-xl bg-green-600 hover:bg-green-700 text-white px-10 font-bold shadow-lg shadow-green-900/10"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Confirmar Postulación
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// FILE UPLOAD CARD (para Step 4)
// ═══════════════════════════════════════════════════════

function FileUploadCard({ config, attachment, onAttach, onRemove }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const Icon = config.icon || FileText;
  const hasFile = !!attachment?.file;

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onAttach(file);
  };

  return (
    <div
      className={`border-2 rounded-xl transition-all ${hasFile
          ? "border-green-200 bg-green-50/30"
          : dragOver
            ? "border-blue-400 bg-blue-50/40"
            : "border-gray-200 hover:border-gray-300"
        }`}
    >
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Preview de foto o ícono */}
          {config.isPhoto && attachment?.preview ? (
            <div className="w-20 h-24 rounded-lg overflow-hidden border-2 border-white shadow-sm shrink-0">
              <img src={attachment.preview} alt="Foto" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${hasFile ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"
                }`}
            >
              {hasFile ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-gray-900">{config.label}</span>
              {config.required && <span className="text-red-500 text-xs font-bold">*</span>}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{config.description}</p>

            {/* Archivo adjunto */}
            {hasFile ? (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white border rounded-lg text-xs">
                  <Paperclip className="h-3 w-3 text-gray-400" />
                  <span className="text-gray-700 truncate max-w-[200px]">{attachment.file.name}</span>
                  <span className="text-gray-400">({fmtFileSize(attachment.file.size)})</span>
                </div>
                <button
                  onClick={onRemove}
                  className="p-1 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                  title="Quitar archivo"
                >
                  <X className="h-4 w-4" />
                </button>
                <button
                  onClick={() => inputRef.current?.click()}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              /* Zona de drop */
              <div
                className={`mt-2 border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors ${dragOver ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-blue-300"
                  }`}
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <div className="flex items-center justify-center gap-2">
                  <Upload className="h-4 w-4 text-gray-400" />
                  <span className="text-xs text-gray-500">
                    Arrastre o <span className="text-blue-600 font-medium">haga clic para subir</span>
                  </span>
                </div>
                <span className="text-[10px] text-gray-400 mt-0.5 block">
                  {config.accept.replace(/image\//g, "").replace(/application\//g, "").toUpperCase()} · Máx. 5 MB
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={config.accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onAttach(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// SUB-COMPONENTES REUTILIZABLES
// ═══════════════════════════════════════════════════════

function FormInput({ label, value, onChange, placeholder, type = "text", maxLength }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength} className="h-11 border-gray-300 rounded-xl" />
    </div>
  );
}

function FormSelect({ label, value, onChange, options, placeholder }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-11 border-gray-300 rounded-xl">
          <SelectValue placeholder={placeholder || "Seleccionar"} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function SummarySection({ title, children }) {
  return (
    <div className="border rounded-xl overflow-hidden">
      <div className="bg-gray-50 px-4 py-2 border-b">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{title}</span>
      </div>
      <div className="divide-y">{children}</div>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex justify-between items-center px-4 py-2.5 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-semibold text-gray-900 text-right">{value}</span>
    </div>
  );
}