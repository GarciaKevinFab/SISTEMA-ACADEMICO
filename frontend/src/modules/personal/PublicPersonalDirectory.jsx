// Portal PÚBLICO del personal (/public/personal) — transparencia MINEDU.
//
// Un solo enlace con los tres colectivos, en el orden pedido:
//   1. Jefes de Línea (Ley N° 30512) → datos generales, plan de trabajo,
//      grado académico y foto.
//   2. Administrativos → datos generales, foto y cargo.
//   3. Locadores 107 – MINEDU → además, hoja de vida, orden de servicio
//      vigente, protocolo y plan de trabajo.
//
// Va aparte de la plana docente (/public/docentes): son la parte
// administrativa, no personal docente.
import React, { useCallback, useEffect, useState } from "react";
import {
    Briefcase, FileText, Loader2, UserRound, ShieldCheck, HardHat, Users,
    ClipboardList, ScrollText, BadgeCheck,
} from "lucide-react";
import {
    InjectPublicStyles, Reveal, HeroFade, PublicHeader,
} from "../../components/public/publicFx";
import { api } from "../../lib/api";
import { InjectPersonalStyles, SCOPE } from "./personalStyles";

const SECCIONES = [
    {
        clave: "jefes_linea", id: "jefes-linea", numero: "1",
        titulo: "Jefes de Línea", Icon: ShieldCheck,
        bajada: "Cargos del Reglamento de la Ley N° 30512, Ley de Institutos y "
            + "Escuelas de Educación Superior y de la Carrera Pública de sus Docentes.",
    },
    {
        clave: "administrativos", id: "administrativos", numero: "2",
        titulo: "Administrativos", Icon: Users,
        bajada: "Personal administrativo con sus cargos según el Reglamento "
            + "Institucional presentado al Ministerio de Educación.",
    },
    {
        clave: "locadores", id: "locadores", numero: "3",
        titulo: "Locadores 107 – MINEDU", Icon: HardHat,
        bajada: "Personal por locación de servicios: hoja de vida, orden de "
            + "servicio vigente, protocolo y plan de trabajo.",
    },
];

const abs = (u) => (u && !/^https?:/i.test(u)
    ? `${api.defaults.baseURL || ""}${u}` : u);

function Foto({ src, alt }) {
    return (
        <div className="h-28 w-28 rounded-2xl overflow-hidden ring-1 ring-slate-200 bg-slate-50 grid place-items-center">
            {src
                ? <img src={src} alt={alt} loading="lazy" className="h-full w-full object-cover" />
                : <UserRound className="h-10 w-10 text-slate-300" />}
        </div>
    );
}

function Boton({ href, children, Icon, tono = "navy" }) {
    if (!href) return null;
    const cls = tono === "navy"
        ? "bg-blue-950 text-white hover:bg-blue-900 shadow-md shadow-blue-950/20"
        : "bg-white text-blue-950 ring-1 ring-slate-200 hover:bg-slate-50";
    return (
        <a href={href} target="_blank" rel="noreferrer"
            className={"inline-flex items-center gap-1.5 px-3.5 h-8 rounded-full text-[11.5px] font-extrabold transition-all duration-300 hover:scale-[1.04] " + cls}>
            <Icon className="w-3.5 h-3.5" /> {children}
        </a>
    );
}

/* ── Tarjetas por colectivo ────────────────────────────────────────── */

