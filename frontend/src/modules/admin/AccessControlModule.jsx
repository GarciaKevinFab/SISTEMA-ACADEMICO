// src/modules/admin/AccessControlModule.jsx
import '../academic/styles.css';  // Correcto si styles.css está en la carpeta academic

import React, { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger
} from "../../components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import {
  Users, Shield, Plus, Edit, Trash2, KeyRound, Search,
  RefreshCw, Check, AlertTriangle, Database
} from "lucide-react";
import { motion } from "framer-motion";

import { UsersService } from "../../services/users.service";
import { ACLService } from "../../services/acl.service";
import { validatePassword } from "../../utils/passwordPolicy";
import AuditTab from "./AuditTab";
import { useAuth } from "../../context/AuthContext";
import { PERMS } from "../../auth/permissions";

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

/* ======================== ROOT ======================== */
const AccessControlModule = () => {
  const { hasPerm } = useAuth();
  const canManage = hasPerm(PERMS["admin.access.manage"]);
  const canAudit = hasPerm(PERMS["admin.audit.view"]);
  const defaultTab = canManage ? "users" : canAudit ? "audit" : "users";

  return (
    <div className="p-6 space-y-6">
      {/* Header general de Administración */}
      <motion.div
        {...fade}
        className="rounded-2xl p-[1px] bg-gradient-to-r from-blue-500/30 via-purple-500/30 to-fuchsia-500/30"
      >
        <div className="rounded-2xl bg-white/70 dark:bg-neutral-900/60 backdrop-blur-md px-5 py-4 border border-white/50 dark:border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.06)] flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Administración
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Gestión de usuarios, roles y permisos del Sistema Académico.
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500 dark:text-gray-300">
            <Database className="h-4 w-4" />
            <span>Configuración central del sistema</span>
          </div>
        </div>
      </motion.div>

      <Tabs defaultValue={defaultTab} className="space-y-6">
        <TabsList className="sticky top-0 z-10 mx-auto w-fit rounded-2xl bg-white/70 dark:bg-neutral-900/60 backdrop-blur border border-white/50 dark:border-white/10 shadow-sm">
          {canManage && (
            <TabsTrigger
              value="users"
              className="gap-2 rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white transition"
            >
              <Users className="h-4 w-4" /> Usuarios
            </TabsTrigger>
          )}
          {canManage && (
            <TabsTrigger
              value="roles"
              className="gap-2 rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-fuchsia-600 data-[state=active]:text-white"
            >
              <Shield className="h-4 w-4" /> Roles
            </TabsTrigger>
          )}
          {canManage && (
            <TabsTrigger
              value="permissions"
              className="gap-2 rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-600 data-[state=active]:to-teal-600 data-[state=active]:text-white"
            >
              <KeyRound className="h-4 w-4" /> Permisos
            </TabsTrigger>
          )}
          {canAudit && (
            <TabsTrigger value="audit" className="rounded-xl">
              Auditoría
            </TabsTrigger>
          )}
        </TabsList>

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

/* ---------- Password Hints ---------- */
const PasswordHints = ({ feedback }) => {
  if (!feedback) return null;
  const { valid, errors } = feedback;
  if (valid)
    return (
      <p className="mt-1 text-xs text-emerald-600">
        La contraseña cumple la política.
      </p>
    );
  return (
    <ul className="mt-1 text-xs text-red-600 list-disc list-inside">
      {errors.map((er, i) => (
        <li key={i}>{er}</li>
      ))}
    </ul>
  );
};

/* ---------- Helpers visuales para tabla de usuarios ---------- */

// Iniciales para el avatar
const getInitials = (name = "") => {
  if (!name) return "?";
  const parts = name.trim().split(" ").filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// Colores para los badges de roles
const roleBadgeClasses = (role) => {
  const r = (role || "").toUpperCase();
  if (r.includes("ADMIN_SYSTEM")) {
    return "bg-indigo-50 text-indigo-700 border-indigo-200";
  }
  if (r.includes("ADMIN")) {
    return "bg-blue-50 text-blue-700 border-blue-200";
  }
  if (r.includes("REGISTRAR")) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  if (r.includes("TEACHER")) {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }
  if (r.includes("STUDENT")) {
    return "bg-slate-50 text-slate-700 border-slate-200";
  }
  return "bg-gray-50 text-gray-700 border-gray-200";
};

/* ------------------------ Usuarios (azul, embellecido) ------------------------ */
const UsersTab = () => {
  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 450);

  const [loading, setLoading] = useState(true);
  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [confirm, setConfirm] = useState({ open: false, action: null, id: null });

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
    roles: ["STUDENT"],
  });

  const pwdFeedback = validatePassword(form.password || "");

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await UsersService.list(
        debouncedQ ? { q: debouncedQ } : undefined
      );
      setList(data?.users ?? data ?? []);
    } catch {
      toast.error("Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  }, [debouncedQ]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const resetCreate = () =>
    setForm({
      full_name: "",
      email: "",
      username: "",
      password: "",
      roles: ["STUDENT"],
    });

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await UsersService.create(form);
      toast.success("Usuario creado");
      setOpenCreate(false);
      resetCreate();
      fetchUsers();
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
      await UsersService.resetPassword(id);
      toast.success("Contraseña reiniciada");
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
    setConfirm({ open: false, action: null, id: null });
  };

  const hasData = !loading && list.length > 0;

  const total = list.length;
  const activos = list.filter((u) => u.is_active).length;
  const inactivos = total - activos;

  return (
    <Card className="rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] border-t-4 border-t-blue-600 bg-white/70 dark:bg-neutral-900/60 backdrop-blur-md">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> Usuarios
            </CardTitle>
            <CardDescription>
              Gestiona altas, ediciones, bajas y roles de usuarios.
            </CardDescription>
          </div>

          <div className="flex flex-wrap gap-2 text-xs md:text-sm">
            <div className="px-3 py-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-100">
              <span className="font-semibold">{total}</span> usuarios
            </div>
            <div className="px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100">
              <span className="font-semibold">{activos}</span> activos
            </div>
            <div className="px-3 py-2 rounded-xl bg-slate-50 text-slate-700 border border-slate-100">
              <span className="font-semibold">{inactivos}</span> inactivos
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filtro + botones */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center rounded-xl p-2 bg-gradient-to-r from-slate-100 to-white dark:from-neutral-800 dark:to-neutral-900 border border-white/50 dark:border-white/10">
          <DebouncedSearch
            value={q}
            onChange={setQ}
            placeholder="Buscar por nombre, usuario o email"
          />
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={fetchUsers}
              className="gap-2 rounded-xl hover:shadow-md transition"
            >
              <RefreshCw className="h-4 w-4" /> Buscar
            </Button>
            <Dialog open={openCreate} onOpenChange={setOpenCreate}>
              <DialogTrigger asChild>
                <Button className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-sm hover:shadow-md transition gap-2">
                  <Plus className="h-4 w-4" /> Nuevo Usuario
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl backdrop-blur-md bg-white/85 dark:bg-neutral-900/85 border border-white/50 dark:border-white/10 rounded-2xl">
                <DialogHeader>
                  <DialogTitle>Crear Usuario</DialogTitle>
                  <DialogDescription>Complete los datos básicos</DialogDescription>
                </DialogHeader>

                <motion.form
                  {...scaleIn}
                  onSubmit={handleCreate}
                  className="space-y-4"
                >
                  <div className="grid gap-3">
                    <div>
                      <Label htmlFor="full_name">Nombre completo</Label>
                      <Input
                        id="full_name"
                        className="rounded-xl"
                        value={form.full_name}
                        onChange={(e) =>
                          setForm({ ...form, full_name: e.target.value })
                        }
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
                          onChange={(e) =>
                            setForm({ ...form, username: e.target.value })
                          }
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
                          onChange={(e) =>
                            setForm({ ...form, email: e.target.value })
                          }
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
                        onChange={(e) =>
                          setForm({ ...form, password: e.target.value })
                        }
                        required
                      />
                      <PasswordHints feedback={pwdFeedback} />
                    </div>
                    <div>
                      <Label htmlFor="roles">Roles (separados por coma)</Label>
                      <Input
                        id="roles"
                        className="rounded-xl"
                        value={form.roles.join(",")}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            roles: e.target.value
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                        placeholder="ADMIN,REGISTRAR,TEACHER,STUDENT"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Ejemplo: ADMIN,REGISTRAR,TEACHER,STUDENT
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setOpenCreate(false)}
                      className="rounded-xl"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 gap-2"
                    >
                      <Check className="h-4 w-4" /> Crear
                    </Button>
                  </div>
                </motion.form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Tabla */}
        <div className="rounded-2xl border border-white/50 dark:border-white/10 overflow-hidden">
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
              {loading &&
                Array.from({ length: 6 }).map((_, idx) => (
                  <tr
  key={`sk-${idx}`}
  className="border-t border-white/50 dark:border-white/10"
>
  <td className="p-3 text-black"> {/* Cambié a texto negro */}
    <div className="h-4 w-40 rounded bg-gray-200 dark:bg-white/10 animate-pulse" />
  </td>
  <td className="p-3 text-black"> {/* Cambié a texto negro */}
    <div className="h-4 w-56 rounded bg-gray-200 dark:bg-white/10 animate-pulse" />
  </td>
  <td className="p-3 text-black"> {/* Cambié a texto negro */}
    <div className="h-5 w-24 rounded bg-gray-200 dark:bg-white/10 animate-pulse" />
  </td>
  <td className="p-3 text-black"> {/* Cambié a texto negro */}
    <div className="h-5 w-16 rounded bg-gray-200 dark:bg-white/10 animate-pulse" />
  </td>
  <td className="p-3 text-right text-black"> {/* Cambié a texto negro */}
    <div className="h-8 w-28 rounded bg-gray-200 dark:bg-white/10 animate-pulse ml-auto" />
  </td>
</tr>
                ))}

              {!loading &&
                hasData &&
                list.map((u) => (
                  <motion.tr
                    key={u.id}
                    {...fade}
                    className="border-t border-white/40 dark:border-white/10 !bg-slate-50 even:!bg-slate-200 hover:!bg-slate-300 transition-colors"


                  >
                    {/* Usuario + avatar */}
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
                            className={
                              "rounded-full px-2.5 py-1 text-xs border " +
                              roleBadgeClasses(r)
                            }
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="p-3">
                      {u.is_active ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs px-2.5 py-1">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 text-slate-700 border border-slate-200 text-xs px-2.5 py-1">
                          <span className="h-2 w-2 rounded-full bg-slate-400" />
                          Inactivo
                        </span>
                      )}
                    </td>

                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResetPass(u.id)}
                          className="gap-1 rounded-xl hover:shadow-sm"
                          title="Reiniciar contraseña"
                        >
                          <KeyRound className="h-4 w-4" /> Reset
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditUser(u)}
                          className="gap-1 rounded-xl hover:shadow-sm"
                          title="Editar usuario"
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
                              })
                            }
                            className="gap-1 rounded-xl hover:shadow-sm"
                            title="Dar de baja"
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
                              })
                            }
                            className="gap-1 rounded-xl hover:shadow-sm"
                            title="Reactivar"
                          >
                            Activar
                          </Button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}

              {!loading && !hasData && (
                <tr>
                  <td
                    className="p-6 text-center text-muted-foreground"
                    colSpan={5}
                  >
                    No hay resultados con ese filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Editar */}
        <Dialog open={openEdit} onOpenChange={setOpenEdit}>
          <DialogContent className="max-w-xl backdrop-blur-md bg-white/85 dark:bg-neutral-900/85 border border-white/50 dark:border-white/10 rounded-2xl">
            <DialogHeader>
              <DialogTitle>Editar Usuario</DialogTitle>
              <DialogDescription>
                Actualiza los datos y roles
              </DialogDescription>
            </DialogHeader>
            <motion.form
              {...scaleIn}
              onSubmit={submitEdit}
              className="space-y-4"
            >
              <div className="grid gap-3">
                <div>
                  <Label htmlFor="edit_fullname">Nombre completo</Label>
                  <Input
                    id="edit_fullname"
                    className="rounded-xl"
                    value={editForm.full_name}
                    onChange={(e) =>
                      setEditForm({ ...editForm, full_name: e.target.value })
                    }
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
                    onChange={(e) =>
                      setEditForm({ ...editForm, email: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit_roles">
                    Roles (separados por coma)
                  </Label>
                  <Input
                    id="edit_roles"
                    className="rounded-xl"
                    value={editForm.roles.join(",")}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        roles: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpenEdit(false)}
                  className="rounded-xl"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                >
                  Guardar
                </Button>
              </div>
            </motion.form>
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={confirm.open}
          onOpenChange={(open) =>
            setConfirm((s) => ({ ...s, open }))
          }
          title="¿Estás seguro?"
          description="Podrás revertirlo luego si es necesario."
          confirmText="Sí, continuar"
          confirmVariant="destructive"
          onConfirm={onConfirmAction}
        />
      </CardContent>
    </Card>
  );
};

/* ------------------------ Roles (violeta, scroll propio) ------------------------ */
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
  useEffect(() => {
    fetch();
  }, []);

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
        <CardDescription>
          Define perfiles del sistema y su propósito.
        </CardDescription>
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
              <motion.form
                {...scaleIn}
                onSubmit={create}
                className="space-y-4"
              >
                <div>
                  <Label htmlFor="role_name">Nombre</Label>
                  <Input
                    id="role_name"
                    className="rounded-xl"
                    value={form.name}
                    onChange={(e) =>
                      setForm({ ...form, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="role_desc">Descripción</Label>
                  <Input
                    id="role_desc"
                    className="rounded-xl"
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                    className="rounded-xl"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700"
                  >
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
                    <tr
                      key={`skl-${i}`}
                      className="border-t border-white/50 dark:border-white/10"
                    >
                      <td className="p-3">
                        <div className="h-4 w-32 rounded bg-gray-200 dark:bg-white/10 animate-pulse" />
                      </td>
                      <td className="p-3">
                        <div className="h-4 w-64 rounded bg-gray-200 dark:bg_white/10 animate-pulse" />
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
                      {r.name}
                      </td>
                    <td className="p-3 text-gray-800">
                      {r.description}
                    </td>
                      </tr>

                  ))}
                {!loading && roles.length === 0 && (
                  <tr>
                    <td
                      className="p-6 text-center text-muted-foreground"
                      colSpan={2}
                    >
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

/* --------------------- Permisos (verde) --------------------- */
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
        const roleCodes =
          first.permissions ??
          first.permissions_detail?.map((x) => x.code) ??
          [];
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
      await ACLService.setRolePermissions(
        selectedRole.id,
        Array.from(selectedPerms)
      );
      toast.success("Permisos actualizados");
    } catch {
      toast.error("No se pudo actualizar");
    }
  };

  return (
    <Card className="rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] border-t-4 border-t-emerald-600 bg-white/70 dark:bg-neutral-900/60 backdrop-blur-md">
      <CardHeader className="pb-3">
        <CardTitle>Permisos por Rol</CardTitle>
        <CardDescription>
          Asigna o revoca permisos de manera granular.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {roles.map((r) => {
            const isActive =
              selectedRole &&
              (r.id === selectedRole.id || r.name === selectedRole.name);
            return (
              <Button
                key={r.id || r.name}
                variant={isActive ? "default" : "outline"}
                className={`rounded-full ${
                  isActive
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
                    : ""
                }`}
                onClick={() => {
                  setSelectedRole(r);
                  const roleCodes =
                    r.permissions ??
                    r.permissions_detail?.map((x) => x.code) ??
                    [];
                  setSelectedPerms(new Set(roleCodes));
                }}
              >
                {r.name}
              </Button>
            );
          })}
          {!loading && roles.length === 0 && (
            <span className="text-sm text-muted-foreground">
              No hay roles disponibles.
            </span>
          )}
        </div>

        <div className="rounded-2xl border border-white/50 dark:border-white/10 p-3">
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-[420px] overflow-auto">
            {loading &&
              Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={`perm-sk-${i}`}
                  className="h-9 rounded bg-gray-200 dark:bg-white/10 animate-pulse"
                />
              ))}
            {!loading &&
              perms.map((p) => {
                const code = typeof p === "string" ? p : p?.code;
                const checked = selectedPerms.has(code);
                return (
                  <label
                    key={code}
                    className={`flex items-center gap-2 p-2 rounded-xl border transition ${
                      checked
                        ? "bg-emerald-50/80 dark:bg-emerald-900/20 border-emerald-200/70"
                        : "hover:bg-muted/40"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="accent-emerald-600"
                      checked={checked}
                      onChange={() => toggle(code)}
                      aria-label={`Permiso ${code}`}
                    />
                    <span className="text-sm">{code}</span>
                  </label>
                );
              })}
            {!loading && perms.length === 0 && (
              <div className="text-sm text-muted-foreground">
                Sin permisos definidos
              </div>
            )}
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
