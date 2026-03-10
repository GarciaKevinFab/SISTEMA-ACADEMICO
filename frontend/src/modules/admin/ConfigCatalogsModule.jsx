// src/modules/admin/ConfigCatalogsModule.jsx — UI/UX mejorado
// ★ Incluye nueva sección "Grados y Títulos" para gestionar tipos de grado/título
// ★ v2: Editar docentes, scroll en sedes/aulas y docentes
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/utils/safeToast";
import { useAuth } from "@/context/AuthContext";
import {
    Card, CardHeader, CardTitle, CardDescription, CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
    Settings, Building2, CalendarDays, Landmark, Users, HardDriveDownload,
    UploadCloud, Download, RefreshCw, XCircle, Image as ImageIcon,
    FileSpreadsheet, DatabaseZap, Plus, ChevronRight, AlertCircle, MapPin,
    Image, Save, Trash2, CreditCard, UserPlus, Mail, Phone, Edit3,
    ChevronDown, Loader2, CheckCircle2, GraduationCap, Star, Eye,
} from "lucide-react";
import { toAbsoluteMediaUrl } from "../../utils/mediaUrl";
import {
    Periods, Campuses, Classrooms, Teachers, Ubigeo, Institution, Imports, Backup,
} from "@/services/catalogs.service";

// ★ Importar servicio de GradoTituloTypes
import { GradoTituloTypes } from "@/services/graduates.service";

