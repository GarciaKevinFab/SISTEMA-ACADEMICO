// src/modules/academic/AcademicModule.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Badge } from "../../components/ui/badge";
import { toast } from "sonner";
import { Plus, Save, Trash2, Calendar, Users, Clock, FileText, AlertTriangle, CheckCircle } from "lucide-react";

// Usa tus utilidades existentes para PDF/QR
import { generatePDFWithPolling, downloadFile } from "../../utils/pdfQrPolling";

// Servicios
import { Careers, Plans, Sections, Kardex, Processes } from "../../services/academic.service";

// Reutilizamos tus componentes existentes
import EnrollmentComponent from "./EnrollmentComponent";
import GradesAttendanceComponent from "./GradesAttendanceComponent";

/* ------------- DASHBOARD PEQUEÑO ------------- */
function SmallAcademicDashboard() {
  const [stats, setStats] = useState({ sections: 0, teachers: 0, students: 0, openProcesses: 0 });

  useEffect(() => {
    // opcional: pegar endpoints reales si los tienes
    setStats((s) => s);
  }, []);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {[
        { label: "Secciones", value: stats.sections, Icon: Calendar },
        { label: "Docentes", value: stats.teachers, Icon: Users },
        { label: "Estudiantes", value: stats.students, Icon: Users },
        { label: "Procesos abiertos", value: stats.openProcesses, Icon: Clock },
      ].map((k, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{k.label}</CardTitle>
            <k.Icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{k.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ------------- PLANES / MALLAS ------------- */
function PlansAndCurricula() {
  const [list, setList] = useState([]);
  const [careers, setCareers] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);

  // Form plan
  const [pform, setPform] = useState({ name: "", career_id: "", start_year: new Date().getFullYear(), semesters: 10, description: "" });

  // Cursos del plan
  const [courses, setCourses] = useState([]);
  const [cform, setCform] = useState({ code: "", name: "", credits: 3, weekly_hours: 3, semester: 1, type: "MANDATORY" });
  const [prereqFor, setPrereqFor] = useState(null);
  const [prereqs, setPrereqs] = useState([]); // ids seleccionados

  const load = async () => {
    try {
      const [pl, cs] = await Promise.all([Plans.list(), Careers.list()]);
      setList(pl?.plans || pl || []);
      setCareers(cs?.careers || cs || []);
    } catch (e) { toast.error(e.message || "Error al cargar planes"); }
  };

  const loadCourses = async (planId) => {
    try {
      const c = await Plans.listCourses(planId);
      setCourses(c?.courses || c || []);
    } catch (e) { toast.error(e.message || "Error al cargar cursos"); }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { if (selectedPlan) loadCourses(selectedPlan.id); }, [selectedPlan?.id]);

  const createPlan = async (e) => {
    e.preventDefault();
    try {
      const res = await Plans.create(pform);
      toast.success("Plan creado");
      setPform({ name: "", career_id: "", start_year: new Date().getFullYear(), semesters: 10, description: "" });
      setList((prev) => [res?.plan || res, ...prev]);
    } catch (e) { toast.error(e.message); }
  };

  const createCourse = async (e) => {
    e.preventDefault();
    if (!selectedPlan) return toast.error("Seleccione un plan");
    try {
      const res = await Plans.addCourse(selectedPlan.id, cform);
      toast.success("Curso añadido");
      setCform({ code: "", name: "", credits: 3, weekly_hours: 3, semester: 1, type: "MANDATORY" });
      loadCourses(selectedPlan.id);
    } catch (e) { toast.error(e.message); }
  };

  const savePrereqs = async () => {
    try {
      await Plans.setPrereqs(selectedPlan.id, prereqFor.id, prereqs);
      toast.success("Prerrequisitos guardados");
      setPrereqFor(null); setPrereqs([]);
      loadCourses(selectedPlan.id);
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6">
      {/* Alta plan */}
      <Card>
        <CardHeader>
          <CardTitle>Planes/Mallas Curriculares</CardTitle>
          <CardDescription>Define planes por carrera y sus cursos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={createPlan} className="grid md:grid-cols-5 gap-3">
            <div className="md:col-span-2">
              <Label>Nombre *</Label>
              <Input value={pform.name} onChange={e => setPform({ ...pform, name: e.target.value })} required />
            </div>
            <div>
              <Label>Carrera *</Label>
              <Select value={pform.career_id?.toString() || ""} onValueChange={v => setPform({ ...pform, career_id: +v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {careers.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Año inicio</Label>
              <Input type="number" min="2000" max="2100" value={pform.start_year} onChange={e => setPform({ ...pform, start_year: +e.target.value })} />
            </div>
            <div>
              <Label>Semestres</Label>
              <Input type="number" min="1" max="20" value={pform.semesters} onChange={e => setPform({ ...pform, semesters: +e.target.value })} />
            </div>
            <div className="md:col-span-4">
              <Label>Descripción</Label>
              <Textarea value={pform.description} onChange={e => setPform({ ...pform, description: e.target.value })} />
            </div>
            <div className="md:col-span-5 flex justify-end">
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" /> Crear plan
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Lista de planes + cursos */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Planes</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {list.length === 0 && <p className="text-sm text-gray-500">Sin planes</p>}
            {list.map(p => (
              <div key={p.id} className={`p-3 border rounded flex items-center justify-between ${selectedPlan?.id === p.id ? "bg-blue-50 border-blue-200" : ""}`}>
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-gray-500">Carrera: {p.career_name || p.career?.name} · Semestres: {p.semesters}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setSelectedPlan(p)}>Cursos</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cursos del Plan {selectedPlan ? `– ${selectedPlan.name}` : ""}</CardTitle>
            <CardDescription>Alta rápida + prerrequisitos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Alta curso */}
            <form onSubmit={createCourse} className="grid md:grid-cols-6 gap-3">
              <div className="md:col-span-2">
                <Label>Nombre *</Label>
                <Input value={cform.name} onChange={e => setCform({ ...cform, name: e.target.value })} required />
              </div>
              <div>
                <Label>Código *</Label>
                <Input value={cform.code} onChange={e => setCform({ ...cform, code: e.target.value })} required />
              </div>
              <div>
                <Label>Créditos</Label>
                <Input type="number" min="0" value={cform.credits} onChange={e => setCform({ ...cform, credits: +e.target.value })} />
              </div>
              <div>
                <Label>Hrs/Sem</Label>
                <Input type="number" min="0" value={cform.weekly_hours} onChange={e => setCform({ ...cform, weekly_hours: +e.target.value })} />
              </div>
              <div>
                <Label>Semestre</Label>
                <Input type="number" min="1" value={cform.semester} onChange={e => setCform({ ...cform, semester: +e.target.value })} />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={cform.type} onValueChange={v => setCform({ ...cform, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MANDATORY">Obligatorio</SelectItem>
                    <SelectItem value="ELECTIVE">Electivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-6 flex justify-end">
                <Button disabled={!selectedPlan} type="submit"><Save className="h-4 w-4 mr-2" />Guardar curso</Button>
              </div>
            </form>

            {/* Tabla cursos */}
            <div className="border rounded overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2 text-left">Código</th>
                    <th className="p-2 text-left">Curso</th>
                    <th className="p-2 text-center">Cred.</th>
                    <th className="p-2 text-center">Sem.</th>
                    <th className="p-2 text-center">Tipo</th>
                    <th className="p-2 text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map(c => (
                    <tr key={c.id} className="border-t">
                      <td className="p-2">{c.code}</td>
                      <td className="p-2">{c.name}</td>
                      <td className="p-2 text-center">{c.credits}</td>
                      <td className="p-2 text-center">{c.semester}</td>
                      <td className="p-2 text-center">
                        <Badge variant="outline">{c.type === "ELECTIVE" ? "Electivo" : "Obligatorio"}</Badge>
                      </td>
                      <td className="p-2 text-right">
                        <Button size="sm" variant="outline" onClick={() => { setPrereqFor(c); setPrereqs(c.prerequisites?.map(p => p.id) || []); }}>
                          Prerrequisitos
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {selectedPlan && courses.length === 0 && (
                    <tr><td className="p-3 text-center text-gray-500" colSpan={6}>Sin cursos</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Editor de prerrequisitos */}
            {prereqFor && (
              <div className="border rounded p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">Prerrequisitos de: {prereqFor.name}</div>
                  <Button variant="ghost" onClick={() => { setPrereqFor(null); setPrereqs([]); }}>✕</Button>
                </div>
                <div className="grid md:grid-cols-2 gap-2 mt-2">
                  {courses
                    .filter(c => c.id !== prereqFor.id)
                    .map(c => {
                      const checked = prereqs.includes(c.id);
                      return (
                        <label key={c.id} className="border rounded p-2 flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => setPrereqs(prev => e.target.checked ? [...prev, c.id] : prev.filter(id => id !== c.id))}
                          />
                          {c.code} – {c.name}
                        </label>
                      );
                    })}
                </div>
                <div className="mt-3 flex justify-end">
                  <Button onClick={savePrereqs}><Save className="h-4 w-4 mr-2" />Guardar prerrequisitos</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ------------- CARGA LECTIVA / HORARIOS ------------- */
function LoadAndSchedules() {
  const [teachers, setTeachers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [sections, setSections] = useState([]);

  const [form, setForm] = useState({
    course_code: "", course_name: "",
    teacher_id: "", room_id: "", capacity: 30,
    period: "2025-I",
    // slots simples: { day: "MON", start: "08:00", end: "10:00" }
    slots: [],
  });

  const [newSlot, setNewSlot] = useState({ day: "MON", start: "08:00", end: "10:00" });
  const [conflicts, setConflicts] = useState([]);

  const load = async () => {
    try {
      const [t, r, s] = await Promise.all([Sections.teachers(), Sections.rooms(), Sections.list({ period: "2025-I" })]);
      setTeachers(t?.teachers || t || []);
      setRooms(r?.classrooms || r || []);
      setSections(s?.sections || s || []);
    } catch (e) { toast.error(e.message); }
  };
  useEffect(() => { load(); }, []);

  const addSlot = () => {
    setForm(f => ({ ...f, slots: [...f.slots, newSlot] }));
  };

  const check = async () => {
    try {
      const res = await Sections.checkConflicts(form);
      const list = res?.conflicts || [];
      setConflicts(list);
      if (list.length === 0) toast.success("Sin conflictos de horario / aforo");
      else toast.error("Conflictos detectados");
    } catch (e) { toast.error(e.message); }
  };

  const createSection = async () => {
    if (conflicts.length > 0) return toast.error("Resuelve los conflictos antes de crear la sección");
    try {
      await Sections.create(form);
      toast.success("Sección creada");
      setForm({ course_code: "", course_name: "", teacher_id: "", room_id: "", capacity: 30, period: "2025-I", slots: [] });
      load();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Nueva Sección / Horario</CardTitle>
          <CardDescription>Asigna docente, aula y franja horaria</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <Label>Curso (código)</Label>
              <Input value={form.course_code} onChange={e => setForm({ ...form, course_code: e.target.value })} placeholder="MAT101" />
            </div>
            <div>
              <Label>Curso (nombre)</Label>
              <Input value={form.course_name} onChange={e => setForm({ ...form, course_name: e.target.value })} placeholder="Matemática I" />
            </div>
            <div>
              <Label>Período</Label>
              <Input value={form.period} onChange={e => setForm({ ...form, period: e.target.value })} />
            </div>
            <div>
              <Label>Docente</Label>
              <Select value={form.teacher_id?.toString() || ""} onValueChange={v => setForm({ ...form, teacher_id: +v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {teachers.map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.full_name || t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Aula</Label>
              <Select value={form.room_id?.toString() || ""} onValueChange={v => setForm({ ...form, room_id: +v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {rooms.map(r => <SelectItem key={r.id} value={r.id.toString()}>{r.name} (cap. {r.capacity})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Capacidad (sección)</Label>
              <Input type="number" min="1" value={form.capacity} onChange={e => setForm({ ...form, capacity: +e.target.value })} />
            </div>
          </div>

          <div className="border rounded p-3">
            <div className="flex items-end gap-2">
              <div className="w-40">
                <Label>Día</Label>
                <Select value={newSlot.day} onValueChange={(v) => setNewSlot(s => ({ ...s, day: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["MON", "TUE", "WED", "THU", "FRI", "SAT"].map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Inicio</Label>
                <Input type="time" value={newSlot.start} onChange={e => setNewSlot(s => ({ ...s, start: e.target.value }))} />
              </div>
              <div>
                <Label>Fin</Label>
                <Input type="time" value={newSlot.end} onChange={e => setNewSlot(s => ({ ...s, end: e.target.value }))} />
              </div>
              <Button onClick={addSlot}><Plus className="h-4 w-4 mr-2" />Agregar franja</Button>
            </div>

            {form.slots.length > 0 && (
              <div className="mt-3">
                <div className="flex flex-wrap gap-2">
                  {form.slots.map((s, i) => (
                    <Badge key={i} variant="outline">{s.day} {s.start}-{s.end}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={check}><AlertTriangle className="h-4 w-4 mr-2" />Verificar conflictos</Button>
            <Button onClick={createSection} className="bg-blue-600 hover:bg-blue-700">
              <Save className="h-4 w-4 mr-2" />Crear sección
            </Button>
          </div>

          {conflicts.length > 0 && (
            <div className="mt-2 p-3 border rounded bg-red-50">
              <div className="font-medium text-red-700 mb-1">Conflictos:</div>
              {conflicts.map((c, i) => <div key={i} className="text-sm text-red-700">• {c.message}</div>)}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Secciones {`(Período 2025-I)`}</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-2 text-left">Curso</th>
                <th className="p-2 text-left">Docente</th>
                <th className="p-2 text-left">Aula</th>
                <th className="p-2 text-left">Horario</th>
                <th className="p-2 text-center">Cap.</th>
              </tr>
            </thead>
            <tbody>
              {sections.map(s => (
                <tr key={s.id} className="border-t">
                  <td className="p-2">{s.course_code} – {s.course_name}</td>
                  <td className="p-2">{s.teacher_name}</td>
                  <td className="p-2">{s.room_name}</td>
                  <td className="p-2">{(s.slots || []).map((k, i) => `${k.day} ${k.start}-${k.end}`).join(", ")}</td>
                  <td className="p-2 text-center">{s.capacity}</td>
                </tr>
              ))}
              {sections.length === 0 && <tr><td className="p-4 text-center text-gray-500" colSpan={5}>Sin secciones</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------- KÁRDEX / CONSTANCIAS ------------- */
function KardexAndCertificates() {
  const [studentId, setStudentId] = useState("");
  const [period, setPeriod] = useState("2025-I");
  const [data, setData] = useState(null);

  const fetchKardex = async () => {
    if (!studentId) return toast.error("Ingrese ID/DNI del estudiante");
    try {
      const k = await Kardex.ofStudent(studentId);
      setData(k);
    } catch (e) { toast.error(e.message); }
  };

  const genBoleta = async () => {
    if (!studentId) return;
    try {
      const res = await generatePDFWithPolling(`/kardex/${studentId}/boleta`, { academic_period: period }, { testId: "boleta-pdf" });
      if (res.success) await downloadFile(res.downloadUrl, `boleta-${studentId}-${period}.pdf`);
    } catch { toast.error("Error al generar boleta"); }
  };

  const genConstancia = async () => {
    if (!studentId) return;
    try {
      const res = await generatePDFWithPolling(`/kardex/${studentId}/constancia`, {}, { testId: "constancia-pdf" });
      if (res.success) await downloadFile(res.downloadUrl, `constancia-${studentId}.pdf`);
    } catch { toast.error("Error al generar constancia"); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Consulta de Kárdex</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <Label>ID/DNI Estudiante</Label>
            <Input value={studentId} onChange={e => setStudentId(e.target.value)} placeholder="e.g. 71234567" />
          </div>
          <div>
            <Label>Período</Label>
            <Input value={period} onChange={e => setPeriod(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button onClick={fetchKardex}><Search className="h-4 w-4 mr-2" />Consultar</Button>
          </div>
        </CardContent>
      </Card>

      {data && (
        <Card>
          <CardHeader><CardTitle>Resultados</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><strong>Estudiante:</strong> {data.student_name}</div>
            <div><strong>Carrera:</strong> {data.career_name}</div>
            <div><strong>Créditos aprobados:</strong> {data.credits_earned}</div>
            <div><strong>PPA:</strong> {data.gpa ?? "-"}</div>
            <div className="flex gap-2 mt-2">
              <Button variant="outline" onClick={genBoleta}><FileText className="h-4 w-4 mr-2" />Boleta PDF</Button>
              <Button variant="outline" onClick={genConstancia}><FileText className="h-4 w-4 mr-2" />Constancia PDF</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ------------- PROCESOS ------------- */
function AcademicProcesses() {
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
    } catch (e) { toast.error(e.message); }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Procesos académicos</CardTitle></CardHeader>
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
        <div>
          <Label>ID/DNI Estudiante</Label>
          <Input value={form.student_id} onChange={e => setForm({ ...form, student_id: e.target.value })} />
        </div>
        <div>
          <Label>Período</Label>
          <Input value={form.period} onChange={e => setForm({ ...form, period: e.target.value })} />
        </div>
        <div className="md:col-span-2">
          <Label>Motivo / Detalle</Label>
          <Textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} />
        </div>
        <div className="md:col-span-2 flex justify-end">
          <Button onClick={submit}><Save className="h-4 w-4 mr-2" />Enviar solicitud</Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------- CONTENEDOR PRINCIPAL ------------- */
export default function AcademicModule() {
  return (
    <div className="p-6 space-y-6">
      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="plans">Mallas</TabsTrigger>
          <TabsTrigger value="load">Carga & Horarios</TabsTrigger>
          <TabsTrigger value="enroll">Matrícula</TabsTrigger>
          <TabsTrigger value="grades">Notas/Asistencia</TabsTrigger>
          <TabsTrigger value="kardex">Kárdex</TabsTrigger>
          <TabsTrigger value="processes">Procesos</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard"><SmallAcademicDashboard /></TabsContent>
        <TabsContent value="plans"><PlansAndCurricula /></TabsContent>
        <TabsContent value="load"><LoadAndSchedules /></TabsContent>
        <TabsContent value="enroll"><EnrollmentComponent /></TabsContent>
        <TabsContent value="grades"><GradesAttendanceComponent /></TabsContent>
        <TabsContent value="kardex"><KardexAndCertificates /></TabsContent>
        <TabsContent value="processes"><AcademicProcesses /></TabsContent>
      </Tabs>
    </div>
  );
}
