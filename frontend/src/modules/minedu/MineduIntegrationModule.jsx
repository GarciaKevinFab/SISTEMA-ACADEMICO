// src/components/MineduIntegrationModule.jsx
//
// Módulo de Integración MINEDU / SIA — v5
// Design: "Institutional Clean" — matching Admisión Module style
// - Light, airy backgrounds with white cards
// - Pill-style tab navigation
// - Stat cards with right-aligned soft icons
// - Subtle borders, minimal shadows
// - Clean typography hierarchy
// - Soft accent colors through icon circles

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Stats, Exports, Validation, Codes, Catalog, Mapping, Jobs,
} from "../../services/minedu.service";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  BarChart3, FileSpreadsheet, History, Link2, ShieldCheck,
  Cog, Download, RefreshCw, Play, Pause, Plus, Search, X,
  Loader2, CheckCircle2, AlertTriangle, XCircle, Clock,
  ChevronDown, FileText, Users, GraduationCap,
  Building2, BookOpen, ClipboardList, Award, FileCheck, Zap,
  Save, Upload, LayoutGrid, Table2, ArrowUpRight, Database,
  TrendingUp, Activity,
} from "lucide-react";
import { toast } from "sonner";

/* ================================================================
   DESIGN TOKENS
   ================================================================ */

const TABS = [
  { key: "dashboard", label: "Dashboard", icon: BarChart3 },
  { key: "export", label: "Exportar", icon: Upload },
  { key: "history", label: "Historial", icon: History },
  { key: "mappings", label: "Mapeos", icon: Link2 },
  { key: "validation", label: "Validación", icon: ShieldCheck },
  { key: "jobs", label: "Jobs", icon: Cog },
];

