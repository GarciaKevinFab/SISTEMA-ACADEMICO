// src/services/acl.service.js
import { api } from "../lib/api";

export const ACLService = {
    // Roles
    listRoles: () => api.get("/roles").then(r => r.data),
    createRole: (payload) => api.post("/roles", payload).then(r => r.data),
    updateRole: (id, payload) => api.put(`/roles/${id}`, payload).then(r => r.data),
    deleteRole: (id) => api.delete(`/roles/${id}`).then(r => r.data),

    // Permisos
    listPermissions: () => api.get("/permissions").then(r => r.data),
    setRolePermissions: (roleId, permissions) =>
        api.post(`/roles/${roleId}/permissions`, { permissions }).then(r => r.data),
};
