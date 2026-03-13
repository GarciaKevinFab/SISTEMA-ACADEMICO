// src/modules/admission/AdmissionCallsManagement.jsx
import React, { useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "../../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import {
    Plus, Eye, Download, Calendar, FileText, BookOpenCheck, Check,
    Trash2, CheckCircle2, Clock3, AlertCircle, Users, CreditCard,
    Loader2, GraduationCap, ChevronRight, Edit3, Upload, ExternalLink, X,
} from "lucide-react";
import { toast } from "sonner";
import {
    listAdmissionCalls, createAdmissionCall, updateAdmissionCall, listCareers,
    Results, deleteAdmissionCall, AdmissionParams, uploadRegulation,
} from "../../services/admission.service";

/* ─── Helpers ────────────────────────────────────────────── */
const normalizeCall = (c) => {
    const careers = (c.careers || []).map((x) => ({
        id: x.id ?? x.career_id,
        name: x.name ?? x.career_name ?? x.title,
        vacancies: x.vacancies ?? x.quota ?? x.slots ?? 0,
    }));
    return {
        id: c.id,
        name: c.name,
        description: c.description || "",
        academic_year: c.academic_year ?? c.year ?? null,
        academic_period: c.academic_period ?? c.period ?? null,
        registration_start: c.registration_start ?? c.start_date ?? null,
        registration_end: c.registration_end ?? c.end_date ?? null,
        exam_date: c.exam_date ?? c.exam_at ?? null,
        results_date: c.results_date ?? c.results_at ?? null,
        application_fee: c.application_fee ?? c.fee ?? 0,
        max_applications_per_career: c.max_applications_per_career ?? c.max_choices ?? 1,
        minimum_age: c.minimum_age ?? null,
        maximum_age: c.maximum_age ?? null,
        required_documents: migrateDocs(c.required_documents ?? []),
        careers,
        regulation_url: c.regulation_url ?? c.reglamento_url ?? "",
        total_applications: c.total_applications ?? c.applications_count ?? 0,
        status: c.status ?? c.state ?? "OPEN",
    };
};

