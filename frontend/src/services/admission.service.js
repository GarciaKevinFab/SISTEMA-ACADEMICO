// src/services/admission.service.js
import api from "../lib/api";

/* ------------------------------------------
   Helpers
-------------------------------------------*/
export const toISO = (v) => {
    if (!v) return null;
    if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString();

    const s = String(v).trim();
    const m = s.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?$/);
    if (m) {
        const secs = m[3] ? `:${m[3]}` : ":00";
        const d = new Date(`${m[1]}T${m[2]}${secs}`);
        return isNaN(d.getTime()) ? null : d.toISOString();
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d.toISOString();
};

const extractList = (data) => {
    if (Array.isArray(data)) return data;
    return data?.admission_calls || data?.calls || data?.items || data?.results || data?.data || [];
};

/* ------------------------------------------
   Dashboard
-------------------------------------------*/
export const getAdmissionDashboardStats = async () => (await api.get("/admission/dashboard")).data;

/* ------------------------------------------
   Convocatorias
-------------------------------------------*/
const normalizeCall = (c) => {
    const careers = (c?.careers ?? []).map((x) => ({
        id: x.id ?? x.career_id,
        career_id: x.career_id ?? x.id,
        name: x.name ?? x.career_name ?? x.title ?? `Carrera ${x.id ?? x.career_id}`,
        vacancies: x.vacancies ?? x.quota ?? x.slots ?? 0,
    }));

    return {
        id: c.id,
        name: c.name,
        description: c.description ?? "",
        academic_year: c.academic_year ?? c.year ?? null,
        academic_period: c.academic_period ?? c.period ?? null,
        registration_start: c.registration_start ?? c.start_date ?? null,
        registration_end: c.registration_end ?? c.end_date ?? null,
        exam_date: c.exam_date ?? c.exam_at ?? null,
        results_date: c.results_date ?? c.results_at ?? null,
        application_fee: c.application_fee ?? c.fee ?? 0,
        max_applications_per_career: c.max_applications_per_career ?? c.max_choices ?? 1,
        minimum_age: c.minimum_age ?? null,
        maximum_age: c.maximum_age ?? null,
        required_documents: c.required_documents ?? [],
        careers,

        // ✅ campos opcionales que podrían venir
        regulation_url: c.regulation_url ?? c.reglamento_url ?? c.rules_url ?? c.regulation_pdf ?? c.reglamento_pdf ?? null,

        career_vacancies: c.career_vacancies ?? c.vacancies_map ?? null,
        total_applications: c.total_applications ?? c.applications_count ?? 0,
        status: c.status ?? c.state ?? "OPEN",
    };
};

export const listAdmissionCalls = async () => (await api.get("/admission-calls")).data;

export const createAdmissionCall = async (form) => {
    const careersArray = (form.available_careers || []).map((id) => ({
        id,
        career_id: id,
        vacancies: form.career_vacancies?.[id] ?? 0,
    }));

    const payload = {
        name: form.name,
        description: form.description || "",
        academic_year: form.academic_year,
        academic_period: form.academic_period,
        registration_start: toISO(form.registration_start),
        registration_end: toISO(form.registration_end),
        exam_date: toISO(form.exam_date),
        results_date: toISO(form.results_date),
        application_fee: Number(form.application_fee || 0),
        max_applications_per_career: Number(form.max_applications_per_career || 1),
        careers: careersArray,
        minimum_age: Number(form.minimum_age || 0),
        maximum_age: Number(form.maximum_age || 0),
        required_documents: form.required_documents || [],

        // sinónimos
        year: form.academic_year,
        period: form.academic_period,
        start_date: toISO(form.registration_start),
        end_date: toISO(form.registration_end),
        fee: Number(form.application_fee || 0),
        max_choices: Number(form.max_applications_per_career || 1),
    };

    return (await api.post("/admission-calls", payload)).data;
};

export const AdmissionCalls = {
    listPublic: async () => {
        const endpoints = [
            "/admission-calls/public",
            "/portal/public/admission-calls",
        ];

        let lastErr = null;

        for (const url of endpoints) {
            try {
                const { data } = await api.get(url);
                const raw = extractList(data);
                if (Array.isArray(raw) && raw.length === 0) continue;
                return raw.map(normalizeCall);
            } catch (e) {
                lastErr = e;
            }
        }

        // Si todos fallan:
        if (lastErr) console.error("listPublic failed:", lastErr);
        return [];
    },

    // ✅ NUEVO: obtener por id (si backend lo soporta) + fallback a buscar en listPublic
    getPublicById: async (id) => {
        const endpoints = [
            `/admission-calls/public/${id}`,
            `/portal/public/admission-calls/${id}`,
            `/admission-calls/${id}`, // (si existiera sin auth; si no, caerá al fallback)
        ];

        let lastErr = null;

        // 1) intentar endpoints directos
        for (const url of endpoints) {
            try {
                const { data } = await api.get(url);
                // Si backend devuelve objeto directo:
                if (data && typeof data === "object" && !Array.isArray(data)) {
                    // a veces viene {call: {...}} o {data: {...}}
                    const maybe = data.call || data.data || data.item || data;
                    if (maybe && typeof maybe === "object") return normalizeCall(maybe);
                }
            } catch (e) {
                lastErr = e;
            }
        }

        // 2) fallback: buscar en la lista pública
        try {
            const list = await AdmissionCalls.listPublic();
            const found = list.find((c) => String(c.id) === String(id));
            if (found) return found;
        } catch (e) {
            lastErr = e;
        }

        if (lastErr) console.error("getPublicById failed:", lastErr);
        return null;
    },

    listAdmin: async () => {
        const { data } = await api.get("/admission-calls");
        const raw = extractList(data);
        return raw.map(normalizeCall);
    },
};

