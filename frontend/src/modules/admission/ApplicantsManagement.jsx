// src/modules/admission/ApplicantsManagement.jsx
//
// Gestión de Postulantes — Ficha MINEDU
// FIX: extrae datos correctamente de data.profile / data.school / applicant_detail
//
import React, { useEffect, useState } from "react";
import api from "../../lib/api";

import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "../../components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../../components/ui/select";
import { toast } from "sonner";
import {
    Plus, Eye, Edit, Download, Calendar, GraduationCap, X,
    Trash2, Search, Users, FileSpreadsheet, User, Loader2,
    BookOpen, CheckCircle2, AlertCircle, Award, Layers,
} from "lucide-react";

/* ─── Helpers ────────────────────────────────────────────── */
function formatApiError(err, fallback = "Ocurrió un error") {
    const data = err?.response?.data;
    if (data?.detail) {
        const d = data.detail;
        if (typeof d === "string") return d;
        if (Array.isArray(d)) {
            const msgs = d.map(e => {
                const field = Array.isArray(e?.loc) ? e.loc.join(".") : e?.loc;
                return e?.msg ? (field ? `${field}: ${e.msg}` : e.msg) : null;
            }).filter(Boolean);
            if (msgs.length) return msgs.join(" | ");
        }
    }
    if (typeof data?.error?.message === "string") return data.error.message;
    if (typeof data?.message === "string") return data.message;
    if (typeof data?.error === "string") return data.error;
    if (typeof err?.message === "string") return err.message;
    return fallback;
}

/* ─── Small shared components ────────────────────────────── */
const SectionHead = ({ label, color = "blue", icon: Icon }) => {
    const colorMap = {
        blue: { box: "bg-blue-50 border-blue-100 text-blue-600", text: "text-blue-700" },
        emerald: { box: "bg-emerald-50 border-emerald-100 text-emerald-600", text: "text-emerald-700" },
        orange: { box: "bg-orange-50 border-orange-100 text-orange-600", text: "text-orange-700" },
        purple: { box: "bg-purple-50 border-purple-100 text-purple-600", text: "text-purple-700" },
        amber: { box: "bg-amber-50 border-amber-100 text-amber-600", text: "text-amber-700" },
        indigo: { box: "bg-indigo-50 border-indigo-100 text-indigo-600", text: "text-indigo-700" },
    };
    const c = colorMap[color] ?? colorMap.blue;
    return (
        <div className="flex items-center gap-2 mb-3">
            {Icon && (
                <div className={`h-6 w-6 rounded-lg border grid place-items-center shrink-0 ${c.box}`}>
                    <Icon size={12} />
                </div>
            )}
            <p className={`text-[10px] font-extrabold uppercase tracking-widest ${c.text}`}>{label}</p>
            <div className="flex-1 h-px bg-slate-100" />
        </div>
    );
};

const FieldDisplay = ({ label, value, mono, wide }) => (
    <div className={wide ? "sm:col-span-2" : ""}>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
        <p className={`text-sm text-slate-800 ${mono ? "font-mono" : "font-semibold"}`}>{value || "—"}</p>
    </div>
);

