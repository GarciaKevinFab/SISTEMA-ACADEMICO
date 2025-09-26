// src/services/mesaPartes.service.js
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Usa el access de tu flujo actual (y cae a "token" si existiera)
const getToken = () =>
    localStorage.getItem("access") ||
    localStorage.getItem("token") ||
    "";

const authHeaders = () => ({
    Authorization: `Bearer ${getToken()}`,
});

const jsonHeaders = { "Content-Type": "application/json" };

// Normaliza la URL para evitar dobles barras, pero sin forzar slash final
function joinApi(url) {
    return `${API}${url}`.replace(/([^:]\/)\/+/g, "$1");
}

async function http(method, url, body, { isJSON = true, isPublic = false } = {}) {
    const headers = isJSON
        ? { ...(isPublic ? {} : authHeaders()), ...jsonHeaders }
        : (isPublic ? {} : authHeaders());

    const resp = await fetch(joinApi(url), {
        method,
        headers,
        body: body ? (isJSON ? JSON.stringify(body) : body) : undefined,
    });

    if (!resp.ok) {
        let msg = "Error en la solicitud";
        try {
            const e = await resp.json();
            msg = e.detail || e.message || msg;
        } catch { }
        throw new Error(msg);
    }

    const ct = resp.headers.get("content-type") || "";
    if (ct.includes("application/json")) return resp.json();
    return resp; // blobs/stream
}

/* ===== Catálogos ===== */
export const Catalog = {
    offices: async () => {
        const d = await http("GET", "/offices");
        return Array.isArray(d?.offices) ? d.offices : (Array.isArray(d) ? d : []);
    },
    users: async (params) => {
        const q = new URLSearchParams(params || {}).toString();
        const d = await http("GET", `/users${q ? `?${q}` : ""}`);
        return Array.isArray(d?.users) ? d.users : (Array.isArray(d) ? d : []);
    },
};

/* ===== Tipos de trámite ===== */
export const ProcedureTypes = {
    list: () => http("GET", "/procedure-types"),
    create: (payload) => http("POST", "/procedure-types", payload),
    update: (id, payload) => http("PUT", `/procedure-types/${id}`, payload),
    toggle: (id, is_active) => http("PATCH", `/procedure-types/${id}`, { is_active }),
};

/* ===== Trámites ===== */
export const Procedures = {
    list: (params) => {
        const q = new URLSearchParams(params || {}).toString();
        return http("GET", `/procedures${q ? `?${q}` : ""}`);
    },
    create: (payload) => http("POST", "/procedures", payload),
    get: (id) => http("GET", `/procedures/${id}`),
    getByCode: (code) => http("GET", `/procedures/code/${encodeURIComponent(code)}`),

    // Derivación / asignación
    route: (id, { to_office_id, assignee_id, note, deadline_at }) =>
        http("POST", `/procedures/${id}/route`, { to_office_id, assignee_id, note, deadline_at }),

    // Cambio de estado
    setStatus: (id, { status, note }) =>
        http("POST", `/procedures/${id}/status`, { status, note }),

    // Trazabilidad / notas
    timeline: (id) => http("GET", `/procedures/${id}/timeline`),
    addNote: (id, { note }) => http("POST", `/procedures/${id}/notes`, { note }),

    // PDFs (coinciden con tus @action: cover y cargo)
    coverPDF: (id) => http("POST", `/procedures/${id}/cover`, {}),
    cargoPDF: (id) => http("POST", `/procedures/${id}/cargo`, {}),
};

/* ===== Público ===== */
export const PublicProcedures = {
    track: (code) =>
        http(
            "GET",
            `/public/procedures/track?code=${encodeURIComponent(code)}`,
            null,
            { isJSON: true, isPublic: true }
        ),
};

/* ===== Archivos de trámite ===== */
export const ProcedureFiles = {
    list: (id) => http("GET", `/procedures/${id}/files`),
    upload: (id, file, meta = {}) => {
        const fd = new FormData();
        fd.append("file", file);
        if (meta.doc_type) fd.append("doc_type", meta.doc_type);
        if (meta.description) fd.append("description", meta.description);
        return http("POST", `/procedures/${id}/files`, fd, { isJSON: false });
    },
    remove: (id, fileId) => http("DELETE", `/procedures/${id}/files/${fileId}`),
};

/* ===== Recepción pública (ciudadano) ===== */
export const PublicIntake = {
    create: (payload) =>
        http("POST", `/public/procedures`, payload, { isJSON: true, isPublic: true }),
    uploadFile: (trackingCode, file, meta = {}) => {
        const fd = new FormData();
        fd.append("file", file);
        if (meta.doc_type) fd.append("doc_type", meta.doc_type);
        if (meta.description) fd.append("description", meta.description);
        return http(
            "POST",
            `/public/procedures/${encodeURIComponent(trackingCode)}/files`,
            fd,
            { isJSON: false, isPublic: true }
        );
    },
};

/* ===== Reportes (SLA/volúmenes) ===== */
export const ProcedureReports = {
    summary: (params = {}) => {
        const q = new URLSearchParams(params).toString();
        return http("GET", `/procedures/reports/summary${q ? `?${q}` : ""}`);
    },
    exportSLA: (params = {}) => {
        const q = new URLSearchParams(params).toString();
        return http("GET", `/procedures/reports/sla.xlsx${q ? `?${q}` : ""}`);
    },
    exportVolume: (params = {}) => {
        const q = new URLSearchParams(params).toString();
        return http("GET", `/procedures/reports/volume.xlsx${q ? `?${q}` : ""}`);
    },
};
