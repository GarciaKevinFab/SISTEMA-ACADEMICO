// src/components/StudentKardexCard.jsx — UI/UX mejorado
// ✅ Fix: GPA y créditos solo del stint activo (detecta reingreso tras gap de períodos)
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FileText, RefreshCw, Layers, Download, Loader2, BookOpen, Award, TrendingUp, AlertTriangle } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Kardex } from "@/services/academic.service";
import { ensureFreshToken } from "@/lib/api";

/* ─── inject font ─── */
function InjectKardexStyles() {
    useEffect(() => {
        const id = "kardex-styles";
        if (document.getElementById(id)) return;
        const l = document.createElement("link");
        l.id = id + "-font"; l.rel = "stylesheet";
        l.href = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap";
        document.head.appendChild(l);
        const s = document.createElement("style");
        s.id = id;
        s.textContent = `
          .kd-root { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
          .kd-root * { font-family: inherit; }

          /* header accent */
          .kd-header {
            border-top: 3px solid transparent;
            border-image: linear-gradient(90deg,#3B82F6,#6366F1,#8B5CF6) 1;
            border-radius: 1rem 1rem 0 0;
          }

          /* stat cards */
          .kd-stat {
            border-top: 3px solid #3B82F6;
            border-radius: 12px;
            background: #fff;
            border-left: 1px solid #E2E8F0;
            border-right: 1px solid #E2E8F0;
            border-bottom: 1px solid #E2E8F0;
            padding: 14px 16px;
            position: relative;
            overflow: hidden;
            transition: transform .18s cubic-bezier(.4,0,.2,1), box-shadow .18s;
          }
          .kd-stat::after {
            content: '';
            position: absolute; right: -12px; top: -12px;
            width: 56px; height: 56px; border-radius: 50%;
            background: rgba(99,102,241,.06);
          }
          .kd-stat:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(59,130,246,.12); }
          .kd-stat-blue   { border-top-color: #3B82F6; }
          .kd-stat-indigo { border-top-color: #6366F1; }
          .kd-stat-emerald{ border-top-color: #10B981; }
          .kd-stat-amber  { border-top-color: #F59E0B; }

          /* cycle pill */
          .kd-cycle {
            display: inline-flex; align-items: center; gap: 6px;
            padding: 5px 14px; border-radius: 999px;
            font-size: 12.5px; font-weight: 700;
            border: 1px solid #E2E8F0; background: #F8FAFC;
            color: #475569; cursor: pointer;
            transition: all .15s cubic-bezier(.4,0,.2,1);
          }
          .kd-cycle:hover { background: #EFF6FF; border-color: #BFDBFE; color: #1D4ED8; }
          .kd-cycle.active { background: #1E293B; border-color: #1E293B; color: #fff; }
          .kd-cycle.prior  { background: #FFF7ED; border-color: #FED7AA; color: #92400E; }
          .kd-cycle.prior:hover { background: #FFEDD5; border-color: #FB923C; }

          /* re-enrollment notice */
          .kd-reingreso {
            display: flex; align-items: flex-start; gap: 10px;
            background: #FFFBEB; border: 1px solid #FDE68A;
            border-left: 3px solid #F59E0B;
            border-radius: 10px; padding: 10px 14px;
            font-size: 12px; color: #78350F;
          }

          /* table */
          .kd-th {
            padding: 10px 14px; font-size: 10px; font-weight: 800;
            color: #64748B; text-transform: uppercase; letter-spacing: .1em;
            background: #F8FAFC; border-bottom: 1px solid #E2E8F0;
            position: sticky; top: 0; z-index: 5;
          }
          .kd-td { padding: 10px 14px; font-size: 13px; color: #334155; }
          .kd-tr { border-bottom: 1px solid #F1F5F9; transition: background .1s; }
          .kd-tr:hover { background: #F0F7FF; }
          .kd-tr.prior-row { opacity: 0.65; }
          .kd-tr.prior-row:hover { background: #FFFBEB; opacity: 1; }

          /* status badges */
          .kd-aprob { background:#DBEAFE; color:#1E40AF; }
          .kd-desap { background:#FEE2E2; color:#991B1B; }
          .kd-sin   { background:#F1F5F9; color:#64748B; }

          /* grade color */
          .kd-grade-ok   { color: #166534; font-weight: 800; }
          .kd-grade-fail { color: #991B1B; font-weight: 800; }
          .kd-grade-na   { color: #94A3B8; }

          /* empty */
          .kd-empty { border: 1.5px dashed #CBD5E1; border-radius: 14px; padding: 40px 24px; text-align: center; }

          @keyframes kd-fade { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:none} }
          .kd-fade { animation: kd-fade .25s ease both; }
          @keyframes kd-pulse { 0%,100%{opacity:1} 50%{opacity:.45} }
          .kd-skel { border-radius:6px; background:#E2E8F0; animation: kd-pulse 1.4s ease-in-out infinite; }
        `;
        document.head.appendChild(s);
        return () => {
            document.getElementById(id)?.remove();
            document.getElementById(id + "-font")?.remove();
        };
    }, []);
    return null;
}

