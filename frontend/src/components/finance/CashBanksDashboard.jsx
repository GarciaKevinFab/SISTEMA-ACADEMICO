// src/modules/finance/CashBanksDashboard.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CashBanks } from "../../services/finance.service";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Badge } from "../../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import { toast } from "../../utils/safeToast";
import { Plus, Save, RefreshCw, Loader2 } from "lucide-react"; // Agregué Loader2 para feedback visual
import { fmtCurrency, formatApiError, toLimaDateTime } from "../../utils/format";
import { clampVariant, optVal, safeText } from "../../utils/ui";

// CONFIGURACIONES CONSTANTES
const STATUS_CFG = {
  OPEN: { label: "Abierta", variant: "default" },
  CLOSED: { label: "Cerrada", variant: "secondary" },
};

const TYPE_CFG = {
  IN: { label: "Ingreso", variant: "default" },
  OUT: { label: "Egreso", variant: "secondary" },
};

const normStatus = (status) => {
  if (status == null) return { code: "", label: "-", variant: "secondary" };
  const code = String(typeof status === "object" ? (status.code ?? status.value ?? "") : status || "").toUpperCase();
  const cfg = STATUS_CFG[code];
  return { code, label: cfg?.label || (code || "-"), variant: clampVariant(cfg?.variant || "secondary") };
};

const normType = (type) => {
  if (type == null) return { code: "", label: "-", variant: "secondary" };
  const code = String(typeof type === "object" ? (type.code ?? type.value ?? "") : type || "").toUpperCase();
  const cfg = TYPE_CFG[code];
  return {
    code,
    label: cfg?.label || (code || "-"),
    variant: clampVariant(cfg?.variant || (code === "IN" ? "default" : "secondary")),
  };
};

const showApiError = (e, fallbackMsg) => toast.error(formatApiError(e, fallbackMsg));

