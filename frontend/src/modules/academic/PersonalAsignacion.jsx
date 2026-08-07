// PersonalAsignacion.jsx — Asignación de Personal estilo SIAGIE
// ───────────────────────────────────────────────────────────────
// 4 pasos como el SIAGIE (Administración IE > Asignación de Personal):
//   1. Listar Personal      → directorio de docentes (TeachersSection)
//   2. Asignación de Áreas  → matriz docentes × cursos (checkbox por curso)
//   3. Horario              → franjas semanales por plan/ciclo (agrega/quita)
//   4. Reportes             → horario por docente / por sección + imprimir
//
// Reusa el backend existente: Sections (create/patch/setSchedule/conflicts),
// Plans.listAllCourses, Sections.teachers. Una "área asignada" = Section del
// PlanCourse con ese docente en el período activo.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Users, LayoutGrid, Clock, Printer, CalendarDays, RotateCw,
    Trash2, Plus, Loader2, CheckCircle2, Building2,
} from "lucide-react";
import { toast } from "sonner";
import { Plans, Sections } from "@/services/academic.service";
import { TeachersSection } from "./AcademicCatalogs";
import { CampusesSection } from "../admin/ConfigCatalogsModule";
import { useActivePeriod } from "@/hooks/useActivePeriod";

/* ───────────────────────── helpers ───────────────────────── */

const DAYS = [
    { key: "MON", label: "LUNES" },
    { key: "TUE", label: "MARTES" },
    { key: "WED", label: "MIÉRCOLES" },
    { key: "THU", label: "JUEVES" },
    { key: "FRI", label: "VIERNES" },
    { key: "SAT", label: "SÁBADO" },
];
const DAY_LABEL = Object.fromEntries(DAYS.map((d) => [d.key, d.label]));

function getDefaultPeriod() {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() < 7 ? "I" : "II"}`;
}

function periodOptions() {
    const y = new Date().getFullYear();
    const out = [];
    for (let yy = y + 1; yy >= y - 6; yy--) out.push(`${yy}-II`, `${yy}-I`);
    return out;
}

const teacherLabel = (t) =>
    (t?.full_name || t?.name || `${t?.apellidos || ""} ${t?.nombres || ""}`).trim() || `Docente ${t?.id}`;

/* Paso SIAGIE (flecha) */
function StepTab({ active, onClick, children }) {
    return (
        <button
            onClick={onClick}
            className={`relative px-5 py-2.5 text-sm font-semibold transition-colors rounded-lg
                ${active ? "bg-blue-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
        >
            {children}
        </button>
    );
}

/* ───────────────────────── componente principal ───────────────────────── */

