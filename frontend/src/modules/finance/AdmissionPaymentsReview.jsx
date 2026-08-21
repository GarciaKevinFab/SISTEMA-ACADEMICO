// src/modules/finance/AdmissionPaymentsReview.jsx
/**
 * Panel de revisión de pagos de admisión para finanzas.
 * Permite ver, aprobar, rechazar y eliminar pagos de postulantes.
 */
import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
    Card, CardContent, CardHeader, CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import {
    CheckCircle, XCircle, Clock, Eye, Search,
    RefreshCw, FileText, Users, Paperclip,
    DollarSign, AlertTriangle, Image, Trash2, X,
    ZoomIn, ZoomOut, Download,
} from "lucide-react";
import { toast } from "../../utils/safeToast";
import { Payments, AdmissionCalls } from "../../services/admission.service";
import { formatApiError } from "../../utils/format";
import {
    AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
    AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from "../../components/ui/alert-dialog";

const showApiError = (e, fallback) => {
    const err = formatApiError(e, fallback);
    if (typeof err === "string") toast.error(err);
    else toast.error(err.title ?? (fallback || "Error"), { description: err.description });
};

const STATUS_BADGES = {
    PENDING_REVIEW: { className: "bg-amber-100 text-amber-700 border-amber-200", label: "Pendiente", Icon: Clock },
    STARTED:        { className: "bg-gray-100 text-gray-600 border-gray-200",     label: "Iniciado", Icon: Clock },
    PAID:           { className: "bg-green-100 text-green-700 border-green-200",   label: "Aprobado", Icon: CheckCircle },
    VOIDED:         { className: "bg-red-100 text-red-700 border-red-200",         label: "Anulado", Icon: XCircle },
};

// ── Detección de tipo de voucher (misma lógica que matrícula) ──
const isPdfVoucher = (url) => !!url && /\.pdf(\?|$)/i.test(url);
const isImageVoucher = (url) =>
    !!url && /\.(jpe?g|png|gif|webp|bmp|heic|heif)(\?|$)/i.test(url);

const CHANNEL_LABELS = {
    AGENCIA_BN: "Agencia BN",
    CAJERO_MULTIRED: "Cajero Multired",
    PAGALO: "Págalo.pe",
};

export default function AdmissionPaymentsReview() {
    const [callFilter, setCallFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("PENDING_REVIEW");
    const [search, setSearch] = useState("");
    const [payments, setPayments] = useState([]);
    const [summary, setSummary] = useState({});
    const [loading, setLoading] = useState(false);
    const [calls, setCalls] = useState([]);

    // Modals
    const [actionLoading, setActionLoading] = useState(false);
    const [previewPayment, setPreviewPayment] = useState(null);
    const [previewZoom, setPreviewZoom] = useState(1);
    const [previewImgError, setPreviewImgError] = useState(false);
    const [previewSrc, setPreviewSrc] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [deletingPayment, setDeletingPayment] = useState(null);
    const [voidingPayment, setVoidingPayment] = useState(null);

    // Load calls for filter
    useEffect(() => {
        AdmissionCalls.listAdmin()
            .then((data) => {
                const list = Array.isArray(data) ? data : data?.calls || [];
                setCalls(list);
            })
            .catch(() => {});
    }, []);

    // Fetch payments
    const fetchPayments = useCallback(async () => {
        try {
            setLoading(true);
            const params = {};
            if (callFilter) params.call_id = callFilter;
            if (statusFilter) params.status = statusFilter;
            if (search.trim()) params.search = search.trim();

            const resp = await Payments.list(params);
            setPayments(resp.payments || []);
            setSummary(resp.summary || {});
        } catch (e) {
            showApiError(e, "Error al cargar pagos");
        } finally {
            setLoading(false);
        }
    }, [callFilter, statusFilter, search]);

    useEffect(() => { fetchPayments(); }, [fetchPayments]);

    // Baja el voucher por XHR y lo muestra como blob. Incrustar la URL de
    // /media/ directamente deja el visor en blanco (nginx lo entrega como
    // descarga); el blob es mismo origen para el navegador y si se ve.
    useEffect(() => {
        if (!previewPayment?.voucher_url) { setPreviewSrc(null); return; }
        let vivo = true;
        let url = null;
        setPreviewLoading(true);
        Payments.voucherFile(previewPayment.id)
            .then((blob) => {
                if (!vivo) return;
                url = URL.createObjectURL(blob);
                setPreviewSrc(url);
            })
            .catch(() => {
                // Sin el endpoint nuevo caemos a la URL directa de /media/
                if (vivo) setPreviewSrc(previewPayment.voucher_url);
            })
            .finally(() => { if (vivo) setPreviewLoading(false); });
        return () => {
            vivo = false;
            if (url) URL.revokeObjectURL(url);
        };
    }, [previewPayment]);

    // Actions
    const handleApprove = async (payment) => {
        setActionLoading(true);
        try {
            await Payments.confirm(payment.id);
            toast.success("Pago aprobado");
            fetchPayments();
            setPreviewPayment(null);
        } catch (e) {
            showApiError(e, "Error al aprobar pago");
        } finally {
            setActionLoading(false);
        }
    };

    const handleVoid = async () => {
        if (!voidingPayment) return;
        setActionLoading(true);
        try {
            await Payments.void(voidingPayment.id);
            toast.success("Pago anulado");
            setVoidingPayment(null);
            fetchPayments();
            setPreviewPayment(null);
        } catch (e) {
            showApiError(e, "Error al anular pago");
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!deletingPayment) return;
        setActionLoading(true);
        try {
            await Payments.remove(deletingPayment.id);
            toast.success("Pago eliminado");
            setDeletingPayment(null);
            fetchPayments();
        } catch (e) {
            showApiError(e, "Error al eliminar pago");
        } finally {
            setActionLoading(false);
        }
    };

    const pendingCount = summary["PENDING_REVIEW"] || 0;
    const paidCount = summary["PAID"] || 0;
    const voidedCount = summary["VOIDED"] || 0;

    return (
        <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
                <Card className="border shadow-sm">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="bg-amber-100 p-2.5 rounded-xl">
                            <Clock className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{pendingCount}</p>
                            <p className="text-xs text-gray-500">Pendientes</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border shadow-sm">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="bg-green-100 p-2.5 rounded-xl">
                            <CheckCircle className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{paidCount}</p>
                            <p className="text-xs text-gray-500">Aprobados</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border shadow-sm">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="bg-red-100 p-2.5 rounded-xl">
                            <XCircle className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{voidedCount}</p>
                            <p className="text-xs text-gray-500">Anulados</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card className="border shadow-sm">
                <CardContent className="p-4">
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Call filter */}
                        <select
                            className="h-9 rounded-lg border border-gray-300 px-3 text-sm bg-white"
                            value={callFilter}
                            onChange={(e) => setCallFilter(e.target.value)}
                        >
                            <option value="">Todas las convocatorias</option>
                            {calls.map((c) => (
                                <option key={c.id} value={c.id}>{c.name || c.title}</option>
                            ))}
                        </select>

                        {/* Status buttons */}
                        <div className="flex gap-1">
                            {[
                                { key: "PENDING_REVIEW", label: "Pendientes", color: "amber" },
                                { key: "PAID", label: "Aprobados", color: "green" },
                                { key: "VOIDED", label: "Anulados", color: "red" },
                                { key: "", label: "Todos", color: "gray" },
                            ].map((opt) => (
                                <Button
                                    key={opt.key}
                                    size="sm"
                                    variant={statusFilter === opt.key ? "default" : "outline"}
                                    className={`h-8 text-xs ${statusFilter === opt.key ? "" : ""}`}
                                    onClick={() => setStatusFilter(opt.key)}
                                >
                                    {opt.label}
                                </Button>
                            ))}
                        </div>

                        {/* Search */}
                        <div className="relative flex-1 min-w-[180px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Buscar por DNI, nombre o secuencia..."
                                className="pl-9 h-9 rounded-lg"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>

                        <Button variant="outline" size="sm" onClick={fetchPayments} disabled={loading}>
                            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            <Card className="border shadow-sm">
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center h-32">
                            <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                        </div>
                    ) : payments.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                            <FileText className="h-8 w-8 mb-2" />
                            <p className="text-sm">No se encontraron pagos</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-gray-50/60">
                                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Postulante</th>
                                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Carrera</th>
                                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Canal</th>
                                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Nro. Sec.</th>
                                        <th className="text-right px-4 py-3 font-semibold text-gray-600">Monto</th>
                                        <th className="text-center px-4 py-3 font-semibold text-gray-600">Estado</th>
                                        <th className="text-center px-4 py-3 font-semibold text-gray-600">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payments.map((p) => {
                                        const st = STATUS_BADGES[p.status] || STATUS_BADGES.STARTED;
                                        const StIcon = st.Icon;
                                        return (
                                            <tr key={p.id} className="border-b hover:bg-gray-50/40 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="font-medium text-gray-900">{p.applicant_name}</div>
                                                    <div className="text-xs text-gray-500">{p.applicant_dni}</div>
                                                </td>
                                                <td className="px-4 py-3 text-gray-700 text-xs">{p.career_name}</td>
                                                <td className="px-4 py-3 text-gray-600 text-xs">
                                                    {CHANNEL_LABELS[p.channel] || p.channel}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="text-gray-900 font-mono text-xs">{p.nro_secuencia || "—"}</div>
                                                    <div className="text-[10px] text-gray-400">
                                                        Caja: {p.codigo_caja || "—"} | {p.fecha_movimiento || "—"}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right font-semibold text-gray-900">
                                                    S/. {p.amount?.toFixed(2)}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <Badge className={`${st.className} border text-[11px] font-semibold gap-1`}>
                                                        <StIcon className="h-3 w-3" /> {st.label}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center justify-center gap-1">
                                                        {p.voucher_url && (
                                                            <Button
                                                                variant="ghost" size="sm"
                                                                className="h-7 w-7 p-0"
                                                                title="Ver voucher"
                                                                onClick={() => { setPreviewPayment(p); setPreviewZoom(1); setPreviewImgError(false); }}
                                                            >
                                                                <Eye className="h-3.5 w-3.5" />
                                                            </Button>
                                                        )}
                                                        {p.status === "PENDING_REVIEW" && (
                                                            <>
                                                                <Button
                                                                    variant="ghost" size="sm"
                                                                    className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                                    onClick={() => handleApprove(p)}
                                                                    disabled={actionLoading}
                                                                >
                                                                    <CheckCircle className="h-3.5 w-3.5 mr-1" /> Aprobar
                                                                </Button>
                                                                <Button
                                                                    variant="ghost" size="sm"
                                                                    className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                    onClick={() => setVoidingPayment(p)}
                                                                    disabled={actionLoading}
                                                                >
                                                                    <XCircle className="h-3.5 w-3.5 mr-1" /> Rechazar
                                                                </Button>
                                                            </>
                                                        )}
                                                        <Button
                                                            variant="ghost" size="sm"
                                                            className="h-7 w-7 p-0 text-gray-400 hover:text-red-600"
                                                            onClick={() => setDeletingPayment(p)}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ── Voucher Preview Modal ── */}
            {previewPayment && createPortal(
                <div
                    className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4"
                    onClick={() => setPreviewPayment(null)}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-3 border-b bg-slate-50">
                            <div className="min-w-0">
                                <h3 className="font-bold text-gray-900 truncate">
                                    Voucher — {previewPayment.applicant_name}
                                </h3>
                                <p className="text-xs text-gray-500 truncate">
                                    DNI: {previewPayment.applicant_dni}
                                    {previewPayment.nro_secuencia && ` · Sec: ${previewPayment.nro_secuencia}`}
                                    {previewPayment.codigo_caja && ` · Caja: ${previewPayment.codigo_caja}`}
                                    {" · S/. "}
                                    {Number(previewPayment.amount || 0).toFixed(2)}
                                </p>
                            </div>
                            <div className="flex items-center gap-1 ml-3 shrink-0">
                                {isImageVoucher(previewPayment.voucher_url) && !previewImgError && (
                                    <>
                                        <Button
                                            variant="ghost" size="sm" title="Alejar"
                                            className="h-8 w-8 p-0"
                                            onClick={() => setPreviewZoom((z) => Math.max(0.5, z - 0.25))}
                                        >
                                            <ZoomOut className="h-4 w-4" />
                                        </Button>
                                        <span className="text-xs text-gray-500 w-10 text-center">
                                            {Math.round(previewZoom * 100)}%
                                        </span>
                                        <Button
                                            variant="ghost" size="sm" title="Acercar"
                                            className="h-8 w-8 p-0"
                                            onClick={() => setPreviewZoom((z) => Math.min(3, z + 0.25))}
                                        >
                                            <ZoomIn className="h-4 w-4" />
                                        </Button>
                                    </>
                                )}
                                {previewPayment.voucher_url && (
                                    <a
                                        href={previewPayment.voucher_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-slate-100 text-slate-600"
                                        title="Abrir en nueva pestaña"
                                    >
                                        <Download className="h-4 w-4" />
                                    </a>
                                )}
                                <Button
                                    variant="ghost" size="sm"
                                    className="h-8 w-8 p-0 text-slate-500 hover:text-slate-800"
                                    onClick={() => setPreviewPayment(null)}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-h-0 overflow-auto p-4 flex items-center justify-center bg-gray-100">
                            {!previewPayment.voucher_url ? (
                                <div className="text-center text-gray-500 py-8">
                                    <Paperclip className="h-10 w-10 mx-auto mb-2 opacity-40" />
                                    <p className="font-medium">Sin voucher adjunto</p>
                                </div>
                            ) : previewLoading || !previewSrc ? (
                                <div className="flex flex-col items-center gap-2 text-gray-400 py-16">
                                    <RefreshCw className="h-6 w-6 animate-spin" />
                                    <p className="text-xs">Cargando voucher…</p>
                                </div>
                            ) : isPdfVoucher(previewPayment.voucher_url) ? (
                                // El <object> con el blob muestra el PDF dentro del modal; si aun
                                // asi el navegador no lo incrusta, cae al respaldo con enlace.
                                <object
                                    data={previewSrc}
                                    type="application/pdf"
                                    className="w-full h-[65vh] rounded border bg-white"
                                    aria-label="Voucher PDF"
                                >
                                    <div className="text-center text-gray-600 py-10 px-4">
                                        <FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />
                                        <p className="font-medium">No se puede mostrar el PDF aquí</p>
                                        <a
                                            href={previewPayment.voucher_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 mt-3 text-sm font-semibold text-blue-600 hover:underline"
                                        >
                                            <Download className="h-4 w-4" /> Abrir voucher en una pestaña nueva
                                        </a>
                                    </div>
                                </object>
                            ) : previewImgError ? (
                                <div className="text-center text-gray-600 py-10 px-4">
                                    <AlertTriangle className="h-10 w-10 mx-auto mb-2 text-amber-500 opacity-70" />
                                    <p className="font-medium">No se pudo cargar el archivo</p>
                                    <a
                                        href={previewPayment.voucher_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 mt-3 text-sm font-semibold text-blue-600 hover:underline"
                                    >
                                        <Download className="h-4 w-4" /> Abrirlo en una pestaña nueva
                                    </a>
                                </div>
                            ) : (
                                <img
                                    src={previewSrc}
                                    alt="Voucher"
                                    className="max-w-full rounded shadow transition-transform duration-200"
                                    style={{ transform: `scale(${previewZoom})`, transformOrigin: "center center" }}
                                    onError={() => setPreviewImgError(true)}
                                />
                            )}
                        </div>

                        {previewPayment.status === "PENDING_REVIEW" && (
                            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t bg-slate-50">
                                <Button
                                    variant="outline"
                                    className="text-red-600 border-red-200 hover:bg-red-50"
                                    onClick={() => { setVoidingPayment(previewPayment); }}
                                    disabled={actionLoading}
                                >
                                    <XCircle className="h-4 w-4 mr-1" /> Rechazar
                                </Button>
                                <Button
                                    className="bg-green-600 hover:bg-green-700 text-white"
                                    onClick={() => handleApprove(previewPayment)}
                                    disabled={actionLoading}
                                >
                                    <CheckCircle className="h-4 w-4 mr-1" /> Aprobar Pago
                                </Button>
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}

            {/* ── Void Confirmation ── */}
            <AlertDialog open={!!voidingPayment} onOpenChange={(o) => !o && setVoidingPayment(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Rechazar / Anular Pago</AlertDialogTitle>
                        <AlertDialogDescription>
                            {voidingPayment?.status === "PAID"
                                ? "Este pago ya fue aprobado. Al anularlo se revertirá el ingreso en caja y se desactivará el usuario del postulante."
                                : "¿Confirma que desea rechazar este pago? El postulante deberá realizar un nuevo depósito."}
                            <br /><br />
                            <strong>{voidingPayment?.applicant_name}</strong> — DNI: {voidingPayment?.applicant_dni}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
                        <Button
                            onClick={handleVoid}
                            disabled={actionLoading}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            {actionLoading ? "Procesando..." : "Sí, rechazar"}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ── Delete Confirmation ── */}
            <AlertDialog open={!!deletingPayment} onOpenChange={(o) => !o && setDeletingPayment(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Eliminar Pago</AlertDialogTitle>
                        <AlertDialogDescription>
                            {deletingPayment?.status === "PAID"
                                ? "Este pago ya fue aprobado. Al eliminarlo se revertirá el ingreso en caja."
                                : "¿Confirma que desea eliminar este registro de pago?"}
                            <br /><br />
                            <strong>{deletingPayment?.applicant_name}</strong> — S/. {deletingPayment?.amount?.toFixed(2)}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
                        <Button
                            onClick={handleDelete}
                            disabled={actionLoading}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            {actionLoading ? "Eliminando..." : "Sí, eliminar"}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
