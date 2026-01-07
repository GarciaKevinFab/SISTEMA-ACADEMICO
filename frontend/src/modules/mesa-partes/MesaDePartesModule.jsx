// src/modules/mesa-partes/MesaDePartesModule.jsx
import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useAuth } from "../../context/AuthContext";
import IfPerm from "@/components/auth/IfPerm";
import { PERMS } from "@/auth/permissions";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";

import {
  FileText,
  Clock,
  CheckCircle,
  Plus,
  Search,
  Eye,
  Download,
  QrCode,
  BarChart3,
  TrendingUp,
  Send,
  Trash2,
  Paperclip,
  Pencil,
  Power,
} from "lucide-react";

import { toast } from "sonner";
import { generatePDFWithPolling, downloadFile } from "../../utils/pdfQrPolling";

import {
  Procedures as ProcSvc,
  Catalog,
  ProcedureFiles,
  ProcedureTypes,
  MesaPartesDashboard,
  MesaPartesPublic, // ✅ NUEVO: para verifyUrl()
} from "../../services/mesaPartes.service";

import MesaPartesReports from "./MesaPartesReports";

/* ---------------- helpers ---------------- */
function formatApiError(err, fallback = "Ocurrió un error") {
  // El service lanza Error("msg"), así que primero agarramos message.
  if (typeof err?.message === "string" && err.message.trim()) return err.message;

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

  return fallback;
}

/* ===================== DASHBOARD ===================== */
const MesaDePartesDashboardUI = ({ onNew, onSearch, onQR, onReports }) => {
  const { hasAny } = useAuth();
  const canSee = hasAny([PERMS["mpv.processes.review"], PERMS["mpv.reports.view"]]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchDashboardStats = useCallback(async () => {
    try {
      setLoading(true);
      const data = await MesaPartesDashboard.stats();
      setStats(data?.stats ?? data ?? {});
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      toast.error(formatApiError(error, "Error al cargar estadísticas"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canSee) fetchDashboardStats();
  }, [fetchDashboardStats, canSee]);

  if (!canSee) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-black">Mesa de Partes Digital</h2>
          <p className="text-muted-foreground">Sistema de gestión de trámites documentarios</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trámites Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending_procedures || 0}</div>
            <p className="text-xs text-muted-foreground">Requieren atención</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completados Hoy</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed_today || 0}</div>
            <p className="text-xs text-muted-foreground">Trámites finalizados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tiempo Promedio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avg_processing_time || "0"} días</div>
            <p className="text-xs text-muted-foreground">Tiempo de procesamiento</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tipos de Trámite</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.procedure_types || 0}</div>
            <p className="text-xs text-muted-foreground">Tipos disponibles</p>
          </CardContent>
        </Card>
      </div>

      {/* Acciones rápidas */}
      <Card>
        <CardHeader>
          <CardTitle>Acciones Rápidas</CardTitle>
          <CardDescription>Acceso directo a las funciones principales de Mesa de Partes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <IfPerm any={[PERMS["mpv.processes.review"]]}>
              <Button variant="outline" className="h-20 flex flex-col gap-2" onClick={onNew}>
                <Plus className="h-6 w-6" />
                <span className="text-sm">Nuevo Trámite</span>
              </Button>
            </IfPerm>

            <IfPerm any={[PERMS["mpv.processes.review"]]}>
              <Button variant="outline" className="h-20 flex flex-col gap-2" onClick={onSearch}>
                <Search className="h-6 w-6" />
                <span className="text-sm">Consultar Estado</span>
              </Button>
            </IfPerm>

            <IfPerm any={[PERMS["mpv.processes.review"]]}>
              <Button variant="outline" className="h-20 flex flex-col gap-2" onClick={onQR}>
                <QrCode className="h-6 w-6" />
                <span className="text-sm">Generar QR</span>
              </Button>
            </IfPerm>

            <IfPerm any={[PERMS["mpv.reports.view"]]}>
              <Button variant="outline" className="h-20 flex flex-col gap-2" onClick={onReports}>
                <BarChart3 className="h-6 w-6" />
                <span className="text-sm">Reportes</span>
              </Button>
            </IfPerm>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

