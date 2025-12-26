// src/components/ConfigCatalogsModule.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "../utils/safeToast";
import { useAuth } from "../../context/AuthContext";
import {
    Card, CardHeader, CardTitle, CardDescription, CardContent,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../../components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import {
    Settings, Building2, School, CalendarDays, MapPin, Landmark, Users, BookOpen, HardDriveDownload,
    UploadCloud, Download, RefreshCw, CheckCircle, XCircle, Image as ImageIcon, FileSpreadsheet, DatabaseZap,
} from "lucide-react";
import {
    Periods, Campuses, Classrooms, Teachers, Ubigeo, Institution, Imports, Backup,
} from "../../services/catalogs.service";

// ------- helpers -------
function formatApiError(err, fallback = "Ocurrió un error") {
    const data = err?.response?.data;
    if (data?.detail) return typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
    if (typeof data?.message === "string") return data.message;
    if (typeof err?.message === "string") return err.message;
    return fallback;
}
const Section = ({ title, desc, icon, children }) => (
    <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2">
                {icon}{title}
            </CardTitle>
            {desc && <CardDescription>{desc}</CardDescription>}
        </CardHeader>
        <CardContent>{children}</CardContent>
    </Card>
);

// ===================================================================
// Periodos Académicos
// ===================================================================
// ===================================================================
// Periodos Académicos (SCROLL FORZADO CORREGIDO)
// ===================================================================
const PeriodsSection = () => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({
        code: "", year: new Date().getFullYear(), term: "I", start_date: "", end_date: "", is_active: false,
    });

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const data = await Periods.list();
            setRows(data?.items ?? data ?? []);
        } catch (e) { toast.error(formatApiError(e)); } finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const save = async () => {
        try {
            const payload = { ...form, year: parseInt(form.year || "0", 10) };
            if (editing) await Periods.update(editing.id, payload);
            else await Periods.create(payload);
            toast.success(editing ? "Periodo actualizado" : "Periodo creado");
            setOpen(false); setEditing(null);
            setForm({ code: "", year: new Date().getFullYear(), term: "I", start_date: "", end_date: "", is_active: false });
            load();
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const remove = async (id) => {
        if (!window.confirm("¿Eliminar periodo?")) return;
        try { await Periods.remove(id); load(); } catch (e) { toast.error(formatApiError(e)); }
    };

    const toggleActive = async (r) => {
        try { await Periods.setActive(r.id, !r.is_active); load();
        } catch (e) { toast.error(formatApiError(e)); }
    };

    return (
        <Section
            title={<><CalendarDays className="h-5 w-5 text-blue-600" />Periodos académicos</>}
            desc="Defina periodos (año, término, fechas) y marque el activo."
        >
            <div className="flex justify-end mb-3">
                <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
                    <DialogTrigger asChild>
                        <Button className="bg-blue-600 hover:bg-blue-700">Nuevo periodo</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                        <DialogHeader>
                            <DialogTitle>{editing ? "Editar periodo" : "Nuevo periodo"}</DialogTitle>
                            <DialogDescription>El código suele ser algo como 2024-I</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3">
                            <Field label="Código *"><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Año *"><Input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} /></Field>
                                <Field label="Término *">
                                    <Select value={form.term} onValueChange={(v) => setForm({ ...form, term: v })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="I">I</SelectItem>
                                            <SelectItem value="II">II</SelectItem>
                                            <SelectItem value="III">III</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </Field>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Inicio"><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></Field>
                                <Field label="Fin"><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></Field>
                            </div>
                            <div className="flex items-center gap-2">
                                <input id="p-active" type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                                <Label htmlFor="p-active">Activo</Label>
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                                <Button onClick={save}>Guardar</Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <Card className="border shadow-sm">
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" /></div>
                    ) : (
                        /* CAMBIO CLAVE: he bajado a 250px. Si tienes 5 items, el scroll aparecerá seguro. */
                        <div 
                            className="w-full relative border rounded-md"
                            style={{ 
                                display: 'block',
                                maxHeight: '250px', 
                                overflowY: 'auto',
                                scrollbarWidth: 'thin' // Ayuda a visualizar en Firefox
                            }}
                        >
                            <table className="w-full text-sm text-left border-collapse">
                                <thead className="bg-gray-100 text-xs text-gray-700 uppercase" style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: "#f3f4f6" }}>
                                    <tr>
                                        <th className="px-6 py-3 border-b">Código</th>
                                        <th className="px-6 py-3 border-b">Año</th>
                                        <th className="px-6 py-3 border-b">Término</th>
                                        <th className="px-6 py-3 border-b">Fechas</th>
                                        <th className="px-6 py-3 border-b">Estado</th>
                                        <th className="px-6 py-3 border-b">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {rows.map((r) => (
                                        <tr key={r.id} className="bg-white hover:bg-gray-50">
                                            <td className="px-6 py-3 font-medium text-gray-900">{r.code}</td>
                                            <td className="px-6 py-3">{r.year}</td>
                                            <td className="px-6 py-3">{r.term}</td>
                                            <td className="px-6 py-3 text-gray-500">{(r.start_date || "-")} — {(r.end_date || "-")}</td>
                                            <td className="px-6 py-3">
                                                {r.is_active 
                                                    ? <Badge className="bg-green-600">Activo</Badge> 
                                                    : <Badge variant="secondary">Inactivo</Badge>
                                                }
                                            </td>
                                            <td className="px-6 py-3">
                                                <div className="flex gap-2">
                                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { setEditing(r); setForm({ ...r }); setOpen(true); }}>
                                                        <span className="sr-only">Editar</span>
                                                        <Settings className="h-4 w-4" />
                                                    </Button>
                                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-600" onClick={() => remove(r.id)}>
                                                        <span className="sr-only">Eliminar</span>
                                                        <XCircle className="h-4 w-4" />
                                                    </Button>
                                                    <Button size="sm" variant="outline" className="h-8 text-xs px-2" onClick={() => toggleActive(r)}>
                                                        {r.is_active ? "Desactivar" : "Activar"}
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {rows.length === 0 && (
                                        <tr><td colSpan="6" className="text-center py-10 text-gray-500">No hay periodos registrados</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </Section>
    );
};
// ===================================================================
// Sedes & Aulas
// ===================================================================
const CampusesSection = () => {
    const [campuses, setCampuses] = useState([]);
    const [classrooms, setClassrooms] = useState([]);
    const [selCampus, setSelCampus] = useState("");
    const [loading, setLoading] = useState(true);
    const [openCampus, setOpenCampus] = useState(false);
    const [openClass, setOpenClass] = useState(false);
    const [campusForm, setCampusForm] = useState({ code: "", name: "", address: "" });
    const [classForm, setClassForm] = useState({ code: "", name: "", capacity: 30, campus_id: "" });

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const cs = await Campuses.list();
            const arr = cs?.items ?? cs ?? [];
            setCampuses(arr);
            if (!selCampus && arr[0]) setSelCampus(String(arr[0].id));
        } catch (e) { toast.error(formatApiError(e)); } finally { setLoading(false); }
    }, [selCampus]);
    const loadClassrooms = useCallback(async () => {
        try {
            const res = await Classrooms.list(selCampus ? { campus_id: selCampus } : undefined);
            setClassrooms(res?.items ?? res ?? []);
        } catch { }
    }, [selCampus]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { loadClassrooms(); }, [loadClassrooms]);

    const saveCampus = async () => {
        try {
            await Campuses.create(campusForm);
            setOpenCampus(false); setCampusForm({ code: "", name: "", address: "" });
            load();
        } catch (e) { toast.error(formatApiError(e)); }
    };
    const saveClass = async () => {
        try {
            const payload = { ...classForm, campus_id: Number(classForm.campus_id || selCampus) };
            await Classrooms.create(payload);
            setOpenClass(false); setClassForm({ code: "", name: "", capacity: 30, campus_id: "" });
            loadClassrooms();
        } catch (e) { toast.error(formatApiError(e)); }
    };

    return (
        <Section
            title={<><Building2 className="h-5 w-5 text-blue-600" />Sedes & Aulas</>}
            desc="Administre sedes (campus) y sus aulas físicas."
        >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Sedes */}
                <Card className="lg:col-span-1">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Sedes</CardTitle>
                            <CardDescription>Ubicaciones de la institución</CardDescription>
                        </div>
                        <Dialog open={openCampus} onOpenChange={setOpenCampus}>
                            <DialogTrigger asChild><Button size="sm">Nueva sede</Button></DialogTrigger>
                            <DialogContent>
                                <DialogHeader><DialogTitle>Nueva sede</DialogTitle></DialogHeader>
                                <div className="space-y-3">
                                    <Field label="Código *"><Input value={campusForm.code} onChange={(e) => setCampusForm({ ...campusForm, code: e.target.value })} /></Field>
                                    <Field label="Nombre *"><Input value={campusForm.name} onChange={(e) => setCampusForm({ ...campusForm, name: e.target.value })} /></Field>
                                    <Field label="Dirección"><Input value={campusForm.address} onChange={(e) => setCampusForm({ ...campusForm, address: e.target.value })} /></Field>
                                    <div className="flex justify-end"><Button onClick={saveCampus}>Guardar</Button></div>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {loading ? <div className="text-sm text-gray-500">Cargando…</div> : campuses.map((c) => (
                            <Button key={c.id} variant={String(c.id) === selCampus ? "default" : "outline"} className="w-full justify-start"
                                onClick={() => setSelCampus(String(c.id))}>
                                <Landmark className="h-4 w-4 mr-2" />{c.name}
                            </Button>
                        ))}
                        {campuses.length === 0 && <div className="text-sm text-gray-500">Sin sedes</div>}
                    </CardContent>
                </Card>

                {/* Aulas */}
                <Card className="lg:col-span-2">
                    <CardHeader className="flex items-center justify-between">
                        <div>
                            <CardTitle>Aulas</CardTitle>
                            <CardDescription>{selCampus ? `Sede seleccionada: ${campuses.find((x) => String(x.id) === selCampus)?.name}` : "Seleccione una sede"}</CardDescription>
                        </div>
                        <Dialog open={openClass} onOpenChange={setOpenClass}>
                            <DialogTrigger asChild><Button size="sm" disabled={!selCampus}>Nueva aula</Button></DialogTrigger>
                            <DialogContent>
                                <DialogHeader><DialogTitle>Nueva aula</DialogTitle></DialogHeader>
                                <div className="space-y-3">
                                    <Field label="Código *"><Input value={classForm.code} onChange={(e) => setClassForm({ ...classForm, code: e.target.value })} /></Field>
                                    <Field label="Nombre *"><Input value={classForm.name} onChange={(e) => setClassForm({ ...classForm, name: e.target.value })} /></Field>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Field label="Capacidad"><Input type="number" value={classForm.capacity} onChange={(e) => setClassForm({ ...classForm, capacity: parseInt(e.target.value || "0", 10) })} /></Field>
                                        <Field label="Sede"><Select value={classForm.campus_id || selCampus} onValueChange={(v) => setClassForm({ ...classForm, campus_id: v })}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>{campuses.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                                        </Select></Field>
                                    </div>
                                    <div className="flex justify-end"><Button onClick={saveClass}>Guardar</Button></div>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Capacidad</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {classrooms.map((a) => (
                                    <tr key={a.id}>
                                        <td className="px-6 py-3">{a.code}</td>
                                        <td className="px-6 py-3">{a.name}</td>
                                        <td className="px-6 py-3">{a.capacity}</td>
                                    </tr>
                                ))}
                                {classrooms.length === 0 && <tr><td colSpan="3" className="text-center py-10 text-gray-500">Sin aulas</td></tr>}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
            </div>
        </Section>
    );
};

// ===================================================================
// Docentes
// ===================================================================
const TeachersSection = () => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({ document: "", full_name: "", email: "", phone: "", specialization: "" });

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const data = await Teachers.list();
            setRows(data?.items ?? data ?? []);
        } catch (e) { toast.error(formatApiError(e)); } finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const save = async () => {
        try { await Teachers.create(form); setOpen(false); setForm({ document: "", full_name: "", email: "", phone: "", specialization: "" }); load(); }
        catch (e) { toast.error(formatApiError(e)); }
    };
    const remove = async (id) => {
        if (!window.confirm("¿Eliminar docente?")) return;
        try { await Teachers.remove(id); load(); } catch (e) { toast.error(formatApiError(e)); }
    };

    return (
        <Section
            title={<><Users className="h-5 w-5 text-blue-600" />Docentes</>}
            desc="Directorio de docentes y datos de contacto."
        >
            <div className="flex justify-end mb-3">
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild><Button>Nuevo docente</Button></DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Nuevo docente</DialogTitle></DialogHeader>
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Documento *"><Input value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} /></Field>
                                <Field label="Nombre completo *"><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
                                <Field label="Teléfono"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
                            </div>
                            <Field label="Especialidad"><Input value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} /></Field>
                            <div className="flex justify-end"><Button onClick={save}>Guardar</Button></div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Documento</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Teléfono</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Especialidad</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {rows.map((r) => (
                            <tr key={r.id}>
                                <td className="px-6 py-3">{r.document}</td>
                                <td className="px-6 py-3">{r.full_name}</td>
                                <td className="px-6 py-3">{r.email || "-"}</td>
                                <td className="px-6 py-3">{r.phone || "-"}</td>
                                <td className="px-6 py-3">{r.specialization || "-"}</td>
                                <td className="px-6 py-3">
                                    <Button size="sm" variant="outline" onClick={() => remove(r.id)}>Eliminar</Button>
                                </td>
                            </tr>
                        ))}
                        {rows.length === 0 && <tr><td colSpan="6" className="text-center py-10 text-gray-500">Sin docentes</td></tr>}
                    </tbody>
                </table>
            </div>
        </Section>
    );
};

