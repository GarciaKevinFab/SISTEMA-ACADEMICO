/* ═══════════════════════════════════════════════════════════════
   MÓDULO MESA DE CONTROL ACADÉMICA

   Le da a Secretaría, desde el sistema, lo que hasta ahora solo se podía
   hacer por consola. Nació de casos reales de alumnos que no aparecían
   donde debían, y cada pestaña resuelve una de las causas encontradas:

     Incidencias · los casos por resolver, con corrección masiva segura
     Alumno      · radiografía y edición de una matrícula CONFIRMADA
                   (agregar, quitar y asignar sección de un curso)
     Sección     · el acta tal como la calcula el sistema vs. la nómina
     Duplicados  · fusionar el kárdex de dos fichas de la misma persona

   El hueco de fondo que cubre: `enrollments/commit` se niega si la
   matrícula está confirmada y `reset-student` borra la matrícula con su
   pago, así que no había forma de corregir un curso sin destruir datos.

   Backend: academic/services/mesa_control.py
   ═══════════════════════════════════════════════════════════════ */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
    Loader2, Search, RefreshCw, AlertTriangle, CheckCircle2, Users,
    ClipboardList, GitMerge, Wrench, Plus, Trash2, MapPin, ShieldAlert,
    ExternalLink,
} from "lucide-react";
import { MesaControl as Api } from "@/services/mesaControl.service";

/* ─────────────────────── piezas de UI ─────────────────────── */

const Card = ({ children, className = "" }) => (
    <div className={`rounded-2xl border border-slate-200/80 bg-white shadow-sm ${className}`}>
        {children}
    </div>
);

