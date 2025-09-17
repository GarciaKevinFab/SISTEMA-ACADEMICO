import React, { useEffect, useState } from "react";
import { AdmissionSchedule, AdmissionCalls } from "../../services/admission.service";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { toast } from "sonner";
import { Plus } from "lucide-react";

const TYPES = [
    { v: "REGISTRATION", l: "Inscripciones" },
    { v: "EXAM", l: "Examen" },
    { v: "INTERVIEW", l: "Entrevistas" },
    { v: "RESULTS", l: "Publicación de resultados" },
    { v: "OTHER", l: "Otro" },
];

export default function AdmissionScheduleModule() {
    const [calls, setCalls] = useState([]);
    const [call, setCall] = useState(null);
    const [items, setItems] = useState([]);
    const [form, setForm] = useState({ type: "OTHER", title: "", start: "", end: "", notes: "" });
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
        const d = await AdmissionSchedule.list(call.id);
        setItems(d?.items || d || []);
    };
    useEffect(() => { if (call?.id) load(); }, [call?.id]);

    const add = async (e) => {
        e.preventDefault();
        try {
            await AdmissionSchedule.create(call.id, form);
            toast.success("Evento agregado");
            setForm({ type: "OTHER", title: "", start: "", end: "", notes: "" });
            load();
        } catch (e) {
            toast.error(e?.response?.data?.detail || "No se pudo agregar");
        }
    };

    const remove = async (id) => {
        await AdmissionSchedule.remove(call.id, id);
        load();
    };

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
    );

    return (
        <Card>
            <CardHeader><CardTitle>Cronograma de Admisión</CardTitle></CardHeader>
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
                </div>

                <form onSubmit={add} className="grid md:grid-cols-5 gap-3 items-end">
                    <div>
                        <label className="text-sm">Tipo</label>
                        <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {TYPES.map(t => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <label className="text-sm">Título</label>
                        <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                    </div>
                    <div>
                        <label className="text-sm">Inicio</label>
                        <Input type="datetime-local" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
                    </div>
                    <div>
                        <label className="text-sm">Fin</label>
                        <Input type="datetime-local" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
                    </div>
                    <div className="flex gap-2">
                        <Button type="submit" className="mt-6"><Plus className="h-4 w-4 mr-2" />Agregar</Button>
                    </div>
                    <div className="md:col-span-5">
                        <label className="text-sm">Notas</label>
                        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                    </div>
                </form>

                <div className="border rounded overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="p-2 text-left">Tipo</th>
                                <th className="p-2 text-left">Título</th>
                                <th className="p-2">Inicio</th>
                                <th className="p-2">Fin</th>
                                <th className="p-2 text-left">Notas</th>
                                <th className="p-2" />
                            </tr>
                        </thead>
                        <tbody>
                            {items.map(it => (
                                <tr key={it.id} className="border-t">
                                    <td className="p-2">{it.type}</td>
                                    <td className="p-2">{it.title}</td>
                                    <td className="p-2 text-center">{it.start ? new Date(it.start).toLocaleString() : "-"}</td>
                                    <td className="p-2 text-center">{it.end ? new Date(it.end).toLocaleString() : "-"}</td>
                                    <td className="p-2">{it.notes || "—"}</td>
                                    <td className="p-2 text-right">
                                        <Button variant="outline" size="sm" onClick={() => remove(it.id)} data-testid={`rm-${it.id}`}>Eliminar</Button>
                                    </td>
                                </tr>
                            ))}
                            {!items.length && <tr><td className="p-4 text-center text-gray-500" colSpan={6}>Sin eventos</td></tr>}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}
