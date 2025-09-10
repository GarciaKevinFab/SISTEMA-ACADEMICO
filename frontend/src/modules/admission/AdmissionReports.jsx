// src/modules/admission/AdmissionReports.jsx
import React, { useState } from "react";
import { AdmissionReports } from "../../services/admission.service";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { toast } from "sonner";

export default function AdmissionReportsModule() {
    const [range, setRange] = useState({ from: "", to: "" });

    const download = async (resp, filename) => {
        const blob = new Blob([resp.data], { type: resp.headers["content-type"] });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <Card>
            <CardHeader><CardTitle>Reportes de Admisión</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-3">
                    <div>
                        <label className="text-sm">Desde</label>
                        <Input type="date" value={range.from} onChange={e => setRange({ ...range, from: e.target.value })} />
                    </div>
                    <div>
                        <label className="text-sm">Hasta</label>
                        <Input type="date" value={range.to} onChange={e => setRange({ ...range, to: e.target.value })} />
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={async () => {
                        const resp = await AdmissionReports.exportExcel(range);
                        await download(resp, "admission_report.xlsx");
                    }}>Exportar Excel (General)</Button>

                    <Button variant="outline" onClick={async () => {
                        const data = await AdmissionReports.summary(range);
                        toast.message(`Postulantes: ${data.total_applications || 0} – Admitidos: ${data.total_admitted || 0}`);
                    }}>Ver Resumen</Button>
                </div>
            </CardContent>
        </Card>
    );
}
