/**
 * tabs/ScheduleTab.jsx
 * Gestión del cronograma de actividades del proyecto
 */
import { useState, useEffect, useCallback } from "react";
import { Schedule } from "../../../services/research.service";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Select, SelectContent, SelectItem,
    SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";

import { Plus, Trash2, Loader2, Save, Calendar, GripVertical } from "lucide-react";
import { toast } from "sonner";

const SCHEDULE_STATUS = {
    PLANNED: { label: "Planificado", color: "bg-slate-100 text-slate-700" },
    IN_PROGRESS: { label: "En curso", color: "bg-blue-100 text-blue-700" },
    DONE: { label: "Completado", color: "bg-emerald-100 text-emerald-700" },
    DELAYED: { label: "Retrasado", color: "bg-red-100 text-red-700" },
};

export default function ScheduleTab({ projectId }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState({ open: false, idx: null, title: "" });

    const load = useCallback(async () => {
        if (!projectId) return;
        setLoading(true);
        try {
            const data = await Schedule.list(projectId);
            setItems(Array.isArray(data) ? data : []);
            setHasChanges(false);
        } catch {
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => { load(); }, [load]);

    // ── Helpers ──
    const addItem = () => {
        setItems(prev => [...prev, {
            id: `new-${Date.now()}`,
            title: "",
            due_date: "",
            responsible: "",
            status: "PLANNED",
            progress: 0,
            _isNew: true,
        }]);
        setHasChanges(true);
    };

    const updateItem = (idx, field, value) => {
        setItems(prev => prev.map((it, i) =>
            i === idx ? { ...it, [field]: value } : it
        ));
        setHasChanges(true);
    };

    const requestRemove = (idx) => {
        const item = items[idx];
        setDeleteConfirm({
            open: true,
            idx,
            title: item.title || `Actividad #${idx + 1}`,
        });
    };

    const confirmRemove = () => {
        setItems(prev => prev.filter((_, i) => i !== deleteConfirm.idx));
        setDeleteConfirm({ open: false, idx: null, title: "" });
        setHasChanges(true);
    };

    const save = async () => {
        setSaving(true);
        try {
            await Schedule.saveBulk(projectId, items.map(({ _isNew, ...rest }) => rest));
            toast.success("Cronograma guardado");
            load();
        } catch {
            toast.error("Error al guardar cronograma");
        } finally {
            setSaving(false);
        }
    };

    // ── Stats ──
    const totalProgress = items.length > 0
        ? Math.round(items.reduce((sum, it) => sum + (it.progress || 0), 0) / items.length)
        : 0;

    const countByStatus = Object.keys(SCHEDULE_STATUS).reduce((acc, key) => {
        acc[key] = items.filter(it => it.status === key).length;
        return acc;
    }, {});

    // ── Render ──
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                    <CardTitle className="text-base">Cronograma de Actividades</CardTitle>
                    {items.length > 0 && (
                        <div className="flex items-center gap-3 mt-2">
                            <span className="text-xs text-slate-500">
                                Avance general: {totalProgress}%
                            </span>
                            <Progress value={totalProgress} className="w-32 h-2" />
                            <div className="flex gap-1.5">
                                {Object.entries(countByStatus).map(([key, count]) => count > 0 && (
                                    <Badge key={key} variant="outline" className="text-[10px] px-1.5 py-0">
                                        {SCHEDULE_STATUS[key].label}: {count}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={addItem}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> Actividad
                    </Button>
                    <Button size="sm" onClick={save} disabled={!hasChanges || saving}>
                        {saving
                            ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                            : <Save className="h-3.5 w-3.5 mr-1" />
                        }
                        Guardar
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                    </div>
                ) : items.length === 0 ? (
                    <div className="text-center py-10">
                        <Calendar className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                        <p className="text-slate-500 text-sm">No hay actividades programadas</p>
                        <Button size="sm" variant="link" onClick={addItem}>
                            Agregar primera actividad
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {items.map((it, idx) => {
                            const st = SCHEDULE_STATUS[it.status] || SCHEDULE_STATUS.PLANNED;
                            return (
                                <div
                                    key={it.id || idx}
                                    className={`border rounded-lg p-3 space-y-2 transition-colors ${it._isNew ? "border-blue-200 bg-blue-50/30" : ""
                                        }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-400 w-6 text-center font-mono">
                                            {idx + 1}
                                        </span>
                                        <Input
                                            placeholder="Título de la actividad"
                                            className="flex-1"
                                            value={it.title}
                                            onChange={(e) => updateItem(idx, "title", e.target.value)}
                                        />
                                        <Input
                                            type="date"
                                            className="w-[155px]"
                                            value={it.due_date || ""}
                                            onChange={(e) => updateItem(idx, "due_date", e.target.value)}
                                        />
                                        <Input
                                            placeholder="Responsable"
                                            className="w-[155px]"
                                            value={it.responsible || ""}
                                            onChange={(e) => updateItem(idx, "responsible", e.target.value)}
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => requestRemove(idx)}
                                            className="shrink-0"
                                        >
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                    </div>
                                    <div className="flex items-center gap-3 pl-8">
                                        <span className="text-xs text-slate-500 w-10 text-right font-mono">
                                            {it.progress}%
                                        </span>
                                        <Slider
                                            value={[it.progress]}
                                            max={100}
                                            step={5}
                                            onValueChange={([v]) => updateItem(idx, "progress", v)}
                                            className="flex-1"
                                        />
                                        <Select
                                            value={it.status || "PLANNED"}
                                            onValueChange={(v) => updateItem(idx, "status", v)}
                                        >
                                            <SelectTrigger className="w-[140px]">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Object.entries(SCHEDULE_STATUS).map(([k, v]) => (
                                                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>

            {/* Delete confirm */}
            <AlertDialog
                open={deleteConfirm.open}
                onOpenChange={(v) => setDeleteConfirm(p => ({ ...p, open: v }))}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar actividad?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Se eliminará "{deleteConfirm.title}" del cronograma.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700"
                            onClick={confirmRemove}
                        >
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}