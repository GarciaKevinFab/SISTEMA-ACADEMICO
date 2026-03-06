import React, { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { AcademicReports } from "../../services/academic.service";
import { toast } from "sonner";

export default function AcademicReportsPage() {
  const [filters, setFilters] = useState({ from: "", to: "", period: "", career_id: "" });

  const [summary, setSummary] = useState(null);

  const [careers, setCareers] = useState([]);
  const [loadingCareers, setLoadingCareers] = useState(false);

  const [loadingSummary, setLoadingSummary] = useState(false);
  const [downloading, setDownloading] = useState(false);

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
      toast.error("No se pudo exportar");
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
    </div>
  );
}
