// Administrativos y Locadores 107 – MINEDU.
//
// Desde aquí se crean las fichas Y los usuarios/accesos: al entrar al sistema
// con su rol, cada persona ve su hoja de vida (los mismos ítems del docente)
// y, si es locador 107, la carga de orden de servicio vigente, protocolo y
// plan de trabajo. Todo eso sale después en el portal público.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
    Search, Plus, Pencil, Trash2, Loader2, UserRound, KeyRound, FileText,
    ShieldCheck, X, Copy, RefreshCw, CheckCircle2, AlertCircle, UploadCloud,
} from "lucide-react";
import { api } from "../../lib/api";
import { SCOPE } from "./personalStyles";

const NAVY = "#1F4E79";

const GRADOS = [
    ["", "—"], ["SECUNDARIA", "Secundaria completa"], ["TECNICO", "Técnico (a)"],
    ["PROFESOR", "Profesor (a)"], ["BACHILLER", "Bachiller (a)"],
    ["LICENCIADO", "Licenciado (a)"], ["MAGISTER", "Magister (a)"],
    ["DOCTOR", "Doctor (a)"],
];
const CONDICIONES = [
    ["", "—"], ["NOMBRADO", "Nombrado (a)"], ["CONTRATADO", "Contratado (a)"],
    ["LOCADOR", "Locador (a) de servicios"],
];
const SEXOS = [["", "—"], ["M", "Masculino"], ["F", "Femenino"]];

const VACIO = {
    apellido_paterno: "", apellido_materno: "", nombres: "", document: "",
    cargo: "", area: "", sexo: "", fecha_nac: "", grado_academico: "",
    phone: "", email: "", telefono_fijo: "", direccion: "", region: "",
    provincia: "", distrito: "", condicion_laboral: "", rd_nombramiento: "",
    rd_fecha: "", orden_servicio_numero: "", orden_servicio_desde: "",
    orden_servicio_hasta: "", orden: 0,
};

function Campo({ label, children, ancho = "" }) {
    return (
        <div className={ancho}>
            <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                {label}
            </label>
            {children}
        </div>
    );
}

const inputCls =
    "mt-1 w-full h-10 px-3 rounded-xl border border-slate-200 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-400";

