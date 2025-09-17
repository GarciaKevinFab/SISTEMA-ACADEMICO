import React, { useEffect, useState, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../../../components/ui/select";
import { toast } from "sonner";
import { Team } from "../../../services/research.service";
import { Plus, Trash2, Save, Users } from "lucide-react";

export default function TeamTab({ projectId }) {
    const [rows, setRows] = useState([]);
    const [newRow, setNewRow] = useState({ full_name: "", role: "INVESTIGADOR", dedication_pct: 100, email: "", orcid: "" });

    const load = useCallback(async () => {
        try {
            const d = await Team.list(projectId);
            setRows(d?.items || d || []);
        } catch (e) { toast.error(e.message || "Error al cargar equipo"); }
    }, [projectId]);

    useEffect(() => { load(); }, [load]);

    const add = async () => {
        if (!newRow.full_name) return toast.error("Nombre requerido");
        try {
            await Team.add(projectId, { ...newRow, dedication_pct: Number(newRow.dedication_pct || 0) });
            setNewRow({ full_name: "", role: "INVESTIGADOR", dedication_pct: 100, email: "", orcid: "" });
            load();
            toast.success("Integrante agregado");
        } catch (e) { toast.error(e.message || "No se pudo agregar"); }
    };

    const remove = async (m) => {
        if (!confirm(`¿Eliminar a ${m.full_name}?`)) return;
        try { await Team.remove(projectId, m.id); load(); } catch (e) { toast.error(e.message || "No se pudo eliminar"); }
    };

    const update = async (m, patch) => {
        try { await Team.update(projectId, m.id, patch); load(); }
        catch (e) { toast.error(e.message || "No se pudo actualizar"); }
    };

    return (
        <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2"><Users className="h-4 w-4" />Equipo</h4>

            <Card>
                <CardHeader><CardTitle>Nuevo integrante</CardTitle></CardHeader>
                <CardContent className="grid md:grid-cols-5 gap-3">
                    <div className="md:col-span-2"><Label>Nombre completo</Label><Input value={newRow.full_name} onChange={e => setNewRow({ ...newRow, full_name: e.target.value })} /></div>
                    <div><Label>Rol</Label>
                        <Select value={newRow.role} onValueChange={v => setNewRow({ ...newRow, role: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="INVESTIGADOR">Investigador</SelectItem>
                                <SelectItem value="CO_INVESTIGADOR">Co-investigador</SelectItem>
                                <SelectItem value="TESISTA">Tesista</SelectItem>
                                <SelectItem value="ASISTENTE">Asistente</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div><Label>Dedicación %</Label><Input type="number" min="0" max="100" value={newRow.dedication_pct} onChange={e => setNewRow({ ...newRow, dedication_pct: e.target.value })} /></div>
                    <div><Label>Email</Label><Input value={newRow.email} onChange={e => setNewRow({ ...newRow, email: e.target.value })} /></div>
                    <div className="md:col-span-4"><Label>ORCID</Label><Input value={newRow.orcid} onChange={e => setNewRow({ ...newRow, orcid: e.target.value })} placeholder="0000-0000-0000-0000" /></div>
                    <div className="md:col-span-5 flex justify-end"><Button onClick={add}><Plus className="h-4 w-4 mr-2" />Agregar</Button></div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b"><tr>
                                <th className="p-2 text-left text-xs">Nombre</th><th className="p-2 text-left text-xs">Rol</th><th className="p-2 text-left text-xs">Dedicación</th><th className="p-2 text-left text-xs">Email</th><th className="p-2 text-left text-xs">ORCID</th><th className="p-2 text-right text-xs">Acciones</th>
                            </tr></thead>
                            <tbody className="divide-y">
                                {rows.map(r => (
                                    <tr key={r.id}>
                                        <td className="p-2">{r.full_name}</td>
                                        <td className="p-2">
                                            <Select value={r.role || "INVESTIGADOR"} onValueChange={v => update(r, { role: v })}>
                                                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="INVESTIGADOR">Investigador</SelectItem>
                                                    <SelectItem value="CO_INVESTIGADOR">Co-investigador</SelectItem>
                                                    <SelectItem value="TESISTA">Tesista</SelectItem>
                                                    <SelectItem value="ASISTENTE">Asistente</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </td>
                                        <td className="p-2 w-[110px]"><Input type="number" min="0" max="100" value={r.dedication_pct ?? 0} onChange={e => update(r, { dedication_pct: Number(e.target.value || 0) })} /></td>
                                        <td className="p-2">{r.email || "-"}</td>
                                        <td className="p-2">{r.orcid || "-"}</td>
                                        <td className="p-2 text-right">
                                            <Button variant="outline" size="sm" onClick={() => remove(r)}><Trash2 className="h-4 w-4" /></Button>
                                        </td>
                                    </tr>
                                ))}
                                {rows.length === 0 && <tr><td className="p-4 text-center text-gray-500" colSpan={6}>Sin integrantes</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
