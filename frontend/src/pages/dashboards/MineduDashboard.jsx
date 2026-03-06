// src/pages/dashboards/MineduDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
    ResponsiveContainer, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import {
    HardDrive, Activity, CheckCircle2, XCircle, AlertTriangle,
    Clock, Send, ArrowRight,
} from "lucide-react";
import { Stats as MineduStats } from "../../services/minedu.service";
import { MineduDashboardSvc } from "../../services/dashboard.service";
import {
    DashboardShell, KpiGrid, StatCard, ChartCard, EmptyBox, ProgressBar,
    toNumber, pickArray,
    CHART_TOOLTIP_STYLE, CHART_GRID_PROPS, CHART_AXIS_TICK,
} from "./DashboardWidgets";

const MinExtra = { logs: () => MineduDashboardSvc.recentLogs() };

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

/* ─── Success Rate Panel ─────────────────────────────────────── */
const RatePanel = ({ kpis, loading: L }) => {
    const total = kpis.success + kpis.failed || 1;
    const successPct = Math.round((kpis.success / total) * 100);
    const failedPct = Math.round((kpis.failed / total) * 100);

    return (
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50/40 to-white">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-blue-100 grid place-items-center">
                        <HardDrive size={15} className="text-blue-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 text-sm leading-none">Resumen de Sincronización</h3>
                        {kpis.lastSync && (
                            <p className="text-[11px] text-slate-400 mt-0.5">
                                Última sync: <span className="font-semibold text-slate-600">{kpis.lastSync}</span>
                            </p>
                        )}
                    </div>
                </div>
                {/* Big rate indicator */}
                <div className="text-right">
                    <p className={`text-2xl font-black tabular-nums ${successPct >= 90 ? "text-emerald-700" : successPct >= 70 ? "text-amber-700" : "text-rose-700"}`}>
                        {L ? "…" : `${successPct}%`}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">Tasa de éxito</p>
                </div>
            </div>
            <div className="p-5 space-y-4">
                {/* Counters */}
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: "En cola", value: kpis.pending, color: "text-amber-700", bg: "bg-amber-50 border-amber-100", icon: Clock },
                        { label: "Exitosos", value: kpis.success, color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-100", icon: CheckCircle2 },
                        { label: "Con error", value: kpis.failed, color: "text-rose-700", bg: "bg-rose-50 border-rose-100", icon: XCircle },
                    ].map(({ label, value, color, bg, icon: Icon }) => (
                        <div key={label} className={`flex flex-col items-center rounded-xl border p-3 text-center gap-1 ${bg}`}>
                            <Icon size={14} className={color} />
                            <p className={`text-2xl font-black tabular-nums ${color}`}>{L ? "…" : value}</p>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
                        </div>
                    ))}
                </div>
                {/* Bars */}
                <div className="space-y-3">
                    <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold text-slate-500">
                            <span>Tasa de éxito</span>
                            <span className="text-emerald-600 font-bold tabular-nums">{L ? "–" : `${successPct}%`}</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700" style={{ width: `${L ? 0 : successPct}%` }} />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold text-slate-500">
                            <span>Tasa de error</span>
                            <span className="text-rose-600 font-bold tabular-nums">{L ? "–" : `${failedPct}%`}</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-rose-500 to-rose-400 transition-all duration-700" style={{ width: `${L ? 0 : failedPct}%` }} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ─── Log Table ──────────────────────────────────────────────── */
