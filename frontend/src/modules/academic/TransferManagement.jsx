// TransferManagement.jsx — Gestión de alumnos y traslados: crear alumno + notas históricas
import React, { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Search, Loader2, UserPlus, FileText, ArrowLeft, Copy, KeyRound } from "lucide-react";
import { StudentsService } from "@/services/students.service";
import { Careers, Plans } from "@/services/academic.service";
import StudentHistoricalGrades from "./StudentHistoricalGrades";

const EMPTY_FORM = {
    numDocumento: "",
    nombres: "",
    apellidoPaterno: "",
    apellidoMaterno: "",
    programaCarrera: "",
    careerId: "",
    ciclo: "",
    email: "",
    celular: "",
    planId: "",
};

export default function TransferManagement() {
    const [view, setView] = useState("list"); // list | grades
    const [selectedStudent, setSelectedStudent] = useState(null);

    // Búsqueda de alumnos
    const [searchQuery, setSearchQuery] = useState("");
    const [students, setStudents] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);

    // Crear alumno
    const [showCreate, setShowCreate] = useState(false);
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState({ ...EMPTY_FORM });

    // Credenciales temporales
    const [credentials, setCredentials] = useState(null); // { username, tempPassword }

    // Carreras y planes
    const [careers, setCareers] = useState([]);
    const [allPlans, setAllPlans] = useState([]);

    // Cargar carreras y planes al inicio
    useEffect(() => {
        Careers.list()
            .then((data) => {
                const list = data?.careers || data?.results || [];
                setCareers(Array.isArray(list) ? list : []);
            })
            .catch(() => setCareers([]));

        Plans.list()
            .then((data) => {
                const all = data?.plans || data?.results || [];
                setAllPlans(Array.isArray(all) ? all : []);
            })
            .catch(() => setAllPlans([]));
    }, []);

    // Filtrar planes por carrera seleccionada
    const filteredPlans = React.useMemo(() => {
        if (!form.careerId && !form.programaCarrera) return allPlans;
        // Filtrar por career_id si lo tenemos
        if (form.careerId) {
            const byId = allPlans.filter((p) => {
                const pCareerId = p.career_id || p.careerId || p.career;
                return String(pCareerId) === String(form.careerId);
            });
            if (byId.length > 0) return byId;
        }
        // Fallback: filtrar por nombre
        if (form.programaCarrera) {
            const name = form.programaCarrera.toLowerCase();
            const byName = allPlans.filter((p) => {
                const pCareer = (p.career_name || p.careerName || p.career || "").toString().toLowerCase();
                return pCareer.includes(name) || name.includes(pCareer);
            });
            if (byName.length > 0) return byName;
        }
        return allPlans;
    }, [allPlans, form.careerId, form.programaCarrera]);

    // Buscar alumnos
    const handleSearch = useCallback(async () => {
        if (!searchQuery.trim()) return;
        setSearchLoading(true);
        try {
            const data = await StudentsService.list({ q: searchQuery.trim() });
            setStudents(data?.students || []);
        } catch (e) {
            toast.error("Error buscando alumnos");
        } finally {
            setSearchLoading(false);
        }
    }, [searchQuery]);

    // Crear nuevo estudiante
    const handleCreate = async () => {
        if (!form.numDocumento.trim()) return toast.error("DNI es obligatorio");
        if (!form.nombres.trim()) return toast.error("Nombres es obligatorio");
        if (!form.apellidoPaterno.trim()) return toast.error("Apellido paterno es obligatorio");

        setCreating(true);
        try {
            const payload = {
                numDocumento: form.numDocumento.trim(),
                nombres: form.nombres.trim(),
                apellidoPaterno: form.apellidoPaterno.trim(),
                apellidoMaterno: (form.apellidoMaterno || "").trim(),
                programaCarrera: form.programaCarrera || "",
                ciclo: form.ciclo ? parseInt(form.ciclo) : null,
                email: (form.email || "").trim(),
                celular: (form.celular || "").trim(),
            };
            if (form.planId) payload.planId = parseInt(form.planId);

            const newStudent = await StudentsService.create(payload);
            toast.success(`Estudiante ${newStudent.nombres} creado correctamente`);
            setShowCreate(false);
            setForm({ ...EMPTY_FORM });

            // Mostrar credenciales si se generaron
            if (newStudent._credentials) {
                setCredentials(newStudent._credentials);
            }

            // Ir directo a notas históricas
            setSelectedStudent(newStudent);
            setView("grades");
        } catch (e) {
            const detail = e?.response?.data?.detail || e?.response?.data?.numDocumento?.[0] || "Error creando estudiante";
            toast.error(typeof detail === "string" ? detail : JSON.stringify(detail));
        } finally {
            setCreating(false);
        }
    };

    // Seleccionar alumno para notas
    const selectForGrades = (st) => {
        setSelectedStudent(st);
        setView("grades");
    };

    const updateForm = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text).then(() => toast.success("Copiado al portapapeles"));
    };

    // ─── Vista de Notas Históricas ───
    if (view === "grades" && selectedStudent) {
        return (
            <div className="space-y-4">
                {/* Banner de credenciales */}
                {credentials && (
                    <div className="border border-green-300 bg-green-50 dark:bg-green-950/30 rounded-lg p-4 space-y-2">
                        <div className="flex items-center gap-2">
                            <KeyRound className="h-4 w-4 text-green-600" />
                            <h4 className="font-semibold text-sm text-green-800 dark:text-green-300">
                                Credenciales del nuevo estudiante
                            </h4>
                            <Button variant="ghost" size="sm" className="ml-auto h-6 text-xs"
                                onClick={() => setCredentials(null)}>
                                Cerrar
                            </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">Usuario:</span>
                                <code className="bg-white dark:bg-black px-2 py-0.5 rounded font-mono text-xs">
                                    {credentials.username}
                                </code>
                                <Button variant="ghost" size="icon" className="h-6 w-6"
                                    onClick={() => copyToClipboard(credentials.username)}>
                                    <Copy className="h-3 w-3" />
                                </Button>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">Contraseña:</span>
                                <code className="bg-white dark:bg-black px-2 py-0.5 rounded font-mono text-xs">
                                    {credentials.tempPassword}
                                </code>
                                <Button variant="ghost" size="icon" className="h-6 w-6"
                                    onClick={() => copyToClipboard(credentials.tempPassword)}>
                                    <Copy className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Guarda estas credenciales. La contraseña es temporal y el alumno podrá cambiarla al iniciar sesión.
                        </p>
                    </div>
                )}

                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" onClick={() => { setView("list"); setSelectedStudent(null); setCredentials(null); }}>
                        <ArrowLeft className="h-4 w-4 mr-1" /> Volver
                    </Button>
                    <div>
                        <h3 className="font-semibold text-sm">
                            {selectedStudent.nombres} {selectedStudent.apellidoPaterno} {selectedStudent.apellidoMaterno}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                            DNI: {selectedStudent.numDocumento}
                            {selectedStudent.programaCarrera && ` · ${selectedStudent.programaCarrera}`}
                            {selectedStudent.ciclo && ` · Ciclo ${selectedStudent.ciclo}`}
                        </p>
                    </div>
                </div>
                <StudentHistoricalGrades
                    studentId={selectedStudent.id}
                    studentName={`${selectedStudent.nombres} ${selectedStudent.apellidoPaterno}`}
                    planId={selectedStudent.planId || null}
                />
            </div>
        );
    }

    // ─── Vista principal (lista + buscar + crear) ───
    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-lg">Gestión de Alumnos y Traslados</CardTitle>
                            <CardDescription>
                                Crea un alumno nuevo (traslado o regular) o busca uno existente para asignarle notas históricas
                            </CardDescription>
                        </div>
                        <Button onClick={() => setShowCreate(true)} className="gap-2" size="sm">
                            <UserPlus className="h-4 w-4" />
                            Nuevo Estudiante
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Buscador */}
                    <div className="flex gap-2">
                        <Input
                            placeholder="Buscar por DNI, nombre o email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                            className="flex-1"
                        />
                        <Button onClick={handleSearch} disabled={searchLoading} variant="outline" className="gap-2">
                            {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                            Buscar
                        </Button>
                    </div>

                    {/* Resultados */}
                    {students.length > 0 && (
                        <div className="border rounded-lg divide-y">
                            {students.slice(0, 20).map((st) => (
                                <div key={st.id} className="flex items-center justify-between p-3 hover:bg-muted/50">
                                    <div>
                                        <p className="text-sm font-medium">
                                            {st.nombres} {st.apellidoPaterno} {st.apellidoMaterno}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            DNI: {st.numDocumento}
                                            {st.programaCarrera && ` · ${st.programaCarrera}`}
                                            {st.ciclo && ` · Ciclo ${st.ciclo}`}
                                        </p>
                                    </div>
                                    <Button variant="outline" size="sm" className="gap-1" onClick={() => selectForGrades(st)}>
                                        <FileText className="h-3.5 w-3.5" />
                                        Notas
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}

                    {students.length === 0 && searchQuery && !searchLoading && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                            No se encontraron alumnos. Puedes crear uno nuevo.
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* ── Dialog de creación ── */}
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Nuevo Estudiante</DialogTitle>
                        <DialogDescription>
                            Crea un nuevo alumno (traslado o ingresante). Después podrás asignarle sus notas históricas.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                            <Label>DNI / Num. Documento *</Label>
                            <Input value={form.numDocumento} onChange={(e) => updateForm("numDocumento", e.target.value)} placeholder="12345678" />
                        </div>
                        <div>
                            <Label>Nombres *</Label>
                            <Input value={form.nombres} onChange={(e) => updateForm("nombres", e.target.value)} />
                        </div>
                        <div>
                            <Label>Apellido Paterno *</Label>
                            <Input value={form.apellidoPaterno} onChange={(e) => updateForm("apellidoPaterno", e.target.value)} />
                        </div>
                        <div>
                            <Label>Apellido Materno</Label>
                            <Input value={form.apellidoMaterno} onChange={(e) => updateForm("apellidoMaterno", e.target.value)} />
                        </div>

                        <div>
                            <Label>Programa / Carrera</Label>
                            {careers.length > 0 ? (
                                <Select
                                    value={form.careerId ? String(form.careerId) : ""}
                                    onValueChange={(v) => {
                                        const career = careers.find((c) => String(c.id) === v);
                                        setForm((prev) => ({
                                            ...prev,
                                            careerId: v,
                                            programaCarrera: career ? (career.name || career.nombre || "") : "",
                                            planId: "", // reset plan al cambiar carrera
                                        }));
                                    }}
                                >
                                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                                    <SelectContent>
                                        {careers.map((c) => (
                                            <SelectItem key={c.id} value={String(c.id)}>
                                                {c.name || c.nombre}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Input value={form.programaCarrera} onChange={(e) => updateForm("programaCarrera", e.target.value)} placeholder="Ej: Educación Inicial" />
                            )}
                        </div>

                        <div>
                            <Label>Plan de Estudios</Label>
                            <Select value={form.planId ? String(form.planId) : ""} onValueChange={(v) => updateForm("planId", v)}>
                                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                                <SelectContent>
                                    {filteredPlans.map((p) => (
                                        <SelectItem key={p.id} value={String(p.id)}>
                                            {p.career_name || p.careerName || ""} {p.start_year || p.startYear || ""}–{p.end_year || p.endYear || ""}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>Ciclo al que ingresa</Label>
                            <Select value={String(form.ciclo)} onValueChange={(v) => updateForm("ciclo", v)}>
                                <SelectTrigger><SelectValue placeholder="Ciclo" /></SelectTrigger>
                                <SelectContent>
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((c) => (
                                        <SelectItem key={c} value={String(c)}>{c}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>Email</Label>
                            <Input value={form.email} onChange={(e) => updateForm("email", e.target.value)} type="email" />
                        </div>
                        <div>
                            <Label>Celular</Label>
                            <Input value={form.celular} onChange={(e) => updateForm("celular", e.target.value)} />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
                        <Button onClick={handleCreate} disabled={creating} className="gap-2">
                            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                            Crear y asignar notas
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