/* ─── preserved business logic ─── */
const pickArray = (data, keys) => {
    for (const k of keys) if (Array.isArray(data?.[k])) return data[k];
    return [];
};

const parsePeriod = (p) => {
    const s = String(p || "").trim();
    const m = s.match(/^(\d{4})\s*[-/]\s*([IVX]+|[12])$/i);
    if (!m) return { y: 0, t: 0, raw: s };
    const y = parseInt(m[1], 10);
    const term = String(m[2] || "").toUpperCase();
    const t = term === "I" || term === "1" ? 1 : term === "II" || term === "2" ? 2 : term === "III" ? 3 : term === "IV" ? 4 : 0;
    return { y, t, raw: s };
};

const toApiPeriod = (raw) => {
    const s = String(raw || "").trim().toUpperCase().replace(/\s+/g, "").replace("/", "-");
    let m = s.match(/^(\d{4})-(I|II|1|2)$/);
    if (m) return `${m[1]}-${m[2] === "1" ? "I" : m[2] === "2" ? "II" : m[2]}`;
    m = s.match(/^(\d{4})(I{1,2}|[12])$/);
    if (m) return `${m[1]}-${m[2] === "1" ? "I" : m[2] === "2" ? "II" : m[2]}`;
    m = s.match(/^(\d{4})-(0?1|0?2)$/);
    if (m) return `${m[1]}-${m[2].endsWith("1") ? "I" : "II"}`;
    return s;
};

const normStr = (v) => (v == null ? "" : String(v).trim());
const getCycleKey = (it) => normStr(it?.period ?? it?.cycle ?? it?.ciclo ?? it?.term ?? "Sin ciclo");
const getCourseName = (r) => r?.course_name ?? r?.courseName ?? r?.curso ?? r?.subject ?? r?.asignatura ?? "—";
const getCourseCode = (r) => r?.course_code ?? r?.courseCode ?? r?.codigo ?? r?.code ?? "—";
const getCredits = (r) => r?.credits ?? r?.creditos ?? "—";
const getGrade = (r) => { const v = r?.grade ?? r?.nota ?? r?.final ?? r?.promedio; return v == null || String(v).trim() === "" ? null : v; };
const getStatus = (r) => r?.status ?? r?.estado ?? "—";

const downloadBlob = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
    window.URL.revokeObjectURL(url);
};

