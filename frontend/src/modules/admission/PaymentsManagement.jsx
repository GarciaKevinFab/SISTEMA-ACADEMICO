import React, { useEffect, useState } from "react";
import { AdmissionCalls, Payments } from "../../services/admission.service";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { toast } from "sonner";

const statusBadge = (s) =>
    s === "PAID" ? "bg-green-100 text-green-700"
        : s === "FAILED" ? "bg-red-100 text-red-700"
            : "bg-yellow-100 text-yellow-700";

export default function PaymentsManagement() {
    const [calls, setCalls] = useState([]);
    const [call, setCall] = useState(null);
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        AdmissionCalls.listAdmin().then((d) => {
            const list = d?.admission_calls || d?.calls || d || [];
            setCalls(list);
            setCall(list[0] || null);
        }).finally(() => setLoading(false));
    }, []);

    const load = async () => {
        if (!call) return;
        const d = await Payments.list({ call_id: call.id });
        setRows(d?.payments || d || []);
    };
    useEffect(() => { if (call?.id) load(); }, [call?.id]);

    const confirm = async (id) => {
        await Payments.confirm(id);
        toast.success("Pago confirmado");
        load();
    };
    const voidPay = async (id) => {
        await Payments.void(id);
        toast.success("Pago anulado");
        load();
    };
    const receipt = async (id) => {
        const resp = await Payments.receiptPdf(id);
        const blob = new Blob([resp.data], { type: resp.headers["content-type"] || "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `recibo_${id}.pdf`; a.click();
        URL.revokeObjectURL(url);
    };

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
    );

    return (
        <Card>
            <CardHeader><CardTitle>Pagos de Admisión</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <div className="grid md:grid-cols-3 gap-3">
                    <div>
                        <label className="text-sm">Convocatoria</label>
                        <Select value={call?.id?.toString()} onValueChange={(v) => setCall(calls.find(x => x.id.toString() === v))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {calls.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-end">
                        <Button variant="outline" onClick={load}>Refrescar</Button>
                    </div>
                </div>

                <div className="border rounded overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="p-2 text-left">Postulante</th>
                                <th className="p-2">Orden</th>
                                <th className="p-2">Método</th>
                                <th className="p-2">Estado</th>
                                <th className="p-2">Fecha</th>
                                <th className="p-2" />
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(r => (
                                <tr key={r.id} className="border-t">
                                    <td className="p-2 text-left">{r.applicant_name}</td>
                                    <td className="p-2 text-center">{r.order_id || "—"}</td>
                                    <td className="p-2 text-center">{r.method}</td>
                                    <td className="p-2 text-center">
                                        <Badge className={statusBadge(r.status)}>{r.status}</Badge>
                                    </td>
                                    <td className="p-2 text-center">{r.created_at ? new Date(r.created_at).toLocaleString() : "-"}</td>
                                    <td className="p-2 text-right">
                                        <div className="flex gap-2 justify-end">
                                            <Button variant="outline" size="sm" onClick={() => receipt(r.id)}>Recibo (PDF)</Button>
                                            {r.method === "CASHIER" && r.status !== "PAID" && (
                                                <Button size="sm" onClick={() => confirm(r.id)} data-testid={`confirm-${r.id}`}>Confirmar</Button>
                                            )}
                                            {r.status === "PAID" && (
                                                <Button variant="destructive" size="sm" onClick={() => voidPay(r.id)} data-testid={`void-${r.id}`}>Anular</Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {!rows.length && <tr><td className="p-4 text-center text-gray-500" colSpan={6}>Sin pagos</td></tr>}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}
