// src/modules/admission/AdmissionCertificates.jsx — UI/UX mejorado
// Toda la lógica de negocio preservada exactamente.
import React, { useState } from "react";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import { AdmissionPublic } from "../../services/admission.service";
import {
    Search, Download, FileText, User, Loader2, AlertCircle,
    CheckCircle2, XCircle, GraduationCap, Camera, Printer,
    Calendar, MapPin, Phone, Mail, IdCard, Award,
} from "lucide-react";

/* ─── inject styles ─── */
function InjectCertStyles() {
    React.useEffect(() => {
        const id = "cert-styles";
        if (document.getElementById(id)) return;
        const l = document.createElement("link");
        l.id = id + "-font"; l.rel = "stylesheet";
        l.href = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap";
        document.head.appendChild(l);
        const s = document.createElement("style");
        s.id = id;
        s.textContent = `
          .ac-root { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
          .ac-root * { font-family: inherit; }

          /* module header */
          .ac-header {
            border-top: 3px solid transparent;
            border-image: linear-gradient(90deg,#3B82F6,#6366F1,#8B5CF6) 1;
            border-radius: 1rem 1rem 0 0;
          }

          /* card */
          .ac-card { border-radius:16px; border:1px solid #E2E8F0; background:#fff; overflow:hidden; }
          .ac-card-header { padding:14px 20px; border-bottom:1px solid #F1F5F9; background:#F8FAFC; display:flex; align-items:center; justify-content:space-between; gap:12px; }

          /* status badges */
          .ac-st-registered  { background:#DBEAFE; color:#1E40AF; border:1px solid #93C5FD; }
          .ac-st-evaluated   { background:#EDE9FE; color:#5B21B6; border:1px solid #C4B5FD; }
          .ac-st-admitted    { background:#DCFCE7; color:#166534; border:1px solid #86EFAC; box-shadow:0 0 0 2px rgba(134,239,172,.4); }
          .ac-st-not_admitted{ background:#FEE2E2; color:#991B1B; border:1px solid #FCA5A5; }
          .ac-st-waiting     { background:#FEF3C7; color:#92400E; border:1px solid #FDE68A; }

          /* data field */
          .ac-field-label { font-size:10px; font-weight:800; color:#94A3B8; text-transform:uppercase; letter-spacing:.08em; }
          .ac-field-value { font-size:13px; font-weight:700; color:#1E293B; margin-top:1px; }

          /* download card */
          .ac-dl-card {
            border-radius:16px; border:2px solid #E2E8F0; padding:20px;
            display:flex; flex-direction:column; align-items:center; gap:12px;
            text-align:center; cursor:pointer; background:#fff;
            transition:border-color .15s, background .15s, transform .18s;
          }
          .ac-dl-card:hover:not(:disabled) { transform:translateY(-2px); }
          .ac-dl-card:disabled { opacity:.5; cursor:not-allowed; }
          .ac-dl-inscripcion { border-color:#BFDBFE; background:#F0F7FF; }
          .ac-dl-inscripcion:hover:not(:disabled) { border-color:#3B82F6; background:#EFF6FF; box-shadow:0 4px 16px rgba(59,130,246,.15); }
          .ac-dl-ingreso-ok  { border-color:#BBF7D0; background:#F0FDF4; }
          .ac-dl-ingreso-ok:hover:not(:disabled) { border-color:#10B981; background:#ECFDF5; box-shadow:0 4px 16px rgba(16,185,129,.15); }
          .ac-dl-ingreso-no  { border-color:#E2E8F0; background:#F8FAFC; cursor:not-allowed; opacity:.55; }

          /* input */
          .ac-input {
            height:44px; width:100%; border-radius:12px; border:1px solid #E2E8F0;
            background:#F8FAFC; padding:0 12px 0 44px;
            font-size:15px; color:#1E293B; outline:none; font-family:inherit;
            transition:border-color .15s, box-shadow .15s, background .15s;
          }
          .ac-input:focus { border-color:#6366F1; box-shadow:0 0 0 3px rgba(99,102,241,.12); background:#fff; }

          /* notice */
          .ac-notice { border-radius:12px; padding:12px 16px; display:flex; align-items:start; gap:10px; }
          .ac-notice-slate { background:#F8FAFC; border:1px solid #E2E8F0; }
          .ac-notice-amber { background:#FFFBEB; border:1px solid #FDE68A; }

          /* empty state */
          .ac-empty { border:2px dashed #E2E8F0; border-radius:16px; padding:56px 24px; text-align:center; }

          @keyframes ac-fade { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
          .ac-fade { animation:ac-fade .28s ease both; }
        `;
        document.head.appendChild(s);
        return () => { document.getElementById(id)?.remove(); document.getElementById(id + "-font")?.remove(); };
    }, []);
    return null;
}

