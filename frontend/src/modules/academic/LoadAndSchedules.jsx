/* ═══════════════════════════════════════════════════════════════
   LoadAndSchedules
   FIXES:
     ✅ Aula: usa roomLabel() → evita "TARM-01-A-101 · TARM-01-A-101"
     ✅ Docente: botón Refresh → recarga sin recargar la página
     ✅ Docente: aviso si la lista está vacía
   ═══════════════════════════════════════════════════════════════ */
import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { PERMS } from "@/auth/permissions";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select, SelectContent, SelectItem,
    SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
    Plus, Save, Calendar, X, Trash2, CalendarDays,
    BookOpen, User, Building2, Clock, CheckCircle2, AlertCircle,
    RefreshCw,
} from "lucide-react";
import {
    Dialog, DialogContent, DialogDescription,
    DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plans, Sections } from "@/services/academic.service";

const REQS_LOAD = [
    PERMS["academic.sections.view"],
    PERMS["academic.sections.create"],
    PERMS["academic.sections.conflicts"],
];

const DAYS = [
    { value: "MON", label: "Lunes" },
    { value: "TUE", label: "Martes" },
    { value: "WED", label: "Miércoles" },
    { value: "THU", label: "Jueves" },
    { value: "FRI", label: "Viernes" },
    { value: "SAT", label: "Sábado" },
];
const DAY_SHORT = { MON: "Lun", TUE: "Mar", WED: "Mié", THU: "Jue", FRI: "Vie", SAT: "Sáb" };
const DAY_LABELS = { MON: "Lunes", TUE: "Martes", WED: "Miércoles", THU: "Jueves", FRI: "Viernes", SAT: "Sábado" };

