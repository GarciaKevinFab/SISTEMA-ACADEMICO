// src/pages/dashboards/AcademicDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import {
    GraduationCap, Users, BookOpen, FileCheck, AlertCircle,
    Layers, Award, ClipboardList, BarChart3, AlertTriangle,
    ChevronRight, Calendar, CheckCircle, XCircle, Clock,
    TrendingUp, Zap, ArrowRight,
} from "lucide-react";

import { AcademicReports } from "../../services/academic.service";
import { AcademicDashboardSvc } from "../../services/dashboard.service";
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
                    <span className="h-2 w-2 rounded-full" style={{ background: p.fill }} />
                    <span className="text-slate-500">{p.name}:</span>
                    <span className="font-semibold text-slate-800">{p.value}</span>
                </div>
            ))}
        </div>
    );
};

/* ─── Alert Banner ───────────────────────────────────────────── */
const AlertBanner = ({ icon: Icon, message, action, onAction, variant = "amber" }) => {
    const styles = {
        amber: {
            wrap: "border-amber-200/70 bg-gradient-to-r from-amber-50 via-orange-50/50 to-amber-50",
            icon: "bg-amber-100 text-amber-700",
            text: "text-amber-900",
            btn: "bg-amber-600 hover:bg-amber-700 text-white",
        },
        rose: {
            wrap: "border-rose-200/70 bg-gradient-to-r from-rose-50 via-pink-50/50 to-rose-50",
            icon: "bg-rose-100 text-rose-700",
            text: "text-rose-900",
            btn: "bg-rose-600 hover:bg-rose-700 text-white",
        },
    }[variant];
    return (
        <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 ${styles.wrap}`}>
            <div className={`h-8 w-8 rounded-lg grid place-items-center shrink-0 ${styles.icon}`}>
                <Icon size={16} />
            </div>
            <p className={`flex-1 text-sm font-semibold ${styles.text}`}>{message}</p>
            {action && (
                <button
                    onClick={onAction}
                    className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${styles.btn}`}
                >
                    {action}
                </button>
            )}
        </div>
    );
};

/* ─── Metric Mini Card ───────────────────────────────────────── */
const MetricCell = ({ label, value, sub, color = "text-slate-800" }) => (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-100 bg-gradient-to-b from-white to-slate-50/60 p-5 text-center gap-1 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
        <p className={`text-3xl font-black tabular-nums mt-0.5 ${color}`}>{value}</p>
        {sub && <p className="text-[11px] text-slate-400 font-medium">{sub}</p>}
    </div>
);

/* ─── Act Row ────────────────────────────────────────────────── */
const ActRow = ({ act, index }) => (
    <div
        className="group flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3.5 hover:border-amber-200 hover:bg-amber-50/40 transition-all duration-200 cursor-pointer"
        style={{ animationDelay: `${index * 60}ms` }}
    >
        <div className="h-9 w-9 rounded-xl bg-amber-50 border border-amber-100 grid place-items-center shrink-0 group-hover:bg-amber-100 transition-colors">
            <Clock size={15} className="text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-700 truncate leading-tight">
                {act.name ?? act.course ?? act.section ?? "Acta sin nombre"}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                {[act.code ?? act.section_code, act.teacher].filter(Boolean).join(" · ")}
            </p>
        </div>
        <div className="text-right shrink-0">
            <p className="text-xs font-bold text-slate-600">
                {toNumber(act.students ?? act.count ?? 0)} alum.
            </p>
            {(act.period ?? act.semester) && (
                <p className="text-[10px] text-slate-400 mt-0.5">{act.period ?? act.semester}</p>
            )}
        </div>
        <ChevronRight size={14} className="text-slate-300 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all shrink-0" />
    </div>
);

