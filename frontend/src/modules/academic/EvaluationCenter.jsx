/* ═══════════════════════════════════════════════════════════════
   EvaluationCenter — Centro de Evaluación (tipo SIAGIE)
   Un solo lugar para todo el proceso de evaluación del período:
     1. Apertura / Cierre  → habilitar o cerrar el registro de notas,
        con fechas de ventana para docentes
     2. Registrar          → cargar calificaciones (plataforma o Excel)
     3. Procesar           → consolidar actas → kárdex oficial
     4. Boletas y reportes → boletas ZIP, fichas, actas, reportes
   ═══════════════════════════════════════════════════════════════ */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isoALocal, localAIso, fechaHoraLegible } from "@/lib/fechas";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
    Loader2, RefreshCw, Lock, Unlock, CalendarDays, CheckCircle2,
    ClipboardCheck, Cog, Download, FileSpreadsheet, FileText, Shield,
    AlertTriangle, ListChecks, Archive,
} from "lucide-react";
import { EvaluationAdmin as Evaluation, Grades, Careers, AcademicReports } from "@/services/academic.service";
import { useActivePeriod } from "@/hooks/useActivePeriod";
import AdminGradesMonitor from "./AdminGradesMonitor";

function periodOptions() {
    const y = new Date().getFullYear();
    const out = [];
    for (let i = y + 1; i >= y - 3; i--) { out.push(`${i}-II`); out.push(`${i}-I`); }
    return out;
}

