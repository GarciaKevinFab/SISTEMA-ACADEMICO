// src/modules/student/StudentModule.jsx — UI/UX mejorado
import "../academic/styles.css";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
    Search, RefreshCw, GraduationCap, ShieldAlert, FileText,
    User, Users, Info, ChevronDown, KeyRound, Lock, CheckCircle2,
    Check, X, Loader2, BookOpen, Shield,
} from "lucide-react";

import {
    Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Separator } from "../../components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";

import { StudentsService } from "../../services/students.service";
import { UsersService } from "../../services/users.service";
import StudentProfileForm from "./StudentProfileForm";
import StudentKardexCard from "./StudentKardexCard";

import { useAuth } from "../../context/AuthContext";
import { PERMS } from "../../auth/permissions";

/* ─────────────────────────── ESTILOS ─────────────────────────── */
const studentStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  .student-module * { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }

  /* Header */
  .stu-header {
    background: linear-gradient(white, white) padding-box,
                linear-gradient(135deg, #475569 0%, #1E293B 100%) border-box;
    border: 1.5px solid transparent;
  }

  /* Password strength bar */
  @keyframes bar-grow { from { width: 0 } }
  .strength-bar { animation: bar-grow 0.35s ease; }

  /* Candidate select */
  .stu-select {
    appearance: none;
    background: white;
    border: 1.5px solid #E2E8F0;
    border-radius: 10px;
    padding: 8px 36px 8px 12px;
    font-size: 13px;
    width: 100%;
    cursor: pointer;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .stu-select:focus { border-color: #94A3B8; box-shadow: 0 0 0 3px rgba(148,163,184,0.15); }
  .stu-select:hover { border-color: #94A3B8; }

  /* Student active chip */
  .stu-active-chip {
    border: 1.5px solid #D1FAE5;
    background: linear-gradient(135deg, #F0FDF4, #ECFDF5);
    border-radius: 12px;
  }

  /* Tab pill active */
  .stu-tab[data-state=active] {
    background: white;
    border-color: #E2E8F0 !important;
    box-shadow: 0 1px 4px rgba(0,0,0,0.07);
    font-weight: 700;
    color: #1E293B;
  }

  /* Danger alert card */
  .pwd-alert {
    border: 1.5px solid #FECACA;
    background: linear-gradient(135deg, #FFF5F5, #FEF2F2);
    border-radius: 16px;
  }

  /* Empty / locked state */
  .empty-state {
    border: 1.5px dashed #E2E8F0;
    border-radius: 16px;
    background: #FAFAFA;
  }

  /* Fade in */
  @keyframes fade-in { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:none} }
  .fade-in { animation: fade-in 0.25s ease both; }

  /* Skeleton */
  @keyframes skel { 0%,100%{opacity:.4} 50%{opacity:.85} }
  .skel { animation: skel 1.4s ease-in-out infinite; background: #E2E8F0; border-radius: 6px; }
`;

function InjectStudentStyles() {
    useEffect(() => {
        const id = "student-styles";
        if (document.getElementById(id)) return;
        const s = document.createElement("style");
        s.id = id; s.textContent = studentStyles;
        document.head.appendChild(s);
        return () => document.getElementById(id)?.remove();
    }, []);
    return null;
}

/* ─────────────────────────── UTILS ─────────────────────────── */
const useDebounce = (value, delay = 400) => {
    const [v, setV] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setV(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return v;
};

const normalizeStudents = (data) => {
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
    return `${ap} ${nm}`.trim() || s.full_name || s.display_name || "Estudiante";
};

const getInitials = (s) => {
    const label = getStudentLabel(s);
    const parts = label.split(" ").filter(Boolean);
    if (!parts.length) return "?";
    return parts.length === 1
        ? parts[0][0].toUpperCase()
        : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/** 0–4: strength score */
const pwdStrength = (p = "") =>
    (p.length >= 8 ? 1 : 0) +
    (/[A-Z]/.test(p) ? 1 : 0) +
    (/[0-9]/.test(p) ? 1 : 0) +
    (/[^a-zA-Z0-9]/.test(p) ? 1 : 0);

const STRENGTH = [
    { label: "", color: "bg-slate-200", text: "" },
    { label: "Muy débil", color: "bg-red-500", text: "text-red-600" },
    { label: "Débil", color: "bg-orange-400", text: "text-orange-600" },
    { label: "Media", color: "bg-yellow-400", text: "text-yellow-600" },
    { label: "Fuerte", color: "bg-emerald-500", text: "text-emerald-600" },
];

/* ─────────────────────────── COMPONENTES ─────────────────────────── */
function SectionHeader({ title, description, Icon, accent = "slate" }) {
    const styles = {
        slate: "bg-slate-50 text-slate-700",
        emerald: "bg-emerald-50 text-emerald-700",
        red: "bg-red-50 text-red-700",
        blue: "bg-blue-50 text-blue-700",
    };
    return (
        <div className="flex items-start gap-3">
            {Icon && (
                <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${styles[accent]}`}>
                    <Icon size={17} />
                </div>
            )}
            <div>
                <CardTitle className="text-[15px] font-700 text-slate-800 leading-tight">{title}</CardTitle>
                {description && <CardDescription className="text-xs mt-0.5">{description}</CardDescription>}
            </div>
        </div>
    );
}

function LockedState({ message }) {
    return (
        <div className="empty-state p-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <Lock size={20} className="text-slate-400" />
            </div>
            <p className="text-sm font-600 text-slate-600">{message}</p>
        </div>
    );
}

/* ─────────────────────────── CAMBIO CONTRASEÑA ─────────────────────────── */
function ForcePasswordChange({ pwd, setPwd, pwdSaving, onSubmit }) {
    const score = pwdStrength(pwd.new_password);
    const str = STRENGTH[score];
    const match = pwd.confirm_password && pwd.new_password === pwd.confirm_password;
    const mismatch = pwd.confirm_password && pwd.new_password !== pwd.confirm_password;

    return (
        <div className="pwd-alert p-5 space-y-5 fade-in">
            {/* Header alerta */}
            <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                    <ShieldAlert size={19} className="text-red-600" />
                </div>
                <div>
                    <h3 className="text-sm font-800 text-red-900">Acción requerida: cambia tu contraseña</h3>
                    <p className="text-xs text-red-700/70 mt-0.5 leading-relaxed">
                        Estás usando una credencial temporal. Establece una contraseña propia para continuar.
                    </p>
                </div>
            </div>

            <Separator className="bg-red-100" />

            <form onSubmit={onSubmit} className="space-y-4">
                {/* Contraseña actual */}
                <div className="space-y-1.5">
                    <Label className="text-xs font-700 text-red-900/80">Contraseña temporal *</Label>
                    <div className="relative">
                        <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-red-400 pointer-events-none" />
                        <Input
                            type="password"
                            className="h-9 pl-8 text-sm rounded-lg border-red-200 focus:border-red-400 focus:ring-red-100 bg-white"
                            value={pwd.current_password}
                            onChange={(e) => setPwd((s) => ({ ...s, current_password: e.target.value }))}
                            placeholder="Contraseña actual / temporal"
                            required disabled={pwdSaving}
                        />
                    </div>
                </div>

                {/* Nueva + confirmar */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label className="text-xs font-700 text-red-900/80">Nueva contraseña *</Label>
                        <div className="relative">
                            <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-red-400 pointer-events-none" />
                            <Input
                                type="password"
                                className="h-9 pl-8 text-sm rounded-lg border-red-200 focus:border-red-400 focus:ring-red-100 bg-white"
                                value={pwd.new_password}
                                onChange={(e) => setPwd((s) => ({ ...s, new_password: e.target.value }))}
                                placeholder="Mínimo 8 caracteres"
                                required disabled={pwdSaving}
                            />
                        </div>
                        {/* Barra de fortaleza */}
                        {pwd.new_password && (
                            <div className="space-y-1 pt-0.5">
                                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                                    <div
                                        className={`strength-bar h-full rounded-full transition-all duration-400 ${str.color}`}
                                        style={{ width: `${score * 25}%` }}
                                    />
                                </div>
                                <p className={`text-[10px] font-700 ${str.text}`}>{str.label}</p>
                            </div>
                        )}
                        {!pwd.new_password && (
                            <p className="text-[10px] text-red-500/60">Mínimo 8 caracteres, mayúscula y número</p>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs font-700 text-red-900/80">Confirmar contraseña *</Label>
                        <div className="relative">
                            <CheckCircle2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-red-400 pointer-events-none" />
                            <Input
                                type="password"
                                className={`h-9 pl-8 text-sm rounded-lg bg-white transition-colors
                                    ${match ? "border-emerald-300 focus:border-emerald-400 focus:ring-emerald-100" :
                                        mismatch ? "border-red-300 focus:border-red-400 focus:ring-red-100" :
                                            "border-red-200 focus:border-red-400 focus:ring-red-100"}`}
                                value={pwd.confirm_password}
                                onChange={(e) => setPwd((s) => ({ ...s, confirm_password: e.target.value }))}
                                placeholder="Repite la nueva contraseña"
                                required disabled={pwdSaving}
                            />
                        </div>
                        {pwd.confirm_password && (
                            <p className={`text-[10px] font-700 flex items-center gap-1 ${match ? "text-emerald-600" : "text-red-500"}`}>
                                {match
                                    ? <><Check size={10} /> Las contraseñas coinciden</>
                                    : <><X size={10} /> No coinciden</>
                                }
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex justify-end pt-1">
                    <Button
                        type="submit" disabled={pwdSaving}
                        className="h-9 text-sm gap-2 rounded-lg bg-red-600 hover:bg-red-700 text-white"
                    >
                        {pwdSaving
                            ? <><Loader2 size={13} className="animate-spin" /> Guardando...</>
                            : <><Check size={13} /> Actualizar contraseña</>
                        }
                    </Button>
                </div>
            </form>
        </div>
    );
}

/* ─────────────────────────── PICKER DE ESTUDIANTE (admin) ─────────────────────────── */
function StudentPicker({ q, setQ, candidates, selectedId, setSelectedId, student, selectedLabel, loading, studentLoading, canViewKardex, onGoKardex }) {
    return (
        <div className="border border-slate-100 rounded-2xl p-5 bg-slate-50/50 space-y-4 fade-in">
            <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Search size={13} className="text-slate-500" />
                </div>
                <p className="text-xs font-700 uppercase tracking-wider text-slate-500">Selector de estudiante</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Búsqueda */}
                <div className="space-y-1.5">
                    <Label className="text-xs font-600 text-slate-600 flex items-center gap-1.5">
                        <Search size={11} className="text-slate-400" /> Buscar
                    </Label>
                    <div className="relative">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <Input
                            className="h-9 pl-8 text-sm rounded-lg border-slate-200 bg-white focus:border-slate-400"
                            placeholder="DNI, apellidos o nombres..."
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                        />
                    </div>
                    <p className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Info size={9} /> Filtro por DNI o apellidos (parámetro q)
                    </p>
                </div>

                {/* Selector */}
                <div className="space-y-1.5">
                    <Label className="text-xs font-600 text-slate-600 flex items-center gap-1.5">
                        <Users size={11} className="text-slate-400" />
                        Resultados
                        <span className="ml-1 text-[10px] font-700 bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">
                            {candidates.length}
                        </span>
                    </Label>
                    <div className="relative">
                        <select
                            className="stu-select"
                            value={selectedId}
                            onChange={(e) => setSelectedId(e.target.value)}
                        >
                            <option value="">— Selecciona un resultado —</option>
                            {candidates.map((s) => {
                                const id = s.id || s._id;
                                const ap = `${s.apellidoPaterno || ""} ${s.apellidoMaterno || ""}`.trim();
                                const name = `${ap} ${s.nombres || ""}`.trim() || "—";
                                const doc = s.numDocumento ? ` · ${s.numDocumento}` : "";
                                return (
                                    <option key={id} value={id}>{name}{doc}</option>
                                );
                            })}
                        </select>
                        <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                </div>
            </div>

            {/* Estado del estudiante seleccionado */}
            {studentLoading && (
                <div className="flex items-center gap-2 text-xs text-slate-500 bg-white border border-slate-100 rounded-xl px-4 py-3">
                    <Loader2 size={13} className="animate-spin text-slate-400" />
                    Cargando ficha del estudiante...
                </div>
            )}

            {!studentLoading && selectedId && student && (
                <div className="stu-active-chip px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 fade-in">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-800 text-sm shrink-0">
                            {getInitials(student)}
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-700 text-emerald-800 truncate">Estudiante seleccionado</p>
                            <p className="text-xs text-emerald-600/70 truncate">{selectedLabel}</p>
                        </div>
                    </div>
                    {canViewKardex && (
                        <Button
                            variant="outline" size="sm"
                            className="h-8 text-xs gap-1.5 rounded-lg border-emerald-200 text-emerald-700 hover:bg-emerald-100 shrink-0"
                            onClick={onGoKardex}
                        >
                            <BookOpen size={12} /> Ver historial académico
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}

/* ─────────────────────────── MÓDULO PRINCIPAL ─────────────────────────── */
export default function StudentModule() {
    const { hasPerm, roles = [], user, refreshMe } = useAuth();

    const isAdminSystem = roles.some((r) => String(r).toUpperCase().includes("ADMIN_SYSTEM"));
    const isStudentRole = roles.some((r) => String(r).toUpperCase().includes("STUDENT"));

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

    const mustChangePassword = isStudentRole && !!user?.must_change_password;

    /* ── State ── */
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState("");
    const dq = useDebounce(q, 450);
    const [candidates, setCandidates] = useState([]);
    const [selectedId, setSelectedId] = useState("");
    const [student, setStudent] = useState(null);
    const [studentLoading, setStudentLoading] = useState(false);
    const [tab, setTab] = useState("profile");

    const [pwd, setPwd] = useState({ current_password: "", new_password: "", confirm_password: "" });
    const [pwdSaving, setPwdSaving] = useState(false);

    /* ── Loaders ── */
    const loadMyProfile = useCallback(async () => {
        try {
            setLoading(true);
            setStudent(await StudentsService.me());
        } catch (e) {
            toast.error(e?.response?.data?.detail || "No se pudo cargar tu perfil");
            setStudent(null);
        } finally { setLoading(false); }
    }, []);

    const loadCandidates = useCallback(async () => {
        if (mode !== "admin") return;
        try {
            setLoading(true);
            setCandidates(normalizeStudents(await StudentsService.list(dq ? { q: dq } : undefined)));
        } catch { setCandidates([]); }
        finally { setLoading(false); }
    }, [dq, mode]);

    const loadSelectedStudent = useCallback(async (id) => {
        if (!id) return;
        try {
            setStudent(null); setStudentLoading(true);
            setStudent(await StudentsService.get(id));
        } catch (e) {
            toast.error(e?.response?.data?.detail || "No se pudo cargar el estudiante");
            setStudent(null);
        } finally { setStudentLoading(false); }
    }, []);

    /* ── Effects ── */
    useEffect(() => {
        if (mode === "student") loadMyProfile();
        else loadCandidates();
    }, [mode, loadMyProfile, loadCandidates]);

    useEffect(() => {
        if (mode === "admin" && selectedId) loadSelectedStudent(selectedId);
    }, [mode, selectedId, loadSelectedStudent]);

    useEffect(() => {
        if (mode === "admin" && !selectedId) { setStudent(null); setStudentLoading(false); }
    }, [mode, selectedId]);

    useEffect(() => {
        if (mode === "admin" && selectedId) setTab("profile");
    }, [mode, selectedId]);

    useEffect(() => {
        if (mode === "admin" && !selectedId && tab === "kardex") setTab("profile");
    }, [mode, selectedId, tab]);

    /* ── Actions ── */
    const onSave = async (payload) => {
        try {
            if (mode === "admin") {
                if (!selectedId) return toast.error("Selecciona un estudiante primero.");
                setStudent(await StudentsService.update(selectedId, payload));
                toast.success("Estudiante actualizado");
            } else {
                setStudent(await StudentsService.updateMe(payload));
                toast.success("Perfil actualizado");
            }
        } catch (e) { toast.error(e?.response?.data?.detail || "No se pudo guardar"); }
    };

    const onUploadPhoto = async (file) => {
        if (!file) return;
        try {
            if (mode === "admin") {
                if (!selectedId) return toast.error("Selecciona un estudiante primero.");
                const res = await StudentsService.uploadPhoto(selectedId, file);
                setStudent((s) => ({ ...(s || {}), ...(res || {}) }));
                if (!res?.photoUrl) loadSelectedStudent(selectedId);
            } else {
                const res = await StudentsService.uploadMyPhoto(file);
                setStudent((s) => ({ ...(s || {}), ...(res || {}) }));
                if (!res?.photoUrl) loadMyProfile();
            }
            toast.success("Foto actualizada");
        } catch (e) { toast.error(e?.response?.data?.detail || "No se pudo subir la foto"); }
    };

    const onChangeTempPassword = async (e) => {
        e.preventDefault();
        if (pwdSaving) return;
        const cur = pwd.current_password.trim();
        const np = pwd.new_password.trim();
        const cp = pwd.confirm_password.trim();
        if (!cur || !np || !cp) return toast.error("Completa todos los campos.");
        if (np !== cp) return toast.error("La confirmación no coincide.");
        if (np.length < 8) return toast.error("Mínimo 8 caracteres.");
        try {
            setPwdSaving(true);
            await UsersService.changeMyPassword({ current_password: cur, new_password: np });
            if (refreshMe) await refreshMe();
            setPwd({ current_password: "", new_password: "", confirm_password: "" });
            toast.success("Contraseña actualizada. Ya puedes continuar.");
        } catch (err) {
            toast.error(err?.response?.data?.detail || "No se pudo actualizar la contraseña");
        } finally { setPwdSaving(false); }
    };

    /* ── Derived ── */
    const kardexKey = useMemo(() => {
        if (!canViewKardex) return "";
        if (mode === "admin") return selectedId || "";
        return student?.id || student?._id || student?.student_id || student?.numDocumento || student?.dni || "";
    }, [mode, selectedId, student, canViewKardex]);

    const selectedLabel = useMemo(() => {
        if (mode !== "admin" || !student) return "";
        const doc = student?.numDocumento ? ` · DNI ${student.numDocumento}` : "";
        return `${getStudentLabel(student)}${doc}`;
    }, [mode, student]);

    const isRefreshing = loading || studentLoading;

    /* ── Sin acceso ── */
    if (!canManageStudents && !canSelf) {
        return (
            <>
                <InjectStudentStyles />
                <div className="student-module h-full p-4 md:p-6">
                    <Card className="rounded-2xl border border-red-100 bg-white shadow-sm">
                        <CardHeader>
                            <SectionHeader title="Sin acceso" description="No tienes permisos para ver este módulo." Icon={ShieldAlert} accent="red" />
                        </CardHeader>
                    </Card>
                </div>
            </>
        );
    }

    /* ── Render principal ── */
    return (
        <>
            <InjectStudentStyles />
            <div className="student-module w-full min-w-0 p-4 md:p-6 pb-16 space-y-5">

                {/* Card contenedora */}
                <div className="stu-header rounded-2xl bg-white shadow-sm p-4 md:p-6 space-y-5">

                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center shadow-sm">
                                <GraduationCap size={19} className="text-white" />
                            </div>
                            <div>
                                <h1 className="text-lg font-800 text-slate-800 leading-tight">
                                    {mode === "admin" ? "Gestión de Estudiantes" : "Mi Perfil Académico"}
                                </h1>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    {mode === "admin"
                                        ? "Busca, selecciona y gestiona fichas de estudiantes"
                                        : "Revisa tus datos y actualiza contacto, dirección y foto"}
                                </p>
                            </div>
                        </div>

                        <Button
                            variant="outline" size="sm"
                            className="h-9 text-xs gap-1.5 rounded-lg border-slate-200 hover:bg-slate-50 shrink-0 self-start"
                            onClick={() => mode === "admin" ? loadCandidates() : loadMyProfile()}
                            disabled={isRefreshing || pwdSaving}
                        >
                            <RefreshCw size={13} className={isRefreshing ? "animate-spin" : ""} />
                            {isRefreshing ? "Cargando..." : "Actualizar"}
                        </Button>
                    </div>

                    <Separator className="bg-slate-100" />

                    {/* Cambio de contraseña forzado */}
                    {mustChangePassword && (
                        <ForcePasswordChange
                            pwd={pwd} setPwd={setPwd}
                            pwdSaving={pwdSaving} onSubmit={onChangeTempPassword}
                        />
                    )}

                    {/* Picker admin */}
                    {mode === "admin" && (
                        <StudentPicker
                            q={q} setQ={setQ}
                            candidates={candidates}
                            selectedId={selectedId} setSelectedId={setSelectedId}
                            student={student} selectedLabel={selectedLabel}
                            loading={loading} studentLoading={studentLoading}
                            canViewKardex={canViewKardex}
                            onGoKardex={() => setTab("kardex")}
                        />
                    )}

                    {/* Tabs: Perfil / Historial */}
                    <Tabs value={tab} onValueChange={setTab} className="space-y-4">
                        <TabsList className="grid grid-cols-2 gap-2 h-auto bg-slate-50 border border-slate-200 p-1.5 rounded-xl">
                            <TabsTrigger
                                value="profile"
                                className="stu-tab flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-600 text-slate-500 hover:text-slate-700 transition-all border border-transparent"
                            >
                                <User size={13} />
                                <span>Ficha de Perfil</span>
                            </TabsTrigger>

                            {canViewKardex && (
                                <TabsTrigger
                                    value="kardex"
                                    disabled={(mode === "admin" && !selectedId) || mustChangePassword}
                                    className="stu-tab flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-600 text-slate-500 hover:text-slate-700 transition-all border border-transparent data-[disabled]:opacity-40 data-[disabled]:cursor-not-allowed"
                                >
                                    <BookOpen size={13} />
                                    <span>Historial Académico</span>
                                    {mode === "admin" && !selectedId && (
                                        <span className="ml-1 text-[9px] text-slate-400">(selecciona primero)</span>
                                    )}
                                </TabsTrigger>
                            )}
                        </TabsList>

                        {/* Contenido Perfil */}
                        <TabsContent value="profile" className="mt-0 fade-in">
                            {mustChangePassword ? (
                                <LockedState message="Completa el cambio de contraseña para acceder a tu perfil." />
                            ) : mode === "student" ? (
                                <StudentProfileForm
                                    mode={mode} student={student}
                                    loading={loading} onSave={onSave} onUploadPhoto={onUploadPhoto}
                                />
                            ) : selectedId ? (
                                <StudentProfileForm
                                    mode={mode} student={student}
                                    loading={loading || studentLoading}
                                    onSave={onSave} onUploadPhoto={onUploadPhoto}
                                />
                            ) : (
                                <div className="empty-state p-10 text-center">
                                    <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                                        <Users size={22} className="text-slate-400" />
                                    </div>
                                    <p className="text-sm font-700 text-slate-600">Ningún estudiante seleccionado</p>
                                    <p className="text-xs text-slate-400 mt-1">Usa el buscador de arriba para encontrar y seleccionar un estudiante</p>
                                </div>
                            )}
                        </TabsContent>

                        {/* Contenido Kárdex */}
                        {canViewKardex && (
                            <TabsContent value="kardex" className="mt-0 fade-in">
                                {mustChangePassword ? (
                                    <LockedState message="Completa el cambio de contraseña para ver el historial académico." />
                                ) : mode === "admin" && !selectedId ? (
                                    <div className="empty-state p-10 text-center">
                                        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                                            <BookOpen size={22} className="text-slate-400" />
                                        </div>
                                        <p className="text-sm font-700 text-slate-600">Selecciona un estudiante</p>
                                        <p className="text-xs text-slate-400 mt-1">El historial académico aparecerá aquí una vez seleccionado</p>
                                    </div>
                                ) : (
                                    <StudentKardexCard
                                        mode={mode}
                                        studentKey={kardexKey}
                                        titlePrefix="Kárdex / Notas"
                                    />
                                )}
                            </TabsContent>
                        )}
                    </Tabs>
                </div>
            </div>
        </>
    );
}