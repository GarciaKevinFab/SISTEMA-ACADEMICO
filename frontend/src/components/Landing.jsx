import React, { useEffect, useRef, useState } from "react";

const Landing = () => {
    const [menuOpen, setMenuOpen] = useState(false);
    const [activeSection, setActiveSection] = useState("#inicio");
    const drawerRef = useRef(null);

    // Cerrar con ESC
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "Escape") setMenuOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    // Bloquear scroll del body SOLO cuando el menú está abierto (sin bugs)
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

    // ✅ Active section por scroll
    useEffect(() => {
        const ids = ["inicio", "nosotros", "carreras", "admision", "contacto"];
        const els = ids
            .map((id) => document.getElementById(id))
            .filter(Boolean);

        if (!els.length) return;

        const obs = new IntersectionObserver(
            (entries) => {
                // Agarramos el más visible
                const visible = entries
                    .filter((e) => e.isIntersecting)
                    .sort((a, b) => (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0))[0];

                if (visible?.target?.id) setActiveSection(`#${visible.target.id}`);
            },
            {
                root: null,
                threshold: [0.2, 0.35, 0.5, 0.65],
                rootMargin: "-15% 0px -70% 0px", // prioriza sección de arriba
            }
        );

        els.forEach((el) => obs.observe(el));
        return () => obs.disconnect();
    }, []);

    const handleNavClick = (href) => (e) => {
        // scroll suave + offset por sticky header
        e.preventDefault();
        const el = document.querySelector(href);
        if (!el) return;

        const headerOffset = 96; // ajustado (tu header)
        const top = el.getBoundingClientRect().top + window.scrollY - headerOffset;

        window.scrollTo({ top, behavior: "smooth" });
        setActiveSection(href);
        setMenuOpen(false);
    };

    const links = [
        ["#inicio", "Inicio"],
        ["#nosotros", "Nosotros"],
        ["#carreras", "Carreras"],
    ];

    const NavLinks = ({ isMobile = false }) => (
        <>
            {links.map(([href, label]) => {
                const active = activeSection === href;

                // Animación tipo "pill + underline"
                const base =
                    "relative font-medium transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded-md";
                const desktop =
                    "px-2 py-1 text-sm lg:text-[15px]";
                const mobile =
                    "w-full px-3 py-3 rounded-lg";

                const color = active
                    ? "text-white"
                    : "text-blue-200 hover:text-white";

                return (
                    <a
                        key={href}
                        href={href}
                        onClick={handleNavClick(href)}
                        className={[
                            base,
                            isMobile ? mobile : desktop,
                            color,
                            isMobile ? "hover:bg-white/10" : "hover:text-white",
                            active && !isMobile ? "drop-shadow-[0_0_10px_rgba(255,255,255,0.25)]" : "",
                        ].join(" ")}
                    >
                        {/* texto */}
                        <span className="relative z-10">{label}</span>

                        {/* pill hover */}
                        {!isMobile && (
                            <span
                                className={[
                                    "absolute inset-0 rounded-md opacity-0 transition-opacity duration-300",
                                    "bg-white/10",
                                    "group-hover:opacity-100",
                                ].join(" ")}
                            />
                        )}

                        {/* underline animado */}
                        <span
                            className={[
                                "pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-0 h-[2px] rounded-full transition-all duration-300",
                                active ? "w-full bg-indigo-300 shadow-[0_0_12px_rgba(165,180,252,0.8)]" : "w-0 bg-white/0",
                            ].join(" ")}
                        />
                    </a>
                );
            })}
        </>
    );

    return (
        // ✅ Layout real
        <div className="h-[100dvh] bg-white flex flex-col overflow-y-auto overflow-x-hidden overscroll-contain">
            {/* Header sticky + mejor contraste */}
            <header className="sticky top-0 z-50">
                <div className="bg-blue-950/85 backdrop-blur-md border-b border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex justify-between items-center py-4 sm:py-5">
                            {/* Brand */}
                            <a href="#inicio" onClick={handleNavClick("#inicio")} className="flex items-center gap-3 min-w-0 group">
                                <img
                                    className="h-14 w-14 sm:h-16 sm:w-16 lg:h-20 lg:w-20 object-contain shrink-0 drop-shadow-[0_8px_18px_rgba(0,0,0,0.35)]"
                                    src="/logo.png"
                                    alt="Logo del Instituto"
                                    draggable="false"
                                />
                                <div className="leading-tight min-w-0">
                                    <h1 className="text-lg sm:text-xl lg:text-2xl font-extrabold text-white truncate">
                                        IESPP Gustavo Allende Llavería
                                    </h1>
                                    <p className="text-blue-200 text-xs sm:text-sm truncate">
                                        Sistema Académico Integral
                                    </p>
                                </div>
                            </a>

                            {/* Desktop nav */}
                            <nav className="hidden md:flex items-center gap-7">
                                <div className="flex items-center gap-7">
                                    <NavLinks />
                                </div>
                            </nav>

                            {/* Mobile button */}
                            <button
                                type="button"
                                className="md:hidden inline-flex items-center justify-center rounded-lg p-2 text-blue-200 hover:text-white hover:bg-white/10 transition"
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
                        <div className="absolute inset-0 bg-black/60" />

                        <div
                            ref={drawerRef}
                            className="absolute right-0 top-0 h-[100dvh] w-[86%] max-w-sm bg-blue-950 text-white shadow-2xl flex flex-col border-l border-white/10"
                            role="dialog"
                            aria-modal="true"
                        >
                            <div className="px-4 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-3 min-w-0">
                                    <img className="h-10 w-10 object-contain shrink-0" src="/logo.png" alt="Logo" draggable="false" />
                                    <div className="min-w-0">
                                        <div className="font-bold leading-tight">IESPP</div>
                                        <div className="text-xs text-blue-200 leading-tight truncate">
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
                                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <div
                                className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
                                style={{
                                    WebkitOverflowScrolling: "touch",
                                    overscrollBehavior: "contain",
                                    touchAction: "pan-y",
                                }}
                            >
                                <nav className="flex flex-col gap-2">
                                    <NavLinks isMobile />
                                </nav>

                                <div className="pt-4 border-t border-white/10 space-y-3">
                                    <a
                                        href="/public/admission"
                                        className="w-full inline-flex items-center justify-center px-4 py-3 rounded-md bg-white text-indigo-800 font-semibold hover:bg-indigo-50 transition shadow"
                                        onClick={() => setMenuOpen(false)}
                                    >
                                        Ver Convocatorias
                                    </a>
                                    <a
                                        href="/login"
                                        className="w-full inline-flex items-center justify-center px-4 py-3 rounded-md bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition shadow"
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
                {/* Hero */}
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
                    {/* overlay más pro para que se note mejor */}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/45 to-black/60" />

                    <div className="relative z-10">
                        <div className="min-h-[calc(100dvh-84px)] sm:min-h-[calc(100dvh-92px)] flex items-center">
                            <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
                                <div className="max-w-3xl mx-auto text-center text-white">
                                    <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight drop-shadow-[0_12px_30px_rgba(0,0,0,0.6)]">
                                        <span className="block">Formando</span>
                                        <span className="block text-indigo-200">Educadores de Excelencia</span>
                                    </h1>

                                    <p className="mt-4 text-sm sm:text-lg lg:text-xl text-indigo-100 leading-relaxed drop-shadow-[0_10px_24px_rgba(0,0,0,0.55)]">
                                        Instituto de Educación Superior Pedagógico Público "Gustavo Allende Llavería" —
                                        comprometidos con la formación integral de futuros docentes.
                                    </p>

                                    <div className="mt-7 flex flex-col sm:flex-row gap-3 sm:justify-center">
                                        <a
                                            href="/public/admission"
                                            className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 sm:px-8 sm:py-4 rounded-md bg-white text-indigo-800 font-semibold hover:bg-indigo-50 transition shadow"
                                        >
                                            Ver Convocatorias
                                        </a>
                                        <a
                                            href="/login"
                                            className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 sm:px-8 sm:py-4 rounded-md bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition shadow"
                                        >
                                            Acceso al Sistema
                                        </a>
                                    </div>

                                    <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        {[
                                            ["39+", "Años de experiencia"],
                                            ["2,500+", "Egresados"],
                                            ["98%", "Inserción laboral"],
                                        ].map(([num, label]) => (
                                            <div
                                                key={label}
                                                className="rounded-xl bg-white/10 border border-white/15 px-4 py-4 backdrop-blur-sm shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
                                            >
                                                <div className="text-2xl font-extrabold">{num}</div>
                                                <div className="text-sm text-indigo-100">{label}</div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="mt-10 opacity-90 text-indigo-100 text-xs sm:text-sm">
                                        Desliza hacia abajo para ver más ↓
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Secciones (las tuyas igual) */}
                <section id="nosotros" className="py-12 sm:py-16">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center max-w-3xl mx-auto">
                            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">Nosotros</h2>
                            <p className="mt-3 text-gray-600 text-sm sm:text-base">
                                Formación pedagógica pública con enfoque humano, excelencia académica y compromiso social.
                            </p>
                        </div>
                    </div>
                </section>

                <section id="carreras" className="py-12 sm:py-16 bg-gray-50">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center mb-10 sm:mb-12">
                            <h2 className="text-xs sm:text-sm text-indigo-700 font-semibold tracking-wide uppercase">
                                Programas de Estudio
                            </h2>
                            <p className="mt-2 text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-gray-900">
                                Carreras Profesionales
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-3">
                            {[
                                { title: "Educación Inicial", desc: "Forma docentes especializados en la educación de niños de 0 a 5 años." },
                                { title: "Educación Primaria", desc: "Prepara educadores para la enseñanza integral de niños de 6 a 12 años." },
                                { title: "Educación Física", desc: "Forma profesionales en educación física y promoción de la salud." },
                            ].map((c) => (
                                <div
                                    key={c.title}
                                    className="bg-white overflow-hidden shadow-sm hover:shadow-xl transition rounded-xl border border-gray-100 hover:-translate-y-1"
                                >
                                    <div className="p-6">
                                        <h3 className="text-lg font-semibold text-gray-900">{c.title}</h3>
                                        <p className="mt-2 text-sm text-gray-600 leading-relaxed">{c.desc}</p>
                                        <div className="mt-4">
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
                                                10 semestres
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section id="admision" className="bg-indigo-700">
                    <div className="max-w-3xl mx-auto text-center py-14 sm:py-20 px-4 sm:px-6 lg:px-8">
                        <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
                            <span className="block">¿Listo para ser parte</span>
                            <span className="block">de nuestra comunidad?</span>
                        </h2>
                        <p className="mt-4 text-sm sm:text-lg leading-relaxed text-indigo-100">
                            Únete a nosotros y forma parte de la nueva generación de educadores que transformarán el futuro de la educación.
                        </p>
                        <a
                            href="/public/admission"
                            className="mt-8 w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 rounded-md bg-white text-indigo-800 font-semibold hover:bg-indigo-50 transition shadow"
                        >
                            Postular Ahora
                        </a>
                    </div>
                </section>

                <section id="contacto" className="py-12 sm:py-16">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="rounded-xl border border-gray-100 shadow-sm p-6">
                                <h3 className="text-lg font-semibold text-gray-900">Contáctanos</h3>
                                <p className="mt-2 text-sm text-gray-600">
                                    Av. Hiroshi Takahashi Nro. 162 Km. 4 Carretera Central Pomachaca, Tarma - Junín, Perú
                                </p>
                                <div className="mt-4 space-y-2 text-sm text-gray-700">
                                    <div><b>Tel:</b> +51 64 621199</div>
                                    <div><b>Email:</b> admin@iesppallende.edu.pe</div>
                                </div>
                            </div>

                            <div className="rounded-xl bg-gray-900 text-white p-6">
                                <h3 className="text-lg font-semibold">Horarios</h3>
                                <p className="mt-2 text-sm text-gray-300">Lunes a Viernes: 8:00 a 18:00</p>
                                <p className="text-sm text-gray-300">Sábados: 8:00 a 13:00</p>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            {/* Footer (tu footer igual, ya está bien) */}
            <footer className="bg-gray-800">
                <div className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                        <div className="md:col-span-2">
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 bg-indigo-600 rounded-lg flex items-center justify-center">
                                    <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                    </svg>
                                </div>
                                <p className="text-white font-bold">IESPP Gustavo Allende Llavería</p>
                            </div>
                            <p className="mt-4 text-gray-300 text-sm leading-relaxed">
                                Instituto de Educación Superior Pedagógico Público comprometido con la formación de educadores de excelencia.
                            </p>
                        </div>

                        <div>
                            <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">Contacto</h3>
                            <div className="mt-4 space-y-2">
                                <p className="text-gray-300 text-sm leading-relaxed">
                                    Av. Hiroshi Takahashi Nro. 162 Km. 4 Carretera Central Pomachaca, Tarma - Junín, Perú
                                </p>
                                <p className="text-gray-300 text-sm">+51 64 621199</p>
                                <p className="text-gray-300 text-sm">admin@iesppallende.edu.pe</p>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">Enlaces</h3>
                            <div className="mt-4 space-y-2">
                                {links.map(([href, label]) => (
                                    <a
                                        key={href}
                                        href={href}
                                        onClick={handleNavClick(href)}
                                        className="text-gray-300 hover:text-white text-sm block transition"
                                    >
                                        {label}
                                    </a>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 border-t border-gray-700 pt-6">
                        <p className="text-gray-400 text-sm text-center">
                            © {new Date().getFullYear()} IESPP Gustavo Allende Llavería. Todos los derechos reservados.
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default Landing;
