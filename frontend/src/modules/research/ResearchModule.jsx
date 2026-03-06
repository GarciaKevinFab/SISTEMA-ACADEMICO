/**
 * ResearchModule.jsx
 * Módulo de Investigación – IESPP Gustavo Allende Llavería
 *
 * Estilo Mesa de Partes Digital (v2 – UX mejorado):
 * - Skeleton loaders en dashboard y tablas
 * - Búsqueda con debounce
 * - Tooltips en acciones
 * - Loading states en botones
 * - Mejor responsive / empty states
 * - Dashboard con mejores indicadores visuales
 * - Confirmación contextual antes de navegación destructiva
 * - Quick-filters con conteo en proyectos
 * - Footer con conteo en tablas
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import {
    Dashboard, Projects, Reports, Catalog,
} from "../../services/research.service";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Card, CardContent } from "@/components/ui/card";
import {
    Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

import ScheduleTab from "./tabs/ScheduleTab";
import DeliverablesTab from "./tabs/DeliverablesTab";
import TeamTab from "./tabs/TeamTab";
import BudgetTab from "./tabs/BudgetTab";
import PublicationsTab from "./tabs/PublicationsTab";
import EthicsIpTab from "./tabs/EthicsIpTab";
import EvaluationTab from "./tabs/EvaluationTab";

import {
    Plus, Search, Edit, Trash2, Eye, FileText,
    Calendar, Users, Wallet, BookOpen, ShieldCheck,
    BarChart3, Settings, Download, ClipboardCheck,
    ChevronLeft, Loader2, FlaskConical, AlertTriangle,
    TrendingUp, CheckCircle2, FolderOpen,
    Megaphone, ArrowRight, Activity, GitBranch,
    UserCircle2, Mail, Sparkles, ListTree, X,
    Hash, Clock,
} from "lucide-react";

import { toast } from "sonner";

/* ─── Hooks ─── */
function useDebounce(value, delay = 300) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
}

