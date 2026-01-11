// src/modules/student/StudentProfileForm.jsx
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Upload, Image as ImageIcon, Save, Lock } from "lucide-react";

import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";

// ✅ Catálogos
import { Careers, Plans, Periods } from "../../services/academic.service";

const empty = {
    codigoEstudiante: "",
    dni: "",
    nombres: "",
    apellidos: "",
    sexo: "",
    fechaNacimiento: "",

    email: "",
    celular: "",

    direccion: "",
    departamento: "",
    provincia: "",
    distrito: "",

    // UI helper (NO se manda al backend)
    careerId: "",

    // Backend field (programaId = planId)
    programaId: "",
    cicloActual: "",
    turno: "",
    seccion: "",
    periodoIngreso: "",
    estado: "activo",

    apoderadoNombre: "",
    apoderadoDni: "",
    apoderadoTelefono: "",

    photoUrl: "",
};

const safeDate = (v) => (v ? String(v).slice(0, 10) : "");

const TURNOS = [
    { value: "Mañana", label: "Mañana" },
    { value: "Tarde", label: "Tarde" },
    { value: "Noche", label: "Noche" },
];

const ESTADOS = [
    { value: "activo", label: "Activo" },
    { value: "retirado", label: "Retirado" },
    { value: "egresado", label: "Egresado" },
    { value: "suspendido", label: "Suspendido" },
];

const SEXOS = [
    { value: "M", label: "Masculino (M)" },
    { value: "F", label: "Femenino (F)" },
    { value: "Otro", label: "Otro" },
];

const DEFAULT_CICLOS = Array.from({ length: 10 }).map((_, i) => ({
    value: String(i + 1),
    label: `Ciclo ${i + 1}`,
}));

