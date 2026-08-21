// Mi Programa — panel del COORDINADOR DE ÁREA ACADÉMICA.
//
// El coordinador es un docente designado en una jefatura de línea con
// programas a cargo. Aquí ve, solo de esos programas:
//   · sus DOCENTES (salen del horario cargado) con los cursos que dictan,
//     el estado de sus sílabos y la descarga de su horario;
//   · el RENDIMIENTO por ciclo de sus estudiantes;
//   · los reportes de sílabos y sesiones, y de asistencia.
//
// El backend valida el alcance: si pide un programa que no tiene a cargo,
// responde 403 aunque cambie el parámetro a mano.
import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
    GraduationCap, Users, FileText, CalendarDays, Loader2, RefreshCw,
    BookOpen, AlertCircle, CheckCircle2, BarChart3, ClipboardList,
} from "lucide-react";
import ModuleShell from "@/components/module/ModuleShell";
import { api } from "../../lib/api";
import { InjectPersonalStyles, SCOPE } from "./personalStyles";

const API = (p) => `${api.defaults.baseURL || ""}${p}`;

export default function MiPrograma() {
    const [data, setData] = useState(null);
    const [periodos, setPeriodos] = useState([]);
    const [period, setPeriod] = useState("");
    const [careerId, setCareerId] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    // Ciclo desplegado con sus alumnos. Se piden aparte porque un programa
    // completo son cientos y no vale la pena traerlos siempre.
    const [ciclo, setCiclo] = useState(null);
    const [alumnos, setAlumnos] = useState([]);
    const [cargandoAlumnos, setCargandoAlumnos] = useState(false);

    const verAlumnos = async (n) => {
        if (ciclo === n) { setCiclo(null); setAlumnos([]); return; }
        setCiclo(n);
        setAlumnos([]);
        setCargandoAlumnos(true);
        try {
            const { data } = await api.get("/personal/me/programa", {
                params: { period, career_id: careerId, semester: n },
            });
            setAlumnos(data?.estudiantes || []);
        } catch (e) {
            toast.error(e?.response?.data?.detail || "No se pudieron cargar los alumnos");
        } finally { setCargandoAlumnos(false); }
    };

    useEffect(() => {
        api.get("/catalogs/periods")
            .then(({ data }) => {
                const its = data?.items || data?.results || data || [];
                setPeriodos(its);
                const act = its.find((p) => p.is_active) || its[0];
                if (act?.code) setPeriod(act.code);
            })
            .catch(() => setPeriodos([]));
    }, []);

    const cargar = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const params = {};
            if (period) params.period = period;
            if (careerId) params.career_id = careerId;
            const { data } = await api.get("/personal/me/programa", { params });
            setData(data);
            if (!careerId && data?.career_id) setCareerId(String(data.career_id));
        } catch (e) {
            setError(e?.response?.data?.detail || "No se pudo cargar tu programa");
            setData(null);
        } finally { setLoading(false); }
    }, [period, careerId]);

    useEffect(() => { cargar(); }, [cargar]);

    const q = `period=${encodeURIComponent(period)}&career_id=${encodeURIComponent(careerId)}`;
    const REPORTES = [
        ["Sílabos y sesiones", ClipboardList, `/academic/admin/evaluation/silabos-sesiones.pdf?${q}`],
        ["Rendimiento (Excel)", BarChart3, `/academic/admin/evaluation/rendimiento.xlsx?${q}`],
        ["Rendimiento (PDF)", BarChart3, `/academic/admin/evaluation/rendimiento.pdf?${q}`],
        ["Asistencia (PDF)", CheckCircle2, `/academic/admin/evaluation/asistencia.pdf?${q}`],
        ["Asistencia (Excel)", CheckCircle2, `/academic/admin/evaluation/asistencia.xlsx?${q}`],
    ];

    return (
        <div className={SCOPE}>
            <InjectPersonalStyles />
            <ModuleShell
                icon={GraduationCap}
                title="Mi Programa"
                subtitle="Coordinación de Área Académica — seguimiento de docentes y estudiantes"
                accent="linear-gradient(135deg, #0EA5E9, #1F4E79)"
            >
                {/* Filtros */}
                <div className="flex flex-wrap items-end gap-3">
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                            Programa
                        </label>
                        <select value={careerId} onChange={(e) => setCareerId(e.target.value)}
                            className="mt-1 h-10 px-3 rounded-xl border border-slate-200 text-sm bg-white min-w-[230px]">
                            {(data?.careers || []).map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                            Período
                        </label>
                        <select value={period} onChange={(e) => setPeriod(e.target.value)}
                            className="mt-1 h-10 px-3 rounded-xl border border-slate-200 text-sm bg-white min-w-[140px]">
                            {periodos.map((p) => (
                                <option key={p.code || p.id} value={p.code}>{p.code}</option>
                            ))}
                        </select>
                    </div>
                    <button onClick={cargar}
                        className="adm-outline inline-flex items-center gap-1.5 px-3 h-10 rounded-xl border border-slate-200 text-[12px] font-bold">
                        <RefreshCw size={13} /> Actualizar
                    </button>
                </div>

                {error ? (
                    <div className="py-14 text-center">
                        <div className="h-14 w-14 rounded-2xl bg-slate-100 grid place-items-center mx-auto mb-3">
                            <AlertCircle className="h-6 w-6 text-slate-300" />
                        </div>
                        <p className="text-slate-700 font-bold text-[13px]">{error}</p>
                    </div>
                ) : loading ? (
                    <div className="py-14 grid place-items-center text-slate-400">
                        <Loader2 className="animate-spin" size={24} />
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Reportes */}
                        <section>
                            <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-500">
                                Reportes del programa
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {REPORTES.map(([rotulo, Icon, ruta]) => (
                                    <a key={rotulo} href={API(ruta)} target="_blank" rel="noreferrer"
                                        className="inline-flex items-center gap-1.5 px-4 h-9 rounded-xl bg-blue-50 text-blue-700 text-[12px] font-bold hover:bg-blue-100">
                                        <Icon size={14} /> {rotulo}
                                    </a>
                                ))}
                            </div>
                        </section>

                        {/* Rendimiento por ciclo */}
                        <section>
                            <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-500">
                                Rendimiento por ciclo
                            </p>
                            <div className="mt-2 rounded-2xl border border-slate-200 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[720px] text-sm">
                                        <thead>
                                            <tr style={{ background: "#1F4E79" }} className="text-white">
                                                {["Ciclo", "Secciones", "Matriculados", "Con nota",
                                                  "Aprobados", "Desaprobados", "Promedio"].map((h) => (
                                                    <th key={h} className="text-left px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.1em]">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(data?.ciclos || []).length === 0 ? (
                                                <tr><td colSpan={7} className="py-10 text-center text-[12px] text-slate-400">
                                                    Sin secciones registradas en este período.
                                                </td></tr>
                                            ) : data.ciclos.map((c, i) => (
                                              <React.Fragment key={c.ciclo}>
                                                <tr onClick={() => verAlumnos(c.ciclo)}
                                                    className={"border-t border-slate-100 cursor-pointer hover:bg-blue-50/60 " + (i % 2 ? "bg-slate-50/60" : "")}>
                                                    <td className="px-4 py-2.5 font-bold text-slate-700">
                                                        Ciclo {c.ciclo || "—"}
                                                        <span className="ml-1.5 text-[10px] font-bold text-blue-600">
                                                            {ciclo === c.ciclo ? "▾ alumnos" : "▸ ver alumnos"}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2.5 text-slate-600">{c.secciones}</td>
                                                    <td className="px-4 py-2.5 text-slate-600">{c.matriculados}</td>
                                                    <td className="px-4 py-2.5 text-slate-600">{c.con_nota}</td>
                                                    <td className="px-4 py-2.5 font-bold text-emerald-700">{c.aprobados}</td>
                                                    <td className="px-4 py-2.5 font-bold text-red-600">{c.desaprobados}</td>
                                                    <td className="px-4 py-2.5 font-extrabold text-slate-800">
                                                        {c.promedio ?? "—"}
                                                    </td>
                                                </tr>
                                                {ciclo === c.ciclo && (
                                                    <tr className="border-t border-slate-100 bg-blue-50/30">
                                                        <td colSpan={7} className="px-4 py-3">
                                                            {cargandoAlumnos ? (
                                                                <span className="inline-flex items-center gap-2 text-[12px] text-slate-400">
                                                                    <Loader2 size={13} className="animate-spin" /> Cargando alumnos…
                                                                </span>
                                                            ) : alumnos.length === 0 ? (
                                                                <span className="text-[12px] text-slate-400">
                                                                    Sin alumnos matriculados en este ciclo.
                                                                </span>
                                                            ) : (
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    {alumnos.map((a) => (
                                                                        <a key={a.student_id}
                                                                            href={API(`/academic/schedules/export/pdf?academic_period=${encodeURIComponent(period)}&student_id=${a.student_id}`)}
                                                                            target="_blank" rel="noreferrer"
                                                                            title={`Horario de ${a.nombre}`}
                                                                            className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full bg-white ring-1 ring-slate-200 text-[11.5px] font-bold text-slate-700 hover:ring-blue-300 hover:text-blue-700">
                                                                            <CalendarDays size={12} className="text-slate-300" />
                                                                            {a.nombre}
                                                                        </a>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )}
                                              </React.Fragment>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </section>

                        {/* Docentes del programa */}
                        <section>
                            <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-500">
                                Docentes del programa
                                <span className="ml-2 font-bold text-slate-400 normal-case tracking-normal">
                                    salen del horario cargado
                                </span>
                            </p>
                            <div className="mt-2 rounded-2xl border border-slate-200 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[820px] text-sm">
                                        <thead>
                                            <tr style={{ background: "#1F4E79" }} className="text-white">
                                                <th className="text-left px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.1em]">Docente</th>
                                                <th className="text-left px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.1em]">Cursos</th>
                                                <th className="text-left px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.1em] w-[110px]">Sílabos</th>
                                                <th className="text-left px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.1em] w-[150px]">Horario</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(data?.docentes || []).length === 0 ? (
                                                <tr><td colSpan={4} className="py-10 text-center text-[12px] text-slate-400">
                                                    Sin docentes con carga en este período.
                                                </td></tr>
                                            ) : data.docentes.map((d, i) => (
                                                <tr key={d.teacher_id || `s${i}`} className={"border-t border-slate-100 " + (i % 2 ? "bg-slate-50/60" : "")}>
                                                    <td className="px-4 py-3">
                                                        <span className="flex items-center gap-2 text-[12.5px] font-bold text-slate-800">
                                                            <Users size={14} className="text-slate-300 shrink-0" />
                                                            {d.nombre}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-[11.5px] text-slate-500">
                                                        <BookOpen size={12} className="inline -mt-0.5 mr-1 text-slate-300" />
                                                        {d.cursos.join(" · ")}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={"inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold border "
                                                            + (d.con_silabo >= d.secciones
                                                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                                : "bg-amber-50 text-amber-700 border-amber-200")}>
                                                            {d.con_silabo}/{d.secciones}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {d.teacher_id && (
                                                            <a href={API(`/academic/teachers/me/horario.pdf?teacher_id=${d.teacher_id}&period=${encodeURIComponent(period)}`)}
                                                                target="_blank" rel="noreferrer"
                                                                className="inline-flex items-center gap-1.5 px-3 h-8 rounded-xl bg-blue-50 text-blue-700 text-[11.5px] font-bold hover:bg-blue-100">
                                                                <CalendarDays size={13} /> Descargar
                                                            </a>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <p className="mt-2 text-[11px] text-slate-400">
                                El horario de un estudiante se descarga desde
                                Académico → Matrícula, con su DNI.
                            </p>
                        </section>
                    </div>
                )}
            </ModuleShell>
        </div>
    );
}
