// StudentHistoricalGrades.jsx — Gestión de notas históricas por alumno (admin)
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Save } from "lucide-react";
import { Grades } from "@/services/academic.service";
import { Plans } from "@/services/academic.service";

/* ── Constantes de componentes (replica backend) ── */
const ACTA_LEVELS = ["PI", "I", "P", "L", "D"];
const LEVEL_TO_NUM = { PI: 1, I: 2, P: 3, L: 4, D: 5 };
const NUM_TO_LEVEL = { 1: "PI", 2: "I", 3: "P", 4: "L", 5: "D" };

function calcEscala(c1, c2, c3) {
    if (c1 == null || c2 == null || c3 == null) return null;
    return Math.round(((c1 + c2 + c3) / 3) * 10) / 10;
}
function calcPromedioFinal(escala) {
    if (escala == null) return null;
    return Math.round(((escala - 1) / 4) * 20);
}
function calcEstado(prom) {
    if (prom == null) return "";
    return prom >= 11 ? "Logrado" : "En proceso";
}

const EMPTY_RECORD = {
    term: "",
    course_id: "",
    course_name: "",
    c1_level: "",
    c2_level: "",
    c3_level: "",
    final_grade: "",
};

export default function StudentHistoricalGrades({ studentId, studentName, planId }) {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [planCourses, setPlanCourses] = useState([]);
    const [newRecord, setNewRecord] = useState({ ...EMPTY_RECORD });

    // Cargar notas históricas
    const loadRecords = useCallback(async () => {
        if (!studentId) return;
        setLoading(true);
        try {
            const data = await Grades.listHistorical(studentId);
            setRecords(data?.records || []);
        } catch (e) {
            console.error("Error cargando notas históricas:", e);
            toast.error("Error cargando notas históricas");
        } finally {
            setLoading(false);
        }
    }, [studentId]);

    // Cargar cursos del plan
    useEffect(() => {
        if (!planId) {
            setPlanCourses([]);
            return;
        }
        Plans.listAllCourses(planId)
            .then((data) => {
                // La respuesta puede ser un array directo o {courses: [...]} o {items: [...]}
                const raw = Array.isArray(data)
                    ? data
                    : (data?.courses || data?.plan_courses || data?.items || []);
                const courses = Array.isArray(raw) ? raw : [];
                setPlanCourses(
                    courses.map((pc) => ({
                        id: pc.course_id || pc.courseId || pc.course || pc.id,
                        name: pc.display_name || pc.displayName || pc.course_name || pc.courseName || pc.name || "",
                        semester: pc.semester,
                    }))
                );
            })
            .catch((err) => {
                console.warn("No se pudieron cargar cursos del plan:", err);
                setPlanCourses([]);
            });
    }, [planId]);

    useEffect(() => {
        loadRecords();
    }, [loadRecords]);

    // Auto-calcular promedio cuando cambian niveles
    const computedGrade = useMemo(() => {
        const c1 = LEVEL_TO_NUM[newRecord.c1_level];
        const c2 = LEVEL_TO_NUM[newRecord.c2_level];
        const c3 = LEVEL_TO_NUM[newRecord.c3_level];
        if (c1 && c2 && c3) {
            const escala = calcEscala(c1, c2, c3);
            const prom = calcPromedioFinal(escala);
            return { c1, c2, c3, escala, promedio: prom, estado: calcEstado(prom) };
        }
        return null;
    }, [newRecord.c1_level, newRecord.c2_level, newRecord.c3_level]);

    // Guardar nueva nota
    const handleSave = async () => {
        if (!newRecord.term) return toast.error("Ingrese el período");
        if (!newRecord.course_id) return toast.error("Seleccione un curso");

        const fg =
            computedGrade?.promedio != null
                ? computedGrade.promedio
                : parseFloat(newRecord.final_grade);

        if (fg == null || isNaN(fg)) return toast.error("Nota final no válida");
        if (fg < 0 || fg > 20) return toast.error("Nota debe ser entre 0 y 20");

        const components = {};
        if (computedGrade) {
            components.C1 = computedGrade.c1;
            components.C2 = computedGrade.c2;
            components.C3 = computedGrade.c3;
            components.C1_LEVEL = newRecord.c1_level;
            components.C2_LEVEL = newRecord.c2_level;
            components.C3_LEVEL = newRecord.c3_level;
            components.ESCALA_0_5 = computedGrade.escala;
            components.PROMEDIO_FINAL = computedGrade.promedio;
            components.ESTADO = computedGrade.estado;
        }

        setSaving(true);
        try {
            const res = await Grades.saveHistorical({
                student_id: studentId,
                records: [
                    {
                        course_id: parseInt(newRecord.course_id),
                        term: newRecord.term.trim(),
                        final_grade: fg,
                        components,
                    },
                ],
            });
            if (res?.error) {
                toast.error(res.error);
            } else {
                const errors = res?.errors || [];
                if (errors.length) {
                    errors.forEach((e) => toast.error(e));
                } else {
                    toast.success(
                        `Nota guardada (${res?.created || 0} nueva, ${res?.updated || 0} actualizada)`
                    );
                    setNewRecord({ ...EMPTY_RECORD });
                    loadRecords();
                }
            }
        } catch (e) {
            console.error("Error guardando nota:", e);
            toast.error("Error guardando nota histórica");
        } finally {
            setSaving(false);
        }
    };

    // Eliminar nota
    const handleDelete = async (recordId) => {
        if (!window.confirm("¿Eliminar esta nota histórica?")) return;
        try {
            await Grades.deleteHistorical(recordId);
            toast.success("Nota eliminada");
            loadRecords();
        } catch (e) {
            toast.error("Error eliminando nota");
        }
    };

    const updateNew = (field, value) => setNewRecord((prev) => ({ ...prev, [field]: value }));

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    📝 Notas Históricas
                    {studentName && <Badge variant="outline">{studentName}</Badge>}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* ── Formulario para agregar nota ── */}
                <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                    <h4 className="font-medium text-sm">Agregar nota histórica</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {/* Período */}
                        <div>
                            <Label className="text-xs">Período</Label>
                            <Input
                                placeholder="Ej: 2025-I, 2024-VERANO"
                                value={newRecord.term}
                                onChange={(e) => updateNew("term", e.target.value)}
                                className="h-9"
                            />
                        </div>

                        {/* Curso */}
                        <div>
                            <Label className="text-xs">Curso</Label>
                            {planCourses.length > 0 ? (
                                <Select
                                    value={String(newRecord.course_id)}
                                    onValueChange={(v) => {
                                        updateNew("course_id", v);
                                        const pc = planCourses.find((c) => String(c.id) === v);
                                        if (pc) updateNew("course_name", pc.name);
                                    }}
                                >
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="Seleccionar curso" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {planCourses.map((pc) => (
                                            <SelectItem key={pc.id} value={String(pc.id)}>
                                                {pc.name} {pc.semester ? `(Ciclo ${pc.semester})` : ""}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Input
                                    placeholder="ID del curso"
                                    value={newRecord.course_id}
                                    onChange={(e) => updateNew("course_id", e.target.value)}
                                    className="h-9"
                                    type="number"
                                />
                            )}
                        </div>

                        {/* Nota Final (manual si no hay componentes) */}
                        <div>
                            <Label className="text-xs">
                                Nota Final{" "}
                                {computedGrade ? (
                                    <span className="text-green-600 font-bold">= {computedGrade.promedio}</span>
                                ) : (
                                    "(0-20)"
                                )}
                            </Label>
                            <Input
                                placeholder="0-20"
                                value={
                                    computedGrade?.promedio != null
                                        ? computedGrade.promedio
                                        : newRecord.final_grade
                                }
                                onChange={(e) => updateNew("final_grade", e.target.value)}
                                className="h-9"
                                type="number"
                                min={0}
                                max={20}
                                disabled={!!computedGrade}
                            />
                        </div>
                    </div>

                    {/* Componentes C1/C2/C3 */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        {["c1_level", "c2_level", "c3_level"].map((field, idx) => (
                            <div key={field}>
                                <Label className="text-xs">
                                    C{idx + 1} Nivel
                                    {newRecord[field] && (
                                        <span className="ml-1 text-blue-600">
                                            = {LEVEL_TO_NUM[newRecord[field]]}
                                        </span>
                                    )}
                                </Label>
                                <Select
                                    value={newRecord[field]}
                                    onValueChange={(v) => updateNew(field, v)}
                                >
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="Nivel" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ACTA_LEVELS.map((lv) => (
                                            <SelectItem key={lv} value={lv}>
                                                {lv} ({LEVEL_TO_NUM[lv]})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        ))}

                        {/* Info calculada */}
                        <div className="flex items-end">
                            {computedGrade && (
                                <div className="text-xs space-y-1">
                                    <div>
                                        Escala: <strong>{computedGrade.escala}</strong>
                                    </div>
                                    <Badge
                                        variant={computedGrade.estado === "Logrado" ? "default" : "destructive"}
                                        className="text-xs"
                                    >
                                        {computedGrade.estado}
                                    </Badge>
                                </div>
                            )}
                        </div>
                    </div>

                    <Button onClick={handleSave} disabled={saving} size="sm" className="gap-2">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        Agregar nota
                    </Button>
                </div>

                {/* ── Tabla de notas existentes ── */}
                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : records.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                        No hay notas históricas registradas para este alumno.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b text-left text-muted-foreground">
                                    <th className="pb-2 pr-3">Período</th>
                                    <th className="pb-2 pr-3">Curso</th>
                                    <th className="pb-2 pr-3 text-center">C1</th>
                                    <th className="pb-2 pr-3 text-center">C2</th>
                                    <th className="pb-2 pr-3 text-center">C3</th>
                                    <th className="pb-2 pr-3 text-center">Nota</th>
                                    <th className="pb-2 pr-3 text-center">Estado</th>
                                    <th className="pb-2"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {records.map((rec) => {
                                    const comp = rec.components || {};
                                    const estado = comp.ESTADO || (rec.final_grade >= 11 ? "Logrado" : "En proceso");
                                    return (
                                        <tr key={rec.id} className="border-b hover:bg-muted/50">
                                            <td className="py-2 pr-3 font-mono text-xs">{rec.term}</td>
                                            <td className="py-2 pr-3">{rec.course_name || `Curso #${rec.course_id}`}</td>
                                            <td className="py-2 pr-3 text-center">
                                                {comp.C1_LEVEL || comp.C1 || "-"}
                                            </td>
                                            <td className="py-2 pr-3 text-center">
                                                {comp.C2_LEVEL || comp.C2 || "-"}
                                            </td>
                                            <td className="py-2 pr-3 text-center">
                                                {comp.C3_LEVEL || comp.C3 || "-"}
                                            </td>
                                            <td className="py-2 pr-3 text-center font-bold">
                                                {rec.final_grade != null ? rec.final_grade : "-"}
                                            </td>
                                            <td className="py-2 pr-3 text-center">
                                                <Badge
                                                    variant={estado === "Logrado" ? "default" : "destructive"}
                                                    className="text-xs"
                                                >
                                                    {estado}
                                                </Badge>
                                            </td>
                                            <td className="py-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-destructive"
                                                    onClick={() => handleDelete(rec.id)}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
