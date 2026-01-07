// src/services/mesaPartes.service.js
import axios from "axios";
import api from "../lib/api";
import { API_BASE } from "../utils/config";

/* -------------------------------------------------------
   Helpers (estilo academic.service.js)
------------------------------------------------------- */
const pickFirstArray = (data, keys = []) => {
    if (Array.isArray(data)) return data;
    for (const k of keys) {
        if (Array.isArray(data?.[k])) return data[k];
    }
    return [];
};

const trimSlash = (s = "") => String(s).replace(/\/+$/, "");

// Cliente público (sin auth / sin refresh)
const publicApi = axios.create({
    baseURL: API_BASE,
});

const asJson = async (client, method, url, payload, config = {}) => {
    try {
        const res = await client.request({
            method,
            url,
            data: payload,
            ...config,
        });
        return res.data;
    } catch (e) {
        const data = e?.response?.data;
        const msg =
            data?.detail ||
            data?.message ||
            (data && typeof data === "object"
                ? Object.entries(data)
                    .map(
                        ([k, v]) =>
                            `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`
                    )
                    .join(" | ")
                : null) ||
            (typeof data === "string" ? data : null) ||
            e?.message ||
            "Error en la solicitud";
        throw new Error(msg);
    }
};

// Cuando un endpoint devuelve a veces JSON y a veces blob (xlsx/pdf)
const asBlobOrJson = async (client, method, url, payload = null, config = {}) => {
    try {
        const res = await client.request({
            method,
            url,
            data: payload,
            responseType: "blob",
            ...config,
        });

        const ct = (res.headers?.["content-type"] || "").toLowerCase();

        if (ct.includes("application/json")) {
            const text = await res.data.text();
            return JSON.parse(text);
        }

        return res; // axios response con blob
    } catch (e) {
        const data = e?.response?.data;

        // Si el error vino como blob, intentamos leerlo
        if (data instanceof Blob) {
            try {
                const text = await data.text();
                const parsed = JSON.parse(text);
                throw new Error(parsed?.detail || parsed?.message || text || "Error en la solicitud");
            } catch (_) { }
        }

        const msg =
            e?.response?.data?.detail ||
            e?.response?.data?.message ||
            (e?.response?.data && typeof e.response.data === "object"
                ? Object.entries(e.response.data)
                    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
                    .join(" | ")
                : null) ||
            (typeof e?.response?.data === "string" ? e.response.data : null) ||
            e?.message ||
            "Error en la solicitud";

        throw new Error(msg);
    }
};

/* -------------------------------------------------------
   Dashboard
------------------------------------------------------- */
export const MesaPartesDashboard = {
    stats: async () => asJson(api, "GET", "/dashboard/stats/"),
};

/* -------------------------------------------------------
   Catálogos
------------------------------------------------------- */
export const Catalog = {
    offices: async () => {
        const data = await asJson(api, "GET", "/offices");
        const arr = pickFirstArray(data, ["offices", "items", "results"]);
        return { offices: arr };
    },

    users: async (params = {}) => {
        const data = await asJson(api, "GET", "/users", null, { params });
        const arr = pickFirstArray(data, ["users", "items", "results"]);
        return { users: arr };
    },
};

/* -------------------------------------------------------
   Tipos de trámite
------------------------------------------------------- */
export const ProcedureTypes = {
    list: async (params = {}) => {
        const data = await asJson(api, "GET", "/procedure-types", null, { params });
        const arr = pickFirstArray(data, ["procedure_types", "types", "items", "results"]);
        return {
            procedure_types: arr.length
                ? arr
                : pickFirstArray(data, ["procedure_types"]) ||
                (Array.isArray(data) ? data : []),
        };
    },

    create: async (payload) => asJson(api, "POST", "/procedure-types", payload),

    patch: async (id, payload) => asJson(api, "PATCH", `/procedure-types/${id}`, payload),

    update: async (id, payload) => asJson(api, "PUT", `/procedure-types/${id}`, payload),

    toggle: async (id, is_active) => asJson(api, "PATCH", `/procedure-types/${id}`, { is_active }),
};

