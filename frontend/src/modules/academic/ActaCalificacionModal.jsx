/* ═══════════════════════════════════════════════════════════════
   ActaCalificacionModal — Acta de Calificación del curso/módulo
   (RVM 123-2022-MINEDU, Anexo 5)

   Grilla oficial editable por web, para ADMIN y DOCENTE:
   - 3 competencias con niveles PI/I/P/L/D (un solo casillero por
     competencia; al marcarlo se muestra su puntuación 1-5 con color)
   - Recomendación/comentario por competencia
   - Automático: C1-C3, Calificación para el sistema (1 decimal,
     redondeo 0.05 a favor), PROMEDIO FINAL (tabla oficial pág. 28)
     y CALIFICACIÓN CUALITATIVA
   - Botón ACTA DE EVALUACIÓN → descarga el acta de área oficial
   ═══════════════════════════════════════════════════════════════ */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Save, X, FileSpreadsheet, Lock } from "lucide-react";
import { Grades, SectionStudents } from "@/services/academic.service";
import api from "@/lib/api";
import GradesWindowBanner from "./GradesWindowBanner";

/* Leyenda oficial (RVM 123-2022, pág. 27): nivel → rango de resultado */
export const NIVELES = [
    { code: "PI", val: 1, min: 1.0, max: 1.9, rango: "1 – 1.9", label: "Previo al Inicio", color: "#B91C1C", bg: "#FEE2E2" },
    { code: "I",  val: 2, min: 2.0, max: 2.9, rango: "2 – 2.9", label: "Inicio",           color: "#1D4ED8", bg: "#DBEAFE" },
    { code: "P",  val: 3, min: 3.0, max: 3.9, rango: "3 – 3.9", label: "En proceso",       color: "#15803D", bg: "#DCFCE7" },
    { code: "L",  val: 4, min: 4.0, max: 4.9, rango: "4 – 4.9", label: "Logrado",          color: "#A16207", bg: "#FEF9C3" },
    { code: "D",  val: 5, min: 5.0, max: 5.0, rango: "5",       label: "Destacado",        color: "#111827", bg: "#E5E7EB" },
];
const NIVEL_VAL = Object.fromEntries(NIVELES.map((n) => [n.code, n.val]));
export const NIVEL_POR_CODE = Object.fromEntries(NIVELES.map((n) => [n.code, n]));

/** Nivel que corresponde a un valor decimal 1.0–5.0 */
export function nivelDeValor(v) {
    const f = parseFloat(v);
    if (!Number.isFinite(f)) return "";
    return NIVELES.find((n) => f >= n.min - 1e-9 && f <= n.max + 1e-9)?.code || "";
}

/** ¿El valor está dentro del rango del nivel marcado? */
export function valorEnRango(v, code) {
    const n = NIVEL_POR_CODE[code];
    const f = parseFloat(v);
    if (!n || !Number.isFinite(f)) return false;
    return f >= n.min - 1e-9 && f <= n.max + 1e-9;
}

/* Escala con 1 decimal, redondeo 0.05 a favor del estudiante.
   Promedia SOLO las competencias registradas (un curso puede tener 1, 2 o 3). */
export function escalaDe(...vals) {
    const nums = vals
        .map((v) => parseFloat(v))
        .filter((f) => Number.isFinite(f) && f >= 1 && f <= 5);
    if (!nums.length) return null;
    const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
    return Math.floor(avg * 10 + 0.5) / 10;
}

