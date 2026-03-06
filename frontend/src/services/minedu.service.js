// src/services/minedu.service.js
import api from "../lib/api";

const unwrap = (res) => res?.data;

/* ── Dashboard ── */
export const Stats = {
    dashboard: async () => unwrap(await api.get("/minedu/dashboard/stats")),
};

/* ── Exportaciones ── */
export const Exports = {
    /**
     * Genera exportación.
     * @param {{ data_type: string, export_format: string, academic_year: number, academic_period: string }} payload
     * data_type: ENROLLMENT | FICHA | BOLETA | ACTA | REPORTE | REGISTRO_AUX | CERTIFICADO
     * export_format: XLSX | CSV
     */
    generate: async (payload) =>
        unwrap(await api.post("/minedu/export/generate", payload)),

    list: async () => unwrap(await api.get("/minedu/exports")),

    retry: async (exportId) =>
        unwrap(await api.post(`/minedu/exports/${exportId}/retry`)),

    /** URL directa de descarga (para <a href>) */
    downloadUrl: (exportId) =>
        `${api.defaults.baseURL}/minedu/exports/${exportId}/download`,
};

/* ── Validación ── */
export const Validation = {
    integrity: async () =>
        unwrap(await api.get("/minedu/validation/data-integrity")),
};

/* ── Códigos MINEDU (admin los registra) ── */
export const Codes = {
    list: async (type) =>
        unwrap(await api.get("/minedu/codes", { params: { type } })),

    create: async (payload) =>
        unwrap(await api.post("/minedu/codes", payload)),

    delete: async (id) =>
        unwrap(await api.delete(`/minedu/codes/${id}`)),
};

/* ── Catálogos ── */
export const Catalog = {
    /** Códigos MINEDU registrados (lee de MineduCode) */
    remote: async (type) =>
        unwrap(await api.get("/minedu/catalogs/remote", { params: { type } })),

    /** Registros locales reales (Career, Plan, Student...) */
    local: async (type, params = {}) =>
        unwrap(
            await api.get("/minedu/catalogs/local", { params: { type, ...params } })
        ),
};

/* ── Mapeos ── */
export const Mapping = {
    list: async (type) =>
        unwrap(await api.get("/minedu/mappings", { params: { type } })),

    saveBulk: async (type, mappings) =>
        unwrap(await api.post("/minedu/mappings/bulk", { type, mappings })),
};

/* ── Jobs programados ── */
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

/* ── Logs ── */
export const Logs = {
    forRun: async (runId) =>
        unwrap(await api.get(`/minedu/jobs/runs/${runId}/logs`)),
};