/* ─── Quick Action Button ────────────────────────────────────── */
const QuickAction = ({ icon: Icon, label, path, accent, navigate }) => {
    const accents = {
        emerald: "hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 [&:hover_svg]:text-emerald-500",
        indigo: "hover:bg-indigo-50  hover:border-indigo-200  hover:text-indigo-700  [&:hover_svg]:text-indigo-500",
        blue: "hover:bg-blue-50    hover:border-blue-200    hover:text-blue-700    [&:hover_svg]:text-blue-500",
        amber: "hover:bg-amber-50   hover:border-amber-200   hover:text-amber-700   [&:hover_svg]:text-amber-500",
    };
    return (
        <button
            onClick={() => navigate(path)}
            className={`group flex items-center gap-3 w-full rounded-xl border border-slate-200 bg-white p-3.5 text-left text-slate-600 font-semibold text-sm transition-all duration-200 active:scale-[0.98] ${accents[accent]}`}
        >
            <div className="h-8 w-8 rounded-lg bg-slate-100 grid place-items-center group-hover:bg-white transition-colors border border-transparent group-hover:border-current/10">
                <Icon size={16} className="text-slate-500 transition-colors" />
            </div>
            <span className="flex-1">{label}</span>
            <ArrowRight size={14} className="text-slate-300 group-hover:translate-x-0.5 transition-transform" />
        </button>
    );
};

