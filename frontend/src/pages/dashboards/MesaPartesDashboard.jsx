// src/pages/dashboards/MesaPartesDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import {
    ClipboardList, Clock, AlertTriangle, CheckCircle, Inbox,
    Send, FileSearch, Timer, ChevronRight, Calendar, ArrowRight, Zap,
} from "lucide-react";
import { ProcedureReports } from "../../services/mesaPartes.service";
import { MpvDashboardSvc } from "../../services/dashboard.service";
import {
    DashboardShell, KpiGrid, StatCard, ChartCard, EmptyBox,
    toNumber, pickArray,
    CHART_TOOLTIP_STYLE, CHART_GRID_PROPS, CHART_AXIS_TICK, PIE_COLORS,
} from "./DashboardWidgets";

const MpvExtra = { recent: () => MpvDashboardSvc.recentProcedures() };

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

/* ─── SLA Summary Strip ──────────────────────────────────────── */
const SlaStrip = ({ total, open, resolved, sla, loading: L }) => {
    const safeTotal = total || 1;
    const items = [
        { label: "Abiertos", value: open, pct: (open / safeTotal) * 100, bar: "bg-amber-400", text: "text-amber-700" },
        { label: "Resueltos", value: resolved, pct: (resolved / safeTotal) * 100, bar: "bg-emerald-400", text: "text-emerald-700" },
        { label: "SLA venc.", value: sla, pct: (sla / safeTotal) * 100, bar: "bg-rose-400", text: "text-rose-700" },
    ];
    return (
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50/40 to-white">
                <div className="h-8 w-8 rounded-lg bg-indigo-100 grid place-items-center">
                    <ClipboardList size={15} className="text-indigo-600" />
                </div>
                <div>
                    <h3 className="font-bold text-slate-800 text-sm leading-none">Estado de Trámites</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                        {L ? "…" : `${total} trámites en total`}
                    </p>
                </div>
            </div>
            <div className="p-5 grid grid-cols-3 gap-5">
                {items.map(({ label, value, pct, bar, text }) => (
                    <div key={label} className="flex flex-col items-center gap-2">
                        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div
                                className={`h-full rounded-full ${bar} transition-all duration-700`}
                                style={{ width: `${Math.min(100, L ? 0 : pct)}%` }}
                            />
                        </div>
                        <p className={`text-2xl font-black tabular-nums leading-none ${text}`}>
                            {L ? "…" : value}
                        </p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 text-center">{label}</p>
                        <span className="text-[10px] text-slate-400 tabular-nums">
                            {L ? "" : `${Math.round(pct)}%`}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

/* ─── Procedure Row ──────────────────────────────────────────── */
const ProcRow = ({ proc, index, navigate }) => {
    const st = (proc.status ?? proc.estado ?? "").toLowerCase();
    const resolved = st.includes("resuel") || st.includes("done");
    const overdue = st.includes("venc") || st.includes("overdue");
    const badge = resolved
        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
        : overdue
            ? "bg-rose-50 text-rose-700 border border-rose-200"
            : "bg-amber-50 text-amber-700 border border-amber-200";

    const subject = proc.subject ?? proc.type ?? proc.tipo ?? "Trámite";
    const code = proc.code ?? proc.tracking_code ?? "";
    const date = proc.date ?? proc.created_at ?? "";

    return (
        <div
            className="group flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3.5 hover:border-indigo-200 hover:bg-indigo-50/20 transition-all duration-200 cursor-pointer"
            style={{ animationDelay: `${index * 50}ms` }}
            onClick={() => navigate("/dashboard/procedures")}
        >
            {/* Icon */}
            <div className="h-9 w-9 rounded-xl bg-slate-50 border border-slate-200 grid place-items-center shrink-0 group-hover:bg-indigo-50 group-hover:border-indigo-200 transition-colors">
                <FileSearch size={15} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-700 truncate leading-tight">{subject}</p>
                <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                    {[code, date].filter(Boolean).join(" · ")}
                </p>
            </div>
            {/* Badge */}
            <span className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full ${badge}`}>
                {proc.status ?? proc.estado ?? "—"}
            </span>
            <ChevronRight size={13} className="text-slate-300 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all shrink-0" />
        </div>
    );
};

/* ─── Quick Action ───────────────────────────────────────────── */
const QuickAction = ({ icon: Icon, label, path, accent = "indigo", navigate }) => {
    const colors = {
        indigo: "hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 [&:hover_.qa-icon]:bg-indigo-100 [&:hover_.qa-icon]:text-indigo-600",
        blue: "hover:bg-blue-50   hover:border-blue-200   hover:text-blue-700   [&:hover_.qa-icon]:bg-blue-100   [&:hover_.qa-icon]:text-blue-600",
        violet: "hover:bg-violet-50 hover:border-violet-200 hover:text-violet-700 [&:hover_.qa-icon]:bg-violet-100 [&:hover_.qa-icon]:text-violet-600",
        cyan: "hover:bg-cyan-50   hover:border-cyan-200   hover:text-cyan-700   [&:hover_.qa-icon]:bg-cyan-100   [&:hover_.qa-icon]:text-cyan-600",
    };
    return (
        <button
            onClick={() => navigate(path ?? "/dashboard/procedures")}
            className={`group flex items-center gap-3 w-full rounded-xl border border-slate-200 bg-white p-3.5 text-left text-slate-600 font-semibold text-sm transition-all duration-200 active:scale-[0.98] ${colors[accent]}`}
        >
            <div className="qa-icon h-8 w-8 rounded-lg bg-slate-100 grid place-items-center transition-colors border border-transparent">
                <Icon size={15} className="text-slate-500 transition-colors" />
            </div>
            <span className="flex-1">{label}</span>
            <ArrowRight size={13} className="text-slate-300 group-hover:translate-x-0.5 transition-transform" />
        </button>
    );
};

/* ─── Main Component ─────────────────────────────────────────── */
export default function MesaPartesDashboard({ roles }) {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const [data, setData] = useState({ stats: null, recent: null });

    const load = async () => {
        setLoading(true); setErr("");
        try {
            const results = await Promise.allSettled([
                ProcedureReports.summary(),
                MpvExtra.recent(),
            ]);
            setData({
                stats: results[0].status === "fulfilled" ? results[0].value : null,
                recent: results[1].status === "fulfilled" ? results[1].value : null,
            });
            if (results.every(r => r.status === "rejected")) setErr("Error cargando datos.");
        } catch (e) { setErr(e?.message || "Error"); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const md = useMemo(() => {
        const d = data.stats || {};
        return d.dashboard ?? d.summary ?? d;
    }, [data.stats]);

    const kpis = useMemo(() => {
        const m = md || {};
        return {
            total: toNumber(m.total ?? m.total_procedures ?? 0),
            open: toNumber(m.open ?? m.pending ?? m.in_progress ?? 0),
            resolved: toNumber(m.resolved ?? m.closed ?? 0),
            sla: toNumber(m.sla_breached ?? m.overdue ?? 0),
            avgDays: toNumber(m.avg_resolution_days ?? m.avg_days ?? 0),
            todayIn: toNumber(m.today_ingress ?? m.today ?? 0),
        };
    }, [md]);

    const byStatus = useMemo(() => {
        const arr = pickArray(md, ["by_status", "status"])
            .map(x => ({ name: x.name ?? x.status ?? "", value: toNumber(x.value ?? x.count ?? 0) }))
            .filter(x => x.value > 0);
        if (arr.length > 0) return arr;
        const fb = [];
        if (kpis.open) fb.push({ name: "Pendientes", value: kpis.open });
        if (kpis.resolved) fb.push({ name: "Resueltos", value: kpis.resolved });
        if (kpis.sla) fb.push({ name: "Vencidos", value: kpis.sla });
        return fb;
    }, [md, kpis]);

    const byType = useMemo(() =>
        pickArray(md, ["by_type", "types", "procedure_types"])
            .map(x => ({ name: x.name ?? x.type ?? "", value: toNumber(x.value ?? x.count ?? 0) }))
            .filter(x => x.name && x.value > 0)
            .slice(0, 8),
        [md]);

    const recentProcs = useMemo(() => {
        const r = data.recent || {};
        const arr = pickArray(r, ["results", "items"]);
        return (arr.length > 0 ? arr : Array.isArray(r) ? r : []).slice(0, 6);
    }, [data.recent]);

    const L = loading;
    const isManager = roles?.includes("MPV_MANAGER");

    return (
        <DashboardShell
            title={isManager ? "Jefatura — Mesa de Partes" : "Mesa de Partes"}
            subtitle="Trámites documentarios · SLA · Seguimiento"
            loading={loading}
            error={err}
            onRefresh={load}
        >
            {/* ── Alerta SLA ── */}
            {!L && kpis.sla > 0 && (
                <div className="flex items-center gap-3 rounded-2xl border border-rose-200/70 bg-gradient-to-r from-rose-50 via-pink-50/40 to-rose-50 px-4 py-3.5">
                    <div className="h-8 w-8 rounded-lg bg-rose-100 grid place-items-center shrink-0">
                        <AlertTriangle size={15} className="text-rose-700" />
                    </div>
                    <p className="flex-1 text-sm font-semibold text-rose-900">
                        {kpis.sla} trámite{kpis.sla > 1 ? "s" : ""} con SLA vencido — requiere{kpis.sla > 1 ? "n" : ""} atención inmediata
                    </p>
                    <button
                        onClick={() => navigate("/dashboard/procedures")}
                        className="shrink-0 rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 text-xs font-bold transition-colors"
                    >
                        Atender
                    </button>
                </div>
            )}

            {/* ── KPIs ── */}
            <KpiGrid cols={4}>
                <StatCard icon={ClipboardList} title="Total Trámites" value={L ? "…" : kpis.total} hint={`Hoy: ${kpis.todayIn} ingresados`} tone="indigo" />
                <StatCard icon={Clock} title="Pendientes" value={L ? "…" : kpis.open} tone="amber" />
                <StatCard icon={CheckCircle} title="Resueltos" value={L ? "…" : kpis.resolved} tone="emerald" />
                <StatCard icon={Timer} title="Tiempo Promedio" value={L ? "…" : `${kpis.avgDays} días`} hint={kpis.sla > 0 ? `${kpis.sla} SLA vencidos` : "Dentro del SLA"} tone={kpis.sla > 0 ? "rose" : "blue"} />
            </KpiGrid>

            {/* ── Estado strip ── */}
            <SlaStrip
                total={kpis.total}
                open={kpis.open}
                resolved={kpis.resolved}
                sla={kpis.sla}
                loading={L}
            />

            {/* ── Gráficos + Lista + Acciones ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">

                {/* Estado (donut) */}
                <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
                        <div className="h-2 w-2 rounded-full bg-violet-500 ring-4 ring-violet-50" />
                        <h3 className="font-bold text-slate-800 text-sm">Distribución por Estado</h3>
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
                            <EmptyBox title="Sin datos de estado" subtitle="" />
                        )}
                    </div>
                </div>

                {/* Por tipo (barras) */}
                <div className="xl:col-span-2 rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
                        <div className="h-2 w-2 rounded-full bg-cyan-500 ring-4 ring-cyan-50" />
                        <h3 className="font-bold text-slate-800 text-sm">Trámites por Tipo</h3>
                    </div>
                    <div className="p-5 h-72">
                        {byType.length >= 1 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={byType} margin={{ top: 8, right: 16, left: -14, bottom: 0 }}>
                                    <CartesianGrid vertical={false} stroke="#f1f5f9" />
                                    <XAxis
                                        dataKey="name"
                                        tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 600 }}
                                        interval={0} height={64} angle={-22} textAnchor="end"
                                        axisLine={false} tickLine={false}
                                    />
                                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f0fdfa", radius: 4 }} />
                                    <Bar dataKey="value" name="Cantidad" fill="#0891b2" radius={[6, 6, 0, 0]} maxBarSize={36} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <EmptyBox title="Sin datos de tipos" subtitle="" />
                        )}
                    </div>
                </div>

                {/* Trámites recientes */}
                <div className="xl:col-span-2 rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-100 grid place-items-center">
                                <Inbox size={15} className="text-indigo-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 text-sm leading-none">Últimos Trámites Ingresados</h3>
                                {recentProcs.length > 0 && (
                                    <p className="text-[11px] text-slate-400 mt-0.5">{recentProcs.length} registros recientes</p>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={() => navigate("/dashboard/procedures")}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors"
                        >
                            Ver todos <ArrowRight size={12} />
                        </button>
                    </div>
                    <div className="p-4">
                        {recentProcs.length > 0 ? (
                            <div className="space-y-2">
                                {recentProcs.map((proc, i) => (
                                    <ProcRow key={i} proc={proc} index={i} navigate={navigate} />
                                ))}
                            </div>
                        ) : (
                            <div className="py-8">
                                <EmptyBox title="Sin trámites recientes" subtitle="Los nuevos trámites aparecerán aquí" icon={Inbox} />
                            </div>
                        )}
                    </div>
                </div>

                {/* Acciones rápidas */}
                <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
                        <div className="h-8 w-8 rounded-lg bg-slate-100 grid place-items-center">
                            <Zap size={15} className="text-slate-600" />
                        </div>
                        <h3 className="font-bold text-slate-800 text-sm">Acciones Rápidas</h3>
                    </div>
                    <div className="p-4 space-y-2">
                        <QuickAction icon={Inbox} label="Bandeja de trámites" accent="indigo" navigate={navigate} />
                        <QuickAction icon={FileSearch} label="Buscar expediente" accent="blue" navigate={navigate} />
                        <QuickAction icon={Send} label="Derivar trámite" accent="violet" navigate={navigate} />
                        <QuickAction icon={Timer} label="Reportes SLA" accent="cyan" navigate={navigate} />
                    </div>

                    {/* Mini stats */}
                    <div className="mx-4 mb-4 mt-1 rounded-xl bg-gradient-to-br from-indigo-50 to-cyan-50/60 border border-indigo-100/60 p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 mb-3">Hoy</p>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { label: "Ingresados", value: L ? "…" : kpis.todayIn, color: "text-indigo-700" },
                                { label: "SLA venc.", value: L ? "…" : kpis.sla, color: kpis.sla > 0 ? "text-rose-700" : "text-emerald-700" },
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