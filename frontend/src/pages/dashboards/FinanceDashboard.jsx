// src/pages/dashboards/FinanceDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    ResponsiveContainer, AreaChart, Area, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import {
    Wallet, Banknote, Receipt, CreditCard,
    ArrowUpRight, ArrowDownRight, AlertCircle, DollarSign,
    TrendingUp, Clock, CheckCircle, FileText, Eye, ArrowRight, Zap,
} from "lucide-react";
import { FinanceDashboard as FinSvc } from "../../services/finance.service";
import { FinanceDashboardSvc } from "../../services/dashboard.service";
import {
    DashboardShell, KpiGrid, StatCard, ChartCard, EmptyBox, InfoPanel, ProgressBar,
    toNumber, pickArray,
    CHART_TOOLTIP_STYLE, CHART_GRID_PROPS, CHART_AXIS_TICK,
} from "./DashboardWidgets";

const FinExtra = {
    recentPayments: () => FinanceDashboardSvc.recentPayments(),
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
                    <span className="font-semibold text-slate-800">
                        S/ {toNumber(p.value).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                    </span>
                </div>
            ))}
        </div>
    );
};

/* ─── Income / Expense Big Card ──────────────────────────────── */
const FlowCard = ({ icon: Icon, label, value, tone, loading }) => {
    const isIncome = tone === "emerald";
    return (
        <div className={`rounded-2xl border overflow-hidden bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 ${isIncome ? "border-emerald-100" : "border-rose-100"}`}>
            <div className="p-5 flex items-center gap-4">
                <div className={`h-12 w-12 rounded-xl grid place-items-center shrink-0 border ${isIncome ? "bg-emerald-50 border-emerald-100" : "bg-rose-50 border-rose-100"}`}>
                    <Icon size={22} className={isIncome ? "text-emerald-600" : "text-rose-600"} />
                </div>
                <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{label}</p>
                    <p className={`text-2xl font-black tabular-nums mt-1 ${isIncome ? "text-emerald-700" : "text-rose-700"}`}>
                        {loading ? "…" : value}
                    </p>
                </div>
            </div>
            <div className={`h-1 ${isIncome ? "bg-gradient-to-r from-emerald-400 to-emerald-300" : "bg-gradient-to-r from-rose-400 to-rose-300"}`} />
        </div>
    );
};

