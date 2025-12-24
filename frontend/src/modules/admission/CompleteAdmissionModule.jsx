// src/modules/admission/CompleteAdmissionModule.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

/* UI */
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { toast } from "sonner";
import { Plus, Eye, Edit, Download } from "lucide-react";

/* Submódulos reales */
import AdmissionDashboard from "./AdmissionDashboard";
import AdmissionReportsModule from "./AdmissionReports";
import AdmissionParamsModule from "./AdmissionParams";
import ApplicantDocuments from "./ApplicantDocuments";
import ApplicationWizard from "./ApplicationWizard";
import EvaluationBoard from "./EvaluationBoard";
import ResultsPublication from "./ResultsPublication";
import AdmissionCallsManagement from "./AdmissionCallsManagement";
import DocumentReview from "./DocumentReview";
import AdmissionScheduleModule from "./AdmissionSchedule";
import PaymentsManagement from "./PaymentsManagement";
import AdmissionCertificates from "./AdmissionCertificates";


/* Helpers */
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
const toIntOr = (v, def = null) => (Number.isFinite(+v) ? +v : def);

/* --------- Careers (inline) --------- */
const CareersManagement = () => {
  const { api } = useAuth();

  const [careers, setCareers] = useState([]);
  const [loading, setLoading] = useState(true);

  // create
  const [openCreate, setOpenCreate] = useState(false);
  const [form, setForm] = useState({
    name: "", code: "", description: "",
    duration_semesters: 10, degree_type: "BACHELOR", modality: "PRESENCIAL",
    vacancies: 25, is_active: true
  });

  // view
  const [openView, setOpenView] = useState(false);
  const [viewRow, setViewRow] = useState(null);

  // edit
  const [openEdit, setOpenEdit] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [editForm, setEditForm] = useState(form);

  const toIntOr = (v, def = 0) => (Number.isFinite(+v) ? +v : def);

  const load = async () => {
    try {
      const { data } = await api.get("/careers");
      // backend devuelve lista simple
      setCareers(Array.isArray(data) ? data : (data?.careers ?? []));
    } catch (e) {
      toast.error(formatApiError(e, "Error al cargar carreras"));
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const resetCreate = () =>
    setForm({ name: "", code: "", description: "", duration_semesters: 10, degree_type: "BACHELOR", modality: "PRESENCIAL", vacancies: 25, is_active: true });

  const submitCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post("/careers", {
        ...form,
        duration_semesters: toIntOr(form.duration_semesters, 0),
        vacancies: toIntOr(form.vacancies, 0),
      });
      toast.success("Carrera creada");
      setOpenCreate(false);
      resetCreate();
      load();
    } catch (e) {
      toast.error(formatApiError(e, "Error al crear carrera"));
    }
  };

  const openDetails = (row) => {
    setViewRow(row);
    setOpenView(true);
  };

  const openEditor = async (row) => {
    try {
      const { data } = await api.get(`/careers/${row.id}`);
      setEditRow(data);
      setEditForm({
        name: data.name ?? "",
        code: data.code ?? "",
        description: data.description ?? "",
        duration_semesters: data.duration_semesters ?? 0,
        degree_type: data.degree_type ?? "BACHELOR",
        modality: data.modality ?? "PRESENCIAL",
        vacancies: data.vacancies ?? 0,
        is_active: !!data.is_active,
      });
      setOpenEdit(true);
    } catch (e) {
      toast.error(formatApiError(e, "No se pudo abrir el editor"));
    }
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    if (!editRow) return;
    try {
      await api.put(`/careers/${editRow.id}`, {
        ...editForm,
        duration_semesters: toIntOr(editForm.duration_semesters, 0),
        vacancies: toIntOr(editForm.vacancies, 0),
      });
      toast.success("Carrera actualizada");
      setOpenEdit(false);
      setEditRow(null);
      load();
    } catch (e) {
      toast.error(formatApiError(e, "Error al actualizar"));
    }
  };

  const toggleActive = async (row) => {
    try {
      const { data } = await api.post(`/careers/${row.id}/toggle`);
      setCareers((prev) => prev.map((c) => (c.id === row.id ? data : c)));
      toast.success(`Carrera ${data.is_active ? "activada" : "inactivada"}`);
    } catch (e) {
      toast.error(formatApiError(e, "No se pudo cambiar el estado"));
    }
  };

  const removeCareer = async (row) => {
    if (!window.confirm(`Eliminar "${row.name}"? Esta acción no se puede deshacer.`)) return;
    try {
      await api.delete(`/careers/${row.id}`);
      toast.success("Carrera eliminada");
      setCareers((prev) => prev.filter((c) => c.id !== row.id));
    } catch (e) {
      toast.error(formatApiError(e, "No se pudo eliminar"));
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Gestión de Carreras Profesionales</h2>
        <Button onClick={() => setOpenCreate(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" /> Nueva Carrera
        </Button>
      </div>

      {/* Crear */}
      {openCreate && (
        <Card className="p-4">
          <form onSubmit={submitCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Nombre *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
              <div><Label>Código *</Label><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} required /></div>
            </div>
            <div><Label>Descripción</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-4 gap-4">
              <div><Label>Duración (sem.) *</Label><Input type="number" min="1" max="20" value={form.duration_semesters} onChange={e => setForm({ ...form, duration_semesters: e.target.value })} /></div>
              <div><Label>Vacantes *</Label><Input type="number" min="0" value={form.vacancies} onChange={e => setForm({ ...form, vacancies: e.target.value })} /></div>
              <div>
                <Label>Tipo de Grado *</Label>
                <Select value={form.degree_type} onValueChange={(v) => setForm({ ...form, degree_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BACHELOR">Bachiller</SelectItem>
                    <SelectItem value="TECHNICAL">Técnico</SelectItem>
                    <SelectItem value="PROFESSIONAL">Profesional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Modalidad *</Label>
                <Select value={form.modality} onValueChange={(v) => setForm({ ...form, modality: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRESENCIAL">Presencial</SelectItem>
                    <SelectItem value="VIRTUAL">Virtual</SelectItem>
                    <SelectItem value="SEMIPRESENCIAL">Semipresencial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpenCreate(false)}>Cancelar</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Crear</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Carrera</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duración</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vacantes</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {careers.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium">{c.name}</div>
                      <div className="text-xs text-gray-500">{c.description}</div>
                    </td>
                    <td className="px-6 py-4 text-sm">{c.code}</td>
                    <td className="px-6 py-4 text-sm">{c.duration_semesters} semestres</td>
                    <td className="px-6 py-4 text-sm">{c.vacancies ?? 0}</td>
                    <td className="px-6 py-4">
                      <Badge variant={c.is_active ? "default" : "secondary"}>
                        {c.is_active ? "Activa" : "Inactiva"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => openDetails(c)}>
                          <Eye className="h-4 w-4 mr-2" /> Ver
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openEditor(c)}>
                          <Edit className="h-4 w-4 mr-2" /> Editar
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => toggleActive(c)}>
                          {c.is_active ? "Desactivar" : "Activar"}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => removeCareer(c)}>
                          Eliminar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {careers.length === 0 && (
                  <tr><td className="px-6 py-6 text-center text-sm text-gray-500" colSpan={6}>Sin carreras</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Ver detalle */}
      <Dialog open={openView} onOpenChange={setOpenView}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalle de carrera</DialogTitle>
            <DialogDescription>Información completa</DialogDescription>
          </DialogHeader>
          {viewRow && (
            <div className="space-y-2 text-sm">
              <div className="text-lg font-semibold">{viewRow.name}</div>
              <div className="text-gray-600">{viewRow.description || "—"}</div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div><span className="font-medium">Código:</span> {viewRow.code}</div>
                <div><span className="font-medium">Modalidad:</span> {viewRow.modality}</div>
                <div><span className="font-medium">Tipo de grado:</span> {viewRow.degree_type}</div>
                <div><span className="font-medium">Duración:</span> {viewRow.duration_semesters} sem.</div>
                <div><span className="font-medium">Vacantes:</span> {viewRow.vacancies ?? 0}</div>
                <div><span className="font-medium">Estado:</span> {viewRow.is_active ? "Activa" : "Inactiva"}</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Editar */}
      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar carrera</DialogTitle>
          </DialogHeader>

          {editRow && (
            <form onSubmit={submitEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Nombre *</Label><Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} required /></div>
                <div><Label>Código *</Label><Input value={editForm.code} onChange={e => setEditForm({ ...editForm, code: e.target.value })} required /></div>
              </div>
              <div><Label>Descripción</Label><Textarea value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} /></div>
              <div className="grid grid-cols-4 gap-4">
                <div><Label>Duración (sem.) *</Label><Input type="number" min="1" max="20" value={editForm.duration_semesters} onChange={e => setEditForm({ ...editForm, duration_semesters: e.target.value })} /></div>
                <div><Label>Vacantes *</Label><Input type="number" min="0" value={editForm.vacancies} onChange={e => setEditForm({ ...editForm, vacancies: e.target.value })} /></div>
                <div>
                  <Label>Tipo de Grado *</Label>
                  <Select value={editForm.degree_type} onValueChange={(v) => setEditForm({ ...editForm, degree_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BACHELOR">Bachiller</SelectItem>
                      <SelectItem value="TECHNICAL">Técnico</SelectItem>
                      <SelectItem value="PROFESSIONAL">Profesional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Modalidad *</Label>
                  <Select value={editForm.modality} onValueChange={(v) => setEditForm({ ...editForm, modality: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PRESENCIAL">Presencial</SelectItem>
                      <SelectItem value="VIRTUAL">Virtual</SelectItem>
                      <SelectItem value="SEMIPRESENCIAL">Semipresencial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input id="car_is_active" type="checkbox" checked={!!editForm.is_active} onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })} />
                <Label htmlFor="car_is_active">Activa</Label>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpenEdit(false)}>Cancelar</Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Guardar cambios</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};


/* --------- Applicants (inline) --------- */
const ApplicantsManagement = () => {
  const { api } = useAuth();

  const [rows, setRows] = useState([]);
  const [calls, setCalls] = useState([]);
  const [careers, setCareers] = useState([]);
  const [loading, setLoading] = useState(true);

  // filtros
  const [callFilter, setCallFilter] = useState("");
  const [careerFilter, setCareerFilter] = useState("");

  // crear
  const [openCreate, setOpenCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ call_id: "", career_id: "" });

  // ver detalle
  const [openView, setOpenView] = useState(false);
  const [viewRow, setViewRow] = useState(null);

  const callName = (id) => calls.find(c => String(c.id) === String(id))?.name ?? `Convocatoria ${id ?? "—"}`;
  const careerName = (id) => careers.find(c => String(c.id) === String(id))?.name ?? `Carrera ${id ?? "—"}`;

  const fetchAll = async () => {
    try {
      const [appsRes, callsRes, careersRes] = await Promise.all([
        api.get(`/applications${buildQuery()}`),
        api.get("/admission-calls"),
        api.get("/careers"),
      ]);

      const apps = appsRes?.data?.applications ?? appsRes?.data ?? [];
      const nCalls = Array.isArray(callsRes?.data) ? callsRes.data : (callsRes?.data?.calls ?? callsRes?.data ?? []);
      const nCareers = Array.isArray(careersRes?.data) ? careersRes.data : (careersRes?.data?.careers ?? careersRes?.data ?? []);

      setRows(apps);
      setCalls(nCalls);
      setCareers(nCareers);
    } catch (e) {
      toast.error(formatApiError(e, "Error al cargar postulantes"));
    } finally {
      setLoading(false);
    }
  };

  const buildQuery = () => {
    const params = new URLSearchParams();
    if (callFilter) params.set("call_id", callFilter);
    if (careerFilter) params.set("career_id", careerFilter);
    const q = params.toString();
    return q ? `?${q}` : "";
  };

  useEffect(() => { fetchAll(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { setLoading(true); fetchAll(); /* eslint-disable-next-line */ }, [callFilter, careerFilter]);

  const openDetails = (row) => {
    setViewRow(row);
    setOpenView(true);
  };

  const submitCreate = async (e) => {
    e.preventDefault();
    if (!createForm.call_id || !createForm.career_id) {
      toast.error("Selecciona convocatoria y carrera");
      return;
    }
    try {
      await api.post("/applications", {
        call_id: Number(createForm.call_id),
        career_id: Number(createForm.career_id),
      });
      toast.success("Postulación creada");
      setOpenCreate(false);
      setCreateForm({ call_id: "", career_id: "" });
      setLoading(true);
      fetchAll();
    } catch (e) {
      toast.error(formatApiError(e, "No se pudo crear la postulación"));
    }
  };

  const exportXlsx = async () => {
    try {
      const { data } = await api.get("/reports/admission.xlsx", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = "admission.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(formatApiError(e, "No se pudo exportar"));
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header + acciones */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <h2 className="text-2xl font-bold">Gestión de Postulantes</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportXlsx}>
            <Download className="h-4 w-4 mr-2" />Exportar
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setOpenCreate(true)}>
            <Plus className="h-4 w-4 mr-2" />Nuevo
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Convocatoria</Label>
              <Select
                value={callFilter || "__all__"}
                onValueChange={(v) => setCallFilter(v === "__all__" ? "" : v)}
              >
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>
                  {calls
                    .filter(c => c?.id != null)
                    .map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>

            </div>
            <div>
              <Label>Carrera</Label>
              <Select
                value={careerFilter || "__all__"}
                onValueChange={(v) => setCareerFilter(v === "__all__" ? "" : v)}
              >
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>
                  {careers
                    .filter(c => c?.id != null)
                    .map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>

            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={() => { setCallFilter(""); setCareerFilter(""); }}>
                Limpiar filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Convocatoria</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Carrera</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rows.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium">#{r.id}</td>
                    <td className="px-6 py-4 text-sm">{callName(r.call_id)}</td>
                    <td className="px-6 py-4 text-sm">{careerName(r.career_id)}</td>
                    <td className="px-6 py-4"><Badge variant="default">{r.status ?? "CREATED"}</Badge></td>
                    <td className="px-6 py-4 text-sm">{r.created_at ? new Date(r.created_at).toLocaleString() : "-"}</td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openDetails(r)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {/* Si luego agregas edición de aplicación, activa este botón */}
                        {/* <Button variant="ghost" size="sm"><Edit className="h-4 w-4" /></Button> */}
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td className="px-6 py-6 text-center text-sm text-gray-500" colSpan={6}>Sin registros</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Crear postulación */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nueva Postulación</DialogTitle>
            <DialogDescription>Selecciona convocatoria y carrera</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitCreate} className="space-y-4">
            <div>
              <Label>Convocatoria *</Label>
              <Select
                value={createForm.call_id}
                onValueChange={(v) => setCreateForm(f => ({ ...f, call_id: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
                <SelectContent>
                  {calls.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Carrera *</Label>
              <Select
                value={createForm.career_id}
                onValueChange={(v) => setCreateForm(f => ({ ...f, career_id: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
                <SelectContent>
                  {careers.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpenCreate(false)}>Cancelar</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Crear</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Ver detalle */}
      <Dialog open={openView} onOpenChange={setOpenView}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalle de Postulación</DialogTitle>
          </DialogHeader>
          {viewRow && (
            <div className="space-y-2 text-sm">
              <div><span className="font-medium">ID:</span> #{viewRow.id}</div>
              <div><span className="font-medium">Convocatoria:</span> {callName(viewRow.call_id)}</div>
              <div><span className="font-medium">Carrera:</span> {careerName(viewRow.career_id)}</div>
              <div><span className="font-medium">Estado:</span> {viewRow.status ?? "CREATED"}</div>
              <div><span className="font-medium">Fecha:</span> {viewRow.created_at ? new Date(viewRow.created_at).toLocaleString() : "—"}</div>
              <div><span className="font-medium">Total:</span> {Number.isFinite(viewRow.total) ? viewRow.total : "—"}</div>
              <div><span className="font-medium">Admitido:</span> {viewRow.admitted ? "Sí" : "No"}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};


/* --------- Contenedor principal con tabs sincronizadas en URL --------- */
export default function CompleteAdmissionModule() {
  const { user } = useAuth();
  const { tab } = useParams();
  const navigate = useNavigate();

  const [active, setActive] = useState(tab ?? "dashboard");
  useEffect(() => setActive(tab ?? "dashboard"), [tab]);

  const onTabChange = (v) => {
    setActive(v);
    navigate(`/dashboard/admission/${v}`, { replace: true });
  };

  if (!user) return <div>Acceso no autorizado</div>;

return (
  <div className="p-6 box-border flex justify-center">
    {/* 1. CONTENEDOR: Usamos 'max-h' en vez de 'h' para que no ocupe espacio vacío */}
    <div className="w-full rounded-2xl p-[1px] bg-gradient-to-b from-slate-500/30 to-slate-900/10 max-h-[calc(100vh-3rem)] flex flex-col">
      
      {/* 2. TARJETA: Restauramos color 70 y ajustamos el flex */}
      <div className="rounded-2xl bg-slate-200/70 backdrop-blur-md border border-white/30 shadow-[0_10px_35px_rgba(0,0,0,0.18)] flex flex-col overflow-hidden max-h-full">
        
        {/* HEADER (Se queda quieto) */}
        <div className="px-6 pt-5 flex-none">
          <h1 className="text-xl font-bold text-slate-900">
            Módulo Admisión
          </h1>
          <p className="text-sm text-slate-700">
            Gestión de convocatorias, postulantes, documentos, evaluación y resultados.
          </p>
          <div className="mt-3 h-px w-full bg-white/60" />
        </div>

        {/* TABS */}
        <Tabs value={active} onValueChange={onTabChange} className="px-6 pt-4 flex flex-col overflow-hidden">
          
          {/* BARRA DE MENU (Se queda quieta) */}
          <div className="rounded-xl bg-slate-100/80 border border-white/60 px-2 py-2 flex-none mb-4">
            <TabsList className="w-full bg-transparent p-0 flex flex-wrap gap-2">
              <TabsTrigger value="dashboard" className="rounded-lg text-slate-800 data-[state=active]:bg-white data-[state=active]:shadow-sm">Dashboard</TabsTrigger>
              <TabsTrigger value="careers" className="rounded-lg text-slate-800 data-[state=active]:bg-white data-[state=active]:shadow-sm">Carreras</TabsTrigger>
              <TabsTrigger value="calls" className="rounded-lg text-slate-800 data-[state=active]:bg-white data-[state=active]:shadow-sm">Convocatorias</TabsTrigger>
              <TabsTrigger value="applicants" className="rounded-lg text-slate-800 data-[state=active]:bg-white data-[state=active]:shadow-sm">Postulantes</TabsTrigger>
              <TabsTrigger value="apply" className="rounded-lg text-slate-800 data-[state=active]:bg-white data-[state=active]:shadow-sm">Postulación</TabsTrigger>
              <TabsTrigger value="docs" className="rounded-lg text-slate-800 data-[state=active]:bg-white data-[state=active]:shadow-sm">Documentos</TabsTrigger>
              <TabsTrigger value="doc-review" className="rounded-lg text-slate-800 data-[state=active]:bg-white data-[state=active]:shadow-sm">Revisión Docs</TabsTrigger>
              <TabsTrigger value="eval" className="rounded-lg text-slate-800 data-[state=active]:bg-white data-[state=active]:shadow-sm">Evaluación</TabsTrigger>
              <TabsTrigger value="results" className="rounded-lg text-slate-800 data-[state=active]:bg-white data-[state=active]:shadow-sm">Resultados</TabsTrigger>
              <TabsTrigger value="schedule" className="rounded-lg text-slate-800 data-[state=active]:bg-white data-[state=active]:shadow-sm">Cronograma</TabsTrigger>
              <TabsTrigger value="certificates" className="rounded-lg text-slate-800 data-[state=active]:bg-white data-[state=active]:shadow-sm">Constancias</TabsTrigger>
              <TabsTrigger value="reports" className="rounded-lg text-slate-800 data-[state=active]:bg-white data-[state=active]:shadow-sm">Reportes</TabsTrigger>
              <TabsTrigger value="payments" className="rounded-lg text-slate-800 data-[state=active]:bg-white data-[state=active]:shadow-sm">Pagos</TabsTrigger>
              <TabsTrigger value="params" className="rounded-lg text-slate-800 data-[state=active]:bg-white data-[state=active]:shadow-sm">Parámetros</TabsTrigger>
            </TabsList>
          </div>

          {/* 3. ZONA DE CONTENIDO: 
              - 'overflow-y-auto': Activa el scroll si se pasa del alto.
              - Quitamos 'flex-1' forzado para que no estire la caja si no hay contenido.
          */}
          <div className="overflow-y-auto pb-6 pr-1 custom-scrollbar">
            <TabsContent value="dashboard" className="mt-0"><AdmissionDashboard /></TabsContent>
            <TabsContent value="careers" className="mt-0"><CareersManagement /></TabsContent>
            <TabsContent value="calls" className="mt-0"><AdmissionCallsManagement /></TabsContent>
            <TabsContent value="applicants" className="mt-0"><ApplicantsManagement /></TabsContent>
            <TabsContent value="doc-review" className="mt-0"><DocumentReview /></TabsContent>
            <TabsContent value="apply" className="mt-0"><ApplicationWizard /></TabsContent>
            <TabsContent value="docs" className="mt-0"><ApplicantDocuments /></TabsContent>
            <TabsContent value="eval" className="mt-0"><EvaluationBoard /></TabsContent>
            <TabsContent value="results" className="mt-0"><ResultsPublication /></TabsContent>
            <TabsContent value="schedule" className="mt-0"><AdmissionScheduleModule /></TabsContent>
            <TabsContent value="payments" className="mt-0"><PaymentsManagement /></TabsContent>
            <TabsContent value="certificates" className="mt-0"><AdmissionCertificates /></TabsContent>
            <TabsContent value="reports" className="mt-0"><AdmissionReportsModule /></TabsContent>
            <TabsContent value="params" className="mt-0"><AdmissionParamsModule /></TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  </div>
);


}
