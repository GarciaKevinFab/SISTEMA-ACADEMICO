// src/modules/academic/EnrollmentWindowManager.jsx
// ═══════════════════════════════════════════════════════════
// Componente para que el admin configure las ventanas de matrícula
// - Ventana Ordinaria (verde)
// - Ventana Extemporánea (ámbar) + recargo
// - Indicador visual del estado actual
// - Timeline de periodos
// ═══════════════════════════════════════════════════════════
import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
    Calendar,
    Clock,
    Save,
    Loader2,
    RotateCw,
    CheckCircle2,
    AlertTriangle,
    Lock,
    Unlock,
    DollarSign,
    Info,
} from "lucide-react";

/* ─── helpers ─── */
function toLocalDatetimeValue(isoStr) {
    if (!isoStr) return "";
    // Convierte ISO UTC a "YYYY-MM-DDTHH:MM" para datetime-local
    try {
        const d = new Date(isoStr);
        const pad = (n) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
        return "";
    }
}

function fromLocalDatetimeValue(val) {
    if (!val) return null;
    // Convierte "YYYY-MM-DDTHH:MM" a ISO string
    try {
        return new Date(val).toISOString();
    } catch {
        return null;
    }
}

function formatDisplay(isoStr) {
    if (!isoStr) return "—";
    try {
        return new Date(isoStr).toLocaleString("es-PE", {
            day: "2-digit", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit",
        });
    } catch {
        return isoStr;
    }
}

const STATUS_CONFIG = {
    FREE: {
        label: "Libre (sin restricción)",
        color: "bg-slate-100 text-slate-600 border-slate-200",
        Icon: Unlock,
        iconColor: "text-slate-500",
        desc: "No hay fechas configuradas. Los estudiantes pueden matricularse en cualquier momento.",
    },
    OPEN: {
        label: "Matrícula ORDINARIA abierta",
        color: "bg-green-100 text-green-700 border-green-200",
        Icon: CheckCircle2,
        iconColor: "text-green-600",
        desc: "Dentro de la ventana ordinaria. Matrícula sin recargo.",
    },
    EXTEMPORARY: {
        label: "Matrícula EXTEMPORÁNEA abierta",
        color: "bg-amber-100 text-amber-700 border-amber-200",
        Icon: AlertTriangle,
        iconColor: "text-amber-600",
        desc: "Fuera del período ordinario. Se aplica recargo por extemporaneidad.",
    },
    CLOSED: {
        label: "Matrícula CERRADA",
        color: "bg-red-100 text-red-700 border-red-200",
        Icon: Lock,
        iconColor: "text-red-600",
        desc: "Fuera de toda ventana. Los estudiantes no pueden matricularse.",
    },
};

