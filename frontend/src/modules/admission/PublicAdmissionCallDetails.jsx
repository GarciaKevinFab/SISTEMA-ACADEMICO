import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Calendar, Clock, FileText, ChevronLeft, Award, School, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { AdmissionCalls } from "../../services/admission.service";

const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" }) : "-";

export default function PublicAdmissionCallDetails() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [call, setCall] = useState(null);
    const [loading, setLoading] = useState(true);

    const status = useMemo(() => {
        if (!call) return "UNKNOWN";
        const now = new Date();
        const regStart = call?.registration_start ? new Date(call.registration_start) : null;
        const regEnd = call?.registration_end ? new Date(call.registration_end) : null;

        if (!regStart || !regEnd) return "POR_CONFIRMAR";
        if (now < regStart) return "PROXIMAMENTE";
        if (now >= regStart && now <= regEnd) return "ABIERTA";
        return "CERRADA";
    }, [call]);

    const badge = useMemo(() => {
        const base = "rounded-full px-3 py-1 text-xs font-semibold tracking-wide shadow-sm";
        if (status === "ABIERTA") return <Badge className={`bg-emerald-600 hover:bg-emerald-700 ${base}`}>INSCRIPCIONES ABIERTAS</Badge>;
        if (status === "PROXIMAMENTE") return <Badge className={`bg-blue-50 text-blue-700 hover:bg-blue-100 ${base}`}>PRÓXIMAMENTE</Badge>;
        if (status === "CERRADA") return <Badge variant="outline" className={`text-gray-500 border-gray-300 ${base}`}>CERRADA</Badge>;
        return <Badge variant="secondary" className={base}>POR CONFIRMAR</Badge>;
    }, [status]);

    const getReglamentoUrl = (c) => {
        const candidate =
            c?.regulation_url ||
            c?.reglamento_url ||
            c?.rules_url ||
            c?.regulationPdf ||
            c?.regulation_pdf ||
            c?.reglamento_pdf ||
            c?.documents?.reglamento ||
            c?.documents?.rules ||
            null;

        return typeof candidate === "string" && candidate.trim() ? candidate.trim() : null;
    };

    const openReglamento = () => {
        const url = getReglamentoUrl(call);
        if (!url) return toast.error("Esta convocatoria no tiene reglamento cargado.");
        window.open(url, "_blank", "noopener,noreferrer");
    };

    useEffect(() => {
        let mounted = true;

        const run = async () => {
            try {
                setLoading(true);
                const data = await AdmissionCalls.getPublicById(id);
                if (!mounted) return;

                if (!data) {
                    toast.error("No se encontró la convocatoria.");
                    navigate("/public/admission", { replace: true });
                    return;
                }

                setCall(data);
            } catch (e) {
                console.error(e);
                toast.error("Error al cargar el detalle de la convocatoria.");
                navigate("/public/admission", { replace: true });
            } finally {
                if (mounted) setLoading(false);
            }
        };

        run();
        return () => {
            mounted = false;
        };
    }, [id, navigate]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            </div>
        );
    }

    if (!call) return null;

    return (
        <div className="min-h-screen bg-[#F8F9FA] px-6 py-10 md:px-12">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex items-center justify-between gap-3">
                    <Button type="button" variant="outline" className="h-10" onClick={() => navigate("/public/admission")}>
                        <ChevronLeft className="h-4 w-4 mr-2" />
                        Volver
                    </Button>

                    <div>{badge}</div>
                </div>

                <Card className="border border-gray-200 shadow-sm rounded-xl overflow-hidden bg-white">
                    <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-white to-gray-50/50">
                        <CardTitle className="text-2xl font-bold text-slate-900">{call.name}</CardTitle>
                        {call.description ? (
                            <CardDescription className="text-slate-600 text-base mt-1">{call.description}</CardDescription>
                        ) : (
                            <CardDescription className="text-slate-500">Sin descripción</CardDescription>
                        )}
                    </CardHeader>

                    <CardContent className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-blue-50 rounded-lg text-blue-600 shrink-0">
                                    <Calendar className="h-4 w-4" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Inscripción</p>
                                    <p className="text-sm font-medium text-slate-700">
                                        {fmtDate(call.registration_start)} - {fmtDate(call.registration_end)}
                                    </p>
                                </div>
                            </div>

                            {call.exam_date && (
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-blue-50 rounded-lg text-blue-600 shrink-0">
                                        <Clock className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Examen</p>
                                        <p className="text-sm font-medium text-slate-700">{fmtDate(call.exam_date)}</p>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-blue-50 rounded-lg text-blue-600 shrink-0">
                                    <School className="h-4 w-4" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Periodo</p>
                                    <p className="text-sm font-medium text-slate-700">
                                        {call.academic_year}
                                        {call.academic_period ? `-${call.academic_period}` : ""}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-blue-50 rounded-lg text-blue-600 shrink-0">
                                    <FileText className="h-4 w-4" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Costo</p>
                                    <p className="text-sm font-medium text-slate-700">
                                        {Number(call.application_fee) > 0 ? `S/ ${Number(call.application_fee).toFixed(2)}` : "Gratuito"}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {!!(call.careers || []).length && (
                            <div>
                                <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                    <Award className="h-4 w-4 text-blue-600" />
                                    Programas Disponibles
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {call.careers.map((career) => (
                                        <div
                                            key={String(career.id ?? career.career_id)}
                                            className="inline-flex items-center px-3 py-1.5 rounded-md bg-slate-100 text-slate-700 text-sm font-medium border border-slate-200"
                                        >
                                            {career.name}
                                            {career.vacancies != null && (
                                                <span className="ml-2 text-slate-400 text-xs border-l border-slate-300 pl-2">
                                                    {career.vacancies} vac.
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex flex-wrap items-center gap-3">
                            <Button type="button" variant="outline" className="h-10" onClick={openReglamento}>
                                Reglamento <ExternalLink className="h-4 w-4 ml-2" />
                            </Button>

                            <Button
                                type="button"
                                className="h-10 bg-blue-600 hover:bg-blue-700 text-white"
                                onClick={() => toast.info("Aquí puedes poner el flujo de postulación pública si aplica.")}
                            >
                                Postular (opcional)
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