export default function PersonalAsignacion() {
    const [step, setStep] = useState("personal"); // personal | sedes | areas | horario | reportes
    // Período VIGENTE del sistema (Académico → Periodos), no el del calendario
    const { period, setPeriod } = useActivePeriod();

    /* datos compartidos */
    const [teachers, setTeachers] = useState([]);
    const [plans, setPlans] = useState([]);
    const [sections, setSections] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(false);

    const loadShared = useCallback(async () => {
        setLoading(true);
        try {
            const [t, pl, s, r] = await Promise.all([
                Sections.teachers(),
                Plans.list(),
                Sections.list({ period }),
                Sections.rooms(),
            ]);
            setTeachers(Array.isArray(t?.teachers) ? t.teachers : []);
            setPlans(Array.isArray(pl?.plans) ? pl.plans : Array.isArray(pl) ? pl : []);
            setSections(Array.isArray(s?.sections) ? s.sections : []);
            setRooms(Array.isArray(r?.classrooms) ? r.classrooms : Array.isArray(r?.items) ? r.items : []);
        } catch (e) {
            toast.error(e?.message || "Error al cargar datos de asignación");
        } finally {
            setLoading(false);
        }
    }, [period]);

    useEffect(() => { loadShared(); }, [loadShared]);

    const reloadSections = useCallback(async () => {
        try {
            const s = await Sections.list({ period });
            setSections(Array.isArray(s?.sections) ? s.sections : []);
        } catch { /* silencioso */ }
    }, [period]);

    return (
        <div className="space-y-5 fade-in">
            {/* Banner de período */}
            <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-r from-blue-700 to-blue-600 px-5 py-4 shadow">
                <div className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center">
                    <CalendarDays className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-blue-100 uppercase tracking-widest">Asignación de Personal</p>
                    <p className="text-lg font-bold text-white leading-tight">Período {period}</p>
                </div>
                <div className="shrink-0 w-28">
                    <Select value={period} onValueChange={setPeriod}>
                        <SelectTrigger className="h-9 px-3 rounded-xl border-0 bg-white/20 text-white text-sm focus:ring-0 focus:ring-offset-0 w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent align="end">
                            {periodOptions().map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <Button variant="secondary" size="sm" className="gap-1.5" onClick={loadShared} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
                    Actualizar
                </Button>
            </div>

            {/* Pasos estilo SIAGIE */}
            <div className="flex flex-wrap gap-2">
                <StepTab active={step === "personal"} onClick={() => setStep("personal")}>
                    <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" /> Listar Personal</span>
                </StepTab>
                <StepTab active={step === "sedes"} onClick={() => setStep("sedes")}>
                    <span className="inline-flex items-center gap-1.5"><Building2 className="h-4 w-4" /> Sedes &amp; Aulas</span>
                </StepTab>
                <StepTab active={step === "areas"} onClick={() => setStep("areas")}>
                    <span className="inline-flex items-center gap-1.5"><LayoutGrid className="h-4 w-4" /> Asignación de Áreas</span>
                </StepTab>
                <StepTab active={step === "horario"} onClick={() => setStep("horario")}>
                    <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4" /> Horario</span>
                </StepTab>
                <StepTab active={step === "reportes"} onClick={() => setStep("reportes")}>
                    <span className="inline-flex items-center gap-1.5"><Printer className="h-4 w-4" /> Reportes</span>
                </StepTab>
            </div>

            {step === "personal" && <TeachersSection />}
            {step === "sedes" && <CampusesSection />}
            {step === "areas" && (
                <AsignacionAreas
                    period={period} teachers={teachers} plans={plans}
                    sections={sections} onChanged={reloadSections}
                />
            )}
            {step === "horario" && (
                <HorarioTab
                    period={period} teachers={teachers} plans={plans} rooms={rooms}
                    sections={sections} onChanged={reloadSections}
                />
            )}
            {step === "reportes" && (
                <ReportesTab period={period} teachers={teachers} plans={plans} sections={sections} />
            )}
        </div>
    );
}

/* ───────────────── selector plan + ciclo (compartido) ───────────────── */

function usePlanCiclo(plans) {
    const [planId, setPlanId] = useState("");
    const [courses, setCourses] = useState([]);
    const [ciclo, setCiclo] = useState("");

    useEffect(() => {
        if (!planId) { setCourses([]); setCiclo(""); return; }
        Plans.listAllCourses(planId)
            .then((res) => {
                const cs = Array.isArray(res?.courses) ? res.courses : [];
                setCourses(cs);
                const sems = [...new Set(cs.map((c) => c.semester).filter(Boolean))].sort((a, b) => a - b);
                setCiclo(sems.length ? String(sems[0]) : "");
            })
            .catch(() => { toast.error("Error al cargar cursos del plan"); setCourses([]); });
    }, [planId]);

    const semesters = useMemo(
        () => [...new Set(courses.map((c) => c.semester).filter(Boolean))].sort((a, b) => a - b),
        [courses]
    );
    const cicloCourses = useMemo(
        () => courses.filter((c) => String(c.semester) === String(ciclo)),
        [courses, ciclo]
    );
    const plan = plans.find((p) => String(p.id) === String(planId));

    return { planId, setPlanId, plan, courses, semesters, ciclo, setCiclo, cicloCourses };
}

function PlanCicloSelects({ pc, plans }) {
    const plansByCareer = useMemo(() => {
        const acc = {};
        for (const p of plans) {
            const k = p.career_name || p.career || "Sin carrera";
            (acc[k] = acc[k] || []).push(p);
        }
        return acc;
    }, [plans]);

    return (
        <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[260px]">
                <p className="text-xs font-semibold text-slate-500 mb-1">Programa / Plan de estudios</p>
                <Select value={pc.planId} onValueChange={pc.setPlanId}>
                    <SelectTrigger className="bg-white"><SelectValue placeholder="— Selecciona un plan —" /></SelectTrigger>
                    <SelectContent>
                        {Object.keys(plansByCareer).sort().map((career) => (
                            <React.Fragment key={career}>
                                <div className="px-2 py-1 text-[10px] font-bold uppercase text-slate-400">{career}</div>
                                {plansByCareer[career].map((p) => (
                                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                                ))}
                            </React.Fragment>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="w-32">
                <p className="text-xs font-semibold text-slate-500 mb-1">Ciclo</p>
                <Select value={pc.ciclo} onValueChange={pc.setCiclo} disabled={!pc.semesters.length}>
                    <SelectTrigger className="bg-white"><SelectValue placeholder="Ciclo" /></SelectTrigger>
                    <SelectContent>
                        {pc.semesters.map((s) => <SelectItem key={s} value={String(s)}>Ciclo {s}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}

/* ═══════════════════ 2. ASIGNACIÓN DE ÁREAS ═══════════════════ */

function AsignacionAreas({ period, teachers, plans, sections, onChanged }) {
    const pc = usePlanCiclo(plans);
    const [busyCell, setBusyCell] = useState("");
    const [q, setQ] = useState("");

    // Sección existente por plan_course
    const secByCourse = useMemo(() => {
        const map = {};
        for (const s of sections) {
            if (s.plan_course_id && !map[s.plan_course_id]) map[s.plan_course_id] = s;
        }
        return map;
    }, [sections]);

    const visibleTeachers = useMemo(() => {
        const t = q.trim().toLowerCase();
        if (!t) return teachers;
        return teachers.filter((x) => teacherLabel(x).toLowerCase().includes(t));
    }, [teachers, q]);

    const toggle = async (teacher, course) => {
        const key = `${teacher.id}-${course.id}`;
        const sec = secByCourse[course.id];
        const isMine = sec && String(sec.teacher_id) === String(teacher.id);
        setBusyCell(key);
        try {
            if (isMine) {
                await Sections.patch(sec.id, { teacher_id: null });
                toast.success(`${course.name}: docente desasignado`);
            } else if (sec) {
                await Sections.patch(sec.id, { teacher_id: Number(teacher.id) });
                toast.success(`${course.name} → ${teacherLabel(teacher)}`);
            } else {
                await Sections.create({
                    course_id: course.id,
                    teacher_id: Number(teacher.id),
                    period,
                    label: "A",
                    capacity: 30,
                    slots: [],
                });
                toast.success(`${course.name} → ${teacherLabel(teacher)} (sección creada)`);
            }
            await onChanged();
        } catch (e) {
            toast.error(e?.response?.data?.detail || e?.message || "Error al asignar");
        } finally {
            setBusyCell("");
        }
    };

    return (
        <Card className="border shadow-sm rounded-2xl">
            <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                    <LayoutGrid className="h-4 w-4 text-blue-600" /> Asignación de Áreas — {period}
                </CardTitle>
                <p className="text-xs text-slate-500">
                    Marca la casilla para asignar el curso (área) al docente. Si el curso no tiene
                    sección en el período, se crea automáticamente (sección A). El horario se define en el paso 3.
                </p>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-wrap items-end gap-3">
                    <PlanCicloSelects pc={pc} plans={plans} />
                    <div className="flex-1 min-w-[200px]">
                        <p className="text-xs font-semibold text-slate-500 mb-1">Buscar docente</p>
                        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Apellidos o nombres…" className="bg-white" />
                    </div>
                </div>

                {!pc.planId ? (
                    <div className="text-center py-10 text-slate-400 text-sm">Selecciona un plan de estudios para ver la matriz.</div>
                ) : !pc.cicloCourses.length ? (
                    <div className="text-center py-10 text-slate-400 text-sm">El ciclo seleccionado no tiene cursos.</div>
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="min-w-full text-xs">
                            <thead>
                                <tr className="bg-slate-800 text-white">
                                    <th className="sticky left-0 bg-slate-800 px-3 py-2 text-left font-semibold min-w-[220px]">
                                        Apellidos y Nombres
                                    </th>
                                    {pc.cicloCourses.map((c) => (
                                        <th key={c.id} className="px-2 py-2 font-semibold text-center min-w-[110px] max-w-[130px]">
                                            <span className="block leading-tight whitespace-normal">{c.name}</span>
                                            <span className="block text-[9px] font-normal text-slate-300 mt-0.5">{c.code}</span>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {visibleTeachers.map((t, i) => (
                                    <tr key={t.id} className={i % 2 ? "bg-slate-50" : "bg-white"}>
                                        <td className="sticky left-0 px-3 py-2 font-medium text-slate-700 bg-inherit border-r border-slate-200">
                                            {teacherLabel(t)}
                                        </td>
                                        {pc.cicloCourses.map((c) => {
                                            const sec = secByCourse[c.id];
                                            const mine = sec && String(sec.teacher_id) === String(t.id);
                                            const other = sec && sec.teacher_id && !mine;
                                            const key = `${t.id}-${c.id}`;
                                            return (
                                                <td key={c.id} className="px-2 py-2 text-center">
                                                    {busyCell === key ? (
                                                        <Loader2 className="h-4 w-4 mx-auto animate-spin text-blue-500" />
                                                    ) : (
                                                        <button
                                                            onClick={() => toggle(t, c)}
                                                            title={other ? `Asignado a: ${sec.teacher_name} (clic para reasignar)` : mine ? "Clic para desasignar" : "Clic para asignar"}
                                                            className={`h-5 w-5 rounded border inline-flex items-center justify-center transition-colors
                                                                ${mine ? "bg-emerald-500 border-emerald-600" :
                                                                    other ? "bg-amber-100 border-amber-300" :
                                                                        "bg-white border-slate-300 hover:border-blue-400"}`}
                                                        >
                                                            {mine && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                                                        </button>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="flex flex-wrap gap-4 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded bg-emerald-500 inline-block" /> Asignado a este docente</span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded bg-amber-100 border border-amber-300 inline-block" /> Asignado a otro docente</span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded bg-white border border-slate-300 inline-block" /> Sin asignar</span>
                </div>
            </CardContent>
        </Card>
    );
}

/* ═══════════════════ 3. HORARIO ═══════════════════ */

const TURNOS = [
    { key: "TODOS", label: "Todos" },
    { key: "M", label: "Mañana", desde: "06:00", hasta: "13:00", defStart: "08:00", defEnd: "09:30" },
    { key: "T", label: "Tarde",  desde: "13:00", hasta: "18:00", defStart: "13:00", defEnd: "14:30" },
    { key: "N", label: "Noche",  desde: "18:00", hasta: "23:00", defStart: "18:00", defEnd: "19:30" },
];

function HorarioTab({ period, teachers, plans, rooms, sections, onChanged }) {
    const pc = usePlanCiclo(plans);
    const [secId, setSecId] = useState("");
    const [day, setDay] = useState("MON");
    const [start, setStart] = useState("08:00");
    const [end, setEnd] = useState("09:30");
    const [roomId, setRoomId] = useState("");
    const [saving, setSaving] = useState(false);
    const [turno, setTurno] = useState("TODOS");

    const cambiarTurno = (t) => {
        setTurno(t);
        const def = TURNOS.find((x) => x.key === t);
        if (def?.defStart) { setStart(def.defStart); setEnd(def.defEnd); }
    };

    const enTurno = (sl) => {
        if (turno === "TODOS") return true;
        const t = TURNOS.find((x) => x.key === turno);
        return t ? (sl.start || "") >= t.desde && (sl.start || "") < t.hasta : true;
    };

    // Secciones del plan + ciclo elegidos
    const cicloSections = useMemo(() => {
        if (!pc.planId) return [];
        return sections.filter(
            (s) => String(s.plan_id) === String(pc.planId) &&
                (!pc.ciclo || String(s.semester) === String(pc.ciclo))
        );
    }, [sections, pc.planId, pc.ciclo]);

    // Solo aulas del catálogo Sedes & Aulas (id numérico); las huérfanas
    // legacy ("acad_N") no son asignables desde aquí.
    const selectableRooms = useMemo(
        () => rooms.filter((r) => /^\d+$/.test(String(r.id))),
        [rooms]
    );

    const selectedSec = cicloSections.find((s) => String(s.id) === String(secId));

    useEffect(() => {
        setSecId("");
    }, [pc.planId, pc.ciclo]);

    useEffect(() => {
        setRoomId(selectedSec?.room_id ? String(selectedSec.room_id) : "");
    }, [secId]);   // eslint-disable-line react-hooks/exhaustive-deps

    const addSlot = async () => {
        if (!selectedSec) return toast.error("Selecciona el curso (sección)");
        if (!start || !end || start >= end) return toast.error("Rango de horas inválido");
        const current = Array.isArray(selectedSec.slots) ? selectedSec.slots : [];
        const nuevo = { day, start, end };
        if (current.some((s) => s.day === day && s.start === start && s.end === end))
            return toast.error("Esa franja ya existe");
        setSaving(true);
        try {
            const res = await Sections.checkConflicts({
                teacher_id: selectedSec.teacher_id || null,
                room_id: roomId ? Number(roomId) : null,
                period, slots: [nuevo],
                exclude_section_id: selectedSec.id,
            });
            const conf = Array.isArray(res?.conflicts) ? res.conflicts : [];
            if (conf.length) {
                toast.error(`Conflicto: ${conf[0]?.detail || conf[0]?.message || "cruce de horario"}`);
                return;
            }
            if (roomId && String(selectedSec.room_id) !== String(roomId)) {
                const room = selectableRooms.find((r) => String(r.id) === String(roomId));
                const patch = { room_id: Number(roomId) };
                // Ajustar capacidad de la sección a la del aula (Sedes & Aulas)
                if (room?.capacity && Number(selectedSec.capacity) > Number(room.capacity)) {
                    patch.capacity = Number(room.capacity);
                }
                await Sections.patch(selectedSec.id, patch);
            }
            await Sections.setSchedule(selectedSec.id, [...current, nuevo]);
            toast.success("Franja agregada al horario");
            await onChanged();
        } catch (e) {
            toast.error(e?.response?.data?.detail || e?.message || "Error al guardar franja");
        } finally {
            setSaving(false);
        }
    };

    const removeSlot = async (sec, slot) => {
        const rest = (sec.slots || []).filter(
            (s) => !(s.day === slot.day && s.start === slot.start && s.end === slot.end)
        );
        try {
            await Sections.setSchedule(sec.id, rest);
            toast.success("Franja eliminada");
            await onChanged();
        } catch (e) {
            toast.error(e?.message || "Error al eliminar franja");
        }
    };

    return (
        <Card className="border shadow-sm rounded-2xl">
            <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-600" /> Horario — {period}
                </CardTitle>
                <p className="text-xs text-slate-500">
                    Agrega franjas semanales a los cursos asignados en el paso 2. El sistema
                    verifica cruces de horario del docente y del aula antes de guardar.
                </p>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-wrap items-end gap-3">
                    <PlanCicloSelects pc={pc} plans={plans} />
                    <div className="w-36">
                        <p className="text-xs font-semibold text-slate-500 mb-1">Turno</p>
                        <Select value={turno} onValueChange={cambiarTurno}>
                            <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {TURNOS.map((t) => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {pc.planId && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                        <p className="text-xs font-bold text-slate-600 uppercase">Agregar franja</p>
                        <div className="flex flex-wrap items-end gap-3">
                            <div className="min-w-[240px]">
                                <p className="text-xs font-semibold text-slate-500 mb-1">Curso (sección)</p>
                                <Select value={secId} onValueChange={setSecId}>
                                    <SelectTrigger className="bg-white"><SelectValue placeholder="— Curso —" /></SelectTrigger>
                                    <SelectContent>
                                        {cicloSections.map((s) => (
                                            <SelectItem key={s.id} value={String(s.id)}>
                                                {s.course_name} · {s.label || "A"}{s.teacher_name ? ` · ${s.teacher_name}` : " · (sin docente)"}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="w-36">
                                <p className="text-xs font-semibold text-slate-500 mb-1">Día</p>
                                <Select value={day} onValueChange={setDay}>
                                    <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {DAYS.map((d) => <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="w-28">
                                <p className="text-xs font-semibold text-slate-500 mb-1">Inicio</p>
                                <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="bg-white" />
                            </div>
                            <div className="w-28">
                                <p className="text-xs font-semibold text-slate-500 mb-1">Fin</p>
                                <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="bg-white" />
                            </div>
                            <div className="min-w-[160px]">
                                <p className="text-xs font-semibold text-slate-500 mb-1">Aula (opcional)</p>
                                <Select value={roomId} onValueChange={setRoomId}>
                                    <SelectTrigger className="bg-white"><SelectValue placeholder="— Aula —" /></SelectTrigger>
                                    <SelectContent>
                                        {selectableRooms.map((r) => (
                                            <SelectItem key={r.id} value={String(r.id)}>
                                                {r.display_label || r.code || r.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-[10px] text-slate-400 mt-1">Se administran en Sedes &amp; Aulas</p>
                            </div>
                            <Button onClick={addSlot} disabled={saving || !secId} className="gap-1.5">
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                Agregar
                            </Button>
                        </div>
                    </div>
                )}

                {/* Grilla semanal */}
                {pc.planId && (
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="min-w-full text-xs">
                            <thead>
                                <tr className="bg-slate-800 text-white">
                                    {DAYS.map((d) => (
                                        <th key={d.key} className="px-3 py-2 font-semibold text-center min-w-[150px]">{d.label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="align-top">
                                    {DAYS.map((d) => {
                                        const dia = [];
                                        for (const s of cicloSections) {
                                            for (const sl of (s.slots || [])) {
                                                if (sl.day === d.key && enTurno(sl)) dia.push({ sec: s, sl });
                                            }
                                        }
                                        dia.sort((a, b) => (a.sl.start || "").localeCompare(b.sl.start || ""));
                                        return (
                                            <td key={d.key} className="px-2 py-2 space-y-1.5 bg-white">
                                                {dia.length === 0 && (
                                                    <p className="text-center text-slate-300 py-4">—</p>
                                                )}
                                                {dia.map(({ sec, sl }, i) => (
                                                    <div key={i} className="rounded-lg bg-sky-100 border border-sky-200 px-2 py-1.5 relative group">
                                                        <p className="font-bold text-sky-900 leading-tight">{sec.course_name}</p>
                                                        <p className="text-[10px] text-sky-700">{sl.start} – {sl.end}</p>
                                                        <p className="text-[10px] text-sky-700 truncate">{sec.teacher_name || "(sin docente)"}</p>
                                                        {sec.room_name && <p className="text-[10px] text-sky-600">{sec.room_name}</p>}
                                                        <button
                                                            onClick={() => removeSlot(sec, sl)}
                                                            title="Quitar franja"
                                                            className="absolute -top-1.5 -right-1.5 hidden group-hover:flex h-5 w-5 rounded-full bg-red-500 text-white items-center justify-center"
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </td>
                                        );
                                    })}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

/* ═══════════════════ 4. REPORTES ═══════════════════ */

function ReportesTab({ period, teachers, plans, sections }) {
    const [mode, setMode] = useState("docente"); // docente | seccion
    const [teacherId, setTeacherId] = useState("");
    const pc = usePlanCiclo(plans);

    const rows = useMemo(() => {
        let secs = [];
        if (mode === "docente") {
            if (!teacherId) return [];
            secs = sections.filter((s) => String(s.teacher_id) === String(teacherId));
        } else {
            if (!pc.planId) return [];
            secs = sections.filter(
                (s) => String(s.plan_id) === String(pc.planId) &&
                    (!pc.ciclo || String(s.semester) === String(pc.ciclo))
            );
        }
        const out = [];
        for (const s of secs) {
            for (const sl of (s.slots || [])) {
                out.push({
                    day: sl.day, start: sl.start, end: sl.end,
                    curso: s.course_name, docente: s.teacher_name || "—",
                    aula: s.room_name || "—", label: s.label || "A", ciclo: s.semester,
                });
            }
        }
        out.sort((a, b) =>
            DAYS.findIndex((d) => d.key === a.day) - DAYS.findIndex((d) => d.key === b.day) ||
            (a.start || "").localeCompare(b.start || "")
        );
        return out;
    }, [mode, teacherId, pc.planId, pc.ciclo, sections]);

    const titulo = mode === "docente"
        ? `Horario por Docente — ${teacherLabel(teachers.find((t) => String(t.id) === String(teacherId)) || {})}`
        : `Horario por Sección — ${pc.plan?.name || ""} · Ciclo ${pc.ciclo || "—"}`;

    const imprimir = () => {
        if (!rows.length) return toast.error("No hay franjas para imprimir");
        const filas = rows.map((r) => `
            <tr>
                <td>${DAY_LABEL[r.day] || r.day}</td><td>${r.start} – ${r.end}</td>
                <td>${r.curso}</td><td>Ciclo ${r.ciclo ?? "—"} · ${r.label}</td>
                <td>${r.docente}</td><td>${r.aula}</td>
            </tr>`).join("");
        const w = window.open("", "_blank");
        w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${titulo}</title>
            <style>
                body{font-family:Arial,sans-serif;margin:32px;color:#111}
                h1{font-size:16px} h2{font-size:12px;color:#555;font-weight:normal}
                table{border-collapse:collapse;width:100%;margin-top:14px;font-size:11px}
                th,td{border:1px solid #999;padding:5px 8px;text-align:left}
                th{background:#1e6bb8;color:#fff}
            </style></head><body>
            <h1>${titulo}</h1><h2>Período ${period} · IESPP "Gustavo Allende Llavería"</h2>
            <table><thead><tr><th>Día</th><th>Hora</th><th>Curso</th><th>Sección</th><th>Docente</th><th>Aula</th></tr></thead>
            <tbody>${filas}</tbody></table>
            <script>window.print()</script></body></html>`);
        w.document.close();
    };

    return (
        <Card className="border shadow-sm rounded-2xl">
            <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                    <Printer className="h-4 w-4 text-blue-600" /> Reportes — {period}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="w-52">
                        <p className="text-xs font-semibold text-slate-500 mb-1">Tipo de reporte</p>
                        <Select value={mode} onValueChange={setMode}>
                            <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="docente">Horario por Docente</SelectItem>
                                <SelectItem value="seccion">Horario por Sección</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {mode === "docente" ? (
                        <div className="min-w-[260px]">
                            <p className="text-xs font-semibold text-slate-500 mb-1">Docente</p>
                            <Select value={teacherId} onValueChange={setTeacherId}>
                                <SelectTrigger className="bg-white"><SelectValue placeholder="— Selecciona docente —" /></SelectTrigger>
                                <SelectContent>
                                    {teachers.map((t) => (
                                        <SelectItem key={t.id} value={String(t.id)}>{teacherLabel(t)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    ) : (
                        <PlanCicloSelects pc={pc} plans={plans} />
                    )}
                    <Button onClick={imprimir} variant="outline" className="gap-1.5" disabled={!rows.length}>
                        <Printer className="h-4 w-4" /> Imprimir
                    </Button>
                </div>

                {rows.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 text-sm">
                        {mode === "docente" ? "Selecciona un docente con horario asignado." : "Selecciona plan y ciclo con horario asignado."}
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="min-w-full text-xs">
                            <thead>
                                <tr className="bg-slate-800 text-white">
                                    <th className="px-3 py-2 text-left font-semibold">Día</th>
                                    <th className="px-3 py-2 text-left font-semibold">Hora</th>
                                    <th className="px-3 py-2 text-left font-semibold">Curso</th>
                                    <th className="px-3 py-2 text-left font-semibold">Sección</th>
                                    <th className="px-3 py-2 text-left font-semibold">Docente</th>
                                    <th className="px-3 py-2 text-left font-semibold">Aula</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r, i) => (
                                    <tr key={i} className={i % 2 ? "bg-slate-50" : "bg-white"}>
                                        <td className="px-3 py-2 font-medium">{DAY_LABEL[r.day] || r.day}</td>
                                        <td className="px-3 py-2">{r.start} – {r.end}</td>
                                        <td className="px-3 py-2">{r.curso}</td>
                                        <td className="px-3 py-2"><Badge variant="outline">Ciclo {r.ciclo ?? "—"} · {r.label}</Badge></td>
                                        <td className="px-3 py-2">{r.docente}</td>
                                        <td className="px-3 py-2">{r.aula}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
