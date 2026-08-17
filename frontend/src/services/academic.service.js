// src/services/academic.service.js
import api from "../lib/api";

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */

const pickFirstArray = (data, keys = []) => {
    if (Array.isArray(data)) return data;
    for (const k of keys) {
        if (Array.isArray(data?.[k])) return data[k];
    }
    return [];
};

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

const asBlobGet = async (url, params = {}) =>
    api.get(url, { params, responseType: "blob" });

const asBlobGetSmart = async (url, params = {}) => {
    try {
        return await asBlobGet(url, params);
    } catch (e) {
        const status = e?.response?.status;
        if (shouldRetryBySlash(status)) {
            const altUrl = toggleSlash(url);
            try {
                return await asBlobGet(altUrl, params);
            } catch (e2) {
                throw wrapAxiosError(e2);
            }
        }
        throw wrapAxiosError(e);
    }
};


/* ═══════════════════════════════════════════════════════════════
   CARRERAS
   ═══════════════════════════════════════════════════════════════ */
export const Careers = {
    list: async () => {
        const data = await requestJsonSmart("GET", "/academic/careers", null);
        return { careers: pickFirstArray(data, ["careers", "items", "results"]) };
    },
    create: async (payload) => requestJsonSmart("POST", "/academic/careers", payload),
    update: async (id, payload) => requestJsonSmart("PUT", `/academic/careers/${id}`, payload),
    remove: async (id) => requestJsonSmart("DELETE", `/academic/careers/${id}`, null),
    toggleActive: async (id) => requestJsonSmart("POST", `/academic/careers/${id}/toggle-active`, {}),
};


/* ═══════════════════════════════════════════════════════════════
   CURSOS (catálogo)
   ═══════════════════════════════════════════════════════════════ */
export const Courses = {
    list: async (params = {}) => {
        const data = await requestJsonSmart("GET", "/academic/courses", null, { params });
        return { items: pickFirstArray(data, ["items", "courses", "results"]) };
    },
};


/* ═══════════════════════════════════════════════════════════════
   PLANES (mallas)
   ═══════════════════════════════════════════════════════════════ */
export const Plans = {
    list: async () => {
        const data = await requestJsonSmart("GET", "/academic/plans", null);
        const root = data?.data ?? data?.payload ?? data;
        const arr =
            pickFirstArray(root, ["plans", "items", "results"]) ||
            pickFirstArray(data, ["plans", "items", "results"]) ||
            [];
        return { plans: Array.isArray(arr) ? arr : [] };
    },

    create: async (payload) => requestJsonSmart("POST", "/academic/plans", payload),
    update: async (id, payload) => requestJsonSmart("PATCH", `/academic/plans/${id}`, payload),
    updatePut: async (id, payload) => requestJsonSmart("PUT", `/academic/plans/${id}`, payload),
    remove: async (id) => requestJsonSmart("DELETE", `/academic/plans/${id}`, null),

    listCourses: async (planId, params) =>
        requestJsonSmart("GET", `/academic/plans/${planId}/courses`, null, { params: params || undefined }),

    listAllCourses: async (planId, params) =>
        requestJsonSmart("GET", `/academic/plans/${planId}/courses`, null, {
            params: { all: 1, ...(params || {}) },
        }),

    addCourse: async (planId, payload) => requestJsonSmart("POST", `/academic/plans/${planId}/courses`, payload),
    updateCourse: async (planId, courseId, payload) => requestJsonSmart("PUT", `/academic/plans/${planId}/courses/${courseId}`, payload),
    removeCourse: async (planId, courseId) => requestJsonSmart("DELETE", `/academic/plans/${planId}/courses/${courseId}`, null),
    setPrereqs: async (planId, courseId, prereqIds) => requestJsonSmart("PUT", `/academic/plans/${planId}/courses/${courseId}/prereqs`, { prerequisites: prereqIds }),
    listPrereqs: async (planId, courseId) => requestJsonSmart("GET", `/academic/plans/${planId}/courses/${courseId}/prereqs`, null),
};


