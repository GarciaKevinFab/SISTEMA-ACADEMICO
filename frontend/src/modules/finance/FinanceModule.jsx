// src/modules/finance/FinanceModule.jsx
import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import CashBanksDashboard from "../../components/finance/CashBanksDashboard";
import ReceiptsDashboard from "../../components/finance/ReceiptsDashboard";
import InventoryDashboard from "../../components/finance/InventoryDashboard";
import LogisticsDashboard from "../../components/finance/LogisticsDashboard";
import HRDashboard from "../../components/finance/HRDashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Banknote, Receipt, Package, Truck, Users, BarChart3, AlertTriangle, TrendingUp, FileText, Coins } from "lucide-react";
import { toast } from "../../utils/safeToast";
import ConceptsCatalog from "./ConceptsCatalog";
import ReconciliationDashboard from "./ReconciliationDashboard";
import StudentAccountsDashboard from "./StudentAccountsDashboard";
import FinanceReports from "./FinanceReports";
import { fmtCurrency, formatApiError } from "../../utils/format";
import { PERMS } from "../../auth/permissions";

// ---- Helper seguro para toasts de error ----
const showApiError = (e, fallbackMsg) => {
  const err = formatApiError(e, fallbackMsg);
  if (typeof err === "string") toast.error(err);
  else toast.error(err.title ?? (fallbackMsg || "Error"), { description: err.description });
};

