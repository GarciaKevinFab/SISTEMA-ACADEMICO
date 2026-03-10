// src/modules/graduates/GraduatesModule.jsx
// ════════════════════════════════════════════════════════════════════
// Módulo completo CRUD de Egresados — Dashboard + Listado + Form
// Estilo: institucional, Plus Jakarta Sans, cards con gradientes
// ════════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
    GraduationCap, Search, Plus, Pencil, Trash2, Download,
    ChevronLeft, ChevronRight, X, Check, AlertTriangle,
    Users, Award, FileText, Calendar, Filter, RefreshCw,
    Eye, LayoutDashboard, List, UserPlus, ChevronDown,
    Building2, BookOpen, ShieldCheck, Hash, Loader2,
    Star, Edit3, AlertCircle, UploadCloud, FileSpreadsheet,
} from "lucide-react";
import { GraduatesAdmin, GradoTituloTypes } from "../../services/graduates.service";
import { Imports } from "../../services/catalogs.service";

/* ═══════════════════════════════════════════════════════════════════
   STYLES — inject once
   ═══════════════════════════════════════════════════════════════════ */
const MODULE_STYLE = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');

.gm-root {
    font-family: 'Plus Jakarta Sans', 'DM Sans', system-ui, sans-serif;
    --gm-bg: #F0F2F8;
    --gm-card: #FFFFFF;
    --gm-border: #E2E8F0;
    --gm-text: #1E293B;
    --gm-muted: #64748B;
    --gm-label: #546478;
    --gm-primary: #4F46E5;
    --gm-primary-light: #EEF2FF;
    --gm-success: #10B981;
    --gm-warning: #F59E0B;
    --gm-danger: #EF4444;
}
.gm-root * { font-family: inherit; box-sizing: border-box; }

/* scrollbar */
.gm-scroll::-webkit-scrollbar { width: 5px; }
.gm-scroll::-webkit-scrollbar-track { background: transparent; }
.gm-scroll::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 10px; }

/* animations */
@keyframes gm-fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes gm-scale-in { from { opacity: 0; transform: scale(.96); } to { opacity: 1; transform: none; } }
@keyframes gm-slide-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }
.gm-fade { animation: gm-fade-in .3s ease both; }
.gm-scale { animation: gm-scale-in .25s ease both; }
.gm-slide { animation: gm-slide-up .35s ease both; }

