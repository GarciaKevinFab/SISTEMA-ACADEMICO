import React, { useEffect, useMemo, useState } from "react";
import { Accounts, Concepts, Payments } from "../../services/finance.service";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Badge } from "../../components/ui/badge";
import { toast } from "../../utils/safeToast"; // <- usa safeToast
import { Save, CreditCard, FileText, Plus } from "lucide-react";
import { generatePDFWithPolling, downloadFile } from "../../utils/pdfQrPolling";
import { fmtCurrency, formatApiError, toLimaDate } from "../../utils/format";
import { optVal, safeText } from "../../utils/ui";

// helper de error consistente
const showApiError = (e, fallback) => toast.error(formatApiError(e, fallback));

export default function StudentAccountsDashboard() {
    const [subjectType, setSubjectType] = useState("STUDENT");
    const [subjectId, setSubjectId] = useState("");
    const [statement, setStatement] = useState(null);
    const [concepts, setConcepts] = useState([]);

    const [charge, setCharge] = useState({ concept_id: "", amount: "", due_date: "" });
    const [payment, setPayment] = useState({ amount: "", method: "CASH", ref: "", date: "" });
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const cs = await Concepts.list();
                setConcepts(cs?.items ?? cs ?? []);
            } catch {
                // silencioso
            }
        })();
    }, []);

    const fetchStatement = async () => {
        if (!subjectId) return toast.error("Ingrese ID/DNI");
        try {
            setLoading(true);
            const data = await Accounts.statement({ subject_id: subjectId, subject_type: subjectType });
            setStatement(data);
        } catch (e) {
            showApiError(e, "No se pudo cargar el estado de cuenta");
        } finally {
            setLoading(false);
        }
    };

    const totals = useMemo(() => {
        if (!statement) return { charges: 0, payments: 0, balance: 0, overdue: 0 };
        const ch = (statement.charges || []).reduce((a, c) => a + Number(c.amount || 0), 0);
        const py = (statement.payments || []).reduce((a, p) => a + Number(p.amount || 0), 0);
        const bal = ch - py;
        const overdue = (statement.charges || []).filter(
            (c) => !c.paid && c.due_date && new Date(c.due_date) < new Date()
        ).length;
        return { charges: ch, payments: py, balance: bal, overdue };
    }, [statement]);

    const createCharge = async () => {
        if (!subjectId || !charge.concept_id) return toast.error("Concepto y sujeto requeridos");
        try {
            await Accounts.charge({
                subject_id: subjectId,
                subject_type: subjectType,
                concept_id: Number(charge.concept_id),
                amount: charge.amount === "" ? undefined : Number(charge.amount), // permite 0
                due_date: charge.due_date || undefined,
            });
            toast.success("Cargo registrado");
            setCharge({ concept_id: "", amount: "", due_date: "" });
            fetchStatement();
        } catch (e) {
            showApiError(e, "No se pudo registrar el cargo");
        }
    };

    const registerPayment = async () => {
        if (!subjectId || payment.amount === "") return toast.error("Monto requerido");
        try {
            await Accounts.pay({
                subject_id: subjectId,
                subject_type: subjectType,
                amount: Number(payment.amount),
                method: payment.method,
                ref: payment.ref || undefined,
                date: payment.date || undefined,
            });
            toast.success("Pago registrado");
            setPayment({ amount: "", method: "CASH", ref: "", date: "" });
            fetchStatement();
        } catch (e) {
            showApiError(e, "No se pudo registrar el pago");
        }
    };

    const exportPdf = async () => {
        if (!subjectId) return toast.error("Ingrese ID/DNI");

        try {
            setExporting(true);

            const res = await Accounts.statementPdf({
                subject_id: subjectId,
                subject_type: subjectType,
            });

            const blob = new Blob([res.data], { type: "application/pdf" });
            const url = window.URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = url;
            a.download = `estado-cuenta-${subjectId}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();

            window.URL.revokeObjectURL(url);
            toast.success("PDF descargado");
        } catch (e) {
            showApiError(e, "No se pudo exportar PDF");
        } finally {
            setExporting(false);
        }
    };


    const payLink = async () => {
        try {
            if (totals.balance <= 0) return toast.error("No hay saldo por pagar");
            const r = await Payments.createCheckout({
                subject_id: subjectId,
                subject_type: subjectType,
                amount: Number(totals.balance.toFixed(2)),
                currency: "PEN",
                meta: { origin: "STUDENT_ACCOUNTS_UI" },
            });
            const url = r?.url;
            if (!url) return toast.error("No se pudo generar link de pago");
            if (!/^https?:\/\//i.test(url)) return toast.error("URL de pago inválida");
            const win = window.open(url, "_blank");
            if (!win) toast.error("Pop-up bloqueado. Habilita ventanas emergentes.");
        } catch (e) {
            showApiError(e, "No se pudo generar el link de pago");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold">Estados de cuenta</h2>
                    <p className="text-sm text-gray-600">Cargos, pagos, morosidad y constancia</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={exportPdf} disabled={exporting}>
                        <FileText className="h-4 w-4 mr-2" aria-hidden="true" />
                        {exporting ? "Generando…" : "PDF"}
                    </Button>
                    <Button onClick={payLink}>
                        <CreditCard className="h-4 w-4 mr-2" aria-hidden="true" />
                        Generar link de pago
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Búsqueda</CardTitle>
                    <CardDescription>Alumno o postulante</CardDescription>
                </CardHeader>
                <CardContent className="grid md:grid-cols-4 gap-3">
                    <div>
                        <Label>Tipo</Label>
                        <Select value={subjectType} onValueChange={setSubjectType}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="STUDENT">Alumno</SelectItem>
                                <SelectItem value="APPLICANT">Postulante</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="md:col-span-2">
                        <Label>ID / DNI</Label>
                        <Input value={subjectId} onChange={(e) => setSubjectId(e.target.value)} placeholder="Ej. 71234567" />
                    </div>
                    <div className="flex items-end">
                        <Button onClick={fetchStatement}>Buscar</Button>
                    </div>
                </CardContent>
            </Card>

            {statement && (
                <>
                    <Card>
                        <CardHeader>
                            <CardTitle>Resumen</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-wrap gap-6 text-sm">
                            <div>
                                <b>Estudiante:</b> {safeText(statement.subject_name)}
                            </div>
                            <div>
                                <b>Carrera:</b> {safeText(statement.career_name)}
                            </div>
                            <div>
                                <b>Cargos:</b> <Badge variant="outline">{fmtCurrency(totals.charges)}</Badge>
                            </div>
                            <div>
                                <b>Pagos:</b> <Badge variant="outline">{fmtCurrency(totals.payments)}</Badge>
                            </div>
                            <div>
                                <b>Saldo:</b> <Badge>{fmtCurrency(totals.balance)}</Badge>
                            </div>
                            <div>
                                <b>Cuotas vencidas:</b>{" "}
                                <Badge variant={totals.overdue > 0 ? "destructive" : "secondary"}>{totals.overdue}</Badge>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid lg:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Registrar cargo</CardTitle>
                                <CardDescription>Cuotas, certificados, etc.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid md:grid-cols-3 gap-3">
                                <div className="md:col-span-2">
                                    <Label>Concepto</Label>
                                    <Select
                                        value={charge.concept_id}
                                        onValueChange={(v) => {
                                            const c = concepts.find((x) => String(x.id) === v);
                                            setCharge({
                                                ...charge,
                                                concept_id: v,
                                                amount:
                                                    charge.amount !== ""
                                                        ? charge.amount
                                                        : c?.default_amount != null
                                                            ? String(c.default_amount)
                                                            : "",
                                            });
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccione..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {concepts.map((c) => {
                                                const v = optVal(c.id);
                                                if (!v) return null;
                                                return (
                                                    <SelectItem key={v} value={String(v)}>
                                                        {c.name} ({c.type})
                                                    </SelectItem>
                                                );
                                            })}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Monto</Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={charge.amount}
                                        onChange={(e) => setCharge({ ...charge, amount: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <Label>Vence</Label>
                                    <Input
                                        type="date"
                                        value={charge.due_date}
                                        onChange={(e) => setCharge({ ...charge, due_date: e.target.value })}
                                    />
                                </div>
                                <div className="md:col-span-2 flex items-end justify-end">
                                    <Button onClick={createCharge}>
                                        <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
                                        Agregar cargo
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Registrar pago</CardTitle>
                            </CardHeader>
                            <CardContent className="grid md:grid-cols-4 gap-3">
                                <div>
                                    <Label>Monto</Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={payment.amount}
                                        onChange={(e) => setPayment({ ...payment, amount: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <Label>Método</Label>
                                    <Select value={payment.method} onValueChange={(v) => setPayment({ ...payment, method: v })}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="CASH">Efectivo</SelectItem>
                                            <SelectItem value="CARD">Tarjeta</SelectItem>
                                            <SelectItem value="TRANSFER">Transferencia</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Ref.</Label>
                                    <Input
                                        value={payment.ref}
                                        onChange={(e) => setPayment({ ...payment, ref: e.target.value })}
                                        placeholder="operación / voucher"
                                    />
                                </div>
                                <div>
                                    <Label>Fecha</Label>
                                    <Input
                                        type="date"
                                        value={payment.date}
                                        onChange={(e) => setPayment({ ...payment, date: e.target.value })}
                                    />
                                </div>
                                <div className="md:col-span-4 flex justify-end">
                                    <Button onClick={registerPayment}>
                                        <Save className="h-4 w-4 mr-2" aria-hidden="true" />
                                        Guardar pago
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Detalle</CardTitle>
                            <CardDescription>Cargos y pagos</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50 border-b">
                                        <tr>
                                            <th scope="col" className="px-4 py-2 text-left text-xs font-semibold">
                                                Fecha
                                            </th>
                                            <th scope="col" className="px-4 py-2 text-left text-xs font-semibold">
                                                Tipo
                                            </th>
                                            <th scope="col" className="px-4 py-2 text-left text-xs font-semibold">
                                                Detalle
                                            </th>
                                            <th scope="col" className="px-4 py-2 text-right text-xs font-semibold">
                                                Monto
                                            </th>
                                            <th scope="col" className="px-4 py-2 text-left text-xs font-semibold">
                                                Estado
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {(statement.ledger || []).map((it, idx) => (
                                            <tr key={idx}>
                                                <td className="px-4 py-2 text-sm text-gray-600">{toLimaDate(it.date)}</td>
                                                <td className="px-4 py-2 text-xs">{safeText(it.kind)}</td>
                                                <td className="px-4 py-2">{safeText(it.description)}</td>
                                                <td className="px-4 py-2 text-right">{fmtCurrency(it.amount)}</td>
                                                <td className="px-4 py-2 text-xs">{safeText(it.status)}</td>
                                            </tr>
                                        ))}
                                        {(statement.ledger || []).length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="text-center py-8 text-gray-500">
                                                    Sin movimientos.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
