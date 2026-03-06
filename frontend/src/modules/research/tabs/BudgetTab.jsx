/**
 * tabs/BudgetTab.jsx
 * Gestión de presupuesto del proyecto
 *
 * FIXES:
 * - confirm() nativo → DeleteConfirm (AlertDialog)
 * - exportXlsx: descarga blob real en vez de JSON stringificado
 */
import { useState, useEffect, useCallback } from "react";
import { Budget } from "../../../services/research.service";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem,
    SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { Plus, Edit, Trash2, Upload, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = [
    { value: "EQUIPMENT", label: "Equipamiento" },
    { value: "SUPPLIES", label: "Materiales" },
    { value: "TRAVEL", label: "Viáticos" },
    { value: "SERVICES", label: "Servicios" },
    { value: "PERSONNEL", label: "Personal" },
    { value: "OTHER", label: "Otros" },
];

export default function BudgetTab({ projectId }) {
    const [items, setItems] = useState([]);
    const [summary, setSummary] = useState({ planned: 0, executed: 0 });
    const [loading, setLoading] = useState(false);

    const [dialog, setDialog] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({
        category: "OTHER", item: "", planned: 0, executed: 0,
        date: "", doc_type: "", doc_number: "",
    });

    // FIX: DeleteConfirm en lugar de confirm() nativo
    const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null, name: "" });

    const load = useCallback(async () => {
        if (!projectId) return;
        setLoading(true);
        try {
            const data = await Budget.list(projectId);
            setItems(data.items || []);
            setSummary(data.summary || { planned: 0, executed: 0 });
        } catch {
            toast.error("Error al cargar presupuesto");
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => { load(); }, [load]);

    const openNew = () => {
        setEditing(null);
        setForm({ category: "OTHER", item: "", planned: 0, executed: 0, date: "", doc_type: "", doc_number: "" });
        setDialog(true);
    };

    const openEdit = (r) => {
        setEditing(r);
        setForm({
            category: r.category || "OTHER",
            item: r.item || "",
            planned: r.planned || 0,
            executed: r.executed || 0,
            date: r.date || "",
            doc_type: r.doc_type || "",
            doc_number: r.doc_number || "",
        });
        setDialog(true);
    };

    const save = async () => {
        try {
            if (editing) {
                await Budget.updateItem(projectId, editing.id, form);
                toast.success("Partida actualizada");
            } else {
                await Budget.createItem(projectId, form);
                toast.success("Partida creada");
            }
            setDialog(false);
            load();
        } catch {
            toast.error("Error al guardar");
        }
    };

    const handleDelete = async () => {
        try {
            await Budget.removeItem(projectId, deleteConfirm.id);
            toast.success("Partida eliminada");
            setDeleteConfirm({ open: false, id: null, name: "" });
            load();
        } catch {
            toast.error("Error al eliminar");
        }
    };

    const uploadReceipt = async (itemId, file) => {
        try {
            await Budget.uploadReceipt(projectId, itemId, file);
            toast.success("Comprobante subido");
            load();
        } catch {
            toast.error("Error al subir comprobante");
        }
    };

    // FIX: Descarga XLSX real (blob)
    const exportXlsx = async () => {
        try {
            const resp = await Budget.exportXlsx(projectId);
            // resp es un AxiosResponse con responseType: "blob"
            const blob = resp.data instanceof Blob
                ? resp.data
                : new Blob([resp.data], {
                    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `project_${projectId}_budget.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success("Archivo descargado");
        } catch {
            toast.error("Error al exportar");
        }
    };

    const pctUsed = summary.planned > 0
        ? Math.round((summary.executed / summary.planned) * 100)
        : 0;

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base">Presupuesto</CardTitle>
                <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={exportXlsx}>
                        <Download className="h-3.5 w-3.5 mr-1" /> Excel
                    </Button>
                    <Button size="sm" onClick={openNew}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> Partida
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Resumen */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="border rounded-lg p-3 text-center">
                        <p className="text-lg font-bold">S/ {summary.planned.toLocaleString()}</p>
                        <p className="text-xs text-slate-500">Planificado</p>
                    </div>
                    <div className="border rounded-lg p-3 text-center">
                        <p className="text-lg font-bold">S/ {summary.executed.toLocaleString()}</p>
                        <p className="text-xs text-slate-500">Ejecutado</p>
                    </div>
                    <div className="border rounded-lg p-3 text-center">
                        <p className="text-lg font-bold">{pctUsed}%</p>
                        <p className="text-xs text-slate-500">Ejecución</p>
                    </div>
                </div>

                {/* Tabla */}
                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                ) : items.length === 0 ? (
                    <p className="text-slate-500 text-center py-6">No hay partidas registradas</p>
                ) : (
                    <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="text-left px-3 py-2 font-medium text-slate-600">Categoría</th>
                                    <th className="text-left px-3 py-2 font-medium text-slate-600">Concepto</th>
                                    <th className="text-right px-3 py-2 font-medium text-slate-600">Planificado</th>
                                    <th className="text-right px-3 py-2 font-medium text-slate-600">Ejecutado</th>
                                    <th className="text-center px-3 py-2 font-medium text-slate-600">Comprobante</th>
                                    <th className="text-right px-3 py-2 font-medium text-slate-600">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {items.map(r => (
                                    <tr key={r.id}>
                                        <td className="px-3 py-2">
                                            <Badge variant="outline" className="text-xs">
                                                {CATEGORIES.find(c => c.value === r.category)?.label || r.category}
                                            </Badge>
                                        </td>
                                        <td className="px-3 py-2">{r.item}</td>
                                        <td className="px-3 py-2 text-right">S/ {r.planned.toLocaleString()}</td>
                                        <td className="px-3 py-2 text-right">S/ {r.executed.toLocaleString()}</td>
                                        <td className="px-3 py-2 text-center">
                                            {r.receipt_url ? (
                                                <a href={r.receipt_url} target="_blank" rel="noreferrer" className="text-blue-600 text-xs underline">
                                                    Ver
                                                </a>
                                            ) : (
                                                <label className="cursor-pointer text-xs text-slate-400 hover:text-blue-600">
                                                    <Upload className="h-3.5 w-3.5 inline mr-1" />
                                                    Subir
                                                    <input
                                                        type="file"
                                                        className="hidden"
                                                        onChange={(e) => {
                                                            if (e.target.files[0]) uploadReceipt(r.id, e.target.files[0]);
                                                        }}
                                                    />
                                                </label>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                                                    <Edit className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setDeleteConfirm({ open: true, id: r.id, name: r.item })}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>

            {/* Dialog crear/editar */}
            <Dialog open={dialog} onOpenChange={setDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editing ? "Editar Partida" : "Nueva Partida"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <Select
                            value={form.category}
                            onValueChange={(v) => setForm(p => ({ ...p, category: v }))}
                        >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {CATEGORIES.map(c => (
                                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Input
                            placeholder="Concepto"
                            value={form.item}
                            onChange={(e) => setForm(p => ({ ...p, item: e.target.value }))}
                        />
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-slate-500">Planificado (S/)</label>
                                <Input
                                    type="number"
                                    value={form.planned}
                                    onChange={(e) => setForm(p => ({ ...p, planned: Number(e.target.value) }))}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500">Ejecutado (S/)</label>
                                <Input
                                    type="number"
                                    value={form.executed}
                                    onChange={(e) => setForm(p => ({ ...p, executed: Number(e.target.value) }))}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <Input
                                type="date"
                                value={form.date}
                                onChange={(e) => setForm(p => ({ ...p, date: e.target.value }))}
                            />
                            <Input
                                placeholder="Tipo doc"
                                value={form.doc_type}
                                onChange={(e) => setForm(p => ({ ...p, doc_type: e.target.value }))}
                            />
                            <Input
                                placeholder="Nro doc"
                                value={form.doc_number}
                                onChange={(e) => setForm(p => ({ ...p, doc_number: e.target.value }))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                        <Button onClick={save}>Guardar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* DeleteConfirm */}
            <AlertDialog open={deleteConfirm.open} onOpenChange={(v) => setDeleteConfirm(p => ({ ...p, open: v }))}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar partida?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Se eliminará permanentemente "{deleteConfirm.name}".
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDelete}>
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}