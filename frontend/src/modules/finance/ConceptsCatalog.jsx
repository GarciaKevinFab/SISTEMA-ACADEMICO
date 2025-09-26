import React, { useEffect, useState } from "react";
import { Concepts } from "../../services/finance.service";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../../components/ui/dialog";
import { toast } from "../../utils/safeToast"; // <-- usa safeToast
import { Plus, Save, Edit3, Trash2 } from "lucide-react";
import { fmtCurrency, formatApiError } from "../../utils/format";

const TYPES = ["ADMISION", "MATRICULA", "PENSION", "CERTIFICADO", "OTRO"];

// helper de error consistente
const showApiError = (e, fallback) => {
    const msg = formatApiError(e, fallback);
    toast.error(msg);
};

export default function ConceptsCatalog() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);

    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({ code: "", name: "", type: "OTRO", default_amount: "" });

    const load = async () => {
        try {
            setLoading(true);
            const data = await Concepts.list();
            setRows(data?.items ?? data ?? []);
        } catch (e) {
            showApiError(e, "Error al cargar conceptos");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const openCreate = () => {
        setEditing(null);
        setForm({ code: "", name: "", type: "OTRO", default_amount: "" });
        setOpen(true);
    };

    const openEdit = (r) => {
        setEditing(r);
        setForm({
            code: r.code || "",
            name: r.name || "",
            type: r.type || "OTRO",
            default_amount: r.default_amount ?? "",
        });
        setOpen(true);
    };

    const save = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...form,
                default_amount: form.default_amount === "" ? 0 : Number(form.default_amount),
            };
            if (editing) {
                await Concepts.update(editing.id, payload);
                toast.success("Concepto actualizado");
            } else {
                await Concepts.create(payload);
                toast.success("Concepto creado");
            }
            setOpen(false);
            load();
        } catch (e1) {
            showApiError(e1, "No se pudo guardar");
        }
    };

    const remove = async (r) => {
        if (!window.confirm(`¿Eliminar concepto "${r.name}"?`)) return;
        try {
            await Concepts.remove(r.id);
            toast.success("Concepto eliminado");
            load();
        } catch (e) {
            showApiError(e, "No se pudo eliminar");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold">Catálogo de conceptos</h2>
                    <p className="text-sm text-gray-600">Admisión, matrícula, pensiones, certificados, etc.</p>
                </div>
                <Button onClick={openCreate}>
                    <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
                    Nuevo
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Conceptos</CardTitle>
                    <CardDescription>Lista de conceptos facturables</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center h-40" aria-busy="true">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th scope="col" className="px-4 py-2 text-left text-xs font-semibold">Código</th>
                                        <th scope="col" className="px-4 py-2 text-left text-xs font-semibold">Nombre</th>
                                        <th scope="col" className="px-4 py-2 text-left text-xs font-semibold">Tipo</th>
                                        <th scope="col" className="px-4 py-2 text-right text-xs font-semibold">Monto por defecto</th>
                                        <th scope="col" className="px-4 py-2 text-left text-xs font-semibold">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {rows.map((r) => (
                                        <tr key={r.id}>
                                            <td className="px-4 py-2">{r.code}</td>
                                            <td className="px-4 py-2">{r.name}</td>
                                            <td className="px-4 py-2 text-xs">{r.type}</td>
                                            <td className="px-4 py-2 text-right">{fmtCurrency(r.default_amount)}</td>
                                            <td className="px-4 py-2">
                                                <div className="flex gap-2">
                                                    <Button size="sm" variant="outline" onClick={() => openEdit(r)} aria-label="Editar">
                                                        <Edit3 className="h-4 w-4" aria-hidden="true" />
                                                    </Button>
                                                    <Button size="sm" variant="outline" onClick={() => remove(r)} aria-label="Eliminar">
                                                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {rows.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="text-center py-8 text-gray-500">Sin conceptos todavía.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editing ? "Editar concepto" : "Nuevo concepto"}</DialogTitle>
                        <DialogDescription>Completa los datos básicos</DialogDescription>
                    </DialogHeader>

                    <form onSubmit={save} className="grid grid-cols-1 gap-3">
                        <div>
                            <Label>Código *</Label>
                            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
                        </div>
                        <div>
                            <Label>Nombre *</Label>
                            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                        </div>
                        <div>
                            <Label>Tipo *</Label>
                            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {TYPES.map((t) => (
                                        <SelectItem key={t} value={t}>{t}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Monto por defecto</Label>
                            <Input
                                type="number" step="0.01" min="0"
                                value={form.default_amount}
                                onChange={(e) => setForm({ ...form, default_amount: e.target.value })}
                            />
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                            <Button type="submit">
                                <Save className="h-4 w-4 mr-2" aria-hidden="true" />
                                Guardar
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
