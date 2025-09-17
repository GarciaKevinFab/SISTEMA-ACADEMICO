import React, { useEffect, useState, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../../../components/ui/select";
import { toast } from "sonner";
import { Publications } from "../../../services/research.service";
import { Plus, Trash2, Save, Link2, BookOpen } from "lucide-react";

export default function PublicationsTab({ projectId }) {
    const [rows, setRows] = useState([]);
    const [newRow, setNewRow] = useState({ type: "ARTICLE", title: "", journal: "", year: new Date().getFullYear(), doi: "", link: "", indexed: false });

    const load = useCallback(async () => {
        try {
            const d = await Publications.list(projectId);
            setRows(d?.items || d || []);
        } catch (e) { toast.error(e.message || "Error al cargar publicaciones"); }
    }, [projectId]);

    useEffect(() => { load(); }, [load]);

    const add = async () => {
        if (!newRow.title) return toast.error("Título requerido");
        try { await Publications.create(projectId, { ...newRow, year: Number(newRow.year || 0) }); setNewRow({ type: "ARTICLE", title: "", journal: "", year: new Date().getFullYear(), doi: "", link: "", indexed: false }); load(); toast.success("Producto agregado"); }
        catch (e) { toast.error(e.message || "No se pudo agregar"); }
    };

    const update = async (r, patch) => {
        try { await Publications.update(projectId, r.id, patch); load(); }
        catch (e) { toast.error(e.message || "No se pudo actualizar"); }
    };

    const remove = async (r) => {
        if (!confirm(`¿Eliminar "${r.title}"?`)) return;
        try { await Publications.remove(projectId, r.id); load(); }
        catch (e) { toast.error(e.message || "No se pudo eliminar"); }
    };

    return (
        <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2"><BookOpen className="h-4 w-4" />Productos de investigación / Publicaciones</h4>

            <Card>
                <CardHeader><CardTitle>Nuevo producto</CardTitle></CardHeader>
                <CardContent className="grid md:grid-cols-6 gap-3">
                    <div>
                        <Label>Tipo</Label>
                        <Select value={newRow.type} onValueChange={v => setNewRow({ ...newRow, type: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ARTICLE">Artículo</SelectItem>
                                <SelectItem value="CONFERENCE">Conferencia</SelectItem>
                                <SelectItem value="BOOK">Libro</SelectItem>
                                <SelectItem value="CHAPTER">Capítulo</SelectItem>
                                <SelectItem value="DATASET">Dataset</SelectItem>
                                <SelectItem value="SOFTWARE">Software</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="md:col-span-2"><Label>Título</Label><Input value={newRow.title} onChange={e => setNewRow({ ...newRow, title: e.target.value })} /></div>
                    <div><Label>Revista/Evento</Label><Input value={newRow.journal} onChange={e => setNewRow({ ...newRow, journal: e.target.value })} /></div>
                    <div><Label>Año</Label><Input type="number" value={newRow.year} onChange={e => setNewRow({ ...newRow, year: e.target.value })} /></div>
                    <div><Label>DOI</Label><Input value={newRow.doi} onChange={e => setNewRow({ ...newRow, doi: e.target.value })} /></div>
                    <div className="md:col-span-2"><Label>Enlace</Label><Input value={newRow.link} onChange={e => setNewRow({ ...newRow, link: e.target.value })} /></div>
                    <div>
                        <Label>Indexado</Label>
                        <Select value={String(newRow.indexed)} onValueChange={v => setNewRow({ ...newRow, indexed: v === "true" })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="true">Sí</SelectItem><SelectItem value="false">No</SelectItem></SelectContent>
                        </Select>
                    </div>
                    <div className="md:col-span-6 flex justify-end"><Button onClick={add}><Plus className="h-4 w-4 mr-2" />Agregar</Button></div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b"><tr>
                                <th className="p-2 text-left text-xs">Tipo</th><th className="p-2 text-left text-xs">Título</th><th className="p-2 text-left text-xs">Revista/Evento</th><th className="p-2 text-left text-xs">Año</th><th className="p-2 text-left text-xs">DOI</th><th className="p-2 text-left text-xs">Enlace</th><th className="p-2 text-left text-xs">Indexado</th><th className="p-2 text-right text-xs">Acciones</th>
                            </tr></thead>
                            <tbody className="divide-y">
                                {rows.map(r => (
                                    <tr key={r.id}>
                                        <td className="p-2">{r.type}</td>
                                        <td className="p-2">{r.title}</td>
                                        <td className="p-2">{r.journal || "-"}</td>
                                        <td className="p-2">{r.year || "-"}</td>
                                        <td className="p-2">{r.doi || "-"}</td>
                                        <td className="p-2 text-xs">{r.link ? <a className="text-blue-600 underline inline-flex items-center" href={r.link} target="_blank" rel="noreferrer"><Link2 className="h-4 w-4 mr-1" />Abrir</a> : "-"}</td>
                                        <td className="p-2">{r.indexed ? "Sí" : "No"}</td>
                                        <td className="p-2 text-right"><Button variant="outline" size="sm" onClick={() => remove(r)}><Trash2 className="h-4 w-4" /></Button></td>
                                    </tr>
                                ))}
                                {rows.length === 0 && <tr><td className="p-4 text-center text-gray-500" colSpan={8}>Sin productos</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
