/* ═══════════════════════════════════════════════════════════════
   StudentAttendancePanel — "Mis Inasistencias"
   El alumno ve su asistencia por curso: sesiones, faltas, tardanzas
   y % de inasistencia con alerta de riesgo DPI (>30%).
   Puede descargar su reporte de asistencia en PDF.
   ═══════════════════════════════════════════════════════════════ */
import React, { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
    Loader2, UserCheck, AlertTriangle, Download, ChevronRight, CheckCircle2,
} from "lucide-react";
import api from "@/lib/api";
import { useActivePeriod } from "@/hooks/useActivePeriod";
import { CourseDetailModal } from "./StudentCoursesPanel";

function periodOptions() {
    const y = new Date().getFullYear();
    const out = [];
    for (let i = y; i >= y - 4; i--) { out.push(`${i}-II`); out.push(`${i}-I`); }
    return out;
}

export default function StudentAttendancePanel({ embedded = false, period: periodProp = "" }) {
    const { period: activePeriod } = useActivePeriod();
    const [period, setPeriod] = useState("");
    const [cursos, setCursos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [descargando, setDescargando] = useState(false);
    const [detalleId, setDetalleId] = useState(null);

    const effective = periodProp || period || activePeriod;

    const load = useCallback(async () => {
        if (!effective) return;
        setLoading(true);
        try {
            const { data } = await api.get("/academic/student/me/cursos",
                { params: { period: effective } });
            setCursos(data?.cursos || []);
        } catch (e) {
            setCursos([]);
            toast.error(e?.response?.data?.detail || "No se pudo cargar tu asistencia");
        } finally {
            setLoading(false);
        }
    }, [effective]);
    useEffect(() => { load(); }, [load]);

    const descargar = async () => {
        setDescargando(true);
        try {
            const res = await api.get("/academic/student/me/asistencia.pdf",
                { params: { period: effective }, responseType: "blob" });
            const blob = res?.data instanceof Blob ? res.data : new Blob([res.data]);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = `mi-asistencia-${effective}.pdf`;
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => window.URL.revokeObjectURL(url), 60000);
            toast.success("Reporte descargado");
        } catch (e) {
            let msg = "No se pudo generar el reporte";
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

    const enRiesgo = cursos.filter((c) => c.en_riesgo).length;
    const totalFaltas = cursos.reduce((a, c) => a + (c.faltas || 0), 0);

    return (
        <Card className="border shadow-sm rounded-2xl">
            {!embedded && (
            <CardHeader className="pb-3">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <CardTitle className="text-base flex items-center gap-2">
                            <UserCheck className="h-4 w-4 text-blue-600" /> Mis Inasistencias
                        </CardTitle>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Tu asistencia registrada por cada docente. Con más de 30% de faltas
                            en un curso quedas desaprobado por inasistencia (DPI).
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
                        <Button size="sm" variant="outline" onClick={descargar}
                            disabled={descargando || !cursos.length} className="gap-1.5 h-9">
                            {descargando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                            PDF
                        </Button>
                    </div>
                </div>
            </CardHeader>
            )}
            <CardContent className={`space-y-3 ${embedded ? "pt-4" : ""}`}>
                {loading ? (
                    <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
                        <Loader2 className="h-5 w-5 animate-spin" /> Cargando tu asistencia…
                    </div>
                ) : (
                    <>
                        {/* Resumen (en modo embebido ya está arriba) */}
                        {!embedded && cursos.length > 0 && (
                            <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${enRiesgo > 0 ? "border-rose-200 bg-rose-50" : "border-emerald-200 bg-emerald-50"}`}>
                                {enRiesgo > 0
                                    ? <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
                                    : <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />}
                                <p className={`text-xs font-semibold ${enRiesgo > 0 ? "text-rose-800" : "text-emerald-800"}`}>
                                    {enRiesgo > 0
                                        ? `Atención: tienes ${enRiesgo} curso(s) en riesgo de DPI por inasistencia.`
                                        : "Tu asistencia está dentro del rango permitido en todos tus cursos."}
                                    {totalFaltas > 0 && <span className="font-normal"> · {totalFaltas} falta(s) en total este período.</span>}
                                </p>
                            </div>
                        )}

                        {/* Tarjetas por curso */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {cursos.map((c) => (
                                <div key={`${c.code}-${c.seccion}`}
                                    className={`rounded-xl border p-4 space-y-2.5 ${c.en_riesgo ? "border-rose-200 bg-rose-50/40" : "border-slate-200"}`}>
                                    <div>
                                        <p className="text-[11px] font-bold text-violet-600">{c.code}</p>
                                        <p className="text-sm font-extrabold text-slate-800 leading-snug">
                                            {(c.name || "").toUpperCase()}
                                        </p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">
                                            {c.teacher || "Docente por asignar"}{c.seccion ? ` · Sec. ${c.seccion}` : ""}
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-4 gap-2 text-center">
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400">Sesiones</p>
                                            <p className="text-lg font-black text-slate-700">{c.sesiones}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400">Faltas</p>
                                            <p className={`text-lg font-black ${c.faltas > 0 ? "text-rose-600" : "text-slate-300"}`}>{c.faltas}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400">Tardanzas</p>
                                            <p className={`text-lg font-black ${c.tardanzas > 0 ? "text-amber-600" : "text-slate-300"}`}>{c.tardanzas}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400">% Faltas</p>
                                            <p className={`text-lg font-black ${c.en_riesgo ? "text-rose-600" : c.pct_faltas > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                                                {c.pct_faltas}%
                                            </p>
                                        </div>
                                    </div>

                                    {c.en_riesgo && (
                                        <div className="flex items-center gap-1.5 rounded-lg bg-rose-100 border border-rose-200 px-2.5 py-1.5 text-[10px] font-bold text-rose-700">
                                            <AlertTriangle className="h-3 w-3" />
                                            Superaste el 30% — riesgo de DPI en este curso
                                        </div>
                                    )}

                                    {c.section_id && (
                                        <div className="flex justify-end">
                                            <button type="button" onClick={() => setDetalleId(c.section_id)}
                                                className="inline-flex items-center gap-1 text-[11px] font-extrabold text-violet-700 bg-violet-50 hover:bg-violet-100 px-2.5 py-1 rounded-full">
                                                VER DETALLE <ChevronRight className="h-3 w-3" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {!cursos.length && (
                                <div className="md:col-span-2 py-8 text-center text-sm text-slate-400">
                                    No tienes cursos matriculados en {effective}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </CardContent>

            <CourseDetailModal open={!!detalleId} onClose={() => setDetalleId(null)} sectionId={detalleId} />
        </Card>
    );
}
