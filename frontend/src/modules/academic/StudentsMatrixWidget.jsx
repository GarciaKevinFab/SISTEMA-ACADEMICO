/* ═══════════════════════════════════════════════════════════════
   StudentsMatrixWidget
   Heatmap carrera × ciclo con conteo de matriculados en un periodo.
   Útil para dashboard académico — un vistazo global.
   ═══════════════════════════════════════════════════════════════ */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, GraduationCap, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { StudentsService } from "@/services/students.service";

const ROMAN = ["I","II","III","IV","V","VI","VII","VIII","IX","X"];

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

// intensidad de color según el valor relativo (0..max)
function cellTone(value, max) {
    if (!value) return "bg-slate-50 text-slate-300";
    const ratio = max > 0 ? value / max : 0;
    if (ratio > 0.75) return "bg-blue-600 text-white font-extrabold";
    if (ratio > 0.50) return "bg-blue-400 text-white font-bold";
    if (ratio > 0.25) return "bg-blue-200 text-blue-900 font-semibold";
    return "bg-blue-50 text-blue-700";
}

export default function StudentsMatrixWidget({ onCellClick = null }) {
    const [periodo, setPeriodo] = useState(defaultPeriod());
    const [onlyEnrolled, setOnlyEnrolled] = useState(true);
    const [data, setData] = useState({ careers: [], totals_by_cycle: {}, grand_total: 0 });
    const [loading, setLoading] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = { periodo, only_students: 1 };
            if (onlyEnrolled) params.only_enrolled = 1;
            const d = await StudentsService.matrix(params);
            setData(d || { careers: [], totals_by_cycle: {}, grand_total: 0 });
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Error cargando matriz");
        } finally {
            setLoading(false);
        }
    }, [periodo, onlyEnrolled]);

    useEffect(() => { load(); }, [load]);

    const maxCell = useMemo(() => {
        let m = 0;
        (data.careers || []).forEach((c) =>
            Object.values(c.cycles || {}).forEach((v) => { if (v > m) m = v; })
        );
        return m;
    }, [data]);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                    <span className="flex items-center gap-2 text-base font-extrabold">
                        <GraduationCap className="w-5 h-5 text-blue-600" /> Matriculados por carrera y ciclo
                    </span>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                            <Label className="text-[10px] font-bold uppercase text-slate-500">Periodo</Label>
                            <Select value={periodo} onValueChange={setPeriodo}>
                                <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {periodOptions().map((p) => (
                                        <SelectItem key={p} value={p}>{p}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button
                            variant={onlyEnrolled ? "default" : "outline"}
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => setOnlyEnrolled((v) => !v)}
                            title="Filtrar por matrícula confirmada en el periodo"
                        >
                            {onlyEnrolled ? "Solo matriculados" : "Todos del periodo"}
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={load}>
                            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                        </Button>
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="py-10 text-center text-slate-500 text-sm">
                        <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Calculando…
                    </div>
                ) : (data.careers?.length || 0) === 0 ? (
                    <div className="py-10 text-center text-slate-500 text-sm">
                        Sin datos para {periodo}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="bg-slate-100 text-slate-600 uppercase text-[10px] tracking-wider">
                                    <th className="px-2 py-2 text-left">Carrera</th>
                                    {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                                        <th key={n} className="px-1 py-2 text-center w-10">{ROMAN[n-1]}</th>
                                    ))}
                                    <th className="px-2 py-2 text-center">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.careers.map((c) => (
                                    <tr key={c.id || c.name} className="border-t hover:bg-slate-50">
                                        <td
                                            className={`px-2 py-1.5 font-semibold text-slate-800 ${onCellClick ? "cursor-pointer hover:text-blue-700" : ""}`}
                                            onClick={onCellClick ? () => onCellClick({ career_id: c.id, career_name: c.name, ciclo: "", periodo }) : undefined}
                                            title={onCellClick ? "Ver TODOS los alumnos de esta carrera" : undefined}
                                        >
                                            {c.name}
                                        </td>
                                        {[1,2,3,4,5,6,7,8,9,10].map((n) => {
                                            const v = (c.cycles || {})[String(n)] || 0;
                                            const clickable = onCellClick && v > 0;
                                            return (
                                                <td key={n} className="p-0.5 text-center">
                                                    <div
                                                        onClick={clickable ? () => onCellClick({ career_id: c.id, career_name: c.name, ciclo: String(n), periodo }) : undefined}
                                                        className={`rounded ${cellTone(v, maxCell)} h-7 grid place-items-center text-[11px] ${clickable ? "cursor-pointer hover:ring-2 hover:ring-blue-400 hover:ring-offset-1 transition" : ""}`}
                                                        title={clickable ? `Ver los ${v} alumnos de ${c.name} ciclo ${ROMAN[n-1]} en ${periodo}` : undefined}
                                                    >
                                                        {v || ""}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                        <td className="px-2 py-1.5 text-center font-extrabold text-slate-900">{c.total || 0}</td>
                                    </tr>
                                ))}
                                <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                                    <td className="px-2 py-2 text-right text-slate-700 uppercase text-[10px]">Total</td>
                                    {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                                        <td key={n} className="px-1 py-2 text-center text-slate-700">
                                            {data.totals_by_cycle?.[String(n)] || 0}
                                        </td>
                                    ))}
                                    <td className="px-2 py-2 text-center text-blue-700 text-base">{data.grand_total}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
