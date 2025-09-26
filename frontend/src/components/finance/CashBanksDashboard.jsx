// src/components/finance/CashBanksDashboard.jsx
import React, { useState, useEffect, useContext } from "react";
import { AuthContext } from "../../context/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Badge } from "../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
// ✅ Usa el wrapper seguro (evita pasar objetos a React Child)
import { toast } from "../../utils/safeToast";
import {
  Plus,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  Upload,
} from "lucide-react";

// helper: backend base (CRA o Vite)
const getBackendBase = () => {
  // 1) CRA / react-scripts
  if (typeof process !== "undefined" && process.env && process.env.REACT_APP_BACKEND_URL) {
    return process.env.REACT_APP_BACKEND_URL;
  }
  // 2) Opción de runtime global (si quieres ponerlo en index.html)
  if (typeof window !== "undefined" && window.__BACKEND_URL__) {
    return window.__BACKEND_URL__;
  }
  // 3) Fallback vacío
  return "";
};

const backendBase = getBackendBase();

const CashBanksDashboard = () => {
  const { user } = useContext(AuthContext);

  const [currentSession, setCurrentSession] = useState(null);
  const [cashMovements, setCashMovements] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialogs, setOpenDialogs] = useState({
    newMovement: false,
    closeSession: false,
    newBankAccount: false,
    reconciliation: false,
  });

  const [newMovement, setNewMovement] = useState({
    movement_type: "INCOME",
    amount: "",
    concept: "",
    description: "",
    cost_center: "",
  });

  const [sessionClose, setSessionClose] = useState({
    final_amount: "",
    closing_notes: "",
  });

  const [newBankAccount, setNewBankAccount] = useState({
    account_name: "",
    bank_name: "",
    account_number: "",
    account_type: "CHECKING",
    currency: "PEN",
  });

  useEffect(() => {
    fetchCurrentSession();
    fetchBankAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const authHeaders = () => {
    const token = localStorage.getItem("token");
    return {
      Authorization: token ? `Bearer ${token}` : "",
      "Content-Type": "application/json",
    };
  };

  const fetchCurrentSession = async () => {
    try {
      const res = await fetch(`${backendBase}/api/finance/cash-sessions/current`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentSession(data.session || null);
        setCashMovements(Array.isArray(data.movements) ? data.movements : []);
      } else {
        // opcional: leer body
        toast.error("No se pudo cargar la sesión actual");
      }
    } catch (e) {
      console.error("Error fetching current session:", e);
      toast.error("Error de conexión al cargar la sesión");
    } finally {
      setLoading(false);
    }
  };

  const fetchBankAccounts = async () => {
    try {
      const res = await fetch(`${backendBase}/api/finance/bank-accounts`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setBankAccounts(Array.isArray(data.accounts) ? data.accounts : []);
      }
    } catch (e) {
      console.error("Error fetching bank accounts:", e);
      // no reventamos UI por esto
    }
  };

  const openCashSession = async () => {
    const initialAmount = prompt("Ingrese el monto inicial de caja:");
    if (initialAmount == null || initialAmount === "") return;
    const amt = Number(initialAmount);
    if (!isFinite(amt) || amt < 0) {
      toast.error("Monto inicial inválido");
      return;
    }

    try {
      const res = await fetch(`${backendBase}/api/finance/cash-sessions`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          initial_amount: amt,
          cashier_notes: "Sesión abierta desde dashboard",
        }),
      });

      if (res.ok) {
        toast.success("Sesión de caja abierta correctamente");
        fetchCurrentSession();
      } else {
        const err = await safeJson(res);
        toast.error(err?.detail || "No se pudo abrir la sesión");
      }
    } catch (e) {
      console.error("Error opening cash session:", e);
      toast.error("Error de conexión");
    }
  };

  const createCashMovement = async () => {
    if (!currentSession) {
      toast.error("No hay una sesión de caja abierta");
      return;
    }
    const amountNum = Number(newMovement.amount);
    if (!isFinite(amountNum) || amountNum <= 0 || !newMovement.concept.trim()) {
      toast.error("Complete tipo, concepto y un monto válido");
      return;
    }

    try {
      const res = await fetch(`${backendBase}/api/finance/cash-movements`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          ...newMovement,
          cash_session_id: currentSession.id,
          amount: amountNum,
        }),
      });

      if (res.ok) {
        toast.success("Movimiento registrado correctamente");
        setOpenDialogs((s) => ({ ...s, newMovement: false }));
        setNewMovement({
          movement_type: "INCOME",
          amount: "",
          concept: "",
          description: "",
          cost_center: "",
        });
        fetchCurrentSession();
      } else {
        const err = await safeJson(res);
        toast.error(err?.detail || "No se pudo registrar el movimiento");
      }
    } catch (e) {
      console.error("Error creating cash movement:", e);
      toast.error("Error de conexión");
    }
  };

  const closeCashSession = async () => {
    if (!currentSession) return;
    const finalNum = Number(sessionClose.final_amount);
    if (!isFinite(finalNum)) {
      toast.error("Ingrese un monto de cierre válido");
      return;
    }

    try {
      // si tu backend acepta POST con query, ok; si no, cambia a body JSON
      const url = `${backendBase}/api/finance/cash-sessions/${currentSession.id}/close?final_amount=${encodeURIComponent(
        String(finalNum)
      )}&closing_notes=${encodeURIComponent(sessionClose.closing_notes || "")}`;

      const res = await fetch(url, {
        method: "POST",
        headers: authHeaders(),
      });

      if (res.ok) {
        toast.success("Sesión de caja cerrada correctamente");
        setOpenDialogs((s) => ({ ...s, closeSession: false }));
        setCurrentSession(null);
        setCashMovements([]);
        setSessionClose({ final_amount: "", closing_notes: "" });
      } else {
        const err = await safeJson(res);
        toast.error(err?.detail || "No se pudo cerrar la sesión");
      }
    } catch (e) {
      console.error("Error closing cash session:", e);
      toast.error("Error de conexión");
    }
  };

  const createBankAccount = async () => {
    if (
      !newBankAccount.account_name.trim() ||
      !newBankAccount.bank_name.trim() ||
      !newBankAccount.account_number.trim()
    ) {
      toast.error("Completa nombre, banco y número de cuenta");
      return;
    }

    try {
      const res = await fetch(`${backendBase}/api/finance/bank-accounts`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(newBankAccount),
      });

      if (res.ok) {
        toast.success("Cuenta bancaria creada correctamente");
        setOpenDialogs((s) => ({ ...s, newBankAccount: false }));
        setNewBankAccount({
          account_name: "",
          bank_name: "",
          account_number: "",
          account_type: "CHECKING",
          currency: "PEN",
        });
        fetchBankAccounts();
      } else {
        const err = await safeJson(res);
        toast.error(err?.detail || "No se pudo crear la cuenta");
      }
    } catch (e) {
      console.error("Error creating bank account:", e);
      toast.error("Error de conexión");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const fmt = (n) => (isFinite(Number(n)) ? Number(n).toFixed(2) : "0.00");

  return (
    <div className="space-y-6">
      {/* Cash Session Status */}
      <Card className={`border-l-4 ${currentSession ? "border-l-green-500" : "border-l-gray-400"}`}>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5" />
              <span>Estado de Caja</span>
            </CardTitle>
            <CardDescription>{currentSession ? "Sesión activa" : "Sin sesión activa"}</CardDescription>
          </div>
          <div className="flex space-x-2">
            {!currentSession ? (
              <Button onClick={openCashSession}>Abrir Caja</Button>
            ) : (
              <Dialog
                open={openDialogs.closeSession}
                onOpenChange={(open) => setOpenDialogs((s) => ({ ...s, closeSession: open }))}
              >
                <DialogTrigger asChild>
                  <Button variant="outline">Cerrar Caja</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Cerrar Sesión de Caja</DialogTitle>
                    <DialogDescription>Ingrese el monto físico contado para el arqueo de caja</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Monto Esperado: S/. {fmt(currentSession?.expected_final_amount)}</Label>
                    </div>
                    <div>
                      <Label htmlFor="final_amount">Monto Físico Contado *</Label>
                      <Input
                        id="final_amount"
                        type="number"
                        step="0.01"
                        value={sessionClose.final_amount}
                        onChange={(e) => setSessionClose((s) => ({ ...s, final_amount: e.target.value }))}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="closing_notes">Observaciones</Label>
                      <Textarea
                        id="closing_notes"
                        value={sessionClose.closing_notes}
                        onChange={(e) => setSessionClose((s) => ({ ...s, closing_notes: e.target.value }))}
                        placeholder="Observaciones del arqueo de caja..."
                      />
                    </div>
                    {sessionClose.final_amount && isFinite(Number(sessionClose.final_amount)) && (
                      <div className="p-3 bg-yellow-50 rounded-lg">
                        <p className="text-sm font-medium">
                          Diferencia: S/.{" "}
                          {(
                            Number(sessionClose.final_amount) - Number(currentSession?.expected_final_amount || 0)
                          ).toFixed(2)}
                        </p>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button onClick={closeCashSession} disabled={!sessionClose.final_amount}>
                      Cerrar Sesión
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        {currentSession && (
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600">Sesión</p>
                <p className="font-semibold">{currentSession.session_number}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Monto Inicial</p>
                <p className="font-semibold">S/. {fmt(currentSession.initial_amount)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Ingresos</p>
                <p className="font-semibold text-green-600">S/. {fmt(currentSession.total_income)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Saldo Esperado</p>
                <p className="font-semibold">S/. {fmt(currentSession.expected_final_amount)}</p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      <Tabs defaultValue="movements">
        <TabsList>
          <TabsTrigger value="movements">Movimientos de Caja</TabsTrigger>
          <TabsTrigger value="banks">Cuentas Bancarias</TabsTrigger>
          <TabsTrigger value="reconciliation">Conciliación</TabsTrigger>
        </TabsList>

        <TabsContent value="movements">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Movimientos de Caja</CardTitle>
                <CardDescription>Registro de ingresos y egresos</CardDescription>
              </div>
              <Dialog
                open={openDialogs.newMovement}
                onOpenChange={(open) => setOpenDialogs((s) => ({ ...s, newMovement: open }))}
              >
                <DialogTrigger asChild>
                  <Button disabled={!currentSession}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nuevo Movimiento
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Registrar Movimiento</DialogTitle>
                    <DialogDescription>Registre un ingreso o egreso de caja</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="movement_type">Tipo de Movimiento *</Label>
                      <Select
                        value={newMovement.movement_type}
                        onValueChange={(value) => setNewMovement((s) => ({ ...s, movement_type: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="INCOME">Ingreso</SelectItem>
                          <SelectItem value="EXPENSE">Egreso</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="amount">Monto *</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        value={newMovement.amount}
                        onChange={(e) => setNewMovement((s) => ({ ...s, amount: e.target.value }))}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="concept">Concepto *</Label>
                      <Input
                        id="concept"
                        value={newMovement.concept}
                        onChange={(e) => setNewMovement((s) => ({ ...s, concept: e.target.value }))}
                        placeholder="Concepto del movimiento"
                      />
                    </div>
                    <div>
                      <Label htmlFor="description">Descripción</Label>
                      <Textarea
                        id="description"
                        value={newMovement.description}
                        onChange={(e) => setNewMovement((s) => ({ ...s, description: e.target.value }))}
                        placeholder="Descripción detallada..."
                      />
                    </div>
                    <div>
                      <Label htmlFor="cost_center">Centro de Costo</Label>
                      <Input
                        id="cost_center"
                        value={newMovement.cost_center}
                        onChange={(e) => setNewMovement((s) => ({ ...s, cost_center: e.target.value }))}
                        placeholder="CC001"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={createCashMovement} disabled={!newMovement.amount || !newMovement.concept}>
                      Registrar Movimiento
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {cashMovements.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No hay movimientos registrados</div>
                ) : (
                  cashMovements.map((movement, index) => {
                    const amt = fmt(movement?.amount);
                    return (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          {movement.movement_type === "INCOME" ? (
                            <TrendingUp className="h-5 w-5 text-green-500" />
                          ) : (
                            <TrendingDown className="h-5 w-5 text-red-500" />
                          )}
                          <div>
                            <p className="font-medium">{movement.concept}</p>
                            <p className="text-sm text-gray-600">{movement.description}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p
                            className={`font-semibold ${movement.movement_type === "INCOME" ? "text-green-600" : "text-red-600"
                              }`}
                          >
                            {movement.movement_type === "INCOME" ? "+" : "-"}S/. {amt}
                          </p>
                          <p className="text-xs text-gray-500">{movement.movement_number}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="banks">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Cuentas Bancarias</CardTitle>
                <CardDescription>Gestión de cuentas bancarias</CardDescription>
              </div>
              <Dialog
                open={openDialogs.newBankAccount}
                onOpenChange={(open) => setOpenDialogs((s) => ({ ...s, newBankAccount: open }))}
              >
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Nueva Cuenta
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Registrar Cuenta Bancaria</DialogTitle>
                    <DialogDescription>Agregue una nueva cuenta bancaria</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="account_name">Nombre de Cuenta *</Label>
                      <Input
                        id="account_name"
                        value={newBankAccount.account_name}
                        onChange={(e) => setNewBankAccount((s) => ({ ...s, account_name: e.target.value }))}
                        placeholder="Cuenta Corriente Principal"
                      />
                    </div>
                    <div>
                      <Label htmlFor="bank_name">Banco *</Label>
                      <Input
                        id="bank_name"
                        value={newBankAccount.bank_name}
                        onChange={(e) => setNewBankAccount((s) => ({ ...s, bank_name: e.target.value }))}
                        placeholder="Banco de la Nación"
                      />
                    </div>
                    <div>
                      <Label htmlFor="account_number">Número de Cuenta *</Label>
                      <Input
                        id="account_number"
                        value={newBankAccount.account_number}
                        onChange={(e) => setNewBankAccount((s) => ({ ...s, account_number: e.target.value }))}
                        placeholder="00123456789012345678"
                      />
                    </div>
                    <div>
                      <Label htmlFor="account_type">Tipo de Cuenta *</Label>
                      <Select
                        value={newBankAccount.account_type}
                        onValueChange={(value) => setNewBankAccount((s) => ({ ...s, account_type: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CHECKING">Corriente</SelectItem>
                          <SelectItem value="SAVINGS">Ahorros</SelectItem>
                          <SelectItem value="CTS">CTS</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="currency">Moneda</Label>
                      <Select
                        value={newBankAccount.currency}
                        onValueChange={(value) => setNewBankAccount((s) => ({ ...s, currency: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PEN">Soles (S/.)</SelectItem>
                          <SelectItem value="USD">Dólares ($)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={createBankAccount}
                      disabled={
                        !newBankAccount.account_name || !newBankAccount.bank_name || !newBankAccount.account_number
                      }
                    >
                      Crear Cuenta
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {bankAccounts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No hay cuentas bancarias registradas</div>
                ) : (
                  bankAccounts.map((account, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <DollarSign className="h-8 w-8 text-blue-500" />
                        <div>
                          <p className="font-semibold">{account.account_name}</p>
                          <p className="text-sm text-gray-600">{account.bank_name}</p>
                          <p className="text-xs text-gray-500">**** {String(account.account_number || "").slice(-4)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={account.is_active ? "default" : "secondary"}>
                          {account.is_active ? "Activa" : "Inactiva"}
                        </Badge>
                        <p className="text-sm text-gray-600 mt-1">{account.account_type}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reconciliation">
          <Card>
            <CardHeader>
              <CardTitle>Conciliación Bancaria</CardTitle>
              <CardDescription>Subir extractos bancarios para conciliación</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Subir Extracto Bancario</h3>
                <p className="text-gray-600 mb-4">Sube archivos CSV o Excel con los movimientos bancarios</p>
                <Button variant="outline">
                  <Upload className="h-4 w-4 mr-2" />
                  Seleccionar Archivo
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// util para leer json sin romper si no hay body json
async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export default CashBanksDashboard;
