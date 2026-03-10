// src/modules/student/StudentProfileForm.jsx — UI/UX mejorado
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
    Upload, Image as ImageIcon, Save, Lock, Crop, X, Check,
    UserCircle, Phone, MapPin, Building2, BookOpen, Loader2, Trash2,
} from "lucide-react";
import Cropper from "react-easy-crop";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";

/* ─── inject font & styles ─── */
function InjectProfileStyles() {
    useEffect(() => {
        const id = "profile-styles";
        if (document.getElementById(id)) return;
        const l = document.createElement("link");
        l.id = id + "-font"; l.rel = "stylesheet";
        l.href = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap";
        document.head.appendChild(l);
        const s = document.createElement("style");
        s.id = id;
        s.textContent = `
          .pf-root { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
          .pf-root * { font-family: inherit; }

          /* card header gradient border */
          .pf-header {
            border-top: 3px solid transparent;
            border-image: linear-gradient(90deg,#3B82F6,#6366F1,#8B5CF6) 1;
            border-radius: 1rem 1rem 0 0;
          }

          /* section separator */
          .pf-section-title {
            display: flex; align-items: center; gap: 10px;
            padding-bottom: 12px; margin-bottom: 16px;
            border-bottom: 1.5px solid #F1F5F9;
          }
          .pf-section-icon {
            width: 32px; height: 32px; border-radius: 10px;
            background: #EFF6FF; display: flex; align-items: center; justify-content: center;
          }

          /* field labels */
          .pf-label {
            display: flex; align-items: center; gap: 5px;
            font-size: 10px; font-weight: 800; color: #64748B;
            text-transform: uppercase; letter-spacing: .1em;
            margin-bottom: 6px;
          }
          .pf-label-locked { opacity: .55; }

          /* inputs */
          .pf-input {
            height: 36px; border-radius: 12px;
            border: 1px solid #E2E8F0; background: #F8FAFC;
            padding: 0 12px; font-size: 13px; color: #1E293B;
            transition: border-color .15s, background .15s, box-shadow .15s;
            outline: none; width: 100%;
          }
          .pf-input:focus { border-color: #6366F1; background: #fff; box-shadow: 0 0 0 3px rgba(99,102,241,.12); }
          .pf-input:disabled { opacity: .5; cursor: not-allowed; }

          /* select */
          .pf-select {
            height: 36px; border-radius: 12px;
            border: 1px solid #E2E8F0; background: #F8FAFC;
            padding: 0 32px 0 12px; font-size: 13px; color: #1E293B;
            transition: border-color .15s, background .15s, box-shadow .15s;
            outline: none; width: 100%; appearance: none; cursor: pointer;
          }
          .pf-select:focus { border-color: #6366F1; background: #fff; box-shadow: 0 0 0 3px rgba(99,102,241,.12); }
          .pf-select:disabled { opacity: .5; cursor: not-allowed; }

          /* photo area */
          .pf-avatar {
            width: 112px; height: 112px; border-radius: 50%;
            overflow: hidden; background: #F1F5F9;
            border: 4px solid #fff; box-shadow: 0 4px 16px rgba(0,0,0,.1);
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0;
          }

          /* zoom slider */
          .pf-range {
            -webkit-appearance: none; appearance: none;
            width: 100%; height: 6px; border-radius: 999px;
            background: #E2E8F0; outline: none; cursor: pointer;
          }
          .pf-range::-webkit-slider-thumb {
            -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%;
            background: #1E293B; cursor: pointer;
            box-shadow: 0 2px 6px rgba(0,0,0,.25);
          }

          /* section groups */
          .pf-section { padding: 20px; border-radius: 14px; border: 1px solid #E2E8F0; background: #FAFCFE; }

          @keyframes pf-fade { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:none} }
          .pf-fade { animation: pf-fade .25s ease both; }
        `;
        document.head.appendChild(s);
        return () => {
            document.getElementById(id)?.remove();
            document.getElementById(id + "-font")?.remove();
        };
    }, []);
    return null;
}

/* ─── constants ─── */
const empty = {
    region: "", provincia: "", distrito: "",
    codigoModular: "", nombreInstitucion: "", gestion: "", tipo: "",
    programaCarrera: "", ciclo: "", turno: "", seccion: "",
    apellidoPaterno: "", apellidoMaterno: "", nombres: "",
    fechaNac: "", sexo: "",
    numDocumento: "", lengua: "", periodo: "", discapacidad: "", tipoDiscapacidad: "",
    email: "", celular: "", photoUrl: "",
};

const safeDate = (v) => (v ? String(v).slice(0, 10) : "");

