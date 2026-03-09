// src/modules/admission/CompleteAdmissionModule.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../lib/api";

/* UI */
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { toast } from "sonner";
import {
  Plus, Eye, Edit, Download, Calendar, GraduationCap, X,
  Trash2, Search, Users, FileSpreadsheet, User, Loader2,
  BookOpen, CheckCircle2, AlertCircle, Award, Layers,
} from "lucide-react";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
  AlertDialogCancel, AlertDialogAction,
} from "../../components/ui/alert-dialog";

/* Submódulos */
import AdmissionDashboard from "./AdmissionDashboard";
import AdmissionReportsModule from "./AdmissionReports";
import AdmissionParamsModule from "./AdmissionParams";
import ApplicationWizard from "./ApplicationWizard";
import EvaluationBoard from "./EvaluationBoard";
import ResultsPublication from "./ResultsPublication";
import AdmissionCallsManagement from "./AdmissionCallsManagement";
import DocumentReview from "./DocumentReview";
import AdmissionScheduleModule from "./AdmissionSchedule";
import PaymentsManagement from "./PaymentsManagement";
import AdmissionCertificates from "./AdmissionCertificates";
import ApplicantsManagement from "./ApplicantsManagement"; // ← FIX: ahora viene de archivo separado

/* ─── Helpers ────────────────────────────────────────────── */
function formatApiError(err, fallback = "Ocurrió un error") {
  const data = err?.response?.data;
  if (data?.detail) {
    const d = data.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) {
      const msgs = d.map(e => {
        const field = Array.isArray(e?.loc) ? e.loc.join(".") : e?.loc;
        return e?.msg ? (field ? `${field}: ${e.msg}` : e.msg) : null;
      }).filter(Boolean);
      if (msgs.length) return msgs.join(" | ");
    }
  }
  if (typeof data?.error?.message === "string") return data.error.message;
  if (typeof data?.message === "string") return data.message;
  if (typeof data?.error === "string") return data.error;
  if (typeof err?.message === "string") return err.message;
  return fallback;
}
const toIntOr = (v, def = null) => (Number.isFinite(+v) ? +v : def);

/* ─── Shared small components ────────────────────────────── */
const SectionHead = ({ label, color = "blue", icon: Icon }) => {
  const colorMap = {
    blue: "bg-blue-50 border-blue-100 text-blue-600",
    emerald: "bg-emerald-50 border-emerald-100 text-emerald-600",
    orange: "bg-orange-50 border-orange-100 text-orange-600",
    purple: "bg-purple-50 border-purple-100 text-purple-600",
    amber: "bg-amber-50 border-amber-100 text-amber-600",
    indigo: "bg-indigo-50 border-indigo-100 text-indigo-600",
  };
  return (
    <div className="flex items-center gap-2 mb-3">
      {Icon && (
        <div className={`h-6 w-6 rounded-lg border grid place-items-center shrink-0 ${colorMap[color]}`}>
          <Icon size={12} />
        </div>
      )}
      <p className={`text-[10px] font-extrabold uppercase tracking-widest ${color === "blue" ? "text-blue-700" :
        color === "emerald" ? "text-emerald-700" :
          color === "orange" ? "text-orange-700" :
            color === "purple" ? "text-purple-700" :
              color === "amber" ? "text-amber-700" :
                "text-indigo-700"
        }`}>{label}</p>
      <div className="flex-1 h-px bg-slate-100" />
    </div>
  );
};

const FieldDisplay = ({ label, value, mono, wide }) => (
  <div className={wide ? "sm:col-span-2" : ""}>
    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
    <p className={`text-sm text-slate-800 ${mono ? "font-mono" : "font-semibold"}`}>{value || "—"}</p>
  </div>
);

const FormField = ({ label, error, required, children }) => (
  <div className="space-y-1.5">
    <Label className={`text-[10px] font-bold uppercase tracking-wider ${error ? "text-red-600" : "text-slate-500"}`}>
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </Label>
    {children}
    {error && <p className="flex items-center gap-1 text-xs text-red-600 font-semibold"><AlertCircle size={10} />{error}</p>}
  </div>
);

