// src/modules/admission/ResultsPublication.jsx
import React, { useEffect, useState } from "react";
import { AdmissionCalls, Results } from "../../services/admission.service";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { toast } from "sonner";

export default function ResultsPublication() {
    const [calls, setCalls] = useState([]);
    const [call, setCall] = useState(null);
    const [careerId, setCareerId] = useState("");
    const [rows, setRows] = useState([]);
    const [published, setPublished] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const d = await AdmissionCalls.listAdmin();
                const list = d?.admission_calls || d?.calls || d || [];
                setCalls(list);
                setCall(list[0] || null);
            } catch {
                toast.error("Error al cargar convocatorias");
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const load = async () => {
        if (!call || !careerId) return;
        try {
            const d = await Results.list({ call_id: call.id, career_id: careerId });
            const arr = (d?.results || d || []).slice().sort((a, b) => (b.final_score ?? 0) - (a.final_score ?? 0));
            setRows(arr);
            setPublished(!!d?.published);
        } catch {
            toast.error("No se pudieron cargar resultados");
        }
    };

    useEffect(() => { if (call && careerId) load(); }, [call?.id, careerId]);

    const publish = async (phase = "final") => {
        try {
            await Results.publish({ call_id: call.id, career_id: careerId, phase });
            toast.success(phase === "phase1" ? "Resultados Fase 1 publicados" : "Resultados finales publicados");
            setPublished(phase === "final");
            load();
        } catch (e) {
            toast.error(e?.response?.data?.detail || "No se pudo publicar");
        }
    };

    const closeProcess = async () => {
        try {
            await Results.close({ call_id: call.id, career_id: careerId });
            toast.success("Proceso cerrado");
            setPublished(true);
            load();
        } catch (e) {
            toast.error(e?.response?.data?.detail || "No se pudo cerrar el proceso");
        }
    };

    const downloadActa = async () => {
        try {
            const resp = await Results.actaPdf({ call_id: call.id, career_id: careerId });
            const blob = new Blob([resp.data], { type: resp.headers["content-type"] || "application/pdf" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = `acta_${call.id}_${careerId}.pdf`; a.click();
            URL.revokeObjectURL(url);
        } catch {
            toast.error("No se pudo descargar el acta");
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            </div>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Publicación de Resultados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
  <div>
    <label className="text-sm">Convocatoria</label>
    <Select value={call?.id?.toString()} onValueChange={(v) => setCall(calls.find(x => x.id.toString() === v))}>
      <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
      <SelectContent>
        {calls.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
      </SelectContent>
    </Select>
  </div>

  <div>
    <label className="text-sm">Carrera</label>
    <Select value={careerId} onValueChange={setCareerId}>
      <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
      <SelectContent>
        {call?.careers?.map(k => <SelectItem key={k.id} value={k.id.toString()}>{k.name}</SelectItem>)}
      </SelectContent>
    </Select>
  </div>

  {/* BOTONES RESPONSIVE */}
  <div className="flex flex-col md:flex-row md:items-end gap-2">
    <Button className="w-full md:w-auto" variant="outline" onClick={load}>
      Refrescar
    </Button>

    <Button
      className="w-full md:w-auto"
      variant="outline"
      onClick={downloadActa}
      disabled={!rows.length}
    >
      Descargar Acta (PDF)
    </Button>

    {!published ? (
      <>
        <Button className="w-full md:w-auto" variant="secondary" onClick={() => publish("phase1")} disabled={!rows.length}>
          Publicar Fase 1
        </Button>
        <Button className="w-full md:w-auto" onClick={() => publish("final")} disabled={!rows.length}>
          Publicar Final
        </Button>
      </>
    ) : (
      <Button className="w-full md:w-auto" onClick={closeProcess} variant="secondary">
        Cerrar Proceso
      </Button>
    )}
  </div>
</div>


                <div className="border rounded overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="p-2 text-left">#</th>
                                <th className="p-2 text-left">Postulante</th>
                                <th className="p-2 text-left">N° Post.</th>
                                <th className="p-2 text-center">Fase 1</th>
                                <th className="p-2 text-center">Fase 2</th>
                                <th className="p-2 text-center">Total</th>
                                <th className="p-2 text-center">Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r, i) => {
                                const total = r.final_score ?? 0;
                                const statusLabels = {
                                    CREATED: "Registrado", PHASE1_PASSED: "Apto F1", PHASE1_FAILED: "No Apto F1",
                                    PHASE2_SCORED: "Evaluado", EVALUATED: "Evaluado",
                                    ADMITTED: "INGRESA", NOT_ADMITTED: "NO INGRESA",
                                };
                                const statusColors = {
                                    ADMITTED: "bg-emerald-100 text-emerald-800 border-emerald-200",
                                    NOT_ADMITTED: "bg-rose-100 text-rose-800 border-rose-200",
                                    PHASE1_PASSED: "bg-blue-100 text-blue-800 border-blue-200",
                                    PHASE1_FAILED: "bg-rose-100 text-rose-700 border-rose-200",
                                    PHASE2_SCORED: "bg-violet-100 text-violet-700 border-violet-200",
                                };
                                return (
                                <tr key={r.application_id} className="border-t hover:bg-blue-50/30">
                                    <td className="p-2 text-slate-500 font-medium">{i + 1}</td>
                                    <td className="p-2 font-semibold">{r.applicant_name}</td>
                                    <td className="p-2 text-slate-500">#{r.application_number}</td>
                                    <td className="p-2 text-center font-mono font-semibold">
                                        <span className={r.phase1_total >= 30 ? "text-emerald-700" : r.phase1_total > 0 ? "text-red-600" : "text-slate-400"}>
                                            {r.phase1_total?.toFixed?.(1) ?? "—"}
                                        </span>
                                    </td>
                                    <td className="p-2 text-center font-mono font-semibold">
                                        <span className={r.phase2_total > 0 ? "text-indigo-700" : "text-slate-400"}>
                                            {r.phase2_total?.toFixed?.(1) ?? "—"}
                                        </span>
                                    </td>
                                    <td className={`p-2 text-center font-mono font-bold ${total >= 60 ? "text-emerald-800" : total > 0 ? "text-red-700" : "text-slate-400"}`}>
                                        {total > 0 ? total.toFixed(1) : "—"}
                                    </td>
                                    <td className="p-2 text-center">
                                        <Badge className={`text-[10px] font-bold ${statusColors[r.status] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                                            {statusLabels[r.status] || r.status || "—"}
                                        </Badge>
                                    </td>
                                </tr>
                                );
                            })}
                            {!rows.length && <tr><td colSpan={7} className="p-4 text-center text-gray-500">Sin resultados</td></tr>}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}
