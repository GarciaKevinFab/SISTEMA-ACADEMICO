// Horario de asignaturas del ESTUDIANTE — módulo propio al estilo "vida
// académica" de los portales universitarios: rejilla semanal con bloques
// por curso (nombre, hora, aula, docente, cada curso con su color),
// cuadro resumen de asignaturas y descarga del horario en PDF.
import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
    CalendarDays, Clock, MapPin, UserRound, Download, Loader2, BookOpen,
} from "lucide-react";
import { api } from "@/lib/api";

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

/* Paleta por curso (se asigna en orden estable) */
const PALETA = [
    { bg: "bg-blue-50", border: "border-blue-200", dot: "text-blue-700" },
    { bg: "bg-emerald-50", border: "border-emerald-200", dot: "text-emerald-700" },
    { bg: "bg-violet-50", border: "border-violet-200", dot: "text-violet-700" },
    { bg: "bg-amber-50", border: "border-amber-200", dot: "text-amber-700" },
    { bg: "bg-rose-50", border: "border-rose-200", dot: "text-rose-700" },
    { bg: "bg-sky-50", border: "border-sky-200", dot: "text-sky-700" },
    { bg: "bg-teal-50", border: "border-teal-200", dot: "text-teal-700" },
    { bg: "bg-orange-50", border: "border-orange-200", dot: "text-orange-700" },
];

const romanos = (t) =>
    String(t || "").replace(/\b(i{1,3}|iv|v|vi{1,3}|ix|x|xi{1,3})\b/gi,
        (m) => m.toUpperCase());

const hhmm = (t) => String(t || "").slice(0, 5);

