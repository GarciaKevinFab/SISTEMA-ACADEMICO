/**
 * tabs/PublicationsTab.jsx
 * Gestión de publicaciones del proyecto
 *
 * FIX: confirm() nativo → AlertDialog
 */
import { useState, useEffect, useCallback } from "react";
import { Publications } from "../../../services/research.service";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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

import { Plus, Edit, Trash2, ExternalLink, Loader2, BookOpen } from "lucide-react";
import { toast } from "sonner";

const PUB_TYPES = [
    { value: "ARTICLE", label: "Artículo" },
    { value: "BOOK", label: "Libro" },
    { value: "CHAPTER", label: "Capítulo" },
    { value: "CONFERENCE", label: "Conferencia" },
    { value: "THESIS", label: "Tesis" },
    { value: "OTHER", label: "Otro" },
];

export default function PublicationsTab({ projectId }) {
    const [pubs, setPubs] = useState([]);
    const [loading, setLoading] = useState(false);

    const [dialog, setDialog] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({
        type: "ARTICLE", title: "", journal: "",
        year: new Date().getFullYear(), doi: "", link: "", indexed: false,
    });

    const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null, name: "" });

    const load = useCallback(async () => {
        if (!projectId) return;
        setLoading(true);
        try {
            const data = await Publications.list(projectId);
            setPubs(Array.isArray(data) ? data : []);
        } catch {
            toast.error("Error al cargar publicaciones");
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => { load(); }, [load]);

    const openNew = () => {
        setEditing(null);
        setForm({
            type: "ARTICLE", title: "", journal: "",
            year: new Date().getFullYear(), doi: "", link: "", indexed: false,
        });
        setDialog(true);
    };

    const openEdit = (p) => {
        setEditing(p);
        setForm({
            type: p.type || "ARTICLE",
            title: p.title || "",
            journal: p.journal || "",
            year: p.year || new Date().getFullYear(),
            doi: p.doi || "",
            link: p.link || "",
            indexed: p.indexed || false,
        });
        setDialog(true);
    };

    const save = async () => {
        try {
            if (editing) {
                await Publications.update(projectId, editing.id, form);
                toast.success("Publicación actualizada");
            } else {
                await Publications.create(projectId, form);
                toast.success("Publicación registrada");
            }
            setDialog(false);
            load();
        } catch {
            toast.error("Error al guardar");
        }
    };

    const handleDelete = async () => {
        try {
            await Publications.remove(projectId, deleteConfirm.id);
            toast.success("Publicación eliminada");
            setDeleteConfirm({ open: false, id: null, name: "" });
            load();
        } catch {
            toast.error("Error al eliminar");
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base">Publicaciones</CardTitle>
                <Button size="sm" onClick={openNew}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Publicación
                </Button>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                ) : pubs.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                        <BookOpen className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                        <p>No hay publicaciones registradas</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {pubs.map(p => (
                            <div key={p.id} className="border rounded-lg p-3">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-xs">
                                                {PUB_TYPES.find(t => t.value === p.type)?.label || p.type}
                                            </Badge>
                                            {p.indexed && (
                                                <Badge className="bg-green-100 text-green-700 text-xs">
                                                    Indexada
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="font-medium mt-1">{p.title}</p>
                                        <p className="text-xs text-slate-500">
                                            {p.journal && `${p.journal} · `}
                                            {p.year}
                                            {p.doi && ` · DOI: ${p.doi}`}
                                        </p>
                                    </div>
                                    <div className="flex gap-1 ml-2">
                                        {p.link && (
                                            <Button variant="ghost" size="icon" asChild>
                                                <a href={p.link} target="_blank" rel="noreferrer">
                                                    <ExternalLink className="h-3.5 w-3.5" />
                                                </a>
                                            </Button>
                                        )}
                                        <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                                            <Edit className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setDeleteConfirm({ open: true, id: p.id, name: p.title })}
                                        >
                                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                        </Button>
                                    </div>
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
                        <DialogTitle>{editing ? "Editar Publicación" : "Nueva Publicación"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <Select
                            value={form.type}
                            onValueChange={(v) => setForm(p => ({ ...p, type: v }))}
                        >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {PUB_TYPES.map(t => (
                                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Input
                            placeholder="Título de la publicación"
                            value={form.title}
                            onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))}
                        />
                        <div className="grid grid-cols-2 gap-3">
                            <Input
                                placeholder="Revista / Editorial"
                                value={form.journal}
                                onChange={(e) => setForm(p => ({ ...p, journal: e.target.value }))}
                            />
                            <Input
                                type="number"
                                placeholder="Año"
                                value={form.year}
                                onChange={(e) => setForm(p => ({ ...p, year: Number(e.target.value) }))}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <Input
                                placeholder="DOI"
                                value={form.doi}
                                onChange={(e) => setForm(p => ({ ...p, doi: e.target.value }))}
                            />
                            <Input
                                placeholder="Link"
                                value={form.link}
                                onChange={(e) => setForm(p => ({ ...p, link: e.target.value }))}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Checkbox
                                checked={form.indexed}
                                onCheckedChange={(v) => setForm(p => ({ ...p, indexed: !!v }))}
                                id="indexed"
                            />
                            <label htmlFor="indexed" className="text-sm">Publicación indexada</label>
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
                        <AlertDialogTitle>¿Eliminar publicación?</AlertDialogTitle>
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