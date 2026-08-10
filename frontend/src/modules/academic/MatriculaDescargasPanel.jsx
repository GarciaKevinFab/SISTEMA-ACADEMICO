// Panel de descargas del módulo MATRÍCULA (pedido de Secretaría Académica):
// Acta · Nómina · Regular e Ingresantes · Subsanación · Reincorporación y
// traslado — cada documento en PDF y Excel, con filtros de carrera y ciclo.
// Mismo patrón visual que Evaluación → "Boletas y reportes".
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, FileText, FileSpreadsheet, Loader2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../../components/ui/select";
import { AcademicReports, EvaluationAdmin, Careers } from "../../services/academic.service";

function downloadBlob(res, fallback) {
    const cd = res?.headers?.["content-disposition"] || "";
    const m = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(cd);
    const filename = m?.[1]?.replace(/['"]/g, "").trim() || fallback;
    const blob = res?.data instanceof Blob ? res.data : new Blob([res.data]);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => window.URL.revokeObjectURL(url), 60000);
}

async function blobError(e, fallback) {
    try {
        if (e?.response?.data instanceof Blob) {
            const j = JSON.parse(await e.response.data.text());
            return j?.detail || fallback;
        }
    } catch { /* ignore */ }
    return e?.response?.data?.detail || e?.message || fallback;
}

export default function MatriculaDescargasPanel({ academicPeriod }) {
    const [busy, setBusy] = useState("");
    const [careers, setCareers] = useState([]);
    const [careerId, setCareerId] = useState("");
    const [ciclo, setCiclo] = useState("");

    useEffect(() => {
        (async () => {
            try {
                const { careers } = await Careers.list();
                setCareers(careers || []);
            } catch { /* el filtro queda en "Todas" */ }
        })();
    }, []);

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
        const p = { period: academicPeriod };
        if (careerId) p.career_id = careerId;
        if (ciclo) p.semester = ciclo;
        return p;
    };

    // La Nómina MINEDU exige carrera y ciclo (una nómina = un aula)
    const nominaParams = () => {
        if (!careerId) { toast.error("Selecciona una carrera para la Nómina"); return null; }
        if (!ciclo) { toast.error("Selecciona un ciclo para la Nómina"); return null; }
        return base();
    };

    const tipoRun = (key, tipo, fmt, nombre) =>
        run(key, () => (fmt === "pdf"
            ? AcademicReports.exportMatriculaTipoPdf({ ...base(), tipo })
            : AcademicReports.exportMatriculaTipo({ ...base(), tipo })),
            `${nombre}-${academicPeriod}.${fmt}`);

    const DOCS = [
        {
            key: "acta", num: 1,
            title: "DESCARGAR ACTA",
            desc: "Acta Consolidada de Evaluación del ciclo (Anexo 4): cursos en columnas con C/CS/PTJ, promedio ponderado y firmas.",
            filtros: "Período · Carrera · Ciclo",
            pdf: () => run("acta_pdf", () => EvaluationAdmin.actaConsolidadaPdf(base()),
                `acta-consolidada-${academicPeriod}.pdf`),
            excel: () => run("acta_xls", () => EvaluationAdmin.actaConsolidada(base()),
                `acta-consolidada-${academicPeriod}.xlsx`),
        },
        {
            key: "nomina", num: 2,
            title: "DESCARGAR NÓMINA",
            desc: "Nómina de Matrícula oficial en formato MINEDU, un aula por documento.",
            filtros: "Período · Carrera (obligatoria) · Ciclo (obligatorio)",
            pdf: () => { const p = nominaParams(); if (p) run("nomina_pdf", () => AcademicReports.exportNominaMineduPdf(p), `nomina-${academicPeriod}.pdf`); },
            excel: () => { const p = nominaParams(); if (p) run("nomina_xls", () => AcademicReports.exportNominaMinedu(p), `nomina-${academicPeriod}.xlsx`); },
        },
        {
            key: "regular", num: 3,
            title: "MATRÍCULA REGULAR E INGRESANTES",
            desc: "Listado de matriculados del período con tipo Regular o Ingresante.",
            filtros: "Período · Carrera · Ciclo",
            pdf: () => tipoRun("regular_pdf", "regular", "pdf", "matricula-regular"),
            excel: () => tipoRun("regular_xls", "regular", "xlsx", "matricula-regular"),
        },
        {
            key: "subsanacion", num: 4,
            title: "MATRÍCULA POR SUBSANACIÓN",
            desc: "Matriculados en subsanación (curso a cargo, hasta 12 créditos en verano / 5 en semestre regular).",
            filtros: "Período · Carrera · Ciclo",
            pdf: () => tipoRun("subsa_pdf", "subsanacion", "pdf", "matricula-subsanacion"),
            excel: () => tipoRun("subsa_xls", "subsanacion", "xlsx", "matricula-subsanacion"),
        },
        {
            key: "reinc", num: 5,
            title: "REINCORPORACIÓN Y TRASLADO",
            desc: "Matriculados que retornan de licencia o llegan por traslado, con su N° de R.D.",
            filtros: "Período · Carrera · Ciclo",
            pdf: () => tipoRun("reinc_pdf", "reincorporacion-traslado", "pdf", "reincorporacion-traslado"),
            excel: () => tipoRun("reinc_xls", "reincorporacion-traslado", "xlsx", "reincorporacion-traslado"),
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
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
                <Button size="sm" onClick={d.pdf} disabled={!!busy}
                    className="gap-1.5 h-8 bg-rose-600 hover:bg-rose-700">
                    {busy === `${d.key}_pdf` || busy.startsWith(`${d.key}_pdf`)
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <FileText className="h-3.5 w-3.5" />}
                    PDF
                </Button>
                <Button size="sm" onClick={d.excel} disabled={!!busy}
                    className="gap-1.5 h-8 bg-emerald-600 hover:bg-emerald-700">
                    {busy.endsWith("_xls") && busy.startsWith(d.key.slice(0, 5))
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <FileSpreadsheet className="h-3.5 w-3.5" />}
                    Excel
                </Button>
            </div>
        </div>
    );

    return (
        <Card className="border shadow-sm rounded-2xl">
            <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                    <Download className="h-4 w-4 text-blue-600" /> Descargas de Matrícula — {academicPeriod}
                </CardTitle>
                <p className="text-xs text-slate-500">
                    Cada documento se emite por separado en <b>PDF o Excel</b> con los
                    filtros elegidos. El tipo de matrícula sale del Padrón de Alumnos.
                </p>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-wrap items-end gap-3 p-3 rounded-xl bg-slate-50 border">
                    <div className="min-w-[220px]">
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
                    <div className="min-w-[130px]">
                        <Label className="text-[10px] font-bold uppercase">Ciclo</Label>
                        <Select value={ciclo || "ALL"} onValueChange={(v) => setCiclo(v === "ALL" ? "" : v)}>
                            <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Todos</SelectItem>
                                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                                    <SelectItem key={n} value={String(n)}>Ciclo {n}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {DOCS.map((d) => <DocCard key={d.key} d={d} />)}
                </div>
            </CardContent>
        </Card>
    );
}
