// src/services/admission.service.js
import api from "../lib/api"; // tu instancia axios (baseURL + interceptores)

// Dashboard
export const getAdmissionDashboardStats = async () =>
    (await api.get("/admission/dashboard")).data;

// Convocatorias
export const listAdmissionCalls = async () =>
    (await api.get("/admission-calls")).data;
export const createAdmissionCall = async (payload) =>
    (await api.post("/admission-calls", payload)).data;

export const AdmissionCalls = {
    listPublic: async () => (await api.get("/admission-calls/public")).data,
    listAdmin: async () => (await api.get("/admission-calls")).data,
};

// Carreras
export const listCareers = async () => (await api.get("/careers")).data;
export const createCareer = async (payload) => (await api.post("/careers", payload)).data;

// Postulaciones
export const Applications = {
    create: async (payload) => (await api.post("/applications", payload)).data,
    my: async () => (await api.get("/applications/me")).data,
    list: async (q = {}) => (await api.get("/applications", { params: q })).data,
};
export const listMyApplications = async () => (await Applications.my());

// Pago
export const ApplicationPayment = {
    start: async (application_id, method) =>
        (await api.post(`/applications/${application_id}/payment`, { method })).data,
    status: async (application_id) =>
        (await api.get(`/applications/${application_id}/payment/status`)).data,
};

// Evaluación
export const Evaluation = {
    listForScoring: async (params) =>
        (await api.get("/evaluation/applications", { params })).data,
    saveScores: async (application_id, rubric) =>
        (await api.post(`/evaluation/${application_id}/scores`, rubric)).data,
    bulkCompute: async (call_id) =>
        (await api.post(`/evaluation/compute`, { call_id })).data,
};

// Resultados
export const Results = {
    list: async (params) => (await api.get("/results", { params })).data,
    publish: async (payload) => (await api.post("/results/publish", payload)).data,
    close: async (payload) => (await api.post("/results/close", payload)).data,
    actaPdf: async (params) =>
        await api.get("/results/acta.pdf", { params, responseType: "blob" }),
};

// Reportes
export const AdmissionReports = {
    exportExcel: async (range) =>
        await api.get("/reports/admission.xlsx", { params: range, responseType: "blob" }),
    summary: async (range) =>
        (await api.get("/reports/admission/summary", { params: range })).data,
    // opcionales:
    ranking: async (params) =>
        await api.get("/reports/admission/ranking.xlsx", { params, responseType: "blob" }),
    vacantsVs: async (params) =>
        await api.get("/reports/admission/vacants-vs.xlsx", { params, responseType: "blob" }),
};

// Parámetros
export const AdmissionParams = {
    get: async () => (await api.get("/admission/params")).data,
    save: async (payload) => (await api.post("/admission/params", payload)).data,
};

// Perfil postulante
export const getApplicantMe = async () => (await api.get("/applicants/me")).data;
export const createApplicant = async (payload) =>
    (await api.post("/applicants", payload)).data;


// --- NUEVO: Revisión admin de documentos ---
export const ApplicantDocs = {
    listMine: async (application_id) =>
        (await api.get(`/applications/${application_id}/documents`)).data,
    upload: async (application_id, document_type, file) => {
        const fd = new FormData();
        fd.append("document_type", document_type);
        fd.append("file", file);
        return (await api.post(`/applications/${application_id}/documents`, fd, {
            headers: { "Content-Type": "multipart/form-data" },
        })).data;
    },
    // nuevo: revisar
    review: async (application_id, document_id, payload) =>
        (await api.post(`/applications/${application_id}/documents/${document_id}/review`, payload)).data,
};

// --- NUEVO: Cronograma por convocatoria ---
export const AdmissionSchedule = {
    list: async (call_id) => (await api.get(`/admission-calls/${call_id}/schedule`)).data,
    create: async (call_id, payload) => (await api.post(`/admission-calls/${call_id}/schedule`, payload)).data,
    update: async (call_id, item_id, payload) => (await api.put(`/admission-calls/${call_id}/schedule/${item_id}`, payload)).data,
    remove: async (call_id, item_id) => (await api.delete(`/admission-calls/${call_id}/schedule/${item_id}`)).data,
};

// --- NUEVO: Pagos (bandeja admin) ---
export const Payments = {
    list: async (params) => (await api.get(`/admission-payments`, { params })).data,
    confirm: async (payment_id) => (await api.post(`/admission-payments/${payment_id}/confirm`)).data,
    void: async (payment_id) => (await api.post(`/admission-payments/${payment_id}/void`)).data,
    receiptPdf: async (payment_id) =>
        await api.get(`/admission-payments/${payment_id}/receipt.pdf`, { responseType: "blob" }),
};

