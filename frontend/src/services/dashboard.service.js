// src/services/dashboard.service.js
// ═══════════════════════════════════════════════════════════════
// Servicio centralizado para dashboards.
//
//   ✅ = Ya existe en backend (reutiliza service existente)
//   🆕 = NUEVO — necesita endpoint en Django (ver dashboard_views.py)
//
// Todos los métodos 🆕 tienen .catch(() => null) para que el
// dashboard no explote si el endpoint aún no está implementado.
// ═══════════════════════════════════════════════════════════════

import api from "../lib/api";

// ── Re-exports de services existentes ──
export { getAdmissionDashboardStats } from "./admission.service";
export { Applications } from "./admission.service";
export { AcademicReports, Teacher } from "./academic.service";
export { FinanceDashboard as FinanceStats } from "./finance.service";
export { Receipts } from "./finance.service";
export { ProcedureReports, Procedures } from "./mesaPartes.service";
export { Stats as MineduStats, Exports as MineduExports } from "./minedu.service";
export { Reports as ResearchReports, Projects as ResearchProjects } from "./research.service";
export { UsersService } from "./users.service";

// ── helpers ──
const unwrap = (r) => r?.data;
const safe = (promise) => promise.catch((e) => {
    console.warn("[dashboard.service] endpoint no disponible:", e?.config?.url || e?.message);
    return null;
});

/* ═══════════════════════════════════════════════════════════════
   STUDENT DASHBOARD — 6 endpoints 🆕
   ═══════════════════════════════════════════════════════════════ */
export const StudentDashboardSvc = {
    /**
     * 🆕 GET /api/academic/student/dashboard/
     * Response: { avg_grade, credits_approved, credits_total, current_semester,
     *             career, enrolled_courses, attendance_rate, merit, total_in_career }
     */
    overview: () => safe(api.get("/academic/student/dashboard").then(unwrap)),

    /**
     * 🆕 GET /api/academic/student/grades/summary/
     * Response: { avg, credits_approved, credits_total,
     *             courses: [{ name, grade, credits, status }],
     *             competencies: [{ name, value }] }
     */
    grades: () => safe(api.get("/academic/student/grades/summary").then(unwrap)),

    /**
     * 🆕 GET /api/finance/student/balance/
     * Response: { pending, next_due, next_amount,
     *             payments: [{ concept, amount, status, due_date }] }
     */
    balance: () => safe(api.get("/finance/student/balance").then(unwrap)),

    /**
     * 🆕 GET /api/academic/student/schedule/
     * Response: { schedule: [{ day, name, time, end, room, course }] }
     */
    schedule: () => safe(api.get("/academic/student/schedule").then(unwrap)),

    /**
     * 🆕 GET /api/procedures/my/
     * Response: [{ type, code, status, date }]
     */
    procedures: () => safe(api.get("/procedures/my").then(unwrap)),

    /**
     * 🆕 GET /api/portal/announcements/active/
     * Response: [{ title, date, excerpt }]
     */
    announcements: () => safe(api.get("/portal/announcements/active").then(unwrap)),
};

/* ═══════════════════════════════════════════════════════════════
   TEACHER DASHBOARD — 1 ✅ + 2 🆕
   ═══════════════════════════════════════════════════════════════ */
export const TeacherDashboardSvc = {
    /**
     * 🆕 GET /api/academic/teacher/dashboard/
     * Response: { total_sections, total_students, attendance_today,
     *             grades_pending, syllabus_uploaded, syllabus_total,
     *             acts_pending, avg_grade,
     *             attendance_trend: [{ date, value }] }
     */
    overview: () => safe(api.get("/academic/teacher/dashboard").then(unwrap)),

    /**
     * ✅ GET /api/academic/teachers/me/sections/ (Teacher.sectionsMe)
     */
    sections: () => safe(api.get("/academic/teachers/me/sections").then(unwrap)),

    /**
     * 🆕 GET /api/academic/teacher/schedule/today/
     * Response: [{ name, time, end, room, students, section, code }]
     */
    scheduleToday: () => safe(api.get("/academic/teacher/schedule/today").then(unwrap)),
};

/* ═══════════════════════════════════════════════════════════════
   ACADEMIC ADMIN DASHBOARD — 3 🆕
   ═══════════════════════════════════════════════════════════════ */
export const AcademicDashboardSvc = {
    /**
     * 🆕 GET /api/academic/enrollment/stats/
     * Response: { enrolled, capacity, rate, approval_rate,
     *             by_career: [{ name, enrolled, capacity }] }
     */
    enrollmentStats: () => safe(api.get("/academic/enrollment/stats").then(unwrap)),

    /**
     * 🆕 GET /api/academic/acts/pending/
     * Response: { pending, closed,
     *             items: [{ name, code, teacher, students, period }] }
     */
    actsPending: () => safe(api.get("/academic/acts/pending").then(unwrap)),

    /**
     * 🆕 GET /api/academic/sections/conflicts/
     * Response: { total, items: [{ section1, section2, conflict_type }] }
     */
    conflicts: () => safe(api.get("/academic/sections/conflicts").then(unwrap)),
};

/* ═══════════════════════════════════════════════════════════════
   ADMISSION — ✅ usa services existentes
   ═══════════════════════════════════════════════════════════════ */
export const AdmissionDashboardSvc = {
    /** ✅ Applications.list con ordering */
    recentApplicants: () =>
        safe(api.get("/applications", { params: { page_size: 6, ordering: "-created_at" } }).then(unwrap)),
};

/* ═══════════════════════════════════════════════════════════════
   FINANCE — ✅ adapta Receipts.list o 🆕 simple
   ═══════════════════════════════════════════════════════════════ */
export const FinanceDashboardSvc = {
    /**
     * ✅ Puedes usar Receipts.list() y filtrar en frontend,
     *    o crear un endpoint simple GET /finance/payments/recent/
     */
    recentPayments: () =>
        safe(api.get("/finance/receipts", { params: { page_size: 8, ordering: "-created_at" } }).then(unwrap)),
};

/* ═══════════════════════════════════════════════════════════════
   MESA DE PARTES — ✅ usa Procedures.list
   ═══════════════════════════════════════════════════════════════ */
export const MpvDashboardSvc = {
    /** ✅ Procedures.list con ordering */
    recentProcedures: () =>
        safe(api.get("/procedures", { params: { page_size: 6, ordering: "-created_at" } }).then(unwrap)),
};

/* ═══════════════════════════════════════════════════════════════
   MINEDU — ✅ usa Exports.list
   ═══════════════════════════════════════════════════════════════ */
export const MineduDashboardSvc = {
    /** ✅ Exports.list con params */
    recentLogs: () =>
        safe(api.get("/minedu/exports", { params: { page_size: 10, ordering: "-created_at" } }).then(unwrap)),
};

/* ═══════════════════════════════════════════════════════════════
   RESEARCH — ✅ usa Projects.list
   ═══════════════════════════════════════════════════════════════ */
export const ResearchDashboardSvc = {
    /** ✅ Projects.list con params */
    recentProjects: () =>
        safe(api.get("/research/projects", { params: { page_size: 6, ordering: "-created_at" } }).then(unwrap)),
};