/* ═══════════════════════════════════════════════════════════════
   SECCIONES / HORARIOS
   ═══════════════════════════════════════════════════════════════ */
export const Sections = {
    list: async (params = {}) => {
        const data = await requestJsonSmart("GET", "/academic/sections", null, { params });
        return { sections: pickFirstArray(data, ["sections", "items", "results"]) };
    },

    create: async (payload) => requestJsonSmart("POST", "/academic/sections", payload),
    update: async (id, payload) => requestJsonSmart("PUT", `/academic/sections/${id}`, payload),
    patch: async (id, payload) => requestJsonSmart("PATCH", `/academic/sections/${id}`, payload),
    remove: async (id) => requestJsonSmart("DELETE", `/academic/sections/${id}`, null),
    checkConflicts: async (payload) => requestJsonSmart("POST", "/academic/sections/schedule/conflicts", payload),
    listSchedule: async (sectionId) => requestJsonSmart("GET", `/academic/sections/${sectionId}/schedule`, null),
    setSchedule: async (sectionId, slots) => requestJsonSmart("PUT", `/academic/sections/${sectionId}/schedule`, { slots }),

    windowStatus: async (sectionId) =>
        requestJsonSmart("GET", `/academic/sections/${sectionId}/window-status`, null),

    rooms: async () => {
        const data = await requestJsonSmart("GET", "/academic/classrooms", null);
        return { classrooms: pickFirstArray(data, ["classrooms", "items", "results"]) };
    },
    teachers: async () => {
        const data = await requestJsonSmart("GET", "/academic/teachers", null);
        return { teachers: pickFirstArray(data, ["teachers", "items", "results"]) };
    },
};


/* ═══════════════════════════════════════════════════════════════
   PERÍODOS ACADÉMICOS + VENTANA DE MATRÍCULA
   ═══════════════════════════════════════════════════════════════ */
export const Periods = {
    list: async () =>
        requestJsonSmart("GET", "/academic/periods", null),

    getEnrollmentWindow: async (code) =>
        requestJsonSmart("GET", `/academic/periods/${code}/enrollment-window`, null),

    setEnrollmentWindow: async (code, payload) =>
        requestJsonSmart("PUT", `/academic/periods/${code}/enrollment-window`, payload),
};


/* ═══════════════════════════════════════════════════════════════
   MATRÍCULA
   ═══════════════════════════════════════════════════════════════ */
export const Enrollment = {
    available: async (params = {}) =>
        requestJsonSmart("GET", "/academic/enrollments/available", null, { params }),

    validate: async (payload) =>
        requestJsonSmart("POST", "/academic/enrollments/validate", payload),

    commit: async (payload) =>
        requestJsonSmart("POST", "/academic/enrollments/commit", payload),

    suggestions: async (payload) =>
        requestJsonSmart("POST", "/academic/enrollments/suggestions", payload),

    /**
     * Lista todos los alumnos con su estado de matrícula en el período.
     * Solo disponible para admins.
     *
     * @param {object} params
     * @param {string} params.academic_period  — requerido, ej: "2026-I"
     * @param {string} [params.search]         — filtra por nombre o DNI
     * @param {number} [params.career_id]      — filtra por carrera
     * @param {number} [params.page]           — default 1
     * @param {number} [params.page_size]      — default 200, max 500
     *
     * @returns {{ academic_period, total, page, page_size, students[] }}
     *
     * Cada student:
     *   id, full_name, dni, career_name, career_id, plan_name, plan_id,
     *   semester, is_enrolled, enrollment_id,
     *   enrolled_courses_count, enrolled_credits
     */
    studentsOverview: async (params = {}) =>
        requestJsonSmart("GET", "/academic/enrollments/students-overview", null, { params }),

    /** Genera fichas de matrícula en lote (ZIP). Solo admin. */
    generateFichas: async (payload) =>
        api.post("/academic/enrollments/generate-fichas", payload, { responseType: "blob" }),

    /**
     * Reinicia la matrícula de un alumno: elimina enrollment, payment y registros financieros.
     * Solo admin.
     * @param {{ student_id: number, period: string }} payload
     */
    resetStudent: async (payload) =>
        requestJsonSmart("POST", "/academic/enrollments/reset-student", payload),
};


