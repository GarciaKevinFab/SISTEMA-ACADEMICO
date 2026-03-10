import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
    Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { toast } from "sonner";
import { PublicProcedureTypes, PublicIntake } from "../../services/mesaPartes.service";
import {
    FileText, CheckCircle2, Upload, ArrowRight, Home,
    User, CreditCard, Mail, Phone, AlignLeft, Tag,
    Loader2, AlertCircle, Paperclip, ExternalLink,
} from "lucide-react";

/* ─── Helpers ────────────────────────────────────────────────── */
const onlyDigits = (v) => String(v ?? "").replace(/\D/g, "");

/* ─── File Preview List ──────────────────────────────────────── */
function FilePreviewList({ files }) {
    const previews = useMemo(() =>
        files.map((f) => ({
            name: f.name,
            size: f.size,
            isImage: f.type.startsWith("image/"),
            isPdf: f.type === "application/pdf",
            url: URL.createObjectURL(f),
        })),
        [files]
    );

    useEffect(() => {
        return () => previews.forEach((p) => URL.revokeObjectURL(p.url));
    }, [previews]);

    if (!files.length) return null;

    return (
        <div className="grid gap-2 mt-2">
            {previews.map((p, i) => (
                <div key={i} className="rounded-lg border border-slate-200 overflow-hidden bg-white">
                    {p.isImage && (
                        <img src={p.url} alt={p.name}
                            className="w-full max-h-48 object-contain bg-slate-50" />
                    )}
                    {p.isPdf && (
                        <iframe src={p.url} title={p.name}
                            className="w-full h-48 border-0" />
                    )}
                    <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                        <span className="truncate mr-2">{p.name}</span>
                        <span className="shrink-0">{(p.size / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                </div>
            ))}
        </div>
    );
}

/* ─── Shared Header ──────────────────────────────────────────── */
const PageHeader = () => (
    <header className="sticky top-0 z-40 bg-blue-950/90 backdrop-blur-md border-b border-white/10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
                <img src="/logo.png" alt="Logo" className="h-9 w-9 object-contain shrink-0" draggable="false" />
                <p className="text-white font-extrabold truncate">Mesa de Partes Virtual</p>
            </div>
            <Link
                to="/public/procedures"
                className="inline-flex items-center gap-2 text-blue-100/80 hover:text-white text-sm font-semibold transition-colors"
            >
                <Home className="h-4 w-4" />
                <span className="hidden sm:inline">Inicio</span>
            </Link>
        </div>
    </header>
);

/* ─── Field wrapper ──────────────────────────────────────────── */
const Field = ({ label, icon: Icon, error, required, children }) => (
    <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
            {Icon && <Icon size={13} className="text-slate-400 shrink-0" />}
            <Label className={`text-sm font-semibold ${error ? "text-red-600" : "text-slate-700"}`}>
                {label}{required && <span className="text-red-500 ml-0.5">*</span>}
            </Label>
        </div>
        {children}
        {error && (
            <p className="flex items-center gap-1.5 text-xs text-red-600 font-semibold">
                <AlertCircle size={11} className="shrink-0" />
                {error}
            </p>
        )}
    </div>
);

/* ─── Success Screen ─────────────────────────────────────────── */
const SuccessScreen = ({ created, onReset }) => {
    const code = created?.tracking_code;
    return (
        <div className="min-h-[100dvh] bg-slate-50">
            <PageHeader />
            <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">

                {/* Success banner */}
                <div className="rounded-2xl overflow-hidden border border-emerald-200 bg-white shadow-sm">
                    {/* Top green bar */}
                    <div className="h-1.5 bg-gradient-to-r from-emerald-500 to-teal-400" />
                    <div className="p-6 sm:p-8">
                        <div className="flex items-start gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-emerald-50 border border-emerald-200 grid place-items-center shrink-0">
                                <CheckCircle2 size={22} className="text-emerald-600" />
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-xl font-black text-slate-900 leading-tight">¡Trámite registrado!</h2>
                                <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                                    Tu expediente fue creado correctamente. Guarda el código — lo necesitarás para hacer seguimiento.
                                </p>
                            </div>
                        </div>

                        {/* Tracking code */}
                        <div className="mt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                                    Código de seguimiento
                                </p>
                                <p className="text-2xl font-black text-slate-900 tracking-wide font-mono">{code}</p>
                            </div>
                            <Link to={`/public/procedures/track/${encodeURIComponent(code)}`} className="shrink-0 w-full sm:w-auto">
                                <Button className="w-full rounded-xl font-extrabold gap-2">
                                    Ver seguimiento <ArrowRight size={16} />
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Bottom actions */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <Link to="/public/procedures" className="w-full sm:w-auto">
                        <Button variant="outline" className="rounded-xl font-bold w-full gap-2">
                            <Home size={15} /> Volver al portal
                        </Button>
                    </Link>
                    <Button
                        variant="ghost"
                        className="rounded-xl font-bold text-slate-600 w-full sm:w-auto"
                        onClick={onReset}
                    >
                        Registrar otro trámite
                    </Button>
                </div>
            </div>
        </div>
    );
};

/* ─── Main Component ─────────────────────────────────────────── */
export default function PublicProcedureIntake() {
    const [types, setTypes] = useState([]);
    const [created, setCreated] = useState(null);
    const [files, setFiles] = useState([]);
    const [pendingFiles, setPendingFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState({});
    const [form, setForm] = useState({
        procedure_type_id: "",
        applicant_name: "",
        applicant_document: "",
        applicant_email: "",
        applicant_phone: "",
        description: "",
    });

    useEffect(() => {
        PublicProcedureTypes.list()
            .then((d) => setTypes(d?.procedure_types || d || []))
            .catch(() => toast.error("No se pudieron cargar los tipos de trámite"));
    }, []);

    const setField = (key, value) => {
        setForm((p) => ({ ...p, [key]: value }));
        if (errors[key]) setErrors((p) => ({ ...p, [key]: null }));
    };

    const validate = () => {
        const e = {};
        if (!form.procedure_type_id) e.procedure_type_id = "Seleccione un tipo de trámite";
        if (!form.applicant_name?.trim()) e.applicant_name = "El nombre es obligatorio";
        else if (form.applicant_name.trim().length < 3) e.applicant_name = "Mínimo 3 caracteres";
        if (!form.applicant_document?.trim()) e.applicant_document = "El DNI es obligatorio";
        else if (onlyDigits(form.applicant_document).length !== 8) e.applicant_document = "Debe tener 8 dígitos";
        if (form.applicant_email?.trim()) {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.applicant_email.trim()))
                e.applicant_email = "Correo inválido";
        }
        if (form.applicant_phone?.trim()) {
            if (onlyDigits(form.applicant_phone).length !== 9)
                e.applicant_phone = "El celular debe tener 9 dígitos";
        }
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const submit = async (e) => {
        e.preventDefault();
        if (!validate()) return;
        setSubmitting(true);
        try {
            const payload = {
                ...form,
                applicant_document: onlyDigits(form.applicant_document).slice(0, 8),
                applicant_phone: onlyDigits(form.applicant_phone).slice(0, 9),
                procedure_type: form.procedure_type_id ? Number(form.procedure_type_id) : null,
            };
            delete payload.procedure_type_id;
            const res = await PublicIntake.create(payload);
            const proc = res?.procedure || res;
            toast.success("Trámite registrado correctamente");

            // Auto-upload pending files
            if (pendingFiles.length > 0 && proc?.tracking_code) {
                try {
                    for (const f of pendingFiles) await PublicIntake.uploadFile(proc.tracking_code, f);
                    toast.success(`${pendingFiles.length} archivo(s) adjuntado(s)`);
                    setPendingFiles([]);
                } catch {
                    toast.error("El trámite fue creado, pero hubo un error al subir algunos archivos. Puede intentarlo en la pantalla siguiente.");
                }
            }

            setCreated(proc);
        } catch (err) {
            toast.error(err?.message || "No se pudo registrar el trámite");
        } finally {
            setSubmitting(false);
        }
    };

    const uploadAll = async () => {
        if (!created?.tracking_code) return;
        if (!files.length) return toast.error("Seleccione archivos primero");
        setUploading(true);
        try {
            for (const f of files) await PublicIntake.uploadFile(created.tracking_code, f);
            toast.success("Archivos enviados");
            setFiles([]);
        } catch {
            toast.error("Error al subir archivos");
        } finally {
            setUploading(false);
        }
    };

    const resetForm = () => {
        setCreated(null);
        setForm({ procedure_type_id: "", applicant_name: "", applicant_document: "", applicant_email: "", applicant_phone: "", description: "" });
        setErrors({});
        setPendingFiles([]);
    };

    const typeLabel = useMemo(() =>
        types.find((x) => String(x.id) === String(form.procedure_type_id))?.name || "",
        [types, form.procedure_type_id]);

    /* ── Success view ── */
    if (created) {
        return (
            <SuccessScreen
                created={created}
                onReset={resetForm}
            />
        );
    }

    /* ── Form view ── */
    return (
        <div className="min-h-[100dvh] bg-slate-50">
            <PageHeader />

            <div className="max-w-3xl mx-auto px-4 py-8">
                <div className="rounded-3xl overflow-hidden border border-slate-200/80 bg-white shadow-sm">

                    {/* Card header — dark style matching the portal */}
                    <div className="relative p-6 sm:p-8 bg-gradient-to-br from-[#0f1a3a] via-[#171a55] to-[#251c6c] text-white overflow-hidden">
                        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_25%_25%,rgba(255,255,255,0.4),transparent_55%)]" />
                        <div className="relative">
                            <div className="h-10 w-10 rounded-2xl bg-white/10 border border-white/15 grid place-items-center mb-4">
                                <FileText size={20} className="text-indigo-200" />
                            </div>
                            <h1 className="text-xl sm:text-2xl font-black tracking-tight">Registro de Trámite</h1>
                            <p className="text-sm text-blue-100/75 mt-1.5 leading-relaxed">
                                Complete el formulario. Los campos con <span className="text-red-300 font-bold">*</span> son obligatorios.
                            </p>
                        </div>
                    </div>

                    {/* Form body */}
                    <div className="p-5 sm:p-8">
                        <form onSubmit={submit} className="space-y-6">

                            {/* Tipo de trámite */}
                            <Field label="Tipo de trámite" icon={Tag} error={errors.procedure_type_id} required>
                                <Select
                                    value={form.procedure_type_id}
                                    onValueChange={(v) => setField("procedure_type_id", v)}
                                >
                                    <SelectTrigger className={`rounded-xl ${errors.procedure_type_id ? "border-red-400 focus:ring-red-300" : ""}`}>
                                        <SelectValue placeholder="Seleccione un tipo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {types.map((t) => (
                                            <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {typeLabel && (
                                    <p className="text-xs text-slate-500 mt-1">
                                        Seleccionado: <b className="text-slate-700">{typeLabel}</b>
                                    </p>
                                )}
                            </Field>

                            {/* Divider */}
                            <div className="border-t border-slate-100 pt-1">
                                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Datos del solicitante</p>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Field label="Nombre completo" icon={User} error={errors.applicant_name} required>
                                        <Input
                                            value={form.applicant_name}
                                            onChange={(e) => setField("applicant_name", e.target.value)}
                                            className={`rounded-xl ${errors.applicant_name ? "border-red-400" : ""}`}
                                            placeholder="Ej: Juan Pérez López"
                                            required
                                        />
                                    </Field>

                                    <Field label="DNI" icon={CreditCard} error={errors.applicant_document} required>
                                        <Input
                                            value={form.applicant_document}
                                            onChange={(e) => setField("applicant_document", onlyDigits(e.target.value).slice(0, 8))}
                                            className={`rounded-xl font-mono ${errors.applicant_document ? "border-red-400" : ""}`}
                                            maxLength={8} inputMode="numeric"
                                            placeholder="12345678"
                                            required
                                        />
                                    </Field>

                                    <Field label="Correo electrónico" icon={Mail} error={errors.applicant_email}>
                                        <Input
                                            type="email"
                                            value={form.applicant_email}
                                            onChange={(e) => setField("applicant_email", e.target.value)}
                                            className={`rounded-xl ${errors.applicant_email ? "border-red-400" : ""}`}
                                            placeholder="ejemplo@correo.com"
                                        />
                                    </Field>

                                    <Field label="Celular" icon={Phone} error={errors.applicant_phone}>
                                        <Input
                                            value={form.applicant_phone}
                                            onChange={(e) => setField("applicant_phone", onlyDigits(e.target.value).slice(0, 9))}
                                            className={`rounded-xl font-mono ${errors.applicant_phone ? "border-red-400" : ""}`}
                                            maxLength={9} inputMode="numeric"
                                            placeholder="987654321"
                                        />
                                    </Field>
                                </div>
                            </div>

                            {/* Descripción */}
                            <Field label="Descripción" icon={AlignLeft}>
                                <Textarea
                                    rows={4}
                                    value={form.description}
                                    onChange={(e) => setField("description", e.target.value)}
                                    className="rounded-xl resize-none"
                                    placeholder="Explique brevemente su solicitud o el motivo del trámite…"
                                />
                            </Field>

                            {/* Adjuntar documentos */}
                            <Field label="Adjuntar documentos (opcional)" icon={Paperclip}>
                                <Input
                                    type="file" multiple accept="application/pdf,image/*"
                                    onChange={(e) => setPendingFiles(Array.from(e.target.files || []))}
                                    className="file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-700 file:font-semibold file:text-xs file:px-3 file:py-1.5 cursor-pointer rounded-xl"
                                />
                                {pendingFiles.length > 0 && (
                                    <p className="text-xs text-slate-500 font-medium">
                                        {pendingFiles.length} archivo{pendingFiles.length > 1 ? "s" : ""} seleccionado{pendingFiles.length > 1 ? "s" : ""}
                                    </p>
                                )}
                                <FilePreviewList files={pendingFiles} />
                            </Field>

                            {/* Summary of errors */}
                            {Object.values(errors).some(Boolean) && (
                                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5">
                                    <AlertCircle size={15} className="text-red-600 shrink-0 mt-0.5" />
                                    <p className="text-sm text-red-700 font-semibold">
                                        Corrige los campos marcados en rojo antes de continuar.
                                    </p>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end pt-1">
                                <Link to="/public/procedures/track" className="w-full sm:w-auto">
                                    <Button type="button" variant="outline" className="rounded-xl font-bold w-full gap-2">
                                        Ir a seguimiento
                                    </Button>
                                </Link>
                                <Button
                                    type="submit"
                                    disabled={submitting}
                                    className="rounded-xl font-extrabold gap-2 w-full sm:w-auto min-w-[180px]"
                                >
                                    {submitting
                                        ? <><Loader2 size={15} className="animate-spin" /> Registrando…</>
                                        : <><FileText size={15} /> Registrar trámite</>
                                    }
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Footer */}
                <p className="mt-6 text-center text-xs text-slate-400">
                    © {new Date().getFullYear()} IESPP Gustavo Allende Llavería — Mesa de Partes Virtual
                </p>
            </div>
        </div>
    );
}