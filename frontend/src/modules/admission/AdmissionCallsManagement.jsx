// src/modules/admission/AdmissionCallsManagement.jsx
import React, { useEffect, useState } from "react";
import {
    Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "../../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { Plus, Eye, Edit, Download, Calendar, FileText } from "lucide-react";
import { toast } from "sonner";
import {
    listAdmissionCalls,
    createAdmissionCall,
    listCareers,
    Results,
} from "../../services/admission.service";

// ---------- helpers de normalización/format ----------
const normalizeCall = (c) => {
    const careers = (c.careers || []).map((x) => ({
        id: x.id ?? x.career_id,
        name: x.name ?? x.career_name ?? x.title,
        vacancies: x.vacancies ?? x.quota ?? x.slots ?? 0,
    }));

    return {
        id: c.id,
        name: c.name,
        description: c.description || "",
        academic_year: c.academic_year ?? c.year ?? null,
        academic_period: c.academic_period ?? c.period ?? null,
        registration_start: c.registration_start ?? c.start_date ?? null,
        registration_end: c.registration_end ?? c.end_date ?? null,
        exam_date: c.exam_date ?? c.exam_at ?? null,
        results_date: c.results_date ?? c.results_at ?? null,
        application_fee: c.application_fee ?? c.fee ?? 0,
        max_applications_per_career: c.max_applications_per_career ?? c.max_choices ?? 1,
        minimum_age: c.minimum_age ?? null,
        maximum_age: c.maximum_age ?? null,
        required_documents: c.required_documents ?? [],
        careers,
        total_applications: c.total_applications ?? c.applications_count ?? 0,
        status: c.status ?? c.state ?? "OPEN",
    };
};

const fmtDate = (v) => (v ? new Date(v).toLocaleDateString() : "—");
const fmtDateTime = (v) => (v ? new Date(v).toLocaleString() : "—");
const fmtMoney = (n) =>
    typeof n === "number" ? n.toFixed(2) : Number(n || 0).toFixed(2);

const REQUIRED_DOCS = [
    { value: "BIRTH_CERTIFICATE", label: "Partida de nacimiento" },
    { value: "STUDY_CERTIFICATE", label: "Cert. estudios" },
    { value: "PHOTO", label: "Foto" },
    { value: "DNI_COPY", label: "Copia DNI" },
];

export default function AdmissionCallsManagement() {
    const [admissionCalls, setAdmissionCalls] = useState([]);
    const [careers, setCareers] = useState([]);
    const [loading, setLoading] = useState(true);

    // UI estados
    const [openCreate, setOpenCreate] = useState(false);
    const [openView, setOpenView] = useState(false);
    const [viewCall, setViewCall] = useState(null);

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
            const [callsRes, careersRes] = await Promise.all([
                listAdmissionCalls(),
                listCareers(),
            ]);

            const callsListRaw = Array.isArray(callsRes)
                ? callsRes
                : callsRes?.items ||
                callsRes?.results ||
                callsRes?.admission_calls ||
                callsRes?.calls ||
                [];

            const callsList = callsListRaw.map(normalizeCall);

            const careersList = Array.isArray(careersRes)
                ? careersRes
                : careersRes?.items || careersRes?.results || careersRes?.careers || [];

            setAdmissionCalls(callsList);
            setCareers(careersList);
        } catch (e) {
            console.error(e);
            toast.error("Error al cargar convocatorias");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const toggleCareer = (careerId, checked) => {
        if (checked) {
            setForm((f) => ({
                ...f,
                available_careers: [...f.available_careers, careerId],
                career_vacancies: {
                    ...f.career_vacancies,
                    [careerId]: f.career_vacancies[careerId] ?? 30,
                },
            }));
        } else {
            setForm((f) => {
                const next = { ...f.career_vacancies };
                delete next[careerId];
                return {
                    ...f,
                    available_careers: f.available_careers.filter((id) => id !== careerId),
                    career_vacancies: next,
                };
            });
        }
    };

    const setVacancy = (careerId, val) => {
        setForm((f) => ({
            ...f,
            career_vacancies: {
                ...f.career_vacancies,
                [careerId]: parseInt(val || "0", 10),
            },
        }));
    };

    const toggleReqDoc = (val) => {
        setForm((f) => {
            const selected = new Set(f.required_documents || []);
            if (selected.has(val)) selected.delete(val);
            else selected.add(val);
            return { ...f, required_documents: Array.from(selected) };
        });
    };

    const resetForm = () =>
        setForm({
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

    const submit = async (e) => {
        e.preventDefault();
        try {
            await createAdmissionCall(form);
            toast.success("Convocatoria creada");
            setOpenCreate(false);
            resetForm();
            load();
        } catch (e) {
            console.error(e);
            toast.error(e?.response?.data?.detail || "Error al crear convocatoria");
        }
    };

    const openDetails = (call) => {
        setViewCall(call);
        setOpenView(true);
    };

    const publishResults = async (call) => {
        try {
            await Results.publish({ call_id: call.id });
            toast.success("Resultados publicados");
        } catch (e) {
            toast.error(e?.response?.data?.detail || "No se pudo publicar resultados");
        }
    };

    const downloadActa = async (call) => {
        try {
            const resp = await Results.actaPdf({ call_id: call.id });
            const blob = new Blob([resp.data], { type: "application/pdf" });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `acta-call-${call.id}.pdf`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (e) {
            toast.error("No se pudo descargar el acta");
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
                <Dialog open={openCreate} onOpenChange={setOpenCreate}>
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
                                    <Input
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <Label>Año Académico *</Label>
                                    <Input
                                        type="number"
                                        min="2024"
                                        max="2035"
                                        value={form.academic_year}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                academic_year: parseInt(e.target.value || "0", 10),
                                            })
                                        }
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <Label>Descripción</Label>
                                <Textarea
                                    rows={3}
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <Label>Período *</Label>
                                    <Select
                                        value={form.academic_period}
                                        onValueChange={(v) => setForm({ ...form, academic_period: v })}
                                    >
                                        <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="I">I</SelectItem>
                                            <SelectItem value="II">II</SelectItem>
                                            <SelectItem value="III">III</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Costo (S/.)</Label>
                                    <Input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={form.application_fee}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                application_fee: parseFloat(e.target.value || "0"),
                                            })
                                        }
                                    />
                                </div>
                                <div>
                                    <Label>Máx. carreras por postulante</Label>
                                    <Input
                                        type="number"
                                        min="1"
                                        max="3"
                                        value={form.max_applications_per_career}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                max_applications_per_career: parseInt(e.target.value || "1", 10),
                                            })
                                        }
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Inicio de Inscripciones *</Label>
                                    <Input
                                        type="datetime-local"
                                        value={form.registration_start}
                                        onChange={(e) => setForm({ ...form, registration_start: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <Label>Fin de Inscripciones *</Label>
                                    <Input
                                        type="datetime-local"
                                        value={form.registration_end}
                                        onChange={(e) => setForm({ ...form, registration_end: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Fecha de Examen</Label>
                                    <Input
                                        type="datetime-local"
                                        value={form.exam_date}
                                        onChange={(e) => setForm({ ...form, exam_date: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <Label>Fecha de Resultados</Label>
                                    <Input
                                        type="datetime-local"
                                        value={form.results_date}
                                        onChange={(e) => setForm({ ...form, results_date: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Edad Mínima</Label>
                                    <Input
                                        type="number"
                                        min="15"
                                        max="30"
                                        value={form.minimum_age}
                                        onChange={(e) =>
                                            setForm({ ...form, minimum_age: parseInt(e.target.value || "0", 10) })
                                        }
                                    />
                                </div>
                                <div>
                                    <Label>Edad Máxima</Label>
                                    <Input
                                        type="number"
                                        min="20"
                                        max="50"
                                        value={form.maximum_age}
                                        onChange={(e) =>
                                            setForm({ ...form, maximum_age: parseInt(e.target.value || "0", 10) })
                                        }
                                    />
                                </div>
                            </div>

                            <div>
                                <Label>Documentos requeridos</Label>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {REQUIRED_DOCS.map((d) => {
                                        const active = form.required_documents.includes(d.value);
                                        return (
                                            <button
                                                key={d.value}
                                                type="button"
                                                onClick={() => toggleReqDoc(d.value)}
                                                className={`px-2 py-1 rounded border text-xs ${active ? "bg-blue-600 text-white border-blue-600" : "border-gray-300"
                                                    }`}
                                            >
                                                {d.label}
                                            </button>
                                        );
                                    })}
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
                                                <Label htmlFor={`career_${c.id}`} className="text-sm">
                                                    {c.name}
                                                </Label>
                                            </div>
                                            {form.available_careers.includes(c.id) && (
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    max="200"
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
                                <Button type="button" variant="outline" onClick={() => setOpenCreate(false)}>
                                    Cancelar
                                </Button>
                                <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                                    Crear Convocatoria
                                </Button>
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
                        <Button onClick={() => setOpenCreate(true)} className="bg-blue-600 hover:bg-blue-700">
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
                                        <CardDescription>
                                            Año {call.academic_year ?? "—"} · Período {call.academic_period ?? "—"}
                                        </CardDescription>
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
                                                <span>
                                                    {fmtDate(call.registration_start)} – {fmtDate(call.registration_end)}
                                                </span>
                                            </div>
                                            {call.exam_date && (
                                                <div className="flex justify-between">
                                                    <span>Examen:</span>
                                                    <span>{fmtDate(call.exam_date)}</span>
                                                </div>
                                            )}
                                            {call.results_date && (
                                                <div className="flex justify-between">
                                                    <span>Resultados:</span>
                                                    <span>{fmtDate(call.results_date)}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="font-semibold mb-2">Estadísticas</h4>
                                        <div className="space-y-1 text-sm">
                                            <div className="flex justify-between">
                                                <span>Postulaciones:</span>
                                                <span className="font-medium">{call.total_applications || 0}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Carreras:</span>
                                                <span className="font-medium">{call.careers?.length || 0}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Costo:</span>
                                                <span className="font-medium">S/. {fmtMoney(call.application_fee)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-4">
                                    <h4 className="font-semibold mb-2">
                                        Carreras ({call.careers?.length || 0})
                                    </h4>
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

                                <div className="flex flex-wrap gap-2 mt-4">
                                    <Button variant="outline" size="sm" onClick={() => openDetails(call)}>
                                        <Eye className="h-4 w-4 mr-2" />
                                        Ver Detalles
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => publishResults(call)}>
                                        <FileText className="h-4 w-4 mr-2" />
                                        Publicar Resultados
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => downloadActa(call)}>
                                        <Download className="h-4 w-4 mr-2" />
                                        Acta PDF
                                    </Button>
                                    <Button variant="outline" size="sm" disabled title="Próximamente">
                                        <Edit className="h-4 w-4 mr-2" />
                                        Editar
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* Dialog Detalle */}
            <Dialog open={openView} onOpenChange={setOpenView}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Detalles de Convocatoria</DialogTitle>
                        <DialogDescription>Información completa</DialogDescription>
                    </DialogHeader>

                    {viewCall && (
                        <div className="space-y-4">
                            <div>
                                <div className="text-lg font-semibold">{viewCall.name}</div>
                                <div className="text-sm text-gray-500">
                                    Año {viewCall.academic_year ?? "—"} · Período {viewCall.academic_period ?? "—"}
                                </div>
                            </div>

                            {viewCall.description && (
                                <p className="text-sm text-gray-700 whitespace-pre-wrap">{viewCall.description}</p>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="text-sm space-y-1">
                                    <div className="flex justify-between"><span>Inscripciones inicio:</span><span>{fmtDateTime(viewCall.registration_start)}</span></div>
                                    <div className="flex justify-between"><span>Inscripciones fin:</span><span>{fmtDateTime(viewCall.registration_end)}</span></div>
                                    <div className="flex justify-between"><span>Examen:</span><span>{fmtDateTime(viewCall.exam_date)}</span></div>
                                    <div className="flex justify-between"><span>Resultados:</span><span>{fmtDateTime(viewCall.results_date)}</span></div>
                                </div>
                                <div className="text-sm space-y-1">
                                    <div className="flex justify-between"><span>Costo postulación:</span><span>S/. {fmtMoney(viewCall.application_fee)}</span></div>
                                    <div className="flex justify-between"><span>Máx. carreras por postulante:</span><span>{viewCall.max_applications_per_career}</span></div>
                                    <div className="flex justify-between"><span>Edad mínima:</span><span>{viewCall.minimum_age ?? "—"}</span></div>
                                    <div className="flex justify-between"><span>Edad máxima:</span><span>{viewCall.maximum_age ?? "—"}</span></div>
                                </div>
                            </div>

                            {!!(viewCall.required_documents || []).length && (
                                <div>
                                    <div className="font-medium mb-1">Documentos requeridos</div>
                                    <div className="flex flex-wrap gap-2">
                                        {viewCall.required_documents.map((d) => (
                                            <Badge key={d} variant="outline">{d}</Badge>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div>
                                <div className="font-medium mb-1">Carreras ({viewCall.careers?.length || 0})</div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {(viewCall.careers || []).map((c) => (
                                        <div key={c.id} className="text-sm border rounded p-2 flex items-center justify-between">
                                            <span>{c.name}</span>
                                            <Badge variant="secondary">{c.vacancies} vacantes</Badge>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