/* ===================== TYPES ===================== */
const ProcedureTypesManagement = () => {
  const { hasPerm } = useAuth();
  const canManageTypes = hasPerm(PERMS["mpv.processes.resolve"]); // o crea "mpv.catalog.manage"

  const [procedureTypes, setProcedureTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // modal detalle/edición
  const [viewOpen, setViewOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    required_documents: "",
    processing_days: 5,
    cost: 0,
    is_active: true,
  });

  const fetchProcedureTypes = useCallback(async () => {
    try {
      setLoading(true);
      const data = await ProcedureTypes.list();
      setProcedureTypes(data?.procedure_types ?? []);
    } catch (error) {
      console.error("Error fetching procedure types:", error);
      toast.error(formatApiError(error, "Error al cargar tipos de trámite"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProcedureTypes();
  }, [fetchProcedureTypes]);

  const handleSubmitCreate = async (e) => {
    e.preventDefault();
    try {
      await ProcedureTypes.create(formData);
      toast.success("Tipo de trámite creado exitosamente");
      setIsCreateModalOpen(false);
      setFormData({
        name: "",
        description: "",
        required_documents: "",
        processing_days: 5,
        cost: 0,
        is_active: true,
      });
      fetchProcedureTypes();
    } catch (error) {
      toast.error(formatApiError(error, "Error al crear tipo de trámite"));
    }
  };

  const openView = (type) => {
    setSelected(type);
    setEditing(false);
    setViewOpen(true);
  };

  const toggleActive = async () => {
    if (!selected) return;
    try {
      const next = !selected.is_active;
      await ProcedureTypes.toggle(selected.id, next);
      toast.success(`Tipo ${next ? "activado" : "inactivado"}`);
      setSelected({ ...selected, is_active: next });
      fetchProcedureTypes();
    } catch (err) {
      toast.error(formatApiError(err, "No se pudo cambiar el estado"));
    }
  };

  const saveEdit = async (e) => {
    e?.preventDefault?.();
    if (!selected) return;
    try {
      const body = {
        name: selected.name?.trim() ?? "",
        description: selected.description ?? "",
        required_documents: selected.required_documents ?? "",
        processing_days: Number(selected.processing_days || 0),
        cost: Number(selected.cost || 0),
      };
      await ProcedureTypes.patch(selected.id, body);
      toast.success("Tipo actualizado");
      setEditing(false);
      fetchProcedureTypes();
    } catch (err) {
      toast.error(formatApiError(err, "No se pudo actualizar el tipo"));
    }
  };

  if (!canManageTypes) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Tipos de Trámite</h2>

        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Tipo de Trámite
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Tipo de Trámite</DialogTitle>
              <DialogDescription>Configure un nuevo tipo de trámite documentario</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmitCreate} className="space-y-4">
              <div>
                <Label htmlFor="name">Nombre del Trámite *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="required_documents">Documentos Requeridos</Label>
                <Textarea
                  id="required_documents"
                  value={formData.required_documents}
                  onChange={(e) =>
                    setFormData({ ...formData, required_documents: e.target.value })
                  }
                  placeholder="Liste los documentos necesarios para este trámite"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="processing_days">Días de Procesamiento *</Label>
                  <Input
                    id="processing_days"
                    type="number"
                    min="1"
                    value={formData.processing_days}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        processing_days: parseInt(e.target.value || "0", 10),
                      })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="cost">Costo (S/.) *</Label>
                  <Input
                    id="cost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.cost}
                    onChange={(e) =>
                      setFormData({ ...formData, cost: parseFloat(e.target.value || "0") })
                    }
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                  Crear Tipo de Trámite
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* List */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo de Trámite
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Días
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Costo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>

              <tbody className="bg-white divide-y divide-gray-200">
                {procedureTypes.map((type) => (
                  <tr key={type.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{type.name}</div>
                        <div className="text-sm text-gray-500">{type.description}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {type.processing_days} días
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      S/. {(Number(type.cost) || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={type.is_active ? "default" : "secondary"}>
                        {type.is_active ? "Activo" : "Inactivo"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openView(type)} title="Ver / Editar">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>

            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal Ver/Editar */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar Tipo de Trámite" : `Detalle: ${selected?.name ?? ""}`}
            </DialogTitle>
            {!editing && <DialogDescription>Revise la configuración del tipo de trámite</DialogDescription>}
          </DialogHeader>

          {selected && (
            <form onSubmit={saveEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nombre</Label>
                  <Input
                    disabled={!editing}
                    value={selected.name || ""}
                    onChange={(e) => setSelected({ ...selected, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Días de Procesamiento</Label>
                  <Input
                    type="number"
                    min="1"
                    disabled={!editing}
                    value={selected.processing_days ?? 1}
                    onChange={(e) =>
                      setSelected({
                        ...selected,
                        processing_days: parseInt(e.target.value || "0", 10),
                      })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Costo (S/.)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    disabled={!editing}
                    value={selected.cost ?? 0}
                    onChange={(e) =>
                      setSelected({ ...selected, cost: parseFloat(e.target.value || "0") })
                    }
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Badge variant={selected.is_active ? "default" : "secondary"}>
                    {selected.is_active ? "Activo" : "Inactivo"}
                  </Badge>
                </div>
              </div>

              <div>
                <Label>Descripción</Label>
                <Textarea
                  disabled={!editing}
                  value={selected.description ?? ""}
                  onChange={(e) => setSelected({ ...selected, description: e.target.value })}
                />
              </div>

              <div>
                <Label>Documentos Requeridos</Label>
                <Textarea
                  disabled={!editing}
                  value={selected.required_documents ?? ""}
                  onChange={(e) => setSelected({ ...selected, required_documents: e.target.value })}
                />
              </div>

              <div className="flex justify-between pt-2">
                <Button type="button" variant="outline" onClick={toggleActive}>
                  <Power className="h-4 w-4 mr-2" />
                  {selected.is_active ? "Inactivar" : "Activar"}
                </Button>

                <div className="flex gap-2">
                  {!editing ? (
                    <Button type="button" onClick={() => setEditing(true)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Editar
                    </Button>
                  ) : (
                    <>
                      <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit">Guardar</Button>
                    </>
                  )}
                </div>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* ===================== DETAIL DIALOG ===================== */
const ProcedureDetailDialog = ({ open, onOpenChange, procedureId, onChanged }) => {
  const { hasPerm } = useAuth();
  const canResolve = hasPerm(PERMS["mpv.processes.resolve"]);
  const canUpload = hasPerm(PERMS["mpv.files.upload"]);
  const canReview = hasPerm(PERMS["mpv.processes.review"]);

  const [loading, setLoading] = useState(false);
  const [proc, setProc] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [offices, setOffices] = useState([]);
  const [users, setUsers] = useState([]);

  // Archivos
  const [files, setFiles] = useState([]);
  const fetchFiles = useCallback(async () => {
    if (!proc?.id) return;
    const d = await ProcedureFiles.list(proc.id);
    setFiles(d?.files ?? []);
  }, [proc?.id]);

  const uploadFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !proc?.id) return;
    try {
      await ProcedureFiles.upload(proc.id, file, {});
      toast.success("Archivo subido");
      await fetchFiles();
    } catch (err) {
      toast.error(formatApiError(err, "No se pudo subir el archivo"));
    } finally {
      e.target.value = "";
    }
  };

  const deleteFile = async (f) => {
    if (!proc?.id) return;
    try {
      await ProcedureFiles.remove(proc.id, f.id);
      toast.success("Archivo eliminado");
      await fetchFiles();
    } catch (err) {
      toast.error(formatApiError(err, "No se pudo eliminar el archivo"));
    }
  };

  const [routeForm, setRouteForm] = useState({
    to_office_id: "",
    assignee_id: "",
    deadline_at: "",
    note: "",
  });
  const [statusForm, setStatusForm] = useState({ status: "IN_REVIEW", note: "" });
  const [notifyForm, setNotifyForm] = useState({ channels: ["EMAIL"], subject: "", message: "" });

  const load = useCallback(async () => {
    if (!procedureId || !canReview) return;
    try {
      setLoading(true);
      const [p, t, o, u] = await Promise.all([
        ProcSvc.get(procedureId),
        ProcSvc.timeline(procedureId),
        Catalog.offices(),
        Catalog.users({ role: "STAFF" }),
      ]);

      const procData = p?.procedure || p;
      setProc(procData);

      const tArr = Array.isArray(t?.timeline) ? t.timeline : Array.isArray(t) ? t : [];
      setTimeline(tArr);

      const officesArr = Array.isArray(o?.offices) ? o.offices : Array.isArray(o) ? o : [];
      const usersArr = Array.isArray(u?.users) ? u.users : Array.isArray(u) ? u : [];
      setOffices(officesArr);
      setUsers(usersArr);
    } catch (e) {
      toast.error(formatApiError(e, "No se pudo cargar el detalle"));
    } finally {
      setLoading(false);
    }
  }, [procedureId, canReview]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  useEffect(() => {
    if (open && proc?.id) fetchFiles();
  }, [open, proc?.id, fetchFiles]);

  const doRoute = async () => {
    try {
      await ProcSvc.route(proc.id, {
        to_office_id: Number(routeForm.to_office_id),
        assignee_id: routeForm.assignee_id ? Number(routeForm.assignee_id) : null,
        note: routeForm.note,
        deadline_at: routeForm.deadline_at || null,
      });
      toast.success("Trámite derivado");
      await load();
      onChanged?.();
    } catch (e) {
      toast.error(formatApiError(e, "No se pudo derivar"));
    }
  };

  const doStatus = async () => {
    try {
      await ProcSvc.setStatus(proc.id, statusForm);
      toast.success("Estado actualizado");
      await load();
      onChanged?.();
    } catch (e) {
      toast.error(formatApiError(e, "No se pudo actualizar estado"));
    }
  };

  const doNotify = async () => {
    try {
      await ProcSvc.notify(proc.id, notifyForm);
      toast.success("Notificación enviada");
    } catch (e) {
      toast.error(formatApiError(e, "No se pudo notificar"));
    }
  };

  // PDFs (polling)
  const genCover = async () => {
    const id = proc?.id ?? procedureId;
    if (!id) return toast.error("No se pudo obtener el ID del trámite");
    try {
      const r = await generatePDFWithPolling(`/procedures/${id}/cover`, {}, { testId: "cover-pdf" });
      if (r?.success && r.downloadUrl) {
        await downloadFile(r.downloadUrl, `caratula-${proc?.tracking_code || id}.pdf`);
        toast.success("Carátula generada");
      } else {
        toast.error("No se pudo generar la carátula");
      }
    } catch (e) {
      console.error("cover error:", e);
      toast.error("Error al generar carátula");
    }
  };

  const genCargo = async () => {
    const id = proc?.id ?? procedureId;
    if (!id) return toast.error("No se pudo obtener el ID del trámite");
    try {
      const r = await generatePDFWithPolling(`/procedures/${id}/cargo`, {}, { testId: "cargo-pdf" });
      if (r?.success && r.downloadUrl) {
        await downloadFile(r.downloadUrl, `cargo-${proc?.tracking_code || id}.pdf`);
        toast.success("Cargo generado");
      } else {
        toast.error("No se pudo generar el cargo");
      }
    } catch (e) {
      console.error("cargo error:", e);
      toast.error("Error al generar cargo");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Trámite {proc?.tracking_code || ""}</DialogTitle>
          <DialogDescription>Derivación, plazos, estado y trazabilidad</DialogDescription>
        </DialogHeader>

        {!canReview ? (
          <div className="p-4 text-sm text-muted-foreground">
            No tienes permiso para ver el detalle del trámite.
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          </div>
        ) : proc ? (
          <div className="grid md:grid-cols-2 gap-6">
            {/* IZQ */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Resumen</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div>
                    <b>Solicitante:</b> {proc.applicant_name} ({proc.applicant_document})
                  </div>
                  <div>
                    <b>Tipo:</b> {proc.procedure_type_name}
                  </div>
                  <div>
                    <b>Estado:</b> <Badge>{proc.status}</Badge>
                  </div>
                  <div>
                    <b>Oficina actual:</b> {proc.current_office_name || "-"}
                  </div>
                  <div>
                    <b>Responsable:</b> {proc.assignee_name || "-"}
                  </div>
                  <div>
                    <b>Vence:</b>{" "}
                    {proc.deadline_at ? new Date(proc.deadline_at).toLocaleString() : "-"}
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" onClick={genCover}>
                      <FileText className="h-4 w-4 mr-2" />
                      Carátula
                    </Button>
                    <Button variant="outline" onClick={genCargo}>
                      <FileText className="h-4 w-4 mr-2" />
                      Cargo
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Trazabilidad</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 max-h-[320px] overflow-y-auto">
                  {(!Array.isArray(timeline) || timeline.length === 0) && (
                    <div className="text-sm text-gray-500">Sin eventos</div>
                  )}

                  {Array.isArray(timeline) &&
                    timeline.map((ev, i) => (
                      <div key={i} className="border rounded p-2">
                        <div className="text-xs text-gray-500">
                          {ev?.at ? new Date(ev.at).toLocaleString() : "-"}
                        </div>
                        <div className="text-sm">
                          <b>{ev.type}</b> — {ev.description}
                        </div>
                        {ev.actor_name && (
                          <div className="text-xs text-gray-500">Por: {ev.actor_name}</div>
                        )}
                      </div>
                    ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Documentos adjuntos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept="application/pdf,image/*"
                      onChange={uploadFile}
                      disabled={!canUpload}
                    />
                    {!canUpload && (
                      <span className="text-xs text-muted-foreground">
                        No tienes permiso para subir archivos
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 max-h-[240px] overflow-y-auto">
                    {files.length === 0 && (
                      <div className="text-sm text-gray-500">Sin archivos</div>
                    )}
                    {files.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between border rounded p-2 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <Paperclip className="h-4 w-4" />
                          <a
                            href={f.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 underline"
                          >
                            {f.filename || f.original_name || "archivo"}
                          </a>
                          <span className="text-xs text-gray-500">
                            {f.doc_type ? `· ${f.doc_type}` : ""}{" "}
                            {f.size ? `· ${Math.round(f.size / 1024)} KB` : ""}
                          </span>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteFile(f)}
                          disabled={!canUpload}
                          title={!canUpload ? "Sin permiso para eliminar" : ""}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* DER */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Derivar</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label>Oficina destino</Label>
                    <Select
                      value={routeForm.to_office_id || undefined}
                      onValueChange={(v) => setRouteForm({ ...routeForm, to_office_id: v })}
                      disabled={!canResolve}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {(Array.isArray(offices) ? offices : []).map((o) => (
                          <SelectItem key={o.id} value={String(o.id)}>
                            {o.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Responsable (opcional)</Label>
                    <Select
                      value={routeForm.assignee_id || undefined}
                      onValueChange={(v) => setRouteForm({ ...routeForm, assignee_id: v })}
                      disabled={!canResolve}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {(Array.isArray(users) ? users : []).map((u) => (
                          <SelectItem key={u.id} value={String(u.id)}>
                            {u.full_name || u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Vence el</Label>
                    <Input
                      type="datetime-local"
                      value={routeForm.deadline_at}
                      onChange={(e) => setRouteForm({ ...routeForm, deadline_at: e.target.value })}
                      disabled={!canResolve}
                    />
                  </div>

                  <div>
                    <Label>Nota</Label>
                    <Textarea
                      rows={2}
                      value={routeForm.note}
                      onChange={(e) => setRouteForm({ ...routeForm, note: e.target.value })}
                      disabled={!canResolve}
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button
                      onClick={doRoute}
                      disabled={!canResolve}
                      title={!canResolve ? "No tienes permiso para derivar" : ""}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Derivar
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Estado</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label>Nuevo estado</Label>
                    <Select
                      value={statusForm.status}
                      onValueChange={(v) => setStatusForm({ ...statusForm, status: v })}
                      disabled={!canResolve}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="RECEIVED">Recibido</SelectItem>
                        <SelectItem value="IN_REVIEW">En Revisión</SelectItem>
                        <SelectItem value="APPROVED">Aprobado</SelectItem>
                        <SelectItem value="REJECTED">Rechazado</SelectItem>
                        <SelectItem value="COMPLETED">Completado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Nota</Label>
                    <Textarea
                      rows={2}
                      value={statusForm.note}
                      onChange={(e) => setStatusForm({ ...statusForm, note: e.target.value })}
                      disabled={!canResolve}
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      onClick={doStatus}
                      disabled={!canResolve}
                      title={!canResolve ? "No tienes permiso para actualizar estado" : ""}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Actualizar
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Notificar</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-3">
                    {["EMAIL", "SMS"].map((ch) => (
                      <label key={ch} className="text-sm flex items-center gap-2 border rounded px-2 py-1">
                        <input
                          type="checkbox"
                          checked={notifyForm.channels.includes(ch)}
                          onChange={(e) =>
                            setNotifyForm((f) => ({
                              ...f,
                              channels: e.target.checked
                                ? [...f.channels, ch]
                                : f.channels.filter((x) => x !== ch),
                            }))
                          }
                          disabled={!canResolve}
                        />
                        {ch}
                      </label>
                    ))}
                  </div>

                  <div>
                    <Label>Asunto</Label>
                    <Input
                      value={notifyForm.subject}
                      onChange={(e) => setNotifyForm({ ...notifyForm, subject: e.target.value })}
                      disabled={!canResolve}
                    />
                  </div>

                  <div>
                    <Label>Mensaje</Label>
                    <Textarea
                      rows={3}
                      value={notifyForm.message}
                      onChange={(e) => setNotifyForm({ ...notifyForm, message: e.target.value })}
                      disabled={!canResolve}
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button
                      onClick={doNotify}
                      disabled={!canResolve}
                      title={!canResolve ? "No tienes permiso para notificar" : ""}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Enviar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

/* ===================== PROCEDURES ===================== */
const ProceduresManagement = forwardRef((props, ref) => {
  const { hasPerm } = useAuth();
  const canReview = hasPerm(PERMS["mpv.processes.review"]);

  const [procedures, setProcedures] = useState([]);
  const [procedureTypes, setProcedureTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);

  const searchInputRef = useRef(null);

  const [formData, setFormData] = useState({
    procedure_type_id: "",
    applicant_name: "",
    applicant_email: "",
    applicant_phone: "",
    applicant_document: "",
    description: "",
    urgency_level: "NORMAL",
  });

  useImperativeHandle(ref, () => ({
    openCreate: () => setIsCreateModalOpen(true),
    focusSearch: () => {
      setStatusFilter("ALL");
      setTimeout(() => searchInputRef.current?.focus(), 0);
    },
  }));

  const fetchProcedures = useCallback(async () => {
    if (!canReview) return;
    try {
      setLoading(true);
      const data = await ProcSvc.list();
      setProcedures(data?.procedures ?? data ?? []);
    } catch (error) {
      console.error("Error fetching procedures:", error);
      toast.error(formatApiError(error, "Error al cargar trámites"));
    } finally {
      setLoading(false);
    }
  }, [canReview]);

  const fetchProcedureTypes = useCallback(async () => {
    try {
      const data = await ProcedureTypes.list();
      setProcedureTypes(data?.procedure_types ?? []);
    } catch (error) {
      console.error("Error fetching procedure types:", error);
    }
  }, []);

  useEffect(() => {
    fetchProcedures();
    fetchProcedureTypes();
  }, [fetchProcedures, fetchProcedureTypes]);

  if (!canReview) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        procedure_type: formData.procedure_type_id ? Number(formData.procedure_type_id) : null,
      };
      delete payload.procedure_type_id;

      await ProcSvc.create(payload);

      toast.success("Trámite creado exitosamente");
      setIsCreateModalOpen(false);
      setFormData({
        procedure_type_id: "",
        applicant_name: "",
        applicant_email: "",
        applicant_phone: "",
        applicant_document: "",
        description: "",
        urgency_level: "NORMAL",
      });
      fetchProcedures();
    } catch (error) {
      console.log("create error:", error);
      toast.error(formatApiError(error, "Error al crear trámite"));
    }
  };

  const filteredProcedures = procedures.filter((procedure) => {
    const code = procedure?.tracking_code?.toLowerCase?.() || "";
    const name = procedure?.applicant_name?.toLowerCase?.() || "";
    const type = procedure?.procedure_type_name?.toLowerCase?.() || "";
    const q = searchTerm.toLowerCase();
    const matchesSearch = code.includes(q) || name.includes(q) || type.includes(q);
    const matchesStatus = statusFilter === "ALL" || procedure.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status) => {
    const statusConfig = {
      RECEIVED: { variant: "secondary", label: "Recibido" },
      IN_REVIEW: { variant: "default", label: "En Revisión" },
      APPROVED: { variant: "default", label: "Aprobado" },
      REJECTED: { variant: "destructive", label: "Rechazado" },
      COMPLETED: { variant: "default", label: "Completado" },
    };
    const cfg = statusConfig[status] || { variant: "secondary", label: status };
    return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
  };

  const handleDownloadPDF = async (proc) => {
    const id = proc?.id;
    if (!id) return toast.error("No se pudo obtener el ID del trámite");
    try {
      const result = await generatePDFWithPolling(`/procedures/${id}/cover`, {}, { testId: "procedure-cover" });
      if (result?.success) {
        await downloadFile(result.downloadUrl, `caratula-${proc.tracking_code || id}.pdf`);
        toast.success("Documento generado");
      } else {
        toast.error("No se pudo generar el PDF");
      }
    } catch (error) {
      console.error("PDF generation error:", error);
      toast.error(formatApiError(error, "Error al generar PDF"));
    }
  };

  const handleGenerateQR = async (proc) => {
    const id = proc?.id;
    if (!id) return toast.error("No se pudo obtener el ID del trámite");
    try {
      const result = await generatePDFWithPolling(`/procedures/${id}/qr`, {}, { testId: "procedure-qr" });
      if (result?.success) {
        await downloadFile(result.downloadUrl, `qr-${proc.tracking_code || id}.pdf`);
        toast.success("QR generado");
      } else {
        toast.error("No se pudo generar el QR");
      }
    } catch (err) {
      console.error("QR generation error:", err);
      toast.error(formatApiError(err, "Error al generar QR"));
    }
  };

  const openDetail = async (p) => {
    let id = p?.id;

    if (!id && p?.tracking_code) {
      const d = await ProcSvc.getByCode(p.tracking_code);
      const procData = d?.procedure || d;
      id = procData?.id || d?.id;
    }

    if (!id) {
      toast.error("No se pudo obtener el ID del trámite");
      return;
    }

    setDetailId(id);
    setDetailOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Gestión de Trámites</h2>

        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Trámite
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Registrar Nuevo Trámite</DialogTitle>
              <DialogDescription>Complete los datos del trámite documentario</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="procedure_type_id">Tipo de Trámite *</Label>
                <Select
                  value={formData.procedure_type_id || undefined}
                  onValueChange={(value) => setFormData({ ...formData, procedure_type_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tipo de trámite" />
                  </SelectTrigger>
                  <SelectContent>
                    {procedureTypes.map((type) => (
                      <SelectItem key={type.id} value={String(type.id)}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="applicant_name">Nombre del Solicitante *</Label>
                  <Input
                    id="applicant_name"
                    value={formData.applicant_name}
                    onChange={(e) => setFormData({ ...formData, applicant_name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="applicant_document">Documento de Identidad *</Label>
                  <Input
                    id="applicant_document"
                    value={formData.applicant_document}
                    onChange={(e) => setFormData({ ...formData, applicant_document: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="applicant_email">Correo Electrónico</Label>
                  <Input
                    id="applicant_email"
                    type="email"
                    value={formData.applicant_email}
                    onChange={(e) => setFormData({ ...formData, applicant_email: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="applicant_phone">Teléfono</Label>
                  <Input
                    id="applicant_phone"
                    value={formData.applicant_phone}
                    onChange={(e) => setFormData({ ...formData, applicant_phone: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Descripción del Trámite</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describa los detalles específicos del trámite"
                />
              </div>

              <div>
                <Label htmlFor="urgency_level">Nivel de Urgencia</Label>
                <Select
                  value={formData.urgency_level}
                  onValueChange={(value) => setFormData({ ...formData, urgency_level: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Baja</SelectItem>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="HIGH">Alta</SelectItem>
                    <SelectItem value="URGENT">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                  Cancelar
                </Button>
                <Button data-testid="procedure-create" type="submit" className="bg-blue-600 hover:bg-blue-700">
                  Crear Trámite
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar por código, nombre o tipo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              ref={searchInputRef}
            />
          </div>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los estados</SelectItem>
            <SelectItem value="RECEIVED">Recibido</SelectItem>
            <SelectItem value="IN_REVIEW">En Revisión</SelectItem>
            <SelectItem value="APPROVED">Aprobado</SelectItem>
            <SelectItem value="REJECTED">Rechazado</SelectItem>
            <SelectItem value="COMPLETED">Completado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Solicitante</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>

              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProcedures.map((procedure) => (
                  <tr key={procedure.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{procedure.tracking_code}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{procedure.applicant_name}</div>
                        <div className="text-sm text-gray-500">{procedure.applicant_document}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {procedure.procedure_type_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(procedure.status)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {procedure.created_at ? new Date(procedure.created_at).toLocaleDateString() : "-"}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        <Button
                          data-testid="procedure-view"
                          variant="ghost"
                          size="sm"
                          onClick={() => openDetail(procedure)}
                          title="Ver detalle"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>

                        <Button
                          data-testid="procedure-download-pdf"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadPDF(procedure)}
                          title="Descargar carátula"
                        >
                          <Download className="h-4 w-4" />
                        </Button>

                        <Button
                          data-testid="procedure-generate-qr"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleGenerateQR(procedure)}
                          title="Generar QR"
                        >
                          <QrCode className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredProcedures.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-500">
                      Sin resultados.
                    </td>
                  </tr>
                )}
              </tbody>

            </table>
          </div>
        </CardContent>
      </Card>

      {/* Detalle */}
      <ProcedureDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        procedureId={detailId}
        onChanged={fetchProcedures}
      />
    </div>
  );
});

/* ===================== MAIN ===================== */
const MesaDePartesModule = () => {
  const { user, hasAny } = useAuth();

  const tabs = [
    { key: "dashboard", label: "Dashboard", need: [PERMS["mpv.processes.review"], PERMS["mpv.reports.view"]] },
    { key: "types", label: "Tipos de Trámite", need: [PERMS["mpv.processes.resolve"]] },
    { key: "procedures", label: "Trámites", need: [PERMS["mpv.processes.review"]] },
    { key: "reports", label: "Reportes", need: [PERMS["mpv.reports.view"]] },
  ].filter((t) => (user ? hasAny(t.need) : false));

  const defaultTab = tabs[0]?.key || "dashboard";
  const [activeTab, setActiveTab] = useState(defaultTab);
  const procRef = useRef(null);

  const goProcedures = () => setActiveTab("procedures");
  const goReports = () => setActiveTab("reports");

  const handleQuickNew = () => {
    goProcedures();
    procRef.current?.openCreate?.();
  };

  const handleQuickSearch = () => {
    goProcedures();
    procRef.current?.focusSearch?.();
  };

  const handleQuickQR = () => {
    const code = window.prompt("Ingrese el código de trámite para verificar:");
    if (!code) return;
    const url = MesaPartesPublic.verifyUrl(code);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (!user) return <div>Acceso no autorizado</div>;

  return (
    <div className="p-6">
      <div className="rounded-2xl p-[1px] bg-gradient-to-b from-slate-500/30 to-slate-900/10">
        <div className="rounded-2xl bg-slate-200/70 backdrop-blur-md border border-white/30 shadow-[0_10px_35px_rgba(0,0,0,0.18)]">
          <div className="px-6 pt-5">
            <h1 className="text-xl font-bold text-slate-900">Mesa de Partes Digital</h1>
            <p className="text-sm text-slate-700">Sistema de gestión de trámites documentarios</p>
            <div className="mt-3 h-px w-full bg-white/60" />
          </div>

          <div className="px-6 pb-6 pt-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <div className="rounded-xl bg-slate-100/80 border border-white/60 px-2 py-2">
                <TabsList className="w-full bg-transparent p-0 flex flex-wrap gap-2">
                  {tabs.map((t) => (
                    <TabsTrigger
                      key={t.key}
                      value={t.key}
                      className="rounded-lg text-slate-800 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                    >
                      {t.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              {tabs.some((t) => t.key === "dashboard") && (
                <TabsContent value="dashboard">
                  <MesaDePartesDashboardUI
                    onNew={handleQuickNew}
                    onSearch={handleQuickSearch}
                    onQR={handleQuickQR}
                    onReports={goReports}
                  />
                </TabsContent>
              )}

              {tabs.some((t) => t.key === "types") && (
                <TabsContent value="types">
                  <ProcedureTypesManagement />
                </TabsContent>
              )}

              {tabs.some((t) => t.key === "procedures") && (
                <TabsContent value="procedures">
                  <ProceduresManagement ref={procRef} />
                </TabsContent>
              )}

              {tabs.some((t) => t.key === "reports") && (
                <TabsContent value="reports">
                  <MesaPartesReports />
                </TabsContent>
              )}
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MesaDePartesModule;
