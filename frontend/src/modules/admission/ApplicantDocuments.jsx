// src/modules/admission/ApplicantDocuments.jsx
import React, { useEffect, useState } from "react";
import { Applications, ApplicantDocs } from "../../services/admission.service";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";

export default function ApplicantDocuments() {
    const [apps, setApps] = useState([]);
    const [current, setCurrent] = useState(null);
    const [docs, setDocs] = useState([]);

    useEffect(() => {
        Applications.my().then(d => {
            const list = d?.applications || d || [];
            setApps(list);
            setCurrent(list[0] || null);
        });
    }, []);

    useEffect(() => {
        if (current?.id) ApplicantDocs.listMine(current.id).then(d => setDocs(d?.documents || d || []));
    }, [current?.id]);

    return (
        <Card>
            <CardHeader><CardTitle>Mis Documentos de Postulación</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <div className="flex gap-2 flex-wrap">
                    {apps.map(a => (
                        <Button key={a.id} variant={current?.id === a.id ? "default" : "outline"} onClick={() => setCurrent(a)}>
                            {a.application_number} – {a.admission_call?.name}
                        </Button>
                    ))}
                </div>

                <div className="space-y-2">
                    {docs.length === 0 && <p className="text-sm text-gray-500">Sin documentos</p>}
                    {docs.map(d => (
                        <div key={d.id} className="flex items-center justify-between border rounded p-2">
                            <div className="text-sm">
                                <div className="font-medium">{d.document_type}</div>
                                <div className="text-xs text-gray-500">Estado: {d.review_status}</div>
                                {d.observations && <div className="text-xs text-amber-600">Obs: {d.observations}</div>}
                            </div>
                            <div className="flex items-center gap-2">
                                <a className="text-sm text-blue-600 underline" href={d.url} target="_blank" rel="noreferrer">Ver</a>
                                <Badge variant={d.review_status === "APPROVED" ? "default" : "secondary"}>
                                    {d.review_status}
                                </Badge>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
