/* ═══════════════════════════════════════════════════════════════
   AdminAttendanceMonitor
   Panel admin para monitorear el cumplimiento de asistencias por
   docente y detectar alumnos con >30% de inasistencias (DPI).
   Permite cargar asistencias como admin en cualquier sección.
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
    Loader2, RefreshCw, AlertTriangle, Eye, CalendarPlus,
    UserX, CheckCircle2, Shield, Search, ListChecks,
    Download, Upload, Lock, Save,
} from "lucide-react";
import { Attendance, Careers, ActaExcel, SectionStudents } from "@/services/academic.service";
import { useActivePeriod } from "@/hooks/useActivePeriod";
import ConfirmModal from "@/components/ConfirmModal";

const STATUSES = [
    { value: "PRESENT", label: "P",  className: "bg-emerald-100 text-emerald-800 border-emerald-300" },
    { value: "ABSENT",  label: "F",  className: "bg-rose-100 text-rose-800 border-rose-300" },
    { value: "LATE",    label: "T",  className: "bg-amber-100 text-amber-800 border-amber-300" },
    { value: "EXCUSED", label: "J",  className: "bg-blue-100 text-blue-800 border-blue-300" },
];

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

function StatusToggle({ value, onChange, disabled }) {
    return (
        <div className="inline-flex gap-1">
            {STATUSES.map((s) => (
                <button
                    key={s.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(s.value)}
                    className={`w-7 h-7 rounded text-xs font-bold border ${value === s.value ? s.className + " ring-2 ring-offset-1 ring-slate-400" : "bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100"}`}
                    title={s.value}
                >
                    {s.label}
                </button>
            ))}
        </div>
    );
}

export default function AdminAttendanceMonitor() {
    // Período VIGENTE del sistema (Académico → Periodos), no el del calendario
    const { period, setPeriod } = useActivePeriod();
    const [careerId, setCareerId] = useState("");
    const [q, setQ] = useState("");
    const [careers, setCareers] = useState([]);
    const [overview, setOverview] = useState({ sections: [], threshold_pct: 30 });
    const [loading, setLoading] = useState(false);

    const [detailOpen, setDetailOpen] = useState(false);
    const [detail, setDetail] = useState(null);  // {section_id, period, course, students[], ...}
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [applyingDpi, setApplyingDpi] = useState(false);

    const [loadOpen, setLoadOpen] = useState(false);
    const [sessionDate, setSessionDate] = useState(new Date().toISOString().slice(0, 10));
    const [sessionRows, setSessionRows] = useState([]);
    const [savingSession, setSavingSession] = useState(false);

    useEffect(() => {
        Careers.list().then((d) => {
            const list = Array.isArray(d?.careers) ? d.careers : Array.isArray(d) ? d : [];
            setCareers(list);
        }).catch(() => setCareers([]));
    }, []);

    const [confirmData, setConfirmData] = useState(null);

    /* ── Registro por Excel mensual (plantilla + carga) ── */
    const xlsxInputRef = useRef(null);
    const importTargetRef = useRef(null);          // sección destino de la carga
    const [tplOpen, setTplOpen] = useState(false); // modal de mes
    const [tplTarget, setTplTarget] = useState(null);
    const [tplMes, setTplMes] = useState(() => {
        const n = new Date();
        return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
    });
    const [tplBusy, setTplBusy] = useState(false);

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

    const generarPlantillaAsist = async () => {
        if (!tplTarget) return;
        if (!/^\d{4}-\d{2}$/.test(tplMes)) return toast.error("Mes inválido");
        setTplBusy(true);
        try {
            const res = await ActaExcel.attendanceTemplate(tplTarget.section_id, tplMes);
            _descargarBlob(res, "plantilla_asistencia.xlsx");
            toast.success(`Plantilla de "${tplTarget.course_name}" (${tplMes}) generada`);
            setTplOpen(false);
        } catch (e) {
            toast.error(await _blobError(e, "No se pudo generar la plantilla"), { duration: 9000 });
        } finally { setTplBusy(false); }
    };

    const cargarExcelAsist = async (e) => {
        const file = e.target.files?.[0]; e.target.value = "";
        const target = importTargetRef.current;
        if (!file || !target) return;
        try {
            const r = await ActaExcel.attendanceImport(target.section_id, file);
            toast.success(r?.message || "Asistencia importada");
            if (Array.isArray(r?.errores) && r.errores.length) {
                toast.warning(`${r.errores.length} error(es) — 1ro: ${r.errores[0]}`, { duration: 10000 });
            }
            load();
        } catch (er) {
            toast.error(await _blobError(er, "Error al importar asistencia"), { duration: 9000 });
        }
    };

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (period) params.period = period;
            if (careerId) params.career_id = careerId;
            const d = await Attendance.adminOverview(params);
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
            sin_asistencia: list.filter((s) => s.has_no_attendance).length,
            con_dpi: list.filter((s) => s.n_at_risk > 0).length,
            alumnos_en_riesgo: list.reduce((a, s) => a + (s.n_at_risk || 0), 0),
        };
    }, [overview]);

    /* ── Registro mensual estilo SIAGIE ── */
    const MARKS = { PRESENT: "P", LATE: "T", ABSENT: "F", EXCUSED: "J", HOLIDAY: "0" };
    const CYCLE = ["", "PRESENT", "LATE", "ABSENT", "EXCUSED", "HOLIDAY"];
    const [gridMes, setGridMes] = useState(() => {
        const n = new Date();
        return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
    });
    const [roster, setRoster] = useState([]);       // matriculados de la sección
    const [sesiones, setSesiones] = useState([]);   // sesiones con sus marcas
    const [ediciones, setEdiciones] = useState({}); // {fecha: {alumnoKey: STATUS|""}}
    const [savingGrid, setSavingGrid] = useState(false);

    const openDetail = async (s) => {
        setDetailOpen(true);
        setDetail(null);
        setEdiciones({});
        setLoadingDetail(true);
        try {
            const [d, r, ses] = await Promise.all([
                Attendance.adminSectionDetail(s.section_id),
                SectionStudents.list(s.section_id),
                Attendance.listSessions(s.section_id),
            ]);
            setDetail({ ...d, section_id: s.section_id });
            setRoster(Array.isArray(r?.students) ? r.students : []);
            setSesiones(Array.isArray(ses?.sessions) ? ses.sessions : []);
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Error cargando detalle");
            setDetailOpen(false);
        } finally {
            setLoadingDetail(false);
        }
    };

    // Datos del mes visible: días, sesiones por fecha y marcas por alumno
    const gridData = useMemo(() => {
        const m = /^(\d{4})-(\d{2})$/.exec(gridMes);
        if (!m) return null;
        const y = Number(m[1]), mo = Number(m[2]);
        const nDias = new Date(y, mo, 0).getDate();
        const dias = [];
        const DIAS_SEM = ["D", "L", "M", "X", "J", "V", "S"];
        // Horario de la sección: weekday 1=Lunes … 7=Domingo. Sin horario
        // configurado se asume L-V (comportamiento anterior).
        const horario = new Set(detail?.schedule_weekdays || []);
        for (let d = 1; d <= nDias; d++) {
            const wd = new Date(y, mo - 1, d).getDay();   // 0=Domingo … 6=Sábado
            const finde = wd === 0 || wd === 6;
            const clase = horario.size ? horario.has(wd === 0 ? 7 : wd) : !finde;
            dias.push({ d, wd: DIAS_SEM[wd], finde, clase });
        }
        const porFecha = {};   // fecha → {closed, id, marcas: {key: STATUS}}
        for (const s of sesiones) {
            const f = String(s.date || "");
            if (!f.startsWith(`${gridMes}-`)) continue;
            const marcas = {};
            for (const rw of (s.rows || [])) marcas[String(rw.student_id)] = rw.status;
            porFecha[f] = { id: s.id, closed: !!s.closed, marcas };
        }
        return { y, mo, dias, porFecha };
    }, [gridMes, sesiones, detail]);

    const fechaDe = (d) => `${gridMes}-${String(d).padStart(2, "0")}`;

    const marcaDe = (key, d) => {
        const f = fechaDe(d);
        const ed = ediciones[f]?.[key];
        if (ed !== undefined) return ed;
        return gridData?.porFecha?.[f]?.marcas?.[String(key)] || "";
    };

    const clickCelda = (key, d) => {
        const f = fechaDe(d);
        if (gridData?.porFecha?.[f]?.closed) return toast.info("Ese día está cerrado");
        const actual = marcaDe(key, d);
        const dia = gridData?.dias?.find((x) => x.d === d);
        // los días fuera del horario solo se pueden editar si ya tienen marca
        if (dia && !dia.clase && !actual) {
            return toast.info(
                detail?.has_schedule
                    ? `No se dicta clase ese día. Horario: ${detail.schedule_label}.`
                    : "No se dicta clase ese día (fin de semana).");
        }
        const next = CYCLE[(CYCLE.indexOf(actual) + 1) % CYCLE.length];
        setEdiciones((prev) => ({ ...prev, [f]: { ...(prev[f] || {}), [key]: next } }));
    };

    const diasModificados = Object.keys(ediciones).filter(
        (f) => Object.keys(ediciones[f] || {}).length > 0
    );

    /* ── Navegación de meses (◀ ▶) ── */
    const cambiarMes = (delta) => {
        const m = /^(\d{4})-(\d{2})$/.exec(gridMes);
        if (!m) return;
        const d = new Date(Number(m[1]), Number(m[2]) - 1 + delta, 1);
        setGridMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
        setEdiciones({});
    };

    /* ── Completar asistencias: llena con P (asistió) las celdas vacías
       de los días de clase hasta el día límite; luego se corrigen excepciones ── */
    const [diaLimite, setDiaLimite] = useState(() => new Date().getDate());

    // El selector solo ofrece días de dictado: si el valor actual no lo es,
    // se reubica en el último día de clase ya transcurrido del mes visible.
    useEffect(() => {
        const clases = (gridData?.dias || []).filter((x) => x.clase);
        if (!clases.length) return;
        if (clases.some((x) => x.d === Number(diaLimite))) return;
        const hoy = new Date();
        const enCurso = gridMes === `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
        const previos = clases.filter((x) => x.d <= (enCurso ? hoy.getDate() : 31));
        const base = previos.length ? previos : clases;
        setDiaLimite(base[base.length - 1].d);
    }, [gridData, gridMes, diaLimite]);

    const completarAsistencias = () => {
        if (!gridData) return;
        const nuevos = { ...ediciones };
        let celdas = 0;
        for (const { d, clase } of gridData.dias) {
            if (d > Number(diaLimite || 0)) break;
            if (!clase) continue;               // solo días de dictado
            const f = fechaDe(d);
            if (gridData.porFecha?.[f]?.closed) continue;
            for (const st of roster) {
                const key = String(st.id);
                if (marcaDe(key, d)) continue;   // ya tiene marca
                nuevos[f] = { ...(nuevos[f] || {}), [key]: "PRESENT" };
                celdas++;
            }
        }
        if (!celdas) return toast.info(
            detail?.has_schedule
                ? `No hay celdas vacías en días de clase hasta ese día (${detail.schedule_label})`
                : "No hay celdas vacías hasta ese día");
        setEdiciones(nuevos);
        toast.success(`${celdas} celda(s) completada(s) con P — presiona Grabar para guardar`);
    };

    /* ── Limpiar: borra TODAS las marcas del mes visible (días no cerrados) ── */
    const limpiarMes = () => {
        setConfirmData({
            title: "¿Limpiar el registro del mes?",
            message: `Se borrarán todas las marcas de asistencia de ${gridMes} (excepto los días cerrados). Los cambios se aplican al presionar Grabar.`,
            confirmLabel: "Limpiar todo",
            onConfirm: () => {
                if (!gridData) return;
                const nuevos = { ...ediciones };
                let celdas = 0;
                for (const { d } of gridData.dias) {
                    const f = fechaDe(d);
                    if (gridData.porFecha?.[f]?.closed) continue;
                    for (const st of roster) {
                        const key = String(st.id);
                        if (!marcaDe(key, d)) continue;
                        nuevos[f] = { ...(nuevos[f] || {}), [key]: "" };
                        celdas++;
                    }
                }
                setEdiciones(nuevos);
                toast.success(`${celdas} marca(s) borrada(s) — presiona Grabar para confirmar`);
            },
        });
    };

    const guardarGrid = async () => {
        if (!detail?.section_id || !diasModificados.length) return;
        setSavingGrid(true);
        let ok = 0, fail = 0;
        for (const f of diasModificados) {
            try {
                let sess = gridData?.porFecha?.[f];
                let sessId = sess?.id;
                if (!sessId) {
                    const resp = await Attendance.createSession(detail.section_id, { date: f });
                    sessId = resp?.session?.id;
                }
                if (!sessId) throw new Error("No se pudo crear la sesión");
                // Combinar marcas existentes + ediciones para TODOS los alumnos
                const rows = [];
                for (const st of roster) {
                    const key = String(st.id);
                    const edit = ediciones[f]?.[key];
                    const val = edit !== undefined ? edit : (sess?.marcas?.[key] || "");
                    if (val) rows.push({ student_id: Number(key), status: val });
                }
                await Attendance.set(detail.section_id, sessId, rows);
                ok++;
            } catch { fail++; }
        }
        try {
            const [ses, d] = await Promise.all([
                Attendance.listSessions(detail.section_id),
                Attendance.adminSectionDetail(detail.section_id),
            ]);
            setSesiones(Array.isArray(ses?.sessions) ? ses.sessions : []);
            setDetail((prev) => ({ ...d, section_id: prev.section_id }));
        } catch { /* ignore */ }
        setEdiciones({});
        setSavingGrid(false);
        toast[fail ? "warning" : "success"](
            `${ok} día(s) guardado(s)` + (fail ? ` · ${fail} fallaron` : "")
        );
        load();
    };

    const applyDpi = () => {
        if (!detail) return;
        setConfirmData({
            title: "¿Aplicar DPI?",
            message: "Se marcará como DESAPROBADOS POR INASISTENCIA a los alumnos con más de 30% de faltas y se actualizará el acta de notas.",
            confirmLabel: "Aplicar DPI",
            onConfirm: doApplyDpi,
        });
    };

    const doApplyDpi = async () => {
        setApplyingDpi(true);
        try {
            const r = await Attendance.applyDpi(detail.section_id);
            toast.success(`${r?.dpi_count || 0} alumno(s) marcado(s) como DPI.`);
            // Refrescar detalle y overview
            const d = await Attendance.adminSectionDetail(detail.section_id);
            setDetail(d);
            load();
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Error aplicando DPI");
        } finally {
            setApplyingDpi(false);
        }
    };

    const openLoadAttendance = (s) => {
        if (!detail || detail.section_id !== s.section_id) {
            // Cargar detalle primero para tener la lista de alumnos
            openDetail(s).then(() => setLoadOpen(true));
            return;
        }
        setLoadOpen(true);
    };

    useEffect(() => {
        // Cuando abrimos el modal de cargar asistencia, pre-poblar rows con presentes
        if (loadOpen && detail) {
            setSessionRows(detail.students.map((st) => ({
                student_id: st.student_id,
                full_name: st.full_name,
                dni: st.dni,
                status: "PRESENT",
            })));
        }
    }, [loadOpen, detail]);

    const saveSession = async () => {
        if (!detail) return;
        if (!sessionDate) { toast.error("Selecciona la fecha"); return; }
        setSavingSession(true);
        try {
            // 1) Crear (o reusar) la sesión para esa fecha
            const sessResp = await Attendance.createSession(detail.section_id, { date: sessionDate });
            const sessionId = sessResp?.session?.id || sessResp?.data?.session?.id || sessResp?.id;
            if (!sessionId) throw new Error("No se pudo crear la sesión");
            // 2) Guardar filas
            await Attendance.set(detail.section_id, sessionId,
                sessionRows.map(({ student_id, status }) => ({ student_id, status })));
            toast.success("Asistencia guardada");
            setLoadOpen(false);
            const d = await Attendance.adminSectionDetail(detail.section_id);
            setDetail(d);
            load();
        } catch (e) {
            toast.error(e?.response?.data?.detail || e?.message || "Error guardando asistencia");
        } finally {
            setSavingSession(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                    <span className="flex items-center gap-2 text-base font-extrabold">
                        <Shield className="w-5 h-5 text-indigo-600" /> Asistencias — Monitoreo Admin
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                        Umbral DPI: <strong className="ml-1">{overview.threshold_pct || 30}%</strong> de inasistencia
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {/* Filtros + KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end p-3 rounded-lg bg-slate-50 border">
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
                    <div>
                        <Label className="text-[10px] font-bold uppercase">Carrera</Label>
                        <Select value={careerId || "ALL"}
                            onValueChange={(v) => setCareerId(v === "ALL" ? "" : v)}>
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
                    <Kpi color="slate" label="Secciones" value={summary.total} />
                    <Kpi color="rose"  label="Sin asistencia cargada" value={summary.sin_asistencia} icon={<UserX className="w-4 h-4" />} />
                    <Kpi color="amber" label="Secciones con alumnos en DPI" value={summary.con_dpi} icon={<AlertTriangle className="w-4 h-4" />} />
                    <Kpi color="rose"  label="Alumnos en riesgo (>30%)" value={summary.alumnos_en_riesgo} />
                </div>

                {/* Tabla de secciones */}
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
                                <th className="px-2 py-2 text-center">Sesiones</th>
                                <th className="px-2 py-2 text-center">DPI ({overview.threshold_pct || 30}%)</th>
                                <th className="px-2 py-2 text-center w-36">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && filtered.length === 0 && (
                                <tr><td colSpan={9} className="py-10 text-center text-slate-500">
                                    <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Cargando…
                                </td></tr>
                            )}
                            {!loading && filtered.length === 0 && (
                                <tr><td colSpan={9} className="py-10 text-center text-slate-500">
                                    No hay secciones para los filtros aplicados.
                                </td></tr>
                            )}
                            {filtered.map((s) => (
                                <tr key={s.section_id} className={`border-t hover:bg-slate-50 ${s.has_no_attendance ? "bg-rose-50/40" : s.n_at_risk > 0 ? "bg-amber-50/40" : ""}`}>
                                    <td className="px-2 py-1.5 text-xs">{s.career_name}</td>
                                    <td className="px-2 py-1.5 text-center font-bold">{s.semester || "—"}</td>
                                    <td className="px-2 py-1.5">{s.course_name}</td>
                                    <td className="px-2 py-1.5 text-center">{s.label}</td>
                                    <td className="px-2 py-1.5 text-xs">{s.teacher_name || <span className="text-slate-400 italic">sin docente</span>}</td>
                                    <td className="px-2 py-1.5 text-center">{s.n_students}</td>
                                    <td className="px-2 py-1.5 text-center">
                                        {s.has_no_attendance ? (
                                            <Badge className="bg-rose-100 text-rose-800 border-rose-200 text-[10px]">
                                                ⚠ 0 sesiones
                                            </Badge>
                                        ) : (
                                            <span className="text-xs">
                                                {s.n_sessions} <span className="text-slate-400">({s.n_sessions_closed} cerradas)</span>
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-2 py-1.5 text-center">
                                        {s.n_at_risk > 0 ? (
                                            <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                                                {s.n_at_risk} en riesgo
                                            </Badge>
                                        ) : (
                                            <span className="text-emerald-600 text-xs">— ninguno —</span>
                                        )}
                                    </td>
                                    <td className="px-2 py-1.5 text-center">
                                        <div className="inline-flex gap-1">
                                            <Button size="sm" variant="outline" className="h-7 px-2 gap-1" onClick={() => openDetail(s)}>
                                                <Eye className="w-3.5 h-3.5" /> Detalle
                                            </Button>
                                            <Button size="sm" className="h-7 px-2 gap-1 bg-indigo-600 hover:bg-indigo-700"
                                                onClick={() => openLoadAttendance(s)}>
                                                <CalendarPlus className="w-3.5 h-3.5" /> Cargar
                                            </Button>
                                            <Button size="sm" variant="outline" title="Descargar plantilla Excel mensual (alumnos × días, P/T/F/J)"
                                                className="h-7 px-2 gap-1 border-sky-200 text-sky-700 hover:bg-sky-50"
                                                onClick={() => { setTplTarget(s); setTplOpen(true); }}>
                                                <Download className="w-3.5 h-3.5" /> Plantilla
                                            </Button>
                                            <Button size="sm" variant="outline" title="Cargar Excel de asistencia llenado"
                                                className="h-7 px-2 gap-1 border-sky-200 text-sky-700 hover:bg-sky-50"
                                                onClick={() => { importTargetRef.current = s; xlsxInputRef.current?.click(); }}>
                                                <Upload className="w-3.5 h-3.5" /> Importar
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

            {/* Input oculto para la carga de Excel de asistencia */}
            <input ref={xlsxInputRef} type="file" accept=".xlsx" className="hidden" onChange={cargarExcelAsist} />

            {/* ── Modal: mes de la plantilla de asistencia ── */}
            <Dialog open={tplOpen} onOpenChange={setTplOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Download className="w-5 h-5 text-sky-600" />
                            Plantilla de asistencia mensual
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-1">
                        <p className="text-sm text-slate-600">
                            {tplTarget?.course_name} — {tplTarget?.label || "A"} · cuadro alumnos × días
                            con marcas P (presente), T (tardanza), F (falta), J (justificado).
                        </p>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Mes</Label>
                            <Input type="month" value={tplMes} onChange={(e) => setTplMes(e.target.value)} className="rounded-xl" />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" className="rounded-xl" onClick={() => setTplOpen(false)}>Cancelar</Button>
                            <Button className="rounded-xl gap-2" onClick={generarPlantillaAsist} disabled={tplBusy}>
                                {tplBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                Generar Excel
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── Diálogo: Registro de Asistencia mensual (estilo SIAGIE) ── */}
            <Dialog open={detailOpen} onOpenChange={(o) => { setDetailOpen(o); if (!o) { setDetail(null); setEdiciones({}); } }}>
                <DialogContent className="max-w-6xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <ListChecks className="w-5 h-5" />
                            Registro de Asistencia mensual {detail?.course && `· ${detail.course}`}
                        </DialogTitle>
                    </DialogHeader>
                    {loadingDetail ? (
                        <div className="py-10 text-center text-slate-500">
                            <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Cargando…
                        </div>
                    ) : detail ? (
                        <>
                            <div className="flex flex-wrap items-end gap-3 mb-1">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Mes</p>
                                    <div className="flex items-center gap-1">
                                        <Button variant="outline" size="sm" className="h-8 w-8 p-0" title="Mes anterior"
                                            onClick={() => cambiarMes(-1)}>‹</Button>
                                        <Input type="month" className="h-8 w-40 text-sm"
                                            value={gridMes} onChange={(e) => { setGridMes(e.target.value); setEdiciones({}); }} />
                                        <Button variant="outline" size="sm" className="h-8 w-8 p-0" title="Mes siguiente"
                                            onClick={() => cambiarMes(1)}>›</Button>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Completar hasta día</p>
                                    <div className="flex items-center gap-1">
                                        <Select value={String(diaLimite)} onValueChange={(v) => setDiaLimite(Number(v))}>
                                            <SelectTrigger className="h-8 w-16 text-sm"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {(gridData?.dias || []).filter((x) => x.clase).map(({ d, wd }) => (
                                                    <SelectItem key={d} value={String(d)}>{d} · {wd}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700 text-xs gap-1"
                                            onClick={completarAsistencias}
                                            title="Llena con P (asistió) las celdas vacías de los días de clase">
                                            <CheckCircle2 className="w-3.5 h-3.5" /> Completar asistencias
                                        </Button>
                                        <Button size="sm" variant="outline" className="h-8 text-xs gap-1 border-amber-300 text-amber-700 hover:bg-amber-50"
                                            onClick={limpiarMes} title="Borra todas las marcas del mes (días no cerrados)">
                                            <UserX className="w-3.5 h-3.5" /> Limpiar
                                        </Button>
                                    </div>
                                </div>
                                <div className="ml-auto grid grid-cols-2 gap-2">
                                    <Kpi color="amber" label={`En riesgo (>${detail.threshold_pct}%)`} value={detail.n_at_risk} />
                                    <Kpi color="slate" label="Alumnos" value={detail.n_students} />
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-3 text-[11px] text-slate-500 items-center mb-2">
                                <span><b className="text-emerald-700">P</b> Presente</span>
                                <span><b className="text-amber-600">T</b> Tardanza</span>
                                <span><b className="text-rose-600">F</b> Falta</span>
                                <span><b className="text-sky-600">J</b> Justificado</span>
                                <span><b className="text-slate-500">0</b> Feriado</span>
                                <span className="inline-flex items-center gap-1"><Lock className="w-3 h-3" /> Día cerrado</span>
                                <span className="inline-flex items-center gap-1">
                                    <span className="inline-block w-3 h-3 rounded-sm bg-slate-400" /> Día sin clase
                                </span>
                                <span className="text-slate-400">— clic en una celda para cambiar la marca —</span>
                            </div>
                            <p className="text-[11px] text-slate-600 mb-2">
                                {detail.has_schedule ? (
                                    <><b className="text-emerald-700">Días de dictado:</b> {detail.schedule_label}.
                                        Solo esos días se pueden marcar y completar.</>
                                ) : (
                                    <><b className="text-amber-700">Sección sin horario configurado</b> — se habilita
                                        de lunes a viernes.</>
                                )}
                            </p>
                            <div className="max-h-[55vh] overflow-auto rounded-lg border">
                                <table className="text-xs border-collapse min-w-max">
                                    <thead className="sticky top-0 z-20">
                                        <tr className="bg-slate-800 text-white">
                                            <th className="px-2 py-1.5 text-left sticky left-0 bg-slate-800 z-30 min-w-[220px]">Apellidos y Nombres</th>
                                            {(gridData?.dias || []).map(({ d, clase }) => {
                                                const sess = gridData?.porFecha?.[fechaDe(d)];
                                                return (
                                                    <th key={d} className={`px-0 py-1 text-center w-7 font-semibold ${clase ? "" : "bg-slate-500"}`}
                                                        title={sess?.closed ? "Día cerrado" : clase ? undefined : "No se dicta clase este día"}>
                                                        <div className="leading-tight">{d}</div>
                                                        {sess?.closed && <Lock className="w-2.5 h-2.5 mx-auto text-amber-300" />}
                                                    </th>
                                                );
                                            })}
                                            <th className="px-2 py-1.5 text-center">% Inas.</th>
                                            <th className="px-2 py-1.5 text-center">Estado</th>
                                        </tr>
                                        <tr className="bg-slate-100 text-slate-500">
                                            <th className="px-2 py-0.5 text-left sticky left-0 bg-slate-100 z-30 text-[10px] font-semibold">DNI</th>
                                            {(gridData?.dias || []).map(({ d, wd, clase }) => (
                                                <th key={d} className={`px-0 py-0.5 text-center text-[9px] font-bold ${clase ? "" : "bg-slate-400 text-white"}`}>{wd}</th>
                                            ))}
                                            <th colSpan={2}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {detail.students.map((st) => {
                                            const rr = roster.find((x) => String(x.num_documento || "") === String(st.dni || ""));
                                            const key = String(rr?.id ?? st.student_id);
                                            return (
                                                <tr key={st.student_id} className={`border-t ${st.at_risk ? "bg-rose-50/40" : ""}`}>
                                                    <td className="px-2 py-1 sticky left-0 bg-white z-10 border-r border-slate-200">
                                                        <p className="font-semibold text-slate-700 leading-tight truncate max-w-[220px]">{st.full_name}</p>
                                                        <p className="text-[9px] font-mono text-slate-400">{st.dni}</p>
                                                    </td>
                                                    {(gridData?.dias || []).map(({ d, clase }) => {
                                                        const f = fechaDe(d);
                                                        const cerrado = gridData?.porFecha?.[f]?.closed;
                                                        const val = marcaDe(key, d);
                                                        const editado = ediciones[f]?.[key] !== undefined;
                                                        const sinClase = !clase && !val;
                                                        return (
                                                            <td key={d}
                                                                onClick={() => !cerrado && clickCelda(key, d)}
                                                                className={`text-center align-middle border-l border-slate-100 select-none
                                                                    ${clase ? "" : "bg-slate-300/70"}
                                                                    ${cerrado ? "bg-amber-50 cursor-not-allowed"
                                                                    : sinClase ? "cursor-not-allowed" : "cursor-pointer hover:bg-blue-50"}
                                                                    ${editado ? "bg-blue-100" : ""}`}>
                                                                <span className={`text-[11px] font-bold
                                                                    ${val === "ABSENT" ? "text-rose-600"
                                                                        : val === "EXCUSED" ? "text-sky-600"
                                                                        : val === "LATE" ? "text-amber-600"
                                                                        : val === "HOLIDAY" ? "text-slate-500"
                                                                        : "text-emerald-700"}`}>
                                                                    {MARKS[val] || ""}
                                                                </span>
                                                            </td>
                                                        );
                                                    })}
                                                    <td className={`px-2 py-1 text-center font-bold ${st.at_risk ? "text-rose-700" : "text-slate-600"}`}>
                                                        {st.absent_pct}%
                                                    </td>
                                                    <td className="px-2 py-1 text-center">
                                                        {st.at_risk ? (
                                                            <Badge className="bg-rose-100 text-rose-800 border-rose-200 text-[9px]">DPI</Badge>
                                                        ) : (
                                                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[9px]">OK</Badge>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <DialogFooter className="mt-3 flex-wrap gap-2">
                                {diasModificados.length > 0 && (
                                    <Button className="bg-emerald-600 hover:bg-emerald-700 gap-1.5" onClick={guardarGrid} disabled={savingGrid}>
                                        {savingGrid ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                        Grabar ({diasModificados.length} día{diasModificados.length > 1 ? "s" : ""})
                                    </Button>
                                )}
                                <Button variant="outline" onClick={() => setLoadOpen(true)}>
                                    <CalendarPlus className="w-4 h-4 mr-1" /> Cargar nueva sesión
                                </Button>
                                <Button
                                    className="bg-rose-600 hover:bg-rose-700"
                                    onClick={applyDpi}
                                    disabled={applyingDpi || detail.n_at_risk === 0}
                                    title="Marca DPI en el acta para los alumnos en riesgo"
                                >
                                    {applyingDpi ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <AlertTriangle className="w-4 h-4 mr-1" />}
                                    Aplicar DPI al acta ({detail.n_at_risk})
                                </Button>
                                <Button variant="ghost" onClick={() => setDetailOpen(false)}>Cerrar</Button>
                            </DialogFooter>
                        </>
                    ) : null}
                </DialogContent>
            </Dialog>

            {/* ── Diálogo: Cargar sesión de asistencia ── */}
            <Dialog open={loadOpen} onOpenChange={setLoadOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CalendarPlus className="w-5 h-5" /> Cargar asistencia {detail?.course && `· ${detail.course}`}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <Label className="text-xs font-bold">Fecha</Label>
                        <Input type="date" className="h-8 w-40 text-sm"
                            value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />
                        <Button size="sm" variant="outline" className="h-8 ml-auto"
                            onClick={() => setSessionRows((rs) => rs.map((r) => ({ ...r, status: "PRESENT" })))}>
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Todos presentes
                        </Button>
                    </div>
                    <div className="max-h-[55vh] overflow-y-auto rounded-lg border">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-100 text-[11px] uppercase text-slate-600 sticky top-0">
                                <tr>
                                    <th className="px-2 py-2 text-left">DNI</th>
                                    <th className="px-2 py-2 text-left">Alumno</th>
                                    <th className="px-2 py-2 text-center">Estado (P/F/T/J)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sessionRows.map((r, idx) => (
                                    <tr key={r.student_id} className="border-t">
                                        <td className="px-2 py-1.5 font-mono text-xs">{r.dni}</td>
                                        <td className="px-2 py-1.5">{r.full_name}</td>
                                        <td className="px-2 py-1.5 text-center">
                                            <StatusToggle
                                                value={r.status}
                                                onChange={(v) => setSessionRows((rs) => {
                                                    const next = [...rs];
                                                    next[idx] = { ...next[idx], status: v };
                                                    return next;
                                                })}
                                                disabled={savingSession}
                                            />
                                        </td>
                                    </tr>
                                ))}
                                {sessionRows.length === 0 && (
                                    <tr><td colSpan={3} className="py-6 text-center text-slate-500">
                                        Sin alumnos en la sección.
                                    </td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setLoadOpen(false)} disabled={savingSession}>Cancelar</Button>
                        <Button onClick={saveSession} disabled={savingSession || sessionRows.length === 0}
                            className="bg-indigo-600 hover:bg-indigo-700">
                            {savingSession ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                            Guardar asistencia
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}

function Kpi({ color = "slate", label, value, icon = null }) {
    const tones = {
        slate:   "bg-slate-50  border-slate-200  text-slate-700",
        rose:    "bg-rose-50   border-rose-200   text-rose-700",
        amber:   "bg-amber-50  border-amber-200  text-amber-800",
        emerald: "bg-emerald-50 border-emerald-200 text-emerald-800",
    };
    return (
        <div className={`rounded-lg border px-3 py-2 ${tones[color]}`}>
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase opacity-80">
                {icon} {label}
            </div>
            <div className="text-xl font-extrabold mt-0.5">{value}</div>
        </div>
    );
}
