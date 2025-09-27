import api from "../lib/api"; // <- default import

export const ACLService = {
    /* --------- Roles --------- */
    listRoles: () => api.get("/acl/roles").then((r) => r.data),
    createRole: (payload) => api.post("/acl/roles", payload).then((r) => r.data),
    updateRole: (idOrName, payload) =>
        api.put(`/acl/roles/${idOrName}`, payload).then((r) => r.data),
    deleteRole: (idOrName) =>
        api.delete(`/acl/roles/${idOrName}`).then((r) => r.data),

    /* --------- Permisos --------- */
    // Siempre devolver array de strings
    listPermissions: () =>
        api.get("/acl/permissions").then((r) => {
            const data = r.data;
            const list = Array.isArray(data?.permissions)
                ? data.permissions
                : Array.isArray(data)
                    ? data
                    : [];
            return list
                .map((p) => (typeof p === "string" ? p : p?.code))
                .filter(Boolean);
        }),

    setRolePermissions: (idOrName, permissions) =>
        api
            .post(`/acl/roles/${idOrName}/permissions`, { permissions })
            .then((r) => r.data),

    /* --------- Aux opcional --------- */
    getRolePermissions: (idOrName) =>
        api.get(`/acl/roles/${idOrName}/permissions`).then((r) => r.data),

    assignUserRoles: (userId, roles) =>
        api.post(`/users/${userId}/roles`, { roles }).then((r) => r.data),
};
