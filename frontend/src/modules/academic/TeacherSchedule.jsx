/* ═══════════════════════════════════════════════════════════════
   TeacherSchedule — "Mi Horario" del docente
   Horario semanal del período seleccionado (incluye períodos pasados)
   y descarga en PDF con sus datos personales y foto.
   ═══════════════════════════════════════════════════════════════ */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
    Loader2, CalendarDays, Download, MapPin, Clock, BookOpen, History,
} from "lucide-react";
import api from "@/lib/api";
import { Teacher } from "@/services/academic.service";

const DIAS = ["LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO", "DOMINGO"];
const DIA_INDEX = { Lunes: 0, Martes: 1, Miércoles: 2, Jueves: 3, Viernes: 4, Sábado: 5, Domingo: 6 };

/* 'Desarrollo Personal Ii' → 'Desarrollo Personal II' (los nombres llegan
   title-case y rompen los numerales romanos) */
const romanos = (t) =>
    String(t || "").replace(/\b(i{1,3}|iv|v|vi{1,3}|ix|x|xi{1,3})\b/gi,
        (m) => m.toUpperCase());

export default function TeacherSchedule() {
    const [periodos, setPeriodos] = useState([]);
    const [period, setPeriod] = useState("");
    const [secciones, setSecciones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [descargando, setDescargando] = useState(false);

    /* Períodos con carga académica del docente */
    useEffect(() => {
        let cancel = false;
        (async () => {
            try {
                const { data } = await api.get("/academic/teachers/me/periodos");
                if (cancel) return;
                const list = data?.periods || [];
                setPeriodos(list);
                setPeriod(data?.current && list.some((p) => p.code === data.current)
                    ? data.current
                    : (list[0]?.code || ""));
            } catch {
                if (!cancel) setPeriodos([]);
            }
        })();
        return () => { cancel = true; };
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const d = await Teacher.sectionsMe();
            setSecciones(Array.isArray(d?.sections) ? d.sections : []);
        } catch {
            setSecciones([]);
        } finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => { load(); }, [load]);

    /* Secciones del período elegido, distribuidas por día */
    const porDia = useMemo(() => {
        const grid = DIAS.map(() => []);
        for (const sec of secciones) {
            if (period && sec.period && sec.period !== period) continue;
            for (const slot of (sec.slots || [])) {
                const idx = DIA_INDEX[slot.day] ?? -1;
                if (idx < 0) continue;
                grid[idx].push({
                    course: sec.course_name || sec.course_code || "Curso",
                    label: sec.section_code || sec.label || "A",
                    semester: sec.semester,
                    room: sec.room_name || "",
                    start: slot.start, end: slot.end,
                });
            }
        }
        return grid.map((arr) => arr.sort((a, b) => String(a.start).localeCompare(String(b.start))));
    }, [secciones, period]);

    const cursosPeriodo = useMemo(
        () => secciones.filter((s) => !period || s.period === period),
        [secciones, period]);
    const totalClases = porDia.reduce((a, d) => a + d.length, 0);

    const descargar = async () => {
        setDescargando(true);
        try {
            const res = await api.get("/academic/teachers/me/horario.pdf",
                { params: period ? { period } : {}, responseType: "blob" });
            const blob = res?.data instanceof Blob ? res.data : new Blob([res.data]);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = `mi-horario-${period || "actual"}.pdf`;
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => window.URL.revokeObjectURL(url), 60000);
            toast.success("Horario descargado");
        } catch (e) {
            let msg = "No se pudo generar el horario";
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

    return (
        <Card className="border shadow-sm rounded-2xl">
            <CardHeader className="pb-3">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <CardTitle className="text-base flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 text-blue-600" /> Mi Horario
                        </CardTitle>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Tu horario semanal por período. El PDF incluye tus datos personales y foto.
                        </p>
                    </div>
                    <div className="flex items-end gap-2">
                        <div className="min-w-[150px]">
                            <Label className="text-[10px] font-bold uppercase">Período</Label>
                            <select
                                className="w-full h-9 px-2 text-sm rounded-md border border-slate-200 bg-white"
                                value={period}
                                onChange={(e) => setPeriod(e.target.value)}
                            >
                                {periodos.length === 0 && <option value="">— Sin carga —</option>}
                                {periodos.map((p) => (
                                    <option key={p.code} value={p.code}>
                                        {p.code} ({p.sections} curso{p.sections === 1 ? "" : "s"})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <Button size="sm" onClick={descargar} disabled={descargando || !period}
                            className="gap-1.5 h-9 bg-amber-500 hover:bg-amber-600 text-white">
                            {descargando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                            Descargar PDF
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {periodos.length > 1 && (
                    <p className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                        <History className="h-3.5 w-3.5" />
                        Puedes consultar y descargar horarios de períodos anteriores cambiando el selector.
                    </p>
                )}

                {loading ? (
                    <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
                        <Loader2 className="h-5 w-5 animate-spin" /> Cargando tu horario…
                    </div>
                ) : totalClases === 0 ? (
                    <div className="py-8 text-center">
                        <div className="h-14 w-14 rounded-2xl bg-slate-100 grid place-items-center mx-auto mb-3">
                            <CalendarDays className="h-6 w-6 text-slate-300" />
                        </div>
                        <p className="text-sm font-bold text-slate-500">
                            Sin horario registrado en {period || "este período"}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                            {cursosPeriodo.length > 0
                                ? `Tienes ${cursosPeriodo.length} curso(s) asignado(s), pero aún no se les registró horario.`
                                : "No tienes cursos asignados en este período."}
                        </p>
                        {/* El período se ve COMPLETO aunque falte el horario:
                            se listan igual los cursos asignados */}
                        {cursosPeriodo.length > 0 && (
                            <div className="mt-5 max-w-2xl mx-auto text-left">
                                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 inline-flex items-center gap-1.5">
                                    <BookOpen className="h-3.5 w-3.5" /> Cursos a cargo en {period} ({cursosPeriodo.length})
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {cursosPeriodo.map((s) => (
                                        <span key={s.id} className="text-[11px] bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
                                            <b>{romanos(s.course_name)}</b>
                                            <span className="text-slate-400"> · Ciclo {s.semester ?? "?"} · Sec. {s.section_code || s.label || "A"} · sin horario</span>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Rejilla semanal */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                            {DIAS.map((dia, i) => (
                                <div key={dia} className="rounded-xl border border-slate-200 overflow-hidden">
                                    <div className={`px-3 py-2 text-[11px] font-extrabold tracking-wide ${porDia[i].length ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"}`}>
                                        {dia}
                                    </div>
                                    <div className="p-2 space-y-2 min-h-[64px]">
                                        {porDia[i].length === 0 ? (
                                            <p className="text-[10px] text-slate-300 text-center py-3">Sin clases</p>
                                        ) : porDia[i].map((c, k) => (
                                            <div key={k} className="rounded-lg border border-blue-100 bg-blue-50/50 p-2">
                                                <p className="inline-flex items-center gap-1 text-[10px] font-black text-blue-700">
                                                    <Clock className="h-3 w-3" /> {c.start} – {c.end}
                                                </p>
                                                <p className="text-[11px] font-bold text-slate-700 leading-snug mt-0.5">
                                                    {romanos(c.course)}
                                                </p>
                                                <p className="text-[10px] text-slate-400">
                                                    Ciclo {c.semester ?? "?"} · Sec. {c.label}
                                                    {c.room && <> · <MapPin className="h-2.5 w-2.5 inline" /> {c.room}</>}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Cursos del período */}
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 inline-flex items-center gap-1.5">
                                <BookOpen className="h-3.5 w-3.5" /> Cursos a cargo en {period} ({cursosPeriodo.length})
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {cursosPeriodo.map((s) => (
                                    <span key={s.id} className="text-[11px] bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
                                        <b>{romanos(s.course_name)}</b>
                                        <span className="text-slate-400"> · Ciclo {s.semester ?? "?"} · Sec. {s.section_code || s.label || "A"}</span>
                                    </span>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
