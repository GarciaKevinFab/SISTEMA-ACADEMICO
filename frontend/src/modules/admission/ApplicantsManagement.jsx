// src/modules/admission/ApplicantsManagement.jsx
//
// Gestión de Postulantes — Ficha MINEDU
// FIX: extrae datos correctamente de data.profile / data.school / applicant_detail
//
import React, { useEffect, useState, useMemo } from "react";
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
    ChevronLeft, ChevronRight, Mail, Phone, Hash,
    UserCheck, Clock, XCircle, ClipboardList,
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

/* ─── Status config with Spanish labels ──────────────────── */
const STATUS_CONFIG = {
    ADMITTED:   { label: "Admitido",   cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: UserCheck },
    ADMITIDO:   { label: "Admitido",   cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: UserCheck },
    EVALUATED:  { label: "Evaluado",   cls: "bg-blue-50 text-blue-700 border-blue-200",         icon: CheckCircle2 },
    EVALUADO:   { label: "Evaluado",   cls: "bg-blue-50 text-blue-700 border-blue-200",         icon: CheckCircle2 },
    REJECTED:   { label: "Rechazado",  cls: "bg-red-50 text-red-700 border-red-200",            icon: XCircle },
    RECHAZADO:  { label: "Rechazado",  cls: "bg-red-50 text-red-700 border-red-200",            icon: XCircle },
    PAID:       { label: "Pagado",     cls: "bg-teal-50 text-teal-700 border-teal-200",         icon: CheckCircle2 },
    PAGADO:     { label: "Pagado",     cls: "bg-teal-50 text-teal-700 border-teal-200",         icon: CheckCircle2 },
    REGISTERED: { label: "Registrado", cls: "bg-amber-50 text-amber-700 border-amber-200",      icon: Clock },
    CREATED:    { label: "Creado",     cls: "bg-slate-100 text-slate-600 border-slate-200",      icon: ClipboardList },
};

