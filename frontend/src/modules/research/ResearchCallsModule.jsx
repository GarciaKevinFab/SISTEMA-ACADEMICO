import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { toast } from "sonner";
import { Plus, Save, Edit3, Users, Award, CheckCircle, XCircle, Eye } from "lucide-react";
import { Calls, Proposals } from "../../services/research.service";

const defaultRubric = [
    { code: "ORIG", label: "Originalidad", weight: 0.25 },
    { code: "MET", label: "Metodología", weight: 0.25 },
    { code: "FACT", label: "Factibilidad", weight: 0.25 },
    { code: "IMPA", label: "Impacto", weight: 0.25 },
];

export default function ResearchCallsModule() {
    const [calls, setCalls] = useState([]);
    const [openForm, setOpenForm] = useState(false);
    const [form, setForm] = useState({ name: "", year: new Date().getFullYear(), start_date: "", end_date: "", description: "" });
    const [rubric, setRubric] = useState(defaultRubric);
    const [detail, setDetail] = useState(null);
    const [proposals, setProposals] = useState([]);
    const [reviewDialog, setReviewDialog] = useState(false);
    const [reviewTarget, setReviewTarget] = useState(null);
    const [scores, setScores] = useState({}); // {code: 0-20}
    const [comment, setComment] = useState("");

    const load = useCallback(async () => {
        try { const d = await Calls.list(); setCalls(d?.calls || d || []); }
        catch (e) { toast.error(e.message || "Error al cargar convocatorias"); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const openCreate = () => { setForm({ name: "", year: new Date().getFullYear(), start_date: "", end_date: "", description: "" }); setRubric(defaultRubric); setOpenForm(true); };

    const saveCall = async (e) => {
        e.preventDefault();
        try {
            const c = await Calls.create(form);
            await Calls.setRubric(c.id || c.call?.id || c?.call_id || c?.id, { criteria: rubric });
            toast.success("Convocatoria creada");
            setOpenForm(false); load();
        } catch (e) { toast.error(e.message || "No se pudo crear"); }
    };

    const openDetail = async (c) => {
        setDetail(c);
        try { const d = await Calls.proposals(c.id); setProposals(d?.items || d || []); }
        catch (e) { toast.error("No se pudo listar postulaciones"); }
    };

    const openReview = (p) => { setReviewTarget(p); setScores({}); setComment(""); setReviewDialog(true); };

    const saveReview = async () => {
        try {
            await Proposals.reviewSave(reviewTarget.id, { scores, comment });
            toast.success("Evaluación registrada");
            setReviewDialog(false);
            if (detail) openDetail(detail);
        } catch (e) { toast.error(e.message || "No se pudo guardar evaluación"); }
    };

    const decide = async (p, decision) => {
        try { await Proposals.decide(p.id, decision, ""); toast.success("Decisión registrada"); if (detail) openDetail(detail); }
        catch (e) { toast.error(e.message || "No se pudo registrar decisión"); }
    };

    const convert = async (p) => {
        try { await Proposals.convertToProject(p.id); toast.success("Proyecto creado"); if (detail) openDetail(detail); }
        catch (e) { toast.error(e.message || "No se pudo convertir a proyecto"); }
    };

    const sum = rubric.reduce((a, b) => a + (+b.weight || 0), 0);

    return (
        <div className="space-y-6 pb-24 sm:pb-6">

            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold">Convocatorias</h2>
                    <p className="text-sm text-gray-600">Gestión de llamadas y evaluaciones</p>
                </div>
                <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Nueva Convocatoria</Button>
            </div>

            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="p-2 text-left">Nombre</th>
                                    <th className="p-2 text-left">Año</th>
                                    <th className="p-2 text-left">Vigencia</th>
                                    <th className="p-2 text-left">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {calls.map(c => (
                                    <tr key={c.id}>
                                        <td className="p-2">{c.name}</td>
                                        <td className="p-2">{c.year}</td>
                                        <td className="p-2">{c.start_date} — {c.end_date}</td>
                                        <td className="p-2">
                                            <Button size="sm" variant="outline" onClick={() => openDetail(c)}><Eye className="h-4 w-4 mr-2" />Abrir</Button>
                                        </td>
                                    </tr>
                                ))}
                                {calls.length === 0 && <tr><td className="p-4 text-center text-gray-500" colSpan={4}>Sin convocatorias</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Crear convocatoria */}
            <Dialog open={openForm} onOpenChange={setOpenForm}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader><DialogTitle>Nueva Convocatoria</DialogTitle></DialogHeader>
                    <form onSubmit={saveCall} className="space-y-4">
                        <div className="grid md:grid-cols-2 gap-3">
                            <div><Label>Nombre</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
                            <div><Label>Año</Label><Input type="number" value={form.year} onChange={e => setForm({ ...form, year: +e.target.value })} required /></div>
                            <div><Label>Inicio</Label><Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
                            <div><Label>Fin</Label><Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} /></div>
                            <div className="md:col-span-2"><Label>Descripción</Label><Textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
                        </div>

                        <div className="border rounded p-3 space-y-2">
                            <div className="font-medium">Rúbrica</div>
                            {rubric.map((it, idx) => (
                                <div key={it.code} className="grid grid-cols-5 gap-2">
                                    <Input className="col-span-3" value={it.label} onChange={e => {
                                        const r = [...rubric]; r[idx] = { ...r[idx], label: e.target.value }; setRubric(r);
                                    }} />
                                    <Input className="col-span-2" type="number" min="0" max="1" step="0.01" value={it.weight}
                                        onChange={e => { const r = [...rubric]; r[idx] = { ...r[idx], weight: +e.target.value }; setRubric(r); }} />
                                </div>
                            ))}
                            <div className={`text-sm ${sum === 1 ? 'text-green-600' : 'text-red-600'}`}>Suma: {(sum * 100).toFixed(0)}%</div>
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setOpenForm(false)}>Cancelar</Button>
                            <Button type="submit" disabled={sum !== 1}><Save className="h-4 w-4 mr-2" />Guardar</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Detalle convocatoria: postulaciones */}
            {detail && (
                <Card>
                    <CardHeader><CardTitle>Postulaciones — {detail.name}</CardTitle></CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="p-2 text-left">Código</th>
                                        <th className="p-2 text-left">Título</th>
                                        <th className="p-2 text-left">Responsable</th>
                                        <th className="p-2 text-left">Estado</th>
                                        <th className="p-2 text-left">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {proposals.map(p => (
                                        <tr key={p.id}>
                                            <td className="p-2">{p.code || `PR-${p.id}`}</td>
                                            <td className="p-2">{p.title}</td>
                                            <td className="p-2">{p.pi_name}</td>
                                            <td className="p-2">{p.status}</td>
                                            <td className="p-2">
                                                <div className="flex gap-2">
                                                    <Button size="sm" variant="outline" onClick={() => openReview(p)}><Award className="h-4 w-4 mr-1" />Evaluar</Button>
                                                    <Button size="sm" variant="outline" onClick={() => decide(p, "APPROVED")}><CheckCircle className="h-4 w-4 mr-1" />Aprobar</Button>
                                                    <Button size="sm" variant="outline" onClick={() => decide(p, "REJECTED")}><XCircle className="h-4 w-4 mr-1" />Rechazar</Button>
                                                    {p.status === "APPROVED" && (
                                                        <Button size="sm" variant="outline" onClick={() => convert(p)}><Users className="h-4 w-4 mr-1" />Crear Proyecto</Button>
                                                    )}
                                                </div>
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

            {/* Dialog evaluación */}
            <Dialog open={reviewDialog} onOpenChange={setReviewDialog}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Evaluar Propuesta</DialogTitle></DialogHeader>
                    {reviewTarget && (
                        <div className="space-y-3">
                            <div className="text-sm text-gray-600">{reviewTarget.title}</div>
                            {defaultRubric.map(cr => (
                                <div key={cr.code}>
                                    <Label>{cr.label} (0–20)</Label>
                                    <Input type="number" min="0" max="20" step="0.5" value={scores[cr.code] || ""} onChange={e => setScores(s => ({ ...s, [cr.code]: +e.target.value }))} />
                                </div>
                            ))}
                            <div>
                                <Label>Comentario</Label>
                                <Textarea rows={3} value={comment} onChange={e => setComment(e.target.value)} />
                            </div>
                            <div className="flex justify-end">
                                <Button onClick={saveReview}><Save className="h-4 w-4 mr-2" />Guardar</Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
