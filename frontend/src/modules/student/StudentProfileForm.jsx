// src/modules/student/StudentProfileForm.jsx
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Upload, Image as ImageIcon, Save, Lock } from "lucide-react";

import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";

const empty = {
    // ✅ Excel (21 campos)
    region: "",
    provincia: "",
    distrito: "",

    codigoModular: "",
    nombreInstitucion: "",
    gestion: "",
    tipo: "",

    programaCarrera: "",

    ciclo: "",
    turno: "",
    seccion: "",

    apellidoPaterno: "",
    apellidoMaterno: "",
    nombres: "",

    fechaNac: "",
    sexo: "",

    numDocumento: "",
    lengua: "",
    periodo: "",
    discapacidad: "",
    tipoDiscapacidad: "",

    // ✅ Opcionales tuyos que siguen existiendo en el modelo
    email: "",
    celular: "",

    photoUrl: "",
};

const safeDate = (v) => (v ? String(v).slice(0, 10) : "");

const TURNOS = [
    { value: "Mañana", label: "Mañana" },
    { value: "Tarde", label: "Tarde" },
    { value: "Noche", label: "Noche" },
];

const SEXOS = [
    { value: "M", label: "Masculino (M)" },
    { value: "F", label: "Femenino (F)" },
    { value: "Otro", label: "Otro" },
];

const DISCAPACIDAD_OPTS = [
    { value: "SI", label: "SI" },
    { value: "NO", label: "NO" },
];