/* Tabla oficial RVM 123-2022 pág. 28: escala → vigesimal */
const TABLA_VIGESIMAL = [
    [1.0, 1], [1.2, 2], [1.4, 3], [1.6, 4], [1.8, 5],
    [2.0, 6], [2.2, 7], [2.4, 8], [2.6, 9], [2.8, 10],
    [3.0, 11], [3.3, 12], [3.6, 13], [3.8, 14],
    [4.0, 15], [4.2, 16], [4.4, 17], [4.6, 18], [4.8, 19],
    [5.0, 20],
];
export function vigesimalDe(escala) {
    if (escala == null) return null;
    let out = 1;
    for (const [lo, v] of TABLA_VIGESIMAL) {
        if (escala + 1e-9 >= lo) out = v; else break;
    }
    return out;
}
export function califCursoDe(escala) {
    if (escala == null) return "";
    const e = escala + 1e-9;
    if (e >= 5) return "Destacado";
    if (e >= 4) return "Logrado";
    if (e >= 3) return "En proceso";
    if (e >= 2) return "Inicio";
    return "Previo al Inicio";
}
/* Condición del estudiante (RVM 123-2022, 5.2.1.4 d): aprobado con
   "En proceso", "Logrado" o "Destacado"; desaprobado con "Previo al
   inicio" o "Inicio". La determina el SIA, no el docente. */
export function condicionDe(escala) {
    if (escala == null) return "";
    return escala + 1e-9 >= 3 ? "Aprobado" : "Desaprobado";
}
function nivelInfoDeCalif(calif) {
    return NIVELES.find((n) => n.label.toLowerCase() === String(calif).toLowerCase());
}

/* Estados académicos especiales del alumno (definidos en Matrícula, con RD) */
const ESTADOS_ALUMNO = {
    LICENCIA:        { label: "LICENCIA",        cls: "bg-rose-100 text-rose-700 border-rose-300" },
    REINCORPORACION: { label: "REINCORPORACIÓN", cls: "bg-blue-100 text-blue-700 border-blue-300" },
    TRASLADO:        { label: "TRASLADO",        cls: "bg-violet-100 text-violet-700 border-violet-300" },
    SUBSANACION:     { label: "SUBSANACIÓN",     cls: "bg-orange-100 text-orange-700 border-orange-300" },
};
function estadoTexto(st) {
    const e = ESTADOS_ALUMNO[st?.estado_academico];
    if (!e) return "";
    return e.label + (st.estado_rd ? ` (RD ${st.estado_rd})` : "");
}

