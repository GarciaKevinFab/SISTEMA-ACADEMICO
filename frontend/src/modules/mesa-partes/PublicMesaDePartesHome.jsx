import React from "react";
import { Link } from "react-router-dom";
import {
    FileText, Search, ArrowRight, ShieldCheck,
    Paperclip, Clock, Info, AlertTriangle,
    CheckCircle2,
} from "lucide-react";
import {
    InjectPublicStyles, Reveal, HeroFade, PublicHeader,
} from "@/components/public/publicFx";

/* ─── Feature Chip ───────────────────────────────────────────── */
const FeatureChip = ({ icon: Icon, title, desc }) => (
    <div className="rounded-2xl bg-white border border-slate-200 px-5 py-4 shadow-sm pv-lift h-full">
        <div className="flex items-center gap-2.5 text-sm font-extrabold text-slate-900">
            <div className="h-8 w-8 rounded-xl bg-blue-50 border border-blue-100 grid place-items-center shrink-0">
                <Icon className="h-4 w-4 text-blue-700" />
            </div>
            {title}
        </div>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">{desc}</p>
    </div>
);

/* ─── Action Card ────────────────────────────────────────────── */
const ActionCard = ({ to, icon: Icon, iconBg, iconText, label, desc, cta, ctaColor, ringColor }) => (
    <Link
        to={to}
        className={`group pv-lift block h-full rounded-2xl border border-slate-200 bg-white shadow-sm p-6 sm:p-8 focus:outline-none focus-visible:ring-2 ${ringColor}`}
    >
        <div className={`h-14 w-14 rounded-2xl grid place-items-center border ${iconBg} ${iconText}`}>
            <Icon className="h-7 w-7" />
        </div>
        <p className="pv-display mt-5 text-2xl font-extrabold text-slate-900">{label}</p>
        <p className="text-[15px] text-slate-500 mt-2 leading-relaxed">{desc}</p>
        <span className={`mt-5 inline-flex items-center gap-1.5 text-sm font-extrabold ${ctaColor}`}>
            {cta}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </span>
    </Link>
);

/* ─── Step Card ──────────────────────────────────────────────── */
const StepCard = ({ n, title, desc }) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm h-full">
        <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded-xl bg-blue-950 text-white grid place-items-center font-black text-sm shrink-0">
                {n}
            </div>
            <p className="font-extrabold text-slate-900 text-[15px]">{title}</p>
        </div>
        <p className="text-sm text-slate-500 leading-relaxed pl-12">{desc}</p>
    </div>
);

