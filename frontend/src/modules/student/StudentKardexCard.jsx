import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { FileText, RefreshCw, Layers, Download } from "lucide-react";

import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";

import { Kardex } from "@/services/academic.service";

const fade = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.25 },
};

const pickArray = (data, keys) => {
    for (const k of keys) if (Array.isArray(data?.[k])) return data[k];
    return [];
};

const parsePeriod = (p) => {
    const s = String(p || "").trim();
    const m = s.match(/^(\d{4})\s*[-/]\s*([IVX]+|[12])$/i);
    if (!m) return { y: 0, t: 0, raw: s };
    const y = parseInt(m[1], 10);
    const term = String(m[2] || "").toUpperCase();
    const t =
        term === "I" || term === "1" ? 1 :
            term === "II" || term === "2" ? 2 :
                term === "III" ? 3 :
                    term === "IV" ? 4 : 0;
    return { y, t, raw: s };
};

const normStr = (v) => (v == null ? "" : String(v).trim());
const getCycleKey = (it) =>
    normStr(it?.period ?? it?.cycle ?? it?.ciclo ?? it?.term ?? "Sin ciclo");

const getCourseName = (r) =>
    r?.course_name ?? r?.courseName ?? r?.curso ?? r?.subject ?? r?.asignatura ?? "—";

const getCourseCode = (r) =>
    r?.course_code ?? r?.courseCode ?? r?.codigo ?? r?.code ?? "—";

const getCredits = (r) => r?.credits ?? r?.creditos ?? "—";

const getGrade = (r) => {
    const v = r?.grade ?? r?.nota ?? r?.final ?? r?.promedio;
    return v == null || String(v).trim() === "" ? "—" : v;
};

const getStatus = (r) => r?.status ?? r?.estado ?? "—";

const statusBadgeVariant = (status) => {
    const s = String(status || "").toUpperCase();
    if (s.includes("APROB")) return "default";
    if (s.includes("DESAP")) return "destructive";
    if (s.includes("SIN")) return "secondary";
    return "secondary";
};

const downloadBlob = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
};

