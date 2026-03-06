// AcademicProcesses.jsx — PROCESOS ACADÉMICOS (v5 — solicitud simplificada)
// ═══════════════════════════════════════════════════════════════════════
// Solo 5 tipos de documentos basados en plantillas reales de la institución.
//
// CONSTANCIA_ESTUDIOS y FICHA_MATRICULA: el alumno solo selecciona el tipo
// y escribe el motivo. Todos los datos (carrera, ciclo, cursos, etc.)
// se obtienen automáticamente del perfil del alumno en la BD.
//
// Solo piden datos extra los docs que genuinamente los necesitan:
//   - Orden de mérito → puesto, rango de semestres
//   - Tercio superior → puesto, nº egresados, promedio, etc.
//   - Certificado de egresado → créditos, promoción

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { PERMS } from "@/auth/permissions";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog, DialogContent, DialogDescription,
    DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

import {
    Save, Clock, FileText, Users, GraduationCap, ClipboardList,
    CheckCircle, XCircle, Eye, ArrowRight, RotateCw, ChevronRight,
    Inbox, BookOpen, Paperclip, Download, Send, ShieldCheck,
    AlertCircle, FileDown, Printer, RefreshCw, ExternalLink,
    Award, Trophy, ScrollText, BookOpenCheck, Info,
} from "lucide-react";

import { Processes, ProcessesInbox, ProcessFiles } from "@/services/academic.service";


/* ═══════════════════════════════════════════════════════════════
   TIPOS DE DOCUMENTOS
   ═══════════════════════════════════════════════════════════════
   fields: [] → el sistema obtiene todo de la BD automáticamente
   fields: [...] → campos que el admin debe ingresar manualmente
   ═══════════════════════════════════════════════════════════════ */

const DOCUMENT_TYPES = {
    CONSTANCIA_ESTUDIOS: {
        label: "Constancia de Estudios",
        description: "Certifica que eres estudiante regular. El sistema obtiene automáticamente tu carrera, semestre, sección y turno.",
        Icon: ScrollText,
        color: "text-blue-600",
        bg: "bg-blue-50",
        border: "border-blue-200",
        group: "CONSTANCIAS",
        fields: [],          // ← sin campos: todo viene del perfil del alumno
        firmante: "Secretaria Académica",
        autoData: true,      // indicador visual de que los datos son automáticos
    },
    CONSTANCIA_ORDEN_MERITO: {
        label: "Constancia de Orden de Mérito",
        description: "El sistema calcula automáticamente tu puesto y promedios ponderados por semestre comparando con todos los alumnos de tu carrera.",
        Icon: Trophy,
        color: "text-amber-600",
        bg: "bg-amber-50",
        border: "border-amber-200",
        group: "CONSTANCIAS",
        fields: ["merit_type", "target_term"],   // solo elegir variante
        firmante: "Secretario(a) Académico(a)",
        autoData: true,
    },
    CONSTANCIA_TERCIO: {
        label: "Constancia de Tercio Superior",
        description: "El sistema calcula automáticamente tu puesto entre los egresados de tu carrera y el promedio del tercio superior.",
        Icon: Award,
        color: "text-emerald-600",
        bg: "bg-emerald-50",
        border: "border-emerald-200",
        group: "CONSTANCIAS",
        fields: ["promotion_year"],   // solo el año del cohorte para filtrar correctamente
        firmante: "Directora General",
        autoData: true,
    },
    CERTIFICADO_EGRESADO: {
        label: "Certificado de Egresado",
        description: "Certificado oficial SIA. El sistema calcula los créditos aprobados del plan de estudios automáticamente.",
        Icon: GraduationCap,
        color: "text-indigo-600",
        bg: "bg-indigo-50",
        border: "border-indigo-200",
        group: "CERTIFICADOS",
        // promotion_year y promotion_period son opcionales: el sistema los infiere
        // del último term con notas si no se ingresan
        fields: ["promotion_year", "promotion_period"],
        firmante: "Directora General + Secretario + Jefe Unidad Académica",
        autoData: true,
    },
    FICHA_MATRICULA: {
        label: "Ficha de Matrícula",
        description: "Ficha con datos de la institución, programa, datos del alumno y tabla completa de cursos del ciclo actual.",
        Icon: BookOpenCheck,
        color: "text-violet-600",
        bg: "bg-violet-50",
        border: "border-violet-200",
        group: "FICHAS",
        fields: [],          // ← sin campos: cursos y datos vienen del plan del alumno
        firmante: "—",
        autoData: true,
    },
};