export default function StudentProfileForm({ mode, student, loading, onSave, onUploadPhoto }) {
    const [form, setForm] = useState(empty);
    const [saving, setSaving] = useState(false);

    const [photoFile, setPhotoFile] = useState(null);
    const [photoPreview, setPhotoPreview] = useState("");

    const isAdmin = mode === "admin";

    // ✅ Qué campos puede editar el estudiante (tú decides)
    const studentEditable = useMemo(
        () =>
            new Set([
                "email",
                "celular",
                // si quieres permitirle actualizar lengua o dirección, acá
                // "lengua",
            ]),
        []
    );

    const canEditField = (key) => (isAdmin ? true : studentEditable.has(key));

    const pickPhoto = (file) => {
        setPhotoFile(file);
        if (!file) return;
        setPhotoPreview(URL.createObjectURL(file));
    };

    // Cargar student al form
    useEffect(() => {
        if (!student) {
            setForm(empty);
            setPhotoPreview("");
            return;
        }

        setForm({
            ...empty,
            ...student,
            // normalizaciones
            fechaNac: safeDate(student?.fechaNac),
            ciclo: student?.ciclo ?? "",
            photoUrl: student?.photoUrl || "",
        });

        setPhotoPreview(student?.photoUrl || "");
        setPhotoFile(null);
    }, [student]);

    const submit = async (e) => {
        e.preventDefault();

        if (!student && mode === "admin") {
            toast.error("Selecciona un estudiante primero.");
            return;
        }

        try {
            setSaving(true);

            // ✅ payload para backend (campos Excel + extras)
            const payload = { ...form };
            payload.ciclo = payload.ciclo === "" ? null : Number(payload.ciclo);

            if (!isAdmin) {
                const filtered = {};
                for (const k of Object.keys(payload)) {
                    if (studentEditable.has(k)) filtered[k] = payload[k];
                }
                await onSave(filtered);
            } else {
                await onSave(payload);
            }

            if (photoFile) {
                await onUploadPhoto(photoFile);
                setPhotoFile(null);
            }
        } finally {
            setSaving(false);
        }
    };

    const field = (key, label, props = {}) => (
        <div>
            <Label className="flex items-center gap-2">
                {label}
                {!canEditField(key) && (
                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border">
                        <Lock className="h-3 w-3" /> Bloqueado
                    </span>
                )}
            </Label>
            <Input
                className="rounded-xl"
                value={form[key] ?? ""}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                disabled={!canEditField(key) || loading || saving}
                {...props}
            />
        </div>
    );

    const selectField = (key, label, options, props = {}) => (
        <div>
            <Label className="flex items-center gap-2">
                {label}
                {!canEditField(key) && (
                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border">
                        <Lock className="h-3 w-3" /> Bloqueado
                    </span>
                )}
            </Label>
            <select
                className="mt-1 w-full rounded-xl border px-3 py-2 bg-transparent"
                value={form[key] ?? ""}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                disabled={!canEditField(key) || loading || saving}
                {...props}
            >
                <option value="">— Selecciona —</option>
                {options.map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
        </div>
    );

    return (
        <Card className="rounded-2xl border border-white/50 dark:border-white/10 bg-white/60 dark:bg-neutral-900/40 p-4">
            <form onSubmit={submit} className="space-y-6">
                {/* FOTO */}
                <div className="flex items-center gap-4">
                    <div className="h-24 w-24 rounded-2xl overflow-hidden bg-slate-200 flex items-center justify-center">
                        {photoPreview ? (
                            <img src={photoPreview} alt="foto" className="h-full w-full object-cover" />
                        ) : (
                            <ImageIcon className="h-10 w-10 opacity-60" />
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label>Foto del estudiante</Label>
                        <div className="flex flex-wrap gap-2">
                            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer hover:bg-muted/40">
                                <Upload className="h-4 w-4" />
                                <span className="text-sm">Subir foto</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    disabled={loading || saving}
                                    onChange={(e) => pickPhoto(e.target.files?.[0] || null)}
                                />
                            </label>

                            {photoPreview && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="rounded-xl"
                                    onClick={() => {
                                        setPhotoFile(null);
                                        setPhotoPreview(form.photoUrl || "");
                                    }}
                                    disabled={loading || saving}
                                >
                                    Revertir
                                </Button>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">JPG/PNG recomendado. (400x400 ideal)</p>
                    </div>
                </div>

                {/* IDENTIDAD (Excel) */}
                <div className="space-y-2">
                    <h3 className="font-semibold">Identidad</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {field("numDocumento", "Num Documento")}
                        {field("nombres", "Nombres")}
                        {field("apellidoPaterno", "Apellido Paterno")}
                        {field("apellidoMaterno", "Apellido Materno")}
                        {selectField("sexo", "Sexo", SEXOS)}
                        {field("fechaNac", "Fecha Nac", { type: "date" })}
                    </div>
                </div>

                {/* CONTACTO */}
                <div className="space-y-2">
                    <h3 className="font-semibold">Contacto</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {field("email", "Email", { type: "email" })}
                        {field("celular", "Celular")}
                    </div>
                </div>

                {/* UBICACIÓN */}
                <div className="space-y-2">
                    <h3 className="font-semibold">Ubicación</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {field("region", "Región")}
                        {field("provincia", "Provincia")}
                        {field("distrito", "Distrito")}
                    </div>
                </div>

                {/* INSTITUCIÓN */}
                <div className="space-y-2">
                    <h3 className="font-semibold">Institución</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {field("codigoModular", "Código Modular")}
                        {field("nombreInstitucion", "Nombre de la institución")}
                        {field("gestion", "Gestión")}
                        {field("tipo", "Tipo")}
                    </div>
                </div>

                {/* ACADÉMICO (Excel) */}
                <div className="space-y-2">
                    <h3 className="font-semibold">Académico</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div className="md:col-span-2">{field("programaCarrera", "Programa / Carrera")}</div>
                        {field("ciclo", "Ciclo", { type: "number", min: 0 })}
                        {selectField("turno", "Turno", TURNOS)}
                        {field("seccion", "Sección")}
                        {field("periodo", "Periodo")}
                        {field("lengua", "Lengua")}
                        {selectField("discapacidad", "Discapacidad", DISCAPACIDAD_OPTS)}
                        <div className="md:col-span-2">{field("tipoDiscapacidad", "Tipo de discapacidad")}</div>
                    </div>
                    {!isAdmin && (
                        <p className="text-xs text-muted-foreground">
                            * La mayoría de datos del Excel están bloqueados para el estudiante. Administración lo gestiona.
                        </p>
                    )}
                </div>

                {/* GUARDAR */}
                <div className="flex justify-end">
                    <Button
                        type="submit"
                        className="rounded-xl gap-2 bg-gradient-to-r from-slate-800 to-slate-600"
                        disabled={loading || saving}
                    >
                        <Save className="h-4 w-4" /> {saving ? "Guardando..." : "Guardar"}
                    </Button>
                </div>
            </form>
        </Card>
    );
}
