// src/modules/admission/EvaluationBoard.jsx
import React, { useEffect, useState } from "react";
import { AdmissionCalls, Evaluation } from "../../services/admission.service";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";

export default function EvaluationBoard() {
    const [calls, setCalls] = useState([]);
    const [call, setCall] = useState(null);
    const [careerId, setCareerId] = useState("");
    const [rows, setRows] = useState([]);

    // pesos de rúbrica
    const [weights, setWeights] = useState({ exam: 0.6, cv: 0.2, interview: 0.2 });

    // estado de puntajes por fila: { [appId]: { exam, cv, interview } }
    const [scores, setScores] = useState({});

    useEffect(() => {
        AdmissionCalls.listAdmin().then(d => {
            const list = d?.admission_calls || d?.calls || d || [];
            setCalls(list);
            setCall(list[0] || null);
        });
    }, []);

    const load = async () => {
        if (!call || !careerId) return;
        const data = await Evaluation.listForScoring({ call_id: call.id, career_id: careerId });
        const list = data?.applications || data || [];
        setRows(list);

        // precargar puntajes existentes
        const init = {};
        list.forEach(r => { init[r.id] = { exam: r.rubric?.exam ?? 0, cv: r.rubric?.cv ?? 0, interview: r.rubric?.interview ?? 0 }; });
        setScores(init);
    };

    useEffect(() => { if (call && careerId) load(); }, [call?.id, careerId]);

    const setField = (id, field, val) =>
        setScores(prev => ({ ...prev, [id]: { ...prev[id], [field]: val } }));

    const save = async (appId) => {
        const rubric = scores[appId] || { exam: 0, cv: 0, interview: 0 };
        await Evaluation.saveScores(appId, rubric);
        toast.success("Guardado");
    };

    const computeAll = async () => {
        await Evaluation.bulkCompute(call.id);
        toast.success("Cómputo final realizado");
        load();
    };

    return (
        <Card>
            <CardHeader><CardTitle>Evaluación de Postulantes</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <div className="grid md:grid-cols-3 gap-3">
                    <div>
                        <label className="text-sm">Convocatoria</label>
                        <Select value={call?.id?.toString()} onValueChange={(v) => setCall(calls.find(x => x.id.toString() === v))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {calls.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <label className="text-sm">Carrera</label>
                        <Select value={careerId} onValueChange={setCareerId}>
                            <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                            <SelectContent>
                                {call?.careers?.map(k => <SelectItem key={k.id} value={k.id.toString()}>{k.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <Input value={weights.exam} onChange={e => setWeights({ ...weights, exam: parseFloat(e.target.value) || 0 })} />
                        <Input value={weights.cv} onChange={e => setWeights({ ...weights, cv: parseFloat(e.target.value) || 0 })} />
                        <Input value={weights.interview} onChange={e => setWeights({ ...weights, interview: parseFloat(e.target.value) || 0 })} />
                        <div className="col-span-3 text-xs text-gray-500">Pesos: examen / CV / entrevista</div>
                    </div>
                </div>

                <div className="border rounded overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="p-2 text-left">N°</th>
                                <th className="p-2 text-left">Postulante</th>
                                <th className="p-2">Examen</th>
                                <th className="p-2">CV</th>
                                <th className="p-2">Entrevista</th>
                                <th className="p-2">Final</th>
                                <th className="p-2"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r, i) => {
                                const s = scores[r.id] || { exam: 0, cv: 0, interview: 0 };
                                const final = +(s.exam * weights.exam + s.cv * weights.cv + s.interview * weights.interview).toFixed(2);
                                return (
                                    <tr key={r.id} className="border-t">
                                        <td className="p-2">{i + 1}</td>
                                        <td className="p-2">{r.applicant_name} ({r.application_number})</td>
                                        <td className="p-2"><Input type="number" step="0.1" value={s.exam} onChange={e => setField(r.id, "exam", parseFloat(e.target.value) || 0)} /></td>
                                        <td className="p-2"><Input type="number" step="0.1" value={s.cv} onChange={e => setField(r.id, "cv", parseFloat(e.target.value) || 0)} /></td>
                                        <td className="p-2"><Input type="number" step="0.1" value={s.interview} onChange={e => setField(r.id, "interview", parseFloat(e.target.value) || 0)} /></td>
                                        <td className="p-2 text-center font-medium">{final}</td>
                                        <td className="p-2"><Button size="sm" onClick={() => save(r.id)}>Guardar</Button></td>
                                    </tr>
                                );
                            })}
                            {rows.length === 0 && <tr><td className="p-4 text-center" colSpan={7}>Sin registros</td></tr>}
                        </tbody>
                    </table>
                </div>

                <div className="flex justify-end">
                    <Button onClick={computeAll}>Calcular puntajes finales</Button>
                </div>
            </CardContent>
        </Card>
    );
}
