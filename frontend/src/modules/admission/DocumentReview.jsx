import React, { useEffect, useState } from "react";
import { AdmissionCalls, ApplicantDocs, Applications } from "../../services/admission.service";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/textarea";
import { Badge } from "../../components/ui/badge";
import { toast } from "sonner";
import { FileText, Eye, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

/* ── Mapa de tipos de documento → etiqueta legible ── */
const DOC_LABELS = {
    FOTO_CARNET: "Foto Carnet",
    COPIA_DNI: "Copia DNI",
    PARTIDA_NACIMIENTO: "Partida de Nacimiento",
    CERTIFICADO_ESTUDIOS: "Certificado de Estudios",
    CARNET_CONADIS: "Carnet CONADIS",
    CERTIFICADO_SALUD: "Certificado de Salud",
    DECLARACION_JURADA: "Declaración Jurada",
    CONSTANCIA_INGRESO: "Constancia de Ingreso",
    VOUCHER_PAGO: "Voucher de Pago",
};

const docLabel = (type) => {
    if (!type) return "Documento";
    return DOC_LABELS[type] || type.replace(/_/g, " ");
};

const statusColor = (s) =>
    s === "APPROVED" ? "bg-green-100 text-green-700" :
        s === "REJECTED" ? "bg-red-100 text-red-700" :
            s === "OBSERVED" ? "bg-amber-100 text-amber-700" :
                "bg-gray-100 text-gray-700";

const statusIcon = (s) =>
    s === "APPROVED" ? <CheckCircle2 className="h-3.5 w-3.5" /> :
        s === "REJECTED" ? <XCircle className="h-3.5 w-3.5" /> :
            s === "OBSERVED" ? <AlertTriangle className="h-3.5 w-3.5" /> :
                null;

export default function DocumentReview() {
    const [calls, setCalls] = useState([]);
    const [call, setCall] = useState(null);
    const [careerId, setCareerId] = useState("");
    const [apps, setApps] = useState([]);
    const [current, setCurrent] = useState(null);
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
        toast.success("Expediente validado correctamente.");
    };

    return (
        <Card>
            <CardHeader><CardTitle>Revisión de Documentos</CardTitle></CardHeader>
            <CardContent className="space-y-4 px-4 sm:px-6">

                <div className="grid md:grid-cols-3 gap-3">
                    <div>
                        <label className="text-sm font-medium">Convocatoria</label>
                        <Select value={call?.id?.toString()} onValueChange={(v) => setCall(calls.find(x => x.id.toString() === v))}>
                            <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                            <SelectContent>
                                {calls.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <label className="text-sm font-medium">Carrera</label>
                        <Select value={careerId} onValueChange={setCareerId}>
                            <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                            <SelectContent>
                                {call?.careers?.map(k => <SelectItem key={k.id} value={k.id.toString()}>{k.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex flex-col md:flex-row md:items-end gap-2">
                        <Button className="w-full md:w-auto" variant="outline" onClick={loadApplications}>
                            Refrescar
                        </Button>
                        <Button
                            className="w-full md:w-auto"
                            variant="outline"
                            disabled={!current}
                            onClick={markComplete}
                            data-testid="btn-mark-complete"
                        >
                            Marcar expediente
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
                                    <div className="text-xs text-gray-500">#{a.application_number || a.id} · {a.status}</div>
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
                                        <div className="text-xs text-gray-500">N° {current.application_number || current.id}</div>
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

    // Resolver la URL del archivo: preferir url (normalizado), luego file_url
    const fileUrl = doc.url || doc.file_url || null;

    return (
        <div className="border rounded p-3">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-gray-400" />
                    <div className="text-sm font-medium">{docLabel(doc.document_type)}</div>
                    {doc.file_name && (
                        <span className="text-xs text-gray-400 truncate max-w-[200px]">({doc.file_name})</span>
                    )}
                </div>
                <Badge className={`${statusColor(doc.review_status)} gap-1`}>
                    {statusIcon(doc.review_status)}
                    {doc.review_status || "UPLOADED"}
                </Badge>
            </div>
            <div className="mt-2 flex items-center justify-between gap-4">
                {fileUrl ? (
                    <a
                        href={fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 text-sm underline flex items-center gap-1 shrink-0"
                    >
                        <Eye className="h-3.5 w-3.5" />
                        Ver archivo
                    </a>
                ) : (
                    <span className="text-gray-400 text-sm italic shrink-0">Sin archivo</span>
                )}
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
