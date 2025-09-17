// src/modules/admin/AccessControlModule.jsx
import React, { useEffect, useState } from "react";
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
import { Users, Shield, Plus, Edit, Trash2, KeyRound } from "lucide-react";

import { UsersService } from "../../services/users.service";
import { ACLService } from "../../services/acl.service";
import { validatePassword } from "../../utils/passwordPolicy";
import AuditTab from "./AuditTab";
import { useAuth } from "../../context/AuthContext";
import { PERMS } from "../../auth/permissions";

const AccessControlModule = () => {
    const { hasPerm } = useAuth();
    const canManage = hasPerm(PERMS["admin.access.manage"]);
    const canAudit = hasPerm(PERMS["admin.audit.view"]);

    // define la primera pestaña disponible
    const defaultTab = canManage ? "users" : canAudit ? "audit" : "users";

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Administración</h1>
                    <p className="text-gray-600">Usuarios, Roles, Permisos y Auditoría</p>
                </div>
            </div>

            <Tabs defaultValue={defaultTab} className="space-y-6">
                <TabsList>
                    {canManage && <TabsTrigger value="users">Usuarios</TabsTrigger>}
                    {canManage && <TabsTrigger value="roles">Roles</TabsTrigger>}
                    {canManage && <TabsTrigger value="permissions">Permisos</TabsTrigger>}
                    {canAudit && <TabsTrigger value="audit">Auditoría</TabsTrigger>}
                </TabsList>

                {canManage && (
                    <TabsContent value="users">
                        <UsersTab />
                    </TabsContent>
                )}

                {canManage && (
                    <TabsContent value="roles">
                        <RolesTab />
                    </TabsContent>
                )}

                {canManage && (
                    <TabsContent value="permissions">
                        <PermissionsTab />
                    </TabsContent>
                )}

                {canAudit && (
                    <TabsContent value="audit">
                        <AuditTab />
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
};

/* ------------------------ Usuarios ------------------------ */
const UsersTab = () => {
    const [list, setList] = useState([]);
    const [q, setQ] = useState("");
    const [loading, setLoading] = useState(true);
    const [openCreate, setOpenCreate] = useState(false);
    const [openEdit, setOpenEdit] = useState(false);
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
        roles: ["STUDENT"], // por defecto
    });

    const pwdFeedback = validatePassword(form.password || "");

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const data = await UsersService.list(q ? { q } : undefined);
            setList(data?.users ?? data ?? []);
        } catch (e) {
            toast.error("Error al cargar usuarios");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchUsers(); }, []); // cargamos al entrar

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            await UsersService.create(form);
            toast.success("Usuario creado");
            setOpenCreate(false);
            setForm({ full_name: "", email: "", username: "", password: "", roles: ["STUDENT"] });
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
        } catch (e) {
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

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" /> Usuarios
                </CardTitle>
                <CardDescription>Alta, edición, baja, asignación de roles</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                    <Input placeholder="Buscar por nombre/usuario/email" value={q} onChange={(e) => setQ(e.target.value)} />
                    <Button variant="outline" onClick={fetchUsers}>Buscar</Button>
                    <Dialog open={openCreate} onOpenChange={setOpenCreate}>
                        <DialogTrigger asChild>
                            <Button className="bg-blue-600 hover:bg-blue-700">
                                <Plus className="h-4 w-4 mr-2" /> Nuevo Usuario
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-xl">
                            <DialogHeader>
                                <DialogTitle>Crear Usuario</DialogTitle>
                                <DialogDescription>Complete los datos básicos</DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleCreate} className="space-y-3">
                                <div>
                                    <Label>Nombre completo</Label>
                                    <Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} required />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label>Usuario</Label>
                                        <Input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required />
                                    </div>
                                    <div>
                                        <Label>Email</Label>
                                        <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
                                    </div>
                                </div>
                                <div>
                                    <Label>Contraseña</Label>
                                    <Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
                                    {!pwdFeedback.valid && (
                                        <ul className="mt-1 text-xs text-red-600 list-disc list-inside">
                                            {pwdFeedback.errors.map((er, i) => <li key={i}>{er}</li>)}
                                        </ul>
                                    )}
                                </div>
                                <div>
                                    <Label>Roles (coma separados)</Label>
                                    <Input
                                        value={form.roles.join(",")}
                                        onChange={(e) => setForm({ ...form, roles: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Ej: ADMIN,REGISTRAR,TEACHER,STUDENT</p>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Button type="button" variant="outline" onClick={() => setOpenCreate(false)}>Cancelar</Button>
                                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Crear</Button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="border rounded-lg overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="p-3 text-left">Nombre</th>
                                <th className="p-3 text-left">Usuario</th>
                                <th className="p-3 text-left">Email</th>
                                <th className="p-3 text-left">Roles</th>
                                <th className="p-3 text-left">Estado</th>
                                <th className="p-3 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!loading && list.map(u => (
                                <tr key={u.id} className="border-t">
                                    <td className="p-3">{u.full_name}</td>
                                    <td className="p-3">{u.username}</td>
                                    <td className="p-3">{u.email}</td>
                                    <td className="p-3">
                                        <div className="flex flex-wrap gap-1">
                                            {(u.roles || []).map(r => <Badge key={r} variant="outline">{r}</Badge>)}
                                        </div>
                                    </td>
                                    <td className="p-3">{u.is_active ? <Badge>Activo</Badge> : <Badge variant="secondary">Inactivo</Badge>}</td>
                                    <td className="p-3">
                                        <div className="flex justify-end gap-2">
                                            <Button size="sm" variant="outline" onClick={() => handleResetPass(u.id)}>
                                                <KeyRound className="h-4 w-4 mr-1" /> Reset
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={() => openEditUser(u)}>
                                                <Edit className="h-4 w-4 mr-1" /> Editar
                                            </Button>
                                            {u.is_active ? (
                                                <Button size="sm" variant="outline" onClick={() => handleDeactivate(u.id)}>
                                                    <Trash2 className="h-4 w-4 mr-1" /> Baja
                                                </Button>
                                            ) : (
                                                <Button size="sm" variant="outline" onClick={() => handleActivate(u.id)}>
                                                    Activar
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {(!loading && list.length === 0) && (
                                <tr><td className="p-4 text-center text-gray-500" colSpan={6}>Sin resultados</td></tr>
                            )}
                            {loading && (
                                <tr><td className="p-4 text-center text-gray-500" colSpan={6}>Cargando...</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <Dialog open={openEdit} onOpenChange={setOpenEdit}>
                    <DialogContent className="max-w-xl">
                        <DialogHeader>
                            <DialogTitle>Editar Usuario</DialogTitle>
                            <DialogDescription>Actualiza los datos y roles</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={submitEdit} className="space-y-3">
                            <div>
                                <Label>Nombre completo</Label>
                                <Input value={editForm.full_name} onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} required />
                            </div>
                            <div>
                                <Label>Email</Label>
                                <Input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} required />
                            </div>
                            <div>
                                <Label>Roles (coma separados)</Label>
                                <Input
                                    value={editForm.roles.join(",")}
                                    onChange={(e) =>
                                        setEditForm({
                                            ...editForm,
                                            roles: e.target.value.split(",").map(s => s.trim()).filter(Boolean),
                                        })
                                    }
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button type="button" variant="outline" onClick={() => setOpenEdit(false)}>Cancelar</Button>
                                <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Guardar</Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
};

/* ------------------------ Roles ------------------------ */
const RolesTab = () => {
    const [roles, setRoles] = useState([]);
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({ name: "", description: "" });

    const fetch = async () => {
        try {
            const data = await ACLService.listRoles();
            setRoles(data?.roles ?? data ?? []);
        } catch {
            toast.error("Error al cargar roles");
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
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" /> Roles
                </CardTitle>
                <CardDescription>Definición de roles del sistema</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex justify-between">
                    <div />
                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-blue-600 hover:bg-blue-700">
                                <Plus className="h-4 w-4 mr-2" /> Nuevo Rol
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle>Crear Rol</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={create} className="space-y-3">
                                <div>
                                    <Label>Nombre</Label>
                                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                                </div>
                                <div>
                                    <Label>Descripción</Label>
                                    <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Crear</Button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="border rounded-lg overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="p-3 text-left">Rol</th>
                                <th className="p-3 text-left">Descripción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {roles.map(r => (
                                <tr key={r.id || r.name} className="border-t">
                                    <td className="p-3 font-medium">{r.name}</td>
                                    <td className="p-3">{r.description}</td>
                                </tr>
                            ))}
                            {roles.length === 0 && (
                                <tr><td className="p-4 text-center text-gray-500" colSpan={2}>Sin roles</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
};

/* --------------------- Permisos --------------------- */
const PermissionsTab = () => {
    const [perms, setPerms] = useState([]);
    const [roles, setRoles] = useState([]);
    const [selectedRole, setSelectedRole] = useState(null);
    const [selectedPerms, setSelectedPerms] = useState(new Set());

    const load = async () => {
        try {
            const [p, r] = await Promise.all([
                ACLService.listPermissions(),
                ACLService.listRoles(),
            ]);
            const allPerms = p?.permissions ?? p ?? [];
            const allRoles = r?.roles ?? r ?? [];
            setPerms(allPerms);
            setRoles(allRoles);
            if (allRoles.length) {
                setSelectedRole(allRoles[0]);
                if (allRoles[0]?.permissions) {
                    setSelectedPerms(new Set(allRoles[0].permissions));
                }
            }
        } catch {
            toast.error("Error al cargar permisos/roles");
        }
    };
    useEffect(() => { load(); }, []);

    const toggle = (perm) => {
        const copy = new Set(selectedPerms);
        copy.has(perm) ? copy.delete(perm) : copy.add(perm);
        setSelectedPerms(copy);
    };

    const save = async () => {
        if (!selectedRole) return;
        try {
            await ACLService.setRolePermissions(selectedRole.id || selectedRole.name, Array.from(selectedPerms));
            toast.success("Permisos actualizados");
        } catch {
            toast.error("No se pudo actualizar");
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Permisos por Rol</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                    {roles.map(r => (
                        <Button
                            key={r.id || r.name}
                            variant={selectedRole && (r.id === selectedRole.id || r.name === selectedRole.name) ? "default" : "outline"}
                            onClick={() => {
                                setSelectedRole(r);
                                setSelectedPerms(new Set(r.permissions || []));
                            }}
                        >
                            {r.name}
                        </Button>
                    ))}
                </div>

                <div className="grid md:grid-cols-3 gap-2">
                    {perms.map(p => (
                        <label key={p} className="flex items-center gap-2 p-2 border rounded">
                            <input
                                type="checkbox"
                                checked={selectedPerms.has(p)}
                                onChange={() => toggle(p)}
                            />
                            <span className="text-sm">{p}</span>
                        </label>
                    ))}
                    {perms.length === 0 && <div className="text-sm text-gray-500">Sin permisos definidos</div>}
                </div>

                <div className="flex justify-end">
                    <Button onClick={save}>Guardar</Button>
                </div>
            </CardContent>
        </Card>
    );
};

export default AccessControlModule;
