// src/components/SideNav.jsx
import React, { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard,
  ShieldCheck,
  Settings,
  BookOpenCheck,
  UserPlus,
  ClipboardList,
  Wallet,
  HardDrive,
  Microscope,
  LogOut,
  ChevronLeft,
  ChevronRight,
  UserCircle,
  Menu,
  X,
} from "lucide-react";
import { PERMS, PERM_ALIASES } from "../auth/permissions";

const SideNav = () => {
  const { user, roles = [], logout, permissions = [] } = useAuth();
  const location = useLocation();

  // Estados para el control de visibilidad
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Cerrar el menú móvil cuando cambie la ruta
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);
useEffect(() => {
  // Evita scroll del fondo cuando el menú móvil está abierto (iOS friendly)
  if (isMobileOpen) {
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
  } else {
    document.body.style.overflow = "";
    document.body.style.touchAction = "";
  }
  return () => {
    document.body.style.overflow = "";
    document.body.style.touchAction = "";
  };
}, [isMobileOpen]);

  const hasRole = (...codes) => codes.some((r) => roles.includes(r));
  const isActive = (path) =>
    path === "/dashboard"
      ? location.pathname === "/dashboard"
      : location.pathname.startsWith(path);

  // ✅ Permisos efectivos (incluye aliases)
  const grantedPerms = useMemo(() => {
    const set = new Set((permissions || []).filter(Boolean));
    // si tengo X, también tengo su alias/implicado
    for (const p of set) {
      const implied = PERM_ALIASES?.[p];
      if (implied) set.add(implied);
    }
    return set;
  }, [permissions]);

  const canAny = (...req) => {
    // si no está logueado, no ve nada salvo que explícitamente lo permitas
    if (!user) return false;
    if (!req || req.length === 0) return true;
    return req.some((p) => grantedPerms.has(p));
  };

  /**
   * ✅ Política de menú (decidida y clara):
   * - Dashboard: cualquier usuario logueado.
   * - Seguridad: admin/auditoría/sesiones/políticas.
   * - Administración: gestión de accesos, catálogos, auditoría.
   * - Académico: cualquier permiso académico relevante.
   * - Admisión: cualquier permiso de admisión.
   * - Investigación: cualquier permiso research.
   * - Mesa de Partes: cualquier permiso mpv (o legacy desk.* si lo usan).
   * - Finanzas: cualquier permiso fin.* o dashboard fin.
   * - MINEDU: cualquier permiso minedu.*
   */

  const menuGroups = useMemo(
    () => [
      {
        group: "General",
        items: [
          {
            id: "dashboard",
            title: "Dashboard",
            path: "/dashboard",
            icon: LayoutDashboard,
            show: !!user,
          },
        ],
      },

      {
        group: "Gestión y Control",
        items: [
          {
            id: "security",
            title: "Seguridad",
            path: "/dashboard/security",
            icon: ShieldCheck,
            // ✅ Seguridad
            anyPerms: [
              PERMS["security.policies.manage"],
              PERMS["security.sessions.inspect"],
              PERMS["admin.audit.view"],
              PERMS["admin.audit.export"],
            ],
            show: canAny(
              PERMS["security.policies.manage"],
              PERMS["security.sessions.inspect"],
              PERMS["admin.audit.view"],
              PERMS["admin.audit.export"]
            ),
          },
          {
            id: "admin",
            title: "Administración",
            path: "/dashboard/admin",
            icon: Settings,
            // ✅ Administración / Accesos / Catálogos
            anyPerms: [
              PERMS["admin.access.manage"],
              PERMS["admin.catalogs.view"],
              PERMS["admin.catalogs.manage"],
              PERMS["admin.audit.view"],
            ],
            show: canAny(
              PERMS["admin.access.manage"],
              PERMS["admin.catalogs.view"],
              PERMS["admin.catalogs.manage"],
              PERMS["admin.audit.view"]
            ),
          },
        ],
      },

      {
        group: "Académico",
        items: [
          {
            id: "academic",
            title: "Académico",
            path: "/dashboard/academic",
            icon: BookOpenCheck,
            show: canAny(
              // base / compat
              PERMS["academic.view"],
              PERMS["academic.sections.view"],
              PERMS["academic.plans.view"],
              PERMS["academic.enrollment.view"],
              PERMS["academic.reports.view"],
              PERMS["academic.grades.edit"],
              PERMS["academic.attendance.view"]
            ),
          },
          {
            id: "admission",
            title: "Admisión",
            path: "/dashboard/admission",
            icon: UserPlus,
            show: canAny(
              PERMS["admission.dashboard.view"],
              PERMS["admission.calls.view"],
              PERMS["admission.calls.manage"],
              PERMS["admission.applicants.manage"],
              PERMS["admission.documents.review"],
              PERMS["admission.reports.view"]
            ),
          },
          {
            id: "research",
            title: "Investigación",
            path: "/dashboard/research",
            icon: Microscope,
            show: canAny(
              PERMS["research.calls.view"],
              PERMS["research.calls.manage"],
              PERMS["research.projects.view"],
              PERMS["research.projects.edit"],
              PERMS["research.tabs.reports"]
            ),
          },
        ],
      },

      {
        group: "Operaciones",
        items: [
          {
            id: "mesa-partes",
            title: "Mesa de Partes",
            path: "/dashboard/mesa-partes",
            icon: ClipboardList,
            show: canAny(
              PERMS["mpv.processes.review"],
              PERMS["mpv.processes.resolve"],
              PERMS["mpv.files.upload"],
              PERMS["mpv.reports.view"],
              // legacy por si el backend aún devuelve desk.*
              PERMS["desk.intake.manage"],
              PERMS["desk.reports.view"],
              PERMS["desk.track.view"]
            ),
          },
          {
            id: "finance",
            title: "Finanzas",
            path: "/dashboard/finance",
            icon: Wallet,
            show: canAny(
              PERMS["finance.dashboard.view"],
              PERMS["fin.cashbanks.view"],
              PERMS["fin.student.accounts.view"],
              PERMS["fin.payments.receive"],
              PERMS["fin.reports.view"],
              PERMS["fin.concepts.manage"],
              PERMS["fin.reconciliation.view"]
            ),
          },
          {
            id: "minedu",
            title: "Sistemas MINEDU",
            path: "/dashboard/minedu",
            icon: HardDrive,
            show: canAny(
              PERMS["minedu.integration.view"],
              PERMS["minedu.integration.export"],
              PERMS["minedu.integration.validate"],
              PERMS["minedu.integrations.run"]
            ),
          },
        ],
      },
    ],
    [user, grantedPerms] // grantedPerms cambia cuando cambian permisos
  );

  return (
    <>
      {/* --- HEADER MÓVIL (Solo visible en pantallas pequeñas) --- */}
      <div className="xl:hidden bg-[#0f172a] text-white p-4 flex items-center justify-between border-b border-slate-800 sticky top-0 z-[60]">
        <div className="flex items-center gap-2">
          <img
            src="/logo.png"
            alt="Logo"
            className="h-8 w-8 object-contain bg-white rounded p-1"
          />
          <span className="font-bold text-lg">IESPP</span>
        </div>
        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-500/20"
          aria-label={isMobileOpen ? "Cerrar menú" : "Abrir menú"}
        >
          {isMobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* --- OVERLAY MÓVIL (Fondo oscuro al abrir en móvil) --- */}
      {isMobileOpen && (
  <div
    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] xl:hidden transition-opacity"
    onClick={() => setIsMobileOpen(false)}
  />
)}



      {/* --- SIDEBAR --- */}
      <aside
  className={`
    fixed inset-y-0 left-0 z-[80] xl:relative xl:z-0
    flex flex-col bg-[#0f172a] text-slate-300 border-r border-slate-800 shadow-2xl
    transition-[width,transform] duration-300 ease-in-out
    ${isMobileOpen ? "translate-x-0" : "-translate-x-full xl:translate-x-0"}
    ${isCollapsed ? "xl:w-20" : "xl:w-72 w-[280px]"}
  `}
