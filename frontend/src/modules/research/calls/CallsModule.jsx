import React, { useEffect, useState, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../../../components/ui/select";
import { toast } from "sonner";
import { Calls, Proposals, Reviews, Catalog } from "../../../services/research.service";
import { Plus, Eye, Save, Trash2, Download, Users, ClipboardList } from "lucide-react";
import { generatePDFWithPolling, downloadFile } from "../../../utils/pdfQrPolling";

const CallsModule = () => {
    const [calls, setCalls] = useState([]);
    const [openNew, setOpenNew] = useState(false);
    const [form, setForm] = useState({ code: "", title: "", start_date: "", end_date: "", budget_cap: "", description: "" });

    const [detail, setDetail] = useState(null);
    const [proposals, setProposals] = useState([]);
    const [advisors, setAdvisors] = useState([]);

    const load = useCallback(async () => {
        try { const d = await Calls.list(); setCalls(d?.items || d || []); } catch (e) { toast.error(e.message || "Error al cargar convocatorias"); }
    }, []);

    useEffect(() => { load(); Catalog.advisors().then(a => setAdvisors(a?.items || [])).catch(() => { }); }, [load]);

    const saveCall = async (e) => {
        e.preventDefault();
        try { await Calls.create({ ...form, budget_cap: Number(form.budget_cap || 0) }); setOpenNew(false); setForm({ code: "", title: "", start_date: "", end_date: "", budget_cap: "", description: "" }); load(); toast.success("Convocatoria creada"); }
        catch (e) { toast.error(e.message || "No se pudo crear"); }
    };

    const openDetail = async (call) => {
        setDetail(call);
        try { const d = await Proposals.list(call.id); setProposals(d?.items || d || []); } catch (e) { toast.error(e.message || "Error al cargar postulaciones"); }
    };

    const assignReviewer = async (p, reviewerId) => {
        try { await Reviews.assign(detail.id, p.id, reviewerId); const d = await Proposals.list(detail.id); setProposals(d?.items || []); toast.success("Revisor asignado"); }
        catch (e) { toast.error(e.message || "No se pudo asignar"); }
    };

    const exportRanking = async () => {
        try {
            const out = await generatePDFWithPolling(`/research/calls/${detail.id}/ranking/export`, {}, { testId: "calls-ranking" });
            if (out?.success) { await downloadFile(out.downloadUrl, `ranking-${detail.code || detail.id}.pdf`); toast.success("Exportado"); }
            else toast.error("No se pudo exportar");
        } catch (e) { toast.error("Error al exportar"); }
    };

    return (
        <div className="space-y-6 pb-24 sm:pb-6">

            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold">Convocatorias</h2>
                    <p className="text-sm text-gray-600">Registro de bases, postulaciones y ranking</p>
                </div>
                <Button onClick={() => setOpenNew(true)}><Plus className="h-4 w-4 mr-2" />Nueva Convocatoria</Button>
            </div>

            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b"><tr>
                                <th className="p-2 text-left text-xs">Código</th><th className="p-2 text-left text-xs">Título</th><th className="p-2 text-left text-xs">Fechas</th><th className="p-2 text-left text-xs">Tope (S/.)</th><th className="p-2 text-right text-xs">Acciones</th>
                            </tr></thead>
                            <tbody className="divide-y">
                                {calls.map(c => (
                                    <tr key={c.id}>
                                        <td className="p-2">{c.code}</td>
                                        <td className="p-2">{c.title}</td>
                                        <td className="p-2 text-sm text-gray-600">{c.start_date} — {c.end_date}</td>
                                        <td className="p-2">{Number(c.budget_cap || 0).toFixed(2)}</td>
                                        <td className="p-2 text-right">
                                            <Button variant="outline" size="sm" onClick={() => openDetail(c)}><Eye className="h-4 w-4" /></Button>
                                        </td>
                                    </tr>
                                ))}
                                {calls.length === 0 && <tr><td className="p-6 text-center text-gray-500" colSpan={5}>Sin convocatorias</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* create dialog */}
            <Dialog open={openNew} onOpenChange={setOpenNew}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader><DialogTitle>Nueva Convocatoria</DialogTitle></DialogHeader>
                    <form onSubmit={saveCall} className="grid md:grid-cols-2 gap-3">
                        <div><Label>Código</Label><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} required /></div>
                        <div><Label>Título</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required /></div>
                        <div><Label>Inicio</Label><Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
                        <div><Label>Fin</Label><Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} /></div>
                        <div><Label>Tope Presupuesto (S/.)</Label><Input type="number" step="0.01" value={form.budget_cap} onChange={e => setForm({ ...form, budget_cap: e.target.value })} /></div>
                        <div className="md:col-span-2"><Label>Descripción</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
                        <div className="md:col-span-2 flex justify-end"><Button type="submit"><Save className="h-4 w-4 mr-2" />Guardar</Button></div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* detail */}
            {detail && (
                <Card>
                    <CardHeader>
                        <CardTitle>{detail.title}</CardTitle>
                        <CardDescription>{detail.code} — Postulaciones</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex justify-end">
                            <Button onClick={exportRanking}><Download className="h-4 w-4 mr-2" />Exportar Ranking</Button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b"><tr>
                                    <th className="p-2 text-left text-xs">Proyecto</th><th className="p-2 text-left text-xs">Línea</th><th className="p-2 text-left text-xs">Estado</th><th className="p-2 text-left text-xs">Total</th><th className="p-2 text-right text-xs">Revisores</th>
                                </tr></thead>
                                <tbody className="divide-y">
                                    {proposals.map(p => (
                                        <tr key={p.id}>
                                            <td className="p-2">{p.title}</td>
                                            <td className="p-2">{p.line_name || "-"}</td>
                                            <td className="p-2">{p.status}</td>
                                            <td className="p-2">{p.total?.toFixed?.(2) ?? "-"}</td>
                                            <td className="p-2 text-right">
                                                <Select onValueChange={(v) => assignReviewer(p, v)}>
                                                    <SelectTrigger className="w-52"><SelectValue placeholder="Asignar revisor" /></SelectTrigger>
                                                    <SelectContent>
                                                        {advisors.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.full_name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </td>
                                        </tr>
                                    ))}
                                    {proposals.length === 0 && <tr><td className="p-4 text-center text-gray-500" colSpan={5}>Sin postulaciones</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default CallsModule;