const LogTable = ({ logs }) => {
    if (logs.length === 0) {
        return (
            <div className="py-8">
                <EmptyBox title="Sin exportaciones recientes" subtitle="El historial de logs aparecerá aquí" icon={Send} />
            </div>
        );
    }
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-slate-100">
                        {["Fecha", "Tipo", "Registros", "Estado", "Detalle"].map(h => (
                            <th key={h} className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {logs.map((log, i) => {
                        const ok = ["success", "ok", "exitoso", "completado"].some(k =>
                            (log.status ?? "").toLowerCase().includes(k)
                        );
                        return (
                            <tr
                                key={i}
                                className="hover:bg-slate-50/70 transition-colors"
                                style={{ animationDelay: `${i * 30}ms` }}
                            >
                                <td className="py-3 px-4 text-slate-600 font-medium whitespace-nowrap">
                                    {log.date ?? log.created_at ?? "—"}
                                </td>
                                <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                                    {log.type ?? log.export_type ?? "—"}
                                </td>
                                <td className="py-3 px-4 font-mono text-slate-700 font-semibold">
                                    {toNumber(log.records ?? log.count ?? 0).toLocaleString()}
                                </td>
                                <td className="py-3 px-4">
                                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${ok
                                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                            : "bg-rose-50 text-rose-700 border-rose-200"
                                        }`}>
                                        {ok
                                            ? <CheckCircle2 size={10} />
                                            : <XCircle size={10} />
                                        }
                                        {log.status ?? "—"}
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-xs text-slate-400 truncate max-w-[220px]">
                                    {log.detail ?? log.message ?? log.error ?? "—"}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

/* ─── Main Component ─────────────────────────────────────────── */
export default function MineduDashboard() {
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const [data, setData] = useState({ stats: null, logs: null });

    const load = async () => {
        setLoading(true); setErr("");
        try {
            const results = await Promise.allSettled([
                MineduStats.dashboard(),
                MinExtra.logs(),
            ]);
            setData({
                stats: results[0].status === "fulfilled" ? results[0].value : null,
                logs: results[1].status === "fulfilled" ? results[1].value : null,
            });
            if (results.every(r => r.status === "rejected")) setErr("Error cargando datos MINEDU.");
        } catch (e) { setErr(e?.message || "Error"); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const stats = useMemo(() => { const d = data.stats || {}; return d.stats ?? d; }, [data.stats]);

    const kpis = useMemo(() => {
        const s = stats || {};
        return {
            pending: toNumber(s.pending_exports ?? s.pending ?? 0),
            success: toNumber(s.completed_exports ?? s.success ?? 0),
            failed: toNumber(s.failed_exports ?? s.failed ?? 0),
            rate: toNumber(s.success_rate ?? 0),
            lastSync: s.last_sync ?? s.last_run ?? null,
            total: toNumber(s.total_exports ?? s.total ?? 0),
        };
    }, [stats]);

    const history = useMemo(() =>
        pickArray(stats, ["history", "sync_history", "export_history"])
            .map(x => ({
                date: x.date ?? x.day ?? "",
                exitosos: toNumber(x.success ?? x.completed ?? 0),
                fallidos: toNumber(x.failed ?? x.errors ?? 0),
            }))
            .filter(x => x.date),
        [stats]);

    const byType = useMemo(() =>
        pickArray(stats, ["by_type", "export_types", "types"])
            .map(x => ({ name: x.name ?? x.type ?? "", value: toNumber(x.value ?? x.count ?? 0) }))
            .filter(x => x.name && x.value > 0),
        [stats]);

    const logs = useMemo(() => {
        const l = data.logs || {};
        const arr = pickArray(l, ["results", "items", "logs"]);
        return (arr.length > 0 ? arr : Array.isArray(l) ? l : []).slice(0, 10);
    }, [data.logs]);

    const L = loading;

    return (
        <DashboardShell
            title="Integración MINEDU"
            subtitle="Estado de exportaciones · Sincronización · Logs"
            loading={loading}
            error={err}
            onRefresh={load}
        >
            {/* ── Alerta fallidos ── */}
            {!L && kpis.failed > 0 && (
                <div className="flex items-center gap-3 rounded-2xl border border-rose-200/70 bg-gradient-to-r from-rose-50 via-pink-50/40 to-rose-50 px-4 py-3.5">
                    <div className="h-8 w-8 rounded-lg bg-rose-100 grid place-items-center shrink-0">
                        <AlertTriangle size={15} className="text-rose-700" />
                    </div>
                    <p className="flex-1 text-sm font-semibold text-rose-900">
                        {kpis.failed} exportación{kpis.failed > 1 ? "es" : ""} fallida{kpis.failed > 1 ? "s" : ""} — revisa los logs y reintenta
                    </p>
                </div>
            )}

            {/* ── KPIs ── */}
            <KpiGrid cols={4}>
                <StatCard icon={Clock} title="En Cola" value={L ? "…" : kpis.pending} hint="Pendientes de envío" tone="amber" />
                <StatCard icon={CheckCircle2} title="Exitosos" value={L ? "…" : kpis.success} tone="emerald" />
                <StatCard icon={XCircle} title="Fallidos" value={L ? "…" : kpis.failed} tone={kpis.failed > 0 ? "rose" : "slate"} />
                <StatCard icon={Activity} title="Tasa de Éxito" value={L ? "…" : `${Math.round(kpis.rate)}%`} hint={`Total: ${kpis.total}`} tone="blue" />
            </KpiGrid>

            {/* ── Resumen con barras ── */}
            <RatePanel kpis={kpis} loading={L} />

            {/* ── Gráficos ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">

                {/* Historial stacked */}
                <div className="xl:col-span-2 rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
                        <div className="h-2 w-2 rounded-full bg-blue-500 ring-4 ring-blue-50" />
                        <h3 className="font-bold text-slate-800 text-sm">Historial de Sincronización</h3>
                    </div>
                    <div className="p-5 h-72">
                        {history.length >= 2 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={history} margin={{ top: 8, right: 16, left: -14, bottom: 0 }}>
                                    <CartesianGrid vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} dy={8} />
                                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc", radius: 4 }} />
                                    <Legend
                                        iconType="circle" iconSize={8}
                                        wrapperStyle={{ fontSize: "11px", color: "#64748b", paddingTop: "10px" }}
                                    />
                                    <Bar dataKey="exitosos" name="Exitosos" fill="#10b981" radius={[0, 0, 0, 0]} maxBarSize={28} stackId="s" />
                                    <Bar dataKey="fallidos" name="Fallidos" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={28} stackId="s" />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <EmptyBox title="Sin historial" subtitle="Los datos de sincronización aparecerán aquí" />
                        )}
                    </div>
                </div>

                {/* Por tipo */}
                <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
                        <div className="h-2 w-2 rounded-full bg-indigo-500 ring-4 ring-indigo-50" />
                        <h3 className="font-bold text-slate-800 text-sm">Por Tipo de Exportación</h3>
                    </div>
                    <div className="p-5 h-72">
                        {byType.length >= 1 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={byType} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                                    <CartesianGrid horizontal={false} stroke="#f1f5f9" />
                                    <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 600 }} axisLine={false} tickLine={false} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "#eef2ff" }} />
                                    <Bar dataKey="value" name="Registros" fill="#6366f1" radius={[0, 6, 6, 0]} maxBarSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <EmptyBox title="Sin tipos de exportación" subtitle="" />
                        )}
                    </div>
                </div>
            </div>

            {/* ── Log de exportaciones ── */}
            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-blue-50 border border-blue-100 grid place-items-center">
                            <Send size={15} className="text-blue-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 text-sm leading-none">Log de Exportaciones Recientes</h3>
                            {logs.length > 0 && (
                                <p className="text-[11px] text-slate-400 mt-0.5">{logs.length} registros</p>
                            )}
                        </div>
                    </div>
                    {kpis.failed > 0 && (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                            <AlertTriangle size={10} />
                            {kpis.failed} con error
                        </span>
                    )}
                </div>
                <LogTable logs={logs} />
            </div>
        </DashboardShell>
    );
}