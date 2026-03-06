// src/modules/admission/PublicAdmissionCallDetails.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "../../components/ui/button";
import {
    Calendar, Clock, FileText, ChevronLeft,
    Award, School, ExternalLink, ArrowRight,
    CreditCard, Users, Loader2, CheckCircle2,
    AlertCircle, Clock3,
} from "lucide-react";
import { toast } from "sonner";
import { AdmissionCalls } from "../../services/admission.service";

/* ─── Helpers ────────────────────────────────────────────────── */
const fmtDate = (d) => d
    ? new Date(d).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

const getStatus = (call) => {
    if (!call) return "UNKNOWN";
    const now = new Date();
    const s = call.registration_start && new Date(call.registration_start);
    const e = call.registration_end && new Date(call.registration_end);
    if (!s || !e) return "POR_CONFIRMAR";
    if (now < s) return "PROXIMAMENTE";
    if (now <= e) return "ABIERTA";
    return "CERRADA";
};

const STATUS_CONFIG = {
    ABIERTA: { label: "Abierta", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
    PROXIMAMENTE: { label: "Próximamente", cls: "bg-blue-50 text-blue-700 border-blue-200", icon: Clock3 },
    CERRADA: { label: "Cerrada", cls: "bg-slate-100 text-slate-500 border-slate-200", icon: AlertCircle },
    POR_CONFIRMAR: { label: "Por confirmar", cls: "bg-slate-100 text-slate-500 border-slate-200", icon: Clock3 },
    UNKNOWN: { label: "—", cls: "bg-slate-100 text-slate-500 border-slate-200", icon: Clock3 },
};

/* ─── Status Badge ───────────────────────────────────────────── */
const StatusBadge = ({ status }) => {
    const { label, cls, icon: Icon } = STATUS_CONFIG[status] ?? STATUS_CONFIG.UNKNOWN;
    return (
        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border shrink-0 ${cls}`}>
            <Icon size={11} />{label.toUpperCase()}
        </span>
    );
};

/* ─── Info Item ──────────────────────────────────────────────── */
const InfoItem = ({ icon: Icon, label, value }) => (
    <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4 hover:border-slate-200 hover:bg-white transition-colors duration-200">
        <div className="p-2.5 bg-blue-50 rounded-xl border border-blue-100 shrink-0">
            <Icon className="h-4 w-4 text-blue-600" />
        </div>
        <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
            <p className="text-sm font-bold text-slate-700 mt-0.5 leading-snug">{value}</p>
        </div>
    </div>
);

/* ─── Career Row ─────────────────────────────────────────────── */
const CareerRow = ({ career }) => (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white p-4 hover:border-indigo-200 hover:bg-indigo-50/20 transition-all duration-200">
        <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-100 grid place-items-center shrink-0">
                <School size={14} className="text-indigo-600" />
            </div>
            <p className="text-sm font-semibold text-slate-800 truncate">{career.name}</p>
        </div>
        {career.vacancies != null && (
            <span className="inline-flex items-center gap-1.5 shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                <Users size={10} />{career.vacancies} vac.
            </span>
        )}
    </div>
);

/* ─── Main Component ─────────────────────────────────────────── */
export default function PublicAdmissionCallDetails({
    call: callProp,
    onApply,
    onOpenReglamento,
}) {
    const { id } = useParams();
    const navigate = useNavigate();

    const [call, setCall] = useState(callProp || null);
    const [loading, setLoading] = useState(!callProp);

    useEffect(() => {
        if (callProp) { setCall(callProp); setLoading(false); return; }
        if (!id) return;
        (async () => {
            try {
                setLoading(true);
                const data = await AdmissionCalls.getPublicById(id);
                if (!data) {
                    toast.error("Convocatoria no encontrada");
                    navigate("/public/admission", { replace: true });
                    return;
                }
                setCall(data);
            } catch {
                toast.error("Error al cargar convocatoria");
                navigate("/public/admission", { replace: true });
            } finally {
                setLoading(false);
            }
        })();
    }, [id, callProp, navigate]);

    const status = useMemo(() => getStatus(call), [call]);
    const isOpen = status === "ABIERTA";

    /* ── Loading ── */
    if (loading) {
        return (
            <div className="py-16 flex flex-col items-center gap-3 text-center">
                <Loader2 size={28} className="animate-spin text-blue-400" />
                <p className="text-sm text-slate-500 font-medium">Cargando convocatoria…</p>
            </div>
        );
    }

    if (!call) return null;

    return (
        <div className="space-y-5">
            {/* Back button (standalone page only) */}
            {!callProp && (
                <Button variant="ghost" onClick={() => navigate("/public/admission")}
                    className="rounded-xl gap-1.5 font-semibold text-slate-600 -ml-2">
                    <ChevronLeft size={16} /> Volver a convocatorias
                </Button>
            )}

            {/* ── Header card ── */}
            <div className={`rounded-2xl border bg-white overflow-hidden ${isOpen ? "border-emerald-200" : "border-slate-200"}`}>
                {isOpen && <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-400" />}
                <div className="px-6 py-5 bg-gradient-to-r from-slate-50/60 to-white">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 leading-tight">{call.name}</h2>
                            {call.description && (
                                <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{call.description}</p>
                            )}
                        </div>
                        <StatusBadge status={status} />
                    </div>
                </div>
            </div>

            {/* ── Info grid ── */}
            <div className="grid sm:grid-cols-2 gap-3">
                <InfoItem icon={Calendar} label="Período de Inscripción"
                    value={`${fmtDate(call.registration_start)} – ${fmtDate(call.registration_end)}`} />
                <InfoItem icon={Clock} label="Fecha de Examen"
                    value={call.exam_date ? fmtDate(call.exam_date) : "Por definir"} />
                <InfoItem icon={School} label="Periodo Académico"
                    value={`${call.academic_year}${call.academic_period ? "-" + call.academic_period : ""}`} />
                <InfoItem icon={CreditCard} label="Costo de Inscripción"
                    value={Number(call.application_fee) > 0 ? `S/ ${Number(call.application_fee).toFixed(2)}` : "Sin costo"} />
            </div>

            {/* ── Careers ── */}
            {!!call.careers?.length && (
                <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                    <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
                        <div className="h-7 w-7 rounded-lg bg-indigo-50 border border-indigo-100 grid place-items-center">
                            <Award size={13} className="text-indigo-600" />
                        </div>
                        <h4 className="font-extrabold text-slate-800 text-sm">
                            Programas Disponibles
                            <span className="text-slate-400 font-normal ml-1.5 text-xs">
                                ({call.careers.length} carrera{call.careers.length > 1 ? "s" : ""})
                            </span>
                        </h4>
                    </div>
                    <div className="p-4 grid sm:grid-cols-2 gap-3">
                        {call.careers.map((c) => <CareerRow key={c.id} career={c} />)}
                    </div>
                </div>
            )}

            {/* ── Actions ── */}
            <div className="flex flex-col sm:flex-row gap-3 pt-1">
                <Button
                    variant="outline"
                    className="rounded-xl font-semibold gap-2 h-11"
                    onClick={onOpenReglamento}
                >
                    <FileText size={15} />
                    Reglamento
                    <ExternalLink size={12} className="opacity-60" />
                </Button>

                <Button
                    className={`rounded-xl font-extrabold gap-2 h-11 flex-1 sm:flex-none ${isOpen
                            ? "bg-blue-600 hover:bg-blue-700 text-white"
                            : "bg-slate-200 text-slate-500 cursor-not-allowed hover:bg-slate-200"
                        }`}
                    onClick={() => {
                        if (!isOpen) {
                            toast.info("Las inscripciones no están abiertas en este momento.");
                            return;
                        }
                        onApply ? onApply() : navigate(`/public/admission/${call.id}/apply`);
                    }}
                >
                    {isOpen ? "Postular ahora" : "Inscripciones cerradas"}
                    {isOpen && <ArrowRight size={15} />}
                </Button>
            </div>

            {/* Closed notice */}
            {!isOpen && status !== "POR_CONFIRMAR" && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5">
                    <AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-800 font-medium leading-snug">
                        {status === "PROXIMAMENTE"
                            ? `Las inscripciones abren el ${fmtDate(call.registration_start)}. ¡Vuelve pronto!`
                            : "Este proceso de admisión ya cerró. Consulta las próximas convocatorias."}
                    </p>
                </div>
            )}
        </div>
    );
}