/* -------------------------------------------------------
   Trámites
------------------------------------------------------- */
export const Procedures = {
    list: async (params = {}) => asJson(api, "GET", "/procedures", null, { params }),

    create: async (payload) => asJson(api, "POST", "/procedures", payload),

    get: async (id) => asJson(api, "GET", `/procedures/${id}`),

    getByCode: async (code) =>
        asJson(api, "GET", `/procedures/code/${encodeURIComponent(code)}`),

    route: async (id, { to_office_id, assignee_id, note, deadline_at }) =>
        asJson(api, "POST", `/procedures/${id}/route`, {
            to_office_id,
            assignee_id,
            note,
            deadline_at,
        }),

    setStatus: async (id, { status, note }) =>
        asJson(api, "POST", `/procedures/${id}/status`, { status, note }),

    timeline: async (id) => asJson(api, "GET", `/procedures/${id}/timeline`),

    addNote: async (id, { note }) => asJson(api, "POST", `/procedures/${id}/notes`, { note }),

    notify: async (id, payload) => asJson(api, "POST", `/procedures/${id}/notify`, payload),

    coverPDF: async (id) => asJson(api, "POST", `/procedures/${id}/cover`, {}),
    cargoPDF: async (id) => asJson(api, "POST", `/procedures/${id}/cargo`, {}),
};

/* -------------------------------------------------------
   Público
------------------------------------------------------- */
export const PublicProcedures = {
    track: async (code) =>
        asJson(publicApi, "GET", `/public/procedures/track`, null, { params: { code } }),
};

/* -------------------------------------------------------
   Archivos de trámite
------------------------------------------------------- */
export const ProcedureFiles = {
    list: async (procedureId) => {
        const data = await asJson(api, "GET", `/procedures/${procedureId}/files`);
        const arr = pickFirstArray(data, ["files", "items", "results"]);
        return { files: arr };
    },

    upload: async (procedureId, file, meta = {}) => {
        const fd = new FormData();
        fd.append("file", file);
        if (meta.doc_type) fd.append("doc_type", meta.doc_type);
        if (meta.description) fd.append("description", meta.description);

        return asJson(api, "POST", `/procedures/${procedureId}/files`, fd, {
            headers: { "Content-Type": "multipart/form-data" },
        });
    },

    remove: async (procedureId, fileId) =>
        asJson(api, "DELETE", `/procedures/${procedureId}/files/${fileId}`),
};

/* -------------------------------------------------------
   Recepción pública (ciudadano)
------------------------------------------------------- */
export const PublicIntake = {
    create: async (payload) => asJson(publicApi, "POST", `/public/procedures`, payload),

    uploadFile: async (trackingCode, file, meta = {}) => {
        const fd = new FormData();
        fd.append("file", file);
        if (meta.doc_type) fd.append("doc_type", meta.doc_type);
        if (meta.description) fd.append("description", meta.description);

        return asJson(
            publicApi,
            "POST",
            `/public/procedures/${encodeURIComponent(trackingCode)}/files`,
            fd,
            { headers: { "Content-Type": "multipart/form-data" } }
        );
    },
};

/* -------------------------------------------------------
   Reportes (SLA/volúmenes)
------------------------------------------------------- */
export const ProcedureReports = {
    summary: async (params = {}) =>
        asJson(api, "GET", `/procedures/reports/summary`, null, { params }),

    exportSLA: async (params = {}) =>
        asBlobOrJson(api, "GET", `/procedures/reports/sla.xlsx`, null, { params }),

    exportVolume: async (params = {}) =>
        asBlobOrJson(api, "GET", `/procedures/reports/volume.xlsx`, null, { params }),
};

/* -------------------------------------------------------
   URLs públicas (para window.open, links, etc.)
------------------------------------------------------- */
export const MesaPartesPublic = {
    baseURL: trimSlash(API_BASE),
    verifyUrl: (code) => `${trimSlash(API_BASE)}/verify?code=${encodeURIComponent(code)}`,
};
