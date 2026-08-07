/* ═══════════════════════════════════════════════════════════════
   StudentSemesterPanel — "Mi Semestre"
   Todo lo del período EN CURSO en un solo lugar:
     · Notas en vivo (lo que el docente va cargando, aún no oficial)
     · Asistencia e inasistencias con alerta DPI
   El histórico oficial consolidado vive en Kárdex (otra pestaña).
   ═══════════════════════════════════════════════════════════════ */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
    Loader2, BookOpen, UserCheck, Download, Info, AlertTriangle, GraduationCap,
} from "lucide-react";
import api from "@/lib/api";
import { useActivePeriod } from "@/hooks/useActivePeriod";
import StudentCoursesPanel from "./StudentCoursesPanel";
import StudentAttendancePanel from "./StudentAttendancePanel";

function periodOptions() {
    const y = new Date().getFullYear();
    const out = [];
    for (let i = y; i >= y - 4; i--) { out.push(`${i}-II`); out.push(`${i}-I`); }
    return out;
}

export default function StudentSemesterPanel({ goKardex }) {
    const { period: activePeriod } = useActivePeriod();
    const [period, setPeriod] = useState("");
    const [resumen, setResumen] = useState(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState("notas");
    const [busy, setBusy] = useState("");

    const effective = period || activePeriod;

    const load = useCallback(async () => {
        if (!effective) return;
        setLoading(true);
        try {
            const { data } = await api.get("/academic/student/me/cursos",
                { params: { period: effective } });
            setResumen(data);
        } catch {
            setResumen(null);
        } finally {
            setLoading(false);
        }
    }, [effective]);
    useEffect(() => { load(); }, [load]);

    const stats = useMemo(() => {
        const cursos = resumen?.cursos || [];
        return {
            cursos: cursos.length,
            creditos: cursos.reduce((a, c) => a + (c.credits || 0), 0),
            conNota: cursos.filter((c) => c.promedio != null).length,
            enRiesgo: cursos.filter((c) => c.en_riesgo).length,
            pga: resumen?.pga,
        };
    }, [resumen]);

    const descargar = async (tipo) => {
        setBusy(tipo);
        try {
            const url = tipo === "boleta"
                ? "/academic/student/me/boleta.pdf"
                : "/academic/student/me/asistencia.pdf";
            const res = await api.get(url, { params: { period: effective }, responseType: "blob" });
            const blob = res?.data instanceof Blob ? res.data : new Blob([res.data]);
            const href = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = href;
            a.download = `mi-${tipo}-${effective}.pdf`;
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => window.URL.revokeObjectURL(href), 60000);
            toast.success("Descarga iniciada");
        } catch (e) {
            let msg = "No se pudo generar el documento";
            try {
                if (e?.response?.data instanceof Blob) {
                    msg = JSON.parse(await e.response.data.text())?.detail || msg;
                }
            } catch { /* ignore */ }
            toast.error(msg);
        } finally {
            setBusy("");
        }
    };

    return (
        <div className="space-y-4">
            {/* ── Cabecera: período + resumen + descargas ── */}
            <Card className="border shadow-sm rounded-2xl overflow-hidden">
                <CardContent className="p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <div className="h-9 w-9 rounded-xl bg-blue-100 grid place-items-center shrink-0">
                                <GraduationCap className="h-4 w-4 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm font-extrabold text-slate-800 leading-none">Mi Semestre</p>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                    Avance del período en curso — se actualiza cuando tus docentes registran
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <select
                                className="h-9 px-2 text-sm rounded-md border border-slate-200 bg-white"
                                value={effective || ""}
                                onChange={(e) => setPeriod(e.target.value)}
                            >
                                {periodOptions().map((p) => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                            <Button size="sm" variant="outline" className="gap-1.5 h-9"
                                disabled={!!busy} onClick={() => descargar("boleta")}>
                                {busy === "boleta" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                                Boleta
                            </Button>
                            <Button size="sm" variant="outline" className="gap-1.5 h-9"
                                disabled={!!busy} onClick={() => descargar("asistencia")}>
                                {busy === "asistencia" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                                Asistencia
                            </Button>
                        </div>
                    </div>

                    {/* Resumen rápido */}
                    {loading ? (
                        <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                            <Loader2 className="h-4 w-4 animate-spin" /> Cargando tu semestre…
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div className="rounded-xl border border-slate-200 px-3 py-2">
                                <p className="text-[10px] font-bold uppercase text-slate-400">Cursos</p>
                                <p className="text-xl font-black text-slate-700">{stats.cursos}</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 px-3 py-2">
                                <p className="text-[10px] font-bold uppercase text-slate-400">Créditos</p>
                                <p className="text-xl font-black text-slate-700">{stats.creditos}</p>
                            </div>
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                                <p className="text-[10px] font-bold uppercase text-emerald-600">Promedio</p>
                                <p className="text-xl font-black text-emerald-700">
                                    {stats.pga != null ? Number(stats.pga).toFixed(2) : "—"}
                                </p>
                            </div>
                            <div className={`rounded-xl border px-3 py-2 ${stats.enRiesgo > 0 ? "border-rose-200 bg-rose-50" : "border-slate-200"}`}>
                                <p className={`text-[10px] font-bold uppercase ${stats.enRiesgo > 0 ? "text-rose-600" : "text-slate-400"}`}>
                                    Riesgo DPI
                                </p>
                                <p className={`text-xl font-black ${stats.enRiesgo > 0 ? "text-rose-700" : "text-slate-400"}`}>
                                    {stats.enRiesgo}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Aviso: dónde está el histórico oficial */}
                    <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-2">
                        <Info className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-blue-800 leading-relaxed">
                            Estas notas son <b>del período en curso</b> y pueden cambiar hasta que Secretaría
                            Académica cierre el semestre. Tu <b>historial oficial de todos los períodos</b>,
                            créditos aprobados y constancias están en{" "}
                            {goKardex ? (
                                <button type="button" onClick={goKardex}
                                    className="font-extrabold underline underline-offset-2 hover:text-blue-900">
                                    Kárdex
                                </button>
                            ) : <b>Estudiante → Mi Kárdex</b>}. Para períodos anteriores, cambia el
                            selector de período de arriba.
                        </p>
                    </div>

                    {stats.enRiesgo > 0 && (
                        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2">
                            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                            <p className="text-[11px] font-semibold text-rose-800">
                                Tienes {stats.enRiesgo} curso(s) con más de 30% de inasistencia —
                                revisa la pestaña Asistencia.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ── Notas / Asistencia ── */}
            <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="grid w-full max-w-md grid-cols-2 h-auto p-1 gap-1 bg-slate-50 border border-slate-200 rounded-xl">
                    <TabsTrigger value="notas" className="text-xs gap-1.5 py-2">
                        <BookOpen className="h-3.5 w-3.5" /> Notas
                    </TabsTrigger>
                    <TabsTrigger value="asistencia" className="text-xs gap-1.5 py-2">
                        <UserCheck className="h-3.5 w-3.5" /> Asistencia
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="notas" className="mt-3">
                    <StudentCoursesPanel embedded period={effective} />
                </TabsContent>
                <TabsContent value="asistencia" className="mt-3">
                    <StudentAttendancePanel embedded period={effective} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
