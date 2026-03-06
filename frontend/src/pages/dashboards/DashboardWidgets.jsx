// src/pages/dashboards/DashboardWidgets.jsx
import React from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";

/* ─── Tone map ───────────────────────────────────────────────── */
const TONES = {
    indigo: { wrap: "bg-indigo-50  border-indigo-100", icon: "text-indigo-600", value: "text-indigo-700" },
    emerald: { wrap: "bg-emerald-50 border-emerald-100", icon: "text-emerald-600", value: "text-emerald-700" },
    amber: { wrap: "bg-amber-50   border-amber-100", icon: "text-amber-600", value: "text-amber-700" },
    rose: { wrap: "bg-rose-50    border-rose-100", icon: "text-rose-600", value: "text-rose-700" },
    slate: { wrap: "bg-slate-50   border-slate-100", icon: "text-slate-600", value: "text-slate-700" },
    blue: { wrap: "bg-blue-50    border-blue-100", icon: "text-blue-600", value: "text-blue-700" },
    cyan: { wrap: "bg-cyan-50    border-cyan-100", icon: "text-cyan-600", value: "text-cyan-700" },
    violet: { wrap: "bg-violet-50  border-violet-100", icon: "text-violet-600", value: "text-violet-700" },
    orange: { wrap: "bg-orange-50  border-orange-100", icon: "text-orange-600", value: "text-orange-700" },
    teal: { wrap: "bg-teal-50    border-teal-100", icon: "text-teal-600", value: "text-teal-700" },
    pink: { wrap: "bg-pink-50    border-pink-100", icon: "text-pink-600", value: "text-pink-700" },
};

/* ─── Helpers ────────────────────────────────────────────────── */
export const toNumber = (v, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
};

export const pickArray = (obj, keys = []) => {
    if (Array.isArray(obj)) return obj;
    for (const k of keys) {
        if (Array.isArray(obj?.[k])) return obj[k];
    }
    return [];
};

export const unwrapSummary = (obj) => {
    if (!obj) return {};
    return obj?.summary ?? obj?.data?.summary ?? obj?.dashboard ?? obj;
};

/* ─── StatCard ───────────────────────────────────────────────── */
export const StatCard = ({ icon: Icon, title, value, hint, tone = "indigo", className = "" }) => {
    const t = TONES[tone] ?? TONES.indigo;
    return (
        <div className={`group rounded-2xl border border-slate-200/80 bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden ${className}`}>
            <div className="p-5 flex items-start gap-4">
                {/* Icon badge */}
                <div className={`h-11 w-11 rounded-xl grid place-items-center border shrink-0 ${t.wrap} ${t.icon}`}>
                    <Icon size={19} />
                </div>
                {/* Content */}
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{title}</p>
                    <p className={`text-2xl font-black mt-1 truncate tabular-nums ${t.value}`}>{value}</p>
                    {hint && <p className="text-[11px] text-slate-400 mt-1 font-medium">{hint}</p>}
                </div>
            </div>
            {/* Bottom accent bar */}
            <div className={`h-0.5 w-0 group-hover:w-full ${t.wrap.split(" ")[0].replace("bg-", "bg-").replace("50", "300")} transition-all duration-500`} />
        </div>
    );
};

/* ─── EmptyBox ───────────────────────────────────────────────── */
export const EmptyBox = ({ title, subtitle, icon: Icon }) => (
    <div className="flex flex-col items-center justify-center h-full min-h-[180px] rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center gap-3">
        {Icon && (
            <div className="h-12 w-12 rounded-xl bg-slate-100 grid place-items-center">
                <Icon size={22} className="text-slate-300" />
            </div>
        )}
        <div>
            <p className="font-bold text-slate-400 text-sm">{title}</p>
            {subtitle && <p className="text-xs text-slate-300 mt-1">{subtitle}</p>}
        </div>
    </div>
);

/* ─── ChartCard ──────────────────────────────────────────────── */
export const ChartCard = ({
    title, accentColor = "bg-indigo-500", icon: Icon,
    span = 1, children, className = "",
}) => (
    <div className={`
        ${span === 2 ? "xl:col-span-2" : span === 3 ? "xl:col-span-3" : "xl:col-span-1"}
        rounded-2xl border border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-shadow duration-300
        min-h-[380px] flex flex-col overflow-hidden ${className}
    `}>
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
            {Icon
                ? <Icon size={16} className="text-slate-400" />
                : <span className={`w-2 h-2 rounded-full ring-4 ${accentColor} ${accentColor.replace("bg-", "ring-").replace(/\d+$/, "50")}`} />
            }
            <h3 className="font-bold text-slate-800 text-sm">{title}</h3>
        </div>
        {/* Body */}
        <div className="flex-1 min-h-0 w-full p-5">{children}</div>
    </div>
);