const DATA_TYPES = [
  { value: "ENROLLMENT", label: "Nómina de Matrícula", desc: "Padrón general de matriculados", icon: ClipboardList, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
  { value: "FICHA", label: "Ficha de Matrícula", desc: "Ficha individual por estudiante", icon: FileText, color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-200" },
  { value: "BOLETA", label: "Boleta de Notas", desc: "Notas con promedio ponderado", icon: FileCheck, color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-200" },
  { value: "ACTA", label: "Acta Consolidada", desc: "Tabla alumnos × asignaturas", icon: Table2, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
  { value: "REPORTE", label: "Reporte Kardex", desc: "Historial académico completo", icon: BookOpen, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
  { value: "REGISTRO_AUX", label: "Registro Auxiliar", desc: "Plantilla de notas parciales", icon: LayoutGrid, color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-200" },
  { value: "CERTIFICADO", label: "Certificado Estudios", desc: "Certificado oficial por período", icon: Award, color: "text-teal-600", bg: "bg-teal-50", border: "border-teal-200" },
];

const EXPORT_FORMATS = [
  { value: "XLSX", label: "Excel (.xlsx)", icon: FileSpreadsheet },
  { value: "CSV", label: "CSV (.csv)", icon: FileText },
];

const CATALOG_TYPES = [
  { value: "INSTITUTION", label: "Institución", icon: Building2 },
  { value: "CAREER", label: "Programa de Estudios", icon: GraduationCap },
  { value: "STUDY_PLAN", label: "Plan de Estudios", icon: BookOpen },
  { value: "STUDENT", label: "Estudiante", icon: Users },
];

const STATUS_MAP = {
  COMPLETED: { label: "Completado", bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", ring: "ring-emerald-200" },
  FAILED: { label: "Fallido", bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500", ring: "ring-red-200" },
  PROCESSING: { label: "Procesando", bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500", ring: "ring-blue-200" },
  PENDING: { label: "Pendiente", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", ring: "ring-amber-200" },
  RETRYING: { label: "Reintentando", bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-500", ring: "ring-orange-200" },
};

/* ================================================================
   HOOKS
   ================================================================ */

function useDebounce(value, delay = 300) {
  const [d, setD] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setD(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return d;
}

/* ================================================================
   SHARED PRIMITIVES
   ================================================================ */

function StatusBadge({ status }) {
  const s = STATUS_MAP[status] || STATUS_MAP.PENDING;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${s.bg} ${s.text} ring-1 ${s.ring}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot} ${status === "PROCESSING" ? "animate-pulse" : ""}`} />
      {s.label}
    </span>
  );
}

function TipBtn({ icon: Icon, label, onClick, cls = "", disabled = false }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            disabled={disabled}
            className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors hover:bg-slate-100 disabled:opacity-40 ${cls}`}
          >
            <Icon className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs font-medium">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function Empty({ icon: Icon = FileText, title, sub, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <Icon className="h-6 w-6 text-slate-400" />
      </div>
      <p className="text-sm font-semibold text-slate-600">{title}</p>
      {sub && <p className="text-xs text-slate-400 mt-1 max-w-xs text-center">{sub}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function Collapsible({ open, toggle, icon: Icon, iconCls, title, titleCls, borderCls, children }) {
  return (
    <div className={`rounded-xl border ${borderCls} overflow-hidden`}>
      <button onClick={toggle} className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/50 transition-colors">
        <div className="flex items-center gap-2.5">
          <Icon className={`h-4 w-4 ${iconCls}`} />
          <span className={`text-sm font-semibold ${titleCls}`}>{title}</span>
        </div>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <div className={`grid transition-all duration-200 ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <div className="px-5 pb-4 pt-1 border-t border-slate-100">{children}</div>
        </div>
      </div>
    </div>
  );
}

/* Skeletons */
function DashSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-20 rounded-xl bg-slate-100" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-xl bg-slate-100" />)}
      </div>
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-slate-100" />)}
      </div>
    </div>
  );
}

function TblSkeleton({ rows = 5 }) {
  return (
    <div className="animate-pulse space-y-px">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="h-12 bg-slate-50 first:rounded-t-lg last:rounded-b-lg" />
      ))}
    </div>
  );
}


/* ================================================================
   MAIN COMPONENT
   ================================================================ */

export default function MineduIntegrationModule() {
  const [tab, setTab] = useState("dashboard");

  return (
    <div className="min-h-screen bg-[#eef2f6]">
      {/* ─── MODULE HEADER ─── */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="h-9 w-9 rounded-lg bg-slate-700 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Integración MINEDU / SIA</h1>
            <p className="text-sm text-slate-400">Documentos oficiales para archivo institucional</p>
          </div>
        </div>
      </div>

      {/* ─── TAB NAVIGATION ─── */}
      <div className="px-6 pb-4">
        <div className="flex items-center gap-1.5 flex-wrap">
          {TABS.map(t => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`
                  flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all
                  ${active
                    ? "bg-slate-800 text-white shadow-sm"
                    : "bg-white text-slate-500 hover:text-slate-700 hover:bg-slate-50 border border-slate-200"
                  }
                `}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── CONTENT AREA ─── */}
      <div className="px-6 pb-6">
        {tab === "dashboard" && <DashboardTab onNav={setTab} />}
        {tab === "export" && <ExportTab />}
        {tab === "history" && <HistoryTab />}
        {tab === "mappings" && <MappingsTab />}
        {tab === "validation" && <ValidationTab />}
        {tab === "jobs" && <JobsTab />}
      </div>
    </div>
  );
}


/* ================================================================
   DASHBOARD
   ================================================================ */

function DashboardTab({ onNav }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Stats.dashboard()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <DashSkeleton />;
  if (!stats) return <Empty icon={BarChart3} title="No se pudo cargar el dashboard" sub="Verifica tu conexión" />;

  const { stats: s, data_breakdown: db } = stats;
  const rate = Number(s.success_rate) || 0;

  return (
    <div className="space-y-6">
      {/* ── Title card ── */}
      <div className="bg-white rounded-xl border border-slate-200 px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-sky-100 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-sky-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">Integración MINEDU / SIA</h2>
            <p className="text-sm text-slate-400">Resumen general de exportaciones</p>
          </div>
        </div>
        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold px-3 py-1.5 rounded-full">
          <span className="h-2 w-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />
          Servicio activo
        </Badge>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="PENDIENTES"
          value={s.pending_exports}
          sub="En cola"
          icon={Clock}
          iconBg="bg-amber-50"
          iconColor="text-amber-500"
        />
        <StatCard
          label="COMPLETADAS"
          value={s.completed_exports}
          sub="Exitosas"
          icon={CheckCircle2}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-500"
        />
        <StatCard
          label="FALLIDAS"
          value={s.failed_exports}
          sub="Con error"
          icon={XCircle}
          iconBg="bg-red-50"
          iconColor="text-red-500"
        />
        <StatCard
          label="TASA DE ÉXITO"
          value={`${rate}%`}
          sub="De exportaciones"
          icon={TrendingUp}
          iconBg="bg-blue-50"
          iconColor="text-blue-500"
        />
      </div>

      {/* ── Breakdown section ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Desglose por tipo</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <BreakCard icon={ClipboardList} label="Matrícula" value={db.enrollment_exports} iconBg="bg-blue-50" iconColor="text-blue-500" />
          <BreakCard icon={FileCheck} label="Calificaciones" value={db.grades_exports} iconBg="bg-emerald-50" iconColor="text-emerald-500" />
          <BreakCard icon={Users} label="Estudiantes" value={db.students_exports} iconBg="bg-indigo-50" iconColor="text-indigo-500" />
        </div>
      </div>

      {/* ── Quick actions ── */}
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">
          Accesos directos
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Upload, label: "Nueva exportación", sub: "Generar documentos", tab: "export", iconBg: "bg-blue-50", iconColor: "text-blue-500" },
            { icon: ShieldCheck, label: "Validar datos", sub: "Verificar integridad", tab: "validation", iconBg: "bg-emerald-50", iconColor: "text-emerald-500" },
            { icon: Link2, label: "Revisar mapeos", sub: "Códigos MINEDU", tab: "mappings", iconBg: "bg-violet-50", iconColor: "text-violet-500" },
            { icon: History, label: "Ver historial", sub: "Exportaciones previas", tab: "history", iconBg: "bg-amber-50", iconColor: "text-amber-500" },
          ].map(q => (
            <button
              key={q.tab}
              onClick={() => onNav?.(q.tab)}
              className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col items-center text-center hover:shadow-md hover:border-slate-300 transition-all group"
            >
              <div className={`h-12 w-12 rounded-xl ${q.iconBg} flex items-center justify-center mb-3 group-hover:scale-105 transition-transform`}>
                <q.icon className={`h-6 w-6 ${q.iconColor}`} />
              </div>
              <p className="text-sm font-semibold text-slate-700">{q.label}</p>
              <p className="text-xs text-slate-400 mt-0.5">{q.sub}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon, iconBg, iconColor }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-start justify-between">
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="text-3xl font-bold text-slate-800 mt-1">{value}</p>
        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
          <TrendingUp className="h-3 w-3" /> {sub}
        </p>
      </div>
      <div className={`h-11 w-11 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
        <Icon className={`h-5.5 w-5.5 ${iconColor}`} />
      </div>
    </div>
  );
}

function BreakCard({ icon: Icon, label, value, iconBg, iconColor }) {
  return (
    <div className="flex items-center gap-3.5 rounded-xl bg-slate-50 border border-slate-100 p-4 hover:bg-slate-100/70 transition-colors">
      <div className={`h-10 w-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
        <Icon className={`h-5 w-5 ${iconColor}`} />
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
      </div>
    </div>
  );
}


/* ================================================================
   EXPORTAR
   ================================================================ */

function ExportTab() {
  const yr = new Date().getFullYear();
  const [form, setForm] = useState({
    data_type: "ENROLLMENT",
    export_format: "XLSX",
    academic_year: yr,
    academic_period: "I",
  });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const run = async () => {
    setBusy(true); setResult(null); setError(null);
    try {
      const r = await Exports.generate(form);
      setResult(r);
      toast.success("Exportación generada");
    } catch (e) {
      const m = e?.response?.data?.detail || e.message || "Error";
      setError(m);
      toast.error(m);
    } finally {
      setBusy(false);
    }
  };

  const sel = DATA_TYPES.find(t => t.value === form.data_type);

  return (
    <div className="space-y-6">
      {/* Step 1 */}
      <div>
        <StepLabel n={1} text="Selecciona el tipo de documento" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 mt-3">
          {DATA_TYPES.map(dt => {
            const Icon = dt.icon;
            const on = form.data_type === dt.value;
            return (
              <button
                key={dt.value}
                onClick={() => setForm({ ...form, data_type: dt.value })}
                className={`
                  group text-left rounded-xl border-2 p-3.5 transition-all
                  ${on
                    ? `${dt.border} ${dt.bg} shadow-sm`
                    : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                  }
                `}
              >
                <div className="flex items-start gap-3">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 transition-all ${on ? `${dt.bg}` : "bg-slate-100 group-hover:bg-slate-50"}`}>
                    <Icon className={`h-4 w-4 ${on ? dt.color : "text-slate-400"}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className={`text-sm font-semibold truncate ${on ? "text-slate-800" : "text-slate-600"}`}>{dt.label}</p>
                      {on && <CheckCircle2 className={`h-4 w-4 ${dt.color} shrink-0`} />}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{dt.desc}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 2 */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <StepLabel n={2} text="Configura los parámetros" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          <Field label="Formato">
            <Select value={form.export_format} onValueChange={v => setForm({ ...form, export_format: v })}>
              <SelectTrigger className="bg-slate-50 border-slate-200 hover:bg-white transition-colors"><SelectValue /></SelectTrigger>
              <SelectContent>
                {EXPORT_FORMATS.map(f => (
                  <SelectItem key={f.value} value={f.value}>
                    <span className="flex items-center gap-2"><f.icon className="h-3.5 w-3.5 text-slate-400" />{f.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Año académico">
            <Input
              type="number"
              value={form.academic_year}
              onChange={e => setForm({ ...form, academic_year: parseInt(e.target.value) || yr })}
              className="bg-slate-50 border-slate-200"
              min={2020} max={2030}
            />
          </Field>
          <Field label="Período">
            <Select value={form.academic_period} onValueChange={v => setForm({ ...form, academic_period: v })}>
              <SelectTrigger className="bg-slate-50 border-slate-200 hover:bg-white transition-colors"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="I">I — Primer semestre</SelectItem>
                <SelectItem value="II">II — Segundo semestre</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </div>

      {/* Action bar */}
      <div className="bg-white rounded-xl border border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          {sel && (
            <>
              <div className={`h-7 w-7 rounded-lg ${sel.bg} flex items-center justify-center`}>
                <sel.icon className={`h-3.5 w-3.5 ${sel.color}`} />
              </div>
              <span className="font-semibold text-slate-700">{sel.label}</span>
              <span className="text-slate-300">·</span>
              <span className="font-mono text-xs">{form.export_format} · {form.academic_year}-{form.academic_period}</span>
            </>
          )}
        </div>
        <Button
          onClick={run}
          disabled={busy}
          className="bg-slate-800 hover:bg-slate-700 shadow-sm min-w-[170px] h-10 text-sm font-semibold"
        >
          {busy
            ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Generando…</>
            : <><Upload className="h-4 w-4 mr-2" />Generar documento</>
          }
        </Button>
      </div>

      {/* Feedback */}
      {result && (
        <FeedbackBanner
          ok
          icon={CheckCircle2}
          title="Exportación generada exitosamente"
          detail={`${result.total_records} registros · ${result.data_type} · ${result.export_format}`}
          action={result.file_url && (
            <a href={result.file_url} download className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:text-emerald-900">
              <Download className="h-4 w-4" />Descargar
            </a>
          )}
        />
      )}
      {error && <FeedbackBanner icon={XCircle} title="Error al generar" detail={error} />}
    </div>
  );
}

function StepLabel({ n, text }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-slate-800 text-[11px] font-bold text-white">{n}</span>
      <span className="text-sm font-semibold text-slate-700">{text}</span>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}

function FeedbackBanner({ ok = false, icon: Icon, title, detail, action }) {
  return (
    <div className={`rounded-xl border p-5 flex items-start gap-4 ${ok ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${ok ? "bg-emerald-100" : "bg-red-100"}`}>
        <Icon className={`h-5 w-5 ${ok ? "text-emerald-600" : "text-red-600"}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${ok ? "text-emerald-800" : "text-red-800"}`}>{title}</p>
        {detail && <p className={`text-xs mt-0.5 ${ok ? "text-emerald-600" : "text-red-600"}`}>{detail}</p>}
        {action && <div className="mt-2.5">{action}</div>}
      </div>
    </div>
  );
}


/* ================================================================
   HISTORIAL
   ================================================================ */

function HistoryTab() {
  const [exps, setExps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const dq = useDebounce(q, 250);
  const [ft, setFt] = useState("ALL");

  const load = useCallback(() => {
    setLoading(true);
    Exports.list()
      .then(r => setExps(r?.exports || []))
      .catch(() => setExps([]))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const retry = async id => {
    try { await Exports.retry(id); toast.success("Reintentando…"); load(); }
    catch { toast.error("Error"); }
  };

  const tLabel = dt => DATA_TYPES.find(t => t.value === dt)?.label || dt;
  const tIcon = dt => DATA_TYPES.find(t => t.value === dt)?.icon || FileText;

  const filtered = useMemo(() => {
    let r = exps;
    if (ft !== "ALL") r = r.filter(e => e.data_type === ft);
    if (dq) {
      const s = dq.toLowerCase();
      r = r.filter(e => tLabel(e.data_type).toLowerCase().includes(s) || (e.export_format || "").toLowerCase().includes(s));
    }
    return r;
  }, [exps, ft, dq]);

  const counts = useMemo(() => {
    const m = {};
    exps.forEach(e => { m[e.status] = (m[e.status] || 0) + 1; });
    return m;
  }, [exps]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-800">Historial de Exportaciones</h3>
          <p className="text-xs text-slate-400 mt-0.5">{exps.length} registros</p>
        </div>
        <Button size="sm" variant="outline" onClick={load} className="border-slate-200 hover:bg-slate-50">
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Actualizar
        </Button>
      </div>

      {Object.keys(counts).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(counts).map(([st, c]) => (
            <span key={st} className="inline-flex items-center gap-1.5">
              <StatusBadge status={st} />
              <span className="text-xs text-slate-400 font-mono">{c}</span>
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Buscar…" className="pl-9 bg-white border-slate-200" value={q} onChange={e => setQ(e.target.value)} />
          {q && <button onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="h-3.5 w-3.5" /></button>}
        </div>
        <Select value={ft} onValueChange={setFt}>
          <SelectTrigger className="w-[200px] bg-white border-slate-200"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los tipos</SelectItem>
            {DATA_TYPES.map(dt => <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? <TblSkeleton /> : filtered.length === 0 ? (
        <Empty
          icon={History}
          title={q || ft !== "ALL" ? "Sin resultados" : "Sin exportaciones"}
          sub={q ? "Intenta con otros términos" : "Genera tu primera exportación"}
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tipo</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Formato</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Período</th>
                  <th className="text-right px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden md:table-cell">Registros</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estado</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Fecha</th>
                  <th className="w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(exp => {
                  const TI = tIcon(exp.data_type);
                  return (
                    <tr key={exp.id} className="group hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <TI className="h-4 w-4 text-slate-400" />
                          <span className="font-medium text-slate-700">{tLabel(exp.data_type)}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 hidden sm:table-cell">
                        <code className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-semibold">{exp.export_format}</code>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-slate-600">{exp.academic_year}-{exp.academic_period}</td>
                      <td className="px-5 py-3.5 text-right font-mono text-xs text-slate-500 hidden md:table-cell">{exp.total_records}</td>
                      <td className="px-5 py-3.5"><StatusBadge status={exp.status} /></td>
                      <td className="px-5 py-3.5 text-xs text-slate-400 hidden lg:table-cell">{new Date(exp.created_at).toLocaleString("es-PE")}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {exp.status === "COMPLETED" && exp.file_url && (
                            <a href={exp.file_url} download>
                              <TipBtn icon={Download} label="Descargar" cls="text-blue-600 hover:bg-blue-50" onClick={() => { }} />
                            </a>
                          )}
                          {exp.status === "FAILED" && (
                            <TipBtn icon={RefreshCw} label="Reintentar" cls="text-orange-600 hover:bg-orange-50" onClick={() => retry(exp.id)} />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-400 font-medium">
            Mostrando {filtered.length} de {exps.length} exportaciones
          </div>
        </div>
      )}
    </div>
  );
}


/* ================================================================
   MAPEOS
   ================================================================ */

function MappingsTab() {
  const [catType, setCatType] = useState("CAREER");
  const [localItems, setLocalItems] = useState([]);
  const [remoteCodes, setRemoteCodes] = useState([]);
  const [mappings, setMappings] = useState({});
  const [mineduCodes, setMineduCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [search, setSearch] = useState("");
  const ds = useDebounce(search, 200);
  const [nc, setNc] = useState({ code: "", label: "" });
  const [adding, setAdding] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true); setSaveMsg(null);
    try {
      const [lr, rr, mr, cr] = await Promise.all([
        Catalog.local(catType), Catalog.remote(catType),
        Mapping.list(catType), Codes.list(catType),
      ]);
      setLocalItems(lr?.items || []);
      setRemoteCodes(rr?.items || []);
      setMineduCodes(cr?.items || []);
      const m = {};
      (mr?.mappings || []).forEach(x => { m[x.local_id] = x.minedu_code || ""; });
      setMappings(m);
    } catch {
      setLocalItems([]); setRemoteCodes([]);
    } finally {
      setLoading(false);
    }
  }, [catType]);
  useEffect(() => { loadData(); }, [loadData]);

  const save = async () => {
    setSaving(true); setSaveMsg(null);
    try {
      const a = Object.entries(mappings).map(([l, c]) => ({ local_id: parseInt(l), minedu_code: c }));
      const r = await Mapping.saveBulk(catType, a);
      setSaveMsg({ ok: true, t: `${r.saved} guardados` });
      toast.success(`${r.saved} mapeo(s) guardados`);
    } catch {
      setSaveMsg({ ok: false, t: "Error" });
      toast.error("Error");
    } finally {
      setSaving(false);
    }
  };

  const addCode = async () => {
    if (!nc.code.trim()) return;
    setAdding(true);
    try {
      await Codes.create({ ...nc, type: catType });
      setNc({ code: "", label: "" });
      toast.success("Agregado");
      loadData();
    } catch { toast.error("Error"); }
    finally { setAdding(false); }
  };

  const delCode = async id => {
    try { await Codes.delete(id); toast.success("Eliminado"); loadData(); }
    catch { toast.error("Error"); }
  };

  const ms = useMemo(() => {
    const t = localItems.length;
    const m = localItems.filter(i => mappings[i.id]?.trim()).length;
    return { t, m, p: t > 0 ? Math.round((m / t) * 100) : 0 };
  }, [localItems, mappings]);

  const fItems = useMemo(() => {
    if (!ds) return localItems;
    const s = ds.toLowerCase();
    return localItems.filter(i => (i.name || "").toLowerCase().includes(s) || (i.code || "").toLowerCase().includes(s));
  }, [localItems, ds]);

  const cc = CATALOG_TYPES.find(c => c.value === catType);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-bold text-slate-800">Mapeos locales → MINEDU</h3>
        <p className="text-xs text-slate-400 mt-0.5">Vincula registros internos con códigos oficiales</p>
      </div>

      {/* Catalog type pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {CATALOG_TYPES.map(ct => {
          const I = ct.icon;
          const active = catType === ct.value;
          return (
            <button
              key={ct.value}
              onClick={() => { setCatType(ct.value); setSearch(""); }}
              className={`
                flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-full transition-all
                ${active
                  ? "bg-slate-800 text-white shadow-sm"
                  : "bg-white text-slate-500 hover:text-slate-700 border border-slate-200"
                }
              `}
            >
              <I className="h-3.5 w-3.5" />{ct.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-28 bg-slate-100 rounded-xl" />
          <TblSkeleton rows={4} />
        </div>
      ) : (
        <>
          {/* Codes */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-700">Códigos MINEDU — {cc?.label}</h4>
                <p className="text-xs text-slate-400 mt-0.5">{mineduCodes.length} código(s)</p>
              </div>
            </div>
            {mineduCodes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {mineduCodes.map(c => (
                  <span key={c.id} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-full text-xs group hover:border-slate-300 transition-colors">
                    <code className="font-mono font-bold text-slate-700">{c.code}</code>
                    {c.label && <span className="text-slate-400">· {c.label}</span>}
                    <button onClick={() => delCode(c.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2 items-end">
              <div className="flex-1 max-w-[140px]">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Código</label>
                <Input placeholder="001" value={nc.code} onChange={e => setNc({ ...nc, code: e.target.value })} className="h-9 bg-slate-50 border-slate-200 text-xs font-mono" />
              </div>
              <div className="flex-1 max-w-[220px]">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Etiqueta</label>
                <Input placeholder="Descripción" value={nc.label} onChange={e => setNc({ ...nc, label: e.target.value })} className="h-9 bg-slate-50 border-slate-200 text-xs" />
              </div>
              <Button size="sm" className="h-9 bg-slate-800 hover:bg-slate-700 shadow-sm" onClick={addCode} disabled={adding || !nc.code.trim()}>
                {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}Agregar
              </Button>
            </div>
          </div>

          {/* Completeness */}
          {localItems.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-5">
              <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                <Database className="h-5 w-5 text-indigo-500" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-600">Completitud de mapeos</span>
                  <span className={`text-xs font-mono font-bold ${ms.p === 100 ? "text-emerald-600" : ms.p > 50 ? "text-amber-600" : "text-red-500"}`}>
                    {ms.m}/{ms.t} ({ms.p}%)
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${ms.p === 100 ? "bg-emerald-500" : ms.p > 50 ? "bg-amber-500" : "bg-red-500"}`}
                    style={{ width: `${ms.p}%` }}
                  />
                </div>
              </div>
              {ms.p === 100 && <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />}
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input placeholder="Buscar…" className="pl-8 h-8 text-xs bg-white border-slate-200" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <span className="text-[11px] text-slate-400 font-medium">{fItems.length} registros</span>
            </div>

            {fItems.length === 0 ? (
              <div className="p-8">
                <Empty icon={cc?.icon || FileText} title={search ? "Sin resultados" : "No hay registros"} />
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-5 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider w-14">ID</th>
                        <th className="px-5 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nombre</th>
                        <th className="px-5 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Cód. local</th>
                        <th className="px-5 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Código MINEDU</th>
                        <th className="px-5 py-2.5 text-center w-12" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {fItems.map(it => {
                        const has = !!mappings[it.id]?.trim();
                        return (
                          <tr key={it.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-5 py-3 text-xs text-slate-400 font-mono">{it.id}</td>
                            <td className="px-5 py-3 font-medium text-slate-700">{it.name}</td>
                            <td className="px-5 py-3 text-slate-500 font-mono text-xs hidden sm:table-cell">{it.code || it.ident || "—"}</td>
                            <td className="px-5 py-3">
                              <Input
                                value={mappings[it.id] || ""}
                                list={`codes-${catType}`}
                                onChange={e => setMappings(p => ({ ...p, [it.id]: e.target.value }))}
                                placeholder="Código MINEDU"
                                className={`h-8 text-xs font-mono border-slate-200 w-44 transition-colors ${has ? "border-emerald-300 bg-emerald-50 focus:border-emerald-400" : "bg-slate-50"}`}
                              />
                            </td>
                            <td className="px-5 py-3 text-center">
                              {has
                                ? <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                                : <div className="h-4 w-4 rounded-full border-2 border-slate-200 mx-auto" />
                              }
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <datalist id={`codes-${catType}`}>
                    {remoteCodes.map(c => <option key={c.id} value={c.code}>{c.label}</option>)}
                  </datalist>
                </div>
                <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-400 font-medium">
                  {ms.m} de {ms.t} mapeados
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={save}
              disabled={saving || !localItems.length}
              className="bg-slate-800 hover:bg-slate-700 shadow-sm h-10 px-5 font-semibold"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              {saving ? "Guardando…" : "Guardar mapeos"}
            </Button>
            {saveMsg && (
              <span className={`text-sm flex items-center gap-1.5 font-medium ${saveMsg.ok ? "text-emerald-600" : "text-red-600"}`}>
                {saveMsg.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}{saveMsg.t}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}


/* ================================================================
   VALIDACIÓN
   ================================================================ */

function ValidationTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [eOpen, setEOpen] = useState(true);
  const [wOpen, setWOpen] = useState(true);

  const run = async () => {
    setLoading(true);
    try {
      const r = await Validation.integrity();
      setData(r);
      r.valid ? toast.success("Datos correctos") : toast.error("Problemas encontrados");
    } catch {
      setData(null);
      toast.error("Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-800">Validación de integridad</h3>
          <p className="text-xs text-slate-400 mt-0.5">Verifica datos antes de registrar en el SIA</p>
        </div>
        <Button
          onClick={run}
          disabled={loading}
          className="bg-slate-800 hover:bg-slate-700 shadow-sm h-10 font-semibold"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
          {loading ? "Validando…" : "Ejecutar validación"}
        </Button>
      </div>

      {!data && !loading && (
        <Empty icon={ShieldCheck} title="Sin resultados de validación" sub='Presiona "Ejecutar validación" para comenzar' />
      )}

      {data && (
        <div className="space-y-4">
          {/* Result banner */}
          <div className={`rounded-xl border p-6 flex items-center gap-5 ${data.valid ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
            <div className={`h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 ${data.valid ? "bg-emerald-100" : "bg-red-100"}`}>
              {data.valid ? <CheckCircle2 className="h-7 w-7 text-emerald-600" /> : <XCircle className="h-7 w-7 text-red-600" />}
            </div>
            <div>
              <p className={`text-base font-bold ${data.valid ? "text-emerald-800" : "text-red-800"}`}>
                {data.valid ? "Todos los datos correctos" : "Se encontraron problemas"}
              </p>
              <p className={`text-sm mt-0.5 ${data.valid ? "text-emerald-600" : "text-red-600"}`}>
                {data.valid ? "Listo para el SIA" : "Corregir antes de la carga"}
              </p>
            </div>
          </div>

          {/* Stats */}
          {data.stats && Object.keys(data.stats).length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">Estadísticas</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {Object.entries(data.stats).map(([k, v]) => (
                  <div key={k} className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{k.replace(/_/g, " ")}</p>
                    <p className="text-xl font-bold text-slate-800 mt-1">{v}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.errors?.length > 0 && (
            <Collapsible
              open={eOpen} toggle={() => setEOpen(!eOpen)}
              icon={XCircle} iconCls="text-red-500"
              title={`Errores (${data.errors.length})`} titleCls="text-red-800"
              borderCls="border-red-200 bg-white"
            >
              <ul className="space-y-2 mt-2">
                {data.errors.map((e, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-red-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                    <span>{e}</span>
                  </li>
                ))}
              </ul>
            </Collapsible>
          )}

          {data.warnings?.length > 0 && (
            <Collapsible
              open={wOpen} toggle={() => setWOpen(!wOpen)}
              icon={AlertTriangle} iconCls="text-amber-500"
              title={`Advertencias (${data.warnings.length})`} titleCls="text-amber-800"
              borderCls="border-amber-200 bg-white"
            >
              <ul className="space-y-2 mt-2">
                {data.warnings.map((w, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-amber-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </Collapsible>
          )}
        </div>
      )}
    </div>
  );
}


/* ================================================================
   JOBS
   ================================================================ */

function JobsTab() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exp, setExp] = useState(null);
  const [runs, setRuns] = useState([]);
  const [rl, setRl] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Jobs.list()
      .then(r => setJobs(r?.jobs || []))
      .catch(() => setJobs([]))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const loadRuns = async id => {
    if (exp === id) { setExp(null); return; }
    setExp(id); setRl(true);
    try { const r = await Jobs.runs(id); setRuns(r?.runs || []); }
    catch { setRuns([]); }
    finally { setRl(false); }
  };

  const runNow = async id => {
    try {
      await Jobs.runNow(id);
      toast.success("Iniciado");
      load();
      if (exp === id) loadRuns(id);
    } catch { toast.error("Error"); }
  };

  const toggle = async j => {
    try {
      j.enabled ? await Jobs.pause(j.id) : await Jobs.resume(j.id);
      toast.success(j.enabled ? "Pausado" : "Reanudado");
      load();
    } catch { toast.error("Error"); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-800">Jobs Programados</h3>
          <p className="text-xs text-slate-400 mt-0.5">Tareas automáticas de sincronización</p>
        </div>
        <Button size="sm" variant="outline" onClick={load} className="border-slate-200 hover:bg-slate-50">
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Actualizar
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-slate-100" />)}
        </div>
      ) : jobs.length === 0 ? (
        <Empty icon={Cog} title="Sin jobs configurados" sub="Se configuran desde el panel de administración" />
      ) : (
        <div className="space-y-3">
          {jobs.map(j => {
            const open = exp === j.id;
            return (
              <div
                key={j.id}
                className={`bg-white rounded-xl border overflow-hidden transition-all ${open ? "border-indigo-300 shadow-md" : "border-slate-200"}`}
              >
                <div className="px-6 py-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${j.enabled ? "bg-emerald-50" : "bg-slate-100"}`}>
                      <Cog className={`h-5 w-5 ${j.enabled ? "text-emerald-500" : "text-slate-400"}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{j.type}</p>
                      <div className="flex items-center gap-2.5 mt-0.5">
                        <code className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded font-semibold">{j.cron}</code>
                        <span className={`flex items-center gap-1.5 text-[11px] font-semibold ${j.enabled ? "text-emerald-600" : "text-slate-400"}`}>
                          <span className={`h-2 w-2 rounded-full ${j.enabled ? "bg-emerald-400 animate-pulse" : "bg-slate-300"}`} />
                          {j.enabled ? "Activo" : "Pausado"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" variant="outline" className="h-8 border-slate-200 text-xs font-semibold" onClick={() => toggle(j)}>
                      {j.enabled ? <><Pause className="h-3.5 w-3.5 mr-1" />Pausar</> : <><Play className="h-3.5 w-3.5 mr-1" />Reanudar</>}
                    </Button>
                    <Button size="sm" className="h-8 bg-slate-800 hover:bg-slate-700 text-xs font-semibold shadow-sm" onClick={() => runNow(j.id)}>
                      <Zap className="h-3.5 w-3.5 mr-1" />Ejecutar
                    </Button>
                    <Button size="sm" variant="ghost" className={`h-8 text-xs font-semibold ${open ? "text-indigo-600 bg-indigo-50" : ""}`} onClick={() => loadRuns(j.id)}>
                      <History className="h-3.5 w-3.5 mr-1" />{open ? "Ocultar" : "Historial"}
                    </Button>
                  </div>
                </div>

                {open && (
                  <div className="border-t border-slate-100 bg-slate-50 px-6 py-5">
                    {rl ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                      </div>
                    ) : runs.length === 0 ? (
                      <p className="text-center text-sm text-slate-400 py-6">Sin ejecuciones registradas</p>
                    ) : (
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">Últimas ejecuciones</p>
                        <div className="space-y-0">
                          {runs.slice(0, 5).map((r, i) => (
                            <div key={r.id} className="flex items-center gap-3.5 relative">
                              {i < Math.min(runs.length, 5) - 1 && (
                                <div className="absolute left-[13px] top-8 h-full w-px bg-slate-200" />
                              )}
                              <div className={`h-[26px] w-[26px] rounded-full border-2 flex items-center justify-center shrink-0 z-10 bg-white ${r.status === "COMPLETED" ? "border-emerald-400"
                                  : r.status === "FAILED" ? "border-red-400"
                                    : r.status === "PROCESSING" ? "border-blue-400"
                                      : "border-slate-300"
                                }`}>
                                <div className={`h-2.5 w-2.5 rounded-full ${STATUS_MAP[r.status]?.dot || "bg-slate-300"}`} />
                              </div>
                              <div className="flex-1 flex items-center justify-between py-3">
                                <div>
                                  <StatusBadge status={r.status} />
                                  <p className="text-[11px] text-slate-400 mt-1 font-medium">
                                    {new Date(r.started_at).toLocaleString("es-PE")}
                                  </p>
                                </div>
                                {r.finished_at && (
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    → {new Date(r.finished_at).toLocaleString("es-PE")}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}