const FormField = ({ label, error, required, children }) => (
    <div className="space-y-1.5">
        <Label className={`text-[10px] font-bold uppercase tracking-wider ${error ? "text-red-600" : "text-slate-500"}`}>
            {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </Label>
        {children}
        {error && <p className="flex items-center gap-1 text-xs text-red-600 font-semibold"><AlertCircle size={10} />{error}</p>}
    </div>
);

const LoadingSpinner = () => (
    <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-blue-50 border border-blue-100 grid place-items-center">
                <Loader2 size={22} className="animate-spin text-blue-500" />
            </div>
            <p className="text-sm text-slate-400 font-medium">Cargando…</p>
        </div>
    </div>
);

/* ─── Application status badge ───────────────────────────── */
const AppStatusBadge = ({ status }) => {
    const st = (status || "").toUpperCase();
    const cfg =
        st === "ADMITTED" || st === "ADMITIDO" ? { cls: "bg-emerald-50 text-emerald-700 border-emerald-200" } :
            st === "EVALUATED" || st === "EVALUADO" ? { cls: "bg-blue-50 text-blue-700 border-blue-200" } :
                st === "REJECTED" || st === "RECHAZADO" ? { cls: "bg-red-50 text-red-700 border-red-200" } :
                    st === "PAID" || st === "PAGADO" ? { cls: "bg-teal-50 text-teal-700 border-teal-200" } :
                        st === "REGISTERED" ? { cls: "bg-amber-50 text-amber-700 border-amber-200" } :
                            { cls: "bg-slate-100 text-slate-600 border-slate-200" };
    return (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.cls}`}>
            {status || "CREATED"}
        </span>
    );
};

/* ══════════════════════════════════════════════════════════════
   FIX PRINCIPAL: Funciones de extracción de datos
   
   El backend guarda los datos del postulante en:
     Application.data = {
       "source": "PUBLIC",
       "profile": { nombres, apellido_paterno, sexo, ... },
       "school":  { colegio_procedencia, anio_egreso, ... },
       "photo_base64": "..."
     }
   
   Además, Application.applicant_detail viene del serializer expandido
   con { names, dni, email, phone }.
   
   La función d() busca en TODOS estos niveles.
═══════════════════════════════════════════════════════════════ */

const d = (row, key, fallback = "—") => {
    if (!row) return fallback;

    const data = (typeof row.data === "object" && row.data !== null) ? row.data : {};
    const profile = data.profile || {};
    const school = data.school || {};

    // applicant puede ser un objeto expandido o un ID numérico
    const applicant = (typeof row.applicant === "object" && row.applicant !== null)
        ? row.applicant : {};
    // Campo plano applicant_detail del serializer expandido
    const applicantDetail = (typeof row.applicant_detail === "object" && row.applicant_detail !== null)
        ? row.applicant_detail : {};

    // 1) profile (donde public_apply guarda campos MINEDU)
    if (profile[key] != null && profile[key] !== "") return String(profile[key]);

    // 2) school
    if (school[key] != null && school[key] !== "") return String(school[key]);

    // 3) data raíz (compatibilidad)
    if (data[key] != null && data[key] !== "" && typeof data[key] !== "object") return String(data[key]);

    // 4) applicant_detail (serializer expandido)
    if (applicantDetail[key] != null && applicantDetail[key] !== "") return String(applicantDetail[key]);

    // 5) applicant objeto (si viene expandido)
    if (applicant[key] != null && applicant[key] !== "") return String(applicant[key]);

    // 6) campo directo en row
    if (row[key] != null && row[key] !== "" && typeof row[key] !== "object") return String(row[key]);

    return fallback;
};

/**
 * Extrae el nombre completo buscando en múltiples fuentes.
 * Soporta tanto el wizard público (first_names, last_name_father, last_name_mother)
 * como el wizard interno (nombres, apellido_paterno, apellido_materno).
 */
const fullName = (row) => {
    if (!row) return "—";

    // Intentar con campos en español (ApplicationWizard)
    let nombres = d(row, "nombres", "");
    let apPat = d(row, "apellido_paterno", "");
    let apMat = d(row, "apellido_materno", "");

    // Si no hay, intentar con campos en inglés (PublicApplicationWizard)
    if (!nombres) nombres = d(row, "first_names", d(row, "names", ""));
    if (!apPat) apPat = d(row, "last_name_father", "");
    if (!apMat) apMat = d(row, "last_name_mother", "");

    if (apPat || apMat || nombres) {
        const parts = [apPat, apMat].filter(Boolean).join(" ");
        if (parts && nombres) return `${parts}, ${nombres}`;
        return parts || nombres || "—";
    }

    // Fallbacks
    const applicant = (typeof row.applicant === "object" && row.applicant !== null)
        ? row.applicant : {};
    const applicantDetail = (typeof row.applicant_detail === "object" && row.applicant_detail !== null)
        ? row.applicant_detail : {};

    return applicantDetail.names || applicant.names ||
        row.applicant_name || row.applicant?.names || "—";
};

/**
 * Extrae el DNI buscando en múltiples fuentes.
 */
const getDni = (row) => {
    if (!row) return "—";

    // profile fields
    const fromProfile = d(row, "document_number", "");
    if (fromProfile && fromProfile !== "—") return fromProfile;

    const fromDni = d(row, "dni", "");
    if (fromDni && fromDni !== "—") return fromDni;

    const fromNumDoc = d(row, "numero_documento_identidad", "");
    if (fromNumDoc && fromNumDoc !== "—") return fromNumDoc;

    // Campos directos
    if (row.applicant_dni) return String(row.applicant_dni);

    // Applicant expandido
    const applicant = (typeof row.applicant === "object" && row.applicant !== null) ? row.applicant : {};
    const applicantDetail = (typeof row.applicant_detail === "object" && row.applicant_detail !== null) ? row.applicant_detail : {};

    return applicantDetail.dni || applicant.dni || "—";
};

/* ══════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
═══════════════════════════════════════════════════════════════ */

export default function ApplicantsManagement() {
    const [rows, setRows] = useState([]);
    const [calls, setCalls] = useState([]);
    const [careers, setCareers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [callFilter, setCallFilter] = useState("");
    const [careerFilter, setCareerFilter] = useState("");
    const [searchDni, setSearchDni] = useState("");
    const [openCreate, setOpenCreate] = useState(false);
    const [createForm, setCreateForm] = useState({ call_id: "", career_id: "" });
    const [openView, setOpenView] = useState(false);
    const [viewRow, setViewRow] = useState(null);

    const callName = (id) => calls.find(c => String(c.id) === String(id))?.name ?? `Conv. ${id ?? "—"}`;
    const careerName = (id) => careers.find(c => String(c.id) === String(id))?.name ?? `${id ?? "—"}`;

    const buildQuery = () => {
        const params = new URLSearchParams();
        if (callFilter) params.set("call_id", callFilter);
        if (careerFilter) params.set("career_id", careerFilter);
        const q = params.toString();
        return q ? `?${q}` : "";
    };

    const fetchAll = async () => {
        try {
            const [appsRes, callsRes, careersRes] = await Promise.all([
                api.get(`/applications${buildQuery()}`),
                api.get("/admission-calls"),
                api.get("/careers"),
            ]);
            const appsList = appsRes?.data?.applications ?? appsRes?.data ?? [];
            setRows(Array.isArray(appsList) ? appsList : []);
            setCalls(Array.isArray(callsRes?.data) ? callsRes.data : (callsRes?.data?.calls ?? callsRes?.data ?? []));
            setCareers(Array.isArray(careersRes?.data) ? careersRes.data : (careersRes?.data?.careers ?? careersRes?.data ?? []));
        } catch (e) {
            toast.error(formatApiError(e, "Error al cargar postulantes"));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAll(); }, []);
    useEffect(() => { setLoading(true); fetchAll(); }, [callFilter, careerFilter]);

    const submitCreate = async (e) => {
        e.preventDefault();
        if (!createForm.call_id || !createForm.career_id) {
            toast.error("Selecciona convocatoria y carrera");
            return;
        }
        try {
            await api.post("/applications", {
                call_id: Number(createForm.call_id),
                career_id: Number(createForm.career_id),
            });
            toast.success("Postulación creada");
            setOpenCreate(false);
            setCreateForm({ call_id: "", career_id: "" });
            setLoading(true);
            fetchAll();
        } catch (e) {
            toast.error(formatApiError(e, "No se pudo crear la postulación"));
        }
    };

    const exportXlsx = async () => {
        try {
            const params = new URLSearchParams();
            if (callFilter) params.set("call_id", callFilter);
            if (careerFilter) params.set("career_id", careerFilter);
            const query = params.toString() ? `?${params.toString()}` : "";

            const resp = await api.get(`/reports/admission.xlsx${query}`, {
                responseType: "blob",
            });

            // Verificar que el blob es realmente un Excel y no un JSON de error
            const blob = new Blob([resp.data], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            });

            // Si el blob es muy pequeño, probablemente es un error
            if (blob.size < 100) {
                toast.error("El reporte está vacío o hubo un error al generarlo");
                return;
            }

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "reporte_admision.xlsx";
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (e) {
            toast.error(formatApiError(e, "No se pudo exportar"));
        }
    };

    const filteredRows = searchDni
        ? rows.filter(r => getDni(r).includes(searchDni))
        : rows;

    if (loading) return <LoadingSpinner />;

    const sectionBlock = (children, color, label, Icon) => (
        <div>
            <SectionHead label={label} color={color} icon={Icon} />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 bg-slate-50/60 p-4 rounded-xl border border-slate-100">
                {children}
            </div>
        </div>
    );

    return (
        <div className="max-w-full mx-auto space-y-5 pb-12">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                        <div className="h-8 w-8 rounded-xl bg-blue-50 border border-blue-100 grid place-items-center shrink-0">
                            <Users size={16} className="text-blue-600" />
                        </div>
                        Gestión de Postulantes
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5 ml-10 font-medium uppercase tracking-wider">
                        Ficha MINEDU — Reporte de Admisión
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm p-5">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                    <div className="md:col-span-3">
                        <FormField label="Convocatoria">
                            <Select value={callFilter || "__all__"} onValueChange={v => setCallFilter(v === "__all__" ? "" : v)}>
                                <SelectTrigger className="h-10 rounded-xl">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Calendar size={14} className="text-slate-400 shrink-0" />
                                        <SelectValue placeholder="Todas" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__all__">Todas</SelectItem>
                                    {calls.filter(c => c?.id != null).map(c => (
                                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </FormField>
                    </div>
                    <div className="md:col-span-3">
                        <FormField label="Programa de Estudios">
                            <Select value={careerFilter || "__all__"} onValueChange={v => setCareerFilter(v === "__all__" ? "" : v)}>
                                <SelectTrigger className="h-10 rounded-xl">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <GraduationCap size={14} className="text-slate-400 shrink-0" />
                                        <SelectValue placeholder="Todos" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__all__">Todos</SelectItem>
                                    {careers.filter(c => c?.id != null).map(c => (
                                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </FormField>
                    </div>
                    <div className="md:col-span-3">
                        <FormField label="Buscar DNI">
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <Input placeholder="N° documento…" className="h-10 pl-9 rounded-xl font-mono"
                                    value={searchDni} onChange={e => setSearchDni(e.target.value)} />
                            </div>
                        </FormField>
                    </div>
                    <div className="md:col-span-3 flex gap-2 items-end">
                        <Button variant="outline" className="rounded-xl font-semibold h-10 flex-1 gap-1.5"
                            onClick={() => { setCallFilter(""); setCareerFilter(""); setSearchDni(""); }}>
                            <X size={14} /> Limpiar
                        </Button>
                        <Button variant="outline" className="rounded-xl font-semibold h-10 gap-1.5" onClick={exportXlsx}>
                            <Download size={14} /> Excel
                        </Button>
                        <Button className="rounded-xl font-extrabold h-10 gap-1.5 bg-blue-600 hover:bg-blue-700"
                            onClick={() => setOpenCreate(true)}>
                            <Plus size={14} /> Nuevo
                        </Button>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs whitespace-nowrap">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                {["N°", "DNI", "Apellidos y Nombres", "Sexo", "Programa de Estudios", "Modalidad Admisión", "Asist.", "Estado", "Beca", "Discap.", ""].map((h, i) => (
                                    <th key={i} className={`px-3 py-3.5 font-bold text-[10px] uppercase tracking-widest text-slate-500 ${i === 0 || i === 3 || i === 6 || i === 8 || i === 9 ? "text-center" : i === 7 ? "text-center" : "text-left"}`}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredRows.map((r, i) => {
                                const dni = getDni(r);
                                const nombre = fullName(r);
                                const sexo = d(r, "sexo", d(r, "sex", ""));
                                const programa = d(r, "programa_estudios",
                                    r.career_name || d(r, "career_name", careerName(r.career_id))
                                );
                                const modalidad = d(r, "modalidad_admision", "");
                                const asist = d(r, "asistencia_al_proceso_de_evaluacion", "");
                                const beca = d(r, "con_beca", "");
                                const discap = d(r, "discapacidad", "");
                                const isFem = sexo.toUpperCase().startsWith("F");
                                const isMasc = sexo.toUpperCase().startsWith("M") && !sexo.toUpperCase().startsWith("MA");

                                return (
                                    <tr key={r.id} className="group hover:bg-blue-50/20 transition-colors cursor-pointer"
                                        onClick={() => { setViewRow(r); setOpenView(true); }}>
                                        <td className="px-3 py-2.5 text-center text-slate-400 font-medium tabular-nums">{i + 1}</td>
                                        <td className="px-3 py-2.5 font-mono font-bold text-slate-800">{dni}</td>
                                        <td className="px-3 py-2.5">
                                            <p className="font-semibold text-slate-900 max-w-[240px] truncate">{nombre}</p>
                                        </td>
                                        <td className="px-3 py-2.5 text-center">
                                            {(isFem || isMasc) ? (
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isMasc ? "bg-blue-100 text-blue-700" : "bg-pink-100 text-pink-700"}`}>
                                                    {isMasc ? "M" : "F"}
                                                </span>
                                            ) : <span className="text-slate-300">—</span>}
                                        </td>
                                        <td className="px-3 py-2.5 text-slate-600 max-w-[180px] truncate">
                                            {programa !== "—" ? programa : <span className="text-slate-300">—</span>}
                                        </td>
                                        <td className="px-3 py-2.5 text-slate-500 max-w-[160px] truncate text-[11px]">
                                            {modalidad !== "—" ? modalidad : <span className="text-slate-300">—</span>}
                                        </td>
                                        <td className="px-3 py-2.5 text-center">
                                            {asist && asist !== "—" ? (
                                                <span className={`inline-block w-5 h-5 rounded-full text-[10px] font-bold leading-5 text-center ${asist.toUpperCase() === "NO" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                                                    {asist.toUpperCase() === "NO" ? "N" : "S"}
                                                </span>
                                            ) : <span className="text-slate-300">—</span>}
                                        </td>
                                        <td className="px-3 py-2.5 text-center">
                                            <AppStatusBadge status={r.status || "CREATED"} />
                                        </td>
                                        <td className="px-3 py-2.5 text-center">
                                            {beca && beca !== "—" && beca.toUpperCase() === "SÍ" ? (
                                                <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">SÍ</span>
                                            ) : <span className="text-slate-300">—</span>}
                                        </td>
                                        <td className="px-3 py-2.5 text-center">
                                            {discap && discap !== "—" && discap.toUpperCase() !== "NO" && discap.toUpperCase() !== "—" ? (
                                                <span className="text-[10px] font-semibold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">SÍ</span>
                                            ) : <span className="text-slate-300">—</span>}
                                        </td>
                                        <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                                            <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                                onClick={() => { setViewRow(r); setOpenView(true); }}>
                                                <Eye size={13} />
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredRows.length === 0 && (
                                <tr><td colSpan={11} className="py-14 text-center">
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="h-12 w-12 rounded-2xl bg-slate-100 grid place-items-center">
                                            <Users size={22} className="text-slate-300" />
                                        </div>
                                        <p className="text-sm text-slate-400 font-medium">
                                            {rows.length === 0 ? "Sin postulantes registrados" : "No se encontraron resultados"}
                                        </p>
                                    </div>
                                </td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {filteredRows.length > 0 && (
                    <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/40 flex items-center justify-between">
                        <p className="text-xs text-slate-500 font-semibold">{filteredRows.length} postulante{filteredRows.length !== 1 ? "s" : ""}</p>
                        <p className="text-[11px] text-slate-400">Haz clic en una fila para ver la ficha MINEDU completa</p>
                    </div>
                )}
            </div>

            {/* ── Applicant detail dialog ── */}
            <Dialog open={openView} onOpenChange={setOpenView}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl p-0 border-0 shadow-2xl">
                    <div className="bg-gradient-to-r from-[#0f1a3a] via-[#171a55] to-[#251c6c] px-6 py-5 text-white sticky top-0 z-10">
                        <div className="flex items-center gap-3">
                            <div className="h-11 w-11 rounded-xl bg-white/10 border border-white/20 grid place-items-center shrink-0">
                                <User size={20} />
                            </div>
                            <div className="min-w-0">
                                <p className="font-extrabold text-white leading-tight truncate">
                                    {viewRow ? fullName(viewRow) : ""}
                                </p>
                                <p className="text-blue-300 text-xs mt-0.5">
                                    DNI: {viewRow ? getDni(viewRow) : ""} · {viewRow ? (
                                        d(viewRow, "programa_estudios",
                                            viewRow?.career_name || d(viewRow, "career_name", "")
                                        )
                                    ) : ""}
                                </p>
                            </div>
                        </div>
                    </div>

                    {viewRow && (
                        <div className="p-6 space-y-6 bg-white">
                            {/* Identidad */}
                            {sectionBlock([
                                <FieldDisplay key="tdoc" label="Tipo Documento" value={d(viewRow, "tipo_documento_identidad", d(viewRow, "document_type", d(viewRow, "doc_type")))} />,
                                <FieldDisplay key="ndoc" label="N° Documento" value={getDni(viewRow)} mono />,
                                <FieldDisplay key="nac" label="Nacionalidad" value={d(viewRow, "nacionalidad", d(viewRow, "nationality"))} />,
                                <FieldDisplay key="sex" label="Sexo" value={d(viewRow, "sexo", d(viewRow, "sex"))} />,
                                <FieldDisplay key="nom" label="Nombres" value={d(viewRow, "nombres", d(viewRow, "first_names", d(viewRow, "names")))} />,
                                <FieldDisplay key="apat" label="Ap. Paterno" value={d(viewRow, "apellido_paterno", d(viewRow, "last_name_father"))} />,
                                <FieldDisplay key="amat" label="Ap. Materno" value={d(viewRow, "apellido_materno", d(viewRow, "last_name_mother"))} />,
                                <FieldDisplay key="fnac" label="F. Nacimiento" value={d(viewRow, "fecha_nacimiento", d(viewRow, "birth_date"))} />,
                                <FieldDisplay key="ubig" label="Ubigeo / Depto. Nacimiento" value={d(viewRow, "ubigeo_nacimiento", d(viewRow, "birth_department"))} />,
                                <FieldDisplay key="leng" label="Lengua Materna" value={d(viewRow, "lengua_materna", d(viewRow, "mother_tongue"))} />,
                                <FieldDisplay key="etni" label="Autoidentif. Étnica" value={d(viewRow, "autoidentificacion_etnica", d(viewRow, "ethnic_identity"))} />,
                                <FieldDisplay key="eciv" label="Estado Civil" value={d(viewRow, "estado_civil")} />,
                            ], "blue", "Datos de Identidad", User)}

                            {/* Domicilio */}
                            {sectionBlock([
                                <FieldDisplay key="ubdom" label="Ubigeo / Depto. Domicilio" value={d(viewRow, "ubigeo_domicilio", d(viewRow, "address_department"))} />,
                                <FieldDisplay key="dir" label="Dirección" value={d(viewRow, "direccion_domicilio", d(viewRow, "direccion", d(viewRow, "address")))} wide />,
                                <FieldDisplay key="email" label="Email" value={d(viewRow, "email")} />,
                                <FieldDisplay key="phone" label="Teléfono" value={d(viewRow, "phone", d(viewRow, "mobile"))} />,
                            ], "emerald", "Domicilio", BookOpen)}

                            {/* Estudios previos */}
                            {sectionBlock([
                                <FieldDisplay key="anioe" label="Año Finalizó Secundaria" value={d(viewRow, "anio_finalizo_estudios_secundarios", d(viewRow, "anio_egreso", d(viewRow, "promotion_year")))} />,
                                <FieldDisplay key="codmod" label="Colegio / Institución" value={d(viewRow, "colegio_procedencia", d(viewRow, "school_name"))} wide />,
                                <FieldDisplay key="tipocol" label="Tipo Colegio" value={d(viewRow, "school_type")} />,
                                <FieldDisplay key="deptocol" label="Depto. Colegio" value={d(viewRow, "school_department")} />,
                            ], "orange", "Estudios Secundarios / Previos", Award)}

                            {/* Discapacidad */}
                            {sectionBlock([
                                <FieldDisplay key="disc" label="Discapacidad" value={d(viewRow, "discapacidad")} />,
                                <FieldDisplay key="tdis" label="Tipo Discapacidad" value={d(viewRow, "tipo_discapacidad")} wide />,
                                <FieldDisplay key="cona" label="N° CONADIS" value={d(viewRow, "numero_conadis")} mono />,
                            ], "purple", "Discapacidad", Users)}

                            {/* Admisión */}
                            {sectionBlock([
                                <FieldDisplay key="prog" label="Programa de Estudios" value={
                                    d(viewRow, "programa_estudios",
                                        viewRow?.career_name || d(viewRow, "career_name", careerName(viewRow.career_id))
                                    )
                                } wide />,
                                <FieldDisplay key="madm" label="Modalidad Admisión" value={d(viewRow, "modalidad_admision")} wide />,
                                <FieldDisplay key="asev" label="Asistencia Evaluación" value={d(viewRow, "asistencia_al_proceso_de_evaluacion")} />,
                                <FieldDisplay key="conv" label="Convocatoria" value={callName(viewRow.call_id ?? viewRow.call)} />,
                                <FieldDisplay key="est" label="Estado Postulación" value={viewRow.status || "CREATED"} />,
                                <FieldDisplay key="fec" label="Fecha Registro" value={
                                    viewRow.created_at
                                        ? new Date(viewRow.created_at).toLocaleString("es-PE")
                                        : "—"
                                } />,
                            ], "indigo", "Datos de Admisión", GraduationCap)}

                            {/* Evaluación (si hay datos) */}
                            {(viewRow.rubric || viewRow.data?.rubric || viewRow.total != null || viewRow.data?.final_score != null) && (
                                <div>
                                    <SectionHead label="Evaluación" color="emerald" icon={CheckCircle2} />
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 bg-emerald-50/60 p-4 rounded-xl border border-emerald-100">
                                        <FieldDisplay label="Total" value={
                                            viewRow.total != null
                                                ? Number(viewRow.total).toFixed(1)
                                                : viewRow.data?.final_score != null
                                                    ? Number(viewRow.data.final_score).toFixed(1)
                                                    : "—"
                                        } />
                                        <FieldDisplay label="Condición" value={d(viewRow, "condicion")} />
                                        <FieldDisplay label="Admitido" value={viewRow.admitted ? "Sí" : "No"} />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* ── Create dialog ── */}
            <Dialog open={openCreate} onOpenChange={setOpenCreate}>
                <DialogContent className="max-w-lg rounded-2xl p-0 shadow-2xl border-0">
                    <div className="px-6 py-5 border-b border-slate-100">
                        <DialogHeader>
                            <DialogTitle className="font-extrabold text-slate-900 text-xl">Nueva Postulación</DialogTitle>
                            <DialogDescription className="text-slate-500">Seleccione la convocatoria y el programa de estudios.</DialogDescription>
                        </DialogHeader>
                    </div>
                    <form onSubmit={submitCreate} className="p-6 space-y-5">
                        <FormField label="Convocatoria" required>
                            <Select value={createForm.call_id} onValueChange={v => setCreateForm(f => ({ ...f, call_id: v }))}>
                                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Seleccione…" /></SelectTrigger>
                                <SelectContent>
                                    {calls.map(c => (
                                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </FormField>
                        <FormField label="Programa de Estudios" required>
                            <Select value={createForm.career_id} onValueChange={v => setCreateForm(f => ({ ...f, career_id: v }))}>
                                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Seleccione…" /></SelectTrigger>
                                <SelectContent>
                                    {careers.map(c => (
                                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </FormField>
                        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                            <Button type="button" variant="outline" className="rounded-xl font-semibold"
                                onClick={() => setOpenCreate(false)}>Cancelar</Button>
                            <Button type="submit" className="rounded-xl font-extrabold gap-2 bg-blue-600 hover:bg-blue-700">
                                <Plus size={15} /> Crear Postulación
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}