/* ═══════════════════════════════════════════════════════════════
   KÁRDEX / PDFs
   ═══════════════════════════════════════════════════════════════ */
export const Kardex = {
    ofStudent: (studentKey) => requestJsonSmart("GET", `/academic/kardex/${studentKey}`, null),
    exportXlsx: (studentKey, params) => api.get(`/academic/kardex/${studentKey}/export/xlsx`, { params, responseType: "blob" }),
    exportBoletaPdf: (studentKey) => asBlobGetSmart(`/academic/kardex/${studentKey}/boleta/pdf`),
    exportBoletaPeriodoPdf: (studentKey, period) => asBlobGetSmart(`/academic/kardex/${studentKey}/boleta/periodo/pdf`, { period }),
    exportConstanciaPdf: (studentKey) => asBlobGetSmart(`/academic/kardex/${studentKey}/constancia/pdf`),
    exportBoletaAnioPdf: (studentKey, period) => asBlobGetSmart(`/academic/kardex/${studentKey}/boleta/anio/pdf`, { period }),
    exportRecordNotasPdf: (studentKey) => asBlobGetSmart(`/academic/kardex/${studentKey}/record-notas/pdf`),
    exportFichaRendimientoPdf: (studentKey) => asBlobGetSmart(`/academic/kardex/${studentKey}/ficha-rendimiento/pdf`),
};


/* ═══════════════════════════════════════════════════════════════
   PROCESOS ACADÉMICOS — 17 tipos en 4 grupos
   ═══════════════════════════════════════════════════════════════ */
export const Processes = {
    create: async (type, data) => requestJsonSmart("POST", `/academic/processes/${type}/create`, data),
    types: async () => requestJsonSmart("GET", "/academic/processes/types", null),

    // ── Legacy (compatibilidad) ──
    retiro: async (p) => requestJsonSmart("POST", "/academic/processes/withdraw", p),
    reserva: async (p) => requestJsonSmart("POST", "/academic/processes/reservation", p),
    convalidacion: async (p) => requestJsonSmart("POST", "/academic/processes/validation", p),
    traslado: async (p) => requestJsonSmart("POST", "/academic/processes/transfer", p),
    reincorporacion: async (p) => requestJsonSmart("POST", "/academic/processes/rejoin", p),

    // ── Movimientos del alumno ──
    reingreso: async (p) => requestJsonSmart("POST", "/academic/processes/reingreso", p),
    bajaDefinitiva: async (p) => requestJsonSmart("POST", "/academic/processes/baja-definitiva", p),
    trasladoInterno: async (p) => requestJsonSmart("POST", "/academic/processes/traslado-interno", p),
    cambioPrograma: async (p) => requestJsonSmart("POST", "/academic/processes/cambio-programa", p),

    // ── Matrícula ──
    anulacionMatricula: async (p) => requestJsonSmart("POST", "/academic/processes/anulacion-matricula", p),
    rectificacionMatricula: async (p) => requestJsonSmart("POST", "/academic/processes/rectificacion-matricula", p),
    matriculaExtemporanea: async (p) => requestJsonSmart("POST", "/academic/processes/matricula-extemporanea", p),

    // ── Notas / Actas ──
    reaperturaActa: async (p) => requestJsonSmart("POST", "/academic/processes/reapertura-acta", p),
    rectificacionNota: async (p) => requestJsonSmart("POST", "/academic/processes/rectificacion-nota", p),
    anulacionEvaluacion: async (p) => requestJsonSmart("POST", "/academic/processes/anulacion-evaluacion", p),
    notaSubsanacion: async (p) => requestJsonSmart("POST", "/academic/processes/nota-subsanacion", p),

    // ── Convalidaciones / Equivalencias ──
    equivalencia: async (p) => requestJsonSmart("POST", "/academic/processes/equivalencia", p),
    trasladoExterno: async (p) => requestJsonSmart("POST", "/academic/processes/traslado-externo", p),
};


