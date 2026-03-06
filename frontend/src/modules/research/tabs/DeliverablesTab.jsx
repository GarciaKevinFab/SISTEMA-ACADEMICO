/**
 * tabs/DeliverablesTab.jsx
 * Gestión de entregables / productos del proyecto
 */
import { useState, useEffect, useCallback } from "react";
import { Deliverables } from "../../../services/research.service";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

import {
    Plus, Edit, Trash2, Loader2, ExternalLink,
    ClipboardCheck, FileCheck, FileClock, FileX,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_MAP = {
    PENDING: { label: "Pendiente", color: "bg-slate-100 text-slate-700", icon: FileClock },
    SUBMITTED: { label: "Entregado", color: "bg-blue-100 text-blue-700", icon: ClipboardCheck },
    APPROVED: { label: "Aprobado", color: "bg-emerald-100 text-emerald-700", icon: FileCheck },
    REJECTED: { label: "Rechazado", color: "bg-red-100 text-red-700", icon: FileX },
};

export default function DeliverablesTab({ projectId }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);

    // Dialog CRUD
    const [dialog, setDialog] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({
        name: "", description: "", due_date: "", link: "", status: "PENDING",
    });

    // Delete
    const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null, name: "" });

    const load = useCallback(async () => {
        if (!projectId) return;
        setLoading(true);
        try {
            const data = await Deliverables.list(projectId);
            setItems(Array.isArray(data) ? data : []);
        } catch {
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => { load(); }, [load]);

    // ── CRUD ──
    const openNew = () => {
        setEditing(null);
        setForm({ name: "", description: "", due_date: "", link: "", status: "PENDING" });
        setDialog(true);
    };

    const openEdit = (d) => {
        setEditing(d);
        setForm({
            name: d.name || "",
            description: d.description || "",
            due_date: d.due_date || "",
            link: d.link || "",
            status: d.status || "PENDING",
        });
        setDialog(true);
    };

    const save = async () => {
        if (!form.name.trim()) {
            toast.error("El nombre es obligatorio");
            return;
        }
        try {
            if (editing) {
                await Deliverables.update(editing.id, form);
                toast.success("Entregable actualizado");
            } else {
                await Deliverables.create(projectId, form);
                toast.success("Entregable creado");
            }
            setDialog(false);
            load();
        } catch {
            toast.error("Error al guardar entregable");
        }
    };

    const handleDelete = async () => {
        try {
            await Deliverables.remove(deleteConfirm.id);
            toast.success("Entregable eliminado");
            setDeleteConfirm({ open: false, id: null, name: "" });
            load();
        } catch {
            toast.error("Error al eliminar");
        }
    };

    // ── Stats ──
    const countByStatus = Object.keys(STATUS_MAP).reduce((acc, key) => {
        acc[key] = items.filter(it => it.status === key).length;
        return acc;
    }, {});

    // ── Render ──
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                    <CardTitle className="text-base">Productos / Entregables</CardTitle>
                    {items.length > 0 && (
                        <div className="flex gap-1.5 mt-2">
                            {Object.entries(countByStatus).map(([key, count]) => count > 0 && (
                                <Badge key={key} variant="outline" className="text-[10px] px-1.5 py-0">
                                    {STATUS_MAP[key].label}: {count}
                                </Badge>
                            ))}
                        </div>
                    )}
                </div>
                <Button size="sm" onClick={openNew}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Entregable
                </Button>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                    </div>
                ) : items.length === 0 ? (
                    <div className="text-center py-10">
                        <ClipboardCheck className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                        <p className="text-slate-500 text-sm">No hay entregables registrados</p>
                        <Button size="sm" variant="link" onClick={openNew}>
                            Agregar primer entregable
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {items.map(d => {
                            const st = STATUS_MAP[d.status] || STATUS_MAP.PENDING;
                            const Icon = st.icon;
                            return (
                                <div
                                    key={d.id}
                                    className="border rounded-lg p-3 flex items-center gap-3 hover:bg-slate-50 transition-colors"
                                >
                                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${st.color}`}>
                                        <Icon className="h-4 w-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium truncate">{d.name}</p>
                                        <p className="text-xs text-slate-500">
                                            {d.due_date || "Sin fecha"}
                                            {d.description && ` · ${d.description.substring(0, 60)}${d.description.length > 60 ? "…" : ""}`}
                                        </p>
                                    </div>
                                    <Badge className={`${st.color} text-xs shrink-0`}>{st.label}</Badge>
                                    <div className="flex gap-1 shrink-0">
                                        {d.link && (
                                            <Button variant="ghost" size="icon" asChild>
                                                <a href={d.link} target="_blank" rel="noreferrer" title="Ver archivo">
                                                    <ExternalLink className="h-4 w-4" />
                                                </a>
                                            </Button>
                                        )}
                                        <Button variant="ghost" size="icon" onClick={() => openEdit(d)} title="Editar">
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setDeleteConfirm({ open: true, id: d.id, name: d.name })}
                                            title="Eliminar"
                                        >
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>

            {/* Dialog CRUD */}
            <Dialog open={dialog} onOpenChange={setDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {editing ? "Editar Entregable" : "Nuevo Entregable"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div>
                            <label className="text-sm font-medium">Nombre *</label>
                            <Input
                                value={form.name}
                                onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Descripción</label>
                            <Textarea
                                value={form.description}
                                onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))}
                                rows={2}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-sm font-medium">Fecha límite</label>
                                <Input
                                    type="date"
                                    value={form.due_date}
                                    onChange={(e) => setForm(p => ({ ...p, due_date: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Estado</label>
                                <Select
                                    value={form.status}
                                    onValueChange={(v) => setForm(p => ({ ...p, status: v }))}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(STATUS_MAP).map(([k, v]) => (
                                            <SelectItem key={k} value={k}>{v.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Link / URL del archivo</label>
                            <Input
                                placeholder="https://..."
                                value={form.link}
                                onChange={(e) => setForm(p => ({ ...p, link: e.target.value }))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">Cancelar</Button>
                        </DialogClose>
                        <Button onClick={save}>Guardar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete confirm */}
            <AlertDialog
                open={deleteConfirm.open}
                onOpenChange={(v) => setDeleteConfirm(p => ({ ...p, open: v }))}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar entregable?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Se eliminará permanentemente "{deleteConfirm.name}".
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700"
                            onClick={handleDelete}
                        >
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}