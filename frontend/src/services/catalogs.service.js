// src/services/catalogs.service.js
import api from "../lib/api";

// helper: devuelve solo data
const getData = (p) => p.then((r) => r.data);

// ------------------ Catálogos ------------------
export const Periods = {
    list: (params) => getData(api.get("/catalogs/periods", { params })),
    create: (payload) => getData(api.post("/catalogs/periods", payload)),
    update: (id, payload) => getData(api.patch(`/catalogs/periods/${id}`, payload)),
    remove: (id) => getData(api.delete(`/catalogs/periods/${id}`)),
    setActive: (id, is_active) =>
        getData(api.post(`/catalogs/periods/${id}/active`, { is_active })),
};

export const Campuses = {
    list: () => getData(api.get("/catalogs/campuses")),
    create: (payload) => getData(api.post("/catalogs/campuses", payload)),
    update: (id, payload) => getData(api.patch(`/catalogs/campuses/${id}`, payload)),
    remove: (id) => getData(api.delete(`/catalogs/campuses/${id}`)),
};

export const Classrooms = {
    list: (params) => getData(api.get("/catalogs/classrooms", { params })),
    create: (payload) => getData(api.post("/catalogs/classrooms", payload)),
    update: (id, payload) => getData(api.patch(`/catalogs/classrooms/${id}`, payload)),
    remove: (id) => getData(api.delete(`/catalogs/classrooms/${id}`)),
};

export const Teachers = {
    list: (params) => getData(api.get("/catalogs/teachers", { params })),
    create: (payload) => getData(api.post("/catalogs/teachers", payload)),
    update: (id, payload) => getData(api.patch(`/catalogs/teachers/${id}`, payload)),
    remove: (id) => getData(api.delete(`/catalogs/teachers/${id}`)),
};

// ------------------ Ubigeo ------------------
export const Ubigeo = {
    search: (q) => getData(api.get("/catalogs/ubigeo/search", { params: { q } })),
    deps: () => getData(api.get("/catalogs/ubigeo/departments")),
    provs: (department) =>
        getData(api.get("/catalogs/ubigeo/provinces", { params: { department } })),
    dists: (department, province) =>
        getData(api.get("/catalogs/ubigeo/districts", { params: { department, province } })),
};

// ------------------ Parámetros institución ------------------
export const Institution = {
    getSettings: () => getData(api.get("/catalogs/institution/settings")),
    updateSettings: (payload) => getData(api.patch("/catalogs/institution/settings", payload)),
    uploadMedia: async (kind, file) => {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("kind", kind);
        return getData(api.post("/catalogs/institution/media", fd));
    },
};

// ------------------ Importadores ------------------
export const Imports = {
    // OJO: NO usar <a href> para esto si requiere JWT, porque el navegador NO manda Authorization.
    templatePath: (type) => `/catalogs/imports/templates/${type}`,

    // devuelve response completo para leer headers y armar filename
    downloadTemplate: async (type) => {
        return api.get(Imports.templatePath(type), { responseType: "blob" });
    },

    start: async (type, file, mapping) => {
        const fd = new FormData();
        fd.append("file", file);
        if (mapping) fd.append("mapping", JSON.stringify(mapping));
        return getData(api.post(`/catalogs/imports/${type}`, fd));
    },

    status: (jobId) => getData(api.get(`/catalogs/imports/status/${jobId}`)),
};

// ------------------ Respaldo/Export ------------------
export const Backup = {
    list: () => getData(api.get("/catalogs/exports/backups")),
    create: (scope = "FULL") => getData(api.post("/catalogs/exports/backups", { scope })),

    // ✅ descarga protegida con Bearer (NO usar <a href>)
    download: (id) =>
        api.get(`/catalogs/exports/backups/${id}/download`, { responseType: "blob" }),

    exportDataset: (dataset) => getData(api.post("/catalogs/exports/dataset", { dataset })),
};
