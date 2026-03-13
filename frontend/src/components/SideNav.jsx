// src/components/SideNav.jsx — UI/UX mejorado
import React, { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard, ShieldCheck, Settings, BookOpenCheck, UserPlus,
  ClipboardList, Wallet, HardDrive, Microscope, LogOut,
  ChevronLeft, ChevronRight, UserCircle, Menu, X, GraduationCap,
  Award,
} from "lucide-react";
import { PERMS, PERM_ALIASES } from "../auth/permissions";

/* ─── inject font + nav styles ─── */
const NAV_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
  .sidenav-root { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
  .sidenav-root * { font-family: inherit; }

  /* hide scrollbar */
  .nav-scroll::-webkit-scrollbar { display:none; width:0; background:transparent; }
  .nav-scroll { -ms-overflow-style:none; scrollbar-width:none; }

  /* active item glow */
  .nav-item-active {
    background: linear-gradient(135deg, #4F46E5 0%, #4338CA 100%);
    box-shadow: 0 4px 14px -2px rgba(79,70,229,.45);
  }
  .nav-item-active .nav-icon { color: #fff; }

  /* collapse toggle */
  .nav-toggle {
    background: linear-gradient(135deg, #4F46E5, #6366F1);
    box-shadow: 0 4px 14px rgba(79,70,229,.5);
  }

  /* sidebar slide animations */
  @keyframes slide-in { from{opacity:0;transform:translateX(-10px)} to{opacity:1;transform:none} }
  .slide-in { animation: slide-in .2s ease both; }

  /* user card shimmer */
  .user-card {
    background: linear-gradient(135deg, rgba(99,102,241,.12) 0%, rgba(139,92,246,.08) 100%);
    border: 1px solid rgba(99,102,241,.18);
  }
`;

function InjectNavStyles() {
  useEffect(() => {
    const id = "sidenav-styles";
    if (document.getElementById(id)) return;
    const s = document.createElement("style");
    s.id = id; s.textContent = NAV_STYLE;
    document.head.appendChild(s);
    return () => document.getElementById(id)?.remove();
  }, []);
  return null;
}

const SideNav = () => {
  const { user, roles = [], logout, permissions = [] } = useAuth();
  const location = useLocation();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => setIsMobileOpen(false), [location.pathname]);

  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
    } else {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    }
    return () => { document.body.style.overflow = ""; document.body.style.touchAction = ""; };
  }, [isMobileOpen]);

  const hasRole = (...codes) => codes.some((r) => roles.includes(r));

  const isActive = (path) =>
    path === "/dashboard"
      ? location.pathname === "/dashboard"
      : location.pathname.startsWith(path);

  const grantedPerms = useMemo(() => {
    const set = new Set((permissions || []).filter(Boolean));
    for (const p of set) {
      const implied = PERM_ALIASES?.[p];
      if (implied) set.add(implied);
    }
    return set;
  }, [permissions]);

  const canAny = (...req) => {
    if (!user) return false;
    if (!req || req.length === 0) return true;
    return req.some((p) => grantedPerms.has(p));
  };

  const canSeeStudentModule = useMemo(() => {
    if (!user) return false;
    const roleOk = hasRole("STUDENT", "ADMIN_SYSTEM") ||
      roles.some((r) => String(r).toUpperCase().includes("STUDENT")) ||
      roles.some((r) => String(r).toUpperCase().includes("ADMIN_SYSTEM"));
    const permOk = canAny(
      PERMS["student.self.dashboard.view"], PERMS["student.self.profile.view"],
      PERMS["student.self.profile.edit"], PERMS["student.self.kardex.view"],
      PERMS["student.self.enrollment.view"], PERMS["student.manage.list"],
      PERMS["student.manage.view"], PERMS["student.manage.edit"]
    );
    return roleOk || permOk;
  }, [user, roles, grantedPerms]);

  const menuGroups = useMemo(() => [
    {
      group: "General",
      items: [
        { id: "dashboard", title: "Dashboard", path: "/dashboard", icon: LayoutDashboard, show: !!user },
      ],
    },
    {
      group: "Gestión y Control",
      items: [
        {
          id: "security", title: "Seguridad", path: "/dashboard/security", icon: ShieldCheck,
          show: !!user,
        },
        {
          id: "admin", title: "Administración", path: "/dashboard/admin", icon: Settings,
          show: canAny(PERMS["admin.access.manage"], PERMS["admin.catalogs.view"], PERMS["admin.catalogs.manage"], PERMS["admin.audit.view"]),
        },
      ],
    },
    {
      group: "Académico",
      items: [
        {
          id: "academic", title: "Académico", path: "/dashboard/academic", icon: BookOpenCheck,
          show: canAny(PERMS["academic.view"], PERMS["academic.sections.view"], PERMS["academic.plans.view"], PERMS["academic.enrollment.view"], PERMS["academic.reports.view"], PERMS["academic.grades.edit"], PERMS["academic.attendance.view"]),
        },
        { id: "student", title: "Estudiante", path: "/dashboard/student", icon: GraduationCap, show: canSeeStudentModule },
        {
          id: "admission", title: "Admisión", path: "/dashboard/admission", icon: UserPlus,
          show: canAny(PERMS["admission.dashboard.view"], PERMS["admission.calls.view"], PERMS["admission.calls.manage"], PERMS["admission.applicants.manage"], PERMS["admission.documents.review"], PERMS["admission.reports.view"]),
        },
        {
          id: "research", title: "Investigación", path: "/dashboard/research", icon: Microscope,
          show: canAny(PERMS["research.calls.view"], PERMS["research.calls.manage"], PERMS["research.projects.view"], PERMS["research.projects.edit"], PERMS["research.tabs.reports"]),
        },
        {
          id: "graduates", title: "Titulados", path: "/dashboard/graduates", icon: Award,
          show: canAny(PERMS["admin.access.manage"], PERMS["admin.catalogs.manage"], PERMS["admin.catalogs.view"]),
        },
      ],
    },
    {
      group: "Operaciones",
      items: [
        {
          id: "mesa-partes", title: "Mesa de Partes", path: "/dashboard/mesa-partes", icon: ClipboardList,
          show: canAny(PERMS["mpv.processes.review"], PERMS["mpv.processes.resolve"], PERMS["mpv.files.upload"], PERMS["mpv.reports.view"], PERMS["desk.intake.manage"], PERMS["desk.reports.view"], PERMS["desk.track.view"]),
        },
        {
          id: "finance", title: "Finanzas", path: "/dashboard/finance", icon: Wallet,
          show: canAny(PERMS["finance.dashboard.view"], PERMS["fin.cashbanks.view"], PERMS["fin.student.accounts.view"], PERMS["fin.payments.receive"], PERMS["fin.reports.view"], PERMS["fin.concepts.manage"], PERMS["fin.reconciliation.view"]),
        },
        {
          id: "minedu", title: "Sistemas MINEDU", path: "/dashboard/minedu", icon: HardDrive,
          show: canAny(PERMS["minedu.integration.view"], PERMS["minedu.integration.export"], PERMS["minedu.integration.validate"], PERMS["minedu.integrations.run"]),
        },
      ],
    },
  ], [user, grantedPerms, canSeeStudentModule]);

  /* ── helpers ── */
  const expanded = !isCollapsed || isMobileOpen;
  const roleLabel = roles[0]?.split("_").join(" ") || "ROL";
  const firstName = user?.full_name?.split(" ")[0] || "Usuario";

  /* initials for avatar */
  const initials = useMemo(() => {
    const parts = (user?.full_name || "U").split(" ").filter(Boolean);
    return (parts[0]?.[0] || "") + (parts[1]?.[0] || "");
  }, [user]);

  const NavItem = ({ item }) => {
    const Icon = item.icon;
    const active = isActive(item.path);

    return (
      <li>
        <Link
          to={item.path}
          title={!expanded ? item.title : undefined}
          aria-label={item.title}
          className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${!expanded ? "justify-center px-2.5" : ""} ${active
            ? "nav-item-active text-white"
            : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-100"
            }`}
        >
          {/* active left accent */}
          {active && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-indigo-300/80" />
          )}

          <Icon
            size={18}
            className={`nav-icon shrink-0 transition-colors duration-200 ${active ? "text-white" : "text-slate-500 group-hover:text-indigo-400"}`}
          />

          {expanded && (
            <span className="slide-in text-[13px] font-600 tracking-wide whitespace-nowrap truncate">
              {item.title}
            </span>
          )}

          {/* hover glow dot when collapsed */}
          {!expanded && (
            <span className="absolute left-full ml-3 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs font-700 text-slate-200 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none translate-x-[-4px] group-hover:translate-x-0 transition-all duration-200 shadow-xl z-[100]">
              {item.title}
            </span>
          )}
        </Link>
      </li>
    );
  };

  return (
    <>
      <InjectNavStyles />

      {/* ── MOBILE HEADER ── */}
      <div className="sidenav-root xl:hidden bg-[#0c1322] text-white px-4 py-3 flex items-center justify-between border-b border-slate-800/80 sticky top-0 z-[60] shadow-lg">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-white p-1 shadow-sm">
            <img src="/logo.png" alt="Logo" className="h-full w-full object-contain" />
          </div>
          <div>
            <p className="font-900 text-sm text-white leading-none tracking-tight">IESPP</p>
            <p className="text-[9px] text-indigo-400 font-700 uppercase tracking-widest leading-none mt-0.5">Allende Llavería</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsMobileOpen((v) => !v)}
          className="p-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/25 active:scale-95 transition-all"
          aria-label={isMobileOpen ? "Cerrar menú" : "Abrir menú"}
        >
          {isMobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* ── MOBILE OVERLAY ── */}
      <div
        className={`fixed inset-0 bg-blue-950/70 backdrop-blur-sm z-[70] xl:hidden transition-opacity duration-300 ${isMobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={() => setIsMobileOpen(false)}
      />

      {/* ── SIDEBAR ── */}
      <aside className={`
                sidenav-root
                fixed inset-y-0 left-0 z-[80]
                flex flex-col
                bg-[#0c1322] border-r border-slate-800/60 shadow-2xl
                transition-[width,transform] duration-300 ease-in-out

                ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
                xl:translate-x-0 xl:sticky xl:top-0 xl:h-[100dvh] xl:self-start

                ${isCollapsed ? "xl:w-[72px]" : "xl:w-[260px] w-[272px]"}
            `}>

        {/* collapse toggle — desktop only */}
        <div className="hidden xl:block absolute right-0 top-20 translate-x-1/2 z-[90]">
          <button
            type="button"
            onClick={() => setIsCollapsed((v) => !v)}
            aria-label={isCollapsed ? "Expandir" : "Colapsar"}
            className="nav-toggle flex items-center justify-center w-7 h-7 rounded-full text-white ring-2 ring-slate-900 hover:scale-110 active:scale-95 transition-all duration-200"
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* ── BRAND ── */}
        <div className={`h-[68px] flex items-center flex-shrink-0 border-b border-slate-800/60 ${expanded ? "px-5 gap-3" : "px-3 justify-center"}`}>
          <div className="h-10 w-10 min-w-[40px] rounded-xl bg-white flex items-center justify-center p-1.5 shadow-lg shadow-indigo-500/10">
            <img src="/logo.png" alt="Logo" className="h-full w-full object-contain" />
          </div>
          {expanded && (
            <div className="slide-in overflow-hidden">
              <p className="font-900 text-[15px] text-white tracking-tight leading-none italic">IESPP</p>
              <p className="text-[9px] text-indigo-400 font-700 uppercase tracking-[0.18em] leading-none mt-1">Allende Llavería</p>
            </div>
          )}
        </div>

        {/* ── USER CARD ── */}
        {user && (
          <div className={`mx-3 mt-4 mb-3 flex-shrink-0 ${expanded ? "p-3 user-card rounded-2xl" : "flex justify-center"}`}>
            <div className={`flex items-center gap-2.5 ${!expanded ? "justify-center" : ""}`}>
              {/* avatar */}
              <div className="relative h-9 w-9 min-w-[36px] rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-800 text-sm shadow-lg shadow-indigo-600/20">
                {initials || <UserCircle size={20} />}
                {/* online dot */}
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#0c1322]" />
              </div>

              {expanded && (
                <div className="slide-in flex-1 min-w-0 overflow-hidden">
                  <p className="text-sm font-700 text-slate-100 truncate leading-none">{firstName}</p>
                  <p className="text-[10px] text-indigo-300/80 font-600 uppercase tracking-wider truncate mt-0.5">{roleLabel}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── NAV ── */}
        <nav className="flex-1 min-h-0 px-3 nav-scroll overflow-y-auto overflow-x-hidden pb-6 space-y-5 mt-1">
          {menuGroups.map((group, idx) => {
            const visible = group.items.filter((i) => i.show);
            if (!visible.length) return null;
            return (
              <div key={idx} className="space-y-0.5">
                {expanded && (
                  <p className="px-3 text-[9px] font-800 text-slate-600 uppercase tracking-[0.18em] mb-2">
                    {group.group}
                  </p>
                )}
                {!expanded && idx > 0 && (
                  <div className="my-2 mx-2 h-px bg-slate-800/80" />
                )}
                <ul className="space-y-0.5">
                  {visible.map((item) => <NavItem key={item.id} item={item} />)}
                </ul>
              </div>
            );
          })}
        </nav>

        {/* ── LOGOUT ── */}
        <div className={`flex-shrink-0 px-3 py-3 border-t border-slate-800/60 bg-slate-900/30`}>
          <button
            type="button"
            onClick={logout}
            className={`group flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200 ${!expanded ? "justify-center" : ""}`}
            aria-label="Cerrar sesión"
            title={!expanded ? "Cerrar sesión" : undefined}
          >
            <LogOut size={16} className="shrink-0 group-hover:rotate-[-12deg] transition-transform duration-200" />
            {expanded && (
              <span className="slide-in text-[12px] font-700 uppercase tracking-widest">Cerrar sesión</span>
            )}
          </button>
        </div>
      </aside>
    </>
  );
};

export default SideNav;