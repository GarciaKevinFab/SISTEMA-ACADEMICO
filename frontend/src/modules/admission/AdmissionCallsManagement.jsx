import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { Plus, Eye, Edit, Download, Calendar } from "lucide-react";
import { toast } from "sonner";
import { listAdmissionCalls, createAdmissionCall, listCareers } from "../../services/admission.service";

export default function AdmissionCallsManagement() {
    const [admissionCalls, setAdmissionCalls] = useState([]);
    const [careers, setCareers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({
        name: "",
        description: "",
        academic_year: new Date().getFullYear(),
        academic_period: "I",
        registration_start: "",
        registration_end: "",
        exam_date: "",
        results_date: "",
        application_fee: 0,
        max_applications_per_career: 1,
        available_careers: [],
        career_vacancies: {},
        minimum_age: 16,
        maximum_age: 35,
        required_documents: ["BIRTH_CERTIFICATE", "STUDY_CERTIFICATE", "PHOTO", "DNI_COPY"],
    });

    const load = async () => {
        try {
            const [calls, careersRes] = await Promise.all([listAdmissionCalls(), listCareers()]);
            setAdmissionCalls(calls?.admission_calls || calls?.calls || []);
            setCareers(careersRes?.careers || []);
        } catch (e) {
            toast.error("Error al cargar convocatorias");
        } finally { setLoading(false); }
    };
    useEffect(() => { load(); }, []);

    const toggleCareer = (careerId, checked) => {
        if (checked) {
            setForm(f => ({
                ...f,
                available_careers: [...f.available_careers, careerId],
                career_vacancies: { ...f.career_vacancies, [careerId]: f.career_vacancies[careerId] ?? 30 }
            }));
        } else {
            setForm(f => {
                const next = { ...f.career_vacancies };
                delete next[careerId];
                return {
                    ...f,
                    available_careers: f.available_careers.filter(id => id !== careerId),
                    career_vacancies: next
                };
            });
        }
    };

    const setVacancy = (careerId, val) => {
        setForm(f => ({ ...f, career_vacancies: { ...f.career_vacancies, [careerId]: parseInt(val || "0", 10) } }));
    };

    const submit = async (e) => {
        e.preventDefault();
        try {
            await createAdmissionCall(form);
            toast.success("Convocatoria creada");
            setOpen(false);
            setForm({
                name: "", description: "",
                academic_year: new Date().getFullYear(),
                academic_period: "I",
                registration_start: "", registration_end: "",
                exam_date: "", results_date: "",
                application_fee: 0, max_applications_per_career: 1,
                available_careers: [], career_vacancies: {},
                minimum_age: 16, maximum_age: 35,
                required_documents: ["BIRTH_CERTIFICATE", "STUDY_CERTIFICATE", "PHOTO", "DNI_COPY"]
            });
            load();
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Error al crear convocatoria");
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">Gestión de Convocatorias</h2>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-blue-600 hover:bg-blue-700">
                            <Plus className="h-4 w-4 mr-2" /> Nueva Convocatoria
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Crear Nueva Convocatoria</DialogTitle>
                            <DialogDescription>Configure los parámetros del proceso</DialogDescription>
                        </DialogHeader>

                        <form onSubmit={submit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Nombre *</Label>
                                    <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                                </div>
                                <div>
                                    <Label>Año Académico *</Label>
                                    <Input type="number" min="2024" max="2035"
                                        value={form.academic_year}
                                        onChange={e => setForm({ ...form, academic_year: parseInt(e.target.value || "0", 10) })}
                                        required />
                                </div>
                            </div>

                            <div>
                                <Label>Descripción</Label>
                                <Textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <Label>Período *</Label>
                                    <Select value={form.academic_period} onValueChange={v => setForm({ ...form, academic_period: v })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="I">I</SelectItem>
                                            <SelectItem value="II">II</SelectItem>
                                            <SelectItem value="III">III</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Costo (S/.)</Label>
                                    <Input type="number" min="0" step="0.01"
                                        value={form.application_fee}
                                        onChange={e => setForm({ ...form, application_fee: parseFloat(e.target.value || "0") })} />
                                </div>
                                <div>
                                    <Label>Máx. carreras por postulante</Label>
                                    <Input type="number" min="1" max="3"
                                        value={form.max_applications_per_career}
                                        onChange={e => setForm({ ...form, max_applications_per_career: parseInt(e.target.value || "1", 10) })} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Inicio de Inscripciones *</Label>
                                    <Input type="datetime-local" value={form.registration_start}
                                        onChange={e => setForm({ ...form, registration_start: e.target.value })} required />
                                </div>
                                <div>
                                    <Label>Fin de Inscripciones *</Label>
                                    <Input type="datetime-local" value={form.registration_end}
                                        onChange={e => setForm({ ...form, registration_end: e.target.value })} required />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Fecha de Examen</Label>
                                    <Input type="datetime-local" value={form.exam_date}
                                        onChange={e => setForm({ ...form, exam_date: e.target.value })} />
                                </div>
                                <div>
                                    <Label>Fecha de Resultados</Label>
                                    <Input type="datetime-local" value={form.results_date}
                                        onChange={e => setForm({ ...form, results_date: e.target.value })} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Edad Mínima</Label>
                                    <Input type="number" min="15" max="30"
                                        value={form.minimum_age}
                                        onChange={e => setForm({ ...form, minimum_age: parseInt(e.target.value || "0", 10) })} />
                                </div>
                                <div>
                                    <Label>Edad Máxima</Label>
                                    <Input type="number" min="20" max="50"
                                        value={form.maximum_age}
                                        onChange={e => setForm({ ...form, maximum_age: parseInt(e.target.value || "0", 10) })} />
                                </div>
                            </div>

                            <div>
                                <Label>Carreras y Vacantes</Label>
                                <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-4">
                                    {careers.map((c) => (
                                        <div key={c.id} className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    id={`career_${c.id}`}
                                                    checked={form.available_careers.includes(c.id)}
                                                    onChange={(e) => toggleCareer(c.id, e.target.checked)}
                                                />
                                                <Label htmlFor={`career_${c.id}`} className="text-sm">{c.name}</Label>
                                            </div>
                                            {form.available_careers.includes(c.id) && (
                                                <Input
                                                    type="number" min="1" max="200"
                                                    className="w-24"
                                                    value={form.career_vacancies[c.id] ?? 30}
                                                    onChange={(e) => setVacancy(c.id, e.target.value)}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex justify-end gap-2">
                                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                                <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Crear Convocatoria</Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Lista */}
            <div className="grid gap-6">
                {admissionCalls.length === 0 ? (
                    <div className="text-center py-12">
                        <Calendar className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                        <h3 className="text-xl font-medium text-gray-900 mb-2">No hay convocatorias</h3>
                        <p className="text-gray-500 mb-4">Aún no se han creado convocatorias de admisión.</p>
                        <Button onClick={() => setOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                            <Plus className="h-4 w-4 mr-2" /> Crear Primera Convocatoria
                        </Button>
                    </div>
                ) : (
                    admissionCalls.map((call) => (
                        <Card key={call.id} className="hover:shadow-lg transition-shadow">
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-xl">{call.name}</CardTitle>
                                        <CardDescription>Año {call.academic_year} · Período {call.academic_period}</CardDescription>
                                    </div>
                                    <Badge variant={call.status === "OPEN" ? "default" : "secondary"}>
                                        {call.status === "OPEN" ? "Abierta" : call.status}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div>
                                        <h4 className="font-semibold mb-2">Cronograma</h4>
                                        <div className="space-y-1 text-sm">
                                            <div className="flex justify-between">
                                                <span>Inscripciones:</span>
                                                <span>{new Date(call.registration_start).toLocaleDateString()} – {new Date(call.registration_end).toLocaleDateString()}</span>
                                            </div>
                                            {call.exam_date && (
                                                <div className="flex justify-between">
                                                    <span>Examen:</span>
                                                    <span>{new Date(call.exam_date).toLocaleDateString()}</span>
                                                </div>
                                            )}
                                            {call.results_date && (
                                                <div className="flex justify-between">
                                                    <span>Resultados:</span>
                                                    <span>{new Date(call.results_date).toLocaleDateString()}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="font-semibold mb-2">Estadísticas</h4>
                                        <div className="space-y-1 text-sm">
                                            <div className="flex justify-between">
                                                <span>Postulaciones:</span><span className="font-medium">{call.total_applications || 0}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Carreras:</span><span className="font-medium">{call.careers?.length || 0}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Costo:</span><span className="font-medium">S/. {call.application_fee}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-4">
                                    <h4 className="font-semibold mb-2">Carreras ({call.careers?.length || 0})</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {call.careers?.slice(0, 3).map((c) => (
                                            <Badge key={c.id} variant="outline">
                                                {c.name} ({c.vacancies} vacantes)
                                            </Badge>
                                        ))}
                                        {(call.careers?.length || 0) > 3 && (
                                            <Badge variant="outline">+{call.careers.length - 3} más</Badge>
                                        )}
                                    </div>
                                </div>

                                <div className="flex gap-2 mt-4">
                                    <Button variant="outline" size="sm"><Eye className="h-4 w-4 mr-2" />Ver Detalles</Button>
                                    <Button variant="outline" size="sm"><Edit className="h-4 w-4 mr-2" />Editar</Button>
                                    <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-2" />Publicar Resultados</Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}
