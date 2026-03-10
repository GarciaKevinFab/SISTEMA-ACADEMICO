// src/modules/mesa-partes/MesaDePartesModule.jsx
import React, {
  useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle,
} from "react";
import { useAuth } from "../../context/AuthContext";
import IfPerm from "@/components/auth/IfPerm";
import { PERMS } from "@/auth/permissions";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "../../components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import {
  FileText, Clock, CheckCircle2, Plus, Search, Eye, Download,
  QrCode, BarChart3, TrendingUp, Send, Trash2, Paperclip, Pencil, Power,
  ExternalLink, ChevronDown, Loader2, ArrowRight, Inbox,
  ShieldAlert, Settings2, ClipboardList, AlertCircle, AlertTriangle,
  CalendarClock, Flame, Calendar, Filter, X, RefreshCw,
  Building2, Edit3,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Procedures as ProcSvc, Catalog, ProcedureFiles,
  ProcedureTypes, MesaPartesDashboard, MesaPartesPublic, Offices,
} from "../../services/mesaPartes.service";
import MesaPartesReports from "./MesaPartesReports";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

/* ─── Helpers ─────────────────────────────────────────────────── */
function formatApiError(err, fallback = "Ocurrió un error") {
  if (typeof err?.message === "string" && err.message.trim()) return err.message;
  const data = err?.response?.data;
  if (data?.detail) {
    const d = data.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) {
      const msgs = d.map(e => {
        const field = Array.isArray(e?.loc) ? e.loc.join(".") : e?.loc;
        return e?.msg ? (field ? `${field}: ${e.msg}` : e.msg) : null;
      }).filter(Boolean);
      if (msgs.length) return msgs.join(" | ");
    }
  }
  if (typeof data?.error?.message === "string") return data.error.message;
  if (typeof data?.message === "string") return data.message;
  if (typeof data?.error === "string") return data.error;
  return fallback;
}

const isOverdue = (deadline) => {
  if (!deadline) return false;
  return new Date(deadline) < new Date();
};

const fmtDate = (iso, withTime = false) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-PE", {
    day: "2-digit", month: "2-digit", year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
};

const daysLeft = (deadline) => {
  if (!deadline) return null;
  const diff = new Date(deadline) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

/* ─── Status config ──────────────────────────────────────────── */
const STATUS_MAP = {
  RECEIVED: { label: "Recibido", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  IN_REVIEW: { label: "En Revisión", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  APPROVED: { label: "Aprobado", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  REJECTED: { label: "Rechazado", cls: "bg-red-50 text-red-700 border-red-200" },
  COMPLETED: { label: "Completado", cls: "bg-violet-50 text-violet-700 border-violet-200" },
};

/* ─── Urgency config ─────────────────────────────────────────── */
const URGENCY_MAP = {
  LOW: { label: "Baja", cls: "bg-slate-100 text-slate-500 border-slate-200", dot: "#94a3b8" },
  NORMAL: { label: "Normal", cls: "bg-sky-50 text-sky-600 border-sky-200", dot: "#0ea5e9" },
  HIGH: { label: "Alta", cls: "bg-orange-50 text-orange-600 border-orange-200", dot: "#f97316" },
  URGENT: { label: "Urgente", cls: "bg-red-50 text-red-600 border-red-200", dot: "#ef4444" },
};

/* ─── Shared UI ──────────────────────────────────────────────── */
const FieldLabel = ({ children, required, error }) => (
  <p className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${error ? "text-red-500" : "text-slate-500"}`}>
    {children}{required && <span className="text-red-500 ml-0.5">*</span>}
  </p>
);

const SectionHead = ({ label, color = "slate", icon: Icon }) => {
  const colorMap = {
    slate: { box: "bg-slate-100 border-slate-200 text-slate-600", text: "text-slate-700" },
    blue: { box: "bg-blue-50 border-blue-100 text-blue-600", text: "text-blue-700" },
    emerald: { box: "bg-emerald-50 border-emerald-100 text-emerald-600", text: "text-emerald-700" },
    violet: { box: "bg-violet-50 border-violet-100 text-violet-600", text: "text-violet-700" },
    amber: { box: "bg-amber-50 border-amber-100 text-amber-600", text: "text-amber-700" },
  };
  const c = colorMap[color] ?? colorMap.slate;
  return (
    <div className="flex items-center gap-2 mb-3">
      {Icon && (
        <div className={`h-6 w-6 rounded-lg border grid place-items-center shrink-0 ${c.box}`}>
          <Icon size={12} />
        </div>
      )}
      <p className={`text-[10px] font-extrabold uppercase tracking-widest ${c.text}`}>{label}</p>
      <div className="flex-1 h-px bg-slate-100" />
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const s = STATUS_MAP[status] ?? { label: status, cls: "bg-slate-100 text-slate-600 border-slate-200" };
  return (
    <span className={`inline-flex items-center text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${s.cls}`}>
      {s.label}
    </span>
  );
};

const UrgencyBadge = ({ urgency }) => {
  if (!urgency || urgency === "NORMAL") return null;
  const u = URGENCY_MAP[urgency] ?? URGENCY_MAP.NORMAL;
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border ${u.cls}`}>
      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: u.dot }} />
      {u.label}
    </span>
  );
};

