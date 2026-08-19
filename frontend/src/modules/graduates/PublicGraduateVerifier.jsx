// src/modules/graduates/PublicGraduateVerifier.jsx
// Verificador Público de Grados y Títulos — IESPP "Gustavo Allende Llavería"
// Rediseño estilo "Apple" con el kit compartido publicFx (misma lógica y endpoints).
// 3 acciones: Buscar · Descargar Constancia · Limpiar

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Graduates } from "../../services/graduates.service";
import { InjectPublicStyles, Reveal, HeroFade, PublicHeader } from "@/components/public/publicFx";

const MODES = { DNI: "dni", NAME: "name" };

/* ═══════════════════════════════════════════════════════════
   SVG Icons (inline, no deps)
   ═══════════════════════════════════════════════════════════ */
const I = {
    Search: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    X: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>,
    Download: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    Shield: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>,
    Info: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Warn: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>,
    Err: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>,
    Bldg: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" /></svg>,
    Spin: (p) => <svg {...p} viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>,
    Id: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm-1.875 6.375a4.5 4.5 0 00-4.125-2.976v3.601a.75.75 0 00.75.75h6.75a.75.75 0 00.75-.75v-3.601a4.5 4.5 0 00-4.125 2.976z" /></svg>,
    User: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>,
    Check: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>,
    File: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>,
};

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */
const PublicGraduateVerifier = () => {
    const [mode, setMode] = useState(MODES.DNI);
    const [dni, setDni] = useState("");
    const [fullName, setFullName] = useState("");
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [downloadingId, setDownloadingId] = useState(null);
    const [searched, setSearched] = useState(false);

    const inputRef = useRef(null);
    const resultsRef = useRef(null);
    const autoSearchRef = useRef(false);

    useEffect(() => { inputRef.current?.focus(); }, [mode]);

    /* ── auto-búsqueda al llegar desde un QR (?dni=XXXXXXXX) ── */
    useEffect(() => {
        const qdni = (new URLSearchParams(window.location.search).get("dni") || "").replace(/\D/g, "");
        if (/^\d{8}$/.test(qdni)) {
            autoSearchRef.current = true;
            setMode(MODES.DNI);
            setDni(qdni);
        }
    }, []);

    useEffect(() => {
        if (results?.length > 0 && resultsRef.current) {
            const t = setTimeout(() => resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" }), 200);
            return () => clearTimeout(t);
        }
    }, [results]);

    /* ── search ── */
    const handleSearch = useCallback(async () => {
        setError("");
        setResults(null);

        if (mode === MODES.DNI) {
            const c = dni.trim();
            if (!c) return setError("Ingrese un número de documento de identidad.");
            if (!/^\d{8}$/.test(c)) return setError("El DNI debe tener exactamente 8 dígitos numéricos.");
        } else {
            const t = fullName.trim();
            if (!t) return setError("Ingrese apellidos y/o nombres para buscar.");
            if (t.length < 3) return setError("Ingrese al menos 3 caracteres para la búsqueda.");
        }

        setLoading(true);
        setSearched(true);
        try {
            const params = mode === MODES.DNI ? { dni: dni.trim() } : { nombre: fullName.trim() };
            const data = await Graduates.search(params);
            setResults(data.results);
        } catch (err) {
            setError(err?.response?.data?.detail || err.message || "No se pudo conectar con el servidor. Intente más tarde.");
        } finally {
            setLoading(false);
        }
    }, [mode, dni, fullName]);

    /* dispara la búsqueda automática cuando el DNI del QR ya está en el estado */
    useEffect(() => {
        if (autoSearchRef.current && mode === MODES.DNI && /^\d{8}$/.test(dni)) {
            autoSearchRef.current = false;
            handleSearch();
        }
    }, [dni, mode, handleSearch]);

    /* ── clear ── */
    const handleClear = () => {
        setDni("");
        setFullName("");
        setResults(null);
        setError("");
        setSearched(false);
        setTimeout(() => inputRef.current?.focus(), 60);
    };

    /* ── download ── */
    const handleDownload = async (graduate) => {
        setDownloadingId(graduate.id);
        try {
            const res = await Graduates.downloadConstancia(graduate.id);
            const blob = res.data instanceof Blob ? res.data : new Blob([res.data], { type: "application/pdf" });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Constancia_Inscripcion_${graduate.dni || graduate.id}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            setError(err.message || "Error al descargar la constancia.");
        } finally {
            setDownloadingId(null);
        }
    };

    const handleDownloadFirst = () => {
        if (results?.length === 1) handleDownload(results[0]);
    };

    const onKey = (e) => { if (e.key === "Enter") handleSearch(); };
    const switchMode = (m) => { if (m !== mode) { setMode(m); setError(""); setResults(null); setSearched(false); } };

    const canDL = results?.length === 1;
    const isDL = downloadingId !== null;

    return (
        <div className="pv-font min-h-screen flex flex-col bg-slate-50 text-slate-900">
            <InjectPublicStyles />
            <PublicHeader active="/public/verificador" />

            {/* ════════ HERO (compacto, azul profundo + acento esmeralda) ════════ */}
            <section className="relative overflow-hidden bg-blue-950">
                <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
                    <div className="absolute -top-32 right-[-10%] w-[34rem] h-[34rem] rounded-full bg-emerald-500/15 blur-3xl pv-glow" />
                    <div className="absolute -bottom-40 left-[-12%] w-[36rem] h-[36rem] rounded-full bg-indigo-500/20 blur-3xl" />
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-20%,rgba(59,130,246,.22),transparent_60%)]" />
                </div>

                <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-20 sm:pt-20 sm:pb-24 text-center">
                    <HeroFade>
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-400/10 border border-emerald-300/20 mb-6">
                            <I.Shield className="w-4 h-4 text-emerald-300" />
                            <span className="text-emerald-200 text-[11px] sm:text-xs font-bold uppercase tracking-[0.16em]">
                                Verificación oficial
                            </span>
                        </div>

                        <h1 className="pv-display text-white font-extrabold leading-[1.05] text-4xl sm:text-5xl lg:text-6xl">
                            Verificador de
                            <span className="block bg-gradient-to-r from-emerald-300 via-teal-200 to-sky-300 bg-clip-text text-transparent">
                                Grados y Títulos
                            </span>
                        </h1>

                        <p className="mt-5 max-w-2xl mx-auto text-blue-100/70 text-sm sm:text-base leading-relaxed">
                            Consulte si un egresado se encuentra registrado en el Instituto de Educación
                            Superior Pedagógico Público "Gustavo Allende Llavería".
                        </p>
                    </HeroFade>
                </div>

                <div aria-hidden="true" className="absolute bottom-0 inset-x-0 h-14 bg-gradient-to-b from-transparent to-slate-50" />
            </section>

            {/* ════════ MAIN ════════ */}
            <main className="relative z-10 flex-1 -mt-10">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-20">

                    {/* ──── SEARCH CARD (tarjeta central prominente) ──── */}
                    <Reveal variant="scale">
                        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_24px_60px_-24px_rgba(2,6,23,.25)] overflow-hidden">
                            {/* tabs */}
                            <div className="flex border-b border-slate-100 bg-slate-50/70">
                                {[
                                    { key: MODES.DNI, label: "Documento de Identidad", short: "DNI", Icon: I.Id },
                                    { key: MODES.NAME, label: "Apellidos y Nombres", short: "Nombres", Icon: I.User },
                                ].map(({ key, label, short, Icon }) => (
                                    <button key={key} type="button" onClick={() => switchMode(key)}
                                        className={"relative flex-1 inline-flex items-center justify-center gap-2 px-3 py-4 text-sm font-semibold transition-colors " +
                                            (mode === key
                                                ? "text-blue-900 bg-white"
                                                : "text-slate-400 hover:text-slate-600 hover:bg-white/60")}>
                                        <Icon className={"w-4 h-4 flex-shrink-0 " + (mode === key ? "opacity-100" : "opacity-40")} />
                                        <span className="hidden sm:inline">{label}</span>
                                        <span className="sm:hidden">{short}</span>
                                        {mode === key && (
                                            <span className="absolute bottom-0 left-4 right-4 h-[3px] rounded-t bg-gradient-to-r from-blue-600 to-emerald-500" />
                                        )}
                                    </button>
                                ))}
                            </div>

                            {/* form */}
                            <div className="px-5 py-7 sm:px-8 sm:py-8">
                                {mode === MODES.DNI ? (
                                    <div>
                                        <label htmlFor="pgv-dni" className="block text-[13px] font-bold text-slate-600 mb-2.5">
                                            Número de Documento de Identidad (DNI)
                                        </label>
                                        <input ref={inputRef} id="pgv-dni" type="text" inputMode="numeric" maxLength={8}
                                            value={dni} onChange={(e) => setDni(e.target.value.replace(/\D/g, ""))}
                                            onKeyDown={onKey} placeholder="Ej: 72611344" autoComplete="off"
                                            className="w-full px-5 py-3.5 rounded-2xl border-2 border-slate-200 bg-slate-50/60 text-slate-800 text-lg font-mono tracking-[0.12em] outline-none transition-all placeholder:text-slate-300 placeholder:tracking-normal hover:border-slate-300 hover:bg-white focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10" />
                                        <p className="mt-2 text-xs font-medium text-slate-400">
                                            Ingrese los 8 dígitos de su Documento Nacional de Identidad
                                        </p>
                                    </div>
                                ) : (
                                    <div>
                                        <label htmlFor="pgv-name" className="block text-[13px] font-bold text-slate-600 mb-2.5">
                                            Apellidos y/o Nombres
                                        </label>
                                        <input ref={inputRef} id="pgv-name" type="text"
                                            value={fullName} onChange={(e) => setFullName(e.target.value)}
                                            onKeyDown={onKey} placeholder="Ej: ARAUJO MENDOZA" autoComplete="off"
                                            className="w-full px-5 py-3.5 rounded-2xl border-2 border-slate-200 bg-slate-50/60 text-slate-800 text-base outline-none transition-all placeholder:text-slate-300 hover:border-slate-300 hover:bg-white focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10" />
                                        <p className="mt-2 text-xs font-medium text-slate-400">
                                            Puede buscar por apellidos, nombres, o ambos
                                        </p>
                                    </div>
                                )}

                                {/* error */}
                                {error && (
                                    <div role="alert"
                                        className="mt-4 flex items-start gap-2.5 px-4 py-3 rounded-2xl bg-rose-50 border border-rose-200">
                                        <I.Err className="w-[18px] h-[18px] flex-shrink-0 mt-0.5 text-rose-500" />
                                        <span className="text-sm font-medium leading-relaxed text-rose-700">{error}</span>
                                    </div>
                                )}

                                {/* ════ 3 BOTONES ════ */}
                                <div className="mt-6 flex flex-wrap gap-2.5">
                                    <button type="button" onClick={handleSearch} disabled={loading}
                                        className="flex-[1_1_160px] inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-[15px] font-bold text-white bg-gradient-to-br from-blue-700 to-blue-900 shadow-lg shadow-blue-900/25 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-900/30 active:scale-[.97] disabled:opacity-45 disabled:cursor-not-allowed disabled:transform-none focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-blue-600/40 focus-visible:outline-offset-2">
                                        {loading
                                            ? <><I.Spin className="w-[18px] h-[18px] animate-spin" /> Buscando…</>
                                            : <><I.Search className="w-[18px] h-[18px]" /> Buscar</>
                                        }
                                    </button>

                                    <button type="button" onClick={handleDownloadFirst}
                                        disabled={!canDL || isDL}
                                        className="flex-[1_1_180px] inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-[15px] font-bold text-white bg-gradient-to-br from-emerald-600 to-emerald-500 shadow-lg shadow-emerald-700/25 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-700/30 active:scale-[.97] disabled:opacity-45 disabled:cursor-not-allowed disabled:transform-none disabled:bg-slate-400 disabled:bg-none disabled:shadow-none focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-emerald-600/40 focus-visible:outline-offset-2"
                                        title={
                                            !results ? "Primero realice una búsqueda"
                                                : results.length === 0 ? "No se encontraron resultados"
                                                    : results.length > 1 ? "Descargue desde cada resultado"
                                                        : "Descargar Constancia de Inscripción"
                                        }>
                                        {isDL
                                            ? <><I.Spin className="w-[18px] h-[18px] animate-spin" /> Generando…</>
                                            : <><I.Download className="w-[17px] h-[17px]" /> Descargar Constancia</>
                                        }
                                    </button>

                                    <button type="button" onClick={handleClear} disabled={loading}
                                        className="flex-[0_1_auto] min-w-[120px] inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-[15px] font-bold text-slate-500 bg-slate-100 border border-slate-200 transition-colors hover:bg-slate-200 hover:text-slate-600 active:scale-[.97] disabled:opacity-45 disabled:cursor-not-allowed">
                                        <I.X className="w-4 h-4" /> Limpiar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </Reveal>

                    {/* ──── LOADING STATE ──── */}
                    {loading && (
                        <div className="mt-8">
                            <LoadingSkeleton />
                        </div>
                    )}

                    {/* ──── RESULTS ──── */}
                    {!loading && results !== null && (
                        <div ref={resultsRef} className="mt-8 scroll-mt-24">
                            {results.length === 0 ? (
                                <Reveal variant="up">
                                    <div className="bg-amber-50/80 rounded-2xl border border-amber-200 px-8 py-11 text-center">
                                        <div className="inline-flex p-4 rounded-2xl bg-amber-100/80 mb-4">
                                            <I.Warn className="w-10 h-10 text-amber-500" />
                                        </div>
                                        <h3 className="pv-display text-lg font-extrabold text-slate-800 mb-2">
                                            No se encontraron resultados
                                        </h3>
                                        <p className="text-sm font-medium leading-relaxed text-slate-500 max-w-sm mx-auto">
                                            No se encontraron registros que coincidan con los datos ingresados.
                                            Verifique la información e intente nuevamente.
                                        </p>
                                    </div>
                                </Reveal>
                            ) : (
                                <Reveal variant="up">
                                    {/* results header */}
                                    <div className="flex items-center justify-between px-1 mb-4">
                                        <div className="flex items-center gap-2.5">
                                            <span className="inline-flex p-1.5 rounded-full bg-emerald-100">
                                                <I.Check className="w-4 h-4 text-emerald-600" />
                                            </span>
                                            <h2 className="pv-display text-base font-extrabold text-slate-800">
                                                Resultados de la búsqueda
                                            </h2>
                                        </div>
                                        <span className="text-[13px] font-semibold text-slate-500 tabular-nums">
                                            {results.length} registro{results.length !== 1 ? "s" : ""}
                                        </span>
                                    </div>

                                    <div className="flex flex-col gap-4">
                                        {results.map((grad, idx) => (
                                            <Reveal key={grad.id || idx} variant="up" delay={idx * 90}>
                                                <GraduateCard
                                                    graduate={grad}
                                                    downloading={downloadingId === grad.id}
                                                    onDownload={() => handleDownload(grad)}
                                                    showCardDownload={results.length > 1}
                                                />
                                            </Reveal>
                                        ))}
                                    </div>
                                </Reveal>
                            )}
                        </div>
                    )}

                    {/* ──── INFO NOTE ──── */}
                    <Reveal variant="up" delay={120}>
                        <div className="mt-10 flex items-start gap-3.5 px-5 py-5 sm:px-6 rounded-2xl bg-blue-50/80 border border-blue-100">
                            <I.Info className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-500" />
                            <div className="text-[13px] leading-relaxed text-blue-900/60">
                                <p className="font-extrabold text-blue-900 mb-1.5">
                                    Información importante
                                </p>
                                <p className="font-medium mb-2">
                                    Este sistema permite verificar la autenticidad de grados y títulos expedidos
                                    por el IESPP "Gustavo Allende Llavería". La constancia de inscripción es un
                                    documento oficial que certifica el registro del grado o título.
                                </p>
                                <p className="font-medium">
                                    Si presenta alguna observación en sus datos, comuníquese con la Secretaría
                                    Académica al correo{" "}
                                    <a href="mailto:secretariaacademica@iesppallende.edu.pe"
                                        className="font-bold text-blue-700 hover:underline">
                                        secretariaacademica@iesppallende.edu.pe
                                    </a>
                                    {" "}o al teléfono{" "}
                                    <a href="tel:+5164621199" className="font-bold text-blue-700 hover:underline">
                                        (064) 621199
                                    </a>.
                                </p>
                            </div>
                        </div>
                    </Reveal>
                </div>
            </main>

            {/* ════════ FOOTER ════════ */}
            <footer className="mt-auto bg-blue-950 border-t border-white/10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[13px] font-medium text-blue-200/40 m-0">
                        © {new Date().getFullYear()} IESPP "Gustavo Allende Llavería" — Tarma, Junín
                    </p>
                    <p className="text-xs font-medium text-blue-200/30 m-0">
                        Verificador de Grados y Títulos
                    </p>
                </div>
            </footer>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════
   GRADUATE CARD — registro verificado (sello esmeralda)
   ═══════════════════════════════════════════════════════════ */