const LoadingSpinner = () => (
  <div className="flex items-center justify-center py-20">
    <div className="flex flex-col items-center gap-3">
      <div className="h-12 w-12 rounded-2xl bg-blue-50 border border-blue-100 grid place-items-center">
        <Loader2 size={22} className="animate-spin text-blue-500" />
      </div>
      <p className="text-sm text-slate-400 font-medium">Cargando…</p>
    </div>
  </div>
);

/* ─── Career status badge ────────────────────────────────── */
const CareerBadge = ({ active }) => (
  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${active
    ? "bg-blue-50 text-blue-700 border-blue-200"
    : "bg-slate-100 text-slate-500 border-slate-200"
    }`}>
    {active && <CheckCircle2 size={9} />}
    {active ? "Activa" : "Inactiva"}
  </span>
);

/* ═══════════════════════════════════════════════════════════
   CAREERS MANAGEMENT
══════════════════════════════════════════════════════════ */
const CareersManagement = () => {
  const [careers, setCareers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openCreate, setOpenCreate] = useState(false);
  const [form, setForm] = useState({
    name: "", code: "", description: "", duration_semesters: 10,
    degree_type: "BACHELOR", modality: "PRESENCIAL", vacancies: 25, is_active: true,
  });
  const [openView, setOpenView] = useState(false);
  const [viewRow, setViewRow] = useState(null);
  const [openEdit, setOpenEdit] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [editForm, setEditForm] = useState(form);
  const toInt = (v, def = 0) => (Number.isFinite(+v) ? +v : def);

  const load = async () => {
    try {
      const { data } = await api.get("/careers");
      setCareers(Array.isArray(data) ? data : (data?.careers ?? []));
    } catch (e) { toast.error(formatApiError(e, "Error al cargar carreras")); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const resetCreate = () => setForm({ name: "", code: "", description: "", duration_semesters: 10, degree_type: "BACHELOR", modality: "PRESENCIAL", vacancies: 25, is_active: true });

  const submitCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post("/careers", { ...form, duration_semesters: toInt(form.duration_semesters), vacancies: toInt(form.vacancies) });
      toast.success("Carrera creada"); setOpenCreate(false); resetCreate(); load();
    } catch (e) { toast.error(formatApiError(e, "Error al crear carrera")); }
  };

  const openDetails = (row) => { setViewRow(row); setOpenView(true); };

  const openEditor = async (row) => {
    try {
      const { data } = await api.get(`/careers/${row.id}`);
      setEditRow(data);
      setEditForm({ name: data.name ?? "", code: data.code ?? "", description: data.description ?? "", duration_semesters: data.duration_semesters ?? 0, degree_type: data.degree_type ?? "BACHELOR", modality: data.modality ?? "PRESENCIAL", vacancies: data.vacancies ?? 0, is_active: !!data.is_active });
      setOpenEdit(true);
    } catch (e) { toast.error(formatApiError(e, "No se pudo abrir el editor")); }
  };

  const submitEdit = async (e) => {
    e.preventDefault(); if (!editRow) return;
    try {
      await api.put(`/careers/${editRow.id}`, { ...editForm, duration_semesters: toInt(editForm.duration_semesters), vacancies: toInt(editForm.vacancies) });
      toast.success("Carrera actualizada"); setOpenEdit(false); setEditRow(null); load();
    } catch (e) { toast.error(formatApiError(e, "Error al actualizar")); }
  };

  const toggleActive = async (row) => {
    try {
      const { data } = await api.post(`/careers/${row.id}/toggle`);
      setCareers(p => p.map(c => c.id === row.id ? data : c));
      toast.success(`Carrera ${data.is_active ? "activada" : "inactivada"}`);
    } catch (e) { toast.error(formatApiError(e, "No se pudo cambiar el estado")); }
  };

  const removeCareer = async (id) => {
    try { await api.delete(`/careers/${id}`); toast.success("Carrera eliminada"); setCareers(p => p.filter(x => x.id !== id)); }
    catch (e) { toast.error(formatApiError(e, "No se pudo eliminar")); }
  };

  if (loading) return <LoadingSpinner />;

  const selectCls = "h-10 rounded-xl";

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-12">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-blue-50 border border-blue-100 grid place-items-center shrink-0">
              <GraduationCap size={16} className="text-blue-600" />
            </div>
            Carreras Profesionales
          </h2>
          <p className="text-sm text-slate-500 mt-0.5 ml-10">Administra el catálogo académico, códigos y vacantes.</p>
        </div>
        <Button onClick={() => setOpenCreate(true)}
          className="rounded-xl font-extrabold gap-2 bg-blue-600 hover:bg-blue-700 shadow-sm">
          <Plus size={16} /> Nueva Carrera
        </Button>
      </div>

      {/* Create form (inline) */}
      {openCreate && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50/30 overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-blue-100 bg-blue-50/60">
            <div className="h-6 w-6 rounded-lg bg-blue-100 border border-blue-200 grid place-items-center">
              <Plus size={12} className="text-blue-600" />
            </div>
            <p className="font-extrabold text-slate-800 text-sm">Registrar nueva carrera</p>
          </div>
          <div className="p-6">
            <form onSubmit={submitCreate} className="space-y-5">
              <div className="grid sm:grid-cols-12 gap-4">
                <div className="sm:col-span-8">
                  <FormField label="Nombre" required>
                    <Input placeholder="Ej. Educación Inicial" value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      required className="h-10 rounded-xl" />
                  </FormField>
                </div>
                <div className="sm:col-span-4">
                  <FormField label="Código" required>
                    <Input placeholder="Ej. C-001" value={form.code}
                      onChange={e => setForm({ ...form, code: e.target.value })}
                      required className="h-10 rounded-xl font-mono" />
                  </FormField>
                </div>
                <div className="sm:col-span-12">
                  <FormField label="Descripción">
                    <Textarea placeholder="Breve descripción…" value={form.description}
                      onChange={e => setForm({ ...form, description: e.target.value })}
                      className="rounded-xl resize-none min-h-[72px]" />
                  </FormField>
                </div>
                <div className="sm:col-span-3"><FormField label="Duración (Sem)">
                  <Input type="number" min="1" max="20" value={form.duration_semesters}
                    onChange={e => setForm({ ...form, duration_semesters: e.target.value })}
                    className="h-10 rounded-xl" />
                </FormField></div>
                <div className="sm:col-span-3"><FormField label="Vacantes">
                  <Input type="number" min="0" value={form.vacancies}
                    onChange={e => setForm({ ...form, vacancies: e.target.value })}
                    className="h-10 rounded-xl" />
                </FormField></div>
                <div className="sm:col-span-3"><FormField label="Grado">
                  <Select value={form.degree_type} onValueChange={v => setForm({ ...form, degree_type: v })}>
                    <SelectTrigger className={selectCls}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BACHELOR">Bachiller</SelectItem>
                      <SelectItem value="TECHNICAL">Técnico</SelectItem>
                      <SelectItem value="PROFESSIONAL">Profesional</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField></div>
                <div className="sm:col-span-3"><FormField label="Modalidad">
                  <Select value={form.modality} onValueChange={v => setForm({ ...form, modality: v })}>
                    <SelectTrigger className={selectCls}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PRESENCIAL">Presencial</SelectItem>
                      <SelectItem value="VIRTUAL">Virtual</SelectItem>
                      <SelectItem value="SEMIPRESENCIAL">Semipresencial</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField></div>
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-blue-100">
                <Button type="button" variant="outline" className="rounded-xl font-semibold"
                  onClick={() => setOpenCreate(false)}>Cancelar</Button>
                <Button type="submit" className="rounded-xl font-extrabold gap-2 bg-blue-600 hover:bg-blue-700">
                  <Plus size={15} /> Guardar Carrera
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Carrera / Descripción</th>
                <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 w-28">Código</th>
                <th className="px-5 py-3.5 text-center text-[10px] font-bold uppercase tracking-widest text-slate-500 w-28">Duración</th>
                <th className="px-5 py-3.5 text-center text-[10px] font-bold uppercase tracking-widest text-slate-500 w-24">Vacantes</th>
                <th className="px-5 py-3.5 text-center text-[10px] font-bold uppercase tracking-widest text-slate-500 w-28">Estado</th>
                <th className="px-5 py-3.5 text-right text-[10px] font-bold uppercase tracking-widest text-slate-500 w-44">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {careers.map(c => (
                <tr key={c.id} className="group hover:bg-blue-50/20 transition-colors">
                  <td className="px-5 py-4 align-top">
                    <p className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors">{c.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                      {c.description || <span className="italic">Sin descripción</span>}
                    </p>
                  </td>
                  <td className="px-5 py-4 align-top">
                    <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-lg border border-slate-200">{c.code}</span>
                  </td>
                  <td className="px-5 py-4 align-top text-center">
                    <span className="font-bold text-slate-700 tabular-nums">{c.duration_semesters}</span>
                    <span className="text-xs text-slate-400 ml-1">sem.</span>
                  </td>
                  <td className="px-5 py-4 align-top text-center font-bold text-slate-700 tabular-nums">{c.vacancies ?? 0}</td>
                  <td className="px-5 py-4 align-top text-center"><CareerBadge active={c.is_active} /></td>
                  <td className="px-5 py-4 align-top text-right">
                    <div className="flex justify-end items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-blue-50 hover:text-blue-600 text-slate-400"
                        onClick={() => openDetails(c)} title="Ver">
                        <Eye size={15} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-orange-50 hover:text-orange-600 text-slate-400"
                        onClick={() => openEditor(c)} title="Editar">
                        <Edit size={15} />
                      </Button>
                      <button
                        onClick={() => toggleActive(c)}
                        className={`h-8 w-8 rounded-xl grid place-items-center transition-colors ${c.is_active ? "hover:bg-slate-100 text-blue-500" : "hover:bg-blue-50 text-slate-300"
                          }`}
                        title={c.is_active ? "Desactivar" : "Activar"}>
                        <div className={`w-3 h-3 rounded-full border-2 transition-all ${c.is_active ? "bg-blue-500 border-blue-500" : "border-slate-300"}`} />
                      </button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-red-50 hover:text-red-600 text-slate-400" title="Eliminar">
                            <Trash2 size={15} />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-2xl">
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar carrera?</AlertDialogTitle>
                            <AlertDialogDescription>Vas a eliminar <b>{c.name}</b>. Esta acción es permanente.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                            <AlertDialogAction className="rounded-xl bg-red-600 hover:bg-red-700" onClick={() => removeCareer(c.id)}>Sí, eliminar</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                </tr>
              ))}
              {careers.length === 0 && (
                <tr><td colSpan={6} className="py-14 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-12 w-12 rounded-2xl bg-slate-100 grid place-items-center">
                      <GraduationCap size={22} className="text-slate-300" />
                    </div>
                    <p className="text-sm text-slate-400 font-medium">No hay carreras registradas</p>
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── View Dialog ── */}
      <Dialog open={openView} onOpenChange={setOpenView}>
        <DialogContent className="max-w-md rounded-2xl p-0 overflow-hidden border-0 shadow-2xl">
          <div className="bg-gradient-to-r from-[#0f1a3a] via-[#171a55] to-[#251c6c] px-6 py-5 text-white">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/10 grid place-items-center">
                <GraduationCap size={18} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-300 mb-0.5">Detalle de Carrera</p>
                <p className="font-extrabold text-white leading-tight">{viewRow?.name}</p>
              </div>
            </div>
          </div>
          {viewRow && (
            <div className="p-6 space-y-5 bg-white">
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <p className="text-xs text-slate-400 font-semibold mb-1">Descripción</p>
                <p className="text-sm text-slate-700">{viewRow.description || "Sin descripción."}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FieldDisplay label="Código" value={viewRow.code} mono />
                <FieldDisplay label="Estado" value={viewRow.is_active ? "Activa" : "Inactiva"} />
                <FieldDisplay label="Duración" value={`${viewRow.duration_semesters} Semestres`} />
                <FieldDisplay label="Vacantes" value={viewRow.vacancies ?? 0} />
                <FieldDisplay label="Grado" value={viewRow.degree_type} />
                <FieldDisplay label="Modalidad" value={viewRow.modality} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ── */}
      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent className="max-w-2xl rounded-2xl p-0 shadow-2xl">
          <div className="px-6 py-4 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="font-extrabold text-slate-900">Editar Carrera</DialogTitle>
            </DialogHeader>
          </div>
          {editRow && (
            <form onSubmit={submitEdit} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Nombre" required>
                  <Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                    required className="h-10 rounded-xl" />
                </FormField>
                <FormField label="Código" required>
                  <Input value={editForm.code} onChange={e => setEditForm({ ...editForm, code: e.target.value })}
                    required className="h-10 rounded-xl font-mono" />
                </FormField>
              </div>
              <FormField label="Descripción">
                <Textarea value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                  className="rounded-xl resize-none" />
              </FormField>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/60 p-4 rounded-xl border border-slate-100">
                <FormField label="Duración">
                  <Input type="number" min="1" max="20" value={editForm.duration_semesters}
                    onChange={e => setEditForm({ ...editForm, duration_semesters: e.target.value })}
                    className="h-9 rounded-xl text-sm" />
                </FormField>
                <FormField label="Vacantes">
                  <Input type="number" min="0" value={editForm.vacancies}
                    onChange={e => setEditForm({ ...editForm, vacancies: e.target.value })}
                    className="h-9 rounded-xl text-sm" />
                </FormField>
                <FormField label="Grado">
                  <Select value={editForm.degree_type} onValueChange={v => setEditForm({ ...editForm, degree_type: v })}>
                    <SelectTrigger className="h-9 rounded-xl text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BACHELOR">Bachiller</SelectItem>
                      <SelectItem value="TECHNICAL">Técnico</SelectItem>
                      <SelectItem value="PROFESSIONAL">Profesional</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Modalidad">
                  <Select value={editForm.modality} onValueChange={v => setEditForm({ ...editForm, modality: v })}>
                    <SelectTrigger className="h-9 rounded-xl text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PRESENCIAL">Presencial</SelectItem>
                      <SelectItem value="VIRTUAL">Virtual</SelectItem>
                      <SelectItem value="SEMIPRESENCIAL">Semipresencial</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input id="car_is_active" type="checkbox" className="rounded border-slate-300 text-blue-600"
                    checked={!!editForm.is_active} onChange={e => setEditForm({ ...editForm, is_active: e.target.checked })} />
                  <span className="text-sm font-semibold text-slate-700">Carrera Activa</span>
                </label>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="rounded-xl font-semibold"
                    onClick={() => setOpenEdit(false)}>Cancelar</Button>
                  <Button type="submit" className="rounded-xl font-extrabold bg-blue-600 hover:bg-blue-700">Guardar</Button>
                </div>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   MAIN MODULE CONTAINER
══════════════════════════════════════════════════════════ */
const TABS = [
  { val: "dashboard", label: "Dashboard" },
  { val: "careers", label: "Carreras" },
  { val: "calls", label: "Convocatorias" },
  { val: "applicants", label: "Postulantes" },
  { val: "apply", label: "Postulación" },
  { val: "doc-review", label: "Revisión Docs" },
  { val: "eval", label: "Evaluación" },
  { val: "results", label: "Resultados" },
  { val: "schedule", label: "Cronograma" },
  { val: "certificates", label: "Constancias" },
  { val: "reports", label: "Reportes" },
  { val: "payments", label: "Pagos" },
  { val: "params", label: "Configuración" },
];

export default function CompleteAdmissionModule() {
  const { user } = useAuth();
  const { tab } = useParams();
  const navigate = useNavigate();

  const [active, setActive] = useState(tab ?? "dashboard");
  useEffect(() => setActive(tab ?? "dashboard"), [tab]);

  const onTabChange = (v) => {
    setActive(v);
    navigate(`/dashboard/admission/${v}`, { replace: true });
  };

  if (!user) return <div>Acceso no autorizado</div>;

  return (
    <div className="p-4 sm:p-6 box-border flex justify-center print:p-0 print:block">
      <div className="w-full rounded-2xl p-[1px] bg-gradient-to-b from-slate-500/30 to-slate-900/10 flex flex-col md:max-h-[calc(100vh-3rem)] print:p-0 print:bg-none print:max-h-none print:block print:rounded-none">
        <div className="rounded-2xl bg-slate-200/70 backdrop-blur-md border border-white/30 shadow-[0_10px_35px_rgba(0,0,0,0.18)] flex flex-col md:overflow-hidden print:rounded-none print:bg-white print:border-none print:shadow-none print:block print:overflow-visible">

          {/* Module header */}
          <div className="px-6 pt-5 pb-0 flex-none no-print">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-9 w-9 rounded-xl bg-blue-600/10 border border-blue-200/60 grid place-items-center shrink-0">
                <GraduationCap size={18} className="text-blue-700" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-slate-900 leading-tight">Módulo de Admisión</h1>
                <p className="text-xs text-slate-500">Convocatorias, postulantes, evaluación y resultados.</p>
              </div>
            </div>
            <div className="mt-3 h-px w-full bg-white/60" />
          </div>

          {/* Tabs */}
          <Tabs value={active} onValueChange={onTabChange} className="px-4 sm:px-6 pt-4 flex flex-col overflow-hidden h-full print:px-0 print:pt-0 print:overflow-visible">
            <div className="rounded-xl bg-slate-100/80 border border-white/60 px-2 py-2 flex-none mb-4 no-print">
              <TabsList className="w-full bg-transparent p-0 flex flex-wrap gap-1.5 h-auto">
                {TABS.map(item => (
                  <TabsTrigger key={item.val} value={item.val}
                    className="rounded-lg flex-1 whitespace-nowrap text-center min-w-[90px] text-xs font-semibold transition-all duration-200
                                            text-slate-600 hover:bg-slate-200/60 hover:text-slate-900
                                            data-[state=active]:!bg-slate-800 data-[state=active]:!text-white data-[state=active]:!shadow-md">
                    {item.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* Content */}
            <div className="pb-6 pr-1 custom-scrollbar flex-1 md:overflow-y-auto print:pb-0 print:pr-0 print:overflow-visible">
              <TabsContent value="dashboard" className="mt-0"><AdmissionDashboard /></TabsContent>
              <TabsContent value="careers" className="mt-0"><CareersManagement /></TabsContent>
              <TabsContent value="calls" className="mt-0"><AdmissionCallsManagement /></TabsContent>
              <TabsContent value="applicants" className="mt-0"><ApplicantsManagement /></TabsContent>
              <TabsContent value="doc-review" className="mt-0"><DocumentReview /></TabsContent>
              <TabsContent value="apply" className="mt-0"><ApplicationWizard /></TabsContent>
              <TabsContent value="eval" className="mt-0"><EvaluationBoard /></TabsContent>
              <TabsContent value="results" className="mt-0"><ResultsPublication /></TabsContent>
              <TabsContent value="schedule" className="mt-0"><AdmissionScheduleModule /></TabsContent>
              <TabsContent value="payments" className="mt-0"><PaymentsManagement /></TabsContent>
              <TabsContent value="certificates" className="mt-0"><AdmissionCertificates /></TabsContent>
              <TabsContent value="reports" className="mt-0"><AdmissionReportsModule /></TabsContent>
              <TabsContent value="params" className="mt-0"><AdmissionParamsModule /></TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}