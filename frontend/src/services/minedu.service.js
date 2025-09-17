// src/services/minedu.service.js
// Servicio simple con fetch + token para endpoints MINEDU.
// Ajusta paths si tu backend usa otros.

const BASE = process.env.REACT_APP_BACKEND_URL || "";
const API = `${BASE}/api/minedu`;

function authHeaders(extra = {}) {
    const t = localStorage.getItem("token");
    const h = { "Content-Type": "application/json", ...extra };
    if (t) h["Authorization"] = `Bearer ${t}`;
    return h;
}

async function http(method, path, body, { headers = {}, qs } = {}) {
    const url = new URL(`${API}${path}`);
    if (qs && typeof qs === "object") Object.entries(qs).forEach(([k, v]) => (v !== undefined && v !== null) && url.searchParams.append(k, v));
    const res = await fetch(url.toString(), {
        method,
        headers: authHeaders(headers),
        body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch (_) { /* no json */ }
    if (!res.ok) {
        const msg = data?.detail || data?.message || `${res.status} ${res.statusText}`;
        const err = new Error(msg);
        err.response = { status: res.status, data };
        throw err;
    }
    return data;
}

/* ---------- Stats / Dashboard ---------- */
export const Stats = {
    dashboard: () => http("GET", "/dashboard/stats"),
};

/* ---------- Exports ---------- */
export const Exports = {
    enqueueEnrollments: (payload) => http("POST", "/export/enrollments", payload),
    enqueueGrades: (payload) => http("POST", "/export/grades", payload),
    list: () => http("GET", "/exports"),
    retry: (exportId) => http("POST", `/exports/${exportId}/retry`),
};

/* ---------- Validation ---------- */
export const Validation = {
    integrity: () => http("GET", "/validation/data-integrity"),
};

/* ---------- Catalogs (remote MINEDU & locales) ---------- */
export const Catalog = {
    remote: (type) => http("GET", "/catalogs/remote", null, { qs: { type } }),
    local: (type, params = {}) => http("GET", "/catalogs/local", null, { qs: { type, ...params } }),
};

/* ---------- Mapping ---------- */
export const Mapping = {
    list: (type) => http("GET", "/mappings", null, { qs: { type } }),
    saveBulk: (type, mappings) => http("POST", "/mappings/bulk", { type, mappings }),
};

/* ---------- Jobs ---------- */
export const Jobs = {
    list: () => http("GET", "/jobs"),
    create: (payload) => http("POST", "/jobs", payload),              // {type, cron, enabled}
    update: (id, payload) => http("PATCH", `/jobs/${id}`, payload),
    runNow: (id) => http("POST", `/jobs/${id}/run`),
    pause: (id) => http("POST", `/jobs/${id}/pause`),
    resume: (id) => http("POST", `/jobs/${id}/resume`),
    runs: (id) => http("GET", `/jobs/${id}/runs`),
    retryRun: (runId) => http("POST", `/jobs/runs/${runId}/retry`),
};

/* ---------- Logs ---------- */
export const Logs = {
    forRun: (runId) => http("GET", `/jobs/runs/${runId}/logs`), // [{id,timestamp,level,message,meta}]
};
