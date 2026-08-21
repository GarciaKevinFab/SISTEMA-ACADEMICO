// Mi Hoja de Vida — CV del docente (modelo institucional "Remisión del
// Currículum Vitae"): sección I (datos personales, tomados del perfil del
// docente y editables aquí mismo) + secciones II a VII con documento que
// acredita cada ítem, y emisión del CV completo (descriptivo + documentado)
// en PDF. Cada docente solo ve y edita SU hoja de vida (el backend la
// resuelve por el usuario autenticado).
//
// Diseño "expediente": numerales romanos en serif (Fraunces), navy
// institucional (#1F4E79, el mismo de las actas en PDF), tablas agrupadas
// por tipo con filas ligeras, resumen de avance documentado e índice de
// secciones para saltar directo.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
    FileText, Plus, Pencil, Trash2, Loader2, Download, Paperclip,
    GraduationCap, Award, Briefcase, Mic, Newspaper, FlaskConical, UserRound,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "../../components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../../components/ui/select";
import { api } from "../../lib/api";

const NAVY = "#1F4E79";

/* ── I. Datos personales: campos del perfil que se muestran y editan ── */
const SEXOS = { M: "Masculino", F: "Femenino" };
const DATOS_VACIO = {
    nombres: "", apellido_paterno: "", apellido_materno: "",
    fecha_nac: "", sexo: "", telefono_fijo: "", celular: "",
    email_institucional: "", direccion: "", region: "", provincia: "",
    distrito: "",
};

/* Definición de secciones: columnas visibles y mapeo a los campos genéricos */
const SECCIONES = [
    {
        key: "FORMACION", icon: GraduationCap, num: "II",
        nombre: "Formación profesional", titulo: "II. Formación profesional",
        subsecciones: [["PREGRADO", "Estudios de pregrado"], ["POSTGRADO", "Estudios de postgrado"]],
        campos: [
            ["titulo", "Nivel académico"], ["institucion", "Centro de estudios"],
            ["detalle", "Especialidad"], ["fecha_inicio", "Inicio"],
            ["fecha_fin", "Término"], ["lugar", "Lugar"],
        ],
    },
    {
        key: "ESPECIALIZACION", icon: Award, num: "III",
        nombre: "Especialización y actualización",
        titulo: "III. Especialización y actualización",
        subsecciones: [
            ["SEGUNDA_ESP", "Especialización / 2da especialización"],
            ["DIPLOMADO", "Diplomado"], ["ACTIVIDAD", "Actividad formativa"],
            ["IDIOMA", "Idioma extranjero"], ["LENGUA", "Lengua originaria"],
            ["TIC", "Capacitación en TIC"],
        ],
        campos: [
            ["titulo", "Curso / Programa"], ["institucion", "Centro de estudios"],
            ["detalle", "Tema"], ["fecha_inicio", "Inicio"],
            ["fecha_fin", "Término"], ["duracion", "Horas"],
        ],
    },
    {
        key: "EXPERIENCIA", icon: Briefcase, num: "IV",
        nombre: "Experiencia laboral", titulo: "IV. Experiencia laboral",
        subsecciones: [
            ["EXP_SUPERIOR", "Docente en educación superior"],
            ["EXP_BASICA", "Docente en educación básica / ETP"],
            ["EXP_CONTINUA", "Formación docente en servicio / continua"],
        ],
        campos: [
            ["institucion", "Institución"], ["titulo", "Cargo"],
            ["detalle", "Descripción"], ["fecha_inicio", "Inicio"],
            ["fecha_fin", "Término"], ["duracion", "Tiempo en el cargo"],
        ],
    },
    {
        key: "EVENTO", icon: Mic, num: "V.a",
        nombre: "Participación en eventos académicos",
        titulo: "V.a Participación en eventos académicos",
        subsecciones: [],
        campos: [
            ["institucion", "Institución"], ["detalle", "Descripción"],
            ["fecha_inicio", "Fecha"], ["duracion", "Duración (horas)"],
        ],
    },
    {
        key: "PUBLICACION", icon: Newspaper, num: "V.b",
        nombre: "Publicaciones", titulo: "V.b Publicaciones",
        subsecciones: [],
        campos: [
            ["institucion", "Lugar y medio de publicación"], ["titulo", "Título"],
            ["detalle", "Participación"], ["fecha_inicio", "Fecha"],
        ],
    },
    {
        key: "MERITO", icon: Award, num: "VI",
        nombre: "Méritos", titulo: "VI. Méritos",
        subsecciones: [],
        campos: [
            ["institucion", "Institución / Empresa / Entidad"],
            ["detalle", "Descripción"], ["fecha_inicio", "Fecha de reconocimiento"],
        ],
    },
    {
        key: "INVESTIGACION", icon: FlaskConical, num: "VII",
        nombre: "Investigación", titulo: "VII. Investigación",
        subsecciones: [],
        campos: [
            ["institucion", "Lugar"], ["titulo", "Tema"],
            ["duracion", "Calidad"], ["fecha_inicio", "Año (fecha)"],
        ],
    },
];

