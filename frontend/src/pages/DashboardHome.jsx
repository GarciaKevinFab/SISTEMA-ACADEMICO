import React, { useEffect, useMemo, useState } from "react";
import {
    ResponsiveContainer,
    LineChart,
    Line,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    
} from "recharts";
import {
    Activity,
    GraduationCap,
    Wallet,
    ClipboardList,
    TrendingUp,
    AlertTriangle,
    HardDrive,
    Microscope,
    Users,
    Info
} from "lucide-react";

import { AcademicReports } from "../services/academic.service";
import { getAdmissionDashboardStats } from "../services/admission.service";
import { FinanceDashboard } from "../services/finance.service";
import { ProcedureReports } from "../services/mesaPartes.service";

import { Stats as MineduStats } from "../services/minedu.service";
import { UsersService } from "../services/users.service";

// ✅ CAMBIA ESTE IMPORT según tu archivo real
// Ejemplo si tu archivo se llama: src/services/research.service.js
import { Reports as ResearchReports } from "../services/research.service";

// Helpers defensivos (para que no explote si el backend cambia)
const toNumber = (v, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
};

const pickArray = (obj, keys = []) => {
    if (Array.isArray(obj)) return obj;
    for (const k of keys) {
        if (Array.isArray(obj?.[k])) return obj[k];
    }
    return [];
};

const EmptyBox = ({ title, subtitle }) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="font-bold text-slate-900">{title}</p>
        <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
    </div>
);

const StatCard = ({ icon: Icon, title, value, hint, tone = "indigo" }) => {
    const tones = {
        indigo: "bg-indigo-50 text-indigo-700 border-indigo-100",
        emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
        amber: "bg-amber-50 text-amber-700 border-amber-100",
        rose: "bg-rose-50 text-rose-700 border-rose-100",
        slate: "bg-slate-50 text-slate-700 border-slate-100",
    };

    return (
        <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
            <div className="p-5 flex items-start gap-4">
                <div
                    className={`h-11 w-11 rounded-xl grid place-items-center border ${tones[tone] || tones.indigo
                        }`}
                >
                    <Icon size={20} />
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-500">{title}</p>
                    <p className="text-2xl font-black text-slate-900 mt-1 truncate">
                        {value}
                    </p>
                    {hint ? <p className="text-xs text-slate-500 mt-1">{hint}</p> : null}
                </div>
            </div>
        </div>
    );
};

