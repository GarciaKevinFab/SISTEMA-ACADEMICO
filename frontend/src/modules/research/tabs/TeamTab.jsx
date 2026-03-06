/**
 * tabs/TeamTab.jsx
 * Gestión del equipo de investigación
 *
 * FIX: confirm() nativo → AlertDialog (DeleteConfirm)
 */
import { useState, useEffect, useCallback } from "react";
import { Team } from "../../../services/research.service";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Slider } from "@/components/ui/slider";

import { Plus, Edit, Trash2, Loader2, Users } from "lucide-react";
import { toast } from "sonner";

export default function TeamTab({ projectId }) {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(false);

    const [dialog, setDialog] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({
        full_name: "", role: "", dedication_pct: 50,
        email: "", orcid: "",
    });

    const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null, name: "" });

    const load = useCallback(async () => {
        if (!projectId) return;
        setLoading(true);
        try {
            const data = await Team.list(projectId);
            setMembers(Array.isArray(data) ? data : []);
        } catch {
            toast.error("Error al cargar equipo");
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => { load(); }, [load]);

    const openNew = () => {
        setEditing(null);
        setForm({ full_name: "", role: "", dedication_pct: 50, email: "", orcid: "" });
        setDialog(true);
    };

    const openEdit = (m) => {
        setEditing(m);
        setForm({
            full_name: m.full_name || "",
            role: m.role || "",
            dedication_pct: m.dedication_pct || 0,
            email: m.email || "",
            orcid: m.orcid || "",
        });
        setDialog(true);
    };

    const save = async () => {
        try {
            if (editing) {
                await Team.update(projectId, editing.id, form);
                toast.success("Miembro actualizado");
            } else {
                await Team.add(projectId, form);
                toast.success("Miembro agregado");
            }
            setDialog(false);
            load();
        } catch {
            toast.error("Error al guardar");
        }
    };

    const handleDelete = async () => {
        try {
            await Team.remove(projectId, deleteConfirm.id);
            toast.success("Miembro eliminado");
            setDeleteConfirm({ open: false, id: null, name: "" });
            load();
        } catch {
            toast.error("Error al eliminar");
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base">Equipo de Investigación</CardTitle>
                <Button size="sm" onClick={openNew}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Miembro
                </Button>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                ) : members.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                        <Users className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                        <p>No hay miembros registrados</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {members.map(m => (
                            <div key={m.id} className="border rounded-lg p-3 flex items-center justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium">{m.full_name}</span>
                                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                                            {m.role}
                                        </span>
                                    </div>
                                    <div className="flex gap-4 mt-1 text-xs text-slate-500">
                                        {m.email && <span>{m.email}</span>}
                                        {m.orcid && <span>ORCID: {m.orcid}</span>}
                                        <span>Dedicación: {m.dedication_pct}%</span>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" onClick={() => openEdit(m)}>
                                        <Edit className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setDeleteConfirm({ open: true, id: m.id, name: m.full_name })}
                                    >
                                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>

            {/* Dialog */}
            <Dialog open={dialog} onOpenChange={setDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editing ? "Editar Miembro" : "Nuevo Miembro"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <Input
                            placeholder="Nombre completo"
                            value={form.full_name}
                            onChange={(e) => setForm(p => ({ ...p, full_name: e.target.value }))}
                        />
                        <Input
                            placeholder="Rol (ej: Investigador principal, Tesista)"
                            value={form.role}
                            onChange={(e) => setForm(p => ({ ...p, role: e.target.value }))}
                        />
                        <div className="grid grid-cols-2 gap-3">
                            <Input
                                placeholder="Email"
                                value={form.email}
                                onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))}
                            />
                            <Input
                                placeholder="ORCID"
                                value={form.orcid}
                                onChange={(e) => setForm(p => ({ ...p, orcid: e.target.value }))}
                            />
                        </div>
                        <div>
                            <label className="text-xs text-slate-500">
                                Dedicación: {form.dedication_pct}%
                            </label>
                            <Slider
                                value={[form.dedication_pct]}
                                max={100}
                                step={5}
                                onValueChange={([v]) => setForm(p => ({ ...p, dedication_pct: v }))}
                                className="mt-2"
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
                        <AlertDialogTitle>¿Eliminar miembro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Se eliminará a "{deleteConfirm.name}" del equipo.
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