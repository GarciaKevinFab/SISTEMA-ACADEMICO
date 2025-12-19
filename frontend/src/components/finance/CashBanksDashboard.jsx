// src/modules/finance/CashBanksDashboard.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CashBanks } from "../../services/finance.service";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Badge } from "../../components/ui/badge";

// ✅ Dialog (shadcn)
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription as DialogDesc,
  DialogFooter,
} from "../../components/ui/dialog";

import { toast } from "../../utils/safeToast";
import { Plus, Save, RefreshCw, X } from "lucide-react";

import { fmtCurrency, formatApiError, toLimaDateTime } from "../../utils/format";
import { clampVariant, optVal, safeText } from "../../utils/ui";

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

  // dialogs
  const [openDlg, setOpenDlg] = useState(false);
  const [closeDlg, setCloseDlg] = useState(false);

  // forms
  const [openForm, setOpenForm] = useState({ opening_amount: "", note: "" });
  const [closeForm, setCloseForm] = useState({ closing_amount: "", note: "" });

  const [newMov, setNewMov] = useState({ type: "IN", amount: "", concept: "" });

  // busy flags
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

      // selecciona sesión OPEN si existe
      const open = list.find((s) => normStatus(s.status).code === "OPEN" && optVal(s.id));
      const firstValid = list.find((s) => optVal(s.id));
      const initial = open?.id ?? firstValid?.id;

      setCurrentId(initial != null ? String(initial) : undefined);

      // si no hay ninguna sesión, abre el modal automáticamente
      if (!initial) setOpenDlg(true);
    } catch (e) {
      if (alive) showApiError(e, "No se pudieron cargar las sesiones");
    } finally {
      if (alive) setLoading(false);
    }
    return () => {
      alive = false;
    };
  }, []);

  const loadMovs = useCallback(async () => {
    if (!currentId) return;
    const myId = currentId;
    try {
      const d = await CashBanks.movements(myId);
      setMovs((prev) => (currentId === myId ? (d?.items ?? d ?? []) : prev));
    } catch (e) {
      showApiError(e, "No se pudieron cargar los movimientos");
    }
  }, [currentId]);

  useEffect(() => {
    let cleanup;
    (async () => {
      cleanup = await loadSessions();
    })();
    return () => {
      if (typeof cleanup === "function") cleanup();
    };
  }, [loadSessions]);

  useEffect(() => {
    loadMovs();
  }, [loadMovs]);

  const openSession = async () => {
    try {
      setBusyOpen(true);
      const payload = {
        opening_amount: Number(openForm.opening_amount || 0),
        note: openForm.note || undefined,
      };

      const r = await CashBanks.openSession(payload);
      toast.success("Sesión abierta");

      setOpenForm({ opening_amount: "", note: "" });
      setOpenDlg(false);

      await loadSessions();
      if (r?.id) setCurrentId(String(r.id));
    } catch (e) {
      showApiError(e, "No se pudo abrir la sesión");
    } finally {
      setBusyOpen(false);
    }
  };

  const closeSession = async () => {
    if (!current?.id) return toast.error("No hay sesión seleccionada");
    try {
      setBusyClose(true);

      const closingValue =
        closeForm.closing_amount === "" ? totals.balance : Number(closeForm.closing_amount);

      const payload = {
        closing_amount: Number.isFinite(closingValue) ? closingValue : totals.balance,
        note: closeForm.note || undefined,
      };

      await CashBanks.closeSession(current.id, payload);
      toast.success("Sesión cerrada");

      setCloseForm({ closing_amount: "", note: "" });
      setCloseDlg(false);

      await loadSessions();
      setMovs([]);
    } catch (e) {
      showApiError(e, "No se pudo cerrar la sesión");
    } finally {
      setBusyClose(false);
    }
  };

  const addMovement = async () => {
    if (!current?.id) return toast.error("Selecciona una sesión");
    const amountNum = Number(newMov.amount);
    if (!newMov.amount || isNaN(amountNum) || amountNum <= 0) return toast.error("Ingrese un monto válido");

    try {
      setBusyMov(true);
      await CashBanks.addMovement(current.id, {
        type: newMov.type,
        amount: amountNum,
        concept: newMov.concept || undefined,
      });
      toast.success("Movimiento registrado");
      setNewMov({ type: "IN", amount: "", concept: "" });
      await loadMovs();
    } catch (e) {
      showApiError(e, "No se pudo registrar el movimiento");
    } finally {
      setBusyMov(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40" aria-busy="true">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-2xl font-bold">Caja y Bancos</h2>
          <p className="text-sm text-gray-600">Sesión de caja, movimientos y cierre</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadSessions}>
            <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
            Actualizar
          </Button>

          <Button onClick={() => setOpenDlg(true)} variant="default">
            <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
            Abrir caja
          </Button>

          {statusMeta.code === "OPEN" && (
            <Button onClick={() => setCloseDlg(true)} variant="destructive">
              <Save className="h-4 w-4 mr-2" aria-hidden="true" />
              Cerrar caja
            </Button>
          )}
        </div>
      </div>

      {/* Sesión actual */}
      <Card>
        <CardHeader>
          <CardTitle>Sesión</CardTitle>
          <CardDescription>Selecciona la sesión activa</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <Label>Sesión</Label>
            <Select value={currentId ? String(currentId) : undefined} onValueChange={(v) => setCurrentId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {sessions.map((s) => {
                  const v = optVal(s.id);
                  if (!v) return null;
                  return (
                    <SelectItem key={v} value={v}>
                      #{String(s.id)} — {s.opened_at ? toLimaDateTime(s.opened_at) : "Sin fecha"}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {current && (
            <div className="md:col-span-4 grid md:grid-cols-4 gap-3">
              <div className="p-3 rounded bg-gray-50">
                <div className="text-xs text-gray-500">Estado</div>
                <div className="mt-1">
                  <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                </div>
              </div>
              <div className="p-3 rounded bg-gray-50">
                <div className="text-xs text-gray-500">Apertura</div>
                <div className="text-lg font-semibold">{fmtCurrency(current.opening_amount)}</div>
              </div>
              <div className="p-3 rounded bg-gray-50">
                <div className="text-xs text-gray-500">Ingresos</div>
                <div className="text-lg font-semibold">{fmtCurrency(totals.ins)}</div>
              </div>
              <div className="p-3 rounded bg-gray-50">
                <div className="text-xs text-gray-500">Egresos</div>
                <div className="text-lg font-semibold">{fmtCurrency(totals.outs)}</div>
              </div>
              <div className="p-3 rounded bg-gray-50 md:col-span-4">
                <div className="text-xs text-gray-500">Saldo</div>
                <div className="text-2xl font-bold">{fmtCurrency(totals.balance)}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Nuevo movimiento */}
      {statusMeta.code === "OPEN" && current && (
        <Card>
          <CardHeader>
            <CardTitle>Nuevo movimiento</CardTitle>
            <CardDescription>Registra ingresos o egresos</CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-4 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={newMov.type} onValueChange={(v) => setNewMov({ ...newMov, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IN">{TYPE_CFG.IN.label}</SelectItem>
                  <SelectItem value="OUT">{TYPE_CFG.OUT.label}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Monto</Label>
              <Input
                type="number"
                step="0.01"
                value={newMov.amount}
                onChange={(e) => setNewMov({ ...newMov, amount: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <Label>Concepto</Label>
              <Input
                value={newMov.concept}
                onChange={(e) => setNewMov({ ...newMov, concept: e.target.value })}
                placeholder="Ej. Depósito, arqueo, etc."
              />
            </div>
            <div className="md:col-span-4 flex justify-end">
              <Button onClick={addMovement} disabled={busyMov}>
                <Save className="h-4 w-4 mr-2" aria-hidden="true" />
                {busyMov ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Movimientos */}
      <Card>
        <CardHeader>
          <CardTitle>Movimientos</CardTitle>
          <CardDescription>Detalle de la sesión</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!current ? (
            <div className="p-6 text-center text-gray-500">Selecciona o crea una sesión</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold">Fecha</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold">Tipo</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold">Concepto</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {movs.map((m) => {
                    const tmeta = normType(m.type);
                    return (
                      <tr key={m.id}>
                        <td className="px-4 py-2 text-sm text-gray-600">{toLimaDateTime(m.date)}</td>
                        <td className="px-4 py-2">
                          <Badge variant={tmeta.variant}>{tmeta.label}</Badge>
                        </td>
                        <td className="px-4 py-2">{safeText(m.concept)}</td>
                        <td className="px-4 py-2 text-right">{fmtCurrency(m.amount)}</td>
                      </tr>
                    );
                  })}
                  {movs.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-gray-500">
                        Sin movimientos.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL: Abrir Caja */}
      <Dialog open={openDlg} onOpenChange={(v) => !busyOpen && setOpenDlg(v)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Abrir caja</DialogTitle>
            <DialogDesc>Registra el monto inicial y una nota opcional.</DialogDesc>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label>Monto de apertura (S/)</Label>
              <Input
                type="number"
                step="0.01"
                value={openForm.opening_amount}
                onChange={(e) => setOpenForm({ ...openForm, opening_amount: e.target.value })}
                placeholder="0.00"
              />
            </div>

            <div className="grid gap-2">
              <Label>Nota</Label>
              <Input
                value={openForm.note}
                onChange={(e) => setOpenForm({ ...openForm, note: e.target.value })}
                placeholder="Ej. Apertura turno mañana"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpenDlg(false)} disabled={busyOpen}>
              <X className="h-4 w-4 mr-2" aria-hidden="true" />
              Cancelar
            </Button>
            <Button onClick={openSession} disabled={busyOpen}>
              <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
              {busyOpen ? "Abriendo..." : "Abrir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: Cerrar Caja */}
      <Dialog open={closeDlg} onOpenChange={(v) => !busyClose && setCloseDlg(v)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Cerrar caja</DialogTitle>
            <DialogDesc>
              Saldo sugerido: <span className="font-semibold">{fmtCurrency(totals.balance)}</span>
            </DialogDesc>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label>Saldo de cierre (S/)</Label>
              <Input
                type="number"
                step="0.01"
                value={closeForm.closing_amount}
                onChange={(e) => setCloseForm({ ...closeForm, closing_amount: e.target.value })}
                placeholder={String(totals.balance.toFixed(2))}
              />
              <p className="text-xs text-gray-500">
                Si lo dejas vacío, se usa el saldo sugerido automáticamente.
              </p>
            </div>

            <div className="grid gap-2">
              <Label>Nota</Label>
              <Input
                value={closeForm.note}
                onChange={(e) => setCloseForm({ ...closeForm, note: e.target.value })}
                placeholder="Ej. Cierre con arqueo OK"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCloseDlg(false)} disabled={busyClose}>
              <X className="h-4 w-4 mr-2" aria-hidden="true" />
              Cancelar
            </Button>
            <Button variant="destructive" onClick={closeSession} disabled={busyClose}>
              <Save className="h-4 w-4 mr-2" aria-hidden="true" />
              {busyClose ? "Cerrando..." : "Cerrar caja"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