export default function StudentKardexCard({
    mode,
    studentKey,
    titlePrefix = "Kárdex / Notas",
}) {
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);

    const [kardex, setKardex] = useState(null);
    const [activeCycle, setActiveCycle] = useState("");

    const load = useCallback(async () => {
        try {
            if (!studentKey) {
                setKardex(null);
                setActiveCycle("");
                return;
            }

            setLoading(true);
            const data = await Kardex.ofStudent(studentKey);
            setKardex(data);

            const list = pickArray(data, ["items", "records", "courses", "grades", "details"]) || [];

            const byCycle = new Map();
            for (const it of list) {
                const cycle = getCycleKey(it) || "Sin ciclo";
                if (!byCycle.has(cycle)) byCycle.set(cycle, []);
                byCycle.get(cycle).push(it);
            }

            const cycles = Array.from(byCycle.keys()).sort((a, b) => {
                const A = parsePeriod(a);
                const B = parsePeriod(b);
                if (A.y !== B.y) return A.y - B.y;
                if (A.t !== B.t) return A.t - B.t;
                return a.localeCompare(b, "es", { numeric: true });
            });

            setActiveCycle((prev) => {
                if (prev && cycles.includes(prev)) return prev;
                return cycles[0] || "";
            });
        } catch (e) {
            toast.error(e?.message || "Error al consultar kárdex");
            setKardex(null);
            setActiveCycle("");
        } finally {
            setLoading(false);
        }
    }, [studentKey]);

    useEffect(() => {
        load();
    }, [load]);

    const items = useMemo(() => {
        if (!kardex) return [];
        const list = pickArray(kardex, ["items", "records", "courses", "grades", "details"]) || [];
        return [...list].sort((a, b) => {
            const pa = parsePeriod(getCycleKey(a));
            const pb = parsePeriod(getCycleKey(b));
            if (pa.y !== pb.y) return pa.y - pb.y;
            if (pa.t !== pb.t) return pa.t - pb.t;
            const ca = normStr(getCourseCode(a));
            const cb = normStr(getCourseCode(b));
            return ca.localeCompare(cb, "es", { numeric: true });
        });
    }, [kardex]);

    const cycles = useMemo(() => {
        const s = new Set(items.map((it) => getCycleKey(it) || "Sin ciclo"));
        return Array.from(s).sort((a, b) => {
            const A = parsePeriod(a);
            const B = parsePeriod(b);
            if (A.y !== B.y) return A.y - B.y;
            if (A.t !== B.t) return A.t - B.t;
            return a.localeCompare(b, "es", { numeric: true });
        });
    }, [items]);

    const filtered = useMemo(() => {
        if (!activeCycle) return [];
        return items.filter((it) => getCycleKey(it) === String(activeCycle));
    }, [items, activeCycle]);

    const stats = useMemo(() => {
        const nums = filtered
            .map((r) => Number(r?.grade ?? r?.nota ?? r?.final ?? r?.promedio))
            .filter((n) => Number.isFinite(n));
        const avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;

        const approved = filtered.filter((r) => {
            const st = String(getStatus(r)).toUpperCase();
            const g = Number(r?.grade ?? r?.nota ?? r?.final ?? r?.promedio);
            return st.includes("APROB") || (Number.isFinite(g) && g >= 11);
        }).length;

        return { total: filtered.length, approved, avg };
    }, [filtered]);

    const exportExcel = async ({ onlyCycle }) => {
        if (!studentKey) return;
        try {
            setExporting(true);
            const params = {};
            if (onlyCycle && activeCycle) params.period = activeCycle;

            const res = await Kardex.exportXlsx(studentKey, params);
            const blob = res?.data;

            const filename = `kardex-${studentKey}${onlyCycle && activeCycle ? "-" + activeCycle : ""}.xlsx`;
            downloadBlob(blob, filename);

            toast.success("Excel generado");
        } catch (e) {
            toast.error(e?.message || "No se pudo exportar el Excel");
        } finally {
            setExporting(false);
        }
    };
    const exportPdf = async ({ onlyCycle }) => {
        if (!studentKey) return;
        try {
            setExporting(true);
            const params = {};
            if (onlyCycle && activeCycle) params.period = activeCycle;

            const res = await Kardex.exportPdf(studentKey, params);
            const blob = res?.data;

            const filename = `boleta-${studentKey}${onlyCycle && activeCycle ? "-" + activeCycle : ""}.pdf`;
            downloadBlob(blob, filename);

            toast.success("PDF generado");
        } catch (e) {
            toast.error(e?.message || "No se pudo exportar el PDF");
        } finally {
            setExporting(false);
        }
    };

    return (
        <motion.div {...fade}>
            <Card className="rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] bg-white/70 dark:bg-neutral-900/60 backdrop-blur-md">
                <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <FileText className="h-5 w-5" /> {titlePrefix}
                            </CardTitle>
                            <CardDescription>
                                {mode === "admin"
                                    ? "Notas del estudiante seleccionado + export a plantilla."
                                    : "Tus notas por ciclo + export a plantilla."}
                            </CardDescription>
                        </div>

                        <div className="flex gap-2 flex-wrap justify-end">
                            <Button
                                variant="outline"
                                className="rounded-xl gap-2"
                                onClick={load}
                                disabled={loading || !studentKey}
                            >
                                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                                Recargar
                            </Button>

                            {/* EXCEL */}
                            <Button
                                variant="outline"
                                className="rounded-xl gap-2"
                                onClick={() => exportExcel({ onlyCycle: true })}
                                disabled={exporting || !studentKey || !activeCycle}
                            >
                                <Download className={`h-4 w-4 ${exporting ? "animate-spin" : ""}`} />
                                Excel ciclo
                            </Button>

                            <Button
                                variant="outline"
                                className="rounded-xl gap-2"
                                onClick={() => exportExcel({ onlyCycle: false })}
                                disabled={exporting || !studentKey}
                            >
                                <Download className={`h-4 w-4 ${exporting ? "animate-spin" : ""}`} />
                                Excel todo
                            </Button>

                            {/* PDF */}
                            <Button
                                variant="outline"
                                className="rounded-xl gap-2"
                                onClick={() => exportPdf({ onlyCycle: true })}
                                disabled={exporting || !studentKey || !activeCycle}
                            >
                                <Download className={`h-4 w-4 ${exporting ? "animate-spin" : ""}`} />
                                PDF ciclo
                            </Button>

                            <Button
                                className="rounded-xl gap-2"
                                onClick={() => exportPdf({ onlyCycle: false })}
                                disabled={exporting || !studentKey}
                            >
                                <Download className={`h-4 w-4 ${exporting ? "animate-spin" : ""}`} />
                                PDF todo
                            </Button>
                        </div>

                    </div>
                </CardHeader>

                <CardContent className="space-y-4">
                    {!studentKey ? (
                        <div className="rounded-2xl border p-4 bg-white/60 dark:bg-neutral-900/40">
                            <p className="text-sm text-muted-foreground">
                                {mode === "admin"
                                    ? "Selecciona un estudiante para ver su kárdex."
                                    : "No se encontró tu identificador de estudiante."}
                            </p>
                        </div>
                    ) : !kardex ? (
                        <div className="rounded-2xl border p-4 bg-white/60 dark:bg-neutral-900/40">
                            <p className="text-sm text-muted-foreground">
                                {loading ? "Cargando kárdex…" : "Sin datos de kárdex para mostrar."}
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                                <div className="rounded-2xl border p-3 bg-white/60 dark:bg-neutral-900/40">
                                    <div className="text-xs text-muted-foreground">Estudiante</div>
                                    <div className="text-sm font-semibold truncate">
                                        {kardex.student_name ?? "—"}
                                    </div>
                                </div>
                                <div className="rounded-2xl border p-3 bg-white/60 dark:bg-neutral-900/40">
                                    <div className="text-xs text-muted-foreground">Carrera</div>
                                    <div className="text-sm font-semibold truncate">
                                        {kardex.career_name ?? "—"}
                                    </div>
                                </div>
                                <div className="rounded-2xl border p-3 bg-white/60 dark:bg-neutral-900/40">
                                    <div className="text-xs text-muted-foreground">Créditos aprobados</div>
                                    <div className="text-lg font-semibold">
                                        {kardex.credits_earned ?? "—"}
                                    </div>
                                </div>
                                <div className="rounded-2xl border p-3 bg-white/60 dark:bg-neutral-900/40">
                                    <div className="text-xs text-muted-foreground">PPA</div>
                                    <div className="text-lg font-semibold">{kardex.gpa ?? "—"}</div>
                                </div>
                            </div>

                            {cycles.length > 0 ? (
                                <>
                                    <div className="flex flex-wrap gap-2">
                                        {cycles.map((c) => (
                                            <button
                                                key={c}
                                                type="button"
                                                onClick={() => setActiveCycle(c)}
                                                className={[
                                                    "px-3 py-1.5 rounded-xl border text-sm transition",
                                                    activeCycle === c
                                                        ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-black dark:border-white"
                                                        : "bg-transparent hover:bg-black/5 dark:hover:bg-white/10",
                                                ].join(" ")}
                                            >
                                                <span className="inline-flex items-center gap-2">
                                                    <Layers className="h-4 w-4" /> {c}
                                                </span>
                                            </button>
                                        ))}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div className="rounded-2xl border p-3 bg-white/60 dark:bg-neutral-900/40">
                                            <div className="text-xs text-muted-foreground">Cursos en el ciclo</div>
                                            <div className="text-lg font-semibold">{stats.total}</div>
                                        </div>
                                        <div className="rounded-2xl border p-3 bg-white/60 dark:bg-neutral-900/40">
                                            <div className="text-xs text-muted-foreground">Aprobados</div>
                                            <div className="text-lg font-semibold">{stats.approved}</div>
                                        </div>
                                        <div className="rounded-2xl border p-3 bg-white/60 dark:bg-neutral-900/40">
                                            <div className="text-xs text-muted-foreground">Promedio (referencial)</div>
                                            <div className="text-lg font-semibold">
                                                {stats.avg == null ? "—" : stats.avg.toFixed(2)}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto rounded-2xl border max-h-[520px] overflow-y-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50 dark:bg-white/5 border-b sticky top-0">
                                                <tr>
                                                    <th className="p-2 text-left">Curso</th>
                                                    <th className="p-2 text-left">Código</th>
                                                    <th className="p-2 text-left">Créditos</th>
                                                    <th className="p-2 text-left">Nota</th>
                                                    <th className="p-2 text-left">Estado</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {filtered.map((r, idx) => {
                                                    const status = getStatus(r);
                                                    return (
                                                        <tr key={r.id || r._id || `${getCycleKey(r)}-${getCourseCode(r)}-${idx}`}>
                                                            <td className="p-2">{getCourseName(r)}</td>
                                                            <td className="p-2">{getCourseCode(r)}</td>
                                                            <td className="p-2">{getCredits(r)}</td>
                                                            <td className="p-2 font-semibold">{getGrade(r)}</td>
                                                            <td className="p-2">
                                                                <Badge variant={statusBadgeVariant(status)}>{status}</Badge>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}

                                                {filtered.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={5} className="p-4 text-center text-muted-foreground">
                                                            No hay cursos para este ciclo.
                                                        </td>
                                                    </tr>
                                                ) : null}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            ) : (
                                <div className="rounded-2xl border p-4 bg-white/60 dark:bg-neutral-900/40">
                                    <p className="text-sm text-muted-foreground">
                                        No se encontraron ciclos. Verifica que el backend envíe <code>items</code> con <code>period</code>.
                                    </p>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    );
}
