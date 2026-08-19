// publicFx — kit de la web PÚBLICA (portada, admisión, mesa de partes,
// verificador): un solo lenguaje visual estilo "Apple" con animaciones
// ligadas al scroll. Todo CSS/JS propio, sin librerías:
//
//   <InjectPublicStyles/>  fuente display (Manrope) + clases pv-*
//   <Reveal>               aparece al entrar al viewport (up/left/right/scale,
//                          con delay para escalonar)
//   <CountUp/>             número que cuenta al hacerse visible
//   <HeroFade>             el hero se desvanece/encoge suavemente al scrollear
//   <ParallaxBg/>          fondo con parallax lento
//   <PublicHeader/>        barra de vidrio común para las páginas públicas
//
// Respeta prefers-reduced-motion (todo aparece sin animación).
import React, { useEffect, useRef, useState } from "react";

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');

  html { scroll-behavior: smooth; }
  .pv-font, .pv-font * { font-family: 'Manrope', system-ui, -apple-system, sans-serif; }
  .pv-display { letter-spacing: -0.035em; }

  .pv-reveal {
    opacity: 0;
    transition: opacity .9s cubic-bezier(.16,1,.3,1), transform .9s cubic-bezier(.16,1,.3,1);
    will-change: opacity, transform;
  }
  .pv-up    { transform: translateY(38px); }
  .pv-left  { transform: translateX(-38px); }
  .pv-right { transform: translateX(38px); }
  .pv-scale { transform: scale(.93); }
  .pv-reveal.pv-in { opacity: 1; transform: none; }

  .pv-lift { transition: transform .45s cubic-bezier(.16,1,.3,1), box-shadow .45s cubic-bezier(.16,1,.3,1); }
  .pv-lift:hover { transform: translateY(-6px) scale(1.015); box-shadow: 0 24px 48px -16px rgba(2,6,23,.35); }

  @keyframes pv-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-10px) } }
  .pv-float { animation: pv-float 6s ease-in-out infinite; }

  @keyframes pv-glow { 0%,100% { opacity:.35 } 50% { opacity:.7 } }
  .pv-glow { animation: pv-glow 5s ease-in-out infinite; }

  @media (prefers-reduced-motion: reduce) {
    .pv-reveal { opacity: 1 !important; transform: none !important; transition: none !important; }
    .pv-float, .pv-glow { animation: none !important; }
    html { scroll-behavior: auto; }
  }
