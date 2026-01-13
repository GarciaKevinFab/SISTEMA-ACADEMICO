// src/modules/student/StudentModule.jsx
import "../academic/styles.css";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
    Search,
    RefreshCw,
    GraduationCap,
    ShieldAlert,
    FileText,
    User,
    Users,
    Info,
} from "lucide-react";

import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";

// ✅ Tabs (shadcn)
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "../../components/ui/tabs";

import { StudentsService } from "../../services/students.service";
import StudentProfileForm from "./StudentProfileForm";

// ✅ IMPORTA TU CARD
import StudentKardexCard from "./StudentKardexCard";

import { useAuth } from "../../context/AuthContext";
import { PERMS } from "../../auth/permissions";

/* ---------- Anim ---------- */
const fade = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.25 },
};

/* ---------- Debounce ---------- */
const useDebounce = (value, delay = 400) => {
    const [v, setV] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setV(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return v;
};

const normalizeStudentsPayload = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.students)) return data.students;
    if (Array.isArray(data?.results)) return data.results;
    if (Array.isArray(data?.data)) return data.data;
    return [];
};

const getStudentLabel = (s) => {
    if (!s) return "";
    const ap = `${s.apellidoPaterno || ""} ${s.apellidoMaterno || ""}`.trim();
    const nm = `${s.nombres || ""}`.trim();
    const full = `${ap} ${nm}`.trim();
    return full || s.full_name || s.display_name || "Estudiante";
};

