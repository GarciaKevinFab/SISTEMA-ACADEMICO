// Mi Hoja de Vida — CV del docente (modelo institucional "Remisión del
// Currículum Vitae"): secciones II a VII con documento que acredita cada
// ítem, y emisión del CV completo (descriptivo + documentado) en PDF.
// Cada docente solo ve y edita SU hoja de vida (el backend la resuelve
// por el usuario autenticado).
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
    FileText, Plus, Pencil, Trash2, Loader2, Download, Paperclip,
    GraduationCap, Award, BookOpen, Briefcase, Mic, Newspaper, FlaskConical,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "../../components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../../components/ui/select";
import { api } from "../../lib/api";

/* Definición de secciones: columnas visibles y mapeo a los campos genéricos */
const SECCIONES = [
    {
        key: "FORMACION", icon: GraduationCap, titulo: "II. Formación profesional",
        subsecciones: [["PREGRADO", "Estudios de pregrado"], ["POSTGRADO", "Estudios de postgrado"]],
        campos: [
            ["titulo", "Nivel académico"], ["institucion", "Centro de estudios"],
            ["detalle", "Especialidad"], ["fecha_inicio", "Inicio"],
            ["fecha_fin", "Término"], ["lugar", "Lugar"],
        ],
    },
    {
        key: "ESPECIALIZACION", icon: Award, titulo: "III. Especialización y actualización",
        subsecciones: [
            ["SEGUNDA_ESP", "Especialización / 2da especialización"],
            ["DIPLOMADO", "Diplomado"], ["ACTIVIDAD", "Actividad formativa"],
            ["IDIOMA", "Idioma extranjero"], ["LENGUA", "Lengua originaria"],
            ["TIC", "Capacitación en TIC"],
        ],
        campos: [
            ["titulo", "Curso / Programa"], ["institucion", "Centro de estudios"],
            ["detalle", "Tema"], ["fecha_inicio", "Inicio"],
            ["fecha_fin", "Término"], ["duracion", "Horas"],
        ],
    },
    {
        key: "EXPERIENCIA", icon: Briefcase, titulo: "IV. Experiencia laboral",
        subsecciones: [
            ["EXP_SUPERIOR", "Docente en educación superior"],
            ["EXP_BASICA", "Docente en educación básica / ETP"],
            ["EXP_CONTINUA", "Formación docente en servicio / continua"],
        ],
        campos: [
            ["institucion", "Institución"], ["titulo", "Cargo"],
            ["detalle", "Descripción"], ["fecha_inicio", "Inicio"],
            ["fecha_fin", "Término"], ["duracion", "Tiempo en el cargo"],
        ],
    },
    {
        key: "EVENTO", icon: Mic, titulo: "V. Participación en eventos académicos",
        subsecciones: [],
        campos: [
            ["institucion", "Institución"], ["detalle", "Descripción"],
            ["fecha_inicio", "Fecha"], ["duracion", "Duración (horas)"],
        ],
    },
    {
        key: "PUBLICACION", icon: Newspaper, titulo: "Publicaciones",
        subsecciones: [],
        campos: [
            ["institucion", "Lugar y medio de publicación"], ["titulo", "Título"],
            ["detalle", "Participación"], ["fecha_inicio", "Fecha"],
        ],
    },
    {
        key: "MERITO", icon: Award, titulo: "VI. Méritos",
        subsecciones: [],
        campos: [
            ["institucion", "Institución / Empresa / Entidad"],
            ["detalle", "Descripción"], ["fecha_inicio", "Fecha de reconocimiento"],
        ],
    },
    {
        key: "INVESTIGACION", icon: FlaskConical, titulo: "VII. Investigación",
        subsecciones: [],
        campos: [
            ["institucion", "Lugar"], ["titulo", "Tema"],
            ["duracion", "Calidad"], ["fecha_inicio", "Año (fecha)"],
        ],
    },
];

const VACIO = {
    subseccion: "", institucion: "", titulo: "", detalle: "", lugar: "",
    duracion: "", fecha_inicio: "", fecha_fin: "",
};