const FIELD_DEFS = {
    // Orden de mérito (auto-calculado, solo se elige variante)
    merit_type: {
        label: "Tipo de constancia", placeholder: "", type: "select",
        options: [
            { value: "CARRERA", label: "Toda la carrera (I al X semestres)" },
            { value: "SEMESTRE", label: "Un semestre específico" },
        ]
    },
    target_term: { label: "Período del semestre", placeholder: "Ej: 2025-I (solo si es semestre)", type: "text" },
    // Tercio superior
    total_graduates: { label: "Nº egresados en mérito", placeholder: "Ej: 25", type: "number" },
    tercio_average: { label: "Promedio del tercio", placeholder: "Ej: 14.85", type: "text" },
    promotion_year: { label: "Año de promoción (opcional)", placeholder: "Ej: 2022 — si no se completa el sistema lo infiere", type: "text" },
    promotion_period: { label: "Período de promoción (opcional)", placeholder: "Ej: II — si no se completa el sistema lo infiere", type: "text" },
    academic_year: { label: "Años académicos", placeholder: "Ej: 2019-2024", type: "text" },
};


/* ═══════════════════════════════════════════════════════════════
   ESTADOS
   ═══════════════════════════════════════════════════════════════ */

const STATUS_CONFIG = {
    PENDIENTE: { label: "Pendiente", color: "bg-yellow-100 text-yellow-800 border-yellow-300", Icon: Clock },
    EN_REVISION: { label: "En revisión", color: "bg-blue-100 text-blue-800 border-blue-300", Icon: Eye },
    APROBADO: { label: "Aprobado", color: "bg-green-100 text-green-800 border-green-300", Icon: CheckCircle },
    EJECUTADO: { label: "Ejecutado", color: "bg-emerald-100 text-emerald-800 border-emerald-300", Icon: CheckCircle },
    RECHAZADO: { label: "Rechazado", color: "bg-red-100 text-red-800 border-red-300", Icon: XCircle },
    ANULADO: { label: "Anulado", color: "bg-gray-100 text-gray-600 border-gray-300", Icon: XCircle },
};

const DOWNLOAD_ALLOWED = ["APROBADO", "EJECUTADO"];

const VALID_TRANSITIONS = {
    PENDIENTE: ["EN_REVISION", "RECHAZADO", "ANULADO"],
    EN_REVISION: ["APROBADO", "RECHAZADO", "ANULADO"],
    APROBADO: ["EJECUTADO", "ANULADO"],
    EJECUTADO: ["ANULADO"],
    RECHAZADO: ["PENDIENTE"],
    ANULADO: [],
};


/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */

function useIsAdmin() {
    const { hasAny } = useAuth();
    return hasAny([
        PERMS["academic.reports.view"],
        PERMS["academic.processes.inbox.view"],
    ]);
}

function StatusBadge({ status }) {
    const cfg = STATUS_CONFIG[status] || { label: status, color: "bg-gray-100 text-gray-600", Icon: Clock };
    return (
        <Badge variant="outline" className={`${cfg.color} rounded-full gap-1 px-2.5 py-0.5 text-xs font-medium border`}>
            <cfg.Icon className="h-3 w-3" />{cfg.label}
        </Badge>
    );
}


/* ═══════════════════════════════════════════════════════════════
   FORMULARIO NUEVA SOLICITUD
   ═══════════════════════════════════════════════════════════════ */
