import React, { useEffect, useMemo, useState, useCallback } from "react";
import { FReports, Concepts } from "../../services/finance.service";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { toast } from "../../utils/safeToast"; // <-- usa safeToast
import { RefreshCw, Download } from "lucide-react";
import { generatePDFWithPolling, downloadFile } from "../../utils/pdfQrPolling";
import { fmtCurrency, formatApiError, toLimaDate } from "../../utils/format";
import { optVal } from "../../utils/ui";

// --- helper: normaliza a array seguro ---
function toArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
}

// helper de error consistente
const showApiError = (e, fallback) => {
  const msg = formatApiError(e, fallback);
  toast.error(msg);
};

export default function FinanceReports() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [conceptId, setConceptId] = useState("ALL");
  // Carrera se filtra por NOMBRE y en el cliente: los ingresos de admisión
  // (p.ej. AUXILIAR DE EDUCACIÓN) no existen en el catálogo de carreras ni
  // llevan career_id, así que el filtro por id del backend los perdía.
  const [careerName, setCareerName] = useState("ALL");

  const [rows, setRows] = useState([]);
  const [concepts, setConcepts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const cs = await Concepts.list();
        setConcepts(cs?.items ?? cs ?? []);
      } catch {
        // silencioso en carga inicial
      }
    })();
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        concept_id: conceptId === "ALL" ? undefined : conceptId,
      };
      const data = await FReports.income(params);
      setRows(toArray(data)); // <— normaliza aquí
    } catch (e) {
      setRows([]);           // <— evita .map error si hubo fallo
      showApiError(e, "No se pudo cargar el reporte");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, conceptId]);

  useEffect(() => { load(); }, [load]);

  // Opciones de carrera desde los DATOS (incluye programas de admisión que
  // no están en el catálogo, como Auxiliar de Educación)
  const carreras = useMemo(() => {
    const set = new Set();
    for (const r of (Array.isArray(rows) ? rows : [])) {
      const c = (r.career_name || "").trim();
      if (c) set.add(c);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [rows]);

  const visibles = useMemo(() => {
    const list = Array.isArray(rows) ? rows : [];
    if (careerName === "ALL") return list;
    return list.filter((r) => (r.career_name || "").trim() === careerName);
  }, [rows, careerName]);

  const totals = useMemo(() => {
    const sum = visibles.reduce((a, r) => a + Number(r.amount || 0), 0);
    return { amount: sum, count: visibles.length };
  }, [visibles]);

  const exportPdf = async () => {
    try {
      setExporting(true);
      const params = {
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        concept_id: conceptId === "ALL" ? undefined : conceptId,
        career: careerName === "ALL" ? undefined : careerName,
      };
      const res = await generatePDFWithPolling(
        "/finance/reports/income/export",
        params,
        { testId: "finance-report-pdf" }
      );
      if (res?.success) await downloadFile(res.downloadUrl, "reporte-ingresos.pdf");
      else toast.error("No se pudo generar el PDF");
    } catch (e) {
      showApiError(e, "No se pudo exportar PDF");
    } finally {
      setExporting(false);
    }
  };

  const safeRows = visibles; // filtrado por carrera/programa en el cliente

  return (
   <div className="space-y-6 pb-24 sm:pb-6">

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
  <div className="min-w-0">
    <h2 className="text-xl md:text-2xl font-bold text-white">
      Reportes de ingresos
    </h2>
    <p className="text-sm text-white/80">
      Por concepto / período / carrera
    </p>
  </div>

  <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
    <Button variant="outline" onClick={load} className="w-full sm:w-auto">
      <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
      Actualizar
    </Button>

    <Button onClick={exportPdf} disabled={exporting} className="w-full sm:w-auto">
      {exporting ? (
        <>
          <RefreshCw className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
          Generando…
        </>
      ) : (
        <>
          <Download className="h-4 w-4 mr-2" aria-hidden="true" />
          Exportar PDF
        </>
      )}
    </Button>
  </div>
</div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Refina los resultados</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3">
  <div>
    <label className="text-sm">Desde</label>
    <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
  </div>

  <div>
    <label className="text-sm">Hasta</label>
    <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
  </div>

  <div>
    <label className="text-sm">Concepto</label>
    <Select value={conceptId} onValueChange={setConceptId}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Todos" />
      </SelectTrigger>
      <SelectContent className="z-[9999] max-h-60 overflow-y-auto">
        <SelectItem value="ALL">Todos</SelectItem>
        {concepts.map((c) => {
          const v = optVal(c.id);
          if (!v) return null;
          return (
            <SelectItem key={v} value={v}>
              {c.name}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  </div>

  <div className="md:col-span-2">
    <label className="text-sm">Carrera / Programa</label>
    <Select value={careerName} onValueChange={setCareerName}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Todas" />
      </SelectTrigger>
      <SelectContent className="z-[9999] max-h-60 overflow-y-auto">
        <SelectItem value="ALL">Todas</SelectItem>
        {carreras.map((c) => (
          <SelectItem key={c} value={c}>
            {c}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
</CardContent>

      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resultados</CardTitle>
          <CardDescription>
            Total: {totals.count} — Monto: {fmtCurrency(totals.amount)}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-40" aria-busy="true">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold">Fecha</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold">Concepto</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold">Carrera</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {safeRows.map((r, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2 text-sm text-gray-600">{toLimaDate(r.date)}</td>
                      <td className="px-4 py-2">{r.concept_name || "-"}</td>
                      <td className="px-4 py-2">{r.career_name || "-"}</td>
                      <td className="px-4 py-2 text-right">{fmtCurrency(r.amount)}</td>
                    </tr>
                  ))}
                  {safeRows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-gray-500">Sin resultados.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
