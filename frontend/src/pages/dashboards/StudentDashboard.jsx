// src/pages/dashboards/StudentDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    ResponsiveContainer, RadarChart, Radar, PolarGrid,
    PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import {
    BookOpen, GraduationCap, CreditCard, FileText, Calendar,
    Award, Clock, ChevronRight, AlertCircle, Bell,
    CheckCircle, CheckCircle2, XCircle, Download, MapPin, BookMarked,
    BarChart3, Percent, Timer, ArrowRight, Plus, AlertTriangle,
} from "lucide-react";

import { StudentDashboardSvc as StudentSvc } from "../../services/dashboard.service";
import { EnrollmentPayment } from "../../services/academic.service";
import {
    DashboardShell, KpiGrid, StatCard, EmptyBox, toNumber, pickArray,
} from "./DashboardWidgets";

/* ─── Constants ──────────────────────────────────────────────── */
const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DAY_COLORS = {
    "Lunes": "bg-indigo-50  border-indigo-200  text-indigo-700",
    "Martes": "bg-emerald-50 border-emerald-200 text-emerald-700",
    "Miércoles": "bg-violet-50  border-violet-200  text-violet-700",
    "Jueves": "bg-amber-50   border-amber-200   text-amber-700",
    "Viernes": "bg-cyan-50    border-cyan-200    text-cyan-700",
    "Sábado": "bg-pink-50    border-pink-200    text-pink-700",
};

const gradeBadge = (nota) => {
    const n = toNumber(nota);
    if (n >= 17) return { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", pass: true };
    if (n >= 14) return { cls: "bg-blue-50 text-blue-700 border-blue-200", pass: true };
    if (n >= 11) return { cls: "bg-amber-50 text-amber-700 border-amber-200", pass: true };
    return { cls: "bg-rose-50 text-rose-700 border-rose-200", pass: false };
};

const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
};

/* ─── Alert Banner (local, student-specific) ─────────────────── */
const StudentAlert = ({ icon: Icon, variant, message, sub, action, onAction }) => {
    const v = {
        amber: { wrap: "border-amber-200/70 from-amber-50 via-orange-50/30 to-amber-50", icon: "bg-amber-100 text-amber-700", text: "text-amber-900", sub: "text-amber-600", btn: "bg-amber-600 hover:bg-amber-700 text-white" },
        blue: { wrap: "border-blue-200/70 from-blue-50 via-indigo-50/30 to-blue-50", icon: "bg-blue-100 text-blue-700", text: "text-blue-900", sub: "text-blue-600", btn: "bg-blue-600 hover:bg-blue-700 text-white" },
        gold: { wrap: "border-yellow-200/70 from-yellow-50 via-amber-50/30 to-yellow-50", icon: "bg-yellow-100 text-yellow-700", text: "text-yellow-900", sub: "text-yellow-700", btn: "bg-yellow-600 hover:bg-yellow-700 text-white" },
    }[variant] ?? {};
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

/* ─── Circular Progress ──────────────────────────────────────── */
const CircularProgress = ({ pct, label, size = 144 }) => {
    const r = 42;
    const circ = 2 * Math.PI * r;
    const dash = (Math.min(pct, 100) / 100) * circ;
    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r={r} stroke="#e2e8f0" strokeWidth="7" fill="none" />
                <circle
                    cx="50" cy="50" r={r}
                    stroke="url(#progressGrad)" strokeWidth="7" fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${dash} ${circ - dash}`}
                    className="transition-all duration-1000"
                />
                <defs>
                    <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#6366f1" />
                        <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-black text-slate-900 leading-none">{Math.round(pct)}%</span>
                <span className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">{label}</span>
            </div>
        </div>
    );
};

/* ─── Grade Row ──────────────────────────────────────────────── */
const GradeRow = ({ course, index }) => {
    const { cls, pass } = gradeBadge(course.nota);
    return (
        <div
            className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 hover:bg-slate-50/80 hover:border-slate-200 transition-all duration-200"
            style={{ animationDelay: `${index * 40}ms` }}
        >
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-700 truncate leading-tight">{course.name}</p>
                <p className="text-[10px] text-slate-400 mt-0.5 font-medium">{course.credits} créditos</p>
            </div>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-sm font-black shrink-0 ${cls}`}>
                {pass ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                {course.nota.toFixed(1)}
            </span>
        </div>
    );
};