/* ═══════════════════════════════════════════════════════════════
   SÍLABOS & EVALUACIÓN
   ═══════════════════════════════════════════════════════════════ */
export const Syllabus = {
    get: async (sectionId) =>
        requestJsonSmart("GET", `/academic/sections/${sectionId}/syllabus`, null),

    upload: async (sectionId, file) => {
        const fd = new FormData();
        fd.append("file", file);
        return requestJsonSmart("POST", `/academic/sections/${sectionId}/syllabus`, fd, {
            headers: { "Content-Type": "multipart/form-data" },
        });
    },

    delete: async (sectionId) =>
        requestJsonSmart("DELETE", `/academic/sections/${sectionId}/syllabus`, null),

    /** GET /academic/students/me/syllabuses — sílabos de cursos matriculados del alumno */
    mine: async () =>
        requestJsonSmart("GET", `/academic/students/me/syllabuses`, null),
};

export const Evaluation = {
    getConfig: async (sectionId) =>
        requestJsonSmart("GET", `/academic/sections/${sectionId}/evaluation`, null),

    setConfig: async (sectionId, config) =>
        requestJsonSmart("PUT", `/academic/sections/${sectionId}/evaluation`, { config }),
};


/* ═══════════════════════════════════════════════════════════════
   ASISTENCIA
   ═══════════════════════════════════════════════════════════════ */
export const Attendance = {
    createSession: async (sectionId, payload = {}) =>
        requestJsonSmart("POST", `/academic/sections/${sectionId}/attendance/sessions`, payload),

    listSessions: async (sectionId) =>
        requestJsonSmart("GET", `/academic/sections/${sectionId}/attendance/sessions`, null),

    closeSession: async (sectionId, sessionId) =>
        requestJsonSmart("POST", `/academic/sections/${sectionId}/attendance/sessions/${sessionId}/close`, {}),

    set: async (sectionId, sessionId, rows) =>
        requestJsonSmart("PUT", `/academic/sections/${sectionId}/attendance/sessions/${sessionId}`, { rows }),

    // ── Admin: monitoreo global y detalle por sección (>30% = DPI) ──
    adminOverview: async (params = {}) =>
        requestJsonSmart("GET", "/academic/admin/attendance/overview", null, { params }),
    adminSectionDetail: async (sectionId) =>
        requestJsonSmart("GET", `/academic/admin/attendance/section/${sectionId}`),
    applyDpi: async (sectionId, payload = {}) =>
        requestJsonSmart("POST", `/academic/admin/attendance/section/${sectionId}/apply-dpi`, payload),
};

export const AttendanceImport = {
    preview: async (sectionId, file) => {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("section_id", sectionId);
        return requestJsonSmart("POST", "/academic/attendance/import/preview", fd, {
            headers: { "Content-Type": "multipart/form-data" },
        });
    },
    save: async (sectionId, attendanceData) =>
        requestJsonSmart("POST", "/academic/attendance/import/save", {
            section_id: sectionId,
            attendance_data: attendanceData,
        }),
};


/* ═══════════════════════════════════════════════════════════════
   PROCESOS — BANDEJA / ARCHIVOS / ESTADO
   ═══════════════════════════════════════════════════════════════ */
