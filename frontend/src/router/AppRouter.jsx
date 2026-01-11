// src/router/AppRouter.jsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { RequireAuth, RequirePerm } from "./guards";
import { PERMS } from "../auth/permissions";

/* Públicas */
import Landing from "../components/Landing";
import Login from "../components/Login";

/* Layout privado */
import Layout from "../components/Layout";

/* Páginas */
import Forbidden from "../pages/Forbidden";
import DashboardHome from "../pages/DashboardHome";

/* Módulos */
import PublicAdmissionCalls from "../modules/admission/PublicAdmissionCalls";
import PublicAdmissionCallDetails from "../modules/admission/PublicAdmissionCallDetails"; // ✅ NUEVO
import AccessControlModule from "../modules/admin/AccessControlModule";

import CompleteAdmissionModule from "../modules/admission/CompleteAdmissionModule";
import ApplicantProfile from "../modules/admission/ApplicantProfile";

import AcademicModule from "../modules/academic/AcademicModule";
import EnrollmentComponent from "../modules/academic/EnrollmentComponent";
import GradesAttendanceComponent from "../modules/academic/GradesAttendanceComponent";

import MesaDePartesModule from "../modules/mesa-partes/MesaDePartesModule";
import FinanceModule from "../modules/finance/FinanceModule";
import MineduIntegrationModule from "../modules/minedu/MineduIntegrationModule";
import SecurityModule from "../modules/security/SecurityModule";
import PublicProcedureTracking from "../modules/mesa-partes/PublicProcedureTracking";
import ResearchModule from "../modules/research/ResearchModule";

// ✅ NUEVO: Módulo Estudiante
import StudentModule from "../modules/student/StudentModule";

/* Spinner inicial para sesión */
const ProtectedRoute = ({ children }) => {
    const { user, loading } = useAuth();
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            </div>
        );
    }
    if (!user) return <Navigate to="/login" replace />;
    return children;
};

