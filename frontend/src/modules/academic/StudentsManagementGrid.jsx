/* ═══════════════════════════════════════════════════════════════
   StudentsManagementGrid
   Vista tipo data-grid para que admin gestione masivamente alumnos:
   filtros por carrera, ciclo, periodo · "solo incompletos" ·
   edición inline de fecha_nac y sexo · badges de datos faltantes ·
   buscador por DNI/nombre.
   ═══════════════════════════════════════════════════════════════ */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
    Search, Loader2, RefreshCw, AlertCircle, Check, X,
    Pencil, GraduationCap, Filter, Users,
} from "lucide-react";
import { StudentsService } from "@/services/students.service";
import { Careers } from "@/services/academic.service";

const ROMAN = ["I","II","III","IV","V","VI","VII","VIII","IX","X"];
const SEX_OPTIONS = [
    { value: "M", label: "Masculino" },
    { value: "F", label: "Femenino" },
];

function periodOptions() {
    const y = new Date().getFullYear();
    const out = [];
    for (let i = y + 1; i >= y - 3; i--) { out.push(`${i}-II`); out.push(`${i}-I`); }
    return out;
}
function defaultPeriod() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() < 7 ? "I" : "II"}`;
}

const missingLabel = (k) => ({
    fecha_nac: "Fecha Nac.",
    sexo: "Sexo",
    nombres: "Nombres",
    apellido_paterno: "Ap. Paterno",
}[k] || k);

export default function StudentsManagementGrid({
    initialFilters = null,
    onSelectStudent = null,
    showSelectAction = false,
}) {
    const [careers, setCareers] = useState([]);
    const [filters, setFilters] = useState({
        career_id: initialFilters?.career_id || "",
        ciclo:     initialFilters?.ciclo     || "",
        periodo:   initialFilters?.periodo   || defaultPeriod(),
        incomplete: false,
        q: "",
    });

    // Si el padre cambia los filtros desde afuera (ej. al clickear matriz),
    // sincronizamos sin reset del search query
    useEffect(() => {
        if (!initialFilters) return;
        setFilters((f) => ({
            ...f,
            career_id: initialFilters.career_id ?? f.career_id,
            ciclo:     initialFilters.ciclo     ?? f.ciclo,
            periodo:   initialFilters.periodo   ?? f.periodo,
        }));
    }, [initialFilters?.career_id, initialFilters?.ciclo, initialFilters?.periodo]);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editValues, setEditValues] = useState({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        Careers.list().then((d) => {
            const list = Array.isArray(d?.careers) ? d.careers : Array.isArray(d) ? d : [];
            setCareers(list);
        }).catch(() => setCareers([]));
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = { only_students: 1 };
            if (filters.career_id) params.career_id = filters.career_id;
            if (filters.ciclo)     params.ciclo = filters.ciclo;
            if (filters.periodo)   params.periodo = filters.periodo;
            if (filters.incomplete) params.incomplete = 1;
            if (filters.q.trim())  params.q = filters.q.trim();
            const data = await StudentsService.list(params);
            setStudents(Array.isArray(data?.students) ? data.students : []);
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Error cargando alumnos");
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => { load(); }, [load]);

    const totals = useMemo(() => {
        const incomp = students.filter((s) => s.data_incomplete).length;
        return { total: students.length, incomplete: incomp };
    }, [students]);

    const startEdit = (s) => {
        setEditingId(s.id);
        setEditValues({
            nombres: s.nombres || "",
            apellidoPaterno: s.apellidoPaterno || s.apellido_paterno || "",
            apellidoMaterno: s.apellidoMaterno || s.apellido_materno || "",
            fechaNac: s.fechaNac || s.fecha_nac || "",
            sexo: (s.sexo || "").toUpperCase(),
            email: s.email || "",
        });
    };
    const cancelEdit = () => { setEditingId(null); setEditValues({}); };
    const saveEdit = async (s) => {
        const payload = {};
        if (editValues.nombres        !== (s.nombres || "")) payload.nombres = editValues.nombres;
        if (editValues.apellidoPaterno !== (s.apellidoPaterno || s.apellido_paterno || ""))
            payload.apellidoPaterno = editValues.apellidoPaterno;
        if (editValues.apellidoMaterno !== (s.apellidoMaterno || s.apellido_materno || ""))
            payload.apellidoMaterno = editValues.apellidoMaterno;
        if (editValues.fechaNac !== (s.fechaNac || s.fecha_nac || ""))
            payload.fechaNac = editValues.fechaNac || null;   // fechaNac SÍ acepta null
        if ((editValues.sexo || "") !== (s.sexo || "").toUpperCase())
            payload.sexo = editValues.sexo || "";             // sexo NO acepta null → ""
        if (editValues.email !== (s.email || "")) payload.email = editValues.email;

        if (!Object.keys(payload).length) { cancelEdit(); return; }
        setSaving(true);
        try {
            await StudentsService.update(s.id, payload);
            toast.success("Alumno actualizado");
            cancelEdit();
            load();
        } catch (e) {
            // Extraer error real (detail o field-level errors DRF)
            const data = e?.response?.data;
            let msg = "Error guardando cambios";
            if (typeof data === "string") msg = data;
            else if (data?.detail) msg = data.detail;
            else if (data && typeof data === "object") {
                const parts = Object.entries(data).map(([field, errs]) => {
                    const list = Array.isArray(errs) ? errs.join(", ") : String(errs);
                    return `${field}: ${list}`;
                });
                if (parts.length) msg = parts.join(" · ");
            }
            toast.error(msg);
        } finally {
            setSaving(false);
        }
    };

    const careerName = (st) =>
        st.career_name || st.carrera || st.plan_career_name ||
        (st.plan && (st.plan.career_name || st.plan.career)) || "—";

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                    <span className="flex items-center gap-2 text-base font-extrabold">
                        <Users className="w-5 h-5 text-blue-600" /> Gestión de Estudiantes
                    </span>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Badge variant="outline" className="font-mono">
                            {totals.total} alumnos
                        </Badge>
                        {totals.incomplete > 0 && (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                {totals.incomplete} incompletos
                            </Badge>
                        )}
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* ── Filtros ── */}
                <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end p-3 rounded-lg bg-slate-50 border">
                    <div className="md:col-span-2">
                        <Label className="text-[10px] font-bold uppercase">Buscar</Label>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
                            <Input
                                placeholder="DNI, nombres, apellidos..."
                                value={filters.q}
                                onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
                                className="pl-8 h-9"
                            />
                        </div>
                    </div>
                    <div>
                        <Label className="text-[10px] font-bold uppercase">Carrera</Label>
                        <Select
                            value={filters.career_id || "ALL"}
                            onValueChange={(v) => setFilters((f) => ({ ...f, career_id: v === "ALL" ? "" : v }))}
                        >
                            <SelectTrigger className="h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Todas</SelectItem>
                                {careers.map((c) => (
                                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label className="text-[10px] font-bold uppercase">Ciclo</Label>
                        <Select
                            value={filters.ciclo || "ALL"}
                            onValueChange={(v) => setFilters((f) => ({ ...f, ciclo: v === "ALL" ? "" : v }))}
                        >
                            <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Todos</SelectItem>
                                {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                                    <SelectItem key={n} value={String(n)}>Ciclo {ROMAN[n-1]}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label className="text-[10px] font-bold uppercase">Periodo</Label>
                        <Select
                            value={filters.periodo || "ALL"}
                            onValueChange={(v) => setFilters((f) => ({ ...f, periodo: v === "ALL" ? "" : v }))}
                        >
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Todos</SelectItem>
                                {periodOptions().map((p) => (
                                    <SelectItem key={p} value={p}>{p}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <Label className="text-[10px] font-bold uppercase invisible">_</Label>
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                variant={filters.incomplete ? "default" : "outline"}
                                onClick={() => setFilters((f) => ({ ...f, incomplete: !f.incomplete }))}
                                className="h-9 gap-1.5"
                                title="Solo alumnos con datos faltantes"
                            >
                                <Filter className="w-3.5 h-3.5" />
                                {filters.incomplete ? "Solo incompletos" : "Todos"}
                            </Button>
                            <Button size="icon" variant="ghost" className="h-9 w-9" onClick={load} title="Recargar">
                                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* ── Tabla ── */}
                <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-100 text-[11px] uppercase tracking-wider text-slate-600">
                            <tr>
                                <th className="px-2 py-2 text-left">DNI</th>
                                <th className="px-2 py-2 text-left">Apellidos y Nombres</th>
                                <th className="px-2 py-2 text-left">Carrera</th>
                                <th className="px-2 py-2 text-center">Ciclo</th>
                                <th className="px-2 py-2 text-center">F. Nacimiento</th>
                                <th className="px-2 py-2 text-center">Sexo</th>
                                <th className="px-2 py-2 text-left">Email</th>
                                <th className="px-2 py-2 text-center">Estado</th>
                                <th className="px-2 py-2 text-center w-24">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && students.length === 0 && (
                                <tr><td colSpan={9} className="py-10 text-center text-slate-500">
                                    <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Cargando alumnos…
                                </td></tr>
                            )}
                            {!loading && students.length === 0 && (
                                <tr><td colSpan={9} className="py-10 text-center text-slate-500">
                                    Sin resultados para los filtros aplicados.
                                </td></tr>
                            )}
                            {students.map((s) => {
                                const isEditing = editingId === s.id;
                                const ap = s.apellidoPaterno || s.apellido_paterno || "";
                                const am = s.apellidoMaterno || s.apellido_materno || "";
                                const fn = s.fechaNac || s.fecha_nac || "";
                                const sx = (s.sexo || "").toUpperCase();
                                const missing = s.missing_fields || [];
                                const incomplete = !!s.data_incomplete;

                                return (
                                    <tr key={s.id} className={`border-t hover:bg-slate-50 ${isEditing ? "bg-amber-50/40" : incomplete ? "bg-rose-50/30" : ""}`}>
                                        <td className="px-2 py-1.5 font-mono text-xs">{s.numDocumento || s.num_documento}</td>
                                        <td className="px-2 py-1.5">
                                            {isEditing ? (
                                                <div className="flex flex-col gap-1">
                                                    <Input className="h-7 text-xs" placeholder="Ap. Paterno"
                                                        value={editValues.apellidoPaterno}
                                                        onChange={(e) => setEditValues((v) => ({ ...v, apellidoPaterno: e.target.value }))} />
                                                    <Input className="h-7 text-xs" placeholder="Ap. Materno"
                                                        value={editValues.apellidoMaterno}
                                                        onChange={(e) => setEditValues((v) => ({ ...v, apellidoMaterno: e.target.value }))} />
                                                    <Input className="h-7 text-xs" placeholder="Nombres"
                                                        value={editValues.nombres}
                                                        onChange={(e) => setEditValues((v) => ({ ...v, nombres: e.target.value }))} />
                                                </div>
                                            ) : (
                                                <span className="font-medium uppercase">
                                                    {ap} {am}, {s.nombres || ""}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-2 py-1.5 text-xs text-slate-700">{careerName(s)}</td>
                                        <td className="px-2 py-1.5 text-center font-bold">{s.ciclo ?? "—"}</td>
                                        <td className="px-2 py-1.5 text-center">
                                            {isEditing ? (
                                                <Input type="date" className="h-7 text-xs w-32 mx-auto"
                                                    value={editValues.fechaNac || ""}
                                                    onChange={(e) => setEditValues((v) => ({ ...v, fechaNac: e.target.value }))} />
                                            ) : fn ? (
                                                <span className="text-xs">{String(fn).slice(0, 10)}</span>
                                            ) : (
                                                <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-[10px]">
                                                    falta
                                                </Badge>
                                            )}
                                        </td>
                                        <td className="px-2 py-1.5 text-center">
                                            {isEditing ? (
                                                <Select value={editValues.sexo || "_"}
                                                    onValueChange={(v) => setEditValues((vv) => ({ ...vv, sexo: v === "_" ? "" : v }))}>
                                                    <SelectTrigger className="h-7 text-xs w-20 mx-auto"><SelectValue placeholder="—" /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="_">—</SelectItem>
                                                        {SEX_OPTIONS.map((o) => (
                                                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            ) : sx ? (
                                                <Badge variant="outline" className="text-[10px]">{sx === "M" ? "Masc." : sx === "F" ? "Fem." : sx}</Badge>
                                            ) : (
                                                <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-[10px]">
                                                    falta
                                                </Badge>
                                            )}
                                        </td>
                                        <td className="px-2 py-1.5 text-xs">
                                            {isEditing ? (
                                                <Input className="h-7 text-xs" placeholder="email@..."
                                                    value={editValues.email || ""}
                                                    onChange={(e) => setEditValues((v) => ({ ...v, email: e.target.value }))} />
                                            ) : (
                                                <span className="text-slate-600">{s.email || "—"}</span>
                                            )}
                                        </td>
                                        <td className="px-2 py-1.5 text-center">
                                            {incomplete ? (
                                                <span title={missing.map(missingLabel).join(", ")}>
                                                    <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px]">
                                                        ⚠ Falta {missing.length}
                                                    </Badge>
                                                </span>
                                            ) : (
                                                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">
                                                    ✓ OK
                                                </Badge>
                                            )}
                                        </td>
                                        <td className="px-2 py-1.5 text-center">
                                            {isEditing ? (
                                                <div className="flex justify-center gap-0.5">
                                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-700"
                                                        onClick={() => saveEdit(s)} disabled={saving} title="Guardar (Enter)">
                                                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                                    </Button>
                                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-500"
                                                        onClick={cancelEdit} disabled={saving} title="Cancelar">
                                                        <X className="w-3.5 h-3.5" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="flex justify-center gap-0.5">
                                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(s)} title="Editar inline">
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </Button>
                                                    {showSelectAction && onSelectStudent && (
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-7 w-7 text-blue-700 hover:bg-blue-50"
                                                            onClick={() => onSelectStudent(s)}
                                                            title="Abrir ficha completa / Historial académico"
                                                        >
                                                            <GraduationCap className="w-3.5 h-3.5" />
                                                        </Button>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}
