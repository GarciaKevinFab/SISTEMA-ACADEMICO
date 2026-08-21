// Portada pública del sistema — mismo lenguaje "Apple" que /public/*:
// header de vidrio común (PublicHeader), hero a pantalla completa con
// parallax y desvanecimiento al scroll, tipografía display gigante,
// banda de cifras con contadores, carreras en tarjetas con lift y
// secciones que aparecen escalonadas. Sin librerías de animación.
import React from "react";
import {
    MessagesSquare, Blocks, BookOpen, Activity, ShieldCheck, ArrowRight,
    MapPin, Phone, Mail, Clock, GraduationCap, Briefcase,
} from "lucide-react";
import {
    InjectPublicStyles, Reveal, CountUp, HeroFade, ParallaxBg, PublicHeader,
} from "./public/publicFx";

const CARRERAS = [
    { title: "Comunicación", Icon: MessagesSquare, grad: "from-sky-500 to-indigo-600", desc: "Forma docentes con enfoque en comunicación, lenguaje y habilidades expresivas." },
    { title: "Educación Inicial", Icon: Blocks, grad: "from-rose-500 to-pink-600", desc: "Especialízate en el desarrollo cognitivo y emocional de niños de 0 a 5 años." },
    { title: "Educación Primaria", Icon: BookOpen, grad: "from-amber-500 to-orange-600", desc: "Lidera la enseñanza integral y pedagógica de niños de 6 a 12 años." },
    { title: "Educación Física", Icon: Activity, grad: "from-emerald-500 to-teal-600", desc: "Promueve la salud, el deporte y el bienestar físico en las instituciones educativas." },
];

