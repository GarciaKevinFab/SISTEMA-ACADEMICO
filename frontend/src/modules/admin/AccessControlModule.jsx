// src/modules/admin/AccessControlModule.jsx
import "../academic/styles.css";
import { t } from "./aclTranslations";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import {
  Users,
  Shield,
  Plus,
  Edit,
  Trash2,
  KeyRound,
  Search,
  RefreshCw,
  Check,
  AlertTriangle,
  Database,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { motion } from "framer-motion";

import { UsersService } from "../../services/users.service";
import { ACLService } from "../../services/acl.service";
import { validatePassword } from "../../utils/passwordPolicy";
import AuditTab from "./AuditTab";
import { useAuth } from "../../context/AuthContext";
import { PERMS } from "../../auth/permissions";

// ✅ NUEVO: módulo Catálogos
import ConfigCatalogsModule from "./ConfigCatalogsModule";

/* ---------- Animations ---------- */
const fade = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25 },
};
const scaleIn = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.2 },
};

/* ---------- Debounce ---------- */
const useDebounce = (value, delay = 400) => {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
};

const DebouncedSearch = ({ value, onChange, placeholder = "Buscar..." }) => (
  <div className="relative flex-1">
    <Search
      className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60"
      aria-hidden
    />
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      placeholder={placeholder}
      className="pl-9 rounded-xl"
      aria-label="Buscar"
    />
  </div>
);

