// Mi Hoja de Vida — panel del ADMINISTRATIVO / LOCADOR 107.
//
// Reutiliza tal cual el formulario del docente (mismos ítems: datos
// personales, formación profesional, especialización y actualización,
// experiencia laboral, participación en eventos académicos…) apuntado a los
// endpoints de `personal`, y le suma lo que el docente no necesita:
//   · la FOTO, que va en el portal público de transparencia;
//   · para los locadores 107, la orden de servicio vigente, el protocolo y
//     el plan de trabajo.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
    ScrollText, ShieldCheck, ClipboardList, UploadCloud, Loader2, Trash2,
    CheckCircle2, AlertCircle, FileText, BadgeCheck, UserRound, Camera,
} from "lucide-react";
import TeacherHojaVida from "../academic/TeacherHojaVida";
import { api } from "../../lib/api";
import { InjectPersonalStyles, SCOPE } from "./personalStyles";

const DOCS = [
    {
        campo: "orden_servicio", url: "orden_servicio_url", Icon: ScrollText,
        titulo: "Orden de servicio vigente",
        ayuda: "Documento que acredita tu contrato de locación vigente.",
    },
    {
        campo: "protocolo", url: "protocolo_url", Icon: ShieldCheck,
        titulo: "Protocolo",
        ayuda: "Protocolo de servicio firmado.",
    },
    {
        campo: "plan_trabajo", url: "plan_trabajo_url", Icon: ClipboardList,
        titulo: "Plan de trabajo",
        ayuda: "Plan de trabajo del periodo en curso.",
    },
];

const inputCls =
    "mt-1 w-full h-10 px-3 rounded-xl border border-slate-200 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-400";

/* ── Foto de perfil (va al portal público) ─────────────────────────── */
function MiFoto({ perfil, onCambio }) {
    const [subiendo, setSubiendo] = useState(false);
    const input = useRef(null);

    const subir = async (file) => {
        if (!file) return;
        setSubiendo(true);
        try {
            const fd = new FormData();
            fd.append("photo", file);
            const { data } = await api.put("/personal/me/profile", fd);
            onCambio(data);
            toast.success("Foto actualizada");
        } catch (e) {
            toast.error(e?.response?.data?.detail || "No se pudo subir la foto");
        } finally { setSubiendo(false); }
    };

    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-wrap items-center gap-4">
            <div className="h-24 w-24 rounded-2xl overflow-hidden ring-1 ring-slate-200 bg-slate-50 grid place-items-center shrink-0">
                {perfil.photo_url
                    ? <img src={perfil.photo_url} alt="" className="h-full w-full object-cover" />
                    : <UserRound className="h-9 w-9 text-slate-300" />}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    {perfil.tipo_label}
                </p>
                <h3 className="text-[15px] font-extrabold text-slate-800 leading-snug">
                    {perfil.nombre_completo || perfil.full_name}
                </h3>
                <p className="text-[12px] text-slate-500">
                    {[perfil.cargo, perfil.area].filter(Boolean).join(" · ") || "Sin cargo registrado"}
                </p>
                <p className="mt-1.5 text-[11px] text-slate-400 leading-relaxed max-w-xl">
                    Tu foto se publica en el portal de transparencia junto con tus
                    datos generales y tu cargo. Usa una foto tipo carnet, fondo claro.
                </p>
                <input type="file" hidden accept="image/*" ref={input}
                    onChange={(e) => { subir(e.target.files?.[0]); e.target.value = ""; }} />
                <button onClick={() => input.current?.click()} disabled={subiendo}
                    className="adm-primary mt-3 inline-flex items-center gap-1.5 px-4 h-9 rounded-xl text-[12px] font-extrabold">
                    {subiendo ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                    {perfil.photo_url ? "Cambiar foto" : "Subir mi foto"}
                </button>
            </div>
        </div>
    );
}

