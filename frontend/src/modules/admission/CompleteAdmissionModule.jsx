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
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", code: "", description: "",
    duration_semesters: 10, degree_type: "BACHELOR", modality: "PRESENCIAL",
    vacancies: 25, is_active: true
  });

  const load = async () => {
    try {
      const { data } = await api.get("/careers");
      setCareers(data?.careers ?? data ?? []);
    } catch (e) {
      toast.error(formatApiError(e, "Error al cargar carreras"));
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/careers", {
        ...form,
        duration_semesters: toIntOr(form.duration_semesters, 0),
        vacancies: toIntOr(form.vacancies, 0)
      });
      toast.success("Carrera creada");
      setOpen(false);
      setForm({ name: "", code: "", description: "", duration_semesters: 10, degree_type: "BACHELOR", modality: "PRESENCIAL", vacancies: 25, is_active: true });
      load();
    } catch (e) {
      toast.error(formatApiError(e, "Error al crear carrera"));
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
        <Button onClick={() => setOpen(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" /> Nueva Carrera
        </Button>
      </div>

      {open && (
        <Card className="p-4">
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Nombre *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
              <div><Label>Código *</Label><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} required /></div>
            </div>
            <div><Label>Descripción</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-4 gap-4">
              <div><Label>Duración (sem.) *</Label><Input type="number" min="1" max="20" value={form.duration_semesters} onChange={e => setForm({ ...form, duration_semesters: e.target.value })} /></div>
              <div><Label>Vacantes *</Label><Input type="number" min="1" value={form.vacancies} onChange={e => setForm({ ...form, vacancies: e.target.value })} /></div>
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
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Crear</Button>
            </div>
          </form>
        </Card>
      )}

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
                  <th className="px-6 py-3"></th>
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
                    <td className="px-6 py-4 text-sm">{c.vacancies ?? "N/A"}</td>
                    <td className="px-6 py-4">
                      <Badge variant={c.is_active ? "default" : "secondary"}>{c.is_active ? "Activa" : "Inactiva"}</Badge>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm"><Edit className="h-4 w-4" /></Button>
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
    </div>
  );
};

/* --------- Applicants (inline) --------- */
const ApplicantsManagement = () => {
  const { api } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/applications");
        setRows(data?.applications ?? data ?? []);
      } catch (e) {
        toast.error(formatApiError(e, "Error al cargar datos"));
      } finally { setLoading(false); }
    })();
  }, [api]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Gestión de Postulantes</h2>
        <div className="flex gap-2">
          <Button variant="outline"><Download className="h-4 w-4 mr-2" />Exportar</Button>
          <Button className="bg-blue-600 hover:bg-blue-700"><Plus className="h-4 w-4 mr-2" />Nuevo</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Postulante</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Carrera</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rows.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium">{r.applicant_name}</div>
                      <div className="text-xs text-gray-500">{r.document_number}</div>
                    </td>
                    <td className="px-6 py-4 text-sm">{r.career_name ?? r.career?.name ?? "N/A"}</td>
                    <td className="px-6 py-4"><Badge variant="default">{r.status ?? "Registrado"}</Badge></td>
                    <td className="px-6 py-4 text-sm">{r.created_at ? new Date(r.created_at).toLocaleDateString() : "-"}</td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm"><Edit className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td className="px-6 py-6 text-center text-sm text-gray-500" colSpan={5}>Sin registros</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
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
    <div className="p-6">
      <Tabs value={active} onValueChange={onTabChange} className="space-y-6">
        <TabsList className="grid w-full grid-cols-12">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="careers">Carreras</TabsTrigger>
          <TabsTrigger value="calls">Convocatorias</TabsTrigger>
          <TabsTrigger value="applicants">Postulantes</TabsTrigger>
          <TabsTrigger value="apply">Postulación</TabsTrigger>
          <TabsTrigger value="docs">Documentos</TabsTrigger>
          <TabsTrigger value="doc-review">Revisión Docs</TabsTrigger>
          <TabsTrigger value="eval">Evaluación</TabsTrigger>
          <TabsTrigger value="results">Resultados</TabsTrigger>
          <TabsTrigger value="schedule">Cronograma</TabsTrigger>
          <TabsTrigger value="certificates">Constancias</TabsTrigger>
          <TabsTrigger value="reports">Reportes</TabsTrigger>
          <TabsTrigger value="payments">Pagos</TabsTrigger>
          <TabsTrigger value="params">Parámetros</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard"><AdmissionDashboard /></TabsContent>
        <TabsContent value="careers"><CareersManagement /></TabsContent>
        <TabsContent value="calls"><AdmissionCallsManagement /></TabsContent>
        <TabsContent value="applicants"><ApplicantsManagement /></TabsContent>
        <TabsContent value="doc-review"><DocumentReview /></TabsContent>

        <TabsContent value="apply"><ApplicationWizard /></TabsContent>
        <TabsContent value="docs"><ApplicantDocuments /></TabsContent>
        <TabsContent value="eval"><EvaluationBoard /></TabsContent>
        <TabsContent value="results"><ResultsPublication /></TabsContent>
        <TabsContent value="schedule"><AdmissionScheduleModule /></TabsContent>
        <TabsContent value="payments"><PaymentsManagement /></TabsContent>
        <TabsContent value="certificates"><AdmissionCertificates /></TabsContent>
        <TabsContent value="reports"><AdmissionReportsModule /></TabsContent>
        <TabsContent value="params"><AdmissionParamsModule /></TabsContent>
      </Tabs>
    </div>
  );
}