const DeadlineBadge = ({ deadline, status }) => {
  if (!deadline || ["COMPLETED", "REJECTED"].includes(status)) return null;
  const days = daysLeft(deadline);
  const over = days < 0;
  const warn = days >= 0 && days <= 2;
  if (!over && !warn) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border ${over ? "bg-red-50 text-red-600 border-red-200" : "bg-amber-50 text-amber-600 border-amber-200"
      }`}>
      <AlertTriangle size={9} className="shrink-0" />
      {over ? `Vencido hace ${Math.abs(days)}d` : `Vence en ${days}d`}
    </span>
  );
};

const LoadingCenter = ({ text = "Cargando…" }) => (
  <div className="flex items-center justify-center py-14">
    <div className="flex flex-col items-center gap-2">
      <div className="h-10 w-10 rounded-2xl bg-slate-50 border border-slate-200 grid place-items-center">
        <Loader2 size={18} className="animate-spin text-slate-400" />
      </div>
      <p className="text-sm text-slate-400 font-medium">{text}</p>
    </div>
  </div>
);

const EmptyState = ({ icon: Icon = Inbox, title, subtitle }) => (
  <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white py-14 flex flex-col items-center gap-2 text-center px-6">
    <div className="h-12 w-12 rounded-2xl bg-slate-100 grid place-items-center">
      <Icon size={22} className="text-slate-300" />
    </div>
    <p className="text-sm font-bold text-slate-500">{title}</p>
    {subtitle && <p className="text-xs text-slate-400 max-w-xs">{subtitle}</p>}
  </div>
);

const Th = ({ children, right }) => (
  <th className={`px-4 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-slate-50 whitespace-nowrap border-b border-slate-100 ${right ? "text-right" : "text-left"}`}>
    {children}
  </th>
);
const Td = ({ children, className = "" }) => (
  <td className={`px-4 py-3 text-sm text-slate-800 border-b border-slate-50 align-middle ${className}`}>{children}</td>
);

const StatCard = ({ label, value, subtitle, Icon, accent = "blue", loading, delay = 0, alert }) => {
  const themes = {
    amber: { bar: "border-t-amber-500", iconBg: "bg-amber-50 border-amber-100", iconCls: "text-amber-600" },
    green: { bar: "border-t-emerald-500", iconBg: "bg-emerald-50 border-emerald-100", iconCls: "text-emerald-600" },
    blue: { bar: "border-t-blue-500", iconBg: "bg-blue-50 border-blue-100", iconCls: "text-blue-600" },
    slate: { bar: "border-t-slate-500", iconBg: "bg-slate-50 border-slate-200", iconCls: "text-slate-600" },
    red: { bar: "border-t-red-500", iconBg: "bg-red-50 border-red-200", iconCls: "text-red-500" },
  };
  const th = themes[accent] ?? themes.blue;
  return (
    <div className={`rounded-2xl border border-slate-200/80 border-t-4 ${th.bar} bg-white shadow-sm p-4 hover:-translate-y-0.5 transition-all duration-200 ${alert && Number(value) > 0 ? "ring-1 ring-red-200" : ""}`}
      style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
          <div className="mt-2">
            {loading
              ? <div className="h-8 w-16 rounded-xl bg-slate-200 animate-pulse" />
              : <p className={`text-3xl font-black tabular-nums leading-none ${alert && Number(value) > 0 ? "text-red-600" : "text-slate-800"}`}>{value}</p>
            }
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5">{subtitle}</p>
        </div>
        <div className={`h-10 w-10 rounded-xl border grid place-items-center shrink-0 ${th.iconBg}`}>
          <Icon size={18} className={th.iconCls} />
        </div>
      </div>
    </div>
  );
};

const ActionCard = ({ label, sublabel, Icon, color, bg, onClick, delay = 0 }) => (
  <button onClick={onClick}
    className="flex flex-col items-center gap-2.5 p-5 bg-white border border-slate-200/80 rounded-2xl shadow-sm cursor-pointer hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300 transition-all duration-200 text-center w-full"
    style={{ animationDelay: `${delay}ms` }}>
    <div className="h-11 w-11 rounded-2xl grid place-items-center transition-transform duration-200 hover:scale-110"
      style={{ background: bg, color }}>
      <Icon size={20} />
    </div>
    <div>
      <p className="text-sm font-bold text-slate-700 leading-tight">{label}</p>
      {sublabel && <p className="text-[11px] text-slate-400 mt-0.5">{sublabel}</p>}
    </div>
    <ArrowRight size={12} className="text-slate-300" />
  </button>
);

const FieldError = ({ msg }) => msg ? (
  <p className="text-[10px] font-bold text-red-500 flex items-center gap-1 mt-0.5">
    <AlertCircle size={9} /> {msg}
  </p>
) : null;

const DetailCard = ({ title, icon: Icon, iconColor = "slate", children }) => {
  const colorMap = {
    slate: "bg-slate-100 border-slate-200 text-slate-600",
    blue: "bg-blue-50 border-blue-100 text-blue-600",
    violet: "bg-violet-50 border-violet-100 text-violet-600",
    emerald: "bg-emerald-50 border-emerald-100 text-emerald-600",
    red: "bg-red-50 border-red-100 text-red-600",
    amber: "bg-amber-50 border-amber-100 text-amber-600",
  };
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/60">
        {Icon && (
          <div className={`h-6 w-6 rounded-lg border grid place-items-center shrink-0 ${colorMap[iconColor] ?? colorMap.slate}`}>
            <Icon size={12} />
          </div>
        )}
        <p className="text-xs font-extrabold text-slate-700 uppercase tracking-widest">{title}</p>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════
   DASHBOARD
════════════════════════════════════════════════════════════ */
const MesaDePartesDashboardUI = ({ onNew, onSearch, onQR, onReports, onShowOverdue }) => {
  const { hasAny } = useAuth();
  const canSee = hasAny([PERMS["mpv.processes.review"], PERMS["mpv.reports.view"]]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [recent, setRecent] = useState([]);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const s = (await MesaPartesDashboard.stats())?.stats ?? {};
      setStats(s);
    } catch (e) { toast.error(formatApiError(e, "Error al cargar estadísticas")); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (canSee) fetchStats(); }, [fetchStats, canSee]);
  if (!canSee) return null;

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <StatCard label="Trámites Pendientes" value={stats.pending_procedures || 0}
          subtitle="Sin completar" Icon={Clock} accent="amber" loading={loading} delay={0} />
        <StatCard label="Completados Hoy" value={stats.completed_today || 0}
          subtitle="Finalizados" Icon={CheckCircle2} accent="green" loading={loading} delay={60} />
        <StatCard label="Tiempo Promedio" value={`${stats.avg_processing_time || 0}d`}
          subtitle="Procesamiento" Icon={TrendingUp} accent="blue" loading={loading} delay={120} />
        <StatCard label="Tipos de Trámite" value={stats.procedure_types || 0}
          subtitle="Disponibles" Icon={FileText} accent="slate" loading={loading} delay={180} />
        <StatCard label="Vencidos" value={stats.overdue || 0}
          subtitle="Plazo excedido" Icon={AlertTriangle} accent="red" loading={loading} delay={240}
          alert={true} />
      </div>

      {/* Alert banner if overdue */}
      {!loading && (stats.overdue || 0) > 0 && (
        <button onClick={onShowOverdue}
          className="w-full flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-3.5 text-left hover:bg-red-100 transition-colors">
          <div className="h-8 w-8 rounded-xl bg-red-100 border border-red-200 grid place-items-center shrink-0">
            <Flame size={16} className="text-red-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-red-700">
              {stats.overdue} trámite{stats.overdue !== 1 ? "s" : ""} con plazo vencido
            </p>
            <p className="text-xs text-red-500 mt-0.5">Haz clic para ver y gestionar</p>
          </div>
          <ArrowRight size={14} className="text-red-400" />
        </button>
      )}

      {/* Quick access */}
      <div>
        <SectionHead label="Accesos directos" color="slate" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <IfPerm any={[PERMS["mpv.processes.review"]]}>
            <ActionCard label="Nuevo Trámite" sublabel="Registrar" Icon={Plus} color="#2563EB" bg="#DBEAFE" onClick={onNew} delay={0} />
          </IfPerm>
          <IfPerm any={[PERMS["mpv.processes.review"]]}>
            <ActionCard label="Consultar Estado" sublabel="Buscar trámite" Icon={Search} color="#0891B2" bg="#CFFAFE" onClick={onSearch} delay={60} />
          </IfPerm>
          <IfPerm any={[PERMS["mpv.processes.review"]]}>
            <ActionCard label="Verificar QR" sublabel="Código de seguimiento" Icon={QrCode} color="#7C3AED" bg="#EDE9FE" onClick={onQR} delay={120} />
          </IfPerm>
          <IfPerm any={[PERMS["mpv.reports.view"]]}>
            <ActionCard label="Reportes" sublabel="Estadísticas" Icon={BarChart3} color="#059669" bg="#D1FAE5" onClick={onReports} delay={180} />
          </IfPerm>
        </div>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════
   TIPOS DE TRÁMITE
════════════════════════════════════════════════════════════ */
const ProcedureTypesManagement = () => {
  const { hasPerm } = useAuth();
  const canManage = hasPerm(PERMS["mpv.processes.resolve"]);
  const [procedureTypes, setProcedureTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterActive, setFilterActive] = useState("ALL"); // ALL | true | false
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState(null);
  const [formData, setFormData] = useState({
    name: "", description: "", required_documents: "",
    processing_days: 5, cost: 0, is_active: true,
  });

  const fetchTypes = useCallback(async () => {
    try {
      setLoading(true);
      setProcedureTypes((await ProcedureTypes.list())?.procedure_types ?? []);
    } catch (e) { toast.error(formatApiError(e, "Error al cargar tipos de trámite")); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchTypes(); }, [fetchTypes]);

  const handleCreate = async e => {
    e.preventDefault();
    try {
      await ProcedureTypes.create(formData);
      toast.success("Tipo de trámite creado"); setIsCreateOpen(false);
      setFormData({ name: "", description: "", required_documents: "", processing_days: 5, cost: 0, is_active: true });
      fetchTypes();
    } catch (e) { toast.error(formatApiError(e, "Error al crear tipo")); }
  };

  const toggleActive = async () => {
    if (!selected) return;
    try {
      const next = !selected.is_active;
      await ProcedureTypes.toggle(selected.id, next);
      toast.success(`Tipo ${next ? "activado" : "inactivado"}`);
      setSelected({ ...selected, is_active: next }); fetchTypes();
    } catch (e) { toast.error(formatApiError(e, "No se pudo cambiar el estado")); }
  };

  const saveEdit = async e => {
    e?.preventDefault?.();
    if (!selected) return;
    try {
      await ProcedureTypes.patch(selected.id, {
        name: selected.name?.trim() ?? "", description: selected.description ?? "",
        required_documents: selected.required_documents ?? "",
        processing_days: Number(selected.processing_days || 0), cost: Number(selected.cost || 0),
      });
      toast.success("Tipo actualizado"); setEditing(false); fetchTypes();
    } catch (e) { toast.error(formatApiError(e, "No se pudo actualizar")); }
  };

  if (!canManage) return null;

  const filtered = procedureTypes.filter(t => {
    if (filterActive === "ALL") return true;
    return String(t.is_active) === filterActive;
  });

  const activeCount = procedureTypes.filter(t => t.is_active).length;
  const inactiveCount = procedureTypes.filter(t => !t.is_active).length;

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-base font-extrabold text-slate-800 flex items-center gap-2">
            <div className="h-7 w-7 rounded-xl bg-slate-100 border border-slate-200 grid place-items-center shrink-0">
              <Settings2 size={13} className="text-slate-600" />
            </div>
            Tipos de Trámite
          </p>
          <p className="text-xs text-slate-400 mt-0.5 ml-9">
            {activeCount} activo{activeCount !== 1 ? "s" : ""} · {inactiveCount} inactivo{inactiveCount !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Active filter tabs */}
          <div className="flex rounded-xl border border-slate-200 overflow-hidden text-xs font-bold">
            {[["ALL", "Todos"], ["true", "Activos"], ["false", "Inactivos"]].map(([v, l]) => (
              <button key={v} onClick={() => setFilterActive(v)}
                className={`px-3 py-1.5 transition-colors ${filterActive === v
                  ? "bg-slate-800 text-white"
                  : "bg-white text-slate-500 hover:bg-slate-50"}`}>
                {l}
              </button>
            ))}
          </div>
          <Button size="sm" className="h-9 rounded-xl gap-1.5 font-extrabold bg-slate-800 hover:bg-slate-900"
            onClick={() => setIsCreateOpen(true)}>
            <Plus size={13} /> Nuevo tipo
          </Button>
        </div>
      </div>

      {loading ? <LoadingCenter /> : filtered.length === 0 ? (
        <EmptyState icon={FileText} title="Sin tipos de trámite"
          subtitle={filterActive !== "ALL" ? "Prueba cambiando el filtro" : "Crea el primer tipo para comenzar"} />
      ) : (
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr><Th>Tipo de Trámite</Th><Th>Días</Th><Th>Costo</Th><Th>Estado</Th><Th right>Acción</Th></tr>
            </thead>
            <tbody>
              {filtered.map(type => (
                <tr key={type.id} className="group hover:bg-slate-50/40 transition-colors">
                  <Td>
                    <p className="font-bold text-slate-800">{type.name}</p>
                    {type.description && <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-xs">{type.description}</p>}
                    {type.required_documents && (
                      <p className="text-[10px] text-slate-300 mt-0.5 truncate max-w-xs">Docs: {type.required_documents}</p>
                    )}
                  </Td>
                  <Td className="font-mono tabular-nums text-slate-600">{type.processing_days}d</Td>
                  <Td className="font-bold text-slate-700 tabular-nums">S/. {(Number(type.cost) || 0).toFixed(2)}</Td>
                  <Td>
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${type.is_active
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-slate-100 text-slate-500 border-slate-200"}`}>
                      {type.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </Td>
                  <Td className="text-right">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-xl hover:bg-slate-100 text-slate-400"
                      onClick={() => { setSelected(type); setEditing(false); setViewOpen(true); }}>
                      <Eye size={13} />
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl rounded-2xl p-0 border-0 shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-[#1a2035] via-[#1e293b] to-[#252d3d] px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/10 border border-white/20 grid place-items-center shrink-0">
                <Settings2 size={18} className="text-white" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300 mb-0.5">Configuración</p>
                <p className="font-extrabold text-white">Crear Tipo de Trámite</p>
              </div>
            </div>
          </div>
          <form onSubmit={handleCreate} className="bg-white p-6 space-y-4">
            <div>
              <FieldLabel required>Nombre</FieldLabel>
              <Input className="h-10 rounded-xl" value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })} required />
            </div>
            <div>
              <FieldLabel>Descripción</FieldLabel>
              <Textarea className="rounded-xl resize-none" rows={2} value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })} />
            </div>
            <div>
              <FieldLabel>Documentos requeridos</FieldLabel>
              <Textarea className="rounded-xl resize-none" rows={2} value={formData.required_documents}
                placeholder="Liste los documentos necesarios"
                onChange={e => setFormData({ ...formData, required_documents: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel required>Días de procesamiento</FieldLabel>
                <Input type="number" min="1" className="h-10 rounded-xl font-mono text-center"
                  value={formData.processing_days}
                  onChange={e => setFormData({ ...formData, processing_days: parseInt(e.target.value || "0", 10) })} required />
              </div>
              <div>
                <FieldLabel required>Costo (S/.)</FieldLabel>
                <Input type="number" min="0" step="0.01" className="h-10 rounded-xl font-mono text-center"
                  value={formData.cost}
                  onChange={e => setFormData({ ...formData, cost: parseFloat(e.target.value || "0") })} required />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button type="button" variant="outline" className="rounded-xl font-semibold"
                onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
              <Button type="submit" className="rounded-xl font-extrabold gap-2 bg-slate-800 hover:bg-slate-900">
                Crear tipo
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* View/Edit dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-2xl rounded-2xl p-0 border-0 shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-[#1a2035] via-[#1e293b] to-[#252d3d] px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/10 border border-white/20 grid place-items-center shrink-0">
                {editing ? <Pencil size={18} className="text-white" /> : <Eye size={18} className="text-white" />}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300 mb-0.5">
                  {editing ? "Editar tipo" : "Detalle"}
                </p>
                <p className="font-extrabold text-white truncate">{selected?.name}</p>
              </div>
            </div>
          </div>
          {selected && (
            <form onSubmit={saveEdit} className="bg-white p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Nombre</FieldLabel>
                  <Input className="h-10 rounded-xl" disabled={!editing} value={selected.name || ""}
                    onChange={e => setSelected({ ...selected, name: e.target.value })} />
                </div>
                <div>
                  <FieldLabel>Días de procesamiento</FieldLabel>
                  <Input type="number" min="1" className="h-10 rounded-xl font-mono text-center" disabled={!editing}
                    value={selected.processing_days ?? 1}
                    onChange={e => setSelected({ ...selected, processing_days: parseInt(e.target.value || "0", 10) })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Costo (S/.)</FieldLabel>
                  <Input type="number" min="0" step="0.01" className="h-10 rounded-xl font-mono text-center" disabled={!editing}
                    value={selected.cost ?? 0}
                    onChange={e => setSelected({ ...selected, cost: parseFloat(e.target.value || "0") })} />
                </div>
                <div className="flex items-end pb-1">
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${selected.is_active
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-slate-100 text-slate-500 border-slate-200"}`}>
                    {selected.is_active ? "Activo" : "Inactivo"}
                  </span>
                </div>
              </div>
              <div>
                <FieldLabel>Descripción</FieldLabel>
                <Textarea className="rounded-xl resize-none" rows={2} disabled={!editing}
                  value={selected.description ?? ""}
                  onChange={e => setSelected({ ...selected, description: e.target.value })} />
              </div>
              <div>
                <FieldLabel>Documentos requeridos</FieldLabel>
                <Textarea className="rounded-xl resize-none" rows={2} disabled={!editing}
                  value={selected.required_documents ?? ""}
                  onChange={e => setSelected({ ...selected, required_documents: e.target.value })} />
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-100">
                <Button type="button" variant="outline" className="rounded-xl font-semibold gap-1.5" onClick={toggleActive}>
                  <Power size={13} /> {selected.is_active ? "Inactivar" : "Activar"}
                </Button>
                <div className="flex gap-2">
                  {!editing ? (
                    <Button type="button" className="rounded-xl font-extrabold gap-2 bg-slate-800 hover:bg-slate-900"
                      onClick={() => setEditing(true)}>
                      <Pencil size={13} /> Editar
                    </Button>
                  ) : (
                    <>
                      <Button type="button" variant="outline" className="rounded-xl font-semibold"
                        onClick={() => setEditing(false)}>Cancelar</Button>
                      <Button type="submit" className="rounded-xl font-extrabold gap-2 bg-slate-800 hover:bg-slate-900">
                        Guardar
                      </Button>
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

/* ════════════════════════════════════════════════════════════
   PROCEDURE DETAIL DIALOG
════════════════════════════════════════════════════════════ */
const ProcedureDetailDialog = ({ open, onOpenChange, procedureId, onChanged }) => {
  const { hasPerm } = useAuth();
  const canResolve = hasPerm(PERMS["mpv.processes.resolve"]);
  const canUpload = hasPerm(PERMS["mpv.files.upload"]);
  const canReview = hasPerm(PERMS["mpv.processes.review"]);

  const [loading, setLoading] = useState(false);
  const [genLoading, setGenLoading] = useState({});
  const [proc, setProc] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [offices, setOffices] = useState([]);
  const [users, setUsers] = useState([]);
  const [files, setFiles] = useState([]);

  const fetchFiles = useCallback(async () => {
    if (!proc?.id) return;
    setFiles((await ProcedureFiles.list(proc.id))?.files ?? []);
  }, [proc?.id]);

  const uploadFile = async e => {
    const file = e.target.files?.[0];
    if (!file || !proc?.id) return;
    try { await ProcedureFiles.upload(proc.id, file, {}); toast.success("Archivo subido"); await fetchFiles(); }
    catch (err) { toast.error(formatApiError(err, "No se pudo subir el archivo")); }
    finally { e.target.value = ""; }
  };

  const deleteFile = async f => {
    if (!proc?.id) return;
    try { await ProcedureFiles.remove(proc.id, f.id); toast.success("Archivo eliminado"); await fetchFiles(); }
    catch (err) { toast.error(formatApiError(err, "No se pudo eliminar el archivo")); }
  };

  const [routeForm, setRouteForm] = useState({ to_office_id: "", assignee_id: "", deadline_at: "", note: "" });
  const [statusForm, setStatusForm] = useState({ status: "IN_REVIEW", note: "" });
  const [notifyForm, setNotifyForm] = useState({ channels: ["EMAIL"], subject: "", message: "" });

  const load = useCallback(async () => {
    if (!procedureId || !canReview) return;
    try {
      setLoading(true);
      const [p, t, o, u] = await Promise.all([
        ProcSvc.get(procedureId),
        ProcSvc.timeline(procedureId),
        Catalog.offices({ active_only: "1" }),
        Catalog.users({ role: "STAFF" }),
      ]);
      const proc = p?.procedure || p;
      setProc(proc);
      setTimeline(Array.isArray(t?.timeline) ? t.timeline : Array.isArray(t) ? t : []);
      setOffices(Array.isArray(o?.offices) ? o.offices : Array.isArray(o) ? o : []);
      setUsers(Array.isArray(u?.users) ? u.users : Array.isArray(u) ? u : []);
      // Pre-fill status form with current status
      if (proc?.status) setStatusForm(s => ({ ...s, status: proc.status }));
      // Pre-fill route form with current values
      if (proc?.current_office) setRouteForm(f => ({ ...f, to_office_id: String(proc.current_office) }));
      if (proc?.assignee) setRouteForm(f => ({ ...f, assignee_id: String(proc.assignee) }));
      // Pre-fill notify subject
      if (proc?.tracking_code) setNotifyForm(f => ({ ...f, subject: f.subject || `Actualización de su trámite ${proc.tracking_code}` }));
    } catch (e) { toast.error(formatApiError(e, "No se pudo cargar el detalle")); }
    finally { setLoading(false); }
  }, [procedureId, canReview]);

  useEffect(() => { if (open) load(); }, [open, load]);
  useEffect(() => { if (open && proc?.id) fetchFiles(); }, [open, proc?.id, fetchFiles]);

  const doRoute = async () => {
    try {
      await ProcSvc.route(proc.id, {
        to_office_id: Number(routeForm.to_office_id),
        assignee_id: routeForm.assignee_id ? Number(routeForm.assignee_id) : null,
        note: routeForm.note,
        deadline_at: routeForm.deadline_at || null,
      });
      toast.success("Trámite derivado"); await load(); onChanged?.();
    } catch (e) { toast.error(formatApiError(e, "No se pudo derivar")); }
  };

  const doStatus = async () => {
    try { await ProcSvc.setStatus(proc.id, statusForm); toast.success("Estado actualizado"); await load(); onChanged?.(); }
    catch (e) { toast.error(formatApiError(e, "No se pudo actualizar estado")); }
  };

  const doNotify = async () => {
    try {
      const res = await ProcSvc.notify(proc.id, notifyForm);
      const r = res?.results || {};
      if (r.email === "sent") toast.success("Email enviado al solicitante");
      else if (r.email === "sin_correo") toast.warning("El solicitante no tiene correo registrado");
      else if (typeof r.email === "string" && r.email.startsWith("error")) toast.error(`Error email: ${r.email}`);
      else toast.success("Notificación registrada");
      if (r.sms === "no_provider") toast.info("SMS requiere configurar un proveedor");
    } catch (e) { toast.error(formatApiError(e, "No se pudo notificar")); }
  };

  const genDoc = async (type, label) => {
    const id = proc?.id ?? procedureId;
    const code = proc?.tracking_code || String(id);
    if (!id) return toast.error("No se pudo obtener el ID del trámite");
    setGenLoading(prev => ({ ...prev, [type]: true }));
    try {
      if (type === "cover") await ProcSvc.downloadCover(id, code);
      else await ProcSvc.downloadCargo(id, code);
      toast.success(`${label} generado correctamente`);
    } catch (e) { toast.error(formatApiError(e, `Error al generar ${label}`)); }
    finally { setGenLoading(prev => ({ ...prev, [type]: false })); }
  };

  const overdue = proc && isOverdue(proc.deadline_at) && !["COMPLETED", "REJECTED"].includes(proc.status);
  const urgencyInfo = proc?.urgency_level ? URGENCY_MAP[proc.urgency_level] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[88vh] overflow-y-auto rounded-2xl p-0 border-0 shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1a2035] via-[#1e293b] to-[#252d3d] px-6 py-5 sticky top-0 z-10">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="h-10 w-10 rounded-xl bg-white/10 border border-white/20 grid place-items-center shrink-0">
              <ClipboardList size={18} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300 mb-0.5">Detalle del Trámite</p>
              <p className="font-extrabold text-white">
                {proc?.tracking_code
                  ? <span>Código <span className="font-mono text-slate-300">#{proc.tracking_code}</span></span>
                  : "Cargando…"}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {proc && <StatusBadge status={proc.status} />}
              {urgencyInfo && proc?.urgency_level !== "NORMAL" && (
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${urgencyInfo.cls}`}>
                  {urgencyInfo.label}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white p-6">
          {!canReview ? (
            <EmptyState icon={ShieldAlert} title="Sin permiso" subtitle="No tienes permiso para ver el detalle" />
          ) : loading ? <LoadingCenter /> : proc ? (
            <>
              {/* Overdue warning banner */}
              {overdue && (
                <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 mb-4">
                  <AlertTriangle size={16} className="text-red-500 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-red-700">Plazo vencido</p>
                    <p className="text-xs text-red-500">
                      Fecha límite: {fmtDate(proc.deadline_at, true)}
                    </p>
                  </div>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                {/* LEFT */}
                <div className="space-y-4">
                  <DetailCard title="Resumen del trámite" icon={ClipboardList} iconColor="slate">
                    <div className="space-y-2">
                      {[
                        ["Solicitante", `${proc.applicant_name} · DNI ${proc.applicant_document}`],
                        ["Correo", proc.applicant_email || "—"],
                        ["Celular", proc.applicant_phone || "—"],
                        ["Tipo", proc.procedure_type_name],
                        ["Oficina actual", proc.current_office_name || "—"],
                        ["Responsable", proc.assignee_name || "—"],
                        ["Urgencia", (URGENCY_MAP[proc.urgency_level]?.label || "Normal")],
                        ["Vence", proc.deadline_at ? fmtDate(proc.deadline_at, true) : "—"],
                        ["Descripción", proc.description || "—"],
                      ].map(([k, v]) => (
                        <div key={k} className="flex gap-3 text-sm">
                          <span className="text-slate-400 font-semibold w-28 shrink-0 text-xs">{k}</span>
                          <span className="text-slate-700 font-medium break-words min-w-0">{v}</span>
                        </div>
                      ))}
                      <div className="flex gap-3 items-center text-sm">
                        <span className="text-slate-400 font-semibold w-28 shrink-0 text-xs">Estado</span>
                        <StatusBadge status={proc.status} />
                      </div>

                      {/* PDF buttons */}
                      <div className="flex gap-2 pt-2 border-t border-slate-100">
                        <Button variant="outline" size="sm"
                          className="h-8 rounded-xl gap-1.5 text-xs font-semibold"
                          disabled={!!genLoading.cover}
                          onClick={() => genDoc("cover", "Carátula")}>
                          {genLoading.cover ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
                          Carátula
                        </Button>
                        <Button variant="outline" size="sm"
                          className="h-8 rounded-xl gap-1.5 text-xs font-semibold"
                          disabled={!!genLoading.cargo}
                          onClick={() => genDoc("cargo", "Cargo")}>
                          {genLoading.cargo ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
                          Cargo
                        </Button>
                      </div>
                    </div>
                  </DetailCard>

                  {/* Timeline */}
                  <DetailCard title="Trazabilidad" icon={TrendingUp} iconColor="blue">
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {!timeline.length
                        ? <p className="text-sm text-slate-400">Sin eventos registrados</p>
                        : timeline.map((ev, i) => (
                          <div key={i} className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[10px] text-slate-400">{ev?.at ? fmtDate(ev.at, true) : "—"}</p>
                              {ev.actor_name && <p className="text-[10px] text-slate-400 font-semibold">{ev.actor_name}</p>}
                            </div>
                            <p className="text-xs font-bold text-slate-700 mt-0.5">{ev.type}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{ev.description}</p>
                          </div>
                        ))
                      }
                    </div>
                  </DetailCard>

                  {/* Files */}
                  <DetailCard title={`Documentos adjuntos ${files.length > 0 ? `(${files.length})` : ""}`} icon={Paperclip} iconColor="slate">
                    <div className="space-y-3">
                      {canUpload && (
                        <Input type="file" accept="application/pdf,image/*" onChange={uploadFile}
                          className="h-9 rounded-xl text-sm" />
                      )}
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {!files.length
                          ? <p className="text-sm text-slate-400">Sin archivos adjuntos</p>
                          : files.map(f => (
                            <div key={f.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <Paperclip size={12} className="text-slate-400 shrink-0" />
                                <a href={f.url} target="_blank" rel="noreferrer"
                                  className="text-xs text-blue-600 hover:underline truncate">
                                  {f.filename || f.original_name || "archivo"}
                                </a>
                                {f.size && <span className="text-[10px] text-slate-400 shrink-0">{Math.round(f.size / 1024)} KB</span>}
                              </div>
                              {canUpload && (
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-xl text-red-400 hover:text-red-600 hover:bg-red-50"
                                  onClick={() => deleteFile(f)}>
                                  <Trash2 size={12} />
                                </Button>
                              )}
                            </div>
                          ))
                        }
                      </div>
                    </div>
                  </DetailCard>
                </div>

                {/* RIGHT */}
                <div className="space-y-4">
                  {/* Route */}
                  <DetailCard title="Derivar trámite" icon={Send} iconColor="blue">
                    <div className="space-y-3">
                      <div>
                        <FieldLabel>Oficina destino</FieldLabel>
                        <Select value={routeForm.to_office_id || undefined}
                          onValueChange={v => setRouteForm({ ...routeForm, to_office_id: v })} disabled={!canResolve}>
                          <SelectTrigger className="h-9 rounded-xl text-sm"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                          <SelectContent>{offices.map(o => <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <FieldLabel>Responsable (opcional)</FieldLabel>
                        <Select value={routeForm.assignee_id || undefined}
                          onValueChange={v => setRouteForm({ ...routeForm, assignee_id: v })} disabled={!canResolve}>
                          <SelectTrigger className="h-9 rounded-xl text-sm"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                          <SelectContent>{users.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.full_name || u.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <FieldLabel>Nueva fecha límite</FieldLabel>
                        <Input type="datetime-local" className="h-9 rounded-xl text-sm"
                          value={routeForm.deadline_at}
                          onChange={e => setRouteForm({ ...routeForm, deadline_at: e.target.value })} disabled={!canResolve} />
                      </div>
                      <div>
                        <FieldLabel>Nota</FieldLabel>
                        <Textarea rows={2} className="rounded-xl resize-none text-sm"
                          value={routeForm.note}
                          onChange={e => setRouteForm({ ...routeForm, note: e.target.value })} disabled={!canResolve} />
                      </div>
                      <div className="flex justify-end">
                        <Button size="sm" className="h-9 rounded-xl gap-1.5 font-extrabold bg-slate-800 hover:bg-slate-900"
                          onClick={doRoute} disabled={!canResolve || !routeForm.to_office_id}>
                          <Send size={13} /> Derivar
                        </Button>
                      </div>
                    </div>
                  </DetailCard>

                  {/* Status */}
                  <DetailCard title="Actualizar estado" icon={CheckCircle2} iconColor="emerald">
                    <div className="space-y-3">
                      <div>
                        <FieldLabel>Nuevo estado</FieldLabel>
                        <Select value={statusForm.status}
                          onValueChange={v => setStatusForm({ ...statusForm, status: v })} disabled={!canResolve}>
                          <SelectTrigger className="h-9 rounded-xl text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(STATUS_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <FieldLabel>Nota</FieldLabel>
                        <Textarea rows={2} className="rounded-xl resize-none text-sm"
                          value={statusForm.note}
                          onChange={e => setStatusForm({ ...statusForm, note: e.target.value })} disabled={!canResolve} />
                      </div>
                      <div className="flex justify-end">
                        <Button variant="outline" size="sm" className="h-9 rounded-xl gap-1.5 font-semibold hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700"
                          onClick={doStatus} disabled={!canResolve}>
                          <CheckCircle2 size={13} /> Actualizar
                        </Button>
                      </div>
                    </div>
                  </DetailCard>

                  {/* Notify */}
                  <DetailCard title="Notificar al solicitante" icon={Send} iconColor="violet">
                    <div className="space-y-3">
                      <p className="text-xs text-slate-400">
                        Destinatario: <span className="font-semibold text-slate-600">{proc?.applicant_email || "Sin correo"}</span>
                        {proc?.applicant_phone && <span className="ml-2">· Tel: {proc.applicant_phone}</span>}
                      </p>
                      <div className="flex gap-2">
                        {["EMAIL", "SMS"].map(ch => (
                          <label key={ch}
                            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border cursor-pointer transition-colors ${notifyForm.channels.includes(ch)
                              ? "bg-slate-800 text-white border-slate-800"
                              : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                            <input type="checkbox" className="hidden"
                              checked={notifyForm.channels.includes(ch)}
                              onChange={e => setNotifyForm(f => ({
                                ...f,
                                channels: e.target.checked ? [...f.channels, ch] : f.channels.filter(x => x !== ch),
                              }))} disabled={!canResolve} />
                            {ch}{ch === "SMS" && <span className="text-[9px] text-amber-500 font-medium">(pendiente)</span>}
                          </label>
                        ))}
                      </div>
                      <div>
                        <FieldLabel>Asunto</FieldLabel>
                        <Input className="h-9 rounded-xl text-sm" value={notifyForm.subject}
                          onChange={e => setNotifyForm({ ...notifyForm, subject: e.target.value })} disabled={!canResolve} />
                      </div>
                      <div>
                        <FieldLabel>Mensaje</FieldLabel>
                        <Textarea rows={3} className="rounded-xl resize-none text-sm" value={notifyForm.message}
                          onChange={e => setNotifyForm({ ...notifyForm, message: e.target.value })} disabled={!canResolve} />
                      </div>
                      <div className="flex justify-end">
                        <Button size="sm" className="h-9 rounded-xl gap-1.5 font-extrabold bg-slate-800 hover:bg-slate-900"
                          onClick={doNotify} disabled={!canResolve}>
                          <Send size={13} /> Enviar
                        </Button>
                      </div>
                    </div>
                  </DetailCard>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};

/* ════════════════════════════════════════════════════════════
   GESTIÓN DE TRÁMITES
════════════════════════════════════════════════════════════ */
const ProceduresManagement = forwardRef(({ initialFilter }, ref) => {
  const { hasPerm } = useAuth();
  const canReview = hasPerm(PERMS["mpv.processes.review"]);

  const [procedures, setProcedures] = useState([]);
  const [procedureTypes, setProcedureTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [urgencyFilter, setUrgencyFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const searchInputRef = useRef(null);

  const [formData, setFormData] = useState({
    procedure_type_id: "", applicant_name: "", applicant_email: "",
    applicant_phone: "", applicant_document: "", description: "", urgency_level: "NORMAL",
  });
  const [errors, setErrors] = useState({});

  const onlyDigits = v => String(v).replace(/\D/g, "");

  const validateForm = () => {
    const e = {};
    if (!formData.procedure_type_id) e.procedure_type_id = "Seleccione un tipo";
    if (!formData.applicant_name?.trim()) e.applicant_name = "Nombre obligatorio";
    else if (formData.applicant_name.length < 3) e.applicant_name = "Mínimo 3 caracteres";
    if (!formData.applicant_document?.trim()) e.applicant_document = "Documento obligatorio";
    else if (formData.applicant_document.length !== 8) e.applicant_document = "Debe tener 8 dígitos";
    if (formData.applicant_email && !formData.applicant_email.includes("@")) e.applicant_email = "Correo inválido";
    if (formData.applicant_phone && formData.applicant_phone.length !== 9) e.applicant_phone = "Debe tener 9 dígitos";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleField = (field, value) => {
    setFormData({ ...formData, [field]: value });
    if (errors[field]) setErrors(p => ({ ...p, [field]: null }));
  };

  useImperativeHandle(ref, () => ({
    openCreate: () => setIsCreateOpen(true),
    focusSearch: () => { setStatusFilter("ALL"); setTimeout(() => searchInputRef.current?.focus(), 0); },
    filterOverdue: () => {
      // Show only overdue: status filter "pending", date filter shows those with expired deadline
      setStatusFilter("ALL");
      setShowFilters(true);
      setTimeout(() => searchInputRef.current?.focus(), 0);
    },
  }));

  const fetchProcedures = useCallback(async () => {
    if (!canReview) return;
    try {
      setLoading(true);
      setProcedures((await ProcSvc.list())?.procedures ?? []);
    } catch (e) { toast.error(formatApiError(e, "Error al cargar trámites")); }
    finally { setLoading(false); }
  }, [canReview]);

  const fetchTypes = useCallback(async () => {
    try { setProcedureTypes((await ProcedureTypes.list())?.procedure_types ?? []); } catch { }
  }, []);

  useEffect(() => { fetchProcedures(); fetchTypes(); }, [fetchProcedures, fetchTypes]);

  // Apply initial filter from dashboard (e.g. "show overdue")
  useEffect(() => {
    if (initialFilter === "overdue") {
      setShowFilters(true);
    }
  }, [initialFilter]);

  if (!canReview) return null;

  const handleSubmitData = async () => {
    try {
      const payload = { ...formData, procedure_type: formData.procedure_type_id ? Number(formData.procedure_type_id) : null };
      delete payload.procedure_type_id;
      await ProcSvc.create(payload);
      toast.success("Trámite creado"); setIsCreateOpen(false);
      setFormData({ procedure_type_id: "", applicant_name: "", applicant_email: "", applicant_phone: "", applicant_document: "", description: "", urgency_level: "NORMAL" });
      setErrors({}); fetchProcedures();
    } catch (e) { toast.error(formatApiError(e, "Error al crear trámite")); }
  };

  const onFormSubmit = e => { e.preventDefault(); if (validateForm()) handleSubmitData(); };

  const filtered = procedures.filter(p => {
    const q = searchTerm.toLowerCase();
    const match = (p?.tracking_code?.toLowerCase?.() || "").includes(q)
      || (p?.applicant_name?.toLowerCase?.() || "").includes(q)
      || (p?.procedure_type_name?.toLowerCase?.() || "").includes(q)
      || (p?.applicant_document || "").includes(q);
    const statusOk = statusFilter === "ALL" || p.status === statusFilter;
    const urgencyOk = urgencyFilter === "ALL" || p.urgency_level === urgencyFilter;
    const dateFromOk = !dateFrom || new Date(p.created_at) >= new Date(dateFrom);
    const dateToOk = !dateTo || new Date(p.created_at) <= new Date(dateTo + "T23:59:59");
    return match && statusOk && urgencyOk && dateFromOk && dateToOk;
  });

  const overdueCount = filtered.filter(p => isOverdue(p.deadline_at) && !["COMPLETED", "REJECTED"].includes(p.status)).length;
  const urgentCount = filtered.filter(p => p.urgency_level === "URGENT").length;
  const hasFilters = searchTerm || statusFilter !== "ALL" || urgencyFilter !== "ALL" || dateFrom || dateTo;

  const clearFilters = () => {
    setSearchTerm(""); setStatusFilter("ALL"); setUrgencyFilter("ALL");
    setDateFrom(""); setDateTo("");
  };

  const handleDownloadPDF = async proc => {
    if (!proc?.id) return toast.error("No se pudo obtener el ID");
    try {
      await ProcSvc.downloadCover(proc.id, proc.tracking_code || proc.id);
      toast.success("Carátula descargada");
    } catch (e) { toast.error(formatApiError(e, "Error al generar carátula")); }
  };

  const handleDeleteProcedure = async (proc) => {
    try {
      await ProcSvc.remove(proc.id);
      toast.success("Trámite eliminado");
      fetchProcedures();
    } catch (e) { toast.error(formatApiError(e, "No se pudo eliminar el trámite")); }
  };

  const openDetail = async p => {
    let id = p?.id;
    if (!id && p?.tracking_code) {
      const d = await ProcSvc.getByCode(p.tracking_code);
      id = (d?.procedure || d)?.id;
    }
    if (!id) return toast.error("No se pudo obtener el ID");
    setDetailId(id); setDetailOpen(true);
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-base font-extrabold text-slate-800 flex items-center gap-2">
            <div className="h-7 w-7 rounded-xl bg-slate-100 border border-slate-200 grid place-items-center shrink-0">
              <ClipboardList size={13} className="text-slate-600" />
            </div>
            Gestión de Trámites
          </p>
          <p className="text-xs text-slate-400 mt-0.5 ml-9">
            Registro, derivación y seguimiento
            {overdueCount > 0 && (
              <span className="ml-2 text-red-500 font-bold">{overdueCount} vencido{overdueCount !== 1 ? "s" : ""}</span>
            )}
            {urgentCount > 0 && (
              <span className="ml-2 text-orange-500 font-bold">{urgentCount} urgente{urgentCount !== 1 ? "s" : ""}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-9 rounded-xl gap-1.5 font-semibold border-slate-200"
            onClick={() => setShowFilters(f => !f)}>
            <Filter size={13} /> Filtros
            {hasFilters && <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />}
          </Button>
          <Button size="sm" variant="outline" className="h-9 w-9 p-0 rounded-xl border-slate-200"
            onClick={fetchProcedures} title="Refrescar">
            <RefreshCw size={13} />
          </Button>
          <Button size="sm" className="h-9 rounded-xl gap-1.5 font-extrabold bg-slate-800 hover:bg-slate-900"
            data-testid="open-create-procedure" onClick={() => setIsCreateOpen(true)}>
            <Plus size={13} /> Nuevo trámite
          </Button>
        </div>
      </div>

      {/* Search row */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input ref={searchInputRef} className="h-9 pl-8 rounded-xl text-sm border-slate-200"
            placeholder="Código, solicitante, DNI o tipo…"
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 rounded-xl text-sm w-full sm:w-44 border-slate-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los estados</SelectItem>
            {Object.entries(STATUS_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Advanced filters panel */}
      {showFilters && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Filtros avanzados</p>
            {hasFilters && (
              <button onClick={clearFilters}
                className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-red-500 transition-colors">
                <X size={11} /> Limpiar
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Urgencia</p>
              <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
                <SelectTrigger className="h-8 rounded-xl text-xs border-slate-200 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas</SelectItem>
                  {Object.entries(URGENCY_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Fecha desde</p>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="h-8 rounded-xl text-xs border-slate-200 bg-white" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Fecha hasta</p>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="h-8 rounded-xl text-xs border-slate-200 bg-white" />
            </div>
            <div className="flex items-end">
              <Button size="sm" variant="outline" className="h-8 w-full rounded-xl text-xs font-semibold border-slate-200 bg-white"
                onClick={() => {
                  const today = new Date().toISOString().split("T")[0];
                  setDateTo(today);
                  setDateFrom(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
                }}>
                <Calendar size={11} className="mr-1" /> Últimos 30d
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? <LoadingCenter /> : filtered.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Sin resultados"
          subtitle={hasFilters ? "Prueba con otros filtros" : "Aún no hay trámites registrados"} />
      ) : (
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <Th>Código</Th>
                  <Th>Solicitante</Th>
                  <Th>Tipo</Th>
                  <Th>Urgencia</Th>
                  <Th>Estado</Th>
                  <Th>Vencimiento</Th>
                  <Th>Fecha</Th>
                  <Th>Docs</Th>
                  <Th right>Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const over = isOverdue(p.deadline_at) && !["COMPLETED", "REJECTED"].includes(p.status);
                  return (
                    <tr key={p.id}
                      className={`group hover:bg-slate-50/40 transition-colors ${over ? "bg-red-50/30" : ""}`}>
                      <Td>
                        <span className="text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg font-mono">
                          {p.tracking_code}
                        </span>
                      </Td>
                      <Td>
                        <p className="font-bold text-slate-800">{p.applicant_name}</p>
                        <p className="text-[11px] text-slate-400 font-mono">{p.applicant_document}</p>
                      </Td>
                      <Td className="text-slate-600 max-w-[130px] truncate">{p.procedure_type_name}</Td>
                      <Td>
                        {p.urgency_level && p.urgency_level !== "NORMAL"
                          ? <UrgencyBadge urgency={p.urgency_level} />
                          : <span className="text-[11px] text-slate-300">—</span>
                        }
                      </Td>
                      <Td><StatusBadge status={p.status} /></Td>
                      <Td>
                        {p.deadline_at ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-mono text-slate-500">{fmtDate(p.deadline_at)}</span>
                            <DeadlineBadge deadline={p.deadline_at} status={p.status} />
                          </div>
                        ) : <span className="text-[11px] text-slate-300">—</span>}
                      </Td>
                      <Td className="text-xs text-slate-500 tabular-nums">
                        {p.created_at ? new Date(p.created_at).toLocaleDateString("es-PE") : "—"}
                      </Td>
                      <Td>
                        {(p.files_count || 0) > 0 ? (
                          <span className="inline-flex items-center justify-center h-5 w-5 rounded-lg text-white text-[10px] font-bold bg-slate-600">
                            {p.files_count}
                          </span>
                        ) : <span className="text-[11px] text-slate-300">—</span>}
                      </Td>
                      <Td className="text-right">
                        <div className="flex items-center justify-end gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                          <Button data-testid="procedure-view" variant="ghost" size="sm"
                            className="h-7 w-7 p-0 rounded-xl hover:bg-slate-100 text-slate-400"
                            title="Ver detalle" onClick={() => openDetail(p)}>
                            <Eye size={13} />
                          </Button>
                          <Button data-testid="procedure-download-pdf" variant="ghost" size="sm"
                            className="h-7 w-7 p-0 rounded-xl hover:bg-blue-50 hover:text-blue-600 text-slate-400"
                            title="Descargar carátula" onClick={() => handleDownloadPDF(p)}>
                            <Download size={13} />
                          </Button>
                          {p.created_at && (Date.now() - new Date(p.created_at).getTime()) < 86400000 && (
                          <IfPerm any={[PERMS["mpv.processes.resolve"]]}>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm"
                                  className="h-7 w-7 p-0 rounded-xl hover:bg-red-50 hover:text-red-600 text-slate-400"
                                  title="Eliminar trámite (solo 24h)">
                                  <Trash2 size={13} />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="max-w-sm rounded-2xl">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Eliminar trámite</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Se eliminará permanentemente el trámite <strong>{p.tracking_code}</strong> de {p.applicant_name}. Esta acción no se puede deshacer.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="gap-2 mt-2">
                                  <AlertDialogCancel className="rounded-xl border-slate-200">Cancelar</AlertDialogCancel>
                                  <AlertDialogAction className="bg-red-600 hover:bg-red-700 rounded-xl" onClick={() => handleDeleteProcedure(p)}>
                                    Sí, eliminar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </IfPerm>
                          )}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/40 flex items-center justify-between">
            <p className="text-xs text-slate-400 font-semibold">
              {filtered.length} trámite{filtered.length !== 1 ? "s" : ""}
              {hasFilters && ` (filtrado de ${procedures.length})`}
            </p>
            {overdueCount > 0 && (
              <p className="text-xs font-bold text-red-500 flex items-center gap-1">
                <AlertTriangle size={11} /> {overdueCount} vencido{overdueCount !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[82vh] overflow-y-auto rounded-2xl p-0 border-0 shadow-2xl">
          <div className="bg-gradient-to-r from-[#1a2035] via-[#1e293b] to-[#252d3d] px-6 py-5 sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/10 border border-white/20 grid place-items-center shrink-0">
                <ClipboardList size={18} className="text-white" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300 mb-0.5">Nuevo Registro</p>
                <p className="font-extrabold text-white">Registrar Trámite Documentario</p>
              </div>
            </div>
          </div>
          <form onSubmit={onFormSubmit} className="bg-white p-6 space-y-4">
            <div>
              <FieldLabel required error={!!errors.procedure_type_id}>Tipo de Trámite</FieldLabel>
              <Select value={formData.procedure_type_id || undefined}
                onValueChange={v => handleField("procedure_type_id", v)}>
                <SelectTrigger className={`h-10 rounded-xl ${errors.procedure_type_id ? "border-red-400" : ""}`}>
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  {procedureTypes.filter(t => t.is_active).map(t =>
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <FieldError msg={errors.procedure_type_id} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel required error={!!errors.applicant_name}>Nombre del solicitante</FieldLabel>
                <Input className={`h-10 rounded-xl ${errors.applicant_name ? "border-red-400" : ""}`}
                  placeholder="Nombre completo" value={formData.applicant_name}
                  onChange={e => handleField("applicant_name", e.target.value)} />
                <FieldError msg={errors.applicant_name} />
              </div>
              <div>
                <FieldLabel required error={!!errors.applicant_document}>DNI</FieldLabel>
                <Input className={`h-10 rounded-xl font-mono ${errors.applicant_document ? "border-red-400" : ""}`}
                  placeholder="8 dígitos" maxLength={8} value={formData.applicant_document}
                  onChange={e => handleField("applicant_document", onlyDigits(e.target.value).slice(0, 8))} />
                <FieldError msg={errors.applicant_document} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel error={!!errors.applicant_email}>Correo electrónico</FieldLabel>
                <Input type="email" className={`h-10 rounded-xl ${errors.applicant_email ? "border-red-400" : ""}`}
                  placeholder="ejemplo@correo.com" value={formData.applicant_email}
                  onChange={e => handleField("applicant_email", e.target.value)} />
                <FieldError msg={errors.applicant_email} />
              </div>
              <div>
                <FieldLabel error={!!errors.applicant_phone}>Celular</FieldLabel>
                <Input className={`h-10 rounded-xl font-mono ${errors.applicant_phone ? "border-red-400" : ""}`}
                  placeholder="9 dígitos" maxLength={9} value={formData.applicant_phone}
                  onChange={e => handleField("applicant_phone", onlyDigits(e.target.value).slice(0, 9))} />
                <FieldError msg={errors.applicant_phone} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Nivel de urgencia</FieldLabel>
                <Select value={formData.urgency_level} onValueChange={v => handleField("urgency_level", v)}>
                  <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(URGENCY_MAP).map(([k, v]) =>
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <FieldLabel>Fecha límite (opcional)</FieldLabel>
                <Input type="date" className="h-10 rounded-xl text-sm"
                  value={formData.deadline_at || ""}
                  onChange={e => handleField("deadline_at", e.target.value)} />
              </div>
            </div>

            <div>
              <FieldLabel>Descripción / Asunto</FieldLabel>
              <Textarea className="rounded-xl resize-none" rows={2}
                placeholder="Detalles específicos del trámite"
                value={formData.description} onChange={e => handleField("description", e.target.value)} />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button type="button" variant="outline" className="rounded-xl font-semibold"
                onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
              <Button data-testid="procedure-create" type="submit"
                className="rounded-xl font-extrabold gap-2 bg-slate-800 hover:bg-slate-900">
                Crear trámite
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ProcedureDetailDialog open={detailOpen} onOpenChange={setDetailOpen}
        procedureId={detailId} onChanged={fetchProcedures} />
    </div>
  );
});
ProceduresManagement.displayName = "ProceduresManagement";

/* ════════════════════════════════════════════════════════════
   OFFICES — component
════════════════════════════════════════════════════════════ */

const OfficesSection = () => {
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(null);
  const [search, setSearch] = React.useState("");
  const [form, setForm] = React.useState({ name: "", description: "", is_active: true });

  const resetForm = () => { setForm({ name: "", description: "", is_active: true }); setEditing(null); };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await Offices.list();
      setRows(data?.items ?? data ?? []);
    } catch { toast.error("No se pudo cargar las oficinas"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    try {
      if (!form.name?.trim()) return toast.error("El nombre es requerido");
      if (editing) { await Offices.update(editing.id, form); toast.success("Oficina actualizada"); }
      else { await Offices.create(form); toast.success("Oficina creada"); }
      setOpen(false); resetForm(); load();
    } catch { toast.error("Error al guardar la oficina"); }
  };

  const remove = async (id) => {
    try { await Offices.remove(id); toast.success("Oficina eliminada"); load(); }
    catch { toast.error("No se pudo eliminar la oficina"); }
  };

  const toggleActive = async (r) => {
    try { await Offices.update(r.id, { ...r, is_active: !r.is_active }); load(); }
    catch { toast.error("No se pudo cambiar el estado"); }
  };

  const filtered = React.useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(r =>
      r.name?.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const active = rows.filter(r => r.is_active).length;
  const inactive = rows.length - active;

  const ROW_STYLE = { borderBottom: "1px solid #F1F5F9" };
  const TH = ({ children, center }) => (
    <th style={{
      padding: "10px 16px", fontSize: 10, fontWeight: 800, color: "#64748B",
      textTransform: "uppercase", letterSpacing: ".1em", background: "#F8FAFC",
      borderBottom: "1px solid #E2E8F0", textAlign: center ? "center" : "left",
    }}>{children}</th>
  );
  const TD = ({ children, center, style = {} }) => (
    <td style={{ padding: "11px 16px", fontSize: 13, color: "#334155", textAlign: center ? "center" : "left", ...style }}>
      {children}
    </td>
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Oficinas / Dependencias</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Destinos de derivación de trámites ·{" "}
              <span className="text-green-600 font-semibold">{active} activas</span>
              {inactive > 0 && <span className="text-slate-400"> · {inactive} inactivas</span>}
            </p>
          </div>
        </div>

        <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) resetForm(); }}>
          <button
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold shadow-sm transition-colors"
            onClick={() => { resetForm(); setOpen(true); }}
          >
            <Plus className="w-4 h-4" /> Nueva oficina
          </button>

          <DialogContent className="max-w-md rounded-2xl p-0 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-violet-500 to-purple-600" />
            <div className="p-6">
              <DialogHeader className="mb-5">
                <DialogTitle className="text-lg font-bold text-slate-800">
                  {editing ? "Editar oficina" : "Nueva oficina"}
                </DialogTitle>
                <p className="text-sm text-slate-500 mt-1">
                  Las oficinas activas aparecen en el formulario de derivación.
                </p>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Nombre *</Label>
                  <Input
                    className="h-9 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-sm"
                    placeholder="Ej: Dirección General, Secretaría Académica…"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Descripción / función</Label>
                  <Input
                    className="h-9 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-sm"
                    placeholder="Opcional — referencia interna"
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                  />
                </div>
                <div
                  className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => setForm({ ...form, is_active: !form.is_active })}
                >
                  <input type="checkbox" className="w-4 h-4 text-violet-600 rounded border-slate-300"
                    checked={!!form.is_active}
                    onChange={e => setForm({ ...form, is_active: e.target.checked })}
                    onClick={e => e.stopPropagation()} />
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Oficina activa</p>
                    <p className="text-xs text-slate-400">Solo las activas aparecen para derivar trámites</p>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <Button variant="outline" className="h-9 rounded-xl text-sm border-slate-200" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button className="h-9 px-6 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold shadow-sm" onClick={save}>
                    {editing ? "Guardar cambios" : "Crear oficina"}
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Body */}
      <div className="p-5">
        {/* Search */}
        <div className="mb-4 relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input className="h-9 pl-9 rounded-xl border-slate-200 bg-white text-sm"
            placeholder="Buscar oficina…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {/* Table */}
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <div style={{ maxHeight: 420, overflowY: "auto", scrollbarWidth: "thin" }}>
            <table className="w-full border-collapse">
              <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                <tr>
                  <TH>Oficina / Dependencia</TH>
                  <TH>Descripción</TH>
                  <TH center>Estado</TH>
                  <TH center>Acciones</TH>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
                      <p className="text-xs text-slate-400">Cargando oficinas…</p>
                    </div>
                  </td></tr>
                ) : filtered.map(r => (
                  <tr key={r.id} style={ROW_STYLE}
                    onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
                    onMouseLeave={e => e.currentTarget.style.background = ""}>
                    <TD>
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                          <Building2 className="w-3.5 h-3.5 text-violet-500" />
                        </div>
                        <span className="text-sm font-semibold text-slate-800">{r.name}</span>
                      </div>
                    </TD>
                    <TD>
                      {r.description
                        ? <span className="text-xs text-slate-500">{r.description}</span>
                        : <span className="text-xs text-slate-300 italic">—</span>}
                    </TD>
                    <TD center>
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold ${r.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                        {r.is_active ? "Activa" : "Inactiva"}
                      </span>
                    </TD>
                    <TD center>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          className={`h-7 px-3 text-xs font-bold rounded-lg transition-colors ${r.is_active ? "text-orange-600 hover:bg-orange-50" : "text-green-600 hover:bg-green-50"}`}
                          onClick={() => toggleActive(r)}
                        >
                          {r.is_active ? "Desactivar" : "Activar"}
                        </button>
                        <button
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                          onClick={() => { setEditing(r); setForm({ name: r.name || "", description: r.description || "", is_active: !!r.is_active }); setOpen(true); }}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="max-w-sm rounded-2xl">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                                <AlertCircle className="h-5 w-5" /> ¿Eliminar oficina?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Se eliminará permanentemente <strong>{r.name}</strong>. Los trámites ya derivados no se verán afectados.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="gap-2 mt-2">
                              <AlertDialogCancel className="rounded-xl border-slate-200">Cancelar</AlertDialogCancel>
                              <AlertDialogAction className="bg-red-600 hover:bg-red-700 rounded-xl" onClick={() => remove(r.id)}>
                                Sí, eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TD>
                  </tr>
                ))}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={4} className="py-12">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-slate-300" />
                      </div>
                      <p className="text-sm font-semibold text-slate-500">
                        {search ? "Sin resultados" : "No hay oficinas registradas"}
                      </p>
                      <p className="text-xs text-slate-400">
                        {search ? "Prueba con otro término" : "Crea una nueva con el botón superior"}
                      </p>
                    </div>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {!loading && rows.length > 0 && (
          <p className="text-[11px] text-slate-400 mt-3">
            {rows.length} oficinas registradas · {active} activas disponibles para derivación
          </p>
        )}
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════
   MAIN MODULE
════════════════════════════════════════════════════════════ */
const MesaDePartesModule = () => {
  const { user, hasAny } = useAuth();

  const tabs = [
    { key: "dashboard", label: "Dashboard", Icon: BarChart3, need: [PERMS["mpv.processes.review"], PERMS["mpv.reports.view"]] },
    { key: "types", label: "Tipos de Trámite", Icon: Settings2, need: [PERMS["mpv.processes.resolve"]] },
    { key: "procedures", label: "Trámites", Icon: ClipboardList, need: [PERMS["mpv.processes.review"]] },
    { key: "offices", label: "Oficinas", Icon: Building2, need: [PERMS["mpv.processes.resolve"]] },
    { key: "reports", label: "Reportes", Icon: BarChart3, need: [PERMS["mpv.reports.view"]] },
  ].filter(t => user ? hasAny(t.need) : false);

  const [activeTab, setActiveTab] = useState(tabs[0]?.key || "dashboard");
  const [procInitFilter, setProcFilter] = useState(null);
  const procRef = useRef(null);

  const handleQuickNew = () => { setActiveTab("procedures"); procRef.current?.openCreate?.(); };
  const handleQuickSearch = () => { setActiveTab("procedures"); procRef.current?.focusSearch?.(); };
  const handleShowOverdue = () => {
    setProcFilter("overdue");
    setActiveTab("procedures");
    setTimeout(() => procRef.current?.filterOverdue?.(), 100);
  };

  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyCode, setVerifyCode] = useState("");

  const confirmVerification = () => {
    if (!verifyCode.trim()) return;
    window.open(MesaPartesPublic.verifyUrl(verifyCode.trim()), "_blank", "noopener,noreferrer");
    setShowVerifyModal(false);
  };

  const currentTabLabel = tabs.find(t => t.key === activeTab)?.label ?? "Dashboard";

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-64 text-sm text-slate-400">
        Acceso no autorizado
      </div>
    );
  }

  const TabWrap = ({ children }) => (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">{children}</div>
  );

  return (
    <div className="w-full min-w-0 overflow-x-hidden p-4 sm:p-6 pb-16 space-y-5">

      {/* Module header */}
      <div className="rounded-2xl border border-slate-200/60 bg-white shadow-sm px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-slate-600 to-slate-900 grid place-items-center shadow-sm shrink-0">
            <FileText size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-slate-800 leading-tight">Mesa de Partes Digital</h1>
            <p className="text-xs text-slate-400 mt-0.5">Gestión de trámites documentarios</p>
          </div>
        </div>
        <span className="text-xs font-bold bg-slate-50 border border-slate-200 text-slate-500 px-3 py-1.5 rounded-xl self-start sm:self-auto">
          Documentario
        </span>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={v => { setActiveTab(v); if (v !== "procedures") setProcFilter(null); }}
        className="space-y-5">

        {/* Mobile dropdown */}
        <div className="sm:hidden">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-1.5">
            <p className="flex-1 text-xs font-bold text-slate-700 px-2 truncate">{currentTabLabel}</p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-slate-200 shrink-0">
                  <ChevronDown size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 rounded-xl">
                {tabs.map(({ key, label, Icon: TIcon }) => (
                  <DropdownMenuItem key={key} onClick={() => setActiveTab(key)}
                    className={`flex items-center gap-2 text-xs rounded-lg ${activeTab === key ? "bg-slate-100 font-bold" : ""}`}>
                    <TIcon size={13} /> {label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Desktop tab bar */}
        <div className="hidden sm:block">
          <TabsList className="inline-flex h-auto p-1.5 gap-1 bg-slate-50 border border-slate-200 rounded-xl shadow-sm">
            {tabs.map(({ key, label, Icon: TIcon }) => (
              <TabsTrigger key={key} value={key}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-white/70 transition-all border border-transparent whitespace-nowrap data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:font-bold data-[state=active]:shadow-sm">
                <TIcon size={13} /> {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {tabs.some(t => t.key === "dashboard") && (
          <TabsContent value="dashboard" className="mt-0 focus-visible:outline-none">
            <TabWrap>
              <MesaDePartesDashboardUI
                onNew={handleQuickNew} onSearch={handleQuickSearch}
                onQR={() => { setVerifyCode(""); setShowVerifyModal(true); }}
                onReports={() => setActiveTab("reports")}
                onShowOverdue={handleShowOverdue}
              />
            </TabWrap>
          </TabsContent>
        )}
        {tabs.some(t => t.key === "types") && (
          <TabsContent value="types" className="mt-0 focus-visible:outline-none">
            <TabWrap><ProcedureTypesManagement /></TabWrap>
          </TabsContent>
        )}
        {tabs.some(t => t.key === "procedures") && (
          <TabsContent value="procedures" className="mt-0 focus-visible:outline-none">
            <TabWrap>
              <ProceduresManagement ref={procRef} initialFilter={procInitFilter} />
            </TabWrap>
          </TabsContent>
        )}
        {tabs.some(t => t.key === "offices") && (
          <TabsContent value="offices" className="mt-0 focus-visible:outline-none">
            <TabWrap><OfficesSection /></TabWrap>
          </TabsContent>
        )}
        {tabs.some(t => t.key === "reports") && (
          <TabsContent value="reports" className="mt-0 focus-visible:outline-none">
            <TabWrap><MesaPartesReports /></TabWrap>
          </TabsContent>
        )}
      </Tabs>

      {/* QR Verify modal */}
      <Dialog open={showVerifyModal} onOpenChange={setShowVerifyModal}>
        <DialogContent className="sm:max-w-md rounded-2xl p-0 border-0 shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-[#1a2035] via-[#1e293b] to-[#252d3d] px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/10 border border-white/20 grid place-items-center shrink-0">
                <QrCode size={18} className="text-white" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300 mb-0.5">Verificación</p>
                <p className="font-extrabold text-white">Verificar Trámite</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 space-y-4">
            <p className="text-sm text-slate-500">Ingrese el código de seguimiento para validar el estado del documento.</p>
            <div>
              <FieldLabel>Código de seguimiento</FieldLabel>
              <Input className="h-10 rounded-xl font-mono border-slate-200"
                placeholder="Ej: MP-2024-XXXX" value={verifyCode}
                onChange={e => setVerifyCode(e.target.value)}
                onKeyDown={e => e.key === "Enter" && confirmVerification()}
                autoFocus />
            </div>
            <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
              <Button variant="outline" className="rounded-xl font-semibold"
                onClick={() => setShowVerifyModal(false)}>Cancelar</Button>
              <Button className="rounded-xl font-extrabold gap-2 bg-slate-800 hover:bg-slate-900"
                onClick={confirmVerification}>
                <ExternalLink size={14} /> Verificar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MesaDePartesModule;