export const ProcessFiles = {
    list: async (processId) =>
        requestJsonSmart("GET", `/academic/processes/${processId}/files`, null),

    upload: async (processId, file, meta = {}) => {
        const fd = new FormData();
        fd.append("file", file);
        if (meta.note) fd.append("note", meta.note);
        return requestJsonSmart("POST", `/academic/processes/${processId}/files`, fd, {
            headers: { "Content-Type": "multipart/form-data" },
        });
    },

    remove: async (processId, fileId) =>
        requestJsonSmart("DELETE", `/academic/processes/${processId}/files/${fileId}`, null),

    generate: async (processId, opts = {}) =>
        requestJsonSmart("POST", `/academic/processes/${processId}/generate-document`, opts),
};

export const ProcessesInbox = {
    myRequests: async (params = {}) =>
        requestJsonSmart("GET", "/academic/processes/my", null, { params }),

    listAll: async (params = {}) =>
        requestJsonSmart("GET", "/academic/processes", null, { params }),

    get: async (id) =>
        requestJsonSmart("GET", `/academic/processes/${id}`, null),

    setStatus: async (id, payload) =>
        requestJsonSmart("POST", `/academic/processes/${id}/status`, payload),

    updateStatus: async (id, payload) =>
        requestJsonSmart("POST", `/academic/processes/${id}/status`, payload),

    notify: async (id, payload) =>
        requestJsonSmart("POST", `/academic/processes/${id}/notify`, payload),

    files: async (pid) =>
        requestJsonSmart("GET", `/academic/processes/${pid}/files`, null),

    uploadFile: async (pid, formData) =>
        requestJsonSmart("POST", `/academic/processes/${pid}/files`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
        }),

    deleteFile: async (pid, fileId) =>
        requestJsonSmart("DELETE", `/academic/processes/${pid}/files/${fileId}`, null),

    dashboard: async () =>
        requestJsonSmart("GET", "/academic/processes/dashboard", null),

    types: async () =>
        requestJsonSmart("GET", "/academic/processes/types", null),
};


/* ═══════════════════════════════════════════════════════════════
   REPORTES
   ═══════════════════════════════════════════════════════════════ */
export const AcademicReports = {
    summary: async (params) => {
        const data = await requestJsonSmart("GET", "/academic/reports/summary", null, { params });
        return data?.summary ?? data;
    },
    careers: async () => {
        const data = await requestJsonSmart("GET", "/academic/careers", null);
        return data?.careers ?? [];
    },
    exportPerformance: async (params) =>
        api.get("/academic/reports/performance.xlsx", { params, responseType: "blob" }),
    exportOccupancy: async (params) =>
        api.get("/academic/reports/occupancy.xlsx", { params, responseType: "blob" }),
    exportNominaMinedu: async (params) =>
        api.get("/academic/reports/nominas.xlsx", { params, responseType: "blob" }),
    exportNominaMineduPdf: async (params) =>
        api.get("/academic/reports/nominas.pdf", { params, responseType: "blob" }),
    exportStudentsData: async (params) =>
        api.get("/academic/reports/students-data.xlsx", { params, responseType: "blob" }),
    /** Listas de matrícula por tipo (regular | subsanacion | reincorporacion-traslado) */
    exportMatriculaTipo: async (params) =>
        api.get("/academic/reports/matricula-tipo.xlsx", { params, responseType: "blob" }),
    exportMatriculaTipoPdf: async (params) =>
        api.get("/academic/reports/matricula-tipo.pdf", { params, responseType: "blob" }),
    exportReporteMinedu: async (params) =>
        api.get("/academic/reports/reporte-minedu.xlsx", { params, responseType: "blob" }),
    exportFichasRendimientoZip: async (params) =>
        api.get("/academic/reports/fichas-rendimiento.zip", { params, responseType: "blob" }),
    exportFichaRendimientoIndividual: async (studentKey) =>
        api.get(`/academic/kardex/${studentKey}/ficha-rendimiento/pdf`, { responseType: "blob" }),
};


/* ═══════════════════════════════════════════════════════════════
   DOCENTES / NOTAS / ACTAS
   ═══════════════════════════════════════════════════════════════ */
