// src/pages/dashboards/ResearchDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { Microscope, BookOpen, Calendar, Users, DollarSign, Award, ChevronRight, Clock, FileText } from "lucide-react";
import { Reports as ResearchReports } from "../../services/research.service";
import { ResearchDashboardSvc } from "../../services/dashboard.service";
import { DashboardShell, KpiGrid, StatCard, ChartCard, EmptyBox, ProgressBar, toNumber, pickArray, CHART_TOOLTIP_STYLE, CHART_GRID_PROPS, CHART_AXIS_TICK, PIE_COLORS } from "./DashboardWidgets";

const ResExtra = { projects: () => ResearchDashboardSvc.recentProjects() };

export default function ResearchDashboard({ roles }) {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const [data, setData] = useState({ stats: null, projects: null });

    const load = async () => {
        setLoading(true); setErr("");
        try {
            const results = await Promise.allSettled([ResearchReports.summary({}), ResExtra.projects()]);
            setData({ stats: results[0].status === "fulfilled" ? results[0].value : null, projects: results[1].status === "fulfilled" ? results[1].value : null });
            if (results.every(r => r.status === "rejected")) setErr("Error cargando datos.");
        } catch (e) { setErr(e?.message || "Error"); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const kpis = useMemo(() => {
        const d = data.stats || {};
        return {
            total: toNumber(d.projects ?? d.total_projects ?? d.total ?? 0), active: toNumber(d.active ?? d.in_progress ?? 0),
            completed: toNumber(d.completed ?? d.finished ?? 0), openCalls: toNumber(d.calls_open ?? d.open_calls ?? 0),
            researchers: toNumber(d.researchers ?? d.total_researchers ?? 0), budget: toNumber(d.budget ?? d.total_budget ?? 0),
            budgetExec: toNumber(d.budget_executed ?? d.executed ?? 0), publications: toNumber(d.publications ?? 0),
        };
    }, [data.stats]);

    const byArea = useMemo(() => pickArray(data.stats || {}, ["by_area", "areas", "research_lines"]).map(x => ({ name: x.name ?? x.area ?? "", value: toNumber(x.value ?? x.count ?? 0) })).filter(x => x.name && x.value > 0).slice(0, 8), [data.stats]);
    const byStatus = useMemo(() => pickArray(data.stats || {}, ["by_status", "project_status"]).map(x => ({ name: x.name ?? x.status ?? "", value: toNumber(x.value ?? x.count ?? 0) })).filter(x => x.value > 0), [data.stats]);
    const projectsList = useMemo(() => { const p = data.projects || {}; return (pickArray(p, ["results", "items", "projects"]).length > 0 ? pickArray(p, ["results", "items", "projects"]) : (Array.isArray(p) ? p : [])).slice(0, 6); }, [data.projects]);

    const L = loading;
    const budgetPct = kpis.budget > 0 ? (kpis.budgetExec / kpis.budget) * 100 : 0;

    return (
        <DashboardShell title="Investigación" subtitle="Proyectos, convocatorias y producción científica" loading={loading} error={err} onRefresh={load}>

            <KpiGrid cols={4}>
                <StatCard icon={Microscope} title="Proyectos" value={L ? "…" : kpis.total} hint={`Activos: ${kpis.active}`} tone="violet" />
                <StatCard icon={Calendar} title="Convocatorias" value={L ? "…" : kpis.openCalls} hint="Abiertas" tone="indigo" />
                <StatCard icon={Users} title="Investigadores" value={L ? "…" : kpis.researchers} tone="emerald" />
                <StatCard icon={BookOpen} title="Publicaciones" value={L ? "…" : kpis.publications} tone="cyan" />
            </KpiGrid>

            {/* Presupuesto */}
            <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)]">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-base"><DollarSign size={20} className="text-amber-500" /> Presupuesto de Investigación</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-center">
                    <div><p className="text-sm text-slate-500 font-semibold">Asignado</p><p className="text-2xl font-black text-slate-900">{L ? "…" : `S/ ${kpis.budget.toLocaleString("es-PE")}`}</p></div>
                    <div><p className="text-sm text-slate-500 font-semibold">Ejecutado</p><p className="text-2xl font-black text-violet-700">{L ? "…" : `S/ ${kpis.budgetExec.toLocaleString("es-PE")}`}</p></div>
                    <div><ProgressBar label="Ejecución presupuestal" value={kpis.budgetExec} max={kpis.budget || 1} color="bg-violet-500" /></div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                <ChartCard title="Por Línea de Investigación" accentColor="bg-violet-500" span={2}>
                    {byArea.length >= 1 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={byArea} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                                <CartesianGrid {...CHART_GRID_PROPS} /><XAxis dataKey="name" tick={{ ...CHART_AXIS_TICK, fontSize: 10 }} interval={0} height={70} angle={-25} textAnchor="end" axisLine={false} tickLine={false} />
                                <YAxis tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} /><Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={{ fill: "#f8fafc" }} />
                                <Bar dataKey="value" name="Proyectos" fill="#7c3aed" radius={[6, 6, 0, 0]} barSize={32} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <EmptyBox title="Sin datos" subtitle="" />}
                </ChartCard>

                <ChartCard title="Estado de Proyectos" accentColor="bg-cyan-500">
                    {byStatus.length >= 1 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart><Tooltip contentStyle={CHART_TOOLTIP_STYLE} /><Legend verticalAlign="bottom" height={36} iconType="circle" />
                                <Pie data={byStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} cornerRadius={6}>
                                    {byStatus.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="none" />)}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                    ) : <EmptyBox title="Sin datos" subtitle="" />}
                </ChartCard>

                {/* Proyectos recientes */}
                <div className="xl:col-span-3 rounded-3xl border border-slate-200/60 bg-white p-6 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)]">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-base"><Microscope size={20} className="text-violet-500" /> Proyectos Recientes</h3>
                    {projectsList.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {projectsList.map((proj, i) => {
                                const st = (proj.status ?? proj.estado ?? "").toLowerCase();
                                const badge = st.includes("activ") || st.includes("progress") ? "bg-emerald-100 text-emerald-700" : st.includes("complet") || st.includes("final") ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700";
                                return (
                                    <div key={i} className="group rounded-2xl border border-slate-100 p-5 bg-slate-50/30 hover:bg-white hover:border-violet-200 hover:shadow-md transition-all cursor-pointer">
                                        <p className="text-sm font-bold text-slate-800 line-clamp-2 mb-2">{proj.title ?? proj.name ?? "Proyecto"}</p>
                                        <p className="text-xs text-slate-400 mb-3">{proj.researcher ?? proj.lead ?? proj.author ?? ""} {proj.area ? `• ${proj.area}` : ""}</p>
                                        <div className="flex items-center justify-between">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge}`}>{proj.status ?? proj.estado ?? "—"}</span>
                                            <span className="text-[10px] text-slate-400">{proj.year ?? proj.period ?? ""}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : <EmptyBox title="Sin proyectos" subtitle="" />}
                </div>
            </div>
        </DashboardShell>
    );
}