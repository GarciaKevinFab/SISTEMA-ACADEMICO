// Plana docente PÚBLICA (/public/docentes) — transparencia MINEDU: los
// docentes trabajan para el Estado, así que sus hojas de vida son de
// acceso público. Sin filtros muestra a TODOS con foto y nombres; filtros
// por especialidad, curso, DNI y grado académico. Cada tarjeta abre el
// currículum en PDF en una vista previa (el mismo que emite el docente).
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
    Search, GraduationCap, FileText, Loader2, UserRound, BookOpen, X,
    Download, ExternalLink,
} from "lucide-react";
import {
    InjectPublicStyles, Reveal, HeroFade, PublicHeader,
} from "../../components/public/publicFx";
import { api } from "../../lib/api";

const VACIO = { dni: "", grado: "", especialidad: "", curso: "" };

export default function PublicTeachersDirectory() {
    const [rows, setRows] = useState([]);
    const [grados, setGrados] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filtros, setFiltros] = useState(VACIO);
    const [cvDocente, setCvDocente] = useState(null);   // vista previa del CV
    const [cvSrc, setCvSrc] = useState(null);
    const [cvError, setCvError] = useState(false);

    const buscar = useCallback(async (f = VACIO) => {
        setLoading(true);
        try {
            const params = {};
            for (const [k, v] of Object.entries(f)) if (v) params[k] = v;
            const { data } = await api.get("/catalogs/public/teachers", { params });
            setRows(data?.rows || []);
            if (data?.grados?.length) setGrados(data.grados);
        } catch {
            setRows([]);
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { buscar(); }, [buscar]);

    const hayFiltros = useMemo(
        () => Object.values(filtros).some(Boolean), [filtros]);

    const submit = (e) => { e?.preventDefault?.(); buscar(filtros); };
    const limpiar = () => { setFiltros(VACIO); buscar(VACIO); };

    const cvUrl = (t) =>
        `${api.defaults.baseURL || ""}/catalogs/public/teachers/${t.id}/cv.pdf`;

    // El CV se pide por XHR y se muestra como blob: así se ve dentro de la
    // página en vez de descargarse (el endpoint lo emite como adjunto).
    useEffect(() => {
        if (!cvDocente) { setCvSrc(null); setCvError(false); return; }
        let vivo = true;
        let url = null;
        setCvSrc(null);
        setCvError(false);
        api.get(`/catalogs/public/teachers/${cvDocente.id}/cv.pdf`,
            { responseType: "blob" })
            .then(({ data }) => {
                if (!vivo) return;
                url = URL.createObjectURL(
                    new Blob([data], { type: "application/pdf" }));
                setCvSrc(url);
            })
            .catch(() => { if (vivo) setCvError(true); });
        return () => {
            vivo = false;
            if (url) URL.revokeObjectURL(url);
        };
    }, [cvDocente]);

    return (
        <div className="pv-font min-h-[100dvh] bg-slate-50 overflow-x-hidden">
            <InjectPublicStyles />
            <PublicHeader active="/public/docentes" />

            {/* ── Hero compacto ── */}
            <section className="relative bg-blue-950 overflow-hidden -mt-16 pt-16">
                <div className="pv-glow absolute -top-24 left-1/3 w-[560px] h-[320px] rounded-full bg-indigo-500/25 blur-[110px]" aria-hidden="true" />
                <div className="pv-glow absolute -bottom-20 right-1/4 w-[420px] h-[260px] rounded-full bg-sky-400/15 blur-[100px]" aria-hidden="true" />
                <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-24 text-center text-white">
                    <HeroFade>
                        <Reveal variant="scale">
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-md mb-6">
                                <GraduationCap className="w-4 h-4 text-indigo-300" />
                                <span className="text-xs font-semibold text-blue-100 tracking-wide">
                                    Transparencia — hojas de vida públicas
                                </span>
                            </div>
                        </Reveal>
                        <Reveal delay={120}>
                            <h1 className="pv-display text-4xl sm:text-6xl font-extrabold">
                                Plana
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 via-white to-indigo-200"> Docente</span>
                            </h1>
                        </Reveal>
                        <Reveal delay={240}>
                            <p className="mt-4 text-blue-100/90 max-w-2xl mx-auto text-sm sm:text-lg font-light">
                                Conoce a nuestros formadores y consulta su currículum documentado.
                                Busca por especialidad, curso, DNI o grado académico.
                            </p>
                        </Reveal>
                    </HeroFade>
                </div>
            </section>

            {/* ── Filtros ── */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 relative z-10">
                <Reveal variant="scale">
                    <form onSubmit={submit}
                        className="bg-white rounded-3xl shadow-xl shadow-slate-900/10 ring-1 ring-slate-200/70 p-5 sm:p-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Especialidad</label>
                                <input value={filtros.especialidad}
                                    onChange={(e) => setFiltros((f) => ({ ...f, especialidad: e.target.value }))}
                                    placeholder="Ej: Educación Inicial"
                                    className="mt-1 w-full h-11 px-4 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Curso</label>
                                <input value={filtros.curso}
                                    onChange={(e) => setFiltros((f) => ({ ...f, curso: e.target.value }))}
                                    placeholder="Ej: Matemática"
                                    className="mt-1 w-full h-11 px-4 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">DNI</label>
                                <input value={filtros.dni} inputMode="numeric" maxLength={12}
                                    onChange={(e) => setFiltros((f) => ({ ...f, dni: e.target.value.replace(/\D/g, "") }))}
                                    placeholder="Documento del docente"
                                    className="mt-1 w-full h-11 px-4 rounded-xl border border-slate-200 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Grado académico</label>
                                <select value={filtros.grado}
                                    onChange={(e) => setFiltros((f) => ({ ...f, grado: e.target.value }))}
                                    className="mt-1 w-full h-11 px-3 rounded-xl border border-slate-200 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400">
                                    <option value="">Todos</option>
                                    {grados.map((g) => (
                                        <option key={g.value} value={g.value}>{g.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                            <p className="text-[11px] text-slate-400">
                                {loading ? "Buscando…" : `${rows.length} docente${rows.length === 1 ? "" : "s"}${hayFiltros ? " con el filtro aplicado" : ""}`}
                            </p>
                            <div className="flex gap-2">
                                {hayFiltros && (
                                    <button type="button" onClick={limpiar}
                                        className="inline-flex items-center gap-1.5 px-4 h-10 rounded-full text-sm font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                                        <X className="w-4 h-4" /> Limpiar
                                    </button>
                                )}
                                <button type="submit" disabled={loading}
                                    className="inline-flex items-center gap-2 px-6 h-10 rounded-full bg-blue-950 text-white text-sm font-extrabold hover:bg-blue-900 hover:scale-[1.03] transition-all duration-300 shadow-lg shadow-blue-950/25 disabled:opacity-60">
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                    Buscar
                                </button>
                            </div>
                        </div>
                    </form>
                </Reveal>
            </div>

            {/* ── Directorio ── */}
            <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-20">
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
                ) : rows.length === 0 ? (
                    <Reveal className="text-center py-16">
                        <div className="h-16 w-16 rounded-3xl bg-slate-100 grid place-items-center mx-auto mb-4">
                            <UserRound className="h-7 w-7 text-slate-300" />
                        </div>
                        <p className="text-slate-600 font-bold">Sin resultados</p>
                        <p className="text-sm text-slate-400 mt-1">
                            Prueba con otro filtro o límpialos para ver a toda la plana docente.
                        </p>
                    </Reveal>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
                        {rows.map((t, i) => (
                            <Reveal key={t.id} delay={Math.min(i, 7) * 70}
                                className="pv-lift group bg-white rounded-3xl ring-1 ring-slate-200/70 shadow-sm p-5 flex flex-col items-center text-center">
                                <div className="h-28 w-28 rounded-2xl overflow-hidden ring-1 ring-slate-200 bg-slate-50 grid place-items-center">
                                    {t.foto_url ? (
                                        <img src={t.foto_url} alt={t.nombre} loading="lazy"
                                            className="h-full w-full object-cover" />
                                    ) : (
                                        <UserRound className="h-10 w-10 text-slate-300" />
                                    )}
                                </div>
                                <p className="pv-display mt-4 text-[13px] font-extrabold text-slate-800 leading-snug">
                                    {t.nombre}
                                </p>
                                {t.grado_label && (
                                    <span className="mt-1.5 inline-flex px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-[10px] font-bold text-indigo-700 uppercase tracking-wide">
                                        {t.grado_label}
                                    </span>
                                )}
                                {t.especialidad && (
                                    <p className="mt-1.5 text-[11px] text-slate-400 leading-snug pv-clamp2">
                                        {t.especialidad}
                                    </p>
                                )}
                                {t.cursos?.length > 0 && (
                                    <p className="mt-2 text-[10.5px] text-slate-500 leading-snug pv-clamp2"
                                        title={t.cursos.join(" · ")}>
                                        <BookOpen className="inline w-3 h-3 -mt-0.5 mr-1 text-slate-300" />
                                        {t.cursos.slice(0, 2).join(" · ")}
                                        {t.cursos.length > 2 && ` +${t.cursos.length - 2}`}
                                    </p>
                                )}
                                <button type="button" onClick={() => setCvDocente(t)}
                                    className="mt-4 inline-flex items-center gap-1.5 px-4 h-9 rounded-full bg-blue-950 text-white text-[12px] font-extrabold hover:bg-blue-900 hover:scale-[1.04] transition-all duration-300 shadow-md shadow-blue-950/20">
                                    <FileText className="w-3.5 h-3.5" /> Currículum
                                </button>
                            </Reveal>
                        ))}
                    </div>
                )}
            </main>

            {/* ── Vista previa del currículum ── */}
            {cvDocente && createPortal(
                <div className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
                    onClick={() => setCvDocente(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden"
                        onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b bg-slate-50">
                            <div className="min-w-0">
                                <h3 className="font-extrabold text-slate-800 text-sm truncate">
                                    {cvDocente.nombre}
                                </h3>
                                <p className="text-[11px] text-slate-500 truncate">
                                    Hoja de vida documentada — transparencia MINEDU
                                </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <a href={`${cvUrl(cvDocente)}?inline=1`} target="_blank" rel="noreferrer"
                                    title="Abrir en una pestaña nueva"
                                    className="inline-flex items-center justify-center h-9 w-9 rounded-lg hover:bg-slate-200 text-slate-600">
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                                <a href={cvUrl(cvDocente)} title="Descargar PDF"
                                    className="inline-flex items-center justify-center h-9 w-9 rounded-lg hover:bg-slate-200 text-slate-600">
                                    <Download className="w-4 h-4" />
                                </a>
                                <button type="button" onClick={() => setCvDocente(null)} title="Cerrar"
                                    className="inline-flex items-center justify-center h-9 w-9 rounded-lg hover:bg-slate-200 text-slate-600">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 min-h-0 bg-slate-100">
                            {cvError ? (
                                <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-6">
                                    <FileText className="w-10 h-10 text-slate-300" />
                                    <p className="text-sm font-semibold text-slate-600">
                                        No se pudo cargar el currículum
                                    </p>
                                    <a href={`${cvUrl(cvDocente)}?inline=1`} target="_blank" rel="noreferrer"
                                        className="text-sm font-bold text-blue-700 hover:underline">
                                        Abrirlo en una pestaña nueva
                                    </a>
                                </div>
                            ) : !cvSrc ? (
                                <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400">
                                    <Loader2 className="w-7 h-7 animate-spin" />
                                    <p className="text-xs">Generando el currículum…</p>
                                </div>
                            ) : (
                                <object data={cvSrc} type="application/pdf"
                                    className="w-full h-full" aria-label="Currículum en PDF">
                                    <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-6">
                                        <p className="text-sm font-semibold text-slate-600">
                                            Tu navegador no puede mostrar el PDF aquí
                                        </p>
                                        <a href={`${cvUrl(cvDocente)}?inline=1`} target="_blank" rel="noreferrer"
                                            className="text-sm font-bold text-blue-700 hover:underline">
                                            Abrirlo en una pestaña nueva
                                        </a>
                                    </div>
                                </object>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            <footer className="bg-blue-950 border-t border-white/10 py-8 text-center">
                <p className="text-blue-200/60 text-xs">
                    © {new Date().getFullYear()} IESPP "Gustavo Allende Llavería" — Tarma ·
                    Hojas de vida publicadas en cumplimiento de las disposiciones de transparencia del MINEDU.
                </p>
            </footer>
        </div>
    );
}