/* ─── Payment Row ────────────────────────────────────────────── */
const PaymentRow = ({ pay, index, fmt }) => {
    const isIncome = (pay.type ?? pay.tipo ?? "").toLowerCase().includes("ingreso")
        || toNumber(pay.amount ?? pay.monto ?? 0) > 0;
    const amount = Math.abs(toNumber(pay.amount ?? pay.monto ?? 0));
    const concept = pay.concept ?? pay.concepto ?? pay.description ?? "Movimiento";
    const date = pay.date ?? pay.created_at ?? "";
    const student = pay.student_name ?? "";

    return (
        <div
            className="group flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3.5 hover:border-slate-200 hover:bg-slate-50/60 transition-all duration-200"
            style={{ animationDelay: `${index * 40}ms` }}
        >
            {/* Direction icon */}
            <div className={`h-9 w-9 rounded-xl grid place-items-center shrink-0 border transition-colors ${isIncome
                    ? "bg-emerald-50 border-emerald-100 text-emerald-600 group-hover:bg-emerald-100"
                    : "bg-rose-50 border-rose-100 text-rose-600 group-hover:bg-rose-100"
                }`}>
                {isIncome ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-700 truncate leading-tight">{concept}</p>
                <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                    {[date, student].filter(Boolean).join(" · ")}
                </p>
            </div>
            {/* Amount */}
            <p className={`text-sm font-black tabular-nums shrink-0 ${isIncome ? "text-emerald-600" : "text-rose-600"}`}>
                {isIncome ? "+" : "−"}{fmt(amount)}
            </p>
        </div>
    );
};

/* ─── Accounts Panel ─────────────────────────────────────────── */
const AccountsPanel = ({ loading: L, kpis, fmt }) => {
    const items = [
        { label: "Por Cobrar", value: L ? "…" : fmt(kpis.ar), color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-100" },
        { label: "Por Pagar", value: L ? "…" : fmt(kpis.ap), color: "text-rose-700", bg: "bg-rose-50 border-rose-100" },
        { label: "Recibos pend.", value: L ? "…" : kpis.pending, color: "text-amber-700", bg: "bg-amber-50 border-amber-100" },
        { label: "Facturas emit.", value: L ? "…" : kpis.invoices, color: "text-blue-700", bg: "bg-blue-50 border-blue-100" },
    ];
    return (
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
                <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-100 grid place-items-center">
                    <DollarSign size={15} className="text-indigo-600" />
                </div>
                <div>
                    <h3 className="font-bold text-slate-800 text-sm leading-none">Cuentas</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Resumen de saldos y pendientes</p>
                </div>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
                {items.map(({ label, value, color, bg }) => (
                    <div key={label} className={`flex flex-col items-center justify-center rounded-xl border p-4 text-center gap-1 ${bg}`}>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
                        <p className={`text-lg font-black tabular-nums mt-0.5 ${color}`}>{value}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

/* ─── Main Component ─────────────────────────────────────────── */
export default function FinanceDashboard({ roles }) {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const [data, setData] = useState({ stats: null, recent: null });

    const load = async () => {
        setLoading(true); setErr("");
        try {
            const results = await Promise.allSettled([
                FinSvc.stats(),
                FinExtra.recentPayments(),
            ]);
            setData({
                stats: results[0].status === "fulfilled" ? results[0].value : null,
                recent: results[1].status === "fulfilled" ? results[1].value : null,
            });
            if (results.every(r => r.status === "rejected"))
                setErr("No se pudieron cargar los datos financieros.");
        } catch (e) { setErr(e?.message || "Error"); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const fin = useMemo(() => { const r = data.stats || {}; return r?.stats ?? r; }, [data.stats]);

    const kpis = useMemo(() => {
        const f = fin || {};
        return {
            incomeToday: toNumber(f.income_today ?? f.cash_today_amount ?? 0),
            cashBalance: toNumber(f.cash_balance ?? f.balance ?? 0),
            pending: toNumber(f.pending_receipts ?? f.pending ?? 0),
            totalIncome: toNumber(f.total_income ?? f.income_month ?? 0),
            totalExpense: toNumber(f.total_expense ?? f.expense_month ?? 0),
            ar: toNumber(f.ar_pending ?? f.accounts_receivable ?? 0),
            ap: toNumber(f.ap_pending ?? f.accounts_payable ?? 0),
            invoices: toNumber(f.invoices_pending ?? f.electronic_pending ?? 0),
            txToday: toNumber(f.transactions_today ?? f.tx_count ?? 0),
        };
    }, [fin]);

    const trend = useMemo(() => {
        const r = data.stats || {};
        const f = r?.stats ?? r;
        return (
            pickArray(f, ["trend", "income_trend", "daily_income", "series"]) ||
            pickArray(r, ["trend", "income_trend", "daily_income", "series"])
        )
            .map(x => ({
                date: x.date ?? x.day ?? "",
                ingreso: toNumber(x.income ?? x.value ?? x.amount ?? 0),
                egreso: toNumber(x.expense ?? x.out ?? 0),
            }))
            .filter(x => x.date);
    }, [data.stats]);

    const byConcept = useMemo(() =>
        pickArray(fin || {}, ["by_concept", "concepts", "income_by_concept"])
            .map(x => ({ name: x.name ?? x.concept ?? "", value: toNumber(x.value ?? x.amount ?? 0) }))
            .filter(x => x.name && x.value > 0)
            .slice(0, 8),
        [fin]);

    const recentPayments = useMemo(() => {
        const r = data.recent || {};
        const arr = pickArray(r, ["results", "items", "payments"]);
        return (arr.length > 0 ? arr : Array.isArray(r) ? r : []).slice(0, 8);
    }, [data.recent]);

    const L = loading;
    const fmt = v => `S/ ${toNumber(v).toLocaleString("es-PE", { minimumFractionDigits: 2 })}`;
    const fmtK = v => `S/ ${toNumber(v).toLocaleString("es-PE")}`;
    const isCashier = roles?.includes("CASHIER");

    const netMonth = kpis.totalIncome - kpis.totalExpense;

    return (
        <DashboardShell
            title={isCashier ? "Panel de Caja" : "Gestión Financiera"}
            subtitle="Ingresos · Egresos · Caja · Cuentas"
            loading={loading}
            error={err}
            onRefresh={load}
        >
            {/* ── Alerta recibos ── */}
            {!L && kpis.pending > 5 && (
                <div className="flex items-center gap-3 rounded-2xl border border-amber-200/70 bg-gradient-to-r from-amber-50 via-orange-50/40 to-amber-50 px-4 py-3.5">
                    <div className="h-8 w-8 rounded-lg bg-amber-100 grid place-items-center shrink-0">
                        <Receipt size={15} className="text-amber-700" />
                    </div>
                    <p className="flex-1 text-sm font-semibold text-amber-900">
                        {kpis.pending} recibo{kpis.pending > 1 ? "s" : ""} pendiente{kpis.pending > 1 ? "s" : ""} de cobro
                    </p>
                </div>
            )}

            {/* ── KPIs ── */}
            <KpiGrid cols={4}>
                <StatCard icon={Banknote} title="Ingresos Hoy" value={L ? "…" : fmtK(kpis.incomeToday)} hint={`${kpis.txToday} transacciones`} tone="emerald" />
                <StatCard icon={Wallet} title="Saldo en Caja" value={L ? "…" : fmtK(kpis.cashBalance)} tone="indigo" />
                <StatCard icon={Receipt} title="Recibos Pendientes" value={L ? "…" : kpis.pending} tone={kpis.pending > 0 ? "amber" : "emerald"} />
                <StatCard icon={CreditCard} title="Facturas por Emitir" value={L ? "…" : `${kpis.invoices}`} tone="blue" />
            </KpiGrid>

            {/* ── Ingreso / Egreso del mes + Balance neto ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <FlowCard icon={ArrowUpRight} label="Ingresos del Mes" value={fmt(kpis.totalIncome)} tone="emerald" loading={L} />
                <FlowCard icon={ArrowDownRight} label="Egresos del Mes" value={fmt(kpis.totalExpense)} tone="rose" loading={L} />
                {/* Balance neto */}
                <div className={`rounded-2xl border overflow-hidden bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 ${netMonth >= 0 ? "border-indigo-100" : "border-rose-100"}`}>
                    <div className="p-5 flex items-center gap-4">
                        <div className={`h-12 w-12 rounded-xl grid place-items-center shrink-0 border ${netMonth >= 0 ? "bg-indigo-50 border-indigo-100" : "bg-rose-50 border-rose-100"}`}>
                            <TrendingUp size={22} className={netMonth >= 0 ? "text-indigo-600" : "text-rose-600"} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Balance Neto</p>
                            <p className={`text-2xl font-black tabular-nums mt-1 ${netMonth >= 0 ? "text-indigo-700" : "text-rose-700"}`}>
                                {L ? "…" : fmt(netMonth)}
                            </p>
                        </div>
                    </div>
                    <div className={`h-1 ${netMonth >= 0 ? "bg-gradient-to-r from-indigo-400 to-indigo-300" : "bg-gradient-to-r from-rose-400 to-rose-300"}`} />
                </div>
            </div>

            {/* ── Gráficos + Movimientos + Cuentas ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">

                {/* Tendencia ingresos/egresos */}
                <div className="xl:col-span-2 rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
                        <div className="h-2 w-2 rounded-full bg-purple-500 ring-4 ring-purple-50" />
                        <h3 className="font-bold text-slate-800 text-sm">Tendencia Ingresos / Egresos</h3>
                    </div>
                    <div className="p-5 h-72">
                        {trend.length >= 2 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={trend} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="gInc" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.18} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.12} />
                                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} dy={8} />
                                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} width={64} axisLine={false} tickLine={false} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend
                                        iconType="circle" iconSize={8}
                                        wrapperStyle={{ fontSize: "11px", color: "#64748b", paddingTop: "10px" }}
                                    />
                                    <Area
                                        type="monotone" dataKey="ingreso" name="Ingresos"
                                        stroke="#10b981" strokeWidth={2.5} fill="url(#gInc)"
                                        dot={{ r: 3.5, fill: "#fff", strokeWidth: 2, stroke: "#10b981" }}
                                        activeDot={{ r: 5, strokeWidth: 0, fill: "#10b981" }}
                                    />
                                    <Area
                                        type="monotone" dataKey="egreso" name="Egresos"
                                        stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5"
                                        fill="url(#gExp)" dot={false}
                                        activeDot={{ r: 4, strokeWidth: 0, fill: "#ef4444" }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <EmptyBox title="Sin tendencia" subtitle="Faltan datos históricos de movimientos" />
                        )}
                    </div>
                </div>

                {/* Ingresos por concepto */}
                <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
                        <div className="h-2 w-2 rounded-full bg-amber-500 ring-4 ring-amber-50" />
                        <h3 className="font-bold text-slate-800 text-sm">Ingresos por Concepto</h3>
                    </div>
                    <div className="p-5 h-72">
                        {byConcept.length >= 1 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={byConcept} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                                    <CartesianGrid horizontal={false} stroke="#f1f5f9" />
                                    <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 600 }} axisLine={false} tickLine={false} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "#fefce8" }} />
                                    <Bar dataKey="value" name="Monto (S/)" fill="#f59e0b" radius={[0, 6, 6, 0]} maxBarSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <EmptyBox title="Sin datos de conceptos" subtitle="" />
                        )}
                    </div>
                </div>

                {/* Últimos movimientos */}
                <div className="xl:col-span-2 rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-emerald-50 border border-emerald-100 grid place-items-center">
                                <TrendingUp size={15} className="text-emerald-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 text-sm leading-none">Últimos Movimientos</h3>
                                {recentPayments.length > 0 && (
                                    <p className="text-[11px] text-slate-400 mt-0.5">{recentPayments.length} registros recientes</p>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={() => navigate("/dashboard/finance/payments")}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors"
                        >
                            Ver todos <ArrowRight size={12} />
                        </button>
                    </div>
                    <div className="p-4">
                        {recentPayments.length > 0 ? (
                            <div className="space-y-2">
                                {recentPayments.map((pay, i) => (
                                    <PaymentRow key={i} pay={pay} index={i} fmt={fmtK} />
                                ))}
                            </div>
                        ) : (
                            <div className="py-8">
                                <EmptyBox title="Sin movimientos recientes" subtitle="Los pagos aparecerán aquí" icon={TrendingUp} />
                            </div>
                        )}
                    </div>
                </div>

                {/* Cuentas */}
                <AccountsPanel loading={L} kpis={kpis} fmt={fmtK} />
            </div>
        </DashboardShell>
    );
}