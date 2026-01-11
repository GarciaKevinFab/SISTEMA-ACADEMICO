// src/modules/student/StudentModule.jsx
import "../academic/styles.css"; // si quieres el mismo look que tus módulos
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Search, RefreshCw, GraduationCap, ShieldAlert } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";

import { StudentsService } from "../../services/students.service";
import StudentProfileForm from "./StudentProfileForm";

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

export default function StudentModule() {
    const { hasPerm, user } = useAuth();

    // ✅ Ajusta estas reglas a tu auth real
    const roles = Array.isArray(user?.roles) ? user.roles : [];
    const isAdminSystem = roles.some((r) => String(r).toUpperCase().includes("ADMIN_SYSTEM"));

    // Si tienes permiso específico, mejor:
    const adminManagePerm = PERMS["admin.access.manage"] ?? "admin.access.manage";
    const canAdmin = isAdminSystem || hasPerm(adminManagePerm);

    const isStudent = roles.some((r) => String(r).toUpperCase().includes("STUDENT"));

    // Modo final (admin o student)
    const mode = canAdmin ? "admin" : "student";

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
        if (mode === "student") {
            loadMyProfile();
        } else {
            loadCandidates();
        }
    }, [mode, loadMyProfile, loadCandidates]);

    useEffect(() => {
        if (mode === "admin") loadCandidates();
    }, [mode, loadCandidates]);

    useEffect(() => {
        if (mode === "admin" && selectedId) loadSelectedStudent(selectedId);
    }, [mode, selectedId, loadSelectedStudent]);

    /* ===================== ACTIONS ===================== */
    const onSave = async (payload) => {
        try {
            if (mode === "admin") {
                if (!selectedId) {
                    toast.error("Selecciona un estudiante primero.");
                    return;
                }
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
                if (!selectedId) {
                    toast.error("Selecciona un estudiante primero.");
                    return;
                }
                const res = await StudentsService.uploadPhoto(selectedId, file);
                toast.success("Foto actualizada");
                // backend puede devolver photoUrl; si no, recarga:
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

    /* ===================== RENDER ===================== */
    const title = mode === "admin" ? "Estudiante (Admin)" : "Mi Perfil";

    // Si no es admin ni student, no debería entrar acá
    if (!canAdmin && !isStudent) {
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
                                        ? "Selecciona un estudiante y completa su ficha (datos + foto)."
                                        : "Revisa tus datos y actualiza lo permitido (contacto/dirección/foto)."}
                                </CardDescription>
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    className="rounded-xl gap-2"
                                    onClick={() => (mode === "admin" ? loadCandidates() : loadMyProfile())}
                                >
                                    <RefreshCw className="h-4 w-4" /> Recargar
                                </Button>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-5">
                        {/* ADMIN: picker */}
                        {mode === "admin" && (
                            <div className="rounded-2xl border border-white/50 dark:border-white/10 p-3 bg-white/60 dark:bg-neutral-900/40">
                                <div className="flex flex-col gap-3 md:flex-row md:items-end">
                                    <div className="flex-1">
                                        <Label>Buscar estudiante</Label>
                                        <div className="relative mt-1">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60" />
                                            <Input
                                                className="pl-9 rounded-xl"
                                                placeholder="DNI, código, nombres..."
                                                value={q}
                                                onChange={(e) => setQ(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <div className="w-full md:w-[320px]">
                                        <Label>Seleccionar</Label>
                                        <select
                                            className="mt-1 w-full rounded-xl border px-3 py-2 bg-transparent"
                                            value={selectedId}
                                            onChange={(e) => setSelectedId(e.target.value)}
                                        >
                                            <option value="">— Selecciona —</option>
                                            {candidates.map((s) => {
                                                const id = s.id || s._id;
                                                const name = `${s.apellidos || ""} ${s.nombres || ""}`.trim() || "—";
                                                const dni = s.dni ? `DNI ${s.dni}` : "";
                                                const cod = s.codigoEstudiante ? `COD ${s.codigoEstudiante}` : "";
                                                return (
                                                    <option key={id} value={id}>
                                                        {name} {dni ? `- ${dni}` : ""} {cod ? `- ${cod}` : ""}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Tip: si hay miles, el backend debe soportar filtro `q`.
                                        </p>
                                    </div>
                                </div>

                                {studentLoading && (
                                    <p className="mt-3 text-sm text-muted-foreground">Cargando estudiante…</p>
                                )}
                            </div>
                        )}

                        {/* FORM */}
                        <StudentProfileForm
                            mode={mode}
                            student={student}
                            loading={loading}
                            onSave={onSave}
                            onUploadPhoto={onUploadPhoto}
                        />
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
}
