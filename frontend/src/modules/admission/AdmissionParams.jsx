// src/modules/admission/AdmissionParams.jsx
import React, { useEffect, useState } from "react";
import { AdmissionParams } from "../../services/admission.service";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Label } from "../../components/ui/label";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { toast } from "sonner";

const ALL_DOCS = ["BIRTH_CERTIFICATE", "STUDY_CERTIFICATE", "PHOTO", "DNI_COPY", "CONADIS_COPY"];

export default function AdmissionParamsModule() {
    const [params, setParams] = useState({ min_age: 16, max_age: 35, required_documents: ["BIRTH_CERTIFICATE", "STUDY_CERTIFICATE", "PHOTO", "DNI_COPY"] });

    useEffect(() => { AdmissionParams.get().then(d => setParams(d || params)); /* eslint-disable-next-line */ }, []);

    const toggleDoc = (d) => {
        setParams(p => ({
            ...p,
            required_documents: p.required_documents.includes(d)
                ? p.required_documents.filter(x => x !== d)
                : [...p.required_documents, d]
        }));
    };

    const save = async () => {
        await AdmissionParams.save(params);
        toast.success("Parámetros guardados");
    };

    return (
        <Card>
            <CardHeader><CardTitle>Parámetros de Admisión</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-3">
                    <div>
                        <Label>Edad mínima</Label>
                        <Input type="number" value={params.min_age} onChange={e => setParams({ ...params, min_age: parseInt(e.target.value) || 0 })} />
                    </div>
                    <div>
                        <Label>Edad máxima</Label>
                        <Input type="number" value={params.max_age} onChange={e => setParams({ ...params, max_age: parseInt(e.target.value) || 0 })} />
                    </div>
                </div>

                <div>
                    <Label>Documentos requeridos (plantilla)</Label>
                    <div className="grid md:grid-cols-2 gap-2 mt-2">
                        {ALL_DOCS.map(d => (
                            <label key={d} className="border rounded p-2 flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={params.required_documents.includes(d)} onChange={() => toggleDoc(d)} />
                                {d}
                            </label>
                        ))}
                    </div>
                </div>

                <div className="flex justify-end">
                    <Button onClick={save}>Guardar</Button>
                </div>
            </CardContent>
        </Card>
    );
}
