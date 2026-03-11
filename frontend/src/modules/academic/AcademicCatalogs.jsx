// AcademicCatalogs.jsx — Periodos, Docentes e Importadores para el módulo académico
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
    Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
    AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
    AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
    AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
    CalendarDays, Users, FileSpreadsheet, Plus, AlertCircle, Save, Trash2,
    Edit3, UserPlus, Mail, Phone, CreditCard, Loader2, UploadCloud, Download,
} from "lucide-react";
import { Periods, Teachers, Imports } from "@/services/catalogs.service";

/* ─── inject styles (reusa clases cfg-*) ─── */
export function InjectCatalogStyles() {
    useEffect(() => {
        const id = "acad-catalog-styles";
        if (document.getElementById(id)) return;
        const s = document.createElement("style");
        s.id = id;
        s.textContent = `
          .cfg-th {
            padding: 10px 16px; font-size: 10px; font-weight: 800; color: #64748B;
            text-transform: uppercase; letter-spacing: .1em;
            background: #F8FAFC; border-bottom: 1px solid #E2E8F0;
          }
          .cfg-td { padding: 11px 16px; font-size: 13px; color: #334155; }
          .cfg-tr { border-bottom: 1px solid #F1F5F9; transition: background .12s; }
          .cfg-tr:hover { background: #F8FAFC; }
          .s-active   { background:#DCFCE7; color:#166534; }
          .s-historic { background:#F1F5F9; color:#64748B; }
          .s-running  { background:#DBEAFE; color:#1D4ED8; }
          .s-done     { background:#DCFCE7; color:#166534; }
          .s-error    { background:#FEE2E2; color:#991B1B; }
          .s-warn     { background:#FEF3C7; color:#92400E; }
          .cfg-empty {
            border: 1.5px dashed #CBD5E1; border-radius: 14px;
            display:flex; flex-direction:column; align-items:center;
            justify-content:center; padding: 40px 24px; text-align:center;
          }
          .cfg-progress-track { background:#E2E8F0; border-radius:999px; overflow:hidden; height:8px; }
          .cfg-progress-bar   { height:100%; background:linear-gradient(90deg,#3B82F6,#6366F1); border-radius:999px; transition:width .6s ease; }
          @keyframes cfg-fade { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:none} }
          .cfg-fade { animation: cfg-fade .25s ease both; }
        `;
        document.head.appendChild(s);
    }, []);
    return null;
}

/* ─── shared micro-components ─── */
const LoadingCenter = ({ text = "Cargando…" }) => (
    <div className="flex flex-col items-center justify-center py-14 gap-3">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        <p className="text-xs font-600 text-slate-400 uppercase tracking-widest">{text}</p>
    </div>
);

const EmptyState = ({ icon: Icon, title, subtitle }) => (
    <div className="cfg-empty">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
            <Icon className="w-6 h-6 text-slate-300" />
        </div>
        <p className="text-sm font-700 text-slate-500 mb-1">{title}</p>
        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
    </div>
);

