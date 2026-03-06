// src/modules/admission/PaymentsManagement.jsx
//
// Flujo:
//   1. Admin selecciona convocatoria + carrera
//   2. Ve lista de postulantes ADMITIDOS con su estado de pago
//   3. Cuando el postulante paga, admin hace click en "Verificar Pago"
//   4. Backend confirma pago + genera usuario y contraseña
//   5. Admin ve las credenciales generadas (puede imprimir ficha)
//   6. Postulante consulta resultado público y ve sus credenciales

import React, { useEffect, useState } from "react";
import { AdmissionCalls, Payments } from "../../services/admission.service";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "../../components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../../components/ui/select";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "../../components/ui/dialog";
import { toast } from "sonner";
import {
    CheckCircle2,
    XCircle,
    RefreshCw,
    FileText,
    Search,
    UserPlus,
    Copy,
    Printer,
    AlertCircle,
    CreditCard,
    Eye,
} from "lucide-react";

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

const STATUS_CONFIG = {
    PAID: {
        label: "Pagado",
        class: "bg-green-100 text-green-700 border-green-200",
        icon: CheckCircle2,
    },
    CONFIRMED: {
        label: "Verificado",
        class: "bg-blue-100 text-blue-700 border-blue-200",
        icon: CheckCircle2,
    },
    STARTED: {
        label: "Pendiente",
        class: "bg-yellow-100 text-yellow-700 border-yellow-200",
        icon: AlertCircle,
    },
    PENDING: {
        label: "Pendiente",
        class: "bg-yellow-100 text-yellow-700 border-yellow-200",
        icon: AlertCircle,
    },
    FAILED: {
        label: "Fallido",
        class: "bg-red-100 text-red-700 border-red-200",
        icon: XCircle,
    },
    VOIDED: {
        label: "Anulado",
        class: "bg-gray-100 text-gray-500 border-gray-200",
        icon: XCircle,
    },
};

const getStatusConfig = (s) =>
    STATUS_CONFIG[s] || STATUS_CONFIG.PENDING;

