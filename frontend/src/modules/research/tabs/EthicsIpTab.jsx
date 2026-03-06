/**
 * tabs/EthicsIpTab.jsx
 * Gestión de ética y propiedad intelectual del proyecto
 */
import { useState, useEffect, useCallback } from "react";
import { EthicsIPService } from "../../../services/research.service";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
    Select, SelectContent, SelectItem,
    SelectTrigger, SelectValue,
} from "@/components/ui/select";

import { Save, Upload, FileText, ShieldCheck, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const ETHICS_STATUS = [
    { value: "NOT_REQUIRED", label: "No requerido" },
    { value: "PENDING", label: "Pendiente" },
    { value: "SUBMITTED", label: "Enviado" },
    { value: "APPROVED", label: "Aprobado" },
    { value: "REJECTED", label: "Rechazado" },
];

const IP_STATUS = [
    { value: "NONE", label: "Sin registro" },
    { value: "PENDING", label: "En trámite" },
    { value: "REGISTERED", label: "Registrado" },
];

const IP_TYPES = [
    { value: "COPYRIGHT", label: "Derechos de autor" },
    { value: "PATENT", label: "Patente" },
    { value: "TRADEMARK", label: "Marca registrada" },
    { value: "TRADE_SECRET", label: "Secreto comercial" },
    { value: "OTHER", label: "Otro" },
];

export default function EthicsIpTab({ projectId }) {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Formularios
    const [ethicsForm, setEthicsForm] = useState({
        status: "NOT_REQUIRED",
        committee: "",
        approval_code: "",
        approval_date: "",
        notes: "",
    });

    const [ipForm, setIpForm] = useState({
        status: "NONE",
        type: "COPYRIGHT",
        registry_code: "",
        holder: "",
        notes: "",
    });

    const [ethicsDocUrl, setEthicsDocUrl] = useState(null);
    const [ipDocUrl, setIpDocUrl] = useState(null);

    const load = useCallback(async () => {
        if (!projectId) return;
        setLoading(true);
        try {
            const data = await EthicsIPService.get(projectId);
            if (data.ethics && typeof data.ethics === "object") {
                setEthicsForm(prev => ({ ...prev, ...data.ethics }));
            }
            if (data.ip && typeof data.ip === "object") {
                setIpForm(prev => ({ ...prev, ...data.ip }));
            }
            setEthicsDocUrl(data.ethics_doc_url || data.ethics_doc || null);
            setIpDocUrl(data.ip_doc_url || data.ip_doc || null);
        } catch {
            // primer acceso: no hay registro aún
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => { load(); }, [load]);

    const saveEthics = async () => {
        setSaving(true);
        try {
            await EthicsIPService.setEthics(projectId, ethicsForm);
            toast.success("Ética guardada");
        } catch {
            toast.error("Error al guardar ética");
        } finally {
            setSaving(false);
        }
    };

    const saveIP = async () => {
        setSaving(true);
        try {
            await EthicsIPService.setIP(projectId, ipForm);
            toast.success("Propiedad intelectual guardada");
        } catch {
            toast.error("Error al guardar PI");
        } finally {
            setSaving(false);
        }
    };

    const uploadEthicsDoc = async (file) => {
        try {
            const res = await EthicsIPService.uploadEthicsDoc(projectId, file);
            toast.success("Documento de ética subido");
            setEthicsDocUrl(res.url || null);
            load();
        } catch {
            toast.error("Error al subir documento");
        }
    };

    const uploadIpDoc = async (file) => {
        try {
            const res = await EthicsIPService.uploadIPDoc(projectId, file);
            toast.success("Documento PI subido");
            setIpDocUrl(res.url || null);
            load();
        } catch {
            toast.error("Error al subir documento");
        }
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin" />
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {/* ── Ética ── */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-emerald-600" />
                        Comité de Ética
                    </CardTitle>
                    <Button size="sm" onClick={saveEthics} disabled={saving}>
                        <Save className="h-3.5 w-3.5 mr-1" /> Guardar
                    </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-slate-500">Estado</label>
                            <Select
                                value={ethicsForm.status}
                                onValueChange={(v) => setEthicsForm(p => ({ ...p, status: v }))}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {ETHICS_STATUS.map(s => (
                                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-xs text-slate-500">Comité evaluador</label>
                            <Input
                                value={ethicsForm.committee}
                                onChange={(e) => setEthicsForm(p => ({ ...p, committee: e.target.value }))}
                                placeholder="Nombre del comité"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-slate-500">Código de aprobación</label>
                            <Input
                                value={ethicsForm.approval_code}
                                onChange={(e) => setEthicsForm(p => ({ ...p, approval_code: e.target.value }))}
                            />
                        </div>
                        <div>
                            <label className="text-xs text-slate-500">Fecha de aprobación</label>
                            <Input
                                type="date"
                                value={ethicsForm.approval_date || ""}
                                onChange={(e) => setEthicsForm(p => ({ ...p, approval_date: e.target.value }))}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-slate-500">Observaciones</label>
                        <Textarea
                            rows={2}
                            value={ethicsForm.notes || ""}
                            onChange={(e) => setEthicsForm(p => ({ ...p, notes: e.target.value }))}
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <label className="cursor-pointer inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700">
                            <Upload className="h-3.5 w-3.5" />
                            Subir documento
                            <input
                                type="file"
                                className="hidden"
                                onChange={(e) => {
                                    if (e.target.files[0]) uploadEthicsDoc(e.target.files[0]);
                                }}
                            />
                        </label>
                        {ethicsDocUrl && (
                            <a href={ethicsDocUrl} target="_blank" rel="noreferrer"
                                className="text-sm text-emerald-600 inline-flex items-center gap-1">
                                <FileText className="h-3.5 w-3.5" /> Ver documento
                                <ExternalLink className="h-3 w-3" />
                            </a>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* ── Propiedad Intelectual ── */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="h-4 w-4 text-indigo-600" />
                        Propiedad Intelectual
                    </CardTitle>
                    <Button size="sm" onClick={saveIP} disabled={saving}>
                        <Save className="h-3.5 w-3.5 mr-1" /> Guardar
                    </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-slate-500">Estado</label>
                            <Select
                                value={ipForm.status}
                                onValueChange={(v) => setIpForm(p => ({ ...p, status: v }))}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {IP_STATUS.map(s => (
                                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-xs text-slate-500">Tipo de protección</label>
                            <Select
                                value={ipForm.type}
                                onValueChange={(v) => setIpForm(p => ({ ...p, type: v }))}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {IP_TYPES.map(t => (
                                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-slate-500">Código de registro</label>
                            <Input
                                value={ipForm.registry_code}
                                onChange={(e) => setIpForm(p => ({ ...p, registry_code: e.target.value }))}
                            />
                        </div>
                        <div>
                            <label className="text-xs text-slate-500">Titular</label>
                            <Input
                                value={ipForm.holder}
                                onChange={(e) => setIpForm(p => ({ ...p, holder: e.target.value }))}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-slate-500">Observaciones</label>
                        <Textarea
                            rows={2}
                            value={ipForm.notes || ""}
                            onChange={(e) => setIpForm(p => ({ ...p, notes: e.target.value }))}
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <label className="cursor-pointer inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700">
                            <Upload className="h-3.5 w-3.5" />
                            Subir documento
                            <input
                                type="file"
                                className="hidden"
                                onChange={(e) => {
                                    if (e.target.files[0]) uploadIpDoc(e.target.files[0]);
                                }}
                            />
                        </label>
                        {ipDocUrl && (
                            <a href={ipDocUrl} target="_blank" rel="noreferrer"
                                className="text-sm text-indigo-600 inline-flex items-center gap-1">
                                <FileText className="h-3.5 w-3.5" /> Ver documento
                                <ExternalLink className="h-3 w-3" />
                            </a>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}