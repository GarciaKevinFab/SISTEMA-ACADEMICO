// Servicio de Investigación: proyectos, cronograma, productos, evaluación, reportes.

import api from "../lib/api";

const PREFIX = "/research";

// Helper axios
function request(method, path, { params, data, headers } = {}) {
    const clean = String(path || "").replace(/^\/*/, "");
    return api
        .request({ url: `${PREFIX}/${clean}`, method, params, data, headers })
        .then((r) => r.data);
}

// Normaliza payloads para DRF (evita 500 por FKs o fechas)
function normalizeProjectPayload(p = {}) {
    const out = { ...p };
    if ("line_id" in out) { out.line = out.line_id; delete out.line_id; }
    if (out.start_date) out.start_date = String(out.start_date).slice(0, 10);
    if (out.end_date) out.end_date = String(out.end_date).slice(0, 10);
    // Si manejas asesores M2M en tu UI:
    if (Array.isArray(out.advisors)) out.advisors = out.advisors.map(Number);
    return out;
}


/* --------- Catálogos --------- */
export const Catalog = {
    lines: () => request("GET", "catalog/lines"),
    advisors: () => request("GET", "catalog/advisors"),

    createLine: (payload) => request("POST", "catalog/lines", { data: payload }),
    updateLine: (id, payload) =>
        request("PATCH", `catalog/lines/${id}`, { data: payload }),
    removeLine: (id) => request("DELETE", `catalog/lines/${id}`),

    createAdvisor: (payload) =>
        request("POST", "catalog/advisors", { data: payload }),
    updateAdvisor: (id, payload) =>
        request("PATCH", `catalog/advisors/${id}`, { data: payload }),
    removeAdvisor: (id) => request("DELETE", `catalog/advisors/${id}`),
};

/* --------- Proyectos --------- */
export const Projects = {
    list: (params) => request("GET", "projects", { params }),
    get: (id) => request("GET", `projects/${id}`),
    create: (payload) =>
        request("POST", "projects", { data: normalizeProjectPayload(payload) }),
    update: (id, payload) =>
        request("PATCH", `projects/${id}`, { data: normalizeProjectPayload(payload) }),
    remove: (id) => request("DELETE", `projects/${id}`),
    changeStatus: (id, status) =>
        request("POST", `projects/${id}/status`, { data: { status } }),
};

/* --------- Cronograma --------- */
export const Schedule = {
    list: (projectId) => request("GET", `projects/${projectId}/schedule`),
    saveBulk: (projectId, items) =>
        request("POST", `projects/${projectId}/schedule/bulk`, { data: { items } }),
};

/* --------- Entregables --------- */
export const Deliverables = {
    list: (projectId) => request("GET", `projects/${projectId}/deliverables`),
    create: (projectId, payload) =>
        request("POST", `projects/${projectId}/deliverables`, { data: payload }),
    update: (deliverableId, payload) =>
        request("PATCH", `deliverables/${deliverableId}`, { data: payload }),
};

/* --------- Evaluaciones --------- */
export const Evaluations = {
    list: (projectId) => request("GET", `projects/${projectId}/evaluations`),
    save: (projectId, payload) =>
        request("POST", `projects/${projectId}/evaluations`, { data: payload }),
};

/* --------- Reportes --------- */
export const Reports = {
    summary: ({ year, status } = {}) =>
        request("GET", "reports/summary", { params: { year, status } }),
    exportSummary: ({ year, status } = {}) =>
        request("POST", "reports/summary/export", { data: { year, status } }),
};

/* --------- Equipo --------- */
export const Team = {
    list: (projectId) => request("GET", `projects/${projectId}/team`),
    add: (projectId, payload) =>
        request("POST", `projects/${projectId}/team`, { data: payload }),
    update: (projectId, memberId, payload) =>
        request("PATCH", `projects/${projectId}/team/${memberId}`, { data: payload }),
    remove: (projectId, memberId) =>
        request("DELETE", `projects/${projectId}/team/${memberId}`),
};

/* --------- Presupuesto --------- */
export const Budget = {
    list: (projectId) => request("GET", `projects/${projectId}/budget`),
    createItem: (projectId, payload) =>
        request("POST", `projects/${projectId}/budget/items`, { data: payload }),
    updateItem: (projectId, itemId, payload) =>
        request("PATCH", `projects/${projectId}/budget/items/${itemId}`, {
            data: payload,
        }),
    removeItem: (projectId, itemId) =>
        request("DELETE", `projects/${projectId}/budget/items/${itemId}`),

    uploadReceipt: async (projectId, itemId, file) => {
        const fd = new FormData();
        fd.append("file", file);
        const { data } = await api.post(
            `${PREFIX}/projects/${projectId}/budget/items/${itemId}/receipt`,
            fd,
            { headers: { "Content-Type": "multipart/form-data" } }
        );
        return data;
    },

    exportXlsx: (projectId, params = {}) =>
        request("GET", `projects/${projectId}/budget/export`, { params }),
};

/* --------- Ética & Propiedad Intelectual --------- */
export const EthicsIP = {
    get: (projectId) => request("GET", `projects/${projectId}/ethics-ip`),
    setEthics: (projectId, payload) =>
        request("PUT", `projects/${projectId}/ethics`, { data: payload }),
    uploadEthicsDoc: async (projectId, file) => {
        const fd = new FormData();
        fd.append("file", file);
        const { data } = await api.post(
            `${PREFIX}/projects/${projectId}/ethics/doc`,
            fd,
            { headers: { "Content-Type": "multipart/form-data" } }
        );
        return data;
    },
    setIP: (projectId, payload) =>
        request("PUT", `projects/${projectId}/ip`, { data: payload }),
    uploadIPDoc: async (projectId, file) => {
        const fd = new FormData();
        fd.append("file", file);
        const { data } = await api.post(
            `${PREFIX}/projects/${projectId}/ip/doc`,
            fd,
            { headers: { "Content-Type": "multipart/form-data" } }
        );
        return data;
    },
};

/* --------- Publicaciones --------- */
export const Publications = {
    list: (projectId) => request("GET", `projects/${projectId}/publications`),
    create: (projectId, payload) =>
        request("POST", `projects/${projectId}/publications`, { data: payload }),
    update: (projectId, pubId, payload) =>
        request("PATCH", `projects/${projectId}/publications/${pubId}`, {
            data: payload,
        }),
    remove: (projectId, pubId) =>
        request("DELETE", `projects/${projectId}/publications/${pubId}`),
};

/* --------- Convocatorias / Revisión --------- */
export const Calls = {
    list: (params) => request("GET", `calls`, { params }),
    create: (payload) => request("POST", `calls`, { data: payload }),
    update: (id, payload) => request("PATCH", `calls/${id}`, { data: payload }),
    remove: (id) => request("DELETE", `calls/${id}`),
};

export const Proposals = {
    list: (callId) => request("GET", `calls/${callId}/proposals`),
    create: (callId, payload) =>
        request("POST", `calls/${callId}/proposals`, { data: payload }),
    submit: (callId, proposalId) =>
        request("POST", `calls/${callId}/proposals/${proposalId}/submit`),
};

export const Reviews = {
    assign: (callId, proposalId, reviewerId) =>
        request("POST", `calls/${callId}/proposals/${proposalId}/assign`, {
            data: { reviewer_id: reviewerId },
        }),
    rubric: (callId, proposalId) =>
        request("GET", `calls/${callId}/proposals/${proposalId}/rubric`),
    save: (callId, proposalId, payload) =>
        request("POST", `calls/${callId}/proposals/${proposalId}/review`, {
            data: payload,
        }),
    ranking: (callId) => request("GET", `calls/${callId}/ranking`),
    exportResults: (callId) => request("GET", `calls/${callId}/ranking/export`),
};