/* ------------------------------------------
   Carreras
-------------------------------------------*/
export const listCareers = async () => (await api.get("/careers")).data;
export const createCareer = async (payload) => (await api.post("/careers", payload)).data;

/* ------------------------------------------
   Postulaciones
-------------------------------------------*/
export const Applications = {
    create: async (payload) => (await api.post("/applications", payload)).data,
    my: async () => (await api.get("/applications/me")).data,
    list: async (q = {}) => {
        const { data } = await api.get("/applications", { params: q });
        return Array.isArray(data) ? data : data?.applications || [];
    },
};
export const listMyApplications = async () => Applications.my();

/* ------------------------------------------
   Pago
-------------------------------------------*/
export const ApplicationPayment = {
    start: async (application_id, method) =>
        (await api.post(`/applications/${application_id}/payment`, { method })).data,
    status: async (application_id) =>
        (await api.get(`/applications/${application_id}/payment/status`)).data,
};

/* ------------------------------------------
   Evaluación
-------------------------------------------*/
export const Evaluation = {
    listForScoring: async (params) => (await api.get("/evaluation/applications", { params })).data,
    saveScores: async (application_id, rubric) =>
        (await api.post(`/evaluation/${application_id}/scores`, rubric)).data,
    bulkCompute: async (call_id) => (await api.post(`/evaluation/compute`, { call_id })).data,
};

/* ------------------------------------------
   Resultados
-------------------------------------------*/
export const Results = {
    list: async (params) => (await api.get("/results", { params })).data,
    publish: async (payload) => (await api.post("/results/publish", payload)).data,
    close: async (payload) => (await api.post("/results/close", payload)).data,
    actaPdf: async (params) => await api.get("/results/acta.pdf", { params, responseType: "blob" }),
};

/* ------------------------------------------
   Reportes
-------------------------------------------*/
export const AdmissionReports = {
    exportExcel: async (range) =>
        await api.get("/reports/admission.xlsx", { params: range, responseType: "blob" }),
    summary: async (range) =>
        (await api.get("/reports/admission/summary", { params: range })).data,
    ranking: async (params) =>
        await api.get("/reports/admission/ranking.xlsx", { params, responseType: "blob" }),
    vacantsVs: async (params) =>
        await api.get("/reports/admission/vacants-vs.xlsx", { params, responseType: "blob" }),
};

/* ------------------------------------------
   Parámetros
-------------------------------------------*/
export const AdmissionParams = {
    get: async () => (await api.get("/admission/params")).data,
    save: async (payload) => (await api.post("/admission/params", payload)).data,
};

/* ------------------------------------------
   Perfil postulante
-------------------------------------------*/
export const getApplicantMe = async () => (await api.get("/applicants/me")).data;
export const createApplicant = async (payload) => (await api.post("/applicants", payload)).data;

/* ------------------------------------------
   Documentos de postulante
-------------------------------------------*/
const normalizeDoc = (d) => ({
    id: d.id,
    document_type: d.document_type,
    url: d.file_url || d.url,
    review_status: d.status || "UPLOADED",
    observations: d.observations || "",
});

export const ApplicantDocs = {
    async list(applicationId) {
        const { data } = await api.get(`/applications/${applicationId}/documents`);
        const arr = Array.isArray(data?.documents) ? data.documents : Array.isArray(data) ? data : [];
        return arr.map(normalizeDoc);
    },

    async review(applicationId, documentId, { review_status, observations }) {
        const { data } = await api.post(
            `/applications/${applicationId}/documents/${documentId}/review`,
            { status: review_status, observations }
        );
        return normalizeDoc(data);
    },
};

ApplicantDocs.listMine = (applicationId) => ApplicantDocs.list(applicationId);

/* ------------------------------------------
   Cronograma por convocatoria
-------------------------------------------*/
export const AdmissionSchedule = {
    list: async (call_id) => (await api.get(`/admission-calls/${call_id}/schedule`)).data,
    create: async (call_id, payload) => (await api.post(`/admission-calls/${call_id}/schedule`, payload)).data,
    update: async (call_id, item_id, payload) =>
        (await api.put(`/admission-calls/${call_id}/schedule/${item_id}`, payload)).data,
    remove: async (call_id, item_id) =>
        (await api.delete(`/admission-calls/${call_id}/schedule/${item_id}`)).data,
};

/* ------------------------------------------
   Pagos (admin)
-------------------------------------------*/
export const Payments = {
    list: async (params) => (await api.get(`/admission-payments`, { params })).data,
    confirm: async (payment_id) => (await api.post(`/admission-payments/${payment_id}/confirm`)).data,
    void: async (payment_id) => (await api.post(`/admission-payments/${payment_id}/void`)).data,
    receiptPdf: async (payment_id) =>
        await api.get(`/admission-payments/${payment_id}/receipt.pdf`, { responseType: "blob" }),
};