const fmtDate = (v) => v ? new Date(v).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const fmtDateTime = (v) => v ? new Date(v).toLocaleString("es-PE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const fmtMoney = (n) => Number(n || 0).toFixed(2);

const REQUIRED_DOCS = [
    { value: "FOTO_CARNET", label: "Fotografía tamaño carné" },
    { value: "COPIA_DNI", label: "Copia DNI" },
    { value: "PARTIDA_NACIMIENTO", label: "Partida de nacimiento" },
    { value: "CERTIFICADO_ESTUDIOS", label: "Cert. estudios" },
    { value: "CARNET_CONADIS", label: "Carné CONADIS" },
];

/* Mapeo de códigos viejos → nuevos */
const LEGACY_CODE_MAP = {
    PHOTO: "FOTO_CARNET", DNI_COPY: "COPIA_DNI",
    BIRTH_CERTIFICATE: "PARTIDA_NACIMIENTO", STUDY_CERTIFICATE: "CERTIFICADO_ESTUDIOS",
    CONADIS_COPY: "CARNET_CONADIS",
};
const migrateDocs = (arr) => {
    if (!Array.isArray(arr)) return [];
    return [...new Set(arr.map((c) => LEGACY_CODE_MAP[c] || c))];
};

const BASE_FORM = {
    name: "", description: "",
    academic_year: new Date().getFullYear(), academic_period: "I",
    registration_start: "", registration_end: "",
    exam_date: "", results_date: "",
    application_fee: 0, max_applications_per_career: 1,
    available_careers: [], career_vacancies: {},
    minimum_age: 16, maximum_age: 35,
    required_documents: ["FOTO_CARNET", "COPIA_DNI", "PARTIDA_NACIMIENTO", "CERTIFICADO_ESTUDIOS"],
};

const buildForm = (defs) => ({
    ...BASE_FORM,
    minimum_age: defs?.default_min_age ?? BASE_FORM.minimum_age,
    maximum_age: defs?.default_max_age ?? BASE_FORM.maximum_age,
    application_fee: defs?.default_fee ?? BASE_FORM.application_fee,
    max_applications_per_career: defs?.default_max_applications ?? BASE_FORM.max_applications_per_career,
    required_documents: migrateDocs(
        Array.isArray(defs?.default_required_documents) ? defs.default_required_documents : BASE_FORM.required_documents
    ),
});

/* ─── Status config ──────────────────────────────────────── */
const getCallStatus = (call) => {
    const now = new Date();
    const s = call.registration_start && new Date(call.registration_start);
    const e = call.registration_end && new Date(call.registration_end);
    if (!s || !e) return "POR_CONFIRMAR";
    if (now < s) return "PROXIMAMENTE";
    if (now <= e) return "ABIERTA";
    return "CERRADA";
};

const STATUS_CFG = {
    ABIERTA: { label: "Abierta", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", bar: "bg-gradient-to-r from-emerald-500 to-teal-400", icon: CheckCircle2 },
    PROXIMAMENTE: { label: "Próximamente", cls: "bg-blue-50 text-blue-700 border-blue-200", bar: "bg-gradient-to-r from-blue-400 to-indigo-400", icon: Clock3 },
    CERRADA: { label: "Cerrada", cls: "bg-slate-100 text-slate-500 border-slate-200", bar: "bg-slate-300", icon: AlertCircle },
    POR_CONFIRMAR: { label: "Por confirmar", cls: "bg-slate-100 text-slate-500 border-slate-200", bar: "bg-slate-200", icon: Clock3 },
};

/* ─── Small reusable components ──────────────────────────── */
const StatusBadge = ({ status }) => {
    const cfg = STATUS_CFG[status] ?? STATUS_CFG.CERRADA;
    const Icon = cfg.icon;
    return (
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${cfg.cls}`}>
            <Icon size={10} />{cfg.label}
        </span>
    );
};

const DateRow = ({ label, value, highlight }) => (
    <div className="flex items-start gap-2.5">
        <div className={`h-5 w-5 rounded-md grid place-items-center shrink-0 mt-0.5 ${highlight ? "bg-blue-100 border border-blue-200" : "bg-slate-100 border border-slate-200"}`}>
            <Calendar size={10} className={highlight ? "text-blue-600" : "text-slate-400"} />
        </div>
        <div>
            <p className={`text-[10px] font-bold uppercase tracking-wider ${highlight ? "text-blue-600" : "text-slate-400"}`}>{label}</p>
            <p className={`text-xs font-semibold mt-0.5 ${highlight ? "text-blue-700" : "text-slate-700"}`}>{value}</p>
        </div>
    </div>
);

const FormSectionHead = ({ n, label }) => (
    <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
        <div className="h-6 w-6 rounded-lg bg-blue-600 grid place-items-center text-white text-[11px] font-black shrink-0">{n}</div>
        <p className="text-xs font-extrabold uppercase tracking-widest text-slate-600">{label}</p>
    </div>
);

const FieldLabel = ({ children }) => (
    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">{children}</p>
);

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════ */
export default function AdmissionCallsManagement() {
    const [admissionCalls, setAdmissionCalls] = useState([]);
    const [careers, setCareers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [defaults, setDefaults] = useState(null);

    const [openCreate, setOpenCreate] = useState(false);
    const [editing, setEditing] = useState(null); // null = create, object = edit
    const [openView, setOpenView] = useState(false);
    const [viewCall, setViewCall] = useState(null);
    const [openDelete, setOpenDelete] = useState(false);
    const [deleteCall, setDeleteCall] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const [form, setForm] = useState(BASE_FORM);
    const [regulationFile, setRegulationFile] = useState(null); // File object para subir
    const [regulationUrl, setRegulationUrl] = useState("");     // URL existente

    /* ── Load ── */
    const load = async () => {
        try {
            const [callsRes, careersRes, paramsRes] = await Promise.all([
                listAdmissionCalls(),
                listCareers(),
                AdmissionParams.get().catch(() => null),
            ]);

            const raw = Array.isArray(callsRes)
                ? callsRes
                : callsRes?.items || callsRes?.results || callsRes?.admission_calls || callsRes?.calls || [];

            setAdmissionCalls(raw.map(normalizeCall));
            setCareers(Array.isArray(careersRes) ? careersRes : careersRes?.items || careersRes?.results || careersRes?.careers || []);
            if (paramsRes) setDefaults(paramsRes);
            setForm(buildForm(paramsRes));
        } catch (e) {
            console.error(e);
            toast.error("Error al cargar convocatorias");
        } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    /* ── Career toggle helpers ── */
    const toggleCareer = (careerId, checked) => {
        if (checked) {
            setForm(f => ({
                ...f,
                available_careers: [...f.available_careers, careerId],
                career_vacancies: { ...f.career_vacancies, [careerId]: f.career_vacancies[careerId] ?? 30 },
            }));
        } else {
            setForm(f => {
                const next = { ...f.career_vacancies };
                delete next[careerId];
                return { ...f, available_careers: f.available_careers.filter(id => id !== careerId), career_vacancies: next };
            });
        }
    };

    const setVacancy = (careerId, val) =>
        setForm(f => ({ ...f, career_vacancies: { ...f.career_vacancies, [careerId]: parseInt(val || "0", 10) } }));

    const toggleReqDoc = (val) =>
        setForm(f => {
            const s = new Set(f.required_documents || []);
            s.has(val) ? s.delete(val) : s.add(val);
            return { ...f, required_documents: Array.from(s) };
        });

    const resetForm = () => { setForm(buildForm(defaults)); setEditing(null); setRegulationFile(null); setRegulationUrl(""); };

    /* ── Edit helpers ── */
    const toLocalDT = (v) => {
        if (!v) return "";
        const d = new Date(v);
        if (isNaN(d.getTime())) return "";
        const pad = (n) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    const startEdit = (call) => {
        const careerIds = (call.careers || []).map(c => c.id);
        const vacMap = {};
        (call.careers || []).forEach(c => { vacMap[c.id] = c.vacancies ?? 0; });
        setForm({
            name: call.name || "",
            description: call.description || "",
            academic_year: call.academic_year || new Date().getFullYear(),
            academic_period: call.academic_period || "I",
            registration_start: toLocalDT(call.registration_start),
            registration_end: toLocalDT(call.registration_end),
            exam_date: toLocalDT(call.exam_date),
            results_date: toLocalDT(call.results_date),
            application_fee: call.application_fee ?? 0,
            max_applications_per_career: call.max_applications_per_career ?? 1,
            available_careers: careerIds,
            career_vacancies: vacMap,
            minimum_age: call.minimum_age ?? 16,
            maximum_age: call.maximum_age ?? 35,
            required_documents: call.required_documents || [],
            regulation_url: call.regulation_url || "",
        });
        setEditing(call);
        setRegulationFile(null);
        setRegulationUrl(call.regulation_url || "");
        setOpenCreate(true);
    };

    /* ── Actions ── */
    const submit = async (e) => {
        e.preventDefault();
        try {
            let callId;
            if (editing) {
                const res = await updateAdmissionCall(editing.id, form);
                callId = editing.id;
                toast.success("Convocatoria actualizada");
            } else {
                const res = await createAdmissionCall(form);
                callId = res?.id;
                toast.success("Convocatoria creada");
            }
            // Subir reglamento si se seleccionó un archivo
            if (regulationFile && callId) {
                try {
                    await uploadRegulation(callId, regulationFile);
                    toast.success("Reglamento subido");
                } catch {
                    toast.error("Convocatoria guardada pero falló al subir reglamento");
                }
            }
            setOpenCreate(false); resetForm(); load();
        } catch (e) {
            console.error(e); toast.error(e?.response?.data?.detail || (editing ? "Error al actualizar" : "Error al crear convocatoria"));
        }
    };

    const publishResults = async (call) => {
        try { await Results.publish({ call_id: call.id }); toast.success("Resultados publicados"); load(); }
        catch (e) { toast.error(e?.response?.data?.detail || "No se pudo publicar resultados"); }
    };

    const askDelete = (call) => { setDeleteCall(call); setOpenDelete(true); };

    const confirmDelete = async () => {
        if (!deleteCall?.id) return;
        try {
            setDeleting(true);
            await deleteAdmissionCall(deleteCall.id);
            toast.success("Convocatoria eliminada"); setOpenDelete(false); setDeleteCall(null);
            if (viewCall?.id && String(viewCall.id) === String(deleteCall.id)) { setOpenView(false); setViewCall(null); }
            load();
        } catch (e) { toast.error(e?.response?.data?.detail || "No se pudo eliminar"); }
        finally { setDeleting(false); }
    };

    const downloadActa = async (call) => {
        try {
            const resp = await Results.actaPdf({ call_id: call.id });
            const blob = new Blob([resp.data], { type: "application/pdf" });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a"); a.href = url; a.download = `acta-call-${call.id}.pdf`;
            a.click(); window.URL.revokeObjectURL(url);
        } catch { toast.error("No se pudo descargar el acta"); }
    };

    /* ── Loading ── */
    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-blue-50 border border-blue-100 grid place-items-center">
                        <Loader2 size={22} className="animate-spin text-blue-500" />
                    </div>
                    <p className="text-sm text-slate-400 font-medium">Cargando convocatorias…</p>
                </div>
            </div>
        );
    }

    /* ── INPUT / SELECT shared classes ── */
    const inputCls = "h-10 rounded-xl";
    const selCls = "h-10 rounded-xl";

    return (
        <div className="max-w-7xl mx-auto space-y-5 pb-12">

            {/* ── Page header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                        <div className="h-8 w-8 rounded-xl bg-blue-50 border border-blue-100 grid place-items-center shrink-0">
                            <Calendar size={16} className="text-blue-600" />
                        </div>
                        Gestión de Convocatorias
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5 ml-10 font-medium">
                        Administra los procesos de admisión, cronogramas y vacantes.
                    </p>
                </div>

                <Button className="rounded-xl font-extrabold gap-2 bg-blue-600 hover:bg-blue-700 shadow-sm"
                    onClick={() => { resetForm(); setOpenCreate(true); }}>
                    <Plus size={16} /> Nueva Convocatoria
                </Button>

                <Dialog open={openCreate} onOpenChange={(v) => { setOpenCreate(v); if (!v) resetForm(); }}>
                    {/* ════ CREATE / EDIT DIALOG ════ */}
                    <DialogContent className="max-w-4xl max-h-[88vh] overflow-y-auto p-0 gap-0 rounded-2xl border-0 shadow-2xl">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-[#0f1a3a] via-[#171a55] to-[#251c6c] px-6 py-5 sticky top-0 z-10">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-white/10 border border-white/20 grid place-items-center shrink-0">
                                    {editing ? <Edit3 size={18} className="text-white" /> : <Plus size={18} className="text-white" />}
                                </div>
                                <div>
                                    <DialogTitle className="text-base font-extrabold text-white leading-tight">
                                        {editing ? "Editar Convocatoria" : "Crear Nueva Convocatoria"}
                                    </DialogTitle>
                                    <DialogDescription className="text-blue-300 text-xs mt-0.5">
                                        {editing
                                            ? `Editando: ${editing.name}`
                                            : "Pre-llenado con la configuración por defecto. Ajusta en Configuración de Admisión."}
                                    </DialogDescription>
                                </div>
                            </div>
                        </div>

                        <form onSubmit={submit} className="bg-white p-6 space-y-7">

                            {/* ── Sección 1: General ── */}
                            <div className="space-y-4">
                                <FormSectionHead n="1" label="Información General" />
                                <div className="grid sm:grid-cols-12 gap-4">
                                    <div className="sm:col-span-8">
                                        <FieldLabel>Nombre de convocatoria *</FieldLabel>
                                        <Input placeholder="Ej. Admisión Ordinaria 2025-I" value={form.name}
                                            onChange={e => setForm({ ...form, name: e.target.value })}
                                            required className={`${inputCls} font-medium`} />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <FieldLabel>Año *</FieldLabel>
                                        <Input type="number" min="2024" max="2035" value={form.academic_year}
                                            onChange={e => setForm({ ...form, academic_year: parseInt(e.target.value || "0", 10) })}
                                            required className={`${inputCls} text-center font-mono`} />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <FieldLabel>Período *</FieldLabel>
                                        <Select value={form.academic_period} onValueChange={v => setForm({ ...form, academic_period: v })}>
                                            <SelectTrigger className={selCls}><SelectValue placeholder="—" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="I">I</SelectItem>
                                                <SelectItem value="II">II</SelectItem>
                                                <SelectItem value="III">III</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="sm:col-span-12">
                                        <FieldLabel>Descripción</FieldLabel>
                                        <Textarea rows={2} placeholder="Detalles adicionales…" value={form.description}
                                            onChange={e => setForm({ ...form, description: e.target.value })}
                                            className="rounded-xl resize-none" />
                                    </div>
                                </div>
                            </div>

                            {/* ── Sección 2: Cronograma ── */}
                            <div className="space-y-4">
                                <FormSectionHead n="2" label="Cronograma y Configuración" />
                                <div className="grid sm:grid-cols-2 gap-4">
                                    {/* Inscripciones */}
                                    <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 space-y-3">
                                        <p className="text-xs font-extrabold text-blue-800 flex items-center gap-1.5">
                                            <Calendar size={12} /> Inscripciones
                                        </p>
                                        <div>
                                            <FieldLabel>Inicio *</FieldLabel>
                                            <Input type="datetime-local" className={`${inputCls} bg-white`}
                                                value={form.registration_start}
                                                onChange={e => setForm({ ...form, registration_start: e.target.value })} required />
                                        </div>
                                        <div>
                                            <FieldLabel>Cierre *</FieldLabel>
                                            <Input type="datetime-local" className={`${inputCls} bg-white`}
                                                value={form.registration_end}
                                                onChange={e => setForm({ ...form, registration_end: e.target.value })} required />
                                        </div>
                                    </div>
                                    {/* Evaluación */}
                                    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 space-y-3">
                                        <p className="text-xs font-extrabold text-slate-600 flex items-center gap-1.5">
                                            <FileText size={12} /> Evaluación
                                        </p>
                                        <div>
                                            <FieldLabel>Fecha de examen</FieldLabel>
                                            <Input type="datetime-local" className={`${inputCls} bg-white`}
                                                value={form.exam_date}
                                                onChange={e => setForm({ ...form, exam_date: e.target.value })} />
                                        </div>
                                        <div>
                                            <FieldLabel>Publicación de resultados</FieldLabel>
                                            <Input type="datetime-local" className={`${inputCls} bg-white`}
                                                value={form.results_date}
                                                onChange={e => setForm({ ...form, results_date: e.target.value })} />
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/60 p-4 rounded-xl border border-slate-100">
                                    {[
                                        { label: "Costo (S/.)", field: "application_fee", type: "number", step: "0.01", min: 0, max: undefined },
                                        { label: "Máx. Postulac.", field: "max_applications_per_career", type: "number", step: "1", min: 1, max: 999 },
                                        { label: "Edad Mín.", field: "minimum_age", type: "number", step: "1", min: 15, max: 30 },
                                        { label: "Edad Máx.", field: "maximum_age", type: "number", step: "1", min: 20, max: 60 },
                                    ].map(({ label, field, type, step, min, max }) => (
                                        <div key={field}>
                                            <FieldLabel>{label}</FieldLabel>
                                            <Input type={type} step={step} min={min} max={max}
                                                value={form[field]}
                                                onChange={e => setForm({ ...form, [field]: field === "application_fee" ? parseFloat(e.target.value || "0") : parseInt(e.target.value || "0", 10) })}
                                                className="h-9 rounded-xl text-center font-mono" />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* ── Sección 3: Requisitos y vacantes ── */}
                            <div className="space-y-4">
                                <FormSectionHead n="3" label="Requisitos y Oferta" />

                                {/* Docs */}
                                <div>
                                    <FieldLabel>Documentos solicitados</FieldLabel>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {REQUIRED_DOCS.map(doc => {
                                            const active = (form.required_documents || []).includes(doc.value);
                                            return (
                                                <button key={doc.value} type="button" onClick={() => toggleReqDoc(doc.value)}
                                                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 border ${active
                                                            ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                                            : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600"
                                                        }`}>
                                                    {active && <Check size={9} className="inline mr-1" />}
                                                    {doc.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Careers + vacancies */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <FieldLabel>Carreras disponibles y vacantes</FieldLabel>
                                        <p className="text-[10px] text-slate-400 font-medium">Marca las carreras para incluir en la convocatoria</p>
                                    </div>
                                    <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/40 p-2 space-y-1.5">
                                        {careers.map(c => {
                                            const isSelected = form.available_careers.includes(c.id);
                                            return (
                                                <div key={c.id}
                                                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all duration-200 ${isSelected
                                                            ? "bg-white border-blue-200 shadow-sm"
                                                            : "border-transparent hover:bg-white hover:border-slate-200"
                                                        }`}>
                                                    <label htmlFor={`career_${c.id}`}
                                                        className="flex items-center gap-2.5 cursor-pointer min-w-0">
                                                        <input type="checkbox" id={`career_${c.id}`}
                                                            className="w-4 h-4 text-blue-600 rounded border-slate-300 shrink-0"
                                                            checked={isSelected}
                                                            onChange={e => toggleCareer(c.id, e.target.checked)} />
                                                        <span className={`text-sm truncate ${isSelected ? "font-semibold text-slate-900" : "text-slate-500"}`}>
                                                            {c.name}
                                                        </span>
                                                    </label>
                                                    {isSelected && (
                                                        <div className="flex items-center gap-2 ml-4 shrink-0">
                                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Vacantes</span>
                                                            <Input type="number" min="1" max="200"
                                                                className="w-20 h-8 rounded-lg text-center font-mono text-sm bg-slate-50"
                                                                value={form.career_vacancies[c.id] ?? 30}
                                                                onChange={e => setVacancy(c.id, e.target.value)} />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        {careers.length === 0 && (
                                            <div className="py-8 flex flex-col items-center gap-2 text-center">
                                                <GraduationCap size={18} className="text-slate-300" />
                                                <p className="text-xs text-slate-400">Sin carreras registradas. Ve a la pestaña Carreras primero.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* ── Sección 4: Reglamento ── */}
                            <div className="space-y-4">
                                <FormSectionHead n="4" label="Reglamento" />
                                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 space-y-3">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                        PDF de Reglamento de Admisión
                                    </p>
                                    {/* Mostrar URL existente */}
                                    {regulationUrl && !regulationFile && (
                                        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                                            <FileText size={14} className="text-emerald-600 shrink-0" />
                                            <span className="text-xs text-emerald-700 font-medium truncate flex-1">
                                                Reglamento cargado
                                            </span>
                                            <a href={regulationUrl} target="_blank" rel="noopener noreferrer"
                                                className="text-emerald-600 hover:text-emerald-800">
                                                <ExternalLink size={14} />
                                            </a>
                                            <button type="button" onClick={() => setRegulationUrl("")}
                                                className="text-slate-400 hover:text-red-500">
                                                <X size={14} />
                                            </button>
                                        </div>
                                    )}
                                    {/* Input de archivo */}
                                    {regulationFile ? (
                                        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                                            <Upload size={14} className="text-blue-600 shrink-0" />
                                            <span className="text-xs text-blue-700 font-medium truncate flex-1">
                                                {regulationFile.name}
                                            </span>
                                            <button type="button" onClick={() => setRegulationFile(null)}
                                                className="text-slate-400 hover:text-red-500">
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ) : (
                                        <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 transition-all cursor-pointer">
                                            <Upload size={16} className="text-slate-400" />
                                            <span className="text-xs font-semibold text-slate-500">
                                                {regulationUrl ? "Cambiar reglamento (PDF)" : "Subir reglamento (PDF)"}
                                            </span>
                                            <input type="file" accept=".pdf" className="hidden"
                                                onChange={(e) => {
                                                    const f = e.target.files?.[0];
                                                    if (f) {
                                                        if (!f.name.toLowerCase().endsWith(".pdf")) {
                                                            toast.error("Solo se permiten archivos PDF");
                                                            return;
                                                        }
                                                        setRegulationFile(f);
                                                    }
                                                }} />
                                        </label>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                                <Button type="button" variant="outline" className="rounded-xl font-semibold"
                                    onClick={() => { setOpenCreate(false); resetForm(); }}>Cancelar</Button>
                                <Button type="submit" className="rounded-xl font-extrabold gap-2 bg-blue-600 hover:bg-blue-700 px-8">
                                    {editing ? <><Edit3 size={15} /> Actualizar Convocatoria</> : <><Plus size={15} /> Guardar Convocatoria</>}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* ── Call cards ── */}
            {admissionCalls.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white py-16 flex flex-col items-center gap-3 text-center">
                    <div className="h-14 w-14 rounded-2xl bg-blue-50 border border-blue-100 grid place-items-center">
                        <Calendar size={24} className="text-blue-300" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-600">Sin convocatorias registradas</p>
                        <p className="text-xs text-slate-400 mt-0.5 max-w-xs mx-auto">
                            Comienza creando un proceso de admisión para habilitar el registro de postulantes.
                        </p>
                    </div>
                    <Button variant="outline" className="rounded-xl font-semibold gap-2 mt-1"
                        onClick={() => setOpenCreate(true)}>
                        <Plus size={15} /> Crear primera convocatoria
                    </Button>
                </div>
            ) : (
                <div className="space-y-4">
                    {admissionCalls.map(call => {
                        const status = getCallStatus(call);
                        const cfg = STATUS_CFG[status] ?? STATUS_CFG.CERRADA;
                        return (
                            <div key={call.id}
                                className="rounded-2xl border border-slate-200/80 bg-white shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-300 overflow-hidden">
                                {/* top bar */}
                                <div className={`h-1 w-full ${cfg.bar}`} />

                                <div className="p-5">
                                    {/* ── Card header ── */}
                                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                                <span className="font-mono text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                                    {call.academic_year}-{call.academic_period}
                                                </span>
                                                <StatusBadge status={status} />
                                            </div>
                                            <h3 className="font-extrabold text-slate-900 text-lg leading-tight truncate">{call.name}</h3>
                                            {call.description && (
                                                <p className="text-xs text-slate-400 mt-1 line-clamp-1">{call.description}</p>
                                            )}
                                        </div>
                                        <div className="sm:text-right shrink-0">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Postulantes</p>
                                            <p className="text-3xl font-black text-slate-800 tabular-nums">{call.total_applications || 0}</p>
                                        </div>
                                    </div>

                                    {/* ── Card body ── */}
                                    <div className="grid sm:grid-cols-3 gap-4">
                                        {/* Cronograma */}
                                        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 space-y-3">
                                            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                                                <Calendar size={11} /> Cronograma
                                            </p>
                                            <DateRow label="Inscripción" value={fmtDate(call.registration_start)} />
                                            <DateRow label="Cierre" value={fmtDate(call.registration_end)} />
                                            {call.exam_date && <DateRow label="Examen" value={fmtDate(call.exam_date)} highlight />}
                                        </div>

                                        {/* Oferta académica */}
                                        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
                                            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1.5 mb-3">
                                                <BookOpenCheck size={11} /> Oferta Académica
                                            </p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {call.careers?.slice(0, 4).map(c => (
                                                    <span key={c.id}
                                                        className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-600"
                                                        title={`${c.name} — ${c.vacancies} vacantes`}>
                                                        <span className="max-w-[90px] truncate font-medium">{c.name}</span>
                                                        <span className="border-l border-slate-200 pl-1.5 font-black text-slate-400 text-[10px] tabular-nums">{c.vacancies}</span>
                                                    </span>
                                                ))}
                                                {(call.careers?.length || 0) > 4 && (
                                                    <span className="inline-flex items-center px-2 py-1 rounded-lg bg-blue-50 border border-blue-100 text-blue-600 text-xs font-bold">
                                                        +{call.careers.length - 4} más
                                                    </span>
                                                )}
                                                {(!call.careers || call.careers.length === 0) && (
                                                    <p className="text-xs text-slate-400 italic">Sin carreras asignadas</p>
                                                )}
                                            </div>
                                            {/* Fee */}
                                            {Number(call.application_fee) > 0 && (
                                                <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-slate-100">
                                                    <CreditCard size={11} className="text-slate-400" />
                                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Costo:</span>
                                                    <span className="text-xs font-black text-slate-700">S/ {fmtMoney(call.application_fee)}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex flex-col gap-2 justify-end">
                                            <div className="flex gap-2">
                                                <Button variant="outline"
                                                    className="flex-1 rounded-xl font-semibold gap-2 h-10 justify-start hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700"
                                                    onClick={() => { setViewCall(call); setOpenView(true); }}>
                                                    <Eye size={15} className="text-slate-400" /> Ver Detalles
                                                    <ChevronRight size={13} className="ml-auto text-slate-300" />
                                                </Button>
                                                <Button variant="outline" size="icon"
                                                    className="h-10 w-10 rounded-xl hover:bg-amber-50 hover:border-amber-200 hover:text-amber-600 text-slate-400"
                                                    onClick={() => startEdit(call)} title="Editar">
                                                    <Edit3 size={15} />
                                                </Button>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button variant="outline"
                                                    className="flex-1 rounded-xl font-semibold gap-2 h-10 text-xs hover:bg-slate-50"
                                                    onClick={() => publishResults(call)}>
                                                    <FileText size={14} /> Resultados
                                                </Button>
                                                <Button variant="outline" size="icon"
                                                    className="h-10 w-10 rounded-xl hover:bg-slate-50"
                                                    onClick={() => downloadActa(call)} title="Descargar Acta">
                                                    <Download size={15} />
                                                </Button>
                                                <Button variant="outline" size="icon"
                                                    className="h-10 w-10 rounded-xl hover:bg-red-50 hover:border-red-200 hover:text-red-600 text-slate-400"
                                                    onClick={() => askDelete(call)} title="Eliminar">
                                                    <Trash2 size={15} />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ════ DELETE DIALOG ════ */}
            <Dialog open={openDelete} onOpenChange={v => { if (deleting) return; setOpenDelete(v); if (!v) setDeleteCall(null); }}>
                <DialogContent className="max-w-md rounded-2xl p-0 overflow-hidden border-0 shadow-2xl">
                    <div className="h-1 bg-gradient-to-r from-red-500 to-rose-400" />
                    <div className="px-5 pt-5 pb-4 border-b border-slate-100">
                        <DialogHeader>
                            <DialogTitle className="font-extrabold text-slate-900 flex items-center gap-2">
                                <div className="h-8 w-8 rounded-xl bg-red-50 border border-red-200 grid place-items-center shrink-0">
                                    <Trash2 size={14} className="text-red-600" />
                                </div>
                                Eliminar convocatoria
                            </DialogTitle>
                            <DialogDescription className="text-slate-500 text-sm mt-1">
                                Esta acción no se puede deshacer.
                            </DialogDescription>
                        </DialogHeader>
                    </div>
                    <div className="p-5 space-y-4">
                        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                            <p className="font-extrabold text-slate-900 leading-tight">{deleteCall?.name || "—"}</p>
                            {deleteCall?.academic_year && (
                                <p className="text-xs text-slate-400 font-mono mt-1">
                                    {deleteCall.academic_year}-{deleteCall.academic_period}
                                </p>
                            )}
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" className="rounded-xl font-semibold"
                                disabled={deleting}
                                onClick={() => { setOpenDelete(false); setDeleteCall(null); }}>
                                Cancelar
                            </Button>
                            <Button type="button" onClick={confirmDelete} disabled={deleting}
                                className="rounded-xl font-extrabold gap-2 bg-red-600 hover:bg-red-700">
                                {deleting ? <><Loader2 size={14} className="animate-spin" /> Eliminando…</> : "Sí, eliminar"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ════ VIEW DIALOG ════ */}
            <Dialog open={openView} onOpenChange={setOpenView}>
                <DialogContent className="max-w-3xl rounded-2xl p-0 overflow-hidden border-0 shadow-2xl">
                    <div className="bg-gradient-to-r from-[#0f1a3a] via-[#171a55] to-[#251c6c] px-6 py-5 text-white">
                        <div className="flex items-start gap-3">
                            <div className="h-11 w-11 rounded-xl bg-white/10 border border-white/20 grid place-items-center shrink-0">
                                <Calendar size={19} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-300 mb-0.5">Detalles de Convocatoria</p>
                                <p className="font-extrabold text-white leading-tight truncate">{viewCall?.name}</p>
                                {viewCall && (
                                    <div className="flex items-center gap-2 mt-1.5">
                                        <span className="font-mono text-[10px] bg-white/10 text-blue-200 px-2 py-0.5 rounded">
                                            {viewCall.academic_year}-{viewCall.academic_period}
                                        </span>
                                        <StatusBadge status={getCallStatus(viewCall)} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {viewCall && (
                        <div className="bg-white p-6 space-y-6">
                            {/* Description */}
                            {viewCall.description && (
                                <div className="rounded-xl border border-blue-100 bg-blue-50/40 px-4 py-3 text-sm text-slate-700 leading-relaxed">
                                    {viewCall.description}
                                </div>
                            )}

                            {/* Metrics grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {[
                                    { label: "Inicio Inscripción", value: fmtDateTime(viewCall.registration_start) },
                                    { label: "Fin Inscripción", value: fmtDateTime(viewCall.registration_end) },
                                    { label: "Examen", value: fmtDateTime(viewCall.exam_date), highlight: true },
                                    { label: "Resultados", value: fmtDateTime(viewCall.results_date) },
                                    { label: "Costo", value: `S/ ${fmtMoney(viewCall.application_fee)}` },
                                    { label: "Máx. Postulaciones", value: viewCall.max_applications_per_career },
                                    { label: "Edad Mínima", value: `${viewCall.minimum_age ?? "—"} años` },
                                    { label: "Edad Máxima", value: `${viewCall.maximum_age ?? "—"} años` },
                                ].map(({ label, value, highlight }) => (
                                    <div key={label}
                                        className={`rounded-xl border p-3 ${highlight ? "bg-blue-50/40 border-blue-100" : "bg-slate-50/60 border-slate-100"}`}>
                                        <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${highlight ? "text-blue-600" : "text-slate-400"}`}>{label}</p>
                                        <p className={`text-sm font-bold ${highlight ? "text-blue-700" : "text-slate-800"}`}>{value}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Required docs */}
                            <div>
                                <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">Documentos Requeridos</p>
                                <div className="flex flex-wrap gap-2">
                                    {(viewCall.required_documents || []).length > 0
                                        ? viewCall.required_documents.map(d => (
                                            <span key={d} className="inline-flex items-center gap-1.5 text-xs font-semibold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full border border-slate-200">
                                                <CheckCircle2 size={10} className="text-slate-400" />{d}
                                            </span>
                                        ))
                                        : <span className="text-xs text-slate-400 italic">Ninguno especificado</span>
                                    }
                                </div>
                            </div>

                            {/* Careers */}
                            <div>
                                <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">
                                    Carreras y Vacantes ({viewCall.careers?.length || 0})
                                </p>
                                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-52 overflow-y-auto">
                                    {(viewCall.careers || []).map(c => (
                                        <div key={c.id}
                                            className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5 hover:border-indigo-200 hover:bg-indigo-50/20 transition-colors">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className="h-6 w-6 rounded-lg bg-indigo-50 border border-indigo-100 grid place-items-center shrink-0">
                                                    <GraduationCap size={11} className="text-indigo-600" />
                                                </div>
                                                <p className="text-xs font-semibold text-slate-700 truncate">{c.name}</p>
                                            </div>
                                            <span className="text-[10px] font-black tabular-nums text-slate-500 bg-white border border-slate-200 rounded-full px-2 py-0.5 shrink-0">
                                                {c.vacancies} vac.
                                            </span>
                                        </div>
                                    ))}
                                    {(!viewCall.careers || viewCall.careers.length === 0) && (
                                        <div className="col-span-3 py-6 text-center">
                                            <p className="text-xs text-slate-400 italic">No hay carreras asignadas</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
