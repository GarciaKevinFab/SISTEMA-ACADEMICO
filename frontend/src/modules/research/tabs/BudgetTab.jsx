import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../../../components/ui/select";
import { toast } from "sonner";
import { Budget } from "../../../services/research.service";
import { Plus, Trash2, Save, Download, Paperclip, Upload } from "lucide-react";
import { generatePDFWithPolling, downloadFile } from "../../../utils/pdfQrPolling";

const CATS = ["RRHH", "Bienes", "Servicios", "Viajes", "Otros"];

export default function BudgetTab({ projectId }) {
    const [rows, setRows] = useState([]);
    const [summary, setSummary] = useState({ planned: 0, executed: 0 });
    const [newRow, setNewRow] = useState({ date: "", category: "RRHH", item: "", planned: 0, executed: 0, doc_type: "", doc_number: "" });
    const [receipt, setReceipt] = useState({ itemId: null, file: null });

    const load = useCallback(async () => {
        try {
            const d = await Budget.list(projectId);
            setRows(d?.items || []);
            setSummary(d?.summary || { planned: 0, executed: 0 });
        } catch (e) { toast.error(e.message || "Error al cargar presupuesto"); }
    }, [projectId]);

    useEffect(() => { load(); }, [load]);

    const add = async () => {
        if (!newRow.item) return toast.error("Detalle requerido");
        try {
            await Budget.createItem(projectId, { ...newRow, planned: Number(newRow.planned || 0), executed: Number(newRow.executed || 0) });
            setNewRow({ date: "", category: "RRHH", item: "", planned: 0, executed: 0, doc_type: "", doc_number: "" });
            load(); toast.success("Partida agregada");
        } catch (e) { toast.error(e.message || "No se pudo agregar"); }
    };

    const update = async (r, patch) => {
        try {
            await Budget.updateItem(projectId, r.id, patch);
            load();
        } catch (e) { toast.error(e.message || "No se pudo actualizar"); }
    };

    const remove = async (r) => {
        if (!confirm(`¿Eliminar partida "${r.item}"?`)) return;
        try { await Budget.removeItem(projectId, r.id); load(); }
        catch (e) { toast.error(e.message || "No se pudo eliminar"); }
    };

    const exportXlsx = async () => {
        try {
            const res = await Budget.exportXlsx(projectId, {});
            // si tu backend devuelve blob directamente, adapta:
            const blob = res?.blob ? await res.blob() : new Blob([JSON.stringify(res || {})], { type: "application/octet-stream" });
            const url = URL.createObjectURL(blob); const a = document.createElement("a");
            a.href = url; a.download = `presupuesto-${projectId}.xlsx`; a.click(); URL.revokeObjectURL(url);
        } catch (e) { toast.error("No se pudo exportar"); }
    };

    const exportPdf = async () => {
        try {
            const out = await generatePDFWithPolling(`/research/projects/${projectId}/budget/export`, {}, { testId: "budget-pdf" });
            if (out?.success) { await downloadFile(out.downloadUrl, `presupuesto-${projectId}.pdf`); toast.success("Exportado"); }
            else toast.error("No se pudo exportar PDF");
        } catch (e) { toast.error("Error al exportar PDF"); }
    };

    const totals = useMemo(() => rows.reduce((acc, r) => ({ planned: acc.planned + (+r.planned || 0), executed: acc.executed + (+r.executed || 0) }), { planned: 0, executed: 0 }), [rows]);

    const uploadReceipt = async () => {
        if (!receipt.itemId || !receipt.file) return;
        try {
            await Budget.uploadReceipt(projectId, receipt.itemId, receipt.file);
            setReceipt({ itemId: null, file: null }); load(); toast.success("Comprobante adjuntado");
        } catch (e) { toast.error(e.message || "No se pudo adjuntar"); }
    };

    return (
        <div className="space-y-4">
            <h4 className="font-semibold">Presupuesto & Ejecución</h4>

            <Card>
                <CardHeader><CardTitle>Nueva partida</CardTitle></CardHeader>
                <CardContent className="grid md:grid-cols-6 gap-3">
                    <div><Label>Fecha</Label><Input type="date" value={newRow.date} onChange={e => setNewRow({ ...newRow, date: e.target.value })} /></div>
                    <div>
                        <Label>Categoría</Label>
                        <Select value={newRow.category} onValueChange={v => setNewRow({ ...newRow, category: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>{CATS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="md:col-span-2"><Label>Detalle</Label><Input value={newRow.item} onChange={e => setNewRow({ ...newRow, item: e.target.value })} /></div>
                    <div><Label>Planificado</Label><Input type="number" step="0.01" value={newRow.planned} onChange={e => setNewRow({ ...newRow, planned: e.target.value })} /></div>
                    <div><Label>Ejecutado</Label><Input type="number" step="0.01" value={newRow.executed} onChange={e => setNewRow({ ...newRow, executed: e.target.value })} /></div>
                    <div><Label>Tipo Doc.</Label><Input value={newRow.doc_type} onChange={e => setNewRow({ ...newRow, doc_type: e.target.value })} /></div>
                    <div><Label>Nro Doc.</Label><Input value={newRow.doc_number} onChange={e => setNewRow({ ...newRow, doc_number: e.target.value })} /></div>
                    <div className="md:col-span-6 flex justify-end"><Button onClick={add}><Plus className="h-4 w-4 mr-2" />Agregar</Button></div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b"><tr>
                                <th className="p-2 text-left text-xs">Fecha</th><th className="p-2 text-left text-xs">Categoría</th><th className="p-2 text-left text-xs">Detalle</th><th className="p-2 text-right text-xs">Planificado</th><th className="p-2 text-right text-xs">Ejecutado</th><th className="p-2 text-left text-xs">Doc</th><th className="p-2 text-right text-xs">Adj.</th><th className="p-2 text-right text-xs">Acciones</th>
                            </tr></thead>
                            <tbody className="divide-y">
                                {rows.map(r => (
                                    <tr key={r.id}>
                                        <td className="p-2">{r.date?.slice(0, 10) || "-"}</td>
                                        <td className="p-2">
                                            <Select value={r.category || "RRHH"} onValueChange={v => update(r, { category: v })}>
                                                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                                                <SelectContent>{CATS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </td>
                                        <td className="p-2">{r.item}</td>
                                        <td className="p-2 text-right"><Input className="text-right" type="number" step="0.01" value={r.planned ?? 0} onChange={e => update(r, { planned: +e.target.value || 0 })} /></td>
                                        <td className="p-2 text-right"><Input className="text-right" type="number" step="0.01" value={r.executed ?? 0} onChange={e => update(r, { executed: +e.target.value || 0 })} /></td>
                                        <td className="p-2 text-sm">{[r.doc_type, r.doc_number].filter(Boolean).join(" ") || "-"}</td>
                                        <td className="p-2 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {r.receipt_url ? <a className="text-blue-600 underline text-sm" href={r.receipt_url} target="_blank" rel="noreferrer"><Paperclip className="h-4 w-4 inline mr-1" />Ver</a> : null}
                                                <label className="cursor-pointer inline-flex items-center gap-1">
                                                    <Upload className="h-4 w-4" />
                                                    <input type="file" className="hidden" onChange={e => setReceipt({ itemId: r.id, file: e.target.files?.[0] || null })} />
                                                </label>
                                            </div>
                                        </td>
                                        <td className="p-2 text-right">
                                            <Button variant="outline" size="sm" onClick={() => remove(r)}><Trash2 className="h-4 w-4" /></Button>
                                        </td>
                                    </tr>
                                ))}
                                {rows.length === 0 && <tr><td className="p-4 text-center text-gray-500" colSpan={8}>Sin partidas</td></tr>}
                            </tbody>
                            <tfoot>
                                <tr className="bg-gray-50 font-semibold">
                                    <td className="p-2" colSpan={3}>Totales</td>
                                    <td className="p-2 text-right">{totals.planned.toFixed(2)}</td>
                                    <td className="p-2 text-right">{totals.executed.toFixed(2)}</td>
                                    <td className="p-2" colSpan={3}></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </CardContent>
            </Card>

            <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">Planificado: <b>S/. {summary.planned?.toFixed?.(2) ?? totals.planned.toFixed(2)}</b> · Ejecutado: <b>S/. {summary.executed?.toFixed?.(2) ?? totals.executed.toFixed(2)}</b></div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={exportXlsx}><Download className="h-4 w-4 mr-2" />Exportar XLSX</Button>
                    <Button onClick={exportPdf}><Download className="h-4 w-4 mr-2" />Exportar PDF</Button>
                    <Button disabled={!receipt.itemId || !receipt.file} onClick={uploadReceipt}><Save className="h-4 w-4 mr-2" />Adjuntar comprobante</Button>
                </div>
            </div>
        </div>
    );
}
