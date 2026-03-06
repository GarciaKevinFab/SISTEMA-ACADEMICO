// src/services/graduates.service.js
import api from "../lib/api";

/* ═══════════════════════════════════════════════════════════════
   HELPERS (mismos patrones que academic.service.js)
   ═══════════════════════════════════════════════════════════════ */

const wrapAxiosError = (e) => {
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

    const err = new Error(msg);
    err.original = e;
    err.response = e?.response;
    err.status = e?.response?.status;
    err.data = data;
    err.url = e?.config?.url;
    err.method = e?.config?.method;
    return err;
};

const toggleSlash = (url) => {
    if (!url) return url;
    const [base, qs] = url.split("?");
    const altBase = base.endsWith("/") ? base.slice(0, -1) : `${base}/`;
    return qs ? `${altBase}?${qs}` : altBase;
};

const shouldRetryBySlash = (status) =>
    status === 404 || status === 301 || status === 302 || status === 307 || status === 308;

const requestJsonSmart = async (method, url, payload, config = {}) => {
    try {
        const res = await api.request({ method, url, data: payload, ...config });
        return res.data;
    } catch (e) {
        const status = e?.response?.status;
        if (shouldRetryBySlash(status)) {
            const altUrl = toggleSlash(url);
            try {
                const res2 = await api.request({ method, url: altUrl, data: payload, ...config });
                return res2.data;
            } catch (e2) {
                throw wrapAxiosError(e2);
            }
        }
        throw wrapAxiosError(e);
    }
};

const asBlobGetSmart = async (url, params = {}) => {
    const doGet = (u) => api.get(u, { params, responseType: "blob" });
    try {
        return await doGet(url);
    } catch (e) {
        const status = e?.response?.status;
        if (shouldRetryBySlash(status)) {
            try {
                return await doGet(toggleSlash(url));
            } catch (e2) {
                throw wrapAxiosError(e2);
            }
        }
        throw wrapAxiosError(e);
    }
};


/* ═══════════════════════════════════════════════════════════════
   GRADUATES — BÚSQUEDA PÚBLICA (sin auth)
   ═══════════════════════════════════════════════════════════════ */

export const Graduates = {
    /**
     * Buscar egresados por DNI o nombre.
     * GET /api/public/graduates/search/?dni=72611344
     * GET /api/public/graduates/search/?nombre=GARCIA
     *
     * @param {{ dni?: string, nombre?: string }} params
     * @returns {Promise<{ results: Array }>}
     */
    search: async (params = {}) => {
        const data = await requestJsonSmart("GET", "/public/graduates/search", null, { params });
        return {
            results: Array.isArray(data?.results) ? data.results : [],
        };
    },

    /**
     * Descargar constancia de inscripción en PDF.
     * GET /api/public/graduates/:id/constancia/
     *
     * @param {number|string} graduateId
     * @returns {Promise<AxiosResponse>} — res.data es el Blob
     */
    downloadConstancia: async (graduateId) =>
        asBlobGetSmart(`/public/graduates/${graduateId}/constancia`),
};


/* ═══════════════════════════════════════════════════════════════
   GRADUATES — ADMINISTRACIÓN (uso interno / dashboard)
   ═══════════════════════════════════════════════════════════════ */

export const GraduatesAdmin = {
    /** Listar todos los egresados (paginado). GET /api/graduates/ */
    list: async (params = {}) => {
        const data = await requestJsonSmart("GET", "/graduates", null, { params });
        return {
            results: Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [],
            count: data?.count ?? 0,
            next: data?.next ?? null,
            previous: data?.previous ?? null,
        };
    },

    /** Obtener un egresado por ID. GET /api/graduates/:id/ */
    get: async (id) =>
        requestJsonSmart("GET", `/graduates/${id}`, null),

    /** Crear un nuevo egresado. POST /api/graduates/ */
    create: async (payload) =>
        requestJsonSmart("POST", "/graduates", payload),

    /** Actualizar un egresado existente. PUT /api/graduates/:id/ */
    update: async (id, payload) =>
        requestJsonSmart("PUT", `/graduates/${id}`, payload),

    /** Actualizar parcialmente. PATCH /api/graduates/:id/ */
    patch: async (id, payload) =>
        requestJsonSmart("PATCH", `/graduates/${id}`, payload),

    /** Eliminar (desactivar). DELETE /api/graduates/:id/ */
    remove: async (id) =>
        requestJsonSmart("DELETE", `/graduates/${id}`, null),

    /** Estadísticas del verificador. GET /api/graduates/stats/ */
    stats: async () =>
        requestJsonSmart("GET", "/graduates/stats", null),

    /** Exportar egresados a Excel. GET /api/graduates/export/xlsx/ */
    exportXlsx: async (params = {}) =>
        asBlobGetSmart("/graduates/export/xlsx", params),
};

export const GradoTituloTypes = {
    /** Listar todos los tipos de grado/título */
    list: () => api.get("/graduates/grado-titulo-types/").then((r) => r.data),

    /** Crear nuevo tipo */
    create: (data) => api.post("/graduates/grado-titulo-types/", data).then((r) => r.data),

    /** Actualizar tipo existente (PUT completo) */
    update: (id, data) => api.put(`/graduates/grado-titulo-types/${id}/`, data).then((r) => r.data),

    /** Actualizar parcialmente (PATCH) */
    patch: (id, data) => api.patch(`/graduates/grado-titulo-types/${id}/`, data).then((r) => r.data),

    /** Eliminar tipo */
    remove: (id) => api.delete(`/graduates/grado-titulo-types/${id}/`).then((r) => r.data),
};