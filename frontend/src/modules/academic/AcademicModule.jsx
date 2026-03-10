// AcademicModule.jsx — UI/UX mejorado + EnrollmentWindowManager integrado
// ✅ Sin selector de período duplicado (el banner vive en LoadAndSchedules)
import React, { useEffect, useState, useCallback, useMemo } from "react";
import "./styles.css";
import { pageStyle } from "./styles";
import { useAuth } from "@/context/AuthContext";
import { PERMS } from "@/auth/permissions";
import IfPerm from "@/components/auth/IfPerm";
import LoadAndSchedules from "./LoadAndSchedules";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";

import {
    Plus, Save, Calendar, Users, Clock, FileText, CheckCircle,
    Search as SearchIcon, BookOpen, GraduationCap, BarChart3,
    Inbox, LayoutGrid, ClipboardList, LibraryBig, RotateCw,
    TrendingUp, AlertCircle, AlertTriangle, Loader2, Download,
} from "lucide-react";

import {
    DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

import {
    Careers, Plans, Sections, Kardex, Processes, AcademicReports, ProcessesInbox,
} from "@/services/academic.service";
import { Teachers as CatalogTeachers, Classrooms as CatalogClassrooms } from "@/services/catalogs.service";
import EnrollmentComponent from "./EnrollmentComponent";
import EnrollmentWindowManager from "./EnrollmentWindowManager";
import GradesAttendanceComponent from "./GradesAttendanceComponent";
import SectionSyllabusEvaluation from "./SectionSyllabusEvaluation";
import AcademicReportsPage from "./AcademicReports";
import AcademicProcesses from "./AcademicProcesses";
import StudentHistoricalGrades from "./StudentHistoricalGrades";
import TransferManagement from "./TransferManagement";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

/* ---------- Debounce ---------- */
const useDebounce = (value, delay = 350) => {
    const [v, setV] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setV(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return v;
};

/* ---------- Período ---------- */
function generatePeriodOptions() {
    const y = new Date().getFullYear();
    const opts = [];
    for (let yr = y + 1; yr >= y - 2; yr--) {
        opts.push(`${yr}-II`);
        opts.push(`${yr}-VERANO`);
        opts.push(`${yr}-I`);
    }
    return opts;
}

function guessPeriod() {
    const now = new Date();
    const y = now.getFullYear();
    return now.getMonth() < 6 ? `${y}-I` : `${y}-II`;
}

/* ─────────────────────────── ESTILOS BASE ─────────────────────────── */
const baseStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

  .acad-module * { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }

  .stat-card { position: relative; overflow: hidden; }
  .stat-card::before {
    content: '';
    position: absolute;
    top: -40px; right: -40px;
    width: 120px; height: 120px;
    border-radius: 50%;
    opacity: 0.06;
  }
  .stat-card-blue::before   { background: #1565C0; }
  .stat-card-green::before  { background: #2E7D32; }
  .stat-card-violet::before { background: #6A1B9A; }
  .stat-card-amber::before  { background: #E65100; }

  .qa-btn {
    transition: all 0.18s cubic-bezier(.4,0,.2,1);
    border: 1.5px solid #E2E8F0;
  }
  .qa-btn:hover {
    transform: translateY(-2px);
    border-color: #BBDEFB;
    box-shadow: 0 8px 24px -6px rgba(33,150,243,0.18);
    background: linear-gradient(135deg, #EFF8FF 0%, #DBEAFE 100%);
  }
  .qa-btn:hover .qa-icon { color: #1565C0; }

  .tab-pill[data-state=active] {
    background: linear-gradient(135deg, #E3F2FD, #EDE7F6);
    color: #1565C0;
    box-shadow: 0 0 0 1.5px #90CAF9;
  }

  .plan-row { transition: background 0.15s, box-shadow 0.15s; }
  .plan-row:hover { background: #F1F8FF; box-shadow: inset 3px 0 0 #2196F3; }
  .plan-row.active { background: #E3F2FD; box-shadow: inset 3px 0 0 #1565C0; }

  .course-row { transition: background 0.12s; }
  .course-row:hover td { background: #F8FAFF; }
  .course-row.editing td { background: #EFF8FF; }

  @keyframes skel-pulse { 0%,100%{opacity:.4} 50%{opacity:.9} }
  .skel { animation: skel-pulse 1.4s ease-in-out infinite; background: #E2E8F0; border-radius: 6px; }

  @keyframes fade-in { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
  .fade-in { animation: fade-in 0.28s ease both; }
`;

function InjectStyles() {
    useEffect(() => {
        const id = "acad-styles";
        if (document.getElementById(id)) return;
        const s = document.createElement("style");
        s.id = id; s.textContent = baseStyles;
        document.head.appendChild(s);
        return () => document.getElementById(id)?.remove();
    }, []);
    return null;
}

/* ─────────────────────────── UI HELPERS ─────────────────────────── */
function SectionHeader({ title, description, Icon, action }) {
    return (
        <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
                {Icon && (
                    <div className="mt-0.5 flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-xl bg-blue-50 border border-blue-100">
                        <Icon className="h-4.5 w-4.5 text-blue-700" size={18} />
                    </div>
                )}
                <div>
                    <CardTitle className="text-[15px] font-700 text-slate-800 leading-tight">{title}</CardTitle>
                    {description && (
                        <CardDescription className="mt-0.5 text-xs text-slate-500">{description}</CardDescription>
                    )}
                </div>
            </div>
            {action && <div className="flex-shrink-0">{action}</div>}
        </div>
    );
}

function Labeled({ label, value, onChange, placeholder, type = "text" }) {
    return (
        <div className="space-y-1.5">
            <Label className="text-xs font-600 text-slate-700">{label}</Label>
            <Input
                type={type} value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="h-9 text-sm rounded-lg border-slate-200 focus:border-blue-400 focus:ring-blue-100"
            />
        </div>
    );
}

function EmptyState({ icon: Icon, title, description }) {
    return (
        <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                <Icon className="h-6 w-6 text-slate-400" />
            </div>
            <div>
                <p className="text-sm font-600 text-slate-700">{title}</p>
                {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
            </div>
        </div>
    );
}

const REQS = {
    plans: [PERMS["academic.plans.view"], PERMS["academic.plans.edit"]],
    plansDelete: [PERMS["academic.plans.delete"]],
    load: [PERMS["academic.sections.view"], PERMS["academic.sections.create"], PERMS["academic.sections.conflicts"]],
    enroll: [PERMS["academic.enrollment.view"], PERMS["academic.enrollment.commit"]],
    grades: [PERMS["academic.grades.edit"], PERMS["academic.grades.submit"]],
    syllabus: [PERMS["academic.syllabus.upload"], PERMS["academic.syllabus.delete"], PERMS["academic.evaluation.config"], PERMS["academic.syllabus.view"]],
    kardex: [PERMS["academic.kardex.view"]],
    reports: [PERMS["academic.reports.view"]],
    processes: [PERMS["academic.reports.view"], PERMS["academic.enrollment.view"], PERMS["student.self.enrollment.view"]],
    transfers: [PERMS["academic.enrollment.view"], PERMS["academic.enrollment.commit"]],
};

/* ─────────────────────────── ACCIONES RÁPIDAS ─────────────────────────── */
function AcademicQuickActions({ go }) {
    const { hasAny } = useAuth();
    const [open, setOpen] = useState(false);

    const actions = [
        { key: "enroll", label: "Matrícula", Icon: GraduationCap, color: "#1565C0", bg: "#EFF8FF" },
        { key: "load", label: "Carga & Horarios", Icon: Calendar, color: "#2E7D32", bg: "#F0FDF4" },
        { key: "plans", label: "Mallas/Planes", Icon: BookOpen, color: "#6A1B9A", bg: "#FAF5FF" },
        { key: "grades", label: "Notas/Asistencia", Icon: CheckCircle, color: "#B45309", bg: "#FFFBEB" },
        { key: "syllabus", label: "Sílabos", Icon: FileText, color: "#0F766E", bg: "#F0FDFA" },
        { key: "kardex", label: "Kárdex", Icon: Users, color: "#9F1239", bg: "#FFF1F2" },
        { key: "reports", label: "Reportes", Icon: BarChart3, color: "#0369A1", bg: "#EFF8FF" },
        { key: "processes", label: "Procesos", Icon: Clock, color: "#7C3AED", bg: "#F5F3FF" },
    ].filter((a) => hasAny(REQS[a.key] || []));

    if (actions.length === 0) return null;

    const previewCount = 4;
    const hasMore = actions.length > previewCount;
    const visibleMobile = open ? actions : actions.slice(0, previewCount);

    const ActionBtn = ({ key: k, label, Icon, color, bg }) => (
        <TooltipProvider key={k} delayDuration={80}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        type="button"
                        onClick={() => go(k)}
                        className="qa-btn group flex flex-col items-center justify-center gap-2.5 min-h-[88px] p-3 rounded-2xl bg-white w-full cursor-pointer"
                    >
                        <div className="qa-icon flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200" style={{ background: bg, color }}>
                            <Icon size={17} />
                        </div>
                        <span className="text-[11px] font-600 text-slate-700 text-center leading-tight whitespace-normal">{label}</span>
                    </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Ir a {label}</TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );

    return (
        <Card className="border-0 shadow-none bg-transparent">
            <CardHeader className="pb-2 pt-0 px-0">
                <p className="text-xs font-700 uppercase tracking-wider text-slate-400">Acceso rápido</p>
            </CardHeader>
            <CardContent className="px-0">
                <div className="sm:hidden">
                    <div className="grid grid-cols-2 gap-2">
                        {visibleMobile.map((a) => <ActionBtn key={a.key} {...a} />)}
                    </div>
                    {hasMore && (
                        <button type="button" className="mt-2 w-full py-2 text-xs font-600 text-blue-600 hover:text-blue-800 transition-colors" onClick={() => setOpen((v) => !v)}>
                            {open ? "Ver menos ↑" : `Ver ${actions.length - previewCount} más ↓`}
                        </button>
                    )}
                </div>
                <div className="hidden sm:grid sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-8 gap-2">
                    {actions.map((a) => <ActionBtn key={a.key} {...a} />)}
                </div>
            </CardContent>
        </Card>
    );
}

/* ─────────────────────────── DASHBOARD ─────────────────────────── */
function SmallAcademicDashboard() {
    const [stats, setStats] = useState({ sections: 0, teachers: 0, students: 0, openProcesses: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const [sumRes, procRes] = await Promise.all([
                    AcademicReports.summary(),
                    ProcessesInbox.listAll(),
                ]);
                const summary = sumRes?.summary ?? sumRes ?? {};
                const processes = Array.isArray(procRes?.processes) ? procRes.processes : [];
                const open = processes.filter((p) => String(p?.status || "").toUpperCase() === "PENDIENTE").length;
                if (!cancelled) setStats({
                    sections: Number(summary?.sections ?? 0),
                    teachers: Number(summary?.teachers ?? 0),
                    students: Number(summary?.students ?? 0),
                    openProcesses: Number(open ?? 0),
                });
            } catch (e) {
                if (!cancelled) toast.error(e?.message || "Error al cargar dashboard");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const items = [
        { label: "Secciones activas", value: stats.sections, Icon: Calendar, trend: "+2 este periodo", bg: "bg-blue-50", iconBg: "bg-blue-100", iconColor: "text-blue-700", cls: "stat-card-blue" },
        { label: "Docentes", value: stats.teachers, Icon: Users, trend: "Cuerpo docente", bg: "bg-emerald-50", iconBg: "bg-emerald-100", iconColor: "text-emerald-700", cls: "stat-card-green" },
        { label: "Estudiantes", value: stats.students, Icon: GraduationCap, trend: "Matriculados", bg: "bg-violet-50", iconBg: "bg-violet-100", iconColor: "text-violet-700", cls: "stat-card-violet" },
        { label: "Procesos pendientes", value: stats.openProcesses, Icon: Clock, trend: "Requieren atención", bg: "bg-amber-50", iconBg: "bg-amber-100", iconColor: "text-amber-700", cls: "stat-card-amber" },
    ];

    return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mt-4">
            {items.map((k, i) => (
                <Card key={i} className={`stat-card ${k.cls} border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200 rounded-2xl overflow-hidden ${k.bg} fade-in`} style={{ animationDelay: `${i * 60}ms` }}>
                    <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-[11px] font-600 uppercase tracking-wider text-slate-500 truncate">{k.label}</p>
                                <div className="mt-1.5 text-3xl font-800 text-slate-800 leading-none tabular-nums">
                                    {loading ? <div className="skel h-8 w-14 rounded-lg" /> : k.value.toLocaleString()}
                                </div>
                                <p className="mt-1.5 text-[11px] text-slate-400 flex items-center gap-1"><TrendingUp size={10} /> {k.trend}</p>
                            </div>
                            <div className={`flex-shrink-0 w-10 h-10 rounded-xl ${k.iconBg} flex items-center justify-center`}>
                                <k.Icon size={18} className={k.iconColor} />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

export { AcademicQuickActions, SmallAcademicDashboard };

/* ─────────────────────────── PLANES / MALLAS ─────────────────────────── */
function PlansAndCurricula() {
    const [list, setList] = useState([]);
    const [careers, setCareers] = useState([]);
    const [selectedPlan, setSelectedPlan] = useState(null);

    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleteText, setDeleteText] = useState("");
    const [deleting, setDeleting] = useState(false);

    const [pform, setPform] = useState({ name: "", career_id: "", start_year: new Date().getFullYear(), semesters: 10, description: "" });

    const [editOpen, setEditOpen] = useState(false);
    const [savingPlan, setSavingPlan] = useState(false);
    const [editingPlan, setEditingPlan] = useState(null);
    const [editForm, setEditForm] = useState({ name: "", career_id: "", start_year: new Date().getFullYear(), semesters: 10, description: "" });

    const [courses, setCourses] = useState([]);
    const [allCourses, setAllCourses] = useState([]);
    const [semesterIndex, setSemesterIndex] = useState([]);
    const [selectedSemester, setSelectedSemester] = useState(1);

    const [courseQ, setCourseQ] = useState("");
    const debouncedCourseQ = useDebounce(courseQ, 350);

    const [editingCourse, setEditingCourse] = useState(null);
    const isEditing = !!editingCourse?.id;
    const [cform, setCform] = useState({ code: "", name: "", credits: 3, weekly_hours: 3, semester: 1, type: "MANDATORY" });

    const [prereqFor, setPrereqFor] = useState(null);
    const [prereqs, setPrereqs] = useState([]);
    const [refreshKey, setRefreshKey] = useState(0);

    const startEditCourse = useCallback((course) => {
        if (!course?.id) return;
        setEditingCourse(course);
        setCform({
            code: course.code || "", name: course.name || "",
            credits: Number(course.credits ?? 0), weekly_hours: Number(course.weekly_hours ?? 0),
            semester: Number(course.semester ?? selectedSemester), type: course.type || "MANDATORY",
        });
        const sem = Number(course.semester || selectedSemester);
        if (sem && sem !== selectedSemester) setSelectedSemester(sem);
    }, [selectedSemester]);

    const cancelEditCourse = useCallback(() => {
        setEditingCourse(null);
        setCform({ code: "", name: "", credits: 3, weekly_hours: 3, semester: selectedSemester, type: "MANDATORY" });
    }, [selectedSemester]);

    const load = useCallback(async () => {
        try {
            const [pl, cs] = await Promise.all([Plans.list(), Careers.list()]);
            setList(Array.isArray(pl?.plans) ? pl.plans : Array.isArray(pl) ? pl : []);
            setCareers(Array.isArray(cs?.careers) ? cs.careers : Array.isArray(cs) ? cs : []);
        } catch (e) { toast.error(e?.message || "Error al cargar planes"); }
    }, []);

    useEffect(() => { load(); }, [load, refreshKey]);

    const loadSemesterIndex = useCallback(async (planId) => {
        try {
            const idxRes = await Plans.listCourses(planId);
            const idx = Array.isArray(idxRes?.semesters) ? idxRes.semesters : [];
            setSemesterIndex(idx);
            const firstSem = idx?.[0]?.semester ? Number(idx[0].semester) : 1;
            setSelectedSemester(firstSem);
            setCform((prev) => ({ ...prev, semester: firstSem }));
        } catch (e) {
            toast.error(e?.message || "Error al cargar índice de semestres");
            setSemesterIndex([]); setSelectedSemester(1);
            setCform((prev) => ({ ...prev, semester: 1 }));
        }
    }, []);

    const fetchCourses = useCallback(async () => {
        if (!selectedPlan?.id) return;
        try {
            const res = await Plans.listCourses(selectedPlan.id, {
                semester: selectedSemester,
                ...(debouncedCourseQ ? { q: debouncedCourseQ } : {}),
            });
            setCourses(Array.isArray(res?.courses) ? res.courses : Array.isArray(res) ? res : []);
        } catch (e) { toast.error(e?.message || "Error al cargar cursos del semestre"); setCourses([]); }
    }, [selectedPlan?.id, selectedSemester, debouncedCourseQ]);

    useEffect(() => {
        if (!selectedPlan?.id) return;
        setPrereqFor(null); setPrereqs([]); setAllCourses([]); setCourseQ(""); setEditingCourse(null);
        loadSemesterIndex(selectedPlan.id);
    }, [selectedPlan?.id, loadSemesterIndex]);

    useEffect(() => { fetchCourses(); }, [fetchCourses]);

    const createPlan = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                name: String(pform.name || "").trim(),
                career_id: pform.career_id ? Number(pform.career_id) : null,
                start_year: Number(pform.start_year || new Date().getFullYear()),
                semesters: Number(pform.semesters || 10),
                description: pform.description || "",
            };
            const res = await Plans.create(payload);
            const created = res?.plan ?? res?.data ?? res;
            toast.success("Plan creado exitosamente");
            setPform({ name: "", career_id: "", start_year: new Date().getFullYear(), semesters: 10, description: "" });
            if (created?.id) setList((prev) => [created, ...(Array.isArray(prev) ? prev : [])]);
            else setRefreshKey((k) => k + 1);
        } catch (e2) { toast.error(e2?.message || "Error al crear plan"); }
    };

    const openEditPlan = (plan) => {
        setEditingPlan(plan);
        setEditForm({
            name: plan?.name || "",
            career_id: plan?.career_id || plan?.career?.id || "",
            start_year: Number(plan?.start_year ?? new Date().getFullYear()),
            semesters: Number(plan?.semesters ?? 10),
            description: plan?.description || "",
        });
        setEditOpen(true);
    };

    const saveEditPlan = async () => {
        if (!editingPlan?.id) return;
        if (!editForm.name?.trim()) return toast.error("El nombre es obligatorio");
        if (!editForm.career_id) return toast.error("Selecciona una carrera");
        setSavingPlan(true);
        try {
            const payload = {
                name: editForm.name.trim(), career_id: Number(editForm.career_id),
                start_year: Number(editForm.start_year || new Date().getFullYear()),
                semesters: Number(editForm.semesters || 10), description: editForm.description || "",
            };
            const res = await Plans.update(editingPlan.id, payload);
            const updated = res?.plan ?? res?.data ?? res;
            setList((prev) => prev.map((p) => (p.id === editingPlan.id ? { ...p, ...updated } : p)));
            setSelectedPlan((sp) => (sp?.id === editingPlan.id ? { ...sp, ...updated } : sp));
            toast.success("Plan actualizado ✅");
            setEditOpen(false); setEditingPlan(null);
        } catch (e) { toast.error(e?.message || "No se pudo actualizar el plan"); }
        finally { setSavingPlan(false); }
    };

    const createOrUpdateCourse = async (e) => {
        e.preventDefault();
        if (!selectedPlan) return toast.error("Seleccione un plan");
        try {
            const payload = {
                ...cform,
                credits: Number(cform.credits || 0),
                weekly_hours: Number(cform.weekly_hours || 0),
                semester: Number(cform.semester || selectedSemester || 1),
                code: String(cform.code || "").trim(),
                name: String(cform.name || "").trim(),
            };
            if (isEditing) {
                await Plans.updateCourse(selectedPlan.id, editingCourse.id, payload);
                toast.success("Curso actualizado ✅");
            } else {
                await Plans.addCourse(selectedPlan.id, payload);
                toast.success("Curso añadido ✅");
            }
            cancelEditCourse();
            await loadSemesterIndex(selectedPlan.id);
            await fetchCourses();
        } catch (e2) { toast.error(e2?.message || (isEditing ? "Error al actualizar curso" : "Error al crear curso")); }
    };

    const savePrereqs = async () => {
        if (!selectedPlan?.id || !prereqFor?.id) return;
        try {
            await Plans.setPrereqs(selectedPlan.id, prereqFor.id, prereqs);
            toast.success("Prerrequisitos guardados");
            setPrereqFor(null); setPrereqs([]);
            await loadSemesterIndex(selectedPlan.id);
            await fetchCourses();
        } catch (e2) { toast.error(e2?.message || "Error al guardar prerrequisitos"); }
    };

    const semestersButtons = useMemo(() => {
        if (semesterIndex.length > 0) return semesterIndex;
        const total = Number(selectedPlan?.semesters || 0) || 0;
        if (total <= 0) return [];
        return Array.from({ length: total }, (_, i) => ({ semester: i + 1 }));
    }, [semesterIndex, selectedPlan?.semesters]);

    const requestDeletePlan = (plan) => { setDeleteTarget(plan); setDeleteText(""); setDeleteOpen(true); };

    const confirmDeletePlan = async () => {
        if (!deleteTarget?.id) return;
        if (deleteText.trim().toUpperCase() !== "ELIMINAR") { toast.error("Escribe ELIMINAR para confirmar"); return; }
        setDeleting(true);
        try {
            await Plans.remove(deleteTarget.id);
            toast.success("Plan eliminado 🔥");
            setList((prev) => prev.filter((p) => p.id !== deleteTarget.id));
            if (selectedPlan?.id === deleteTarget.id) {
                setSelectedPlan(null); setCourses([]); setAllCourses([]);
                setSemesterIndex([]); setSelectedSemester(1); setCourseQ("");
                setPrereqFor(null); setPrereqs([]); setEditingCourse(null);
            }
            setDeleteOpen(false); setDeleteTarget(null);
        } catch (e) { toast.error(e?.message || "Error al eliminar plan"); }
        finally { setDeleting(false); }
    };

    const openPrereqs = async (c) => {
        setPrereqFor(c);
        try {
            const data = await Plans.listPrereqs(selectedPlan.id, c.id);
            const ids = Array.isArray(data?.prerequisites) ? data.prerequisites.map((x) => x.id) : [];
            setPrereqs(ids);
            const all = await Plans.listAllCourses(selectedPlan.id);
            setAllCourses(Array.isArray(all?.courses) ? all.courses : []);
        } catch (e) { setPrereqs([]); setAllCourses([]); toast.error(e?.message || "Error cargando prerrequisitos"); }
    };

    return (
        <IfPerm any={REQS.plans}>
            <div className="space-y-5 fade-in">
                {/* CREAR PLAN */}
                <Card className="border border-slate-100 shadow-sm rounded-2xl bg-white">
                    <CardHeader className="px-6 pt-5 pb-4">
                        <SectionHeader title="Planes / Mallas Curriculares" description="Define nuevos planes de estudio asociados a una carrera" Icon={LibraryBig} />
                    </CardHeader>
                    <CardContent className="px-6 pb-6">
                        <form onSubmit={createPlan} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                <div className="sm:col-span-2 lg:col-span-1 space-y-1.5">
                                    <Label className="text-xs font-600 text-slate-700">Nombre del plan *</Label>
                                    <Input value={pform.name} onChange={(e) => setPform({ ...pform, name: e.target.value })} placeholder="Ej: Plan de estudios 2024" required className="h-9 text-sm rounded-lg border-slate-200 focus:border-blue-400" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-600 text-slate-700">Carrera *</Label>
                                    <Select value={pform.career_id ? String(pform.career_id) : "ALL"} onValueChange={(v) => setPform({ ...pform, career_id: v === "ALL" ? "" : Number(v) })}>
                                        <SelectTrigger className="h-9 text-sm rounded-lg border-slate-200"><SelectValue placeholder="Seleccionar carrera" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ALL">— Seleccionar —</SelectItem>
                                            {careers.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-600 text-slate-700">Año inicio</Label>
                                        <Input type="number" min="2000" max="2100" value={pform.start_year} onChange={(e) => setPform({ ...pform, start_year: +e.target.value })} className="h-9 text-sm rounded-lg border-slate-200" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-600 text-slate-700">Semestres</Label>
                                        <Input type="number" min="1" max="20" value={pform.semesters} onChange={(e) => setPform({ ...pform, semesters: +e.target.value })} className="h-9 text-sm rounded-lg border-slate-200" />
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-600 text-slate-700">Descripción</Label>
                                <Textarea value={pform.description} onChange={(e) => setPform({ ...pform, description: e.target.value })} placeholder="Descripción opcional del plan de estudios..." rows={2} className="text-sm rounded-lg border-slate-200 resize-none" />
                            </div>
                            <div className="flex justify-end pt-1">
                                <Button type="submit" className="gap-2 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm">
                                    <Plus size={15} /> Crear plan
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                {/* DOS COLUMNAS: lista + cursos */}
                <div className="grid lg:grid-cols-5 gap-4">
                    {/* LISTA DE PLANES */}
                    <Card className="border border-slate-100 shadow-sm rounded-2xl bg-white lg:col-span-2">
                        <CardHeader className="px-5 pt-5 pb-3">
                            <SectionHeader title="Planes registrados" Icon={LibraryBig}
                                action={
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg hover:bg-slate-100" onClick={() => setRefreshKey((k) => k + 1)} title="Actualizar lista">
                                        <RotateCw size={14} />
                                    </Button>
                                }
                            />
                        </CardHeader>
                        <CardContent className="px-3 pb-4">
                            {list.length === 0 ? (
                                <EmptyState icon={BookOpen} title="Sin planes" description="Crea tu primer plan arriba" />
                            ) : (
                                <div className="space-y-1">
                                    {list.map((p) => (
                                        <div key={p.id} className={`plan-row px-3 py-2.5 rounded-xl border cursor-pointer flex items-center justify-between gap-2 ${selectedPlan?.id === p.id ? "active border-blue-200" : "border-transparent hover:border-slate-100"}`}>
                                            <button type="button" onClick={() => setSelectedPlan(p)} className="flex-1 text-left min-w-0">
                                                <div className="text-sm font-600 text-slate-800 truncate">{p.name}</div>
                                                <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                                                    <span className="truncate">{p.career_name || p.career?.name}</span>
                                                    <span className="text-slate-300">·</span>
                                                    <span>{p.semesters} sem.</span>
                                                </div>
                                            </button>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 rounded-md font-600 bg-slate-100 text-slate-600">{p.start_year}</Badge>
                                                <IfPerm any={REQS.plans}>
                                                    <button type="button" className="text-[11px] font-600 text-blue-600 hover:text-blue-800 px-1.5 py-0.5 rounded hover:bg-blue-50 transition-colors" onClick={() => openEditPlan(p)}>Editar</button>
                                                </IfPerm>
                                                <IfPerm any={REQS.plansDelete}>
                                                    <button type="button" className="text-[11px] font-600 text-red-500 hover:text-red-700 px-1.5 py-0.5 rounded hover:bg-red-50 transition-colors" onClick={() => requestDeletePlan(p)}>Eliminar</button>
                                                </IfPerm>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* CURSOS DEL PLAN */}
                    <Card className="border border-slate-100 shadow-sm rounded-2xl bg-white lg:col-span-3">
                        <CardHeader className="px-5 pt-5 pb-3">
                            <SectionHeader
                                title={selectedPlan ? `Cursos — ${selectedPlan.name}` : "Cursos del plan"}
                                description={selectedPlan ? `${selectedPlan.semesters} semestres · Selecciona semestre para ver cursos` : "Selecciona un plan de la lista"}
                                Icon={ClipboardList}
                            />
                        </CardHeader>
                        <CardContent className="px-5 pb-5 space-y-4">
                            {selectedPlan && semestersButtons.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {semestersButtons.map((s) => {
                                        const active = selectedSemester === Number(s.semester);
                                        return (
                                            <button key={s.semester} type="button"
                                                onClick={() => { const sem = Number(s.semester); setSelectedSemester(sem); setCform((prev) => ({ ...prev, semester: sem })); setEditingCourse(null); }}
                                                className={`text-[11px] font-700 px-3 py-1 rounded-full transition-all border ${active ? "bg-blue-600 text-white border-blue-600 shadow-sm" : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600"}`}
                                            >
                                                Sem {s.semester}
                                                {typeof s.total === "number" && <span className={`ml-1 ${active ? "opacity-80" : "text-slate-400"}`}>({s.total})</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {selectedPlan && (
                                <div className="flex items-center gap-2">
                                    <div className="relative flex-1">
                                        <SearchIcon size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <Input value={courseQ} onChange={(e) => setCourseQ(e.target.value)} placeholder="Buscar por código o nombre..." className="h-8 pl-7 text-xs rounded-lg border-slate-200" />
                                    </div>
                                    {isEditing && (
                                        <Badge className="text-[10px] font-700 rounded-md bg-blue-50 text-blue-700 border border-blue-200 px-2">
                                            Editando: {editingCourse?.code}
                                        </Badge>
                                    )}
                                </div>
                            )}

                            <div className={`border rounded-xl p-4 bg-slate-50 ${isEditing ? "border-blue-200 bg-blue-50/40" : "border-slate-200"}`}>
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <p className="text-xs font-700 text-slate-700">{isEditing ? "✏️ Editar curso" : "➕ Nuevo curso"}</p>
                                        <p className="text-[11px] text-slate-400 mt-0.5">{isEditing ? `Modificando: ${editingCourse?.name}` : "Completa los campos y guarda"}</p>
                                    </div>
                                    {isEditing && (
                                        <button type="button" onClick={cancelEditCourse} className="text-[11px] font-600 text-slate-500 hover:text-slate-800 px-2 py-1 rounded-lg hover:bg-white/80 transition-colors">Cancelar</button>
                                    )}
                                </div>
                                <form onSubmit={createOrUpdateCourse} className="space-y-3">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div className="sm:col-span-2 space-y-1.5">
                                            <Label className="text-[11px] font-600 text-slate-600">Nombre *</Label>
                                            <Input className="h-8 text-xs rounded-lg bg-white border-slate-200" value={cform.name} onChange={(e) => setCform({ ...cform, name: e.target.value })} required disabled={!selectedPlan} placeholder="Nombre del curso" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-[11px] font-600 text-slate-600">Código *</Label>
                                            <Input className="h-8 text-xs rounded-lg bg-white font-mono border-slate-200 uppercase" value={cform.code} onChange={(e) => setCform({ ...cform, code: e.target.value.toUpperCase() })} required disabled={!selectedPlan} placeholder="MAT101" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        {[
                                            { label: "Créditos", field: "credits" },
                                            { label: "Hrs/Sem", field: "weekly_hours" },
                                            { label: "Semestre", field: "semester", min: 1 },
                                        ].map(({ label, field, min = 0 }) => (
                                            <div key={field} className="space-y-1.5">
                                                <Label className="text-[11px] font-600 text-slate-600">{label}</Label>
                                                <Input className="h-8 text-xs rounded-lg bg-white border-slate-200" type="number" min={min} inputMode="numeric" value={cform[field]} onChange={(e) => setCform({ ...cform, [field]: +e.target.value || 0 })} disabled={!selectedPlan} />
                                            </div>
                                        ))}
                                        <div className="space-y-1.5">
                                            <Label className="text-[11px] font-600 text-slate-600">Tipo</Label>
                                            <Select value={cform.type} onValueChange={(v) => setCform({ ...cform, type: v })} disabled={!selectedPlan}>
                                                <SelectTrigger className="h-8 text-xs rounded-lg bg-white border-slate-200"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="MANDATORY">Obligatorio</SelectItem>
                                                    <SelectItem value="ELECTIVE">Electivo</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 pt-1">
                                        <Button type="submit" disabled={!selectedPlan} className="h-8 text-xs gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white">
                                            <Save size={12} />{isEditing ? "Actualizar" : "Guardar curso"}
                                        </Button>
                                        {!isEditing && (
                                            <Button type="button" variant="ghost" disabled={!selectedPlan} className="h-8 text-xs rounded-lg text-slate-500 hover:bg-white"
                                                onClick={() => setCform({ code: "", name: "", credits: 3, weekly_hours: 3, semester: selectedSemester, type: "MANDATORY" })}>
                                                Limpiar
                                            </Button>
                                        )}
                                    </div>
                                </form>
                            </div>

                            {/* Tabla de cursos */}
                            <div className="border border-slate-100 rounded-xl overflow-hidden">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100">
                                            {["Código", "Nombre", "Cr.", "Tipo", "Acciones"].map((h, i) => (
                                                <th key={i} className={`px-3 py-2.5 font-700 text-slate-500 uppercase tracking-wide text-[10px] ${i >= 2 ? "text-center" : "text-left"} ${i === 4 ? "text-right" : ""}`}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 bg-white">
                                        {!selectedPlan ? (
                                            <tr><td colSpan={5}><EmptyState icon={BookOpen} title="Selecciona un plan" description="Elige un plan de la lista de la izquierda" /></td></tr>
                                        ) : courses.length === 0 ? (
                                            <tr><td colSpan={5}><EmptyState icon={ClipboardList} title={`Sin cursos en Sem ${selectedSemester}`} description="Agrega cursos con el formulario de arriba" /></td></tr>
                                        ) : courses.map((c) => {
                                            const active = isEditing && String(editingCourse?.id) === String(c.id);
                                            return (
                                                <tr key={c.id} className={`course-row transition-colors ${active ? "editing" : ""}`}>
                                                    <td className="px-3 py-2.5 font-mono font-700 text-blue-700 cursor-pointer hover:underline" onClick={() => startEditCourse(c)}>{c.code}</td>
                                                    <td className="px-3 py-2.5 text-slate-700 cursor-pointer" onClick={() => startEditCourse(c)}>{c.name}</td>
                                                    <td className="px-3 py-2.5 text-center font-700 text-slate-600">{c.credits}</td>
                                                    <td className="px-3 py-2.5 text-center">
                                                        <span className={`text-[10px] font-700 px-2 py-0.5 rounded-full ${c.type === "ELECTIVE" ? "bg-violet-50 text-violet-700 border border-violet-100" : "bg-blue-50 text-blue-700 border border-blue-100"}`}>
                                                            {c.type === "ELECTIVE" ? "Electivo" : "Obligatorio"}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2.5">
                                                        <div className="flex justify-end gap-1.5">
                                                            <button className="text-[11px] font-600 text-blue-600 hover:text-blue-800 px-1.5 py-0.5 rounded hover:bg-blue-50 transition-colors" onClick={() => startEditCourse(c)}>Editar</button>
                                                            <button className="text-[11px] font-600 text-slate-500 hover:text-slate-800 px-1.5 py-0.5 rounded hover:bg-slate-100 transition-colors" onClick={() => openPrereqs(c)}>Prereq.</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Prerrequisitos */}
                            {prereqFor && (
                                <div className="border border-amber-200 bg-amber-50/50 rounded-xl p-4 fade-in">
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <p className="text-xs font-700 text-amber-800">Prerrequisitos de:</p>
                                            <p className="text-sm font-700 text-slate-800 truncate">{prereqFor.name}</p>
                                        </div>
                                        <button onClick={() => { setPrereqFor(null); setPrereqs([]); setAllCourses([]); }} className="w-7 h-7 rounded-lg hover:bg-amber-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors">✕</button>
                                    </div>
                                    <ScrollArea className="h-48 pr-1">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                            {(Array.isArray(allCourses) ? allCourses : []).filter((c) => c.id !== prereqFor.id).map((c) => {
                                                const checked = prereqs.includes(c.id);
                                                return (
                                                    <label key={c.id} className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs cursor-pointer border transition-all ${checked ? "bg-white border-amber-300 text-slate-800" : "bg-white/60 border-transparent hover:border-amber-200 text-slate-600"}`}>
                                                        <input type="checkbox" checked={checked} className="accent-amber-600" onChange={(e) => setPrereqs((prev) => e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id))} />
                                                        <span className="font-mono font-700 text-blue-600">{c.code}</span>
                                                        <span className="truncate">{c.name}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </ScrollArea>
                                    <div className="mt-3 flex justify-end">
                                        <Button onClick={savePrereqs} className="h-8 text-xs gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white">
                                            <Save size={12} /> Guardar prerrequisitos
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Dialog Editar Plan */}
                <Dialog open={editOpen} onOpenChange={setEditOpen}>
                    <DialogContent className="sm:max-w-[600px] rounded-2xl">
                        <DialogHeader>
                            <DialogTitle className="text-base font-700">Editar Plan de Estudios</DialogTitle>
                            <DialogDescription className="text-xs">Modifica los datos del plan. Los cambios afectan cómo aparece en el sistema.</DialogDescription>
                        </DialogHeader>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
                            <div className="sm:col-span-2 space-y-1.5">
                                <Label className="text-xs font-600">Nombre *</Label>
                                <Input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} className="h-9 text-sm rounded-lg" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-600">Carrera *</Label>
                                <Select value={editForm.career_id ? String(editForm.career_id) : "ALL"} onValueChange={(v) => setEditForm((p) => ({ ...p, career_id: v === "ALL" ? "" : Number(v) }))}>
                                    <SelectTrigger className="h-9 text-sm rounded-lg"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">— Seleccionar —</SelectItem>
                                        {careers.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-600">Año inicio</Label>
                                    <Input type="number" min="2000" max="2100" value={editForm.start_year} onChange={(e) => setEditForm((p) => ({ ...p, start_year: +e.target.value }))} className="h-9 text-sm rounded-lg" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-600">Semestres</Label>
                                    <Input type="number" min="1" max="20" value={editForm.semesters} onChange={(e) => setEditForm((p) => ({ ...p, semesters: +e.target.value }))} className="h-9 text-sm rounded-lg" />
                                </div>
                            </div>
                            <div className="sm:col-span-2 space-y-1.5">
                                <Label className="text-xs font-600">Descripción</Label>
                                <Textarea value={editForm.description} onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))} rows={2} className="text-sm rounded-lg resize-none" />
                            </div>
                        </div>
                        <DialogFooter className="gap-2">
                            <Button variant="outline" className="h-9 text-sm rounded-lg" onClick={() => setEditOpen(false)} disabled={savingPlan}>Cancelar</Button>
                            <Button className="h-9 text-sm rounded-lg gap-2" onClick={saveEditPlan} disabled={savingPlan}>
                                {savingPlan ? <><Loader2 size={13} className="animate-spin" /> Guardando...</> : <><Save size={13} /> Guardar cambios</>}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Dialog Eliminar Plan */}
                <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                    <DialogContent className="sm:max-w-[480px] rounded-2xl">
                        <DialogHeader>
                            <DialogTitle className="text-base font-700 text-red-600 flex items-center gap-2"><AlertCircle size={18} /> Eliminar plan de estudios</DialogTitle>
                            <DialogDescription className="text-xs">Esta acción eliminará <strong>todo</strong> lo relacionado a este plan y no se puede deshacer.</DialogDescription>
                        </DialogHeader>
                        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 my-1">
                            <p className="text-xs text-red-700 font-600">Plan a eliminar:</p>
                            <p className="text-sm font-700 text-slate-800 mt-0.5">{deleteTarget?.name || "—"}</p>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-600 text-slate-700">Escribe <span className="font-mono font-800 text-red-600">ELIMINAR</span> para confirmar</Label>
                            <Input value={deleteText} onChange={(e) => setDeleteText(e.target.value)} placeholder="ELIMINAR" className="h-9 text-sm rounded-lg font-mono border-red-200 focus:border-red-400 focus:ring-red-100" />
                        </div>
                        <DialogFooter className="gap-2">
                            <Button variant="outline" className="h-9 text-sm rounded-lg" onClick={() => setDeleteOpen(false)} disabled={deleting}>Cancelar</Button>
                            <Button variant="destructive" className="h-9 text-sm rounded-lg gap-2" onClick={confirmDeletePlan} disabled={deleting}>
                                {deleting ? <><Loader2 size={13} className="animate-spin" /> Eliminando...</> : "Eliminar definitivamente"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </IfPerm>
    );
}

/* ─────────────────────────── CARGA Y HORARIOS + VENTANA MATRÍCULA ─────────────────────────── */
/* ✅ Sin selector de período duplicado — el banner azul de LoadAndSchedules es el único control */
function LoadSchedulesAndWindow() {
    const { hasAny } = useAuth();
    const isAdmin = hasAny([PERMS["academic.sections.create"]] || []);

    // Estado compartido — lo actualiza el banner dentro de LoadAndSchedules vía onPeriodChange
    const [activePeriod, setActivePeriod] = useState(guessPeriod);

    return (
        <div className="space-y-6 fade-in">
            {isAdmin ? (
                <div className="grid xl:grid-cols-3 gap-6">
                    <div className="xl:col-span-2">
                        {/* El banner del período vive aquí dentro */}
                        <LoadAndSchedules
                            externalPeriod={activePeriod}
                            onPeriodChange={setActivePeriod}
                        />
                    </div>
                    <div className="xl:col-span-1">
                        {/* Recibe el período sincronizado desde el banner */}
                        <EnrollmentWindowManager activePeriod={activePeriod} />
                    </div>
                </div>
            ) : (
                <LoadAndSchedules
                    externalPeriod={activePeriod}
                    onPeriodChange={setActivePeriod}
                />
            )}
        </div>
    );
}

/* ─────────────────────────── KÁRDEX ─────────────────────────── */
function KardexAndCertificates() {
    const { hasAny } = useAuth();
    const allowed = hasAny(REQS.kardex);

    const [studentId, setStudentId] = useState("");
    const [period, setPeriod] = useState("2025-I");
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [exportingPeriod, setExportingPeriod] = useState(false);
    const [exportingYear, setExportingYear] = useState(false);
    const [exportingRecord, setExportingRecord] = useState(false);

    const anyExporting = exportingPeriod || exportingYear || exportingRecord;

    const toApiPeriod = (raw) => {
        const s = String(raw || "").trim().toUpperCase().replace(/\s+/g, "").replace("/", "-");
        let m = s.match(/^(\d{4})-(I|II|1|2)$/);
        if (m) return `${m[1]}-${m[2] === "1" ? "I" : m[2] === "2" ? "II" : m[2]}`;
        m = s.match(/^(\d{4})(I{1,2}|[12])$/);
        if (m) return `${m[1]}-${m[2] === "1" ? "I" : m[2] === "2" ? "II" : m[2]}`;
        m = s.match(/^(\d{4})-(0?1|0?2)$/);
        if (m) return `${m[1]}-${m[2].endsWith("1") ? "I" : "II"}`;
        return s;
    };

    const parseYearFromPeriod = (p) => {
        const s = toApiPeriod(p);
        const m = s.match(/^(\d{4})-(I|II|1|2)$/);
        return m ? Number(m[1]) : 0;
    };

    const downloadBlob = (blob, filename) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = filename; a.rel = "noopener";
        document.body.appendChild(a); a.click(); a.remove();
        window.URL.revokeObjectURL(url);
    };

    const fetchKardex = async () => {
        if (!studentId) return toast.error("Ingrese ID/DNI del estudiante");
        try {
            setLoading(true);
            const k = await Kardex.ofStudent(studentId);
            setData(k);
            toast.success("Kárdex cargado");
        } catch (e) { toast.error(e?.message || "Error al consultar kárdex"); setData(null); }
        finally { setLoading(false); }
    };

    const exportBoletaPeriodo = async () => {
        if (!studentId) return toast.error("Ingrese ID/DNI");
        const p = toApiPeriod(period);
        if (!p) return toast.error("Periodo inválido");
        if (anyExporting) return;
        try {
            setExportingPeriod(true);
            const res = await Kardex.exportBoletaPeriodoPdf(studentId, p);
            downloadBlob(new Blob([res.data], { type: "application/pdf" }), `boleta-${studentId}-${p.replace(/[-/]/g, "")}.pdf`);
            toast.success("Boleta del periodo descargada");
        } catch (e) { toast.error(e?.message || "No se pudo generar boleta"); }
        finally { setExportingPeriod(false); }
    };

    const exportBoletaAnio = async () => {
        if (!studentId) return toast.error("Ingrese ID/DNI");
        const p = toApiPeriod(period);
        if (!p) return toast.error("Periodo inválido");
        if (anyExporting) return;
        try {
            setExportingYear(true);
            const res = await Kardex.exportBoletaAnioPdf(studentId, p);
            const year = parseYearFromPeriod(p) || "anio";
            downloadBlob(new Blob([res.data], { type: "application/pdf" }), `boleta-${studentId}-${year}-completo.pdf`);
            toast.success("Boleta anual descargada");
        } catch (e) { toast.error(e?.message || "No se pudo generar boleta anual"); }
        finally { setExportingYear(false); }
    };

    const exportRecordNotas = async () => {
        if (!studentId) return toast.error("Ingrese ID/DNI");
        if (anyExporting) return;
        try {
            setExportingRecord(true);
            const res = await Kardex.exportRecordNotasPdf(studentId);
            downloadBlob(new Blob([res.data], { type: "application/pdf" }), `record_notas-${studentId}.pdf`);
            toast.success("Record de notas descargado");
        } catch (e) { toast.error(e?.message || "No se pudo generar record de notas"); }
        finally { setExportingRecord(false); }
    };

    if (!allowed) return null;

    return (
        <div className="space-y-4 fade-in">
            <Card className="border border-slate-100 shadow-sm rounded-2xl bg-white">
                <CardHeader className="px-6 pt-5 pb-4">
                    <SectionHeader title="Consulta de Kárdex" description="Busca el historial académico de un estudiante" Icon={FileText} />
                </CardHeader>
                <CardContent className="px-6 pb-6">
                    <div className="flex flex-col sm:flex-row gap-3 items-end">
                        <div className="flex-1 space-y-1.5">
                            <Label className="text-xs font-600 text-slate-700">ID / DNI del estudiante</Label>
                            <Input value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="Ej: 71234567" className="h-9 text-sm rounded-lg border-slate-200" onKeyDown={(e) => e.key === "Enter" && fetchKardex()} />
                        </div>
                        <div className="w-36 space-y-1.5">
                            <Label className="text-xs font-600 text-slate-700">Período</Label>
                            <Input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="2025-I" className="h-9 text-sm rounded-lg border-slate-200 font-mono" />
                        </div>
                        <Button onClick={fetchKardex} disabled={loading} className="h-9 gap-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white shrink-0">
                            {loading ? <><Loader2 size={13} className="animate-spin" /> Consultando...</> : <><SearchIcon size={13} /> Consultar</>}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {data && (
                <Card className="border border-slate-100 shadow-sm rounded-2xl bg-white fade-in">
                    <CardHeader className="px-6 pt-5 pb-3">
                        <SectionHeader title="Resultados del Kárdex" Icon={Users} />
                    </CardHeader>
                    <CardContent className="px-6 pb-6 space-y-4">
                        {/* Aviso reingreso */}
                        {data.has_prior_enrollment && (
                            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 border-l-4 border-l-amber-400 rounded-xl px-4 py-3">
                                <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-xs font-700 text-amber-800">Alumno con reingreso detectado</p>
                                    <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                                        El estudiante tiene matrícula previa con un período de retiro prolongado.
                                        El <strong>PPA y créditos aprobados</strong> corresponden únicamente
                                        a la matrícula activa{data.active_since ? ` desde ${data.active_since}` : ""}.
                                    </p>
                                </div>
                            </div>
                        )}
                        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            {[
                                { label: "Estudiante", value: data.student_name, icon: "👤", sub: null },
                                { label: "Carrera", value: data.career_name, icon: "🎓", sub: null },
                                { label: "Créditos aprobados", value: data.credits_earned, icon: "📚", sub: data.has_prior_enrollment ? `Desde ${data.active_since}` : null },
                                { label: "PPA", value: data.gpa ?? "—", icon: "📊", sub: data.has_prior_enrollment ? `Desde ${data.active_since}` : null },
                            ].map((item) => (
                                <div key={item.label} className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                                    <p className="text-[10px] font-700 uppercase tracking-wider text-slate-400">{item.label}</p>
                                    <p className="text-sm font-700 text-slate-800 mt-1 flex items-center gap-1.5"><span>{item.icon}</span> {item.value}</p>
                                    {item.sub && (
                                        <p className="text-[10px] text-amber-600 font-600 mt-1 flex items-center gap-1">
                                            <AlertTriangle size={9} /> {item.sub}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                        <Separator className="bg-slate-100" />
                        <div>
                            <p className="text-xs font-700 uppercase tracking-wider text-slate-400 mb-3">Exportar documentos</p>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { label: "Boleta del período", action: exportBoletaPeriodo, loading: exportingPeriod },
                                    { label: "Boleta anual", action: exportBoletaAnio, loading: exportingYear },
                                    { label: "Record de notas", action: exportRecordNotas, loading: exportingRecord },
                                ].map(({ label, action, loading: l }) => (
                                    <Button key={label} variant="outline" onClick={action} disabled={anyExporting} className="h-9 text-xs gap-2 rounded-lg border-slate-200 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors">
                                        {l ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                                        {l ? "Generando..." : `${label} PDF`}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

/* ─────────────────────────── MÓDULO PRINCIPAL ─────────────────────────── */
export default function AcademicModule() {
    const { hasAny } = useAuth();
    const [tab, setTab] = useState("dashboard");

    const tabs = useMemo(() =>
        [
            { key: "dashboard", label: "Dashboard", need: [] },
            { key: "plans", label: "Mallas", need: REQS.plans },
            { key: "load", label: "Carga & Horarios", need: REQS.load },
            { key: "enroll", label: "Matrícula", need: REQS.enroll },
            { key: "grades", label: "Notas", need: REQS.grades },
            { key: "syllabus", label: "Sílabos", need: REQS.syllabus },
            { key: "kardex", label: "Kárdex", need: REQS.kardex },
            { key: "reports", label: "Reportes", need: REQS.reports },
            { key: "processes", label: "Procesos", need: REQS.processes },
            { key: "transfers", label: "Traslados", need: REQS.transfers },
        ].filter((t) => t.need.length === 0 || hasAny(t.need)),
        [hasAny]
    );

    useEffect(() => {
        if (!tabs.find((t) => t.key === tab)) setTab(tabs[0]?.key ?? "dashboard");
    }, [tabs, tab]);

    return (
        <>
            <InjectStyles />
            <div style={pageStyle} className="acad-module min-h-[100dvh] w-full min-w-0 overflow-x-hidden p-3 sm:p-4 md:p-6 pb-24 md:pb-16">
                <div className="w-full min-w-0 rounded-2xl md:rounded-3xl bg-white/80 backdrop-blur-md border border-slate-200/60 shadow-xl shadow-slate-200/40 p-4 md:p-6 space-y-6">

                    {/* Header del módulo */}
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-sm shadow-blue-200">
                                <GraduationCap size={20} className="text-white" />
                            </div>
                            <div>
                                <h1 className="text-lg font-800 text-slate-800 leading-tight">Módulo Académico</h1>
                                <p className="text-xs text-slate-400 mt-0.5">Gestión integral de planes, secciones y matrícula</p>
                            </div>
                        </div>
                    </div>

                    <Separator className="bg-slate-100" />

                    {/* Navegación por pestañas */}
                    <Tabs value={tab} onValueChange={setTab} className="space-y-5">
                        {/* Mobile: 2 tabs visibles + dropdown */}
                        <div className="sm:hidden">
                            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-1.5">
                                <TabsList className="flex flex-1 gap-1 h-auto bg-transparent p-0">
                                    {tabs.slice(0, 2).map((t) => (
                                        <IconTab key={t.key} value={t.key} label={t.label} Icon={tabIcon(t.key)} />
                                    ))}
                                </TabsList>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg border-slate-200 shrink-0">
                                            <ChevronDown size={14} />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-52 rounded-xl">
                                        {tabs.slice(2).map((t) => {
                                            const I = tabIcon(t.key);
                                            return (
                                                <DropdownMenuItem key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-2.5 text-sm rounded-lg ${tab === t.key ? "bg-blue-50 text-blue-700" : ""}`}>
                                                    <I size={14} /><span>{t.label}</span>
                                                </DropdownMenuItem>
                                            );
                                        })}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>

                        {/* Desktop: todas las pestañas */}
                        <div className="hidden sm:block">
                            <TabsList className="flex flex-wrap h-auto p-1.5 gap-1 bg-slate-50 border border-slate-200 rounded-xl">
                                {tabs.map((t) => <IconTab key={t.key} value={t.key} label={t.label} Icon={tabIcon(t.key)} />)}
                            </TabsList>
                        </div>

                        {/* Contenidos */}
                        <TabsContent value="dashboard" className="mt-0 space-y-5">
                            <AcademicQuickActions go={setTab} />
                            <SmallAcademicDashboard />
                        </TabsContent>
                        <TabsContent value="plans"><PlansAndCurricula /></TabsContent>
                        <TabsContent value="load"><LoadSchedulesAndWindow /></TabsContent>
                        <TabsContent value="enroll"><EnrollmentComponent /></TabsContent>
                        <TabsContent value="grades"><GradesAttendanceComponent /></TabsContent>
                        <TabsContent value="syllabus"><SectionSyllabusEvaluation /></TabsContent>
                        <TabsContent value="kardex"><KardexAndCertificates /></TabsContent>
                        <TabsContent value="reports"><AcademicReportsPage /></TabsContent>
                        <TabsContent value="processes"><AcademicProcesses /></TabsContent>
                        <TabsContent value="transfers"><TransferManagement /></TabsContent>
                    </Tabs>
                </div>
            </div>
        </>
    );
}

/* ─────────────────────────── COMPONENTES AUXILIARES ─────────────────────────── */
function IconTab({ value, label, Icon }) {
    return (
        <TabsTrigger value={value} className="tab-pill shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-600 text-slate-500 hover:text-slate-800 hover:bg-white transition-all data-[state=active]:text-blue-700 data-[state=active]:shadow-sm">
            <Icon size={14} />
            <span className="whitespace-nowrap">{label}</span>
        </TabsTrigger>
    );
}

function tabIcon(key) {
    const map = {
        dashboard: LayoutGrid, plans: BookOpen, load: Calendar, enroll: GraduationCap,
        grades: CheckCircle, syllabus: FileText, kardex: Users, reports: BarChart3, processes: Clock,
        transfers: Inbox,
    };
    return map[key] || LayoutGrid;
}