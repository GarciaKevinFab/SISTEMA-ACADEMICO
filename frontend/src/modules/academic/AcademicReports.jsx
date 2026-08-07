import React, { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { AcademicReports } from "../../services/academic.service";
import { toast } from "sonner";
import {
  FileSpreadsheet, Database, Download, Loader2, GraduationCap,
  Calendar, BookOpen, Sparkles, Building2, FileBadge2, User, Users, Archive,
} from "lucide-react";

export default function AcademicReportsPage() {
  const [filters, setFilters] = useState({ from: "", to: "", period: "", career_id: "" });

  const [summary, setSummary] = useState(null);

  const [careers, setCareers] = useState([]);
  const [loadingCareers, setLoadingCareers] = useState(false);

  const [loadingSummary, setLoadingSummary] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // ── Nómina / Data Estudiantes ──
  const currentYear = new Date().getFullYear();
  const periodOptions = useMemo(() => {
    const opts = [];
    for (let y = currentYear + 1; y >= currentYear - 2; y--) {
      opts.push(`${y}-II`);
      opts.push(`${y}-I`);
    }
    return opts;
  }, [currentYear]);

  const [nomFilters, setNomFilters] = useState({
    career_id: "",
    semester: "1",
    period: `${currentYear}-I`,
  });
  const [downloadingNomina, setDownloadingNomina] = useState(false);
  const [downloadingNominaPdf, setDownloadingNominaPdf] = useState(false);
  const [downloadingData, setDownloadingData] = useState(false);
  const [downloadingMinedu, setDownloadingMinedu] = useState(false);

  // ── Fichas de Rendimiento Académico ──
  const [fichaMode, setFichaMode] = useState("individual"); // "individual" | "bulk"
  const [fichaDni, setFichaDni] = useState("");
  const [downloadingFichaInd, setDownloadingFichaInd] = useState(false);
  const [downloadingFichaBulk, setDownloadingFichaBulk] = useState(false);

  const onNom = (k, v) => setNomFilters((f) => ({ ...f, [k]: v }));

  // Para el endpoint MINEDU mantenemos sección "A" y turno "MAÑANA" por defecto
  const buildNomParams = () => ({
    ...nomFilters,
    seccion: "A",
    turno: "MAÑANA",
  });

  const selectedCareerName = useMemo(() => {
    const c = careers.find((x) => String(x.id) === String(nomFilters.career_id));
    return c?.name || "";
  }, [careers, nomFilters.career_id]);

  const semesterRoman = useMemo(() => {
    const map = ["I","II","III","IV","V","VI","VII","VIII","IX","X"];
    const n = parseInt(nomFilters.semester, 10);
    return Number.isFinite(n) && n >= 1 && n <= 10 ? map[n-1] : "";
  }, [nomFilters.semester]);

  const on = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

  // ✅ cargar carreras al abrir la pantalla
  useEffect(() => {
    let alive = true;

    (async () => {
      setLoadingCareers(true);
      try {
        const list = await AcademicReports.careers();
        if (!alive) return;

        // normaliza defensivo
        const norm = (Array.isArray(list) ? list : [])
          .map((c) => ({
            id: c?.id ?? c?.career_id ?? c?.value,
            name: c?.name ?? c?.label ?? c?.career_name ?? `Carrera ${c?.id ?? ""}`,
          }))
          .filter((c) => c.id != null);

        setCareers(norm);
      } catch (e) {
        if (!alive) return;
        setCareers([]);
        toast.error("No se pudo cargar carreras");
      } finally {
        if (alive) setLoadingCareers(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const load = async () => {
    setLoadingSummary(true);
    try {
      const d = await AcademicReports.summary(filters);
      setSummary(d);
    } catch {
      toast.error("No se pudo cargar el resumen");
    } finally {
      setLoadingSummary(false);
    }
  };

  // Extrae el mensaje real del error (axios) — funciona también cuando
  // responseType="blob" (caso típico de descargas) y el backend devolvió JSON.
  const extractAxiosError = async (e, fallback = "No se pudo exportar") => {
    try {
      const resp = e?.response;
      if (!resp) return e?.message || fallback;
      const status = resp.status;
      const ct = resp.headers?.["content-type"] || "";
      let data = resp.data;
      // Si vino como Blob (porque pedimos responseType=blob), leemos el texto.
      if (data instanceof Blob) {
        const txt = await data.text();
        try { data = JSON.parse(txt); } catch { data = txt; }
      }
      // Mensajes típicos de DRF
      const detail =
        (data && typeof data === "object" && (data.detail || data.message)) ||
        (typeof data === "string" && data) ||
        "";
      if (status === 404 && !detail) return "Endpoint no encontrado (¿backend sin reiniciar?)";
      if (detail) return String(detail);
      return `${fallback} (HTTP ${status})`;
    } catch {
      return fallback;
    }
  };

  // Descarga genérica con setter de loading custom
  const dlWith = async (fn, fallbackName, params, setLoading) => {
    setLoading(true);
    try {
      const r = await fn(params);
      const contentType = r?.headers?.["content-type"] || "";
      const cd = r?.headers?.["content-disposition"] || "";
      const blob =
        r.data instanceof Blob
          ? r.data
          : new Blob([r.data], { type: contentType || "application/octet-stream" });
      if (contentType.includes("application/json")) {
        const txt = await blob.text();
        let msg = "No se pudo exportar";
        try { const j = JSON.parse(txt); msg = j.detail || j.message || msg; } catch { }
        toast.error(msg);
        return;
      }
      const fileName = /filename="?([^"]+)"?/i.exec(cd)?.[1] || fallbackName;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = fileName;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (e) {
      const msg = await extractAxiosError(e);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const dl = async (fn, fallbackName) => {
    setDownloading(true);
    try {
      const r = await fn(filters); // axios response
      const contentType = r?.headers?.["content-type"] || "";
      const cd = r?.headers?.["content-disposition"] || "";

      const blob =
        r.data instanceof Blob
          ? r.data
          : new Blob([r.data], { type: contentType || "application/octet-stream" });

      // Si el backend manda JSON de error, no descargues basura
      if (contentType.includes("application/json")) {
        const txt = await blob.text();
        let msg = "No se pudo exportar";
        try {
          const j = JSON.parse(txt);
          msg = j.detail || j.message || msg;
        } catch { }
        toast.error(msg);
        return;
      }

      const fileName = /filename="?([^"]+)"?/i.exec(cd)?.[1] || fallbackName;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (e) {
      const msg = await extractAxiosError(e);
      toast.error(msg);
    } finally {
      setDownloading(false);
    }
  };

  // ✅ UI helpers
  const careerSelectValue = useMemo(() => {
    return filters.career_id === "" ? "ALL" : String(filters.career_id);
  }, [filters.career_id]);

  const occupancyPct = useMemo(() => {
    const v = summary?.occupancy;
    if (v == null) return "-";
    // backend manda 0.76 → 76%
    return `${Math.round(Number(v) * 100)}%`;
  }, [summary]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Reportes Académicos</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="w-full min-w-0">
              <label className="text-sm">Desde</label>
              <Input
                className="w-full"
                type="date"
                value={filters.from}
                onChange={(e) => on("from", e.target.value)}
              />
            </div>

            <div className="w-full min-w-0">
              <label className="text-sm">Hasta</label>
              <Input
                className="w-full"
                type="date"
                value={filters.to}
                onChange={(e) => on("to", e.target.value)}
              />
            </div>

            <div className="w-full min-w-0">
              <label className="text-sm">Período</label>
              <Input
                className="w-full"
                value={filters.period}
                onChange={(e) => on("period", e.target.value)}
                placeholder="2025-I"
              />
            </div>

            <div className="w-full min-w-0">
              <label className="text-sm">Carrera</label>
              <Select
                value={careerSelectValue}
                onValueChange={(v) => on("career_id", v === "ALL" ? "" : v)}
                disabled={loadingCareers}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={loadingCareers ? "Cargando..." : "Todas"} />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="ALL">Todas</SelectItem>

                  {careers.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Botonera responsive */}
            <div className="w-full min-w-0 md:col-span-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-1 gap-2">
                <Button className="w-full" onClick={load} disabled={loadingSummary || downloading}>
                  {loadingSummary ? "Cargando..." : "Ver resumen"}
                </Button>

                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => dl(AcademicReports.exportPerformance, "rendimiento.xlsx")}
                  disabled={downloading}
                >
                  {downloading ? "Descargando..." : "Rendimiento"}
                </Button>

                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => dl(AcademicReports.exportOccupancy, "ocupacion.xlsx")}
                  disabled={downloading}
                >
                  {downloading ? "Descargando..." : "Ocupación"}
                </Button>
              </div>
            </div>
          </div>

          {summary && (
            <div className="grid md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="text-sm text-gray-500">Alumnos</div>
                  <div className="text-2xl font-semibold">{summary.students || 0}</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="text-sm text-gray-500">Secciones</div>
                  <div className="text-2xl font-semibold">{summary.sections ?? "-"}</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="text-sm text-gray-500">PPA promedio</div>
                  <div className="text-2xl font-semibold">{summary.avg_gpa ?? "-"}</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="text-sm text-gray-500">Ocupación aulas (%)</div>
                  <div className="text-2xl font-semibold">{occupancyPct}</div>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Nóminas y Data de Estudiantes ── */}
      <Card className="overflow-hidden border-slate-200/70 shadow-sm">
        {/* Banner superior con gradiente */}
        <div className="relative bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 px-6 py-5 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.18),transparent_60%)]" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-xl bg-white/15 backdrop-blur grid place-items-center shrink-0 ring-1 ring-white/20">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold tracking-tight">
                  Nóminas y Data de Estudiantes
                </h3>
                <p className="text-xs text-white/80 mt-0.5 max-w-xl">
                  Exporta la <b>Nómina oficial MINEDU</b> o un <b>dump completo</b> de
                  datos por carrera, ciclo y periodo en formato Excel.
                </p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider ring-1 ring-white/20">
              <Sparkles className="w-3.5 h-3.5" />
              Excel oficial
            </div>
          </div>
        </div>

        <CardContent className="p-6 space-y-5">
          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <BookOpen className="w-3 h-3" /> Carrera
                <span className="text-rose-500">*</span>
              </Label>
              <Select
                value={nomFilters.career_id || "0"}
                onValueChange={(v) => onNom("career_id", v === "0" ? "" : v)}
                disabled={loadingCareers}
              >
                <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-50 hover:bg-white transition-colors">
                  <SelectValue placeholder={loadingCareers ? "Cargando..." : "Seleccionar carrera"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">— Seleccionar —</SelectItem>
                  {careers.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <GraduationCap className="w-3 h-3" /> Ciclo
                <span className="text-rose-500">*</span>
              </Label>
              <Select
                value={nomFilters.semester || "1"}
                onValueChange={(v) => onNom("semester", v)}
              >
                <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-50 hover:bg-white transition-colors">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <SelectItem key={n} value={String(n)}>
                      Ciclo {["I","II","III","IV","V","VI","VII","VIII","IX","X"][n-1]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Calendar className="w-3 h-3" /> Periodo Académico
                <span className="text-rose-500">*</span>
              </Label>
              <Select
                value={nomFilters.period}
                onValueChange={(v) => onNom("period", v)}
              >
                <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-50 hover:bg-white transition-colors">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {periodOptions.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Resumen de selección */}
          {nomFilters.career_id && (
            <div className="rounded-xl bg-gradient-to-r from-slate-50 to-blue-50/50 border border-slate-200/70 px-4 py-3 flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 grid place-items-center shrink-0">
                <BookOpen className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-xs text-slate-600">
                Listo para generar:{" "}
                <span className="font-bold text-slate-900">{selectedCareerName}</span>
                {" · "}
                <span className="font-bold text-slate-900">Ciclo {semesterRoman}</span>
                {" · "}
                <span className="font-bold text-slate-900">{nomFilters.period}</span>
              </p>
            </div>
          )}

          {/* Tarjetas de descarga */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Nómina MINEDU */}
            <div className="group relative overflow-hidden rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50/40 to-white p-5 hover:border-emerald-400 hover:shadow-lg transition-all">
              <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-emerald-500/5 group-hover:bg-emerald-500/10 transition-colors" />
              <div className="relative space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-emerald-100 grid place-items-center ring-1 ring-emerald-200">
                    <FileSpreadsheet className="w-6 h-6 text-emerald-700" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-900">Nómina de Matrícula</h4>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                      Formato oficial MINEDU
                    </p>
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Excel con cabecera institucional (logo, DRE, UGEL, código modular,
                  director), tabla alfabética con N°, DNI, apellidos y nombres, sexo,
                  fecha de nacimiento, edad, y resumen al pie.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => {
                      if (!nomFilters.career_id) { toast.error("Selecciona una carrera"); return; }
                      if (!nomFilters.period) { toast.error("Indica el periodo"); return; }
                      dlWith(
                        AcademicReports.exportNominaMinedu,
                        `nomina_${nomFilters.period}.xlsx`,
                        buildNomParams(),
                        setDownloadingNomina,
                      );
                    }}
                    disabled={downloadingNomina || !nomFilters.career_id}
                    className="h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm gap-2"
                  >
                    {downloadingNomina ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Excel…</>
                    ) : (
                      <><Download className="w-4 h-4" /> Excel</>
                    )}
                  </Button>
                  <Button
                    onClick={() => {
                      if (!nomFilters.career_id) { toast.error("Selecciona una carrera"); return; }
                      if (!nomFilters.period) { toast.error("Indica el periodo"); return; }
                      dlWith(
                        AcademicReports.exportNominaMineduPdf,
                        `nomina_${nomFilters.period}.pdf`,
                        buildNomParams(),
                        setDownloadingNominaPdf,
                      );
                    }}
                    disabled={downloadingNominaPdf || !nomFilters.career_id}
                    variant="outline"
                    className="h-11 rounded-xl border-2 border-emerald-600 text-emerald-700 hover:bg-emerald-600 hover:text-white font-bold gap-2"
                  >
                    {downloadingNominaPdf ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> PDF…</>
                    ) : (
                      <><Download className="w-4 h-4" /> PDF</>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Data Completa */}
            <div className="group relative overflow-hidden rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50/40 to-white p-5 hover:border-blue-400 hover:shadow-lg transition-all">
              <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-blue-500/5 group-hover:bg-blue-500/10 transition-colors" />
              <div className="relative space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-blue-100 grid place-items-center ring-1 ring-blue-200">
                    <Database className="w-6 h-6 text-blue-700" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-900">Data Completa</h4>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                      Dump interno · 29 columnas
                    </p>
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Excel con todos los campos del estudiante: identidad, contacto,
                  ubicación, plan, ciclo, código modular de origen, lengua materna,
                  discapacidad, usuario, etc. Listo para análisis o reportes internos.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (!nomFilters.career_id) { toast.error("Selecciona una carrera"); return; }
                    dlWith(
                      AcademicReports.exportStudentsData,
                      `data_estudiantes_${nomFilters.period || "todos"}.xlsx`,
                      nomFilters,
                      setDownloadingData,
                    );
                  }}
                  disabled={downloadingData || !nomFilters.career_id}
                  className="w-full h-11 rounded-xl border-2 border-blue-600 text-blue-700 hover:bg-blue-600 hover:text-white font-bold gap-2"
                >
                  {downloadingData ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Generando…</>
                  ) : (
                    <><Download className="w-4 h-4" /> Descargar Data</>
                  )}
                </Button>
              </div>
            </div>

          </div>
        </CardContent>
      </Card>

      {/* ── Fichas de Rendimiento Académico ── */}
      <Card className="overflow-hidden border-slate-200/70 shadow-sm">
        <div className="relative bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 px-6 py-5 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.18),transparent_60%)]" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-xl bg-white/15 backdrop-blur grid place-items-center shrink-0 ring-1 ring-white/20">
                <FileBadge2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold tracking-tight">
                  Ficha de Rendimiento Académico
                </h3>
                <p className="text-xs text-white/80 mt-0.5 max-w-xl">
                  PDF oficial con notas históricas agrupadas por ciclo, foto del
                  estudiante y firmas. Individual (por DNI) o <b>masivo</b> (ZIP por
                  carrera/ciclo/periodo).
                </p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider ring-1 ring-white/20">
              <Sparkles className="w-3.5 h-3.5" /> Formato oficial
            </div>
          </div>
        </div>

        <CardContent className="p-6 space-y-5">
          {/* Tabs Individual / Masivo */}
          <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit">
            <button
              type="button"
              onClick={() => setFichaMode("individual")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                fichaMode === "individual"
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <User className="w-4 h-4" /> Individual
            </button>
            <button
              type="button"
              onClick={() => setFichaMode("bulk")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                fichaMode === "bulk"
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Users className="w-4 h-4" /> Masivo (ZIP)
            </button>
          </div>

          {/* ── MODO INDIVIDUAL ── */}
          {fichaMode === "individual" && (
            <div className="rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50/40 to-white p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-100 grid place-items-center ring-1 ring-emerald-200">
                  <User className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900">
                    Por DNI del estudiante
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Ingresa el DNI y descarga la ficha de un solo alumno.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    DNI del estudiante
                  </Label>
                  <Input
                    value={fichaDni}
                    onChange={(e) => setFichaDni(e.target.value.replace(/[^\d]/g, "").slice(0, 12))}
                    placeholder="Ej. 47449679"
                    className="h-11 rounded-xl border-slate-200 bg-white font-mono text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && fichaDni.trim().length >= 6) {
                        document.getElementById("btn-ficha-individual")?.click();
                      }
                    }}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    id="btn-ficha-individual"
                    onClick={async () => {
                      const dni = fichaDni.trim();
                      if (dni.length < 6) {
                        toast.error("Ingresa un DNI válido");
                        return;
                      }
                      setDownloadingFichaInd(true);
                      try {
                        const r = await AcademicReports.exportFichaRendimientoIndividual(dni);
                        const cd = r?.headers?.["content-disposition"] || "";
                        const ct = r?.headers?.["content-type"] || "";
                        const blob = r.data instanceof Blob ? r.data : new Blob([r.data], { type: ct });
                        if (ct.includes("application/json")) {
                          const txt = await blob.text();
                          let msg = "No se pudo generar la ficha";
                          try { msg = JSON.parse(txt).detail || msg; } catch { }
                          toast.error(msg);
                          return;
                        }
                        const filename = /filename="?([^"]+)"?/i.exec(cd)?.[1] || `ficha_rendimiento-${dni}.pdf`;
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url; a.download = filename;
                        document.body.appendChild(a); a.click(); a.remove();
                        setTimeout(() => URL.revokeObjectURL(url), 1500);
                        toast.success("Ficha generada");
                      } catch (e) {
                        toast.error(e?.response?.data?.detail || "Error generando ficha");
                      } finally {
                        setDownloadingFichaInd(false);
                      }
                    }}
                    disabled={downloadingFichaInd || fichaDni.trim().length < 6}
                    className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm gap-2"
                  >
                    {downloadingFichaInd ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Generando…</>
                    ) : (
                      <><Download className="w-4 h-4" /> Descargar PDF</>
                    )}
                  </Button>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                <span className="font-bold">Tip:</span> también puedes presionar
                Enter para descargar. Si el alumno no tiene notas registradas,
                el sistema te avisará.
              </p>
            </div>
          )}

          {/* ── MODO MASIVO ── */}
          {fichaMode === "bulk" && (
            <div className="rounded-2xl border-2 border-cyan-200 bg-gradient-to-br from-cyan-50/40 to-white p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-cyan-100 grid place-items-center ring-1 ring-cyan-200">
                  <Archive className="w-5 h-5 text-cyan-700" />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900">
                    Descarga por lote (ZIP)
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Usa los filtros de Carrera / Ciclo / Periodo de arriba.
                    Genera un PDF por cada alumno con notas registradas.
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-white border border-slate-200 p-4 space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Filtros activos
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1">
                    <BookOpen className="w-3 h-3 text-slate-500" />
                    {selectedCareerName || <em className="text-slate-400">Todas las carreras</em>}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1">
                    <GraduationCap className="w-3 h-3 text-slate-500" />
                    Ciclo {semesterRoman || "—"}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1">
                    <Calendar className="w-3 h-3 text-slate-500" />
                    {nomFilters.period || "—"}
                  </span>
                </div>
              </div>

              <Button
                onClick={async () => {
                  setDownloadingFichaBulk(true);
                  try {
                    const params = {};
                    if (nomFilters.career_id) params.career_id = nomFilters.career_id;
                    if (nomFilters.semester) params.semester = nomFilters.semester;
                    if (nomFilters.period) params.period = nomFilters.period;
                    const r = await AcademicReports.exportFichasRendimientoZip(params);
                    const cd = r?.headers?.["content-disposition"] || "";
                    const ct = r?.headers?.["content-type"] || "";
                    const blob = r.data instanceof Blob ? r.data : new Blob([r.data], { type: ct });
                    if (ct.includes("application/json")) {
                      const txt = await blob.text();
                      let msg = "No se pudo generar el ZIP";
                      try { msg = JSON.parse(txt).detail || msg; } catch { }
                      toast.error(msg);
                      return;
                    }
                    const filename = /filename="?([^"]+)"?/i.exec(cd)?.[1] || "fichas_rendimiento.zip";
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url; a.download = filename;
                    document.body.appendChild(a); a.click(); a.remove();
                    setTimeout(() => URL.revokeObjectURL(url), 1500);
                    toast.success("ZIP de fichas descargado");
                  } catch (e) {
                    toast.error(e?.response?.data?.detail || "Error generando el ZIP");
                  } finally {
                    setDownloadingFichaBulk(false);
                  }
                }}
                disabled={downloadingFichaBulk}
                className="w-full h-11 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold shadow-sm gap-2"
              >
                {downloadingFichaBulk ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Generando ZIP…</>
                ) : (
                  <><Archive className="w-4 h-4" /> Descargar ZIP con todas las fichas</>
                )}
              </Button>

              <p className="text-[11px] text-slate-500 leading-relaxed">
                Solo se incluyen alumnos <b>con notas históricas registradas</b>.
                Si algún PDF falla, se incluye un archivo <code>_ERRORES.txt</code>
                con el detalle.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
