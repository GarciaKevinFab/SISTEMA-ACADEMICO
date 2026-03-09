import React, { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { toast } from "sonner";
import { Syllabus, Evaluation, Sections } from "../../services/academic.service";
import { useAuth } from "@/context/AuthContext";
import { Upload, Trash2, Save, FileText, ExternalLink } from "lucide-react";

/* ──────────────────────────────────────────────────────────────
   Vista ALUMNO: lista sílabos de sus cursos matriculados
   ────────────────────────────────────────────────────────────── */
function StudentSyllabusView() {
    const [syllabuses, setSyllabuses] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Syllabus.mine()
            .then(d => setSyllabuses(d?.syllabuses || []))
            .catch(() => toast.error("No se pudo cargar los sílabos"))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="text-center py-8 text-muted-foreground">Cargando sílabos...</div>;

    return (
        <div className="space-y-6 pb-24 sm:pb-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" /> Sílabos de mis Cursos
                    </CardTitle>
                    <CardDescription>Sílabos de los cursos en los que estás matriculado</CardDescription>
                </CardHeader>
                <CardContent>
                    {syllabuses.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No se encontraron sílabos para tus cursos matriculados.</p>
                    ) : (
                        <div className="divide-y">
                            {syllabuses.map((s, i) => (
                                <div key={s.section_id || i} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-sm truncate">{s.course_name}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {s.teacher_name && <span>{s.teacher_name} &middot; </span>}
                                            {s.section_code && <span>Sec. {s.section_code} &middot; </span>}
                                            {s.period}
                                        </div>
                                    </div>
                                    <div className="shrink-0">
                                        {s.syllabus ? (
                                            <a
                                                href={s.syllabus.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                                            >
                                                <ExternalLink className="h-3.5 w-3.5" />
                                                Ver sílabo
                                            </a>
                                        ) : (
                                            <Badge variant="secondary" className="text-xs">Sin sílabo</Badge>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

/* ──────────────────────────────────────────────────────────────
   Vista DOCENTE / ADMIN: gestión de sílabos y evaluación
   ────────────────────────────────────────────────────────────── */
function TeacherSyllabusView() {
    const [sections, setSections] = useState([]);
    const [section, setSection] = useState(null);
    const [syllabusInfo, setSyllabusInfo] = useState(null);
    const [file, setFile] = useState(null);

    const [weights, setWeights] = useState([
        { code: "PARCIAL_1", label: "Parcial 1", weight: 20 },
        { code: "PARCIAL_2", label: "Parcial 2", weight: 20 },
        { code: "PARCIAL_3", label: "Parcial 3", weight: 20 },
        { code: "FINAL", label: "Examen Final", weight: 40 },
    ]);

    useEffect(() => {
        Sections.list({}).then(d => {
            const arr = Array.isArray(d?.sections) ? d.sections : (Array.isArray(d) ? d : []);
            setSections(arr);
        });
    }, []);

    useEffect(() => {
        if (!section?.id) return;
        (async () => {
            try {
                const ev = await Evaluation.getConfig(section.id);
                if (Array.isArray(ev?.items)) setWeights(ev.items);
                const sy = await Syllabus.get(section.id);
                setSyllabusInfo(sy?.syllabus || sy || null);
            } catch { /* no-op */ }
        })();
    }, [section?.id]);

    const sum = weights.reduce((a, b) => a + (Number(b.weight) || 0), 0);

    const saveConfig = async () => {
        if (sum !== 100) return toast.error("Las ponderaciones deben sumar 100%");
        try {
            await Evaluation.setConfig(section.id, { items: weights });
            toast.success("Esquema de evaluación guardado");
        } catch (e) { toast.error(e.message || "No se pudo guardar"); }
    };

    const uploadSyllabus = async () => {
        if (!file || !section) return;
        try {
            await Syllabus.upload(section.id, file);
            toast.success("Sílabo cargado");
            const sy = await Syllabus.get(section.id);
            setSyllabusInfo(sy?.syllabus || sy || null);
            setFile(null);
        } catch (e) { toast.error(e.message || "No se pudo cargar sílabo"); }
    };

    const deleteSyllabus = async () => {
        if (!section) return;
        try {
            await Syllabus.delete(section.id);
            setSyllabusInfo(null);
            toast.success("Sílabo eliminado");
        } catch (e) { toast.error(e.message || "No se pudo eliminar"); }
    };

    return (
        <div className="space-y-6 pb-24 sm:pb-6">
            <Card>
                <CardHeader>
                    <CardTitle>Configuración por Sección</CardTitle>
                    <CardDescription>Suba el sílabo y defina las ponderaciones de evaluación</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label>Sección</Label>
                        <select
                            className="border rounded p-2 w-full"
                            value={section?.id || ""}
                            onChange={e => setSection((Array.isArray(sections) ? sections : []).find(s => String(s.id) === e.target.value) || null)}
                        >
                            <option value="">Seleccionar</option>
                            {(Array.isArray(sections) ? sections : []).map(s => (
                                <option key={s.id} value={s.id}>{(s.course_name || "").toUpperCase()} - {s.section_code}</option>
                            ))}
                        </select>
                    </div>

                    {section && (
                        <>
                            <div className="border rounded p-3 space-y-3">
                                <div className="font-medium">Sílabo</div>
                                {syllabusInfo ? (
                                    <div className="flex items-center justify-between">
                                        <a href={syllabusInfo.url} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                                            Ver sílabo actual
                                        </a>
                                        <Button variant="destructive" onClick={deleteSyllabus}><Trash2 className="h-4 w-4 mr-2" />Eliminar</Button>
                                    </div>
                                ) : <div className="text-sm text-gray-500">No hay sílabo cargado</div>}
                                <div className="flex items-center gap-2">
                                    <Input type="file" accept="application/pdf" onChange={e => setFile(e.target.files?.[0] || null)} />
                                    <Button onClick={uploadSyllabus} disabled={!file}><Upload className="h-4 w-4 mr-2" />Subir</Button>
                                </div>
                            </div>

                            <div className="border rounded p-3 space-y-3">
                                <div className="font-medium">Esquema de evaluación</div>
                                <div className="grid md:grid-cols-2 gap-2">
                                    {weights.map((w, idx) => (
                                        <div key={w.code} className="flex items-center gap-2">
                                            <Input value={w.label} onChange={e => {
                                                const v = [...weights]; v[idx] = { ...v[idx], label: e.target.value }; setWeights(v);
                                            }} />
                                            <div className="flex items-center gap-1">
                                                <Input type="number" min="0" max="100" className="w-24 text-right"
                                                    value={w.weight}
                                                    onChange={e => {
                                                        const v = [...weights]; v[idx] = { ...v[idx], weight: +e.target.value || 0 }; setWeights(v);
                                                    }} />
                                                <span>%</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className={`text-sm ${sum === 100 ? 'text-green-600' : 'text-red-600'}`}>Suma: {sum}%</div>
                                <div className="flex justify-end">
                                    <Button onClick={saveConfig} disabled={sum !== 100}><Save className="h-4 w-4 mr-2" />Guardar esquema</Button>
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

/* ──────────────────────────────────────────────────────────────
   EXPORT: detecta rol y muestra la vista correspondiente
   ────────────────────────────────────────────────────────────── */
export default function SectionSyllabusEvaluation() {
    const { hasPerm } = useAuth();
    const isTeacher = hasPerm("academic.syllabus.upload") || hasPerm("academic.evaluation.config");

    if (isTeacher) return <TeacherSyllabusView />;
    return <StudentSyllabusView />;
}
