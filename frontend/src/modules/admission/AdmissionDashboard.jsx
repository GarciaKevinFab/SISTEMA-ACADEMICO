// src/modules/admission/AdmissionDashboard.jsx — UI/UX mejorado
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import {
  Users, FileText, Award, CheckCircle, BarChart3,
  GraduationCap, TrendingUp, ArrowRight, Loader2,
} from "lucide-react";
import { getAdmissionDashboardStats } from "../../services/admission.service";

/* ─────────────────────────── ESTILOS ─────────────────────────── */
const admissionStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  .adm-module * { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }

  /* Header gradient border */
  .adm-header {
    background: linear-gradient(white, white) padding-box,
                linear-gradient(135deg, #3B82F6 0%, #6366F1 50%, #06B6D4 100%) border-box;
    border: 1.5px solid transparent;
    border-radius: 18px;
  }

  /* Stat card */
  .adm-stat { position: relative; overflow: hidden; transition: box-shadow 0.18s, transform 0.18s; }
  .adm-stat:hover { transform: translateY(-2px); box-shadow: 0 10px 30px -8px rgba(0,0,0,0.12); }
  .adm-stat::after {
    content: '';
    position: absolute;
    bottom: -30px; right: -30px;
    width: 100px; height: 100px;
    border-radius: 50%;
    opacity: 0.06;
  }
  .adm-stat-blue::after   { background: #2563EB; }
  .adm-stat-indigo::after { background: #4F46E5; }
  .adm-stat-violet::after { background: #7C3AED; }
  .adm-stat-green::after  { background: #059669; }

  /* Action button */
  .adm-action {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 12px; padding: 24px 16px;
    background: white;
    border: 1.5px solid #E2E8F0;
    border-radius: 16px;
    cursor: pointer;
    transition: all 0.18s cubic-bezier(.4,0,.2,1);
    text-align: center; width: 100%;
  }
  .adm-action:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 28px -6px rgba(0,0,0,0.10);
  }
  .adm-action .adm-action-icon {
    width: 48px; height: 48px; border-radius: 14px;
    display: flex; align-items: center; justify-content: center;
    transition: transform 0.2s;
  }
  .adm-action:hover .adm-action-icon { transform: scale(1.1) rotate(-3deg); }

  /* Progress bar (conversion rate) */
  @keyframes bar-in { from { width: 0 } }
  .adm-bar { animation: bar-in 0.7s ease both; }

  /* Fade in */
  @keyframes fade-in { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
  .fade-in { animation: fade-in 0.28s ease both; }

  /* Skeleton */
  @keyframes skel { 0%,100%{opacity:.35} 50%{opacity:.75} }
  .skel { animation: skel 1.4s ease-in-out infinite; background: #E2E8F0; border-radius: 8px; }
`;

function InjectAdmissionStyles() {
  useEffect(() => {
    const id = "admission-styles";
    if (document.getElementById(id)) return;
    const s = document.createElement("style");
    s.id = id; s.textContent = admissionStyles;
    document.head.appendChild(s);
    return () => document.getElementById(id)?.remove();
  }, []);
  return null;
}

/* ─────────────────────────── STAT CARD ─────────────────────────── */
function StatCard({ label, value, subtitle, Icon, accent, delay = 0, loading }) {
  const themes = {
    blue: { border: "border-t-blue-500", iconBg: "bg-blue-50", iconColor: "text-blue-600", valueBg: "text-blue-700", cls: "adm-stat-blue" },
    indigo: { border: "border-t-indigo-500", iconBg: "bg-indigo-50", iconColor: "text-indigo-600", valueBg: "text-indigo-700", cls: "adm-stat-indigo" },
    violet: { border: "border-t-violet-500", iconBg: "bg-violet-50", iconColor: "text-violet-600", valueBg: "text-violet-700", cls: "adm-stat-violet" },
    green: { border: "border-t-emerald-500", iconBg: "bg-emerald-50", iconColor: "text-emerald-600", valueBg: "text-emerald-700", cls: "adm-stat-green" },
  };
  const th = themes[accent] || themes.blue;

  return (
    <Card
      className={`adm-stat ${th.cls} border-t-4 ${th.border} border-slate-100 shadow-sm rounded-2xl bg-white fade-in`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-700 uppercase tracking-wider text-slate-500 truncate">{label}</p>
            <div className="mt-2">
              {loading ? (
                <div className="skel h-9 w-20 rounded-xl" />
              ) : (
                <p className="text-3xl font-800 text-slate-800 tabular-nums leading-none">
                  {value.toLocaleString()}
                </p>
              )}
            </div>
            <p className={`text-[11px] font-600 mt-1.5 flex items-center gap-1 ${th.valueBg}`}>
              <TrendingUp size={10} /> {subtitle}
            </p>
          </div>
          <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center ${th.iconBg}`}>
            <Icon size={18} className={th.iconColor} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────── ACTION BUTTON ─────────────────────────── */
function ActionCard({ label, sublabel, Icon, color, bg, onClick, delay = 0 }) {
  return (
    <button
      className="adm-action fade-in"
      style={{ animationDelay: `${delay}ms` }}
      onClick={onClick}
    >
      <div className="adm-action-icon" style={{ background: bg, color }}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-sm font-700 text-slate-700 leading-tight">{label}</p>
        <p className="text-[11px] text-slate-400 mt-0.5">{sublabel}</p>
      </div>
      <ArrowRight size={13} className="text-slate-300 mt-1" />
    </button>
  );
}

/* ─────────────────────────── CONVERSION RATE ─────────────────────────── */
function ConversionBar({ label, value, max, color, bg }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-600 text-slate-600">{label}</p>
        <div className="flex items-baseline gap-1">
          <span className="text-sm font-800 text-slate-800">{value}</span>
          <span className="text-[10px] text-slate-400">/ {max}</span>
          <span className="text-[10px] font-700 ml-1" style={{ color }}>{pct}%</span>
        </div>
      </div>
      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
        <div
          className="adm-bar h-full rounded-full"
          style={{ width: `${pct}%`, background: color, animationDelay: "200ms" }}
        />
      </div>
    </div>
  );
}

/* ─────────────────────────── DASHBOARD PRINCIPAL ─────────────────────────── */
export default function AdmissionDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setStats((await getAdmissionDashboardStats()) || {});
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalApplicants = stats.total_applicants || 0;
  const totalApplications = stats.total_applications || 0;
  const totalEvaluated = stats.total_evaluated || 0;
  const totalAdmitted = stats.total_admitted || 0;

  return (
    <>
      <InjectAdmissionStyles />
      <div className="adm-module w-full min-w-0 overflow-x-hidden p-4 sm:p-6 pb-16 space-y-5 max-w-6xl mx-auto">

        {/* ── HEADER ── */}
        <div className="adm-header bg-white shadow-sm px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm shadow-blue-200">
              <GraduationCap size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-800 text-slate-800 leading-tight">Módulo de Admisión</h1>
              <p className="text-xs text-slate-400 mt-0.5">Resumen general del proceso de admisión</p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {loading ? (
              <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg">
                <Loader2 size={11} className="animate-spin" /> Cargando...
              </div>
            ) : (
              <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-700 px-3 py-1.5 rounded-lg">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 inline-block" />
                Proceso activo
              </Badge>
            )}
          </div>
        </div>

        {/* ── MÉTRICAS ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            label="Postulantes" value={totalApplicants}
            subtitle="Registrados" Icon={Users}
            accent="blue" delay={0} loading={loading}
          />
          <StatCard
            label="Postulaciones" value={totalApplications}
            subtitle="Expedientes enviados" Icon={FileText}
            accent="indigo" delay={60} loading={loading}
          />
          <StatCard
            label="Evaluados" value={totalEvaluated}
            subtitle="Con puntaje" Icon={Award}
            accent="violet" delay={120} loading={loading}
          />
          <StatCard
            label="Admitidos" value={totalAdmitted}
            subtitle="Ingresantes oficiales" Icon={CheckCircle}
            accent="green" delay={180} loading={loading}
          />
        </div>

        {/* ── TASA DE CONVERSIÓN ── */}
        {!loading && totalApplicants > 0 && (
          <Card className="border border-slate-100 shadow-sm rounded-2xl bg-white fade-in" style={{ animationDelay: "240ms" }}>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center">
                  <BarChart3 size={14} className="text-slate-500" />
                </div>
                <div>
                  <p className="text-xs font-700 text-slate-700">Embudo de conversión</p>
                  <p className="text-[10px] text-slate-400">De postulante a admitido</p>
                </div>
              </div>
              <div className="space-y-3">
                <ConversionBar
                  label="Postulaciones / Postulantes"
                  value={totalApplications} max={totalApplicants}
                  color="#4F46E5" bg="#EEF2FF"
                />
                <ConversionBar
                  label="Evaluados / Postulaciones"
                  value={totalEvaluated} max={totalApplications}
                  color="#7C3AED" bg="#F5F3FF"
                />
                <ConversionBar
                  label="Admitidos / Evaluados"
                  value={totalAdmitted} max={totalEvaluated}
                  color="#059669" bg="#ECFDF5"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── ACCESOS DIRECTOS ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <p className="text-[10px] font-700 uppercase tracking-wider text-slate-400">Accesos directos</p>
            <div className="flex-1 h-px bg-slate-100" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <ActionCard
              label="Postulantes" sublabel="Base de datos"
              Icon={Users} color="#2563EB" bg="#DBEAFE"
              onClick={() => navigate("/dashboard/admission/applicants")}
              delay={0}
            />
            <ActionCard
              label="Convocatorias" sublabel="Apertura y cierre"
              Icon={FileText} color="#4F46E5" bg="#E0E7FF"
              onClick={() => navigate("/dashboard/admission/calls")}
              delay={60}
            />
            <ActionCard
              label="Evaluaciones" sublabel="Calificar postulantes"
              Icon={Award} color="#7C3AED" bg="#EDE9FE"
              onClick={() => navigate("/dashboard/admission/eval")}
              delay={120}
            />
            <ActionCard
              label="Reportes" sublabel="Estadísticas"
              Icon={BarChart3} color="#059669" bg="#D1FAE5"
              onClick={() => navigate("/dashboard/admission/reports")}
              delay={180}
            />
          </div>
        </div>
      </div>
    </>
  );
}