const VACIO = {
    subseccion: "", institucion: "", titulo: "", detalle: "", lugar: "",
    duracion: "", fecha_inicio: "", fecha_fin: "",
};

/* Rótulo de cada subsección (la tabla agrupa por tipo, no por fecha de
   registro: sin el rótulo un ítem nuevo "desaparecía" a media tabla) */
const SUB_LABELS = Object.fromEntries(SECCIONES.flatMap((s) => s.subsecciones));

const fmtFecha = (iso) => {
    if (!iso) return "";
    const [y, m, d] = String(iso).split("-");
    return y && m && d ? `${d}/${m}/${y}` : iso;
};

/* ── Estilos propios: serif editorial + entrada escalonada ── */
function InjectHVStyles() {
    useEffect(() => {
        const id = "hv-styles";
        if (document.getElementById(id)) return;
        const l = document.createElement("link");
        l.id = id + "-font";
        l.rel = "stylesheet";
        l.href = "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&display=swap";
        document.head.appendChild(l);
        const s = document.createElement("style");
        s.id = id;
        s.textContent = `
          .hv-serif { font-family: 'Fraunces', Georgia, 'Times New Roman', serif; }
          @keyframes hvRise { from { opacity: 0; transform: translateY(12px); }
                              to   { opacity: 1; transform: none; } }
          .hv-card { animation: hvRise .5s cubic-bezier(.22,1,.36,1) both; }
          .hv-clamp { display: -webkit-box; -webkit-line-clamp: 2;
                      -webkit-box-orient: vertical; overflow: hidden; }
          .hv-row td { transition: background .15s ease; }
        `;
        document.head.appendChild(s);
    }, []);
    return null;
}

/* Numeral romano de sección — la firma visual del expediente */
function Numeral({ n, size = "md" }) {
    const cls = size === "lg"
        ? "h-10 min-w-[2.5rem] px-2 text-[15px]"
        : "h-8 min-w-[2rem] px-1.5 text-[13px]";
    return (
        <span className={`hv-serif ${cls} rounded-lg grid place-items-center
                          font-semibold text-white shadow-sm shrink-0`}
            style={{ background: NAVY }}>
            {n}
        </span>
    );
}

function Dato({ label, value }) {
    return (
        <div className="min-w-0">
            <p className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-slate-400">
                {label}
            </p>
            <p className="text-[13px] text-slate-800 truncate mt-0.5" title={value || ""}>
                {value || <span className="text-slate-300">—</span>}
            </p>
        </div>
    );
}

