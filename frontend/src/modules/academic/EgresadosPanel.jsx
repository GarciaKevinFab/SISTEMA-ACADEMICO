/* ═══════════════════════════════════════════════════════════════
   EgresadosPanel
   Lista alumnos elegibles para Certificado de Egresado (ciclo ≥ 10,
   con créditos aprobados >= créditos del plan), permite selección
   masiva y emitir certificados en bloque (crea AcademicProcess
   type=CERTIFICADO_EGRESADO, que después genera el PDF con el
   generador existente).
   ═══════════════════════════════════════════════════════════════ */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
    GraduationCap, Loader2, RefreshCw, CheckCircle2, AlertCircle,
    Award, Filter, FileCheck2, Search, Download,
} from "lucide-react";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Graduates, Careers, ProcessFiles } from "@/services/academic.service";

const ROMAN = ["I","II","III","IV","V","VI","VII","VIII","IX","X"];

export default function EgresadosPanel() {
    const [careers, setCareers] = useState([]);
    const [careerId, setCareerId] = useState("");
    const [minCiclo, setMinCiclo] = useState("10");
    const [onlyReady, setOnlyReady] = useState(true);
    const [q, setQ] = useState("");
    const [rows, setRows] = useState([]);
    const [meta, setMeta] = useState({ total: 0, eligible_count: 0, already_emitted: 0 });
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState(new Set());
    const [emitting, setEmitting] = useState(false);

    useEffect(() => {
        Careers.list().then((d) => {
            const list = Array.isArray(d?.careers) ? d.careers : Array.isArray(d) ? d : [];
            setCareers(list);
        }).catch(() => setCareers([]));
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        setSelected(new Set());
        try {
            const params = { min_ciclo: minCiclo };
            if (careerId) params.career_id = careerId;
            if (onlyReady) params.only_ready = 1;
            const d = await Graduates.listEligible(params);
            setRows(Array.isArray(d?.students) ? d.students : []);
            setMeta({
                total: d?.total || 0,
                eligible_count: d?.eligible_count || 0,
                already_emitted: d?.already_emitted || 0,
            });
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Error cargando egresados");
        } finally {
            setLoading(false);
        }
    }, [careerId, minCiclo, onlyReady]);
    useEffect(() => { load(); }, [load]);

    const filtered = useMemo(() => {
        const t = q.trim().toLowerCase();
        if (!t) return rows;
        return rows.filter((r) =>
            (r.dni || "").includes(t) ||
            (r.full_name || "").toLowerCase().includes(t) ||
            (r.career_name || "").toLowerCase().includes(t)
        );
    }, [rows, q]);

    // Al cambiar la búsqueda se limpia la selección: evita emitir certificados
    // de alumnos seleccionados antes que ya no están visibles en pantalla.
    useEffect(() => { setSelected(new Set()); }, [q]);

    const toggleAll = () => {
        // Solo elegibles y no emitidos
        const emittables = filtered.filter((r) => r.eligible && !r.certificate_emitted);
        if (selected.size === emittables.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(emittables.map((r) => r.id)));
        }
    };
    const toggleOne = (id, canEmit) => {
        if (!canEmit) return;
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    // Estado del modal de confirmación de emisión
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmForce, setConfirmForce] = useState(false);

    const openConfirm = (force = false) => {
        if (selected.size === 0) { toast.error("Selecciona al menos un alumno"); return; }
        setConfirmForce(force);
        setConfirmOpen(true);
    };

    const doEmit = async () => {
        const force = confirmForce;
        setConfirmOpen(false);
        setEmitting(true);
        try {
            // 1) Crear los procesos AcademicProcess
            const r = await Graduates.bulkEmit(Array.from(selected), force);
            const created = Array.isArray(r?.created) ? r.created : [];
            const nCreated = created.length;
            const nSkipped = r?.skipped_count || 0;

            if (nCreated === 0) {
                toast.warning(`Ningún certificado emitido — ${nSkipped} omitido(s).`);
                return;
            }

            toast.success(
                `${nCreated} certificado(s) creado(s), generando PDF(s)…` +
                (nSkipped ? ` · ${nSkipped} omitido(s)` : "")
            );

            // 2) Generar el PDF de cada proceso creado (en paralelo, límite 4)
            const results = [];
            const errors = [];
            const batchSize = 4;
            for (let i = 0; i < created.length; i += batchSize) {
                const batch = created.slice(i, i + batchSize);
                const outs = await Promise.all(batch.map(async ({ process_id, student_id }) => {
                    try {
                        const resp = await ProcessFiles.generate(process_id);
                        const url = resp?.preview_url || resp?.file?.absolute_url || resp?.file?.url;
                        return { process_id, student_id, url };
                    } catch (e) {
                        errors.push({ process_id, student_id, error: e?.response?.data?.detail || e?.message });
                        return null;
                    }
                }));
                results.push(...outs.filter(Boolean));
            }

            // 3) Abrir PDFs — 1 solo → nueva pestaña directa; N → primeros 3 y aviso
            if (results.length === 1) {
                if (results[0].url) window.open(results[0].url, "_blank");
                toast.success("Certificado generado — se abrió en nueva pestaña");
            } else if (results.length > 1) {
                const openCount = Math.min(3, results.length);
                for (let i = 0; i < openCount; i++) {
                    if (results[i].url) window.open(results[i].url, "_blank");
                }
                if (results.length > openCount) {
                    toast.info(
                        `Se abrieron ${openCount} PDF(s) en pestañas. ` +
                        `Los otros ${results.length - openCount} están en Módulo Académico → Procesos → descarga individual.`,
                        { duration: 8000 }
                    );
                } else {
                    toast.success(`${results.length} PDF(s) generado(s) y abierto(s) en nuevas pestañas`);
                }
            }

            if (errors.length) {
                toast.error(
                    `${errors.length} PDF(s) fallaron: ${errors[0].error || "revisa Procesos"}`,
                    { duration: 8000 }
                );
            }

            setSelected(new Set());
            load();
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Error emitiendo certificados");
        } finally {
            setEmitting(false);
        }
    };

    const allSelectableCount = filtered.filter((r) => r.eligible && !r.certificate_emitted).length;

    const openExistingPdf = async (row) => {
        if (!row.certificate_process_id) {
            toast.error("No hay proceso asociado");
            return;
        }
        try {
            // force: regenera el PDF con el diseño vigente en lugar de servir el archivo guardado
            const resp = await ProcessFiles.generate(row.certificate_process_id, { force: true });
            const url = resp?.preview_url || resp?.file?.absolute_url || resp?.file?.url;
            if (url) window.open(url, "_blank");
            else toast.error(`Sin URL en respuesta: ${JSON.stringify(resp).slice(0,200)}`);
        } catch (e) {
            const st = e?.response?.status;
            const data = e?.response?.data;
            let msg = "";
            if (typeof data === "string") msg = data.slice(0, 300);
            else if (data?.detail) msg = data.detail;
            else if (data?.error)  msg = data.error;
            else msg = e?.message || "sin detalle";
            toast.error(`Error abriendo PDF (proceso ${row.certificate_process_id})${st ? ` [HTTP ${st}]` : ""}: ${msg}`);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                    <span className="flex items-center gap-2 text-base font-extrabold">
                        <GraduationCap className="w-5 h-5 text-emerald-600" /> Egresados — Certificado de Egresado
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                        Total {meta.total} · Elegibles <strong className="text-emerald-700 ml-1">{meta.eligible_count}</strong>
                        {meta.already_emitted > 0 && (
                            <span className="ml-2 text-blue-700">Ya emitidos {meta.already_emitted}</span>
                        )}
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {/* Filtros */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end p-3 rounded-lg bg-slate-50 border">
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
                        <Label className="text-[10px] font-bold uppercase">Ciclo mínimo</Label>
                        <Select value={minCiclo} onValueChange={setMinCiclo}>
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {[8, 9, 10].map((n) => (
                                    <SelectItem key={n} value={String(n)}>Ciclo {ROMAN[n-1]} en adelante</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="md:col-span-2">
                        <Label className="text-[10px] font-bold uppercase">Buscar</Label>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
                            <Input className="pl-8 h-9" placeholder="DNI, nombre, carrera..."
                                value={q} onChange={(e) => setQ(e.target.value)} />
                        </div>
                    </div>
                    <div>
                        <Button
                            variant={onlyReady ? "default" : "outline"}
                            className="w-full h-9 gap-1.5"
                            onClick={() => setOnlyReady((v) => !v)}
                        >
                            <Filter className="w-3.5 h-3.5" />
                            {onlyReady ? "Solo elegibles" : "Todos"}
                        </Button>
                    </div>
                </div>

                {/* Barra de acciones masivas */}
                <div className="flex items-center gap-2 flex-wrap p-2 rounded-lg bg-emerald-50/60 border border-emerald-200">
                    <span className="text-xs text-slate-700">
                        <strong>{selected.size}</strong> seleccionado(s) / {allSelectableCount} elegible(s) en pantalla
                    </span>
                    <Button size="sm" variant="outline" className="h-8" onClick={toggleAll}>
                        {selected.size === allSelectableCount && allSelectableCount > 0
                            ? "Desmarcar todos" : "Seleccionar elegibles"}
                    </Button>
                    <Button
                        size="sm"
                        className="h-8 bg-emerald-600 hover:bg-emerald-700 gap-1"
                        onClick={() => openConfirm(false)}
                        disabled={emitting || selected.size === 0}
                    >
                        {emitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Award className="w-3.5 h-3.5" />}
                        Emitir Certificado(s)
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 ml-auto" onClick={load}>
                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                    </Button>
                </div>

                {/* Tabla */}
                <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-100 text-[11px] uppercase tracking-wider text-slate-600">
                            <tr>
                                <th className="px-2 py-2 w-8"></th>
                                <th className="px-2 py-2 text-left">DNI</th>
                                <th className="px-2 py-2 text-left">Alumno</th>
                                <th className="px-2 py-2 text-left">Carrera</th>
                                <th className="px-2 py-2 text-center">Ciclo</th>
                                <th className="px-2 py-2 text-center">Créditos</th>
                                <th className="px-2 py-2 text-center">Avance</th>
                                <th className="px-2 py-2 text-center">Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && filtered.length === 0 && (
                                <tr><td colSpan={8} className="py-10 text-center text-slate-500">
                                    <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Cargando…
                                </td></tr>
                            )}
                            {!loading && filtered.length === 0 && (
                                <tr><td colSpan={8} className="py-10 text-center text-slate-500">
                                    Sin alumnos que cumplan los filtros.
                                </td></tr>
                            )}
                            {filtered.map((r) => {
                                const canEmit = r.eligible && !r.certificate_emitted;
                                const checked = selected.has(r.id);
                                return (
                                    <tr key={r.id}
                                        className={`border-t hover:bg-slate-50 ${checked ? "bg-emerald-50/40" : ""} ${!r.eligible ? "opacity-70" : ""}`}>
                                        <td className="px-2 py-1.5 text-center">
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                disabled={!canEmit}
                                                onChange={() => toggleOne(r.id, canEmit)}
                                                title={
                                                    r.certificate_emitted ? "Certificado ya emitido" :
                                                    !r.eligible ? "No cumple créditos requeridos" :
                                                    "Marcar para emitir"
                                                }
                                            />
                                        </td>
                                        <td className="px-2 py-1.5 font-mono text-xs">{r.dni}</td>
                                        <td className="px-2 py-1.5">{r.full_name}</td>
                                        <td className="px-2 py-1.5 text-xs">{r.career_name || "—"}</td>
                                        <td className="px-2 py-1.5 text-center font-bold">{r.ciclo || "—"}</td>
                                        <td className="px-2 py-1.5 text-center text-xs">
                                            <strong>{r.earned_credits}</strong> / {r.required_credits}
                                            {r.missing_count > 0 && (
                                                <div className="text-[10px] text-slate-400">
                                                    faltan {r.missing_count} curso(s)
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-2 py-1.5 text-center">
                                            <div className="inline-flex items-center gap-1">
                                                <div className="w-16 h-2 bg-slate-200 rounded overflow-hidden">
                                                    <div
                                                        className={`h-full ${r.eligible ? "bg-emerald-500" : "bg-amber-400"}`}
                                                        style={{ width: `${Math.min(100, r.pct)}%` }}
                                                    />
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-600">{r.pct}%</span>
                                            </div>
                                        </td>
                                        <td className="px-2 py-1.5 text-center">
                                            {r.certificate_emitted ? (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 gap-1 bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100"
                                                    onClick={() => openExistingPdf(r)}
                                                    title="Abrir PDF del certificado en nueva pestaña"
                                                >
                                                    <Download className="w-3 h-3" /> Ver PDF
                                                </Button>
                                            ) : r.eligible ? (
                                                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">
                                                    <CheckCircle2 className="w-3 h-3 mr-1" /> Elegible
                                                </Badge>
                                            ) : (
                                                <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px]">
                                                    <AlertCircle className="w-3 h-3 mr-1" /> Pendiente
                                                </Badge>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <p className="text-[11px] text-slate-500">
                    <strong>Nota:</strong> al emitir se crea un proceso <code>CERTIFICADO_EGRESADO</code> en el
                    módulo Procesos. Desde ahí puedes descargar el PDF con firmas y sellos. Además, cada vez
                    que un docente cierra un acta, el sistema revisa si algún alumno alcanzó los créditos
                    totales y emite automáticamente su certificado.
                </p>
            </CardContent>

            {/* ── Modal de confirmación ── */}
            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-emerald-700">
                            <Award className="w-5 h-5" /> Confirmar emisión de certificados
                        </DialogTitle>
                        <DialogDescription>
                            Se generará el <strong>Certificado de Egresado</strong> con firmas y sellos,
                            y los PDFs se abrirán en pestañas nuevas del navegador.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-3 space-y-3">
                        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-emerald-100 grid place-items-center shrink-0">
                                <GraduationCap className="w-5 h-5 text-emerald-700" />
                            </div>
                            <div>
                                <div className="text-xs text-emerald-700 font-semibold uppercase tracking-wide">
                                    Alumnos seleccionados
                                </div>
                                <div className="text-3xl font-extrabold text-emerald-800 leading-none mt-0.5">
                                    {selected.size}
                                </div>
                            </div>
                        </div>

                        {confirmForce && (
                            <div className="rounded-lg bg-amber-50 border border-amber-300 px-3 py-2 flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
                                <div className="text-xs text-amber-800">
                                    <strong>Modo FORZADO:</strong> se emitirá el certificado incluso
                                    a alumnos que aún no cumplen los créditos requeridos.
                                </div>
                            </div>
                        )}

                        <p className="text-xs text-slate-500">
                            Esta acción crea un proceso académico por alumno y no se puede deshacer.
                        </p>
                    </div>

                    <DialogFooter className="flex-wrap gap-2">
                        <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={emitting}>
                            Cancelar
                        </Button>
                        <Button
                            onClick={doEmit}
                            disabled={emitting}
                            className="bg-emerald-600 hover:bg-emerald-700 gap-1.5"
                        >
                            {emitting
                                ? <><Loader2 className="w-4 h-4 animate-spin" /> Emitiendo…</>
                                : <><Award className="w-4 h-4" /> Confirmar emisión</>}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