const SectionCard = ({ icon: Icon, iconColor = "text-blue-600", iconBg = "bg-blue-50", title, desc, action, children }) => (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${iconColor}`} />
                </div>
                <div>
                    <p className="text-sm font-800 text-slate-800">{title}</p>
                    {desc && <p className="text-xs text-slate-400 mt-0.5">{desc}</p>}
                </div>
            </div>
            {action}
        </div>
        <div className="p-5 sm:p-6">{children}</div>
    </div>
);

const Field = ({ label, children, hint }) => (
    <div>
        <Label className="text-[11px] font-700 text-slate-500 uppercase tracking-wider mb-1.5 block">{label}</Label>
        {children}
        {hint && <p className="mt-1 text-[10px] text-slate-400">{hint}</p>}
    </div>
);

const DeleteConfirm = ({ trigger, title, description, onConfirm }) => (
    <AlertDialog>
        <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
        <AlertDialogContent className="max-w-[92vw] sm:max-w-md rounded-2xl">
            <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                    <AlertCircle className="h-5 w-5" />{title}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-slate-600">{description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2 mt-4">
                <AlertDialogCancel className="w-full sm:w-auto rounded-xl border-slate-200">Cancelar</AlertDialogCancel>
                <AlertDialogAction className="w-full sm:w-auto bg-red-600 hover:bg-red-700 rounded-xl" onClick={onConfirm}>
                    Sí, eliminar
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
);

/* ─── helpers ─── */
function formatApiError(err, fallback = "Ocurrió un error") {
    const data = err?.response?.data;
    if (data?.detail) return typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
    if (data && typeof data === "object") {
        const firstKey = Object.keys(data)[0];
        if (firstKey) {
            const val = data[firstKey];
            if (Array.isArray(val)) return `${firstKey}: ${val.join(", ")}`;
            if (typeof val === "string") return `${firstKey}: ${val}`;
        }
    }
    if (typeof data?.message === "string") return data.message;
    if (typeof err?.message === "string") return err.message;
    return fallback;
}

function saveBlobAsFile(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    window.URL.revokeObjectURL(url);
}

function filenameFromContentDisposition(cd, fallback) {
    if (!cd) return fallback;
    const m = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(cd);
    if (!m?.[1]) return fallback;
    return m[1].replace(/['"]/g, "").trim() || fallback;
}

function safeNum(n, fallback = 0) {
    const x = Number(n);
    return Number.isFinite(x) ? x : fallback;
}

function normalizeImportErrors(errors) {
    if (!Array.isArray(errors)) return [];
    return errors.map((e) => {
        if (typeof e === "string") return { row: "-", field: "-", message: e };
        return { row: e?.row ?? "-", field: e?.field ?? "-", message: e?.message ?? JSON.stringify(e) };
    });
}

// ===============================================================
// Periodos Académicos
// ===============================================================
export const PeriodsSection = () => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({ code: "", year: new Date().getFullYear(), term: "I", start_date: "", end_date: "", is_active: false });

    const resetForm = () => { setForm({ code: "", year: new Date().getFullYear(), term: "I", start_date: "", end_date: "", is_active: false }); setEditing(null); };

    const load = useCallback(async () => {
        try { setLoading(true); const data = await Periods.list(); setRows(data?.items ?? data ?? []); }
        catch (e) { toast.error(formatApiError(e)); } finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const save = async () => {
        try {
            if (!form.code?.trim()) return toast.error("Código es requerido");
            if (!form.year) return toast.error("Año es requerido");
            const payload = { ...form, year: parseInt(form.year || "0", 10) };
            if (editing) await Periods.update(editing.id, payload);
            else await Periods.create(payload);
            toast.success(editing ? "Periodo actualizado" : "Periodo creado");
            setOpen(false); resetForm(); load();
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const remove = async (id) => { try { await Periods.remove(id); toast.success("Periodo eliminado"); load(); } catch (e) { toast.error(formatApiError(e)); } };
    const toggleActive = async (r) => { try { await Periods.setActive(r.id, !r.is_active); load(); } catch (e) { toast.error(formatApiError(e)); } };

    return (
        <SectionCard
            icon={CalendarDays} title="Periodos Académicos"
            desc="Ciclos académicos, año, término y fechas de vigencia"
            action={
                <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
                    <DialogTrigger asChild>
                        <Button className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-700 gap-1.5 shadow-sm">
                            <Plus className="w-4 h-4" /> Nuevo periodo
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg rounded-2xl p-0 overflow-hidden">
                        <div className="h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
                        <div className="p-6">
                            <DialogHeader className="mb-5">
                                <DialogTitle className="text-xl font-800 text-slate-800">{editing ? "Editar periodo" : "Nuevo periodo"}</DialogTitle>
                                <DialogDescription className="text-slate-500 text-sm">Código sugerido: Año-Término (ej. 2024-I)</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                                <Field label="Código *">
                                    <Input className="h-9 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-sm font-500" placeholder="Ej: 2024-I"
                                        value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
                                </Field>
                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="Año *">
                                        <Input type="number" className="h-9 rounded-xl border-slate-200 text-sm"
                                            value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
                                    </Field>
                                    <Field label="Término *">
                                        <Select value={form.term} onValueChange={(v) => setForm({ ...form, term: v })}>
                                            <SelectTrigger className="h-9 rounded-xl border-slate-200 text-sm"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="I">Semestre I</SelectItem>
                                                <SelectItem value="II">Semestre II</SelectItem>
                                                <SelectItem value="III">Verano / III</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </Field>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="Fecha inicio">
                                        <Input type="date" className="h-9 rounded-xl border-slate-200 text-sm"
                                            value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                                    </Field>
                                    <Field label="Fecha fin">
                                        <Input type="date" className="h-9 rounded-xl border-slate-200 text-sm"
                                            value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                                    </Field>
                                </div>
                                <div className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors"
                                    onClick={() => setForm({ ...form, is_active: !form.is_active })}>
                                    <input id="p-active-acad" type="checkbox" className="w-4 h-4 text-blue-600 rounded border-slate-300"
                                        checked={!!form.is_active}
                                        onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                                        onClick={(e) => e.stopPropagation()} />
                                    <Label htmlFor="p-active-acad" className="cursor-pointer text-sm font-600 text-slate-700">Establecer como periodo vigente</Label>
                                </div>
                                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                                    <Button variant="outline" className="h-9 rounded-xl text-sm border-slate-200" onClick={() => setOpen(false)}>Cancelar</Button>
                                    <Button className="h-9 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm font-700 shadow-sm" onClick={save}>
                                        Guardar cambios
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            }
        >
            {loading ? <LoadingCenter text="Cargando periodos…" /> : (
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto" style={{ maxHeight: 420, overflowY: "auto", scrollbarWidth: "thin" }}>
                        <table className="w-full border-collapse">
                            <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                                <tr>
                                    {["Código", "Año / Término", "Vigencia", "Estado", "Acciones"].map((h, i) => (
                                        <th key={i} className={`cfg-th ${i === 3 ? "text-center" : i === 4 ? "text-right" : ""}`}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => (
                                    <tr key={r.id} className="cfg-tr">
                                        <td className="cfg-td"><span className="font-800 text-slate-800">{r.code}</span></td>
                                        <td className="cfg-td text-slate-500">{r.year} <span className="text-slate-300 mx-1">·</span> Sem. {r.term}</td>
                                        <td className="cfg-td">
                                            <div className="text-xs text-slate-500 leading-relaxed">
                                                <span className="font-600 text-slate-600">{r.start_date || "—"}</span>
                                                <span className="text-slate-300 mx-1.5">→</span>
                                                {r.end_date || "—"}
                                            </div>
                                        </td>
                                        <td className="cfg-td text-center">
                                            <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-700 ${r.is_active ? "s-active" : "s-historic"}`}>
                                                {r.is_active ? "Vigente" : "Histórico"}
                                            </span>
                                        </td>
                                        <td className="cfg-td">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button size="sm" variant="ghost"
                                                    className={`h-7 px-3 text-xs font-700 rounded-lg ${r.is_active ? "text-orange-600 hover:bg-orange-50" : "text-green-600 hover:bg-green-50"}`}
                                                    onClick={() => toggleActive(r)}>
                                                    {r.is_active ? "Cerrar" : "Activar"}
                                                </Button>
                                                <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                                    onClick={() => { setEditing(r); setForm({ ...r }); setOpen(true); }}>
                                                    <Edit3 className="h-3.5 w-3.5" />
                                                </Button>
                                                <DeleteConfirm
                                                    trigger={<Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></Button>}
                                                    title="¿Eliminar periodo?"
                                                    description={<>Se eliminará permanentemente el periodo <strong>{r.code}</strong>.</>}
                                                    onConfirm={() => remove(r.id)}
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {rows.length === 0 && (
                                    <tr><td colSpan={5} className="py-10">
                                        <EmptyState icon={CalendarDays} title="Sin periodos registrados" subtitle="Crea uno nuevo con el botón superior" />
                                    </td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </SectionCard>
    );
};

