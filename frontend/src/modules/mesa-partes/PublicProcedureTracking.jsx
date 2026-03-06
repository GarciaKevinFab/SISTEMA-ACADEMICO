// src/modules/mesa-partes/PublicProcedureTracking.jsx
import React, { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { PublicProcedures } from "../../services/mesaPartes.service";
import {
    Search, FileText, User, Loader2, Download, Plus,
    ChevronRight, Menu, AlertCircle, ChevronDown,
    ChevronUp, Paperclip, Inbox, Home,
} from "lucide-react";

/* ─── Tokens ────────────────────────────────────────────────────── */
const B = {
    primary: "#1a3a6b",
    accent: "#c0392b",
    accentHov: "#a93226",
    light: "#eaf0fb",
    border: "#d0dae8",
    headerRow: "#edf2f9",
    altRow: "#f9fbfd",
    text: "#1e293b",
    muted: "#5a7499",
};

/* ─── Status ────────────────────────────────────────────────────── */
const STATUS_CFG = {
    RECEIVED: { label: "REGISTRADO", bg: "#e8f5e9", color: "#2e7d32", dot: "#43a047" },
    IN_REVIEW: { label: "EN REVISIÓN", bg: "#fff8e1", color: "#e65100", dot: "#fb8c00" },
    APPROVED: { label: "APROBADO", bg: "#e8f5e9", color: "#1b5e20", dot: "#2e7d32" },
    REJECTED: { label: "RECHAZADO", bg: "#ffebee", color: "#b71c1c", dot: "#e53935" },
    COMPLETED: { label: "COMPLETADO", bg: "#e3f2fd", color: "#0d47a1", dot: "#1976d2" },
};
const getStatus = (s) =>
    STATUS_CFG[s] ?? { label: s || "—", bg: "#f1f5f9", color: "#475569", dot: "#94a3b8" };

const StatusBadge = ({ status }) => {
    const c = getStatus(status);
    return (
        <span style={{ background: c.bg, color: c.color }}
            className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-sm uppercase tracking-wider whitespace-nowrap">
            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: c.dot }} />
            {c.label}
        </span>
    );
};

/* ─── Panel ─────────────────────────────────────────────────────── */
const Panel = ({ title, accent = B.accent, extra, children }) => (
    <div className="rounded border bg-white shadow-sm overflow-hidden" style={{ borderColor: B.border }}>
        <div className="flex items-center justify-between px-4 py-2.5 border-b"
            style={{ background: B.headerRow, borderColor: B.border }}>
            <div className="flex items-center gap-2">
                <div className="h-4 w-1 rounded-full" style={{ background: accent }} />
                <p className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: B.text }}>
                    {title}
                </p>
            </div>
            {extra}
        </div>
        {children}
    </div>
);