const Landing = () => {
    return (
        <div className="pv-font min-h-[100dvh] bg-white overflow-x-hidden selection:bg-indigo-100 selection:text-indigo-900">
            <InjectPublicStyles />
            <PublicHeader active="/" />

            <main>
                {/* ═══════════ HERO a pantalla completa ═══════════ */}
                <section className="relative overflow-hidden -mt-16">
                    <ParallaxBg
                        image="/gustavo_portada.png"
                        speed={0.25}
                        overlay={
                            <>
                                <div className="absolute inset-0 bg-gradient-to-b from-blue-950/90 via-blue-950/60 to-blue-950" />
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_rgba(0,0,0,0.45)_100%)]" />
                                <div className="pv-glow absolute -top-24 left-1/2 -translate-x-1/2 w-[760px] h-[440px] rounded-full bg-indigo-500/25 blur-[130px]" />
                            </>
                        }
                    />

                    <div className="relative z-10 min-h-[100dvh] flex items-center justify-center pt-16">
                        <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-20">
                            <HeroFade className="text-center text-white">
                                <Reveal variant="scale">
                                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-md mb-8">
                                        <span className="flex h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                                        <span className="text-xs sm:text-sm font-semibold text-blue-100 tracking-wide">
                                            Admisión 2026 abierta
                                        </span>
                                    </div>
                                </Reveal>

                                <Reveal delay={120}>
                                    <h1 className="pv-display font-extrabold leading-[0.98] text-[2.9rem] sm:text-7xl lg:text-[5.6rem] drop-shadow-2xl">
                                        <span className="block text-white/95">Formando</span>
                                        <span className="block text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 via-white to-indigo-200 pb-2">
                                            educadores de excelencia
                                        </span>
                                    </h1>
                                </Reveal>

                                <Reveal delay={260}>
                                    <p className="mt-7 text-base sm:text-xl text-blue-100/95 leading-relaxed max-w-2xl mx-auto font-light">
                                        Instituto de Educación Superior Pedagógico Público
                                        "Gustavo Allende Llavería" — Tarma.
                                        <span className="font-medium text-white"> Comprometidos con la formación integral</span> de
                                        los futuros docentes del país.
                                    </p>
                                </Reveal>

                                <Reveal delay={400} className="mt-11 flex flex-col sm:flex-row gap-3.5 sm:justify-center items-center">
                                    <a href="/public/admission"
                                        className="w-full sm:w-auto min-w-[190px] inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-white text-blue-950 font-extrabold hover:bg-indigo-50 hover:scale-[1.04] transition-all duration-300 shadow-[0_10px_40px_-10px_rgba(255,255,255,0.4)]">
                                        Admisión <ArrowRight className="w-4 h-4" />
                                    </a>
                                    <a href="/public/procedures"
                                        className="w-full sm:w-auto min-w-[190px] inline-flex items-center justify-center px-8 py-4 rounded-full bg-white/10 text-white font-bold hover:bg-white/20 hover:scale-[1.04] transition-all duration-300 border border-white/25 backdrop-blur-sm">
                                        Mesa de Partes
                                    </a>
                                    <a href="/login"
                                        className="w-full sm:w-auto min-w-[190px] inline-flex items-center justify-center px-8 py-4 rounded-full bg-indigo-600/90 backdrop-blur-sm text-white font-bold hover:bg-indigo-500 hover:scale-[1.04] transition-all duration-300 border border-white/10 shadow-lg shadow-indigo-950/40">
                                        Acceso al Sistema
                                    </a>
                                </Reveal>

                                <Reveal delay={520} className="mt-6 flex flex-wrap justify-center gap-3">
                                    <a href="/public/verificador"
                                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-500/15 border border-emerald-400/25 text-emerald-200 text-sm font-semibold hover:bg-emerald-500/25 hover:text-white transition-all duration-300 backdrop-blur-sm">
                                        <ShieldCheck className="w-4 h-4" />
                                        Verificar Grados y Títulos
                                    </a>
                                    <a href="/public/docentes"
                                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-sky-500/15 border border-sky-400/25 text-sky-200 text-sm font-semibold hover:bg-sky-500/25 hover:text-white transition-all duration-300 backdrop-blur-sm">
                                        <GraduationCap className="w-4 h-4" />
                                        Plana Docente
                                    </a>
                                    <a href="/public/personal"
                                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-indigo-500/15 border border-indigo-400/25 text-indigo-200 text-sm font-semibold hover:bg-indigo-500/25 hover:text-white transition-all duration-300 backdrop-blur-sm">
                                        <Briefcase className="w-4 h-4" />
                                        Personal Administrativo
                                    </a>
                                </Reveal>
                            </HeroFade>
                        </div>

                        <div className="pv-float absolute bottom-7 left-1/2 -translate-x-1/2 text-white/40" aria-hidden="true">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                        </div>
                    </div>
                </section>

                {/* ═══════════ Banda de cifras (estilo Apple: números gigantes) ═══════════ */}
                <section className="bg-white py-20 sm:py-24">
                    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-12 sm:gap-6 text-center sm:divide-x sm:divide-slate-100">
                            {[
                                [39, "+", "Años formando docentes"],
                                [2500, "+", "Egresados exitosos"],
                                [98, "%", "Inserción laboral"],
                            ].map(([num, suf, label], i) => (
                                <Reveal key={label} delay={i * 130}>
                                    <div className="px-4">
                                        <p className="pv-display text-6xl sm:text-6xl lg:text-7xl font-extrabold text-blue-950">
                                            <CountUp value={num} suffix={suf} />
                                        </p>
                                        <p className="mt-3 text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
                                            {label}
                                        </p>
                                    </div>
                                </Reveal>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ═══════════ Programas de estudio ═══════════ */}
                <section className="py-20 sm:py-28 bg-slate-50 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <Reveal className="text-center mb-16 max-w-3xl mx-auto">
                            <p className="text-sm font-bold text-indigo-600 tracking-[0.2em] uppercase mb-4">
                                Oferta académica
                            </p>
                            <h2 className="pv-display text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900">
                                Nuestros programas
                                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-800">
                                    de estudio
                                </span>
                            </h2>
                            <p className="mt-5 text-lg text-slate-500">
                                Diseñados para responder a los desafíos educativos del siglo XXI
                                con innovación y calidad.
                            </p>
                        </Reveal>

                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                            {CARRERAS.map(({ title, Icon, grad, desc }, ci) => (
                                <Reveal key={title} delay={ci * 110}
                                    className="pv-lift group bg-white rounded-3xl border border-slate-100 p-7 shadow-sm relative overflow-hidden">
                                    <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full bg-gradient-to-br ${grad} opacity-[0.07] group-hover:opacity-[0.14] group-hover:scale-125 transition-all duration-500`} />
                                    <div className="relative">
                                        <div className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br ${grad} text-white shadow-lg mb-5`}>
                                            <Icon className="w-6 h-6" />
                                        </div>
                                        <h3 className="pv-display text-xl font-extrabold text-slate-900 mb-2.5">
                                            {title}
                                        </h3>
                                        <p className="text-[13.5px] text-slate-500 leading-relaxed mb-6">
                                            {desc}
                                        </p>
                                        <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-[10.5px] font-extrabold bg-slate-100 text-slate-600 uppercase tracking-wider">
                                                10 semestres
                                            </span>
                                            <ArrowRight className="w-5 h-5 text-indigo-500 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                                        </div>
                                    </div>
                                </Reveal>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ═══════════ CTA Admisión ═══════════ */}
                <section className="relative bg-indigo-700 overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-600 via-indigo-700 to-indigo-900" />
                    <div className="pv-glow absolute -bottom-32 left-1/2 -translate-x-1/2 w-[640px] h-[360px] rounded-full bg-white/10 blur-[110px]" />

                    <Reveal variant="scale" className="relative max-w-4xl mx-auto text-center py-24 sm:py-32 px-4 sm:px-6 lg:px-8">
                        <h2 className="pv-display text-4xl sm:text-6xl font-extrabold text-white mb-6">
                            ¿Listo para transformar
                            <span className="block">el futuro?</span>
                        </h2>
                        <p className="text-lg sm:text-xl text-indigo-100 mb-10 max-w-2xl mx-auto leading-relaxed">
                            Únete a nuestra comunidad académica y forma parte de la nueva
                            generación de educadores líderes.
                        </p>
                        <a href="/public/admission"
                            className="inline-flex items-center justify-center gap-2 px-9 py-4 rounded-full bg-white text-indigo-700 font-extrabold text-lg hover:bg-indigo-50 hover:shadow-2xl hover:scale-105 transition-all duration-300">
                            Postular ahora <ArrowRight className="w-5 h-5" />
                        </a>
                    </Reveal>
                </section>

                {/* ═══════════ Contacto ═══════════ */}
                <section className="py-20 sm:py-24 bg-blue-950 relative overflow-hidden">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                        <Reveal className="text-center mb-12">
                            <h2 className="pv-display text-3xl sm:text-4xl font-extrabold text-white">
                                Estamos aquí para ayudarte
                            </h2>
                            <p className="mt-3 text-blue-200">Contáctanos o visítanos en nuestro campus.</p>
                        </Reveal>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                            <Reveal variant="left"
                                className="rounded-3xl bg-white/5 border border-white/10 p-8 sm:p-10 shadow-2xl relative overflow-hidden backdrop-blur-md">
                                <div className="pv-glow absolute top-0 right-0 w-64 h-64 bg-indigo-500 rounded-full mix-blend-overlay blur-[100px] opacity-20 -mr-16 -mt-16" />
                                <h3 className="pv-display text-2xl font-extrabold text-white mb-8 border-b border-white/10 pb-4">
                                    Información de contacto
                                </h3>
                                <div className="space-y-6">
                                    {[
                                        [MapPin, "Ubicación", "Av. Hiroshi Takahashi Nro. 162 Km. 4 Carretera Central Pomachaca, Tarma - Junín"],
                                        [Phone, "Teléfono", "+51 64 621199"],
                                        [Mail, "Correo electrónico", "admin@iesppallende.edu.pe"],
                                    ].map(([Icon, label, value]) => (
                                        <div key={label} className="flex items-start gap-4">
                                            <div className="p-3 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
                                                <Icon className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-white">{label}</p>
                                                <p className="text-blue-200 text-sm mt-1 leading-relaxed">{value}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Reveal>

                            <Reveal variant="right" delay={120}
                                className="rounded-3xl bg-white/5 border border-white/10 p-8 sm:p-10 shadow-lg backdrop-blur-md flex flex-col justify-center">
                                <div className="flex items-center gap-3 mb-7">
                                    <div className="p-3 bg-indigo-500/20 rounded-xl text-indigo-300 border border-indigo-500/30">
                                        <Clock className="w-5 h-5" />
                                    </div>
                                    <h3 className="pv-display text-2xl font-extrabold text-white">Horarios de atención</h3>
                                </div>
                                <div className="space-y-3.5">
                                    {[
                                        ["Lunes a Viernes", "8:00 a 18:00", false],
                                        ["Sábados", "8:00 a 13:00", false],
                                        ["Domingos", "Cerrado", true],
                                    ].map(([dia, hora, cerrado]) => (
                                        <div key={dia}
                                            className={"flex justify-between items-center p-4 rounded-xl bg-white/5 border border-white/5 transition-colors " +
                                                (cerrado ? "opacity-60" : "hover:bg-white/10")}>
                                            <span className={cerrado ? "font-medium text-blue-200" : "font-medium text-blue-100"}>{dia}</span>
                                            <span className={cerrado ? "font-bold text-slate-400" : "font-bold text-white"}>{hora}</span>
                                        </div>
                                    ))}
                                </div>
                            </Reveal>
                        </div>
                    </div>
                </section>
            </main>

            {/* ═══════════ Footer ═══════════ */}
            <footer className="bg-blue-950 border-t border-white/10">
                <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8 lg:gap-12">
                        <div className="md:col-span-2 space-y-4">
                            <div className="flex items-center gap-3">
                                <img src="/logo.png" alt="IESPP" className="h-10 w-10 object-contain" draggable="false" />
                                <p className="pv-display text-white font-extrabold text-lg">
                                    IESPP Gustavo Allende Llavería
                                </p>
                            </div>
                            <p className="text-blue-200/70 text-sm leading-relaxed max-w-sm">
                                Institución líder en la formación docente, comprometida con la
                                excelencia académica y el desarrollo integral de la región Junín.
                            </p>
                        </div>

                        <div>
                            <h3 className="text-xs font-bold text-blue-400 tracking-[0.18em] uppercase mb-4">Contacto</h3>
                            <div className="space-y-3">
                                {[
                                    "Av. Hiroshi Takahashi Nro. 162",
                                    "+51 64 621199",
                                    "admin@iesppallende.edu.pe",
                                ].map((t) => (
                                    <p key={t} className="text-blue-200/70 text-sm flex items-start gap-2">
                                        <span className="mt-1.5 block h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />
                                        {t}
                                    </p>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h3 className="text-xs font-bold text-blue-400 tracking-[0.18em] uppercase mb-4">Accesos rápidos</h3>
                            <div className="flex flex-col space-y-3">
                                {[
                                    ["/public/admission", "Admisión"],
                                    ["/public/procedures", "Mesa de Partes"],
                                    ["/public/verificador", "Verificar Grados y Títulos"],
                                    ["/public/docentes", "Plana Docente"],
                                    ["/public/personal", "Personal Administrativo"],
                                    ["/login", "Acceso al Sistema"],
                                ].map(([href, label]) => (
                                    <a key={href} href={href}
                                        className="text-blue-200/70 hover:text-white text-sm transition-all hover:translate-x-1 duration-200 inline-block w-fit">
                                        {label}
                                    </a>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="mt-12 border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                        <p className="text-blue-200/50 text-sm">
                            © {new Date().getFullYear()} IESPP Gustavo Allende Llavería.
                        </p>
                        <p className="text-blue-200/50 text-xs">Desarrollado con excelencia.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default Landing;