// El mismo formulario sirve para el personal administrativo y los locadores
// 107: solo cambian los endpoints (el backend de `personal` replica campo a
// campo el contrato del docente). Por eso las rutas entran por props.
export default function TeacherHojaVida({
    cvBase = "/catalogs/teachers/me/cv",
    profileBase = "/academic/teachers/me/profile",
    archivoPdf = "hoja-de-vida.pdf",
}) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [emit, setEmit] = useState(false);
    const [confirmo, setConfirmo] = useState(false);

    // I. Datos personales (perfil)
    const [perfil, setPerfil] = useState(null);
    const [openDatos, setOpenDatos] = useState(false);
    const [savingDatos, setSavingDatos] = useState(false);
    const [datos, setDatos] = useState(DATOS_VACIO);

    // Modal de alta/edición de ítems
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [seccion, setSeccion] = useState(null);   // def de SECCIONES
    const [editing, setEditing] = useState(null);   // item o null
    const [form, setForm] = useState(VACIO);
    const [archivo, setArchivo] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [cv, prof] = await Promise.allSettled([
                api.get(cvBase),
                api.get(profileBase),
            ]);
            if (cv.status === "fulfilled") {
                setItems(cv.value.data?.items || []);
            } else {
                toast.error(cv.reason?.response?.data?.detail
                    || "No se pudo cargar la hoja de vida");
            }
            if (prof.status === "fulfilled") setPerfil(prof.value.data);
        } finally { setLoading(false); }
    }, [cvBase, profileBase]);
    useEffect(() => { load(); }, [load]);

    const porSeccion = useMemo(() => {
        const m = {};
        for (const it of items) (m[it.seccion] = m[it.seccion] || []).push(it);
        return m;
    }, [items]);

    const stats = useMemo(() => {
        const total = items.length;
        const conDoc = items.filter((i) => i.archivo_url).length;
        return { total, conDoc, pct: total ? Math.round((100 * conDoc) / total) : 0 };
    }, [items]);

    /* ── I. Datos personales ── */
    const abrirDatos = () => {
        setDatos({
            nombres: perfil?.nombres || "",
            apellido_paterno: perfil?.apellido_paterno || "",
            apellido_materno: perfil?.apellido_materno || "",
            fecha_nac: perfil?.fecha_nac || "",
            sexo: perfil?.sexo || "",
            telefono_fijo: perfil?.telefono_fijo || "",
            celular: perfil?.celular || "",
            email_institucional: perfil?.email_institucional || "",
            direccion: perfil?.direccion || "",
            region: perfil?.region || "",
            provincia: perfil?.provincia || "",
            distrito: perfil?.distrito || "",
        });
        setOpenDatos(true);
    };

    const guardarDatos = async () => {
        setSavingDatos(true);
        try {
            const { data } = await api.put(profileBase, datos);
            setPerfil((p) => ({ ...(p || {}), ...(data || datos) }));
            toast.success("Datos personales actualizados");
            setOpenDatos(false);
        } catch (e) {
            toast.error(e?.response?.data?.detail || "No se pudieron guardar los datos");
        } finally { setSavingDatos(false); }
    };

    /* ── Ítems II–VII ── */
    const abrir = (def, item = null) => {
        setSeccion(def);
        setEditing(item);
        setForm(item ? {
            subseccion: item.subseccion || "", institucion: item.institucion || "",
            titulo: item.titulo || "", detalle: item.detalle || "",
            lugar: item.lugar || "", duracion: item.duracion || "",
            fecha_inicio: item.fecha_inicio || "", fecha_fin: item.fecha_fin || "",
        } : { ...VACIO, subseccion: def.subsecciones[0]?.[0] || "" });
        setArchivo(null);
        setOpen(true);
    };

    const guardar = async () => {
        if (!seccion) return;
        setSaving(true);
        try {
            const fd = new FormData();
            fd.append("seccion", seccion.key);
            for (const [k, v] of Object.entries(form)) fd.append(k, v ?? "");
            if (archivo) fd.append("archivo", archivo);
            if (editing) await api.put(`${cvBase}/${editing.id}`, fd);
            else await api.post(cvBase, fd);
            toast.success(editing ? "Ítem actualizado" : "Ítem agregado");
            setOpen(false);
            load();
        } catch (e) {
            toast.error(e?.response?.data?.detail || "No se pudo guardar");
        } finally { setSaving(false); }
    };

    const borrar = async (item) => {
        if (!window.confirm("¿Eliminar este ítem de tu hoja de vida?")) return;
        try {
            await api.delete(`${cvBase}/${item.id}`);
            toast.success("Ítem eliminado");
            load();
        } catch (e) {
            toast.error(e?.response?.data?.detail || "No se pudo eliminar");
        }
    };

    const emitir = async () => {
        if (!confirmo) {
            toast.error("Confirma primero que la información registrada está completa y correcta");
            return;
        }
        setEmit(true);
        try {
            const res = await api.get(`${cvBase}/pdf`,
                { responseType: "blob" });
            const blob = res?.data instanceof Blob ? res.data : new Blob([res.data]);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = archivoPdf;
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => window.URL.revokeObjectURL(url), 60000);
            toast.success("Hoja de Vida emitida (descriptivo + documentado)");
        } catch (e) {
            let msg = "No se pudo emitir el CV";
            try {
                if (e?.response?.data instanceof Blob) {
                    msg = JSON.parse(await e.response.data.text())?.detail || msg;
                }
            } catch { /* ignore */ }
            toast.error(msg);
        } finally { setEmit(false); }
    };

    const irA = (key) => {
        document.getElementById(`hv-${key}`)?.scrollIntoView({
            behavior: "smooth", block: "start",
        });
    };

    const nombreDocente = perfil
        ? [perfil.nombres, perfil.apellido_paterno, perfil.apellido_materno]
            .filter(Boolean).join(" ") || perfil.full_name
        : "";
    const iniciales = (perfil?.full_name || "D")
        .split(" ").filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase();

    return (
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
            <InjectHVStyles />

            {/* ── Portada del expediente ── */}
            <div className="hv-card rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70 overflow-hidden">
                <div className="h-1" style={{ background: NAVY }} />
                <div className="px-6 pt-5 pb-4 flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="text-[9.5px] font-bold uppercase tracking-[0.22em] text-slate-400">
                            Currículum Vitae · Modelo institucional
                        </p>
                        <h1 className="hv-serif text-[26px] leading-tight font-semibold mt-1"
                            style={{ color: NAVY }}>
                            Mi Hoja de Vida
                        </h1>
                        <p className="text-xs text-slate-500 mt-1 max-w-md">
                            Registra cada ítem con el documento que lo acredita. El CV se
                            emite primero descriptivo y a continuación documentado.
                        </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <Button onClick={emitir} disabled={emit}
                            className="gap-1.5 text-white shadow-sm"
                            style={{ background: NAVY }}>
                            {emit ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                            Emitir CV completo (PDF)
                        </Button>
                        <label className="flex items-center gap-2 text-[11px] text-slate-500 cursor-pointer select-none">
                            <input type="checkbox" checked={confirmo}
                                onChange={(e) => setConfirmo(e.target.checked)} />
                            Confirmo que la información está completa y correcta
                        </label>
                    </div>
                </div>

                {!loading && (
                    <div className="px-6 pb-4">
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-slate-100 pt-3">
                            <p className="text-[11px] text-slate-500">
                                <b className="text-slate-700 text-sm">{stats.total}</b> ítems registrados
                            </p>
                            <p className="text-[11px] text-slate-500">
                                <b className="text-emerald-600 text-sm">{stats.conDoc}</b> con documento
                            </p>
                            <div className="flex items-center gap-2 min-w-[160px] flex-1 max-w-[260px]">
                                <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
                                    <div className="h-full rounded-full bg-emerald-500 transition-all"
                                        style={{ width: `${stats.pct}%` }} />
                                </div>
                                <span className="text-[11px] font-bold text-slate-600">{stats.pct}%</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5 ml-auto">
                                {SECCIONES.map((def) => {
                                    const n = (porSeccion[def.key] || []).length;
                                    return (
                                        <button key={def.key} onClick={() => irA(def.key)}
                                            title={def.nombre}
                                            className={"hv-serif text-[11px] px-2 py-1 rounded-md border transition-colors " +
                                                (n ? "border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                                                    : "border-slate-100 text-slate-300 hover:text-slate-400")}>
                                            {def.num}
                                            <span className="ml-1 font-sans text-[10px] text-slate-400">{n}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {loading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
                    <Loader2 className="h-5 w-5 animate-spin" /> Cargando hoja de vida…
                </div>
            ) : (
                <>
                    {/* ── I. Datos personales ── */}
                    <div className="hv-card rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70 overflow-hidden"
                        style={{ animationDelay: "60ms" }}>
                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
                            <div className="flex items-center gap-3">
                                <Numeral n="I" />
                                <div>
                                    <h3 className="font-bold text-slate-800 text-sm leading-tight">
                                        Datos personales
                                    </h3>
                                    <p className="text-[10.5px] text-slate-400">
                                        Se imprimen como sección I del CV
                                    </p>
                                </div>
                            </div>
                            <Button size="sm" variant="outline" className="gap-1 h-8 text-slate-600"
                                onClick={abrirDatos} disabled={!perfil}>
                                <Pencil size={13} /> Editar
                            </Button>
                        </div>
                        <div className="px-5 py-4">
                            {(!perfil?.nombres && !perfil?.apellido_paterno) && (
                                <p className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-700">
                                    Completa tus datos personales: aparecen como sección I de tu CV en PDF.
                                </p>
                            )}
                            <div className="flex flex-col sm:flex-row gap-5">
                                <div className="shrink-0 flex sm:flex-col items-center gap-3">
                                    <div className="h-24 w-24 rounded-2xl overflow-hidden ring-1 ring-slate-200 bg-slate-50 grid place-items-center">
                                        {perfil?.photo_url ? (
                                            <img src={perfil.photo_url} alt="Foto de perfil"
                                                className="h-full w-full object-cover" />
                                        ) : (
                                            <span className="hv-serif text-xl text-slate-300">{iniciales}</span>
                                        )}
                                    </div>
                                    <div className="sm:text-center">
                                        <p className="text-[12.5px] font-bold text-slate-700 leading-tight">
                                            {nombreDocente || "—"}
                                        </p>
                                        <p className="text-[10.5px] text-slate-400">DNI {perfil?.document || "—"}</p>
                                    </div>
                                </div>
                                <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3.5">
                                    <Dato label="Fecha de nacimiento" value={fmtFecha(perfil?.fecha_nac)} />
                                    <Dato label="Sexo" value={SEXOS[perfil?.sexo] || ""} />
                                    <Dato label="Grado académico" value={perfil?.grado_academico_label} />
                                    <Dato label="Condición laboral" value={perfil?.condicion_laboral_label} />
                                    <Dato label="Teléfono fijo" value={perfil?.telefono_fijo} />
                                    <Dato label="Teléfono celular" value={perfil?.celular} />
                                    <Dato label="Correo electrónico" value={perfil?.email_institucional} />
                                    <Dato label="R.D. Nombramiento / Contrato" value={perfil?.rd_nombramiento} />
                                    <Dato label="Dirección" value={perfil?.direccion} />
                                    <Dato label="Región" value={perfil?.region} />
                                    <Dato label="Provincia" value={perfil?.provincia} />
                                    <Dato label="Distrito" value={perfil?.distrito} />
                                </div>
                            </div>
                            <p className="mt-4 text-[10px] text-slate-400 border-t border-slate-100 pt-2.5">
                                El grado académico, la condición laboral y la R.D. se actualizan
                                desde <b>Mi Perfil</b>; el resto puedes editarlo aquí.
                            </p>
                        </div>
                    </div>

                    {/* ── Secciones II–VII ── */}
                    {SECCIONES.map((def, si) => {
                        const filas = porSeccion[def.key] || [];
                        const Icon = def.icon;
                        const conSub = def.subsecciones.length > 0;
                        let subAnterior = null;
                        return (
                            <div key={def.key} id={`hv-${def.key}`}
                                className="hv-card rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70 overflow-hidden"
                                style={{ animationDelay: `${120 + si * 50}ms`, scrollMarginTop: 90 }}>
                                <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <Numeral n={def.num} />
                                        <div className="min-w-0">
                                            <h3 className="font-bold text-slate-800 text-sm leading-tight truncate">
                                                {def.nombre}
                                            </h3>
                                            <p className="text-[10.5px] text-slate-400 flex items-center gap-1">
                                                <Icon size={11} className="shrink-0" />
                                                {filas.length === 0 ? "Sin registros"
                                                    : `${filas.length} ítem${filas.length === 1 ? "" : "s"} · ${filas.filter((f) => f.archivo_url).length} con documento`}
                                            </p>
                                        </div>
                                    </div>
                                    <Button size="sm" variant="outline" className="gap-1 h-8 text-slate-600 shrink-0"
                                        onClick={() => abrir(def)}>
                                        <Plus size={13} /> Agregar
                                    </Button>
                                </div>

                                {filas.length === 0 ? (
                                    <div className="px-5 py-5">
                                        <button onClick={() => abrir(def)}
                                            className="w-full rounded-xl border border-dashed border-slate-200 py-5
                                                       text-xs text-slate-400 hover:border-slate-300 hover:text-slate-500
                                                       hover:bg-slate-50/50 transition-colors">
                                            <Plus size={14} className="inline -mt-0.5 mr-1" />
                                            Agregar el primer ítem con su documento que lo acredita
                                        </button>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="text-[9.5px] uppercase tracking-[0.12em] text-slate-400 border-b border-slate-200">
                                                    <th className="px-3 py-2.5 font-bold">N°</th>
                                                    {def.campos.map(([k, lbl]) => (
                                                        <th key={k} className="px-3 py-2.5 text-left font-bold">{lbl}</th>
                                                    ))}
                                                    <th className="px-3 py-2.5 font-bold">Documento</th>
                                                    <th className="px-3 py-2.5"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filas.map((it, i) => {
                                                    const grupoNuevo = conSub && it.subseccion !== subAnterior;
                                                    subAnterior = it.subseccion;
                                                    return (
                                                        <React.Fragment key={it.id}>
                                                            {grupoNuevo && (
                                                                <tr>
                                                                    <td colSpan={def.campos.length + 3}
                                                                        className="px-4 py-1.5 text-[9.5px] font-bold uppercase tracking-[0.14em] bg-slate-50/80 border-b border-slate-100"
                                                                        style={{ color: NAVY }}>
                                                                        {SUB_LABELS[it.subseccion] || it.subseccion || "Otros"}
                                                                    </td>
                                                                </tr>
                                                            )}
                                                            <tr className="hv-row group border-b border-slate-100 last:border-0 hover:bg-blue-50/40">
                                                                <td className="px-3 py-2.5 text-center text-slate-300 tabular-nums">{i + 1}</td>
                                                                {def.campos.map(([k]) => {
                                                                    const v = it[k] || "";
                                                                    const esFecha = k.startsWith("fecha");
                                                                    return (
                                                                        <td key={k} title={v}
                                                                            className={"px-3 py-2.5 align-top " +
                                                                                (esFecha
                                                                                    ? "whitespace-nowrap tabular-nums text-slate-500"
                                                                                    : "text-slate-700")}>
                                                                            {v
                                                                                ? (esFecha
                                                                                    ? fmtFecha(v)
                                                                                    : <span className="hv-clamp max-w-[280px]">{v}</span>)
                                                                                : <span className="text-slate-200">—</span>}
                                                                        </td>
                                                                    );
                                                                })}
                                                                <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                                                    {it.archivo_url ? (
                                                                        <a href={it.archivo_url} target="_blank" rel="noreferrer"
                                                                            title={it.archivo_nombre}
                                                                            className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50/70 px-2 py-0.5 text-[10.5px] font-semibold text-blue-700 hover:bg-blue-100 transition-colors">
                                                                            <Paperclip size={10} /> Ver
                                                                        </a>
                                                                    ) : (
                                                                        <span className="inline-flex items-center rounded-full border border-amber-100 bg-amber-50/70 px-2 py-0.5 text-[10.5px] font-semibold text-amber-600"
                                                                            title="Falta el documento que acredita este ítem">
                                                                            Falta
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="px-3 py-2.5">
                                                                    <div className="flex items-center gap-0.5 justify-end opacity-30 group-hover:opacity-100 transition-opacity">
                                                                        <button onClick={() => abrir(def, it)}
                                                                            title="Editar"
                                                                            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-md">
                                                                            <Pencil size={13} />
                                                                        </button>
                                                                        <button onClick={() => borrar(it)}
                                                                            title="Eliminar"
                                                                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md">
                                                                            <Trash2 size={13} />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </>
            )}

            {/* ── Modal I. Datos personales ── */}
            <Dialog open={openDatos} onOpenChange={(v) => { if (!v) setOpenDatos(false); }}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle className="text-base font-extrabold flex items-center gap-2.5">
                            <Numeral n="I" /> Editar datos personales
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="sm:col-span-2">
                                <Label className="text-[10px] font-bold uppercase">Nombres</Label>
                                <Input value={datos.nombres} className="h-9"
                                    onChange={(e) => setDatos((d) => ({ ...d, nombres: e.target.value }))} />
                            </div>
                            <div>
                                <Label className="text-[10px] font-bold uppercase">Apellido paterno</Label>
                                <Input value={datos.apellido_paterno} className="h-9"
                                    onChange={(e) => setDatos((d) => ({ ...d, apellido_paterno: e.target.value }))} />
                            </div>
                            <div>
                                <Label className="text-[10px] font-bold uppercase">Apellido materno</Label>
                                <Input value={datos.apellido_materno} className="h-9"
                                    onChange={(e) => setDatos((d) => ({ ...d, apellido_materno: e.target.value }))} />
                            </div>
                            <div>
                                <Label className="text-[10px] font-bold uppercase">N° DNI</Label>
                                <Input value={perfil?.document || ""} disabled className="h-9 bg-slate-50" />
                            </div>
                            <div>
                                <Label className="text-[10px] font-bold uppercase">Fecha de nacimiento</Label>
                                <Input type="date" value={datos.fecha_nac} className="h-9"
                                    onChange={(e) => setDatos((d) => ({ ...d, fecha_nac: e.target.value }))} />
                            </div>
                            <div>
                                <Label className="text-[10px] font-bold uppercase">Sexo</Label>
                                <Select value={datos.sexo || undefined}
                                    onValueChange={(v) => setDatos((d) => ({ ...d, sexo: v }))}>
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="— Seleccionar —" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="M">Masculino</SelectItem>
                                        <SelectItem value="F">Femenino</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-[10px] font-bold uppercase">Teléfono fijo</Label>
                                <Input value={datos.telefono_fijo} className="h-9"
                                    onChange={(e) => setDatos((d) => ({ ...d, telefono_fijo: e.target.value }))} />
                            </div>
                            <div>
                                <Label className="text-[10px] font-bold uppercase">Teléfono celular</Label>
                                <Input value={datos.celular} placeholder="9__ ___ ___" className="h-9"
                                    onChange={(e) => setDatos((d) => ({ ...d, celular: e.target.value }))} />
                            </div>
                            <div className="sm:col-span-2">
                                <Label className="text-[10px] font-bold uppercase">Correo electrónico</Label>
                                <Input type="email" value={datos.email_institucional} className="h-9"
                                    onChange={(e) => setDatos((d) => ({ ...d, email_institucional: e.target.value }))} />
                            </div>
                            <div className="sm:col-span-2">
                                <Label className="text-[10px] font-bold uppercase">Dirección</Label>
                                <Input value={datos.direccion} className="h-9"
                                    onChange={(e) => setDatos((d) => ({ ...d, direccion: e.target.value }))} />
                            </div>
                            <div>
                                <Label className="text-[10px] font-bold uppercase">Región</Label>
                                <Input value={datos.region} className="h-9"
                                    onChange={(e) => setDatos((d) => ({ ...d, region: e.target.value }))} />
                            </div>
                            <div>
                                <Label className="text-[10px] font-bold uppercase">Provincia</Label>
                                <Input value={datos.provincia} className="h-9"
                                    onChange={(e) => setDatos((d) => ({ ...d, provincia: e.target.value }))} />
                            </div>
                            <div>
                                <Label className="text-[10px] font-bold uppercase">Distrito</Label>
                                <Input value={datos.distrito} className="h-9"
                                    onChange={(e) => setDatos((d) => ({ ...d, distrito: e.target.value }))} />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpenDatos(false)}>Cancelar</Button>
                        <Button onClick={guardarDatos} disabled={savingDatos}
                            className="gap-1.5 text-white" style={{ background: NAVY }}>
                            {savingDatos && <Loader2 size={14} className="animate-spin" />}
                            Guardar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Modal alta / edición de ítems ── */}
            <Dialog open={open} onOpenChange={(v) => { if (!v) setOpen(false); }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="text-base font-extrabold flex items-center gap-2.5">
                            {seccion && <Numeral n={seccion.num} />}
                            {editing ? "Editar ítem" : "Agregar ítem"} — {seccion?.nombre}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                        {seccion?.subsecciones?.length > 0 && (
                            <div>
                                <Label className="text-[10px] font-bold uppercase">Tipo</Label>
                                <Select value={form.subseccion}
                                    onValueChange={(v) => setForm((f) => ({ ...f, subseccion: v }))}>
                                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {seccion.subsecciones.map(([v, lbl]) => (
                                            <SelectItem key={v} value={v}>{lbl}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        {seccion?.campos.map(([k, lbl]) => (
                            <div key={k}>
                                <Label className="text-[10px] font-bold uppercase">{lbl}</Label>
                                <Input
                                    type={k.startsWith("fecha") ? "date" : "text"}
                                    value={form[k] ?? ""}
                                    onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                                    className="h-9"
                                />
                            </div>
                        ))}
                        <div>
                            <Label className="text-[10px] font-bold uppercase">
                                Documento que acredita (PDF o imagen, máx. 10 MB)
                            </Label>
                            <input type="file" accept=".pdf,.jpg,.jpeg,.png"
                                onChange={(e) => setArchivo(e.target.files?.[0] || null)}
                                className="block w-full text-xs text-slate-500 mt-1
                                           file:mr-3 file:px-3 file:py-1.5 file:rounded-md
                                           file:border-0 file:bg-blue-50 file:text-blue-700" />
                            {editing?.archivo_nombre && !archivo && (
                                <p className="text-[10px] text-slate-400 mt-1">
                                    Actual: {editing.archivo_nombre} (subir otro lo reemplaza)
                                </p>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                        <Button onClick={guardar} disabled={saving}
                            className="gap-1.5 text-white" style={{ background: NAVY }}>
                            {saving && <Loader2 size={14} className="animate-spin" />}
                            Guardar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