/* ---------- Confirm Dialog ---------- */
const ConfirmDialog = ({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Confirmar",
  onConfirm,
  confirmVariant = "default",
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-sm backdrop-blur-md bg-white/80 dark:bg-neutral-900/80 border border-white/40 dark:border-white/10 rounded-2xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" /> {title}
        </DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          className="rounded-xl"
        >
          Cancelar
        </Button>
        <Button
          variant={confirmVariant}
          onClick={onConfirm}
          className="rounded-xl"
        >
          {confirmText}
        </Button>
      </div>
    </DialogContent>
  </Dialog>
);

/* ---------- Password Hints ---------- */
const PasswordHints = ({ feedback }) => {
  if (!feedback) return null;
  const { valid, errors } = feedback;
  if (valid) {
    return (
      <p className="mt-1 text-xs text-emerald-600">
        La contraseña cumple la política.
      </p>
    );
  }
  return (
    <ul className="mt-1 text-xs text-red-600 list-disc list-inside">
      {errors.map((er, i) => (
        <li key={i}>{er}</li>
      ))}
    </ul>
  );
};

/* ---------- Helpers visuales ---------- */
const getInitials = (name = "") => {
  if (!name) return "?";
  const parts = name.trim().split(" ").filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const roleBadgeClasses = (role) => {
  const r = (role || "").toUpperCase();
  if (r.includes("ADMIN_SYSTEM")) return "bg-indigo-50 text-indigo-700 border-indigo-200";
  if (r.includes("ADMIN")) return "bg-blue-50 text-blue-700 border-blue-200";
  if (r.includes("REGISTRAR")) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (r.includes("TEACHER")) return "bg-amber-50 text-amber-700 border-amber-200";
  if (r.includes("STUDENT")) return "bg-slate-50 text-slate-700 border-slate-200";
  return "bg-gray-50 text-gray-700 border-gray-200";
};

/* ======================== ROOT ======================== */
const AccessControlModule = () => {
  const { hasPerm } = useAuth();

  const canManage = hasPerm(PERMS["admin.access.manage"]);
  const canAudit = hasPerm(PERMS["admin.audit.view"]);

  // ✅ NUEVO: permiso de catálogos (si no existe, cae a manage)
  const catalogsPerm = PERMS["admin.catalogs.view"] ?? PERMS["admin.access.manage"];
  const canCatalogs = hasPerm(catalogsPerm);

  const defaultTab = canManage ? "users" : canCatalogs ? "catalogs" : canAudit ? "audit" : "users";

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 pb-40 space-y-6">
      <motion.div
        {...fade}
        className="rounded-2xl p-[1px] bg-gradient-to-r from-blue-500/30 via-purple-500/30 to-fuchsia-500/30"
      >
        <div className="rounded-2xl bg-white/70 dark:bg-neutral-900/60 backdrop-blur-md px-5 py-4 border border-white/50 dark:border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.06)] flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Administración</h1>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Gestión de usuarios, roles y permisos.
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500 dark:text-gray-300">
            <Database className="h-4 w-4" />
            <span>Configuración central</span>
          </div>
        </div>
      </motion.div>

      <Tabs defaultValue={defaultTab} className="space-y-6">
        <div className="w-full overflow-x-auto pb-2">
          <TabsList className="inline-flex w-max h-auto p-1 mx-auto rounded-2xl bg-white/70 dark:bg-neutral-900/60 backdrop-blur border border-white/50 dark:border-white/10 shadow-sm">
            {canManage && (
              <TabsTrigger
                value="users"
                className="gap-2 px-4 py-2 rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white transition"
              >
                <Users className="h-4 w-4" /> Usuarios
              </TabsTrigger>
            )}
            {canManage && (
              <TabsTrigger
                value="roles"
                className="gap-2 px-4 py-2 rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-fuchsia-600 data-[state=active]:text-white"
              >
                <Shield className="h-4 w-4" /> Roles
              </TabsTrigger>
            )}
            {canManage && (
              <TabsTrigger
                value="permissions"
                className="gap-2 px-4 py-2 rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-600 data-[state=active]:to-teal-600 data-[state=active]:text-white"
              >
                <KeyRound className="h-4 w-4" /> Permisos
              </TabsTrigger>
            )}

            {canCatalogs && (
              <TabsTrigger
                value="catalogs"
                className="gap-2 px-4 py-2 rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-slate-800 data-[state=active]:to-slate-600 data-[state=active]:text-white"
              >
                <Database className="h-4 w-4" /> Catálogos
              </TabsTrigger>
            )}

            {canAudit && (
              <TabsTrigger value="audit" className="px-4 py-2 rounded-xl">
                Auditoría
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        {canManage && (
          <TabsContent value="users" asChild>
            <motion.div {...fade}>
              <UsersTab />
            </motion.div>
          </TabsContent>
        )}
        {canManage && (
          <TabsContent value="roles" asChild>
            <motion.div {...fade}>
              <RolesTab />
            </motion.div>
          </TabsContent>
        )}
        {canManage && (
          <TabsContent value="permissions" asChild>
            <motion.div {...fade}>
              <PermissionsTab />
            </motion.div>
          </TabsContent>
        )}

        {canCatalogs && (
          <TabsContent value="catalogs" asChild>
            <motion.div {...fade}>
              <ConfigCatalogsModule />
            </motion.div>
          </TabsContent>
        )}

        {canAudit && (
          <TabsContent value="audit" asChild>
            <motion.div {...fade}>
              <AuditTab />
            </motion.div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

/* ------------------------ Usuarios (con paginación 10 en 10) ------------------------ */
const UsersTab = () => {
  const PAGE_SIZE = 10;

  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 450);

  // ✅ PAGINACIÓN
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0); // total global del backend

  const [loading, setLoading] = useState(true);
  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [confirm, setConfirm] = useState({
    open: false,
    action: null,
    id: null,
    title: "¿Estás seguro?",
    description: "Esto aplica la acción seleccionada.",
    confirmText: "Sí, continuar",
    confirmVariant: "destructive",
  });

  const [rolesOptions, setRolesOptions] = useState([]);

  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({
    full_name: "",
    email: "",
    roles: [],
  });

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    username: "",
    password: "",
    roles: [],
  });

  const pwdFeedback = validatePassword(form.password || "");

  const normalizeUsersResponse = (data) => {
    // soporta:
    // - array
    // - { users: [] }
    // - { results: [], count, next, previous } (DRF)
    // - { data: [] }
    if (Array.isArray(data)) return { items: data, count: data.length };
    if (Array.isArray(data?.users)) return { items: data.users, count: data.count ?? data.users.length };
    if (Array.isArray(data?.results)) return { items: data.results, count: data.count ?? data.results.length };
    if (Array.isArray(data?.data)) return { items: data.data, count: data.count ?? data.data.length };
    return { items: [], count: 0 };
  };

  // ✅ cuando cambia búsqueda, volvemos a página 1
  useEffect(() => {
    setPage(1);
  }, [debouncedQ]);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);

      const params = {
        page,
        page_size: PAGE_SIZE,
        ...(debouncedQ ? { q: debouncedQ } : {}),
      };

      const data = await UsersService.list(params);
      const norm = normalizeUsersResponse(data);

      setList(norm.items);
      setCount(norm.count);
    } catch {
      toast.error("Error al cargar usuarios");
      setList([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, page]);

  const fetchRoles = useCallback(async () => {
    try {
      const data = await ACLService.listRoles();
      const raw = data?.roles ?? data ?? [];
      const names = raw
        .map((r) => (typeof r === "string" ? r : r?.name))
        .filter(Boolean);
      setRolesOptions(names);
    } catch {
      setRolesOptions([]);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const resetCreate = () =>
    setForm({
      full_name: "",
      email: "",
      username: "",
      password: "",
      roles: [],
    });

  const toggleRole = (roleName, currentRoles, setter) => {
    const set = new Set(currentRoles);
    set.has(roleName) ? set.delete(roleName) : set.add(roleName);
    setter(Array.from(set));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!pwdFeedback?.valid) {
      toast.error("La contraseña no cumple la política.");
      return;
    }

    try {
      await UsersService.create(form);
      toast.success("Usuario creado");
      setOpenCreate(false);
      resetCreate();

      // ✅ tras crear, vuelve a página 1 y recarga
      setPage(1);
      // fetchUsers se ejecutará por el useEffect (page cambió)
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error al crear usuario");
    }
  };

  const handleDeactivate = async (id) => {
    try {
      await UsersService.deactivate(id);
      toast.success("Usuario desactivado");
      fetchUsers();
    } catch {
      toast.error("No se pudo desactivar");
    }
  };

  const handleResetPass = async (id) => {
    try {
      const res = await UsersService.resetPassword(id);
      toast.success("Contraseña reiniciada");
      if (res?.temporary_password) {
        toast.message(`Temp password: ${res.temporary_password}`);
      }
    } catch {
      toast.error("No se pudo reiniciar la contraseña");
    }
  };

  const handleActivate = async (id) => {
    try {
      await UsersService.activate(id);
      toast.success("Usuario reactivado");
      fetchUsers();
    } catch {
      toast.error("No se pudo reactivar");
    }
  };

  const handleDelete = async (id) => {
    try {
      await UsersService.delete(id);
      toast.success("Usuario eliminado");

      // ✅ si borras el último de la página, baja página si hace falta
      const wouldBeEmpty = list.length === 1 && page > 1;
      if (wouldBeEmpty) setPage((p) => p - 1);
      else fetchUsers();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "No se pudo eliminar");
    }
  };

  const openEditUser = (u) => {
    setEditing(u);
    setEditForm({
      full_name: u.full_name || "",
      email: u.email || "",
      roles: Array.isArray(u.roles) ? u.roles : [],
    });
    setOpenEdit(true);
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    if (!editing) return;

    try {
      await UsersService.update(editing.id, {
        full_name: editForm.full_name,
        email: editForm.email,
      });
      await UsersService.assignRoles(editing.id, editForm.roles);

      toast.success("Usuario actualizado");
      setOpenEdit(false);
      setEditing(null);
      fetchUsers();
    } catch {
      toast.error("No se pudo actualizar");
    }
  };

  const onConfirmAction = async () => {
    if (!confirm.action || !confirm.id) return;
    await confirm.action(confirm.id);
    setConfirm((s) => ({ ...s, open: false }));
  };

  // ✅ contadores SOLO de la página actual (honestos)
  const totalPage = list.length;
  const activosPage = list.filter((u) => u.is_active).length;
  const inactivosPage = totalPage - activosPage;

  const hasData = !loading && list.length > 0;

  // ✅ UI paginación
  const totalPages = useMemo(() => Math.max(1, Math.ceil((count || 0) / PAGE_SIZE)), [count]);
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const from = count === 0 ? 0 : PAGE_SIZE * (page - 1) + 1;
  const to = Math.min(PAGE_SIZE * page, count);

  return (
    <Card className="rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] border-t-4 border-t-blue-600 bg-white/70 dark:bg-neutral-900/60 backdrop-blur-md">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> Usuarios
            </CardTitle>
            <CardDescription>Gestiona altas, ediciones, bajas y roles de usuarios.</CardDescription>
          </div>

          <div className="flex flex-wrap gap-2 text-xs md:text-sm">
            <div className="px-3 py-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-100">
              <span className="font-semibold">{count}</span> total (backend)
            </div>
            <div className="px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100">
              <span className="font-semibold">{activosPage}</span> activos (pág.)
            </div>
            <div className="px-3 py-2 rounded-xl bg-slate-50 text-slate-700 border border-slate-100">
              <span className="font-semibold">{inactivosPage}</span> inactivos (pág.)
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center rounded-xl p-2 bg-gradient-to-r from-slate-100 to-white dark:from-neutral-800 dark:to-neutral-900 border border-white/50 dark:border-white/10">
          <DebouncedSearch
            value={q}
            onChange={setQ}
            placeholder="Buscar por nombre, usuario o email"
          />

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setPage(1);
                fetchUsers();
              }}
              className="gap-2 rounded-xl"
            >
              <RefreshCw className="h-4 w-4" /> Buscar
            </Button>

            <Dialog open={openCreate} onOpenChange={setOpenCreate}>
              <DialogTrigger asChild>
                <Button className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 gap-2">
                  <Plus className="h-4 w-4" /> Nuevo Usuario
                </Button>
              </DialogTrigger>

              <DialogContent
                className="
                  w-[calc(100vw-1.5rem)] sm:w-full sm:max-w-xl
                  h-[90vh] overflow-hidden p-0
                  backdrop-blur-md bg-white/85 dark:bg-neutral-900/85
                  border border-white/50 dark:border-white/10 rounded-2xl
                  flex flex-col
                "
              >
                {/* HEADER fijo */}
                <div className="px-6 pt-5 pb-3 border-b flex-none">
                  <DialogHeader>
                    <DialogTitle>Crear Usuario</DialogTitle>
                    <DialogDescription>Complete los datos básicos</DialogDescription>
                  </DialogHeader>
                </div>

                {/* BODY con scroll */}
                <div
                  className="px-6 py-4 flex-1 overflow-y-auto"
                  style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}
                >
                  <motion.form {...scaleIn} onSubmit={handleCreate} className="space-y-4">
                    <div className="grid gap-3">
                      <div>
                        <Label htmlFor="full_name">Nombre completo</Label>
                        <Input
                          id="full_name"
                          className="rounded-xl"
                          value={form.full_name}
                          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="username">Usuario</Label>
                          <Input
                            id="username"
                            className="rounded-xl"
                            value={form.username}
                            onChange={(e) => setForm({ ...form, username: e.target.value })}
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            className="rounded-xl"
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="password">Contraseña</Label>
                        <Input
                          id="password"
                          type="password"
                          className="rounded-xl"
                          value={form.password}
                          onChange={(e) => setForm({ ...form, password: e.target.value })}
                          required
                        />
                        <PasswordHints feedback={pwdFeedback} />
                      </div>

                      {/* Roles */}
                      <div>
                        <Label>Roles</Label>
                        <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
                          {rolesOptions.map((r) => {
                            const checked = form.roles.includes(r);
                            return (
                              <label
                                key={r}
                                className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer ${checked ? "bg-blue-50 border-blue-200" : "hover:bg-muted/40"
                                  }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() =>
                                    toggleRole(r, form.roles, (newRoles) =>
                                      setForm({ ...form, roles: newRoles })
                                    )
                                  }
                                />
                                <span className="text-sm">{r}</span>
                              </label>
                            );
                          })}

                          {rolesOptions.length === 0 && (
                            <p className="text-xs text-muted-foreground">
                              No hay roles (o no tienes permisos para listarlos).
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="h-8" />
                    </div>

                    {/* FOOTER fijo */}
                    <div className="sticky bottom-0 bg-white/85 dark:bg-neutral-900/85 pt-3 pb-2 border-t">
                      <div className="flex flex-col sm:flex-row justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setOpenCreate(false)}
                          className="rounded-xl w-full sm:w-auto"
                        >
                          Cancelar
                        </Button>

                        <Button
                          type="submit"
                          className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 gap-2 w-full sm:w-auto"
                        >
                          <Check className="h-4 w-4" /> Crear
                        </Button>
                      </div>
                    </div>
                  </motion.form>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Tabla */}
        <div className="rounded-2xl border border-white/50 dark:border-white/10 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50/80 dark:bg-neutral-800/80 text-black backdrop-blur sticky top-0 z-10">
              <tr className="[&>th]:p-3 [&>th]:text-left">
                <th>Usuario</th>
                <th>Email</th>
                <th>Roles</th>
                <th>Estado</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {!loading && hasData && list.map((u) => (
                <motion.tr
                  key={u.id}
                  {...fade}
                  className="border-t border-white/40 dark:border-white/10 !bg-slate-50 even:!bg-slate-200 hover:!bg-slate-300 transition-colors"
                >
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-sm">
                        {getInitials(u.full_name || u.username)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 truncate">
                          {u.full_name || u.username}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          @{u.username}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="p-3">
                    <span className="text-sm text-gray-700 dark:text-gray-200">
                      {u.email}
                    </span>
                  </td>

                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {(u.roles || []).map((r) => (
                        <span
                          key={r}
                          className={"rounded-full px-2.5 py-1 text-xs border " + roleBadgeClasses(r)}
                        >
                          {r}
                        </span>
                      ))}
                      {(u.roles || []).length === 0 && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </td>

                  <td className="p-3">
                    {u.is_active ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs px-2.5 py-1">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" /> Activo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 text-slate-700 border border-slate-200 text-xs px-2.5 py-1">
                        <span className="h-2 w-2 rounded-full bg-slate-400" /> Inactivo
                      </span>
                    )}
                  </td>

                  <td className="p-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleResetPass(u.id)}
                        className="gap-1 rounded-xl"
                      >
                        <KeyRound className="h-4 w-4" /> Reset
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditUser(u)}
                        className="gap-1 rounded-xl"
                      >
                        <Edit className="h-4 w-4" /> Editar
                      </Button>

                      {u.is_active ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setConfirm({
                              open: true,
                              action: handleDeactivate,
                              id: u.id,
                              title: "Dar de baja usuario",
                              description: "El usuario no podrá iniciar sesión hasta reactivarlo.",
                              confirmText: "Sí, dar de baja",
                              confirmVariant: "destructive",
                            })
                          }
                          className="gap-1 rounded-xl"
                        >
                          <Trash2 className="h-4 w-4" /> Baja
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setConfirm({
                              open: true,
                              action: handleActivate,
                              id: u.id,
                              title: "Reactivar usuario",
                              description: "El usuario podrá iniciar sesión nuevamente.",
                              confirmText: "Sí, reactivar",
                              confirmVariant: "default",
                            })
                          }
                          className="gap-1 rounded-xl"
                        >
                          Activar
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          setConfirm({
                            open: true,
                            action: handleDelete,
                            id: u.id,
                            title: "Eliminar definitivamente",
                            description: "Esto borra el usuario de forma permanente. No hay vuelta atrás.",
                            confirmText: "Sí, eliminar",
                            confirmVariant: "destructive",
                          })
                        }
                        className="gap-1 rounded-xl"
                        title="Eliminar definitivamente"
                      >
                        Eliminar
                      </Button>
                    </div>
                  </td>
                </motion.tr>
              ))}

              {!loading && !hasData && (
                <tr>
                  <td className="p-6 text-center text-muted-foreground" colSpan={5}>
                    No hay resultados con ese filtro.
                  </td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td className="p-6 text-center text-muted-foreground" colSpan={5}>
                    Cargando…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ✅ PAGINACIÓN */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1">
          <div className="text-xs text-muted-foreground">
            Mostrando <b>{from}</b> - <b>{to}</b> de <b>{count}</b>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="rounded-xl gap-1"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!canPrev || loading}
            >
              <ChevronLeft className="h-4 w-4" /> Anterior
            </Button>

            <span className="text-xs px-2">
              Página <b>{page}</b> / {totalPages}
            </span>

            <Button
              variant="outline"
              className="rounded-xl gap-1"
              onClick={() => setPage((p) => p + 1)}
              disabled={!canNext || loading}
            >
              Siguiente <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Editar */}
        <Dialog open={openEdit} onOpenChange={setOpenEdit}>
          <DialogContent className="max-w-xl backdrop-blur-md bg-white/85 dark:bg-neutral-900/85 border border-white/50 dark:border-white/10 rounded-2xl">
            <DialogHeader>
              <DialogTitle>Editar Usuario</DialogTitle>
              <DialogDescription>Actualiza los datos y roles</DialogDescription>
            </DialogHeader>

            <motion.form {...scaleIn} onSubmit={submitEdit} className="space-y-4">
              <div className="grid gap-3">
                <div>
                  <Label htmlFor="edit_fullname">Nombre completo</Label>
                  <Input
                    id="edit_fullname"
                    className="rounded-xl"
                    value={editForm.full_name}
                    onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="edit_email">Email</Label>
                  <Input
                    id="edit_email"
                    type="email"
                    className="rounded-xl"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label>Roles</Label>
                  <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
                    {rolesOptions.map((r) => {
                      const checked = editForm.roles.includes(r);
                      return (
                        <label
                          key={r}
                          className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer ${checked ? "bg-blue-50 border-blue-200" : "hover:bg-muted/40"
                            }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              toggleRole(r, editForm.roles, (newRoles) =>
                                setEditForm({ ...editForm, roles: newRoles })
                              )
                            }
                          />
                          <span className="text-sm">{r}</span>
                        </label>
                      );
                    })}
                    {rolesOptions.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        No hay roles para asignar.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpenEdit(false)} className="rounded-xl">
                  Cancelar
                </Button>
                <Button type="submit" className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600">
                  Guardar
                </Button>
              </div>
            </motion.form>
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={confirm.open}
          onOpenChange={(open) => setConfirm((s) => ({ ...s, open }))}
          title={confirm.title}
          description={confirm.description}
          confirmText={confirm.confirmText}
          confirmVariant={confirm.confirmVariant}
          onConfirm={onConfirmAction}
        />
      </CardContent>
    </Card>
  );
};

