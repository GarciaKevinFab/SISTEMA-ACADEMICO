// src/services/minedu.service.js
import api from "../lib/api";

// baseURL ya es: http://127.0.0.1:8000/api
// así que MINEDU vive en: /minedu/...

const unwrap = (res) => res?.data;

export const Stats = {
    dashboard: async () => unwrap(await api.get("/minedu/dashboard/stats")),
};

export const Exports = {
    enqueueEnrollments: async (payload) =>
        unwrap(await api.post("/minedu/export/enrollments", payload)),

    enqueueGrades: async (payload) =>
        unwrap(await api.post("/minedu/export/grades", payload)),

    list: async () => unwrap(await api.get("/minedu/exports")),

    retry: async (exportId) =>
        unwrap(await api.post(`/minedu/exports/${exportId}/retry`)),
};

export const Validation = {
    integrity: async () => unwrap(await api.get("/minedu/validation/data-integrity")),
};

export const Catalog = {
    remote: async (type) =>
        unwrap(await api.get("/minedu/catalogs/remote", { params: { type } })),

    local: async (type, params = {}) =>
        unwrap(await api.get("/minedu/catalogs/local", { params: { type, ...params } })),
};

export const Mapping = {
    list: async (type) =>
        unwrap(await api.get("/minedu/mappings", { params: { type } })),

    saveBulk: async (type, mappings) =>
        unwrap(await api.post("/minedu/mappings/bulk", { type, mappings })),
};

export const Jobs = {
    list: async () => unwrap(await api.get("/minedu/jobs")),

    create: async (payload) => unwrap(await api.post("/minedu/jobs", payload)),

    update: async (id, payload) =>
        unwrap(await api.patch(`/minedu/jobs/${id}`, payload)),

    runNow: async (id) => unwrap(await api.post(`/minedu/jobs/${id}/run`)),

    pause: async (id) => unwrap(await api.post(`/minedu/jobs/${id}/pause`)),

    resume: async (id) => unwrap(await api.post(`/minedu/jobs/${id}/resume`)),

    runs: async (id) => unwrap(await api.get(`/minedu/jobs/${id}/runs`)),

    retryRun: async (runId) =>
        unwrap(await api.post(`/minedu/jobs/runs/${runId}/retry`)),
};

export const Logs = {
    forRun: async (runId) => unwrap(await api.get(`/minedu/jobs/runs/${runId}/logs`)),
};