export default function StudentModule() {
    const { hasPerm, roles = [] } = useAuth();

    const isAdminSystem = roles.some((r) =>
        String(r).toUpperCase().includes("ADMIN_SYSTEM")
    );

    const isStudentRole = roles.some((r) =>
        String(r).toUpperCase().includes("STUDENT")
    );

    const canManageStudents =
        isAdminSystem ||
        hasPerm(PERMS["student.manage.list"]) ||
        hasPerm(PERMS["student.manage.view"]) ||
        hasPerm(PERMS["student.manage.edit"]);

    const canSelf =
        isStudentRole ||
        hasPerm(PERMS["student.self.dashboard.view"]) ||
        hasPerm(PERMS["student.self.profile.view"]) ||
        hasPerm(PERMS["student.self.profile.edit"]) ||
        hasPerm(PERMS["student.self.kardex.view"]) ||
        hasPerm(PERMS["student.self.enrollment.view"]);

    const mode = canManageStudents ? "admin" : "student";

    const canViewKardex =
        canManageStudents ||
        hasPerm(PERMS["student.self.kardex.view"]) ||
        isStudentRole;

    /* ===================== STATE ===================== */
    const [loading, setLoading] = useState(true);

    // admin picker
    const [q, setQ] = useState("");
    const dq = useDebounce(q, 450);
    const [candidates, setCandidates] = useState([]);
    const [selectedId, setSelectedId] = useState("");

    // current student record
    const [student, setStudent] = useState(null);
    const [studentLoading, setStudentLoading] = useState(false);

    // Tabs
    const [tab, setTab] = useState("profile");

    /* ===================== LOADERS ===================== */
    const loadMyProfile = useCallback(async () => {
        try {
            setLoading(true);
            const data = await StudentsService.me();
            setStudent(data);
        } catch (e) {
            toast.error(e?.response?.data?.detail || "No se pudo cargar tu perfil");
            setStudent(null);
        } finally {
            setLoading(false);
        }
    }, []);

    const loadCandidates = useCallback(async () => {
        if (mode !== "admin") return;
        try {
            setLoading(true);
            const data = await StudentsService.list(dq ? { q: dq } : undefined);
            setCandidates(normalizeStudentsPayload(data));
        } catch {
            setCandidates([]);
        } finally {
            setLoading(false);
        }
    }, [dq, mode]);

    const loadSelectedStudent = useCallback(async (id) => {
        if (!id) return;
        try {
            setStudent(null);
            setStudentLoading(true);
            const data = await StudentsService.get(id);
            setStudent(data);
        } catch (e) {
            toast.error(e?.response?.data?.detail || "No se pudo cargar el estudiante");
            setStudent(null);
        } finally {
            setStudentLoading(false);
        }
    }, []);

    /* ===================== EFFECTS ===================== */
    useEffect(() => {
        if (mode === "student") loadMyProfile();
        else loadCandidates();
    }, [mode, loadMyProfile, loadCandidates]);

    useEffect(() => {
        if (mode === "admin" && selectedId) loadSelectedStudent(selectedId);
    }, [mode, selectedId, loadSelectedStudent]);

    useEffect(() => {
        if (mode === "admin" && !selectedId) {
            setStudent(null);
            setStudentLoading(false);
        }
    }, [mode, selectedId]);

    // ✅ UX: en admin, cuando selecciona otro, vuelve a Perfil
    useEffect(() => {
        if (mode === "admin" && selectedId) setTab("profile");
    }, [mode, selectedId]);

    // ✅ UX: si se está en kardex pero admin deselecciona, vuelve a perfil
    useEffect(() => {
        if (mode === "admin" && !selectedId && tab === "kardex") setTab("profile");
    }, [mode, selectedId, tab]);

    /* ===================== ACTIONS ===================== */
    const onSave = async (payload) => {
        try {
            if (mode === "admin") {
                if (!selectedId) return toast.error("Selecciona un estudiante primero.");
                const res = await StudentsService.update(selectedId, payload);
                toast.success("Estudiante actualizado");
                setStudent(res);
            } else {
                const res = await StudentsService.updateMe(payload);
                toast.success("Perfil actualizado");
                setStudent(res);
            }
        } catch (e) {
            toast.error(e?.response?.data?.detail || "No se pudo guardar");
        }
    };

    const onUploadPhoto = async (file) => {
        try {
            if (!file) return;

            if (mode === "admin") {
                if (!selectedId) return toast.error("Selecciona un estudiante primero.");
                const res = await StudentsService.uploadPhoto(selectedId, file);
                toast.success("Foto actualizada");
                setStudent((s) => ({ ...(s || {}), ...(res || {}) }));
                if (!res?.photoUrl) loadSelectedStudent(selectedId);
            } else {
                const res = await StudentsService.uploadMyPhoto(file);
                toast.success("Foto actualizada");
                setStudent((s) => ({ ...(s || {}), ...(res || {}) }));
                if (!res?.photoUrl) loadMyProfile();
            }
        } catch (e) {
            toast.error(e?.response?.data?.detail || "No se pudo subir la foto");
        }
    };

    /* ===================== KÁRDEX KEY ===================== */
    const kardexKey = useMemo(() => {
        if (!canViewKardex) return "";

        if (mode === "admin") {
            // Si tu backend acepta ID: ok.
            // Si solo acepta DNI, cambia a: student?.numDocumento || selectedId
            return selectedId || "";
        }

        return (
            student?.id ||
            student?._id ||
            student?.student_id ||
            student?.numDocumento ||
            student?.dni ||
            ""
        );
    }, [mode, selectedId, student, canViewKardex]);

    /* ===================== RENDER ===================== */
    const title = mode === "admin" ? "Estudiantes (Gestión)" : "Mi Perfil";

    const selectedLabel = useMemo(() => {
        if (mode !== "admin") return "";
        if (!student) return "";
        const doc = student?.numDocumento ? ` · DOC ${student.numDocumento}` : "";
        return `${getStudentLabel(student)}${doc}`;
    }, [mode, student]);

    if (!canManageStudents && !canSelf) {
        return (
            <div className="h-full p-4 md:p-6">
                <Card className="rounded-2xl border-t-4 border-t-rose-600 bg-white/70 dark:bg-neutral-900/60 backdrop-blur-md">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ShieldAlert className="h-5 w-5" /> Sin acceso
                        </CardTitle>
                        <CardDescription>No tienes permisos para ver este módulo.</CardDescription>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto p-4 md:p-6 pb-40 space-y-6">
            <motion.div {...fade}>
                <Card className="rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] border-t-4 border-t-slate-700 bg-white/70 dark:bg-neutral-900/60 backdrop-blur-md">
                    <CardHeader className="pb-3">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <GraduationCap className="h-5 w-5" /> {title}
                                </CardTitle>
                                <CardDescription>
                                    {mode === "admin"
                                        ? "Busca, selecciona y gestiona la ficha. El kárdex va en su pestaña."
                                        : "Revisa tus datos y actualiza lo permitido (contacto/dirección/foto)."}
                                </CardDescription>
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    className="rounded-xl gap-2"
                                    onClick={() => (mode === "admin" ? loadCandidates() : loadMyProfile())}
                                    disabled={loading || studentLoading}
                                >
                                    <RefreshCw className={`h-4 w-4 ${(loading || studentLoading) ? "animate-spin" : ""}`} />
                                    Recargar
                                </Button>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-5">
                        {/* ADMIN: picker mejorado */}
                        {mode === "admin" && (
                            <div className="rounded-2xl border border-white/50 dark:border-white/10 p-4 bg-white/60 dark:bg-neutral-900/40">
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                                    <div className="md:col-span-7">
                                        <Label>Buscar estudiante</Label>
                                        <div className="relative mt-1">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60" />
                                            <Input
                                                className="pl-9 rounded-xl"
                                                placeholder="Documento, apellidos, nombres..."
                                                value={q}
                                                onChange={(e) => setQ(e.target.value)}
                                            />
                                        </div>

                                        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                                            <Info className="h-4 w-4" />
                                            Tip: escribe DNI o apellidos. El backend debe soportar filtro <code>q</code>.
                                        </div>
                                    </div>

                                    <div className="md:col-span-5">
                                        <Label>Seleccionar</Label>
                                        <div className="mt-1 relative">
                                            <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60 pointer-events-none" />
                                            <select
                                                className="w-full rounded-xl border pl-9 pr-3 py-2 bg-transparent"
                                                value={selectedId}
                                                onChange={(e) => setSelectedId(e.target.value)}
                                            >
                                                <option value="">— Selecciona —</option>
                                                {candidates.map((s) => {
                                                    const id = s.id || s._id;
                                                    const ap = `${s.apellidoPaterno || ""} ${s.apellidoMaterno || ""}`.trim();
                                                    const name = `${ap} ${s.nombres || ""}`.trim() || "—";
                                                    const doc = s.numDocumento ? `DOC ${s.numDocumento}` : "";
                                                    return (
                                                        <option key={id} value={id}>
                                                            {name} {doc ? `- ${doc}` : ""}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {studentLoading ? (
                                    <div className="mt-3 text-sm text-muted-foreground">
                                        Cargando estudiante…
                                    </div>
                                ) : selectedId && student ? (
                                    <div className="mt-3 rounded-xl border bg-white/60 dark:bg-neutral-900/30 px-3 py-2 text-sm flex items-center justify-between gap-2">
                                        <div className="truncate">
                                            <span className="font-medium">Seleccionado:</span>{" "}
                                            <span className="text-muted-foreground">{selectedLabel}</span>
                                        </div>

                                        {canViewKardex ? (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="rounded-xl"
                                                onClick={() => setTab("kardex")}
                                            >
                                                <FileText className="h-4 w-4 mr-2" />
                                                Ver kárdex
                                            </Button>
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>
                        )}

                        {/* ✅ Tabs con estilo tipo "píldora" (mejor UX visual) */}
                        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
                            <TabsList
                                className="
                  w-full
                  flex
                  flex-wrap
                  gap-2
                  p-2
                  rounded-2xl
                  bg-white/70 dark:bg-neutral-900/40
                  border border-white/40 dark:border-white/10
                  shadow-sm
                "
                            >
                                <TabsTrigger
                                    value="profile"
                                    className="
                    rounded-xl
                    px-4 py-2
                    flex items-center gap-2
                    data-[state=active]:bg-slate-900 data-[state=active]:text-white
                    dark:data-[state=active]:bg-white dark:data-[state=active]:text-black
                  "
                                >
                                    <User className="h-4 w-4" />
                                    Perfil
                                </TabsTrigger>

                                {canViewKardex ? (
                                    <TabsTrigger
                                        value="kardex"
                                        disabled={mode === "admin" && !selectedId}
                                        className="
                      rounded-xl
                      px-4 py-2
                      flex items-center gap-2
                      data-[state=active]:bg-slate-900 data-[state=active]:text-white
                      dark:data-[state=active]:bg-white dark:data-[state=active]:text-black
                      data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed
                    "
                                    >
                                        <FileText className="h-4 w-4" />
                                        Kárdex / Notas
                                    </TabsTrigger>
                                ) : null}
                            </TabsList>

                            {/* PERFIL */}
                            <TabsContent value="profile" className="mt-0">
                                {mode === "student" ? (
                                    <StudentProfileForm
                                        mode={mode}
                                        student={student}
                                        loading={loading}
                                        onSave={onSave}
                                        onUploadPhoto={onUploadPhoto}
                                    />
                                ) : selectedId ? (
                                    <StudentProfileForm
                                        mode={mode}
                                        student={student}
                                        loading={loading || studentLoading}
                                        onSave={onSave}
                                        onUploadPhoto={onUploadPhoto}
                                    />
                                ) : (
                                    <div className="rounded-2xl border border-white/50 dark:border-white/10 p-4 bg-white/60 dark:bg-neutral-900/40">
                                        <p className="text-sm text-muted-foreground">
                                            Selecciona un estudiante para ver y editar su ficha.
                                        </p>
                                    </div>
                                )}
                            </TabsContent>

                            {/* KÁRDEX */}
                            {canViewKardex ? (
                                <TabsContent value="kardex" className="mt-0">
                                    {mode === "admin" && !selectedId ? (
                                        <div className="rounded-2xl border border-white/50 dark:border-white/10 p-4 bg-white/60 dark:bg-neutral-900/40">
                                            <p className="text-sm text-muted-foreground">
                                                Selecciona un estudiante para ver su kárdex.
                                            </p>
                                        </div>
                                    ) : (
                                        <StudentKardexCard
                                            mode={mode}
                                            studentKey={kardexKey}
                                            titlePrefix="Kárdex / Notas"
                                        />
                                    )}
                                </TabsContent>
                            ) : null}
                        </Tabs>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
}
