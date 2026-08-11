/* ═══════════════════════════════════════════════════════════════
   AttendanceMonthGrid — Registro de Asistencia MENSUAL (estilo SIAGIE)
   - Grilla alumnos × días del mes con marcas P/T/F/J/0
   - Solo se habilitan los días de dictado según el HORARIO configurado
     a la sección (SectionScheduleSlot). Si la sección no tiene horario,
     se asume lunes a viernes.
   - "Completar asistencias": llena con P todos los días de clase hasta
     el día elegido (respeta días cerrados y lo ya marcado)
   - "Limpiar": borra todas las marcas no cerradas
   - "Grabar": guarda el mes completo
   - Días sin clase en gris; sesiones cerradas con candado
   ═══════════════════════════════════════════════════════════════ */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Save, Eraser, CheckSquare, Lock, RefreshCw, FileText } from "lucide-react";
import api from "@/lib/api";

const MARCAS = ["P", "T", "F", "J", "0"];      // ciclo al hacer clic
const COLOR = {
    P: "text-emerald-700 bg-emerald-50",
    T: "text-amber-700 bg-amber-50",
    F: "text-rose-700 bg-rose-100 font-extrabold",
    J: "text-blue-700 bg-blue-50",
    "0": "text-slate-500 bg-slate-200",
};

function mesActual() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/* Día de dictado. El backend envía has_class según el horario de la sección;
   si viniera sin ese campo (backend antiguo) se cae al criterio L-V. */
const esDiaClase = (d) => (d?.has_class === undefined ? !d?.weekend : !!d.has_class);