export default function TeacherHojaVida() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [emit, setEmit] = useState(false);
    const [confirmo, setConfirmo] = useState(false);

    // Modal de alta/edición
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [seccion, setSeccion] = useState(null);   // def de SECCIONES
    const [editing, setEditing] = useState(null);   // item o null
    const [form, setForm] = useState(VACIO);
    const [archivo, setArchivo] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await api.get("/catalogs/teachers/me/cv");
            setItems(data?.items || []);
        } catch (e) {
            toast.error(e?.response?.data?.detail || "No se pudo cargar la hoja de vida");
        } finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const porSeccion = useMemo(() => {
        const m = {};
        for (const it of items) (m[it.seccion] = m[it.seccion] || []).push(it);
        return m;
    }, [items]);

    const abrir = (def, item = null) => {
        setSeccion(def);
        setEditing(item);
        setForm(item ? {
            subseccion: item.subseccion || "", institucion: item.institucion || "",
            titulo: item.titulo || "", detalle: item.detalle || "",
            lugar: item.lugar || "", duracion: item.duracion || "",
            fecha_inicio: item.fecha_inicio || "", fecha_fin: item.fecha_fin || "",
        } : { ...VACIO, subseccion: def.subsecciones[0]?.[0] || "" });
        setArchivo(null);
        setOpen(true);
    };

    const guardar = async () => {
        if (!seccion) return;
        setSaving(true);
        try {
            const fd = new FormData();
            fd.append("seccion", seccion.key);
            for (const [k, v] of Object.entries(form)) fd.append(k, v ?? "");
            if (archivo) fd.append("archivo", archivo);
            if (editing) await api.put(`/catalogs/teachers/me/cv/${editing.id}`, fd);
            else await api.post("/catalogs/teachers/me/cv", fd);
            toast.success(editing ? "Ítem actualizado" : "Ítem agregado");
            setOpen(false);
            load();
        } catch (e) {
            toast.error(e?.response?.data?.detail || "No se pudo guardar");
        } finally { setSaving(false); }
    };

    const borrar = async (item) => {
        if (!window.confirm("¿Eliminar este ítem de tu hoja de vida?")) return;
        try {
            await api.delete(`/catalogs/teachers/me/cv/${item.id}`);
            toast.success("Ítem eliminado");
            load();
        } catch (e) {
            toast.error(e?.response?.data?.detail || "No se pudo eliminar");
        }
    };

    const emitir = async () => {
        if (!confirmo) {
            toast.error("Confirma primero que la información registrada está completa y correcta");
            return;
        }
        setEmit(true);
        try {
            const res = await api.get("/catalogs/teachers/me/cv/pdf",
                { responseType: "blob" });
            const blob = res?.data instanceof Blob ? res.data : new Blob([res.data]);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = "hoja-de-vida.pdf";
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => window.URL.revokeObjectURL(url), 60000);
            toast.success("Hoja de Vida emitida (descriptivo + documentado)");
        } catch (e) {
            let msg = "No se pudo emitir el CV";
            try {
                if (e?.response?.data instanceof Blob) {
                    msg = JSON.parse(await e.response.data.text())?.detail || msg;
                }
            } catch { /* ignore */ }
            toast.error(msg);
        } finally { setEmit(false); }
    };

    const SUBS = seccion ? Object.fromEntries(seccion.subsecciones) : {};

    return (
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-100 grid place-items-center">
                        <FileText size={18} className="text-blue-600" />
                    </div>
                    <div>
                        <h1 className="text-lg font-extrabold text-slate-800">Mi Hoja de Vida</h1>
                        <p className="text-xs text-slate-400">
                            Registra cada ítem con su documento que lo acredita. El CV se
                            emite primero descriptivo y a continuación documentado.
                        </p>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                    <label className="flex items-center gap-2 text-[11px] text-slate-600 cursor-pointer select-none">
                        <input type="checkbox" checked={confirmo}
                            onChange={(e) => setConfirmo(e.target.checked)} />
                        Confirmo que la información registrada está completa y correcta
                    </label>
                    <Button onClick={emitir} disabled={emit}
                        className="gap-1.5 bg-blue-600 hover:bg-blue-700">
                        {emit ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                        Emitir CV completo (PDF)
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
                    <Loader2 className="h-5 w-5 animate-spin" /> Cargando hoja de vida…
                </div>
            ) : SECCIONES.map((def) => {
                const filas = porSeccion[def.key] || [];
                const Icon = def.icon;
                return (
                    <div key={def.key} className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/60">
                            <div className="flex items-center gap-2.5">
                                <Icon size={15} className="text-slate-500" />
                                <h3 className="font-bold text-slate-700 text-sm">{def.titulo}</h3>
                                <span className="text-[10px] text-slate-400">({filas.length})</span>
                            </div>
                            <Button size="sm" variant="outline" className="gap-1 h-8"
                                onClick={() => abrir(def)}>
                                <Plus size={13} /> Agregar
                            </Button>
                        </div>
                        {filas.length === 0 ? (
                            <p className="px-5 py-4 text-xs text-slate-400">Sin registros.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="text-slate-500 bg-slate-50">
                                            <th className="px-3 py-2">N°</th>
                                            {def.campos.map(([k, lbl]) => (
                                                <th key={k} className="px-3 py-2 text-left">{lbl}</th>
                                            ))}
                                            <th className="px-3 py-2">Archivo</th>
                                            <th className="px-3 py-2"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filas.map((it, i) => (
                                            <tr key={it.id}>
                                                <td className="px-3 py-2 text-center text-slate-400">{i + 1}</td>
                                                {def.campos.map(([k]) => (
                                                    <td key={k} className="px-3 py-2 text-slate-700">
                                                        {(k === "subseccion"
                                                            ? it.subseccion
                                                            : it[k]) || "—"}
                                                    </td>
                                                ))}
                                                <td className="px-3 py-2 text-center">
                                                    {it.archivo_url ? (
                                                        <a href={it.archivo_url} target="_blank" rel="noreferrer"
                                                            title={it.archivo_nombre}
                                                            className="inline-flex text-blue-600 hover:text-blue-800">
                                                            <Paperclip size={14} />
                                                        </a>
                                                    ) : <span className="text-slate-300">—</span>}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <div className="flex items-center gap-1 justify-end">
                                                        <button onClick={() => abrir(def, it)}
                                                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded">
                                                            <Pencil size={13} />
                                                        </button>
                                                        <button onClick={() => borrar(it)}
                                                            className="p-1 text-rose-500 hover:bg-rose-50 rounded">
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                );
            })}

            {/* ── Modal alta / edición ── */}
            <Dialog open={open} onOpenChange={(v) => { if (!v) setOpen(false); }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="text-base font-extrabold">
                            {editing ? "Editar ítem" : "Agregar ítem"} — {seccion?.titulo}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                        {seccion?.subsecciones?.length > 0 && (
                            <div>
                                <Label className="text-[10px] font-bold uppercase">Tipo</Label>
                                <Select value={form.subseccion}
                                    onValueChange={(v) => setForm((f) => ({ ...f, subseccion: v }))}>
                                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {seccion.subsecciones.map(([v, lbl]) => (
                                            <SelectItem key={v} value={v}>{lbl}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        {seccion?.campos.map(([k, lbl]) => (
                            <div key={k}>
                                <Label className="text-[10px] font-bold uppercase">{lbl}</Label>
                                <Input
                                    type={k.startsWith("fecha") ? "date" : "text"}
                                    value={form[k] ?? ""}
                                    onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                                    className="h-9"
                                />
                            </div>
                        ))}
                        <div>
                            <Label className="text-[10px] font-bold uppercase">
                                Documento que acredita (PDF o imagen, máx. 10 MB)
                            </Label>
                            <input type="file" accept=".pdf,.jpg,.jpeg,.png"
                                onChange={(e) => setArchivo(e.target.files?.[0] || null)}
                                className="block w-full text-xs text-slate-500 mt-1
                                           file:mr-3 file:px-3 file:py-1.5 file:rounded-md
                                           file:border-0 file:bg-blue-50 file:text-blue-700" />
                            {editing?.archivo_nombre && !archivo && (
                                <p className="text-[10px] text-slate-400 mt-1">
                                    Actual: {editing.archivo_nombre} (subir otro lo reemplaza)
                                </p>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                        <Button onClick={guardar} disabled={saving}
                            className="bg-blue-600 hover:bg-blue-700 gap-1.5">
                            {saving && <Loader2 size={14} className="animate-spin" />}
                            Guardar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
