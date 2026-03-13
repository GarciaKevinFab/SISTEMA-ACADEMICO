// src/modules/admission/PublicAdmissionSearch.jsx
// Página pública de verificación de postulante — accesible vía QR de constancia
import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { AdmissionPublic } from "../../services/admission.service";
import {
    Search, User, IdCard, GraduationCap, FileText, Calendar,
    MapPin, Phone, Mail, Award, Camera, CheckCircle2, XCircle,
    AlertCircle, Loader2, ArrowLeft, ShieldCheck,
} from "lucide-react";
import { Button } from "../../components/ui/button";

const STATUS_MAP = {
    REGISTERED:   { label: "Inscrito",          color: "bg-blue-100 text-blue-700 border-blue-200" },
    EVALUATED:    { label: "Evaluado",          color: "bg-purple-100 text-purple-700 border-purple-200" },
    ADMITTED:     { label: "INGRESANTE",        color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    INGRESANTE:   { label: "INGRESANTE",        color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    NOT_ADMITTED: { label: "No admitido",       color: "bg-red-100 text-red-700 border-red-200" },
    WAITING_LIST: { label: "Lista de espera",   color: "bg-amber-100 text-amber-700 border-amber-200" },
};

export default function PublicAdmissionSearch() {
    const [searchParams] = useSearchParams();
    const initialDni = searchParams.get("dni") || "";

    const [dni, setDni] = useState(initialDni);
    const [searching, setSearching] = useState(false);
    const [applicant, setApplicant] = useState(null);
    const [notFound, setNotFound] = useState(false);

    const handleSearch = async (dniValue) => {
        const clean = (dniValue || dni).trim();
        if (clean.length < 8) return;
        setSearching(true);
        setApplicant(null);
        setNotFound(false);
        try {
            const resp = await AdmissionPublic.searchByDni(clean);
            if (resp && (resp.application_id || resp.id)) setApplicant(resp);
            else setNotFound(true);
        } catch (e) {
            if (e?.response?.status === 404) setNotFound(true);
            else setNotFound(true);
        } finally {
            setSearching(false);
        }
    };

    // Auto-search if dni is in URL
    useEffect(() => {
        if (initialDni && initialDni.length >= 8) {
            handleSearch(initialDni);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const st = STATUS_MAP[applicant?.status] || { label: applicant?.status || "", color: "bg-gray-100 text-gray-600 border-gray-200" };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 text-white">
                <div className="max-w-3xl mx-auto px-4 py-6">
                    <div className="flex items-center gap-3 mb-3">
                        <Link to="/public/admission" className="text-white/70 hover:text-white transition">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight">Verificación de Postulante</h1>
                            <p className="text-xs text-blue-200">Sistema de Admisión — IESPP</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-4 -mt-4 pb-12 space-y-5">
                {/* Search card */}
                <div className="bg-white rounded-2xl shadow-lg border border-white/80 p-5">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Buscar por DNI</p>
                    <div className="flex gap-3">
                        <div className="flex-1 relative">
                            <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="text"
                                value={dni}
                                onChange={(e) => setDni(e.target.value.replace(/\D/g, ""))}
                                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                                placeholder="N° de DNI"
                                maxLength={12}
                                className="w-full h-11 pl-11 pr-4 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition"
                            />
                        </div>
                        <Button
                            onClick={() => handleSearch()}
                            disabled={searching || dni.trim().length < 8}
                            className="h-11 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-2"
                        >
                            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Search className="w-4 h-4" /> Buscar</>}
                        </Button>
                    </div>
                </div>

                {/* Loading */}
                {searching && (
                    <div className="text-center py-12">
                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
                        <p className="text-sm text-slate-500">Buscando postulante...</p>
                    </div>
                )}

                {/* Not found */}
                {notFound && !searching && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                        <div>
                            <p className="text-sm font-bold text-amber-800">Postulante no encontrado</p>
                            <p className="text-xs text-amber-700 mt-1">No se encontró ningún postulante con el DNI <strong>{dni}</strong>.</p>
                        </div>
                    </div>
                )}

                {/* Result */}
                {applicant && !searching && (
                    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {/* Verified banner */}
                        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-emerald-800">Postulante Verificado</p>
                                <p className="text-xs text-emerald-600">Este postulante se encuentra registrado en el sistema de admisión.</p>
                            </div>
                            <span className={`ml-auto px-3 py-1 rounded-full text-xs font-bold border ${st.color}`}>
                                {st.label}
                            </span>
                        </div>

                        {/* Profile card */}
                        <div className="bg-white rounded-2xl shadow-lg border overflow-hidden">
                            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
                                <p className="text-white font-bold text-base">Datos del Postulante</p>
                            </div>
                            <div className="p-6">
                                <div className="flex flex-col sm:flex-row gap-6">
                                    {/* Photo */}
                                    <div className="shrink-0 flex flex-col items-center gap-2">
                                        <div className="w-28 h-36 rounded-xl overflow-hidden border-4 border-slate-100 shadow bg-slate-100 flex items-center justify-center">
                                            {applicant.photo_url
                                                ? <img src={applicant.photo_url} alt="Foto" className="w-full h-full object-cover" />
                                                : <Camera className="w-10 h-10 text-slate-300" />}
                                        </div>
                                    </div>

                                    {/* Info grid */}
                                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                                        {[
                                            { icon: User, label: "Nombre completo", value: applicant.full_name || applicant.applicant_name },
                                            { icon: IdCard, label: "DNI", value: applicant.dni || dni },
                                            { icon: GraduationCap, label: "Especialidad", value: applicant.career_name || applicant.career },
                                            { icon: FileText, label: "N° Postulación", value: applicant.application_number },
                                            { icon: Calendar, label: "Fecha de nacimiento", value: applicant.birth_date || applicant.fecha_nacimiento },
                                            { icon: User, label: "Sexo", value: applicant.gender || applicant.sexo },
                                            { icon: MapPin, label: "Domicilio", value: applicant.address || applicant.direccion },
                                            { icon: Phone, label: "Teléfono", value: applicant.phone },
                                            { icon: Mail, label: "Correo", value: applicant.email },
                                            { icon: FileText, label: "Modalidad", value: applicant.admission_mode || applicant.modalidad_admision },
                                            ...(applicant.final_score != null ? [{ icon: Award, label: "Puntaje final", value: `${applicant.final_score}` }] : []),
                                            ...(applicant.merit_order != null ? [{ icon: Award, label: "Orden de mérito", value: `${applicant.merit_order}°` }] : []),
                                        ].filter(f => f.value).map((f, i) => (
                                            <div key={i} className="flex items-start gap-2.5">
                                                <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                                                    <f.icon className="w-3.5 h-3.5 text-slate-400" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{f.label}</p>
                                                    <p className="text-sm font-semibold text-slate-800 truncate">{f.value}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Call info */}
                        {applicant.call_name && (
                            <div className="bg-white rounded-2xl shadow border p-5">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Convocatoria</p>
                                <p className="text-sm font-semibold text-slate-700">{applicant.call_name}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Empty state */}
                {!applicant && !notFound && !searching && (
                    <div className="text-center py-16">
                        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                            <Search className="w-8 h-8 text-slate-300" />
                        </div>
                        <p className="text-base font-bold text-slate-400">Busque un postulante</p>
                        <p className="text-sm text-slate-400 mt-1">Ingrese el número de DNI para verificar la inscripción.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
