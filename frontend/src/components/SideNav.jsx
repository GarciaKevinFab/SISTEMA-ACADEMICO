// src/components/SideNav.jsx
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  GraduationCap, FileText, Calculator, BarChart3, User,
  BookOpen, Building, Database, LogOut, Shield
} from "lucide-react";
import { PERMS } from "../auth/permissions";

const SideNav = () => {
  const { user, roles = [], logout, hasAny, permissions = [] } = useAuth();
  const location = useLocation();

  const hasRole = (...codes) => codes.some((r) => roles.includes(r));
  const permsReady = permissions.length > 0;

  const canSecurity = hasAny([
    PERMS["admin.access.manage"], PERMS["admin.audit.view"],
    PERMS["security.policies.manage"], PERMS["security.sessions.inspect"],
  ]) || hasRole("ADMIN_SYSTEM", "ACCESS_ADMIN", "SECURITY_ADMIN");

  const canAdmin = hasAny([PERMS["admin.access.manage"], PERMS["admin.audit.view"]])
    || hasRole("ADMIN_SYSTEM", "ACCESS_ADMIN");

  const canAcademic = hasAny([
    PERMS["academic.plans.view"], PERMS["academic.sections.view"],
    PERMS["academic.enrollment.view"], PERMS["academic.grades.edit"],
    PERMS["academic.kardex.view"], PERMS["academic.reports.view"],
    PERMS["academic.view"],
  ]) || hasRole("ADMIN_SYSTEM", "ADMIN_ACADEMIC", "REGISTRAR", "TEACHER");

  const canAdmission = hasAny([
    PERMS["admission.calls.view"], PERMS["admission.calls.manage"],
    PERMS["admission.applicants.manage"], PERMS["admission.documents.review"],
    PERMS["admission.schedule.manage"], PERMS["admission.evaluation.board"],
    PERMS["admission.results.publish"], PERMS["admission.reports.view"],
  ]) || hasRole("ADMIN_SYSTEM", "ADMISSION_OFFICER");

  const canMPV = hasAny([
    PERMS["mpv.processes.review"], PERMS["mpv.processes.resolve"], PERMS["mpv.reports.view"],
  ]) || hasRole("ADMIN_SYSTEM", "MPV_OFFICER", "MPV_MANAGER");

  const canFinance = hasAny([
    PERMS["fin.cashbanks.view"], PERMS["fin.reconciliation.view"],
    PERMS["fin.student.accounts.view"], PERMS["fin.reports.view"],
    PERMS["fin.concepts.manage"], PERMS["fin.payments.receive"],
    PERMS["fin.cash.movements"], PERMS["fin.electronic.invoice.issue"],
    PERMS["fin.ar.manage"], PERMS["fin.ap.manage"], PERMS["fin.inventory.view"],
    PERMS["fin.inventory.manage"], PERMS["fin.logistics.view"],
    PERMS["logistics.procure.manage"], PERMS["logistics.warehouse.dispatch"],
    PERMS["hr.view"], PERMS["hr.people.manage"], PERMS["hr.payroll.view"],
    "finance.dashboard.view",
  ]) || hasRole("ADMIN_SYSTEM", "FINANCE_ADMIN", "ACCOUNTANT", "CASHIER");

  const canMinedu = hasAny([PERMS["minedu.integration.view"], PERMS["minedu.integration.export"], PERMS["minedu.integration.validate"]])
    || hasRole("ADMIN_SYSTEM", "MINEDU_INTEGRATION");
  const canResearch = hasAny([PERMS["research.calls.view"], PERMS["research.calls.manage"], PERMS["research.projects.view"], PERMS["research.projects.edit"], PERMS["research.tabs.reports"]])
    || hasRole("ADMIN_SYSTEM", "RESEARCH_COORDINATOR", "TEACHER_RESEARCHER");

  const isActive = (path) => path === "/dashboard"
    ? location.pathname === "/dashboard"
    : location.pathname.startsWith(path);

  const menuItems = [
    { id: "dashboard", title: "Dashboard", path: "/dashboard", icon: BarChart3, show: !!user },
    { id: "security", title: "Seguridad", path: "/dashboard/security", icon: Shield, show: canSecurity },
    { id: "admin", title: "Administración", path: "/dashboard/admin", icon: Building, show: canAdmin },
    // ⚠️ si los permisos aún no están listos, deja pasar por rol:
    {
      id: "academic", title: "Académico", path: "/dashboard/academic", icon: BookOpen,
      show: permsReady ? canAcademic : hasRole("ADMIN_SYSTEM", "ADMIN_ACADEMIC", "REGISTRAR", "TEACHER")
    },
    { id: "admission", title: "Admisión", path: "/dashboard/admission", icon: GraduationCap, show: canAdmission },
    { id: "mesa-partes", title: "Mesa de Partes", path: "/dashboard/mesa-partes", icon: FileText, show: canMPV },
    { id: "finance", title: "Tesorería / Finanzas", path: "/dashboard/finance", icon: Calculator, show: canFinance },
    { id: "minedu", title: "MINEDU", path: "/dashboard/minedu", icon: Database, show: canMinedu },
    { id: "research", title: "Investigación", path: "/dashboard/research", icon: Database, show: canResearch },
  ];

  return (
    <div className="bg-gray-800 text-white w-64 min-h-screen flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-600 rounded-lg"><GraduationCap className="h-6 w-6 text-white" /></div>
          <div>
            <h1 className="text-lg font-bold">IESPP</h1>
            <p className="text-xs text-gray-400">"Gustavo Allende Llavería"</p>
          </div>
        </div>
        {user && (
          <div className="mt-4 p-3 bg-gray-700 rounded-lg">
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{user.full_name}</div>
                <div className="text-xs text-gray-400 truncate">{user.email}</div>
                <div className="text-xs text-blue-400 truncate">{roles.join(" · ")}</div>
              </div>
              <span title={permissions.join(", ")} className="ml-2 text-[10px] bg-blue-600/70 px-2 py-[2px] rounded">
                perms: {permissions.length}
              </span>
            </div>
          </div>
        )}
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.filter((m) => m.show).map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <Link
                  to={item.path}
                  className={`flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${isActive(item.path) ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-700 hover:text-white"
                    }`}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span className="truncate">{item.title}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-gray-700">
        <button onClick={logout} className="w-full flex items-center justify-center space-x-2 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors">
          <LogOut className="h-4 w-4" />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </div>
  );
};

export default SideNav;
