// src/services/users.service.js
import { api } from "../lib/api";

export const UsersService = {
    list: (params = {}) => api.get("/users", { params }).then(r => r.data),
    get: (id) => api.get(`/users/${id}`).then(r => r.data),
    create: (payload) => api.post("/users", payload).then(r => r.data),
    update: (id, payload) => api.put(`/users/${id}`, payload).then(r => r.data),
    deactivate: (id) => api.post(`/users/${id}/deactivate`).then(r => r.data),
    activate: (id) => api.post(`/users/${id}/activate`).then(r => r.data),
    resetPassword: (id) => api.post(`/users/${id}/reset-password`).then(r => r.data),
    assignRoles: (id, roles) => api.post(`/users/${id}/roles`, { roles }).then(r => r.data),
    search: (q) => api.get("/users/search", { params: { q } }).then(r => r.data),
};