export default function AppRouter() {
    return (
        <Routes>
            {/* Públicas */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />

            <Route path="/public/admission" element={<PublicAdmissionCalls />} />
            <Route path="/public/admission/:id" element={<PublicAdmissionCallDetails />} /> {/* ✅ NUEVO */}

            <Route path="/public/procedures/track" element={<PublicProcedureTracking />} />

            {/* 403 */}
            <Route path="/403" element={<Forbidden />} />

            {/* Protegidas */}
            <Route
                element={
                    <ProtectedRoute>
                        <Layout />
                    </ProtectedRoute>
                }
            >
                <Route path="/dashboard" element={<DashboardHome />} />
                <Route path="/dashboard/security" element={<SecurityModule />} />

                {/* Administración / Control de Accesos */}
                <Route
                    path="/dashboard/admin"
                    element={
                        <RequireAuth>
                            <RequirePerm any={[PERMS["admin.access.manage"], PERMS["admin.audit.view"]]}>
                                <AccessControlModule />
                            </RequirePerm>
                        </RequireAuth>
                    }
                />

                {/* ✅ NUEVO: Estudiante */}
                <Route
                    path="/dashboard/student"
                    element={
                        <RequireAuth>
                            <RequirePerm
                                any={[
                                    PERMS["student.profile.view"],
                                    PERMS["admin.access.manage"],
                                    PERMS["admin.catalogs.view"],
                                    PERMS["admin.catalogs.manage"],
                                    PERMS["admin.audit.view"],
                                    PERMS["academic.view"],
                                ].filter(Boolean)}
                                fallback={<Navigate to="/403" replace />}
                            >
                                <StudentModule />
                            </RequirePerm>
                        </RequireAuth>
                    }
                />

                {/* Académico */}
                <Route
                    path="/dashboard/academic"
                    element={
                        <RequirePerm
                            any={[
                                PERMS["academic.plans.view"],
                                PERMS["academic.sections.view"],
                                PERMS["academic.enrollment.view"],
                                PERMS["academic.grades.edit"],
                                PERMS["academic.kardex.view"],
                                PERMS["academic.reports.view"],
                            ]}
                        >
                            <AcademicModule />
                        </RequirePerm>
                    }
                />

                {/* Matrícula */}
                <Route
                    path="/dashboard/academic/enrollment"
                    element={
                        <RequirePerm any={[PERMS["academic.enrollment.view"], PERMS["academic.enrollment.commit"]]}>
                            <EnrollmentComponent />
                        </RequirePerm>
                    }
                />

                {/* Calificaciones/Asistencia */}
                <Route
                    path="/dashboard/academic/attendance"
                    element={
                        <RequirePerm
                            any={[
                                PERMS["academic.attendance.view"],
                                PERMS["academic.attendance.edit"],
                                PERMS["academic.grades.edit"],
                                PERMS["academic.grades.submit"],
                            ]}
                        >
                            <GradesAttendanceComponent />
                        </RequirePerm>
                    }
                />

                {/* Admisión */}
                <Route path="/dashboard/admission" element={<Navigate to="/dashboard/admission/dashboard" replace />} />
                <Route
                    path="/dashboard/admission/:tab"
                    element={
                        <RequirePerm
                            any={[
                                PERMS["admission.calls.view"],
                                PERMS["admission.calls.manage"],
                                PERMS["admission.applicants.manage"],
                                PERMS["admission.documents.review"],
                                PERMS["admission.results.publish"],
                                PERMS["admission.reports.view"],
                            ]}
                        >
                            <CompleteAdmissionModule />
                        </RequirePerm>
                    }
                />
                <Route
                    path="/dashboard/admission/profile"
                    element={
                        <RequirePerm any={[PERMS["admission.applicants.manage"]]}>
                            <ApplicantProfile />
                        </RequirePerm>
                    }
                />

                {/* Mesa de Partes */}
                <Route
                    path="/dashboard/procedures"
                    element={
                        <RequirePerm any={[PERMS["mpv.processes.review"], PERMS["mpv.processes.resolve"], PERMS["mpv.reports.view"]]}>
                            <MesaDePartesModule />
                        </RequirePerm>
                    }
                />
                <Route
                    path="/dashboard/mesa-partes"
                    element={
                        <RequirePerm any={[PERMS["mpv.processes.review"], PERMS["mpv.processes.resolve"], PERMS["mpv.reports.view"]]}>
                            <MesaDePartesModule />
                        </RequirePerm>
                    }
                />

                {/* Finanzas */}
                <Route
                    path="/dashboard/finance"
                    element={
                        <RequirePerm
                            any={[
                                PERMS["fin.cashbanks.view"],
                                PERMS["fin.reconciliation.view"],
                                PERMS["fin.student.accounts.view"],
                                PERMS["fin.reports.view"],
                                PERMS["fin.concepts.manage"],
                                PERMS["fin.payments.receive"],
                                PERMS["fin.electronic.invoice.issue"],
                                PERMS["fin.cash.movements"],
                                PERMS["fin.ar.manage"],
                                PERMS["fin.ap.manage"],
                            ]}
                        >
                            <FinanceModule />
                        </RequirePerm>
                    }
                />

                {/* MINEDU */}
                <Route
                    path="/dashboard/minedu"
                    element={
                        <RequirePerm
                            any={[
                                PERMS["minedu.integration.view"],
                                PERMS["minedu.integration.export"],
                                PERMS["minedu.integration.validate"],
                            ]}
                        >
                            <MineduIntegrationModule />
                        </RequirePerm>
                    }
                />

                {/* Investigación */}
                <Route
                    path="/dashboard/research"
                    element={
                        <RequirePerm
                            any={[
                                PERMS["research.calls.view"],
                                PERMS["research.calls.manage"],
                                PERMS["research.projects.view"],
                                PERMS["research.projects.edit"],
                                PERMS["research.tabs.reports"],
                            ]}
                        >
                            <ResearchModule />
                        </RequirePerm>
                    }
                />
            </Route>

            {/* 404 */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}
