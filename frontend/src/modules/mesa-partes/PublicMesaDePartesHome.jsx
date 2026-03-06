import React from "react";
import { Link } from "react-router-dom";
import {
    FileText, Search, ArrowRight, ShieldCheck,
    Paperclip, Clock, Info, AlertTriangle, LogIn, Home,
    CheckCircle2,
} from "lucide-react";

/* ─── Feature Chip ───────────────────────────────────────────── */
const FeatureChip = ({ icon: Icon, title, desc }) => (
    <div className="rounded-2xl bg-white/8 border border-white/10 px-4 py-3.5 hover:bg-white/12 transition-colors duration-200">
        <div className="flex items-center gap-2 text-sm font-extrabold">
            <Icon className="h-4 w-4 text-indigo-300 shrink-0" />
            {title}
        </div>
        <p className="text-xs text-blue-100/70 mt-1.5 leading-relaxed">{desc}</p>
    </div>
);

/* ─── Action Card ────────────────────────────────────────────── */
const ActionCard = ({ to, icon: Icon, iconBg, iconText, label, desc, cta, ctaColor, ringColor }) => (
    <Link
        to={to}
        className={`group rounded-2xl border border-slate-200 bg-white hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 p-5 sm:p-6 focus:outline-none focus-visible:ring-2 ${ringColor}`}
    >
        <div className="flex items-start gap-4">
            <div className={`p-3 rounded-xl shrink-0 border ${iconBg} ${iconText}`}>
                <Icon className="h-6 w-6" />
            </div>
            <div className="min-w-0">
                <p className="text-lg font-extrabold text-slate-900">{label}</p>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">{desc}</p>
                <span className={`mt-3.5 inline-flex items-center gap-1.5 text-sm font-extrabold ${ctaColor}`}>
                    {cta}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
            </div>
        </div>
    </Link>
);

/* ─── Step Card ──────────────────────────────────────────────── */
const StepCard = ({ n, title, desc }) => (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 hover:border-slate-200 hover:bg-white transition-all duration-200">
        <div className="flex items-center gap-3 mb-2">
            <div className="h-8 w-8 rounded-xl bg-slate-900 text-white grid place-items-center font-black text-sm shrink-0">
                {n}
            </div>
            <p className="font-extrabold text-slate-900 text-sm">{title}</p>
        </div>
        <p className="text-sm text-slate-500 leading-relaxed pl-11">{desc}</p>
    </div>
);

