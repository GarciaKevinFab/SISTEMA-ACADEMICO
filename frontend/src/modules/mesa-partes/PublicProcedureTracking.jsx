// src/modules/mesa-partes/PublicProcedureTracking.jsx
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { Search, FileText } from "lucide-react";
import { toast } from "sonner";
import { PublicProcedures } from "../../services/mesaPartes.service";
import { generatePDFWithPolling, downloadFile } from "../../utils/pdfQrPolling";

export default function PublicProcedureTracking() {
    const [code, setCode] = useState("");
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    const searchByCode = async () => {
        if (!code.trim()) return;
        setLoading(true);
        try {
            const res = await PublicProcedures.track(code.trim());
            setData(res?.procedure || res || null);
            if (!res) toast.error("No se encontró el expediente");
        } catch (e) { toast.error(e.message || "Error"); } finally { setLoading(false); }
    };

    const downloadCargo = async () => {
        if (!data?.id) return;
        try {
            const r = await generatePDFWithPolling(`/procedures/${data.id}/cargo`, {}, { testId: "cargo-pdf-public" });
            if (r.success) await downloadFile(r.downloadUrl, `cargo-${data.tracking_code}.pdf`);
        } catch { toast.error("No se pudo generar el cargo"); }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Consulta Pública de Expediente</CardTitle>
                    <CardDescription>Ingrese su código de seguimiento</CardDescription>
                </CardHeader>
                <CardContent className="flex gap-3">
                    <Input placeholder="Ej: MP-2025-000123" value={code} onChange={(e) => setCode(e.target.value)} />
                    <Button onClick={searchByCode} disabled={loading}>
                        <Search className="h-4 w-4 mr-2" /> Consultar
                    </Button>
                </CardContent>
            </Card>

            {data && (
                <Card>
                    <CardHeader>
                        <CardTitle>Expediente {data.tracking_code}</CardTitle>
                        <CardDescription>Última actualización: {data.updated_at ? new Date(data.updated_at).toLocaleString() : "-"}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div><b>Solicitante:</b> {data.applicant_name}</div>
                        <div><b>Tipo:</b> {data.procedure_type_name}</div>
                        <div><b>Estado:</b> <Badge>{data.status}</Badge></div>
                        <div><b>Oficina actual:</b> {data.current_office_name || "-"}</div>
                        <div><b>Vence:</b> {data.deadline_at ? new Date(data.deadline_at).toLocaleString() : "-"}</div>

                        <div className="mt-2">
                            <h4 className="font-semibold mb-2">Trazabilidad</h4>
                            <div className="space-y-2 max-h-[320px] overflow-y-auto">
                                {(data.timeline || []).map((ev, i) => (
                                    <div key={i} className="border rounded p-2 text-sm">
                                        <div className="text-xs text-gray-500">{new Date(ev.at).toLocaleString()}</div>
                                        <div><b>{ev.type}</b> — {ev.description}</div>
                                    </div>
                                ))}
                                {(!data.timeline || data.timeline.length === 0) && (
                                    <div className="text-sm text-gray-500">Sin eventos</div>
                                )}
                            </div>
                        </div>

                        <div className="pt-2">
                            <Button variant="outline" onClick={downloadCargo}>
                                <FileText className="h-4 w-4 mr-2" /> Descargar cargo
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