const FinanceModule = () => {
  const { user, api, hasAny } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [dashboardStats, setDashboardStats] = useState({});
  const [loading, setLoading] = useState(true);

  // ------- Permisos por funcionalidad -------
  const canCashBanks = hasAny([PERMS["fin.cashbanks.view"]]);
  const canReceipts = hasAny([PERMS["fin.cashbanks.view"]]);
  const canStdAccounts = hasAny([PERMS["fin.student.accounts.view"]]);
  const canConcepts = hasAny([PERMS["fin.concepts.manage"]]);
  const canReconcile = hasAny([PERMS["fin.reconciliation.view"]]);
  const canReports = hasAny([PERMS["fin.reports.view"]]);
  const canInventory = hasAny([PERMS["fin.inventory.view"]]);
  const canLogistics = hasAny([PERMS["fin.logistics.view"]]);
  const canHR = hasAny([PERMS["hr.view"]]);

  const roleLabel = (() => {
    if (hasAny([PERMS["fin.concepts.manage"], PERMS["fin.reports.view"], PERMS["fin.reconciliation.view"]])) return "Administrador Financiero";
    if (canCashBanks || canReceipts || canStdAccounts) return "Caja";
    if (canInventory) return "Almacén";
    if (canLogistics) return "Logística";
    if (canHR) return "RR.HH.";
    return "Usuario";
  })();

  const fetchDashboardStats = useCallback(async () => {
    let alive = true;
    try {
      setLoading(true);
      // ✅ IMPORTANTE: backend debe tener esta ruta (te la dejo abajo)
      const { data } = await api.get("/finance/dashboard/stats");
      if (alive) setDashboardStats(data?.stats ?? data ?? {});
    } catch (error) {
      if (alive) showApiError(error, "No se pudieron cargar las estadísticas");
    } finally {
      if (alive) setLoading(false);
    }
    return () => {
      alive = false;
    };
  }, [api]);

  useEffect(() => {
    let cleanup;
    (async () => {
      cleanup = await fetchDashboardStats();
    })();
    return () => {
      if (typeof cleanup === "function") cleanup();
    };
  }, [fetchDashboardStats]);

  const renderMainDashboard = () => {
    const cashToday = dashboardStats?.cash_today_amount;
    const monthlyIncome = dashboardStats?.monthly_income_amount;
    const monthlyDelta = dashboardStats?.monthly_income_change_pct;
    const lowStockAlerts = dashboardStats?.low_stock_alerts;
    const activeEmployees = dashboardStats?.active_employees;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {canCashBanks && (
            <Card className="border-l-4 border-l-green-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Caja del día</CardTitle>
                <Banknote className="h-4 w-4 text-green-600" aria-hidden="true" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{fmtCurrency(cashToday ?? 0)}</div>
                <p className="text-xs text-muted-foreground">Sesión actual abierta</p>
              </CardContent>
            </Card>
          )}

          {canReports && (
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ingresos del mes</CardTitle>
                <TrendingUp className="h-4 w-4 text-blue-600" aria-hidden="true" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{fmtCurrency(monthlyIncome ?? 0)}</div>
                <p className="text-xs text-muted-foreground">
                  {typeof monthlyDelta === "number" ? `${monthlyDelta > 0 ? "+" : ""}${monthlyDelta}% vs. mes anterior` : "—"}
                </p>
              </CardContent>
            </Card>
          )}

          {canInventory && (
            <Card className="border-l-4 border-l-orange-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Alertas de stock</CardTitle>
                <AlertTriangle className="h-4 w-4 text-orange-600" aria-hidden="true" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{Number.isFinite(lowStockAlerts) ? lowStockAlerts : 0}</div>
                <p className="text-xs text-muted-foreground">Ítems con stock bajo</p>
              </CardContent>
            </Card>
          )}

          {canHR && (
            <Card className="border-l-4 border-l-purple-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Personal activo</CardTitle>
                <Users className="h-4 w-4 text-purple-600" aria-hidden="true" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">{Number.isFinite(activeEmployees) ? activeEmployees : 0}</div>
                <p className="text-xs text-muted-foreground">Empleados registrados</p>
              </CardContent>
            </Card>
          )}
        </div>

        <Card aria-busy={loading}>
          <CardHeader>
            <CardTitle>Acciones rápidas</CardTitle>
            <CardDescription>Accede a las funciones principales</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {canCashBanks && (
                <Button
                  onClick={() => setActiveTab("cash-banks")}
                  className="h-20 flex flex-col items-center justify-center space-y-2"
                  variant="outline"
                >
                  <Banknote className="h-6 w-6" aria-hidden="true" />
                  <span className="text-sm">Caja y Bancos</span>
                </Button>
              )}
              {canReceipts && (
                <Button
                  onClick={() => setActiveTab("receipts")}
                  className="h-20 flex flex-col items-center justify-center space-y-2"
                  variant="outline"
                >
                  <Receipt className="h-6 w-6" aria-hidden="true" />
                  <span className="text-sm">Boletas</span>
                </Button>
              )}
              {canInventory && (
                <Button
                  onClick={() => setActiveTab("inventory")}
                  className="h-20 flex flex-col items-center justify-center space-y-2"
                  variant="outline"
                >
                  <Package className="h-6 w-6" aria-hidden="true" />
                  <span className="text-sm">Inventario</span>
                </Button>
              )}
              {canLogistics && (
                <Button
                  onClick={() => setActiveTab("logistics")}
                  className="h-20 flex flex-col items-center justify-center space-y-2"
                  variant="outline"
                >
                  <Truck className="h-6 w-6" aria-hidden="true" />
                  <span className="text-sm">Logística</span>
                </Button>
              )}
              {canHR && (
                <Button
                  onClick={() => setActiveTab("hr")}
                  className="h-20 flex flex-col items-center justify-center space-y-2"
                  variant="outline"
                >
                  <Users className="h-6 w-6" aria-hidden="true" />
                  <span className="text-sm">RRHH</span>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" aria-busy="true">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!user) return <div className="text-center py-12">Acceso no autorizado</div>;

  return (
    <div className="p-6">
      <div className="rounded-2xl p-[1px] bg-gradient-to-b from-slate-500/30 to-slate-900/10">
        <div className="rounded-2xl bg-slate-200/70 backdrop-blur-md border border-white/30 shadow-[0_10px_35px_rgba(0,0,0,0.18)]">
          <div className="px-6 pt-5">
            <h1 className="text-xl font-bold text-slate-900">Tesorería y Administración</h1>
            <p className="text-sm text-slate-700">Sistema integral — {roleLabel}</p>
            <div className="mt-3 h-px w-full bg-white/60" />
          </div>

          <div className="px-6 pb-6 pt-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <div className="rounded-xl bg-slate-100/80 border border-white/60 px-2 py-2">
                <TabsList className="w-full bg-transparent p-0 flex flex-wrap gap-2">
                  <TabsTrigger value="dashboard" className="rounded-lg text-slate-800 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    <span className="inline-flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" aria-hidden="true" />
                      Dashboard
                    </span>
                  </TabsTrigger>

                  {canCashBanks && (
                    <>
                      <TabsTrigger value="cash-banks" className="rounded-lg text-slate-800 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        <span className="inline-flex items-center gap-2">
                          <Banknote className="h-4 w-4" aria-hidden="true" />
                          Caja y Bancos
                        </span>
                      </TabsTrigger>

                      <TabsTrigger value="receipts" className="rounded-lg text-slate-800 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        <span className="inline-flex items-center gap-2">
                          <Receipt className="h-4 w-4" aria-hidden="true" />
                          Boletas
                        </span>
                      </TabsTrigger>
                    </>
                  )}

                  {canStdAccounts && (
                    <TabsTrigger value="student-accounts" className="rounded-lg text-slate-800 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                      <span className="inline-flex items-center gap-2">
                        <Coins className="h-4 w-4" aria-hidden="true" />
                        Estados de Cuenta
                      </span>
                    </TabsTrigger>
                  )}

                  {canConcepts && (
                    <TabsTrigger value="concepts" className="rounded-lg text-slate-800 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                      <span className="inline-flex items-center gap-2">
                        <FileText className="h-4 w-4" aria-hidden="true" />
                        Conceptos
                      </span>
                    </TabsTrigger>
                  )}

                  {canReconcile && (
                    <TabsTrigger value="reconciliation" className="rounded-lg text-slate-800 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                      <span className="inline-flex items-center gap-2">
                        <Banknote className="h-4 w-4" aria-hidden="true" />
                        Conciliación
                      </span>
                    </TabsTrigger>
                  )}

                  {canReports && (
                    <TabsTrigger value="reports" className="rounded-lg text-slate-800 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                      <span className="inline-flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" aria-hidden="true" />
                        Reportes
                      </span>
                    </TabsTrigger>
                  )}

                  {canInventory && (
                    <TabsTrigger value="inventory" className="rounded-lg text-slate-800 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                      <span className="inline-flex items-center gap-2">
                        <Package className="h-4 w-4" aria-hidden="true" />
                        Inventario
                      </span>
                    </TabsTrigger>
                  )}

                  {canLogistics && (
                    <TabsTrigger value="logistics" className="rounded-lg text-slate-800 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                      <span className="inline-flex items-center gap-2">
                        <Truck className="h-4 w-4" aria-hidden="true" />
                        Logística
                      </span>
                    </TabsTrigger>
                  )}

                  {canHR && (
                    <TabsTrigger value="hr" className="rounded-lg text-slate-800 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                      <span className="inline-flex items-center gap-2">
                        <Users className="h-4 w-4" aria-hidden="true" />
                        RRHH
                      </span>
                    </TabsTrigger>
                  )}
                </TabsList>
              </div>

              <TabsContent value="dashboard">{renderMainDashboard()}</TabsContent>
              <TabsContent value="cash-banks">{canCashBanks ? <CashBanksDashboard /> : <div className="text-center py-8">No tienes permisos</div>}</TabsContent>
              <TabsContent value="receipts">{canReceipts ? <ReceiptsDashboard /> : <div className="text-center py-8">No tienes permisos</div>}</TabsContent>
              <TabsContent value="student-accounts">{canStdAccounts ? <StudentAccountsDashboard /> : <div className="text-center py-8">No tienes permisos…</div>}</TabsContent>
              <TabsContent value="concepts">{canConcepts ? <ConceptsCatalog /> : <div className="text-center py-8">No tienes permisos…</div>}</TabsContent>
              <TabsContent value="reconciliation">{canReconcile ? <ReconciliationDashboard /> : <div className="text-center py-8">No tienes permisos…</div>}</TabsContent>
              <TabsContent value="reports">{canReports ? <FinanceReports /> : <div className="text-center py-8">No tienes permisos…</div>}</TabsContent>
              <TabsContent value="inventory">{canInventory ? <InventoryDashboard /> : <div className="text-center py-8">No tienes permisos…</div>}</TabsContent>
              <TabsContent value="logistics">{canLogistics ? <LogisticsDashboard /> : <div className="text-center py-8">No tienes permisos…</div>}</TabsContent>
              <TabsContent value="hr">{canHR ? <HRDashboard /> : <div className="text-center py-8">No tienes permisos…</div>}</TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinanceModule;
