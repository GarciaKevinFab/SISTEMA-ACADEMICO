// src/services/mesaPartes.service.js
import axios from "axios";
import api from "../lib/api";
import { API_BASE } from "../utils/config";

/* -------------------------------------------------------
   Helpers
------------------------------------------------------- */
const pickFirstArray = (data, keys = []) => {
    if (Array.isArray(data)) return data;
    for (const k of keys) {
        if (Array.isArray(data?.[k])) return data[k];
    }
    return [];
};

const trimSlash = (s = "") => String(s).replace(/\/+$/, "");

// Cliente público (sin auth)
const publicApi = axios.create({ baseURL: API_BASE });

const asJson = async (client, method, url, payload, config = {}) => {
    try {
        const res = await client.request({ method, url, data: payload, ...config });
        return res.data;
    } catch (e) {
        const data = e?.response?.data;
        const msg =
            data?.detail ||
            data?.message ||
            (data && typeof data === "object"
                ? Object.entries(data)
                    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
                    .join(" | ")
                : null) ||
            (typeof data === "string" ? data : null) ||
            e?.message ||
            "Error en la solicitud";
        throw new Error(msg);
    }
};

const asBlobOrJson = async (client, method, url, payload = null, config = {}) => {
    try {
        const res = await client.request({
            method, url, data: payload, responseType: "blob", ...config,
        });
        const ct = (res.headers?.["content-type"] || "").toLowerCase();
        if (ct.includes("application/json")) {
            const text = await res.data.text();
            return JSON.parse(text);
        }
        return res;
    } catch (e) {
        const data = e?.response?.data;
        if (data instanceof Blob) {
            try {
                const text = await data.text();
                const parsed = JSON.parse(text);
                throw new Error(parsed?.detail || parsed?.message || text || "Error");
            } catch (_) { }
        }
        const msg =
            e?.response?.data?.detail || e?.response?.data?.message || e?.message || "Error en la solicitud";
        throw new Error(msg);
    }
};

/**
 * Descarga un PDF desde un endpoint que devuelve binario application/pdf.
 * @param {object} client  - axios instance (api o publicApi)
 * @param {string} url     - endpoint path
 * @param {string} method  - "GET" o "POST"
 * @param {string} filename - nombre del archivo a guardar
 */
const downloadPdfBlob = async (client, url, method = "GET", filename = "documento.pdf") => {
    const res = await client.request({
        method,
        url,
        responseType: "blob",
    });
    const ct = (res.headers?.["content-type"] || "").toLowerCase();

    // Si el backend respondió con JSON (error), lo leemos
    if (ct.includes("application/json")) {
        const text = await res.data.text();
        let msg = "No se pudo generar el PDF";
        try { msg = JSON.parse(text)?.detail || msg; } catch (_) { }
        throw new Error(msg);
    }

    const blob = new Blob([res.data], { type: "application/pdf" });
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objUrl), 2000);
};

/* -------------------------------------------------------
   Dashboard
------------------------------------------------------- */
export const MesaPartesDashboard = {
    stats: async () => asJson(api, "GET", "/dashboard/stats/"),
};

/* -------------------------------------------------------
   Catálogos (PRIVADO)
------------------------------------------------------- */
export const Catalog = {
    offices: async (params = {}) => {
        const data = await asJson(api, "GET", "/offices", null, { params });
        return { offices: pickFirstArray(data, ["offices", "items", "results"]) };
    },
    users: async (params = {}) => {
        const data = await asJson(api, "GET", "/mp-users", null, { params });
        return { users: pickFirstArray(data, ["users", "items", "results"]) };
    },
};

/* -------------------------------------------------------
   Tipos de trámite (PRIVADO)
------------------------------------------------------- */
export const ProcedureTypes = {
    list: async (params = {}) => {
        const data = await asJson(api, "GET", "/procedure-types", null, { params });
        const arr = pickFirstArray(data, ["procedure_types", "types", "items", "results"]);
        return { procedure_types: arr.length ? arr : (Array.isArray(data) ? data : []) };
    },
    create: async (payload) => asJson(api, "POST", "/procedure-types", payload),
    patch: async (id, payload) => asJson(api, "PATCH", `/procedure-types/${id}`, payload),
    update: async (id, payload) => asJson(api, "PUT", `/procedure-types/${id}`, payload),
    toggle: async (id, is_active) => asJson(api, "PATCH", `/procedure-types/${id}`, { is_active }),
};

/* -------------------------------------------------------
   Tipos de trámite (PÚBLICO)
------------------------------------------------------- */
export const PublicProcedureTypes = {
    list: async (params = {}) => {
        const data = await asJson(publicApi, "GET", `/public/procedure-types`, null, { params });
        return { procedure_types: pickFirstArray(data, ["procedure_types", "types", "items", "results"]) };
    },
};

