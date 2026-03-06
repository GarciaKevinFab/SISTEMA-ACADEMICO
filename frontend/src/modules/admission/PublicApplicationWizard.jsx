// src/modules/admission/PublicApplicationWizard.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../../components/ui/select";
import { toast } from "sonner";
import { AdmissionCalls, AdmissionPublic } from "../../services/admission.service";

import {
    User, CreditCard, CalendarDays, MapPin, Phone, Mail,
    Globe, BookOpen, School, Camera, ChevronLeft, ChevronRight,
    AlertCircle, CheckCircle2, Loader2, Users, ImageIcon,
    Fingerprint, Languages,
} from "lucide-react";

/* ─── Constants ──────────────────────────────────────────────── */
const STEPS = { PERSONAL: 1, SCHOOL: 2, PHOTO: 3 };
const STORAGE_KEY = "admission_wizard_backup";
const onlyDigits = (s) => String(s || "").replace(/\D/g, "");

const DEPARTMENTS_PE = [
    "Amazonas", "Áncash", "Apurímac", "Arequipa", "Ayacucho", "Cajamarca", "Callao", "Cusco",
    "Huancavelica", "Huánuco", "Ica", "Junín", "La Libertad", "Lambayeque", "Lima", "Loreto",
    "Madre de Dios", "Moquegua", "Pasco", "Piura", "Puno", "San Martín", "Tacna", "Tumbes", "Ucayali",
];
const LANGS = ["Español", "Quechua", "Aymara", "Asháninka", "Otra"];
const ETHNIC = ["Mestizo", "Quechua", "Aymara", "Amazonía", "Afroperuano", "Otro", "Prefiero no decir"];
const SCHOOL_TYPES = ["Público", "Privado"];

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(file);
    });
}

/* ─── Step config ────────────────────────────────────────────── */
const STEP_META = [
    { step: STEPS.PERSONAL, label: "Datos personales", icon: User },
    { step: STEPS.SCHOOL, label: "Colegio", icon: School },
    { step: STEPS.PHOTO, label: "Foto", icon: Camera },
];

/* ─── Stepper ────────────────────────────────────────────────── */
const Stepper = ({ currentStep }) => (
    <div className="flex items-center gap-0">
        {STEP_META.map(({ step, label, icon: Icon }, i) => {
            const done = currentStep > step;
            const active = currentStep === step;
            return (
                <React.Fragment key={step}>
                    <div className="flex flex-col items-center gap-1.5">
                        <div className={`h-9 w-9 rounded-full grid place-items-center border-2 transition-all duration-300 ${done ? "bg-emerald-500 border-emerald-500 text-white" :
                                active ? "bg-blue-600 border-blue-600 text-white" :
                                    "bg-white border-slate-200 text-slate-400"
                            }`}>
                            {done ? <CheckCircle2 size={16} /> : <Icon size={15} />}
                        </div>
                        <p className={`text-[10px] font-bold whitespace-nowrap hidden sm:block ${active ? "text-blue-700" : done ? "text-emerald-600" : "text-slate-400"
                            }`}>{label}</p>
                    </div>
                    {i < STEP_META.length - 1 && (
                        <div className={`flex-1 h-0.5 mb-5 mx-2 transition-all duration-500 ${currentStep > step ? "bg-emerald-400" : "bg-slate-200"
                            }`} style={{ minWidth: 32 }} />
                    )}
                </React.Fragment>
            );
        })}
    </div>
);