export default function CashBanksDashboard() {
  const [sessions, setSessions] = useState([]);
  const [currentId, setCurrentId] = useState(undefined);
  const [movs, setMovs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados de modales
  const [openDlg, setOpenDlg] = useState(false);
  const [closeDlg, setCloseDlg] = useState(false);

  // Formularios
  const [openForm, setOpenForm] = useState({ opening_amount: "", note: "" });
  const [closeForm, setCloseForm] = useState({ closing_amount: "", note: "" });
  const [newMov, setNewMov] = useState({ type: "IN", amount: "", concept: "" });

  // Estados de carga
  const [busyOpen, setBusyOpen] = useState(false);
  const [busyClose, setBusyClose] = useState(false);
  const [busyMov, setBusyMov] = useState(false);

  const current = useMemo(
    () => sessions.find((s) => String(s.id) === String(currentId)),
    [sessions, currentId]
  );

  const statusMeta = normStatus(current?.status);

  const totals = useMemo(() => {
    const ins = movs
      .filter((m) => normType(m.type).code === "IN")
      .reduce((a, m) => a + Number(m.amount || 0), 0);
    const outs = movs
      .filter((m) => normType(m.type).code === "OUT")
      .reduce((a, m) => a + Number(m.amount || 0), 0);
    const opening = Number(current?.opening_amount || 0);
    return { ins, outs, opening, balance: opening + ins - outs };
  }, [movs, current]);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    let alive = true;
    try {
      const d = await CashBanks.sessions();
      const list = d?.items ?? d ?? [];
      if (!alive) return;

      setSessions(list);
      // Lógica mejorada para seleccionar sesión
      const open = list.find((s) => normStatus(s.status).code === "OPEN" && optVal(s.id));
      const firstValid = list.find((s) => optVal(s.id));
      
      // Si ya hay ID seleccionado, manténlo, sino usa el abierto o el primero
      if (!currentId) {
          const initial = open?.id ?? firstValid?.id;
          setCurrentId(initial != null ? String(initial) : undefined);
          if (!initial && list.length === 0) setOpenDlg(true);
      }
    } catch (e) {
      if (alive) showApiError(e, "Error cargando sesiones");
    } finally {
      if (alive) setLoading(false);
    }
    return () => { alive = false; };
  }, [currentId]);

  const loadMovs = useCallback(async () => {
    if (!currentId) return;
    const myId = currentId;
    try {
      // console.log("Cargando movimientos para ID:", myId); 
      const d = await CashBanks.movements(myId);
      // Asegurar que actualizamos solo si seguimos en la misma sesión
      setMovs((prev) => (currentId === myId ? (d?.items ?? d ?? []) : prev));
    } catch (e) {
        console.error("Error cargando movs:", e);
    }
  }, [currentId]);

  useEffect(() => {
    let cleanup;
    (async () => { cleanup = await loadSessions(); })();
    return () => { if (typeof cleanup === "function") cleanup(); };
  }, [loadSessions]);

  useEffect(() => { loadMovs(); }, [loadMovs]);

  // --- HANDLERS ---
  const openSession = async () => {
    try {
      setBusyOpen(true);
      const payload = {
        opening_amount: Number(openForm.opening_amount || 0),
        note: openForm.note || undefined,
      };
      const r = await CashBanks.openSession(payload);
      toast.success("Sesión abierta correctamente");
      setOpenForm({ opening_amount: "", note: "" });
      setOpenDlg(false);
      
      // Recargar todo y seleccionar la nueva sesión
      await loadSessions();
      if (r?.id) setCurrentId(String(r.id));
      
    } catch (e) {
      showApiError(e, "No se pudo abrir la sesión");
    } finally {
      setBusyOpen(false);
    }
  };

  const closeSession = async () => {
    if (!current?.id) return;
    try {
      setBusyClose(true);
      const closingValue = closeForm.closing_amount === "" ? totals.balance : Number(closeForm.closing_amount);
      const payload = {
        closing_amount: Number.isFinite(closingValue) ? closingValue : totals.balance,
        note: closeForm.note || undefined,
      };
      await CashBanks.closeSession(current.id, payload);
      toast.success("Sesión cerrada correctamente");
      setCloseForm({ closing_amount: "", note: "" });
      setCloseDlg(false);
      await loadSessions();
      // No borramos movs, dejamos que se recarguen con estado cerrado
    } catch (e) {
      showApiError(e, "No se pudo cerrar la sesión");
    } finally {
      setBusyClose(false);
    }
  };

  const addMovement = async () => {
    if (!current?.id) return toast.error("Error: Sesión no válida");
    
    const amountNum = parseFloat(newMov.amount);
    const conceptVal = newMov.concept?.trim();

    if (!amountNum || isNaN(amountNum) || amountNum <= 0) {
        return toast.error("Ingresa un monto válido");
    }
    if (!conceptVal) {
        return toast.error("Ingresa un concepto");
    }

    try {
      setBusyMov(true);
      
      // 1. Enviar al Backend (Esperamos a que el servidor confirme)
      await CashBanks.addMovement(current.id, {
        type: newMov.type, // "IN" o "OUT"
        amount: Number(amountNum), 
        concept: conceptVal,
      });

      toast.success("Movimiento registrado");

      // 2. Limpiar formulario
      setNewMov({ type: "IN", amount: "", concept: "" });

      // 3. RECARGA OBLIGATORIA (Sin timeout para asegurar datos reales)
      await loadMovs();     // Actualiza la tabla
      await loadSessions(); // Actualiza los saldos generales

    } catch (e) {
      console.error("Error al guardar:", e);
      const msg = e.response?.data?.message || e.message || "Error interno";
      toast.error(`No se pudo guardar: ${msg}`);
    } finally {
      setBusyMov(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50/50 pb-10">

  {/* 1. CABECERA */}
  <div className="flex-none px-4 sm:px-6 py-4 border-b bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 shadow-sm">
    <div className="min-w-0">
      <h2 className="text-xl font-bold text-gray-800">Caja y Bancos</h2>
      <p className="text-xs text-gray-500">Gestión de flujo de efectivo</p>
    </div>

    <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-2 sm:items-center">
      <Button
        variant="outline"
        size="sm"
        onClick={() => { loadSessions(); loadMovs(); }}
        className="h-9 w-full sm:w-auto"
      >
        <RefreshCw className="h-3.5 w-3.5 mr-2" /> Actualizar
      </Button>

      <Button
        size="sm"
        onClick={() => setOpenDlg(true)}
        className="h-9 w-full sm:w-auto"
      >
        <Plus className="h-3.5 w-3.5 mr-2" /> Abrir
      </Button>

      {statusMeta.code === "OPEN" && (
        <Button
          size="sm"
          onClick={() => setCloseDlg(true)}
          variant="destructive"
          className="h-9 w-full sm:w-auto"
        >
          <Save className="h-3.5 w-3.5 mr-2" /> Cerrar
        </Button>
      )}
    </div>
  </div>

  {/* 2. CONTENIDO PRINCIPAL */}
  <div className="p-4 sm:p-6 space-y-5">

    {/* Panel de Control y Totales */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-1 shadow-sm bg-white">
        <CardHeader className="pb-2 py-3 px-4">
          <CardTitle className="text-sm font-medium text-gray-500">Sesión Actual</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <Select value={currentId ? String(currentId) : undefined} onValueChange={setCurrentId}>
            <SelectTrigger className="w-full font-medium">
              <SelectValue placeholder="Seleccionar..." />
            </SelectTrigger>
            <SelectContent>
              {sessions.map((s) => optVal(s.id) && (
                <SelectItem key={s.id} value={String(s.id)}>
                  #{s.id} · {toLimaDateTime(s.opened_at).split(",")[0]} ({normStatus(s.status).label})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="mt-3 flex items-center justify-between">
            <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
            <span className="text-xs text-gray-400">
              {current ? toLimaDateTime(current.opened_at).split(",")[1] : ""}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Totales */}
      {current && (
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="bg-white shadow-sm">
            <CardContent className="p-4 flex flex-col justify-center h-full">
              <span className="text-xs font-bold text-gray-500 uppercase">Ingresos</span>
              <span className="text-xl font-bold text-green-600">{fmtCurrency(totals.ins)}</span>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-sm">
            <CardContent className="p-4 flex flex-col justify-center h-full">
              <span className="text-xs font-bold text-gray-500 uppercase">Egresos</span>
              <span className="text-xl font-bold text-red-600">{fmtCurrency(totals.outs)}</span>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-sm ring-1 ring-blue-100">
            <CardContent className="p-4 flex flex-col justify-center h-full">
              <span className="text-xs font-bold text-blue-600 uppercase">Saldo Caja</span>
              <span className="text-2xl font-black text-blue-800">{fmtCurrency(totals.balance)}</span>
            </CardContent>
          </Card>
        </div>
      )}
    </div>

    {/* Formulario */}
    {statusMeta.code === "OPEN" && current && (
      <Card className="border-l-4 border-l-blue-600 shadow-sm bg-white">
        <CardContent className="p-4 flex flex-col md:flex-row gap-3 items-end">
          <div className="w-full md:w-32">
            <Label className="text-xs mb-1.5 block">Tipo</Label>
            <Select value={newMov.type} onValueChange={(v) => setNewMov({ ...newMov, type: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="IN">
                  <span className="text-green-600 font-bold">Ingreso (+)</span>
                </SelectItem>
                <SelectItem value="OUT">
                  <span className="text-red-600 font-bold">Egreso (-)</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-full md:w-40">
            <Label className="text-xs mb-1.5 block">Monto</Label>
            <Input
              type="number"
              className="font-bold text-right"
              placeholder="0.00"
              value={newMov.amount}
              onChange={(e) => setNewMov({ ...newMov, amount: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && addMovement()}
            />
          </div>

          <div className="w-full flex-1">
            <Label className="text-xs mb-1.5 block">Concepto</Label>
            <Input
              placeholder="Descripción de la operación..."
              value={newMov.concept}
              onChange={(e) => setNewMov({ ...newMov, concept: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && addMovement()}
            />
          </div>

          <Button
            className="w-full md:w-auto min-w-[100px] bg-blue-600 hover:bg-blue-700"
            onClick={addMovement}
            disabled={busyMov}
          >
            {busyMov ? <Loader2 className="animate-spin h-4 w-4" /> : "Guardar"}
          </Button>
        </CardContent>
      </Card>
    )}

    {/* --- TABLA RESPONSIVE (scroll horizontal + alto móvil) --- */}
    <Card className="shadow-sm border border-gray-200 bg-white mt-4 flex flex-col">
      <div className="px-4 py-3 border-b flex justify-between items-center bg-gray-50">
        <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
          Movimientos ({movs.length})
        </span>
        <Badge variant="secondary" className="bg-white border text-gray-600 shadow-sm">
          Historial
        </Badge>
      </div>

      <div className="w-full overflow-x-auto">
        <div className="w-full max-h-[55vh] sm:max-h-[400px] overflow-y-auto relative border-b rounded-b-lg bg-white">
          <table className="w-full min-w-[720px] text-sm text-left border-collapse">
            <thead className="text-xs text-gray-500 uppercase bg-gray-100 sticky top-0 z-20 shadow-sm ring-1 ring-gray-200/50">
              <tr>
                <th className="px-4 py-3 font-semibold w-24 bg-gray-100 border-b">Hora</th>
                <th className="px-4 py-3 font-semibold w-24 bg-gray-100 border-b">Tipo</th>
                <th className="px-4 py-3 font-semibold bg-gray-100 border-b">Concepto</th>
                <th className="px-4 py-3 font-semibold text-right w-32 bg-gray-100 border-b">Monto</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 bg-white">
              {movs.map((m, index) => {
                const tmeta = normType(m.type);
                let timeStr = "-";
                try {
                  timeStr = toLimaDateTime(m.date).split(" ")[1];
                } catch (e) {
                  timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                }

                return (
                  <tr key={m.id || index} className="hover:bg-blue-50/40 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-500 font-mono text-xs border-r border-transparent">
                      {timeStr}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-2 py-0.5 border ${
                          tmeta.code === "IN"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        }`}
                      >
                        {tmeta.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-700 font-medium">
                      {safeText(m.concept)}
                    </td>
                    <td className={`px-4 py-3 text-right font-bold whitespace-nowrap ${tmeta.code === "IN" ? "text-emerald-600" : "text-rose-600"}`}>
                      {tmeta.code === "IN" ? "+" : "-"} {fmtCurrency(m.amount)}
                    </td>
                  </tr>
                );
              })}

              {movs.length === 0 && (
                <tr>
                  <td colSpan={4} className="h-40 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className="text-sm italic">Sin movimientos registrados</span>
                    </div>
                  </td>
                </tr>
              )}

              {movs.length > 0 && <tr className="h-8 bg-transparent border-none"></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  </div>

      {/* MODALES */}
      <Dialog open={openDlg} onOpenChange={(v) => !busyOpen && setOpenDlg(v)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Abrir Caja</DialogTitle></DialogHeader>
          <div className="py-2 space-y-3">
             <div className="grid gap-1.5"><Label>Monto Inicial</Label><Input type="number" step="0.01" value={openForm.opening_amount} onChange={e=>setOpenForm({...openForm, opening_amount: e.target.value})} /></div>
             <div className="grid gap-1.5"><Label>Nota</Label><Input value={openForm.note} onChange={e=>setOpenForm({...openForm, note: e.target.value})} /></div>
          </div>
          <DialogFooter><Button onClick={openSession} disabled={busyOpen}>Abrir Turno</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={closeDlg} onOpenChange={(v) => !busyClose && setCloseDlg(v)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cerrar Caja</DialogTitle></DialogHeader>
          <div className="py-2 space-y-4">
            <div className="bg-slate-100 p-3 rounded text-center border border-slate-200">
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Saldo Calculado</div>
                <div className="text-2xl font-bold text-slate-800">{fmtCurrency(totals.balance)}</div>
            </div>
            <div className="grid gap-1.5">
                <Label>Efectivo Real (Arqueo)</Label>
                <Input type="number" step="0.01" placeholder={String(totals.balance)} value={closeForm.closing_amount} onChange={e=>setCloseForm({...closeForm, closing_amount: e.target.value})} />
            </div>
            <div className="grid gap-1.5"><Label>Observaciones</Label><Input value={closeForm.note} onChange={e=>setCloseForm({...closeForm, note: e.target.value})} /></div>
          </div>
          <DialogFooter><Button variant="destructive" onClick={closeSession} disabled={busyClose}>Cerrar Turno</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}