/* -------------------------------------------------------
   Trámites (PRIVADO)
------------------------------------------------------- */
export const Procedures = {
    list: async (params = {}) => asJson(api, "GET", "/procedures", null, { params }),
    create: async (payload) => asJson(api, "POST", "/procedures", payload),
    get: async (id) => asJson(api, "GET", `/procedures/${id}`),
    getByCode: async (code) => asJson(api, "GET", `/procedures/code`, null, { params: { code } }),
    route: async (id, payload) => asJson(api, "POST", `/procedures/${id}/route`, payload),
    setStatus: async (id, payload) => asJson(api, "POST", `/procedures/${id}/status`, payload),
    timeline: async (id) => asJson(api, "GET", `/procedures/${id}/timeline`),
    addNote: async (id, payload) => asJson(api, "POST", `/procedures/${id}/notes`, payload),
    notify: async (id, payload) => asJson(api, "POST", `/procedures/${id}/notify`, payload),
    remove: async (id) => asJson(api, "DELETE", `/procedures/${id}`),

    /**
     * Descarga la CARÁTULA (uso interno, requiere auth).
     * El backend devuelve binario PDF directamente.
     */
    downloadCover: async (id, trackingCode = id) => {
        await downloadPdfBlob(api, `/procedures/${id}/cover`, "GET", `caratula-${trackingCode}.pdf`);
    },

    /**
     * Descarga el CARGO (uso interno, requiere auth).
     */
    downloadCargo: async (id, trackingCode = id) => {
        await downloadPdfBlob(api, `/procedures/${id}/cargo`, "GET", `cargo-${trackingCode}.pdf`);
    },
};

/* -------------------------------------------------------
   Público (tracking + descarga cargo)
------------------------------------------------------- */
export const PublicProcedures = {
    track: async (code) =>
        asJson(publicApi, "GET", `/public/procedures/track`, null, { params: { code } }),

    /**
     * Descarga el cargo de recepción desde el portal público.
     * El endpoint /procedures/{id}/cargo acepta AllowAny.
     */
    downloadCargo: async (id, trackingCode = id) => {
        // El router DRF registra el viewset bajo /procedures/ — sin prefijo /public/
        await downloadPdfBlob(publicApi, `/procedures/${id}/cargo`, "GET", `cargo-${trackingCode}.pdf`);
    },
};

/* -------------------------------------------------------
   Archivos de trámite (PRIVADO)
------------------------------------------------------- */
export const ProcedureFiles = {
    list: async (procedureId) => {
        const data = await asJson(api, "GET", `/procedures/${procedureId}/files`);
        return { files: pickFirstArray(data, ["files", "items", "results"]) };
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
            publicApi, "POST",
            `/public/procedures/${encodeURIComponent(trackingCode)}/files`,
            fd,
            { headers: { "Content-Type": "multipart/form-data" } },
        );
    },
};

/* -------------------------------------------------------
   Reportes
------------------------------------------------------- */
export const ProcedureReports = {
    summary: async (params = {}) => asJson(api, "GET", `/procedures/reports/summary`, null, { params }),
    exportSLA: async (params = {}) => asBlobOrJson(api, "GET", `/procedures/reports/sla.xlsx`, null, { params }),
    exportVolume: async (params = {}) => asBlobOrJson(api, "GET", `/procedures/reports/volume.xlsx`, null, { params }),
};

/* -------------------------------------------------------
   URLs públicas
------------------------------------------------------- */
export const MesaPartesPublic = {
    baseURL: trimSlash(API_BASE),
    verifyUrl: (code) => `${trimSlash(API_BASE)}/verify?code=${encodeURIComponent(code)}`,
};

/* -------------------------------------------------------
   Oficinas CRUD (Mesa de Partes)
------------------------------------------------------- */
export const Offices = {
    list: async () => {
        const data = await asJson(api, "GET", "/offices");
        return pickFirstArray(data, ["offices", "items", "results"]);
    },
    create: async (payload) => asJson(api, "POST", "/offices", payload),
    update: async (id, payload) => asJson(api, "PATCH", `/offices/${id}`, payload),
    remove: async (id) => asJson(api, "DELETE", `/offices/${id}`),
};

/* -------------------------------------------------------
   Personal de Mesa de Partes
------------------------------------------------------- */
export const MpStaff = {
    list: async () => asJson(api, "GET", "/staff"),
    create: async (payload) => asJson(api, "POST", "/staff", payload),
    update: async (id, payload) => asJson(api, "PATCH", `/staff/${id}`, payload),
    remove: async (id) => asJson(api, "DELETE", `/staff/${id}`),
};