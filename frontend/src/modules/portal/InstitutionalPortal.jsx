// src/pages/InstitutionalPortal.jsx
import React, { useState, useEffect, useContext, useCallback } from "react";
import { AuthContext } from "../../context/AuthContext";
import { toast } from "sonner";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "../../components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "../../components/ui/dialog";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "../../components/ui/select";
import {
  School, BookOpen, Users, Award, Calendar, MapPin, Phone, Mail, FileText,
  Download, ExternalLink, ChevronRight, Play, Clock, Building, Eye, Edit3, Trash2, Upload as UploadIcon, Inbox as InboxIcon, CheckCircle, XCircle, Search,
} from "lucide-react";
import { Pages, News, Documents, PublicForms, Inbox as InboxSvc } from "../../services/portal.service";

// Helpers
const fmtApiErr = (e, fb = "Ocurrió un error") => e?.response?.data?.detail || e?.message || fb;

/* ===================== Hero ===================== */
const HeroSection = ({ onOpenPre }) => (
  <section id="inicio" className="bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 text-white">
    <div className="container mx-auto px-4 py-24">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div className="space-y-8">
          <div className="space-y-4">
            <Badge className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2">
              Excelencia Educativa desde 1985
            </Badge>
            <h1 className="text-5xl lg:text-6xl font-bold leading-tight">
              Instituto de Educación Superior Pedagógico Público
              <span className="text-blue-300 block mt-2">"Gustavo Allende Llavería"</span>
            </h1>
            <p className="text-xl text-blue-100 leading-relaxed">
              Formamos profesionales de la educación con excelencia académica, valores éticos y compromiso social.
            </p>
          </div>

          <div className="flex flex-wrap gap-4">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4" onClick={onOpenPre}>
              <Users className="h-5 w-5 mr-2" /> Postular Ahora
            </Button>
            <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-blue-900 px-8 py-4">
              <Play className="h-5 w-5 mr-2" /> Ver Video Institucional
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-6 pt-8">
            <Stat num="39" label="Años de Experiencia" />
            <Stat num="2,500+" label="Egresados" />
            <Stat num="98%" label="Inserción Laboral" />
          </div>
        </div>

        <div className="hidden lg:block">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-t from-blue-900/50 to-transparent rounded-2xl"></div>
            <img src="/api/placeholder/600/500" alt="Campus" className="rounded-2xl shadow-2xl w-full h-[500px] object-cover" />
            <div className="absolute bottom-6 left-6 right-6 text-white">
              <h3 className="text-2xl font-bold mb-2">Campus Moderno</h3>
              <p className="text-blue-100">Instalaciones equipadas con tecnología de vanguardia</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);
const Stat = ({ num, label }) => (
  <div className="text-center">
    <div className="text-3xl font-bold">{num}</div>
    <div className="text-blue-200 text-sm">{label}</div>
  </div>
);

