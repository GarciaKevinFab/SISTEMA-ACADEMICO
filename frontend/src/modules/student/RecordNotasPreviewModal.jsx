/* ═══════════════════════════════════════════════════════════════
   RecordNotasPreviewModal
   Modal con vista previa del Record de Notas estructurado por
   periodo / ciclo, con edición inline de notas para roles
   ADMIN_SYSTEM / ADMIN_ACADEMIC, y opción de descargar el PDF.
   ═══════════════════════════════════════════════════════════════ */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { toast } from "sonner";
import {
    X, Download, Save, Loader2, AlertCircle, Pencil, RefreshCw, Info,
    BookOpen, Calendar, TrendingUp, Award, FileText, CheckCircle2,
    ChevronLeft, ChevronRight, LayoutGrid, Maximize2,
} from "lucide-react";
import { Kardex } from "../../services/academic.service";
import { useAuth } from "../../context/AuthContext";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const SEM_BY_ROMAN = Object.fromEntries(ROMAN.map((r, i) => [r, i + 1]));

const isAdminish = (user) => {
    const roles = user?.roles || user?.user_roles || user?.role_names || [];
    const names = Array.isArray(roles)
        ? roles.map((r) => (typeof r === "string" ? r : r?.name)).filter(Boolean)
        : [];
    const allowed = new Set([
        "ADMIN_SYSTEM", "ADMIN_ACADEMIC", "ADMIN_ACADEMICO",
    ]);
    if (user?.is_staff || user?.is_superuser) return true;
    return names.some((r) => allowed.has(String(r).toUpperCase()));
};

const _fmt = (n) => {
    if (n === null || n === undefined || n === "") return "";
    const x = Number(n);
    if (!Number.isFinite(x)) return String(n);
    return Number.isInteger(x) ? String(x) : x.toFixed(2);
};

// Escala MINEDU (RVM N° 123-2022): 01-05 PREVIO AL INICIO · 06-10 INICIO
// · 11-14 EN PROCESO · 15-19 LOGRADO · 20 DESTACADO
const _calif = (g) => {
    const x = Number(g);
    if (!Number.isFinite(x)) return "";
    if (x >= 20) return "DESTACADO";
    if (x >= 15) return "LOGRADO";
    if (x >= 11) return "EN PROCESO";
    if (x >= 6)  return "INICIO";
    return "PREVIO AL INICIO";
};

/** Normaliza un período a "YYYY-I" / "YYYY-II" para ordenar */
const periodSortKey = (p) => {
    const m = /^(\d{4})\s*-?\s*(I{1,3}|1|2|3)$/i.exec(String(p || "").trim());
    if (!m) return 0;
    const y = parseInt(m[1], 10);
    const t = m[2].toUpperCase();
    const ti = t === "I" || t === "1" ? 0 : t === "II" || t === "2" ? 1 : 2;
    return y * 10 + ti;
};