/* ── Modal de alta / edición ───────────────────────────────────────── */
function FichaModal({ tipo, ficha, onClose, onHecho }) {
    const editando = !!ficha;
    const [form, setForm] = useState(() => ({ ...VACIO }));
    const [foto, setFoto] = useState(null);
    const [docs, setDocs] = useState({});
    const [saving, setSaving] = useState(false);
    const esLocador = tipo === "LOCADOR";

    useEffect(() => {
        if (!ficha) { setForm({ ...VACIO }); return; }
        (async () => {
            try {
                const { data } = await api.get(`/personal/staff/${ficha.id}`);
                setForm((f) => {
                    const next = { ...f };
                    for (const k of Object.keys(VACIO)) {
                        if (data[k] !== undefined && data[k] !== null) next[k] = data[k];
                    }
                    return next;
                });
            } catch { /* se edita con lo que ya trae la fila */ }
        })();
        setForm((f) => ({
            ...f, cargo: ficha.cargo || "", area: ficha.area || "",
            document: ficha.documento || "", email: ficha.email || "",
            phone: ficha.celular || "",
            grado_academico: ficha.grado_academico || "",
            condicion_laboral: ficha.condicion_laboral || "",
            orden_servicio_numero: ficha.orden_servicio_numero || "",
            orden_servicio_desde: ficha.orden_servicio_desde || "",
            orden_servicio_hasta: ficha.orden_servicio_hasta || "",
        }));
    }, [ficha]);

    const set = (k) => (e) =>
        setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

    const guardar = async () => {
        if (!form.apellido_paterno && !form.nombres && !editando) {
            toast.error("Ingresa al menos apellidos y nombres");
            return;
        }
        setSaving(true);
        try {
            const fd = new FormData();
            fd.append("tipo", tipo);
            for (const [k, v] of Object.entries(form)) fd.append(k, v ?? "");
            if (foto) fd.append("photo", foto);
            for (const [k, f] of Object.entries(docs)) if (f) fd.append(k, f);

            const { data } = editando
                ? await api.put(`/personal/staff/${ficha.id}`, fd)
                : await api.post("/personal/staff", fd);

            if (data?.acceso_error) toast.warning(data.acceso_error);
            else toast.success(editando ? "Ficha actualizada" : "Ficha creada");
            onHecho(data, !editando);
            onClose();
        } catch (e) {
            toast.error(e?.response?.data?.detail || "No se pudo guardar");
        } finally { setSaving(false); }
    };

    const fileRow = (campo, rotulo) => (
        <Campo label={rotulo}>
            <label className="mt-1 flex items-center gap-2 h-10 px-3 rounded-xl border border-dashed border-slate-300 text-[12px] text-slate-500 cursor-pointer hover:border-blue-400 hover:text-blue-700">
                <UploadCloud size={14} />
                <span className="truncate">
                    {docs[campo]?.name || "Seleccionar archivo…"}
                </span>
                <input type="file" hidden accept=".pdf,.doc,.docx,.jpg,.png"
                    onChange={(e) => setDocs((d) => ({ ...d, [campo]: e.target.files?.[0] || null }))} />
            </label>
        </Campo>
    );

    // Portal a <body>: dentro de ModuleShell el backdrop-blur de la tarjeta
    // crea un containing block y el overlay `fixed` se anclaba a ella.
    return createPortal(
        <div className={`${SCOPE} adm-overlay`}>
            <div className="adm-modal w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                            {esLocador ? "Locador 107 – MINEDU" : "Personal administrativo"}
                        </p>
                        <h3 className="text-[15px] font-extrabold text-slate-800">
                            {editando ? "Editar ficha" : "Nueva ficha y acceso"}
                        </h3>
                    </div>
                    <button onClick={onClose}
                        className="adm-ghost p-1.5 rounded-lg text-slate-400 hover:text-slate-700">
                        <X size={18} />
                    </button>
                </div>

                <div className="adm-modal-body flex-1 px-5 py-4 space-y-5">
                    <section>
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.12em]"
                            style={{ color: NAVY }}>Identificación</p>
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <Campo label="Apellido paterno">
                                <input className={inputCls} value={form.apellido_paterno} onChange={set("apellido_paterno")} />
                            </Campo>
                            <Campo label="Apellido materno">
                                <input className={inputCls} value={form.apellido_materno} onChange={set("apellido_materno")} />
                            </Campo>
                            <Campo label="Nombres">
                                <input className={inputCls} value={form.nombres} onChange={set("nombres")} />
                            </Campo>
                            <Campo label="DNI">
                                <input className={inputCls} value={form.document} inputMode="numeric"
                                    onChange={(e) => setForm((f) => ({ ...f, document: e.target.value.replace(/\D/g, "") }))} />
                            </Campo>
                            <Campo label="Sexo">
                                <select className={inputCls} value={form.sexo} onChange={set("sexo")}>
                                    {SEXOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                </select>
                            </Campo>
                            <Campo label="Fecha de nacimiento">
                                <input type="date" className={inputCls} value={form.fecha_nac} onChange={set("fecha_nac")} />
                            </Campo>
                        </div>
                    </section>

                    <section>
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.12em]"
                            style={{ color: NAVY }}>Cargo y vínculo</p>
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <Campo label="Cargo" ancho="sm:col-span-2">
                                <input className={inputCls} value={form.cargo} onChange={set("cargo")}
                                    placeholder={esLocador
                                        ? "Ej: Vigilante, Personal de limpieza…"
                                        : "Según el Reglamento Institucional"} />
                            </Campo>
                            <Campo label="Área / Unidad">
                                <input className={inputCls} value={form.area} onChange={set("area")} />
                            </Campo>
                            <Campo label="Grado académico">
                                <select className={inputCls} value={form.grado_academico} onChange={set("grado_academico")}>
                                    {GRADOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                </select>
                            </Campo>
                            <Campo label="Condición laboral">
                                <select className={inputCls} value={form.condicion_laboral} onChange={set("condicion_laboral")}>
                                    {CONDICIONES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                </select>
                            </Campo>
                            <Campo label="N° R.D. / Contrato">
                                <input className={inputCls} value={form.rd_nombramiento} onChange={set("rd_nombramiento")} />
                            </Campo>
                        </div>
                    </section>

                    <section>
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.12em]"
                            style={{ color: NAVY }}>Contacto</p>
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <Campo label="Correo">
                                <input className={inputCls} value={form.email} onChange={set("email")} />
                            </Campo>
                            <Campo label="Celular">
                                <input className={inputCls} value={form.phone} onChange={set("phone")} />
                            </Campo>
                            <Campo label="Teléfono fijo">
                                <input className={inputCls} value={form.telefono_fijo} onChange={set("telefono_fijo")} />
                            </Campo>
                            <Campo label="Dirección" ancho="sm:col-span-3">
                                <input className={inputCls} value={form.direccion} onChange={set("direccion")} />
                            </Campo>
                            <Campo label="Región">
                                <input className={inputCls} value={form.region} onChange={set("region")} />
                            </Campo>
                            <Campo label="Provincia">
                                <input className={inputCls} value={form.provincia} onChange={set("provincia")} />
                            </Campo>
                            <Campo label="Distrito">
                                <input className={inputCls} value={form.distrito} onChange={set("distrito")} />
                            </Campo>
                        </div>
                    </section>

                    <section>
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.12em]"
                            style={{ color: NAVY }}>
                            {esLocador ? "Foto y documentos del locador" : "Foto"}
                        </p>
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <Campo label="Fotografía">
                                <label className="mt-1 flex items-center gap-2 h-10 px-3 rounded-xl border border-dashed border-slate-300 text-[12px] text-slate-500 cursor-pointer hover:border-blue-400 hover:text-blue-700">
                                    <UploadCloud size={14} />
                                    <span className="truncate">{foto?.name || "Seleccionar imagen…"}</span>
                                    <input type="file" hidden accept="image/*"
                                        onChange={(e) => setFoto(e.target.files?.[0] || null)} />
                                </label>
                            </Campo>
                            {esLocador && (
                                <>
                                    {fileRow("orden_servicio", "Orden de servicio vigente")}
                                    {fileRow("protocolo", "Protocolo")}
                                    {fileRow("plan_trabajo", "Plan de trabajo")}
                                    <Campo label="N° de orden de servicio">
                                        <input className={inputCls} value={form.orden_servicio_numero}
                                            onChange={set("orden_servicio_numero")} />
                                    </Campo>
                                    <Campo label="Vigente desde">
                                        <input type="date" className={inputCls} value={form.orden_servicio_desde}
                                            onChange={set("orden_servicio_desde")} />
                                    </Campo>
                                    <Campo label="Vigente hasta">
                                        <input type="date" className={inputCls} value={form.orden_servicio_hasta}
                                            onChange={set("orden_servicio_hasta")} />
                                    </Campo>
                                </>
                            )}
                        </div>
                    </section>

                    {!editando && (
                        <p className="text-[11.5px] text-slate-500 bg-slate-50 rounded-xl px-3 py-2.5 leading-relaxed">
                            Al guardar se crea también el <b>usuario y acceso</b>. La
                            contraseña temporal se muestra una sola vez: cópiala y
                            entrégala. La persona la cambia en su primer ingreso.
                        </p>
                    )}
                </div>

                <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
                    <button onClick={onClose}
                        className="adm-ghost px-4 h-9 rounded-xl text-[12.5px] font-bold text-slate-500">
                        Cancelar
                    </button>
                    <button onClick={guardar} disabled={saving}
                        className="adm-primary inline-flex items-center gap-1.5 px-5 h-9 rounded-xl text-[12.5px] font-extrabold">
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                        {editando ? "Guardar cambios" : "Crear ficha y acceso"}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}