/* ── Documentos del locador 107 ────────────────────────────────────── */
function DocumentosLocador({ perfil, onCambio }) {
    const [subiendo, setSubiendo] = useState(null);
    const [guardandoVig, setGuardandoVig] = useState(false);
    const [vig, setVig] = useState({
        orden_servicio_numero: perfil.orden_servicio_numero || "",
        orden_servicio_desde: perfil.orden_servicio_desde || "",
        orden_servicio_hasta: perfil.orden_servicio_hasta || "",
    });
    const inputs = useRef({});

    const subir = async (campo, file) => {
        if (!file) return;
        setSubiendo(campo);
        try {
            const fd = new FormData();
            fd.append(campo, file);
            const { data } = await api.post("/personal/me/documentos", fd);
            onCambio(data);
            toast.success("Documento cargado");
        } catch (e) {
            toast.error(e?.response?.data?.detail || "No se pudo subir el documento");
        } finally { setSubiendo(null); }
    };

    const quitar = async (campo) => {
        if (!window.confirm("¿Quitar este documento? Dejará de verse en el portal público.")) return;
        try {
            const { data } = await api.delete("/personal/me/documentos",
                { params: { campo } });
            onCambio(data);
            toast.success("Documento retirado");
        } catch (e) {
            toast.error(e?.response?.data?.detail || "No se pudo quitar el documento");
        }
    };

    const guardarVigencia = async () => {
        setGuardandoVig(true);
        try {
            const fd = new FormData();
            for (const [k, v] of Object.entries(vig)) fd.append(k, v ?? "");
            const { data } = await api.post("/personal/me/documentos", fd);
            onCambio(data);
            toast.success("Vigencia actualizada");
        } catch (e) {
            toast.error(e?.response?.data?.detail || "No se pudo guardar la vigencia");
        } finally { setGuardandoVig(false); }
    };

    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                        Locador 107 – MINEDU
                    </p>
                    <h3 className="text-[15px] font-extrabold text-slate-800">Mis documentos</h3>
                </div>
                {perfil.orden_servicio_url && (
                    <span className={"inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border "
                        + (perfil.orden_servicio_vigente
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-red-50 text-red-700 border-red-200")}>
                        <BadgeCheck size={12} />
                        {perfil.orden_servicio_vigente
                            ? "Orden de servicio vigente"
                            : "Orden de servicio vencida"}
                    </span>
                )}
            </div>

            <p className="mt-2 text-[11.5px] text-slate-500 leading-relaxed">
                Estos documentos se publican en el portal de transparencia junto con
                tu hoja de vida y tu foto. PDF o Word, hasta 15 MB.
            </p>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {DOCS.map((d) => {
                    const url = perfil[d.url];
                    return (
                        <div key={d.campo}
                            className="rounded-xl border border-slate-200 p-4 flex flex-col">
                            <div className="flex items-center gap-2">
                                <span className="h-8 w-8 rounded-xl bg-slate-100 grid place-items-center shrink-0">
                                    <d.Icon size={15} className="text-slate-500" />
                                </span>
                                <span className="text-[12.5px] font-bold text-slate-800 leading-tight">
                                    {d.titulo}
                                </span>
                            </div>
                            <p className="mt-1.5 text-[11px] text-slate-400 flex-1">{d.ayuda}</p>

                            <span className={"mt-2 self-start inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold border "
                                + (url
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-amber-50 text-amber-700 border-amber-200")}>
                                {url ? <><CheckCircle2 size={11} /> Cargado</>
                                    : <><AlertCircle size={11} /> Pendiente</>}
                            </span>

                            <input type="file" hidden accept=".pdf,.doc,.docx,.jpg,.png"
                                ref={(el) => { inputs.current[d.campo] = el; }}
                                onChange={(e) => { subir(d.campo, e.target.files?.[0]); e.target.value = ""; }} />

                            <div className="mt-3 flex flex-wrap gap-1.5">
                                {url && (
                                    <a href={url} target="_blank" rel="noreferrer"
                                        className="inline-flex items-center gap-1 px-2.5 h-8 rounded-lg bg-blue-50 text-blue-700 text-[11px] font-bold hover:bg-blue-100">
                                        <FileText size={12} /> Ver
                                    </a>
                                )}
                                <button onClick={() => inputs.current[d.campo]?.click()}
                                    disabled={subiendo === d.campo}
                                    className="adm-outline inline-flex items-center gap-1 px-2.5 h-8 rounded-lg border border-slate-200 text-[11px] font-bold">
                                    {subiendo === d.campo
                                        ? <Loader2 size={12} className="animate-spin" />
                                        : <UploadCloud size={12} />}
                                    {url ? "Reemplazar" : "Subir"}
                                </button>
                                {url && (
                                    <button onClick={() => quitar(d.campo)}
                                        className="adm-danger p-1.5 rounded-lg"
                                        title="Quitar">
                                        <Trash2 size={13} />
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Vigencia de la orden de servicio */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        N° de orden de servicio
                    </label>
                    <input className={inputCls} value={vig.orden_servicio_numero}
                        onChange={(e) => setVig((v) => ({ ...v, orden_servicio_numero: e.target.value }))} />
                </div>
                <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        Vigente desde
                    </label>
                    <input type="date" className={inputCls} value={vig.orden_servicio_desde}
                        onChange={(e) => setVig((v) => ({ ...v, orden_servicio_desde: e.target.value }))} />
                </div>
                <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        Vigente hasta
                    </label>
                    <input type="date" className={inputCls} value={vig.orden_servicio_hasta}
                        onChange={(e) => setVig((v) => ({ ...v, orden_servicio_hasta: e.target.value }))} />
                </div>
                <button onClick={guardarVigencia} disabled={guardandoVig}
                    className="adm-primary inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl text-[12.5px] font-extrabold">
                    {guardandoVig ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    Guardar vigencia
                </button>
            </div>
        </div>
    );
}

/* ── Página ────────────────────────────────────────────────────────── */
export default function MiHojaVidaPersonal() {
    const [perfil, setPerfil] = useState(null);
    const [error, setError] = useState("");

    const cargar = useCallback(async () => {
        try {
            const { data } = await api.get("/personal/me/profile");
            setPerfil(data);
        } catch (e) {
            setError(e?.response?.data?.detail
                || "Tu usuario no tiene ficha de personal administrativo.");
        }
    }, []);
    useEffect(() => { cargar(); }, [cargar]);

    if (error) {
        return (
            <div className="min-h-[60dvh] grid place-items-center p-6 text-center">
                <div>
                    <div className="h-16 w-16 rounded-3xl bg-slate-100 grid place-items-center mx-auto mb-4">
                        <UserRound className="h-7 w-7 text-slate-300" />
                    </div>
                    <p className="text-slate-700 font-bold">Sin ficha de personal</p>
                    <p className="text-sm text-slate-400 mt-1 max-w-md">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className={SCOPE}>
            <InjectPersonalStyles />
            {perfil && (
                <div className="max-w-5xl mx-auto px-4 pt-6 space-y-4">
                    <MiFoto perfil={perfil} onCambio={setPerfil} />
                    {perfil.tipo === "LOCADOR" && (
                        <DocumentosLocador perfil={perfil} onCambio={setPerfil} />
                    )}
                </div>
            )}
            <TeacherHojaVida
                cvBase="/personal/me/cv"
                profileBase="/personal/me/profile"
                archivoPdf="hoja-de-vida.pdf"
            />
        </div>
    );
}