// ===============================================================
// Directorio de Docentes
// ===============================================================
const INITIAL_TEACHER_FORM = { document: "", full_name: "", email: "", phone: "", specialization: "" };

export const TeachersSection = () => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [search, setSearch] = useState("");
    const [form, setForm] = useState(INITIAL_TEACHER_FORM);

    const resetForm = () => { setForm(INITIAL_TEACHER_FORM); setEditing(null); };

    const load = useCallback(async () => {
        try { setLoading(true); const data = await Teachers.list(); setRows(data?.items ?? data ?? []); }
        catch (e) { toast.error(formatApiError(e)); } finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const save = async () => {
        try {
            if (!form.document?.trim()) return toast.error("Documento es requerido");
            if (!form.full_name?.trim()) return toast.error("Nombre completo es requerido");
            if (editing) { await Teachers.update(editing.id, form); toast.success("Docente actualizado"); }
            else { await Teachers.create(form); toast.success("Docente creado"); }
            setOpen(false); resetForm(); load();
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const remove = async (id) => { try { await Teachers.remove(id); toast.success("Docente eliminado"); load(); } catch (e) { toast.error(formatApiError(e)); } };

    const filtered = useMemo(() => {
        if (!search.trim()) return rows;
        const q = search.toLowerCase();
        return rows.filter((r) => r.full_name?.toLowerCase().includes(q) || r.document?.toLowerCase().includes(q) || r.specialization?.toLowerCase().includes(q));
    }, [rows, search]);

    const initials = (name) => (name || "D").split(" ").filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase();

    return (
        <SectionCard
            icon={Users} title="Directorio de Docentes" desc="Registro de profesores e información de contacto"
            action={
                <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
                    <DialogTrigger asChild>
                        <Button className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-700 gap-1.5 shadow-sm">
                            <UserPlus className="w-4 h-4" /> Nuevo docente
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-lg rounded-2xl p-0 overflow-hidden">
                        <div className="h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
                        <div className="p-6">
                            <DialogHeader className="mb-5">
                                <DialogTitle className="font-800 text-slate-800 flex items-center gap-2">
                                    {editing ? <Edit3 className="w-5 h-5 text-blue-600" /> : <UserPlus className="w-5 h-5 text-blue-600" />}
                                    {editing ? "Editar docente" : "Registrar docente"}
                                </DialogTitle>
                                <DialogDescription>
                                    {editing ? `Editando: ${editing.full_name}` : "Complete la ficha del profesor."}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="Documento *">
                                        <Input className="h-9 rounded-xl border-slate-200 text-sm" placeholder="DNI / CE"
                                            value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} />
                                    </Field>
                                    <Field label="Nombre completo *">
                                        <Input className="h-9 rounded-xl border-slate-200 text-sm" placeholder="Apellidos y Nombres"
                                            value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                                    </Field>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="Correo">
                                        <Input type="email" className="h-9 rounded-xl border-slate-200 text-sm" placeholder="docente@email.com"
                                            value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                                    </Field>
                                    <Field label="Teléfono">
                                        <Input className="h-9 rounded-xl border-slate-200 text-sm" placeholder="999 999 999"
                                            value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                                    </Field>
                                </div>
                                <Field label="Especialidad">
                                    <Input className="h-9 rounded-xl border-slate-200 text-sm" placeholder="Ej. Matemáticas, Ciencias…"
                                        value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} />
                                </Field>
                                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                                    <Button variant="outline" className="h-9 rounded-xl text-sm border-slate-200" onClick={() => setOpen(false)}>Cancelar</Button>
                                    <Button className="h-9 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm font-700 shadow-sm gap-1.5" onClick={save}>
                                        <Save className="w-4 h-4" /> {editing ? "Guardar cambios" : "Guardar ficha"}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            }
        >
            <div className="mb-4 relative w-full sm:w-72">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </span>
                <Input className="h-9 pl-9 rounded-xl border-slate-200 bg-white text-sm" placeholder="Buscar docente…"
                    value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto" style={{ maxHeight: 420, overflowY: "auto", scrollbarWidth: "thin" }}>
                    <table className="w-full border-collapse">
                        <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                            <tr>
                                {["Docente", "Contacto", "Especialidad", "Acciones"].map((h, i) => (
                                    <th key={i} className={`cfg-th ${i === 3 ? "text-right" : ""}`}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={4} className="py-10"><LoadingCenter text="Cargando directorio…" /></td></tr>
                            ) : filtered.map((r) => (
                                <tr key={r.id} className="cfg-tr group">
                                    <td className="cfg-td">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-800 text-xs border border-blue-100 shrink-0">
                                                {initials(r.full_name)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-700 text-slate-800">{r.full_name}</p>
                                                <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5"><CreditCard className="w-3 h-3" />{r.document}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="cfg-td">
                                        <div className="space-y-1">
                                            {r.email ? <p className="text-xs flex items-center gap-1.5 text-slate-500"><Mail className="w-3 h-3 text-slate-400" />{r.email}</p> : <p className="text-xs text-slate-300 italic">Sin email</p>}
                                            {r.phone ? <p className="text-xs flex items-center gap-1.5 text-slate-500"><Phone className="w-3 h-3 text-slate-400" />{r.phone}</p> : <p className="text-xs text-slate-300 italic">Sin teléfono</p>}
                                        </div>
                                    </td>
                                    <td className="cfg-td">
                                        {r.specialization
                                            ? <span className="text-[11px] font-700 text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">{r.specialization}</span>
                                            : <span className="text-slate-300 text-xs">—</span>}
                                    </td>
                                    <td className="cfg-td text-right">
                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                                onClick={() => {
                                                    setEditing(r);
                                                    setForm({
                                                        document: r.document || "",
                                                        full_name: r.full_name || "",
                                                        email: r.email || "",
                                                        phone: r.phone || "",
                                                        specialization: r.specialization || "",
                                                    });
                                                    setOpen(true);
                                                }}
                                            >
                                                <Edit3 className="w-3.5 h-3.5" />
                                            </button>
                                            <DeleteConfirm
                                                trigger={<button className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>}
                                                title="¿Eliminar docente?"
                                                description={<>Se eliminará permanentemente a <strong>{r.full_name}</strong> del sistema.</>}
                                                onConfirm={() => remove(r.id)}
                                            />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {!loading && filtered.length === 0 && (
                                <tr><td colSpan={4} className="py-10">
                                    <EmptyState icon={Users}
                                        title={search ? "Sin resultados" : "Sin docentes registrados"}
                                        subtitle={search ? "Prueba con otro término de búsqueda" : "Agrega uno nuevo para comenzar"} />
                                </td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </SectionCard>
    );
};

// ===============================================================
// Importadores Excel / CSV
// ===============================================================
const IMPORT_JOB_STORAGE_KEY = "acad_import_job";
const TERMINAL_STATES = ["COMPLETED", "COMPLETED_WITH_ERRORS", "FAILED", "ERROR"];
const RUNNING_EQUIVALENTS = ["PENDING", "STARTED", "PROCESSING", "RUNNING", "IN_PROGRESS"];
function normalizeState(st) { const s = String(st || "").toUpperCase().trim(); if (!s) return ""; if (RUNNING_EQUIVALENTS.includes(s)) return "RUNNING"; return s; }

export const ImportersSection = () => {
    const [type, setType] = useState("students");
    const [file, setFile] = useState(null);
    const [job, setJob] = useState(null);
    const [status, setStatus] = useState(null);
    const [isImporting, setIsImporting] = useState(false);
    const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
    const pollRef = useRef(null);
    const intervalRef = useRef(2000);
    const lastProgressRef = useRef(-1);
    const sameProgressCountRef = useRef(0);

    const helpText = useMemo(() => {
        if (type === "students") return "Usa la plantilla de alumnos. Campos obligatorios: Num Documento, Nombres. Verifica Periodo (ej. 2026-I) y ubigeo.";
        if (type === "grades") return "Antes de importar notas: los alumnos deben existir. Verifica Periodo (ej. 2026-I) y que el documento exista.";
        if (type === "plans") return "El plan debe ser .xlsx y mantener el formato (AREAS/ASIGNATURAS, CRED.). Una hoja por carrera.";
        if (type === "traslados") return "Excel con datos del alumno + notas históricas. Cada fila = 1 nota. Un alumno puede tener múltiples filas (una por curso/período).";
        return "Usa la plantilla oficial para evitar errores.";
    }, [type]);

    useEffect(() => { setFile(null); }, [type]);

    const clearPolling = useCallback(() => { if (pollRef.current) { clearTimeout(pollRef.current); pollRef.current = null; } }, []);
    const clearJobMemory = useCallback(() => { try { localStorage.removeItem(IMPORT_JOB_STORAGE_KEY); } catch (_) { } }, []);
    const saveJobMemory = useCallback((jobId, importType) => { try { localStorage.setItem(IMPORT_JOB_STORAGE_KEY, JSON.stringify({ jobId, type: importType, at: Date.now() })); } catch (_) { } }, []);
    const readJobMemory = useCallback(() => { try { const raw = localStorage.getItem(IMPORT_JOB_STORAGE_KEY); if (!raw) return null; const p = JSON.parse(raw); if (!p?.jobId) return null; return p; } catch (_) { return null; } }, []);

    const normalizedState = normalizeState(status?.state);
    const isProcessing = normalizedState ? !TERMINAL_STATES.includes(normalizedState) : (isImporting || !!job);
    const showProgressCard = isProcessing || !!status;

    const finish = useCallback((finalState, errCount = 0) => {
        clearPolling(); setIsImporting(false); clearJobMemory();
        const fs = normalizeState(finalState);
        if (fs === "COMPLETED" && errCount === 0) toast.success("¡Importación completada con éxito!");
        else if (fs === "COMPLETED_WITH_ERRORS" || (fs === "COMPLETED" && errCount > 0)) toast.warning(`Completado con observaciones (${errCount} errores).`);
        else toast.error("La importación terminó con error");
    }, [clearJobMemory, clearPolling]);

    const computeNextInterval = useCallback((progress) => {
        const p = Number(progress); const last = lastProgressRef.current;
        if (!Number.isFinite(p)) return 2500;
        if (p !== last) { sameProgressCountRef.current = 0; lastProgressRef.current = p; return 2000; }
        sameProgressCountRef.current += 1;
        if (sameProgressCountRef.current >= 6) return 6000;
        if (sameProgressCountRef.current >= 3) return 4000;
        return 2500;
    }, []);

    const pollStatus = useCallback(async (jobId) => {
        clearPolling();
        const tick = async () => {
            try {
                const st = await Imports.status(jobId);
                const stState = normalizeState(st?.state);
                setStatus({ ...st, state: stState }); setLastUpdatedAt(Date.now());
                const errCount = Array.isArray(st?.errors) ? st.errors.length : 0;
                if (stState && TERMINAL_STATES.includes(stState)) { finish(stState, errCount); return; }
                intervalRef.current = computeNextInterval(Number(st?.progress ?? 0));
            } catch (err) { console.error("Error al consultar estado:", err); intervalRef.current = 6000; }
            finally { pollRef.current = setTimeout(tick, intervalRef.current); }
        };
        tick();
    }, [clearPolling, computeNextInterval, finish]);

    useEffect(() => { const handler = (e) => { if (!isProcessing) return; e.preventDefault(); e.returnValue = ""; }; window.addEventListener("beforeunload", handler); return () => window.removeEventListener("beforeunload", handler); }, [isProcessing]);
    useEffect(() => { const saved = readJobMemory(); if (!saved) return; setType(saved.type || "students"); setJob(saved.jobId); setIsImporting(true); pollStatus(saved.jobId); }, [pollStatus, readJobMemory]);
    useEffect(() => { return () => clearPolling(); }, [clearPolling]);

    const start = async () => {
        if (!file) return toast.error("Selecciona un archivo primero");
        if (isProcessing) return toast.info("Ya hay una importación en curso");
        setIsImporting(true); setStatus(null); setJob(null); setLastUpdatedAt(null);
        intervalRef.current = 2000; lastProgressRef.current = -1; sameProgressCountRef.current = 0;
        try {
            const res = await Imports.start(type, file);
            const jobId = res?.job_id;
            if (!jobId) throw new Error("El servidor no devolvió job_id.");
            setJob(jobId); saveJobMemory(jobId, type);
            toast.success("Importación iniciada"); pollStatus(jobId);
        } catch (e) {
            const jobId = e?.response?.data?.job_id;
            if (jobId) { setJob(jobId); saveJobMemory(jobId, type); setIsImporting(true); toast.warning("Importación rechazada. Revisa los errores."); pollStatus(jobId); return; }
            toast.error(formatApiError(e, "No se pudo iniciar la importación")); setIsImporting(false); clearJobMemory();
        }
    };

    const stopMonitoring = () => { clearPolling(); setIsImporting(false); setStatus(null); setJob(null); setLastUpdatedAt(null); clearJobMemory(); toast.info("Monitoreo detenido"); };
    const closeResults = () => { setStatus(null); setJob(null); setLastUpdatedAt(null); setFile(null); clearJobMemory(); toast.info("Resultados cerrados"); };

    const progress = safeNum(status?.progress, 0);
    const processed = safeNum(status?.processed, 0);
    const total = safeNum(status?.total, 0);
    const imported = safeNum(status?.imported, 0);
    const updated = safeNum(status?.updated, 0);
    const errors = useMemo(() => normalizeImportErrors(status?.errors), [status?.errors]);
    const stateLabel = normalizedState || (isProcessing ? "RUNNING" : "—");
    const stateChip = stateLabel === "COMPLETED" ? "s-done" : stateLabel === "COMPLETED_WITH_ERRORS" ? "s-warn" : stateLabel === "FAILED" || stateLabel === "ERROR" ? "s-error" : "s-running";

    return (
        <SectionCard icon={FileSpreadsheet} title="Importadores Excel / CSV" desc="Carga masiva de planes de estudio, alumnos y notas históricas">
            <div className="mb-5 flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                <div>
                    <p className="text-sm font-700 text-blue-800 mb-0.5">Instrucciones</p>
                    <p className="text-xs text-blue-700">{helpText}</p>
                    <p className="text-[11px] text-blue-500 mt-1">Consejo: descarga la plantilla y no cambies nombres de columnas.</p>
                </div>
            </div>

            {isProcessing && (
                <div className="mb-5 flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                        <p className="text-sm font-700 text-amber-800">No cambie de pestaña ni cierre esta ventana</p>
                        <p className="text-xs text-amber-700 mt-0.5">La importación está en proceso.</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Tipo de importación">
                    <Select value={type} onValueChange={setType} disabled={isProcessing}>
                        <SelectTrigger className="h-9 rounded-xl border-slate-200 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="plans">Plan de estudios</SelectItem>
                            <SelectItem value="students">Alumnos</SelectItem>
                            <SelectItem value="grades">Notas históricas</SelectItem>
                            <SelectItem value="traslados">Traslados</SelectItem>
                        </SelectContent>
                    </Select>
                </Field>
                <Field label="Descargar plantilla">
                    <Button variant="outline" className="h-9 w-full rounded-xl border-slate-200 text-sm gap-1.5" disabled={isProcessing}
                        onClick={async () => {
                            try {
                                const res = await Imports.downloadTemplate(type);
                                const cd = res.headers?.["content-disposition"];
                                const filename = filenameFromContentDisposition(cd, `${type}_template.xlsx`);
                                saveBlobAsFile(new Blob([res.data], { type: res.headers?.["content-type"] || "application/octet-stream" }), filename);
                                toast.success("Plantilla descargada");
                            } catch (e) { toast.error(formatApiError(e, "No se pudo descargar la plantilla")); }
                        }}>
                        <Download className="w-4 h-4" /> Descargar plantilla
                    </Button>
                </Field>
                <Field label="Archivo a importar">
                    <Input type="file" accept={(type === "plans") ? ".xlsx" : ".xlsx,.csv"} className="h-9 text-xs rounded-xl border-slate-200" disabled={isProcessing}
                        onChange={(e) => {
                            const f = e.target.files?.[0] || null; setFile(f); if (!f) return;
                            const name = (f.name || "").toLowerCase();
                            if (type === "plans" && !name.endsWith(".xlsx")) { toast.error("Para Plan de estudios, el archivo debe ser .xlsx"); setFile(null); return; }
                            if (type !== "plans" && !(name.endsWith(".xlsx") || name.endsWith(".csv"))) { toast.error("El archivo debe ser .xlsx o .csv"); setFile(null); }
                        }} />
                    {file && !isProcessing && <p className="text-[11px] text-slate-400 mt-1">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</p>}
                </Field>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-2 mt-5">
                {isProcessing && <Button variant="outline" className="h-9 rounded-xl border-red-200 text-red-600 hover:bg-red-50 text-sm" onClick={stopMonitoring}>Dejar de monitorear</Button>}
                {!isProcessing && status && <Button variant="outline" className="h-9 rounded-xl text-sm" onClick={closeResults}>Cerrar resultados</Button>}
                <Button className="h-9 min-w-[180px] rounded-xl bg-blue-600 hover:bg-blue-700 text-sm font-700 shadow-sm gap-1.5" disabled={isProcessing || !file} onClick={start}>
                    {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin" /> Procesando…</> : <><UploadCloud className="w-4 h-4" /> Iniciar importación</>}
                </Button>
            </div>

            {showProgressCard && (
                <div className="mt-6 rounded-2xl border border-slate-200 overflow-hidden cfg-fade">
                    <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                        <p className="text-sm font-800 text-slate-700">Progreso de importación</p>
                        <span className={`text-[11px] font-800 px-2.5 py-1 rounded-full ${stateChip}`}>{stateLabel}</span>
                    </div>
                    <div className="p-5 space-y-4">
                        <div>
                            <div className="flex justify-between text-xs mb-1.5">
                                <span className="font-600 text-slate-600">Progreso</span>
                                <span className="font-700 text-slate-700">{Math.round(progress)}%</span>
                            </div>
                            <div className="cfg-progress-track">
                                <div className="cfg-progress-bar" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
                            </div>
                            <div className="flex justify-between text-[10px] text-slate-400 mt-1.5">
                                <span>Job: {job || "—"}</span>
                                <span>{processed} / {total || "?"} registros</span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">Última actualización: {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString() : "—"}</p>
                            {!!status?.message && <p className="text-xs text-slate-600 mt-2 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">{status.message}</p>}
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { label: "Importados", value: imported, cls: "bg-slate-50 border-slate-200 text-slate-800" },
                                { label: "Actualizados", value: updated, cls: "bg-slate-50 border-slate-200 text-slate-800" },
                                { label: "Errores", value: errors.length, cls: "bg-red-50 border-red-100 text-red-700" },
                            ].map(({ label, value, cls }) => (
                                <div key={label} className={`p-3 rounded-xl border ${cls}`}>
                                    <p className="text-[10px] font-700 uppercase tracking-wider opacity-70">{label}</p>
                                    <p className="text-xl font-900 mt-0.5">{value}</p>
                                </div>
                            ))}
                        </div>
                        {errors.length > 0 && (
                            <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                                <p className="text-xs font-800 text-red-700 mb-3 flex items-center gap-1.5">
                                    <AlertCircle className="w-4 h-4" /> Errores ({errors.length})
                                </p>
                                <div className="overflow-x-auto max-h-52 overflow-y-auto">
                                    <table className="w-full text-xs">
                                        <thead className="text-red-800/60">
                                            <tr>
                                                <th className="py-1.5 pr-3 text-left font-700">Fila</th>
                                                <th className="py-1.5 pr-3 text-left font-700">Campo</th>
                                                <th className="py-1.5 text-left font-700">Detalle</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-red-100">
                                            {errors.slice(0, 200).map((e, idx) => (
                                                <tr key={idx}>
                                                    <td className="py-1.5 pr-3 font-mono">{e.row}</td>
                                                    <td className="py-1.5 pr-3">{e.field}</td>
                                                    <td className="py-1.5">{e.message}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {errors.length > 200 && <p className="text-[10px] text-red-600/70 mt-2">Mostrando 200 de {errors.length} errores.</p>}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </SectionCard>
    );
};
