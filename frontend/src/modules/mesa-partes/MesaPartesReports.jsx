// src/modules/mesa-partes/MesaPartesReports.jsx
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { ProcedureReports } from "../../services/mesaPartes.service";
import { toast } from "sonner";

export default function MesaPartesReports() {
    const [filters, setFilters] = useState({
        from: "",
        to: "",
        status: "ALL",
    });

    const [summary, setSummary] = useState(null);
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [downloading, setDownloading] = useState(false);

    const onChange = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

    // Convertimos "ALL" -> undefined para que el backend no filtre
    const toApi = (f) => ({
        from: f.from || undefined,
        to: f.to || undefined,
        status: f.status === "ALL" ? undefined : f.status,
    });

    const load = async () => {
        setLoadingSummary(true);
        try {
            const d = await ProcedureReports.summary(toApi(filters));
            const s = d?.summary ?? d ?? null;
            setSummary(s);
        } catch (e) {
            toast.error(e?.message || "No se pudo cargar el resumen");
        } finally {
            setLoadingSummary(false);
        }
    };

    /**
     * Descarga que soporta:
     * - axios response con blob (r.data)
     * - JSON (objeto) cuando el endpoint respondió error o msg
     * - Blob directo (por si algún día cambias la capa)
     */
    const dl = async (fn, fallbackName) => {
        setDownloading(true);
        try {
            const r = await fn(toApi(filters));

            // 1) Si r es JSON / objeto (asBlobOrJson devolvió JSON)
            if (r && typeof r === "object" && !(r instanceof Blob) && !r.data) {
                const msg = r?.detail || r?.message || "No se pudo exportar";
                toast.error(msg);
                return;
            }

            // 2) Si r es axios response (lo normal)
            const isAxios = !!r?.data && !!r?.headers;
            const headers = isAxios ? r.headers : {};
            const contentType = (headers?.["content-type"] || "").toLowerCase();
            const cd = headers?.["content-disposition"] || "";

            // data puede venir como Blob, ArrayBuffer o string
            let blob;
            if (isAxios) {
                if (r.data instanceof Blob) {
                    blob = r.data;
                } else {
                    blob = new Blob([r.data], { type: contentType || "application/octet-stream" });
                }
            } else if (r instanceof Blob) {
                blob = r;
            } else {
                // último fallback
                blob = new Blob([r], { type: "application/octet-stream" });
            }

            // 3) Si vino JSON en blob (por error), lo leemos
            if (contentType.includes("application/json")) {
                const txt = await blob.text();
                let msg = "No se pudo exportar";
                try {
                    const j = JSON.parse(txt);
                    msg = j?.detail || j?.message || msg;
                } catch {
                    msg = txt || msg;
                }
                toast.error(msg);
                return;
            }

            // 4) Nombre desde header si existe
            const fileName = /filename="?([^"]+)"?/i.exec(cd)?.[1] || fallbackName;

            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1500);
        } catch (e) {
            toast.error(e?.message || "No se pudo exportar");
        } finally {
            setDownloading(false);
        }
    };

    const reset = () =>
        setFilters({
            from: "",
            to: "",
            status: "ALL",
        });

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Reportes – Mesa de Partes</CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 min-w-0">
                        <div>
                            <label className="text-sm">Desde</label>
                            <Input type="date" value={filters.from} onChange={(e) => onChange("from", e.target.value)} />
                        </div>

                        <div>
                            <label className="text-sm">Hasta</label>
                            <Input type="date" value={filters.to} onChange={(e) => onChange("to", e.target.value)} />
                        </div>

                        <div>
                            <label className="text-sm">Estado</label>
                            <Select value={filters.status} onValueChange={(v) => onChange("status", v)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Todos" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">Todos</SelectItem>
                                    <SelectItem value="RECEIVED">Recibido</SelectItem>
                                    <SelectItem value="IN_REVIEW">En Revisión</SelectItem>
                                    <SelectItem value="APPROVED">Aprobado</SelectItem>
                                    <SelectItem value="REJECTED">Rechazado</SelectItem>
                                    <SelectItem value="COMPLETED">Completado</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-2 w-full min-w-0 md:col-span-4 md:justify-end">
                            <Button onClick={load} className="w-full sm:w-auto shrink-0" disabled={loadingSummary || downloading}>
                                {loadingSummary ? "Cargando..." : "Ver resumen"}
                            </Button>

                            <Button
                                variant="outline"
                                onClick={() => dl(ProcedureReports.exportSLA, "sla.xlsx")}
                                className="w-full sm:w-auto shrink-0"
                                disabled={downloading}
                            >
                                {downloading ? "Descargando..." : "Exportar SLA"}
                            </Button>

                            <Button
                                variant="outline"
                                onClick={() => dl(ProcedureReports.exportVolume, "volumen.xlsx")}
                                className="w-full sm:w-auto shrink-0"
                                disabled={downloading}
                            >
                                {downloading ? "Descargando..." : "Exportar Volúmenes"}
                            </Button>

                            <Button variant="ghost" onClick={reset} className="w-full sm:w-auto shrink-0" disabled={downloading}>
                                Limpiar
                            </Button>
                        </div>
                    </div>

                    {summary && (
                        <div className="grid md:grid-cols-4 gap-4">
                            <Card>
                                <CardContent className="pt-4">
                                    <div className="text-sm text-gray-500">Trámites</div>
                                    <div className="text-2xl font-semibold">{summary.total || 0}</div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="pt-4">
                                    <div className="text-sm text-gray-500">Tiempo prom. (días)</div>
                                    <div className="text-2xl font-semibold">{summary.avg_days ?? "-"}</div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="pt-4">
                                    <div className="text-sm text-gray-500">Vencidos</div>
                                    <div className="text-2xl font-semibold">{summary.overdue || 0}</div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="pt-4">
                                    <div className="text-sm text-gray-500">En revisión</div>
                                    <div className="text-2xl font-semibold">{summary.in_review || 0}</div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