/* ─── inject styles ─── */
function InjectCatalogsStyles() {
    useEffect(() => {
        const id = "catalogs-styles";
        if (document.getElementById(id)) return;
        const l = document.createElement("link");
        l.id = id + "-font"; l.rel = "stylesheet";
        l.href = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap";
        document.head.appendChild(l);
        const s = document.createElement("style");
        s.id = id;
        s.textContent = `
          .cfg-root { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
          .cfg-root * { font-family: inherit; }
          .cfg-header {
            border-top: 3px solid transparent;
            border-image: linear-gradient(90deg,#3B82F6,#6366F1,#8B5CF6) 1;
            border-radius: 1rem 1rem 0 0;
          }
          .cfg-tab[data-state=active] {
            background: #fff; color: #1E40AF; font-weight: 700;
            box-shadow: 0 1px 6px rgba(0,0,0,0.10);
          }
          .cfg-tab { font-weight: 500; font-size: 13px; border-radius: 10px; transition: all .15s; }
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
          @keyframes cfg-spin { to { transform: rotate(360deg) } }
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

/* ─── Helpers ─── */
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

function normalizeUbigeoList(list) {
    const arr = list?.items ?? list ?? [];
    if (!Array.isArray(arr)) return [];
    return arr.map((x) => {
        if (typeof x === "string") return { code: x, name: x };
        const code = String(x?.code ?? x?.id ?? x?.value ?? x?.name ?? "");
        const name = String(x?.name ?? x?.label ?? x?.value ?? x?.code ?? "");
        return { code, name };
    }).filter((x) => x.code);
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
// ★ GRADOS Y TÍTULOS — Catálogo de tipos
// ===============================================================
const INITIAL_GT_FORM = {
    code: "", name: "", template: "", diploma_label: "TÍTULO",
    is_default: false, is_active: true, order: 0,
};

const GradosTitulosSection = () => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(INITIAL_GT_FORM);

    const resetForm = () => { setForm(INITIAL_GT_FORM); setEditing(null); };

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const data = await GradoTituloTypes.list();
            setRows(data?.items ?? data ?? []);
        } catch (e) { toast.error(formatApiError(e)); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const save = async () => {
        try {
            if (!form.code?.trim()) return toast.error("Código es requerido");
            if (!form.name?.trim()) return toast.error("Nombre es requerido");
            if (!form.template?.trim()) return toast.error("Plantilla es requerida");
            const payload = { ...form, order: parseInt(form.order || "0", 10) };
            if (editing) await GradoTituloTypes.update(editing.id, payload);
            else await GradoTituloTypes.create(payload);
            toast.success(editing ? "Tipo actualizado" : "Tipo creado");
            setOpen(false); resetForm(); load();
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const remove = async (id) => {
        try { await GradoTituloTypes.remove(id); toast.success("Tipo eliminado"); load(); }
        catch (e) { toast.error(formatApiError(e)); }
    };

    const toggleDefault = async (r) => {
        try {
            await GradoTituloTypes.update(r.id, { ...r, is_default: !r.is_default });
            load();
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const previewTemplate = (tpl) => {
        if (!tpl) return "—";
        return tpl.replace("{especialidad}", "EDUCACIÓN INICIAL");
    };

    return (
        <SectionCard
            icon={GraduationCap}
            iconColor="text-indigo-600"
            iconBg="bg-indigo-50"
            title="Grados y Títulos"
            desc="Tipos de grado/título que otorga la institución. Se usan en constancias e importación de egresados."
            action={
                <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
                    <DialogTrigger asChild>
                        <Button className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-700 gap-1.5 shadow-sm">
                            <Plus className="w-4 h-4" /> Nuevo tipo
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg rounded-2xl p-0 overflow-hidden">
                        <div className="h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
                        <div className="p-6">
                            <DialogHeader className="mb-5">
                                <DialogTitle className="text-xl font-800 text-slate-800 flex items-center gap-2">
                                    <GraduationCap className="w-5 h-5 text-indigo-600" />
                                    {editing ? "Editar tipo de grado/título" : "Nuevo tipo de grado/título"}
                                </DialogTitle>
                                <DialogDescription className="text-slate-500 text-sm">
                                    Define un concepto como "Título de Profesor", "Bachiller" o "Licenciatura".
                                    Usa <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{"{especialidad}"}</code> en la plantilla para insertar la carrera automáticamente.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="Código *" hint="Identificador único. Ej: TITULO_PROFESOR">
                                        <Input className="h-9 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-sm font-mono"
                                            placeholder="TITULO_PROFESOR"
                                            value={form.code}
                                            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s+/g, "_") })} />
                                    </Field>
                                    <Field label="Orden" hint="Orden de aparición">
                                        <Input type="number" className="h-9 rounded-xl border-slate-200 text-sm"
                                            value={form.order}
                                            onChange={(e) => setForm({ ...form, order: e.target.value })} />
                                    </Field>
                                </div>
                                <Field label="Nombre para mostrar *" hint='Ej: "TÍTULO DE PROFESOR(A)"'>
                                    <Input className="h-9 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-sm"
                                        placeholder='TÍTULO DE PROFESOR(A)'
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })} />
                                </Field>
                                <Field label="Plantilla de denominación *" hint='Usa {especialidad} como variable. Ej: "PROFESOR(A) EN {especialidad}"'>
                                    <Input className="h-9 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-sm"
                                        placeholder='PROFESOR(A) EN {especialidad}'
                                        value={form.template}
                                        onChange={(e) => setForm({ ...form, template: e.target.value })} />
                                </Field>
                                {form.template && (
                                    <div className="flex items-start gap-2 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                                        <Eye className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
                                        <div>
                                            <p className="text-[10px] font-800 text-indigo-600 uppercase tracking-wider">Vista previa</p>
                                            <p className="text-sm font-700 text-indigo-800 mt-0.5">{previewTemplate(form.template)}</p>
                                        </div>
                                    </div>
                                )}
                                <Field label="Etiqueta en constancia" hint='Texto que aparece como "Grado / Título" en el PDF. Ej: "TÍTULO", "GRADO DE BACHILLER"'>
                                    <Input className="h-9 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-sm"
                                        placeholder='TÍTULO'
                                        value={form.diploma_label}
                                        onChange={(e) => setForm({ ...form, diploma_label: e.target.value })} />
                                </Field>
                                <div className="flex gap-4">
                                    <div className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors flex-1"
                                        onClick={() => setForm({ ...form, is_default: !form.is_default })}>
                                        <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                                            checked={!!form.is_default}
                                            onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                                            onClick={(e) => e.stopPropagation()} />
                                        <div>
                                            <Label className="cursor-pointer text-sm font-600 text-slate-700 block">Por defecto</Label>
                                            <p className="text-[10px] text-slate-400">Se asigna al importar egresados</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors flex-1"
                                        onClick={() => setForm({ ...form, is_active: !form.is_active })}>
                                        <input type="checkbox" className="w-4 h-4 text-green-600 rounded border-slate-300"
                                            checked={!!form.is_active}
                                            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                                            onClick={(e) => e.stopPropagation()} />
                                        <div>
                                            <Label className="cursor-pointer text-sm font-600 text-slate-700 block">Activo</Label>
                                            <p className="text-[10px] text-slate-400">Disponible para seleccionar</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                                    <Button variant="outline" className="h-9 rounded-xl text-sm border-slate-200" onClick={() => setOpen(false)}>Cancelar</Button>
                                    <Button className="h-9 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-sm font-700 shadow-sm" onClick={save}>
                                        Guardar
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            }
        >
            <div className="mb-4 flex items-start gap-3 p-3.5 bg-indigo-50 border border-indigo-100 rounded-xl">
                <AlertCircle className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
                <div className="text-xs text-indigo-700 space-y-1">
                    <p className="font-700">¿Cómo funciona?</p>
                    <p>Cada tipo define una <strong>plantilla</strong> que se aplica automáticamente según la especialidad del egresado. Cuando se obtenga la licencia para otorgar bachilleres o licenciaturas, solo agrega un nuevo tipo aquí.</p>
                </div>
            </div>

            {loading ? <LoadingCenter text="Cargando tipos…" /> : (
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto" style={{ maxHeight: 400, overflowY: "auto", scrollbarWidth: "thin" }}>
                        <table className="w-full border-collapse">
                            <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                                <tr>
                                    {["Código", "Nombre", "Plantilla → Resultado", "Etiqueta", "Estado", "Acciones"].map((h, i) => (
                                        <th key={i} className={`cfg-th ${i >= 4 ? "text-center" : ""} ${i === 5 ? "text-right" : ""}`}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => (
                                    <tr key={r.id} className="cfg-tr group">
                                        <td className="cfg-td">
                                            <span className="font-mono text-xs font-700 text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{r.code}</span>
                                        </td>
                                        <td className="cfg-td">
                                            <div className="flex items-center gap-2">
                                                <span className="font-700 text-slate-800 text-sm">{r.name}</span>
                                                {r.is_default && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-800">
                                                        <Star className="w-3 h-3" /> DEFAULT
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="cfg-td">
                                            <div>
                                                <p className="text-[11px] text-slate-400 font-mono">{r.template}</p>
                                                <p className="text-xs text-indigo-700 font-600 mt-0.5">→ {previewTemplate(r.template)}</p>
                                            </div>
                                        </td>
                                        <td className="cfg-td text-center">
                                            <span className="text-xs font-600 text-slate-600">{r.diploma_label}</span>
                                        </td>
                                        <td className="cfg-td text-center">
                                            <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-700 ${r.is_active ? "s-active" : "s-historic"}`}>
                                                {r.is_active ? "Activo" : "Inactivo"}
                                            </span>
                                        </td>
                                        <td className="cfg-td">
                                            <div className="flex items-center justify-end gap-1">
                                                {!r.is_default && (
                                                    <Button size="sm" variant="ghost"
                                                        className="h-7 px-2.5 text-[11px] font-700 rounded-lg text-amber-600 hover:bg-amber-50 gap-1"
                                                        onClick={() => toggleDefault(r)}>
                                                        <Star className="w-3 h-3" /> Default
                                                    </Button>
                                                )}
                                                <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                                    onClick={() => {
                                                        setEditing(r);
                                                        setForm({
                                                            code: r.code || "", name: r.name || "", template: r.template || "",
                                                            diploma_label: r.diploma_label || "TÍTULO",
                                                            is_default: !!r.is_default, is_active: r.is_active !== false,
                                                            order: r.order ?? 0,
                                                        });
                                                        setOpen(true);
                                                    }}>
                                                    <Edit3 className="h-3.5 w-3.5" />
                                                </Button>
                                                <DeleteConfirm
                                                    trigger={<Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></Button>}
                                                    title="¿Eliminar tipo de grado/título?"
                                                    description={<>Se eliminará <strong>{r.name}</strong>. Los egresados existentes conservarán su texto actual.</>}
                                                    onConfirm={() => remove(r.id)}
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {rows.length === 0 && (
                                    <tr><td colSpan={6} className="py-10">
                                        <EmptyState icon={GraduationCap} title="Sin tipos de grado/título registrados"
                                            subtitle='Crea uno como "TÍTULO DE PROFESOR(A)" para comenzar' />
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
// Periodos Académicos
// ===============================================================
const PeriodsSection = () => {
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
                                    <input id="p-active" type="checkbox" className="w-4 h-4 text-blue-600 rounded border-slate-300"
                                        checked={!!form.is_active}
                                        onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                                        onClick={(e) => e.stopPropagation()} />
                                    <Label htmlFor="p-active" className="cursor-pointer text-sm font-600 text-slate-700">Establecer como periodo vigente</Label>
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
                    <div className="overflow-x-auto" style={{ maxHeight: 340, overflowY: "auto", scrollbarWidth: "thin" }}>
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
// ★ Sedes & Aulas — con scroll en ambas listas
// ===============================================================
const CampusesSection = () => {
    const [campuses, setCampuses] = useState([]);
    const [classrooms, setClassrooms] = useState([]);
    const [selCampus, setSelCampus] = useState("");
    const [loading, setLoading] = useState(true);
    const [openCampus, setOpenCampus] = useState(false);
    const [openClass, setOpenClass] = useState(false);
    const [editingCampus, setEditingCampus] = useState(null);
    const [editingClass, setEditingClass] = useState(null);
    const [campusForm, setCampusForm] = useState({ code: "", name: "", address: "" });
    const [classForm, setClassForm] = useState({ code: "", name: "", capacity: 30, campus_id: "" });

    const resetCampusForm = () => { setEditingCampus(null); setCampusForm({ code: "", name: "", address: "" }); };
    const resetClassForm = () => { setEditingClass(null); setClassForm({ code: "", name: "", capacity: 30, campus_id: "" }); };

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const cs = await Campuses.list();
            const arr = cs?.items ?? cs ?? [];
            setCampuses(arr);
            if (!selCampus && arr[0]) setSelCampus(String(arr[0].id));
            if (selCampus && !arr.some((x) => String(x.id) === String(selCampus))) setSelCampus(arr[0] ? String(arr[0].id) : "");
        } catch (e) { toast.error(formatApiError(e)); } finally { setLoading(false); }
    }, [selCampus]);

    const loadClassrooms = useCallback(async () => {
        try {
            const res = await Classrooms.list(selCampus ? { campus_id: selCampus } : undefined);
            setClassrooms(res?.items ?? res ?? []);
        } catch (e) { toast.error(formatApiError(e, "No se pudo cargar aulas")); }
    }, [selCampus]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { if (selCampus) loadClassrooms(); }, [loadClassrooms, selCampus]);

    const saveCampus = async () => {
        try {
            if (!campusForm.code?.trim()) return toast.error("Código de sede es requerido");
            if (!campusForm.name?.trim()) return toast.error("Nombre de sede es requerido");
            if (editingCampus?.id) {
                await Campuses.update(editingCampus.id, campusForm);
                toast.success("Sede actualizada");
            } else {
                await Campuses.create(campusForm);
                toast.success("Sede creada");
            }
            setOpenCampus(false); resetCampusForm(); load();
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const saveClass = async () => {
        try {
            if (!classForm.code?.trim()) return toast.error("Código de aula es requerido");
            if (!classForm.name?.trim()) return toast.error("Nombre de aula es requerido");
            const campusPk = Number(classForm.campus_id || selCampus);
            if (!campusPk) return toast.error("Selecciona una sede");
            const payload = { code: classForm.code, name: classForm.name, capacity: Number(classForm.capacity || 0), campus_id: campusPk };
            if (editingClass?.id) {
                await Classrooms.update(editingClass.id, payload);
                toast.success("Aula actualizada");
            } else {
                await Classrooms.create(payload);
                toast.success("Aula creada");
            }
            setOpenClass(false); resetClassForm(); loadClassrooms();
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const campusDialogContent = (
        <DialogContent className="rounded-2xl sm:max-w-md p-0 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
            <div className="p-6">
                <DialogHeader className="mb-5">
                    <DialogTitle className="font-800 text-slate-800">{editingCampus ? "Editar sede" : "Nueva sede"}</DialogTitle>
                    <DialogDescription>Datos de la ubicación del campus.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <Field label="Código *">
                        <Input className="h-9 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-sm" placeholder="Ej. LIM-01"
                            value={campusForm.code} onChange={(e) => setCampusForm({ ...campusForm, code: e.target.value })} />
                    </Field>
                    <Field label="Nombre *">
                        <Input className="h-9 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-sm" placeholder="Campus Central"
                            value={campusForm.name} onChange={(e) => setCampusForm({ ...campusForm, name: e.target.value })} />
                    </Field>
                    <Field label="Dirección">
                        <Input className="h-9 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-sm" placeholder="Av. Principal 123"
                            value={campusForm.address} onChange={(e) => setCampusForm({ ...campusForm, address: e.target.value })} />
                    </Field>
                    <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                        <Button variant="outline" className="h-9 rounded-xl text-sm border-slate-200" onClick={() => setOpenCampus(false)}>Cancelar</Button>
                        <Button className="h-9 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm font-700 shadow-sm" onClick={saveCampus}>
                            {editingCampus ? "Guardar cambios" : "Crear sede"}
                        </Button>
                    </div>
                </div>
            </div>
        </DialogContent>
    );

    return (
        <SectionCard icon={Building2} title="Sedes & Aulas" desc="Campus disponibles y sus espacios físicos">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* ── Panel sedes ── */}
                <div className="lg:col-span-1">
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 bg-slate-50/80 border-b border-slate-200">
                            <p className="text-xs font-800 text-slate-600 uppercase tracking-wider">Sedes</p>
                            <Dialog open={openCampus} onOpenChange={(v) => { setOpenCampus(v); if (!v) resetCampusForm(); }}>
                                <DialogTrigger asChild>
                                    <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs font-700 text-blue-600 hover:bg-blue-50 rounded-lg gap-1"
                                        onClick={() => setEditingCampus(null)}>
                                        <Plus className="h-3.5 w-3.5" /> Nueva
                                    </Button>
                                </DialogTrigger>
                                {campusDialogContent}
                            </Dialog>
                        </div>
                        {/* ★ Scroll en lista de sedes */}
                        <div className="p-2 space-y-1 bg-white" style={{ maxHeight: 340, overflowY: "auto", scrollbarWidth: "thin" }}>
                            {loading ? <LoadingCenter text="Cargando sedes…" /> : campuses.length === 0
                                ? <EmptyState icon={Building2} title="Sin sedes" subtitle="Crea una para comenzar" />
                                : campuses.map((c) => {
                                    const sel = String(c.id) === String(selCampus);
                                    return (
                                        <div key={c.id} role="button" tabIndex={0}
                                            onClick={() => setSelCampus(String(c.id))}
                                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelCampus(String(c.id)); }}
                                            className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all border ${sel ? "bg-blue-50 border-blue-200" : "bg-transparent border-transparent hover:bg-slate-50 hover:border-slate-200"}`}>
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${sel ? "bg-blue-100" : "bg-slate-100"}`}>
                                                <Landmark className={`w-4 h-4 ${sel ? "text-blue-600" : "text-slate-400"}`} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-700 truncate ${sel ? "text-blue-700" : "text-slate-700"}`}>{c.name}</p>
                                                <p className="text-[10px] text-slate-400 truncate">{c.address || "Sin dirección"}</p>
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Dialog open={openCampus && editingCampus?.id === c.id} onOpenChange={(v) => { setOpenCampus(v); if (!v) resetCampusForm(); }}>
                                                    <DialogTrigger asChild>
                                                        <button className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                                            onClick={(e) => { e.stopPropagation(); setEditingCampus(c); setCampusForm({ code: c.code || "", name: c.name || "", address: c.address || "" }); setOpenCampus(true); }}>
                                                            <Edit3 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </DialogTrigger>
                                                    {campusDialogContent}
                                                </Dialog>
                                                <DeleteConfirm
                                                    trigger={<button className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" onClick={(e) => e.stopPropagation()}><Trash2 className="w-3.5 h-3.5" /></button>}
                                                    title="¿Eliminar sede?"
                                                    description={<>Se eliminará permanentemente la sede <strong>{c.name}</strong>.</>}
                                                    onConfirm={async () => { try { await Campuses.remove(c.id); toast.success("Sede eliminada"); await load(); } catch (e) { toast.error(formatApiError(e)); } }}
                                                />
                                            </div>
                                            {sel && <ChevronRight className="w-3.5 h-3.5 text-blue-400" />}
                                        </div>
                                    );
                                })}
                        </div>
                    </div>
                </div>

                {/* ── Panel aulas ── */}
                <div className="lg:col-span-2">
                    <div className="rounded-xl border border-slate-200 overflow-hidden h-full">
                        <div className="flex items-center justify-between px-4 py-3 bg-slate-50/80 border-b border-slate-200">
                            <div>
                                <p className="text-xs font-800 text-slate-600 uppercase tracking-wider">Aulas y Espacios</p>
                                {selCampus
                                    ? <p className="text-[11px] text-green-600 font-600 mt-0.5 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />{campuses.find((x) => String(x.id) === String(selCampus))?.name}</p>
                                    : <p className="text-[11px] text-amber-600 font-600 mt-0.5">Selecciona una sede primero</p>}
                            </div>
                            <Dialog open={openClass} onOpenChange={(v) => { setOpenClass(v); if (!v) resetClassForm(); }}>
                                <DialogTrigger asChild>
                                    <Button disabled={!selCampus} className="h-8 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-700 gap-1.5 shadow-sm disabled:opacity-50">
                                        <Plus className="w-3.5 h-3.5" /> Nueva aula
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="rounded-2xl sm:max-w-md p-0 overflow-hidden">
                                    <div className="h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
                                    <div className="p-6">
                                        <DialogHeader className="mb-5">
                                            <DialogTitle className="font-800 text-slate-800">{editingClass ? "Editar aula" : "Nueva aula"}</DialogTitle>
                                            <DialogDescription>{editingClass ? "Actualice los datos del espacio." : "Registre un nuevo espacio físico."}</DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-4">
                                            <Field label="Código *">
                                                <Input className="h-9 rounded-xl border-slate-200 text-sm" placeholder="A-101"
                                                    value={classForm.code} onChange={(e) => setClassForm({ ...classForm, code: e.target.value })} />
                                            </Field>
                                            <Field label="Nombre *">
                                                <Input className="h-9 rounded-xl border-slate-200 text-sm" placeholder="Laboratorio de Cómputo 1"
                                                    value={classForm.name} onChange={(e) => setClassForm({ ...classForm, name: e.target.value })} />
                                            </Field>
                                            <div className="grid grid-cols-2 gap-3">
                                                <Field label="Capacidad">
                                                    <Input type="number" className="h-9 rounded-xl border-slate-200 text-sm"
                                                        value={classForm.capacity} onChange={(e) => setClassForm({ ...classForm, capacity: parseInt(e.target.value || "0", 10) })} />
                                                </Field>
                                                <Field label="Sede">
                                                    <Select value={classForm.campus_id || String(selCampus || "")} onValueChange={(v) => setClassForm({ ...classForm, campus_id: v })}>
                                                        <SelectTrigger className="h-9 rounded-xl border-slate-200 text-sm"><SelectValue /></SelectTrigger>
                                                        <SelectContent>{campuses.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                </Field>
                                            </div>
                                            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                                                <Button variant="outline" className="h-9 rounded-xl text-sm border-slate-200" onClick={() => setOpenClass(false)}>Cancelar</Button>
                                                <Button className="h-9 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm font-700 shadow-sm" onClick={saveClass}>
                                                    {editingClass ? "Guardar cambios" : "Crear aula"}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>
                        {/* ★ Scroll en tabla de aulas */}
                        <div className="overflow-x-auto" style={{ maxHeight: 340, overflowY: "auto", scrollbarWidth: "thin" }}>
                            <table className="w-full border-collapse">
                                <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                                    <tr>
                                        {["Código", "Nombre del aula", "Capacidad", "Acciones"].map((h, i) => (
                                            <th key={i} className={`cfg-th ${i === 2 ? "text-center" : i === 3 ? "text-right" : ""}`}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {classrooms.map((a) => (
                                        <tr key={a.id} className="cfg-tr group">
                                            <td className="cfg-td font-mono text-xs text-slate-500">{a.code}</td>
                                            <td className="cfg-td font-600 text-slate-700">{a.name}</td>
                                            <td className="cfg-td text-center">
                                                <span className="text-xs font-700 text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">{a.capacity} pax</span>
                                            </td>
                                            <td className="cfg-td text-right">
                                                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                                        onClick={() => { setEditingClass(a); setClassForm({ code: a.code || "", name: a.name || "", capacity: a.capacity ?? 30, campus_id: String(a.campus_id || selCampus || "") }); setOpenClass(true); }}>
                                                        <Edit3 className="w-3.5 h-3.5" />
                                                    </button>
                                                    <DeleteConfirm
                                                        trigger={<button className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>}
                                                        title="¿Eliminar aula?"
                                                        description={<>Se eliminará permanentemente el aula <strong>{a.name}</strong>.</>}
                                                        onConfirm={async () => { try { await Classrooms.remove(a.id); toast.success("Aula eliminada"); loadClassrooms(); } catch (e) { toast.error(formatApiError(e)); } }}
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {classrooms.length === 0 && (
                                        <tr><td colSpan={4} className="py-10">
                                            <EmptyState icon={Building2} title="Sin aulas registradas" subtitle="Selecciona una sede o crea un nuevo espacio" />
                                        </td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </SectionCard>
    );
};

// ===============================================================
// ★ Docentes — con editar + scroll en tabla
// ===============================================================
const INITIAL_TEACHER_FORM = { document: "", full_name: "", email: "", phone: "", specialization: "" };

const TeachersSection = () => {
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
            if (editing) {
                await Teachers.update(editing.id, form);
                toast.success("Docente actualizado");
            } else {
                await Teachers.create(form);
                toast.success("Docente creado");
            }
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

            {/* ★ Scroll en tabla de docentes */}
            <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto" style={{ maxHeight: 380, overflowY: "auto", scrollbarWidth: "thin" }}>
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
                                            {/* ★ Botón editar docente */}
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
// Media upload + Institution (sin cambios)
// ===============================================================
const MediaUpload = ({ label, url, onChange, onRemove, loading }) => {
    const [localPreview, setLocalPreview] = useState(""); const [imgError, setImgError] = useState(false);
    useEffect(() => { return () => { if (localPreview) URL.revokeObjectURL(localPreview); }; }, [localPreview]);
    useEffect(() => { setImgError(false); if (url) setLocalPreview(""); }, [url]);
    const savedUrl = useMemo(() => toAbsoluteMediaUrl(url), [url]); const savedUrlBusted = savedUrl ? `${savedUrl}?t=${Date.now()}` : ""; const src = !imgError ? (localPreview || savedUrlBusted) : ""; const isSaved = !!savedUrl && !localPreview;
    return (<div className="space-y-2"><div className="flex items-center justify-between"><span className="text-xs font-700 text-slate-500">{label}</span>{isSaved && <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-700 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Guardado</span>}</div><div className="flex items-center gap-3"><div className="w-14 h-14 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">{src ? <img src={src} alt={label} className="w-full h-full object-contain" onError={() => setImgError(true)} /> : <ImageIcon className="w-5 h-5 text-slate-300" />}</div><div className="flex-1 space-y-2"><Input type="file" accept="image/*" className="h-8 text-xs rounded-xl border-slate-200" disabled={!!loading} onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; setImgError(false); const objectUrl = URL.createObjectURL(file); setLocalPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return objectUrl; }); onChange(file); }} /><div className="flex items-center gap-2">{loading && <span className="text-[11px] text-blue-600 flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Subiendo…</span>}{(url || localPreview) && !loading && (<Button type="button" variant="outline" className="h-7 text-xs rounded-xl border-red-200 text-red-600 hover:bg-red-50" onClick={() => { setLocalPreview(""); setImgError(false); onRemove?.(); }}>Quitar</Button>)}</div></div></div></div>);
};

const InstitutionSection = () => {
    const [settings, setSettings] = useState(null); const [uploadingKind, setUploadingKind] = useState(null); const [dept, setDept] = useState(""); const [prov, setProv] = useState(""); const [dist, setDist] = useState(""); const [deps, setDeps] = useState([]); const [provs, setProvs] = useState([]); const [dists, setDists] = useState([]);
    const load = useCallback(async () => { try { const s = await Institution.getSettings(); setSettings(s ?? {}); const d = await Ubigeo.deps(); setDeps(normalizeUbigeoList(d)); const sDept = String(s?.department || ""); const sProv = String(s?.province || ""); const sDist = String(s?.district || ""); if (sDept) { setDept(sDept); const pv = await Ubigeo.provs(sDept); setProvs(normalizeUbigeoList(pv)); if (sProv) { setProv(sProv); const ds = await Ubigeo.dists(sDept, sProv); setDists(normalizeUbigeoList(ds)); if (sDist) setDist(sDist); } } } catch (e) { toast.error(formatApiError(e)); } }, []);
    useEffect(() => { load(); }, [load]);
    const update = async () => { try { await Institution.updateSettings({ ...settings, department: dept, province: prov, district: dist }); toast.success("Parámetros guardados"); load(); } catch (e) { toast.error(formatApiError(e)); } };
    const removeMedia = async (kind) => { try { await Institution.removeMedia(kind); setSettings((s) => ({ ...s, ...(kind === "LOGO" ? { logo_url: "" } : {}), ...(kind === "SIGNATURE" ? { signature_url: "" } : {}), ...(kind === "SECRETARY_SIGNATURE" ? { secretary_signature_url: "" } : {}), ...(kind === "RESPONSIBLE_SIGNATURE" ? { responsible_signature_url: "" } : {}), })); await load(); toast.success(kind === "LOGO" ? "Logo eliminado" : kind === "SIGNATURE" ? "Firma del director eliminada" : kind === "SECRETARY_SIGNATURE" ? "Firma de secretaría eliminada" : "Firma del responsable eliminada"); } catch (e) { toast.error(formatApiError(e, "No se pudo eliminar")); } };
    const onUpload = async (kind, file) => { try { setUploadingKind(kind); const r = await Institution.uploadMedia(kind, file); const url = r?.absolute_url || r?.file_absolute_url || r?.url || r?.file_url || r?.data?.absolute_url || r?.data?.file_absolute_url || r?.data?.url || r?.data?.file_url; if (!url) throw new Error("Backend no devolvió URL del archivo"); setSettings((s) => ({ ...s, ...(kind === "LOGO" ? { logo_url: url } : {}), ...(kind === "SIGNATURE" ? { signature_url: url } : {}), ...(kind === "SECRETARY_SIGNATURE" ? { secretary_signature_url: url } : {}), ...(kind === "RESPONSIBLE_SIGNATURE" ? { responsible_signature_url: url } : {}), })); await load(); toast.success(kind === "LOGO" ? "Logo guardado" : kind === "SIGNATURE" ? "Firma del director guardada" : kind === "SECRETARY_SIGNATURE" ? "Firma de secretaría guardada" : "Firma del responsable guardada"); } catch (e) { toast.error(formatApiError(e, "No se pudo subir el archivo")); } finally { setUploadingKind(null); } };

    if (!settings) return <SectionCard icon={Settings} title="Parámetros de institución" desc="Configuración general, ubicación e identidad visual"><LoadingCenter text="Cargando configuración…" /></SectionCard>;

    return (
        <SectionCard icon={Settings} title="Parámetros de institución" desc="Configuración general, ubicación e identidad visual">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <div className="rounded-xl border border-slate-200 p-5 space-y-4"><p className="text-[10px] font-800 text-slate-400 uppercase tracking-widest">Identidad legal</p><div className="grid grid-cols-1 sm:grid-cols-3 gap-4"><div className="sm:col-span-2"><Field label="Nombre / Razón social *"><Input className="h-9 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-sm" value={settings.name || ""} onChange={(e) => setSettings({ ...settings, name: e.target.value })} placeholder="Institución Educativa…" /></Field></div><Field label="RUC / Identificador"><Input className="h-9 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-sm font-mono" value={settings.ruc || ""} onChange={(e) => setSettings({ ...settings, ruc: e.target.value })} placeholder="20123456789" /></Field></div></div>
                    <div className="rounded-xl border border-slate-200 p-5 space-y-4"><p className="text-[10px] font-800 text-slate-400 uppercase tracking-widest">Ubicación geográfica</p><Field label="Dirección fiscal"><div className="relative"><MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" /><Input className="h-9 rounded-xl border-slate-200 pl-9 text-sm bg-slate-50 focus:bg-white" value={settings.address || ""} onChange={(e) => setSettings({ ...settings, address: e.target.value })} placeholder="Av. Principal #123…" /></div></Field><div className="grid grid-cols-3 gap-3">{[{ label: "Departamento", value: dept, disabled: false, options: deps, onChange: async (v) => { setDept(v); setProv(""); setDist(""); setDists([]); const pv = await Ubigeo.provs(v); setProvs(normalizeUbigeoList(pv)); } }, { label: "Provincia", value: prov, disabled: !dept, options: provs, onChange: async (v) => { setProv(v); setDist(""); const ds = await Ubigeo.dists(dept, v); setDists(normalizeUbigeoList(ds)); } }, { label: "Distrito", value: dist, disabled: !dept || !prov, options: dists, onChange: setDist },].map(({ label, value, disabled, options, onChange: onChg }) => (<Field key={label} label={label}><Select value={value} onValueChange={onChg} disabled={disabled}><SelectTrigger className="h-9 rounded-xl border-slate-200 bg-slate-50 text-sm"><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent position="popper" className="max-h-60">{options.map((o) => <SelectItem key={o.code} value={o.code}>{o.name}</SelectItem>)}</SelectContent></Select></Field>))}</div></div>
                    <div className="rounded-xl border border-slate-200 p-5 space-y-4"><p className="text-[10px] font-800 text-slate-400 uppercase tracking-widest">Canales de contacto</p><div className="grid grid-cols-1 sm:grid-cols-3 gap-4"><Field label="Sitio web"><Input className="h-9 rounded-xl border-slate-200 bg-slate-50 text-sm" value={settings.website || ""} onChange={(e) => setSettings({ ...settings, website: e.target.value })} placeholder="www.ejemplo.edu.pe" /></Field><Field label="Correo"><Input className="h-9 rounded-xl border-slate-200 bg-slate-50 text-sm" value={settings.email || ""} onChange={(e) => setSettings({ ...settings, email: e.target.value })} placeholder="contacto@inst.com" /></Field><Field label="Teléfono"><Input className="h-9 rounded-xl border-slate-200 bg-slate-50 text-sm" value={settings.phone || ""} onChange={(e) => setSettings({ ...settings, phone: e.target.value })} placeholder="(01) 123-4567" /></Field></div></div>
                    <div className="flex justify-end"><Button className="h-9 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm font-700 shadow-sm gap-1.5" onClick={update}><Save className="w-4 h-4" /> Guardar cambios</Button></div>
                </div>
                <div className="rounded-xl border border-slate-200 p-5 space-y-5 bg-slate-50/50">
                    <p className="text-[10px] font-800 text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Image className="w-3.5 h-3.5" /> Activos digitales</p>
                    <p className="text-[11px] text-slate-400">Logo y firmas para documentos oficiales. PNG sin fondo recomendado.</p>
                    {[{ label: "Logo principal", kind: "LOGO", urlKey: "logo_url" }, { label: "Firma del director", kind: "SIGNATURE", urlKey: "signature_url" }, { label: "Firma de secretaría", kind: "SECRETARY_SIGNATURE", urlKey: "secretary_signature_url" }, { label: "Firma del responsable (Directora)", kind: "RESPONSIBLE_SIGNATURE", urlKey: "responsible_signature_url" },].map(({ label, kind, urlKey }) => (<div key={kind} className="p-3 bg-white border border-slate-200 rounded-xl border-dashed"><MediaUpload label={label} url={settings[urlKey]} loading={uploadingKind === kind} onChange={(f) => onUpload(kind, f)} onRemove={() => removeMedia(kind)} /></div>))}
                </div>
            </div>
        </SectionCard>
    );
};

// ===============================================================
// Importadores (sin cambios)
// ===============================================================
const IMPORT_JOB_STORAGE_KEY = "catalogs_import_job";
const TERMINAL_STATES = ["COMPLETED", "COMPLETED_WITH_ERRORS", "FAILED", "ERROR"];
const RUNNING_EQUIVALENTS = ["PENDING", "STARTED", "PROCESSING", "RUNNING", "IN_PROGRESS"];
function normalizeState(st) { const s = String(st || "").toUpperCase().trim(); if (!s) return ""; if (RUNNING_EQUIVALENTS.includes(s)) return "RUNNING"; return s; }

const ImportersTab = () => {
    const [type, setType] = useState("students"); const [file, setFile] = useState(null); const [job, setJob] = useState(null); const [status, setStatus] = useState(null); const [isImporting, setIsImporting] = useState(false); const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
    const pollRef = useRef(null); const intervalRef = useRef(2000); const lastProgressRef = useRef(-1); const sameProgressCountRef = useRef(0);
    const helpText = useMemo(() => { if (type === "students") return "Usa la plantilla de alumnos. Campos obligatorios: Num Documento, Nombres. Verifica Periodo (ej. 2026-I) y ubigeo."; if (type === "grades") return "Antes de importar notas: los alumnos deben existir. Verifica Periodo (ej. 2026-I) y que el documento exista."; if (type === "plans") return "El plan debe ser .xlsx y mantener el formato (AREAS/ASIGNATURAS, CRED.). Una hoja por carrera."; if (type === "traslados") return "Excel con datos del alumno + notas históricas. Cada fila = 1 nota. Un alumno puede tener múltiples filas (una por curso/período). Incluye niveles C1/C2/C3 (PI/I/P/L/D) y promedio."; return "Usa la plantilla oficial para evitar errores."; }, [type]);
    useEffect(() => { setFile(null); }, [type]);
    const clearPolling = useCallback(() => { if (pollRef.current) { clearTimeout(pollRef.current); pollRef.current = null; } }, []);
    const clearJobMemory = useCallback(() => { try { localStorage.removeItem(IMPORT_JOB_STORAGE_KEY); } catch (_) { } }, []);
    const saveJobMemory = useCallback((jobId, importType) => { try { localStorage.setItem(IMPORT_JOB_STORAGE_KEY, JSON.stringify({ jobId, type: importType, at: Date.now() })); } catch (_) { } }, []);
    const readJobMemory = useCallback(() => { try { const raw = localStorage.getItem(IMPORT_JOB_STORAGE_KEY); if (!raw) return null; const p = JSON.parse(raw); if (!p?.jobId) return null; return p; } catch (_) { return null; } }, []);
    const normalizedState = normalizeState(status?.state); const isProcessing = normalizedState ? !TERMINAL_STATES.includes(normalizedState) : (isImporting || !!job); const showProgressCard = isProcessing || !!status;
    const finish = useCallback((finalState, errCount = 0) => { clearPolling(); setIsImporting(false); clearJobMemory(); const fs = normalizeState(finalState); if (fs === "COMPLETED" && errCount === 0) toast.success("¡Importación completada con éxito!"); else if (fs === "COMPLETED_WITH_ERRORS" || (fs === "COMPLETED" && errCount > 0)) toast.warning(`Completado con observaciones (${errCount} errores).`); else toast.error("La importación terminó con error"); }, [clearJobMemory, clearPolling]);
    const computeNextInterval = useCallback((progress) => { const p = Number(progress); const last = lastProgressRef.current; if (!Number.isFinite(p)) return 2500; if (p !== last) { sameProgressCountRef.current = 0; lastProgressRef.current = p; return 2000; } sameProgressCountRef.current += 1; if (sameProgressCountRef.current >= 6) return 6000; if (sameProgressCountRef.current >= 3) return 4000; return 2500; }, []);
    const pollStatus = useCallback(async (jobId) => { clearPolling(); const tick = async () => { try { const st = await Imports.status(jobId); const stState = normalizeState(st?.state); setStatus({ ...st, state: stState }); setLastUpdatedAt(Date.now()); const errCount = Array.isArray(st?.errors) ? st.errors.length : 0; if (stState && TERMINAL_STATES.includes(stState)) { finish(stState, errCount); return; } intervalRef.current = computeNextInterval(Number(st?.progress ?? 0)); } catch (err) { console.error("Error al consultar estado:", err); intervalRef.current = 6000; } finally { pollRef.current = setTimeout(tick, intervalRef.current); } }; tick(); }, [clearPolling, computeNextInterval, finish]);
    useEffect(() => { const handler = (e) => { if (!isProcessing) return; e.preventDefault(); e.returnValue = ""; }; window.addEventListener("beforeunload", handler); return () => window.removeEventListener("beforeunload", handler); }, [isProcessing]);
    useEffect(() => { const saved = readJobMemory(); if (!saved) return; setType(saved.type || "students"); setJob(saved.jobId); setIsImporting(true); pollStatus(saved.jobId); }, [pollStatus, readJobMemory]);
    useEffect(() => { return () => clearPolling(); }, [clearPolling]);
    const start = async () => { if (!file) return toast.error("Selecciona un archivo primero"); if (isProcessing) return toast.info("Ya hay una importación en curso"); setIsImporting(true); setStatus(null); setJob(null); setLastUpdatedAt(null); intervalRef.current = 2000; lastProgressRef.current = -1; sameProgressCountRef.current = 0; try { const res = await Imports.start(type, file); const jobId = res?.job_id; if (!jobId) throw new Error("El servidor no devolvió job_id."); setJob(jobId); saveJobMemory(jobId, type); toast.success("Importación iniciada"); pollStatus(jobId); } catch (e) { const jobId = e?.response?.data?.job_id; if (jobId) { setJob(jobId); saveJobMemory(jobId, type); setIsImporting(true); toast.warning("Importación rechazada. Revisa los errores."); pollStatus(jobId); return; } toast.error(formatApiError(e, "No se pudo iniciar la importación")); setIsImporting(false); clearJobMemory(); } };
    const stopMonitoring = () => { clearPolling(); setIsImporting(false); setStatus(null); setJob(null); setLastUpdatedAt(null); clearJobMemory(); toast.info("Monitoreo detenido"); };
    const closeResults = () => { setStatus(null); setJob(null); setLastUpdatedAt(null); setFile(null); clearJobMemory(); toast.info("Resultados cerrados"); };
    const progress = safeNum(status?.progress, 0); const processed = safeNum(status?.processed, 0); const total = safeNum(status?.total, 0); const imported = safeNum(status?.imported, 0); const updated = safeNum(status?.updated, 0); const errors = useMemo(() => normalizeImportErrors(status?.errors), [status?.errors]); const stateLabel = normalizedState || (isProcessing ? "RUNNING" : "—");
    const stateChip = stateLabel === "COMPLETED" ? "s-done" : stateLabel === "COMPLETED_WITH_ERRORS" ? "s-warn" : stateLabel === "FAILED" || stateLabel === "ERROR" ? "s-error" : "s-running";

    return (
        <SectionCard icon={FileSpreadsheet} title="Importadores Excel / CSV" desc="Carga masiva de planes de estudio, alumnos y notas históricas">
            <div className="mb-5 flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl"><AlertCircle className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" /><div><p className="text-sm font-700 text-blue-800 mb-0.5">Instrucciones</p><p className="text-xs text-blue-700">{helpText}</p><p className="text-[11px] text-blue-500 mt-1">Consejo: descarga la plantilla y no cambies nombres de columnas.</p></div></div>
            {isProcessing && (<div className="mb-5 flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl"><AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" /><div><p className="text-sm font-700 text-amber-800">No cambie de pestaña ni cierre esta ventana</p><p className="text-xs text-amber-700 mt-0.5">La importación está en proceso.</p></div></div>)}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Tipo de importación"><Select value={type} onValueChange={setType} disabled={isProcessing}><SelectTrigger className="h-9 rounded-xl border-slate-200 text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="plans">Plan de estudios</SelectItem><SelectItem value="students">Alumnos</SelectItem><SelectItem value="grades">Notas históricas</SelectItem><SelectItem value="traslados">Traslados</SelectItem></SelectContent></Select></Field>
                <Field label="Descargar plantilla"><Button variant="outline" className="h-9 w-full rounded-xl border-slate-200 text-sm gap-1.5" disabled={isProcessing} onClick={async () => { try { const res = await Imports.downloadTemplate(type); const cd = res.headers?.["content-disposition"]; const filename = filenameFromContentDisposition(cd, `${type}_template.xlsx`); saveBlobAsFile(new Blob([res.data], { type: res.headers?.["content-type"] || "application/octet-stream" }), filename); toast.success("Plantilla descargada"); } catch (e) { toast.error(formatApiError(e, "No se pudo descargar la plantilla")); } }}><Download className="w-4 h-4" /> Descargar plantilla</Button></Field>
                <Field label="Archivo a importar"><Input type="file" accept={(type === "plans" || type === "egresados") ? ".xlsx" : ".xlsx,.csv"} className="h-9 text-xs rounded-xl border-slate-200" disabled={isProcessing} onChange={(e) => { const f = e.target.files?.[0] || null; setFile(f); if (!f) return; const name = (f.name || "").toLowerCase(); if ((type === "plans" || type === "egresados") && !name.endsWith(".xlsx")) { toast.error(`Para ${type === "plans" ? "Plan de estudios" : "Egresados"}, el archivo debe ser .xlsx`); setFile(null); return; } if (type !== "plans" && type !== "egresados" && !(name.endsWith(".xlsx") || name.endsWith(".csv"))) { toast.error("El archivo debe ser .xlsx o .csv"); setFile(null); } }} />{file && !isProcessing && <p className="text-[11px] text-slate-400 mt-1">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</p>}</Field>
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-2 mt-5">
                {isProcessing && <Button variant="outline" className="h-9 rounded-xl border-red-200 text-red-600 hover:bg-red-50 text-sm" onClick={stopMonitoring}>Dejar de monitorear</Button>}
                {!isProcessing && status && <Button variant="outline" className="h-9 rounded-xl text-sm" onClick={closeResults}>Cerrar resultados</Button>}
                <Button className="h-9 min-w-[180px] rounded-xl bg-blue-600 hover:bg-blue-700 text-sm font-700 shadow-sm gap-1.5" disabled={isProcessing || !file} onClick={start}>{isProcessing ? <><Loader2 className="w-4 h-4 animate-spin" /> Procesando…</> : <><UploadCloud className="w-4 h-4" /> Iniciar importación</>}</Button>
            </div>
            {showProgressCard && (<div className="mt-6 rounded-2xl border border-slate-200 overflow-hidden cfg-fade"><div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between"><p className="text-sm font-800 text-slate-700">Progreso de importación</p><span className={`text-[11px] font-800 px-2.5 py-1 rounded-full ${stateChip}`}>{stateLabel}</span></div><div className="p-5 space-y-4"><div><div className="flex justify-between text-xs mb-1.5"><span className="font-600 text-slate-600">Progreso</span><span className="font-700 text-slate-700">{Math.round(progress)}%</span></div><div className="cfg-progress-track"><div className="cfg-progress-bar" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} /></div><div className="flex justify-between text-[10px] text-slate-400 mt-1.5"><span>Job: {job || "—"}</span><span>{processed} / {total || "?"} registros</span></div><p className="text-[10px] text-slate-400 mt-1">Última actualización: {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString() : "—"} · Intervalo: {(intervalRef.current / 1000).toFixed(1)}s</p>{!!status?.message && <p className="text-xs text-slate-600 mt-2 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">{status.message}</p>}</div><div className="grid grid-cols-3 gap-3">{[{ label: "Importados", value: imported, cls: "bg-slate-50 border-slate-200 text-slate-800" }, { label: "Actualizados", value: updated, cls: "bg-slate-50 border-slate-200 text-slate-800" }, { label: "Errores", value: errors.length, cls: "bg-red-50 border-red-100 text-red-700" },].map(({ label, value, cls }) => (<div key={label} className={`p-3 rounded-xl border ${cls}`}><p className="text-[10px] font-700 uppercase tracking-wider opacity-70">{label}</p><p className="text-xl font-900 mt-0.5">{value}</p></div>))}</div>{(status?.summary?.note || status?.stats?.ranges?.length > 0) && (<div className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">{status?.summary?.note && <p>{status.summary.note}</p>}{Array.isArray(status?.stats?.ranges) && status.stats.ranges.length > 0 && (<p><span className="font-700">Rangos detectados:</span> {status.stats.ranges.map((r) => (Array.isArray(r) ? `${r[0]}-${r[1]}` : String(r))).join(" · ")}</p>)}</div>)}{errors.length > 0 && (<div className="p-4 bg-red-50 border border-red-200 rounded-xl"><p className="text-xs font-800 text-red-700 mb-3 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> Errores ({errors.length})</p><div className="overflow-x-auto max-h-52 overflow-y-auto"><table className="w-full text-xs"><thead className="text-red-800/60"><tr><th className="py-1.5 pr-3 text-left font-700">Fila</th><th className="py-1.5 pr-3 text-left font-700">Campo</th><th className="py-1.5 text-left font-700">Detalle</th></tr></thead><tbody className="divide-y divide-red-100">{errors.slice(0, 200).map((e, idx) => (<tr key={idx}><td className="py-1.5 pr-3 font-mono">{e.row}</td><td className="py-1.5 pr-3">{e.field}</td><td className="py-1.5">{e.message}</td></tr>))}</tbody></table></div>{errors.length > 200 && <p className="text-[10px] text-red-600/70 mt-2">Mostrando 200 de {errors.length} errores.</p>}</div>)}</div></div>)}
        </SectionCard>
    );
};

// ===============================================================
// Respaldo (sin cambios)
// ===============================================================
const BackupTab = () => {
    const [rows, setRows] = useState([]); const [loading, setLoading] = useState(true); const [scope, setScope] = useState("FULL");
    const load = useCallback(async () => { try { setLoading(true); const data = await Backup.list(); setRows(data?.items ?? data ?? []); } catch (e) { toast.error(formatApiError(e)); } finally { setLoading(false); } }, []);
    useEffect(() => { load(); }, [load]);
    const create = async () => { try { await Backup.create(scope); toast.success("Respaldo programado"); load(); } catch (e) { toast.error(formatApiError(e)); } };
    const removeBackup = async (b) => { try { await Backup.remove(b.id); toast.success("Backup eliminado"); load(); } catch (e) { toast.error(formatApiError(e)); } };
    const exportDataset = async (ds) => { try { const res = await Backup.exportDataset(ds); toast.success("Exportación generada"); await load(); const id = res?.backup_id; if (id) { const dr = await Backup.download(id); const cd = dr.headers?.["content-disposition"]; const filename = filenameFromContentDisposition(cd, `export_${ds.toLowerCase()}_${id}.zip`); saveBlobAsFile(new Blob([dr.data], { type: dr.headers?.["content-type"] || "application/octet-stream" }), filename); } } catch (e) { toast.error(formatApiError(e)); } };
    const downloadBackup = async (b) => { try { const res = await Backup.download(b.id); const cd = res.headers?.["content-disposition"]; const filename = filenameFromContentDisposition(cd, `backup_${b.id}.zip`); saveBlobAsFile(new Blob([res.data], { type: res.headers?.["content-type"] || "application/octet-stream" }), filename); toast.success("Backup descargado"); } catch (e) { toast.error(formatApiError(e)); } };
    return (<div className="space-y-5"><div className="grid grid-cols-1 lg:grid-cols-3 gap-5"><SectionCard icon={DatabaseZap} title="Nuevo respaldo" desc="Base de datos comprimida y archivos adjuntos"><div className="space-y-3"><Field label="Ámbito"><Select value={scope} onValueChange={setScope}><SelectTrigger className="h-9 rounded-xl border-slate-200 text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="FULL">Completo</SelectItem><SelectItem value="DATA_ONLY">Solo datos</SelectItem><SelectItem value="FILES_ONLY">Solo archivos</SelectItem></SelectContent></Select></Field><Button className="h-9 w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-sm font-700 shadow-sm gap-1.5" onClick={create}><DatabaseZap className="w-4 h-4" /> Crear respaldo</Button></div></SectionCard><div className="lg:col-span-2"><SectionCard icon={HardDriveDownload} title="Historial de respaldos" desc="Backups disponibles para descarga">{loading ? <LoadingCenter text="Cargando historial…" /> : (<div className="rounded-xl border border-slate-200 overflow-hidden"><table className="w-full border-collapse"><thead><tr>{["Fecha", "Ámbito", "Tamaño", "Acciones"].map((h) => <th key={h} className="cfg-th">{h}</th>)}</tr></thead><tbody>{rows.map((b) => (<tr key={b.id} className="cfg-tr"><td className="cfg-td text-xs">{b.created_at ? new Date(b.created_at).toLocaleString("es-PE") : "—"}</td><td className="cfg-td"><span className="text-[11px] font-700 bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{b.scope || "—"}</span></td><td className="cfg-td text-xs">{b.size ? `${(b.size / 1024 / 1024).toFixed(2)} MB` : "—"}</td><td className="cfg-td"><div className="flex items-center gap-1.5"><Button size="sm" variant="outline" className="h-7 px-3 text-xs rounded-xl border-slate-200 gap-1.5" onClick={() => downloadBackup(b)}><Download className="w-3.5 h-3.5" /> Descargar</Button><DeleteConfirm trigger={<Button size="sm" variant="outline" className="h-7 px-3 text-xs rounded-xl border-red-200 text-red-600 hover:bg-red-50 gap-1"><Trash2 className="w-3.5 h-3.5" /></Button>} title="¿Eliminar backup?" description={<>Se eliminará el ZIP y el registro. ID: <strong>{b.id}</strong></>} onConfirm={() => removeBackup(b)} /></div></td></tr>))}{rows.length === 0 && <tr><td colSpan={4} className="py-10"><EmptyState icon={HardDriveDownload} title="Sin respaldos" subtitle="Crea uno nuevo" /></td></tr>}</tbody></table></div>)}</SectionCard></div></div><SectionCard icon={Download} title="Exportar datasets" desc="Archivos CSV/ZIP de conjuntos puntuales de datos"><div className="flex flex-wrap gap-2">{[["STUDENTS", "Alumnos"], ["COURSES", "Cursos"], ["GRADES", "Notas"], ["CATALOGS", "Catálogos"]].map(([ds, label]) => (<Button key={ds} variant="outline" className="h-9 rounded-xl border-slate-200 text-sm gap-1.5 hover:bg-slate-50" onClick={() => exportDataset(ds)}><Download className="w-4 h-4 text-slate-400" /> {label}</Button>))}</div></SectionCard></div>);
};

// ===============================================================
// MAIN — ConfigCatalogsModule
// ===============================================================
const ALL_TABS = [
    { value: "catalogs", label: "Catálogos" },
    { value: "importers", label: "Importadores" },
    { value: "backup", label: "Respaldo" },
];

const ConfigCatalogsModule = () => {
    const { user, loading, hasAny } = useAuth();
    const [activeTab, setActiveTab] = useState("catalogs");
    const [mobileOpen, setMobileOpen] = useState(false);
    const canAccess = hasAny(["admin.catalogs.view", "admin.catalogs.manage"]);

    if (loading) return (<div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>);
    if (!user || !canAccess) return (<div className="flex flex-col items-center justify-center py-20 text-center"><div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4"><Settings className="w-7 h-7 text-slate-400" /></div><p className="text-lg font-800 text-slate-700">Acceso restringido</p><p className="text-sm text-slate-400 mt-1">No tienes permisos para administrar catálogos.</p></div>);
    const currentTab = ALL_TABS.find((t) => t.value === activeTab) ?? ALL_TABS[0];

    return (
        <>
            <InjectCatalogsStyles />
            <div className="cfg-root space-y-5 p-1">
                <div className="cfg-header rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="px-6 py-5 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25"><Settings className="w-6 h-6 text-white" /></div>
                            <div><h2 className="text-xl font-900 text-slate-800 tracking-tight">Configuración y Catálogos</h2><p className="text-xs text-slate-400 mt-0.5 font-500">Periodos, sedes, docentes, importadores y respaldo</p></div>
                        </div>
                        <span className="hidden sm:inline-flex items-center px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-[11px] font-800 text-blue-700 uppercase tracking-wider">Administración</span>
                    </div>
                </div>

                <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setMobileOpen(false); }}>
                    <div className="sm:hidden relative mb-4">
                        <button type="button" className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-700 text-slate-700 shadow-sm" onClick={() => setMobileOpen((v) => !v)}>
                            {currentTab.label}<ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${mobileOpen ? "rotate-180" : ""}`} />
                        </button>
                        {mobileOpen && (
                            <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden cfg-fade">
                                {ALL_TABS.map((t) => (
                                    <button key={t.value} type="button" className={`w-full text-left px-4 py-3 text-sm font-600 transition-colors ${activeTab === t.value ? "bg-blue-50 text-blue-700 font-700" : "text-slate-600 hover:bg-slate-50"}`}
                                        onClick={() => { setActiveTab(t.value); setMobileOpen(false); }}>{t.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <TabsList className="hidden sm:flex h-10 bg-slate-100 rounded-xl p-1 gap-1 w-fit">
                        {ALL_TABS.map((t) => (<TabsTrigger key={t.value} value={t.value} className="cfg-tab h-8 px-5 rounded-lg text-slate-500">{t.label}</TabsTrigger>))}
                    </TabsList>

                    <TabsContent value="catalogs" className="mt-5 space-y-5 pb-10">
                        <PeriodsSection />
                        <CampusesSection />
                        <TeachersSection />
                        <InstitutionSection />
                    </TabsContent>
                    <TabsContent value="importers" className="mt-5 pb-10"><ImportersTab /></TabsContent>
                    <TabsContent value="backup" className="mt-5 pb-10"><BackupTab /></TabsContent>
                </Tabs>
            </div>
        </>
    );
};

export default ConfigCatalogsModule;