>

        {/* Toggle Button (Solo Desktop) - "Manija" visible */}
        <div className="hidden xl:block absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-[90]">

          <button
            type="button"
            onClick={() => setIsCollapsed((v) => !v)}
            aria-label={isCollapsed ? "Expandir menú lateral" : "Colapsar menú lateral"}
            title={isCollapsed ? "Expandir" : "Colapsar"}
            className="group relative flex items-center justify-center w-10 h-10 rounded-full
                       bg-indigo-600 text-white shadow-xl shadow-indigo-600/35
                       ring-1 ring-white/10 border border-slate-950/40
                       hover:bg-indigo-500 active:scale-95 transition-all"
          >
            {/* Grip */}
            <span className="absolute -left-2 top-1/2 -translate-y-1/2 h-7 w-1.5 rounded-full bg-white/25" />

            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}

            {/* Tooltip */}
            <span
              className="pointer-events-none absolute right-full mr-3 px-2 py-1 rounded-md
                         bg-black/70 text-white text-[11px] font-semibold whitespace-nowrap
                         opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0
                         transition-all"
            >
              {isCollapsed ? "Abrir menú" : "Colapsar menú"}
            </span>
          </button>
        </div>

        {/* Brand Header */}
        <div
          className={`h-24 flex items-center mb-4 ${isCollapsed && !isMobileOpen ? "px-3 justify-center" : "px-6"
            }`}
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="h-11 w-11 min-w-[44px] rounded-xl bg-white flex items-center justify-center p-1.5 shadow-xl shadow-indigo-500/10">
              <img src="/logo.png" alt="Logo" className="h-full w-full object-contain" />
            </div>

            {(!isCollapsed || isMobileOpen) && (
              <div className="flex flex-col whitespace-nowrap overflow-hidden animate-in fade-in duration-300">
                <span className="font-black text-xl tracking-tight text-white uppercase italic">
                  IESPP
                </span>
                <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-[0.2em] leading-none">
                  Allende Llavería
                </span>
              </div>
            )}
          </div>
        </div>

        {/* User Card */}
        {user && (
          <div className="px-4 mb-6">
            <div
              className={`flex items-center gap-3 p-3 rounded-2xl bg-slate-800/40 border border-slate-700/50 ${isCollapsed && !isMobileOpen ? "justify-center px-2" : ""
                }`}
            >
              <div className="h-10 w-10 min-w-[40px] rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white">
                <UserCircle size={24} />
              </div>

              {(!isCollapsed || isMobileOpen) && (
                <div className="flex-1 min-w-0 overflow-hidden">
                  <p className="text-sm font-bold text-slate-100 truncate">
                    {user.full_name?.split(" ")[0] || "Usuario"}
                  </p>
                  <p className="text-[10px] text-indigo-300 font-medium truncate opacity-80 uppercase italic">
                    {roles[0]?.split("_").join(" ") || "ROL"}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation Groups */}
        <nav className="flex-1 px-3 space-y-6 overflow-y-auto overflow-x-hidden custom-scrollbar pb-10">
          {menuGroups.map((group, idx) => {
            const visibleItems = group.items.filter((i) => i.show);
            if (visibleItems.length === 0) return null;

            return (
              <div key={idx} className="space-y-1">
                {(!isCollapsed || isMobileOpen) && (
                  <p className="px-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-[0.15em] mb-2 ml-1">
                    {group.group}
                  </p>
                )}

                <ul className="space-y-1">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);

                    return (
                      <li key={item.id}>
                        <Link
                          to={item.path}
                          className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${isCollapsed && !isMobileOpen ? "justify-center px-2" : ""
                            } ${active
                              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                              : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-100"
                            }`}
                          title={isCollapsed && !isMobileOpen ? item.title : undefined}
                          aria-label={item.title}
                        >
                          <Icon
                            size={20}
                            className={`${active ? "text-white" : "group-hover:text-indigo-400"}`}
                          />

                          {(!isCollapsed || isMobileOpen) && (
                            <span className="font-semibold text-[13px] tracking-wide whitespace-nowrap">
                              {item.title}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        {/* Bottom Actions */}
        <div className="p-4 bg-slate-900/40 border-t border-slate-800/50">
          <button
            onClick={logout}
            className={`flex items-center gap-3 w-full p-3 rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all font-bold ${isCollapsed && !isMobileOpen ? "justify-center" : ""
              }`}
            aria-label="Cerrar sesión"
          >
            <LogOut size={18} />
            {(!isCollapsed || isMobileOpen) && (
              <span className="text-[13px] uppercase tracking-wider">Cerrar Sesión</span>
            )}
          </button>
        </div>
      </aside>
    </>
  );
};

export default SideNav;
