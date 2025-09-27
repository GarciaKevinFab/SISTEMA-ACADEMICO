import React, { useEffect, useMemo, useState, useCallback } from "react";
import { FReports, Concepts } from "../../services/finance.service";
import { Careers } from "../../services/academic.service";
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
  const [careerId, setCareerId] = useState("ALL");

  const [rows, setRows] = useState([]);
  const [concepts, setConcepts] = useState([]);
  const [careers, setCareers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [cs, cr] = await Promise.all([Concepts.list(), Careers.list()]);
        setConcepts(cs?.items ?? cs ?? []);
        setCareers(cr?.careers ?? cr ?? []);
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
        career_id: careerId === "ALL" ? undefined : careerId,
      };
      const data = await FReports.income(params);
      setRows(toArray(data)); // <— normaliza aquí
    } catch (e) {
      setRows([]);           // <— evita .map error si hubo fallo
      showApiError(e, "No se pudo cargar el reporte");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, conceptId, careerId]);

  useEffect(() => { load(); }, [load]);

  const totals = useMemo(() => {
    const list = Array.isArray(rows) ? rows : [];
    const sum = list.reduce((a, r) => a + Number(r.amount || 0), 0);
    return { amount: sum, count: list.length };
  }, [rows]);

  const exportPdf = async () => {
    try {
      setExporting(true);
      const params = {
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        concept_id: conceptId === "ALL" ? undefined : conceptId,
        career_id: careerId === "ALL" ? undefined : careerId,
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

  const safeRows = Array.isArray(rows) ? rows : []; // <— usa siempre este en el render

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Reportes de ingresos</h2>
          <p className="text-sm text-gray-600">Por concepto / período / carrera</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load}>
            <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
            Actualizar
          </Button>
          <Button onClick={exportPdf} disabled={exporting}>
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
        <CardContent className="grid md:grid-cols-5 gap-3">
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
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
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
            <label className="text-sm">Carrera</label>
            <Select value={careerId} onValueChange={setCareerId}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas</SelectItem>
                {careers.map((c) => {
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