export default function StudentProfileForm({ mode, student, loading, onSave, onUploadPhoto }) {
    const [form, setForm] = useState(empty);
    const [saving, setSaving] = useState(false);

    const [photoFile, setPhotoFile] = useState(null);
    const [photoPreview, setPhotoPreview] = useState("");

    const isAdmin = mode === "admin";

    // Catálogos
    const [careers, setCareers] = useState([]);
    const [plans, setPlans] = useState([]);
    const [periods, setPeriods] = useState([]);
    const [catsLoading, setCatsLoading] = useState(false);

    // Campos editables por el estudiante
    const studentEditable = useMemo(
        () =>
            new Set([
                "email",
                "celular",
                "direccion",
                "departamento",
                "provincia",
                "distrito",
                "apoderadoNombre",
                "apoderadoDni",
                "apoderadoTelefono",
            ]),
        []
    );

    const canEditField = (key) => (isAdmin ? true : studentEditable.has(key));
    const adminOnly = (key) => !isAdmin; // helper visual

    // Helpers para mapear planes -> carrera y semestres
    const planCareerId = (p) =>
        String(p?.career_id ?? p?.careerId ?? p?.career?.id ?? p?.career?.career_id ?? "");

    const planSemesters = (p) =>
        Number(p?.semesters ?? p?.num_semesters ?? p?.semester_count ?? p?.numSemesters ?? 10) || 10;

    // Cargar catálogos (una vez)
    useEffect(() => {
        let alive = true;

        const loadCats = async () => {
            try {
                setCatsLoading(true);

                const [cRes, plRes, pRes] = await Promise.allSettled([
                    Careers.list(),
                    Plans.list(),
                    Periods.list(),
                ]);

                if (!alive) return;

                setCareers(cRes.status === "fulfilled" ? cRes.value?.careers ?? [] : []);
                setPlans(plRes.status === "fulfilled" ? plRes.value?.plans ?? [] : []);

                if (pRes.status === "fulfilled") {
                    const raw = pRes.value;
                    const arr =
                        (Array.isArray(raw) ? raw : raw?.periods ?? raw?.items ?? raw?.results ?? raw?.data ?? []) || [];
                    setPeriods(arr);
                } else {
                    setPeriods([]);
                }
            } finally {
                if (alive) setCatsLoading(false);
            }
        };

        loadCats();
        return () => {
            alive = false;
        };
    }, []);

    // Si el student ya tiene programaId (planId), inferimos careerId desde plans
    const inferCareerFromPlan = (programaId, plansList) => {
        if (!programaId) return "";
        const p = (plansList || []).find((x) => String(x?.id) === String(programaId));
        return p ? planCareerId(p) : "";
    };

    // Cargar student al form
    useEffect(() => {
        if (!student) {
            setForm(empty);
            setPhotoPreview("");
            return;
        }

        const programaId = student?.programaId?._id ?? student?.programaId ?? "";
        const inferredCareerId = inferCareerFromPlan(programaId, plans);

        setForm((prev) => ({
            ...empty,
            ...student,
            careerId: inferredCareerId || prev.careerId || "",
            programaId,
            cicloActual: student?.cicloActual ?? "",
            fechaNacimiento: safeDate(student?.fechaNacimiento),
            photoUrl: student?.photoUrl || "",
        }));

        setPhotoPreview(student?.photoUrl || "");
        setPhotoFile(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [student, plans]);

    const pickPhoto = (file) => {
        setPhotoFile(file);
        if (!file) return;
        setPhotoPreview(URL.createObjectURL(file));
    };

    const submit = async (e) => {
        e.preventDefault();

        if (!student && mode === "admin") {
            toast.error("Selecciona un estudiante primero.");
            return;
        }

        try {
            setSaving(true);

            // payload para backend
            const payload = { ...form };
            delete payload.careerId; // 🔥 NO existe en backend
            payload.cicloActual = payload.cicloActual === "" ? null : Number(payload.cicloActual);

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

    // Options: carreras
    const careerOptions = useMemo(() => {
        return (careers || [])
            .map((c) => {
                const id = String(c.id ?? c.career_id ?? "");
                const name = c.name ?? c.title ?? `Carrera ${id}`;
                if (!id) return null;
                return { value: id, label: name };
            })
            .filter(Boolean);
    }, [careers]);

    // Options: planes filtrados por carrera
    const planOptions = useMemo(() => {
        const cid = String(form.careerId || "");
        const filtered = cid ? (plans || []).filter((p) => planCareerId(p) === cid) : (plans || []);

        return filtered
            .map((p) => {
                const id = String(p.id ?? "");
                if (!id) return null;

                const name = p.name ?? p.title ?? `Plan ${id}`;
                const year = p.start_year ?? p.year ?? p.academic_year ?? p.startYear ?? "";
                const sem = planSemesters(p);

                // si trae nombre de carrera en el plan, lo anexamos como label informativo
                const cName =
                    p.career_name ??
                    p.career?.name ??
                    p.careerName ??
                    "";

                const label = `${name}${cName ? ` - ${cName}` : ""}${year ? ` (${year})` : ""} - ${sem} sem.`;
                return { value: id, label };
            })
            .filter(Boolean);
    }, [plans, form.careerId]);

    // Ciclos dinámicos según plan (si el plan dice 6, sale 1..6)
    const cycleOptions = useMemo(() => {
        const pid = String(form.programaId || "");
        if (!pid) return DEFAULT_CICLOS;

        const p = (plans || []).find((x) => String(x?.id) === pid);
        const sem = planSemesters(p);
        return Array.from({ length: sem }).map((_, i) => ({
            value: String(i + 1),
            label: `Ciclo ${i + 1}`,
        }));
    }, [plans, form.programaId]);

    // Periodos
    const periodOptions = useMemo(() => {
        if (Array.isArray(periods) && periods.every((x) => typeof x === "string")) {
            return periods.map((p) => ({ value: p, label: p }));
        }
        return (periods || [])
            .map((p) => {
                const val = p.code ?? p.name ?? p.label ?? p.period ?? p.id;
                if (!val) return null;
                return { value: String(val), label: String(val) };
            })
            .filter(Boolean);
    }, [periods]);

    // fallback periodos si backend aún no los devuelve
    const fallbackPeriodOptions = useMemo(() => {
        const y = new Date().getFullYear();
        return [
            { value: `${y}-I`, label: `${y}-I` },
            { value: `${y}-II`, label: `${y}-II` },
            { value: `${y + 1}-I`, label: `${y + 1}-I` },
            { value: `${y + 1}-II`, label: `${y + 1}-II` },
        ];
    }, []);

    const effectivePeriodOptions = periodOptions.length ? periodOptions : fallbackPeriodOptions;

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

                {/* IDENTIDAD */}
                <div className="space-y-2">
                    <h3 className="font-semibold">Identidad</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {field("dni", "DNI")}
                        {field("codigoEstudiante", "Código de estudiante")}
                        {field("nombres", "Nombres")}
                        {field("apellidos", "Apellidos")}
                        {selectField("sexo", "Sexo", SEXOS)}
                        {field("fechaNacimiento", "Fecha nacimiento", { type: "date" })}
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

                {/* DIRECCIÓN (PERÚ) */}
                <div className="space-y-2">
                    <h3 className="font-semibold">Dirección (Perú)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {field("departamento", "Departamento")}
                        {field("provincia", "Provincia")}
                        {field("distrito", "Distrito")}
                        <div className="md:col-span-3">{field("direccion", "Dirección")}</div>
                    </div>
                </div>

                {/* ACADÉMICO */}
                <div className="space-y-2">
                    <h3 className="font-semibold">Académico</h3>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        {/* Carrera (solo admin) */}
                        <div>
                            <Label className="flex items-center gap-2">
                                Carrera
                                {adminOnly("careerId") && (
                                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border">
                                        <Lock className="h-3 w-3" /> Bloqueado
                                    </span>
                                )}
                            </Label>
                            <select
                                className="mt-1 w-full rounded-xl border px-3 py-2 bg-transparent"
                                value={form.careerId ?? ""}
                                onChange={(e) => {
                                    const careerId = e.target.value;
                                    setForm((s) => ({
                                        ...s,
                                        careerId,
                                        programaId: "",  // reset plan
                                        cicloActual: "", // reset ciclo
                                    }));
                                }}
                                disabled={isAdmin ? (loading || saving || catsLoading) : true}
                            >
                                <option value="">— Selecciona —</option>
                                {careerOptions.map((o) => (
                                    <option key={o.value} value={o.value}>
                                        {o.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Plan/Malla (programaId = planId) */}
                        {selectField(
                            "programaId",
                            "Plan / Malla",
                            planOptions,
                            { disabled: (isAdmin ? (loading || saving || catsLoading) : true) }
                        )}

                        {selectField("cicloActual", "Ciclo", cycleOptions)}
                        {selectField("turno", "Turno", TURNOS)}
                        {field("seccion", "Sección")}
                        {selectField("periodoIngreso", "Periodo ingreso", effectivePeriodOptions)}
                        {selectField("estado", "Estado", ESTADOS)}
                    </div>

                    {catsLoading && (
                        <p className="text-xs text-muted-foreground">
                            Cargando catálogos…
                        </p>
                    )}

                    {!isAdmin && (
                        <p className="text-xs text-muted-foreground">
                            * Carrera y Plan/Malla están bloqueados para el estudiante: lo maneja administración.
                        </p>
                    )}
                </div>

                {/* APODERADO */}
                <div className="space-y-2">
                    <h3 className="font-semibold">Apoderado</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {field("apoderadoNombre", "Nombre")}
                        {field("apoderadoDni", "DNI")}
                        {field("apoderadoTelefono", "Teléfono")}
                    </div>
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
