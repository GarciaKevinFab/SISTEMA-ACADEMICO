// src/pages/DashboardHome.jsx
import React from "react";
import { useAuth } from "../context/AuthContext";
import { DashboardShell } from "./dashboards/DashboardWidgets";

const AdminDashboard = React.lazy(() => import("./dashboards/AdminDashboard"));
const AcademicDashboard = React.lazy(() => import("./dashboards/AcademicDashboard"));
const TeacherDashboard = React.lazy(() => import("./dashboards/TeacherDashboard"));
const StudentDashboard = React.lazy(() => import("./dashboards/StudentDashboard"));
const AdmissionDashboard = React.lazy(() => import("./dashboards/AdmissionDashboard"));
const FinanceDashboard = React.lazy(() => import("./dashboards/FinanceDashboard"));
const MesaPartesDashboard = React.lazy(() => import("./dashboards/MesaPartesDashboard"));
const ResearchDashboard = React.lazy(() => import("./dashboards/ResearchDashboard"));
const MineduDashboard = React.lazy(() => import("./dashboards/MineduDashboard"));

const ROLE_DASHBOARD_MAP = [
    { roles: ["ADMIN_SYSTEM"], component: AdminDashboard },
    { roles: ["ACCESS_ADMIN", "SECURITY_ADMIN"], component: AdminDashboard },
    { roles: ["ADMIN_ACADEMIC", "REGISTRAR"], component: AcademicDashboard },
    { roles: ["FINANCE_ADMIN", "ACCOUNTANT", "CASHIER"], component: FinanceDashboard },
    { roles: ["ADMISSION_OFFICER"], component: AdmissionDashboard },
    { roles: ["MPV_OFFICER", "MPV_MANAGER"], component: MesaPartesDashboard },
    { roles: ["RESEARCH_COORDINATOR", "TEACHER_RESEARCHER", "CALLS_COMMITTEE"], component: ResearchDashboard },
    { roles: ["MINEDU_INTEGRATION"], component: MineduDashboard },
    { roles: ["TEACHER"], component: TeacherDashboard },
    { roles: ["STUDENT"], component: StudentDashboard },
];

function resolveDashboard(userRoles = []) {
    for (const entry of ROLE_DASHBOARD_MAP) {
        if (entry.roles.some((r) => userRoles.includes(r))) return entry.component;
    }
    return null;
}

const LazyFallback = () => (
    <div className="h-[calc(100vh-64px)] flex items-center justify-center bg-slate-50/70">
        <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 border-[3px] border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
            <p className="text-sm font-semibold text-slate-400">Cargando dashboard…</p>
        </div>
    </div>
);

const DefaultDashboard = () => (
    <DashboardShell title="Panel Principal" subtitle="Bienvenido al sistema">
        <div className="rounded-3xl border border-slate-200/60 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-slate-100 grid place-items-center mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
                </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-800">¡Bienvenido!</h2>
            <p className="text-slate-500 mt-2 max-w-md mx-auto">
                Tu cuenta aún no tiene un rol asignado. Contacta al administrador para que te asigne los permisos.
            </p>
        </div>
    </DashboardShell>
);

export default function DashboardHome() {
    const { user, roles } = useAuth();
    const DashboardComponent = resolveDashboard(roles);
    if (!DashboardComponent) return <DefaultDashboard />;
    return (
        <React.Suspense fallback={<LazyFallback />}>
            <DashboardComponent user={user} roles={roles} />
        </React.Suspense>
    );
}