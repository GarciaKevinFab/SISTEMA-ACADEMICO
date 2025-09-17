// src/services/reports.service.js
import { generatePDFWithPolling, downloadFile } from "../utils/pdfQrPolling";

const BASE = process.env.REACT_APP_BACKEND_URL || "http://localhost:8001";
export const API = `${BASE}/api`;

function authHeaders(extra = {}) {
    const token = localStorage.getItem("token");
    const h = { ...extra };
    if (token) h["Authorization"] = `Bearer ${token}`;
    return h;
}

async function http(method, path, { qs, body, headers, isFormData } = {}) {
    const url = new URL(`${API}${path}`);
    if (qs) {
        Object.entries(qs).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== "") url.searchParams.append(k, v);
        });
    }
    const res = await fetch(url.toString(), {
        method,
        headers: isFormData
            ? authHeaders(headers)
            : authHeaders({ "Content-Type": "application/json", ...headers }),
        body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch { }
    if (!res.ok) {
        const msg = data?.detail || data?.message || `${res.status} ${res.statusText}`;
        const err = new Error(msg);
        err.response = { status: res.status, data };
        throw err;
    }
    return data;
}

// --------- Catálogos mínimos para combos en la UI ---------
export const Catalog = {
    periods: () => http("GET", "/catalogs/periods"),
    careers: () => http("GET", "/catalogs/careers"),
    sections: (params) => http("GET", "/catalogs/sections", { qs: params }), // period_id, career_id, course_id?
    courses: (params) => http("GET", "/catalogs/courses", { qs: params }),   // optional: career_id
    studentsSearch: (q, params) => http("GET", "/students/search", { qs: { q, ...params } }),
};

// --------- PDFs oficiales (con 202 + polling) -------------
export const OfficialPDF = {
    // Actas (académicas) por sección
    academicActa: (payload, opts = {}) =>
        generatePDFWithPolling("/reports/actas/academic", payload, { testId: "academic-acta", ...opts }),

    // Acta de Admisión (por convocatoria/proceso)
    admissionActa: (payload, opts = {}) =>
        generatePDFWithPolling("/reports/actas/admission", payload, { testId: "admission-acta", ...opts }),

    // Boleta de notas (por alumno + periodo)
    gradeSlip: (payload, opts = {}) =>
        generatePDFWithPolling("/reports/boletas/grades", payload, { testId: "boleta-pdf", ...opts }),

    // Constancia de matrícula (por alumno + periodo)
    enrollmentConstancy: (payload, opts = {}) =>
        generatePDFWithPolling("/reports/constancias/enrollment", payload, { testId: "constancia-matricula", ...opts }),

    // Kárdex (histórico de notas por alumno)
    kardex: (payload, opts = {}) =>
        generatePDFWithPolling("/reports/kardex", payload, { testId: "kardex-pdf", ...opts }),

    // Certificados (tipo parametrizable)
    certificate: (payload, opts = {}) =>
        generatePDFWithPolling("/reports/certificates", payload, { testId: "certificate-pdf", ...opts }),
};

// --------- Descargables Excel -----------------------------
export const ExcelExports = {
    // GET directo; si prefieres POST cambia aquí
    download: async (type, qs = {}, filename = `${type}.xlsx`) => {
        const url = new URL(`${API}/reports/export/${type}`);
        Object.entries(qs).forEach(([k, v]) => v != null && url.searchParams.append(k, v));
        const res = await fetch(url.toString(), { headers: authHeaders() });
        if (!res.ok) throw new Error(`Export failed: ${res.status}`);
        const blob = await res.blob();
        const dl = URL.createObjectURL(blob);
        await downloadFile(dl, filename);
        URL.revokeObjectURL(dl);
        return true;
    },
};