function generatePeriodOptions() {
    const y = new Date().getFullYear();
    const opts = [];
    for (let i = y + 1; i >= y - 3; i--) { opts.push(`${i}-II`); opts.push(`${i}-I`); }
    return opts;
}
function getDefaultPeriod() {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() < 6 ? "I" : "II"}`;
}

/* ─── FIX 1: label correcto para el aula ─────────────────────
   Soporta:
   - Backend actualizado: { display_label: "..." }
   - Backend viejo: { code, name, capacity }
   Evita duplicar cuando code === name
   ────────────────────────────────────────────────────────────── */
function roomLabel(r) {
    if (!r) return "—";
    if (r.display_label) return r.display_label;          // serializer actualizado
    const code = (r.code || "").trim();
    const name = (r.name || "").trim();
    const cap = r.capacity ? ` (cap. ${r.capacity})` : "";
    if (code && name && code !== name) return `${code} · ${name}${cap}`;
    return `${code || name || `Aula #${r.id}`}${cap}`;
}

/* ─── label para docente ─────────────────────────────────── */
function teacherLabel(t) {
    if (!t) return "—";
    return t.display_name || t.full_name || t.email || `Docente ${t.id}`;
}

/* ─── Step indicator ─────────────────────────────────────── */
const STEPS = [
    { id: 1, label: "Plan / Malla" },
    { id: 2, label: "Curso" },
    { id: 3, label: "Asignación" },
    { id: 4, label: "Horario" },
];
function StepIndicator({ current }) {
    return (
        <div className="flex items-center">
            {STEPS.map((s, i) => {
                const done = s.id < current, active = s.id === current;
                return (
                    <React.Fragment key={s.id}>
                        <div className="flex flex-col items-center">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all
                                ${done ? "bg-blue-600 text-white" : active ? "bg-blue-600 text-white ring-4 ring-blue-100" : "bg-slate-100 text-slate-400"}`}>
                                {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : s.id}
                            </div>
                            <span className={`mt-1 text-[10px] font-medium whitespace-nowrap hidden sm:block
                                ${active ? "text-blue-600" : done ? "text-slate-500" : "text-slate-300"}`}>
                                {s.label}
                            </span>
                        </div>
                        {i < STEPS.length - 1 && (
                            <div className={`h-0.5 flex-1 mx-1 mb-3 sm:mb-4 rounded-full transition-all ${done ? "bg-blue-500" : "bg-slate-200"}`} />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
}

function CourseCard({ course, selected, onClick }) {
    return (
        <button type="button" onClick={onClick}
            className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all
                ${selected ? "border-blue-500 bg-blue-50 ring-1 ring-blue-400"
                    : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/40"}`}>
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[11px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{course.code}</span>
                        {course.credits && <span className="text-[10px] text-slate-400">{course.credits} cr.</span>}
                    </div>
                    <div className="text-sm font-medium text-slate-800 mt-1 leading-tight line-clamp-2">{course.name}</div>
                </div>
                {selected && <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />}
            </div>
        </button>
    );
}

function SectionsGroupedTable({ sections, onDelete, onEdit }) {
    const [collapsed, setCollapsed] = useState({});
    const toggle = (k) => setCollapsed((p) => ({ ...p, [k]: !p[k] }));
    const grouped = sections.reduce((acc, s) => {
        const key = s.plan_name || (s.plan_id ? `Plan #${s.plan_id}` : "Sin plan");
        if (!acc[key]) acc[key] = [];
        acc[key].push(s);
        return acc;
    }, {});
    const planKeys = Object.keys(grouped).sort();

    return (
        <div>
            <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                        <th className="text-left font-medium text-slate-500 px-4 py-3">Curso</th>
                        <th className="text-left font-medium text-slate-500 px-4 py-3 hidden md:table-cell">Sec.</th>
                        <th className="text-left font-medium text-slate-500 px-4 py-3 hidden lg:table-cell">Docente</th>
                        <th className="text-left font-medium text-slate-500 px-4 py-3 hidden lg:table-cell">Aula</th>
                        <th className="text-left font-medium text-slate-500 px-4 py-3">Horario</th>
                        <th className="text-center font-medium text-slate-500 px-4 py-3 hidden sm:table-cell">Cap.</th>
                        <th className="text-right font-medium text-slate-500 px-4 py-3">Acciones</th>
                    </tr>
                </thead>
            </table>
            {planKeys.map((planName) => {
                const rows = grouped[planName];
                const isCollapsed = collapsed[planName];
                return (
                    <div key={planName} className="border-b border-slate-100 last:border-b-0">
                        <button type="button" onClick={() => toggle(planName)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 bg-blue-50/70 hover:bg-blue-100/60 transition-colors border-b border-blue-100">
                            <span className={`text-blue-400 text-[9px] transition-transform inline-block ${isCollapsed ? "" : "rotate-90"}`}>▶</span>
                            <span className="text-xs font-bold text-blue-800 flex-1 text-left truncate">{planName}</span>
                            <span className="text-[11px] text-blue-400 shrink-0 bg-blue-100 px-2 py-0.5 rounded-full">{rows.length} secc.</span>
                        </button>
                        {!isCollapsed && (
                            <table className="w-full text-sm">
                                <tbody className="divide-y divide-slate-100">
                                    {rows.map((s) => (
                                        <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="px-4 py-2.5 pl-9">
                                                <div className="font-medium text-slate-800 truncate max-w-[160px]">{s.course_name}</div>
                                                <div className="text-[11px] font-mono text-slate-400 mt-0.5">{s.course_code}</div>
                                            </td>
                                            <td className="px-4 py-2.5 hidden md:table-cell">
                                                <Badge variant="outline" className="font-mono text-slate-600 text-xs">{s.label || "—"}</Badge>
                                            </td>
                                            <td className="px-4 py-2.5 hidden lg:table-cell text-slate-600 text-xs truncate max-w-[140px]">{s.teacher_name || "—"}</td>
                                            <td className="px-4 py-2.5 hidden lg:table-cell text-slate-600 text-xs">{s.room_name || "—"}</td>
                                            <td className="px-4 py-2.5">
                                                <div className="flex flex-wrap gap-1">
                                                    {(Array.isArray(s.slots) ? s.slots : []).map((k, i) => (
                                                        <span key={i} className="text-[11px] bg-blue-50 border border-blue-200 text-blue-700 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                                            {DAY_SHORT[k.day] ?? k.day} {k.start}–{k.end}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-4 py-2.5 hidden sm:table-cell text-center text-slate-500 text-xs">{s.capacity}</td>
                                            <td className="px-4 py-2.5 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button type="button" variant="ghost" size="sm"
                                                        className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg gap-1"
                                                        onClick={() => onEdit(s)}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                                        <span className="hidden sm:inline">Editar</span>
                                                    </Button>
                                                    <Button type="button" variant="ghost" size="sm"
                                                        className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg gap-1"
                                                        onClick={() => onDelete(s)}>
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                        <span className="hidden sm:inline">Eliminar</span>
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ═══════════════════════════════════════════════════════════════ */
export default function LoadAndSchedules({ externalPeriod, onPeriodChange }) {
    const { hasAny } = useAuth();
    const allowed = hasAny(REQS_LOAD);

    const [activePeriod, setActivePeriod] = useState(externalPeriod || getDefaultPeriod());
    useEffect(() => {
        if (externalPeriod && externalPeriod !== activePeriod) setActivePeriod(externalPeriod);
    }, [externalPeriod]); // eslint-disable-line
    const handlePeriodChange = (v) => { setActivePeriod(v); onPeriodChange?.(v); };

    /* ── Catálogos ── */
    const [teachers, setTeachers] = useState([]);
    const [loadingTeachers, setLoadingTeachers] = useState(false);
    const [rooms, setRooms] = useState([]);
    const [sections, setSections] = useState([]);
    const [plans, setPlans] = useState([]);

    /* ── Selección paso a paso ── */
    const [selectedPlanId, setSelectedPlanId] = useState("");
    const [planCourses, setPlanCourses] = useState([]);
    const [courseSearch, setCourseSearch] = useState("");
    const [selectedCourseId, setSelectedCourseId] = useState("");

    /* ── Asignación ── */
    const [teacherId, setTeacherId] = useState("");
    const [roomId, setRoomId] = useState("");
    const [capacity, setCapacity] = useState(30);
    const [label, setLabel] = useState("A");

    /* ── Horario ── */
    const [slots, setSlots] = useState([]);
    const [newSlot, setNewSlot] = useState({ day: "MON", start: "08:00", end: "10:00" });
    const [conflicts, setConflicts] = useState([]);

    /* ── Delete / Edit ── */
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [editTeacherId, setEditTeacherId] = useState("");
    const [editRoomId, setEditRoomId] = useState("");
    const [editCapacity, setEditCapacity] = useState(30);
    const [editLabel, setEditLabel] = useState("A");
    const [editSlots, setEditSlots] = useState([]);
    const [editNewSlot, setEditNewSlot] = useState({ day: "MON", start: "08:00", end: "10:00" });
    const [saving, setSaving] = useState(false);

    const currentStep = !selectedPlanId ? 1 : !selectedCourseId ? 2 : !teacherId || !roomId ? 3 : 4;

    /* ── Carga completa ── */
    const load = useCallback(async () => {
        try {
            const [t, r, s, pl] = await Promise.all([
                Sections.teachers(),
                Sections.rooms(),
                Sections.list({ period: activePeriod }),
                Plans.list(),
            ]);
            setTeachers(Array.isArray(t?.teachers) ? t.teachers : Array.isArray(t?.items) ? t.items : []);
            setRooms(Array.isArray(r?.classrooms) ? r.classrooms : Array.isArray(r?.items) ? r.items : []);
            setSections(Array.isArray(s?.sections) ? s.sections : Array.isArray(s) ? s : []);
            setPlans(Array.isArray(pl?.plans) ? pl.plans : Array.isArray(pl) ? pl : []);
        } catch (e) { toast.error(e?.message || "Error al cargar datos"); }
    }, [activePeriod]);

    useEffect(() => { load(); }, [load]);

    /* ── FIX 2: Refresh solo docentes ── */
    const refreshTeachers = useCallback(async () => {
        setLoadingTeachers(true);
        try {
            const t = await Sections.teachers();
            const list = Array.isArray(t?.teachers) ? t.teachers
                : Array.isArray(t?.items) ? t.items
                    : Array.isArray(t) ? t : [];
            setTeachers(list);
            toast.success(list.length
                ? `${list.length} docente${list.length !== 1 ? "s" : ""} cargado${list.length !== 1 ? "s" : ""}`
                : "No se encontraron docentes");
        } catch (e) {
            toast.error(e?.message || "Error al recargar docentes");
        } finally {
            setLoadingTeachers(false);
        }
    }, []);

    /* ── Cursos del plan ── */
    useEffect(() => {
        if (!selectedPlanId) { setPlanCourses([]); setSelectedCourseId(""); setCourseSearch(""); return; }
        Plans.listAllCourses(selectedPlanId)
            .then((res) => setPlanCourses(Array.isArray(res?.courses) ? res.courses : []))
            .catch(() => { toast.error("Error al cargar cursos"); setPlanCourses([]); });
    }, [selectedPlanId]);

    const selectedCourse = planCourses.find((c) => String(c.id) === String(selectedCourseId));
    const selectedTeacher = teachers.find((t) => String(t.id) === String(teacherId));

    const plansByCareer = plans.reduce((acc, p) => {
        const career = p.career_name || p.career || "Sin carrera";
        if (!acc[career]) acc[career] = [];
        acc[career].push(p);
        return acc;
    }, {});
    const careerKeys = Object.keys(plansByCareer).sort();

    const filteredCourses = planCourses.filter((c) => {
        const q = courseSearch.toLowerCase();
        return !q || c.name?.toLowerCase().includes(q) || c.code?.toLowerCase().includes(q);
    });
    const coursesBySemester = filteredCourses.reduce((acc, c) => {
        const sem = c.semester ?? "Sin semestre";
        if (!acc[sem]) acc[sem] = [];
        acc[sem].push(c);
        return acc;
    }, {});
    const semKeys = Object.keys(coursesBySemester).sort((a, b) => {
        if (a === "Sin semestre") return 1;
        if (b === "Sin semestre") return -1;
        return Number(a) - Number(b);
    });

    const openEditSection = (sec) => {
        setEditTarget(sec);
        setEditTeacherId(sec.teacher_id ? String(sec.teacher_id) : "");
        setEditRoomId(sec.room_id ? String(sec.room_id) : "");
        setEditCapacity(sec.capacity || 30);
        setEditLabel(sec.label || "A");
        const rawSlots = Array.isArray(sec.schedule_slots) ? sec.schedule_slots : Array.isArray(sec.slots) ? sec.slots : [];
        setEditSlots(rawSlots.map((s) => ({
            day: s.weekday || s.day || "MON",
            start: (s.start || "08:00").slice(0, 5),
            end: (s.end || "09:00").slice(0, 5),
        })));
        setEditNewSlot({ day: "MON", start: "08:00", end: "10:00" });
        setEditOpen(true);
    };

    const addEditSlot = () => {
        if (!editNewSlot.start || !editNewSlot.end) return toast.error("Completa inicio y fin");
        if (editNewSlot.start >= editNewSlot.end) return toast.error("Inicio debe ser menor que fin");
        if (editSlots.some((s) => s.day === editNewSlot.day && s.start === editNewSlot.start && s.end === editNewSlot.end))
            return toast.error("Esa franja ya está agregada");
        setEditSlots((p) => [...p, { ...editNewSlot }]);
    };

    const updateSection = async () => {
        if (!editTarget?.id) return;
        if (!editTeacherId) return toast.error("Selecciona un docente");
        if (!editRoomId) return toast.error("Selecciona un aula");
        setSaving(true);
        try {
            await Sections.patch(editTarget.id, {
                label: editLabel, capacity: Number(editCapacity),
                teacher_id: Number(editTeacherId), room_id: Number(editRoomId),
                slots: editSlots,
            });
            toast.success("Sección actualizada ✅");
            setEditOpen(false);
            load();
        } catch (e) {
            const status = e?.status ?? e?.response?.status;
            if (status === 405) {
                try {
                    const payload = {
                        label: editLabel, capacity: Number(editCapacity),
                        teacher_id: Number(editTeacherId), room_id: Number(editRoomId),
                        period: editTarget.period || activePeriod, slots: editSlots,
                    };
                    if (editTarget.course_id) payload.course_id = editTarget.course_id;
                    if (editTarget.plan_course_id) payload.plan_course_id = editTarget.plan_course_id;
                    await Sections.update(editTarget.id, payload);
                    toast.success("Sección actualizada ✅");
                    setEditOpen(false);
                    load();
                    return;
                } catch (e2) {
                    const d2 = e2?.response?.data || e2?.data;
                    toast.error(d2 && typeof d2 === "object"
                        ? Object.entries(d2).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join(" | ")
                        : e2?.message || "Error al actualizar sección");
                    return;
                }
            }
            const data = e?.response?.data || e?.data;
            toast.error(data && typeof data === "object"
                ? Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join(" | ")
                : e?.message || "Error al actualizar sección");
        } finally { setSaving(false); }
    };

    const resetForm = () => {
        setSelectedCourseId("");
        setTeacherId(""); setRoomId(""); setCapacity(30); setLabel("A");
        setSlots([]); setConflicts([]); setCourseSearch("");
    };

    const addSlot = () => {
        if (!newSlot.start || !newSlot.end) return toast.error("Completa inicio y fin");
        if (newSlot.start >= newSlot.end) return toast.error("Inicio debe ser menor que fin");
        if (slots.some((s) => s.day === newSlot.day && s.start === newSlot.start && s.end === newSlot.end))
            return toast.error("Esa franja ya está agregada");
        setSlots((p) => [...p, { ...newSlot }]);
        setConflicts([]);
    };

    const check = async () => {
        if (!slots.length) return toast.error("Agrega al menos una franja");
        try {
            const res = await Sections.checkConflicts({ teacher_id: teacherId || null, room_id: roomId || null, period: activePeriod, slots });
            const list = Array.isArray(res?.conflicts) ? res.conflicts : [];
            setConflicts(list);
            if (!list.length) toast.success("Sin conflictos ✅");
            else toast.error(`${list.length} conflicto(s) detectado(s)`);
        } catch (e) { toast.error(e?.message || "Error al verificar"); }
    };

    const createSection = async () => {
        if (!selectedPlanId) return toast.error("Selecciona un plan");
        if (!selectedCourseId) return toast.error("Selecciona un curso");
        if (!teacherId) return toast.error("Selecciona un docente");
        if (!roomId) return toast.error("Selecciona un aula");
        if (!slots.length) return toast.error("Agrega al menos una franja");
        if (conflicts.length) return toast.error("Resuelve los conflictos antes de crear");
        try {
            await Sections.create({
                course_id: selectedCourse?.id ?? "", course_code: selectedCourse?.code ?? "",
                course_name: selectedCourse?.name ?? "", teacher_id: teacherId, room_id: roomId,
                capacity, label, period: activePeriod, slots,
            });
            toast.success("Sección creada ✅");
            resetForm();
            load();
        } catch (e) {
            if (e?.status === 409 && e?.data?.conflicts) { setConflicts(e.data.conflicts); toast.error("El servidor detectó conflictos"); }
            else toast.error(e?.message || "Error al crear sección");
        }
    };

    const confirmDeleteSection = async () => {
        if (!deleteTarget?.id) return;
        setDeleting(true);
        try {
            await Sections.remove(deleteTarget.id);
            toast.success("Sección eliminada");
            setSections((p) => p.filter((s) => s.id !== deleteTarget.id));
            setDeleteOpen(false); setDeleteTarget(null);
        } catch (e) { toast.error(e?.message || "Error al eliminar"); }
        finally { setDeleting(false); }
    };

    if (!allowed) return null;

    /* ─── RENDER ─── */
    return (
        <div className="space-y-6 pb-24 sm:pb-6">

            {/* Banner período */}
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md shadow-blue-200">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <CalendarDays className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-blue-100 uppercase tracking-widest">Período activo</p>
                    <p className="text-lg font-bold text-white leading-tight">{activePeriod}</p>
                </div>
                <div className="shrink-0 w-28">
                    <Select value={activePeriod} onValueChange={handlePeriodChange}>
                        <SelectTrigger className="h-9 px-3 rounded-xl border-0 bg-white/20 text-white text-sm focus:ring-0 focus:ring-offset-0 w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent align="end">
                            {generatePeriodOptions().map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Formulario nueva sección */}
            <Card className="border shadow-sm bg-white rounded-2xl overflow-hidden">
                <CardHeader className="px-6 pt-5 pb-4 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-blue-100 rounded-lg"><Calendar className="h-4 w-4 text-blue-600" /></div>
                            <div>
                                <CardTitle className="text-base text-slate-800">Nueva Sección</CardTitle>
                                <p className="text-xs text-slate-500 mt-0.5">Período: <span className="font-semibold text-blue-600">{activePeriod}</span></p>
                            </div>
                        </div>
                        {(selectedCourseId || teacherId) && (
                            <Button variant="ghost" size="sm" onClick={resetForm} className="text-slate-400 hover:text-slate-600 text-xs h-7">
                                <X className="h-3.5 w-3.5 mr-1" /> Limpiar
                            </Button>
                        )}
                    </div>
                    <StepIndicator current={currentStep} />
                </CardHeader>

                <CardContent className="px-6 py-6 space-y-7">

                    {/* PASO 1: PLAN */}
                    <section className="space-y-3">
                        <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0
                                ${selectedPlanId ? "bg-blue-600 text-white" : "bg-blue-600 text-white ring-4 ring-blue-100"}`}>
                                {selectedPlanId ? <CheckCircle2 className="h-3.5 w-3.5" /> : "1"}
                            </div>
                            <h3 className="text-sm font-semibold text-slate-700">Plan / Malla curricular</h3>
                        </div>
                        <div className="pl-8">
                            {plans.length === 0 ? <p className="text-sm text-slate-400">Cargando planes...</p> : (
                                <div className="space-y-5">
                                    {careerKeys.map((career) => (
                                        <div key={career}>
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{career}</span>
                                                <div className="h-px flex-1 bg-slate-200" />
                                                <span className="text-[10px] text-slate-300">{plansByCareer[career].length} plan{plansByCareer[career].length > 1 ? "es" : ""}</span>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                                                {plansByCareer[career].map((p) => {
                                                    const isSel = String(p.id) === String(selectedPlanId);
                                                    return (
                                                        <button key={p.id} type="button"
                                                            onClick={() => { if (!isSel) { setSelectedPlanId(String(p.id)); setSelectedCourseId(""); setTeacherId(""); setRoomId(""); setSlots([]); } }}
                                                            className={`text-left px-3 py-2 rounded-xl border transition-all
                                                                ${isSel ? "border-blue-500 bg-blue-50 ring-1 ring-blue-400" : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/40"}`}>
                                                            <div className="flex items-center justify-between gap-2">
                                                                <div className="min-w-0">
                                                                    <div className="text-sm font-semibold text-slate-800 truncate">{p.name}</div>
                                                                    {p.start_year && <div className="text-[11px] text-slate-400 mt-0.5">Desde {p.start_year}</div>}
                                                                </div>
                                                                {isSel && <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />}
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>

                    {/* PASO 2: CURSO */}
                    {selectedPlanId && (
                        <section className="space-y-3">
                            <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0
                                    ${selectedCourseId ? "bg-blue-600 text-white" : "bg-blue-600 text-white ring-4 ring-blue-100"}`}>
                                    {selectedCourseId ? <CheckCircle2 className="h-3.5 w-3.5" /> : "2"}
                                </div>
                                <h3 className="text-sm font-semibold text-slate-700">Curso</h3>
                                <span className="text-xs text-slate-400 ml-1">— {planCourses.length} en este plan</span>
                            </div>
                            <div className="pl-8 space-y-2">
                                <div className="relative">
                                    <BookOpen className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                    <Input value={courseSearch} onChange={(e) => setCourseSearch(e.target.value)}
                                        placeholder="Buscar por código o nombre..." className="pl-8 text-sm h-9" />
                                </div>
                                <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/40 p-3 space-y-4">
                                    {planCourses.length === 0 ? (
                                        <p className="text-sm text-slate-400 text-center py-3">Cargando cursos...</p>
                                    ) : filteredCourses.length === 0 ? (
                                        <p className="text-sm text-slate-400 text-center py-3">Sin resultados</p>
                                    ) : semKeys.map((sem) => (
                                        <div key={sem}>
                                            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 px-1">
                                                {sem === "Sin semestre" ? "Sin semestre" : `Semestre ${sem}`}
                                            </div>
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-1.5">
                                                {coursesBySemester[sem].map((course) => (
                                                    <CourseCard key={course.id} course={course}
                                                        selected={String(course.id) === String(selectedCourseId)}
                                                        onClick={() => { setSelectedCourseId(String(course.id)); setCourseSearch(""); }} />
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {selectedCourse && (
                                    <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-xl border border-blue-200 text-sm">
                                        <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
                                        <span className="text-blue-700 font-medium truncate">{selectedCourse.code} — {selectedCourse.name}</span>
                                        {selectedCourse.credits && (
                                            <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs ml-auto shrink-0">{selectedCourse.credits} cr.</Badge>
                                        )}
                                    </div>
                                )}
                            </div>
                        </section>
                    )}

                    {/* PASO 3: ASIGNACIÓN */}
                    {selectedCourseId && (
                        <section className="space-y-3">
                            <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0
                                    ${teacherId && roomId ? "bg-blue-600 text-white" : "bg-blue-600 text-white ring-4 ring-blue-100"}`}>
                                    {teacherId && roomId ? <CheckCircle2 className="h-3.5 w-3.5" /> : "3"}
                                </div>
                                <h3 className="text-sm font-semibold text-slate-700">Asignación</h3>
                            </div>

                            <div className="pl-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {/* Etiqueta */}
                                <div>
                                    <Label className="text-xs text-slate-500 font-medium">Etiqueta</Label>
                                    <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="A, B…" maxLength={5} className="mt-1 h-9" />
                                </div>
                                {/* Capacidad */}
                                <div>
                                    <Label className="text-xs text-slate-500 font-medium">Capacidad</Label>
                                    <Input type="number" min="1" value={capacity} onChange={(e) => setCapacity(+e.target.value || 1)} className="mt-1 h-9" />
                                </div>

                                {/* ✅ Docente con botón Refresh */}
                                <div className="col-span-2 sm:col-span-2">
                                    <div className="flex items-center justify-between mb-1">
                                        <Label className="text-xs text-slate-500 font-medium flex items-center gap-1">
                                            <User className="h-3 w-3" /> Docente *
                                        </Label>
                                        <button type="button" onClick={refreshTeachers} disabled={loadingTeachers}
                                            title="Recargar lista de docentes"
                                            className="flex items-center gap-1 text-[11px] text-blue-500 hover:text-blue-700 disabled:opacity-50 transition-colors">
                                            <RefreshCw className={`h-3 w-3 ${loadingTeachers ? "animate-spin" : ""}`} />
                                            Actualizar
                                        </button>
                                    </div>
                                    <Select value={teacherId ? String(teacherId) : "__n__"} onValueChange={(v) => setTeacherId(v === "__n__" ? "" : Number(v))}>
                                        <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar docente" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__n__">— Seleccionar —</SelectItem>
                                            {teachers.map((t) => (
                                                <SelectItem key={t.id} value={String(t.id)}>{teacherLabel(t)}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {teachers.length === 0 && !loadingTeachers && (
                                        <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1">
                                            <AlertCircle className="h-3 w-3" />
                                            Sin docentes. ¿Registraste uno nuevo? Presiona "Actualizar".
                                        </p>
                                    )}
                                </div>

                                {/* ✅ Aula con roomLabel() — sin duplicar */}
                                <div className="col-span-2 sm:col-span-2">
                                    <Label className="text-xs text-slate-500 font-medium flex items-center gap-1">
                                        <Building2 className="h-3 w-3" /> Aula *
                                    </Label>
                                    <Select value={roomId ? String(roomId) : "__n__"} onValueChange={(v) => setRoomId(v === "__n__" ? "" : Number(v))}>
                                        <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="Seleccionar aula" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__n__">— Seleccionar —</SelectItem>
                                            {rooms.map((r) => (
                                                <SelectItem key={r.id} value={String(r.id)}>{roomLabel(r)}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* PASO 4: HORARIO */}
                    {selectedCourseId && (
                        <section className="space-y-3">
                            <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0
                                    ${slots.length > 0 ? "bg-blue-600 text-white" : "bg-blue-600 text-white ring-4 ring-blue-100"}`}>
                                    {slots.length > 0 ? <CheckCircle2 className="h-3.5 w-3.5" /> : "4"}
                                </div>
                                <h3 className="text-sm font-semibold text-slate-700">Franjas horarias</h3>
                                {slots.length > 0 && (
                                    <span className="text-xs text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
                                        {slots.length} franja{slots.length > 1 ? "s" : ""}
                                    </span>
                                )}
                            </div>
                            <div className="pl-8 space-y-3">
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
                                        <div>
                                            <Label className="text-xs text-slate-500">Día</Label>
                                            <Select value={newSlot.day} onValueChange={(v) => setNewSlot((s) => ({ ...s, day: v }))}>
                                                <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                                                <SelectContent>{DAYS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label className="text-xs text-slate-500">Inicio</Label>
                                            <Input type="time" value={newSlot.start} onChange={(e) => setNewSlot((s) => ({ ...s, start: e.target.value }))} className="mt-1 h-9" />
                                        </div>
                                        <div>
                                            <Label className="text-xs text-slate-500">Fin</Label>
                                            <Input type="time" value={newSlot.end} onChange={(e) => setNewSlot((s) => ({ ...s, end: e.target.value }))} className="mt-1 h-9" />
                                        </div>
                                        <Button onClick={addSlot} size="sm" className="gap-1.5 h-9 mt-1 w-full"><Plus className="h-3.5 w-3.5" /> Agregar</Button>
                                    </div>
                                </div>
                                {slots.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {slots.map((s, i) => (
                                            <div key={i} className="flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium">
                                                <Clock className="h-3 w-3 text-blue-400" />
                                                <span className="font-semibold">{DAY_SHORT[s.day] ?? s.day}</span>
                                                <span className="text-blue-500">{s.start}–{s.end}</span>
                                                <button type="button" onClick={() => { setSlots((p) => p.filter((_, j) => j !== i)); setConflicts([]); }}
                                                    className="ml-0.5 p-0.5 rounded-full hover:bg-blue-200 transition-colors">
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {conflicts.length > 0 && (
                                    <div className="p-3 rounded-xl bg-red-50 border border-red-200 space-y-1.5">
                                        <div className="flex items-center gap-1.5 text-red-700 text-xs font-semibold">
                                            <AlertCircle className="h-3.5 w-3.5" />
                                            {conflicts.length} conflicto{conflicts.length > 1 ? "s" : ""} detectado{conflicts.length > 1 ? "s" : ""}
                                        </div>
                                        {conflicts.map((c, i) => (
                                            <div key={i} className="text-xs text-red-600 pl-5 flex items-center gap-1.5">
                                                <span>·</span> {c.message}
                                                {c.type && (
                                                    <Badge variant="outline" className="text-[10px] rounded-full border-red-300 text-red-500 ml-1">
                                                        {c.type === "teacher" ? "Docente" : c.type === "classroom" ? "Aula" : c.type}
                                                    </Badge>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </section>
                    )}

                    {/* RESUMEN + BOTONES */}
                    {selectedCourseId && (
                        <div className="border-t border-slate-100 pt-5 space-y-3">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                                <div>
                                    <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Curso</div>
                                    <div className="text-xs font-semibold text-slate-700 truncate mt-0.5">{selectedCourse?.code} · Sec. {label}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Capacidad</div>
                                    <div className="text-xs font-semibold text-slate-700 mt-0.5">{capacity} alumnos</div>
                                </div>
                                <div>
                                    <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Docente</div>
                                    <div className="text-xs font-semibold mt-0.5 truncate">
                                        {selectedTeacher
                                            ? <span className="text-slate-700">{teacherLabel(selectedTeacher).split(" ").slice(-2).join(" ")}</span>
                                            : <span className="text-amber-500">Sin asignar</span>}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Horario</div>
                                    <div className="text-xs font-semibold mt-0.5">
                                        {slots.length
                                            ? <span className="text-slate-700">{slots.map((s) => `${DAY_SHORT[s.day]} ${s.start}`).join(" · ")}</span>
                                            : <span className="text-amber-500">Sin franjas</span>}
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <Button variant="outline" onClick={check} disabled={!slots.length} className="flex-1 gap-2">
                                    <AlertCircle className="h-4 w-4" /> Verificar conflictos
                                </Button>
                                <Button onClick={createSection} disabled={!selectedCourseId || !teacherId || !roomId || !slots.length}
                                    className="flex-1 gap-2 bg-blue-600 hover:bg-blue-700">
                                    <Save className="h-4 w-4" /> Crear sección
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Tabla secciones */}
            <Card className="rounded-2xl shadow-sm">
                <CardHeader className="px-6 pt-5 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg"><CalendarDays className="h-4 w-4 text-blue-600" /></div>
                        <CardTitle className="text-base text-slate-800">Secciones</CardTitle>
                        <Badge className="bg-blue-100 text-blue-700 border border-blue-200 text-xs">{activePeriod}</Badge>
                        <Badge variant="outline" className="text-slate-400 text-xs ml-auto">{sections.length} sección{sections.length !== 1 ? "es" : ""}</Badge>
                    </div>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                    {sections.length === 0
                        ? <div className="text-center py-10 text-slate-400">Sin secciones en {activePeriod}</div>
                        : <SectionsGroupedTable sections={sections}
                            onDelete={(s) => { setDeleteTarget(s); setDeleteOpen(true); }}
                            onEdit={openEditSection} />}
                </CardContent>
            </Card>

            {/* Dialog eliminar */}
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogContent className="sm:max-w-[440px]">
                    <DialogHeader>
                        <DialogTitle className="text-red-600 flex items-center gap-2"><Trash2 className="h-4 w-4" /> Eliminar sección</DialogTitle>
                        <DialogDescription>
                            ¿Confirmas eliminar <strong>{deleteTarget?.course_code} — {deleteTarget?.course_name}</strong>
                            {deleteTarget?.label ? ` (sec. ${deleteTarget.label})` : ""}?
                            <br /><br />Esta acción no se puede deshacer.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>Cancelar</Button>
                        <Button variant="destructive" onClick={confirmDeleteSection} disabled={deleting}>
                            {deleting ? "Eliminando..." : "Eliminar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog editar */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-blue-700 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                            Editar sección
                        </DialogTitle>
                        <DialogDescription>
                            <span className="font-medium text-slate-700">{editTarget?.course_code} — {editTarget?.course_name}</span>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs text-slate-500 font-medium">Etiqueta (Sec.)</Label>
                                <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} className="mt-1 h-9" placeholder="A, B, C…" />
                            </div>
                            <div>
                                <Label className="text-xs text-slate-500 font-medium">Capacidad</Label>
                                <Input type="number" min={1} max={200} value={editCapacity} onChange={(e) => setEditCapacity(+e.target.value || 1)} className="mt-1 h-9" />
                            </div>
                        </div>

                        {/* ✅ Docente en edición con Refresh */}
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <Label className="text-xs text-slate-500 font-medium flex items-center gap-1">
                                    <User className="h-3 w-3" /> Docente *
                                </Label>
                                <button type="button" onClick={refreshTeachers} disabled={loadingTeachers}
                                    title="Recargar lista de docentes"
                                    className="flex items-center gap-1 text-[11px] text-blue-500 hover:text-blue-700 disabled:opacity-50 transition-colors">
                                    <RefreshCw className={`h-3 w-3 ${loadingTeachers ? "animate-spin" : ""}`} />
                                    Actualizar
                                </button>
                            </div>
                            <Select value={editTeacherId || "__n__"} onValueChange={(v) => setEditTeacherId(v === "__n__" ? "" : v)}>
                                <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar docente" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__n__">— Seleccionar —</SelectItem>
                                    {teachers.map((t) => (
                                        <SelectItem key={t.id} value={String(t.id)}>{teacherLabel(t)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* ✅ Aula con roomLabel() */}
                        <div>
                            <Label className="text-xs text-slate-500 font-medium flex items-center gap-1">
                                <Building2 className="h-3 w-3" /> Aula *
                            </Label>
                            <Select value={editRoomId || "__n__"} onValueChange={(v) => setEditRoomId(v === "__n__" ? "" : v)}>
                                <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="Seleccionar aula" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__n__">— Seleccionar —</SelectItem>
                                    {rooms.map((r) => (
                                        <SelectItem key={r.id} value={String(r.id)}>{roomLabel(r)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Franjas */}
                        <div>
                            <Label className="text-xs text-slate-500 font-medium flex items-center gap-1">
                                <Clock className="h-3 w-3" /> Franjas horarias
                            </Label>
                            <div className="mt-2 space-y-1">
                                {editSlots.length === 0 && <p className="text-xs text-slate-400 italic">Sin franjas configuradas</p>}
                                {editSlots.map((sl, i) => (
                                    <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-1.5 border border-slate-200">
                                        <span className="text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                                            {DAY_SHORT[sl.day] ?? sl.day}
                                        </span>
                                        <span className="text-xs text-slate-600 flex-1">{sl.start} – {sl.end}</span>
                                        <button type="button" onClick={() => setEditSlots((p) => p.filter((_, j) => j !== i))}
                                            className="text-red-400 hover:text-red-600 text-[11px] px-1">✕</button>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                                <div className="grid grid-cols-4 gap-2 items-end">
                                    <div>
                                        <Label className="text-[11px] text-slate-500">Día</Label>
                                        <Select value={editNewSlot.day} onValueChange={(v) => setEditNewSlot((s) => ({ ...s, day: v }))}>
                                            <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent>{Object.entries(DAY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label className="text-[11px] text-slate-500">Inicio</Label>
                                        <Input type="time" value={editNewSlot.start} onChange={(e) => setEditNewSlot((s) => ({ ...s, start: e.target.value }))} className="mt-1 h-8 text-xs" />
                                    </div>
                                    <div>
                                        <Label className="text-[11px] text-slate-500">Fin</Label>
                                        <Input type="time" value={editNewSlot.end} onChange={(e) => setEditNewSlot((s) => ({ ...s, end: e.target.value }))} className="mt-1 h-8 text-xs" />
                                    </div>
                                    <Button type="button" size="sm" onClick={addEditSlot} className="h-8 gap-1 bg-blue-600 hover:bg-blue-700"><Plus className="h-3.5 w-3.5" /></Button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="gap-2 pt-2">
                        <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>Cancelar</Button>
                        <Button onClick={updateSection} disabled={saving || !editTeacherId || !editRoomId}
                            className="gap-2 bg-blue-600 hover:bg-blue-700">
                            <Save className="h-4 w-4" />
                            {saving ? "Guardando..." : "Guardar cambios"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}