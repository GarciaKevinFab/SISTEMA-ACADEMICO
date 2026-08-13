// Sesiones de aprendizaje del docente: un PDF por semana/día de clase,
// por cada curso que dicta. La fecha debe ser día de dictado de la sección
// y estar dentro de la vigencia del período (lo valida el servidor).
import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
    CalendarDays, Plus, Pencil, Trash2, Loader2, Paperclip, BookOpen,
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
import { Teacher } from "../../services/academic.service";
import { api } from "../../lib/api";

const DIAS = { 1: "Lun", 2: "Mar", 3: "Mié", 4: "Jue", 5: "Vie", 6: "Sáb", 7: "Dom" };
const VACIO = { semana: "", fecha: "", tema: "" };

export default function TeacherSesiones() {
    const [secciones, setSecciones] = useState([]);
    const [sectionId, setSectionId] = useState("");
    const [info, setInfo] = useState(null);      // respuesta del GET (sesiones + horario)
    const [loading, setLoading] = useState(false);

    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(VACIO);
    const [archivo, setArchivo] = useState(null);

    useEffect(() => {
        (async () => {
            try {
                const data = await Teacher.sectionsMe();
                const secs = data?.sections || data?.items || data || [];
                setSecciones(Array.isArray(secs) ? secs : []);
                if (secs?.length === 1) setSectionId(String(secs[0].id));
            } catch { toast.error("No se pudieron cargar tus cursos"); }
        })();
    }, []);

    const load = useCallback(async () => {
        if (!sectionId) { setInfo(null); return; }
        setLoading(true);
        try {
            const { data } = await api.get(`/academic/sections/${sectionId}/sesiones`);
            setInfo(data);
        } catch (e) {
            setInfo(null);
            toast.error(e?.response?.data?.detail || "No se pudieron cargar las sesiones");
        } finally { setLoading(false); }
    }, [sectionId]);
    useEffect(() => { load(); }, [load]);

    const abrir = (item = null) => {
        setEditing(item);
        setForm(item ? { semana: item.semana ?? "", fecha: item.fecha, tema: item.tema }
            : { ...VACIO });
        setArchivo(null);
        setOpen(true);
    };

    const guardar = async () => {
        setSaving(true);
        try {
            const fd = new FormData();
            fd.append("fecha", form.fecha);
            fd.append("tema", form.tema);
            fd.append("semana", form.semana ?? "");
            if (archivo) fd.append("archivo", archivo);
            if (editing) await api.put(`/academic/sesiones/${editing.id}`, fd);
            else await api.post(`/academic/sections/${sectionId}/sesiones`, fd);
            toast.success(editing ? "Sesión actualizada" : "Sesión subida");
            setOpen(false);
            load();
        } catch (e) {
            toast.error(e?.response?.data?.detail || "No se pudo guardar la sesión");
        } finally { setSaving(false); }
    };

    const borrar = async (item) => {
        if (!window.confirm("¿Eliminar esta sesión de aprendizaje?")) return;
        try {
            await api.delete(`/academic/sesiones/${item.id}`);
            toast.success("Sesión eliminada");
            load();
        } catch (e) {
            toast.error(e?.response?.data?.detail || "No se pudo eliminar");
        }
    };

    const dias = (info?.schedule_weekdays || []).map((w) => DIAS[w]).join(" · ");
    const sesiones = info?.sesiones || [];

    return (
        <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm p-5">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-teal-50 border border-teal-100 grid place-items-center">
                            <CalendarDays size={18} className="text-teal-600" />
                        </div>
                        <div>
                            <h2 className="text-base font-extrabold text-slate-800">Sesiones de Aprendizaje</h2>
                            <p className="text-xs text-slate-400">
                                Sube el PDF de cada sesión según el curso que dictas y sus días de clase
                            </p>
                        </div>
                    </div>
                    <div className="flex items-end gap-2">
                        <div className="min-w-[290px]">
                            <Label className="text-[10px] font-bold uppercase">Curso que dictas</Label>
                            <Select value={sectionId} onValueChange={setSectionId}>
                                <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Elige tu curso…" />
                                </SelectTrigger>
                                <SelectContent>
                                    {secciones.map((s) => (
                                        <SelectItem key={s.id} value={String(s.id)}>
                                            {(s.course_name || s.name || `Sección ${s.id}`)}
                                            {s.label ? ` — ${s.label}` : ""} ({s.period})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button onClick={() => abrir()} disabled={!sectionId}
                            className="gap-1.5 bg-teal-600 hover:bg-teal-700 h-9">
                            <Plus size={15} /> Nueva sesión
                        </Button>
                    </div>
                </div>
                {info && (
                    <p className="text-[11px] text-slate-500 mt-3">
                        <BookOpen size={12} className="inline mr-1 -mt-0.5" />
                        <b>Días de clase:</b> {dias || "lunes a viernes (sin horario configurado)"}
                        {info.period_start && info.period_end && (
                            <> · <b>Vigencia {info.period}:</b>{" "}
                                {info.period_start.split("-").reverse().join("/")} al{" "}
                                {info.period_end.split("-").reverse().join("/")}</>
                        )}
                        {" — solo se aceptan sesiones en esos días."}
                    </p>
                )}
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                {!sectionId ? (
                    <p className="px-5 py-8 text-sm text-slate-400 text-center">
                        Elige uno de tus cursos para ver y subir sus sesiones.
                    </p>
                ) : loading ? (
                    <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
                        <Loader2 className="h-5 w-5 animate-spin" /> Cargando sesiones…
                    </div>
                ) : sesiones.length === 0 ? (
                    <p className="px-5 py-8 text-sm text-slate-400 text-center">
                        Aún no subiste sesiones para este curso.
                    </p>
                ) : (
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-slate-50 text-slate-500">
                                <th className="px-3 py-2.5">N°</th>
                                <th className="px-3 py-2.5">Semana</th>
                                <th className="px-3 py-2.5">Fecha</th>
                                <th className="px-3 py-2.5 text-left">Tema / sesión</th>
                                <th className="px-3 py-2.5">Archivo</th>
                                <th className="px-3 py-2.5">Subido</th>
                                <th className="px-3 py-2.5"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {sesiones.map((s, i) => (
                                <tr key={s.id} className="hover:bg-slate-50/60">
                                    <td className="px-3 py-2 text-center text-slate-400">{i + 1}</td>
                                    <td className="px-3 py-2 text-center">
                                        {s.semana ? `Semana ${s.semana}` : "—"}
                                    </td>
                                    <td className="px-3 py-2 text-center whitespace-nowrap">
                                        {s.fecha.split("-").reverse().join("/")}
                                    </td>
                                    <td className="px-3 py-2 font-semibold text-slate-700">{s.tema}</td>
                                    <td className="px-3 py-2 text-center">
                                        {s.archivo_url ? (
                                            <a href={s.archivo_url} target="_blank" rel="noreferrer"
                                                title={s.archivo_nombre}
                                                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold">
                                                <Paperclip size={13} /> Ver PDF
                                            </a>
                                        ) : "—"}
                                    </td>
                                    <td className="px-3 py-2 text-center text-slate-400 whitespace-nowrap">{s.subido}</td>
                                    <td className="px-3 py-2">
                                        <div className="flex items-center gap-1 justify-end">
                                            <button onClick={() => abrir(s)}
                                                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded">
                                                <Pencil size={13} />
                                            </button>
                                            <button onClick={() => borrar(s)}
                                                className="p-1 text-rose-500 hover:bg-rose-50 rounded">
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <Dialog open={open} onOpenChange={(v) => { if (!v) setOpen(false); }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-base font-extrabold">
                            {editing ? "Editar sesión" : "Nueva sesión de aprendizaje"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-[10px] font-bold uppercase">Semana (opcional)</Label>
                                <Input type="number" min="1" max="52" value={form.semana}
                                    onChange={(e) => setForm((f) => ({ ...f, semana: e.target.value }))}
                                    className="h-9" placeholder="1" />
                            </div>
                            <div>
                                <Label className="text-[10px] font-bold uppercase">Fecha de la clase</Label>
                                <Input type="date" value={form.fecha}
                                    onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
                                    className="h-9" />
                            </div>
                        </div>
                        <div>
                            <Label className="text-[10px] font-bold uppercase">Tema / sesión</Label>
                            <Input value={form.tema}
                                onChange={(e) => setForm((f) => ({ ...f, tema: e.target.value }))}
                                className="h-9" placeholder="Ej.: Habilidades blandas" />
                        </div>
                        <div>
                            <Label className="text-[10px] font-bold uppercase">
                                PDF de la sesión (máx. 15 MB)
                            </Label>
                            <input type="file" accept=".pdf"
                                onChange={(e) => setArchivo(e.target.files?.[0] || null)}
                                className="block w-full text-xs text-slate-500 mt-1
                                           file:mr-3 file:px-3 file:py-1.5 file:rounded-md
                                           file:border-0 file:bg-teal-50 file:text-teal-700" />
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
                            className="bg-teal-600 hover:bg-teal-700 gap-1.5">
                            {saving && <Loader2 size={14} className="animate-spin" />}
                            Guardar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