function ProcessRequestForm({ onCreated }) {
    const isAdmin = useIsAdmin();
    const [selectedType, setSelectedType] = useState("");
    const [studentId, setStudentId] = useState("");
    const [reason, setReason] = useState("");
    const [extraFields, setExtraFields] = useState({});
    const [submitting, setSubmitting] = useState(false);

    const typeCfg = DOCUMENT_TYPES[selectedType] || null;
    const hasExtraFields = typeCfg && typeCfg.fields.length > 0;

    useEffect(() => {
        setExtraFields({});
    }, [selectedType]);

    const updateField = (key, value) => {
        setExtraFields(prev => ({ ...prev, [key]: value }));
    };

    const submit = async () => {
        if (!selectedType) return toast.error("Selecciona el tipo de documento");
        if (!reason.trim()) return toast.error("Escribe el motivo de la solicitud");
        if (isAdmin && !studentId.trim()) return toast.error("Ingresa el ID/DNI del estudiante");

        setSubmitting(true);
        try {
            const payload = {
                reason: reason.trim(),
                extra: JSON.stringify(extraFields),
            };

            if (isAdmin && studentId.trim()) {
                payload.student_id = studentId.trim();
            }

            await Processes.create(selectedType, payload);

            toast.success(`Solicitud de "${typeCfg.label}" registrada`);
            setSelectedType("");
            setReason("");
            setExtraFields({});
            setStudentId("");
            onCreated?.();
        } catch (e) {
            toast.error(e?.message || "Error al registrar solicitud");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Card className="border shadow-sm bg-white rounded-xl">
            <CardHeader className="px-6 pt-6">
                <div className="flex items-center gap-2">
                    <Send className="h-5 w-5 text-[#2196F3]" />
                    <CardTitle className="text-[#2196F3]">
                        {isAdmin ? "Crear solicitud de documento" : "Solicitar documento"}
                    </CardTitle>
                </div>
                <CardDescription className="text-[#1976D2]">
                    {isAdmin
                        ? "Genera un documento oficial a nombre de un alumno."
                        : "Selecciona el documento que necesitas. Será revisado por el área académica."}
                </CardDescription>
            </CardHeader>

            <CardContent className="px-6 pb-6 space-y-5">

                {/* 1. Tipo de documento */}
                <div>
                    <Label className="text-sm font-semibold">1. ¿Qué documento necesitas?</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
                        {Object.entries(DOCUMENT_TYPES).map(([key, dt]) => (
                            <button key={key} type="button"
                                onClick={() => setSelectedType(key)}
                                className={`p-3 rounded-xl border-2 text-left transition-all ${selectedType === key
                                        ? `${dt.border} ${dt.bg} shadow-sm`
                                        : "border-gray-200 bg-white hover:bg-gray-50"
                                    }`}>
                                <div className="flex items-center gap-2">
                                    <dt.Icon className={`h-5 w-5 ${dt.color}`} />
                                    <span className="font-medium text-sm text-black">{dt.label}</span>
                                    {dt.autoData && (
                                        <Badge variant="outline"
                                            className="text-[9px] px-1.5 py-0 rounded-full border-green-300 text-green-700 bg-green-50 ml-auto">
                                            automático
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{dt.description}</p>
                                <p className="text-[10px] text-gray-400 mt-1">Firma: {dt.firmante}</p>
                            </button>
                        ))}
                    </div>
                </div>

                {/* 2. Datos */}
                {typeCfg && (
                    <div className="space-y-4 border-t pt-4">
                        <div className="flex items-center gap-2">
                            <typeCfg.Icon className={`h-5 w-5 ${typeCfg.color}`} />
                            <Label className="text-sm font-semibold">2. {typeCfg.label}</Label>
                        </div>

                        {/* ID del alumno solo para admin */}
                        {isAdmin && (
                            <div className="max-w-xs">
                                <Label className="text-xs">ID / DNI Estudiante *</Label>
                                <Input
                                    value={studentId}
                                    onChange={e => setStudentId(e.target.value)}
                                    placeholder="Ej: 71234567"
                                    className="rounded-xl mt-1"
                                />
                            </div>
                        )}

                        {/* Campos extra solo si el tipo los necesita */}
                        {hasExtraFields && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {typeCfg.fields.map(fieldKey => {
                                    const fd = FIELD_DEFS[fieldKey];
                                    if (!fd) return null;

                                    // Campo tipo select (merit_type)
                                    if (fd.type === "select") {
                                        return (
                                            <div key={fieldKey}>
                                                <Label className="text-xs">{fd.label}</Label>
                                                <Select
                                                    value={extraFields[fieldKey] || ""}
                                                    onValueChange={val => updateField(fieldKey, val)}>
                                                    <SelectTrigger className="rounded-xl mt-1">
                                                        <SelectValue placeholder="Selecciona..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {(fd.options || []).map(opt => (
                                                            <SelectItem key={opt.value} value={opt.value}>
                                                                {opt.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        );
                                    }

                                    // target_term solo aparece si merit_type === SEMESTRE
                                    if (fieldKey === "target_term" && extraFields["merit_type"] !== "SEMESTRE") {
                                        return null;
                                    }

                                    return (
                                        <div key={fieldKey}>
                                            <Label className="text-xs">{fd.label}</Label>
                                            <Input
                                                type={fd.type || "text"}
                                                value={extraFields[fieldKey] || ""}
                                                onChange={e => updateField(fieldKey, e.target.value)}
                                                placeholder={fd.placeholder}
                                                className="rounded-xl mt-1"
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Aviso de datos automáticos */}
                        {typeCfg.autoData && (
                            <div className="flex items-start gap-2 p-3 rounded-xl bg-green-50 border border-green-200">
                                <Info className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                                <p className="text-xs text-green-800">
                                    <strong>Sin datos adicionales requeridos.</strong> El sistema generará el documento
                                    automáticamente con tus datos académicos actuales (carrera, ciclo, sección, turno,
                                    cursos, etc.).
                                </p>
                            </div>
                        )}

                        {/* Motivo */}
                        <div>
                            <Label className="text-xs">Motivo / Sustento *</Label>
                            <Textarea
                                value={reason}
                                onChange={e => setReason(e.target.value)}
                                placeholder="Describe brevemente para qué necesitas este documento..."
                                className="rounded-xl mt-1"
                                rows={2}
                            />
                        </div>

                        <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 border border-blue-200">
                            <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                            <p className="text-xs text-blue-800">
                                {isAdmin
                                    ? "Al generar, el sistema crea automáticamente el PDF con los datos del alumno, logo y firmas institucionales."
                                    : "Tu solicitud será revisada. Cuando esté lista, podrás descargar el PDF desde \"Mis solicitudes\"."}
                            </p>
                        </div>

                        <div className="flex justify-end">
                            <Button onClick={submit} disabled={submitting} className="gap-2 rounded-xl">
                                <Send className="h-4 w-4" />
                                {submitting ? "Enviando..." : "Enviar solicitud"}
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}


/* ═══════════════════════════════════════════════════════════════
   MIS SOLICITUDES (VISTA ALUMNO)
   ═══════════════════════════════════════════════════════════════ */
function MyRequestsList({ processes, loading, onSelect, onRefresh }) {
    const [search, setSearch] = useState("");

    const filtered = useMemo(() => {
        let list = Array.isArray(processes) ? processes : [];
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(p =>
                (DOCUMENT_TYPES[p.type]?.label || p.type_label || p.type || "").toLowerCase().includes(q) ||
                String(p.id || "").includes(q)
            );
        }
        return list;
    }, [processes, search]);

    return (
        <Card className="border shadow-sm bg-white rounded-xl">
            <CardHeader className="px-6 pt-6">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                        <ClipboardList className="h-5 w-5 text-[#2196F3]" />
                        <CardTitle className="text-[#2196F3]">Mis solicitudes</CardTitle>
                    </div>
                    <Button variant="outline" size="sm" className="rounded-xl gap-1" onClick={onRefresh}>
                        <RotateCw className="h-3.5 w-3.5" /> Actualizar
                    </Button>
                </div>
                <CardDescription className="text-[#1976D2]">
                    Cuando tu documento esté listo, podrás descargarlo aquí.
                </CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-6 space-y-3">
                <Input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar por tipo o número..." className="rounded-xl" />
                <ScrollArea className="max-h-[60vh]">
                    {loading && <div className="text-center text-gray-500 py-8">Cargando...</div>}
                    {!loading && filtered.length === 0 && (
                        <div className="text-center py-10">
                            <FileText className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                            <p className="text-gray-400 text-sm">No tienes solicitudes</p>
                        </div>
                    )}
                    <div className="space-y-2">
                        {filtered.map(p => {
                            const dt = DOCUMENT_TYPES[p.type] || {};
                            const ready = DOWNLOAD_ALLOWED.includes(p.status);
                            const hasFiles = (p.files_count || 0) > 0 || (Array.isArray(p.files) && p.files.length > 0);
                            const DtIcon = dt.Icon || FileText;
                            return (
                                <button key={p.id} type="button" onClick={() => onSelect?.(p)}
                                    className="w-full text-left p-4 rounded-xl border hover:bg-gray-50 hover:shadow-sm transition-all group">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <DtIcon className={`h-4 w-4 ${dt.color || "text-gray-500"} shrink-0`} />
                                                <span className="font-medium text-sm text-black">
                                                    #{p.id} — {dt.label || p.type_label || p.type}
                                                </span>
                                                <StatusBadge status={p.status} />
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1.5">
                                                {p.created_at && new Date(p.created_at).toLocaleDateString()}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0 mt-1">
                                            {ready && hasFiles && (
                                                <Badge className="rounded-full bg-emerald-100 text-emerald-700 border-emerald-300 gap-1 text-[10px]">
                                                    <FileDown className="h-3 w-3" /> Listo
                                                </Badge>
                                            )}
                                            {ready && !hasFiles && (
                                                <Badge className="rounded-full bg-blue-100 text-blue-700 border-blue-300 gap-1 text-[10px]">
                                                    <CheckCircle className="h-3 w-3" /> Aprobado
                                                </Badge>
                                            )}
                                            <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500" />
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}


/* ═══════════════════════════════════════════════════════════════
   BANDEJA ADMIN
   ═══════════════════════════════════════════════════════════════ */
function AdminInbox({ processes, loading, onSelect, onRefresh }) {
    const [filterStatus, setFilterStatus] = useState("ALL");
    const [filterType, setFilterType] = useState("ALL");
    const [search, setSearch] = useState("");

    const filtered = useMemo(() => {
        let list = Array.isArray(processes) ? processes : [];
        if (filterStatus !== "ALL") list = list.filter(p => p.status === filterStatus);
        if (filterType !== "ALL") list = list.filter(p => p.type === filterType);
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(p =>
                (DOCUMENT_TYPES[p.type]?.label || p.type_label || p.type || "").toLowerCase().includes(q) ||
                (p.student_name || "").toLowerCase().includes(q) ||
                String(p.student_id || "").includes(q) ||
                String(p.id || "").includes(q)
            );
        }
        return list;
    }, [processes, filterStatus, filterType, search]);

    const counts = useMemo(() => {
        const c = {};
        (Array.isArray(processes) ? processes : []).forEach(p => {
            c[p.status] = (c[p.status] || 0) + 1;
        });
        return c;
    }, [processes]);

    return (
        <Card className="border shadow-sm bg-white rounded-xl">
            <CardHeader className="px-6 pt-6">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                        <Inbox className="h-5 w-5 text-[#2196F3]" />
                        <CardTitle className="text-[#2196F3]">Bandeja de solicitudes</CardTitle>
                    </div>
                    <Button variant="outline" size="sm" className="rounded-xl gap-1" onClick={onRefresh}>
                        <RotateCw className="h-3.5 w-3.5" /> Refrescar
                    </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                    {Object.entries(counts).map(([st, count]) => {
                        const cfg = STATUS_CONFIG[st] || {};
                        return (
                            <button key={st} type="button"
                                onClick={() => setFilterStatus(filterStatus === st ? "ALL" : st)}
                                className={`text-xs px-2.5 py-1 rounded-full border transition-all ${filterStatus === st
                                        ? cfg.color || "bg-blue-100"
                                        : "bg-gray-50 hover:bg-gray-100 border-gray-200"
                                    }`}>
                                {cfg.label || st}: {count}
                            </button>
                        );
                    })}
                </div>
            </CardHeader>
            <CardContent className="px-6 pb-6 space-y-3">
                <div className="flex flex-col sm:flex-row gap-2">
                    <Input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar por alumno, tipo, ID..."
                        className="rounded-xl flex-1" />
                    <Select value={filterType} onValueChange={setFilterType}>
                        <SelectTrigger className="w-full sm:w-56 rounded-xl">
                            <SelectValue placeholder="Tipo de documento" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Todos los documentos</SelectItem>
                            {Object.entries(DOCUMENT_TYPES).map(([k, v]) => (
                                <SelectItem key={k} value={k}>{v.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <ScrollArea className="max-h-[60vh]">
                    {loading && <div className="text-center text-gray-500 py-8">Cargando...</div>}
                    {!loading && filtered.length === 0 && (
                        <div className="text-center text-gray-400 py-8">Sin solicitudes</div>
                    )}
                    <div className="space-y-2">
                        {filtered.map(p => {
                            const dt = DOCUMENT_TYPES[p.type] || {};
                            const DtIcon = dt.Icon || FileText;
                            return (
                                <button key={p.id} type="button" onClick={() => onSelect?.(p)}
                                    className="w-full text-left p-3 rounded-xl border hover:bg-gray-50 hover:shadow-sm transition-all group">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <DtIcon className={`h-4 w-4 ${dt.color || "text-gray-500"} shrink-0`} />
                                                <span className="font-medium text-sm text-black">
                                                    #{p.id} — {dt.label || p.type_label || p.type}
                                                </span>
                                                <StatusBadge status={p.status} />
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1">
                                                <span className="font-medium text-gray-700">
                                                    {p.student_name || `Est. ${p.student_id}`}
                                                </span>
                                                {p.created_at && ` · ${new Date(p.created_at).toLocaleDateString()}`}
                                            </div>
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500 shrink-0 mt-1" />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}


/* ═══════════════════════════════════════════════════════════════
   DETALLE DE PROCESO — DIALOG
   ═══════════════════════════════════════════════════════════════ */
function ProcessDetailDialog({ process, open, onOpenChange, onUpdated }) {
    const isAdmin = useIsAdmin();
    const [statusNote, setStatusNote] = useState("");
    const [changing, setChanging] = useState(false);
    const [files, setFiles] = useState([]);
    const [generating, setGenerating] = useState(false);

    const p = process || {};
    const dt = DOCUMENT_TYPES[p.type] || {};
    const DtIcon = dt.Icon || FileText;
    const transitions = isAdmin ? (VALID_TRANSITIONS[p.status] || []) : [];
    const canDownload = DOWNLOAD_ALLOWED.includes(p.status);

    const timeline = useMemo(() => {
        const h = p.metadata?.history;
        return Array.isArray(h) ? h : [];
    }, [p.metadata]);

    useEffect(() => {
        if (!p.id || !open) return;
        (async () => {
            try {
                const res = await ProcessFiles.list(p.id);
                setFiles(Array.isArray(res?.files) ? res.files : p.files || []);
            } catch {
                setFiles(p.files || []);
            }
        })();
    }, [p.id, open]);

    const generateDocument = async (force = false) => {
        if (!p.id) return;
        setGenerating(true);
        try {
            const res = await ProcessFiles.generate(p.id, {
                force,
                document_type: p.type,
            });
            if (res?.already_exists && !force) {
                toast.info("El documento ya fue generado. Puedes previsualizarlo o regenerar.");
            } else {
                toast.success(res?.message || "Documento generado exitosamente");
            }
            const filesRes = await ProcessFiles.list(p.id);
            setFiles(Array.isArray(filesRes?.files) ? filesRes.files : []);
        } catch (e) {
            toast.error(e?.message || "Error al generar documento");
        } finally {
            setGenerating(false);
        }
    };

    const changeStatus = async (newStatus) => {
        if (!p.id) return;
        setChanging(true);
        try {
            await ProcessesInbox.updateStatus(p.id, {
                status: newStatus,
                note: statusNote || undefined,
            });
            toast.success(`Estado cambiado a: ${STATUS_CONFIG[newStatus]?.label || newStatus}`);
            setStatusNote("");
            onUpdated?.();
        } catch (e) {
            toast.error(e?.message || "Error al cambiar estado");
        } finally {
            setChanging(false);
        }
    };

    const previewFile = (file) => {
        if (!file?.url) return toast.error("URL no disponible");
        window.open(file.url, "_blank", "noopener,noreferrer");
    };

    const downloadFile = (file) => {
        if (!file?.url) return toast.error("URL no disponible");
        const a = document.createElement("a");
        a.href = file.url;
        a.download = file.name || "documento";
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        a.remove();
    };

    const extraData = useMemo(() => {
        try {
            if (!p.metadata?.extra) return {};
            return typeof p.metadata.extra === "string"
                ? JSON.parse(p.metadata.extra)
                : p.metadata.extra;
        } catch { return {}; }
    }, [p.metadata]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 flex-wrap">
                        <DtIcon className={`h-5 w-5 ${dt.color || "text-gray-500"}`} />
                        <span>Solicitud #{p.id}</span>
                        <StatusBadge status={p.status} />
                    </DialogTitle>
                    <DialogDescription>
                        {dt.label || p.type_label || p.type}
                        {dt.firmante && <span className="ml-2 text-gray-400">· Firma: {dt.firmante}</span>}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <span className="text-gray-500">Estudiante:</span>{" "}
                            <strong>{p.student_name || `ID ${p.student_id}`}</strong>
                        </div>
                        <div>
                            <span className="text-gray-500">Documento:</span>{" "}
                            <strong>{dt.label || p.type}</strong>
                        </div>
                        {p.created_at && (
                            <div>
                                <span className="text-gray-500">Fecha:</span>{" "}
                                {new Date(p.created_at).toLocaleString()}
                            </div>
                        )}
                        {/* Campos extra ingresados (solo los que existen) */}
                        {Object.entries(extraData).map(([k, v]) => {
                            const fd = FIELD_DEFS[k];
                            if (!fd || !v) return null;
                            return (
                                <div key={k}>
                                    <span className="text-gray-500">{fd.label}:</span>{" "}
                                    <strong>{v}</strong>
                                </div>
                            );
                        })}
                    </div>

                    {p.note && (
                        <div className="p-3 rounded-xl bg-gray-50 border">
                            <Label className="text-xs text-gray-500">Motivo</Label>
                            <p className="text-sm mt-1">{p.note}</p>
                        </div>
                    )}

                    <Separator />

                    {/* ── VISTA ADMIN ── */}
                    {isAdmin && (
                        <>
                            <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 space-y-3">
                                <div className="flex items-center gap-2">
                                    <Printer className="h-5 w-5 text-blue-600" />
                                    <Label className="text-sm font-semibold text-blue-900">
                                        Generar {dt.label || "documento"}
                                    </Label>
                                    {dt.autoData && (
                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 rounded-full border-green-300 text-green-700 bg-green-50">
                                            datos automáticos
                                        </Badge>
                                    )}
                                </div>

                                <p className="text-xs text-blue-700">
                                    {dt.autoData
                                        ? "El sistema obtiene automáticamente los datos del alumno (carrera, ciclo, cursos, etc.) y genera el PDF."
                                        : "El sistema generará el PDF con los datos ingresados, logo institucional y firmas."}
                                </p>

                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        onClick={() => generateDocument(false)}
                                        disabled={generating}
                                        className="gap-2 rounded-xl bg-blue-600 hover:bg-blue-700">
                                        <Printer className="h-4 w-4" />
                                        {generating
                                            ? "Generando..."
                                            : files.length > 0
                                                ? "Regenerar documento"
                                                : "Generar documento"}
                                    </Button>
                                    {files.length > 0 && (
                                        <Button variant="outline" onClick={() => generateDocument(true)}
                                            disabled={generating} className="gap-2 rounded-xl">
                                            <RefreshCw className="h-4 w-4" /> Forzar regeneración
                                        </Button>
                                    )}
                                </div>

                                {files.length > 0 && (
                                    <div className="space-y-2 mt-2">
                                        {files.map(f => (
                                            <div key={f.id}
                                                className="flex items-center justify-between p-3 rounded-xl bg-white border shadow-sm">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <FileText className="h-4 w-4 text-blue-600 shrink-0" />
                                                    <div className="min-w-0">
                                                        <span className="text-sm font-medium truncate block">{f.name}</span>
                                                        {f.note && <span className="text-xs text-gray-500">{f.note}</span>}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <Button variant="outline" size="sm" className="rounded-xl gap-1"
                                                        onClick={() => previewFile(f)}>
                                                        <ExternalLink className="h-3.5 w-3.5" /> Previsualizar
                                                    </Button>
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0"
                                                        onClick={() => downloadFile(f)} title="Descargar">
                                                        <Download className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {files.length > 0 && !DOWNLOAD_ALLOWED.includes(p.status) && (
                                    <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-50 border border-amber-200">
                                        <AlertCircle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                                        <p className="text-[11px] text-amber-800">
                                            Documento generado. Cambia el estado a{" "}
                                            <strong>Aprobado</strong> o <strong>Ejecutado</strong>{" "}
                                            para que el alumno pueda descargarlo.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {transitions.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <ShieldCheck className="h-4 w-4 text-[#2196F3]" />
                                        <Label className="text-sm font-semibold">Gestionar estado</Label>
                                    </div>
                                    <Textarea value={statusNote} onChange={e => setStatusNote(e.target.value)}
                                        placeholder="Nota del cambio de estado (opcional)"
                                        className="rounded-xl" rows={2} />
                                    <div className="flex flex-wrap gap-2">
                                        {transitions.map(st => {
                                            const stCfg = STATUS_CONFIG[st] || {};
                                            const isDest = st === "RECHAZADO" || st === "ANULADO";
                                            return (
                                                <Button key={st}
                                                    variant={isDest ? "destructive" : "outline"}
                                                    size="sm" className="rounded-xl gap-1"
                                                    onClick={() => changeStatus(st)}
                                                    disabled={changing}>
                                                    <ArrowRight className="h-3 w-3" />{stCfg.label || st}
                                                </Button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            {transitions.length === 0 && p.status && (
                                <div className="text-center text-gray-400 text-sm py-2">
                                    Estado final — no se puede cambiar
                                </div>
                            )}
                        </>
                    )}

                    {/* ── VISTA ALUMNO ── */}
                    {!isAdmin && (
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <Paperclip className="h-4 w-4 text-gray-500" />
                                <Label className="text-sm font-semibold">Documento</Label>
                            </div>

                            {!canDownload && files.length === 0 && (
                                <div className="text-center py-6">
                                    <Clock className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                                    <p className="text-sm text-gray-400">Tu solicitud está siendo procesada</p>
                                    <p className="text-xs text-gray-400 mt-1">
                                        Cuando el documento esté listo, aparecerá aquí para descargar.
                                    </p>
                                </div>
                            )}

                            {!canDownload && files.length > 0 && (
                                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
                                    <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                                    <p className="text-xs text-amber-800">
                                        Tu documento está siendo preparado. La descarga se habilitará cuando sea autorizado.
                                    </p>
                                </div>
                            )}

                            {canDownload && files.length === 0 && (
                                <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 border border-blue-200">
                                    <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                                    <p className="text-xs text-blue-800">
                                        Tu solicitud fue aprobada. El documento será publicado pronto.
                                    </p>
                                </div>
                            )}

                            {canDownload && files.length > 0 && (
                                <div className="space-y-2">
                                    {files.map(f => (
                                        <div key={f.id}
                                            className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <FileDown className="h-5 w-5 text-emerald-600 shrink-0" />
                                                <div className="min-w-0">
                                                    <span className="text-sm font-medium truncate block">{f.name}</span>
                                                    {f.note && <span className="text-xs text-gray-500">{f.note}</span>}
                                                </div>
                                            </div>
                                            <Button size="sm"
                                                className="rounded-xl gap-1 bg-emerald-600 hover:bg-emerald-700"
                                                onClick={() => downloadFile(f)}>
                                                <Download className="h-3.5 w-3.5" /> Descargar
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {p.status === "RECHAZADO" && (
                                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 mt-3">
                                    <XCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                                    <p className="text-xs text-red-800">
                                        Tu solicitud fue rechazada. Comunícate con registros académicos.
                                    </p>
                                </div>
                            )}
                            {p.status === "EJECUTADO" && (
                                <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 mt-3">
                                    <CheckCircle className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                                    <p className="text-xs text-emerald-800">
                                        Tu solicitud fue ejecutada exitosamente.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Historial */}
                    {timeline.length > 0 && (
                        <>
                            <Separator />
                            <div>
                                <Label className="text-sm font-semibold">Historial</Label>
                                <div className="mt-2 space-y-2">
                                    {timeline.map((entry, idx) => (
                                        <div key={idx} className="flex items-start gap-2 text-xs">
                                            <div className="w-2 h-2 rounded-full bg-gray-400 mt-1.5 shrink-0" />
                                            <div>
                                                <span className="text-gray-500">
                                                    {entry.date ? new Date(entry.date).toLocaleString() : ""}
                                                </span>
                                                {entry.to_status && <> → <StatusBadge status={entry.to_status} /></>}
                                                {entry.user_name && (
                                                    <span className="text-gray-600 ml-1">por {entry.user_name}</span>
                                                )}
                                                {entry.note && <p className="text-gray-500 mt-0.5">{entry.note}</p>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}


/* ═══════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ═══════════════════════════════════════════════════════════════ */
export default function AcademicProcesses() {
    const isAdmin = useIsAdmin();
    const [myProcesses, setMyProcesses] = useState([]);
    const [allProcesses, setAllProcesses] = useState([]);
    const [loadingMy, setLoadingMy] = useState(true);
    const [loadingAll, setLoadingAll] = useState(true);
    const [selectedProcess, setSelectedProcess] = useState(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [view, setView] = useState("form");

    const loadMyProcesses = useCallback(async () => {
        setLoadingMy(true);
        try {
            const res = await ProcessesInbox.listAll();
            setMyProcesses(Array.isArray(res?.processes) ? res.processes : []);
        } catch (e) {
            toast.error(e?.message || "Error al cargar solicitudes");
        } finally {
            setLoadingMy(false);
        }
    }, []);

    const loadAllProcesses = useCallback(async () => {
        if (!isAdmin) return;
        setLoadingAll(true);
        try {
            const res = await ProcessesInbox.myRequests();
            setAllProcesses(Array.isArray(res?.processes) ? res.processes : []);
        } catch (e) {
            toast.error(e?.message || "Error al cargar bandeja");
        } finally {
            setLoadingAll(false);
        }
    }, [isAdmin]);

    useEffect(() => {
        loadMyProcesses();
        loadAllProcesses();
    }, [loadMyProcesses, loadAllProcesses]);

    const openDetail = async (proc) => {
        try {
            const res = await ProcessesInbox.get(proc.id);
            setSelectedProcess(res?.process ?? proc);
        } catch {
            setSelectedProcess(proc);
        }
        setDetailOpen(true);
    };

    const onUpdated = () => {
        loadMyProcesses();
        loadAllProcesses();
        setDetailOpen(false);
    };

    const pendingCount = myProcesses.filter(
        p => p.status === "PENDIENTE" || p.status === "EN_REVISION"
    ).length;
    const readyCount = myProcesses.filter(
        p => DOWNLOAD_ALLOWED.includes(p.status)
    ).length;
    const adminPending = allProcesses.filter(
        p => p.status === "PENDIENTE"
    ).length;

    return (
        <div className="space-y-6">
            <Tabs value={view} onValueChange={setView}>
                <TabsList className="bg-white/55 backdrop-blur-md border border-white/20 rounded-2xl shadow-sm p-1 flex flex-wrap gap-1">
                    <TabsTrigger value="form"
                        className="rounded-xl gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                        <Send className="h-4 w-4" /> Solicitar documento
                    </TabsTrigger>
                    <TabsTrigger value="my"
                        className="rounded-xl gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                        <ClipboardList className="h-4 w-4" /> Mis solicitudes
                        {pendingCount > 0 && (
                            <Badge variant="secondary" className="rounded-full text-[10px] px-1.5 py-0 ml-1">
                                {pendingCount}
                            </Badge>
                        )}
                        {readyCount > 0 && (
                            <Badge className="rounded-full text-[10px] px-1.5 py-0 ml-1 bg-emerald-100 text-emerald-700 border-emerald-300">
                                {readyCount} listo{readyCount > 1 ? "s" : ""}
                            </Badge>
                        )}
                    </TabsTrigger>
                    {isAdmin && (
                        <TabsTrigger value="inbox"
                            className="rounded-xl gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                            <Inbox className="h-4 w-4" /> Bandeja admin
                            {adminPending > 0 && (
                                <Badge variant="destructive" className="rounded-full text-[10px] px-1.5 py-0 ml-1">
                                    {adminPending}
                                </Badge>
                            )}
                        </TabsTrigger>
                    )}
                </TabsList>

                <TabsContent value="form" className="mt-4">
                    <ProcessRequestForm onCreated={() => {
                        loadMyProcesses();
                        loadAllProcesses();
                        setView("my");
                    }} />
                </TabsContent>

                <TabsContent value="my" className="mt-4">
                    <MyRequestsList
                        processes={myProcesses}
                        loading={loadingMy}
                        onSelect={openDetail}
                        onRefresh={loadMyProcesses}
                    />
                </TabsContent>

                {isAdmin && (
                    <TabsContent value="inbox" className="mt-4">
                        <AdminInbox
                            processes={allProcesses}
                            loading={loadingAll}
                            onSelect={openDetail}
                            onRefresh={loadAllProcesses}
                        />
                    </TabsContent>
                )}
            </Tabs>

            <ProcessDetailDialog
                process={selectedProcess}
                open={detailOpen}
                onOpenChange={setDetailOpen}
                onUpdated={onUpdated}
            />
        </div>
    );
}