/* table */
.gm-table { border-collapse: separate; border-spacing: 0; }
.gm-table th { position: sticky; top: 0; z-index: 2; }
.gm-table tbody tr { transition: background .15s; }
.gm-table tbody tr:hover { background: #F8FAFC; }

/* input focus */
.gm-input:focus { outline: none; border-color: var(--gm-primary); box-shadow: 0 0 0 3px rgba(79,70,229,.12); }

/* modal overlay */
.gm-overlay { background: rgba(15,23,42,.45); backdrop-filter: blur(6px); }
`;

function InjectStyles() {
    useEffect(() => {
        const id = "gm-module-styles";
        if (document.getElementById(id)) return;
        const s = document.createElement("style");
        s.id = id;
        s.textContent = MODULE_STYLE;
        document.head.appendChild(s);
        return () => document.getElementById(id)?.remove();
    }, []);
    return null;
}

/* ═══════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════ */
const TABS = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "list", label: "Listado", icon: List },
    { id: "create", label: "Nuevo Titulado", icon: UserPlus },
    { id: "grados", label: "Grados y Títulos", icon: GraduationCap },
    { id: "importar", label: "Importar", icon: FileSpreadsheet },
];

const ESPECIALIDADES = [
    "EDUCACIÓN INICIAL",
    "EDUCACIÓN PRIMARIA",
    "EDUCACIÓN FÍSICA",
    "COMPUTACIÓN E INFORMÁTICA",
    "EDUCACIÓN SECUNDARIA, ESPECIALIDAD: COMUNICACIÓN",
];

const PAGE_SIZE = 15;

const EMPTY_FORM = {
    dni: "",
    apellidos_nombres: "",
    grado_titulo: "",
    especialidad: "",
    nivel: "",
    anio_ingreso: "",
    anio_egreso: "",
    fecha_sustentacion: "",
    resolucion_acta: "",
    codigo_diploma: "",
    registro_pedagogico: "",
    director_general: "",
    secretario_academico: "",
};

/* ═══════════════════════════════════════════════════════════════════
   HELPER COMPONENTS
   ═══════════════════════════════════════════════════════════════════ */

/* ── Stat Card ── */
const StatCard = ({ label, value, subtitle, icon: Icon, color }) => {
    const colorMap = {
        blue: { bg: "linear-gradient(135deg, #EBF5FF 0%, #DBEAFE 100%)", icon: "#3B82F6", border: "#BFDBFE" },
        green: { bg: "linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)", icon: "#10B981", border: "#A7F3D0" },
        purple: { bg: "linear-gradient(135deg, #F3E8FF 0%, #E9D5FF 100%)", icon: "#8B5CF6", border: "#C4B5FD" },
        amber: { bg: "linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)", icon: "#F59E0B", border: "#FDE68A" },
        rose: { bg: "linear-gradient(135deg, #FFF1F2 0%, #FFE4E6 100%)", icon: "#F43F5E", border: "#FECDD3" },
        teal: { bg: "linear-gradient(135deg, #F0FDFA 0%, #CCFBF1 100%)", icon: "#14B8A6", border: "#99F6E4" },
    };
    const c = colorMap[color] || colorMap.blue;

    return (
        <div
            className="gm-fade rounded-2xl p-5 relative overflow-hidden"
            style={{ background: c.bg, border: `1px solid ${c.border}` }}
        >
            <div className="flex items-start justify-between">
                <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "var(--gm-label)", textTransform: "uppercase", letterSpacing: ".06em" }}>
                        {label}
                    </p>
                    <p style={{ fontSize: 36, fontWeight: 900, color: "var(--gm-text)", lineHeight: 1.1, marginTop: 6 }}>
                        {value}
                    </p>
                    {subtitle && (
                        <p style={{ fontSize: 12, color: "var(--gm-muted)", marginTop: 4 }}>
                            ↗ {subtitle}
                        </p>
                    )}
                </div>
                <div
                    className="rounded-2xl p-3 flex items-center justify-center"
                    style={{ background: `${c.icon}18` }}
                >
                    <Icon size={22} style={{ color: c.icon }} />
                </div>
            </div>
        </div>
    );
};

/* ── Quick Action Button ── */
const QuickAction = ({ icon: Icon, label, onClick, color = "#4F46E5" }) => (
    <button
        onClick={onClick}
        className="gm-fade flex flex-col items-center gap-2.5 p-4 rounded-2xl bg-white border border-slate-100 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-500/8 transition-all duration-200 cursor-pointer group"
        style={{ minWidth: 100 }}
    >
        <div
            className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
            style={{ background: `${color}10` }}
        >
            <Icon size={22} style={{ color }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--gm-text)" }}>{label}</span>
    </button>
);

/* ── Badge ── */
const Badge = ({ children, color = "blue" }) => {
    const map = {
        blue: { bg: "#EEF2FF", text: "#4F46E5" },
        green: { bg: "#ECFDF5", text: "#059669" },
        amber: { bg: "#FFFBEB", text: "#D97706" },
        red: { bg: "#FEF2F2", text: "#DC2626" },
        gray: { bg: "#F1F5F9", text: "#64748B" },
    };
    const c = map[color] || map.blue;
    return (
        <span
            className="inline-flex items-center px-2.5 py-1 rounded-full"
            style={{ fontSize: 11, fontWeight: 700, background: c.bg, color: c.text }}
        >
            {children}
        </span>
    );
};

/* ── Input Field ── */
const FormField = ({ label, required, error, children }) => (
    <div className="space-y-1.5">
        <label style={{ fontSize: 12, fontWeight: 700, color: "var(--gm-label)", textTransform: "uppercase", letterSpacing: ".04em" }}>
            {label} {required && <span style={{ color: "var(--gm-danger)" }}>*</span>}
        </label>
        {children}
        {error && <p style={{ fontSize: 11, color: "var(--gm-danger)", fontWeight: 600 }}>{error}</p>}
    </div>
);

/* ── Confirm Modal ── */
const ConfirmModal = ({ open, title, message, onConfirm, onCancel, danger }) => {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 gm-overlay" onClick={onCancel}>
            <div
                className="gm-scale bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${danger ? "bg-red-50" : "bg-amber-50"}`}>
                        <AlertTriangle size={20} className={danger ? "text-red-500" : "text-amber-500"} />
                    </div>
                    <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--gm-text)" }}>{title}</h3>
                </div>
                <p style={{ fontSize: 14, color: "var(--gm-muted)", lineHeight: 1.6, marginBottom: 24 }}>{message}</p>
                <div className="flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-700 text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`px-5 py-2.5 rounded-xl text-sm font-700 text-white transition-colors ${danger ? "bg-red-500 hover:bg-red-600" : "bg-indigo-600 hover:bg-indigo-700"}`}
                    >
                        Confirmar
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ── Toast ── */
const Toast = ({ message, type, onClose }) => {
    useEffect(() => {
        const t = setTimeout(onClose, 4000);
        return () => clearTimeout(t);
    }, [onClose]);

    const colors = {
        success: { bg: "#ECFDF5", border: "#A7F3D0", text: "#065F46", icon: "#10B981" },
        error: { bg: "#FEF2F2", border: "#FECACA", text: "#991B1B", icon: "#EF4444" },
        info: { bg: "#EEF2FF", border: "#C7D2FE", text: "#3730A3", icon: "#4F46E5" },
    };
    const c = colors[type] || colors.info;

    return (
        <div
            className="gm-slide fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl max-w-sm"
            style={{ background: c.bg, border: `1px solid ${c.border}` }}
        >
            {type === "success" ? <Check size={18} style={{ color: c.icon }} /> : <AlertTriangle size={18} style={{ color: c.icon }} />}
            <span style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{message}</span>
            <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100 transition-opacity">
                <X size={14} style={{ color: c.text }} />
            </button>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════
   GRADOS Y TÍTULOS TAB (moved from ConfigCatalogsModule)
   ═══════════════════════════════════════════════════════════════════ */
const INITIAL_GT_FORM = { code: "", name: "", template: "", diploma_label: "TÍTULO", is_default: false, is_active: true, order: 0 };

function GradosTitulosTab() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(INITIAL_GT_FORM);

    const resetForm = () => { setForm(INITIAL_GT_FORM); setEditing(null); };

    const load = useCallback(async () => {
        try { setLoading(true); const data = await GradoTituloTypes.list(); setRows(data?.items ?? data ?? []); }
        catch { } finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const save = async () => {
        if (!form.code?.trim() || !form.name?.trim() || !form.template?.trim()) return;
        try {
            const payload = { ...form, order: parseInt(form.order || "0", 10) };
            if (editing) await GradoTituloTypes.update(editing.id, payload);
            else await GradoTituloTypes.create(payload);
            setOpen(false); resetForm(); load();
        } catch { }
    };

    const remove = async (id) => { try { await GradoTituloTypes.remove(id); load(); } catch { } };
    const toggleDefault = async (r) => { try { await GradoTituloTypes.update(r.id, { ...r, is_default: !r.is_default }); load(); } catch { } };
    const previewTpl = (tpl) => tpl ? tpl.replace("{especialidad}", "EDUCACIÓN INICIAL") : "—";

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--gm-text)" }}>Grados y Títulos</h3>
                    <p style={{ fontSize: 12, color: "var(--gm-muted)" }}>Tipos de grado/título que otorga la institución</p>
                </div>
                <button onClick={() => { resetForm(); setOpen(true); }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white"
                    style={{ background: "var(--gm-primary)" }}>
                    <Plus size={15} /> Nuevo tipo
                </button>
            </div>

            <div style={{ background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 12, padding: "12px 16px" }}>
                <p style={{ fontSize: 12, color: "#4338CA", fontWeight: 600 }}>
                    Cada tipo define una <strong>plantilla</strong> que se aplica según la especialidad del egresado.
                    Usa <code style={{ background: "#E0E7FF", padding: "1px 4px", borderRadius: 4, fontSize: 11 }}>{"{especialidad}"}</code> como variable.
                </p>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 size={24} className="animate-spin" style={{ color: "var(--gm-primary)" }} />
                </div>
            ) : (
                <div style={{ borderRadius: 12, border: "1px solid var(--gm-border)", overflow: "hidden" }}>
                    <table className="gm-table" style={{ width: "100%" }}>
                        <thead>
                            <tr style={{ background: "#F8FAFC" }}>
                                {["Código", "Nombre", "Plantilla → Resultado", "Etiqueta", "Estado", "Acciones"].map((h) => (
                                    <th key={h} style={{ padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: ".04em", textAlign: "left", borderBottom: "1px solid var(--gm-border)" }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                                    <td style={{ padding: "10px 14px" }}>
                                        <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: "#475569", background: "#F1F5F9", padding: "2px 8px", borderRadius: 4 }}>{r.code}</span>
                                    </td>
                                    <td style={{ padding: "10px 14px" }}>
                                        <span style={{ fontWeight: 700, color: "var(--gm-text)", fontSize: 13 }}>{r.name}</span>
                                        {r.is_default && (
                                            <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 800, color: "#D97706", background: "#FEF3C7", padding: "2px 8px", borderRadius: 20 }}>
                                                ★ DEFAULT
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ padding: "10px 14px" }}>
                                        <p style={{ fontSize: 11, color: "#94A3B8", fontFamily: "monospace" }}>{r.template}</p>
                                        <p style={{ fontSize: 12, color: "#4338CA", fontWeight: 600, marginTop: 2 }}>→ {previewTpl(r.template)}</p>
                                    </td>
                                    <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "#475569" }}>{r.diploma_label}</td>
                                    <td style={{ padding: "10px 14px", textAlign: "center" }}>
                                        <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: r.is_active ? "#D1FAE5" : "#F1F5F9", color: r.is_active ? "#059669" : "#94A3B8" }}>
                                            {r.is_active ? "Activo" : "Inactivo"}
                                        </span>
                                    </td>
                                    <td style={{ padding: "10px 14px" }}>
                                        <div className="flex items-center gap-1 justify-end">
                                            {!r.is_default && (
                                                <button onClick={() => toggleDefault(r)} style={{ fontSize: 11, fontWeight: 700, color: "#D97706", padding: "4px 8px", borderRadius: 6, background: "transparent" }}
                                                    onMouseOver={(e) => e.currentTarget.style.background = "#FEF3C7"}
                                                    onMouseOut={(e) => e.currentTarget.style.background = "transparent"}>
                                                    <Star size={13} />
                                                </button>
                                            )}
                                            <button onClick={() => { setEditing(r); setForm({ code: r.code || "", name: r.name || "", template: r.template || "", diploma_label: r.diploma_label || "TÍTULO", is_default: !!r.is_default, is_active: r.is_active !== false, order: r.order ?? 0 }); setOpen(true); }}
                                                style={{ padding: "4px 8px", borderRadius: 6, color: "#64748B", background: "transparent" }}
                                                onMouseOver={(e) => e.currentTarget.style.background = "#EEF2FF"}
                                                onMouseOut={(e) => e.currentTarget.style.background = "transparent"}>
                                                <Edit3 size={14} />
                                            </button>
                                            <button onClick={() => { if (window.confirm(`¿Eliminar "${r.name}"?`)) remove(r.id); }}
                                                style={{ padding: "4px 8px", borderRadius: 6, color: "#64748B", background: "transparent" }}
                                                onMouseOver={(e) => e.currentTarget.style.background = "#FEE2E2"}
                                                onMouseOut={(e) => e.currentTarget.style.background = "transparent"}>
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {rows.length === 0 && (
                                <tr><td colSpan={6} style={{ textAlign: "center", padding: 40, color: "var(--gm-muted)", fontSize: 13 }}>
                                    Sin tipos registrados. Crea uno como "TÍTULO DE PROFESOR(A)".
                                </td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal crear/editar */}
            {open && (
                <div className="gm-overlay fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => { setOpen(false); resetForm(); }}>
                    <div className="gm-scale bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
                        <div style={{ height: 3, background: "linear-gradient(90deg,#4F46E5,#7C3AED)" }} />
                        <div style={{ padding: 24 }}>
                            <div className="flex items-center justify-between mb-5">
                                <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--gm-text)" }}>
                                    {editing ? "Editar tipo" : "Nuevo tipo de grado/título"}
                                </h3>
                                <button onClick={() => { setOpen(false); resetForm(); }}><X size={18} style={{ color: "var(--gm-muted)" }} /></button>
                            </div>
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label style={{ fontSize: 12, fontWeight: 700, color: "var(--gm-label)" }}>Código *</label>
                                        <input className="gm-input" style={{ width: "100%", height: 36, borderRadius: 10, border: "1px solid var(--gm-border)", padding: "0 12px", fontSize: 13, fontFamily: "monospace" }}
                                            placeholder="TITULO_PROFESOR" value={form.code}
                                            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s+/g, "_") })} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: 12, fontWeight: 700, color: "var(--gm-label)" }}>Orden</label>
                                        <input type="number" className="gm-input" style={{ width: "100%", height: 36, borderRadius: 10, border: "1px solid var(--gm-border)", padding: "0 12px", fontSize: 13 }}
                                            value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} />
                                    </div>
                                </div>
                                <div>
                                    <label style={{ fontSize: 12, fontWeight: 700, color: "var(--gm-label)" }}>Nombre *</label>
                                    <input className="gm-input" style={{ width: "100%", height: 36, borderRadius: 10, border: "1px solid var(--gm-border)", padding: "0 12px", fontSize: 13 }}
                                        placeholder='TÍTULO DE PROFESOR(A)' value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })} />
                                </div>
                                <div>
                                    <label style={{ fontSize: 12, fontWeight: 700, color: "var(--gm-label)" }}>Plantilla * <span style={{ fontWeight: 400, color: "#94A3B8" }}>(usa {"{especialidad}"})</span></label>
                                    <input className="gm-input" style={{ width: "100%", height: 36, borderRadius: 10, border: "1px solid var(--gm-border)", padding: "0 12px", fontSize: 13 }}
                                        placeholder='PROFESOR(A) EN {especialidad}' value={form.template}
                                        onChange={(e) => setForm({ ...form, template: e.target.value })} />
                                </div>
                                {form.template && (
                                    <div style={{ background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 10, padding: "10px 14px" }}>
                                        <p style={{ fontSize: 10, fontWeight: 800, color: "#4338CA", textTransform: "uppercase", letterSpacing: ".05em" }}>Vista previa</p>
                                        <p style={{ fontSize: 13, fontWeight: 700, color: "#312E81", marginTop: 4 }}>{previewTpl(form.template)}</p>
                                    </div>
                                )}
                                <div>
                                    <label style={{ fontSize: 12, fontWeight: 700, color: "var(--gm-label)" }}>Etiqueta en constancia</label>
                                    <input className="gm-input" style={{ width: "100%", height: 36, borderRadius: 10, border: "1px solid var(--gm-border)", padding: "0 12px", fontSize: 13 }}
                                        placeholder="TÍTULO" value={form.diploma_label}
                                        onChange={(e) => setForm({ ...form, diploma_label: e.target.value })} />
                                </div>
                                <div className="flex gap-3">
                                    <label className="flex items-center gap-2 flex-1 p-3 rounded-xl cursor-pointer" style={{ border: "1px solid var(--gm-border)" }}
                                        onClick={() => setForm({ ...form, is_default: !form.is_default })}>
                                        <input type="checkbox" checked={!!form.is_default} readOnly style={{ width: 16, height: 16 }} />
                                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--gm-text)" }}>Por defecto</span>
                                    </label>
                                    <label className="flex items-center gap-2 flex-1 p-3 rounded-xl cursor-pointer" style={{ border: "1px solid var(--gm-border)" }}
                                        onClick={() => setForm({ ...form, is_active: !form.is_active })}>
                                        <input type="checkbox" checked={!!form.is_active} readOnly style={{ width: 16, height: 16 }} />
                                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--gm-text)" }}>Activo</span>
                                    </label>
                                </div>
                                <div className="flex justify-end gap-2 pt-3" style={{ borderTop: "1px solid #F1F5F9" }}>
                                    <button onClick={() => { setOpen(false); resetForm(); }}
                                        className="px-4 py-2 rounded-xl text-sm font-bold" style={{ border: "1px solid var(--gm-border)", color: "var(--gm-muted)" }}>
                                        Cancelar
                                    </button>
                                    <button onClick={save}
                                        className="px-6 py-2 rounded-xl text-sm font-bold text-white" style={{ background: "var(--gm-primary)" }}>
                                        Guardar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════
   IMPORTAR EGRESADOS TAB
   ═══════════════════════════════════════════════════════════════════ */
