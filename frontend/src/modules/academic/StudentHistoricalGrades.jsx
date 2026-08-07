// StudentHistoricalGrades.jsx — Gestión de notas históricas por alumno (admin)
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Save, AlertTriangle, RotateCcw, Pencil, X, Check } from "lucide-react";
import { Grades } from "@/services/academic.service";
import { Plans } from "@/services/academic.service";
import ConfirmModal from "@/components/ConfirmModal";

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

// Escala oficial MINEDU (RVM N° 123-2022) — 5 niveles
function estadoMinedu(grade) {
    const x = Number(grade);
    if (!Number.isFinite(x)) return "";
    if (x >= 20) return "Destacado";
    if (x >= 15) return "Logrado";
    if (x >= 11) return "En proceso";
    if (x >= 6)  return "Inicio";
    return "Previo al inicio";
}
function estadoBadgeClass(estado) {
    switch (estado) {
        case "Destacado":        return "bg-violet-100 text-violet-800 border-violet-200";
        case "Logrado":          return "bg-emerald-100 text-emerald-800 border-emerald-200";
        case "En proceso":       return "bg-amber-100 text-amber-800 border-amber-200";
        case "Inicio":           return "bg-orange-100 text-orange-800 border-orange-200";
        case "Previo al inicio": return "bg-rose-100 text-rose-800 border-rose-200";
        default:                 return "bg-slate-100 text-slate-700 border-slate-200";
    }
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
    const [confirmData, setConfirmData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [planCourses, setPlanCourses] = useState([]);
    const [newRecord, setNewRecord] = useState({ ...EMPTY_RECORD });

    // ── Eliminación masiva por periodo (reingreso / cachimbo) ──
    const [selectedTerms, setSelectedTerms] = useState(new Set());
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [confirmText, setConfirmText] = useState("");
    const [bulkDeleting, setBulkDeleting] = useState(false);

    // ── Edición inline de nota en la tabla ──
    const [editingId, setEditingId] = useState(null);
    const [editValue, setEditValue] = useState("");
    const [savingEdit, setSavingEdit] = useState(false);

    const startEdit = (rec) => {
        setEditingId(rec.id);
        setEditValue(rec.final_grade != null ? String(rec.final_grade) : "");
    };
    const cancelEdit = () => {
        setEditingId(null);
        setEditValue("");
    };
    const saveEdit = async (rec) => {
        const fg = parseFloat(editValue);
        if (!Number.isFinite(fg) || fg < 0 || fg > 20) {
            toast.error("Nota inválida (0 a 20)");
            return;
        }
        if (fg === Number(rec.final_grade)) {
            cancelEdit();
            return;
        }
        setSavingEdit(true);
        try {
            // Limpiamos C1/C2/C3 al editar el final_grade directo para que el
            // backend no auto-recalcule el promedio desde los componentes y
            // sobreescriba lo que el admin acaba de poner.
            const comp = { ...(rec.components || {}) };
            ["C1","C2","C3","C1_LEVEL","C2_LEVEL","C3_LEVEL",
             "ESCALA_0_5","PROMEDIO_FINAL","ESTADO"].forEach(k => delete comp[k]);

            const res = await Grades.saveHistorical({
                student_id: studentId,
                records: [{
                    course_id: rec.course_id,
                    term: rec.term,
                    final_grade: fg,
                    components: comp,
                }],
            });
            if (res?.error) {
                toast.error(res.error);
            } else if ((res?.errors || []).length) {
                res.errors.forEach((e) => toast.error(e));
            } else {
                toast.success(`Nota actualizada: ${rec.final_grade ?? "-"} → ${fg}`);
                cancelEdit();
                loadRecords();
            }
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Error guardando nota");
        } finally {
            setSavingEdit(false);
        }
    };

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
    const handleDelete = (recordId) => {
        setConfirmData({
            title: "¿Eliminar nota histórica?",
            message: "Esta acción no se puede deshacer.",
            confirmLabel: "Eliminar",
            onConfirm: async () => {
                try {
                    await Grades.deleteHistorical(recordId);
                    toast.success("Nota eliminada");
                    loadRecords();
                } catch (e) {
                    toast.error("Error eliminando nota");
                }
            },
        });
    };

    // Resumen de periodos (para eliminación masiva)
    const periodSummary = useMemo(() => {
        const by = new Map();
        for (const r of records) {
            const t = (r.term || "").trim();
            if (!t) continue;
            const item = by.get(t) || { term: t, count: 0, courses: [] };
            item.count += 1;
            item.courses.push(r.course_name || `Curso #${r.course_id}`);
            by.set(t, item);
        }
        // Ordenar por periodo descendente (más recientes primero)
        return Array.from(by.values()).sort((a, b) => b.term.localeCompare(a.term));
    }, [records]);

    const toggleTerm = (term) => {
        setSelectedTerms((prev) => {
            const next = new Set(prev);
            if (next.has(term)) next.delete(term);
            else next.add(term);
            return next;
        });
    };
    const toggleAllTerms = () => {
        if (selectedTerms.size === periodSummary.length) {
            setSelectedTerms(new Set());
        } else {
            setSelectedTerms(new Set(periodSummary.map((p) => p.term)));
        }
    };

    const handleBulkDelete = async () => {
        if (confirmText !== "ELIMINAR") {
            toast.error('Escribe "ELIMINAR" para confirmar');
            return;
        }
        if (selectedTerms.size === 0) return;
        setBulkDeleting(true);
        try {
            const terms = Array.from(selectedTerms);
            const res = await Grades.bulkDeleteHistorical(studentId, terms);
            if (res?.error) {
                toast.error(res.error);
            } else {
                const n = res?.deleted ?? 0;
                toast.success(`${n} registro(s) eliminado(s) de ${terms.length} periodo(s)`);
            }
            setShowDeleteConfirm(false);
            setConfirmText("");
            setSelectedTerms(new Set());
            await loadRecords();
        } catch (e) {
            toast.error("Error eliminando periodos");
        } finally {
            setBulkDeleting(false);
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

                {/* ── Eliminación masiva de periodos (reingreso/cachimbo) ── */}
                {!loading && periodSummary.length > 0 && (
                    <div className="border border-rose-200 bg-rose-50/40 rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div>
                                <h4 className="font-semibold text-sm text-rose-900 flex items-center gap-1.5">
                                    <RotateCcw className="h-4 w-4" />
                                    Limpiar historial por periodo
                                </h4>
                                <p className="text-xs text-rose-700/80 mt-0.5">
                                    Útil si el alumno <strong>reingresa como cachimbo</strong> y debe
                                    eliminarse data antigua. Selecciona los periodos a borrar.
                                </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs h-7 text-rose-700"
                                    onClick={toggleAllTerms}
                                >
                                    {selectedTerms.size === periodSummary.length ? "Quitar todos" : "Seleccionar todos"}
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    className="h-7 bg-rose-600 hover:bg-rose-700 text-white text-xs gap-1.5"
                                    disabled={selectedTerms.size === 0}
                                    onClick={() => setShowDeleteConfirm(true)}
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Eliminar {selectedTerms.size > 0 && `(${selectedTerms.size})`}
                                </Button>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                            {periodSummary.map((p) => {
                                const isSel = selectedTerms.has(p.term);
                                return (
                                    <button
                                        key={p.term}
                                        type="button"
                                        onClick={() => toggleTerm(p.term)}
                                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border transition-all ${isSel
                                            ? "bg-rose-100 border-rose-400 text-rose-900 ring-2 ring-rose-300 ring-offset-1"
                                            : "bg-white border-slate-200 text-slate-700 hover:border-rose-300"}`}
                                        title={`${p.count} curso(s) en ${p.term}`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isSel}
                                            readOnly
                                            className="accent-rose-600 w-3 h-3"
                                        />
                                        {p.term}
                                        <span className="text-[10px] opacity-70">({p.count})</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

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
                                    const isEditing = editingId === rec.id;
                                    // Estado: usa el valor en edición si existe, sino el de la BD,
                                    // siempre con la escala oficial MINEDU (5 niveles).
                                    const gradeForEstado = isEditing
                                        ? (editValue === "" ? null : Number(editValue))
                                        : rec.final_grade;
                                    const estado = estadoMinedu(gradeForEstado);
                                    return (
                                        <tr key={rec.id} className={`border-b hover:bg-muted/50 ${isEditing ? "bg-amber-50/40" : ""}`}>
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
                                                {isEditing ? (
                                                    <Input
                                                        autoFocus
                                                        type="number"
                                                        min={0}
                                                        max={20}
                                                        step="1"
                                                        value={editValue}
                                                        onChange={(e) => setEditValue(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter") saveEdit(rec);
                                                            else if (e.key === "Escape") cancelEdit();
                                                        }}
                                                        disabled={savingEdit}
                                                        className="h-8 w-16 text-center font-bold mx-auto"
                                                    />
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => startEdit(rec)}
                                                        className="group inline-flex items-center gap-1 px-2 py-0.5 rounded hover:bg-amber-100 transition"
                                                        title="Click para editar la nota"
                                                    >
                                                        <span>{rec.final_grade != null ? rec.final_grade : "-"}</span>
                                                        <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60" />
                                                    </button>
                                                )}
                                            </td>
                                            <td className="py-2 pr-3 text-center">
                                                <Badge
                                                    variant="outline"
                                                    className={`text-xs whitespace-nowrap ${estadoBadgeClass(estado)}`}
                                                >
                                                    {estado || "—"}
                                                </Badge>
                                            </td>
                                            <td className="py-2">
                                                {isEditing ? (
                                                    <div className="flex items-center gap-0.5">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 text-emerald-700"
                                                            onClick={() => saveEdit(rec)}
                                                            disabled={savingEdit}
                                                            title="Guardar (Enter)"
                                                        >
                                                            {savingEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 text-slate-500"
                                                            onClick={cancelEdit}
                                                            disabled={savingEdit}
                                                            title="Cancelar (Esc)"
                                                        >
                                                            <X className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-0.5">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7"
                                                            onClick={() => startEdit(rec)}
                                                            title="Editar nota"
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 text-destructive"
                                                            onClick={() => handleDelete(rec.id)}
                                                            title="Eliminar nota"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>

            {/* ── Diálogo de confirmación de eliminación masiva ── */}
            {showDeleteConfirm && (
                <div
                    className="fixed inset-0 z-[210] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                    onClick={() => !bulkDeleting && setShowDeleteConfirm(false)}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden ring-1 ring-rose-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-5 py-3 bg-gradient-to-r from-rose-50 to-red-50 border-b border-rose-200 flex items-center gap-3">
                            <div className="h-9 w-9 rounded-lg bg-rose-100 grid place-items-center">
                                <AlertTriangle className="w-5 h-5 text-rose-600" />
                            </div>
                            <div>
                                <h4 className="text-sm font-extrabold text-rose-900">
                                    Eliminar periodos completos
                                </h4>
                                <p className="text-[11px] text-rose-700">
                                    Esta acción es <strong>permanente</strong> y no se puede deshacer.
                                </p>
                            </div>
                        </div>

                        <div className="p-5 space-y-3">
                            <p className="text-xs text-slate-700">
                                Se eliminarán <strong>todas las notas</strong> del alumno
                                {studentName ? <> <strong>{studentName}</strong></> : null} en los
                                siguientes periodos:
                            </p>

                            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 border border-rose-200 rounded-md bg-rose-50/30">
                                {Array.from(selectedTerms).sort().map((t) => {
                                    const item = periodSummary.find((p) => p.term === t);
                                    return (
                                        <span
                                            key={t}
                                            className="px-2 py-0.5 rounded bg-rose-200/60 text-rose-900 font-bold text-[11px]"
                                        >
                                            {t}
                                            {item && <span className="opacity-60 ml-1">({item.count})</span>}
                                        </span>
                                    );
                                })}
                            </div>

                            <div className="space-y-1">
                                <Label className="text-[11px] font-bold text-rose-900">
                                    Para confirmar, escribe <code className="bg-rose-100 px-1 rounded font-mono">ELIMINAR</code>:
                                </Label>
                                <Input
                                    value={confirmText}
                                    onChange={(e) => setConfirmText(e.target.value)}
                                    placeholder="ELIMINAR"
                                    className="h-8 text-sm uppercase font-bold tracking-wider"
                                    disabled={bulkDeleting}
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs"
                                onClick={() => { setShowDeleteConfirm(false); setConfirmText(""); }}
                                disabled={bulkDeleting}
                            >
                                Cancelar
                            </Button>
                            <Button
                                size="sm"
                                className="h-8 bg-rose-600 hover:bg-rose-700 text-white text-xs gap-1.5"
                                onClick={handleBulkDelete}
                                disabled={bulkDeleting || confirmText !== "ELIMINAR" || selectedTerms.size === 0}
                            >
                                {bulkDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                                Eliminar {selectedTerms.size} periodo{selectedTerms.size === 1 ? "" : "s"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            <ConfirmModal data={confirmData} onClose={() => setConfirmData(null)} />
        </Card>
    );
}
