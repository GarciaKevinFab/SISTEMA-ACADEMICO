// src/modules/admission/ApplicantDocuments.jsx
//
// Vista de SOLO LECTURA de los documentos subidos por cada postulante.
// La subida se hace en el ApplicationWizard (paso 4).
// Este componente solo muestra estado de revisión y permite ver/descargar.

import React, { useEffect, useState, useCallback } from "react";
import { Applications, ApplicantDocs } from "../../services/admission.service";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import {
    FileText, CheckCircle2, XCircle, Clock, AlertCircle,
    Eye, Camera, Loader2, RefreshCw, Shield, Download,
} from "lucide-react";

const DOC_LABELS = {
    FOTO_CARNET: { label: "Fotografía tamaño carné", icon: Camera },
    COPIA_DNI: { label: "Copia de DNI", icon: FileText },
    PARTIDA_NACIMIENTO: { label: "Partida de Nacimiento", icon: FileText },
    CERTIFICADO_ESTUDIOS: { label: "Certificado de Estudios", icon: FileText },
    CARNET_CONADIS: { label: "Carné CONADIS", icon: Shield },
};

const STATUS_MAP = {
    UPLOADED: { label: "En revisión", color: "bg-blue-50 text-blue-700 border-blue-200", icon: Clock, border: "border-blue-100" },
    APPROVED: { label: "Aprobado", color: "bg-green-50 text-green-700 border-green-200", icon: CheckCircle2, border: "border-green-100" },
    OBSERVED: { label: "Observado", color: "bg-amber-50 text-amber-700 border-amber-200", icon: AlertCircle, border: "border-amber-100" },
    REJECTED: { label: "Rechazado", color: "bg-red-50 text-red-700 border-red-200", icon: XCircle, border: "border-red-100" },
    PENDING: { label: "Pendiente", color: "bg-gray-50 text-gray-500 border-gray-200", icon: Clock, border: "border-gray-100" },
};

export default function ApplicantDocuments() {
    const [apps, setApps] = useState([]);
    const [current, setCurrent] = useState(null);
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingDocs, setLoadingDocs] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                const d = await Applications.my();
                const list = d?.applications || d || [];
                setApps(list);
                if (list.length > 0) setCurrent(list[0]);
            } catch {
                toast.error("No se pudieron cargar las postulaciones");
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const loadDocs = useCallback(async () => {
        if (!current?.id) return;
        setLoadingDocs(true);
        try {
            const d = await ApplicantDocs.listMine(current.id);
            setDocs(d?.documents || d || []);
        } catch {
            toast.error("Error al cargar documentos");
        } finally {
            setLoadingDocs(false);
        }
    }, [current?.id]);

    useEffect(() => { loadDocs(); }, [loadDocs]);

    const approved = docs.filter((d) => d.review_status === "APPROVED").length;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (apps.length === 0) {
        return (
            <Card>
                <CardContent className="py-16 text-center">
                    <FileText className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">Sin postulaciones</h3>
                    <p className="text-sm text-gray-500">Aún no tiene postulaciones registradas.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6 pb-24 sm:pb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Mis Documentos de Postulación</h2>
                    <p className="text-sm text-gray-500 mt-1">Estado de los documentos adjuntados en su postulación.</p>
                </div>
                <Button variant="outline" size="sm" onClick={loadDocs} disabled={loadingDocs} className="rounded-lg shrink-0">
                    <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loadingDocs ? "animate-spin" : ""}`} /> Actualizar
                </Button>
            </div>

            {apps.length > 1 && (
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-600">Postulación:</span>
                    {apps.map((a) => (
                        <Button key={a.id} size="sm" variant={current?.id === a.id ? "default" : "outline"} onClick={() => setCurrent(a)} className="rounded-lg">
                            N° {a.application_number} — {a.admission_call?.name || ""}
                        </Button>
                    ))}
                </div>
            )}

            {current && (
                <Card className="border-blue-100 bg-blue-50/30">
                    <CardContent className="py-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div>
                                <div className="text-sm font-semibold text-gray-900">{current.admission_call?.name || "Proceso de Admisión"}</div>
                                <div className="text-xs text-gray-500">N° {current.application_number} · Estado: {current.status}</div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">{approved}/{docs.length} aprobados</span>
                                <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: docs.length > 0 ? `${(approved / docs.length) * 100}%` : "0%" }} />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {loadingDocs ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                </div>
            ) : docs.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <FileText className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                        <p className="text-sm text-gray-500">No se encontraron documentos para esta postulación.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {docs.map((doc) => {
                        const cfg = DOC_LABELS[doc.document_type] || { label: doc.document_type, icon: FileText };
                        const status = STATUS_MAP[doc.review_status] || STATUS_MAP.PENDING;
                        const StatusIcon = status.icon;
                        const DocIcon = cfg.icon;

                        return (
                            <Card key={doc.id} className={`${status.border} transition-all`}>
                                <CardContent className="py-4">
                                    <div className="flex items-start gap-4">
                                        {doc.document_type === "FOTO_CARNET" && doc.url ? (
                                            <div className="w-16 h-20 rounded-lg overflow-hidden border-2 border-white shadow-sm shrink-0 bg-gray-100">
                                                <img src={doc.url} alt="Foto carné" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = "none"; }} />
                                            </div>
                                        ) : (
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${doc.review_status === "APPROVED" ? "bg-green-100 text-green-600" :
                                                    doc.review_status === "REJECTED" ? "bg-red-100 text-red-500" :
                                                        doc.review_status === "OBSERVED" ? "bg-amber-100 text-amber-600" :
                                                            "bg-blue-100 text-blue-600"
                                                }`}>
                                                <DocIcon className="h-5 w-5" />
                                            </div>
                                        )}

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <div className="font-semibold text-sm text-gray-900">{cfg.label}</div>
                                                    {doc.file_name && <div className="text-xs text-gray-400 mt-0.5 truncate max-w-[280px]">📎 {doc.file_name}</div>}
                                                </div>
                                                <Badge className={`${status.color} border text-[10px] font-semibold flex items-center gap-1 shrink-0`}>
                                                    <StatusIcon className="h-3 w-3" />{status.label}
                                                </Badge>
                                            </div>

                                            {doc.observations && (
                                                <div className={`mt-2 p-2.5 rounded-lg text-xs ${doc.review_status === "OBSERVED" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                                                        doc.review_status === "REJECTED" ? "bg-red-50 text-red-700 border border-red-200" :
                                                            "bg-gray-50 text-gray-600"
                                                    }`}>
                                                    <span className="font-semibold">Observación: </span>{doc.observations}
                                                </div>
                                            )}

                                            {doc.url && (
                                                <div className="mt-2 flex items-center gap-3">
                                                    <a href={doc.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium">
                                                        <Eye className="h-3.5 w-3.5" /> Ver documento
                                                    </a>
                                                    <a href={doc.url} download className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 font-medium">
                                                        <Download className="h-3.5 w-3.5" /> Descargar
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {docs.some((d) => d.review_status === "OBSERVED" || d.review_status === "REJECTED") && (
                <Card className="border-amber-200 bg-amber-50/50">
                    <CardContent className="py-4">
                        <div className="flex gap-3">
                            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                            <div className="text-sm text-amber-800">
                                <p className="font-semibold mb-1">Documentos con observaciones</p>
                                <p className="text-xs text-amber-700">
                                    Tiene documentos observados o rechazados. Acérquese a la oficina de admisión
                                    para regularizar su expediente.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}