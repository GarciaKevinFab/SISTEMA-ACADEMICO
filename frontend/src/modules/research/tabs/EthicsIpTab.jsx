import React, { useEffect, useState, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../../../components/ui/select";
import { toast } from "sonner";
import { EthicsIP } from "../../../services/research.service";
import { Upload, Save, FileText } from "lucide-react";

export default function EthicsIpTab({ projectId }) {
    const [ethics, setEthics] = useState({ status: "PENDIENTE", committee: "", approval_code: "", approval_date: "" });
    const [ethDoc, setEthDoc] = useState(null);
    const [ip, setIp] = useState({ status: "NINGUNO", type: "", registry_code: "", holder: "" });
    const [ipDoc, setIpDoc] = useState(null);
    const [loaded, setLoaded] = useState(false);

    const load = useCallback(async () => {
        try {
            const d = await EthicsIP.get(projectId);
            if (d?.ethics) setEthics(d.ethics);
            if (d?.ip) setIp(d.ip);
            setLoaded(true);
        } catch (_) { setLoaded(true); }
    }, [projectId]);

    useEffect(() => { load(); }, [load]);

    const saveEthics = async () => {
        try { await EthicsIP.setEthics(projectId, ethics); toast.success("Ética guardada"); if (ethDoc) { await EthicsIP.uploadEthicsDoc(projectId, ethDoc); setEthDoc(null); toast.success("Documento de ética cargado"); } }
        catch (e) { toast.error(e.message || "No se pudo guardar ética"); }
    };

    const saveIP = async () => {
        try { await EthicsIP.setIP(projectId, ip); toast.success("IPI guardada"); if (ipDoc) { await EthicsIP.uploadIPDoc(projectId, ipDoc); setIpDoc(null); toast.success("Documento IPI cargado"); } }
        catch (e) { toast.error(e.message || "No se pudo guardar IPI"); }
    };

    if (!loaded) return <div className="h-32 flex items-center justify-center"><div className="animate-spin h-10 w-10 rounded-full border-b-2 border-blue-600" /></div>;

    return (
        <div className="grid md:grid-cols-2 gap-4">
            <Card>
                <CardHeader><CardTitle>Comité de Ética</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                    <div>
                        <Label>Estado</Label>
                        <Select value={ethics.status} onValueChange={v => setEthics({ ...ethics, status: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                                <SelectItem value="EN_TRAMITE">En trámite</SelectItem>
                                <SelectItem value="APROBADO">Aprobado</SelectItem>
                                <SelectItem value="OBSERVADO">Observado</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div><Label>Comité</Label><Input value={ethics.committee} onChange={e => setEthics({ ...ethics, committee: e.target.value })} /></div>
                    <div><Label>Código de aprobación</Label><Input value={ethics.approval_code} onChange={e => setEthics({ ...ethics, approval_code: e.target.value })} /></div>
                    <div><Label>Fecha aprobación</Label><Input type="date" value={ethics.approval_date?.slice(0, 10) || ""} onChange={e => setEthics({ ...ethics, approval_date: e.target.value })} /></div>
                    <div className="flex items-center gap-2">
                        <label className="cursor-pointer inline-flex items-center gap-1"><Upload className="h-4 w-4" /><input type="file" className="hidden" onChange={e => setEthDoc(e.target.files?.[0] || null)} /></label>
                        <Button onClick={saveEthics}><Save className="h-4 w-4 mr-2" />Guardar</Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>Propiedad Intelectual</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                    <div>
                        <Label>Estado</Label>
                        <Select value={ip.status} onValueChange={v => setIp({ ...ip, status: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="NINGUNO">Ninguno</SelectItem>
                                <SelectItem value="EN_TRAMITE">En trámite</SelectItem>
                                <SelectItem value="REGISTRADO">Registrado</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div><Label>Tipo (Patente/Software/Marca)</Label><Input value={ip.type} onChange={e => setIp({ ...ip, type: e.target.value })} /></div>
                    <div><Label>Código registro</Label><Input value={ip.registry_code} onChange={e => setIp({ ...ip, registry_code: e.target.value })} /></div>
                    <div><Label>Titular</Label><Input value={ip.holder} onChange={e => setIp({ ...ip, holder: e.target.value })} /></div>
                    <div className="flex items-center gap-2">
                        <label className="cursor-pointer inline-flex items-center gap-1"><FileText className="h-4 w-4" /><input type="file" className="hidden" onChange={e => setIpDoc(e.target.files?.[0] || null)} /></label>
                        <Button onClick={saveIP}><Save className="h-4 w-4 mr-2" />Guardar</Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
