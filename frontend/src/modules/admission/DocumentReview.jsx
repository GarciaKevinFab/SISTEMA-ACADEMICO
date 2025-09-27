import React, { useEffect, useState } from "react";
import { AdmissionCalls, Evaluation, ApplicantDocs, Applications } from "../../services/admission.service";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Badge } from "../../components/ui/badge";
import { toast } from "sonner";

const statusColor = (s) =>
    s === "APPROVED" ? "bg-green-100 text-green-700" :
        s === "REJECTED" ? "bg-red-100 text-red-700" :
            s === "OBSERVED" ? "bg-amber-100 text-amber-700" :
                "bg-gray-100 text-gray-700";

export default function DocumentReview() {
    const [calls, setCalls] = useState([]);
    const [call, setCall] = useState(null);
    const [careerId, setCareerId] = useState("");
    const [apps, setApps] = useState([]);
    const [current, setCurrent] = useState(null); // application actual
    const [docs, setDocs] = useState([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        AdmissionCalls.listAdmin().then((d) => {
            const list = d?.admission_calls || d?.calls || d || [];
            setCalls(list);
            setCall(list[0] || null);
        }).catch(() => toast.error("No se pudo cargar convocatorias"));
    }, []);

    const loadApplications = async () => {
        if (!call || !careerId) return;
        const data = await Applications.list({ call_id: call.id, career_id: careerId });
        const list = data?.applications || data || [];
        setApps(list);
        setCurrent(list[0] || null);
    };

    useEffect(() => { if (call && careerId) loadApplications(); }, [call?.id, careerId]);

    const loadDocs = async () => {
        if (!current?.id) return;
        const d = await ApplicantDocs.list(current.id);
        setDocs(d || []);
    };
    useEffect(() => { loadDocs(); }, [current?.id]);

    const setReview = async (docId, review_status, observations = "") => {
        setSaving(true);
        try {
            await ApplicantDocs.review(current.id, docId, { review_status, observations });
            toast.success("Revisión guardada");
            loadDocs();
        } catch (e) {
            toast.error(e?.response?.data?.detail || "No se pudo actualizar");
        } finally {
            setSaving(false);
        }
    };

    const markComplete = async () => {
        const allApproved = docs.length > 0 && docs.every(d => d.review_status === "APPROVED");
        if (!allApproved) {
            toast.error("Aún hay documentos pendientes/observados/rechazados.");
            return;
        }
        // No hay endpoint en el backend stub: dejamos un éxito local.
        toast.success("Expediente validado (sincronización pendiente con backend real).");
    };

    return (
        <Card>
            <CardHeader><CardTitle>Revisión de Documentos</CardTitle></CardHeader>
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
                        <Button variant="outline" onClick={loadApplications}>Refrescar</Button>
                        <Button variant="outline" disabled={!current} onClick={markComplete} data-testid="btn-mark-complete">
                            Marcar expediente completo
                        </Button>
                    </div>
                </div>

                <div className="grid lg:grid-cols-3 gap-4">
                    {/* Lista de expedientes */}
                    <div className="lg:col-span-1 border rounded-lg overflow-hidden">
                        <div className="p-2 bg-gray-50 text-xs font-medium">Expedientes</div>
                        <div className="max-h-[420px] overflow-y-auto">
                            {apps.map(a => (
                                <button
                                    key={a.id}
                                    className={`w-full text-left p-3 border-b hover:bg-gray-50 ${current?.id === a.id ? "bg-blue-50" : ""}`}
                                    onClick={() => setCurrent(a)}
                                >
                                    <div className="text-sm font-medium">{a.applicant_name}</div>
                                    <div className="text-xs text-gray-500">{a.application_number} · {a.status}</div>
                                </button>
                            ))}
                            {!apps.length && <div className="p-4 text-sm text-gray-500">Sin registros</div>}
                        </div>
                    </div>

                    {/* Detalle y documentos */}
                    <div className="lg:col-span-2 border rounded-lg">
                        {current ? (
                            <div className="p-4 space-y-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="font-semibold">{current.applicant_name}</div>
                                        <div className="text-xs text-gray-500">N° {current.application_number}</div>
                                    </div>
                                    <Badge variant="outline">{current.status}</Badge>
                                </div>

                                <div className="space-y-2">
                                    {docs.map(d => (
                                        <DocRow
                                            key={d.id}
                                            doc={d}
                                            onApprove={(obs) => setReview(d.id, "APPROVED", obs)}
                                            onReject={(obs) => setReview(d.id, "REJECTED", obs)}
                                            onObserve={(obs) => setReview(d.id, "OBSERVED", obs)}
                                            saving={saving}
                                        />
                                    ))}
                                    {!docs.length && <div className="text-sm text-gray-500">Sin documentos subidos.</div>}
                                </div>
                            </div>
                        ) : (
                            <div className="p-8 text-sm text-gray-500">Seleccione un expediente</div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function DocRow({ doc, onApprove, onReject, onObserve, saving }) {
    const [obs, setObs] = useState(doc?.observations || "");
    return (
        <div className="border rounded p-3">
            <div className="flex justify-between items-center">
                <div className="text-sm font-medium">{doc.document_type}</div>
                <Badge className={statusColor(doc.review_status)}>{doc.review_status || "UPLOADED"}</Badge>
            </div>
            <div className="mt-2 flex items-center justify-between gap-4">
                <a href={doc.url} target="_blank" rel="noreferrer" className="text-blue-600 text-sm underline">Ver archivo</a>
                <div className="flex-1">
                    <Textarea
                        rows={2}
                        placeholder="Observaciones (opcional)"
                        value={obs}
                        onChange={(e) => setObs(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={saving} onClick={() => onObserve(obs)} data-testid="doc-observe">Observar</Button>
                    <Button size="sm" variant="destructive" disabled={saving} onClick={() => onReject(obs)} data-testid="doc-reject">Rechazar</Button>
                    <Button size="sm" disabled={saving} onClick={() => onApprove(obs)} data-testid="doc-approve">Aprobar</Button>
                </div>
            </div>
        </div>
    );
}
