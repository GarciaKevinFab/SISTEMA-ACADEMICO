// src/services/research.service.js
// Servicio de Investigación: proyectos, cronograma, productos, evaluación, reportes.
// Ajusta BASE si tu backend usa otro prefijo.

const BASE = process.env.REACT_APP_BACKEND_URL || "";
const API = `${BASE}/api/research`;

function headers(extra = {}) {
    const t = localStorage.getItem("token");
    const h = { "Content-Type": "application/json", ...extra };
    if (t) h["Authorization"] = `Bearer ${t}`;
    return h;
}

async function http(method, path, body, { qs, hdrs } = {}) {
    const url = new URL(`${API}${path}`);
    if (qs && typeof qs === "object") {
        for (const [k, v] of Object.entries(qs)) {
            if (v !== undefined && v !== null && v !== "") url.searchParams.append(k, v);
        }
    }
    const res = await fetch(url.toString(), {
        method,
        headers: headers(hdrs),
        body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch (_) { }
    if (!res.ok) {
        const msg = data?.detail || data?.message || `${res.status} ${res.statusText}`;
        const err = new Error(msg);
        err.response = { status: res.status, data };
        throw err;
    }
    return data;
}

/* --------- Catálogos --------- */
export const Catalog = {
    lines: () => http("GET", "/catalog/lines"),
    advisors: () => http("GET", "/catalog/advisors"),
};

/* --------- Proyectos --------- */
export const Projects = {
    list: (params) => http("GET", "/projects", null, { qs: params }),
    get: (id) => http("GET", `/projects/${id}`),
    create: (payload) => http("POST", "/projects", payload),
    update: (id, payload) => http("PATCH", `/projects/${id}`, payload),
    remove: (id) => http("DELETE", `/projects/${id}`),
    changeStatus: (id, status) => http("POST", `/projects/${id}/status`, { status }),
};

/* --------- Cronograma --------- */
export const Schedule = {
    list: (projectId) => http("GET", `/projects/${projectId}/schedule`),
    saveBulk: (projectId, items) =>
        http("POST", `/projects/${projectId}/schedule/bulk`, { items }),
};

/* --------- Entregables --------- */
export const Deliverables = {
    list: (projectId) => http("GET", `/projects/${projectId}/deliverables`),
    create: (projectId, payload) =>
        http("POST", `/projects/${projectId}/deliverables`, payload),
    update: (deliverableId, payload) =>
        http("PATCH", `/deliverables/${deliverableId}`, payload),
};

/* --------- Evaluaciones --------- */
export const Evaluations = {
    list: (projectId) => http("GET", `/projects/${projectId}/evaluations`),
    save: (projectId, payload) =>
        http("POST", `/projects/${projectId}/evaluations`, payload),
};

/* --------- Reportes --------- */
export const Reports = {
    summary: ({ year, status } = {}) =>
        http("GET", "/reports/summary", null, { qs: { year, status } }),
    // Export PDF se hace vía utils/pdfQrPolling a /research/reports/summary/export
};

/* --------- Equipo de Proyecto --------- */
export const Team = {
    list: (projectId) => http("GET", `/projects/${projectId}/team`),
    add: (projectId, payload) => http("POST", `/projects/${projectId}/team`, payload), // { full_name, role, dedication_pct, email, orcid }
    update: (projectId, memberId, payload) => http("PATCH", `/projects/${projectId}/team/${memberId}`, payload),
    remove: (projectId, memberId) => http("DELETE", `/projects/${projectId}/team/${memberId}`),
};

/* --------- Presupuesto & Ejecución --------- */
export const Budget = {
    list: (projectId) => http("GET", `/projects/${projectId}/budget`), // items + summary
    createItem: (projectId, payload) => http("POST", `/projects/${projectId}/budget/items`, payload),
    updateItem: (projectId, itemId, payload) => http("PATCH", `/projects/${projectId}/budget/items/${itemId}`, payload),
    removeItem: (projectId, itemId) => http("DELETE", `/projects/${projectId}/budget/items/${itemId}`),
    uploadReceipt: async (projectId, itemId, file) => {
        const fd = new FormData(); fd.append("file", file);
        const url = new URL(`${API}/projects/${projectId}/budget/items/${itemId}/receipt`);
        const res = await fetch(url.toString(), { method: "POST", headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` }, body: fd });
        const data = await res.json().catch(() => null);
        if (!res.ok) { const msg = data?.detail || res.statusText; const err = new Error(msg); err.response = { status: res.status, data }; throw err; }
        return data;
    },
    exportXlsx: (projectId, qs = {}) => http("GET", `/projects/${projectId}/budget/export`, null, { qs }), // devuelve blob en tu backend
};

/* --------- Ética & Propiedad Intelectual --------- */
export const EthicsIP = {
    get: (projectId) => http("GET", `/projects/${projectId}/ethics-ip`),
    setEthics: (projectId, payload) => http("PUT", `/projects/${projectId}/ethics`, payload), // { status, committee, approval_code, approval_date }
    uploadEthicsDoc: async (projectId, file) => {
        const fd = new FormData(); fd.append("file", file);
        const url = new URL(`${API}/projects/${projectId}/ethics/doc`);
        const res = await fetch(url.toString(), { method: "POST", headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` }, body: fd });
        const data = await res.json().catch(() => null);
        if (!res.ok) { const msg = data?.detail || res.statusText; const err = new Error(msg); err.response = { status: res.status, data }; throw err; }
        return data;
    },
    setIP: (projectId, payload) => http("PUT", `/projects/${projectId}/ip`, payload), // { status, type, registry_code, holder }
    uploadIPDoc: async (projectId, file) => {
        const fd = new FormData(); fd.append("file", file);
        const url = new URL(`${API}/projects/${projectId}/ip/doc`);
        const res = await fetch(url.toString(), { method: "POST", headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` }, body: fd });
        const data = await res.json().catch(() => null);
        if (!res.ok) { const msg = data?.detail || res.statusText; const err = new Error(msg); err.response = { status: res.status, data }; throw err; }
        return data;
    },
};

/* --------- Publicaciones / Productos científicos --------- */
export const Publications = {
    list: (projectId) => http("GET", `/projects/${projectId}/publications`),
    create: (projectId, payload) => http("POST", `/projects/${projectId}/publications`, payload), // { type, title, journal, year, doi, link, indexed }
    update: (projectId, pubId, payload) => http("PATCH", `/projects/${projectId}/publications/${pubId}`, payload),
    remove: (projectId, pubId) => http("DELETE", `/projects/${projectId}/publications/${pubId}`),
};

/* --------- Convocatorias / Postulaciones / Revisión --------- */
export const Calls = {
    list: (qs) => http("GET", `/calls`, null, { qs }),
    create: (payload) => http("POST", `/calls`, payload), // { code, title, start_date, end_date, budget_cap, description }
    update: (id, payload) => http("PATCH", `/calls/${id}`, payload),
    remove: (id) => http("DELETE", `/calls/${id}`),
};

export const Proposals = {
    list: (callId) => http("GET", `/calls/${callId}/proposals`),
    create: (callId, payload) => http("POST", `/calls/${callId}/proposals`, payload), // { title, line_id, team, summary, budget }
    submit: (callId, proposalId) => http("POST", `/calls/${callId}/proposals/${proposalId}/submit`),
};

export const Reviews = {
    assign: (callId, proposalId, reviewerId) => http("POST", `/calls/${callId}/proposals/${proposalId}/assign`, { reviewer_id: reviewerId }),
    rubric: (callId, proposalId) => http("GET", `/calls/${callId}/proposals/${proposalId}/rubric`),
    save: (callId, proposalId, payload) => http("POST", `/calls/${callId}/proposals/${proposalId}/review`, payload), // { scores, comment, total }
    ranking: (callId) => http("GET", `/calls/${callId}/ranking`),
    exportResults: (callId) => http("GET", `/calls/${callId}/ranking/export`),
};
