import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { toast } from "sonner";
import { ProcedureTypes, PublicIntake } from "../../services/mesaPartes.service";
import { FileText, CheckCircle } from "lucide-react";

export default function PublicProcedureIntake() {
    const [types, setTypes] = useState([]);
    const [created, setCreated] = useState(null);
    const [files, setFiles] = useState([]);

    const [form, setForm] = useState({
        procedure_type_id: "",
        applicant_name: "",
        applicant_document: "",
        applicant_email: "",
        applicant_phone: "",
        description: "",
    });

    useEffect(() => {
        ProcedureTypes.list().then((d) => setTypes(d?.procedure_types || d || []))
            .catch(() => toast.error("No se pudieron cargar los tipos de trámite"));
    }, []);

    const submit = async (e) => {
        e.preventDefault();
        try {
            const res = await PublicIntake.create({
                ...form,
                procedure_type_id: form.procedure_type_id ? Number(form.procedure_type_id) : null,
            });
            const proc = res?.procedure || res;
            setCreated(proc);
            toast.success("Trámite registrado correctamente");
        } catch (err) {
            toast.error(err?.message || "No se pudo registrar el trámite");
        }
    };

    const uploadAll = async () => {
        if (!created?.tracking_code) return;
        try {
            for (const f of files) {
                await PublicIntake.uploadFile(created.tracking_code, f);
            }
            toast.success("Archivos enviados");
        } catch {
            toast.error("Error al subir archivos");
        }
    };

    if (created) {
        return (
            <div className="p-6 max-w-3xl mx-auto">
                <Card>
                    <CardHeader>
                        <CardTitle>Su trámite fue registrado</CardTitle>
                        <CardDescription>Guarde este código para seguimiento y descarga de cargo</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="text-lg font-semibold flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-green-600" />
                            Código: {created.tracking_code}
                        </div>
                        <div className="space-y-2">
                            <Label>Adjuntar documentos (PDF/imagen)</Label>
                            <Input type="file" multiple accept="application/pdf,image/*" onChange={(e) => setFiles(Array.from(e.target.files || []))} />
                            <Button onClick={uploadAll} disabled={!files.length}>Enviar archivos</Button>
                        </div>
                        <div>
                            <a className="text-blue-600 underline" href={`/public/mesa-partes/track`}>
                                Ir a “Consulta pública de expediente”
                            </a>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-3xl mx-auto">
            <Card>
                <CardHeader>
                    <CardTitle>Mesa de Partes Virtual – Registro de Trámite</CardTitle>
                    <CardDescription>Complete el formulario para registrar su expediente</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={submit} className="space-y-4">
                        <div>
                            <Label>Tipo de trámite *</Label>
                            <Select value={form.procedure_type_id} onValueChange={(v) => setForm({ ...form, procedure_type_id: v })}>
                                <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
                                <SelectContent>
                                    {types.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><Label>Nombre completo *</Label><Input value={form.applicant_name} onChange={e => setForm({ ...form, applicant_name: e.target.value })} required /></div>
                            <div><Label>Documento *</Label><Input value={form.applicant_document} onChange={e => setForm({ ...form, applicant_document: e.target.value })} required /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><Label>Correo</Label><Input type="email" value={form.applicant_email} onChange={e => setForm({ ...form, applicant_email: e.target.value })} /></div>
                            <div><Label>Teléfono</Label><Input value={form.applicant_phone} onChange={e => setForm({ ...form, applicant_phone: e.target.value })} /></div>
                        </div>
                        <div>
                            <Label>Descripción</Label>
                            <Textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                        </div>
                        <div className="flex justify-end">
                            <Button type="submit"><FileText className="h-4 w-4 mr-2" />Registrar</Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
