// src/modules/finance/EnrollmentPaymentsReview.jsx
/**
 * Panel de revisión de pagos de matrícula para finanzas.
 * Permite ver, aprobar y rechazar vouchers de pago.
 */
import { useState, useEffect, useCallback } from "react";
import {
    Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import {
    CheckCircle, XCircle, Clock, Eye, Search,
    RefreshCw, ChevronDown, FileText, Users,
    DollarSign, AlertTriangle, Image, Trash2, X,
    ZoomIn, ZoomOut, Download,
} from "lucide-react";
import { toast } from "../../utils/safeToast";
import { EnrollmentPayment } from "../../services/academic.service";
import { formatApiError } from "../../utils/format";

const showApiError = (e, fallback) => {
    const err = formatApiError(e, fallback);
    if (typeof err === "string") toast.error(err);
    else toast.error(err.title ?? (fallback || "Error"), { description: err.description });
};

const STATUS_BADGES = {
    PENDING:  { className: "bg-amber-100 text-amber-700 border-amber-200", label: "Pendiente", Icon: Clock },
    APPROVED: { className: "bg-green-100 text-green-700 border-green-200", label: "Aprobado", Icon: CheckCircle },
    REJECTED: { className: "bg-red-100 text-red-700 border-red-200",       label: "Rechazado", Icon: XCircle },
};

const CHANNEL_LABELS = {
    PAGALO: "Págalo.pe",
    CAJERO_MULTIRED: "Cajero Multired",
    AGENCIA_BN: "Agencia BN",
};

function guessPeriod() {
    const now = new Date();
    const y = now.getFullYear();
    return now.getMonth() < 6 ? `${y}-I` : `${y}-II`;
}

function generatePeriodOptions() {
    const now = new Date();
    const year = now.getFullYear();
    const opts = [];
    for (let y = year + 1; y >= year - 3; y--) {
        opts.push(`${y}-II`);
        opts.push(`${y}-I`);
    }
    return opts;
}

export default function EnrollmentPaymentsReview() {
    const [period, setPeriod] = useState(guessPeriod);
    const [statusFilter, setStatusFilter] = useState("PENDING");
    const [search, setSearch] = useState("");
    const [payments, setPayments] = useState([]);
    const [summary, setSummary] = useState({});
    const [loading, setLoading] = useState(false);

    // Modal de revisión
    const [reviewingPayment, setReviewingPayment] = useState(null);
    const [rejectionNote, setRejectionNote] = useState("");
    const [actionLoading, setActionLoading] = useState(false);

    // Modal de voucher preview
    const [previewPayment, setPreviewPayment] = useState(null);
    const [previewZoom, setPreviewZoom] = useState(1);

    // Modal de confirmar eliminación
    const [deletingPayment, setDeletingPayment] = useState(null);

    // ── Fetch ──
    const fetchPayments = useCallback(async () => {
        try {
            setLoading(true);
            const data = await EnrollmentPayment.pending({
                period,
                status: statusFilter || undefined,
                search: search.trim() || undefined,
            });
            setPayments(data?.payments || data?.results || []);
            setSummary(data?.summary || {});
        } catch (err) {
            showApiError(err, "Error al cargar pagos");
        } finally {
            setLoading(false);
        }
    }, [period, statusFilter, search]);

    useEffect(() => {
        fetchPayments();
    }, [fetchPayments]);

    // ── Aprobar ──
    const handleApprove = async (payment) => {
        try {
            setActionLoading(true);
            await EnrollmentPayment.approve(payment.id);
            toast.success(`Pago de ${payment.student_name || "estudiante"} aprobado`);
            setReviewingPayment(null);
            await fetchPayments();
        } catch (err) {
            showApiError(err, "Error al aprobar pago");
        } finally {
            setActionLoading(false);
        }
    };

    // ── Rechazar ──
    const handleReject = async (payment) => {
        if (!rejectionNote.trim()) {
            toast.error("Ingresa un motivo de rechazo");
            return;
        }
        try {
            setActionLoading(true);
            await EnrollmentPayment.reject(payment.id, rejectionNote.trim());
            toast.success(`Pago de ${payment.student_name || "estudiante"} rechazado`);
            setReviewingPayment(null);
            setRejectionNote("");
            await fetchPayments();
        } catch (err) {
            showApiError(err, "Error al rechazar pago");
        } finally {
            setActionLoading(false);
        }
    };

    // ── Eliminar ──
    const handleDelete = async (payment) => {
        try {
            setActionLoading(true);
            await EnrollmentPayment.remove(payment.id);
            toast.success(`Pago de ${payment.student_name || "estudiante"} eliminado`);
            setDeletingPayment(null);
            await fetchPayments();
        } catch (err) {
            showApiError(err, "Error al eliminar pago");
        } finally {
            setActionLoading(false);
        }
    };

    // ── Preview helpers ──
    const isImageVoucher = (url) => {
        if (!url) return false;
        const lower = url.toLowerCase();
        return /\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i.test(lower);
    };

    const isPdfVoucher = (url) => {
        if (!url) return false;
        return /\.pdf(\?|$)/i.test(url.toLowerCase());
    };

    const StatusBadge = ({ status }) => {
        const cfg = STATUS_BADGES[status] || STATUS_BADGES.PENDING;
        const Icon = cfg.Icon;
        return (
            <Badge className={`${cfg.className} border text-xs font-medium px-2 py-0.5`}>
                <Icon className="h-3 w-3 mr-1" /> {cfg.label}
            </Badge>
        );
    };

    return (
        <div className="space-y-6 pb-24 sm:pb-6">
            {/* ── Summary Cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border-l-4 border-l-amber-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
                        <Clock className="h-4 w-4 text-amber-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-600">{summary.pending ?? 0}</div>
                        <p className="text-xs text-muted-foreground">Vouchers por revisar</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-green-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Aprobados</CardTitle>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{summary.approved ?? 0}</div>
                        <p className="text-xs text-muted-foreground">Pagos verificados</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-red-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Rechazados</CardTitle>
                        <XCircle className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{summary.rejected ?? 0}</div>
                        <p className="text-xs text-muted-foreground">Vouchers observados</p>
                    </CardContent>
                </Card>
            </div>

            {/* ── Filtros ── */}
            <Card>
                <CardContent className="py-4 px-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        {/* Periodo */}
                        <div className="relative">
                            <select
                                value={period}
                                onChange={e => setPeriod(e.target.value)}
                                className="h-9 rounded-md border border-slate-200 bg-white px-3 pr-8 text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                {generatePeriodOptions().map(p => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-2 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                        </div>

                        {/* Búsqueda */}
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <Input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Buscar por DNI o nombre..."
                                className="pl-9 text-sm"
                                onKeyDown={e => e.key === "Enter" && fetchPayments()}
                            />
                        </div>

                        {/* Status filter */}
                        <div className="flex gap-1">
                            {[
                                { value: "PENDING", label: "Pendientes" },
                                { value: "APPROVED", label: "Aprobados" },
                                { value: "REJECTED", label: "Rechazados" },
                                { value: "", label: "Todos" },
                            ].map(f => (
                                <Button
                                    key={f.value}
                                    variant={statusFilter === f.value ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setStatusFilter(f.value)}
                                    className="text-xs"
                                >
                                    {f.label}
                                </Button>
                            ))}
                        </div>

                        <Button variant="outline" size="sm" onClick={fetchPayments} disabled={loading}>
                            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
                            Actualizar
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* ── Lista de pagos ── */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
                    <span className="ml-2 text-slate-500">Cargando pagos...</span>
                </div>
            ) : payments.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-slate-500">
                        <Users className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                        <p className="font-medium">No se encontraron pagos</p>
                        <p className="text-sm mt-1">
                            {statusFilter === "PENDING"
                                ? "No hay pagos pendientes de revisión."
                                : "No hay resultados con los filtros actuales."}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent className="p-0">
                        {/* Tabla responsiva */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-slate-50/80">
                                        <th className="text-left px-4 py-3 font-medium text-slate-600">Estudiante</th>
                                        <th className="text-left px-4 py-3 font-medium text-slate-600 hidden sm:table-cell">Canal</th>
                                        <th className="text-right px-4 py-3 font-medium text-slate-600">Monto</th>
                                        <th className="text-center px-4 py-3 font-medium text-slate-600">Estado</th>
                                        <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Fecha</th>
                                        <th className="text-right px-4 py-3 font-medium text-slate-600">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {payments.map(payment => (
                                        <tr key={payment.id} className="hover:bg-slate-50/50 transition-colors">
                                            {/* Estudiante */}
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-slate-800">
                                                    {payment.student_name || "Sin nombre"}
                                                </div>
                                                <div className="text-xs text-slate-500">
                                                    DNI: <span className="font-mono">{payment.student_dni || "-"}</span>
                                                    {payment.student_career && (
                                                        <span className="ml-2">{payment.student_career}</span>
                                                    )}
                                                </div>
                                                {payment.discount_tag === "PRIMER_PUESTO" && (
                                                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] mt-1">
                                                        1er Puesto
                                                    </Badge>
                                                )}
                                                {payment.rejection_note && (
                                                    <p className="text-[11px] text-red-600 mt-1 max-w-[200px] truncate" title={payment.rejection_note}>
                                                        Rechazo: {payment.rejection_note}
                                                    </p>
                                                )}
                                            </td>

                                            {/* Canal */}
                                            <td className="px-4 py-3 hidden sm:table-cell">
                                                <span className="text-slate-600">{CHANNEL_LABELS[payment.channel] || payment.channel}</span>
                                                {payment.operation_code && (
                                                    <div className="text-xs text-slate-400 font-mono">{payment.operation_code}</div>
                                                )}
                                            </td>

                                            {/* Monto */}
                                            <td className="px-4 py-3 text-right">
                                                <span className="font-semibold text-slate-800">
                                                    S/. {Number(payment.total || payment.amount || 0).toFixed(2)}
                                                </span>
                                            </td>

                                            {/* Estado */}
                                            <td className="px-4 py-3 text-center">
                                                <StatusBadge status={payment.status} />
                                            </td>

                                            {/* Fecha */}
                                            <td className="px-4 py-3 text-slate-500 text-xs hidden md:table-cell">
                                                {payment.created_at
                                                    ? new Date(payment.created_at).toLocaleString("es-PE")
                                                    : "-"}
                                            </td>

                                            {/* Acciones */}
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {payment.voucher_url && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="text-blue-600 border-blue-200 hover:bg-blue-50 h-7 px-2 text-xs"
                                                            onClick={() => { setPreviewPayment(payment); setPreviewZoom(1); }}
                                                            title="Ver voucher"
                                                        >
                                                            <Eye className="h-3.5 w-3.5 mr-1" />
                                                            <span className="hidden lg:inline">Voucher</span>
                                                        </Button>
                                                    )}
                                                    {payment.status === "PENDING" && (
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                className="bg-green-600 hover:bg-green-700 text-white h-7 px-2 text-xs"
                                                                onClick={() => handleApprove(payment)}
                                                                disabled={actionLoading}
                                                            >
                                                                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                                                <span className="hidden sm:inline">Aprobar</span>
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="text-red-600 border-red-200 hover:bg-red-50 h-7 px-2 text-xs"
                                                                onClick={() => {
                                                                    setReviewingPayment(payment);
                                                                    setRejectionNote("");
                                                                }}
                                                                disabled={actionLoading}
                                                            >
                                                                <XCircle className="h-3.5 w-3.5 mr-1" />
                                                                <span className="hidden sm:inline">Rechazar</span>
                                                            </Button>
                                                        </>
                                                    )}
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="text-red-500 border-red-200 hover:bg-red-50 h-7 px-2 text-xs"
                                                        onClick={() => setDeletingPayment(payment)}
                                                        disabled={actionLoading}
                                                        title="Eliminar pago"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ── Modal de Rechazo ── */}
            {reviewingPayment && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-md">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-red-600" />
                                Rechazar Pago
                            </CardTitle>
                            <CardDescription>
                                Estudiante: {reviewingPayment.student_name || ""}
                                {reviewingPayment.student_dni ? ` (${reviewingPayment.student_dni})` : ""}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Info del pago */}
                            <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Monto:</span>
                                    <span className="font-semibold">S/. {Number(reviewingPayment.total || reviewingPayment.amount || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Canal:</span>
                                    <span>{CHANNEL_LABELS[reviewingPayment.channel] || reviewingPayment.channel}</span>
                                </div>
                                {reviewingPayment.operation_code && (
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Nro. Op:</span>
                                        <span className="font-mono text-xs">{reviewingPayment.operation_code}</span>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Motivo del rechazo <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={rejectionNote}
                                    onChange={e => setRejectionNote(e.target.value)}
                                    placeholder="Ej: Voucher ilegible, monto incorrecto, etc."
                                    rows={3}
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-red-500 focus:ring-1 focus:ring-red-500"
                                    autoFocus
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => { setReviewingPayment(null); setRejectionNote(""); }}
                                    disabled={actionLoading}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    className="bg-red-600 hover:bg-red-700 text-white"
                                    onClick={() => handleReject(reviewingPayment)}
                                    disabled={actionLoading || !rejectionNote.trim()}
                                >
                                    {actionLoading
                                        ? <><RefreshCw className="h-4 w-4 mr-1 animate-spin" /> Procesando...</>
                                        : <><XCircle className="h-4 w-4 mr-1" /> Confirmar Rechazo</>
                                    }
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* ── Modal de Vista Previa de Voucher ── */}
            {previewPayment && (
                <div
                    className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
                    onClick={() => setPreviewPayment(null)}
                >
                    <div
                        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-3 border-b bg-slate-50">
                            <div className="min-w-0">
                                <h3 className="font-semibold text-slate-800 truncate">
                                    Voucher — {previewPayment.student_name || "Estudiante"}
                                </h3>
                                <p className="text-xs text-slate-500">
                                    {CHANNEL_LABELS[previewPayment.channel] || previewPayment.channel}
                                    {previewPayment.operation_code && ` · Op: ${previewPayment.operation_code}`}
                                    {" · S/. "}
                                    {Number(previewPayment.total || previewPayment.amount || 0).toFixed(2)}
                                </p>
                            </div>
                            <div className="flex items-center gap-1 ml-3 shrink-0">
                                {isImageVoucher(previewPayment.voucher_url) && (
                                    <>
                                        <Button
                                            variant="ghost" size="sm"
                                            onClick={() => setPreviewZoom(z => Math.max(0.5, z - 0.25))}
                                            className="h-8 w-8 p-0"
                                            title="Alejar"
                                        >
                                            <ZoomOut className="h-4 w-4" />
                                        </Button>
                                        <span className="text-xs text-slate-500 w-10 text-center">{Math.round(previewZoom * 100)}%</span>
                                        <Button
                                            variant="ghost" size="sm"
                                            onClick={() => setPreviewZoom(z => Math.min(3, z + 0.25))}
                                            className="h-8 w-8 p-0"
                                            title="Acercar"
                                        >
                                            <ZoomIn className="h-4 w-4" />
                                        </Button>
                                    </>
                                )}
                                <a
                                    href={previewPayment.voucher_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-slate-100 text-slate-600"
                                    title="Abrir en nueva pestaña"
                                >
                                    <Download className="h-4 w-4" />
                                </a>
                                <Button
                                    variant="ghost" size="sm"
                                    onClick={() => setPreviewPayment(null)}
                                    className="h-8 w-8 p-0 text-slate-500 hover:text-slate-800"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-auto bg-slate-100 flex items-center justify-center p-4">
                            {isPdfVoucher(previewPayment.voucher_url) ? (
                                <iframe
                                    src={previewPayment.voucher_url}
                                    className="w-full h-[70vh] rounded border bg-white"
                                    title="Vista previa del voucher PDF"
                                />
                            ) : (
                                <img
                                    src={previewPayment.voucher_url}
                                    alt="Voucher de pago"
                                    className="rounded shadow-lg transition-transform duration-200"
                                    style={{ transform: `scale(${previewZoom})`, transformOrigin: "center center" }}
                                    onError={e => {
                                        e.target.style.display = "none";
                                        e.target.parentNode.innerHTML =
                                            '<div class="text-center text-slate-500 py-8"><p class="font-medium">No se pudo cargar la imagen</p><p class="text-sm mt-1">Intenta abrirla en una nueva pestaña.</p></div>';
                                    }}
                                />
                            )}
                        </div>

                        {/* Footer con acciones rápidas */}
                        {previewPayment.status === "PENDING" && (
                            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t bg-slate-50">
                                <Button
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700 text-white"
                                    onClick={() => { handleApprove(previewPayment); setPreviewPayment(null); }}
                                    disabled={actionLoading}
                                >
                                    <CheckCircle className="h-4 w-4 mr-1" /> Aprobar
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-red-600 border-red-200 hover:bg-red-50"
                                    onClick={() => {
                                        setReviewingPayment(previewPayment);
                                        setPreviewPayment(null);
                                        setRejectionNote("");
                                    }}
                                    disabled={actionLoading}
                                >
                                    <XCircle className="h-4 w-4 mr-1" /> Rechazar
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Modal de Confirmar Eliminación ── */}
            {deletingPayment && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-sm">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Trash2 className="h-5 w-5 text-red-600" />
                                Eliminar Pago
                            </CardTitle>
                            <CardDescription>
                                {deletingPayment.student_name || "Estudiante"}
                                {deletingPayment.student_dni ? ` (${deletingPayment.student_dni})` : ""}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-slate-600">
                                Se eliminará permanentemente este registro de pago
                                (S/. {Number(deletingPayment.total || deletingPayment.amount || 0).toFixed(2)}).
                                El estudiante podrá subir un nuevo voucher.
                            </p>
                            <div className="flex justify-end gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => setDeletingPayment(null)}
                                    disabled={actionLoading}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    className="bg-red-600 hover:bg-red-700 text-white"
                                    onClick={() => handleDelete(deletingPayment)}
                                    disabled={actionLoading}
                                >
                                    {actionLoading
                                        ? <><RefreshCw className="h-4 w-4 mr-1 animate-spin" /> Eliminando...</>
                                        : <><Trash2 className="h-4 w-4 mr-1" /> Eliminar</>
                                    }
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
