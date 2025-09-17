// src/services/portal.service.js
// Servicio del Portal Institucional (CMS + formularios + bandeja).
const BASE = process.env.REACT_APP_BACKEND_URL || "http://localhost:8001";
const API = `${BASE}/api`;

function authHeaders(extra = {}) {
    const t = localStorage.getItem("token");
    const h = { ...extra };
    if (t) h["Authorization"] = `Bearer ${t}`;
    return h;
}

async function http(method, path, { qs, body, headers, isFormData } = {}) {
    const url = new URL(`${API}${path}`);
    if (qs) {
        Object.entries(qs).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== "") url.searchParams.append(k, v);
        });
    }
    const res = await fetch(url.toString(), {
        method,
        headers: isFormData ? authHeaders(headers) : authHeaders({ "Content-Type": "application/json", ...headers }),
        body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch { }
    if (!res.ok) {
        const msg = data?.detail || data?.message || `${res.status} ${res.statusText}`;
        const err = new Error(msg);
        err.response = { status: res.status, data };
        throw err;
    }
    return data;
}

// --------- Páginas (CMS) ---------
export const Pages = {
    list: (params) => http("GET", "/portal/pages", { qs: params }),
    getBySlug: (slug) => http("GET", `/portal/pages/${encodeURIComponent(slug)}`),
    create: (payload) => http("POST", "/portal/pages", { body: payload }),
    update: (id, payload) => http("PATCH", `/portal/pages/${id}`, { body: payload }),
    remove: (id) => http("DELETE", `/portal/pages/${id}`),
    publish: (id, is_published) => http("POST", `/portal/pages/${id}/publish`, { body: { is_published } }),
};

// --------- Noticias (CMS) ---------
export const News = {
    publicList: (params) => http("GET", "/portal/news", { qs: { published: true, ...params } }),
    list: (params) => http("GET", "/portal/news", { qs: params }),
    create: (payload) => http("POST", "/portal/news", { body: payload }),
    update: (id, payload) => http("PATCH", `/portal/news/${id}`, { body: payload }),
    remove: (id) => http("DELETE", `/portal/news/${id}`),
    publish: (id, published) => http("POST", `/portal/news/${id}/publish`, { body: { published } }),
};

// --------- Documentos (CMS) ---------
export const Documents = {
    list: (params) => http("GET", "/portal/documents", { qs: params }),
    upload: (payload) => {
        const fd = new FormData();
        Object.entries(payload).forEach(([k, v]) => fd.append(k, v));
        return http("POST", "/portal/documents", { body: fd, isFormData: true });
    },
    update: (id, payload) => http("PATCH", `/portal/documents/${id}`, { body: payload }),
    remove: (id) => http("DELETE", `/portal/documents/${id}`),
    publish: (id, published) => http("POST", `/portal/documents/${id}/publish`, { body: { published } }),
};

// --------- Formularios públicos ---------
export const PublicForms = {
    contact: (payload) => http("POST", "/public/contact", { body: payload }),
    preinscription: (payload) => http("POST", "/public/preinscriptions", { body: payload }),
};

// --------- Bandeja de contenidos ---------
export const Inbox = {
    list: (params) => http("GET", "/portal/inbox", { qs: params }), // type: CONTACT | PREINSCRIPTION
    get: (id) => http("GET", `/portal/inbox/${id}`),
    setStatus: (id, status) => http("POST", `/portal/inbox/${id}/status`, { body: { status } }), // NEW | REVIEWED | ARCHIVED
};
