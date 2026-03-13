// src/modules/admission/EvaluationBoard.jsx
//
// Evaluación de postulantes — Alineado con Ficha MINEDU
// Columnas: Comunicación (20), Resolución Problemas (20), Convivencia (10),
//           Resultado F1, Estado F1, Pensamiento Crítico (20),
//           Trabajo Colaborativo (20), TIC (10), Resultado F2, Condición

import React, { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { AdmissionCalls, Evaluation } from "../../services/admission.service";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { toast } from "sonner";
import {
    Upload, FileSpreadsheet, Edit, Save, ChevronDown, ChevronUp,
    Search, Loader2, CheckCircle2, XCircle, AlertCircle, Users,
    Calendar, GraduationCap,
} from "lucide-react";

/* ─── Helpers ────────────────────────────────────────────── */
const toNum = (v) => {
    if (v == null || v === "") return 0;
    const n = Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : 0;
};
const fmt = (v) => (v == null || v === "" || v === 0) ? "—" : Number(v).toFixed(1);
const normalizeHeader = (h) => String(h || "").replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
const stripAccents = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const guessHeader = (rawHeaders, patterns) => {
    for (let i = 0; i < rawHeaders.length; i++) {
        const normalized = stripAccents(normalizeHeader(rawHeaders[i]));
        if (patterns.some(p => p.test(normalized))) return rawHeaders[i];
    }
    return "";
};

/* ─── Phase definitions (MINEDU) ────────────────────────── */
const FASE1_FIELDS = [
    { key: "comunicacion", label: "Com. Lengua Materna", short: "CLM", max: 20 },
    { key: "resolucion_problemas", label: "Resoluc. Problemas", short: "RP", max: 20 },
    { key: "convivencia", label: "Convivencia", short: "Conv", max: 10 },
];
const FASE2_FIELDS = [
    { key: "pensamiento_critico", label: "Pensam. Crítico", short: "PC", max: 20 },
    { key: "trabajo_colaborativo", label: "Trabajo Colaborativo", short: "TC", max: 20 },
    { key: "tic", label: "TIC", short: "TIC", max: 10 },
];

/* ─── Small shared components ────────────────────────────── */
const FieldLabel = ({ children }) => (
    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">{children}</p>
);

const SectionHead = ({ color = "blue", icon: Icon, label, sub }) => {
    const colorMap = {
        blue: { box: "bg-blue-50 border-blue-100 text-blue-600", text: "text-blue-700" },
        indigo: { box: "bg-indigo-50 border-indigo-100 text-indigo-600", text: "text-indigo-700" },
        emerald: { box: "bg-emerald-50 border-emerald-100 text-emerald-600", text: "text-emerald-700" },
    };
    const c = colorMap[color] ?? colorMap.blue;
    return (
        <div className="flex items-center gap-2 mb-3">
            {Icon && (
                <div className={`h-6 w-6 rounded-lg border grid place-items-center shrink-0 ${c.box}`}>
                    <Icon size={12} />
                </div>
            )}
            <div>
                <p className={`text-[10px] font-extrabold uppercase tracking-widest ${c.text}`}>{label}</p>
                {sub && <p className="text-[10px] text-slate-400">{sub}</p>}
            </div>
            <div className="flex-1 h-px bg-slate-100" />
        </div>
    );
};

/* Estado F1 badge */
const EstadoBadge = ({ value }) => {
    if (!value) return <span className="text-slate-300">—</span>;
    const apt = value.toUpperCase().includes("APT") && !value.toUpperCase().includes("NO");
    return (
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${apt ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"
            }`}>
            {apt ? <CheckCircle2 size={9} /> : <XCircle size={9} />}
            {value.length > 16 ? value.slice(0, 14) + "…" : value}
        </span>
    );
};

/* Condición badge */
const CondicionBadge = ({ value }) => {
    if (!value) return <span className="text-slate-300">—</span>;
    const v = value.toUpperCase();
    const ingresa = (v.includes("INGRESA") && !v.includes("NO")) || (v.includes("ALCANZA") && !v.includes("NO"));
    return (
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${ingresa
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-rose-50 text-rose-700 border-rose-200"
            }`}>
            {ingresa ? <CheckCircle2 size={9} /> : <AlertCircle size={9} />}
            {value.length > 20 ? value.slice(0, 18) + "…" : value}
        </span>
    );
};

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════ */
export default function EvaluationBoard() {
    const [calls, setCalls] = useState([]);
    const [call, setCall] = useState(null);
    const [careerId, setCareerId] = useState("");
    const [rows, setRows] = useState([]);
    const [scores, setScores] = useState({});
    const [searchDni, setSearchDni] = useState("");

    const fileRef = useRef(null);
    const [excelHeaders, setExcelHeaders] = useState([]);
    const [excelRows, setExcelRows] = useState([]);
    const [importing, setImporting] = useState(false);
    const [showMapper, setShowMapper] = useState(false);

    const [mapCols, setMapCols] = useState({
        dni: "", programa_estudios: "",
        comunicacion: "", resolucion_problemas: "", convivencia: "",
        pensamiento_critico: "", trabajo_colaborativo: "", tic: "",
        fase1: "", fase2: "", condicion: "", estado_fase_1: "",
    });

    const [openManual, setOpenManual] = useState(false);
    const [manualRow, setManualRow] = useState(null);

    /* ── Data loading ── */
    useEffect(() => {
        AdmissionCalls.listAdmin().then(d => {
            const list = d?.admission_calls || d?.calls || d || [];
            setCalls(list);
            if (list.length === 1) setCall(list[0]);
        });
    }, []);

    const load = async () => {
        if (!call || !careerId) return;
        const data = await Evaluation.listForScoring({ call_id: call.id, career_id: careerId });
        const list = Array.isArray(data) ? data : data?.applications || data || [];
        setRows(list);
        const init = {};
        list.forEach(r => { init[r.id] = { ...(r.rubric || {}) }; });
        setScores(init);
    };

    useEffect(() => { if (call && careerId) load(); }, [call?.id, careerId]);

    /* ── Rubric helpers ── */
    const setRubricField = (appId, field, val) =>
        setScores(prev => ({ ...prev, [appId]: { ...(prev[appId] || {}), [field]: val } }));

    const calcFase1 = (rb) => toNum(rb?.comunicacion) + toNum(rb?.resolucion_problemas) + toNum(rb?.convivencia);
    const calcFase2 = (rb) => toNum(rb?.pensamiento_critico) + toNum(rb?.trabajo_colaborativo) + toNum(rb?.tic);
    const calcTotal = (rb) => calcFase1(rb) + calcFase2(rb);

    /* ── Excel import ── */
    const openFilePicker = () => {
        if (!call || !careerId) { toast.error("Selecciona convocatoria y carrera primero"); return; }
        fileRef.current?.click();
    };

    const onPickExcel = async (file) => {
        try {
            if (!file) return;
            const ab = await file.arrayBuffer();
            const wb = XLSX.read(ab, { type: "array" });
            const targetSheet = wb.SheetNames.find(n => /REPORTE\s*ADMISION/i.test(n)) || wb.SheetNames?.[0];
            const ws = wb.Sheets[targetSheet];
            if (!ws) return toast.error("Excel inválido");
            const json = XLSX.utils.sheet_to_json(ws, { defval: "" });
            if (!json.length) return toast.error("Hoja vacía");

            const headers = Object.keys(json[0] || {});
            setExcelHeaders(headers);
            setExcelRows(json);

            const dni = guessHeader(headers, [/NUMERO_DOCUMENTO_IDENTIDAD/i, /^DNI$/i, /DOCUMENTO.*IDENTIDAD/i]);
            const programa_estudios = guessHeader(headers, [/PROGRAMA\s*DE\s*ESTUDIOS/i, /CARRERA/i]);
            const comunicacion = guessHeader(headers, [/COMUNICACION.*LENGUA/i, /COMUNICACION.*20/i]);
            const resolucion_problemas = guessHeader(headers, [/RESOLUCION.*PROBLEMAS/i]);
            const convivencia = guessHeader(headers, [/CONVIVENCIA/i]);
            const fase1 = guessHeader(headers, [/RESULTADO\s*FASE\s*1/i]);
            const estado_fase_1 = guessHeader(headers, [/ESTADO.FASE.1/i]);
            const pensamiento_critico = guessHeader(headers, [/PENSAMIENTO.*CRITICO/i]);
            const trabajo_colaborativo = guessHeader(headers, [/TA?BAJO\s*COLABORATIVO/i, /COLABORATIVO/i]);
            const tic = guessHeader(headers, [/\bTIC\b/i]);
            const fase2 = guessHeader(headers, [/RESULTADO\s*FASE\s*2/i]);
            const condicion = guessHeader(headers, [/CONDICION/i]);

            setMapCols({
                dni: dni || "", programa_estudios: programa_estudios || "",
                comunicacion: comunicacion || "", resolucion_problemas: resolucion_problemas || "",
                convivencia: convivencia || "", fase1: fase1 || "",
                pensamiento_critico: pensamiento_critico || "", trabajo_colaborativo: trabajo_colaborativo || "",
                tic: tic || "", fase2: fase2 || "",
                condicion: condicion || "", estado_fase_1: estado_fase_1 || "",
            });

            setShowMapper(true);
            const detected = [dni, comunicacion, resolucion_problemas, convivencia,
                pensamiento_critico, trabajo_colaborativo, tic].filter(Boolean).length;
            toast.success(`Excel cargado: ${json.length} filas, ${detected}/7 columnas detectadas`);
        } catch (e) {
            console.error(e); toast.error("No se pudo leer el Excel");
        }
    };

    const doImport = async () => {
        if (!call || !careerId) return toast.error("Selecciona convocatoria y carrera");
        if (!excelRows.length) return toast.error("Primero carga un Excel");
        if (!mapCols.dni) return toast.error("Mapea la columna DNI");
        setImporting(true);
        try {
            const payloadRows = excelRows.map(r => {
                const dni = String(r[mapCols.dni] || "").trim();
                if (!dni) return null;
                const rubric = {
                    comunicacion: mapCols.comunicacion ? toNum(r[mapCols.comunicacion]) : 0,
                    resolucion_problemas: mapCols.resolucion_problemas ? toNum(r[mapCols.resolucion_problemas]) : 0,
                    convivencia: mapCols.convivencia ? toNum(r[mapCols.convivencia]) : 0,
                    fase1: mapCols.fase1 ? toNum(r[mapCols.fase1]) : 0,
                    pensamiento_critico: mapCols.pensamiento_critico ? toNum(r[mapCols.pensamiento_critico]) : 0,
                    trabajo_colaborativo: mapCols.trabajo_colaborativo ? toNum(r[mapCols.trabajo_colaborativo]) : 0,
                    tic: mapCols.tic ? toNum(r[mapCols.tic]) : 0,
                    fase2: mapCols.fase2 ? toNum(r[mapCols.fase2]) : 0,
                };
                if (mapCols.condicion) rubric.condicion = String(r[mapCols.condicion] || "").trim();
                if (mapCols.estado_fase_1) rubric.estado_fase_1 = String(r[mapCols.estado_fase_1] || "").trim();
                const programa = mapCols.programa_estudios ? String(r[mapCols.programa_estudios] || "").trim() : "";
                return { dni, rubric, programa_estudios: programa || undefined };
            }).filter(Boolean);

            const resp = await Evaluation.importScores({
                call_id: call.id, career_id: Number(careerId), rows: payloadRows,
            });
            toast.success(`Importación OK: ${resp?.updated ?? 0} actualizados`);
            if (resp?.not_found_count) toast.warning(`DNIs no encontrados: ${resp.not_found_count}`);
            setShowMapper(false); await load();
        } catch (e) {
            console.error(e); toast.error(e?.response?.data?.detail || "No se pudo importar");
        } finally { setImporting(false); }
    };

    /* ── Manual edit ── */
    const openManualEditor = (r) => { setManualRow(r); setOpenManual(true); };
    const saveManual = async () => {
        if (!manualRow) return;
        try {
            await Evaluation.saveScores(manualRow.id, scores[manualRow.id] || {});
            toast.success("Guardado"); setOpenManual(false); setManualRow(null); await load();
        } catch (e) { console.error(e); toast.error("No se pudo guardar"); }
    };

    /* ── Column mapper select ── */
    const shortHeader = (h) => { const s = normalizeHeader(h); return s.length > 40 ? s.slice(0, 37) + "…" : s; };

    const ColSelect = ({ label, colKey, required }) => (
        <div>
            <div className="flex items-center gap-1 mb-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
                {mapCols[colKey] && <CheckCircle2 size={10} className="text-emerald-500" />}
            </div>
            <Select value={mapCols[colKey] || "__none__"} onValueChange={v => setMapCols(p => ({ ...p, [colKey]: v === "__none__" ? "" : v }))}>
                <SelectTrigger className="h-8 rounded-xl text-xs">
                    <SelectValue placeholder={required ? "(requerido)" : "(opcional)"} />
                </SelectTrigger>
                <SelectContent>
                    {!required && <SelectItem value="__none__">(sin mapear)</SelectItem>}
                    {excelHeaders.map(h => <SelectItem key={h} value={h}>{shortHeader(h)}</SelectItem>)}
                </SelectContent>
            </Select>
        </div>
    );

    const filteredRows = searchDni ? rows.filter(r => (r.applicant_dni || "").includes(searchDni)) : rows;

    /* ═══════════════════════════════════════════════════════ */
    return (
        <div className="max-w-full mx-auto space-y-5 pb-12">

            {/* ── Page header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                        <div className="h-8 w-8 rounded-xl bg-blue-50 border border-blue-100 grid place-items-center shrink-0">
                            <FileSpreadsheet size={16} className="text-blue-600" />
                        </div>
                        Evaluación de Postulantes
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5 ml-10 font-medium uppercase tracking-wider">
                        Notas por fase — Ficha MINEDU · Reporte del Proceso de Admisión
                    </p>
                </div>
            </div>

            {/* ── Filters ── */}
            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm p-5">
                <div className="grid md:grid-cols-3 gap-4">
                    <div>
                        <FieldLabel>Convocatoria</FieldLabel>
                        <Select value={call?.id?.toString() || ""} onValueChange={v => setCall(calls.find(x => x.id.toString() === v))}>
                            <SelectTrigger className="h-10 rounded-xl">
                                <div className="flex items-center gap-2 min-w-0">
                                    <Calendar size={14} className="text-slate-400 shrink-0" />
                                    <SelectValue placeholder="Seleccione" />
                                </div>
                            </SelectTrigger>
                            <SelectContent>{calls.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div>
                        <FieldLabel>Carrera / Programa</FieldLabel>
                        <Select value={careerId} onValueChange={setCareerId}>
                            <SelectTrigger className="h-10 rounded-xl">
                                <div className="flex items-center gap-2 min-w-0">
                                    <GraduationCap size={14} className="text-slate-400 shrink-0" />
                                    <SelectValue placeholder="Seleccionar" />
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                {(call?.careers || []).map(k => <SelectItem key={k.id} value={k.id.toString()}>{k.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <FieldLabel>Buscar DNI</FieldLabel>
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <Input placeholder="Buscar por DNI…" className="h-10 pl-9 rounded-xl font-mono"
                                value={searchDni} onChange={e => setSearchDni(e.target.value)} />
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Excel importer ── */}
            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/60">
                    <div className="h-7 w-7 rounded-xl bg-blue-50 border border-blue-100 grid place-items-center shrink-0">
                        <Upload size={14} className="text-blue-600" />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-extrabold text-slate-800">Importar notas desde Excel</p>
                        <p className="text-[10px] text-slate-400 font-medium">Formato: Ficha de Reporte del Proceso de Admisión (MINEDU)</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
                            onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; onPickExcel(f); }} />
                        <Button type="button" variant="outline" className="rounded-xl font-semibold gap-2 h-9"
                            onClick={openFilePicker}>
                            <Upload size={14} /> Cargar Excel
                        </Button>
                        <Button type="button" className="rounded-xl font-extrabold gap-2 h-9 bg-blue-600 hover:bg-blue-700"
                            disabled={importing || !excelRows.length} onClick={doImport}>
                            {importing
                                ? <><Loader2 size={14} className="animate-spin" /> Importando…</>
                                : `Importar (${excelRows.length} filas)`}
                        </Button>
                    </div>
                </div>

                {excelRows.length > 0 && (
                    <div className="px-5 py-3 space-y-4">
                        <button type="button" onClick={() => setShowMapper(!showMapper)}
                            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors">
                            {showMapper ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            {showMapper ? "Ocultar mapeo de columnas" : "Mostrar mapeo de columnas"}
                        </button>

                        {showMapper && (
                            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-5">
                                <div className="grid md:grid-cols-2 gap-3">
                                    <ColSelect label="DNI *" colKey="dni" required />
                                    <ColSelect label="Programa de Estudios" colKey="programa_estudios" />
                                </div>

                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="h-5 w-5 rounded-md bg-blue-100 border border-blue-200 grid place-items-center shrink-0">
                                            <FileSpreadsheet size={10} className="text-blue-600" />
                                        </div>
                                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-blue-700">
                                            Fase 1 — Pruebas Escritas (50 pts)
                                        </p>
                                        <div className="flex-1 h-px bg-blue-100" />
                                    </div>
                                    <div className="grid md:grid-cols-4 gap-3">
                                        <ColSelect label="Comunicación (20)" colKey="comunicacion" />
                                        <ColSelect label="Resoluc. Problemas (20)" colKey="resolucion_problemas" />
                                        <ColSelect label="Convivencia (10)" colKey="convivencia" />
                                        <ColSelect label="Resultado Fase 1" colKey="fase1" />
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="h-5 w-5 rounded-md bg-indigo-100 border border-indigo-200 grid place-items-center shrink-0">
                                            <FileSpreadsheet size={10} className="text-indigo-600" />
                                        </div>
                                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-700">
                                            Fase 2 — Entrevista / Desempeño (50 pts)
                                        </p>
                                        <div className="flex-1 h-px bg-indigo-100" />
                                    </div>
                                    <div className="grid md:grid-cols-4 gap-3">
                                        <ColSelect label="Pensam. Crítico (20)" colKey="pensamiento_critico" />
                                        <ColSelect label="Trabajo Colabórat. (20)" colKey="trabajo_colaborativo" />
                                        <ColSelect label="TIC (10)" colKey="tic" />
                                        <ColSelect label="Resultado Fase 2" colKey="fase2" />
                                    </div>
                                </div>

                                <div className="grid md:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                                    <ColSelect label="Estado Fase 1" colKey="estado_fase_1" />
                                    <ColSelect label="Condición" colKey="condicion" />
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── Evaluation table ── */}
            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
                    <div className="h-7 w-7 rounded-xl bg-blue-50 border border-blue-100 grid place-items-center shrink-0">
                        <Users size={14} className="text-blue-600" />
                    </div>
                    <div>
                        <p className="text-sm font-extrabold text-slate-800">Tabla de Evaluación</p>
                        <p className="text-[10px] text-slate-400">Formato rúbrica MINEDU — Fas 1 (50 pts) + Fase 2 (50 pts) = 100 pts</p>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-xs whitespace-nowrap">
                        <thead>
                            {/* Row 1: phase groups */}
                            <tr className="border-b border-slate-200">
                                <th rowSpan={2} className="bg-slate-50 px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-r border-slate-200 min-w-[40px]">N°</th>
                                <th rowSpan={2} className="bg-slate-50 px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-r border-slate-200 min-w-[200px]">Postulante</th>
                                <th colSpan={5} className="bg-blue-50 px-2 py-2.5 text-center text-[10px] font-extrabold uppercase tracking-widest text-blue-800 border-r border-blue-200">
                                    FASE 1 — Prueba Escrita (50 pts)
                                </th>
                                <th colSpan={4} className="bg-indigo-50 px-2 py-2.5 text-center text-[10px] font-extrabold uppercase tracking-widest text-indigo-800 border-r border-indigo-200">
                                    FASE 2 — Entrevista (50 pts)
                                </th>
                                <th rowSpan={2} className="bg-emerald-50 px-2 py-2.5 text-center text-[10px] font-extrabold uppercase tracking-widest text-emerald-800 min-w-[60px]">
                                    TOTAL<br /><span className="text-[9px] font-normal">(100)</span>
                                </th>
                                <th rowSpan={2} className="bg-slate-50 px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-widest text-slate-500 min-w-[120px]">Condición</th>
                                <th rowSpan={2} className="bg-slate-50 px-2 py-2.5 min-w-[40px]" />
                            </tr>
                            {/* Row 2: sub-columns */}
                            <tr className="border-b-2 border-slate-200">
                                {/* Fase 1 */}
                                {[
                                    { label: "CLM", sub: "(20)", title: "Comunicación Lengua Materna", col: "blue" },
                                    { label: "RP", sub: "(20)", title: "Resolución de Problemas", col: "blue" },
                                    { label: "Conv", sub: "(10)", title: "Convivencia", col: "blue" },
                                    { label: "Res.F1", sub: "(50)", title: "Resultado Fase 1", col: "blue-bold" },
                                    { label: "Estado F1", sub: "", title: "Estado Fase 1", col: "blue-status" },
                                ].map(({ label, sub, title, col }) => (
                                    <th key={label} title={title}
                                        className={`px-2 py-2 text-center min-w-[52px] ${col === "blue-bold" ? "bg-blue-100/60 text-blue-800 font-extrabold border-r border-blue-200" :
                                                col === "blue-status" ? "bg-blue-50/70 text-blue-700 font-semibold border-r border-blue-200 min-w-[80px]" :
                                                    "bg-blue-50/60 text-blue-700 font-semibold border-r border-blue-100"
                                            }`}>
                                        {label}{sub && <><br /><span className="text-[9px] font-normal">{sub}</span></>}
                                    </th>
                                ))}
                                {/* Fase 2 */}
                                {[
                                    { label: "PC", sub: "(20)", title: "Pensamiento Crítico", col: "indigo" },
                                    { label: "TC", sub: "(20)", title: "Trabajo Colaborativo", col: "indigo" },
                                    { label: "TIC", sub: "(10)", title: "TIC", col: "indigo" },
                                    { label: "Res.F2", sub: "(50)", title: "Resultado Fase 2", col: "indigo-bold" },
                                ].map(({ label, sub, title, col }) => (
                                    <th key={label} title={title}
                                        className={`px-2 py-2 text-center min-w-[52px] ${col === "indigo-bold"
                                                ? "bg-indigo-100/60 text-indigo-800 font-extrabold border-r border-indigo-200"
                                                : "bg-indigo-50/60 text-indigo-700 font-semibold border-r border-indigo-100"
                                            }`}>
                                        {label}{sub && <><br /><span className="text-[9px] font-normal">{sub}</span></>}
                                    </th>
                                ))}
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-50">
                            {filteredRows.map((r, i) => {
                                const rb = scores[r.id] || r.rubric || {};
                                const f1 = rb.fase1 || calcFase1(rb);
                                const f2 = rb.fase2 || calcFase2(rb);
                                const total = f1 + f2;
                                const cond = rb.condicion || r.condicion || "";
                                // Auto-calcular estado F1: APTO si >= 30/50, NO APTO si < 30 (solo si hay notas)
                                const hasF1Scores = toNum(rb?.comunicacion) > 0 || toNum(rb?.resolucion_problemas) > 0 || toNum(rb?.convivencia) > 0;
                                const estadoF1 = rb.estado_fase_1 || (hasF1Scores ? (f1 >= 30 ? "APTO" : "NO APTO") : "");

                                return (
                                    <tr key={r.id} className="group hover:bg-blue-50/20 transition-colors">
                                        <td className="px-3 py-2.5 text-center text-slate-400 font-medium tabular-nums border-r border-slate-100">{i + 1}</td>
                                        <td className="px-3 py-2.5 border-r border-slate-100">
                                            <p className="font-semibold text-slate-900 max-w-[200px] truncate">{r.applicant_name || "—"}</p>
                                            <p className="text-[10px] text-slate-400 flex gap-1.5 mt-0.5">
                                                <span className="font-mono">{r.applicant_dni || "—"}</span>
                                                <span>·</span>
                                                <span className="truncate max-w-[120px]">{r.career_name || ""}</span>
                                            </p>
                                        </td>
                                        {/* Fase 1 */}
                                        <td className="px-2 py-2.5 text-center bg-blue-50/10 border-r border-blue-50 font-mono font-semibold tabular-nums text-slate-700">{fmt(rb.comunicacion)}</td>
                                        <td className="px-2 py-2.5 text-center bg-blue-50/10 border-r border-blue-50 font-mono font-semibold tabular-nums text-slate-700">{fmt(rb.resolucion_problemas)}</td>
                                        <td className="px-2 py-2.5 text-center bg-blue-50/10 border-r border-blue-50 font-mono font-semibold tabular-nums text-slate-700">{fmt(rb.convivencia)}</td>
                                        <td className="px-2 py-2.5 text-center bg-blue-50/30 border-r border-blue-100 font-mono font-extrabold tabular-nums text-blue-800">{fmt(f1)}</td>
                                        <td className="px-2 py-2.5 text-center border-r border-blue-200">
                                            <EstadoBadge value={estadoF1} />
                                        </td>
                                        {/* Fase 2 */}
                                        <td className="px-2 py-2.5 text-center bg-indigo-50/10 border-r border-indigo-50 font-mono font-semibold tabular-nums text-slate-700">{fmt(rb.pensamiento_critico)}</td>
                                        <td className="px-2 py-2.5 text-center bg-indigo-50/10 border-r border-indigo-50 font-mono font-semibold tabular-nums text-slate-700">{fmt(rb.trabajo_colaborativo)}</td>
                                        <td className="px-2 py-2.5 text-center bg-indigo-50/10 border-r border-indigo-50 font-mono font-semibold tabular-nums text-slate-700">{fmt(rb.tic)}</td>
                                        <td className="px-2 py-2.5 text-center bg-indigo-50/30 border-r border-indigo-200 font-mono font-extrabold tabular-nums text-indigo-800">{fmt(f2)}</td>
                                        {/* Total — verde si >= 60, rojo si < 60 */}
                                        <td className={`px-2 py-2.5 text-center font-mono font-black tabular-nums text-sm ${
                                            total > 0
                                                ? total >= 60
                                                    ? "bg-emerald-50/40 text-emerald-800"
                                                    : "bg-red-50/40 text-red-700"
                                                : "bg-slate-50/30 text-slate-400"
                                        }`}>{fmt(total)}</td>
                                        {/* Condición */}
                                        <td className="px-2 py-2.5 text-center">
                                            <CondicionBadge value={cond} />
                                        </td>
                                        <td className="px-2 py-2.5 text-center">
                                            <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                                onClick={() => openManualEditor(r)} title="Editar notas">
                                                <Edit size={13} />
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredRows.length === 0 && (
                                <tr><td colSpan={14} className="py-14 text-center">
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="h-12 w-12 rounded-2xl bg-slate-100 grid place-items-center">
                                            <FileSpreadsheet size={22} className="text-slate-300" />
                                        </div>
                                        <p className="text-sm text-slate-400 font-medium">
                                            {rows.length === 0
                                                ? "Selecciona convocatoria y carrera para ver postulantes"
                                                : "No se encontraron resultados para el DNI buscado"}
                                        </p>
                                    </div>
                                </td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {filteredRows.length > 0 && (
                    <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/40 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-slate-500 font-semibold">{filteredRows.length} postulante{filteredRows.length !== 1 ? "s" : ""}</p>
                        <p className="text-[10px] text-slate-400">
                            CLM = Com. Lengua Materna · RP = Resoluc. Problemas · Conv = Convivencia · PC = Pensam. Crítico · TC = Trabajo Colaborativo
                        </p>
                    </div>
                )}
            </div>

            {/* ════ MANUAL EDIT DIALOG ════ */}
            <Dialog open={openManual} onOpenChange={setOpenManual}>
                <DialogContent className="max-w-2xl rounded-2xl p-0 border-0 shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-[#0f1a3a] via-[#171a55] to-[#251c6c] px-6 py-5 text-white">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-white/10 border border-white/20 grid place-items-center shrink-0">
                                <Edit size={18} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-300 mb-0.5">Editar Notas</p>
                                <p className="font-extrabold text-white leading-tight truncate">{manualRow?.applicant_name}</p>
                                <p className="text-blue-300 text-xs mt-0.5">
                                    DNI: {manualRow?.applicant_dni} · {manualRow?.career_name || "—"}
                                </p>
                            </div>
                        </div>
                    </div>

                    {manualRow && (() => {
                        const rb = scores[manualRow.id] || {};
                        const subF1 = calcFase1(rb);
                        const subF2 = calcFase2(rb);
                        const totalM = subF1 + subF2;
                        const f1Pass = subF1 >= 30;
                        const totalPass = totalM >= 60;
                        const hasScores = totalM > 0;
                        return (
                        <div className="bg-white p-6 space-y-5">

                            {/* Fase 1 */}
                            <div>
                                <SectionHead color="blue" icon={FileSpreadsheet} label="Fase 1 — Prueba Escrita" sub="Puntaje máximo: 50 pts" />
                                <div className="grid grid-cols-3 gap-3">
                                    {FASE1_FIELDS.map(({ key, label, max }) => {
                                        const val = toNum(rb[key]);
                                        const over = val > max;
                                        return (
                                        <div key={key}>
                                            <FieldLabel>{label} ({max})</FieldLabel>
                                            <Input type="number" step="0.1" min="0" max={max}
                                                className={`h-9 rounded-xl font-mono text-center transition-colors ${over ? "border-red-400 bg-red-50 text-red-700 focus:ring-red-400" : "focus:ring-blue-400"}`}
                                                value={rb[key] ?? 0}
                                                onChange={e => setRubricField(manualRow.id, key, toNum(e.target.value))} />
                                            {over && <p className="text-[9px] text-red-500 mt-0.5 font-medium">Máximo: {max}</p>}
                                        </div>
                                    )})}
                                </div>
                                <div className="mt-3 flex items-center justify-between">
                                    {subF1 > 0 && (
                                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${f1Pass
                                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                            : "bg-red-50 text-red-700 border-red-200"}`}>
                                            {f1Pass ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                                            {f1Pass ? "APTO" : "NO APTO"}
                                        </span>
                                    )}
                                    <span className={`text-xs font-extrabold px-3 py-1.5 rounded-xl tabular-nums border ${
                                        subF1 > 0
                                            ? f1Pass
                                                ? "text-emerald-800 bg-emerald-50 border-emerald-200"
                                                : "text-red-800 bg-red-50 border-red-200"
                                            : "text-blue-800 bg-blue-50 border-blue-200"
                                    }`}>
                                        Subtotal Fase 1: {subF1.toFixed(1)} / 50
                                    </span>
                                </div>
                            </div>

                            {/* Fase 2 */}
                            <div>
                                <SectionHead color="indigo" icon={FileSpreadsheet} label="Fase 2 — Entrevista / Desempeño" sub="Puntaje máximo: 50 pts" />
                                <div className="grid grid-cols-3 gap-3">
                                    {FASE2_FIELDS.map(({ key, label, max }) => {
                                        const val = toNum(rb[key]);
                                        const over = val > max;
                                        return (
                                        <div key={key}>
                                            <FieldLabel>{label} ({max})</FieldLabel>
                                            <Input type="number" step="0.1" min="0" max={max}
                                                className={`h-9 rounded-xl font-mono text-center transition-colors ${over ? "border-red-400 bg-red-50 text-red-700 focus:ring-red-400" : "focus:ring-indigo-400"}`}
                                                value={rb[key] ?? 0}
                                                onChange={e => setRubricField(manualRow.id, key, toNum(e.target.value))} />
                                            {over && <p className="text-[9px] text-red-500 mt-0.5 font-medium">Máximo: {max}</p>}
                                        </div>
                                    )})}
                                </div>
                                <div className="mt-3 flex justify-end">
                                    <span className={`text-xs font-extrabold px-3 py-1.5 rounded-xl tabular-nums border ${
                                        subF2 > 0
                                            ? subF2 >= 30
                                                ? "text-emerald-800 bg-emerald-50 border-emerald-200"
                                                : "text-red-800 bg-red-50 border-red-200"
                                            : "text-indigo-800 bg-indigo-50 border-indigo-200"
                                    }`}>
                                        Subtotal Fase 2: {subF2.toFixed(1)} / 50
                                    </span>
                                </div>
                            </div>

                            {/* Barra de progreso visual */}
                            {hasScores && (
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                        <span>Progreso</span>
                                        <span className={totalPass ? "text-emerald-600" : "text-red-500"}>{totalM.toFixed(1)}%</span>
                                    </div>
                                    <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                                        <div className={`h-full rounded-full transition-all duration-500 ${totalPass ? "bg-gradient-to-r from-emerald-400 to-emerald-500" : "bg-gradient-to-r from-red-400 to-red-500"}`}
                                            style={{ width: `${Math.min(totalM, 100)}%` }} />
                                    </div>
                                    {totalM >= 60 && <div className="h-0 relative"><div className="absolute left-[60%] -top-2.5 w-px h-2.5 bg-slate-300" title="Mínimo aprobatorio (60)" /></div>}
                                </div>
                            )}

                            {/* Total + condición */}
                            <div className={`rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3 transition-colors ${
                                !hasScores
                                    ? "border-slate-200 bg-slate-50/40"
                                    : totalPass
                                        ? "border-emerald-200 bg-emerald-50/40"
                                        : "border-red-200 bg-red-50/40"
                            }`}>
                                <div>
                                    <p className={`text-[10px] font-bold uppercase tracking-widest mb-0.5 ${!hasScores ? "text-slate-400" : totalPass ? "text-emerald-600" : "text-red-500"}`}>Total</p>
                                    <p className={`text-2xl font-black tabular-nums ${!hasScores ? "text-slate-400" : totalPass ? "text-emerald-800" : "text-red-700"}`}>
                                        {totalM.toFixed(1)} <span className={`text-sm font-semibold ${!hasScores ? "text-slate-400" : totalPass ? "text-emerald-600" : "text-red-500"}`}>/ 100</span>
                                    </p>
                                    {hasScores && (
                                        <p className={`text-[10px] font-bold mt-1 ${totalPass ? "text-emerald-600" : "text-red-500"}`}>
                                            {totalPass ? "✓ Aprobado" : "✗ Desaprobado (mín. 60)"}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <FieldLabel>Condición</FieldLabel>
                                    <Select
                                        value={scores[manualRow.id]?.condicion || "__none__"}
                                        onValueChange={v => setRubricField(manualRow.id, "condicion", v === "__none__" ? "" : v)}>
                                        <SelectTrigger className="h-9 w-52 rounded-xl text-xs">
                                            <SelectValue placeholder="(sin asignar)" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__none__">(sin asignar)</SelectItem>
                                            <SelectItem value="INGRESA">✅ INGRESA</SelectItem>
                                            <SelectItem value="NO INGRESA">❌ NO INGRESA</SelectItem>
                                            <SelectItem value="ALCANZA VACANTE">✅ ALCANZA VACANTE</SelectItem>
                                            <SelectItem value="NO ALCANZA VACANTE">❌ NO ALCANZA VACANTE</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                                <Button variant="outline" className="rounded-xl font-semibold"
                                    onClick={() => setOpenManual(false)}>Cerrar</Button>
                                <Button className="rounded-xl font-extrabold gap-2 bg-blue-600 hover:bg-blue-700"
                                    onClick={saveManual}>
                                    <Save size={15} /> Guardar
                                </Button>
                            </div>
                        </div>
                    );})()}
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}