/* ─── sub-components ─── */
const StatCard = ({ label, value, icon: Icon, colorCls = "kd-stat-blue", delay = 0, subtitle = null }) => (
    <div className={`kd-stat ${colorCls} kd-fade`} style={{ animationDelay: `${delay}ms` }}>
        <p className="text-[10px] font-800 text-slate-400 uppercase tracking-wider mb-1.5">{label}</p>
        <p className="text-2xl font-900 text-slate-800 leading-none">{value ?? "—"}</p>
        {subtitle && (
            <p className="mt-1.5 text-[10px] text-amber-600 font-600 flex items-center gap-1">
                <AlertTriangle size={9} /> {subtitle}
            </p>
        )}
        {Icon && <Icon className="absolute right-3 bottom-3 w-5 h-5 text-slate-200" />}
    </div>
);

const SkeletonRow = () => (
    <tr className="kd-tr">
        {["60%", "25%", "15%", "12%", "20%"].map((w, i) => (
            <td key={i} className="kd-td"><div className="kd-skel h-3.5" style={{ width: w }} /></td>
        ))}
    </tr>
);

/* ─── main component ─── */
export default function StudentKardexCard({ mode, studentKey, titlePrefix = "Kárdex / Notas" }) {
    const [loading, setLoading] = useState(false);
    const [exportingCycle, setExportingCycle] = useState(false);
    const [exportingAll, setExportingAll] = useState(false);
    const [exportingRecord, setExportingRecord] = useState(false);
    const [kardex, setKardex] = useState(null);
    const [activeCycle, setActiveCycle] = useState("");

    // ── campos del backend sobre stint activo ──
    const activePeriods = useMemo(() => new Set(kardex?.active_periods || []), [kardex]);
    const hasReenrollment = !!(kardex?.has_prior_enrollment);
    const activeSince = kardex?.active_since || null;

    const load = useCallback(async () => {
        try {
            if (!studentKey) { setKardex(null); setActiveCycle(""); return; }
            setLoading(true);
            const data = await Kardex.ofStudent(studentKey);
            setKardex(data);
            const list = pickArray(data, ["items", "records", "courses", "grades", "details"]) || [];
            const byCycle = new Map();
            for (const it of list) { const cycle = getCycleKey(it) || "Sin ciclo"; if (!byCycle.has(cycle)) byCycle.set(cycle, []); byCycle.get(cycle).push(it); }
            const cycles = Array.from(byCycle.keys()).sort((a, b) => { const A = parsePeriod(a); const B = parsePeriod(b); if (A.y !== B.y) return A.y - B.y; if (A.t !== B.t) return A.t - B.t; return a.localeCompare(b, "es", { numeric: true }); });
            setActiveCycle((prev) => (prev && cycles.includes(prev) ? prev : cycles[cycles.length - 1] || ""));
        } catch (e) { toast.error(e?.message || "Error al consultar kárdex"); setKardex(null); setActiveCycle(""); }
        finally { setLoading(false); }
    }, [studentKey]);

    useEffect(() => { load(); }, [load]);

    const items = useMemo(() => {
        if (!kardex) return [];
        const list = pickArray(kardex, ["items", "records", "courses", "grades", "details"]) || [];
        return [...list].sort((a, b) => {
            const pa = parsePeriod(getCycleKey(a)); const pb = parsePeriod(getCycleKey(b));
            if (pa.y !== pb.y) return pa.y - pb.y; if (pa.t !== pb.t) return pa.t - pb.t;
            return normStr(getCourseCode(a)).localeCompare(normStr(getCourseCode(b)), "es", { numeric: true });
        });
    }, [kardex]);

    const cycles = useMemo(() => {
        const s = new Set(items.map((it) => getCycleKey(it) || "Sin ciclo"));
        return Array.from(s).sort((a, b) => { const A = parsePeriod(a); const B = parsePeriod(b); if (A.y !== B.y) return A.y - B.y; if (A.t !== B.t) return A.t - B.t; return a.localeCompare(b, "es", { numeric: true }); });
    }, [items]);

    const filtered = useMemo(() => (!activeCycle ? [] : items.filter((it) => getCycleKey(it) === String(activeCycle))), [items, activeCycle]);

    const stats = useMemo(() => {
        const nums = filtered.map((r) => Number(r?.grade ?? r?.nota ?? r?.final ?? r?.promedio)).filter((n) => Number.isFinite(n));
        const avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
        const approved = filtered.filter((r) => { const st = String(getStatus(r)).toUpperCase(); const g = Number(r?.grade ?? r?.nota ?? r?.final ?? r?.promedio); return st.includes("APROB") || (Number.isFinite(g) && g >= 11); }).length;
        return { total: filtered.length, approved, avg };
    }, [filtered]);

    const exportPdfCycle = async () => {
        if (!studentKey || !activeCycle || exportingCycle || exportingAll) return;
        const period = toApiPeriod(activeCycle);
        try {
            setExportingCycle(true); await ensureFreshToken();
            const res = await Kardex.exportBoletaPeriodoPdf(studentKey, period);
            downloadBlob(new Blob([res.data], { type: "application/pdf" }), `boleta-${studentKey}-${period.replace(/[-/]/g, "")}.pdf`);
            toast.success("PDF del ciclo generado");
        } catch (e) { toast.error(e?.message || "No se pudo exportar el PDF del ciclo"); } finally { setExportingCycle(false); }
    };

    const exportPdfAll = async () => {
        if (!studentKey || !activeCycle || exportingCycle || exportingAll) return;
        const period = toApiPeriod(activeCycle);
        try {
            setExportingAll(true); await ensureFreshToken();
            const res = await Kardex.exportBoletaAnioPdf(studentKey, period);
            const year = parsePeriod(period).y || "anio";
            downloadBlob(new Blob([res.data], { type: "application/pdf" }), `boleta-${studentKey}-${year}-completo.pdf`);
            toast.success("PDF completo generado");
        } catch (e) { toast.error(e?.message || "No se pudo exportar el PDF completo"); } finally { setExportingAll(false); }
    };

    const exportPdfRecord = async () => {
        if (!studentKey || exportingRecord || exportingAll || exportingCycle) return;
        try {
            setExportingRecord(true); await ensureFreshToken();
            const res = await Kardex.exportRecordNotasPdf(studentKey);
            downloadBlob(new Blob([res.data], { type: "application/pdf" }), `record_notas-${studentKey}.pdf`);
            toast.success("Record de notas generado");
        } catch (e) { toast.error(e?.message || "No se pudo exportar el record de notas"); } finally { setExportingRecord(false); }
    };

    const anyExporting = exportingCycle || exportingAll || exportingRecord;

    /* grade display helpers */
    const gradeDisplay = (r) => {
        const g = getGrade(r);
        if (g === null) return <span className="kd-grade-na text-xs">—</span>;
        const n = Number(g);
        const cls = Number.isFinite(n) ? (n >= 11 ? "kd-grade-ok" : "kd-grade-fail") : "";
        return <span className={cls}>{g}</span>;
    };

    const statusChip = (r) => {
        const s = String(getStatus(r) || "").toUpperCase();
        const cls = s.includes("DESAP") ? "kd-desap" : s.includes("APROB") ? "kd-aprob" : "kd-sin";
        return <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-800 ${cls}`}>{getStatus(r)}</span>;
    };

    /* ¿El ciclo seleccionado es del stint anterior? */
    const isActiveCycleFromPrior = hasReenrollment && activeCycle && !activePeriods.has(activeCycle);

    return (
        <>
            <InjectKardexStyles />
            <div className="kd-root">
                <div className="kd-header rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">

                    {/* ── card header ── */}
                    <div className="px-6 py-5 border-b border-slate-100">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25 shrink-0">
                                    <FileText className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-900 text-slate-800 tracking-tight">{titlePrefix}</h2>
                                    <p className="text-xs text-slate-400 mt-0.5 font-500">
                                        {mode === "admin" ? "Notas del estudiante seleccionado + exportación PDF" : "Tus notas por ciclo + exportación PDF"}
                                    </p>
                                </div>
                            </div>

                            {/* action buttons */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <Button variant="outline" className="h-9 px-4 rounded-xl border-slate-200 text-sm gap-1.5 hover:bg-slate-50"
                                    onClick={load} disabled={loading || !studentKey}>
                                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                                    Recargar
                                </Button>
                                <Button variant="outline" className="h-9 px-4 rounded-xl border-slate-200 text-sm gap-1.5 hover:bg-slate-50"
                                    onClick={exportPdfCycle} disabled={anyExporting || !studentKey || !activeCycle}>
                                    {exportingCycle ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                                    PDF Semestre
                                </Button>
                                <Button className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-700 gap-1.5 shadow-sm"
                                    onClick={exportPdfAll} disabled={anyExporting || !studentKey || !activeCycle}>
                                    {exportingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                                    PDF Año
                                </Button>
                                <Button variant="outline" className="h-9 px-4 rounded-xl border-slate-200 text-sm gap-1.5 hover:bg-slate-50"
                                    onClick={exportPdfRecord} disabled={anyExporting || !studentKey}>
                                    {exportingRecord ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                                    Record de Notas
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* ── body ── */}
                    <div className="p-6 space-y-5">

                        {/* no student key */}
                        {!studentKey && (
                            <div className="kd-empty">
                                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                                    <FileText className="w-6 h-6 text-slate-300" />
                                </div>
                                <p className="text-sm font-700 text-slate-500">
                                    {mode === "admin" ? "Selecciona un estudiante para ver su kárdex." : "No se encontró tu identificador de estudiante."}
                                </p>
                            </div>
                        )}

                        {/* loading skeleton for initial load */}
                        {studentKey && !kardex && loading && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {[0, 1, 2, 3].map((i) => (
                                    <div key={i} className="rounded-xl border border-slate-200 p-4">
                                        <div className="kd-skel h-2.5 w-16 mb-3" />
                                        <div className="kd-skel h-7 w-20" />
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* no data */}
                        {studentKey && !kardex && !loading && (
                            <div className="kd-empty">
                                <p className="text-sm font-700 text-slate-500">Sin datos de kárdex para mostrar.</p>
                            </div>
                        )}

                        {/* kardex data */}
                        {studentKey && kardex && (
                            <>
                                {/* ── Aviso de reingreso ── */}
                                {hasReenrollment && (
                                    <div className="kd-reingreso kd-fade">
                                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="font-700 text-amber-800 text-[12px]">Alumno con reingreso detectado</p>
                                            <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                                                El estudiante tiene matrícula previa con un período de retiro prolongado.
                                                El <strong>PPA y los créditos aprobados</strong> reflejan únicamente la
                                                matrícula activa <strong>desde {activeSince}</strong>. Los períodos anteriores
                                                se muestran en el historial (color naranja) solo para referencia.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* top stats */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <StatCard
                                        label="Estudiante"
                                        value={<span className="text-base truncate block">{kardex.student_name ?? "—"}</span>}
                                        icon={BookOpen}
                                        colorCls="kd-stat-blue"
                                        delay={0}
                                    />
                                    <StatCard
                                        label="Carrera"
                                        value={<span className="text-base truncate block">{kardex.career_name ?? "—"}</span>}
                                        icon={Award}
                                        colorCls="kd-stat-indigo"
                                        delay={60}
                                    />
                                    <StatCard
                                        label="Créditos aprobados"
                                        value={kardex.credits_earned ?? "—"}
                                        icon={TrendingUp}
                                        colorCls="kd-stat-emerald"
                                        delay={120}
                                        subtitle={hasReenrollment ? `Desde ${activeSince}` : null}
                                    />
                                    <StatCard
                                        label="PPA"
                                        value={kardex.gpa ?? "—"}
                                        icon={Award}
                                        colorCls="kd-stat-amber"
                                        delay={180}
                                        subtitle={hasReenrollment ? `Desde ${activeSince}` : null}
                                    />
                                </div>

                                {cycles.length === 0 ? (
                                    <div className="kd-empty">
                                        <p className="text-sm font-700 text-slate-500">No se encontraron ciclos.</p>
                                        <p className="text-xs text-slate-400 mt-1">Verifica que el backend envíe <code className="text-indigo-600">items</code> con <code className="text-indigo-600">period</code>.</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* cycle selector */}
                                        <div className="flex flex-wrap gap-2 items-center">
                                            {cycles.map((c) => {
                                                const isPrior = hasReenrollment && !activePeriods.has(c);
                                                return (
                                                    <button key={c} type="button" onClick={() => setActiveCycle(c)}
                                                        className={`kd-cycle ${activeCycle === c ? "active" : ""} ${isPrior ? "prior" : ""}`}
                                                        title={isPrior ? "Período anterior al reingreso (historial previo)" : ""}>
                                                        <Layers className="w-3.5 h-3.5" /> {c}
                                                        {isPrior && <span className="text-[9px] font-800 opacity-70 ml-0.5">(prev.)</span>}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {/* aviso si el ciclo seleccionado es del stint anterior */}
                                        {isActiveCycleFromPrior && (
                                            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-[11px] text-amber-700 font-600 kd-fade">
                                                <AlertTriangle size={12} />
                                                Período anterior al reingreso — no se incluye en el PPA ni créditos actuales
                                            </div>
                                        )}

                                        {/* cycle stats */}
                                        <div className="grid grid-cols-3 gap-3">
                                            {[
                                                { label: "Cursos en el ciclo", value: stats.total, colorCls: "kd-stat-blue", icon: BookOpen, delay: 0 },
                                                { label: "Aprobados", value: stats.approved, colorCls: "kd-stat-emerald", icon: Award, delay: 60 },
                                                { label: "Promedio referencial", value: stats.avg == null ? "—" : stats.avg.toFixed(2), colorCls: "kd-stat-indigo", icon: TrendingUp, delay: 120 },
                                            ].map((s) => <StatCard key={s.label} {...s} />)}
                                        </div>

                                        {/* grades table */}
                                        <div className="rounded-xl border border-slate-200 overflow-hidden" style={{ maxHeight: 520, overflowY: "auto" }}>
                                            <table className="w-full border-collapse">
                                                <thead>
                                                    <tr>
                                                        {["Curso", "Código", "Créditos", "Nota", "Estado"].map((h, i) => (
                                                            <th key={i} className="kd-th text-left">{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {loading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}

                                                    {!loading && filtered.map((r, idx) => {
                                                        const isPriorRow = hasReenrollment && !activePeriods.has(getCycleKey(r));
                                                        return (
                                                            <tr key={r.id || r._id || `${getCycleKey(r)}-${getCourseCode(r)}-${idx}`}
                                                                className={`kd-tr kd-fade ${isPriorRow ? "prior-row" : ""}`}
                                                                style={{ animationDelay: `${idx * 20}ms` }}
                                                                title={isPriorRow ? "Período previo al reingreso" : ""}>
                                                                <td className="kd-td font-600 text-slate-700">{getCourseName(r)}</td>
                                                                <td className="kd-td font-mono text-xs text-slate-500">{getCourseCode(r)}</td>
                                                                <td className="kd-td text-center">
                                                                    <span className="text-xs font-700 text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">{getCredits(r)}</span>
                                                                </td>
                                                                <td className="kd-td text-center">{gradeDisplay(r)}</td>
                                                                <td className="kd-td">{statusChip(r)}</td>
                                                            </tr>
                                                        );
                                                    })}

                                                    {!loading && filtered.length === 0 && (
                                                        <tr><td colSpan={5} className="py-10 text-center">
                                                            <p className="text-sm font-700 text-slate-400">No hay cursos para este ciclo.</p>
                                                        </td></tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}