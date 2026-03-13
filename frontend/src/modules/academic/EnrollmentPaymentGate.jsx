// src/modules/academic/EnrollmentPaymentGate.jsx
/**
 * Gate de pago de matrícula.
 * Bloquea la matrícula hasta que el estudiante suba un voucher
 * y finanzas lo apruebe.
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import {
    Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    AlertTriangle, CheckCircle, Clock, Upload, Eye,
    DollarSign, CreditCard, FileText, RefreshCw, XCircle, Pencil,
    AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { EnrollmentPayment } from "@/services/academic.service";

const CHANNEL_OPTIONS = [
    { value: "AGENCIA_BN",     label: "Agencia Banco de la Nación" },
    { value: "CAJERO_MULTIRED", label: "Cajero Multired" },
    { value: "PAGALO",          label: "Págalo.pe" },
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
    const [nroSecuencia, setNroSecuencia] = useState("");
    const [codigoCaja, setCodigoCaja]     = useState("");
    const [fechaMovimiento, setFechaMovimiento] = useState("");
    const [voucherFile, setVoucherFile]   = useState(null);

    // ── Preview del archivo seleccionado ──
    const voucherPreview = useMemo(() => {
        if (!voucherFile) return null;
        const isImage = voucherFile.type.startsWith("image/");
        const isPdf   = voucherFile.type === "application/pdf";
        const url     = URL.createObjectURL(voucherFile);
        return { url, isImage, isPdf, name: voucherFile.name, size: voucherFile.size };
    }, [voucherFile]);

    // Limpiar objectURL al desmontar o cambiar archivo
    useEffect(() => {
        return () => { if (voucherPreview?.url) URL.revokeObjectURL(voucherPreview.url); };
    }, [voucherPreview?.url]);

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
            fd.append("nro_secuencia", nroSecuencia);
            fd.append("codigo_caja", codigoCaja);
            if (fechaMovimiento) fd.append("fecha_movimiento", fechaMovimiento);
            fd.append("voucher", voucherFile);

            const isReUpload = paymentInfo?.status === "REJECTED" || paymentInfo?.status === "PENDING";
            if (isReUpload) {
                await EnrollmentPayment.reUpload(fd);
            } else {
                await EnrollmentPayment.upload(fd);
            }
            toast.success("Voucher enviado correctamente");
            setChannel(""); setOperationCode(""); setNroSecuencia(""); setCodigoCaja(""); setFechaMovimiento(""); setVoucherFile(null);
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

    const status    = paymentInfo?.status || "NOT_STARTED";
    const bankInfo  = paymentInfo?.bank_info || {};
    const bankName  = bankInfo.bank_name || "Banco de la Nación";
    const bankAcct  = bankInfo.bank_account || "";
    const bankHolder = bankInfo.bank_holder || "";
    const totalAmount = Number(paymentInfo?.total || paymentInfo?.amount || 180).toFixed(2);

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
                                Monto: S/. {totalAmount}
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
                    <div className="bg-amber-50 rounded-xl p-4 space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-slate-600">Canal:</span>
                            <span className="font-medium">
                                {CHANNEL_OPTIONS.find(c => c.value === paymentInfo?.channel)?.label || paymentInfo?.channel}
                            </span>
                        </div>
                        {paymentInfo?.nro_secuencia && (
                            <div className="flex justify-between">
                                <span className="text-slate-600">Nro. Secuencia:</span>
                                <span className="font-medium">{paymentInfo.nro_secuencia}</span>
                            </div>
                        )}
                        {paymentInfo?.codigo_caja && (
                            <div className="flex justify-between">
                                <span className="text-slate-600">Código de Caja:</span>
                                <span className="font-medium">{paymentInfo.codigo_caja}</span>
                            </div>
                        )}
                        {paymentInfo?.fecha_movimiento && (
                            <div className="flex justify-between">
                                <span className="text-slate-600">Fecha de Movimiento:</span>
                                <span className="font-medium">
                                    {new Date(paymentInfo.fecha_movimiento + "T00:00:00").toLocaleDateString("es-PE")}
                                </span>
                            </div>
                        )}
                        {paymentInfo?.operation_code && (
                            <div className="flex justify-between">
                                <span className="text-slate-600">Nro. Operación:</span>
                                <span className="font-medium">{paymentInfo.operation_code}</span>
                            </div>
                        )}
                        <div className="flex justify-between">
                            <span className="text-slate-600">Monto:</span>
                            <span className="font-medium">S/. {totalAmount}</span>
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
                            setNroSecuencia(paymentInfo?.nro_secuencia || "");
                            setCodigoCaja(paymentInfo?.codigo_caja || "");
                            setFechaMovimiento(paymentInfo?.fecha_movimiento || "");
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
            <CardContent className="space-y-5">
                {/* Nota rechazo */}
                {isRejected && paymentInfo?.rejection_note && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm">
                        <p className="text-red-800">
                            <span className="font-medium">Motivo de rechazo:</span> {paymentInfo.rejection_note}
                        </p>
                    </div>
                )}

                {/* Detalle de Pago */}
                <div className="bg-slate-50 rounded-xl p-5 space-y-3">
                    <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
                        <DollarSign className="h-5 w-5" />
                        Detalle de Pago
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
                            <span>S/. {totalAmount}</span>
                        </div>
                    </div>
                </div>

                {/* Datos para el Depósito */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-3">
                    <div className="flex items-center gap-2 text-blue-800 font-bold text-base">
                        <CreditCard className="h-5 w-5" />
                        Datos para el Depósito
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3 text-sm">
                        <div>
                            <span className="text-gray-500">Banco:</span>{" "}
                            <strong>{bankName}</strong>
                        </div>
                        <div>
                            <span className="text-gray-500">N° Cuenta:</span>{" "}
                            <strong className="text-blue-700 text-base">
                                {bankAcct || "(no configurado)"}
                            </strong>
                        </div>
                        {bankHolder && (
                            <div>
                                <span className="text-gray-500">Titular:</span>{" "}
                                <strong>{bankHolder}</strong>
                            </div>
                        )}
                        <div>
                            <span className="text-gray-500">Monto:</span>{" "}
                            <strong className="text-green-700 text-lg">S/. {totalAmount}</strong>
                        </div>
                    </div>
                </div>

                {/* Formulario */}
                <form onSubmit={handleUpload} className="space-y-5">
                    {/* Canal de pago */}
                    <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">
                            Canal de pago <span className="text-red-500">*</span>
                        </Label>
                        <Select value={channel} onValueChange={setChannel}>
                            <SelectTrigger className="h-11 rounded-xl">
                                <SelectValue placeholder="Seleccionar canal..." />
                            </SelectTrigger>
                            <SelectContent>
                                {CHANNEL_OPTIONS.map(ch => (
                                    <SelectItem key={ch.value} value={ch.value}>{ch.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Guía visual del voucher */}
                    <details className="group rounded-xl border border-indigo-200 bg-indigo-50/50">
                        <summary className="flex items-center gap-2 cursor-pointer px-4 py-3 text-sm font-medium text-indigo-700 hover:bg-indigo-100/50 rounded-xl transition-colors">
                            <Eye className="h-4 w-4" />
                            ¿Dónde encuentro los datos del voucher?
                            <span className="ml-auto text-xs text-indigo-400 group-open:hidden">Click para ver guía</span>
                        </summary>
                        <div className="px-4 pb-4 pt-2">
                            <p className="text-xs text-indigo-600 mb-3">
                                Ubique los siguientes datos en la parte inferior de su voucher de depósito del Banco de la Nación:
                            </p>
                            <div className="flex justify-center">
                                <img
                                    src="/guia-voucher-bn.png"
                                    alt="Guía de voucher - Banco de la Nación"
                                    className="max-w-full sm:max-w-sm rounded-lg border border-slate-200 shadow-sm"
                                />
                            </div>
                            <p className="text-[11px] text-indigo-500 mt-3 text-center">
                                Los datos resaltados en rojo son los que debe ingresar en el formulario.
                            </p>
                        </div>
                    </details>

                    {/* Datos del comprobante */}
                    <div className="grid sm:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-gray-700">
                                Nro. Secuencia <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                value={nroSecuencia}
                                onChange={e => setNroSecuencia(e.target.value)}
                                placeholder="Ej: 12345678"
                                className="h-11 rounded-xl"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-gray-700">
                                Código de Caja <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                value={codigoCaja}
                                onChange={e => setCodigoCaja(e.target.value)}
                                placeholder="Ej: 0041"
                                className="h-11 rounded-xl"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-gray-700">
                                Fecha de Movimiento <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                type="date"
                                value={fechaMovimiento}
                                onChange={e => setFechaMovimiento(e.target.value)}
                                className="h-11 rounded-xl"
                                required
                            />
                        </div>
                    </div>

                    {/* Voucher */}
                    <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">
                            Voucher de pago <span className="text-red-500">*</span>
                        </Label>
                        <div className="flex items-center gap-2">
                            <label className="flex-1 cursor-pointer">
                                <div className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600 hover:border-blue-400 hover:bg-blue-50 transition-colors">
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
                        <p className="text-xs text-slate-400">
                            Formatos: JPG, PNG, WebP, PDF. Máximo 5 MB.
                        </p>

                        {/* Preview */}
                        {voucherPreview && (
                            <div className="mt-2 rounded-xl border border-slate-200 overflow-hidden bg-white">
                                {voucherPreview.isImage && (
                                    <img
                                        src={voucherPreview.url}
                                        alt="Preview del voucher"
                                        className="w-full max-h-64 object-contain bg-slate-50"
                                    />
                                )}
                                {voucherPreview.isPdf && (
                                    <iframe
                                        src={voucherPreview.url}
                                        title="Preview del voucher PDF"
                                        className="w-full h-64 border-0"
                                    />
                                )}
                                <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                                    <span className="truncate mr-2">{voucherPreview.name}</span>
                                    <span className="shrink-0">{(voucherPreview.size / 1024 / 1024).toFixed(2)} MB</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Nota importante */}
                    <div className="flex gap-3 p-4 bg-amber-50/70 rounded-xl border border-amber-200">
                        <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="text-xs text-amber-700 space-y-1">
                            <p className="font-semibold text-amber-800">Importante:</p>
                            <p>Los datos del comprobante serán verificados por la oficina de finanzas.</p>
                            <p>Si los datos son incorrectos, su matrícula quedará pendiente hasta la verificación.</p>
                        </div>
                    </div>

                    {/* Botones */}
                    <div className="flex gap-2">
                        {isEditing && (
                            <Button
                                type="button"
                                variant="outline"
                                className="flex-1 rounded-xl"
                                onClick={() => { setEditingPending(false); setVoucherFile(null); setNroSecuencia(""); setCodigoCaja(""); setFechaMovimiento(""); }}
                            >
                                Cancelar
                            </Button>
                        )}
                        <Button
                            type="submit"
                            className="flex-1 rounded-xl"
                            disabled={submitting || !channel || !nroSecuencia || !codigoCaja || !fechaMovimiento || !voucherFile}
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
