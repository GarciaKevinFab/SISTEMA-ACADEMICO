// src/pages/dashboards/AdmissionDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import {
    Activity, UserPlus, FileSearch, CheckCircle2, Send,
    FileText, AlertCircle, ChevronRight, Clock, Filter,
    UserCheck, XCircle, Eye, BarChart3, ArrowRight, Zap,
} from "lucide-react";
import { getAdmissionDashboardStats } from "../../services/admission.service";
import { AdmissionDashboardSvc } from "../../services/dashboard.service";
import {
    DashboardShell, KpiGrid, StatCard, ChartCard, EmptyBox, ProgressBar,
    toNumber, pickArray,
    CHART_TOOLTIP_STYLE, CHART_GRID_PROPS, CHART_AXIS_TICK, PIE_COLORS,
} from "./DashboardWidgets";

const AdmExtra = {
    recentApplicants: () => AdmissionDashboardSvc.recentApplicants(),
};

/* ─── Custom Tooltip ─────────────────────────────────────────── */
const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-xl border border-slate-200 bg-white/95 backdrop-blur-sm px-4 py-3 shadow-xl text-sm">
            <p className="font-bold text-slate-700 mb-2">{label}</p>
            {payload.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: p.fill }} />
                    <span className="text-slate-500">{p.name}:</span>
                    <span className="font-semibold text-slate-800">{p.value}</span>
                </div>
            ))}
        </div>
    );
};

/* ─── Funnel Step ────────────────────────────────────────────── */
const FunnelStep = ({ label, value, color, pct, loading, isLast }) => (
    <div className="flex flex-col items-center gap-2 relative">
        {/* Connector line */}
        {!isLast && (
            <div className="hidden sm:block absolute top-3 left-[calc(50%+2rem)] right-[-calc(50%-2rem)] h-0.5 bg-slate-100 z-0 pointer-events-none"
                style={{ width: "calc(100% - 2rem)", left: "calc(50% + 1rem)" }}
            />
        )}
        {/* Bar */}
        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
                className={`h-full rounded-full ${color} transition-all duration-700`}
                style={{ width: `${Math.min(100, pct)}%` }}
            />
        </div>
        {/* Value */}
        <p className="text-2xl font-black text-slate-900 tabular-nums leading-none">
            {loading ? "…" : value}
        </p>
        {/* Pct badge */}
        <span className="text-[10px] font-bold text-slate-400 tabular-nums">
            {loading ? "" : `${Math.round(pct)}%`}
        </span>
        {/* Label */}
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center leading-tight">
            {label}
        </p>
    </div>
);