const TURNOS = [{ value: "Mañana", label: "Mañana" }, { value: "Tarde", label: "Tarde" }, { value: "Noche", label: "Noche" }];
const SEXOS = [{ value: "M", label: "Masculino (M)" }, { value: "F", label: "Femenino (F)" }, { value: "Otro", label: "Otro" }];
const DISC = [{ value: "SI", label: "SI" }, { value: "NO", label: "NO" }];

/* ─── section title ─── */
const SectionTitle = ({ icon: Icon, title, color = "#3B82F6" }) => (
    <div className="pf-section-title">
        <div className="pf-section-icon" style={{ background: `${color}18` }}>
            <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <h3 className="text-xs font-800 text-slate-600 uppercase tracking-widest">{title}</h3>
    </div>
);

/* ─── select wrapper (chevron icon) ─── */
const SelectField = ({ value, onChange, disabled, options, placeholder = "— Selecciona —" }) => (
    <div className="relative">
        <select className="pf-select" value={value ?? ""} onChange={onChange} disabled={disabled}>
            <option value="">{placeholder}</option>
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
    </div>
);

/* ─── cropper utility ─── */
const createImage = (url) =>
    new Promise((resolve, reject) => {
        const img = new Image();
        img.addEventListener("load", () => resolve(img));
        img.addEventListener("error", (e) => reject(e));
        img.setAttribute("crossOrigin", "anonymous");
        img.src = url;
    });

async function getCroppedImg(imageSrc, pixelCrop) {
    const image = await createImage(imageSrc);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    canvas.width = pixelCrop.width; canvas.height = pixelCrop.height;
    ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => { if (!blob) reject(new Error("Canvas is empty")); else resolve(blob); }, "image/jpeg", 0.95);
    });
}