const fmtDate = (iso) => {
    if (!iso) return "—";
    try {
        return new Date(iso).toLocaleDateString("es-PE", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return iso;
    }
};

const fmtMoney = (v) => {
    const n = Number(v);
    return isNaN(n) ? "0.00" : n.toFixed(2);
};

// ═══════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════

export default function PaymentsManagement() {
    const [calls, setCalls] = useState([]);
    const [call, setCall] = useState(null);
    const [careerId, setCareerId] = useState("");
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchDni, setSearchDni] = useState("");

    // Modal de credenciales
    const [credModal, setCredModal] = useState(false);
    const [credentials, setCredentials] = useState(null);

    // Modal de detalle
    const [detailModal, setDetailModal] = useState(false);
    const [selectedRow, setSelectedRow] = useState(null);

    // Confirming state
    const [confirmingId, setConfirmingId] = useState(null);

    // ── Carga inicial ──
    useEffect(() => {
        AdmissionCalls.listAdmin()
            .then((d) => {
                const list = d?.admission_calls || d?.calls || d || [];
                setCalls(list);
                if (list.length > 0) setCall(list[0]);
            })
            .finally(() => setLoading(false));
    }, []);

    // ── Cargar pagos ──
    const load = async () => {
        if (!call) return;
        try {
            const params = { call_id: call.id };
            if (careerId) params.career_id = careerId;

            const d = await Payments.list(params);
            const list = d?.payments || d?.data || d || [];
            setRows(Array.isArray(list) ? list : []);
        } catch (e) {
            console.error(e);
            toast.error("Error al cargar pagos");
        }
    };

    useEffect(() => {
        if (call?.id) load();
    }, [call?.id, careerId]);

    // ── Filtro por DNI ──
    const filteredRows = searchDni.trim()
        ? rows.filter(
            (r) =>
                (r.applicant_dni || "").includes(searchDni.trim()) ||
                (r.applicant_name || "")
                    .toLowerCase()
                    .includes(searchDni.trim().toLowerCase())
        )
        : rows;

    // ── Estadísticas ──
    const stats = {
        total: rows.length,
        confirmed: rows.filter(
            (r) => r.status === "PAID" || r.status === "CONFIRMED"
        ).length,
        pending: rows.filter(
            (r) => r.status === "STARTED" || r.status === "PENDING"
        ).length,
        withCredentials: rows.filter((r) => r.credentials_generated).length,
    };

    // ═══════════════════════════════════════════════════
    // ACCIONES
    // ═══════════════════════════════════════════════════

    /**
     * Verificar pago → Backend confirma + genera usuario/contraseña.
     * El backend debe retornar { ok, credentials: { username, password } }
     */
    const handleConfirmPayment = async (paymentId) => {
        setConfirmingId(paymentId);
        try {
            const resp = await Payments.confirm(paymentId);

            toast.success("Pago verificado exitosamente");

            // Si el backend generó credenciales, mostrarlas
            if (resp?.credentials) {
                setCredentials({
                    ...resp.credentials,
                    payment_id: paymentId,
                    applicant_name:
                        rows.find((r) => r.id === paymentId)?.applicant_name ||
                        "—",
                    applicant_dni:
                        rows.find((r) => r.id === paymentId)?.applicant_dni ||
                        "—",
                });
                setCredModal(true);
            }

            await load(); // Refrescar lista
        } catch (e) {
            const msg =
                e?.response?.data?.detail || "Error al confirmar pago";
            toast.error(msg);
        } finally {
            setConfirmingId(null);
        }
    };

    const handleVoidPayment = async (paymentId) => {
        if (
            !window.confirm(
                "¿Está seguro de anular este pago? Se revocarán las credenciales generadas."
            )
        )
            return;

        try {
            await Payments.void(paymentId);
            toast.success("Pago anulado");
            await load();
        } catch (e) {
            toast.error("Error al anular pago");
        }
    };

    const handleReceipt = async (paymentId) => {
        try {
            const resp = await Payments.receiptPdf(paymentId);
            const blob = new Blob([resp.data], {
                type:
                    resp.headers?.["content-type"] || "application/pdf",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `recibo_pago_${paymentId}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            toast.error("Error al descargar recibo");
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text).then(() => {
            toast.success("Copiado al portapapeles");
        });
    };

    const handleViewDetail = (row) => {
        setSelectedRow(row);
        setDetailModal(true);
    };

    // ═══════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-blue-600" />
                        Verificación de Pagos — Admisión
                    </CardTitle>
                </CardHeader>

                <CardContent className="space-y-5">
                    {/* ── Filtros ── */}
                    <div className="grid md:grid-cols-4 gap-3">
                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Convocatoria
                            </label>
                            <Select
                                value={call?.id?.toString()}
                                onValueChange={(v) =>
                                    setCall(
                                        calls.find(
                                            (x) => x.id.toString() === v
                                        )
                                    )
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {calls.map((c) => (
                                        <SelectItem
                                            key={c.id}
                                            value={c.id.toString()}
                                        >
                                            {c.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Carrera
                            </label>
                            <Select
                                value={careerId || "__all__"}
                                onValueChange={(v) => setCareerId(v === "__all__" ? "" : v)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Todas" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__all__">(Todas)</SelectItem>
                                    {call?.careers?.map((k) => (
                                        <SelectItem
                                            key={k.id}
                                            value={k.id.toString()}
                                        >
                                            {k.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Buscar
                            </label>
                            <div className="relative">
                                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                <Input
                                    value={searchDni}
                                    onChange={(e) =>
                                        setSearchDni(e.target.value)
                                    }
                                    placeholder="DNI o nombre..."
                                    className="pl-9"
                                />
                            </div>
                        </div>

                        <div className="flex items-end">
                            <Button
                                variant="outline"
                                onClick={load}
                                className="w-full"
                            >
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Actualizar
                            </Button>
                        </div>
                    </div>

                    {/* ── Estadísticas ── */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <StatBox
                            label="Total pagos"
                            value={stats.total}
                            color="gray"
                        />
                        <StatBox
                            label="Verificados"
                            value={stats.confirmed}
                            color="green"
                        />
                        <StatBox
                            label="Pendientes"
                            value={stats.pending}
                            color="yellow"
                        />
                        <StatBox
                            label="Con credenciales"
                            value={stats.withCredentials}
                            color="blue"
                        />
                    </div>

                    {/* ── Tabla ── */}
                    <div className="border rounded-lg overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="p-3 text-left font-semibold">
                                        Postulante
                                    </th>
                                    <th className="p-3 text-center font-semibold">
                                        Monto
                                    </th>
                                    <th className="p-3 text-center font-semibold">
                                        Método
                                    </th>
                                    <th className="p-3 text-center font-semibold">
                                        Estado Pago
                                    </th>
                                    <th className="p-3 text-center font-semibold">
                                        Credenciales
                                    </th>
                                    <th className="p-3 text-center font-semibold">
                                        Fecha
                                    </th>
                                    <th className="p-3 text-right font-semibold">
                                        Acciones
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRows.map((r) => {
                                    const sc = getStatusConfig(r.status);
                                    const isConfirming =
                                        confirmingId === r.id;
                                    const isPaid =
                                        r.status === "PAID" ||
                                        r.status === "CONFIRMED";
                                    const hasCreds =
                                        r.credentials_generated ||
                                        r.username;

                                    return (
                                        <tr
                                            key={r.id}
                                            className="border-t hover:bg-gray-50/50"
                                        >
                                            {/* Postulante */}
                                            <td className="p-3">
                                                <div className="font-medium text-gray-900">
                                                    {r.applicant_name ||
                                                        "—"}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    DNI:{" "}
                                                    {r.applicant_dni ||
                                                        "—"}{" "}
                                                    •{" "}
                                                    {r.career_name ||
                                                        "—"}
                                                </div>
                                                {r.application_id && (
                                                    <div className="text-xs text-gray-400">
                                                        Postulación #
                                                        {r.application_id}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Monto */}
                                            <td className="p-3 text-center font-medium">
                                                S/.{" "}
                                                {fmtMoney(r.amount)}
                                            </td>

                                            {/* Método */}
                                            <td className="p-3 text-center">
                                                <Badge
                                                    variant="outline"
                                                    className="text-xs"
                                                >
                                                    {r.method === "CASHIER"
                                                        ? "Caja"
                                                        : r.method ===
                                                            "PSP"
                                                            ? "Pasarela"
                                                            : r.method ||
                                                            "—"}
                                                </Badge>
                                            </td>

                                            {/* Estado */}
                                            <td className="p-3 text-center">
                                                <Badge
                                                    className={`${sc.class} border`}
                                                >
                                                    {sc.label}
                                                </Badge>
                                            </td>

                                            {/* Credenciales */}
                                            <td className="p-3 text-center">
                                                {hasCreds ? (
                                                    <Badge className="bg-blue-100 text-blue-700 border border-blue-200">
                                                        <UserPlus className="h-3 w-3 mr-1" />
                                                        Generadas
                                                    </Badge>
                                                ) : isPaid ? (
                                                    <span className="text-xs text-amber-600 font-medium">
                                                        Pendiente
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-gray-400">
                                                        —
                                                    </span>
                                                )}
                                            </td>

                                            {/* Fecha */}
                                            <td className="p-3 text-center text-xs text-gray-500">
                                                {fmtDate(r.created_at)}
                                            </td>

                                            {/* Acciones */}
                                            <td className="p-3 text-right">
                                                <div className="flex gap-1.5 justify-end flex-wrap">
                                                    {/* Ver detalle */}
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() =>
                                                            handleViewDetail(
                                                                r
                                                            )
                                                        }
                                                        title="Ver detalle"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>

                                                    {/* Recibo PDF */}
                                                    {isPaid && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() =>
                                                                handleReceipt(
                                                                    r.id
                                                                )
                                                            }
                                                            title="Descargar recibo"
                                                        >
                                                            <FileText className="h-4 w-4" />
                                                        </Button>
                                                    )}

                                                    {/* VERIFICAR PAGO - Botón principal */}
                                                    {!isPaid &&
                                                        r.status !==
                                                        "VOIDED" && (
                                                            <Button
                                                                size="sm"
                                                                onClick={() =>
                                                                    handleConfirmPayment(
                                                                        r.id
                                                                    )
                                                                }
                                                                disabled={
                                                                    isConfirming
                                                                }
                                                                className="bg-green-600 hover:bg-green-700 text-white"
                                                            >
                                                                {isConfirming ? (
                                                                    <RefreshCw className="h-4 w-4 animate-spin mr-1" />
                                                                ) : (
                                                                    <CheckCircle2 className="h-4 w-4 mr-1" />
                                                                )}
                                                                Verificar Pago
                                                            </Button>
                                                        )}

                                                    {/* Anular */}
                                                    {isPaid &&
                                                        r.status !==
                                                        "VOIDED" && (
                                                            <Button
                                                                variant="destructive"
                                                                size="sm"
                                                                onClick={() =>
                                                                    handleVoidPayment(
                                                                        r.id
                                                                    )
                                                                }
                                                            >
                                                                <XCircle className="h-4 w-4 mr-1" />
                                                                Anular
                                                            </Button>
                                                        )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}

                                {filteredRows.length === 0 && (
                                    <tr>
                                        <td
                                            className="p-8 text-center text-gray-400"
                                            colSpan={7}
                                        >
                                            {rows.length === 0
                                                ? "No hay pagos registrados para esta convocatoria"
                                                : "No se encontraron resultados para la búsqueda"}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* ═══════════════════════════════════════════ */}
            {/* MODAL: Credenciales Generadas              */}
            {/* ═══════════════════════════════════════════ */}
            <Dialog open={credModal} onOpenChange={setCredModal}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-green-700">
                            <UserPlus className="h-5 w-5" />
                            Credenciales Generadas
                        </DialogTitle>
                    </DialogHeader>

                    {credentials && (
                        <div className="space-y-5">
                            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                                <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-2" />
                                <p className="text-sm text-green-800 font-medium">
                                    Pago verificado y cuenta creada exitosamente
                                </p>
                            </div>

                            <div className="space-y-3">
                                <div className="text-sm text-gray-600">
                                    <strong>Postulante:</strong>{" "}
                                    {credentials.applicant_name}
                                </div>
                                <div className="text-sm text-gray-600">
                                    <strong>DNI:</strong>{" "}
                                    {credentials.applicant_dni}
                                </div>
                            </div>

                            {/* Credenciales */}
                            <div className="bg-gray-50 border rounded-xl p-4 space-y-3">
                                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    Datos de Acceso al Sistema
                                </div>

                                <div className="flex items-center justify-between bg-white border rounded-lg px-4 py-3">
                                    <div>
                                        <div className="text-xs text-gray-500">
                                            Usuario
                                        </div>
                                        <div className="font-bold text-lg text-gray-900 font-mono">
                                            {credentials.username}
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                            copyToClipboard(
                                                credentials.username
                                            )
                                        }
                                    >
                                        <Copy className="h-4 w-4" />
                                    </Button>
                                </div>

                                <div className="flex items-center justify-between bg-white border rounded-lg px-4 py-3">
                                    <div>
                                        <div className="text-xs text-gray-500">
                                            Contraseña inicial
                                        </div>
                                        <div className="font-bold text-lg text-gray-900 font-mono">
                                            {credentials.password}
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                            copyToClipboard(
                                                credentials.password
                                            )
                                        }
                                    >
                                        <Copy className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            <p className="text-xs text-gray-500 text-center">
                                El postulante podrá ver estas credenciales al
                                consultar su resultado con su DNI. Se
                                recomienda cambiar la contraseña al primer
                                ingreso.
                            </p>

                            <div className="flex justify-end gap-2 pt-2">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        const text = `CREDENCIALES DE ACCESO\nPostulante: ${credentials.applicant_name}\nDNI: ${credentials.applicant_dni}\nUsuario: ${credentials.username}\nContraseña: ${credentials.password}`;
                                        copyToClipboard(text);
                                    }}
                                >
                                    <Copy className="h-4 w-4 mr-2" />
                                    Copiar todo
                                </Button>
                                <Button
                                    onClick={() => window.print()}
                                    className="bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                    <Printer className="h-4 w-4 mr-2" />
                                    Imprimir
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* ═══════════════════════════════════════════ */}
            {/* MODAL: Detalle del Pago                    */}
            {/* ═══════════════════════════════════════════ */}
            <Dialog open={detailModal} onOpenChange={setDetailModal}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Detalle del Pago</DialogTitle>
                    </DialogHeader>

                    {selectedRow && (
                        <div className="space-y-4">
                            <DetailSection title="Postulante">
                                <DetailRow
                                    label="Nombre"
                                    value={selectedRow.applicant_name}
                                />
                                <DetailRow
                                    label="DNI"
                                    value={selectedRow.applicant_dni}
                                />
                                <DetailRow
                                    label="Carrera"
                                    value={selectedRow.career_name}
                                />
                                <DetailRow
                                    label="N° Postulación"
                                    value={
                                        selectedRow.application_id
                                            ? `#${selectedRow.application_id}`
                                            : "—"
                                    }
                                />
                            </DetailSection>

                            <DetailSection title="Pago">
                                <DetailRow
                                    label="Monto"
                                    value={`S/. ${fmtMoney(selectedRow.amount)}`}
                                />
                                <DetailRow
                                    label="Método"
                                    value={
                                        selectedRow.method === "CASHIER"
                                            ? "Caja presencial"
                                            : selectedRow.method === "PSP"
                                                ? "Pasarela de pagos"
                                                : selectedRow.method
                                    }
                                />
                                <DetailRow
                                    label="Estado"
                                    value={
                                        <Badge
                                            className={
                                                getStatusConfig(
                                                    selectedRow.status
                                                ).class
                                            }
                                        >
                                            {
                                                getStatusConfig(
                                                    selectedRow.status
                                                ).label
                                            }
                                        </Badge>
                                    }
                                />
                                <DetailRow
                                    label="Fecha"
                                    value={fmtDate(selectedRow.created_at)}
                                />
                                {selectedRow.order_id && (
                                    <DetailRow
                                        label="N° Orden"
                                        value={selectedRow.order_id}
                                    />
                                )}
                            </DetailSection>

                            {(selectedRow.credentials_generated ||
                                selectedRow.username) && (
                                    <DetailSection title="Credenciales">
                                        <DetailRow
                                            label="Usuario"
                                            value={
                                                <span className="font-mono font-bold">
                                                    {selectedRow.username}
                                                </span>
                                            }
                                        />
                                        <DetailRow
                                            label="Estado cuenta"
                                            value={
                                                <Badge className="bg-blue-100 text-blue-700">
                                                    Activa
                                                </Badge>
                                            }
                                        />
                                    </DetailSection>
                                )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ═══════════════════════════════════════════════════════
// SUB-COMPONENTES
// ═══════════════════════════════════════════════════════

function StatBox({ label, value, color }) {
    const colors = {
        gray: "bg-gray-50 border-gray-200 text-gray-700",
        green: "bg-green-50 border-green-200 text-green-700",
        yellow: "bg-yellow-50 border-yellow-200 text-yellow-700",
        blue: "bg-blue-50 border-blue-200 text-blue-700",
    };
    return (
        <div
            className={`border rounded-xl p-3 text-center ${colors[color] || colors.gray}`}
        >
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-xs font-medium uppercase tracking-wider opacity-70">
                {label}
            </div>
        </div>
    );
}

function DetailSection({ title, children }) {
    return (
        <div className="border rounded-xl overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    {title}
                </span>
            </div>
            <div className="divide-y">{children}</div>
        </div>
    );
}

function DetailRow({ label, value }) {
    return (
        <div className="flex justify-between items-center px-4 py-2.5 text-sm">
            <span className="text-gray-500">{label}</span>
            <span className="font-semibold text-gray-900 text-right">
                {value || "—"}
            </span>
        </div>
    );
}