function TarjetaJefe({ r, i }) {
    const p = r.responsable || {};
    return (
        <Reveal delay={Math.min(i, 7) * 70}
            className="pv-lift bg-white rounded-3xl ring-1 ring-slate-200/70 shadow-sm p-5 flex flex-col items-center text-center">
            <Foto src={abs(p.foto_url)} alt={p.nombre} />
            <p className="mt-3 inline-flex px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-100 text-[10px] font-extrabold text-blue-800 uppercase tracking-wide">
                {r.letra}. Ley N° 30512
            </p>
            <p className="pv-display mt-2 text-[13px] font-extrabold text-slate-800 leading-snug">
                {p.nombre}
            </p>
            <p className="mt-1 text-[11.5px] font-semibold text-slate-600 leading-snug">
                {r.cargo_label}
            </p>
            {p.grado_label && (
                <span className="mt-1.5 inline-flex px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-[10px] font-bold text-indigo-700 uppercase tracking-wide">
                    {p.grado_label}
                </span>
            )}
            {r.resolucion && (
                <p className="mt-1 text-[10.5px] text-slate-400">{r.resolucion}</p>
            )}
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
                {r.plan_trabajo_url
                    ? <Boton href={abs(r.plan_trabajo_url)} Icon={ClipboardList}>Plan de trabajo</Boton>
                    : <span className="text-[10.5px] font-bold text-slate-400 px-3 py-1.5 rounded-full bg-slate-50">
                        Plan de trabajo en proceso
                    </span>}
                <Boton href={abs(r.rd_url)} Icon={ScrollText} tono="claro">
                    R.D. Regional
                </Boton>
            </div>
        </Reveal>
    );
}

function TarjetaPersonal({ r, i, locador }) {
    const cvUrl = `${api.defaults.baseURL || ""}/personal/public/staff/${r.id}/cv.pdf`;
    return (
        <Reveal delay={Math.min(i, 7) * 70}
            className="pv-lift bg-white rounded-3xl ring-1 ring-slate-200/70 shadow-sm p-5 flex flex-col items-center text-center">
            <Foto src={abs(r.foto_url)} alt={r.nombre} />
            <p className="pv-display mt-4 text-[13px] font-extrabold text-slate-800 leading-snug">
                {r.nombre}
            </p>
            <p className="mt-1 text-[11.5px] font-semibold text-slate-600 leading-snug">
                {r.cargo || "—"}
            </p>
            {r.grado_label && (
                <span className="mt-1.5 inline-flex px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-[10px] font-bold text-indigo-700 uppercase tracking-wide">
                    {r.grado_label}
                </span>
            )}
            {locador && r.orden_servicio_url && (
                <span className={"mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold "
                    + (r.orden_servicio_vigente ? "text-emerald-600" : "text-slate-400")}>
                    <BadgeCheck className="w-3 h-3" />
                    {r.orden_servicio_vigente ? "Orden de servicio vigente" : "Orden de servicio registrada"}
                </span>
            )}
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
                {r.cv_items > 0 && (
                    <Boton href={cvUrl} Icon={FileText}>Hoja de vida</Boton>
                )}
                {locador && (
                    <>
                        <Boton href={abs(r.orden_servicio_url)} Icon={ScrollText} tono="claro">
                            Orden de servicio
                        </Boton>
                        <Boton href={abs(r.protocolo_url)} Icon={ShieldCheck} tono="claro">
                            Protocolo
                        </Boton>
                        <Boton href={abs(r.plan_trabajo_url)} Icon={ClipboardList} tono="claro">
                            Plan de trabajo
                        </Boton>
                    </>
                )}
            </div>
        </Reveal>
    );
}

/* ── Página ────────────────────────────────────────────────────────── */