export default function RecordNotasPreviewModal({
    open,
    onClose,
    studentKey,        // DNI o ID
    studentName = "",
    apiHelper,         // axios instance (de useAuth().api)
    onPrint,           // callback para descargar el PDF
}) {
    const { user, api: ctxApi } = useAuth();
    const api = apiHelper || ctxApi;
    const canEdit = isAdminish(user);

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [records, setRecords] = useState([]);          // raw del backend (historical)
    const [edits, setEdits] = useState({});              // { record_id: { final_grade: "13" } }
    const [studentId, setStudentId] = useState(null);    // resolver DNI → ID
    const [pageIndex, setPageIndex] = useState(0);       // navegación por pares
    const [perPage, setPerPage] = useState(2);           // 1 = un periodo / 2 = par
    const [viewMode, setViewMode] = useState("paged");   // "paged" | "all"

    /* ── Cargar registros históricos ── */
    const load = useCallback(async () => {
        if (!studentKey || !open) return;
        setLoading(true);
        try {
            // 1) Resolver student_id — studentKey puede ser ID numérico O DNI.
            //    Probamos primero como ID directo (caso admin), si falla buscamos por DNI.
            const key = String(studentKey).trim();
            let sid = null;

            if (/^\d+$/.test(key)) {
                // Intento 1: lookup directo por pk
                try {
                    const r = await api.get(`/students/${key}`);
                    if (r?.data?.id) sid = r.data.id;
                } catch { /* ignore — no era el pk, intentamos por DNI */ }
            }

            // Intento 2: búsqueda por DNI/nombre (q=...)
            if (!sid) {
                try {
                    const r = await api.get("/students", { params: { q: key } });
                    const list = r?.data?.students || [];
                    // Match exacto por DNI primero, sino el primero
                    const exact = list.find((s) => String(s.numDocumento || s.dni || "") === key);
                    sid = (exact || list[0])?.id || null;
                } catch { /* ignore */ }
            }

            if (!sid) {
                toast.error("No se encontró el estudiante");
                setRecords([]);
                return;
            }
            setStudentId(sid);

            // 2) Pedir notas históricas
            const r2 = await api.get("/academic/grades/historical", { params: { student_id: sid } });
            const recs = r2?.data?.records || r2?.data?.data?.records || [];
            setRecords(Array.isArray(recs) ? recs : []);
            setEdits({});
        } catch (e) {
            toast.error(e?.response?.data?.detail || e?.message || "Error cargando notas");
        } finally {
            setLoading(false);
        }
    }, [studentKey, open, api]);

    useEffect(() => { load(); }, [load]);

    /* ── Reset pageIndex cuando cambia data o perPage ── */
    useEffect(() => { setPageIndex(0); }, [records.length, perPage, viewMode]);

    /* ── Atajos teclado: ← → para navegar ── */
    useEffect(() => {
        if (!open || viewMode !== "paged") return;
        const handler = (e) => {
            if (e.target.tagName === "INPUT") return;
            if (e.key === "ArrowRight") setPageIndex((i) => Math.min(i + 1, Math.ceil((records.length || 1) / perPage) - 1));
            if (e.key === "ArrowLeft") setPageIndex((i) => Math.max(i - 1, 0));
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [open, viewMode, records.length, perPage]);

    /* ── Agrupar por periodo ── */
    const periods = useMemo(() => {
        const by = new Map();
        for (const r of records) {
            const t = (r.term || "SIN-PERIODO").trim();
            if (!by.has(t)) by.set(t, []);
            by.get(t).push(r);
        }
        // ordenar periodos
        const ordered = Array.from(by.keys()).sort((a, b) => periodSortKey(a) - periodSortKey(b));
        return ordered.map((term) => {
            const rows = by.get(term).slice();
            // ordenar por código
            rows.sort((a, b) => String(a.course_code || "").localeCompare(String(b.course_code || "")));
            return { term, rows };
        });
    }, [records]);

    /* ── Promedio por periodo (usando el valor editado si existe) ── */
    const periodAvg = (rows) => {
        const nums = rows.map((r) => {
            const ed = edits[r.id]?.final_grade;
            const v = ed !== undefined && ed !== "" ? Number(ed) : Number(r.final_grade);
            return Number.isFinite(v) ? v : null;
        }).filter((x) => x !== null);
        if (!nums.length) return "";
        return (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2);
    };

    /* ── Manejar edición ── */
    const handleGradeChange = (recordId, val) => {
        // Permitir vacío para borrar; sino limpiar a número
        const cleaned = val.replace(/[^\d.]/g, "");
        setEdits((prev) => ({
            ...prev,
            [recordId]: { ...prev[recordId], final_grade: cleaned },
        }));
    };

    const hasChanges = Object.keys(edits).some((id) => {
        const ed = edits[id]?.final_grade;
        if (ed === undefined || ed === "") return false;
        const rec = records.find((r) => r.id === Number(id));
        if (!rec) return false;
        return Number(ed) !== Number(rec.final_grade);
    });

    /* ── Guardar ── */
    const handleSave = async () => {
        if (!hasChanges || !studentId) return;
        const payload = {
            student_id: studentId,
            records: Object.entries(edits)
                .filter(([_id, ed]) => ed?.final_grade !== undefined && ed.final_grade !== "")
                .map(([id, ed]) => {
                    const rec = records.find((r) => r.id === Number(id));
                    if (!rec) return null;
                    const fg = Number(ed.final_grade);
                    if (!Number.isFinite(fg) || fg < 0 || fg > 20) return null;
                    if (fg === Number(rec.final_grade)) return null;
                    return {
                        course_id: rec.course_id,
                        term: rec.term,
                        final_grade: fg,
                        components: rec.components || {},
                    };
                })
                .filter(Boolean),
        };
        if (!payload.records.length) {
            toast.info("No hay cambios válidos para guardar");
            return;
        }
        setSaving(true);
        try {
            const r = await api.post("/academic/grades/historical", payload);
            const data = r?.data || {};
            const updated = data.updated ?? 0;
            const errs = data.errors || [];
            if (errs.length) {
                toast.warning(`${updated} actualizado(s) con ${errs.length} errores`);
            } else {
                toast.success(`${updated} nota(s) actualizada(s)`);
            }
            await load();
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Error guardando notas");
        } finally {
            setSaving(false);
        }
    };

    if (!open) return null;

    // Estadísticas globales para el header
    const totalCourses = records.length;
    const allGrades = records.map((r) => {
        const ed = edits[r.id]?.final_grade;
        return ed !== undefined && ed !== "" ? Number(ed) : Number(r.final_grade);
    }).filter((x) => Number.isFinite(x));
    const overallAvg = allGrades.length
        ? (allGrades.reduce((a, b) => a + b, 0) / allGrades.length).toFixed(2)
        : "—";
    const failedCount = allGrades.filter((g) => g < 11).length;

    // Color del avg según el rango
    const avgTone = (val) => {
        const v = Number(val);
        if (!Number.isFinite(v)) return "slate";
        if (v >= 17) return "emerald";
        if (v >= 14) return "blue";
        if (v >= 11) return "amber";
        return "rose";
    };
    const TONE_STYLES = {
        emerald: { bar: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700 border-emerald-200", num: "text-emerald-700" },
        blue:    { bar: "bg-blue-500",    chip: "bg-blue-50 text-blue-700 border-blue-200",          num: "text-blue-700" },
        amber:   { bar: "bg-amber-500",   chip: "bg-amber-50 text-amber-700 border-amber-200",       num: "text-amber-700" },
        rose:    { bar: "bg-rose-500",    chip: "bg-rose-50 text-rose-700 border-rose-200",          num: "text-rose-700" },
        slate:   { bar: "bg-slate-300",   chip: "bg-slate-100 text-slate-600 border-slate-200",      num: "text-slate-600" },
    };

    const califChip = (calif) => {
        if (calif === "DESTACADO") return "bg-violet-100 text-violet-700 border-violet-200";
        if (calif === "LOGRADO") return "bg-emerald-100 text-emerald-700 border-emerald-200";
        if (calif === "EN PROCESO") return "bg-amber-100 text-amber-700 border-amber-200";
        if (calif === "INICIO") return "bg-orange-100 text-orange-700 border-orange-200";
        if (calif === "PREVIO AL INICIO") return "bg-rose-100 text-rose-700 border-rose-200";
        return "bg-slate-100 text-slate-600 border-slate-200";
    };
    const califAbbr = (calif) => ({
        "DESTACADO":        "DEST",
        "LOGRADO":          "LOG",
        "EN PROCESO":       "PROC",
        "INICIO":           "INI",
        "PREVIO AL INICIO": "PRE",
    }[calif] || "—");

    /* ── Paginación: dividir periodos en pages de `perPage` ── */
    const totalPages = Math.max(1, Math.ceil(periods.length / perPage));
    const currentPage = Math.min(pageIndex, totalPages - 1);
    const visiblePeriods = viewMode === "all"
        ? periods
        : periods.slice(currentPage * perPage, currentPage * perPage + perPage);
    const pageStart = currentPage * perPage + 1;
    const pageEnd = Math.min(pageStart + perPage - 1, periods.length);

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-2 sm:p-3 md:p-4"
            onClick={onClose}
        >
            <div
                className={`bg-slate-50 rounded-xl sm:rounded-2xl shadow-2xl w-full ${viewMode === "paged" && perPage === 1 ? "max-w-3xl" : "max-w-[1500px]"} max-h-[96vh] flex flex-col overflow-hidden ring-1 ring-slate-200 transition-all duration-200 my-auto`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header con identidad visual — responsive */}
                <div className="px-3 sm:px-5 py-2.5 sm:py-3 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white shrink-0">
                    <div className="flex items-center justify-between gap-2 sm:gap-4 flex-wrap">
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 grid place-items-center shrink-0 shadow-md shadow-emerald-500/20">
                                <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                            </div>
                            <div className="min-w-0 leading-tight">
                                <h3 className="text-sm sm:text-base font-extrabold text-slate-800 truncate">
                                    Record de Notas — Vista previa
                                </h3>
                                <p className="text-[11px] sm:text-xs text-slate-500 truncate mt-0.5">
                                    {studentName || studentKey}
                                    {canEdit && (
                                        <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-700 text-[10px]">
                                            <Pencil className="w-2.5 h-2.5" /> ADMIN
                                        </span>
                                    )}
                                </p>
                            </div>
                        </div>

                        {/* Stats rápidas — solo en pantallas md+ */}
                        {!loading && periods.length > 0 && (
                            <div className="hidden lg:flex items-center gap-2">
                                <div className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 flex items-center gap-2 shadow-sm">
                                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                    <div className="leading-none">
                                        <div className="text-[9px] font-700 uppercase tracking-wider text-slate-400">Periodos</div>
                                        <div className="text-sm font-extrabold text-slate-700 mt-0.5">{periods.length}</div>
                                    </div>
                                </div>
                                <div className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 flex items-center gap-2 shadow-sm">
                                    <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                                    <div className="leading-none">
                                        <div className="text-[9px] font-700 uppercase tracking-wider text-slate-400">Cursos</div>
                                        <div className="text-sm font-extrabold text-slate-700 mt-0.5">{totalCourses}</div>
                                    </div>
                                </div>
                                <div className={`px-3 py-1.5 rounded-lg bg-white border ${TONE_STYLES[avgTone(overallAvg)].chip.split(" ")[2] || "border-slate-200"} flex items-center gap-2 shadow-sm`}>
                                    <TrendingUp className={`w-3.5 h-3.5 ${TONE_STYLES[avgTone(overallAvg)].num}`} />
                                    <div className="leading-none">
                                        <div className="text-[9px] font-700 uppercase tracking-wider text-slate-400">PPA</div>
                                        <div className={`text-sm font-extrabold mt-0.5 ${TONE_STYLES[avgTone(overallAvg)].num}`}>{overallAvg}</div>
                                    </div>
                                </div>
                                {failedCount > 0 && (
                                    <div className="px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 flex items-center gap-2 shadow-sm">
                                        <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                                        <div className="leading-none">
                                            <div className="text-[9px] font-700 uppercase tracking-wider text-rose-500">Desaprob.</div>
                                            <div className="text-sm font-extrabold text-rose-700 mt-0.5">{failedCount}</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Stats simplificadas en pantallas pequeñas */}
                        {!loading && periods.length > 0 && (
                            <div className="flex lg:hidden items-center gap-1.5 text-[10px] font-700 text-slate-500">
                                <span className="px-2 py-1 rounded bg-white border border-slate-200">P:{periods.length}</span>
                                <span className="px-2 py-1 rounded bg-white border border-slate-200">C:{totalCourses}</span>
                                <span className={`px-2 py-1 rounded bg-white border ${TONE_STYLES[avgTone(overallAvg)].chip.split(" ")[2] || "border-slate-200"} ${TONE_STYLES[avgTone(overallAvg)].num}`}>PPA:{overallAvg}</span>
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 sm:p-2 hover:bg-slate-100 rounded-lg shrink-0 transition-colors"
                        >
                            <X className="w-4 h-4 text-slate-500" />
                        </button>
                    </div>
                </div>

                {/* Body con grid de 2 columnas */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-20 text-slate-500 gap-2">
                            <Loader2 className="w-5 h-5 animate-spin" /> Cargando notas históricas…
                        </div>
                    ) : periods.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <AlertCircle className="w-10 h-10 text-amber-400 mb-2" />
                            <p className="text-sm font-700 text-slate-600">Sin registros académicos</p>
                            <p className="text-xs text-slate-400 mt-1">
                                Este alumno no tiene notas históricas registradas.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {canEdit && (
                                <div className="rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 px-3 py-2 flex items-start gap-2 text-xs text-blue-800">
                                    <Info className="w-4 h-4 mt-0.5 shrink-0" />
                                    <span>
                                        Click sobre la <strong>NOTA</strong> para editar (0 al 20).
                                        Los promedios se recalculan al instante. Recuerda <strong>guardar</strong> antes de imprimir.
                                    </span>
                                </div>
                            )}

                            {/* ── Barra de navegación de periodos — responsive ── */}
                            <div className="rounded-xl bg-white border border-slate-200 px-2 sm:px-3 py-2 flex items-center gap-2 flex-wrap shadow-sm sticky top-0 z-10">
                                {/* Pills de cada periodo (clickables) */}
                                <div className="flex items-center gap-1 flex-wrap flex-1 min-w-0 overflow-x-auto">
                                    {periods.map((p, idx) => {
                                        const isActive = viewMode === "paged"
                                            && idx >= currentPage * perPage
                                            && idx < currentPage * perPage + perPage;
                                        const tone = avgTone(periodAvg(p.rows));
                                        return (
                                            <button
                                                key={p.term}
                                                type="button"
                                                onClick={() => {
                                                    setViewMode("paged");
                                                    setPageIndex(Math.floor(idx / perPage));
                                                }}
                                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-700 transition-all border ${isActive
                                                    ? `${TONE_STYLES[tone].chip} ring-2 ring-offset-1 ring-slate-300`
                                                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                                                title={`${p.term} · Ciclo ${p.rows[0]?.ciclo_roman || "—"} · Prom. ${periodAvg(p.rows) || "—"}`}
                                            >
                                                <span className={`w-1.5 h-1.5 rounded-full ${TONE_STYLES[tone].bar}`} />
                                                {p.term}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Controles de paginación + toggle vista */}
                                <div className="flex items-center gap-1 shrink-0 border-l border-slate-200 pl-2">
                                    {viewMode === "paged" && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => setPageIndex((i) => Math.max(i - 1, 0))}
                                                disabled={currentPage === 0}
                                                className="h-7 w-7 rounded-md grid place-items-center hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                                                title="Anterior (←)"
                                            >
                                                <ChevronLeft className="w-4 h-4 text-slate-600" />
                                            </button>
                                            <span className="text-[11px] font-700 text-slate-600 px-1 tabular-nums">
                                                {pageStart}{pageEnd > pageStart ? `–${pageEnd}` : ""} <span className="text-slate-400">/ {periods.length}</span>
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setPageIndex((i) => Math.min(i + 1, totalPages - 1))}
                                                disabled={currentPage >= totalPages - 1}
                                                className="h-7 w-7 rounded-md grid place-items-center hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                                                title="Siguiente (→)"
                                            >
                                                <ChevronRight className="w-4 h-4 text-slate-600" />
                                            </button>
                                            <div className="w-px h-5 bg-slate-200 mx-1" />
                                            <button
                                                type="button"
                                                onClick={() => setPerPage((n) => (n === 1 ? 2 : 1))}
                                                className="h-7 px-2 rounded-md text-[10px] font-700 text-slate-600 hover:bg-slate-100 flex items-center gap-1"
                                                title="Cambiar cantidad por página"
                                            >
                                                <LayoutGrid className="w-3 h-3" />
                                                {perPage === 1 ? "1×" : "2×"}
                                            </button>
                                        </>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setViewMode((v) => (v === "all" ? "paged" : "all"))}
                                        className={`h-7 px-2 rounded-md text-[10px] font-700 flex items-center gap-1 ${viewMode === "all"
                                            ? "bg-blue-100 text-blue-700"
                                            : "text-slate-600 hover:bg-slate-100"}`}
                                        title="Ver todos los periodos"
                                    >
                                        <Maximize2 className="w-3 h-3" />
                                        {viewMode === "all" ? "Salir" : "Ver todos"}
                                    </button>
                                </div>
                            </div>

                            <div className={viewMode === "all"
                                ? "grid grid-cols-1 lg:grid-cols-2 gap-3"
                                : (perPage === 1
                                    ? "grid grid-cols-1 gap-4"
                                    : "grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4")}>
                                {visiblePeriods.map((p) => {
                                    const avgVal = periodAvg(p.rows);
                                    const tone = avgTone(avgVal);
                                    const styles = TONE_STYLES[tone];
                                    // Cards más espaciosos cuando se muestran pocos a la vez
                                    const isFocused = viewMode === "paged";
                                    const rowPy = isFocused ? "py-2.5" : "py-1.5";
                                    const rowText = isFocused ? "text-[12px]" : "text-[10.5px]";
                                    const headerTxt = isFocused ? "text-[11px]" : "text-[9.5px]";
                                    const inputSize = isFocused ? "h-8 w-14 text-[13px]" : "h-6 w-12 text-[11px]";
                                    return (
                                        <div key={p.term} className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
                                            {/* Barra de color por avg */}
                                            <div className={`h-1 ${styles.bar}`} />

                                            {/* Period header */}
                                            <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                                                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                                    <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                                                    <span className="text-[10px] font-700 uppercase tracking-wider text-slate-400">Periodo</span>
                                                    <span className="text-sm sm:text-base font-extrabold text-slate-800">{p.term}</span>
                                                    {p.rows[0]?.ciclo_roman && (
                                                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
                                                            Ciclo {p.rows[0]?.ciclo_roman}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className={`px-3 py-1 rounded-full ${styles.chip} border flex items-center gap-1.5 shrink-0`}>
                                                    <Award className="w-3.5 h-3.5" />
                                                    <span className="text-[10px] font-700 uppercase tracking-wider opacity-70">Prom.</span>
                                                    <span className="text-sm font-extrabold">{avgVal || "—"}</span>
                                                </div>
                                            </div>

                                            <div className="overflow-x-auto flex-1">
                                                <table className="w-full">
                                                    <thead>
                                                        <tr className={`text-slate-500 ${headerTxt} bg-slate-50/70`}>
                                                            <th className="text-left px-2 py-2 font-700 w-7">N°</th>
                                                            <th className="text-left px-2 py-2 font-700">CURSO</th>
                                                            <th className="text-center px-1 py-2 font-700 w-[78px]">CALIF.</th>
                                                            <th className="text-center px-1 py-2 font-700 w-16">NOTA</th>
                                                            <th className="text-center px-1 py-2 font-700 w-10">CRD</th>
                                                            <th className="text-center px-1 py-2 font-700 w-12">PTJE</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {p.rows.map((r, i) => {
                                                            const editedVal = edits[r.id]?.final_grade;
                                                            const currentGrade = editedVal !== undefined && editedVal !== ""
                                                                ? Number(editedVal)
                                                                : Number(r.final_grade);
                                                            const credits = Number(r.credits ?? r.components?.CREDITS ?? r.components?.credits ?? 0);
                                                            const points = Number.isFinite(currentGrade) && credits > 0 ? currentGrade * credits : "";
                                                            const isDirty = editedVal !== undefined
                                                                && editedVal !== ""
                                                                && Number(editedVal) !== Number(r.final_grade);
                                                            const calif = _calif(currentGrade);
                                                            const isFailed = Number.isFinite(currentGrade) && currentGrade < 11;

                                                            return (
                                                                <tr key={r.id} className={`hover:bg-slate-50/60 transition-colors ${isDirty ? "bg-amber-50/60" : ""}`}>
                                                                    <td className={`px-2 ${rowPy} text-slate-400 text-[10px] font-700`}>{i + 1}</td>
                                                                    <td className={`px-2 ${rowPy} font-700 text-slate-800 uppercase leading-tight ${rowText} tracking-tight`}>
                                                                        {r.course_name}
                                                                    </td>
                                                                    <td className={`px-1 ${rowPy} text-center`}>
                                                                        <span
                                                                            title={calif || ""}
                                                                            className={`inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${califChip(calif)} whitespace-nowrap`}
                                                                        >
                                                                            {califAbbr(calif)}
                                                                        </span>
                                                                    </td>
                                                                    <td className={`px-1 ${rowPy} text-center`}>
                                                                        {canEdit ? (
                                                                            <Input
                                                                                type="text"
                                                                                inputMode="decimal"
                                                                                value={editedVal !== undefined ? editedVal : (r.final_grade ?? "")}
                                                                                onChange={(e) => handleGradeChange(r.id, e.target.value)}
                                                                                className={`${inputSize} px-1 text-center font-extrabold mx-auto rounded ${isDirty
                                                                                    ? "border-amber-400 ring-2 ring-amber-200 bg-amber-50"
                                                                                    : isFailed
                                                                                        ? "border-rose-300 text-rose-700 bg-rose-50/50"
                                                                                        : "border-slate-300"}`}
                                                                            />
                                                                        ) : (
                                                                            <span className={`font-extrabold ${isFailed ? "text-rose-700" : "text-slate-800"} ${rowText}`}>{_fmt(currentGrade)}</span>
                                                                        )}
                                                                    </td>
                                                                    <td className={`px-1 ${rowPy} text-center text-slate-500 font-600 text-[10px]`}>{credits || "—"}</td>
                                                                    <td className={`px-1 ${rowPy} text-center font-700 text-slate-700 ${rowText}`}>
                                                                        {Number.isFinite(points) && points !== "" ? _fmt(points) : ""}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer compacto */}
                <div className="px-4 py-2 border-t border-slate-200 flex items-center justify-between gap-3 bg-white shrink-0">
                    <div className="text-[11px] text-slate-500">
                        {hasChanges ? (
                            <span className="text-amber-700 font-700 flex items-center gap-1.5">
                                <AlertCircle className="w-3.5 h-3.5" /> Hay cambios sin guardar
                            </span>
                        ) : (
                            <span className="text-slate-400">
                                {periods.length} periodo{periods.length === 1 ? "" : "s"} · {records.length} curso{records.length === 1 ? "" : "s"}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Button
                            variant="outline"
                            className="h-8 rounded-md text-xs gap-1.5"
                            onClick={load}
                            disabled={loading || saving}
                        >
                            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                            Recargar
                        </Button>
                        {canEdit && (
                            <Button
                                className="h-8 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-xs font-700 gap-1.5"
                                onClick={handleSave}
                                disabled={!hasChanges || saving}
                            >
                                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                Guardar
                            </Button>
                        )}
                        <Button
                            className="h-8 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-700 gap-1.5"
                            onClick={onPrint}
                            disabled={saving}
                            title={hasChanges ? "Guarda los cambios antes de descargar para que aparezcan en el PDF" : ""}
                        >
                            <Download className="w-3 h-3" />
                            Imprimir / PDF
                        </Button>
                        <Button
                            variant="outline"
                            className="h-8 rounded-md text-xs"
                            onClick={onClose}
                            disabled={saving}
                        >
                            Cerrar
                        </Button>
                    </div>
                </div>
            </div>

        </div>
    );
}
