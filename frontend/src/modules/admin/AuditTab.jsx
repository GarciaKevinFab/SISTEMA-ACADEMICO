// src/modules/admin/AuditTab.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { AuditService } from "../../services/audit.service";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { motion } from "framer-motion";
import { Search, RefreshCw, Download, Calendar, Copy, Filter, X } from "lucide-react";
import { toast } from "sonner";

/* ---------- Animations ---------- */
const fade = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.25 } };

/* ---------- Debounce hook ---------- */
const useDebounce = (value, delay = 500) => {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), delay); return () => clearTimeout(t); }, [value, delay]);
  return v;
};

/* ---------- Utils ---------- */
const toLocal = (ts) => {
  try { return new Date(ts).toLocaleString(); } catch { return ts || ""; }
};

const exportCSV = (rows = []) => {
  if (!rows.length) { toast.info("No hay datos para exportar"); return; }
  const headers = ["timestamp","actor","action","entity","entity_id","summary","ip","request_id"];
  const escape = (v) => `"${String(v ?? "").replaceAll(`"`, `""`)}"`;
  const lines = [
    headers.join(","),
    ...rows.map(r => [
      toLocal(r.timestamp || r.created_at),
      r.actor_name || r.actor_id || "",
      r.action || "",
      r.entity || "",
      r.entity_id || "",
      r.summary || r.detail || "",
      r.ip || "",
      r.request_id || ""
    ].map(escape).join(","))
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit_${new Date().toISOString().slice(0,19).replace(/[:T]/g,"-")}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const ActionBadge = ({ action }) => {
  const a = String(action || "").toLowerCase();
  const map = {
    create: "bg-emerald-600",
    update: "bg-blue-600",
    delete: "bg-rose-600",
    login: "bg-amber-600",
    logout: "bg-slate-600",
  };
  const cls = map[a] || "bg-indigo-600";
  return (
    <span className={`inline-flex items-center rounded-full ${cls} text-white text-xs px-2.5 py-1`}>
      {action || "—"}
    </span>
  );
};

const Pill = ({ children }) => (
  <div className="rounded-full bg-black/[0.03] dark:bg-white/[0.06] px-2 py-1 text-xs text-muted-foreground border border-white/40 dark:border-white/10">
    {children}
  </div>
);

const AuditTab = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    q: "", actor: "", action: "", entity: "",
    from: "", to: ""
  });

  const debounced = {
    q: useDebounce(filters.q),
    actor: useDebounce(filters.actor),
    action: useDebounce(filters.action),
    entity: useDebounce(filters.entity),
    from: useDebounce(filters.from),
    to: useDebounce(filters.to),
  };

  const fetchData = useCallback(async (params) => {
    try {
      setLoading(true);
      const data = await AuditService.list(params ?? filters);
      setRows(data?.logs ?? data ?? []);
    } catch {
      toast.error("No se pudo cargar la bitácora");
    } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => {
    // carga inicial
    fetchData(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // búsqueda reactiva con debounce
    fetchData({
      q: debounced.q, actor: debounced.actor, action: debounced.action, entity: debounced.entity,
      from: debounced.from, to: debounced.to
    });
  }, [debounced.q, debounced.actor, debounced.action, debounced.entity, debounced.from, debounced.to, fetchData]);

  const clearFilters = () => setFilters({ q: "", actor: "", action: "", entity: "", from: "", to: "" });

  const total = rows.length;

  return (
    <Card className="rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] border border-white/50 dark:border-white/10 bg-white/70 dark:bg-neutral-900/60 backdrop-blur-md">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">Bitácora / Auditoría</CardTitle>
        <CardDescription>Consulta de eventos del sistema con filtros y exportación</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Toolbar pill */}
        <div className="rounded-2xl p-3 border border-white/50 dark:border-white/10 bg-gradient-to-r from-slate-100 to-white dark:from-neutral-800 dark:to-neutral-900">
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60" />
              <Input
                value={filters.q}
                onChange={(e) => setFilters((s) => ({ ...s, q: e.target.value }))}
                placeholder="Buscar en detalle, actor, IP, ReqId…"
                className="pl-9 rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 md:flex md:flex-row gap-2">
              <Input
                value={filters.actor}
                onChange={(e) => setFilters((s) => ({ ...s, actor: e.target.value }))}
                placeholder="Actor"
                className="rounded-xl"
              />
              <Input
                value={filters.action}
                onChange={(e) => setFilters((s) => ({ ...s, action: e.target.value }))}
                placeholder="Acción (create/update/delete/login)"
                className="rounded-xl"
              />
              <Input
                value={filters.entity}
                onChange={(e) => setFilters((s) => ({ ...s, entity: e.target.value }))}
                placeholder="Entidad (user, role, applicant...)"
                className="rounded-xl"
              />
            </div>
          </div>

          <div className="mt-2 grid md:grid-cols-3 gap-2">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60" />
              <Input
                type="datetime-local"
                value={filters.from}
                onChange={(e) => setFilters((s) => ({ ...s, from: e.target.value }))}
                className="pl-9 rounded-xl"
                placeholder="Desde"
              />
            </div>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60" />
              <Input
                type="datetime-local"
                value={filters.to}
                onChange={(e) => setFilters((s) => ({ ...s, to: e.target.value }))}
                className="pl-9 rounded-xl"
                placeholder="Hasta"
              />
            </div>

            <div className="flex items-center gap-2 justify-end">
              <Button variant="outline" onClick={() => fetchData()} className="rounded-xl gap-2">
                <RefreshCw className="h-4 w-4" /> Buscar
              </Button>
              <Button variant="outline" onClick={clearFilters} className="rounded-xl gap-2">
                <X className="h-4 w-4" /> Limpiar
              </Button>
              <Button onClick={() => exportCSV(rows)} className="rounded-xl gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700">
                <Download className="h-4 w-4" /> Exportar CSV
              </Button>
            </div>
          </div>

          {/* Chips del filtro activo */}
          <div className="mt-3 flex flex-wrap gap-2">
            {filters.q && <Pill>q: {filters.q}</Pill>}
            {filters.actor && <Pill>actor: {filters.actor}</Pill>}
            {filters.action && <Pill>action: {filters.action}</Pill>}
            {filters.entity && <Pill>entity: {filters.entity}</Pill>}
            {filters.from && <Pill>desde: {filters.from.replace("T"," ")}</Pill>}
            {filters.to && <Pill>hasta: {filters.to.replace("T"," ")}</Pill>}
            <span className="ml-auto text-xs text-muted-foreground">Total: {total}</span>
          </div>
        </div>

        {/* Tabla */}
      
<div className="rounded-2xl border border-white/50 dark:border-white/10 overflow-auto">
  <table className="w-full text-sm">
    <thead className="bg-gray-200 text-black"> {/* Primera fila gris y texto negro */}
      <tr>
        <th className="p-2 text-left">Fecha</th>
        <th className="p-2 text-left">Actor</th>
        <th className="p-2 text-left">Acción</th>
        <th className="p-2 text-left">Entidad</th>
        <th className="p-2 text-left">Detalle</th>
        <th className="p-2 text-left">IP</th>
        <th className="p-2 text-left">ReqId</th>
      </tr>
    </thead>
    <tbody className="bg-white text-black"> {/* Resto de las filas en blanco y texto negro */}
      {loading && Array.from({ length: 8 }).map((_, i) => (
        <tr key={`sk-${i}`} className="border-t border-white/40 dark:border-white/10">
          <td className="p-2"><div className="h-4 w-36 rounded bg-gray-200 dark:bg-white/10 animate-pulse" /></td>
          <td className="p-2"><div className="h-4 w-28 rounded bg-gray-200 dark:bg-white/10 animate-pulse" /></td>
          <td className="p-2"><div className="h-4 w-20 rounded bg-gray-200 dark:bg-white/10 animate-pulse" /></td>
          <td className="p-2"><div className="h-4 w-24 rounded bg-gray-200 dark:bg-white/10 animate-pulse" /></td>
          <td className="p-2"><div className="h-4 w-[22rem] rounded bg-gray-200 dark:bg-white/10 animate-pulse" /></td>
          <td className="p-2"><div className="h-4 w-20 rounded bg-gray-200 dark:bg-white/10 animate-pulse" /></td>
          <td className="p-2"><div className="h-4 w-28 rounded bg-gray-200 dark:bg-white/10 animate-pulse" /></td>
        </tr>
      ))}

      {!loading && rows.length === 0 && (
        <tr>
          <td className="p-6 text-center text-gray-500" colSpan={7}>Sin registros</td>
        </tr>
      )}

      {!loading && rows.map((r, i) => (
        <motion.tr
          key={r.id || r.request_id || i}
          {...fade}
          className="border-t border-white/40 dark:border-white/10 even:bg-white hover:bg-blue-50/60 dark:hover:bg-blue-900/20 transition-colors"
        >
          <td className="p-2 whitespace-nowrap">{toLocal(r.timestamp || r.created_at)}</td>
          <td className="p-2">{r.actor_name || r.actor_id}</td>
          <td className="p-2"><ActionBadge action={r.action} /></td>
          <td className="p-2 whitespace-nowrap">
            {r.entity}{r.entity_id ? <span className="opacity-70">#{r.entity_id}</span> : ""}
          </td>
          <td className="p-2 max-w-[40ch]">
            <span title={r.summary || r.detail} className="line-clamp-2">
              {r.summary || r.detail}
            </span>
          </td>
          <td className="p-2">{r.ip}</td>
          <td className="p-2">
            <div className="flex items-center gap-1">
              <code className="text-xs bg-black/5 dark:bg-white/10 rounded px-1.5 py-0.5">{r.request_id || "—"}</code>
              {r.request_id && (
                <button
                  className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10"
                  title="Copiar Request ID"
                  onClick={() => { navigator.clipboard.writeText(r.request_id); toast.success("ReqId copiado"); }}
                >
                  <Copy className="h-4 w-4" />
                </button>
              )}
            </div>
          </td>
        </motion.tr>
      ))}
    </tbody>
  </table>
</div>

      </CardContent>
    </Card>
  );
};

export default AuditTab;