export default function DashboardHome() {
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const [data, setData] = useState({
        admission: null,
        academic: null,
        finance: null,
        mpv: null,
        minedu: null,
        research: null,
        users: null,
    });

    // --- NUEVA LÓGICA DE CARGA REUTILIZABLE ---
    const loadDashboardData = async () => {
        setLoading(true);
        setErr("");

        try {
            // Hacemos todas las peticiones de nuevo
            const [
                admission,
                academic,
                finance,
                mpv,
                minedu,
                research,
                users,
            ] = await Promise.allSettled([
                getAdmissionDashboardStats(),
                AcademicReports.summary(),
                FinanceDashboard.stats(),
                ProcedureReports.summary(),
                MineduStats.dashboard(),
                ResearchReports.summary({}),
                UsersService.list({ page: 1, page_size: 1 }),
            ]);

            // Guardamos los datos en el estado
            setData({
                admission: admission.status === "fulfilled" ? admission.value : null,
                academic: academic.status === "fulfilled" ? academic.value : null,
                finance: finance.status === "fulfilled" ? finance.value : null,
                mpv: mpv.status === "fulfilled" ? mpv.value : null,
                minedu: minedu.status === "fulfilled" ? minedu.value : null,
                research: research.status === "fulfilled" ? research.value : null,
                users: users.status === "fulfilled" ? users.value : null,
            });

            // Verificamos si todo falló
            const allFailed =
                admission.status === "rejected" &&
                academic.status === "rejected" &&
                finance.status === "rejected" &&
                mpv.status === "rejected" &&
                minedu.status === "rejected" &&
                research.status === "rejected" &&
                users.status === "rejected";

            if (allFailed) {
                setErr("No se pudieron cargar estadísticas. Revisa conexión y endpoints.");
            }
        } catch (e) {
            setErr(e?.message || "Error cargando dashboard");
        } finally {
            setLoading(false);
        }
    };

    // Usamos useEffect solo para llamar a la función al iniciar
    useEffect(() => {
        loadDashboardData();
    }, []);

    // --- Normalización de KPI (para no depender 100% del shape del backend) ---
    const kpis = useMemo(() => {
        const admission = data.admission || {};
        const academic = data.academic || {};
        const finance = data.finance || {};
        const mpv = data.mpv || {};
        const minedu = data.minedu || {};
        const research = data.research || {};
        const users = data.users || {};

        // Admisión
        const totalApplications = toNumber(
            admission.total_applications ??
            admission.applications_total ??
            admission.applications ??
            admission.total
        );
        const openCalls = toNumber(
            admission.calls_open ?? admission.open_calls ?? admission.active_calls
        );

        // Académico
        const students = toNumber(
            academic.students ?? academic.total_students ?? academic.count_students
        );
        const sections = toNumber(
            academic.sections ?? academic.total_sections ?? academic.count_sections
        );
        const attendanceRate = toNumber(
            academic.attendance_rate ?? academic.avg_attendance ?? 0
        );
        const avgGrade = toNumber(academic.avg_grade ?? academic.average_grade ?? 0);

        // Finanzas
        const incomeToday = toNumber(
            finance.income_today ?? finance.today_income ?? finance.today ?? 0
        );
        const pendingReceipts = toNumber(
            finance.pending_receipts ?? finance.receipts_pending ?? finance.pending ?? 0
        );
        const cashBalance = toNumber(
            finance.cash_balance ?? finance.balance ?? finance.total_balance ?? 0
        );

        // Mesa de Partes
        const proceduresTotal = toNumber(
            mpv.total ?? mpv.total_procedures ?? mpv.count ?? 0
        );
        const proceduresOpen = toNumber(
            mpv.open ?? mpv.pending ?? mpv.in_progress ?? 0
        );
        const slaBreached = toNumber(
            mpv.sla_breached ?? mpv.breached ?? mpv.overdue ?? 0
        );

        // Users (depende de paginación: count / total / results)
        const totalUsers = toNumber(
            users.count ??
            users.total ??
            users.total_users ??
            (Array.isArray(users) ? users.length : 0)
        );

        // MINEDU
        const mineduPending = toNumber(
            minedu.pending ?? minedu.pending_exports ?? minedu.queue ?? 0
        );
        const mineduSuccess = toNumber(
            minedu.success ?? minedu.completed ?? minedu.done ?? 0
        );
        const mineduFailed = toNumber(minedu.failed ?? minedu.errors ?? 0);

        // Research
        const researchProjects = toNumber(
            research.projects ?? research.total_projects ?? research.total ?? 0
        );
        const researchActive = toNumber(
            research.active ?? research.in_progress ?? research.ongoing ?? 0
        );

        return {
            totalApplications,
            openCalls,
            students,
            sections,
            attendanceRate,
            avgGrade,
            incomeToday,
            pendingReceipts,
            cashBalance,
            proceduresTotal,
            proceduresOpen,
            slaBreached,
            totalUsers,
            mineduPending,
            mineduSuccess,
            mineduFailed,
            researchProjects,
            researchActive,
        };
    }, [data]);

    // --- Series para gráficos (si el backend las trae) ---
    const admissionByCareer = useMemo(() => {
        const a = data.admission || {};
        const arr = pickArray(a, [
            "by_career",
            "careers",
            "career_stats",
            "applications_by_career",
        ]);
        return arr
            .map((x) => ({
                name:
                    x.name ??
                    x.career_name ??
                    x.title ??
                    `Carrera ${x.id ?? x.career_id ?? ""}`.trim(),
                value: toNumber(x.value ?? x.total ?? x.applications ?? x.count ?? 0),
            }))
            .filter((x) => x.name && Number.isFinite(x.value));
    }, [data.admission]);

    const financeTrend = useMemo(() => {
        const f = data.finance || {};
        const arr = pickArray(f, ["trend", "income_trend", "daily_income", "series"]);
        return arr
            .map((x) => ({
                date: x.date ?? x.day ?? x.label ?? "",
                value: toNumber(x.value ?? x.amount ?? x.total ?? 0),
            }))
            .filter((x) => x.date);
    }, [data.finance]);

    const mpvStatus = useMemo(() => {
        const m = data.mpv || {};
        const arr = pickArray(m, ["by_status", "status", "status_summary"]);

        const normalized = arr
            .map((x) => ({
                name: x.name ?? x.status ?? x.label ?? "Estado",
                value: toNumber(x.value ?? x.count ?? x.total ?? 0),
            }))
            .filter((x) => x.value > 0);

        if (normalized.length > 0) return normalized;

        const open = toNumber(m.open ?? m.pending ?? m.in_progress ?? 0);
        const closed = toNumber(m.closed ?? m.resolved ?? m.done ?? 0);
        const total = toNumber(m.total ?? 0);

        const fallback = [];
        if (open) fallback.push({ name: "Pendientes", value: open });
        if (closed) fallback.push({ name: "Resueltos", value: closed });
        if (!open && !closed && total) fallback.push({ name: "Total", value: total });
        return fallback;
    }, [data.mpv]);

    const pieColors = [
        "#4f46e5",
        "#7c3aed",
        "#0891b2",
        "#16a34a",
        "#f59e0b",
        "#ef4444",
    ];

    return (
    /* 1. SCROLL FIX: Altura calculada con fondo suave */
    <div className="h-[calc(100vh-64px)] overflow-y-auto bg-slate-50/70 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
        
        <div className="p-6 lg:p-10 max-w-[1920px] mx-auto space-y-8">

            {/* HEADER: Más limpio y con mejor tipografía */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 border-b border-slate-200/60 pb-6">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900">
                        Dashboard Principal
                    </h1>
                    <p className="text-base text-slate-500 mt-2 font-medium">
                        Visión general de estadísticas y métricas del sistema.
                    </p>
                </div>

                <button
        onClick={loadDashboardData} // <--- AQUÍ ESTÁ EL CAMBIO MÁGICO
        className="group inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 hover:shadow-md active:scale-95 transition-all duration-200 font-bold text-slate-600 shadow-sm w-full sm:w-auto"
    >
        <TrendingUp size={18} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
        Actualizar
    </button>
            </div>

            {/* ERROR */}
            {err && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4 text-rose-700 flex items-start gap-4 shadow-sm animate-in fade-in slide-in-from-top-2">
                    <div className="p-2 bg-rose-100 rounded-full shrink-0">
                        <AlertTriangle className="text-rose-600" size={20} />
                    </div>
                    <div>
                        <p className="font-extrabold text-lg">Error detectado</p>
                        <p className="text-sm font-medium opacity-90">{err}</p>
                    </div>
                </div>
            )}

            {/* KPI CARDS - FILA 1 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    icon={Activity}
                    title="Postulaciones"
                    value={loading ? "..." : kpis.totalApplications}
                    hint={loading ? "" : `Convocatorias activas: ${kpis.openCalls}`}
                    tone="indigo"
                />
                <StatCard
                    icon={GraduationCap}
                    title="Académico"
                    value={loading ? "..." : `${kpis.students} estudiantes`}
                    hint={loading ? "" : `${kpis.sections} secciones • ${kpis.attendanceRate}% asis.`}
                    tone="emerald"
                />
                <StatCard
                    icon={Wallet}
                    title="Finanzas"
                    value={loading ? "..." : `S/ ${kpis.incomeToday.toLocaleString("es-PE")}`}
                    hint={loading ? "" : `Caja Total: S/ ${kpis.cashBalance.toLocaleString("es-PE")}`}
                    tone="amber"
                />
                <StatCard
                    icon={ClipboardList}
                    title="Mesa de Partes"
                    value={loading ? "..." : `${kpis.proceduresTotal} trámites`}
                    hint={loading ? "" : `Pendientes de atención: ${kpis.proceduresOpen}`}
                    tone="rose"
                />
            </div>

            {/* KPI CARDS - FILA 2 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatCard
                    icon={Users}
                    title="Usuarios Totales"
                    value={loading ? "..." : kpis.totalUsers}
                    hint="Registrados en plataforma"
                    tone="slate"
                />
                <StatCard
                    icon={HardDrive}
                    title="MINEDU (Cola)"
                    value={loading ? "..." : `${kpis.mineduPending} pendientes`}
                    hint={loading ? "" : `Enviados OK: ${kpis.mineduSuccess} • Errores: ${kpis.mineduFailed}`}
                    tone="blue"
                />
                <StatCard
                    icon={Microscope}
                    title="Investigación"
                    value={loading ? "..." : `${kpis.researchProjects} proyectos`}
                    hint={loading ? "" : `En ejecución: ${kpis.researchActive}`}
                    tone="cyan"
                />
            </div>

            {/* GRÁFICOS Y PANELES INFERIORES */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                
                {/* Gráfico 1: Barras */}
                <div className="xl:col-span-1 rounded-3xl border border-slate-200/60 bg-white p-6 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] hover:shadow-lg transition-shadow duration-300 min-h-[400px] flex flex-col">
                    <div className="mb-6 flex items-center justify-between">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
                            <span className="w-1.5 h-6 bg-indigo-500 rounded-full"></span>
                            Admisión: Por carrera
                        </h3>
                    </div>
                    <div className="flex-1 min-h-0 w-full">
                        {admissionByCareer.length >= 1 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={admissionByCareer} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis 
                                        dataKey="name" 
                                        tick={{ fontSize: 10, fill: '#64748b' }} 
                                        interval={0} 
                                        height={60} 
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis 
                                        tick={{ fontSize: 10, fill: '#64748b' }} 
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        cursor={{ fill: '#f8fafc' }}
                                    />
                                    <Bar 
                                        dataKey="value" 
                                        name="Postulaciones" 
                                        fill="#6366f1" 
                                        radius={[6, 6, 0, 0]} 
                                        barSize={32}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <EmptyBox title="Sin datos" subtitle="No hay postulaciones registradas" />
                        )}
                    </div>
                </div>

                {/* Gráfico 2: Líneas */}
                <div className="xl:col-span-2 rounded-3xl border border-slate-200/60 bg-white p-6 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] hover:shadow-lg transition-shadow duration-300 min-h-[400px] flex flex-col">
                    <div className="mb-6">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
                            <span className="w-1.5 h-6 bg-purple-500 rounded-full"></span>
                            Finanzas: Tendencia de Ingresos
                        </h3>
                    </div>
                    <div className="flex-1 min-h-0 w-full">
                        {financeTrend.length >= 2 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={financeTrend} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis 
                                        dataKey="date" 
                                        tick={{ fontSize: 12, fill: '#64748b' }} 
                                        axisLine={false}
                                        tickLine={false}
                                        dy={10}
                                    />
                                    <YAxis 
                                        tick={{ fontSize: 12, fill: '#64748b' }} 
                                        width={50} 
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                                    <Line 
                                        type="monotone" 
                                        dataKey="value" 
                                        name="Ingresos (S/)" 
                                        stroke="#8b5cf6" 
                                        strokeWidth={3} 
                                        dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                                        activeDot={{ r: 7, strokeWidth: 0 }} 
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <EmptyBox title="Sin tendencia" subtitle="Faltan datos históricos para generar la curva" />
                        )}
                    </div>
                </div>

                {/* Gráfico 3: Pastel */}
                <div className="xl:col-span-1 rounded-3xl border border-slate-200/60 bg-white p-6 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] hover:shadow-lg transition-shadow duration-300 min-h-[400px] flex flex-col">
                    <div className="mb-6">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
                            <span className="w-1.5 h-6 bg-rose-500 rounded-full"></span>
                            Mesa de Partes: Estado
                        </h3>
                    </div>
                    <div className="flex-1 min-h-0 w-full relative">
                        {mpvStatus.length >= 1 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend 
                                        verticalAlign="bottom" 
                                        height={36} 
                                        iconType="circle"
                                        formatter={(value) => <span className="text-slate-600 font-medium ml-1">{value}</span>}
                                    />
                                    <Pie
                                        data={mpvStatus}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={90}
                                        paddingAngle={5}
                                        cornerRadius={6}
                                    >
                                        {mpvStatus.map((_, i) => (
                                            <Cell key={i} fill={pieColors[i % pieColors.length]} stroke="none" />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <EmptyBox title="Sin trámites" subtitle="No hay datos para mostrar" />
                        )}
                    </div>
                </div>

                {/* PANEL ACADÉMICO */}
                <div className="xl:col-span-2 rounded-3xl border border-slate-200/60 bg-white p-6 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)]">
                    <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2 text-lg">
                        <GraduationCap size={20} className="text-emerald-500" />
                        Resumen Académico
                    </h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="group rounded-2xl border border-slate-100 p-5 bg-slate-50/50 hover:bg-white hover:border-emerald-200 hover:shadow-md transition-all duration-300">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider group-hover:text-emerald-600 transition-colors">Estudiantes</p>
                            <p className="text-3xl font-black text-slate-900 mt-2">{loading ? "..." : kpis.students}</p>
                        </div>
                        <div className="group rounded-2xl border border-slate-100 p-5 bg-slate-50/50 hover:bg-white hover:border-emerald-200 hover:shadow-md transition-all duration-300">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider group-hover:text-emerald-600 transition-colors">Secciones</p>
                            <p className="text-3xl font-black text-slate-900 mt-2">{loading ? "..." : kpis.sections}</p>
                        </div>
                        <div className="group rounded-2xl border border-slate-100 p-5 bg-slate-50/50 hover:bg-white hover:border-emerald-200 hover:shadow-md transition-all duration-300">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider group-hover:text-emerald-600 transition-colors">Tasa Asistencia</p>
                            <p className="text-3xl font-black text-slate-900 mt-2">{loading ? "..." : `${kpis.attendanceRate}%`}</p>
                        </div>
                    </div>

                    <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-4 flex items-center gap-3 bg-slate-50/30">
                        <div className="p-2 bg-slate-100 rounded-full text-slate-500">
                            <Info size={16} />
                        </div>
                        <p className="text-sm text-slate-500 font-medium">
                            <code className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-slate-700 font-mono text-xs">
                                </code><code className="font-bold"></code>.
                        </p>
                    </div>
                </div>

                {/* PANEL MINEDU */}
                <div className="xl:col-span-1 rounded-3xl border border-slate-200/60 bg-white p-6 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)]">
                    <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2 text-lg">
                        <HardDrive size={20} className="text-blue-500" />
                        Conector MINEDU
                    </h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between rounded-2xl border border-slate-100 p-5 bg-slate-50/50">
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">En cola de envío</p>
                                <p className="text-3xl font-black text-slate-900">
                                    {loading ? "..." : kpis.mineduPending}
                                </p>
                            </div>
                            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                <Activity size={20} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/30 p-4 text-center">
                                <p className="text-xs font-bold text-emerald-600 uppercase mb-1">Exitosos</p>
                                <p className="text-xl font-black text-emerald-700">{loading ? "-" : kpis.mineduSuccess}</p>
                            </div>
                            <div className="rounded-2xl border border-rose-100 bg-rose-50/30 p-4 text-center">
                                <p className="text-xs font-bold text-rose-600 uppercase mb-1">Fallidos</p>
                                <p className="text-xl font-black text-rose-700">{loading ? "-" : kpis.mineduFailed}</p>
                            </div>
                        </div>

                        <div className="pt-2 text-center">
                            <p className="text-xs text-slate-400 font-medium">
                                Datos sincronizados en tiempo real  <b></b>
                            </p>
                        </div>
                    </div>
                </div>

            </div>

            {/* Espacio extra al final */}
            <div className="h-12"></div>
        </div>
    </div>
);
}
