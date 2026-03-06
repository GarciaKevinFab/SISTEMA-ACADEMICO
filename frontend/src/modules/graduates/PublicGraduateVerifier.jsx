// src/modules/graduates/PublicGraduateVerifier.jsx
// Verificador Público de Grados y Títulos — IESPP "Gustavo Allende Llavería"
// UI inspirada en SUNEDU — 3 botones: Buscar · Descargar Constancia · Limpiar

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Graduates } from "../../services/graduates.service";

const MODES = { DNI: "dni", NAME: "name" };

/* ═══════════════════════════════════════════════════════════
   SVG Icons (inline, no deps)
   ═══════════════════════════════════════════════════════════ */
const I = {
    Search: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    X: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>,
    Download: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    Back: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>,
    Shield: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>,
    Info: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Warn: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>,
    Err: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>,
    Bldg: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" /></svg>,
    Spin: (p) => <svg {...p} viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>,
    Id: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm-1.875 6.375a4.5 4.5 0 00-4.125-2.976v3.601a.75.75 0 00.75.75h6.75a.75.75 0 00.75-.75v-3.601a4.5 4.5 0 00-4.125 2.976z" /></svg>,
    User: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>,
    Check: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>,
    Grad: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" /></svg>,
    File: (p) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>,
};

/* ═══════════════════════════════════════════════════════════
   GLOBAL CSS (injected once)
   ═══════════════════════════════════════════════════════════ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;1,9..40,400&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  --pgv-font: 'DM Sans', system-ui, -apple-system, sans-serif;
  --pgv-mono: 'JetBrains Mono', 'Courier New', monospace;
  --pgv-navy: #0B1D3A;
  --pgv-navy-l: #132B50;
  --pgv-blue: #2563EB;
  --pgv-blue-d: #1D4ED8;
  --pgv-emerald: #059669;
  --pgv-emerald-l: #10B981;
  --pgv-label: #546478;
  --pgv-radius: 16px;
}

.pgv * { box-sizing: border-box; font-family: var(--pgv-font); }

/* animations */
@keyframes pgv-up   { from { opacity:0; transform:translateY(18px) } to { opacity:1; transform:translateY(0) } }
@keyframes pgv-card { from { opacity:0; transform:translateY(12px) scale(.985) } to { opacity:1; transform:translateY(0) scale(1) } }
@keyframes pgv-fade { from { opacity:0 } to { opacity:1 } }
@keyframes pgv-shimmer {
  0% { background-position: -200% 0 }
  100% { background-position: 200% 0 }
}

