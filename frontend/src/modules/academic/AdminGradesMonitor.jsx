/* ═══════════════════════════════════════════════════════════════
   AdminGradesMonitor
   Panel admin paralelo al de asistencias, pero para NOTAS.
   - Lista todas las secciones del periodo con su estado de acta.
   - Muestra qué docentes no han cargado notas (semáforo rojo).
   - Permite al admin VER el detalle de notas por alumno y EDITAR
     directo (override admin sobre acta cerrada o no).
   ═══════════════════════════════════════════════════════════════ */
import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
    Loader2, RefreshCw, AlertTriangle, Eye, CheckCircle2, Lock,
    Shield, Search, ListChecks, Save, Pencil, CalendarDays, Unlock,
    Download, Upload,
} from "lucide-react";
import { Grades, Careers, ActaExcel } from "@/services/academic.service";
import ConfirmModal from "@/components/ConfirmModal";
import ActaCalificacionModal from "./ActaCalificacionModal";
import { useActivePeriod } from "@/hooks/useActivePeriod";
import { isoALocal, localAIso } from "@/lib/fechas";

function defaultPeriod() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() < 7 ? "I" : "II"}`;
}
function periodOptions() {
    const y = new Date().getFullYear();
    const out = [];
    for (let i = y + 1; i >= y - 3; i--) { out.push(`${i}-II`); out.push(`${i}-I`); }
    return out;
}
function estadoBadge(estado) {
    if (estado === "APROBADO")    return "bg-emerald-100 text-emerald-800 border-emerald-200";
    if (estado === "DESAPROBADO") return "bg-rose-100 text-rose-800 border-rose-200";
    if (estado === "DPI")         return "bg-violet-100 text-violet-800 border-violet-200";
    return "bg-slate-100 text-slate-600 border-slate-200";
}

export default function AdminGradesMonitor({ periodOverride = null, hideWindow = false }) {
    // Período VIGENTE del sistema (Académico → Periodos), no el del calendario.
    // Si viene periodOverride (embebido en el Centro de Evaluación), se obedece
    // ese período y se oculta el selector propio.
    const { period: ownPeriod, setPeriod: setOwnPeriod } = useActivePeriod();
    const period = periodOverride || ownPeriod;
    const setPeriod = periodOverride ? () => {} : setOwnPeriod;
    const [careerId, setCareerId] = useState("");
    const [q, setQ] = useState("");
    const [careers, setCareers] = useState([]);
    const [overview, setOverview] = useState({ sections: [] });
    const [loading, setLoading] = useState(false);

    const [detailOpen, setDetailOpen] = useState(false);
    const [detail, setDetail] = useState(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [edits, setEdits] = useState({});  // student_id → {final_grade}
    const [saving, setSaving] = useState(false);

    // Acta de Calificación oficial (RVM 123-2022) — Ver/Editar
    const [actaOpen, setActaOpen] = useState(false);
    const [actaSection, setActaSection] = useState(null);

    // Ventana de carga de notas por periodo
    const [gradesWin, setWindow] = useState({ grades_start: null, grades_end: null, has_window: false, is_open: true });
    const [windowOpen, setWindowOpen] = useState(false);
    const [winStart, setWinStart] = useState("");
    const [winEnd, setWinEnd] = useState("");
    const [winSaving, setWinSaving] = useState(false);

    const loadWindow = useCallback(async () => {
        if (!period) return;
        try {
            const d = await Grades.getWindow(period);
            setWindow(d || { grades_start: null, grades_end: null, has_window: false, is_open: true });
        } catch { /* ignore */ }
    }, [period]);
    useEffect(() => { loadWindow(); }, [loadWindow]);

    const openWindowEditor = () => {
        setWinStart(isoALocal(gradesWin.grades_start));
        setWinEnd(isoALocal(gradesWin.grades_end));
        setWindowOpen(true);
    };
    const saveWindow = async () => {
        setWinSaving(true);
        try {
            // Con zona explícita: mandar el texto del input tal cual hacía que
            // la ventana se corriera 5 horas en cada guardado (src/lib/fechas.js)
            await Grades.setWindow(period, {
                grades_start: localAIso(winStart),
                grades_end:   localAIso(winEnd),
            });
            toast.success("Ventana actualizada");
            setWindowOpen(false);
            loadWindow();
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Error guardando ventana");
        } finally {
            setWinSaving(false);
        }
    };
    const clearWindow = () => {
        if (!gradesWin.has_window) { setWindowOpen(false); return; }
        setConfirmData({
            title: "¿Eliminar restricción de fechas?",
            message: "Los docentes podrán cargar notas en cualquier momento.",
            confirmLabel: "Eliminar restricción",
            onConfirm: doClearWindow,
        });
    };

    const doClearWindow = async () => {
        setWinSaving(true);
        try {
            await Grades.setWindow(period, { grades_start: null, grades_end: null });
            toast.success("Ventana eliminada — carga libre");
            setWindowOpen(false);
            loadWindow();
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Error");
        } finally {
            setWinSaving(false);
        }
    };

    const fmtDt = (iso) => {
        if (!iso) return "—";
        const d = new Date(iso);
        return d.toLocaleString("es-PE", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
    };

    useEffect(() => {
        Careers.list().then((d) => {
            const list = Array.isArray(d?.careers) ? d.careers : Array.isArray(d) ? d : [];
            setCareers(list);
        }).catch(() => setCareers([]));
    }, []);

    const [confirmData, setConfirmData] = useState(null);

    /* ── Registro por Excel (plantilla prellenada + carga) ── */
    const xlsxInputRef = useRef(null);

    const _descargarBlob = (res, fallback) => {
        const cd = res?.headers?.["content-disposition"] || "";
        const m = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(cd);
        const filename = m?.[1]?.replace(/['"]/g, "").trim() || fallback;
        const blob = res?.data instanceof Blob ? res.data : new Blob([res.data]);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    };

    const _blobError = async (e, fallback) => {
        try {
            if (e?.response?.data instanceof Blob) {
                const txt = await e.response.data.text();
                return JSON.parse(txt)?.detail || fallback;
            }
        } catch { /* ignore */ }
        return e?.response?.data?.detail || e?.message || fallback;
    };

    const descargarPlantilla = async (s) => {
        try {
            const res = await ActaExcel.gradesTemplate(s.section_id);
            _descargarBlob(res, "plantilla_notas.xlsx");
            toast.success(`Plantilla de "${s.course_name}" generada con los alumnos matriculados`);
        } catch (e) {
            toast.error(await _blobError(e, "No se pudo generar la plantilla"), { duration: 9000 });
        }
    };

    const cargarExcel = async (e) => {
        const file = e.target.files?.[0]; e.target.value = "";
        if (!file) return;
        try {
            const r = await ActaExcel.importNotas(file);
            toast.success(r?.message || "Notas importadas");
            if (Array.isArray(r?.errores) && r.errores.length) {
                toast.warning(`${r.errores.length} error(es) — 1ro: ${r.errores[0]}`, { duration: 10000 });
            }
            load();
        } catch (er) {
            toast.error(await _blobError(er, "Error al importar notas"), { duration: 9000 });
        }
    };

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (period) params.period = period;
            if (careerId) params.career_id = careerId;
            const d = await Grades.adminOverview(params);
            setOverview(d || { sections: [] });
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Error cargando monitoreo");
        } finally {
            setLoading(false);
        }
    }, [period, careerId]);
    useEffect(() => { load(); }, [load]);

    const [cicloFiltro, setCicloFiltro] = useState("ALL");

    // Ciclo = semestre académico (I–X): siempre los 10
    const ciclosDisponibles = Array.from({ length: 10 }, (_, i) => i + 1);

    const filtered = useMemo(() => {
        const t = q.trim().toLowerCase();
        let list = overview.sections || [];
        if (cicloFiltro !== "ALL") {
            list = list.filter((s) => String(s.semester) === String(cicloFiltro));
        }
        if (!t) return list;
        return list.filter((s) =>
            (s.course_name || "").toLowerCase().includes(t) ||
            (s.teacher_name || "").toLowerCase().includes(t) ||
            (s.career_name || "").toLowerCase().includes(t)
        );
    }, [overview, q, cicloFiltro]);

    const summary = useMemo(() => {
        const list = overview.sections || [];
        return {
            total: list.length,
            sin_notas: list.filter((s) => s.n_loaded === 0).length,
            no_cerradas: list.filter((s) => !s.submitted).length,
            desaprobados: list.reduce((a, s) => a + (s.n_failed || 0), 0),
        };
    }, [overview]);

    const openDetail = async (s) => {
        setDetailOpen(true);
        setDetail(null);
        setEdits({});
        setLoadingDetail(true);
        try {
            const d = await Grades.adminSectionDetail(s.section_id);
            setDetail(d);
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Error cargando detalle");
            setDetailOpen(false);
        } finally {
            setLoadingDetail(false);
        }
    };

    const setEdit = (sid, val) => {
        setEdits((p) => ({ ...p, [sid]: val }));
    };

    const saveEdits = async () => {
        if (!detail || Object.keys(edits).length === 0) {
            toast.info("No hay cambios para guardar"); return;
        }
        // Merge: el endpoint /grades/save reemplaza el bundle completo.
        // Construimos el objeto grades a partir del detalle + edits.
        const merged = {};
        detail.students.forEach((st) => {
            const eVal = edits[st.student_id];
            if (eVal !== undefined && eVal !== "") {
                const n = Number(eVal);
                if (Number.isFinite(n) && n >= 0 && n <= 20) {
                    merged[String(st.student_id)] = { final_grade: n };
                }
            } else if (st.final_grade != null && st.final_grade !== "") {
                merged[String(st.student_id)] = {
                    final_grade: st.final_grade,
                    ...(st.status === "DPI" ? {
                        status: "DPI",
                        dpi_pct: st.dpi_pct,
                    } : {}),
                };
            }
        });

        setSaving(true);
        try {
            await Grades.save(detail.section_id, merged);
            toast.success("Notas guardadas (acta abierta para revisión)");
            setEdits({});
            const d = await Grades.adminSectionDetail(detail.section_id);
            setDetail(d);
            load();
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Error guardando notas");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                    <span className="flex items-center gap-2 text-base font-extrabold">
                        <Shield className="w-5 h-5 text-emerald-600" /> Notas — Monitoreo Admin
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                        Admin puede editar incluso si el acta está cerrada
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {/* ── Ventana de carga de notas (oculta si Evaluación ya la muestra) ── */}
                {!hideWindow && (
                <div className={`rounded-lg border px-3 py-2 flex items-center gap-3 flex-wrap ${
                    !gradesWin.has_window ? "bg-slate-50 border-slate-200" :
                    gradesWin.is_open      ? "bg-emerald-50 border-emerald-200" :
                                          "bg-rose-50 border-rose-200"
                }`}>
                    <CalendarDays className={`w-4 h-4 ${gradesWin.is_open ? "text-emerald-700" : "text-rose-700"}`} />
                    <div className="flex-1 min-w-0 text-xs">
                        <span className="font-bold text-slate-700">Ventana de notas {period}: </span>
                        {!gradesWin.has_window ? (
                            <span className="text-slate-600">Sin restricción — los docentes pueden cargar en cualquier momento</span>
                        ) : gradesWin.is_open ? (
                            <span className="text-emerald-700 font-semibold">
                                ABIERTA · {fmtDt(gradesWin.grades_start)} → {fmtDt(gradesWin.grades_end)}
                            </span>
                        ) : (
                            <span className="text-rose-700 font-semibold">
                                CERRADA · {fmtDt(gradesWin.grades_start)} → {fmtDt(gradesWin.grades_end)} (solo admins pueden cargar)
                            </span>
                        )}
                    </div>
                    <Button size="sm" variant="outline" className="h-7 gap-1.5" onClick={openWindowEditor}>
                        <Pencil className="w-3.5 h-3.5" /> Configurar fechas
                    </Button>
                </div>
                )}

                <div className={`grid grid-cols-1 ${periodOverride ? "md:grid-cols-5" : "md:grid-cols-6"} gap-2 items-end p-3 rounded-lg bg-slate-50 border`}>
                    {!periodOverride && (
                    <div>
                        <Label className="text-[10px] font-bold uppercase">Periodo</Label>
                        <Select value={period} onValueChange={setPeriod}>
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {periodOptions().map((p) => (
                                    <SelectItem key={p} value={p}>{p}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    )}
                    <div>
                        <Label className="text-[10px] font-bold uppercase">Carrera</Label>
                        <Select value={careerId || "ALL"} onValueChange={(v) => setCareerId(v === "ALL" ? "" : v)}>
                            <SelectTrigger className="h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Todas</SelectItem>
                                {careers.map((c) => (
                                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label className="text-[10px] font-bold uppercase">Ciclo</Label>
                        <Select value={cicloFiltro} onValueChange={setCicloFiltro}>
                            <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Todos</SelectItem>
                                {ciclosDisponibles.map((c) => (
                                    <SelectItem key={c} value={String(c)}>Ciclo {c}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="md:col-span-2">
                        <Label className="text-[10px] font-bold uppercase">Buscar</Label>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
                            <Input className="pl-8 h-9" placeholder="Curso, docente, carrera..."
                                value={q} onChange={(e) => setQ(e.target.value)} />
                        </div>
                    </div>
                    <div>
                        <Button variant="outline" className="w-full h-9 gap-1.5" onClick={load} disabled={loading}>
                            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                            Recargar
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <Kpi color="slate"   label="Secciones" value={summary.total} />
                    <Kpi color="rose"    label="Sin notas cargadas" value={summary.sin_notas} />
                    <Kpi color="amber"   label="Actas no cerradas" value={summary.no_cerradas} />
                    <Kpi color="rose"    label="Alumnos desaprobados" value={summary.desaprobados} />
                </div>

                <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-100 text-[11px] uppercase tracking-wider text-slate-600">
                            <tr>
                                <th className="px-2 py-2 text-left">Carrera</th>
                                <th className="px-2 py-2 text-center">Ciclo</th>
                                <th className="px-2 py-2 text-left">Curso</th>
                                <th className="px-2 py-2 text-center">Sec.</th>
                                <th className="px-2 py-2 text-left">Docente</th>
                                <th className="px-2 py-2 text-center">Alumnos</th>
                                <th className="px-2 py-2 text-center">Notas cargadas</th>
                                <th className="px-2 py-2 text-center">Desap.</th>
                                <th className="px-2 py-2 text-center">Acta</th>
                                <th className="px-2 py-2 text-center w-64">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && filtered.length === 0 && (
                                <tr><td colSpan={10} className="py-10 text-center text-slate-500">
                                    <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Cargando…
                                </td></tr>
                            )}
                            {!loading && filtered.length === 0 && (
                                <tr><td colSpan={10} className="py-10 text-center text-slate-500">
                                    No hay secciones para los filtros aplicados.
                                </td></tr>
                            )}
                            {filtered.map((s) => (
                                <tr key={s.section_id} className={`border-t hover:bg-slate-50 ${s.n_loaded === 0 ? "bg-rose-50/40" : s.n_failed > 0 ? "bg-amber-50/40" : ""}`}>
                                    <td className="px-2 py-1.5 text-xs">{s.career_name}</td>
                                    <td className="px-2 py-1.5 text-center font-bold">{s.semester || "—"}</td>
                                    <td className="px-2 py-1.5">{s.course_name}</td>
                                    <td className="px-2 py-1.5 text-center">{s.label}</td>
                                    <td className="px-2 py-1.5 text-xs">{s.teacher_name || <span className="text-slate-400 italic">sin docente</span>}</td>
                                    <td className="px-2 py-1.5 text-center">{s.n_students}</td>
                                    <td className="px-2 py-1.5 text-center">
                                        <span className="text-xs">
                                            {s.n_loaded}/{s.n_students}{" "}
                                            <span className="text-slate-400">({s.loaded_pct}%)</span>
                                        </span>
                                    </td>
                                    <td className="px-2 py-1.5 text-center">
                                        {s.n_failed > 0 ? (
                                            <Badge className="bg-rose-100 text-rose-800 border-rose-200">
                                                {s.n_failed}
                                            </Badge>
                                        ) : (
                                            <span className="text-emerald-600 text-xs">0</span>
                                        )}
                                    </td>
                                    <td className="px-2 py-1.5 text-center">
                                        {s.submitted ? (
                                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">
                                                <Lock className="w-3 h-3 mr-1" /> Cerrada
                                            </Badge>
                                        ) : (
                                            <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px]">
                                                Abierta
                                            </Badge>
                                        )}
                                    </td>
                                    <td className="px-2 py-1.5 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <Button size="sm" variant="outline" className="h-7 px-2 gap-1"
                                                onClick={() => {
                                                    setActaSection({
                                                        id: s.section_id,
                                                        course_name: s.course_name,
                                                        teacher_name: s.teacher_name,
                                                        period: s.period,
                                                        semester: s.semester,
                                                        label: s.label,
                                                    });
                                                    setActaOpen(true);
                                                }}>
                                                <Eye className="w-3.5 h-3.5" /> Ver / Editar
                                            </Button>
                                            <Button size="sm" variant="outline" title="Descargar plantilla Excel con los alumnos matriculados"
                                                className="h-7 px-2 gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                                onClick={() => descargarPlantilla(s)}>
                                                <Download className="w-3.5 h-3.5" /> Plantilla
                                            </Button>
                                            <Button size="sm" variant="outline" title="Cargar Excel de notas llenado"
                                                className="h-7 px-2 gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                                onClick={() => xlsxInputRef.current?.click()}>
                                                <Upload className="w-3.5 h-3.5" /> Cargar
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>

            <ConfirmModal data={confirmData} onClose={() => setConfirmData(null)} />

            {/* Input oculto: la hoja identifica la sección (celda SECCION_ID) */}
            <input ref={xlsxInputRef} type="file" accept=".xlsx" className="hidden" onChange={cargarExcel} />

            {/* ── Diálogo: Detalle / edición ── */}
            <Dialog open={detailOpen} onOpenChange={(o) => { setDetailOpen(o); if (!o) { setDetail(null); setEdits({}); } }}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <ListChecks className="w-5 h-5" />
                            Detalle de notas {detail?.course && `· ${detail.course}`}
                        </DialogTitle>
                    </DialogHeader>
                    {loadingDetail ? (
                        <div className="py-10 text-center text-slate-500">
                            <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Cargando…
                        </div>
                    ) : detail ? (
                        <>
                            <div className="text-xs text-slate-500 mb-2">
                                Docente: <strong>{detail.teacher_name || "—"}</strong> · Sección {detail.label} ·{" "}
                                {detail.submitted ? (
                                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 ml-1 text-[10px]">
                                        <Lock className="w-3 h-3 mr-1" /> Acta cerrada
                                    </Badge>
                                ) : (
                                    <Badge className="bg-amber-100 text-amber-800 border-amber-200 ml-1 text-[10px]">
                                        Acta abierta
                                    </Badge>
                                )}
                                <span className="ml-2 text-[10px] text-slate-400">
                                    (admin puede editar igual; el acta sigue cerrada tras la modificación)
                                </span>
                            </div>
                            <div className="max-h-[55vh] overflow-y-auto rounded-lg border">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-100 text-[11px] uppercase text-slate-600 sticky top-0">
                                        <tr>
                                            <th className="px-2 py-2 text-left">DNI</th>
                                            <th className="px-2 py-2 text-left">Alumno</th>
                                            <th className="px-2 py-2 text-center">Nota actual</th>
                                            <th className="px-2 py-2 text-center">Editar (0-20)</th>
                                            <th className="px-2 py-2 text-center">Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {detail.students.map((st) => {
                                            const editVal = edits[st.student_id];
                                            const isDirty = editVal !== undefined && editVal !== "" && Number(editVal) !== Number(st.final_grade);
                                            return (
                                                <tr key={st.student_id} className={`border-t ${isDirty ? "bg-amber-50/60" : ""}`}>
                                                    <td className="px-2 py-1.5 font-mono text-xs">{st.dni}</td>
                                                    <td className="px-2 py-1.5">{st.full_name}</td>
                                                    <td className="px-2 py-1.5 text-center font-bold">
                                                        {st.final_grade != null && st.final_grade !== "" ? st.final_grade : (
                                                            <span className="text-slate-400 italic text-xs">sin nota</span>
                                                        )}
                                                    </td>
                                                    <td className="px-2 py-1.5 text-center">
                                                        <Input
                                                            type="number" min={0} max={20}
                                                            className="h-7 w-16 text-center mx-auto text-sm"
                                                            value={editVal ?? ""}
                                                            placeholder={st.final_grade ?? ""}
                                                            onChange={(e) => setEdit(st.student_id, e.target.value)}
                                                        />
                                                    </td>
                                                    <td className="px-2 py-1.5 text-center">
                                                        <Badge variant="outline" className={`text-[10px] ${estadoBadge(st.estado)}`}>
                                                            {st.estado}
                                                        </Badge>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <DialogFooter className="mt-3 flex-wrap gap-2">
                                <Button variant="ghost" onClick={() => setDetailOpen(false)}>Cerrar</Button>
                                <Button onClick={saveEdits} disabled={saving || Object.keys(edits).length === 0}
                                    className="bg-emerald-600 hover:bg-emerald-700">
                                    {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                                    Guardar cambios ({Object.keys(edits).length})
                                </Button>
                            </DialogFooter>
                        </>
                    ) : null}
                </DialogContent>
            </Dialog>

            {/* ── Diálogo: Configurar ventana de carga de notas ── */}
            <Dialog open={windowOpen} onOpenChange={setWindowOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CalendarDays className="w-5 h-5" /> Ventana de carga de notas · {period}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 text-sm">
                        <p className="text-xs text-slate-500">
                            Mientras esta ventana esté <strong>cerrada</strong>, los docentes no podrán guardar
                            ni enviar notas. Los administradores siempre pueden cargar y editar.
                        </p>
                        <div>
                            <Label className="text-[10px] font-bold uppercase">Inicio</Label>
                            <Input type="datetime-local" value={winStart}
                                onChange={(e) => setWinStart(e.target.value)} className="h-9" />
                        </div>
                        <div>
                            <Label className="text-[10px] font-bold uppercase">Fin</Label>
                            <Input type="datetime-local" value={winEnd}
                                onChange={(e) => setWinEnd(e.target.value)} className="h-9" />
                        </div>
                    </div>
                    <DialogFooter className="flex-wrap gap-2 mt-3">
                        <Button variant="outline" onClick={clearWindow} disabled={winSaving} className="gap-1">
                            <Unlock className="w-4 h-4" /> Quitar ventana
                        </Button>
                        <Button variant="ghost" onClick={() => setWindowOpen(false)} disabled={winSaving}>
                            Cancelar
                        </Button>
                        <Button onClick={saveWindow} disabled={winSaving} className="bg-emerald-600 hover:bg-emerald-700 gap-1">
                            {winSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Guardar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Acta de Calificación oficial (RVM 123-2022) */}
            <ActaCalificacionModal
                open={actaOpen}
                onClose={() => setActaOpen(false)}
                section={actaSection}
                onSaved={load}
            />
        </Card>
    );
}

function Kpi({ color = "slate", label, value }) {
    const tones = {
        slate:  "bg-slate-50  border-slate-200  text-slate-700",
        rose:   "bg-rose-50   border-rose-200   text-rose-700",
        amber:  "bg-amber-50  border-amber-200  text-amber-800",
        emerald:"bg-emerald-50 border-emerald-200 text-emerald-800",
    };
    return (
        <div className={`rounded-lg border px-3 py-2 ${tones[color]}`}>
            <div className="text-[10px] font-bold uppercase opacity-80">{label}</div>
            <div className="text-xl font-extrabold mt-0.5">{value}</div>
        </div>
    );
}
