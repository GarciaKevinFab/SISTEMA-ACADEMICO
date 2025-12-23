// src/components/MineduIntegrationModule.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";

import {
  Database,
  Upload,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Eye,
  Shield,
  Users,
  BookOpen,
  Award,
  TrendingUp,
  Settings2,
  ListChecks,
  Play,
  Pause,
  Terminal,
  RotateCcw,
  Search,
  Copy,
} from "lucide-react";

import { toast } from "../../utils/safeToast";

/* shadcn select */
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../../components/ui/select";

/* shadcn dialog */
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../components/ui/dialog";

/* shadcn separator (opcional pero bonito) */
import { Separator } from "../../components/ui/separator";

/* servicios MINEDU */
import {
  Catalog,
  Mapping,
  Jobs,
  Logs,
  Exports,
  Validation,
  Stats,
} from "../../services/minedu.service";

/* =========================
   helpers
========================= */
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

function safeDate(value, withTime = false) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return withTime ? d.toLocaleString() : d.toLocaleDateString();
}

function safeJson(obj) {
  try {
    return JSON.stringify(obj ?? {}, null, 2);
  } catch {
    return "{}";
  }
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copiado ✅");
  } catch {
    toast.error("No se pudo copiar");
  }
}

/* =========================================================
   DASHBOARD
========================================================= */
const MineduDashboard = () => {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchDashboardStats = useCallback(async () => {
    try {
      setLoading(true);
      const data = await Stats.dashboard();
      setStats(data ?? {});
    } catch (error) {
      console.error("Error fetching MINEDU stats:", error);
      toast.error(formatApiError(error, "Error al cargar estadísticas MINEDU"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardStats();
  }, [fetchDashboardStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  const s = stats?.stats ?? {};
  const breakdown = stats?.data_breakdown ?? {};

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Integración MINEDU
          </h2>
          <p className="text-slate-600">
            SIA/SIAGIE – exportación, validación y monitoreo
          </p>
        </div>
        <Button variant="outline" onClick={fetchDashboardStats}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Exportaciones Pendientes
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{s.pending_exports || 0}</div>
            <p className="text-xs text-muted-foreground">Por procesar</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completadas</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {s.completed_exports || 0}
            </div>
            <p className="text-xs text-muted-foreground">Enviadas exitosamente</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fallidas</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {s.failed_exports || 0}
            </div>
            <p className="text-xs text-muted-foreground">Con errores</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Éxito</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {typeof s.success_rate === "number"
                ? `${Math.round(s.success_rate)}%`
                : "0%"}
            </div>
            <p className="text-xs text-muted-foreground">Sobre el total enviado</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Desglose por Tipo</CardTitle>
          <CardDescription>Exportaciones por categoría</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Users className="h-8 w-8 text-blue-600" />
                <div>
                  <div className="font-semibold">Matrículas</div>
                  <div className="text-sm text-gray-500">estudiantes</div>
                </div>
              </div>
              <div className="text-2xl font-bold text-blue-600">
                {breakdown.enrollment_exports || 0}
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Award className="h-8 w-8 text-green-600" />
                <div>
                  <div className="font-semibold">Calificaciones</div>
                  <div className="text-sm text-gray-500">notas</div>
                </div>
              </div>
              <div className="text-2xl font-bold text-green-600">
                {breakdown.grades_exports || 0}
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <BookOpen className="h-8 w-8 text-purple-600" />
                <div>
                  <div className="font-semibold">Estudiantes</div>
                  <div className="text-sm text-gray-500">datos</div>
                </div>
              </div>
              <div className="text-2xl font-bold text-purple-600">
                {breakdown.students_exports || 0}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

/* =========================================================
   EXPORT DATA
========================================================= */
const ExportDataModule = () => {
  const [exportType, setExportType] = useState("");
  const [academicYear, setAcademicYear] = useState("2024");
  const [academicPeriod, setAcademicPeriod] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleExport = async (e) => {
    e.preventDefault();
    if (!exportType || !academicPeriod || !academicYear) {
      toast.error("Complete todos los campos requeridos");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        academic_year: parseInt(academicYear, 10),
        academic_period: academicPeriod,
      };
      if (exportType === "enrollments") await Exports.enqueueEnrollments(payload);
      else await Exports.enqueueGrades(payload);

      toast.success("Exportación encolada");
      setExportType("");
      setAcademicPeriod("");
    } catch (error) {
      toast.error(formatApiError(error, "Error al iniciar exportación"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Exportación de Datos</h2>

      <Card>
        <CardHeader>
          <CardTitle>Exportar a MINEDU</CardTitle>
          <CardDescription>Seleccione tipo y período</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleExport} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <Label>Tipo *</Label>
                <Select value={exportType} onValueChange={setExportType}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Datos a exportar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="enrollments">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Matrículas
                      </div>
                    </SelectItem>
                    <SelectItem value="grades">
                      <div className="flex items-center gap-2">
                        <Award className="h-4 w-4" />
                        Calificaciones
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Año *</Label>
                <Select value={academicYear} onValueChange={setAcademicYear}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Año" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2025">2025</SelectItem>
                    <SelectItem value="2024">2024</SelectItem>
                    <SelectItem value="2023">2023</SelectItem>
                    <SelectItem value="2022">2022</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Período *</Label>
                <Select value={academicPeriod} onValueChange={setAcademicPeriod}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="I">I Semestre</SelectItem>
                    <SelectItem value="II">II Semestre</SelectItem>
                    <SelectItem value="III">III Semestre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3 text-sm text-blue-700">
                <AlertTriangle className="h-5 w-5 mt-0.5" />
                <span>
                  <b>Importante:</b> valide catálogos y mapeos antes de exportar.
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setExportType("");
                  setAcademicPeriod("");
                  setAcademicYear("2024");
                }}
              >
                Limpiar
              </Button>

              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Encolando...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Iniciar Exportación
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

/* =========================================================
   HISTORY
========================================================= */
const ExportHistoryModule = () => {
  const [exportsData, setExportsData] = useState([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);

  // detalle (Dialog)
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedExport, setSelectedExport] = useState(null);

  const fetchExports = useCallback(async () => {
    try {
      setLoading(true);
      const data = await Exports.list();
      setExportsData(data?.exports ?? data ?? []);
    } catch (e) {
      toast.error(formatApiError(e, "Error al cargar historial"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExports();
  }, [fetchExports]);

  const retry = async (id) => {
    try {
      await Exports.retry(id);
      toast.success("Reintento encolado");
      fetchExports();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const statusCfg = (status) => {
    switch (status) {
      case "COMPLETED":
        return {
          label: "Completado",
          className: "bg-green-100 text-green-700 border border-green-200",
          Icon: CheckCircle,
        };
      case "FAILED":
        return {
          label: "Fallido",
          className: "bg-red-100 text-red-700 border border-red-200",
          Icon: XCircle,
        };
      case "PROCESSING":
        return {
          label: "Procesando",
          className: "bg-yellow-100 text-yellow-700 border border-yellow-200",
          Icon: RefreshCw,
        };
      case "RETRYING":
        return {
          label: "Reintentando",
          className: "bg-yellow-100 text-yellow-700 border border-yellow-200",
          Icon: RefreshCw,
        };
      case "PENDING":
      default:
        return {
          label: "Pendiente",
          className: "bg-gray-100 text-gray-700 border border-gray-200",
          Icon: Clock,
        };
    }
  };

  const filtered = useMemo(() => {
    return (exportsData ?? []).filter((exp) => {
      const okS = statusFilter === "ALL" || exp.status === statusFilter;
      const okT = typeFilter === "ALL" || exp.data_type === typeFilter;
      return okS && okT;
    });
  }, [exportsData, statusFilter, typeFilter]);

  const openDetail = (exp) => {
    setSelectedExport(exp);
    setDetailOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dialog Detalle */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detalle de exportación</DialogTitle>
            <DialogDescription>
              Si esto falla en prod, mínimo ya tienes el cadáver bien etiquetado.
            </DialogDescription>
          </DialogHeader>

          {selectedExport ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded border bg-white">
                  <div className="text-xs text-gray-500">ID</div>
                  <div className="font-semibold">{selectedExport.id}</div>
                </div>

                <div className="p-3 rounded border bg-white">
                  <div className="text-xs text-gray-500">Tipo</div>
                  <div className="font-semibold">{selectedExport.data_type}</div>
                </div>

                <div className="p-3 rounded border bg-white">
                  <div className="text-xs text-gray-500">Estado</div>
                  <div className="font-semibold">{selectedExport.status}</div>
                </div>

                <div className="p-3 rounded border bg-white">
                  <div className="text-xs text-gray-500">Registros</div>
                  <div className="font-semibold">
                    {selectedExport.total_records ?? "N/A"}
                  </div>
                </div>

                <div className="p-3 rounded border bg-white md:col-span-2">
                  <div className="text-xs text-gray-500">Período</div>
                  <div className="font-semibold">
                    {selectedExport.record_data?.academic_year ?? "—"}-
                    {selectedExport.record_data?.academic_period ?? "—"}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">record_data</div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(safeJson(selectedExport.record_data))}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar JSON
                </Button>
              </div>

              <pre className="p-3 rounded border bg-gray-50 text-xs overflow-auto max-h-[320px]">
                {safeJson(selectedExport.record_data)}
              </pre>
            </div>
          ) : (
            <div className="text-sm text-gray-500">Sin datos.</div>
          )}
        </DialogContent>
      </Dialog>

      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Historial de Exportaciones</h2>
        <Button onClick={fetchExports} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      <div className="flex flex-wrap gap-4 items-center">
        <div className="w-48">
          <Label className="sr-only">Estado</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              <SelectItem value="PENDING">Pendiente</SelectItem>
              <SelectItem value="PROCESSING">Procesando</SelectItem>
              <SelectItem value="COMPLETED">Completado</SelectItem>
              <SelectItem value="FAILED">Fallido</SelectItem>
              <SelectItem value="RETRYING">Reintentando</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-48">
          <Label className="sr-only">Tipo</Label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              <SelectItem value="ENROLLMENT">Matrículas</SelectItem>
              <SelectItem value="GRADES">Calificaciones</SelectItem>
              <SelectItem value="STUDENTS">Estudiantes</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="text-sm text-gray-600 ml-auto">
          Mostrando: <b>{filtered.length}</b>
        </div>
      </div>
<Card>
  <CardContent className="p-0">
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-200 border-b"> {/* Fondo gris para la primera fila */}
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
              Tipo
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
              Período
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
              Estado
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
              Registros
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
              Fecha
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
              Acciones
            </th>
          </tr>
        </thead>

        <tbody className="bg-white divide-y divide-gray-200">
          {filtered.map((exp) => {
            const cfg = statusCfg(exp.status);
            const Icon = cfg.Icon;
            return (
              <tr key={exp.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-black"> {/* Letra negra */}
                  <div className="flex items-center gap-2">
                    {exp.data_type === "ENROLLMENT" ? (
                      <Users className="h-4 w-4 text-blue-600" />
                    ) : exp.data_type === "GRADES" ? (
                      <Award className="h-4 w-4 text-green-600" />
                    ) : (
                      <BookOpen className="h-4 w-4 text-purple-600" />
                    )}
                    <span className="font-medium">{exp.data_type}</span>
                  </div>
                </td>

                <td className="px-6 py-4 whitespace-nowrap text-sm text-black">
                  {exp.record_data?.academic_year ?? "—"}-
                  {exp.record_data?.academic_period ?? "—"}
                </td>

                <td className="px-6 py-4 whitespace-nowrap text-black">
                  <Badge variant="secondary" className={cfg.className}>
                    <span className="flex items-center gap-1">
                      <Icon className="h-3 w-3" />
                      {cfg.label}
                    </span>
                  </Badge>
                </td>

                <td className="px-6 py-4 whitespace-nowrap text-sm text-black">
                  {exp.total_records ?? "N/A"}
                </td>

                <td className="px-6 py-4 whitespace-nowrap text-sm text-black">
                  {safeDate(exp.created_at)}
                </td>

                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-black">
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Ver detalle"
                      onClick={() => openDetail(exp)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>

                    {exp.status === "FAILED" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => retry(exp.id)}
                        title="Reintentar"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </CardContent>
</Card>


      {filtered.length === 0 && (
        <div className="text-center py-12">
          <Database className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No hay exportaciones
          </h3>
          <p className="text-gray-500">
            Prueba con otros filtros o realiza una exportación.
          </p>
        </div>
      )}
    </div>
  );
};

/* =========================================================
   VALIDATION
========================================================= */
const DataValidationModule = () => {
  const [validation, setValidation] = useState(null);
  const [loading, setLoading] = useState(false);

  const runValidation = async () => {
    setLoading(true);
    try {
      const data = await Validation.integrity();
      setValidation(data);
      if (data?.valid) toast.success("Validación: OK");
      else toast.warning("Validación: hay inconsistencias");
    } catch (e) {
      toast.error(formatApiError(e, "Error al validar"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Validación de Integridad</h2>

        <Button
          onClick={runValidation}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {loading ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Validando...
            </>
          ) : (
            <>
              <Shield className="h-4 w-4 mr-2" />
              Ejecutar
            </>
          )}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resultados</CardTitle>
          <CardDescription>Revisión previa al envío</CardDescription>
        </CardHeader>
        <CardContent>
          {validation ? (
            <div className="space-y-6">
              <div
                className={`p-4 rounded-lg border ${validation.valid
                    ? "bg-green-50 border-green-200"
                    : "bg-red-50 border-red-200"
                  }`}
              >
                <div className="flex items-center gap-3">
                  {validation.valid ? (
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  ) : (
                    <XCircle className="h-6 w-6 text-red-600" />
                  )}
                  <div>
                    <h3
                      className={`font-semibold ${validation.valid ? "text-green-800" : "text-red-800"
                        }`}
                    >
                      {validation.valid ? "Datos Válidos" : "Se Encontraron Problemas"}
                    </h3>
                    <p
                      className={`text-sm ${validation.valid ? "text-green-700" : "text-red-700"
                        }`}
                    >
                      {validation.valid ? "Listo para exportación" : "Corrija los puntos listados abajo"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.entries(validation.stats || {}).map(([key, value]) => (
                  <div key={key} className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">{value}</div>
                    <div className="text-sm text-gray-600 capitalize">
                      {key.replace(/_/g, " ")}
                    </div>
                  </div>
                ))}
              </div>

              {Array.isArray(validation.errors) && validation.errors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-red-800">Errores:</h4>
                  {validation.errors.map((e, i) => (
                    <div
                      key={`${i}-${e}`}
                      className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded"
                    >
                      <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                      <span className="text-sm text-red-700">{e}</span>
                    </div>
                  ))}
                </div>
              )}

              {Array.isArray(validation.warnings) && validation.warnings.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-yellow-800">Advertencias:</h4>
                  {validation.warnings.map((w, i) => (
                    <div
                      key={`${i}-${w}`}
                      className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded"
                    >
                      <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                      <span className="text-sm text-yellow-700">{w}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              Ejecute la validación para ver resultados.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

/* =========================================================
   MAPPINGS
========================================================= */
const MappingsModule = () => {
  const TYPES = [
    { value: "INSTITUTION", label: "Institución (código IE)", icon: Settings2 },
    { value: "CAREER", label: "Carreras", icon: BookOpen },
    { value: "STUDY_PLAN", label: "Planes de Estudio", icon: Upload }, // icon simpática
    { value: "STUDENT", label: "Estudiantes", icon: Users },
  ];

  const [type, setType] = useState("CAREER");
  const [localItems, setLocalItems] = useState([]);
  const [remoteOptions, setRemoteOptions] = useState([]);
  const [currentMap, setCurrentMap] = useState({});
  const [original, setOriginal] = useState({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [local, remote, mappings] = await Promise.all([
        Catalog.local(type),
        Catalog.remote(type),
        Mapping.list(type),
      ]);
      setLocalItems(local?.items ?? local ?? []);
      setRemoteOptions(remote?.items ?? remote ?? []);
      const map = {};
      (mappings?.mappings ?? mappings ?? []).forEach((m) => {
        map[m.local_id] = m.minedu_code;
      });
      setCurrentMap(map);
      setOriginal(map);
    } catch (e) {
      toast.error(formatApiError(e, "Error cargando catálogos"));
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const filteredLocal = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (localItems ?? []).filter((it) => {
      if (!q) return true;
      return (
        (it.name || it.label || "").toLowerCase().includes(q) ||
        (it.code || it.ident || "").toLowerCase().includes(q)
      );
    });
  }, [localItems, search]);

  const changed = useMemo(() => {
    return Object.keys(currentMap).filter((id) => currentMap[id] !== original[id]);
  }, [currentMap, original]);

  const save = async () => {
    if (changed.length === 0) {
      toast.info("No hay cambios");
      return;
    }
    setSaving(true);
    try {
      const payload = changed.map((id) => ({
        local_id: Number(id),
        minedu_code: currentMap[id] || null,
      }));
      await Mapping.saveBulk(type, payload);
      toast.success("Mapeos guardados");
      await loadAll();
    } catch (e) {
      toast.error(formatApiError(e, "Error al guardar mapeos"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-bold text-black">Mapeo de Catálogos MINEDU</h2>
        <div className="flex gap-2 items-center">
          <ListChecks className="h-5 w-5 text-gray-500" />
          <span className="text-sm text-gray-600">
            Cambios pendientes: <b>{changed.length}</b>
          </span>
          <Button
            onClick={save}
            disabled={saving || changed.length === 0}
            className="ml-2 bg-blue-600 hover:bg-blue-700"
          >
            {saving ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              "Guardar cambios"
            )}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TYPES.map((t) => {
          const Icon = t.icon;
          const active = type === t.value;
          return (
            <Button
              key={t.value}
              variant={active ? "default" : "outline"}
              onClick={() => setType(t.value)}
            >
              <Icon className="h-4 w-4 mr-2" />
              {t.label}
            </Button>
          );
        })}
      </div>

    <Card>
  <CardHeader>
    <CardTitle>Vincular códigos MINEDU</CardTitle>
    <CardDescription>
      Seleccione el código MINEDU correspondiente para cada registro local
    </CardDescription>
  </CardHeader>

  <CardContent>
    <div className="flex items-center gap-3 mb-4 flex-wrap">
      <div className="relative w-full md:w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          className="w-full border rounded pl-9 h-9 text-sm"
          placeholder="Buscar..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Button variant="outline" onClick={loadAll}>
        <RefreshCw className="h-4 w-4 mr-2" />
        Refrescar
      </Button>

      <div className="text-sm text-gray-600 ml-auto">
        Mostrando: <b>{filteredLocal.length}</b>
      </div>
    </div>

    {loading ? (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    ) : (
      <div className="overflow-auto">
        <table className="w-full">
          <thead className="bg-gray-400 border-b">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold text-black uppercase">
                Local
              </th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-black uppercase">
                Código MINEDU
              </th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-black uppercase">
                Estado
              </th>
            </tr>
          </thead>
          <tbody className="divide-y bg-white">
            {filteredLocal.map((it) => {
              const mappedCode = currentMap[it.id] || "";
              const changedRow = mappedCode !== (original[it.id] || "");

              return (
                <tr key={it.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-black">
                    <div className="font-medium">{it.name || it.label}</div>
                    <div className="text-xs text-gray-500">
                      {it.code || it.ident || it.document || ""}
                    </div>
                  </td>

                  <td className="px-4 py-2 text-black">
                    <Select
                      value={mappedCode}
                      onValueChange={(v) =>
                        setCurrentMap((m) => ({
                          ...m,
                          [it.id]: v === "UNLINKED" ? "" : v,
                        }))
                      }
                    >
                      <SelectTrigger className="w-80">
                        <SelectValue placeholder="Seleccione código" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        <SelectItem value="UNLINKED">— Sin vincular —</SelectItem>
                        {remoteOptions.map((opt) => (
                          <SelectItem key={opt.code} value={String(opt.code)}>
                            {opt.code} — {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>

                  <td className="px-4 py-2 text-black">
                    {changedRow ? (
                      <Badge className="bg-yellow-100 text-yellow-800 border border-yellow-200">
                        Pendiente de guardar
                      </Badge>
                    ) : mappedCode ? (
                      <Badge className="bg-green-100 text-green-800 border border-green-200">
                        Vinculado
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Sin vincular</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </CardContent>
</Card>


    </div>
  );
};

/* =========================================================
   JOBS + LOGS
========================================================= */
const JobsLogsModule = () => {
  const JOB_TYPES = [
    { value: "EXPORT_ENROLLMENTS", label: "Exportar Matrículas" },
    { value: "EXPORT_GRADES", label: "Exportar Calificaciones" },
    { value: "VALIDATE_DATA", label: "Validar Integridad" },
    { value: "SYNC_CATALOGS", label: "Sincronizar Catálogos" },
  ];

  const [jobs, setJobs] = useState([]);
  const [runs, setRuns] = useState([]);
  const [logs, setLogs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [selectedRun, setSelectedRun] = useState(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState({
    type: "EXPORT_ENROLLMENTS",
    cron: "0 3 * * *",
    enabled: true,
  });

  const loadJobs = useCallback(async () => {
    try {
      const data = await Jobs.list();
      setJobs(data?.jobs ?? data ?? []);
    } catch (e) {
      toast.error(formatApiError(e, "Error al cargar jobs"));
    }
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const openRuns = useCallback(async (job) => {
    try {
      setSelectedJob(job);
      const data = await Jobs.runs(job.id);
      setRuns(data?.runs ?? data ?? []);
      setLogs([]);
      setSelectedRun(null);
    } catch (e) {
      toast.error(formatApiError(e, "Error al cargar ejecuciones"));
    }
  }, []);

  const openLogs = async (run) => {
    try {
      setSelectedRun(run);
      const data = await Logs.forRun(run.id);
      setLogs(data?.logs ?? data ?? []);
    } catch (e) {
      toast.error(formatApiError(e, "Error al cargar logs"));
    }
  };

  const runNow = async (job) => {
    try {
      await Jobs.runNow(job.id);
      toast.success("Ejecución disparada");
      await openRuns(job);
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const pause = async (job) => {
    try {
      await Jobs.pause(job.id);
      toast.success("Job pausado");
      loadJobs();
      if (selectedJob?.id === job.id) setSelectedJob((j) => ({ ...j, enabled: false }));
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const resume = async (job) => {
    try {
      await Jobs.resume(job.id);
      toast.success("Job reanudado");
      loadJobs();
      if (selectedJob?.id === job.id) setSelectedJob((j) => ({ ...j, enabled: true }));
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const retryRun = async (run) => {
    try {
      await Jobs.retryRun(run.id);
      toast.success("Run marcado para reintento");
      // refresca runs + logs
      if (selectedJob) await openRuns(selectedJob);
      setSelectedRun(null);
      setLogs([]);
    } catch (e) {
      toast.error(formatApiError(e, "No se pudo reintentar el run"));
    }
  };

  const createJob = async (e) => {
    e.preventDefault();
    try {
      await Jobs.create(form);
      toast.success("Job creado");
      setIsCreateOpen(false);
      loadJobs();
    } catch (e2) {
      toast.error(formatApiError(e2, "No se pudo crear el job"));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-bold">Jobs Programados & Bitácora</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadJobs}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Settings2 className="h-4 w-4 mr-2" />
            Nuevo Job
          </Button>
        </div>
      </div>

      {isCreateOpen && (
        <Card className="border-2 border-blue-100">
          <CardHeader>
            <CardTitle>Crear Job</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={createJob} className="grid md:grid-cols-3 gap-4">
              <div>
                <Label>Tipo</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {JOB_TYPES.map((j) => (
                      <SelectItem key={j.value} value={j.value}>
                        {j.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>CRON</Label>
                <input
                  className="w-full border rounded h-9 px-3 mt-2 text-sm"
                  value={form.cron}
                  onChange={(e) => setForm((f) => ({ ...f, cron: e.target.value }))}
                  placeholder="0 3 * * *"
                />
                <p className="text-xs text-gray-500 mt-1">Ej. 0 3 * * * (3am diario)</p>
              </div>

              <div className="flex items-end gap-2 mt-2 md:mt-8">
                <label className="text-sm flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.enabled}
                    onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                  />
                  Habilitado
                </label>
                <Button type="submit" className="ml-auto bg-blue-600 hover:bg-blue-700">
                  Guardar
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

   <Card>
  <CardHeader>
    <CardTitle>Jobs</CardTitle>
    <CardDescription>Programación y acciones</CardDescription>
  </CardHeader>
  <CardContent>
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-200 border-b">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-900">Tipo</th> {/* Cambié a text-gray-900 */}
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-900">CRON</th> {/* Cambié a text-gray-900 */}
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-900">Estado</th> {/* Cambié a text-gray-900 */}
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-900">Última Ejecución</th> {/* Cambié a text-gray-900 */}
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-900">Acciones</th> {/* Cambié a text-gray-900 */}
          </tr>
        </thead>
        <tbody className="divide-y bg-white">
          {jobs.map((job) => (
            <tr key={job.id} className="hover:bg-gray-50">
              <td className="px-4 py-2 text-gray-900">{job.type}</td> {/* Cambié a text-gray-900 */}
              <td className="px-4 py-2 text-gray-900">{job.cron || "-"}</td> {/* Cambié a text-gray-900 */}
              <td className="px-4 py-2">
                {job.enabled ? (
                  <Badge className="bg-green-100 text-green-800 border border-green-200">
                    Habilitado
                  </Badge>
                ) : (
                  <Badge variant="secondary">Pausado</Badge>
                )}
              </td>
              <td className="px-4 py-2 text-sm text-gray-900">
                {safeDate(job.last_run_at, true)} {/* Cambié a text-gray-900 */}
              </td>
              <td className="px-4 py-2">
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openRuns(job)}
                    title="Ver ejecuciones"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => runNow(job)}
                    title="Ejecutar ahora"
                  >
                    <Play className="h-4 w-4" />
                  </Button>

                  {job.enabled ? (
                    <Button size="sm" variant="outline" onClick={() => pause(job)} title="Pausar">
                      <Pause className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => resume(job)} title="Reanudar">
                      <Play className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}

          {jobs.length === 0 && (
            <tr>
              <td colSpan="5" className="text-center py-8 text-gray-500">
                No hay jobs configurados.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </CardContent>
</Card>



      {selectedJob && (
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
  <CardHeader>
    <CardTitle>Ejecuciones: {selectedJob.type}</CardTitle>
    <CardDescription>Click en terminal para ver logs</CardDescription>
  </CardHeader>
  <CardContent>
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-200 border-b">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-900">Inicio</th> {/* Letras negras */}
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-900">Fin</th> {/* Letras negras */}
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-900">Estado</th> {/* Letras negras */}
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-900">Acciones</th> {/* Letras negras */}
          </tr>
        </thead>
        <tbody className="divide-y bg-white">
          {runs.map((r) => (
            <tr key={r.id} className="hover:bg-gray-50">
              <td className="px-4 py-2 text-sm text-gray-900">{safeDate(r.started_at, true)}</td> {/* Letras negras */}
              <td className="px-4 py-2 text-sm text-gray-900">{safeDate(r.finished_at, true)}</td> {/* Letras negras */}
              <td className="px-4 py-2">
                {r.status === "COMPLETED" ? (
                  <Badge className="bg-green-100 text-green-800 border border-green-200">OK</Badge>
                ) : r.status === "FAILED" ? (
                  <Badge className="bg-red-100 text-red-800 border border-red-200">Fallo</Badge>
                ) : (
                  <Badge className="bg-yellow-100 text-yellow-800 border border-yellow-200">
                    {r.status || "En curso"}
                  </Badge>
                )}
              </td>
              <td className="px-4 py-2">
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openLogs(r)}
                    title="Ver logs"
                  >
                    <Terminal className="h-4 w-4" />
                  </Button>

                  {r.status === "FAILED" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => retryRun(r)}
                      title="Reintentar ejecución"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}

          {runs.length === 0 && (
            <tr>
              <td colSpan="4" className="text-center py-8 text-gray-500">
                Sin ejecuciones.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </CardContent>
</Card>

          <Card>
            <CardHeader>
              <CardTitle>Logs {selectedRun ? `run #${selectedRun.id}` : ""}</CardTitle>
              <CardDescription>
                {selectedRun ? `Estado: ${selectedRun.status}` : "Selecciona una ejecución"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <div className="text-gray-500 text-sm">
                  Selecciona una ejecución para ver la bitácora.
                </div>
              ) : (
                <div className="max-h-[420px] overflow-auto space-y-2 font-mono text-xs">
                  {logs.map((l) => (
                    <div
                      key={l.id || `${l.timestamp}-${l.message}`}
                      className={`rounded border p-2 ${l.level === "ERROR"
                          ? "bg-red-50 border-red-200"
                          : l.level === "WARN"
                            ? "bg-yellow-50 border-yellow-200"
                            : "bg-gray-50 border-gray-200"
                        }`}
                    >
                      <div className="flex justify-between">
                        <span className="text-gray-600">{safeDate(l.timestamp, true)}</span>
                        <Badge variant="secondary">{l.level}</Badge>
                      </div>

                      <div className="mt-1 whitespace-pre-wrap">{l.message}</div>

                      {l.meta && (
                        <pre className="mt-1 opacity-80">{safeJson(l.meta)}</pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

/* =========================================================
   MAIN
========================================================= */
const MineduIntegrationModule = () => {
  const { user, hasPerm } = useAuth();

  const roles = Array.isArray(user?.roles) ? user.roles : [];

  const canByRole =
    roles.includes("ADMIN_SYSTEM") ||
    roles.includes("ADMIN") ||
    roles.includes("REGISTRAR");

  const canByPerm =
    (hasPerm && hasPerm("admin.access.manage")) ||
    (hasPerm && hasPerm("minedu.access"));

  const canAccess = !!user && (canByRole || canByPerm);

  if (!canAccess) {
    return (
      <div className="p-6 text-center">
        <Shield className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Acceso Restringido
        </h2>
        <p className="text-gray-600">
          Solo ADMIN/REGISTRAR pueden acceder al módulo MINEDU.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div
        className="
          bg-white/70
          backdrop-blur-md
          border border-white/40
          rounded-xl
          p-6
          shadow-md
        "
      >
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6 bg-white/60">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="mappings">Mapeos</TabsTrigger>
            <TabsTrigger value="export">Exportar</TabsTrigger>
            <TabsTrigger value="history">Historial</TabsTrigger>
            <TabsTrigger value="jobs">Jobs & Logs</TabsTrigger>
            <TabsTrigger value="validation">Validación</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <MineduDashboard />
          </TabsContent>

          <TabsContent value="mappings">
            <MappingsModule />
          </TabsContent>

          <TabsContent value="export">
            <ExportDataModule />
          </TabsContent>

          <TabsContent value="history">
            <ExportHistoryModule />
          </TabsContent>

          <TabsContent value="jobs">
            <JobsLogsModule />
          </TabsContent>

          <TabsContent value="validation">
            <DataValidationModule />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default MineduIntegrationModule;
