import React, { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { toast } from "sonner";
import { ProcessesInbox, ProcessFiles } from "../../services/academic.service";
import { Upload, Save, Eye, Paperclip, Download } from "lucide-react";

export default function AcademicProcessesInbox() {
    const [list, setList] = useState([]);
    const [q, setQ] = useState("");
    const [detail, setDetail] = useState(null);
    const [file, setFile] = useState(null);
    const [statusForm, setStatusForm] = useState({ status: "APROBADO", note: "" });

    const load = async () => {
        try {
            const d = await ProcessesInbox.listAll({ q });
            const arr = Array.isArray(d?.processes) ? d.processes : (Array.isArray(d) ? d : []);
            setList(arr);
        } catch (e) { toast.error(e.message); }
    };
    useEffect(() => { load(); }, []);

    const openDetail = async (p) => {
        try {
            const d = await ProcessesInbox.get(p.id);
            setDetail(d?.process || d || p);
        } catch { setDetail(p); }
    };

    const updateStatus = async () => {
        try {
            await ProcessesInbox.setStatus(detail.id, statusForm);
            toast.success("Estado actualizado");
            setDetail(null); await load();
        } catch (e) { toast.error(e.message); }
    };

    const uploadFile = async () => {
        if (!file) return;
        try {
            await ProcessFiles.upload(detail.id, file, {});
            toast.success("Archivo adjuntado");
            const d = await ProcessesInbox.get(detail.id);
            setDetail(d?.process || d);
            setFile(null);
        } catch (e) { toast.error(e.message); }
    };

    return (
        <div className="space-y-4">
  <Card>
    <CardHeader>
      <CardTitle>Bandeja de procesos</CardTitle>
      <CardDescription>Revisión y resolución de solicitudes académicas</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="flex gap-2">
        <Input placeholder="Buscar por estudiante, tipo..." value={q} onChange={e => setQ(e.target.value)} />
        <Button onClick={load}>Buscar</Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          {/* Encabezado gris con texto negro */}
          <thead className="bg-gray-200">
            <tr>
              <th className="p-2 text-left text-black">Código</th>
              <th className="p-2 text-left text-black">Estudiante</th>
              <th className="p-2 text-left text-black">Tipo</th>
              <th className="p-2 text-left text-black">Período</th>
              <th className="p-2 text-left text-black">Estado</th>
              <th className="p-2 text-right text-black"></th>
            </tr>
          </thead>
          {/* Cuerpo blanco con texto negro */}
          <tbody className="bg-white">
            {(Array.isArray(list) ? list : []).map(p => (
              <tr key={p.id} className="border-t hover:bg-gray-50">
                <td className="p-2 text-black">{p.code}</td>
                <td className="p-2 text-black">{p.student_name} ({p.student_id})</td>
                <td className="p-2 text-black">{p.type}</td>
                <td className="p-2 text-black">{p.period}</td>
                <td className="p-2 text-black">
                  <Badge variant={p.status === "APROBADO" ? "default" : p.status === "RECHAZADO" ? "destructive" : "secondary"}>
                    {p.status}
                  </Badge>
                </td>
                <td className="p-2 text-right">
                  <Button variant="outline" size="sm" onClick={() => openDetail(p)}>
                    <Eye className="h-4 w-4 mr-1" />Abrir
                  </Button>
                </td>
              </tr>
            ))}
            {(Array.isArray(list) ? list : []).length === 0 && (
              <tr><td className="p-3 text-center text-gray-500" colSpan={6}>Sin procesos</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </CardContent>
  </Card>

            <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
                <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                    {detail && (
                        <>
                            <DialogHeader><DialogTitle>Proceso {detail.code}</DialogTitle></DialogHeader>
                            <div className="space-y-3">
                                <div><b>Estudiante:</b> {detail.student_name} ({detail.student_id})</div>
                                <div><b>Tipo:</b> {detail.type}</div>
                                <div><b>Período:</b> {detail.period}</div>
                                <div><b>Motivo:</b> {detail.reason}</div>

                                <Card>
                                    <CardHeader><CardTitle>Adjuntos</CardTitle></CardHeader>
                                    <CardContent className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Input type="file" onChange={e => setFile(e.target.files?.[0] || null)} />
                                            <Button onClick={uploadFile} disabled={!file}><Upload className="h-4 w-4 mr-2" />Adjuntar</Button>
                                        </div>
                                        <div className="space-y-2">
                                            {(Array.isArray(detail.files) ? detail.files : []).map(f => (
                                                <div key={f.id} className="flex items-center justify-between border rounded p-2">
                                                    <div className="flex items-center gap-2">
                                                        <Paperclip className="h-4 w-4" />
                                                        <a href={f.url} className="text-blue-600 underline" target="_blank" rel="noreferrer">{f.filename}</a>
                                                    </div>
                                                    <a className="text-sm underline" href={f.url} download>
                                                        <Download className="h-4 w-4 inline mr-1" />Descargar
                                                    </a>
                                                </div>
                                            ))}
                                            {!(detail.files && detail.files.length) && <div className="text-sm text-gray-500">Sin adjuntos</div>}
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader><CardTitle>Resolución</CardTitle></CardHeader>
                                    <CardContent className="grid md:grid-cols-3 gap-2">
                                        <div className="md:col-span-1">
                                            <Label>Nuevo estado</Label>
                                            <Select
                                                value={statusForm.status}
                                                onValueChange={v => setStatusForm(s => ({ ...s, status: v }))}
                                            >
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="APROBADO">Aprobado</SelectItem>
                                                    <SelectItem value="RECHAZADO">Rechazado</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="md:col-span-2">
                                            <Label>Nota</Label>
                                            <Input value={statusForm.note} onChange={e => setStatusForm(s => ({ ...s, note: e.target.value }))} />
                                        </div>
                                        <div className="md:col-span-3 flex justify-end">
                                            <Button onClick={updateStatus}><Save className="h-4 w-4 mr-2" />Guardar</Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
