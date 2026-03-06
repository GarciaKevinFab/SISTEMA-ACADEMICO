import React, { useEffect, useMemo, useState } from "react";
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

// ✅ Formato seguro para strings tipo "YYYY-MM-DDTHH:mm" (sin timezone)
const fmtLocal = (v) => {
    if (!v) return "-";
    const s = String(v);
    const [d, t] = s.split("T");
    if (!d || !t) return s;
    return `${d} ${t.slice(0, 5)}`; // HH:mm
};

export default function AdmissionScheduleModule() {
    const [calls, setCalls] = useState([]);
    const [call, setCall] = useState(null);
    const [items, setItems] = useState([]);
    const [form, setForm] = useState({ type: "OTHER", title: "", start: "", end: "", notes: "" });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // ✅ Cargar convocatorias admin
    useEffect(() => {
        setLoading(true);
        AdmissionCalls.listAdmin()
            .then((d) => {
                const list = d?.admission_calls || d?.calls || d || [];
                setCalls(list);
                setCall(list[0] || null);
            })
            .catch((e) => {
                console.error(e);
                toast.error("No se pudieron cargar las convocatorias");
            })
            .finally(() => setLoading(false));
    }, []);

    // ✅ Cargar cronograma por convocatoria
    const load = async () => {
        if (!call?.id) return;
        try {
            const d = await AdmissionSchedule.list(call.id);
            const arr = Array.isArray(d) ? d : d?.items || [];
            setItems(arr);
        } catch (e) {
            console.error(e);
            toast.error("No se pudo cargar el cronograma");
            setItems([]);
        }
    };

    useEffect(() => {
        if (call?.id) load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [call?.id]);

    // ✅ Validaciones UX
    const canSubmit = useMemo(() => {
        if (!call?.id) return false;
        if (!form.title?.trim()) return false;
        if (!form.start || !form.end) return false;
        if (new Date(form.start) > new Date(form.end)) return false;
        return true;
    }, [call?.id, form.title, form.start, form.end]);

    const add = async (e) => {
        e.preventDefault();

        if (!call?.id) return toast.error("Selecciona una convocatoria");
        if (!form.title?.trim()) return toast.error("Escribe un título");
        if (!form.start || !form.end) return toast.error("Selecciona Inicio y Fin");
        if (new Date(form.start) > new Date(form.end)) return toast.error("Inicio no puede ser mayor que Fin");

        setSaving(true);
        try {
            await AdmissionSchedule.create(call.id, form);
            toast.success("Evento agregado");
            setForm({ type: "OTHER", title: "", start: "", end: "", notes: "" });
            await load();
        } catch (e2) {
            console.error(e2);
            toast.error(e2?.response?.data?.detail || "No se pudo agregar");
        } finally {
            setSaving(false);
        }
    };

    const remove = async (id) => {
        if (!call?.id) return;
        try {
            await AdmissionSchedule.remove(call.id, id);
            toast.success("Evento eliminado");
            await load();
        } catch (e) {
            console.error(e);
            toast.error("No se pudo eliminar");
        }
    };

    if (loading)
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            </div>
        );

    return (
        <Card>
            <CardHeader>
                <CardTitle>Cronograma de Admisión</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Convocatoria */}
                <div className="grid md:grid-cols-3 gap-3">
                    <div>
                        <label className="text-sm">Convocatoria</label>

                        <Select
                            value={call?.id?.toString() || ""}
                            onValueChange={(v) => setCall(calls.find((x) => x.id.toString() === v) || null)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder={calls.length ? "Selecciona" : "No hay convocatorias"} />
                            </SelectTrigger>

                            <SelectContent>
                                {calls.map((c) => (
                                    <SelectItem key={c.id} value={c.id.toString()}>
                                        {c.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={add} className="grid md:grid-cols-5 gap-3 items-end">
                    <div>
                        <label className="text-sm">Tipo</label>
                        <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {TYPES.map((t) => (
                                    <SelectItem key={t.v} value={t.v}>
                                        {t.l}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <label className="text-sm">Título</label>
                        <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                    </div>

                    {/* ✅ FECHAS: input nativo para que SIEMPRE aparezca el selector */}
                    <div>
                        <label className="text-sm">Inicio</label>
                        <input
                            type="datetime-local"
                            value={form.start}
                            onChange={(e) => setForm({ ...form, start: e.target.value })}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                        />
                    </div>

                    <div>
                        <label className="text-sm">Fin</label>
                        <input
                            type="datetime-local"
                            value={form.end}
                            onChange={(e) => setForm({ ...form, end: e.target.value })}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                        />
                    </div>

                    <div className="flex gap-2">
                        <Button type="submit" className="mt-6" disabled={!canSubmit || saving}>
                            <Plus className="h-4 w-4 mr-2" />
                            {saving ? "Agregando..." : "Agregar"}
                        </Button>
                    </div>

                    <div className="md:col-span-5">
                        <label className="text-sm">Notas</label>
                        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                    </div>
                </form>

                {/* Tabla */}
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
                            {items.map((it) => (
                                <tr key={it.id} className="border-t">
                                    <td className="p-2">{it.type}</td>
                                    <td className="p-2">{it.title}</td>

                                    {/* ✅ sin new Date(): no hay saltos por timezone */}
                                    <td className="p-2 text-center">{fmtLocal(it.start)}</td>
                                    <td className="p-2 text-center">{fmtLocal(it.end)}</td>

                                    <td className="p-2">{it.notes || "—"}</td>

                                    <td className="p-2 text-right">
                                        <Button variant="outline" size="sm" onClick={() => remove(it.id)} data-testid={`rm-${it.id}`}>
                                            Eliminar
                                        </Button>
                                    </td>
                                </tr>
                            ))}

                            {!items.length && (
                                <tr>
                                    <td className="p-4 text-center text-gray-500" colSpan={6}>
                                        Sin eventos
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}
