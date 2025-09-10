// src/modules/admission/ApplicationWizard.jsx
import React, { useEffect, useState } from "react";
import { AdmissionCalls, Applications, ApplicationPayment, ApplicantDocs } from "../../services/admission.service";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Badge } from "../../components/ui/badge";
import { toast } from "sonner";

const STEPS = { CALL: 1, PAYMENT: 2, DOCS: 3, REVIEW: 4 };

export default function ApplicationWizard() {
    const [step, setStep] = useState(STEPS.CALL);
    const [calls, setCalls] = useState([]);
    const [selectedCall, setSelectedCall] = useState(null);
    const [preferences, setPreferences] = useState([]); // [careerId,...]
    const [application, setApplication] = useState(null);
    const [payment, setPayment] = useState({ status: "PENDING", method: "PSP", checkout_url: null });
    const [requiredDocs, setRequiredDocs] = useState([]);
    const [docs, setDocs] = useState([]);

    useEffect(() => {
        AdmissionCalls.listPublic().then(d => {
            const list = d?.admission_calls || d || [];
            setCalls(list);
        });
    }, []);

    // Step 1: crear postulación
    const createApplication = async () => {
        if (!selectedCall) return toast.error("Seleccione una convocatoria");
        if (preferences.length === 0) return toast.error("Seleccione al menos una carrera");
        const payload = { admission_call_id: selectedCall.id, career_preferences: preferences };
        const res = await Applications.create(payload);
        setApplication(res?.application || res);
        setRequiredDocs(selectedCall.required_documents || []);
        toast.success("Preinscripción creada");
        setStep(STEPS.PAYMENT);
    };

    // Step 2: pago
    const startPayment = async () => {
        const { checkout_url, order_id } = await ApplicationPayment.start(application.id, payment.method);
        if (payment.method === "PSP" && checkout_url) {
            setPayment(p => ({ ...p, checkout_url }));
            window.open(checkout_url, "_blank");
        } else {
            toast.info(`Orden generada: ${order_id}. Pague en caja y confirme.`);
        }
    };

    const refreshPayment = async () => {
        const s = await ApplicationPayment.status(application.id);
        setPayment(p => ({ ...p, status: s.status }));
        if (s.status === "PAID") {
            toast.success("Pago confirmado");
            setStep(STEPS.DOCS);
        } else if (s.status === "FAILED") {
            toast.error("Pago fallido");
        } else {
            toast.message("Pago pendiente");
        }
    };

    // Step 3: documentos
    const fetchDocs = async () => {
        const d = await ApplicantDocs.listMine(application.id);
        setDocs(d?.documents || d || []);
    };
    useEffect(() => { if (application?.id && step === STEPS.DOCS) fetchDocs(); }, [application?.id, step]);

    const upload = async (docType, file) => {
        await ApplicantDocs.upload(application.id, docType, file);
        toast.success("Documento subido");
        fetchDocs();
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader><CardTitle>Postulación – Asistente</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                    {/* Paso */}
                    <div className="flex gap-2 text-xs">
                        <Badge variant={step >= STEPS.CALL ? "default" : "secondary"}>1. Convocatoria</Badge>
                        <Badge variant={step >= STEPS.PAYMENT ? "default" : "secondary"}>2. Pago</Badge>
                        <Badge variant={step >= STEPS.DOCS ? "default" : "secondary"}>3. Documentos</Badge>
                        <Badge variant={step >= STEPS.REVIEW ? "default" : "secondary"}>4. Revisión</Badge>
                    </div>

                    {step === STEPS.CALL && (
                        <div className="space-y-4">
                            <Label>Convocatoria</Label>
                            <Select onValueChange={(val) => setSelectedCall(calls.find(x => x.id.toString() === val))}>
                                <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
                                <SelectContent>
                                    {calls.map(c => (
                                        <SelectItem key={c.id} value={c.id.toString()}>
                                            {c.name} ({new Date(c.registration_start).toLocaleDateString()}–{new Date(c.registration_end).toLocaleDateString()})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {selectedCall && (
                                <>
                                    <Label className="mt-2">Carreras de preferencia</Label>
                                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
                                        {selectedCall.careers?.map(k => {
                                            const checked = preferences.includes(k.id);
                                            return (
                                                <label key={k.id} className="border rounded p-2 flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={(e) =>
                                                            setPreferences(prev => e.target.checked
                                                                ? [...prev, k.id]
                                                                : prev.filter(id => id !== k.id))}
                                                    />
                                                    <span className="text-sm">{k.name}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </>
                            )}

                            <div className="flex justify-end">
                                <Button onClick={createApplication} disabled={!selectedCall}>Continuar</Button>
                            </div>
                        </div>
                    )}

                    {step === STEPS.PAYMENT && application && (
                        <div className="space-y-4">
                            <div className="grid md:grid-cols-3 gap-4">
                                <div>
                                    <Label>Método de pago</Label>
                                    <Select value={payment.method} onValueChange={(v) => setPayment(p => ({ ...p, method: v }))}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="PSP">Pasarela (tarjeta/transferencia)</SelectItem>
                                            <SelectItem value="CASHIER">Caja (presencial)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Estado</Label>
                                    <Input readOnly value={payment.status} />
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <Button onClick={startPayment}>Generar pago</Button>
                                <Button variant="outline" onClick={refreshPayment}>Actualizar estado</Button>
                                <Button variant="outline" disabled={payment.status !== "PAID"} onClick={() => setStep(STEPS.DOCS)}>
                                    Continuar
                                </Button>
                            </div>
                        </div>
                    )}

                    {step === STEPS.DOCS && application && (
                        <div className="space-y-4">
                            <Label>Documentos requeridos</Label>
                            <div className="space-y-3">
                                {requiredDocs.map((t) => {
                                    const existing = docs.find(d => d.document_type === t);
                                    return (
                                        <div key={t} className="flex items-center justify-between border rounded p-2">
                                            <div className="text-sm">
                                                <div className="font-medium">
                                                    {t === "BIRTH_CERTIFICATE" && "Partida de nacimiento"}
                                                    {t === "STUDY_CERTIFICATE" && "Certificado de estudios"}
                                                    {t === "PHOTO" && "Fotografía"}
                                                    {t === "DNI_COPY" && "Copia de DNI"}
                                                    {t === "CONADIS_COPY" && "Copia carné CONADIS"}
                                                </div>
                                                {existing && <div className="text-xs text-gray-500">
                                                    Estado: {existing.review_status || "UPLOADED"}
                                                </div>}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input type="file" onChange={(e) => e.target.files?.[0] && upload(t, e.target.files[0])} />
                                                {existing && <Badge variant="outline">Subido</Badge>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={fetchDocs}>Refrescar</Button>
                                <Button onClick={() => setStep(STEPS.REVIEW)}>Continuar</Button>
                            </div>
                        </div>
                    )}

                    {step === STEPS.REVIEW && (
                        <div className="space-y-2">
                            <p className="text-sm text-gray-600">
                                Revise que su **pago** esté confirmado y que todos los **documentos** estén cargados.
                            </p>
                            <div className="flex justify-end">
                                <Button onClick={() => toast.success("Postulación lista. Recibirá notificaciones de evaluación y resultados.")}>
                                    Finalizar
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
