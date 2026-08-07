/* ═══════════════════════════════════════════════════════════════
   StudentCoursesPanel — "Mis Cursos: Notas y Asistencia"
   Boleta en vivo del alumno: PGA del período + una tarjeta por curso
   con C1/C2/C3, promedio, calificación cualitativa, faltas y % de
   inasistencia (alerta de riesgo DPI al superar 30%).
   ═══════════════════════════════════════════════════════════════ */
import React, { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
    Loader2, BookOpen, AlertTriangle, Info, UserCheck, RefreshCw, ChevronRight, Lock, Download,
} from "lucide-react";
import api from "@/lib/api";
import { useActivePeriod } from "@/hooks/useActivePeriod";

const MARK_STYLE = {
    P: "bg-emerald-100 text-emerald-700",
    T: "bg-amber-100 text-amber-700",
    F: "bg-rose-100 text-rose-700",
    J: "bg-blue-100 text-blue-700",
    "0": "bg-slate-200 text-slate-500",
};
const MARK_LABEL = { P: "Presente", T: "Tardanza", F: "Falta", J: "Justificado", "0": "Feriado" };

/* ── Modal "Ver detalle" de un curso (compartido con Mis Inasistencias) ── */
export function CourseDetailModal({ open, onClose, sectionId }) {
    const [det, setDet] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open || !sectionId) return;
        let cancel = false;
        setLoading(true);
        api.get(`/academic/student/me/curso/${sectionId}/detalle`)
            .then(({ data }) => { if (!cancel) setDet(data); })
            .catch((e) => {
                if (!cancel) toast.error(e?.response?.data?.detail || "No se pudo cargar el detalle");
            })
            .finally(() => { if (!cancel) setLoading(false); });
        return () => { cancel = true; };
    }, [open, sectionId]);

    const acta = det?.acta || {};
    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) onClose?.(); }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-base">
                        {det ? `${det.code} — ${(det.name || "").toUpperCase()}` : "Detalle del curso"}
                    </DialogTitle>
                    {det && (
                        <p className="text-xs text-slate-400">
                            {det.teacher || "Docente por asignar"}{det.room ? ` · Aula ${det.room}` : ""} · {det.period}
                        </p>
                    )}
                </DialogHeader>
                {loading ? (
                    <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
                        <Loader2 className="h-5 w-5 animate-spin" /> Cargando…
                    </div>
                ) : det && (
                    <div className="space-y-4">
                        {/* ── Notas por competencia ── */}
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                                Mis calificaciones {acta.acta_cerrada && (
                                    <span className="inline-flex items-center gap-1 normal-case font-semibold text-slate-500">
                                        <Lock className="h-3 w-3" /> (acta cerrada)
                                    </span>
                                )}
                            </p>
                            <div className="space-y-2">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="flex items-start gap-3 rounded-lg border border-slate-100 p-2.5">
                                        <div className="text-center shrink-0 w-20">
                                            <p className="text-[10px] font-bold text-slate-400">Competencia {i}</p>
                                            <p className="text-xl font-black text-blue-600">
                                                {acta[`c${i}`] ?? "—"}
                                                {acta[`c${i}_level`] && (
                                                    <span className="text-[10px] font-bold text-slate-400 ml-1">({acta[`c${i}_level`]})</span>
                                                )}
                                            </p>
                                        </div>
                                        <p className="text-xs text-slate-500 flex-1 pt-1">
                                            {acta[`c${i}_rec`] || <span className="text-slate-300">Sin recomendación del docente</span>}
                                        </p>
                                    </div>
                                ))}
                            </div>
                            <div className="flex items-center justify-between mt-2 rounded-lg bg-slate-50 border px-3 py-2">
                                <span className="text-xs font-bold text-slate-500">
                                    Promedio final {acta.dpi && <span className="text-violet-600">(DPI por inasistencia)</span>}
                                </span>
                                <span className={`text-xl font-black ${acta.promedio == null ? "text-slate-300" : acta.promedio >= 11 ? "text-emerald-600" : "text-rose-600"}`}>
                                    {acta.dpi ? 0 : (acta.promedio ?? "—")}
                                    {acta.estado && <span className="text-[10px] font-bold ml-2">{acta.estado}</span>}
                                </span>
                            </div>
                        </div>

                        {/* ── Asistencia sesión por sesión ── */}
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                                Asistencia por sesión ({det.sesiones.length})
                            </p>
                            {det.sesiones.length ? (
                                <div className="flex flex-wrap gap-1.5">
                                    {det.sesiones.map((s) => (
                                        <span key={s.date}
                                            title={`${s.date}${s.mark ? ` — ${MARK_LABEL[s.mark] || s.mark}` : " — sin registro"}${s.closed ? " (cerrada)" : ""}`}
                                            className={`inline-flex flex-col items-center px-1.5 py-1 rounded-md text-[10px] font-bold ${s.mark ? MARK_STYLE[s.mark] : "bg-slate-100 text-slate-400"}`}>
                                            <span>{s.date.slice(8)}/{s.date.slice(5, 7)}</span>
                                            <span className="text-xs">{s.mark || "·"}</span>
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-slate-400">Aún no hay sesiones registradas</p>
                            )}
                            <p className="text-[10px] text-slate-400 mt-1.5">
                                P Presente · T Tardanza · F Falta · J Justificado · 0 Feriado
                            </p>
                        </div>

                        {/* ── Historial del curso ── */}
                        {det.historial?.length > 0 && (
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                                    Historial del curso
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {det.historial.map((h) => (
                                        <span key={h.term}
                                            className={`text-[11px] font-bold px-2 py-1 rounded-lg border ${h.aprobado ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}>
                                            {h.term}: {h.final ?? "—"}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

function periodOptions() {
    const y = new Date().getFullYear();
    const out = [];
    for (let i = y; i >= y - 4; i--) { out.push(`${i}-II`); out.push(`${i}-I`); }
    return out;
}

const notaColor = (n) =>
    n == null ? "text-slate-400" : n >= 11 ? "text-blue-600" : "text-rose-600";

const CALIF_BADGE = {
    "Destacado": "bg-emerald-100 text-emerald-800 border-emerald-200",
    "Logrado": "bg-emerald-50 text-emerald-700 border-emerald-200",
    "En proceso": "bg-amber-50 text-amber-700 border-amber-200",
    "Inicio": "bg-orange-50 text-orange-700 border-orange-200",
    "Previo al inicio": "bg-rose-50 text-rose-700 border-rose-200",
    "DPI": "bg-violet-100 text-violet-700 border-violet-200",
};

export default function StudentCoursesPanel({ embedded = false, period: periodProp = "" }) {
    const { period: activePeriod } = useActivePeriod();
    const [period, setPeriod] = useState("");
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [detalleId, setDetalleId] = useState(null);
    const [descargando, setDescargando] = useState(false);

    const effective = periodProp || period || activePeriod;

    const load = useCallback(async () => {
        if (!effective) return;
        setLoading(true);
        try {
            const { data: d } = await api.get("/academic/student/me/cursos",
                { params: { period: effective } });
            setData(d);
        } catch (e) {
            setData(null);
            toast.error(e?.response?.data?.detail || "No se pudieron cargar tus cursos");
        } finally {
            setLoading(false);
        }
    }, [effective]);
    useEffect(() => { load(); }, [load]);

    const cursos = data?.cursos || [];

    return (
        <Card className="border shadow-sm rounded-2xl">
            {!embedded && (
            <CardHeader className="pb-3">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <CardTitle className="text-base flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-blue-600" /> Mis Cursos — Notas y Asistencia
                        </CardTitle>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Tus avances del período: se actualizan cuando tus docentes registran.
                        </p>
                    </div>
                    <div className="flex items-end gap-2">
                        <div className="min-w-[120px]">
                            <Label className="text-[10px] font-bold uppercase">Período</Label>
                            <select
                                className="w-full h-9 px-2 text-sm rounded-md border border-slate-200 bg-white"
                                value={effective || ""}
                                onChange={(e) => setPeriod(e.target.value)}
                            >
                                {periodOptions().map((p) => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                        </div>
                        <Button size="sm" variant="outline" className="gap-1.5 h-9"
                            disabled={descargando}
                            onClick={async () => {
                                setDescargando(true);
                                try {
                                    const res = await api.get("/academic/student/me/boleta.pdf",
                                        { params: { period: effective }, responseType: "blob" });
                                    const blob = res?.data instanceof Blob ? res.data : new Blob([res.data]);
                                    const url = window.URL.createObjectURL(blob);
                                    const a = document.createElement("a");
                                    a.href = url; a.download = `mi-boleta-${effective}.pdf`;
                                    document.body.appendChild(a); a.click(); a.remove();
                                    setTimeout(() => window.URL.revokeObjectURL(url), 60000);
                                    toast.success("Boleta descargada");
                                } catch (e) {
                                    let msg = "No se pudo generar la boleta";
                                    try {
                                        if (e?.response?.data instanceof Blob) {
                                            msg = JSON.parse(await e.response.data.text())?.detail || msg;
                                        }
                                    } catch { /* ignore */ }
                                    toast.error(msg);
                                } finally { setDescargando(false); }
                            }}>
                            {descargando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                            Boleta PDF
                        </Button>
                    </div>
                </div>
            </CardHeader>
            )}
            <CardContent className={`space-y-4 ${embedded ? "pt-4" : ""}`}>
                {loading ? (
                    <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
                        <Loader2 className="h-5 w-5 animate-spin" /> Cargando tus cursos…
                    </div>
                ) : (
                    <>
                        {/* ── PGA (en modo embebido ya está en la cabecera) ── */}
                        {!embedded && data?.pga != null && (
                            <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                                <span className="text-sm font-extrabold text-slate-700 inline-flex items-center gap-1.5">
                                    Promedio ponderado del período
                                    <Info className="h-3.5 w-3.5 text-emerald-600"
                                        title="Ponderado por créditos de tus cursos con nota" />
                                </span>
                                <span className={`text-2xl font-black tabular-nums ${data.pga >= 11 ? "text-emerald-700" : "text-rose-600"}`}>
                                    {Number(data.pga).toFixed(2)}
                                </span>
                            </div>
                        )}

                        {/* ── Tarjetas por curso ── */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {cursos.map((c) => (
                                <div key={`${c.code}-${c.seccion}`}
                                    className="rounded-xl border border-slate-200 p-4 space-y-3">
                                    <div>
                                        <p className="text-[11px] font-bold text-violet-600">{c.code}</p>
                                        <p className="text-sm font-extrabold text-slate-800 leading-snug">
                                            {(c.name || "").toUpperCase()}
                                        </p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">
                                            {c.teacher || "Docente por asignar"}
                                            {c.seccion ? ` · Sec. ${c.seccion}` : ""} · {c.credits} créd.
                                        </p>
                                    </div>

                                    {/* Notas */}
                                    <div className="grid grid-cols-4 gap-2 text-center">
                                        {[["C1", c.c1, c.c1_level], ["C2", c.c2, c.c2_level], ["C3", c.c3, c.c3_level]].map(([lbl, v, lv]) => (
                                            <div key={lbl}>
                                                <p className="text-[10px] font-bold text-slate-400">{lbl}</p>
                                                <p className={`text-lg font-black tabular-nums ${v == null ? "text-slate-300" : "text-blue-600"}`}
                                                    title={lv ? `Nivel: ${lv}` : ""}>
                                                    {v ?? "—"}
                                                </p>
                                            </div>
                                        ))}
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400">Promedio</p>
                                            <p className={`text-lg font-black tabular-nums ${notaColor(c.promedio)}`}>
                                                {c.promedio ?? "—"}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        {c.calificacion ? (
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${CALIF_BADGE[c.calificacion] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                                                {c.calificacion}{c.procesado ? " ✓" : ""}
                                            </span>
                                        ) : (
                                            <span className="text-[10px] text-slate-400">Sin notas registradas aún</span>
                                        )}

                                        {/* Asistencia */}
                                        <div className="flex items-center gap-3 text-[11px]">
                                            <span className="inline-flex items-center gap-1 text-slate-500">
                                                <UserCheck className="h-3 w-3" /> {c.sesiones} ses.
                                            </span>
                                            <span className={c.faltas > 0 ? "text-rose-600 font-bold" : "text-slate-500"}>
                                                Faltas: {c.faltas}
                                            </span>
                                            <span className={`font-black ${c.en_riesgo ? "text-rose-600" : c.pct_faltas > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                                                {c.pct_faltas}%
                                            </span>
                                        </div>
                                    </div>

                                    {c.en_riesgo && (
                                        <div className="flex items-center gap-1.5 rounded-lg bg-rose-50 border border-rose-200 px-2.5 py-1.5 text-[10px] font-bold text-rose-700">
                                            <AlertTriangle className="h-3 w-3" />
                                            Superaste el 30% de inasistencias — riesgo de DPI en este curso
                                        </div>
                                    )}

                                    {c.section_id && (
                                        <div className="flex justify-end">
                                            <button
                                                type="button"
                                                onClick={() => setDetalleId(c.section_id)}
                                                className="inline-flex items-center gap-1 text-[11px] font-extrabold text-violet-700 bg-violet-50 hover:bg-violet-100 px-2.5 py-1 rounded-full transition-colors"
                                            >
                                                VER DETALLE <ChevronRight className="h-3 w-3" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {!cursos.length && (
                                <div className="md:col-span-2 py-8 text-center text-sm text-slate-400">
                                    No tienes cursos matriculados en {effective}
                                    <button type="button" onClick={load}
                                        className="ml-2 inline-flex items-center gap-1 text-blue-600 text-xs font-semibold">
                                        <RefreshCw className="h-3 w-3" /> Reintentar
                                    </button>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </CardContent>

            {/* ── Modal Ver detalle ── */}
            <CourseDetailModal
                open={!!detalleId}
                onClose={() => setDetalleId(null)}
                sectionId={detalleId}
            />
        </Card>
    );
}
