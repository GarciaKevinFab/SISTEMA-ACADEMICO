// AcademicModule.jsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import "./styles.css";

import { pageStyle } from "./styles";
import { useAuth } from "@/context/AuthContext";
import { PERMS } from "@/auth/permissions";
import IfPerm from "@/components/auth/IfPerm";

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
  Plus,
  Save,
  Calendar,
  Users,
  Clock,
  FileText,
  CheckCircle,
  Search as SearchIcon,
  BookOpen,
  GraduationCap,
  BarChart3,
  Inbox,
  LayoutGrid,
  ClipboardList,
  LibraryBig,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

// Utils
import { generatePDFWithPolling, downloadFile } from "@/utils/pdfQrPolling";

// ✅ Servicios (académico)
import {
  Careers,
  Plans,
  Sections,
  Kardex,
  Processes,
  AcademicReports,     // ✅ NUEVO
  ProcessesInbox,      // ✅ NUEVO
} from "@/services/academic.service";

// Catálogos
import { Teachers as CatalogTeachers, Classrooms as CatalogClassrooms } from "@/services/catalogs.service";

// Reutilizados
import EnrollmentComponent from "./EnrollmentComponent";
import GradesAttendanceComponent from "./GradesAttendanceComponent";
import SectionSyllabusEvaluation from "./SectionSyllabusEvaluation";
import AcademicProcessesInbox from "./AcademicProcessesInbox";
import AcademicReportsPage from "./AcademicReports";

/* ----------------------------- UI HELPERS ----------------------------- */
const sectionHeader = ({ title, description, Icon }) => (
  <div className="flex items-start justify-between">
    <div>
      <div className="flex items-center gap-2">
        {Icon ? <Icon className="h-5 w-5 text-[#2196F3]" /> : null}
        <CardTitle className="text-[#2196F3]">{title}</CardTitle>
      </div>
      {description ? <CardDescription className="mt-1 text-[#1976D2]">{description}</CardDescription> : null}
    </div>
  </div>
);

const REQS = {
  plans: [PERMS["academic.plans.view"], PERMS["academic.plans.edit"]],
  load: [PERMS["academic.sections.view"], PERMS["academic.sections.create"], PERMS["academic.sections.conflicts"]],
  enroll: [PERMS["academic.enrollment.view"], PERMS["academic.enrollment.commit"]],
  grades: [PERMS["academic.grades.edit"], PERMS["academic.grades.submit"]],
  syllabus: [PERMS["academic.syllabus.upload"], PERMS["academic.syllabus.delete"], PERMS["academic.evaluation.config"]],
  kardex: [PERMS["academic.kardex.view"]],
  reports: [PERMS["academic.reports.view"]],
  procInbox: [PERMS["academic.reports.view"]],
  processes: [PERMS["academic.reports.view"]],
};