/* ─── InfoPanel ──────────────────────────────────────────────── */
export const InfoPanel = ({ title, icon: Icon, items = [], className = "" }) => (
    <div className={`rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden ${className}`}>
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
            {Icon && (
                <div className="h-8 w-8 rounded-lg bg-slate-100 grid place-items-center">
                    <Icon size={15} className="text-slate-500" />
                </div>
            )}
            <h3 className="font-bold text-slate-800 text-sm">{title}</h3>
        </div>
        {/* Items */}
        <div className="p-4 space-y-2">
            {items.map((item, i) => (
                <div
                    key={i}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3 hover:bg-white hover:border-slate-200 hover:shadow-sm transition-all duration-200"
                >
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{item.label}</p>
                        {item.sub && <p className="text-xs text-slate-400 mt-0.5">{item.sub}</p>}
                    </div>
                    <p className={`text-xl font-black tabular-nums ${item.color || "text-slate-900"}`}>{item.value}</p>
                </div>
            ))}
        </div>
    </div>
);

/* ─── ProgressBar ────────────────────────────────────────────── */
export const ProgressBar = ({ label, value, max = 100, color = "bg-indigo-500" }) => {
    const pct = max > 0 ? Math.min(100, (toNumber(value) / max) * 100) : 0;
    return (
        <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-500">{label}</span>
                <span className="font-bold text-slate-700 tabular-nums">{Math.round(pct)}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                    className={`h-full rounded-full ${color} transition-all duration-700`}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
};

/* ─── DashboardShell ─────────────────────────────────────────── */
export const DashboardShell = ({ title, subtitle, loading, error, onRefresh, children }) => (
    <div className="h-[calc(100vh-64px)] overflow-y-auto bg-slate-50/70 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
        <div className="p-6 lg:p-10 max-w-[1920px] mx-auto space-y-6">

            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-slate-200/70">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900 leading-none">{title}</h1>
                    {subtitle && (
                        <p className="text-sm text-slate-500 mt-2 font-medium">{subtitle}</p>
                    )}
                </div>
                {onRefresh && (
                    <button
                        onClick={onRefresh}
                        disabled={loading}
                        className="group inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 hover:shadow-md active:scale-95 transition-all duration-200 font-bold text-slate-600 shadow-sm w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <RefreshCw
                            size={16}
                            className={`text-slate-400 group-hover:text-indigo-500 transition-colors ${loading ? "animate-spin" : ""}`}
                        />
                        {loading ? "Cargando..." : "Actualizar"}
                    </button>
                )}
            </div>

            {/* ── Error banner ── */}
            {error && (
                <div className="flex items-start gap-4 rounded-2xl border border-rose-200/80 bg-gradient-to-r from-rose-50 to-pink-50/50 p-4 shadow-sm">
                    <div className="h-9 w-9 rounded-xl bg-rose-100 grid place-items-center shrink-0">
                        <AlertTriangle size={18} className="text-rose-600" />
                    </div>
                    <div className="min-w-0">
                        <p className="font-bold text-rose-800 text-sm">Error al cargar los datos</p>
                        <p className="text-xs text-rose-600/80 mt-0.5 font-medium">{error}</p>
                    </div>
                </div>
            )}

            {/* ── Skeleton / Content ── */}
            {loading && !error ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="rounded-2xl border border-slate-200/60 bg-white shadow-sm p-5 animate-pulse">
                            <div className="flex items-start gap-4">
                                <div className="h-11 w-11 rounded-xl bg-slate-100 shrink-0" />
                                <div className="flex-1 space-y-2.5 pt-0.5">
                                    <div className="h-2.5 w-16 bg-slate-100 rounded-full" />
                                    <div className="h-6 w-24 bg-slate-100 rounded-lg" />
                                    <div className="h-2 w-28 bg-slate-50 rounded-full" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : children}

            {/* Bottom spacer */}
            <div className="h-8" />
        </div>
    </div>
);

/* ─── KpiGrid ────────────────────────────────────────────────── */
export const KpiGrid = ({ cols = 4, children }) => {
    const colClass =
        cols === 2 ? "lg:grid-cols-2" :
            cols === 3 ? "lg:grid-cols-3" :
                "lg:grid-cols-4";
    return (
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${colClass} gap-5`}>
            {children}
        </div>
    );
};

/* ─── Chart constants ────────────────────────────────────────── */
export const CHART_TOOLTIP_STYLE = {
    borderRadius: "12px",
    border: "1px solid #e2e8f0",
    boxShadow: "0 10px 25px -5px rgb(0 0 0 / 0.1)",
    fontSize: "12px",
    padding: "10px 14px",
};
export const CHART_GRID_PROPS = { strokeDasharray: "0", vertical: false, stroke: "#f1f5f9" };
export const CHART_AXIS_TICK = { fontSize: 11, fill: "#94a3b8" };
export const PIE_COLORS = ["#4f46e5", "#7c3aed", "#0891b2", "#16a34a", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6"];