// src/modules/academic/EnrollmentPaymentGate.jsx
/**
 * Gate de pago de matrícula.
 * Bloquea la matrícula hasta que el estudiante suba un voucher
 * y finanzas lo apruebe.
 */
import { useState, useEffect, useCallback } from "react";
import {
    Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    AlertTriangle, CheckCircle, Clock, Upload, Eye,
    DollarSign, CreditCard, FileText, RefreshCw, XCircle, Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { EnrollmentPayment } from "@/services/academic.service";

const CHANNEL_OPTIONS = [
    { value: "PAGALO",          label: "Págalo.pe" },
    { value: "CAJERO_MULTIRED", label: "Cajero Multired" },
    { value: "AGENCIA_BN",     label: "Agencia Banco de la Nación" },
];

export default function EnrollmentPaymentGate({ period, onPaymentApproved }) {
    // ── Estado ──
    const [loading, setLoading]           = useState(true);
    const [submitting, setSubmitting]     = useState(false);
    const [paymentInfo, setPaymentInfo]   = useState(null);
    const [editingPending, setEditingPending] = useState(false);

    // form
    const [channel, setChannel]           = useState("");
    const [operationCode, setOperationCode] = useState("");
    const [voucherFile, setVoucherFile]   = useState(null);

    // ── Fetch status ──
    const fetchStatus = useCallback(async () => {
        try {
            setLoading(true);
            const data = await EnrollmentPayment.status({ period });
            setPaymentInfo(data);

            if (data?.status === "APPROVED" && onPaymentApproved) {
                onPaymentApproved();
            }
        } catch (err) {
            toast.error(err.message || "Error al consultar estado de pago");
        } finally {
            setLoading(false);
        }
    }, [period, onPaymentApproved]);

    useEffect(() => {
        if (period) fetchStatus();
    }, [period, fetchStatus]);

    // ── Upload voucher ──
    const handleUpload = async (e) => {
        e.preventDefault();
        if (!channel) { toast.error("Selecciona un canal de pago"); return; }
        if (!voucherFile) { toast.error("Selecciona un archivo de voucher"); return; }

        try {
            setSubmitting(true);
            const fd = new FormData();
            fd.append("period", period);
            fd.append("channel", channel);
            fd.append("operation_code", operationCode);
            fd.append("voucher", voucherFile);

            const isReUpload = paymentInfo?.status === "REJECTED" || paymentInfo?.status === "PENDING";
            if (isReUpload) {
                await EnrollmentPayment.reUpload(fd);
            } else {
                await EnrollmentPayment.upload(fd);
            }
            toast.success("Voucher enviado correctamente");
            setChannel(""); setOperationCode(""); setVoucherFile(null);
            setEditingPending(false);
            await fetchStatus();
        } catch (err) {
            toast.error(err.message || "Error al subir voucher");
        } finally {
            setSubmitting(false);
        }
    };

    // ── Loading ──
    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
                <span className="ml-2 text-slate-500">Verificando estado de pago...</span>
            </div>
        );
    }

    const status = paymentInfo?.status || "NOT_STARTED";

    // ── APPROVED → no bloquear ──
    if (status === "APPROVED") {
        return (
            <Card className="border-l-4 border-l-green-500 mb-6">
                <CardContent className="py-4">
                    <div className="flex items-center gap-3">
                        <CheckCircle className="h-6 w-6 text-green-600" />
                        <div>
                            <p className="font-semibold text-green-800">Pago Verificado</p>
                            <p className="text-sm text-slate-500">
                                Monto: S/. {Number(paymentInfo?.total || paymentInfo?.amount || 0).toFixed(2)}
                                {paymentInfo?.reviewed_at && (
                                    <> | Aprobado: {new Date(paymentInfo.reviewed_at).toLocaleDateString("es-PE")}</>
                                )}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // ── PENDING → esperando revisión ──
    if (status === "PENDING" && !editingPending) {
        return (
            <Card className="border-l-4 border-l-amber-500">
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-amber-600" />
                        <CardTitle className="text-lg text-amber-800">Voucher Enviado - En Revisión</CardTitle>
                    </div>
                    <CardDescription>
                        Tu voucher está siendo verificado por el área de finanzas.
                        Cuando sea aprobado podrás continuar con tu matrícula.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="bg-amber-50 rounded-lg p-4 space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-slate-600">Canal:</span>
                            <span className="font-medium">
                                {CHANNEL_OPTIONS.find(c => c.value === paymentInfo?.channel)?.label || paymentInfo?.channel}
                            </span>
                        </div>
                        {paymentInfo?.operation_code && (
                            <div className="flex justify-between">
                                <span className="text-slate-600">Nro. Operación:</span>
                                <span className="font-medium">{paymentInfo.operation_code}</span>
                            </div>
                        )}
                        <div className="flex justify-between">
                            <span className="text-slate-600">Monto:</span>
                            <span className="font-medium">S/. {Number(paymentInfo?.total || paymentInfo?.amount || 0).toFixed(2)}</span>
                        </div>
                        {paymentInfo?.discount_tag === "PRIMER_PUESTO" && (
                            <div className="flex justify-between">
                                <span className="text-slate-600">Descuento:</span>
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                    1er Puesto
                                </Badge>
                            </div>
                        )}
                        <div className="flex justify-between">
                            <span className="text-slate-600">Enviado:</span>
                            <span className="font-medium">
                                {paymentInfo?.created_at
                                    ? new Date(paymentInfo.created_at).toLocaleString("es-PE")
                                    : "-"}
                            </span>
                        </div>
                        {paymentInfo?.voucher_url && (
                            <div className="pt-2">
                                <a
                                    href={paymentInfo.voucher_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
                                >
                                    <Eye className="h-4 w-4" /> Ver voucher
                                </a>
                            </div>
                        )}
                    </div>

                    <div className="mt-4 flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => {
                            setEditingPending(true);
                            setChannel(paymentInfo?.channel || "");
                            setOperationCode(paymentInfo?.operation_code || "");
                        }}>
                            <Pencil className="h-4 w-4 mr-1" />
                            Modificar voucher
                        </Button>
                        <Button variant="outline" size="sm" onClick={fetchStatus} disabled={loading}>
                            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
                            Actualizar estado
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // ── REJECTED / NOT_STARTED / editingPending → formulario ──
    const isRejected = status === "REJECTED";
    const isEditing  = editingPending && status === "PENDING";

    return (
        <Card className={`border-l-4 ${isEditing ? "border-l-amber-500" : "border-l-blue-500"}`}>
            <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                    {isEditing
                        ? <Pencil className="h-5 w-5 text-amber-600" />
                        : <AlertTriangle className="h-5 w-5 text-blue-600" />
                    }
                    <CardTitle className="text-lg">
                        {isEditing ? "Modificar Voucher" : "Pago de Matrícula Requerido"}
                    </CardTitle>
                </div>
                <CardDescription>
                    {isEditing
                        ? "Sube un nuevo voucher para reemplazar el actual."
                        : "Para continuar con tu matrícula, realiza el pago en el Banco de la Nación y sube tu voucher."
                    }
                </CardDescription>
            </CardHeader>
            <CardContent>
                {/* Nota sutil si fue rechazado antes */}
                {isRejected && paymentInfo?.rejection_note && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm">
                        <p className="text-amber-800">
                            <span className="font-medium">Nota:</span> {paymentInfo.rejection_note}
                        </p>
                    </div>
                )}

                {/* Info de monto */}
                <div className="bg-slate-50 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-2 mb-3">
                        <DollarSign className="h-5 w-5 text-slate-600" />
                        <span className="font-semibold text-slate-800">Detalle de Pago</span>
                    </div>
                    <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                            <span className="text-slate-600">Monto base:</span>
                            <span className="font-medium">S/. {Number(paymentInfo?.amount || 180).toFixed(2)}</span>
                        </div>
                        {paymentInfo?.discount_tag === "PRIMER_PUESTO" && (
                            <div className="flex justify-between text-blue-700">
                                <span>Descuento 1er Puesto:</span>
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                                    Aplicado
                                </Badge>
                            </div>
                        )}
                        {Number(paymentInfo?.surcharge || 0) > 0 && (
                            <div className="flex justify-between text-amber-700">
                                <span>Recargo extemporáneo:</span>
                                <span className="font-medium">+ S/. {Number(paymentInfo.surcharge).toFixed(2)}</span>
                            </div>
                        )}
                        <hr className="my-2" />
                        <div className="flex justify-between text-base font-bold">
                            <span>Total a pagar:</span>
                            <span>S/. {Number(paymentInfo?.total || paymentInfo?.amount || 180).toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                {/* Canales de pago */}
                <div className="bg-blue-50 rounded-lg p-3 mb-4 text-sm text-blue-800">
                    <p className="font-medium mb-1 flex items-center gap-1">
                        <CreditCard className="h-4 w-4" /> Canales de pago disponibles:
                    </p>
                    <ul className="list-disc list-inside space-y-0.5 text-blue-700">
                        <li>Págalo.pe (pago en línea)</li>
                        <li>Cajero Multired (con código de pago)</li>
                        <li>Agencia del Banco de la Nación (ventanilla)</li>
                    </ul>
                </div>

                {/* Formulario */}
                <form onSubmit={handleUpload} className="space-y-4">
                    {/* Canal */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Canal de pago <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={channel}
                            onChange={e => setChannel(e.target.value)}
                            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            required
                        >
                            <option value="">Seleccionar canal...</option>
                            {CHANNEL_OPTIONS.map(ch => (
                                <option key={ch.value} value={ch.value}>{ch.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Nro. Operación */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Nro. de Operación
                        </label>
                        <Input
                            value={operationCode}
                            onChange={e => setOperationCode(e.target.value)}
                            placeholder="Ej: 190000475205"
                            className="text-sm"
                        />
                    </div>

                    {/* Voucher */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Voucher de pago <span className="text-red-500">*</span>
                        </label>
                        <div className="flex items-center gap-2">
                            <label className="flex-1 cursor-pointer">
                                <div className="flex items-center justify-center gap-2 rounded-md border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600 hover:border-blue-400 hover:bg-blue-50 transition-colors">
                                    <Upload className="h-4 w-4" />
                                    {voucherFile ? voucherFile.name : "Seleccionar archivo (imagen o PDF)"}
                                </div>
                                <input
                                    type="file"
                                    className="hidden"
                                    accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                                    onChange={e => setVoucherFile(e.target.files?.[0] || null)}
                                />
                            </label>
                            {voucherFile && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setVoucherFile(null)}
                                    className="text-slate-400 hover:text-red-500"
                                >
                                    <XCircle className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                            Formatos: JPG, PNG, WebP, PDF. Máximo 5 MB.
                        </p>
                    </div>

                    {/* Submit */}
                    <div className="flex gap-2">
                        {isEditing && (
                            <Button
                                type="button"
                                variant="outline"
                                className="flex-1"
                                onClick={() => { setEditingPending(false); setVoucherFile(null); }}
                            >
                                Cancelar
                            </Button>
                        )}
                        <Button
                            type="submit"
                            className="flex-1"
                            disabled={submitting || !channel || !voucherFile}
                        >
                            {submitting ? (
                                <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Enviando...</>
                            ) : (
                                <><FileText className="h-4 w-4 mr-2" /> {isEditing ? "Reemplazar Voucher" : "Enviar Voucher"}</>
                            )}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
