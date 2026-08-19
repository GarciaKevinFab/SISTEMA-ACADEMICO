// Mérito del estudiante: su puesto y puntaje en el aula, la especialidad y
// el instituto, y si alcanza el DESCUENTO del 25% de la matrícula
// (promedio ponderado del período ≥ 17). Si lo alcanza, puede descargar la
// constancia que lo acredita para presentar al hacer el pago.
// Solo consume /academic/student/merito — el backend devuelve únicamente
// los datos del alumno autenticado.
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Trophy, ArrowLeft, Loader2, Medal, School, Landmark, FileText,
    CheckCircle2, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../../lib/api";
import ModuleShell from "@/components/module/ModuleShell";

const ROMANOS = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

const PuestoCard = ({ icon: Icon, titulo, sub, puesto, total, tono }) => (
    <div className={`rounded-2xl border px-5 py-4 ${tono.border} ${tono.bg}`}>
        <div className="flex items-center gap-2">
            <Icon size={15} className={tono.icon} />
            <p className={`text-[11px] font-bold uppercase ${tono.label}`}>{titulo}</p>
        </div>
        <p className={`text-3xl font-extrabold tabular-nums mt-1 ${tono.value}`}>
            {puesto ? `${puesto}°` : "—"}
            <span className="text-sm font-semibold opacity-60"> de {total || "—"}</span>
        </p>
        {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
);

export default function StudentMeritoPanel() {
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const [descargando, setDescargando] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const { data } = await api.get("/academic/student/merito");
                setData(data || null);
            } catch (e) {
                setError(e?.response?.data?.detail
                    || "No se pudo calcular tu orden de mérito.");
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const descargarConstancia = async () => {
        setDescargando(true);
        try {
            const res = await api.get("/academic/student/merito/constancia.pdf",
                { responseType: "blob" });
            const blob = res?.data instanceof Blob ? res.data : new Blob([res.data]);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `constancia-merito-${data?.period || ""}.pdf`;
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => window.URL.revokeObjectURL(url), 60000);
            toast.success("Constancia descargada");
        } catch (e) {
            let msg = "No se pudo generar la constancia";
            try {
                if (e?.response?.data instanceof Blob) {
                    msg = JSON.parse(await e.response.data.text())?.detail || msg;
                }
            } catch { /* ignore */ }
            toast.error(msg);
        } finally {
            setDescargando(false);
        }
    };

    const alcanza = !!data?.alcanza_descuento;

    return (
        <ModuleShell
            icon={Trophy}
            title="Mi Orden de Mérito"
            subtitle={`Tu puesto según el promedio ponderado${data?.period ? ` — ${data.period}` : ""}`}
            accent="linear-gradient(135deg, #8B5CF6, #6D28D9)"
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
                    <Loader2 className="h-5 w-5 animate-spin" /> Calculando tu puesto…
                </div>
            ) : error ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {error}
                </div>
            ) : (
                <>
                    {/* Promedio + descuento */}
                    <div className={`rounded-2xl border-2 px-5 py-4 flex flex-wrap items-center justify-between gap-3 ${alcanza
                        ? "border-emerald-300 bg-emerald-50/70"
                        : "border-slate-200 bg-white"}`}>
                        <div>
                            <p className="text-[11px] font-bold uppercase text-slate-500">
                                Promedio ponderado — {data.period}
                            </p>
                            <p className={`text-4xl font-extrabold tabular-nums ${alcanza ? "text-emerald-700" : "text-slate-800"}`}>
                                {Number(data.promedio).toFixed(2)}
                                <span className="text-base font-semibold text-slate-400"> /20</span>
                            </p>
                        </div>
                        <div className="text-right">
                            {alcanza ? (
                                <>
                                    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300">
                                        <CheckCircle2 size={13} />
                                        ALCANZAS EL DESCUENTO DEL 25%
                                    </span>
                                    <p className="text-[11px] text-emerald-600 mt-1">
                                        Descarga tu constancia y preséntala al pagar tu matrícula
                                    </p>
                                </>
                            ) : (
                                <>
                                    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                                        <XCircle size={13} />
                                        Descuento 25%: desde {Number(data.umbral_descuento).toFixed(0)} de promedio
                                    </span>
                                    <p className="text-[11px] text-slate-400 mt-1">
                                        Te faltan {(data.umbral_descuento - data.promedio).toFixed(2)} puntos
                                    </p>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Puestos en los tres niveles */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <PuestoCard icon={Medal} titulo="En mi aula"
                            sub={`${data.carrera || ""}${data.ciclo_cursado ? ` · Ciclo ${ROMANOS[data.ciclo_cursado] || data.ciclo_cursado}` : ""}`}
                            puesto={data.aula?.puesto} total={data.aula?.total}
                            tono={{ border: "border-violet-200/70", bg: "bg-violet-50/60", icon: "text-violet-600", label: "text-violet-600", value: "text-violet-700" }} />
                        <PuestoCard icon={School} titulo="En mi especialidad"
                            sub={data.carrera || ""}
                            puesto={data.especialidad?.puesto} total={data.especialidad?.total}
                            tono={{ border: "border-blue-200/70", bg: "bg-blue-50/60", icon: "text-blue-600", label: "text-blue-600", value: "text-blue-700" }} />
                        <PuestoCard icon={Landmark} titulo="En el instituto"
                            sub="Todas las especialidades"
                            puesto={data.instituto?.puesto} total={data.instituto?.total}
                            tono={{ border: "border-slate-200/80", bg: "bg-slate-50/80", icon: "text-slate-500", label: "text-slate-500", value: "text-slate-700" }} />
                    </div>

                    {alcanza && (
                        <button onClick={descargarConstancia} disabled={descargando}
                            className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-sm py-3 transition-colors">
                            {descargando
                                ? <Loader2 size={16} className="animate-spin" />
                                : <FileText size={16} />}
                            Descargar constancia que acredita el descuento
                        </button>
                    )}

                    <p className="text-[11px] text-slate-400 text-center">
                        El puesto se calcula con las notas procesadas por Secretaría
                        Académica (kárdex). Los empates comparten el mismo puesto.
                    </p>
                </>
            )}
            </div>
        </ModuleShell>
    );
}
