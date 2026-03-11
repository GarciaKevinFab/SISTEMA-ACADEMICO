// src/services/catalogs.service.js
import api from "@/lib/api";

const getData = (p) => p.then((r) => r.data);
const getWrappedData = (p) => p.then((r) => r.data?.data ?? r.data);
const getResponse = (p) => p.then((r) => r);

// Normaliza cualquier respuesta a array
const asItems = (data) => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.results)) return data.results;
    if (Array.isArray(data.data)) return data.data;
    // soporte frecuente: {teachers:[]}, {classrooms:[]}, etc.
    for (const k of ["teachers", "classrooms", "periods", "campuses", "rooms"]) {
        if (Array.isArray(data[k])) return data[k];
    }
    return [];
};

// Helper: lista -> array SIEMPRE
const listAsItems = (url, params) => getData(api.get(url, { params })).then(asItems);

// ------------------ Catálogos ------------------
export const Periods = {
    list: (params) => listAsItems("/catalogs/periods", params),
    create: (payload) => getData(api.post("/catalogs/periods", payload)),
    update: (id, payload) => getData(api.patch(`/catalogs/periods/${id}`, payload)),
    remove: (id) => getData(api.delete(`/catalogs/periods/${id}`)),
    setActive: (id, is_active) => getData(api.post(`/catalogs/periods/${id}/active`, { is_active })),
};

export const Campuses = {
    list: (params) => listAsItems("/catalogs/campuses", params),
    create: (payload) => getData(api.post("/catalogs/campuses", payload)),
    update: (id, payload) => getData(api.patch(`/catalogs/campuses/${id}`, payload)),
    remove: (id) => getData(api.delete(`/catalogs/campuses/${id}`)),
};

export const Classrooms = {
    list: (params) => listAsItems("/catalogs/classrooms", params),
    create: (payload) => getData(api.post("/catalogs/classrooms", payload)),
    update: (id, payload) => getData(api.patch(`/catalogs/classrooms/${id}`, payload)),
    remove: (id) => getData(api.delete(`/catalogs/classrooms/${id}`)),
};

export const Teachers = {
    list: (params) => listAsItems("/catalogs/teachers", params),
    create: (payload) => getData(api.post("/catalogs/teachers", payload)),
    update: (id, payload) => getData(api.patch(`/catalogs/teachers/${id}`, payload)),
    remove: (id) => getData(api.delete(`/catalogs/teachers/${id}`)),
};

// ------------------ Ubigeo ------------------
export const Ubigeo = {
    search: (q) => getData(api.get("/catalogs/ubigeo/search", { params: { q } })),
    deps: () => getData(api.get("/catalogs/ubigeo/departments")),
    provs: (department) => getData(api.get("/catalogs/ubigeo/provinces", { params: { department } })),
    dists: (department, province) =>
        getData(api.get("/catalogs/ubigeo/districts", { params: { department, province } })),
};

// ------------------ Parámetros institución ------------------
export const Institution = {
    getSettings: () => getWrappedData(api.get("/catalogs/institution/settings")),
    updateSettings: (payload) => getWrappedData(api.patch("/catalogs/institution/settings", payload)),

    uploadMedia: async (kind, file) => {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("kind", String(kind || "").toUpperCase());

        return getData(
            api.post("/catalogs/institution/media", fd, {
                headers: { "Content-Type": "multipart/form-data" },
            })
        );
    },

    removeMedia: (kind) =>
        getData(api.delete(`/catalogs/institution/media/${String(kind || "").toUpperCase()}`)),
};

// ------------------ Importadores ------------------
export const Imports = {
    downloadTemplate: (type) =>
        getResponse(
            api.get(`/catalogs/imports/templates/${type}`, {
                responseType: "blob",
            })
        ),

    start: async (type, file, mapping) => {
        const fd = new FormData();
        fd.append("file", file);
        if (mapping) fd.append("mapping", JSON.stringify(mapping));

        try {
            const { data } = await api.post(`/catalogs/imports/${type}`, fd, {
                headers: { "Content-Type": "multipart/form-data" },
            });

            const jobId = data?.job_id ?? data?.id ?? data?.task_id;
            if (!jobId) {
                const err = new Error("No se recibió job_id desde el backend");
                err.payload = data;
                throw err;
            }
            return { ...data, job_id: jobId };
        } catch (e) {
            console.error("IMPORT START ERROR:", e?.response?.data || e);
            throw e;
        }
    },

    status: (jobId) => getData(api.get(`/catalogs/imports/status/${jobId}`)),
};

// ------------------ Respaldo/Export ------------------
export const Backup = {
    list: () => getData(api.get("/catalogs/exports/backups")),
    create: (scope = "FULL") => getData(api.post("/catalogs/exports/backups", { scope })),
    download: (id) =>
        getResponse(api.get(`/catalogs/exports/backups/${id}/download`, { responseType: "blob" })),
    exportDataset: (dataset) => getData(api.post("/catalogs/exports/dataset", { dataset })),
    remove: (id) => getData(api.delete(`/catalogs/exports/backups/${id}`)),
    cleanup: (days = 30, only_datasets = false) =>
        getData(api.post("/catalogs/exports/backups/cleanup", { days, only_datasets })),
};

// ------------------ Credenciales masivas ------------------
export const Credentials = {
    downloadBulk: (role) =>
        getResponse(
            api.post("/users/bulk-credentials", { role }, { responseType: "blob" })
        ),
};

export const Egresados = {
    list: (params = {}) => {
        const q = new URLSearchParams(params).toString();
        return api.get(`/catalogs/egresados${q ? `?${q}` : ""}`).then(r => r.data);
    },
    stats: () => api.get("/catalogs/egresados/stats").then(r => r.data),
    update: (id, data) => api.patch(`/catalogs/egresados/${id}`, data).then(r => r.data),
    export: (params = {}) => {
        const q = new URLSearchParams(params).toString();
        return api.get(`/catalogs/egresados/export${q ? `?${q}` : ""}`, {
            responseType: "blob",
        });
    },
};