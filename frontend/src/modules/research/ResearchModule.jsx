// src/modules/research/ResearchModule.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
    Card, CardHeader, CardContent, CardTitle, CardDescription,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Badge } from "../../components/ui/badge";
import {
    Tabs, TabsContent, TabsList, TabsTrigger,
} from "../../components/ui/tabs";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "../../components/ui/dialog";
import {
    Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "../../components/ui/select";
import {
    Plus, Edit3, Trash2, Eye, Save, RefreshCw, Calendar, CheckCircle,
    XCircle, AlertTriangle, FileText, ClipboardList, BookOpen, Users, Award, Download,
} from "lucide-react";
import {
    Catalog, Projects, Schedule, Deliverables, Evaluations, Reports,
} from "../../services/research.service";
import { generatePDFWithPolling, downloadFile } from "../../utils/pdfQrPolling";

/* ---------------- helpers ---------------- */
function formatApiError(err, fallback = "Ocurrió un error") {
    const data = err?.response?.data;
    if (data?.detail) {
        const d = data.detail;
        if (typeof d === "string") return d;
        if (Array.isArray(d)) {
            const msgs = d
                .map((e) => {
                    const field = Array.isArray(e?.loc) ? e.loc.join(".") : e?.loc;
                    return e?.msg ? (field ? `${field}: ${e.msg}` : e.msg) : null;
                })
                .filter(Boolean);
            if (msgs.length) return msgs.join(" | ");
        }
    }
    if (typeof data?.error?.message === "string") return data.error.message;
    if (typeof data?.message === "string") return data.message;
    if (typeof data?.error === "string") return data.error;
    if (typeof err?.message === "string") return err.message;
    return fallback;
}

const STATUS_CFG = {
    DRAFT: { label: "Borrador", badge: "secondary" },
    IN_REVIEW: { label: "En Revisión", badge: "secondary" },
    APPROVED: { label: "Aprobado", badge: "default" },
    REJECTED: { label: "Rechazado", badge: "destructive" },
    IN_PROGRESS: { label: "En Ejecución", badge: "default" },
    ON_HOLD: { label: "En Pausa", badge: "secondary" },
    COMPLETED: { label: "Concluido", badge: "default" },
};

/* =========================================================
   PROYECTOS – CRUD + Detalle (cronograma, productos, evaluación)
========================================================= */
const ProjectsManagement = () => {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);

    const [lines, setLines] = useState([]);
    const [advisors, setAdvisors] = useState([]);

    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editing, setEditing] = useState(null);

    const emptyForm = {
        title: "",
        line_id: "",
        advisor_id: "",
        start_date: "",
        end_date: "",
        budget: "",
        keywords: "",
        summary: "",
    };
    const [form, setForm] = useState(emptyForm);

    const [detailOpen, setDetailOpen] = useState(false);
    const [detailProject, setDetailProject] = useState(null);

    /* ---- load ---- */
    const loadCatalogs = useCallback(async () => {
        try {
            const [ls, adv] = await Promise.all([Catalog.lines(), Catalog.advisors()]);
            setLines(ls?.items ?? ls ?? []);
            setAdvisors(adv?.items ?? adv ?? []);
        } catch (e) {
            toast.error(formatApiError(e, "Error cargando catálogos"));
        }
    }, []);

    const loadProjects = useCallback(async () => {
        try {
            setLoading(true);
            const data = await Projects.list();
            setProjects(data?.projects ?? data ?? []);
        } catch (e) {
            toast.error(formatApiError(e, "Error cargando proyectos"));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadCatalogs();
        loadProjects();
    }, [loadCatalogs, loadProjects]);

    /* ---- filters ---- */
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return (projects || []).filter((p) => {
            const matchQ =
                !q ||
                (p.title || "").toLowerCase().includes(q) ||
                (p.code || "").toLowerCase().includes(q) ||
                (p.line_name || "").toLowerCase().includes(q) ||
                (p.advisor_name || "").toLowerCase().includes(q);
            const matchS = statusFilter === "ALL" || p.status === statusFilter;
            return matchQ && matchS;
        });
    }, [projects, search, statusFilter]);

    /* ---- actions ---- */
    const openCreate = () => {
        setForm(emptyForm);
        setIsCreateOpen(true);
    };

    const submitCreate = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...form,
                line_id: form.line_id ? Number(form.line_id) : null,
                advisor_id: form.advisor_id ? Number(form.advisor_id) : null,
                budget: form.budget ? Number(form.budget) : 0,
            };
            await Projects.create(payload);
            toast.success("Proyecto creado");
            setIsCreateOpen(false);
            loadProjects();
        } catch (e) {
            toast.error(formatApiError(e, "No se pudo crear el proyecto"));
        }
    };

    const openEdit = (p) => {
        setEditing(p);
        setForm({
            title: p.title || "",
            line_id: String(p.line_id || ""),
            advisor_id: String(p.advisor_id || ""),
            start_date: (p.start_date || "").slice(0, 10),
            end_date: (p.end_date || "").slice(0, 10),
            budget: p.budget ?? "",
            keywords: p.keywords || "",
            summary: p.summary || "",
        });
        setIsEditOpen(true);
    };

    const submitEdit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...form,
                line_id: form.line_id ? Number(form.line_id) : null,
                advisor_id: form.advisor_id ? Number(form.advisor_id) : null,
                budget: form.budget ? Number(form.budget) : 0,
            };
            await Projects.update(editing.id, payload);
            toast.success("Proyecto actualizado");
            setIsEditOpen(false);
            setEditing(null);
            loadProjects();
        } catch (e) {
            toast.error(formatApiError(e, "No se pudo actualizar"));
        }
    };

    const remove = async (p) => {
        if (!window.confirm(`¿Eliminar proyecto "${p.title}"?`)) return;
        try {
            await Projects.remove(p.id);
            toast.success("Proyecto eliminado");
            loadProjects();
        } catch (e) {
            toast.error(formatApiError(e, "No se pudo eliminar"));
        }
    };

    const changeStatus = async (p, newStatus) => {
        try {
            await Projects.changeStatus(p.id, newStatus);
            toast.success("Estado actualizado");
            loadProjects();
        } catch (e) {
            toast.error(formatApiError(e, "No se pudo cambiar el estado"));
        }
    };

    const openDetail = (p) => {
        setDetailProject(p);
        setDetailOpen(true);
    };

    return (
        <div className="space-y-6">
            {/* header + actions */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold">Proyectos de Investigación</h2>
                    <p className="text-sm text-gray-600">CRUD completo + cronograma, productos y evaluación</p>
                </div>
                <div className="flex gap-2">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-44">
                            <SelectValue placeholder="Estado" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Todos los estados</SelectItem>
                            {Object.keys(STATUS_CFG).map((s) => (
                                <SelectItem key={s} value={s}>{STATUS_CFG[s].label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <div className="relative">
                        <Input
                            className="pl-9 w-64"
                            placeholder="Buscar por título, código, línea, asesor…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        <SearchIcon />
                    </div>
                    <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="h-4 w-4 mr-2" />Nuevo Proyecto
                    </Button>
                </div>
            </div>

            {/* list */}
            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Título</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Línea</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Asesor</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fechas</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {filtered.map((p) => (
                                    <tr key={p.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-3 text-sm">{p.code || `P-${p.id}`}</td>
                                        <td className="px-6 py-3">
                                            <div className="font-medium">{p.title}</div>
                                            <div className="text-xs text-gray-500">{p.keywords}</div>
                                        </td>
                                        <td className="px-6 py-3 text-sm">{p.line_name || "-"}</td>
                                        <td className="px-6 py-3 text-sm">{p.advisor_name || "-"}</td>
                                        <td className="px-6 py-3 text-xs text-gray-600">
                                            {(p.start_date && new Date(p.start_date).toLocaleDateString()) || "-"} —{" "}
                                            {(p.end_date && new Date(p.end_date).toLocaleDateString()) || "-"}
                                        </td>
                                        <td className="px-6 py-3">
                                            <Badge variant={STATUS_CFG[p.status]?.badge || "secondary"}>
                                                {STATUS_CFG[p.status]?.label || p.status}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-3">
                                            <div className="flex gap-2">
                                                <Button size="sm" variant="outline" onClick={() => openDetail(p)} title="Ver detalle">
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                <Button size="sm" variant="outline" onClick={() => openEdit(p)} title="Editar">
                                                    <Edit3 className="h-4 w-4" />
                                                </Button>
                                                <Button size="sm" variant="outline" onClick={() => remove(p)} title="Eliminar">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                                {/* quick status */}
                                                {p.status !== "APPROVED" && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => changeStatus(p, "APPROVED")}
                                                        title="Aprobar"
                                                    >
                                                        <CheckCircle className="h-4 w-4" />
                                                    </Button>
                                                )}
                                                {p.status !== "REJECTED" && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => changeStatus(p, "REJECTED")}
                                                        title="Rechazar"
                                                    >
                                                        <XCircle className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filtered.length === 0 && (
                                    <tr><td colSpan="7" className="text-center py-10 text-gray-500">Sin resultados.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* create modal */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Nuevo Proyecto</DialogTitle>
                        <DialogDescription>Registra los datos del proyecto</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={submitCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <Label>Título *</Label>
                            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
                        </div>
                        <div>
                            <Label>Línea *</Label>
                            <Select value={form.line_id} onValueChange={(v) => setForm({ ...form, line_id: v })}>
                                <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
                                <SelectContent>
                                    {lines.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Asesor *</Label>
                            <Select value={form.advisor_id} onValueChange={(v) => setForm({ ...form, advisor_id: v })}>
                                <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
                                <SelectContent>
                                    {advisors.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.full_name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Inicio</Label>
                            <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                        </div>
                        <div>
                            <Label>Fin</Label>
                            <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                        </div>
                        <div>
                            <Label>Presupuesto (S/.)</Label>
                            <Input type="number" min="0" step="0.01" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
                        </div>
                        <div>
                            <Label>Palabras clave</Label>
                            <Input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} />
                        </div>
                        <div className="md:col-span-2">
                            <Label>Resumen</Label>
                            <Textarea rows={4} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
                        </div>
                        <div className="md:col-span-2 flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                            <Button type="submit" className="bg-blue-600 hover:bg-blue-700"><Save className="h-4 w-4 mr-2" />Guardar</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* edit modal */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Editar Proyecto</DialogTitle>
                        <DialogDescription>Actualiza los datos</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={submitEdit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <Label>Título *</Label>
                            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
                        </div>
                        <div>
                            <Label>Línea *</Label>
                            <Select value={form.line_id} onValueChange={(v) => setForm({ ...form, line_id: v })}>
                                <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
                                <SelectContent>
                                    {lines.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Asesor *</Label>
                            <Select value={form.advisor_id} onValueChange={(v) => setForm({ ...form, advisor_id: v })}>
                                <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
                                <SelectContent>
                                    {advisors.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.full_name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Inicio</Label>
                            <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                        </div>
                        <div>
                            <Label>Fin</Label>
                            <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                        </div>
                        <div>
                            <Label>Presupuesto (S/.)</Label>
                            <Input type="number" min="0" step="0.01" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
                        </div>
                        <div>
                            <Label>Palabras clave</Label>
                            <Input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} />
                        </div>
                        <div className="md:col-span-2">
                            <Label>Resumen</Label>
                            <Textarea rows={4} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
                        </div>
                        <div className="md:col-span-2 flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>Cancelar</Button>
                            <Button type="submit" className="bg-blue-600 hover:bg-blue-700"><Save className="h-4 w-4 mr-2" />Guardar Cambios</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* detail drawer-like dialog */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="max-w-5xl">
                    <DialogHeader>
                        <DialogTitle>Detalle de Proyecto</DialogTitle>
                        <DialogDescription>{detailProject?.title}</DialogDescription>
                    </DialogHeader>

                    {detailProject && (
                        <Tabs defaultValue="schedule">
                            <TabsList className="grid w-full grid-cols-4">
                                <TabsTrigger value="schedule">Cronograma</TabsTrigger>
                                <TabsTrigger value="deliverables">Productos</TabsTrigger>
                                <TabsTrigger value="evaluation">Evaluación</TabsTrigger>
                                <TabsTrigger value="meta">Meta</TabsTrigger>
                            </TabsList>

                            <TabsContent value="schedule">
                                <ScheduleTab projectId={detailProject.id} />
                            </TabsContent>

                            <TabsContent value="deliverables">
                                <DeliverablesTab projectId={detailProject.id} />
                            </TabsContent>

                            <TabsContent value="evaluation">
                                <EvaluationTab projectId={detailProject.id} />
                            </TabsContent>

                            <TabsContent value="meta">
                                <div className="grid md:grid-cols-2 gap-4">
                                    <Card>
                                        <CardHeader><CardTitle>Información</CardTitle></CardHeader>
                                        <CardContent className="text-sm space-y-2">
                                            <p><b>Código:</b> {detailProject.code || `P-${detailProject.id}`}</p>
                                            <p><b>Línea:</b> {detailProject.line_name || "-"}</p>
                                            <p><b>Asesor:</b> {detailProject.advisor_name || "-"}</p>
                                            <p><b>Fechas:</b> {(detailProject.start_date || "-")} — {(detailProject.end_date || "-")}</p>
                                            <p><b>Presupuesto:</b> S/. {(Number(detailProject.budget) || 0).toFixed(2)}</p>
                                            <p><b>Estado:</b> <Badge variant={STATUS_CFG[detailProject.status]?.badge || "secondary"}>{STATUS_CFG[detailProject.status]?.label || detailProject.status}</Badge></p>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader><CardTitle>Acciones Rápidas</CardTitle></CardHeader>
                                        <CardContent className="flex flex-wrap gap-2">
                                            <Button size="sm" variant="outline" onClick={() => changeStatus(detailProject, "IN_PROGRESS")}>
                                                <ClipboardList className="h-4 w-4 mr-2" />Marcar en ejecución
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={() => changeStatus(detailProject, "COMPLETED")}>
                                                <CheckCircle className="h-4 w-4 mr-2" />Marcar concluido
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={() => changeStatus(detailProject, "ON_HOLD")}>
                                                <AlertTriangle className="h-4 w-4 mr-2" />Pausar
                                            </Button>
                                        </CardContent>
                                    </Card>
                                </div>
                            </TabsContent>
                        </Tabs>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

/* ===== small icon inside input ===== */
const SearchIcon = () => (
    <svg viewBox="0 0 24 24" className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400">
        <path fill="currentColor" d="M10 18a8 8 0 1 1 5.293-14.293A8 8 0 0 1 10 18Zm8.707-1.293-3.387-3.387a6 6 0 1 0-1.414 1.414l3.387 3.387a1 1 0 0 0 1.414-1.414Z" />
    </svg>
);

/* =========================================================
   TAB: CRONOGRAMA
========================================================= */
const ScheduleTab = ({ projectId }) => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const data = await Schedule.list(projectId);
            setItems(data?.items ?? data ?? []);
        } catch (e) {
            toast.error(formatApiError(e, "Error al cargar cronograma"));
        } finally { setLoading(false); }
    }, [projectId]);

    useEffect(() => { load(); }, [load]);

    const addRow = () => {
        setItems((prev) => [
            ...prev,
            { id: `tmp-${Date.now()}`, title: "", due_date: "", responsible: "", status: "PLANNED", progress: 0 },
        ]);
    };

    const update = (idx, patch) => {
        setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
    };

    const save = async () => {
        setSaving(true);
        try {
            const payload = items.map((x) => ({
                id: typeof x.id === "number" ? x.id : undefined,
                title: x.title,
                due_date: x.due_date || null,
                responsible: x.responsible || null,
                status: x.status || "PLANNED",
                progress: Number(x.progress || 0),
            }));
            await Schedule.saveBulk(projectId, payload);
            toast.success("Cronograma guardado");
            load();
        } catch (e) {
            toast.error(formatApiError(e, "No se pudo guardar el cronograma"));
        } finally { setSaving(false); }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h4 className="font-semibold flex items-center gap-2"><Calendar className="h-4 w-4" />Cronograma</h4>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={addRow}><Plus className="h-4 w-4 mr-2" />Agregar</Button>
                    <Button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                        {saving ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Guardando…</> : <><Save className="h-4 w-4 mr-2" />Guardar</>}
                    </Button>
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center h-40">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-semibold">Actividad</th>
                                        <th className="px-4 py-2 text-left text-xs font-semibold">Vencimiento</th>
                                        <th className="px-4 py-2 text-left text-xs font-semibold">Responsable</th>
                                        <th className="px-4 py-2 text-left text-xs font-semibold">Estado</th>
                                        <th className="px-4 py-2 text-left text-xs font-semibold">Avance %</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {items.map((it, idx) => (
                                        <tr key={it.id}>
                                            <td className="px-4 py-2">
                                                <Input value={it.title} onChange={(e) => update(idx, { title: e.target.value })} placeholder="Actividad / Hito" />
                                            </td>
                                            <td className="px-4 py-2">
                                                <Input type="date" value={it.due_date?.slice(0, 10) || ""} onChange={(e) => update(idx, { due_date: e.target.value })} />
                                            </td>
                                            <td className="px-4 py-2">
                                                <Input value={it.responsible || ""} onChange={(e) => update(idx, { responsible: e.target.value })} placeholder="Docente/Alumno" />
                                            </td>
                                            <td className="px-4 py-2">
                                                <Select value={it.status || "PLANNED"} onValueChange={(v) => update(idx, { status: v })}>
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="PLANNED">Planificado</SelectItem>
                                                        <SelectItem value="IN_REVIEW">En Revisión</SelectItem>
                                                        <SelectItem value="DONE">Hecho</SelectItem>
                                                        <SelectItem value="DELAYED">Retrasado</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </td>
                                            <td className="px-4 py-2 w-[140px]">
                                                <Input type="number" min="0" max="100" value={it.progress ?? 0} onChange={(e) => update(idx, { progress: e.target.value })} />
                                            </td>
                                        </tr>
                                    ))}
                                    {items.length === 0 && (
                                        <tr><td colSpan="5" className="text-center py-8 text-gray-500">Sin actividades aún.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

/* =========================================================
   TAB: PRODUCTOS / ENTREGABLES
========================================================= */
const DeliverablesTab = ({ projectId }) => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);

    const [newRow, setNewRow] = useState({
        name: "", due_date: "", status: "PENDING", link: "",
    });

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const data = await Deliverables.list(projectId);
            setRows(data?.items ?? data ?? []);
        } catch (e) {
            toast.error(formatApiError(e, "Error al cargar productos"));
        } finally { setLoading(false); }
    }, [projectId]);

    useEffect(() => { load(); }, [load]);

    const add = async () => {
        try {
            if (!newRow.name) { toast.error("Ingrese el nombre del entregable"); return; }
            await Deliverables.create(projectId, { ...newRow });
            toast.success("Entregable agregado");
            setNewRow({ name: "", due_date: "", status: "PENDING", link: "" });
            load();
        } catch (e) {
            toast.error(formatApiError(e, "No se pudo crear el entregable"));
        }
    };

    const update = async (row, patch) => {
        try {
            await Deliverables.update(row.id, patch);
            load();
        } catch (e) {
            toast.error(formatApiError(e, "No se pudo actualizar"));
        }
    };

    return (
        <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2"><FileText className="h-4 w-4" />Productos / Entregables</h4>

            <Card>
                <CardHeader><CardTitle>Nuevo entregable</CardTitle></CardHeader>
                <CardContent className="grid md:grid-cols-4 gap-3">
                    <div className="md:col-span-2">
                        <Label>Nombre</Label>
                        <Input value={newRow.name} onChange={(e) => setNewRow({ ...newRow, name: e.target.value })} />
                    </div>
                    <div>
                        <Label>Vencimiento</Label>
                        <Input type="date" value={newRow.due_date} onChange={(e) => setNewRow({ ...newRow, due_date: e.target.value })} />
                    </div>
                    <div>
                        <Label>Estado</Label>
                        <Select value={newRow.status} onValueChange={(v) => setNewRow({ ...newRow, status: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="PENDING">Pendiente</SelectItem>
                                <SelectItem value="SUBMITTED">Enviado</SelectItem>
                                <SelectItem value="APPROVED">Aprobado</SelectItem>
                                <SelectItem value="REJECTED">Observado</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="md:col-span-3">
                        <Label>Enlace (drive/repo)</Label>
                        <Input value={newRow.link} onChange={(e) => setNewRow({ ...newRow, link: e.target.value })} />
                    </div>
                    <div className="md:col-span-1 flex items-end">
                        <Button onClick={add} className="w-full bg-blue-600 hover:bg-blue-700">
                            <Plus className="h-4 w-4 mr-2" />Agregar
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center h-40">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-semibold">Entregable</th>
                                        <th className="px-4 py-2 text-left text-xs font-semibold">Vencimiento</th>
                                        <th className="px-4 py-2 text-left text-xs font-semibold">Estado</th>
                                        <th className="px-4 py-2 text-left text-xs font-semibold">Enlace</th>
                                        <th className="px-4 py-2 text-left text-xs font-semibold">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {rows.map((r) => (
                                        <tr key={r.id}>
                                            <td className="px-4 py-2">{r.name}</td>
                                            <td className="px-4 py-2 text-sm text-gray-600">{r.due_date ? new Date(r.due_date).toLocaleDateString() : "-"}</td>
                                            <td className="px-4 py-2">
                                                <Select value={r.status || "PENDING"} onValueChange={(v) => update(r, { status: v })}>
                                                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="PENDING">Pendiente</SelectItem>
                                                        <SelectItem value="SUBMITTED">Enviado</SelectItem>
                                                        <SelectItem value="APPROVED">Aprobado</SelectItem>
                                                        <SelectItem value="REJECTED">Observado</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </td>
                                            <td className="px-4 py-2 text-xs break-all">{r.link || "-"}</td>
                                            <td className="px-4 py-2">
                                                <div className="flex gap-2">
                                                    {r.link && (
                                                        <a className="text-blue-600 text-sm underline" href={r.link} target="_blank" rel="noreferrer">
                                                            Abrir
                                                        </a>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {rows.length === 0 && (
                                        <tr><td colSpan="5" className="text-center py-8 text-gray-500">Sin entregables.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

/* =========================================================
   TAB: EVALUACIÓN
========================================================= */
const EvaluationTab = ({ projectId }) => {
    const defaultRubric = { originality: 0.25, methodology: 0.25, execution: 0.25, results: 0.15, documentation: 0.10 };
    const [rubric, setRubric] = useState(defaultRubric);
    const [scores, setScores] = useState({ originality: 0, methodology: 0, execution: 0, results: 0, documentation: 0 });
    const [comment, setComment] = useState("");
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const data = await Evaluations.list(projectId);
            setHistory(data?.evaluations ?? []);
        } catch (e) {
            toast.error(formatApiError(e, "Error al cargar evaluaciones"));
        } finally { setLoading(false); }
    }, [projectId]);

    useEffect(() => { load(); }, [load]);

    const total = useMemo(() => {
        const clamp = (n) => Math.max(0, Math.min(20, Number(n || 0)));
        const s = scores;
        const t = (clamp(s.originality) * rubric.originality) +
            (clamp(s.methodology) * rubric.methodology) +
            (clamp(s.execution) * rubric.execution) +
            (clamp(s.results) * rubric.results) +
            (clamp(s.documentation) * rubric.documentation);
        return Math.round(t * 100) / 100;
    }, [scores, rubric]);

    const save = async () => {
        try {
            const payload = { rubric, scores, total, comment };
            await Evaluations.save(projectId, payload);
            toast.success("Evaluación registrada");
            setScores({ originality: 0, methodology: 0, execution: 0, results: 0, documentation: 0 });
            setComment("");
            load();
        } catch (e) {
            toast.error(formatApiError(e, "No se pudo guardar la evaluación"));
        }
    };

    return (
        <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2"><Award className="h-4 w-4" />Evaluación por Rubrica</h4>

            <Card>
                <CardHeader><CardTitle>Captura de calificaciones</CardTitle></CardHeader>
                <CardContent className="grid md:grid-cols-5 gap-3">
                    {Object.keys(rubric).map((k) => (
                        <div key={k}>
                            <Label className="capitalize">{k}</Label>
                            <Input type="number" min="0" max="20" step="0.5"
                                value={scores[k]} onChange={(e) => setScores((p) => ({ ...p, [k]: e.target.value }))} />
                            <p className="text-xs text-gray-500 mt-1">Peso: {(rubric[k] * 100).toFixed(0)}%</p>
                        </div>
                    ))}
                    <div className="md:col-span-5">
                        <Label>Comentario</Label>
                        <Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Observaciones" />
                    </div>
                    <div className="md:col-span-5 flex items-center justify-between">
                        <div className="text-lg">
                            <b>Promedio Ponderado:</b> {total.toFixed(2)} / 20
                        </div>
                        <Button onClick={save} className="bg-blue-600 hover:bg-blue-700">
                            <Save className="h-4 w-4 mr-2" />Guardar evaluación
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>Historial de Evaluaciones</CardTitle></CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center h-32">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-semibold">Fecha</th>
                                        <th className="px-4 py-2 text-left text-xs font-semibold">Evaluador</th>
                                        <th className="px-4 py-2 text-left text-xs font-semibold">Promedio</th>
                                        <th className="px-4 py-2 text-left text-xs font-semibold">Comentario</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {history.map((h) => (
                                        <tr key={h.id}>
                                            <td className="px-4 py-2 text-sm text-gray-600">{h.created_at ? new Date(h.created_at).toLocaleString() : "-"}</td>
                                            <td className="px-4 py-2 text-sm">{h.evaluator_name || "-"}</td>
                                            <td className="px-4 py-2">{h.total?.toFixed?.(2) ?? h.total}</td>
                                            <td className="px-4 py-2 text-sm">{h.comment || "-"}</td>
                                        </tr>
                                    ))}
                                    {history.length === 0 && (
                                        <tr><td colSpan="4" className="text-center py-8 text-gray-500">Sin evaluaciones registradas.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

/* =========================================================
   REPORTES
========================================================= */
const ReportsModule = () => {
    const [year, setYear] = useState(String(new Date().getFullYear()));
    const [status, setStatus] = useState("ALL");
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(false);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const data = await Reports.summary({ year: Number(year), status: status === "ALL" ? undefined : status });
            setSummary(data);
        } catch (e) {
            toast.error(formatApiError(e, "Error al cargar reporte"));
        } finally { setLoading(false); }
    }, [year, status]);

    useEffect(() => { load(); }, [load]);

    const exportPdf = async () => {
        try {
            const result = await generatePDFWithPolling(
                "/research/reports/summary/export",
                { year: Number(year), status: status === "ALL" ? undefined : status },
                { testId: "research-report-pdf" }
            );
            if (result?.success) {
                await downloadFile(result.downloadUrl, `reporte-investigacion-${year}.pdf`);
                toast.success("Reporte exportado");
            } else {
                toast.error("No se pudo exportar el PDF");
            }
        } catch (e) {
            toast.error(formatApiError(e, "Error al exportar"));
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold">Reportes de Investigación</h2>
                    <p className="text-gray-600">Avance, estados y productos</p>
                </div>
                <div className="flex gap-2 items-center">
                    <Select value={year} onValueChange={setYear}>
                        <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="2025">2025</SelectItem>
                            <SelectItem value="2024">2024</SelectItem>
                            <SelectItem value="2023">2023</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger className="w-48"><SelectValue placeholder="Estado" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Todos</SelectItem>
                            {Object.keys(STATUS_CFG).map((s) => (
                                <SelectItem key={s} value={s}>{STATUS_CFG[s].label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button onClick={load} variant="outline"><RefreshCw className="h-4 w-4 mr-2" />Actualizar</Button>
                    <Button onClick={exportPdf}><Download className="h-4 w-4 mr-2" />Exportar PDF</Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Resumen</CardTitle>
                    <CardDescription>{year} — {status === "ALL" ? "todos los estados" : STATUS_CFG[status]?.label}</CardDescription>
                </CardHeader>
                <CardContent>
                    {!summary || loading ? (
                        <div className="flex items-center justify-center h-40">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
                        </div>
                    ) : (
                        <div className="grid md:grid-cols-4 gap-4">
                            <StatTile icon={BookOpen} color="text-blue-600" title="Proyectos" value={summary.total_projects ?? 0} />
                            <StatTile icon={Users} color="text-purple-600" title="Asesores" value={summary.total_advisors ?? 0} />
                            <StatTile icon={ClipboardList} color="text-amber-600" title="Entregables" value={summary.total_deliverables ?? 0} />
                            <StatTile icon={Award} color="text-green-600" title="Promedio Evaluación" value={summary.avg_score ? `${summary.avg_score.toFixed(2)}/20` : "—"} />
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

const StatTile = ({ icon: Icon, title, value, color }) => (
    <div className="p-4 rounded-lg bg-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
            <Icon className={`h-8 w-8 ${color}`} />
            <div className="font-semibold">{title}</div>
        </div>
        <div className="text-2xl font-bold">{value}</div>
    </div>
);

/* =========================================================
   CATÁLOGOS – CRUD de líneas y asesores
========================================================= */
const CatalogsTab = () => {
    const [lines, setLines] = useState([]);
    const [advisors, setAdvisors] = useState([]);
    const [loading, setLoading] = useState(true);

    // formularios Líneas
    const [openLineForm, setOpenLineForm] = useState(false);
    const [lineEditing, setLineEditing] = useState(null);
    const [lineForm, setLineForm] = useState({ name: "" });

    // formularios Asesores
    const [openAdvisorForm, setOpenAdvisorForm] = useState(false);
    const [advisorEditing, setAdvisorEditing] = useState(null);
    const [advisorForm, setAdvisorForm] = useState({ full_name: "", email: "", orcid: "" });

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const [ls, adv] = await Promise.all([Catalog.lines(), Catalog.advisors()]);
            setLines(ls?.items ?? ls ?? []);
            setAdvisors(adv?.items ?? adv ?? []);
        } catch (e) {
            toast.error(formatApiError(e, "Error cargando catálogos"));
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    // --- Líneas
    const openCreateLine = () => { setLineEditing(null); setLineForm({ name: "" }); setOpenLineForm(true); };
    const openEditLine = (l) => { setLineEditing(l); setLineForm({ name: l.name || "" }); setOpenLineForm(true); };

    const saveLine = async (e) => {
        e.preventDefault();
        try {
            if (lineEditing) {
                await Catalog.updateLine(lineEditing.id, { name: lineForm.name });
                toast.success("Línea actualizada");
            } else {
                await Catalog.createLine({ name: lineForm.name });
                toast.success("Línea creada");
            }
            setOpenLineForm(false);
            load();
        } catch (e2) {
            toast.error(formatApiError(e2, "No se pudo guardar la línea"));
        }
    };

    const removeLine = async (l) => {
        if (!window.confirm(`¿Eliminar la línea "${l.name}"?`)) return;
        try {
            await Catalog.removeLine(l.id);
            toast.success("Línea eliminada");
            load();
        } catch (e) {
            toast.error(formatApiError(e, "No se pudo eliminar"));
        }
    };

    // --- Asesores
    const openCreateAdvisor = () => { setAdvisorEditing(null); setAdvisorForm({ full_name: "", email: "", orcid: "" }); setOpenAdvisorForm(true); };
    const openEditAdvisor = (a) => { setAdvisorEditing(a); setAdvisorForm({ full_name: a.full_name || "", email: a.email || "", orcid: a.orcid || "" }); setOpenAdvisorForm(true); };

    const saveAdvisor = async (e) => {
        e.preventDefault();
        try {
            if (advisorEditing) {
                await Catalog.updateAdvisor(advisorEditing.id, advisorForm);
                toast.success("Asesor actualizado");
            } else {
                await Catalog.createAdvisor(advisorForm);
                toast.success("Asesor creado");
            }
            setOpenAdvisorForm(false);
            load();
        } catch (e2) {
            toast.error(formatApiError(e2, "No se pudo guardar el asesor"));
        }
    };

    const removeAdvisor = async (a) => {
        if (!window.confirm(`¿Eliminar al asesor "${a.full_name}"?`)) return;
        try {
            await Catalog.removeAdvisor(a.id);
            toast.success("Asesor eliminado");
            load();
        } catch (e) {
            toast.error(formatApiError(e, "No se pudo eliminar"));
        }
    };

    return (
        <div className="space-y-6">
            {/* LÍNEAS */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-semibold">Líneas de investigación</h3>
                    <p className="text-sm text-gray-600">Base para clasificar proyectos</p>
                </div>
                <Button onClick={openCreateLine}><Plus className="h-4 w-4 mr-2" />Nueva línea</Button>
            </div>

            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center h-36">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="p-2 text-left">Nombre</th>
                                        <th className="p-2 text-left w-32">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {lines.map(l => (
                                        <tr key={l.id}>
                                            <td className="p-2">{l.name}</td>
                                            <td className="p-2">
                                                <div className="flex gap-2">
                                                    <Button size="sm" variant="outline" onClick={() => openEditLine(l)}>
                                                        <Edit3 className="h-4 w-4" />
                                                    </Button>
                                                    <Button size="sm" variant="outline" onClick={() => removeLine(l)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {lines.length === 0 && <tr><td className="p-4 text-center text-gray-500" colSpan={2}>Sin líneas</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* DIALOG LÍNEA */}
            <Dialog open={openLineForm} onOpenChange={setOpenLineForm}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{lineEditing ? "Editar línea" : "Nueva línea"}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={saveLine} className="space-y-3">
                        <div>
                            <Label>Nombre</Label>
                            <Input value={lineForm.name} onChange={(e) => setLineForm({ name: e.target.value })} required />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setOpenLineForm(false)}>Cancelar</Button>
                            <Button type="submit"><Save className="h-4 w-4 mr-2" />Guardar</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ASESORES */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-semibold">Asesores</h3>
                    <p className="text-sm text-gray-600">Docentes/investigadores que asesoran proyectos</p>
                </div>
                <Button onClick={openCreateAdvisor}><Plus className="h-4 w-4 mr-2" />Nuevo asesor</Button>
            </div>

            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center h-36">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="p-2 text-left">Nombre</th>
                                        <th className="p-2 text-left">Email</th>
                                        <th className="p-2 text-left">ORCID</th>
                                        <th className="p-2 text-left w-32">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {advisors.map(a => (
                                        <tr key={a.id}>
                                            <td className="p-2">{a.full_name}</td>
                                            <td className="p-2">{a.email || "-"}</td>
                                            <td className="p-2">{a.orcid || "-"}</td>
                                            <td className="p-2">
                                                <div className="flex gap-2">
                                                    <Button size="sm" variant="outline" onClick={() => openEditAdvisor(a)}>
                                                        <Edit3 className="h-4 w-4" />
                                                    </Button>
                                                    <Button size="sm" variant="outline" onClick={() => removeAdvisor(a)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {advisors.length === 0 && <tr><td className="p-4 text-center text-gray-500" colSpan={4}>Sin asesores</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* DIALOG ASESOR */}
            <Dialog open={openAdvisorForm} onOpenChange={setOpenAdvisorForm}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{advisorEditing ? "Editar asesor" : "Nuevo asesor"}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={saveAdvisor} className="space-y-3">
                        <div>
                            <Label>Nombre completo</Label>
                            <Input value={advisorForm.full_name} onChange={(e) => setAdvisorForm({ ...advisorForm, full_name: e.target.value })} required />
                        </div>
                        <div>
                            <Label>Email</Label>
                            <Input type="email" value={advisorForm.email} onChange={(e) => setAdvisorForm({ ...advisorForm, email: e.target.value })} />
                        </div>
                        <div>
                            <Label>ORCID</Label>
                            <Input value={advisorForm.orcid} onChange={(e) => setAdvisorForm({ ...advisorForm, orcid: e.target.value })} />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setOpenAdvisorForm(false)}>Cancelar</Button>
                            <Button type="submit"><Save className="h-4 w-4 mr-2" />Guardar</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
};

/* =========================================================
   CONVOCATORIAS (Calls) — placeholder funcional
========================================================= */
const CallsModule = () => {
    const [items, setItems] = useState([]);
    return (
        <div className="space-y-4">
            <h2 className="text-2xl font-bold">Convocatorias</h2>
            <p className="text-gray-600">Publica y gestiona convocatorias de proyectos.</p>
            <Card>
                <CardHeader><CardTitle>Listado</CardTitle></CardHeader>
                <CardContent className="text-sm text-gray-600">
                    {items.length === 0 ? "Aún no hay convocatorias." : JSON.stringify(items)}
                </CardContent>
            </Card>
        </div>
    );
};

/* =========================================================
   MAIN MODULE
========================================================= */
const ResearchModule = () => {
    return (
        <div className="p-6">
            <Tabs defaultValue="projects" className="space-y-6">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="projects">Proyectos</TabsTrigger>
                    <TabsTrigger value="reports">Reportes</TabsTrigger>
                    <TabsTrigger value="catalogs">Catálogos</TabsTrigger>
                    <TabsTrigger value="calls">Convocatorias</TabsTrigger>
                </TabsList>

                <TabsContent value="projects"><ProjectsManagement /></TabsContent>
                <TabsContent value="reports"><ReportsModule /></TabsContent>
                <TabsContent value="catalogs"><CatalogsTab /></TabsContent>
                <TabsContent value="calls"><CallsModule /></TabsContent>
            </Tabs>
        </div>
    );
};

export default ResearchModule;