export const Teacher = {
    sections: async (teacherUserId) => {
        const data = await requestJsonSmart("GET", `/academic/teachers/${teacherUserId}/sections`, null);
        return { sections: pickFirstArray(data, ["sections", "items", "results"]) };
    },
    sectionsMe: async () =>
        requestJsonSmart("GET", "/academic/teachers/me/sections", null),
};

/* ── Registro por Excel estilo SIAGIE: plantilla prellenada + carga ── */
export const ActaExcel = {
    gradesTemplate: (sectionId, params = {}) =>
        api.get(`/academic/sections/${sectionId}/grades/plantilla`, { params, responseType: "blob" }),

    gradesImport: (sectionId, file) => {
        const fd = new FormData();
        fd.append("file", file);
        return requestJsonSmart("POST", `/academic/sections/${sectionId}/grades/importar`, fd, {
            headers: { "Content-Type": "multipart/form-data" },
        });
    },

    attendanceTemplate: (sectionId, month) =>
        api.get(`/academic/sections/${sectionId}/attendance/plantilla`, {
            params: month ? { month } : {},
            responseType: "blob",
        }),

    attendanceImport: (sectionId, file) => {
        const fd = new FormData();
        fd.append("file", file);
        return requestJsonSmart("POST", `/academic/sections/${sectionId}/attendance/importar`, fd, {
            headers: { "Content-Type": "multipart/form-data" },
        });
    },

    /** Plantilla del ciclo completo: una hoja por curso */
    cicloTemplate: (params) =>
        api.get("/academic/acta-excel/notas/plantilla", { params, responseType: "blob" }),

    /** Importa notas de cualquier plantilla (una sección o ciclo completo) */
    importNotas: (file) => {
        const fd = new FormData();
        fd.append("file", file);
        return requestJsonSmart("POST", "/academic/acta-excel/notas/importar", fd, {
            headers: { "Content-Type": "multipart/form-data" },
        });
    },
};

export const SectionStudents = {
    list: async (sectionId) => {
        const data = await requestJsonSmart("GET", `/academic/sections/${sectionId}/students`, null);
        return { students: pickFirstArray(data, ["students", "items", "results"]) };
    },
};

export const Grades = {
    get: async (sectionId) => requestJsonSmart("GET", `/academic/sections/${sectionId}/grades`, null),
    save: async (sectionId, grades) => requestJsonSmart("POST", "/academic/grades/save", { section_id: sectionId, grades }),
    submit: async (sectionId, grades) => requestJsonSmart("POST", "/academic/grades/submit", { section_id: sectionId, grades }),
    reopen: async (sectionId) => requestJsonSmart("POST", "/academic/grades/reopen", { section_id: sectionId }),

    // Admin: monitoreo global de notas
    adminOverview: async (params = {}) =>
        requestJsonSmart("GET", "/academic/admin/grades/overview", null, { params }),
    adminSectionDetail: async (sectionId) =>
        requestJsonSmart("GET", `/academic/admin/grades/section/${sectionId}`),
    // Admin: ventana de carga de notas por periodo
    getWindow: async (code) =>
        requestJsonSmart("GET", `/academic/periods/${code}/grades-window`),
    setWindow: async (code, payload) =>
        requestJsonSmart("PUT", `/academic/periods/${code}/grades-window`, payload),

    // Notas históricas (admin)
    listHistorical: async (studentId) =>
        requestJsonSmart("GET", `/academic/grades/historical?student_id=${studentId}`, null),
    saveHistorical: async (payload) =>
        requestJsonSmart("POST", "/academic/grades/historical", payload),
    deleteHistorical: async (recordId) =>
        requestJsonSmart("DELETE", `/academic/grades/historical/${recordId}`, null),
    /** Borrar todos los registros del alumno en los periodos indicados (reingreso/cachimbo) */
    bulkDeleteHistorical: async (studentId, terms) =>
        requestJsonSmart("POST", "/academic/grades/historical/bulk-delete", {
            student_id: studentId,
            terms,
        }),
};

