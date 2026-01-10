import React, { useEffect, useState } from "react";
import { Concepts } from "../../services/finance.service";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../../components/ui/dialog";
import { toast } from "../../utils/safeToast";
import { Plus, Save, Edit3, Trash2 } from "lucide-react";
import { fmtCurrency, formatApiError } from "../../utils/format";

const TYPES = ["ADMISION", "MATRICULA", "PENSION", "CERTIFICADO", "OTRO"];

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
        <div className="space-y-6 pb-24 sm:pb-6">

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
                        /* ==========================================================
                           SOLUCIÓN DEFINITIVA CON ESTILOS EN LÍNEA (INLINE STYLES)
                           Esto ignora Tailwind y fuerza al navegador a hacer scroll.
                           ========================================================== */
                        <div style={{ 
                            height: "300px",        /* Altura FIJA */
                            overflowY: "auto",      /* Scroll vertical automático */
                            overflowX: "auto",    /* Evita scroll horizontal innecesario */
                            borderBottom: "1px solid #eee" /* Un borde sutil abajo */
                        }}>
                            <table className="w-full text-sm">
                                {/* Sticky Header con estilo en línea para asegurar que se quede fijo */}
                                <thead style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: "#f9fafb" }}>
                                    <tr className="border-b">
                                        <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-700">Código</th>
                                        <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-700">Nombre</th>
                                        <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-700">Tipo</th>
                                        <th scope="col" className="px-4 py-3 text-right font-semibold text-gray-700">Monto</th>
                                        <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-700">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {rows.map((r) => (
                                        <tr key={r.id} className="bg-white hover:bg-gray-50">
                                            <td className="px-4 py-3 text-gray-900">{r.code}</td>
                                            <td className="px-4 py-3 text-gray-900">{r.name}</td>
                                            <td className="px-4 py-3 text-gray-600">{r.type}</td>
                                            <td className="px-4 py-3 text-right text-gray-900 font-medium">{fmtCurrency(r.default_amount)}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex gap-2">
                                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEdit(r)}>
                                                        <Edit3 className="h-4 w-4" />
                                                    </Button>
                                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-600" onClick={() => remove(r)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {rows.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="text-center py-10 text-gray-500">Sin conceptos todavía.</td>
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