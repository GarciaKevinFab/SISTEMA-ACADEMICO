import React, { useEffect, useState } from "react";
import { AdmissionCalls, Results } from "../../services/admission.service";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import { generatePDFWithPolling } from "../../utils/pdfQrPolling";

export default function AdmissionCertificates() {
    const [calls, setCalls] = useState([]);
    const [call, setCall] = useState(null);
    const [careerId, setCareerId] = useState("");
    const [rows, setRows] = useState([]);

    useEffect(() => {
        AdmissionCalls.listAdmin().then((d) => {
            const list = d?.admission_calls || d?.calls || d || [];
            setCalls(list);
            setCall(list[0] || null);
        });
    }, []);

    const load = async () => {
        if (!call || !careerId) return;
        const d = await Results.list({ call_id: call.id, career_id: careerId });
        const arr = d?.results || d || [];
        setRows(arr);
    };
    useEffect(() => { if (call && careerId) load(); }, [call?.id, careerId]);

    const genPre = async (application_id) => {
        try {
            const r = await generatePDFWithPolling("/admission/certificates/preinscripcion", { application_id }, { testId: `pre-${application_id}` });
            if (r?.downloadUrl) {
                const a = document.createElement("a");
                a.href = r.downloadUrl; a.download = `constancia_pre_${application_id}.pdf`; a.click();
            }
        } catch { toast.error("No se pudo generar la constancia"); }
    };

    const genIngreso = async (application_id) => {
        try {
            const r = await generatePDFWithPolling("/admission/certificates/ingreso", { application_id }, { testId: `ing-${application_id}` });
            if (r?.downloadUrl) {
                const a = document.createElement("a");
                a.href = r.downloadUrl; a.download = `constancia_ingreso_${application_id}.pdf`; a.click();
            }
        } catch { toast.error("No se pudo generar la constancia"); }
    };

    return (
        <Card>
            <CardHeader><CardTitle>Constancias de Admisión</CardTitle></CardHeader>
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
                    <div className="flex items-end">
                        <Button variant="outline" onClick={load}>Refrescar</Button>
                    </div>
                </div>

                <div className="border rounded overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="p-2 text-left">Postulante</th>
                                <th className="p-2">N°</th>
                                <th className="p-2">Puntaje</th>
                                <th className="p-2">Estado</th>
                                <th className="p-2" />
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(r => (
                                <tr key={r.application_id} className="border-t">
                                    <td className="p-2 text-left">{r.applicant_name}</td>
                                    <td className="p-2 text-center">{r.application_number}</td>
                                    <td className="p-2 text-center">{r.final_score ?? "-"}</td>
                                    <td className="p-2 text-center">{r.status || "—"}</td>
                                    <td className="p-2 text-right">
                                        <div className="flex gap-2 justify-end">
                                            <Button variant="outline" size="sm" onClick={() => genPre(r.application_id)} data-testid={`pre-${r.application_id}`}>Constancia de preinscripción</Button>
                                            {r.status === "ADMITTED" && (
                                                <Button size="sm" onClick={() => genIngreso(r.application_id)} data-testid={`ing-${r.application_id}`}>Constancia de ingreso</Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {!rows.length && <tr><td className="p-4 text-center text-gray-500" colSpan={5}>Sin registros</td></tr>}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}
