// Pagos del estudiante — página propia, con datos de SU cuenta.
//
// Antes el acceso "Pagos" del dashboard mandaba a /dashboard/finance, el
// módulo administrativo de Finanzas: como el rol STUDENT no tiene esos
// permisos, el alumno aterrizaba en la página 403. Esta vista usa el
// endpoint /finance/student/balance (solo requiere sesión) que devuelve
// únicamente los datos del alumno autenticado.
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    CreditCard, CheckCircle2, Clock, XCircle, AlertTriangle,
    ArrowLeft, Loader2, Receipt, Landmark,
} from "lucide-react";
import { api } from "../../lib/api";
import ModuleShell from "@/components/module/ModuleShell";

const SOLES = (n) =>
    `S/ ${Number(n || 0).toLocaleString("es-PE", { minimumFractionDigits: 2 })}`;

const ESTILO_ESTADO = {
    "pendiente":   { cls: "bg-amber-50 text-amber-700 border-amber-200",       Icon: Clock },
    "en revisión": { cls: "bg-blue-50 text-blue-700 border-blue-200",          Icon: Clock },
    "pagado":      { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", Icon: CheckCircle2 },
    "rechazado":   { cls: "bg-rose-50 text-rose-700 border-rose-200",          Icon: XCircle },
};

const FilaPago = ({ item }) => {
    const est = ESTILO_ESTADO[item.status] || ESTILO_ESTADO["pendiente"];
    const { Icon } = est;
    return (
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-slate-100 last:border-0">
            <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{item.concept}</p>
                <p className="text-xs text-slate-400 mt-0.5">{item.due_date || "—"}</p>
                {item.status === "rechazado" && item.rejection_note && (
                    <p className="text-xs text-rose-600 mt-1 flex items-center gap-1">
                        <AlertTriangle size={12} /> {item.rejection_note}
                    </p>
                )}
            </div>
            <div className="text-right shrink-0">
                <p className="text-sm font-bold text-slate-800 tabular-nums">{SOLES(item.amount)}</p>
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border mt-1 ${est.cls}`}>
                    <Icon size={10} /> {item.status.toUpperCase()}
                </span>
            </div>
        </div>
    );
};

const Seccion = ({ icon: Icon, tono, titulo, extra, children }) => (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
            <div className="flex items-center gap-3">
                <div className={`h-8 w-8 rounded-lg grid place-items-center border ${tono}`}>
                    <Icon size={15} />
                </div>
                <h3 className="font-bold text-slate-800 text-sm">{titulo}</h3>
            </div>
            {extra}
        </div>
        {children}
    </div>
);

const Vacio = ({ texto }) => (
    <div className="py-8 flex flex-col items-center gap-2 text-center">
        <CheckCircle2 size={26} className="text-emerald-200" />
        <p className="text-sm text-slate-400 font-medium">{texto}</p>
    </div>
);

export default function StudentPaymentsPanel() {
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const { data } = await api.get("/finance/student/balance");
                setData(data || {});
            } catch (e) {
                setError(e?.response?.data?.detail || "No se pudo cargar tu información de pagos.");
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const charges = data?.charges || [];
    const vouchers = data?.enrollment_vouchers || [];
    const paid = data?.paid || [];

    return (
        <ModuleShell
            icon={CreditCard}
            title="Mis Pagos"
            subtitle="Cargos pendientes, vouchers de matrícula y pagos realizados"
            accent="linear-gradient(135deg, #F59E0B, #B45309)"
            headerRight={
                <button onClick={() => navigate(-1)}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3.5 py-2 rounded-xl transition-colors">
                    <ArrowLeft size={15} /> Volver
                </button>
            }
        >
            <div className="max-w-3xl mx-auto w-full space-y-4">
            {loading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
                    <Loader2 className="h-5 w-5 animate-spin" /> Cargando…
                </div>
            ) : error ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {error}
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-amber-200/70 bg-amber-50/60 px-5 py-4">
                            <p className="text-[11px] font-bold text-amber-600 uppercase">Pendiente de pago</p>
                            <p className="text-2xl font-extrabold text-amber-700 tabular-nums mt-1">
                                {SOLES(data?.pending)}
                            </p>
                            {data?.next_due && (
                                <p className="text-xs text-amber-600 mt-0.5">Próximo vencimiento: {data.next_due}</p>
                            )}
                        </div>
                        <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/60 px-5 py-4">
                            <p className="text-[11px] font-bold text-emerald-600 uppercase">Total pagado</p>
                            <p className="text-2xl font-extrabold text-emerald-700 tabular-nums mt-1">
                                {SOLES(data?.total_paid)}
                            </p>
                        </div>
                    </div>

                    <Seccion icon={Clock} titulo="Cargos pendientes"
                        tono="bg-amber-50 border-amber-100 text-amber-600">
                        {charges.length ? charges.map((c, i) => <FilaPago key={i} item={c} />)
                            : <Vacio texto="No tienes cargos pendientes" />}
                    </Seccion>

                    <Seccion icon={Landmark} titulo="Vouchers de matrícula"
                        tono="bg-blue-50 border-blue-100 text-blue-600"
                        extra={<span className="text-[10px] text-slate-400">Banco de la Nación</span>}>
                        {vouchers.length ? vouchers.map((v, i) => <FilaPago key={i} item={v} />)
                            : <Vacio texto="Aún no registras vouchers de matrícula" />}
                    </Seccion>

                    <Seccion icon={Receipt} titulo="Pagos realizados en caja"
                        tono="bg-emerald-50 border-emerald-100 text-emerald-600">
                        {paid.length ? paid.map((p, i) => <FilaPago key={i} item={p} />)
                            : <Vacio texto="Aún no registras pagos en caja" />}
                    </Seccion>
                </>
            )}
            </div>
        </ModuleShell>
    );
}
