// Jefes de Línea — cargos del Reglamento de la Ley N° 30512 (p. 31).
//
// La tabla es la que pidió el MINEDU: CARGO | RESPONSABLE | PLAN DE TRABAJO.
// El responsable NO se escribe a mano: se jala del directorio de docentes
// del módulo Académico. Al designarlo, a ese docente le aparece en su propio
// panel el botón para subir su plan de trabajo, y el plan sale aquí y en el
// portal público.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
    Search, UserRound, UserPlus, X, Loader2, FileText, UploadCloud,
    Trash2, CheckCircle2, AlertCircle, ShieldCheck, RefreshCw, ScrollText,
} from "lucide-react";
import { api } from "../../lib/api";
import { SCOPE } from "./personalStyles";

const NAVY = "#1F4E79";

function Pill({ ok, children }) {
    return (
        <span className={"inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold border "
            + (ok
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-amber-50 text-amber-700 border-amber-200")}>
            {ok ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
            {children}
        </span>
    );
}

/* ── Modal: elegir responsable del cargo ───────────────────────────── */
function PickerDocente({ fila, onClose, onHecho }) {
    const [q, setQ] = useState("");
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [sel, setSel] = useState(fila?.responsable?.teacher_id || null);
    const [resolucion, setResolucion] = useState(fila?.resolucion || "");
    const [desde, setDesde] = useState(fila?.designado_desde || "");
    // Programas a cargo: define el alcance de los reportes del coordinador.
    // Es lista porque el de Educación Física lleva EF y Comunicación.
    const [carreras, setCarreras] = useState([]);
    const [selCarreras, setSelCarreras] = useState(
        () => new Set((fila?.careers || []).map((c) => c.id)));
    const timer = useRef(null);

    useEffect(() => {
        api.get("/academic/careers")
            .then(({ data }) => setCarreras(data?.items || data?.rows || data || []))
            .catch(() => setCarreras([]));
    }, []);

    const buscar = useCallback(async (texto) => {
        setLoading(true);
        try {
            const { data } = await api.get("/personal/jefes-linea/candidatos",
                { params: texto ? { q: texto } : {} });
            setRows(data?.rows || []);
        } catch {
            setRows([]);
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { buscar(""); }, [buscar]);

    const onQ = (v) => {
        setQ(v);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => buscar(v.trim()), 300);
    };

    const guardar = async (quitar = false) => {
        setSaving(true);
        try {
            const { data } = await api.put(`/personal/jefes-linea/${fila.id}`, {
                teacher_id: quitar ? null : sel,
                resolucion, designado_desde: desde,
                career_ids: quitar ? [] : [...selCarreras],
            });
            toast.success(quitar ? "Responsable retirado" : "Responsable designado");
            onHecho(data);
            onClose();
        } catch (e) {
            toast.error(e?.response?.data?.detail || "No se pudo guardar");
        } finally { setSaving(false); }
    };

    // Portal a <body>: dentro de ModuleShell el backdrop-blur de la tarjeta
    // crea un containing block y el overlay `fixed` se anclaba a ella.
    return createPortal(
        <div className={`${SCOPE} adm-overlay`}>
            <div className="adm-modal w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                            Responsable del cargo
                        </p>
                        <h3 className="text-[15px] font-extrabold text-slate-800 leading-snug">
                            {fila.cargo_label}
                        </h3>
                    </div>
                    <button onClick={onClose}
                        className="adm-ghost p-1.5 rounded-lg text-slate-400 hover:text-slate-700">
                        <X size={18} />
                    </button>
                </div>

                <div className="px-5 py-3 border-b border-slate-100">
                    <div className="relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input value={q} onChange={(e) => onQ(e.target.value)}
                            placeholder="Buscar docente del módulo Académico por nombre, DNI o especialidad…"
                            className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-400" />
                    </div>
                </div>

                <div className="adm-modal-body flex-1 px-3 py-2 max-h-[46vh]">
                    {loading ? (
                        <div className="py-10 grid place-items-center text-slate-400">
                            <Loader2 className="animate-spin" size={22} />
                        </div>
                    ) : rows.length === 0 ? (
                        <p className="py-10 text-center text-sm text-slate-400">
                            Sin docentes que coincidan.
                        </p>
                    ) : rows.map((d) => (
                        <button key={d.teacher_id} onClick={() => setSel(d.teacher_id)}
                            className={"w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors "
                                + (sel === d.teacher_id
                                    ? "adm-soft ring-1 ring-blue-300"
                                    : "adm-ghost")}>
                            <span className="h-9 w-9 rounded-xl overflow-hidden bg-slate-100 grid place-items-center shrink-0">
                                {d.foto_url
                                    ? <img src={d.foto_url} alt="" className="h-full w-full object-cover" />
                                    : <UserRound size={16} className="text-slate-300" />}
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-[13px] font-bold text-slate-800 truncate">
                                    {d.nombre}
                                </span>
                                <span className="block text-[11px] text-slate-400 truncate">
                                    {[d.documento, d.grado_label, d.especialidad].filter(Boolean).join(" · ")}
                                </span>
                            </span>
                            {sel === d.teacher_id && <CheckCircle2 size={16} className="text-blue-600 shrink-0" />}
                        </button>
                    ))}
                </div>

                {/* Programas a cargo: alcance de los reportes del coordinador */}
                <div className="px-5 py-3 border-t border-slate-100">
                    <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        Programas a cargo
                    </label>
                    <p className="text-[10.5px] text-slate-400 mt-0.5">
                        Define qué docentes y estudiantes ve en sus reportes. Se
                        puede marcar más de uno (Educación Física lleva también
                        Comunicación).
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                        {carreras.length === 0 ? (
                            <span className="text-[11px] text-slate-400">Sin programas registrados.</span>
                        ) : carreras.map((c) => {
                            const puesto = selCarreras.has(c.id);
                            return (
                                <button key={c.id} type="button"
                                    onClick={() => setSelCarreras((s0) => {
                                        const n = new Set(s0);
                                        if (n.has(c.id)) n.delete(c.id); else n.add(c.id);
                                        return n;
                                    })}
                                    className={"px-3 h-8 rounded-full text-[11.5px] font-bold border transition-colors "
                                        + (puesto
                                            ? "adm-soft border-blue-300"
                                            : "adm-plain border-slate-200 text-slate-500 hover:border-blue-300")}>
                                    {puesto && "✓ "}{c.name}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="px-5 py-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                            R.D. de designación
                        </label>
                        <input value={resolucion} onChange={(e) => setResolucion(e.target.value)}
                            placeholder="R.D. N° …"
                            className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/25" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                            Designado desde
                        </label>
                        <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
                            className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/25" />
                    </div>
                </div>

                <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                    {fila.responsable ? (
                        <button onClick={() => guardar(true)} disabled={saving}
                            className="adm-danger inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[12px] font-bold disabled:opacity-50">
                            <Trash2 size={14} /> Quitar responsable
                        </button>
                    ) : <span />}
                    <div className="flex gap-2">
                        <button onClick={onClose}
                            className="adm-ghost px-4 h-9 rounded-xl text-[12.5px] font-bold text-slate-500">
                            Cancelar
                        </button>
                        <button onClick={() => guardar(false)} disabled={saving || !sel}
                            className="adm-primary inline-flex items-center gap-1.5 px-5 h-9 rounded-xl text-[12.5px] font-extrabold">
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                            Designar
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body,
    );
}

/* ── Panel ─────────────────────────────────────────────────────────── */
export default function JefesLineaPanel() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [picker, setPicker] = useState(null);
    const [subiendo, setSubiendo] = useState(null);
    const [subiendoRd, setSubiendoRd] = useState(null);
    const inputs = useRef({});
    const inputsRd = useRef({});

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await api.get("/personal/jefes-linea");
            setRows(data?.rows || []);
        } catch (e) {
            toast.error(e?.response?.data?.detail
                || "No se pudo cargar el cuadro de jefes de línea");
            setRows([]);
        } finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const reemplazar = (fila) =>
        setRows((rs) => rs.map((r) => (r.id === fila.id ? fila : r)));

    const subirPlan = async (fila, file) => {
        if (!file) return;
        setSubiendo(fila.id);
        try {
            const fd = new FormData();
            fd.append("archivo", file);
            const { data } = await api.post(
                `/personal/jefes-linea/${fila.id}/plan`, fd);
            reemplazar(data);
            toast.success("Plan de trabajo cargado");
        } catch (e) {
            toast.error(e?.response?.data?.detail || "No se pudo subir el plan");
        } finally { setSubiendo(null); }
    };

    const subirRd = async (fila, file) => {
        if (!file) return;
        setSubiendoRd(fila.id);
        try {
            const fd = new FormData();
            fd.append("archivo", file);
            const { data } = await api.post(
                `/personal/jefes-linea/${fila.id}/rd`, fd);
            reemplazar(data);
            toast.success("R.D. Regional cargada");
        } catch (e) {
            toast.error(e?.response?.data?.detail || "No se pudo subir la R.D.");
        } finally { setSubiendoRd(null); }
    };

    const quitarRd = async (fila) => {
        if (!window.confirm("¿Quitar la R.D. Regional de este cargo?")) return;
        try {
            const { data } = await api.delete(`/personal/jefes-linea/${fila.id}/rd`);
            reemplazar(data);
            toast.success("R.D. Regional retirada");
        } catch (e) {
            toast.error(e?.response?.data?.detail || "No se pudo quitar la R.D.");
        }
    };

    const quitarPlan = async (fila) => {
        if (!window.confirm("¿Quitar el plan de trabajo de este cargo?")) return;
        try {
            const { data } = await api.delete(`/personal/jefes-linea/${fila.id}/plan`);
            reemplazar(data);
            toast.success("Plan de trabajo retirado");
        } catch (e) {
            toast.error(e?.response?.data?.detail || "No se pudo quitar el plan");
        }
    };

    const stats = useMemo(() => ({
        total: rows.length,
        asignados: rows.filter((r) => r.responsable).length,
        planes: rows.filter((r) => r.plan_trabajo_url).length,
        rds: rows.filter((r) => r.rd_url).length,
    }), [rows]);

    return (
        <div className="space-y-4">
            {/* Resumen */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-[11.5px] font-bold text-slate-600">
                        <ShieldCheck size={13} /> {stats.total} cargos de la Ley N° 30512
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-[11.5px] font-bold text-blue-700">
                        {stats.asignados} con responsable
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 text-[11.5px] font-bold text-indigo-700">
                        {stats.rds} con R.D. Regional
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-[11.5px] font-bold text-emerald-700">
                        {stats.planes} con plan de trabajo
                    </span>
                </div>
                <button onClick={load}
                    className="adm-outline inline-flex items-center gap-1.5 px-3 h-9 rounded-xl border border-slate-200 text-[12px] font-bold">
                    <RefreshCw size={13} /> Actualizar
                </button>
            </div>

            <p className="text-[11.5px] text-slate-500 leading-relaxed">
                El responsable se jala del <b>directorio de docentes</b> del módulo
                Académico. Los jefes de línea <b>no reciben usuario nuevo</b>: entran
                con su misma contraseña de docente y desde su panel suben su plan de
                trabajo, que aparece aquí y en el portal público.
                La <b>R.D. Regional</b> se carga en PDF (hasta 15 MB) y también se
                publica.
            </p>

            {/* Tabla */}
            <div className="rounded-2xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[1100px] text-sm">
                        <thead>
                            <tr style={{ background: NAVY }} className="text-white">
                                <th className="text-left px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.1em]">Cargo</th>
                                <th className="text-left px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.1em] w-[230px]">R.D. Regional</th>
                                <th className="text-left px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.1em] w-[300px]">Responsable</th>
                                <th className="text-left px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.1em] w-[260px]">Plan de trabajo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={4} className="py-12 text-center text-slate-400">
                                    <Loader2 className="animate-spin inline" size={20} />
                                </td></tr>
                            ) : rows.map((r, i) => (
                                <tr key={r.id}
                                    className={"border-t border-slate-100 " + (i % 2 ? "bg-slate-50/60" : "")}>
                                    <td className="px-4 py-3 align-top">
                                        <span className="text-[12.5px] font-semibold text-slate-700">
                                            <span className="text-slate-400 mr-1.5">{r.letra}.</span>
                                            {r.cargo_label}
                                        </span>
                                    </td>

                                    {/* R.D. Regional (PDF de la designación) */}
                                    <td className="px-4 py-3 align-top">
                                        {r.resolucion && (
                                            <span className="block mb-1.5 text-[11px] font-semibold text-slate-600">
                                                {r.resolucion}
                                            </span>
                                        )}
                                        <input type="file" hidden accept="application/pdf,.pdf"
                                            ref={(el) => { inputsRd.current[r.id] = el; }}
                                            onChange={(e) => {
                                                subirRd(r, e.target.files?.[0]);
                                                e.target.value = "";
                                            }} />
                                        {r.rd_url ? (
                                            <div className="flex flex-wrap items-center gap-2">
                                                <a href={r.rd_url} target="_blank" rel="noreferrer"
                                                    className="inline-flex items-center gap-1.5 px-3 h-8 rounded-xl bg-indigo-50 text-indigo-700 text-[11.5px] font-bold hover:bg-indigo-100">
                                                    <ScrollText size={13} /> Ver R.D.
                                                </a>
                                                <button onClick={() => inputsRd.current[r.id]?.click()}
                                                    disabled={subiendoRd === r.id}
                                                    className="adm-ghost p-1.5 rounded-lg text-slate-400 hover:text-blue-600"
                                                    title="Reemplazar R.D.">
                                                    {subiendoRd === r.id
                                                        ? <Loader2 size={14} className="animate-spin" />
                                                        : <UploadCloud size={14} />}
                                                </button>
                                                <button onClick={() => quitarRd(r)}
                                                    className="adm-danger p-1.5 rounded-lg"
                                                    title="Quitar R.D.">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Pill ok={false}>Sin R.D.</Pill>
                                                <button onClick={() => inputsRd.current[r.id]?.click()}
                                                    disabled={subiendoRd === r.id}
                                                    className="adm-outline inline-flex items-center gap-1.5 px-3 h-8 rounded-xl border border-slate-200 text-[11.5px] font-bold">
                                                    {subiendoRd === r.id
                                                        ? <Loader2 size={13} className="animate-spin" />
                                                        : <UploadCloud size={13} />}
                                                    Subir PDF
                                                </button>
                                            </div>
                                        )}
                                    </td>

                                    <td className="px-4 py-3 align-top">
                                        {r.responsable ? (
                                            <button onClick={() => setPicker(r)}
                                                className="adm-plain w-full flex items-center gap-2.5 text-left group">
                                                <span className="h-9 w-9 rounded-xl overflow-hidden bg-slate-100 grid place-items-center shrink-0">
                                                    {r.responsable.foto_url
                                                        ? <img src={r.responsable.foto_url} alt="" className="h-full w-full object-cover" />
                                                        : <UserRound size={15} className="text-slate-300" />}
                                                </span>
                                                <span className="min-w-0">
                                                    <span className="block text-[12.5px] font-bold text-slate-800 truncate group-hover:text-blue-700">
                                                        {r.responsable.nombre}
                                                    </span>
                                                    <span className="block text-[10.5px] text-slate-400 truncate">
                                                        {[r.responsable.grado_label, r.responsable.documento]
                                                            .filter(Boolean).join(" · ") || "Docente"}
                                                    </span>
                                                </span>
                                            </button>
                                        ) : (
                                            <button onClick={() => setPicker(r)}
                                                className="adm-plain inline-flex items-center gap-1.5 px-3 h-8 rounded-xl border border-dashed border-slate-300 text-[11.5px] font-bold text-slate-500 hover:border-blue-400 hover:text-blue-700">
                                                <UserPlus size={13} /> Asignar docente
                                            </button>
                                        )}
                                    </td>

                                    <td className="px-4 py-3 align-top">
                                        {r.plan_trabajo_url ? (
                                            <div className="flex flex-wrap items-center gap-2">
                                                <a href={r.plan_trabajo_url} target="_blank" rel="noreferrer"
                                                    className="inline-flex items-center gap-1.5 px-3 h-8 rounded-xl bg-blue-50 text-blue-700 text-[11.5px] font-bold hover:bg-blue-100">
                                                    <FileText size={13} /> Ver plan
                                                </a>
                                                <button onClick={() => quitarPlan(r)}
                                                    className="adm-danger p-1.5 rounded-lg"
                                                    title="Quitar plan">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Pill ok={false}>Pendiente</Pill>
                                                {r.responsable && (
                                                    <>
                                                        <input type="file" hidden
                                                            accept=".pdf,.doc,.docx"
                                                            ref={(el) => { inputs.current[r.id] = el; }}
                                                            onChange={(e) => {
                                                                subirPlan(r, e.target.files?.[0]);
                                                                e.target.value = "";
                                                            }} />
                                                        <button onClick={() => inputs.current[r.id]?.click()}
                                                            disabled={subiendo === r.id}
                                                            className="adm-outline inline-flex items-center gap-1.5 px-3 h-8 rounded-xl border border-slate-200 text-[11.5px] font-bold">
                                                            {subiendo === r.id
                                                                ? <Loader2 size={13} className="animate-spin" />
                                                                : <UploadCloud size={13} />}
                                                            Cargar por mesa
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {picker && (
                <PickerDocente fila={picker} onClose={() => setPicker(null)}
                    onHecho={reemplazar} />
            )}
        </div>
    );
}