/* ─── Main Component ─────────────────────────────────────────── */
export default function PublicMesaDePartesHome() {
    return (
        <div className="min-h-[100dvh] bg-[#0b1630] text-slate-100 overflow-x-hidden">

            {/* ── Background atmosphere ── */}
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="absolute -top-24 -right-40 h-[520px] w-[520px] rounded-full bg-indigo-500/20 blur-[90px]" />
                <div className="absolute top-36 -left-40 h-[520px] w-[520px] rounded-full bg-sky-500/15 blur-[90px]" />
                <div className="absolute bottom-[-160px] right-[-140px] h-[520px] w-[520px] rounded-full bg-fuchsia-500/10 blur-[110px]" />
                <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.02),rgba(255,255,255,0))]" />
            </div>

            {/* ── Header ── */}
            <header className="sticky top-0 z-50 border-b border-white/10 bg-blue-950/70 backdrop-blur-xl">
                <div className="mx-auto max-w-7xl px-4 sm:px-6">
                    <div className="flex h-[76px] items-center justify-between gap-3">
                        {/* Brand */}
                        <div className="flex items-center gap-3 min-w-0">
                            <img
                                src="/logo.png"
                                alt="Logo IESPP"
                                className="h-10 w-10 object-contain drop-shadow"
                                draggable="false"
                            />
                            <div className="min-w-0">
                                <p className="font-extrabold leading-tight truncate text-white">
                                    Mesa de Partes Virtual
                                </p>
                                <p className="text-blue-300/70 text-xs truncate">
                                    IESPP Gustavo Allende Llavería
                                </p>
                            </div>
                        </div>

                        {/* Nav */}
                        <div className="flex items-center gap-2">
                            <Link
                                to="/"
                                className="hidden sm:inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold text-blue-100/80 hover:text-white hover:bg-white/10 transition-colors duration-200"
                            >
                                <Home className="h-4 w-4" />
                                Inicio
                            </Link>
                            <Link
                                to="/login"
                                className="inline-flex items-center gap-2 rounded-full bg-white/10 hover:bg-white/15 px-4 py-2 text-sm font-extrabold text-white border border-white/10 transition-colors duration-200"
                            >
                                <LogIn className="h-4 w-4" />
                                <span className="hidden xs:inline">Acceso interno</span>
                                <span className="xs:hidden">Ingresar</span>
                                <ArrowRight className="h-4 w-4 opacity-70" />
                            </Link>
                        </div>
                    </div>
                </div>
            </header>

            {/* ── Main ── */}
            <main className="relative z-10">
                <section className="mx-auto max-w-7xl px-4 sm:px-6">
                    <div className="min-h-[calc(100dvh-76px)] grid place-items-center py-8 sm:py-12">
                        <div className="w-full max-w-5xl">

                            {/* ── Big Card ── */}
                            <div className="rounded-3xl overflow-hidden border border-white/10 bg-white shadow-[0_24px_64px_rgba(0,0,0,0.40)]">

                                {/* Dark header */}
                                <div className="relative p-6 sm:p-10 bg-gradient-to-br from-[#0f1a3a] via-[#171a55] to-[#251c6c] text-white overflow-hidden">
                                    {/* Radial highlight */}
                                    <div className="absolute inset-0 opacity-15 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_55%)]" />
                                    {/* Subtle grid */}
                                    <div className="absolute inset-0 opacity-[0.04] bg-[linear-gradient(rgba(255,255,255,0.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.8)_1px,transparent_1px)] bg-[size:40px_40px]" />

                                    <div className="relative">
                                        {/* Badge */}
                                        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3.5 py-1 text-xs font-bold text-white/90 backdrop-blur-sm">
                                            <ShieldCheck className="h-3.5 w-3.5 text-indigo-300" />
                                            Registro y seguimiento con código único
                                        </div>

                                        <h1 className="mt-4 text-3xl sm:text-4xl font-black tracking-tight leading-tight">
                                            Trámite Virtual
                                        </h1>
                                        <p className="mt-3 text-sm sm:text-base text-blue-100/80 leading-relaxed max-w-2xl">
                                            Registra tu trámite documentario en línea y haz seguimiento en tiempo real con tu código de expediente.
                                        </p>

                                        {/* Feature chips */}
                                        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <FeatureChip icon={Clock} title="Rápido" desc="Registro en minutos desde cualquier dispositivo." />
                                            <FeatureChip icon={Paperclip} title="Adjuntos" desc="PDF o imagen, hasta varios archivos." />
                                            <FeatureChip icon={Search} title="Seguimiento" desc="Código único para rastrear tu expediente." />
                                        </div>
                                    </div>
                                </div>

                                {/* Light body */}
                                <div className="p-5 sm:p-8 bg-slate-50/80">

                                    {/* Primary actions */}
                                    <div className="grid gap-4 md:grid-cols-2">
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
                                    </div>

                                    {/* Info blocks */}
                                    <div className="mt-5 grid gap-4 lg:grid-cols-[1.7fr_1fr]">

                                        {/* How it works */}
                                        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                                            <div className="flex items-center gap-2 text-slate-900 font-extrabold mb-4">
                                                <div className="h-7 w-7 rounded-lg bg-slate-100 grid place-items-center">
                                                    <Info className="h-4 w-4 text-slate-600" />
                                                </div>
                                                ¿Cómo funciona?
                                            </div>
                                            <div className="grid gap-3 sm:grid-cols-3">
                                                <StepCard n="1" title="Registra" desc="Completa tus datos personales y elige el tipo de trámite." />
                                                <StepCard n="2" title="Adjunta" desc="Sube los documentos requeridos en PDF o imagen." />
                                                <StepCard n="3" title="Sigue" desc="Guarda tu código y consulta el estado cuando quieras." />
                                            </div>
                                        </div>

                                        {/* Important */}
                                        <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-orange-50/50 p-5 sm:p-6">
                                            <div className="flex items-center gap-2 font-extrabold text-amber-900 mb-3.5">
                                                <div className="h-7 w-7 rounded-lg bg-amber-100 grid place-items-center border border-amber-200">
                                                    <AlertTriangle className="h-4 w-4 text-amber-700" />
                                                </div>
                                                Importante
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
                                    </div>

                                    {/* Bottom bar */}
                                    <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                                        <p className="text-sm text-slate-600">
                                            ¿Solo quieres consultar? Entra directo a{" "}
                                            <Link
                                                to="/public/procedures/track"
                                                className="font-extrabold text-blue-700 underline underline-offset-2 hover:text-blue-900 transition-colors"
                                            >
                                                Consulta pública
                                            </Link>
                                            .
                                        </p>
                                        <Link to="/public/procedures/new" className="w-full sm:w-auto">
                                            <button className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.99] px-5 py-3 text-white font-extrabold transition-colors duration-200">
                                                Iniciar trámite
                                                <ArrowRight className="h-4 w-4" />
                                            </button>
                                        </Link>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <p className="mt-6 text-center text-xs text-white/40">
                                © {new Date().getFullYear()} IESPP Gustavo Allende Llavería — Mesa de Partes Virtual
                            </p>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}