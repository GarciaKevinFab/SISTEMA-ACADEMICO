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

/* ====== Periodos académicos ====== */
export const Periods = {
    list: () => http("GET", "/academic/periods"),
};

/* ====== Asistencia ====== */
export const Attendance = {
    // sesiones por sección
    createSession: (sectionId, payload) => http("POST", `/sections/${sectionId}/attendance/sessions`, payload),
    listSessions: (sectionId) => http("GET", `/sections/${sectionId}/attendance/sessions`),
    closeSession: (sectionId, sessionId) => http("POST", `/sections/${sectionId}/attendance/sessions/${sessionId}/close`),

    // marcar asistencia por alumno
    set: (sectionId, sessionId, rows) => http("PUT", `/sections/${sectionId}/attendance/sessions/${sessionId}`, { rows }),
};

/* ====== Sugerencias de matrícula ====== */
export const Enrollment = {
    suggestions: (payload) => http("POST", "/enrollments/suggestions", payload),
};

/* ====== Sílabos & Evaluación ====== */
export const Syllabus = {
    get: (sectionId) => http("GET", `/sections/${sectionId}/syllabus`),
    upload: (sectionId, file) => {
        const fd = new FormData();
        fd.append("file", file);
        return http("POST", `/sections/${sectionId}/syllabus`, fd, false);
    },
    delete: (sectionId) => http("DELETE", `/sections/${sectionId}/syllabus`),
};

export const Evaluation = {
    getConfig: (sectionId) => http("GET", `/sections/${sectionId}/evaluation`),
    setConfig: (sectionId, config) => http("PUT", `/sections/${sectionId}/evaluation`, config),
    // config = [{code:"PARCIAL_1", label:"Parcial 1", weight:20}, ...] (suma 100)
};

/* ====== Procesos académicos: bandeja/seguimiento/archivos ====== */
export const ProcessFiles = {
    list: (processId) => http("GET", `/processes/${processId}/files`),
    upload: (processId, file, meta = {}) => {
        const fd = new FormData();
        fd.append("file", file);
        if (meta.note) fd.append("note", meta.note);
        return http("POST", `/processes/${processId}/files`, fd, false);
    },
    remove: (processId, fileId) => http("DELETE", `/processes/${processId}/files/${fileId}`),
};

export const ProcessesInbox = {
    myRequests: (params = {}) => {
        const q = new URLSearchParams(params).toString();
        return http("GET", `/processes/my${q ? `?${q}` : ""}`);
    },
    listAll: (params = {}) => {
        const q = new URLSearchParams(params).toString();
        return http("GET", `/processes${q ? `?${q}` : ""}`);
    },
    get: (id) => http("GET", `/processes/${id}`),
    setStatus: (id, payload) => http("POST", `/processes/${id}/status`, payload), // {status:"APROBADO"|"RECHAZADO", note:""}
    notify: (id, payload) => http("POST", `/processes/${id}/notify`, payload),   // {channels:["EMAIL"], subject, message}
};

/* ====== Reportes académicos ====== */
export const AcademicReports = {
    summary: (params = {}) => {
        const q = new URLSearchParams(params).toString();
        return http("GET", `/academic/reports/summary${q ? `?${q}` : ""}`);
    },
    exportPerformance: (params = {}) => {
        const q = new URLSearchParams(params).toString();
        return http("GET", `/academic/reports/performance.xlsx${q ? `?${q}` : ""}`);
    },
    exportOccupancy: (params = {}) => {
        const q = new URLSearchParams(params).toString();
        return http("GET", `/academic/reports/occupancy.xlsx${q ? `?${q}` : ""}`);
    },
};
