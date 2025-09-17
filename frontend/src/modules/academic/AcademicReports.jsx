import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { AcademicReports } from "../../services/academic.service";
import { toast } from "sonner";

export default function AcademicReportsPage() {
    const [filters, setFilters] = useState({ from: "", to: "", period: "", career_id: "" });
    const [summary, setSummary] = useState(null);
    const on = (k, v) => setFilters(f => ({ ...f, [k]: v }));

    const load = async () => {
        try {
            const d = await AcademicReports.summary(filters);
            setSummary(d);
        } catch { toast.error("No se pudo cargar el resumen"); }
    };

    const dl = async (fn, name) => {
        try {
            const r = await fn(filters);
            const blob = (await r.blob?.()) || r;
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = name; a.click();
            URL.revokeObjectURL(url);
        } catch { toast.error("No se pudo exportar"); }
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader><CardTitle>Reportes Académicos</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-5 gap-3">
                        <div>
                            <label className="text-sm">Desde</label>
                            <Input type="date" value={filters.from} onChange={e => on("from", e.target.value)} />
                        </div>
                        <div>
                            <label className="text-sm">Hasta</label>
                            <Input type="date" value={filters.to} onChange={e => on("to", e.target.value)} />
                        </div>
                        <div>
                            <label className="text-sm">Período</label>
                            <Input value={filters.period} onChange={e => on("period", e.target.value)} />
                        </div>
                        <div>
                            <label className="text-sm">Carrera</label>
                            <Select
                                value={filters.career_id === "" ? "ALL" : String(filters.career_id)}
                                onValueChange={(v) => on("career_id", v === "ALL" ? "" : v)}
                            >
                                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">Todas</SelectItem>
                                    {/* Si luego cargas carreras, agrégalas aquí con value=String(id) */}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-end gap-2">
                            <Button onClick={load}>Ver resumen</Button>
                            <Button variant="outline" onClick={() => dl(AcademicReports.exportPerformance, "rendimiento.xlsx")}>Rendimiento</Button>
                            <Button variant="outline" onClick={() => dl(AcademicReports.exportOccupancy, "ocupacion.xlsx")}>Ocupación</Button>
                        </div>
                    </div>

                    {summary && (
                        <div className="grid md:grid-cols-4 gap-4">
                            <Card><CardContent className="pt-4"><div className="text-sm text-gray-500">Alumnos</div><div className="text-2xl font-semibold">{summary.students || 0}</div></CardContent></Card>
                            <Card><CardContent className="pt-4"><div className="text-sm text-gray-500">Aprobación (%)</div><div className="text-2xl font-semibold">{summary.pass_rate ?? "-"}</div></CardContent></Card>
                            <Card><CardContent className="pt-4"><div className="text-sm text-gray-500">PPA promedio</div><div className="text-2xl font-semibold">{summary.avg_gpa ?? "-"}</div></CardContent></Card>
                            <Card><CardContent className="pt-4"><div className="text-sm text-gray-500">Ocupación aulas (%)</div><div className="text-2xl font-semibold">{summary.room_occupancy ?? "-"}</div></CardContent></Card>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