export default function EnrollmentWindowManager({ activePeriod }) {
    const { api } = useAuth();

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Estado del servidor
    const [currentStatus, setCurrentStatus] = useState("FREE");
    const [serverData, setServerData] = useState(null);

    // Formulario local (datetime-local strings)
    const [form, setForm] = useState({
        enrollment_start: "",
        enrollment_end: "",
        extemporary_start: "",
        extemporary_end: "",
        extemporary_surcharge: "0",
    });

    const fetchWindow = useCallback(async () => {
        if (!activePeriod) return;
        setLoading(true);
        try {
            const { data } = await api.get(`/academic/periods/${activePeriod}/enrollment-window`);
            setServerData(data);
            setCurrentStatus(data.status || "FREE");
            setForm({
                enrollment_start: toLocalDatetimeValue(data.start),
                enrollment_end: toLocalDatetimeValue(data.end),
                extemporary_start: toLocalDatetimeValue(data.extemporary_start),
                extemporary_end: toLocalDatetimeValue(data.extemporary_end),
                extemporary_surcharge: String(data.extemporary_surcharge ?? 0),
            });
        } catch (e) {
            // 404 = período sin config aún → formulario vacío está bien
            if (e?.response?.status !== 404) {
                toast.error(e?.response?.data?.detail || "Error al cargar ventana de matrícula");
            }
            setCurrentStatus("FREE");
        } finally {
            setLoading(false);
        }
    }, [api, activePeriod]);

    useEffect(() => {
        fetchWindow();
    }, [fetchWindow]);

    const handleSave = async () => {
        if (!activePeriod) return toast.error("Selecciona un período primero");

        // Validaciones frontend
        const s = fromLocalDatetimeValue(form.enrollment_start);
        const e = fromLocalDatetimeValue(form.enrollment_end);
        const xs = fromLocalDatetimeValue(form.extemporary_start);
        const xe = fromLocalDatetimeValue(form.extemporary_end);

        if (s && e && new Date(e) < new Date(s)) {
            return toast.error("El fin de matrícula ordinaria no puede ser anterior al inicio");
        }
        if (xs && xe && new Date(xe) < new Date(xs)) {
            return toast.error("El fin de matrícula extemporánea no puede ser anterior al inicio");
        }
        if (s && e && xs && new Date(xs) < new Date(e)) {
            return toast.error("La ventana extemporánea debe iniciar después de que termine la ordinaria");
        }

        const surcharge = parseFloat(form.extemporary_surcharge || "0");
        if (isNaN(surcharge) || surcharge < 0) {
            return toast.error("El recargo debe ser un número no negativo");
        }

        setSaving(true);
        try {
            const { data } = await api.put(`/academic/periods/${activePeriod}/enrollment-window`, {
                enrollment_start: s,
                enrollment_end: e,
                extemporary_start: xs,
                extemporary_end: xe,
                extemporary_surcharge: surcharge,
            });
            setServerData(data);
            setCurrentStatus(data.status || "FREE");
            toast.success("Ventana de matrícula actualizada ✅");
        } catch (err) {
            toast.error(err?.response?.data?.detail || "Error al guardar ventana de matrícula");
        } finally {
            setSaving(false);
        }
    };

    const handleClear = () => {
        setForm({
            enrollment_start: "",
            enrollment_end: "",
            extemporary_start: "",
            extemporary_end: "",
            extemporary_surcharge: "0",
        });
    };

    const cfg = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.FREE;
    const StatusIcon = cfg.Icon;

    return (
        <div className="space-y-4 fade-in">
            {/* ── Header + estado actual ── */}
            <Card className="border border-slate-100 shadow-sm rounded-2xl bg-white">
                <CardHeader className="px-6 pt-5 pb-0">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-xl bg-blue-50 border border-blue-100">
                                <Calendar size={18} className="text-blue-700" />
                            </div>
                            <div>
                                <p className="text-[15px] font-700 text-slate-800 leading-tight">
                                    Ventanas de Matrícula
                                </p>
                                <p className="mt-0.5 text-xs text-slate-500">
                                    Período: <span className="font-semibold text-slate-700">{activePeriod || "—"}</span>
                                </p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 rounded-lg hover:bg-slate-100"
                            onClick={fetchWindow}
                            disabled={loading}
                            title="Recargar"
                        >
                            {loading ? <Loader2 size={14} className="animate-spin" /> : <RotateCw size={14} />}
                        </Button>
                    </div>

                    {/* Badge de estado actual */}
                    <div className={`mt-4 mb-1 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-sm font-600 ${cfg.color}`}>
                        <StatusIcon size={16} className={cfg.iconColor} />
                        <div>
                            <span>{cfg.label}</span>
                            <p className="text-xs font-400 mt-0.5 opacity-80">{cfg.desc}</p>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="px-6 pb-6 pt-4 space-y-5">

                    {/* ── VENTANA ORDINARIA ── */}
                    <div className="border border-green-200 bg-green-50/40 rounded-xl p-4 space-y-3">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                            <p className="text-sm font-700 text-green-800">Matrícula Ordinaria</p>
                            <Badge className="ml-auto text-[10px] bg-green-100 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-md">
                                Sin recargo
                            </Badge>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-600 text-slate-700">Inicio</Label>
                                <Input
                                    type="datetime-local"
                                    value={form.enrollment_start}
                                    onChange={(e) => setForm((p) => ({ ...p, enrollment_start: e.target.value }))}
                                    className="h-9 text-sm rounded-lg border-green-200 focus:border-green-400 focus:ring-green-100"
                                />
                                <p className="text-[11px] text-slate-400">
                                    {form.enrollment_start ? formatDisplay(fromLocalDatetimeValue(form.enrollment_start)) : "Sin configurar"}
                                </p>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-600 text-slate-700">Fin</Label>
                                <Input
                                    type="datetime-local"
                                    value={form.enrollment_end}
                                    onChange={(e) => setForm((p) => ({ ...p, enrollment_end: e.target.value }))}
                                    className="h-9 text-sm rounded-lg border-green-200 focus:border-green-400 focus:ring-green-100"
                                />
                                <p className="text-[11px] text-slate-400">
                                    {form.enrollment_end ? formatDisplay(fromLocalDatetimeValue(form.enrollment_end)) : "Sin configurar"}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* ── VENTANA EXTEMPORÁNEA ── */}
                    <div className="border border-amber-200 bg-amber-50/40 rounded-xl p-4 space-y-3">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                            <p className="text-sm font-700 text-amber-800">Matrícula Extemporánea</p>
                            <Badge className="ml-auto text-[10px] bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-md">
                                Con recargo
                            </Badge>
                        </div>

                        <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-100/60 rounded-lg px-3 py-2 border border-amber-200">
                            <Info size={13} className="mt-0.5 flex-shrink-0" />
                            <span>
                                Debe iniciar <strong>después</strong> del fin de la matrícula ordinaria.
                                El estudiante debe acudir a Secretaría Académica y pagar el recargo indicado.
                            </span>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-600 text-slate-700">Inicio</Label>
                                <Input
                                    type="datetime-local"
                                    value={form.extemporary_start}
                                    onChange={(e) => setForm((p) => ({ ...p, extemporary_start: e.target.value }))}
                                    className="h-9 text-sm rounded-lg border-amber-200 focus:border-amber-400 focus:ring-amber-100"
                                />
                                <p className="text-[11px] text-slate-400">
                                    {form.extemporary_start ? formatDisplay(fromLocalDatetimeValue(form.extemporary_start)) : "Sin configurar"}
                                </p>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-600 text-slate-700">Fin</Label>
                                <Input
                                    type="datetime-local"
                                    value={form.extemporary_end}
                                    onChange={(e) => setForm((p) => ({ ...p, extemporary_end: e.target.value }))}
                                    className="h-9 text-sm rounded-lg border-amber-200 focus:border-amber-400 focus:ring-amber-100"
                                />
                                <p className="text-[11px] text-slate-400">
                                    {form.extemporary_end ? formatDisplay(fromLocalDatetimeValue(form.extemporary_end)) : "Sin configurar"}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-600 text-slate-700 flex items-center gap-1.5">
                                <DollarSign size={12} className="text-amber-600" />
                                Recargo extemporáneo (S/.)
                            </Label>
                            <div className="relative max-w-[200px]">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 font-600">S/.</span>
                                <Input
                                    type="number"
                                    min="0"
                                    step="0.50"
                                    value={form.extemporary_surcharge}
                                    onChange={(e) => setForm((p) => ({ ...p, extemporary_surcharge: e.target.value }))}
                                    className="h-9 text-sm rounded-lg pl-10 border-amber-200 focus:border-amber-400 focus:ring-amber-100"
                                    placeholder="0.00"
                                />
                            </div>
                            <p className="text-[11px] text-slate-400">
                                Monto que se cobra al estudiante en Tesorería por matrícula fuera de fecha
                            </p>
                        </div>
                    </div>

                    {/* ── Timeline visual ── */}
                    {(form.enrollment_start || form.extemporary_start) && (
                        <div className="border border-slate-100 rounded-xl px-4 py-3 bg-slate-50/60">
                            <p className="text-[11px] font-700 uppercase tracking-wider text-slate-400 mb-3">
                                Línea de tiempo
                            </p>
                            <div className="relative flex items-center gap-0">
                                {/* Tramo ordinario */}
                                {form.enrollment_start && form.enrollment_end && (
                                    <div className="flex-1 min-w-0">
                                        <div className="h-5 rounded-l-full bg-green-400 flex items-center justify-center px-2">
                                            <span className="text-[10px] font-700 text-white truncate">Ordinaria</span>
                                        </div>
                                        <p className="text-[10px] text-slate-500 mt-1 truncate">
                                            {formatDisplay(fromLocalDatetimeValue(form.enrollment_start))}
                                        </p>
                                    </div>
                                )}
                                {/* Separador gap */}
                                {form.enrollment_end && form.extemporary_start && (
                                    <div className="w-3 h-5 bg-slate-200 flex-shrink-0" />
                                )}
                                {/* Tramo extemporáneo */}
                                {form.extemporary_start && form.extemporary_end && (
                                    <div className="flex-1 min-w-0">
                                        <div className={`h-5 ${form.enrollment_start ? "" : "rounded-l-full"} rounded-r-full bg-amber-400 flex items-center justify-center px-2`}>
                                            <span className="text-[10px] font-700 text-white truncate">Extemporánea</span>
                                        </div>
                                        <p className="text-[10px] text-slate-500 mt-1 truncate text-right">
                                            {formatDisplay(fromLocalDatetimeValue(form.extemporary_end))}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <Separator className="bg-slate-100" />

                    {/* ── Acciones ── */}
                    <div className="flex items-center justify-between gap-3">
                        <Button
                            variant="ghost"
                            className="h-9 text-xs rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                            onClick={handleClear}
                            disabled={saving}
                        >
                            Limpiar fechas
                        </Button>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                className="h-9 text-xs rounded-lg border-slate-200 text-slate-600"
                                onClick={fetchWindow}
                                disabled={saving || loading}
                            >
                                <RotateCw size={12} className="mr-1.5" /> Recargar
                            </Button>
                            <Button
                                className="h-9 text-xs rounded-lg gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                                onClick={handleSave}
                                disabled={saving || !activePeriod}
                            >
                                {saving
                                    ? <><Loader2 size={12} className="animate-spin" /> Guardando...</>
                                    : <><Save size={12} /> Guardar ventanas</>
                                }
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* ── Info tabla de estados ── */}
            <Card className="border border-slate-100 shadow-sm rounded-2xl bg-white">
                <CardContent className="px-6 py-4">
                    <p className="text-[11px] font-700 uppercase tracking-wider text-slate-400 mb-3">
                        Referencia de estados
                    </p>
                    <div className="space-y-2">
                        {Object.entries(STATUS_CONFIG).map(([key, c]) => {
                            const I = c.Icon;
                            return (
                                <div key={key} className="flex items-start gap-2.5 text-xs">
                                    <div className={`mt-0.5 flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-md border ${c.color}`}>
                                        <I size={11} className={c.iconColor} />
                                    </div>
                                    <div>
                                        <span className="font-600 text-slate-700">{c.label}:</span>
                                        <span className="text-slate-500 ml-1">{c.desc}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}