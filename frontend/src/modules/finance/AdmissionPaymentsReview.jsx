// src/modules/finance/AdmissionPaymentsReview.jsx
/**
 * Panel de revisión de pagos de admisión para finanzas.
 * Permite ver, aprobar, rechazar y eliminar pagos de postulantes.
 */
import { useState, useEffect, useCallback } from "react";
import {
    Card, CardContent, CardHeader, CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import {
    CheckCircle, XCircle, Clock, Eye, Search,
    RefreshCw, FileText, Users,
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
                                                                onClick={() => { setPreviewPayment(p); setPreviewZoom(1); }}
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
            {previewPayment && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b">
                            <div>
                                <h3 className="font-bold text-gray-900">
                                    Voucher - {previewPayment.applicant_name}
                                </h3>
                                <p className="text-xs text-gray-500">
                                    DNI: {previewPayment.applicant_dni} | Sec: {previewPayment.nro_secuencia} | S/. {previewPayment.amount?.toFixed(2)}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="sm" onClick={() => setPreviewZoom((z) => Math.max(0.5, z - 0.25))}>
                                    <ZoomOut className="h-4 w-4" />
                                </Button>
                                <span className="text-xs text-gray-500 w-10 text-center">{Math.round(previewZoom * 100)}%</span>
                                <Button variant="ghost" size="sm" onClick={() => setPreviewZoom((z) => Math.min(3, z + 0.25))}>
                                    <ZoomIn className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => setPreviewPayment(null)}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-gray-100">
                            {previewPayment.voucher_url?.endsWith(".pdf") ? (
                                <iframe
                                    src={previewPayment.voucher_url}
                                    className="w-full h-[70vh] rounded border"
                                    title="Voucher PDF"
                                />
                            ) : (
                                <img
                                    src={previewPayment.voucher_url}
                                    alt="Voucher"
                                    className="max-w-full rounded shadow transition-transform"
                                    style={{ transform: `scale(${previewZoom})` }}
                                />
                            )}
                        </div>
                        {previewPayment.status === "PENDING_REVIEW" && (
                            <div className="flex items-center justify-end gap-2 p-4 border-t">
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
                </div>
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
