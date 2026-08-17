// ModuleShell — cáscara compartida de módulos: el lenguaje visual del
// Módulo Académico (tarjeta glass sobre fondo azul marino, cabecera con
// icono en degradado y navegación en píldoras agrupadas por área de
// trabajo) para reutilizarlo en todos los módulos con la misma
// responsividad: en móvil 2 pestañas visibles + desplegable agrupado,
// en escritorio bloques etiquetados que envuelven (flex-wrap).
//
// Uso:
//   <ModuleShell
//       icon={Wallet} title="Módulo de Finanzas" subtitle="Pagos y deudas"
//       accent="#2E7D32"
//       tabs={[{ key: "dash", label: "Dashboard", Icon: LayoutGrid, group: "inicio" }, …]}
//       groupLabels={{ inicio: null, gestion: "Gestión" }}
//       tab={tab} onTab={setTab}>
//       <TabsContent value="dash">…</TabsContent>
//   </ModuleShell>
import React, { useEffect, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
    DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
    DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, LayoutGrid } from "lucide-react";

const FONDO = { backgroundColor: "#1C2A44", color: "#FFFFFF" };

const SHELL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

  .mod-shell * { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }

  .mod-shell .tab-pill[data-state=active] {
    background: linear-gradient(135deg, #E3F2FD, #EDE7F6);
    color: #1565C0;
    box-shadow: 0 0 0 1.5px #90CAF9;
  }

  .mod-shell .stat-card { position: relative; overflow: hidden; }
  .mod-shell .qa-btn {
    transition: all 0.18s cubic-bezier(.4,0,.2,1);
    border: 1.5px solid #E2E8F0;
  }
  .mod-shell .qa-btn:hover {
    transform: translateY(-2px);
    border-color: #BBDEFB;
    box-shadow: 0 8px 24px -6px rgba(33,150,243,0.18);
    background: linear-gradient(135deg, #EFF8FF 0%, #DBEAFE 100%);
  }

  @keyframes mod-fade-in { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
  .mod-shell .fade-in { animation: mod-fade-in 0.28s ease both; }

  /* ── Responsividad de contenido heredado ──
     Muchas tablas y toolbars viejas no previeron pantallas chicas: dentro
     del shell toda tabla puede desplazarse de lado sin romper la página. */
  .mod-shell table { max-width: 100%; }
  .mod-shell .overflow-x-auto { -webkit-overflow-scrolling: touch; }
  @media (max-width: 640px) {
    .mod-shell .mod-wrap-sm { flex-wrap: wrap !important; }
  }
`;

function InjectShellStyles() {
    useEffect(() => {
        const id = "module-shell-styles";
        if (document.getElementById(id)) return;
        const s = document.createElement("style");
        s.id = id;
        s.textContent = SHELL_STYLES;
        document.head.appendChild(s);
    }, []);
    return null;
}

function PillTab({ value, label, Icon }) {
    return (
        <TabsTrigger
            value={value}
            className="tab-pill shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-white transition-all data-[state=active]:text-blue-700 data-[state=active]:shadow-sm"
        >
            {Icon && <Icon size={14} />}
            <span className="whitespace-nowrap">{label}</span>
        </TabsTrigger>
    );
}

export default function ModuleShell({
    icon: Icon = LayoutGrid,
    title,
    subtitle = "",
    accent = "linear-gradient(135deg, #3B82F6, #1D4ED8)",
    headerRight = null,
    tabs = [],              // [{ key, label, Icon, group }]
    groupLabels = {},       // { group: "Etiqueta" | null }
    tab,
    onTab,
    children,               // <TabsContent value="…"> de cada pestaña
}) {
    const grupos = useMemo(() => {
        const m = new Map();
        for (const t of tabs) {
            const g = t.group || "_";
            if (!m.has(g)) m.set(g, []);
            m.get(g).push(t);
        }
        return [...m.entries()];
    }, [tabs]);

    // Módulo de página única (sin pestañas): misma cáscara, sin navegación
    if (!tabs.length) {
        return (
            <>
                <InjectShellStyles />
                <div style={FONDO}
                    className="mod-shell min-h-[100dvh] w-full min-w-0 overflow-x-hidden p-3 sm:p-4 md:p-6 pb-24 md:pb-16">
                    <div className="w-full min-w-0 rounded-2xl md:rounded-3xl bg-white/80 backdrop-blur-md border border-slate-200/60 shadow-xl shadow-slate-200/40 p-4 md:p-6 space-y-6">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm shrink-0"
                                    style={{ background: accent }}>
                                    <Icon size={20} className="text-white" />
                                </div>
                                <div className="min-w-0">
                                    <h1 className="text-lg font-extrabold text-slate-800 leading-tight truncate">{title}</h1>
                                    {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
                                </div>
                            </div>
                            {headerRight && <div className="shrink-0">{headerRight}</div>}
                        </div>
                        <Separator className="bg-slate-100" />
                        {children}
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <InjectShellStyles />
            <div style={FONDO}
                className="mod-shell min-h-[100dvh] w-full min-w-0 overflow-x-hidden p-3 sm:p-4 md:p-6 pb-24 md:pb-16">
                <div className="w-full min-w-0 rounded-2xl md:rounded-3xl bg-white/80 backdrop-blur-md border border-slate-200/60 shadow-xl shadow-slate-200/40 p-4 md:p-6 space-y-6">

                    {/* ── Cabecera del módulo ── */}
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm shrink-0"
                                style={{ background: accent }}>
                                <Icon size={20} className="text-white" />
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-lg font-extrabold text-slate-800 leading-tight truncate">{title}</h1>
                                {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
                            </div>
                        </div>
                        {headerRight && <div className="shrink-0">{headerRight}</div>}
                    </div>

                    <Separator className="bg-slate-100" />

                    <Tabs value={tab} onValueChange={onTab} className="space-y-5">
                        {/* Móvil: 2 pestañas visibles + desplegable agrupado */}
                        <div className="sm:hidden">
                            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-1.5">
                                <TabsList className="flex flex-1 gap-1 h-auto bg-transparent p-0">
                                    {tabs.slice(0, 2).map((t) => (
                                        <PillTab key={t.key} value={t.key} label={t.label} Icon={t.Icon} />
                                    ))}
                                </TabsList>
                                {tabs.length > 2 && (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" size="icon"
                                                className="h-9 w-9 rounded-lg border-slate-200 shrink-0">
                                                <ChevronDown size={14} />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-56 rounded-xl max-h-[70vh] overflow-y-auto">
                                            {tabs.slice(2).map((t, i, arr) => {
                                                const I = t.Icon || LayoutGrid;
                                                const prev = arr[i - 1];
                                                const nuevoGrupo = !prev || prev.group !== t.group;
                                                return (
                                                    <React.Fragment key={t.key}>
                                                        {nuevoGrupo && groupLabels[t.group] && (
                                                            <>
                                                                {i > 0 && <DropdownMenuSeparator />}
                                                                <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-slate-400 py-1">
                                                                    {groupLabels[t.group]}
                                                                </DropdownMenuLabel>
                                                            </>
                                                        )}
                                                        <DropdownMenuItem onClick={() => onTab(t.key)}
                                                            className={`flex items-center gap-2.5 text-sm rounded-lg ${tab === t.key ? "bg-blue-50 text-blue-700" : ""}`}>
                                                            <I size={14} /><span>{t.label}</span>
                                                        </DropdownMenuItem>
                                                    </React.Fragment>
                                                );
                                            })}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}
                            </div>
                        </div>

                        {/* Escritorio: bloques etiquetados por área de trabajo */}
                        <div className="hidden sm:block">
                            <TabsList className="flex flex-wrap items-stretch h-auto gap-2 bg-transparent p-0">
                                {grupos.map(([g, items]) => (
                                    <div key={g}
                                        className="flex flex-col justify-end gap-1 rounded-xl bg-slate-50 border border-slate-200 px-1.5 pb-1.5 pt-1">
                                        <span className="px-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400 select-none min-h-[12px]">
                                            {groupLabels[g] || ""}
                                        </span>
                                        <div className="flex flex-wrap gap-1">
                                            {items.map((t) => (
                                                <PillTab key={t.key} value={t.key} label={t.label} Icon={t.Icon} />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </TabsList>
                        </div>

                        {children}
                    </Tabs>
                </div>
            </div>
        </>
    );
}

/* ── Piezas auxiliares con el mismo lenguaje (KPIs y accesos rápidos) ── */

export function ShellStat({ label, value, hint, tone = "blue", Icon }) {
    const TONES = {
        blue:   { bg: "#EFF8FF", fg: "#1565C0" },
        green:  { bg: "#F0FDF4", fg: "#2E7D32" },
        violet: { bg: "#FAF5FF", fg: "#6A1B9A" },
        amber:  { bg: "#FFFBEB", fg: "#B45309" },
        rose:   { bg: "#FFF1F2", fg: "#9F1239" },
        slate:  { bg: "#F8FAFC", fg: "#475569" },
    };
    const t = TONES[tone] || TONES.blue;
    return (
        <div className="stat-card rounded-2xl border border-slate-200 bg-white p-4 min-w-0">
            <div className="flex items-start justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
                {Icon && (
                    <span className="h-8 w-8 rounded-xl grid place-items-center shrink-0"
                        style={{ background: t.bg, color: t.fg }}>
                        <Icon size={15} />
                    </span>
                )}
            </div>
            <p className="text-2xl font-extrabold text-slate-800 leading-tight">{value ?? "—"}</p>
            {hint && <p className="text-[10.5px] text-slate-400 mt-0.5">↗ {hint}</p>}
        </div>
    );
}

export function ShellQuickAction({ label, Icon, color = "#1565C0", bg = "#EFF8FF", onClick }) {
    return (
        <button type="button" onClick={onClick}
            className="qa-btn flex flex-col items-center justify-center gap-2.5 min-h-[88px] p-3 rounded-2xl bg-white w-full cursor-pointer">
            <div className="qa-icon flex items-center justify-center w-9 h-9 rounded-xl"
                style={{ background: bg, color }}>
                {Icon && <Icon size={17} />}
            </div>
            <span className="text-xs font-semibold text-slate-600">{label}</span>
        </button>
    );
}
