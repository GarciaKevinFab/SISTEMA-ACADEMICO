/**
 * tabs/EvaluationTab.jsx
 * Evaluación del proyecto de investigación
 *
 * - Rúbrica con sliders (0-20), pesos configurables
 * - Total ponderado calculado en tiempo real
 * - Historial de evaluaciones con detalle expandible
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { Evaluations } from "../../../services/research.service";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";

import { BarChart3, Loader2, ChevronDown, ChevronUp, Save } from "lucide-react";
import { toast } from "sonner";

// Rúbrica por defecto del proyecto (puede venir del backend en el futuro)
const DEFAULT_RUBRIC = [
    { code: "originality", label: "Originalidad", weight: 0.20 },
    { code: "methodology", label: "Metodología", weight: 0.25 },
    { code: "feasibility", label: "Viabilidad", weight: 0.25 },
    { code: "impact", label: "Impacto", weight: 0.20 },
    { code: "presentation", label: "Presentación y redacción", weight: 0.10 },
];

export default function EvaluationTab({ projectId }) {
    const [evaluations, setEvaluations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Form
    const [scores, setScores] = useState({});
    const [comment, setComment] = useState("");

    // Historial expandible
    const [expandedId, setExpandedId] = useState(null);

    const load = useCallback(async () => {
        if (!projectId) return;
        setLoading(true);
        try {
            const data = await Evaluations.list(projectId);
            setEvaluations(Array.isArray(data) ? data : []);
        } catch {
            setEvaluations([]);
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => { load(); }, [load]);

    // ── Cálculo del total ponderado ──
    const total = useMemo(() => {
        return DEFAULT_RUBRIC.reduce((acc, cr) => {
            const score = Number(scores[cr.code] || 0);
            return acc + score * cr.weight;
        }, 0);
    }, [scores]);

    const maxPossible = DEFAULT_RUBRIC.reduce((acc, cr) => acc + 20 * cr.weight, 0);

    const totalPct = maxPossible > 0 ? (total / maxPossible) * 100 : 0;

    const qualityLabel = total >= 16 ? "Excelente"
        : total >= 13 ? "Bueno"
            : total >= 10 ? "Regular"
                : total > 0 ? "Deficiente"
                    : "—";

    const qualityColor = total >= 16 ? "text-emerald-600"
        : total >= 13 ? "text-blue-600"
            : total >= 10 ? "text-amber-600"
                : total > 0 ? "text-red-600"
                    : "text-slate-400";

    // ── Guardar evaluación ──
    const saveEvaluation = async () => {
        const hasScores = Object.values(scores).some(v => Number(v) > 0);
        if (!hasScores) {
            toast.error("Ingrese al menos un puntaje");
            return;
        }
        setSaving(true);
        try {
            await Evaluations.save(projectId, {
                scores,
                comment,
                total: total.toFixed(2),
            });
            toast.success("Evaluación registrada");
            setScores({});
            setComment("");
            load();
        } catch {
            toast.error("Error al guardar evaluación");
        } finally {
            setSaving(false);
        }
    };

    // ── Promedio histórico ──
    const avgScore = useMemo(() => {
        if (evaluations.length === 0) return null;
        const totals = evaluations
            .map(ev => Number(ev.rubric?.total || 0))
            .filter(t => t > 0);
        return totals.length > 0
            ? (totals.reduce((a, b) => a + b, 0) / totals.length).toFixed(2)
            : null;
    }, [evaluations]);

    // ── Render ──
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Evaluación del Proyecto
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                    </div>
                ) : (
                    <>
                        {/* ── Formulario de evaluación ── */}
                        <div className="border rounded-lg p-4 space-y-4">
                            <h4 className="font-medium text-sm">Nueva Evaluación</h4>

                            <div className="space-y-3">
                                {DEFAULT_RUBRIC.map(cr => (
                                    <div key={cr.code} className="space-y-1">
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm">
                                                {cr.label}
                                                <span className="text-xs text-slate-400 ml-1">
                                                    ({(cr.weight * 100).toFixed(0)}%)
                                                </span>
                                            </label>
                                            <span className="text-sm font-mono w-10 text-right">
                                                {scores[cr.code] || 0}
                                            </span>
                                        </div>
                                        <Slider
                                            value={[Number(scores[cr.code] || 0)]}
                                            max={20}
                                            step={1}
                                            onValueChange={([v]) => setScores(prev => ({
                                                ...prev,
                                                [cr.code]: v,
                                            }))}
                                        />
                                    </div>
                                ))}
                            </div>

                            <Separator />

                            <div className="flex items-center justify-between">
                                <div>
                                    <span className="text-sm font-medium">Total ponderado: </span>
                                    <span className={`text-lg font-bold ${qualityColor}`}>
                                        {total.toFixed(2)}
                                    </span>
                                    <span className="text-xs text-slate-400 ml-1">/ {maxPossible.toFixed(0)}</span>
                                    <Badge variant="outline" className={`ml-2 text-xs ${qualityColor}`}>
                                        {qualityLabel}
                                    </Badge>
                                </div>
                            </div>

                            <Textarea
                                placeholder="Comentarios y observaciones del evaluador..."
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                rows={3}
                            />

                            <div className="flex justify-end">
                                <Button onClick={saveEvaluation} disabled={saving}>
                                    {saving
                                        ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                                        : <Save className="h-3.5 w-3.5 mr-1" />
                                    }
                                    Registrar Evaluación
                                </Button>
                            </div>
                        </div>

                        {/* ── Historial ── */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="font-medium text-sm">
                                    Historial de Evaluaciones ({evaluations.length})
                                </h4>
                                {avgScore && (
                                    <Badge variant="outline">
                                        Promedio: {avgScore}
                                    </Badge>
                                )}
                            </div>

                            {evaluations.length === 0 ? (
                                <p className="text-sm text-slate-500 text-center py-4">
                                    No hay evaluaciones registradas
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {evaluations.map(ev => {
                                        const evTotal = Number(ev.rubric?.total || 0);
                                        const isExpanded = expandedId === ev.id;
                                        return (
                                            <div
                                                key={ev.id}
                                                className="border rounded-lg overflow-hidden"
                                            >
                                                <button
                                                    type="button"
                                                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
                                                    onClick={() => setExpandedId(isExpanded ? null : ev.id)}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-sm font-bold font-mono">
                                                            {evTotal.toFixed(2)}
                                                        </span>
                                                        <span className="text-xs text-slate-500">
                                                            {ev.evaluator_name || "Evaluador"}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-slate-400">
                                                            {ev.created_at
                                                                ? new Date(ev.created_at).toLocaleDateString("es-PE")
                                                                : "—"
                                                            }
                                                        </span>
                                                        {isExpanded
                                                            ? <ChevronUp className="h-4 w-4 text-slate-400" />
                                                            : <ChevronDown className="h-4 w-4 text-slate-400" />
                                                        }
                                                    </div>
                                                </button>
                                                {isExpanded && (
                                                    <div className="px-4 pb-3 border-t bg-slate-50/50 space-y-2">
                                                        {/* Scores detail */}
                                                        {ev.rubric?.scores && (
                                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pt-2">
                                                                {DEFAULT_RUBRIC.map(cr => {
                                                                    const val = ev.rubric.scores[cr.code];
                                                                    return val !== undefined ? (
                                                                        <div key={cr.code} className="text-xs">
                                                                            <span className="text-slate-500">{cr.label}: </span>
                                                                            <span className="font-mono font-medium">{val}</span>
                                                                        </div>
                                                                    ) : null;
                                                                })}
                                                            </div>
                                                        )}
                                                        {ev.rubric?.comment && (
                                                            <p className="text-xs text-slate-600 italic mt-1">
                                                                "{ev.rubric.comment}"
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}