function downloadBlob(res, fallback) {
    const cd = res?.headers?.["content-disposition"] || "";
    const m = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(cd);
    const filename = m?.[1]?.replace(/['"]/g, "").trim() || fallback;
    const blob = res?.data instanceof Blob ? res.data : new Blob([res.data]);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    // Revocar DESPUÉS de que el navegador termine de escribir el archivo
    // (revocar al instante corta las descargas grandes con "Error de red")
    setTimeout(() => window.URL.revokeObjectURL(url), 60000);
}

async function blobError(e, fallback) {
    try {
        if (e?.response?.data instanceof Blob) {
            const txt = await e.response.data.text();
            const j = JSON.parse(txt);
            return j?.detail || fallback;
        }
    } catch { /* ignore */ }
    return e?.response?.data?.detail || e?.message || fallback;
}

/* ─────────── Tarjeta de estadística ─────────── */
function Stat({ label, value, tone = "slate" }) {
    const tones = {
        slate:  "bg-slate-50 border-slate-200 text-slate-700",
        red:    "bg-rose-50 border-rose-200 text-rose-700",
        amber:  "bg-amber-50 border-amber-200 text-amber-700",
        green:  "bg-emerald-50 border-emerald-200 text-emerald-700",
        blue:   "bg-blue-50 border-blue-200 text-blue-700",
    };
    return (
        <div className={`rounded-xl border px-4 py-3 ${tones[tone]}`}>
            <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">{label}</p>
            <p className="text-2xl font-extrabold mt-0.5">{value}</p>
        </div>
    );
}

/* ═══════════════ 1. APERTURA / CIERRE ═══════════════ */
function OpenCloseTab({ period, state, loading, reload }) {
    const [busy, setBusy] = useState(false);
    const [confirmClose, setConfirmClose] = useState(false);

    // Ventana de fechas
    const [winOpen, setWinOpen] = useState(false);
    const [winStart, setWinStart] = useState("");
    const [winEnd, setWinEnd] = useState("");
    const [winSaving, setWinSaving] = useState(false);

    const gradesState = state?.grades_state || "OPEN";
    const win = state?.window || {};
    const stats = state?.stats || {};
    const isClosed = gradesState === "CLOSED";

    const estadoLabel = isClosed
        ? { text: "CERRADO", cls: "bg-rose-100 text-rose-800 border-rose-300" }
        : win.has_window && !win.is_open
            ? { text: "FUERA DE VENTANA", cls: "bg-amber-100 text-amber-800 border-amber-300" }
            : { text: "EN EVALUACIÓN", cls: "bg-emerald-100 text-emerald-800 border-emerald-300" };

    const setState = async (action) => {
        setBusy(true);
        try {
            const r = await Evaluation.setState(period, action);
            toast.success(r?.message || "Estado actualizado");
            setConfirmClose(false);
            reload();
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Error al cambiar el estado");
        } finally {
            setBusy(false);
        }
    };

    const openWinEditor = () => {
        setWinStart(isoALocal(win.grades_start));
        setWinEnd(isoALocal(win.grades_end));
        setWinOpen(true);
    };
    const saveWin = async () => {
        setWinSaving(true);
        try {
            // Se envía con zona explícita: si se mandaba el texto del input
            // tal cual, el servidor lo tomaba como otra hora y la ventana se
            // corría 5 horas en cada guardado (ver src/lib/fechas.js)
            await Grades.setWindow(period, {
                grades_start: localAIso(winStart),
                grades_end: localAIso(winEnd),
            });
            toast.success(winStart || winEnd ? "Fechas de la ventana guardadas" : "Restricción de fechas eliminada");
            setWinOpen(false);
            reload();
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Error guardando la ventana");
        } finally {
            setWinSaving(false);
        }
    };

    return (
        <div className="space-y-4">
            <Card className="border shadow-sm rounded-2xl">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Shield className="h-4 w-4 text-blue-600" />
                        Registro de calificaciones — {period}
                        <Badge variant="outline" className={`ml-2 ${estadoLabel.cls}`}>{estadoLabel.text}</Badge>
                    </CardTitle>
                    <p className="text-xs text-slate-500">
                        {isClosed
                            ? `Período cerrado${win.grades_closed_at ? ` el ${String(win.grades_closed_at).slice(0, 10)}` : ""} — los docentes no pueden cargar ni modificar notas. Los administradores mantienen acceso.`
                            : win.has_window
                                ? `Ventana para docentes: ${fechaHoraLegible(win.grades_start)} → ${fechaHoraLegible(win.grades_end)}`
                                : "Sin restricción de fechas — los docentes pueden cargar notas en cualquier momento."}
                    </p>
                </CardHeader>
                <CardContent className="space-y-4">
                    {loading ? (
                        <div className="flex items-center gap-2 text-sm text-slate-500 py-6 justify-center">
                            <Loader2 className="h-4 w-4 animate-spin" /> Cargando estado…
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                                <Stat label="Secciones" value={stats.sections ?? 0} />
                                <Stat label="Alumnos" value={stats.students ?? 0} tone="blue" />
                                <Stat label="Con notas" value={stats.with_grades ?? 0} tone={stats.with_grades ? "green" : "red"} />
                                <Stat label="Notas cargadas" value={stats.grades_loaded ?? 0} tone="blue" />
                                <Stat label="Actas cerradas" value={stats.actas_closed ?? 0} tone="amber" />
                                <Stat label="Procesadas" value={stats.processed ?? 0} tone={stats.processed ? "green" : "slate"} />
                            </div>

                            <div className="flex flex-wrap gap-2 pt-1">
                                {isClosed ? (
                                    <Button onClick={() => setState("open")} disabled={busy} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlock className="h-4 w-4" />}
                                        Habilitar registro
                                    </Button>
                                ) : (
                                    <Button onClick={() => setConfirmClose(true)} disabled={busy} variant="destructive" className="gap-2">
                                        <Lock className="h-4 w-4" /> Cerrar período
                                    </Button>
                                )}
                                <Button variant="outline" onClick={openWinEditor} className="gap-2">
                                    <CalendarDays className="h-4 w-4" /> Configurar fechas
                                </Button>
                                <Button variant="ghost" onClick={reload} className="gap-2">
                                    <RefreshCw className="h-4 w-4" /> Recargar
                                </Button>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            <Card className="border shadow-sm rounded-2xl bg-slate-50/60">
                <CardContent className="pt-4 text-xs text-slate-500 space-y-1.5">
                    <p className="font-semibold text-slate-600">Flujo del proceso de evaluación:</p>
                    <p>1. <b>Habilitar registro</b> — los docentes cargan sus calificaciones (aquí o por plantilla Excel).</p>
                    <p>2. <b>Registrar calificaciones</b> — monitorea el avance por sección y edita como admin.</p>
                    <p>3. <b>Procesar calificaciones</b> — consolida las actas al kárdex oficial de cada alumno y cierra las actas.</p>
                    <p>4. <b>Cerrar período</b> — bloquea nuevas cargas de los docentes.</p>
                    <p>5. <b>Boletas y reportes</b> — descarga boletas de información, fichas y actas.</p>
                </CardContent>
            </Card>

            {/* Confirmar cierre */}
            <Dialog open={confirmClose} onOpenChange={setConfirmClose}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-500" /> ¿Cerrar el período {period}?
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-slate-600">
                        Los docentes ya no podrán cargar ni modificar calificaciones. Los administradores mantienen acceso
                        y puedes volver a habilitar el registro cuando quieras.
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmClose(false)}>Cancelar</Button>
                        <Button variant="destructive" onClick={() => setState("close")} disabled={busy} className="gap-2">
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                            Cerrar período
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Editor de ventana */}
            <Dialog open={winOpen} onOpenChange={setWinOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CalendarDays className="h-5 w-5 text-blue-600" /> Ventana de carga de notas — {period}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div>
                            <Label className="text-xs">Desde</Label>
                            <Input type="datetime-local" value={winStart} onChange={(e) => setWinStart(e.target.value)} />
                        </div>
                        <div>
                            <Label className="text-xs">Hasta</Label>
                            <Input type="datetime-local" value={winEnd} onChange={(e) => setWinEnd(e.target.value)} />
                        </div>
                        <p className="text-[11px] text-slate-400">
                            Deja ambos campos vacíos para permitir la carga en cualquier momento.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setWinOpen(false)}>Cancelar</Button>
                        <Button onClick={saveWin} disabled={winSaving} className="gap-2">
                            {winSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            Guardar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

/* ═══════════════ 3. PROCESAR CALIFICACIONES ═══════════════ */
function ProcessTab({ period, careers, reloadState }) {
    const [careerId, setCareerId] = useState("");
    const [cicloProc, setCicloProc] = useState("");
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState(new Set());
    const [processing, setProcessing] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [lastResult, setLastResult] = useState(null);

    const load = useCallback(async () => {
        if (!period) return;
        setLoading(true);
        try {
            const params = { period };
            if (careerId) params.career_id = careerId;
            if (cicloProc) params.semester = cicloProc;
            const d = await Evaluation.sections(params);
            setRows(Array.isArray(d?.sections) ? d.sections : []);
            setSelected(new Set());
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Error cargando secciones");
        } finally {
            setLoading(false);
        }
    }, [period, careerId, cicloProc]);
    useEffect(() => { load(); }, [load]);

    const processable = useMemo(() => rows.filter((r) => r.n_loaded > 0), [rows]);
    const allSelected = processable.length > 0 && processable.every((r) => selected.has(r.section_id));

    const toggleAll = () => {
        if (allSelected) setSelected(new Set());
        else setSelected(new Set(processable.map((r) => r.section_id)));
    };
    const toggle = (id) => {
        const s = new Set(selected);
        if (s.has(id)) s.delete(id); else s.add(id);
        setSelected(s);
    };

    const doProcess = async () => {
        setProcessing(true);
        try {
            const payload = { period, close_actas: true };
            if (selected.size) payload.section_ids = [...selected];
            else {
                if (careerId) payload.career_id = careerId;
                if (cicloProc) payload.semester = cicloProc;
            }
            const r = await Evaluation.process(payload);
            setLastResult(r);
            toast.success(r?.message || "Procesamiento completado");
            setConfirmOpen(false);
            load();
            reloadState();
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Error al procesar");
        } finally {
            setProcessing(false);
        }
    };

    const estadoDe = (r) => {
        if (r.processed) return { text: "PROCESADO", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" };
        if (r.n_loaded > 0) return { text: "EN PROCESO", cls: "bg-amber-100 text-amber-800 border-amber-200" };
        return { text: "SIN NOTAS", cls: "bg-rose-100 text-rose-700 border-rose-200" };
    };

    const nSel = selected.size;

    return (
        <div className="space-y-4">
            <Card className="border shadow-sm rounded-2xl">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Cog className="h-4 w-4 text-blue-600" /> Procesar calificaciones — {period}
                    </CardTitle>
                    <p className="text-xs text-slate-500">
                        Consolida las actas de los docentes al <b>kárdex oficial</b> de cada alumno y cierra las actas.
                        Solo se procesan secciones con notas cargadas; puedes re-procesar (se actualizan los registros).
                    </p>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="min-w-[200px]">
                            <Label className="text-xs">Carrera</Label>
                            <Select value={careerId || "ALL"} onValueChange={(v) => setCareerId(v === "ALL" ? "" : v)}>
                                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">Todas</SelectItem>
                                    {careers.map((c) => (
                                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="min-w-[120px]">
                            <Label className="text-xs">Ciclo</Label>
                            <Select value={cicloProc || "ALL"} onValueChange={(v) => setCicloProc(v === "ALL" ? "" : v)}>
                                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">Todos</SelectItem>
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((c) => (
                                        <SelectItem key={c} value={String(c)}>Ciclo {c}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button variant="outline" onClick={load} className="gap-2">
                            <RefreshCw className="h-4 w-4" /> Recargar
                        </Button>
                        <div className="flex-1" />
                        <Button
                            onClick={() => setConfirmOpen(true)}
                            disabled={processing || (nSel === 0 && processable.length === 0)}
                            className="gap-2 bg-blue-600 hover:bg-blue-700"
                        >
                            {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
                            {nSel > 0 ? `Procesar ${nSel} seleccionada(s)` : "Procesar todo"}
                        </Button>
                    </div>

                    {lastResult && (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-800">
                            ✔ {lastResult.message}
                        </div>
                    )}

                    {loading ? (
                        <div className="flex items-center gap-2 text-sm text-slate-500 py-8 justify-center">
                            <Loader2 className="h-4 w-4 animate-spin" /> Cargando secciones…
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-xl border">
                            <table className="w-full text-xs">
                                <thead className="bg-slate-50 text-slate-500">
                                    <tr>
                                        <th className="p-2 w-8">
                                            <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                                        </th>
                                        <th className="p-2 text-left">Carrera</th>
                                        <th className="p-2">Ciclo</th>
                                        <th className="p-2 text-left">Curso</th>
                                        <th className="p-2">Sec.</th>
                                        <th className="p-2 text-left">Docente</th>
                                        <th className="p-2">Alumnos</th>
                                        <th className="p-2">Notas</th>
                                        <th className="p-2">Acta</th>
                                        <th className="p-2">Kárdex</th>
                                        <th className="p-2">Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((r) => {
                                        const est = estadoDe(r);
                                        const canSelect = r.n_loaded > 0;
                                        return (
                                            <tr key={r.section_id} className="border-t hover:bg-slate-50/60">
                                                <td className="p-2 text-center">
                                                    <input
                                                        type="checkbox"
                                                        disabled={!canSelect}
                                                        checked={selected.has(r.section_id)}
                                                        onChange={() => toggle(r.section_id)}
                                                    />
                                                </td>
                                                <td className="p-2">{r.career_name}</td>
                                                <td className="p-2 text-center font-semibold">{r.semester ?? "—"}</td>
                                                <td className="p-2">{r.course_name}</td>
                                                <td className="p-2 text-center">{r.label}</td>
                                                <td className="p-2">{r.teacher_name || "—"}</td>
                                                <td className="p-2 text-center">{r.n_students}</td>
                                                <td className="p-2 text-center">
                                                    <span className={r.n_loaded < r.n_students ? "text-amber-600 font-semibold" : "text-emerald-700 font-semibold"}>
                                                        {r.n_loaded}/{r.n_students}
                                                    </span>
                                                </td>
                                                <td className="p-2 text-center">
                                                    {r.submitted
                                                        ? <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200">Cerrada</Badge>
                                                        : <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Abierta</Badge>}
                                                </td>
                                                <td className="p-2 text-center">{r.n_processed}/{r.n_loaded}</td>
                                                <td className="p-2 text-center">
                                                    <Badge variant="outline" className={est.cls}>{est.text}</Badge>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {!rows.length && (
                                        <tr><td colSpan={11} className="p-6 text-center text-slate-400">Sin secciones en este período</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <ClipboardCheck className="h-5 w-5 text-blue-600" /> Confirmar procesamiento
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-slate-600">
                        {nSel > 0
                            ? `Se procesarán ${nSel} sección(es) seleccionada(s) de ${period}.`
                            : `Se procesarán TODAS las secciones con notas de ${period}${careerId ? " (carrera filtrada)" : ""}.`}
                        {" "}Las notas finales pasarán al kárdex de cada alumno y las actas quedarán cerradas.
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
                        <Button onClick={doProcess} disabled={processing} className="gap-2 bg-blue-600 hover:bg-blue-700">
                            {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            Procesar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

/* ═══════════════ 4. BOLETAS Y REPORTES ═══════════════ */
const CICLOS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const ANIOS = [1, 2, 3, 4, 5];

function ReportsTab({ period, careers }) {
    const [careerId, setCareerId] = useState("");
    const [semester, setSemester] = useState("");
    const [anio, setAnio] = useState("");
    const [sectionId, setSectionId] = useState("");
    const [secciones, setSecciones] = useState([]);
    const [boletaAnio, setBoletaAnio] = useState(false);
    const [busy, setBusy] = useState("");

    // Cursos (secciones) del período según carrera/ciclo/año — para el filtro Curso
    useEffect(() => {
        let cancel = false;
        (async () => {
            try {
                const params = { period };
                if (careerId) params.career_id = careerId;
                if (semester) params.semester = semester;
                if (anio) params.anio = anio;
                const d = await Evaluation.sections(params);
                if (!cancel) {
                    setSecciones(Array.isArray(d?.sections) ? d.sections : []);
                    setSectionId("");
                }
            } catch { if (!cancel) setSecciones([]); }
        })();
        return () => { cancel = true; };
    }, [period, careerId, semester, anio]);

    const run = async (key, fn, fallbackName) => {
        setBusy(key);
        try {
            const res = await fn();
            downloadBlob(res, fallbackName);
            toast.success("Descarga iniciada");
        } catch (e) {
            toast.error(await blobError(e, "Error al generar la descarga"));
        } finally {
            setBusy("");
        }
    };

    const base = () => {
        const p = { period };
        if (careerId) p.career_id = careerId;
        if (semester) p.semester = semester;
        if (anio) p.anio = anio;
        return p;
    };

    /* Los 6 documentos — cada uno autónomo para descargar en PDF y Excel */
    const documentos = [
        {
            key: "consolidada", num: 1,
            title: "ACTA CONSOLIDADA DE EVALUACIÓN",
            desc: "Cursos en columnas con C/CS/PTJ, promedio ponderado del semestre y firmas de docentes. Una hoja/página por programa+ciclo+sección.",
            filtros: "Período · Carrera · Ciclo · Año",
            pdf: () => run("consolidada_pdf", () => Evaluation.actaConsolidadaPdf(base()), `acta-consolidada-${period}.pdf`),
            excel: () => run("consolidada_xls", () => Evaluation.actaConsolidada(base()), `acta-consolidada-${period}.xlsx`),
        },
        {
            key: "boletas", num: 2,
            title: "BOLETA DE INFORMACIÓN",
            desc: "PDF: una boleta por alumno en ZIP. Excel: detalle alumno×curso con promedio ponderado.",
            filtros: "Período/Año · Carrera · Ciclo",
            extra: (
                <label className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-1.5 cursor-pointer">
                    <input type="checkbox" checked={boletaAnio}
                        onChange={(e) => setBoletaAnio(e.target.checked)} />
                    Año completo ({String(period).split("-")[0]}-I + {String(period).split("-")[0]}-II)
                </label>
            ),
            pdf: () => run("boletas_pdf",
                () => Evaluation.boletasZip({
                    ...base(), ...(anio ? { anio_academico: anio, anio: undefined } : {}),
                    ...(boletaAnio ? { anio: 1 } : {}),
                }),
                `boletas-${boletaAnio ? String(period).split("-")[0] : period}.zip`),
            excel: () => run("boletas_xls", () => Evaluation.boletasXlsx(base()), `boletas-detalle-${period}.xlsx`),
        },
        {
            key: "fichas", num: 3,
            title: "FICHA DE RENDIMIENTO",
            desc: "PDF: ficha oficial MINEDU por alumno en ZIP. Excel: resumen alumno×período con promedio ponderado.",
            filtros: "Período · Carrera · Ciclo · Año",
            pdf: () => run("fichas_pdf", () => AcademicReports.exportFichasRendimientoZip(base()), `fichas-${period}.zip`),
            excel: () => run("fichas_xls", () => Evaluation.fichasXlsx(base()), `fichas-resumen.xlsx`),
        },
        {
            key: "rendimiento", num: 4,
            title: "REPORTE DE RENDIMIENTO",
            desc: "Resumen por curso (matriculados, aprobados, desaprobados, DPI, promedio) + detalle por alumno.",
            filtros: "Período · Carrera · Ciclo · Año · Curso",
            pdf: () => run("rendimiento_pdf",
                () => Evaluation.rendimientoPdf({ ...base(), ...(sectionId ? { section_id: sectionId } : {}) }),
                `rendimiento-${period}.pdf`),
            excel: () => run("rendimiento_xls",
                () => Evaluation.reporteRendimiento({ ...base(), ...(sectionId ? { section_id: sectionId } : {}) }),
                `rendimiento-${period}.xlsx`),
        },
        {
            key: "asistencia", num: 5,
            title: "REPORTE DE ASISTENCIA",
            desc: "Por curso: sesiones registradas y alumnos en riesgo DPI; detalle por alumno con faltas, tardanzas y % de inasistencia.",
            filtros: "Período · Carrera · Ciclo · Año · Curso",
            pdf: () => run("asistencia_pdf",
                () => Evaluation.asistenciaPdf({ ...base(), ...(sectionId ? { section_id: sectionId } : {}) }),
                `asistencia-${period}.pdf`),
            excel: () => run("asistencia_xls",
                () => Evaluation.asistenciaXlsx({ ...base(), ...(sectionId ? { section_id: sectionId } : {}) }),
                `asistencia-${period}.xlsx`),
        },
        {
            key: "minedu", num: 6,
            title: "REPORTE MINEDU",
            desc: "Reporte de matrícula en formato oficial MINEDU SIA (solo Excel oficial). Requiere carrera.",
            filtros: "Período · Carrera (obligatoria) · Ciclo",
            pdf: () => toast.info("El Reporte MINEDU solo existe en formato Excel oficial del ministerio"),
            excel: () => {
                if (!careerId) { toast.error("Selecciona una carrera para el Reporte MINEDU"); return; }
                run("minedu_xls", () => AcademicReports.exportReporteMinedu(base()), `reporte-minedu-${period}.xlsx`);
            },
        },
        {
            key: "acta_area", num: 7,
            title: "ACTA DE EVALUACIÓN",
            desc: "Acta de Evaluación de Área por curso (Calificativo, Crédito, Puntaje, Cualitativa). Con un curso elegido emite esa acta; sin curso descarga ZIP con todas las del filtro (PDF o Excel).",
            filtros: "Período · Carrera · Ciclo · Año · Curso",
            pdf: () => {
                if (sectionId) run("acta_pdf", () => Evaluation.actaAreaPdf(sectionId), `acta-area-${sectionId}.pdf`);
                else run("acta_pdf", () => Evaluation.actasAreaPdfZip(base()), `actas-area-pdf-${period}.zip`);
            },
            excel: () => {
                if (sectionId) run("acta_xls", () => Evaluation.actaArea(sectionId), `acta-area-${sectionId}.xlsx`);
                else run("acta_xls", () => Evaluation.actasAreaZip(base()), `actas-area-${period}.zip`);
            },
        },
    ];

    /* Méritos y becas */
    const meritos = [
        {
            key: "primeros", num: 8,
            title: "PRIMEROS LUGARES",
            desc: "Top 3 por especialidad y aula (ciclo) según promedio ponderado del período.",
            filtros: "Período · Carrera · Ciclo · Año",
            pdf: () => run("primeros_pdf", () => Evaluation.primerosLugares({ ...base(), fmt: "pdf" }), `primeros-lugares-${period}.pdf`),
            excel: () => run("primeros_xls", () => Evaluation.primerosLugares({ ...base(), fmt: "xlsx" }), `primeros-lugares-${period}.xlsx`),
        },
        {
            key: "tercio", num: 9,
            title: "TERCIO SUPERIOR (PROMOCIÓN)",
            desc: "Estudiantes que culminan el 10mo ciclo, todas las especialidades, por promedio de toda la formación.",
            filtros: "Promoción completa (sin filtros)",
            pdf: () => run("tercio_pdf", () => Evaluation.tercioQuinto({ tipo: "tercio", fmt: "pdf" }), "tercio-superior.pdf"),
            excel: () => run("tercio_xls", () => Evaluation.tercioQuinto({ tipo: "tercio", fmt: "xlsx" }), "tercio-superior.xlsx"),
        },
        {
            key: "quinto", num: 10,
            title: "QUINTO SUPERIOR (PROMOCIÓN)",
            desc: "Estudiantes que culminan el 10mo ciclo, todas las especialidades, por promedio de toda la formación.",
            filtros: "Promoción completa (sin filtros)",
            pdf: () => run("quinto_pdf", () => Evaluation.tercioQuinto({ tipo: "quinto", fmt: "pdf" }), "quinto-superior.pdf"),
            excel: () => run("quinto_xls", () => Evaluation.tercioQuinto({ tipo: "quinto", fmt: "xlsx" }), "quinto-superior.xlsx"),
        },
        {
            key: "becas", num: 11,
            title: "CONSTANCIAS DE BECA",
            desc: "Constancia PDF por cada estudiante con promedio ≥ 17 en el período, por aula. En ZIP, listas para firmar.",
            filtros: "Período · Carrera · Ciclo · Año",
            pdf: () => run("becas_pdf", () => Evaluation.constanciasBeca(base()), `constancias-beca-${period}.zip`),
            excel: null,
        },
        {
            key: "merito", num: 12,
            title: "ORDEN DE MÉRITO",
            desc: "Ranking completo por promedio ponderado con puesto y marca de beca 25% (≥ 17). El alcance depende del filtro: carrera + ciclo = aula; solo carrera = especialidad; sin filtros = todo el instituto.",
            filtros: "Período · Carrera (opcional) · Ciclo (opcional)",
            pdf: () => run("merito_pdf", () => Evaluation.meritoPdf(base()), `orden-merito-${period}.pdf`),
            excel: () => run("merito_xls", () => Evaluation.meritoXlsx(base()), `orden-merito-${period}.xlsx`),
        },
    ];

    const DocCard = ({ d }) => (
        <div className="rounded-xl border border-slate-200 hover:border-blue-300 transition-all p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 font-extrabold text-sm">
                {d.num}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-extrabold text-slate-700">{d.title}</p>
                <p className="text-xs text-slate-400 mt-0.5">{d.desc}</p>
                <p className="text-[10px] text-slate-400 mt-1"><b>Filtros:</b> {d.filtros}</p>
                {d.extra}
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
                <Button size="sm" onClick={d.pdf} disabled={!!busy}
                    className="gap-1.5 h-8 bg-rose-600 hover:bg-rose-700">
                    {busy === `${d.key}_pdf` || busy.startsWith(`${d.key}_pdf`)
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <FileText className="h-3.5 w-3.5" />}
                    PDF
                </Button>
                {d.excel && (
                    <Button size="sm" onClick={d.excel} disabled={!!busy}
                        className="gap-1.5 h-8 bg-emerald-600 hover:bg-emerald-700">
                        {busy === `${d.key}_xls`
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <FileSpreadsheet className="h-3.5 w-3.5" />}
                        Excel
                    </Button>
                )}
            </div>
        </div>
    );

    return (
        <Card className="border shadow-sm rounded-2xl">
            <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                    <Download className="h-4 w-4 text-blue-600" /> Boletas y reportes — {period}
                </CardTitle>
                <p className="text-xs text-slate-500">
                    Cada documento se emite por separado en <b>PDF o Excel</b> con los filtros elegidos.
                    Boletas, fichas y méritos usan las notas <b>procesadas</b> (kárdex).
                </p>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* ── Filtros: Carrera · Ciclo · Año · Curso ── */}
                <div className="flex flex-wrap items-end gap-3 p-3 rounded-xl bg-slate-50 border">
                    <div className="min-w-[200px]">
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
                    <div className="min-w-[110px]">
                        <Label className="text-[10px] font-bold uppercase">Ciclo</Label>
                        <Select value={semester || "ALL"}
                            onValueChange={(v) => { setSemester(v === "ALL" ? "" : v); if (v !== "ALL") setAnio(""); }}>
                            <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Todos</SelectItem>
                                {CICLOS.map((c) => (
                                    <SelectItem key={c} value={String(c)}>Ciclo {c}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="min-w-[110px]">
                        <Label className="text-[10px] font-bold uppercase">Año</Label>
                        <Select value={anio || "ALL"}
                            onValueChange={(v) => { setAnio(v === "ALL" ? "" : v); if (v !== "ALL") setSemester(""); }}>
                            <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Todos</SelectItem>
                                {ANIOS.map((a) => (
                                    <SelectItem key={a} value={String(a)}>{a}° año</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="min-w-[250px] flex-1 max-w-md">
                        <Label className="text-[10px] font-bold uppercase">
                            Curso (Rendimiento y Acta de Evaluación)
                        </Label>
                        <Select value={sectionId || "ALL"} onValueChange={(v) => setSectionId(v === "ALL" ? "" : v)}>
                            <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Todos</SelectItem>
                                {secciones.map((s) => (
                                    <SelectItem key={s.section_id} value={String(s.section_id)}>
                                        {`C${s.semester ?? "?"} · ${s.course_name} (${s.label}) — ${s.teacher_name || "sin docente"}`}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* ── Documentos ── */}
                <div className="grid md:grid-cols-2 gap-3">
                    {documentos.map((d) => <DocCard key={d.key} d={d} />)}
                </div>

                {/* ── Méritos y becas ── */}
                <div className="flex items-center gap-2 pt-2">
                    <div className="h-px flex-1 bg-slate-200" />
                    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                        Méritos y becas
                    </p>
                    <div className="h-px flex-1 bg-slate-200" />
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                    {meritos.map((d) => <DocCard key={d.key} d={d} />)}
                </div>
            </CardContent>
        </Card>
    );
}

/* ═══════════════ COMPONENTE PRINCIPAL ═══════════════ */
export default function EvaluationCenter() {
    const { period, setPeriod } = useActivePeriod();
    const [careers, setCareers] = useState([]);
    const [state, setState] = useState(null);
    const [loadingState, setLoadingState] = useState(false);
    const [tab, setTab] = useState("open_close");

    useEffect(() => {
        Careers.list().then((d) => {
            const list = Array.isArray(d?.careers) ? d.careers : Array.isArray(d) ? d : [];
            setCareers(list);
        }).catch(() => setCareers([]));
    }, []);

    const reloadState = useCallback(async () => {
        if (!period) return;
        setLoadingState(true);
        try {
            const d = await Evaluation.state(period);
            setState(d);
        } catch (e) {
            setState(null);
            toast.error(e?.response?.data?.detail || "Error cargando el estado del período");
        } finally {
            setLoadingState(false);
        }
    }, [period]);
    useEffect(() => { reloadState(); }, [reloadState]);

    return (
        <div className="space-y-4">
            {/* Cabecera con selector de período */}
            <div className="flex flex-wrap items-end gap-3">
                <div>
                    <h2 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
                        <ListChecks className="h-5 w-5 text-blue-600" /> Evaluación
                    </h2>
                    <p className="text-xs text-slate-400">Proceso completo de calificaciones del período</p>
                </div>
                <div className="flex-1" />
                <div className="min-w-[140px]">
                    <Label className="text-xs">Período</Label>
                    <Select value={period} onValueChange={setPeriod}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {periodOptions().map((p) => (
                                <SelectItem key={p} value={p}>{p}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <Tabs value={tab} onValueChange={setTab} className="space-y-4">
                <TabsList className="flex flex-wrap h-auto p-1 gap-1 bg-slate-50 border border-slate-200 rounded-xl">
                    <TabsTrigger value="open_close" className="text-xs gap-1.5"><Shield className="h-3.5 w-3.5" /> Apertura / Cierre</TabsTrigger>
                    <TabsTrigger value="register" className="text-xs gap-1.5"><ClipboardCheck className="h-3.5 w-3.5" /> Registrar calificaciones</TabsTrigger>
                    <TabsTrigger value="process" className="text-xs gap-1.5"><Cog className="h-3.5 w-3.5" /> Procesar calificaciones</TabsTrigger>
                    <TabsTrigger value="reports" className="text-xs gap-1.5"><Download className="h-3.5 w-3.5" /> Boletas y reportes</TabsTrigger>
                </TabsList>

                <TabsContent value="open_close">
                    <OpenCloseTab period={period} state={state} loading={loadingState} reload={reloadState} />
                </TabsContent>
                <TabsContent value="register">
                    <AdminGradesMonitor periodOverride={period} hideWindow />
                </TabsContent>
                <TabsContent value="process">
                    <ProcessTab period={period} careers={careers} reloadState={reloadState} />
                </TabsContent>
                <TabsContent value="reports">
                    <ReportsTab period={period} careers={careers} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
