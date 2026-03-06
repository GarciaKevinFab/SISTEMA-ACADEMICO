// src/pages/dashboards/AdminDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area,
} from "recharts";
import {
    Activity, GraduationCap, Wallet, ClipboardList, Users, HardDrive,
    Microscope, ShieldCheck, TrendingUp, AlertTriangle, Server,
    Database, Globe, Settings, Eye, Lock, ChevronRight, ArrowRight,
    CheckCircle2, XCircle, Zap,
} from "lucide-react";

import { AcademicReports } from "../../services/academic.service";
import { getAdmissionDashboardStats } from "../../services/admission.service";
import { FinanceDashboard as FinSvc } from "../../services/finance.service";
import { ProcedureReports } from "../../services/mesaPartes.service";
import { Stats as MineduStats } from "../../services/minedu.service";
import { UsersService } from "../../services/users.service";
import { Reports as ResearchReports } from "../../services/research.service";

import {
    DashboardShell, KpiGrid, StatCard, ChartCard, InfoPanel, EmptyBox, ProgressBar,
    toNumber, pickArray, unwrapSummary,
    CHART_TOOLTIP_STYLE, CHART_GRID_PROPS, CHART_AXIS_TICK, PIE_COLORS,
} from "./DashboardWidgets";

/* ─── Custom Tooltip ─────────────────────────────────────────── */
const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-xl border border-slate-200 bg-white/95 backdrop-blur-sm px-4 py-3 shadow-xl text-sm">
            <p className="font-bold text-slate-700 mb-2">{label}</p>
            {payload.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: p.stroke ?? p.fill }} />
                    <span className="text-slate-500">{p.name}:</span>
                    <span className="font-semibold text-slate-800">{p.value?.toLocaleString?.("es-PE") ?? p.value}</span>
                </div>
            ))}
        </div>
    );
};

/* ─── Alert Banner ───────────────────────────────────────────── */
const AlertBanner = ({ icon: Icon, message, onAction, variant = "rose" }) => {
    const styles = {
        rose: { wrap: "border-rose-200/70 from-rose-50 via-pink-50/40 to-rose-50", icon: "bg-rose-100 text-rose-700", text: "text-rose-900", btn: "bg-rose-600 hover:bg-rose-700 text-white" },
        amber: { wrap: "border-amber-200/70 from-amber-50 via-orange-50/40 to-amber-50", icon: "bg-amber-100 text-amber-700", text: "text-amber-900", btn: "bg-amber-600 hover:bg-amber-700 text-white" },
    }[variant];
    return (
        <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 bg-gradient-to-r ${styles.wrap}`}>
            <div className={`h-8 w-8 rounded-lg grid place-items-center shrink-0 ${styles.icon}`}>
                <Icon size={15} />
            </div>
            <p className={`flex-1 text-sm font-semibold ${styles.text}`}>{message}</p>
            {onAction && (
                <button
                    onClick={onAction}
                    className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${styles.btn}`}
                >
                    Revisar
                </button>
            )}
        </div>
    );
};

/* ─── MINEDU Status Panel ────────────────────────────────────── */
const MineduPanel = ({ loading: L, kpis }) => (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50/50 to-white">
            <div className="h-8 w-8 rounded-lg bg-blue-100 grid place-items-center">
                <HardDrive size={15} className="text-blue-600" />
            </div>
            <div>
                <h3 className="font-bold text-slate-800 text-sm leading-none">Conector MINEDU</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Estado de exportaciones</p>
            </div>
        </div>
        <div className="p-5 space-y-4">
            {/* Cola principal */}
            <div className="flex items-center justify-between rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50/40 p-4">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400">En cola</p>
                    <p className="text-3xl font-black text-blue-800 tabular-nums mt-0.5">{L ? "…" : kpis.minPending}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-blue-100/60 grid place-items-center">
                    <Activity size={22} className="text-blue-500" />
                </div>
            </div>
            {/* OK / Error */}
            <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col items-center rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 text-center gap-0.5">
                    <CheckCircle2 size={14} className="text-emerald-500 mb-1" />
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Exitosas</p>
                    <p className="text-2xl font-black text-emerald-700 tabular-nums">{L ? "–" : kpis.minSuccess}</p>
                </div>
                <div className="flex flex-col items-center rounded-xl border border-rose-100 bg-rose-50/40 p-3 text-center gap-0.5">
                    <XCircle size={14} className="text-rose-500 mb-1" />
                    <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600">Con error</p>
                    <p className="text-2xl font-black text-rose-700 tabular-nums">{L ? "–" : kpis.minFailed}</p>
                </div>
            </div>
            {/* Tasa de éxito */}
            <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>Tasa de éxito</span>
                    <span className="text-blue-600 font-bold">
                        {kpis.minSuccess + kpis.minFailed > 0
                            ? `${Math.round((kpis.minSuccess / (kpis.minSuccess + kpis.minFailed)) * 100)}%`
                            : "–"}
                    </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-700"
                        style={{
                            width: kpis.minSuccess + kpis.minFailed > 0
                                ? `${Math.round((kpis.minSuccess / (kpis.minSuccess + kpis.minFailed)) * 100)}%`
                                : "0%"
                        }}
                    />
                </div>
            </div>
        </div>
    </div>
);

