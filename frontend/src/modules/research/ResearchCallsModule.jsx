/**
 * ResearchCallsModule.jsx
 * Módulo de Convocatorias de Investigación – IESPP Gustavo Allende Llavería
 *
 * Estilo Mesa de Partes Digital (v2 – UX mejorado):
 * - Skeleton loaders en vez de spinners genéricos
 * - Búsqueda con debounce
 * - Rubric editor con barra visual de peso
 * - Ranking con barras de puntaje
 * - Animaciones sutiles en cards y transiciones
 * - Tooltips en botones de acción
 * - Mejor responsive / mobile
 * - Quick-filters por estado de convocatoria
 * - Proposal cards con timeline de estados
 */
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Calls, Proposals, Reviews, Catalog } from "../../services/research.service";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import {
    Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

import {
    Plus, Edit, Trash2, Eye, Search, Send,
    ClipboardCheck, Trophy, ChevronLeft,
    Download, X, Megaphone, CalendarDays, Users2,
    FileText, ArrowRight, CheckCircle2, Clock,
    AlertTriangle, ChevronRight, Filter,
    GripVertical, BarChart3, MessageSquare,
    Info, Sparkles, ArrowUpDown, Hash,
} from "lucide-react";
import { toast } from "sonner";

// ─────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────
const DEFAULT_RUBRIC = [
    { code: "originality", label: "Originalidad", weight: 0.2 },
    { code: "methodology", label: "Metodología", weight: 0.25 },
    { code: "feasibility", label: "Viabilidad", weight: 0.25 },
    { code: "impact", label: "Impacto", weight: 0.2 },
    { code: "budget_coherence", label: "Coherencia presupuestal", weight: 0.1 },
];

const PROPOSAL_STATUS = {
    DRAFT: { label: "Borrador", color: "bg-slate-100 text-slate-700", dotColor: "bg-slate-400", icon: FileText, order: 0 },
    SUBMITTED: { label: "Enviada", color: "bg-blue-50 text-blue-700", dotColor: "bg-blue-500", icon: Send, order: 1 },
    REVIEWED: { label: "Revisada", color: "bg-amber-50 text-amber-700", dotColor: "bg-amber-500", icon: ClipboardCheck, order: 2 },
    ACCEPTED: { label: "Aceptada", color: "bg-emerald-50 text-emerald-700", dotColor: "bg-emerald-500", icon: CheckCircle2, order: 3 },
    REJECTED: { label: "Rechazada", color: "bg-red-50 text-red-700", dotColor: "bg-red-500", icon: AlertTriangle, order: 3 },
};

const STATUS_FLOW = ["DRAFT", "SUBMITTED", "REVIEWED", "ACCEPTED"];

const QUICK_FILTERS = [
    { key: "all", label: "Todas" },
    { key: "open", label: "Abiertas" },
    { key: "closed", label: "Cerradas" },
];

// ─────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────
function useDebounce(value, delay = 300) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
}

// ─────────────────────────────────────────
// Skeleton components
// ─────────────────────────────────────────
function TableSkeleton({ rows = 4 }) {
    return (
        <div className="space-y-0 divide-y divide-slate-100">
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3.5 animate-pulse">
                    <div className="h-4 w-20 bg-slate-200 rounded" />
                    <div className="h-4 flex-1 bg-slate-100 rounded max-w-[240px]" />
                    <div className="h-4 w-28 bg-slate-100 rounded hidden md:block" />
                    <div className="h-5 w-16 bg-slate-100 rounded-md hidden md:block" />
                    <div className="h-4 w-20 bg-slate-100 rounded hidden lg:block ml-auto" />
                    <div className="flex gap-1 ml-auto">
                        <div className="h-8 w-8 bg-slate-100 rounded" />
                        <div className="h-8 w-8 bg-slate-100 rounded" />
                    </div>
                </div>
            ))}
        </div>
    );
}

