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

    useEffect(() => {
        let alive = true;

        (async () => {
            setLoading(true);
            setErr("");

            try {
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
                    // truco: pedir poco pero obtener "count" si hay paginación
                    UsersService.list({ page: 1, page_size: 1 }),
                ]);

                if (!alive) return;

                setData({
                    admission: admission.status === "fulfilled" ? admission.value : null,
                    academic: academic.status === "fulfilled" ? academic.value : null,
                    finance: finance.status === "fulfilled" ? finance.value : null,
                    mpv: mpv.status === "fulfilled" ? mpv.value : null,
                    minedu: minedu.status === "fulfilled" ? minedu.value : null,
                    research: research.status === "fulfilled" ? research.value : null,
                    users: users.status === "fulfilled" ? users.value : null,
                });

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
                if (!alive) return;
                setErr(e?.message || "Error cargando dashboard");
            } finally {
                if (!alive) return;
                setLoading(false);
            }
        })();

        return () => {
            alive = false;
        };
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
        <div className="p-6 bg-slate-50 min-h-[calc(100vh-64px)]">
            <div className="flex items-end justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-black text-slate-900">
                        Dashboard Principal
                    </h1>
                    <p className="text-slate-600 mt-1">
                        Stats y gráficos para ver cómo va el sistema (sin adivinar como brujo).
                    </p>
                </div>

                <button
                    onClick={() => window.location.reload()}
                    className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 transition font-bold text-slate-700 shadow-sm"
                    title="Recargar datos"
                >
                    <TrendingUp size={18} />
                    Actualizar
                </button>
            </div>

            {err ? (
                <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700 flex items-start gap-3">
                    <AlertTriangle className="mt-0.5" size={18} />
                    <div>
                        <p className="font-extrabold">Error</p>
                        <p className="text-sm">{err}</p>
                    </div>
                </div>
            ) : null}

            {/* KPI Cards (fila 1) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard
                    icon={Activity}
                    title="Postulaciones (Admisión)"
                    value={loading ? "..." : kpis.totalApplications}
                    hint={loading ? "" : `Convocatorias activas: ${kpis.openCalls}`}
                    tone="indigo"
                />
                <StatCard
                    icon={GraduationCap}
                    title="Académico"
                    value={loading ? "..." : `${kpis.students} estudiantes`}
                    hint={
                        loading
                            ? ""
                            : `${kpis.sections} secciones • Asistencia: ${kpis.attendanceRate || 0}% • Prom.: ${kpis.avgGrade || 0
                            }`
                    }
                    tone="emerald"
                />
                <StatCard
                    icon={Wallet}
                    title="Finanzas"
                    value={loading ? "..." : `S/ ${kpis.incomeToday.toLocaleString("es-PE")}`}
                    hint={
                        loading
                            ? ""
                            : `Pendientes: ${kpis.pendingReceipts} • Caja: S/ ${kpis.cashBalance.toLocaleString("es-PE")}`
                    }
                    tone="amber"
                />
                <StatCard
                    icon={ClipboardList}
                    title="Mesa de Partes"
                    value={loading ? "..." : `${kpis.proceduresTotal} trámites`}
                    hint={
                        loading
                            ? ""
                            : `Abiertos: ${kpis.proceduresOpen} • SLA vencido: ${kpis.slaBreached}`
                    }
                    tone="rose"
                />
            </div>

            {/* KPI Cards (fila 2) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
                <StatCard
                    icon={Users}
                    title="Usuarios"
                    value={loading ? "..." : kpis.totalUsers}
                    hint="Total registrados"
                    tone="slate"
                />
                <StatCard
                    icon={HardDrive}
                    title="MINEDU"
                    value={loading ? "..." : `${kpis.mineduPending} en cola`}
                    hint={loading ? "" : `OK: ${kpis.mineduSuccess} • Fallidos: ${kpis.mineduFailed}`}
                    tone="indigo"
                />
                <StatCard
                    icon={Microscope}
                    title="Investigación"
                    value={loading ? "..." : `${kpis.researchProjects} proyectos`}
                    hint={loading ? "" : `Activos: ${kpis.researchActive}`}
                    tone="emerald"
                />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-6">
                {/* Bar: Admisión por carrera */}
                <div className="xl:col-span-1 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <p className="font-black text-slate-900">
                            Admisión: Postulaciones por carrera
                        </p>
                        <span className="text-xs font-bold text-slate-500">Top / Distribución</span>
                    </div>

                    {admissionByCareer.length >= 2 ? (
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={admissionByCareer}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis
                                        dataKey="name"
                                        tick={{ fontSize: 11 }}
                                        interval={0}
                                        height={60}
                                    />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Bar
                                        dataKey="value"
                                        name="Postulaciones"
                                        fill="#4f46e5"
                                        radius={[10, 10, 0, 0]}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <EmptyBox
                            title="Sin serie suficiente"
                            subtitle="Cuando tu endpoint de admisión devuelva by_career (o similar), acá aparecerá el gráfico."
                        />
                    )}
                </div>

                {/* Line: Finanzas trend */}
                <div className="xl:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <p className="font-black text-slate-900">
                            Finanzas: Ingresos (tendencia)
                        </p>
                        <span className="text-xs font-bold text-slate-500">Día a día</span>
                    </div>

                    {financeTrend.length >= 2 ? (
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={financeTrend}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Line
                                        type="monotone"
                                        dataKey="value"
                                        name="Ingresos"
                                        stroke="#7c3aed"
                                        strokeWidth={3}
                                        dot={false}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <EmptyBox
                            title="Sin tendencia"
                            subtitle="Cuando tu endpoint de finanzas devuelva income_trend (o series), acá verás la línea."
                        />
                    )}
                </div>

                {/* Pie: Mesa de Partes */}
                <div className="xl:col-span-1 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <p className="font-black text-slate-900">Mesa de Partes: Estados</p>
                        <span className="text-xs font-bold text-slate-500">Distribución</span>
                    </div>

                    {mpvStatus.length >= 1 ? (
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Tooltip />
                                    <Legend />
                                    <Pie
                                        data={mpvStatus}
                                        dataKey="value"
                                        nameKey="name"
                                        innerRadius={55}
                                        outerRadius={95}
                                        paddingAngle={3}
                                    >
                                        {mpvStatus.map((_, i) => (
                                            <Cell key={i} fill={pieColors[i % pieColors.length]} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <EmptyBox
                            title="Sin estados"
                            subtitle="Cuando procedures/reports/summary devuelva by_status, este gráfico queda automático."
                        />
                    )}
                </div>

                {/* Mini panel académico */}
                <div className="xl:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="font-black text-slate-900 mb-2">
                        Académico: Resumen rápido
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Estudiantes
                            </p>
                            <p className="text-2xl font-black text-slate-900 mt-1">
                                {loading ? "..." : kpis.students}
                            </p>
                        </div>

                        <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Secciones
                            </p>
                            <p className="text-2xl font-black text-slate-900 mt-1">
                                {loading ? "..." : kpis.sections}
                            </p>
                        </div>

                        <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Asistencia Prom.
                            </p>
                            <p className="text-2xl font-black text-slate-900 mt-1">
                                {loading ? "..." : `${kpis.attendanceRate || 0}%`}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                                (si tu backend manda attendance_rate)
                            </p>
                        </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600 bg-white">
                        Tip: si quieres gráfico académico real, agrega en{" "}
                        <b>/academic/reports/summary</b> una serie tipo{" "}
                        <code className="px-1 py-0.5 bg-slate-100 rounded">
                            trend: [{"{ date, value }"}]
                        </code>{" "}
                        (asistencia o promedio).
                    </div>
                </div>

                {/* Panel MINEDU (simple) */}
                <div className="xl:col-span-1 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="font-black text-slate-900 mb-2">MINEDU: Resumen</p>

                    <div className="space-y-3">
                        <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                En cola
                            </p>
                            <p className="text-2xl font-black text-slate-900 mt-1">
                                {loading ? "..." : kpis.mineduPending}
                            </p>
                        </div>

                        <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                OK / Fallidos
                            </p>
                            <p className="text-lg font-black text-slate-900 mt-1">
                                {loading ? "..." : `${kpis.mineduSuccess} / ${kpis.mineduFailed}`}
                            </p>
                        </div>

                        <div className="text-xs text-slate-500">
                            Cuando me pases el JSON real de <b>/minedu/dashboard/stats</b>, te meto pie/bar por estado.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