const CardHead = ({ icon: Icon, title, hint, right }) => (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-5 py-4 border-b border-slate-100">
        <div className="min-w-0">
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                {Icon && <Icon size={16} className="text-blue-600 shrink-0" />} {title}
            </h3>
            {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
        </div>
        {right}
    </div>
);

const Kpi = ({ label, value, tone = "slate", activo, onClick }) => {
    const tones = {
        slate: "border-slate-200 bg-slate-50 text-slate-700",
        rose: "border-rose-300 bg-rose-50 text-rose-700",
        amber: "border-amber-300 bg-amber-50 text-amber-700",
        emerald: "border-emerald-300 bg-emerald-50 text-emerald-700",
    };
    return (
        <button type="button" onClick={onClick} disabled={!onClick}
            className={`flex-1 min-w-[130px] rounded-xl border px-3 py-2 text-left transition-all
                ${tones[tone]} ${activo ? "ring-2 ring-blue-400 ring-offset-1" : ""}
                ${onClick ? "hover:shadow-sm cursor-pointer" : "cursor-default"}`}>
            <b className="block text-2xl leading-tight">{value}</b>
            <span className="text-[10px] uppercase tracking-wider font-bold opacity-80">{label}</span>
        </button>
    );
};

const Vacio = ({ children }) => (
    <div className="py-10 text-center text-sm text-slate-400 flex flex-col items-center gap-2">
        <CheckCircle2 size={20} className="text-emerald-400" />
        {children}
    </div>
);

const EstadoBadge = ({ estado }) => {
    if (!estado) return null;
    const map = {
        LICENCIA: "bg-rose-100 text-rose-700 border-rose-300",
        SUBSANACION: "bg-orange-100 text-orange-700 border-orange-300",
        REINCORPORACION: "bg-blue-100 text-blue-700 border-blue-300",
        TRASLADO: "bg-violet-100 text-violet-700 border-violet-300",
    };
    return (
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${map[estado] || "bg-slate-100 text-slate-600 border-slate-300"}`}>
            {estado}
        </span>
    );
};

/** Selector + botón para asignar la sección de un curso ya matriculado.
 *  Un ítem sin sección no aparece en ningún acta, así que esta es la
 *  corrección más frecuente. */
function AsignarSeccion({ secciones, cargando, onAsignar }) {
    const [sel, setSel] = useState(secciones.length === 1 ? String(secciones[0].section_id) : "");
    if (!secciones.length) {
        return <span className="text-[10px] text-slate-500">sin sección creada — hay que crearla primero</span>;
    }
    return (
        <span className="inline-flex items-center gap-1.5">
            {secciones.length > 1 && (
                <select value={sel} onChange={(e) => setSel(e.target.value)}
                    className="h-7 px-1.5 text-[11px] rounded-lg border border-slate-200 bg-white">
                    <option value="">— sección —</option>
                    {secciones.map((s) => (
                        <option key={s.section_id} value={s.section_id}>{s.label}</option>
                    ))}
                </select>
            )}
            <Button size="sm" className="h-7 gap-1 text-[11px] bg-blue-600 hover:bg-blue-700"
                disabled={cargando}
                onClick={() => {
                    const id = secciones.length === 1 ? secciones[0].section_id : sel;
                    if (!id) return toast.error("Elegí la sección.");
                    onAsignar(id);
                }}>
                {cargando ? <Loader2 size={11} className="animate-spin" /> : <MapPin size={11} />}
                Asignar
            </Button>
        </span>
    );
}

/* ═══════════════════════ 1. INCIDENCIAS ═══════════════════════ */

function PanelIncidencias({ period, irAlumno, irSeccion }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [aplicando, setAplicando] = useState("");
    const [confirmar, setConfirmar] = useState(null);
    const [ver, setVer] = useState("sin_seccion");

    const cargar = useCallback(async () => {
        if (!period) return;
        setLoading(true);
        try { setData(await Api.incidencias(period)); }
        catch (e) { toast.error(e.message); }
        finally { setLoading(false); }
    }, [period]);

    useEffect(() => { cargar(); }, [cargar]);

    /* Toda corrección masiva se simula antes: se muestra cuántos casos toca */
    const simular = async (accion, titulo) => {
        setAplicando(accion);
        try {
            const res = await Api.corregir(accion, period, false);
            if (!res?.afectados) return toast.info("No hay casos que corregir con esa acción.");
            setConfirmar({ accion, titulo, n: res.afectados, detalle: res.detalle });
        } catch (e) { toast.error(e.message); }
        finally { setAplicando(""); }
    };

    const aplicar = async () => {
        const { accion } = confirmar;
        setAplicando(accion);
        try {
            const res = await Api.corregir(accion, period, true);
            toast.success(`Listo: ${res.afectados} caso(s) corregido(s).`);
            setConfirmar(null);
            cargar();
        } catch (e) { toast.error(e.message); }
        finally { setAplicando(""); }
    };

    const asignar = async (fila, sectionId) => {
        setAplicando(`sec-${fila.item_id}`);
        try {
            const res = await Api.asignarSeccion(fila.dni, fila.item_id, sectionId);
            toast.success(`${fila.nombre}: ${res.message}`);
            cargar();
        } catch (e) { toast.error(e.message); }
        finally { setAplicando(""); }
    };

    const r = data?.resumen || {};
    const listas = {
        sin_seccion: {
            label: "Sin sección asignada",
            hint: "Están matriculados pero su curso no apunta a ninguna sección, así que no aparecen en el acta.",
            rows: data?.sin_seccion || [],
        },
        cursos_faltantes: {
            label: "Cursos que faltan",
            hint: "Les falta un curso de su ciclo que sí tiene sección creada. No cuenta los que ya aprobaron, así que los de subsanación no salen acá.",
            rows: data?.cursos_faltantes || [],
        },
        fichas_desfasadas: {
            label: "Ficha desfasada",
            hint: "El ciclo o el período de la ficha no coinciden con su matrícula. Con el ciclo mal, el alumno no sale en la nómina de su ciclo aunque su acta esté perfecta.",
            rows: data?.fichas_desfasadas || [],
        },
        matriculas_vacias: {
            label: "Matrículas sin cursos",
            hint: "Matrícula confirmada y con créditos, pero sin ningún curso: sale en la nómina y en ningún acta.",
            rows: data?.matriculas_vacias || [],
        },
    };
    const activa = listas[ver];
    const total = (r.sin_seccion || 0) + (r.cursos_faltantes || 0)
        + (r.fichas_desfasadas || 0) + (r.matriculas_vacias || 0);

    return (
        <div className="space-y-4">
            <Card>
                <CardHead icon={AlertTriangle} title="Casos por resolver"
                    hint={period ? `Período ${period} · se recalcula cada vez que entrás`
                        : "Elegí un período arriba"}
                    right={
                        <Button size="sm" variant="outline" className="gap-1.5 h-9" onClick={cargar} disabled={loading}>
                            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Actualizar
                        </Button>
                    } />
                <div className="p-5 space-y-4">
                    {loading && !data ? (
                        <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
                            <Loader2 size={18} className="animate-spin" /> Revisando el período…
                        </div>
                    ) : (
                        <>
                            <div className="flex flex-wrap gap-2">
                                <Kpi label="Sin sección" value={r.sin_seccion ?? "—"} activo={ver === "sin_seccion"}
                                    tone={r.sin_seccion ? "rose" : "emerald"} onClick={() => setVer("sin_seccion")} />
                                <Kpi label="Cursos faltantes" value={r.cursos_faltantes ?? "—"} activo={ver === "cursos_faltantes"}
                                    tone={r.cursos_faltantes ? "amber" : "emerald"} onClick={() => setVer("cursos_faltantes")} />
                                <Kpi label="Ficha desfasada" value={r.fichas_desfasadas ?? "—"} activo={ver === "fichas_desfasadas"}
                                    tone={r.fichas_desfasadas ? "amber" : "emerald"} onClick={() => setVer("fichas_desfasadas")} />
                                <Kpi label="Matrículas vacías" value={r.matriculas_vacias ?? "—"} activo={ver === "matriculas_vacias"}
                                    tone={r.matriculas_vacias ? "rose" : "emerald"} onClick={() => setVer("matriculas_vacias")} />
                            </div>

                            {data && total === 0 && (
                                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-center gap-2">
                                    <CheckCircle2 size={16} />
                                    Sin incidencias en {period}. Las actas y las nóminas están alineadas.
                                </div>
                            )}

                            <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100">
                                <span className="w-full text-[11px] font-bold uppercase tracking-wider text-slate-400 pt-3">
                                    Correcciones masivas — se simulan antes de aplicar
                                </span>
                                <Button size="sm" variant="outline" className="gap-1.5 h-9" disabled={!!aplicando || !period}
                                    onClick={() => simular("asignar_secciones", "Asignar sección a los cursos que tienen una sola")}>
                                    {aplicando === "asignar_secciones" ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
                                    Asignar secciones únicas
                                </Button>
                                <Button size="sm" variant="outline" className="gap-1.5 h-9" disabled={!!aplicando || !period}
                                    onClick={() => simular("sincronizar_fichas", "Poner el ciclo y el período de la ficha de acuerdo con su matrícula")}>
                                    {aplicando === "sincronizar_fichas" ? <Loader2 size={14} className="animate-spin" /> : <Wrench size={14} />}
                                    Sincronizar fichas
                                </Button>
                                <Button size="sm" variant="outline" className="gap-1.5 h-9 border-rose-300 text-rose-700 hover:bg-rose-50"
                                    disabled={!!aplicando || !period}
                                    onClick={() => simular("restaurar_vacias", "Devolver los cursos a las matrículas que quedaron sin ninguno")}>
                                    {aplicando === "restaurar_vacias" ? <Loader2 size={14} className="animate-spin" /> : <ShieldAlert size={14} />}
                                    Restaurar matrículas vacías
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </Card>

            <Card>
                <CardHead icon={ClipboardList} title={activa.label} hint={activa.hint} />
                <div className="p-2">
                    {loading ? (
                        <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
                            <Loader2 size={18} className="animate-spin" /> Revisando…
                        </div>
                    ) : !activa.rows.length ? (
                        <Vacio>Sin casos de este tipo.</Vacio>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-600">
                                        <th className="p-2 text-left font-bold">DNI</th>
                                        <th className="p-2 text-left font-bold">Alumno</th>
                                        <th className="p-2 text-left font-bold">Detalle</th>
                                        <th className="p-2 text-right font-bold w-56">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {activa.rows.slice(0, 200).map((x, i) => (
                                        <tr key={`${x.dni}-${x.item_id || x.plan_course_id || i}`} className="hover:bg-blue-50/30">
                                            <td className="p-2 font-mono text-[11px]">{x.dni}</td>
                                            <td className="p-2 font-semibold text-slate-700">{x.nombre}</td>
                                            <td className="p-2 text-slate-600">
                                                {ver === "sin_seccion" && <>{x.curso} · ciclo {x.ciclo}</>}
                                                {ver === "cursos_faltantes" && (
                                                    <>{x.curso} · {x.tipo} · {x.creditos} cr
                                                        {x.aprobado_en_otro_plan && (
                                                            <span className="ml-1 text-[10px] text-violet-700">
                                                                (aprobado en un plan anterior: no convalida solo)
                                                            </span>
                                                        )}</>
                                                )}
                                                {ver === "fichas_desfasadas" && (
                                                    <>ciclo {x.ciclo_ficha} → <b>{x.ciclo_correcto}</b>
                                                        {" · "}período {x.periodo_ficha || "—"} → <b>{x.periodo_correcto}</b>
                                                        {x.afecta_nomina && (
                                                            <span className="ml-1 text-[10px] font-bold text-rose-700">
                                                                NO SALE EN SU NÓMINA
                                                            </span>
                                                        )}</>
                                                )}
                                                {ver === "matriculas_vacias" && (
                                                    <>ciclo {x.ciclo} · {x.creditos_registrados} créditos registrados, 0 cursos</>
                                                )}
                                            </td>
                                            <td className="p-2 text-right whitespace-nowrap">
                                                {ver === "sin_seccion" && (
                                                    <AsignarSeccion secciones={x.secciones || []}
                                                        cargando={aplicando === `sec-${x.item_id}`}
                                                        onAsignar={(sid) => asignar(x, sid)} />
                                                )}
                                                <Button size="sm" variant="ghost" className="h-7 text-[11px] ml-1"
                                                    onClick={() => irAlumno(x.dni)}>
                                                    Ficha
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {activa.rows.length > 200 && (
                                <p className="p-2 text-[11px] text-slate-400">
                                    Mostrando 200 de {activa.rows.length}. Usá las correcciones masivas de arriba.
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </Card>

            <Dialog open={!!confirmar} onOpenChange={(v) => { if (!v) setConfirmar(null); }}>
                <DialogContent className="max-w-2xl rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-base font-extrabold">{confirmar?.titulo}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <p className="text-sm text-slate-600">
                            Se van a corregir <b>{confirmar?.n}</b> caso(s) del período <b>{period}</b>.
                        </p>
                        {confirmar?.accion === "asignar_secciones" && (
                            <p className="text-xs text-slate-500">
                                Solo se tocan los cursos que tienen <b>una sola sección</b> en el período.
                                Si un curso tiene varias, la elección queda para vos desde la lista.
                            </p>
                        )}
                        {confirmar?.accion === "restaurar_vacias" && (
                            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                                Solo se restauran las matrículas cuyos créditos guardados coinciden
                                <b> exactamente</b> con los cursos obligatorios de su ciclo. Ese número es
                                la huella de lo que la matrícula tenía antes, así que la reconstrucción es
                                exacta y no adivinada.
                                {!!confirmar?.detalle?.dudosas?.length && (
                                    <p className="mt-2">
                                        Quedan <b>{confirmar.detalle.dudosas.length}</b> caso(s) que no
                                        cuadran y hay que revisar a mano.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmar(null)}>Cancelar</Button>
                        <Button onClick={aplicar} disabled={!!aplicando} className="gap-2">
                            {aplicando ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                            Aplicar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

/* ═══════════════════════ 2. ALUMNO ═══════════════════════ */

function PanelAlumno({ dniInicial, period, irSeccion }) {
    const [q, setQ] = useState(dniInicial || "");
    const [resultados, setResultados] = useState([]);
    const [dni, setDni] = useState(dniInicial || "");
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [trabajando, setTrabajando] = useState("");
    const [secElegida, setSecElegida] = useState({});
    const [confirmarQuitar, setConfirmarQuitar] = useState(null);

    const cargar = useCallback(async (documento) => {
        if (!documento) return;
        setLoading(true);
        try { setData(await Api.alumno(documento)); setResultados([]); }
        catch (e) { toast.error(e.message); setData(null); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => {
        if (dniInicial) { setQ(dniInicial); setDni(dniInicial); cargar(dniInicial); }
    }, [dniInicial, cargar]);

    const buscar = async () => {
        const t = q.trim();
        if (!t) return;
        if (/^\d{6,12}$/.test(t)) { setDni(t); return cargar(t); }
        setLoading(true);
        try {
            const res = await Api.buscar(t);
            setResultados(res?.students || []);
            if (!res?.students?.length) toast.info("Sin resultados.");
        } catch (e) { toast.error(e.message); }
        finally { setLoading(false); }
    };

    const matricula = useMemo(() => {
        const ms = data?.matriculas || [];
        return ms.find((m) => m.periodo === period && m.estado === "CONFIRMED")
            || ms.find((m) => m.estado === "CONFIRMED") || ms[0] || null;
    }, [data, period]);

    const agregar = async (f) => {
        const sid = f.secciones.length === 1 ? f.secciones[0].section_id : secElegida[f.plan_course_id];
        if (!sid) return toast.error("Elegí la sección primero.");
        setTrabajando(`add-${f.plan_course_id}`);
        try {
            const res = await Api.agregarCurso(dni, sid, matricula?.periodo);
            toast.success(res.message);
            if (res.aviso) toast.warning(res.aviso, { duration: 9000 });
            cargar(dni);
        } catch (e) { toast.error(e.message); }
        finally { setTrabajando(""); }
    };

    const quitar = async (item, forzar = false) => {
        setTrabajando(`del-${item.item_id}`);
        try {
            const res = await Api.quitarCurso(dni, item.item_id, forzar);
            toast.success(res.message);
            setConfirmarQuitar(null);
            cargar(dni);
        } catch (e) {
            if (e.status === 409 && e.data?.requiere_forzar) {
                setConfirmarQuitar({ item, avisos: e.data.avisos || [] });
            } else { toast.error(e.message); }
        } finally { setTrabajando(""); }
    };

    const asignar = async (item, sectionId) => {
        setTrabajando(`sec-${item.item_id}`);
        try {
            const res = await Api.asignarSeccion(dni, item.item_id, sectionId);
            toast.success(res.message);
            cargar(dni);
        } catch (e) { toast.error(e.message); }
        finally { setTrabajando(""); }
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardHead icon={Search} title="Buscar alumno"
                    hint="Por DNI exacto, o por apellidos y nombres" />
                <div className="p-5 flex flex-wrap gap-2">
                    <Input value={q} onChange={(e) => setQ(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && buscar()}
                        placeholder="DNI o apellidos…" className="h-10 rounded-xl max-w-sm" />
                    <Button onClick={buscar} disabled={loading} className="gap-2 h-10 rounded-xl">
                        {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                        Buscar
                    </Button>
                </div>
                {!!resultados.length && (
                    <div className="border-t border-slate-100 divide-y divide-slate-50 max-h-72 overflow-auto">
                        {resultados.map((s) => (
                            <button key={s.dni} type="button" onClick={() => { setDni(s.dni); cargar(s.dni); }}
                                className="w-full flex items-center justify-between gap-3 px-5 py-2.5 text-left hover:bg-blue-50/40">
                                <span className="text-sm font-semibold text-slate-700">
                                    {s.nombre} <EstadoBadge estado={s.estado} />
                                </span>
                                <span className="text-xs text-slate-400 font-mono">
                                    {s.dni} · ciclo {s.ciclo ?? "—"}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </Card>

            {data && (
                <>
                    <Card>
                        <CardHead icon={Users} title={data.nombre}
                            hint={`DNI ${data.dni} · ${data.programa || "—"} · ciclo ${data.ciclo ?? "—"} · ${data.plan || `plan ${data.plan_id || "—"}`}`}
                            right={<EstadoBadge estado={data.estado_academico} />} />
                        <div className="px-5 py-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                            <div><span className="text-slate-400">Cuenta</span>
                                <p className="font-semibold text-slate-700">{data.cuenta || "sin cuenta"}</p></div>
                            <div><span className="text-slate-400">Período de la ficha</span>
                                <p className="font-semibold text-slate-700">{data.periodo_ficha || "—"}</p></div>
                            <div><span className="text-slate-400">Notas en kárdex</span>
                                <p className="font-semibold text-slate-700">
                                    {(data.kardex || []).reduce((a, k) => a + k.notas.length, 0)}
                                </p></div>
                            <div><span className="text-slate-400">Datos vinculados</span>
                                <p className="font-semibold text-slate-700">
                                    {(data.vinculados || []).map((v) => `${v.modelo}: ${v.n}`).join(" · ") || "—"}
                                </p></div>
                        </div>
                    </Card>

                    {matricula ? (
                        <Card>
                            <CardHead icon={ClipboardList} title={`Matrícula ${matricula.periodo}`}
                                hint={`${matricula.estado} · ${matricula.cursos.length} curso(s) · ${matricula.creditos} créditos`} />
                            <div className="p-2 overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100 text-slate-600">
                                            <th className="p-2 text-left font-bold">Curso</th>
                                            <th className="p-2 text-center font-bold">Ciclo</th>
                                            <th className="p-2 text-center font-bold">Cr.</th>
                                            <th className="p-2 text-left font-bold">Sección</th>
                                            <th className="p-2 text-right font-bold w-24"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {matricula.cursos.map((c) => (
                                            <tr key={c.item_id} className={c.section_id ? "hover:bg-blue-50/30" : "bg-rose-50/40"}>
                                                <td className="p-2 font-semibold text-slate-700">{c.curso}</td>
                                                <td className="p-2 text-center">{c.ciclo}</td>
                                                <td className="p-2 text-center">{c.creditos}</td>
                                                <td className="p-2">
                                                    {c.section_id ? (
                                                        <button type="button" onClick={() => irSeccion(c.section_id)}
                                                            className="inline-flex items-center gap-1 text-emerald-700 font-bold hover:underline">
                                                            {c.seccion} <ExternalLink size={11} />
                                                        </button>
                                                    ) : (
                                                        <span className="inline-flex flex-wrap items-center gap-2">
                                                            <span className="text-[10px] font-bold text-rose-700">
                                                                SIN SECCIÓN — no aparece en el acta
                                                            </span>
                                                            <AsignarSeccion secciones={c.secciones_disponibles || []}
                                                                cargando={trabajando === `sec-${c.item_id}`}
                                                                onAsignar={(sid) => asignar(c, sid)} />
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-2 text-right">
                                                    <Button size="sm" variant="ghost"
                                                        className="h-7 text-[11px] text-rose-700 hover:bg-rose-50 gap-1"
                                                        disabled={trabajando === `del-${c.item_id}`}
                                                        onClick={() => quitar(c)}>
                                                        {trabajando === `del-${c.item_id}`
                                                            ? <Loader2 size={12} className="animate-spin" />
                                                            : <Trash2 size={12} />}
                                                        Quitar
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                        {!matricula.cursos.length && (
                                            <tr><td colSpan={5} className="p-6 text-center text-rose-700 font-semibold">
                                                Matrícula confirmada con {matricula.creditos} créditos y ningún curso.
                                                Usá «Restaurar matrículas vacías» en Incidencias.
                                            </td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {!!matricula.faltantes?.length && (
                                <div className="border-t border-slate-100 p-4 space-y-2">
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                                        Cursos de su ciclo que no están en la matrícula
                                    </p>
                                    {matricula.faltantes.map((f) => (
                                        <div key={f.plan_course_id}
                                            className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2">
                                            <span className="text-xs font-semibold text-slate-700 flex-1 min-w-[220px]">
                                                {f.curso}
                                                <span className="ml-1 text-[10px] text-slate-500">{f.tipo} · {f.creditos} cr</span>
                                                {f.aprobado_en_otro_plan && (
                                                    <span className="ml-1 text-[10px] text-violet-700">
                                                        aprobado en un plan anterior: no convalida solo
                                                    </span>
                                                )}
                                            </span>
                                            {f.secciones.length > 1 && (
                                                <select value={secElegida[f.plan_course_id] || ""}
                                                    onChange={(e) => setSecElegida((p) => ({ ...p, [f.plan_course_id]: e.target.value }))}
                                                    className="h-8 px-2 text-xs rounded-lg border border-slate-200 bg-white">
                                                    <option value="">— sección —</option>
                                                    {f.secciones.map((s) => (
                                                        <option key={s.section_id} value={s.section_id}>{s.label}</option>
                                                    ))}
                                                </select>
                                            )}
                                            {f.secciones.length ? (
                                                <Button size="sm" className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700"
                                                    disabled={trabajando === `add-${f.plan_course_id}`}
                                                    onClick={() => agregar(f)}>
                                                    {trabajando === `add-${f.plan_course_id}`
                                                        ? <Loader2 size={12} className="animate-spin" />
                                                        : <Plus size={12} />}
                                                    Agregar
                                                </Button>
                                            ) : (
                                                <span className="text-[10px] text-slate-500">
                                                    sin sección creada — hay que crearla primero
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>
                    ) : (
                        <Card><Vacio>Este alumno no tiene matrículas registradas.</Vacio></Card>
                    )}

                    {!!data.kardex?.length && (
                        <Card>
                            <CardHead icon={ClipboardList} title="Kárdex"
                                hint="Historial por período — sirve para decidir si un curso corresponde o ya está aprobado" />
                            <div className="p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {data.kardex.map((k) => (
                                    <div key={k.periodo} className="rounded-xl border border-slate-100 p-3">
                                        <p className="text-[11px] font-bold text-blue-700 mb-1">{k.periodo}</p>
                                        {k.notas.map((n, i) => (
                                            <div key={i} className="flex justify-between gap-2 text-[11px] py-0.5">
                                                <span className="text-slate-600 truncate">{n.curso}</span>
                                                <b className={n.nota != null && n.nota < 11 ? "text-rose-700" : "text-slate-700"}>
                                                    {n.nota}
                                                </b>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}
                </>
            )}

            <Dialog open={!!confirmarQuitar} onOpenChange={(v) => { if (!v) setConfirmarQuitar(null); }}>
                <DialogContent className="max-w-lg rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-base font-extrabold text-rose-700">
                            Ese curso tiene registros
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2 text-sm text-slate-700">
                        <p className="font-semibold">{confirmarQuitar?.item?.curso}</p>
                        <ul className="list-disc pl-5 text-xs text-rose-700">
                            {(confirmarQuitar?.avisos || []).map((a, i) => <li key={i}>{a}</li>)}
                        </ul>
                        <p className="text-xs text-slate-500">
                            Si lo quitás, el alumno sale del acta y esos registros quedan sin
                            referencia. Confirmalo solo si estás segura de que corresponde.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmarQuitar(null)}>Cancelar</Button>
                        <Button className="bg-rose-600 hover:bg-rose-700"
                            onClick={() => quitar(confirmarQuitar.item, true)}>
                            Quitar de todas formas
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

/* ═══════════════════════ 3. SECCIÓN ═══════════════════════ */

function PanelSeccion({ seccionInicial, irAlumno }) {
    const [id, setId] = useState(seccionInicial ? String(seccionInicial) : "");
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    const cargar = useCallback(async (valor) => {
        const n = parseInt(valor, 10);
        if (!n) return toast.error("Ingresá el número de sección.");
        setLoading(true);
        try { setData(await Api.seccion(n)); }
        catch (e) { toast.error(e.message); setData(null); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => {
        if (seccionInicial) { setId(String(seccionInicial)); cargar(seccionInicial); }
    }, [seccionInicial, cargar]);

    const enActa = useMemo(() => new Set((data?.acta || []).map((a) => a.dni)), [data]);
    const faltan = useMemo(
        () => (data?.nomina || []).filter((a) => !enActa.has(a.dni)), [data, enActa]);

    return (
        <div className="space-y-4">
            <Card>
                <CardHead icon={ClipboardList} title="Acta de una sección"
                    hint="Muestra el acta tal como la calcula el sistema, junto a la nómina del ciclo. Es la respuesta a «no aparece el alumno X»." />
                <div className="p-5 flex flex-wrap gap-2">
                    <Input value={id} onChange={(e) => setId(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && cargar(id)}
                        placeholder="N° de sección (ej. 140)" className="h-10 rounded-xl max-w-[200px]" />
                    <Button onClick={() => cargar(id)} disabled={loading} className="gap-2 h-10 rounded-xl">
                        {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                        Ver acta
                    </Button>
                </div>
            </Card>

            {data && (
                <Card>
                    <CardHead icon={Users} title={`#${data.section_id} · ${data.curso} '${data.label}'`}
                        hint={`${data.programa} · ciclo ${data.ciclo} · ${data.periodo} · Docente: ${data.docente || "sin asignar"}`}
                        right={
                            <Badge variant="outline" className={faltan.length ? "bg-rose-50 text-rose-700 border-rose-300" : "bg-emerald-50 text-emerald-700 border-emerald-300"}>
                                {data.acta.length} en el acta · {data.nomina.length} en la nómina
                            </Badge>
                        } />
                    <div className="p-4 space-y-4">
                        {!!data.otras_secciones?.length && (
                            <p className="text-[11px] text-slate-500">
                                Otras secciones del mismo curso:{" "}
                                {data.otras_secciones.map((s) => `#${s.section_id} '${s.label}'`).join(", ")}
                            </p>
                        )}
                        {!!data.sin_ubicar?.length && (
                            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                                <b>{data.sin_ubicar.length} matriculado(s) sin ubicar:</b>{" "}
                                {data.sin_ubicar.map((s) => `${s.nombre} (${s.dni})`).join(" · ")}.
                                Están en el curso pero sin sección asignada y el curso tiene varias:
                                elegí la sección desde su ficha.
                            </div>
                        )}
                        {!faltan.length && !!data.nomina.length && (
                            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-center gap-2">
                                <CheckCircle2 size={14} />
                                El acta coincide con la nómina del ciclo: no falta nadie.
                            </div>
                        )}

                        <div className="grid gap-4 lg:grid-cols-2">
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                    En el acta ({data.acta.length})
                                </p>
                                <div className="rounded-xl border border-slate-100 divide-y divide-slate-50 max-h-[440px] overflow-auto">
                                    {data.acta.map((a, i) => (
                                        <button key={a.dni} type="button" onClick={() => irAlumno(a.dni)}
                                            className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-blue-50/40">
                                            <span className="w-6 text-slate-400">{i + 1}</span>
                                            <span className="font-mono text-[10px] text-slate-400 w-20">{a.dni}</span>
                                            <span className="flex-1 font-semibold text-slate-700 truncate">{a.nombre}</span>
                                            <EstadoBadge estado={a.estado} />
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                    En la nómina del ciclo ({data.nomina.length})
                                    {!!faltan.length && (
                                        <span className="ml-2 text-rose-700">· {faltan.length} sin acta</span>
                                    )}
                                </p>
                                <div className="rounded-xl border border-slate-100 divide-y divide-slate-50 max-h-[440px] overflow-auto">
                                    {data.nomina.map((a) => (
                                        <button key={a.dni} type="button" onClick={() => irAlumno(a.dni)}
                                            className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-blue-50/40 ${enActa.has(a.dni) ? "" : "bg-rose-50"}`}>
                                            <span className="font-mono text-[10px] text-slate-400 w-20">{a.dni}</span>
                                            <span className="flex-1 font-semibold text-slate-700 truncate">{a.nombre}</span>
                                            <EstadoBadge estado={a.estado} />
                                            {!enActa.has(a.dni) && (
                                                <span className="text-[9px] font-bold text-rose-700">NO EN EL ACTA</span>
                                            )}
                                        </button>
                                    ))}
                                    {!data.nomina.length && (
                                        <p className="p-3 text-slate-400">Sin nómina para este ciclo.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>
            )}
        </div>
    );
}

/* ═══════════════════════ 4. DUPLICADOS ═══════════════════════ */

function PanelDuplicados() {
    const [origen, setOrigen] = useState("");
    const [destino, setDestino] = useState("");
    const [sim, setSim] = useState(null);
    const [loading, setLoading] = useState(false);

    const simular = async () => {
        if (!origen.trim() || !destino.trim()) return toast.error("Completá los dos DNI.");
        setLoading(true);
        try { setSim(await Api.fusionar(origen.trim(), destino.trim(), false)); }
        catch (e) { toast.error(e.message); setSim(null); }
        finally { setLoading(false); }
    };

    const aplicar = async () => {
        setLoading(true);
        try {
            const res = await Api.fusionar(origen.trim(), destino.trim(), true);
            toast.success(res.message);
            setSim(res);
        } catch (e) { toast.error(e.message); }
        finally { setLoading(false); }
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardHead icon={GitMerge} title="Fusionar fichas duplicadas"
                    hint="Mueve el kárdex de la ficha duplicada a la buena. No borra nada y nunca pisa una nota del destino." />
                <div className="p-5 space-y-3">
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
                        Cuando una ficha se recrea con el DNI mal tipeado, el historial queda
                        <b> partido</b>: los ciclos viejos en una y los nuevos en la otra. Borrar la
                        que «no tiene matrícula» pierde media historia académica, así que primero
                        hay que mover las notas.
                    </div>
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="space-y-1">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                DNI de origen (la duplicada)
                            </label>
                            <Input value={origen} onChange={(e) => setOrigen(e.target.value)}
                                placeholder="48034153" className="h-10 rounded-xl w-40" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                DNI de destino (la que se queda)
                            </label>
                            <Input value={destino} onChange={(e) => setDestino(e.target.value)}
                                placeholder="48034152" className="h-10 rounded-xl w-40" />
                        </div>
                        <Button onClick={simular} disabled={loading} variant="outline" className="h-10 rounded-xl gap-2">
                            {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                            Simular
                        </Button>
                    </div>
                    <p className="text-[11px] text-slate-500">
                        Se cancela solo si los nombres no coinciden exactamente o si la ficha de
                        origen tiene matrículas.
                    </p>
                </div>
            </Card>

            {sim && (
                <Card>
                    <CardHead icon={GitMerge} title={sim.message}
                        hint={`Origen ${sim.origen?.dni} (${sim.origen?.notas} notas) → Destino ${sim.destino?.dni} (${sim.destino?.notas} notas)`}
                        right={!sim.aplicado && !!sim.mover?.length && (
                            <Button onClick={aplicar} disabled={loading} className="gap-2 h-9">
                                {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                Aplicar fusión
                            </Button>
                        )} />
                    <div className="p-4 grid gap-4 lg:grid-cols-2">
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 mb-1">
                                Notas a mover ({sim.mover?.length || 0})
                            </p>
                            <div className="rounded-xl border border-slate-100 divide-y divide-slate-50 max-h-80 overflow-auto">
                                {(sim.mover || []).map((m, i) => (
                                    <div key={i} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                                        <span className="w-24 text-slate-400">{m.term}</span>
                                        <span className="flex-1 truncate text-slate-700">{m.curso}</span>
                                        <b>{m.nota}</b>
                                    </div>
                                ))}
                                {!sim.mover?.length && <p className="p-3 text-xs text-slate-400">Nada que mover.</p>}
                            </div>
                        </div>
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 mb-1">
                                Choques ({sim.choques?.length || 0}) — no se tocan
                            </p>
                            <div className="rounded-xl border border-slate-100 divide-y divide-slate-50 max-h-80 overflow-auto">
                                {(sim.choques || []).map((c, i) => (
                                    <div key={i} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                                        <span className="w-24 text-slate-400">{c.term}</span>
                                        <span className="flex-1 truncate text-slate-700">{c.curso}</span>
                                        <span className="text-slate-500">origen {c.nota}</span>
                                        <b>destino {c.nota_destino}</b>
                                    </div>
                                ))}
                                {!sim.choques?.length && <p className="p-3 text-xs text-slate-400">Sin choques.</p>}
                            </div>
                        </div>
                    </div>
                    {sim.aplicado && (
                        <div className="border-t border-slate-100 p-4 text-xs text-slate-600">
                            La ficha de origen quedó con <b>{sim.origen?.notas}</b> nota(s). Si quedó en
                            cero y sin matrículas, se puede eliminar desde Estudiantes — y conviene
                            desactivar también su cuenta de usuario.
                        </div>
                    )}
                </Card>
            )}
        </div>
    );
}

/* ═══════════════════════ MÓDULO ═══════════════════════ */

export default function MesaControlModule() {
    const [tab, setTab] = useState("incidencias");
    const [periodos, setPeriodos] = useState([]);
    const [period, setPeriod] = useState("");
    const [cargandoPeriodos, setCargandoPeriodos] = useState(true);
    const [dniFoco, setDniFoco] = useState("");
    const [seccionFoco, setSeccionFoco] = useState(null);

    /* El período se elige de los que TIENEN datos, no de una lista fija:
       si se adivina por la fecha se abre un período vacío y parece que no
       hay nada que corregir. */
    useEffect(() => {
        (async () => {
            try {
                const res = await Api.periodos();
                setPeriodos(res?.periodos || []);
                setPeriod(res?.sugerido || res?.periodos?.[0]?.code || "");
            } catch (e) {
                toast.error(`No se pudieron cargar los períodos: ${e.message}`);
            } finally { setCargandoPeriodos(false); }
        })();
    }, []);

    const irAlumno = (dni) => { setDniFoco(dni); setTab("alumno"); };
    const irSeccion = (id) => { setSeccionFoco(id); setTab("seccion"); };

    const info = periodos.find((p) => p.code === period);

    return (
        <div className="min-h-[100dvh] w-full min-w-0 overflow-x-hidden p-3 sm:p-4 md:p-6 pb-24 md:pb-16
            bg-gradient-to-br from-slate-50 via-white to-slate-100">
            <div className="w-full min-w-0 rounded-2xl md:rounded-3xl bg-white/80 backdrop-blur-md
                border border-slate-200/60 shadow-xl shadow-slate-200/40 p-4 md:p-6 space-y-6">

                {/* Encabezado */}
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700
                            flex items-center justify-center shadow-sm shadow-blue-200 shrink-0">
                            <Wrench size={20} className="text-white" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-lg font-extrabold text-slate-800 leading-tight">
                                Mesa de Control Académica
                            </h1>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Corrige matrículas confirmadas, ubica alumnos que no aparecen en un
                                acta o en una nómina, y une fichas duplicadas sin perder kárdex.
                            </p>
                        </div>
                    </div>

                    {/* Selector de período con datos reales */}
                    <div className="flex items-end gap-2 shrink-0">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Período académico
                            </label>
                            {cargandoPeriodos ? (
                                <div className="h-10 w-64 rounded-xl border border-slate-200 bg-slate-50
                                    flex items-center gap-2 px-3 text-xs text-slate-400">
                                    <Loader2 size={13} className="animate-spin" /> Cargando…
                                </div>
                            ) : !periodos.length ? (
                                <div className="h-10 rounded-xl border border-amber-300 bg-amber-50 flex items-center px-3 text-xs text-amber-800">
                                    No hay períodos con matrículas registradas
                                </div>
                            ) : (
                                <select value={period} onChange={(e) => setPeriod(e.target.value)}
                                    className="h-10 w-full sm:w-64 px-3 text-sm font-semibold rounded-xl border
                                        border-slate-200 bg-white text-slate-700">
                                    {periodos.map((p) => (
                                        <option key={p.code} value={p.code}>
                                            {p.code}{p.vigente ? " (vigente)" : ""} — {p.matriculas} matrícula(s), {p.secciones} sección(es)
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </div>
                </div>

                {info && (
                    <p className="text-[11px] text-slate-500 -mt-2">
                        Trabajando sobre <b>{info.code}</b>: {info.matriculas} matrícula(s) confirmada(s)
                        y {info.secciones} sección(es). Las pestañas Alumno, Sección y Duplicados
                        funcionan con cualquier período.
                    </p>
                )}

                <Separator className="bg-slate-100" />

                <Tabs value={tab} onValueChange={setTab} className="space-y-4">
                    <TabsList className="flex flex-wrap h-auto p-1.5 gap-1 bg-slate-50 border border-slate-200 rounded-xl">
                        {[
                            ["incidencias", "Incidencias", AlertTriangle],
                            ["alumno", "Alumno", Users],
                            ["seccion", "Sección", ClipboardList],
                            ["duplicados", "Duplicados", GitMerge],
                        ].map(([k, label, Icon]) => (
                            <TabsTrigger key={k} value={k}
                                className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold
                                    text-slate-500 hover:text-slate-800 hover:bg-white
                                    data-[state=active]:text-blue-700 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                <Icon size={14} /> {label}
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    <TabsContent value="incidencias" className="mt-0">
                        <PanelIncidencias period={period} irAlumno={irAlumno} irSeccion={irSeccion} />
                    </TabsContent>
                    <TabsContent value="alumno" className="mt-0">
                        <PanelAlumno dniInicial={dniFoco} period={period} irSeccion={irSeccion} />
                    </TabsContent>
                    <TabsContent value="seccion" className="mt-0">
                        <PanelSeccion seccionInicial={seccionFoco} irAlumno={irAlumno} />
                    </TabsContent>
                    <TabsContent value="duplicados" className="mt-0">
                        <PanelDuplicados />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
