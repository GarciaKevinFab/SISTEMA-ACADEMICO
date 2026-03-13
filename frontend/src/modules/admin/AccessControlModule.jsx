// src/modules/admin/AccessControlModule.jsx — UI/UX mejorado
import "../academic/styles.css";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { t } from "./aclTranslations";

import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "../../components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Separator } from "../../components/ui/separator";

import {
  Users, Shield, Plus, Edit, Edit3, Trash2, KeyRound, Search, RefreshCw,
  Check, AlertTriangle, AlertCircle, Database, ChevronLeft, ChevronRight,
  Loader2, Lock, UserCheck, UserX, Eye, ShieldCheck, ClipboardList,
} from "lucide-react";

import { UsersService } from "../../services/users.service";
import { ACLService } from "../../services/acl.service";
import { validatePassword } from "../../utils/passwordPolicy";
import AuditTab from "./AuditTab";
import { useAuth } from "../../context/AuthContext";
import { PERMS } from "../../auth/permissions";
import ConfigCatalogsModule from "./ConfigCatalogsModule";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
  AlertDialogCancel, AlertDialogAction,
} from "../../components/ui/alert-dialog";

const DeleteConfirm = ({ trigger, title, description, onConfirm }) => (
  <AlertDialog>
    <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
    <AlertDialogContent className="max-w-[92vw] sm:max-w-md rounded-2xl">
      <AlertDialogHeader>
        <AlertDialogTitle className="flex items-center gap-2 text-red-600">
          <AlertCircle className="h-5 w-5" />{title}
        </AlertDialogTitle>
        <AlertDialogDescription className="text-slate-600">{description}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter className="flex-col sm:flex-row gap-2 mt-4">
        <AlertDialogCancel className="w-full sm:w-auto rounded-xl border-slate-200">Cancelar</AlertDialogCancel>
        <AlertDialogAction className="w-full sm:w-auto bg-red-600 hover:bg-red-700 rounded-xl" onClick={onConfirm}>
          Sí, eliminar
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

/* ─────────────────────────── ESTILOS ─────────────────────────── */
const adminStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  .acl-module * { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }

  /* Header gradient border */
  .acl-header-card {
    background: linear-gradient(white, white) padding-box,
                linear-gradient(135deg, #3B82F6 0%, #8B5CF6 50%, #EC4899 100%) border-box;
    border: 1.5px solid transparent;
  }

  /* Tab active states */
  .acl-tab[data-state=active] { font-weight: 700; }
  .acl-tab-users[data-state=active]  { background: #1D4ED8; color: white; }
  .acl-tab-roles[data-state=active]  { background: #7C3AED; color: white; }
  .acl-tab-perms[data-state=active]  { background: #065F46; color: white; }
  .acl-tab-cats[data-state=active]   { background: #1E293B; color: white; }
  .acl-tab-audit[data-state=active]  { background: #92400E; color: white; }

  /* User row hover */
  .user-row { transition: background 0.12s; }
  .user-row:hover td { background: #F8FAFF; }

  /* Role badge */
  .role-badge {
    font-size: 10px; font-weight: 700; letter-spacing: 0.02em;
    padding: 2px 8px; border-radius: 20px; border-width: 1px;
  }

  /* Avatar colors */
  .avatar-blue   { background: #DBEAFE; color: #1D4ED8; }
  .avatar-violet { background: #EDE9FE; color: #6D28D9; }
  .avatar-green  { background: #D1FAE5; color: #065F46; }
  .avatar-amber  { background: #FEF3C7; color: #92400E; }

  /* Perm checkbox label */
  .perm-label { transition: all 0.12s; }
  .perm-label:hover { background: #F0FDF4; border-color: #6EE7B7; }
  .perm-label.checked { background: #ECFDF5; border-color: #34D399; }

  /* Purge danger zone */
  .danger-zone { border: 1.5px dashed #FCA5A5; background: #FFF5F5; border-radius: 12px; }

  /* Skeleton */
  @keyframes skel { 0%,100%{opacity:.4} 50%{opacity:.85} }
  .skel { animation: skel 1.4s ease-in-out infinite; background: #E2E8F0; border-radius: 6px; }

  /* Fade in */
  @keyframes fade-in { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:none} }
  .fade-in { animation: fade-in 0.25s ease both; }

  /* Bulk bar */
  .bulk-bar {
    border: 1.5px solid #BFDBFE;
    background: linear-gradient(135deg, #EFF6FF, #F5F3FF);
    border-radius: 12px;
  }
`;

function InjectAdminStyles() {
  useEffect(() => {
    const id = "acl-styles";
    if (document.getElementById(id)) return;
    const s = document.createElement("style");
    s.id = id; s.textContent = adminStyles;
    document.head.appendChild(s);
    return () => document.getElementById(id)?.remove();
  }, []);
  return null;
}

/* ─────────────────────────── UTILS ─────────────────────────── */
const useDebounce = (value, delay = 400) => {
  const [v, setV] = useState(value);
  useEffect(() => {
    const tt = setTimeout(() => setV(value), delay);
    return () => clearTimeout(tt);
  }, [value, delay]);
  return v;
};

const getInitials = (name = "") => {
  if (!name) return "?";
  const parts = name.trim().split(" ").filter(Boolean);
  if (!parts.length) return "?";
  return parts.length === 1
    ? parts[0][0].toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const AVATAR_COLORS = ["avatar-blue", "avatar-violet", "avatar-green", "avatar-amber"];
const avatarColor = (str = "") => {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};

const roleBadgeStyle = (role) => {
  const r = (role || "").toUpperCase();
  if (r.includes("ADMIN_SYSTEM")) return "bg-indigo-50 text-indigo-700 border-indigo-200";
  if (r.includes("ADMIN")) return "bg-blue-50 text-blue-700 border-blue-200";
  if (r.includes("REGISTRAR")) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (r.includes("TEACHER")) return "bg-amber-50 text-amber-700 border-amber-200";
  if (r.includes("STUDENT")) return "bg-slate-100 text-slate-600 border-slate-200";
  return "bg-gray-50 text-gray-600 border-gray-200";
};

/* ─────────────────────────── COMPONENTES PEQUEÑOS ─────────────────────────── */

function SearchInput({ value, onChange, placeholder = "Buscar..." }) {
  return (
    <div className="relative flex-1 min-w-[220px]">
      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-8 h-9 text-sm rounded-lg border-slate-200 focus:border-blue-400"
        aria-label="Buscar"
      />
    </div>
  );
}

function StatChip({ value, label, color }) {
  const colors = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    green: "bg-emerald-50 text-emerald-700 border-emerald-100",
    slate: "bg-slate-50 text-slate-600 border-slate-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    red: "bg-red-50 text-red-700 border-red-100",
  };
  return (
    <div className={`px-3 py-1.5 rounded-lg border text-xs font-600 ${colors[color] || colors.slate}`}>
      <span className="font-800 text-sm">{value}</span> {label}
    </div>
  );
}

function SectionHeader({ title, description, Icon, accent = "blue" }) {
  const iconBg = {
    blue: "bg-blue-50 text-blue-700",
    violet: "bg-violet-50 text-violet-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    slate: "bg-slate-50 text-slate-700",
  };
  return (
    <div className="flex items-start gap-3">
      {Icon && (
        <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${iconBg[accent] || iconBg.blue}`}>
          <Icon size={17} />
        </div>
      )}
      <div>
        <CardTitle className="text-[15px] font-700 text-slate-800 leading-tight">{title}</CardTitle>
        {description && <CardDescription className="text-xs mt-0.5">{description}</CardDescription>}
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, description, colSpan = 6 }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-12">
        <div className="flex flex-col items-center gap-2.5 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center">
            <Icon size={20} className="text-slate-400" />
          </div>
          <p className="text-sm font-600 text-slate-600">{title}</p>
          {description && <p className="text-xs text-slate-400">{description}</p>}
        </div>
      </td>
    </tr>
  );
}

function TableSkeleton({ cols = 6, rows = 8 }) {
  return Array.from({ length: rows }).map((_, i) => (
    <tr key={`sk-${i}`} className="border-t border-slate-50">
      {Array.from({ length: cols }).map((_, j) => (
        <td key={j} className="p-3">
          <div className="skel h-4" style={{ width: `${60 + (j * 17 + i * 11) % 35}%` }} />
        </td>
      ))}
    </tr>
  ));
}

function PasswordHints({ feedback }) {
  if (!feedback) return null;
  if (feedback.valid) {
    return (
      <p className="mt-1 text-[11px] text-emerald-600 flex items-center gap-1">
        <Check size={10} /> Contraseña válida
      </p>
    );
  }
  return (
    <ul className="mt-1 space-y-0.5">
      {feedback.errors.map((er, i) => (
        <li key={i} className="text-[11px] text-red-600 flex items-start gap-1">
          <span className="mt-0.5 shrink-0">·</span>{er}
        </li>
      ))}
    </ul>
  );
}

function ConfirmDialog({ open, onOpenChange, title, description, confirmText = "Confirmar", onConfirm, confirmVariant = "default" }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl bg-white border border-slate-100 shadow-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-700">
            <AlertTriangle size={17} className="text-amber-500 shrink-0" /> {title}
          </DialogTitle>
          {description && <DialogDescription className="text-xs">{description}</DialogDescription>}
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" className="rounded-lg h-8 text-xs" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant={confirmVariant} size="sm" className="rounded-lg h-8 text-xs" onClick={onConfirm}>
            {confirmText}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Dialog asignación masiva de roles ── */
function BulkRoleDialog({ open, onClose, rolesOptions, selectedCount, onApply, loading }) {
  const [selectedRoles, setSelectedRoles] = React.useState([]);
  const [mode, setMode] = React.useState("add"); // add | replace

  React.useEffect(() => {
    if (open) { setSelectedRoles([]); setMode("add"); }
  }, [open]);

  const toggleRole = (r) => {
    setSelectedRoles((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md rounded-2xl bg-white border border-slate-100 shadow-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-700">
            <Shield size={17} className="text-blue-600 shrink-0" /> Asignar roles
          </DialogTitle>
          <DialogDescription className="text-xs">
            Asigna roles a {selectedCount} usuario(s) seleccionado(s)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Modo */}
          <div className="flex gap-2">
            <button
              className={`flex-1 text-xs font-600 px-3 py-2 rounded-lg border transition-all ${
                mode === "add" ? "bg-blue-50 border-blue-200 text-blue-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
              onClick={() => setMode("add")}
            >
              Agregar rol(es)
              <p className="text-[10px] font-400 mt-0.5">Mantiene los roles actuales y agrega los seleccionados</p>
            </button>
            <button
              className={`flex-1 text-xs font-600 px-3 py-2 rounded-lg border transition-all ${
                mode === "replace" ? "bg-amber-50 border-amber-200 text-amber-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
              onClick={() => setMode("replace")}
            >
              Reemplazar roles
              <p className="text-[10px] font-400 mt-0.5">Quita los roles actuales y asigna solo los seleccionados</p>
            </button>
          </div>

          {/* Roles */}
          <div className="grid grid-cols-2 gap-1.5 max-h-[200px] overflow-y-auto">
            {rolesOptions.map((r) => {
              const checked = selectedRoles.includes(r);
              return (
                <label
                  key={r}
                  className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-all text-xs
                    ${checked ? "bg-blue-50 border-blue-200" : "border-slate-100 hover:border-slate-200 hover:bg-slate-50"}`}
                >
                  <input type="checkbox" checked={checked} onChange={() => toggleRole(r)} className="mt-0.5 accent-blue-600" />
                  <div>
                    <p className="font-600 text-slate-700 leading-tight">{t(r)}</p>
                    <p className="font-mono text-[10px] text-slate-400 mt-0.5">{r}</p>
                  </div>
                </label>
              );
            })}
          </div>

          {selectedRoles.length === 0 && (
            <p className="text-xs text-slate-400 text-center">Selecciona al menos un rol</p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" className="rounded-lg h-8 text-xs" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size="sm" className="rounded-lg h-8 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
            disabled={selectedRoles.length === 0 || loading}
            onClick={() => onApply(selectedRoles, mode)}
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            Aplicar a {selectedCount} usuario(s)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────── ROOT ─────────────────────────── */
const AccessControlModule = () => {
  const { hasPerm } = useAuth();
  const canManage = hasPerm(PERMS["admin.access.manage"]);
  const canAudit = hasPerm(PERMS["admin.audit.view"]);
  const catalogsPerm = PERMS["admin.catalogs.view"] ?? PERMS["admin.access.manage"];
  const canCatalogs = hasPerm(catalogsPerm);
  const defaultTab = canManage ? "users" : canCatalogs ? "catalogs" : canAudit ? "audit" : "users";

  const tabs = [
    canManage && { key: "users", label: "Usuarios", Icon: Users, cls: "acl-tab-users" },
    canManage && { key: "roles", label: "Roles", Icon: Shield, cls: "acl-tab-roles" },
    canManage && { key: "permissions", label: "Permisos", Icon: KeyRound, cls: "acl-tab-perms" },
    canCatalogs && { key: "catalogs", label: "Catálogos", Icon: Database, cls: "acl-tab-cats" },
    canAudit && { key: "audit", label: "Auditoría", Icon: ClipboardList, cls: "acl-tab-audit" },
  ].filter(Boolean);

  return (
    <>
      <InjectAdminStyles />
      <div className="acl-module h-full overflow-y-auto p-4 md:p-6 pb-16 space-y-5">

        {/* Header */}
        <div className="acl-header-card rounded-2xl bg-white shadow-sm px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center shadow-sm">
              <ShieldCheck size={19} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-800 text-slate-800 leading-tight">Administración</h1>
              <p className="text-xs text-slate-400 mt-0.5">Control de acceso, roles y permisos del sistema</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg">
            <Database size={12} /> Configuración central
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue={defaultTab} className="space-y-5">
          <div className="overflow-x-auto">
            <TabsList className="inline-flex h-auto p-1.5 gap-1 bg-slate-50 border border-slate-200 rounded-xl shadow-sm">
              {tabs.map(({ key, label, Icon, cls }) => (
                <TabsTrigger
                  key={key}
                  value={key}
                  className={`acl-tab ${cls} flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-600 text-slate-500
                             hover:text-slate-800 hover:bg-white transition-all whitespace-nowrap`}
                >
                  <Icon size={13} />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {canManage && (
            <TabsContent value="users" className="fade-in"><UsersTab /></TabsContent>
          )}
          {canManage && (
            <TabsContent value="roles" className="fade-in"><RolesTab /></TabsContent>
          )}
          {canManage && (
            <TabsContent value="permissions" className="fade-in"><PermissionsTab /></TabsContent>
          )}
          {canCatalogs && (
            <TabsContent value="catalogs" className="fade-in"><ConfigCatalogsModule /></TabsContent>
          )}
          {canAudit && (
            <TabsContent value="audit" className="fade-in"><AuditTab /></TabsContent>
          )}
        </Tabs>
      </div>
    </>
  );
};

/* ═══════════════════════════ USUARIOS TAB ═══════════════════════════ */
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const UsersTab = () => {
  const [pageSize, setPageSize] = useState(10);

  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 450);

  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);

  const [confirm, setConfirm] = useState({
    open: false, action: null, id: null,
    title: "¿Estás seguro?", description: "", confirmText: "Sí, continuar", confirmVariant: "destructive",
  });

  const [rolesOptions, setRolesOptions] = useState([]);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ full_name: "", email: "", roles: [] });
  const [pwdForm, setPwdForm] = useState({ new_password: "", confirm_password: "" });
  const [pwdErrors, setPwdErrors] = useState({});
  const [pwdSaving, setPwdSaving] = useState(false);
  const pwdFeedbackEdit = validatePassword(pwdForm.new_password || "");

  const [form, setForm] = useState({ full_name: "", email: "", username: "", password: "", roles: [] });
  const pwdFeedback = validatePassword(form.password || "");

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [purgeMode, setPurgeMode] = useState("ids");
  const [purgeRole, setPurgeRole] = useState("STUDENT");
  const [purgeLoading, setPurgeLoading] = useState(false);
  const [purgeDryRun, setPurgeDryRun] = useState(null);
  const [purgeText, setPurgeText] = useState("");

  // Bulk role assignment
  const [bulkRoleOpen, setBulkRoleOpen] = useState(false);
  const [bulkRoleLoading, setBulkRoleLoading] = useState(false);

  const handleBulkRoleAssign = async (roles, mode) => {
    if (selectedIds.size === 0 || roles.length === 0) return;
    setBulkRoleLoading(true);
    let success = 0;
    let errors = 0;
    for (const userId of selectedIds) {
      try {
        if (mode === "replace") {
          // Reemplazar: asignar exactamente estos roles
          await UsersService.assignRoles(userId, roles);
        } else {
          // Agregar: obtener roles actuales + agregar nuevos
          const user = list.find((u) => u.id === userId);
          const currentRoles = Array.isArray(user?.roles) ? user.roles : [];
          const merged = Array.from(new Set([...currentRoles, ...roles]));
          await UsersService.assignRoles(userId, merged);
        }
        success++;
      } catch {
        errors++;
      }
    }
    setBulkRoleLoading(false);
    setBulkRoleOpen(false);
    if (success > 0) toast.success(`Roles asignados a ${success} usuario(s)`);
    if (errors > 0) toast.error(`Error en ${errors} usuario(s)`);
    clearSelection();
    fetchUsers();
  };

  const normalizeUsers = (data) => {
    if (Array.isArray(data)) return { items: data, count: data.length };
    if (Array.isArray(data?.users)) return { items: data.users, count: data.count ?? data.users.length };
    if (Array.isArray(data?.results)) return { items: data.results, count: data.count ?? data.results.length };
    if (Array.isArray(data?.data)) return { items: data.data, count: data.count ?? data.data.length };
    return { items: [], count: 0 };
  };

  useEffect(() => setPage(1), [debouncedQ]);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await UsersService.list({ page, page_size: pageSize, ...(debouncedQ ? { q: debouncedQ } : {}) });
      const norm = normalizeUsers(data);
      setList(norm.items); setCount(norm.count);
    } catch {
      toast.error("Error al cargar usuarios"); setList([]); setCount(0);
    } finally { setLoading(false); }
  }, [debouncedQ, page, pageSize]);

  const fetchRoles = useCallback(async () => {
    try {
      const data = await ACLService.listRoles();
      const raw = data?.roles ?? data ?? [];
      setRolesOptions(raw.map((r) => (typeof r === "string" ? r : r?.name)).filter(Boolean));
    } catch { setRolesOptions([]); }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { fetchRoles(); }, [fetchRoles]);
  useEffect(() => { setSelectedIds(new Set()); }, [debouncedQ, page]);

  const resetCreate = () => setForm({ full_name: "", email: "", username: "", password: "", roles: [] });

  const toggleRole = (roleName, currentRoles, setter) => {
    const set = new Set(currentRoles);
    set.has(roleName) ? set.delete(roleName) : set.add(roleName);
    setter(Array.from(set));
  };

  const allSelectedOnPage = list.length > 0 && list.every((u) => selectedIds.has(u.id));
  const toggleSelected = (id) => setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAllPage = () => setSelectedIds((prev) => { const n = new Set(prev); list.forEach((u) => n.add(u.id)); return n; });
  const clearSelection = () => setSelectedIds(new Set());

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!pwdFeedback?.valid) { toast.error("La contraseña no cumple la política."); return; }
    try {
      await UsersService.create(form);
      toast.success("Usuario creado exitosamente");
      setOpenCreate(false); resetCreate(); setPage(1);
    } catch (e2) { toast.error(e2?.response?.data?.detail || "Error al crear usuario"); }
  };

  const handleDeactivate = async (id) => {
    try { await UsersService.deactivate(id); toast.success("Usuario desactivado"); fetchUsers(); }
    catch { toast.error("No se pudo desactivar"); }
  };

  const handleResetPass = async (id) => {
    try {
      const res = await UsersService.resetPassword(id);
      toast.success("Contraseña reiniciada");
      if (res?.temporary_password) toast.message(`Contraseña temporal: ${res.temporary_password}`);
    } catch { toast.error("No se pudo reiniciar la contraseña"); }
  };

  const handleActivate = async (id) => {
    try { await UsersService.activate(id); toast.success("Usuario reactivado"); fetchUsers(); }
    catch { toast.error("No se pudo reactivar"); }
  };

  const handleDelete = async (id) => {
    try {
      await UsersService.delete(id);
      toast.success("Usuario eliminado");
      if (list.length === 1 && page > 1) setPage((p) => p - 1);
      else fetchUsers();
    } catch (e2) {
      const d = e2?.response?.data;
      toast.error(d?.hint ? `${d?.detail} ${d.hint}` : d?.detail || "No se pudo eliminar");
    }
  };

  const openEditUser = (u) => {
    setEditing(u);
    setEditForm({ full_name: u.full_name || "", email: u.email || "", roles: Array.isArray(u.roles) ? u.roles : [] });
    setPwdForm({ new_password: "", confirm_password: "" });
    setPwdErrors({}); setPwdSaving(false);
    setOpenEdit(true);
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    if (!editing) return;
    try {
      await UsersService.update(editing.id, { full_name: editForm.full_name, email: editForm.email });
      await UsersService.assignRoles(editing.id, editForm.roles);
      toast.success("Usuario actualizado");
      setOpenEdit(false); setEditing(null); fetchUsers();
    } catch { toast.error("No se pudo actualizar"); }
  };

  const submitAdminPassword = async (e) => {
    e.preventDefault();
    if (!editing?.id) return;
    const errs = {};
    if (!pwdForm.new_password?.trim()) errs.new_password = "Obligatorio.";
    if (!pwdForm.confirm_password?.trim()) errs.confirm_password = "Obligatorio.";
    if (pwdForm.new_password && pwdForm.confirm_password && pwdForm.new_password !== pwdForm.confirm_password)
      errs.confirm_password = "Las contraseñas no coinciden.";
    if (pwdFeedbackEdit && !pwdFeedbackEdit.valid)
      errs.new_password = "No cumple la política de seguridad.";
    if (Object.keys(errs).length) { setPwdErrors(errs); toast.error("Revisa la contraseña."); return; }

    try {
      setPwdSaving(true);
      await UsersService.setPassword(editing.id, { new_password: pwdForm.new_password, confirm_password: pwdForm.confirm_password });
      toast.success("Contraseña actualizada. Se forzará cambio al iniciar sesión.");
      setPwdForm({ new_password: "", confirm_password: "" }); setPwdErrors({});
    } catch (err) {
      const data = err?.response?.data;
      if (data?.errors && typeof data.errors === "object") {
        const norm = {};
        for (const k of Object.keys(data.errors)) {
          const v = data.errors[k];
          norm[k] = Array.isArray(v) ? v.join(" ") : String(v);
        }
        setPwdErrors(norm);
      }
      toast.error(data?.detail || "No se pudo cambiar la contraseña.");
    } finally { setPwdSaving(false); }
  };

  const onConfirmAction = async () => {
    if (!confirm.action || !confirm.id) return;
    await confirm.action(confirm.id);
    setConfirm((s) => ({ ...s, open: false }));
  };

  const totalPages = useMemo(() => Math.max(1, Math.ceil((count || 0) / pageSize)), [count, pageSize]);
  const canPrev = page > 1;
  const canNext = page < totalPages;
  const from = count === 0 ? 0 : pageSize * (page - 1) + 1;
  const to = Math.min(pageSize * page, count);

  const activosPage = list.filter((u) => u.is_active).length;
  const inactivosPage = list.length - activosPage;

  const runPurgePreview = async () => {
    try {
      setPurgeLoading(true);
      const payload = purgeMode === "role"
        ? { mode: "role", role: purgeRole, dry_run: true }
        : { mode: "ids", user_ids: Array.from(selectedIds), dry_run: true };
      setPurgeDryRun(await UsersService.purge(payload));
    } catch (e) {
      toast.error(e?.response?.data?.detail || "No se pudo generar la vista previa."); setPurgeDryRun(null);
    } finally { setPurgeLoading(false); }
  };

  const runPurgeExecute = async () => {
    if (purgeText.trim().toUpperCase() !== "ELIMINAR") {
      toast.error('Escribe "ELIMINAR" para confirmar.'); return;
    }
    try {
      setPurgeLoading(true);
      const payload = purgeMode === "role"
        ? { mode: "role", role: purgeRole, dry_run: false }
        : { mode: "ids", user_ids: Array.from(selectedIds), dry_run: false };
      const res = await UsersService.purge(payload);
      toast.success(res?.message || "Purge ejecutado.");
      setPurgeOpen(false); setPurgeText(""); setPurgeDryRun(null); clearSelection();
      setPage(1); fetchUsers();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "No se pudo ejecutar el purge.");
    } finally { setPurgeLoading(false); }
  };

  // ─── Render ───
  return (
    <Card className="rounded-2xl border border-slate-100 shadow-sm bg-white">
      {/* Header */}
      <CardHeader className="pb-4 border-b border-slate-50">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <SectionHeader title="Usuarios" description="Alta, edición, roles y baja de cuentas" Icon={Users} accent="blue" />
          <div className="flex flex-wrap gap-2">
            <StatChip value={count} label="total" color="blue" />
            <StatChip value={activosPage} label="activos" color="green" />
            <StatChip value={inactivosPage} label="inactivos" color="slate" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center bg-slate-50 border border-slate-100 rounded-xl p-2">
          <SearchInput value={q} onChange={setQ} placeholder="Nombre, usuario o email..." />
          <div className="flex gap-2 flex-wrap justify-end">
            <Button
              variant="outline" size="sm"
              className="h-9 text-xs gap-1.5 rounded-lg border-slate-200"
              onClick={() => { setPage(1); fetchUsers(); }}
            >
              <RefreshCw size={12} /> Actualizar
            </Button>

            <Button
              variant="outline" size="sm"
              className="h-9 text-xs gap-1.5 rounded-lg border-slate-200 disabled:opacity-40"
              disabled={selectedIds.size === 0}
              onClick={() => { setPurgeMode("ids"); setPurgeDryRun(null); setPurgeText(""); setPurgeOpen(true); }}
            >
              <Trash2 size={12} /> Eliminar ({selectedIds.size})
            </Button>

            <Button
              variant="outline" size="sm"
              className="h-9 text-xs gap-1.5 rounded-lg border-red-200 text-red-600 hover:bg-red-50"
              onClick={() => { setPurgeMode("role"); setPurgeRole("STUDENT"); setPurgeDryRun(null); setPurgeText(""); setPurgeOpen(true); }}
            >
              <AlertTriangle size={12} /> Purge estudiantes
            </Button>

            {/* Crear usuario */}
            <Dialog open={openCreate} onOpenChange={setOpenCreate}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-9 text-xs gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white">
                  <Plus size={13} /> Nuevo usuario
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-lg h-[90vh] overflow-hidden p-0 rounded-2xl flex flex-col border border-slate-100 bg-white">
                <div className="px-6 pt-5 pb-3 border-b flex-none">
                  <DialogHeader>
                    <DialogTitle className="text-base font-700">Crear usuario</DialogTitle>
                    <DialogDescription className="text-xs">Completa los datos básicos de la cuenta</DialogDescription>
                  </DialogHeader>
                </div>
                <div className="px-6 py-4 flex-1 overflow-y-auto">
                  <form onSubmit={handleCreate} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-600">Nombre completo *</Label>
                      <Input className="h-9 text-sm rounded-lg" value={form.full_name}
                        onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-600">Usuario *</Label>
                        <Input className="h-9 text-sm rounded-lg font-mono" value={form.username}
                          onChange={(e) => setForm({ ...form, username: e.target.value })} required />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-600">Email *</Label>
                        <Input type="email" className="h-9 text-sm rounded-lg" value={form.email}
                          onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-600">Contraseña *</Label>
                      <Input type="password" className="h-9 text-sm rounded-lg" value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })} required />
                      <PasswordHints feedback={pwdFeedback} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-600">Roles</Label>
                      <RoleCheckboxGrid
                        options={rolesOptions} selected={form.roles}
                        onChange={(newRoles) => setForm({ ...form, roles: newRoles })}
                      />
                    </div>
                    <div className="pt-3 border-t flex justify-end gap-2 sticky bottom-0 bg-white pb-1">
                      <Button type="button" variant="outline" size="sm" className="h-8 text-xs rounded-lg" onClick={() => setOpenCreate(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit" size="sm" className="h-8 text-xs gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white">
                        <Check size={12} /> Crear usuario
                      </Button>
                    </div>
                  </form>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Bulk bar */}
        {selectedIds.size > 0 && (
          <div className="bulk-bar px-4 py-2.5 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between fade-in">
            <p className="text-xs text-blue-700 font-600">
              {selectedIds.size} usuario(s) seleccionado(s)
              <span className="font-400 text-blue-500 ml-1.5">(se reinicia al cambiar página)</span>
            </p>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-md" onClick={selectAllPage}>
                Seleccionar página
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-md" onClick={clearSelection}>
                Limpiar
              </Button>
              <Button
                size="sm"
                className="h-7 text-[11px] rounded-md gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => setBulkRoleOpen(true)}
              >
                <Shield size={11} /> Asignar rol
              </Button>
              <Button
                variant="destructive" size="sm"
                className="h-7 text-[11px] rounded-md gap-1"
                onClick={() => { setPurgeMode("ids"); setPurgeDryRun(null); setPurgeText(""); setPurgeOpen(true); }}
              >
                <Trash2 size={11} /> Purge selección
              </Button>
            </div>
          </div>
        )}

        {/* Tabla */}
        <div className="border border-slate-100 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2.5 w-10">
                    <input
                      type="checkbox" checked={allSelectedOnPage}
                      onChange={(e) => e.target.checked ? selectAllPage() : clearSelection()}
                      className="accent-blue-600"
                    />
                  </th>
                  {["Usuario", "Email", "Roles", "Estado", "Acciones"].map((h, i) => (
                    <th key={h} className={`px-3 py-2.5 text-[10px] font-700 uppercase tracking-wide text-slate-500 ${i === 4 ? "text-right" : "text-left"}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 bg-white">
                {loading && <TableSkeleton cols={6} rows={8} />}

                {!loading && list.length === 0 && (
                  <EmptyState icon={Users} title="Sin resultados" description="Intenta con otro término de búsqueda" colSpan={6} />
                )}

                {!loading && list.map((u) => (
                  <tr key={u.id} className="user-row">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox" checked={selectedIds.has(u.id)}
                        onChange={() => toggleSelected(u.id)}
                        className="accent-blue-600"
                      />
                    </td>

                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-800 shrink-0 ${avatarColor(u.full_name || u.username)}`}>
                          {getInitials(u.full_name || u.username)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-600 text-slate-800 truncate">{u.full_name || u.username}</p>
                          <p className="text-[11px] text-slate-400 font-mono">@{u.username}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-3 py-3">
                      <span className="text-xs text-slate-600 truncate block max-w-[160px]">{u.email}</span>
                    </td>

                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(u.roles || []).length === 0
                          ? <span className="text-xs text-slate-400">—</span>
                          : (u.roles || []).map((r) => (
                            <span key={r} className={`role-badge border ${roleBadgeStyle(r)}`}>{r}</span>
                          ))
                        }
                      </div>
                    </td>

                    <td className="px-3 py-3">
                      {u.is_active ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-700 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-700 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Inactivo
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1.5 flex-wrap">
                        <ActionBtn icon={<KeyRound size={11} />} label="Reset" onClick={() => handleResetPass(u.id)} />
                        <ActionBtn icon={<Edit size={11} />} label="Editar" onClick={() => openEditUser(u)} />

                        {u.is_active ? (
                          <ActionBtn
                            icon={<UserX size={11} />} label="Baja"
                            onClick={() => setConfirm({
                              open: true, action: handleDeactivate, id: u.id,
                              title: "Dar de baja",
                              description: "El usuario no podrá iniciar sesión.",
                              confirmText: "Dar de baja", confirmVariant: "destructive",
                            })}
                          />
                        ) : (
                          <ActionBtn
                            icon={<UserCheck size={11} />} label="Activar"
                            onClick={() => setConfirm({
                              open: true, action: handleActivate, id: u.id,
                              title: "Reactivar usuario",
                              description: "El usuario podrá iniciar sesión.",
                              confirmText: "Reactivar", confirmVariant: "default",
                            })}
                          />
                        )}

                        <button
                          className="text-[11px] font-600 text-red-500 hover:text-white hover:bg-red-500 px-2 py-1 rounded-md border border-red-200 hover:border-red-500 transition-all"
                          onClick={() => setConfirm({
                            open: true, action: handleDelete, id: u.id,
                            title: "Eliminar definitivamente",
                            description: "Esta acción es irreversible.",
                            confirmText: "Eliminar", confirmVariant: "destructive",
                          })}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Paginación */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-3">
            <p className="text-xs text-slate-400">
              Mostrando <span className="font-700 text-slate-600">{from}–{to}</span> de <span className="font-700 text-slate-600">{count}</span> usuarios
            </p>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400">|</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="h-7 text-xs border border-slate-200 rounded-md px-1.5 bg-white text-slate-600 cursor-pointer hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {PAGE_SIZE_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s} por página</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1 rounded-lg"
              onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={!canPrev || loading}>
              <ChevronLeft size={13} /> Anterior
            </Button>
            <span className="text-xs font-600 text-slate-600 px-1">
              {page} / {totalPages}
            </span>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1 rounded-lg"
              onClick={() => setPage((p) => p + 1)} disabled={!canNext || loading}>
              Siguiente <ChevronRight size={13} />
            </Button>
          </div>
        </div>

        {/* Dialogs */}
        <PurgeDialog
          open={purgeOpen} onClose={() => { setPurgeOpen(false); setPurgeText(""); setPurgeDryRun(null); }}
          purgeMode={purgeMode} purgeRole={purgeRole} selectedCount={selectedIds.size}
          purgeDryRun={purgeDryRun} purgeText={purgeText} setPurgeText={setPurgeText}
          purgeLoading={purgeLoading}
          onPreview={runPurgePreview} onExecute={runPurgeExecute}
        />

        <EditUserDialog
          open={openEdit}
          onClose={() => { setOpenEdit(false); setEditing(null); setPwdForm({ new_password: "", confirm_password: "" }); setPwdErrors({}); }}
          editing={editing} editForm={editForm} setEditForm={setEditForm}
          rolesOptions={rolesOptions} toggleRole={toggleRole}
          onSubmit={submitEdit}
          pwdForm={pwdForm} setPwdForm={setPwdForm}
          pwdErrors={pwdErrors} setPwdErrors={setPwdErrors}
          pwdFeedbackEdit={pwdFeedbackEdit}
          pwdSaving={pwdSaving} onSubmitPwd={submitAdminPassword}
        />

        <ConfirmDialog
          open={confirm.open} onOpenChange={(open) => setConfirm((s) => ({ ...s, open }))}
          title={confirm.title} description={confirm.description}
          confirmText={confirm.confirmText} confirmVariant={confirm.confirmVariant}
          onConfirm={onConfirmAction}
        />

        <BulkRoleDialog
          open={bulkRoleOpen}
          onClose={() => setBulkRoleOpen(false)}
          rolesOptions={rolesOptions}
          selectedCount={selectedIds.size}
          onApply={handleBulkRoleAssign}
          loading={bulkRoleLoading}
        />
      </CardContent>
    </Card>
  );
};

/* ── Botón acción fila ── */
function ActionBtn({ icon, label, onClick }) {
  return (
    <button
      className="inline-flex items-center gap-1 text-[11px] font-600 text-slate-600 hover:text-blue-700 px-2 py-1 rounded-md border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all"
      onClick={onClick}
    >
      {icon} {label}
    </button>
  );
}

/* ── Grid de roles con checkboxes ── */
function RoleCheckboxGrid({ options, selected, onChange }) {
  const toggleRole = (r) => {
    const s = new Set(selected);
    s.has(r) ? s.delete(r) : s.add(r);
    onChange(Array.from(s));
  };
  if (options.length === 0)
    return <p className="text-xs text-slate-400">No hay roles disponibles.</p>;
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {options.map((r) => {
        const checked = selected.includes(r);
        return (
          <label
            key={r}
            className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-all text-xs
              ${checked ? "bg-blue-50 border-blue-200" : "border-slate-100 hover:border-slate-200 hover:bg-slate-50"}`}
          >
            <input type="checkbox" checked={checked} onChange={() => toggleRole(r)} className="mt-0.5 accent-blue-600" />
            <div>
              <p className="font-600 text-slate-700 leading-tight">{t(r)}</p>
              <p className="font-mono text-[10px] text-slate-400 mt-0.5">{r}</p>
            </div>
          </label>
        );
      })}
    </div>
  );
}

/* ── Dialog Editar Usuario ── */
function EditUserDialog({ open, onClose, editing, editForm, setEditForm, rolesOptions, toggleRole, onSubmit, pwdForm, setPwdForm, pwdErrors, setPwdErrors, pwdFeedbackEdit, pwdSaving, onSubmitPwd }) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl rounded-2xl bg-white border border-slate-100 overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-base font-700">Editar usuario</DialogTitle>
          <DialogDescription className="text-xs">Actualiza datos, roles y seguridad de la cuenta</DialogDescription>
        </DialogHeader>

        {/* Datos generales */}
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-600">Nombre completo *</Label>
            <Input className="h-9 text-sm rounded-lg" value={editForm.full_name}
              onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} required />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-600">Email *</Label>
            <Input type="email" className="h-9 text-sm rounded-lg" value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-600">Roles</Label>
            <RoleCheckboxGrid
              options={rolesOptions} selected={editForm.roles}
              onChange={(newRoles) => setEditForm({ ...editForm, roles: newRoles })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs rounded-lg" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" className="h-8 text-xs gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white">
              <Check size={12} /> Guardar cambios
            </Button>
          </div>
        </form>

        <Separator className="bg-slate-100" />

        {/* Seguridad / contraseña */}
        <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
              <Lock size={13} className="text-amber-700" />
            </div>
            <div>
              <p className="text-xs font-700 text-slate-700">Establecer contraseña</p>
              <p className="text-[11px] text-slate-400">Obliga cambio al siguiente inicio de sesión</p>
            </div>
          </div>

          <form onSubmit={onSubmitPwd} className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-600">Nueva contraseña</Label>
              <Input type="password" className="h-9 text-sm rounded-lg" value={pwdForm.new_password}
                onChange={(e) => { setPwdForm((s) => ({ ...s, new_password: e.target.value })); setPwdErrors((s) => ({ ...s, new_password: undefined })); }} />
              <PasswordHints feedback={pwdFeedbackEdit} />
              {pwdErrors.new_password && <p className="text-[11px] text-red-600">{pwdErrors.new_password}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-600">Confirmar contraseña</Label>
              <Input type="password" className="h-9 text-sm rounded-lg" value={pwdForm.confirm_password}
                onChange={(e) => { setPwdForm((s) => ({ ...s, confirm_password: e.target.value })); setPwdErrors((s) => ({ ...s, confirm_password: undefined })); }} />
              {pwdErrors.confirm_password && <p className="text-[11px] text-red-600">{pwdErrors.confirm_password}</p>}
            </div>
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={pwdSaving}
                className="h-8 text-xs gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white">
                {pwdSaving ? <><Loader2 size={11} className="animate-spin" /> Guardando...</> : <><Check size={11} /> Guardar contraseña</>}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Dialog Purge ── */
function PurgeDialog({ open, onClose, purgeMode, purgeRole, selectedCount, purgeDryRun, purgeText, setPurgeText, purgeLoading, onPreview, onExecute }) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg rounded-2xl bg-white border border-slate-100">
        <DialogHeader>
          <DialogTitle className="text-base font-700 text-red-700 flex items-center gap-2">
            <AlertTriangle size={17} className="shrink-0" /> Purge — eliminación total
          </DialogTitle>
          <DialogDescription className="text-xs">
            Borra usuario + perfil + notas + procesos + asistencia. <strong>No hay vuelta atrás.</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Objetivo */}
          <div className="rounded-xl border border-red-100 bg-red-50/60 px-4 py-3">
            <p className="text-xs font-700 text-red-700">Objetivo del purge:</p>
            <p className="text-sm font-700 text-slate-800 mt-0.5">
              {purgeMode === "role"
                ? `TODOS los usuarios con rol: ${purgeRole}`
                : `${selectedCount} usuario(s) seleccionados`}
            </p>
            <p className="text-[11px] text-red-500 mt-1">Genera vista previa primero, luego ejecuta.</p>
          </div>

          {/* Acciones previas */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 rounded-lg" onClick={onPreview} disabled={purgeLoading}>
              {purgeLoading ? <Loader2 size={11} className="animate-spin" /> : <Eye size={11} />}
              Vista previa
            </Button>
            <Button
              variant="destructive" size="sm"
              className="h-8 text-xs gap-1.5 rounded-lg"
              onClick={onExecute} disabled={purgeLoading || !purgeDryRun}
              title={!purgeDryRun ? "Genera vista previa primero" : "Ejecutar purge definitivo"}
            >
              <Trash2 size={11} /> Ejecutar purge
            </Button>
          </div>

          {/* Preview result */}
          <div className="danger-zone p-4 space-y-2">
            {!purgeDryRun ? (
              <p className="text-xs text-slate-400 text-center">Sin vista previa. Genera una arriba.</p>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-700 text-slate-700">Afectados:</span>
                  <span className="text-lg font-800 text-red-700">{purgeDryRun.targets ?? 0}</span>
                </div>

                {purgeMode === "ids" && purgeDryRun.targets === 0 && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                    No se encontraron usuarios para purgar.
                  </p>
                )}

                {Array.isArray(purgeDryRun.sample) && purgeDryRun.sample.length > 0 && (
                  <div className="border border-slate-100 rounded-lg overflow-hidden max-h-36 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          {["ID", "Usuario", "Email"].map((h) => (
                            <th key={h} className="px-2.5 py-1.5 text-left text-[10px] font-700 uppercase tracking-wide text-slate-500">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {purgeDryRun.sample.map((u) => (
                          <tr key={u.id} className="bg-white">
                            <td className="px-2.5 py-1.5 font-mono text-slate-500">{u.id}</td>
                            <td className="px-2.5 py-1.5 font-600">{u.username}</td>
                            <td className="px-2.5 py-1.5 text-slate-500">{u.email}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="space-y-1.5 pt-1">
                  <Label className="text-xs font-600 text-slate-700">
                    Escribe <span className="font-mono font-800 text-red-600">ELIMINAR</span> para confirmar
                  </Label>
                  <Input
                    className="h-9 text-sm rounded-lg font-mono border-red-200 focus:border-red-400"
                    value={purgeText} onChange={(e) => setPurgeText(e.target.value)}
                    placeholder="ELIMINAR"
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end">
            <Button variant="outline" size="sm" className="h-8 text-xs rounded-lg" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════════════ ROLES TAB ═══════════════════════════ */
const RolesTab = () => {
  const { roles: userRoles } = useAuth();
  const isSystemAdmin = (userRoles || []).some((r) => (typeof r === "string" ? r : r?.name || "").toUpperCase() === "ADMIN_SYSTEM");
  const [roles, setRoles] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [loading, setLoading] = useState(true);

  const resetForm = () => { setForm({ name: "", description: "" }); setEditing(null); };

  const fetch = async () => {
    try {
      setLoading(true);
      const data = await ACLService.listRoles();
      setRoles(data?.roles ?? data ?? []);
    } catch { toast.error("Error al cargar roles"); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetch(); }, []);

  const create = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await ACLService.updateRole(editing.id || editing.name, { description: form.description });
        toast.success("Rol actualizado");
      } else {
        await ACLService.createRole(form);
        toast.success("Rol creado");
      }
      setOpen(false); resetForm(); fetch();
    } catch { toast.error(editing ? "No se pudo actualizar el rol" : "No se pudo crear el rol"); }
  };

  const remove = async (role) => {
    try {
      await ACLService.deleteRole(role.id || role.name);
      toast.success("Rol eliminado");
      fetch();
    } catch { toast.error("No se pudo eliminar el rol"); }
  };

  return (
    <Card className="rounded-2xl border border-slate-100 shadow-sm bg-white">
      <CardHeader className="pb-4 border-b border-slate-50">
        <div className="flex items-center justify-between gap-3">
          <SectionHeader title="Roles del sistema" description="Define perfiles y sus propósitos" Icon={Shield} accent="violet" />
          {isSystemAdmin && (
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-9 text-xs gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white shrink-0">
                  <Plus size={13} /> Nuevo rol
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md rounded-2xl bg-white border border-slate-100">
                <DialogHeader>
                  <DialogTitle className="text-base font-700">{editing ? "Editar rol" : "Crear rol"}</DialogTitle>
                  <DialogDescription className="text-xs">{editing ? `Editando: ${editing.name}` : "Define el nombre técnico y descripción del rol"}</DialogDescription>
                </DialogHeader>
                <form onSubmit={create} className="space-y-3 pt-1">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-600">Nombre técnico (ID) *</Label>
                    <Input className="h-9 text-sm rounded-lg font-mono" value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })} required
                      placeholder="ADMIN, TEACHER, STUDENT..." disabled={!!editing} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-600">Descripción</Label>
                    <Input className="h-9 text-sm rounded-lg" value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Describe las responsabilidades del rol" />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button type="button" variant="outline" size="sm" className="h-8 text-xs rounded-lg" onClick={() => setOpen(false)}>Cancelar</Button>
                    <Button type="submit" size="sm" className="h-8 text-xs gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white">
                      <Check size={12} /> {editing ? "Guardar" : "Crear rol"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        <div className="border border-slate-100 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-4 py-2.5 text-left text-[10px] font-700 uppercase tracking-wide text-slate-500">Rol</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-700 uppercase tracking-wide text-slate-500">Descripción</th>
                {isSystemAdmin && <th className="px-4 py-2.5 text-right text-[10px] font-700 uppercase tracking-wide text-slate-500">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 bg-white">
              {loading && <TableSkeleton cols={isSystemAdmin ? 3 : 2} rows={8} />}
              {!loading && roles.length === 0 && (
                <EmptyState icon={Shield} title="Sin roles" description="Crea el primer rol del sistema" colSpan={isSystemAdmin ? 3 : 2} />
              )}
              {!loading && roles.map((r) => (
                <tr key={r.id || r.name} className="user-row">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                        <Shield size={13} className="text-violet-600" />
                      </div>
                      <div>
                        <p className="text-sm font-600 text-slate-800">{t(r.name)}</p>
                        <p className="text-[10px] font-mono text-slate-400">{r.name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{r.description || <span className="text-slate-300">—</span>}</td>
                  {isSystemAdmin && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost"
                          className="h-7 w-7 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                          onClick={() => { setEditing(r); setForm({ name: r.name, description: r.description || "" }); setOpen(true); }}>
                          <Edit3 size={13} />
                        </Button>
                        <DeleteConfirm
                          trigger={<Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={13} /></Button>}
                          title="¿Eliminar rol?"
                          description={<>Se eliminará permanentemente el rol <strong>{r.name}</strong>. Los usuarios con este rol perderán sus permisos asociados.</>}
                          onConfirm={() => remove(r)}
                        />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

/* ═══════════════════════════ PERMISOS TAB ═══════════════════════════ */
const PermissionsTab = () => {
  const [perms, setPerms] = useState([]);
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [selectedPerms, setSelectedPerms] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const dSearch = useDebounce(search, 300);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [p, r] = await Promise.all([ACLService.listPermissions(), ACLService.listRoles()]);
      const allPerms = p ?? [];
      const allRoles = r?.roles ?? r ?? [];
      setPerms(allPerms); setRoles(allRoles);
      if (allRoles.length) {
        const first = allRoles[0];
        setSelectedRole(first);
        const codes = first.permissions ?? first.permissions_detail?.map((x) => x.code) ?? [];
        setSelectedPerms(new Set(codes));
      }
    } catch { toast.error("Error al cargar permisos"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadAll(); }, []);

  const toggle = (code) => {
    const copy = new Set(selectedPerms);
    copy.has(code) ? copy.delete(code) : copy.add(code);
    setSelectedPerms(copy);
  };

  const save = async () => {
    if (!selectedRole?.id) { toast.error("Rol inválido"); return; }
    try {
      setSaving(true);
      await ACLService.setRolePermissions(selectedRole.id, Array.from(selectedPerms));
      toast.success("Permisos actualizados");
    } catch { toast.error("No se pudo actualizar"); }
    finally { setSaving(false); }
  };

  /* Agrupar por módulo (prefijo antes del primer punto) */
  const grouped = useMemo(() => {
    const map = {};
    const filtered = perms.filter((p) => {
      const code = typeof p === "string" ? p : p?.code;
      return !dSearch || code?.toLowerCase().includes(dSearch.toLowerCase()) || t(code)?.toLowerCase().includes(dSearch.toLowerCase());
    });
    filtered.forEach((p) => {
      const code = typeof p === "string" ? p : p?.code;
      const mod = code?.split(".")?.[0] || "general";
      if (!map[mod]) map[mod] = [];
      map[mod].push(code);
    });
    return map;
  }, [perms, dSearch]);

  return (
    <Card className="rounded-2xl border border-slate-100 shadow-sm bg-white">
      <CardHeader className="pb-4 border-b border-slate-50">
        <div className="flex items-center justify-between gap-3">
          <SectionHeader title="Permisos por Rol" description="Asigna o revoca permisos de forma granular por módulo" Icon={KeyRound} accent="green" />
          <Button
            size="sm" disabled={saving || !selectedRole}
            className="h-9 text-xs gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
            onClick={save}
          >
            {saving ? <><Loader2 size={11} className="animate-spin" /> Guardando...</> : <><Check size={12} /> Guardar</>}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Selector de roles */}
        <div className="space-y-2">
          <p className="text-[10px] font-700 uppercase tracking-wider text-slate-400">Rol activo</p>
          <div className="flex flex-wrap gap-1.5">
            {loading && Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skel h-8 rounded-full" style={{ width: `${60 + i * 15}px` }} />
            ))}
            {!loading && roles.map((r) => {
              const isActive = selectedRole && (r.id === selectedRole.id || r.name === selectedRole.name);
              return (
                <button
                  key={r.id || r.name}
                  onClick={() => {
                    setSelectedRole(r);
                    const codes = r.permissions ?? r.permissions_detail?.map((x) => x.code) ?? [];
                    setSelectedPerms(new Set(codes));
                  }}
                  className={`text-xs font-700 px-3 py-1.5 rounded-full border transition-all
                    ${isActive ? "bg-emerald-600 text-white border-emerald-600 shadow-sm" : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-700"}`}
                >
                  {t(r.name)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Búsqueda */}
        <SearchInput value={search} onChange={setSearch} placeholder="Filtrar permisos..." />

        {/* Permisos agrupados */}
        {loading ? (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="skel h-10 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
            {Object.entries(grouped).map(([mod, codes]) => (
              <div key={mod}>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-[10px] font-800 uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md">
                    {mod}
                  </p>
                  <div className="flex-1 h-px bg-slate-100" />
                  <span className="text-[10px] text-slate-400">{codes.length}</span>
                </div>
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-1.5">
                  {codes.map((code) => {
                    const checked = selectedPerms.has(code);
                    return (
                      <label
                        key={code}
                        className={`perm-label flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer ${checked ? "checked" : "border-slate-100"}`}
                      >
                        <input type="checkbox" checked={checked} onChange={() => toggle(code)}
                          className="mt-0.5 accent-emerald-600 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-600 text-slate-700 leading-tight">{t(code)}</p>
                          <p className="text-[10px] font-mono text-slate-400 truncate">{code}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
            {Object.keys(grouped).length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-slate-400">Sin permisos que coincidan</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AccessControlModule;