// ===================================================================
// Ubigeo + Parámetros de institución (logo/firma)
// ===================================================================
const InstitutionSection = () => {
    const [settings, setSettings] = useState(null);
    const [dept, setDept] = useState(""); const [prov, setProv] = useState(""); const [dist, setDist] = useState("");
    const [deps, setDeps] = useState([]); const [provs, setProvs] = useState([]); const [dists, setDists] = useState([]);

    const load = useCallback(async () => {
        try {
            const s = await Institution.getSettings();
            setSettings(s ?? {});
            const d = await Ubigeo.deps(); setDeps(d?.items ?? d ?? []);
            if (s?.department) { setDept(s.department); const pv = await Ubigeo.provs(s.department); setProvs(pv?.items ?? pv ?? []); }
            if (s?.department && s?.province) { setProv(s.province); const ds = await Ubigeo.dists(s.department, s.province); setDists(ds?.items ?? ds ?? []); }
            if (s?.district) setDist(s.district);
        } catch (e) { toast.error(formatApiError(e)); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const update = async () => {
        try {
            await Institution.updateSettings({ ...settings, department: dept, province: prov, district: dist });
            toast.success("Parámetros guardados");
            load();
        } catch (e) { toast.error(formatApiError(e)); }
    };
    const onUpload = async (kind, file) => {
        try {
            const r = await Institution.uploadMedia(kind, file);
            toast.success("Archivo subido");
            setSettings((s) => ({ ...s, ...(kind === "LOGO" ? { logo_url: r.url } : kind === "SIGNATURE" ? { signature_url: r.url } : { logo_alt_url: r.url }) }));
        } catch (e) { toast.error(formatApiError(e)); }
    };

    return (
        <Section
            title={<><Settings className="h-5 w-5 text-blue-600" />Parámetros de institución</>}
            desc="Datos generales, ubicación y medios (logo/firma)."
        >
            {!settings ? (
                <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" /></div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="lg:col-span-2">
                        <CardHeader><CardTitle>Datos generales</CardTitle></CardHeader>
                        <CardContent className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Nombre *"><Input value={settings.name || ""} onChange={(e) => setSettings({ ...settings, name: e.target.value })} /></Field>
                                <Field label="RUC"><Input value={settings.ruc || ""} onChange={(e) => setSettings({ ...settings, ruc: e.target.value })} /></Field>
                            </div>
                            <Field label="Dirección"><Input value={settings.address || ""} onChange={(e) => setSettings({ ...settings, address: e.target.value })} /></Field>
                            <div className="grid grid-cols-3 gap-3">
                                <Field label="Departamento">
                                    <Select value={dept} onValueChange={async (v) => { setDept(v); setProv(""); setDist(""); const pv = await Ubigeo.provs(v); setProvs(pv?.items ?? pv ?? []); setDists([]); }}>
                                        <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                                        <SelectContent>{deps.map((d) => <SelectItem key={d.code || d.id || d} value={d.name || d}>{d.name || d}</SelectItem>)}</SelectContent>
                                    </Select>
                                </Field>
                                <Field label="Provincia">
                                    <Select value={prov} onValueChange={async (v) => { setProv(v); setDist(""); const ds = await Ubigeo.dists(dept, v); setDists(ds?.items ?? ds ?? []); }}>
                                        <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                                        <SelectContent>{provs.map((p) => <SelectItem key={p.code || p.id || p} value={p.name || p}>{p.name || p}</SelectItem>)}</SelectContent>
                                    </Select>
                                </Field>
                                <Field label="Distrito">
                                    <Select value={dist} onValueChange={setDist}>
                                        <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                                        <SelectContent>{dists.map((d) => <SelectItem key={d.code || d.id || d} value={d.name || d}>{d.name || d}</SelectItem>)}</SelectContent>
                                    </Select>
                                </Field>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <Field label="Web"><Input value={settings.website || ""} onChange={(e) => setSettings({ ...settings, website: e.target.value })} /></Field>
                                <Field label="Email"><Input value={settings.email || ""} onChange={(e) => setSettings({ ...settings, email: e.target.value })} /></Field>
                                <Field label="Teléfono"><Input value={settings.phone || ""} onChange={(e) => setSettings({ ...settings, phone: e.target.value })} /></Field>
                            </div>
                            <div className="flex justify-end"><Button onClick={update}>Guardar</Button></div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>Medios</CardTitle><CardDescription>Suba logos y firma digital (PNG/SVG).</CardDescription></CardHeader>
                        <CardContent className="space-y-4">
                            <MediaUpload label="Logo principal" url={settings.logo_url} onChange={(f) => onUpload("LOGO", f)} />
                            <MediaUpload label="Logo alterno" url={settings.logo_alt_url} onChange={(f) => onUpload("LOGO_ALT", f)} />
                            <MediaUpload label="Firma (autoridad)" url={settings.signature_url} onChange={(f) => onUpload("SIGNATURE", f)} />
                        </CardContent>
                    </Card>
                </div>
            )}
        </Section>
    );
};

const MediaUpload = ({ label, url, onChange }) => (
    <div className="space-y-1">
        <Label>{label}</Label>
        <div className="flex items-center gap-3">
            {url ? <img src={url} alt={label} className="w-16 h-16 object-contain border rounded" /> : <div className="w-16 h-16 border rounded flex items-center justify-center text-gray-400"><ImageIcon className="h-6 w-6" /></div>}
            <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && onChange(e.target.files[0])} />
        </div>
    </div>
);

// ===================================================================
// Importadores Excel/CSV (alumnos, cursos, notas históricas)
// ===================================================================
const ImportersTab = () => {
    const [type, setType] = useState("students"); // students|courses|grades
    const [file, setFile] = useState(null);
    const [mapping, setMapping] = useState({}); // campoSistema -> columnaArchivo
    const [job, setJob] = useState(null);
    const [status, setStatus] = useState(null);
    const [poll, setPoll] = useState(null);

    const required = useMemo(() => {
        if (type === "students") return ["document", "first_name", "last_name", "email", "phone"];
        if (type === "courses") return ["code", "name", "credits", "hours"];
        return ["student_document", "course_code", "term", "final_grade"];
    }, [type]);

    useEffect(() => () => { if (poll) clearInterval(poll); }, [poll]);

    const start = async () => {
        if (!file) { toast.error("Adjunta un archivo"); return; }
        try {
            const res = await Imports.start(type, file, mapping);
            setJob(res?.job_id || res?.id);
            toast.success("Importación encolada");
            const timer = setInterval(async () => {
                try {
                    const st = await Imports.status(res.job_id || res.id);
                    setStatus(st);
                    if (st?.state === "COMPLETED" || st?.state === "FAILED") { clearInterval(timer); setPoll(null); }
                } catch { }
            }, 1500);
            setPoll(timer);
        } catch (e) { toast.error(formatApiError(e)); }
    };

    return (
        <div className="space-y-6">
            <Section
                title={<><FileSpreadsheet className="h-5 w-5 text-blue-600" />Importadores Excel/CSV</>}
                desc="Carga masiva de alumnos, cursos y notas históricas. Descarga la plantilla, completa y sube el archivo."
            >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Field label="Tipo de importación">
                        <Select value={type} onValueChange={setType}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="students">Alumnos</SelectItem>
                                <SelectItem value="courses">Cursos</SelectItem>
                                <SelectItem value="grades">Notas históricas</SelectItem>
                            </SelectContent>
                        </Select>
                    </Field>

                    <Field label="Plantilla (descargar)">
                        <a href={Imports.template(type)} className="inline-flex items-center gap-2 text-blue-600 hover:underline">
                            <Download className="h-4 w-4" /> Descargar plantilla
                        </a>
                    </Field>

                    <Field label="Archivo Excel/CSV">
                        <Input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                        {file && <div className="text-xs text-gray-500 mt-1">{file.name} · {(file.size / 1024).toFixed(1)} KB</div>}
                    </Field>
                </div>

                <div className="mt-4">
                    <Label className="mb-2 block">Mapeo de columnas (opcional)</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {required.map((f) => (
                            <div key={f} className="space-y-1">
                                <Label className="text-xs">{f}</Label>
                                <Input placeholder={`Columna para "${f}"`} value={mapping[f] || ""} onChange={(e) => setMapping({ ...mapping, [f]: e.target.value })} />
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Si no defines el mapeo, el backend asumirá encabezados iguales a los campos requeridos.</p>
                </div>

                <div className="flex justify-end gap-2 mt-4">
                    <Button variant="outline" onClick={() => { setFile(null); setMapping({}); setStatus(null); setJob(null); }}>Limpiar</Button>
                    <Button onClick={start}><UploadCloud className="h-4 w-4 mr-2" />Iniciar importación</Button>
                </div>

                {/* Estado */}
                {(job || status) && (
                    <Card className="mt-6">
                        <CardHeader><CardTitle className="text-base">Estado del proceso</CardTitle></CardHeader>
                        <CardContent className="text-sm">
                            <div className="flex items-center gap-2">
                                {status?.state === "COMPLETED" ? <CheckCircle className="h-5 w-5 text-green-600" /> :
                                    status?.state === "FAILED" ? <XCircle className="h-5 w-5 text-red-600" /> :
                                        <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />}
                                <div>
                                    <div><strong>Job:</strong> {job || "-"}</div>
                                    <div><strong>Estado:</strong> {status?.state || "EN COLA"}</div>
                                    {status?.progress != null && <div><strong>Progreso:</strong> {Math.round(status.progress)}%</div>}
                                    {Array.isArray(status?.errors) && status.errors.length > 0 && (
                                        <div className="mt-2">
                                            <strong>Errores:</strong>
                                            <ul className="list-disc ml-5">{status.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </Section>
        </div>
    );
};

// ===================================================================
// Respaldo / Exportación
// ===================================================================
const BackupTab = () => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [scope, setScope] = useState("FULL");

    const load = useCallback(async () => {
        try { setLoading(true); const data = await Backup.list(); setRows(data?.items ?? data ?? []); }
        catch (e) { toast.error(formatApiError(e)); } finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const create = async () => {
        try { await Backup.create(scope); toast.success("Respaldo programado"); load(); }
        catch (e) { toast.error(formatApiError(e)); }
    };

    const exportDataset = async (ds) => {
        try { await Backup.exportDataset(ds); toast.success("Exportación generada (ver descargas del backend)"); }
        catch (e) { toast.error(formatApiError(e)); }
    };

    return (
        <div className="space-y-6">
            <Section
                title={<><HardDriveDownload className="h-5 w-5 text-blue-600" />Respaldo & Exportación</>}
                desc="Genere respaldos completos o exporte datasets específicos."
            >
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Nuevo respaldo</CardTitle>
                            <CardDescription>Archivo comprimido con base de datos y adjuntos (según configuración).</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Field label="Ámbito">
                                <Select value={scope} onValueChange={setScope}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="FULL">Completo</SelectItem>
                                        <SelectItem value="DATA_ONLY">Solo datos</SelectItem>
                                        <SelectItem value="FILES_ONLY">Solo archivos</SelectItem>
                                    </SelectContent>
                                </Select>
                            </Field>
                            <Button onClick={create}><DatabaseZap className="h-4 w-4 mr-2" />Crear respaldo</Button>
                        </CardContent>
                    </Card>

                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle className="text-base">Historial de respaldos</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" /></div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-gray-50 border-b">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ámbito</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tamaño</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {rows.map((b) => (
                                                <tr key={b.id}>
                                                    <td className="px-6 py-3">{b.created_at ? new Date(b.created_at).toLocaleString() : "-"}</td>
                                                    <td className="px-6 py-3">{b.scope || "-"}</td>
                                                    <td className="px-6 py-3">{b.size ? `${(b.size / (1024 * 1024)).toFixed(2)} MB` : "-"}</td>
                                                    <td className="px-6 py-3">
                                                        <a className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                                                            href={Backup.downloadUrl(b.id)}>
                                                            <Download className="h-4 w-4" /> Descargar
                                                        </a>
                                                    </td>
                                                </tr>
                                            ))}
                                            {rows.length === 0 && <tr><td colSpan="4" className="text-center py-10 text-gray-500">Sin respaldos</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <Card className="mt-6">
                    <CardHeader>
                        <CardTitle className="text-base">Exportar datasets</CardTitle>
                        <CardDescription>Archivos CSV/ZIP de conjuntos puntuales.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => exportDataset("STUDENTS")}><Download className="h-4 w-4 mr-2" />Alumnos</Button>
                        <Button variant="outline" onClick={() => exportDataset("COURSES")}><Download className="h-4 w-4 mr-2" />Cursos</Button>
                        <Button variant="outline" onClick={() => exportDataset("GRADES")}><Download className="h-4 w-4 mr-2" />Notas</Button>
                        <Button variant="outline" onClick={() => exportDataset("CATALOGS")}><Download className="h-4 w-4 mr-2" />Catálogos</Button>
                    </CardContent>
                </Card>
            </Section>
        </div>
    );
};

// ===================================================================
// MAIN
// ===================================================================
const ConfigCatalogsModule = () => {
    const { user } = useAuth();
    if (!user || !["ADMIN", "REGISTRAR"].includes(user.role)) {
        return (
            <div className="p-6 text-center">
                <Settings className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Acceso restringido</h2>
                <p className="text-gray-600">Solo administradores y registradores.</p>
            </div>
        );
    }

    return (
        <div className="p-6">
            <Tabs defaultValue="catalogs" className="space-y-6">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="catalogs">Catálogos</TabsTrigger>
                    <TabsTrigger value="importers">Importadores</TabsTrigger>
                    <TabsTrigger value="backup">Respaldo</TabsTrigger>
                </TabsList>

                <TabsContent value="catalogs">
                    <div className="space-y-6">
                        <PeriodsSection />
                        <CampusesSection />
                        <TeachersSection />
                        <InstitutionSection />
                    </div>
                </TabsContent>

                <TabsContent value="importers">
                    <ImportersTab />
                </TabsContent>

                <TabsContent value="backup">
                    <BackupTab />
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default ConfigCatalogsModule;

// --- helper ui ---
const Field = ({ label, children }) => (
    <div>
        <Label className="mb-1 block">{label}</Label>
        {children}
    </div>
);