/* ═══════════════════════════════════════════════════════════════
   CENTRO DE EVALUACIÓN (admin, tipo SIAGIE)
   ═══════════════════════════════════════════════════════════════ */
export const EvaluationAdmin = {
    /** Estado del período: grades_state, ventana y estadísticas globales */
    state: async (period) =>
        requestJsonSmart("GET", "/academic/admin/evaluation/state", null, { params: { period } }),
    /** Habilitar ("open") o cerrar ("close") el registro de calificaciones */
    setState: async (period, action) =>
        requestJsonSmart("POST", "/academic/admin/evaluation/state", { period, action }),
    /** Secciones del período con su estado de carga/acta/procesamiento */
    sections: async (params = {}) =>
        requestJsonSmart("GET", "/academic/admin/evaluation/sections", null, { params }),
    /** Procesa actas → kárdex (todas, o section_ids seleccionadas) */
    process: async (payload) =>
        requestJsonSmart("POST", "/academic/admin/evaluation/process", payload),
    /** ZIP masivo de boletas de calificaciones del período */
    boletasZip: async (params = {}) =>
        api.get("/academic/admin/evaluation/boletas.zip", { params, responseType: "blob" }),
    /** Acta consolidada de evaluación: Excel con una hoja por sección */
    actaConsolidada: async (params = {}) =>
        api.get("/academic/admin/evaluation/actas.xlsx", { params, responseType: "blob" }),
    /** ZIP de Actas de Evaluación de Área (un Excel por curso del filtro) */
    actasAreaZip: async (params = {}) =>
        api.get("/academic/admin/evaluation/actas-area.zip", { params, responseType: "blob" }),
    /** ZIP de Actas de Calificación (Anexo 3) SOLO subsanación */
    actasCalificacionSubsaZip: async (params = {}) =>
        api.get("/academic/admin/evaluation/actas-calificacion-subsanacion.zip",
            { params, responseType: "blob" }),
    /** ZIP de Actas de Calificación (Anexo 3) SOLO subsanación, en PDF */
    actasCalificacionSubsaPdfZip: async (params = {}) =>
        api.get("/academic/admin/evaluation/actas-calificacion-subsanacion-pdf.zip",
            { params, responseType: "blob" }),
    /** Acta de Calificación (Anexo 3) de UNA sección en PDF (params: subsanacion=1) */
    actaCalificacionPdf: async (sectionId, params = {}) =>
        api.get(`/academic/sections/${sectionId}/acta-calificacion.pdf`,
            { params, responseType: "blob" }),
    /** ZIP de Actas de Evaluación de Área en PDF (una por curso del filtro) */
    actasAreaPdfZip: async (params = {}) =>
        api.get("/academic/admin/evaluation/actas-area-pdf.zip", { params, responseType: "blob" }),
    /** Acta de Evaluación de Área de UNA sección (params: subsanacion=1) */
    actaArea: async (sectionId, params = {}) =>
        api.get(`/academic/sections/${sectionId}/acta-area.xlsx`, { params, responseType: "blob" }),
    /** Reporte de rendimiento académico (resumen por curso + detalle por alumno) */
    reporteRendimiento: async (params = {}) =>
        api.get("/academic/admin/evaluation/rendimiento.xlsx", { params, responseType: "blob" }),
    /** Monitor admin: sílabos y sesiones de aprendizaje subidos por sección */
    silabosSesiones: async (params = {}) =>
        requestJsonSmart("GET", "/academic/admin/evaluation/silabos-sesiones",
            null, { params }),

    /* ── Versiones PDF ── */
    actaConsolidadaPdf: async (params = {}) =>
        api.get("/academic/admin/evaluation/actas.pdf", { params, responseType: "blob" }),
    /** Orden de mérito: aula (carrera+ciclo) / especialidad (carrera) / instituto (sin filtros) */
    meritoPdf: async (params = {}) =>
        api.get("/academic/admin/evaluation/merito.pdf", { params, responseType: "blob" }),
    meritoXlsx: async (params = {}) =>
        api.get("/academic/admin/evaluation/merito.xlsx", { params, responseType: "blob" }),
    rendimientoPdf: async (params = {}) =>
        api.get("/academic/admin/evaluation/rendimiento.pdf", { params, responseType: "blob" }),
    actaAreaPdf: async (sectionId, params = {}) =>
        api.get(`/academic/sections/${sectionId}/acta-area.pdf`, { params, responseType: "blob" }),
    /* ── Excel complementarios ── */
    boletasXlsx: async (params = {}) =>
        api.get("/academic/admin/evaluation/boletas.xlsx", { params, responseType: "blob" }),
    fichasXlsx: async (params = {}) =>
        api.get("/academic/admin/evaluation/fichas.xlsx", { params, responseType: "blob" }),
    /* ── Méritos y becas ── */
    primerosLugares: async (params = {}) =>
        api.get("/academic/admin/evaluation/primeros-lugares", { params, responseType: "blob" }),
    tercioQuinto: async (params = {}) =>
        api.get("/academic/admin/evaluation/tercio-quinto", { params, responseType: "blob" }),
    constanciasBeca: async (params = {}) =>
        api.get("/academic/admin/evaluation/constancias-beca.zip", { params, responseType: "blob" }),
    /* ── Reporte de asistencia ── */
    asistenciaPdf: async (params = {}) =>
        api.get("/academic/admin/evaluation/asistencia.pdf", { params, responseType: "blob" }),
    asistenciaXlsx: async (params = {}) =>
        api.get("/academic/admin/evaluation/asistencia.xlsx", { params, responseType: "blob" }),
};

