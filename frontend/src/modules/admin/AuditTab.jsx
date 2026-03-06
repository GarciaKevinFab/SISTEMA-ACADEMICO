// src/modules/admin/AuditTab.jsx — UI/UX mejorado
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { AuditService } from "../../services/audit.service";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  RefreshCw, Download, Copy, X, ChevronLeft, ChevronRight,
  Search, ClipboardList, Loader2, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

/* ─── inject font ─── */
function InjectAuditStyles() {
  useEffect(() => {
    const id = "audit-styles";
    if (document.getElementById(id)) return;
    const l = document.createElement("link");
    l.id = id + "-font"; l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap";
    document.head.appendChild(l);
    const s = document.createElement("style");
    s.id = id;
    s.textContent = `
          .audit-root { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
          .audit-root * { font-family: inherit; }

          /* header accent */
          .audit-header {
            border-top: 3px solid transparent;
            border-image: linear-gradient(90deg,#3B82F6,#6366F1,#8B5CF6) 1;
            border-radius: 1rem 1rem 0 0;
          }

          /* table */
          .audit-th {
            padding: 10px 14px; font-size: 10px; font-weight: 800;
            color: #64748B; text-transform: uppercase; letter-spacing: .1em;
            background: #F8FAFC; border-bottom: 1px solid #E2E8F0;
          }
          .audit-td { padding: 10px 14px; font-size: 12.5px; color: #334155; vertical-align: middle; }
          .audit-tr { border-bottom: 1px solid #F1F5F9; transition: background .1s; }
          .audit-tr:hover { background: #F0F7FF; }

          /* action badges */
          .ab-create  { background:#DCFCE7; color:#166534; }
          .ab-update  { background:#DBEAFE; color:#1E40AF; }
          .ab-delete  { background:#FEE2E2; color:#991B1B; }
          .ab-login   { background:#FEF3C7; color:#92400E; }
          .ab-logout  { background:#F1F5F9; color:#475569; }
          .ab-access  { background:#EDE9FE; color:#4C1D95; }
          .ab-error   { background:#FEE2E2; color:#991B1B; }
          .ab-default { background:#E0F2FE; color:#0C4A6E; }

          /* filter chip */
          .audit-chip {
            display: inline-flex; align-items: center; gap: 4px;
            padding: 2px 10px; border-radius: 999px;
            font-size: 11px; font-weight: 700;
            background: #EFF6FF; color: #1D4ED8;
            border: 1px solid #BFDBFE;
          }

          /* skeleton */
          @keyframes audit-pulse { 0%,100%{opacity:1} 50%{opacity:.45} }
          .audit-skel { border-radius: 6px; background: #E2E8F0; animation: audit-pulse 1.4s ease-in-out infinite; }

          @keyframes audit-fade { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:none} }
          .audit-fade { animation: audit-fade .2s ease both; }
        `;
    document.head.appendChild(s);
    return () => {
      document.getElementById(id)?.remove();
      document.getElementById(id + "-font")?.remove();
    };
  }, []);
  return null;
}

/* ─── hooks & utils ─── */
const useDebouncedObject = (obj, delay = 500) => {
  const [v, setV] = useState(obj);
  useEffect(() => {
    const t = setTimeout(() => setV(obj), delay);
    return () => clearTimeout(t);
  }, [obj, delay]);
  return v;
};

const toLocal = (ts) => {
  try { return new Date(ts).toLocaleString("es-PE"); } catch { return ts || ""; }
};

const safeCopy = async (text) => {
  try { if (navigator?.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; } } catch { /* ignore */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.left = "-9999px";
    document.body.appendChild(ta); ta.focus(); ta.select();
    document.execCommand("copy"); document.body.removeChild(ta);
    return true;
  } catch { return false; }
};