export default function PublicPersonalDirectory() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    const cargar = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await api.get("/personal/public/directorio");
            setData(data);
        } catch {
            setData({ jefes_linea: [], administrativos: [], locadores: [] });
        } finally { setLoading(false); }
    }, []);
    useEffect(() => { cargar(); }, [cargar]);

    const irA = (id) => document.getElementById(id)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });

    return (
        <div className={`${SCOPE} pv-font min-h-[100dvh] bg-slate-50 overflow-x-hidden`}>
            <InjectPublicStyles />
            <InjectPersonalStyles />
            <PublicHeader active="/public/personal" />

            {/* ── Hero ── */}
            <section className="relative bg-blue-950 overflow-hidden -mt-16 pt-16">
                <div className="pv-glow absolute -top-24 left-1/3 w-[560px] h-[320px] rounded-full bg-sky-500/25 blur-[110px]" aria-hidden="true" />
                <div className="pv-glow absolute -bottom-20 right-1/4 w-[420px] h-[260px] rounded-full bg-indigo-400/15 blur-[100px]" aria-hidden="true" />
                <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-24 text-center text-white">
                    <HeroFade>
                        <Reveal variant="scale">
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-md mb-6">
                                <Briefcase className="w-4 h-4 text-sky-300" />
                                <span className="text-xs font-semibold text-blue-100 tracking-wide">
                                    Transparencia — Ley N° 30512
                                </span>
                            </div>
                        </Reveal>
                        <Reveal delay={120}>
                            <h1 className="pv-display text-4xl sm:text-6xl font-extrabold">
                                Personal
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-200 via-white to-sky-200"> Administrativo</span>
                            </h1>
                        </Reveal>
                        <Reveal delay={240}>
                            <p className="mt-4 text-blue-100/90 max-w-2xl mx-auto text-sm sm:text-lg font-light">
                                Jefes de línea, personal administrativo y locadores 107 – MINEDU,
                                con sus cargos, hojas de vida y planes de trabajo.
                            </p>
                        </Reveal>
                        <Reveal delay={340}>
                            <div className="mt-7 flex flex-wrap justify-center gap-2">
                                {SECCIONES.map((s) => (
                                    <button key={s.clave} onClick={() => irA(s.id)}
                                        className="adm-chip inline-flex items-center gap-2 px-4 h-10 rounded-full border border-white/25 backdrop-blur-md text-[12.5px] font-bold transition-colors">
                                        <s.Icon className="w-3.5 h-3.5" />
                                        {s.numero}. {s.titulo}
                                        {data && (
                                            <span className="text-blue-200/80 font-mono">
                                                {(data[s.clave] || []).length}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </Reveal>
                    </HeroFade>
                </div>
            </section>

            {/* ── Secciones ── */}
            <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pb-20 space-y-14">
                {loading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="rounded-3xl bg-white ring-1 ring-slate-200/70 p-5 animate-pulse">
                                <div className="h-28 w-28 rounded-2xl bg-slate-100 mx-auto" />
                                <div className="h-3.5 bg-slate-100 rounded-full mt-4" />
                                <div className="h-3 bg-slate-100 rounded-full mt-2 w-2/3 mx-auto" />
                            </div>
                        ))}
                    </div>
                ) : SECCIONES.map((s) => {
                    const filas = data?.[s.clave] || [];
                    return (
                        <section key={s.clave} id={s.id} className="scroll-mt-24">
                            <Reveal className="mb-6">
                                <div className="flex items-start gap-3">
                                    <span className="h-11 w-11 rounded-2xl bg-blue-950 text-white grid place-items-center shrink-0 font-extrabold">
                                        {s.numero}
                                    </span>
                                    <div className="min-w-0">
                                        <h2 className="pv-display text-2xl sm:text-3xl font-extrabold text-slate-800 leading-tight">
                                            {s.titulo}
                                        </h2>
                                        <p className="mt-1 text-[12.5px] text-slate-500 max-w-3xl leading-relaxed">
                                            {s.bajada}
                                        </p>
                                    </div>
                                </div>
                            </Reveal>

                            {filas.length === 0 ? (
                                <div className="rounded-3xl bg-white ring-1 ring-slate-200/70 py-12 text-center">
                                    <div className="h-14 w-14 rounded-2xl bg-slate-100 grid place-items-center mx-auto mb-3">
                                        <s.Icon className="h-6 w-6 text-slate-300" />
                                    </div>
                                    <p className="text-slate-600 font-bold text-sm">
                                        Información en proceso de publicación
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
                                    {filas.map((r, i) => (
                                        s.clave === "jefes_linea"
                                            ? <TarjetaJefe key={r.id} r={r} i={i} />
                                            : <TarjetaPersonal key={r.id} r={r} i={i}
                                                locador={s.clave === "locadores"} />
                                    ))}
                                </div>
                            )}
                        </section>
                    );
                })}
            </main>

            <footer className="bg-blue-950 border-t border-white/10 py-8 text-center">
                <p className="text-blue-200/60 text-xs max-w-3xl mx-auto px-4">
                    © {new Date().getFullYear()} IESPP "Gustavo Allende Llavería" — Tarma ·
                    Publicado en cumplimiento de las disposiciones de transparencia del
                    MINEDU y del Reglamento de la Ley N° 30512.
                </p>
            </footer>
        </div>
    );
}
