// Mi Plan de Trabajo — panel del JEFE DE LÍNEA.
//
// Los jefes de línea son docentes: entran con su misma cuenta y contraseña de
// siempre. Lo único que les aparece de más, al ser designados en un cargo de
// la Ley N° 30512, es esta pantalla para subir su plan de trabajo, que sale
// en el cuadro del módulo Administrativos y en el portal público.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
    ClipboardList, UploadCloud, FileText, Trash2, Loader2, ShieldCheck,
    CheckCircle2, AlertCircle, CalendarDays, ScrollText,
} from "lucide-react";
import ModuleShell from "@/components/module/ModuleShell";
import { api } from "../../lib/api";
import { InjectPersonalStyles, SCOPE } from "./personalStyles";

const fmt = (iso) => {
    if (!iso) return "";
    try {
        return new Date(iso).toLocaleDateString("es-PE",
            { day: "2-digit", month: "long", year: "numeric" });
    } catch { return iso; }
};

export default function MiPlanTrabajo() {
    const [jefaturas, setJefaturas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [subiendo, setSubiendo] = useState(null);
    const [subiendoRd, setSubiendoRd] = useState(null);
    const inputs = useRef({});
    const inputsRd = useRef({});

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await api.get("/personal/me");
            setJefaturas(data?.jefaturas || []);
        } catch {
            setJefaturas([]);
        } finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const subir = async (j, file) => {
        if (!file) return;
        setSubiendo(j.id);
        try {
            const fd = new FormData();
            fd.append("archivo", file);
            fd.append("jefatura_id", j.id);
            const { data } = await api.post("/personal/me/plan-trabajo", fd);
            setJefaturas(data?.jefaturas || []);
            toast.success("Plan de trabajo publicado");
        } catch (e) {
            toast.error(e?.response?.data?.detail || "No se pudo subir el plan");
        } finally { setSubiendo(null); }
    };

    const subirRd = async (j, file) => {
        if (!file) return;
        setSubiendoRd(j.id);
        try {
            const fd = new FormData();
            fd.append("archivo", file);
            fd.append("jefatura_id", j.id);
            const { data } = await api.post("/personal/me/rd", fd);
            setJefaturas(data?.jefaturas || []);
            toast.success("R.D. Regional publicada");
        } catch (e) {
            toast.error(e?.response?.data?.detail || "No se pudo subir la R.D.");
        } finally { setSubiendoRd(null); }
    };

    const quitarRd = async (j) => {
        if (!window.confirm("¿Quitar tu R.D. Regional? Dejará de verse en el portal público.")) return;
        try {
            const { data } = await api.delete("/personal/me/rd",
                { params: { jefatura_id: j.id } });
            setJefaturas(data?.jefaturas || []);
            toast.success("R.D. Regional retirada");
        } catch (e) {
            toast.error(e?.response?.data?.detail || "No se pudo quitar la R.D.");
        }
    };

    const quitar = async (j) => {
        if (!window.confirm("¿Quitar tu plan de trabajo? Dejará de verse en el portal público.")) return;
        try {
            const { data } = await api.delete("/personal/me/plan-trabajo",
                { params: { jefatura_id: j.id } });
            setJefaturas(data?.jefaturas || []);
            toast.success("Plan de trabajo retirado");
        } catch (e) {
            toast.error(e?.response?.data?.detail || "No se pudo quitar el plan");
        }
    };

    return (
        <div className={SCOPE}>
        <InjectPersonalStyles />
        <ModuleShell
            icon={ClipboardList}
            title="Mi Plan de Trabajo"
            subtitle="Jefatura de línea — Reglamento de la Ley N° 30512"
            accent="linear-gradient(135deg, #0EA5E9, #1F4E79)"
        >
            {loading ? (
                <div className="py-16 grid place-items-center text-slate-400">
                    <Loader2 className="animate-spin" size={24} />
                </div>
            ) : jefaturas.length === 0 ? (
                <div className="py-16 text-center">
                    <div className="h-16 w-16 rounded-3xl bg-slate-100 grid place-items-center mx-auto mb-4">
                        <ShieldCheck className="h-7 w-7 text-slate-300" />
                    </div>
                    <p className="text-slate-700 font-bold">No figuras como jefe (a) de línea</p>
                    <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
                        Si acabas de ser designado (a), pide a Secretaría Académica que
                        te asigne el cargo en el módulo Administrativos.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    <p className="text-[12px] text-slate-500 leading-relaxed max-w-3xl">
                        El plan de trabajo que subas aquí se publica en el portal de
                        transparencia junto con tus datos generales, tu grado académico
                        y tu foto, tal como lo exige la Ley N° 30512. El plan acepta
                        PDF o Word; la <b>R.D. Regional</b> de tu designación va en PDF.
                        Hasta 15 MB cada uno.
                    </p>

                    {jefaturas.map((j) => (
                        <div key={j.id}
                            className="rounded-2xl border border-slate-200 bg-white p-5">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <span className="inline-flex px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-100 text-[10px] font-extrabold text-blue-800 uppercase tracking-wide">
                                        {j.letra}. Ley N° 30512
                                    </span>
                                    <h3 className="mt-2 text-[15px] font-extrabold text-slate-800 leading-snug">
                                        {j.cargo_label}
                                    </h3>
                                    {j.resolucion && (
                                        <p className="mt-0.5 text-[11.5px] text-slate-400">
                                            {j.resolucion}
                                            {j.designado_desde && ` · desde ${fmt(j.designado_desde)}`}
                                        </p>
                                    )}
                                </div>
                                <span className={"inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border "
                                    + (j.plan_trabajo_url
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                        : "bg-amber-50 text-amber-700 border-amber-200")}>
                                    {j.plan_trabajo_url
                                        ? <><CheckCircle2 size={12} /> Publicado</>
                                        : <><AlertCircle size={12} /> Pendiente</>}
                                </span>
                            </div>

                            {/* R.D. Regional de la designación */}
                            <input type="file" hidden accept="application/pdf,.pdf"
                                ref={(el) => { inputsRd.current[j.id] = el; }}
                                onChange={(e) => { subirRd(j, e.target.files?.[0]); e.target.value = ""; }} />

                            <div className="mt-4 pt-4 border-t border-slate-100">
                                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                                    R.D. Regional
                                </p>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                    {j.rd_url ? (
                                        <>
                                            <a href={j.rd_url} target="_blank" rel="noreferrer"
                                                className="inline-flex items-center gap-1.5 px-4 h-9 rounded-xl bg-indigo-50 text-indigo-700 text-[12px] font-bold hover:bg-indigo-100">
                                                <ScrollText size={14} /> Ver mi R.D.
                                            </a>
                                            <button onClick={() => inputsRd.current[j.id]?.click()}
                                                disabled={subiendoRd === j.id}
                                                className="adm-outline inline-flex items-center gap-1.5 px-4 h-9 rounded-xl border border-slate-200 text-[12px] font-bold">
                                                {subiendoRd === j.id
                                                    ? <Loader2 size={14} className="animate-spin" />
                                                    : <UploadCloud size={14} />}
                                                Reemplazar
                                            </button>
                                            <button onClick={() => quitarRd(j)}
                                                className="adm-danger inline-flex items-center gap-1.5 px-3 h-9 rounded-xl text-[12px] font-bold">
                                                <Trash2 size={14} /> Quitar
                                            </button>
                                            {j.rd_subida && (
                                                <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                                                    <CalendarDays size={12} /> Subida el {fmt(j.rd_subida)}
                                                </span>
                                            )}
                                        </>
                                    ) : (
                                        <button onClick={() => inputsRd.current[j.id]?.click()}
                                            disabled={subiendoRd === j.id}
                                            className="adm-primary inline-flex items-center gap-1.5 px-5 h-10 rounded-xl text-[12.5px] font-extrabold">
                                            {subiendoRd === j.id
                                                ? <Loader2 size={15} className="animate-spin" />
                                                : <UploadCloud size={15} />}
                                            Subir mi R.D. en PDF
                                        </button>
                                    )}
                                </div>
                            </div>

                            <input type="file" hidden accept=".pdf,.doc,.docx"
                                ref={(el) => { inputs.current[j.id] = el; }}
                                onChange={(e) => { subir(j, e.target.files?.[0]); e.target.value = ""; }} />

                            <div className="mt-4 pt-4 border-t border-slate-100">
                                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                                    Plan de trabajo
                                </p>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                {j.plan_trabajo_url ? (
                                    <>
                                        <a href={j.plan_trabajo_url} target="_blank" rel="noreferrer"
                                            className="inline-flex items-center gap-1.5 px-4 h-9 rounded-xl bg-blue-50 text-blue-700 text-[12px] font-bold hover:bg-blue-100">
                                            <FileText size={14} /> Ver mi plan
                                        </a>
                                        <button onClick={() => inputs.current[j.id]?.click()}
                                            disabled={subiendo === j.id}
                                            className="adm-outline inline-flex items-center gap-1.5 px-4 h-9 rounded-xl border border-slate-200 text-[12px] font-bold">
                                            {subiendo === j.id
                                                ? <Loader2 size={14} className="animate-spin" />
                                                : <UploadCloud size={14} />}
                                            Reemplazar
                                        </button>
                                        <button onClick={() => quitar(j)}
                                            className="adm-danger inline-flex items-center gap-1.5 px-3 h-9 rounded-xl text-[12px] font-bold">
                                            <Trash2 size={14} /> Quitar
                                        </button>
                                        {j.plan_trabajo_subido && (
                                            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                                                <CalendarDays size={12} />
                                                Subido el {fmt(j.plan_trabajo_subido)}
                                            </span>
                                        )}
                                    </>
                                ) : (
                                    <button onClick={() => inputs.current[j.id]?.click()}
                                        disabled={subiendo === j.id}
                                        className="adm-primary inline-flex items-center gap-1.5 px-5 h-10 rounded-xl text-[12.5px] font-extrabold">
                                        {subiendo === j.id
                                            ? <Loader2 size={15} className="animate-spin" />
                                            : <UploadCloud size={15} />}
                                        Subir mi plan de trabajo
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </ModuleShell>
        </div>
    );
}
