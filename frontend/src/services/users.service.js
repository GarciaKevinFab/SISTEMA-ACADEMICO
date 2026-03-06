// src/services/users.service.js
import api from "../lib/api";

export const UsersService = {
    // ---------- Users ----------
    list: (params) => api.get("/users", { params }).then((r) => r.data),

    create: (payload) => api.post("/users", payload).then((r) => r.data),

    update: (id, payload) => api.patch(`/users/${id}`, payload).then((r) => r.data),

    // ✅ FIX: DELETE suele devolver 204 No Content (sin body)
    delete: async (id) => {
        await api.delete(`/users/${id}`);
        return true;
    },

    deactivate: (id) => api.post(`/users/${id}/deactivate`).then((r) => r.data),

    activate: (id) => api.post(`/users/${id}/activate`).then((r) => r.data),

    resetPassword: (id) => api.post(`/users/${id}/reset-password`).then((r) => r.data),

    assignRoles: (id, roles) => api.post(`/users/${id}/roles`, { roles }).then((r) => r.data),

    setPassword: (id, payload) => api.post(`/users/${id}/set-password`, payload).then((r) => r.data),

    // purge: (payload) => api.post("/users/purge", payload).then((r) => r.data),
    purge: (payload) => api.post("/users/purge", payload).then((r) => r.data),

    changeMyPassword: (payload) => api.post("/auth/change-password", payload).then((r) => r.data),
};
