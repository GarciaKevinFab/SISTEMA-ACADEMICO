// src/components/OfficialDocsModule.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "../utils/safeToast";
import { useAuth } from "../../context/AuthContext";
import {
    Card, CardHeader, CardTitle, CardDescription, CardContent,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import {
    FileText, FileSpreadsheet, GraduationCap, Users, School, CheckCircle, XCircle,
    RefreshCw, Download, Search, ClipboardList, BookOpenCheck, ScrollText, Stamp,
} from "lucide-react";
import { OfficialPDF, ExcelExports, Catalog } from "../../services/reports.service";
import { downloadFile } from "../../utils/pdfQrPolling";

// --- helpers ---
function formatApiError(err, fallback = "Ocurrió un error") {
    const data = err?.response?.data;
    if (data?.detail) return typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
    if (typeof data?.message === "string") return data.message;
    if (typeof err?.message === "string") return err.message;
    return fallback;
}
const Section = ({ title, desc, icon, children }) => (
    <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2">{icon}{title}</CardTitle>
            {desc && <CardDescription>{desc}</CardDescription>}
        </CardHeader>
        <CardContent>{children}</CardContent>
    </Card>
);
const Field = ({ label, children }) => (
    <div>
        <Label className="mb-1 block">{label}</Label>
        {children}
    </div>
);

// ===========================================================
// Combos compartidos
// ===========================================================
const useCombos = () => {
    const [periods, setPeriods] = useState([]);
    const [careers, setCareers] = useState([]);
    const [courses, setCourses] = useState([]);
    const [sections, setSections] = useState([]);

    const loadPeriods = useCallback(async () => {
        try { const r = await Catalog.periods(); setPeriods(r?.items ?? r ?? []); } catch { }
    }, []);
    const loadCareers = useCallback(async () => {
        try { const r = await Catalog.careers(); setCareers(r?.items ?? r ?? []); } catch { }
    }, []);
    const loadCourses = useCallback(async (params) => {
        try { const r = await Catalog.courses(params); setCourses(r?.items ?? r ?? []); } catch { }
    }, []);
    const loadSections = useCallback(async (params) => {
        try { const r = await Catalog.sections(params); setSections(r?.items ?? r ?? []); } catch { }
    }, []);

    useEffect(() => { loadPeriods(); loadCareers(); }, [loadPeriods, loadCareers]);

    return { periods, careers, courses, sections, loadCourses, loadSections };
};

// ===========================================================
// Actas (académicas y admisión)
// ===========================================================
const ActsTab = () => {
    const { periods, careers, courses, sections, loadCourses, loadSections } = useCombos();
    const [periodId, setPeriodId] = useState("");
    const [careerId, setCareerId] = useState("");
    const [courseId, setCourseId] = useState("");
    const [sectionId, setSectionId] = useState("");
    const [includeSigs, setIncludeSigs] = useState(true);

    // admisión
    const [convId, setConvId] = useState("");

    // cascade loaders
    useEffect(() => {
        if (careerId) loadCourses({ career_id: careerId });
        setCourseId(""); setSectionId("");
    }, [careerId, loadCourses]);
    useEffect(() => {
        if (periodId && courseId) loadSections({ period_id: periodId, course_id: courseId });
        setSectionId("");
    }, [periodId, courseId, loadSections]);

    const genAcademic = async () => {
        if (!sectionId) return toast.error("Selecciona la sección");
        try {
            const r = await OfficialPDF.academicActa({ section_id: Number(sectionId), include_signatures: includeSigs });
            if (r?.success) await downloadFile(r.downloadUrl, `acta-academica-${sectionId}.pdf`);
            else toast.error("No se pudo generar el PDF");
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const genAdmission = async () => {
        if (!convId) return toast.error("Indica la convocatoria/proceso");
        try {
            const r = await OfficialPDF.admissionActa({ admission_process_id: convId });
            if (r?.success) await downloadFile(r.downloadUrl, `acta-admision-${convId}.pdf`);
            else toast.error("No se pudo generar el PDF");
        } catch (e) { toast.error(formatApiError(e)); }
    };

    return (
        <div className="space-y-6">
            <Section
                title={<><ClipboardList className="h-5 w-5 text-blue-600" />Acta académica por sección</>}
                desc="Genera el acta oficial de evaluación (cierre de actas) para una sección específica."
            >
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Field label="Periodo *">
                        <Select value={periodId} onValueChange={setPeriodId}>
                            <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                            <SelectContent>{periods.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.code || `${p.year}-${p.term}`}</SelectItem>)}</SelectContent>
                        </Select>
                    </Field>
                    <Field label="Carrera/Plan">
                        <Select value={careerId} onValueChange={setCareerId}>
                            <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                            <SelectContent>{careers.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </Field>
                    <Field label="Curso">
                        <Select value={courseId} onValueChange={setCourseId} disabled={!careerId}>
                            <SelectTrigger><SelectValue placeholder={careerId ? "Selecciona" : "Seleccione carrera"} /></SelectTrigger>
                            <SelectContent>{courses.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.code ? `${c.code} - ${c.name}` : c.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </Field>
                    <Field label="Sección *">
                        <Select value={sectionId} onValueChange={setSectionId} disabled={!courseId || !periodId}>
                            <SelectTrigger><SelectValue placeholder={(courseId && periodId) ? "Selecciona" : "Seleccione curso y periodo"} /></SelectTrigger>
                            <SelectContent>{sections.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.code || s.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </Field>
                </div>

                <div className="flex items-center gap-2 mt-3">
                    <input id="sig" type="checkbox" checked={includeSigs} onChange={(e) => setIncludeSigs(e.target.checked)} />
                    <Label htmlFor="sig">Incluir firmas/huellas</Label>
                </div>

                <div className="flex justify-end mt-4">
                    <Button onClick={genAcademic}><FileText className="h-4 w-4 mr-2" /> Generar Acta Académica</Button>
                </div>
                <div data-testid="academic-acta-status" className="sr-only" />
            </Section>

            <Section
                title={<><ScrollText className="h-5 w-5 text-blue-600" />Acta de Admisión</>}
                desc="Acta oficial del proceso de admisión."
            >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Field label="Convocatoria / Proceso *">
                        <Input value={convId} onChange={(e) => setConvId(e.target.value)} placeholder="ID o código de convocatoria" />
                    </Field>
                </div>
                <div className="flex justify-end mt-4">
                    <Button onClick={genAdmission}><FileText className="h-4 w-4 mr-2" /> Generar Acta de Admisión</Button>
                </div>
                <div data-testid="admission-acta-status" className="sr-only" />
            </Section>
        </div>
    );
};

// ===========================================================
// Boletas y Constancias (por alumno)
// ===========================================================
const SlipsConstanciesTab = () => {
    const [periodId, setPeriodId] = useState("");
    const [studentId, setStudentId] = useState("");
    const [query, setQuery] = useState("");
    const [found, setFound] = useState([]);

    const { periods } = useCombos();

    const doSearch = async () => {
        try {
            if (!query) return;
            const r = await Catalog.studentsSearch(query);
            setFound(r?.items ?? r ?? []);
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const genBoleta = async () => {
        if (!studentId || !periodId) return toast.error("Selecciona alumno y periodo");
        try {
            const r = await OfficialPDF.gradeSlip({ student_id: Number(studentId), period_id: Number(periodId) });
            if (r?.success) await downloadFile(r.downloadUrl, `boleta-${studentId}-${periodId}.pdf`);
            else toast.error("No se pudo generar el PDF");
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const genConstMatricula = async () => {
        if (!studentId || !periodId) return toast.error("Selecciona alumno y periodo");
        try {
            const r = await OfficialPDF.enrollmentConstancy({ student_id: Number(studentId), period_id: Number(periodId) });
            if (r?.success) await downloadFile(r.downloadUrl, `constancia-matricula-${studentId}-${periodId}.pdf`);
            else toast.error("No se pudo generar el PDF");
        } catch (e) { toast.error(formatApiError(e)); }
    };

    return (
        <div className="space-y-6">
            <Section
                title={<><BookOpenCheck className="h-5 w-5 text-blue-600" />Boleta de Notas & Constancia de Matrícula</>}
                desc="Documentos por alumno y periodo."
            >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Field label="Buscar alumno">
                        <div className="flex gap-2">
                            <Input placeholder="DNI, código o nombre" value={query} onChange={(e) => setQuery(e.target.value)} />
                            <Button type="button" variant="outline" onClick={doSearch}><Search className="h-4 w-4" /></Button>
                        </div>
                        {found.length > 0 && (
                            <div className="mt-2 border rounded max-h-40 overflow-auto">
                                {found.map((s) => (
                                    <button
                                        key={s.id}
                                        className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${String(studentId) === String(s.id) ? "bg-blue-50" : ""}`}
                                        onClick={() => setStudentId(String(s.id))}
                                    >
                                        <div className="text-sm font-medium">{s.full_name || s.name}</div>
                                        <div className="text-xs text-gray-500">{s.document} · {s.code || s.student_code || "-"}</div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </Field>
                    <Field label="Alumno seleccionado">
                        <Input value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="ID del alumno" />
                    </Field>
                    <Field label="Periodo *">
                        <Select value={periodId} onValueChange={setPeriodId}>
                            <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                            <SelectContent>{periods.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.code || `${p.year}-${p.term}`}</SelectItem>)}</SelectContent>
                        </Select>
                    </Field>
                </div>

                <div className="flex flex-wrap gap-2 justify-end">
                    <Button onClick={genBoleta}><FileText className="h-4 w-4 mr-2" /> Generar Boleta de Notas</Button>
                    <Button variant="outline" onClick={genConstMatricula}><ScrollText className="h-4 w-4 mr-2" /> Constancia de Matrícula</Button>
                </div>

                <div className="sr-only" data-testid="boleta-pdf-status" />
                <div className="sr-only" data-testid="constancia-matricula-status" />
            </Section>
        </div>
    );
};

// ===========================================================
// Kárdex (histórico por alumno)
// ===========================================================
const KardexTab = () => {
    const [studentId, setStudentId] = useState("");
    const [query, setQuery] = useState("");
    const [found, setFound] = useState([]);

    const doSearch = async () => {
        try {
            if (!query) return;
            const r = await Catalog.studentsSearch(query);
            setFound(r?.items ?? r ?? []);
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const genKardex = async () => {
        if (!studentId) return toast.error("Selecciona el alumno");
        try {
            const r = await OfficialPDF.kardex({ student_id: Number(studentId) });
            if (r?.success) await downloadFile(r.downloadUrl, `kardex-${studentId}.pdf`);
            else toast.error("No se pudo generar el PDF");
        } catch (e) { toast.error(formatApiError(e)); }
    };

    return (
        <div className="space-y-6">
            <Section
                title={<><GraduationCap className="h-5 w-5 text-blue-600" />Kárdex del Estudiante</>}
                desc="Historial académico consolidado del estudiante."
            >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Buscar alumno">
                        <div className="flex gap-2">
                            <Input placeholder="DNI, código o nombre" value={query} onChange={(e) => setQuery(e.target.value)} />
                            <Button type="button" variant="outline" onClick={doSearch}><Search className="h-4 w-4" /></Button>
                        </div>
                        {found.length > 0 && (
                            <div className="mt-2 border rounded max-h-40 overflow-auto">
                                {found.map((s) => (
                                    <button
                                        key={s.id}
                                        className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${String(studentId) === String(s.id) ? "bg-blue-50" : ""}`}
                                        onClick={() => setStudentId(String(s.id))}
                                    >
                                        <div className="text-sm font-medium">{s.full_name || s.name}</div>
                                        <div className="text-xs text-gray-500">{s.document} · {s.code || s.student_code || "-"}</div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </Field>

                    <Field label="Alumno seleccionado">
                        <Input value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="ID del alumno" />
                    </Field>
                </div>

                <div className="flex justify-end">
                    <Button onClick={genKardex}><FileText className="h-4 w-4 mr-2" /> Generar Kárdex</Button>
                </div>
                <div className="sr-only" data-testid="kardex-pdf-status" />
            </Section>
        </div>
    );
};

// ===========================================================
// Certificados
// ===========================================================
const CertificatesTab = () => {
    const [studentId, setStudentId] = useState("");
    const [certType, setCertType] = useState("ESTUDIOS"); // ESTUDIOS|EGRESADO|CONDUCTA|OTROS
    const [notes, setNotes] = useState("");

    const genCert = async () => {
        if (!studentId) return toast.error("Indica alumno");
        try {
            const r = await OfficialPDF.certificate({ student_id: Number(studentId), certificate_type: certType, notes });
            if (r?.success) await downloadFile(r.downloadUrl, `certificado-${certType}-${studentId}.pdf`);
            else toast.error("No se pudo generar el PDF");
        } catch (e) { toast.error(formatApiError(e)); }
    };

    return (
        <div className="space-y-6">
            <Section
                title={<><Stamp className="h-5 w-5 text-blue-600" />Certificados Oficiales</>}
                desc="Emisión de certificados parametrizables."
            >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Field label="Alumno (ID) *">
                        <Input value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="ID del alumno" />
                    </Field>
                    <Field label="Tipo de certificado">
                        <Select value={certType} onValueChange={setCertType}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ESTUDIOS">Constancia de Estudios</SelectItem>
                                <SelectItem value="EGRESADO">Constancia de Egreso</SelectItem>
                                <SelectItem value="CONDUCTA">Constancia de Conducta</SelectItem>
                                <SelectItem value="OTROS">Otros</SelectItem>
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field label="Notas / Observaciones (opcional)">
                        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Texto a incluir en el certificado" />
                    </Field>
                </div>
                <div className="flex justify-end">
                    <Button onClick={genCert}><FileText className="h-4 w-4 mr-2" /> Generar Certificado</Button>
                </div>
                <div className="sr-only" data-testid="certificate-pdf-status" />
            </Section>
        </div>
    );
};

// ===========================================================
// Descargables Excel
// ===========================================================
const ExcelExportsTab = () => {
    const { periods, careers, sections, loadSections } = useCombos();
    const [periodId, setPeriodId] = useState("");
    const [careerId, setCareerId] = useState("");
    const [sectionId, setSectionId] = useState("");

    useEffect(() => {
        if (periodId && careerId) loadSections({ period_id: periodId, career_id: careerId });
    }, [periodId, careerId, loadSections]);

    const exportGradesBySection = async () => {
        if (!sectionId) return toast.error("Selecciona la sección");
        try {
            await ExcelExports.download("grades_by_section", { section_id: sectionId }, `notas-seccion-${sectionId}.xlsx`);
            toast.success("Descarga iniciada");
        } catch (e) { toast.error(formatApiError(e, "No se pudo exportar")); }
    };

    const exportEnrollmentsByPeriod = async () => {
        if (!periodId) return toast.error("Selecciona el periodo");
        try {
            await ExcelExports.download("enrollments_by_period", { period_id: periodId }, `matriculas-${periodId}.xlsx`);
            toast.success("Descarga iniciada");
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const exportStudents = async () => {
        try {
            await ExcelExports.download("students", {}, `alumnos.xlsx`);
            toast.success("Descarga iniciada");
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const exportAdmissionResults = async () => {
        try {
            await ExcelExports.download("admission_results", {}, `resultados-admision.xlsx`);
            toast.success("Descarga iniciada");
        } catch (e) { toast.error(formatApiError(e)); }
    };

    return (
        <div className="space-y-6">
            <Section
                title={<><FileSpreadsheet className="h-5 w-5 text-blue-600" />Exportaciones Excel</>}
                desc="Descarga listados y reportes en formato XLSX."
            >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Field label="Periodo">
                        <Select value={periodId} onValueChange={setPeriodId}>
                            <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                            <SelectContent>{periods.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.code || `${p.year}-${p.term}`}</SelectItem>)}</SelectContent>
                        </Select>
                    </Field>
                    <Field label="Carrera (opcional)">
                        <Select value={careerId} onValueChange={setCareerId}>
                            <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="">Todas</SelectItem>
                                {careers.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field label="Sección">
                        <Select value={sectionId} onValueChange={setSectionId} disabled={!periodId}>
                            <SelectTrigger><SelectValue placeholder={periodId ? "Selecciona" : "Selecciona periodo"} /></SelectTrigger>
                            <SelectContent>
                                {sections.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.code || s.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </Field>
                </div>

                <div className="flex flex-wrap gap-2">
                    <Button onClick={exportGradesBySection}><Download className="h-4 w-4 mr-2" /> Notas por Sección</Button>
                    <Button variant="outline" onClick={exportEnrollmentsByPeriod}><Download className="h-4 w-4 mr-2" /> Matrículas por Periodo</Button>
                    <Button variant="outline" onClick={exportStudents}><Download className="h-4 w-4 mr-2" /> Alumnos (General)</Button>
                    <Button variant="outline" onClick={exportAdmissionResults}><Download className="h-4 w-4 mr-2" /> Resultados Admisión</Button>
                </div>
            </Section>
        </div>
    );
};

// ===========================================================
// MAIN
// ===========================================================
const OfficialDocsModule = () => {
    const { user } = useAuth();
    if (!user) return <div className="p-6">Acceso no autorizado</div>;

    return (
        <div className="p-6">
            <Tabs defaultValue="acts" className="space-y-6">
                <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="acts">Actas</TabsTrigger>
                    <TabsTrigger value="slips">Boletas/Constancias</TabsTrigger>
                    <TabsTrigger value="kardex">Kárdex</TabsTrigger>
                    <TabsTrigger value="certs">Certificados</TabsTrigger>
                    <TabsTrigger value="excel">Excel</TabsTrigger>
                </TabsList>

                <TabsContent value="acts"><ActsTab /></TabsContent>
                <TabsContent value="slips"><SlipsConstanciesTab /></TabsContent>
                <TabsContent value="kardex"><KardexTab /></TabsContent>
                <TabsContent value="certs"><CertificatesTab /></TabsContent>
                <TabsContent value="excel"><ExcelExportsTab /></TabsContent>
            </Tabs>
        </div>
    );
};

export default OfficialDocsModule;