/* ─── Constantes ─── */
const STATUS_MAP = {
    DRAFT: { label: "Borrador", color: "bg-slate-100 text-slate-700 border-slate-200", dot: "bg-slate-400" },
    IN_REVIEW: { label: "En revisión", color: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
    APPROVED: { label: "Aprobado", color: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
    REJECTED: { label: "Rechazado", color: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
    IN_PROGRESS: { label: "En ejecución", color: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
    RUNNING: { label: "En ejecución", color: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
    ON_HOLD: { label: "Suspendido", color: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-orange-500" },
    COMPLETED: { label: "Finalizado", color: "bg-violet-50 text-violet-700 border-violet-200", dot: "bg-violet-500" },
    FINISHED: { label: "Finalizado", color: "bg-violet-50 text-violet-700 border-violet-200", dot: "bg-violet-500" },
};

const FILTER_STATUSES = [
    { value: "DRAFT", label: "Borrador" },
    { value: "IN_REVIEW", label: "En revisión" },
    { value: "APPROVED", label: "Aprobado" },
    { value: "REJECTED", label: "Rechazado" },
    { value: "IN_PROGRESS", label: "En ejecución" },
    { value: "ON_HOLD", label: "Suspendido" },
    { value: "COMPLETED", label: "Finalizado" },
];

/* ─── Skeletons ─── */
function DashboardSkeleton() {
    return (
        <div className="space-y-6 animate-pulse">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="bg-white rounded-xl border border-slate-200 border-t-4 border-t-slate-200 p-4 min-h-[120px]">
                        <div className="flex justify-between mb-4">
                            <div className="h-3 w-20 bg-slate-200 rounded" />
                            <div className="h-8 w-8 bg-slate-100 rounded-full" />
                        </div>
                        <div className="h-8 w-12 bg-slate-200 rounded mb-1" />
                        <div className="h-3 w-16 bg-slate-100 rounded" />
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-5 h-48" />
                <div className="bg-white rounded-xl border border-slate-200 p-5 h-48" />
            </div>
        </div>
    );
}

function TableSkeleton({ rows = 5 }) {
    return (
        <div className="divide-y divide-slate-100">
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3.5 animate-pulse">
                    <div className="h-4 w-16 bg-slate-200 rounded" />
                    <div className="h-4 flex-1 bg-slate-100 rounded max-w-[200px]" />
                    <div className="h-4 w-24 bg-slate-100 rounded hidden md:block" />
                    <div className="h-5 w-20 bg-slate-100 rounded-md" />
                    <div className="flex gap-1 ml-auto">
                        <div className="h-8 w-8 bg-slate-100 rounded" />
                        <div className="h-8 w-8 bg-slate-100 rounded" />
                    </div>
                </div>
            ))}
        </div>
    );
}

/* ─── Action Button con Tooltip ─── */
function ActionBtn({ icon: Icon, label, onClick, iconClass = "text-slate-500" }) {
    return (
        <TooltipProvider delayDuration={200}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClick}>
                        <Icon className={`h-4 w-4 ${iconClass}`} />
                    </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">{label}</TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

/* ═══════════════════════════════════════ */
export default function ResearchModule() {
    const [mainTab, setMainTab] = useState("dashboard");
    const [projectView, setProjectView] = useState("list");
    const [selectedProject, setSelectedProject] = useState(null);
    const [detailTab, setDetailTab] = useState("info");
    const [stats, setStats] = useState(null);
    const [statsLoading, setStatsLoading] = useState(false);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQ, setSearchQ] = useState("");
    const debouncedSearch = useDebounce(searchQ, 250);
    const [filterStatus, setFilterStatus] = useState("");
    const [projectDialog, setProjectDialog] = useState(false);
    const [editingProject, setEditingProject] = useState(null);
    const [projectForm, setProjectForm] = useState({});
    const [saving, setSaving] = useState(false);
    const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null, title: "" });
    const [lines, setLines] = useState([]);
    const [advisors, setAdvisors] = useState([]);
    const [reportData, setReportData] = useState(null);
    const [reportLoading, setReportLoading] = useState(false);
    const [reportYear, setReportYear] = useState(new Date().getFullYear().toString());

    const loadStats = useCallback(async () => {
        setStatsLoading(true);
        try { setStats(await Dashboard.stats()); } catch (e) { console.error("Dashboard stats:", e); }
        finally { setStatsLoading(false); }
    }, []);

    const loadProjects = useCallback(async () => {
        setLoading(true);
        try {
            const params = {}; if (filterStatus) params.status = filterStatus;
            const data = await Projects.list(params);
            setProjects(Array.isArray(data) ? data : []);
        } catch { toast.error("Error al cargar proyectos"); }
        finally { setLoading(false); }
    }, [filterStatus]);

    const loadCatalogs = useCallback(async () => {
        try {
            const [l, a] = await Promise.all([Catalog.lines(), Catalog.advisors()]);
            setLines(Array.isArray(l) ? l : []);
            setAdvisors(Array.isArray(a) ? a : []);
        } catch { /* silent */ }
    }, []);

    useEffect(() => { loadStats(); loadCatalogs(); }, [loadStats, loadCatalogs]);
    useEffect(() => { if (mainTab === "projects") loadProjects(); }, [mainTab, loadProjects]);

    const openNewProject = () => {
        setEditingProject(null);
        setProjectForm({ title: "", summary: "", status: "DRAFT", line_id: "", advisor_id: "", start_date: "", end_date: "", code: "", budget: 0, keywords: "" });
        setProjectDialog(true);
    };

    const openEditProject = (p) => {
        setEditingProject(p);
        setProjectForm({
            title: p.title || "", summary: p.summary || "", status: p.status || "DRAFT",
            line_id: p.line_id || p.line || "", advisor_id: p.advisor_id || p.advisor || "",
            start_date: p.start_date || "", end_date: p.end_date || "",
            code: p.code || p.meta?.code || "", budget: p.budget || p.meta?.budget || 0,
            keywords: p.keywords || p.meta?.keywords || "",
        });
        setProjectDialog(true);
    };

    const saveProject = async () => {
        if (!projectForm.title?.trim()) { toast.error("El título es obligatorio"); return; }
        setSaving(true);
        try {
            if (editingProject) {
                const updated = await Projects.update(editingProject.id, projectForm);
                toast.success("Proyecto actualizado");
                if (selectedProject?.id === editingProject.id) setSelectedProject(prev => ({ ...prev, ...updated }));
            } else {
                await Projects.create(projectForm);
                toast.success("Proyecto creado");
            }
            setProjectDialog(false); loadProjects(); loadStats();
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Error al guardar");
        } finally {
            setSaving(false);
        }
    };

    const confirmDelete = async () => {
        try {
            await Projects.remove(deleteDialog.id);
            toast.success("Proyecto eliminado");
            setDeleteDialog({ open: false, id: null, title: "" });
            if (selectedProject?.id === deleteDialog.id) { setSelectedProject(null); setProjectView("list"); }
            loadProjects(); loadStats();
        } catch { toast.error("Error al eliminar"); }
    };

    const openDetail = (p) => { setSelectedProject(p); setDetailTab("info"); setProjectView("detail"); };

    const loadReport = async () => {
        setReportLoading(true);
        try { setReportData(await Reports.summary({ year: reportYear })); }
        catch { toast.error("Error al cargar reporte"); }
        finally { setReportLoading(false); }
    };

    const exportReport = async () => {
        try {
            const res = await Reports.exportSummary({ year: reportYear });
            if (res?.downloadUrl) window.open(res.downloadUrl, "_blank");
        } catch { toast.error("Error al exportar"); }
    };

    const filteredProjects = useMemo(() => {
        if (!debouncedSearch) return projects;
        const q = debouncedSearch.toLowerCase();
        return projects.filter(p =>
            (p.title || "").toLowerCase().includes(q) ||
            (p.code || "").toLowerCase().includes(q) ||
            (p.line_name || "").toLowerCase().includes(q) ||
            (p.advisor_name || "").toLowerCase().includes(q)
        );
    }, [projects, debouncedSearch]);

    // Status counts for quick filter
    const statusCounts = useMemo(() => {
        const counts = {};
        projects.forEach(p => { counts[p.status] = (counts[p.status] || 0) + 1; });
        return counts;
    }, [projects]);

    /* ═══════════════════════════════════════ */
    return (
        <div className="space-y-5">
            {/* ══ HEADER ══ */}
            <div className="bg-slate-800 rounded-xl px-6 py-4 flex items-center justify-between shadow-md">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-slate-700 flex items-center justify-center">
                        <FlaskConical className="h-5 w-5 text-indigo-300" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-white leading-tight">Investigación</h1>
                        <p className="text-xs text-slate-400">Gestión de proyectos de investigación</p>
                    </div>
                </div>
                <Badge className="bg-white/10 text-white border-white/20 text-sm px-3 py-1">Investigación</Badge>
            </div>

            {/* ══ TABS ══ */}
            <Tabs value={mainTab} onValueChange={(v) => {
                setMainTab(v);
                if (v === "dashboard") loadStats();
                if (v === "reports") loadReport();
                if (v === "projects") { setProjectView("list"); loadProjects(); }
                if (v === "catalogs") loadCatalogs();
            }}>
                <TabsList className="bg-white border border-slate-200 rounded-lg p-1 shadow-sm flex-wrap h-auto">
                    {[
                        { v: "dashboard", icon: BarChart3, label: "Dashboard" },
                        { v: "projects", icon: FolderOpen, label: "Proyectos" },
                        { v: "catalogs", icon: Settings, label: "Catálogos" },
                        { v: "reports", icon: TrendingUp, label: "Reportes" },
                    ].map(t => (
                        <TabsTrigger key={t.v} value={t.v} className="gap-1.5 text-sm data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:shadow-sm">
                            <t.icon className="h-4 w-4" /> {t.label}
                        </TabsTrigger>
                    ))}
                </TabsList>

                {/* ══ DASHBOARD ══ */}
                <TabsContent value="dashboard" className="space-y-6 mt-4">
                    {statsLoading ? <DashboardSkeleton /> : (<>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                            <StatsCard title="PROYECTOS ACTIVOS" value={stats?.active_projects ?? 0} subtitle="En ejecución" icon={Activity} accent="amber" />
                            <StatsCard title="COMPLETADOS" value={stats?.completed_projects ?? 0} subtitle="Finalizados" icon={CheckCircle2} accent="emerald" />
                            <StatsCard title="ENTREGABLES" value={stats?.pending_deliverables ?? 0} subtitle="Pendientes" icon={ClipboardCheck} accent="blue" />
                            <StatsCard title="ASESORES" value={stats?.total_advisors ?? 0} subtitle="Registrados" icon={Users} accent="teal" />
                            <StatsCard title="VENCIDOS" value={stats?.overdue_deliverables ?? 0} subtitle="Plazo excedido" icon={AlertTriangle} accent="red" highlight={stats?.overdue_deliverables > 0} />
                        </div>

                        <div className="space-y-3">
                            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Accesos Directos</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <ShortcutCard icon={Plus} iconBg="bg-indigo-50" iconColor="text-indigo-600" title="Nuevo Proyecto" subtitle="Registrar" onClick={openNewProject} />
                                <ShortcutCard icon={Search} iconBg="bg-sky-50" iconColor="text-sky-600" title="Buscar Proyecto" subtitle="Consultar estado" onClick={() => { setMainTab("projects"); setProjectView("list"); }} />
                                <ShortcutCard icon={Megaphone} iconBg="bg-emerald-50" iconColor="text-emerald-600" title="Convocatorias" subtitle={`${stats?.open_calls ?? 0} abiertas`} onClick={() => toast.info("Use el módulo de Convocatorias")} />
                                <ShortcutCard icon={TrendingUp} iconBg="bg-rose-50" iconColor="text-rose-600" title="Reportes" subtitle="Estadísticas" onClick={() => { setMainTab("reports"); loadReport(); }} />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* Proyectos por Estado */}
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                                <h4 className="text-sm font-semibold text-slate-700 mb-4">Proyectos por Estado</h4>
                                {stats?.by_status?.length > 0 ? (
                                    <div className="space-y-3">
                                        {stats.by_status.map(s => {
                                            const st = STATUS_MAP[s.status] || { label: s.status, color: "bg-slate-100 text-slate-600", dot: "bg-slate-400" };
                                            const pct = stats.total_projects > 0 ? Math.round((s.count / stats.total_projects) * 100) : 0;
                                            return (
                                                <div key={s.status} className="group">
                                                    <div className="flex items-center gap-3">
                                                        <span className={`inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-[11px] font-medium min-w-[100px] ${st.color}`}>
                                                            {st.label}
                                                        </span>
                                                        <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                                            <div
                                                                className="bg-indigo-500 h-full rounded-full transition-all duration-700 ease-out"
                                                                style={{ width: `${pct}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-sm font-mono font-semibold text-slate-700 w-10 text-right">
                                                            {s.count}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 w-8 text-right">
                                                            {pct}%
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <div className="pt-2 border-t border-slate-100 flex justify-between text-xs text-slate-400">
                                            <span>Total</span>
                                            <span className="font-mono font-semibold text-slate-600">{stats.total_projects}</span>
                                        </div>
                                    </div>
                                ) : (
                                    <EmptyMini icon={BarChart3} text="Sin datos disponibles" />
                                )}
                            </div>

                            {/* Últimos Proyectos */}
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="text-sm font-semibold text-slate-700">Últimos Proyectos</h4>
                                    <Button
                                        variant="ghost" size="sm"
                                        className="text-xs text-indigo-600 hover:text-indigo-800 h-7"
                                        onClick={() => { setMainTab("projects"); setProjectView("list"); }}
                                    >
                                        Ver todos <ArrowRight className="h-3 w-3 ml-1" />
                                    </Button>
                                </div>
                                {stats?.recent_projects?.length > 0 ? (
                                    <div className="divide-y divide-slate-100">
                                        {stats.recent_projects.map(p => {
                                            const st = STATUS_MAP[p.status] || { label: p.status, color: "bg-slate-100 text-slate-600" };
                                            return (
                                                <div key={p.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 group hover:bg-slate-50/50 -mx-2 px-2 rounded transition-colors">
                                                    <div className="flex-1 min-w-0 pr-3">
                                                        <span className="text-sm text-slate-700 truncate block">{p.title}</span>
                                                        {p.code && (
                                                            <span className="text-[10px] text-slate-400 font-mono">{p.code}</span>
                                                        )}
                                                    </div>
                                                    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium shrink-0 ${st.color}`}>
                                                        {st.label}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <EmptyMini icon={FolderOpen} text="Sin proyectos registrados" />
                                )}
                            </div>
                        </div>
                    </>)}
                </TabsContent>

                {/* ══ PROYECTOS ══ */}
                <TabsContent value="projects" className="mt-4">
                    {projectView === "list" && (
                        <div className="space-y-4">
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="relative flex-1 min-w-[200px]">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <Input
                                        placeholder="Buscar por título, código, línea o asesor..."
                                        className="pl-9 bg-white border-slate-200"
                                        value={searchQ}
                                        onChange={(e) => setSearchQ(e.target.value)}
                                    />
                                    {searchQ && (
                                        <button
                                            onClick={() => setSearchQ("")}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>
                                <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v === "ALL" ? "" : v)}>
                                    <SelectTrigger className="w-[180px] bg-white border-slate-200">
                                        <SelectValue placeholder="Todos los estados" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">
                                            Todos los estados
                                            <span className="ml-2 text-[10px] text-slate-400 font-mono">{projects.length}</span>
                                        </SelectItem>
                                        {FILTER_STATUSES.map(s => (
                                            <SelectItem key={s.value} value={s.value}>
                                                {s.label}
                                                {statusCounts[s.value] > 0 && (
                                                    <span className="ml-2 text-[10px] text-slate-400 font-mono">{statusCounts[s.value]}</span>
                                                )}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button onClick={openNewProject} className="bg-slate-800 hover:bg-slate-700 shadow-sm">
                                    <Plus className="h-4 w-4 mr-1.5" /> Nuevo Proyecto
                                </Button>
                            </div>

                            {loading ? (
                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                    <div className="bg-slate-50 border-b border-slate-200 px-4 py-3">
                                        <div className="h-3 w-48 bg-slate-200 rounded animate-pulse" />
                                    </div>
                                    <TableSkeleton rows={6} />
                                </div>
                            ) : filteredProjects.length === 0 ? (
                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm py-16 text-center">
                                    <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                                        {searchQ || filterStatus
                                            ? <Search className="h-6 w-6 text-slate-400" />
                                            : <FolderOpen className="h-6 w-6 text-slate-400" />}
                                    </div>
                                    <p className="text-slate-600 font-semibold">
                                        {searchQ || filterStatus ? "No se encontraron proyectos" : "No hay proyectos registrados"}
                                    </p>
                                    <p className="text-sm text-slate-400 mt-1 max-w-xs mx-auto">
                                        {searchQ ? "Intenta con otros términos de búsqueda"
                                            : filterStatus ? "No hay proyectos con este estado"
                                                : "Crea el primer proyecto para empezar"}
                                    </p>
                                    {!searchQ && !filterStatus && (
                                        <Button size="sm" className="mt-4 bg-slate-800 hover:bg-slate-700" onClick={openNewProject}>
                                            <Plus className="h-3.5 w-3.5 mr-1" /> Crear proyecto
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-slate-50/80 border-b border-slate-200">
                                                <th className="text-left px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Código</th>
                                                <th className="text-left px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Título</th>
                                                <th className="text-left px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider hidden md:table-cell">Línea</th>
                                                <th className="text-left px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Estado</th>
                                                <th className="text-left px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider hidden lg:table-cell">Inicio</th>
                                                <th className="text-right px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredProjects.map(p => {
                                                const st = STATUS_MAP[p.status] || { label: p.status, color: "bg-slate-100 text-slate-600", dot: "bg-slate-400" };
                                                return (
                                                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                                                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.code || p.meta?.code || "—"}</td>
                                                        <td className="px-4 py-3">
                                                            <button onClick={() => openDetail(p)} className="font-medium text-slate-800 hover:text-indigo-600 group-hover:text-indigo-600 transition-colors text-left">
                                                                {p.title}
                                                            </button>
                                                            {p.advisor_name && (
                                                                <p className="text-[10px] text-slate-400 mt-0.5">{p.advisor_name}</p>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-500 text-xs hidden md:table-cell">{p.line_name || "—"}</td>
                                                        <td className="px-4 py-3">
                                                            <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${st.color}`}>
                                                                <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                                                                {st.label}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-500 text-xs hidden lg:table-cell">{p.start_date || "—"}</td>
                                                        <td className="px-4 py-3 text-right">
                                                            <div className="flex justify-end gap-0.5 opacity-70 group-hover:opacity-100 transition-opacity">
                                                                <ActionBtn icon={Eye} label="Ver detalle" onClick={() => openDetail(p)} />
                                                                <ActionBtn icon={Edit} label="Editar" onClick={() => openEditProject(p)} />
                                                                <ActionBtn icon={Trash2} label="Eliminar" iconClass="text-red-400" onClick={() => setDeleteDialog({ open: true, id: p.id, title: p.title })} />
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                    <div className="px-4 py-2.5 bg-slate-50/50 border-t border-slate-100 text-xs text-slate-400">
                                        Mostrando {filteredProjects.length} de {projects.length} proyectos
                                        {filterStatus && ` · Filtro: ${FILTER_STATUSES.find(s => s.value === filterStatus)?.label || filterStatus}`}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {projectView === "detail" && selectedProject && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <Button variant="ghost" size="sm" onClick={() => setProjectView("list")} className="text-slate-600">
                                    <ChevronLeft className="h-4 w-4 mr-1" /> Volver
                                </Button>
                                <div className="flex-1 min-w-0">
                                    <h2 className="text-base font-bold text-slate-800 truncate">{selectedProject.title}</h2>
                                    {selectedProject.code && (
                                        <p className="text-[11px] text-slate-400 font-mono">{selectedProject.code}</p>
                                    )}
                                </div>
                                <Button variant="outline" size="sm" className="border-slate-200" onClick={() => openEditProject(selectedProject)}>
                                    <Edit className="h-3.5 w-3.5 mr-1" /> Editar
                                </Button>
                                <span className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium ${STATUS_MAP[selectedProject.status]?.color || "bg-slate-100 text-slate-600"}`}>
                                    <span className={`h-1.5 w-1.5 rounded-full ${STATUS_MAP[selectedProject.status]?.dot || "bg-slate-400"}`} />
                                    {STATUS_MAP[selectedProject.status]?.label || selectedProject.status}
                                </span>
                            </div>
                            <Tabs value={detailTab} onValueChange={setDetailTab}>
                                <TabsList className="flex-wrap h-auto bg-white border border-slate-200 shadow-sm p-1 rounded-lg">
                                    {[
                                        { v: "info", icon: FileText, l: "Info" },
                                        { v: "schedule", icon: Calendar, l: "Cronograma" },
                                        { v: "deliverables", icon: ClipboardCheck, l: "Entregables" },
                                        { v: "team", icon: Users, l: "Equipo" },
                                        { v: "budget", icon: Wallet, l: "Presupuesto" },
                                        { v: "publications", icon: BookOpen, l: "Publicaciones" },
                                        { v: "ethics", icon: ShieldCheck, l: "Ética & PI" },
                                        { v: "evaluation", icon: BarChart3, l: "Evaluación" },
                                    ].map(t => (
                                        <TabsTrigger key={t.v} value={t.v} className="text-xs gap-1 data-[state=active]:bg-slate-800 data-[state=active]:text-white">
                                            <t.icon className="h-3.5 w-3.5" />{t.l}
                                        </TabsTrigger>
                                    ))}
                                </TabsList>
                                <TabsContent value="info"><ProjectInfoCard project={selectedProject} /></TabsContent>
                                <TabsContent value="schedule"><ScheduleTab projectId={selectedProject.id} /></TabsContent>
                                <TabsContent value="deliverables"><DeliverablesTab projectId={selectedProject.id} /></TabsContent>
                                <TabsContent value="team"><TeamTab projectId={selectedProject.id} /></TabsContent>
                                <TabsContent value="budget"><BudgetTab projectId={selectedProject.id} /></TabsContent>
                                <TabsContent value="publications"><PublicationsTab projectId={selectedProject.id} /></TabsContent>
                                <TabsContent value="ethics"><EthicsIpTab projectId={selectedProject.id} /></TabsContent>
                                <TabsContent value="evaluation"><EvaluationTab projectId={selectedProject.id} /></TabsContent>
                            </Tabs>
                        </div>
                    )}
                </TabsContent>

                {/* ══ CATÁLOGOS ══ */}
                <TabsContent value="catalogs" className="mt-4">
                    <CatalogManager lines={lines} advisors={advisors} onRefresh={loadCatalogs} />
                </TabsContent>

                {/* ══ REPORTES ══ */}
                <TabsContent value="reports" className="mt-4">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-lg bg-indigo-50 flex items-center justify-center">
                                    <TrendingUp className="h-5 w-5 text-indigo-600" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-800">Reportes de Investigación</h3>
                                    <p className="text-xs text-slate-400">Resumen estadístico por año</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Input
                                    type="number"
                                    className="w-[90px] bg-white text-center border-slate-200"
                                    value={reportYear}
                                    onChange={(e) => setReportYear(e.target.value)}
                                />
                                <Button size="sm" className="bg-slate-800 hover:bg-slate-700 shadow-sm" onClick={loadReport} disabled={reportLoading}>
                                    {reportLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                                    Consultar
                                </Button>
                                <Button size="sm" variant="outline" className="border-slate-200" onClick={exportReport}>
                                    <Download className="h-3.5 w-3.5 mr-1" /> PDF
                                </Button>
                            </div>
                        </div>
                        <div className="p-6">
                            {reportLoading ? (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
                                    {Array.from({ length: 4 }).map((_, i) => (
                                        <div key={i} className="rounded-xl border border-slate-200 border-t-4 border-t-slate-200 p-4">
                                            <div className="h-7 w-10 bg-slate-200 rounded mb-1" />
                                            <div className="h-3 w-14 bg-slate-100 rounded" />
                                        </div>
                                    ))}
                                </div>
                            ) : reportData ? (
                                <div className="space-y-5">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <MiniStat value={reportData.total_projects ?? "—"} label="Proyectos" accent="indigo" />
                                        <MiniStat value={reportData.total_advisors ?? "—"} label="Asesores" accent="emerald" />
                                        <MiniStat value={reportData.total_deliverables ?? "—"} label="Entregables" accent="blue" />
                                        <MiniStat value={reportData.avg_score ?? "—"} label="Puntaje Prom." accent="amber" />
                                    </div>
                                    {reportData.by_status?.length > 0 && (
                                        <div>
                                            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Por Estado</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {reportData.by_status.map(s => (
                                                    <span key={s.status} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm shadow-sm">
                                                        <span className={`h-2 w-2 rounded-full ${STATUS_MAP[s.status]?.dot || "bg-slate-400"}`} />
                                                        <span className="font-medium text-slate-600">
                                                            {(STATUS_MAP[s.status] || { label: s.status }).label}
                                                        </span>
                                                        <span className="font-bold text-slate-800">{s.count}</span>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                                        <BarChart3 className="h-6 w-6 text-slate-400" />
                                    </div>
                                    <p className="text-slate-600 font-semibold">Sin datos</p>
                                    <p className="text-sm text-slate-400 mt-1">Seleccione un año y presione "Consultar"</p>
                                </div>
                            )}
                        </div>
                    </div>
                </TabsContent>
            </Tabs>

            {/* ═══ DIALOGS ═══ */}
            <Dialog open={projectDialog} onOpenChange={setProjectDialog}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-slate-800">
                            {editingProject ? "Editar Proyecto" : "Nuevo Proyecto"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div>
                            <label className="text-sm font-medium text-slate-700">Título *</label>
                            <Input className="mt-1 border-slate-200" value={projectForm.title || ""} onChange={(e) => setProjectForm(p => ({ ...p, title: e.target.value }))} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium text-slate-700">Código</label>
                                <Input className="mt-1 border-slate-200" placeholder="PRY-2026-001" value={projectForm.code || ""} onChange={(e) => setProjectForm(p => ({ ...p, code: e.target.value }))} />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700">Estado</label>
                                <Select value={projectForm.status || "DRAFT"} onValueChange={(v) => setProjectForm(p => ({ ...p, status: v }))}>
                                    <SelectTrigger className="mt-1 border-slate-200"><SelectValue /></SelectTrigger>
                                    <SelectContent>{FILTER_STATUSES.map(s => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}</SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium text-slate-700">Línea</label>
                                <Select value={String(projectForm.line_id || "")} onValueChange={(v) => setProjectForm(p => ({ ...p, line_id: v }))}>
                                    <SelectTrigger className="mt-1 border-slate-200"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                                    <SelectContent>{lines.map(l => (<SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>))}</SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700">Asesor</label>
                                <Select value={String(projectForm.advisor_id || "")} onValueChange={(v) => setProjectForm(p => ({ ...p, advisor_id: v }))}>
                                    <SelectTrigger className="mt-1 border-slate-200"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                                    <SelectContent>{advisors.map(a => (<SelectItem key={a.id} value={String(a.id)}>{a.full_name}</SelectItem>))}</SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="text-sm font-medium text-slate-700">Fecha inicio</label>
                                <Input type="date" className="mt-1 border-slate-200" value={projectForm.start_date || ""} onChange={(e) => setProjectForm(p => ({ ...p, start_date: e.target.value }))} />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700">Fecha fin</label>
                                <Input type="date" className="mt-1 border-slate-200" value={projectForm.end_date || ""} onChange={(e) => setProjectForm(p => ({ ...p, end_date: e.target.value }))} />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700">Presupuesto (S/)</label>
                                <Input type="number" className="mt-1 border-slate-200" value={projectForm.budget || ""} onChange={(e) => setProjectForm(p => ({ ...p, budget: e.target.value }))} />
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700">Palabras clave</label>
                            <Input className="mt-1 border-slate-200" value={projectForm.keywords || ""} onChange={(e) => setProjectForm(p => ({ ...p, keywords: e.target.value }))} placeholder="Separadas por coma" />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700">Resumen</label>
                            <Textarea rows={3} className="mt-1 border-slate-200" value={projectForm.summary || ""} onChange={(e) => setProjectForm(p => ({ ...p, summary: e.target.value }))} />
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline" className="border-slate-200">Cancelar</Button></DialogClose>
                        <Button onClick={saveProject} disabled={saving} className="bg-slate-800 hover:bg-slate-700">
                            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            {editingProject ? "Guardar cambios" : "Crear Proyecto"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={deleteDialog.open} onOpenChange={(v) => setDeleteDialog(p => ({ ...p, open: v }))}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar proyecto?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Se eliminará permanentemente <strong>"{deleteDialog.title}"</strong> y todos sus datos asociados (cronograma, entregables, equipo, presupuesto, etc). Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={confirmDelete}>Eliminar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

/* ─── StatsCard ─── */
const ACCENT = {
    amber: { border: "border-t-amber-400", iconBg: "bg-amber-50", iconText: "text-amber-500" },
    emerald: { border: "border-t-emerald-400", iconBg: "bg-emerald-50", iconText: "text-emerald-500" },
    blue: { border: "border-t-blue-400", iconBg: "bg-blue-50", iconText: "text-blue-500" },
    teal: { border: "border-t-teal-400", iconBg: "bg-teal-50", iconText: "text-teal-500" },
    red: { border: "border-t-red-400", iconBg: "bg-red-50", iconText: "text-red-500" },
};

function StatsCard({ title, value, subtitle, icon: Icon, accent = "blue", highlight = false }) {
    const a = ACCENT[accent] || ACCENT.blue;
    return (
        <div className={`bg-white rounded-xl border border-slate-200 ${a.border} border-t-4 p-4 shadow-sm flex flex-col justify-between min-h-[120px] transition-shadow hover:shadow ${highlight ? "ring-1 ring-red-200" : ""}`}>
            <div className="flex items-start justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">{title}</span>
                <div className={`h-8 w-8 rounded-full ${a.iconBg} flex items-center justify-center shrink-0`}>
                    <Icon className={`h-4 w-4 ${a.iconText}`} />
                </div>
            </div>
            <div>
                <p className={`text-3xl font-bold leading-none ${highlight && value > 0 ? "text-red-600" : "text-slate-800"}`}>{value}</p>
                <p className="text-[11px] text-slate-400 mt-1">{subtitle}</p>
            </div>
        </div>
    );
}

/* ─── MiniStat ─── */
const MINI_A = { indigo: "border-t-indigo-400", emerald: "border-t-emerald-400", blue: "border-t-blue-400", amber: "border-t-amber-400" };
function MiniStat({ value, label, accent = "indigo" }) {
    return (
        <div className={`rounded-xl border border-slate-200 bg-white p-4 border-t-4 ${MINI_A[accent] || MINI_A.indigo} shadow-sm`}>
            <p className="text-2xl font-bold text-slate-800">{value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{label}</p>
        </div>
    );
}

/* ─── ShortcutCard ─── */
function ShortcutCard({ icon: Icon, iconBg, iconColor, title, subtitle, onClick }) {
    return (
        <button
            type="button" onClick={onClick}
            className="bg-white hover:bg-slate-50 rounded-xl p-5 text-center transition-all group cursor-pointer border border-slate-200 hover:border-slate-300 hover:shadow-sm active:scale-[0.98]"
        >
            <div className={`h-10 w-10 rounded-full ${iconBg} flex items-center justify-center mx-auto mb-2.5 transition-transform group-hover:scale-110`}>
                <Icon className={`h-5 w-5 ${iconColor}`} />
            </div>
            <p className="font-semibold text-sm text-slate-800">{title}</p>
            <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
            <ArrowRight className="h-3.5 w-3.5 text-slate-300 mx-auto mt-2 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
        </button>
    );
}

/* ─── EmptyMini ─── */
function EmptyMini({ icon: Icon, text }) {
    return (
        <div className="text-center py-8">
            <Icon className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">{text}</p>
        </div>
    );
}

/* ─── ProjectInfoCard ─── */
function ProjectInfoCard({ project }) {
    const fields = [
        { label: "Código", value: project.code || project.meta?.code || "Sin código", icon: Hash },
        { label: "Línea", value: project.line_name || "Sin asignar", icon: GitBranch },
        { label: "Asesor", value: project.advisor_name || "Sin asignar", icon: UserCircle2 },
        { label: "Presupuesto", value: `S/ ${Number(project.budget || project.meta?.budget || 0).toLocaleString()}`, icon: Wallet },
        { label: "Fecha inicio", value: project.start_date || "—", icon: Calendar },
        { label: "Fecha fin", value: project.end_date || "—", icon: Clock },
    ];
    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {fields.map(f => (
                    <div key={f.label} className="space-y-1">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            <f.icon className="h-3 w-3" /> {f.label}
                        </p>
                        <p className="text-sm font-medium text-slate-700">{f.value}</p>
                    </div>
                ))}
            </div>
            <div className="space-y-1">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Palabras clave</p>
                <div className="flex flex-wrap gap-1.5">
                    {(project.keywords || project.meta?.keywords || "").split(",").filter(Boolean).map((k, i) => (
                        <span key={i} className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                            {k.trim()}
                        </span>
                    ))}
                    {!(project.keywords || project.meta?.keywords) && (
                        <span className="text-sm text-slate-400">—</span>
                    )}
                </div>
            </div>
            <div className="space-y-1">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Resumen</p>
                <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{project.summary || "Sin resumen"}</p>
            </div>
        </div>
    );
}

/* ═════════════════════════════════════════
   CatalogManager – Mejorado
   ═════════════════════════════════════════ */
function CatalogManager({ lines, advisors, onRefresh }) {
    const [tab, setTab] = useState("lines");
    const [dialog, setDialog] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({});
    const [saving, setSaving] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState({ open: false, type: "", id: null, name: "" });
    const [searchCat, setSearchCat] = useState("");
    const debouncedCatSearch = useDebounce(searchCat, 200);

    const openNew = (type) => {
        setEditing(null);
        setForm(type === "lines" ? { name: "" } : { full_name: "", email: "", specialty: "" });
        setDialog(true);
    };
    const openEdit = (type, item) => {
        setEditing({ type, ...item });
        setForm(type === "lines" ? { name: item.name } : { full_name: item.full_name, email: item.email || "", specialty: item.specialty || "" });
        setDialog(true);
    };

    const save = async () => {
        setSaving(true);
        try {
            const type = editing?.type || tab;
            if (editing) {
                if (type === "lines") await Catalog.updateLine(editing.id, form);
                else await Catalog.updateAdvisor(editing.id, form);
            } else {
                if (tab === "lines") await Catalog.createLine(form);
                else await Catalog.createAdvisor(form);
            }
            toast.success("Guardado"); setDialog(false); onRefresh();
        } catch { toast.error("Error al guardar"); }
        finally { setSaving(false); }
    };

    const handleDelete = async () => {
        try {
            if (deleteConfirm.type === "lines") await Catalog.removeLine(deleteConfirm.id);
            else await Catalog.removeAdvisor(deleteConfirm.id);
            toast.success("Eliminado");
            setDeleteConfirm({ open: false, type: "", id: null, name: "" });
            onRefresh();
        } catch { toast.error("Error al eliminar"); }
    };

    const filteredLines = useMemo(() => {
        if (!debouncedCatSearch) return lines;
        return lines.filter(l => (l.name || "").toLowerCase().includes(debouncedCatSearch.toLowerCase()));
    }, [lines, debouncedCatSearch]);

    const filteredAdvisors = useMemo(() => {
        if (!debouncedCatSearch) return advisors;
        const q = debouncedCatSearch.toLowerCase();
        return advisors.filter(a => (a.full_name || "").toLowerCase().includes(q) || (a.email || "").toLowerCase().includes(q) || (a.specialty || "").toLowerCase().includes(q));
    }, [advisors, debouncedCatSearch]);

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center">
                        <Settings className="h-5 w-5 text-slate-600" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-slate-800">Gestión de Catálogos</h3>
                        <p className="text-xs text-slate-400">Administra líneas de investigación y asesores</p>
                    </div>
                </div>
            </div>

            <div className="p-6">
                <Tabs value={tab} onValueChange={(v) => { setTab(v); setSearchCat(""); }}>
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                        <TabsList className="bg-slate-50 border border-slate-200 p-1 rounded-lg h-auto">
                            <TabsTrigger value="lines" className="gap-1.5 text-xs px-3 data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:shadow-sm">
                                <ListTree className="h-3.5 w-3.5" /> Líneas
                                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] font-mono bg-slate-200/70 text-slate-600">{lines.length}</Badge>
                            </TabsTrigger>
                            <TabsTrigger value="advisors" className="gap-1.5 text-xs px-3 data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:shadow-sm">
                                <Users className="h-3.5 w-3.5" /> Asesores
                                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] font-mono bg-slate-200/70 text-slate-600">{advisors.length}</Badge>
                            </TabsTrigger>
                        </TabsList>

                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                <Input
                                    placeholder={tab === "lines" ? "Buscar línea..." : "Buscar asesor..."}
                                    className="pl-8 h-9 w-[200px] bg-white border-slate-200 text-xs"
                                    value={searchCat}
                                    onChange={(e) => setSearchCat(e.target.value)}
                                />
                                {searchCat && (
                                    <button onClick={() => setSearchCat("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                        <X className="h-3 w-3" />
                                    </button>
                                )}
                            </div>
                            <Button size="sm" className="bg-slate-800 hover:bg-slate-700 shadow-sm h-9" onClick={() => openNew(tab)}>
                                <Plus className="h-3.5 w-3.5 mr-1" /> {tab === "lines" ? "Nueva Línea" : "Nuevo Asesor"}
                            </Button>
                        </div>
                    </div>

                    {/* Líneas */}
                    <TabsContent value="lines" className="mt-0">
                        {filteredLines.length === 0 ? (
                            <div className="text-center py-14 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                                <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                                    <GitBranch className="h-5 w-5 text-slate-400" />
                                </div>
                                <p className="text-slate-600 font-semibold">{searchCat ? "No se encontraron líneas" : "Sin líneas de investigación"}</p>
                                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">{searchCat ? "Intenta con otros términos" : "Las líneas organizan tus proyectos por área temática"}</p>
                                {!searchCat && (
                                    <Button size="sm" className="mt-4 bg-slate-800 hover:bg-slate-700" onClick={() => openNew("lines")}>
                                        <Plus className="h-3.5 w-3.5 mr-1" /> Crear línea
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <div className="border border-slate-200 rounded-xl overflow-hidden">
                                {filteredLines.map((l, idx) => (
                                    <div key={l.id} className={`flex items-center justify-between px-4 py-3.5 hover:bg-slate-50 transition-colors group ${idx < filteredLines.length - 1 ? "border-b border-slate-100" : ""}`}>
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                                                <GitBranch className="h-4 w-4 text-indigo-500" />
                                            </div>
                                            <span className="text-sm font-medium text-slate-700">{l.name}</span>
                                        </div>
                                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <ActionBtn icon={Edit} label="Editar" iconClass="text-slate-400" onClick={() => openEdit("lines", l)} />
                                            <ActionBtn icon={Trash2} label="Eliminar" iconClass="text-red-400" onClick={() => setDeleteConfirm({ open: true, type: "lines", id: l.id, name: l.name })} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    {/* Asesores */}
                    <TabsContent value="advisors" className="mt-0">
                        {filteredAdvisors.length === 0 ? (
                            <div className="text-center py-14 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                                <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                                    <Users className="h-5 w-5 text-slate-400" />
                                </div>
                                <p className="text-slate-600 font-semibold">{searchCat ? "No se encontraron asesores" : "Sin asesores registrados"}</p>
                                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">{searchCat ? "Intenta con otros términos" : "Los asesores guían los proyectos de investigación"}</p>
                                {!searchCat && (
                                    <Button size="sm" className="mt-4 bg-slate-800 hover:bg-slate-700" onClick={() => openNew("advisors")}>
                                        <Plus className="h-3.5 w-3.5 mr-1" /> Registrar asesor
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <div className="border border-slate-200 rounded-xl overflow-hidden">
                                {filteredAdvisors.map((a, idx) => (
                                    <div key={a.id} className={`flex items-center justify-between px-4 py-3.5 hover:bg-slate-50 transition-colors group ${idx < filteredAdvisors.length - 1 ? "border-b border-slate-100" : ""}`}>
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-teal-50 flex items-center justify-center shrink-0">
                                                <UserCircle2 className="h-5 w-5 text-teal-600" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-slate-700">{a.full_name}</p>
                                                <div className="flex items-center gap-3 mt-0.5">
                                                    {a.email && <span className="text-[11px] text-slate-400 flex items-center gap-1"><Mail className="h-3 w-3" />{a.email}</span>}
                                                    {a.specialty && <span className="text-[11px] text-slate-400 flex items-center gap-1"><Sparkles className="h-3 w-3" />{a.specialty}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <ActionBtn icon={Edit} label="Editar" iconClass="text-slate-400" onClick={() => openEdit("advisors", a)} />
                                            <ActionBtn icon={Trash2} label="Eliminar" iconClass="text-red-400" onClick={() => setDeleteConfirm({ open: true, type: "advisors", id: a.id, name: a.full_name })} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </div>

            {/* Catalog Dialogs */}
            <Dialog open={dialog} onOpenChange={setDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-slate-800">{editing ? "Editar" : "Nuevo"} {tab === "lines" ? "Línea de Investigación" : "Asesor"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        {tab === "lines" ? (
                            <div>
                                <label className="text-sm font-medium text-slate-700">Nombre de la línea</label>
                                <Input className="mt-1 border-slate-200" placeholder="Ej: Educación Intercultural" value={form.name || ""} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} />
                            </div>
                        ) : (<>
                            <div>
                                <label className="text-sm font-medium text-slate-700">Nombre completo</label>
                                <Input className="mt-1 border-slate-200" placeholder="Ej: Dr. Juan Pérez García" value={form.full_name || ""} onChange={(e) => setForm(p => ({ ...p, full_name: e.target.value }))} />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700">Correo electrónico</label>
                                <Input className="mt-1 border-slate-200" type="email" placeholder="correo@ejemplo.com" value={form.email || ""} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700">Especialidad</label>
                                <Input className="mt-1 border-slate-200" placeholder="Ej: Pedagogía, Matemática Aplicada" value={form.specialty || ""} onChange={(e) => setForm(p => ({ ...p, specialty: e.target.value }))} />
                            </div>
                        </>)}
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline" className="border-slate-200">Cancelar</Button></DialogClose>
                        <Button onClick={save} disabled={saving} className="bg-slate-800 hover:bg-slate-700">
                            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Guardar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={deleteConfirm.open} onOpenChange={(v) => setDeleteConfirm(p => ({ ...p, open: v }))}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar "{deleteConfirm.name}"?</AlertDialogTitle>
                        <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDelete}>Eliminar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}