export default function AttendanceMonthGrid({ sectionId, sectionLabel }) {
    const [month, setMonth] = useState(mesActual());
    const [data, setData] = useState(null);
    const [marks, setMarks] = useState({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [hastaDia, setHastaDia] = useState(String(new Date().getDate()));
    const [dirty, setDirty] = useState(false);
    const [descargando, setDescargando] = useState(false);

    const load = useCallback(async () => {
        if (!sectionId) return;
        setLoading(true);
        try {
            const { data: d } = await api.get(
                `/academic/sections/${sectionId}/attendance/mes`, { params: { month } });
            setData(d);
            setMarks(JSON.parse(JSON.stringify(d?.marks || {})));
            setDirty(false);
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Error cargando el registro mensual");
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [sectionId, month]);
    useEffect(() => { load(); }, [load]);

    const days = useMemo(() => data?.days || [], [data]);
    const students = useMemo(() => data?.students || [], [data]);
    const closedSet = useMemo(() => new Set(data?.closed_days || []), [data]);
    // Días en los que realmente se dicta el curso (según horario configurado)
    const classDays = useMemo(() => days.filter(esDiaClase), [days]);

    // El selector "Completar hasta día" solo ofrece días de clase: si el valor
    // actual no lo es, se reubica en el último día de clase ya transcurrido.
    useEffect(() => {
        if (!classDays.length) return;
        const hoy = new Date();
        const esMesEnCurso =
            month === `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
        setHastaDia((prev) => {
            const p = parseInt(prev, 10);
            if (classDays.some((d) => d.day === p)) return prev;
            const tope = esMesEnCurso ? hoy.getDate() : 31;
            const lista = classDays.filter((d) => d.day <= tope);
            const base = lista.length ? lista : classDays;
            return String(base[base.length - 1].day);
        });
    }, [classDays, month]);

    const setMark = (sid, day, value) => {
        setMarks((prev) => {
            const porAlumno = { ...(prev[String(sid)] || {}) };
            if (value) porAlumno[String(day)] = value;
            else delete porAlumno[String(day)];
            return { ...prev, [String(sid)]: porAlumno };
        });
        setDirty(true);
    };

    const cycle = (sid, day) => {
        const cur = marks[String(sid)]?.[String(day)] || "";
        const idx = MARCAS.indexOf(cur);
        const next = idx === -1 ? MARCAS[0] : (idx === MARCAS.length - 1 ? "" : MARCAS[idx + 1]);
        setMark(sid, day, next);
    };

    const completar = () => {
        const limite = parseInt(hastaDia, 10) || 0;
        const habiles = classDays.filter(
            (d) => d.day <= limite && !closedSet.has(d.day));
        if (!habiles.length) {
            toast.error(
                data?.has_schedule
                    ? `No hay días de clase hasta el ${limite}. El curso se dicta: ${data.schedule_label}.`
                    : `No hay días hábiles hasta el ${limite} (los sábados, domingos y días cerrados se omiten).`);
            return;
        }

        // Se calcula fuera del setState para reportar el conteo correcto
        const out = { ...marks };
        let n = 0;
        for (const st of students) {
            if (st.estado === "LICENCIA") continue;
            const sid = String(st.id);
            const porAlumno = { ...(out[sid] || {}) };
            for (const d of habiles) {
                if (!porAlumno[String(d.day)]) {
                    porAlumno[String(d.day)] = "P";
                    n += 1;
                }
            }
            out[sid] = porAlumno;
        }
        setMarks(out);
        setDirty(true);
        const diasTxt = habiles.map((d) => d.day).join(", ");
        const nAlumnos = students.filter((s) => s.estado !== "LICENCIA").length;
        toast.success(
            n > 0
                ? `Completado con P en ${n} casillero(s): ${nAlumnos} alumno(s) × ${habiles.length} día(s) de clase hasta el ${limite} (${diasTxt}). Ahora cambia solo las excepciones y presiona Grabar.`
                : "Todos los casilleros de los días de clase hasta ese día ya tenían marca.",
            { duration: 6000 });
    };

    const descargarPdf = async () => {
        setDescargando(true);
        try {
            const res = await api.get(
                `/academic/sections/${sectionId}/attendance/mes.pdf`,
                { params: { month }, responseType: "blob" });
            const blob = res?.data instanceof Blob ? res.data : new Blob([res.data]);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = `asistencia-${month}.pdf`;
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => window.URL.revokeObjectURL(url), 60000);
            toast.success("Registro del mes y estadística del ciclo descargados");
        } catch (e) {
            let msg = "No se pudo generar el PDF";
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

    const limpiar = () => {
        setMarks((prev) => {
            const out = {};
            for (const [sid, porAlumno] of Object.entries(prev)) {
                const keep = {};
                for (const [d, v] of Object.entries(porAlumno || {})) {
                    if (closedSet.has(parseInt(d, 10))) keep[d] = v;   // cerrados no se tocan
                }
                if (Object.keys(keep).length) out[sid] = keep;
            }
            return out;
        });
        setDirty(true);
        toast.info("Marcas limpiadas (los días cerrados se conservan). Presiona Grabar para confirmar.");
    };

    const grabar = async () => {
        setSaving(true);
        try {
            // Enviar TODAS las celdas de días no cerrados (las vacías eliminan).
            // Solo días de dictado y sin alumnos con licencia: las marcas
            // heredadas de sábados/domingos ya no se re-graban (el backend
            // además las purga vía `days`).
            const payload = {};
            for (const st of students) {
                if (st.estado === "LICENCIA") continue;
                const sid = String(st.id);
                payload[sid] = {};
                for (const d of days) {
                    if (closedSet.has(d.day) || !esDiaClase(d)) continue;
                    const v = marks[sid]?.[String(d.day)] || "";
                    if (v) payload[sid][String(d.day)] = v;
                }
            }
            // días tocados (antes o ahora) → el backend borra los que quedaron vacíos
            const diasTocados = new Set();
            for (const st of students) {
                for (const d of Object.keys(data?.marks?.[String(st.id)] || {})) diasTocados.add(parseInt(d, 10));
                for (const d of Object.keys(payload[String(st.id)] || {})) diasTocados.add(parseInt(d, 10));
            }
            const { data: res } = await api.post(
                `/academic/sections/${sectionId}/attendance/mes`,
                { month, marks: payload, days: [...diasTocados].filter((d) => !closedSet.has(d)) });
            toast.success(res?.message || "Asistencia grabada");
            load();
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Error al grabar la asistencia");
        } finally {
            setSaving(false);
        }
    };

    if (!sectionId) {
        return <p className="text-sm text-slate-400 py-8 text-center">Seleccione una sección</p>;
    }

    return (
        <div className="space-y-3">
            {/* ── Controles ── */}
            <div className="flex flex-wrap items-center gap-2">
                <input
                    type="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className="h-9 px-2 text-sm rounded-md border border-slate-200"
                />
                <span className="text-xs text-slate-500">Completar hasta día</span>
                <select
                    value={hastaDia}
                    onChange={(e) => setHastaDia(e.target.value)}
                    className="h-9 px-2 text-sm rounded-md border border-slate-200"
                >
                    {classDays.map((d) => (
                        <option key={d.day} value={d.day}>{d.day} · {d.letra}</option>
                    ))}
                </select>
                <Button size="sm" onClick={completar} disabled={loading || !classDays.length}
                    className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 h-9">
                    <CheckSquare className="h-3.5 w-3.5" /> Completar asistencias
                </Button>
                <Button size="sm" onClick={limpiar} disabled={loading} variant="outline"
                    className="gap-1.5 h-9 border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                    <Eraser className="h-3.5 w-3.5" /> Limpiar
                </Button>
                <div className="flex-1" />
                <Button size="sm" variant="outline" onClick={descargarPdf}
                    disabled={descargando || loading || !students.length}
                    title="Registro del mes + estadística de asistencia de todo el ciclo"
                    className="gap-1.5 h-9 border-rose-300 text-rose-700 hover:bg-rose-50">
                    {descargando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                    PDF + estadística
                </Button>
                <Button size="sm" variant="ghost" onClick={load} disabled={loading} className="h-9">
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                </Button>
                <Button size="sm" onClick={grabar} disabled={saving || loading || !dirty}
                    className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 h-9 font-bold">
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Grabar
                </Button>
            </div>

            {/* ── Leyenda ── */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600">
                <span className="font-bold uppercase text-slate-400 tracking-wider">Leyenda:</span>
                <span><b className="text-emerald-700">P</b> = Presente</span>
                <span><b className="text-amber-700">T</b> = Tardanza</span>
                <span><b className="text-rose-700">F</b> = Falta</span>
                <span><b className="text-blue-700">J</b> = Justificado</span>
                <span><b className="text-slate-500">0</b> = Feriado</span>
                <span className="inline-flex items-center gap-1">
                    <Lock className="h-3 w-3" /> = Día cerrado (no editable)
                </span>
                <span className="inline-flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-sm bg-slate-400" /> Día sin clase
                </span>
            </div>

            {/* ── Horario de dictado ── */}
            {data && (
                <p className="text-[11px] text-slate-600">
                    {data.has_schedule ? (
                        <>
                            <b className="text-emerald-700">Días de dictado:</b> {data.schedule_label}.
                            Solo esos días se pueden marcar y completar.
                        </>
                    ) : (
                        <>
                            <b className="text-amber-700">Esta sección no tiene horario configurado</b>{" "}
                            — se habilita de lunes a viernes. Configure el horario de la sección para
                            que la asistencia se active solo los días de clase.
                        </>
                    )}
                    {data.period_start && data.period_end && (
                        <>
                            {" "}<b className="text-blue-700">Vigencia del período {data.period}:</b>{" "}
                            {data.period_start.split("-").reverse().join("/")} al{" "}
                            {data.period_end.split("-").reverse().join("/")} — fuera de ese
                            rango la asistencia queda deshabilitada
                            (se configura en Configuración → Periodos Académicos).
                        </>
                    )}
                </p>
            )}

            {/* ── Grilla ── */}
            {loading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
                    <Loader2 className="h-5 w-5 animate-spin" /> Cargando registro mensual…
                </div>
            ) : (
                <div className="overflow-auto border rounded-lg max-h-[62vh]">
                    <table className="text-[11px] border-collapse min-w-max">
                        <thead className="sticky top-0 z-10">
                            <tr>
                                <th className="border px-1 py-1 bg-emerald-700 text-white sticky left-0 z-20 w-8">#</th>
                                <th className="border px-2 py-1 bg-emerald-700 text-white text-left sticky left-8 z-20 min-w-[210px]">
                                    APELLIDOS Y NOMBRES
                                </th>
                                {days.map((d) => (
                                    <th key={d.day}
                                        title={esDiaClase(d) ? undefined : "No se dicta clase este día"}
                                        className={`border px-0.5 py-1 text-center w-8 ${esDiaClase(d)
                                            ? "bg-emerald-700 text-white"
                                            : "bg-slate-400 text-white"}`}>
                                        {d.day}<br />
                                        <span className="font-normal">{d.letra}</span>
                                        {closedSet.has(d.day) && <Lock className="h-2.5 w-2.5 mx-auto mt-0.5" />}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {students.map((st, i) => {
                                const lic = st.estado === "LICENCIA";
                                return (
                                    <tr key={st.id} className={lic ? "bg-rose-50/60" : "hover:bg-emerald-50/30"}>
                                        <td className="border px-1 text-center sticky left-0 bg-white z-10">{i + 1}</td>
                                        <td className="border px-2 whitespace-nowrap sticky left-8 bg-white z-10 max-w-[240px]">
                                            <span className="block truncate" title={st.nombre}>{st.nombre}</span>
                                            {lic && <span className="text-[9px] font-bold text-rose-600">LICENCIA</span>}
                                        </td>
                                        {days.map((d) => {
                                            const cerrado = closedSet.has(d.day);
                                            const v = marks[String(st.id)]?.[String(d.day)] || "";
                                            const conClase = esDiaClase(d);
                                            // los días sin dictado nunca se editan; las marcas
                                            // viejas que tuvieran se purgan al Grabar
                                            const bloqueado = cerrado || lic || !conClase;
                                            return (
                                                <td key={d.day}
                                                    className={`border p-0 text-center ${!conClase ? "bg-slate-300" : cerrado ? "bg-slate-100" : ""}`}>
                                                    <button
                                                        type="button"
                                                        disabled={bloqueado}
                                                        onClick={() => cycle(st.id, d.day)}
                                                        title={cerrado ? "Día cerrado"
                                                            : !conClase ? (d.weekend ? "Fin de semana · no se dicta clase" : "No se dicta clase este día")
                                                                : "Clic: P → T → F → J → 0 → vacío"}
                                                        className={`w-8 h-7 text-[11px] font-bold disabled:cursor-not-allowed ${v ? COLOR[v] || "" : ""}`}
                                                    >
                                                        {v}
                                                    </button>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                            {!students.length && (
                                <tr>
                                    <td colSpan={days.length + 2} className="border p-6 text-center text-slate-400">
                                        Sin alumnos matriculados
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
            {sectionLabel && <p className="text-[10px] text-slate-400">{sectionLabel}</p>}
        </div>
    );
}