/* ─── Academic Summary Panel ─────────────────────────────────── */
const AcademicSummaryPanel = ({ loading: L, kpis }) => {
    const items = [
        { label: "Estudiantes activos", value: L ? "…" : kpis.students, color: "text-emerald-700" },
        { label: "Secciones abiertas", value: L ? "…" : kpis.sections, color: "text-indigo-700" },
        { label: "Asistencia promedio", value: L ? "…" : `${kpis.attendance}%`, color: "text-blue-700" },
        { label: "Promedio de notas", value: L ? "…" : toNumber(kpis.avgGrade).toFixed(2), color: "text-violet-700" },
    ];
    return (
        <div className="xl:col-span-2 rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50/50 to-white">
                <div className="h-8 w-8 rounded-lg bg-emerald-100 grid place-items-center">
                    <GraduationCap size={15} className="text-emerald-600" />
                </div>
                <div>
                    <h3 className="font-bold text-slate-800 text-sm leading-none">Resumen Académico</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Indicadores del periodo actual</p>
                </div>
            </div>
            <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
                {items.map(({ label, value, color }) => (
                    <div key={label} className="flex flex-col items-center justify-center rounded-xl border border-slate-100 bg-gradient-to-b from-white to-slate-50/60 p-4 text-center gap-1">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
                        <p className={`text-2xl font-black tabular-nums mt-0.5 ${color}`}>{value}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

/* ─── Module Card ────────────────────────────────────────────── */
const ModuleCard = ({ icon: Icon, label, path, colorClasses, stat, loading, navigate }) => (
    <button
        onClick={() => navigate(path)}
        className={`group flex flex-col items-center gap-2.5 rounded-2xl border p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:scale-95 ${colorClasses}`}
    >
        <div className="h-10 w-10 rounded-xl grid place-items-center bg-white/70 shadow-sm border border-white/80">
            <Icon size={20} />
        </div>
        <span className="text-xs font-bold text-center leading-tight">{label}</span>
        {stat !== undefined && (
            <span className="text-[10px] font-semibold opacity-70 tabular-nums">{loading ? "…" : stat}</span>
        )}
    </button>
);

/* ─── Main Component ─────────────────────────────────────────── */
export default function AdminDashboard() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const [data, setData] = useState({
        admission: null, academic: null, finance: null,
        mpv: null, minedu: null, research: null, users: null,
    });

    const load = async () => {
        setLoading(true); setErr("");
        try {
            const results = await Promise.allSettled([
                getAdmissionDashboardStats(), AcademicReports.summary(), FinSvc.stats(),
                ProcedureReports.summary(), MineduStats.dashboard(), ResearchReports.summary({}),
                UsersService.list({ page: 1, page_size: 1 }),
            ]);
            const [admission, academic, finance, mpv, minedu, research, users] = results;
            results.forEach((r, i) => { if (r.status === "rejected") console.warn("AdminDash fail:", i, r.reason); });
            setData({
                admission: admission.status === "fulfilled" ? admission.value : null,
                academic: academic.status === "fulfilled" ? academic.value : null,
                finance: finance.status === "fulfilled" ? finance.value : null,
                mpv: mpv.status === "fulfilled" ? mpv.value : null,
                minedu: minedu.status === "fulfilled" ? minedu.value : null,
                research: research.status === "fulfilled" ? research.value : null,
                users: users.status === "fulfilled" ? users.value : null,
            });
            if (results.every(r => r.status === "rejected")) setErr("No se pudieron cargar estadísticas.");
        } catch (e) { setErr(e?.message || "Error"); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const ac = useMemo(() => unwrapSummary(data.academic), [data.academic]);

    const kpis = useMemo(() => {
        const adm = data.admission || {};
        const a = ac || {};
        const finRoot = data.finance || {};
        const f = finRoot?.stats ?? finRoot;
        const mpv = data.mpv?.dashboard ?? data.mpv ?? {};
        const min = data.minedu?.stats ?? data.minedu ?? {};
        const res = data.research || {};
        const usr = data.users || {};
        return {
            apps: toNumber(adm.total_applications ?? adm.applications ?? adm.total),
            openCalls: toNumber(adm.calls_open ?? adm.open_calls),
            students: toNumber(a.students ?? a.total_students),
            sections: toNumber(a.sections ?? a.total_sections),
            attendance: toNumber(a.attendance_rate ?? a.avg_attendance ?? 0),
            avgGrade: toNumber(a.avg_grade ?? 0),
            incomeToday: toNumber(f.income_today ?? f.cash_today_amount ?? 0),
            cashBalance: toNumber(f.cash_balance ?? f.balance ?? 0),
            pendingReceipts: toNumber(f.pending_receipts ?? f.pending ?? 0),
            procTotal: toNumber(mpv.total ?? mpv.total_procedures ?? 0),
            procOpen: toNumber(mpv.open ?? mpv.pending ?? 0),
            sla: toNumber(mpv.sla_breached ?? mpv.overdue ?? 0),
            users: toNumber(usr.count ?? usr.total ?? 0),
            minPending: toNumber(min.pending_exports ?? min.pending ?? 0),
            minSuccess: toNumber(min.completed_exports ?? min.success ?? 0),
            minFailed: toNumber(min.failed_exports ?? min.failed ?? 0),
            minRate: toNumber(min.success_rate ?? 0),
            resProjects: toNumber(res.projects ?? res.total ?? 0),
            resActive: toNumber(res.active ?? res.in_progress ?? 0),
        };
    }, [data, ac]);

    const admByCareer = useMemo(() =>
        pickArray(data.admission || {}, ["by_career", "careers", "career_stats"])
            .map(x => ({ name: x.name ?? x.career_name ?? "", value: toNumber(x.value ?? x.total ?? x.applications ?? 0) }))
            .filter(x => x.name),
        [data.admission]);

    const finTrend = useMemo(() => {
        const r = data.finance || {};
        const f = r?.stats ?? r;
        return (
            pickArray(f, ["trend", "income_trend", "daily_income", "series"]) ||
            pickArray(r, ["trend", "income_trend", "daily_income", "series"])
        ).map(x => ({ date: x.date ?? x.day ?? "", value: toNumber(x.value ?? x.amount ?? 0) }))
            .filter(x => x.date);
    }, [data.finance]);

    const mpvStatus = useMemo(() => {
        const md = data.mpv?.dashboard ?? data.mpv ?? {};
        const arr = pickArray(md, ["by_status", "status"])
            .map(x => ({ name: x.name ?? x.status ?? "", value: toNumber(x.value ?? x.count ?? 0) }))
            .filter(x => x.value > 0);
        if (arr.length > 0) return arr;
        const fb = [];
        if (kpis.procOpen) fb.push({ name: "Pendientes", value: kpis.procOpen });
        const closed = toNumber(md.closed ?? md.resolved ?? 0);
        if (closed) fb.push({ name: "Resueltos", value: closed });
        return fb;
    }, [data.mpv, kpis]);

    const L = loading;
    const fmt = v => `S/ ${toNumber(v).toLocaleString("es-PE")}`;

    const modules = [
        { icon: GraduationCap, label: "Académico", path: "/dashboard/academic", colorClasses: "text-emerald-700 bg-emerald-50 border-emerald-200 hover:border-emerald-300", stat: `${kpis.students} est.` },
        { icon: Activity, label: "Admisión", path: "/dashboard/admission", colorClasses: "text-indigo-700 bg-indigo-50 border-indigo-200 hover:border-indigo-300", stat: `${kpis.openCalls} conv.` },
        { icon: Wallet, label: "Finanzas", path: "/dashboard/finance", colorClasses: "text-amber-700 bg-amber-50 border-amber-200 hover:border-amber-300", stat: fmt(kpis.incomeToday) },
        { icon: ClipboardList, label: "Mesa de Partes", path: "/dashboard/procedures", colorClasses: "text-rose-700 bg-rose-50 border-rose-200 hover:border-rose-300", stat: `${kpis.procOpen} pend.` },
        { icon: HardDrive, label: "MINEDU", path: "/dashboard/minedu", colorClasses: "text-blue-700 bg-blue-50 border-blue-200 hover:border-blue-300", stat: `${kpis.minPending} cola` },
        { icon: Microscope, label: "Investigación", path: "/dashboard/research", colorClasses: "text-violet-700 bg-violet-50 border-violet-200 hover:border-violet-300", stat: `${kpis.resActive} activos` },
        { icon: Users, label: "Usuarios", path: "/dashboard/admin", colorClasses: "text-slate-700 bg-slate-50 border-slate-200 hover:border-slate-300", stat: `${kpis.users} totales` },
        { icon: ShieldCheck, label: "Seguridad", path: "/dashboard/security", colorClasses: "text-cyan-700 bg-cyan-50 border-cyan-200 hover:border-cyan-300", stat: "" },
    ];

    return (
        <DashboardShell
            title="Dashboard Administrador"
            subtitle="Vista global de todos los módulos del sistema"
            loading={loading}
            error={err}
            onRefresh={load}
        >
            {/* ── Alertas activas ── */}
            {!L && (kpis.sla > 0 || kpis.minFailed > 0) && (
                <div className="flex flex-col sm:flex-row gap-3">
                    {kpis.sla > 0 && (
                        <AlertBanner
                            icon={AlertTriangle}
                            variant="rose"
                            message={`${kpis.sla} trámite${kpis.sla > 1 ? "s" : ""} con SLA vencido`}
                            onAction={() => navigate("/dashboard/procedures")}
                        />
                    )}
                    {kpis.minFailed > 0 && (
                        <AlertBanner
                            icon={HardDrive}
                            variant="amber"
                            message={`${kpis.minFailed} exportación${kpis.minFailed > 1 ? "es" : ""} MINEDU fallida${kpis.minFailed > 1 ? "s" : ""}`}
                            onAction={() => navigate("/dashboard/minedu")}
                        />
                    )}
                </div>
            )}

            {/* ── KPI fila 1 ── */}
            <KpiGrid cols={4}>
                <StatCard icon={Activity} title="Postulaciones" value={L ? "…" : kpis.apps} hint={L ? "" : `${kpis.openCalls} convocatorias activas`} tone="indigo" />
                <StatCard icon={GraduationCap} title="Estudiantes" value={L ? "…" : kpis.students} hint={L ? "" : `${kpis.sections} secciones · ${kpis.attendance}% asist.`} tone="emerald" />
                <StatCard icon={Wallet} title="Ingresos Hoy" value={L ? "…" : fmt(kpis.incomeToday)} hint={L ? "" : `Caja: ${fmt(kpis.cashBalance)}`} tone="amber" />
                <StatCard icon={ClipboardList} title="Mesa de Partes" value={L ? "…" : `${kpis.procTotal} trámites`} hint={L ? "" : `Pend: ${kpis.procOpen} · SLA: ${kpis.sla}`} tone="rose" />
            </KpiGrid>

            {/* ── KPI fila 2 ── */}
            <KpiGrid cols={4}>
                <StatCard icon={Users} title="Usuarios" value={L ? "…" : kpis.users} tone="slate" />
                <StatCard icon={HardDrive} title="MINEDU" value={L ? "…" : `${kpis.minPending} en cola`} hint={L ? "" : `OK: ${kpis.minSuccess} · Error: ${kpis.minFailed}`} tone="blue" />
                <StatCard icon={Microscope} title="Investigación" value={L ? "…" : `${kpis.resProjects} proyectos`} hint={L ? "" : `Activos: ${kpis.resActive}`} tone="violet" />
                <StatCard icon={ShieldCheck} title="Prom. Notas" value={L ? "…" : toNumber(kpis.avgGrade).toFixed(2)} hint="Sistema académico" tone="cyan" />
            </KpiGrid>

            {/* ── Gráficos ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">

                {/* Admisión por carrera */}
                <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
                        <div className="h-2 w-2 rounded-full bg-indigo-500 ring-4 ring-indigo-50" />
                        <h3 className="font-bold text-slate-800 text-sm">Admisión por Carrera</h3>
                    </div>
                    <div className="p-5 h-64">
                        {admByCareer.length >= 1 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={admByCareer} margin={{ top: 8, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#94a3b8", fontWeight: 600 }} interval={0} height={56} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc", radius: 4 }} />
                                    <Bar dataKey="value" name="Postulaciones" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={32} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <EmptyBox title="Sin postulaciones" subtitle="No hay datos para mostrar" />
                        )}
                    </div>
                </div>

                {/* Tendencia de ingresos */}
                <div className="xl:col-span-2 rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
                        <div className="h-2 w-2 rounded-full bg-purple-500 ring-4 ring-purple-50" />
                        <h3 className="font-bold text-slate-800 text-sm">Tendencia de Ingresos</h3>
                    </div>
                    <div className="p-5 h-64">
                        {finTrend.length >= 2 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={finTrend} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.18} />
                                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} dy={8} />
                                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} width={60} axisLine={false} tickLine={false} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Area
                                        type="monotone" dataKey="value" name="Ingresos (S/)"
                                        stroke="#8b5cf6" strokeWidth={2.5}
                                        fill="url(#incomeGrad)"
                                        dot={{ r: 3.5, strokeWidth: 2, fill: "#fff", stroke: "#8b5cf6" }}
                                        activeDot={{ r: 5, strokeWidth: 0, fill: "#8b5cf6" }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <EmptyBox title="Sin tendencia" subtitle="Faltan datos históricos de ingresos" />
                        )}
                    </div>
                </div>

                {/* Mesa de partes: estado */}
                <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
                        <div className="h-2 w-2 rounded-full bg-rose-500 ring-4 ring-rose-50" />
                        <h3 className="font-bold text-slate-800 text-sm">Mesa de Partes: Estado</h3>
                    </div>
                    <div className="p-5 h-64">
                        {mpvStatus.length >= 1 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend
                                        verticalAlign="bottom" height={36} iconType="circle" iconSize={8}
                                        wrapperStyle={{ fontSize: "11px", color: "#64748b" }}
                                    />
                                    <Pie
                                        data={mpvStatus} dataKey="value" nameKey="name"
                                        cx="50%" cy="44%" innerRadius={52} outerRadius={80}
                                        paddingAngle={4} cornerRadius={6}
                                    >
                                        {mpvStatus.map((_, i) => (
                                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="none" />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <EmptyBox title="Sin trámites" subtitle="" />
                        )}
                    </div>
                </div>

                {/* MINEDU Panel */}
                <MineduPanel loading={L} kpis={kpis} />

                {/* Resumen académico */}
                <AcademicSummaryPanel loading={L} kpis={kpis} />
            </div>

            {/* ── Módulos del sistema ── */}
            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
                    <div className="h-8 w-8 rounded-lg bg-slate-100 grid place-items-center">
                        <Zap size={15} className="text-slate-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 text-sm leading-none">Módulos del Sistema</h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">Acceso rápido a todos los módulos</p>
                    </div>
                </div>
                <div className="p-5">
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                        {modules.map(({ icon, label, path, colorClasses, stat }) => (
                            <ModuleCard
                                key={label}
                                icon={icon}
                                label={label}
                                path={path}
                                colorClasses={colorClasses}
                                stat={stat}
                                loading={L}
                                navigate={navigate}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </DashboardShell>
    );
}