/* ─── Schedule Day Column ────────────────────────────────────── */
const DayColumn = ({ day, classes }) => {
    const colorCls = DAY_COLORS[day] ?? "bg-slate-50 border-slate-200 text-slate-600";
    return (
        <div className="min-w-0">
            <p className={`text-[10px] font-bold uppercase tracking-widest mb-2.5 px-2 py-1.5 rounded-xl text-center border ${colorCls}`}>
                {day}
            </p>
            {classes.length > 0 ? (
                <div className="space-y-2">
                    {classes.map((cls, j) => (
                        <div key={j} className="rounded-xl border border-slate-100 bg-white p-2.5 hover:border-slate-200 hover:shadow-sm transition-all">
                            <p className="text-xs font-bold text-slate-700 truncate leading-tight">
                                {cls.name ?? cls.course ?? cls.materia ?? "Curso"}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
                                <Clock size={9} className="shrink-0" />
                                {cls.time ?? cls.hora ?? cls.start ?? "—"}
                            </p>
                            {(cls.room ?? cls.aula) && (
                                <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                    <MapPin size={9} className="shrink-0" />
                                    {cls.room ?? cls.aula}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/40 p-3 text-center">
                    <p className="text-[10px] text-slate-300 font-semibold">Libre</p>
                </div>
            )}
        </div>
    );
};

/* ─── Procedure Item ─────────────────────────────────────────── */
const ProcedureItem = ({ proc }) => {
    const st = (proc.status ?? proc.estado ?? "").toLowerCase();
    const pending = ["pendiente", "pending", "en_proceso", "in_progress"].includes(st);
    return (
        <div className="rounded-xl border border-slate-100 p-3.5 hover:bg-slate-50/60 transition-colors">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-700 truncate leading-tight">
                        {proc.type ?? proc.tipo ?? proc.name ?? "Trámite"}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                        {[proc.code ?? proc.tracking_code, proc.date].filter(Boolean).join(" · ")}
                    </p>
                </div>
                <span className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full border ${pending ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    }`}>
                    {proc.status ?? proc.estado ?? "—"}
                </span>
            </div>
        </div>
    );
};

/* ─── Payment Item ───────────────────────────────────────────── */
const PaymentItem = ({ pay }) => {
    const paid = ["pagado", "paid", "completed"].includes((pay.status ?? pay.estado ?? "").toLowerCase());
    return (
        <div className="flex items-center gap-3 rounded-xl border border-slate-100 p-3.5 hover:bg-slate-50/60 transition-colors">
            <div className={`h-9 w-9 rounded-xl grid place-items-center shrink-0 border ${paid ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-amber-50 border-amber-100 text-amber-600"
                }`}>
                {paid ? <CheckCircle2 size={15} /> : <Clock size={15} />}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-700 truncate">
                    {pay.concept ?? pay.concepto ?? pay.description ?? "Concepto"}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">{pay.due_date ?? pay.vencimiento ?? ""}</p>
            </div>
            <p className={`text-sm font-black shrink-0 tabular-nums ${paid ? "text-emerald-600" : "text-slate-800"}`}>
                S/ {toNumber(pay.amount ?? pay.monto ?? 0).toLocaleString("es-PE")}
            </p>
        </div>
    );
};

/* ─── Announcement Item ──────────────────────────────────────── */
const AnnouncementItem = ({ ann, index }) => (
    <div
        className="rounded-xl border border-slate-100 p-3.5 hover:border-blue-200 hover:bg-blue-50/20 transition-all duration-200 cursor-pointer"
        style={{ animationDelay: `${index * 50}ms` }}
    >
        <p className="text-sm font-semibold text-slate-700 line-clamp-2 leading-snug">
            {ann.title ?? ann.titulo ?? "Anuncio"}
        </p>
        <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1.5 font-medium">
            <Timer size={9} />
            {ann.date ?? ann.fecha ?? ann.published_at ?? ""}
        </p>
        {ann.excerpt && (
            <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">{ann.excerpt}</p>
        )}
    </div>
);

/* ─── Quick Access Button ────────────────────────────────────── */
const QuickAccess = ({ icon: Icon, label, path, colorCls, navigate }) => (
    <button
        onClick={() => navigate(path)}
        className={`group flex flex-col items-center gap-2.5 rounded-2xl border p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:scale-95 ${colorCls}`}
    >
        <div className="h-10 w-10 rounded-xl bg-white/70 border border-white/80 shadow-sm grid place-items-center">
            <Icon size={19} />
        </div>
        <span className="text-xs font-bold text-center leading-tight">{label}</span>
    </button>
);

/* ─── Main Component ─────────────────────────────────────────── */
export default function StudentDashboard({ user }) {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const [data, setData] = useState({
        dashboard: null, grades: null, balance: null,
        procedures: null, schedule: null, announcements: null,
    });

    const load = async () => {
        setLoading(true); setErr("");
        try {
            const results = await Promise.allSettled([
                StudentSvc.overview(), StudentSvc.grades(), StudentSvc.balance(),
                StudentSvc.procedures(), StudentSvc.schedule(), StudentSvc.announcements(),
            ]);
            const [dashboard, grades, balance, procedures, schedule, announcements] = results;
            results.forEach((r, i) => { if (r.status === "rejected") console.warn("StudentDash fail:", i, r.reason); });
            setData({
                dashboard: dashboard.status === "fulfilled" ? dashboard.value : null,
                grades: grades.status === "fulfilled" ? grades.value : null,
                balance: balance.status === "fulfilled" ? balance.value : null,
                procedures: procedures.status === "fulfilled" ? procedures.value : null,
                schedule: schedule.status === "fulfilled" ? schedule.value : null,
                announcements: announcements.status === "fulfilled" ? announcements.value : null,
            });
            if (results.every(r => r.status === "rejected")) setErr("No se pudieron cargar tus datos.");
        } catch (e) { setErr(e?.message || "Error cargando dashboard"); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    /* ── Payment status ── */
    const [enrollmentPaymentInfo, setEnrollmentPaymentInfo] = useState(null);
    useEffect(() => {
        const now = new Date();
        const period = now.getMonth() < 6 ? `${now.getFullYear()}-I` : `${now.getFullYear()}-II`;
        EnrollmentPayment.status({ period })
            .then(info => setEnrollmentPaymentInfo(info))
            .catch(() => {});
    }, []);

    /* ── Derived data ── */
    const kpis = useMemo(() => {
        const d = data.dashboard || {};
        const g = data.grades || {};
        const b = data.balance || {};
        const p = data.procedures || {};

        // Reingreso — el backend puede devolver estos campos en overview() o grades()
        const hasPriorEnrollment = !!(d.has_prior_enrollment ?? g.has_prior_enrollment ?? false);
        const activeSince = d.active_since ?? g.active_since ?? null;

        return {
            avgGrade: toNumber(d.avg_grade ?? g.avg ?? g.promedio ?? 0),
            creditsApproved: toNumber(d.credits_approved ?? g.credits_approved ?? 0),
            creditsTotal: toNumber(d.credits_total ?? g.credits_total ?? 200),
            currentSemester: d.current_semester ?? d.ciclo ?? "—",
            career: d.career ?? d.career_name ?? d.carrera ?? "—",
            enrolledCourses: toNumber(d.enrolled_courses ?? d.courses ?? 0),
            attendanceRate: toNumber(d.attendance_rate ?? d.attendance ?? 0),
            merit: d.merit ?? d.ranking ?? null,
            totalInCareer: toNumber(d.total_in_career ?? 0),
            pendingDebt: toNumber(b.pending ?? b.debt ?? b.total_pending ?? 0),
            nextPaymentDate: b.next_due ?? b.next_payment ?? null,
            payments: pickArray(b, ["payments", "detail", "items", "debts"]).slice(0, 5),
            activeProcedures: toNumber(p.active ?? p.pending ??
                (Array.isArray(p) ? p.filter(x => !["resolved", "cerrado", "done"].includes((x.status || "").toLowerCase())).length : 0)),
            proceduresList: (
                pickArray(p, ["items", "results", "data"]).length > 0
                    ? pickArray(p, ["items", "results", "data"])
                    : Array.isArray(p) ? p : []
            ).slice(0, 5),
            // Reingreso
            hasPriorEnrollment,
            activeSince,
        };
    }, [data]);

    const gradesByCourse = useMemo(() =>
        pickArray(data.grades || {}, ["courses", "by_course", "detail", "items", "grades"])
            .map(x => ({
                name: x.name ?? x.course ?? x.materia ?? "",
                shortName: (x.name ?? x.course ?? "").substring(0, 18),
                nota: toNumber(x.grade ?? x.nota ?? x.average ?? 0),
                credits: toNumber(x.credits ?? x.creditos ?? 0),
            }))
            .filter(x => x.name)
            .slice(0, 12),
        [data.grades]);

    const competencyRadar = useMemo(() => {
        const g = data.grades || {};
        const arr = pickArray(g, ["competencies", "areas", "radar"]);
        if (arr.length >= 3)
            return arr.map(x => ({ area: x.name ?? x.area ?? "", value: toNumber(x.value ?? x.score ?? 0), fullMark: 20 }));
        return gradesByCourse.slice(0, 6).map(x => ({ area: x.shortName, value: x.nota, fullMark: 20 }));
    }, [data.grades, gradesByCourse]);

    const weeklySchedule = useMemo(() => {
        const s = data.schedule || {};
        const flat = pickArray(s, ["schedule", "classes", "items", "weekly"]);
        const arr = flat.length > 0 ? flat : (Array.isArray(s) ? s : []);
        const grouped = {};
        arr.forEach(item => {
            const day = item.day ?? item.dia ?? item.weekday ?? "";
            if (!grouped[day]) grouped[day] = [];
            grouped[day].push(item);
        });
        return grouped;
    }, [data.schedule]);

    const announcements = useMemo(() => {
        const a = data.announcements || {};
        const arr = pickArray(a, ["announcements", "items", "results"]);
        return (arr.length > 0 ? arr : Array.isArray(a) ? a : []).slice(0, 4);
    }, [data.announcements]);

    const L = loading;
    const progressPct = kpis.creditsTotal > 0 ? (kpis.creditsApproved / kpis.creditsTotal) * 100 : 0;
    const firstName = user?.first_name || user?.full_name?.split(" ")[0] || "Estudiante";

    // Hint dinámico del PPA según reingreso
    const avgHint = kpis.hasPriorEnrollment && kpis.activeSince
        ? `Desde ${kpis.activeSince}`
        : kpis.merit
            ? `Puesto ${kpis.merit} de ${kpis.totalInCareer}`
            : `Ciclo ${kpis.currentSemester}`;

    return (
        <DashboardShell
            title={`${greeting()}, ${firstName}`}
            subtitle={kpis.career !== "—" ? `${kpis.career} — Ciclo ${kpis.currentSemester}` : "Tu resumen académico y personal"}
            loading={loading} error={err} onRefresh={load}
        >
            {/* ── Alerta de pago de matrícula ── */}
            {!L && enrollmentPaymentInfo && enrollmentPaymentInfo.status !== "APPROVED" && !enrollmentPaymentInfo.is_enrolled && (
                <div className="flex flex-col sm:flex-row gap-3">
                    {enrollmentPaymentInfo.status === "NOT_STARTED" && (
                        <StudentAlert
                            icon={AlertTriangle} variant="amber"
                            message="Pago de matrícula pendiente"
                            sub={`Debes realizar el pago de S/. ${Number(enrollmentPaymentInfo.total || enrollmentPaymentInfo.amount || 180).toFixed(2)} para matricularte`}
                            action="Ir a Matrícula" onAction={() => navigate("/dashboard/academic/enrollment")}
                        />
                    )}
                    {enrollmentPaymentInfo.status === "PENDING" && (
                        <StudentAlert
                            icon={Clock} variant="blue"
                            message="Voucher de pago en revisión"
                            sub="Tu voucher está siendo verificado por el área de finanzas"
                        />
                    )}
                    {enrollmentPaymentInfo.status === "REJECTED" && (
                        <StudentAlert
                            icon={XCircle} variant="amber"
                            message="Voucher de pago rechazado"
                            sub={enrollmentPaymentInfo.rejection_note || "Revisa el motivo y vuelve a enviar tu voucher"}
                            action="Reenviar" onAction={() => navigate("/dashboard/academic/enrollment")}
                        />
                    )}
                </div>
            )}

            {/* ── Alertas ── */}
            {!L && (kpis.pendingDebt > 0 || kpis.activeProcedures > 0 || kpis.hasPriorEnrollment) && (
                <div className="flex flex-col sm:flex-row gap-3">
                    {/* Aviso de reingreso — siempre primero, es informativo no urgente */}
                    {kpis.hasPriorEnrollment && (
                        <StudentAlert
                            icon={AlertTriangle} variant="gold"
                            message="Alumno con reingreso — promedio y créditos desde matrícula activa"
                            sub={kpis.activeSince ? `Tu PPA y créditos aprobados se calculan a partir del período ${kpis.activeSince}` : "Los períodos anteriores al retiro no se incluyen en el cálculo"}
                        />
                    )}
                    {kpis.pendingDebt > 0 && (
                        <StudentAlert
                            icon={CreditCard} variant="amber"
                            message={`Deuda pendiente: S/ ${kpis.pendingDebt.toLocaleString("es-PE")}`}
                            sub={kpis.nextPaymentDate ? `Vence: ${kpis.nextPaymentDate}` : undefined}
                            action="Pagar" onAction={() => navigate("/dashboard/finance")}
                        />
                    )}
                    {kpis.activeProcedures > 0 && (
                        <StudentAlert
                            icon={FileText} variant="blue"
                            message={`${kpis.activeProcedures} trámite${kpis.activeProcedures > 1 ? "s" : ""} en proceso`}
                            action="Seguimiento" onAction={() => navigate("/public/procedures/track")}
                        />
                    )}
                </div>
            )}

            {/* ── KPIs ── */}
            <KpiGrid cols={4}>
                <StatCard
                    icon={Award}
                    title="Promedio General"
                    value={L ? "…" : toNumber(kpis.avgGrade).toFixed(2)}
                    hint={avgHint}
                    tone={kpis.hasPriorEnrollment ? "amber" : "indigo"}
                />
                <StatCard icon={BookOpen} title="Cursos Matriculados" value={L ? "…" : kpis.enrolledCourses} tone="emerald" />
                <StatCard
                    icon={GraduationCap}
                    title="Avance Curricular"
                    value={L ? "…" : `${Math.round(progressPct)}%`}
                    hint={kpis.hasPriorEnrollment && kpis.activeSince
                        ? `${kpis.creditsApproved} créd. desde ${kpis.activeSince}`
                        : `${kpis.creditsApproved}/${kpis.creditsTotal} créd.`}
                    tone="violet"
                />
                <StatCard
                    icon={Percent} title="Asistencia"
                    value={L ? "…" : `${kpis.attendanceRate}%`}
                    hint={kpis.attendanceRate < 70 ? "⚠ Riesgo inhabilitación" : "Dentro del rango"}
                    tone={kpis.attendanceRate < 70 ? "rose" : "blue"}
                />
            </KpiGrid>

            {/* ── Avance + Radar + Notas ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

                {/* Avance curricular */}
                <div className="lg:col-span-3 rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50/40 to-white">
                        <div className="h-8 w-8 rounded-lg bg-indigo-100 grid place-items-center">
                            <GraduationCap size={15} className="text-indigo-600" />
                        </div>
                        <h3 className="font-bold text-slate-800 text-sm">Avance Curricular</h3>
                    </div>
                    <div className="p-5 flex flex-col items-center gap-5">
                        <CircularProgress pct={progressPct} label="completado" />
                        <div className="grid grid-cols-2 gap-3 w-full">
                            <div className="flex flex-col items-center rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 text-center gap-0.5">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Aprobados</p>
                                <p className="text-xl font-black text-indigo-700 tabular-nums">{L ? "…" : kpis.creditsApproved}</p>
                                {!L && kpis.hasPriorEnrollment && kpis.activeSince && (
                                    <p className="text-[9px] text-amber-500 font-semibold flex items-center gap-0.5 mt-0.5">
                                        <AlertTriangle size={8} /> desde {kpis.activeSince}
                                    </p>
                                )}
                            </div>
                            <div className="flex flex-col items-center rounded-xl border border-slate-100 bg-slate-50/40 p-3 text-center gap-0.5">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Requeridos</p>
                                <p className="text-xl font-black text-slate-700 tabular-nums">{L ? "…" : kpis.creditsTotal}</p>
                            </div>
                        </div>
                        <div className="w-full pt-4 border-t border-slate-100">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Promedio acumulado</p>
                                {!L && kpis.hasPriorEnrollment && kpis.activeSince && (
                                    <span className="text-[9px] font-bold text-amber-500 flex items-center gap-0.5">
                                        <AlertTriangle size={8} /> desde {kpis.activeSince}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-end gap-2">
                                <span className={`text-3xl font-black tabular-nums ${toNumber(kpis.avgGrade) >= 14 ? "text-emerald-700"
                                        : toNumber(kpis.avgGrade) >= 11 ? "text-amber-700"
                                            : "text-rose-700"
                                    }`}>
                                    {L ? "…" : toNumber(kpis.avgGrade).toFixed(2)}
                                </span>
                                <span className="text-sm text-slate-400 mb-1">/ 20</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Radar rendimiento */}
                <div className="lg:col-span-4 rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
                        <div className="h-2 w-2 rounded-full bg-violet-500 ring-4 ring-violet-50" />
                        <h3 className="font-bold text-slate-800 text-sm">Perfil de Rendimiento</h3>
                    </div>
                    <div className="p-5">
                        {competencyRadar.length >= 3 ? (
                            <ResponsiveContainer width="100%" height={280}>
                                <RadarChart data={competencyRadar} cx="50%" cy="50%" outerRadius="68%">
                                    <PolarGrid stroke="#e2e8f0" />
                                    <PolarAngleAxis dataKey="area" tick={{ fontSize: 10, fill: "#64748b" }} />
                                    <PolarRadiusAxis angle={30} domain={[0, 20]} tick={{ fontSize: 9, fill: "#94a3b8" }} />
                                    <Radar
                                        name="Nota" dataKey="value"
                                        stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.15}
                                        strokeWidth={2} dot={{ r: 3, fill: "#7c3aed", strokeWidth: 0 }}
                                    />
                                </RadarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="py-8">
                                <EmptyBox title="Datos insuficientes" subtitle="Se necesitan 3+ cursos para el radar" icon={BarChart3} />
                            </div>
                        )}
                    </div>
                </div>

                {/* Lista de notas */}
                <div className="lg:col-span-5 rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-emerald-50 border border-emerald-100 grid place-items-center">
                                <BookMarked size={15} className="text-emerald-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 text-sm leading-none">Mis Calificaciones</h3>
                                <p className="text-[11px] text-slate-400 mt-0.5">Ciclo {kpis.currentSemester}</p>
                            </div>
                        </div>
                        <button
                            onClick={() => navigate("/dashboard/student")}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors"
                        >
                            Kárdex <ArrowRight size={12} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-thumb-slate-200 max-h-[340px]">
                        {gradesByCourse.length > 0
                            ? gradesByCourse.map((c, i) => <GradeRow key={i} course={c} index={i} />)
                            : <div className="py-8"><EmptyBox title="Sin notas" subtitle="Aún no hay calificaciones registradas" icon={BookMarked} /></div>
                        }
                    </div>
                    {gradesByCourse.length > 0 && (
                        <div className="px-4 pb-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                            <div className="flex gap-2.5">
                                {[
                                    { dot: "bg-emerald-500", label: "≥17" },
                                    { dot: "bg-blue-500", label: "14-16" },
                                    { dot: "bg-amber-500", label: "11-13" },
                                    { dot: "bg-rose-500", label: "<11" },
                                ].map(({ dot, label }) => (
                                    <span key={label} className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                                        <span className={`h-2 w-2 rounded-full ${dot}`} />
                                        {label}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Horario semanal ── */}
            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-violet-50/40 to-white">
                    <div className="h-8 w-8 rounded-lg bg-violet-100 grid place-items-center">
                        <Calendar size={15} className="text-violet-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 text-sm leading-none">Horario de la Semana</h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">Ciclo {kpis.currentSemester}</p>
                    </div>
                </div>
                <div className="p-5">
                    {Object.keys(weeklySchedule).length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                            {DAYS.map(day => (
                                <DayColumn
                                    key={day} day={day}
                                    classes={weeklySchedule[day] || weeklySchedule[day.toLowerCase()] || []}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="py-10 flex flex-col items-center gap-3 text-center">
                            <div className="h-14 w-14 rounded-2xl bg-slate-100 grid place-items-center">
                                <Calendar size={24} className="text-slate-300" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-400">Horario no disponible</p>
                                <p className="text-xs text-slate-300 mt-0.5">Se mostrará cuando esté publicado</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Trámites + Pagos + Anuncios ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                {/* Trámites */}
                <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-rose-50 border border-rose-100 grid place-items-center">
                                <FileText size={15} className="text-rose-600" />
                            </div>
                            <h3 className="font-bold text-slate-800 text-sm">Mis Trámites</h3>
                        </div>
                        {kpis.activeProcedures > 0 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                {kpis.activeProcedures} activos
                            </span>
                        )}
                    </div>
                    <div className="p-4 space-y-2">
                        {kpis.proceduresList.length > 0
                            ? kpis.proceduresList.map((proc, i) => <ProcedureItem key={i} proc={proc} />)
                            : (
                                <div className="py-6 flex flex-col items-center gap-2 text-center">
                                    <CheckCircle2 size={28} className="text-emerald-200" />
                                    <p className="text-sm text-slate-400 font-medium">Sin trámites activos</p>
                                </div>
                            )
                        }
                    </div>
                    <div className="px-4 pb-4">
                        <button
                            onClick={() => navigate("/public/procedures/new")}
                            className="flex items-center justify-center gap-2 w-full rounded-xl border border-dashed border-slate-300 p-3 text-sm font-semibold text-slate-500 hover:border-rose-300 hover:text-rose-600 hover:bg-rose-50/50 transition-all"
                        >
                            <Plus size={14} /> Nuevo trámite
                        </button>
                    </div>
                </div>

                {/* Pagos */}
                <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-amber-50 border border-amber-100 grid place-items-center">
                                <CreditCard size={15} className="text-amber-600" />
                            </div>
                            <h3 className="font-bold text-slate-800 text-sm">Mis Pagos</h3>
                        </div>
                        {kpis.pendingDebt > 0 && (
                            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 tabular-nums">
                                S/ {kpis.pendingDebt.toLocaleString("es-PE")}
                            </span>
                        )}
                    </div>
                    <div className="p-4 space-y-2">
                        {kpis.payments.length > 0
                            ? kpis.payments.map((pay, i) => <PaymentItem key={i} pay={pay} />)
                            : (
                                <div className="py-6 flex flex-col items-center gap-2 text-center">
                                    <CheckCircle2 size={28} className="text-emerald-200" />
                                    <p className="text-sm text-slate-400 font-medium">
                                        {kpis.pendingDebt > 0 ? "Detalle no disponible" : "Sin pagos pendientes"}
                                    </p>
                                </div>
                            )
                        }
                    </div>
                </div>

                {/* Anuncios */}
                <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
                        <div className="h-8 w-8 rounded-lg bg-blue-50 border border-blue-100 grid place-items-center">
                            <Bell size={15} className="text-blue-600" />
                        </div>
                        <h3 className="font-bold text-slate-800 text-sm">Anuncios</h3>
                    </div>
                    <div className="p-4 space-y-2">
                        {announcements.length > 0
                            ? announcements.map((ann, i) => <AnnouncementItem key={i} ann={ann} index={i} />)
                            : (
                                <div className="py-6 flex flex-col items-center gap-2 text-center">
                                    <Bell size={28} className="text-slate-200" />
                                    <p className="text-sm text-slate-400 font-medium">Sin anuncios recientes</p>
                                </div>
                            )
                        }
                    </div>
                </div>
            </div>

            {/* ── Accesos rápidos ── */}
            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                    <h3 className="font-bold text-slate-800 text-sm">Accesos Rápidos</h3>
                </div>
                <div className="p-5 grid grid-cols-3 sm:grid-cols-6 gap-3">
                    {[
                        { icon: BookOpen, label: "Matrícula", path: "/dashboard/student", colorCls: "text-indigo-700 bg-indigo-50 border-indigo-200 hover:border-indigo-300" },
                        { icon: Award, label: "Kárdex", path: "/dashboard/student", colorCls: "text-emerald-700 bg-emerald-50 border-emerald-200 hover:border-emerald-300" },
                        { icon: BarChart3, label: "Notas", path: "/dashboard/student", colorCls: "text-violet-700 bg-violet-50 border-violet-200 hover:border-violet-300" },
                        { icon: CreditCard, label: "Pagos", path: "/dashboard/finance", colorCls: "text-amber-700 bg-amber-50 border-amber-200 hover:border-amber-300" },
                        { icon: FileText, label: "Trámites", path: "/public/procedures/track", colorCls: "text-rose-700 bg-rose-50 border-rose-200 hover:border-rose-300" },
                        { icon: Download, label: "Certificados", path: "/dashboard/student", colorCls: "text-cyan-700 bg-cyan-50 border-cyan-200 hover:border-cyan-300" },
                    ].map(props => <QuickAccess key={props.label} {...props} navigate={navigate} />)}
                </div>
            </div>
        </DashboardShell>
    );
}