// src/pages/academic/GradesAttendanceComponent.jsx
import React, { useState, useEffect, useContext, useMemo, useCallback } from "react";
import { AuthContext } from "../../context/AuthContext";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Progress } from "../../components/ui/progress";
import { toast } from "sonner";
import {
  Upload, Save, Send, Lock, Unlock, FileText, Users, Calendar,
  ChevronLeft, ChevronRight, Loader2, ShieldAlert, FileSpreadsheet,
  KeyRound, X, CheckCircle2, Check, AlertCircle, ClipboardList,
  BookOpen, Clock,
} from "lucide-react";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
  AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";

import { UsersService } from "../../services/users.service";
import { generatePDFWithPolling, generateQRWithPolling, downloadFile } from "../../utils/pdfQrPolling";
import { Attendance, Teacher, SectionStudents, Grades, AttendanceImport } from "../../services/academic.service";
import { Imports } from "../../services/catalogs.service";

/* ─── Pagination ─────────────────────────────────────────────── */
function Pagination({ page, totalPages, onPageChange, className = "" }) {
  if (totalPages <= 1) return null;
  const go = (p) => onPageChange(Math.min(Math.max(1, p), totalPages));
  const nums = (() => {
    const set = new Set([1, totalPages, page - 1, page, page + 1]);
    const arr = [...set].filter(n => n >= 1 && n <= totalPages).sort((a, b) => a - b);
    const out = [];
    for (let i = 0; i < arr.length; i++) {
      out.push(arr[i]);
      if (i < arr.length - 1 && arr[i + 1] - arr[i] > 1) out.push("…");
    }
    return out;
  })();
  return (
    <div className={`flex items-center justify-between gap-2 flex-wrap ${className}`}>
      <p className="text-xs text-slate-500">
        Página <strong>{page}</strong> de <strong>{totalPages}</strong>
      </p>
      <div className="flex items-center gap-1.5">
        <Button type="button" variant="outline" size="sm" className="rounded-xl h-8 w-8 p-0"
          onClick={() => go(page - 1)} disabled={page <= 1}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {nums.map((n, idx) =>
          n === "…" ? (
            <span key={`dots-${idx}`} className="px-1 text-sm text-slate-400">…</span>
          ) : (
            <Button key={n} type="button" size="sm"
              variant={n === page ? "default" : "outline"}
              className={`rounded-xl h-8 min-w-[2rem] p-0 text-xs ${n === page ? "bg-blue-600 hover:bg-blue-700" : ""}`}
              onClick={() => go(n)}>{n}</Button>
          )
        )}
        <Button type="button" variant="outline" size="sm" className="rounded-xl h-8 w-8 p-0"
          onClick={() => go(page + 1)} disabled={page >= totalPages}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/* ─── Progress Overlay ───────────────────────────────────────── */
function ProgressOverlay({ open, progress, title = "Procesando...", subtitle, onCancel, disableCancelAfter = 50 }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl p-6 space-y-5">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-100 grid place-items-center shrink-0">
            <Loader2 size={20} className="animate-spin text-blue-600" />
          </div>
          <div>
            <p className="font-extrabold text-slate-900 text-sm leading-tight">{title}</p>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        <div className="space-y-1.5">
          <Progress value={progress} className="h-2.5 rounded-full" />
          <p className="text-xs text-center text-slate-500 tabular-nums">{Math.round(progress)}% completado</p>
        </div>
        <Button variant="outline" onClick={onCancel} className="w-full rounded-xl font-semibold"
          disabled={progress > disableCancelAfter}>
          Cancelar (puede fallar)
        </Button>
      </div>
    </div>
  );
}

/* ─── Attendance status config ───────────────────────────────── */
const ATT_STATUS = {
  PRESENT: { label: "Presente", emoji: "✅", cls: "!bg-emerald-600 !text-white !border-emerald-700" },
  ABSENT: { label: "Ausente", emoji: "❌", cls: "!bg-red-600 !text-white !border-red-700" },
  LATE: { label: "Tardanza", emoji: "⏰", cls: "!bg-amber-500 !text-white !border-amber-600" },
  EXCUSED: { label: "Justificado", emoji: "📄", cls: "!bg-blue-500 !text-white !border-blue-600" },
};

/* ─── Grade badge ────────────────────────────────────────────── */
const GradeBadge = ({ estado }) => {
  if (!estado) return <span className="text-slate-400 text-xs">—</span>;
  const ok = estado === "Logrado";
  return (
    <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${ok ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
      }`}>
      {ok && <Check size={9} className="mr-1" />}{estado}
    </span>
  );
};

/* ─── Session Badge ──────────────────────────────────────────── */
const SessionBadge = ({ closed }) => (
  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${closed ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"
    }`}>
    {closed ? <Lock size={9} /> : <CheckCircle2 size={9} />}
    {closed ? "Cerrada" : "Abierta"}
  </span>
);

/* ─── Password strength bar ──────────────────────────────────── */
const pwdStrength = (pwd) =>
  (pwd?.length >= 8 ? 1 : 0) +
  (/[A-Z]/.test(pwd || "") ? 1 : 0) +
  (/[0-9]/.test(pwd || "") ? 1 : 0) +
  (/[^a-zA-Z0-9]/.test(pwd || "") ? 1 : 0);

const STRENGTH_CLS = ["bg-slate-200", "bg-red-500", "bg-orange-400", "bg-yellow-400", "bg-emerald-500"];

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
export default function GradesAttendanceComponent() {
  const { user, refreshMe } = useContext(AuthContext);

  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState(null);
  const [students, setStudents] = useState([]);
  const [grades, setGrades] = useState({});
  const [attendanceSessions, setAttendanceSessions] = useState([]);
  const [activeTab, setActiveTab] = useState("grades");
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // CSV import
  const [importDialog, setImportDialog] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [importPreview, setImportPreview] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [isImportingAttendance, setIsImportingAttendance] = useState(false);
  const [attendanceImportProgress, setAttendanceImportProgress] = useState(0);

  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [currentSession, setCurrentSession] = useState(null);
  const [sessionRows, setSessionRows] = useState([]);

  // Pagination
  const [gradesPage, setGradesPage] = useState(1);
  const [sessionsPage, setSessionsPage] = useState(1);
  const [takeAttPage, setTakeAttPage] = useState(1);
  const gradesPageSize = 8;
  const sessionsPageSize = 10;
  const takeAttendancePageSize = 10;

  // Roles
  const roles = user?.roles || [];
  const isTeacherRole =
    roles.some(r => String(r).toUpperCase().includes("TEACHER")) ||
    String(user?.role || "").toUpperCase().includes("TEACHER");
  const mustChangePassword = isTeacherRole && !!user?.must_change_password;
  const canImportMasterData = !!user?.is_staff || isTeacherRole;

  // Bulk import
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [bulkType, setBulkType] = useState("students");
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkJobId, setBulkJobId] = useState(null);
  const [bulkStatus, setBulkStatus] = useState(null);
  const [isImportingBulk, setIsImportingBulk] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkPollTimer, setBulkPollTimer] = useState(null);

  useEffect(() => () => { if (bulkPollTimer) clearInterval(bulkPollTimer); }, [bulkPollTimer]);

  // Password change
  const [pwd, setPwd] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [pwdSaving, setPwdSaving] = useState(false);

  const showToast = (type, message) => {
    const el = document.createElement("div");
    el.setAttribute("data-testid", `toast-${type}`);
    el.textContent = message;
    document.body.appendChild(el);
    toast[type](message);
    setTimeout(() => { if (document.body.contains(el)) document.body.removeChild(el); }, 5000);
  };

  /* ── Grade calculations ── */
  const LEVELS = ["PI", "I", "P", "L", "D"];
  const LEVEL_TO_NUM = { PI: 1, I: 2, P: 3, L: 4, D: 5 };

  const calcEscala05 = useCallback((sg) => {
    const vals = [Number(sg?.C1), Number(sg?.C2), Number(sg?.C3)].filter(n => !Number.isNaN(n) && n >= 1 && n <= 5);
    if (vals.length !== 3) return "";
    return Math.round(vals.reduce((a, b) => a + b, 0) / 3 * 10) / 10;
  }, []);

  const calcPromFinal20 = useCallback((sg) => {
    const e = calcEscala05(sg);
    if (e === "") return "";
    return Math.round(((Number(e) - 1) / 4) * 20);
  }, [calcEscala05]);

  const calcEstado = useCallback((sg) => {
    const pf = calcPromFinal20(sg);
    if (pf === "") return "";
    return Number(pf) >= 11 ? "Logrado" : "En proceso";
  }, [calcPromFinal20]);

  /* ── Effects ── */
  useEffect(() => { if (user?.id) fetchTeacherSections(); }, [user?.id]);

  useEffect(() => {
    if (!selectedSection?.id) return;
    fetchSectionStudents(); fetchGrades(); fetchAttendanceSessions();
    setGradesPage(1); setSessionsPage(1); setTakeAttPage(1);
  }, [selectedSection?.id]);

  useEffect(() => { setGradesPage(1); setSessionsPage(1); setTakeAttPage(1); }, [activeTab]);

  /* ── Fetch functions ── */
  const fetchTeacherSections = async () => {
    try {
      const data = await Teacher.sectionsMe();
      const secs = data?.sections || [];
      setSections(secs);
      setSelectedSection(prev => {
        if (!prev?.id) return prev;
        return secs.find(s => String(s.id) === String(prev.id)) || null;
      });
    } catch (e) { showToast("error", e.message || "Error al cargar secciones"); setSections([]); }
  };

  const fetchSectionStudents = async () => {
    try {
      const { students } = await SectionStudents.list(selectedSection.id);
      setStudents(students || []);
    } catch (e) { showToast("error", e.message || "Error al cargar estudiantes"); }
  };

  const fetchGrades = async () => {
    try {
      const data = await Grades.get(selectedSection.id);
      setGrades(data?.grades || {});
    } catch (e) { showToast("error", e.message || "Error al cargar calificaciones"); }
  };

  const fetchAttendanceSessions = async () => {
    try {
      const d = await Attendance.listSessions(selectedSection.id);
      setAttendanceSessions(d?.sessions || []);
    } catch (e) { showToast("error", e.message || "Error al cargar sesiones"); }
  };

  /* ── Attendance ── */
  const createAttendanceSession = async () => {
    try {
      const r = await Attendance.createSession(selectedSection.id, { date: sessionDate });
      const ses = r?.session || r;
      setCurrentSession(ses);
      setSessionRows(students.map(s => ({ student_id: s.id, status: "PRESENT" })));
      setTakeAttPage(1);
      await fetchAttendanceSessions();
      showToast("success", "Sesión creada");
    } catch (e) { showToast("error", e.message || "No se pudo crear la sesión"); }
  };

  const setRowStatus = (studentId, status) =>
    setSessionRows(prev => prev.map(r => r.student_id === studentId ? { ...r, status } : r));

  const saveAttendance = async () => {
    if (!currentSession) return;
    try { await Attendance.set(selectedSection.id, currentSession.id, sessionRows); showToast("success", "Asistencia guardada"); }
    catch (e) { showToast("error", e.message || "Error al guardar asistencia"); }
  };

  const closeAttendance = async () => {
    if (!currentSession) return;
    try {
      await Attendance.set(selectedSection.id, currentSession.id, sessionRows);
      await Attendance.closeSession(selectedSection.id, currentSession.id);
      setCurrentSession(null); setSessionRows([]);
      await fetchAttendanceSessions();
      showToast("success", "Sesión cerrada");
    } catch (e) { showToast("error", e.message || "Error al cerrar sesión"); }
  };

  /* ── Grades CRUD ── */
  const updateGrade = (studentId, field, value) => {
    setGrades(prev => {
      const current = prev[studentId] || {};
      const next = { ...current, [field]: value ?? "" };
      if (field === "C1_LEVEL") next.C1 = LEVEL_TO_NUM[value] ?? next.C1 ?? "";
      if (field === "C2_LEVEL") next.C2 = LEVEL_TO_NUM[value] ?? next.C2 ?? "";
      if (field === "C3_LEVEL") next.C3 = LEVEL_TO_NUM[value] ?? next.C3 ?? "";
      if (["C1", "C2", "C3"].includes(field)) {
        if (value === "") return { ...prev, [studentId]: { ...next, [field]: "" } };
        const n = Number(value);
        if (Number.isNaN(n) || n < 1 || n > 5) return prev;
        next[field] = n;
      }
      return { ...prev, [studentId]: next };
    });
  };

  const saveGrades = async () => {
    if (!selectedSection) return showToast("error", "Seleccione una sección");
    setIsSaving(true);
    try { await Grades.save(selectedSection.id, grades); showToast("success", "Acta guardada"); }
    catch (e) { showToast("error", e.message || "Error al guardar acta"); }
    finally { setIsSaving(false); }
  };

  const submitGrades = async () => {
    if (!selectedSection) return showToast("error", "Seleccione una sección");
    const req = ["C1_LEVEL", "C2_LEVEL", "C3_LEVEL", "C1", "C2", "C3"];
    if (students.some(st => req.some(f => (grades[st.id] || {})[f] === undefined || (grades[st.id] || {})[f] === null || (grades[st.id] || {})[f] === "")))
      return showToast("error", "Complete niveles PI/I/P/L/D y C1-C3 (1..5) antes de enviar");
    setIsSubmitting(true);
    try { await Grades.submit(selectedSection.id, grades); showToast("success", "Acta enviada y cerrada"); await generateActaPDF(); }
    catch (e) { showToast("error", e.message || "Error al enviar acta"); }
    finally { setIsSubmitting(false); }
  };

  const reopenGrades = async () => {
    if (!selectedSection) return showToast("error", "Seleccione una sección");
    setIsSubmitting(true);
    try { await Grades.reopen(selectedSection.id); showToast("success", "Acta reabierta"); await fetchGrades(); }
    catch (e) { showToast("error", e.message || "Error al reabrir acta"); }
    finally { setIsSubmitting(false); }
  };

  const generateActaPDF = async () => {
    if (!selectedSection?.id) return;
    try {
      const result = await generatePDFWithPolling(`/sections/${selectedSection.id}/acta`, {}, { testId: "acta-pdf" });
      if (result.success) {
        await downloadFile(result.downloadUrl, `acta-${selectedSection.course_code || "CURSO"}-${selectedSection.id}.pdf`);
        showToast("success", "Acta PDF generada"); await generateActaQR();
      }
    } catch { showToast("error", "Error al generar acta PDF"); }
  };

  const generateActaQR = async () => {
    if (!selectedSection?.id) return;
    try {
      const result = await generateQRWithPolling(`/sections/${selectedSection.id}/acta/qr`, {}, { testId: "acta-qr-code" });
      if (result.success) showToast("success", "Código QR generado");
    } catch { showToast("error", "Error al generar código QR"); }
  };

  /* ── CSV import ── */
  const importAttendanceCSV = async () => {
    if (!selectedSection?.id) return showToast("error", "Seleccione una sección");
    if (!csvFile) return showToast("error", "Seleccione un archivo CSV");
    setIsImportingAttendance(true); setAttendanceImportProgress(0);
    try {
      const result = await AttendanceImport.preview(selectedSection.id, csvFile);
      setImportPreview(result.preview || []); setImportErrors(result.errors || []);
      if (result.errors?.length) showToast("error", `${result.errors.length} errores en el archivo`);
      else { showToast("success", "Vista previa generada"); setAttendanceImportProgress(70); }
    } catch (e) { showToast("error", e.message || "Error al importar asistencia"); }
    finally { setIsImportingAttendance(false); setAttendanceImportProgress(100); }
  };

  const saveAttendanceImport = async () => {
    if (!selectedSection?.id) return showToast("error", "Seleccione una sección");
    if (importErrors.length > 0) return showToast("error", "Corrija los errores antes de guardar");
    setIsImportingAttendance(true); setAttendanceImportProgress(10);
    try {
      await AttendanceImport.save(selectedSection.id, importPreview);
      showToast("success", "Asistencia importada correctamente");
      setImportDialog(false); setImportPreview([]); setImportErrors([]); setCsvFile(null);
      setAttendanceImportProgress(100); await fetchAttendanceSessions();
    } catch (e) { showToast("error", e.message || "Error al guardar asistencia"); }
    finally { setTimeout(() => { setIsImportingAttendance(false); setAttendanceImportProgress(0); }, 1000); }
  };

  /* ── Bulk import ── */
  const downloadBulkTemplate = async () => {
    try {
      const res = await Imports.downloadTemplate(bulkType);
      const cd = res?.headers?.["content-disposition"] || "";
      const match = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(cd);
      const filename = match?.[1]?.replace(/['"]/g, "").trim() || `${bulkType}_template.xlsx`;
      const contentType = res?.headers?.["content-type"] || "application/octet-stream";
      const blob = res?.data instanceof Blob ? res.data : new Blob([res.data], { type: contentType });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
      toast.success("Plantilla descargada");
    } catch (e) { toast.error(e?.response?.data?.detail || e?.message || "No se pudo descargar la plantilla"); }
  };

  const stopBulkPolling = () => {
    if (bulkPollTimer) clearInterval(bulkPollTimer);
    setBulkPollTimer(null); setIsImportingBulk(false); setBulkProgress(0);
    toast.info("Seguimiento detenido");
  };

  const startBulkImport = async () => {
    if (!bulkFile) return toast.error("Selecciona un archivo primero");
    try {
      setIsImportingBulk(true); setBulkProgress(5); setBulkStatus(null); setBulkJobId(null);
      const startRes = await Imports.start(bulkType, bulkFile);
      const payload = startRes?.data || startRes;
      const jobId = payload?.job_id || payload?.id || payload?.task_id;
      if (!jobId) throw new Error("No se recibió job_id del backend");
      setBulkJobId(jobId); toast.success("Importación iniciada"); setBulkProgress(10);
      if (bulkPollTimer) clearInterval(bulkPollTimer);
      const timer = setInterval(async () => {
        try {
          const stRes = await Imports.status(jobId);
          const st = stRes?.data || stRes; setBulkStatus(st);
          const p = Number(st?.progress ?? 0);
          if (!Number.isNaN(p)) setBulkProgress(Math.min(99, Math.max(10, p)));
          const state = String(st?.state || "").toUpperCase();
          if (["COMPLETED", "FAILED", "ERROR"].includes(state)) {
            clearInterval(timer); setBulkPollTimer(null); setIsImportingBulk(false); setBulkProgress(100);
            if (state === "COMPLETED") toast.success("Importación completada ✅");
            else toast.error("La importación terminó con error");
            if (bulkType === "students") await fetchSectionStudents();
            if (bulkType === "grades") await fetchGrades();
          }
        } catch { /* keep polling */ }
      }, 1800);
      setBulkPollTimer(timer);
    } catch (e) {
      setIsImportingBulk(false); setBulkProgress(0);
      toast.error(e?.response?.data?.detail || e?.message || "No se pudo iniciar la importación");
    }
  };

  const onChangeTempPassword = async (e) => {
    e.preventDefault();
    if (pwdSaving) return;
    const cur = String(pwd.current_password || "").trim();
    const np = String(pwd.new_password || "").trim();
    const cp = String(pwd.confirm_password || "").trim();
    if (!cur || !np || !cp) return toast.error("Completa todos los campos.");
    if (np !== cp) return toast.error("La confirmación no coincide.");
    if (np.length < 8) return toast.error("La nueva contraseña debe tener al menos 8 caracteres.");
    try {
      setPwdSaving(true);
      await UsersService.changeMyPassword({ current_password: cur, new_password: np });
      if (refreshMe) await refreshMe();
      setPwd({ current_password: "", new_password: "", confirm_password: "" });
      toast.success("Contraseña actualizada. Ya puedes continuar.");
    } catch (err) { toast.error(err?.response?.data?.detail || "No se pudo actualizar la contraseña"); }
    finally { setPwdSaving(false); }
  };

  /* ── Pagination derived data ── */
  const gradesTotalPages = Math.max(1, Math.ceil(students.length / gradesPageSize));
  const sessionsTotalPages = Math.max(1, Math.ceil(attendanceSessions.length / sessionsPageSize));
  const takeAttTotalPages = Math.max(1, Math.ceil(students.length / takeAttendancePageSize));

  const pagedStudentsForGrades = useMemo(() => students.slice((gradesPage - 1) * gradesPageSize, gradesPage * gradesPageSize), [students, gradesPage]);
  const pagedSessions = useMemo(() => attendanceSessions.slice((sessionsPage - 1) * sessionsPageSize, sessionsPage * sessionsPageSize), [attendanceSessions, sessionsPage]);
  const pagedStudentsForAttendance = useMemo(() => students.slice((takeAttPage - 1) * takeAttendancePageSize, takeAttPage * takeAttendancePageSize), [students, takeAttPage]);

  useEffect(() => { if (gradesPage > gradesTotalPages) setGradesPage(gradesTotalPages); }, [gradesTotalPages, gradesPage]);
  useEffect(() => { if (sessionsPage > sessionsTotalPages) setSessionsPage(sessionsTotalPages); }, [sessionsTotalPages, sessionsPage]);
  useEffect(() => { if (takeAttPage > takeAttTotalPages) setTakeAttPage(takeAttTotalPages); }, [takeAttTotalPages, takeAttPage]);

  /* ════════════════════════════════════════════
     PASSWORD CHANGE SCREEN
  ════════════════════════════════════════════ */
  if (mustChangePassword) {
    const strength = pwdStrength(pwd.new_password);
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="rounded-2xl border border-red-200 bg-white overflow-hidden shadow-sm">
          {/* Top accent */}
          <div className="h-1.5 bg-gradient-to-r from-red-500 to-rose-400" />
          {/* Header */}
          <div className="flex items-start gap-4 px-6 pt-6 pb-4">
            <div className="h-12 w-12 rounded-2xl bg-red-50 border border-red-200 grid place-items-center shrink-0">
              <ShieldAlert size={22} className="text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-red-900 leading-tight">Acción Requerida: Seguridad de cuenta</h2>
              <p className="text-sm text-red-700/70 mt-1 leading-relaxed">
                Estás usando una credencial temporal. Establece una contraseña nueva ahora mismo.
              </p>
            </div>
          </div>

          <div className="px-6 pb-6">
            <form onSubmit={onChangeTempPassword} className="space-y-5">
              {/* Current password */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-red-800/70">Contraseña temporal</Label>
                <div className="relative">
                  {!pwd.current_password && <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-red-400 pointer-events-none" />}
                  <Input type="password"
                    className={`rounded-xl border-red-200 focus-visible:ring-red-300 ${!pwd.current_password ? "pl-10" : ""}`}
                    value={pwd.current_password}
                    onChange={e => setPwd(s => ({ ...s, current_password: e.target.value }))}
                    disabled={pwdSaving} required />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-5">
                {/* New password + strength */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-red-800/70">Nueva contraseña</Label>
                  <div className="relative">
                    {!pwd.new_password && <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-red-400 pointer-events-none" />}
                    <Input type="password"
                      className={`rounded-xl border-red-200 focus-visible:ring-red-300 ${!pwd.new_password ? "pl-10" : ""}`}
                      value={pwd.new_password}
                      onChange={e => setPwd(s => ({ ...s, new_password: e.target.value }))}
                      disabled={pwdSaving} required />
                  </div>
                  <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden mt-1">
                    <div className={`h-full transition-all duration-500 ${STRENGTH_CLS[strength]}`}
                      style={{ width: `${strength * 25}%` }} />
                  </div>
                  <p className="text-[10px] text-red-700/50 font-medium">Mínimo 8 caracteres, mayúscula y número.</p>
                </div>

                {/* Confirm password */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-red-800/70">Confirmar contraseña</Label>
                  <div className="relative">
                    {!pwd.confirm_password && <CheckCircle2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-red-400 pointer-events-none" />}
                    <Input type="password"
                      className={`rounded-xl border-red-200 focus-visible:ring-red-300 ${!pwd.confirm_password ? "pl-10" : ""}`}
                      value={pwd.confirm_password}
                      onChange={e => setPwd(s => ({ ...s, confirm_password: e.target.value }))}
                      disabled={pwdSaving} required />
                  </div>
                  {pwd.confirm_password && (
                    <p className={`flex items-center gap-1.5 text-[11px] font-bold mt-1 ${pwd.new_password === pwd.confirm_password ? "text-emerald-600" : "text-red-500"
                      }`}>
                      {pwd.new_password === pwd.confirm_password
                        ? <><Check size={11} /> Las contraseñas coinciden</>
                        : <><X size={11} /> No coinciden</>
                      }
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  className="rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white font-extrabold px-8 gap-2"
                  disabled={pwdSaving}
                >
                  {pwdSaving ? <><Loader2 size={15} className="animate-spin" /> Actualizando…</> : "Actualizar contraseña"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════
     SECTION LABEL
  ════════════════════════════════════════════ */
  const sectionLabel = selectedSection
    ? `${selectedSection.course_name || selectedSection.course_code || "Curso"} — ${selectedSection.section_code || selectedSection.label || `SEC-${selectedSection.id}`}`
    : "";

  /* ════════════════════════════════════════════
     MAIN VIEW
  ════════════════════════════════════════════ */
  return (
    <>
      <div className="space-y-5 pb-24 sm:pb-6">

        {/* ── Page header ── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">Acta, Calificaciones y Asistencia</h2>
            {sectionLabel && <p className="text-sm text-slate-500 mt-0.5">{sectionLabel}</p>}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            {/* Section selector */}
            <Select
              value={selectedSection?.id ? String(selectedSection.id) : ""}
              onValueChange={value => setSelectedSection(sections.find(s => String(s.id) === value) || null)}
            >
              <SelectTrigger className="w-full sm:w-72 rounded-xl h-11">
                <SelectValue placeholder="Seleccionar sección…" />
              </SelectTrigger>
              <SelectContent>
                {sections.map(sec => (
                  <SelectItem key={sec.id} value={String(sec.id)}>
                    {(sec.course_name || sec.course_code || "Curso")} — {(sec.section_code || sec.label || `SEC-${sec.id}`)}
                  </SelectItem>
                ))}
                {sections.length === 0 && <div className="p-3 text-sm text-slate-500">No tienes secciones asignadas</div>}
              </SelectContent>
            </Select>

            {/* Bulk import buttons */}
            {canImportMasterData && (
              <>
                <Button variant="outline" className="rounded-xl h-11 gap-2 font-semibold"
                  onClick={() => { setBulkType("students"); setBulkFile(null); setBulkJobId(null); setBulkStatus(null); setBulkProgress(0); setBulkImportOpen(true); }}>
                  <FileSpreadsheet size={16} /> Importar Alumnos
                </Button>
                <Button variant="outline" className="rounded-xl h-11 gap-2 font-semibold"
                  onClick={() => { setBulkType("grades"); setBulkFile(null); setBulkJobId(null); setBulkStatus(null); setBulkProgress(0); setBulkImportOpen(true); }}>
                  <FileSpreadsheet size={16} /> Importar Notas
                </Button>
              </>
            )}
          </div>
        </div>

        {/* ── Bulk import dialog ── */}
        <Dialog open={bulkImportOpen} onOpenChange={v => { setBulkImportOpen(v); if (!v) { setBulkFile(null); setBulkJobId(null); setBulkStatus(null); } }}>
          <DialogContent className="max-w-lg rounded-2xl">
            <DialogHeader>
              <DialogTitle className="font-extrabold">Importar {bulkType === "students" ? "Alumnos" : "Notas"}</DialogTitle>
              <DialogDescription>Sube un archivo <b>.xlsx</b> o <b>.csv</b>. Descarga la plantilla si aún no la tienes.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-1">
              <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Archivo</Label>
                  <Input type="file" accept=".xlsx,.xls,.csv"
                    className="rounded-xl file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:font-semibold file:text-xs file:px-3 file:py-1 cursor-pointer"
                    onChange={e => setBulkFile(e.target.files?.[0] || null)} disabled={isImportingBulk} />
                  {bulkFile && <p className="text-xs text-slate-500">{bulkFile.name} · {(bulkFile.size / 1024 / 1024).toFixed(2)} MB</p>}
                </div>
                <Button type="button" variant="outline" className="rounded-xl gap-2 font-semibold shrink-0"
                  onClick={downloadBulkTemplate} disabled={isImportingBulk}>
                  <FileText size={15} /> Plantilla
                </Button>
              </div>

              {bulkJobId && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2.5">
                  <div className="flex justify-between text-sm">
                    <span className="font-bold text-slate-600">Job ID:</span>
                    <span className="font-mono text-slate-800">{bulkJobId}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-bold text-slate-600">Estado:</span>
                    <span className="font-semibold text-slate-800">{bulkStatus?.state || "RUNNING"}</span>
                  </div>
                  {bulkProgress > 0 && bulkProgress < 100 && (
                    <div className="space-y-1">
                      <Progress value={bulkProgress} className="h-1.5" />
                      <p className="text-[11px] text-slate-500 text-right tabular-nums">{Math.round(bulkProgress)}%</p>
                    </div>
                  )}
                  {Array.isArray(bulkStatus?.errors) && bulkStatus.errors.length > 0 && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-1 text-xs text-red-700">
                      {bulkStatus.errors.slice(0, 6).map((x, i) => <p key={i}>• {x}</p>)}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                {bulkJobId && (
                  <Button variant="outline" className="rounded-xl border-red-200 text-red-700 hover:bg-red-50 font-semibold"
                    onClick={stopBulkPolling}>Detener seguimiento</Button>
                )}
                <Button onClick={startBulkImport} disabled={!bulkFile || isImportingBulk}
                  className="rounded-xl font-extrabold gap-2 bg-blue-600 hover:bg-blue-700">
                  {isImportingBulk
                    ? <><Loader2 size={15} className="animate-spin" /> Procesando…</>
                    : <><Upload size={15} /> Iniciar importación</>
                  }
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── No section selected ── */}
        {!selectedSection && (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white py-16 flex flex-col items-center gap-3 text-center">
            <div className="h-14 w-14 rounded-2xl bg-slate-100 grid place-items-center">
              <BookOpen size={24} className="text-slate-300" />
            </div>
            <p className="text-sm font-bold text-slate-500">Selecciona una sección para comenzar</p>
            <p className="text-xs text-slate-400">Usa el selector de arriba para elegir tu sección.</p>
          </div>
        )}

        {/* ── Tabs ── */}
        {selectedSection && (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="h-11 rounded-xl bg-slate-100 p-1 gap-1 w-full sm:w-auto">
              <TabsTrigger value="grades" className="rounded-lg gap-2 font-semibold data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm">
                <ClipboardList size={15} /> Acta
              </TabsTrigger>
              <TabsTrigger value="attendance" className="rounded-lg gap-2 font-semibold data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm">
                <Users size={15} /> Asistencia
              </TabsTrigger>
            </TabsList>

            {/* ══════════ TAB: ACTA ══════════ */}
            <TabsContent value="grades" className="mt-4">
              <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                {/* Header */}
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50/60 to-white">
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-slate-900 text-base leading-tight flex items-center gap-2">
                      <ClipboardList size={17} className="text-blue-600 shrink-0" /> Acta de Evaluación
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">{sectionLabel}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button data-testid="grade-save" variant="outline"
                      className="rounded-xl font-semibold gap-2 h-10"
                      onClick={saveGrades} disabled={isSaving}>
                      {isSaving ? <><Loader2 size={14} className="animate-spin" /> Guardando…</> : <><Save size={14} /> Guardar Acta</>}
                    </Button>
                    <Button data-testid="grade-submit"
                      className="rounded-xl font-extrabold gap-2 h-10 bg-blue-600 hover:bg-blue-700"
                      onClick={submitGrades} disabled={isSubmitting}>
                      {isSubmitting ? <><Loader2 size={14} className="animate-spin" /> Enviando…</> : <><Send size={14} /> Enviar y Cerrar</>}
                    </Button>
                    {(user?.role === "REGISTRAR" || user?.role === "ADMIN_ACADEMIC") && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button data-testid="grade-reopen" variant="outline" className="rounded-xl font-semibold gap-2 h-10">
                            <Unlock size={14} /> Reabrir Acta
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-2xl">
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Reabrir acta?</AlertDialogTitle>
                            <AlertDialogDescription>Esto desbloquea la sección para editar el acta nuevamente.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={reopenGrades} disabled={isSubmitting} className="rounded-xl">Sí, reabrir</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                    <Button data-testid="act-generate-pdf" variant="outline" className="rounded-xl font-semibold gap-2 h-10"
                      onClick={generateActaPDF}>
                      <FileText size={14} /> Generar PDF
                    </Button>
                  </div>
                </div>

                {/* Table */}
                <div className="p-5 space-y-4">
                  <div className="overflow-x-auto rounded-xl border border-slate-100">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="p-3 text-left font-bold text-slate-600 whitespace-nowrap">Estudiante</th>
                          <th className="p-3 text-center font-bold text-slate-600 whitespace-nowrap">Comp 1 (Nivel)</th>
                          <th className="p-3 text-left font-bold text-slate-600 min-w-[200px]">Recomendación 1</th>
                          <th className="p-3 text-center font-bold text-slate-600 whitespace-nowrap">Comp 2 (Nivel)</th>
                          <th className="p-3 text-left font-bold text-slate-600 min-w-[200px]">Recomendación 2</th>
                          <th className="p-3 text-center font-bold text-slate-600 whitespace-nowrap">Comp 3 (Nivel)</th>
                          <th className="p-3 text-left font-bold text-slate-600 min-w-[200px]">Recomendación 3</th>
                          <th className="p-3 text-center font-bold text-slate-600">C1</th>
                          <th className="p-3 text-center font-bold text-slate-600">C2</th>
                          <th className="p-3 text-center font-bold text-slate-600">C3</th>
                          <th className="p-3 text-center font-bold text-slate-600 whitespace-nowrap">Escala 0–5</th>
                          <th className="p-3 text-center font-bold text-slate-600 whitespace-nowrap">Prom. final</th>
                          <th className="p-3 text-center font-bold text-slate-600">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {pagedStudentsForGrades.map((st, rowIdx) => {
                          const sg = grades[st.id] || {};
                          const escala05 = calcEscala05(sg);
                          const promFinal = calcPromFinal20(sg);
                          const estado = calcEstado(sg);
                          return (
                            <tr key={st.id} className={`hover:bg-blue-50/20 transition-colors ${rowIdx % 2 === 1 ? "bg-slate-50/30" : ""}`}>
                              <td className="p-3 font-semibold text-slate-800 whitespace-nowrap">
                                {st.first_name} {st.last_name}
                              </td>

                              {/* C1 Level + Rec */}
                              <td className="p-2 text-center">
                                <Select value={sg.C1_LEVEL || ""} onValueChange={v => updateGrade(st.id, "C1_LEVEL", v)}>
                                  <SelectTrigger className="w-[72px] h-9 rounded-lg justify-center"><SelectValue placeholder="—" /></SelectTrigger>
                                  <SelectContent>{LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                                </Select>
                              </td>
                              <td className="p-2">
                                <Input className="h-9 rounded-lg text-xs" placeholder="Comentario…"
                                  value={sg.C1_REC || ""} onChange={e => updateGrade(st.id, "C1_REC", e.target.value)} />
                              </td>

                              {/* C2 Level + Rec */}
                              <td className="p-2 text-center">
                                <Select value={sg.C2_LEVEL || ""} onValueChange={v => updateGrade(st.id, "C2_LEVEL", v)}>
                                  <SelectTrigger className="w-[72px] h-9 rounded-lg justify-center"><SelectValue placeholder="—" /></SelectTrigger>
                                  <SelectContent>{LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                                </Select>
                              </td>
                              <td className="p-2">
                                <Input className="h-9 rounded-lg text-xs" placeholder="Comentario…"
                                  value={sg.C2_REC || ""} onChange={e => updateGrade(st.id, "C2_REC", e.target.value)} />
                              </td>

                              {/* C3 Level + Rec */}
                              <td className="p-2 text-center">
                                <Select value={sg.C3_LEVEL || ""} onValueChange={v => updateGrade(st.id, "C3_LEVEL", v)}>
                                  <SelectTrigger className="w-[72px] h-9 rounded-lg justify-center"><SelectValue placeholder="—" /></SelectTrigger>
                                  <SelectContent>{LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                                </Select>
                              </td>
                              <td className="p-2">
                                <Input className="h-9 rounded-lg text-xs" placeholder="Comentario…"
                                  value={sg.C3_REC || ""} onChange={e => updateGrade(st.id, "C3_REC", e.target.value)} />
                              </td>

                              {/* C1 C2 C3 numeric */}
                              {["C1", "C2", "C3"].map(c => (
                                <td key={c} className="p-2 text-center">
                                  <Input type="number" min="1" max="5" step="1"
                                    className="w-14 h-9 text-center rounded-lg font-semibold tabular-nums"
                                    value={sg[c] ?? ""} onChange={e => updateGrade(st.id, c, e.target.value)} />
                                </td>
                              ))}

                              <td className="p-3 text-center font-bold text-slate-700 tabular-nums">
                                {escala05 === "" ? "—" : escala05.toFixed(1)}
                              </td>
                              <td className="p-3 text-center font-black text-slate-900 tabular-nums text-sm">
                                {promFinal === "" ? "—" : promFinal}
                              </td>
                              <td className="p-3 text-center"><GradeBadge estado={estado} /></td>
                            </tr>
                          );
                        })}
                        {students.length === 0 && (
                          <tr>
                            <td colSpan={13} className="py-12 text-center">
                              <div className="flex flex-col items-center gap-2">
                                <div className="h-10 w-10 rounded-2xl bg-slate-100 grid place-items-center">
                                  <Users size={18} className="text-slate-300" />
                                </div>
                                <p className="text-sm text-slate-400 font-medium">Sin estudiantes en esta sección</p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <Pagination page={gradesPage} totalPages={gradesTotalPages} onPageChange={setGradesPage} />

                  {/* Quick new session */}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end pt-2 border-t border-slate-100">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha de sesión</Label>
                      <Input type="date" value={sessionDate} className="h-10 rounded-xl w-48"
                        onChange={e => setSessionDate(e.target.value)} />
                    </div>
                    <Button onClick={createAttendanceSession} variant="outline" className="rounded-xl font-semibold gap-2 h-10">
                      <Calendar size={15} /> Nueva sesión de asistencia
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ══════════ TAB: ASISTENCIA ══════════ */}
            <TabsContent value="attendance" className="mt-4 space-y-5">

              {/* Controls */}
              <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50/60 to-white">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                      <Users size={17} className="text-blue-600" /> Control de Asistencia
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">{sectionLabel}</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex items-end gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha</Label>
                        <Input type="date" value={sessionDate} className="h-10 rounded-xl w-44"
                          onChange={e => setSessionDate(e.target.value)} />
                      </div>
                      <Button onClick={createAttendanceSession} className="rounded-xl font-semibold gap-2 h-10 bg-blue-600 hover:bg-blue-700">
                        <Calendar size={15} /> Nueva sesión
                      </Button>
                    </div>
                    {/* CSV Import */}
                    <Dialog open={importDialog} onOpenChange={setImportDialog}>
                      <DialogTrigger asChild>
                        <Button data-testid="attendance-import" variant="outline" className="rounded-xl font-semibold gap-2 h-10">
                          <Upload size={15} /> Importar CSV
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto rounded-2xl">
                        <DialogHeader>
                          <DialogTitle className="font-extrabold">Importar Asistencia CSV</DialogTitle>
                          <DialogDescription>
                            <strong>¡IMPORTANTE!</strong> No cambie de pestaña durante la importación.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 pt-2">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Archivo CSV</Label>
                            <Input id="csv-file" type="file" accept=".csv"
                              className="rounded-xl file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:font-semibold file:text-xs cursor-pointer"
                              onChange={e => setCsvFile(e.target.files?.[0] || null)} />
                          </div>
                          <Button onClick={importAttendanceCSV} disabled={!csvFile} className="rounded-xl font-semibold gap-2">
                            <FileText size={15} /> Generar Vista Previa
                          </Button>

                          {importErrors.length > 0 && (
                            <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-2">
                              <div className="flex items-center gap-2">
                                <AlertCircle size={15} className="text-red-600 shrink-0" />
                                <p className="font-bold text-red-800 text-sm">{importErrors.length} errores encontrados</p>
                              </div>
                              <div className="max-h-28 overflow-y-auto space-y-1">
                                {importErrors.map((err, i) => <p key={i} className="text-xs text-red-700">• Fila {err.row}: {err.message}</p>)}
                              </div>
                            </div>
                          )}

                          {importPreview.length > 0 && (
                            <div>
                              <p className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                                <CheckCircle2 size={14} className="text-emerald-600" />
                                Vista previa — {importPreview.length} registros
                              </p>
                              <div className="max-h-48 overflow-auto rounded-xl border border-slate-200">
                                <table className="w-full text-sm">
                                  <thead className="bg-slate-50 sticky top-0">
                                    <tr>
                                      <th className="p-3 text-left font-bold text-slate-600">Estudiante</th>
                                      <th className="p-3 text-left font-bold text-slate-600">Fecha</th>
                                      <th className="p-3 text-left font-bold text-slate-600">Estado</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-50">
                                    {importPreview.slice(0, 8).map((rec, i) => (
                                      <tr key={i} className="hover:bg-slate-50">
                                        <td className="p-3">{rec.student_name}</td>
                                        <td className="p-3 font-mono text-xs">{rec.date}</td>
                                        <td className="p-3">
                                          <SessionBadge closed={rec.status === "CLOSED"} />
                                        </td>
                                      </tr>
                                    ))}
                                    {importPreview.length > 8 && (
                                      <tr><td colSpan={3} className="p-3 text-center text-xs text-slate-400">… y {importPreview.length - 8} registros más</td></tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                            <Button data-testid="dialog-cancel" variant="outline" className="rounded-xl font-semibold"
                              onClick={() => { setImportDialog(false); setCsvFile(null); setImportPreview([]); setImportErrors([]); }}>
                              Cancelar
                            </Button>
                            <Button data-testid="attendance-save"
                              onClick={saveAttendanceImport}
                              disabled={importPreview.length === 0 || importErrors.length > 0 || isImportingAttendance}
                              className="rounded-xl font-extrabold gap-2 bg-emerald-600 hover:bg-emerald-700">
                              {isImportingAttendance
                                ? <><Loader2 size={14} className="animate-spin" /> Importando…</>
                                : <><Save size={14} /> Guardar Asistencia</>
                              }
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>

                {/* Sessions list */}
                <div className="p-5 space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-6 w-6 rounded-lg bg-slate-100 grid place-items-center">
                      <Clock size={12} className="text-slate-500" />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                      Sesiones registradas ({attendanceSessions.length})
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-100 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="p-3 text-left font-bold text-slate-600">Fecha</th>
                          <th className="p-3 text-left font-bold text-slate-600">Estado</th>
                          <th className="p-3 text-right font-bold text-slate-600">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {pagedSessions.map(s => (
                          <tr key={s.id} className="hover:bg-blue-50/20 transition-colors">
                            <td className="p-3 font-semibold text-slate-800 font-mono">{s.date}</td>
                            <td className="p-3"><SessionBadge closed={s.is_closed} /></td>
                            <td className="p-3 text-right">
                              <Button size="sm" variant="outline" className="rounded-xl h-8 text-xs font-semibold"
                                disabled={Boolean(s?.is_closed)}
                                onClick={() => {
                                  setCurrentSession(s);
                                  const rowsFromApi = Array.isArray(s?.rows) ? s.rows.map(r => ({
                                    student_id: Number(r.student_id ?? r.student ?? r.studentId),
                                    status: String(r.status || "PRESENT").toUpperCase(),
                                  })) : [];
                                  const byId = new Map(rowsFromApi.map(r => [String(r.student_id), r]));
                                  setSessionRows(students.map(st => ({ student_id: st.id, status: byId.get(String(st.id))?.status || "PRESENT" })));
                                  setTakeAttPage(1);
                                }}>
                                {s.is_closed ? "Cerrada" : "Abrir"}
                              </Button>
                            </td>
                          </tr>
                        ))}
                        {attendanceSessions.length === 0 && (
                          <tr><td colSpan={3} className="py-10 text-center">
                            <div className="flex flex-col items-center gap-2">
                              <div className="h-10 w-10 rounded-2xl bg-slate-100 grid place-items-center">
                                <Calendar size={18} className="text-slate-300" />
                              </div>
                              <p className="text-sm text-slate-400 font-medium">Sin sesiones registradas</p>
                            </div>
                          </td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <Pagination page={sessionsPage} totalPages={sessionsTotalPages} onPageChange={setSessionsPage} />
                </div>
              </div>

              {/* ── Active session ── */}
              {currentSession ? (
                <div className="rounded-2xl border-2 border-blue-200 bg-white shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-blue-100 bg-blue-50/40">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-blue-100 border border-blue-200 grid place-items-center">
                        <CheckCircle2 size={15} className="text-blue-600" />
                      </div>
                      <div>
                        <p className="font-extrabold text-blue-900 text-sm">Tomando asistencia</p>
                        <p className="text-xs text-blue-500 font-mono mt-0.5">{currentSession.date}</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="rounded-xl font-semibold gap-1.5 h-8"
                      onClick={() => { setCurrentSession(null); setSessionRows([]); }}>
                      <X size={13} /> Cerrar
                    </Button>
                  </div>

                  <div className="p-5 space-y-4">
                    <div className="rounded-xl border border-slate-100 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-blue-50/60 border-b border-blue-100">
                            <th className="p-3 text-left font-bold text-slate-700">Estudiante</th>
                            <th className="p-3 text-left font-bold text-slate-700 w-52">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {pagedStudentsForAttendance.map(st => {
                            const row = sessionRows.find(r => r.student_id === st.id) || { status: "PRESENT" };
                            return (
                              <tr key={st.id} className="hover:bg-blue-50/20 transition-colors">
                                <td className="p-3 font-semibold text-slate-800">{st.first_name} {st.last_name}</td>
                                <td className="p-3">
                                  <Select value={row.status} onValueChange={v => setRowStatus(st.id, v)}>
                                    <SelectTrigger className={`w-44 h-9 rounded-xl font-semibold transition-all ${ATT_STATUS[row.status]?.cls || ""}`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="PRESENT">✅ Presente</SelectItem>
                                      <SelectItem value="ABSENT">❌ Ausente</SelectItem>
                                      <SelectItem value="LATE">⏰ Tardanza</SelectItem>
                                      <SelectItem value="EXCUSED">📄 Justificado</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <Pagination page={takeAttPage} totalPages={takeAttTotalPages} onPageChange={setTakeAttPage} />

                    <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-100">
                      <Button variant="outline" onClick={saveAttendance} className="flex-1 sm:flex-none rounded-xl font-semibold gap-2">
                        <Save size={15} /> Guardar temporal
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button className="flex-1 sm:flex-none rounded-xl font-extrabold gap-2 bg-rose-600 hover:bg-rose-700">
                            <Lock size={15} /> Cerrar sesión definitivamente
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-2xl">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Confirmar cierre</AlertDialogTitle>
                            <AlertDialogDescription>Se guardará permanentemente y no podrás editarla después.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={closeAttendance} className="rounded-xl bg-rose-600 hover:bg-rose-700">Sí, cerrar</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              ) : (
                /* No active session */
                <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white py-14 flex flex-col items-center gap-3 text-center">
                  <div className="h-14 w-14 rounded-2xl bg-slate-100 grid place-items-center">
                    <Users size={24} className="text-slate-300" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-500">No hay sesión activa</p>
                    <p className="text-xs text-slate-400 mt-0.5 max-w-xs mx-auto">
                      Crea una nueva sesión de asistencia o abre una existente para editarla.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" className="rounded-xl font-semibold gap-2"
                    onClick={createAttendanceSession}>
                    <Calendar size={15} /> Crear sesión para {sessionDate}
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Hidden test elements */}
        <div style={{ display: "none" }}>
          <div data-testid="acta-pdf-status">IDLE</div>
          <div data-testid="acta-qr-status">IDLE</div>
          <img data-testid="acta-qr-code" data-status="idle" alt="QR Code" />
        </div>
      </div>

      {/* ── Overlays ── */}
      <ProgressOverlay
        open={isImportingAttendance}
        progress={attendanceImportProgress}
        title="Importando asistencia…"
        subtitle="No cambies de pestaña hasta que termine el proceso"
        onCancel={() => { setIsImportingAttendance(false); setAttendanceImportProgress(0); }}
      />
      <ProgressOverlay
        open={isImportingBulk}
        progress={bulkProgress}
        title={`Importando ${bulkType === "students" ? "alumnos" : "notas"}…`}
        subtitle="Esto puede tardar; no cierres esta ventana."
        onCancel={stopBulkPolling}
        disableCancelAfter={70}
      />
    </>
  );
}