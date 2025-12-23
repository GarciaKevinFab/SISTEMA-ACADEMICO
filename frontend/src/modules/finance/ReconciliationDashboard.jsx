import React, { useEffect, useState } from "react";
import { Reconciliation } from "../../services/finance.service";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { toast } from "../../utils/safeToast"; // <- usa safeToast
import { Save, RefreshCw } from "lucide-react";
import { generatePDFWithPolling, downloadFile } from "../../utils/pdfQrPolling";
import { fmtCurrency, formatApiError, toLimaDate } from "../../utils/format";
import { optVal, safeText } from "../../utils/ui";

// helper de error consistente
const showApiError = (e, fallback) => toast.error(formatApiError(e, fallback));

export default function ReconciliationDashboard() {
    const [accounts, setAccounts] = useState([]);
    const [form, setForm] = useState({ account_id: "", date_from: "", date_to: "" });
    const [rows, setRows] = useState([]);
    const [statementBalance, setStatementBalance] = useState("");
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const data = await Reconciliation.bankAccounts();
                setAccounts(data?.items ?? data ?? []);
            } catch (e) {
                showApiError(e, "No se pudieron cargar las cuentas");
            }
        })();
    }, []);

    const load = async () => {
        if (!form.account_id || !form.date_from || !form.date_to) {
            toast.error("Seleccione cuenta y rango de fechas");
            return;
        }
        try {
            setLoading(true);
            const data = await Reconciliation.movements({ ...form });
            const list = data?.items ?? data ?? [];
            setRows(list.map((m) => ({ ...m, reconciled: Boolean(m.reconciled) })));
        } catch (e) {
            showApiError(e, "No se pudieron cargar los movimientos");
        } finally {
            setLoading(false);
        }
    };

    const totalLedger = rows.reduce((acc, r) => acc + Number(r.amount || 0), 0);
    const totalReconciled = rows.filter((r) => r.reconciled).reduce((acc, r) => acc + Number(r.amount || 0), 0);
    const diff = Number(statementBalance || 0) - totalReconciled;

    const save = async () => {
        if (!form.account_id) return toast.error("Seleccione una cuenta");
        try {
            setSaving(true);
            await Reconciliation.save({
                account_id: String(form.account_id),
                date_from: form.date_from,
                date_to: form.date_to,
                statement_balance: Number(statementBalance || 0),
                items: rows.map((r) => ({ movement_id: r.id, reconciled: !!r.reconciled })),
            });
            toast.success("Conciliación guardada");
        } catch (e) {
            showApiError(e, "No se pudo guardar la conciliación");
        } finally {
            setSaving(false);
        }
    };

    const exportPdf = async () => {
        try {
            setExporting(true);
            const res = await generatePDFWithPolling(
                "/finance/reconciliation/export",
                { ...form, statement_balance: Number(statementBalance || 0) },
                { testId: "reconcil-pdf" }
            );
            if (res?.success) await downloadFile(res.downloadUrl, `conciliacion-${form.account_id}.pdf`);
            else toast.error("No se pudo generar el PDF");
        } catch (e) {
            showApiError(e, "No se pudo exportar PDF");
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold">Conciliación bancaria</h2>
                    <p className="text-sm text-gray-600">Marca movimientos conciliados y registra el saldo de extracto</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={load}>
                        <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
                        Cargar
                    </Button>
                    <Button onClick={exportPdf} disabled={exporting}>
                        {exporting ? (
                            <>
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                                Generando…
                            </>
                        ) : (
                            "Exportar PDF"
                        )}
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Parámetros</CardTitle>
                    <CardDescription>Cuenta y rango de fechas</CardDescription>
                </CardHeader>
                <CardContent className="grid md:grid-cols-4 gap-3">
                    <div>
                        <Label>Cuenta</Label>
                        <Select value={form.account_id} onValueChange={(v) => setForm({ ...form, account_id: v })}>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccionar" />
                            </SelectTrigger>
                            <SelectContent>
                                {accounts.map((a) => {
                                    const v = optVal(a.id);
                                    if (!v) return null;
                                    return (
                                        <SelectItem key={v} value={String(v)}>
                                            {a.bank_name} {a.account_number}
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label>Desde</Label>
                        <Input type="date" value={form.date_from} onChange={(e) => setForm({ ...form, date_from: e.target.value })} />
                    </div>
                    <div>
                        <Label>Hasta</Label>
                        <Input type="date" value={form.date_to} onChange={(e) => setForm({ ...form, date_to: e.target.value })} />
                    </div>
                    <div>
                        <Label>Saldo extracto</Label>
                        <Input
                            type="number"
                            step="0.01"
                            value={statementBalance}
                            onChange={(e) => setStatementBalance(e.target.value)}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Movimientos</CardTitle>
                    <CardDescription>Marca los conciliados (la diferencia usa solo movimientos marcados)</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center h-40" aria-busy="true">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-600" />
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th scope="col" className="px-4 py-2 text-left text-xs font-semibold">
                                            Fecha
                                        </th>
                                        <th scope="col" className="px-4 py-2 text-left text-xs font-semibold">
                                            Descripción
                                        </th>
                                        <th scope="col" className="px-4 py-2 text-right text-xs font-semibold">
                                            Monto
                                        </th>
                                        <th scope="col" className="px-4 py-2 text-center text-xs font-semibold">
                                            Conciliado
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {rows.map((r, idx) => (
                                        <tr key={r.id}>
                                            <td className="px-4 py-2 text-sm text-gray-600">{toLimaDate(r.date)}</td>
                                            <td className="px-4 py-2">{safeText(r.description)}</td>
                                            <td className="px-4 py-2 text-right">{fmtCurrency(r.amount)}</td>
                                            <td className="px-4 py-2 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={!!r.reconciled}
                                                    onChange={(e) => {
                                                        const checked = e.target.checked;
                                                        setRows((prev) => prev.map((x, i) => (i === idx ? { ...x, reconciled: checked } : x)));
                                                    }}
                                                    aria-label={`Conciliar movimiento ${r.id}`}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                    {rows.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="text-center py-8 text-gray-500">
                                                Sin movimientos en el rango.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                                {rows.length > 0 && (
                                    <tfoot>
                                        <tr className="bg-gray-50">
                                            <td className="px-4 py-2 font-semibold" colSpan={2}>
                                                Totales
                                            </td>
                                            <td className="px-4 py-2 text-right font-semibold">
                                                Libro: {fmtCurrency(totalLedger)}
                                                <br />
                                                Conciliados: {fmtCurrency(totalReconciled)}
                                            </td>
                                            <td className="px-4 py-2 text-center">
                                                <div className={`text-sm ${Math.abs(diff) < 0.01 ? "text-green-600" : "text-red-600"}`}>
                                                    Diferencia: {fmtCurrency(diff)}
                                                </div>
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    )}

                    <div className="p-4 flex justify-end">
                        <Button onClick={save} disabled={saving}>
                            {saving ? (
                                <>
                                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                                    Guardando…
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4 mr-2" aria-hidden="true" />
                                    Guardar conciliación
                                </>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
