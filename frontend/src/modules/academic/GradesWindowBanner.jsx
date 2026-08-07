/* ═══════════════════════════════════════════════════════════════
   GradesWindowBanner — estado del registro de calificaciones
   Muestra al docente si puede cargar notas y hasta cuándo:
     OPEN     → verde  "Registro ABIERTO hasta el …"
     NOT_YET  → azul   "Aún no está habilitado, abre el …"
     EXPIRED  → rojo   "La fecha de carga se cerró el …"
     CLOSED   → rojo   "El período fue cerrado por Secretaría Académica"
   Devuelve el estado al padre (onState) para bloquear los controles.
   ═══════════════════════════════════════════════════════════════ */
import React, { useCallback, useEffect, useState } from "react";
import { Lock, Unlock, Clock, AlertTriangle, ShieldCheck, Loader2 } from "lucide-react";
import api from "@/lib/api";

const STYLES = {
    OPEN:    { cls: "border-emerald-200 bg-emerald-50 text-emerald-800", Icon: Unlock,        titulo: "REGISTRO ABIERTO" },
    NOT_YET: { cls: "border-blue-200 bg-blue-50 text-blue-800",          Icon: Clock,         titulo: "AÚN NO HABILITADO" },
    EXPIRED: { cls: "border-rose-200 bg-rose-50 text-rose-800",          Icon: AlertTriangle, titulo: "FECHA DE CARGA CERRADA" },
    CLOSED:  { cls: "border-rose-200 bg-rose-50 text-rose-800",          Icon: Lock,          titulo: "PERÍODO CERRADO" },
};

export default function GradesWindowBanner({ sectionId, onState, refreshKey }) {
    const [info, setInfo] = useState(null);
    const [loading, setLoading] = useState(false);

    const load = useCallback(async () => {
        if (!sectionId) { setInfo(null); onState?.(null); return; }
        setLoading(true);
        try {
            const { data } = await api.get(`/academic/sections/${sectionId}/grades-window`);
            setInfo(data);
            onState?.(data);
        } catch {
            setInfo(null);
            onState?.(null);
        } finally {
            setLoading(false);
        }
        // onState es callback del padre: no se incluye para no re-disparar
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sectionId, refreshKey]);

    useEffect(() => { load(); }, [load]);

    if (!sectionId) return null;
    if (loading && !info) {
        return (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Verificando el estado del registro de notas…
            </div>
        );
    }
    if (!info) return null;

    const st = STYLES[info.window_state] || STYLES.OPEN;
    const { Icon } = st;

    return (
        <div className={`rounded-xl border px-4 py-2.5 ${st.cls}`}>
            <div className="flex items-start gap-2.5">
                <Icon className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-black tracking-wide">
                        {st.titulo} — {info.period}
                    </p>
                    <p className="text-xs mt-0.5 leading-relaxed">{info.message}</p>

                    {info.admin_override && (
                        <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold bg-white/70 rounded-md px-2 py-1">
                            <ShieldCheck className="h-3 w-3" />
                            Eres administrador: puedes editar por encima de la ventana.
                        </p>
                    )}
                    {info.acta_submitted && (
                        <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold bg-white/70 rounded-md px-2 py-1">
                            <Lock className="h-3 w-3" /> El acta de esta sección ya fue cerrada.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
