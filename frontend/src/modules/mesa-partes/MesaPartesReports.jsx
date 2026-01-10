// src/modules/mesa-partes/MesaPartesReports.jsx
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { ProcedureReports } from "../../services/mesaPartes.service";
import { toast } from "sonner";

export default function MesaPartesReports() {
    // Usar "ALL" como centinela para evitar value="" en SelectItem
    const [filters, setFilters] = useState({
        from: "",
        to: "",
        status: "ALL",
        // Si luego agregas filtro por tipo, usa también "ALL" como centinela aquí:
        // type_id: "ALL",
    });
    const [summary, setSummary] = useState(null);

    const onChange = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

    // Saneamos antes de llamar a la API: convertimos "ALL" -> undefined
    const toApi = (f) => ({
        from: f.from || undefined,
        to: f.to || undefined,
        status: f.status === "ALL" ? undefined : f.status,
        // type_id: f.type_id === "ALL" ? undefined : Number(f.type_id) || undefined,
    });

    const load = async () => {
        try {
            const d = await ProcedureReports.summary(toApi(filters));
            const s = d?.summary ?? d ?? null;
            setSummary(s);
        } catch {
            toast.error("No se pudo cargar el resumen");
        }
    };

    const dl = async (fn, name) => {
        try {
            const resp = await fn(toApi(filters));
            const blob = (resp?.blob && typeof resp.blob === "function") ? await resp.blob() : resp; // soporta fetch Response o Blob directo
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = name;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            toast.error("No se pudo exportar");
        }
    };

    const reset = () =>
        setFilters({
            from: "",
            to: "",
            status: "ALL",
            // type_id: "ALL",
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
                            <Input
                                type="date"
                                value={filters.from}
                                onChange={(e) => onChange("from", e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-sm">Hasta</label>
                            <Input
                                type="date"
                                value={filters.to}
                                onChange={(e) => onChange("to", e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-sm">Estado</label>
                            <Select
                                value={filters.status}
                                onValueChange={(v) => onChange("status", v)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Todos" />
                                </SelectTrigger>
                                <SelectContent>
                                    {/* NUNCA usar value="" en SelectItem */}
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
  <Button onClick={load} className="w-full sm:w-auto shrink-0">
    Ver resumen
  </Button>

  <Button
    variant="outline"
    onClick={() => dl(ProcedureReports.exportSLA, "sla.xlsx")}
    className="w-full sm:w-auto shrink-0"
  >
    Exportar SLA
  </Button>

  <Button
    variant="outline"
    onClick={() => dl(ProcedureReports.exportVolume, "volumen.xlsx")}
    className="w-full sm:w-auto shrink-0"
  >
    Exportar Volúmenes
  </Button>

  <Button
    variant="ghost"
    onClick={reset}
    className="w-full sm:w-auto shrink-0"
  >
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
                                    <div className="text-2xl font-semibold">
                                        {summary.avg_days ?? "-"}
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="pt-4">
                                    <div className="text-sm text-gray-500">Vencidos</div>
                                    <div className="text-2xl font-semibold">
                                        {summary.overdue || 0}
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="pt-4">
                                    <div className="text-sm text-gray-500">En revisión</div>
                                    <div className="text-2xl font-semibold">
                                        {summary.in_review || 0}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