/* ═══════════════════════════════════════════════════════════════
   EGRESADOS / CERTIFICADO DE EGRESADO
   ═══════════════════════════════════════════════════════════════ */
export const Graduates = {
    listEligible: async (params = {}) =>
        requestJsonSmart("GET", "/academic/graduates/eligible", null, { params }),
    bulkEmit: async (student_ids, force = false) =>
        requestJsonSmart("POST", "/academic/graduates/bulk-emit", { student_ids, force }),
};


/* ═══════════════════════════════════════════════════════════════
   PAGO DE MATRÍCULA
   ═══════════════════════════════════════════════════════════════ */
export const EnrollmentPayment = {
    /** Estudiante: estado de su pago para el periodo */
    status: async (params = {}) =>
        requestJsonSmart("GET", "/academic/enrollment-payment/status", null, { params }),

    /** Estudiante: subir voucher (FormData con period, channel, operation_code, voucher) */
    upload: async (formData) =>
        requestJsonSmart("POST", "/academic/enrollment-payment/upload", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        }),

    /** Estudiante: re-subir voucher tras rechazo */
    reUpload: async (formData) =>
        requestJsonSmart("POST", "/academic/enrollment-payment/re-upload", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        }),

    /** Finanzas: lista pagos pendientes */
    pending: async (params = {}) =>
        requestJsonSmart("GET", "/academic/enrollment-payment/pending", null, { params }),

    /** Finanzas: detalle de un pago */
    detail: async (id) =>
        requestJsonSmart("GET", `/academic/enrollment-payment/${id}`, null),

    /** Finanzas: aprobar un pago */
    approve: async (id) =>
        requestJsonSmart("POST", `/academic/enrollment-payment/${id}/approve`, {}),

    /** Finanzas: rechazar un pago */
    reject: async (id, note) =>
        requestJsonSmart("POST", `/academic/enrollment-payment/${id}/reject`, { note }),

    /** Finanzas: eliminar un pago (solo si no está aprobado) */
    remove: async (id) =>
        requestJsonSmart("DELETE", `/academic/enrollment-payment/${id}/delete`, null),
};