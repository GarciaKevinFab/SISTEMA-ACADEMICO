// src/services/academic.service.js
import api from "../lib/api";

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

const asBlobGet = async (url, params = {}) => {
    const res = await api.get(url, { params, responseType: "blob" });
    return res; // axios response (blob en res.data)
};

const asJson = async (method, url, payload, config = {}) => {
    try {
        const res = await api.request({
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
                    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
                    .join(" | ")
                : null) ||
            (typeof data === "string" ? data : null) ||
            e?.message ||
            "Error en la solicitud";
        throw new Error(msg);
    }
};

/* -------------------------------------------------------
   Catálogos base
   (OJO: tus carreras están en admission y viven en /api/careers)
------------------------------------------------------- */
export const Careers = {
    /**
     * Backend admission:
     * - puede devolver: [ {id,name,...} ]
     * - o: {careers:[...]}
     */
    list: async () => {
        const data = await asJson("GET", "/careers");
        const arr = pickFirstArray(data, ["careers", "items", "results"]);
        return { careers: arr };
    },

    create: async (payload) => asJson("POST", "/careers", payload),

    update: async (id, payload) => asJson("PUT", `/careers/${id}`, payload),

    remove: async (id) => asJson("DELETE", `/careers/${id}`),

    toggleActive: async (id) => asJson("POST", `/careers/${id}/toggle-active`, {}),
};

/* -------------------------------------------------------
   Planes (mallas) - academic app (stub router: /academic/plans)
------------------------------------------------------- */
export const Plans = {
    list: async () => {
        const data = await asJson("GET", "/academic/plans");
        const arr = pickFirstArray(data, ["plans", "items", "results"]);
        // tu backend stub usa ok(plans=[...])
        return { plans: arr };
    },

    create: async (payload) => {
        const data = await asJson("POST", "/academic/plans", payload);
        // stub retorna {plan: {...}}
        return data;
    },

    update: async (id, payload) => asJson("PUT", `/academic/plans/${id}`, payload),

    remove: async (id) => asJson("DELETE", `/academic/plans/${id}`),

    // Cursos de un plan
    listCourses: async (planId) => {
        const data = await asJson("GET", `/academic/plans/${planId}/courses`);
        const arr = pickFirstArray(data, ["courses", "items", "results"]);
        return { courses: arr };
    },

    addCourse: async (planId, payload) =>
        asJson("POST", `/academic/plans/${planId}/courses`, payload),

    updateCourse: async (planId, courseId, payload) =>
        asJson("PUT", `/academic/plans/${planId}/courses/${courseId}`, payload),

    removeCourse: async (planId, courseId) =>
        asJson("DELETE", `/academic/plans/${planId}/courses/${courseId}`),

    // Prerrequisitos (según tu stub: PUT /academic/plans/:id/courses/:course_id/prereqs)
    setPrereqs: async (planId, courseId, prereqIds) =>
        asJson("PUT", `/academic/plans/${planId}/courses/${courseId}/prereqs`, {
            prerequisites: prereqIds,
        }),

    // si en algún momento lo implementas en backend real:
    listPrereqs: async (planId, courseId) =>
        asJson("GET", `/academic/plans/${planId}/courses/${courseId}/prereqs`),
};

/* -------------------------------------------------------
   Secciones / horarios
------------------------------------------------------- */
export const Sections = {
    list: async (params = {}) => {
        const data = await asJson("GET", "/sections", null, { params });
        const arr = pickFirstArray(data, ["sections", "items", "results"]);
        return { sections: arr };
    },

    create: async (payload) => asJson("POST", "/sections", payload),

    update: async (id, payload) => asJson("PUT", `/sections/${id}`, payload),

    remove: async (id) => asJson("DELETE", `/sections/${id}`),

    // Validaciones
    checkConflicts: async (payload) =>
        asJson("POST", "/sections/schedule/conflicts", payload),

    rooms: async () => {
        const data = await asJson("GET", "/classrooms");
        const arr = pickFirstArray(data, ["classrooms", "items", "results"]);
        return { classrooms: arr };
    },

    teachers: async () => {
        const data = await asJson("GET", "/teachers");
        const arr = pickFirstArray(data, ["teachers", "items", "results"]);
        return { teachers: arr };
    },

    // Horarios por sección (si tu backend lo implementa)
    listSchedule: async (sectionId) =>
        asJson("GET", `/sections/${sectionId}/schedule`),

    setSchedule: async (sectionId, slots) =>
        asJson("PUT", `/sections/${sectionId}/schedule`, { slots }),
};

/* -------------------------------------------------------
   Kárdex / PDFs
------------------------------------------------------- */
export const Kardex = {
    ofStudent: async (studentId) => asJson("GET", `/kardex/${studentId}`),

    // estos devuelven PDF (blob)
    boletaPDF: async (studentId, period) =>
        asBlobGet(`/kardex/${studentId}/boleta/pdf`, { academic_period: period }),

    constanciaPDF: async (studentId) =>
        asBlobGet(`/kardex/${studentId}/constancia/pdf`),
};

/* -------------------------------------------------------
   Procesos académicos
------------------------------------------------------- */
export const Processes = {
    retiro: async (payload) => asJson("POST", "/processes/withdraw", payload),
    reserva: async (payload) => asJson("POST", "/processes/reservation", payload),
    convalidacion: async (payload) => asJson("POST", "/processes/validation", payload),
    traslado: async (payload) => asJson("POST", "/processes/transfer", payload),
    reincorporacion: async (payload) => asJson("POST", "/processes/rejoin", payload),
};

export const Periods = {
    list: async () => asJson("GET", "/academic/periods"),
};

/* -------------------------------------------------------
   Asistencia
------------------------------------------------------- */
export const Attendance = {
    createSession: async (sectionId, payload = {}) =>
        asJson("POST", `/sections/${sectionId}/attendance/sessions`, payload),

    listSessions: async (sectionId) =>
        asJson("GET", `/sections/${sectionId}/attendance/sessions`),

    closeSession: async (sectionId, sessionId) =>
        asJson("POST", `/sections/${sectionId}/attendance/sessions/${sessionId}/close`, {}),

    set: async (sectionId, sessionId, rows) =>
        asJson("PUT", `/sections/${sectionId}/attendance/sessions/${sessionId}`, { rows }),
};

/* -------------------------------------------------------
   Sugerencias de matrícula
------------------------------------------------------- */
export const Enrollment = {
    suggestions: async (payload) => asJson("POST", "/enrollments/suggestions", payload),
};

/* -------------------------------------------------------
   Sílabos & Evaluación
------------------------------------------------------- */
export const Syllabus = {
    get: async (sectionId) => asJson("GET", `/sections/${sectionId}/syllabus`),

    upload: async (sectionId, file) => {
        const fd = new FormData();
        fd.append("file", file);
        return asJson("POST", `/sections/${sectionId}/syllabus`, fd, {
            headers: { "Content-Type": "multipart/form-data" },
        });
    },

    delete: async (sectionId) => asJson("DELETE", `/sections/${sectionId}/syllabus`),
};

export const Evaluation = {
    getConfig: async (sectionId) => asJson("GET", `/sections/${sectionId}/evaluation`),

    setConfig: async (sectionId, config) =>
        asJson("PUT", `/sections/${sectionId}/evaluation`, { config }),
};

/* -------------------------------------------------------
   Procesos: bandeja/archivos/estado
------------------------------------------------------- */
export const ProcessFiles = {
    list: async (processId) => asJson("GET", `/processes/${processId}/files`),

    upload: async (processId, file, meta = {}) => {
        const fd = new FormData();
        fd.append("file", file);
        if (meta.note) fd.append("note", meta.note);
        return asJson("POST", `/processes/${processId}/files`, fd, {
            headers: { "Content-Type": "multipart/form-data" },
        });
    },

    remove: async (processId, fileId) =>
        asJson("DELETE", `/processes/${processId}/files/${fileId}`),
};

export const ProcessesInbox = {
    myRequests: async (params = {}) => asJson("GET", "/processes/my", null, { params }),

    listAll: async (params = {}) => asJson("GET", "/processes", null, { params }),

    get: async (id) => asJson("GET", `/processes/${id}`),

    setStatus: async (id, payload) => asJson("POST", `/processes/${id}/status`, payload),

    notify: async (id, payload) => asJson("POST", `/processes/${id}/notify`, payload),
};

/* -------------------------------------------------------
   Reportes
------------------------------------------------------- */
export const AcademicReports = {
    summary: async (params = {}) => asJson("GET", "/academic/reports/summary", null, { params }),

    exportPerformance: async (params = {}) =>
        asBlobGet("/academic/reports/performance.xlsx", params),

    exportOccupancy: async (params = {}) =>
        asBlobGet("/academic/reports/occupancy.xlsx", params),
};

/* -------------------------------------------------------
   Docente / Secciones / Estudiantes / Notas (para módulo docente)
------------------------------------------------------- */
export const Teacher = {
    /**
     * GET /teachers/:teacher_user_id/sections
     * Esperado:
     * - { sections: [...] }
     * o - [...] (si tu backend devuelve array directo)
     */
    sections: async (teacherUserId) => {
        const data = await asJson("GET", `/teachers/${teacherUserId}/sections`);
        const arr = pickFirstArray(data, ["sections", "items", "results"]);
        return { sections: arr };
    },
};

export const SectionStudents = {
    /**
     * GET /sections/:section_id/students
     * Esperado:
     * - { students: [...] }
     * o - [...]
     */
    list: async (sectionId) => {
        const data = await asJson("GET", `/sections/${sectionId}/students`);
        const arr = pickFirstArray(data, ["students", "items", "results"]);
        return { students: arr };
    },
};

export const Grades = {
    /**
     * GET /sections/:section_id/grades
     * Esperado:
     * - { grades: { [studentId]: {PARCIAL_1:..., ...} } }
     */
    get: async (sectionId) => asJson("GET", `/sections/${sectionId}/grades`),

    /**
     * POST /grades/save
     * payload: { section_id, grades }
     */
    save: async (sectionId, grades) =>
        asJson("POST", "/grades/save", { section_id: sectionId, grades }),

    /**
     * POST /grades/submit
     */
    submit: async (sectionId, grades) =>
        asJson("POST", "/grades/submit", { section_id: sectionId, grades }),

    /**
     * POST /grades/reopen
     */
    reopen: async (sectionId) =>
        asJson("POST", "/grades/reopen", { section_id: sectionId }),
};

export const AttendanceImport = {
    /**
     * POST /attendance/import/preview (multipart)
     * formData: file + section_id
     */
    preview: async (sectionId, file) => {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("section_id", sectionId);

        return asJson("POST", "/attendance/import/preview", fd, {
            headers: { "Content-Type": "multipart/form-data" },
        });
    },

    /**
     * POST /attendance/import/save
     * payload: { section_id, attendance_data }
     */
    save: async (sectionId, attendanceData) =>
        asJson("POST", "/attendance/import/save", {
            section_id: sectionId,
            attendance_data: attendanceData,
        }),
};
