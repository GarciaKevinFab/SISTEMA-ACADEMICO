import React, { useEffect, useRef, useState } from "react";

const Landing = () => {
    const [menuOpen, setMenuOpen] = useState(false);
    const [activeSection, setActiveSection] = useState("");
    const drawerRef = useRef(null);

    // Cerrar con ESC
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "Escape") setMenuOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    // Bloquear scroll del body SOLO cuando el menú está abierto
    useEffect(() => {
        if (!menuOpen) return;

        const body = document.body;
        const scrollY = window.scrollY;
        body.dataset.scrollY = String(scrollY);

        body.style.position = "fixed";
        body.style.top = `-${scrollY}px`;
        body.style.left = "0";
        body.style.right = "0";
        body.style.width = "100%";
        body.style.overflow = "hidden";

        return () => {
            const y = Number(body.dataset.scrollY || "0");
            body.style.position = "";
            body.style.top = "";
            body.style.left = "";
            body.style.right = "";
            body.style.width = "";
            body.style.overflow = "";
            delete body.dataset.scrollY;
            window.scrollTo(0, y);
        };
    }, [menuOpen]);

    // Cerrar drawer al click fuera
    useEffect(() => {
        if (!menuOpen) return;
        const onClick = (e) => {
            if (!drawerRef.current) return;
            if (!drawerRef.current.contains(e.target)) setMenuOpen(false);
        };
        document.addEventListener("mousedown", onClick);
        document.addEventListener("touchstart", onClick, { passive: true });
        return () => {
            document.removeEventListener("mousedown", onClick);
            document.removeEventListener("touchstart", onClick);
        };
    }, [menuOpen]);

    // Active section por scroll
    useEffect(() => {
        const ids = ["inicio", "carreras", "admision", "contacto"];
        const els = ids
            .map((id) => document.getElementById(id))
            .filter(Boolean);

        if (!els.length) return;

        const obs = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter((e) => e.isIntersecting)
                    .sort((a, b) => (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0))[0];

                if (visible?.target?.id) setActiveSection(`#${visible.target.id}`);
            },
            {
                root: null,
                threshold: [0.2, 0.35, 0.5, 0.65],
                rootMargin: "-15% 0px -70% 0px",
            }
        );

        els.forEach((el) => obs.observe(el));
        return () => obs.disconnect();
    }, []);

    const handleNavClick = (href) => (e) => {
        const isExternal = /^https?:\/\//i.test(href);
        if (isExternal) return;

        e.preventDefault();
        const el = document.querySelector(href);
        if (!el) return;

        const headerOffset = 96;
        const top = el.getBoundingClientRect().top + window.scrollY - headerOffset;

        window.scrollTo({ top, behavior: "smooth" });
        setActiveSection(href);
        setMenuOpen(false);
    };

    const links = [
        ["https://iesppallende.edu.pe/", "Inicio"],
    ];

    const NavLinks = ({ isMobile = false }) => (
        <>
            {links.map(([href, label]) => {
                const active = activeSection === href;
                const base = "relative font-medium transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded-md tracking-wide";
                const desktop = "px-3 py-1.5 text-sm lg:text-[15px]";
                const mobile = "w-full px-4 py-3 rounded-xl text-lg";
                const color = "text-blue-100 hover:text-white";

                return (
                    <a
                        key={href}
                        href={href}
                        onClick={handleNavClick(href)}
                        className={[
                            base,
                            isMobile ? mobile : desktop,
                            color,
                            isMobile ? "hover:bg-white/10" : "",
                            active && !isMobile ? "text-white drop-shadow-md" : "",
                        ].join(" ")}
                    >
                        <span className="relative z-10">{label}</span>
                        {!isMobile && (
                            <>
                                <span className="absolute inset-0 rounded-md opacity-0 bg-white/10 transition-opacity duration-300 group-hover:opacity-100" />
                                <span
                                    className={[
                                        "pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-0 h-[2px] rounded-full transition-all duration-300 ease-out",
                                        active ? "w-4/5 bg-indigo-300 shadow-[0_0_8px_rgba(165,180,252,0.8)]" : "w-0 bg-white/0",
                                    ].join(" ")}
                                />
                            </>
                        )}
                    </a>
                );
            })}
        </>
    );

    // Iconos SVG helper para las carreras
    const CareerIcon = ({ type }) => {
        const icons = {
            "Comunicación": (
                <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
            ),
            "Educación Inicial": (
                <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
            "Educación Primaria": (
                <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
            ),
            "Educación Física": (
                <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
            )
        };
        return <div className="p-3 bg-indigo-50 rounded-lg inline-block mb-4">{icons[type] || icons["Educación Primaria"]}</div>;
    };

    return (
        <div className="h-[100dvh] bg-white flex flex-col overflow-y-auto overflow-x-hidden overscroll-contain font-sans selection:bg-indigo-100 selection:text-indigo-900">
            {/* Header / Navbar */}
            <header className="sticky top-0 z-50">
                <div className="bg-blue-950/90 backdrop-blur-md border-b border-white/10 shadow-lg">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex justify-between items-center py-3 sm:py-4">
                            {/* Brand */}
                            <a
                                href="https://iesppallende.edu.pe/"
                                className="flex items-center gap-3.5 min-w-0 group focus:outline-none"
                            >
                                <div className="relative">
                                    <div className="absolute inset-0 bg-white/20 blur-xl rounded-full opacity-0 group-hover:opacity-50 transition-opacity duration-500" />
                                    <img
                                        className="relative h-12 w-12 sm:h-14 sm:w-14 lg:h-16 lg:w-16 object-contain shrink-0 drop-shadow-md transform group-hover:scale-105 transition-transform duration-300"
                                        src="/logo.png"
                                        alt="Logo del Instituto"
                                        draggable="false"
                                    />
                                </div>
                                <div className="leading-tight min-w-0 flex flex-col justify-center">
                                    <h1 className="text-base sm:text-lg lg:text-xl font-bold text-white truncate tracking-tight">
                                        IESPP Gustavo Allende Llavería
                                    </h1>
                                    <p className="text-blue-200/80 text-[10px] sm:text-xs uppercase tracking-wider font-medium truncate">
                                        Sistema Académico Integral
                                    </p>
                                </div>
                            </a>

                            {/* Desktop nav */}
                            <nav className="hidden md:flex items-center gap-3">
                                <img
                                    src="/loguito.png"
                                    alt="Logotipo adicional"
                                    className="h-12 w-12 sm:h-14 sm:w-14 lg:h-16 lg:w-16 object-contain drop-shadow-md"
                                    draggable="false"
                                />
                                <div className="flex items-center gap-1 bg-white/5 rounded-full px-2 py-1 border border-white/5">
                                    <NavLinks />
                                </div>
                            </nav>

                            {/* Mobile button */}
                            <button
                                type="button"
                                className="md:hidden inline-flex items-center justify-center rounded-lg p-2 text-blue-100 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
                                onClick={() => setMenuOpen(true)}
                                aria-label="Abrir menú"
                            >
                                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Drawer */}
                {menuOpen && (
                    <div className="fixed inset-0 z-[60] md:hidden">
                        <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" onClick={() => setMenuOpen(false)} />

                        <div
                            ref={drawerRef}
                            className="absolute right-0 top-0 h-[100dvh] w-[85%] max-w-sm bg-blue-950 text-white shadow-2xl flex flex-col border-l border-white/10 transform transition-transform duration-300 ease-out"
                            role="dialog"
                            aria-modal="true"
                        >
                            <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between shrink-0 bg-blue-900/30">
                                <div className="flex items-center gap-3 min-w-0">
                                    <img className="h-9 w-9 object-contain shrink-0" src="/logo.png" alt="Logo" draggable="false" />
                                    <div className="min-w-0">
                                        <div className="font-bold leading-tight text-sm">IESPP</div>
                                        <div className="text-[10px] text-blue-200 leading-tight truncate uppercase tracking-wide">
                                            Gustavo Allende Llavería
                                        </div>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    className="rounded-lg p-2 text-blue-200 hover:text-white hover:bg-white/10 transition"
                                    onClick={() => setMenuOpen(false)}
                                    aria-label="Cerrar"
                                >
                                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <div
                                className="flex-1 overflow-y-auto px-5 py-6 space-y-6"
                                style={{
                                    WebkitOverflowScrolling: "touch",
                                    overscrollBehavior: "contain",
                                    touchAction: "pan-y",
                                }}
                            >
                                <nav className="flex flex-col gap-2">
                                    <NavLinks isMobile />
                                </nav>

                                <div className="pt-6 border-t border-white/10 space-y-3">
                                    <p className="text-xs text-blue-300 uppercase font-semibold tracking-wider px-2 mb-2">
                                        Accesos Directos
                                    </p>
                                    <a
                                        href="/public/admission"
                                        className="w-full inline-flex items-center justify-center px-4 py-3.5 rounded-xl bg-white text-indigo-900 font-bold hover:bg-indigo-50 transition-all shadow-lg active:scale-[0.98]"
                                        onClick={() => setMenuOpen(false)}
                                    >
                                        Admisión
                                    </a>

                                    {/* Mesa de Partes */}
                                    <a
                                        href="/public/procedures"
                                        className="w-full inline-flex items-center justify-center px-4 py-3.5 rounded-xl bg-white/10 text-white font-bold hover:bg-white/15 transition-all shadow-lg border border-white/20 active:scale-[0.98]"
                                        onClick={() => setMenuOpen(false)}
                                    >
                                        Mesa de Partes
                                    </a>

                                    {/* ✅ NUEVO: Verificador de Grados */}
                                    <a
                                        href="/public/verificador"
                                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-white/10 text-white font-bold hover:bg-white/15 transition-all shadow-lg border border-white/20 active:scale-[0.98]"
                                        onClick={() => setMenuOpen(false)}
                                    >
                                        <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                                        </svg>
                                        Verificar Grados y Títulos
                                    </a>

                                    <a
                                        href="/login"
                                        className="w-full inline-flex items-center justify-center px-4 py-3.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-900/20 active:scale-[0.98]"
                                        onClick={() => setMenuOpen(false)}
                                    >
                                        Acceso al Sistema
                                    </a>

                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </header>

            <main className="flex-1">
                {/* Hero Section */}
                <section
                    id="inicio"
                    className="relative bg-cover bg-center"
                    style={{
                        backgroundImage: "url('/gustavo_portada.png')",
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        backgroundRepeat: "no-repeat",
                    }}
                >
                    <div className="absolute inset-0 bg-gradient-to-b from-blue-950/80 via-blue-950/50 to-blue-950/90" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_rgba(0,0,0,0.4)_100%)]" />

                    <div className="relative z-10">
                        <div className="min-h-[calc(100dvh-80px)] sm:min-h-[calc(100dvh-85px)] flex items-center justify-center">
                            <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
                                <div className="max-w-4xl mx-auto text-center text-white">
                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 backdrop-blur-md mb-6">
                                        <span className="flex h-2 w-2 rounded-full bg-green-400 animate-pulse"></span>
                                        <span className="text-xs sm:text-sm font-medium text-blue-100">Admisión 2026 Abierta</span>
                                    </div>

                                    <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight drop-shadow-2xl space-y-2">
                                        <span className="block">Formando</span>
                                        <span className="block text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 via-white to-indigo-200 pb-2">
                                            Educadores de Excelencia
                                        </span>
                                    </h1>

                                    <p className="mt-6 text-base sm:text-xl lg:text-2xl text-blue-100 leading-relaxed max-w-2xl mx-auto drop-shadow-lg font-light">
                                        Instituto de Educación Superior Pedagógico Público "Gustavo Allende Llavería" —
                                        <span className="font-medium text-white"> comprometidos con la formación integral</span> de futuros docentes.
                                    </p>

                                    {/* ── Hero Buttons ── */}
                                    <div className="mt-10 flex flex-col sm:flex-row gap-4 sm:justify-center items-center">
                                        <a
                                            href="/public/admission"
                                            className="w-full sm:w-auto min-w-[200px] inline-flex items-center justify-center px-8 py-4 rounded-xl bg-white text-indigo-900 font-bold hover:bg-indigo-50 hover:scale-105 transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                                        >
                                            Admisión
                                        </a>

                                        <a
                                            href="/public/procedures"
                                            className="w-full sm:w-auto min-w-[200px] inline-flex items-center justify-center px-8 py-4 rounded-xl bg-white/10 text-white font-bold hover:bg-white/15 hover:scale-105 transition-all duration-300 shadow-lg border border-white/20 backdrop-blur-sm"
                                        >
                                            Mesa de Partes
                                        </a>

                                        <a
                                            href="/login"
                                            className="w-full sm:w-auto min-w-[200px] inline-flex items-center justify-center px-8 py-4 rounded-xl bg-indigo-600/90 backdrop-blur-sm text-white font-bold hover:bg-indigo-600 hover:scale-105 transition-all duration-300 shadow-lg border border-white/10"
                                        >
                                            Acceso al Sistema
                                        </a>
                                    </div>

                                    {/* ✅ NUEVO: Verificador link debajo de los botones principales */}
                                    <div className="mt-5 flex justify-center">
                                        <a
                                            href="/public/verificador"
                                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-500/15 border border-emerald-400/25 text-emerald-200 text-sm font-semibold hover:bg-emerald-500/25 hover:text-white transition-all duration-300 backdrop-blur-sm"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                                            </svg>
                                            Verificar Grados y Títulos
                                        </a>
                                    </div>

                                    <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
                                        {[
                                            ["39+", "Años de experiencia"],
                                            ["2,500+", "Egresados Exitosos"],
                                            ["98%", "Inserción laboral"],
                                        ].map(([num, label], idx) => (
                                            <div
                                                key={idx}
                                                className="group rounded-2xl bg-white/5 border border-white/10 px-6 py-5 backdrop-blur-md shadow-xl hover:bg-white/10 transition-colors duration-300"
                                            >
                                                <div className="text-3xl sm:text-4xl font-black tracking-tight text-white group-hover:scale-110 transition-transform duration-300 origin-center">{num}</div>
                                                <div className="text-sm font-medium text-blue-200 mt-1 uppercase tracking-wide">{label}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Programas de Estudio */}
                <section id="carreras" className="py-20 sm:py-24 bg-gray-50 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent"></div>
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center mb-16 max-w-3xl mx-auto">
                            <h2 className="text-sm font-bold text-indigo-600 tracking-widest uppercase mb-3">
                                Oferta Académica
                            </h2>
                            <p className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 tracking-tight">
                                Nuestros Programas de Estudio
                            </p>
                            <p className="mt-4 text-lg text-gray-600">
                                Diseñados para responder a los desafíos educativos del siglo XXI con innovación y calidad.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-8 sm:gap-8 md:grid-cols-2 lg:grid-cols-3">
                            {[
                                { title: "Comunicación", desc: "Forma docentes con enfoque en comunicación, lenguaje y habilidades expresivas." },
                                { title: "Educación Inicial", desc: "Especialízate en el desarrollo cognitivo y emocional de niños de 0 a 5 años." },
                                { title: "Educación Primaria", desc: "Lidera la enseñanza integral y pedagógica de niños de 6 a 12 años." },
                                { title: "Educación Física", desc: "Promueve la salud, el deporte y el bienestar físico en las instituciones educativas." },
                            ].map((c) => (
                                <div
                                    key={c.title}
                                    className="group bg-white rounded-2xl border border-gray-100 p-8 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-bl-[100px] -mr-4 -mt-4 transition-transform group-hover:scale-110" />

                                    <div className="relative">
                                        <CareerIcon type={c.title} />
                                        <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-indigo-700 transition-colors">
                                            {c.title}
                                        </h3>
                                        <p className="text-gray-600 leading-relaxed mb-6">
                                            {c.desc}
                                        </p>
                                        <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-50">
                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 uppercase tracking-wide">
                                                10 semestres
                                            </span>
                                            <span className="text-indigo-600 opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0 transition-all duration-300">
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                                </svg>
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Admisión CTA */}
                <section id="admision" className="relative bg-indigo-700 overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-600 via-indigo-700 to-indigo-800"></div>
                    <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>

                    <div className="relative max-w-4xl mx-auto text-center py-20 sm:py-28 px-4 sm:px-6 lg:px-8">
                        <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-6">
                            ¿Listo para transformar el futuro?
                        </h2>
                        <p className="text-lg sm:text-xl text-indigo-100 mb-10 max-w-2xl mx-auto leading-relaxed">
                            Únete a nuestra comunidad académica y forma parte de la nueva generación de educadores líderes.
                        </p>
                        <a
                            href="/public/admission"
                            className="inline-flex items-center justify-center px-8 py-4 rounded-xl bg-white text-indigo-700 font-bold text-lg hover:bg-indigo-50 hover:shadow-2xl hover:scale-105 transition-all duration-300"
                        >
                            Postular Ahora
                            <svg className="ml-2 -mr-1 w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                        </a>
                    </div>
                </section>

                {/* Contacto */}
                <section id="contacto" className="py-20 bg-blue-950 relative overflow-hidden">
                    <div className="absolute inset-0 bg-blue-900/10"></div>
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl font-extrabold text-white">Estamos aquí para ayudarte</h2>
                            <p className="mt-2 text-blue-200">Contáctanos o visítanos en nuestro campus.</p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                            <div className="rounded-2xl bg-white/5 border border-white/10 p-8 sm:p-10 shadow-2xl relative overflow-hidden group backdrop-blur-md">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500 rounded-full mix-blend-overlay filter blur-[100px] opacity-20 -mr-16 -mt-16 animate-pulse"></div>

                                <h3 className="text-2xl font-bold text-white mb-8 border-b border-white/10 pb-4">Información de Contacto</h3>

                                <div className="space-y-6">
                                    <div className="flex items-start gap-4">
                                        <div className="p-3 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                        </div>
                                        <div>
                                            <p className="font-semibold text-white">Ubicación</p>
                                            <p className="text-blue-200 text-sm mt-1 leading-relaxed">Av. Hiroshi Takahashi Nro. 162 Km. 4 Carretera Central Pomachaca, Tarma - Junín</p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-4">
                                        <div className="p-3 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                        </div>
                                        <div>
                                            <p className="font-semibold text-white">Teléfono</p>
                                            <p className="text-blue-200 text-sm mt-1">+51 64 621199</p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-4">
                                        <div className="p-3 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                        </div>
                                        <div>
                                            <p className="font-semibold text-white">Correo Electrónico</p>
                                            <p className="text-blue-200 text-sm mt-1">admin@iesppallende.edu.pe</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-2xl bg-white/5 border border-white/10 p-8 sm:p-10 shadow-lg hover:shadow-xl transition-all backdrop-blur-md flex flex-col justify-center">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="p-3 bg-indigo-500/20 rounded-lg text-indigo-300 border border-indigo-500/30">
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-2xl font-bold text-white">Horarios de Atención</h3>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex justify-between items-center p-4 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                                        <span className="font-medium text-blue-100">Lunes a Viernes</span>
                                        <span className="font-bold text-white">8:00 a 18:00</span>
                                    </div>
                                    <div className="flex justify-between items-center p-4 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                                        <span className="font-medium text-blue-100">Sábados</span>
                                        <span className="font-bold text-white">8:00 a 13:00</span>
                                    </div>
                                    <div className="flex justify-between items-center p-4 rounded-lg bg-white/5 border border-white/5 opacity-60">
                                        <span className="font-medium text-blue-200">Domingos</span>
                                        <span className="font-bold text-gray-400">Cerrado</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="bg-blue-950 border-t border-white/10">
                <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8 lg:gap-12">
                        <div className="md:col-span-2 space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-900/50">
                                    <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                    </svg>
                                </div>
                                <p className="text-white font-bold text-lg">IESPP Gustavo Allende Llavería</p>
                            </div>
                            <p className="text-blue-200/70 text-sm leading-relaxed max-w-sm">
                                Institución líder en la formación docente, comprometida con la excelencia académica y el desarrollo integral de la región Junín.
                            </p>
                        </div>

                        <div>
                            <h3 className="text-xs font-bold text-blue-400 tracking-widest uppercase mb-4">Contacto</h3>
                            <div className="space-y-3">
                                <p className="text-blue-200/70 text-sm flex items-start gap-2">
                                    <span className="mt-1 block h-1.5 w-1.5 rounded-full bg-indigo-500 flex-shrink-0"></span>
                                    Av. Hiroshi Takahashi Nro. 162
                                </p>
                                <p className="text-blue-200/70 text-sm flex items-center gap-2">
                                    <span className="block h-1.5 w-1.5 rounded-full bg-indigo-500 flex-shrink-0"></span>
                                    +51 64 621199
                                </p>
                                <p className="text-blue-200/70 text-sm flex items-center gap-2">
                                    <span className="block h-1.5 w-1.5 rounded-full bg-indigo-500 flex-shrink-0"></span>
                                    admin@iesppallende.edu.pe
                                </p>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-xs font-bold text-blue-400 tracking-widest uppercase mb-4">Accesos Rápidos</h3>
                            <div className="flex flex-col space-y-3">
                                {links.map(([href, label]) => (
                                    <a
                                        key={href}
                                        href={href}
                                        className="text-blue-200/70 hover:text-white text-sm transition-colors hover:translate-x-1 duration-200 inline-block w-fit"
                                    >
                                        {label}
                                    </a>
                                ))}
                                {/* ✅ NUEVO: Link en footer */}
                                <a
                                    href="/public/verificador"
                                    className="text-blue-200/70 hover:text-white text-sm transition-colors hover:translate-x-1 duration-200 inline-block w-fit"
                                >
                                    Verificar Grados y Títulos
                                </a>
                            </div>
                        </div>
                    </div>

                    <div className="mt-12 border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                        <p className="text-blue-200/50 text-sm">
                            © {new Date().getFullYear()} IESPP Gustavo Allende Llavería.
                        </p>
                        <p className="text-blue-200/50 text-xs">
                            Desarrollado con excelencia.
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default Landing;