function ImportarEgresadosTab() {
    const [file, setFile] = useState(null);
    const [job, setJob] = useState(null);
    const [status, setStatus] = useState(null);
    const [isImporting, setIsImporting] = useState(false);
    const [progress, setProgress] = useState(0);
    const pollRef = useRef(null);

    const clearPolling = useCallback(() => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } }, []);

    useEffect(() => () => clearPolling(), [clearPolling]);

    const start = async () => {
        if (!file) return;
        setIsImporting(true); setStatus(null); setJob(null); setProgress(0);
        try {
            const res = await Imports.start("egresados", file);
            const jobId = res?.job_id;
            if (!jobId) throw new Error("Sin job_id");
            setJob(jobId);
            pollRef.current = setInterval(async () => {
                try {
                    const st = await Imports.status(jobId);
                    setStatus(st); setProgress(Number(st?.progress ?? 0));
                    const state = String(st?.state || "").toUpperCase();
                    if (["COMPLETED", "COMPLETED_WITH_ERRORS", "FAILED", "ERROR"].includes(state)) {
                        clearPolling(); setIsImporting(false); setProgress(100);
                    }
                } catch { }
            }, 2000);
        } catch { setIsImporting(false); }
    };

    const downloadTemplate = async () => {
        try {
            const res = await Imports.downloadTemplate("egresados");
            const cd = res.headers?.["content-disposition"] || "";
            const match = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(cd);
            const filename = match?.[1]?.replace(/['"]/g, "").trim() || "egresados_template.xlsx";
            const blob = new Blob([res.data], { type: res.headers?.["content-type"] || "application/octet-stream" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a"); a.href = url; a.download = filename;
            document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
        } catch { }
    };

    const errors = useMemo(() => {
        const raw = status?.errors;
        if (!raw) return [];
        if (Array.isArray(raw)) return raw.map((e) => typeof e === "string" ? { row: "—", field: "—", message: e } : e);
        return [];
    }, [status?.errors]);

    const stateLabel = String(status?.state || "").toUpperCase();
    const isDone = ["COMPLETED", "COMPLETED_WITH_ERRORS", "FAILED", "ERROR"].includes(stateLabel);

    return (
        <div className="space-y-4">
            <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--gm-text)" }}>Importar Egresados</h3>
                <p style={{ fontSize: 12, color: "var(--gm-muted)" }}>Carga masiva desde archivo Excel (.xlsx)</p>
            </div>

            <div style={{ background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 12, padding: "12px 16px" }}>
                <p style={{ fontSize: 12, color: "#4338CA" }}>
                    <strong>Instrucciones:</strong> Sube archivos EGRESO_XXXX.xlsx con el formato estándar.
                    Se usará el tipo de grado/título marcado como <strong>DEFAULT</strong> en la pestaña "Grados y Títulos".
                </p>
                <p style={{ fontSize: 11, color: "#6366F1", marginTop: 4 }}>Consejo: descarga la plantilla y no cambies nombres de columnas.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "var(--gm-label)", marginBottom: 4, display: "block" }}>Descargar plantilla</label>
                    <button onClick={downloadTemplate} disabled={isImporting}
                        className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-xl text-sm font-bold"
                        style={{ border: "1px solid var(--gm-border)", color: "var(--gm-text)", opacity: isImporting ? 0.5 : 1 }}>
                        <Download size={15} /> Descargar plantilla
                    </button>
                </div>
                <div className="md:col-span-2">
                    <label style={{ fontSize: 12, fontWeight: 700, color: "var(--gm-label)", marginBottom: 4, display: "block" }}>Archivo a importar</label>
                    <input type="file" accept=".xlsx" disabled={isImporting}
                        style={{ fontSize: 13, width: "100%" }}
                        onChange={(e) => {
                            const f = e.target.files?.[0] || null;
                            if (f && !f.name.toLowerCase().endsWith(".xlsx")) { setFile(null); return; }
                            setFile(f);
                        }} />
                    {file && <p style={{ fontSize: 11, color: "var(--gm-muted)", marginTop: 4 }}>{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</p>}
                </div>
            </div>

            <div className="flex justify-end">
                <button onClick={start} disabled={isImporting || !file}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white"
                    style={{ background: isImporting ? "#94A3B8" : "var(--gm-primary)", cursor: isImporting || !file ? "not-allowed" : "pointer" }}>
                    {isImporting ? <><Loader2 size={15} className="animate-spin" /> Procesando…</> : <><UploadCloud size={15} /> Iniciar importación</>}
                </button>
            </div>

            {/* Progress */}
            {(isImporting || status) && (
                <div style={{ borderRadius: 16, border: "1px solid var(--gm-border)", overflow: "hidden" }}>
                    <div style={{ padding: "12px 20px", background: "#F8FAFC", borderBottom: "1px solid var(--gm-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: "var(--gm-text)" }}>Progreso</span>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                            background: stateLabel === "COMPLETED" ? "#D1FAE5" : stateLabel.includes("ERROR") || stateLabel === "FAILED" ? "#FEE2E2" : "#DBEAFE",
                            color: stateLabel === "COMPLETED" ? "#059669" : stateLabel.includes("ERROR") || stateLabel === "FAILED" ? "#DC2626" : "#2563EB" }}>
                            {stateLabel || "PROCESANDO"}
                        </span>
                    </div>
                    <div style={{ padding: 20 }}>
                        <div style={{ background: "#E2E8F0", borderRadius: 8, height: 8, overflow: "hidden" }}>
                            <div style={{ width: `${Math.min(100, progress)}%`, height: "100%", background: "linear-gradient(90deg,#4F46E5,#7C3AED)", borderRadius: 8, transition: "width .3s" }} />
                        </div>
                        <div className="flex justify-between" style={{ fontSize: 11, color: "var(--gm-muted)", marginTop: 6 }}>
                            <span>Job: {job || "—"}</span>
                            <span>{Math.round(progress)}%</span>
                        </div>
                        {isDone && (
                            <div className="grid grid-cols-3 gap-3 mt-4">
                                {[{ l: "Importados", v: status?.imported ?? 0, c: "#D1FAE5" }, { l: "Actualizados", v: status?.updated ?? 0, c: "#DBEAFE" }, { l: "Errores", v: errors.length, c: "#FEE2E2" }].map(({ l, v, c }) => (
                                    <div key={l} style={{ background: c, borderRadius: 12, padding: "12px 14px" }}>
                                        <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", opacity: 0.7 }}>{l}</p>
                                        <p style={{ fontSize: 22, fontWeight: 900, marginTop: 2 }}>{v}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                        {errors.length > 0 && (
                            <div style={{ marginTop: 16, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: 16 }}>
                                <p style={{ fontSize: 12, fontWeight: 800, color: "#DC2626", marginBottom: 8 }}>
                                    <AlertCircle size={14} style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} />
                                    Errores ({errors.length})
                                </p>
                                <div style={{ maxHeight: 200, overflow: "auto" }}>
                                    <table style={{ width: "100%", fontSize: 11 }}>
                                        <thead><tr style={{ color: "#991B1B" }}>
                                            <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: 700 }}>Fila</th>
                                            <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: 700 }}>Campo</th>
                                            <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: 700 }}>Detalle</th>
                                        </tr></thead>
                                        <tbody>{errors.slice(0, 100).map((e, i) => (
                                            <tr key={i} style={{ borderTop: "1px solid #FECACA" }}>
                                                <td style={{ padding: "4px 8px", fontFamily: "monospace" }}>{e.row}</td>
                                                <td style={{ padding: "4px 8px" }}>{e.field}</td>
                                                <td style={{ padding: "4px 8px" }}>{e.message}</td>
                                            </tr>
                                        ))}</tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN MODULE
   ═══════════════════════════════════════════════════════════════════ */
export default function GraduatesModule() {
    /* ── State ── */
    const [activeTab, setActiveTab] = useState("dashboard");
    const [graduates, setGraduates] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);
    const [statsLoading, setStatsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [searchQ, setSearchQ] = useState("");
    const [filterEsp, setFilterEsp] = useState("");
    const [filterYear, setFilterYear] = useState("");

    /* form */
    const [form, setForm] = useState({ ...EMPTY_FORM });
    const [editingId, setEditingId] = useState(null);
    const [formErrors, setFormErrors] = useState({});
    const [saving, setSaving] = useState(false);

    /* modals */
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [detailTarget, setDetailTarget] = useState(null);
    const [toast, setToast] = useState(null);

    /* grado titulo types */
    const [gtTypes, setGtTypes] = useState([]);

    const searchTimeout = useRef(null);

    /* ── Load stats ── */
    const loadStats = useCallback(async () => {
        setStatsLoading(true);
        try {
            const data = await GraduatesAdmin.stats();
            setStats(data);
        } catch {
            // fallback: load list count
            try {
                const res = await GraduatesAdmin.list({ page_size: 1 });
                setStats({ total: res.count || 0 });
            } catch { /* silent */ }
        } finally {
            setStatsLoading(false);
        }
    }, []);

    /* ── Load graduates list ── */
    const loadList = useCallback(async (p = 1) => {
        setLoading(true);
        try {
            const params = { page: p, page_size: PAGE_SIZE };
            if (searchQ.trim()) params.search = searchQ.trim();
            if (filterEsp) params.especialidad = filterEsp;
            if (filterYear) params.anio_egreso = filterYear;

            const res = await GraduatesAdmin.list(params);
            setGraduates(res.results || []);
            setTotalCount(res.count || res.results?.length || 0);
            setPage(p);
        } catch (e) {
            setToast({ message: e.message || "Error al cargar titulados", type: "error" });
        } finally {
            setLoading(false);
        }
    }, [searchQ, filterEsp, filterYear]);

    /* ── Load grado titulo types ── */
    useEffect(() => {
        GradoTituloTypes.list().then(data => {
            setGtTypes(Array.isArray(data) ? data : data?.results || []);
        }).catch(() => { });
    }, []);

    /* ── Initial load ── */
    useEffect(() => { loadStats(); }, [loadStats]);
    useEffect(() => {
        if (activeTab === "list" || activeTab === "dashboard") loadList(1);
    }, [activeTab, filterEsp, filterYear]);

    /* ── Debounced search ── */
    useEffect(() => {
        if (activeTab !== "list") return;
        clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => loadList(1), 400);
        return () => clearTimeout(searchTimeout.current);
    }, [searchQ]);

    /* ── Form handlers ── */
    const handleFormChange = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }));
        if (formErrors[field]) setFormErrors((prev) => ({ ...prev, [field]: null }));
    };

    const validateForm = () => {
        const e = {};
        if (!form.apellidos_nombres.trim()) e.apellidos_nombres = "Nombre requerido";
        if (!form.especialidad.trim()) e.especialidad = "Especialidad requerida";
        if (!form.anio_ingreso.trim()) e.anio_ingreso = "Año ingreso requerido";
        if (!form.anio_egreso.trim()) e.anio_egreso = "Año egreso requerido";
        if (form.dni && (!/^\d{8}$/.test(form.dni))) e.dni = "DNI debe tener 8 dígitos";
        setFormErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSave = async () => {
        if (!validateForm()) return;
        setSaving(true);
        try {
            const payload = { ...form };
            // Convert empty fecha_sustentacion to null
            if (!payload.fecha_sustentacion) payload.fecha_sustentacion = null;

            if (editingId) {
                await GraduatesAdmin.update(editingId, payload);
                setToast({ message: "Titulado actualizado correctamente", type: "success" });
            } else {
                await GraduatesAdmin.create(payload);
                setToast({ message: "Titulado registrado correctamente", type: "success" });
            }
            setForm({ ...EMPTY_FORM });
            setEditingId(null);
            setActiveTab("list");
            loadList(1);
            loadStats();
        } catch (e) {
            setToast({ message: e.message || "Error al guardar", type: "error" });
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (grad) => {
        setForm({
            dni: grad.dni || "",
            apellidos_nombres: grad.apellidos_nombres || "",
            grado_titulo: grad.grado_titulo || "",
            especialidad: grad.especialidad || "",
            nivel: grad.nivel || "",
            anio_ingreso: grad.anio_ingreso || "",
            anio_egreso: grad.anio_egreso || "",
            fecha_sustentacion: grad.fecha_sustentacion
                ? (typeof grad.fecha_sustentacion === "string" && grad.fecha_sustentacion.includes("/")
                    ? grad.fecha_sustentacion.split("/").reverse().join("-")
                    : grad.fecha_sustentacion)
                : "",
            resolucion_acta: grad.resolucion_acta || "",
            codigo_diploma: grad.codigo_diploma || "",
            registro_pedagogico: grad.registro_pedagogico || "",
            director_general: grad.director_general || "",
            secretario_academico: grad.secretario_academico || "",
        });
        setEditingId(grad.id);
        setFormErrors({});
        setActiveTab("create");
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            await GraduatesAdmin.remove(deleteTarget.id);
            setToast({ message: "Titulado eliminado", type: "success" });
            setDeleteTarget(null);
            loadList(page);
            loadStats();
        } catch (e) {
            setToast({ message: e.message || "Error al eliminar", type: "error" });
        }
    };

    const handleExport = async () => {
        try {
            const res = await GraduatesAdmin.exportXlsx();
            const blob = res.data || res;
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "titulados.xlsx";
            a.click();
            URL.revokeObjectURL(url);
            setToast({ message: "Archivo descargado", type: "success" });
        } catch (e) {
            setToast({ message: e.message || "Error al exportar", type: "error" });
        }
    };

    const handleNewClick = () => {
        setForm({ ...EMPTY_FORM });
        setEditingId(null);
        setFormErrors({});
        setActiveTab("create");
    };

    /* ── Pagination ── */
    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    /* ── Unique years for filter ── */
    const yearOptions = useMemo(() => {
        const years = new Set(graduates.map((g) => g.anio_egreso).filter(Boolean));
        return [...years].sort().reverse();
    }, [graduates]);

    /* ═══════════════════════════════════════════════════════════════
       RENDER: MODULE HEADER
       ═══════════════════════════════════════════════════════════════ */
    const renderHeader = () => (
        <div
            className="rounded-2xl p-6 mb-6"
            style={{
                background: "linear-gradient(135deg, #1E293B 0%, #334155 50%, #1E293B 100%)",
                boxShadow: "0 4px 24px -4px rgba(30,41,59,.4)",
            }}
        >
            <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
                    <GraduationCap size={28} className="text-white" />
                </div>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 900, color: "#FFFFFF", letterSpacing: "-.02em" }}>
                        Gestión de Titulados
                    </h1>
                    <p style={{ fontSize: 13, color: "#94A3B8", marginTop: 2 }}>
                        Administración de registros de grados y títulos
                    </p>
                </div>
            </div>
        </div>
    );

    /* ═══════════════════════════════════════════════════════════════
       RENDER: TAB BAR
       ═══════════════════════════════════════════════════════════════ */
    const renderTabs = () => (
        <div className="bg-white rounded-2xl p-2 mb-6 shadow-sm border border-slate-100 flex flex-wrap gap-1">
            {TABS.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id || (tab.id === "create" && activeTab === "create" && editingId);
                const label = tab.id === "create" && editingId ? "Editar Titulado" : tab.label;
                return (
                    <button
                        key={tab.id}
                        onClick={() => {
                            if (tab.id === "create" && !editingId) handleNewClick();
                            else setActiveTab(tab.id);
                        }}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-700 transition-all duration-200 ${active
                                ? "bg-slate-800 text-white shadow-md"
                                : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                            }`}
                    >
                        <Icon size={16} />
                        {label}
                    </button>
                );
            })}
        </div>
    );

    /* ═══════════════════════════════════════════════════════════════
       RENDER: DASHBOARD
       ═══════════════════════════════════════════════════════════════ */
    const renderDashboard = () => {
        const s = stats || {};
        return (
            <div className="space-y-6">
                {/* Quick Actions */}
                <div>
                    <p style={{ fontSize: 11, fontWeight: 800, color: "var(--gm-label)", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 12 }}>
                        ACCESO RÁPIDO
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <QuickAction icon={UserPlus} label="Nuevo Titulado" onClick={handleNewClick} color="#4F46E5" />
                        <QuickAction icon={List} label="Ver Listado" onClick={() => setActiveTab("list")} color="#10B981" />
                        <QuickAction icon={Download} label="Exportar Excel" onClick={handleExport} color="#8B5CF6" />
                        <QuickAction icon={Search} label="Buscar" onClick={() => setActiveTab("list")} color="#F59E0B" />
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                        label="Total Titulados"
                        value={statsLoading ? "..." : (s.total ?? s.total_graduates ?? totalCount)}
                        subtitle="Registrados"
                        icon={Users}
                        color="blue"
                    />
                    <StatCard
                        label="Con Sustentación"
                        value={statsLoading ? "..." : (s.with_sustentacion ?? "—")}
                        subtitle="Fecha registrada"
                        icon={Calendar}
                        color="green"
                    />
                    <StatCard
                        label="Con Diploma"
                        value={statsLoading ? "..." : (s.with_diploma ?? "—")}
                        subtitle="Código asignado"
                        icon={Award}
                        color="purple"
                    />
                    <StatCard
                        label="Con Resolución"
                        value={statsLoading ? "..." : (s.with_resolucion ?? "—")}
                        subtitle="Acta registrada"
                        icon={FileText}
                        color="amber"
                    />
                </div>

                {/* Recent graduates mini-table */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                        <h3 style={{ fontSize: 15, fontWeight: 800, color: "var(--gm-text)" }}>Últimos Titulados Registrados</h3>
                        <button
                            onClick={() => setActiveTab("list")}
                            className="text-xs font-700 text-indigo-600 hover:text-indigo-700 transition-colors"
                        >
                            Ver todos →
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="gm-table w-full">
                            <thead>
                                <tr className="bg-slate-50">
                                    {["DNI", "Apellidos y Nombres", "Especialidad", "Año Egreso", "Sustentación"].map((h) => (
                                        <th key={h} className="px-4 py-3 text-left" style={{ fontSize: 11, fontWeight: 700, color: "var(--gm-label)", textTransform: "uppercase", letterSpacing: ".05em" }}>
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {graduates.slice(0, 8).map((g, i) => (
                                    <tr key={g.id || i} className="border-t border-slate-50">
                                        <td className="px-4 py-3">
                                            <span className="font-mono text-sm font-600 text-slate-700">{g.dni || "—"}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-sm font-600 text-slate-800">{g.apellidos_nombres}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge color="blue">{g.especialidad}</Badge>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-sm font-600 text-slate-600">{g.anio_egreso}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {g.fecha_sustentacion
                                                ? <Badge color="green">{g.fecha_sustentacion}</Badge>
                                                : <Badge color="gray">Pendiente</Badge>
                                            }
                                        </td>
                                    </tr>
                                ))}
                                {!graduates.length && !loading && (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-10 text-center">
                                            <p style={{ fontSize: 13, color: "var(--gm-muted)" }}>No hay titulados registrados</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    /* ═══════════════════════════════════════════════════════════════
       RENDER: LIST
       ═══════════════════════════════════════════════════════════════ */
    const renderList = () => (
        <div className="space-y-4">
            {/* Search & Filters Bar */}
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <div className="flex flex-wrap items-center gap-3">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[240px]">
                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchQ}
                            onChange={(e) => setSearchQ(e.target.value)}
                            placeholder="Buscar por DNI o nombre..."
                            className="gm-input w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm font-500"
                            style={{ background: "#F8FAFC" }}
                        />
                    </div>

                    {/* Filter: Especialidad */}
                    <div className="relative">
                        <select
                            value={filterEsp}
                            onChange={(e) => setFilterEsp(e.target.value)}
                            className="gm-input appearance-none pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm font-600 bg-white cursor-pointer"
                        >
                            <option value="">Todas las especialidades</option>
                            {ESPECIALIDADES.map((e) => <option key={e} value={e}>{e}</option>)}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>

                    {/* Filter: Year */}
                    <div className="relative">
                        <select
                            value={filterYear}
                            onChange={(e) => setFilterYear(e.target.value)}
                            className="gm-input appearance-none pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm font-600 bg-white cursor-pointer"
                        >
                            <option value="">Todos los años</option>
                            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>

                    {/* Actions */}
                    <button
                        onClick={() => loadList(1)}
                        className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
                        title="Refrescar"
                    >
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                    </button>

                    <button
                        onClick={handleNewClick}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-700 hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-600/20"
                    >
                        <Plus size={16} />
                        <span className="hidden sm:inline">Nuevo</span>
                    </button>

                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-700 hover:bg-slate-50 transition-colors"
                    >
                        <Download size={16} />
                        <span className="hidden sm:inline">Exportar</span>
                    </button>
                </div>

                {/* Active filters */}
                {(filterEsp || filterYear || searchQ) && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                        <Filter size={13} className="text-slate-400" />
                        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--gm-muted)" }}>Filtros:</span>
                        {searchQ && (
                            <Badge color="blue">
                                Búsqueda: "{searchQ}"
                                <button onClick={() => setSearchQ("")} className="ml-1.5 opacity-60 hover:opacity-100"><X size={11} /></button>
                            </Badge>
                        )}
                        {filterEsp && (
                            <Badge color="blue">
                                {filterEsp}
                                <button onClick={() => setFilterEsp("")} className="ml-1.5 opacity-60 hover:opacity-100"><X size={11} /></button>
                            </Badge>
                        )}
                        {filterYear && (
                            <Badge color="blue">
                                Año: {filterYear}
                                <button onClick={() => setFilterYear("")} className="ml-1.5 opacity-60 hover:opacity-100"><X size={11} /></button>
                            </Badge>
                        )}
                        <button
                            onClick={() => { setSearchQ(""); setFilterEsp(""); setFilterYear(""); }}
                            className="text-xs font-600 text-red-500 hover:text-red-600 ml-2"
                        >
                            Limpiar todo
                        </button>
                    </div>
                )}
            </div>

            {/* Results count */}
            <div className="flex items-center justify-between px-1">
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--gm-muted)" }}>
                    {totalCount} titulado{totalCount !== 1 ? "s" : ""} encontrado{totalCount !== 1 ? "s" : ""}
                </p>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto gm-scroll">
                    <table className="gm-table w-full" style={{ minWidth: 900 }}>
                        <thead>
                            <tr className="bg-slate-50/80">
                                {["#", "DNI", "Apellidos y Nombres", "Especialidad", "Año Egreso", "Sustentación", "Diploma", "Acciones"].map((h) => (
                                    <th key={h} className="px-4 py-3 text-left" style={{ fontSize: 10, fontWeight: 800, color: "var(--gm-label)", textTransform: "uppercase", letterSpacing: ".06em" }}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="text-center py-16">
                                        <Loader2 size={28} className="animate-spin text-indigo-400 mx-auto mb-3" />
                                        <p style={{ fontSize: 13, color: "var(--gm-muted)" }}>Cargando titulados...</p>
                                    </td>
                                </tr>
                            ) : graduates.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="text-center py-16">
                                        <GraduationCap size={40} className="text-slate-300 mx-auto mb-3" />
                                        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--gm-text)" }}>Sin resultados</p>
                                        <p style={{ fontSize: 12, color: "var(--gm-muted)", marginTop: 4 }}>No se encontraron titulados con los filtros actuales</p>
                                    </td>
                                </tr>
                            ) : (
                                graduates.map((g, i) => (
                                    <tr key={g.id} className="border-t border-slate-50 group">
                                        <td className="px-4 py-3">
                                            <span className="text-xs font-600 text-slate-400">{(page - 1) * PAGE_SIZE + i + 1}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="font-mono text-sm font-600 text-slate-700">{g.dni || <span className="text-slate-300">—</span>}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="text-sm font-700 text-slate-800 leading-tight">{g.apellidos_nombres}</p>
                                            {g.grado_titulo && (
                                                <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[280px]">{g.grado_titulo}</p>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge color="blue">{g.especialidad}</Badge>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-sm font-600 text-slate-600">{g.anio_egreso}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {g.fecha_sustentacion
                                                ? <Badge color="green">{g.fecha_sustentacion}</Badge>
                                                : <Badge color="gray">—</Badge>
                                            }
                                        </td>
                                        <td className="px-4 py-3">
                                            {g.codigo_diploma
                                                ? <Badge color="purple">{g.codigo_diploma}</Badge>
                                                : <span className="text-slate-300 text-sm">—</span>
                                            }
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => setDetailTarget(g)}
                                                    className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors"
                                                    title="Ver detalle"
                                                >
                                                    <Eye size={15} />
                                                </button>
                                                <button
                                                    onClick={() => handleEdit(g)}
                                                    className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-amber-600 transition-colors"
                                                    title="Editar"
                                                >
                                                    <Pencil size={15} />
                                                </button>
                                                <button
                                                    onClick={() => setDeleteTarget(g)}
                                                    className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between">
                        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--gm-muted)" }}>
                            Página {page} de {totalPages}
                        </p>
                        <div className="flex items-center gap-1.5">
                            <button
                                disabled={page <= 1}
                                onClick={() => loadList(page - 1)}
                                className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let num;
                                if (totalPages <= 5) num = i + 1;
                                else if (page <= 3) num = i + 1;
                                else if (page >= totalPages - 2) num = totalPages - 4 + i;
                                else num = page - 2 + i;
                                return (
                                    <button
                                        key={num}
                                        onClick={() => loadList(num)}
                                        className={`w-9 h-9 rounded-lg text-sm font-700 transition-colors ${num === page
                                                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                                                : "text-slate-500 hover:bg-slate-100"
                                            }`}
                                    >
                                        {num}
                                    </button>
                                );
                            })}
                            <button
                                disabled={page >= totalPages}
                                onClick={() => loadList(page + 1)}
                                className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    /* ═══════════════════════════════════════════════════════════════
       RENDER: FORM (Create / Edit)
       ═══════════════════════════════════════════════════════════════ */
    const inputCls = "gm-input w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-500 bg-white";

    const renderForm = () => (
        <div className="gm-fade">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Form header */}
                <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${editingId ? "bg-amber-50" : "bg-indigo-50"}`}>
                        {editingId ? <Pencil size={18} className="text-amber-600" /> : <UserPlus size={18} className="text-indigo-600" />}
                    </div>
                    <div>
                        <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--gm-text)" }}>
                            {editingId ? "Editar Titulado" : "Registrar Nuevo Titulado"}
                        </h3>
                        <p style={{ fontSize: 12, color: "var(--gm-muted)" }}>
                            {editingId ? "Modifica los datos del titulado" : "Completa los campos para registrar un nuevo titulado"}
                        </p>
                    </div>
                </div>

                <div className="p-6 space-y-8">
                    {/* ── Section: Datos Personales ── */}
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <Users size={16} className="text-indigo-500" />
                            <h4 style={{ fontSize: 13, fontWeight: 800, color: "var(--gm-text)", textTransform: "uppercase", letterSpacing: ".04em" }}>
                                Datos Personales
                            </h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <FormField label="DNI" error={formErrors.dni}>
                                <input
                                    type="text"
                                    maxLength={8}
                                    value={form.dni}
                                    onChange={(e) => handleFormChange("dni", e.target.value.replace(/\D/g, ""))}
                                    placeholder="12345678"
                                    className={inputCls}
                                />
                            </FormField>
                            <div className="md:col-span-2">
                                <FormField label="Apellidos y Nombres" required error={formErrors.apellidos_nombres}>
                                    <input
                                        type="text"
                                        value={form.apellidos_nombres}
                                        onChange={(e) => handleFormChange("apellidos_nombres", e.target.value.toUpperCase())}
                                        placeholder="APELLIDO PATERNO MATERNO, NOMBRES"
                                        className={inputCls}
                                    />
                                </FormField>
                            </div>
                        </div>
                    </div>

                    {/* ── Section: Datos Académicos ── */}
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <BookOpen size={16} className="text-green-500" />
                            <h4 style={{ fontSize: 13, fontWeight: 800, color: "var(--gm-text)", textTransform: "uppercase", letterSpacing: ".04em" }}>
                                Datos Académicos
                            </h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <FormField label="Especialidad" required error={formErrors.especialidad}>
                                <select
                                    value={form.especialidad}
                                    onChange={(e) => handleFormChange("especialidad", e.target.value)}
                                    className={inputCls + " cursor-pointer"}
                                >
                                    <option value="">Seleccionar...</option>
                                    {ESPECIALIDADES.map((e) => <option key={e} value={e}>{e}</option>)}
                                </select>
                            </FormField>
                            <FormField label="Grado / Título">
                                <input
                                    type="text"
                                    value={form.grado_titulo}
                                    onChange={(e) => handleFormChange("grado_titulo", e.target.value.toUpperCase())}
                                    placeholder="PROFESOR(A) EN..."
                                    className={inputCls}
                                />
                            </FormField>
                            <FormField label="Nivel">
                                <input
                                    type="text"
                                    value={form.nivel}
                                    onChange={(e) => handleFormChange("nivel", e.target.value.toUpperCase())}
                                    placeholder="Ej: INICIAL, PRIMARIA"
                                    className={inputCls}
                                />
                            </FormField>
                            <FormField label="Año de Ingreso" required error={formErrors.anio_ingreso}>
                                <input
                                    type="text"
                                    value={form.anio_ingreso}
                                    onChange={(e) => handleFormChange("anio_ingreso", e.target.value)}
                                    placeholder="Ej: 2019-I"
                                    className={inputCls}
                                />
                            </FormField>
                            <FormField label="Año de Egreso" required error={formErrors.anio_egreso}>
                                <input
                                    type="text"
                                    value={form.anio_egreso}
                                    onChange={(e) => handleFormChange("anio_egreso", e.target.value)}
                                    placeholder="Ej: 2023-II"
                                    className={inputCls}
                                />
                            </FormField>
                            <FormField label="Fecha de Sustentación">
                                <input
                                    type="date"
                                    value={form.fecha_sustentacion}
                                    onChange={(e) => handleFormChange("fecha_sustentacion", e.target.value)}
                                    className={inputCls}
                                />
                            </FormField>
                        </div>
                    </div>

                    {/* ── Section: Datos del Diploma ── */}
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <Award size={16} className="text-purple-500" />
                            <h4 style={{ fontSize: 13, fontWeight: 800, color: "var(--gm-text)", textTransform: "uppercase", letterSpacing: ".04em" }}>
                                Datos del Diploma
                            </h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <FormField label="Resolución / Acta">
                                <input
                                    type="text"
                                    value={form.resolucion_acta}
                                    onChange={(e) => handleFormChange("resolucion_acta", e.target.value)}
                                    placeholder="R.D.N° 0127-03/02/2025"
                                    className={inputCls}
                                />
                            </FormField>
                            <FormField label="Código de Diploma">
                                <input
                                    type="text"
                                    value={form.codigo_diploma}
                                    onChange={(e) => handleFormChange("codigo_diploma", e.target.value)}
                                    placeholder="238446"
                                    className={inputCls}
                                />
                            </FormField>
                            <FormField label="Registro Pedagógico">
                                <input
                                    type="text"
                                    value={form.registro_pedagogico}
                                    onChange={(e) => handleFormChange("registro_pedagogico", e.target.value)}
                                    placeholder="R.P.N° 020280 -P-DREJ-H"
                                    className={inputCls}
                                />
                            </FormField>
                        </div>
                    </div>

                    {/* ── Section: Datos Institucionales ── */}
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <Building2 size={16} className="text-teal-500" />
                            <h4 style={{ fontSize: 13, fontWeight: 800, color: "var(--gm-text)", textTransform: "uppercase", letterSpacing: ".04em" }}>
                                Datos Institucionales
                            </h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField label="Director General">
                                <input
                                    type="text"
                                    value={form.director_general}
                                    onChange={(e) => handleFormChange("director_general", e.target.value)}
                                    placeholder="NOMBRE DEL DIRECTOR"
                                    className={inputCls}
                                />
                            </FormField>
                            <FormField label="Secretario Académico">
                                <input
                                    type="text"
                                    value={form.secretario_academico}
                                    onChange={(e) => handleFormChange("secretario_academico", e.target.value)}
                                    placeholder="NOMBRE DEL SECRETARIO"
                                    className={inputCls}
                                />
                            </FormField>
                        </div>
                    </div>
                </div>

                {/* Form actions */}
                <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                    <button
                        onClick={() => { setActiveTab("list"); setEditingId(null); setForm({ ...EMPTY_FORM }); }}
                        className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-700 text-slate-600 hover:bg-white transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-700 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md shadow-indigo-600/20"
                    >
                        {saving ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                Guardando...
                            </>
                        ) : (
                            <>
                                <Check size={16} />
                                {editingId ? "Actualizar Titulado" : "Registrar Titulado"}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );

    /* ═══════════════════════════════════════════════════════════════
       RENDER: DETAIL MODAL
       ═══════════════════════════════════════════════════════════════ */
    const renderDetailModal = () => {
        if (!detailTarget) return null;
        const g = detailTarget;
        const fields = [
            { label: "DNI", value: g.dni, icon: Hash },
            { label: "Apellidos y Nombres", value: g.apellidos_nombres, icon: Users },
            { label: "Grado / Título", value: g.grado_titulo, icon: GraduationCap },
            { label: "Especialidad", value: g.especialidad, icon: BookOpen },
            { label: "Nivel", value: g.nivel },
            { label: "Año de Ingreso", value: g.anio_ingreso, icon: Calendar },
            { label: "Año de Egreso", value: g.anio_egreso, icon: Calendar },
            { label: "Fecha de Sustentación", value: g.fecha_sustentacion, icon: Calendar },
            { label: "Resolución / Acta", value: g.resolucion_acta, icon: FileText },
            { label: "Código de Diploma", value: g.codigo_diploma, icon: Award },
            { label: "Registro Pedagógico", value: g.registro_pedagogico, icon: ShieldCheck },
            { label: "Director General", value: g.director_general, icon: Building2 },
            { label: "Secretario Académico", value: g.secretario_academico, icon: Building2 },
        ];

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 gm-overlay" onClick={() => setDetailTarget(null)}>
                <div
                    className="gm-scale bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Modal header */}
                    <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                                <Eye size={18} className="text-indigo-600" />
                            </div>
                            <div>
                                <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--gm-text)" }}>Detalle del Titulado</h3>
                                <p style={{ fontSize: 12, color: "var(--gm-muted)" }}>ID: {g.id}</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setDetailTarget(null)}
                            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Modal body */}
                    <div className="flex-1 overflow-y-auto gm-scroll p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {fields.map(({ label, value, icon: FieldIcon }) => (
                                <div key={label} className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-100">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        {FieldIcon && <FieldIcon size={13} className="text-slate-400" />}
                                        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--gm-label)", textTransform: "uppercase", letterSpacing: ".06em" }}>
                                            {label}
                                        </span>
                                    </div>
                                    <p style={{ fontSize: 14, fontWeight: 600, color: value ? "var(--gm-text)" : "#CBD5E1" }}>
                                        {value || "—"}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Modal footer */}
                    <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 flex-shrink-0">
                        <button
                            onClick={() => { setDetailTarget(null); handleEdit(g); }}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-sm font-700 hover:bg-amber-100 transition-colors"
                        >
                            <Pencil size={14} />
                            Editar
                        </button>
                        <button
                            onClick={() => setDetailTarget(null)}
                            className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-700 text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    /* ═══════════════════════════════════════════════════════════════
       MAIN RENDER
       ═══════════════════════════════════════════════════════════════ */
    return (
        <div className="gm-root min-h-screen" style={{ background: "var(--gm-bg)", padding: "24px" }}>
            <InjectStyles />

            {renderHeader()}
            {renderTabs()}

            <div className="gm-fade" key={activeTab}>
                {activeTab === "dashboard" && renderDashboard()}
                {activeTab === "list" && renderList()}
                {activeTab === "create" && renderForm()}
                {activeTab === "grados" && <GradosTitulosTab />}
                {activeTab === "importar" && <ImportarEgresadosTab />}
            </div>

            {/* Modals */}
            {renderDetailModal()}

            <ConfirmModal
                open={!!deleteTarget}
                title="Eliminar Titulado"
                message={`¿Estás seguro de eliminar a "${deleteTarget?.apellidos_nombres}"? Esta acción no se puede deshacer.`}
                onConfirm={handleDelete}
                onCancel={() => setDeleteTarget(null)}
                danger
            />

            {/* Toast */}
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
}