const AppStatusBadge = ({ status }) => {
    const st = (status || "CREATED").toUpperCase();
    const cfg = STATUS_CONFIG[st] || STATUS_CONFIG.CREATED;
    const Icon = cfg.icon;
    return (
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.cls}`}>
            {Icon && <Icon size={10} />}
            {cfg.label}
        </span>
    );
};

/* ── Stat card ─────────────────────────────────────────── */
const StatCard = ({ label, value, icon: Icon, color = "slate" }) => {
    const colors = {
        blue:    "bg-blue-50 border-blue-100 text-blue-600",
        amber:   "bg-amber-50 border-amber-100 text-amber-600",
        emerald: "bg-emerald-50 border-emerald-100 text-emerald-600",
        red:     "bg-red-50 border-red-100 text-red-600",
        teal:    "bg-teal-50 border-teal-100 text-teal-600",
        slate:   "bg-slate-50 border-slate-100 text-slate-500",
    };
    return (
        <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
            <div className={`h-9 w-9 rounded-lg border grid place-items-center shrink-0 ${colors[color]}`}>
                <Icon size={16} />
            </div>
            <div className="min-w-0">
                <p className="text-lg font-extrabold text-slate-900 leading-none tabular-nums">{value}</p>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">{label}</p>
            </div>
        </div>
    );
};

/* ══════════════════════════════════════════════════════════════
   FIX PRINCIPAL: Funciones de extracción de datos
═══════════════════════════════════════════════════════════════ */

const d = (row, key, fallback = "—") => {
    if (!row) return fallback;

    const data = (typeof row.data === "object" && row.data !== null) ? row.data : {};
    const profile = data.profile || {};
    const school = data.school || {};

    const applicant = (typeof row.applicant === "object" && row.applicant !== null)
        ? row.applicant : {};
    const applicantDetail = (typeof row.applicant_detail === "object" && row.applicant_detail !== null)
        ? row.applicant_detail : {};

    if (profile[key] != null && profile[key] !== "") return String(profile[key]);
    if (school[key] != null && school[key] !== "") return String(school[key]);
    if (data[key] != null && data[key] !== "" && typeof data[key] !== "object") return String(data[key]);
    if (applicantDetail[key] != null && applicantDetail[key] !== "") return String(applicantDetail[key]);
    if (applicant[key] != null && applicant[key] !== "") return String(applicant[key]);
    if (row[key] != null && row[key] !== "" && typeof row[key] !== "object") return String(row[key]);

    return fallback;
};

const fullName = (row) => {
    if (!row) return "—";
    let nombres = d(row, "nombres", "");
    let apPat = d(row, "apellido_paterno", "");
    let apMat = d(row, "apellido_materno", "");

    if (!nombres) nombres = d(row, "first_names", d(row, "names", ""));
    if (!apPat) apPat = d(row, "last_name_father", "");
    if (!apMat) apMat = d(row, "last_name_mother", "");

    if (apPat || apMat || nombres) {
        const parts = [apPat, apMat].filter(Boolean).join(" ");
        if (parts && nombres) return `${parts}, ${nombres}`;
        return parts || nombres || "—";
    }

    const applicant = (typeof row.applicant === "object" && row.applicant !== null)
        ? row.applicant : {};
    const applicantDetail = (typeof row.applicant_detail === "object" && row.applicant_detail !== null)
        ? row.applicant_detail : {};

    return applicantDetail.names || applicant.names ||
        row.applicant_name || row.applicant?.names || "—";
};

const getDni = (row) => {
    if (!row) return "—";
    const fromProfile = d(row, "document_number", "");
    if (fromProfile && fromProfile !== "—") return fromProfile;
    const fromDni = d(row, "dni", "");
    if (fromDni && fromDni !== "—") return fromDni;
    const fromNumDoc = d(row, "numero_documento_identidad", "");
    if (fromNumDoc && fromNumDoc !== "—") return fromNumDoc;
    if (row.applicant_dni) return String(row.applicant_dni);
    const applicant = (typeof row.applicant === "object" && row.applicant !== null) ? row.applicant : {};
    const applicantDetail = (typeof row.applicant_detail === "object" && row.applicant_detail !== null) ? row.applicant_detail : {};
    return applicantDetail.dni || applicant.dni || "—";
};

/* ── Pagination config ─────────────────────────────────── */
const PAGE_SIZE = 25;

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
    const [searchText, setSearchText] = useState("");
    const [openCreate, setOpenCreate] = useState(false);
    const [createForm, setCreateForm] = useState({ call_id: "", career_id: "" });
    const [openView, setOpenView] = useState(false);
    const [viewRow, setViewRow] = useState(null);
    const [openEdit, setOpenEdit] = useState(false);
    const [editRow, setEditRow] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [editSaving, setEditSaving] = useState(false);
    const [openDelete, setOpenDelete] = useState(false);
    const [deleteRow, setDeleteRow] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [page, setPage] = useState(1);

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

    const openEditDialog = (row) => {
        setEditRow(row);
        setEditForm({
            nombres: d(row, "nombres", d(row, "first_names", d(row, "names", ""))),
            apellido_paterno: d(row, "apellido_paterno", d(row, "last_name_father", "")),
            apellido_materno: d(row, "apellido_materno", d(row, "last_name_mother", "")),
            dni: getDni(row) === "—" ? "" : getDni(row),
            sexo: d(row, "sexo", d(row, "sex", "")),
            email: d(row, "email", ""),
            phone: d(row, "phone", d(row, "mobile", "")),
            fecha_nacimiento: d(row, "fecha_nacimiento", d(row, "birth_date", "")),
            direccion: d(row, "direccion_domicilio", d(row, "direccion", d(row, "address", ""))),
            colegio_procedencia: d(row, "colegio_procedencia", d(row, "school_name", "")),
            anio_egreso: d(row, "anio_finalizo_estudios_secundarios", d(row, "anio_egreso", d(row, "promotion_year", ""))),
            modalidad_admision: d(row, "modalidad_admision", ""),
            status: row.status || "CREATED",
        });
        setOpenEdit(true);
    };

    const submitEdit = async (e) => {
        e.preventDefault();
        if (!editRow) return;
        setEditSaving(true);
        try {
            const cleaned = {};
            Object.entries(editForm).forEach(([k, v]) => {
                cleaned[k] = v === "—" ? "" : v;
            });
            await api.patch(`/applications/${editRow.id}`, cleaned);
            toast.success("Postulación actualizada");
            setOpenEdit(false);
            setEditRow(null);
            setLoading(true);
            fetchAll();
        } catch (e) {
            toast.error(formatApiError(e, "No se pudo actualizar"));
        } finally {
            setEditSaving(false);
        }
    };

    const confirmDelete = async () => {
        if (!deleteRow) return;
        setDeleting(true);
        try {
            await api.delete(`/applications/${deleteRow.id}`);
            toast.success("Postulación eliminada");
            setOpenDelete(false);
            setDeleteRow(null);
            setLoading(true);
            fetchAll();
        } catch (e) {
            toast.error(formatApiError(e, "No se pudo eliminar"));
        } finally {
            setDeleting(false);
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

            const blob = new Blob([resp.data], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            });

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

    // ── Filtrado por texto (DNI o nombre) ──
    const filteredRows = useMemo(() => {
        if (!searchText) return rows;
        const q = searchText.toLowerCase().trim();
        return rows.filter(r => {
            const dni = getDni(r).toLowerCase();
            const name = fullName(r).toLowerCase();
            const email = d(r, "email", "").toLowerCase();
            return dni.includes(q) || name.includes(q) || email.includes(q);
        });
    }, [rows, searchText]);

    // ── Paginación ──
    const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
    const paginatedRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    // Reset page cuando cambia filtro
    useEffect(() => { setPage(1); }, [searchText, callFilter, careerFilter]);

    // ── Stats ──
    const stats = useMemo(() => {
        const byStatus = {};
        rows.forEach(r => {
            const st = (r.status || "CREATED").toUpperCase();
            byStatus[st] = (byStatus[st] || 0) + 1;
        });
        return {
            total: rows.length,
            registered: (byStatus.REGISTERED || 0),
            admitted: (byStatus.ADMITTED || 0) + (byStatus.ADMITIDO || 0),
            evaluated: (byStatus.EVALUATED || 0) + (byStatus.EVALUADO || 0),
            rejected: (byStatus.REJECTED || 0) + (byStatus.RECHAZADO || 0),
        };
    }, [rows]);

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
        <div className="max-w-full mx-auto space-y-4 pb-24 sm:pb-6">

            {/* ── Stats cards ── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <StatCard label="Total Postulantes" value={stats.total} icon={Users} color="blue" />
                <StatCard label="Registrados"       value={stats.registered} icon={Clock} color="amber" />
                <StatCard label="Evaluados"          value={stats.evaluated} icon={CheckCircle2} color="teal" />
                <StatCard label="Admitidos"          value={stats.admitted} icon={UserCheck} color="emerald" />
                <StatCard label="Rechazados"         value={stats.rejected} icon={XCircle} color="red" />
            </div>

            {/* ── Filters + actions bar ── */}
            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm p-4">
                <div className="flex flex-col lg:flex-row lg:items-end gap-3">
                    {/* Filtros */}
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <Select value={callFilter || "__all__"} onValueChange={v => setCallFilter(v === "__all__" ? "" : v)}>
                            <SelectTrigger className="h-9 rounded-lg text-xs">
                                <div className="flex items-center gap-2 min-w-0">
                                    <Calendar size={13} className="text-slate-400 shrink-0" />
                                    <SelectValue placeholder="Convocatoria" />
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__all__">Todas las convocatorias</SelectItem>
                                {calls.filter(c => c?.id != null).map(c => (
                                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={careerFilter || "__all__"} onValueChange={v => setCareerFilter(v === "__all__" ? "" : v)}>
                            <SelectTrigger className="h-9 rounded-lg text-xs">
                                <div className="flex items-center gap-2 min-w-0">
                                    <GraduationCap size={13} className="text-slate-400 shrink-0" />
                                    <SelectValue placeholder="Programa" />
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__all__">Todos los programas</SelectItem>
                                {careers.filter(c => c?.id != null).map(c => (
                                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <div className="relative">
                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <Input placeholder="Buscar por DNI, nombre o email…" className="h-9 pl-8 rounded-lg text-xs"
                                value={searchText} onChange={e => setSearchText(e.target.value)} />
                            {searchText && (
                                <button onClick={() => setSearchText("")}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                                    <X size={13} />
                                </button>
                            )}
                        </div>
                    </div>
                    {/* Actions */}
                    <div className="flex gap-2 shrink-0">
                        {(callFilter || careerFilter) && (
                            <Button variant="ghost" size="sm" className="rounded-lg text-xs text-slate-500 h-9 px-3"
                                onClick={() => { setCallFilter(""); setCareerFilter(""); setSearchText(""); }}>
                                <X size={13} className="mr-1" /> Limpiar
                            </Button>
                        )}
                        <Button variant="outline" size="sm" className="rounded-lg text-xs font-semibold h-9 gap-1.5" onClick={exportXlsx}>
                            <FileSpreadsheet size={13} /> Excel
                        </Button>
                        <Button size="sm" className="rounded-lg text-xs font-extrabold h-9 gap-1.5 bg-blue-600 hover:bg-blue-700"
                            onClick={() => setOpenCreate(true)}>
                            <Plus size={13} /> Nuevo
                        </Button>
                    </div>
                </div>
            </div>

            {/* ── Table ── */}
            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-100">
                                <th className="px-3 py-3 font-bold text-[10px] uppercase tracking-widest text-slate-400 text-center w-10">
                                    <Hash size={11} />
                                </th>
                                <th className="px-3 py-3 font-bold text-[10px] uppercase tracking-widest text-slate-400 text-left">DNI</th>
                                <th className="px-3 py-3 font-bold text-[10px] uppercase tracking-widest text-slate-400 text-left">Postulante</th>
                                <th className="px-3 py-3 font-bold text-[10px] uppercase tracking-widest text-slate-400 text-left">Programa</th>
                                <th className="px-3 py-3 font-bold text-[10px] uppercase tracking-widest text-slate-400 text-center">Sexo</th>
                                <th className="px-3 py-3 font-bold text-[10px] uppercase tracking-widest text-slate-400 text-center">Estado</th>
                                <th className="px-3 py-3 font-bold text-[10px] uppercase tracking-widest text-slate-400 text-left">Contacto</th>
                                <th className="px-3 py-3 font-bold text-[10px] uppercase tracking-widest text-slate-400 text-right w-28">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedRows.map((r, i) => {
                                const dni = getDni(r);
                                const nombre = fullName(r);
                                const sexo = d(r, "sexo", d(r, "sex", ""));
                                const programa = d(r, "programa_estudios",
                                    r.career_name || d(r, "career_name", careerName(r.career_id))
                                );
                                const email = d(r, "email", "");
                                const phone = d(r, "phone", d(r, "mobile", ""));
                                const su = sexo.toUpperCase();
                                const isFem = su === "F" || su === "FEMENINO" || su.startsWith("FEM");
                                const isMasc = su === "M" || su === "MASCULINO" || su.startsWith("MASC");
                                const globalIdx = (page - 1) * PAGE_SIZE + i + 1;

                                return (
                                    <tr key={r.id}
                                        className="group border-b border-slate-50 hover:bg-blue-50/30 transition-colors cursor-pointer"
                                        onClick={() => { setViewRow(r); setOpenView(true); }}>
                                        <td className="px-3 py-2.5 text-center text-slate-300 font-medium tabular-nums text-[11px]">
                                            {globalIdx}
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <span className="font-mono font-bold text-slate-800 text-[11px]">{dni}</span>
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <p className="font-semibold text-slate-900 max-w-[260px] truncate leading-tight">{nombre}</p>
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <p className="text-slate-600 max-w-[200px] truncate text-[11px]">
                                                {programa !== "—" ? programa : <span className="text-slate-300">—</span>}
                                            </p>
                                        </td>
                                        <td className="px-3 py-2.5 text-center">
                                            {(isFem || isMasc) ? (
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isMasc ? "bg-blue-100 text-blue-700" : "bg-pink-100 text-pink-700"}`}>
                                                    {isMasc ? "M" : "F"}
                                                </span>
                                            ) : <span className="text-slate-300">—</span>}
                                        </td>
                                        <td className="px-3 py-2.5 text-center">
                                            <AppStatusBadge status={r.status || "CREATED"} />
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <div className="flex flex-col gap-0.5 max-w-[180px]">
                                                {email && email !== "—" && (
                                                    <span className="text-[10px] text-slate-500 truncate flex items-center gap-1">
                                                        <Mail size={9} className="text-slate-300 shrink-0" />{email}
                                                    </span>
                                                )}
                                                {phone && phone !== "—" && (
                                                    <span className="text-[10px] text-slate-500 truncate flex items-center gap-1">
                                                        <Phone size={9} className="text-slate-300 shrink-0" />{phone}
                                                    </span>
                                                )}
                                                {(!email || email === "—") && (!phone || phone === "—") && (
                                                    <span className="text-slate-300 text-[10px]">—</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                                            <div className="flex items-center justify-end gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                                <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                                    title="Ver ficha"
                                                    onClick={() => { setViewRow(r); setOpenView(true); }}>
                                                    <Eye size={14} />
                                                </Button>
                                                <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                                                    title="Editar"
                                                    onClick={() => openEditDialog(r)}>
                                                    <Edit size={14} />
                                                </Button>
                                                <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                                                    title="Eliminar"
                                                    onClick={() => { setDeleteRow(r); setOpenDelete(true); }}>
                                                    <Trash2 size={14} />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredRows.length === 0 && (
                                <tr><td colSpan={8} className="py-16 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="h-14 w-14 rounded-2xl bg-slate-100 grid place-items-center">
                                            <Users size={24} className="text-slate-300" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-slate-500">
                                                {rows.length === 0 ? "Sin postulantes registrados" : "No se encontraron resultados"}
                                            </p>
                                            {searchText && (
                                                <p className="text-xs text-slate-400 mt-1">
                                                    Intenta con otro término de búsqueda
                                                </p>
                                            )}
                                        </div>
                                        {searchText && (
                                            <Button variant="outline" size="sm" className="rounded-lg text-xs mt-1"
                                                onClick={() => setSearchText("")}>
                                                <X size={12} className="mr-1" /> Limpiar búsqueda
                                            </Button>
                                        )}
                                    </div>
                                </td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* ── Footer: pagination + count ── */}
                {filteredRows.length > 0 && (
                    <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/40 flex items-center justify-between">
                        <p className="text-[11px] text-slate-500 font-medium">
                            Mostrando <span className="font-bold">{(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filteredRows.length)}</span> de <span className="font-bold">{filteredRows.length}</span> postulante{filteredRows.length !== 1 ? "s" : ""}
                        </p>
                        {totalPages > 1 && (
                            <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg"
                                    disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                                    <ChevronLeft size={14} />
                                </Button>
                                {Array.from({ length: Math.min(totalPages, 7) }, (_, idx) => {
                                    let p;
                                    if (totalPages <= 7) {
                                        p = idx + 1;
                                    } else if (page <= 4) {
                                        p = idx + 1;
                                    } else if (page >= totalPages - 3) {
                                        p = totalPages - 6 + idx;
                                    } else {
                                        p = page - 3 + idx;
                                    }
                                    return (
                                        <button key={p} onClick={() => setPage(p)}
                                            className={`h-7 min-w-[28px] rounded-lg text-[11px] font-bold transition-colors ${p === page
                                                ? "bg-blue-600 text-white shadow-sm"
                                                : "text-slate-500 hover:bg-slate-100"
                                                }`}>
                                            {p}
                                        </button>
                                    );
                                })}
                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg"
                                    disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                                    <ChevronRight size={14} />
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── Applicant detail dialog ── */}
            <Dialog open={openView} onOpenChange={setOpenView}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl p-0 border-0 shadow-2xl">
                    <div className="bg-gradient-to-r from-[#0f1a3a] via-[#171a55] to-[#251c6c] px-6 py-5 text-white sticky top-0 z-10">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0">
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
                            {viewRow && (
                                <div className="flex items-center gap-2 shrink-0 ml-3">
                                    <Button size="sm" variant="ghost"
                                        className="h-8 rounded-lg text-white/70 hover:text-white hover:bg-white/10 text-[11px] gap-1.5"
                                        onClick={() => { setOpenView(false); openEditDialog(viewRow); }}>
                                        <Edit size={12} /> Editar
                                    </Button>
                                </div>
                            )}
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

            {/* ── Edit dialog ── */}
            <Dialog open={openEdit} onOpenChange={v => { if (!v) { setOpenEdit(false); setEditRow(null); } }}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-0 shadow-2xl border-0">
                    <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-5 text-white sticky top-0 z-10">
                        <div className="flex items-center gap-3">
                            <div className="h-11 w-11 rounded-xl bg-white/10 border border-white/20 grid place-items-center shrink-0">
                                <Edit size={20} />
                            </div>
                            <div className="min-w-0">
                                <p className="font-extrabold text-white leading-tight">Editar Postulación</p>
                                <p className="text-amber-100 text-xs mt-0.5">
                                    {editRow ? `${fullName(editRow)} · DNI: ${getDni(editRow)}` : ""}
                                </p>
                            </div>
                        </div>
                    </div>
                    <form onSubmit={submitEdit} className="p-6 space-y-5">
                        <SectionHead label="Datos de Identidad" color="blue" icon={User} />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField label="DNI / N° Documento">
                                <Input className="h-10 rounded-xl font-mono"
                                    value={editForm.dni || ""} onChange={e => setEditForm(f => ({ ...f, dni: e.target.value }))} />
                            </FormField>
                            <FormField label="Nombres">
                                <Input className="h-10 rounded-xl"
                                    value={editForm.nombres || ""} onChange={e => setEditForm(f => ({ ...f, nombres: e.target.value }))} />
                            </FormField>
                            <FormField label="Apellido Paterno">
                                <Input className="h-10 rounded-xl"
                                    value={editForm.apellido_paterno || ""} onChange={e => setEditForm(f => ({ ...f, apellido_paterno: e.target.value }))} />
                            </FormField>
                            <FormField label="Apellido Materno">
                                <Input className="h-10 rounded-xl"
                                    value={editForm.apellido_materno || ""} onChange={e => setEditForm(f => ({ ...f, apellido_materno: e.target.value }))} />
                            </FormField>
                            <FormField label="Sexo">
                                <Select value={editForm.sexo || ""} onValueChange={v => setEditForm(f => ({ ...f, sexo: v }))}>
                                    <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Seleccione…" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="MASCULINO">Masculino</SelectItem>
                                        <SelectItem value="FEMENINO">Femenino</SelectItem>
                                    </SelectContent>
                                </Select>
                            </FormField>
                            <FormField label="Fecha Nacimiento">
                                <Input className="h-10 rounded-xl" placeholder="DD/MM/YYYY"
                                    value={editForm.fecha_nacimiento || ""} onChange={e => setEditForm(f => ({ ...f, fecha_nacimiento: e.target.value }))} />
                            </FormField>
                        </div>

                        <SectionHead label="Contacto" color="emerald" icon={BookOpen} />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField label="Email">
                                <Input type="email" className="h-10 rounded-xl"
                                    value={editForm.email || ""} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
                            </FormField>
                            <FormField label="Teléfono">
                                <Input className="h-10 rounded-xl"
                                    value={editForm.phone || ""} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
                            </FormField>
                            <FormField label="Dirección">
                                <Input className="h-10 rounded-xl"
                                    value={editForm.direccion || ""} onChange={e => setEditForm(f => ({ ...f, direccion: e.target.value }))} />
                            </FormField>
                        </div>

                        <SectionHead label="Estudios Previos" color="orange" icon={Award} />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField label="Colegio de Procedencia">
                                <Input className="h-10 rounded-xl"
                                    value={editForm.colegio_procedencia || ""} onChange={e => setEditForm(f => ({ ...f, colegio_procedencia: e.target.value }))} />
                            </FormField>
                            <FormField label="Año Egreso">
                                <Input className="h-10 rounded-xl"
                                    value={editForm.anio_egreso || ""} onChange={e => setEditForm(f => ({ ...f, anio_egreso: e.target.value }))} />
                            </FormField>
                        </div>

                        <SectionHead label="Admisión" color="indigo" icon={GraduationCap} />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField label="Modalidad de Admisión">
                                <Input className="h-10 rounded-xl"
                                    value={editForm.modalidad_admision || ""} onChange={e => setEditForm(f => ({ ...f, modalidad_admision: e.target.value }))} />
                            </FormField>
                            <FormField label="Estado">
                                <Select value={editForm.status || "CREATED"} onValueChange={v => setEditForm(f => ({ ...f, status: v }))}>
                                    <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="CREATED">Creado</SelectItem>
                                        <SelectItem value="REGISTERED">Registrado</SelectItem>
                                        <SelectItem value="PAID">Pagado</SelectItem>
                                        <SelectItem value="EVALUATED">Evaluado</SelectItem>
                                        <SelectItem value="ADMITTED">Admitido</SelectItem>
                                        <SelectItem value="REJECTED">Rechazado</SelectItem>
                                    </SelectContent>
                                </Select>
                            </FormField>
                        </div>

                        <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                            <Button type="button" variant="outline" className="rounded-xl font-semibold"
                                onClick={() => { setOpenEdit(false); setEditRow(null); }}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={editSaving}
                                className="rounded-xl font-extrabold gap-2 bg-amber-500 hover:bg-amber-600">
                                {editSaving ? <Loader2 size={15} className="animate-spin" /> : <Edit size={15} />}
                                Guardar Cambios
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ── Delete confirmation dialog ── */}
            <Dialog open={openDelete} onOpenChange={v => { if (!v) { setOpenDelete(false); setDeleteRow(null); } }}>
                <DialogContent className="max-w-md rounded-2xl p-0 shadow-2xl border-0">
                    <div className="px-6 py-5 border-b border-slate-100">
                        <DialogHeader>
                            <DialogTitle className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
                                <div className="h-9 w-9 rounded-xl bg-red-50 border border-red-100 grid place-items-center shrink-0">
                                    <Trash2 size={16} className="text-red-600" />
                                </div>
                                Eliminar Postulación
                            </DialogTitle>
                            <DialogDescription className="text-slate-500 mt-2">
                                Esta acción no se puede deshacer. Se eliminará permanentemente la postulación de:
                            </DialogDescription>
                        </DialogHeader>
                    </div>
                    {deleteRow && (
                        <div className="px-6 py-4">
                            <div className="bg-red-50/60 border border-red-100 rounded-xl p-4 space-y-1">
                                <p className="text-sm font-bold text-slate-900">{fullName(deleteRow)}</p>
                                <p className="text-xs text-slate-500 font-mono">DNI: {getDni(deleteRow)}</p>
                                <p className="text-xs text-slate-500">
                                    {d(deleteRow, "programa_estudios", deleteRow?.career_name || "")}
                                </p>
                            </div>
                        </div>
                    )}
                    <div className="flex justify-end gap-2 px-6 pb-5">
                        <Button variant="outline" className="rounded-xl font-semibold"
                            onClick={() => { setOpenDelete(false); setDeleteRow(null); }}>
                            Cancelar
                        </Button>
                        <Button disabled={deleting}
                            className="rounded-xl font-extrabold gap-2 bg-red-600 hover:bg-red-700"
                            onClick={confirmDelete}>
                            {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                            Eliminar
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
