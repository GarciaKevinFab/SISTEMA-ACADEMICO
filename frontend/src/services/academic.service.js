// src/services/academic.service.js
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const authHeaders = () => ({
    "Authorization": `Bearer ${localStorage.getItem("token") || ""}`,
});

const jsonHeaders = {
    "Content-Type": "application/json",
};

async function http(method, url, body, isJSON = true) {
    const resp = await fetch(`${API}${url}`, {
        method,
        headers: isJSON ? { ...authHeaders(), ...jsonHeaders } : authHeaders(),
        body: body ? (isJSON ? JSON.stringify(body) : body) : undefined,
    });
    if (!resp.ok) {
        let detail = "Error en la solicitud";
        try { const e = await resp.json(); detail = e.detail || e.message || detail; } catch { }
        throw new Error(detail);
    }
    const ct = resp.headers.get("content-type") || "";
    if (ct.includes("application/json")) return resp.json();
    return resp; // blobs / streams (PDF, etc.)
}

/* ====== Catálogos base ====== */
export const Careers = {
    list: () => http("GET", "/careers"),
};

/* ====== Planes (mallas) ====== */
export const Plans = {
    list: () => http("GET", "/academic/plans"),
    create: (payload) => http("POST", "/academic/plans", payload),
    update: (id, payload) => http("PUT", `/academic/plans/${id}`, payload),
    remove: (id) => http("DELETE", `/academic/plans/${id}`),

    // Cursos de un plan
    listCourses: (planId) => http("GET", `/academic/plans/${planId}/courses`),
    addCourse: (planId, payload) => http("POST", `/academic/plans/${planId}/courses`, payload),
    updateCourse: (planId, courseId, payload) => http("PUT", `/academic/plans/${planId}/courses/${courseId}`, payload),
    removeCourse: (planId, courseId) => http("DELETE", `/academic/plans/${planId}/courses/${courseId}`),

    // Prerrequisitos de un curso
    listPrereqs: (planId, courseId) => http("GET", `/academic/plans/${planId}/courses/${courseId}/prereqs`),
    setPrereqs: (planId, courseId, prereqIds) => http("PUT", `/academic/plans/${planId}/courses/${courseId}/prereqs`, { prerequisites: prereqIds }),
};

/* ====== Secciones / carga lectiva / horarios ====== */
export const Sections = {
    list: (params) => {
        const q = new URLSearchParams(params || {}).toString();
        return http("GET", `/sections${q ? `?${q}` : ""}`);
    },
    create: (payload) => http("POST", "/sections", payload),
    update: (id, payload) => http("PUT", `/sections/${id}`, payload),
    remove: (id) => http("DELETE", `/sections/${id}`),

    // Horarios por sección
    listSchedule: (sectionId) => http("GET", `/sections/${sectionId}/schedule`),
    setSchedule: (sectionId, slots) => http("PUT", `/sections/${sectionId}/schedule`, { slots }),

    // Validaciones
    checkConflicts: (payload) => http("POST", "/sections/schedule/conflicts", payload),
    rooms: () => http("GET", "/classrooms"),
    teachers: () => http("GET", "/teachers"),
};

/* ====== Kárdex / Boleta / Constancias ====== */
export const Kardex = {
    ofStudent: (studentId) => http("GET", `/kardex/${studentId}`),
    boletaPDF: async (studentId, period) => http("POST", `/kardex/${studentId}/boleta/pdf`, { academic_period: period }),
    constanciaPDF: async (studentId) => http("POST", `/kardex/${studentId}/constancia/pdf`, {}),
};

/* ====== Procesos académicos ====== */
export const Processes = {
    retiro: (payload) => http("POST", "/processes/withdraw", payload),
    reserva: (payload) => http("POST", "/processes/reservation", payload),
    convalidacion: (payload) => http("POST", "/processes/validation", payload),
    traslado: (payload) => http("POST", "/processes/transfer", payload),
    reincorporacion: (payload) => http("POST", "/processes/rejoin", payload),
};