export default function ActaCalificacionModal({ open, onClose, section, onSaved }) {
    const [students, setStudents] = useState([]);
    const [entries, setEntries] = useState({});
    const [original, setOriginal] = useState({});
    const [submitted, setSubmitted] = useState(false);
    const [sinSeccion, setSinSeccion] = useState([]);   // matriculados sin sección asignada
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [downloading, setDownloading] = useState("");
    const [win, setWin] = useState(null);
    const bloqueado = !!win && win.can_edit === false;

    const load = useCallback(async () => {
        if (!section?.id) return;
        setLoading(true);
        try {
            const [stRes, grRes] = await Promise.all([
                SectionStudents.list(section.id),
                Grades.get(section.id),
            ]);
            const sts = (stRes?.students || []).slice().sort((a, b) =>
                `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`));
            setStudents(sts);
            setSinSeccion(stRes?.unassigned || []);
            const g = grRes?.grades || {};
            const init = {};
            for (const st of sts) {
                const e = g[String(st.id)] || g[String(st.student_id)] || {};
                // El resultado decimal guardado (C1/C2/C3) se recarga como texto
                // para que el docente vea el 2.4 que escribió, no el mínimo del nivel
                const num = (v) => (v === 0 || v ? String(v) : "");
                init[String(st.id)] = {
                    C1: num(e.C1), C1_LEVEL: e.C1_LEVEL || "", C1_REC: e.C1_REC || "",
                    C2: num(e.C2), C2_LEVEL: e.C2_LEVEL || "", C2_REC: e.C2_REC || "",
                    C3: num(e.C3), C3_LEVEL: e.C3_LEVEL || "", C3_REC: e.C3_REC || "",
                    _dpi: (e.status || "").toUpperCase() === "DPI",
                };
            }
            setEntries(init);
            setOriginal(JSON.parse(JSON.stringify(init)));
            setSubmitted(!!grRes?.submitted);
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Error cargando el acta");
        } finally {
            setLoading(false);
        }
    }, [section?.id]);

    useEffect(() => { if (open) load(); }, [open, load]);

    /* Al abrir el acta se colapsa el menú lateral para ver los nombres
       completos; al cerrar se restaura como estaba. */
    useEffect(() => {
        if (!open) return;
        window.dispatchEvent(new Event("ui:collapse-nav"));
        return () => window.dispatchEvent(new Event("ui:restore-nav"));
    }, [open]);

    const dirtyCount = useMemo(() => {
        let n = 0;
        for (const k of Object.keys(entries)) {
            if (JSON.stringify(entries[k]) !== JSON.stringify(original[k])) n += 1;
        }
        return n;
    }, [entries, original]);

    /** El docente escribe el resultado con decimales DENTRO de la columna del
        nivel que quiere asignar (p. ej. 2.4 en la columna I). El valor vive en
        una sola columna: escribir en otra lo mueve allí. */
    const setValorNivel = (key, comp, code, raw) => {
        if (bloqueado) {
            toast.error(win?.message || "El registro de calificaciones está cerrado");
            return;
        }
        const txt = String(raw).replace(",", ".").trimStart();
        setEntries((prev) => {
            const e = { ...prev[key] };
            const valKey = `C${comp}`, lvKey = `C${comp}_LEVEL`;
            if (txt === "") { e[valKey] = ""; e[lvKey] = ""; }
            else { e[valKey] = txt; e[lvKey] = code; }
            return { ...prev, [key]: e };
        });
    };

    /** Al salir de la celda el SISTEMA ubica el resultado en el nivel que le
        corresponde según la tabla de rangos (RVM 123-2022, Anexo 5): si se
        escribió 2.2 en la columna PI, se mueve solo a la columna I. */
    const normalizarNivel = (key, comp, code, nombre) => {
        const e = entries[key] || {};
        const raw = e[`C${comp}`];
        if (raw === "" || raw == null || e[`C${comp}_LEVEL`] !== code) return;

        const f = parseFloat(raw);
        if (!Number.isFinite(f) || f < 1 || f > 5) {
            toast.error(
                `${nombre} · Competencia ${comp}: "${raw}" no es válido. ` +
                "El resultado debe ser un número entre 1.0 y 5.0.",
                { duration: 7000 });
            return;
        }
        const destino = nivelDeValor(f);
        if (!destino || destino === code) return;

        setEntries((prev) => ({
            ...prev, [key]: { ...prev[key], [`C${comp}_LEVEL`]: destino },
        }));
        const n = NIVEL_POR_CODE[destino];
        toast.info(
            `${nombre} · Competencia ${comp}: ${f} corresponde a ${n.label} ` +
            `(${n.rango}) — se registró en esa columna.`,
            { duration: 6000 });
    };

    const setRec = (key, comp, text) => {
        setEntries((prev) => ({ ...prev, [key]: { ...prev[key], [`C${comp}_REC`]: text } }));
    };

    const guardar = async () => {
        const payload = {};
        const incompletos = [];
        const fueraRango = [];
        for (const st of students) {
            if (st.estado_academico === "LICENCIA") continue;   // bloqueado, no se califica
            const k = String(st.id);
            const e = entries[k] || {};
            const nombre = `${st.last_name} ${st.first_name}`;

            // El resultado debe ser un número 1.0–5.0; el nivel lo determina
            // el sistema a partir del rango (RVM 123-2022, Anexo 5)
            let malo = false;
            for (const i of [1, 2, 3]) {
                const v = e[`C${i}`];
                if (v === "" || v == null) continue;
                const f = parseFloat(v);
                if (!Number.isFinite(f) || f < 1 || f > 5) {
                    fueraRango.push(`${nombre} · Comp. ${i}: "${v}"`);
                    malo = true;
                }
            }
            if (malo) continue;

            // Se guardan las competencias registradas (1, 2 o 3 — p. ej. Inglés)
            const datos = {};
            let n = 0;
            for (const i of [1, 2, 3]) {
                const v = e[`C${i}`];
                const f = parseFloat(v);
                if (v !== "" && v != null && Number.isFinite(f)) {
                    datos[`C${i}`] = Math.round(f * 10) / 10;
                    datos[`C${i}_LEVEL`] = nivelDeValor(f);
                    n += 1;
                }
                datos[`C${i}_REC`] = e[`C${i}_REC`] || "";
            }
            if (n > 0) {
                payload[k] = datos;
            } else if ([e.C1_REC, e.C2_REC, e.C3_REC].some(Boolean)) {
                incompletos.push(nombre);
            }
        }
        if (fueraRango.length) {
            toast.error(
                `Hay ${fueraRango.length} resultado(s) inválido(s) — deben ser números entre 1.0 y 5.0: ${fueraRango[0]}` +
                (fueraRango.length > 1 ? ` y ${fueraRango.length - 1} más.` : ""),
                { duration: 8000 });
            return;
        }
        if (!Object.keys(payload).length) {
            toast.error("No hay competencias registradas para guardar.");
            return;
        }
        setSaving(true);
        try {
            const res = await Grades.save(section.id, payload);
            let msg = res?.message || "Acta guardada";
            if (incompletos.length) {
                msg += ` · ${incompletos.length} alumno(s) solo con comentario (sin nota) no se guardaron`;
            }
            toast.success(msg);
            await load();
            onSaved?.();
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Error al guardar el acta");
        } finally {
            setSaving(false);
        }
    };

    const descargarActa = async (fmt = "pdf") => {
        setDownloading(fmt);
        try {
            const res = await api.get(`/academic/sections/${section.id}/acta-area.${fmt}`,
                { responseType: "blob" });
            const cd = res?.headers?.["content-disposition"] || "";
            const m = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(cd);
            const filename = m?.[1]?.replace(/['"]/g, "").trim() || `acta-area-${section.id}.${fmt}`;
            const blob = res?.data instanceof Blob ? res.data : new Blob([res.data]);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a"); a.href = url; a.download = filename;
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => window.URL.revokeObjectURL(url), 60000);
            toast.success("Acta de Evaluación de Área descargada");
        } catch (e) {
            let msg = "Error al descargar el acta";
            try {
                if (e?.response?.data instanceof Blob) {
                    msg = JSON.parse(await e.response.data.text())?.detail || msg;
                }
            } catch { /* ignore */ }
            toast.error(msg);
        } finally {
            setDownloading("");
        }
    };

    const ciclo = section?.semester ? ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"][section.semester] || section.semester : "";

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) onClose?.(); }}>
            <DialogContent className="max-w-[98vw] w-[1500px] max-h-[94vh] flex flex-col p-4">
                <DialogHeader className="pb-1">
                    <DialogTitle className="text-base font-extrabold flex flex-wrap items-center justify-center gap-2 text-center">
                        ACTA DE CALIFICACIÓN DEL CURSO O MÓDULO
                        {submitted && (
                            <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300 gap-1">
                                <Lock className="h-3 w-3" /> ACTA CERRADA
                            </Badge>
                        )}
                    </DialogTitle>
                    <div className="text-xs text-slate-500 flex flex-wrap gap-x-4">
                        <span><b>Curso:</b> {section?.course_name}</span>
                        <span><b>Docente:</b> {section?.teacher_name || "—"}</span>
                        <span><b>Ciclo - Sección:</b> {ciclo} - "{section?.label || "A"}"</span>
                        <span><b>Período:</b> {section?.period}</span>
                    </div>
                    {/* Estado del registro de calificaciones */}
                    <div className="pt-1">
                        <GradesWindowBanner sectionId={section?.id} onState={setWin} />
                    </div>
                    {/* Matriculados que el acta no puede ubicar: antes desaparecían
                        sin aviso y el acta se veía completa */}
                    {sinSeccion.length > 0 && (
                        <div className="mt-1 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                            <b>Atención:</b> {sinSeccion.length} estudiante(s) están matriculados en
                            este curso pero <b>sin sección asignada</b>, por lo que no aparecen en
                            esta acta:{" "}
                            {sinSeccion.map((s) => `${s.nombre} (${s.num_documento})`).join(" · ")}.
                            Secretaría Académica debe asignarles la sección en Matrícula.
                        </div>
                    )}
                    {/* Leyenda oficial con RANGOS (RVM 123-2022, pág. 27) */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="text-[11px] font-bold text-slate-500 uppercase">Leyenda:</span>
                        {NIVELES.map((n) => (
                            <span key={n.code}
                                className="text-[11px] font-semibold px-2 py-0.5 rounded border"
                                style={{ color: n.color, background: n.bg, borderColor: n.color }}>
                                {n.code} · {n.label} = <b>{n.rango}</b>
                            </span>
                        ))}
                        <span className="text-[10px] text-slate-400">
                            Escribe solo el resultado con decimales (ej. 2.4): el sistema lo ubica
                            en su nivel y determina automáticamente el resultado obtenido, la
                            calificación vigesimal y la calificación cualitativa
                            (RVM 123-2022, Anexo 5).
                        </span>
                    </div>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
                        <Loader2 className="h-5 w-5 animate-spin" /> Cargando acta…
                    </div>
                ) : (
                    <div className="overflow-auto border border-slate-200 rounded-lg flex-1 min-h-0 min-w-0 w-full">
                        {/* El `min-w-0 w-full` del contenedor es lo que mantiene el acta
                            dentro del modal: sin eso, el `min-w-max` de esta tabla lo
                            estiraba (un flex item no encoge por debajo de su contenido),
                            el modal superaba su max-w y, al estar centrado con
                            translate-x:-50%, el excedente se salía por AMBOS lados — el
                            título, la leyenda y la columna N° quedaban cortados fuera de
                            la pantalla, sin manera de llegar a ellos. */}
                        {/* Grilla de trazo fino: 1px hairline en gris claro (las líneas
                            gruesas/oscuras hacían ilegible el acta en pantalla) */}
                        <table className="text-[11px] border-collapse min-w-max
                                          [&_th]:border-slate-200 [&_td]:border-slate-100
                                          [&_thead_th]:border-slate-200">
                            <thead className="sticky top-0 z-10">
                                <tr className="bg-slate-100 text-slate-600">
                                    <th rowSpan={2} className="border px-1 py-1 sticky left-0 bg-slate-100 z-30 w-9 min-w-9">N°</th>
                                    <th rowSpan={2} className="border px-1 py-1 sticky left-[36px] bg-slate-100 z-30 w-[78px] min-w-[78px]">N° de<br />Matrícula</th>
                                    <th rowSpan={2} className="border px-2 py-1 text-left sticky left-[114px] bg-slate-100 z-30 min-w-[170px] max-w-[210px] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]">
                                        Apellidos y Nombres del Estudiante
                                    </th>
                                    {[1, 2, 3].map((i) => (
                                        <React.Fragment key={i}>
                                            <th colSpan={5} className="border px-1 py-1">
                                                COMPETENCIA {i}<br />
                                                <span className="font-normal">Nivel de Desempeño</span>
                                            </th>
                                            <th rowSpan={2} className="border px-1 py-1 min-w-[130px]">
                                                Recomendación<br />Comentario*
                                            </th>
                                        </React.Fragment>
                                    ))}
                                    <th colSpan={3} className="border px-1 py-1">CONCLUSIÓN<br />DESCRIPTIVA</th>
                                    <th rowSpan={2} className="border px-1 py-1 w-14 bg-yellow-50">RESULTADO<br />OBTENIDO<br />(1-5)</th>
                                    <th rowSpan={2} className="border px-1 py-1 w-16 bg-yellow-50">CALIF.<br />VIGESIMAL</th>
                                    <th rowSpan={2} className="border px-1 py-1 min-w-[95px] bg-yellow-50">CALIFICACIÓN<br />CUALITATIVA</th>
                                </tr>
                                <tr className="bg-slate-100 text-slate-600">
                                    {[1, 2, 3].map((i) => (
                                        <React.Fragment key={i}>
                                            {/* Solo el código del nivel: los rangos ya están en
                                                la leyenda de arriba y recargaban el encabezado */}
                                            {NIVELES.map((n) => (
                                                <th key={`${i}${n.code}`} className="border px-1 py-0.5 w-12"
                                                    style={{ color: n.color }} title={`${n.label}: ${n.rango}`}>
                                                    {n.code}
                                                </th>
                                            ))}
                                        </React.Fragment>
                                    ))}
                                    {["C1", "C2", "C3"].map((c) => (
                                        <th key={c} className="border px-1 py-0.5 w-10">{c}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {students.map((st, idx) => {
                                    const k = String(st.id);
                                    const e = entries[k] || {};
                                    const lic = st.estado_academico === "LICENCIA";
                                    const estTxt = estadoTexto(st);
                                    const nombreCorto = `${(st.last_name || "").toUpperCase()} ${(st.first_name || "").toUpperCase()}`.trim();
                                    const estInfo = ESTADOS_ALUMNO[st.estado_academico];
                                    // Valores decimales que escribe el docente (o el mínimo del nivel)
                                    const val = (i) => {
                                        const raw = e[`C${i}`];
                                        if (raw === "" || raw == null) {
                                            const lv = e[`C${i}_LEVEL`];
                                            return lv ? NIVEL_POR_CODE[lv]?.min ?? null : null;
                                        }
                                        const f = parseFloat(raw);
                                        return Number.isFinite(f) ? f : null;
                                    };
                                    const c1 = val(1), c2 = val(2), c3 = val(3);
                                    const esc = escalaDe(c1, c2, c3);
                                    const vig = e._dpi ? 0 : vigesimalDe(esc);
                                    const calif = e._dpi ? "DPI" : califCursoDe(esc);
                                    const cInfo = nivelInfoDeCalif(calif);
                                    return (
                                        <tr key={k} className={lic ? "bg-rose-50/60" : "hover:bg-blue-50/40"}>
                                            <td className={`border px-1 text-center sticky left-0 z-20 w-9 min-w-9 ${lic ? "bg-rose-50" : "bg-white"}`}>{idx + 1}</td>
                                            <td className={`border px-1 text-center sticky left-[36px] z-20 w-[78px] min-w-[78px] ${lic ? "bg-rose-50" : "bg-white"}`}>{st.num_documento}</td>
                                            <td className={`border px-2 sticky left-[114px] z-20 min-w-[170px] max-w-[210px] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)] ${lic ? "bg-rose-50" : "bg-white"}`}>
                                                <span className="block truncate"
                                                    title={`${(st.last_name || "").toUpperCase()} ${(st.first_name || "").toUpperCase()}`}>
                                                    {(st.last_name || "").toUpperCase()} {(st.first_name || "").toUpperCase()}
                                                </span>
                                                {estInfo && (
                                                    <span className={`inline-block text-[9px] font-bold px-1 py-0.5 rounded border ${estInfo.cls}`}
                                                        title={st.estado_rd ? `RD: ${st.estado_rd}` : ""}>
                                                        {estInfo.label}
                                                    </span>
                                                )}
                                            </td>
                                            {[1, 2, 3].map((i) => {
                                                const sel = e[`C${i}_LEVEL`];
                                                const raw = e[`C${i}`] ?? "";
                                                const f = parseFloat(raw);
                                                // Solo es error un número inválido: si cae en otro
                                                // nivel, el sistema lo reubica al salir de la celda
                                                const errorCelda = raw !== "" &&
                                                    (!Number.isFinite(f) || f < 1 || f > 5);
                                                return (
                                                    <React.Fragment key={i}>
                                                        {/* Un campo numérico por nivel: el docente escribe el
                                                            resultado con decimales en la columna del nivel */}
                                                        {NIVELES.map((n) => {
                                                            const active = !lic && sel === n.code;
                                                            const malo = active && errorCelda;
                                                            return (
                                                                <td key={n.code}
                                                                    className="border p-0 text-center"
                                                                    style={malo
                                                                        // el error se marca con recuadro rojo: el fondo
                                                                        // rosado ya es el color propio del nivel PI
                                                                        ? { background: "#FEE2E2", boxShadow: "inset 0 0 0 2px #DC2626" }
                                                                        : active ? { background: n.bg } : undefined}>
                                                                    <input
                                                                        type="text"
                                                                        inputMode="decimal"
                                                                        disabled={lic || bloqueado}
                                                                        value={active ? raw : ""}
                                                                        onChange={(ev) => setValorNivel(k, i, n.code, ev.target.value)}
                                                                        onBlur={() => normalizarNivel(k, i, n.code, nombreCorto)}
                                                                        title={lic ? estTxt
                                                                            : `${n.label}: escribe el resultado entre ${n.rango}`}
                                                                        className="w-12 h-7 px-0.5 text-[11px] font-black text-center outline-none bg-transparent disabled:cursor-not-allowed"
                                                                        style={{ color: malo ? "#B91C1C" : active ? n.color : "#334155" }}
                                                                    />
                                                                </td>
                                                            );
                                                        })}
                                                        <td className="border p-0">
                                                            {lic ? (
                                                                <span className="block px-1 text-[10px] font-bold text-rose-700 whitespace-nowrap"
                                                                    title={st.estado_rd ? `RD: ${st.estado_rd}` : ""}>
                                                                    {estTxt}
                                                                </span>
                                                            ) : (
                                                                <input
                                                                    className="w-full h-7 px-1 text-[11px] outline-none bg-transparent"
                                                                    value={e[`C${i}_REC`] || ""}
                                                                    onChange={(ev) => setRec(k, i, ev.target.value)}
                                                                    placeholder={i === 1 && estTxt ? estTxt : ""}
                                                                />
                                                            )}
                                                        </td>
                                                    </React.Fragment>
                                                );
                                            })}
                                            <td className="border px-1 text-center font-semibold">{lic ? "" : (c1 ?? "")}</td>
                                            <td className="border px-1 text-center font-semibold">{lic ? "" : (c2 ?? "")}</td>
                                            <td className="border px-1 text-center font-semibold">{lic ? "" : (c3 ?? "")}</td>
                                            <td className="border px-1 text-center font-bold bg-yellow-50">
                                                {lic ? "—" : e._dpi ? "—" : (esc ?? "")}
                                            </td>
                                            <td className="border px-1 text-center font-extrabold bg-yellow-50">
                                                {lic ? "—" : e._dpi ? 0 : (vig ?? "")}
                                            </td>
                                            <td className="border px-1 text-center bg-yellow-50">
                                                {lic ? (
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">
                                                        LICENCIA
                                                    </span>
                                                ) : calif && (
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                                                        style={e._dpi
                                                            ? { background: "#EDE9FE", color: "#6D28D9" }
                                                            : cInfo ? { background: cInfo.bg, color: cInfo.color } : {}}>
                                                        {calif}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {!students.length && (
                                    <tr>
                                        <td colSpan={27} className="border p-6 text-center text-slate-400">
                                            Sin alumnos matriculados en esta sección
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Botonera (como el modelo: ACTA DE EVALUACIÓN | Cerrar | Guardar) */}
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    <Button
                        onClick={() => descargarActa("pdf")}
                        disabled={!!downloading || loading}
                        className="gap-2 bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-extrabold"
                    >
                        {downloading === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                        ACTA DE EVALUACIÓN (PDF)
                    </Button>
                    <Button
                        onClick={() => descargarActa("xlsx")}
                        disabled={!!downloading || loading}
                        variant="outline"
                        className="gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 font-bold"
                    >
                        {downloading === "xlsx" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                        Excel
                    </Button>
                    <Button variant="outline" onClick={onClose} className="gap-2">
                        <X className="h-4 w-4" /> Cerrar
                    </Button>
                    <Button
                        onClick={guardar}
                        disabled={saving || loading || dirtyCount === 0 || bloqueado}
                        title={bloqueado ? (win?.message || "Registro cerrado") : ""}
                        className="gap-2"
                    >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Guardar cambios{dirtyCount ? ` (${dirtyCount})` : ""}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