export default function StudentSchedulePage() {
    const [slots, setSlots] = useState([]);
    const [period, setPeriod] = useState("");
    const [loading, setLoading] = useState(true);
    const [descargando, setDescargando] = useState(false);

    useEffect(() => {
        let cancel = false;
        (async () => {
            try {
                const { data } = await api.get("/academic/student/schedule");
                if (cancel) return;
                setSlots(Array.isArray(data?.schedule) ? data.schedule : []);
                setPeriod(data?.period || "");
            } catch {
                if (!cancel) setSlots([]);
            } finally { if (!cancel) setLoading(false); }
        })();
        return () => { cancel = true; };
    }, []);

    /* Color estable por curso */
    const colorDe = useMemo(() => {
        const cursos = [...new Set(slots.map((s) => s.course || s.name))].sort();
        const m = new Map();
        cursos.forEach((c, i) => m.set(c, PALETA[i % PALETA.length]));
        return (c) => m.get(c) || PALETA[0];
    }, [slots]);

    /* Bloques por día, ordenados por hora */
    const porDia = useMemo(() => {
        const m = Object.fromEntries(DIAS.map((d) => [d, []]));
        for (const s of slots) {
            const d = DIAS.find((x) => x.toLowerCase() === String(s.day || "").toLowerCase());
            if (d) m[d].push(s);
        }
        for (const d of DIAS) m[d].sort((a, b) => String(a.time).localeCompare(String(b.time)));
        return m;
    }, [slots]);

    const diasVisibles = useMemo(
        () => DIAS.filter((d, i) => i < 6 || porDia[d].length > 0),
        [porDia]);

    /* Cuadro resumen (asignatura única) */
    const resumen = useMemo(() => {
        const m = new Map();
        for (const s of slots) {
            const k = s.course || s.name;
            if (!m.has(k)) m.set(k, { curso: k, code: s.code || "", teacher: s.teacher || "", rooms: new Set() });
            if (s.room) m.get(k).rooms.add(s.room);
        }
        return [...m.values()].sort((a, b) => a.curso.localeCompare(b.curso, "es"));
    }, [slots]);

    const descargar = async () => {
        setDescargando(true);
        try {
            const res = await api.get("/academic/schedules/export/pdf",
                { responseType: "blob" });
            const blob = res?.data instanceof Blob ? res.data : new Blob([res.data]);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = "mi-horario.pdf";
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => window.URL.revokeObjectURL(url), 60000);
        } catch {
            toast.error("No se pudo descargar el horario");
        } finally { setDescargando(false); }
    };

    return (
        <div className="space-y-4">
            <Card className="border shadow-sm rounded-2xl">
                <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-violet-100 grid place-items-center">
                                <CalendarDays className="h-5 w-5 text-violet-600" />
                            </div>
                            <div>
                                <CardTitle className="text-base">Horario de asignaturas</CardTitle>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    {period ? `Período ${period}` : "Período actual"} · tu semana de clases
                                </p>
                            </div>
                        </div>
                        <Button onClick={descargar} disabled={descargando}
                            className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white">
                            {descargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            Descargar PDF
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
                            <Loader2 className="h-5 w-5 animate-spin" /> Cargando tu horario…
                        </div>
                    ) : slots.length === 0 ? (
                        <div className="py-12 text-center">
                            <div className="h-14 w-14 rounded-2xl bg-slate-100 grid place-items-center mx-auto mb-3">
                                <CalendarDays className="h-6 w-6 text-slate-300" />
                            </div>
                            <p className="text-sm font-bold text-slate-500">Sin horario registrado</p>
                            <p className="text-xs text-slate-400 mt-1">
                                Se mostrará cuando Secretaría publique el horario del período.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                            {diasVisibles.map((dia) => (
                                <div key={dia} className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                                    <div className={"px-3 py-2 text-[11px] font-extrabold tracking-wide text-center " +
                                        (porDia[dia].length ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-400")}>
                                        {dia.toUpperCase()}
                                    </div>
                                    <div className="p-2 space-y-2 min-h-[80px]">
                                        {porDia[dia].length === 0 ? (
                                            <p className="text-[10px] text-slate-300 text-center py-4">Libre</p>
                                        ) : porDia[dia].map((s, i) => {
                                            const c = colorDe(s.course || s.name);
                                            return (
                                                <div key={i} className={`rounded-lg border ${c.border} ${c.bg} p-2.5`}>
                                                    <p className="text-[11.5px] font-extrabold text-slate-800 leading-snug">
                                                        {romanos(s.course || s.name)}
                                                    </p>
                                                    {s.code && (
                                                        <p className="text-[9.5px] text-slate-400 font-mono mt-0.5">{s.code}</p>
                                                    )}
                                                    <p className={`inline-flex items-center gap-1 text-[10.5px] font-bold mt-1.5 ${c.dot}`}>
                                                        <Clock className="h-3 w-3" /> {hhmm(s.time)} – {hhmm(s.end)}
                                                    </p>
                                                    {s.room && (
                                                        <p className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5">
                                                            <MapPin className="h-3 w-3 shrink-0" /> Aula {s.room}
                                                        </p>
                                                    )}
                                                    {s.teacher && (
                                                        <p className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5"
                                                            title={s.teacher}>
                                                            <UserRound className="h-3 w-3 shrink-0" />
                                                            <span className="truncate">{s.teacher}</span>
                                                        </p>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ── Cuadro resumen ── */}
            {resumen.length > 0 && (
                <Card className="border shadow-sm rounded-2xl">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-violet-600" /> Cuadro resumen
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 border-b">
                                        <th className="px-4 py-2 text-left">Asignatura</th>
                                        <th className="px-4 py-2 text-left">Código</th>
                                        <th className="px-4 py-2 text-left">Docente</th>
                                        <th className="px-4 py-2 text-left">Aula(s)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {resumen.map((r) => {
                                        const c = colorDe(r.curso);
                                        return (
                                            <tr key={r.curso} className="hover:bg-slate-50/60">
                                                <td className="px-4 py-2.5 font-bold text-slate-700">
                                                    <span className={`inline-block h-2 w-2 rounded-full mr-2 ${c.bg} ring-1 ${c.border}`} />
                                                    {romanos(r.curso)}
                                                </td>
                                                <td className="px-4 py-2.5 font-mono text-slate-500">{r.code || "—"}</td>
                                                <td className="px-4 py-2.5 text-slate-600">{r.teacher || "—"}</td>
                                                <td className="px-4 py-2.5 text-slate-500">
                                                    {[...r.rooms].join(", ") || "—"}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
