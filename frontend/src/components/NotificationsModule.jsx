// src/components/NotificationsModule.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { toast } from "sonner";
import {
    Card, CardHeader, CardTitle, CardDescription, CardContent,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from "../../components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import {
    Bell, Mail, MessageSquare, Eye, Edit3, Trash2, RefreshCw, Send, ClipboardList, Filter, Plus,
    CheckCircle, XCircle, FileText, Settings,
} from "lucide-react";
import {
    Templates, Sender, Logs, Events, CHANNELS, EVENT_DEFS, PRESETS, naiveCompile,
} from "../../services/notifications.service";
import { useAuth } from "../../context/AuthContext";

// ---------- helpers ----------
function formatApiError(err, fallback = "Ocurrió un error") {
    const data = err?.response?.data;
    if (data?.detail) return typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
    if (typeof data?.message === "string") return data.message;
    if (typeof err?.message === "string") return err.message;
    return fallback;
}

const channelIcon = (ch) => ch === "EMAIL" ? <Mail className="h-4 w-4" /> :
    ch === "SMS" ? <MessageSquare className="h-4 w-4" /> : <Bell className="h-4 w-4" />;

// =======================================
// Templates Tab (CRUD + preview + test)
// =======================================
const TemplatesTab = () => {
    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState("");
    const [eventFilter, setEventFilter] = useState("ALL");
    const [chFilter, setChFilter] = useState("ALL");

    const [openEditor, setOpenEditor] = useState(false);
    const [editing, setEditing] = useState(null);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const data = await Templates.list();
            setList(data?.items ?? data ?? []);
        } catch (e) {
            toast.error(formatApiError(e, "Error al cargar plantillas"));
        } finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const filtered = list.filter((t) => {
        const okEvent = eventFilter === "ALL" || t.event_key === eventFilter;
        const okCh = chFilter === "ALL" || t.channel === chFilter;
        const text = `${t.name} ${t.event_key} ${t.subject || ""}`.toLowerCase();
        return okEvent && okCh && (!q || text.includes(q.toLowerCase()));
    });

    const remove = async (tmpl) => {
        if (!window.confirm("¿Eliminar plantilla?")) return;
        try { await Templates.remove(tmpl.id); toast.success("Eliminada"); load(); }
        catch (e) { toast.error(formatApiError(e)); }
    };

    const toggleActive = async (tmpl) => {
        try { await Templates.setActive(tmpl.id, !tmpl.is_active); load(); }
        catch (e) { toast.error(formatApiError(e)); }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-3 items-center">
                <div className="relative">
                    <Filter className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
                </div>
                <Select value={eventFilter} onValueChange={setEventFilter}>
                    <SelectTrigger className="w-64"><SelectValue placeholder="Evento" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">Todos los eventos</SelectItem>
                        {EVENT_DEFS.map((e) => <SelectItem key={e.key} value={e.key}>{e.label}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={chFilter} onValueChange={setChFilter}>
                    <SelectTrigger className="w-40"><SelectValue placeholder="Canal" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">Todos los canales</SelectItem>
                        {CHANNELS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                </Select>

                <Dialog open={openEditor} onOpenChange={(v) => { setOpenEditor(v); if (!v) setEditing(null); }}>
                    <DialogTrigger asChild>
                        <Button className="ml-auto"><Plus className="h-4 w-4 mr-2" />Nueva plantilla</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-5xl">
                        <TemplateEditor
                            initial={editing}
                            onClose={() => { setOpenEditor(false); setEditing(null); }}
                            onSaved={load}
                        />
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex justify-center py-10">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Evento</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Canal</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {filtered.map((t) => (
                                        <tr key={t.id}>
                                            <td className="px-6 py-3">
                                                <div className="font-medium">{t.name}</div>
                                                <div className="text-xs text-gray-500">{t.subject || t.sms_text?.slice(0, 60) || "-"}</div>
                                            </td>
                                            <td className="px-6 py-3 text-sm">{EVENT_DEFS.find((e) => e.key === t.event_key)?.label || t.event_key}</td>
                                            <td className="px-6 py-3">{channelIcon(t.channel)} <span className="ml-1 text-sm">{t.channel}</span></td>
                                            <td className="px-6 py-3">{t.is_active ? <Badge>Activa</Badge> : <Badge variant="secondary">Inactiva</Badge>}</td>
                                            <td className="px-6 py-3">
                                                <div className="flex gap-2">
                                                    <Button size="sm" variant="outline" onClick={() => { setEditing(t); setOpenEditor(true); }}><Edit3 className="h-4 w-4" /></Button>
                                                    <Button size="sm" variant="outline" onClick={() => toggleActive(t)}>{t.is_active ? "Desactivar" : "Activar"}</Button>
                                                    <Button size="sm" variant="outline" onClick={() => remove(t)}><Trash2 className="h-4 w-4" /></Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {filtered.length === 0 && (
                                        <tr><td colSpan="5" className="text-center py-10 text-gray-500">Sin plantillas.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

const TemplateEditor = ({ initial, onClose, onSaved }) => {
    const isEdit = !!initial?.id;
    const [form, setForm] = useState(() => initial || {
        name: "",
        event_key: "",
        channel: "EMAIL",
        subject: "",
        html: "",
        sms_text: "",
        is_active: true,
    });
    const [sample, setSample] = useState("{}");
    const [preview, setPreview] = useState("");

    useEffect(() => {
        if (!isEdit && form.event_key && PRESETS[form.event_key]) {
            const preset = PRESETS[form.event_key];
            setForm((f) => ({
                ...f,
                subject: preset.email_subject || f.subject,
                html: preset.email_html || f.html,
                sms_text: preset.sms_text || f.sms_text,
            }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form.event_key]);

    const vars = useMemo(() => EVENT_DEFS.find((e) => e.key === form.event_key)?.variables || [], [form.event_key]);

    const makePreview = () => {
        try {
            const payload = JSON.parse(sample || "{}");
            const compiled = form.channel === "EMAIL"
                ? naiveCompile(form.html || "", payload)
                : naiveCompile(form.sms_text || "", payload);
            setPreview(compiled);
        } catch {
            toast.error("JSON de datos de ejemplo inválido");
        }
    };

    const save = async () => {
        if (!form.name || !form.event_key || !form.channel) {
            toast.error("Completa nombre, evento y canal");
            return;
        }
        try {
            if (isEdit) await Templates.update(initial.id, form);
            else await Templates.create(form);
            toast.success(isEdit ? "Plantilla actualizada" : "Plantilla creada");
            onSaved?.();
            onClose?.();
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const sendTest = async () => {
        try {
            const data = JSON.parse(sample || "{}");
            await Sender.sendTest({
                template: form,
                data,
                recipient: {
                    email: data?.__test_email || "test@example.com",
                    phone: data?.__test_phone || "",
                },
            });
            toast.success("Envío de prueba iniciado");
        } catch (e) {
            toast.error(formatApiError(e, "No se pudo enviar la prueba (revisa el JSON de ejemplo)"));
        }
    };

    return (
        <>
            <DialogHeader>
                <DialogTitle>{isEdit ? "Editar plantilla" : "Nueva plantilla"}</DialogTitle>
                <DialogDescription>Usa placeholders con <code className="px-1 py-0.5 rounded bg-gray-100">{`{{variable}}`}</code></DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Field label="Nombre *">
                            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                        </Field>
                        <Field label="Canal *">
                            <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {CHANNELS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </Field>
                        <Field label="Evento *">
                            <Select value={form.event_key} onValueChange={(v) => setForm({ ...form, event_key: v })}>
                                <SelectTrigger><SelectValue placeholder="Seleccionar evento" /></SelectTrigger>
                                <SelectContent>
                                    {EVENT_DEFS.map((e) => <SelectItem key={e.key} value={e.key}>{e.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </Field>
                        <div className="flex items-center gap-2 mt-6">
                            <input id="active" type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                            <Label htmlFor="active">Activa</Label>
                        </div>
                    </div>

                    {form.channel === "EMAIL" && (
                        <>
                            <Field label="Asunto (Email)">
                                <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
                            </Field>
                            <Field label="Cuerpo HTML">
                                <Textarea rows={12} value={form.html} onChange={(e) => setForm({ ...form, html: e.target.value })} />
                            </Field>
                        </>
                    )}

                    {form.channel === "SMS" && (
                        <Field label="Texto SMS (<=160 chars recomendado)">
                            <Textarea rows={6} value={form.sms_text} onChange={(e) => setForm({ ...form, sms_text: e.target.value })} />
                        </Field>
                    )}

                    {form.channel === "IN_APP" && (
                        <>
                            <Field label="Título">
                                <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
                            </Field>
                            <Field label="Mensaje (permite HTML básico)">
                                <Textarea rows={8} value={form.html} onChange={(e) => setForm({ ...form, html: e.target.value })} />
                            </Field>
                        </>
                    )}

                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={onClose}>Cancelar</Button>
                        <Button onClick={save}><FileText className="h-4 w-4 mr-2" />Guardar</Button>
                    </div>
                </div>

                {/* Panel derecho: variables + preview */}
                <div className="space-y-3">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm">Variables disponibles</CardTitle>
                            <CardDescription className="text-xs">Click para insertar</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-wrap gap-2">
                            {vars.length ? vars.map((v) => (
                                <Button key={v} size="sm" variant="outline"
                                    onClick={() => {
                                        if (form.channel === "SMS") setForm({ ...form, sms_text: (form.sms_text || "") + ` {{${v}}}` });
                                        else setForm({ ...form, html: (form.html || "") + ` {{${v}}}` });
                                    }}>
                                    {`{{${v}}}`}
                                </Button>
                            )) : <span className="text-xs text-gray-500">Selecciona un evento</span>}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm">Datos de ejemplo (JSON)</CardTitle>
                            <CardDescription className="text-xs">Incluye __test_email y/o __test_phone para envíos de prueba</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <Textarea rows={10} value={sample} onChange={(e) => setSample(e.target.value)}
                                placeholder={`{\n  "first_name": "Ana",\n  "__test_email": "ana@example.com"\n}`} />
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={makePreview}><Eye className="h-4 w-4 mr-2" />Previsualizar</Button>
                                <Button onClick={sendTest}><Send className="h-4 w-4 mr-2" />Enviar prueba</Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm">Vista previa</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {form.channel === "SMS" ? (
                                <pre className="text-sm whitespace-pre-wrap">{preview || "—"}</pre>
                            ) : (
                                <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: preview || "<p>—</p>" }} />
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
};

// =======================================
// Events Binding Tab
// =======================================
const BindingsTab = () => {
    const [rows, setRows] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        const [ev, tm] = await Promise.all([Events.list().catch(() => ({ items: EVENT_DEFS })), Templates.list().catch(() => ([]))]);
        setRows(ev?.items ?? ev ?? EVENT_DEFS);
        setTemplates(tm?.items ?? tm ?? []);
    }, []);
    useEffect(() => { load(); }, [load]);

    const byChannel = useMemo(() => {
        const m = {};
        for (const t of templates) {
            m[t.event_key] = m[t.event_key] || {};
            m[t.event_key][t.channel] = m[t.event_key][t.channel] || [];
            m[t.event_key][t.channel].push(t);
        }
        return m;
    }, [templates]);

    const setBinding = async (event_key, channel, template_id) => {
        setSaving(true);
        try {
            await Events.setBinding(event_key, channel, template_id || null);
            toast.success("Vinculación actualizada");
        } catch (e) {
            toast.error(formatApiError(e, "No se pudo actualizar la vinculación"));
        } finally { setSaving(false); }
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Vincular plantillas por evento</CardTitle>
                    <CardDescription>Define la plantilla por defecto que se usará al dispararse cada evento y canal.</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Evento</th>
                                {CHANNELS.map((c) => (
                                    <th key={c.value} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{c.label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {(rows || EVENT_DEFS).map((ev) => (
                                <tr key={ev.key}>
                                    <td className="px-6 py-3">
                                        <div className="font-medium">{ev.label}</div>
                                        <div className="text-xs text-gray-500">Vars: {ev.variables?.join(", ")}</div>
                                    </td>
                                    {CHANNELS.map((c) => {
                                        const opts = byChannel[ev.key]?.[c.value] || [];
                                        return (
                                            <td key={c.value} className="px-6 py-3">
                                                <Select onValueChange={(v) => setBinding(ev.key, c.value, v)} defaultValue="">
                                                    <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="">—</SelectItem>
                                                        {opts.map((t) => (
                                                            <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {saving && <div className="flex items-center gap-2 text-sm text-gray-500 mt-3"><RefreshCw className="h-4 w-4 animate-spin" /> Guardando…</div>}
                </CardContent>
            </Card>
        </div>
    );
};

// =======================================
// Logs Tab (bitácora + reintentos)
// =======================================
const LogsTab = () => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState("ALL");
    const [channel, setChannel] = useState("ALL");

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const data = await Logs.list();
            setRows(data?.items ?? data ?? []);
        } catch (e) {
            toast.error(formatApiError(e, "Error al cargar bitácora"));
        } finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const filtered = rows.filter((r) => {
        const okS = status === "ALL" || r.status === status;
        const okC = channel === "ALL" || r.channel === channel;
        return okS && okC;
    });

    const retry = async (r) => {
        try { await Logs.retry(r.id); toast.success("Reintento programado"); load(); }
        catch (e) { toast.error(formatApiError(e)); }
    };

    const statusUi = (s) => {
        switch (s) {
            case "SENT": return <Badge className="bg-green-600">Enviado</Badge>;
            case "FAILED": return <Badge variant="destructive">Fallido</Badge>;
            case "QUEUED":
            default: return <Badge variant="secondary">En cola</Badge>;
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-3 items-center">
                <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="w-40"><SelectValue placeholder="Estado" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">Todos</SelectItem>
                        <SelectItem value="QUEUED">En cola</SelectItem>
                        <SelectItem value="SENT">Enviado</SelectItem>
                        <SelectItem value="FAILED">Fallido</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={channel} onValueChange={setChannel}>
                    <SelectTrigger className="w-40"><SelectValue placeholder="Canal" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">Todos</SelectItem>
                        {CHANNELS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4 mr-2" />Actualizar</Button>
            </div>

            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex justify-center py-10">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Evento</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Canal</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Destinatario</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {filtered.map((r) => (
                                        <tr key={r.id}>
                                            <td className="px-6 py-3 text-sm">{r.created_at ? new Date(r.created_at).toLocaleString() : "-"}</td>
                                            <td className="px-6 py-3 text-sm">{EVENT_DEFS.find((e) => e.key === r.event_key)?.label || r.event_key}</td>
                                            <td className="px-6 py-3 text-sm">{r.channel}</td>
                                            <td className="px-6 py-3 text-sm">{r.recipient_email || r.recipient_phone || "-"}</td>
                                            <td className="px-6 py-3">{statusUi(r.status)}</td>
                                            <td className="px-6 py-3">
                                                {r.status === "FAILED" && (
                                                    <Button size="sm" variant="outline" onClick={() => retry(r)}>
                                                        <RefreshCw className="h-4 w-4 mr-1" />Reintentar
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {filtered.length === 0 && (
                                        <tr><td colSpan="6" className="text-center py-10 text-gray-500">Sin registros.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

// =======================================
// Main Module
// =======================================
const NotificationsModule = () => {
    const { user } = useAuth();

    if (!user || !["ADMIN", "REGISTRAR", "COMMS"].includes(user.role)) {
        return (
            <div className="p-6 text-center">
                <Bell className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Acceso Restringido</h2>
                <p className="text-gray-600">Solo usuarios autorizados pueden administrar notificaciones.</p>
            </div>
        );
    }

    return (
        <div className="p-6">
            <Tabs defaultValue="templates" className="space-y-6">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="templates">Plantillas</TabsTrigger>
                    <TabsTrigger value="bindings">Vinculaciones</TabsTrigger>
                    <TabsTrigger value="logs">Bitácora</TabsTrigger>
                </TabsList>

                <TabsContent value="templates"><TemplatesTab /></TabsContent>
                <TabsContent value="bindings"><BindingsTab /></TabsContent>
                <TabsContent value="logs"><LogsTab /></TabsContent>
            </Tabs>
        </div>
    );
};

export default NotificationsModule;

// ---------- pequeños helpers UI ----------
const Field = ({ label, children }) => (
    <div>
        <Label className="mb-1 block">{label}</Label>
        {children}
    </div>
);
