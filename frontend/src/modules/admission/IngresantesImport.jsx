// src/modules/admission/IngresantesImport.jsx
//
// Importador de ingresantes desde el Excel oficial del proceso de admisión.
// - Sube un .xlsx
// - Backend crea Applicant/Application (ADMITTED) + Student + User con
//   contraseña = DNI
// - Muestra reporte con credenciales generadas (se puede descargar CSV)
//
import React, { useEffect, useState, useMemo } from "react";
import api from "../../lib/api";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../../components/ui/select";
import { toast } from "sonner";
import {
  Upload, Download, Users, CheckCircle2, AlertCircle, FileSpreadsheet,
  Calendar, Loader2, X, Copy, Info,
} from "lucide-react";

function formatApiError(err, fallback = "Ocurrió un error") {
  const data = err?.response?.data;
  if (data?.detail) return typeof data.detail === "string" ? data.detail : fallback;
  if (typeof data?.message === "string") return data.message;
  if (typeof err?.message === "string") return err.message;
  return fallback;
}

export default function IngresantesImport() {
  const [calls, setCalls] = useState([]);
  const [callId, setCallId] = useState("");
  const [modalidad, setModalidad] = useState("ORDINARIO");
  const [modalidades, setModalidades] = useState([]);
  const [file, setFile] = useState(null);
  const [dryRun, setDryRun] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/admission-calls");
        const list = Array.isArray(data) ? data : (data?.results || data?.calls || []);
        setCalls(list);
      } catch {
        setCalls([]);
      }
      try {
        const { data } = await api.get("/admission/modalities");
        const list = Array.isArray(data) ? data : (data?.results || data?.modalities || []);
        setModalidades(list.filter(m => m.active !== false));
      } catch {
        setModalidades([]);
      }
    })();
  }, []);

  const onFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return setFile(null);
    if (!f.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("El archivo debe ser .xlsx");
      return;
    }
    setFile(f);
    setResult(null);
  };

  const submit = async () => {
    if (!file) return toast.error("Selecciona un archivo .xlsx");

    setUploading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (callId) fd.append("call_id", callId);
      fd.append("modalidad", modalidad || "ORDINARIO");
      if (dryRun) fd.append("dry_run", "1");

      const { data } = await api.post("/admission/ingresantes/import", fd, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 180000,
      });
      setResult(data);

      const s = data?.summary || {};
      if (dryRun) {
        toast.success(`Simulación: ${s.admitted || 0} ingresantes detectados`);
      } else {
        toast.success(
          `Importados: ${s.created_students || 0} nuevos, ${s.updated_students || 0} actualizados, ${s.created_users || 0} usuarios creados`
        );
      }
    } catch (e) {
      toast.error(formatApiError(e, "Error al importar"));
    } finally {
      setUploading(false);
    }
  };

  const downloadCredentialsCsv = () => {
    if (!result?.credentials?.length) return;
    const header = ["DNI", "Nombres", "Carrera", "Usuario", "Contraseña"];
    const rows = result.credentials.map(c => [
      c.dni, c.nombres || "", c.carrera || "", c.username, c.password,
    ]);
    const csv = "\uFEFF" + [header, ...rows]
      .map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "credenciales_ingresantes.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyCreds = () => {
    if (!result?.credentials?.length) return;
    const text = result.credentials
      .map(c => `${c.dni}\t${c.nombres}\t${c.carrera}\t${c.username}\t${c.password}`)
      .join("\n");
    navigator.clipboard?.writeText(text);
    toast.success("Credenciales copiadas al portapapeles");
  };

  const summary = result?.summary || {};
  const creds = result?.credentials || [];
  const errors = result?.errors || [];

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-24 sm:pb-6">
      {/* Header info */}
      <Card className="border-blue-200 bg-blue-50/40">
        <CardContent className="p-4 flex items-start gap-3">
          <div className="h-9 w-9 rounded-xl bg-blue-600/10 grid place-items-center shrink-0">
            <Info size={18} className="text-blue-700" />
          </div>
          <div className="text-sm text-slate-700 space-y-1">
            <p className="font-extrabold text-slate-900">Importador de ingresantes</p>
            <p>
              Carga el Excel oficial del proceso de admisión (con columnas Carrera, DNI,
              Apellidos, Nombres, Condición). Para cada postulante que <b>alcanzó vacante</b> el sistema:
            </p>
            <ul className="list-disc pl-5 text-slate-600">
              <li>Actualiza su postulación a <b>ADMITTED</b>.</li>
              <li>Crea o actualiza su ficha de <b>Estudiante</b>.</li>
              <li>Crea su <b>usuario</b> con <code>usuario = DNI</code> y una <b>contraseña temporal</b> aleatoria.</li>
              <li>Descarga el CSV de credenciales para entregárselas al estudiante.</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Form */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">
                Convocatoria <span className="text-slate-400 font-normal">(opcional)</span>
              </Label>
              <Select value={callId || "__auto__"} onValueChange={v => setCallId(v === "__auto__" ? "" : v)}>
                <SelectTrigger className="h-10 rounded-lg">
                  <div className="flex items-center gap-2 min-w-0">
                    <Calendar size={14} className="text-slate-400" />
                    <SelectValue placeholder="Auto (última convocatoria)" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__auto__">Auto (última convocatoria)</SelectItem>
                  {calls.filter(c => c?.id != null).map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.title || c.name || `Convocatoria #${c.id}`} {c.period ? `(${c.period})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Modalidad</Label>
              <Select value={modalidad} onValueChange={setModalidad}>
                <SelectTrigger className="h-10 rounded-lg">
                  <SelectValue placeholder="Modalidad" />
                </SelectTrigger>
                <SelectContent>
                  {(() => {
                    const names = modalidades.map(m => m.name).filter(Boolean);
                    if (!names.some(n => n.toUpperCase() === "ORDINARIO")) {
                      names.unshift("ORDINARIO");
                    }
                    const seen = new Set();
                    return names
                      .filter(n => { const k = n.toUpperCase(); if (seen.has(k)) return false; seen.add(k); return true; })
                      .map(n => <SelectItem key={n} value={n}>{n}</SelectItem>);
                  })()}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">Archivo Excel (.xlsx) *</Label>
            <div className="flex items-center gap-2">
              <label className="flex-1 rounded-lg border-2 border-dashed border-slate-200 px-4 py-6 cursor-pointer hover:bg-slate-50 transition-colors text-center">
                <input type="file" accept=".xlsx" className="hidden" onChange={onFileChange} />
                {file ? (
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <FileSpreadsheet size={16} className="text-emerald-600" />
                    <span className="font-semibold">{file.name}</span>
                    <span className="text-slate-400">({(file.size / 1024).toFixed(1)} KB)</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1 text-sm text-slate-500">
                    <Upload size={18} />
                    <span>Haz clic para seleccionar el archivo .xlsx</span>
                  </div>
                )}
              </label>
              {file && (
                <Button variant="ghost" size="sm" onClick={() => setFile(null)}>
                  <X size={14} />
                </Button>
              )}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={dryRun} onChange={e => setDryRun(e.target.checked)} />
            Simular (dry run) — cuenta sin crear nada
          </label>

          <div className="flex gap-2 pt-2 border-t">
            <Button
              onClick={submit}
              disabled={uploading || !file}
              className="rounded-lg font-extrabold bg-blue-600 hover:bg-blue-700 gap-2"
            >
              {uploading ? (
                <><Loader2 size={14} className="animate-spin" /> Procesando…</>
              ) : (
                <><Upload size={14} /> {dryRun ? "Simular" : "Importar"}</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resultado */}
      {result && (
        <>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <h3 className="font-extrabold text-slate-900">
                  Resultado {result.dry_run ? "(simulación)" : ""}
                </h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCell label="Filas leídas" value={summary.total_rows} />
                <StatCell label="Ingresantes" value={summary.admitted} color="emerald" />
                <StatCell label="Estudiantes nuevos" value={summary.created_students} color="blue" />
                <StatCell label="Estudiantes actualizados" value={summary.updated_students} />
                <StatCell label="Usuarios creados" value={summary.created_users} color="blue" />
                <StatCell label="Postulaciones nuevas" value={summary.created_applications} />
                <StatCell label="Postulaciones actualizadas" value={summary.updated_applications} />
                <StatCell label="Errores" value={summary.errors} color="red" />
              </div>
            </CardContent>
          </Card>

          {creds.length > 0 && (
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-blue-600" />
                    <h3 className="font-extrabold text-slate-900">
                      Credenciales generadas ({creds.length})
                    </h3>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={copyCreds} className="rounded-lg gap-1.5">
                      <Copy size={13} /> Copiar
                    </Button>
                    <Button size="sm" onClick={downloadCredentialsCsv} className="rounded-lg gap-1.5 bg-blue-600 hover:bg-blue-700">
                      <Download size={13} /> Descargar CSV
                    </Button>
                  </div>
                </div>
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="p-2 text-left font-bold text-slate-600">DNI</th>
                        <th className="p-2 text-left font-bold text-slate-600">Nombres</th>
                        <th className="p-2 text-left font-bold text-slate-600">Carrera</th>
                        <th className="p-2 text-left font-bold text-slate-600">Usuario</th>
                        <th className="p-2 text-left font-bold text-slate-600">Contraseña</th>
                      </tr>
                    </thead>
                    <tbody>
                      {creds.map((c, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          <td className="p-2 font-mono">{c.dni}</td>
                          <td className="p-2">{c.nombres}</td>
                          <td className="p-2 text-slate-600">{c.carrera}</td>
                          <td className="p-2 font-mono text-blue-700">{c.username}</td>
                          <td className="p-2 font-mono text-emerald-700">{c.password}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {errors.length > 0 && (
            <Card className="border-red-200">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle size={16} className="text-red-600" />
                  <h3 className="font-extrabold text-slate-900">Errores ({errors.length})</h3>
                </div>
                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-xs">
                    <thead className="bg-red-50">
                      <tr>
                        <th className="p-2 text-left font-bold text-red-700">Fila</th>
                        <th className="p-2 text-left font-bold text-red-700">DNI</th>
                        <th className="p-2 text-left font-bold text-red-700">Motivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {errors.map((e, i) => (
                        <tr key={i} className="border-t border-red-100">
                          <td className="p-2 font-mono">{e.row}</td>
                          <td className="p-2 font-mono">{e.dni}</td>
                          <td className="p-2 text-red-700">{e.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function StatCell({ label, value, color = "slate" }) {
  const colorMap = {
    slate: "text-slate-800",
    blue: "text-blue-700",
    emerald: "text-emerald-700",
    red: "text-red-700",
  };
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
      <p className={`text-xl font-extrabold ${colorMap[color] || colorMap.slate}`}>{value ?? 0}</p>
    </div>
  );
}