/* ─── main component ─── */
export default function StudentProfileForm({ mode, student, loading, onSave, onUploadPhoto, onDeletePhoto }) {
    const [form, setForm] = useState(empty);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const [photoFile, setPhotoFile] = useState(null);
    const [photoPreview, setPhotoPreview] = useState("");
    const fileInputRef = useRef(null);

    const [isCropping, setIsCropping] = useState(false);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

    const isAdmin = mode === "admin";
    const studentEditable = useMemo(() => new Set(["email", "celular"]), []);
    const canEdit = (key) => (isAdmin ? true : studentEditable.has(key));
    const busy = loading || saving;

    /* load student */
    useEffect(() => {
        if (!student) { setForm(empty); setPhotoPreview(""); return; }
        setForm({ ...empty, ...student, fechaNac: safeDate(student?.fechaNac), ciclo: student?.ciclo ?? "", photoUrl: student?.photoUrl || "" });
        setPhotoPreview(student?.photoUrl || "");
        setPhotoFile(null);
    }, [student]);

    const pickPhoto = (file) => {
        if (!file) return;
        setPhotoFile(file);
        setPhotoPreview(URL.createObjectURL(file));
        setZoom(1); setCrop({ x: 0, y: 0 }); setIsCropping(true);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const onCropComplete = useCallback((_, cap) => { setCroppedAreaPixels(cap); }, []);

    const handleSaveCrop = async () => {
        try {
            const blob = await getCroppedImg(photoPreview, croppedAreaPixels);
            const file = new File([blob], "profile_cropped.jpg", { type: "image/jpeg" });
            setPhotoFile(file);
            setPhotoPreview(URL.createObjectURL(file));
            setIsCropping(false);
            toast.success("Foto lista para guardar");
        } catch (e) { console.error(e); toast.error("Error al recortar la imagen"); }
    };

    const handleDeletePhoto = async () => {
        if (!onDeletePhoto) return;
        if (!window.confirm("¿Seguro que deseas eliminar la foto de perfil?")) return;
        try {
            setDeleting(true);
            await onDeletePhoto();
            setPhotoPreview("");
            setPhotoFile(null);
            setForm((f) => ({ ...f, photoUrl: "" }));
            if (fileInputRef.current) fileInputRef.current.value = "";
            toast.success("Foto eliminada");
        } catch (e) {
            console.error(e);
            toast.error("No se pudo eliminar la foto");
        } finally { setDeleting(false); }
    };

    const submit = async (e) => {
        e.preventDefault();
        if (!student && isAdmin) { toast.error("Selecciona un estudiante primero."); return; }
        try {
            setSaving(true);
            const payload = { ...form };
            payload.ciclo = payload.ciclo === "" ? null : Number(payload.ciclo);
            if (!isAdmin) {
                const filtered = {};
                for (const k of Object.keys(payload)) if (studentEditable.has(k)) filtered[k] = payload[k];
                await onSave(filtered);
            } else { await onSave(payload); }
            if (photoFile) { await onUploadPhoto(photoFile); setPhotoFile(null); }
        } finally { setSaving(false); }
    };

    /* field renderer */
    const F = (key, label, props = {}) => (
        <div>
            <label className={`pf-label ${!canEdit(key) ? "pf-label-locked" : ""}`}>
                {label} {!canEdit(key) && <Lock className="w-3 h-3" />}
            </label>
            <input className="pf-input" value={form[key] ?? ""} disabled={!canEdit(key) || busy}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })} {...props} />
        </div>
    );

    const SF = (key, label, options) => (
        <div>
            <label className={`pf-label ${!canEdit(key) ? "pf-label-locked" : ""}`}>
                {label} {!canEdit(key) && <Lock className="w-3 h-3" />}
            </label>
            <SelectField value={form[key] ?? ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                disabled={!canEdit(key) || busy} options={options} />
        </div>
    );

    return (
        <>
            <InjectProfileStyles />
            <div className="pf-root">

                {/* ── card wrapper ── */}
                <div className="pf-header rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">

                    {/* module header */}
                    <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25 shrink-0">
                                <UserCircle className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-900 text-slate-800 tracking-tight">Perfil del Estudiante</h2>
                                <p className="text-xs text-slate-400 mt-0.5 font-500">
                                    {isAdmin ? "Edición completa de datos del estudiante" : "Puedes actualizar tu correo y teléfono"}
                                </p>
                            </div>
                        </div>
                        {!isAdmin && (
                            <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-amber-50 border border-amber-100 text-[11px] font-800 text-amber-700 uppercase tracking-wider">
                                <Lock className="w-3 h-3 mr-1.5" /> Vista limitada
                            </span>
                        )}
                    </div>

                    {/* form body */}
                    <form onSubmit={submit} className="p-6 space-y-6">

                        {/* ── photo section ── */}
                        <div className="pf-section flex flex-col sm:flex-row items-center gap-6">
                            {/* avatar */}
                            <div className="pf-avatar shrink-0">
                                {photoPreview
                                    ? <img src={photoPreview} alt="foto" className="w-full h-full object-cover" />
                                    : <ImageIcon className="w-10 h-10 text-slate-300" />}
                            </div>

                            {/* controls */}
                            <div className="flex-1 flex flex-col items-center sm:items-start gap-2">
                                <div className="text-center sm:text-left">
                                    <p className="text-sm font-800 text-slate-700">Foto de Perfil</p>
                                    <p className="text-xs text-slate-400 mt-0.5 max-w-xs">Será visible en el carnet estudiantil. Usa una foto formal y reciente.</p>
                                </div>
                                <div className="flex flex-wrap gap-2 mt-1">
                                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" disabled={busy}
                                        onChange={(e) => pickPhoto(e.target.files?.[0] || null)} />
                                    <Button type="button" variant="outline" className="h-9 px-4 rounded-xl border-slate-200 text-sm gap-1.5 hover:bg-slate-50"
                                        onClick={() => fileInputRef.current?.click()} disabled={busy}>
                                        <Upload className="w-3.5 h-3.5" /> {photoPreview ? "Cambiar foto" : "Subir nueva"}
                                    </Button>
                                    {photoPreview && (
                                        <Button type="button" variant="outline" className="h-9 px-4 rounded-xl border-slate-200 text-sm gap-1.5 hover:bg-slate-50"
                                            onClick={() => { setZoom(1); setCrop({ x: 0, y: 0 }); setIsCropping(true); }} disabled={busy}>
                                            <Crop className="w-3.5 h-3.5" /> Recortar
                                        </Button>
                                    )}
                                    {photoFile && !isCropping && (
                                        <Button type="button" variant="ghost" className="h-9 px-4 rounded-xl text-red-500 hover:text-red-700 hover:bg-red-50 text-sm"
                                            onClick={() => { setPhotoFile(null); setPhotoPreview(form.photoUrl || ""); if (fileInputRef.current) fileInputRef.current.value = ""; }} disabled={busy}>
                                            Revertir
                                        </Button>
                                    )}
                                    {/* Eliminar foto (solo si hay foto guardada en el servidor y no hay cambio pendiente) */}
                                    {form.photoUrl && !photoFile && !isCropping && onDeletePhoto && (
                                        <Button type="button" variant="ghost"
                                            className="h-9 px-4 rounded-xl text-red-500 hover:text-red-700 hover:bg-red-50 text-sm gap-1.5"
                                            onClick={handleDeletePhoto} disabled={busy || deleting}>
                                            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                            Eliminar foto
                                        </Button>
                                    )}
                                </div>
                                {photoFile && !isCropping && (
                                    <p className="text-[11px] text-emerald-600 font-700 flex items-center gap-1 mt-0.5">
                                        <Check className="w-3 h-3" /> Nueva foto lista — se guardará al confirmar
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* ── identidad ── */}
                        <div className="pf-section pf-fade" style={{ animationDelay: "60ms" }}>
                            <SectionTitle icon={UserCircle} title="Identidad Personal" color="#3B82F6" />
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {F("numDocumento", "N° Documento (DNI)")}
                                {F("nombres", "Nombres")}
                                {F("apellidoPaterno", "Apellido Paterno")}
                                {F("apellidoMaterno", "Apellido Materno")}
                                {SF("sexo", "Sexo", SEXOS)}
                                {F("fechaNac", "Fecha de Nacimiento", { type: "date" })}
                            </div>
                        </div>

                        {/* ── contacto + ubicación ── */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pf-fade" style={{ animationDelay: "100ms" }}>
                            <div className="pf-section">
                                <SectionTitle icon={Phone} title="Contacto" color="#10B981" />
                                <div className="grid grid-cols-1 gap-4">
                                    {F("email", "Correo Electrónico", { type: "email" })}
                                    {F("celular", "Teléfono / Celular")}
                                </div>
                            </div>
                            <div className="pf-section">
                                <SectionTitle icon={MapPin} title="Ubicación Geográfica" color="#F59E0B" />
                                <div className="grid grid-cols-3 gap-4">
                                    {F("region", "Región")}
                                    {F("provincia", "Provincia")}
                                    {F("distrito", "Distrito")}
                                </div>
                            </div>
                        </div>

                        {/* ── institución ── */}
                        <div className="pf-section pf-fade" style={{ animationDelay: "140ms" }}>
                            <SectionTitle icon={Building2} title="Datos Institucionales" color="#6366F1" />
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {F("codigoModular", "Código Modular")}
                                <div className="lg:col-span-2">{F("nombreInstitucion", "Nombre de la Institución")}</div>
                                {F("gestion", "Tipo de Gestión")}
                                {F("tipo", "Tipo Institución")}
                            </div>
                        </div>

                        {/* ── académico ── */}
                        <div className="pf-section pf-fade" style={{ animationDelay: "180ms" }}>
                            <SectionTitle icon={BookOpen} title="Información Académica" color="#8B5CF6" />
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="lg:col-span-2">{F("programaCarrera", "Programa de Estudios / Carrera")}</div>
                                {F("ciclo", "Ciclo Actual", { type: "number", min: 0 })}
                                {SF("turno", "Turno", TURNOS)}
                                {F("seccion", "Sección")}
                                {F("periodo", "Periodo Lectivo")}
                                {F("lengua", "Lengua Materna")}
                                {SF("discapacidad", "¿Tiene Discapacidad?", DISC)}
                                <div className="lg:col-span-4">{F("tipoDiscapacidad", "Especifique tipo de discapacidad (si aplica)")}</div>
                            </div>
                        </div>

                        {/* ── submit ── */}
                        <div className="flex items-center justify-end pt-4 border-t border-slate-100">
                            <Button type="submit" className="h-10 px-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-800 shadow-sm gap-2 transition-all active:scale-[.98]" disabled={busy}>
                                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</> : <><Save className="w-4 h-4" /> Guardar Cambios</>}
                            </Button>
                        </div>
                    </form>
                </div>

                {/* ── crop modal ── */}
                {isCropping && (
                    <div className="fixed inset-0 z-[9999] bg-black/85 flex items-center justify-center p-4" style={{ backdropFilter: "blur(4px)" }}>
                        <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl flex flex-col" style={{ maxHeight: "90vh" }}>

                            {/* modal header */}
                            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-800 text-slate-800">Ajustar Foto</p>
                                    <p className="text-xs text-slate-400 mt-0.5">Arrastra y haz zoom para encuadrar tu foto.</p>
                                </div>
                                <button type="button"
                                    className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                                    onClick={() => setIsCropping(false)}>
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* crop area */}
                            <div className="relative w-full bg-neutral-950" style={{ height: 320 }}>
                                <Cropper
                                    image={photoPreview} crop={crop} zoom={zoom} aspect={1}
                                    onCropChange={setCrop} onCropComplete={onCropComplete} onZoomChange={setZoom}
                                    showGrid cropShape="round"
                                />
                            </div>

                            {/* controls */}
                            <div className="p-5 space-y-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-[11px] font-700 text-slate-400">
                                        <span>Alejar</span>
                                        <span className="text-slate-600">Zoom {zoom.toFixed(1)}×</span>
                                        <span>Acercar</span>
                                    </div>
                                    <input type="range" min={1} max={3} step={0.1} value={zoom}
                                        onChange={(e) => setZoom(Number(e.target.value))}
                                        className="pf-range" />
                                </div>
                                <div className="flex justify-end gap-2 pt-1">
                                    <Button variant="outline" className="h-9 px-4 rounded-xl border-slate-200 text-sm" onClick={() => setIsCropping(false)}>
                                        Cancelar
                                    </Button>
                                    <Button className="h-9 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-700 gap-1.5 shadow-sm" onClick={handleSaveCrop}>
                                        <Check className="w-4 h-4" /> Confirmar recorte
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}