/* ===================== Programs ===================== */
const ProgramsSection = () => {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL || "http://localhost:8001"}/api/careers`);
      const json = await res.json();
      setPrograms(json?.careers || []);
    } catch {
      setPrograms([]);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const defaults = [
    { id: "1", name: "Educación Inicial", description: "Formación integral para educadores de niños de 0 a 5 años", duration_years: 5, modality: "Presencial" },
    { id: "2", name: "Educación Primaria", description: "Preparación de docentes para la educación básica regular", duration_years: 5, modality: "Presencial" },
    { id: "3", name: "Educación Física", description: "Formación de profesores en educación física y deportes", duration_years: 5, modality: "Presencial" },
    { id: "4", name: "Educación Especial", description: "Especialización en educación inclusiva y necesidades especiales", duration_years: 5, modality: "Presencial" },
  ];
  const display = programs.length ? programs : defaults;

  return (
    <section id="programas" className="py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <Header title="Nuestros Programas de Estudio" subtitle="Carreras pedagógicas de calidad, acreditadas y diseñadas para formar los mejores profesionales." />
        {loading ? <Spinner /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {display.map((c) => (
              <Card key={c.id} className="hover:shadow-lg transition">
                <CardHeader>
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-blue-100 rounded-lg"><BookOpen className="h-8 w-8 text-blue-600" /></div>
                    <Badge variant="secondary">{c.duration_years} años</Badge>
                  </div>
                  <CardTitle className="text-xl">{c.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-gray-600 text-sm leading-relaxed">{c.description}</p>
                  <div className="space-y-2 text-sm text-gray-500">
                    <div className="flex items-center"><Clock className="h-4 w-4 mr-2" />{c.duration_years} años de estudio</div>
                    <div className="flex items-center"><Building className="h-4 w-4 mr-2" />Modalidad: {c.modality || "Presencial"}</div>
                  </div>
                  <Button className="w-full bg-blue-600 hover:bg-blue-700">Ver Más <ChevronRight className="h-4 w-4 ml-2" /></Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        <div className="text-center mt-12">
          <Button size="lg" variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50">
            Ver Todos los Programas <ExternalLink className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </section>
  );
};

/* ===================== Noticias públicas ===================== */
const NewsSection = () => {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await News.publicList({ limit: 6 });
      setNews(data?.items ?? data ?? []);
    } catch {
      // fallback demo
      setNews([
        { id: "1", title: "Inicio del Proceso de Admisión 2024-II", excerpt: "Se abrieron las inscripciones del segundo proceso 2024.", date: "2024-06-15", category: "Admisión", image: "/api/placeholder/400/200" },
        { id: "2", title: "Ceremonia de Graduación 2024", excerpt: "Felicitamos a nuestros egresados de la promoción 2024.", date: "2024-06-10", category: "Ceremonias", image: "/api/placeholder/400/200" },
        { id: "3", title: "Nuevas Certificaciones Internacionales", excerpt: "Certificación internacional en metodologías innovadoras.", date: "2024-06-05", category: "Logros", image: "/api/placeholder/400/200" },
      ]);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <section id="noticias" className="py-20">
      <div className="container mx-auto px-4">
        <Header title="Noticias y Anuncios" subtitle="Mantente informado con las últimas novedades institucionales." />
        {loading ? <Spinner /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {news.map((n) => (
              <Card key={n.id} className="overflow-hidden hover:shadow-lg transition">
                <div className="relative">
                  <img src={n.image || "/api/placeholder/400/200"} alt={n.title} className="w-full h-48 object-cover" />
                  <Badge className="absolute top-4 left-4 bg-blue-600">{n.category || "Noticia"}</Badge>
                </div>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center text-sm text-gray-500">
                    <Calendar className="h-4 w-4 mr-2" />
                    {n.date ? new Date(n.date).toLocaleDateString("es-PE", { year: "numeric", month: "long", day: "numeric" }) : "-"}
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 line-clamp-2">{n.title}</h3>
                  <p className="text-gray-600 line-clamp-3">{n.excerpt}</p>
                  <Button variant="outline" className="w-full">Leer Más <ChevronRight className="h-4 w-4 ml-2" /></Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        <div className="text-center mt-12">
          <Button size="lg" variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50">
            Ver Todas las Noticias <ExternalLink className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </section>
  );
};

/* ===================== Documentos públicos ===================== */
const DocumentsSection = () => {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState("ALL");

  const load = useCallback(async () => {
    try {
      const data = await Documents.list({ published: true });
      setDocs(data?.items ?? data ?? []);
    } catch { setDocs([]); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = docs.filter((d) => cat === "ALL" || d.category === cat);

  return (
    <section className="py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <Header title="Documentos Institucionales" subtitle="Reglamentos, normativas, formatos y planes." />
        <div className="flex justify-end mb-4">
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Categoría" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas las categorías</SelectItem>
              <SelectItem value="REGLAMENTO">Reglamentos</SelectItem>
              <SelectItem value="PLAN">Planes</SelectItem>
              <SelectItem value="FORMATO">Formatos</SelectItem>
              <SelectItem value="OTROS">Otros</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? <Spinner /> : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Documento</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoría</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filtered.map((d) => (
                      <tr key={d.id}>
                        <td className="px-6 py-3">
                          <div className="font-medium">{d.title}</div>
                          <div className="text-xs text-gray-500">{d.description}</div>
                        </td>
                        <td className="px-6 py-3 text-sm">{d.category}</td>
                        <td className="px-6 py-3 text-sm">{d.created_at ? new Date(d.created_at).toLocaleDateString() : "-"}</td>
                        <td className="px-6 py-3">
                          <a className="inline-flex items-center text-blue-600 hover:underline" href={d.url} target="_blank" rel="noreferrer">
                            <Download className="h-4 w-4 mr-1" /> Descargar
                          </a>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr><td colSpan="4" className="text-center py-10 text-gray-500">No hay documentos.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
};

/* ===================== Contacto (form funcional) ===================== */
const ContactSection = () => {
  const [form, setForm] = useState({ name: "", surname: "", email: "", phone: "", subject: "", message: "" });
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!form.name || !form.email || !form.message) {
      toast.error("Completa nombre, correo y mensaje");
      return;
    }
    setSending(true);
    try {
      await PublicForms.contact(form);
      toast.success("Mensaje enviado. Te contactaremos pronto.");
      setForm({ name: "", surname: "", email: "", phone: "", subject: "", message: "" });
    } catch (e) {
      toast.error(fmtApiErr(e, "No se pudo enviar el mensaje"));
    } finally { setSending(false); }
  };

  return (
    <section id="contacto" className="py-20 bg-gray-900 text-white">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="space-y-8">
            <h2 className="text-4xl font-bold">Contáctanos</h2>
            <p className="text-xl text-gray-300">Estamos aquí para ayudarte.</p>

            <Info icon={MapPin} title="Dirección">Jr. Ancash 123, Cercado de Lima<br />Lima 15001, Perú</Info>
            <Info icon={Phone} title="Teléfonos">Central: (01) 426-2573<br />Admisión: (01) 426-2574</Info>
            <Info icon={Mail} title="Correos">informes@iesppgal.edu.pe<br />admision@iesppgal.edu.pe</Info>
            <Info icon={Clock} title="Horario">L–V: 8:00–18:00<br />Sáb: 8:00–13:00</Info>
          </div>

          <div className="space-y-8">
            <Card className="bg-white text-gray-900">
              <CardHeader>
                <CardTitle className="flex items-center"><Mail className="h-5 w-5 mr-2 text-blue-600" /> Envíanos un Mensaje</CardTitle>
                <CardDescription>Completa el formulario y nos pondremos en contacto contigo</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Nombre">
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Tu nombre" />
                  </Field>
                  <Field label="Apellidos">
                    <Input value={form.surname} onChange={(e) => setForm({ ...form, surname: e.target.value })} placeholder="Tus apellidos" />
                  </Field>
                </div>
                <Field label="Correo Electrónico">
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="tu@correo.com" />
                </Field>
                <Field label="Teléfono">
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="999 999 999" />
                </Field>
                <Field label="Asunto">
                  <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Asunto" />
                </Field>
                <Field label="Mensaje">
                  <textarea className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" rows={4}
                    value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
                </Field>
                <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={submit} disabled={sending}>
                  {sending ? "Enviando..." : "Enviar Mensaje"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
};

const Field = ({ label, children }) => (<div><Label className="mb-1 block">{label}</Label>{children}</div>);
const Info = ({ icon: Icon, title, children }) => (
  <div className="flex items-start space-x-4">
    <div className="p-3 bg-blue-600 rounded-lg"><Icon className="h-6 w-6" /></div>
    <div><h3 className="font-semibold mb-1">{title}</h3><p className="text-gray-300">{children}</p></div>
  </div>
);
const Header = ({ title, subtitle }) => (
  <div className="text-center mb-16">
    <h2 className="text-4xl font-bold text-gray-900 mb-4">{title}</h2>
    <p className="text-xl text-gray-600 max-w-3xl mx-auto">{subtitle}</p>
  </div>
);
const Spinner = () => (
  <div className="flex justify-center py-12">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
);

/* ===================== Preinscripción (modal) ===================== */
const PreinscriptionDialog = ({ open, onOpenChange }) => {
  const [careers, setCareers] = useState([]);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({
    document_type: "DNI",
    document_number: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    career_id: "",
    shift: "DIURNO",
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${process.env.REACT_APP_BACKEND_URL || "http://localhost:8001"}/api/careers`);
        const json = await res.json();
        setCareers(json?.careers || []);
      } catch { setCareers([]); }
    })();
  }, []);

  const submit = async () => {
    if (!form.document_number || !form.first_name || !form.last_name || !form.email || !form.career_id) {
      toast.error("Completa DNI, nombres, apellidos, correo y carrera.");
      return;
    }
    setSending(true);
    try {
      await PublicForms.preinscription({
        ...form,
        career_id: form.career_id ? Number(form.career_id) : null,
      });
      toast.success("Preinscripción registrada. Te contactaremos.");
      onOpenChange(false);
      setForm({ document_type: "DNI", document_number: "", first_name: "", last_name: "", email: "", phone: "", career_id: "", shift: "DIURNO" });
    } catch (e) {
      toast.error(fmtApiErr(e, "No se pudo registrar la preinscripción"));
    } finally { setSending(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Preinscripción</DialogTitle>
          <DialogDescription>Completa tus datos para iniciar el proceso de admisión</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Tipo Doc.">
            <Select value={form.document_type} onValueChange={(v) => setForm({ ...form, document_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DNI">DNI</SelectItem>
                <SelectItem value="CE">Carné de Extranjería</SelectItem>
                <SelectItem value="PAS">Pasaporte</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="N° Documento"><Input value={form.document_number} onChange={(e) => setForm({ ...form, document_number: e.target.value })} /></Field>
          <Field label="Nombres"><Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></Field>
          <Field label="Apellidos"><Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></Field>
          <Field label="Correo"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Teléfono"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Carrera de Interés">
            <Select value={form.career_id} onValueChange={(v) => setForm({ ...form, career_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
              <SelectContent>
                {careers.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Turno">
            <Select value={form.shift} onValueChange={(v) => setForm({ ...form, shift: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DIURNO">Diurno</SelectItem>
                <SelectItem value="NOCTURNO">Nocturno</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div className="md:col-span-2 flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={sending} className="bg-blue-600 hover:bg-blue-700">
              {sending ? "Enviando..." : "Enviar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/* ===================== CMS: Páginas, Noticias, Documentos ===================== */
const PortalCMS = () => {
  const [tab, setTab] = useState("pages");
  return (
    <Card>
      <CardHeader>
        <CardTitle>CMS del Portal</CardTitle>
        <CardDescription>Gestiona páginas, noticias y documentos públicos.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pages">Páginas</TabsTrigger>
            <TabsTrigger value="news">Noticias</TabsTrigger>
            <TabsTrigger value="docs">Documentos</TabsTrigger>
          </TabsList>

          <TabsContent value="pages"><PagesCMS /></TabsContent>
          <TabsContent value="news"><NewsCMS /></TabsContent>
          <TabsContent value="docs"><DocsCMS /></TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

const PagesCMS = () => {
  const empty = { title: "", slug: "", content: "", is_published: true };
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await Pages.list();
      setRows(data?.items ?? data ?? []);
    } catch (e) { toast.error(fmtApiErr(e, "Error cargando páginas")); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e?.preventDefault?.();
    try {
      if (editing) { await Pages.update(editing.id, form); toast.success("Página actualizada"); }
      else { await Pages.create(form); toast.success("Página creada"); }
      setForm(empty); setEditing(null); load();
    } catch (e) { toast.error(fmtApiErr(e, "No se pudo guardar")); }
  };
  const remove = async (p) => {
    if (!window.confirm("¿Eliminar página?")) return;
    try { await Pages.remove(p.id); toast.success("Eliminada"); load(); } catch (e) { toast.error(fmtApiErr(e)); }
  };
  const publish = async (p, v) => { try { await Pages.publish(p.id, v); load(); } catch (e) { toast.error(fmtApiErr(e)); } };

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="grid md:grid-cols-2 gap-4">
        <Field label="Título"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></Field>
        <Field label="Slug (quienes-somos, admision, etc.)"><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required /></Field>
        <div className="md:col-span-2">
          <Field label="Contenido (Markdown/HTML permitido)">
            <textarea className="w-full p-3 border rounded-md" rows={6} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          </Field>
        </div>
        <div className="flex items-center gap-2">
          <input id="pub" type="checkbox" checked={!!form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} />
          <Label htmlFor="pub">Publicado</Label>
        </div>
        <div className="md:col-span-2 flex justify-end gap-2">
          {editing && <Button variant="outline" onClick={() => { setEditing(null); setForm(empty); }}>Cancelar</Button>}
          <Button type="submit" className="bg-blue-600 hover:bg-blue-700">{editing ? "Guardar cambios" : "Crear página"}</Button>
        </div>
      </form>

      <Card>
        <CardContent className="p-0">
          {loading ? <Spinner /> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Título</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Slug</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="px-6 py-3">{r.title}</td>
                      <td className="px-6 py-3 text-sm">{r.slug}</td>
                      <td className="px-6 py-3">{r.is_published ? <Badge>Publicado</Badge> : <Badge variant="secondary">Borrador</Badge>}</td>
                      <td className="px-6 py-3">
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => { setEditing(r); setForm({ title: r.title, slug: r.slug, content: r.content, is_published: r.is_published }); }}>
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => publish(r, !r.is_published)}>{r.is_published ? "Despublicar" : "Publicar"}</Button>
                          <Button size="sm" variant="outline" onClick={() => remove(r)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && <tr><td colSpan="4" className="text-center py-10 text-gray-500">Sin páginas.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const NewsCMS = () => {
  const empty = { title: "", excerpt: "", content: "", date: new Date().toISOString().slice(0, 10), category: "General", image: "", published: true };
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try { setLoading(true); const data = await News.list(); setRows(data?.items ?? data ?? []); }
    catch (e) { toast.error(fmtApiErr(e, "Error cargando noticias")); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e?.preventDefault?.();
    try {
      if (editing) { await News.update(editing.id, form); toast.success("Noticia actualizada"); }
      else { await News.create(form); toast.success("Noticia creada"); }
      setForm(empty); setEditing(null); load();
    } catch (e) { toast.error(fmtApiErr(e)); }
  };
  const publish = async (n, v) => { try { await News.publish(n.id, v); load(); } catch (e) { toast.error(fmtApiErr(e)); } };
  const remove = async (n) => { if (!window.confirm("¿Eliminar noticia?")) return; try { await News.remove(n.id); load(); } catch (e) { toast.error(fmtApiErr(e)); } };

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="grid md:grid-cols-2 gap-4">
        <Field label="Título *"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></Field>
        <Field label="Categoría"><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
        <div className="md:col-span-2"><Field label="Resumen"><Input value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} /></Field></div>
        <Field label="Fecha"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
        <Field label="Imagen (URL)"><Input value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} /></Field>
        <div className="md:col-span-2"><Field label="Contenido"><textarea className="w-full p-3 border rounded-md" rows={6} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></Field></div>
        <div className="flex items-center gap-2">
          <input id="pubn" type="checkbox" checked={!!form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} /><Label htmlFor="pubn">Publicado</Label>
        </div>
        <div className="md:col-span-2 flex justify-end gap-2">
          {editing && <Button variant="outline" onClick={() => { setEditing(null); setForm(empty); }}>Cancelar</Button>}
          <Button type="submit" className="bg-blue-600 hover:bg-blue-700">{editing ? "Guardar cambios" : "Crear noticia"}</Button>
        </div>
      </form>

      <Card>
        <CardContent className="p-0">
          {loading ? <Spinner /> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Título</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="px-6 py-3">{r.title}</td>
                      <td className="px-6 py-3 text-sm">{r.date ? new Date(r.date).toLocaleDateString() : "-"}</td>
                      <td className="px-6 py-3">{r.published ? <Badge>Publicado</Badge> : <Badge variant="secondary">Borrador</Badge>}</td>
                      <td className="px-6 py-3">
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => { setEditing(r); setForm({ title: r.title, excerpt: r.excerpt, content: r.content, date: r.date?.slice(0, 10) || "", category: r.category, image: r.image, published: r.published }); }}>
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => publish(r, !r.published)}>{r.published ? "Despublicar" : "Publicar"}</Button>
                          <Button size="sm" variant="outline" onClick={() => remove(r)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && <tr><td colSpan="4" className="text-center py-10 text-gray-500">Sin noticias.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const DocsCMS = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState(null);
  const [meta, setMeta] = useState({ title: "", description: "", category: "REGLAMENTO", is_published: true });

  const load = useCallback(async () => {
    try { setLoading(true); const data = await Documents.list(); setRows(data?.items ?? data ?? []); }
    catch (e) { toast.error(fmtApiErr(e, "Error cargando documentos")); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const upload = async () => {
    if (!file || !meta.title) { toast.error("Selecciona archivo y título"); return; }
    try {
      await Documents.upload({ file, title: meta.title, description: meta.description, category: meta.category, is_published: meta.is_published ? "true" : "false" });
      toast.success("Documento cargado");
      setFile(null); setMeta({ title: "", description: "", category: "REGLAMENTO", is_published: true }); load();
    } catch (e) { toast.error(fmtApiErr(e)); }
  };
  const publish = async (d, v) => { try { await Documents.publish(d.id, v); load(); } catch (e) { toast.error(fmtApiErr(e)); } };
  const remove = async (d) => { if (!window.confirm("¿Eliminar documento?")) return; try { await Documents.remove(d.id); load(); } catch (e) { toast.error(fmtApiErr(e)); } };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Subir Documento</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-4">
          <Field label="Título *"><Input value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} /></Field>
          <Field label="Categoría">
            <Select value={meta.category} onValueChange={(v) => setMeta({ ...meta, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="REGLAMENTO">Reglamento</SelectItem>
                <SelectItem value="PLAN">Plan</SelectItem>
                <SelectItem value="FORMATO">Formato</SelectItem>
                <SelectItem value="OTROS">Otros</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div className="flex items-end gap-2">
            <input id="pubd" type="checkbox" checked={meta.is_published} onChange={(e) => setMeta({ ...meta, is_published: e.target.checked })} />
            <Label htmlFor="pubd">Publicado</Label>
          </div>
          <div className="md:col-span-2"><Field label="Descripción"><Input value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} /></Field></div>
          <div><Field label="Archivo (PDF, DOCX)"><input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} /></Field></div>
          <div className="md:col-span-3 flex justify-end"><Button onClick={upload}><UploadIcon className="h-4 w-4 mr-2" />Subir</Button></div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? <Spinner /> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Título</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cat.</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="px-6 py-3">{r.title}</td>
                      <td className="px-6 py-3 text-sm">{r.category}</td>
                      <td className="px-6 py-3">{r.published || r.is_published ? <Badge>Publicado</Badge> : <Badge variant="secondary">Borrador</Badge>}</td>
                      <td className="px-6 py-3">
                        <div className="flex gap-2">
                          <a className="text-blue-600 underline" href={r.url} target="_blank" rel="noreferrer"><Eye className="h-4 w-4 inline mr-1" />Ver</a>
                          <Button size="sm" variant="outline" onClick={() => publish(r, !(r.published || r.is_published))}>
                            {(r.published || r.is_published) ? "Despublicar" : "Publicar"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => remove(r)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && <tr><td colSpan="4" className="text-center py-10 text-gray-500">Sin documentos.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

/* ===================== Bandeja de contenidos (Inbox) ===================== */
const ContentInbox = () => {
  const [type, setType] = useState("CONTACT"); // CONTACT | PREINSCRIPTION
  const [status, setStatus] = useState("NEW"); // NEW | REVIEWED | ARCHIVED
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await InboxSvc.list({ type, status });
      setRows(data?.items ?? data ?? []);
    } catch (e) {
      toast.error(fmtApiErr(e, "No se pudo cargar la bandeja"));
    } finally { setLoading(false); }
  }, [type, status]);
  useEffect(() => { load(); }, [load]);

  const setSt = async (row, st) => {
    try { await InboxSvc.setStatus(row.id, st); load(); }
    catch (e) { toast.error(fmtApiErr(e)); }
  };

  const filtered = rows.filter((r) => {
    const text = JSON.stringify(r).toLowerCase();
    return !q || text.includes(q.toLowerCase());
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><InboxIcon className="h-5 w-5" /> Bandeja de contenidos</CardTitle>
        <CardDescription>Mensajes de contacto y preinscripciones desde el portal.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3 mb-4 items-center">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="CONTACT">Contacto</SelectItem>
              <SelectItem value="PREINSCRIPTION">Preinscripciones</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="NEW">Nuevos</SelectItem>
              <SelectItem value="REVIEWED">Revisados</SelectItem>
              <SelectItem value="ARCHIVED">Archivados</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input className="pl-8" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Button variant="outline" onClick={load}><Clock className="h-4 w-4 mr-2" />Actualizar</Button>
        </div>

        {loading ? <Spinner /> : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Remitente</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Detalle</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filtered.map((r) => (
                      <tr key={r.id}>
                        <td className="px-6 py-3 text-sm text-gray-600">{r.created_at ? new Date(r.created_at).toLocaleString() : "-"}</td>
                        <td className="px-6 py-3">
                          <div className="font-medium">{r.name || `${r.first_name || ""} ${r.last_name || ""}`}</div>
                          <div className="text-xs text-gray-500">{r.email} {r.phone ? `• ${r.phone}` : ""}</div>
                        </td>
                        <td className="px-6 py-3 text-sm">
                          {type === "CONTACT" ? (r.subject ? <b>{r.subject}: </b> : null) : (r.career_name ? <b>{r.career_name} • {r.shift}</b> : null)}
                          <div className="text-gray-600">{r.message || r.observation || "-"}</div>
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex gap-2">
                            {status !== "REVIEWED" && <Button size="sm" variant="outline" onClick={() => setSt(r, "REVIEWED")}><CheckCircle className="h-4 w-4 mr-1" />Revisado</Button>}
                            {status !== "ARCHIVED" && <Button size="sm" variant="outline" onClick={() => setSt(r, "ARCHIVED")}><XCircle className="h-4 w-4 mr-1" />Archivar</Button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && <tr><td colSpan="4" className="text-center py-10 text-gray-500">Sin registros.</td></tr>}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
};

/* ===================== Main ===================== */
const InstitutionalPortal = () => {
  const { user } = useContext(AuthContext);
  const [preOpen, setPreOpen] = useState(false);

  const isAdmin = !!user && ["ADMIN", "EDITOR", "COMMS"].includes(user.role);

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg"><School className="h-8 w-8 text-blue-600" /></div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">IESPP</h1>
                <p className="text-xs text-gray-500">"Gustavo Allende Llavería"</p>
              </div>
            </div>
            <nav className="hidden md:flex items-center space-x-8">
              <a href="#inicio" className="text-gray-700 hover:text-blue-600 font-medium">Inicio</a>
              <a href="#programas" className="text-gray-700 hover:text-blue-600 font-medium">Programas</a>
              <a href="#noticias" className="text-gray-700 hover:text-blue-600 font-medium">Noticias</a>
              <a href="#contacto" className="text-gray-700 hover:text-blue-600 font-medium">Contacto</a>
            </nav>
            <div className="flex items-center space-x-2">
              {isAdmin && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline">Gestionar Portal</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-6xl">
                    <Tabs defaultValue="cms" className="space-y-4">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="cms">CMS</TabsTrigger>
                        <TabsTrigger value="inbox">Bandeja</TabsTrigger>
                      </TabsList>
                      <TabsContent value="cms"><PortalCMS /></TabsContent>
                      <TabsContent value="inbox"><ContentInbox /></TabsContent>
                    </Tabs>
                  </DialogContent>
                </Dialog>
              )}
              <Button className="bg-blue-600 hover:bg-blue-700">Acceso Sistema</Button>
            </div>
          </div>
        </div>
      </header>

      {/* Contenido público */}
      <main>
        <HeroSection onOpenPre={() => setPreOpen(true)} />
        <ProgramsSection />
        <DocumentsSection />
        <NewsSection />
        <ContactSection />
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-600 rounded-lg"><School className="h-6 w-6 text-white" /></div>
                <div><h3 className="font-bold">IESPP</h3><p className="text-sm text-gray-400">"Gustavo Allende Llavería"</p></div>
              </div>
              <p className="text-gray-300 text-sm">Formando profesionales de la educación desde 1985.</p>
            </div>
            <div className="space-y-4">
              <h4 className="font-semibold">Programas</h4>
              <ul className="space-y-2 text-sm text-gray-300">
                <li><a href="#" className="hover:text-white">Educación Inicial</a></li>
                <li><a href="#" className="hover:text-white">Educación Primaria</a></li>
                <li><a href="#" className="hover:text-white">Educación Física</a></li>
                <li><a href="#" className="hover:text-white">Educación Especial</a></li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="font-semibold">Servicios</h4>
              <ul className="space-y-2 text-sm text-gray-300">
                <li><a href="#" className="hover:text-white">Portal Estudiante</a></li>
                <li><a href="#" className="hover:text-white">Mesa de Partes</a></li>
                <li><a href="#" className="hover:text-white">Biblioteca Virtual</a></li>
                <li><a href="#" className="hover:text-white">Admisión</a></li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="font-semibold">Contacto</h4>
              <div className="space-y-2 text-sm text-gray-300">
                <p>Jr. Ancash 123, Lima</p>
                <p>(01) 426-2573</p>
                <p>informes@iesppgal.edu.pe</p>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
            <p>&copy; {new Date().getFullYear()} IESPP "Gustavo Allende Llavería". Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>

      {/* Modal de Preinscripción */}
      <PreinscriptionDialog open={preOpen} onOpenChange={setPreOpen} />
    </div>
  );
};

export default InstitutionalPortal;