`;

export function InjectPublicStyles() {
    useEffect(() => {
        const id = "public-fx-styles";
        if (document.getElementById(id)) return;
        const s = document.createElement("style");
        s.id = id;
        s.textContent = STYLES;
        document.head.appendChild(s);
    }, []);
    return null;
}

const reduced = () =>
    typeof window !== "undefined"
    && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/* ── Aparece al entrar al viewport ── */
export function Reveal({ children, delay = 0, variant = "up", className = "", as: Tag = "div" }) {
    const ref = useRef(null);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const obs = new IntersectionObserver(
            ([e]) => {
                if (e.isIntersecting) {
                    el.classList.add("pv-in");
                    obs.disconnect();
                }
            },
            { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, []);
    return (
        <Tag ref={ref} className={`pv-reveal pv-${variant} ${className}`}
            style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
            {children}
        </Tag>
    );
}

/* ── Número que cuenta al hacerse visible ── */
export function CountUp({ value, suffix = "", duration = 1600, className = "" }) {
    const ref = useRef(null);
    const [n, setN] = useState(reduced() ? value : 0);
    useEffect(() => {
        const el = ref.current;
        if (!el || reduced()) return;
        const obs = new IntersectionObserver(([e]) => {
            if (!e.isIntersecting) return;
            obs.disconnect();
            const t0 = performance.now();
            const tick = (t) => {
                const p = Math.min(1, (t - t0) / duration);
                setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
                if (p < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
        }, { threshold: 0.4 });
        obs.observe(el);
        return () => obs.disconnect();
    }, [value, duration]);
    return (
        <span ref={ref} className={className}>
            {n.toLocaleString("es-PE")}{suffix}
        </span>
    );
}

/* ── El contenido del hero se desvanece/encoge al scrollear (Apple) ── */
export function HeroFade({ children, className = "" }) {
    const ref = useRef(null);
    useEffect(() => {
        const el = ref.current;
        if (!el || reduced()) return;
        let raf = 0;
        const onScroll = () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => {
                const p = Math.min(1, Math.max(0, window.scrollY / (window.innerHeight * 0.85)));
                el.style.opacity = String(1 - p * 0.85);
                el.style.transform = `translateY(${(p * 44).toFixed(1)}px) scale(${(1 - p * 0.06).toFixed(4)})`;
            });
        };
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
    }, []);
    return (
        <div ref={ref} className={className} style={{ willChange: "opacity, transform" }}>
            {children}
        </div>
    );
}

/* ── Fondo con parallax lento (para heros a pantalla completa) ── */
export function ParallaxBg({ image, speed = 0.28, className = "", overlay = null }) {
    const ref = useRef(null);
    useEffect(() => {
        const el = ref.current;
        if (!el || reduced()) return;
        let raf = 0;
        const onScroll = () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => {
                el.style.transform = `translateY(${(window.scrollY * speed).toFixed(1)}px) scale(1.12)`;
            });
        };
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
    }, [speed]);
    return (
        <div className={`absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
            <div ref={ref} className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url('${image}')`, transform: "scale(1.12)", willChange: "transform" }} />
            {overlay}
        </div>
    );
}

/* ── Barra de vidrio común de las páginas públicas ── */
export function PublicHeader({ active = "" }) {
    const [scrolled, setScrolled] = useState(false);
    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 12);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);
    // Header simple (pedido): solo Inicio → página informativa del
    // instituto, y el botón Acceso. Las demás secciones se navegan desde
    // los botones de cada página.
    const links = [
        ["https://iesppallende.edu.pe/", "Inicio"],
    ];
    return (
        <header className={"sticky top-0 z-50 transition-all duration-500 " +
            (scrolled
                ? "bg-blue-950/85 backdrop-blur-xl shadow-lg shadow-blue-950/30 border-b border-white/10"
                : "bg-blue-950/40 backdrop-blur-md border-b border-transparent")}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <a href="/" className="flex items-center gap-3 min-w-0 group">
                        <span className="grid place-items-center h-11 w-11 rounded-full bg-white shadow-lg shadow-blue-950/30 shrink-0 transition-transform duration-300 group-hover:scale-110">
                            <img src="/logo.png" alt="Escudo IESPP" draggable="false"
                                className="h-9 w-9 object-contain" />
                        </span>
                        <div className="leading-tight min-w-0 hidden xs:block sm:block">
                            <p className="text-white font-extrabold text-sm truncate tracking-tight">
                                IESPP Gustavo Allende Llavería
                            </p>
                            <p className="text-blue-200/70 text-[9px] uppercase tracking-[0.18em]">
                                Sistema Académico Integral
                            </p>
                        </div>
                    </a>
                    <nav className="flex items-center gap-1">
                        {links.map(([href, label]) => (
                            <a key={href} href={href}
                                className={"px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-colors " +
                                    (active === href
                                        ? "bg-white/15 text-white"
                                        : "text-blue-100/80 hover:text-white hover:bg-white/10")}>
                                {label}
                            </a>
                        ))}
                        <a href="/login"
                            className="ml-2 inline-flex items-center px-4 py-2 rounded-full bg-white text-blue-950 text-[13px] font-extrabold hover:bg-blue-50 hover:scale-105 transition-all duration-300 shadow-lg shadow-blue-950/20">
                            Acceso
                        </a>
                        {/* Escudo institucional (el segundo logo del header original) */}
                        <span className="ml-2 grid place-items-center h-11 w-11 rounded-full bg-white shadow-lg shadow-blue-950/30 shrink-0">
                            <img src="/loguito.png" alt="Escudo institucional" draggable="false"
                                className="h-9 w-9 object-contain" />
                        </span>
                    </nav>
                </div>
            </div>
        </header>
    );
}