/* ─── Field wrapper ──────────────────────────────────────────── */
const Field = ({ label, icon: Icon, error, required, hint, children }) => (
    <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
            {Icon && <Icon size={12} className="text-slate-400 shrink-0" />}
            <Label className={`text-xs font-bold uppercase tracking-wider ${error ? "text-red-600" : "text-slate-600"}`}>
                {label}{required && <span className="text-red-500 ml-0.5">*</span>}
            </Label>
        </div>
        {children}
        {error && (
            <p className="flex items-center gap-1 text-xs text-red-600 font-semibold">
                <AlertCircle size={10} className="shrink-0" />{error}
            </p>
        )}
        {hint && !error && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
);

/* ─── Section divider ────────────────────────────────────────── */
const SectionHead = ({ label, icon: Icon }) => (
    <div className="flex items-center gap-2 pt-2">
        <div className="h-6 w-6 rounded-lg bg-blue-50 border border-blue-100 grid place-items-center">
            <Icon size={12} className="text-blue-600" />
        </div>
        <p className="text-xs font-extrabold uppercase tracking-widest text-slate-500">{label}</p>
        <div className="flex-1 h-px bg-slate-100" />
    </div>
);

/* ─── Career Card ────────────────────────────────────────────── */
const CareerCard = ({ career, selected, onSelect }) => {
    const noVacancies = Number(career.vacancies) <= 0;
    return (
        <button
            type="button"
            disabled={noVacancies}
            onClick={() => onSelect(career.id)}
            className={`group relative text-left rounded-2xl border-2 p-4 transition-all duration-200 ${selected
                    ? "border-blue-500 bg-blue-50 shadow-sm ring-4 ring-blue-100"
                    : noVacancies
                        ? "border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed"
                        : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/30 hover:shadow-sm"
                }`}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <p className={`text-sm font-extrabold leading-tight truncate ${selected ? "text-blue-800" : "text-slate-800"}`}>
                        {career.name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                        <Users size={11} className={selected ? "text-blue-500" : "text-slate-400"} />
                        <p className={`text-xs font-semibold ${noVacancies ? "text-red-500" : selected ? "text-blue-600" : "text-slate-500"}`}>
                            {noVacancies ? "Sin vacantes" : `${career.vacancies} vacantes`}
                        </p>
                    </div>
                </div>
                {selected && (
                    <div className="h-6 w-6 rounded-full bg-blue-500 grid place-items-center shrink-0">
                        <CheckCircle2 size={14} className="text-white" />
                    </div>
                )}
            </div>
        </button>
    );
};

/* ─── Step Nav ───────────────────────────────────────────────── */
const StepNav = ({ onBack, onNext, nextLabel = "Siguiente", backLabel = "Atrás", loading = false, showBack = true }) => (
    <div className="flex justify-between items-center pt-6 border-t border-slate-100 mt-6">
        {showBack ? (
            <Button variant="outline" className="rounded-xl font-bold gap-2 h-11" onClick={onBack}>
                <ChevronLeft size={15} />{backLabel}
            </Button>
        ) : <div />}
        <Button
            className="rounded-xl font-extrabold gap-2 h-11 min-w-[140px] bg-blue-600 hover:bg-blue-700 text-white"
            onClick={onNext}
            disabled={loading}
        >
            {loading
                ? <><Loader2 size={15} className="animate-spin" /> Procesando…</>
                : <>{nextLabel} <ChevronRight size={15} /></>
            }
        </Button>
    </div>
);

/* ─── Error summary ──────────────────────────────────────────── */
const ErrorSummary = ({ errors }) => {
    if (!Object.values(errors).some(Boolean)) return null;
    return (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 mt-4">
            <AlertCircle size={15} className="text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 font-semibold">
                Corrige los campos marcados antes de continuar.
            </p>
        </div>
    );
};

/* ─── Main Component ─────────────────────────────────────────── */
export default function PublicApplicationWizard({ callId, onClose, onApplied }) {
    const params = useParams();
    const id = callId || params.id;
    const navigate = useNavigate();

    const [isInitialized, setIsInitialized] = useState(false);
    const [step, setStep] = useState(STEPS.PERSONAL);
    const [call, setCall] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState({});

    const [primaryCareerId, setPrimaryCareerId] = useState("");
    const [photoPreview, setPhotoPreview] = useState("");

    const [profile, setProfile] = useState({
        nationality: "PERUANA",
        document_type: "DNI",
        sex: "",
        ethnic_identity: "",
        document_number: "",
        last_name_father: "",
        last_name_mother: "",
        first_names: "",
        birth_date: "",
        birth_department: "",
        mother_tongue: "",
        secondary_language: "",
        mobile: "",
        email: "",
        address: "",
        address_department: "",
    });

    const [school, setSchool] = useState({
        school_department: "",
        promotion_year: "",
        school_type: "",
        school_name: "",
    });

    /* ── Restore from localStorage ── */
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const p = JSON.parse(saved);
                if (p.profile) setProfile(p.profile);
                if (p.school) setSchool(p.school);
                if (p.step) setStep(p.step);
                if (p.primaryCareerId) setPrimaryCareerId(p.primaryCareerId);
            } catch (err) { console.error("Error recuperando backup:", err); }
        }
        setIsInitialized(true);
    }, []);

    /* ── Save to localStorage ── */
    useEffect(() => {
        if (!isInitialized) return;
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ profile, school, step, primaryCareerId }));
    }, [profile, school, step, primaryCareerId, isInitialized]);

    /* ── Load call ── */
    useEffect(() => {
        if (!id) return;
        (async () => {
            try {
                setLoading(true);
                const data = await AdmissionCalls.getPublicById(id);
                if (!data) throw new Error();
                setCall(data);
            } catch {
                toast.error("Convocatoria inválida");
                onClose ? onClose() : navigate("/public/admission");
            } finally {
                setLoading(false);
            }
        })();
    }, [id, navigate, onClose]);

    /* ── Helpers ── */
    const setP = (key, value) => {
        setProfile(p => ({ ...p, [key]: value }));
        if (errors[key]) setErrors(e => ({ ...e, [key]: null }));
    };
    const setS = (key, value) => {
        setSchool(s => ({ ...s, [key]: value }));
        if (errors[key]) setErrors(e => ({ ...e, [key]: null }));
    };

    const handleDocumentChange = (e) => {
        const val = onlyDigits(e.target.value);
        if (profile.document_type === "DNI" && val.length > 8) return;
        setP("document_number", val);
    };

    const pickPrimaryCareer = (careerId) => {
        setPrimaryCareerId(String(careerId));
        if (errors.career) setErrors(e => ({ ...e, career: null }));
    };

    const onPhotoChange = async (file) => {
        if (!file) return;
        try { setPhotoPreview(await fileToBase64(file)); }
        catch { toast.error("No se pudo leer la imagen"); }
    };

    /* ── Validation ── */
    const validatePersonal = () => {
        const e = {};
        if (!profile.nationality) e.nationality = "Requerido";
        if (!profile.document_type) e.document_type = "Requerido";
        if (!profile.sex) e.sex = "Requerido";
        if (!profile.document_number) e.document_number = "Ingrese su número de documento";
        else if (profile.document_type === "DNI" && profile.document_number.length !== 8) e.document_number = "El DNI debe tener 8 dígitos exactos";
        if (!profile.last_name_father) e.last_name_father = "Requerido";
        if (!profile.last_name_mother) e.last_name_mother = "Requerido";
        if (!profile.first_names) e.first_names = "Requerido";
        if (!profile.birth_date) e.birth_date = "Indique fecha de nacimiento";
        if (!profile.birth_department) e.birth_department = "Requerido";
        if (!profile.ethnic_identity) e.ethnic_identity = "Requerido";
        if (!profile.mother_tongue) e.mother_tongue = "Requerido";
        if (!profile.mobile) e.mobile = "Requerido";
        else if (profile.mobile.length < 9) e.mobile = "Mínimo 9 dígitos";
        if (!profile.email || !profile.email.includes("@")) e.email = "Correo inválido";
        if (!profile.address) e.address = "Requerido";
        if (!profile.address_department) e.address_department = "Requerido";
        if (!primaryCareerId) e.career = "Debe seleccionar una carrera";
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const validateSchool = () => {
        const e = {};
        if (!school.school_department) e.school_department = "Seleccione el lugar del colegio";
        if (!school.promotion_year) e.promotion_year = "Requerido";
        else if (school.promotion_year.length !== 4) e.promotion_year = "Debe ser un año (ej. 2023)";
        if (!school.school_type) e.school_type = "Requerido";
        if (!school.school_name) e.school_name = "Escriba el nombre del colegio";
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleNextToSchool = () => {
        if (validatePersonal()) { setStep(STEPS.SCHOOL); window.scrollTo(0, 0); }
        else toast.error("Completa los campos marcados en rojo");
    };

    const handleNextToPhoto = () => {
        if (validateSchool()) { setStep(STEPS.PHOTO); window.scrollTo(0, 0); }
        else toast.error("Completa los datos del colegio");
    };

    /* ── Submit ── */
    const submit = async () => {
        if (!call || !primaryCareerId) return toast.error("Seleccione una carrera");
        try {
            setSubmitting(true);
            const fullName = `${profile.first_names} ${profile.last_name_father} ${profile.last_name_mother}`.trim();
            const payload = {
                call_id: call.id,
                applicant: { dni: onlyDigits(profile.document_number), names: fullName, email: profile.email.trim(), phone: onlyDigits(profile.mobile) },
                career_preferences: [Number(primaryCareerId)],
                profile: { ...profile, document_number: onlyDigits(profile.document_number) },
                school,
                photo_base64: photoPreview || null,
            };
            const res = await AdmissionPublic.apply(payload);
            toast.success("Postulación registrada con éxito");
            localStorage.removeItem(STORAGE_KEY);
            if (onApplied && res?.updated_call) onApplied(res.updated_call);
            onClose ? onClose() : navigate("/public/admission/results");
        } catch (e) {
            const d = e?.response?.data;
            console.error("PUBLIC APPLY FAILED", e?.response?.status, d, e);
            const msg = d?.error || d?.detail || d?.message || (typeof d === "string" ? d : null) ||
                "No se pudo registrar. Revisa la consola (Network → Response).";
            toast.error(msg);
        } finally { setSubmitting(false); }
    };

    /* ── Loading ── */
    if (loading) {
        return (
            <div className="py-16 flex flex-col items-center gap-3">
                <Loader2 size={28} className="animate-spin text-blue-400" />
                <p className="text-sm text-slate-500 font-medium">Cargando convocatoria…</p>
            </div>
        );
    }
    if (!call) return null;

    const inputCls = (err) => `h-11 rounded-xl ${err ? "border-red-400 focus-visible:ring-red-300" : ""}`;
    const selCls = (err) => `h-11 rounded-xl ${err ? "border-red-400" : ""}`;

    return (
        <div className="space-y-5">

            {/* ── Call header ── */}
            <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50/40 px-5 py-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-0.5">Postulando a</p>
                <p className="font-extrabold text-slate-900 leading-tight">{call.name}</p>
            </div>

            {/* ── Stepper ── */}
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5">
                <Stepper currentStep={step} />
            </div>

            {/* ════════════════ STEP 1: DATOS PERSONALES ════════════════ */}
            {step === STEPS.PERSONAL && (
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60">
                        <p className="font-extrabold text-slate-800 text-sm">Paso 1 — Datos Personales</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Todos los campos marcados con * son obligatorios</p>
                    </div>
                    <div className="p-6 space-y-5">

                        {/* Identificación */}
                        <SectionHead label="Identificación" icon={Fingerprint} />
                        <div className="grid sm:grid-cols-3 gap-4">
                            <Field label="Nacionalidad" icon={Globe} error={errors.nationality} required>
                                <Select value={profile.nationality} onValueChange={(v) => setP("nationality", v)}>
                                    <SelectTrigger className={selCls(errors.nationality)}><SelectValue placeholder="Seleccione" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="PERUANA">Peruana</SelectItem>
                                        <SelectItem value="OTRA">Otra</SelectItem>
                                    </SelectContent>
                                </Select>
                            </Field>
                            <Field label="Tipo de documento" error={errors.document_type} required>
                                <Select value={profile.document_type} onValueChange={(v) => setP("document_type", v)}>
                                    <SelectTrigger className={selCls(errors.document_type)}><SelectValue placeholder="Seleccione" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="DNI">DNI</SelectItem>
                                        <SelectItem value="CE">Carné de Extranjería</SelectItem>
                                        <SelectItem value="PASSPORT">Pasaporte</SelectItem>
                                    </SelectContent>
                                </Select>
                            </Field>
                            <Field label="Sexo" error={errors.sex} required>
                                <Select value={profile.sex} onValueChange={(v) => setP("sex", v)}>
                                    <SelectTrigger className={selCls(errors.sex)}><SelectValue placeholder="Seleccione" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="M">Masculino</SelectItem>
                                        <SelectItem value="F">Femenino</SelectItem>
                                    </SelectContent>
                                </Select>
                            </Field>
                        </div>

                        <div className="grid sm:grid-cols-3 gap-4">
                            <Field label={`N° Documento${profile.document_type === "DNI" ? " (8 dígitos)" : ""}`}
                                icon={CreditCard} error={errors.document_number} required>
                                <Input value={profile.document_number} onChange={handleDocumentChange}
                                    className={`${inputCls(errors.document_number)} font-mono`}
                                    placeholder="Solo números" inputMode="numeric" />
                            </Field>
                            <Field label="Ap. Paterno" error={errors.last_name_father} required>
                                <Input value={profile.last_name_father}
                                    onChange={(e) => setP("last_name_father", e.target.value)}
                                    className={inputCls(errors.last_name_father)} />
                            </Field>
                            <Field label="Ap. Materno" error={errors.last_name_mother} required>
                                <Input value={profile.last_name_mother}
                                    onChange={(e) => setP("last_name_mother", e.target.value)}
                                    className={inputCls(errors.last_name_mother)} />
                            </Field>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4">
                            <Field label="Nombres" icon={User} error={errors.first_names} required>
                                <Input value={profile.first_names}
                                    onChange={(e) => setP("first_names", e.target.value)}
                                    className={inputCls(errors.first_names)} />
                            </Field>
                            <Field label="Identidad étnica" error={errors.ethnic_identity} required>
                                <Select value={profile.ethnic_identity} onValueChange={(v) => setP("ethnic_identity", v)}>
                                    <SelectTrigger className={selCls(errors.ethnic_identity)}><SelectValue placeholder="Seleccione" /></SelectTrigger>
                                    <SelectContent>
                                        {ETHNIC.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </Field>
                        </div>

                        {/* Nacimiento */}
                        <SectionHead label="Lugar y Fecha de Nacimiento" icon={CalendarDays} />
                        <div className="grid sm:grid-cols-2 gap-4">
                            <Field label="Fecha de nacimiento" error={errors.birth_date} required>
                                <Input type="date" value={profile.birth_date}
                                    onChange={(e) => setP("birth_date", e.target.value)}
                                    className={inputCls(errors.birth_date)} />
                            </Field>
                            <Field label="Departamento de nacimiento" icon={MapPin} error={errors.birth_department} required>
                                <Select value={profile.birth_department} onValueChange={(v) => setP("birth_department", v)}>
                                    <SelectTrigger className={selCls(errors.birth_department)}><SelectValue placeholder="Seleccione" /></SelectTrigger>
                                    <SelectContent>
                                        {DEPARTMENTS_PE.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </Field>
                        </div>

                        {/* Lenguas */}
                        <SectionHead label="Lenguas" icon={Languages} />
                        <div className="grid sm:grid-cols-2 gap-4">
                            <Field label="Lengua materna" error={errors.mother_tongue} required>
                                <Select value={profile.mother_tongue} onValueChange={(v) => setP("mother_tongue", v)}>
                                    <SelectTrigger className={selCls(errors.mother_tongue)}><SelectValue placeholder="Seleccione" /></SelectTrigger>
                                    <SelectContent>
                                        {LANGS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </Field>
                            <Field label="Lengua secundaria" hint="Opcional">
                                <Input value={profile.secondary_language}
                                    onChange={(e) => setP("secondary_language", e.target.value)}
                                    className="h-11 rounded-xl" placeholder="Opcional" />
                            </Field>
                        </div>

                        {/* Contacto */}
                        <SectionHead label="Contacto" icon={Phone} />
                        <div className="grid sm:grid-cols-2 gap-4">
                            <Field label="Celular" icon={Phone} error={errors.mobile} required>
                                <Input value={profile.mobile} maxLength={9} inputMode="numeric"
                                    onChange={(e) => setP("mobile", onlyDigits(e.target.value))}
                                    className={`${inputCls(errors.mobile)} font-mono`} placeholder="9 dígitos" />
                            </Field>
                            <Field label="Correo electrónico" icon={Mail} error={errors.email} required>
                                <Input type="email" value={profile.email}
                                    onChange={(e) => setP("email", e.target.value)}
                                    className={inputCls(errors.email)} placeholder="ejemplo@correo.com" />
                            </Field>
                        </div>

                        {/* Dirección */}
                        <SectionHead label="Domicilio" icon={MapPin} />
                        <div className="grid sm:grid-cols-2 gap-4">
                            <Field label="Dirección actual" error={errors.address} required>
                                <Input value={profile.address}
                                    onChange={(e) => setP("address", e.target.value)}
                                    className={inputCls(errors.address)} />
                            </Field>
                            <Field label="Departamento de domicilio" icon={MapPin} error={errors.address_department} required>
                                <Select value={profile.address_department} onValueChange={(v) => setP("address_department", v)}>
                                    <SelectTrigger className={selCls(errors.address_department)}><SelectValue placeholder="Seleccione" /></SelectTrigger>
                                    <SelectContent>
                                        {DEPARTMENTS_PE.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </Field>
                        </div>

                        {/* Carrera */}
                        <SectionHead label="Selección de Carrera" icon={BookOpen} />
                        <div className="grid sm:grid-cols-2 gap-3">
                            {call.careers.map((c) => (
                                <CareerCard
                                    key={c.id}
                                    career={c}
                                    selected={String(primaryCareerId) === String(c.id)}
                                    onSelect={pickPrimaryCareer}
                                />
                            ))}
                        </div>
                        {errors.career && (
                            <p className="flex items-center gap-1.5 text-xs text-red-600 font-semibold">
                                <AlertCircle size={11} />{errors.career}
                            </p>
                        )}

                        <ErrorSummary errors={errors} />
                        <StepNav showBack={false} onNext={handleNextToSchool} nextLabel="Siguiente" />
                    </div>
                </div>
            )}

            {/* ════════════════ STEP 2: COLEGIO ════════════════ */}
            {step === STEPS.SCHOOL && (
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60">
                        <p className="font-extrabold text-slate-800 text-sm">Paso 2 — Datos del Colegio</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Ingresa los datos de tu institución educativa secundaria</p>
                    </div>
                    <div className="p-6 space-y-5">
                        <div className="grid sm:grid-cols-3 gap-4">
                            <Field label="Departamento del colegio" icon={MapPin} error={errors.school_department} required>
                                <Select value={school.school_department} onValueChange={(v) => setS("school_department", v)}>
                                    <SelectTrigger className={selCls(errors.school_department)}><SelectValue placeholder="Seleccione" /></SelectTrigger>
                                    <SelectContent>
                                        {DEPARTMENTS_PE.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </Field>
                            <Field label="Año de promoción" error={errors.promotion_year} required hint="Ej: 2023">
                                <Input value={school.promotion_year} maxLength={4} inputMode="numeric"
                                    onChange={(e) => setS("promotion_year", onlyDigits(e.target.value))}
                                    className={`${inputCls(errors.promotion_year)} font-mono`} placeholder="2023" />
                            </Field>
                            <Field label="Tipo de colegio" error={errors.school_type} required>
                                <Select value={school.school_type} onValueChange={(v) => setS("school_type", v)}>
                                    <SelectTrigger className={selCls(errors.school_type)}><SelectValue placeholder="Seleccione" /></SelectTrigger>
                                    <SelectContent>
                                        {SCHOOL_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </Field>
                        </div>
                        <Field label="Nombre del colegio" icon={School} error={errors.school_name} required>
                            <Input value={school.school_name}
                                onChange={(e) => setS("school_name", e.target.value)}
                                className={inputCls(errors.school_name)}
                                placeholder="Nombre completo de la institución" />
                        </Field>
                        <ErrorSummary errors={errors} />
                        <StepNav onBack={() => setStep(STEPS.PERSONAL)} onNext={handleNextToPhoto} nextLabel="Siguiente" />
                    </div>
                </div>
            )}

            {/* ════════════════ STEP 3: FOTO ════════════════ */}
            {step === STEPS.PHOTO && (
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60">
                        <p className="font-extrabold text-slate-800 text-sm">Paso 3 — Foto de Postulante</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Este paso es opcional. Se recomienda foto tamaño carnet.</p>
                    </div>
                    <div className="p-6 space-y-5">
                        <Field label="Foto (opcional)" icon={Camera} hint="Formatos: JPG, PNG. Tamaño recomendado: carnet o pasaporte.">
                            <Input type="file" accept="image/*"
                                className="h-11 rounded-xl file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:font-semibold file:text-xs file:px-3 file:py-1.5 cursor-pointer"
                                onChange={(e) => onPhotoChange(e.target.files?.[0] || null)} />
                        </Field>

                        {photoPreview ? (
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex flex-col items-center gap-3">
                                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Vista previa</p>
                                <img src={photoPreview} alt="preview"
                                    className="max-h-60 rounded-xl shadow-sm border border-slate-200 object-cover" />
                            </div>
                        ) : (
                            <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/40 py-10 flex flex-col items-center gap-2 text-center">
                                <div className="h-12 w-12 rounded-2xl bg-slate-100 grid place-items-center">
                                    <ImageIcon size={22} className="text-slate-300" />
                                </div>
                                <p className="text-sm text-slate-400 font-medium">Sin foto seleccionada</p>
                                <p className="text-xs text-slate-300">La foto es opcional — puedes continuar sin ella</p>
                            </div>
                        )}

                        {/* Resumen final */}
                        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-2">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 mb-2">Resumen de postulación</p>
                            {[
                                { label: "Nombre", value: `${profile.first_names} ${profile.last_name_father} ${profile.last_name_mother}`.trim() || "—" },
                                { label: "Documento", value: `${profile.document_type}: ${profile.document_number || "—"}` },
                                { label: "Carrera", value: call.careers.find(c => String(c.id) === String(primaryCareerId))?.name || "—" },
                            ].map(({ label, value }) => (
                                <div key={label} className="flex items-start gap-2 text-sm">
                                    <p className="text-slate-400 font-semibold w-24 shrink-0">{label}:</p>
                                    <p className="text-slate-700 font-bold leading-tight">{value}</p>
                                </div>
                            ))}
                        </div>

                        <StepNav
                            onBack={() => setStep(STEPS.SCHOOL)}
                            onNext={submit}
                            nextLabel="Confirmar Registro"
                            loading={submitting}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}