/* ─── Applicant Row ──────────────────────────────────────────── */
const ApplicantRow = ({ app, index }) => {
    const st = (app.status ?? app.estado ?? "").toLowerCase();
    const admitted = st.includes("admit") || st.includes("aprob");
    const rejected = st.includes("rechaz") || st.includes("reject");
    const badge = admitted
        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
        : rejected
            ? "bg-rose-50 text-rose-700 border border-rose-200"
            : "bg-amber-50 text-amber-700 border border-amber-200";

    const initial = (app.first_name ?? app.name ?? app.full_name ?? "?")[0].toUpperCase();
    const fullName = (app.full_name ?? `${app.first_name ?? ""} ${app.last_name ?? ""}`.trim()) || "Postulante";
    const career = app.career ?? app.career_name ?? "";
    const date = app.created_at ?? "";

    return (
        <div
            className="group flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3.5 hover:border-indigo-200 hover:bg-indigo-50/20 transition-all duration-200"
            style={{ animationDelay: `${index * 50}ms` }}
        >
            {/* Avatar */}
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 border border-indigo-200/60 grid place-items-center shrink-0 font-bold text-sm text-indigo-700">
                {initial}
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-700 truncate leading-tight">{fullName}</p>
                <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                    {[career, date].filter(Boolean).join(" · ")}
                </p>
            </div>
            {/* Status badge */}
            <span className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full ${badge}`}>
                {app.status ?? app.estado ?? "—"}
            </span>
        </div>
    );
};

/* ─── Quick Action ───────────────────────────────────────────── */
const QuickAction = ({ icon: Icon, label, path, navigate }) => (
    <button
        onClick={() => navigate(path)}
        className="group flex items-center gap-3 w-full rounded-xl border border-slate-200 bg-white p-3.5 text-left text-slate-600 font-semibold text-sm hover:border-indigo-200 hover:bg-indigo-50/30 hover:text-indigo-700 transition-all duration-200 active:scale-[0.98]"
    >
        <div className="h-8 w-8 rounded-lg bg-slate-100 grid place-items-center group-hover:bg-indigo-100 transition-colors border border-transparent">
            <Icon size={15} className="text-slate-500 group-hover:text-indigo-600 transition-colors" />
        </div>
        <span className="flex-1">{label}</span>
        <ArrowRight size={13} className="text-slate-300 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
    </button>
);

/* ─── Main Component ─────────────────────────────────────────── */
export default function AdmissionDashboard() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const [data, setData] = useState({ stats: null, recent: null });

    const load = async () => {
        setLoading(true); setErr("");
        try {
            const results = await Promise.allSettled([
                getAdmissionDashboardStats(),
                AdmExtra.recentApplicants(),
            ]);
            setData({
                stats: results[0].status === "fulfilled" ? results[0].value : null,
                recent: results[1].status === "fulfilled" ? results[1].value : null,
            });
            if (results.every(r => r.status === "rejected"))
                setErr("No se pudieron cargar los datos de admisión.");
        } catch (e) { setErr(e?.message || "Error"); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const kpis = useMemo(() => {
        const d = data.stats || {};
        return {
            total: toNumber(d.total_applications ?? d.applications ?? d.total ?? 0),
            openCalls: toNumber(d.calls_open ?? d.open_calls ?? 0),
            docsReview: toNumber(d.docs_pending ?? d.documents_pending ?? 0),
            evalPending: toNumber(d.evaluation_pending ?? 0),
            admitted: toNumber(d.admitted ?? d.accepted ?? 0),
            rejected: toNumber(d.rejected ?? d.denied ?? 0),
            published: toNumber(d.results_published ?? 0),
        };
    }, [data.stats]);

    const byCareer = useMemo(() =>
        pickArray(data.stats || {}, ["by_career", "careers", "career_stats"])
            .map(x => ({ name: x.name ?? x.career_name ?? "", value: toNumber(x.value ?? x.total ?? x.applications ?? 0) }))
            .filter(x => x.name && x.value > 0)
            .slice(0, 10),
        [data.stats]);

    const byStatus = useMemo(() =>
        pickArray(data.stats || {}, ["by_status", "status_summary", "status"])
            .map(x => ({ name: x.name ?? x.status ?? "", value: toNumber(x.value ?? x.count ?? 0) }))
            .filter(x => x.value > 0),
        [data.stats]);

    const recentApplicants = useMemo(() => {
        const r = data.recent || {};
        return pickArray(r, ["results", "items", "data", "applicants"]).slice(0, 6);
    }, [data.recent]);

    const L = loading;
    const funnelTotal = kpis.total || 1;

    const funnelSteps = [
        { label: "Postulantes", value: kpis.total, color: "bg-indigo-500", pct: 100 },
        { label: "Docs revisados", value: kpis.total - kpis.docsReview, color: "bg-blue-500", pct: funnelTotal > 0 ? ((kpis.total - kpis.docsReview) / funnelTotal) * 100 : 0 },
        { label: "Evaluados", value: kpis.total - kpis.evalPending, color: "bg-violet-500", pct: funnelTotal > 0 ? ((kpis.total - kpis.evalPending) / funnelTotal) * 100 : 0 },
        { label: "Admitidos", value: kpis.admitted, color: "bg-emerald-500", pct: funnelTotal > 0 ? (kpis.admitted / funnelTotal) * 100 : 0 },
        { label: "Rechazados", value: kpis.rejected, color: "bg-rose-500", pct: funnelTotal > 0 ? (kpis.rejected / funnelTotal) * 100 : 0 },
    ];

    return (
        <DashboardShell
            title="Panel de Admisión"
            subtitle="Convocatorias · Postulantes · Proceso de selección"
            loading={loading}
            error={err}
            onRefresh={load}
        >
            {/* ── Alerta documentaria ── */}
            {!L && kpis.docsReview > 0 && (
                <div className="flex items-center gap-3 rounded-2xl border border-amber-200/70 bg-gradient-to-r from-amber-50 via-orange-50/40 to-amber-50 px-4 py-3.5">
                    <div className="h-8 w-8 rounded-lg bg-amber-100 grid place-items-center shrink-0">
                        <FileSearch size={15} className="text-amber-700" />
                    </div>
                    <p className="flex-1 text-sm font-semibold text-amber-900">
                        {kpis.docsReview} expediente{kpis.docsReview > 1 ? "s" : ""} pendiente{kpis.docsReview > 1 ? "s" : ""} de revisión documentaria
                    </p>
                    <button
                        onClick={() => navigate("/dashboard/admission/documents")}
                        className="shrink-0 rounded-lg bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 text-xs font-bold transition-colors"
                    >
                        Revisar
                    </button>
                </div>
            )}

            {/* ── KPIs ── */}
            <KpiGrid cols={4}>
                <StatCard icon={Activity} title="Convocatorias Activas" value={L ? "…" : kpis.openCalls} tone="indigo" />
                <StatCard icon={UserPlus} title="Postulaciones" value={L ? "…" : kpis.total} tone="emerald" />
                <StatCard icon={FileSearch} title="Docs por Revisar" value={L ? "…" : kpis.docsReview} tone={kpis.docsReview > 0 ? "amber" : "emerald"} />
                <StatCard icon={CheckCircle2} title="Admitidos" value={L ? "…" : kpis.admitted} hint={`Rechazados: ${kpis.rejected}`} tone="cyan" />
            </KpiGrid>

            {/* ── Embudo de admisión ── */}
            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50/50 to-white">
                    <div className="h-8 w-8 rounded-lg bg-indigo-100 grid place-items-center">
                        <Filter size={15} className="text-indigo-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 text-sm leading-none">Embudo de Admisión</h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">Flujo completo del proceso de selección</p>
                    </div>
                </div>
                <div className="p-6">
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-6">
                        {funnelSteps.map((step, i) => (
                            <FunnelStep
                                key={step.label}
                                {...step}
                                loading={L}
                                isLast={i === funnelSteps.length - 1}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Gráficos + Tabla + Acciones ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">

                {/* Postulaciones por carrera */}
                <div className="xl:col-span-2 rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
                        <div className="h-2 w-2 rounded-full bg-indigo-500 ring-4 ring-indigo-50" />
                        <h3 className="font-bold text-slate-800 text-sm">Postulaciones por Carrera</h3>
                    </div>
                    <div className="p-5 h-72">
                        {byCareer.length >= 1 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={byCareer} margin={{ top: 8, right: 16, left: -14, bottom: 0 }}>
                                    <CartesianGrid vertical={false} stroke="#f1f5f9" />
                                    <XAxis
                                        dataKey="name"
                                        tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 600 }}
                                        interval={0} height={64} angle={-22} textAnchor="end"
                                        axisLine={false} tickLine={false}
                                    />
                                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc", radius: 4 }} />
                                    <Bar dataKey="value" name="Postulaciones" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={36} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <EmptyBox title="Sin datos de carreras" subtitle="Aparecerán cuando haya postulaciones" icon={BarChart3} />
                        )}
                    </div>
                </div>

                {/* Estado de postulaciones */}
                <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
                        <div className="h-2 w-2 rounded-full bg-violet-500 ring-4 ring-violet-50" />
                        <h3 className="font-bold text-slate-800 text-sm">Estado de Postulaciones</h3>
                    </div>
                    <div className="p-5 h-72">
                        {byStatus.length >= 1 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend
                                        verticalAlign="bottom" height={40} iconType="circle" iconSize={8}
                                        wrapperStyle={{ fontSize: "11px", color: "#64748b" }}
                                    />
                                    <Pie
                                        data={byStatus} dataKey="value" nameKey="name"
                                        cx="50%" cy="44%" innerRadius={52} outerRadius={80}
                                        paddingAngle={4} cornerRadius={6}
                                    >
                                        {byStatus.map((_, i) => (
                                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="none" />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <EmptyBox title="Sin datos de estado" subtitle="" icon={BarChart3} />
                        )}
                    </div>
                </div>

                {/* Postulantes recientes */}
                <div className="xl:col-span-2 rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-emerald-50 border border-emerald-100 grid place-items-center">
                                <UserPlus size={15} className="text-emerald-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 text-sm leading-none">Postulantes Recientes</h3>
                                {recentApplicants.length > 0 && (
                                    <p className="text-[11px] text-slate-400 mt-0.5">{recentApplicants.length} registros</p>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={() => navigate("/dashboard/admission/applicants")}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors"
                        >
                            Ver todos <ArrowRight size={12} />
                        </button>
                    </div>
                    <div className="p-4">
                        {recentApplicants.length > 0 ? (
                            <div className="space-y-2">
                                {recentApplicants.map((app, i) => (
                                    <ApplicantRow key={i} app={app} index={i} />
                                ))}
                            </div>
                        ) : (
                            <div className="py-8">
                                <EmptyBox title="Sin postulantes recientes" subtitle="Los nuevos postulantes aparecerán aquí" icon={UserPlus} />
                            </div>
                        )}
                    </div>
                </div>

                {/* Gestión / Acciones rápidas */}
                <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
                        <div className="h-8 w-8 rounded-lg bg-slate-100 grid place-items-center">
                            <Zap size={15} className="text-slate-600" />
                        </div>
                        <h3 className="font-bold text-slate-800 text-sm">Gestión</h3>
                    </div>
                    <div className="p-4 space-y-2">
                        {[
                            { icon: Activity, label: "Convocatorias", path: "/dashboard/admission/calls" },
                            { icon: UserPlus, label: "Postulantes", path: "/dashboard/admission/applicants" },
                            { icon: FileSearch, label: "Revisión documentaria", path: "/dashboard/admission/documents" },
                            { icon: Send, label: "Publicar resultados", path: "/dashboard/admission/results" },
                            { icon: Eye, label: "Reportes", path: "/dashboard/admission/reports" },
                        ].map(({ icon, label, path }) => (
                            <QuickAction key={label} icon={icon} label={label} path={path} navigate={navigate} />
                        ))}
                    </div>

                    {/* Mini resumen */}
                    <div className="mx-4 mb-4 mt-1 rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50/60 border border-indigo-100/60 p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 mb-3">Resumen rápido</p>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { label: "Publicados", value: L ? "…" : kpis.published, color: "text-indigo-700" },
                                { label: "Eval. pend.", value: L ? "…" : kpis.evalPending, color: "text-amber-700" },
                            ].map(({ label, value, color }) => (
                                <div key={label} className="text-center">
                                    <p className={`text-xl font-black tabular-nums ${color}`}>{value}</p>
                                    <p className="text-[10px] text-slate-500 font-medium mt-0.5">{label}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </DashboardShell>
    );
}