/* ═══════════════════════════════════════════════════════════════
   TeacherProfile — "Mi Perfil" del docente
   El docente actualiza sus propios datos: foto, fecha de nacimiento,
   grado académico, celular y correo institucional.
   ═══════════════════════════════════════════════════════════════ */
import React, { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Save, Camera, UserRound, CalendarDays, FileText } from "lucide-react";
import api from "@/lib/api";

const GRADOS = [
    { value: "PROFESOR", label: "Profesor (a)" },
    { value: "BACHILLER", label: "Bachiller (a)" },
    { value: "LICENCIADO", label: "Licenciado (a)" },
    { value: "MAGISTER", label: "Magister (a)" },
    { value: "DOCTOR", label: "Doctor (a)" },
];

export default function TeacherProfile() {
    const [perfil, setPerfil] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [fechaNac, setFechaNac] = useState("");
    const [grado, setGrado] = useState("");
    const [celular, setCelular] = useState("");
    const [correo, setCorreo] = useState("");
    const [condicion, setCondicion] = useState("");
    const [rdNum, setRdNum] = useState("");
    const [rdFecha, setRdFecha] = useState("");
    const [fotoFile, setFotoFile] = useState(null);
    const [fotoPreview, setFotoPreview] = useState("");
    const fileRef = useRef(null);

    const load = async () => {
        setLoading(true);
        try {
            const { data } = await api.get("/academic/teachers/me/profile");
            setPerfil(data);
            setFechaNac(data.fecha_nac || "");
            setGrado(data.grado_academico || "");
            setCelular(data.celular || "");
            setCorreo(data.email_institucional || "");
            setCondicion(data.condicion_laboral || "");
            setRdNum(data.rd_nombramiento || "");
            setRdFecha(data.rd_fecha || "");
            setFotoPreview(data.photo_url || "");
        } catch (e) {
            toast.error(e?.response?.data?.detail || "No se pudo cargar tu perfil");
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => { load(); }, []);

    const elegirFoto = (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        if (f.size > 5 * 1024 * 1024) {
            toast.error("La foto no debe superar 5 MB");
            return;
        }
        setFotoFile(f);
        setFotoPreview(URL.createObjectURL(f));
    };

    const guardar = async () => {
        setSaving(true);
        try {
            const fd = new FormData();
            fd.append("fecha_nac", fechaNac || "");
            fd.append("grado_academico", grado || "");
            fd.append("celular", celular || "");
            fd.append("email_institucional", correo || "");
            fd.append("condicion_laboral", condicion || "");
            fd.append("rd_nombramiento", rdNum || "");
            fd.append("rd_fecha", rdFecha || "");
            if (fotoFile) fd.append("photo", fotoFile);
            const { data } = await api.put("/academic/teachers/me/profile", fd, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            toast.success(data?.message || "Perfil actualizado");
            setFotoFile(null);
            if (data?.photo_url) setFotoPreview(data.photo_url);
            // Refrescar para que el avatar del encabezado tome la foto nueva
            if (fotoFile) setTimeout(() => window.location.reload(), 800);
        } catch (e) {
            toast.error(e?.response?.data?.detail || "No se pudo guardar el perfil");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" /> Cargando perfil…
            </div>
        );
    }

    return (
        <Card className="border shadow-sm rounded-2xl max-w-3xl">
            <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                    <UserRound className="h-4 w-4 text-blue-600" /> Mi Perfil
                </CardTitle>
                <p className="text-xs text-slate-500">
                    Mantén actualizados tus datos: aparecen en las actas, reportes y en tu credencial.
                </p>
            </CardHeader>
            <CardContent className="space-y-5">
                {/* ── Foto ── */}
                <div className="flex items-center gap-4">
                    <div className="h-24 w-24 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                        {fotoPreview ? (
                            <img src={fotoPreview} alt="Foto de perfil" className="h-full w-full object-cover" />
                        ) : (
                            <UserRound className="h-10 w-10 text-slate-300" />
                        )}
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-700">{perfil?.full_name}</p>
                        <p className="text-xs text-slate-400 mb-2">DNI: {perfil?.document || "—"}</p>
                        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={elegirFoto} />
                        <Button size="sm" variant="outline" className="gap-1.5"
                            onClick={() => fileRef.current?.click()}>
                            <Camera className="h-3.5 w-3.5" /> {fotoPreview ? "Cambiar foto" : "Subir foto"}
                        </Button>
                        <p className="text-[10px] text-slate-400 mt-1">JPG o PNG, máx. 5 MB. Se muestra en el encabezado del sistema.</p>
                    </div>
                </div>

                {/* ── Datos ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <Label className="text-xs">Fecha de nacimiento</Label>
                        <Input type="date" value={fechaNac} onChange={(e) => setFechaNac(e.target.value)} />
                    </div>
                    <div>
                        <Label className="text-xs">Grado académico</Label>
                        <select
                            className="w-full h-10 px-3 text-sm rounded-md border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={grado}
                            onChange={(e) => setGrado(e.target.value)}
                        >
                            <option value="">— Seleccionar —</option>
                            {GRADOS.map((g) => (
                                <option key={g.value} value={g.value}>{g.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <Label className="text-xs">Celular</Label>
                        <Input type="tel" value={celular} placeholder="9__ ___ ___"
                            onChange={(e) => setCelular(e.target.value)} />
                    </div>
                    <div>
                        <Label className="text-xs">Correo institucional</Label>
                        <Input type="email" value={correo} placeholder="nombre@iesppallende.edu.pe"
                            onChange={(e) => setCorreo(e.target.value)} />
                    </div>
                </div>

                {/* ── Vínculo laboral ── */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 inline-flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5" /> Vínculo laboral
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <Label className="text-xs">Condición</Label>
                            <select
                                className="w-full h-10 px-3 text-sm rounded-md border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={condicion}
                                onChange={(e) => setCondicion(e.target.value)}
                            >
                                <option value="">— Seleccionar —</option>
                                <option value="NOMBRADO">Nombrado (a)</option>
                                <option value="CONTRATADO">Contratado (a)</option>
                            </select>
                        </div>
                        <div>
                            <Label className="text-xs">N° de R.D. de Nombramiento / Contrato</Label>
                            <Input value={rdNum} placeholder="Ej: R.D. N° 0123-2026-DREJ"
                                onChange={(e) => setRdNum(e.target.value)} />
                        </div>
                        <div>
                            <Label className="text-xs">Fecha de la R.D.</Label>
                            <Input type="date" value={rdFecha}
                                onChange={(e) => setRdFecha(e.target.value)} />
                        </div>
                    </div>
                    <p className="text-[10px] text-slate-400">
                        Estos datos aparecen en tu horario en PDF y en los reportes de personal.
                    </p>
                </div>

                <div className="flex flex-wrap justify-between gap-2">
                    <Button
                        variant="outline"
                        className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
                        onClick={async () => {
                            try {
                                toast.info("Generando tu horario en PDF…");
                                const res = await api.get("/academic/teachers/me/horario.pdf", { responseType: "blob" });
                                const blob = res?.data instanceof Blob ? res.data : new Blob([res.data]);
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url; a.download = "mi-horario.pdf";
                                document.body.appendChild(a); a.click(); a.remove();
                                setTimeout(() => window.URL.revokeObjectURL(url), 60000);
                            } catch {
                                toast.error("No se pudo generar el horario");
                            }
                        }}
                    >
                        <CalendarDays className="h-4 w-4" /> Descargar mi horario (PDF)
                    </Button>
                    <Button onClick={guardar} disabled={saving} className="gap-2 bg-blue-600 hover:bg-blue-700">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Guardar cambios
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
