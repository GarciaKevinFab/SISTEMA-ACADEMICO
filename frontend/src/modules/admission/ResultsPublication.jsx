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

    const publish = async () => {
        try {
            await Results.publish({ call_id: call.id, career_id: careerId });
            toast.success("Resultados publicados");
            setPublished(true);
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
                <div className="grid md:grid-cols-3 gap-3">
                    <div>
                        <label className="text-sm">Convocatoria</label>
                        <Select value={call?.id?.toString()} onValueChange={(v) => setCall(calls.find(x => x.id.toString() === v))}>
                            <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                            <SelectContent>
                                {calls.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <label className="text-sm">Carrera</label>
                        <Select value={careerId} onValueChange={setCareerId}>
                            <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                            <SelectContent>
                                {call?.careers?.map(k => <SelectItem key={k.id} value={k.id.toString()}>{k.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-end gap-2">
                        <Button variant="outline" onClick={load}>Refrescar</Button>
                        <Button variant="outline" onClick={downloadActa} disabled={!rows.length}>Descargar Acta (PDF)</Button>
                        {!published
                            ? <Button onClick={publish} disabled={!rows.length}>Publicar</Button>
                            : <Button onClick={closeProcess} variant="secondary">Cerrar Proceso</Button>}
                    </div>
                </div>

                <div className="border rounded overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="p-2 text-left">#</th>
                                <th className="p-2 text-left">Postulante</th>
                                <th className="p-2 text-left">N° Postulación</th>
                                <th className="p-2 text-center">Puntaje Final</th>
                                <th className="p-2 text-center">Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r, i) => (
                                <tr key={r.application_id} className="border-t">
                                    <td className="p-2">{i + 1}</td>
                                    <td className="p-2">{r.applicant_name}</td>
                                    <td className="p-2">{r.application_number}</td>
                                    <td className="p-2 text-center font-medium">{r.final_score?.toFixed?.(2) ?? "-"}</td>
                                    <td className="p-2 text-center">
                                        <Badge variant={r.status === "ADMITTED" ? "default" : r.status === "WAITING_LIST" ? "secondary" : "outline"}>
                                            {r.status || "—"}
                                        </Badge>
                                    </td>
                                </tr>
                            ))}
                            {!rows.length && <tr><td colSpan={5} className="p-4 text-center text-gray-500">Sin resultados</td></tr>}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}