/* ─── Main Component ─────────────────────────────────────────── */
export default function PublicMesaDePartesHome() {
    return (
        <div className="pv-font min-h-[100dvh] bg-slate-50 text-slate-900 overflow-x-hidden">
            <InjectPublicStyles />
            <PublicHeader active="/public/procedures" />

            {/* ── Hero compacto ── */}
            <section className="relative bg-blue-950 text-white overflow-hidden">
                <div className="pointer-events-none absolute inset-0" aria-hidden="true">
                    <div className="absolute -top-32 -right-32 h-[420px] w-[420px] rounded-full bg-indigo-500/25 blur-[100px] pv-glow" />
                    <div className="absolute -bottom-40 -left-32 h-[420px] w-[420px] rounded-full bg-sky-500/20 blur-[100px]" />
                    <div className="absolute inset-0 opacity-[0.05] bg-[linear-gradient(rgba(255,255,255,0.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.8)_1px,transparent_1px)] bg-[size:44px_44px]" />
                </div>
                <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 min-h-[40vh] flex items-center py-14 sm:py-20">
                    <HeroFade className="w-full max-w-3xl">
                        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-4 py-1.5 text-xs font-bold text-white/90 backdrop-blur-sm">
                            <ShieldCheck className="h-3.5 w-3.5 text-indigo-300" />
                            Registro y seguimiento con código único
                        </div>
                        <h1 className="pv-display mt-5 text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.05]">
                            Mesa de Partes Digital
                        </h1>
                        <p className="mt-4 text-base sm:text-lg text-blue-100/80 leading-relaxed max-w-2xl">
                            Registra tu trámite documentario en línea y haz seguimiento en
                            tiempo real con tu código de expediente.
                        </p>
                    </HeroFade>
                </div>
            </section>

            {/* ── Main ── */}
            <main className="relative z-10">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

                    {/* Acciones principales */}
                    <section className="-mt-10 sm:-mt-14 relative z-20 grid gap-4 sm:gap-6 md:grid-cols-2">
                        <Reveal variant="left">
                            <ActionCard
                                to="/public/procedures/new"
                                icon={FileText}
                                iconBg="bg-indigo-50 border-indigo-100"
                                iconText="text-indigo-700"
                                label="Iniciar trámite"
                                desc="Registra tu solicitud y adjunta documentos (PDF o imagen)."
                                cta="Empezar ahora"
                                ctaColor="text-indigo-700"
                                ringColor="focus-visible:ring-indigo-500"
                            />
                        </Reveal>
                        <Reveal variant="right" delay={100}>
                            <ActionCard
                                to="/public/procedures/track"
                                icon={Search}
                                iconBg="bg-blue-50 border-blue-100"
                                iconText="text-blue-700"
                                label="Consultar estado"
                                desc={<>Ingresa tu código de seguimiento (ej: <b className="text-slate-700">MP-2026-ABC123</b>).</>}
                                cta="Consultar expediente"
                                ctaColor="text-blue-700"
                                ringColor="focus-visible:ring-blue-500"
                            />
                        </Reveal>
                    </section>

                    {/* Ventajas */}
                    <section className="mt-10 sm:mt-14 grid gap-4 sm:grid-cols-3">
                        <Reveal variant="up">
                            <FeatureChip icon={Clock} title="Rápido" desc="Registro en minutos desde cualquier dispositivo." />
                        </Reveal>
                        <Reveal variant="up" delay={100}>
                            <FeatureChip icon={Paperclip} title="Adjuntos" desc="PDF o imagen, hasta varios archivos." />
                        </Reveal>
                        <Reveal variant="up" delay={200}>
                            <FeatureChip icon={Search} title="Seguimiento" desc="Código único para rastrear tu expediente." />
                        </Reveal>
                    </section>

                    {/* Cómo funciona + Importante */}
                    <section className="mt-10 sm:mt-14 grid gap-4 sm:gap-6 lg:grid-cols-[1.7fr_1fr]">
                        <Reveal variant="up">
                            <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm h-full">
                                <div className="flex items-center gap-3 mb-5">
                                    <div className="h-9 w-9 rounded-xl bg-slate-100 grid place-items-center">
                                        <Info className="h-4 w-4 text-slate-600" />
                                    </div>
                                    <h2 className="pv-display text-xl sm:text-2xl font-extrabold text-slate-900">
                                        ¿Cómo funciona?
                                    </h2>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <StepCard n="1" title="Registra" desc="Completa tus datos personales y elige el tipo de trámite." />
                                    <StepCard n="2" title="Adjunta" desc="Sube los documentos requeridos en PDF o imagen." />
                                    <StepCard n="3" title="Sigue" desc="Guarda tu código y consulta el estado cuando quieras." />
                                </div>
                            </div>
                        </Reveal>

                        <Reveal variant="up" delay={120}>
                            <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-orange-50/50 p-6 sm:p-8 shadow-sm h-full">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="h-9 w-9 rounded-xl bg-amber-100 grid place-items-center border border-amber-200">
                                        <AlertTriangle className="h-4 w-4 text-amber-700" />
                                    </div>
                                    <h2 className="pv-display text-xl sm:text-2xl font-extrabold text-amber-900">
                                        Importante
                                    </h2>
                                </div>
                                <ul className="space-y-2.5 text-sm text-amber-900/90">
                                    {[
                                        <>Adjunta en <b>PDF</b> o <b>imagen</b>.</>,
                                        <>Evita caracteres especiales en nombres de archivo (<b>:</b> o <b>"</b>).</>,
                                        <>Guarda tu código: es el <b>"DNI"</b> de tu trámite.</>,
                                    ].map((item, i) => (
                                        <li key={i} className="flex items-start gap-2.5">
                                            <CheckCircle2 className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                                            <span>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                                <div className="mt-4 rounded-xl bg-white/70 border border-amber-200/60 px-4 py-3 text-xs text-amber-800/80 leading-relaxed">
                                    💡 Si tu archivo pesa demasiado, comprímelo antes de adjuntarlo.
                                </div>
                            </div>
                        </Reveal>
                    </section>

                    {/* CTA final */}
                    <Reveal variant="up" className="mt-10 sm:mt-14">
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
                            <p className="text-sm sm:text-[15px] text-slate-600">
                                ¿Solo quieres consultar? Entra directo a{" "}
                                <Link
                                    to="/public/procedures/track"
                                    className="font-extrabold text-blue-700 underline underline-offset-2 hover:text-blue-900 transition-colors"
                                >
                                    Consulta pública
                                </Link>
                                .
                            </p>
                            <Link to="/public/procedures/new" className="w-full sm:w-auto shrink-0">
                                <button className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-blue-950 hover:bg-blue-900 active:scale-[0.99] px-6 py-3 text-white font-extrabold transition-colors duration-200 shadow-lg shadow-blue-950/20">
                                    Iniciar trámite
                                    <ArrowRight className="h-4 w-4" />
                                </button>
                            </Link>
                        </div>
                    </Reveal>

                    {/* Footer */}
                    <p className="py-10 text-center text-xs text-slate-400">
                        © {new Date().getFullYear()} IESPP Gustavo Allende Llavería — Mesa de Partes Virtual
                    </p>
                </div>
            </main>
        </div>
    );
}