/* ══════════════════════════════════════════════════════════════════
   MAIN
══════════════════════════════════════════════════════════════════ */
export default function PublicProcedureTracking() {
    const { code: codeParam } = useParams();
    const [code, setCode] = useState(codeParam || "");
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [tlOpen, setTlOpen] = useState(true);
    const inputRef = useRef(null);

    const searchByCode = async (incoming) => {
        const q = (incoming ?? code).trim();
        if (!q) { inputRef.current?.focus(); return; }
        setLoading(true); setData(null);
        try {
            const res = await PublicProcedures.track(q);
            const proc = res?.procedure || res || null;
            if (!proc) toast.error("No se encontró el expediente.");
            else setData(proc);
        } catch (e) {
            toast.error(e?.message || "Error al consultar");
        } finally { setLoading(false); }
    };

    const downloadCargo = async () => {
        if (!data?.id) return;
        setDownloading(true);
        try {
            await PublicProcedures.downloadCargo(data.id, data.tracking_code);
            toast.success("Cargo descargado");
        } catch (e) { toast.error(e?.message || "No se pudo generar el cargo"); }
        finally { setDownloading(false); }
    };

    useEffect(() => {
        if (codeParam) { setCode(codeParam); searchByCode(codeParam); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [codeParam]);

    const timeline = data?.timeline || [];
    const files = data?.files || [];

    const fmt = (iso, time = false) => iso
        ? new Date(iso).toLocaleString("es-PE", {
            day: "2-digit", month: "2-digit", year: "numeric",
            ...(time ? { hour: "2-digit", minute: "2-digit" } : {}),
        })
        : "—";

    /* Cell helpers */
    const Td = ({ children, mono, center, red }) => (
        <td className={`px-4 py-2.5 text-[11px] border-b align-middle ${mono ? "font-mono" : "font-semibold"} ${center ? "text-center" : ""}`}
            style={{ borderColor: B.border, color: red ? B.accent : B.text }}>
            {children}
        </td>
    );
    const Th = ({ children, center }) => (
        <th className={`px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-wider whitespace-nowrap ${center ? "text-center" : "text-left"}`}
            style={{ color: B.muted, background: B.headerRow }}>
            {children}
        </th>
    );

    return (
        <div className="flex flex-col h-[100dvh] overflow-hidden"
            style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", fontSize: 13 }}>

            {/* ── TOP HEADER ── */}
            <header className="shrink-0 flex items-center justify-between px-4 sm:px-8 h-14"
                style={{ background: B.primary }}>
                <div className="flex items-center gap-3 min-w-0">
                    <img src="/logo.png" alt="Logo"
                        className="h-9 w-9 object-contain shrink-0"
                        onError={e => { e.target.style.display = "none"; }} />
                    <div className="min-w-0">
                        <p className="text-white font-extrabold text-sm uppercase tracking-wide leading-tight truncate">
                            MESA DE PARTES VIRTUAL
                        </p>
                        <p className="text-white/45 text-[10px] hidden sm:block leading-none">
                            IESPP "GUSTAVO ALLENDE LLAVERÍA" — Tarma, Junín, Perú
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                    <Link to="/public/procedures"
                        className="hidden sm:flex items-center gap-1.5 text-white/60 hover:text-white text-[11px] font-semibold transition-colors">
                        <Home size={13} /> Portal
                    </Link>
                    <div className="flex items-center gap-2">
                        <div className="hidden sm:block text-right">
                            <p className="text-white/80 text-[11px] font-bold leading-tight">Portal Ciudadano</p>
                            <p className="text-white/40 text-[10px] leading-none">Acceso público</p>
                        </div>
                        <div className="h-8 w-8 rounded-full bg-white/15 border border-white/20 grid place-items-center">
                            <User size={14} className="text-white/60" />
                        </div>
                    </div>
                </div>
            </header>

            {/* ── BREADCRUMB ── */}
            <div className="shrink-0 flex items-center gap-1.5 px-5 sm:px-8 py-2 text-[11px] border-b"
                style={{ background: "#f4f7fb", borderColor: B.border }}>
                <Link to="/public/procedures" className="hover:underline" style={{ color: B.muted }}>Inicio</Link>
                <ChevronRight size={11} style={{ color: B.muted }} />
                <span className="font-semibold" style={{ color: B.text }}>Búsqueda de Expedientes</span>
            </div>

            {/* ── CONTENT ── */}
            <div className="flex-1 overflow-y-auto" style={{ background: "#f4f7fb" }}>
                <div className="max-w-5xl mx-auto px-4 sm:px-8 py-5 space-y-4">

                    {/* Page title */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="h-6 w-1 rounded-full" style={{ background: B.accent }} />
                            <h1 className="text-[13px] font-extrabold uppercase tracking-wide" style={{ color: B.text }}>
                                Búsqueda de Documentos
                            </h1>
                        </div>
                        {data && <StatusBadge status={data.status} />}
                    </div>

                    {/* ── SEARCH PANEL ── */}
                    <Panel title="Criterio de Búsqueda" accent={B.accent}>
                        <div className="p-4 flex flex-col sm:flex-row gap-3 items-end">
                            <div className="flex-1">
                                <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5"
                                    style={{ color: B.muted }}>
                                    Código / N° de Expediente
                                </label>
                                <input
                                    ref={inputRef}
                                    value={code}
                                    onChange={e => setCode(e.target.value)}
                                    onKeyDown={e => e.key === "Enter" && searchByCode()}
                                    placeholder="Ej: MP-2026-A1B2C3"
                                    className="w-full h-9 px-3 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-200 font-mono"
                                    style={{ borderColor: B.border }}
                                />
                            </div>
                            <div className="flex gap-2 shrink-0 flex-wrap">
                                <button
                                    onClick={() => searchByCode()} disabled={loading || !code.trim()}
                                    className="flex items-center gap-1.5 h-9 px-4 text-[11px] font-extrabold text-white rounded uppercase tracking-wide transition-colors disabled:opacity-50"
                                    style={{ background: B.accent }}
                                    onMouseEnter={e => !loading && (e.currentTarget.style.background = B.accentHov)}
                                    onMouseLeave={e => !loading && (e.currentTarget.style.background = B.accent)}>
                                    {loading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                                    Buscar
                                </button>
                                {data && (
                                    <button onClick={downloadCargo} disabled={downloading}
                                        className="flex items-center gap-1.5 h-9 px-4 text-[11px] font-extrabold rounded uppercase tracking-wide border transition-colors disabled:opacity-50"
                                        style={{ borderColor: B.border, color: B.text, background: "#fff" }}
                                        onMouseEnter={e => e.currentTarget.style.background = B.light}
                                        onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                                        {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                                        PDF
                                    </button>
                                )}
                                <Link to="/public/procedures/new">
                                    <button
                                        className="flex items-center gap-1.5 h-9 px-4 text-[11px] font-extrabold rounded uppercase tracking-wide border transition-colors"
                                        style={{ borderColor: B.primary, color: B.primary, background: "#fff" }}
                                        onMouseEnter={e => e.currentTarget.style.background = B.light}
                                        onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                                        <Plus size={13} /> Nuevo Documento
                                    </button>
                                </Link>
                            </div>
                        </div>
                    </Panel>

                    {/* LOADING */}
                    {loading && (
                        <div className="rounded border bg-white p-10 flex flex-col items-center gap-3 shadow-sm"
                            style={{ borderColor: B.border }}>
                            <Loader2 size={28} className="animate-spin" style={{ color: B.accent }} />
                            <p className="text-sm font-semibold" style={{ color: B.muted }}>Buscando expediente…</p>
                        </div>
                    )}

                    {/* NO RESULT */}
                    {!loading && !data && code && (
                        <div className="rounded border bg-white p-10 flex flex-col items-center gap-3 text-center shadow-sm"
                            style={{ borderColor: B.border }}>
                            <div className="h-12 w-12 rounded-full grid place-items-center" style={{ background: "#fff3f3" }}>
                                <AlertCircle size={22} style={{ color: B.accent }} />
                            </div>
                            <p className="text-sm font-bold" style={{ color: B.text }}>Sin resultados</p>
                            <p className="text-xs" style={{ color: B.muted }}>
                                Verifique el código de expediente e intente nuevamente.
                            </p>
                        </div>
                    )}

                    {/* WELCOME */}
                    {!loading && !data && !code && (
                        <div className="rounded border bg-white p-10 flex flex-col items-center gap-4 text-center shadow-sm"
                            style={{ borderColor: B.border }}>
                            <div className="h-16 w-16 rounded-2xl grid place-items-center" style={{ background: B.light }}>
                                <FileText size={28} style={{ color: B.primary }} />
                            </div>
                            <div>
                                <p className="font-extrabold text-[13px] mb-1 uppercase tracking-wide" style={{ color: B.text }}>
                                    Consulte el Estado de su Trámite
                                </p>
                                <p className="text-xs leading-relaxed" style={{ color: B.muted }}>
                                    Ingrese el código de expediente recibido al registrar su trámite<br />
                                    para consultar su estado actual y trazabilidad.
                                </p>
                            </div>
                            <button onClick={() => inputRef.current?.focus()}
                                className="flex items-center gap-2 h-9 px-5 text-[11px] font-bold text-white rounded uppercase tracking-wide"
                                style={{ background: B.accent }}>
                                <Search size={13} /> Iniciar Búsqueda
                            </button>
                        </div>
                    )}

                    {/* ══ RESULTS ══ */}
                    {!loading && data && (
                        <>
                            <p className="text-[11px]" style={{ color: B.muted }}><b>1</b> resultado encontrado</p>

                            {/* Summary table */}
                            <div className="rounded border bg-white shadow-sm overflow-hidden" style={{ borderColor: B.border }}>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr style={{ borderBottom: `1px solid ${B.border}` }}>
                                                <Th>N° Expediente</Th>
                                                <Th>Tipo de Documento</Th>
                                                <Th>Asunto</Th>
                                                <Th>Fecha Registro</Th>
                                                <Th center>Estado</Th>
                                                <Th center>Archivos</Th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="hover:bg-blue-50/20 transition-colors">
                                                <Td red mono>{data.tracking_code}</Td>
                                                <Td>{data.procedure_type_name || "—"}</Td>
                                                <Td>
                                                    <span className="line-clamp-2 leading-snug">{data.description || "—"}</span>
                                                </Td>
                                                <Td mono>{fmt(data.created_at, true)}</Td>
                                                <td className="px-4 py-2.5 text-center border-b align-middle" style={{ borderColor: B.border }}>
                                                    <StatusBadge status={data.status} />
                                                </td>
                                                <td className="px-4 py-2.5 text-center border-b align-middle" style={{ borderColor: B.border }}>
                                                    {files.length > 0 ? (
                                                        <span className="inline-flex items-center justify-center h-6 w-6 rounded text-white text-[10px] font-bold"
                                                            style={{ background: B.primary }}>{files.length}</span>
                                                    ) : (
                                                        <span className="text-[11px]" style={{ color: B.muted }}>—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Detail panel */}
                            <Panel title="Detalle del Expediente" accent={B.primary}
                                extra={
                                    <button onClick={downloadCargo} disabled={downloading}
                                        className="flex items-center gap-1.5 h-7 px-3 text-[10px] font-extrabold text-white rounded uppercase tracking-wide transition-colors disabled:opacity-50"
                                        style={{ background: B.accent }}
                                        onMouseEnter={e => e.currentTarget.style.background = B.accentHov}
                                        onMouseLeave={e => e.currentTarget.style.background = B.accent}>
                                        {downloading ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                                        Descargar Cargo
                                    </button>
                                }>
                                <div className="grid grid-cols-1 sm:grid-cols-2">
                                    {[
                                        ["N° de Expediente", data.tracking_code, true, true],
                                        ["Tipo de Trámite", data.procedure_type_name || "—", false, false],
                                        ["Solicitante", data.applicant_name || "—", false, false],
                                        ["N° Documento", data.applicant_document || "—", true, false],
                                        ["Correo Electrónico", data.applicant_email || "—", false, false],
                                        ["Celular", data.applicant_phone || "—", true, false],
                                        ["Oficina Receptora", data.current_office_name || "MESA DE PARTES", false, false],
                                        ["Responsable", data.assignee_name || "—", false, false],
                                        ["Fecha Registro", fmt(data.created_at, true), true, false],
                                        ["Últ. Actualización", fmt(data.updated_at, true), true, false],
                                        ["Asunto", data.description || "—", false, false],
                                        ["Estado Actual", null, false, false],
                                    ].map(([label, val, mono, red], i) => (
                                        <div key={label} className="flex border-b"
                                            style={{ borderColor: B.border, background: i % 2 === 0 ? "#fff" : B.altRow }}>
                                            <div className="w-40 shrink-0 px-4 py-2.5 border-r text-[10px] font-bold uppercase tracking-wide"
                                                style={{ borderColor: B.border, color: B.muted, background: "#f4f7fb" }}>
                                                {label}
                                            </div>
                                            <div className={`flex-1 px-4 py-2.5 text-[11px] min-w-0 ${mono ? "font-mono" : "font-semibold"}`}
                                                style={{ color: red ? B.accent : B.text }}>
                                                {val === null ? <StatusBadge status={data.status} /> : val}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Panel>

                            {/* Timeline */}
                            <div className="rounded border bg-white shadow-sm overflow-hidden" style={{ borderColor: B.border }}>
                                <button onClick={() => setTlOpen(o => !o)}
                                    className="w-full flex items-center justify-between px-4 py-2.5 border-b transition-colors hover:bg-blue-50/20"
                                    style={{ background: B.headerRow, borderColor: B.border }}>
                                    <div className="flex items-center gap-2">
                                        <div className="h-4 w-1 rounded-full" style={{ background: B.primary }} />
                                        <p className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: B.text }}>
                                            Trazabilidad del Expediente
                                        </p>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded"
                                            style={{ background: B.light, color: B.primary }}>
                                            {timeline.length} evento{timeline.length !== 1 ? "s" : ""}
                                        </span>
                                    </div>
                                    {tlOpen ? <ChevronUp size={14} style={{ color: B.muted }} /> : <ChevronDown size={14} style={{ color: B.muted }} />}
                                </button>
                                {tlOpen && (
                                    timeline.length === 0 ? (
                                        <div className="py-8 flex flex-col items-center gap-2" style={{ color: B.muted }}>
                                            <Inbox size={22} />
                                            <p className="text-xs font-semibold">Sin eventos registrados</p>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full">
                                                <thead>
                                                    <tr style={{ borderBottom: `1px solid ${B.border}` }}>
                                                        {["Fecha / Hora", "Tipo de Evento", "Descripción", "Responsable"].map(h => (
                                                            <Th key={h}>{h}</Th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {timeline.map((ev, i) => (
                                                        <tr key={i} className="border-b"
                                                            style={{ borderColor: B.border, background: i % 2 === 0 ? "#fff" : B.altRow }}>
                                                            <td className="px-4 py-2.5 text-[11px] font-mono whitespace-nowrap" style={{ color: B.muted }}>
                                                                {ev?.at ? new Date(ev.at).toLocaleString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                                                            </td>
                                                            <td className="px-4 py-2.5 text-[11px] font-bold uppercase" style={{ color: B.text }}>{ev?.type || "—"}</td>
                                                            <td className="px-4 py-2.5 text-[11px]" style={{ color: B.muted }}>{ev?.description || "—"}</td>
                                                            <td className="px-4 py-2.5 text-[11px]" style={{ color: B.muted }}>{ev?.actor_name || "Sistema"}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )
                                )}
                            </div>

                            {/* Files */}
                            {files.length > 0 && (
                                <Panel title="Archivos Adjuntos" accent={B.primary}
                                    extra={
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded"
                                            style={{ background: B.light, color: B.primary }}>{files.length}</span>
                                    }>
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr style={{ borderBottom: `1px solid ${B.border}` }}>
                                                    {["Archivo", "Tipo", "Tamaño", "Acción"].map(h => <Th key={h}>{h}</Th>)}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {files.map((f, i) => (
                                                    <tr key={f.id} className="border-b"
                                                        style={{ borderColor: B.border, background: i % 2 === 0 ? "#fff" : B.altRow }}>
                                                        <td className="px-4 py-2.5">
                                                            <div className="flex items-center gap-2">
                                                                <Paperclip size={12} style={{ color: B.muted }} />
                                                                <span className="text-[11px] font-semibold" style={{ color: B.text }}>
                                                                    {f.filename || f.original_name || "archivo"}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-2.5 text-[11px]" style={{ color: B.muted }}>{f.doc_type || "Documento"}</td>
                                                        <td className="px-4 py-2.5 text-[11px] font-mono" style={{ color: B.muted }}>
                                                            {f.size ? `${Math.round(f.size / 1024)} KB` : "—"}
                                                        </td>
                                                        <td className="px-4 py-2.5">
                                                            <a href={f.url} target="_blank" rel="noreferrer"
                                                                className="text-[10px] font-bold uppercase tracking-wide hover:underline"
                                                                style={{ color: B.primary }}>
                                                                Ver archivo
                                                            </a>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </Panel>
                            )}

                            {/* Bottom actions */}
                            <div className="flex flex-wrap gap-2 pb-4">
                                <button onClick={downloadCargo} disabled={downloading}
                                    className="flex items-center gap-1.5 h-9 px-4 text-[11px] font-extrabold text-white rounded uppercase tracking-wide transition-colors disabled:opacity-50"
                                    style={{ background: B.accent }}
                                    onMouseEnter={e => e.currentTarget.style.background = B.accentHov}
                                    onMouseLeave={e => e.currentTarget.style.background = B.accent}>
                                    {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                                    Descargar Cargo de Recepción
                                </button>
                                <Link to="/public/procedures/new">
                                    <button
                                        className="flex items-center gap-1.5 h-9 px-4 text-[11px] font-extrabold rounded uppercase tracking-wide border transition-colors"
                                        style={{ borderColor: B.primary, color: B.primary, background: "#fff" }}
                                        onMouseEnter={e => e.currentTarget.style.background = B.light}
                                        onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                                        <Plus size={13} /> Nuevo Trámite
                                    </button>
                                </Link>
                                <button
                                    onClick={() => { setData(null); setCode(""); setTimeout(() => inputRef.current?.focus(), 100); }}
                                    className="flex items-center gap-1.5 h-9 px-4 text-[11px] font-extrabold rounded uppercase tracking-wide border transition-colors"
                                    style={{ borderColor: B.border, color: B.muted, background: "#fff" }}
                                    onMouseEnter={e => e.currentTarget.style.background = B.light}
                                    onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                                    <Search size={13} /> Nueva Búsqueda
                                </button>
                            </div>
                        </>
                    )}

                </div>
            </div>

            {/* ── STATUS BAR ── */}
            <footer className="shrink-0 flex items-center justify-between px-5 py-1"
                style={{ background: B.primary }}>
                <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                    Mesa de Partes Virtual · IESPP "Gustavo Allende Llavería" · Tarma, Junín
                </span>
                <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                    © {new Date().getFullYear()}
                </span>
            </footer>
        </div>
    );
}