function ProposalSkeleton({ count = 3 }) {
    return (
        <div className="space-y-2">
            {Array.from({ length: count }).map((_, i) => (
                <Card key={i} className="shadow-sm animate-pulse">
                    <CardContent className="pt-4 pb-3">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 bg-slate-100 rounded-lg shrink-0" />
                            <div className="flex-1 space-y-2">
                                <div className="h-4 w-48 bg-slate-200 rounded" />
                                <div className="h-3 w-24 bg-slate-100 rounded" />
                            </div>
                            <div className="h-8 w-20 bg-slate-100 rounded" />
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

// ─────────────────────────────────────────
// StatusTimeline – mini indicador visual del progreso de una propuesta
// ─────────────────────────────────────────
function StatusTimeline({ current }) {
    const currentOrder = PROPOSAL_STATUS[current]?.order ?? 0;
    const isRejected = current === "REJECTED";

    return (
        <div className="flex items-center gap-0.5">
            {STATUS_FLOW.map((s, i) => {
                const reached = !isRejected && currentOrder >= i;
                return (
                    <div key={s} className="flex items-center gap-0.5">
                        <div
                            className={`h-1.5 w-1.5 rounded-full transition-colors ${reached ? PROPOSAL_STATUS[s].dotColor : "bg-slate-200"}`}
                            title={PROPOSAL_STATUS[s].label}
                        />
                        {i < STATUS_FLOW.length - 1 && (
                            <div className={`h-px w-3 transition-colors ${reached && currentOrder > i ? "bg-slate-400" : "bg-slate-200"}`} />
                        )}
                    </div>
                );
            })}
            {isRejected && (
                <div className="h-1.5 w-1.5 rounded-full bg-red-500 ml-0.5" title="Rechazada" />
            )}
        </div>
    );
}

// ─────────────────────────────────────────
// RubricWeightBar – barra visual del peso en la rúbrica
// ─────────────────────────────────────────
function RubricWeightBar({ weight, total }) {
    const pct = total > 0 ? (weight / total) * 100 : 0;
    const isOver = total > 1.01;
    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-300 ${isOver ? "bg-red-400" : "bg-indigo-400"}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                />
            </div>
            <span className={`text-[10px] font-mono w-8 text-right ${isOver ? "text-red-500" : "text-slate-400"}`}>
                {(weight * 100).toFixed(0)}%
            </span>
        </div>
    );
}

// ─────────────────────────────────────────
// ScoreBar – barra visual de puntaje en ranking
// ─────────────────────────────────────────
function ScoreBar({ score, max = 20 }) {
    const pct = max > 0 ? (score / max) * 100 : 0;
    const color = pct > 70 ? "bg-emerald-500" : pct > 40 ? "bg-amber-500" : "bg-red-400";
    return (
        <div className="flex items-center gap-2 min-w-[120px]">
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="font-mono font-bold text-sm text-slate-800 w-12 text-right">
                {score?.toFixed(2) || "0.00"}
            </span>
        </div>
    );
}

// ─────────────────────────────────────────
// ActionButton con tooltip
// ─────────────────────────────────────────
function ActionBtn({ icon: Icon, label, onClick, variant = "ghost", className = "", iconClass = "text-slate-500" }) {
    return (
        <TooltipProvider delayDuration={200}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant={variant} size="icon" className={`h-8 w-8 ${className}`} onClick={onClick}>
                        <Icon className={`h-4 w-4 ${iconClass}`} />
                    </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">{label}</TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

// ═══════════════════════════════════════
// Componente principal
// ═══════════════════════════════════════
export default function ResearchCallsModule() {
    const [view, setView] = useState("list"); // list | proposals | ranking
    const [calls, setCalls] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQ, setSearchQ] = useState("");
    const debouncedSearch = useDebounce(searchQ, 250);
    const [quickFilter, setQuickFilter] = useState("all");
    const [selectedCall, setSelectedCall] = useState(null);

    // Call dialog
    const [callDialog, setCallDialog] = useState(false);
    const [editingCall, setEditingCall] = useState(null);
    const [callForm, setCallForm] = useState({});
    const [formRubric, setFormRubric] = useState([...DEFAULT_RUBRIC]);
    const [saving, setSaving] = useState(false);
    const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null, title: "" });

    // Proposals
    const [proposals, setProposals] = useState([]);
    const [proposalsLoading, setProposalsLoading] = useState(false);
    const [proposalDialog, setProposalDialog] = useState(false);
    const [proposalForm, setProposalForm] = useState({ title: "", summary: "", team: [], budget: {} });
    const [lines, setLines] = useState([]);

    // Review
    const [reviewDialog, setReviewDialog] = useState(false);
    const [reviewingProposal, setReviewingProposal] = useState(null);
    const [reviewRubric, setReviewRubric] = useState([]);
    const [reviewScores, setReviewScores] = useState({});
    const [reviewComment, setReviewComment] = useState("");
    const [savingReview, setSavingReview] = useState(false);

    // Ranking
    const [ranking, setRanking] = useState([]);
    const [rankingLoading, setRankingLoading] = useState(false);

    // ── Load ──
    const loadCalls = useCallback(async () => {
        setLoading(true);
        try { const data = await Calls.list(); setCalls(Array.isArray(data) ? data : []); }
        catch { toast.error("Error al cargar convocatorias"); }
        finally { setLoading(false); }
    }, []);

    const loadLines = useCallback(async () => {
        try { const data = await Catalog.lines(); setLines(Array.isArray(data) ? data : []); }
        catch { /* silent */ }
    }, []);

    useEffect(() => { loadCalls(); loadLines(); }, [loadCalls, loadLines]);

    // ── Calls CRUD ──
    const openNewCall = () => {
        setEditingCall(null);
        setCallForm({ code: "", title: "", description: "", start_date: "", end_date: "", budget_cap: 0 });
        setFormRubric([...DEFAULT_RUBRIC]);
        setCallDialog(true);
    };

    const openEditCall = (c) => {
        setEditingCall(c);
        setCallForm({
            code: c.code || "", title: c.title || "", description: c.description || "",
            start_date: c.start_date || "", end_date: c.end_date || "", budget_cap: c.budget_cap || 0,
        });
        setFormRubric(
            Array.isArray(c.rubric_template) && c.rubric_template.length > 0
                ? c.rubric_template : [...DEFAULT_RUBRIC]
        );
        setCallDialog(true);
    };

    const saveCall = async () => {
        if (!callForm.code?.trim() || !callForm.title?.trim()) {
            toast.error("Código y título son obligatorios");
            return;
        }
        if (Math.abs(rubricWeightTotal - 1) > 0.02) {
            toast.error("El peso total de la rúbrica debe ser 100%");
            return;
        }
        setSaving(true);
        try {
            const payload = { ...callForm, rubric_template: formRubric };
            if (editingCall) {
                await Calls.update(editingCall.id, payload);
                toast.success("Convocatoria actualizada");
            } else {
                await Calls.create(payload);
                toast.success("Convocatoria creada");
            }
            setCallDialog(false);
            loadCalls();
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Error al guardar");
        } finally {
            setSaving(false);
        }
    };

    const confirmDeleteCall = async () => {
        try {
            await Calls.remove(deleteDialog.id);
            toast.success("Convocatoria eliminada");
            setDeleteDialog({ open: false, id: null, title: "" });
            loadCalls();
        } catch {
            toast.error("Error al eliminar");
        }
    };

    // ── Rubric helpers ──
    const addRubricCriteria = () =>
        setFormRubric(prev => [...prev, { code: `c_${Date.now()}`, label: "", weight: 0.1 }]);
    const updateFormRubricItem = (idx, field, value) =>
        setFormRubric(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
    const removeFormRubricItem = (idx) =>
        setFormRubric(prev => prev.filter((_, i) => i !== idx));
    const rubricWeightTotal = useMemo(
        () => formRubric.reduce((sum, c) => sum + (Number(c.weight) || 0), 0),
        [formRubric]
    );

    // ── Proposals ──
    const loadProposals = async (callId) => {
        setProposalsLoading(true);
        try {
            const data = await Proposals.list(callId);
            setProposals(Array.isArray(data) ? data : []);
        } catch {
            setProposals([]);
        } finally {
            setProposalsLoading(false);
        }
    };

    const openCallDetail = (c) => {
        setSelectedCall(c);
        setView("proposals");
        loadProposals(c.id);
    };

    const saveProposal = async () => {
        if (!proposalForm.title?.trim()) { toast.error("El título es obligatorio"); return; }
        setSaving(true);
        try {
            await Proposals.create(selectedCall.id, proposalForm);
            toast.success("Propuesta registrada");
            setProposalDialog(false);
            loadProposals(selectedCall.id);
        } catch {
            toast.error("Error al guardar propuesta");
        } finally {
            setSaving(false);
        }
    };

    const submitProposal = async (propId) => {
        try {
            await Proposals.submit(selectedCall.id, propId);
            toast.success("Propuesta enviada correctamente");
            loadProposals(selectedCall.id);
        } catch {
            toast.error("Error al enviar");
        }
    };

    // ── Review ──
    const openReview = async (proposal) => {
        setReviewingProposal(proposal);
        setReviewScores({});
        setReviewComment("");
        try {
            const data = await Reviews.rubric(selectedCall.id, proposal.id);
            const template = Array.isArray(data.rubric_template) && data.rubric_template.length > 0
                ? data.rubric_template
                : (Array.isArray(selectedCall.rubric_template) && selectedCall.rubric_template.length > 0
                    ? selectedCall.rubric_template : DEFAULT_RUBRIC);
            setReviewRubric(template);
            if (data.review?.rubric?.scores) setReviewScores(data.review.rubric.scores);
            if (data.review?.rubric?.comment) setReviewComment(data.review.rubric.comment);
        } catch {
            setReviewRubric(
                Array.isArray(selectedCall?.rubric_template) && selectedCall.rubric_template.length > 0
                    ? selectedCall.rubric_template : DEFAULT_RUBRIC
            );
        }
        setReviewDialog(true);
    };

    const reviewTotal = useMemo(
        () => reviewRubric.reduce((acc, cr) => acc + Number(reviewScores[cr.code] || 0) * (Number(cr.weight) || 0), 0),
        [reviewRubric, reviewScores]
    );

    const saveReview = async () => {
        setSavingReview(true);
        try {
            await Reviews.save(selectedCall.id, reviewingProposal.id, {
                scores: reviewScores, comment: reviewComment, total: reviewTotal.toFixed(2),
            });
            toast.success("Revisión guardada");
            setReviewDialog(false);
            loadProposals(selectedCall.id);
        } catch {
            toast.error("Error al guardar revisión");
        } finally {
            setSavingReview(false);
        }
    };

    // ── Ranking ──
    const loadRanking = async () => {
        setRankingLoading(true);
        try {
            const data = await Reviews.ranking(selectedCall.id);
            setRanking(Array.isArray(data) ? data : []);
            setView("ranking");
        } catch {
            toast.error("Error al cargar ranking");
        } finally {
            setRankingLoading(false);
        }
    };

    const exportRanking = async () => {
        try {
            const res = await Reviews.exportResults(selectedCall.id);
            if (res?.downloadUrl) window.open(res.downloadUrl, "_blank");
            else toast.error("No se generó el enlace de descarga");
        } catch {
            toast.error("Error al exportar");
        }
    };

    // ── Filter ──
    const isCallOpen = (c) => c.end_date && new Date(c.end_date) >= new Date();

    const filtered = useMemo(() => {
        let result = calls;
        // Quick filter
        if (quickFilter === "open") result = result.filter(isCallOpen);
        if (quickFilter === "closed") result = result.filter(c => !isCallOpen(c));
        // Search
        if (debouncedSearch) {
            const q = debouncedSearch.toLowerCase();
            result = result.filter(c =>
                (c.code || "").toLowerCase().includes(q) ||
                (c.title || "").toLowerCase().includes(q) ||
                (c.description || "").toLowerCase().includes(q)
            );
        }
        return result;
    }, [calls, debouncedSearch, quickFilter]);

    const callStats = useMemo(() => ({
        total: calls.length,
        open: calls.filter(isCallOpen).length,
        closed: calls.filter(c => !isCallOpen(c)).length,
    }), [calls]);

    // Proposal stats
    const proposalStats = useMemo(() => {
        if (!proposals.length) return null;
        const byStatus = {};
        proposals.forEach(p => { byStatus[p.status] = (byStatus[p.status] || 0) + 1; });
        return { total: proposals.length, byStatus };
    }, [proposals]);

    // ═══════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════
    return (
        <div className="space-y-5">
            {/* ══ HEADER ══ */}
            <div className="bg-slate-800 rounded-xl px-6 py-4 flex items-center justify-between shadow-md">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-slate-700 flex items-center justify-center">
                        <Megaphone className="h-5 w-5 text-emerald-300" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-white">Convocatorias</h1>
                        <p className="text-xs text-slate-400">Gestión de convocatorias y evaluación de propuestas</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {callStats.open > 0 && (
                        <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 text-xs px-2.5 py-0.5">
                            {callStats.open} abiertas
                        </Badge>
                    )}
                    <Badge className="bg-white/10 text-white border-white/20 text-sm px-3 py-1">
                        {callStats.total} total
                    </Badge>
                </div>
            </div>

            {/* ══ BREADCRUMB ══ */}
            {view !== "list" && selectedCall && (
                <nav className="flex items-center gap-1.5 text-sm text-slate-500">
                    <button
                        onClick={() => setView("list")}
                        className="hover:text-slate-800 transition-colors font-medium flex items-center gap-1"
                    >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        Convocatorias
                    </button>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
                    <button
                        onClick={() => { setView("proposals"); loadProposals(selectedCall.id); }}
                        className={`hover:text-slate-800 transition-colors ${view === "proposals" ? "text-slate-800 font-semibold" : "font-medium"}`}
                    >
                        {selectedCall.code} – {selectedCall.title}
                    </button>
                    {view === "ranking" && (
                        <>
                            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
                            <span className="text-slate-800 font-semibold flex items-center gap-1">
                                <Trophy className="h-3.5 w-3.5" /> Ranking
                            </span>
                        </>
                    )}
                </nav>
            )}

            {/* ═══ LISTA ═══ */}
            {view === "list" && (
                <div className="space-y-4">
                    {/* Toolbar */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Buscar por código, título o descripción..."
                                className="pl-9 bg-white"
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

                        {/* Quick filters */}
                        <div className="flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5">
                            {QUICK_FILTERS.map(f => (
                                <button
                                    key={f.key}
                                    onClick={() => setQuickFilter(f.key)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${quickFilter === f.key
                                            ? "bg-white text-slate-800 shadow-sm"
                                            : "text-slate-500 hover:text-slate-700"
                                        }`}
                                >
                                    {f.label}
                                    {f.key === "open" && callStats.open > 0 && (
                                        <span className="ml-1 text-[10px] font-mono">{callStats.open}</span>
                                    )}
                                </button>
                            ))}
                        </div>

                        <Button onClick={openNewCall} className="bg-slate-800 hover:bg-slate-700">
                            <Plus className="h-4 w-4 mr-1.5" /> Nueva Convocatoria
                        </Button>
                    </div>

                    {/* Table */}
                    {loading ? (
                        <Card className="shadow-sm overflow-hidden">
                            <div className="bg-slate-50 border-b border-slate-200 px-4 py-3">
                                <div className="h-3 w-48 bg-slate-200 rounded animate-pulse" />
                            </div>
                            <TableSkeleton rows={5} />
                        </Card>
                    ) : filtered.length === 0 ? (
                        <Card className="shadow-sm">
                            <CardContent className="py-16 text-center">
                                <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                                    {searchQ || quickFilter !== "all"
                                        ? <Search className="h-6 w-6 text-slate-400" />
                                        : <Megaphone className="h-6 w-6 text-slate-400" />}
                                </div>
                                <p className="text-slate-600 font-semibold">
                                    {searchQ || quickFilter !== "all"
                                        ? "No se encontraron convocatorias"
                                        : "No hay convocatorias registradas"}
                                </p>
                                <p className="text-sm text-slate-400 mt-1 max-w-xs mx-auto">
                                    {searchQ ? "Intenta con otros términos de búsqueda"
                                        : quickFilter !== "all" ? "No hay convocatorias con este filtro"
                                            : "Crea la primera convocatoria para empezar"}
                                </p>
                                {!searchQ && quickFilter === "all" && (
                                    <Button size="sm" className="mt-4 bg-slate-800 hover:bg-slate-700" onClick={openNewCall}>
                                        <Plus className="h-3.5 w-3.5 mr-1" /> Crear convocatoria
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="shadow-sm overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="text-left px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Código</th>
                                        <th className="text-left px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Título</th>
                                        <th className="text-left px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider hidden md:table-cell">Período</th>
                                        <th className="text-left px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider hidden md:table-cell">Estado</th>
                                        <th className="text-right px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider hidden lg:table-cell">Tope (S/)</th>
                                        <th className="text-right px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filtered.map(c => {
                                        const open = isCallOpen(c);
                                        return (
                                            <tr key={c.id} className="hover:bg-slate-50/60 transition-colors group">
                                                <td className="px-4 py-3 font-mono text-xs text-slate-600 font-medium">{c.code}</td>
                                                <td className="px-4 py-3">
                                                    <button
                                                        onClick={() => openCallDetail(c)}
                                                        className="font-medium text-slate-800 hover:text-indigo-600 transition-colors text-left group-hover:text-indigo-600"
                                                    >
                                                        {c.title}
                                                    </button>
                                                    {c.description && (
                                                        <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1 max-w-[300px]">
                                                            {c.description}
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell">
                                                    <div className="flex items-center gap-1.5">
                                                        <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                                                        <span>{c.start_date}</span>
                                                        <ArrowRight className="h-3 w-3 text-slate-300" />
                                                        <span>{c.end_date}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 hidden md:table-cell">
                                                    {open ? (
                                                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[11px] font-medium">
                                                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Abierta
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center rounded-md bg-slate-100 text-slate-500 px-2 py-0.5 text-[11px] font-medium">
                                                            Cerrada
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-xs text-slate-600 hidden lg:table-cell">
                                                    S/ {Number(c.budget_cap || 0).toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex justify-end gap-0.5 opacity-70 group-hover:opacity-100 transition-opacity">
                                                        <ActionBtn icon={Eye} label="Ver propuestas" onClick={() => openCallDetail(c)} />
                                                        <ActionBtn icon={Edit} label="Editar" onClick={() => openEditCall(c)} />
                                                        <ActionBtn icon={Trash2} label="Eliminar" iconClass="text-red-400" onClick={() => setDeleteDialog({ open: true, id: c.id, title: c.title })} />
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {/* Footer con conteo */}
                            <div className="px-4 py-2.5 bg-slate-50/50 border-t border-slate-100 text-xs text-slate-400">
                                Mostrando {filtered.length} de {calls.length} convocatorias
                            </div>
                        </Card>
                    )}
                </div>
            )}

            {/* ═══ PROPUESTAS ═══ */}
            {view === "proposals" && selectedCall && (
                <div className="space-y-4">
                    {/* Call info card */}
                    <Card className="shadow-sm border-l-4 border-l-indigo-400">
                        <CardContent className="pt-4 pb-3">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <h2 className="text-base font-bold text-slate-800 truncate">{selectedCall.title}</h2>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-500">
                                        <span className="flex items-center gap-1">
                                            <CalendarDays className="h-3.5 w-3.5" />
                                            {selectedCall.start_date} → {selectedCall.end_date}
                                        </span>
                                        <span className="font-mono">S/ {Number(selectedCall.budget_cap || 0).toLocaleString()}</span>
                                        {isCallOpen(selectedCall) ? (
                                            <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Abierta
                                            </span>
                                        ) : (
                                            <span className="text-slate-400 font-medium">Cerrada</span>
                                        )}
                                    </div>
                                    {selectedCall.description && (
                                        <p className="text-xs text-slate-400 mt-2 line-clamp-2">{selectedCall.description}</p>
                                    )}
                                </div>
                                <div className="flex gap-2 shrink-0">
                                    <Button size="sm" variant="outline" onClick={loadRanking}>
                                        <Trophy className="h-3.5 w-3.5 mr-1.5" /> Ranking
                                    </Button>
                                    <Button size="sm" className="bg-slate-800 hover:bg-slate-700" onClick={() => {
                                        setProposalForm({ title: "", summary: "", team: [], budget: {}, line: "" });
                                        setProposalDialog(true);
                                    }}>
                                        <Plus className="h-3.5 w-3.5 mr-1.5" /> Propuesta
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Proposal stats mini */}
                    {proposalStats && (
                        <div className="flex flex-wrap gap-2">
                            {Object.entries(proposalStats.byStatus).map(([status, count]) => {
                                const st = PROPOSAL_STATUS[status];
                                if (!st) return null;
                                return (
                                    <span key={status} className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${st.color}`}>
                                        <span className={`h-1.5 w-1.5 rounded-full ${st.dotColor}`} />
                                        {st.label}: {count}
                                    </span>
                                );
                            })}
                            <span className="text-xs text-slate-400 self-center ml-1">
                                {proposalStats.total} propuesta{proposalStats.total !== 1 ? "s" : ""} en total
                            </span>
                        </div>
                    )}

                    {/* Proposals list */}
                    {proposalsLoading ? (
                        <ProposalSkeleton count={4} />
                    ) : proposals.length === 0 ? (
                        <Card className="shadow-sm">
                            <CardContent className="py-14 text-center">
                                <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                                    <FileText className="h-6 w-6 text-slate-400" />
                                </div>
                                <p className="text-slate-600 font-semibold">No hay propuestas en esta convocatoria</p>
                                <p className="text-sm text-slate-400 mt-1">Registra la primera propuesta para empezar</p>
                                <Button size="sm" className="mt-4 bg-slate-800 hover:bg-slate-700" onClick={() => {
                                    setProposalForm({ title: "", summary: "", team: [], budget: {}, line: "" });
                                    setProposalDialog(true);
                                }}>
                                    <Plus className="h-3.5 w-3.5 mr-1" /> Nueva propuesta
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-2">
                            {proposals.map(p => {
                                const st = PROPOSAL_STATUS[p.status] || {
                                    label: p.status, color: "bg-slate-100 text-slate-600",
                                    dotColor: "bg-slate-400", icon: FileText,
                                };
                                const StIcon = st.icon;
                                return (
                                    <Card key={p.id} className="shadow-sm hover:shadow transition-shadow group">
                                        <CardContent className="pt-4 pb-3">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    <div className={`h-9 w-9 rounded-lg ${st.color} flex items-center justify-center shrink-0`}>
                                                        <StIcon className="h-4 w-4" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="font-medium text-slate-800 truncate">{p.title}</p>
                                                        <div className="flex items-center gap-3 mt-1">
                                                            <span className="text-xs text-slate-400">{p.line_name || "Sin línea"}</span>
                                                            <StatusTimeline current={p.status} />
                                                            <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ${st.color}`}>
                                                                {st.label}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    {p.status === "DRAFT" && (
                                                        <Button
                                                            size="sm" variant="outline"
                                                            onClick={() => submitProposal(p.id)}
                                                            className="text-xs h-8"
                                                        >
                                                            <Send className="h-3.5 w-3.5 mr-1" /> Enviar
                                                        </Button>
                                                    )}
                                                    {p.status === "SUBMITTED" && (
                                                        <Button
                                                            size="sm"
                                                            onClick={() => openReview(p)}
                                                            className="text-xs h-8 bg-indigo-600 hover:bg-indigo-700"
                                                        >
                                                            <ClipboardCheck className="h-3.5 w-3.5 mr-1" /> Evaluar
                                                        </Button>
                                                    )}
                                                    {(p.status === "REVIEWED" || p.status === "ACCEPTED" || p.status === "REJECTED") && (
                                                        <Button
                                                            size="sm" variant="ghost"
                                                            onClick={() => openReview(p)}
                                                            className="text-xs h-8"
                                                        >
                                                            <Eye className="h-3.5 w-3.5 mr-1" /> Ver revisión
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ═══ RANKING ═══ */}
            {view === "ranking" && selectedCall && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-base font-bold text-slate-800">
                                Ranking – {selectedCall.code}
                            </h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Resultados de evaluación ordenados por puntaje ponderado
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => { setView("proposals"); loadProposals(selectedCall.id); }}>
                                <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Propuestas
                            </Button>
                            <Button size="sm" variant="outline" onClick={exportRanking}>
                                <Download className="h-3.5 w-3.5 mr-1" /> Exportar PDF
                            </Button>
                        </div>
                    </div>

                    {rankingLoading ? (
                        <Card className="shadow-sm overflow-hidden">
                            <TableSkeleton rows={5} />
                        </Card>
                    ) : ranking.length === 0 ? (
                        <Card className="shadow-sm">
                            <CardContent className="py-14 text-center">
                                <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                                    <Trophy className="h-6 w-6 text-slate-400" />
                                </div>
                                <p className="text-slate-600 font-semibold">Sin resultados de evaluación</p>
                                <p className="text-sm text-slate-400 mt-1 max-w-xs mx-auto">
                                    Las propuestas aún no han sido revisadas. Evalúa al menos una propuesta para ver el ranking.
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="shadow-sm overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="px-4 py-3 text-left font-semibold text-slate-500 text-xs uppercase tracking-wider w-14">#</th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-500 text-xs uppercase tracking-wider">Propuesta</th>
                                        <th className="px-4 py-3 text-right font-semibold text-slate-500 text-xs uppercase tracking-wider min-w-[160px]">Puntaje</th>
                                        <th className="px-4 py-3 text-right font-semibold text-slate-500 text-xs uppercase tracking-wider hidden sm:table-cell">Revisiones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {ranking.map((r, idx) => (
                                        <tr
                                            key={r.proposal_id}
                                            className={`transition-colors ${idx === 0 ? "bg-amber-50/40" : "hover:bg-slate-50/50"}`}
                                        >
                                            <td className="px-4 py-3.5">
                                                {idx === 0 ? (
                                                    <span className="text-lg" title="Primer lugar">🥇</span>
                                                ) : idx === 1 ? (
                                                    <span className="text-lg" title="Segundo lugar">🥈</span>
                                                ) : idx === 2 ? (
                                                    <span className="text-lg" title="Tercer lugar">🥉</span>
                                                ) : (
                                                    <span className="text-sm font-bold text-slate-400 pl-1">{idx + 1}</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <p className="font-medium text-slate-800">{r.title}</p>
                                                {r.line_name && (
                                                    <p className="text-[11px] text-slate-400 mt-0.5">{r.line_name}</p>
                                                )}
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <ScoreBar score={r.avg_total} max={20} />
                                            </td>
                                            <td className="px-4 py-3.5 text-right hidden sm:table-cell">
                                                <span className="text-xs text-slate-400 flex items-center justify-end gap-1">
                                                    <MessageSquare className="h-3 w-3" />
                                                    {r.review_count || 0}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </Card>
                    )}
                </div>
            )}

            {/* ═══ DIALOGS ═══ */}

            {/* Call Dialog */}
            <Dialog open={callDialog} onOpenChange={setCallDialog}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-slate-800">
                            {editingCall ? "Editar Convocatoria" : "Nueva Convocatoria"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium text-slate-700">Código *</label>
                                <Input
                                    className="mt-1"
                                    value={callForm.code || ""}
                                    onChange={(e) => setCallForm(p => ({ ...p, code: e.target.value }))}
                                    placeholder="CONV-2026-01"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700">Tope presupuestal (S/)</label>
                                <Input
                                    type="number"
                                    className="mt-1"
                                    value={callForm.budget_cap || ""}
                                    onChange={(e) => setCallForm(p => ({ ...p, budget_cap: Number(e.target.value) }))}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700">Título *</label>
                            <Input
                                className="mt-1"
                                value={callForm.title || ""}
                                onChange={(e) => setCallForm(p => ({ ...p, title: e.target.value }))}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium text-slate-700">Fecha inicio</label>
                                <Input
                                    type="date" className="mt-1"
                                    value={callForm.start_date || ""}
                                    onChange={(e) => setCallForm(p => ({ ...p, start_date: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700">Fecha fin</label>
                                <Input
                                    type="date" className="mt-1"
                                    value={callForm.end_date || ""}
                                    onChange={(e) => setCallForm(p => ({ ...p, end_date: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700">Descripción</label>
                            <Textarea
                                className="mt-1" rows={3}
                                value={callForm.description || ""}
                                onChange={(e) => setCallForm(p => ({ ...p, description: e.target.value }))}
                            />
                        </div>

                        <Separator />

                        {/* Rúbrica mejorada */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-sm font-semibold text-slate-700">Rúbrica de evaluación</h4>
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className="flex-1 max-w-[120px] h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-300 ${Math.abs(rubricWeightTotal - 1) < 0.02
                                                        ? "bg-emerald-500"
                                                        : rubricWeightTotal > 1 ? "bg-red-500" : "bg-amber-500"
                                                    }`}
                                                style={{ width: `${Math.min(rubricWeightTotal * 100, 100)}%` }}
                                            />
                                        </div>
                                        <span className={`text-xs font-mono ${Math.abs(rubricWeightTotal - 1) < 0.02
                                                ? "text-emerald-600"
                                                : "text-red-500"
                                            }`}>
                                            {(rubricWeightTotal * 100).toFixed(0)}%
                                            {Math.abs(rubricWeightTotal - 1) < 0.02 ? " ✓" : " (debe ser 100%)"}
                                        </span>
                                    </div>
                                </div>
                                <Button size="sm" variant="outline" onClick={addRubricCriteria}>
                                    <Plus className="h-3 w-3 mr-1" /> Criterio
                                </Button>
                            </div>

                            {/* Header */}
                            <div className="grid grid-cols-[90px_1fr_70px_auto_36px] gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                                <span>Código</span>
                                <span>Etiqueta</span>
                                <span>Peso</span>
                                <span className="w-20">Visual</span>
                                <span></span>
                            </div>

                            {formRubric.map((cr, idx) => (
                                <div key={idx} className="grid grid-cols-[90px_1fr_70px_auto_36px] gap-2 items-center group">
                                    <Input
                                        className="text-xs h-9 font-mono"
                                        value={cr.code}
                                        onChange={(e) => updateFormRubricItem(idx, "code", e.target.value)}
                                    />
                                    <Input
                                        className="text-xs h-9"
                                        placeholder="Nombre del criterio"
                                        value={cr.label}
                                        onChange={(e) => updateFormRubricItem(idx, "label", e.target.value)}
                                    />
                                    <Input
                                        type="number" step="0.05" min="0" max="1"
                                        className="text-xs h-9 text-center"
                                        value={cr.weight}
                                        onChange={(e) => updateFormRubricItem(idx, "weight", Number(e.target.value))}
                                    />
                                    <div className="w-20">
                                        <RubricWeightBar weight={Number(cr.weight) || 0} total={rubricWeightTotal} />
                                    </div>
                                    <Button
                                        variant="ghost" size="icon"
                                        className="h-9 w-9 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => removeFormRubricItem(idx)}
                                    >
                                        <X className="h-3.5 w-3.5 text-red-400" />
                                    </Button>
                                </div>
                            ))}

                            {formRubric.length === 0 && (
                                <p className="text-center text-sm text-slate-400 py-4">
                                    No hay criterios definidos. Agrega al menos uno.
                                </p>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                        <Button onClick={saveCall} disabled={saving} className="bg-slate-800 hover:bg-slate-700">
                            {saving && <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />}
                            {editingCall ? "Guardar cambios" : "Crear Convocatoria"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Proposal Dialog */}
            <Dialog open={proposalDialog} onOpenChange={setProposalDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-slate-800">Nueva Propuesta</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div>
                            <label className="text-sm font-medium text-slate-700">Título *</label>
                            <Input
                                className="mt-1"
                                value={proposalForm.title}
                                onChange={(e) => setProposalForm(p => ({ ...p, title: e.target.value }))}
                                placeholder="Título de la propuesta de investigación"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700">Línea de investigación</label>
                            <Select value={String(proposalForm.line || "")} onValueChange={(v) => setProposalForm(p => ({ ...p, line: v }))}>
                                <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar línea" /></SelectTrigger>
                                <SelectContent>
                                    {lines.map(l => (
                                        <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700">Resumen</label>
                            <Textarea
                                className="mt-1" rows={4}
                                value={proposalForm.summary}
                                onChange={(e) => setProposalForm(p => ({ ...p, summary: e.target.value }))}
                                placeholder="Describe brevemente el objetivo y alcance de la propuesta..."
                            />
                            <p className="text-[11px] text-slate-400 mt-1">
                                {(proposalForm.summary || "").length}/500 caracteres
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                        <Button onClick={saveProposal} disabled={saving} className="bg-slate-800 hover:bg-slate-700">
                            {saving && <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />}
                            Registrar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Review Dialog */}
            <Dialog open={reviewDialog} onOpenChange={setReviewDialog}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="text-slate-800 flex items-center gap-2">
                            <ClipboardCheck className="h-5 w-5 text-indigo-600" />
                            Evaluar Propuesta
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                            <p className="text-sm font-medium text-slate-800">{reviewingProposal?.title}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{reviewingProposal?.line_name || "Sin línea"}</p>
                        </div>

                        <div className="space-y-4">
                            {reviewRubric.map(cr => {
                                const score = Number(reviewScores[cr.code] || 0);
                                const maxScore = 20;
                                return (
                                    <div key={cr.code} className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm text-slate-700 font-medium">
                                                {cr.label}
                                                <span className="text-[10px] text-slate-400 ml-1.5 font-normal">
                                                    ({(Number(cr.weight) * 100).toFixed(0)}%)
                                                </span>
                                            </label>
                                            <span className={`text-base font-mono font-bold min-w-[2.5rem] text-right ${score > 14 ? "text-emerald-600" : score > 8 ? "text-amber-600" : "text-red-500"
                                                }`}>
                                                {score}
                                                <span className="text-[10px] text-slate-300 font-normal">/{maxScore}</span>
                                            </span>
                                        </div>
                                        <Slider
                                            value={[score]}
                                            max={maxScore}
                                            step={1}
                                            onValueChange={([v]) => setReviewScores(prev => ({ ...prev, [cr.code]: v }))}
                                        />
                                        {/* Score labels */}
                                        <div className="flex justify-between text-[9px] text-slate-300 px-0.5">
                                            <span>0</span>
                                            <span>5</span>
                                            <span>10</span>
                                            <span>15</span>
                                            <span>20</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <Separator />

                        <div className="flex items-center justify-between bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg p-4 border border-slate-200">
                            <div>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total ponderado</span>
                                <p className="text-[10px] text-slate-400 mt-0.5">Sobre 20 puntos</p>
                            </div>
                            <div className="text-right">
                                <span className={`text-3xl font-bold ${reviewTotal > 14 ? "text-emerald-600" : reviewTotal > 8 ? "text-amber-600" : "text-red-500"
                                    }`}>
                                    {reviewTotal.toFixed(2)}
                                </span>
                                <div className="mt-1">
                                    {reviewTotal > 14 ? (
                                        <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Excelente</Badge>
                                    ) : reviewTotal > 10 ? (
                                        <Badge className="bg-amber-100 text-amber-700 text-[10px]">Aceptable</Badge>
                                    ) : reviewTotal > 0 ? (
                                        <Badge className="bg-red-100 text-red-700 text-[10px]">Insuficiente</Badge>
                                    ) : null}
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-slate-700">Comentarios</label>
                            <Textarea
                                className="mt-1" rows={3}
                                placeholder="Observaciones del revisor..."
                                value={reviewComment}
                                onChange={(e) => setReviewComment(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                        <Button onClick={saveReview} disabled={savingReview} className="bg-indigo-600 hover:bg-indigo-700">
                            {savingReview && <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />}
                            Guardar Revisión
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete */}
            <AlertDialog open={deleteDialog.open} onOpenChange={(v) => setDeleteDialog(p => ({ ...p, open: v }))}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar convocatoria?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Se eliminará <strong>"{deleteDialog.title}"</strong> y todas sus propuestas y revisiones asociadas. Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={confirmDeleteCall}>
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}