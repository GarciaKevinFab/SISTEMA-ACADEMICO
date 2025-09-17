// src/services/catalogs.service.js
const BASE = process.env.REACT_APP_BACKEND_URL || "http://localhost:8001";
const API = `${BASE}/api`;

function authHeaders(extra = {}) {
    const token = localStorage.getItem("token");
    const h = { ...extra };
    if (token) h["Authorization"] = `Bearer ${token}`;
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
        headers: isFormData
            ? authHeaders(headers)
            : authHeaders({ "Content-Type": "application/json", ...headers }),
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

// ------------------ Catálogos ------------------
export const Periods = {
    list: (params) => http("GET", "/catalogs/periods", { qs: params }),
    create: (payload) => http("POST", "/catalogs/periods", { body: payload }),
    update: (id, payload) => http("PATCH", `/catalogs/periods/${id}`, { body: payload }),
    remove: (id) => http("DELETE", `/catalogs/periods/${id}`),
    setActive: (id, is_active) => http("POST", `/catalogs/periods/${id}/active`, { body: { is_active } }),
};

export const Campuses = {
    list: () => http("GET", "/catalogs/campuses"),
    create: (payload) => http("POST", "/catalogs/campuses", { body: payload }),
    update: (id, payload) => http("PATCH", `/catalogs/campuses/${id}`, { body: payload }),
    remove: (id) => http("DELETE", `/catalogs/campuses/${id}`),
};

export const Classrooms = {
    list: (params) => http("GET", "/catalogs/classrooms", { qs: params }), // admite campus_id
    create: (payload) => http("POST", "/catalogs/classrooms", { body: payload }),
    update: (id, payload) => http("PATCH", `/catalogs/classrooms/${id}`, { body: payload }),
    remove: (id) => http("DELETE", `/catalogs/classrooms/${id}`),
};

export const Teachers = {
    list: (params) => http("GET", "/catalogs/teachers", { qs: params }),
    create: (payload) => http("POST", "/catalogs/teachers", { body: payload }),
    update: (id, payload) => http("PATCH", `/catalogs/teachers/${id}`, { body: payload }),
    remove: (id) => http("DELETE", `/catalogs/teachers/${id}`),
};

// ------------------ Ubigeo ------------------
export const Ubigeo = {
    search: (q) => http("GET", "/ubigeo/search", { qs: { q } }),
    deps: () => http("GET", "/ubigeo/departments"),
    provs: (dep) => http("GET", "/ubigeo/provinces", { qs: { department: dep } }),
    dists: (dep, prov) => http("GET", "/ubigeo/districts", { qs: { department: dep, province: prov } }),
};

// ------------------ Parámetros institución ------------------
export const Institution = {
    getSettings: () => http("GET", "/institution/settings"),
    updateSettings: (payload) => http("PATCH", "/institution/settings", { body: payload }),
    uploadMedia: async (kind, file) => {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("kind", kind); // LOGO|LOGO_ALT|SIGNATURE
        return http("POST", "/institution/media", { body: fd, isFormData: true });
    },
};

// ------------------ Importadores ------------------
export const Imports = {
    template: (type) => `${API}/imports/templates/${type}`, // descarga directa
    start: async (type, file, mapping) => {
        const fd = new FormData();
        fd.append("file", file);
        if (mapping) fd.append("mapping", JSON.stringify(mapping));
        return http("POST", `/imports/${type}`, { body: fd, isFormData: true });
    },
    status: (jobId) => http("GET", `/imports/status/${jobId}`),
};

// ------------------ Respaldo/Export ------------------
export const Backup = {
    list: () => http("GET", "/exports/backups"),
    create: (scope = "FULL") => http("POST", "/exports/backups", { body: { scope } }),
    downloadUrl: (id) => `${API}/exports/backups/${id}/download`,
    exportDataset: (dataset) => http("POST", "/exports/dataset", { body: { dataset } }), // STUDENTS|COURSES|GRADES|CATALOGS
};