/* ------------------------ Roles (Traducido) ------------------------ */
const RolesTab = () => {
  const [roles, setRoles] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    try {
      setLoading(true);
      const data = await ACLService.listRoles();
      setRoles(data?.roles ?? data ?? []);
    } catch {
      toast.error("Error al cargar roles");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { fetch(); }, []);

  const create = async (e) => {
    e.preventDefault();
    try {
      await ACLService.createRole(form);
      toast.success("Rol creado");
      setOpen(false);
      setForm({ name: "", description: "" });
      fetch();
    } catch {
      toast.error("No se pudo crear el rol");
    }
  };

  return (
    <Card className="rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] border-t-4 border-t-violet-600 bg-white/70 dark:bg-neutral-900/60 backdrop-blur-md">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" /> Roles
        </CardTitle>
        <CardDescription>Define perfiles del sistema y su propósito.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between">
          <div />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 shadow-sm hover:shadow-md transition gap-2">
                <Plus className="h-4 w-4" /> Nuevo Rol
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md backdrop-blur-md bg-white/85 dark:bg-neutral-900/85 border border-white/50 dark:border-white/10 rounded-2xl">
              <DialogHeader>
                <DialogTitle>Crear Rol</DialogTitle>
              </DialogHeader>
              <motion.form {...scaleIn} onSubmit={create} className="space-y-4">
                <div>
                  <Label htmlFor="role_name">Nombre (ID Técnico)</Label>
                  <Input
                    id="role_name"
                    className="rounded-xl"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="role_desc">Descripción</Label>
                  <Input
                    id="role_desc"
                    className="rounded-xl"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-xl">
                    Cancelar
                  </Button>
                  <Button type="submit" className="rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700">
                    Crear
                  </Button>
                </div>
              </motion.form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="rounded-2xl border border-white/50 dark:border-white/10 overflow-hidden">
          <div className="max-h-[480px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/80 text-gray-900 dark:bg-neutral-800/80 dark:text-white backdrop-blur sticky top-0 z-10">
                <tr>
                  <th className="p-3 text-left">Rol</th>
                  <th className="p-3 text-left">Descripción</th>
                </tr>
              </thead>
              <tbody>
                {loading &&
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={`skl-${i}`} className="border-t border-white/50 dark:border-white/10">
                      <td className="p-3">
                        <div className="h-4 w-32 rounded bg-gray-200 dark:bg-white/10 animate-pulse" />
                      </td>
                      <td className="p-3">
                        <div className="h-4 w-64 rounded bg-gray-200 dark:bg-white/10 animate-pulse" />
                      </td>
                    </tr>
                  ))}

                {!loading &&
                  roles.map((r) => (
                    <tr
                      key={r.id || r.name}
                      className="border-t border-white/40 dark:border-white/10 bg-white/65 hover:bg-violet-50/60 transition"
                    >
                      <td className="p-3 font-medium text-gray-900">
                        <div className="text-sm font-semibold">{t(r.name)}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{r.name}</div>
                      </td>
                      <td className="p-3 text-gray-800">{r.description}</td>
                    </tr>
                  ))}

                {!loading && roles.length === 0 && (
                  <tr>
                    <td className="p-6 text-center text-muted-foreground" colSpan={2}>
                      Sin roles
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

/* --------------------- Permisos (Traducido) --------------------- */
const PermissionsTab = () => {
  const [perms, setPerms] = useState([]);
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [selectedPerms, setSelectedPerms] = useState(new Set());
  const [loading, setLoading] = useState(true);

  const loadPerms = async () => {
    try {
      setLoading(true);
      const [p, r] = await Promise.all([
        ACLService.listPermissions(),
        ACLService.listRoles(),
      ]);

      const allPerms = p ?? [];
      const allRoles = r?.roles ?? r ?? [];

      setPerms(allPerms);
      setRoles(allRoles);

      if (allRoles.length) {
        const first = allRoles[0];
        setSelectedRole(first);
        const roleCodes = first.permissions ?? first.permissions_detail?.map((x) => x.code) ?? [];
        setSelectedPerms(new Set(roleCodes));
      }
    } catch {
      toast.error("Error al cargar permisos/roles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPerms();
  }, []);

  const toggle = (permCode) => {
    const copy = new Set(selectedPerms);
    copy.has(permCode) ? copy.delete(permCode) : copy.add(permCode);
    setSelectedPerms(copy);
  };

  const save = async () => {
    if (!selectedRole?.id) {
      toast.error("Rol inválido");
      return;
    }

    try {
      await ACLService.setRolePermissions(selectedRole.id, Array.from(selectedPerms));
      toast.success("Permisos actualizados");
    } catch {
      toast.error("No se pudo actualizar");
    }
  };

  return (
    <Card className="rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] border-t-4 border-t-emerald-600 bg-white/70 dark:bg-neutral-900/60 backdrop-blur-md">
      <CardHeader className="pb-3">
        <CardTitle>Permisos por Rol</CardTitle>
        <CardDescription>Asigna o revoca permisos de manera granular.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {roles.map((r) => {
            const isActive = selectedRole && (r.id === selectedRole.id || r.name === selectedRole.name);
            return (
              <Button
                key={r.id || r.name}
                variant={isActive ? "default" : "outline"}
                className={`rounded-full ${isActive
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
                    : ""
                  }`}
                onClick={() => {
                  setSelectedRole(r);
                  const roleCodes = r.permissions ?? r.permissions_detail?.map((x) => x.code) ?? [];
                  setSelectedPerms(new Set(roleCodes));
                }}
              >
                {t(r.name)}
              </Button>
            );
          })}

          {!loading && roles.length === 0 && (
            <span className="text-sm text-muted-foreground">No hay roles disponibles.</span>
          )}
        </div>

        <div className="rounded-2xl border border-white/50 dark:border-white/10 p-3">
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-[420px] overflow-auto">
            {loading &&
              Array.from({ length: 12 }).map((_, i) => (
                <div key={`perm-sk-${i}`} className="h-9 rounded bg-gray-200 dark:bg-white/10 animate-pulse" />
              ))}

            {!loading &&
              perms.map((p) => {
                const code = typeof p === "string" ? p : p?.code;
                const checked = selectedPerms.has(code);
                return (
                  <label
                    key={code}
                    className={`flex items-center gap-2 p-2 rounded-xl border transition cursor-pointer ${checked
                        ? "bg-emerald-50/80 dark:bg-emerald-900/20 border-emerald-200/70"
                        : "hover:bg-muted/40"
                      }`}
                  >
                    <input
                      type="checkbox"
                      className="accent-emerald-600 h-4 w-4"
                      checked={checked}
                      onChange={() => toggle(code)}
                      aria-label={`Permiso ${code}`}
                    />
                    <div className="flex flex-col leading-snug">
                      <span className="text-sm font-medium">{t(code)}</span>
                      <span className="text-[10px] text-gray-400 font-mono">{code}</span>
                    </div>
                  </label>
                );
              })}
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={save}
            className="gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
          >
            <Check className="h-4 w-4" /> Guardar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AccessControlModule;
