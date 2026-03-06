// src/pages/dashboards/TeacherDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    ResponsiveContainer, BarChart, Bar, LineChart, Line,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import {
    BookOpen, Users, CheckCircle2, Clock, FileEdit,
    Calendar, ClipboardCheck, Upload, ChevronRight, BarChart3,
    AlertTriangle, Send, Eye, MapPin, UserCheck, ArrowRight, Zap,
} from "lucide-react";

import { TeacherDashboardSvc as TeacherSvc } from "../../services/dashboard.service";
import {
    DashboardShell, KpiGrid, StatCard, ChartCard, EmptyBox,
    toNumber, pickArray,
    CHART_TOOLTIP_STYLE, CHART_GRID_PROPS, CHART_AXIS_TICK,
} from "./DashboardWidgets";

/* ─── Greeting ───────────────────────────────────────────────── */
const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
};

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
                    <span className="font-semibold text-slate-800">{p.value}</span>
                </div>
            ))}
        </div>
    );
};

/* ─── Alert Banner ───────────────────────────────────────────── */
const TeacherAlert = ({ icon: Icon, variant, message, sub, action, onAction }) => {
    const v = {
        amber: { wrap: "border-amber-200/70 from-amber-50 via-orange-50/30 to-amber-50", icon: "bg-amber-100 text-amber-700", text: "text-amber-900", sub: "text-amber-600", btn: "bg-amber-600 hover:bg-amber-700 text-white" },
        rose: { wrap: "border-rose-200/70 from-rose-50 via-pink-50/30 to-rose-50", icon: "bg-rose-100 text-rose-700", text: "text-rose-900", sub: "text-rose-600", btn: "bg-rose-600 hover:bg-rose-700 text-white" },
    }[variant];
    return (
        <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 bg-gradient-to-r ${v.wrap}`}>
            <div className={`h-9 w-9 rounded-xl grid place-items-center shrink-0 ${v.icon}`}>
                <Icon size={16} />
            </div>
            <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold ${v.text}`}>{message}</p>
                {sub && <p className={`text-xs mt-0.5 ${v.sub}`}>{sub}</p>}
            </div>
            {action && (
                <button onClick={onAction} className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${v.btn}`}>
                    {action}
                </button>
            )}
        </div>
    );
};

/* ─── Today Class Item ───────────────────────────────────────── */
const ClassItem = ({ cls, index }) => {
    const time = cls.time ?? cls.hora ?? cls.start ?? "";
    const end = cls.end ?? cls.hora_fin ?? "";
    const room = cls.room ?? cls.aula ?? "";
    const name = cls.name ?? cls.course ?? cls.materia ?? "Curso";
    const code = cls.section ?? cls.code ?? "";
    const count = toNumber(cls.students ?? cls.enrolled ?? 0);

    return (
        <div
            className="relative flex items-start gap-4 pl-2"
            style={{ animationDelay: `${index * 60}ms` }}
        >
            {/* Timeline dot */}
            <div className="relative z-10 h-10 w-10 rounded-xl grid place-items-center shrink-0 border bg-violet-50 border-violet-200 text-violet-600">
                <Clock size={16} />
            </div>
            {/* Card */}
            <div className="flex-1 rounded-xl border border-slate-100 bg-white p-4 hover:border-violet-200 hover:bg-violet-50/20 hover:shadow-sm transition-all duration-200">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800 leading-tight">{name}</p>
                        <div className="flex flex-wrap items-center gap-3 mt-1.5">
                            {(time || end) && (
                                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                    <Clock size={10} className="shrink-0" />
                                    {[time, end].filter(Boolean).join(" – ")}
                                </span>
                            )}
                            {room && (
                                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                    <MapPin size={10} className="shrink-0" />{room}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="text-right shrink-0">
                        <p className="text-sm font-black text-slate-700 tabular-nums">{count}</p>
                        <p className="text-[10px] text-slate-400 font-medium">alumnos</p>
                        {code && <p className="text-[10px] text-slate-300 mt-0.5">{code}</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ─── Quick Action ───────────────────────────────────────────── */
const QuickAction = ({ icon: Icon, label, path, accent, navigate }) => {
    const accents = {
        blue: "hover:bg-blue-50   hover:border-blue-200   hover:text-blue-700   [&:hover_.qa-i]:bg-blue-100   [&:hover_.qa-i]:text-blue-600",
        emerald: "hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 [&:hover_.qa-i]:bg-emerald-100 [&:hover_.qa-i]:text-emerald-600",
        violet: "hover:bg-violet-50  hover:border-violet-200  hover:text-violet-700  [&:hover_.qa-i]:bg-violet-100  [&:hover_.qa-i]:text-violet-600",
        indigo: "hover:bg-indigo-50  hover:border-indigo-200  hover:text-indigo-700  [&:hover_.qa-i]:bg-indigo-100  [&:hover_.qa-i]:text-indigo-600",
        rose: "hover:bg-rose-50    hover:border-rose-200    hover:text-rose-700    [&:hover_.qa-i]:bg-rose-100    [&:hover_.qa-i]:text-rose-600",
    };
    return (
        <button
            onClick={() => navigate(path)}
            className={`group flex items-center gap-3 w-full rounded-xl border border-slate-200 bg-white p-3.5 text-left text-slate-600 font-semibold text-sm transition-all duration-200 active:scale-[0.98] ${accents[accent] ?? ""}`}
        >
            <div className="qa-i h-8 w-8 rounded-lg bg-slate-100 grid place-items-center transition-colors border border-transparent">
                <Icon size={15} className="text-slate-500 transition-colors" />
            </div>
            <span className="flex-1">{label}</span>
            <ArrowRight size={13} className="text-slate-300 group-hover:translate-x-0.5 transition-transform" />
        </button>
    );
};

/* ─── Section Card ───────────────────────────────────────────── */
const SectionCard = ({ sec, navigate }) => {
    const hasGradesPending = toNumber(sec.grades_pending ?? 0) > 0;
    const attRate = toNumber(sec.attendance ?? sec.attendance_rate ?? 100);
    const hasAttIssue = attRate < 70;
    const name = sec.name ?? sec.course_name ?? sec.code ?? "Sección";
    const code = sec.code ?? sec.section_code ?? "";

    return (
        <div
            className="group rounded-2xl border border-slate-100 bg-white p-5 hover:border-indigo-200 hover:shadow-md transition-all duration-300 cursor-pointer"
            onClick={() => navigate("/dashboard/academic")}
        >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div className="min-w-0">
                    <p className="font-bold text-slate-800 text-sm truncate leading-tight">{name}</p>
                    {code && <p className="text-[11px] text-slate-400 mt-0.5 font-medium">{code}</p>}
                </div>
                <ChevronRight size={14} className="text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5" />
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-100">
                <div className="text-center">
                    <p className="text-lg font-black text-slate-800 tabular-nums leading-none">
                        {toNumber(sec.students ?? sec.enrolled ?? 0)}
                    </p>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Alum.</p>
                </div>
                <div className="text-center">
                    <p className={`text-lg font-black tabular-nums leading-none ${hasAttIssue ? "text-rose-600" : "text-emerald-700"}`}>
                        {attRate}%
                    </p>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Asist.</p>
                </div>
                <div className="text-center">
                    <p className={`text-lg font-black leading-none ${hasGradesPending ? "text-amber-600" : "text-emerald-600"}`}>
                        {hasGradesPending ? sec.grades_pending : "✓"}
                    </p>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Notas</p>
                </div>
            </div>

            {/* Status badges */}
            <div className="flex gap-1.5 mt-3 flex-wrap">
                {sec.syllabus_uploaded && (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                        Sílabo ✓
                    </span>
                )}
                {hasGradesPending && (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                        Notas pend.
                    </span>
                )}
                {hasAttIssue && (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                        Asist. baja
                    </span>
                )}
                {!hasGradesPending && !hasAttIssue && (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Al día ✓
                    </span>
                )}
            </div>
        </div>
    );
};

/* ─── Main Component ─────────────────────────────────────────── */
export default function TeacherDashboard({ user }) {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const [data, setData] = useState({ dashboard: null, sections: null, schedule: null });

    const load = async () => {
        setLoading(true); setErr("");
        try {
            const results = await Promise.allSettled([
                TeacherSvc.overview(), TeacherSvc.sections(), TeacherSvc.scheduleToday(),
            ]);
            const [dashboard, sections, schedule] = results;
            results.forEach((r, i) => { if (r.status === "rejected") console.warn("TeacherDash fail:", i, r.reason); });
            setData({
                dashboard: dashboard.status === "fulfilled" ? dashboard.value : null,
                sections: sections.status === "fulfilled" ? sections.value : null,
                schedule: schedule.status === "fulfilled" ? schedule.value : null,
            });
            if (results.every(r => r.status === "rejected")) setErr("No se pudieron cargar tus datos.");
        } catch (e) { setErr(e?.message || "Error"); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const kpis = useMemo(() => {
        const d = data.dashboard || {};
        const sArr = pickArray(data.sections, ["sections", "results", "data", "items"]);
        return {
            totalSections: toNumber(d.total_sections ?? d.sections_count ?? sArr.length ?? 0),
            totalStudents: toNumber(d.total_students ?? d.students_count ?? 0),
            attendanceToday: toNumber(d.attendance_today ?? d.today_attendance ?? 0),
            gradesPending: toNumber(d.grades_pending ?? d.pending_grades ?? 0),
            syllabusUploaded: toNumber(d.syllabus_uploaded ?? d.syllabus_count ?? 0),
            syllabusTotal: toNumber(d.syllabus_total ?? d.total_sections ?? sArr.length ?? 0),
            actsToClose: toNumber(d.acts_pending ?? d.pending_acts ?? 0),
            avgGrade: toNumber(d.avg_grade ?? d.average_grade ?? 0),
        };
    }, [data]);

    const sectionsList = useMemo(() =>
        pickArray(data.sections || {}, ["sections", "results", "data", "items"]).slice(0, 8),
        [data.sections]);

    const sectionStudents = useMemo(() =>
        sectionsList
            .map(x => ({
                name: (x.name ?? x.course_name ?? x.code ?? "").substring(0, 20),
                estudiantes: toNumber(x.students ?? x.enrolled ?? 0),
                asistencia: toNumber(x.attendance ?? x.attendance_rate ?? 0),
            }))
            .filter(x => x.name),
        [sectionsList]);

    const attendanceTrend = useMemo(() =>
        pickArray(data.dashboard || {}, ["attendance_trend", "trend", "weekly_attendance", "daily_attendance"])
            .map(x => ({ date: x.date ?? x.day ?? x.label ?? "", asistencia: toNumber(x.value ?? x.rate ?? x.attendance ?? 0) }))
            .filter(x => x.date),
        [data.dashboard]);

    const todayClasses = useMemo(() => {
        const s = data.schedule || {};
        const arr = pickArray(s, ["classes", "schedule", "today", "items"]);
        return (arr.length > 0 ? arr : Array.isArray(s) ? s : []).slice(0, 6);
    }, [data.schedule]);

    const L = loading;
    const firstName = user?.first_name || user?.full_name?.split(" ")[0] || "Docente";
    const syllabusPct = kpis.syllabusTotal > 0 ? (kpis.syllabusUploaded / kpis.syllabusTotal) * 100 : 0;

    return (
        <DashboardShell
            title={`${greeting()}, Prof. ${firstName}`}
            subtitle="Resumen de secciones · Asistencia · Calificaciones"
            loading={loading} error={err} onRefresh={load}
        >
            {/* ── Alertas ── */}
            {!L && (kpis.gradesPending > 0 || kpis.actsToClose > 0) && (
                <div className="flex flex-col sm:flex-row gap-3">
                    {kpis.gradesPending > 0 && (
                        <TeacherAlert
                            icon={FileEdit} variant="amber"
                            message={`${kpis.gradesPending} registro${kpis.gradesPending > 1 ? "s" : ""} de notas pendiente${kpis.gradesPending > 1 ? "s" : ""}`}
                            sub="Por completar y enviar a secretaría"
                            action="Ir ahora"
                            onAction={() => navigate("/dashboard/academic/attendance")}
                        />
                    )}
                    {kpis.actsToClose > 0 && (
                        <TeacherAlert
                            icon={AlertTriangle} variant="rose"
                            message={`${kpis.actsToClose} acta${kpis.actsToClose > 1 ? "s" : ""} por cerrar`}
                        />
                    )}
                </div>
            )}

            {/* ── KPIs ── */}
            <KpiGrid cols={4}>
                <StatCard icon={BookOpen} title="Mis Secciones" value={L ? "…" : kpis.totalSections} hint="Periodo actual" tone="indigo" />
                <StatCard icon={Users} title="Total Alumnos" value={L ? "…" : kpis.totalStudents} hint="En todas mis secciones" tone="emerald" />
                <StatCard icon={UserCheck} title="Asistencia Hoy" value={L ? "…" : `${kpis.attendanceToday}%`} hint="Promedio del día" tone="blue" />
                <StatCard icon={FileEdit} title="Notas Pendientes" value={L ? "…" : kpis.gradesPending} hint={kpis.gradesPending > 0 ? "Por registrar y enviar" : "Al día ✓"} tone={kpis.gradesPending > 0 ? "amber" : "emerald"} />
            </KpiGrid>

            {/* ── Clases de hoy + Acciones ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                {/* Timeline clases */}
                <div className="lg:col-span-2 rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-violet-50/40 to-white">
                        <div className="h-8 w-8 rounded-lg bg-violet-100 grid place-items-center">
                            <Calendar size={15} className="text-violet-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 text-sm leading-none">Clases de Hoy</h3>
                            {todayClasses.length > 0 && (
                                <p className="text-[11px] text-slate-400 mt-0.5">{todayClasses.length} clase{todayClasses.length > 1 ? "s" : ""} programada{todayClasses.length > 1 ? "s" : ""}</p>
                            )}
                        </div>
                    </div>
                    <div className="p-5">
                        {todayClasses.length > 0 ? (
                            <div className="relative">
                                {/* Timeline line */}
                                <div className="absolute left-[23px] top-5 bottom-5 w-0.5 bg-slate-100 z-0" />
                                <div className="space-y-3 relative">
                                    {todayClasses.map((cls, i) => (
                                        <ClassItem key={i} cls={cls} index={i} />
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="py-10 flex flex-col items-center gap-3 text-center">
                                <div className="h-14 w-14 rounded-2xl bg-slate-100 grid place-items-center">
                                    <Calendar size={24} className="text-slate-300" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-400">Sin clases programadas hoy</p>
                                    <p className="text-xs text-slate-300 mt-0.5">Disfruta tu día libre</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Acciones + sílabos */}
                <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden flex flex-col">
                    <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
                        <div className="h-8 w-8 rounded-lg bg-slate-100 grid place-items-center">
                            <Zap size={15} className="text-slate-600" />
                        </div>
                        <h3 className="font-bold text-slate-800 text-sm">Acciones Rápidas</h3>
                    </div>
                    <div className="p-4 space-y-2 flex-1">
                        <QuickAction icon={ClipboardCheck} label="Registrar asistencia" path="/dashboard/academic/attendance" accent="blue" navigate={navigate} />
                        <QuickAction icon={FileEdit} label="Ingresar calificaciones" path="/dashboard/academic/attendance" accent="emerald" navigate={navigate} />
                        <QuickAction icon={Upload} label="Subir sílabo" path="/dashboard/academic" accent="violet" navigate={navigate} />
                        <QuickAction icon={Eye} label="Ver mis secciones" path="/dashboard/academic" accent="indigo" navigate={navigate} />
                        <QuickAction icon={Send} label="Enviar notas a secretaría" path="/dashboard/academic/attendance" accent="rose" navigate={navigate} />
                    </div>

                    {/* Estado sílabos */}
                    <div className="mx-4 mb-4 mt-1 rounded-xl bg-gradient-to-br from-violet-50 to-indigo-50/50 border border-violet-100/60 p-4">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-violet-400">Sílabos subidos</p>
                            <span className="text-xs font-black text-violet-700 tabular-nums">
                                {kpis.syllabusUploaded}/{kpis.syllabusTotal}
                            </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-white/60 overflow-hidden">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-400 transition-all duration-700"
                                style={{ width: `${L ? 0 : Math.min(100, syllabusPct)}%` }}
                            />
                        </div>
                        <p className="text-[10px] text-violet-400 mt-1.5 tabular-nums">
                            {L ? "…" : `${Math.round(syllabusPct)}% completado`}
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Gráficos ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">

                {/* Alumnos por sección */}
                <div className="xl:col-span-2 rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
                        <div className="h-2 w-2 rounded-full bg-indigo-500 ring-4 ring-indigo-50" />
                        <h3 className="font-bold text-slate-800 text-sm">Alumnos por Sección</h3>
                    </div>
                    <div className="p-5 h-72">
                        {sectionStudents.length >= 1 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={sectionStudents} margin={{ top: 8, right: 16, left: -14, bottom: 0 }} barGap={4}>
                                    <CartesianGrid vertical={false} stroke="#f1f5f9" />
                                    <XAxis
                                        dataKey="name"
                                        tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 600 }}
                                        interval={0} height={64} angle={-22} textAnchor="end"
                                        axisLine={false} tickLine={false}
                                    />
                                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc", radius: 4 }} />
                                    <Legend
                                        iconType="circle" iconSize={8}
                                        wrapperStyle={{ fontSize: "11px", color: "#64748b", paddingTop: "10px" }}
                                    />
                                    <Bar dataKey="estudiantes" name="Estudiantes" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={28} />
                                    <Bar dataKey="asistencia" name="Asist. %" fill="#a78bfa" radius={[6, 6, 0, 0]} maxBarSize={28} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <EmptyBox title="Sin secciones" subtitle="No hay secciones asignadas" icon={BookOpen} />
                        )}
                    </div>
                </div>

                {/* Tendencia asistencia */}
                <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
                        <div className="h-2 w-2 rounded-full bg-blue-500 ring-4 ring-blue-50" />
                        <h3 className="font-bold text-slate-800 text-sm">Tendencia de Asistencia</h3>
                    </div>
                    <div className="p-5 h-72">
                        {attendanceTrend.length >= 2 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={attendanceTrend} margin={{ top: 8, right: 16, left: -14, bottom: 0 }}>
                                    <CartesianGrid vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} dy={8} />
                                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Line
                                        type="monotone" dataKey="asistencia" name="Asistencia %"
                                        stroke="#3b82f6" strokeWidth={2.5}
                                        dot={{ r: 3.5, fill: "#fff", strokeWidth: 2, stroke: "#3b82f6" }}
                                        activeDot={{ r: 5, strokeWidth: 0, fill: "#3b82f6" }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <EmptyBox title="Sin datos" subtitle="Se necesitan datos históricos" icon={BarChart3} />
                        )}
                    </div>
                </div>
            </div>

            {/* ── Mis secciones detalle ── */}
            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-100 grid place-items-center">
                            <BookOpen size={15} className="text-indigo-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 text-sm leading-none">Mis Secciones — Detalle</h3>
                            <p className="text-[11px] text-slate-400 mt-0.5">{sectionsList.length} secciones asignadas</p>
                        </div>
                    </div>
                    {kpis.avgGrade > 0 && (
                        <div className="text-right">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Promedio general</p>
                            <p className={`text-xl font-black tabular-nums ${kpis.avgGrade >= 14 ? "text-emerald-700" : kpis.avgGrade >= 11 ? "text-amber-700" : "text-rose-700"}`}>
                                {toNumber(kpis.avgGrade).toFixed(2)}
                            </p>
                        </div>
                    )}
                </div>
                <div className="p-5">
                    {sectionsList.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {sectionsList.map((sec, i) => (
                                <SectionCard key={i} sec={sec} navigate={navigate} />
                            ))}
                        </div>
                    ) : (
                        <EmptyBox title="Sin secciones asignadas" subtitle="No se encontraron secciones para este periodo" icon={BookOpen} />
                    )}
                </div>
            </div>
        </DashboardShell>
    );
}