/* ----------------------------- ACCIONES RÁPIDAS ----------------------------- */
/* ----------------------------- ACCIONES RÁPIDAS (SOLO RESPONSIVE) ----------------------------- */
function AcademicQuickActions({ go }) {
  const { hasAny } = useAuth();
  const [open, setOpen] = React.useState(false);

  const actions = [
    { key: "enroll", label: "Matrícula", Icon: GraduationCap, need: REQS.enroll },
    { key: "load", label: "Carga & Horarios", Icon: Calendar, need: REQS.load },
    { key: "plans", label: "Mallas/Planes", Icon: BookOpen, need: REQS.plans },
    { key: "grades", label: "Notas/Asistencia", Icon: CheckCircle, need: REQS.grades },
    { key: "syllabus", label: "Sílabos/Evaluación", Icon: FileText, need: REQS.syllabus },
    { key: "kardex", label: "Kárdex", Icon: Users, need: REQS.kardex },
    { key: "reports", label: "Reportes", Icon: BarChart3, need: REQS.reports },
    { key: "proc-inbox", label: "Bandeja procesos", Icon: Inbox, need: REQS.procInbox },
    { key: "processes", label: "Procesos", Icon: Clock, need: REQS.processes },
  ].filter((a) => hasAny(a.need));

  if (actions.length === 0) return null;

  const previewCount = 4;
  const hasMore = actions.length > previewCount;
  const visibleMobile = open ? actions : actions.slice(0, previewCount);

  return (
    <Card className="border-0 shadow-none">
      <CardContent className="px-0">
        <div className="sm:hidden flex items-center justify-between px-3 pt-2">
          <div className="text-sm font-semibold text-black">Acciones rápidas</div>
          {hasMore ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? "Ver menos" : "Ver más"}
            </Button>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2 p-3 sm:hidden">
          {visibleMobile.map(({ key, label, Icon }) => (
            <TooltipProvider key={key} delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    className="group h-auto min-h-[5rem] py-4 rounded-2xl border bg-white hover:bg-gray-200 transition-all duration-200 flex flex-col items-center justify-center gap-2 shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    style={{ color: "black" }}
                    onClick={() => go(key)}
                  >
                    <Icon className="h-5 w-5 transition-transform duration-200 group-hover:scale-110 shrink-0" />
                    <span className="text-xs font-medium text-center whitespace-normal leading-tight">
                      {label}
                    </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Ir a {label}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>

        {hasMore ? (
          <div className="sm:hidden px-3 pb-2">
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-xl"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? "Ocultar acciones" : `Ver ${actions.length - previewCount} acciones más`}
            </Button>
          </div>
        ) : null}

        <div className="hidden sm:grid sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3 p-3 sm:p-4">
          {actions.map(({ key, label, Icon }) => (
            <TooltipProvider key={key} delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    className="group h-auto min-h-[5rem] py-4 rounded-2xl border bg-white hover:bg-gray-200 transition-all duration-200 flex flex-col items-center justify-center gap-2 shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    style={{ color: "black" }}
                    onClick={() => go(key)}
                  >
                    <Icon className="h-5 w-5 transition-transform duration-200 group-hover:scale-110 shrink-0" />
                    <span className="text-xs font-medium text-center whitespace-normal leading-tight">
                      {label}
                    </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Ir a {label}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ----------------------------- DASHBOARD PEQUEÑO (✅ CON DATOS REALES) ----------------------------- */
function SmallAcademicDashboard() {
  const [stats, setStats] = useState({ sections: 0, teachers: 0, students: 0, openProcesses: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const [sumRes, procRes] = await Promise.all([
          AcademicReports.summary(),      // GET /academic/reports/summary
          ProcessesInbox.listAll(),       // GET /processes
        ]);

        const summary = sumRes?.summary ?? sumRes ?? {};
        const processes = Array.isArray(procRes?.processes) ? procRes.processes : [];

        const open = processes.filter(
          (p) => String(p?.status || "").toUpperCase() === "PENDIENTE"
        ).length;

        const next = {
          sections: Number(summary?.sections ?? 0),
          teachers: Number(summary?.teachers ?? 0),
          students: Number(summary?.students ?? 0),
          openProcesses: Number(open ?? 0),
        };

        if (!cancelled) setStats(next);
      } catch (e) {
        if (!cancelled) toast.error(e?.message || "Error al cargar dashboard");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const items = [
    { label: "Secciones", value: stats.sections, Icon: Calendar, bgColor: "bg-blue-50", iconColor: "text-blue-600" },
    { label: "Docentes", value: stats.teachers, Icon: Users, bgColor: "bg-green-50", iconColor: "text-green-600" },
    { label: "Estudiantes", value: stats.students, Icon: Users, bgColor: "bg-purple-50", iconColor: "text-purple-600" },
    { label: "Procesos abiertos", value: stats.openProcesses, Icon: Clock, bgColor: "bg-orange-50", iconColor: "text-orange-600" },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 p-1 mt-4">
      {items.map((k, i) => (
        <Card key={i} className={`border bg-white shadow-lg rounded-xl p-4 ${k.bgColor} hover:shadow-xl transition-all`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-800">{k.label}</CardTitle>
            <k.Icon className={`h-5 w-5 ${k.iconColor}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">{loading ? "…" : k.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export { AcademicQuickActions, SmallAcademicDashboard };

/* ----------------------------- PLANES / MALLAS ----------------------------- */
function PlansAndCurricula() {
  const [list, setList] = useState([]);
  const [careers, setCareers] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);

  const [pform, setPform] = useState({
    name: "",
    career_id: "",
    start_year: new Date().getFullYear(),
    semesters: 10,
    description: "",
  });

  const [courses, setCourses] = useState([]);
  const [cform, setCform] = useState({
    code: "",
    name: "",
    credits: 3,
    weekly_hours: 3,
    semester: 1,
    type: "MANDATORY",
  });

  const [prereqFor, setPrereqFor] = useState(null);
  const [prereqs, setPrereqs] = useState([]);

  const load = useCallback(async () => {
    try {
      const [pl, cs] = await Promise.all([Plans.list(), Careers.list()]);
      const plans = Array.isArray(pl?.plans) ? pl.plans : Array.isArray(pl) ? pl : [];
      const careersArr = Array.isArray(cs?.careers) ? cs.careers : Array.isArray(cs) ? cs : [];
      setList(plans);
      setCareers(careersArr);
    } catch (e) {
      toast.error(e.message || "Error al cargar planes");
    }
  }, []);

  const loadCourses = useCallback(async (planId) => {
    try {
      const c = await Plans.listCourses(planId);
      const coursesArr = Array.isArray(c?.courses) ? c.courses : Array.isArray(c) ? c : [];
      setCourses(coursesArr);
    } catch (e) {
      toast.error(e.message || "Error al cargar cursos");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (selectedPlan?.id) loadCourses(selectedPlan.id);
  }, [selectedPlan?.id, loadCourses]);

  const createPlan = async (e) => {
    e.preventDefault();
    try {
      const res = await Plans.create(pform);
      toast.success("Plan creado");
      setPform({ name: "", career_id: "", start_year: new Date().getFullYear(), semesters: 10, description: "" });
      const created = res?.plan || res;
      setList((prev) => [created, ...prev]);
    } catch (e2) {
      toast.error(e2.message || "Error al crear plan");
    }
  };

  const createCourse = async (e) => {
    e.preventDefault();
    if (!selectedPlan) return toast.error("Seleccione un plan");
    try {
      await Plans.addCourse(selectedPlan.id, cform);
      toast.success("Curso añadido");
      setCform({ code: "", name: "", credits: 3, weekly_hours: 3, semester: 1, type: "MANDATORY" });
      loadCourses(selectedPlan.id);
    } catch (e2) {
      toast.error(e2.message || "Error al crear curso");
    }
  };

  const savePrereqs = async () => {
    if (!selectedPlan?.id || !prereqFor?.id) return;
    try {
      await Plans.setPrereqs(selectedPlan.id, prereqFor.id, prereqs);
      toast.success("Prerrequisitos guardados");
      setPrereqFor(null);
      setPrereqs([]);
      loadCourses(selectedPlan.id);
    } catch (e2) {
      toast.error(e2.message || "Error al guardar prerrequisitos");
    }
  };

  return (
    <IfPerm any={REQS.plans}>
      <div className="page-container space-y-6">
        <Card className="border shadow-sm bg-white rounded-xl">
          <CardHeader className="px-6 pt-6">
            {sectionHeader({
              title: "Planes/Mallas Curriculares",
              description: "Define planes por carrera y sus cursos",
              Icon: LibraryBig,
            })}
          </CardHeader>

          <CardContent className="px-6 pb-6 space-y-4">
            <form onSubmit={createPlan} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="sm:col-span-2 lg:col-span-2">
                <Label>Nombre *</Label>
                <Input value={pform.name} onChange={(e) => setPform({ ...pform, name: e.target.value })} required />
              </div>

              <div>
                <Label>Carrera *</Label>
                <Select
                  value={pform.career_id ? String(pform.career_id) : "ALL"}
                  onValueChange={(v) => setPform({ ...pform, career_id: v === "ALL" ? "" : Number(v) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Seleccionar</SelectItem>
                    {(Array.isArray(careers) ? careers : []).map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Año inicio</Label>
                <Input
                  type="number"
                  min="2000"
                  max="2100"
                  value={pform.start_year}
                  onChange={(e) => setPform({ ...pform, start_year: +e.target.value })}
                />
              </div>

              <div>
                <Label>Semestres</Label>
                <Input
                  type="number"
                  min="1"
                  max="20"
                  value={pform.semesters}
                  onChange={(e) => setPform({ ...pform, semesters: +e.target.value })}
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-5">
                <Label>Descripción</Label>
                <Textarea value={pform.description} onChange={(e) => setPform({ ...pform, description: e.target.value })} />
              </div>

              <div className="md:col-span-5 flex justify-end">
                <Button type="submit" className="gap-2">
                  <Plus className="h-4 w-4" /> Crear plan
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="border">
            <CardHeader>{sectionHeader({ title: "Planes" })}</CardHeader>
            <CardContent className="space-y-2">
              {(Array.isArray(list) ? list : []).length === 0 ? <Empty label="Sin planes" /> : null}

              {(Array.isArray(list) ? list : []).map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setSelectedPlan(p)}
                  className={`w-full text-left p-3 border rounded-xl flex items-center justify-between hover:bg-accent/10 transition-colors ${selectedPlan?.id === p.id ? "bg-primary/5 border-primary/30" : ""
                    }`}
                >
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Carrera: {p.career_name || p.career?.name} · Semestres: {p.semesters}
                    </div>
                  </div>
                  <Badge variant="secondary" className="rounded-full">
                    {p.start_year}
                  </Badge>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="border">
            <CardHeader>
              {sectionHeader({
                title: `Cursos del Plan ${selectedPlan ? `– ${selectedPlan.name}` : ""}`,
                description: "Alta rápida + prerrequisitos",
                Icon: ClipboardList,
              })}
            </CardHeader>

            <CardContent className="space-y-4 overflow-x-hidden">
              <form onSubmit={createCourse} className="w-full grid grid-cols-1 gap-3">
                <div className="min-w-0">
                  <Label className="block text-left">Nombre *</Label>
                  <Input
                    className="w-full max-w-[420px] h-9 text-sm"
                    value={cform.name}
                    onChange={(e) => setCform({ ...cform, name: e.target.value })}
                    required
                  />
                </div>

                <div className="min-w-0">
                  <Label className="block text-left">Código *</Label>
                  <Input
                    className="w-full max-w-[240px] h-9 text-sm"
                    value={cform.code}
                    onChange={(e) => setCform({ ...cform, code: e.target.value })}
                    required
                  />
                </div>

                <div className="min-w-0">
                  <Label className="block text-left">Créditos</Label>
                  <Input
                    className="w-full max-w-[120px] h-9 text-sm"
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={cform.credits}
                    onChange={(e) => setCform({ ...cform, credits: +e.target.value || 0 })}
                  />
                </div>

                <div className="min-w-0">
                  <Label className="block text-left">Hrs/Sem</Label>
                  <Input
                    className="w-full max-w-[120px] h-9 text-sm"
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={cform.weekly_hours}
                    onChange={(e) => setCform({ ...cform, weekly_hours: +e.target.value || 0 })}
                  />
                </div>

                <div className="min-w-0">
                  <Label className="block text-left">Semestre</Label>
                  <Input
                    className="w-full max-w-[120px] h-9 text-sm"
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={cform.semester}
                    onChange={(e) => setCform({ ...cform, semester: +e.target.value || 1 })}
                  />
                </div>

                <div className="min-w-0">
                  <Label className="block text-left">Tipo</Label>
                  <Select value={cform.type} onValueChange={(v) => setCform({ ...cform, type: v })}>
                    <SelectTrigger className="w-full max-w-[240px] h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[9999]">
                      <SelectItem value="MANDATORY">Obligatorio</SelectItem>
                      <SelectItem value="ELECTIVE">Electivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-start">
                  <Button disabled={!selectedPlan} type="submit" className="w-full max-w-[240px] gap-2">
                    <Save className="h-4 w-4" />
                    Guardar curso
                  </Button>
                </div>
              </form>

              {/* ===================== DESKTOP: TABLA ===================== */}
              <div className="hidden sm:block border rounded-xl overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-200">
                    <tr>
                      <th className="p-2 text-left text-black">Código</th>
                      <th className="p-2 text-left text-black">Curso</th>
                      <th className="p-2 text-center text-black">Cred.</th>
                      <th className="p-2 text-center text-black">Sem.</th>
                      <th className="p-2 text-center text-black">Tipo</th>
                      <th className="p-2 text-right text-black">Acciones</th>
                    </tr>
                  </thead>

                  <tbody className="bg-white">
                    {(Array.isArray(courses) ? courses : []).map((c) => (
                      <tr key={c.id} className="border-t hover:bg-gray-50">
                        <td className="p-2 font-mono text-xs text-black">{c.code}</td>
                        <td className="p-2 text-black">{c.name}</td>
                        <td className="p-2 text-center text-black">{c.credits}</td>
                        <td className="p-2 text-center text-black">{c.semester}</td>
                        <td className="p-2 text-center text-black">
                          <Badge variant="outline">
                            {c.type === "ELECTIVE" ? "Electivo" : "Obligatorio"}
                          </Badge>
                        </td>
                        <td className="p-2 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setPrereqFor(c);
                              setPrereqs(Array.isArray(c.prerequisites) ? c.prerequisites.map((p) => p.id) : []);
                            }}
                          >
                            <ClipboardList className="h-4 w-4" /> Prerrequisitos
                          </Button>
                        </td>
                      </tr>
                    ))}

                    {selectedPlan && (Array.isArray(courses) ? courses : []).length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-3 text-center text-gray-500">
                          Sin cursos
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* ===================== MOBILE: LISTADO ===================== */}
              <div className="block sm:hidden space-y-2">
                {(Array.isArray(courses) ? courses : []).map((c) => (
                  <div key={c.id} className="border rounded-lg p-3 bg-white flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <div className="font-mono text-xs text-gray-500">{c.code}</div>
                      <div className="font-medium text-sm truncate">{c.name}</div>

                      <div className="mt-1 text-xs text-gray-600 flex flex-wrap gap-3">
                        <span>Cred: {c.credits}</span>
                        <span>Sem: {c.semester}</span>
                        <span>{c.type === "ELECTIVE" ? "Electivo" : "Obligatorio"}</span>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setPrereqFor(c);
                        setPrereqs(Array.isArray(c.prerequisites) ? c.prerequisites.map((p) => p.id) : []);
                      }}
                      className="shrink-0 h-8 px-2"
                    >
                      <ClipboardList className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                {selectedPlan && (Array.isArray(courses) ? courses : []).length === 0 && (
                  <div className="text-center text-sm text-gray-500 py-4">Sin cursos</div>
                )}
              </div>

              {/* PRERREQUISITOS */}
              {prereqFor ? (
                <div className="border rounded-2xl p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium truncate">Prerrequisitos de: {prereqFor.name}</div>

                    <Button
                      variant="ghost"
                      onClick={() => {
                        setPrereqFor(null);
                        setPrereqs([]);
                      }}
                    >
                      ✕
                    </Button>
                  </div>

                  <ScrollArea className="h-56 mt-2 pr-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(Array.isArray(courses) ? courses : [])
                        .filter((c) => c.id !== prereqFor.id)
                        .map((c) => {
                          const checked = prereqs.includes(c.id);
                          return (
                            <label
                              key={c.id}
                              className={`border rounded-xl p-2 flex items-center gap-2 text-sm ${checked ? "bg-primary/5 border-primary/40" : ""
                                }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) =>
                                  setPrereqs((prev) =>
                                    e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)
                                  )
                                }
                              />
                              <span className="font-mono text-xs">{c.code}</span> – {c.name}
                            </label>
                          );
                        })}
                    </div>
                  </ScrollArea>

                  <div className="mt-3 flex justify-end">
                    <Button onClick={savePrereqs} className="gap-2 w-full sm:w-auto">
                      <Save className="h-4 w-4" /> Guardar prerrequisitos
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </IfPerm>
  );
}

/* ----------------------------- CARGA LECTIVA / HORARIOS ----------------------------- */
function LoadAndSchedules() {
  const { hasAny } = useAuth();
  const allowed = hasAny(REQS.load);

  const [teachers, setTeachers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [sections, setSections] = useState([]);

  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [planCourses, setPlanCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");

  const [form, setForm] = useState({
    course_id: "",
    course_code: "",
    course_name: "",
    teacher_id: "",
    room_id: "",
    capacity: 30,
    period: "2025-I",
    slots: [],
  });

  const [newSlot, setNewSlot] = useState({ day: "MON", start: "08:00", end: "10:00" });
  const [conflicts, setConflicts] = useState([]);

  const load = useCallback(async () => {
    try {
      const [t, r, s, pl] = await Promise.all([
        CatalogTeachers.list(),
        CatalogClassrooms.list(),
        Sections.list({ period: "2025-I" }),
        Plans.list(),
      ]);

      const teachersArr =
        Array.isArray(t?.items) ? t.items :
          Array.isArray(t?.teachers) ? t.teachers :
            Array.isArray(t) ? t : [];

      const roomsArr =
        Array.isArray(r?.items) ? r.items :
          Array.isArray(r?.classrooms) ? r.classrooms :
            Array.isArray(r) ? r : [];

      const sectionsArr = Array.isArray(s?.sections) ? s.sections : Array.isArray(s) ? s : [];
      const plansArr = Array.isArray(pl?.plans) ? pl.plans : Array.isArray(pl) ? pl : [];

      setTeachers(teachersArr);
      setRooms(roomsArr);
      setSections(sectionsArr);
      setPlans(plansArr);
    } catch (e) {
      toast.error(e.message || "Error al cargar catálogos/secciones");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const run = async () => {
      if (!selectedPlanId) {
        setPlanCourses([]);
        setSelectedCourseId("");
        setForm((f) => ({ ...f, course_id: "", course_code: "", course_name: "" }));
        return;
      }
      try {
        const res = await Plans.listCourses(selectedPlanId);
        const coursesArr = Array.isArray(res?.courses) ? res.courses : Array.isArray(res) ? res : [];
        setPlanCourses(coursesArr);
      } catch (e) {
        toast.error(e.message || "Error al cargar cursos del plan");
      }
    };
    run();
  }, [selectedPlanId]);

  const onSelectCourse = (courseId) => {
    setSelectedCourseId(courseId);
    const c = planCourses.find((x) => String(x.id) === String(courseId));
    if (!c) {
      setForm((f) => ({ ...f, course_id: "", course_code: "", course_name: "" }));
      return;
    }

    setForm((f) => ({
      ...f,
      course_id: c.id,
      course_code: c.code || "",
      course_name: c.name || "",
    }));
  };

  const addSlot = () => setForm((f) => ({ ...f, slots: [...f.slots, newSlot] }));

  const check = async () => {
    try {
      const res = await Sections.checkConflicts(form);
      const list = Array.isArray(res?.conflicts) ? res.conflicts : [];
      setConflicts(list);
      if (list.length === 0) toast.success("Sin conflictos de horario / aforo");
      else toast.error("Conflictos detectados");
    } catch (e) {
      toast.error(e.message || "Error al verificar conflictos");
    }
  };

  const createSection = async () => {
    if (!selectedPlanId) return toast.error("Selecciona un plan");
    if (!selectedCourseId) return toast.error("Selecciona un curso");
    if (!form.teacher_id) return toast.error("Selecciona un docente");
    if (!form.room_id) return toast.error("Selecciona un aula");
    if (form.slots.length === 0) return toast.error("Agrega al menos una franja horaria");
    if (conflicts.length > 0) return toast.error("Resuelve los conflictos antes de crear la sección");

    try {
      await Sections.create(form);
      toast.success("Sección creada");

      setSelectedCourseId("");
      setForm({
        course_id: "",
        course_code: "",
        course_name: "",
        teacher_id: "",
        room_id: "",
        capacity: 30,
        period: "2025-I",
        slots: [],
      });

      load();
    } catch (e) {
      toast.error(e.message || "Error al crear sección");
    }
  };

  if (!allowed) return null;

  return (
    <div className="space-y-6 pb-24 sm:pb-6">
      <Card className="border shadow-sm bg-white rounded-xl">
        <CardHeader className="px-6 pt-6">
          {sectionHeader({
            title: "Nueva Sección / Horario",
            description: "Asigna curso, docente, aula y franja horaria",
            Icon: Calendar,
          })}
        </CardHeader>

        <CardContent className="px-6 pb-6 space-y-4">
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <Label>Plan/Malla *</Label>
              <Select value={selectedPlanId ? String(selectedPlanId) : "ALL"} onValueChange={(v) => setSelectedPlanId(v === "ALL" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Seleccionar</SelectItem>
                  {(Array.isArray(plans) ? plans : []).map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name} ({p.start_year})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Curso *</Label>
              <Select
                value={selectedCourseId ? String(selectedCourseId) : "ALL"}
                onValueChange={(v) => onSelectCourse(v === "ALL" ? "" : v)}
                disabled={!selectedPlanId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedPlanId ? "Seleccionar curso" : "Primero elige un plan"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Seleccionar</SelectItem>
                  {(Array.isArray(planCourses) ? planCourses : []).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.code} — {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Labeled value={form.period} label="Periodo" onChange={(v) => setForm({ ...form, period: v })} />

            <div>
              <Label>Código (auto)</Label>
              <Input value={form.course_code} readOnly />
            </div>

            <div className="sm:col-span-2 lg:col-span-2">
              <Label>Nombre (auto)</Label>
              <Input value={form.course_name} readOnly />
            </div>

            <div>
              <Label>Docente</Label>
              <Select
                value={form.teacher_id ? String(form.teacher_id) : "ALL"}
                onValueChange={(v) => setForm({ ...form, teacher_id: v === "ALL" ? "" : Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Seleccionar</SelectItem>
                  {(Array.isArray(teachers) ? teachers : []).map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.display_name || t.full_name || t.email || t.document || `Docente ${t.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Aula</Label>
              <Select
                value={form.room_id ? String(form.room_id) : "ALL"}
                onValueChange={(v) => setForm({ ...form, room_id: v === "ALL" ? "" : Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Seleccionar</SelectItem>
                  {(Array.isArray(rooms) ? rooms : []).map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {r.code ? `${r.code} — ` : ""}{r.name} (cap. {r.capacity})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Capacidad (sección)</Label>
              <Input type="number" min="1" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: +e.target.value || 1 })} />
            </div>
          </div>

          <div className="border rounded-2xl p-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:items-end gap-2">
              <div className="w-full sm:col-span-1 lg:w-44">
                <Label>Día</Label>
                <Select value={newSlot.day} onValueChange={(v) => setNewSlot((s) => ({ ...s, day: v }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full sm:col-span-1 lg:w-44">
                <Labeled
                  type="time"
                  label="Inicio"
                  value={newSlot.start}
                  onChange={(v) => setNewSlot((s) => ({ ...s, start: v }))}
                />
              </div>

              <div className="w-full sm:col-span-1 lg:w-44">
                <Labeled
                  type="time"
                  label="Fin"
                  value={newSlot.end}
                  onChange={(v) => setNewSlot((s) => ({ ...s, end: v }))}
                />
              </div>

              <div className="w-full sm:col-span-2 lg:w-auto lg:ml-auto">
                <Button onClick={addSlot} className="gap-2 w-full lg:w-auto">
                  <Plus className="h-4 w-4" /> Agregar franja
                </Button>
              </div>
            </div>

            {form.slots.length > 0 ? (
              <div className="mt-3">
                <div className="flex flex-wrap gap-2">
                  {form.slots.map((s, i) => (
                    <Badge key={i} variant="outline" className="rounded-full">
                      {s.day} {s.start}-{s.end}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:justify-end">
            <Button variant="outline" onClick={check} className="gap-2 w-full">
              <Plus className="h-4 w-4 rotate-45" /> Verificar conflictos
            </Button>
            <Button onClick={createSection} className="gap-2 w-full">
              <Save className="h-4 w-4" /> Crear sección
            </Button>
          </div>

          {conflicts.length > 0 ? (
            <div className="mt-2 p-3 border rounded-2xl bg-destructive/5">
              <div className="font-medium text-destructive mb-1">Conflictos:</div>
              {conflicts.map((c, i) => (
                <div key={i} className="text-sm text-destructive">
                  • {c.message}
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>{sectionHeader({ title: "Secciones (Período 2025-I)" })}</CardHeader>

        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-200">
              <tr>
                <th className="p-2 text-left text-black">Curso</th>
                <th className="p-2 text-left text-black">Docente</th>
                <th className="p-2 text-left text-black">Aula</th>
                <th className="p-2 text-left text-black">Horario</th>
                <th className="p-2 text-center text-black">Cap.</th>
              </tr>
            </thead>

            <tbody className="bg-white">
              {(Array.isArray(sections) ? sections : []).map((s) => (
                <tr key={s.id} className="border-t hover:bg-gray-50">
                  <td className="p-2 text-black">{s.course_code} – {s.course_name}</td>
                  <td className="p-2 text-black">{s.teacher_name}</td>
                  <td className="p-2 text-black">{s.room_name}</td>
                  <td className="p-2 text-black">
                    {(Array.isArray(s.slots) ? s.slots : []).map((k) => `${k.day} ${k.start}-${k.end}`).join(", ")}
                  </td>
                  <td className="p-2 text-center text-black">{s.capacity}</td>
                </tr>
              ))}

              {(Array.isArray(sections) ? sections : []).length === 0 ? (
                <tr>
                  <td className="p-4 text-center text-muted-foreground" colSpan={5}>
                    Sin secciones
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ----------------------------- KÁRDEX / CONSTANCIAS ----------------------------- */
function KardexAndCertificates() {
  const { hasAny } = useAuth();
  const allowed = hasAny(REQS.kardex);

  const [studentId, setStudentId] = useState("");
  const [period, setPeriod] = useState("2025-I");
  const [data, setData] = useState(null);

  const fetchKardex = async () => {
    if (!studentId) return toast.error("Ingrese ID/DNI del estudiante");
    try {
      const k = await Kardex.ofStudent(studentId);
      setData(k);
    } catch (e) {
      toast.error(e.message || "Error al consultar kárdex");
    }
  };

  const genBoleta = async () => {
    if (!studentId) return;
    try {
      const res = await generatePDFWithPolling(`/kardex/${studentId}/boleta`, { academic_period: period }, { testId: "boleta-pdf" });
      if (res.success) await downloadFile(res.downloadUrl, `boleta-${studentId}-${period}.pdf`);
    } catch {
      toast.error("Error al generar boleta");
    }
  };

  const genConstancia = async () => {
    if (!studentId) return;
    try {
      const res = await generatePDFWithPolling(`/kardex/${studentId}/constancia`, {}, { testId: "constancia-pdf" });
      if (res.success) await downloadFile(res.downloadUrl, `constancia-${studentId}.pdf`);
    } catch {
      toast.error("Error al generar constancia");
    }
  };

  if (!allowed) return null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>{sectionHeader({ title: "Consulta de Kárdex", Icon: FileText })}</CardHeader>
        <CardContent className="grid md:grid-cols-4 gap-3">
          <Labeled label="ID/DNI Estudiante" value={studentId} onChange={setStudentId} placeholder="e.g. 71234567" />
          <Labeled label="Período" value={period} onChange={setPeriod} />
          <div className="flex items-end">
            <Button onClick={fetchKardex} className="gap-2">
              <SearchIcon className="h-4 w-4" /> Consultar
            </Button>
          </div>
        </CardContent>
      </Card>

      {data ? (
        <Card className="border">
          <CardHeader>{sectionHeader({ title: "Resultados" })}</CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><strong>Estudiante:</strong> {data.student_name}</div>
            <div><strong>Carrera:</strong> {data.career_name}</div>
            <div><strong>Créditos aprobados:</strong> {data.credits_earned}</div>
            <div><strong>PPA:</strong> {data.gpa ?? "-"}</div>

            <div className="flex gap-2 mt-2">
              <Button variant="outline" onClick={genBoleta} className="gap-2">
                <FileText className="h-4 w-4" /> Boleta PDF
              </Button>
              <Button variant="outline" onClick={genConstancia} className="gap-2">
                <FileText className="h-4 w-4" /> Constancia PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

/* ----------------------------- PROCESOS ----------------------------- */
function AcademicProcesses() {
  const { hasAny } = useAuth();
  const allowed = hasAny(REQS.processes);

  const [type, setType] = useState("RETIRO");
  const [form, setForm] = useState({ student_id: "", period: "2025-I", reason: "", extra: "" });

  const submit = async () => {
    try {
      const map = {
        RETIRO: Processes.retiro,
        RESERVA: Processes.reserva,
        CONVALIDACION: Processes.convalidacion,
        TRASLADO: Processes.traslado,
        REINCORPORACION: Processes.reincorporacion,
      };
      await map[type](form);
      toast.success("Solicitud registrada");
      setForm({ student_id: "", period: "2025-I", reason: "", extra: "" });
    } catch (e) {
      toast.error(e.message || "Error al registrar solicitud");
    }
  };

  if (!allowed) return null;

  return (
    <Card>
      <CardHeader>{sectionHeader({ title: "Procesos académicos", Icon: Clock })}</CardHeader>
      <CardContent className="grid md:grid-cols-2 gap-3">
        <div>
          <Label>Tipo</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="RETIRO">Retiro</SelectItem>
              <SelectItem value="RESERVA">Reserva de matrícula</SelectItem>
              <SelectItem value="CONVALIDACION">Convalidación</SelectItem>
              <SelectItem value="TRASLADO">Traslado</SelectItem>
              <SelectItem value="REINCORPORACION">Reincorporación</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Labeled label="ID/DNI Estudiante" value={form.student_id} onChange={(v) => setForm({ ...form, student_id: v })} />
        <Labeled label="Período" value={form.period} onChange={(v) => setForm({ ...form, period: v })} />

        <div className="sm:col-span-2 lg:col-span-2">
          <Label>Motivo / Detalle</Label>
          <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        </div>

        <div className="md:col-span-2 flex justify-end">
          <Button onClick={submit} className="gap-2">
            <Save className="h-4 w-4" /> Enviar solicitud
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ----------------------------- UTILS UI ----------------------------- */
function Labeled({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function Empty({ label = "Sin datos", Icon = Inbox }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 border rounded-xl">
      <Icon className="h-4 w-4" />
      {label}
    </div>
  );
}

/* ==================================================================================
   BLOQUE COMPLETO: MÓDULO + COMPONENTES AUXILIARES
   ================================================================================== */

export default function AcademicModule() {
  const { hasAny } = useAuth();
  const [tab, setTab] = useState("dashboard");

  const tabs = useMemo(
    () =>
      [
        { key: "dashboard", label: "Dashboard", need: [] },
        { key: "plans", label: "Mallas", need: REQS.plans },
        { key: "load", label: "Carga & Horarios", need: REQS.load },
        { key: "enroll", label: "Matrícula", need: REQS.enroll },
        { key: "grades", label: "Notas/Asistencia", need: REQS.grades },
        { key: "syllabus", label: "Sílabos/Evaluación", need: REQS.syllabus },
        { key: "kardex", label: "Kárdex", need: REQS.kardex },
        { key: "reports", label: "Reportes", need: REQS.reports },
        { key: "proc-inbox", label: "Bandeja procesos", need: REQS.procInbox },
        { key: "processes", label: "Procesos", need: REQS.processes },
      ].filter((t) => t.need.length === 0 || hasAny(t.need)),
    [hasAny]
  );

  useEffect(() => {
    if (!tabs.find((t) => t.key === tab)) setTab(tabs[0]?.key ?? "dashboard");
  }, [tabs, tab]);

  return (
    <div
      style={pageStyle}
      className="min-h-[100dvh] w-full min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain p-3 sm:p-4 md:p-6 pb-24 md:pb-40"
    >
      <div className="w-full min-w-0 rounded-2xl md:rounded-3xl bg-white/70 backdrop-blur-md border border-white/70 shadow-xl p-4 md:p-6 space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" />
            <h1 className="text-xl md:text-2xl font-semibold text-black">Módulo Académico</h1>
          </div>
          <p className="text-sm text-gray-700 mt-1">
            Gestión integral de planes, secciones, matrícula y notas.
          </p>
        </div>

        <Separator className="bg-gray-200/50" />

        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          <div className="pb-3">
            <div className="sm:hidden">
              <div className="w-full bg-white/55 backdrop-blur-md border border-white/20 rounded-2xl shadow-sm p-2">
                <div className="flex items-center gap-2">
                  <TabsList className="flex-1 inline-flex items-center h-10 gap-2 bg-transparent p-0 shadow-none">
                    {tabs.slice(0, 2).map((t) => (
                      <IconTab
                        key={t.key}
                        value={t.key}
                        label={t.label}
                        Icon={tabIcon(t.key)}
                        className="shrink-0"
                      />
                    ))}
                  </TabsList>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 rounded-xl shrink-0"
                        aria-label="Ver más pestañas"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="end" className="w-64">
                      {tabs.slice(2).map((t) => {
                        const I = tabIcon(t.key);
                        return (
                          <DropdownMenuItem
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className="flex items-center gap-2"
                          >
                            <I className="h-4 w-4" />
                            <span>{t.label}</span>
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>

            <div className="hidden sm:block">
              <div className="w-full overflow-x-auto">
                <TabsList className="flex flex-wrap w-full items-center h-auto p-2 gap-2 bg-white/55 backdrop-blur-md border border-white/20 rounded-2xl shadow-sm">
                  {tabs.map((t) => (
                    <IconTab
                      key={t.key}
                      value={t.key}
                      label={t.label}
                      Icon={tabIcon(t.key)}
                      className="shrink-0"
                    />
                  ))}
                </TabsList>
              </div>
            </div>
          </div>

          <TabsContent value="dashboard">
            <AcademicQuickActions go={setTab} />
            <SmallAcademicDashboard />
          </TabsContent>

          <TabsContent value="plans"><PlansAndCurricula /></TabsContent>
          <TabsContent value="load"><LoadAndSchedules /></TabsContent>
          <TabsContent value="enroll"><EnrollmentComponent /></TabsContent>
          <TabsContent value="grades"><GradesAttendanceComponent /></TabsContent>
          <TabsContent value="syllabus"><SectionSyllabusEvaluation /></TabsContent>
          <TabsContent value="kardex"><KardexAndCertificates /></TabsContent>
          <TabsContent value="reports"><AcademicReportsPage /></TabsContent>
          <TabsContent value="proc-inbox"><AcademicProcessesInbox /></TabsContent>
          <TabsContent value="processes"><AcademicProcesses /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/* --- ICON TAB --- */
function IconTab({ value, label, Icon, className = "" }) {
  return (
    <TabsTrigger
      value={value}
      className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors 
        data-[state=active]:bg-primary/10 data-[state=active]:text-primary 
        hover:bg-gray-200 ${className}`}
    >
      <Icon className="h-5 w-5" />
      <span className="whitespace-nowrap">{label}</span>
    </TabsTrigger>
  );
}

/* --- ICONOS POR TAB --- */
function tabIcon(key) {
  switch (key) {
    case "dashboard": return LayoutGrid;
    case "plans": return BookOpen;
    case "load": return Calendar;
    case "enroll": return GraduationCap;
    case "grades": return CheckCircle;
    case "syllabus": return FileText;
    case "kardex": return Users;
    case "reports": return BarChart3;
    case "proc-inbox": return Inbox;
    case "processes": return Clock;
    default: return LayoutGrid;
  }
}