/* input */
.pgv-input {
  width:100%; padding:13px 18px; border-radius:14px; border:2px solid #E2E8F0;
  font-size:16px; color:#1E293B; outline:none; background:#FAFBFC;
  font-family: var(--pgv-font);
  transition: border-color .2s, box-shadow .2s, background .2s;
}
.pgv-input:hover { border-color:#CBD5E1; background:#fff }
.pgv-input:focus { border-color:var(--pgv-blue); box-shadow:0 0 0 4px rgba(37,99,235,.08); background:#fff }
.pgv-input::placeholder { color:#A0AEC0 }
.pgv-input-mono { font-family: var(--pgv-mono); letter-spacing:.12em; font-size:17px }

/* buttons */
.pgv-btn {
  display:inline-flex; align-items:center; justify-content:center; gap:8px;
  padding:13px 24px; border-radius:14px; font-weight:700; font-size:15px;
  border:none; cursor:pointer; transition: all .2s; position:relative; overflow:hidden;
  -webkit-tap-highlight-color: transparent;
}
.pgv-btn:active { transform:scale(.97) }
.pgv-btn:disabled { opacity:.45; cursor:not-allowed; transform:none }
.pgv-btn:focus-visible { outline:3px solid rgba(37,99,235,.4); outline-offset:2px }

.pgv-btn-primary {
  color:#fff;
  background: linear-gradient(135deg, #2563EB 0%, #4F46E5 100%);
  box-shadow: 0 4px 14px rgba(37,99,235,.25), inset 0 1px 0 rgba(255,255,255,.1);
}
.pgv-btn-primary:hover:not(:disabled) { box-shadow: 0 6px 20px rgba(37,99,235,.35), inset 0 1px 0 rgba(255,255,255,.15); transform:translateY(-1px) }

.pgv-btn-success {
  color:#fff;
  background: linear-gradient(135deg, #059669 0%, #10B981 100%);
  box-shadow: 0 4px 14px rgba(5,150,105,.25), inset 0 1px 0 rgba(255,255,255,.1);
}
.pgv-btn-success:hover:not(:disabled) { box-shadow: 0 6px 20px rgba(5,150,105,.35), inset 0 1px 0 rgba(255,255,255,.15); transform:translateY(-1px) }
.pgv-btn-success:disabled { background:#94A3B8; box-shadow:none }

.pgv-btn-ghost {
  color:#64748B; background:#F1F5F9; border:1px solid #E2E8F0;
}
.pgv-btn-ghost:hover:not(:disabled) { background:#E2E8F0; color:#475569 }

/* tab */
.pgv-tab {
  position:relative; flex:1; display:inline-flex; align-items:center; justify-content:center; gap:8px;
  padding:14px 12px; font-size:14px; font-weight:600; border:none; cursor:pointer;
  background:transparent; transition: color .2s, background .2s;
  -webkit-tap-highlight-color: transparent;
}
.pgv-tab--on { color:#1D4ED8; background:#fff }
.pgv-tab--off { color:#78879A; background:transparent }
.pgv-tab--off:hover { color:#475569; background:rgba(255,255,255,.5) }
.pgv-tab__line {
  position:absolute; bottom:0; left:14px; right:14px; height:3px;
  background: linear-gradient(90deg, #2563EB, #6366F1);
  border-radius:3px 3px 0 0;
}

/* skeleton loader */
.pgv-skeleton {
  background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
  background-size: 200% 100%;
  animation: pgv-shimmer 1.5s infinite;
  border-radius: 8px;
}
`;

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

    useEffect(() => { inputRef.current?.focus(); }, [mode]);

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
        <div className="pgv" style={{ fontFamily: "var(--pgv-font)" }}>
            <style>{CSS}</style>

            <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#F8FAFC" }}>

                {/* ════════ HEADER ════════ */}
                <header style={{
                    background: "var(--pgv-navy)",
                    borderBottom: "1px solid rgba(255,255,255,.06)",
                    boxShadow: "0 4px 24px rgba(11,29,58,.4)",
                    position: "sticky", top: 0, zIndex: 50,
                }}>
                    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <a href="/" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
                            <img src="/logo.png" alt="Logo IESPP"
                                style={{ height: 44, width: 44, objectFit: "contain", filter: "drop-shadow(0 2px 4px rgba(0,0,0,.3))" }}
                                draggable="false"
                                onError={(e) => { e.target.style.display = "none"; }}
                            />
                            <div style={{ lineHeight: 1.3 }}>
                                <p style={{ color: "#fff", fontWeight: 800, fontSize: 15, margin: 0, letterSpacing: "-.01em" }}>
                                    IESPP Gustavo Allende Llavería
                                </p>
                                <p style={{ color: "rgba(147,197,253,.45)", fontSize: 10, margin: "2px 0 0", letterSpacing: ".18em", fontWeight: 700, textTransform: "uppercase" }}>
                                    Verificador de Grados y Títulos
                                </p>
                            </div>
                        </a>
                        <a href="/" style={{
                            display: "inline-flex", alignItems: "center", gap: 6,
                            color: "rgba(147,197,253,.55)", fontSize: 13, fontWeight: 600,
                            textDecoration: "none", transition: "color .2s",
                        }}
                            onMouseEnter={(e) => e.currentTarget.style.color = "#fff"}
                            onMouseLeave={(e) => e.currentTarget.style.color = "rgba(147,197,253,.55)"}>
                            <I.Back style={{ width: 16, height: 16 }} />
                            <span>Volver al inicio</span>
                        </a>
                    </div>
                </header>

                {/* ════════ HERO ════════ */}
                <div style={{ background: "var(--pgv-navy)", position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 20% 120%, rgba(99,102,241,.18) 0%, transparent 55%)" }} />
                    <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 80% -20%, rgba(14,165,233,.1) 0%, transparent 50%)" }} />
                    <div style={{
                        position: "absolute", inset: 0, opacity: .025,
                        backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40H0z' fill='none'/%3E%3Cpath d='M0 20h40M20 0v40' stroke='white' stroke-width='.3'/%3E%3C/svg%3E")`,
                    }} />

                    <div style={{ position: "relative", maxWidth: 1100, margin: "0 auto", padding: "44px 20px 56px", textAlign: "center" }}>
                        <div style={{
                            display: "inline-flex", padding: 18, borderRadius: 20,
                            background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.08)",
                            marginBottom: 20,
                        }}>
                            <I.Shield style={{ width: 44, height: 44, color: "rgba(147,197,253,.8)" }} />
                        </div>

                        <h1 style={{
                            fontSize: "clamp(1.6rem, 4vw, 2.5rem)",
                            fontWeight: 900, color: "#fff", margin: 0,
                            letterSpacing: "-.02em", lineHeight: 1.15,
                        }}>
                            Verificador de Grados y Títulos
                        </h1>
                        <p style={{
                            marginTop: 14, color: "rgba(148,163,184,.6)",
                            fontSize: "clamp(.85rem, 2vw, .95rem)",
                            maxWidth: 520, marginLeft: "auto", marginRight: "auto",
                            lineHeight: 1.6,
                        }}>
                            Consulte si un egresado se encuentra registrado en el Instituto de Educación
                            Superior Pedagógico Público "Gustavo Allende Llavería"
                        </p>
                    </div>

                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 36, background: "linear-gradient(transparent, #F8FAFC)" }} />
                </div>

                {/* ════════ MAIN ════════ */}
                <main style={{ flex: 1, position: "relative", zIndex: 10, marginTop: -12 }}>
                    <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px 64px" }}>

                        {/* ──── SEARCH CARD ──── */}
                        <div style={{
                            background: "#fff", borderRadius: "var(--pgv-radius)",
                            boxShadow: "0 4px 24px rgba(15,23,42,.06), 0 1px 3px rgba(15,23,42,.04)",
                            border: "1px solid rgba(226,232,240,.8)",
                            overflow: "hidden",
                        }}>
                            {/* tabs */}
                            <div style={{ display: "flex", borderBottom: "1px solid #F1F5F9", background: "#FAFBFC" }}>
                                {[
                                    { key: MODES.DNI, label: "Documento de Identidad", short: "DNI", Icon: I.Id },
                                    { key: MODES.NAME, label: "Apellidos y Nombres", short: "Nombres", Icon: I.User },
                                ].map(({ key, label, short, Icon }) => (
                                    <button key={key} type="button" onClick={() => switchMode(key)}
                                        className={`pgv-tab ${mode === key ? "pgv-tab--on" : "pgv-tab--off"}`}>
                                        <Icon style={{ width: 16, height: 16, flexShrink: 0, opacity: mode === key ? 1 : .4 }} />
                                        <span className="pgv-hide-sm">{label}</span>
                                        <span className="pgv-show-sm">{short}</span>
                                        {mode === key && <span className="pgv-tab__line" />}
                                    </button>
                                ))}
                            </div>

                            {/* form */}
                            <div style={{ padding: "28px 28px 32px" }}>
                                {mode === MODES.DNI ? (
                                    <div>
                                        <label htmlFor="pgv-dni" style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#475569", marginBottom: 10 }}>
                                            Número de Documento de Identidad (DNI)
                                        </label>
                                        <input ref={inputRef} id="pgv-dni" type="text" inputMode="numeric" maxLength={8}
                                            value={dni} onChange={(e) => setDni(e.target.value.replace(/\D/g, ""))}
                                            onKeyDown={onKey} placeholder="Ej: 72611344" autoComplete="off"
                                            className="pgv-input pgv-input-mono" />
                                        <p style={{ marginTop: 8, fontSize: 12, color: "#78879A", fontWeight: 500 }}>
                                            Ingrese los 8 dígitos de su Documento Nacional de Identidad
                                        </p>
                                    </div>
                                ) : (
                                    <div>
                                        <label htmlFor="pgv-name" style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#475569", marginBottom: 10 }}>
                                            Apellidos y/o Nombres
                                        </label>
                                        <input ref={inputRef} id="pgv-name" type="text"
                                            value={fullName} onChange={(e) => setFullName(e.target.value)}
                                            onKeyDown={onKey} placeholder="Ej: ARAUJO MENDOZA" autoComplete="off"
                                            className="pgv-input" />
                                        <p style={{ marginTop: 8, fontSize: 12, color: "#78879A", fontWeight: 500 }}>
                                            Puede buscar por apellidos, nombres, o ambos
                                        </p>
                                    </div>
                                )}

                                {/* error */}
                                {error && (
                                    <div style={{
                                        marginTop: 16, display: "flex", alignItems: "flex-start", gap: 10,
                                        padding: "12px 16px", borderRadius: 12,
                                        background: "#FEF2F2", border: "1px solid #FECACA",
                                        animation: "pgv-up .25s ease-out",
                                    }} role="alert">
                                        <I.Err style={{ width: 18, height: 18, flexShrink: 0, marginTop: 1, color: "#EF4444" }} />
                                        <span style={{ fontSize: 14, color: "#B91C1C", fontWeight: 500, lineHeight: 1.5 }}>{error}</span>
                                    </div>
                                )}

                                {/* ════ 3 BOTONES ════ */}
                                <div style={{ marginTop: 24, display: "flex", flexWrap: "wrap", gap: 10 }}>
                                    <button type="button" onClick={handleSearch} disabled={loading}
                                        className="pgv-btn pgv-btn-primary"
                                        style={{ flex: "1 1 160px", fontSize: 15 }}>
                                        {loading
                                            ? <><I.Spin style={{ width: 18, height: 18 }} className="animate-spin" /> Buscando…</>
                                            : <><I.Search style={{ width: 18, height: 18 }} /> Buscar</>
                                        }
                                    </button>

                                    <button type="button" onClick={handleDownloadFirst}
                                        disabled={!canDL || isDL}
                                        className="pgv-btn pgv-btn-success"
                                        style={{ flex: "1 1 180px", fontSize: 15 }}
                                        title={
                                            !results ? "Primero realice una búsqueda"
                                                : results.length === 0 ? "No se encontraron resultados"
                                                    : results.length > 1 ? "Descargue desde cada resultado"
                                                        : "Descargar Constancia de Inscripción"
                                        }>
                                        {isDL
                                            ? <><I.Spin style={{ width: 18, height: 18 }} className="animate-spin" /> Generando…</>
                                            : <><I.Download style={{ width: 17, height: 17 }} /> Descargar Constancia</>
                                        }
                                    </button>

                                    <button type="button" onClick={handleClear} disabled={loading}
                                        className="pgv-btn pgv-btn-ghost"
                                        style={{ flex: "0 1 auto", minWidth: 120 }}>
                                        <I.X style={{ width: 16, height: 16 }} /> Limpiar
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* ──── LOADING STATE ──── */}
                        {loading && (
                            <div style={{ marginTop: 32, animation: "pgv-fade .3s ease-out" }}>
                                <LoadingSkeleton />
                            </div>
                        )}

                        {/* ──── RESULTS ──── */}
                        {!loading && results !== null && (
                            <div ref={resultsRef} style={{ marginTop: 32, scrollMarginTop: 100, animation: "pgv-up .35s ease-out" }}>
                                {results.length === 0 ? (
                                    <div style={{
                                        background: "#fff", borderRadius: "var(--pgv-radius)",
                                        boxShadow: "0 4px 20px rgba(15,23,42,.05)",
                                        border: "1px solid rgba(226,232,240,.8)",
                                        padding: "44px 32px", textAlign: "center",
                                    }}>
                                        <div style={{
                                            display: "inline-flex", padding: 16, borderRadius: 20,
                                            background: "#FFFBEB", marginBottom: 16,
                                        }}>
                                            <I.Warn style={{ width: 40, height: 40, color: "#F59E0B" }} />
                                        </div>
                                        <h3 style={{ fontSize: 18, fontWeight: 800, color: "#1E293B", margin: "0 0 8px" }}>
                                            No se encontraron resultados
                                        </h3>
                                        <p style={{ fontSize: 14, color: "#546478", maxWidth: 400, margin: "0 auto", lineHeight: 1.6, fontWeight: 500 }}>
                                            No se encontraron registros que coincidan con los datos ingresados.
                                            Verifique la información e intente nuevamente.
                                        </p>
                                    </div>
                                ) : (
                                    <div>
                                        {/* results header */}
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px", marginBottom: 16 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                <div style={{
                                                    display: "inline-flex", padding: 6, borderRadius: 10,
                                                    background: "#EFF6FF",
                                                }}>
                                                    <I.Check style={{ width: 18, height: 18, color: "#2563EB" }} />
                                                </div>
                                                <h2 style={{ fontSize: 16, fontWeight: 800, color: "#1E293B", margin: 0 }}>
                                                    Resultados de la búsqueda
                                                </h2>
                                            </div>
                                            <span style={{
                                                fontSize: 13, color: "#546478", fontWeight: 600,
                                                fontVariantNumeric: "tabular-nums",
                                            }}>
                                                {results.length} registro{results.length !== 1 ? "s" : ""}
                                            </span>
                                        </div>

                                        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                            {results.map((grad, idx) => (
                                                <GraduateCard
                                                    key={grad.id || idx}
                                                    graduate={grad}
                                                    index={idx}
                                                    downloading={downloadingId === grad.id}
                                                    onDownload={() => handleDownload(grad)}
                                                    showCardDownload={results.length > 1}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ──── INFO NOTE ──── */}
                        <div style={{
                            marginTop: 40, padding: "20px 24px", borderRadius: "var(--pgv-radius)",
                            background: "#EFF6FF", border: "1px solid #BFDBFE",
                            display: "flex", alignItems: "flex-start", gap: 14,
                        }}>
                            <I.Info style={{ width: 20, height: 20, flexShrink: 0, marginTop: 2, color: "#3B82F6" }} />
                            <div style={{ fontSize: 13, color: "rgba(30,64,175,.65)", lineHeight: 1.65 }}>
                                <p style={{ fontWeight: 800, color: "#1E40AF", fontSize: 13, margin: "0 0 6px" }}>
                                    Información importante
                                </p>
                                <p style={{ margin: "0 0 8px", fontWeight: 500 }}>
                                    Este sistema permite verificar la autenticidad de grados y títulos expedidos
                                    por el IESPP "Gustavo Allende Llavería". La constancia de inscripción es un
                                    documento oficial que certifica el registro del grado o título.
                                </p>
                                <p style={{ margin: 0, fontWeight: 500 }}>
                                    Si presenta alguna observación en sus datos, comuníquese con la Secretaría
                                    Académica al correo{" "}
                                    <a href="mailto:secretariaacademica@iesppallende.edu.pe"
                                        style={{ fontWeight: 700, color: "#1D4ED8", textDecoration: "none" }}
                                        onMouseEnter={(e) => e.target.style.textDecoration = "underline"}
                                        onMouseLeave={(e) => e.target.style.textDecoration = "none"}>
                                        secretariaacademica@iesppallende.edu.pe
                                    </a>
                                    {" "}o al teléfono{" "}
                                    <a href="tel:+5164621199"
                                        style={{ fontWeight: 700, color: "#1D4ED8", textDecoration: "none" }}>
                                        (064) 621199
                                    </a>.
                                </p>
                            </div>
                        </div>
                    </div>
                </main>

                {/* ════════ FOOTER ════════ */}
                <footer style={{
                    background: "var(--pgv-navy)",
                    borderTop: "1px solid rgba(255,255,255,.06)",
                    marginTop: "auto",
                }}>
                    <div style={{
                        maxWidth: 1100, margin: "0 auto", padding: "28px 20px",
                        display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8,
                    }}>
                        <p style={{ color: "rgba(148,163,184,.35)", fontSize: 13, margin: 0, fontWeight: 500 }}>
                            © {new Date().getFullYear()} IESPP "Gustavo Allende Llavería" — Tarma, Junín
                        </p>
                        <p style={{ color: "rgba(148,163,184,.25)", fontSize: 12, margin: 0, fontWeight: 500 }}>
                            Verificador de Grados y Títulos
                        </p>
                    </div>
                </footer>
            </div>

            {/* responsive helpers */}
            <style>{`
                @media(max-width:639px) {
                    .pgv-hide-sm { display:none !important }
                    .pgv-show-sm { display:inline !important }
                }
                @media(min-width:640px) {
                    .pgv-show-sm { display:none !important }
                }
            `}</style>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════
   GRADUATE CARD
   ═══════════════════════════════════════════════════════════ */
const GraduateCard = ({ graduate: g, index, downloading, onDownload, showCardDownload }) => {
    const gradoDisplay = g.grado_titulo || `PROFESOR(A) EN ${g.especialidad || "EDUCACIÓN"}`;

    return (
        <div style={{
            background: "#fff", borderRadius: "var(--pgv-radius)",
            border: "1px solid rgba(226,232,240,.8)",
            overflow: "hidden",
            boxShadow: "0 2px 12px rgba(15,23,42,.04)",
            animation: `pgv-card .4s ease-out ${index * 80}ms both`,
            transition: "box-shadow .3s, transform .3s",
        }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 8px 30px rgba(15,23,42,.08)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 2px 12px rgba(15,23,42,.04)"; e.currentTarget.style.transform = "translateY(0)"; }}
        >
            {/* ── card header ── */}
            <div style={{
                position: "relative", overflow: "hidden",
                padding: "18px 24px",
                background: "linear-gradient(135deg, #1E3A6E 0%, #2E1065 100%)",
            }}>
                <div style={{
                    position: "absolute", inset: 0, opacity: .04,
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='24' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='2' cy='2' r='1' fill='white'/%3E%3C/svg%3E")`,
                    backgroundSize: "24px 24px",
                }} />

                <div style={{ position: "relative", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{
                            color: "#fff", fontWeight: 800,
                            fontSize: "clamp(1rem, 2.5vw, 1.15rem)",
                            margin: 0, lineHeight: 1.3, wordBreak: "break-word",
                        }}>
                            {g.apellidos_nombres}
                        </p>
                        {g.dni && (
                            <p style={{
                                color: "rgba(191,219,254,.7)", fontSize: 13, margin: "5px 0 0",
                                fontFamily: "var(--pgv-mono)", letterSpacing: ".08em",
                            }}>
                                DNI {g.dni}
                            </p>
                        )}
                    </div>

                    {/* badge */}
                    <span style={{
                        flexShrink: 0, padding: "6px 14px", borderRadius: 12,
                        background: "rgba(255,255,255,.12)", backdropFilter: "blur(8px)",
                        border: "1px solid rgba(255,255,255,.08)",
                        color: "#fff", fontSize: 11, fontWeight: 800,
                        textTransform: "uppercase", letterSpacing: ".04em",
                        textAlign: "center", maxWidth: 200, lineHeight: 1.35,
                    }}>
                        {gradoDisplay}
                    </span>
                </div>
            </div>

            {/* ── card body ── */}
            <div style={{ padding: "20px 24px 24px" }}>
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                    gap: "16px 32px",
                }}>
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
                <div style={{
                    marginTop: 20, paddingTop: 16,
                    borderTop: "1px solid #E8ECF1",
                    display: "flex", alignItems: "center", gap: 10,
                }}>
                    <I.Bldg style={{ width: 15, height: 15, color: "#546478", flexShrink: 0 }} />
                    <div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "#334155", margin: 0 }}>
                            IESPP "GUSTAVO ALLENDE LLAVERÍA"
                        </p>
                        <p style={{ fontSize: 11, color: "#546478", margin: "2px 0 0", fontWeight: 500 }}>
                            Tarma — Junín — Perú
                        </p>
                    </div>
                </div>

                {/* download per-card (multi results) */}
                {showCardDownload && (
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #E8ECF1" }}>
                        <button type="button" onClick={onDownload} disabled={downloading}
                            className="pgv-btn pgv-btn-success"
                            style={{ width: "100%", fontSize: 14 }}>
                            {downloading
                                ? <><I.Spin style={{ width: 17, height: 17 }} className="animate-spin" /> Generando PDF…</>
                                : <><I.File style={{ width: 17, height: 17 }} /> Descargar Constancia de Inscripción</>
                            }
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════
   FIELD ROW — labels oscurecidos para legibilidad
   ═══════════════════════════════════════════════════════════ */
const Field = ({ label, value }) => {
    if (!value) return null;
    return (
        <div>
            <p style={{
                fontSize: 11, fontWeight: 700, color: "#546478",
                textTransform: "uppercase", letterSpacing: ".05em",
                margin: "0 0 4px",
            }}>
                {label}
            </p>
            <p style={{
                fontSize: 14, fontWeight: 600, color: "#1E293B",
                margin: 0, lineHeight: 1.4,
            }}>
                {value}
            </p>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════
   LOADING SKELETON
   ═══════════════════════════════════════════════════════════ */
const LoadingSkeleton = () => (
    <div style={{
        background: "#fff", borderRadius: "var(--pgv-radius)",
        border: "1px solid rgba(226,232,240,.8)",
        overflow: "hidden",
        boxShadow: "0 2px 12px rgba(15,23,42,.04)",
    }}>
        <div style={{ padding: "18px 24px", background: "#E2E8F0" }}>
            <div className="pgv-skeleton" style={{ width: "55%", height: 20, marginBottom: 8 }} />
            <div className="pgv-skeleton" style={{ width: "25%", height: 14 }} />
        </div>
        <div style={{ padding: "20px 24px 24px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 32px" }}>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i}>
                        <div className="pgv-skeleton" style={{ width: "40%", height: 10, marginBottom: 6 }} />
                        <div className="pgv-skeleton" style={{ width: `${50 + (i % 3) * 15}%`, height: 16 }} />
                    </div>
                ))}
            </div>
        </div>
    </div>
);

export default PublicGraduateVerifier;