/* ── Aviso de contraseña temporal ──────────────────────────────────── */
function AvisoClave({ dato, onClose }) {
    const copiar = () => {
        navigator.clipboard?.writeText(
            `Usuario: ${dato.username}\nContraseña: ${dato.temporary_password}`);
        toast.success("Credenciales copiadas");
    };
    return createPortal(
        <div className={`${SCOPE} adm-overlay`} style={{ zIndex: 90 }}>
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 text-center">
                <div className="h-12 w-12 rounded-2xl bg-emerald-50 grid place-items-center mx-auto">
                    <KeyRound className="text-emerald-600" size={20} />
                </div>
                <h3 className="mt-3 text-[15px] font-extrabold text-slate-800">
                    Acceso creado
                </h3>
                <p className="mt-1 text-[12px] text-slate-500">
                    Anota estas credenciales: la contraseña no se vuelve a mostrar.
                </p>
                <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-left font-mono text-[13px]">
                    <p><span className="text-slate-400">Usuario: </span><b>{dato.username}</b></p>
                    <p><span className="text-slate-400">Contraseña: </span><b>{dato.temporary_password}</b></p>
                </div>
                <div className="mt-4 flex gap-2 justify-center">
                    <button onClick={copiar}
                        className="adm-outline inline-flex items-center gap-1.5 px-4 h-9 rounded-xl border border-slate-200 text-[12.5px] font-bold">
                        <Copy size={14} /> Copiar
                    </button>
                    <button onClick={onClose}
                        className="adm-primary px-5 h-9 rounded-xl text-[12.5px] font-extrabold">
                        Listo
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}

/* ── Panel ─────────────────────────────────────────────────────────── */
export default function StaffPanel({ tipo }) {
    const esLocador = tipo === "LOCADOR";
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState("");
    const [modal, setModal] = useState(null);   // {ficha} | {}
    const [clave, setClave] = useState(null);
    const timer = useRef(null);

    const load = useCallback(async (texto = "") => {
        setLoading(true);
        try {
            const { data } = await api.get("/personal/staff", {
                params: { tipo, ...(texto ? { q: texto } : {}) },
            });
            setRows(data?.rows || []);
        } catch (e) {
            toast.error(e?.response?.data?.detail || "No se pudo cargar el listado");
            setRows([]);
        } finally { setLoading(false); }
    }, [tipo]);

    useEffect(() => { load(); }, [load]);

    const onQ = (v) => {
        setQ(v);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => load(v.trim()), 300);
    };

    const trasGuardar = (data, esNuevo) => {
        if (data?.temporary_password) setClave(data);
        if (esNuevo) load(q.trim());
        else setRows((rs) => rs.map((r) => (r.id === data.id ? data : r)));
    };

    const acceso = async (r, reset) => {
        if (reset && !window.confirm(
            `¿Resetear la contraseña de ${r.nombre}? La actual dejará de servir.`)) return;
        try {
            const { data } = await api.post(
                `/personal/staff/${r.id}/acceso`, {}, { params: reset ? { reset: 1 } : {} });
            setRows((rs) => rs.map((x) => (x.id === data.id ? data : x)));
            if (data?.temporary_password) setClave(data);
            else toast.success(data?.detail || "Acceso actualizado");
        } catch (e) {
            toast.error(e?.response?.data?.detail || "No se pudo gestionar el acceso");
        }
    };

    const eliminar = async (r) => {
        if (!window.confirm(
            `¿Eliminar la ficha de ${r.nombre}? Su usuario quedará desactivado.`)) return;
        try {
            await api.delete(`/personal/staff/${r.id}`);
            setRows((rs) => rs.filter((x) => x.id !== r.id));
            toast.success("Ficha eliminada");
        } catch (e) {
            toast.error(e?.response?.data?.detail || "No se pudo eliminar");
        }
    };

    const cvUrl = (r) =>
        `${api.defaults.baseURL || ""}/personal/staff/${r.id}/cv/pdf`;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[220px] max-w-md">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={q} onChange={(e) => onQ(e.target.value)}
                        placeholder="Buscar por nombre, DNI, cargo o área…"
                        className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-400" />
                </div>
                <div className="flex gap-2">
                    <button onClick={() => load(q.trim())}
                        className="adm-outline inline-flex items-center gap-1.5 px-3 h-10 rounded-xl border border-slate-200 text-[12px] font-bold">
                        <RefreshCw size={13} /> Actualizar
                    </button>
                    <button onClick={() => setModal({})}
                        className="adm-primary inline-flex items-center gap-1.5 px-4 h-10 rounded-xl text-[12.5px] font-extrabold">
                        <Plus size={14} /> {esLocador ? "Nuevo locador" : "Nuevo administrativo"}
                    </button>
                </div>
            </div>

            <p className="text-[11.5px] text-slate-500 leading-relaxed">
                {esLocador
                    ? <>Al crear el acceso, el locador entra al sistema y completa su
                        <b> hoja de vida</b>, su <b>foto</b>, su <b>orden de servicio
                            vigente</b>, el <b>protocolo</b> y su <b>plan de trabajo</b>.
                        Todo eso se publica en el portal de transparencia.</>
                    : <>Al crear el acceso, el administrativo entra al sistema y completa
                        su <b>hoja de vida</b> con los mismos ítems que los docentes
                        (datos personales, formación, especialización, experiencia,
                        eventos) y su <b>foto</b>.</>}
            </p>

            <div className="rounded-2xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[980px] text-sm">
                        <thead>
                            <tr style={{ background: NAVY }} className="text-white">
                                <th className="text-left px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.1em]">Persona</th>
                                <th className="text-left px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.1em]">Cargo</th>
                                <th className="text-left px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.1em]">Acceso</th>
                                <th className="text-left px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.1em]">Hoja de vida</th>
                                {esLocador && (
                                    <th className="text-left px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.1em]">Documentos</th>
                                )}
                                <th className="px-4 py-2.5 w-[110px]" />
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={esLocador ? 6 : 5} className="py-12 text-center text-slate-400">
                                    <Loader2 className="animate-spin inline" size={20} />
                                </td></tr>
                            ) : rows.length === 0 ? (
                                <tr><td colSpan={esLocador ? 6 : 5} className="py-12 text-center">
                                    <p className="text-slate-600 font-bold text-[13px]">Todavía no hay fichas</p>
                                    <p className="text-[12px] text-slate-400 mt-1">
                                        Usa «{esLocador ? "Nuevo locador" : "Nuevo administrativo"}» para crear la primera.
                                    </p>
                                </td></tr>
                            ) : rows.map((r, i) => (
                                <tr key={r.id}
                                    className={"border-t border-slate-100 " + (i % 2 ? "bg-slate-50/60" : "")}>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2.5">
                                            <span className="h-9 w-9 rounded-xl overflow-hidden bg-slate-100 grid place-items-center shrink-0">
                                                {r.foto_url
                                                    ? <img src={r.foto_url} alt="" className="h-full w-full object-cover" />
                                                    : <UserRound size={15} className="text-slate-300" />}
                                            </span>
                                            <span className="min-w-0">
                                                <span className="block text-[12.5px] font-bold text-slate-800 truncate">
                                                    {r.nombre}
                                                </span>
                                                <span className="block text-[10.5px] text-slate-400 truncate">
                                                    {[r.documento, r.grado_label].filter(Boolean).join(" · ") || "—"}
                                                </span>
                                            </span>
                                        </div>
                                    </td>

                                    <td className="px-4 py-3">
                                        <span className="block text-[12px] text-slate-700">{r.cargo || "—"}</span>
                                        {r.area && <span className="block text-[10.5px] text-slate-400">{r.area}</span>}
                                    </td>

                                    <td className="px-4 py-3">
                                        {r.username ? (
                                            <div className="flex items-center gap-2">
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-[10.5px] font-bold text-slate-600 font-mono">
                                                    {r.username}
                                                </span>
                                                <button onClick={() => acceso(r, true)}
                                                    title="Resetear contraseña"
                                                    className="adm-ghost p-1.5 rounded-lg text-slate-400 hover:text-blue-600">
                                                    <KeyRound size={14} />
                                                </button>
                                            </div>
                                        ) : (
                                            <button onClick={() => acceso(r, false)}
                                                className="adm-plain inline-flex items-center gap-1.5 px-3 h-8 rounded-xl border border-dashed border-slate-300 text-[11.5px] font-bold text-slate-500 hover:border-blue-400 hover:text-blue-700">
                                                <KeyRound size={13} /> Crear acceso
                                            </button>
                                        )}
                                    </td>

                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <span className={"inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold border "
                                                + (r.cv_items > 0
                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                    : "bg-amber-50 text-amber-700 border-amber-200")}>
                                                {r.cv_items > 0
                                                    ? <><CheckCircle2 size={11} /> {r.cv_items} ítems</>
                                                    : <><AlertCircle size={11} /> Sin llenar</>}
                                            </span>
                                            {r.cv_items > 0 && (
                                                <a href={cvUrl(r)} target="_blank" rel="noreferrer"
                                                    className="p-1.5 rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                                                    title="Descargar hoja de vida">
                                                    <FileText size={14} />
                                                </a>
                                            )}
                                        </div>
                                    </td>

                                    {esLocador && (
                                        <td className="px-4 py-3">
                                            <div className="flex flex-wrap gap-1.5">
                                                {[["orden_servicio_url", "O/S"],
                                                ["protocolo_url", "Protocolo"],
                                                ["plan_trabajo_url", "Plan"]].map(([k, l]) => (
                                                    r[k] ? (
                                                        <a key={k} href={r[k]} target="_blank" rel="noreferrer"
                                                            className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10.5px] font-bold hover:bg-blue-100">
                                                            {l}
                                                        </a>
                                                    ) : (
                                                        <span key={k}
                                                            className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 text-[10.5px] font-bold">
                                                            {l}
                                                        </span>
                                                    )
                                                ))}
                                            </div>
                                            {r.orden_servicio_url && (
                                                <span className={"mt-1 inline-flex items-center gap-1 text-[10px] font-bold "
                                                    + (r.orden_servicio_vigente ? "text-emerald-600" : "text-red-600")}>
                                                    <ShieldCheck size={10} />
                                                    {r.orden_servicio_vigente ? "O/S vigente" : "O/S vencida"}
                                                </span>
                                            )}
                                        </td>
                                    )}

                                    <td className="px-4 py-3">
                                        <div className="flex justify-end gap-1">
                                            <button onClick={() => setModal({ ficha: r })}
                                                className="adm-ghost p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
                                                title="Editar">
                                                <Pencil size={14} />
                                            </button>
                                            <button onClick={() => eliminar(r)}
                                                className="adm-danger p-1.5 rounded-lg"
                                                title="Eliminar">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {modal && (
                <FichaModal tipo={tipo} ficha={modal.ficha}
                    onClose={() => setModal(null)} onHecho={trasGuardar} />
            )}
            {clave && <AvisoClave dato={clave} onClose={() => setClave(null)} />}
        </div>
    );
}