const exportCSV = (rows = []) => {
  if (!rows.length) { toast.info("No hay datos para exportar"); return; }
  const headers = ["timestamp", "actor", "action", "entity", "entity_id", "summary", "ip", "request_id"];
  const escape = (v) => `"${String(v ?? "").replaceAll(`"`, `""`)}"`;
  const lines = [
    headers.join(","),
    ...rows.map((r) => [
      toLocal(r.timestamp || r.created_at),
      r.actor_name || r.actor_id || "",
      r.action || "", r.entity || "", r.entity_id || "",
      r.summary || r.detail || "", r.ip || "", r.request_id || "",
    ].map(escape).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `audit_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/* ─── action badge ─── */
const ACTION_MAP = { create: "ab-create", update: "ab-update", delete: "ab-delete", login: "ab-login", logout: "ab-logout", access: "ab-access", error: "ab-error" };

const ActionBadge = ({ action }) => {
  const key = String(action || "").toLowerCase();
  const cls = ACTION_MAP[key] || "ab-default";
  return (
    <span className={`inline-flex items-center rounded-full text-[11px] font-800 px-2.5 py-0.5 ${cls}`}>
      {action || "—"}
    </span>
  );
};

/* ─── skeleton row ─── */
const SkeletonRow = () => (
  <tr className="audit-tr">
    {[36, 28, 20, 28, "full", 20, 24].map((w, i) => (
      <td key={i} className="audit-td">
        <div className={`audit-skel h-3.5 ${w === "full" ? "w-full" : `w-${w}`}`} style={{ width: w === "full" ? "100%" : `${w * 4}px` }} />
      </td>
    ))}
  </tr>
);

const DEFAULT_LIMIT = 10;

const AuditTab = () => {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ count: 0, limit: DEFAULT_LIMIT, offset: 0 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ q: "", actor: "", action: "", entity: "", from: "", to: "" });

  const debounced = useDebouncedObject(filters, 500);

  const effectiveFilters = useMemo(() => ({
    q: debounced.q?.trim() || "",
    actor: debounced.actor?.trim() || "",
    action: debounced.action?.trim() || "",
    entity: debounced.entity?.trim() || "",
    from: debounced.from || "",
    to: debounced.to || "",
  }), [debounced]);

  const fetchPage = useCallback(async ({ offset = 0 } = {}) => {
    try {
      setLoading(true);
      const data = await AuditService.list({ ...effectiveFilters, limit: DEFAULT_LIMIT, offset });
      const list = data?.logs ?? [];
      const count = data?.count ?? 0;
      const limit = data?.limit ?? DEFAULT_LIMIT;
      const serverOffset = data?.offset ?? offset;
      setMeta({ count, limit, offset: serverOffset });
      setRows(list);
    } catch {
      toast.error("No se pudo cargar la bitácora");
      setRows([]); setMeta({ count: 0, limit: DEFAULT_LIMIT, offset: 0 });
    } finally { setLoading(false); }
  }, [effectiveFilters]);

  // initial load
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchPage({ offset: 0 }); }, []);

  // filters change → reset page
  useEffect(() => { fetchPage({ offset: 0 }); }, [effectiveFilters, fetchPage]);

  const clearFilters = () => setFilters({ q: "", actor: "", action: "", entity: "", from: "", to: "" });

  /* pagination */
  const limit = meta.limit || DEFAULT_LIMIT;
  const offset = meta.offset || 0;
  const count = meta.count || 0;
  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(count / limit));
  const canPrev = offset > 0;
  const canNext = offset + limit < count;
  const showingFrom = count === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + rows.length, count);

  /* autocomplete options from current page */
  const actionOptions = useMemo(() => { const s = new Set(); rows.forEach((r) => r?.action && s.add(String(r.action))); return Array.from(s).sort(); }, [rows]);
  const entityOptions = useMemo(() => { const s = new Set(); rows.forEach((r) => r?.entity && s.add(String(r.entity))); return Array.from(s).sort(); }, [rows]);

  const hasAnyFilter = !!(filters.q || filters.actor || filters.action || filters.entity || filters.from || filters.to);
  const activeChips = [
    filters.q && { label: "q", value: filters.q },
    filters.actor && { label: "actor", value: filters.actor },
    filters.action && { label: "action", value: filters.action },
    filters.entity && { label: "entity", value: filters.entity },
    filters.from && { label: "desde", value: filters.from },
    filters.to && { label: "hasta", value: filters.to },
  ].filter(Boolean);

  return (
    <>
      <InjectAuditStyles />
      <div className="audit-root space-y-4">

        {/* ── module header ── */}
        <div className="audit-header rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-5 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                <ClipboardList className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-900 text-slate-800 tracking-tight">Bitácora de Auditoría</h2>
                <p className="text-xs text-slate-400 mt-0.5 font-500">Eventos del sistema con filtros, paginación y exportación CSV</p>
              </div>
            </div>
            <span className="hidden sm:inline-flex items-center px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-[11px] font-800 text-blue-700 uppercase tracking-wider">
              Seguridad
            </span>
          </div>
        </div>

        {/* ── filters ── */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <p className="text-xs font-800 text-slate-500 uppercase tracking-wider">Filtros de búsqueda</p>
            {hasAnyFilter && (
              <button type="button" className="text-[11px] font-700 text-red-500 hover:text-red-700 flex items-center gap-1 transition-colors" onClick={clearFilters}>
                <X className="w-3 h-3" /> Limpiar todo
              </button>
            )}
          </div>
          <div className="p-5 space-y-3">
            {/* search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input value={filters.q} onChange={(e) => setFilters((s) => ({ ...s, q: e.target.value }))}
                placeholder="Buscar por detalle, entidad, actor, resumen…"
                className="h-9 pl-9 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-sm" />
            </div>

            {/* secondary filters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-800 text-slate-400 uppercase tracking-wider mb-1 block">Actor</label>
                <Input value={filters.actor} onChange={(e) => setFilters((s) => ({ ...s, actor: e.target.value }))}
                  placeholder="Usuario o ID" className="h-9 rounded-xl border-slate-200 text-sm" />
              </div>
              <div>
                <label className="text-[10px] font-800 text-slate-400 uppercase tracking-wider mb-1 block">Acción</label>
                <datalist id="audit-actions">{actionOptions.map((a) => <option key={a} value={a} />)}</datalist>
                <Input list="audit-actions" value={filters.action} onChange={(e) => setFilters((s) => ({ ...s, action: e.target.value }))}
                  placeholder="create, update, delete…" className="h-9 rounded-xl border-slate-200 text-sm" />
              </div>
              <div>
                <label className="text-[10px] font-800 text-slate-400 uppercase tracking-wider mb-1 block">Entidad</label>
                <datalist id="audit-entities">{entityOptions.map((a) => <option key={a} value={a} />)}</datalist>
                <Input list="audit-entities" value={filters.entity} onChange={(e) => setFilters((s) => ({ ...s, entity: e.target.value }))}
                  placeholder="User, Student, Course…" className="h-9 rounded-xl border-slate-200 text-sm" />
              </div>
            </div>

            {/* date + buttons */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-800 text-slate-400 uppercase tracking-wider mb-1 block">Desde</label>
                <Input type="datetime-local" value={filters.from} onChange={(e) => setFilters((s) => ({ ...s, from: e.target.value }))}
                  className="h-9 rounded-xl border-slate-200 text-sm" />
              </div>
              <div>
                <label className="text-[10px] font-800 text-slate-400 uppercase tracking-wider mb-1 block">Hasta</label>
                <Input type="datetime-local" value={filters.to} onChange={(e) => setFilters((s) => ({ ...s, to: e.target.value }))}
                  className="h-9 rounded-xl border-slate-200 text-sm" />
              </div>
              <div className="flex items-end gap-2">
                <Button variant="outline" className="h-9 flex-1 rounded-xl border-slate-200 text-sm gap-1.5 hover:bg-slate-50"
                  onClick={() => fetchPage({ offset: 0 })}>
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Buscar
                </Button>
                <Button variant="outline" className="h-9 px-3 rounded-xl border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                  disabled={!hasAnyFilter} title="Limpiar filtros" onClick={clearFilters}>
                  <X className="w-3.5 h-3.5" />
                </Button>
                <Button className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-700 gap-1.5 shadow-sm"
                  onClick={() => exportCSV(rows)}>
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">Exportar</span>
                </Button>
              </div>
            </div>

            {/* active chips + count */}
            {(activeChips.length > 0 || count > 0) && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {activeChips.map((chip) => (
                  <span key={chip.label} className="audit-chip">
                    <span className="opacity-60">{chip.label}:</span> {chip.value}
                  </span>
                ))}
                <span className="ml-auto text-[11px] text-slate-400 font-500">
                  {showingFrom}–{showingTo} de {count} registros
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── table ── */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[1100px]">
              <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                <tr>
                  {[
                    { label: "Fecha", w: "w-40" },
                    { label: "Actor", w: "w-40" },
                    { label: "Acción", w: "w-28" },
                    { label: "Entidad", w: "w-40" },
                    { label: "Detalle", w: "" },
                    { label: "IP", w: "w-28" },
                    { label: "Request ID", w: "w-40" },
                  ].map(({ label, w }) => (
                    <th key={label} className={`audit-th ${w} text-left`}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}

                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3 text-slate-400">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                          <ClipboardList className="w-6 h-6 text-slate-300" />
                        </div>
                        <p className="text-sm font-700 text-slate-500">Sin registros encontrados</p>
                        {hasAnyFilter && <p className="text-xs">Intenta con otros filtros</p>}
                      </div>
                    </td>
                  </tr>
                )}

                {!loading && rows.map((r, i) => (
                  <tr key={r.id || r.request_id || i} className="audit-tr audit-fade">
                    {/* fecha */}
                    <td className="audit-td whitespace-nowrap">
                      <span className="text-xs text-slate-500">{toLocal(r.timestamp || r.created_at)}</span>
                    </td>

                    {/* actor */}
                    <td className="audit-td">
                      <p className="font-700 text-slate-700 leading-none">{r.actor_name || r.actor_id || "—"}</p>
                      {r.actor_id && r.actor_name && (
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">{r.actor_id}</p>
                      )}
                    </td>

                    {/* action */}
                    <td className="audit-td"><ActionBadge action={r.action} /></td>

                    {/* entity */}
                    <td className="audit-td whitespace-nowrap">
                      <span className="font-700 text-slate-700">{r.entity || "—"}</span>
                      {r.entity_id && <span className="text-slate-400 font-mono ml-1 text-[11px]">#{r.entity_id}</span>}
                    </td>

                    {/* detail */}
                    <td className="audit-td max-w-[44ch]">
                      <p className="line-clamp-2 text-slate-600 text-xs leading-relaxed" title={r.summary || r.detail || ""}>
                        {r.summary || r.detail || <span className="text-slate-300">—</span>}
                      </p>
                    </td>

                    {/* ip */}
                    <td className="audit-td">
                      <span className="font-mono text-xs text-slate-500">{r.ip || "—"}</span>
                    </td>

                    {/* request id */}
                    <td className="audit-td">
                      <div className="flex items-center gap-1.5">
                        <code className="text-[10px] bg-slate-100 text-slate-600 rounded-lg px-2 py-0.5 font-mono max-w-[120px] truncate">
                          {r.request_id || "—"}
                        </code>
                        {r.request_id && (
                          <button
                            className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Copiar Request ID"
                            onClick={async () => {
                              const ok = await safeCopy(r.request_id);
                              ok ? toast.success("Request ID copiado") : toast.error("No se pudo copiar");
                            }}
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── pagination ── */}
          <div className="px-5 py-3.5 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap bg-slate-50/60">
            <p className="text-xs text-slate-400 font-500">
              Página <span className="font-700 text-slate-600">{page}</span> de <span className="font-700 text-slate-600">{totalPages}</span>
              {count > 0 && <span className="text-slate-300 mx-1.5">·</span>}
              {count > 0 && <span>{count} registros en total</span>}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="h-8 px-3 rounded-xl border-slate-200 text-sm gap-1.5 disabled:opacity-40"
                disabled={loading || !canPrev}
                onClick={() => fetchPage({ offset: Math.max(0, offset - limit) })}>
                {loading && canPrev ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronLeft className="w-3.5 h-3.5" />}
                Anterior
              </Button>
              <Button variant="outline" className="h-8 px-3 rounded-xl border-slate-200 text-sm gap-1.5 disabled:opacity-40"
                disabled={loading || !canNext}
                onClick={() => fetchPage({ offset: offset + limit })}>
                Siguiente
                {loading && canNext ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>
        </div>

      </div>
    </>
  );
};

export default AuditTab;