/* ─── constants ─── */
const STATUS_MAP = {
    REGISTERED: { label: "Inscrito", cls: "ac-st-registered", Icon: FileText },
    EVALUATED: { label: "Evaluado", cls: "ac-st-evaluated", Icon: FileText },
    ADMITTED: { label: "INGRESANTE", cls: "ac-st-admitted", Icon: CheckCircle2 },
    INGRESANTE: { label: "INGRESANTE", cls: "ac-st-admitted", Icon: CheckCircle2 },
    NOT_ADMITTED: { label: "No admitido", cls: "ac-st-not_admitted", Icon: XCircle },
    WAITING_LIST: { label: "Lista de espera", cls: "ac-st-waiting", Icon: AlertCircle },
};

/* ─── helpers ─── */
function downloadBlob(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

/* ─── StatusBadge ─── */
function StatusBadge({ status }) {
    const cfg = STATUS_MAP[status] || { label: status, cls: "ac-st-evaluated", Icon: FileText };
    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-800 ${cfg.cls}`}>
            <cfg.Icon className="w-3.5 h-3.5" />{cfg.label}
        </span>
    );
}

/* ─── DataField ─── */
function DataField({ icon: Icon, label, value }) {
    if (!value) return null;
    return (
        <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="min-w-0">
                <p className="ac-field-label">{label}</p>
                <p className="ac-field-value truncate">{value}</p>
            </div>
        </div>
    );
}

/* ════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════ */
export default function AdmissionCertificates() {
    const [dni, setDni] = useState("");
    const [searching, setSearching] = useState(false);
    const [applicant, setApplicant] = useState(null);
    const [notFound, setNotFound] = useState(false);
    const [generating, setGenerating] = useState({});

    const handleSearch = async () => {
        const cleanDni = dni.trim();
        if (cleanDni.length < 8) { toast.error("Ingrese un N° de DNI válido (mínimo 8 dígitos)"); return; }
        setSearching(true); setApplicant(null); setNotFound(false);
        try {
            const resp = await AdmissionPublic.searchByDni(cleanDni);
            if (resp && (resp.application_id || resp.id)) setApplicant(resp);
            else setNotFound(true);
        } catch (e) {
            if (e?.response?.status === 404) setNotFound(true);
            else toast.error("Error al buscar postulante");
        } finally { setSearching(false); }
    };

    const downloadInscripcion = async () => {
        if (!applicant) return;
        const appId = applicant.application_id || applicant.id;
        setGenerating((p) => ({ ...p, inscripcion: true }));
        try {
            const blob = await AdmissionPublic.downloadInscripcion(appId);
            downloadBlob(blob, `Constancia_Inscripcion_${applicant.dni || dni}.pdf`);
            toast.success("Constancia de Inscripción descargada");
        } catch { toast.error("No se pudo generar la Constancia de Inscripción"); }
        finally { setGenerating((p) => ({ ...p, inscripcion: false })); }
    };

    const downloadIngreso = async () => {
        if (!applicant) return;
        const appId = applicant.application_id || applicant.id;
        setGenerating((p) => ({ ...p, ingreso: true }));
        try {
            const blob = await AdmissionPublic.downloadIngreso(appId);
            downloadBlob(blob, `Constancia_Ingreso_${applicant.dni || dni}.pdf`);
            toast.success("Constancia de Ingreso descargada");
        } catch { toast.error("No se pudo generar la Constancia de Ingreso"); }
        finally { setGenerating((p) => ({ ...p, ingreso: false })); }
    };

    const isAdmitted = applicant?.status === "ADMITTED" || applicant?.status === "INGRESANTE";

    return (
        <>
            <InjectCertStyles />
            <div className="ac-root max-w-3xl mx-auto space-y-5 pb-8">

                {/* ── module header ── */}
                <div className="ac-header ac-card">
                    <div className="px-6 py-5 flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25 shrink-0">
                                <Printer className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-900 text-slate-800 tracking-tight">Constancias de Admisión</h2>
                                <p className="text-xs text-slate-400 mt-0.5 font-500">Ingrese el DNI del postulante para buscar y descargar sus constancias.</p>
                            </div>
                        </div>
                        <span className="hidden sm:inline-flex items-center px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-[11px] font-800 text-blue-700 uppercase tracking-wider">
                            Admisión
                        </span>
                    </div>
                </div>

                {/* ── search ── */}
                <div className="ac-card">
                    <div className="ac-card-header">
                        <p className="text-xs font-800 text-slate-500 uppercase tracking-wider">Buscar postulante por DNI</p>
                    </div>
                    <div className="p-5">
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="flex-1 relative">
                                <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input type="text" className="ac-input" value={dni}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, "");
                                        setDni(val);
                                        if (val.length < 8) { setApplicant(null); setNotFound(false); }
                                    }}
                                    onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                                    placeholder="Ingrese N° de DNI del postulante" maxLength={12} />
                            </div>
                            <Button onClick={handleSearch} disabled={searching || dni.trim().length < 8}
                                className="h-11 px-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-700 shadow-sm gap-2">
                                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Search className="w-4 h-4" /> Buscar</>}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* ── not found ── */}
                {notFound && (
                    <div className="ac-notice ac-notice-amber ac-fade">
                        <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                        <div>
                            <p className="text-sm font-800 text-amber-800">Postulante no encontrado</p>
                            <p className="text-xs text-amber-700 mt-0.5">No se encontró ningún postulante con el DNI <strong>{dni}</strong>. Verifique el número e intente nuevamente.</p>
                        </div>
                    </div>
                )}

                {/* ── empty state ── */}
                {!applicant && !notFound && !searching && (
                    <div className="ac-empty">
                        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                            <Search className="w-8 h-8 text-slate-300" />
                        </div>
                        <p className="text-base font-800 text-slate-400">Busque un postulante</p>
                        <p className="text-sm text-slate-400 mt-1">Ingrese el número de DNI para consultar y descargar constancias.</p>
                    </div>
                )}

                {/* ── applicant data ── */}
                {applicant && (
                    <div className="space-y-4 ac-fade">

                        {/* profile card */}
                        <div className="ac-card overflow-hidden">
                            {/* gradient banner */}
                            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
                                <p className="text-white font-800 text-base">Datos del Postulante</p>
                                {applicant.status && <StatusBadge status={applicant.status} />}
                            </div>

                            <div className="p-6">
                                <div className="flex flex-col sm:flex-row gap-6">
                                    {/* photo */}
                                    <div className="shrink-0 flex flex-col items-center gap-1.5">
                                        <div className="w-28 h-36 rounded-xl overflow-hidden border-4 border-slate-100 shadow-md bg-slate-100 flex items-center justify-center">
                                            {applicant.photo_url
                                                ? <img src={applicant.photo_url} alt="Foto" className="w-full h-full object-cover" />
                                                : <Camera className="w-10 h-10 text-slate-300" />}
                                        </div>
                                        <p className="text-[10px] text-slate-400 font-600">Foto carné</p>
                                    </div>

                                    {/* fields grid */}
                                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <DataField icon={User} label="Nombre completo" value={applicant.full_name || applicant.applicant_name} />
                                        <DataField icon={IdCard} label="DNI" value={applicant.dni || dni} />
                                        <DataField icon={GraduationCap} label="Especialidad" value={applicant.career_name || applicant.career} />
                                        <DataField icon={FileText} label="N° Postulación" value={applicant.application_number} />
                                        <DataField icon={Calendar} label="Fecha de nacimiento" value={applicant.birth_date || applicant.fecha_nacimiento} />
                                        <DataField icon={User} label="Sexo" value={applicant.gender || applicant.sexo} />
                                        <DataField icon={MapPin} label="Domicilio" value={applicant.address || applicant.direccion} />
                                        <DataField icon={Phone} label="Teléfono" value={applicant.phone} />
                                        <DataField icon={Mail} label="Correo" value={applicant.email} />
                                        <DataField icon={FileText} label="Modalidad" value={applicant.admission_mode || applicant.modalidad_admision} />
                                        {applicant.final_score != null && <DataField icon={Award} label="Puntaje final" value={`${applicant.final_score}`} />}
                                        {applicant.merit_order != null && <DataField icon={Award} label="Orden de mérito" value={`${applicant.merit_order}°`} />}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* download cards */}
                        <div className="ac-card">
                            <div className="ac-card-header">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                                        <Printer className="w-4 h-4 text-blue-600" />
                                    </div>
                                    <p className="text-sm font-800 text-slate-800">Descargar Constancias</p>
                                </div>
                            </div>
                            <div className="p-5">
                                <div className="grid sm:grid-cols-2 gap-4">
                                    {/* inscripcion */}
                                    <button onClick={downloadInscripcion} disabled={generating.inscripcion}
                                        className={`ac-dl-card ac-dl-inscripcion ${generating.inscripcion ? "opacity-60 cursor-wait" : ""}`}>
                                        {generating.inscripcion
                                            ? <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                                            : <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center">
                                                <FileText className="w-7 h-7 text-blue-600" />
                                            </div>}
                                        <div>
                                            <p className="text-sm font-800 text-slate-800">Constancia de Inscripción</p>
                                            <p className="text-[11px] text-slate-500 mt-0.5">Formato horizontal · Con foto, datos y firma</p>
                                        </div>
                                        <span className="inline-flex items-center gap-1.5 text-xs font-800 text-blue-600">
                                            <Download className="w-3.5 h-3.5" /> Descargar PDF
                                        </span>
                                    </button>

                                    {/* ingreso */}
                                    <button onClick={isAdmitted ? downloadIngreso : undefined}
                                        disabled={generating.ingreso || !isAdmitted}
                                        className={`ac-dl-card ${isAdmitted ? "ac-dl-ingreso-ok" : "ac-dl-ingreso-no"} ${generating.ingreso ? "opacity-60 cursor-wait" : ""}`}>
                                        {generating.ingreso
                                            ? <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
                                            : <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isAdmitted ? "bg-emerald-100" : "bg-slate-100"}`}>
                                                <GraduationCap className={`w-7 h-7 ${isAdmitted ? "text-emerald-600" : "text-slate-400"}`} />
                                            </div>}
                                        <div>
                                            <p className="text-sm font-800 text-slate-800">Constancia de Ingreso</p>
                                            <p className="text-[11px] text-slate-500 mt-0.5">
                                                {isAdmitted ? "Formato vertical · Constancia oficial" : "Disponible solo para ingresantes"}
                                            </p>
                                        </div>
                                        {isAdmitted
                                            ? <span className="inline-flex items-center gap-1.5 text-xs font-800 text-emerald-600"><Download className="w-3.5 h-3.5" /> Descargar PDF</span>
                                            : <span className="inline-flex items-center gap-1.5 text-xs text-slate-400"><XCircle className="w-3.5 h-3.5" /> No disponible</span>}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* notice */}
                        <div className="ac-notice ac-notice-slate">
                            <AlertCircle className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                            <div className="text-xs text-slate-500 space-y-1">
                                <p><strong className="text-slate-700">Constancia de Inscripción:</strong> Acredita la inscripción en el proceso de admisión. Presentar el día del examen con DNI.</p>
                                <p><strong className="text-slate-700">Constancia de Ingreso:</strong> Solo para ingresantes. Documento oficial que acredita el ingreso.</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}