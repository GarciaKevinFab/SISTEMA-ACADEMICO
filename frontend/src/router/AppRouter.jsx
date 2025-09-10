// src/router/AppRouter.jsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./../context/AuthContext";

/* Públicas */
import Landing from "../components/Landing";
import Login from "../components/Login";

/* Layout privado */
import Layout from "../components/Layout";

/* Módulos */
import InstitutionalPortal from "../modules/portal/InstitutionalPortal";
import PublicAdmissionCalls from "../modules/admission/PublicAdmissionCalls";
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

/* Guards */
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

const RoleRoute = ({ roles = [], children }) => {
    const { user } = useAuth();
    if (!user) return <Navigate to="/login" replace />;
    const allowed = roles.length === 0 || roles.includes(user.role) || user.role === "ADMIN";
    return allowed ? children : <Navigate to="/dashboard" replace />;
};

/* Home Dashboard */
const DashboardHome = () => (
    <div className="p-6">
        <h1 className="text-2xl font-bold">Dashboard Principal</h1>
        <p className="text-gray-600 mt-2">Bienvenido al Sistema Académico Integral</p>
    </div>
);

export default function AppRouter() {
    return (
        <Routes>
            {/* Públicas */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/portal" element={<InstitutionalPortal />} />
            <Route path="/public/admission" element={<PublicAdmissionCalls />} />
            <Route path="/public/procedures/track" element={<PublicProcedureTracking />} />

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

                {/* Administración */}
                <Route
                    path="/dashboard/admin"
                    element={
                        <RoleRoute roles={["ADMIN"]}>
                            <AccessControlModule />
                        </RoleRoute>
                    }
                />

                {/* Académico */}
                <Route path="/dashboard/academic" element={<AcademicModule />} />
                <Route path="/dashboard/academic/enrollment" element={<EnrollmentComponent />} />
                <Route path="/dashboard/academic/attendance" element={<GradesAttendanceComponent />} />

                {/* Admisión (solo estas tres) */}
                <Route path="/dashboard/admission" element={<Navigate to="/dashboard/admission/dashboard" replace />} />
                <Route path="/dashboard/admission/:tab" element={<CompleteAdmissionModule />} />
                <Route path="/dashboard/admission/profile" element={<ApplicantProfile />} />

                {/* Mesa de Partes */}
                <Route path="/dashboard/procedures" element={<MesaDePartesModule />} />
                <Route path="/dashboard/mesa-partes" element={<MesaDePartesModule />} />

                {/* Finanzas */}
                <Route path="/dashboard/finance" element={<FinanceModule />} />

                {/* MINEDU */}
                <Route
                    path="/dashboard/minedu"
                    element={
                        <RoleRoute roles={["REGISTRAR", "ADMIN"]}>
                            <MineduIntegrationModule />
                        </RoleRoute>
                    }
                />

                {/* Portal desde dashboard (opcional) */}
                <Route path="/dashboard/portal" element={<InstitutionalPortal />} />
            </Route>

            {/* 404 */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}