const GraduateCard = ({ graduate: g, downloading, onDownload, showCardDownload }) => {
    const gradoDisplay = g.grado_titulo || `PROFESOR(A) EN ${g.especialidad || "EDUCACIÓN"}`;

    return (
        <div className="pv-lift bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(15,23,42,.04)] overflow-hidden">
            {/* ── card header ── */}
            <div className="relative overflow-hidden px-5 py-5 sm:px-6 bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-950">
                <div aria-hidden="true" className="absolute -top-16 right-[-8%] w-56 h-56 rounded-full bg-emerald-400/10 blur-2xl" />

                <div className="relative flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
                    <div className="min-w-0 flex-1">
                        {/* sello de registro verificado */}
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-400/15 border border-emerald-300/25 mb-2.5">
                            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-400">
                                <I.Check className="w-2.5 h-2.5 text-blue-950" />
                            </span>
                            <span className="text-emerald-200 text-[10px] font-extrabold uppercase tracking-[0.14em]">
                                Registro verificado
                            </span>
                        </span>

                        <p className="pv-display text-white font-extrabold text-base sm:text-lg leading-tight break-words m-0">
                            {g.apellidos_nombres}
                        </p>
                        {g.dni && (
                            <p className="text-blue-200/70 text-[13px] font-mono tracking-[0.08em] mt-1 m-0">
                                DNI {g.dni}
                            </p>
                        )}
                    </div>

                    {/* badge grado/título */}
                    <span className="flex-shrink-0 max-w-[200px] px-3.5 py-1.5 rounded-xl bg-white/10 backdrop-blur border border-white/10 text-white text-[11px] font-extrabold uppercase tracking-wide text-center leading-snug">
                        {gradoDisplay}
                    </span>
                </div>
            </div>

            {/* ── card body ── */}
            <div className="px-5 pt-5 pb-6 sm:px-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                    <Field label="Grado / Título" value={gradoDisplay} />
                    <Field label="Especialidad" value={g.especialidad} />
                    <Field label="Año de Ingreso" value={g.anio_ingreso} />
                    <Field label="Año de Egreso" value={g.anio_egreso} />
                    {g.fecha_sustentacion && <Field label="Fecha de Sustentación" value={g.fecha_sustentacion} />}
                    {g.nivel && <Field label="Nivel" value={g.nivel} />}
                    {g.resolucion_acta && <Field label="Resolución / Acta" value={g.resolucion_acta} />}
                    {g.codigo_diploma && <Field label="Código de Diploma" value={g.codigo_diploma} />}
                    {g.registro_pedagogico && <Field label="Registro Pedagógico" value={g.registro_pedagogico} />}
                </div>

                {/* institution */}
                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-2.5">
                    <I.Bldg className="w-[15px] h-[15px] flex-shrink-0 text-slate-500" />
                    <div>
                        <p className="text-[13px] font-bold text-slate-700 m-0">
                            IESPP "GUSTAVO ALLENDE LLAVERÍA"
                        </p>
                        <p className="text-[11px] font-medium text-slate-500 mt-0.5 m-0">
                            Tarma — Junín — Perú
                        </p>
                    </div>
                </div>

                {/* download per-card (multi results) */}
                {showCardDownload && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                        <button type="button" onClick={onDownload} disabled={downloading}
                            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold text-white bg-gradient-to-br from-emerald-600 to-emerald-500 shadow-lg shadow-emerald-700/25 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-700/30 active:scale-[.97] disabled:opacity-45 disabled:cursor-not-allowed disabled:transform-none">
                            {downloading
                                ? <><I.Spin className="w-[17px] h-[17px] animate-spin" /> Generando PDF…</>
                                : <><I.File className="w-[17px] h-[17px]" /> Descargar Constancia de Inscripción</>
                            }
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════
   FIELD ROW
   ═══════════════════════════════════════════════════════════ */
const Field = ({ label, value }) => {
    if (!value) return null;
    return (
        <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 m-0">
                {label}
            </p>
            <p className="text-sm font-semibold leading-snug text-slate-800 m-0">
                {value}
            </p>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════
   LOADING SKELETON
   ═══════════════════════════════════════════════════════════ */
const LoadingSkeleton = () => (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(15,23,42,.04)] overflow-hidden">
        <div className="px-6 py-5 bg-slate-200/70">
            <div className="animate-pulse bg-slate-300/70 rounded-lg h-5 w-[55%] mb-2" />
            <div className="animate-pulse bg-slate-300/70 rounded-lg h-3.5 w-1/4" />
        </div>
        <div className="px-6 pt-5 pb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i}>
                        <div className="animate-pulse bg-slate-200 rounded h-2.5 w-2/5 mb-1.5" />
                        <div className="animate-pulse bg-slate-200 rounded h-4" style={{ width: `${50 + (i % 3) * 15}%` }} />
                    </div>
                ))}
            </div>
        </div>
    </div>
);

export default PublicGraduateVerifier;
