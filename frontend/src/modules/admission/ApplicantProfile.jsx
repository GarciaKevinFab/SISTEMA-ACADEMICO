import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { toast } from "sonner";
import { User, Edit, FileText, CheckCircle, XCircle, Clock, Award, Plus } from "lucide-react";
import { createApplicant, getApplicantMe, listMyApplications } from "../../services/admission.service";

export default function ApplicantProfile() {
    const { user } = useAuth();
    const [applicant, setApplicant] = useState(null);
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);

    const [form, setForm] = useState({
        first_name: "", last_name: "", second_last_name: "",
        birth_date: "", gender: "M",
        document_type: "DNI", document_number: "",
        email: "", phone: "", address: "",
        district: "", province: "", department: "",
        high_school_name: "", high_school_year: new Date().getFullYear() - 1,
        has_disability: false, disability_description: "", conadis_number: ""
    });

    useEffect(() => {
        (async () => {
            try {
                const me = await getApplicantMe().catch(e => (e?.response?.status === 404 ? null : Promise.reject(e)));
                if (me) {
                    setApplicant(me);
                    setForm({
                        ...me,
                        birth_date: me.birth_date?.split("T")[0] || ""
                    });
                }
                const apps = await listMyApplications();
                setApplications(apps?.applications || []);
            } catch (e) {
                toast.error("Error al cargar datos");
            } finally { setLoading(false); }
        })();
    }, []);

    const getStatusBadge = (status) => {
        const map = {
            REGISTERED: { cls: "bg-blue-100 text-blue-800", label: "Registrado", Icon: FileText },
            DOCUMENTS_PENDING: { cls: "bg-yellow-100 text-yellow-800", label: "Docs. Pendientes", Icon: Clock },
            DOCUMENTS_COMPLETE: { cls: "bg-green-100 text-green-800", label: "Docs. Completos", Icon: CheckCircle },
            EVALUATED: { cls: "bg-purple-100 text-purple-800", label: "Evaluado", Icon: Award },
            ADMITTED: { cls: "bg-green-100 text-green-800", label: "Admitido", Icon: CheckCircle },
            NOT_ADMITTED: { cls: "bg-red-100 text-red-800", label: "No Admitido", Icon: XCircle },
            WAITING_LIST: { cls: "bg-orange-100 text-orange-800", label: "Lista de Espera", Icon: Clock }
        };
        const cfg = map[status] || map.REGISTERED;
        return <Badge className={`${cfg.cls} flex items-center gap-1`}><cfg.Icon className="h-3 w-3" />{cfg.label}</Badge>;
    };

    const createProfile = async (e) => {
        e.preventDefault();
        try {
            const res = await createApplicant(form);
            setApplicant(res?.applicant || res);
            setOpen(false);
            toast.success("Perfil creado");
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Error al crear perfil");
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            </div>
        );
    }

    if (!applicant) {
        return (
            <div className="text-center py-12">
                <User className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-xl font-medium text-gray-900 mb-4">Complete su Perfil de Postulante</h3>
                <p className="text-gray-500 mb-6">Para postular, primero cree su perfil.</p>
                {!open ? (
                    <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" /> Crear Perfil
                    </Button>
                ) : (
                    <Card className="max-w-4xl mx-auto mt-6 p-4">
                        <CardHeader><CardTitle>Crear Perfil</CardTitle></CardHeader>
                        <CardContent>
                            <form onSubmit={createProfile} className="space-y-4">
                                <div className="grid grid-cols-3 gap-4">
                                    <div><Label>Nombres *</Label><Input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} required /></div>
                                    <div><Label>Ap. Paterno *</Label><Input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} required /></div>
                                    <div><Label>Ap. Materno</Label><Input value={form.second_last_name} onChange={e => setForm({ ...form, second_last_name: e.target.value })} /></div>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div><Label>Fecha Nac. *</Label><Input type="date" value={form.birth_date} onChange={e => setForm({ ...form, birth_date: e.target.value })} required /></div>
                                    <div>
                                        <Label>Género *</Label>
                                        <Select value={form.gender} onValueChange={v => setForm({ ...form, gender: v })}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent><SelectItem value="M">Masculino</SelectItem><SelectItem value="F">Femenino</SelectItem></SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label>Tipo Doc. *</Label>
                                        <Select value={form.document_type} onValueChange={v => setForm({ ...form, document_type: v })}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="DNI">DNI</SelectItem>
                                                <SelectItem value="FOREIGN_CARD">Carné de Extranjería</SelectItem>
                                                <SelectItem value="PASSPORT">Pasaporte</SelectItem>
                                                <SelectItem value="CONADIS_CARD">Carné CONADIS</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><Label>N° Documento *</Label><Input value={form.document_number} onChange={e => setForm({ ...form, document_number: e.target.value })} required /></div>
                                    <div><Label>Email *</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required /></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><Label>Teléfono *</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required /></div>
                                    <div><Label>Dirección *</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} required /></div>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div><Label>Distrito *</Label><Input value={form.district} onChange={e => setForm({ ...form, district: e.target.value })} required /></div>
                                    <div><Label>Provincia *</Label><Input value={form.province} onChange={e => setForm({ ...form, province: e.target.value })} required /></div>
                                    <div><Label>Departamento *</Label><Input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} required /></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><Label>Colegio *</Label><Input value={form.high_school_name} onChange={e => setForm({ ...form, high_school_name: e.target.value })} required /></div>
                                    <div><Label>Año de egreso *</Label><Input type="number" min="2010" max="2030" value={form.high_school_year} onChange={e => setForm({ ...form, high_school_year: parseInt(e.target.value || "0", 10) })} required /></div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <input type="checkbox" id="has_disability" checked={form.has_disability} onChange={e => setForm({ ...form, has_disability: e.target.checked })} />
                                        <Label htmlFor="has_disability">¿Tiene alguna discapacidad?</Label>
                                    </div>
                                    {form.has_disability && (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div><Label>Descripción</Label><Textarea value={form.disability_description} onChange={e => setForm({ ...form, disability_description: e.target.value })} /></div>
                                            <div><Label>N° CONADIS</Label><Input value={form.conadis_number} onChange={e => setForm({ ...form, conadis_number: e.target.value })} /></div>
                                        </div>
                                    )}
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Crear Perfil</Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                )}
            </div>
        );
    }

    return (
       <div className="space-y-6 pb-24 sm:pb-6">

            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Mi Perfil de Postulante</h2>
                <Button variant="outline"><Edit className="h-4 w-4 mr-2" />Editar Perfil</Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Información Personal</CardTitle>
                    <CardDescription>Código: {applicant.applicant_code}</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                        <div><Label className="text-gray-500">Nombre</Label><p className="font-medium">{applicant.first_name} {applicant.last_name} {applicant.second_last_name}</p></div>
                        <div><Label className="text-gray-500">Documento</Label><p>{applicant.document_type}: {applicant.document_number}</p></div>
                        <div><Label className="text-gray-500">Nacimiento</Label><p>{new Date(applicant.birth_date).toLocaleDateString()}</p></div>
                        <div><Label className="text-gray-500">Email</Label><p>{applicant.email}</p></div>
                        <div><Label className="text-gray-500">Teléfono</Label><p>{applicant.phone}</p></div>
                        <div><Label className="text-gray-500">Colegio</Label><p>{applicant.high_school_name} ({applicant.high_school_year})</p></div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Mis Postulaciones</CardTitle>
                    <CardDescription>Historial</CardDescription>
                </CardHeader>
                <CardContent>
                    {applications.length === 0 ? (
                        <div className="text-center py-8">
                            <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                            <p className="text-gray-500">Sin postulaciones aún</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {applications.map(app => (
                                <div key={app.id} className="border rounded-lg p-4 text-sm">
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-medium">{app.admission_call?.name}</h4>
                                        {getStatusBadge(app.status)}
                                    </div>
                                    <div className="text-gray-600 mb-2">
                                        <p>Nº: {app.application_number}</p>
                                        <p>Fecha: {new Date(app.submitted_at).toLocaleDateString()}</p>
                                    </div>
                                    {app.career_preferences_details?.length > 0 && (
                                        <div>
                                            <strong>Carreras:</strong>
                                            <ul className="list-disc list-inside">
                                                {app.career_preferences_details.map((c, i) => (
                                                    <li key={c.id}>{i + 1}. {c.name}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {app.final_score && <div className="mt-2"><strong>Puntaje:</strong> {app.final_score}/20</div>}
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
