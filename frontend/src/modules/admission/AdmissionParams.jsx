// src/modules/admission/AdmissionParams.jsx
import React, { useEffect, useState } from "react";
import { AdmissionParams } from "../../services/admission.service";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Label } from "../../components/ui/label";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";

const ALL_DOCS = ["BIRTH_CERTIFICATE", "STUDY_CERTIFICATE", "PHOTO", "DNI_COPY", "CONADIS_COPY"];

const DEFAULT_PARAMS = {
    min_age: 16,
    max_age: 35,
    required_documents: ["BIRTH_CERTIFICATE", "STUDY_CERTIFICATE", "PHOTO", "DNI_COPY"],
};

const normalize = (raw) => {
    const rd = Array.isArray(raw?.required_documents) ? raw.required_documents : DEFAULT_PARAMS.required_documents;
    return {
        ...DEFAULT_PARAMS,
        ...raw,
        required_documents: rd,
    };
};

export default function AdmissionParamsModule() {
    const [params, setParams] = useState(DEFAULT_PARAMS);

    useEffect(() => {
        AdmissionParams.get()
            .then((d) => setParams((prev) => normalize({ ...prev, ...(d || {}) })))
            .catch(() => setParams((prev) => normalize(prev)));
        // eslint-disable-next-line
    }, []);

    const toggleDoc = (d) => {
        setParams((p) => {
            const list = Array.isArray(p?.required_documents) ? p.required_documents : [];
            return {
                ...p,
                required_documents: list.includes(d) ? list.filter((x) => x !== d) : [...list, d],
            };
        });
    };

    const save = async () => {
        await AdmissionParams.save(normalize(params));
        // usa tu propio toast si quieres; lo quité para que el snippet quede autocontenible
        // toast.success("Parámetros guardados");
    };

    const reqDocs = Array.isArray(params?.required_documents) ? params.required_documents : [];

    return (
        <Card>
            <CardHeader>
                <CardTitle>Parámetros de Admisión</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-3">
                    <div>
                        <Label>Edad mínima</Label>
                        <Input
                            type="number"
                            value={params?.min_age ?? DEFAULT_PARAMS.min_age}
                            onChange={(e) => setParams((p) => ({ ...p, min_age: parseInt(e.target.value) || 0 }))}
                        />
                    </div>
                    <div>
                        <Label>Edad máxima</Label>
                        <Input
                            type="number"
                            value={params?.max_age ?? DEFAULT_PARAMS.max_age}
                            onChange={(e) => setParams((p) => ({ ...p, max_age: parseInt(e.target.value) || 0 }))}
                        />
                    </div>
                </div>

                <div>
                    <Label>Documentos requeridos (plantilla)</Label>
                    <div className="grid md:grid-cols-2 gap-2 mt-2">
                        {ALL_DOCS.map((d) => (
                            <label key={d} className="border rounded p-2 flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={reqDocs.includes(d)} onChange={() => toggleDoc(d)} />
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