/* ─── Main Component ─────────────────────────────────────────── */
export default function AcademicDashboard({ user, roles }) {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const [data, setData] = useState({ summary: null, enrollment: null, acts: null, conflicts: null });

    const load = async () => {
        setLoading(true); setErr("");
        try {
            const results = await Promise.allSettled([
                AcademicReports.summary(), AcademicDashboardSvc.enrollmentStats(),
                AcademicDashboardSvc.actsPending(), AcademicDashboardSvc.conflicts(),
            ]);
            const [summary, enrollment, acts, conflicts] = results;
            setData({
                summary: summary.status === "fulfilled" ? summary.value : null,
                enrollment: enrollment.status === "fulfilled" ? enrollment.value : null,
                acts: acts.status === "fulfilled" ? acts.value : null,
                conflicts: conflicts.status === "fulfilled" ? conflicts.value : null,
            });
            if (results.every(r => r.status === "rejected"))
                setErr("No se pudieron cargar los datos académicos.");
        } catch (e) { setErr(e?.message || "Error"); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const raw = useMemo(() => unwrapSummary(data.summary), [data.summary]);

    const kpis = useMemo(() => {
        const s = raw || {}; const e = data.enrollment || {};
        const a = data.acts || {}; const c = data.conflicts || {};
        return {
            students: toNumber(s.students ?? s.total_students ?? 0),
            sections: toNumber(s.sections ?? s.total_sections ?? 0),
            teachers: toNumber(s.teachers ?? s.total_teachers ?? 0),
            plans: toNumber(s.plans ?? s.curricula ?? 0),
            attendance: toNumber(s.attendance_rate ?? 0),
            avgGrade: toNumber(s.avg_grade ?? 0),
            approvalRate: toNumber(s.approval_rate ?? s.pass_rate ?? 0),
            enrolledTotal: toNumber(e.enrolled ?? e.total_enrolled ?? 0),
            enrollmentCapacity: toNumber(e.capacity ?? e.total_capacity ?? 0),
            enrollmentRate: toNumber(e.rate ?? e.enrollment_rate ?? 0),
            actsPending: toNumber(a.pending ?? a.total_pending ?? (Array.isArray(a) ? a.length : 0)),
            actsClosed: toNumber(a.closed ?? a.total_closed ?? 0),
            conflicts: toNumber(c.total ?? c.count ?? (Array.isArray(c) ? c.length : 0)),
        };
    }, [raw, data]);

    const enrollmentByCareer = useMemo(() =>
        pickArray(data.enrollment || {}, ["by_career", "careers", "by_program"])
            .map(x => ({ name: x.name ?? x.career ?? "", matriculados: toNumber(x.enrolled ?? x.count ?? 0), capacidad: toNumber(x.capacity ?? x.max ?? 0) }))
            .filter(x => x.name)
            .slice(0, 8),
        [data.enrollment]);

    const gradeDist = useMemo(() =>
        pickArray(raw || {}, ["grade_distribution", "grades_dist"])
            .map(x => ({ name: x.name ?? x.range ?? "", value: toNumber(x.value ?? x.count ?? 0) }))
            .filter(x => x.value > 0),
        [raw]);

    const actsList = useMemo(() =>
        pickArray(data.acts || {}, ["items", "acts", "results", "data"]).slice(0, 6),
        [data.acts]);

    const conflictsList = useMemo(() =>
        pickArray(data.conflicts || {}, ["items", "conflicts", "results"]).slice(0, 5),
        [data.conflicts]);

    const L = loading;
    const isRegistrar = roles?.includes("REGISTRAR");
    const occupancyPct = kpis.enrollmentCapacity
        ? Math.round((kpis.enrolledTotal / kpis.enrollmentCapacity) * 100)
        : 0;

    return (
        <DashboardShell
            title={isRegistrar ? "Secretaría Académica" : "Gestión Académica"}
            subtitle="Matrícula · Secciones · Actas · Rendimiento"
            loading={loading}
            error={err}
            onRefresh={load}
        >
            {/* ── Alertas activas ── */}
            {!L && (kpis.actsPending > 0 || kpis.conflicts > 0) && (
                <div className="flex flex-col sm:flex-row gap-3">
                    {kpis.actsPending > 0 && (
                        <AlertBanner
                            icon={FileCheck}
                            variant="amber"
                            message={`${kpis.actsPending} acta${kpis.actsPending > 1 ? "s" : ""} pendiente${kpis.actsPending > 1 ? "s" : ""} de cierre`}
                            action="Revisar"
                            onAction={() => navigate("/dashboard/academic")}
                        />
                    )}
                    {kpis.conflicts > 0 && (
                        <AlertBanner
                            icon={AlertTriangle}
                            variant="rose"
                            message={`${kpis.conflicts} conflicto${kpis.conflicts > 1 ? "s" : ""} de horario detectado${kpis.conflicts > 1 ? "s" : ""}`}
                        />
                    )}
                </div>
            )}

            {/* ── KPIs principales ── */}
            <KpiGrid cols={4}>
                <StatCard icon={Users} title="Estudiantes" value={L ? "…" : kpis.students} hint="Activos este periodo" tone="emerald" />
                <StatCard icon={BookOpen} title="Secciones" value={L ? "…" : kpis.sections} hint={`${kpis.teachers} docentes`} tone="indigo" />
                <StatCard icon={BarChart3} title="Asistencia" value={L ? "…" : `${kpis.attendance}%`} hint={`Nota prom: ${toNumber(kpis.avgGrade).toFixed(2)}`} tone="blue" />
                <StatCard icon={FileCheck} title="Actas Pendientes" value={L ? "…" : kpis.actsPending} hint={`Cerradas: ${kpis.actsClosed}`} tone={kpis.actsPending > 0 ? "amber" : "emerald"} />
            </KpiGrid>

            {/* ── Resumen de matrícula ── */}
            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50/50 to-white">
                    <div className="h-8 w-8 rounded-lg bg-indigo-100 grid place-items-center">
                        <ClipboardList size={16} className="text-indigo-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 text-sm leading-none">Matrícula — Periodo Actual</h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">Resumen general de inscripción</p>
                    </div>
                </div>

                {/* Métricas */}
                <div className="p-5">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <MetricCell
                            label="Matriculados"
                            value={L ? "…" : kpis.enrolledTotal}
                            color="text-indigo-700"
                        />
                        <MetricCell
                            label="Capacidad"
                            value={L ? "…" : (kpis.enrollmentCapacity || "—")}
                            color="text-slate-700"
                        />
                        <MetricCell
                            label="Tasa Aprobación"
                            value={L ? "…" : `${kpis.approvalRate}%`}
                            color="text-emerald-700"
                        />
                        <div className="flex flex-col justify-center rounded-2xl border border-slate-100 bg-gradient-to-b from-white to-slate-50/60 p-5 shadow-sm gap-3">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Ocupación</p>
                            <div className="space-y-2">
                                <div className="flex items-end justify-between">
                                    <span className="text-2xl font-black text-slate-800 tabular-nums">
                                        {L ? "…" : `${occupancyPct}%`}
                                    </span>
                                </div>
                                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all duration-700"
                                        style={{ width: `${Math.min(occupancyPct, 100)}%` }}
                                    />
                                </div>
                                <p className="text-[10px] text-slate-400">
                                    {kpis.enrolledTotal} / {kpis.enrollmentCapacity || "—"} plazas
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Gráficos + Actas + Acciones ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">

                {/* Gráfico: Matrícula por carrera */}
                <div className="xl:col-span-2 rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-50" />
                        <h3 className="font-bold text-slate-800 text-sm">Matrícula por Carrera</h3>
                    </div>
                    <div className="p-5 h-72">
                        {enrollmentByCareer.length >= 1 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={enrollmentByCareer} margin={{ top: 8, right: 16, left: -14, bottom: 0 }} barGap={4}>
                                    <CartesianGrid vertical={false} stroke="#f1f5f9" strokeDasharray="0" />
                                    <XAxis
                                        dataKey="name"
                                        tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 600 }}
                                        interval={0} height={64} angle={-22} textAnchor="end"
                                        axisLine={false} tickLine={false}
                                    />
                                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc", radius: 6 }} />
                                    <Legend
                                        iconType="circle" iconSize={8}
                                        wrapperStyle={{ fontSize: "11px", color: "#64748b", paddingTop: "12px" }}
                                    />
                                    <Bar dataKey="matriculados" name="Matriculados" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={28} />
                                    <Bar dataKey="capacidad" name="Capacidad" fill="#e2e8f0" radius={[6, 6, 0, 0]} maxBarSize={28} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <EmptyBox title="Sin datos de matrícula" subtitle="Los datos aparecerán cuando estén disponibles" icon={BarChart3} />
                        )}
                    </div>
                </div>

                {/* Gráfico: Distribución de notas */}
                <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
                        <div className="h-2 w-2 rounded-full bg-violet-500 ring-4 ring-violet-50" />
                        <h3 className="font-bold text-slate-800 text-sm">Distribución de Notas</h3>
                    </div>
                    <div className="p-5 h-72">
                        {gradeDist.length >= 1 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend
                                        verticalAlign="bottom" height={40} iconType="circle" iconSize={8}
                                        wrapperStyle={{ fontSize: "11px", color: "#64748b" }}
                                    />
                                    <Pie
                                        data={gradeDist} dataKey="value" nameKey="name"
                                        cx="50%" cy="45%" innerRadius={52} outerRadius={82}
                                        paddingAngle={4} cornerRadius={6}
                                    >
                                        {gradeDist.map((_, i) => (
                                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="none" />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <EmptyBox title="Sin datos" subtitle="La distribución aparecerá aquí" icon={BarChart3} />
                        )}
                    </div>
                </div>

                {/* Actas pendientes */}
                <div className="xl:col-span-2 rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-amber-50 border border-amber-100 grid place-items-center">
                                <FileCheck size={15} className="text-amber-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 text-sm leading-none">Actas Pendientes de Cierre</h3>
                                {kpis.actsPending > 0 && (
                                    <p className="text-[11px] text-amber-500 font-semibold mt-0.5">
                                        {kpis.actsPending} pendiente{kpis.actsPending > 1 ? "s" : ""}
                                    </p>
                                )}
                            </div>
                        </div>
                        {actsList.length > 0 && (
                            <button
                                onClick={() => navigate("/dashboard/academic")}
                                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors"
                            >
                                Ver todas <ArrowRight size={12} />
                            </button>
                        )}
                    </div>
                    <div className="p-4">
                        {actsList.length > 0 ? (
                            <div className="space-y-2">
                                {actsList.map((act, i) => <ActRow key={i} act={act} index={i} />)}
                            </div>
                        ) : (
                            <div className="py-8">
                                <EmptyBox
                                    title={kpis.actsPending > 0 ? "Cargando actas..." : "Todas las actas cerradas"}
                                    subtitle={kpis.actsPending === 0 ? "No hay actas pendientes en este momento" : ""}
                                    icon={kpis.actsPending === 0 ? CheckCircle : Clock}
                                />
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
                        <QuickAction icon={Layers} label="Gestionar Secciones" path="/dashboard/academic" accent="emerald" navigate={navigate} />
                        <QuickAction icon={ClipboardList} label="Matrícula" path="/dashboard/academic/enrollment" accent="indigo" navigate={navigate} />
                        <QuickAction icon={Award} label="Calificaciones" path="/dashboard/academic/attendance" accent="blue" navigate={navigate} />
                        <QuickAction icon={FileCheck} label="Cerrar Actas" path="/dashboard/academic" accent="amber" navigate={navigate} />
                    </div>

                    {/* Mini stat footer */}
                    <div className="mx-4 mb-4 mt-1 rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100/60 p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 mb-3">Resumen rápido</p>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { label: "Planes", value: L ? "…" : kpis.plans, color: "text-indigo-700" },
                                { label: "Aprobación", value: L ? "…" : `${kpis.approvalRate}%`, color: "text-emerald-700" },
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