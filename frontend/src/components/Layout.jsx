// src/components/Layout.jsx — UI/UX mejorado
import React, { useContext, useMemo } from "react";
import { Outlet } from "react-router-dom";
import SideNav from "./SideNav";
import { AuthContext } from "../context/AuthContext";

/* ─── inject font ─── */
function InjectLayoutFont() {
  React.useEffect(() => {
    const id = "layout-font";
    if (document.getElementById(id)) return;
    const l = document.createElement("link");
    l.id = id; l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap";
    document.head.appendChild(l);
    const s = document.createElement("style");
    s.id = id + "-css";
    s.textContent = `
          .layout-root { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
          .layout-root * { font-family: inherit; }
          @keyframes main-in { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
          .main-in { animation: main-in .35s cubic-bezier(.22,1,.36,1) both; }
        `;
    document.head.appendChild(s);
    return () => {
      document.getElementById(id)?.remove();
      document.getElementById(id + "-css")?.remove();
    };
  }, []);
  return null;
}

const Layout = ({ children }) => {
  const { user } = useContext(AuthContext);

  /* initials */
  const initials = useMemo(() => {
    if (!user?.full_name) return "U";
    const parts = user.full_name.split(" ").filter(Boolean);
    return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "U";
  }, [user]);

  /* formatted date */
  const dateStr = useMemo(() =>
    new Date().toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" }),
    []);

  /* loading state */
  if (!user) {
    return (
      <>
        <InjectLayoutFont />
        <div className="layout-root flex items-center justify-center min-h-screen bg-slate-100">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-2xl border-4 border-slate-200 border-t-indigo-600 animate-spin" />
            <p className="text-xs font-600 text-slate-400 uppercase tracking-widest">Cargando…</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <InjectLayoutFont />
      <div className="layout-root flex flex-col xl:flex-row min-h-[100dvh] bg-[#F1F5F9] text-slate-900">

        <SideNav />

        {/* right column */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">

          {/* ── HEADER ── */}
          <header className="sticky top-0 z-40 w-full shrink-0 no-print">
            {/* gradient bar */}
            <div className="bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-600 shadow-[0_4px_24px_rgba(79,70,229,0.25)] border-b border-white/10">
              <div className="px-5 sm:px-7 py-0 flex items-center justify-between h-[60px] sm:h-[64px]">

                {/* left: logo + title */}
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src="/loguito.png"
                    alt="Loguito"
                    className="w-11 h-11 sm:w-12 sm:h-12 object-contain shrink-0 drop-shadow"
                    draggable="false"
                  />
                  <div className="min-w-0 hidden sm:block">
                    <h1 className="text-base font-800 text-white tracking-tight leading-none truncate">
                      Sistema Académico
                    </h1>
                    <p className="text-[11px] text-blue-200/80 mt-0.5 font-500 truncate">
                      Bienvenido,{" "}
                      <span className="text-white font-700">
                        {user.full_name?.split(" ").slice(0, 2).join(" ")}
                      </span>
                    </p>
                  </div>
                  {/* mobile: just name */}
                  <div className="min-w-0 sm:hidden">
                    <p className="text-sm font-700 text-white truncate">
                      {user.full_name?.split(" ")[0]}
                    </p>
                  </div>
                </div>

                {/* right: date + avatar */}
                <div className="flex items-center gap-4 sm:gap-5 shrink-0">

                  {/* date */}
                  <div className="hidden md:flex flex-col items-end text-right">
                    <span className="text-[9px] font-800 text-blue-300/80 uppercase tracking-[0.18em] leading-none">Hoy</span>
                    <span className="text-xs font-600 text-white/90 leading-snug mt-0.5 capitalize">{dateStr}</span>
                  </div>

                  <div className="hidden md:block w-px h-6 bg-white/15" />

                  {/* avatar */}
                  <div
                    className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-white/12 border border-white/20 flex items-center justify-center text-sm font-800 text-white cursor-default select-none shadow-sm hover:bg-white/18 transition-colors duration-200"
                    title={user.full_name}
                    aria-label={`Perfil de ${user.full_name}`}
                  >
                    {initials}
                  </div>
                </div>

              </div>
            </div>

            {/* breadcrumb accent line */}
            <div className="h-[2px] w-full bg-gradient-to-r from-indigo-500/30 via-blue-400/20 to-transparent" />
          </header>

          {/* ── MAIN ── */}
          <main className="flex-1 min-h-0 overflow-visible p-4 md:p-6 main-in">
            <div className="w-full min-w-0">
              {children || <Outlet />}
            </div>
          </main>

          {/* ── FOOTER ── */}
          <footer className="shrink-0 px-6 py-3 border-t border-slate-200/80 bg-white/60 flex items-center justify-between gap-4">
            <p className="text-[10px] text-slate-400 font-500">
              © {new Date().getFullYear()} IESPP Gustavo Allende Llavería
            </p>
            <p className="text-[10px] text-slate-300 font-400 hidden sm:block">
              Sistema Académico Integral
            </p>
          </footer>
        </div>
      </div>
    </>
  );
};

export default Layout;